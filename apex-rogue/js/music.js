'use strict';
// Music, synthesized live like the rest of the sound: no audio files.
// Menu theme: straight synthwave in D minor. A four-on-the-floor kick, a gated snare and a big pumping saw bass,
// under a supersaw pad and a 16th-note arpeggio with a dotted echo. Everything but the drums ducks under the kick.
// Race tracks are generated per race (see Music.forRace): the act sets the mood, getting more serious the higher
// you climb, up to an ethereal choir at the Crown; the race type and its seed vary key, tempo and parts.

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

  cfg: null,
  mult: 1,
  MENU: { id: 'menu', style: 'menu', bpm: MUSIC.bpm },

  get level() {
    const race = this.cfg && this.cfg.style !== 'menu';
    return (race ? 0.75 * (Settings.data.raceMusic ?? 0.6) : 1.1 * (Settings.data.music ?? 0.7)) * this.mult;
  },

  // Call every frame with the track that should be playing (or null) and a volume multiplier;
  // a new track crossfades in, null fades out.
  set(cfg, mult) {
    this.mult = mult ?? 1;
    if ((cfg && cfg.id) !== (this.cfg && this.cfg.id)) {
      if (this.playing) this.stop();
      this.cfg = cfg;
      if (cfg) this.start();
      return;
    }
    if (this.bus && Math.abs(this.applied - this.level) > 0.001) this.setLevel();
  },

  // The menu's old switch.
  want(on) { this.set(on ? this.MENU : null); },

  start() {
    Sound.init();
    const c = Sound.ctx;
    if (!c) return;
    this.playing = true;
    if (!this.fx) this.buildFx(c);
    this.fx.echo.delayTime.setValueAtTime((60 / this.cfg.bpm) * 0.75, c.currentTime);
    this.bus = c.createGain();
    this.bus.gain.value = 0;
    this.applied = this.level;
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
    this.applied = this.level;
    if (this.bus) this.bus.gain.setTargetAtTime(this.applied, Sound.ctx.currentTime, 0.15);
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
    const sixteenth = 60 / this.cfg.bpm / 4, play = this.cfg.style === 'menu' ? this.play : this.playRace;
    // If the page stalled (a big garage rebuild, a background tab), drop the missed steps but stay on the grid,
    // so the beat comes back in time instead of lurching.
    while (this.next < c.currentTime + 0.01) {
      this.next += sixteenth;
      if (++this.step === 16) { this.step = 0; this.bar++; }
    }
    while (this.next < c.currentTime + 0.5) {
      play.call(this, this.bar, this.step, this.next, sixteenth);
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
  bassNote(t, m, dur, dist) {
    const c = Sound.ctx, f = c.createBiquadFilter(), sh = c.createWaveShaper(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + 0.015);
    f.frequency.exponentialRampToValueAtTime(320, t + dur);
    sh.curve = dist ? this.curveFor(dist) : this.curve;
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
  pad(t, notes, dur, bright, vol) {
    bright = bright || 1; vol = vol ?? 1;
    const c = Sound.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 1700 * bright; f.Q.value = 0.7;
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045 * vol, t + 0.35);
    g.gain.setValueAtTime(0.045 * vol, t + dur - 0.15);
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

  // Saturation curves by drive, made once each.
  curveFor(k) {
    this.curves = this.curves || {};
    if (!this.curves[k]) { const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) cv[i] = Math.tanh(((i / 511.5) - 1) * k); this.curves[k] = cv; }
    return this.curves[k];
  },

  // ---------- Race tracks ----------

  // A race's track. Act 0-3 sets the mood; elites and bosses push harder; the seed picks key, tempo and parts.
  forRace(act, type, seed, final) {
    const r = mulberry32((seed ^ 0x5eed) >>> 0), pick = (a) => a[Math.floor(r() * a.length)];
    const AEOLIAN = [0, 2, 3, 5, 7, 8, 10], PHRYGIAN = [0, 1, 3, 5, 7, 8, 10], HARMONIC = [0, 2, 3, 5, 7, 8, 11], DORIAN = [0, 2, 3, 5, 7, 9, 10];
    const boss = type === 'boss', elite = type === 'elite';
    const P = [
      // Act I, the Undercity: dark, gritty synthwave. Four on the floor, a dirty eighth-note bass.
      { bpm: [100, 104, 106], scale: pick([AEOLIAN, DORIAN]), progs: [[0, 5, 3, 4], [0, 3, 4, 0], [0, 5, 6, 4], [0, 6, 5, 4]], drums: 'four', hats: 8, bass: 8, dist: 2.4,
        arp: pick([[0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null], [0, null, null, 2, null, null, 1, null, 3, null, null, 2, null, null, 1, null]]), arpOct: 0,
        pad: 0.8, padBright: 0.6, bells: 0, choir: 0, toll: false, toms: false },
      // Act II, the Stacks: harder and faster, a Phrygian edge, galloping sixteenth bass and fills.
      { bpm: [112, 116, 118], scale: PHRYGIAN, progs: [[0, 1, 0, 6], [0, 5, 1, 0], [0, 6, 5, 1], [0, 3, 1, 0]], drums: 'drive', hats: 16, bass: 16, dist: 3.2,
        arp: [0, 1, 2, 1, 3, 1, 2, 1, 0, 1, 2, 1, 3, 2, 1, 2], arpOct: 0, pad: 0.7, padBright: 0.8, bells: 0, choir: 0, toll: false, toms: true },
      // Act III, the Gilded Terraces: serious and cinematic. Harmonic minor (a major V that pulls home), bells,
      // string-like pads, the first breath of a choir.
      { bpm: [118, 120, 122], scale: HARMONIC, progs: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 5, 1, 4]], drums: 'four', hats: 16, bass: 8, dist: 1.8,
        arp: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 1, 2, 3], arpOct: 0, pad: 1, padBright: 1.05, bells: 0.7, choir: 0.5, toll: false, toms: true },
      // Act IV, the Crown: ethereal. Half-time drums, a choir of the damned singing for the rich, celesta bells,
      // a sub drone and a great bell tolling every four bars.
      { bpm: [86, 88, 90], scale: AEOLIAN, progs: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 5, 3, 6]], drums: 'half', hats: 8, bass: 'drone', dist: 1.2,
        arp: [0, null, null, 2, null, null, 3, null, null, 1, null, null, 2, null, 3, null], arpOct: 12, pad: 0.5, padBright: 0.9, bells: 1, choir: 1.1, toll: true, toms: true },
    ][Math.min(3, act)];
    const root = 60 + pick([2, 4, 5, 0, 7]); // D, E, F, C or G
    const prog = pick(P.progs), sc = P.scale;
    const deg = (d) => sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const chords = prog.map((d) => [deg(d), deg(d + 2), deg(d + 4)].map((n) => { n += root; while (n > root + 10) n -= 12; return n; }).sort((a, b) => a - b));
    const roots = prog.map((d) => { let n = root - 24 + sc[d % 7]; while (n > 45) n -= 12; return n; });
    // The choir sings the chord low with an added ninth; at the Crown a semitone grinds against it now and then.
    const choirs = prog.map((d, i) => { const c = chords[i]; return [c[0] - 12, c[1] - 12, c[2] - 12, root + deg(d + 1) - (act >= 3 && i === 3 ? 11 : 0)]; });
    let bpm = pick(P.bpm) + (boss ? 6 : elite ? 3 : 0);
    if (final) bpm += 4;
    return Object.assign({}, P, {
      id: 'race:' + act + ':' + type + ':' + seed, style: 'race', bpm, chords, roots, choirs,
      intensity: boss ? 2 : elite ? 1 : 0, toms: P.toms || boss, act3: act >= 3,
      choir: P.choir + (final ? 0.4 : boss && act >= 2 ? 0.2 : 0),
      fourClimax: act >= 3 && (boss || final), // the final race lets the kick loose under the choir
    });
  },

  // Bars 0-3 intro; then a 20-bar loop: groove A (8), full B (8), breakdown (4).
  playRace(bar, s, t, dt) {
    const C = this.cfg, ch = bar % 4, intro = bar < 4, loop = intro ? -1 : (bar - 4) % 20;
    const B = loop >= 8 && loop < 16, brk = loop >= 16;
    const chord = C.chords[ch], root = C.roots[ch], tones = [...chord, chord[0] + 12];
    if (s === 0) {
      if (C.pad) this.pad(t, chord, dt * 16, C.padBright * (brk ? 0.7 : 1), C.pad);
      if (C.choir && (intro || B || brk || C.act3)) this.choir(t, C.choirs[ch], dt * 16, C.choir * (B ? 1 : 0.75), ch % 2 ? 'oo' : 'ah');
      if (C.toll && ch === 0) this.toll(t, root);
    }
    const bright = intro ? 0.3 + bar * 0.1 : brk ? 0.55 : B ? 1 : 0.75;
    const ap = C.arp[s];
    if (ap != null) {
      if (C.bells && (B || brk || C.toll)) this.bell(t, tones[ap] + C.arpOct, 0.05 * C.bells);
      else this.arpNote(t, tones[ap] + C.arpOct + (B && C.hats === 16 && s % 4 === 3 ? 12 : 0), bright);
    }
    if (C.bass === 'drone' && s === 0 && !intro) this.drone(t, root, dt * 16);
    if (intro || brk) {
      if (s % 4 === 2 && C.drums !== 'half') this.hat(t, 0.04, false);
      if (brk && loop === 19 && s === 0) this.riser(t, dt * 16);
      return;
    }
    if ((loop === 0 || loop === 8) && s === 0) this.crash(t);
    // Drums.
    const four = C.drums === 'four' || C.drums === 'drive' || (C.fourClimax && B);
    if (four) {
      if (s % 4 === 0) this.kick(t);
      if (C.drums === 'drive' && ch === 3 && s === 14) this.kick(t);
      if (s === 4 || s === 12) this.snare(t);
    } else { // half time: kick on one, snare on three, a pickup kick
      if (s === 0 || (s === 10 && ch % 2)) this.kick(t);
      if (s === 8) this.snare(t);
    }
    if (C.hats === 16 && (B || C.intensity)) this.hat(t, s % 2 ? 0.045 : s % 4 === 2 ? 0.085 : 0.055, s === 14);
    else if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.08 : 0.045, s === 14);
    if (C.toms && ch === 3 && loop % 8 === 7 && s >= 12) this.tom(t, 52 - (s - 12) * 4);
    if (C.intensity >= 2 && s % 4 === 2 && B) this.tom(t, 40, 0.5); // boss races: a pounding off-beat floor tom
    // Bass.
    if (C.bass === 16) this.bassNote(t, root + (s % 4 === 2 ? 12 : 0), dt * 0.9, C.dist);
    else if (C.bass === 8 && s % 2 === 0) this.bassNote(t, root + (B && (s === 6 || s === 14) ? 12 : 0), dt * 1.8, C.dist);
  },

  // FM bell: a sine carrier with an inharmonic modulator, ringing down into the reverb.
  bell(t, m, vol, dur) {
    const c = Sound.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    dur = dur || 2.2;
    car.frequency.value = this.hz(m); mod.frequency.value = this.hz(m) * 3.5;
    mg.gain.setValueAtTime(this.hz(m) * 2.2, t);
    mg.gain.exponentialRampToValueAtTime(this.hz(m) * 0.1, t + dur * 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    this.env(g, t, 0.004, vol, dur);
    car.connect(g); g.connect(this.duck);
    this.send(g, 1.1, 0.4);
    car.start(t); mod.start(t); car.stop(t + dur + 0.1); mod.stop(t + dur + 0.1);
  },

  // A great bell, very low and long, tolling the start of each phrase.
  toll(t, m) {
    this.bell(t, m + 12, 0.12, 6);
    this.bell(t, m + 24.1, 0.05, 4.5); // a slightly sour upper partial
  },

  tom(t, m, vol) {
    const c = Sound.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(this.hz(m + 7), t);
    o.frequency.exponentialRampToValueAtTime(this.hz(m), t + 0.12);
    this.env(g, t, 0.003, 0.5 * (vol || 1), 0.35);
    o.connect(g); g.connect(this.bus);
    this.send(g, 0.8);
    o.start(t); o.stop(t + 0.42);
  },

  // A long sub note under the half-time Crown tracks.
  drone(t, m, dur) {
    const c = Sound.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.frequency.value = this.hz(m - 12); o2.type = 'sawtooth'; o2.frequency.value = this.hz(m); o2.detune.value = 5;
    f.type = 'lowpass'; f.frequency.value = 260;
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.3);
    g.gain.setValueAtTime(0.3, t + dur - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
    o.connect(g); o2.connect(f); f.connect(g); g.connect(this.duck);
    o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
  },

  // Choir: detuned saw voices through vowel formant filters, with a slow vibrato and a long swell. 'ah' or 'oo'.
  choir(t, notes, dur, vol, vowel) {
    const c = Sound.ctx, out = c.createGain(), mix = c.createGain();
    const F = vowel === 'oo' ? [[350, 9, 1], [700, 10, 0.4], [2500, 12, 0.12]] : [[780, 8, 1], [1150, 10, 0.55], [2850, 12, 0.22]];
    for (const [fr, q, amp] of F) {
      const bp = c.createBiquadFilter(), fg = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q; fg.gain.value = amp;
      mix.connect(bp); bp.connect(fg); fg.connect(out);
    }
    out.gain.value = 0;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(0.5 * vol, t + Math.min(1.2, dur * 0.4)); // the formant filters eat most of the energy, hence the big gain
    out.gain.setValueAtTime(0.5 * vol, t + dur - 0.25);
    out.gain.linearRampToValueAtTime(0.0001, t + dur + 0.7);
    out.connect(this.bus);
    this.send(out, 2.4);
    for (const n of notes) for (let v = 0; v < 3; v++) {
      const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = this.hz(n); o.detune.value = (v - 1) * 11 + (Math.random() - 0.5) * 6;
      lfo.frequency.value = 4.6 + Math.random() * 1.2; lg.gain.value = this.hz(n) * 0.006;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(mix);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.8); lfo.stop(t + dur + 0.8);
    }
  },
};
