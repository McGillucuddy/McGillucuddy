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


// ---------------- tiny binary heap for Dijkstra ----------------
class Heap {
  constructor() { this.a = []; }
  push(k, v) {
    const a = this.a; a.push([k, v]); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}
const DIRS8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

// ---------------- wave generation ----------------
function waveHpMul(w) { return 1 + 0.10 * (w - 1) + 0.007 * (w - 1) * (w - 1); }
function activeSpawns(map, w) { const out = []; map.spawns.forEach((s, i) => { if ((s.from || 1) <= w) out.push(i); }); return out; }

function buildWave(map, w) {
  const rng = mulberry32(map.seed * 1000 + w * 7);
  const act = activeSpawns(map, w);
  const pick = () => act[Math.floor(rng() * act.length)];
  const spawns = [];
  let t = 0;
  const isBoss = w === map.waves;
  const isMid = !isBoss && map.mid && w % map.mid.every === 0;
  const avail = map.pool.filter(p => p.from <= w);

  if (isBoss) {
    for (let i = 0; i < 10 + w; i++) { spawns.push({ type: rng() < 0.5 ? 'cultist' : 'deepone', t, spawn: pick() }); t += 0.45; }
    t += 2;
    spawns.push({ type: map.boss, t, spawn: pick(), boss: true });
    t += 3;
    for (let i = 0; i < 14; i++) { spawns.push({ type: avail[Math.floor(rng() * avail.length)].t, t, spawn: pick() }); t += 0.7; }
    return spawns;
  }
  let budget = 6 + 2.2 * w + 0.12 * w * w;
  if (isMid) {
    const type = (map.mid.late && w >= map.mid.lateFrom) ? map.mid.late : map.mid.type;
    spawns.push({ type, t: 0, spawn: pick() });
    budget -= ENEMIES[type].threat * 0.6;
    t = 2.5;
  }
  const weights = avail.map(p => p.w * (w - p.from < 2 ? 1.6 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (budget > 0.5 && guard++ < 200) {
    let r = rng() * wsum, idx = 0;
    while (r > weights[idx]) { r -= weights[idx]; idx++; }
    const type = avail[Math.min(idx, avail.length - 1)].t;
    const def = ENEMIES[type];
    const count = clamp(Math.round(2 + rng() * 4 + w * 0.15), 2, 10);
    const sp = pick();
    const gap = def.speed > 1.2 ? 0.35 : def.threat >= 3 ? 0.8 : 0.45;
    for (let i = 0; i < count && budget > 0; i++) { spawns.push({ type, t, spawn: sp }); t += gap; budget -= def.threat; }
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
    this.mode = mode;
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
    this.maxSanity = 100 + 10 * R('sanity');
    this.sanity = this.maxSanity;
    this.gold = Math.round((300 + this.map.startGold + 40 * R('gold')) * (mode === 'nightmare' ? 0.9 : 1));

    const [cc, cr, cw, ch] = this.map.city;
    this.city = { c: cc, r: cr, cw, ch, x: cc * TILE, y: cr * TILE, w: cw * TILE, h: ch * TILE };
    this.city.cx = this.city.x + this.city.w / 2; this.city.cy = this.city.y + this.city.h / 2;

    this.buildGrid();
    this.towerVersion = 0;
    this.placeCache = {};
    this.recomputeFlow();
    this.buildEntries();

    this.wave = 0;
    this.totalWaves = this.map.waves;
    this.queue = [];
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.effects = [];
    this.floaters = [];
    this.stains = [];            // new ichor stains for the renderer to bake
    this.time = 0;
    this.spellCd = { elder: 0, cthugha: 0, powder: 0 };
    this.powderTime = 0;
    this.shake = 0;
    this.flash = 0;
    this.over = null;
    this.stats = { kills: 0, breaches: 0, goldEarned: 0, built: 0 };
    this.events = [];
    this.waveCache = {};
    this.bossAlive = null;
  }

  inCity(c, r) { const k = this.city; return c >= k.c && c < k.c + k.cw && r >= k.r && r < k.r + k.ch; }
  buildGrid() {
    this.grid = [];
    for (let r = 0; r < ROWS; r++) this.grid.push(new Array(COLS).fill(0));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.inCity(c, r)) this.grid[r][c] = 5;
    for (const [x, y, w, h] of this.map.water)
      for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) if (this.grid[r] && this.grid[r][c] === 0) this.grid[r][c] = 2;
    const rng = mulberry32(this.map.seed);
    const k = this.city;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const roll = rng();
      if (this.grid[r][c] !== 0 || r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1) continue;
      if (c >= k.c - 2 && c < k.c + k.cw + 2 && r >= k.r - 2 && r < k.r + k.ch + 2) continue;
      if (roll < this.map.rocks) this.grid[r][c] = 3;
    }
    this.towerAt = [];
    for (let r = 0; r < ROWS; r++) this.towerAt.push(new Array(COLS).fill(null));
  }

