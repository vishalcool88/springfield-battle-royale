// ============================================================
//   SOUNDS
//   We don't download any sound files -- we BUILD the sounds out
//   of raw sound waves in the browser. A gunshot is basically a
//   short burst of static, and a chest chime is a few clean beeps.
//
//   Browsers won't play any sound until you click or press a key
//   once (it's an anti-annoying-website rule), so everything stays
//   silent until then and switches on automatically.
// ============================================================

export class Sounds {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.noiseBuffer = null;
  }

  /** Called after the first click/keypress, when browsers allow audio. */
  wake() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) { this.enabled = false; return; }
    this.ctx = new AudioCtx();

    // Pre-make one second of static -- reused for every gunshot.
    const samples = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, samples, samples);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
  }

  get ready() { return this.enabled && this.ctx && this.ctx.state === "running"; }

  /** A short burst of filtered static = a gunshot. */
  bang({ volume = 0.25, duration = 0.14, cutoff = 1400, drop = 400 } = {}) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    // A lowpass filter sweeping downward makes it "thump" instead of "hiss".
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(drop, now + duration);

    // The gain envelope: loud instantly, then fade out fast.
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter).connect(gain).connect(this.ctx.destination);
    source.start(now);
    source.stop(now + duration);
  }

  /** A clean musical beep. Used for pickups and chest chimes. */
  beep(frequency, { volume = 0.16, duration = 0.12, type = "sine", delay = 0 } = {}) {
    if (!this.ready) return;
    const now = this.ctx.currentTime + delay;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  // ---------- THE ACTUAL GAME SOUNDS ----------

  shoot(weapon) {
    // Big weapons get a deeper, longer bang.
    const heavy = weapon.spec.damage > 50;
    const shotgun = weapon.spec.pellets > 1;
    this.bang({
      volume: heavy ? 0.32 : 0.22,
      duration: heavy ? 0.26 : shotgun ? 0.2 : 0.12,
      cutoff: heavy ? 900 : shotgun ? 1100 : 1800,
      drop: heavy ? 160 : 380,
    });
  }

  hit() { this.beep(880, { volume: 0.1, duration: 0.05, type: "square" }); }

  pickup() {
    this.beep(660, { duration: 0.09 });
    this.beep(990, { duration: 0.12, delay: 0.07 });
  }

  /** A happy little arpeggio when you open a chest. */
  chest() {
    [523, 659, 784, 1047].forEach((note, i) =>
      this.beep(note, { duration: 0.16, delay: i * 0.075, volume: 0.14 })
    );
  }

  eliminate() {
    this.beep(300, { duration: 0.18, type: "sawtooth", volume: 0.14 });
    this.beep(200, { duration: 0.25, type: "sawtooth", volume: 0.12, delay: 0.1 });
  }

  victory() {
    [523, 659, 784, 1047, 1319].forEach((note, i) =>
      this.beep(note, { duration: 0.3, delay: i * 0.13, volume: 0.18 })
    );
  }

  defeat() {
    [440, 370, 294, 220].forEach((note, i) =>
      this.beep(note, { duration: 0.35, delay: i * 0.16, volume: 0.15, type: "triangle" })
    );
  }

  /** Ticking warning while you're caught out in the storm. */
  stormTick() { this.beep(180, { duration: 0.08, type: "sawtooth", volume: 0.08 }); }
}
