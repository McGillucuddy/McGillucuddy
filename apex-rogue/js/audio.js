'use strict';
// Tiny synthesized sound: engine drone + effects. No asset files needed.

const Sound = {
  ctx: null,
  muted: false,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
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
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
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

  play(ev) {
    if (!this.ctx) return;
    switch (ev.type) {
      case 'beep': this.tone(ev.hi ? 880 : 440, ev.hi ? 0.5 : 0.18, 'square', 0.12); break;
      case 'hit': this.noiseBurst(0.18, 300, Math.min(0.5, ev.power / 600), 120); break;
      case 'boost': this.noiseBurst(0.5, 400, 0.25, 2400); break;
      case 'finish': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'triangle', 0.18), i * 110)); break;
      case 'shoot': this.noiseBurst(0.06, 2200, 0.12, 900); break;
      case 'rocket': this.noiseBurst(0.4, 1200, 0.3, 200); break;
      case 'enemyRocket': this.noiseBurst(0.35, 900, 0.18, 200); break;
      case 'explode': this.noiseBurst(ev.big ? 0.7 : 0.4, 160, ev.big ? 0.6 : 0.35, 50); break;
      case 'lock': this.tone(1200, 0.08, 'square', 0.1); setTimeout(() => this.tone(1200, 0.08, 'square', 0.1), 140); break;
      case 'shield': this.tone(300, 0.3, 'sine', 0.18); this.tone(600, 0.3, 'sine', 0.1); break;
      case 'parry': this.tone(1568, 0.25, 'triangle', 0.2); this.tone(2093, 0.35, 'triangle', 0.15); break;
      case 'block': this.tone(500, 0.12, 'sine', 0.15); break;
      case 'hurt': this.noiseBurst(0.25, 250, 0.45, 80); break;
      case 'empty': this.tone(220, 0.05, 'square', 0.08); break;
      case 'overheat': this.noiseBurst(0.5, 4000, 0.1, 1500); break;
      case 'throw': this.noiseBurst(0.15, 600, 0.12, 1200); break;
      case 'swerve': this.noiseBurst(0.3, 500, 0.15, 300); break;
      case 'mine': this.tone(180, 0.1, 'square', 0.08); break;
      case 'switch': this.tone(900, 0.04, 'square', 0.06); break;
      case 'click': this.tone(660, 0.06, 'triangle', 0.1); break;
      case 'buy': this.tone(880, 0.08, 'triangle', 0.12); setTimeout(() => this.tone(1320, 0.1, 'triangle', 0.12), 70); break;
    }
  },
};