  // ---------- flow field ----------
  passable(c, r, block) {
    return c >= 0 && r >= 0 && c < COLS && r < ROWS && this.grid[r][c] === 0 && !this.towerAt[r][c] && !(block && block.c === c && block.r === r);
  }
  flowDist(block) {
    const d = new Float32Array(COLS * ROWS).fill(Infinity);
    const h = new Heap();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.grid[r][c] === 5) { d[r * COLS + c] = 0; h.push(0, r * COLS + c); }
    const ok = (c, r) => this.passable(c, r, block) || (c >= 0 && r >= 0 && c < COLS && r < ROWS && this.grid[r][c] === 5);
    while (h.size) {
      const [k, i] = h.pop();
      if (k > d[i]) continue;
      const c = i % COLS, r = (i / COLS) | 0;
      for (const [dc, dr, cost] of DIRS8) {
        const nc = c + dc, nr = r + dr;
        if (!this.passable(nc, nr, block)) continue;
        if (dc && dr && (!ok(c + dc, r) || !ok(c, r + dr))) continue;
        const nk = k + cost, ni = nr * COLS + nc;
        if (nk < d[ni]) { d[ni] = nk; h.push(nk, ni); }
      }
    }
    return d;
  }
  recomputeFlow() {
    const d = this.flowDist(null);
    this.dist = d;
    this.vec = new Float32Array(COLS * ROWS * 2);
    const ok = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && (this.grid[r][c] === 5 || (this.passable(c, r) && isFinite(d[r * COLS + c])));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (!this.passable(c, r) || !isFinite(d[i])) continue;
      let best = Infinity, bx = 0, by = 0;
      for (const [dc, dr, cost] of DIRS8) {
        const nc = c + dc, nr = r + dr;
        if (!ok(nc, nr)) continue;
        if (dc && dr && (!ok(c + dc, r) || !ok(c, r + dr))) continue;
        const v = d[nr * COLS + nc] + cost;
        if (v < best) { best = v; bx = dc; by = dr; }
      }
      const l = Math.hypot(bx, by) || 1;
      this.vec[i * 2] = bx / l; this.vec[i * 2 + 1] = by / l;
    }
  }
  buildEntries() {
    this.entries = this.map.spawns.map(sp => {
      const cells = [];
      for (let k = sp.a; k <= sp.b; k++) {
        let c, r;
        if (sp.side === 'left') { c = 0; r = k; } else if (sp.side === 'right') { c = COLS - 1; r = k; }
        else if (sp.side === 'top') { c = k; r = 0; } else { c = k; r = ROWS - 1; }
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
        if (this.grid[r][c] !== 0) continue;
        cells.push({ c, r, side: sp.side });
      }
      return cells;
    });
  }
  reachableEntries(idx) { return this.entries[idx].filter(e => isFinite(this.dist[e.r * COLS + e.c])); }

  emit(type, data) { this.events.push({ type, data }); }

  // ---------- waves ----------
  getWave(w) { if (!this.waveCache[w]) this.waveCache[w] = buildWave(this.map, w); return this.waveCache[w]; }
  nextSpawnSides() { return this.wave >= this.totalWaves ? [] : [...new Set(this.getWave(this.wave + 1).map(s => s.spawn))]; }
  canCallWave() { return !this.over && this.wave < this.totalWaves && this.queue.length === 0; }
  callWave() {
    if (!this.canCallWave()) return false;
    const early = this.enemies.length > 0 && this.wave > 0;
    this.wave++;
    const spawns = this.getWave(this.wave);
    for (const s of spawns) this.queue.push(Object.assign({}, s, { at: this.time + s.t + 0.5 }));
    let income = 30 + 6 * this.wave;
    if (early) income += 10 + 2 * this.wave;
    for (const t of this.towers) if (t.def.kind === 'income') { income += t.stats.income; this.floater(t.x, t.y - 20, '+' + t.stats.income, '#ffd76a'); }
    this.addGold(income, false);
    this.emit('wave', { wave: this.wave, early, income, boss: spawns.some(s => s.boss) });
    if (spawns.some(s => s.boss)) { this.flash = 1; this.shake = 8; }
    return true;
  }
  addGold(n, count = true) { this.gold += Math.round(n); if (count) this.stats.goldEarned += Math.round(n); }

  makeEnemy(type, x, y, opts = {}) {
    const def = ENEMIES[type];
    const hpMul = def.boss ? 1 : waveHpMul(this.wave) * this.map.hpScale;
    const hp = def.hp * hpMul * this.diff.hp * (def.boss ? 0.65 : 0.7);
    const e = {
      id: _uid++, type, def, hp, maxHp: hp, armor: def.armor, x, y, vx: 0, vy: 0, angle: 0,
      slow: 1, stun: 0, phased: false, revealed: false, sieging: false, toCity: 1e9, entry: opts.entry || null,
      phaseT: Math.random() * 3, blinkT: 2 + Math.random() * 2, summonT: def.summon ? def.summon.every : 0,
      bob: Math.random() * 10, hitFlash: 0, burn: 0, alive: true, weave: Math.random() * 6, twitch: 0,
    };
    this.enemies.push(e);
    if (!Save.data.seen[type]) { Save.data.seen[type] = 1; Save.write(); this.emit('newEnemy', type); }
    if (def.boss) { this.bossAlive = e; this.emit('boss', type); }
    return e;
  }
  spawnEnemy(type, spawnIdx) {
    let cells = this.reachableEntries(spawnIdx);
    if (!cells.length) cells = this.entries[spawnIdx];
    const cell = cells[Math.floor(Math.random() * cells.length)];
    const cx = cell.c * TILE + TILE / 2, cy = cell.r * TILE + TILE / 2;
    const j = (Math.random() - 0.5) * 24;
    let x = cx, y = cy;
    if (cell.side === 'left') { x = -16; y += j; } else if (cell.side === 'right') { x = W + 16; y += j; }
    else if (cell.side === 'top') { y = -16; x += j; } else { y = H + 16; x += j; }
    return this.makeEnemy(type, x, y, { entry: { x: cx, y: cy } });
  }

  // ---------- towers ----------
  towerCost(id) { return TOWERS[id].cost; }
  occupied(c, r) {
    const x0 = c * TILE - 6, y0 = r * TILE - 6, x1 = x0 + TILE + 12, y1 = y0 + TILE + 12;
    return this.enemies.some(e => !e.def.flying && e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1);
  }
  wouldSeal(c, r) {
    const key = c + ',' + r;
    if (this.placeCache.v !== this.towerVersion) this.placeCache = { v: this.towerVersion };
    if (this.placeCache[key] === undefined) {
      const d = this.flowDist({ c, r });
      let bad = false;
      for (let i = 0; i < this.entries.length && !bad; i++) {
        const had = this.entries[i].some(e => isFinite(this.dist[e.r * COLS + e.c]));
        if (had && !this.entries[i].some(e => isFinite(d[e.r * COLS + e.c]))) bad = true;
      }
      this.placeCache[key] = { bad, d };
    }
    if (this.placeCache[key].bad) return true;
    const d = this.placeCache[key].d;
    for (const e of this.enemies) {
      if (e.def.flying) continue;
      const ec = Math.floor(e.x / TILE), er = Math.floor(e.y / TILE);
      if (ec < 0 || er < 0 || ec >= COLS || er >= ROWS || this.grid[er][ec] !== 0) continue;
      if (!isFinite(d[er * COLS + ec]) && isFinite(this.dist[er * COLS + ec])) return true;
    }
    return false;
  }
  canPlace(c, r) {
    return c >= 0 && r >= 0 && c < COLS && r < ROWS && this.grid[r][c] === 0 && !this.towerAt[r][c] && !this.occupied(c, r) && !this.wouldSeal(c, r);
  }
  placeProblem(c, r) {
    if (!(c >= 0 && r >= 0 && c < COLS && r < ROWS) || this.grid[r][c] !== 0 || this.towerAt[r][c]) return 'Cannot build there.';
    if (this.occupied(c, r)) return 'Something is standing there.';
    if (this.wouldSeal(c, r)) return 'That would wall them out entirely — they would tear through. Leave a way in.';
    return null;
  }
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
    this.towerVersion++;
    this.recomputeFlow();
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
    this.towerVersion++;
    this.recomputeFlow();
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
      this.effects.push({ kind: 'elder', x: this.city.cx, y: this.city.cy, life: 1.2, t: 0 });
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
    if (e.x < -4 || e.y < -4 || e.x > W + 4 || e.y > H + 4) return false;
    return true;
  }
  remaining(e) { return e.toCity; }
  findTargets(t, range) {
    const r2 = range * range, out = [];
    for (const e of this.enemies) if (this.targetable(e, t) && dist2(e.x, e.y, t.x, t.y) <= r2) out.push(e);
    return out;
  }
  pickTarget(t, range) {
    const c = this.findTargets(t, range);
    if (!c.length) return null;
    switch (t.targeting) {
      case 'last': return c.reduce((a, b) => a.toCity > b.toCity ? a : b);
      case 'strong': return c.reduce((a, b) => a.hp > b.hp ? a : b);
      case 'close': return c.reduce((a, b) => dist2(a.x, a.y, t.x, t.y) < dist2(b.x, b.y, t.x, t.y) ? a : b);
      default: return c.reduce((a, b) => a.toCity < b.toCity ? a : b);
    }
  }
  damage(e, amount, kind, tower) {
    if (!e.alive) return 0;
    const armor = e.armor * (this.powderTime > 0 ? 0.5 : 1);
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
    this.effects.push({ kind: 'death', x: e.x, y: e.y, r: e.def.size, life: 0.7, t: 0, big: !!e.def.boss, type: e.type });
    this.stains.push({ x: e.x, y: e.y, r: e.def.size, type: e.type, flying: !!e.def.flying });
    if (e.def.split) {
      for (let i = 0; i < e.def.split.n; i++) {
        const a = i / e.def.split.n * Math.PI * 2;
        this.makeEnemy(e.def.split.type, e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10);
      }
    }
    if (e.def.boss) { this.bossAlive = null; this.shake = 14; this.flash = 1; this.emit('bossDown', e.type); }
    this.emit('kill', e.type);
  }
  floater(x, y, text, color) { this.floaters.push({ x, y, text, color, t: 0, life: 1.0 }); }

  // ---------- movement ----------
  cityGap(x, y) {
    const k = this.city;
    const dx = Math.max(k.x - x, 0, x - (k.x + k.w)), dy = Math.max(k.y - y, 0, y - (k.y + k.h));
    return Math.hypot(dx, dy);
  }
  blockedAt(x, y) {
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
    return !this.passable(c, r);
  }
  blocked(x, y) {
    const m = 7;
    return this.blockedAt(x, y) || this.blockedAt(x - m, y - m) || this.blockedAt(x + m, y - m) || this.blockedAt(x - m, y + m) || this.blockedAt(x + m, y + m);
  }
  sampleFlow(x, y) {
    const fx = x / TILE - 0.5, fy = y / TILE - 0.5;
    const c0 = Math.floor(fx), r0 = Math.floor(fy), tx = fx - c0, ty = fy - r0;
    let vx = 0, vy = 0, wsum = 0;
    for (let k = 0; k < 4; k++) {
      const c = c0 + (k & 1), r = r0 + (k >> 1);
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
      const i = r * COLS + c;
      if (!this.passable(c, r) || !isFinite(this.dist[i])) continue;
      const w = ((k & 1) ? tx : 1 - tx) * ((k >> 1) ? ty : 1 - ty);
      vx += this.vec[i * 2] * w; vy += this.vec[i * 2 + 1] * w; wsum += w;
    }
    if (wsum < 1e-4) {
      const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
      if (c >= 0 && r >= 0 && c < COLS && r < ROWS) { const i = r * COLS + c; if (isFinite(this.dist[i])) return [this.vec[i * 2], this.vec[i * 2 + 1]]; }
      const dx = this.city.cx - x, dy = this.city.cy - y, l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    }
    const l = Math.hypot(vx, vy) || 1;
    return [vx / l, vy / l];
  }
  steerGround(e) {
    if (e.x < 0 || e.y < 0 || e.x >= W || e.y >= H) {
      const tx = e.entry ? e.entry.x : this.city.cx, ty = e.entry ? e.entry.y : this.city.cy;
      const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    }
    return this.sampleFlow(e.x, e.y);
  }
  moveTo(e, nx, ny) {
    if (!this.blocked(nx, ny)) { e.x = nx; e.y = ny; return true; }
    if (!this.blocked(nx, e.y)) { e.x = nx; return true; }
    if (!this.blocked(e.x, ny)) { e.y = ny; return true; }
    return false;
  }
  updateToCity(e) {
    if (e.sieging) { e.toCity = 0; return; }
    if (e.def.flying) { e.toCity = this.cityGap(e.x, e.y); return; }
    const c = Math.floor(e.x / TILE), r = Math.floor(e.y / TILE);
    if (c >= 0 && r >= 0 && c < COLS && r < ROWS && isFinite(this.dist[r * COLS + c])) e.toCity = this.dist[r * COLS + c] * TILE;
    else e.toCity = this.cityGap(e.x, e.y) + TILE;
  }

  // ---------- main update ----------
  update(dt) {
    if (this.over) { this.updateFx(dt); return; }
    this.time += dt;
    for (const k in this.spellCd) this.spellCd[k] = Math.max(0, this.spellCd[k] - dt);
    if (this.powderTime > 0) this.powderTime -= dt;

    if (this.queue.length) {
      const due = this.queue.filter(s => s.at <= this.time);
      if (due.length) {
        this.queue = this.queue.filter(s => s.at > this.time);
        for (const s of due) this.spawnEnemy(s.type, s.spawn);
      }
    }

    for (const t of this.towers) t.maddened = false;
    for (const e of this.enemies) { e.slow = 1; e.revealed = this.powderTime > 0; }

    for (const t of this.towers) {
      if (t.def.reveal) {
        const rr = t.stats.range * TILE, r2 = rr * rr;
        for (const e of this.enemies) if (dist2(e.x, e.y, t.x, t.y) <= r2) e.revealed = true;
      }
      if (t.def.kind === 'aura') {
        const rr = t.stats.range * TILE, r2 = rr * rr;
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
    for (const e of this.enemies) if (e.def.aura && e.alive) {
      const rr = e.def.aura * TILE, r2 = rr * rr;
      for (const t of this.towers) if (dist2(e.x, e.y, t.x, t.y) <= r2) t.maddened = true;
    }

    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.enemies = this.enemies.filter(e => e.alive);

    if (this.sanity <= 0) { this.sanity = 0; this.end('lose'); }
    else if (this.wave >= this.totalWaves && !this.queue.length && !this.enemies.length) this.end('win');
  }

  updateEnemies(dt) {
    // spatial buckets for separation
    const buckets = new Map();
    const key = (x, y) => (Math.floor(x / TILE) + 2) * 100 + (Math.floor(y / TILE) + 2);
    for (const e of this.enemies) { if (!e.alive || e.def.flying) continue; const k = key(e.x, e.y); let b = buckets.get(k); if (!b) buckets.set(k, b = []); b.push(e); }

    let drain = 0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = e.def;
      e.bob += dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      e.twitch = Math.random() < dt * 1.5 ? 0.12 : Math.max(0, e.twitch - dt);
      if (d.regen) e.hp = Math.min(e.maxHp, e.hp + d.regen * this.diff.hp * dt);
      if (e.burn > 0) { e.burn -= dt; this.damage(e, 12 * dt * (1 + this.wave * 0.1), 'arcane', null); if (!e.alive) continue; }
      if (d.phase) { e.phaseT += dt; e.phased = (e.phaseT % 4.5) > 2.5; }

      if (d.summon) {
        e.summonT -= dt;
        if (e.summonT <= 0 && e.x > 0 && e.y > 0 && e.x < W && e.y < H) {
          e.summonT = d.summon.every;
          const a = Math.random() * Math.PI * 2;
          this.makeEnemy(d.summon.type, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14);
          this.effects.push({ kind: 'summon', x: e.x, y: e.y, life: 0.6, t: 0 });
        }
      }

      if (e.sieging) {
        drain += d.siege * 0.6 * (e.stun > 0 ? 0 : 1);
        if (e.stun > 0) e.stun -= dt;
        this.updateToCity(e);
        continue;
      }
      if (e.stun > 0) { e.stun -= dt; e.vx *= 0.8; e.vy *= 0.8; continue; }

      const sp = d.speed * this.diff.speed * e.slow * TILE;
      let dx, dy;
      if (d.flying) {
        const tx = this.city.cx - e.x, ty = this.city.cy - e.y, l = Math.hypot(tx, ty) || 1;
        e.weave += dt * 2;
        dx = tx / l - ty / l * Math.sin(e.weave) * 0.35; dy = ty / l + tx / l * Math.sin(e.weave) * 0.35;
      } else {
        [dx, dy] = this.steerGround(e);
        // separation
        let sx = 0, sy = 0;
        const bc = Math.floor(e.x / TILE) + 2, br = Math.floor(e.y / TILE) + 2;
        for (let oc = -1; oc <= 1; oc++) for (let or = -1; or <= 1; or++) {
          const b = buckets.get((bc + oc) * 100 + br + or); if (!b) continue;
          for (const o of b) {
            if (o === e) continue;
            const ox = e.x - o.x, oy = e.y - o.y, dd = ox * ox + oy * oy;
            const min = (d.size + o.def.size) * 0.85;
            if (dd < min * min && dd > 0.01) { const l = Math.sqrt(dd); sx += ox / l * (1 - l / min); sy += oy / l * (1 - l / min); }
          }
        }
        dx += sx * 1.2; dy += sy * 1.2;
        const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      }
      const k = Math.min(1, dt * 6);
      e.vx += (dx * sp - e.vx) * k; e.vy += (dy * sp - e.vy) * k;
      if (d.flying) { e.x += e.vx * dt; e.y += e.vy * dt; }
      else {
        if (!this.moveTo(e, e.x + e.vx * dt, e.y + e.vy * dt)) { e.vx *= 0.5; e.vy *= 0.5; }
        // watchdog: if a walker makes no progress for a while, let it squeeze through
        if (e.toCity < (e.best ?? 1e9) - 4) { e.best = e.toCity; e.stuckT = 0; }
        else if ((e.stuckT = (e.stuckT || 0) + dt) > 2.5) {
          const [fx, fy] = this.sampleFlow(e.x, e.y);
          e.x += fx * sp * dt; e.y += fy * sp * dt;
          if (e.stuckT > 4) { e.best = e.toCity; e.stuckT = 0; }
        }
      }
      if (Math.abs(e.vx) + Math.abs(e.vy) > 1) e.angle = Math.atan2(e.vy, e.vx);

      if (d.blink) {
        e.blinkT -= dt;
        if (e.blinkT <= 0) {
          e.blinkT = d.boss ? 4 : 3 + Math.random();
          const fx = e.x, fy = e.y;
          const total = TILE * (d.boss ? 2.2 : 1.6) * e.slow;
          for (let i = 0; i < 12 && this.cityGap(e.x, e.y) > d.size; i++) { const [bx, by] = this.steerGround(e); this.moveTo(e, e.x + bx * total / 12, e.y + by * total / 12); }
          this.effects.push({ kind: 'blink', x: fx, y: fy, life: 0.5, t: 0 });
          this.effects.push({ kind: 'blink', x: e.x, y: e.y, life: 0.5, t: 0 });
        }
      }

      const reach = d.flying ? 4 : 10 + d.size * 0.4;
      if (this.cityGap(e.x, e.y) <= reach) {
        e.sieging = true;
        e.vx = e.vy = 0;
        e.angle = Math.atan2(this.city.cy - e.y, this.city.cx - e.x);
        this.stats.breaches++;
        this.shake = Math.max(this.shake, d.boss ? 12 : 3);
        this.emit('siege', e.type);
      }
      this.updateToCity(e);
    }
    if (drain > 0) { this.sanity -= drain * dt; this.drainRate = drain; } else this.drainRate = 0;
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
          let dmg = s.dmg, crit = false;
          if (s.crit && Math.random() < s.crit) { dmg *= 3; crit = true; }
          this.damage(e, dmg, 'phys', t);
          this.effects.push({ kind: 'tracer', x: t.x + Math.cos(t.angle) * 18, y: t.y + Math.sin(t.angle) * 18, x2: e.x, y2: e.y, life: 0.09, t: 0, crit });
          if (crit) this.floater(e.x, e.y - 16, 'CRIT', '#ffeeaa');
          t.cd = 1 / s.rate; this.emit('shot', 'rifle');
          break;
        }
        case 'mortar': {
          if (t.cd > 0) break;
          const e = this.pickTarget(t, range); if (!e) break;
          t.angle = Math.atan2(e.y - t.y, e.x - t.x);
          const flight = 0.9, mv = e.stun > 0 || e.sieging ? 0 : flight * 0.85;
          this.projectiles.push({ kind: 'shell', x0: t.x, y0: t.y, x1: e.x + e.vx * mv, y1: e.y + e.vy * mv, t: 0, dur: flight, dmg: s.dmg, splash: s.splash * TILE, tower: t });
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
          const pts = [{ x: t.x, y: t.y - 20 - t.level * 2.6 }];
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
          this.projectiles.push({ kind: 'bolt', x: t.x, y: t.y - 17 - t.level, target: e, speed: 9 * TILE, dmg: s.dmg, tower: t, trail: [] });
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
          this.stains.push({ x: p.x1, y: p.y1, r: p.splash * 0.5, type: 'scorch' });
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
