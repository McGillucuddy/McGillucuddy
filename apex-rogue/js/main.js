'use strict';
// Game flow: title -> garage -> race -> results -> reward -> ... -> victory / game over.

const META_KEY = 'apexrogue_meta_v1';
const RACES_PER_RUN = RACE_PLAN.length;

function loadMeta() {
  const def = { runs: 0, wins: 0, bestRace: 0, bestTime: null };
  try {
    return Object.assign(def, JSON.parse(localStorage.getItem(META_KEY)) || {});
  } catch (e) {
    return def;
  }
}

function saveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* storage unavailable */ }
}

function carUnlocked(meta, key) {
  const u = CARS[key].unlock;
  if (!u) return true;
  if (u.bestRace != null && meta.bestRace >= u.bestRace) return true;
  if (u.wins != null && meta.wins >= u.wins) return true;
  return false;
}

const Game = {
  state: 'title',
  meta: loadMeta(),
  selectedCar: 'comet',
  run: null,
  rng: null,
  routeChoices: [],
  node: null,
  race: null,
  result: null,
  offer: null,
  cam: { x: 0, y: 0, zoom: 1 },
  time: 0,
  wrongWayT: 0,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ui = document.getElementById('ui');
    Input.init();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.ui.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || el.disabled) return;
      Sound.resume();
      this.action(el.dataset.action, el.dataset.arg);
    });
    window.addEventListener('pointerdown', () => Sound.resume(), { once: true });
    window.addEventListener('keydown', () => Sound.resume(), { once: true });
    this.showTitle();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * dpr);
    this.canvas.height = Math.floor(this.H * dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
  },

  setUI(html) {
    this.ui.innerHTML = html;
    this.ui.classList.toggle('hidden', !html);
    this.ui.querySelectorAll('canvas[data-car]').forEach((c) => drawCarPreview(c, c.dataset.car));
  },

  // ---------- Actions ----------

  action(act, arg) {
    Sound.play({ type: 'click' });
    switch (act) {
      case 'select-car': if (carUnlocked(this.meta, arg)) { this.selectedCar = arg; this.showTitle(); } break;
      case 'start-run': this.startRun(); break;
      case 'buy-stat': this.buyStat(arg); break;
      case 'repair': this.buyRepair(); break;
      case 'spare': this.buySpare(); break;
      case 'crate': this.buyCrate(); break;
      case 'choose-node': this.node = this.routeChoices[+arg]; this.startRace(); break;
      case 'results-continue': this.afterResults(); break;
      case 'retry': this.retryRace(); break;
      case 'pick-card': this.pickCard(+arg); break;
      case 'skip-card': this.skipCard(); break;
      case 'resume': this.state = 'race'; this.setUI(''); break;
      case 'quit-run': this.endRun(false); break;
      case 'to-title': this.showTitle(); break;
      case 'mute': Sound.toggleMute(); this.refreshScreen(); break;
    }
  },

  refreshScreen() {
    if (this.state === 'title') this.showTitle();
    else if (this.state === 'garage') this.showGarage();
    else if (this.state === 'paused') this.showPause();
  },

  // ---------- Run flow ----------

  startRun() {
    const seed = (Math.random() * 2 ** 31) | 0;
    this.run = newRun(this.selectedCar, seed);
    this.rng = mulberry32(seed);
    this.meta.runs++;
    saveMeta(this.meta);
    this.routeChoices = genRouteChoices(this.run, this.rng);
    this.showGarage();
  },

  startRace() {
    const run = this.run, node = this.node;
    const track = generateTrack(node.seed, node.biome, { hazardLevel: node.hazardLevel });
    renderTrack(track);
    const base = CARS[run.carKey];
    const stats = computeStats(run);
    run.hp = clamp(run.hp, 0, stats.maxHp);
    const player = new Car({
      name: 'You', color: base.color, accent: base.accent, isPlayer: true,
      stats, perks: run.perks, hp: run.hp,
    });
    const rng = mulberry32(node.seed + 1 + (this.retries || 0));
    this.race = new Race({
      track, laps: node.laps, playerCar: player, rng, qualify: node.qualify,
      opponents: buildOpponents(rng, run.raceIndex, node, node.boss),
      playerGrid: Math.min(OPPONENTS, 3 + Math.floor(run.raceIndex / 2)),
    });
    this.cam.x = player.x;
    this.cam.y = player.y;
    this.cam.zoom = this.baseZoom();
    this.wrongWayT = 0;
    this.meta.bestRace = Math.max(this.meta.bestRace, run.raceIndex);
    saveMeta(this.meta);
    this.state = 'race';
    this.setUI('');
  },

  finishRace() {
    const race = this.race, run = this.run, node = this.node, p = race.player;
    race.rankCars();
    const place = p.place;
    const prize = prizeFor(place, node, run.raceIndex, run);
    const clean = p.wallHits === 0 ? 75 : 0;
    const total = prize + clean + race.overtakeCash;
    run.cash += total;
    run.totalEarned += total;
    run.hp = p.hp;
    const qualified = place <= node.qualify;
    run.history.push({ race: run.raceIndex, place, biome: node.biome, type: node.type, time: p.finished ? p.finishTime : null });
    this.result = { place, prize, clean, overtakeCash: race.overtakeCash, total, qualified, ranking: race.ranking.slice() };
    this.state = 'results';
    Sound.engine(0, 0, false, false);
    this.showResults();
  },

  afterResults() {
    const run = this.run;
    if (!this.result.qualified) {
      this.endRun(false);
      return;
    }
    this.retries = 0;
    if (this.node.boss) {
      this.endRun(true);
      return;
    }
    const boost = this.node.rarityBoost + (this.result.place === 1 ? 0.5 : 0);
    this.offer = { cards: rollCards(run, this.rng, 3, boost), source: 'race' };
    this.showReward();
  },

  retryRace() {
    const run = this.run;
    if (run.lives <= 0) return;
    run.lives--;
    this.retries = (this.retries || 0) + 1;
    run.hp = Math.max(run.hp, computeStats(run).maxHp * 0.5);
    this.startRace();
  },

  pickCard(i) {
    const card = this.offer.cards[i];
    applyCard(this.run, card);
    Sound.play({ type: 'buy' });
    this.afterOffer();
  },

  skipCard() {
    if (this.offer.source === 'race') this.run.cash += 75;
    this.afterOffer();
  },

  afterOffer() {
    if (this.offer.source === 'race') {
      this.run.raceIndex++;
      this.routeChoices = genRouteChoices(this.run, this.rng);
    }
    this.offer = null;
    this.showGarage();
  },

  endRun(won) {
    const run = this.run;
    const before = Object.keys(CARS).filter((k) => carUnlocked(this.meta, k));
    if (won) this.meta.wins++;
    this.meta.bestRace = Math.max(this.meta.bestRace, run.raceIndex + (won ? 1 : 0));
    saveMeta(this.meta);
    const unlockedNow = Object.keys(CARS).filter((k) => carUnlocked(this.meta, k) && !before.includes(k));
    this.state = won ? 'victory' : 'over';
    this.race = null;
    Sound.engine(0, 0, false, false);
    this.showEnd(won, unlockedNow);
  },

  // ---------- Shop ----------

  buyStat(stat) {
    const run = this.run;
    const cost = shopStatCost(run, stat);
    if (run.cash < cost || run.shopLevels[stat] >= MAX_SHOP_LEVEL) return;
    run.cash -= cost;
    run.shopLevels[stat]++;
    run.statLevels[stat]++;
    Sound.play({ type: 'buy' });
    this.showGarage();
  },

  buyRepair() {
    const run = this.run;
    const max = computeStats(run).maxHp;
    const missing = max - run.hp;
    if (missing <= 0 || run.cash <= 0) return;
    const hp = Math.min(missing, run.cash / 2);
    run.cash -= Math.ceil(hp * 2);
    run.hp = Math.min(max, run.hp + hp);
    Sound.play({ type: 'buy' });
    this.showGarage();
  },

  buySpare() {
    const run = this.run, cost = spareEngineCost(run);
    if (run.cash < cost) return;
    run.cash -= cost;
    run.lives++;
    run.spareBought++;
    Sound.play({ type: 'buy' });
    this.showGarage();
  },

  buyCrate() {
    const run = this.run;
    if (run.cash < CRATE_COST) return;
    run.cash -= CRATE_COST;
    this.offer = { cards: rollCards(run, this.rng, 3, 3), source: 'crate' };
    Sound.play({ type: 'buy' });
    this.showReward();
  },

  // ---------- Screens ----------

  showTitle() {
    this.state = 'title';
    const m = this.meta;
    if (!carUnlocked(m, this.selectedCar)) this.selectedCar = 'comet';
    const cars = Object.keys(CARS).map((k) => {
      const c = CARS[k];
      const un = carUnlocked(m, k);
      const sel = k === this.selectedCar;
      return `<button class="car-card ${sel ? 'selected' : ''} ${un ? '' : 'locked'}" data-action="select-car" data-arg="${k}">
        <canvas data-car="${k}" width="120" height="70"></canvas>
        <div class="car-name">${un ? c.name : '🔒 ' + c.name}</div>
        <div class="car-desc">${un ? c.desc : c.unlock.text}</div>
        ${un ? statBars(c) : ''}
      </button>`;
    }).join('');
    this.setUI(`<div class="screen title-screen">
      <h1 class="logo">APEX<span>ROGUE</span></h1>
      <p class="tagline">Top-down roguelite racing. 8 races. One run. Upgrade or die trying.</p>
      <div class="car-row">${cars}</div>
      <button class="btn primary big" data-action="start-run">Start Run ▶</button>
      <div class="meta-line">Runs: ${m.runs} · Championships: ${m.wins} · Furthest: Race ${Math.min(m.bestRace + 1, RACES_PER_RUN)}</div>
      <div class="controls">
        <div><kbd>W</kbd>/<kbd>↑</kbd> Accelerate</div><div><kbd>S</kbd>/<kbd>↓</kbd> Brake / reverse</div>
        <div><kbd>A</kbd><kbd>D</kbd>/<kbd>←</kbd><kbd>→</kbd> Steer</div><div><kbd>Shift</kbd> Nitro</div>
        <div><kbd>Space</kbd> Handbrake drift</div><div><kbd>R</kbd> Reset car · <kbd>Esc</kbd> Pause · <kbd>M</kbd> Mute</div>
      </div>
      <p class="hint">Tip: press accelerate right as the countdown hits GO for a perfect launch. Hold it too early and you'll wheelspin.</p>
    </div>`);
  },

  showGarage() {
    this.state = 'garage';
    const run = this.run;
    const s = computeStats(run);
    const plan = RACE_PLAN[run.raceIndex];
    const statRows = Object.keys(STAT_DEFS).map((k) => {
      const d = STAT_DEFS[k];
      const cost = shopStatCost(run, k);
      const maxed = run.shopLevels[k] >= MAX_SHOP_LEVEL;
      const lv = run.statLevels[k];
      return `<div class="stat-row">
        <div class="stat-label"><b>${d.name}</b><small>${d.label} +${Math.round(d.per * 100)}%/lvl</small></div>
        <div class="pips">${'<i class="on"></i>'.repeat(Math.min(lv, 10))}${'<i></i>'.repeat(Math.max(0, 6 - lv))}${lv > 10 ? `<em>+${lv - 10}</em>` : ''}</div>
        <button class="btn small" data-action="buy-stat" data-arg="${k}" ${maxed || run.cash < cost ? 'disabled' : ''}>${maxed ? 'MAX' : fmtMoney(cost)}</button>
      </div>`;
    }).join('');
    const rc = repairCost(run);
    const perks = run.perks.length
      ? run.perks.map((id) => { const c = CARD_BY_ID[id]; return `<span class="perk rarity-${c.rarity}" title="${c.desc}">${c.icon} ${c.name}</span>`; }).join('')
      : '<span class="muted">No perks yet. Win races to earn upgrade cards.</span>';
    const nodes = this.routeChoices.map((n, i) => {
      const b = BIOMES[n.biome];
      return `<button class="node-card node-${n.type} ${n.boss ? 'boss' : ''}" data-action="choose-node" data-arg="${i}">
        <div class="node-swatch" style="background:linear-gradient(135deg, ${b.bg}, ${b.asphalt} 60%, ${b.wall})"></div>
        <div class="node-type">${n.label}</div>
        <div class="node-biome">${b.name}</div>
        <div class="node-desc">${b.blurb}<br>${n.desc}</div>
        <div class="node-facts"><span>${n.laps} laps</span><span>Top ${n.qualify} to advance</span><span>${n.cashMult}x 💰</span></div>
        <div class="btn primary">Race ▶</div>
      </button>`;
    }).join('');
    this.setUI(`<div class="screen garage">
      <div class="topbar">
        <div class="progress-dots">${RACE_PLAN.map((p, i) => `<i class="${i < run.raceIndex ? 'done' : i === run.raceIndex ? 'cur' : ''} ${p.boss ? 'boss' : ''}"></i>`).join('')}</div>
        <div>Race <b>${run.raceIndex + 1}</b>/${RACES_PER_RUN}</div>
        <div class="cash">${fmtMoney(run.cash)}</div>
        <div>❤️ Lives: <b>${run.lives}</b></div>
        <button class="btn small ghost" data-action="mute">${Sound.muted ? '🔇' : '🔊'}</button>
      </div>
      <div class="garage-grid">
        <div class="panel">
          <h2>Garage · ${CARS[run.carKey].name}</h2>
          <div class="hp-line">
            <div class="bar"><div style="width:${(100 * run.hp) / s.maxHp}%" class="${run.hp < s.maxHp * 0.3 ? 'low' : ''}"></div></div>
            <span>${Math.ceil(run.hp)}/${s.maxHp} HP</span>
            <button class="btn small" data-action="repair" ${rc <= 0 || run.cash <= 0 ? 'disabled' : ''}>${rc <= 0 ? 'Full HP' : run.cash >= rc ? 'Repair ' + fmtMoney(rc) : 'Patch up (' + fmtMoney(run.cash) + ')'}</button>
          </div>
          <p class="muted small">Damage carries between races. At 0 HP your car limps along at 60% power.</p>
          ${statRows}
          <div class="shop-extras">
            <button class="btn" data-action="crate" ${run.cash < CRATE_COST ? 'disabled' : ''}>📦 Mystery Crate · ${fmtMoney(CRATE_COST)}<small>Pick 1 of 3 rare+ cards</small></button>
            <button class="btn" data-action="spare" ${run.cash < spareEngineCost(run) ? 'disabled' : ''}>❤️ Spare Engine · ${fmtMoney(spareEngineCost(run))}<small>+1 life (retry a failed race)</small></button>
          </div>
          <h3>Perks</h3>
          <div class="perks">${perks}</div>
        </div>
        <div class="panel">
          <h2>${plan.boss ? 'The Final' : 'Choose your next race'}</h2>
          <div class="nodes">${nodes}</div>
        </div>
      </div>
    </div>`);
  },

  showResults() {
    const r = this.result, run = this.run, node = this.node;
    const rows = r.ranking.map((c, i) => `<tr class="${c.isPlayer ? 'me' : ''} ${i + 1 <= node.qualify ? 'q' : ''}">
      <td>${i + 1}</td><td><span class="dot" style="background:${c.color}"></span>${c.isBoss ? '👑 ' : ''}${c.name}</td>
      <td>${c.finished ? fmtTime(c.finishTime) : 'racing…'}</td></tr>`).join('');
    let buttons;
    if (r.qualified) buttons = `<button class="btn primary big" data-action="results-continue">${node.boss ? 'Claim the Championship 🏆' : 'Collect reward ▶'}</button>`;
    else if (run.lives > 0) buttons = `<button class="btn primary big" data-action="retry">Use Spare Engine & retry (❤️ ${run.lives})</button><button class="btn" data-action="results-continue">Give up</button>`;
    else buttons = `<button class="btn primary big" data-action="results-continue">End run</button>`;
    this.setUI(`<div class="screen results">
      <h1 class="${r.qualified ? 'good' : 'bad'}">${ordinal(r.place)} place — ${r.qualified ? 'Qualified!' : 'Eliminated'}</h1>
      <p class="muted">Needed top ${node.qualify}. ${BIOMES[node.biome].name} · ${node.label}</p>
      <div class="results-grid">
        <table class="standings">${rows}</table>
        <div class="payout">
          <div><span>Prize money</span><b>${fmtMoney(r.prize)}</b></div>
          <div><span>Clean race bonus</span><b>${fmtMoney(r.clean)}</b></div>
          <div><span>Overtake bonus</span><b>${fmtMoney(r.overtakeCash)}</b></div>
          <div class="total"><span>Total</span><b>${fmtMoney(r.total)}</b></div>
          <div><span>Car condition</span><b>${Math.ceil(run.hp)} / ${computeStats(run).maxHp} HP</b></div>
        </div>
      </div>
      <div class="btn-row">${buttons}</div>
    </div>`);
  },

  showReward() {
    this.state = 'reward';
    const o = this.offer;
    const cards = o.cards.map((c, i) => `<button class="up-card rarity-${c.rarity}" data-action="pick-card" data-arg="${i}">
      <div class="up-rarity">${c.rarity}${c.kind === 'perk' ? ' · perk' : ''}</div>
      <div class="up-icon">${c.icon}</div>
      <div class="up-name">${c.name}</div>
      <div class="up-desc">${c.desc}</div>
    </button>`).join('');
    this.setUI(`<div class="screen reward">
      <h1>${o.source === 'crate' ? 'Mystery Crate' : 'Choose an upgrade'}</h1>
      <p class="muted">Cash: ${fmtMoney(this.run.cash)} · HP ${Math.ceil(this.run.hp)}/${computeStats(this.run).maxHp}</p>
      <div class="cards">${cards}</div>
      <button class="btn ghost" data-action="skip-card">${o.source === 'race' ? 'Skip (+$75)' : 'Skip'}</button>
    </div>`);
  },

  showEnd(won, unlocked) {
    const run = this.run;
    const hist = run.history.map((h) => `<span class="hist ${h.place <= RACE_PLAN[h.race].qualify ? 'ok' : 'fail'}" title="${BIOMES[h.biome].name}">R${h.race + 1}: ${ordinal(h.place)}</span>`).join('');
    const unl = unlocked.map((k) => `<div class="unlock">🔓 New car unlocked: <b>${CARS[k].name}</b></div>`).join('');
    this.setUI(`<div class="screen end ${won ? 'won' : 'lost'}">
      <h1>${won ? '🏆 CHAMPION! 🏆' : 'Run Over'}</h1>
      <p>${won ? `You beat ${BOSS.name} and took the Championship.` : `Knocked out in race ${run.raceIndex + 1} of ${RACES_PER_RUN}.`}</p>
      <div class="history">${hist}</div>
      <p class="muted">Total winnings: ${fmtMoney(run.totalEarned)} · Perks: ${run.perks.length}</p>
      ${unl}
      <button class="btn primary big" data-action="to-title">Back to title</button>
    </div>`);
  },

  showPause() {
    this.setUI(`<div class="screen pause">
      <h1>Paused</h1>
      <button class="btn primary big" data-action="resume">Resume</button>
      <button class="btn" data-action="mute">${Sound.muted ? 'Unmute 🔊' : 'Mute 🔇'}</button>
      <button class="btn ghost" data-action="quit-run">Abandon run</button>
    </div>`);
  },

  // ---------- Main loop ----------

  baseZoom() { return clamp(Math.min(this.W, this.H) / 820, 0.5, 1.3); },

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;

    if (Input.consume('KeyM')) { Sound.toggleMute(); this.refreshScreen(); }

    if (this.state === 'race') {
      if (Input.consume('Escape') || Input.consume('KeyP')) {
        this.state = 'paused';
        Sound.engine(0, 0, false, false);
        this.showPause();
      } else {
        this.updateRace(dt);
      }
    } else if (this.state === 'paused') {
      if (Input.consume('Escape') || Input.consume('KeyP')) { this.state = 'race'; this.setUI(''); }
    }

    this.render();
    Input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  },

  updateRace(dt) {
    const race = this.race;
    const inp = Input.read(dt);
    if (Input.consume('KeyR') && race.state === 'racing' && !race.player.finished) {
      race.respawn(race.player);
      race.player.wheelspinT = 0.5;
    }
    const sub = 2;
    for (let k = 0; k < sub; k++) {
      race.update(dt / sub, inp);
      for (const ev of race.events) Sound.play(ev);
    }
    const p = race.player;
    Sound.engine(clamp(p.speed / p.stats.top, 0, 1.4), race.state === 'countdown' ? inp.throttle * 0.6 : inp.throttle, p.nitroOn, true);

    // Wrong-way detection.
    const tang = race.track.ang[p.idx];
    if (race.state === 'racing' && p.speed > 60 && Math.cos(Math.atan2(p.vy, p.vx) - tang) < -0.3) this.wrongWayT += dt;
    else this.wrongWayT = Math.max(0, this.wrongWayT - dt * 2);

    // Camera: lead in the direction of travel, zoom out with speed.
    const lead = 0.35;
    this.cam.x = lerp(this.cam.x, p.x + p.vx * lead, Math.min(1, dt * 5));
    this.cam.y = lerp(this.cam.y, p.y + p.vy * lead, Math.min(1, dt * 5));
    const tz = this.baseZoom() * clamp(1.08 - p.speed / 2200, 0.78, 1.08);
    this.cam.zoom = lerp(this.cam.zoom, tz, Math.min(1, dt * 1.5));

    if (race.state === 'done') this.finishRace();
  },

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.race && (this.state === 'race' || this.state === 'paused' || this.state === 'results')) {
      this.race.render(ctx, this.cam, this.W, this.H, this.time);
      if (this.state !== 'results') drawHUD(ctx, this.race, this.W, this.H, this.time, this.wrongWayT > 0.8);
    } else {
      drawBackdrop(ctx, this.W, this.H, this.time);
    }
  },
};

