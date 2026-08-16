// ============================================================
//   WEAPONS, CHESTS, AND LOOT
//
//   ★ RARITY ★  Every weapon comes in a colour, worst to best:
//      GREY   Common      (weakest)
//      GREEN  Uncommon
//      BLUE   Rare
//      PURPLE Epic
//      GOLD   Legendary   (best -- almost always from a chest!)
//
//   Chests give much better loot than stuff lying on the floor.
//   That's the whole point of hunting for them.
// ============================================================

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { getGroundHeight } from "./terrain.js";

// ------------------------------------------------------------
//   RARITY -- the colours and how much they boost a weapon
// ------------------------------------------------------------
export const RARITY = {
  common:    { name: "Common",    color: 0xb0b6bd, damageBoost: 1.0,  weight: 40 },
  uncommon:  { name: "Uncommon",  color: 0x4ddb63, damageBoost: 1.15, weight: 28 },
  rare:      { name: "Rare",      color: 0x3da5ff, damageBoost: 1.3,  weight: 18 },
  epic:      { name: "Epic",      color: 0xb14dff, damageBoost: 1.5,  weight: 10 },
  legendary: { name: "Legendary", color: 0xffc02e, damageBoost: 1.75, weight: 4 },
};

// ------------------------------------------------------------
//   THE WEAPONS
//   ★ Change these numbers to rebalance the whole game! ★
//     damage    = how much one hit takes off (before rarity boost)
//     fireRate  = seconds between shots (smaller = faster)
//     range     = how far it reaches, in metres
//     pellets   = bullets per shot (shotguns fire lots at once)
//     spread    = how much the aim wobbles
// ------------------------------------------------------------
export const WEAPONS = {
  pistol: {
    name: "Pistol", silly: false,
    damage: 20, fireRate: 0.3, magSize: 12, reload: 1.2,
    range: 90, pellets: 1, spread: 0.012, color: 0x6b7280,
  },
  rifle: {
    name: "Rifle", silly: false,
    damage: 22, fireRate: 0.13, magSize: 30, reload: 1.7,
    range: 160, pellets: 1, spread: 0.016, color: 0x4b5563,
  },
  shotgun: {
    name: "Shotgun", silly: false,
    damage: 11, fireRate: 0.85, magSize: 6, reload: 2.2,
    range: 34, pellets: 8, spread: 0.075, color: 0x8b5a2b,
  },
  sniper: {
    name: "Sniper", silly: false,
    damage: 85, fireRate: 1.5, magSize: 5, reload: 2.8,
    range: 320, pellets: 1, spread: 0.002, color: 0x374151,
  },
  slingshot: {
    name: "Slingshot", silly: true,
    damage: 16, fireRate: 0.42, magSize: 10, reload: 1.1,
    range: 70, pellets: 1, spread: 0.02, color: 0xc2703a,
  },
  waterBalloon: {
    name: "Water Balloon", silly: true,
    damage: 34, fireRate: 0.9, magSize: 5, reload: 1.9,
    range: 55, pellets: 1, spread: 0.03, color: 0x38bdf8,
  },
  skateboard: {
    name: "Skateboard Whack", silly: true,
    damage: 55, fireRate: 0.7, magSize: 999, reload: 0,
    range: 6, pellets: 1, spread: 0.05, color: 0xef4444,
  },
  donutLauncher: {
    name: "Donut Launcher", silly: true,
    damage: 70, fireRate: 1.1, magSize: 4, reload: 2.5,
    range: 120, pellets: 1, spread: 0.01, color: 0xff9ec4,
  },

  // ---------- SERIOUS GUNS ----------
  smg: {
    name: "SMG", silly: false,
    damage: 13, fireRate: 0.075, magSize: 35, reload: 1.8,
    range: 60, pellets: 1, spread: 0.032, color: 0x5b6470,
  },
  burstRifle: {
    name: "Burst Rifle", silly: false,
    damage: 28, fireRate: 0.34, magSize: 24, reload: 1.9,
    range: 140, pellets: 1, spread: 0.01, color: 0x3f4b5b,
  },
  revolver: {
    name: "Revolver", silly: false,
    damage: 48, fireRate: 0.62, magSize: 6, reload: 2.1,
    range: 110, pellets: 1, spread: 0.008, color: 0x8a6a3a,
  },
  crossbow: {
    name: "Crossbow", silly: false,
    damage: 68, fireRate: 1.25, magSize: 3, reload: 2.0,
    range: 200, pellets: 1, spread: 0.004, color: 0x6b4a2f,
  },
  minigun: {
    name: "Minigun", silly: false,
    damage: 11, fireRate: 0.055, magSize: 90, reload: 4.2,
    range: 100, pellets: 1, spread: 0.05, color: 0x2f3540,
  },

  // ---------- SILLY CARTOON WEAPONS ----------
  pieCannon: {
    name: "Pie Cannon", silly: true,
    damage: 44, fireRate: 0.8, magSize: 6, reload: 2.0,
    range: 70, pellets: 1, spread: 0.025, color: 0xf6d372,
  },
  bubbleBlaster: {
    name: "Bubble Blaster", silly: true,
    damage: 9, fireRate: 0.06, magSize: 60, reload: 2.2,
    range: 45, pellets: 1, spread: 0.055, color: 0x7fd8ff,
  },
  boomerang: {
    name: "Boomerang", silly: true,
    damage: 40, fireRate: 0.75, magSize: 4, reload: 1.4,
    range: 65, pellets: 1, spread: 0.018, color: 0xc98b3a,
  },
  fishSlap: {
    name: "Fish Slap", silly: true,
    damage: 80, fireRate: 0.62, magSize: 999, reload: 0,
    range: 6.5, pellets: 1, spread: 0.05, color: 0x6fb7c9,
  },
};

