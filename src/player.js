// ============================================================
//   THE PLAYER (that's Buzz -- that's you)
//   Skydiving in, running, jumping, looting chests, and shooting.
// ============================================================

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeCharacter, animateCharacter } from "./character.js";
import { moveAxis, applyGravity } from "./physics.js";
import { getGroundHeight } from "./terrain.js";
import { castShot, applySpread, distanceToWall, pointInsideAnyBox } from "./combat.js";
import { WeaponInstance } from "./weapons.js";

export class Player {
  constructor(scene) {
    this.name = CONFIG.PLAYER_NAME;
    this.isBot = false;
    this.alive = true;
    this.health = CONFIG.MAX_HEALTH;
    this.kills = 0;

    this.mesh = makeCharacter({
      skin: CONFIG.PLAYER_SKIN,
      shirt: CONFIG.PLAYER_SHIRT,
      pants: CONFIG.PLAYER_PANTS,
    });
    scene.add(this.mesh);

    // --- SKYDIVE --- you start high in the sky and fall in.
    this.state = "SKYDIVE";
    this.position = new THREE.Vector3(0, CONFIG.SKYDIVE_HEIGHT, 0);
    this.velocityY = 0;
    this.onGround = false;
    this.currentSpeed = 0;

    this.yaw = 0;
    this.pitch = -0.15;

    // --- INVENTORY ---
    // You start with a basic pistol so you're never totally helpless,
    // then hunt for something better. Keys 1, 2, 3 switch weapons.
    this.inventory = [new WeaponInstance("pistol", "common"), null, null];
    this.slot = 0;
    this.victoryTimer = 0;

    // You heal back up out of combat, exactly like the bots do.
    // (They had this before you did, which was quietly unfair!)
    this.timeSinceHurt = 999;

    // --- CROUCHING --- hold C. Slower, but harder to hit and more accurate.
    this.crouching = false;

    // --- MED KITS --- press Q to use one. Takes 5 seconds standing still.
    this.medkits = 0;
    this.healTimer = 0; // counts UP toward MEDKIT_HEAL_TIME while healing
    this.healing = false;
  }

  get weapon() { return this.inventory[this.slot]; }

  look(deltaX, deltaY) {
    if (!this.alive) return;
    this.yaw -= deltaX * CONFIG.TURN_SPEED;
    this.pitch -= deltaY * CONFIG.TURN_SPEED;
    this.pitch = Math.max(-1.2, Math.min(0.7, this.pitch));
  }

  takeDamage(amount, attacker, game) {
    if (!this.alive) return;
    this.health -= amount;
    this.timeSinceHurt = 0; // stops healing while you're under fire

    // Getting shot interrupts a med kit -- you can't bandage up mid-firefight.
    if (this.healing) {
      this.healing = false;
      this.healTimer = 0;
      game.ui.toast("Healing interrupted!", 0xff6b6b);
    }

    game.ui.flashHurt();
    game.ui.setHealth(this.health);
    if (this.health <= 0) game.eliminate(this, attacker);
  }

  /** Switch to inventory slot 0, 1 or 2. */
  selectSlot(index, game) {
    if (index < 0 || index >= CONFIG.INVENTORY_SLOTS) return;
    if (!this.inventory[index]) return; // empty slot
    this.slot = index;
    game.ui.setInventory(this.inventory, this.slot);
  }

  /** Put a weapon in the first free slot, or replace the current one. */
  takeWeapon(weapon, game) {
    const freeSlot = this.inventory.findIndex((w) => w === null);
    if (freeSlot !== -1) {
      this.inventory[freeSlot] = weapon;
      this.slot = freeSlot;
    } else {
      this.inventory[this.slot] = weapon; // swap out what we're holding
    }
    game.ui.setInventory(this.inventory, this.slot);
    game.ui.toast(`Picked up ${weapon.name}`, weapon.rarity.color);
    game.sounds.pickup();
  }

