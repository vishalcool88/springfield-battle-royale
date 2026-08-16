// ============================================================
//   THE WORLD -- the town of Springfield
//   Streets, houses, shops, trees, fences, and the big
//   donut shop with the giant donut on the roof.
// ============================================================

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { buildGround, getGroundHeight } from "./terrain.js";
import { outline } from "./toon.js";

export function buildWorld(scene) {
  // Every solid thing you can't walk through goes in here.
  const colliders = [];
  // Places where loot and players can spawn (open ground, not inside walls).
  const openSpots = [];

  buildSky(scene);
  buildGround(scene);
  buildRoads(scene);

  // --- THE DONUT SHOP --- (Aansh's landmark, right in the middle of town)
  buildDonutShop(scene, colliders, 0, -46);

  // --- THE REST OF TOWN ---
  // Walk across a grid of city blocks and drop a building in each one.
  const step = CONFIG.BLOCK_SIZE;
  const reach = 2; // blocks in each direction from the center
  let shapeIndex = 0;

  for (let bx = -reach; bx <= reach; bx++) {
    for (let bz = -reach; bz <= reach; bz++) {
      const x = bx * step;
      const z = bz * step;

      // Leave the very middle empty -- that's where you spawn.
      if (bx === 0 && bz === 0) {
        openSpots.push({ x, z });
        continue;
      }
      // The donut shop already owns this block.
      if (bx === 0 && bz === -1) continue;

      // Alternate between building types so town looks varied.
      // Each house gets its own wall and roof colour from these lists.
      const wallColors = [0xe8503a, 0x4a90d9, 0x7ec850, 0xf0b23c, 0xd07ab8, 0x63c9c0];
      const roofColors = [0x7b4a32, 0x4a3f5e, 0x8d3b3b, 0x3f5a4a];

      const type = shapeIndex % 4;
      const wall = wallColors[shapeIndex % wallColors.length];
      const roof = roofColors[shapeIndex % roofColors.length];
      shapeIndex++;

      if (type === 0 || type === 1) buildHouse(scene, colliders, x, z, wall, roof);
      else if (type === 2) buildShop(scene, colliders, x, z);
      else buildEnterableBuilding(scene, colliders, x, z);

      openSpots.push({ x: x + 14, z: z + 14 });
    }
  }

  buildTrees(scene, colliders);
  buildFences(scene, colliders);

  return { colliders, openSpots };
}

// ------------------------------------------------------------
//   SKY AND SUN
// ------------------------------------------------------------
function buildSky(scene) {
  scene.background = new THREE.Color(CONFIG.SKY_COLOR);
  // Fog makes far-away things fade into the sky -- looks great AND
  // means the computer doesn't have to draw distant stuff in detail.
  scene.fog = new THREE.Fog(CONFIG.SKY_COLOR, 110, 280);

  // Soft light from everywhere, so shadows aren't pitch black.
  scene.add(new THREE.AmbientLight(0xffffff, 1.15));

  // The sun -- this is what makes the shadows.
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(70, 120, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const reach = 150;
  sun.shadow.camera.left = -reach;
  sun.shadow.camera.right = reach;
  sun.shadow.camera.top = reach;
  sun.shadow.camera.bottom = -reach;
  sun.shadow.camera.far = 400;
  scene.add(sun);
}

// ------------------------------------------------------------
//   ROADS -- a grid of streets, like a real town
// ------------------------------------------------------------
function buildRoads(scene) {
  const roadMat = new THREE.MeshLambertMaterial({ color: CONFIG.ROAD_COLOR });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5d547 });
  const length = CONFIG.FLAT_TOWN_RADIUS * 2;

  for (let i = -2; i <= 2; i++) {
    const offset = i * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2;

    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(
          horizontal ? length : CONFIG.ROAD_WIDTH,
          horizontal ? CONFIG.ROAD_WIDTH : length
        ),
        roadMat
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(horizontal ? 0 : offset, 0.02, horizontal ? offset : 0);
      road.receiveShadow = true;
      scene.add(road);

      // Dashed yellow line down the middle.
      for (let d = -length / 2; d < length / 2; d += 8) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(horizontal ? 4 : 0.4, horizontal ? 0.4 : 4),
          lineMat
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(
          horizontal ? d + 2 : offset,
          0.03,
          horizontal ? offset : d + 2
        );
        scene.add(dash);
      }
    }
  }
}