// ---------- Drawing helpers ----------

function statBars(c) {
  const bar = (label, v) => `<div class="sbar"><span>${label}</span><div><i style="width:${Math.round(clamp(v, 0.05, 1) * 100)}%"></i></div></div>`;
  return `<div class="sbars">
    ${bar('Speed', (c.top - 480) / 160)}${bar('Accel', (c.accel - 240) / 160)}
    ${bar('Handling', (c.handling - 2.1) / 1.1)}${bar('Armour', c.hp / 170)}
  </div>`;
}

function drawCarPreview(canvas, key) {
  const ctx = canvas.getContext('2d');
  const c = CARS[key];
  const car = new Car({ name: c.name, color: c.color, accent: c.accent, stats: { maxHp: 1, nitroCap: 1 } });
  car.placeAt(0, 0, 0);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(1.9, 1.9);
  ctx.rotate(-0.35);
  car.draw(ctx, 0);
  ctx.restore();
}

function drawBackdrop(ctx, W, H, t) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#16131f');
  g.addColorStop(1, '#2a1838');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#ff2fd0';
  ctx.lineWidth = 2;
  const off = (t * 120) % 80;
  for (let x = -H; x < W + H; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x + off, 0);
    ctx.lineTo(x + off - H * 0.6, H);
    ctx.stroke();
  }
  ctx.restore();
}

function hudPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,10,20,0.6)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
}

function drawHUD(ctx, race, W, H, t, wrongWay) {
  const p = race.player;
  const n = race.cars.length;
  const compact = W < 700;
  ctx.textBaseline = 'alphabetic';

  // Position & lap
  hudPanel(ctx, 12, 12, 170, 96);
  ctx.textAlign = 'left';
  ctx.fillStyle = p.place <= race.qualify ? '#7CFC00' : '#ff6b6b';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(ordinal(p.place), 24, 58);
  const posW = ctx.measureText(ordinal(p.place)).width;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`/ ${n}`, 24 + posW + 6, 58);
  ctx.fillStyle = '#fff';
  ctx.font = '15px system-ui, sans-serif';
  const lap = clamp(Math.floor(p.progress / race.track.N) + 1, 1, race.laps);
  ctx.fillText(`Lap ${p.finished ? race.laps : lap}/${race.laps}   ${fmtTime(p.finished ? p.finishTime : race.time)}`, 24, 92);

  // Standings
  if (!compact) {
    const list = race.ranking;
    hudPanel(ctx, 12, 116, 170, 12 + list.length * 18);
    ctx.font = '13px system-ui, sans-serif';
    list.forEach((c, i) => {
      const y = 133 + i * 18;
      ctx.fillStyle = c.color;
      ctx.fillRect(22, y - 9, 8, 8);
      ctx.fillStyle = c.isPlayer ? '#ffd23f' : i + 1 <= race.qualify ? '#fff' : 'rgba(255,255,255,0.55)';
      ctx.fillText(`${i + 1}. ${c.isPlayer ? 'YOU' : c.name.split(' ')[0]}${c.finished ? ' ✓' : ''}`, 36, y);
      if (i + 1 === race.qualify && i < list.length - 1) {
        ctx.strokeStyle = 'rgba(255,107,107,0.8)';
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(20, y + 5); ctx.lineTo(172, y + 5); ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  // Qualify banner
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px system-ui, sans-serif';
  const ok = p.place <= race.qualify;
  const txt = race.qualify === 1 ? 'WIN TO TAKE THE CHAMPIONSHIP' : `FINISH TOP ${race.qualify} TO ADVANCE`;
  const tw = ctx.measureText(txt).width + 24;
  ctx.fillStyle = ok ? 'rgba(40,140,60,0.75)' : 'rgba(170,40,40,0.75)';
  roundRect(ctx, W / 2 - tw / 2, 12, tw, 26, 13);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(txt, W / 2, 30);

  // Minimap
  const mm = race.track.minimap;
  const ms = compact ? 120 : 180;
  const mx = W - ms - 12, my = 12;
  hudPanel(ctx, mx, my, ms, ms);
  ctx.drawImage(mm.canvas, mx, my, ms, ms);
  const k = ms / mm.size;
  for (const c of race.cars) {
    const m = mm.map(c);
    ctx.fillStyle = c.isPlayer ? '#ffd23f' : c.color;
    ctx.beginPath();
    ctx.arc(mx + m.x * k, my + m.y * k, c.isPlayer ? 5 : 3.5, 0, TAU);
    ctx.fill();
    if (c.isPlayer) { ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  // Speed, HP, nitro
  const bx = 12, by = H - 96;
  hudPanel(ctx, bx, by, 240, 84);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  const kmh = Math.round(p.speed * 0.36);
  ctx.fillText(kmh, bx + 12, by + 40);
  const kmhW = ctx.measureText(String(kmh)).width;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('km/h', bx + 18 + kmhW, by + 40);
  const bar = (y, frac, col, label) => {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx + 12, y, 216, 10);
    ctx.fillStyle = col;
    ctx.fillRect(bx + 12, y, 216 * clamp(frac, 0, 1), 10);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(label, bx + 228, y - 2);
    ctx.textAlign = 'left';
  };
  const hpf = p.hp / p.stats.maxHp;
  bar(by + 56, hpf, hpf < 0.3 ? (Math.floor(t * 4) % 2 ? '#ff3030' : '#a01010') : '#4cd964', `HP ${Math.ceil(p.hp)}`);
  bar(by + 72, p.nitro / p.stats.nitroCap, p.nitroOn ? '#9ef' : '#2fa8ff', 'NITRO');

  // Countdown
  if (race.state === 'countdown') {
    const c = Math.ceil(race.countdown);
    if (c <= 3) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 120px system-ui, sans-serif';
      ctx.fillStyle = ['#7CFC00', '#ffd23f', '#ff9f1c', '#ff4040'][c];
      ctx.globalAlpha = 0.5 + 0.5 * (race.countdown % 1);
      ctx.fillText(c, W / 2, H / 2 - 40);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'center';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Hit the gas right on GO for a perfect launch', W / 2, H / 2 + 10);
  }

  // Messages
  ctx.textAlign = 'center';
  let my2 = H * 0.3;
  for (const m of race.messages) {
    const a = clamp(Math.min(m.t * 6, (m.life - m.t) * 3), 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `bold ${m.big ? 48 : 24}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(m.text, W / 2 + 2, my2 + 2);
    ctx.fillStyle = m.color;
    ctx.fillText(m.text, W / 2, my2);
    my2 += m.big ? 56 : 32;
  }
  ctx.globalAlpha = 1;

  if (wrongWay && Math.floor(t * 3) % 2) {
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillStyle = '#ff4040';
    ctx.fillText('WRONG WAY', W / 2, H * 0.62);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('Press R to reset', W / 2, H * 0.62 + 26);
  }
}

window.addEventListener('load', () => Game.init());
