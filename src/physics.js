// ============================================================
//   PHYSICS
//   Bumping into walls, falling, and standing on roofs.
//   Buzz AND all 49 bots share this exact code, so everybody
//   plays by the same rules. (That's important -- bots that
//   ignore walls feel like cheaters.)
// ============================================================

import { CONFIG } from "./config.js";
import { getGroundHeight } from "./terrain.js";

export const BODY_RADIUS = 0.45; // how "wide" a person is
export const BODY_HEIGHT = 1.85; // how tall, for bumping into things

/**
 * Slide along one axis, then push back out of anything we ended
 * up inside. Doing X and Z separately is the trick that lets you
 * SLIDE along a wall instead of sticking to it.
 */
export function moveAxis(position, axis, amount, colliders) {
  if (amount === 0) return;
  position[axis] += amount;

  for (const box of colliders) {
    if (!overlapsBox(position, box)) continue;

    if (axis === "x") {
      position.x = amount > 0 ? box.minX - BODY_RADIUS : box.maxX + BODY_RADIUS;
    } else {
      position.z = amount > 0 ? box.minZ - BODY_RADIUS : box.maxZ + BODY_RADIUS;
    }
  }

  // Nobody walks off the edge of the map.
  const edge = CONFIG.MAP_SIZE / 2 - 4;
  position.x = Math.max(-edge, Math.min(edge, position.x));
  position.z = Math.max(-edge, Math.min(edge, position.z));
}

/** Is this person standing inside that solid box? */
function overlapsBox(position, box) {
  return (
    position.x > box.minX - BODY_RADIUS &&
    position.x < box.maxX + BODY_RADIUS &&
    position.z > box.minZ - BODY_RADIUS &&
    position.z < box.maxZ + BODY_RADIUS &&
    position.y < box.maxY - 0.05 &&
    position.y + BODY_HEIGHT > box.minY
  );
}

/**
 * Falling, jumping, landing on the ground, and landing on roofs.
 * Returns the new velocityY and whether we're standing on something.
 */
export function applyGravity(position, velocityY, dt, colliders) {
  velocityY -= CONFIG.GRAVITY * dt;
  position.y += velocityY * dt;

  let onGround = false;

  // Land on the hills / grass.
  const groundY = getGroundHeight(position.x, position.z);
  if (position.y <= groundY) {
    position.y = groundY;
    velocityY = 0;
    onGround = true;
  }

  // Land on rooftops. We only snap when falling and already close
  // to the top, so you can still jump UP through nothing weirdly.
  if (velocityY <= 0) {
    for (const box of colliders) {
      const overX = position.x > box.minX - BODY_RADIUS && position.x < box.maxX + BODY_RADIUS;
      const overZ = position.z > box.minZ - BODY_RADIUS && position.z < box.maxZ + BODY_RADIUS;
      const nearTop = position.y <= box.maxY && position.y > box.maxY - 0.7;
      if (overX && overZ && nearTop) {
        position.y = box.maxY;
        velocityY = 0;
        onGround = true;
      }
    }
  }

  return { velocityY, onGround };
}
