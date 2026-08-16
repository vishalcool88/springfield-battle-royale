// ============================================================
//   COMBAT
//   Bullets, hit detection, and who can see who.
//
//   Our bullets are "hitscan" -- the instant you click, we shoot
//   an invisible laser line and see what it touches first. That's
//   how most real shooters do it, because actual flying bullets
//   are slow to calculate 50 times a second.
// ============================================================

import * as THREE from "three";
import { CONFIG } from "./config.js";

// ------------------------------------------------------------
//   HITBOXES
//   The invisible boxes that count as "you". Two of them:
//   a big body box and a smaller head box worth double damage.
// ------------------------------------------------------------
export function getHitboxes(fighter) {
  const { x, y, z } = fighter.position;

  // Crouching squashes you down, so there's genuinely less of you to
  // hit -- especially your head. That's the real reward for crouching.
  const squash = fighter.crouching ? CONFIG.CROUCH_HEIGHT : 1;
  const bodyTop = y + 1.72 * squash;
  const headTop = y + 2.45 * squash;

  return [
    // BODY
    { minX: x - 0.45, maxX: x + 0.45, minY: y, maxY: bodyTop, minZ: z - 0.35, maxZ: z + 0.35, isHead: false },
    // HEAD
    { minX: x - 0.42, maxX: x + 0.42, minY: bodyTop, maxY: headTop, minZ: z - 0.42, maxZ: z + 0.42, isHead: true },
  ];
}

/**
 * Does this laser line hit this box, and if so, how far away?
 * This is the "slab method" -- we check the ray against each pair
 * of parallel walls of the box and see if the ranges overlap.
 */
function rayHitsBox(origin, direction, box) {
  let tMin = 0;
  let tMax = Infinity;

  for (const axis of ["x", "y", "z"]) {
    const min = box["min" + axis.toUpperCase()];
    const max = box["max" + axis.toUpperCase()];
    const start = origin[axis];
    const dir = direction[axis];

    if (Math.abs(dir) < 1e-8) {
      // Ray is parallel to these walls -- miss unless we start between them.
      if (start < min || start > max) return null;
      continue;
    }

    let t1 = (min - start) / dir;
    let t2 = (max - start) / dir;
    if (t1 > t2) [t1, t2] = [t2, t1];

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null; // the ranges don't overlap -- missed
  }

  return tMin;
}

/**
 * Fire a shot. Returns what it hit, or null if it hit nothing.
 * Walls block bullets, so you can hide behind the donut shop.
 */
export function castShot(origin, direction, range, fighters, colliders, shooter) {
  let closest = null;

  // --- Check every living person (except the shooter) ---
  for (const fighter of fighters) {
    if (fighter === shooter || !fighter.alive) continue;

    for (const box of getHitboxes(fighter)) {
      const distance = rayHitsBox(origin, direction, box);
      if (distance !== null && distance <= range) {
        if (!closest || distance < closest.distance) {
          closest = { fighter, distance, isHead: box.isHead };
        }
      }
    }
  }

  // --- Check walls. If a wall is closer, the bullet stops there. ---
  let wallDistance = Infinity;
  for (const box of colliders) {
    const distance = rayHitsBox(origin, direction, box);
    if (distance !== null && distance < wallDistance) wallDistance = distance;
  }

  const hitPoint = new THREE.Vector3();

  if (closest && closest.distance < wallDistance) {
    hitPoint.copy(direction).multiplyScalar(closest.distance).add(origin);
    return {
      fighter: closest.fighter,
      isHead: closest.isHead,
      point: hitPoint,
      distance: closest.distance,
      hitWall: false,
    };
  }

  // Hit a wall (or nothing at all -- then it's just max range).
  const stopAt = Math.min(wallDistance, range);
  hitPoint.copy(direction).multiplyScalar(stopAt).add(origin);
  return { fighter: null, isHead: false, point: hitPoint, distance: stopAt, hitWall: wallDistance < range };
}

/**
 * Can this spot see that spot, or is there a wall in between?
 * Bots use this constantly -- it's what stops them shooting
 * through buildings like cheaters.
 */
export function hasLineOfSight(from, to, colliders) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const distance = direction.length();
  if (distance < 0.001) return true;
  direction.divideScalar(distance); // make it length 1

  for (const box of colliders) {
    const hit = rayHitsBox(from, direction, box);
    if (hit !== null && hit < distance) return false; // a wall is in the way
  }
  return true;
}

/**
 * How far can we go in this direction before hitting a wall?
 * The camera uses this to avoid burying itself inside buildings.
 */
export function distanceToWall(origin, direction, maxDistance, colliders) {
  let nearest = maxDistance;
  for (const box of colliders) {
    const hit = rayHitsBox(origin, direction, box);
    if (hit !== null && hit < nearest) nearest = hit;
  }
  return nearest;
}

/** Is this exact point inside any solid box? */
export function pointInsideAnyBox(point, colliders) {
  for (const b of colliders) {
    if (
      point.x > b.minX && point.x < b.maxX &&
      point.y > b.minY && point.y < b.maxY &&
      point.z > b.minZ && point.z < b.maxZ
    ) return true;
  }
  return false;
}

/** Nudges an aim direction off-target by a random wobble. */
export function applySpread(direction, spread) {
  direction.x += (Math.random() - 0.5) * spread * 2;
  direction.y += (Math.random() - 0.5) * spread * 2;
  direction.z += (Math.random() - 0.5) * spread * 2;
  return direction.normalize();
}

// ------------------------------------------------------------
//   BULLET TRAILS AND SPARKS -- the stuff you actually SEE
// ------------------------------------------------------------
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  /** A glowing streak from the gun to wherever the bullet landed. */
  tracer(from, to, color = 0xfff3a0) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    this.scene.add(line);
    this.active.push({ object: line, life: 0.07, maxLife: 0.07 });
  }

  /** A little burst where the bullet hit. */
  spark(position, color = 0xffcc33) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 6, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true })
    );
    spark.position.copy(position);
    this.scene.add(spark);
    this.active.push({ object: spark, life: 0.18, maxLife: 0.18, grow: true });
  }

  /** The cartoon "poof" when somebody is eliminated. */
  poof(position, color = 0xffffff) {
    for (let i = 0; i < 12; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.4 + Math.random() * 0.4, 6, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true })
      );
      puff.position.set(
        position.x + (Math.random() - 0.5) * 1.4,
        position.y + 1 + Math.random() * 1.4,
        position.z + (Math.random() - 0.5) * 1.4
      );
      const drift = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        1.5 + Math.random() * 2,
        (Math.random() - 0.5) * 3
      );
      this.scene.add(puff);
      this.active.push({ object: puff, life: 0.65, maxLife: 0.65, drift });
    }
  }

  /** Fades everything out and cleans it up. Called every frame. */
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const effect = this.active[i];
      effect.life -= dt;

      if (effect.life <= 0) {
        this.scene.remove(effect.object);
        effect.object.geometry?.dispose();
        effect.object.material?.dispose();
        this.active.splice(i, 1);
        continue;
      }

      const fade = effect.life / effect.maxLife;
      effect.object.material.opacity = fade;
      if (effect.grow) effect.object.scale.setScalar(1 + (1 - fade) * 2);
      if (effect.drift) {
        effect.object.position.addScaledVector(effect.drift, dt);
        effect.drift.y -= 4 * dt;
      }
    }
  }
}