  /**
   * What could I grab right now?
   * Both the E key AND the on-screen "[E] ..." prompt call this, so the
   * prompt can never lie to you about what pressing E will do.
   * Returns null when there's nothing in reach.
   */
  nearbyInteractable(game) {
    if (!this.alive || this.state === "SKYDIVE") return null;

    // Chests win -- they're the exciting thing.
    for (const chest of game.chests) {
      if (chest.opened) continue;
      if (this.position.distanceTo(chest.position) < CONFIG.PICKUP_RANGE + 1.2) {
        return { kind: "chest", chest, label: "Open Chest", color: 0xffc02e };
      }
    }

    // Med kits, if we've got room to carry another.
    if (this.medkits < CONFIG.MEDKIT_MAX_CARRIED) {
      for (const medkit of game.medkits) {
        if (medkit.taken) continue;
        if (this.position.distanceTo(medkit.position) < CONFIG.PICKUP_RANGE) {
          return { kind: "medkit", medkit, label: "Take Med Kit", color: 0x6bf06b };
        }
      }
    }

    // Otherwise, the closest gun on the ground.
    let closest = null;
    let closestDistance = CONFIG.PICKUP_RANGE;
    for (const pickup of game.pickups) {
      if (pickup.taken) continue;
      const distance = this.position.distanceTo(pickup.position);
      if (distance < closestDistance) {
        closest = pickup;
        closestDistance = distance;
      }
    }
    if (closest) {
      return {
        kind: "pickup", pickup: closest,
        label: "Pick Up " + closest.weapon.name,
        color: closest.weapon.rarity.color,
      };
    }
    return null;
  }

  /**
   * The Q key: use a med kit.
   * You have to stand still for 5 seconds and nobody can be shooting you.
   */
  startHealing(game) {
    if (!this.alive || this.state !== "PLAYING") return;
    if (this.healing) { // pressing Q again cancels
      this.healing = false;
      this.healTimer = 0;
      game.ui.toast("Healing cancelled", 0xaaaaaa);
      return;
    }
    if (this.medkits <= 0) {
      game.ui.toast("No med kits! Look for the white boxes.", 0xff6b6b);
      return;
    }
    if (this.health >= CONFIG.MAX_HEALTH) {
      game.ui.toast("Already at full health", 0xaaaaaa);
      return;
    }
    this.healing = true;
    this.healTimer = 0;
  }

  /** The E key: opens a nearby chest, or grabs nearby loot. */
  interact(game) {
    const target = this.nearbyInteractable(game);
    if (!target) return;

    if (target.kind === "medkit") {
      this.medkits++;
      target.medkit.remove(game.scene);
      game.ui.toast(`Med Kit (${this.medkits}/${CONFIG.MEDKIT_MAX_CARRIED})`, 0x6bf06b);
      game.sounds.pickup();
      return;
    }

    if (target.kind === "chest") {
      target.chest.open(game.scene, game.pickups, game.effects);
      game.ui.toast("Chest opened!", 0xffc02e);
      game.sounds.chest();
    } else {
      this.takeWeapon(target.pickup.weapon, game);
      target.pickup.remove(game.scene);
    }
  }

  reload(game) {
    const weapon = this.weapon;
    if (!weapon || weapon.isMelee) return;
    if (weapon.reloadTimer > 0 || weapon.ammoInMag === weapon.spec.magSize) return;
    weapon.reloadTimer = weapon.spec.reload;
    game.ui.setReloading(true);
  }

