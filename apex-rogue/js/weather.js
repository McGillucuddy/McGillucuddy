'use strict';
// Weather: rolled per stop on the route sheet (so you can see the forecast before you pick), from classics that can
// turn up anywhere and conditions particular to each act. Each changes the look (fog, light, falling particles,
// drops on the windshield, lightning), the sound (an ambience bed, the race music) and the racing itself.
//
// Effects: grip (all cars), lock (rival gunners' lock-on time), wear (part wear from damage; {slot: mul} or a number),
// scrap / rep (race payouts), cd (ability recharge rate). Look: fog [colour, how much of it], near / far (fog
// distance multipliers), light (sun and sky light), particles, glass (drops on the windshield), lightning,
// fireworks (rate), ambience, music (tweaks to the race track).

const WEATHER = {
  clear: { name: 'Clear', icon: '☀', desc: 'Nothing in the air but exhaust.' },
  rain: {
    name: 'Rain', icon: '🌧', desc: 'Wet tarmac: -8% grip for everyone. Rain streaks the glass.',
    grip: 0.92, fog: ['#5a6068', 0.45], far: 0.8, light: 0.8,
    particles: { kind: 'rain', n: 1400, color: '#b8c4d0', speed: 620 }, glass: { rate: 7, color: [200, 215, 230] },
    ambience: 'rain', music: { lowpass: 2600, padBright: 0.85 },
  },
  storm: {
    name: 'Thunderstorm', icon: '⛈', desc: 'Sheets of rain and lightning: -14% grip, and rival gunners struggle to lock on (+25% lock time).',
    grip: 0.86, lock: 1.25, fog: ['#3a4048', 0.6], near: 0.7, far: 0.6, light: 0.55,
    particles: { kind: 'rain', n: 2600, color: '#c8d4e0', speed: 760 }, glass: { rate: 16, color: [200, 215, 230] }, lightning: true,
    ambience: 'storm', music: { lowpass: 2200, intensity: 1, toms: true },
  },
  smog: {
    name: 'Smog', icon: '🌫', desc: 'A brown murk you can chew. Rival gunners take 35% longer to lock on to you.',
    lock: 1.35, fog: ['#5a4a32', 0.75], near: 0.5, far: 0.45, light: 0.75,
    particles: { kind: 'dust', n: 500, color: '#8a7a5a', speed: 12 },
    ambience: 'wind', music: { padBright: 0.7, lowpass: 3000 },
  },
  fog: {
    name: 'Cloud Bank', icon: '☁', desc: 'The race runs straight through a cloud. Rivals take 30% longer to lock on.',
    lock: 1.3, fog: ['#d8dce0', 0.8], near: 0.45, far: 0.5, light: 0.9,
    particles: { kind: 'dust', n: 400, color: '#f0f2f4', speed: 6 }, glass: { rate: 2, color: [235, 240, 245] },
    ambience: 'wind', music: { reverb: 1.5, padBright: 0.9 },
  },
  // Act I, the Undercity
  acid_drip: {
    name: 'Acid Drip', icon: '🧪', desc: 'Runoff from the upper city drips through the plate. It eats metal: parts wear 60% faster.',
    wear: 1.6, grip: 0.95, fog: ['#2e3a22', 0.4], far: 0.85,
    particles: { kind: 'drip', n: 380, color: '#9aff5a', speed: 420 }, glass: { rate: 4, color: [150, 255, 90] },
    ambience: 'drip', music: { padBright: 0.8 },
  },
  blackout: {
    name: 'Blackout', icon: '🔦', desc: 'The power to the sector is cut. Pitch dark: everyone takes 40% longer to lock on.',
    lock: 1.4, fog: ['#0a0908', 0.85], near: 0.6, far: 0.55, light: 0.3,
    particles: { kind: 'dust', n: 200, color: '#4a4030', speed: 6 },
    ambience: 'hum', music: { padBright: 0.6, reverb: 1.4, lowpass: 2400 },
  },
  // Act II, the Stacks
  ashfall: {
    name: 'Ash Fall', icon: '🌋', desc: 'The furnaces vent: grey ash settles on everything. -6% grip, short sight lines.',
    grip: 0.94, lock: 1.15, fog: ['#6a6460', 0.6], near: 0.7, far: 0.6, light: 0.75,
    particles: { kind: 'ash', n: 1600, color: '#cfcac4', speed: 34 }, glass: { rate: 3, color: [190, 185, 178], smear: true },
    ambience: 'wind', music: { padBright: 0.75, lowpass: 2800 },
  },
  furnace: {
    name: 'Furnace Day', icon: '🔥', desc: 'The air shimmers and embers rise. Engines run hot: engine wear doubles.',
    wear: { engine: 2 }, fog: ['#8a4a22', 0.45], far: 0.8, light: 1.1,
    particles: { kind: 'ember', n: 700, color: '#ff8a2a', speed: 40 },
    ambience: 'fire', music: { intensity: 1, toms: true },
  },
  // Act III, the Gilded Terraces
  golden_hour: {
    name: 'Golden Hour', icon: '🌅', desc: 'The whole terrace turns out to watch: +25% scrap from this race, but you\'re lit up (rivals lock on 20% faster).',
    lock: 0.8, scrap: 1.25, fog: ['#ffb46a', 0.35], light: 1.25,
    particles: { kind: 'dust', n: 300, color: '#ffe0a0', speed: 4 },
    ambience: 'crowd', music: { padBright: 1.15 },
  },
  sprinklers: {
    name: 'Sprinkler Mist', icon: '💦', desc: 'The lawns are being watered mid-race: a drifting mist, -10% grip.',
    grip: 0.9, fog: ['#c8dce8', 0.45], near: 0.8, far: 0.75,
    particles: { kind: 'mist', n: 900, color: '#e8f4ff', speed: 30 }, glass: { rate: 5, color: [225, 240, 255] },
    ambience: 'rain', music: { reverb: 1.3 },
  },
  // Act IV, the Crown
  gala: {
    name: 'Firework Gala', icon: '🎆', desc: 'The Spire celebrates the race. Fireworks fill the sky: +50% reputation from this race.',
    rep: 1.5, fireworks: 3, light: 0.9,
    ambience: 'crowd', music: { crash: true },
  },
  ion_storm: {
    name: 'Ion Storm', icon: '⚡', desc: 'Lightning crawls over the Spire\'s rods. The charged air recharges abilities 35% faster; -8% grip.',
    cd: 1.35, grip: 0.92, fog: ['#3a3a5a', 0.55], near: 0.8, far: 0.7, light: 0.6,
    particles: { kind: 'rain', n: 900, color: '#c8c8ff', speed: 700 }, glass: { rate: 5, color: [210, 210, 255] }, lightning: true,
    ambience: 'storm', music: { intensity: 1, lowpass: 3200 },
  },
  smog_tide: {
    name: 'Smog Tide', icon: '🌫', desc: 'The undercity\'s smog rises up the Spire to choke the rich. Rivals take 35% longer to lock on.',
    lock: 1.35, fog: ['#6a5034', 0.7], near: 0.55, far: 0.5, light: 0.7,
    particles: { kind: 'dust', n: 600, color: '#8a6a44', speed: 10 },
    ambience: 'wind', music: { padBright: 0.7 },
  },
};

