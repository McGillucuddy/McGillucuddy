'use strict';
// Synthesized sound: engine, guns, blasts and the rest, built from oscillators and noise. No asset files needed.
// Everything loud also feeds a short generated reverb (the slap off concrete), and things that happen away from you
// (explosions, rival fire) are quieter and more muffled the further off they are (Sound.listener, set each frame).

// Each gun's report: body filter frequency f and length d, the thump's pitch lo, levels, and the reverb send; sub
// is the low drop you feel in your chest more than hear, tail the report rolling away off the buildings, and duck
// how far the engine, the music and the weather dip under the shot so it cuts through everything.
const GUN_SOUND = {
  pistol: { f: 1500, d: 0.12, lo: 140, crack: 0.42, body: 0.36, thump: 0.24, sub: 0.18, tail: 0.06, wet: 0.4, mech: 0.05, duck: 0.25 },
  smg: { f: 2100, d: 0.07, lo: 170, crack: 0.3, body: 0.22, thump: 0.13, sub: 0.06, wet: 0.28, mech: 0.05, duck: 0.12 },
  drum: { f: 1900, d: 0.08, lo: 150, crack: 0.3, body: 0.24, thump: 0.15, sub: 0.07, wet: 0.28, mech: 0.05, duck: 0.12 },
  carbine: { f: 1900, d: 0.11, lo: 120, crack: 0.4, body: 0.3, thump: 0.2, sub: 0.12, tail: 0.04, wet: 0.38, mech: 0.04, duck: 0.18 },
  liberty: { f: 1100, d: 0.3, lo: 80, crack: 0.55, body: 0.5, thump: 0.4, sub: 0.45, tail: 0.18, wet: 0.6, duck: 0.55 },
  typewriter: { f: 1600, d: 0.08, lo: 150, crack: 0.28, body: 0.22, thump: 0.12, sub: 0.07, wet: 0.24, mech: 0.08, duck: 0.12 },
  lmg: { f: 1200, d: 0.13, lo: 95, crack: 0.4, body: 0.36, thump: 0.24, sub: 0.18, tail: 0.05, wet: 0.38, mech: 0.05, duck: 0.2 },
  pangun: { f: 1050, d: 0.14, lo: 85, crack: 0.4, body: 0.36, thump: 0.26, sub: 0.2, tail: 0.06, wet: 0.38, mech: 0.05, duck: 0.22 },
  shotgun: { f: 850, d: 0.3, lo: 70, crack: 0.6, body: 0.6, thump: 0.45, sub: 0.6, tail: 0.22, wet: 0.55, duck: 0.65 },
};

// Each gun's report drawn sample by sample, once, into a buffer (three takes per gun, played back a little faster
// or slower each shot so automatic fire never loops): a hard crack, the blast of hot gas through a closing filter,
// a dropping boom with a sub under it, all driven into a soft clipper (that's what makes a gun sound loud on small
// speakers), the action cycling, then the report slapping back off the buildings and rolling away down the street.
function renderGun(G, sr, seed) {
  let r = seed >>> 0 || 1; const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296 * 2 - 1; };
  const n = Math.floor(sr * (0.55 + (G.tail || 0) * 2)), x = new Float32Array(n), body = new Float32Array(n);
  const drive = 1.6 + (G.sub || 0) * 4 + (G.body || 0) * 1.5;
  let hp = 0, prev = 0, l1 = 0, l2 = 0, ph = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = rnd();
    // Crack: a millisecond of bright noise.
    const cr = t < 0.008 ? w * Math.exp(-t / 0.0013) : 0;
    hp = 0.82 * (hp + cr - prev); prev = cr;
    // Blast: noise through a two-pole low-pass that closes as the gas cools.
    const fc = G.f * Math.exp(-t / (G.d * 0.55)) + 180, a = 1 - Math.exp(-TAU * fc / sr);
    const env = (1 - Math.exp(-t / 0.0004)) * Math.exp(-t / (G.d * 0.32));
    l1 += a * (w * env - l1); l2 += a * (l1 - l2);
    body[i] = l2;
    // Boom: a sine dropping from a punch to a thud; the sub sits under it, longer.
    ph += TAU * (G.lo * 0.55 + G.lo * 1.9 * Math.exp(-t / 0.011)) / sr;
    ph2 += TAU * (G.lo * 0.42) / sr;
    const boom = Math.sin(ph) * (G.thump || 0) * 0.6 * Math.exp(-t / (0.035 + G.d * 0.25)) * Math.min(1, t / 0.0008);
    const sub = Math.sin(ph2) * (G.sub || 0) * 0.45 * Math.exp(-t / (0.07 + G.d * 0.2)) * Math.min(1, t / 0.003);
    const mix = hp * (G.crack || 0) * 2.2 + l2 * (G.body || 0) * 11 + boom + sub;
    x[i] = Math.tanh(mix * drive) / Math.tanh(drive);
  }
  // The action: a clack and its echo as the bolt cycles.
  if (G.mech) for (const [at, f, k] of [[0.032, 2900, 1], [0.05, 1800, 0.6]]) {
    const s0 = Math.floor((at + rnd() * 0.004) * sr);
    for (let i = 0; i < sr * 0.012 && s0 + i < n; i++) { const t = i / sr; x[s0 + i] += Math.sin(TAU * f * t) * Math.exp(-t / 0.0022) * G.mech * 3.5 * k; }
  }
  // Slapback off the walls: muffled copies of the blast, later and quieter.
  const slap = 0.22 + (G.tail || 0) * 1.4;
  for (const [at, k] of [[0.065, 0.42], [0.14, 0.26], [0.24, 0.15], [0.37, 0.08]]) {
    const s0 = Math.floor((at + rnd() * 0.01) * sr); let lp = 0;
    for (let i = 0; i + s0 < n && i < sr * 0.15; i++) { lp += 0.12 * (x[i] - lp); x[s0 + i] += lp * slap * k; }
  }
  // The roll: low rumble trailing off down the street.
  if (G.tail) { let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += 0.03 * (rnd() - lp); x[i] += lp * G.tail * 3.5 * Math.min(1, t / 0.03) * Math.exp(-t / (0.2 + G.tail * 2)); } }
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(x[i]));
  for (let i = 0; i < n; i++) { x[i] *= 0.95 / (pk || 1); if (i > n - 400) x[i] *= (n - i) / 400; }
  return x;
}

