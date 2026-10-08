'use strict';
// Gunner prototype: one race, the car drives itself, you handle weapons and defence.
// Press V to swap between the first-person cockpit and the top-down view.

const LOOK_SENS = 0.0024;
const PROTO_BIOMES = ['meadow', 'desert', 'tundra', 'neon'];

const Proto = {
  view: 'cockpit',
  state: 'briefing',
  biomeIdx: 0,
  mouse: { x: 0, y: 0, down: false, pressed: false },
  cam: { x: 0, y: 0, zoom: 1 },
  locked: false,
  time: 0,

  init() {
    this.c2d = document.getElementById('hud');
    this.ctx = this.c2d.getContext('2d');
    this.c3d = document.getElementById('gl');
    this.ui = document.getElementById('ui');
    try {
      this.cockpit = new CockpitView(this.c3d);
    } catch (e) {
      this.cockpit = null; // no WebGL: top-down only
      this.view = 'top';
    }
    Input.init();
    window.addEventListener('resize', () => this.resize());
    this.resize();

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (this.locked && this.cockpit) {
        const l = this.cockpit.look;
        l.yaw = wrapAngle(l.yaw + e.movementX * LOOK_SENS);
        l.pitch = clamp(l.pitch - e.movementY * LOOK_SENS, -0.75, 0.6);
      }
    });
    this.c2d.addEventListener('mousedown', (e) => {
      Sound.resume();
      if (this.state !== 'race') return;
      if (this.view === 'cockpit' && !this.locked) { this.lock(); return; }
      if (e.button === 0) { this.mouse.down = true; this.mouse.pressed = true; }
      if (e.button === 2) this.throwGrenade();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    this.c2d.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { if (this.combat && this.state === 'race') this.combat.cycle(Math.sign(e.deltaY)); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.c2d;
      if (!this.locked && this.state === 'race' && this.view === 'cockpit') this.pause();
    });
    this.ui.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      Sound.resume();
      this.action(el.dataset.action);
    });

    this.newRace();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.c2d.width = Math.floor(this.W * dpr);
    this.c2d.height = Math.floor(this.H * dpr);
    if (this.cockpit) this.cockpit.resize(this.W, this.H);
  },

  lock() {
    if (this.c2d.requestPointerLock) this.c2d.requestPointerLock();
  },

  setUI(html) {
    this.ui.innerHTML = html;
    this.ui.classList.toggle('hidden', !html);
  },

  action(a) {
    switch (a) {
      case 'start': this.startRace(); break;
      case 'resume': this.resume(); break;
      case 'view-cockpit': this.setView('cockpit'); this.refresh(); break;
      case 'view-top': this.setView('top'); this.refresh(); break;
      case 'next': this.newRace(); break;
      case 'restart': this.newRace(this.seed); break;
      case 'retro': this.toggleRetro(); this.refresh(); break;
    }
  },

  refresh() {
    if (this.state === 'briefing') this.showBriefing();
    else if (this.state === 'paused') this.showPause();
  },

  toggleRetro() {
    if (this.cockpit) this.cockpit.setRetro(!PSX.enabled);
  },

  setView(v) {
    if (v === 'cockpit' && !this.cockpit) return;
    this.view = v;
    this.c3d.style.display = v === 'cockpit' ? 'block' : 'none';
    if (v === 'top' && this.locked) document.exitPointerLock();
  },

  // ---------- Race setup ----------

  newRace(seed) {
    if (this.locked) document.exitPointerLock();
    this.seed = seed || (Math.random() * 2 ** 31) | 0;
    if (!seed) this.biomeIdx = (this.biomeIdx + 1) % PROTO_BIOMES.length;
    const rng = mulberry32(this.seed);
    const biome = PROTO_BIOMES[this.biomeIdx];
    const track = generateTrack(this.seed, biome, { hazardLevel: 1 });
    renderTrack(track);
    const base = CARS.comet;
    const stats = computeStats(newRun('comet', 1));
    const player = new Car({ name: 'You', color: base.color, accent: base.accent, isPlayer: true, stats });
    const driver = new AIDriver(player, 0.95, rng);
    stats.aLat = (1050 + 650 * 0.15) * Math.sqrt(track.biome.grip);
    this.race = new Race({
      track, laps: 3, playerCar: player, rng, qualify: 3,
      opponents: buildOpponents(rng, 3, { aiBonus: 0 }, false),
      playerGrid: 4,
    });
    this.driver = driver;
    this.combat = new Combat(this.race, { driver });
    this.race.onRenderWorld = (ctx, t) => this.combat.render2D(ctx, t);
    if (this.cockpit) this.cockpit.load(this.race, this.combat);
    this.cam.x = player.x;
    this.cam.y = player.y;
    this.cam.zoom = this.baseZoom();
    this.state = 'briefing';
    this.setView(this.view);
    this.showBriefing();
  },

  startRace() {
    this.state = 'race';
    this.setUI('');
    if (this.view === 'cockpit') this.lock();
  },

  pause() {
    if (this.state !== 'race') return;
    this.state = 'paused';
    this.mouse.down = false;
    Sound.engine(0, 0, false, false);
    this.showPause();
  },

  resume() {
    this.state = 'race';
    this.setUI('');
    if (this.view === 'cockpit') this.lock();
  },

  throwGrenade() {
    const p = this.race.player;
    if (this.view === 'cockpit') {
      const pitch = this.cockpit.look.pitch;
      this.combat.throwGrenade(this.cockpit.aimAngle(), 210 + pitch * 420);
    } else {
      const w = this.mouseWorld();
      this.combat.throwGrenade(Math.atan2(w.y - p.y, w.x - p.x), Math.hypot(w.x - p.x, w.y - p.y));
    }
  },

  mouseWorld() {
    return {
      x: this.cam.x + (this.mouse.x - this.W / 2) / this.cam.zoom,
      y: this.cam.y + (this.mouse.y - this.H / 2) / this.cam.zoom,
    };
  },

  aimAngle() {
    if (this.view === 'cockpit') return this.cockpit.aimAngle();
    const w = this.mouseWorld(), p = this.race.player;
    return Math.atan2(w.y - p.y, w.x - p.x);
  },

  baseZoom() { return clamp(Math.min(this.W, this.H) / 900, 0.45, 1.2); },

  // ---------- Screens ----------

  showBriefing() {
    const race = this.race, tr = race.track, bio = tr.biome;
    const rivals = race.cars.filter((c) => c !== race.player).map((c) => `
      <div class="rival"><span class="dot" style="background:${c.color}"></span>${c.name}
      ${c.weapon === 'rocket' ? '<em class="tag red">🚀 Rocket gunner</em>' : c.weapon === 'mine' ? '<em class="tag yellow">💣 Mine layer</em>' : ''}</div>`).join('');
    const boosts = tr.hazards.filter((h) => h.type === 'boost').length, oils = tr.hazards.length - boosts;
    this.setUI(`<div class="screen briefing">
      <h1>Race Briefing</h1>
      <p class="muted">Gunner prototype · the car drives itself. Survive, shoot, defend.</p>
      <div class="brief-grid">
        <div class="panel"><canvas id="preview" width="320" height="320"></canvas>
          <h2>${bio.name}</h2><p class="muted">${bio.blurb}</p>
          <p>${race.laps} laps · ${Math.round((tr.length * 0.125) / 10) * 10}m lap · ${boosts} boost pads · ${oils} oil slicks</p>
          <p><b>Finish top ${race.qualify}</b></p>
        </div>
        <div class="panel"><h2>Rivals</h2>${rivals}
          <h2>Controls</h2>
          <div class="ctl"><kbd>Mouse</kbd> Aim / look around · <kbd>LMB</kbd> Fire</div>
          <div class="ctl"><kbd>1</kbd> SMG (overheats) · <kbd>2</kbd> Rocket launcher · <kbd>Q</kbd>/<kbd>Wheel</kbd> switch</div>
          <div class="ctl"><kbd>RMB</kbd>/<kbd>G</kbd> Grenade (look higher to throw further)</div>
          <div class="ctl"><kbd>Space</kbd> Shield: block right as a rocket hits to <b>parry</b> it back</div>
          <div class="ctl"><kbd>A</kbd>/<kbd>D</kbd> Order the driver to swerve</div>
          <div class="ctl"><kbd>V</kbd> Switch view · <kbd>F</kbd> Retro filter · <kbd>Esc</kbd> Pause · <kbd>M</kbd> Mute</div>
          <p class="muted small">Shoot rockets and mines out of the air with the SMG. Red laser = a gunner is locking on to you.</p>
        </div>
      </div>
      <div class="btn-row">
        ${this.cockpit ? `<button class="btn ${this.view === 'cockpit' ? 'primary' : ''}" data-action="view-cockpit">Cockpit view</button>` : ''}
        <button class="btn ${this.view === 'top' ? 'primary' : ''}" data-action="view-top">Top-down view</button>
        ${this.cockpit ? `<button class="btn" data-action="retro">Retro filter: ${PSX.enabled ? 'ON' : 'OFF'}</button>` : ''}
      </div>
      <button class="btn primary big" data-action="start">Start race ▶</button>
      <p><a class="muted small" href="index.html">← Back to the main game</a></p>
    </div>`);
    drawTrackPreview(document.getElementById('preview'), race);
  },

  showPause() {
    this.setUI(`<div class="screen pause">
      <h1>Paused</h1>
      <button class="btn primary big" data-action="resume">${this.view === 'cockpit' ? 'Click to resume aiming' : 'Resume'}</button>
      ${this.cockpit ? `<button class="btn" data-action="${this.view === 'cockpit' ? 'view-top' : 'view-cockpit'}">Switch to ${this.view === 'cockpit' ? 'top-down' : 'cockpit'} view</button>` : ''}
      ${this.cockpit ? `<button class="btn" data-action="retro">Retro filter: ${PSX.enabled ? 'ON' : 'OFF'} (F)</button>` : ''}
      <button class="btn" data-action="restart">Restart this race</button>
      <button class="btn ghost" data-action="next">New track</button>
    </div>`);
  },

  showResults() {
    const race = this.race, p = race.player, s = this.combat.stats;
    race.rankCars();
    const ok = p.place <= race.qualify;
    const rows = race.ranking.map((c, i) => `<tr class="${c.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><span class="dot" style="background:${c.color}"></span>${c.name}${c.weapon ? ' ⚔' : ''}</td><td>${c.finished ? fmtTime(c.finishTime) : '—'}</td><td>${Math.ceil(c.hp)} HP</td></tr>`).join('');
    this.setUI(`<div class="screen results">
      <h1 class="${ok ? 'good' : 'bad'}">${ordinal(p.place)} place: ${ok ? 'you survived' : 'not good enough'}</h1>
      <div class="results-grid">
        <table class="standings">${rows}</table>
        <div class="payout">
          <div><span>Damage dealt</span><b>${Math.round(s.dealt)}</b></div>
          <div><span>Rivals wrecked</span><b>${s.wrecked}</b></div>
          <div><span>Rockets &amp; mines shot down</span><b>${s.shotDown}</b></div>
          <div><span>Parries</span><b>${s.parries}</b></div>
          <div><span>Damage taken</span><b>${Math.round(s.taken)}</b></div>
          <div class="total"><span>Hull left</span><b>${Math.ceil(p.hp)} / ${p.stats.maxHp}</b></div>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn primary big" data-action="next">Next track ▶</button>
        <button class="btn" data-action="restart">Retry this track</button>
      </div>
    </div>`);
  },

  // ---------- Loop ----------

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    if (Input.consume('KeyM')) Sound.toggleMute();
    if (Input.consume('KeyF')) { this.toggleRetro(); this.refresh(); }

    if (this.state === 'race') {
      if (Input.consume('KeyV')) this.setView(this.view === 'cockpit' ? 'top' : 'cockpit');
      if (Input.consume('KeyP') || Input.consume('Escape')) this.pause();
      else if (this.view === 'cockpit' && !this.locked && !this.noLock) Sound.engine(0, 0, false, false); // wait for a click
      else this.updateRace(dt);
    }
    this.render(dt);
    Input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  },

  updateRace(dt) {
    const race = this.race, combat = this.combat, p = race.player;
    if (Input.consume('Digit1')) combat.select('smg');
    if (Input.consume('Digit2')) combat.select('rocket');
    if (Input.consume('KeyQ')) combat.cycle(1);
    if (Input.consume('Space')) combat.activateShield();
    if (Input.consume('KeyA') || Input.consume('ArrowLeft')) combat.swerve(-1);
    if (Input.consume('KeyD') || Input.consume('ArrowRight')) combat.swerve(1);
    if (Input.consume('KeyG')) this.throwGrenade();

    const aim = this.aimAngle();
    const sub = 2;
    for (let k = 0; k < sub; k++) {
      const sdt = dt / sub;
      const inp = race.state === 'racing'
        ? this.driver.update(race, sdt)
        : { throttle: race.countdown < 0.2 ? 1 : 0, brake: 0, steer: 0, handbrake: false, nitro: false };
      race.update(sdt, inp);
      combat.update(sdt, { aim, firing: this.mouse.down, pressed: this.mouse.pressed && k === 0 });
      for (const ev of race.events) Sound.play(ev);
      for (const ev of combat.events) {
        Sound.play(ev);
        if (this.cockpit) this.cockpit.onEvent(ev);
      }
      combat.events.length = 0;
    }
    this.mouse.pressed = false;
    Sound.engine(clamp(p.speed / p.stats.top, 0, 1.4), p.input ? p.input.throttle : 0, p.nitroOn, true);

    const lead = 0.3;
    this.cam.x = lerp(this.cam.x, p.x + p.vx * lead, Math.min(1, dt * 5));
    this.cam.y = lerp(this.cam.y, p.y + p.vy * lead, Math.min(1, dt * 5));
    this.cam.zoom = lerp(this.cam.zoom, this.baseZoom() * clamp(1.0 - p.speed / 2600, 0.78, 1), Math.min(1, dt * 1.5));

    if (race.state === 'done') {
      this.state = 'results';
      if (this.locked) document.exitPointerLock();
      Sound.engine(0, 0, false, false);
      this.showResults();
    }
  },

  render(dt) {
    const ctx = this.ctx, W = this.W, H = this.H, race = this.race;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!race) return;
    const live = this.state !== 'briefing';
    if (this.view === 'cockpit') {
      this.cockpit.render(this.state === 'race' ? dt : 0, this.time);
      ctx.clearRect(0, 0, W, H);
      if (live) drawCockpitHUD(ctx, this, W, H, this.time);
      if (this.state === 'race' && !this.locked && !this.noLock) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, H / 2 - 40, W, 80);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = `bold 26px ${hudFont()}`;
        ctx.fillText('Click to grab your gun', W / 2, H / 2 + 9);
      }
    } else {
      race.render(ctx, this.cam, W, H, this.time);
      if (live) {
        drawHUD(ctx, race, W, H, this.time, false);
        drawTopdownCombatHUD(ctx, this, W, H, this.time);
      }
    }
  },
};