// Which weapons can show up at which rarity.
// The good stuff only appears at high rarity -- so chests matter.
const RARITY_POOLS = {
  common:    ["pistol", "slingshot", "skateboard", "bubbleBlaster"],
  uncommon:  ["pistol", "rifle", "smg", "slingshot", "waterBalloon", "boomerang"],
  rare:      ["rifle", "shotgun", "smg", "revolver", "waterBalloon", "pieCannon"],
  epic:      ["rifle", "shotgun", "sniper", "burstRifle", "crossbow", "donutLauncher", "fishSlap"],
  legendary: ["sniper", "donutLauncher", "shotgun", "minigun", "crossbow", "fishSlap"],
};

/** One weapon a player is actually holding. */
export class WeaponInstance {
  constructor(key, rarityKey) {
    this.key = key;
    this.spec = WEAPONS[key];
    this.rarityKey = rarityKey;
    this.rarity = RARITY[rarityKey];
    this.ammoInMag = this.spec.magSize;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
  }
  get name() { return `${this.rarity.name} ${this.spec.name}`; }
  get damage() { return this.spec.damage * this.rarity.damageBoost; }
  get isMelee() { return this.spec.range <= 8; }
}

/**
 * Rolls a random weapon.
 * `luck` shifts the odds toward better rarities -- chests use high luck,
 * floor loot uses low luck. That's what makes chests worth hunting.
 */
export function rollWeapon(luck = 0) {
  const entries = Object.entries(RARITY);

  // Better luck = rare things get heavier weights.
  const weighted = entries.map(([key, r], index) => {
    const rarityStep = index; // 0 common ... 4 legendary
    return { key, weight: r.weight * Math.pow(1 + luck, rarityStep) };
  });

  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;
  let chosen = weighted[0].key;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) { chosen = w.key; break; }
  }

  const pool = RARITY_POOLS[chosen];
  const weaponKey = pool[Math.floor(Math.random() * pool.length)];
  return new WeaponInstance(weaponKey, chosen);
}

// ------------------------------------------------------------
//   LOOT ON THE GROUND -- the spinning guns you walk over
// ------------------------------------------------------------
export class Pickup {
  constructor(scene, weapon, x, z) {
    this.weapon = weapon;
    this.taken = false;
    this.position = new THREE.Vector3(x, getGroundHeight(x, z) + 0.9, z);

    this.mesh = new THREE.Group();

    // The gun itself -- a little blocky shape.
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.35, 0.35),
      new THREE.MeshLambertMaterial({ color: weapon.spec.color })
    );
    gun.castShadow = true;
    this.mesh.add(gun);

    // A glowing beam of the rarity colour, so you can spot it from far away.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 5, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: weapon.rarity.color, transparent: true, opacity: 0.28,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    beam.position.y = 2.2;
    this.mesh.add(beam);

    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  update(dt, time) {
    if (this.taken) return;
    this.mesh.rotation.y += dt * 1.6; // spin
    this.mesh.position.y = this.position.y + Math.sin(time * 2.5) * 0.14; // bob
  }

  remove(scene) {
    this.taken = true;
    scene.remove(this.mesh);
  }
}

