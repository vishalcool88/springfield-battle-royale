// ============================================================
//   CHARACTER
//   A blocky cartoon person built from simple shapes -- now with
//   hands, shoes, hair, a nose and a proper skeleton so the
//   animation can bend knees and elbows.
//
//   Buzz AND all 49 bots use this same function; they just get
//   different colours.
// ============================================================

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { outlineAll } from "./toon.js";

/**
 * Builds one cartoon person, feet at y = 0.
 *
 * Limbs are built as nested groups (hip → thigh → knee → shin) so we
 * can bend a knee without the shin flying off somewhere. That's what
 * a "skeleton" means in animation -- each piece hangs off its parent.
 */
export function makeCharacter({
  skin = CONFIG.PLAYER_SKIN,
  shirt = CONFIG.PLAYER_SHIRT,
  pants = CONFIG.PLAYER_PANTS,
  hair = 0x3a2a1a,
} = {}) {
  const person = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  const hairMat = new THREE.MeshLambertMaterial({ color: hair });

  // ---------- TORSO ----------
  // Everything above the hips hangs off this, so we can lean the
  // whole upper body forward when sprinting.
  const torso = new THREE.Group();
  torso.position.y = 0.82;
  person.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.62, 0.4), shirtMat);
  chest.position.y = 0.44;
  torso.add(chest);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.28, 0.37), shirtMat);
  belly.position.y = 0.08;
  torso.add(belly);

  // ---------- HEAD ----------
  // On its own group so it can turn and nod independently of the body.
  const neck = new THREE.Group();
  neck.position.y = 0.82;
  torso.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), skinMat);
  neck.add(head);

  // Hair -- a squashed half-sphere sitting on top.
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.415, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat
  );
  hairCap.position.y = 0.04;
  neck.add(hairCap);

  // Nose -- tiny, but it's what makes the head read as a FACE.
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.16), skinMat);
  nose.position.set(0, -0.02, 0.4);
  neck.add(nose);

  // Eyes.
  const eyeWhiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const eyeBlackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), eyeWhiteMat);
    eye.position.set(side * 0.16, 0.07, 0.3);
    neck.add(eye);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeBlackMat);
    pupil.position.set(side * 0.17, 0.07, 0.42);
    neck.add(pupil);
  }

  // ---------- ARMS ----------
  // shoulder -> upper arm -> elbow -> forearm -> hand
  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.46, 0.66, 0);
    torso.add(shoulder);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.2), shirtMat);
    upper.position.y = -0.18;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.36;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.18), skinMat);
    forearm.position.y = -0.17;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), skinMat);
    hand.position.y = -0.4;
    elbow.add(hand);

    return { shoulder, elbow, hand };
  }

  // ---------- LEGS ----------
  // hip -> thigh -> knee -> shin -> shoe
  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.19, 0.82, 0);
    person.add(hip);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, 0.24), pantsMat);
    thigh.position.y = -0.21;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.22), pantsMat);
    shin.position.y = -0.2;
    knee.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.38), shoeMat);
    shoe.position.set(0, -0.46, 0.06);
    knee.add(shoe);

    return { hip, knee };
  }

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Thick black cartoon outline around every body part.
  outlineAll(person, 0.03);

  person.traverse((piece) => {
    if (piece.isMesh) {
      piece.castShadow = true;
      piece.receiveShadow = true;
    }
  });

  // Everything the animator needs to pose this character.
  person.userData.rig = {
    torso, neck, chest,
    leftArm, rightArm, leftLeg, rightLeg,
    phase: 0, // how far through the walk cycle we are
    bob: 0,
  };

  return person;
}

/**
 * Poses a character for this frame.
 *
 * The important fix in here: the walk cycle advances by
 * `speed * dt` each frame. The old version did `sin(time * speed)`,
 * which meant changing speed instantly teleported the legs to a
 * different part of the stride -- so going from walking to sprinting
 * made the legs visibly snap. Accumulating the phase keeps the
 * stride continuous no matter how the speed changes.
 */
