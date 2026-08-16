// ============================================================
//   THE 49 BOTS
//
//   The rule that makes them feel like real players:
//   THEY DON'T CHEAT. A bot can only see what's actually in
//   front of it, it can't see through walls, it takes time to
//   react, and its aim wobbles. Everything a human deals with.
//
//   Each bot runs a "state machine" -- at any moment it is doing
//   exactly one of these:
//      WANDER      = roaming around looking for someone
//      INVESTIGATE = heard gunshots, going to check it out
//      ENGAGE      = can see an enemy, fighting them
// ============================================================

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeCharacter, animateCharacter } from "./character.js";
import { moveAxis, applyGravity } from "./physics.js";
import { getGroundHeight } from "./terrain.js";
import { castShot, hasLineOfSight, applySpread } from "./combat.js";
import { rollWeapon } from "./weapons.js";
import { safeSpotFor } from "./storm.js";

// Gamer-tag style names, so the kill feed reads like a real lobby.
const FIRST = ["Turbo", "Ghost", "Pixel", "Donut", "Waffle", "Nitro", "Shadow", "Cosmic",
  "Rocket", "Blaze", "Frost", "Zippy", "Chunky", "Sneaky", "Mega", "Wobble",
  "Thunder", "Bubble", "Crispy", "Rusty", "Silent", "Jumpy", "Neon", "Grumpy"];
const LAST = ["Muffin", "Sniper", "Llama", "Wizard", "Bandit", "Noodle", "Falcon", "Yeti",
  "Panda", "Comet", "Pickle", "Raptor", "Goblin", "Toaster", "Viper", "Moose"];

function randomName(used) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const name =
      FIRST[Math.floor(Math.random() * FIRST.length)] +
      LAST[Math.floor(Math.random() * LAST.length)];
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  return "Player" + Math.floor(Math.random() * 9999);
}

export class Bot {
  constructor(scene, name, skill, spawn) {
    this.name = name;
    this.skill = skill;
    this.alive = true;
    this.health = CONFIG.MAX_HEALTH;
    this.kills = 0;
    this.isBot = true;

    // Every bot gets its own random outfit, so you can tell them apart.
    this.shirtColor = new THREE.Color().setHSL(Math.random(), 0.75, 0.55).getHex();
    this.mesh = makeCharacter({
      skin: CONFIG.PLAYER_SKIN,
      shirt: this.shirtColor,
      pants: new THREE.Color().setHSL(Math.random(), 0.4, 0.3).getHex(),
      hair: new THREE.Color().setHSL(Math.random(), 0.5, 0.22).getHex(),
    });
    scene.add(this.mesh);

    this.position = new THREE.Vector3(spawn.x, getGroundHeight(spawn.x, spawn.z), spawn.z);
    this.velocityY = 0;
    this.yaw = Math.random() * Math.PI * 2;

    // --- BRAIN STATE ---
    this.state = "WANDER";
    this.target = null; // who we're fighting
    this.wanderGoal = this.pickWanderGoal();
    this.investigateSpot = null; // where we heard the gunshot
    this.reactionTimer = 0; // counts down before we're allowed to shoot
    this.fireCooldown = 0;
    this.strafeDirection = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = 0;
    this.repathTimer = 0;
    this.investigateCooldown = 0;
    this.fleeCooldown = 0;
    this.fleeTimer = 0;
    this.timeSinceHurt = 999; // starts fully rested
    this.giveUpTimer = 0;

    // Bots get a weapon too, rolled from the same loot table you use.
    // Slight luck bonus so the lobby isn't all pistols.
    this.weapon = rollWeapon(0.15);
    this.aimHold = 0;
    this.lootTarget = null;
  }

  pickWanderGoal() {
    // Head to a random spot ANYWHERE on the map -- not just the town
    // centre. If they all crowd into the middle they wipe each other
    // out in the first few seconds and there's no match left.
    const angle = Math.random() * Math.PI * 2;
    const distance = 15 + Math.random() * CONFIG.BOT_ROAM_RADIUS;
    return new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
  }