  shoot(game, camera) {
    if (!this.alive || this.state === "SKYDIVE") return;
    const weapon = this.weapon;
    if (!weapon || weapon.fireCooldown > 0 || weapon.reloadTimer > 0) return;

    if (weapon.ammoInMag <= 0) {
      this.reload(game);
      return;
    }

    weapon.ammoInMag--;
    weapon.fireCooldown = weapon.spec.fireRate;
    this.aimHold = 0.9; // keep the gun raised for a moment after firing
    game.ui.setAmmo(weapon);

    // Shoot from the camera, straight down the crosshair -- that's what
    // makes "where I'm pointing" match "where the bullet goes".
    const from = new THREE.Vector3();
    camera.getWorldPosition(from);
    const aim = new THREE.Vector3();
    camera.getWorldDirection(aim);

    const muzzle = new THREE.Vector3(this.position.x, this.position.y + 1.55, this.position.z);
    const movingPenalty = this.isMoving ? 0.02 : 0;
    // Crouching steadies your aim.
    const steadiness = this.crouching ? CONFIG.CROUCH_ACCURACY_BONUS : 1;

    // Shotguns fire several pellets at once.
    for (let pellet = 0; pellet < weapon.spec.pellets; pellet++) {
      const direction = aim.clone();
      applySpread(direction, (weapon.spec.spread + movingPenalty) * steadiness);

      const hit = castShot(from, direction, weapon.spec.range, game.fighters, game.colliders, this);
      game.effects.tracer(muzzle, hit.point, weapon.rarity.color);

      if (hit.fighter) {
        const damage = weapon.damage * (hit.isHead ? CONFIG.HEADSHOT_MULTIPLIER : 1);
        game.effects.spark(hit.point, hit.isHead ? 0xff4d4d : 0xffcc33);
        game.ui.damageNumber(hit.point, Math.round(damage), hit.isHead, game.camera);
        hit.fighter.takeDamage(damage, this, game);
      } else if (hit.hitWall) {
        game.effects.spark(hit.point, 0xdddddd);
      }
    }

    game.sounds.shoot(weapon);
    if (weapon.ammoInMag === 0) this.reload(game);
    game.makeNoise(this.position, this);
  }