export function animateCharacter(person, opts = {}) {
  const rig = person.userData.rig;
  if (!rig) return;

  const {
    speed = 0,
    dt = 0.016,
    time = 0,
    onGround = true,
    crouching = false,
    aiming = false,
  } = opts;

  const moving = speed > 0.1;

  // --- WALK / RUN CYCLE ---
  // Longer strides when running, so it doesn't look like fast shuffling.
  const strideRate = 1.15;
  rig.phase += speed * dt * strideRate;
  const swing = Math.sin(rig.phase);
  const swingOther = Math.sin(rig.phase + Math.PI);

  // How hard to swing: standing still eases everything back to rest.
  const effort = moving ? Math.min(1, speed / 9) : 0;
  const ease = (current, target, rate = 0.18) => current + (target - current) * rate;

  const { leftLeg, rightLeg, leftArm, rightArm, torso, neck } = rig;

  if (!onGround) {
    // --- IN THE AIR --- tuck the legs up, throw the arms out.
    leftLeg.hip.rotation.x = ease(leftLeg.hip.rotation.x, -0.7);
    rightLeg.hip.rotation.x = ease(rightLeg.hip.rotation.x, -0.25);
    leftLeg.knee.rotation.x = ease(leftLeg.knee.rotation.x, 0.9);
    rightLeg.knee.rotation.x = ease(rightLeg.knee.rotation.x, 0.35);
    leftArm.shoulder.rotation.x = ease(leftArm.shoulder.rotation.x, -0.5);
    rightArm.shoulder.rotation.x = ease(rightArm.shoulder.rotation.x, -0.5);
    leftArm.shoulder.rotation.z = ease(leftArm.shoulder.rotation.z, 0.75);
    rightArm.shoulder.rotation.z = ease(rightArm.shoulder.rotation.z, -0.75);
  } else {
    // --- LEGS ---
    leftLeg.hip.rotation.x = swing * 0.72 * effort;
    rightLeg.hip.rotation.x = swingOther * 0.72 * effort;
    // A knee only bends one way! Clamping at 0 stops the shin
    // snapping forwards through the thigh, which looks broken.
    leftLeg.knee.rotation.x = Math.max(0, -swing * 0.85) * effort;
    rightLeg.knee.rotation.x = Math.max(0, -swingOther * 0.85) * effort;

    // --- ARMS --- opposite to the legs, like real walking.
    leftArm.shoulder.rotation.z = ease(leftArm.shoulder.rotation.z, 0.08);
    rightArm.shoulder.rotation.z = ease(rightArm.shoulder.rotation.z, -0.08);

    if (aiming) {
      // Gun up: both arms forward, elbows slightly bent.
      leftArm.shoulder.rotation.x = ease(leftArm.shoulder.rotation.x, -1.35, 0.3);
      rightArm.shoulder.rotation.x = ease(rightArm.shoulder.rotation.x, -1.45, 0.3);
      leftArm.elbow.rotation.x = ease(leftArm.elbow.rotation.x, -0.35, 0.3);
      rightArm.elbow.rotation.x = ease(rightArm.elbow.rotation.x, -0.2, 0.3);
    } else {
      leftArm.shoulder.rotation.x = swingOther * 0.6 * effort;
      rightArm.shoulder.rotation.x = swing * 0.6 * effort;
      leftArm.elbow.rotation.x = ease(leftArm.elbow.rotation.x, -0.25 - effort * 0.3);
      rightArm.elbow.rotation.x = ease(rightArm.elbow.rotation.x, -0.25 - effort * 0.3);
    }
  }

  // --- BODY BOB ---
  // Your body rises and falls TWICE per stride (once per footfall),
  // which is why this uses phase * 2.
  rig.bob = Math.abs(Math.sin(rig.phase)) * 0.06 * effort;
  const crouchDrop = crouching ? -0.18 : 0;
  torso.position.y = 0.82 + rig.bob + crouchDrop;

  // Lean forward the faster you go. Crouching hunches you over too.
  const targetLean = (crouching ? 0.35 : 0) + effort * 0.16;
  torso.rotation.x = ease(torso.rotation.x, targetLean, 0.12);
  // Keep the head level even when the body leans -- people do this.
  neck.rotation.x = ease(neck.rotation.x, -targetLean * 0.75, 0.12);

  // --- IDLE BREATHING --- barely visible, but the character stops
  // looking like a frozen statue when standing still.
  if (!moving) {
    const breath = Math.sin(time * 1.7) * 0.012;
    rig.chest.scale.set(1 + breath, 1 + breath * 0.6, 1 + breath);
    neck.position.y = 0.82 + breath * 0.5;
  } else {
    rig.chest.scale.set(1, 1, 1);
  }
}

// Old name kept so nothing breaks if it's still called somewhere.
export function animateWalk(person, speed, time) {
  animateCharacter(person, { speed, time, dt: 1 / 60 });
}
