// ============================================================
//   ★ THIS IS YOUR FILE, AANSH ★
//   Every fun number in the whole game lives here.
//   Change a number, save the file, and the game updates
//   INSTANTLY in your browser. Nothing here can break the
//   game permanently -- if it goes weird, just change it back.
// ============================================================

export const CONFIG = {
  // ---------- WHO YOU ARE ----------
  PLAYER_NAME: "Buzz",
  TOWN_NAME: "Springfield",

  // ---------- HOW BUZZ MOVES ----------
  // Try WALK_SPEED: 30 for a super speed cheat. It's very funny.
  WALK_SPEED: 9, // how fast you run (normal)
  SPRINT_SPEED: 15, // how fast you run holding Shift
  JUMP_POWER: 11, // how high you jump. Try 30. Trust me.
  GRAVITY: 30, // how hard you get pulled down. Lower = moon jump!
  TURN_SPEED: 0.0022, // how fast the camera turns when you move the mouse

  // ---------- THE CAMERA (the "eye" floating behind Buzz) ----------
  CAMERA_DISTANCE: 7, // how far behind you the camera sits
  CAMERA_HEIGHT: 2.4, // how high above you it sits
  CAMERA_SIDE: 1.1, // how far to the right (over-the-shoulder, like Fortnite)

  // ---------- WHAT BUZZ LOOKS LIKE ----------
  // Colors are hex codes: 0x + red + green + blue. Google "hex color picker"
  // to find any color you want, then paste the 6 letters/numbers after 0x.
  PLAYER_SKIN: 0xffd90f, // cartoon yellow
  PLAYER_SHIRT: 0x1e90ff, // blue shirt
  PLAYER_PANTS: 0x2f4858, // dark pants
  PLAYER_HEIGHT: 1.8, // how tall Buzz is, in meters

  // ---------- THE TOWN ----------
  MAP_SIZE: 400, // how wide the whole map is. Bigger = longer matches,
  //   because 50 people packed onto a small map all find each other
  //   in the first minute and wipe each other out.
  FLAT_TOWN_RADIUS: 100, // inside this circle the ground is flat (the town)
  FULL_HILLS_RADIUS: 175, // by here the hills are at full height
  BLOCK_SIZE: 40, // how big one city block is
  ROAD_WIDTH: 9,
  GRASS_COLOR: 0x6ab04c,
  ROAD_COLOR: 0x53565c,
  SKY_COLOR: 0x87ceeb,

  // ---------- THE MATCH ----------
  TOTAL_PLAYERS: 50, // you + 49 bots
  MAX_HEALTH: 100,
  REGEN_PER_SECOND: 4, // how fast YOU heal once nobody's shooting you
  REGEN_DELAY: 6, // seconds of peace before healing kicks in
  GRACE_PERIOD: 5, // seconds at the start where NOBODY can shoot.
  //   ^ Time to get your bearings before the fighting starts.
  //     Make it 10 if you want longer, or 0 for instant chaos.

  // ---------- SHOOTING ----------
  FIRE_RATE: 0.14, // seconds between shots. Smaller = faster gun!
  BULLET_DAMAGE: 24, // how much one hit takes off
  HEADSHOT_MULTIPLIER: 2, // headshots do double damage
  GUN_RANGE: 160, // how far bullets reach
  MAG_SIZE: 30, // bullets before you have to reload
  RELOAD_TIME: 1.6, // seconds to reload
  SPREAD_STANDING: 0.008, // how much your aim wobbles standing still
  SPREAD_MOVING: 0.035, // how much it wobbles while running

  // ---------- THE 49 BOTS ----------
  BOT_COUNT: 49,
  BOT_VIEW_DISTANCE: 26, // how far a bot can see you.
  //   ^ Careful with this one! We tried 70 and the whole lobby wiped
  //     itself out in 15 seconds, because every bot could see across
  //     the entire town at once. Smaller = longer, sneakier matches.
  BOT_FIELD_OF_VIEW: 1.9, // how WIDE a bot can see, in radians (~110 degrees)
  //   ^ this is why you can sneak up behind them!
  HEARING_RANGE: 40, // how far away a bot can hear a gunshot.
  //   ^ This one is sneaky-important. At 70 the match imploded: one
  //     fight pulled in every bot nearby, THAT made more noise, which
  //     pulled in even more... and the whole lobby died in a minute.
  BOT_WALK_SPEED: 7.5,
  BOT_CHASE_SPEED: 11,
  BOT_BULLET_DAMAGE: 9, // bots hit softer than you do (you do 20+).
  //   ^ Classic game design trick: it makes YOU feel strong and gives
  //     you time to react instead of dying instantly to 3 bots at once.
  BOT_ROAM_RADIUS: 170, // how far across the map bots wander. Keeps them
  //   spread out instead of all piling into the town centre and brawling.
  BOT_GIVE_UP_TIME: 7, // seconds chasing someone they can't see before quitting
  BOT_INVESTIGATE_COOLDOWN: 14, // after checking out one fight, a bot
  //   ignores gunshots for this long. Stops the snowball.
  BOT_REGEN_PER_SECOND: 4, // health slowly returns when out of a fight
  BOT_REGEN_DELAY: 6, // ...but only after this many seconds of peace
  BOT_FLEE_HEALTH: 0.3, // below 30% health a bot breaks off and runs away
  BOT_FLEE_TIME: 6, // how long it stays scared and keeps running
  BOT_FLEE_COOLDOWN: 16, // after running away once, it must stand and
  //   fight for this long before it's allowed to run again

  // The skill mix -- like a real lobby. These must add up to BOT_COUNT.
  // "reaction" = seconds before they start shooting after spotting you
  // "spread"   = how badly they miss (bigger = worse aim)
  BOT_SKILLS: [
    { name: "Rookie", count: 10, reaction: 0.8, spread: 0.1, aggression: 0.3 },
    { name: "Normal", count: 29, reaction: 0.5, spread: 0.062, aggression: 0.5 },
    { name: "Good", count: 8, reaction: 0.3, spread: 0.036, aggression: 0.75 },
    { name: "Beast", count: 2, reaction: 0.18, spread: 0.02, aggression: 0.95 },
  ],

  // ---------- CROUCHING ----------
  CROUCH_SPEED: 4.5, // how fast you move while crouched (slow!)
  CROUCH_HEIGHT: 0.62, // how squashed you get -- 0.62 = 62% of normal height
  CROUCH_ACCURACY_BONUS: 0.45, // aim wobble is multiplied by this. Lower = better.

  // ---------- MED KITS ----------
  MEDKIT_COUNT: 30, // how many are scattered around the map
  MEDKIT_HEAL_TIME: 5, // seconds you must stand still to use one
  MEDKIT_HEAL_AMOUNT: 100, // heals you all the way back to full
  MEDKIT_MAX_CARRIED: 3, // how many you can carry at once

  // ---------- LOOT AND CHESTS ----------
  CHEST_COUNT: 26, // gold chests hidden around town. Best loot in the game.
  FLOOR_LOOT_COUNT: 55, // weaker guns lying on the ground
  PICKUP_RANGE: 3.2, // how close you must be to grab something
  INVENTORY_SLOTS: 3, // how many guns you can carry (keys 1, 2, 3)

  // ---------- THE PINK STORM ----------
  STORM_COLOR: 0xff4fd8, // hot pink, like Aansh picked
  STORM_DAMAGE_PER_SECOND: 4, // how fast the storm hurts you outside the circle
  STORM_START_DELAY: 25, // seconds of calm before the storm starts closing
  STORM_PHASES: 6, // how many times it shrinks
  STORM_SHRINK_TIME: 32, // seconds each shrink takes
  STORM_REST_TIME: 18, // seconds of calm between shrinks
  STORM_START_RADIUS: 185, // how big the safe circle starts
  STORM_DAMAGE_RAMP: 1.8, // storm hurts MORE in later phases

  // ---------- FALLING IN AT THE START ----------
  SKYDIVE_HEIGHT: 95, // how high above the map you start
  SKYDIVE_FALL_SPEED: 26, // how fast you drop
  SKYDIVE_GLIDE_SPEED: 22, // how fast you can steer while falling
};
