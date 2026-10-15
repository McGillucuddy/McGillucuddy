'use strict';
// Synthesized sound: engine, guns, blasts and the rest, built from oscillators and noise. No asset files needed.
// Everything loud also feeds a short generated reverb (the slap off concrete), and things that happen away from you
// (explosions, rival fire) are quieter and more muffled the further off they are (Sound.listener, set each frame).

// Each gun's report: body filter frequency f and length d, the thump's pitch lo, levels, and the reverb send.
const GUN_SOUND = {
  pistol: { f: 1500, d: 0.11, lo: 140, crack: 0.35, body: 0.32, thump: 0.18, wet: 0.35, mech: 0.04 },
  smg: { f: 2100, d: 0.07, lo: 170, crack: 0.25, body: 0.2, thump: 0.1, wet: 0.25, mech: 0.05 },
  drum: { f: 1900, d: 0.08, lo: 150, crack: 0.25, body: 0.22, thump: 0.12, wet: 0.25, mech: 0.05 },
  carbine: { f: 1900, d: 0.1, lo: 120, crack: 0.33, body: 0.26, thump: 0.15, wet: 0.35, mech: 0.04 },
  liberty: { f: 1100, d: 0.28, lo: 80, crack: 0.45, body: 0.42, thump: 0.3, wet: 0.55 },
  typewriter: { f: 1600, d: 0.07, lo: 160, crack: 0.22, body: 0.18, thump: 0.08, wet: 0.2, mech: 0.07 },
  lmg: { f: 1200, d: 0.12, lo: 95, crack: 0.33, body: 0.3, thump: 0.18, wet: 0.35, mech: 0.05 },
  pangun: { f: 1050, d: 0.13, lo: 85, crack: 0.33, body: 0.3, thump: 0.2, wet: 0.35, mech: 0.05 },
  shotgun: { f: 850, d: 0.26, lo: 75, crack: 0.5, body: 0.5, thump: 0.35, wet: 0.5 },
};

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
    this.master.connect(c.destination);

    this.engFilter = c.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 900;
    this.engGain = c.createGain();
    this.engGain.gain.value = 0;
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.master);
    this.osc1 = c.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = c.createOscillator();
    this.osc2.type = 'square';
    const g2 = c.createGain();
    g2.gain.value = 0.35;
    this.osc1.connect(this.engFilter);
    this.osc2.connect(g2);
    g2.connect(this.engFilter);
    this.osc1.start();
    this.osc2.start();

    const len = c.sampleRate * 0.5;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // The engine's grit: filtered noise riding the same filter as the oscillators, and a detuned third voice.
    this.osc3 = c.createOscillator(); this.osc3.type = 'sawtooth';
    const g3 = c.createGain(); g3.gain.value = 0.3; this.osc3.connect(g3); g3.connect(this.engFilter); this.osc3.start();
    const rum = c.createBufferSource(); rum.buffer = this.noise; rum.loop = true;
    const rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 220;
    this.rumble = c.createGain(); this.rumble.gain.value = 0;
    rum.connect(rf); rf.connect(this.rumble); this.rumble.connect(this.engGain); rum.start();

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
    const G = GUN_SOUND[w] || GUN_SOUND.smg, k = 0.92 + Math.random() * 0.16;
    this.layer({ f: 5200 * k, type: 'highpass', dur: 0.012, vol: G.crack, q: 0.5 });
    this.layer({ f: G.f * k, to: G.f * 0.3, dur: G.d, vol: G.body, q: 0.7, wet: G.wet });
    this.thump(G.lo * 2.2 * k, G.lo, Math.min(0.18, G.d * 1.2), G.thump, G.wet * 0.6);
    if (G.mech) this.layer({ f: 2400, dur: 0.025, vol: G.mech, at: 0.035 + Math.random() * 0.01, q: 3 });
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

  // The engine through a four-speed box: revs climb through each gear and drop at the shift (with a moment off
  // the throttle), so you hear the car working rather than one rising whine.
  engine(speedFrac, throttle, nitro, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, gears = [0, 0.22, 0.45, 0.7, 1.45];
    let g = 0;
    while (g < 3 && speedFrac > gears[g + 1]) g++;
    if (g !== this.gear) { if (g > this.gear && on) this.shiftT = t; this.gear = g; }
    const rpm = Math.min(1.15, (speedFrac - gears[g]) / (gears[g + 1] - gears[g]) * (g === 3 ? 1.6 : 1));
    const lift = this.shiftT && t - this.shiftT < 0.12 ? 0.4 : 1; // off the throttle for the shift
    const f = (38 + rpm * 95 + g * 9 + (nitro ? 18 : 0)) * (0.85 + 0.15 * throttle * lift);
    this.osc1.frequency.setTargetAtTime(f, t, 0.04);
    this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
    this.osc3.frequency.setTargetAtTime(f * 1.007, t, 0.04);
    this.engFilter.frequency.setTargetAtTime(380 + rpm * 1100 + throttle * lift * 500 + (nitro ? 800 : 0), t, 0.06);
    this.engGain.gain.setTargetAtTime(on ? (0.08 + throttle * lift * 0.06) : 0, t, 0.08);
    this.rumble.gain.setTargetAtTime(on ? 0.5 + throttle * 0.6 : 0, t, 0.1);
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
      case 'nail': this.noiseBurst(0.05, 3200, 0.1, 1800); break;
      case 'ping': setTimeout(() => { this.tone(2650, 0.35, 'sine', 0.09); this.tone(3980, 0.18, 'sine', 0.04); }, 60); break; // the empty clip
      case 'flame': this.noiseBurst(0.09, 500, 0.05, 160); break;
      case 'harpoon': this.noiseBurst(0.25, 900, 0.2, 300); this.tone(180, 0.2, 'sawtooth', 0.05); break;
      case 'rocket': this.noiseBurst(0.4, 1200, 0.3, 200); break;
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
      case 'flare': this.noiseBurst(0.3, 1800, 0.18, 600); this.tone(300, 0.2, 'sine', 0.1); break;
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