const Sound = {
  ctx: null,
  muted: false,
  volume: 1,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5 * this.volume;
    // A compressor at the end: the guns can hit hard without clipping, and everything else sits under them.
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -12; this.comp.knee.value = 8; this.comp.ratio.value = 4; this.comp.attack.value = 0.003; this.comp.release.value = 0.18;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    // The bed: the engine, the music and the weather, which dip under your own shots (Sound.duck).
    this.bed = c.createGain(); this.bed.connect(this.master);

    const len = c.sampleRate * 0.5;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.buildEngine(c);

    // The reverb: a stereo impulse of decaying noise with an early reflection, like a shot off a wall of concrete.
    const rl = Math.floor(c.sampleRate * 1.3), ir = c.createBuffer(2, rl, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const x = ir.getChannelData(ch);
      for (let i = 0; i < rl; i++) {
        const tt = i / c.sampleRate;
        x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.2) * (tt < 0.012 ? 0 : 1);
      }
      const slap = Math.floor(c.sampleRate * (0.045 + ch * 0.013));
      for (let i = 0; i < 300; i++) x[slap + i] += (Math.random() * 2 - 1) * 0.9 * (1 - i / 300);
    }
    this.verb = c.createConvolver(); this.verb.buffer = ir;
    this.verbIn = c.createGain(); this.verbIn.gain.value = 1;
    const wet = c.createGain(); wet.gain.value = 1.4;
    this.verbIn.connect(this.verb); this.verb.connect(wet); wet.connect(this.master);
    this.gear = 0;
  },

  // How loud and how muffled something at (x, y) is from where you are (1 and wide open when close).
  far(ev) {
    const L = this.listener;
    if (!L || ev.x == null) return { vol: 1, cut: 18000 };
    const d = Math.hypot(ev.x - L.x, ev.y - L.y);
    return { vol: Math.max(0.08, 1 / (1 + d / 380)), cut: Math.max(500, 16000 / (1 + d / 120)) };
  },

  // A noise layer: band-passed (or low-passed), swept, with an envelope; optionally sent to the reverb.
  layer(o) {
    const c = this.ctx, t = c.currentTime + (o.at || 0);
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = o.dur > 0.45;
    src.playbackRate.value = o.rate || 1;
    const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q || 0.9;
    f.frequency.setValueAtTime(o.f, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol, t + (o.atk || 0.002)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let last = g;
    if (o.cut && o.cut < 16000) { const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.cut; g.connect(lp); last = lp; }
    src.connect(f); f.connect(g);
    last.connect(this.master);
    if (o.wet) { const s = c.createGain(); s.gain.value = o.wet; last.connect(s); s.connect(this.verbIn); }
    src.start(t, Math.random() * 0.3); src.stop(t + o.dur + 0.05);
  },
  // A pitched thump: a sine dropping in pitch (the chest-punch under a shot or a blast).
  thump(f0, f1, dur, vol, wet, at) {
    const c = this.ctx, t = c.currentTime + (at || 0), o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    if (wet) { const s = c.createGain(); s.gain.value = wet; g.connect(s); s.connect(this.verbIn); }
    o.start(t); o.stop(t + dur + 0.05);
  },

  // A gun going off: the crack (a hard transient), the body of the report, the thump under it, the action cycling,
  // and the slap back off the walls. Each shot is detuned a little so automatic fire doesn't sound like a loop.
  gunshot(w) {
    const G = GUN_SOUND[w] || GUN_SOUND.smg, c = this.ctx;
    const bufs = (this.gunBufs = this.gunBufs || {})[w] || (this.gunBufs[w] = [1, 2, 3].map((k) => { // drawn once (renderGun, above)
      const x = renderGun(G, c.sampleRate, k * 7919 + w.length * 31), b = c.createBuffer(1, x.length, c.sampleRate);
      b.getChannelData(0).set(x);
      return b;
    }));
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = bufs[Math.floor(Math.random() * bufs.length)];
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    g.gain.value = G.level || 0.95;
    src.connect(g); g.connect(this.master);
    const s = c.createGain(); s.gain.value = G.wet * 0.45; g.connect(s); s.connect(this.verbIn); // the room it's fired in
    src.start();
    this.duck(G.duck || 0.1);
  },
  // Everything else dips for a moment under your shot, then swells back.
  duck(k) {
    if (!this.bed) return;
    const g = this.bed.gain, t = this.ctx.currentTime, now = Math.min(1, g.value);
    g.cancelScheduledValues(t); g.setValueAtTime(now, t); g.linearRampToValueAtTime(Math.min(now, 1 - k), t + 0.008); g.setTargetAtTime(1, t + 0.05, 0.1 + k * 0.15);
  },
  // The launchers: the rocket's motor lighting with a bang and a roar, the harpoon's spring and its line paying
  // out, the flare's pop and fizz, the nail gun's air hammer.
  launch(w) {
    if (w === 'rocket') {
      this.layer({ f: 4200, type: 'highpass', dur: 0.02, vol: 0.5, q: 0.5 });
      this.thump(130, 32, 0.5, 0.7, 0.5);
      this.layer({ f: 1600, to: 180, type: 'lowpass', dur: 0.8, vol: 0.55, atk: 0.006, q: 0.6, wet: 0.6 }); // the backblast roar
      this.layer({ f: 3200, to: 1400, dur: 0.6, vol: 0.14, at: 0.05, atk: 0.04, q: 1.2 }); // the motor's hiss going away
      this.duck(0.75);
    } else if (w === 'harpoon') {
      this.layer({ f: 4000, type: 'highpass', dur: 0.015, vol: 0.4, q: 0.5 });
      this.thump(170, 50, 0.2, 0.7, 0.35);
      this.layer({ f: 1900, dur: 0.08, vol: 0.5, q: 5 }); // the clank of the spring letting go
      this.layer({ f: 3400, to: 1100, dur: 0.4, vol: 0.09, at: 0.03, atk: 0.02, q: 3 }); // the line whipping out
      this.tone(98, 0.3, 'sawtooth', 0.05);
      this.duck(0.4);
    } else if (w === 'flare') {
      this.layer({ f: 3000, type: 'highpass', dur: 0.015, vol: 0.55, q: 0.5 });
      this.thump(220, 60, 0.16, 0.6, 0.4);
      this.layer({ f: 2200, to: 700, dur: 0.5, vol: 0.12, at: 0.03, atk: 0.03, q: 1, wet: 0.3 }); // the fizz
      this.duck(0.3);
    } else if (w === 'nail') {
      this.layer({ f: 5000, type: 'highpass', dur: 0.01, vol: 0.3, q: 0.5 }); // the hammer striking
      this.layer({ f: 2600 * (0.9 + Math.random() * 0.2), dur: 0.045, vol: 0.4, q: 1.5 });
      this.thump(260, 100, 0.05, 0.3);
      this.layer({ f: 6500, type: 'highpass', dur: 0.07, vol: 0.1, at: 0.01, q: 0.5 }); // the air
      this.duck(0.06);
    }
  },
  // An explosion: a sub-bass drop, a long roar, crackle, and debris pattering down after; muffled with distance.
  boom(ev) {
    const F = this.far(ev), big = !!ev.big, v = F.vol;
    this.thump(big ? 90 : 120, 28, big ? 1.1 : 0.7, (big ? 0.9 : 0.6) * v, 0.5);
    this.layer({ f: 900, to: 90, type: 'lowpass', dur: big ? 1.4 : 0.9, vol: (big ? 0.75 : 0.5) * v, q: 0.5, cut: F.cut, wet: 0.6, atk: 0.006 });
    this.layer({ f: 3000, to: 600, dur: 0.15, vol: 0.4 * v, cut: F.cut, wet: 0.3 });
    for (let i = 0; i < (big ? 14 : 8); i++) this.layer({ f: 1500 + Math.random() * 3000, dur: 0.02, vol: (0.05 + Math.random() * 0.1) * v, at: 0.08 + Math.random() * 0.8, q: 2, cut: F.cut });
    for (let i = 0; i < (big ? 6 : 3); i++) this.layer({ f: 2600 + Math.random() * 2000, dur: 0.05, vol: 0.06 * v, at: 0.5 + Math.random() * 0.9, q: 6, cut: F.cut }); // bits landing
  },

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5 * this.volume;
    return this.muted;
  },

  // The engine: a big supercharged V8 with straight-through pipes. One whole engine cycle (two turns of the crank,
  // eight firings) is drawn as a waveform and played at the cycle's rate, so the pitch follows the revs and the
  // character comes with it: the cross-plane crank fires each bank unevenly (that's the lope, the burble), and each
  // bank has its own pipe, left and right. It goes through a fuzz (harder on the throttle) and an exhaust filter that
  // opens up with the revs. On top: the blower's whine (it screams with the nitro in), the intake roaring under
  // load, the road, and pops and crackles out of the pipes when the throttle's snapped shut at speed.
  buildEngine(c) {
    // One cycle per bank: firing order 1-8-4-3-6-5-7-2 every 90 degrees; odd cylinders are the left bank.
    const ORDER = [1, 8, 4, 3, 6, 5, 7, 2], N = 2048, H = 80;
    const wave = (bank, seed) => {
      let r = seed; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
      const x = new Float32Array(N);
      ORDER.forEach((cyl, k) => {
        if ((cyl % 2 === 1 ? 0 : 1) !== bank) return;
        const at = (k / 8 + (rnd() - 0.5) * 0.04) * N, amp = 0.5 + rnd() * 0.5; // no two cylinders alike: worn, mistimed, one or two running lean
        for (let i = 0; i < N * 0.45; i++) {
          const t = i / N, j = Math.floor(at + i) % N;
          x[j] += amp * Math.exp(-t * 22) * (Math.sin(TAU * t * 12) + 0.6 * Math.sin(TAU * t * 5)) * Math.min(1, t * 300); // a pressure pulse thudding down the pipe
        }
      });
      const re = new Float32Array(H), im = new Float32Array(H);
      for (let h = 1; h < H; h++) { let a = 0, b = 0; for (let i = 0; i < N; i++) { const w = TAU * h * i / N; a += x[i] * Math.cos(w); b += x[i] * Math.sin(w); } re[h] = a / N; im[h] = b / N; }
      return c.createPeriodicWave(re, im);
    };
    // The lope: one swell per firing, each cylinder its own strength, as a level that rides on everything.
    const lopeWave = () => {
      const amps = [1, 0.55, 0.85, 0.4, 0.95, 0.6, 0.75, 0.45], re = new Float32Array(H), im = new Float32Array(H), x = new Float32Array(N);
      for (let i = 0; i < N; i++) { const k = Math.floor(i / N * 8), ph = (i / N * 8) % 1; x[i] = amps[k] * Math.pow(Math.sin(Math.PI * ph), 2); }
      for (let h = 1; h < 24; h++) { let a = 0, b = 0; for (let i = 0; i < N; i++) { const w = TAU * h * i / N; a += x[i] * Math.cos(w); b += x[i] * Math.sin(w); } re[h] = a / N; im[h] = b / N; }
      return c.createPeriodicWave(re, im, { disableNormalization: true });
    };
    const shaper = (k) => { const n = 1024, cv = new Float32Array(n); for (let i = 0; i < n; i++) { const v = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(v * k) / Math.tanh(k); } return cv; };
    const E = this.eng = {};
    this.engGain = c.createGain(); this.engGain.gain.value = 0; this.engGain.connect(this.bed);
    // The pipes: a bank each, panned apart, through the fuzz and the exhaust filter, with a lift in the low end.
    E.drive = c.createGain(); E.drive.gain.value = 1;
    E.fuzz = c.createWaveShaper(); E.fuzz.curve = shaper(1.7); E.fuzz.oversample = '2x';
    E.lp = c.createBiquadFilter(); E.lp.type = 'lowpass'; E.lp.frequency.value = 500; E.lp.Q.value = 1.4;
    E.chest = c.createBiquadFilter(); E.chest.type = 'peaking'; E.chest.frequency.value = 90; E.chest.Q.value = 0.8; E.chest.gain.value = 9;
    // After the fuzz (which would flatten it), the lope again: the level swings with the right bank's uneven pulses.
    E.lope = c.createGain(); E.lope.gain.value = 0.35;
    E.drive.connect(E.fuzz); E.fuzz.connect(E.lope); E.lope.connect(E.lp); E.lp.connect(E.chest); E.chest.connect(this.engGain);
    // The growl under it all: a fat low tone at half the firing rate, fuzzed, felt in the seat.
    E.growl = c.createOscillator(); E.growl.type = 'sawtooth'; E.growl.frequency.value = 28;
    E.growlLp = c.createBiquadFilter(); E.growlLp.type = 'lowpass'; E.growlLp.frequency.value = 160; E.growlLp.Q.value = 0.9;
    E.growlG = c.createGain(); E.growlG.gain.value = 0;
    E.growl.connect(E.growlLp); E.growlLp.connect(E.growlG); E.growlG.connect(E.drive); E.growl.start();
    E.banks = [0, 1].map((bank) => {
      const o = c.createOscillator(); o.setPeriodicWave(wave(bank, 7 + bank * 31)); o.frequency.value = 7;
      const pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain(); if (pan.pan) pan.pan.value = bank ? 0.35 : -0.35;
      o.connect(pan); pan.connect(E.drive); o.start(); return o;
    });
    // The growl lurches with the firings (the left bank's uneven pulses swing its level), so it lopes instead of humming.
    E.lopeOsc = c.createOscillator(); E.lopeOsc.setPeriodicWave(lopeWave()); E.lopeOsc.frequency.value = 7; E.lopeOsc.start();
    E.growlMod = c.createGain(); E.growlMod.gain.value = 1.2; E.lopeOsc.connect(E.growlMod); E.growlMod.connect(E.growlG.gain);
    E.lopeMod = c.createGain(); E.lopeMod.gain.value = 1.0; E.lopeOsc.connect(E.lopeMod); E.lopeMod.connect(E.lope.gain);
    // The blower: a whine geared to the crank.
    E.blower = c.createOscillator(); E.blower.type = 'triangle'; E.blower.frequency.value = 300;
    E.blowBp = c.createBiquadFilter(); E.blowBp.type = 'bandpass'; E.blowBp.Q.value = 6; E.blowBp.frequency.value = 300;
    E.blowG = c.createGain(); E.blowG.gain.value = 0;
    E.blower.connect(E.blowBp); E.blowBp.connect(E.blowG); E.blowG.connect(this.engGain); E.blower.start();
    // The intake roaring under load, and the road under the tyres.
    const noise = (f, type, q) => { const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true; const bp = c.createBiquadFilter(); bp.type = type; bp.frequency.value = f; bp.Q.value = q; const g = c.createGain(); g.gain.value = 0; src.connect(bp); bp.connect(g); g.connect(this.engGain); src.start(); return { bp, g }; };
    E.intake = noise(700, 'bandpass', 0.9);
    E.road = noise(160, 'lowpass', 0.7);
    this.gear = 0; this.revs = 0.12; this.lastThrottle = 0;
  },

  // Each frame: the revs from the speed through a four-speed box (they climb through each gear and drop at the
  // shift, with a moment off the throttle), and everything that follows from them.
  engine(speedFrac, throttle, nitro, on) {
    if (!this.ctx || !this.eng) return;
    const c = this.ctx, t = c.currentTime, E = this.eng, gears = [0, 0.22, 0.45, 0.7, 1.45];
    let g = 0;
    while (g < 3 && speedFrac > gears[g + 1]) g++;
    if (g !== this.gear) { if (g > this.gear && on) this.shiftT = t; this.gear = g; }
    const inGear = Math.min(1.1, (speedFrac - gears[g]) / (gears[g + 1] - gears[g]) * (g === 3 ? 1.6 : 1));
    const lift = this.shiftT && t - this.shiftT < 0.14 ? 0.25 : 1, thr = throttle * lift;
    // Revs, 0 (idle, about 850) to 1 (the limiter, about 7000): standing still, a blip with the throttle.
    const want = speedFrac < 0.03 ? 0.08 + thr * 0.3 : 0.2 + inGear * 0.72 + (g === 0 ? thr * 0.08 : 0);
    this.revs += (want - this.revs) * (want > this.revs ? 0.25 : 0.12);
    const rev = this.revs, rpm = 850 + rev * 6150, cyc = rpm / 120; // engine cycles a second (eight firings each)
    const wander = 1 + Math.sin(t * 2.3) * 0.008 + Math.sin(t * 5.1) * 0.005; // never quite steady
    for (const o of E.banks) o.frequency.setTargetAtTime(cyc * wander, t, 0.03);
    E.growl.frequency.setTargetAtTime(cyc * 4 * wander, t, 0.03);
    E.lopeOsc.frequency.setTargetAtTime(cyc * wander, t, 0.03);
    E.growlG.gain.setTargetAtTime(0.35 + thr * 0.45, t, 0.06);
    // Harder on the throttle: more fuzz and a brighter, more open pipe; off it, a low burble.
    E.drive.gain.setTargetAtTime(0.6 + thr * 0.9 + (nitro ? 0.4 : 0), t, 0.05);
    E.lp.frequency.setTargetAtTime(150 + rev * 650 + thr * 450 + (nitro ? 350 : 0), t, 0.05);
    this.engGain.gain.setTargetAtTime(on ? 0.26 + thr * 0.1 + rev * 0.06 : 0, t, 0.08);
    // The blower: always there, louder with the boost; the nitro's in, it screams.
    const bf = rpm / 60 * 22 * (nitro ? 1.12 : 1);
    E.blower.frequency.setTargetAtTime(bf, t, 0.05); E.blowBp.frequency.setTargetAtTime(bf, t, 0.05);
    E.blowG.gain.setTargetAtTime(on ? (0.0015 + thr * rev * 0.006 + (nitro ? 0.03 : 0)) : 0, t, 0.08);
    E.intake.bp.frequency.setTargetAtTime(400 + rev * 1200, t, 0.06);
    E.intake.g.gain.setTargetAtTime(on ? thr * (0.05 + rev * 0.12) : 0, t, 0.06);
    E.road.g.gain.setTargetAtTime(on ? Math.min(1, speedFrac) * 0.5 : 0, t, 0.1);
    // Snapped off the throttle at speed: the pipes pop and crackle.
    if (on && this.lastThrottle > 0.6 && throttle < 0.2 && rev > 0.45 && !(this.shiftT && t - this.shiftT < 0.2)) this.crackle(rev);
    this.lastThrottle = throttle;
  },
  crackle(rev) {
    const n = 3 + Math.floor(Math.random() * 4 + rev * 4);
    for (let i = 0; i < n; i++) {
      const at = 0.04 + Math.random() * 0.7 * (0.5 + rev * 0.5), v = 0.06 + Math.random() * 0.12;
      this.layer({ f: 1200 + Math.random() * 1800, dur: 0.02 + Math.random() * 0.03, vol: v, at, q: 1.2, wet: 0.3 });
      if (Math.random() < 0.5) this.thump(160 + Math.random() * 80, 60, 0.05, v * 1.4, 0.2, at);
    }
  },

  tone(freq, dur, type, vol) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur);
  },

  noiseBurst(dur, freq, vol, sweepTo) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur);
  },

  // Struck steel: inharmonic partials ringing down, over a thud.
  clang(vol) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    for (const [f, v, d] of [[142, 1, 0.7], [383, 0.6, 0.55], [611, 0.45, 0.4], [1027, 0.3, 0.3], [1840, 0.15, 0.2]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.985, t + d);
      g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v * 0.25, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.05);
    }
    this.noiseBurst(0.08, 1800, vol * 0.5, 600);
    this.tone(70, 0.18, 'sine', vol * 0.6);
  },

  // The crowd: a swelling roar of filtered noise with a whistle on top.
  cheer() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; src.loop = true; f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.6;
    g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t, Math.random() * 0.3); src.stop(t + 1.9);
    const o = c.createOscillator(), og = c.createGain();
    o.frequency.setValueAtTime(1800, t + 0.2); o.frequency.exponentialRampToValueAtTime(2600, t + 0.5); o.frequency.exponentialRampToValueAtTime(1500, t + 0.8);
    og.gain.value = 0; og.gain.setValueAtTime(0.0001, t + 0.2); og.gain.exponentialRampToValueAtTime(0.025, t + 0.3); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    o.connect(og); og.connect(this.master); o.start(t + 0.2); o.stop(t + 0.9);
  },

  // A round glancing off the plate: a sharp tick and a falling whine.
  spang() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), f0 = 2400 + Math.random() * 1600;
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.22);
    g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.3);
    this.noiseBurst(0.03, 3200, 0.22, 1500);
  },

  // A car hitting something hard: a low thud, the crunch of panels folding, and loose metal clattering after.
  crunch(vol, power) {
    if (!this.ctx || vol <= 0.02) return;
    const k = Math.min(1, power / 500);
    this.tone(55 + 20 * Math.random(), 0.25, 'sine', 0.35 * vol);
    this.noiseBurst(0.22 + 0.2 * k, 900, 0.45 * vol, 140);
    this.noiseBurst(0.08, 2600, 0.25 * vol, 900);
    for (let i = 0; i < 2 + Math.round(3 * k); i++) setTimeout(() => this.clang(0.12 * vol * (0.5 + Math.random())), 70 + Math.random() * 380);
  },
  // A round striking a rival's bodywork: a bright tink. Glass going: a burst of tiny bright ticks.
  tink(vol) {
    if (!this.ctx) return;
    const f = 3200 + Math.random() * 2200;
    this.tone(f, 0.06, 'triangle', 0.05 * vol);
    this.tone(f * 1.47, 0.04, 'sine', 0.03 * vol);
    this.noiseBurst(0.02, 5000, 0.12 * vol, 3000);
  },
  shatter(vol) {
    if (!this.ctx) return;
    this.noiseBurst(0.35, 4200, 0.3 * vol, 2000);
    for (let i = 0; i < 10; i++) setTimeout(() => this.tone(2500 + Math.random() * 4000, 0.05, 'sine', 0.03 * vol), Math.random() * 450);
  },

  play(ev) {
    if (!this.ctx) return;
    switch (ev.type) {
      case 'beep': this.tone(ev.hi ? 880 : 440, ev.hi ? 0.5 : 0.18, 'square', 0.12); break;
      case 'hit': this.noiseBurst(0.18, 300, Math.min(0.5, ev.power / 600), 120); break;
      case 'boost': this.noiseBurst(0.5, 400, 0.25, 2400); break;
      case 'finish': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'triangle', 0.18), i * 110)); break;
      case 'shoot': this.gunshot(ev.w); break;
      case 'crewHit': this.noiseBurst(0.07, 900, 0.22, 260); this.tone(220, 0.06, 'square', 0.04); break;
      case 'crewKill': this.noiseBurst(0.12, 700, 0.3, 200); this.tone(330, 0.09, 'triangle', 0.1); setTimeout(() => this.tone(220, 0.14, 'triangle', 0.1), 90); break;
      case 'jump': this.noiseBurst(0.35, 600, 0.12, 1800); break;
      case 'land': this.noiseBurst(0.3, 160, Math.min(0.6, 0.15 + ev.power / 900), 60); this.tone(60, 0.2, 'sine', Math.min(0.3, ev.power / 1500)); break;
      case 'scatter': this.noiseBurst(0.25, 220, 0.3, 90); break;
      case 'nail': this.launch('nail'); break;
      case 'ping': setTimeout(() => { this.tone(2650, 0.35, 'sine', 0.09); this.tone(3980, 0.18, 'sine', 0.04); }, 60); break; // the empty clip
      case 'flame': this.noiseBurst(0.09, 500, 0.05, 160); break;
      case 'harpoon': this.launch('harpoon'); break;
      case 'rocket': this.launch('rocket'); break;
      case 'enemyShot': { const F = this.far(ev); this.layer({ f: 1800, to: 500, dur: 0.07, vol: 0.12 * F.vol, cut: F.cut, wet: 0.5 }); this.thump(140, 70, 0.06, 0.05 * F.vol); break; } // their rounds: a duller crack the further off
      case 'enemyRocket': { const F = this.far(ev); this.layer({ f: 900, to: 200, dur: 0.45, vol: 0.2 * F.vol, cut: F.cut, wet: 0.4, atk: 0.02 }); break; }
      case 'explode': this.boom(ev); break;
      case 'lock': this.tone(1200, 0.08, 'square', 0.1); setTimeout(() => this.tone(1200, 0.08, 'square', 0.1), 140); break;
      // The blast hatch: a swing, a heavy clang, ricochets off the plate, a ratchet back up, a grinding jam.
      case 'hatch': this.noiseBurst(0.14, 500, 0.12, 1400); break;
      // Emotes and the crowd; bosses' tells.
      case 'emote': this.noiseBurst(0.18, 700, 0.08, 1800); break;
      case 'crowd': this.cheer(); break;
      case 'static': this.noiseBurst(0.2, 3200, 0.1); break; // changing channel
      case 'ownDriverHit': this.tone(180, 0.08, 'square', 0.12); this.noiseBurst(0.06, 900, 0.1); break; // a thud and a yelp
      case 'order': this.noiseBurst(0.08, 2400, 0.06); this.tone(1320, 0.05, 'square', 0.04); break; // the radio clicks
      case 'bigMoment': this.cheer(); [784, 988, 1175].forEach((f, i) => setTimeout(() => { this.tone(f, 0.16, 'square', 0.06); this.tone(f / 2, 0.16, 'triangle', 0.08); }, i * 90)); break; // the roar and the broadcast's sting
      case 'deflect': this.spang(); break;
      case 'grenadeIn': this.clang(0.25); setTimeout(() => this.clang(0.15), 120); break; // it rattles down inside
      case 'roofUp': this.clang(0.35); this.noiseBurst(0.3, 500, 0.1, 1600); break; // the lid thrown back, and the wind
      case 'roofDown': this.clang(ev.knocked ? 0.6 : 0.3); break;
      case 'gunnerHit': this.noiseBurst(0.1, 900, 0.35, 250); this.tone(160, 0.18, 'square', 0.08); break;
      case 'tyrePop': this.noiseBurst(0.12, 2600, ev.mine ? 0.55 : 0.4, 400); this.noiseBurst(0.6, 300, 0.18, 120); break; // the bang, then the rubber flapping
      case 'bossTell': [0, 0.22].forEach((d) => setTimeout(() => { this.tone(392, 0.18, 'sawtooth', 0.07); this.tone(370, 0.18, 'square', 0.04); }, d * 1000)); break; // a two-blast klaxon
      case 'bossRage': this.tone(55, 1.2, 'sawtooth', 0.12); this.noiseBurst(1.0, 200, 0.3, 80); break;
      case 'coffin': this.noiseBurst(0.25, 300, 0.25, 90); break; // the back door bangs open, the box hits the road
      case 'coffinBreak': this.noiseBurst(0.35, 1400, 0.3, 300); this.noiseBurst(0.2, 200, 0.25, 70); break;
      case 'bossRevive': this.tone(41, 1.6, 'sawtooth', 0.14); this.noiseBurst(1.2, 400, 0.35, 60); break;
      case 'smog': this.noiseBurst(0.9, 160, 0.3, 60); this.noiseBurst(0.4, 900, 0.08, 200); break;
      case 'hatchShut': this.clang(0.5); break;
      case 'hatchUp': for (let k = 0; k < 4; k++) setTimeout(() => this.noiseBurst(0.03, 2600, 0.06), k * 55); this.tone(180, 0.25, 'sawtooth', 0.03); break;
      case 'jam': this.clang(0.35); this.noiseBurst(0.6, 300, 0.25, 120); this.tone(70, 0.5, 'sawtooth', 0.08); break;
      case 'parry': this.clang(0.7); this.tone(1568, 0.25, 'triangle', 0.12); this.noiseBurst(0.35, 900, 0.2, 3000); break; // the plate rings as it bats the rocket away
      case 'block':
        if (ev.kind === 'blast') { this.clang(0.4); this.noiseBurst(0.3, 220, 0.4, 80); }
        else if (ev.kind === 'flame') this.noiseBurst(0.2, 900, 0.08, 400);
        else this.spang();
        break;
      case 'hurt': this.noiseBurst(0.25, 250, 0.45, 80); break;
      case 'empty': this.tone(220, 0.05, 'square', 0.08); break;
      case 'overheat': this.noiseBurst(0.5, 4000, 0.1, 1500); break;
      case 'throw': this.noiseBurst(0.15, 600, 0.12, 1200); break;
      case 'crash': this.crunch(ev.vol ?? 1, ev.power || 200); break;
      case 'tink': this.tink(ev.vol ?? 1); break;
      case 'shatter': this.shatter(ev.vol ?? 1); break;
      case 'pin': this.tone(1500, 0.03, 'square', 0.06); setTimeout(() => this.tone(2900, 0.15, 'triangle', 0.05), 60); break; // the pin, then the spoon flying off
      case 'cookTick': this.tone(ev.late ? 1300 : 1000, 0.03, 'square', 0.04); break;
      case 'nadeBounce': this.clang(0.08 * (ev.vol ?? 1)); break;
      case 'nadeHand': this.noiseBurst(0.6, 400, 0.6, 60); this.tone(50, 0.6, 'sine', 0.4); break;
      case 'swerve': this.noiseBurst(0.3, 500, 0.15, 300); break;
      case 'mine': this.tone(180, 0.1, 'square', 0.08); break;
      case 'switch': this.tone(900, 0.04, 'square', 0.06); break;
      case 'shotgun': this.gunshot('shotgun'); break;
      case 'flare': this.launch('flare'); break;
      case 'reload': this.tone(320, 0.05, 'square', 0.08); setTimeout(() => this.tone(260, 0.05, 'square', 0.08), 120); break;
      case 'reloaded': this.tone(520, 0.05, 'square', 0.08); break;
      case 'smoke': this.noiseBurst(0.8, 300, 0.2, 120); break;
      case 'emp': this.tone(90, 0.6, 'sawtooth', 0.15); this.noiseBurst(0.5, 3000, 0.15, 400); break;
      case 'partBreak': this.noiseBurst(0.4, 200, 0.5, 60); this.tone(140, 0.4, 'square', 0.12); break;
      case 'fit': this.tone(400, 0.08, 'square', 0.08); break;
      case 'fitted': this.tone(660, 0.1, 'triangle', 0.15); setTimeout(() => this.tone(880, 0.12, 'triangle', 0.15), 90); break;
      case 'click': this.tone(660, 0.06, 'triangle', 0.1); break;
      case 'buy': this.tone(880, 0.08, 'triangle', 0.12); setTimeout(() => this.tone(1320, 0.1, 'triangle', 0.12), 70); break;
    }
  },
};
