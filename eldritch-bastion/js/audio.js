// ============================================================
//  ELDRITCH BASTION — tiny WebAudio synth (no audio files)
// ============================================================
'use strict';

const Sfx = {
  ctx: null, master: null, enabled: true, last: {}, drone: null,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.35; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.35 : 0;
  },
  throttle(k, ms) { const n = performance.now(); if (this.last[k] && n - this.last[k] < ms) return false; this.last[k] = n; return true; },
  tone(freq, dur, type = 'sine', vol = 0.3, slide = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noiseBurst(dur, vol = 0.3, freq = 1000, q = 1) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  startDrone() {
    if (!this.ctx || this.drone) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain(); g.gain.value = 0.0; g.gain.linearRampToValueAtTime(0.06, t + 3);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    const oscs = [55, 55.4, 82.4].map(fr => { const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); return o; });
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = this.ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    f.connect(g); g.connect(this.master);
    this.drone = { g, oscs, lfo };
  },
  stopDrone() {
    if (!this.drone) return;
    const d = this.drone; this.drone = null;
    const t = this.ctx.currentTime;
    d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(0, t + 1);
    setTimeout(() => { d.oscs.forEach(o => o.stop()); d.lfo.stop(); }, 1200);
  },
  play(ev, data) {
    if (!this.ctx || !this.enabled) return;
    switch (ev) {
      case 'shot':
        if (data === 'rifle' && this.throttle('rifle', 70)) this.noiseBurst(0.08, 0.18, 2500, 2);
        else if (data === 'mortar' && this.throttle('mortar', 120)) this.tone(110, 0.15, 'triangle', 0.25, 0.5);
        else if (data === 'tesla' && this.throttle('tesla', 90)) { this.noiseBurst(0.12, 0.12, 5000, 4); this.tone(880, 0.08, 'square', 0.04, 1.5); }
        else if (data === 'scholar' && this.throttle('scholar', 100)) this.tone(520, 0.25, 'sine', 0.08, 1.6);
        break;
      case 'boom': if (this.throttle('boom', 90)) this.noiseBurst(0.35, 0.3, 200, 0.7); break;
      case 'kill': if (this.throttle('kill', 60)) { this.noiseBurst(0.15, 0.08, 300 + Math.random() * 200, 2); this.tone(90 + Math.random() * 40, 0.25, 'sawtooth', 0.04, 0.4); } break;
      case 'leak': this.tone(70, 0.6, 'sawtooth', 0.15, 0.6); break;
      case 'build': this.tone(260, 0.1, 'triangle', 0.15); setTimeout(() => this.tone(390, 0.12, 'triangle', 0.12), 70); break;
      case 'upgrade': [330, 440, 660].forEach((f, i) => setTimeout(() => this.tone(f, 0.15, 'triangle', 0.12), i * 70)); break;
      case 'sell': this.tone(500, 0.12, 'square', 0.05, 0.6); break;
      case 'wave': this.tone(98, 1.2, 'sawtooth', 0.12, 0.98); this.tone(147, 1.2, 'sawtooth', 0.06, 0.98); break;
      case 'boss': this.tone(41, 2.5, 'sawtooth', 0.3, 0.8); this.tone(61.7, 2.5, 'sawtooth', 0.15, 0.8); this.noiseBurst(2, 0.15, 120, 0.5); break;
      case 'spell': this.tone(220, 0.8, 'sine', 0.2, 2.5); this.noiseBurst(0.6, 0.12, 900, 0.8); break;
      case 'win': [262, 330, 392, 523].forEach((f, i) => setTimeout(() => this.tone(f, 0.5, 'triangle', 0.15), i * 160)); break;
      case 'lose': [220, 185, 156, 110].forEach((f, i) => setTimeout(() => this.tone(f, 0.7, 'sawtooth', 0.1), i * 260)); break;
      case 'thunder': this.noiseBurst(2.5, 0.35, 90, 0.4); this.noiseBurst(1.2, 0.15, 300, 0.6); break;
      case 'siege': if (this.throttle('siege', 900)) { this.tone(65, 0.5, 'sawtooth', 0.12, 0.7); this.noiseBurst(0.3, 0.12, 400, 1); } break;
      case 'click': this.tone(700, 0.04, 'square', 0.04); break;
      case 'deny': this.tone(140, 0.12, 'square', 0.08); break;
    }
  },
};
