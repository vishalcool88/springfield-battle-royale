// ============================================================
//   MAIN
//   Starts everything, then runs the game loop -- the thing
//   that redraws the screen ~60 times a second, forever.
// ============================================================

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { buildWorld } from "./world.js";
import { Player } from "./player.js";
import { createBots } from "./bots.js";
import { Effects } from "./combat.js";
import { UI } from "./ui.js";
import { Storm } from "./storm.js";
import { spawnLoot } from "./weapons.js";
import { Sounds } from "./sounds.js";
import { takeScreenshot } from "./screenshot.js";

// --- THE SCENE --- (the 3D world that holds everything)
const scene = new THREE.Scene();

// --- THE CAMERA --- (your eye)
const camera = new THREE.PerspectiveCamera(
  72, // field of view -- how wide your vision is. Try 110 for fisheye!
  window.innerWidth / window.innerHeight,
  0.1,
  700
);

// --- THE RENDERER --- (the thing that actually draws pixels)
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  // Keeps the drawn frame in memory so the P-key screenshot isn't blank.
  preserveDrawingBuffer: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- BUILD SPRINGFIELD ---
const { colliders, openSpots } = buildWorld(scene);
const { pickups, chests, medkits } = spawnLoot(scene, colliders);

// ============================================================
//   THE GAME
//   One object holding everything, so any part of the game can
//   reach any other part (bots need to find you, you need to
//   shoot bots, everyone needs the wall list).
// ============================================================

const game = {
  scene,
  camera,
  colliders,
  openSpots,
  pickups,
  chests,
  medkits,
  effects: new Effects(scene),
  sounds: new Sounds(),
  ui: new UI(),
  storm: new Storm(scene),
  fighters: [], // you + all the bots -- everyone who can be shot
  over: false,
  // Seconds of peace left at the start. While this is above zero
  // nobody -- not you, not the bots -- can shoot.
  graceRemaining: CONFIG.GRACE_PERIOD,
  stormTickTimer: 0,

  // Has the match properly begun (everyone on the ground)?
  // This deliberately does NOT read the player's skydive state. It used
  // to, and if the player died before landing, their state stayed
  // "SKYDIVE" forever -- which froze the countdown and meant no bot
  // could ever fire a single shot for the rest of the match.
  matchLive: false,
  dropTimer: 0,

  /** Called the moment your feet touch the ground after skydiving. */
  onPlayerLanded() {
    this.matchLive = true;
    this.ui.toast("Landed! Find a chest.", 0xffc02e);
  },

  /**
   * A gun went off. Every bot close enough HEARS it and may come
   * running. This one function is what creates third-partying.
   */
  makeNoise(spot, whoMadeIt) {
    for (const fighter of this.fighters) {
      if (fighter === whoMadeIt || !fighter.isBot || !fighter.alive) continue;
      fighter.hearGunshot(spot);
    }
  },

  /** Somebody's health hit zero. */
  eliminate(victim, killer) {
    if (!victim.alive) return;
    victim.alive = false;
    victim.mesh.visible = false;
    this.effects.poof(victim.position, victim.shirtColor ?? 0xffffff);

    if (killer) killer.kills++;

    this.ui.addKill(
      killer ? killer.name : "The Storm",
      victim.name,
      killer === player,
      victim === player
    );

    const stillAlive = this.fighters.filter((f) => f.alive).length;
    this.ui.setAlive(stillAlive);

    if (killer === player) this.sounds.eliminate();

    if (victim === player) {
      this.finish(false, stillAlive + 1);
    } else if (player.alive && stillAlive === 1) {
      this.finish(true, 1);
    }
  },

  finish(won, place) {
    if (this.over) return;
    this.over = true;
    if (won) {
      player.state = "VICTORY";
      this.sounds.victory();
    } else {
      this.sounds.defeat();
    }
    this.ui.showEnd({ won, place, total: CONFIG.TOTAL_PLAYERS, kills: player.kills });
  },
};

// --- SPAWN EVERYONE ---
const player = new Player(scene);
const bots = createBots(scene, openSpots);
game.player = player;
game.bots = bots;
game.fighters = [player, ...bots];

game.ui.setAlive(CONFIG.TOTAL_PLAYERS);
game.ui.setHealth(player.health);
game.ui.setAmmo(player.weapon);
game.ui.setInventory(player.inventory, player.slot);

// ============================================================
//   CONTROLS
// ============================================================

const keys = new Set(); // every key currently held down
let mouseDown = false;

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  game.sounds.wake(); // browsers only allow audio after a real keypress/click

  // Stop the page from scrolling when you jump or look around.
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();

  // H opens the controls panel. Esc closes it (as well as releasing
  // the mouse, which the browser handles by itself).
  if (e.code === "KeyH") {
    const opened = game.ui.toggleHelp();
    if (opened) document.exitPointerLock?.();
  }
  if (e.code === "Escape" && game.ui.helpIsOpen) game.ui.toggleHelp(false);

  if (e.code === "KeyR") player.reload(game);
  if (e.code === "KeyE") player.interact(game);
  if (e.code === "KeyQ") player.startHealing(game);

  // P = screenshot. Shift+P = clean shot with no HUD, for showing off.
  if (e.code === "KeyP") {
    takeScreenshot({ renderer, scene, camera, ui: game.ui, hideHud: e.shiftKey });
  }
  if (e.code === "Digit1") player.selectSlot(0, game);
  if (e.code === "Digit2") player.selectSlot(1, game);
  if (e.code === "Digit3") player.selectSlot(2, game);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

