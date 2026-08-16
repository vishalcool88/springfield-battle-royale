# 🍩 Springfield Battle Royale

A 3D cartoon battle royale in the browser. You're **Buzz**. So are 49 bots,
sort of. Last one standing out of 50 wins.

Built by Aansh (age 11) with Claude Code.

![Springfield](screenshots/README.md)

## Play it

```bash
npm install
npm run dev
```

Then open **http://localhost:5173** in Chrome.

The game starts the moment the page loads — there's no "click to play"
screen. Click once if you want smooth mouse aiming; otherwise the arrow
keys work fine.

## Controls

Press **H** in-game for the full list.

| Key | Action |
|---|---|
| `W A S D` | Run |
| `Shift` | Sprint |
| `C` | Crouch — slower, but harder to hit and steadier aim |
| `Space` | Jump |
| Mouse / `↑ ← ↓ →` | Look around |
| Click / `Enter` | Shoot |
| `R` | Reload |
| `1` `2` `3` | Switch weapon |
| `E` | Open a chest · grab a gun · take a med kit |
| `Q` | Use a med kit (stand still 5 seconds) |
| `P` / `Shift+P` | Screenshot / clean screenshot |
| `H` | Controls panel |

## How a match goes

1. **Skydive in** from 95 metres up. Steer with WASD to pick your landing spot.
2. **5-second countdown** — nobody can shoot, including you. Get your bearings.
3. **Loot.** 26 gold chests, 55 guns on the ground, 30 med kits. Chests give
   far better rarities than floor loot — about 20% legendary versus 4%.
4. **Fight.** 17 weapons across 5 rarity tiers, from a Common Slingshot to a
   Legendary Minigun.
5. **The pink storm** closes in over 6 phases. Stay in the circle.
6. **Last of 50 wins.** A full match runs about 3–4 minutes.

## The bots

49 of them, and the rule is: **they don't cheat.**

- **Vision cones**, roughly as wide as a person's — so you really can sneak
  up behind someone
- **No seeing through walls** — every sighting is line-of-sight checked
- **Reaction delays** of 0.18–0.8 seconds, so spotting someone first matters
- **Imperfect aim** that gets worse while they're moving
- **Four skill tiers** in one lobby: 10 Rookies, 29 Normal, 8 Good, 2 Beasts
- **Third-partying** — they hear gunfire and come looking
- **They flee** when badly hurt, heal up, and come back
- **They loot** — chests and floor guns, same as you

## Making it yours

Everything tunable lives in [`src/config.js`](src/config.js), commented in
plain English. Some good ones:

```js
GRAVITY: 4              // moon jumps
WALK_SPEED: 40          // super speed
BOT_COUNT: 5            // a quieter afternoon
CHEST_COUNT: 200        // absolute chaos
GRACE_PERIOD: 15        // more time to get set up
```

Save the file and the game updates instantly — no restart.

There's also a console menu: press **F12**, click Console, and try
`game.CONFIG.GRAVITY = 4`. Nothing you type there can break anything
permanently; refreshing resets it.

## How the code is laid out

| File | What it does |
|---|---|
| `main.js` | Starts everything, runs the game loop |
| `config.js` | ★ Every tunable number in the game |
| `world.js` | Springfield — streets, houses, the donut shop |
| `terrain.js` | Ground height: flat in town, hills outside |
| `character.js` | The blocky people, and how they animate |
| `player.js` | You: movement, camera, shooting, looting |
| `bots.js` | The 49 opponents and their brains |
| `combat.js` | Bullets, hitboxes, line of sight |
| `weapons.js` | 17 weapons, rarities, chests, med kits |
| `storm.js` | The pink storm |
| `physics.js` | Walls, gravity, standing on roofs |
| `ui.js` | HUD, minimap, kill feed, controls panel |
| `sounds.js` | Sound effects, built from raw waveforms |
| `toon.js` | The black cartoon outlines |
| `screenshot.js` | P and Shift+P |

Built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/).
No 3D model files — every character and building is made of boxes, spheres
and cones assembled in code.
