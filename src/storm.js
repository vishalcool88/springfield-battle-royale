// ============================================================
//   ★ THE PINK STORM ★
//   A giant glowing wall that closes in on a random spot.
//   Stay inside the circle. Outside, it eats your health --
//   and it gets meaner every time it shrinks.
//
//   This is the thing that ENDS the match. Without it, the last
//   few players could hide in opposite corners forever.
// ============================================================

import * as THREE from "three";
import { CONFIG } from "./config.js";

export class Storm {
  constructor(scene) {
    // The safe circle starts centred on the middle of the map.
    this.center = new THREE.Vector3(0, 0, 0);
    this.radius = CONFIG.STORM_START_RADIUS;

    // Where it's shrinking TO. Set when a shrink begins.
    this.targetCenter = this.center.clone();
    this.targetRadius = this.radius;

    this.phase = 0; // which shrink we're on
    this.state = "WAITING"; // WAITING (calm) or SHRINKING
    this.timer = CONFIG.STORM_START_DELAY;
    this.finished = false;

    // --- THE VISUAL WALL ---
    // A big open-ended cylinder. We view it from the INSIDE, so we
    // render the back faces -- that's what BackSide means.
    this.wall = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 90, 64, 1, true),
      new THREE.MeshBasicMaterial({
        color: CONFIG.STORM_COLOR,
        transparent: true,
        opacity: 0.34,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    this.wall.position.y = 40;
    scene.add(this.wall);

    // A second, fainter wall just outside it, for a glowy double edge.
    this.glow = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 90, 64, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.14,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    this.glow.position.y = 40;
    scene.add(this.glow);

    this.updateVisual();
  }

  /** How much damage the storm does right now (worse each phase). */
  get damagePerSecond() {
    return CONFIG.STORM_DAMAGE_PER_SECOND * Math.pow(CONFIG.STORM_DAMAGE_RAMP, this.phase * 0.5);
  }

  /** Is this spot safe, or is it out in the storm? */
  isSafe(position) {
    const dx = position.x - this.center.x;
    const dz = position.z - this.center.z;
    return Math.hypot(dx, dz) <= this.radius;
  }

  /** Picks the next, smaller circle -- somewhere inside the current one. */
  startNextShrink() {
    this.phase++;
    // Each circle is about 62% the size of the last.
    this.targetRadius = Math.max(8, this.radius * 0.62);

    // The new centre must sit INSIDE the old circle, or players in the
    // safe zone would suddenly find themselves outside it through no
    // fault of their own.
    const wiggle = Math.max(0, this.radius - this.targetRadius);
    const angle = Math.random() * Math.PI * 2;
    const drift = Math.random() * wiggle * 0.65;
    this.targetCenter = new THREE.Vector3(
      this.center.x + Math.cos(angle) * drift,
      0,
      this.center.z + Math.sin(angle) * drift
    );

    this.shrinkFrom = { center: this.center.clone(), radius: this.radius };
    this.shrinkProgress = 0;
    this.state = "SHRINKING";
    this.timer = CONFIG.STORM_SHRINK_TIME;
  }

  update(dt, fighters, game) {
    if (!this.finished) {
      this.timer -= dt;

      if (this.state === "WAITING" && this.timer <= 0) {
        if (this.phase >= CONFIG.STORM_PHASES) {
          this.finished = true; // storm is done shrinking, circle stays put
        } else {
          this.startNextShrink();
        }
      } else if (this.state === "SHRINKING") {
        // Slide smoothly from the old circle to the new one.
        this.shrinkProgress += dt / CONFIG.STORM_SHRINK_TIME;
        const t = Math.min(1, this.shrinkProgress);

        this.radius = this.shrinkFrom.radius + (this.targetRadius - this.shrinkFrom.radius) * t;
        this.center.lerpVectors(this.shrinkFrom.center, this.targetCenter, t);

        if (t >= 1) {
          this.state = "WAITING";
          this.timer = CONFIG.STORM_REST_TIME;
        }
      }
    }

    // --- HURT EVERYONE OUTSIDE THE CIRCLE ---
    const damage = this.damagePerSecond * dt;
    for (const fighter of fighters) {
      if (!fighter.alive) continue;
      if (!this.isSafe(fighter.position)) {
        fighter.takeDamage(damage, null, game);
      }
    }

    this.updateVisual();
  }

  updateVisual() {
    this.wall.position.x = this.center.x;
    this.wall.position.z = this.center.z;
    this.wall.scale.set(this.radius, 1, this.radius);

    this.glow.position.x = this.center.x;
    this.glow.position.z = this.center.z;
    this.glow.scale.set(this.radius * 1.035, 1, this.radius * 1.035);
  }

  /** Text for the HUD, like "Storm closing in 12s". */
  get statusText() {
    if (this.finished) return "FINAL CIRCLE";
    if (this.state === "SHRINKING") return `STORM CLOSING · ${Math.ceil(this.timer)}s`;
    return `NEXT STORM · ${Math.ceil(this.timer)}s`;
  }
}

/**
 * Bots need to know to run from the storm. Given a bot's position,
 * this returns a spot to run to if it's in danger, or null if safe.
 */
export function safeSpotFor(position, storm) {
  const dx = position.x - storm.center.x;
  const dz = position.z - storm.center.z;
  const distance = Math.hypot(dx, dz);

  // Head in well before the edge -- bots that cut it fine always die.
  const comfortable = storm.radius * 0.72;
  if (distance <= comfortable) return null;

  // Run straight toward the middle of the safe circle.
  const angle = Math.atan2(dz, dx);
  return new THREE.Vector3(
    storm.center.x + Math.cos(angle) * comfortable * 0.6,
    0,
    storm.center.z + Math.sin(angle) * comfortable * 0.6
  );
}
