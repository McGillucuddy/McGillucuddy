// ============================================================
//  ELDRITCH BASTION — game logic (no DOM here)
// ============================================================
'use strict';

// ---------------- Save / meta progression ----------------
const SAVE_KEY = 'eldritchBastion_v1';
const Save = {
  data: null,
  defaults() {
    return { stars: {}, research: {}, spent: 0, seen: {}, cleared: {}, settings: { sound: true, autoWave: false } };
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { d = null; }
    this.data = Object.assign(this.defaults(), d || {});
    this.data.settings = Object.assign(this.defaults().settings, this.data.settings || {});
    return this.data;
  },
  write() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
  reset() { this.data = this.defaults(); this.write(); },
  starKey(mapIdx, mode) { return MAPS[mapIdx].id + ':' + mode; },
  getStars(mapIdx, mode) { return this.data.stars[this.starKey(mapIdx, mode)] || 0; },
  totalStars() { return Object.values(this.data.stars).reduce((a, b) => a + b, 0); },
  available() { return this.totalStars() - this.data.spent; },
  rank(id) { return this.data.research[id] || 0; },
  isCleared(mapIdx) { return !!this.data.cleared[MAPS[mapIdx].id]; },
  mapUnlocked(mapIdx) { return mapIdx === 0 || this.isCleared(mapIdx - 1); },
  towerUnlocked(id) {
    const u = TOWERS[id].unlock;
    if (!u) return true;
    if (u.map !== undefined) return this.isCleared(u.map);
    if (u.research) return this.rank(u.research) > 0;
    return true;
  },
  spellUnlocked(id) { const r = SPELLS[id].research; return !r || this.rank(r) > 0; },
  buyResearch(id) {
    const r = RESEARCH.find(x => x.id === id);
    const rank = this.rank(id);
    if (rank >= r.cost.length) return false;
    const c = r.cost[rank];
    if (this.available() < c) return false;
    this.data.research[id] = rank + 1;
    this.data.spent += c;
    this.write();
    return true;
  },
  refundResearch() { this.data.research = {}; this.data.spent = 0; this.write(); },
};

// ---------------- helpers ----------------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

class Path {
  constructor(waypoints) {
    this.pts = waypoints.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }));
    this.lens = [];
    this.total = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const l = Math.hypot(this.pts[i + 1].x - this.pts[i].x, this.pts[i + 1].y - this.pts[i].y);
      this.lens.push(l); this.total += l;
    }
  }
  posAt(d) {
    if (d <= 0) return { x: this.pts[0].x, y: this.pts[0].y, a: Math.atan2(this.pts[1].y - this.pts[0].y, this.pts[1].x - this.pts[0].x) };
    for (let i = 0; i < this.lens.length; i++) {
      if (d <= this.lens[i] || i === this.lens.length - 1) {
        const t = Math.min(1, d / this.lens[i]);
        const a = this.pts[i], b = this.pts[i + 1];
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: Math.atan2(b.y - a.y, b.x - a.x) };
      }
      d -= this.lens[i];
    }
  }
}

// ---------------- wave generation ----------------
function waveHpMul(w) { return 1 + 0.10 * (w - 1) + 0.007 * (w - 1) * (w - 1); }

