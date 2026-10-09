'use strict';
// Menu theme, synthesized live like the rest of the sound: no audio files.
// A slow industrial grind in D minor. A distant siren opens it, pipe clanks and a kick come in, then a
// driving bass and a lonely lead. Notes are scheduled a little ahead of the audio clock.

const MUSIC = {
  bpm: 88,
  // Dm, Bb, Gm, A: one chord a bar, voiced close so the pad barely moves.
  roots: [38, 34, 31, 33],
  chords: [[62, 65, 69], [62, 65, 70], [62, 67, 70], [61, 64, 69]],
  // Bass per bar: [step, semitones above the root].
  bass: [[0, 0], [3, 0], [6, 12], [8, 0], [10, 0], [11, 12], [14, 7]],
  // Lead over four bars: [bar, step, midi, length in steps].
  lead: [
    [0, 0, 74, 6], [0, 6, 72, 2], [0, 8, 74, 4], [0, 12, 77, 4],
    [1, 0, 74, 6], [1, 6, 70, 2], [1, 8, 72, 8],
    [2, 0, 70, 4], [2, 4, 69, 4], [2, 8, 67, 6], [2, 14, 69, 2],
    [3, 0, 69, 12], [3, 12, 73, 4],
  ],
  lead2: [
    [0, 0, 81, 4], [0, 4, 77, 4], [0, 8, 76, 2], [0, 10, 74, 6],
    [1, 0, 77, 4], [1, 4, 74, 4], [1, 8, 72, 8],
    [2, 0, 74, 3], [2, 3, 70, 3], [2, 6, 67, 4], [2, 10, 70, 6],
    [3, 0, 69, 8], [3, 8, 64, 4], [3, 12, 61, 4],
  ],
};