// ------------------------------------------------------------
//   ★ CHESTS ★
//   Walk up and press E. Much better loot than the floor.
// ------------------------------------------------------------
export class Chest {
  constructor(scene, x, z) {
    this.opened = false;
    this.position = new THREE.Vector3(x, getGroundHeight(x, z), z);

    this.mesh = new THREE.Group();

    // Chest body -- brown box with gold trim.
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.1, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x8b5a2b })
    );
    body.position.y = 0.55;
    body.castShadow = true;
    this.mesh.add(body);

    // The lid -- this is the bit that flips open.
    this.lid = new THREE.Group();
    const lidBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.45, 1.25),
      new THREE.MeshLambertMaterial({ color: 0xa9702f })
    );
    lidBox.position.set(0, 0.22, 0.0);
    this.lid.add(lidBox);

    const goldBand = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.16, 1.3),
      new THREE.MeshLambertMaterial({ color: 0xffc02e })
    );
    goldBand.position.set(0, 0.22, 0);
    this.lid.add(goldBand);

    // Put the lid's hinge at the BACK edge so it flips open properly.
    this.lid.position.set(0, 1.1, -0.6);
    this.mesh.add(this.lid);

    // Gold glow so you can spot chests from a distance.
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 3.5, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffc02e, transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    glow.position.y = 1.9;
    this.mesh.add(glow);
    this.glow = glow;

    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  /** Pops the lid and spits out 2 good weapons. */
  open(scene, pickups, effects) {
    if (this.opened) return [];
    this.opened = true;
    this.glow.visible = false;

    const dropped = [];
    for (let i = 0; i < 2; i++) {
      // luck 1.0 = chests are MUCH more likely to give epic/legendary.
      // (We tried 1.4 and nearly 60% of chest loot was epic or better,
      // which made legendaries feel ordinary. Turn it up if you want
      // silly overpowered matches -- it's your game!)
      const weapon = rollWeapon(1.0);
      const angle = Math.random() * Math.PI * 2;
      const pickup = new Pickup(
        scene, weapon,
        this.position.x + Math.cos(angle) * 2.2,
        this.position.z + Math.sin(angle) * 2.2
      );
      pickups.push(pickup);
      dropped.push(pickup);
    }

    effects.spark(new THREE.Vector3(this.position.x, this.position.y + 1.4, this.position.z), 0xffc02e);
    return dropped;
  }

  update(dt) {
    // Animate the lid swinging open.
    if (this.opened && this.lid.rotation.x > -1.9) {
      this.lid.rotation.x -= dt * 5;
    }
  }
}

// ------------------------------------------------------------
//   ★ MED KITS ★
//   A white box with a red cross. Stand still for 5 seconds and
//   you're back to full health.
// ------------------------------------------------------------
export class MedKit {
  constructor(scene, x, z) {
    this.isMedKit = true;
    this.taken = false;
    this.position = new THREE.Vector3(x, getGroundHeight(x, z) + 0.6, z);

    this.mesh = new THREE.Group();

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.8, 0.8),
      new THREE.MeshLambertMaterial({ color: 0xf8f8f8 })
    );
    box.castShadow = true;
    this.mesh.add(box);

    // The red cross on the lid -- two overlapping bars.
    const redMat = new THREE.MeshLambertMaterial({ color: 0xe23b3b });
    const barA = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.12), redMat);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.12), redMat);
    for (const bar of [barA, barB]) {
      bar.position.z = 0.42;
      this.mesh.add(bar);
    }

    // Soft green glow so you can spot it.
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 3.4, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x6bf06b, transparent: true, opacity: 0.24,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    glow.position.y = 1.6;
    this.mesh.add(glow);

    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  update(dt, time) {
    if (this.taken) return;
    this.mesh.rotation.y += dt * 1.2;
    this.mesh.position.y = this.position.y + Math.sin(time * 2.2) * 0.12;
  }

  remove(scene) {
    this.taken = true;
    scene.remove(this.mesh);
  }
}

/** Scatters chests and floor loot around the map at the start of a match. */
export function spawnLoot(scene, colliders) {
  const pickups = [];
  const chests = [];
  const medkits = [];

  // --- MED KITS --- scattered around town and the outskirts.
  for (let i = 0; i < CONFIG.MEDKIT_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 10 + Math.sqrt(Math.random()) * CONFIG.BOT_ROAM_RADIUS;
    medkits.push(new MedKit(scene, Math.cos(angle) * distance, Math.sin(angle) * distance));
  }

  // --- CHESTS --- placed around town, where the buildings are.
  for (let i = 0; i < CONFIG.CHEST_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 12 + Math.sqrt(Math.random()) * (CONFIG.FLAT_TOWN_RADIUS - 5);
    chests.push(new Chest(scene, Math.cos(angle) * distance, Math.sin(angle) * distance));
  }

  // --- FLOOR LOOT --- weaker stuff scattered everywhere.
  for (let i = 0; i < CONFIG.FLOOR_LOOT_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 8 + Math.sqrt(Math.random()) * CONFIG.BOT_ROAM_RADIUS;
    // luck 0 = mostly common and uncommon
    pickups.push(new Pickup(scene, rollWeapon(0), Math.cos(angle) * distance, Math.sin(angle) * distance));
  }

  return { pickups, chests, medkits };
}