  /** Eyes: can this bot actually SEE that fighter right now? */
  canSee(other, colliders) {
    if (!other.alive) return false;

    const toOther = new THREE.Vector3().subVectors(other.position, this.position);
    const distance = toOther.length();
    if (distance > CONFIG.BOT_VIEW_DISTANCE) return false;

    // Is it inside our vision cone? (This is why flanking works!)
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const flat = new THREE.Vector3(toOther.x, 0, toOther.z).normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, forward.dot(flat))));
    if (angle > CONFIG.BOT_FIELD_OF_VIEW / 2) return false;

    // Is a wall in the way? Check eye-to-chest.
    const myEyes = new THREE.Vector3(this.position.x, this.position.y + 1.9, this.position.z);
    const theirChest = new THREE.Vector3(other.position.x, other.position.y + 1.3, other.position.z);
    return hasLineOfSight(myEyes, theirChest, colliders);
  }

  /** Ears: called when a gun goes off anywhere nearby. */
  hearGunshot(spot) {
    if (!this.alive) return;
    // Already in a fight? Stay focused on it.
    if (this.state === "ENGAGE") return;
    // Already on our way to check something out? Don't keep re-aiming.
    if (this.state === "INVESTIGATE") return;
    // Just came back from checking out a fight -- take a breather.
    if (this.investigateCooldown > 0) return;

    const distance = this.position.distanceTo(spot);
    if (distance > CONFIG.HEARING_RANGE) return;

    // ★ THIRD-PARTYING ★
    // Braver bots run toward the shooting. Timid ones often ignore it.
    if (Math.random() < this.skill.aggression) {
      this.state = "INVESTIGATE";
      this.investigateSpot = spot.clone();
      this.giveUpTimer = CONFIG.BOT_GIVE_UP_TIME;
    }
  }

  takeDamage(amount, attacker, game) {
    if (!this.alive) return;
    this.health -= amount;
    this.timeSinceHurt = 0; // stops healing while under fire

    // Getting shot from behind makes you spin around -- like a real player.
    if (this.state !== "ENGAGE" && attacker) {
      this.state = "ENGAGE";
      this.target = attacker;
      this.reactionTimer = this.skill.reaction;
      const toAttacker = new THREE.Vector3().subVectors(attacker.position, this.position);
      this.yaw = Math.atan2(-toAttacker.x, -toAttacker.z);
    }

    if (this.health <= 0) game.eliminate(this, attacker);
  }

  update(dt, game, time) {
    if (!this.alive) return;

    this.fireCooldown -= dt;
    this.reactionTimer -= dt;
    this.strafeTimer -= dt;
    this.repathTimer -= dt;
    this.investigateCooldown -= dt;
    this.fleeCooldown -= dt;
    this.timeSinceHurt += dt;

    // Slowly patch yourself up once nothing has shot at you for a while.
    // Without this, whoever wins a fight is left on 20 health and dies
    // instantly to the next person -- so the lobby empties way too fast.
    if (this.timeSinceHurt > CONFIG.BOT_REGEN_DELAY && this.health < CONFIG.MAX_HEALTH) {
      this.health = Math.min(CONFIG.MAX_HEALTH, this.health + CONFIG.BOT_REGEN_PER_SECOND * dt);
    }

    // --- RUNNING AWAY BEATS EVERYTHING EXCEPT THE STORM ---
    if (this.state === "FLEE") {
      this.fleeTimer -= dt;
      // Stop running once we've calmed down AND patched ourselves up a bit.
      if (this.fleeTimer <= 0 && this.health > CONFIG.MAX_HEALTH * 0.55) {
        this.state = "WANDER";
        this.wanderGoal = this.pickWanderGoal();
      } else {
        const runTo = game.storm ? safeSpotFor(this.position, game.storm) : null;
        this.walkToward(runTo ?? this.fleeGoal, CONFIG.BOT_CHASE_SPEED, dt, game.colliders);

        // Fire panicked shots over your shoulder while running away.
        const chaser = this.findVisibleEnemy(game);
        if (chaser && game.graceRemaining <= 0 && this.fireCooldown <= 0) {
          this.shoot(chaser, game);
          this.fireCooldown = this.weapon.spec.fireRate * (4 + Math.random() * 4);
        }

        this.finishFrame(dt, game, time);
        return;
      }
    }

    // --- LOOK AROUND: is anybody visible? ---
    const spotted = this.findVisibleEnemy(game);
    if (spotted) {
      if (this.state !== "ENGAGE" || this.target !== spotted) {
        // Just noticed them -- start the reaction-time clock.
        this.reactionTimer = this.skill.reaction;
      }
      this.state = "ENGAGE";
      this.target = spotted;
    } else if (this.state === "ENGAGE") {
      // Lost sight of them. Go hunt where they were.
      this.state = "INVESTIGATE";
      this.investigateSpot = this.target ? this.target.position.clone() : null;
      this.target = null;
    }

    // --- THE STORM BEATS EVERYTHING ---
    // No point winning a gunfight if the pink wall eats you afterwards.
    const runTo = game.storm ? safeSpotFor(this.position, game.storm) : null;
    if (runTo) {
      this.state = "FLEE_STORM";
      this.walkToward(runTo, CONFIG.BOT_CHASE_SPEED, dt, game.colliders);
    }
    // --- OTHERWISE, DO THE THING ---
    else if (this.state === "ENGAGE") this.doEngage(dt, game);
    else if (this.state === "INVESTIGATE") this.doInvestigate(dt, game);
    else this.doWander(dt, game);

    this.finishFrame(dt, game, time);
  }

  /** Gravity and drawing -- the bit that runs at the end of every frame. */
  finishFrame(dt, game, time) {
    const gravity = applyGravity(this.position, this.velocityY, dt, game.colliders);
    this.velocityY = gravity.velocityY;

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw + Math.PI;

    this.aimHold = Math.max(0, (this.aimHold ?? 0) - dt);
    animateCharacter(this.mesh, {
      speed: this.currentSpeed ?? 0,
      dt, time,
      onGround: gravity.onGround,
      aiming: this.aimHold > 0 || this.state === "ENGAGE",
    });
  }

  findVisibleEnemy(game) {
    let best = null;
    let bestDistance = Infinity;
    for (const other of game.fighters) {
      if (other === this || !other.alive) continue;
      const distance = this.position.distanceTo(other.position);
      if (distance < bestDistance && this.canSee(other, game.colliders)) {
        best = other;
        bestDistance = distance;
      }
    }
    return best;
  }

  // ---------- STATE: FIGHTING ----------
  doEngage(dt, game) {
    const target = this.target;
    if (!target || !target.alive) {
      this.state = "WANDER";
      return;
    }

    // Badly hurt? Break off and run for it, like a real player would.
    // Without this, every single fight is to the death and the whole
    // lobby empties out in about a minute.
    //
    // The cooldown matters! Without it, a cornered bot gets shot, flips
    // to ENGAGE, sees it's hurt, flips straight back to FLEE with a
    // fresh timer -- forever. Two bots stood 17m apart doing this for
    // over a minute. Now, once you've run away recently, you have to
    // stand and fight.
    if (this.health < CONFIG.MAX_HEALTH * CONFIG.BOT_FLEE_HEALTH && this.fleeCooldown <= 0) {
      this.state = "FLEE";
      this.fleeTimer = CONFIG.BOT_FLEE_TIME;
      this.fleeCooldown = CONFIG.BOT_FLEE_COOLDOWN;
      // Run directly away from whoever is shooting at us.
      const away = new THREE.Vector3().subVectors(this.position, target.position).normalize();
      this.fleeGoal = this.position.clone().addScaledVector(away, 45);
      this.target = null;
      return;
    }

    const toTarget = new THREE.Vector3().subVectors(target.position, this.position);
    const distance = toTarget.length();

    // Turn to face them.
    this.yaw = Math.atan2(-toTarget.x, -toTarget.z);

    // Strafe side to side while fighting -- humans never stand still.
    if (this.strafeTimer <= 0) {
      this.strafeDirection *= -1;
      this.strafeTimer = 0.6 + Math.random() * 0.9;
    }

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    // Close the gap if far away, back off if uncomfortably close.
    let approach = 0;
    if (distance > 34) approach = 1;
    else if (distance < 12) approach = -0.6;

    const speed = CONFIG.BOT_CHASE_SPEED;
    const moveX = forward.x * approach + right.x * this.strafeDirection * 0.75;
    const moveZ = forward.z * approach + right.z * this.strafeDirection * 0.75;

    this.moveBy(moveX, moveZ, speed, dt, game.colliders);

    // --- SHOOT ---
    // Only after the reaction delay -- this is what gives you a
    // fair chance if you spot them first.
    // Nobody shoots during the "get ready" countdown at match start.
    const readyToFight = game.graceRemaining <= 0;

    if (readyToFight && this.reactionTimer <= 0 && this.fireCooldown <= 0 && distance < this.weapon.spec.range) {
      this.shoot(target, game);
      // Bots don't hold the trigger down perfectly -- they fire in
      // bursts with a breather in between, like a person would.
      this.fireCooldown = this.weapon.spec.fireRate * (2.2 + Math.random() * 3);
    }
  }

  shoot(target, game) {
    this.aimHold = 0.9; // keeps the gun raised while firing
    const from = new THREE.Vector3(this.position.x, this.position.y + 1.6, this.position.z);
    const aimAt = new THREE.Vector3(target.position.x, target.position.y + 1.25, target.position.z);
    const direction = new THREE.Vector3().subVectors(aimAt, from).normalize();
    const range = this.weapon.spec.range;

    for (let pellet = 0; pellet < this.weapon.spec.pellets; pellet++) {
      const shotDirection = direction.clone();
      // Their aim wobbles -- worse for low-skill bots. They WILL miss.
      applySpread(shotDirection, this.skill.spread + this.weapon.spec.spread);

      const hit = castShot(from, shotDirection, range, game.fighters, game.colliders, this);
      game.effects.tracer(from, hit.point, this.weapon.rarity.color);

      if (hit.fighter) {
        // Bots hit softer than you do -- see BOT_BULLET_DAMAGE in config.js.
        // Their weapon's rarity still matters, so a legendary bot is scary.
        const base = CONFIG.BOT_BULLET_DAMAGE * this.weapon.rarity.damageBoost;
        const damage = base * (hit.isHead ? CONFIG.HEADSHOT_MULTIPLIER : 1);
        game.effects.spark(hit.point, hit.isHead ? 0xff4d4d : 0xffcc33);
        hit.fighter.takeDamage(damage, this, game);
      } else if (hit.hitWall) {
        game.effects.spark(hit.point, 0xdddddd);
      }
    }

    // Only make a sound if it's close enough for you to hear.
    if (game.player && this.position.distanceTo(game.player.position) < 60) {
      game.sounds.shoot(this.weapon);
    }

    // BANG -- everyone nearby hears it. This is what creates third-partying.
    game.makeNoise(this.position, this);
  }

  // ---------- STATE: HEARD SOMETHING ----------
  doInvestigate(dt, game) {
    if (!this.investigateSpot) {
      this.state = "WANDER";
      return;
    }

    // Give up after a while instead of chasing a ghost forever.
    this.giveUpTimer = (this.giveUpTimer ?? CONFIG.BOT_GIVE_UP_TIME) - dt;

    const arrived = this.position.distanceTo(this.investigateSpot) < 6;
    if (arrived || this.giveUpTimer <= 0) {
      this.state = "WANDER";
      this.investigateSpot = null;
      this.giveUpTimer = null;
      this.investigateCooldown = CONFIG.BOT_INVESTIGATE_COOLDOWN;
      this.wanderGoal = this.pickWanderGoal();
      return;
    }
    this.walkToward(this.investigateSpot, CONFIG.BOT_CHASE_SPEED, dt, game.colliders);
  }

  // ---------- STATE: ROAMING (and looting) ----------
  doWander(dt, game) {
    // Found a chest nearby? Go crack it open, same as you would.
    const chest = this.findNearbyChest(game);
    if (chest) {
      this.walkToward(chest.position, CONFIG.BOT_WALK_SPEED, dt, game.colliders);
      if (this.position.distanceTo(chest.position) < CONFIG.PICKUP_RANGE + 1.2) {
        const dropped = chest.open(game.scene, game.pickups, game.effects);
        // Take the best thing that popped out.
        for (const pickup of dropped) {
          if (pickup.weapon.damage > this.weapon.damage) {
            this.weapon = pickup.weapon;
            pickup.remove(game.scene);
          }
        }
        if (game.player && this.position.distanceTo(game.player.position) < 45) {
          game.sounds.chest();
        }
      }
      return;
    }

    // Spotted a better gun nearby? Go get it. Bots loot just like you do.
    const loot = this.findBetterLoot(game);
    if (loot) {
      this.walkToward(loot.position, CONFIG.BOT_WALK_SPEED, dt, game.colliders);
      if (this.position.distanceTo(loot.position) < CONFIG.PICKUP_RANGE) {
        this.weapon = loot.weapon;
        loot.remove(game.scene);
      }
      return;
    }

    if (!this.wanderGoal || this.position.distanceTo(this.wanderGoal) < 5 || this.repathTimer <= 0) {
      this.wanderGoal = this.pickWanderGoal();
      this.repathTimer = 6 + Math.random() * 6;
    }
    this.walkToward(this.wanderGoal, CONFIG.BOT_WALK_SPEED, dt, game.colliders);
  }

  /** Looks for an unopened chest worth walking to. */
  findNearbyChest(game) {
    if (!game.chests) return null;
    for (const chest of game.chests) {
      if (chest.opened) continue;
      if (this.position.distanceTo(chest.position) < 26) return chest;
    }
    return null;
  }

  /** Looks for a nearby gun that's better than the one we're holding. */
  findBetterLoot(game) {
    if (!game.pickups) return null;
    const myPower = this.weapon.damage;

    for (const pickup of game.pickups) {
      if (pickup.taken) continue;
      if (this.position.distanceTo(pickup.position) > 22) continue;
      if (pickup.weapon.damage > myPower) return pickup;
    }
    return null;
  }

  // ---------- MOVEMENT HELPERS ----------
  walkToward(spot, speed, dt, colliders) {
    const toSpot = new THREE.Vector3().subVectors(spot, this.position);
    toSpot.y = 0;
    if (toSpot.lengthSq() < 0.001) return;
    toSpot.normalize();

    // Face where we're walking.
    this.yaw = Math.atan2(-toSpot.x, -toSpot.z);
    this.moveBy(toSpot.x, toSpot.z, speed, dt, colliders);
  }

  moveBy(dirX, dirZ, speed, dt, colliders) {
    const length = Math.hypot(dirX, dirZ);
    if (length < 0.001) {
      this.currentSpeed = 0;
      return;
    }
    dirX /= length;
    dirZ /= length;

    const beforeX = this.position.x;
    const beforeZ = this.position.z;

    moveAxis(this.position, "x", dirX * speed * dt, colliders);
    moveAxis(this.position, "z", dirZ * speed * dt, colliders);

    // If a wall stopped us, pick somewhere else to go rather than
    // grinding face-first into it forever.
    const actuallyMoved = Math.hypot(this.position.x - beforeX, this.position.z - beforeZ);
    if (actuallyMoved < speed * dt * 0.3) {
      this.stuckTimer = (this.stuckTimer ?? 0) + dt;
      if (this.stuckTimer > 0.5) {
        this.wanderGoal = this.pickWanderGoal();
        this.investigateSpot = null;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }

    this.currentSpeed = speed;
  }
}