// ------------------------------------------------------------
//   BUILDING PIECES
// ------------------------------------------------------------

/**
 * The workhorse function: makes a solid box you can't walk through.
 * `y` is the height of the BOTTOM of the box.
 */
function addBox(scene, colliders, { x, y, z, w, h, d, color, solid = true, outlined = true }) {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  box.position.set(x, y + h / 2, z);
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);

  // Big structural pieces get the bold cartoon edge. Small details
  // (window bars, door handles) must NOT -- the outline shell is scaled
  // up by a percentage, so on a 10cm part it balloons out and smothers
  // the very detail it's meant to define.
  if (outlined) outline(box, 0.09);

  if (solid) {
    colliders.push({
      minX: x - w / 2, maxX: x + w / 2,
      minY: y,         maxY: y + h,
      minZ: z - d / 2, maxZ: z + d / 2,
    });
  }
  return box;
}

/**
 * A proper little house: walls, pitched roof, chimney, framed windows,
 * a front door with a step and a porch light, and a garage.
 * All still simple boxes -- there are just more of them, arranged
 * the way a real house is arranged.
 */
function buildHouse(scene, colliders, x, z, wallColor, roofColor = 0x7b4a32) {
  const w = 13, d = 11, h = 6;
  const front = z + d / 2;

  addBox(scene, colliders, { x, y: 0, z, w, h, d, color: wallColor });

  // --- ROOF --- a 4-sided cone is a pyramid. Overhangs the walls a bit,
  // which is what stops it looking like a box with a hat balanced on it.
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(w, d) * 0.82, 4.6, 4),
    new THREE.MeshLambertMaterial({ color: roofColor, flatShading: true })
  );
  roof.position.set(x, h + 2.3, z);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  scene.add(roof);
  outline(roof, 0.09);

  // Trim board where the roof meets the walls.
  addBox(scene, colliders, { x, y: h - 0.25, z, w: w + 0.5, h: 0.35, d: d + 0.5, color: 0xf3efe6, solid: false });

  // --- CHIMNEY ---
  addBox(scene, colliders, { x: x + w * 0.28, y: h + 1.4, z: z - d * 0.2, w: 1.1, h: 3.2, d: 1.1, color: 0x8d5c4a, solid: false });
  addBox(scene, colliders, { x: x + w * 0.28, y: h + 4.5, z: z - d * 0.2, w: 1.35, h: 0.3, d: 1.35, color: 0x5f4038, solid: false });

  // --- FRONT DOOR --- with a frame, a handle and a step.
  addBox(scene, colliders, { x, y: 0, z: front + 0.04, w: 2.3, h: 3.7, d: 0.16, color: 0xf3efe6, solid: false });
  addBox(scene, colliders, { x, y: 0, z: front + 0.12, w: 1.9, h: 3.4, d: 0.16, color: 0x5a3a22, solid: false });
  addBox(scene, colliders, { x: x + 0.65, y: 1.75, z: front + 0.22, w: 0.18, h: 0.18, d: 0.14, color: 0xffd90f, solid: false, outlined: false });
  addBox(scene, colliders, { x, y: 0, z: front + 0.5, w: 3, h: 0.25, d: 1.1, color: 0xcfcabd, solid: false });
  // Porch light above the door.
  addBox(scene, colliders, { x, y: 3.9, z: front + 0.2, w: 0.34, h: 0.42, d: 0.34, color: 0xfff2b0, solid: false, outlined: false });

  // --- WINDOWS ---
  // Built as flat layers stacked OUTWARD from the wall: frame, then
  // glass, then the cross bars on top. The first version centred all
  // three at the same spot, so the deep frame box completely swallowed
  // the glass and every window looked like a plain grey slab.
  //
  // (nx, nz) is the direction the wall faces -- its "outward normal".
  const window = (wx, wy, wz, nx, nz) => {
    const sideways = nx !== 0;
    const THIN = 0.06; // every layer is a flat plate this thick

    // Stacks one flat plate at `out` metres away from the wall.
    // `across` is its width along the wall, `tall` its height.
    const plate = (out, across, tall, color, dropY = 0) => {
      addBox(scene, colliders, {
        x: wx + nx * out,
        y: wy + dropY,
        z: wz + nz * out,
        w: sideways ? THIN : across,
        h: tall,
        d: sideways ? across : THIN,
        color, solid: false, outlined: false,
      });
    };

    plate(0.05, 2.86, 2.12, 0xf3efe6, -0.16); // frame, flat on the wall
    plate(0.13, 2.44, 1.72, 0x7cc4ee);        // glass, proud of the frame
    plate(0.21, 2.48, 0.11, 0xf3efe6, 0.8);   // horizontal bar
    plate(0.21, 0.11, 1.72, 0xf3efe6);        // vertical bar
  };

  window(x - 4.1, 3.3, front, 0, 1); // front wall, left
  window(x + 4.1, 3.3, front, 0, 1); // front wall, right
  window(x + w / 2, 3.3, z + 2.4, 1, 0); // right side
  window(x - w / 2, 3.3, z - 2.4, -1, 0); // left side (behind the garage)
  window(x - 4.1, 3.3, z - d / 2, 0, -1); // back wall
  window(x + 4.1, 3.3, z - d / 2, 0, -1);

  // --- GARAGE --- tucked onto the side of the house.
  const gx = x - w / 2 - 3.2;
  addBox(scene, colliders, { x: gx, y: 0, z: z + 1.5, w: 6.4, h: 4.2, d: 7, color: wallColor });
  addBox(scene, colliders, { x: gx, y: 4.2, z: z + 1.5, w: 7, h: 0.4, d: 7.5, color: roofColor, solid: false });
  addBox(scene, colliders, { x: gx, y: 0.1, z: z + 5.05, w: 5, h: 3.4, d: 0.16, color: 0xdcd7cc, solid: false });
  // The horizontal lines on the garage door.
  for (let i = 0; i < 4; i++) {
    addBox(scene, colliders, { x: gx, y: 0.55 + i * 0.8, z: z + 5.14, w: 5, h: 0.09, d: 0.1, color: 0xb3aea4, solid: false, outlined: false });
  }
}

