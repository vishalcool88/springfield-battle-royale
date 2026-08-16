// ============================================================
//   TERRAIN
//   The shape of the ground. Springfield itself is FLAT (so the
//   streets and houses sit properly), and then hills roll up
//   around the outside of town.
// ============================================================

import * as THREE from "three";
import { CONFIG } from "./config.js";

/**
 * The most important function in this file.
 * Give it any spot on the map, it tells you how HIGH the ground
 * is there. Buzz, every bot, and every tree uses this to know
 * where to put their feet.
 */
export function getGroundHeight(x, z) {
  const distanceFromTown = Math.hypot(x, z);

  // Inside this circle it's perfectly flat -- that's the town.
  if (distanceFromTown < CONFIG.FLAT_TOWN_RADIUS) return 0;

  // Between "flat" and "full hills" we blend, so there's no
  // sudden cliff at the edge of town. This is called a smoothstep.
  const blend = smoothstep(
    CONFIG.FLAT_TOWN_RADIUS,
    CONFIG.FULL_HILLS_RADIUS,
    distanceFromTown
  );

  // Adding wavy sine curves together is the classic cheap way to
  // make natural-looking hills. Change these numbers to reshape
  // the whole landscape!
  const hills =
    Math.sin(x * 0.045) * Math.cos(z * 0.04) * 5.0 +
    Math.sin(x * 0.019 + 1.3) * 4.0 +
    Math.cos(z * 0.027 + 0.6) * 3.5;

  return hills * blend;
}

/** Eases smoothly from 0 to 1 between edge0 and edge1. */
function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Builds the actual green ground mesh you see and walk on. */
export function buildGround(scene) {
  // A big flat sheet chopped into a grid of little squares.
  // More squares = smoother hills, but slower. 120 is a good balance.
  const geometry = new THREE.PlaneGeometry(
    CONFIG.MAP_SIZE,
    CONFIG.MAP_SIZE,
    120,
    120
  );
  geometry.rotateX(-Math.PI / 2); // lay it flat like a floor

  // Now lift every corner of every square to its hill height.
  const points = geometry.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i);
    const z = points.getZ(i);
    points.setY(i, getGroundHeight(x, z));
  }
  geometry.computeVertexNormals(); // recalculate the lighting

  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      color: CONFIG.GRASS_COLOR,
      flatShading: true, // gives it that faceted, low-poly cartoon look
    })
  );
  ground.receiveShadow = true;
  scene.add(ground);

  return ground;
}
