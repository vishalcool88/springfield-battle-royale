// ============================================================
//   UI -- everything drawn ON TOP of the 3D world.
//   Crosshair, health bar, ammo, players-left, and the kill feed.
//   This is all normal HTML, just floating over the game.
// ============================================================

import * as THREE from "three";
import { CONFIG } from "./config.js";

/**
 * One line of the controls panel. Splits "W A S D" into separate
 * key-cap boxes so it looks like actual keyboard keys.
 */
function helpRow(keys, description) {
  const caps = keys.split(" ").map((k) => `<span>${k}</span>`).join("");
  return `<div class="helpRow"><div class="k">${caps}</div>
          <div class="d">${description}</div></div>`;
}

/** Turns a 0xRRGGBB number into a "#rrggbb" string for CSS. */
function cssColor(hex) {
  return "#" + hex.toString(16).padStart(6, "0");
}

/**
 * Works out where a 3D point lands on your 2D screen, so we can put
 * HTML (damage numbers, nameplates) exactly on top of it.
 * Returns null if the point is behind you.
 */
const projected = new THREE.Vector3();
function toScreen(worldPosition, camera) {
  projected.set(worldPosition.x, worldPosition.y, worldPosition.z);
  projected.project(camera);

  // z > 1 means it's behind the camera -- don't draw it.
  if (projected.z > 1) return null;

  return {
    x: (projected.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
  };
}

export class UI {
  constructor() {
    this.root = document.createElement("div");
    this.root.innerHTML = `
      <style>
        .hud { position: fixed; inset: 0; pointer-events: none;
               font-family: "Trebuchet MS", sans-serif; color: #fff;
               text-shadow: 2px 2px 0 rgba(0,0,0,.65); z-index: 5; }

        /* --- CROSSHAIR --- */
        .crosshair { position: absolute; left: 50%; top: 50%;
                     width: 22px; height: 22px; margin: -11px 0 0 -11px; }
        .crosshair span { position: absolute; background: #fff;
                          box-shadow: 0 0 0 1.5px rgba(0,0,0,.7); }
        .crosshair .up    { left: 10px; top: 0;    width: 2px; height: 7px; }
        .crosshair .down  { left: 10px; bottom: 0; width: 2px; height: 7px; }
        .crosshair .left  { top: 10px; left: 0;    height: 2px; width: 7px; }
        .crosshair .right { top: 10px; right: 0;   height: 2px; width: 7px; }

        /* The shotgun's big round crosshair -- it shows you roughly how
           wide the pellets spray, so you know when you're close enough. */
        .shotring { position: absolute; left: 50%; top: 50%;
                    border: 3px solid rgba(255,255,255,.85);
                    border-radius: 50%; display: none;
                    box-shadow: 0 0 0 1.5px rgba(0,0,0,.6),
                                inset 0 0 0 1.5px rgba(0,0,0,.6); }
        .shotring.show { display: block; }

        /* The sniper gets a tight, precise cross instead. */
        .crosshair.sniper span { background: #ff4d4d; }

        /* --- PLAYERS LEFT (top middle) --- */
        .alive { position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
                 background: rgba(0,0,0,.45); border: 2px solid rgba(255,255,255,.25);
                 border-radius: 10px; padding: 6px 18px; text-align: center; }
        .alive .num { font-size: 30px; font-weight: bold; color: #ffd90f; line-height: 1; }
        .alive .label { font-size: 11px; letter-spacing: 2px; opacity: .85; }

        /* --- HEALTH + AMMO (bottom) --- */
        .bottom { position: absolute; bottom: 22px; left: 50%;
                  transform: translateX(-50%); width: 460px; }
        .healthbar { height: 20px; background: rgba(0,0,0,.5);
                     border: 2px solid rgba(255,255,255,.3); border-radius: 10px;
                     overflow: hidden; }
        .healthfill { height: 100%; width: 100%; background: linear-gradient(#7bed6f,#26a34a);
                      transition: width .12s linear; }
        .healthnum { position: absolute; top: 0; left: 50%; transform: translateX(-50%);
                     font-size: 14px; font-weight: bold; line-height: 20px; }
        .ammo { text-align: right; font-size: 26px; font-weight: bold; margin-top: 6px; }
        .ammo .mag { color: #fff; } .ammo .slash { opacity: .6; font-size: 18px; }
        .reloading { color: #ffd90f; font-size: 16px; text-align: right; }

        /* --- KILL FEED (top right) --- */
        .feed { position: absolute; top: 16px; right: 16px; width: 300px; text-align: right; }
        .feed div { background: rgba(0,0,0,.45); border-radius: 6px;
                    padding: 4px 10px; margin-bottom: 4px; font-size: 13px;
                    animation: slideIn .2s ease-out; }
        .feed .you { color: #ffd90f; font-weight: bold; }
        @keyframes slideIn { from { opacity:0; transform: translateX(20px);} to {opacity:1;} }

        /* --- GET READY COUNTDOWN --- */
        .countdown { position: absolute; left: 50%; top: 34%;
                     transform: translateX(-50%); text-align: center; }
        .countdown .word { font-size: 26px; letter-spacing: 5px; opacity: .9; }
        .countdown .num { font-size: 96px; font-weight: bold; color: #ffd90f;
                          line-height: 1; animation: pop .35s ease-out; }
        .countdown.go .num { color: #7bed6f; font-size: 72px; }
        @keyframes pop { from { transform: scale(1.5); opacity: .4; } to { transform: scale(1); } }

        /* --- DAMAGE FLASH --- */
        .hurt { position: absolute; inset: 0; background: radial-gradient(
                  ellipse at center, transparent 45%, rgba(200,0,0,.55) 100%);
                opacity: 0; transition: opacity .18s; }

        /* --- MED KITS --- */
        .medkit { margin-top: 6px; font-size: 15px; text-align: right; }
        .medkit .count { color: #6bf06b; font-weight: bold; }
        .medkit .hint { font-size: 11px; opacity: .55; margin-left: 6px; }
        .medkit.none .count { opacity: .35; color: #fff; }
        .healbar { height: 9px; background: rgba(0,0,0,.55); border-radius: 5px;
                   overflow: hidden; margin-top: 4px; display: none;
                   border: 1px solid rgba(255,255,255,.3); }
        .healbar.show { display: block; }
        .healbar i { display: block; height: 100%; width: 0;
                     background: linear-gradient(90deg,#6bf06b,#26a34a); }

        /* --- INVENTORY (weapon slots) --- */
        .slots { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
        .slot { width: 116px; padding: 5px 7px; border-radius: 7px; font-size: 11px;
                background: rgba(0,0,0,.5); border: 2px solid rgba(255,255,255,.2);
                text-align: left; line-height: 1.35; }
        .slot.active { border-color: #ffd90f; background: rgba(0,0,0,.72); }
        .slot .key { opacity: .6; font-size: 10px; }
        .slot .wname { font-weight: bold; }
        .slot.empty { opacity: .35; }

        /* --- STORM TIMER --- */
        .storm { position: absolute; top: 84px; left: 50%; transform: translateX(-50%);
                 background: rgba(0,0,0,.45); border-radius: 8px; padding: 4px 14px;
                 font-size: 13px; letter-spacing: 1px; border: 2px solid rgba(255,79,216,.55); }
        .storm.danger { background: rgba(150,0,90,.6); animation: pulse .8s infinite alternate; }
        @keyframes pulse { from { opacity: .75; } to { opacity: 1; } }

        /* --- MINIMAP --- */
        .minimap { position: absolute; top: 16px; left: 16px;
                   width: 168px; height: 168px; border-radius: 50%;
                   background: rgba(30,60,25,.55); overflow: hidden;
                   border: 3px solid rgba(255,255,255,.32); }
        .minimap canvas { width: 100%; height: 100%; display: block; }

        /* --- FLOATING DAMAGE NUMBERS --- */
        .dmg { position: absolute; font-weight: bold; font-size: 19px; color: #fff;
               pointer-events: none; animation: floatUp .8s ease-out forwards; }
        .dmg.head { color: #ff5d5d; font-size: 25px; }
        @keyframes floatUp { from { transform: translate(-50%,0); opacity: 1; }
                             to   { transform: translate(-50%,-48px); opacity: 0; } }

        /* --- ENEMY NAMEPLATES --- */
        .plate { position: absolute; transform: translate(-50%,-100%);
                 pointer-events: none; text-align: center; font-size: 11px; }
        .plate .bar { width: 58px; height: 5px; background: rgba(0,0,0,.6);
                      border-radius: 3px; overflow: hidden; margin: 2px auto 0; }
        .plate .bar i { display: block; height: 100%; background: #ff5f5f; }

        /* --- TOAST (pickup messages) --- */
        .toast { position: absolute; left: 50%; bottom: 152px; transform: translateX(-50%);
                 font-size: 15px; font-weight: bold; animation: floatUp2 1.6s ease-out forwards; }
        @keyframes floatUp2 { 0% {opacity:0;} 15% {opacity:1;} 75% {opacity:1;} 100% {opacity:0;} }

        /* --- "PRESS E" PROMPT --- */
        .grab { position: absolute; left: 50%; top: 57%; transform: translateX(-50%);
                display: none; text-align: center; font-size: 17px;
                background: rgba(0,0,0,.55); border-radius: 10px; padding: 8px 20px;
                border: 2px solid rgba(255,255,255,.3); }
        .grab.show { display: block; }
        .grab .key { background: #ffd90f; color: #111; font-weight: bold;
                     border-radius: 5px; padding: 1px 9px; margin-right: 7px;
                     text-shadow: none; }

        /* --- CONTROLS PANEL (press H) --- */
        .helpTab { position: absolute; bottom: 16px; right: 16px; font-size: 12px;
                   background: rgba(0,0,0,.45); border: 2px solid rgba(255,255,255,.22);
                   border-radius: 8px; padding: 5px 12px; }
        .helpTab b { color: #ffd90f; }
        .help { position: fixed; inset: 0; display: none; align-items: center;
                justify-content: center; background: rgba(0,0,0,.72); z-index: 30; }
        .help.show { display: flex; }
        .helpBox { background: #1c2230; border: 3px solid #ffd90f; border-radius: 16px;
                   padding: 26px 34px; max-width: 620px; width: 90%;
                   box-shadow: 0 14px 40px rgba(0,0,0,.5); }
        .helpBox h2 { color: #ffd90f; font-size: 27px; margin-bottom: 4px; letter-spacing: 1px; }
        .helpBox .sub { font-size: 13px; opacity: .7; margin-bottom: 16px; }
        .helpBox h3 { font-size: 13px; color: #7bd2ff; letter-spacing: 2px;
                      margin: 16px 0 7px; border-bottom: 1px solid rgba(255,255,255,.15);
                      padding-bottom: 4px; }
        .helpRow { display: flex; align-items: baseline; gap: 12px;
                   font-size: 14px; padding: 3px 0; }
        .helpRow .k { flex: 0 0 132px; text-align: right; }
        .helpRow .k span { background: #2f3a4d; border: 1px solid rgba(255,255,255,.28);
                           border-radius: 5px; padding: 2px 8px; font-size: 12px;
                           font-weight: bold; color: #fff; display: inline-block;
                           margin-left: 3px; }
        .helpRow .d { flex: 1; opacity: .92; }
        .helpBox .close { margin-top: 18px; text-align: center; font-size: 13px; opacity: .7; }

        /* --- END SCREEN --- */
        .end { position: fixed; inset: 0; display: none; flex-direction: column;
               align-items: center; justify-content: center; gap: 10px;
               background: rgba(0,0,0,.72); z-index: 20; pointer-events: auto; }
        .end h1 { font-size: 80px; letter-spacing: 3px; }
        .end .place { font-size: 30px; } .end .stat { font-size: 19px; opacity: .9; }
        .end button { pointer-events: auto; margin-top: 18px; padding: 12px 34px;
                      font-size: 20px; font-weight: bold; cursor: pointer;
                      border: none; border-radius: 10px; background: #ffd90f;
                      font-family: inherit; }
      </style>

      <div class="hud">
        <div class="shotring" id="shotring"></div>
        <div class="crosshair" id="crosshair">
          <span class="up"></span><span class="down"></span>
          <span class="left"></span><span class="right"></span>
        </div>
        <div class="minimap"><canvas id="minimap" width="336" height="336"></canvas></div>
        <div class="alive">
          <div class="num" id="aliveCount">${CONFIG.TOTAL_PLAYERS}</div>
          <div class="label">ALIVE</div>
        </div>
        <div class="storm" id="storm">STORM</div>
        <div class="bottom">
          <div style="position:relative">
            <div class="healthbar"><div class="healthfill" id="healthFill"></div></div>
            <div class="healthnum" id="healthNum">100</div>
          </div>
          <div class="ammo" id="ammo"><span class="mag">30</span><span class="slash"> / 30</span></div>
          <div class="reloading" id="reloading" style="visibility:hidden">RELOADING…</div>
          <div class="medkit" id="medkit">
            <span class="count">✚ 0</span>
            <span class="hint">press Q to use</span>
            <div class="healbar"><i id="healFill"></i></div>
          </div>
          <div class="slots" id="slots"></div>
        </div>
        <div class="grab" id="grab"></div>
        <div id="plates"></div>
        <div id="floaters"></div>
        <div class="helpTab"><b>H</b> — Controls</div>
        <div class="countdown" id="countdown">
          <div class="word">GET READY</div>
          <div class="num" id="countdownNum">5</div>
        </div>
        <div class="feed" id="feed"></div>
        <div class="hurt" id="hurt"></div>
      </div>

      <div class="help" id="help">
        <div class="helpBox">
          <h2>CONTROLS</h2>
          <div class="sub">${CONFIG.TOWN_NAME} Battle Royale — playing as ${CONFIG.PLAYER_NAME}</div>

          <h3>MOVING</h3>
          ${helpRow("W A S D", "Run around")}
          ${helpRow("Shift", "Sprint (hold it down)")}
          ${helpRow("C", "<b>Crouch</b> — slower, but harder to hit and steadier aim")}
          ${helpRow("Space", "Jump")}
          ${helpRow("Mouse", "Look around — click once to switch it on")}
          ${helpRow("↑ ← ↓ →", "Look around without using the mouse")}

          <h3>FIGHTING</h3>
          ${helpRow("Click", "Shoot (hold to keep firing)")}
          ${helpRow("Enter", "Shoot, if you'd rather not use the mouse")}
          ${helpRow("R", "Reload")}
          ${helpRow("1 2 3", "Switch between your three weapon slots")}

          <h3>LOOT AND HEALING</h3>
          ${helpRow("E", "<b>Pick up a gun</b> — walk onto it, then press E")}
          ${helpRow("E", "<b>Open a gold chest</b> — stand next to it and press E")}
          ${helpRow("E", "<b>Take a med kit</b> — the white box with a red cross")}
          ${helpRow("Q", "<b>Use a med kit</b> — stand still 5 seconds, heal to full")}
          <div class="helpRow"><div class="k"></div><div class="d" style="opacity:.7;font-size:12.5px">
            The game tells you when you're close enough. Chests give much
            better loot than guns lying on the ground.</div></div>

          <h3>OTHER</h3>
          ${helpRow("P", "<b>Screenshot</b> — saves to your Downloads folder")}
          ${helpRow("Shift P", "Clean screenshot with no HUD — best for showing off")}
          ${helpRow("H", "Show or hide this panel")}
          ${helpRow("Esc", "Release the mouse from the game")}
          ${helpRow("F12", "Open the secret console — try game.CONFIG.GRAVITY = 4")}

          <div class="close">Press <b>H</b> or <b>Esc</b> to close — the match keeps running!</div>
        </div>
      </div>

      <div class="end" id="endScreen">
        <h1 id="endTitle">ELIMINATED</h1>
        <div class="place" id="endPlace"></div>
        <div class="stat" id="endStats"></div>
        <button id="againBtn">PLAY AGAIN</button>
      </div>
    `;
    document.body.appendChild(this.root);

    this.aliveCount = this.root.querySelector("#aliveCount");
    this.healthFill = this.root.querySelector("#healthFill");
    this.healthNum = this.root.querySelector("#healthNum");
    this.ammoEl = this.root.querySelector("#ammo");
    this.reloadingEl = this.root.querySelector("#reloading");
    this.feed = this.root.querySelector("#feed");
    this.hurt = this.root.querySelector("#hurt");
    this.endScreen = this.root.querySelector("#endScreen");
    this.countdown = this.root.querySelector("#countdown");
    this.countdownNum = this.root.querySelector("#countdownNum");
    this.lastCountdownShown = null;
    this.slots = this.root.querySelector("#slots");
    this.stormEl = this.root.querySelector("#storm");
    this.plates = this.root.querySelector("#plates");
    this.floaters = this.root.querySelector("#floaters");
    this.minimap = this.root.querySelector("#minimap");
    this.minimapCtx = this.minimap.getContext("2d");
    this.platePool = [];

    this.helpPanel = this.root.querySelector("#help");
    this.grabEl = this.root.querySelector("#grab");
    this.shotring = this.root.querySelector("#shotring");
    this.crosshairEl = this.root.querySelector("#crosshair");
    this.medkitEl = this.root.querySelector("#medkit");
    this.healbar = this.root.querySelector(".healbar");
    this.healFill = this.root.querySelector("#healFill");
    this.root.querySelector("#againBtn").addEventListener("click", () => location.reload());
  }

  setAlive(n) { this.aliveCount.textContent = n; }

  /**
   * The "[E] Open Chest" prompt that appears when you're close enough
   * to grab something. Pass null when there's nothing nearby.
   */
  setGrabPrompt(text, color = 0xffffff) {
    if (!text) {
      this.grabEl.classList.remove("show");
      return;
    }
    this.grabEl.innerHTML =
      `<span class="key">E</span><span style="color:${cssColor(color)}">${text}</span>`;
    this.grabEl.classList.add("show");
  }

  /** Show/hide the controls panel. Returns true if it's now open. */
  toggleHelp(forceOpen) {
    const open = forceOpen ?? !this.helpPanel.classList.contains("show");
    this.helpPanel.classList.toggle("show", open);
    return open;
  }

  get helpIsOpen() { return this.helpPanel.classList.contains("show"); }

  /**
   * The "GET READY 5... 4... 3..." countdown, then "FIGHT!".
   * Called every frame with how many seconds of peace are left.
   */
  setCountdown(secondsLeft) {
    if (secondsLeft > 0) {
      const showing = Math.ceil(secondsLeft);
      // Only touch the HTML when the number actually changes, so the
      // pop animation replays once per second instead of every frame.
      if (showing !== this.lastCountdownShown) {
        this.countdownNum.textContent = showing;
        this.lastCountdownShown = showing;
        this.countdownNum.style.animation = "none";
        void this.countdownNum.offsetWidth; // forces the animation to restart
        this.countdownNum.style.animation = "";
      }
      return;
    }

    // Time's up -- flash FIGHT! then get out of the way.
    if (this.lastCountdownShown !== "GO") {
      this.lastCountdownShown = "GO";
      this.countdown.classList.add("go");
      this.countdown.querySelector(".word").textContent = "";
      this.countdownNum.textContent = "FIGHT!";
      setTimeout(() => (this.countdown.style.display = "none"), 900);
    }
  }

  setHealth(health) {
    const percent = Math.max(0, health) / CONFIG.MAX_HEALTH * 100;
    this.healthFill.style.width = percent + "%";
    this.healthNum.textContent = Math.max(0, Math.ceil(health));
    // Bar goes red when you're in trouble.
    this.healthFill.style.background = percent > 50
      ? "linear-gradient(#7bed6f,#26a34a)"
      : percent > 25
      ? "linear-gradient(#ffd76b,#e8a33d)"
      : "linear-gradient(#ff8080,#c0392b)";
  }

  setAmmo(weapon) {
    if (!weapon) { this.ammoEl.innerHTML = ""; return; }
    if (weapon.isMelee) { this.ammoEl.innerHTML = `<span class="mag">∞</span>`; return; }
    this.ammoEl.innerHTML =
      `<span class="mag">${weapon.ammoInMag}</span>` +
      `<span class="slash"> / ${weapon.spec.magSize}</span>`;
  }

  /**
   * The crosshair changes shape depending on what you're holding.
   * Shotgun  -> a big round ring showing roughly where the pellets go
   * Sniper   -> a tight red cross
   * Anything else -> the normal little cross
   */
  setCrosshair(weapon, crouching) {
    const isShotgun = weapon && weapon.spec.pellets > 1;
    const isSniper = weapon && weapon.spec.range > 250;

    this.crosshairEl.classList.toggle("sniper", !!isSniper);

    if (isShotgun) {
      // The ring shrinks when you crouch, because your aim really is tighter.
      const size = crouching ? 74 : 104;
      this.shotring.style.width = size + "px";
      this.shotring.style.height = size + "px";
      this.shotring.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
      this.shotring.classList.add("show");
    } else {
      this.shotring.classList.remove("show");
    }
  }

  /** Med kit count, and the 5-second healing progress bar. */
  setHealProgress(fraction, medkitCount) {
    this.medkitEl.querySelector(".count").textContent = "✚ " + medkitCount;
    this.medkitEl.classList.toggle("none", medkitCount === 0);

    if (fraction > 0) {
      this.healbar.classList.add("show");
      this.healFill.style.width = Math.min(100, fraction * 100) + "%";
    } else {
      this.healbar.classList.remove("show");
      this.healFill.style.width = "0%";
    }
  }

  /** Draws the three weapon slots along the bottom. */
  setInventory(inventory, activeSlot) {
    this.slots.innerHTML = inventory
      .map((weapon, i) => {
        if (!weapon) {
          return `<div class="slot empty"><span class="key">${i + 1}</span><br>
                  <span class="wname">— empty —</span></div>`;
        }
        return `<div class="slot ${i === activeSlot ? "active" : ""}">
                  <span class="key">${i + 1}</span><br>
                  <span class="wname" style="color:${cssColor(weapon.rarity.color)}">
                    ${weapon.spec.name}
                  </span><br>
                  <span style="opacity:.75">${weapon.rarity.name}</span>
                </div>`;
      })
      .join("");
  }

  /** The pink storm timer under the alive-counter. */
  setStorm(text, playerInDanger) {
    this.stormEl.textContent = playerInDanger ? "⚠ GET TO THE CIRCLE!" : text;
    this.stormEl.classList.toggle("danger", playerInDanger);
  }

  /** A short message like "Picked up Legendary Sniper". */
  toast(text, color = 0xffffff) {
    const el = document.createElement("div");
    el.className = "toast";
    el.style.color = cssColor(color);
    el.textContent = text;
    this.floaters.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  /** Damage numbers that pop up where your bullet landed. */
  damageNumber(worldPosition, amount, isHead, camera) {
    const screen = toScreen(worldPosition, camera);
    if (!screen) return;

    const el = document.createElement("div");
    el.className = "dmg" + (isHead ? " head" : "");
    el.textContent = isHead ? amount + "!" : amount;
    el.style.left = screen.x + "px";
    el.style.top = screen.y + "px";
    this.floaters.appendChild(el);
    setTimeout(() => el.remove(), 850);
  }

  /**
   * Floating name + health bar above nearby enemies.
   * We reuse a pool of elements instead of making new ones every
   * frame -- making 50 HTML elements 60 times a second would crawl.
   */
  updatePlates(fighters, player, camera) {
    let used = 0;

    for (const fighter of fighters) {
      if (fighter === player || !fighter.alive) continue;
      const distance = player.position.distanceTo(fighter.position);
      if (distance > 55) continue;

      const head = {
        x: fighter.position.x,
        y: fighter.position.y + 2.75,
        z: fighter.position.z,
      };
      const screen = toScreen(head, camera);
      if (!screen) continue;

      let plate = this.platePool[used];
      if (!plate) {
        plate = document.createElement("div");
        plate.className = "plate";
        plate.innerHTML = `<span class="pname"></span><div class="bar"><i></i></div>`;
        this.plates.appendChild(plate);
        this.platePool.push(plate);
      }

      plate.style.display = "block";
      plate.style.left = screen.x + "px";
      plate.style.top = screen.y + "px";
      plate.querySelector(".pname").textContent = fighter.name;
      plate.querySelector(".bar i").style.width =
        Math.max(0, (fighter.health / CONFIG.MAX_HEALTH) * 100) + "%";
      used++;
    }

    // Hide any leftover plates from last frame.
    for (let i = used; i < this.platePool.length; i++) {
      this.platePool[i].style.display = "none";
    }
  }

  /** The little round map in the top-left corner. */
  drawMinimap(player, bots, storm, chests) {
    const ctx = this.minimapCtx;
    const size = this.minimap.width;
    const half = size / 2;
    const VIEW = 150; // how many metres across the map shows
    const scale = half / VIEW;

    ctx.clearRect(0, 0, size, size);

    // Everything is drawn relative to you, and rotated so that
    // "up" on the minimap is always the way you're facing.
    const toMap = (x, z) => {
      const dx = x - player.position.x;
      const dz = z - player.position.z;
      const cos = Math.cos(-player.yaw);
      const sin = Math.sin(-player.yaw);
      return { x: half + (dx * cos - dz * sin) * scale, y: half + (dx * sin + dz * cos) * scale };
    };

    // --- THE SAFE CIRCLE ---
    if (storm) {
      const c = toMap(storm.center.x, storm.center.z);
      ctx.strokeStyle = "#ff4fd8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, storm.radius * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- CHESTS you haven't opened yet ---
    ctx.fillStyle = "#ffc02e";
    for (const chest of chests) {
      if (chest.opened) continue;
      const p = toMap(chest.position.x, chest.position.z);
      ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    }

    // --- ENEMIES --- only ones close enough to realistically notice.
    ctx.fillStyle = "#ff4b4b";
    for (const bot of bots) {
      if (!bot.alive) continue;
      if (player.position.distanceTo(bot.position) > 60) continue;
      const p = toMap(bot.position.x, bot.position.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- YOU --- an arrow, always in the middle, always pointing up.
    ctx.fillStyle = "#ffd90f";
    ctx.beginPath();
    ctx.moveTo(half, half - 8);
    ctx.lineTo(half - 5.5, half + 6);
    ctx.lineTo(half + 5.5, half + 6);
    ctx.closePath();
    ctx.fill();
  }

  setReloading(isReloading) {
    this.reloadingEl.style.visibility = isReloading ? "visible" : "hidden";
  }

  flashHurt() {
    this.hurt.style.opacity = "1";
    setTimeout(() => (this.hurt.style.opacity = "0"), 130);
  }

  /** Adds a line to the kill feed, like "TurboLlama 💥 GhostYeti". */
  addKill(killerName, victimName, killerIsYou, victimIsYou) {
    const line = document.createElement("div");
    const killer = killerIsYou ? `<span class="you">${killerName}</span>` : killerName;
    const victim = victimIsYou ? `<span class="you">${victimName}</span>` : victimName;
    line.innerHTML = `${killer} &nbsp;💥&nbsp; ${victim}`;
    this.feed.prepend(line);
    // Only keep the newest 6 so it doesn't fill the screen.
    while (this.feed.children.length > 6) this.feed.lastChild.remove();
    setTimeout(() => line.remove(), 7000);
  }

  showEnd({ won, place, total, kills }) {
    this.root.querySelector("#endTitle").textContent = won ? "VICTORY!" : "ELIMINATED";
    this.root.querySelector("#endTitle").style.color = won ? "#ffd90f" : "#ff6b6b";
    this.root.querySelector("#endPlace").textContent = won
      ? `#1 of ${total}`
      : `#${place} of ${total}`;
    this.root.querySelector("#endStats").textContent =
      `${kills} elimination${kills === 1 ? "" : "s"}`;
    this.endScreen.style.display = "flex";
    document.exitPointerLock?.();
  }
}