/**
 * Finds a spawn spot that isn't right on top of another bot.
 *
 * This matters more than it sounds! The first version placed bots at
 * evenly spaced angles around a circle, which put every bot about 14
 * metres from its neighbours -- well inside the 44m sight range. The
 * second the countdown ended, all 49 could see somebody, and the whole
 * lobby wiped out in under a minute. Scattering them fixes it.
 */
function pickSpawn(alreadyPlaced) {
  const MIN_GAP = 34; // must be at least this far from every other bot

  for (let attempt = 0; attempt < 200; attempt++) {
    // The sqrt is the trick for spreading points EVENLY across a circle.
    // Without it everyone bunches up near the middle.
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.sqrt(Math.random()) * (CONFIG.BOT_ROAM_RADIUS - 40);
    const spot = { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance };

    const tooClose = alreadyPlaced.some(
      (other) => Math.hypot(other.x - spot.x, other.z - spot.z) < MIN_GAP
    );
    if (!tooClose || attempt > 150) {
      alreadyPlaced.push(spot);
      return spot;
    }
  }
  return { x: 0, z: 0 };
}

/** Creates all 49 bots with the skill mix from config.js. */
export function createBots(scene, openSpots) {
  const bots = [];
  const usedNames = new Set();

  // Build the list of skill levels: 10 rookies, 29 normal, 8 good, 2 beasts.
  const skillPool = [];
  for (const tier of CONFIG.BOT_SKILLS) {
    for (let i = 0; i < tier.count; i++) skillPool.push(tier);
  }
  // Shuffle, so you can't tell who's dangerous by looking at them.
  for (let i = skillPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [skillPool[i], skillPool[j]] = [skillPool[j], skillPool[i]];
  }

  const placed = [];
  for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
    const skill = skillPool[i] ?? CONFIG.BOT_SKILLS[1];
    bots.push(new Bot(scene, randomName(usedNames), skill, pickSpawn(placed)));
  }

  return bots;
}