const Music = {
  playing: false,
  bus: null,

  get level() { return 1.1 * (Settings.data.music ?? 0.7); },

  // Call every frame with whether the menu wants music; starts and fades as needed.
  want(on) {
    if (on && !this.playing) this.start();
    else if (!on && this.playing) this.stop();
  },

  start() {
    Sound.init();
    const c = Sound.ctx;
    if (!c) return;
    this.playing = true;
    if (!this.fx) this.buildFx(c);
    this.bus = c.createGain();
    this.bus.gain.value = 0;
    this.bus.gain.setTargetAtTime(this.level, c.currentTime, 0.8);
    this.bus.connect(Sound.master);
    this.bar = 0;
    this.step = 0;
    this.next = c.currentTime + 0.1;
    this.siren(this.next);
    this.timer = setInterval(() => this.schedule(), 50);
  },

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    const bus = this.bus, c = Sound.ctx;
    this.bus = null;
    if (!bus) return;
    bus.gain.cancelScheduledValues(c.currentTime);
    bus.gain.setTargetAtTime(0, c.currentTime, 0.35);
    setTimeout(() => bus.disconnect(), 2500);
  },

  setLevel() {
    if (this.bus) this.bus.gain.setTargetAtTime(this.level, Sound.ctx.currentTime, 0.05);
  },

  // Shared space: a long dark reverb and a filtered dotted echo, both feeding the master.
  buildFx(c) {
    const len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const verb = c.createConvolver();
    verb.buffer = ir;
    const wet = c.createGain();
    wet.gain.value = 0.5;
    verb.connect(wet);
    wet.connect(Sound.master);
    const echo = c.createDelay(1);
    echo.delayTime.value = (60 / MUSIC.bpm) * 0.75;
    const fb = c.createGain(), tone = c.createBiquadFilter();
    fb.gain.value = 0.38;
    tone.type = 'lowpass';
    tone.frequency.value = 1600;
    echo.connect(tone); tone.connect(fb); fb.connect(echo);
    tone.connect(verb);
    tone.connect(Sound.master);
    // Echo and reverb tails ride on the music level too, so muting the music silences them.
    this.fxGain = c.createGain();
    this.fxGain.connect(verb);
    this.echoIn = c.createGain();
    this.echoIn.connect(echo);
    this.fx = { verb, echo };
    // Saturation for the lead: a soft clip curve.
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 511.5) - 1; curve[i] = Math.tanh(x * 3.5); }
    this.curve = curve;
  },

  // A send from a voice into the reverb (and optionally the echo), scaled by the music level.
  send(node, verbAmt, echoAmt) {
    const c = Sound.ctx;
    const v = c.createGain();
    v.gain.value = verbAmt * this.level;
    node.connect(v); v.connect(this.fxGain);
    if (echoAmt) {
      const e = c.createGain();
      e.gain.value = echoAmt * this.level;
      node.connect(e); e.connect(this.echoIn);
    }
  },

  schedule() {
    const c = Sound.ctx;
    if (!this.bus) return;
    const sixteenth = 60 / MUSIC.bpm / 4;
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05; // tab was asleep: pick up from now
    while (this.next < c.currentTime + 0.3) {
      this.play(this.bar, this.step, this.next, sixteenth);
      this.next += sixteenth;
      if (++this.step === 16) { this.step = 0; this.bar++; }
    }
  },

  // Bars 0-3 are the intro; then a 24-bar loop: groove, lead, groove, second lead, breakdown.
  play(bar, s, t, dt) {
    const ch = bar % 4, intro = bar < 4, loop = intro ? -1 : (bar - 4) % 24;
    const groove = loop >= 0 && loop < 20, full = loop >= 4 && loop < 20, breakdown = loop >= 20;
    const leadOn = (loop >= 8 && loop < 12) || (loop >= 16 && loop < 20) || breakdown;
    if (s === 0) this.pad(t, MUSIC.chords[ch], dt * 16, breakdown ? 1.4 : 1);
    if (intro) {
      if (s === 7 && bar % 2 === 1) this.clank(t, 0.5);
      if (s % 4 === 2 && bar >= 2) this.hat(t, 0.05, false);
      return;
    }
    if (groove) {
      if (s === 0 || s === 6 || s === 8 || (s === 10 && ch === 3)) this.kick(t);
      if (full && (s === 4 || s === 12)) this.snare(t);
      if (s % 2 === 0) this.hat(t, s === 14 ? 0.1 : 0.07, s === 14);
      else if (full && (s === 7 || s === 15) && ch % 2) this.hat(t, 0.04, false);
      for (const [st, off] of MUSIC.bass) if (st === s) this.bassNote(t, MUSIC.roots[ch] + off, dt * (st === 14 ? 2 : 1.6));
      if (s === 7 && ch === 1) this.clank(t, 0.6);
      if (s === 15 && ch === 3 && loop % 8 === 7) { this.snare(t); this.snare(t + dt / 2); }
    } else if (s === 7 && ch % 2) this.clank(t, 0.4);
    if (leadOn) {
      const line = loop >= 16 ? MUSIC.lead2 : MUSIC.lead;
      for (const [b, st, n, len] of line) if (b === ch && st === s) this.leadNote(t, n - (breakdown ? 12 : 0), dt * len);
    }
  },

  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  },

  kick(t) {
    const c = Sound.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.14);
    this.env(g, t, 0.004, 0.75, 0.38);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.45);
  },

  noise(t, dur, type, freq, q, vol, verb) {
    const c = Sound.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = Sound.noise;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    this.env(g, t, 0.002, vol, dur);
    src.connect(f); f.connect(g); g.connect(this.bus);
    if (verb) this.send(g, verb);
    src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.05);
  },

  snare(t) {
    this.noise(t, 0.2, 'bandpass', 1900, 0.8, 0.45, 0.9);
    const c = Sound.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    this.env(g, t, 0.002, 0.3, 0.1);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.15);
  },

  hat(t, vol, open) { this.noise(t, open ? 0.16 : 0.035, 'highpass', 7500, 0.5, vol, open ? 0.3 : 0); },

  // A struck pipe: inharmonic partials ringing down into the reverb.
  clank(t, vol) {
    const c = Sound.ctx, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.2;
    this.env(g, t, 0.002, vol * 0.25, 0.55);
    f.connect(g); g.connect(this.bus);
    this.send(g, 1.6);
    for (const r of [1, 1.47, 2.09, 2.76]) {
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = 410 * r * (0.97 + Math.random() * 0.06);
      o.connect(f); o.start(t); o.stop(t + 0.6);
    }
    this.noise(t, 0.03, 'highpass', 3000, 0.7, vol * 0.3, 0);
  },

  bassNote(t, m, dur) {
    const c = Sound.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(260, t);
    f.frequency.exponentialRampToValueAtTime(1100, t + 0.02);
    f.frequency.exponentialRampToValueAtTime(240, t + dur);
    this.env(g, t, 0.006, 0.26, dur);
    f.connect(g); g.connect(this.bus);
    for (const [type, mul, det] of [['sawtooth', 1, -6], ['sawtooth', 1, 6], ['sine', 0.5, 0]]) {
      const o = c.createOscillator();
      o.type = type; o.frequency.value = this.hz(m) * mul; o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
  },

  pad(t, notes, dur, bright) {
    const c = Sound.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500 * bright, t);
    f.frequency.linearRampToValueAtTime(1300 * bright, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(600 * bright, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.9);
    g.gain.setValueAtTime(0.08, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    f.connect(g); g.connect(this.bus);
    this.send(g, 1.2);
    for (const n of notes) for (const det of [-9, 9]) {
      const o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = this.hz(n - 12); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.7);
    }
  },

  leadNote(t, m, dur) {
    const c = Sound.ctx, o = c.createOscillator(), sh = c.createWaveShaper(), f = c.createBiquadFilter(), g = c.createGain();
    const lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(this.hz(m - 0.4), t);
    o.frequency.exponentialRampToValueAtTime(this.hz(m), t + 0.06); // a little scoop into each note
    lfo.frequency.value = 5.2; lg.gain.value = this.hz(m) * 0.012;
    lfo.connect(lg); lg.connect(o.frequency);
    sh.curve = this.curve;
    f.type = 'lowpass'; f.frequency.value = 1900; f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.04);
    g.gain.setValueAtTime(0.07, t + Math.max(0.05, dur - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    o.connect(sh); sh.connect(f); f.connect(g); g.connect(this.bus);
    this.send(g, 0.8, 0.5);
    o.start(t); lfo.start(t + 0.15); o.stop(t + dur + 0.2); lfo.stop(t + dur + 0.2);
  },

  // A prison siren wailing far off over the intro.
  siren(t) {
    const c = Sound.ctx, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = 640;
    lfo.frequency.value = 0.22; lg.gain.value = 170;
    lfo.connect(lg); lg.connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 1.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + 3);
    g.gain.linearRampToValueAtTime(0.0001, t + 10);
    o.connect(f); f.connect(g); g.connect(this.bus);
    this.send(g, 2.5);
    o.start(t); lfo.start(t); o.stop(t + 10.2); lfo.stop(t + 10.2);
  },
};
