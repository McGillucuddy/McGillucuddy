'use strict';
// Menu theme, synthesized live like the rest of the sound: no audio files.
// Straight synthwave in D minor: four-on-the-floor kick, a gated snare, a big pumping saw bass under a
// supersaw pad and a 16th-note arpeggio with a dotted echo. Everything but the drums ducks under the kick.

const MUSIC = {
  bpm: 104,
  // Dm, Bb, F, C: one chord a bar.
  roots: [38, 34, 41, 36],
  chords: [[62, 65, 69], [62, 65, 70], [60, 65, 69], [60, 64, 67]],
  // Arp walks the chord and its octave: 0-2 are the chord tones, 3 is the root an octave up.
  arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2],
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
    this.makeDuck(c);
    this.bar = 0;
    this.step = 0;
    this.next = c.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
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

  // The sidechain: bass, pad and arp run through this gain, which dips on every kick.
  makeDuck(c) {
    this.duck = c.createGain();
    this.duck.gain.value = 1;
    this.duck.connect(this.bus);
  },

  // Shared space: a long reverb and a dotted-eighth echo, both feeding the master.
  buildFx(c) {
    const len = c.sampleRate * 2.2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const verb = c.createConvolver();
    verb.buffer = ir;
    const wet = c.createGain();
    wet.gain.value = 0.45;
    verb.connect(wet);
    wet.connect(Sound.master);
    const echo = c.createDelay(1);
    echo.delayTime.value = (60 / MUSIC.bpm) * 0.75;
    const fb = c.createGain(), tone = c.createBiquadFilter();
    fb.gain.value = 0.35;
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    echo.connect(tone); tone.connect(fb); fb.connect(echo);
    tone.connect(verb);
    tone.connect(Sound.master);
    this.fxGain = c.createGain();
    this.fxGain.connect(verb);
    this.echoIn = c.createGain();
    this.echoIn.connect(echo);
    this.fx = { verb, echo };
    // Warm saturation for the bass.
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 511.5) - 1; curve[i] = Math.tanh(x * 2.2); }
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
    // If the page stalled (a big garage rebuild, a background tab), drop the missed steps but stay on the grid,
    // so the beat comes back in time instead of lurching.
    while (this.next < c.currentTime + 0.01) {
      this.next += sixteenth;
      if (++this.step === 16) { this.step = 0; this.bar++; }
    }
    while (this.next < c.currentTime + 0.5) {
      this.play(this.bar, this.step, this.next, sixteenth);
      this.next += sixteenth;
      if (++this.step === 16) { this.step = 0; this.bar++; }
    }
  },

  // Bars 0-3 are the intro; then a 20-bar loop: groove (8), full groove (8), breakdown (4).
  play(bar, s, t, dt) {
    const ch = bar % 4, intro = bar < 4, loop = intro ? -1 : (bar - 4) % 20;
    const full = loop >= 8 && loop < 16, breakdown = loop >= 16;
    const root = MUSIC.roots[ch], chord = MUSIC.chords[ch];
    if (s === 0) this.pad(t, chord, dt * 16);
    // Arp: muffled in the intro, opening up through the groove, bright in the full section.
    const tones = [...chord, chord[0] + 12];
    const bright = intro ? 0.35 + bar * 0.12 : breakdown ? 0.6 : full ? 1 : 0.75;
    this.arpNote(t, tones[MUSIC.arp[s]] + (full && s % 4 === 3 ? 12 : 0), bright);
    if (intro || breakdown) {
      if (s % 4 === 2) this.hat(t, 0.05, false);
      if (breakdown && loop === 19 && s === 0) this.riser(t, dt * 16);
      return;
    }
    if ((loop === 0 || loop === 8) && s === 0) this.crash(t);
    if (s % 4 === 0) this.kick(t);
    if (s === 4 || s === 12) this.snare(t);
    if (full) this.hat(t, s % 2 ? 0.05 : s % 4 === 2 ? 0.09 : 0.06, s === 14);
    else if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.09 : 0.05, s === 14);
    // Driving eighth-note bass, with an octave kick-up late in each half-bar of the full section.
    if (s % 2 === 0) this.bassNote(t, root + (full && (s === 6 || s === 14) ? 12 : 0), dt * 1.8);
    if (ch === 3 && s === 15 && loop % 8 === 7) this.snare(t);
  },

  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  // Gains start at full volume by default; zero them first, or an oscillator's first sample can slip through
  // just before the envelope begins and click.
  env(g, t, a, peak, d) {
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  },

  kick(t) {
    const c = Sound.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    this.env(g, t, 0.003, 0.95, 0.42);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.5);
    // Pump: everything melodic dips under the kick and swells back.
    const d = this.duck.gain;
    d.setValueAtTime(1, t);
    d.linearRampToValueAtTime(0.28, t + 0.012);
    d.setTargetAtTime(1, t + 0.03, 0.1);
  },

  noise(t, dur, type, freq, q, vol, verb) {
    const c = Sound.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = Sound.noise;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    this.env(g, t, 0.002, vol, dur);
    src.connect(f); f.connect(g); g.connect(this.bus);
    if (verb) this.send(g, verb);
    src.start(t, Math.random() * 0.2); src.stop(t + dur + 0.05);
  },

  // The big eighties snare: a noise crack and a body tone thrown into the reverb.
  snare(t) {
    this.noise(t, 0.22, 'bandpass', 1600, 0.6, 0.5, 1.8);
    const c = Sound.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    this.env(g, t, 0.002, 0.35, 0.12);
    o.connect(g); g.connect(this.bus);
    this.send(g, 1);
    o.start(t); o.stop(t + 0.16);
  },

  hat(t, vol, open) { this.noise(t, open ? 0.2 : 0.035, 'highpass', 8000, 0.5, vol, open ? 0.3 : 0); },

  // A long noise wash on the downbeat of a new section; the noise buffer loops so it can ring out.
  crash(t) {
    const c = Sound.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = Sound.noise; src.loop = true;
    f.type = 'highpass'; f.frequency.value = 4500;
    this.env(g, t, 0.003, 0.14, 1.9);
    src.connect(f); f.connect(g); g.connect(this.bus);
    this.send(g, 0.8);
    src.start(t); src.stop(t + 2);
  },

  // A filtered noise sweep up through the last bar of the breakdown.
  riser(t, dur) {
    const c = Sound.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = Sound.noise; src.loop = true;
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    src.connect(f); f.connect(g); g.connect(this.bus);
    this.send(g, 0.6);
    src.start(t); src.stop(t + dur + 0.05);
  },

  // Big bass: two detuned saws, saturated, through a snapping low-pass, over a clean sine sub an octave down.
  bassNote(t, m, dur) {
    const c = Sound.ctx, f = c.createBiquadFilter(), sh = c.createWaveShaper(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + 0.015);
    f.frequency.exponentialRampToValueAtTime(320, t + dur);
    sh.curve = this.curve;
    this.env(g, t, 0.005, 0.22, dur);
    f.connect(sh); sh.connect(g); g.connect(this.duck);
    for (const det of [-8, 8]) {
      const o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = this.hz(m); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
    const sub = c.createOscillator(), sg = c.createGain();
    sub.frequency.value = this.hz(m - 12);
    this.env(sg, t, 0.005, 0.32, dur);
    sub.connect(sg); sg.connect(this.duck);
    sub.start(t); sub.stop(t + dur + 0.05);
  },

  // Supersaw pad: three detuned saws a note, a quick swell, held for the bar.
  pad(t, notes, dur) {
    const c = Sound.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 1700; f.Q.value = 0.7;
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.35);
    g.gain.setValueAtTime(0.045, t + dur - 0.15);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
    f.connect(g); g.connect(this.duck);
    this.send(g, 0.7);
    for (const n of notes) for (const det of [-14, 0, 14]) {
      const o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = this.hz(n - 12); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.3);
    }
  },

  // Arp pluck: a saw and a square with a fast filter snap, into the dotted echo.
  arpNote(t, m, bright) {
    const c = Sound.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = this.hz(m); o2.frequency.value = this.hz(m); o2.detune.value = 6;
    f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(600 + 3400 * bright, t);
    f.frequency.exponentialRampToValueAtTime(400 + 500 * bright, t + 0.16);
    this.env(g, t, 0.003, 0.05, 0.2);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.duck);
    this.send(g, 0.4, 0.55);
    o.start(t); o2.start(t); o.stop(t + 0.26); o2.stop(t + 0.26);
  },
};