// What each act's sky can do, with weights. The undercity is under a plate: no storms, but drips and blackouts.
const ACT_WEATHER = [
  [['clear', 4], ['rain', 2], ['smog', 3], ['acid_drip', 3], ['blackout', 2]],
  [['clear', 3], ['rain', 2], ['storm', 2], ['smog', 3], ['ashfall', 3], ['furnace', 3]],
  [['clear', 4], ['rain', 2], ['storm', 1], ['fog', 3], ['golden_hour', 3], ['sprinklers', 3]],
  [['clear', 3], ['storm', 2], ['fog', 2], ['gala', 3], ['ion_storm', 3], ['smog_tide', 2]],
];

// The forecast for a stop: fixed per run, act and stop, so the route sheet can show it in advance.
function weatherFor(runSeed, act, nodeId) {
  const r = mulberry32(((runSeed | 0) * 31 + act * 977 + nodeId * 7919) >>> 0);
  r(); r();
  const pool = ACT_WEATHER[Math.min(act, ACT_WEATHER.length - 1)];
  return weightedPick(r, pool, (p) => p[1])[0];
}

const wxOf = (id) => WEATHER[id] || WEATHER.clear;
const wearOf = (w, slot) => (typeof w.wear === 'number' ? w.wear : (w.wear && w.wear[slot]) || 1);