function buildWave(map, w, nPaths) {
  const rng = mulberry32(map.seed * 1000 + w * 7);
  const spawns = [];
  let t = 0;
  const pickPath = () => Math.floor(rng() * nPaths);
  const isBoss = w === map.waves;
  const isMid = !isBoss && map.mid && w % map.mid.every === 0;

  if (isBoss) {
    // escorts first, then the boss, then a trailing horde
    for (let i = 0; i < 10 + w; i++) { spawns.push({ type: rng() < 0.5 ? 'cultist' : 'deepone', t, path: pickPath() }); t += 0.45; }
    t += 2;
    spawns.push({ type: map.boss, t, path: 0, boss: true });
    t += 3;
    const avail = map.pool.filter(p => p.from <= w);
    for (let i = 0; i < 14; i++) { spawns.push({ type: avail[Math.floor(rng() * avail.length)].t, t, path: pickPath() }); t += 0.7; }
    return spawns;
  }

  let budget = 6 + 2.2 * w + 0.12 * w * w;
  if (isMid) {
    const type = (map.mid.late && w >= map.mid.lateFrom) ? map.mid.late : map.mid.type;
    spawns.push({ type, t: 0, path: pickPath(), elite: true });
    budget -= ENEMIES[type].threat * 0.6;
    t = 2.5;
  }
  const avail = map.pool.filter(p => p.from <= w);
  // weight newly introduced types a bit higher for a "this is new!" feel
  const weights = avail.map(p => p.w * (w - p.from < 2 ? 1.6 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (budget > 0.5 && guard++ < 200) {
    let r = rng() * wsum, idx = 0;
    while (r > weights[idx]) { r -= weights[idx]; idx++; }
    const type = avail[Math.min(idx, avail.length - 1)].t;
    const def = ENEMIES[type];
    const count = clamp(Math.round(2 + rng() * 4 + w * 0.15), 2, 10);
    const path = pickPath();
    const gap = def.speed > 1.6 ? 0.45 : def.threat >= 3 ? 1.0 : 0.65;
    for (let i = 0; i < count && budget > 0; i++) {
      spawns.push({ type, t, path });
      t += gap;
      budget -= def.threat;
    }
    t += 1.2 + rng() * 1.2;
  }
  return spawns;
}

// ---------------- Game ----------------
let _uid = 1;
class Game {
  constructor(mapIdx, mode) {
    this.mapIdx = mapIdx;
    this.map = MAPS[mapIdx];
    this.mode = mode; // 'normal' | 'nightmare'
    this.diff = mode === 'nightmare' ? { hp: 1.7, speed: 1.1, gold: 0.85 } : { hp: 1, speed: 1, gold: 1 };
    const R = id => Save.rank(id);
    this.mods = {
      ballistics: 1 + 0.1 * R('ballistics'),
      lore: 1 + 0.1 * R('lore'),
      wardSlow: 0.05 * R('wards'),
      wardRange: 1 + 0.1 * R('wards'),
      spellCd: 1 - 0.15 * R('rituals'),
      bounty: (1 + 0.1 * R('bounty')) * this.diff.gold,
      refund: R('salvage') ? 0.85 : 0.7,
    };
    this.maxSanity = 20 + 5 * R('sanity');
    this.sanity = this.maxSanity;
    this.gold = Math.round((250 + this.map.startGold + 40 * R('gold')) * (mode === 'nightmare' ? 0.9 : 1));

    this.paths = this.map.paths.map(p => new Path(p));
    this.flyPaths = this.map.paths.map(p => new Path([p[0], p[p.length - 1]]));
    this.buildGrid();

    this.wave = 0;               // number of waves called so far
    this.totalWaves = this.map.waves;
    this.queue = [];             // pending spawns {time, type, path, ...}
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.effects = [];
    this.floaters = [];
    this.time = 0;
    this.waveTimer = 0;          // seconds since game time began a wave
    this.spellCd = { elder: 0, cthugha: 0, powder: 0 };
    this.powderTime = 0;
    this.shake = 0;
    this.flash = 0;
    this.over = null;            // 'win' | 'lose'
    this.stats = { kills: 0, leaked: 0, goldEarned: 0, built: 0 };
    this.events = [];            // sound / ui events consumed by UI
    this.waveCache = {};
    this.bossAlive = null;
  }

  buildGrid() {
    this.grid = [];
    for (let r = 0; r < ROWS; r++) { this.grid.push(new Array(COLS).fill(0)); }
    // path tiles
    for (const wp of this.map.paths) {
      for (let i = 0; i < wp.length - 1; i++) {
        let [c, r] = wp[i]; const [c2, r2] = wp[i + 1];
        const dc = Math.sign(c2 - c), dr = Math.sign(r2 - r);
        while (true) {
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) this.grid[r][c] = 1;
          if (c === c2 && r === r2) break;
          c += dc; r += dr;
        }
      }
    }
    for (const [x, y, w, h] of this.map.water) {
      for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) if (this.grid[r] && this.grid[r][c] === 0) this.grid[r][c] = 2;
    }
    // decorative obstacles (deterministic)
    const rng = mulberry32(this.map.seed);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (this.grid[r][c] === 0 && rng() < 0.07) this.grid[r][c] = 3;
    }
    this.towerAt = [];
    for (let r = 0; r < ROWS; r++) this.towerAt.push(new Array(COLS).fill(null));
  }

  emit(type, data) { this.events.push({ type, data }); }

  // ---------- waves ----------
  getWave(w) {
    if (!this.waveCache[w]) this.waveCache[w] = buildWave(this.map, w, this.paths.length);
    return this.waveCache[w];
  }
  canCallWave() { return !this.over && this.wave < this.totalWaves && this.queue.length === 0; }
  callWave() {
    if (!this.canCallWave()) return false;
    const early = this.enemies.length > 0 && this.wave > 0;
    this.wave++;
    const spawns = this.getWave(this.wave);
    for (const s of spawns) this.queue.push(Object.assign({}, s, { at: this.time + s.t + 0.5 }));
    // wave tithe + shop income
    let income = 25 + 5 * this.wave;
    if (early) income += 10 + 2 * this.wave;
    for (const t of this.towers) if (t.def.kind === 'income') {
      income += t.stats.income;
      this.floater(t.x, t.y - 20, '+' + t.stats.income, '#ffd76a');
    }
    this.addGold(income, false);
    this.emit('wave', { wave: this.wave, early, income, boss: spawns.some(s => s.boss) });
    if (spawns.some(s => s.boss)) { this.flash = 1; this.shake = 8; }
    return true;
  }

  addGold(n, count = true) { this.gold += Math.round(n); if (count) this.stats.goldEarned += Math.round(n); }

  spawnEnemy(type, pathIdx, opts = {}) {
    const def = ENEMIES[type];
    const hpMul = def.boss ? 1 : waveHpMul(this.wave) * this.map.hpScale;
    const hp = def.hp * hpMul * this.diff.hp * (opts.elite ? 1.0 : 1);
    const path = def.flying ? this.flyPaths[pathIdx] : this.paths[pathIdx];
    const e = {
      id: _uid++, type, def, hp, maxHp: hp, armor: def.armor, pathIdx, path,
      dist: opts.dist || 0, x: 0, y: 0, angle: 0, slow: 1, stun: 0, phased: false, revealed: false,
      phaseT: Math.random() * 3, blinkT: 2 + Math.random() * 2, summonT: def.summon ? def.summon.every : 0,
      bob: Math.random() * 10, hitFlash: 0, burn: 0, alive: true,
    };
    const p = path.posAt(e.dist); e.x = p.x; e.y = p.y; e.angle = p.a;
    this.enemies.push(e);
    if (!Save.data.seen[type]) { Save.data.seen[type] = 1; Save.write(); this.emit('newEnemy', type); }
    if (def.boss) { this.bossAlive = e; this.emit('boss', type); }
    return e;
  }

  // ---------- towers ----------
  towerCost(id) { return TOWERS[id].cost; }
  canPlace(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS && this.grid[r][c] === 0 && !this.towerAt[r][c]; }
  place(id, c, r) {
    const def = TOWERS[id];
    if (!this.canPlace(c, r) || this.gold < def.cost || !Save.towerUnlocked(id)) return null;
    this.gold -= def.cost;
    const t = {
      id: _uid++, type: id, def, c, r, x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
      level: 0, cd: 0.2, angle: -Math.PI / 2, targeting: 'first', spent: def.cost, kills: 0, dmg: 0,
      beamTarget: null, beamTime: 0, maddened: false, anim: 0,
    };
    t.stats = this.computeStats(t);
    this.towers.push(t);
    this.towerAt[r][c] = t;
    this.stats.built++;
    this.emit('build', id);
    this.effects.push({ kind: 'ring', x: t.x, y: t.y, r: 4, max: 28, life: 0.4, t: 0, color: '#d9c88a' });
    return t;
  }
  computeStats(t, level = t.level) {
    const s = {};
    for (let i = 0; i <= level; i++) Object.assign(s, t.def.levels[i]);
    delete s.cost;
    const m = this.mods;
    if (t.type === 'rifle' || t.type === 'mortar') s.dmg *= m.ballistics;
    if (t.type === 'tesla' || t.type === 'scholar') s.dmg *= m.lore;
    if (t.type === 'lighthouse') s.dps *= m.lore;
    if (t.type === 'ward') { s.slow = Math.min(0.75, s.slow + m.wardSlow); s.range *= m.wardRange; s.pulse *= m.lore; }
    return s;
  }
  upgradeCost(t) { const n = t.def.levels[t.level + 1]; return n ? n.cost : null; }
  upgrade(t) {
    const c = this.upgradeCost(t);
    if (c === null || this.gold < c) return false;
    this.gold -= c; t.spent += c; t.level++;
    t.stats = this.computeStats(t);
    this.emit('upgrade', t.type);
    this.effects.push({ kind: 'ring', x: t.x, y: t.y, r: 6, max: 36, life: 0.5, t: 0, color: '#ffe08a' });
    return true;
  }
  sellValue(t) { return Math.floor(t.spent * this.mods.refund); }
  sell(t) {
    this.addGold(this.sellValue(t), false);
    this.towers = this.towers.filter(x => x !== t);
    this.towerAt[t.r][t.c] = null;
    this.floater(t.x, t.y, '+' + this.sellValue(t), '#ffd76a');
    this.emit('sell');
  }

  // ---------- spells ----------
  spellReady(id) { return this.spellCd[id] <= 0 && Save.spellUnlocked(id) && !this.over; }
  castSpell(id, x, y) {
    if (!this.spellReady(id)) return false;
    const sp = SPELLS[id];
    this.spellCd[id] = sp.cd * this.mods.spellCd;
    if (id === 'elder') {
      for (const e of this.enemies) e.stun = Math.max(e.stun, e.def.boss ? 1 : 3);
      this.effects.push({ kind: 'elder', x: W / 2, y: H / 2, life: 1.2, t: 0 });
      this.flash = 0.6;
    } else if (id === 'cthugha') {
      const rad = sp.radius * TILE;
      const dmg = 160 + 40 * this.wave;
      for (const e of this.enemies) if (dist2(e.x, e.y, x, y) < rad * rad) { this.damage(e, dmg, 'arcane', null); e.burn = 3; }
      this.effects.push({ kind: 'fire', x, y, r: rad, life: 1.0, t: 0 });
      this.shake = 6;
    } else if (id === 'powder') {
      this.powderTime = 10;
      this.effects.push({ kind: 'powder', x: W / 2, y: H / 2, life: 1.0, t: 0 });
    }
    this.emit('spell', id);
    return true;
  }

  // ---------- combat ----------
  targetable(e, t) {
    if (!e.alive) return false;
    if (e.def.flying ? !t.def.air : !t.def.ground) return false;
    if (e.phased && !e.revealed) return false;
    return true;
  }
  remaining(e) { return e.path.total - e.dist; }
  findTargets(t, range) {
    const r2 = range * range;
    const out = [];
    for (const e of this.enemies) if (this.targetable(e, t) && dist2(e.x, e.y, t.x, t.y) <= r2) out.push(e);
    return out;
  }
  pickTarget(t, range) {
    const c = this.findTargets(t, range);
    if (!c.length) return null;
    switch (t.targeting) {
      case 'last': return c.reduce((a, b) => this.remaining(a) > this.remaining(b) ? a : b);
      case 'strong': return c.reduce((a, b) => a.hp > b.hp ? a : b);
      case 'close': return c.reduce((a, b) => dist2(a.x, a.y, t.x, t.y) < dist2(b.x, b.y, t.x, t.y) ? a : b);
      default: return c.reduce((a, b) => this.remaining(a) < this.remaining(b) ? a : b);
    }
  }
  damage(e, amount, kind, tower) {
    if (!e.alive) return 0;
    let armor = e.armor * (this.powderTime > 0 ? 0.5 : 1);
    let d = amount;
    if (kind === 'phys') d = Math.max(amount * 0.2, amount - armor);
    e.hp -= d; e.hitFlash = 0.08;
    if (tower) tower.dmg += d;
    if (e.hp <= 0) this.kill(e, tower);
    return d;
  }
  kill(e, tower) {
    e.alive = false;
    this.stats.kills++;
    if (tower) tower.kills++;
    const g = Math.round(e.def.gold * this.mods.bounty);
    if (g > 0) { this.addGold(g); this.floater(e.x, e.y - 10, '+' + g, '#ffd76a'); }
    this.effects.push({ kind: 'death', x: e.x, y: e.y, r: e.def.size, life: 0.6, t: 0, flying: !!e.def.flying, big: !!e.def.boss });
    if (e.def.split) {
      for (let i = 0; i < e.def.split.n; i++) {
        const c = this.spawnEnemy(e.def.split.type, e.pathIdx, { dist: Math.max(0, e.dist - i * 14) });
        c.maxHp = c.hp = ENEMIES[e.def.split.type].hp * waveHpMul(this.wave) * this.map.hpScale * this.diff.hp;
      }
    }
    if (e.def.boss) { this.bossAlive = null; this.shake = 14; this.flash = 1; this.emit('bossDown', e.type); }
    this.emit('kill', e.type);
  }
  floater(x, y, text, color) { this.floaters.push({ x, y, text, color, t: 0, life: 1.0 }); }

  // ---------- main update ----------
  update(dt) {
    if (this.over) { this.updateFx(dt); return; }
    this.time += dt;
    for (const k in this.spellCd) this.spellCd[k] = Math.max(0, this.spellCd[k] - dt);
    if (this.powderTime > 0) this.powderTime -= dt;

    // spawn
    if (this.queue.length) {
      const due = this.queue.filter(s => s.at <= this.time);
      if (due.length) {
        this.queue = this.queue.filter(s => s.at > this.time);
        for (const s of due) this.spawnEnemy(s.type, s.path, { elite: s.elite });
      }
    }

    // reset per-frame status
    for (const t of this.towers) t.maddened = false;
    for (const e of this.enemies) { e.slow = 1; e.revealed = this.powderTime > 0; }

    // auras from towers (slow, reveal, pulse)
    for (const t of this.towers) {
      if (t.def.reveal) {
        const rr = (t.stats.range) * TILE; const r2 = rr * rr;
        for (const e of this.enemies) if (dist2(e.x, e.y, t.x, t.y) <= r2) e.revealed = true;
      }
      if (t.def.kind === 'aura') {
        const rr = t.stats.range * TILE; const r2 = rr * rr;
        let any = false;
        for (const e of this.enemies) if (dist2(e.x, e.y, t.x, t.y) <= r2) {
          const s = e.def.boss ? t.stats.slow * 0.5 : t.stats.slow;
          e.slow = Math.min(e.slow, 1 - s);
          if (t.stats.pulse) this.damage(e, t.stats.pulse * dt, 'arcane', t);
          any = true;
        }
        t.anim += dt * (any ? 3 : 1);
      }
    }
    // madness auras from enemies
    for (const e of this.enemies) if (e.def.aura && e.alive) {
      const rr = e.def.aura * TILE; const r2 = rr * rr;
      for (const t of this.towers) if (dist2(e.x, e.y, t.x, t.y) <= r2) t.maddened = true;
    }

    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);

    this.enemies = this.enemies.filter(e => e.alive);

    // win / lose
    if (this.sanity <= 0) { this.sanity = 0; this.end('lose'); }
    else if (this.wave >= this.totalWaves && !this.queue.length && !this.enemies.length) this.end('win');
  }

  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = e.def;
      e.bob += dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (d.regen) e.hp = Math.min(e.maxHp, e.hp + d.regen * this.diff.hp * dt);
      if (e.burn > 0) { e.burn -= dt; this.damage(e, 12 * dt * (1 + this.wave * 0.1), 'arcane', null); if (!e.alive) continue; }
      if (d.phase) {
        e.phaseT += dt;
        const cyc = e.phaseT % 4.5;
        e.phased = cyc > 2.5;
      }
      if (e.stun > 0) { e.stun -= dt; continue; }
      let sp = d.speed * this.diff.speed * e.slow * TILE;
      e.dist += sp * dt;
      if (d.blink) {
        e.blinkT -= dt;
        if (e.blinkT <= 0) {
          e.blinkT = d.boss ? 4 : 3 + Math.random();
          const from = { x: e.x, y: e.y };
          e.dist += TILE * (d.boss ? 2.2 : 1.6) * e.slow;
          this.effects.push({ kind: 'blink', x: from.x, y: from.y, life: 0.5, t: 0 });
        }
      }
      if (d.summon) {
        e.summonT -= dt;
        if (e.summonT <= 0) {
          e.summonT = d.summon.every;
          const pi = ENEMIES[d.summon.type].flying ? e.pathIdx : e.pathIdx;
          const back = d.flying ? 0 : Math.max(0, e.dist - 20);
          const s = this.spawnEnemy(d.summon.type, pi, { dist: ENEMIES[d.summon.type].flying ? 0 : back });
          if (ENEMIES[d.summon.type].flying && d.flying) { s.dist = e.dist; }
          this.effects.push({ kind: 'summon', x: e.x, y: e.y, life: 0.6, t: 0 });
        }
      }
      if (e.dist >= e.path.total) {
        e.alive = false;
        const leak = Math.min(this.sanity, d.leak);
        this.sanity -= leak;
        this.stats.leaked++;
        this.shake = Math.max(this.shake, d.boss ? 16 : 5);
        this.emit('leak', { type: e.type, leak });
        if (d.boss) this.bossAlive = null;
        continue;
      }
      const p = e.path.posAt(e.dist);
      e.x = p.x; e.y = p.y; e.angle = p.a;
    }
  }

  updateTowers(dt) {
    for (const t of this.towers) {
      const s = t.stats;
      const rateMul = t.maddened ? 0.5 : 1;
      t.cd -= dt * rateMul;
      const range = s.range * TILE;
      switch (t.def.kind) {
        case 'bullet': {
          if (t.cd > 0) break;
          const e = this.pickTarget(t, range); if (!e) break;
          t.angle = Math.atan2(e.y - t.y, e.x - t.x);
          let dmg = s.dmg; let crit = false;
          if (s.crit && Math.random() < s.crit) { dmg *= 3; crit = true; }
          this.damage(e, dmg, 'phys', t);
          this.effects.push({ kind: 'tracer', x: t.x + Math.cos(t.angle) * 14, y: t.y + Math.sin(t.angle) * 14, x2: e.x, y2: e.y, life: 0.09, t: 0, crit });
          if (crit) this.floater(e.x, e.y - 16, 'CRIT', '#ffeeaa');
          t.cd = 1 / s.rate; this.emit('shot', 'rifle');
          break;
        }
        case 'mortar': {
          if (t.cd > 0) break;
          const e = this.pickTarget(t, range); if (!e) break;
          t.angle = Math.atan2(e.y - t.y, e.x - t.x);
          // lead the target a little
          const flight = 0.9;
          const lead = e.path.posAt(e.dist + e.def.speed * e.slow * TILE * flight * (e.stun > 0 ? 0 : 1));
          this.projectiles.push({ kind: 'shell', x0: t.x, y0: t.y, x1: lead.x, y1: lead.y, t: 0, dur: flight, dmg: s.dmg, splash: s.splash * TILE, tower: t });
          t.cd = 1 / s.rate; this.emit('shot', 'mortar');
          break;
        }
        case 'chain': {
          if (t.cd > 0) break;
          const first = this.pickTarget(t, range); if (!first) break;
          const hit = [first]; let cur = first;
          const hopR = 2.0 * TILE;
          while (hit.length < s.chains) {
            let best = null, bd = hopR * hopR;
            for (const e of this.enemies) {
              if (!this.targetable(e, t) || hit.includes(e)) continue;
              const d = dist2(e.x, e.y, cur.x, cur.y);
              if (d < bd) { bd = d; best = e; }
            }
            if (!best) break;
            hit.push(best); cur = best;
          }
          const pts = [{ x: t.x, y: t.y - 16 }];
          hit.forEach((e, i) => {
            pts.push({ x: e.x, y: e.y });
            this.damage(e, s.dmg * Math.pow(0.88, i), 'phys', t);
            if (s.stun && Math.random() < s.stun) e.stun = Math.max(e.stun, 0.6);
          });
          this.effects.push({ kind: 'lightning', pts, life: 0.18, t: 0 });
          t.cd = 1 / s.rate; this.emit('shot', 'tesla');
          break;
        }
        case 'arcane': {
          if (t.cd > 0) break;
          const e = this.pickTarget(t, range); if (!e) break;
          t.angle = Math.atan2(e.y - t.y, e.x - t.x);
          this.projectiles.push({ kind: 'bolt', x: t.x, y: t.y - 14, target: e, speed: 9 * TILE, dmg: s.dmg, tower: t, trail: [] });
          t.cd = 1 / s.rate; this.emit('shot', 'scholar');
          break;
        }
        case 'beam': {
          let e = t.beamTarget;
          if (!e || !e.alive || !this.targetable(e, t) || dist2(e.x, e.y, t.x, t.y) > range * range) {
            e = this.pickTarget(t, range);
            if (e !== t.beamTarget) t.beamTime = 0;
            t.beamTarget = e;
          }
          if (!e) { t.beamTime = 0; break; }
          t.beamTime += dt;
          t.angle = Math.atan2(e.y - t.y, e.x - t.x);
          const ramp = 1 + (s.ramp - 1) * Math.min(1, t.beamTime / 3);
          const armor = e.armor * (this.powderTime > 0 ? 0.5 : 1);
          const dps = Math.max(s.dps * ramp * 0.3, s.dps * ramp - armor * 4) * rateMul;
          this.damage(e, dps * dt, 'arcane', t);
          break;
        }
      }
    }
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.kind === 'shell') {
        p.t += dt;
        if (p.t >= p.dur) {
          p.dead = true;
          const r2 = p.splash * p.splash;
          for (const e of this.enemies) if (e.alive && !e.def.flying && (!e.phased || e.revealed) && dist2(e.x, e.y, p.x1, p.y1) <= r2) this.damage(e, p.dmg, 'phys', p.tower);
          this.effects.push({ kind: 'boom', x: p.x1, y: p.y1, r: p.splash, life: 0.45, t: 0 });
          this.emit('boom');
        }
      } else if (p.kind === 'bolt') {
        const e = p.target;
        const tx = e.alive ? e.x : p.lx, ty = e.alive ? e.y : p.ly;
        p.lx = tx; p.ly = ty;
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        const step = p.speed * dt;
        p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 8) p.trail.shift();
        if (d <= step + 4) {
          p.dead = true;
          if (e.alive) this.damage(e, p.dmg, 'arcane', p.tower);
          this.effects.push({ kind: 'spark', x: tx, y: ty, life: 0.3, t: 0, color: '#c58cff' });
        } else { p.x += dx / d * step; p.y += dy / d * step; }
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  updateFx(dt) {
    for (const f of this.effects) f.t += dt;
    this.effects = this.effects.filter(f => f.t < f.life);
    for (const f of this.floaters) { f.t += dt; f.y -= 22 * dt; }
    this.floaters = this.floaters.filter(f => f.t < f.life);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 1.5);
  }

  end(result) {
    if (this.over) return;
    this.over = result;
    let stars = 0;
    if (result === 'win') {
      const pct = this.sanity / this.maxSanity;
      stars = pct >= 0.9 ? 3 : pct >= 0.5 ? 2 : 1;
      const prev = Save.getStars(this.mapIdx, this.mode);
      this.newStars = Math.max(0, stars - prev);
      if (stars > prev) Save.data.stars[Save.starKey(this.mapIdx, this.mode)] = stars;
      this.firstClear = !Save.isCleared(this.mapIdx);
      Save.data.cleared[this.map.id] = true;
      Save.write();
    }
    this.starsEarned = stars;
    this.emit('end', result);
  }
}