  update(dt, keys, game, camera, time) {
    if (!this.alive) {
      this.updateCamera(camera, game.colliders);
      return;
    }

    // --- CROUCHING --- hold C (or either Ctrl).
    this.crouching =
      keys.has("KeyC") || keys.has("ControlLeft") || keys.has("ControlRight");
    // Squash the model down. This also shrinks your HITBOX (see combat.js),
    // so crouching genuinely makes you harder to shoot.
    this.mesh.scale.y = this.crouching ? CONFIG.CROUCH_HEIGHT : 1;

    // --- USING A MED KIT --- 5 seconds of standing still.
    if (this.healing) {
      if (this.isMoving) {
        // Moving cancels it, just like Fortnite.
        this.healing = false;
        this.healTimer = 0;
        game.ui.toast("Stand still to heal!", 0xffd90f);
      } else {
        this.healTimer += dt;
        if (this.healTimer >= CONFIG.MEDKIT_HEAL_TIME) {
          this.medkits--;
          this.health = Math.min(CONFIG.MAX_HEALTH, this.health + CONFIG.MEDKIT_HEAL_AMOUNT);
          this.healing = false;
          this.healTimer = 0;
          game.ui.setHealth(this.health);
          game.ui.toast("Healed!", 0x6bf06b);
          game.sounds.pickup();
        }
      }
    }
    game.ui.setHealProgress(
      this.healing ? this.healTimer / CONFIG.MEDKIT_HEAL_TIME : 0,
      this.medkits
    );

    // --- HEALING UP OUT OF COMBAT ---
    this.timeSinceHurt += dt;
    if (this.timeSinceHurt > CONFIG.REGEN_DELAY && this.health < CONFIG.MAX_HEALTH) {
      this.health = Math.min(CONFIG.MAX_HEALTH, this.health + CONFIG.REGEN_PER_SECOND * dt);
      game.ui.setHealth(this.health);
    }

    // --- WEAPON TIMERS ---
    const weapon = this.weapon;
    if (weapon) {
      weapon.fireCooldown -= dt;
      if (weapon.reloadTimer > 0) {
        weapon.reloadTimer -= dt;
        if (weapon.reloadTimer <= 0) {
          weapon.ammoInMag = weapon.spec.magSize;
          game.ui.setAmmo(weapon);
          game.ui.setReloading(false);
        }
      }
    }

    // --- SKYDIVING IN ---
    if (this.state === "SKYDIVE") {
      this.updateSkydive(dt, keys, game, camera, time);
      return;
    }

    // --- WON THE MATCH: do a victory spin ---
    if (this.state === "VICTORY") {
      this.victoryTimer += dt;
      this.mesh.rotation.y += dt * 6;
      this.mesh.position.y = this.position.y + Math.abs(Math.sin(this.victoryTimer * 5)) * 1.1;
      this.updateCamera(camera, game.colliders);
      return;
    }

    // --- WHICH WAY IS FORWARD? ---
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;

    let moveX = 0;
    let moveZ = 0;
    if (keys.has("KeyW")) { moveX += forwardX; moveZ += forwardZ; }
    if (keys.has("KeyS")) { moveX -= forwardX; moveZ -= forwardZ; }
    if (keys.has("KeyD")) { moveX += rightX; moveZ += rightZ; }
    if (keys.has("KeyA")) { moveX -= rightX; moveZ -= rightZ; }

    // Holding W+D shouldn't be faster than W alone.
    const length = Math.hypot(moveX, moveZ);
    if (length > 0) { moveX /= length; moveZ /= length; }

    const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    // Crouching wins over sprinting -- you can't sprint while crouched.
    const speed = this.crouching
      ? CONFIG.CROUCH_SPEED
      : sprinting
      ? CONFIG.SPRINT_SPEED
      : CONFIG.WALK_SPEED;
    this.currentSpeed = length > 0 ? speed : 0;
    this.isMoving = length > 0;

    moveAxis(this.position, "x", moveX * speed * dt, game.colliders);
    moveAxis(this.position, "z", moveZ * speed * dt, game.colliders);

    if (keys.has("Space") && this.onGround) {
      this.velocityY = CONFIG.JUMP_POWER;
      this.onGround = false;
    }
    const gravity = applyGravity(this.position, this.velocityY, dt, game.colliders);
    this.velocityY = gravity.velocityY;
    this.onGround = gravity.onGround;

    this.mesh.position.copy(this.position);
    // The "+ Math.PI" spins him a half-turn: his face is built pointing
    // toward +Z, but "forward" is -Z. Without it he moonwalks.
    this.mesh.rotation.y = this.yaw + Math.PI;

    // Count as "aiming" for a moment after each shot, so the arms stay
    // up during rapid fire instead of flapping between poses.
    this.aimHold = Math.max(0, (this.aimHold ?? 0) - dt);
    animateCharacter(this.mesh, {
      speed: this.currentSpeed,
      dt, time,
      onGround: this.onGround,
      crouching: this.crouching,
      aiming: this.aimHold > 0,
    });

    this.updateCamera(camera, game.colliders);
  }

