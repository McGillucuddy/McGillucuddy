'use strict';
// The intro: a gate (browsers keep the sound off until a click or key), the Category 2 Games sting, then a cold
// open rendered in engine: your cell door slides open, the walk down death row, your car under the garage lamp,
// the shutter rises and the title lands. The sting plays at every launch; the cold open plays the first time and
// from the title menu. Any key or click skips ahead.

const STUDIO = { name: 'Category 2 Games', word: 'CATEGORY 2', sub: 'GAMES' };
const STING_LEN = 6.4;
const INTRO_BAR = 240 / Music.INTRO.bpm; // 3.33 s
const INTRO_SLAM = 8 * INTRO_BAR; // the title lands on the downbeat of bar 8 of the score
const INTRO_END = INTRO_SLAM + 3.4;
// The cut, in seconds from the first frame of the cold open.
const INTRO_SHOTS = { cell: 0, corridor: 8.0, garage: 15.2, launch: 22.6 };
const INTRO_LINES = [
  { t: 0.8, d: 4.0, cls: 'stamp', text: 'STATE PENITENTIARY 9 &nbsp;·&nbsp; DEATH ROW &nbsp;·&nbsp; 04:12' },
  { t: 3.4, d: 3.8, who: 'Guard', text: 'Up, {n}. Somebody bought your ticket.' },
  { t: 8.5, d: 3.0, text: 'Once a year, the Crown opens the gates.' },
  { t: 11.8, d: 3.1, text: 'Three acts, then the Crown. Every car is armed.' },
  { t: 15.8, d: 3.0, text: 'Win, and you walk free.' },
  { t: 19.3, d: 1.6, text: 'Lose…' },
  { t: 20.9, d: 2.2, text: '…and nobody comes looking.' },
];

const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

// One-off sound effects for the intro, built on the game's audio context.
const IntroSfx = {
  get ok() { return !!(Sound.ctx && Sound.master); },
  out(g) { g.connect(Sound.master); },
  noise(t, dur, type, freq, q, vol, opts) {
    if (!this.ok) return null;
    opts = opts || {};
    const c = Sound.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = Sound.noise; src.loop = true;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t + dur);
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack || 0.004));
    if (opts.hold) g.gain.setValueAtTime(vol, t + opts.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); this.out(g);
    src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.05);
    return g;
  },
  tone(t, f0, f1, dur, type, vol, attack) {
    if (!this.ok) return;
    const c = Sound.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this.out(g);
    o.start(t); o.stop(t + dur + 0.05);
  },
  at(dt) { return Sound.ctx.currentTime + (dt || 0); },
  // Sting
  ping(dt) { if (!this.ok) return; const t = this.at(dt); this.tone(t, 1320, 1320, 0.5, 'sine', 0.07); this.tone(t + 0.16, 1320, 1320, 0.5, 'sine', 0.025); },
  wind(dt, dur) { if (this.ok) this.noise(this.at(dt), dur, 'bandpass', 380, 1.4, 0.09, { attack: dur * 0.5, sweep: 900 }); },
  thunder(dt) {
    if (!this.ok) return;
    const t = this.at(dt);
    this.noise(t, 0.25, 'highpass', 1800, 0.5, 0.5); // the crack
    this.noise(t + 0.02, 3.2, 'lowpass', 520, 0.7, 0.6, { attack: 0.05, sweep: 90 }); // the roll
    this.tone(t, 72, 30, 2.2, 'sine', 0.6); // a sub boom under it
    // A bright minor-ninth stab for the logo, fading into the storm.
    const c = Sound.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + 2.6);
    g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    f.connect(g); this.out(g);
    for (const m of [50, 57, 62, 65, 69, 76]) for (const det of [-10, 10]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = Music.hz(m); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + 3.1);
    }
  },
  // Cold open
  clank(dt) {
    if (!this.ok) return;
    const t = this.at(dt);
    this.noise(t, 0.18, 'bandpass', 2600, 3, 0.35);
    for (const [f, v] of [[183, 0.12], [277, 0.08], [441, 0.06], [1210, 0.03]]) this.tone(t, f, f * 0.98, 0.9, 'triangle', v);
    this.tone(t, 90, 45, 0.3, 'sine', 0.4);
  },
  slide(dt, dur) { // a barred door rolling on its track
    if (!this.ok) return;
    const t = this.at(dt);
    this.noise(t, dur, 'lowpass', 380, 1.5, 0.22, { attack: 0.1, hold: dur - 0.3 });
    for (let k = 0; k < dur * 14; k++) this.noise(t + k / 14 + Math.random() * 0.02, 0.05, 'bandpass', 1600 + Math.random() * 900, 4, 0.05);
  },
  step(dt, vol) { if (this.ok) { const t = this.at(dt); this.noise(t, 0.12, 'lowpass', 420, 0.8, 0.14 * (vol || 1)); this.tone(t, 80, 50, 0.1, 'sine', 0.12 * (vol || 1)); } },
  clunk(dt) { if (this.ok) { const t = this.at(dt); this.noise(t, 0.12, 'bandpass', 900, 2, 0.25); this.tone(t, 120, 70, 0.15, 'square', 0.06); } },
  starter(dt) { if (this.ok) { const t = this.at(dt); for (let k = 0; k < 7; k++) this.tone(t + k * 0.11, 140, 110, 0.1, 'sawtooth', 0.05); } },
  roller(dt, dur) { if (this.ok) { const t = this.at(dt); this.noise(t, dur, 'bandpass', 700, 0.8, 0.25, { attack: 0.2, hold: dur - 0.3 }); for (let k = 0; k < dur * 9; k++) this.noise(t + k / 9, 0.06, 'bandpass', 2400, 3, 0.06); } },
  crowd(dt, dur, vol) { // a stadium roar swelling up through the open shutter
    if (!this.ok) return;
    const t = this.at(dt);
    this.noise(t, dur, 'bandpass', 900, 0.5, 0.3 * vol, { attack: dur * 0.6, hold: dur * 0.75 });
    this.noise(t, dur, 'highpass', 2600, 0.5, 0.08 * vol, { attack: dur * 0.6, hold: dur * 0.75 });
  },
};