// ---------- HUD pieces ----------

const hudFont = () => (PSX.enabled ? '"Courier New", monospace' : 'system-ui, sans-serif');

function drawTrackPreview(canvas, race) {
  const ctx = canvas.getContext('2d'), tr = race.track, b = tr.bounds;
  const S = canvas.width, sc = (S - 30) / Math.max(b.maxX - b.minX, b.maxY - b.minY);
  const ox = (S - (b.maxX - b.minX) * sc) / 2, oy = (S - (b.maxY - b.minY) * sc) / 2;
  const map = (x, y) => [ox + (x - b.minX) * sc, oy + (y - b.minY) * sc];
  ctx.fillStyle = tr.biome.bg;
  ctx.fillRect(0, 0, S, S);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  tr.pts.forEach((p, i) => { const [x, y] = map(p.x, p.y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.closePath();
  ctx.strokeStyle = tr.biome.wall;
  ctx.lineWidth = (tr.hw + tr.runoff) * 2 * sc + 4;
  ctx.stroke();
  ctx.strokeStyle = tr.biome.asphalt;
  ctx.lineWidth = tr.hw * 2 * sc;
  ctx.stroke();
  for (const h of tr.hazards) {
    const [x, y] = map(h.x, h.y);
    ctx.fillStyle = h.type === 'boost' ? '#5ad8ff' : '#111';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
  }
  // Start line and direction arrow.
  const [sx, sy] = map(tr.pts[0].x, tr.pts[0].y);
  const a = tr.ang[0];
  ctx.fillStyle = '#ffd23f';
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.fill();
  ctx.restore();
}

function drawWeaponPanel(ctx, P, W, H) {
  const c = P.combat;
  const x = W - 250, y = H - 150;
  hudPanel(ctx, x, y, 238, 138);
  ctx.textAlign = 'left';
  const row = (yy, active, label, right, frac, col) => {
    ctx.fillStyle = active ? '#ffd23f' : 'rgba(255,255,255,0.6)';
    ctx.font = `${active ? 'bold ' : ''}14px ${hudFont()}`;
    ctx.fillText(label, x + 12, yy);
    ctx.textAlign = 'right';
    ctx.fillText(right, x + 226, yy);
    ctx.textAlign = 'left';
    if (frac != null) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 12, yy + 5, 214, 5);
      ctx.fillStyle = col;
      ctx.fillRect(x + 12, yy + 5, 214 * clamp(frac, 0, 1), 5);
    }
  };
  const g = c.smg, r = c.rockets, n = c.nades, s = c.shield;
  row(y + 22, c.weapon === 'smg', '1  SMG', g.overheated ? 'OVERHEATED' : `heat ${Math.round(g.heat * 100)}%`, g.heat, g.overheated ? '#ff3b1f' : '#ff9f1c');
  row(y + 50, c.weapon === 'rocket', '2  Rockets', `${r.ammo}/${r.max}`, r.ammo < r.max ? r.reload / 3.5 : 1, '#5ad8ff');
  row(y + 78, false, 'G  Grenades', `${n.ammo}/${n.max}`, n.ammo < n.max ? n.regen / 9 : 1, '#7cfc00');
  row(y + 106, s.t > 0, '␣  Shield', s.t > 0 ? 'ACTIVE' : s.cd > 0 ? `${s.cd.toFixed(1)}s` : 'READY', s.cd > 0 ? 1 - s.cd / s.cooldown : 1, '#5ad8ff');
  ctx.fillStyle = c.swerveCd > 0 ? 'rgba(255,255,255,0.5)' : '#fff';
  ctx.font = `13px ${hudFont()}`;
  ctx.fillText(`A/D  Swerve ${c.swerveCd > 0 ? c.swerveCd.toFixed(1) + 's' : 'ready'}`, x + 12, y + 130);
}

function drawMessages(ctx, race, W, H) {
  ctx.textAlign = 'center';
  let y = H * 0.24;
  for (const m of race.messages) {
    const a = clamp(Math.min(m.t * 6, (m.life - m.t) * 3), 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `bold ${m.big ? 44 : 22}px ${hudFont()}`;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(m.text, W / 2 + 2, y + 2);
    ctx.fillStyle = m.color;
    ctx.fillText(m.text, W / 2, y);
    y += m.big ? 52 : 30;
  }
  ctx.globalAlpha = 1;
}

function drawDamageVignette(ctx, P, W, H, viewAng) {
  const c = P.combat;
  for (const h of c.hits) {
    const a = (1 - h.t / 1.2) * Math.min(1, h.dmg / 10);
    const rel = wrapAngle(h.ang - viewAng);
    const ex = W / 2 + Math.sin(rel) * W * 0.5, ey = H / 2 - Math.cos(rel) * H * 0.5;
    const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, Math.max(W, H) * 0.55);
    g.addColorStop(0, `rgba(255,0,0,${0.45 * a})`);
    g.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const s = c.shield;
  if (s.t > 0) {
    const perfect = s.age < PARRY_WINDOW;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(90,216,255,0)');
    g.addColorStop(1, perfect ? 'rgba(255,255,255,0.45)' : 'rgba(90,216,255,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawCockpitHUD(ctx, P, W, H, t) {
  const race = P.race, c = P.combat, p = race.player;
  const viewAng = P.cockpit.aimAngle();
  drawDamageVignette(ctx, P, W, H, viewAng);

  // Threat ring: arcs pointing at locks and incoming rockets.
  const R = Math.min(W, H) * 0.3;
  ctx.lineCap = 'round';
  for (const th of c.threats()) {
    const rel = wrapAngle(Math.atan2(th.y - p.y, th.x - p.x) - viewAng);
    const start = rel - Math.PI / 2;
    if (th.kind === 'lock') {
      if (Math.floor(t * (5 + th.k * 15)) % 2) continue;
      ctx.strokeStyle = 'rgba(255,60,60,0.9)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, R, start - 0.18, start + 0.18); ctx.stroke();
      ctx.fillStyle = '#ff4040';
      ctx.font = `bold 13px ${hudFont()}`;
      ctx.textAlign = 'center';
      ctx.fillText('LOCK', W / 2 + Math.sin(rel) * (R + 20), H / 2 - Math.cos(rel) * (R + 20) + 4);
    } else {
      ctx.strokeStyle = `rgba(255,${Math.round(140 - 140 * th.k)},40,1)`;
      ctx.lineWidth = 6 + th.k * 10;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, R + 8, start - 0.12, start + 0.12); ctx.stroke();
      ctx.fillStyle = '#ffb13b';
      ctx.font = `bold 13px ${hudFont()}`;
      ctx.textAlign = 'center';
      ctx.fillText('ROCKET', W / 2 + Math.sin(rel) * (R + 34), H / 2 - Math.cos(rel) * (R + 34) + 4);
    }
  }

  // Crosshair
  const cx = W / 2, cy = H / 2;
  ctx.strokeStyle = c.smg.overheated && c.weapon === 'smg' ? '#ff3b1f' : 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  if (c.weapon === 'smg') {
    const gap = 6 + c.smg.heat * 8;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath(); ctx.moveTo(cx + dx * gap, cy + dy * gap); ctx.lineTo(cx + dx * (gap + 8), cy + dy * (gap + 8)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,159,28,0.8)';
    ctx.beginPath(); ctx.arc(cx, cy, 22, -Math.PI / 2, -Math.PI / 2 + TAU * c.smg.heat); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  }

  // Minimal race info (the rest lives on the dashboard).
  hudPanel(ctx, 12, 12, 190, 56);
  ctx.textAlign = 'left';
  ctx.fillStyle = p.place <= race.qualify ? '#7CFC00' : '#ff6b6b';
  ctx.font = `bold 30px ${hudFont()}`;
  ctx.fillText(ordinal(p.place), 22, 50);
  ctx.fillStyle = '#fff';
  ctx.font = `14px ${hudFont()}`;
  const lap = clamp(Math.floor(p.progress / race.track.N) + 1, 1, race.laps);
  ctx.fillText(`Lap ${p.finished ? race.laps : lap}/${race.laps}  ${fmtTime(p.finished ? p.finishTime : race.time)}`, 84, 46);

  if (PSX.enabled) {
    // Chunky name tags drawn on the crisp HUD layer (3D text would be mush at 240p).
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Courier New", monospace';
    for (const tg of P.cockpit.tags(W, H)) {
      const a = clamp(1.3 - tg.d / 900, 0.25, 1);
      const w = ctx.measureText(tg.label).width + 10;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(Math.round(tg.x - w / 2), Math.round(tg.y - 12), Math.round(w), 16);
      ctx.fillStyle = tg.armed ? '#ff8a6a' : '#e8e2c8';
      ctx.fillText(tg.label, Math.round(tg.x), Math.round(tg.y));
    }
    ctx.globalAlpha = 1;
  }
  drawWeaponPanel(ctx, P, W, H);
  if (race.state === 'countdown') {
    const n = Math.ceil(race.countdown);
    if (n <= 3) {
      ctx.textAlign = 'center';
      ctx.font = `bold 110px ${hudFont()}`;
      ctx.fillStyle = ['#7CFC00', '#ffd23f', '#ff9f1c', '#ff4040'][n];
      ctx.fillText(n, W / 2, H / 2 - 60);
    }
  }
  drawMessages(ctx, race, W, H);
}

function drawTopdownCombatHUD(ctx, P, W, H, t) {
  const race = P.race, c = P.combat, p = race.player;
  // Off-screen threats: arrows on the screen edge.
  for (const th of c.threats()) {
    const sx = W / 2 + (th.x - P.cam.x) * P.cam.zoom, sy = H / 2 + (th.y - P.cam.y) * P.cam.zoom;
    if (sx > 20 && sy > 20 && sx < W - 20 && sy < H - 20) continue;
    const a = Math.atan2(sy - H / 2, sx - W / 2);
    const ex = clamp(sx, 30, W - 30), ey = clamp(sy, 30, H - 30);
    if (th.kind === 'lock' && Math.floor(t * 8) % 2) continue;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.fillStyle = th.kind === 'lock' ? '#ff4040' : '#ffb13b';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.fill();
    ctx.restore();
  }
  drawDamageVignette(ctx, P, W, H, -Math.PI / 2);
  // Cursor crosshair
  const mx = P.mouse.x, my = P.mouse.y;
  ctx.strokeStyle = c.smg.overheated && c.weapon === 'smg' ? '#ff3b1f' : '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx, my, 10, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx - 16, my); ctx.lineTo(mx - 6, my); ctx.moveTo(mx + 6, my); ctx.lineTo(mx + 16, my);
  ctx.moveTo(mx, my - 16); ctx.lineTo(mx, my - 6); ctx.moveTo(mx, my + 6); ctx.lineTo(mx, my + 16); ctx.stroke();
  drawWeaponPanel(ctx, P, W, H);
}

window.addEventListener('load', () => Proto.init());