/** A wider, flat-roofed shop. */
function buildShop(scene, colliders, x, z) {
  addBox(scene, colliders, { x, y: 0, z, w: 16, h: 8, d: 12, color: 0xefc94c });
  // Awning stripe over the front.
  addBox(scene, colliders, { x, y: 5, z: z + 6.3, w: 16, h: 1.2, d: 1.2, color: 0xd94f4f, solid: false });
  addBox(scene, colliders, { x, y: 0, z: z + 6.05, w: 2.4, h: 3.6, d: 0.2, color: 0x3a2a1a, solid: false });
}

/**
 * A building you can actually walk INSIDE.
 * Built from 4 separate walls with a gap left for the doorway.
 */
function buildEnterableBuilding(scene, colliders, x, z) {
  const w = 16, d = 14, h = 7, t = 0.6; // t = wall thickness
  const color = 0xd8d3c8;

  // Back wall and two side walls (solid).
  addBox(scene, colliders, { x, y: 0, z: z - d / 2, w, h, d: t, color });
  addBox(scene, colliders, { x: x - w / 2, y: 0, z, w: t, h, d, color });
  addBox(scene, colliders, { x: x + w / 2, y: 0, z, w: t, h, d, color });

  // Front wall, split in two so there's a doorway in the middle.
  const doorWidth = 4;
  const sideWidth = (w - doorWidth) / 2;
  for (const side of [-1, 1]) {
    addBox(scene, colliders, {
      x: x + side * (doorWidth / 2 + sideWidth / 2),
      y: 0, z: z + d / 2, w: sideWidth, h, d: t, color,
    });
  }
  // Bit of wall above the door.
  addBox(scene, colliders, { x, y: 4.5, z: z + d / 2, w: doorWidth, h: h - 4.5, d: t, color });

  // Flat roof you can stand on.
  addBox(scene, colliders, { x, y: h, z, w: w + 0.6, h: 0.5, d: d + 0.6, color: 0x9a9086 });
}

/**
 * ★ THE DONUT SHOP ★
 * Aansh's landmark. Giant pink donut on the roof, visible from
 * anywhere on the map. You can walk inside it.
 */