class Intro {
  // opts.gate: wait for a click or key first. opts.cold: play the cold open after the sting.
  constructor(game, opts) {
    this.g = game;
    this.cold = !!opts.cold;
    this.phase = opts.gate ? 'gate' : 'sting';
    this.t = 0;
    this.lastLine = -1;
    this.el = document.createElement('div');
    this.el.id = 'intro';
    this.el.innerHTML = `
      <canvas class="i-gl"></canvas><canvas class="i-2d"></canvas>
      <div class="i-bar top"></div><div class="i-bar bot"></div>
      <div class="i-cap"></div>
      <div class="i-slam"><h1 class="t-logo"><small>${STUDIO.name} presents</small>DEATH ROW<span>DERBY</span></h1></div>
      <div class="i-flash"></div>
      <div class="i-gate"><b>▶</b> Click or press any key<small>Best with sound on</small></div>
      <div class="i-skip">Any key to skip</div>`;
    document.body.appendChild(this.el);
    const q = (s) => this.el.querySelector(s);
    this.c2 = q('.i-2d'); this.x2 = this.c2.getContext('2d');
    this.cap = q('.i-cap'); this.slam = q('.i-slam'); this.flash = q('.i-flash');
    this.el.classList.toggle('gating', this.phase === 'gate');
    this.onInput = (e) => {
      if (e.type === 'keydown' && (e.repeat || e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta')) return;
      e.preventDefault();
      e.stopPropagation(); // the game's own key handling waits until the intro is gone
      this.input();
    };
    window.addEventListener('keydown', this.onInput, true);
    this.el.addEventListener('pointerdown', this.onInput);
    this.sizeSting();
    if (this.phase === 'sting') this.startSting();
    if (this.cold) {
      try { this.build(q('.i-gl')); } catch (e) { console.error(e); this.cold = false; }
    }
  }

  // Queue the meshing of the models the cold open uses ahead of everything else (see Proto.init's warm-up).
  static warm(game) {
    Models.car(Intro.carLook(game));
    for (const p of Intro.people(game)) People.figure(p.o);
  }

  static carLook(game) {
    const b = game.build || newBuild();
    return Object.assign({}, carLook(game.cos, b), { grime: 'filthy', bumper: 'pushbar', roof: 'cage' });
  }

  // The guard and the inmates watching you go by: [figure options, x, z, facing].
  static people(game) {
    const L = [{ o: { seed: 41, pose: 'stand', role: 'trader', cell: 0.1, suit: '#1f2733', number: 'C.O. 9', looks: { gear: 'cap', hat: '#141a24', beard: false, shades: false } }, guard: true }];
    const spots = [[1, -1, 7], [2, 1, 5], [3, -1, 10], [3, 1, 3], [4, 1, 8], [5, -1, 4], [6, 1, 6], [6, -1, 9]];
    for (const [k, side, dx] of spots) L.push({ o: { seed: 100 + k * 7 + side, pose: 'stand', role: 'trader', cell: 0.1, suit: '#a8521e', number: String(3000 + ((k * 731 + side * 97) % 6000)) }, x: k * 24 + dx, z: side * 13.5 });
    return L;
  }

  input() {
    if (this.phase === 'gate') { Sound.resume(); this.startSting(); return; }
    if (this.phase === 'sting' && this.cold) this.startCold();
    else this.end();
  }

  sizeSting() {
    const W = window.innerWidth, H = window.innerHeight, h = 216;
    this.c2.height = h; this.c2.width = Math.round((h * W) / Math.max(1, H));
  }

  startSting() {
    this.phase = 'sting';
    this.t = 0;
    this.el.classList.remove('gating');
    this.el.classList.add('sting');
    this.sfx = { ping: 0, thunder: false };
    if (IntroSfx.ok) IntroSfx.wind(0.2, 6.2);
  }

  startCold() {
    this.phase = 'cold';
    this.t = 0;
    this.el.classList.remove('sting');
    this.el.classList.add('cold');
    this.audio0 = Sound.ctx ? Sound.ctx.currentTime + 0.1 : null; // Music.start puts bar 0 a tenth of a second out
    this.cues = {};
    this.lastLine = -1;
  }

  end() {
    if (this.phase === 'done') return;
    this.phase = 'done';
    Sound.engine(0, 0, false, false);
    window.removeEventListener('keydown', this.onInput, true);
    this.el.classList.add('out');
    setTimeout(() => this.dispose(), 700);
    this.g.introDone();
  }

  dispose() {
    this.el.remove();
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer = null; }
  }

  // The track Music should play right now.
  music() { return this.phase === 'cold' && this.t < INTRO_END ? Music.INTRO : null; }

  update(dt) {
    if (this.phase === 'done' || this.phase === 'gate') return;
    if (this.phase === 'sting') {
      this.t += dt;
      this.drawSting(this.t);
      if (this.t >= STING_LEN) { if (this.cold) this.startCold(); else this.end(); }
      return;
    }
    // The cold open runs on the audio clock so the cut stays on the score even if a frame stalls.
    const ctx = Sound.ctx;
    this.t = ctx && this.audio0 != null && ctx.state === 'running' ? Math.max(0, ctx.currentTime - this.audio0) : this.t + dt;
    this.cue(this.t);
    this.captions(this.t);
    this.renderCold(this.t, dt);
    if (this.t >= INTRO_END) this.end();
  }

  // ---------- The sting: a storm on a weather radar, a lightning strike, the logo. ----------
  drawSting(t) {
    const x = this.x2, W = this.c2.width, H = this.c2.height, cx = W / 2, cy = H / 2 - 6;
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    const S = this.sfx;
    if (S.ping < 3 && t > 0.5 + S.ping * 1.1) { IntroSfx.ping(0); S.ping++; }
    if (!S.thunder && t > 3.3) { IntroSfx.thunder(0); S.thunder = true; }
    const fadeOut = 1 - span(t, 5.7, 6.3);
    if (t < 3.3) {
      // Radar: range rings, a sweep, and a two-armed storm cell lighting up as the sweep passes.
      const a = span(t, 0.25, 0.9), R = 88, sweep = t * 2.6;
      x.strokeStyle = `rgba(57,255,136,${0.22 * a})`; x.lineWidth = 1;
      for (const r of [R / 3, (2 * R) / 3, R]) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); }
      x.beginPath(); x.moveTo(cx - R, cy); x.lineTo(cx + R, cy); x.moveTo(cx, cy - R); x.lineTo(cx, cy + R); x.stroke();
      for (let k = 0; k < 24; k++) { // the trailing glow of the sweep
        const an = sweep - k * 0.03;
        x.strokeStyle = `rgba(57,255,136,${(0.5 - k * 0.02) * a})`;
        x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R); x.stroke();
      }
      const grow = span(t, 0.4, 2.8), rot = t * 0.35;
      for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 70; i++) {
        const f = i / 70, r = 7 + f * 74 * grow, an = arm * Math.PI + rot + f * 3.4;
        for (let j = 0; j < 3; j++) {
          const jr = r + Math.sin(i * 12.9898 + j * 78.233) * (2 + f * 6), ja = an + Math.cos(i * 4.1 + j * 9.7) * 0.12;
          const px = cx + Math.cos(ja) * jr, py = cy + Math.sin(ja) * jr;
          if (Math.hypot(px - cx, py - cy) > R) continue;
          const since = ((sweep - ja) % TAU + TAU) % TAU; // radians since the sweep passed
          const lit = Math.exp(-since * 0.55) * a * (1 - f * 0.55);
          if (lit < 0.04) continue;
          x.fillStyle = f < 0.25 ? `rgba(255,70,50,${lit})` : f < 0.5 ? `rgba(255,214,60,${lit})` : `rgba(57,255,136,${lit})`;
          const s = f < 0.3 ? 3 : 2;
          x.fillRect(Math.round(px - s / 2), Math.round(py - s / 2), s, s);
        }
      }
      x.fillStyle = `rgba(57,255,136,${0.7 * a})`; x.font = '7px monospace'; x.textAlign = 'left';
      x.fillText('WX RADAR  ·  CELL 2  ·  SUSTAINED 96 KT', 8, H - 10);
    } else {
      // The logo: the hurricane symbol (two arms, for category 2) over the wordmark.
      const k = t - 3.3, settle = ease(k / 1.2), lx = cx, ly = cy - 18;
      const r = 13, rot = (1 - settle) * 2.2 + k * 0.08;
      x.save(); x.translate(lx, ly); x.rotate(rot);
      x.strokeStyle = `rgba(240,230,208,${fadeOut})`; x.lineCap = 'round';
      x.lineWidth = 4; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke();
      for (const s of [0, Math.PI]) { // each arm spirals out from the ring, thinning to a point
        x.save(); x.rotate(s);
        const N = 14, pt = (th) => { const rr = r * (1 + 0.62 * th); return [Math.sin(th) * rr, -Math.cos(th) * rr]; };
        for (let i = 0; i < N; i++) {
          const a0 = (i / N) * 1.75, a1 = ((i + 1) / N) * 1.75, [x0, y0] = pt(a0), [x1, y1] = pt(a1);
          x.lineWidth = 4.2 * (1 - i / N) + 0.6; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
        }
        x.restore();
      }
      x.fillStyle = `rgba(232,66,63,${fadeOut})`; x.beginPath(); x.arc(0, 0, r * 0.38, 0, TAU); x.fill(); // the eye
      x.restore();
      x.textAlign = 'center';
      const pop = 1 + (1 - ease(k / 0.35)) * 0.3;
      x.save(); x.translate(cx, cy + 30); x.scale(pop, pop);
      x.font = '30px Impact, "Arial Black", sans-serif';
      x.fillStyle = `rgba(232,66,63,${0.55 * fadeOut})`; x.fillText(STUDIO.word, 1.5, 0); // a misregistered print
      x.fillStyle = `rgba(240,230,208,${fadeOut})`; x.fillText(STUDIO.word, 0, 0);
      x.restore();
      x.font = 'bold 9px monospace'; x.fillStyle = `rgba(255,210,63,${fadeOut * span(k, 0.3, 0.8)})`;
      x.fillText(STUDIO.sub.split('').join('  '), cx, cy + 46);
      // Rain driving across it.
      x.strokeStyle = `rgba(180,200,220,${0.35 * fadeOut})`; x.lineWidth = 1; x.beginPath();
      for (let i = 0; i < 70; i++) {
        const sx = ((i * 97.13 + k * 260) % (W + 60)) - 30, sy = ((i * 53.71 + k * 520 + i * i) % (H + 20)) - 10;
        x.moveTo(sx, sy); x.lineTo(sx - 5, sy + 12);
      }
      x.stroke();
      const fl = Math.max(0, 1 - k / 0.45) + (k > 0.6 && k < 0.7 ? 0.4 : 0); // the strike, and a flicker after
      if (fl > 0) { x.fillStyle = `rgba(235,240,255,${fl})`; x.fillRect(0, 0, W, H); }
    }
    for (let y = 0; y < H; y += 2) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, y, W, 1); } // scanlines
  }

  // ---------- The cold open ----------
  tex(w, h, draw, rx, ry) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); draw(x, w, h, mulberry32(w * 31 + h));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1);
    return t;
  }

  textures() {
    const grime = (x, w, h, r, n, a) => { for (let k = 0; k < n; k++) { x.fillStyle = `rgba(20,16,10,${r() * a})`; x.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3)); } };
    const T = {};
    // Cell-block wall: institutional green below a dado line, dirty cream above, damp streaks running down.
    T.wall = this.tex(64, 64, (x, w, h, r) => {
      x.fillStyle = '#b8b29c'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#4e5e4c'; x.fillRect(0, 40, w, 24);
      x.fillStyle = '#2e3a2e'; x.fillRect(0, 39, w, 2);
      grime(x, w, h, r, 260, 0.25);
      for (let k = 0; k < 6; k++) { const sx = Math.floor(r() * w); x.fillStyle = 'rgba(60,50,30,0.18)'; x.fillRect(sx, 0, 2, 20 + r() * 40); }
    });
    T.cell = this.tex(64, 64, (x, w, h, r) => { // your own cell wall, with the days scratched off
      x.drawImage(T.wall.image, 0, 0);
      x.strokeStyle = 'rgba(40,30,20,0.8)'; x.lineWidth = 1;
      for (let g = 0; g < 5; g++) for (let k = 0; k < 5; k++) {
        const bx = 6 + g * 11, by = 8 + Math.floor(g / 3) * 14;
        x.beginPath(); if (k < 4) { x.moveTo(bx + k * 2, by); x.lineTo(bx + k * 2, by + 8); } else { x.moveTo(bx - 1, by + 7); x.lineTo(bx + 8, by + 1); } x.stroke();
      }
    });
    T.floor = this.tex(64, 64, (x, w, h, r) => {
      x.fillStyle = '#5a564e'; x.fillRect(0, 0, w, h);
      grime(x, w, h, r, 400, 0.3);
      x.fillStyle = 'rgba(0,0,0,0.2)'; for (let k = 0; k < w; k += 32) { x.fillRect(k, 0, 1, h); x.fillRect(0, k, w, 1); }
    });
    T.line = this.tex(16, 64, (x, w, h, r) => { x.fillStyle = '#c9a43a'; x.fillRect(0, 0, w, h); grime(x, w, h, r, 120, 0.5); });
    T.ceil = this.tex(32, 32, (x, w, h, r) => { x.fillStyle = '#3a3a36'; x.fillRect(0, 0, w, h); grime(x, w, h, r, 80, 0.4); });
    T.shutter = this.tex(64, 64, (x, w, h, r) => {
      x.fillStyle = '#6a6e70'; x.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, y, w, 1); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, y + 1, w, 1); }
      grime(x, w, h, r, 200, 0.35);
      x.fillStyle = '#c9a43a'; for (let k = -64; k < w; k += 16) { x.beginPath(); x.moveTo(k, h); x.lineTo(k + 8, h); x.lineTo(k + 16, h - 8); x.lineTo(k + 8, h - 8); x.fill(); }
    });
    T.sign = this.tex(128, 32, (x, w, h) => {
      x.fillStyle = '#1a1a18'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#d8d0b8'; x.font = 'bold 18px monospace'; x.textAlign = 'center'; x.fillText('MOTOR POOL', w / 2, 23);
    });
    return T;
  }

  build(canvas) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false }));
    r.setPixelRatio(1);
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.post = new PSXPost(r);
    this.canvas = canvas;
    this.resize();
    const sc = (this.scene = new THREE.Scene());
    sc.background = new THREE.Color('#050608');
    sc.fog = new THREE.Fog('#050608', 30, 170);
    this.camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.5, 900);
    const T = (this.T = this.textures());
    const mat = (tex, rx, ry, extra) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshStandardMaterial(Object.assign({ map: t, roughness: 0.9 }, extra)); };
    const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); sc.add(b); return b; };
    const steel = LP.mat('#3a3c3e', { metalness: 0.6, roughness: 0.5 });
    this.lightRig(sc);

    // ---- The cell block: a corridor down +X, cells either side, yours at the near end on the left. ----
    const LEN = 200, HW = 11, CH = 24;
    box(LEN + 40, 1, HW * 2 + 40, mat(T.floor, 18, 4), LEN / 2 - 20, -0.5, 0);
    box(LEN + 40, 1, HW * 2 + 40, mat(T.ceil, 20, 4), LEN / 2 - 20, CH + 0.5, 0);
    box(LEN, 0.05, 1.4, mat(T.line, 1, 30), LEN / 2, 0.03, 0);
    const bars = [];
    for (let k = 0; k < 8; k++) for (const side of [-1, 1]) {
      const x0 = k * 24, zf = side * HW, zb = side * (HW + 18);
      box(24, CH, 1, mat(k === 0 && side < 0 ? T.cell : T.wall, 2, 2), x0 + 12, CH / 2, zb); // back wall
      box(2.4, CH, 18, mat(T.wall, 0.5, 2), x0, CH / 2, (zf + zb) / 2); // dividing wall
      box(3, CH, 2, mat(T.wall, 0.3, 2), x0 + 1.5, CH / 2, zf); // pillar
      for (const y of [1, 9.5, CH - 2]) box(21, 0.6, 0.5, steel, x0 + 13, y, zf); // the bars' cross rails
      for (let b = 0; b < 11; b++) {
        const bx = x0 + 3.6 + b * 1.9, door = k === 0 && side < 0 && b < 6;
        if (door) continue;
        bars.push([bx, zf]);
      }
      if (k > 0 || side > 0) { // a bunk and a bowl in every other cell, half lost in the dark
        box(14, 1.2, 6, LP.mat('#4a4438'), x0 + 12, 4.5, zb - side * 3.5);
      }
    }
    box(2, CH, 60, mat(T.wall, 2, 2), LEN - 8, CH / 2, 0); // the far wall, with the door out
    const door = box(1, 16, 12, LP.mat('#565a54', { metalness: 0.5, roughness: 0.6 }), LEN - 9.2, 8, 0);
    door.userData.tag = 'door';
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: T.sign }));
    sign.position.set(LEN - 9.8, 19, 0); sign.rotation.y = -Math.PI / 2; sc.add(sign);
    this.redLamp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3020' }));
    this.redLamp.position.set(LEN - 9.8, 21.6, 0); sc.add(this.redLamp);
    const barGeo = new THREE.CylinderGeometry(0.32, 0.32, CH, 6), inst = new THREE.InstancedMesh(barGeo, steel, bars.length + 6);
    const m4 = new THREE.Matrix4();
    bars.forEach(([x, z], i) => { m4.makeTranslation(x, CH / 2, z); inst.setMatrixAt(i, m4); });
    inst.count = bars.length; sc.add(inst);
    // Your cell door: six bars and its rails on a carriage that rolls back over the fixed bars.
    this.cellDoor = new THREE.Group();
    for (let b = 0; b < 6; b++) { const m = new THREE.Mesh(barGeo, steel); m.position.set(3.6 + b * 1.9, CH / 2, 0); this.cellDoor.add(m); }
    for (const y of [1, 9.5, CH - 2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.6, 0.5), steel); m.position.set(8.4, y, 0); this.cellDoor.add(m); }
    this.cellDoor.position.set(0, 0, -HW + 0.7); sc.add(this.cellDoor);
    // Your cell: a bunk, a steel toilet, a high window with the moon through it.
    box(16, 1.2, 6.5, LP.mat('#5a5040'), 13, 4.2, -HW - 14.2);
    box(15, 0.9, 6, LP.mat('#7a7468'), 13, 5.2, -HW - 14.2); // the mattress
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 3.4, 8), LP.mat('#9aa0a4', { metalness: 0.7, roughness: 0.35 })); bowl.position.set(3.5, 1.7, -HW - 15); sc.add(bowl);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.4), new THREE.MeshBasicMaterial({ color: '#7f9cc8' })); win.position.set(12, 19, -HW - 17.4); sc.add(win);
    for (let b = 0; b < 4; b++) box(0.3, 3.6, 0.3, steel, 9.8 + b * 1.5, 19, -HW - 17.2);
    // Light fittings down the middle: caged bulbs that the corridor's few real lights hop between.
    this.fixtures = [];
    for (let x = 12; x < LEN - 10; x += 24) {
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 1.6), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }));
      bulb.position.set(x, CH - 0.6, 0); sc.add(bulb);
      box(3.8, 0.3, 2, steel, x, CH - 0.15, 0);
      this.fixtures.push({ x, mesh: bulb, seed: x * 0.37 });
    }
    // People
    this.inmates = [];
    for (const p of Intro.people(this.g)) {
      const f = People.figure(p.o);
      if (p.guard) { this.guard = f; f.position.set(9, 8.4, -4.5); f.rotation.y = Math.PI / 2; }
      else { f.position.set(p.x, 8.4, p.z); f.rotation.y = p.z < 0 ? -Math.PI / 2 : Math.PI / 2; this.inmates.push(f); }
      sc.add(f);
    }
    // The guard's torch: a hard white cone in your eyes.
    this.torch = new THREE.SpotLight('#fff4dc', 0, 120, 0.32, 0.5, 1);
    this.torch.position.set(11.5, 10.8, -6.8); sc.add(this.torch); sc.add(this.torch.target);
    this.torchGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex(), color: '#fff2d0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.torchGlow.scale.set(5, 5, 1); this.torchGlow.position.copy(this.torch.position); sc.add(this.torchGlow);

    // ---- The garage, far off at x = 2000: the car under one lamp, facing the shutter. ----
    const GX = 2000;
    this.GX = GX;
    box(240, 1, 160, mat(T.floor, 8, 6), GX, -0.5, 0);
    box(2, 50, 160, mat(T.wall, 6, 3), GX - 80, 25, 0);
    for (const s of [-1, 1]) box(160, 50, 2, mat(T.wall, 6, 3), GX, 25, s * 40);
    box(2, 50, 28, mat(T.wall, 1, 3), GX + 62, 25, -27); box(2, 50, 28, mat(T.wall, 1, 3), GX + 62, 25, 27);
    box(2, 24, 26, mat(T.wall, 1, 1), GX + 62, 38, 0);
    this.shutter = box(1.5, 26, 26, mat(T.shutter, 1, 3), GX + 61, 13, 0);
    const beyond = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), new THREE.MeshBasicMaterial({ color: '#fff0d0', fog: false }));
    beyond.position.set(GX + 140, 40, 0); beyond.rotation.y = -Math.PI / 2; sc.add(beyond);
    this.beyond = beyond;
    this.car = Models.car(Intro.carLook(this.g));
    this.car.position.set(GX, 0, 0); sc.add(this.car);
    for (const [x, z] of [[GX - 60, -30], [GX - 66, -24], [GX - 60, 30], [GX + 40, 32]]) { const o = Models.obstacle('tyres'); o.position.set(x, 0, z); sc.add(o); }
    for (const [x, z] of [[GX - 40, 33], [GX - 34, 34]]) { const o = Models.obstacle('barrels'); o.position.set(x, 0, z); sc.add(o); }
    box(18, 7, 6, LP.mat('#4a3a2a'), GX - 20, 3.5, -35); // workbench
    const shade = new THREE.Mesh(new THREE.ConeGeometry(4, 3, 10, 1, true), LP.mat('#2a3a2a', { side: THREE.DoubleSide, metalness: 0.5 }));
    shade.position.set(GX, 30, 0); sc.add(shade);
    box(0.2, 18, 0.2, steel, GX, 40, 0);
    const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff0c0' })); lampBulb.position.set(GX, 28.8, 0); sc.add(lampBulb);
    this.lamp = new THREE.SpotLight('#ffe2b0', 22, 90, 0.75, 0.55, 1.4);
    this.lamp.position.set(GX, 29, 0); this.lamp.target.position.set(GX, 0, 0); sc.add(this.lamp); sc.add(this.lamp.target);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(22, 29, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.008, blending: THREE.AdditiveBlending, depthWrite: false }));
    cone.position.set(GX, 14.5, 0); sc.add(cone);
    // A low fill off the walls so the car reads as more than a silhouette.
    this.fill = new THREE.PointLight('#c8a878', 0, 140, 1); this.fill.position.set(GX - 10, 14, -30); sc.add(this.fill);
    // Headlights, off until the engine catches.
    this.heads = [];
    for (const z of [-6, 6]) {
      const L = new THREE.SpotLight('#fff6e0', 0, 160, 0.42, 0.5, 1.2);
      L.position.set(GX + 17.5, 4.2, z); L.target.position.set(GX + 70, 2, z * 1.4);
      sc.add(L); sc.add(L.target);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex(), color: '#fff6e0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(4, 4, 1); glow.position.set(GX + 18.4, 4.2, z); sc.add(glow);
      this.heads.push({ L, glow });
    }
    // Light pouring in under the rising shutter.
    this.shafts = [];
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(70, 0.1, 5), new THREE.MeshBasicMaterial({ color: '#fff0d0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set(GX + 26, 6 + k * 3, -9 + k * 6); m.rotation.z = 0.18 + k * 0.03; m.scale.y = 40 + k * 20;
      sc.add(m); this.shafts.push(m);
    }
    PSX.apply(sc);
    this.camera.position.set(14, 7, -25);
    r.compile(sc, this.camera); // shaders now, while the sting plays, not on the first frame of the shot
  }

  glowTex() {
    if (this._glow) return this._glow;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    return (this._glow = new THREE.CanvasTexture(c));
  }

  lightRig(sc) {
    this.amb = new THREE.HemisphereLight('#8a9cb8', '#2a2418', 0.25); sc.add(this.amb);
    this.moon = new THREE.DirectionalLight('#7f9cc8', 0.5); this.moon.position.set(12, 40, -60); this.moon.target.position.set(12, 0, -10); sc.add(this.moon); sc.add(this.moon.target);
    this.halls = [];
    for (let k = 0; k < 3; k++) { const L = new THREE.PointLight('#ffcf90', 0, 70, 1.3); sc.add(L); this.halls.push(L); }
  }

  resize() {
    if (!this.renderer) return;
    const W = window.innerWidth, H = window.innerHeight;
    this.renderer.setSize(W, H, false);
    this.post.setSize(W, H);
    if (this.camera) { this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); }
    this.sizeSting();
  }

  // Sound cues on the cut, each once.
  cue(t) {
    const C = this.cues, at = (k, when, fn) => { if (!C[k] && t >= when) { C[k] = true; if (t - when < 0.5) fn(); } };
    at('unlock', 5.0, () => IntroSfx.clank(0));
    at('slide', 5.3, () => IntroSfx.slide(0, 1.2));
    at('stop', 6.5, () => IntroSfx.clank(0));
    for (let k = 0; k < 12; k++) at('step' + k, INTRO_SHOTS.corridor + 0.25 + k * 0.58, () => IntroSfx.step(0, 0.7 + (k % 2) * 0.3));
    at('door', INTRO_SHOTS.garage - 0.05, () => IntroSfx.clank(0));
    at('heads', 16.6, () => IntroSfx.clunk(0));
    at('starter', 17.3, () => IntroSfx.starter(0));
    at('roller', INTRO_SHOTS.launch + 0.1, () => IntroSfx.roller(0, 1.7));
    at('crowd', INTRO_SHOTS.launch + 0.6, () => IntroSfx.crowd(0, INTRO_SLAM - INTRO_SHOTS.launch + 2.5, 1));
  }

  captions(t) {
    let k = -1;
    INTRO_LINES.forEach((l, i) => { if (t >= l.t && t < l.t + l.d) k = i; });
    if (k !== this.lastLine) {
      this.lastLine = k;
      const l = INTRO_LINES[k];
      this.cap.className = 'i-cap' + (l && l.cls ? ' ' + l.cls : '');
      this.cap.innerHTML = l ? (l.who ? `<b>${l.who}</b> ` : '') + `<span>${l.text.replace('{n}', (this.g.cos && this.g.cos.inmate) || '4471')}</span>` : '';
      if (l) { this.cap.classList.remove('show'); void this.cap.offsetWidth; this.cap.classList.add('show'); }
    }
    if (k >= 0) this.cap.classList.toggle('fade', t > INTRO_LINES[k].t + INTRO_LINES[k].d - 0.45);
  }

  renderCold(t, dt) {
    if (!this.renderer) {
      if (t >= INTRO_SLAM) this.slamIn(t);
      return;
    }
    const cam = this.camera, S = INTRO_SHOTS, sc = this.scene, look = new THREE.Vector3();
    const flick = (seed) => (Math.sin(t * 23 + seed) > 0.97 || Math.sin(t * 7.3 + seed * 2) > 0.995 ? 0.25 : 1);
    this.torch.intensity = 0; this.torchGlow.visible = false;
    for (const L of this.halls) L.intensity = 0;
    this.fill.intensity = 0;
    if (t < S.corridor) {
      // Your cell. You sit up on the bunk into the guard's torch; the door rolls back; you get up and go.
      sc.fog.color.set('#06070a'); sc.fog.near = 30; sc.fog.far = 150; sc.background.set('#06070a');
      this.amb.intensity = 0.22; this.moon.intensity = 0.7;
      const up = ease(span(t, 0.6, 4.6)), go = ease(span(t, 6.4, 8.0));
      cam.position.set(16 - up * 2 - go * 6, 6.5 + up * 6 + go * 0.6, -24.5 + up * 2.5 + go * 9.5);
      look.set(12 - go * 1, 10 + up * 1.5, -6);
      cam.position.y += Math.sin(t * 1.3) * 0.08;
      const guardX = 9 + ease(span(t, 5.6, 6.8)) * 7;
      this.guard.position.set(guardX, 8.4, -4.5);
      this.guard.rotation.y = Math.PI / 2 - ease(span(t, 5.6, 6.4)) * 0.6;
      const aim = 1 - ease(span(t, 5.4, 6.2)); // the torch drops off you once the door's open
      this.torch.position.set(guardX + 2.5, 10.8, -6.8);
      this.torch.target.position.set(cam.position.x * aim + (guardX + 6) * (1 - aim), cam.position.y * aim + 1, cam.position.z * aim - 6 * (1 - aim));
      this.torch.intensity = 7 * span(t, 0.2, 0.5);
      this.torchGlow.visible = aim > 0.3; this.torchGlow.position.copy(this.torch.position); this.torchGlow.material.opacity = aim;
      this.cellDoor.position.x = ease(span(t, 5.3, 6.5)) * 11;
      const L = this.halls[0]; L.position.set(12, 21, 0); L.intensity = 2.6 * flick(1);
      this.fixtures[0].mesh.material.color.setScalar(flick(1));
    } else if (t < S.garage) {
      // The walk. Inmates come to their bars to watch you go.
      sc.fog.color.set('#06070a'); sc.fog.near = 25; sc.fog.far = 140; sc.background.set('#06070a');
      this.amb.intensity = 0.18; this.moon.intensity = 0;
      const k = t - S.corridor, x = 20 + k * 19;
      cam.position.set(x, 13 + Math.abs(Math.sin(k * Math.PI / 0.58)) * -0.35, Math.sin(k * 0.9) * 0.6);
      look.set(x + 40, 12.2 + Math.sin(k * 0.7) * 0.3, Math.sin(k * 0.5) * 3);
      const base = Math.floor((x - 12) / 24) * 24 + 12;
      this.halls.forEach((L, i) => { const fx = base + i * 24; const f = this.fixtures.find((q) => q.x === fx); L.position.set(fx, 21, 0); L.intensity = f ? 2.8 * flick(f.seed) : 0; });
      for (const f of this.fixtures) f.mesh.material.color.setScalar(flick(f.seed));
      for (const f of this.inmates) { // heads follow you
        const dx = cam.position.x - f.position.x, dz = cam.position.z - f.position.z;
        const ang = Math.atan2(dz, dx) + f.rotation.y; // into the figure's frame (it faces +X)
        f.userData.head.rotation.y = clamp(-wrapAngle(ang), -1.1, 1.1);
      }
      this.redLamp.material.color.setScalar(Math.sin(t * 6) > 0 ? 1 : 0.25);
      this.guard.visible = false;
    } else {
      // The garage.
      const GX = this.GX, k = t - S.garage, open = ease(span(t, S.launch + 0.1, S.launch + 1.8));
      sc.fog.color.set('#0a0908'); sc.fog.near = 40; sc.fog.far = 220; sc.background.set('#0a0908');
      this.amb.intensity = 0.32 + open * 0.6; this.moon.intensity = 0; this.fill.intensity = 2.2;
      const on = t > 16.6 ? (t < 16.75 || (t > 16.85 && t < 16.9) ? 0.3 : 1) : 0; // the headlights stutter on
      for (const h of this.heads) { h.L.intensity = 6 * on; h.glow.material.opacity = on; }
      // The engine: it catches after the starter, then two blips of the throttle, then away.
      if (t > 17.9) {
        const blip = Math.max(Math.exp(-Math.pow((t - 19.8) * 3, 2)), Math.exp(-Math.pow((t - 21.0) * 2.5, 2)));
        const run = span(t, S.launch + 2.0, S.launch + 3.8);
        Sound.engine(0.05 + blip * 0.55 + run * 0.9, Math.max(blip, run), run > 0.3, true);
      }
      const mv = t > S.launch + 2.0 ? 0.5 * 120 * Math.pow(t - (S.launch + 2.0), 2) : 0; // away it goes, into the light
      this.car.position.x = GX + mv;
      this.car.position.y = mv > 0 ? Math.sin(t * 40) * 0.08 : 0;
      for (const [i, h] of this.heads.entries()) { h.L.position.x = GX + 17.5 + mv; h.L.target.position.x = GX + 70 + mv; h.glow.position.x = GX + 18.4 + mv; h.L.position.z = i ? 6 : -6; }
      this.shutter.position.y = 13 + open * 27;
      this.beyond.material.color.setScalar(0.4 + open * 0.6);
      this.shafts.forEach((m, i) => { m.material.opacity = open * (0.05 + 0.02 * Math.sin(t * 2 + i)); });
      if (t < 19.0) { // low at the front quarter, creeping in
        const a = ease(span(t, S.garage, 19.0));
        cam.position.set(GX + 34 - a * 8, 5 + a * 1.5, -28 + a * 8); look.set(GX + 6, 4, 0);
      } else if (t < S.launch) { // along the flank from the back
        const a = ease(span(t, 19.0, S.launch));
        cam.position.set(GX - 30 - a * 6, 9 - a, 22 - a * 9); look.set(GX + 10, 5, 0);
      } else { // behind it as the shutter goes up; it launches; we push after it
        const a = ease(span(t, S.launch, INTRO_SLAM));
        cam.position.set(GX - 48 + a * 30, 10 - a * 2, 0); look.set(GX + 70, 10, 0);
        const shake = span(t, S.launch + 2.0, INTRO_SLAM) * 0.5;
        cam.position.x += (Math.random() - 0.5) * shake; cam.position.y += (Math.random() - 0.5) * shake;
      }
      void k;
    }
    cam.lookAt(look);
    // Flash to white into the title, then the title holds over the white fading back to black.
    const white = span(t, INTRO_SLAM - 0.45, INTRO_SLAM);
    this.flash.style.opacity = t < INTRO_SLAM ? white : Math.max(0, 1 - (t - INTRO_SLAM) / 0.9);
    this.post.begin();
    this.renderer.render(sc, cam);
    this.post.end(t);
    if (t >= INTRO_SLAM) this.slamIn(t);
    void dt;
  }

  slamIn(t) {
    if (this.slammed) return;
    this.slammed = true;
    Sound.engine(0, 0, false, false);
    this.el.classList.add('slammed');
    this.renderer && (this.canvas.style.opacity = 0);
  }
}