// ---------- In the cockpit: particles round the camera, lightning, the fog and light ----------

const Weather3D = {
  // Apply the look to a freshly built cockpit scene. Returns the per-race state.
  build(cv, id) {
    const w = wxOf(id), scene = cv.scene, st = { w, id, flash: 0, thunder: [], nextBolt: 4 + Math.random() * 6, sparks: null };
    if (w.fog) {
      const [col, k] = w.fog;
      scene.fog.color.lerp(new THREE.Color(col), k);
      scene.background.lerp(new THREE.Color(col), k);
      // The sky dome isn't fogged, so tint it too, or a smog tide over the Crown would leave a clear sunset.
      if (cv.env) cv.env.follow.traverse((o) => { if (o.name === 'sky' && o.material) o.material.color.lerp(new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.35), k * 0.8); });
    }
    scene.fog.near *= w.near || 1;
    scene.fog.far *= w.far || 1;
    st.base = { hemi: cv.hemi.intensity * (w.light || 1), sun: cv.sun.intensity * (w.light || 1), bg: scene.background.clone() };
    cv.hemi.intensity = st.base.hemi;
    cv.sun.intensity = st.base.sun;
    if (cv.env && w.fireworks) cv.env.fwMul = w.fireworks;
    const P = w.particles;
    if (P) {
      const n = P.n, line = P.kind === 'rain' || P.kind === 'drip';
      const pos = new Float32Array(n * (line ? 6 : 3));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = line
        ? new THREE.LineBasicMaterial({ color: P.color, transparent: true, opacity: P.kind === 'drip' ? 0.8 : 0.5, depthWrite: false, fog: true })
        : new THREE.PointsMaterial({ color: P.color, size: { ash: 1.3, ember: 1.6, mist: 4, dust: 1.1 }[P.kind] || 1.5, transparent: true,
          opacity: { ash: 0.85, ember: 0.95, mist: 0.18, dust: 0.45 }[P.kind] || 0.6, depthWrite: false, fog: P.kind !== 'ember',
          blending: P.kind === 'ember' ? THREE.AdditiveBlending : THREE.NormalBlending });
      const obj = line ? new THREE.LineSegments(geo, mat) : new THREE.Points(geo, mat);
      obj.frustumCulled = false;
      obj.renderOrder = 5;
      scene.add(obj);
      st.parts = { obj, P, line, n, p: new Float32Array(n * 3), ph: new Float32Array(n), init: false };
    }
    return st;
  },

  // A spot round (but not inside) the car.
  spawn(S, k, cx, cz, top) {
    const a = Math.random() * TAU, r = 34 + Math.sqrt(Math.random()) * 330;
    S.p[k * 3] = cx + Math.cos(a) * r;
    S.p[k * 3 + 1] = top ? 160 + Math.random() * 90 : Math.random() * 250;
    S.p[k * 3 + 2] = cz + Math.sin(a) * r;
    S.ph[k] = Math.random() * TAU;
  },

  update(cv, st, dt, t) {
    if (!st) return;
    const car = cv.race.player, cx = car.x, cz = car.y, vx = car.vx || 0, vz = car.vy || 0;
    const S = st.parts;
    if (S) {
      const P = S.P, arr = S.obj.geometry.attributes.position.array, cos = Math.cos(car.heading), sin = Math.sin(car.heading);
      if (!S.init) { for (let k = 0; k < S.n; k++) Weather3D.spawn(S, k, cx, cz, false); S.init = true; }
      const fall = P.kind === 'ember' ? -P.speed : P.speed;
      for (let k = 0; k < S.n; k++) {
        const i = k * 3;
        let x = S.p[i], y = S.p[i + 1], z = S.p[i + 2];
        y -= fall * dt;
        if (P.kind === 'ash' || P.kind === 'mist' || P.kind === 'dust' || P.kind === 'ember') { x += Math.sin(t * 0.7 + S.ph[k]) * 8 * dt; z += Math.cos(t * 0.6 + S.ph[k]) * 8 * dt; }
        const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
        if (y < 0 || y > 260 || d2 > 380 * 380) { Weather3D.spawn(S, k, cx, cz, P.kind !== 'ember' && y < 0); x = S.p[i]; y = P.kind === 'ember' && y > 260 ? 0 : S.p[i + 1]; z = S.p[i + 2]; }
        S.p[i] = x; S.p[i + 1] = y; S.p[i + 2] = z;
        // Keep it out of the cabin: anything inside the car's footprint is parked out of sight.
        const lx = dx * cos + dz * sin, lz = -dx * sin + dz * cos, inside = Math.abs(lx) < 30 && Math.abs(lz) < 18 && y < 30;
        if (S.line) {
          const len = P.kind === 'drip' ? 9 : 16, sx = -vx * 0.025, sz = -vz * 0.025; // streaks lean into the wind of your speed
          const o = k * 6, yy = inside ? -999 : y;
          arr[o] = x; arr[o + 1] = yy; arr[o + 2] = z;
          arr[o + 3] = x + sx; arr[o + 4] = yy + len; arr[o + 5] = z + sz;
        } else {
          arr[i] = x; arr[i + 1] = inside ? -999 : y; arr[i + 2] = z;
        }
      }
      S.obj.geometry.attributes.position.needsUpdate = true;
    }
    // Lightning: a flash of the sky and the world, thunder after a beat.
    if (st.w.lightning) {
      st.nextBolt -= dt;
      if (st.nextBolt <= 0) {
        st.nextBolt = 5 + Math.random() * 9;
        st.flash = 1;
        st.thunder.push(0.4 + Math.random() * 1.8);
      }
      for (let i = st.thunder.length - 1; i >= 0; i--) if ((st.thunder[i] -= dt) <= 0) { st.thunder.splice(i, 1); WeatherSound.thunder(); }
    }
    if (st.flash > 0) st.flash = Math.max(0, st.flash - dt * 3.2);
    const f = st.flash * st.flash;
    cv.hemi.intensity = st.base.hemi + f * 2.2;
    cv.sun.intensity = st.base.sun + f * 1.2;
    if (f > 0) cv.scene.background.copy(st.base.bg).lerp(new THREE.Color('#e8eeff'), f * 0.7);
    else cv.scene.background.copy(st.base.bg);
  },
};