  /** Falling in from the sky at the start of the match. */
  updateSkydive(dt, keys, game, camera, time) {
    // Steer while you fall -- pick where you want to land.
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;

    let moveX = 0;
    let moveZ = 0;
    if (keys.has("KeyW")) { moveX += forwardX; moveZ += forwardZ; }
    if (keys.has("KeyS")) { moveX -= forwardX; moveZ -= forwardZ; }
    if (keys.has("KeyD")) { moveX += rightX; moveZ += rightZ; }
    if (keys.has("KeyA")) { moveX -= rightX; moveZ -= rightZ; }

    const length = Math.hypot(moveX, moveZ);
    if (length > 0) {
      moveX /= length;
      moveZ /= length;
      this.position.x += moveX * CONFIG.SKYDIVE_GLIDE_SPEED * dt;
      this.position.z += moveZ * CONFIG.SKYDIVE_GLIDE_SPEED * dt;
    }

    // Fall at a steady speed (a parachute, not a rock).
    this.position.y -= CONFIG.SKYDIVE_FALL_SPEED * dt;

    const groundHere = getGroundHeight(this.position.x, this.position.z);
    if (this.position.y <= groundHere) {
      // TOUCHDOWN.
      this.position.y = groundHere;
      this.velocityY = 0;
      this.onGround = true;
      this.state = "PLAYING";
      game.onPlayerLanded();
    }

    // Arms and legs spread out, like an actual skydiver.
    const rig = this.mesh.userData.rig;
    rig.leftArm.shoulder.rotation.z = 1.15;
    rig.rightArm.shoulder.rotation.z = -1.15;
    rig.leftArm.shoulder.rotation.x = -0.5;
    rig.rightArm.shoulder.rotation.x = -0.5;
    rig.leftArm.elbow.rotation.x = -0.7;
    rig.rightArm.elbow.rotation.x = -0.7;
    rig.leftLeg.hip.rotation.z = 0.4;
    rig.rightLeg.hip.rotation.z = -0.4;
    rig.leftLeg.knee.rotation.x = 0.5;
    rig.rightLeg.knee.rotation.x = 0.5;
    rig.torso.rotation.x = -0.35; // chest up, looking at the ground below

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw + Math.PI;
    this.updateCamera(camera, game.colliders);
  }

  /** Puts the camera behind and slightly to the right of Buzz. */
  updateCamera(camera, colliders) {
    const head = new THREE.Vector3(
      this.position.x,
      this.position.y + CONFIG.PLAYER_HEIGHT,
      this.position.z
    );

    // Over-the-shoulder shift, like Fortnite.
    const sideX = Math.cos(this.yaw) * CONFIG.CAMERA_SIDE;
    const sideZ = -Math.sin(this.yaw) * CONFIG.CAMERA_SIDE;
    // The point the camera looks at, and swings around.
    const pivot = new THREE.Vector3(head.x + sideX, head.y, head.z + sideZ);

    // Which way is "backwards from Buzz's head"?
    const back = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();

    // ★ CAMERA COLLISION ★
    // Look backwards from Buzz's head and find the first wall. If one is
    // closer than where the camera wants to sit, pull the camera in front
    // of it. Without this the camera buries itself inside buildings and
    // you end up staring at the inside of a wall -- which happens a LOT
    // now that you can walk into the donut shop.
    // The camera's raised starting point. This lift USED to be added
    // after the wall check, which knocked the camera off the ray we'd
    // just tested and let it poke through walls about 0.5% of the time.
    // Folding it in first means the camera stays exactly on the safe ray.
    const eye = new THREE.Vector3(pivot.x, pivot.y + CONFIG.CAMERA_HEIGHT * 0.3, pivot.z);

    const walls = colliders ?? [];
    const wanted = CONFIG.CAMERA_DISTANCE;
    const wallDistance = distanceToWall(eye, back, wanted, walls);
    let distance = Math.max(1.1, Math.min(wanted, wallDistance - 0.45));

    // Place the camera, keeping it above the ground.
    const place = (d) => {
      camera.position.set(eye.x + back.x * d, eye.y + back.y * d, eye.z + back.z * d);
      const groundHere = getGroundHeight(camera.position.x, camera.position.z);
      camera.position.y = Math.max(groundHere + 0.7, camera.position.y);
    };
    place(distance);

    // FINAL SAFETY NET. The ground-lift above can shove the camera
    // sideways into a building even after the wall check passed. Rather
    // than chase every edge case, we just check the real final position
    // and keep reeling the camera in until it's genuinely outside.
    let guard = 0;
    while (distance > 0.6 && guard++ < 24 && pointInsideAnyBox(camera.position, walls)) {
      distance -= 0.3;
      place(distance);
    }

    camera.lookAt(pivot.x, pivot.y, pivot.z);
  }
}
