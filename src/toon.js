// ============================================================
//   CARTOON OUTLINES
//   This is what gives everything that bold, drawn-with-a-marker
//   look instead of plain 3D shapes.
//
//   The trick ("inverted hull"): we make a SECOND copy of every
//   shape, slightly bigger, painted solid black, and turned
//   inside-out so we only see its BACK faces. The normal model
//   sits inside it, and the black copy peeks out around the edges
//   -- which reads as a thick outline. Cartoons and games like
//   Zelda and Borderlands do exactly this.
// ============================================================

import * as THREE from "three";

const outlineMaterial = new THREE.MeshBasicMaterial({
  color: 0x141414,
  side: THREE.BackSide, // only draw the inside-out faces
});

/**
 * Adds a black outline shell around one mesh.
 * `thickness` is roughly how many metres thick the line looks.
 */
export function outline(mesh, thickness = 0.05) {
  if (!mesh.geometry) return null;

  const shell = new THREE.Mesh(mesh.geometry, outlineMaterial);

  // Scale the copy up just a little. We work out the scale per-object
  // from its size, so a tiny sprinkle and a huge building both get a
  // sensible-looking line instead of one being swallowed whole.
  mesh.geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  mesh.geometry.boundingBox.getSize(size);
  const average = (size.x + size.y + size.z) / 3 || 1;
  const scale = 1 + (thickness * 2) / average;

  shell.scale.setScalar(scale);
  shell.castShadow = false;
  shell.receiveShadow = false;
  shell.raycast = () => {}; // outlines must never block bullets!

  mesh.add(shell);
  return shell;
}

/**
 * Walks through a whole group (a character, a building) and outlines
 * every solid piece inside it.
 */
export function outlineAll(root, thickness = 0.05) {
  const targets = [];
  root.traverse((child) => {
    // Skip things that are already outlines, and skip see-through
    // stuff like the storm wall and the glowing loot beams --
    // outlining those looks like a mistake.
    if (child.isMesh && !child.userData.isOutline && !child.material?.transparent) {
      targets.push(child);
    }
  });

  for (const mesh of targets) {
    const shell = outline(mesh, thickness);
    if (shell) shell.userData.isOutline = true;
  }
}