function buildDonutShop(scene, colliders, x, z) {
  const w = 20, d = 16, h = 8, t = 0.6;
  const wallColor = 0xfff3d6;

  addBox(scene, colliders, { x, y: 0, z: z - d / 2, w, h, d: t, color: wallColor });
  addBox(scene, colliders, { x: x - w / 2, y: 0, z, w: t, h, d, color: wallColor });
  addBox(scene, colliders, { x: x + w / 2, y: 0, z, w: t, h, d, color: wallColor });

  const doorWidth = 5;
  const sideWidth = (w - doorWidth) / 2;
  for (const side of [-1, 1]) {
    addBox(scene, colliders, {
      x: x + side * (doorWidth / 2 + sideWidth / 2),
      y: 0, z: z + d / 2, w: sideWidth, h, d: t, color: wallColor,
    });
  }
  addBox(scene, colliders, { x, y: 5, z: z + d / 2, w: doorWidth, h: h - 5, d: t, color: wallColor });
  addBox(scene, colliders, { x, y: h, z, w: w + 0.8, h: 0.5, d: d + 0.8, color: 0xe86a92 });

  // --- THE GIANT DONUT ---
  // A torus is the 3D shape for a donut. Standing upright like a sign.
  const donut = new THREE.Mesh(
    new THREE.TorusGeometry(4.2, 1.9, 16, 32),
    new THREE.MeshLambertMaterial({ color: 0xffb3d1 })
  );
  donut.position.set(x, h + 6.2, z);
  donut.castShadow = true;
  scene.add(donut);
  outline(donut, 0.1);

  // Sprinkles! Little colored sticks stuck around the donut.
  const sprinkleColors = [0xffffff, 0x6be36b, 0x5aa9ff, 0xffe14d, 0xff5f5f];
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2;
    const sprinkle = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.22, 0.22),
      new THREE.MeshLambertMaterial({ color: sprinkleColors[i % 5] })
    );
    // Sit each sprinkle on the outer edge of the donut ring.
    sprinkle.position.set(
      x + Math.cos(angle) * 4.2,
      h + 6.2 + Math.sin(angle) * 4.2,
      z + (i % 2 === 0 ? 1.55 : -1.55)
    );
    sprinkle.rotation.z = angle;
    scene.add(sprinkle);
  }

  // A pole holding a small sign out front.
  addBox(scene, colliders, { x: x + 12, y: 0, z: z + 9, w: 0.5, h: 7, d: 0.5, color: 0x6b6b6b, solid: false });
  addBox(scene, colliders, { x: x + 12, y: 7, z: z + 9, w: 6, h: 2.4, d: 0.3, color: 0xff7ab0, solid: false });
}

/** Trees scattered on the hills outside town. */
function buildTrees(scene, colliders) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f3f, flatShading: true });

  for (let i = 0; i < 90; i++) {
    // Ring them around the outside of town.
    const angle = Math.random() * Math.PI * 2;
    const distance = CONFIG.FLAT_TOWN_RADIUS + 6 + Math.random() * 55;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const groundY = getGroundHeight(x, z);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 4, 6), trunkMat);
    trunk.position.set(x, groundY + 2, z);
    trunk.castShadow = true;
    scene.add(trunk);

    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.8, 6, 7), leafMat);
    leaves.position.set(x, groundY + 6.5, z);
    leaves.castShadow = true;
    scene.add(leaves);
    outline(trunk, 0.07);
    outline(leaves, 0.09);

    // Only the trunk blocks you -- you can walk under the branches.
    colliders.push({
      minX: x - 0.7, maxX: x + 0.7,
      minY: groundY, maxY: groundY + 4,
      minZ: z - 0.7, maxZ: z + 0.7,
    });
  }
}

/** Low fences along a couple of streets, for cover in fights. */
function buildFences(scene, colliders) {
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0xf2efe6 });

  for (const [startX, startZ, horizontal] of [
    [-70, 22, true],
    [22, -70, false],
    [-70, -62, true],
  ]) {
    for (let i = 0; i < 16; i++) {
      const x = horizontal ? startX + i * 5 : startX;
      const z = horizontal ? startZ : startZ + i * 5;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 4.4 : 0.3, 1.5, horizontal ? 0.3 : 4.4),
        fenceMat
      );
      post.position.set(x, 0.75, z);
      post.castShadow = true;
      scene.add(post);
      colliders.push({
        minX: x - (horizontal ? 2.2 : 0.2), maxX: x + (horizontal ? 2.2 : 0.2),
        minY: 0, maxY: 1.5,
        minZ: z - (horizontal ? 0.2 : 2.2), maxZ: z + (horizontal ? 0.2 : 2.2),
      });
    }
  }
}