// The game starts running the moment the page loads -- no "click to
// play" screen. You can play the whole thing on the keyboard.
//
// Clicking is OPTIONAL: it turns on smooth mouse aiming. Browsers
// will only hand over the mouse after a real click (it's a security
// rule we can't get around), so the arrow keys are the no-click way
// to look around.
const hint = document.getElementById("hint");

document.addEventListener("click", () => {
  game.sounds.wake();
  if (game.over) return;
  renderer.domElement.requestPointerLock?.();
});

document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (locked) hint.classList.add("fadeout");
  if (!locked) mouseDown = false;
});

// Fade the hint away on its own after a while even if you never click.
setTimeout(() => hint.classList.add("fadeout"), 14000);

document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === renderer.domElement) {
    player.look(e.movementX, e.movementY);
  }
});

document.addEventListener("mousedown", () => {
  if (document.pointerLockElement === renderer.domElement) mouseDown = true;
});
document.addEventListener("mouseup", () => (mouseDown = false));

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
//   THE GAME LOOP
// ============================================================

const clock = new THREE.Clock();

function gameLoop() {
  requestAnimationFrame(gameLoop); // "run me again next frame"

  // dt = seconds since the last frame. Capped, so alt-tabbing away
  // and coming back doesn't teleport everyone across the map.
  const dt = Math.min(clock.getDelta(), 0.1);
  const time = clock.getElapsedTime();

  stepGame(dt, time);
  renderer.render(scene, camera);
}

/** One tick of the whole world. Split out so tests can call it directly. */
function stepGame(dt, time) {
  // --- WAITING FOR EVERYONE TO LAND ---
  // Safety net: even if the player somehow never lands, the match
  // starts anyway once the drop has had more than enough time.
  if (!game.matchLive) {
    game.dropTimer += dt;
    const longestPossibleDrop = CONFIG.SKYDIVE_HEIGHT / CONFIG.SKYDIVE_FALL_SPEED + 3;
    if (game.dropTimer > longestPossibleDrop) game.matchLive = true;
  }

  // --- THE "GET READY" COUNTDOWN --- starts once everyone's down.
  if (game.matchLive && game.graceRemaining > 0) game.graceRemaining -= dt;
  game.ui.setCountdown(game.matchLive ? game.graceRemaining : CONFIG.GRACE_PERIOD);

  // --- LOOKING AROUND WITH THE ARROW KEYS ---
  // The no-click way to aim. Mouse look is handled by the listener above.
  const ARROW_SPEED = 2.2; // radians per second
  if (keys.has("ArrowLeft")) player.yaw += ARROW_SPEED * dt;
  if (keys.has("ArrowRight")) player.yaw -= ARROW_SPEED * dt;
  if (keys.has("ArrowUp")) player.pitch = Math.min(0.7, player.pitch + ARROW_SPEED * dt);
  if (keys.has("ArrowDown")) player.pitch = Math.max(-1.2, player.pitch - ARROW_SPEED * dt);

  // --- SHOOTING --- (mouse held down, or Enter for keyboard-only play)
  const wantsToShoot = mouseDown || keys.has("Enter");
  if (wantsToShoot && game.graceRemaining <= 0 && !game.over) player.shoot(game, camera);

  // --- EVERYONE MOVES ---
  player.update(dt, keys, game, camera, time);
  for (const bot of bots) bot.update(dt, game, time);

  // --- THE STORM ---
  // It holds off until everyone's landed, so nobody dies mid-skydive.
  if (game.matchLive) game.storm.update(dt, game.fighters, game);

  const playerInStorm = player.alive && !game.storm.isSafe(player.position);
  game.ui.setStorm(game.storm.statusText, playerInStorm);
  if (playerInStorm) {
    game.ui.setHealth(player.health);
    game.stormTickTimer -= dt;
    if (game.stormTickTimer <= 0) {
      game.sounds.stormTick();
      game.stormTickTimer = 0.7;
    }
  }

  // --- LOOT SPINS AND CHESTS OPEN ---
  for (const pickup of game.pickups) pickup.update(dt, time);
  for (const medkit of game.medkits) medkit.update(dt, time);
  for (const chest of game.chests) chest.update(dt);

  // --- CROSSHAIR CHANGES SHAPE WITH YOUR WEAPON ---
  game.ui.setCrosshair(player.weapon, player.crouching);

  // --- THE "[E] Pick Up ..." PROMPT ---
  const grabbable = player.nearbyInteractable(game);
  game.ui.setGrabPrompt(grabbable?.label ?? null, grabbable?.color);

  // --- ALL THE VISUAL EXTRAS ---
  game.effects.update(dt);
  game.ui.updatePlates(game.fighters, player, camera);
  game.ui.drawMinimap(player, bots, game.storm, game.chests);
  if (player.weapon) game.ui.setAmmo(player.weapon);
}

gameLoop();

// ============================================================
//   SECRET DEBUG MENU 🕵️
//   Press F12 in the browser, click "Console", and type things like:
//       game.CONFIG.GRAVITY = 4              (moon gravity!)
//       game.CONFIG.WALK_SPEED = 40          (super speed)
//       game.player.takeWeapon(game.roll(2), game)   (legendary gun!)
//       game.player.position.y = 60          (teleport into the sky)
//   These only last until you refresh the page, so you can't
//   break anything. Go wild.
// ============================================================
window.game = Object.assign(game, { bots, renderer, CONFIG, keys, stepGame });

// A shortcut so you can cheat yourself a good gun from the console.
import { rollWeapon } from "./weapons.js";
game.roll = rollWeapon;

console.log(`🎮 ${CONFIG.TOWN_NAME}: ${CONFIG.PLAYER_NAME} vs ${CONFIG.BOT_COUNT} bots.`);
console.log("💡 Try typing:  game.CONFIG.GRAVITY = 4");