// ---------- The windshield: drops that land, slide and fade (drawn on the HUD layer) ----------

const WeatherGlass = {
  drops: [],
  reset() { this.drops = []; this.acc = 0; },
  draw(ctx, st, W, H, dt, speed) {
    if (!st) return;
    const g = st.w.glass;
    if (g) {
      this.acc = (this.acc || 0) + dt * g.rate * (0.6 + Math.min(1, speed) * 0.8);
      while (this.acc > 1) {
        this.acc -= 1;
        this.drops.push({ x: Math.random() * W, y: Math.random() * H * 0.5, r: 2 + Math.random() * (g.smear ? 7 : 4), life: 2.5 + Math.random() * 3, t: 0, v: 0 });
      }
    }
    const [r0, g0, b0] = g ? g.color : [200, 215, 230];
    this.drops = this.drops.filter((d) => (d.t += dt) < d.life);
    for (const d of this.drops) {
      if (!g || !g.smear) { d.v += dt * (d.r > 4 ? 30 : 6) * (1 + speed); d.y += d.v * dt; } // bigger drops run
      const a = Math.min(1, (d.life - d.t) / 1.2) * 0.55;
      ctx.fillStyle = `rgba(${r0},${g0},${b0},${a * 0.35})`;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 1.15, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${a * 0.6})`;
      ctx.fillRect(d.x - d.r * 0.35, d.y - d.r * 0.45, Math.max(1, d.r * 0.3), Math.max(1, d.r * 0.3)); // the glint
      if (d.v > 20) { ctx.fillStyle = `rgba(${r0},${g0},${b0},${a * 0.18})`; ctx.fillRect(d.x - d.r * 0.3, d.y - 18, d.r * 0.6, 16); } // its trail
    }
    if (st.flash > 0) { ctx.fillStyle = `rgba(235,240,255,${st.flash * st.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
  },
};

// ---------- Sound: an ambience bed under the race, thunder ----------

const WeatherSound = {
  kind: null,
  set(kind, mult) {
    if (kind !== this.kind) { this.stop(); this.kind = kind; if (kind) this.start(kind); }
    if (this.out && Sound.ctx) this.out.gain.setTargetAtTime((this.level || 0) * (mult ?? 1) * (Sound.muted ? 0 : 1), Sound.ctx.currentTime, 0.2);
  },
  start(kind) {
    Sound.init();
    const c = Sound.ctx;
    if (!c || !Sound.noise) return;
    // A long noise loop (the short effects buffer would buzz when looped).
    if (!this.buf) {
      const len = c.sampleRate * 3;
      this.buf = c.createBuffer(1, len, c.sampleRate);
      const d = this.buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.out.connect(Sound.master);
    this.nodes = [];
    const bed = (type, freq, q, vol) => {
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.buf; src.loop = true; src.loopStart = Math.random();
      f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(this.out);
      src.start();
      this.nodes.push(src);
      return { f, g };
    };
    this.level = { rain: 0.5, storm: 0.7, drip: 0.35, wind: 0.4, hum: 0.3, fire: 0.45, crowd: 0.35 }[kind] || 0.4;
    if (kind === 'rain' || kind === 'storm') { bed('bandpass', 2800, 0.6, 0.5); bed('lowpass', 500, 0.7, kind === 'storm' ? 0.7 : 0.3); }
    else if (kind === 'wind') { const b = bed('lowpass', 420, 2, 0.8); this.wobble = b.f; }
    else if (kind === 'fire') { bed('lowpass', 260, 1, 0.8); }
    else if (kind === 'crowd') { bed('bandpass', 900, 0.8, 0.5); bed('bandpass', 1700, 1.2, 0.25); }
    else if (kind === 'hum') { const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 50; g.gain.value = 0.05; o.connect(g); g.connect(this.out); o.start(); this.nodes.push(o); bed('lowpass', 200, 1, 0.4); }
    else if (kind === 'drip') bed('bandpass', 1800, 2, 0.15);
    // Things that happen now and then: drips plinking, embers crackling, the crowd roaring, wind gusting.
    this.timer = setInterval(() => {
      if (!this.out) return;
      const t = c.currentTime;
      if (kind === 'drip' && Math.random() < 0.6) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(900 + Math.random() * 900, t); o.frequency.exponentialRampToValueAtTime(400, t + 0.08); g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.15); }
      if (kind === 'fire' && Math.random() < 0.8) this.crackle(c, t);
      if (kind === 'wind' && this.wobble) this.wobble.frequency.setTargetAtTime(300 + Math.random() * 500, t, 0.6);
    }, 140);
  },
  crackle(c, t) {
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.buf; f.type = 'highpass'; f.frequency.value = 2500;
    g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(f); f.connect(g); g.connect(this.out); src.start(t, Math.random() * 2); src.stop(t + 0.05);
  },
  stop() {
    clearInterval(this.timer);
    const out = this.out, nodes = this.nodes || [];
    this.out = null; this.wobble = null; this.kind = null;
    if (!out || !Sound.ctx) return;
    out.gain.setTargetAtTime(0, Sound.ctx.currentTime, 0.3);
    setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch (e) { /* already stopped */ } } out.disconnect(); }, 1500);
  },
  thunder() {
    const c = Sound.ctx;
    if (!c || !WeatherSound.buf) return;
    const t = c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = WeatherSound.buf; f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(120, t + 2.5);
    g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    src.connect(f); f.connect(g); g.connect(Sound.master); src.start(t, Math.random()); src.stop(t + 3.3);
  },
};
