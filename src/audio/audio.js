// DUSK APEX — procedural WebAudio (§28). No audio files at all: engine,
// skid, kerb, wind, impacts and UI sounds are synthesised, so the build
// stays tiny and there are no sound-effect licences to manage.
// Every failure degrades to silence — audio can never block gameplay (§39).

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ok = false;
    this.volumes = { master: 0.8, engine: 0.9, sfx: 0.8, music: 0.3 };
    this.muted = false;
    this._engineNodes = null;
    this._musicNodes = null;
  }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    if (!this.ok) return;
    try {
      const t = this.ctx.currentTime;
      this.master.gain.setValueAtTime(this.muted ? 0 : this.volumes.master, t);
      this.engineBus.gain.setValueAtTime(this.volumes.engine, t);
      this.sfxBus.gain.setValueAtTime(this.volumes.sfx, t);
      this.musicBus.gain.setValueAtTime(this.volumes.music, t);
    } catch (e) { /* noop */ }
  }
  setMuted(m) { this.muted = m; this.setVolumes({}); }

  /** Must be called from a user gesture at least once. Safe to call again. */
  init() {
    if (this.ok) { try { this.ctx.resume(); } catch (e) { /* noop */ } return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.connect(ctx.destination);
      this.engineBus = ctx.createGain(); this.engineBus.connect(this.master);
      this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
      // shared noise buffer
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.ok = true;
      this.setVolumes({});
      return true;
    } catch (e) {
      this.ok = false;
      return false;
    }
  }

  _noiseLoop(filterType, freq, q = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start();
    return { src, f, g };
  }

  startEngine() {
    if (!this.ok || this._engineNodes) return;
    try {
      const ctx = this.ctx;
      const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth';
      const osc2 = ctx.createOscillator(); osc2.type = 'square';
      const sub = ctx.createOscillator(); sub.type = 'sine';
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 2.2;
      const gain = ctx.createGain(); gain.gain.value = 0;
      osc1.connect(filter); osc2.connect(filter); sub.connect(filter);
      filter.connect(gain); gain.connect(this.engineBus);
      osc1.start(); osc2.start(); sub.start();
      const skid = this._noiseLoop('bandpass', 850, 1.4);
      const kerb = this._noiseLoop('lowpass', 240, 0.8);
      const wind = this._noiseLoop('lowpass', 500, 0.5);
      this._engineNodes = { osc1, osc2, sub, filter, gain, skid, kerb, wind };
    } catch (e) { /* silent */ }
  }

  stopEngine() {
    if (!this._engineNodes) return;
    try {
      const n = this._engineNodes;
      n.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      const stopAt = this.ctx.currentTime + 0.35;
      n.osc1.stop(stopAt); n.osc2.stop(stopAt); n.sub.stop(stopAt);
      n.skid.src.stop(stopAt); n.kerb.src.stop(stopAt); n.wind.src.stop(stopAt);
    } catch (e) { /* noop */ }
    this._engineNodes = null;
  }

  /** rpm01 0..1, throttle 0..1, slip 0..1, kerbAmt 0..1, speed01 0..1 */
  updateEngine(rpm01, throttle, slip, kerbAmt, speed01) {
    if (!this.ok || !this._engineNodes) return;
    try {
      const n = this._engineNodes;
      const t = this.ctx.currentTime;
      const f = 62 + Math.pow(rpm01, 1.25) * 430;
      n.osc1.frequency.setTargetAtTime(f, t, 0.03);
      n.osc2.frequency.setTargetAtTime(f * 1.5 + 4, t, 0.03);
      n.sub.frequency.setTargetAtTime(f * 0.5, t, 0.03);
      n.filter.frequency.setTargetAtTime(380 + rpm01 * 2700 + throttle * 500, t, 0.05);
      n.gain.gain.setTargetAtTime(0.075 + throttle * 0.1 + rpm01 * 0.045, t, 0.06);
      n.skid.g.gain.setTargetAtTime(Math.min(slip, 1) * 0.14, t, 0.05);
      n.kerb.g.gain.setTargetAtTime(kerbAmt * 0.2, t, 0.03);
      n.wind.g.gain.setTargetAtTime(Math.pow(speed01, 2) * 0.075, t, 0.1);
      n.wind.f.frequency.setTargetAtTime(300 + speed01 * 700, t, 0.1);
    } catch (e) { /* noop */ }
  }

  crash(intensity = 0.5) {
    if (!this.ok) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      const g = ctx.createGain();
      const amp = Math.min(0.24 + intensity * 0.5, 0.75);
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      src.connect(f); f.connect(g); g.connect(this.sfxBus);
      src.start(t); src.stop(t + 0.35);
      const thump = ctx.createOscillator(); thump.type = 'sine';
      thump.frequency.setValueAtTime(110, t);
      thump.frequency.exponentialRampToValueAtTime(38, t + 0.25);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(amp * 0.8, t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      thump.connect(tg); tg.connect(this.sfxBus);
      thump.start(t); thump.stop(t + 0.3);
    } catch (e) { /* noop */ }
  }

  shift() {
    if (!this.ok) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(g); g.connect(this.sfxBus);
      o.start(t); o.stop(t + 0.09);
    } catch (e) { /* noop */ }
  }

  beep(final = false) {
    if (!this.ok) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = final ? 990 : 620;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (final ? 0.4 : 0.18));
      o.connect(g); g.connect(this.sfxBus);
      o.start(t); o.stop(t + (final ? 0.42 : 0.2));
    } catch (e) { /* noop */ }
  }

  click() {
    if (!this.ok) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1250;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.connect(g); g.connect(this.sfxBus);
      o.start(t); o.stop(t + 0.06);
    } catch (e) { /* noop */ }
  }

  startMusic() {
    if (!this.ok || this._musicNodes) return;
    try {
      const ctx = this.ctx;
      const g = ctx.createGain(); g.gain.value = 0;
      g.gain.setTargetAtTime(0.05, ctx.currentTime, 1.2);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650;
      f.connect(g); g.connect(this.musicBus);
      const oscs = [110, 164.81, 220, 277.18].map((fr) => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
        o.connect(f); o.start(); return o;
      });
      this._musicNodes = { oscs, g };
    } catch (e) { /* noop */ }
  }
  stopMusic() {
    if (!this._musicNodes) return;
    try {
      const t = this.ctx.currentTime;
      this._musicNodes.g.gain.setTargetAtTime(0, t, 0.25);
      const oscs = this._musicNodes.oscs;
      window.setTimeout(() => { try { oscs.forEach((o) => o.stop()); } catch (e) { /* noop */ } }, 900);
    } catch (e) { /* noop */ }
    this._musicNodes = null;
  }
}
