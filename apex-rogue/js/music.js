'use strict';
// Music, synthesized live like the rest of the sound: no audio files. The score leans on Daft Punk's Tron: Legacy:
// a pulsing sixteenth-note synth bass whose filter opens across each phrase, pumping under a hard kick; staccato
// string ostinatos; huge synth-brass swells and stabs; a distorted square lead that slides between its notes;
// claps, taiko in the cinematic acts. Every track is generated (see Music.forRace): the act sets the mood, from the
// Undercity's "End of Line" pulse through the Stacks' grinding "Derezzed" lead and the Terraces' cinematic grid to
// the Crown's half-time strings, brass and choir; the race type, the weather and the seed vary key, tempo and parts.
// The menu plays one too.

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
  MENU: null, // built below (Music.menuTrack)
  INTRO: { id: 'intro', style: 'intro', bpm: 72 }, // the cold open's one-shot cue (see playIntro)

  get level() {
    const race = this.cfg && this.cfg.style === 'race';
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
    if (this.cfg.lowpass) { // a muffled mix (rain on the roof)
      this.lp = c.createBiquadFilter();
      this.lp.type = 'lowpass'; this.lp.frequency.value = this.cfg.lowpass; this.lp.Q.value = 0.5;
      this.bus.connect(this.lp); this.lp.connect(Sound.bed || Sound.master);
    } else this.bus.connect(Sound.bed || Sound.master);
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
    v.gain.value = verbAmt * this.level * ((this.cfg && this.cfg.reverb) || 1);
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
    const sixteenth = 60 / this.cfg.bpm / 4, play = this.cfg.style === 'intro' ? this.playIntro : this.playRace;
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
    this.env(g, t, 0.003, 0.82, 0.42);
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

  hat(t, vol, open) { this.noise(t, open ? 0.2 : 0.035, 'highpass', 7500, 0.5, vol * 1.5, open ? 0.3 : 0); },

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
  forRace(act, type, seed, final, weather) {
    const r = mulberry32((seed ^ 0x5eed) >>> 0), pick = (a) => a[Math.floor(r() * a.length)];
    const AEOLIAN = [0, 2, 3, 5, 7, 8, 10], PHRYGIAN = [0, 1, 3, 5, 7, 8, 10], HARMONIC = [0, 2, 3, 5, 7, 8, 11], DORIAN = [0, 2, 3, 5, 7, 9, 10];
    const boss = type === 'boss', elite = type === 'elite';
    const P = [
      // Act I, the Undercity: "End of Line". A minor loop over a pulsing octave bass, claps on two and four, a
      // gated arp into the echo; the brass and strings come in on the B.
      { bpm: [120, 122, 124], scale: pick([AEOLIAN, DORIAN]), progs: [[0, 5, 2, 6], [0, 5, 3, 6], [0, 3, 5, 4], [0, 6, 5, 6]], drums: 'four', clap: true, hats: 16,
        bassPat: 'octave', dist: 1.8, arp: pick([[0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null], [0, null, null, 2, null, null, 1, null, 3, null, null, 2, null, null, 1, null]]), arpOct: 12,
        strings: 0.5, stringsA: false, brass: 0.75, brassA: false, lead: null, taiko: false, pedal: false, pad: 0.45, padBright: 0.7, bells: 0, choir: 0, toll: false, toms: false },
      // Act II, the Stacks: "Derezzed". Fast and grinding: a galloping bass, a distorted square lead sliding through
      // its riff, toms into every phrase.
      { bpm: [132, 136, 140], scale: pick([AEOLIAN, PHRYGIAN]), progs: [[0, 0, 5, 6], [0, 6, 5, 6], [0, 0, 3, 4]], drums: 'drive', clap: true, hats: 16,
        bassPat: 'derez', dist: 3, arp: null, arpOct: 0, strings: 0, stringsA: false, brass: 0.55, brassA: false,
        lead: pick([[0, null, 0, null, 3, null, 2, null, 0, null, -1, null, 0, null, 4, 3], [0, 0, null, 2, null, 3, null, 4, null, 3, 2, null, 0, null, -2, null]]),
        taiko: false, pedal: false, pad: 0, padBright: 0.8, bells: 0, choir: 0, toll: false, toms: true },
      // Act III, the Gilded Terraces: "The Grid". Cinematic: spiccato strings racing over a tonic pedal, brass
      // swelling every bar, taiko on the B, bells, the first breath of a choir.
      { bpm: [116, 118, 120], scale: HARMONIC, progs: [[0, 5, 3, 4], [0, 5, 1, 4], [0, 3, 5, 4]], drums: 'four', clap: false, hats: 16,
        bassPat: 'straight', dist: 1.4, arp: null, arpOct: 0, strings: 1, stringsA: true, brass: 1, brassA: true, lead: null,
        taiko: true, pedal: true, pad: 0.4, padBright: 0.9, bells: 0.45, choir: 0.45, toll: false, toms: true },
      // Act IV, the Crown: the end titles. Half-time, enormous strings and brass, a choir of the damned singing for
      // the rich, a great bell tolling every four bars.
      { bpm: [86, 88, 90], scale: AEOLIAN, progs: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 5, 3, 6]], drums: 'half', clap: false, hats: 8,
        bassPat: 'half', dist: 1.2, arp: null, arpOct: 0, strings: 1.1, stringsA: true, brass: 1.3, brassA: true, lead: null,
        taiko: true, pedal: false, pad: 0.4, padBright: 0.9, bells: 0.8, choir: 1.1, toll: true, toms: true },
    ][Math.min(3, act)];
    const root = 60 + pick([2, 4, 5, 0, 7]); // D, E, F, C or G
    return this.build(P, root, pick(P.progs), r, {
      id: 'race:' + act + ':' + type + ':' + seed + ':' + (weather || 'clear'), style: 'race',
      bpm: pick(P.bpm) + (boss ? 6 : elite ? 3 : 0) + (final ? 4 : 0),
      intensity: boss ? 2 : elite ? 1 : 0, toms: P.toms || boss, act3: act >= 3,
      choir: P.choir + (final ? 0.4 : boss && act >= 2 ? 0.2 : 0),
      fourClimax: act >= 3 && (boss || final), // the final race lets the kick loose under the choir
      stabs: boss || final, // "the game has changed": brass hits on the B
    }, weather);
  },

  // Chords, roots and voicings from a preset, a key and a progression; then the weather's colour.
  build(P, root, prog, r, extra, weather) {
    const sc = P.scale;
    const deg = (d) => sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const chords = prog.map((d) => [deg(d), deg(d + 2), deg(d + 4)].map((n) => { n += root; while (n > root + 10) n -= 12; return n; }).sort((a, b) => a - b));
    const roots = prog.map((d) => { let n = root - 24 + sc[((d % 7) + 7) % 7]; while (n > 45) n -= 12; return n; });
    // The choir sings the chord low with an added ninth; at the Crown a semitone grinds against it now and then.
    const choirs = prog.map((d, i) => { const c = chords[i]; return [c[0] - 12, c[1] - 12, c[2] - 12, root + deg(d + 1) - (extra.act3 && i === 3 ? 11 : 0)]; });
    const tonic = roots[0], leadNote = (d) => root + deg(d); // the lead's riff is in degrees of the key
    const cfg = Object.assign({}, P, { chords, roots, choirs, tonic, leadNote, root }, extra);
    // The weather colours the track: rain muffles it, storms and furnaces drive it harder, fog and blackouts open
    // up the reverb, a gala crashes in on every section.
    const wm = (typeof WEATHER !== 'undefined' && WEATHER[weather] && WEATHER[weather].music) || {};
    if (wm.lowpass) cfg.lowpass = wm.lowpass;
    if (wm.padBright) cfg.padBright *= wm.padBright;
    if (wm.intensity) cfg.intensity = Math.min(2, cfg.intensity + wm.intensity);
    if (wm.toms) cfg.toms = true;
    if (wm.reverb) cfg.reverb = wm.reverb;
    if (wm.crash) cfg.crashEvery = true;
    return cfg;
  },

  // The title's track: "The Grid" at 120, in D minor, the brass carrying it.
  menuTrack() {
    const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
    return this.build({ scale: AEOLIAN, drums: 'four', clap: true, hats: 16, bassPat: 'octave', dist: 1.6, arp: [0, null, 2, null, 1, null, 3, null, 0, null, 2, null, 3, null, 1, null], arpOct: 12,
      strings: 0.7, stringsA: true, brass: 0.9, brassA: false, lead: null, taiko: false, pedal: true, pad: 0.5, padBright: 0.8, bells: 0, choir: 0, toll: false, toms: false },
    62, [0, 5, 2, 6], Math.random, { id: 'menu', style: 'menu', bpm: 120, intensity: 0, act3: false, choir: 0 });
  },

  // Bars 0-3 intro (the bass alone, its filter opening); then a 20-bar loop: groove A (8), full B (8),
  // breakdown (4: strings and brass swelling, no kick, a riser into the next downbeat).
  playRace(bar, s, t, dt) {
    const C = this.cfg, ch = bar % 4, intro = bar < 4, loop = intro ? -1 : (bar - 4) % 20;
    const B = loop >= 8 && loop < 16, brk = loop >= 16, A = !intro && !B && !brk;
    const chord = C.chords[ch], root = C.pedal && ch !== 3 ? C.tonic : C.roots[ch], tones = [...chord, chord[0] + 12];
    // The filter opens across a phrase: through the intro, up the A, wide on the B, shut for the breakdown.
    const cut = intro ? 220 + ((bar * 16 + s) / 64) * 1100 : A ? 750 + (loop / 8) * 900 + (s / 16) * 110 : B ? 2300 : 480;
    if (s === 0) {
      if (C.pad && !B) this.pad(t, chord, dt * 16, C.padBright * (brk ? 0.7 : 0.85), C.pad);
      if (C.choir && (intro || B || brk || C.act3)) this.choir(t, C.choirs[ch], dt * 16, C.choir * (B ? 1 : 0.75), ch % 2 ? 'oo' : 'ah');
      if (C.toll && ch === 0) this.toll(t, C.roots[ch]);
      // The brass: a swell across each bar of the B (and the A, in the cinematic acts), the breakdown's last
      // two bars rising into the drop.
      if (C.brass && (B || (C.brassA && A) || (brk && loop >= 18))) this.brass(t, chord.map((n) => n - 12), dt * 16, C.brass * (B ? 1 : 0.65), brk ? 'rise' : 'swell');
      if (C.strings && (brk || C.act3)) this.cellos(t, [C.roots[ch] + 12, chord[0]], dt * 16, C.strings);
    }
    if (C.stabs && B && (s === 0 || s === 6 || s === 10)) this.brass(t, chord.map((n) => n - 12), dt * 2.5, 1.1, 'stab');
    // Strings: a spiccato ostinato up the chord (the B, or the whole loop in the cinematic acts).
    if (C.strings && (B || (C.stringsA && A))) this.spiccato(t, tones[[0, 1, 2, 1, 3, 1, 2, 1, 0, 1, 2, 1, 3, 2, 1, 2][s]] + 12, 0.055 * C.strings * (s % 4 === 0 ? 1.25 : 1));
    // The arp, gated into the echo; bells instead in the B when the act has them.
    const ap = C.arp && C.arp[s];
    if (ap != null && !intro) {
      if (C.bells && B) this.bell(t, tones[ap] + C.arpOct, 0.05 * C.bells);
      else this.arpNote(t, tones[ap] + C.arpOct, intro ? 0.3 : brk ? 0.5 : B ? 1 : 0.7);
    }
    if (C.bells && !C.arp && B && s % 4 === 0) this.bell(t, tones[(s / 4) % 4] + 12, 0.04 * C.bells);
    // The lead: on the B, sliding from note to note.
    if (C.lead && B && C.lead[s] != null) this.lead(t, C.leadNote(C.lead[s]) + 12, dt * 1.6);
    // The pulse bass, under everything from the first bar.
    const pat = { octave: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0], derez: [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 12, 0, 12], straight: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], half: [0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 12, null, 0, null] }[C.bassPat];
    if (pat && pat[s] != null && !(brk && s % 2)) this.pulse(t, root + pat[s], dt * (C.bassPat === 'half' ? 1.8 : 0.85), cut, s % 4 === 0, C.dist);
    if (intro || brk) {
      if (s % 4 === 2 && C.drums !== 'half' && !intro) this.hat(t, 0.04, false);
      if (brk && loop === 19 && s === 0) this.riser(t, dt * 16);
      if (brk && loop === 19 && C.taiko && s >= 8 && s % 2 === 0) this.taiko(t, 0.5 + (s - 8) * 0.07);
      return;
    }
    if ((loop === 0 || loop === 8 || (C.crashEvery && loop % 4 === 0)) && s === 0) { this.crash(t); if (C.taiko || C.stabs) this.taiko(t, 1); }
    // Drums.
    const four = C.drums === 'four' || C.drums === 'drive' || (C.fourClimax && B);
    if (four) {
      if (s % 4 === 0) this.kick(t);
      if (C.drums === 'drive' && ch === 3 && s === 14) this.kick(t);
      if (s === 4 || s === 12) { if (C.clap) this.clap(t); else this.snare(t); }
    } else { // half time: kick on one, snare on three, a pickup kick
      if (s === 0 || (s === 10 && ch % 2)) this.kick(t);
      if (s === 8) this.snare(t);
    }
    if (C.taiko && B && (s === 0 || s === 8 || (s === 14 && ch === 3))) this.taiko(t, s === 0 ? 0.9 : 0.6);
    if (C.hats === 16 && (B || C.intensity || C.drums === 'drive')) this.hat(t, s % 2 ? 0.04 : s % 4 === 2 ? 0.085 : 0.05, s === 14);
    else if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.08 : 0.045, s === 14);
    if (C.toms && ch === 3 && loop % 8 === 7 && s >= 12) this.tom(t, 52 - (s - 12) * 4);
    if (C.intensity >= 2 && s % 4 === 2 && B) this.tom(t, 40, 0.5); // boss races: a pounding off-beat floor tom
  },

  // ---------- The Tron instruments ----------

  // The pulse bass: a saw and a square through a resonant low-pass that snaps on each note and is opened across
  // the phrase (cut), a little fuzz, pumped by the kick; the downbeats accented.
  pulse(t, m, dur, cut, accent, dist) {
    const c = Sound.ctx, f = c.createBiquadFilter(), sh = c.createWaveShaper(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = 7;
    const top = Math.min(8000, cut * (accent ? 1.6 : 1.15));
    f.frequency.setValueAtTime(top, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(90, cut * 0.45), t + dur * 0.9);
    sh.curve = this.curveFor(dist || 1.6);
    this.env(g, t, 0.003, accent ? 0.2 : 0.15, dur);
    f.connect(sh); sh.connect(g); g.connect(this.duck);
    const o = c.createOscillator(), o2 = c.createOscillator();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = this.hz(m); o2.frequency.value = this.hz(m); o2.detune.value = 7;
    o.connect(f); o2.connect(f); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    if (accent) { // a sine sub under the downbeats
      const sub = c.createOscillator(), sg = c.createGain();
      sub.frequency.value = this.hz(m - 12);
      this.env(sg, t, 0.004, 0.22, dur * 1.6);
      sub.connect(sg); sg.connect(this.duck); sub.start(t); sub.stop(t + dur * 1.6 + 0.05);
    }
  },

  // Synth brass: stacked detuned saws with a square an octave down for weight, the filter opening as the note
  // swells ("bwaaah"), a touch of vibrato on the long ones. 'swell' fills a bar, 'rise' builds through it, 'stab'
  // is a hit.
  brass(t, notes, dur, vol, kind) {
    const c = Sound.ctx, f = c.createBiquadFilter(), g = c.createGain(), stab = kind === 'stab';
    const atk = stab ? 0.012 : kind === 'rise' ? dur * 0.9 : 0.22, peak = 0.11 * vol;
    f.type = 'lowpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(180, t);
    f.frequency.exponentialRampToValueAtTime(stab ? 3200 : 2400, t + Math.max(0.02, atk * (stab ? 1 : 1.2)));
    f.frequency.exponentialRampToValueAtTime(stab ? 600 : 1100, t + dur);
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    if (stab) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else { g.gain.setValueAtTime(peak, t + dur - 0.1); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.35); }
    f.connect(g); g.connect(this.duck);
    this.send(g, stab ? 1.4 : 1.1);
    const end = t + dur + 0.4;
    for (const n of notes) {
      for (const det of [-11, 0, 11]) {
        const o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = this.hz(n); o.detune.value = det;
        if (!stab && dur > 1) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(this.hz(n) * 0.004, t + 0.8); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(end); }
        o.connect(f); o.start(t); o.stop(end);
      }
      const q = c.createOscillator(), qg = c.createGain();
      q.type = 'square'; q.frequency.value = this.hz(n - 12); qg.gain.value = 0.6;
      q.connect(qg); qg.connect(f); q.start(t); q.stop(end);
    }
  },

  // Spiccato strings: two detuned saws, bowed short and bright, into the hall.
  spiccato(t, m, vol) {
    const c = Sound.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(5200, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
    this.env(g, t, 0.006, vol, 0.14);
    f.connect(g); g.connect(this.duck);
    this.send(g, 0.9);
    for (const det of [-9, 9]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.hz(m); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + 0.2); }
  },

  // Low strings: cellos and basses holding the bar, a slow bow in, vibrato.
  cellos(t, notes, dur, vol) {
    const c = Sound.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.6;
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05 * vol, t + 0.45);
    g.gain.setValueAtTime(0.05 * vol, t + dur - 0.15);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
    f.connect(g); g.connect(this.duck);
    this.send(g, 0.8);
    for (const n of notes) for (const det of [-12, 0, 12]) {
      const o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = this.hz(n - 12); o.detune.value = det;
      l.frequency.value = 4.8 + Math.random() * 0.8; lg.gain.value = this.hz(n - 12) * 0.005;
      l.connect(lg); lg.connect(o.frequency);
      o.connect(f); o.start(t); l.start(t); o.stop(t + dur + 0.35); l.stop(t + dur + 0.35);
    }
  },

  // The Derezzed lead: a fuzzed square and saw sliding up from the last note, bright, into the echo.
  lead(t, m, dur) {
    const c = Sound.ctx, f = c.createBiquadFilter(), sh = c.createWaveShaper(), g = c.createGain();
    const from = this.lastLead != null && Math.abs(this.lastLead - m) < 13 ? this.lastLead : m;
    this.lastLead = m;
    f.type = 'lowpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(1600, t + dur);
    sh.curve = this.curveFor(3.5);
    this.env(g, t, 0.004, 0.085, dur);
    f.connect(sh); sh.connect(g); g.connect(this.duck);
    this.send(g, 0.5, 0.5);
    for (const [type, det] of [['square', 0], ['sawtooth', 9]]) {
      const o = c.createOscillator();
      o.type = type; o.detune.value = det;
      o.frequency.setValueAtTime(this.hz(from), t); o.frequency.exponentialRampToValueAtTime(this.hz(m), t + 0.045);
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
  },

  // A clap: three quick bursts of band-passed noise and a short tail into the reverb.
  clap(t) {
    for (const [d, v] of [[0, 0.32], [0.011, 0.28], [0.022, 0.36]]) this.noise(t + d, d === 0.022 ? 0.16 : 0.012, 'bandpass', 1300, 0.9, v, d === 0.022 ? 1.2 : 0);
  },

  // Taiko: a huge low drum, a skin slap on top, thrown into the hall.
  taiko(t, vol) {
    const c = Sound.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    this.env(g, t, 0.003, 0.75 * vol, 0.9);
    o.connect(g); g.connect(this.bus);
    this.send(g, 1.3);
    o.start(t); o.stop(t + 1);
    this.noise(t, 0.08, 'lowpass', 900, 0.7, 0.35 * vol, 0.8);
  },

  // The cold open: eight bars at 72 bpm in D minor, scored to the cut (see INTRO_SHOTS in intro.js). The cell is a
  // drone, a bell and dripping notes; the walk adds a heartbeat and a low choir; the garage a pulsing bass; the
  // last bar is a snare roll and a riser into the title, which lands on the downbeat of bar 8. Then it rings out.
  playIntro(bar, s, t, dt) {
    if (bar > 8) return;
    const D = [62, 65, 69], Bb = [58, 62, 65], Gm = [55, 58, 62], A = [57, 61, 64];
    const chord = [null, null, D, D, Bb, Gm, A, A, D][bar];
    if (bar === 8) {
      if (s === 0) {
        this.crash(t); this.kick(t); this.toll(t, 38);
        this.pad(t, [62, 65, 69, 74], dt * 40, 1.3, 1.6);
        this.choir(t, [50, 57, 62, 65], dt * 36, 1.2, 'ah');
        this.bassNote(t, 26, dt * 12, 2);
        this.drone(t, 38, dt * 40);
      }
      return;
    }
    if (s === 0) {
      if (bar % 2 === 0) this.drone(t, 38, dt * 32);
      if (bar === 0 || bar === 4 || bar === 6) this.toll(t, bar === 6 ? 33 : 38);
      if (chord) this.pad(t, chord, dt * 16, bar >= 6 ? 0.9 : 0.55, bar >= 4 ? 1 : 0.7);
      if (bar >= 2 && bar < 6) this.choir(t, chord.map((n) => n - 12), dt * 16, 0.55 + 0.1 * (bar - 2), bar < 4 ? 'oo' : 'ah');
      if (bar >= 6) this.choir(t, chord.map((n) => n - 12), dt * 16, 0.9, 'ah');
    }
    if (bar < 2) { if (s === 6 || (bar === 1 && s === 13)) this.bell(t, [74, 81, 77, 76][(bar * 2 + (s > 8 ? 1 : 0)) % 4], 0.03, 1.6); return; } // drips in the cell
    // From the corridor on: a heartbeat (lub-dub on each half bar), quickening into four on the floor at bar 6.
    if (bar < 6) { if (s === 0 || s === 8) this.kick(t); if ((s === 2 || s === 10) && bar >= 3) this.kick(t); }
    else if (s % 4 === 0) this.kick(t);
    if (bar >= 5 && s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.06 : 0.035, false);
    if (bar >= 4 && s % 2 === 0) this.bassNote(t, [38, 38, 34, 31, 33, 33][bar - 2] + (bar >= 6 && s % 4 === 2 ? 12 : 0), dt * 1.7, 2.2);
    if (bar === 6 && (s === 4 || s === 12)) this.snare(t);
    if (bar === 7) { // the run-in: snares doubling up, toms tumbling down, a riser into the hit
      if (s === 0) this.riser(t, dt * 16);
      if (s < 8 ? s % 4 === 0 : s < 12 ? s % 2 === 0 : true) this.snare(t);
      if (s >= 12) this.tom(t, 50 - (s - 12) * 4, 0.8);
    }
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
Music.MENU = Music.menuTrack();
