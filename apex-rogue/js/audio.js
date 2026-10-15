'use strict';
// Tiny synthesized sound: engine drone + effects. No asset files needed.

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

  engine(speedFrac, throttle, nitro, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 45 + speedFrac * 120 + throttle * 12 + (nitro ? 25 : 0);
    this.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(500 + speedFrac * 1400 + (nitro ? 800 : 0), t, 0.08);
    this.engGain.gain.setTargetAtTime(on ? 0.09 + throttle * 0.05 : 0, t, 0.1);
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

  play(ev) {
    if (!this.ctx) return;
    switch (ev.type) {
      case 'beep': this.tone(ev.hi ? 880 : 440, ev.hi ? 0.5 : 0.18, 'square', 0.12); break;
      case 'hit': this.noiseBurst(0.18, 300, Math.min(0.5, ev.power / 600), 120); break;
      case 'boost': this.noiseBurst(0.5, 400, 0.25, 2400); break;
      case 'finish': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'triangle', 0.18), i * 110)); break;
      case 'shoot':
        if (ev.w === 'pistol') { this.noiseBurst(0.1, 1600, 0.2, 420); this.tone(150, 0.05, 'square', 0.06); } // a sharper, heavier crack
        else if (ev.w === 'carbine') { this.noiseBurst(0.08, 2000, 0.16, 600); this.tone(120, 0.04, 'square', 0.04); }
        else if (ev.w === 'liberty') { this.noiseBurst(0.22, 1200, 0.32, 260); this.tone(90, 0.12, 'triangle', 0.1); } // a big rolling boom
        else if (ev.w === 'typewriter') { this.noiseBurst(0.07, 1500, 0.14, 500); this.tone(180, 0.03, 'square', 0.035); } // the clatter
        else if (ev.w === 'lmg' || ev.w === 'pangun') { this.noiseBurst(0.11, 1100, 0.2, 320); this.tone(ev.w === 'lmg' ? 95 : 80, 0.06, 'square', 0.05); }
        else this.noiseBurst(0.06, 2200, 0.12, 900);
        break;
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
      case 'enemyShot': this.noiseBurst(0.05, 1600, 0.07, 700); break;
      case 'enemyRocket': this.noiseBurst(0.35, 900, 0.18, 200); break;
      case 'explode': this.noiseBurst(ev.big ? 0.7 : 0.4, 160, ev.big ? 0.6 : 0.35, 50); break;
      case 'lock': this.tone(1200, 0.08, 'square', 0.1); setTimeout(() => this.tone(1200, 0.08, 'square', 0.1), 140); break;
      // The blast hatch: a swing, a heavy clang, ricochets off the plate, a ratchet back up, a grinding jam.
      case 'hatch': this.noiseBurst(0.14, 500, 0.12, 1400); break;
      // Emotes and the crowd; bosses' tells.
      case 'emote': this.noiseBurst(0.18, 700, 0.08, 1800); break;
      case 'crowd': this.cheer(); break;
      case 'static': this.noiseBurst(0.2, 3200, 0.1); break; // changing channel
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
      case 'swerve': this.noiseBurst(0.3, 500, 0.15, 300); break;
      case 'mine': this.tone(180, 0.1, 'square', 0.08); break;
      case 'switch': this.tone(900, 0.04, 'square', 0.06); break;
      case 'shotgun': this.noiseBurst(0.25, 900, 0.4, 150); break;
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
