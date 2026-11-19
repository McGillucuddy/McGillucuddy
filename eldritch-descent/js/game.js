// ============================================================
//  ELDRITCH DESCENT — run + turn-based combat engine (no DOM)
// ============================================================
'use strict';

const SAVE_KEY = 'eldritchDescent_v2';
const Meta = {
  data: null,
  defaults() { return { knowledge: 0, spent: 0, rites: {}, runs: 0, wins: 0, best: 0, winsBy: {}, seen: {}, settings: { sound: true, fast: false } }; },
  load() {
    let d = null; try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { d = null; }
    this.data = Object.assign(this.defaults(), d || {});
    this.data.settings = Object.assign(this.defaults().settings, this.data.settings || {});
    return this.data;
  },
  write() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ } },
  rank(id) { return this.data.rites[id] || 0; },
  available() { return this.data.knowledge - this.data.spent; },
  buy(id) { const r = RITES.find(x => x.id === id), k = this.rank(id); if (k >= r.cost.length || this.available() < r.cost[k]) return false; this.data.rites[id] = k + 1; this.data.spent += r.cost[k]; this.write(); return true; },
  refund() { this.data.rites = {}; this.data.spent = 0; this.write(); },
};

let _uid = 1;
// global tuning knobs (enemies are built for a party of four)
const TUNE = { hp: 1.75, dmg: 1.5, bossHp: 1.55, bossDmg: 1.35, comp: 1 };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cardCost = c => { const d = CARDS[c.id]; return Array.isArray(d.cost) ? d.cost[c.up ? 1 : 0] : d.cost; };
const cardVals = c => { const d = CARDS[c.id], V = {}; for (const [k, v] of Object.entries(d.vals || {})) V[k] = Array.isArray(v) ? v[c.up ? 1 : 0] : v; return V; };
const cardName = c => CARDS[c.id].name + (c.up ? '+' : '');

class Game {
  constructor(cls, opts = {}) {
    this.cls = cls;
    this.nightmare = !!opts.nightmare;
    this.events = []; this.steps = []; this.stepT = 0;
    this.fx = []; this.floaters = [];
    this.gold = 60 + 40 * Meta.rank('gold');
    this.potions = Meta.rank('potion') ? ['heal'] : [];
    this.relics = [];
    this.floor = 0;
    this.stats = { fights: 0, elites: 0, bosses: 0, nodes: 0, dmg: 0, healed: 0, cards: 0 };
    this.seenEvents = new Set();
    this.shopRemovals = 0;
    this.heroes = CLASS_ORDER.map(c => this.makeHero(c, c === cls));
    this.player = this.heroes.find(h => h.player);
    this.deck = STARTER[cls].map(id => ({ uid: _uid++, id, up: false }));
    if (Meta.rank('upgrade')) this.upgradeRandom(Meta.rank('upgrade'));
    if (Meta.rank('relic')) this.gainRelic(this.randomRelic(), true);
    this.mode = 'map';
    this.genMap();
  }
  emit(type, data) { this.events.push({ type, data }); }
  has(r) { return this.relics.includes(r); }

  // ---------------- party ----------------
  makeHero(cls, isPlayer) {
    const c = CLASSES[cls], hp = (isPlayer ? c.hp : c.compHp) + 6 * Meta.rank('vet');
    return { uid: _uid++, team: 'hero', cls, c, player: isPlayer, name: isPlayer ? 'You' : pick(NAMES[cls]), rank: c.rank, hp, maxHp: hp, st: {}, dead: false, cds: {}, intent: null, anim: { lunge: 0, hit: 0, t: Math.random() * 10 } };
  }
  allies() { return this.heroes.filter(h => !h.dead); }
  mostWounded() { const a = this.allies(); return a.length ? a.reduce((x, y) => (x.hp / x.maxHp <= y.hp / y.maxHp ? x : y)) : null; }
  mostThreatened(exclude) { const a = this.allies().filter(h => h !== exclude); if (!a.length) return null; return a.reduce((x, y) => (this.incoming(x) - (x.st.block || 0) >= this.incoming(y) - (y.st.block || 0) ? x : y)); }
  cs(n) { return Math.round(n * TUNE.comp * (1 + 0.3 * this.floor) * (this.has('lens') ? 0.75 : 1)) + Meta.rank('comp'); }

  // ---------------- map ----------------
  // ---------------- map: Lantern & Gloam ----------------
  // Each floor is a grid of rooms joined by passages. Your lantern lights the
  // rooms around you; the Gloam swallows one column behind you every few moves.
  // The Lair waits alone on the far side.
  genMap() {
    const COLS = 7, ROWS = 5, MID = 2, rng = Math.random;
    const cells = [];
    for (let r = 0; r < ROWS; r++) { cells.push([]); for (let c = 0; c < COLS; c++) cells[r].push({ c, r, id: c + ':' + r, type: null, seen: false, visited: false }); }
    const links = new Set();
    const link = (a, b) => links.add(a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id);
    for (let c = 0; c < COLS - 1; c++) {
      // vertical passages inside the column (the last column before the lair is one long hall)
      const full = c === COLS - 2;
      for (let r = 0; r < ROWS - 1; r++) if (full || rng() < 0.5) link(cells[r][c], cells[r + 1][c]);
      // every vertical segment gets at least one way forward, so nobody is ever trapped
      if (c === COLS - 2) { link(cells[MID][c], cells[MID][c + 1]); break; }
      let seg = [];
      const flush = () => { if (!seg.length) return; const guaranteed = pick(seg); for (const n of seg) if (n === guaranteed || rng() < 0.3) link(n, cells[n.r][c + 1]); seg = []; };
      for (let r = 0; r < ROWS; r++) { seg.push(cells[r][c]); if (r === ROWS - 1 || !this.linkedIn(links, cells[r][c], cells[r + 1][c])) flush(); }
    }
    for (let r = 0; r < ROWS; r++) if (r !== MID) cells[r][COLS - 1].type = 'void';
    const start = cells[MID][0], lair = cells[MID][COLS - 1];
    start.type = 'start'; lair.type = 'boss';
    for (const n of cells.flat()) {
      if (n.type) continue;
      const w = { combat: 44, event: 18, elite: n.c >= 2 ? 12 : 0, rest: n.c >= 2 ? 6 : 0, shop: n.c >= 1 ? 5 : 0, treasure: 7, shrine: n.c >= 1 ? 6 : 0 };
      let t = rng() * Object.values(w).reduce((a, b) => a + b, 0);
      for (const [k, v] of Object.entries(w)) if ((t -= v) <= 0) { n.type = k; break; }
    }
    cells[MID][COLS - 2].type = 'rest';                       // a last campfire at the lair's door
    if (!cells.flat().some(n => n.type === 'shop')) pick(cells.flat().filter(n => n.c >= 2 && n.c <= 4)).type = 'shop';
    for (const n of [cells[MID - 1][0], cells[MID + 1][0], cells[MID][1]]) if (['elite', 'treasure', 'shop', 'rest', 'shrine'].includes(n.type)) n.type = 'combat';
    this.map = { cells, links, cols: COLS, rows: ROWS, at: start.id, moves: 0, gloam: -1, every: 2 };
    start.visited = true;
    this.reveal();
    this.mode = 'map';
  }
  linkedIn(links, a, b) { return links.has(a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id); }
  linked(a, b) { return this.linkedIn(this.map.links, a, b); }
  cell(id) { const [c, r] = id.split(':').map(Number); return this.map.cells[r][c]; }
  here() { return this.cell(this.map.at); }
  adj(n) {
    const m = this.map;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => m.cells[n.r + dr] && m.cells[n.r + dr][n.c + dc]).filter(x => x && x.type !== 'void' && this.linked(n, x));
  }
  lantern() { return 1 + (this.has('lamp') ? 1 : 0); }
  reveal() {
    const at = this.here(), q = [[at, 0]], seen = new Set([at.id]);
    while (q.length) {
      const [n, d] = q.shift(); n.seen = true;
      if (d >= this.lantern()) continue;
      for (const x of this.adj(n)) if (!seen.has(x.id)) { seen.add(x.id); q.push([x, d + 1]); }
    }
    this.map.cells.flat().find(n => n.type === 'boss').seen = true;
  }
  consumed(n) { return n.type !== 'boss' && n.c <= this.map.gloam; }
  reachable() {
    if (this.mode !== 'map' || !this.map) return [];
    const at = this.here(), inGloam = this.consumed(at);
    return this.adj(at).filter(n => inGloam || !this.consumed(n));
  }
  gloamIn() { const m = this.map; return m.gloam >= m.cols - 2 ? Infinity : m.every - (m.moves % m.every); }
  gloamHurt() {
    for (const h of this.heroes) if (!h.dead) h.hp = Math.max(1, h.hp - Math.round(h.maxHp * 0.12));
    this.emit('gloamHit');
  }
  travel(node) {
    if (this.mode !== 'map' || !this.reachable().includes(node)) return false;
    const m = this.map;
    m.at = node.id; m.moves++;
    this.stats.nodes++;
    const first = !node.visited; node.visited = true;
    this.reveal();
    if (this.consumed(node)) this.gloamHurt();
    if (m.moves % m.every === 0 && m.gloam < m.cols - 2) {
      m.gloam++;
      this.emit('gloam', m.gloam);
      if (this.consumed(node)) this.gloamHurt();
    }
    if (!first || node.type === 'start') { this.emit('travel', 'walk'); return true; }
    this.emit('travel', node.type);
    const fl = FLOORS[this.floor];
    switch (node.type) {
      case 'combat': this.startCombat(pick(this.stats.fights < 2 && this.floor === 0 ? fl.easy : (node.c <= 1 ? fl.easy.concat(fl.normal) : fl.normal)), 'normal'); break;
      case 'elite': this.startCombat(pick(fl.elite), 'elite'); break;
      case 'boss': this.startCombat([fl.boss], 'boss'); break;
      case 'event': {
        let pool = EVENTS.filter(e => !this.seenEvents.has(e.id)); if (!pool.length) pool = EVENTS;
        const ev = pick(pool); this.seenEvents.add(ev.id);
        this.mode = 'event'; this.event = { ev, result: null };
        break;
      }
      case 'shrine': this.mode = 'event'; this.event = { ev: WAYSHRINE, result: null }; break;
      case 'rest': this.mode = 'rest'; this.restUses = 1; break;
      case 'shop': this.mode = 'shop'; this.shop = this.makeShop(); break;
      case 'treasure': this.mode = 'treasure'; this.treasure = { relic: this.randomRelic(), gold: 20 + Math.floor(Math.random() * 20), taken: false }; break;
    }
    return true;
  }
  backToMap() {
    this.mode = 'map';
    if (this.queuedFight) { const q = this.queuedFight; this.queuedFight = null; this.startCombat(q.foes, q.elite ? 'elite' : 'normal'); }
  }
  queueFight(foes, elite) { this.queuedFight = { foes, elite }; }

  // ---------------- deck helpers ----------------
  classPool(rarity) { return Object.values(CARDS).filter(c => c.cls === this.cls && c.rarity === rarity).map(c => c.id); }
  randomCard(rarity) { return pick(this.classPool(rarity)); }
  rollRarity(kind) {
    const r = Math.random();
    if (kind === 'boss') return 'rare';
    if (kind === 'elite') return r < 0.12 ? 'rare' : r < 0.52 ? 'uncommon' : 'common';
    return r < 0.06 ? 'rare' : r < 0.38 ? 'uncommon' : 'common';
  }
  cardChoices(kind) {
    const n = 3 + (this.has('silverkey') ? 1 : 0), out = [];
    let guard = 0;
    while (out.length < n && guard++ < 60) { const id = this.randomCard(this.rollRarity(kind)); if (!out.includes(id)) out.push(id); }
    return out;
  }
  addCard(id, up = false) { this.deck.push({ uid: _uid++, id, up }); this.emit('addCard', id); }
  removeCard(uid) { this.deck = this.deck.filter(c => c.uid !== uid); }
  upgradeCard(uid) { const c = this.deck.find(c => c.uid === uid); if (c && !c.up && CARDS[c.id].type !== 'curse') { c.up = true; return true; } return false; }
  upgradeRandom(n) { const cand = shuffle(this.deck.filter(c => !c.up && CARDS[c.id].type !== 'curse')).slice(0, n); cand.forEach(c => c.up = true); return cand.length; }
  randomRelic(boss = false) { const pool = RELICS.filter(r => !!r.boss === boss && !this.has(r.id)); return pool.length ? pick(pool).id : null; }
  gainRelic(id, silent) {
    if (!id || this.has(id)) return;
    this.relics.push(id);
    if (id === 'scale') this.heroes.forEach(h => { h.maxHp += 8; if (!h.dead) h.hp += 8; });
    if (!silent) this.emit('relic', id);
  }
  gainPotion(id) { if (this.potions.length >= 3) return false; this.potions.push(id); this.emit('potion', id); return true; }
  loseHpOut(h, n) { h.hp = Math.max(1, h.hp - n); }

  // ---------------- combat setup ----------------
  makeFoe(type) {
    const d = FOES[type], fl = FLOORS[this.floor];
    const sc = d.boss ? 1 : fl.scale;
    const hp = Math.round((d.hp[0] + Math.random() * (d.hp[1] - d.hp[0])) * sc * (d.boss ? TUNE.bossHp : TUNE.hp) * (this.nightmare ? 1.25 : 1));
    const f = { uid: _uid++, team: 'foe', type, d, name: d.name, art: d.art || type, hp, maxHp: hp, st: {}, intent: null, pat: 0, last: null, boss: !!d.boss, elite: !!d.elite, turn: 0,
      dm: (d.boss ? TUNE.bossDmg : TUNE.dmg * fl.dmg) * (this.nightmare ? 1.2 : 1), anim: { lunge: 0, hit: 0, t: Math.random() * 10, enter: 0.5 }, flags: {} };
    if (!Meta.data.seen[type]) { Meta.data.seen[type] = 1; Meta.write(); }
    return f;
  }
  startCombat(types, kind) {
    this.mode = 'combat'; this.combatKind = kind;
    this.foes = types.map(t => this.makeFoe(t));
    this.dying = [];
    this.drawPile = shuffle(this.deck.map(c => ({ ...c }))); this.hand = []; this.discard = []; this.exhausted = [];
    this.round = 0; this.cardsPlayed = 0; this.idolUsed = false; this.won = false; this.steps = [];
    for (const h of this.heroes) {
      h.st = {}; h.cds = {}; h.intent = null; h.pendingTaunt = false;
      if (!h.dead && this.has('journal')) h.st.block = 6;
      if (!h.dead && this.has('trapezo')) h.st.weak = 1;
    }
    this.emit('combat', kind);
    this.startPlayerTurn(true);
  }
  front() { return this.foes.slice(0, 2); }
  frontHeroes() { return this.allies().sort((a, b) => a.rank - b.rank).slice(0, 2); }
  randomFoe() { return this.foes.length ? pick(this.foes) : null; }
  weakestFoe() { return this.foes.length ? this.foes.reduce((a, b) => (a.hp <= b.hp ? a : b)) : null; }
  toughestFoe() { return this.foes.length ? this.foes.reduce((a, b) => (a.hp >= b.hp ? a : b)) : null; }

  // ---------------- damage pipeline ----------------
  dmgCalc(src, tgt, base, o = {}, consume = false) {
    let d = base;
    if (src && !o.noStr) d += src.st.str || 0;
    if (src && src.player) {
      if (src.st.aim) { d *= 2; if (consume) src.st.aim = 0; }
      if (src.st.deadeye && !this.deadeyeUsed) { d *= 2; if (consume) this.deadeyeUsed = true; }
      if (src.st.predator && tgt.st.vuln > 0) d += src.st.predator;
    }
    if (src && src.team === 'hero' && !src.player && this.has('kulten')) d += 2;
    if (src && src.st.weak > 0) d *= 0.75;
    if (tgt.st.vuln > 0) d *= 1.5;
    if (src && src.team === 'foe') d *= src.dm || 1;
    d = Math.floor(d);
    if (tgt.team === 'hero' && this.has('eldersign')) d -= 1;
    if (tgt.st.intangible > 0) d = Math.min(d, 1);
    return Math.max(0, d);
  }
  attack(src, tgt, base, o = {}) {
    if (!tgt || tgt.dead || tgt.hp <= 0 || this.mode !== 'combat') return 0;
    const d = this.dmgCalc(src, tgt, base, o, true);
    const blocked = o.pierce ? 0 : Math.min(tgt.st.block || 0, d);
    if (blocked) tgt.st.block -= blocked;
    const loss = d - blocked;
    tgt.hp -= loss;
    tgt.anim.hit = 0.3;
    if (src) src.anim.lunge = 0.28;
    this.floater(tgt, loss ? String(loss) : 'BLOCKED', loss ? (tgt.team === 'hero' ? '#d0503a' : '#eeeae0') : '#9ad0ff', d >= 20);
    this.fx.push({ kind: 'hit', who: tgt, t: 0, life: 0.3 });
    if (src && src.team === 'hero') this.stats.dmg += loss;
    this.emit('hit', { hero: tgt.team === 'hero', big: d >= 15, blocked: !loss });
    if (src && src.player && loss > 0 && this.has('fang')) tgt.st.bleed = (tgt.st.bleed || 0) + 1;
    if (src && src.team !== tgt.team && tgt.st.thorns && !o.thornless) this.attack(null, src, tgt.st.thorns, { noStr: true, thornless: true });
    if (tgt.player && src && src.team === 'foe' && this.has('idol') && !this.idolUsed) { this.idolUsed = true; src.st.stun = (src.st.stun || 0) + 1; this.floater(src, 'PETRIFIED', '#c3c7cb'); }
    if (tgt.hp <= 0) this.kill(tgt);
    return loss;
  }
  loseHp(h, n) { if (h.dead) return; h.hp -= n; h.anim.hit = 0.2; this.floater(h, String(n), '#d0503a'); if (h.hp <= 0) this.kill(h); }
  addBlock(t, n) {
    if (!t || t.dead || n <= 0) return;
    t.st.block = (t.st.block || 0) + n;
    this.floater(t, '+' + n, '#9ad0ff');
    this.fx.push({ kind: 'shield', who: t, t: 0, life: 0.4 });
    if (t.player && t.st.juggernaut && this.mode === 'combat') { const f = this.randomFoe(); if (f) this.attack(null, f, t.st.juggernaut, { noStr: true }); }
  }
  heal(t, n) {
    if (!t || t.dead || n <= 0) return;
    const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + n);
    const got = t.hp - before; this.stats.healed += got;
    if (got) { this.floater(t, '+' + got, '#a8d08a'); this.fx.push({ kind: 'heal', who: t, t: 0, life: 0.6 }); }
  }
  apply(t, s, n) {
    if (!t || t.dead || !n) return;
    t.st[s] = (t.st[s] || 0) + n;
    if (['vuln', 'weak', 'bleed', 'stun'].includes(s)) this.floater(t, STATUS[s].name, STATUS[s].color);
    if (s === 'taunt') this.retarget();
  }
  taunt(h) { this.apply(h, 'taunt', 1); }
  revive(h, frac) {
    if (!h || !h.dead) return;
    h.dead = false; h.hp = Math.max(1, Math.round(h.maxHp * frac)); h.st = {};
    this.floater(h, 'REVIVED', '#f0d870'); this.fx.push({ kind: 'heal', who: h, t: 0, life: 0.8 });
    this.emit('revive', h.name);
  }
  floater(who, text, color, big) { const n = this.floaters.filter(f => f.who === who && f.t < 0.45).length; this.floaters.push({ who, text, color, t: -n * 0.12, big, dx: Math.round((Math.random() - 0.5) * 8), stack: n }); }
  kill(t) {
    if (t.team === 'hero') {
      t.dead = true; t.hp = 0; t.st = {}; t.intent = null;
      this.emit('heroDown', { name: t.name, player: t.player });
      if (t.player) { this.end('lose'); return; }
      this.retarget();
      return;
    }
    const i = this.foes.indexOf(t); if (i < 0) return;
    this.foes.splice(i, 1);
    t.dead = true; t.anim.die = 0;
    this.dying.push(t);
    this.emit('foeDown', { type: t.type, boss: t.boss });
    if (t.d.split) for (let k = 0; k < t.d.split; k++) { const p = this.makeFoe('proto'); p.anim.enter = 0.4; this.foes.splice(i, 0, p); this.planFoe(p); }
    if (t.boss) for (const f of this.foes.slice()) { this.foes.splice(this.foes.indexOf(f), 1); f.dead = true; f.anim.die = 0; this.dying.push(f); }
    if (!this.foes.length && this.mode === 'combat') this.winCombat();
  }

  // ---------------- intents ----------------
  taunter() { return this.allies().find(h => h.st.taunt > 0 || h.pendingTaunt); }
  pickHeroTarget(tgt) {
    const live = this.allies(); if (!live.length) return [];
    const tn = this.taunter();
    if (tgt === 'all') return live;
    if (tgt === 'front2') return this.frontHeroes();
    if (tn) return [tn];
    if (tgt === 'melee') { const fr = this.frontHeroes(); return [Math.random() < 0.62 || fr.length < 2 ? fr[0] : fr[1]]; }
    if (tgt === 'back') return [live.reduce((a, b) => (a.rank >= b.rank ? a : b))];
    if (tgt === 'lowest') return [live.reduce((a, b) => (a.hp <= b.hp ? a : b))];
    return [pick(live)];
  }
  makeIntent(f, key, mv) {
    const it = Object.assign({ key }, mv);
    it.targets = mv.kind === 'attack' || mv.kind === 'debuff' ? this.pickHeroTarget(mv.tgt) : [];
    it.all = mv.tgt === 'all' || mv.tgt === 'front2';
    it.perHit = mv.tgt === 'random' && (mv.hits || 1) > 1;
    if (it.perHit) it.targets = this.allies();
    return it;
  }
  planFoe(f) {
    if (f.boss) { this.planBoss(f); return; }
    const d = f.d, keys = Object.keys(d.moves);
    let k = d.pattern[f.pat % d.pattern.length]; f.pat++;
    if (k === '*') { const opts = keys.filter(x => x !== f.last || keys.length === 1); k = pick(opts); }
    f.last = k;
    f.intent = this.makeIntent(f, k, d.moves[k]);
  }
  planBoss(f) {
    f.turn++;
    const hpf = f.hp / f.maxHp, M = (o) => this.makeIntent(f, o.key, o);
    if (f.type === 'dagon') {
      if (hpf < 0.5 && !f.flags.enraged) { f.flags.enraged = 1; f.intent = M({ key: 'anger', kind: 'buff', name: 'The Deep Is Angered', str: 3, block: 12 }); return; }
      const k = ['sweep', 'crush', 'call'][(f.turn - 1) % 3];
      if (k === 'sweep') f.intent = M({ key: k, kind: 'attack', name: 'Trident Sweep', dmg: 7, tgt: 'all' });
      if (k === 'crush') f.intent = M({ key: k, kind: 'attack', name: 'Tidal Crush', dmg: 18, tgt: 'random', vuln: 2 });
      if (k === 'call') f.intent = this.foes.length < 3 ? M({ key: k, kind: 'summon', name: 'Call the Deep', summon: ['deepone'], block: 12 }) : M({ key: k, kind: 'block', name: 'Scaled Hide', block: 22 });
    } else if (f.type === 'nyarlathotep') {
      const masks = this.foes.filter(x => x.type === 'mask').length;
      if (f.turn === 1 || (masks === 0 && f.turn % 4 === 0)) { f.intent = M({ key: 'masks', kind: 'summon', name: 'A Hundred Faces', summon: ['mask', 'mask'] }); return; }
      const k = ['fan', 'whisper', 'chaos'][f.turn % 3];
      if (k === 'fan') f.intent = M({ key: k, kind: 'attack', name: 'Shadow Fan', dmg: 5, hits: 3, tgt: 'random' });
      if (k === 'whisper') f.intent = M({ key: k, kind: 'debuff', name: 'Whispered Madness', dmg: 4, tgt: 'all', weak: 2, vuln: 1 });
      if (k === 'chaos') f.intent = M({ key: k, kind: 'attack', name: 'The Unmaking', dmg: 22, tgt: 'lowest' });
    } else if (f.type === 'cthulhu') {
      if (hpf < 0.5 && !f.flags.spawn) { f.flags.spawn = 1; f.intent = M({ key: 'spawn', kind: 'summon', name: 'The Congregation Rises', summon: ['starspawn'], block: 20 }); return; }
      const k = ['slam', 'dream2', 'dream1', 'unleash', 'rend'][(f.turn - 1) % 5];
      if (k === 'slam') { f.intent = M({ key: k, kind: 'attack', name: 'Drowning Hands', dmg: 12, tgt: 'random' }); if (!this.taunter()) f.intent.targets = shuffle(this.allies()).slice(0, 2); }
      if (k === 'dream2') f.intent = M({ key: k, kind: 'charge', name: 'The Bell Draws Back (2)' });
      if (k === 'dream1') f.intent = M({ key: k, kind: 'charge', name: 'The Bell Draws Back (1)' });
      if (k === 'unleash') f.intent = M({ key: k, kind: 'attack', name: 'THE TOLLING', dmg: 24, tgt: 'all', weak: 2 });
      if (k === 'rend') f.intent = M({ key: k, kind: 'attack', name: 'The Long Reach', dmg: 26, tgt: 'melee' });
    }
  }
  retarget() {
    if (this.mode !== 'combat' || !this.foes) return;
    const tn = this.taunter();
    for (const f of this.foes) {
      const it = f.intent; if (!it || !it.targets) continue;
      if (it.kind !== 'attack' && it.kind !== 'debuff') continue;
      if (it.all) { it.targets = it.tgt === 'front2' ? this.frontHeroes() : this.allies(); continue; }
      if (it.perHit) { it.targets = tn ? [tn] : this.allies(); continue; }
      if (tn) it.targets = [tn];
      it.targets = it.targets.filter(h => !h.dead);
      if (!it.targets.length) it.targets = this.pickHeroTarget(it.tgt);
    }
  }
  intentHits(f, h) {
    const it = f.intent; if (!it || !it.dmg || f.st.stun > 0) return false;
    if (it.kind !== 'attack' && it.kind !== 'debuff') return false;
    return h ? it.targets.includes(h) : it.targets.length > 0;
  }
  incoming(h) {
    let s = 0;
    for (const f of this.foes || []) {
      const it = f.intent; if (!it || !it.dmg || f.st.stun > 0 || !it.targets.includes(h)) continue;
      const hits = it.hits || 1;
      const share = it.perHit ? (it.targets.length === 1 ? 1 : 1 / it.targets.length) : 1;
      s += this.dmgCalc(f, h, it.dmg) * hits * share;
    }
    return Math.round(s);
  }
  planCompanions() {
    for (const cls of CLASS_ORDER) {
      const h = this.heroes.find(x => x.cls === cls && !x.player);
      if (!h) continue;
      h.pendingTaunt = false; h.intent = null;
      if (h.dead) continue;
      for (const sk of COMPANION[cls]) {
        if ((h.cds[sk.id] || 0) > 0) continue;
        const t = sk.pick(this, h);
        if (t) { h.intent = { sk, target: t }; break; }
      }
      if (h.intent && h.intent.sk.id === 'roar') { h.pendingTaunt = true; this.retarget(); }
    }
  }

  // ---------------- turns ----------------
  startPlayerTurn(first = false) {
    if (this.mode !== 'combat') return;
    this.round++;
    this.phase = 'player';
    this.deadeyeUsed = false; this.necroUsed = false;
    for (const h of this.heroes) {
      if (h.dead) continue;
      const hadBlock = (h.st.block || 0) > 0;
      if (!first) h.st.block = 0;
      if (h.player && this.has('eibon') && !hadBlock) h.st.block = (h.st.block || 0) + 4;
      if (h.st.bleed > 0) { this.loseHp(h, h.st.bleed); h.st.bleed--; if (this.mode !== 'combat') return; }
      if (h.player && h.st.migo) h.st.str = (h.st.str || 0) + h.st.migo;
    }
    for (const h of this.heroes) for (const k in h.cds) if (h.cds[k] > 0) h.cds[k]--;
    this.energy = 3 + (this.has('trapezo') ? 1 : 0) + (this.has('crown') ? 1 : 0) + (this.has('lens') ? 1 : 0);
    this.maxEnergy = this.energy;
    this.draw(5 + (this.player.st.insight || 0) + (first && this.has('lamp') ? 1 : 0) - (this.has('crown') ? 1 : 0));
    for (const f of this.foes) this.planFoe(f);
    this.planCompanions();
    this.emit('playerTurn', this.round);
  }
  draw(n) {
    for (let i = 0; i < n; i++) {
      if (this.hand.length >= 10) break;
      if (!this.drawPile.length) { if (!this.discard.length) break; this.drawPile = shuffle(this.discard); this.discard = []; this.emit('shuffle'); }
      this.hand.push(this.drawPile.pop());
    }
  }
  needsTarget(c) { const t = CARDS[c.id].target; return t === 'enemy' || t === 'front' || t === 'ally' || t === 'fallen'; }
  validTargets(c) {
    const t = CARDS[c.id].target;
    if (t === 'enemy') return this.foes.slice();
    if (t === 'front') return this.front();
    if (t === 'ally') return this.allies();
    if (t === 'fallen') return this.heroes.filter(h => h.dead);
    return [];
  }
  canPlay(c) {
    if (this.mode !== 'combat' || this.phase !== 'player' || this.steps.length) return false;
    const d = CARDS[c.id];
    if (d.type === 'curse') return false;
    if (cardCost(c) > this.energy) return false;
    if (this.needsTarget(c) && !this.validTargets(c).length) return false;
    return true;
  }
  playCard(c, target) {
    if (!this.canPlay(c)) return false;
    const d = CARDS[c.id];
    if (this.needsTarget(c) && !this.validTargets(c).includes(target)) return false;
    const cost = cardCost(c);
    this.energy -= cost;
    this.hand.splice(this.hand.indexOf(c), 1);
    const V = cardVals(c);
    d.play(this, V, target);
    this.cardsPlayed++; this.stats.cards++;
    if (this.mode !== 'combat') return true;
    if (d.type === 'attack' && this.player.st.feedrift) this.foes.slice().forEach(f => this.attack(null, f, this.player.st.feedrift, { noStr: true }));
    if (this.has('necro') && cost >= 2 && !this.necroUsed && this.mode === 'combat') {
      this.necroUsed = true;
      let t2 = target;
      if (this.needsTarget(c) && (!t2 || t2.dead || !this.validTargets(c).includes(t2))) t2 = this.validTargets(c)[0];
      if (!this.needsTarget(c) || t2) { d.play(this, V, t2); this.emit('echo', d.name); }
    }
    if (this.has('yithian') && this.cardsPlayed % 4 === 0 && this.mode === 'combat') { this.foes.slice().forEach(f => this.attack(null, f, 4, { noStr: true })); this.fx.push({ kind: 'zapAll', t: 0, life: 0.4 }); }
    if (this.mode !== 'combat') return true;
    if (d.exhaust) this.exhausted.push(c); else if (d.type !== 'power') this.discard.push(c);
    this.emit('play', { id: c.id, type: d.type });
    this.retarget();
    return true;
  }
  usePotion(i, target) {
    if (this.mode !== 'combat' || this.phase !== 'player' || this.steps.length) return false;
    const id = this.potions[i]; if (!id) return false;
    const p = POTIONS[id];
    if (p.target === 'ally' && (!target || target.dead || target.team !== 'hero')) return false;
    if (p.target === 'fallen' && (!target || !target.dead)) return false;
    this.potions.splice(i, 1);
    p.use(this, target);
    this.emit('potionUse', id);
    this.retarget();
    return true;
  }
  endTurn() {
    if (this.mode !== 'combat' || this.phase !== 'player' || this.steps.length) return;
    this.phase = 'allies';
    this.discard.push(...this.hand); this.hand = [];
    const p = this.player;
    if (p.st.unbreakable) this.addBlock(p, p.st.unbreakable);
    if (p.st.hospital) this.allies().forEach(h => this.heal(h, p.st.hospital));
    const S = (fn, delay = 0.45) => this.steps.push({ fn, delay });
    for (const cls of CLASS_ORDER) {
      const h = this.heroes.find(x => x.cls === cls && !x.player);
      if (!h || !h.intent) continue;
      const times = this.round === 1 && this.has('cylinder') ? 2 : 1;
      for (let k = 0; k < times; k++) S(() => this.companionAct(h, k > 0));
    }
    S(() => {
      this.phase = 'foes';
      for (const f of this.foes) f.st.block = 0;
      for (const f of this.foes.slice()) if (f.st.bleed > 0) {
        this.attack(null, f, f.st.bleed, { pierce: true, noStr: true, thornless: true });
        f.st.bleed = Math.max(0, (f.st.bleed || 1) - 1);
        if (this.player.st.plague) this.heal(this.mostWounded(), this.player.st.plague);
      }
    }, 0.3);
    for (const f of this.foes.slice()) S(() => this.foeAct(f), 0.55);
    S(() => {
      for (const u of [...this.heroes, ...this.foes]) for (const s of ['vuln', 'weak', 'taunt', 'intangible']) if (u.st[s] > 0) u.st[s]--;
      this.heroes.forEach(h => h.pendingTaunt = false);
      this.startPlayerTurn();
    }, 0.35);
  }
  companionAct(h, again) {
    if (this.mode !== 'combat' || h.dead) return;
    if (h.st.stun > 0) { h.st.stun--; this.floater(h, 'STUNNED', '#f0d870'); return; }
    if (again) { h.intent = null; for (const sk of COMPANION[h.cls]) { if (sk.id === 'revive' && !this.heroes.some(x => x.dead && !x.player)) continue; const t = sk.pick(this, h); if (t) { h.intent = { sk, target: t }; break; } } }
    const it = h.intent; if (!it) return;
    let t = it.target;
    if (t && t.team === 'foe' && (t.dead || !this.foes.includes(t))) t = it.sk.pick(this, h);
    if (t && t.team === 'hero' && t.dead && it.sk.id !== 'revive') t = this.mostWounded();
    if (!t) return;
    h.anim.lunge = 0.28;
    it.sk.act(this, h, t);
    h.cds[it.sk.id] = it.sk.cd;
    this.emit('compAct', { name: h.name, skill: it.sk.name, cls: h.cls });
    h.intent = null;
  }
  foeAct(f) {
    if (this.mode !== 'combat' || f.dead || !this.foes.includes(f)) return;
    if (f.st.stun > 0) { f.st.stun--; this.floater(f, 'STUNNED', '#f0d870'); return; }
    const it = f.intent; if (!it) return;
    f.anim.lunge = 0.3;
    this.emit('foeAct', { name: f.name, move: it.name, boss: f.boss, kind: it.kind });
    const hits = it.hits || 1;
    if (it.kind === 'attack' || it.kind === 'debuff') {
      let targets = it.targets.filter(h => !h.dead);
      if (!targets.length) targets = this.pickHeroTarget(it.tgt);
      for (let i = 0; i < hits; i++) {
        const tg = it.perHit ? [pick(targets.filter(h => !h.dead).length ? targets.filter(h => !h.dead) : this.allies())].filter(Boolean) : targets;
        for (const h of tg) {
          if (h.dead || this.mode !== 'combat') continue;
          if (it.dmg) this.attack(f, h, it.dmg);
          if (h.dead || this.mode !== 'combat') continue;
          if (it.bleed && i === 0) this.apply(h, 'bleed', it.bleed);
          if (it.weak && i === 0) this.apply(h, 'weak', it.weak);
          if (it.vuln && i === 0) this.apply(h, 'vuln', it.vuln);
        }
      }
    }
    if (this.mode !== 'combat') return;
    if (it.block) { const tgt = it.toBoss ? (this.foes.find(x => x.boss) || f) : f; const b = Math.round(it.block * (f.dm || 1)); tgt.st.block = (tgt.st.block || 0) + b; this.floater(tgt, '+' + b, '#9ad0ff'); this.fx.push({ kind: 'shield', who: tgt, t: 0, life: 0.4 }); }
    if (it.heal) { const n = Math.round(it.heal * f.dm); f.hp = Math.min(f.maxHp, f.hp + n); this.floater(f, '+' + n, '#a8d08a'); }
    if (it.str) { const who = it.allFoes ? this.foes : [f]; who.forEach(x => { x.st.str = (x.st.str || 0) + it.str; this.floater(x, 'STR+' + it.str, '#f0d870'); }); }
    if (it.intangible) f.st.intangible = 1 + it.intangible;
    if (it.summon) for (const t of it.summon) if (this.foes.length < 5) { const n = this.makeFoe(t); n.hp = n.maxHp = Math.round(n.maxHp * 0.55); n.anim.enter = 0.6; this.foes.push(n); this.planFoe(n); n.intent = null; this.fx.push({ kind: 'portal', who: n, t: 0, life: 0.6 }); }
    if (it.kind === 'charge') this.fx.push({ kind: 'dream', who: f, t: 0, life: 0.9 });
  }
  tick(dt) {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.life);
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter(f => f.t < 1.1);
    for (const u of [...this.heroes, ...(this.foes || []), ...(this.dying || [])]) {
      u.anim.t += dt;
      if (u.anim.lunge > 0) u.anim.lunge -= dt;
      if (u.anim.hit > 0) u.anim.hit -= dt;
      if (u.anim.enter > 0) u.anim.enter -= dt;
      if (u.anim.die !== undefined) u.anim.die += dt;
    }
    if (this.dying) this.dying = this.dying.filter(u => u.anim.die < 1.5);
    if (this.steps.length) {
      this.stepT += dt;
      if (this.stepT >= this.steps[0].delay) { this.stepT = 0; const s = this.steps.shift(); s.fn(); }
    }
  }
  flush() { let guard = 0; while (this.steps.length && guard++ < 300) { const s = this.steps.shift(); s.fn(); } }

  // ---------------- rewards ----------------
  winCombat() {
    if (this.won) return;
    this.won = true; this.steps = [];
    const kind = this.combatKind;
    this.stats.fights++; if (kind === 'elite') this.stats.elites++; if (kind === 'boss') this.stats.bosses++;
    let gold = kind === 'boss' ? 90 : kind === 'elite' ? 30 + Math.floor(Math.random() * 10) : 12 + Math.floor(Math.random() * 8);
    if (this.has('tithe')) gold = Math.round(gold * 1.5);
    this.gold += gold;
    if (this.has('bandages')) this.allies().forEach(h => this.heal(h, 5));
    for (const h of this.heroes) { h.st = {}; h.intent = null; h.pendingTaunt = false; }
    this.hand = []; this.drawPile = []; this.discard = [];
    this.reward = { gold, cards: this.cardChoices(kind), cardTaken: false, relic: kind === 'elite' ? this.randomRelic() : null, relicTaken: false, bossRelics: null, potion: Math.random() < (kind === 'normal' ? 0.4 : 0.7) ? pick(Object.keys(POTIONS)) : null, potionTaken: false };
    if (kind === 'boss') {
      this.reward.bossRelics = shuffle(RELICS.filter(r => r.boss && !this.has(r.id)).map(r => r.id)).slice(0, 3);
      this.heroes.forEach(h => { if (h.dead) this.revive(h, 0.5); h.hp = Math.min(h.maxHp, h.hp + Math.round((h.maxHp - h.hp) * 0.6)); });
    }
    this.mode = 'reward';
    this.emit('win', kind);
  }
  finishReward() {
    if (this.combatKind === 'boss') {
      if (this.floor >= FLOORS.length - 1) { this.end('win'); return; }
      this.floor++; this.genMap(); this.emit('floor', this.floor); return;
    }
    this.backToMap();
  }

  // ---------------- shop / rest ----------------
  makeShop() {
    const price = r => ({ common: 50, uncommon: 76, rare: 150 }[r]) + Math.floor(Math.random() * 12) - 6;
    const cards = [];
    for (const r of ['common', 'common', 'uncommon', 'uncommon', 'rare']) { let id, g = 0; do id = this.randomCard(r); while (cards.some(c => c.id === id) && g++ < 20); cards.push({ id, price: price(r), sold: false }); }
    if (Math.random() < 0.6) cards.push({ id: pick(['n_elder', 'n_silver']), price: 120, sold: false });
    const relics = []; for (let i = 0; i < 2; i++) { const id = this.randomRelic(); if (id && !relics.some(r => r.id === id)) relics.push({ id, price: 150 + Math.floor(Math.random() * 60), sold: false }); }
    const potions = shuffle(Object.keys(POTIONS)).slice(0, 2).map(id => ({ id, price: 48 + Math.floor(Math.random() * 10), sold: false }));
    return { cards, relics, potions, removePrice: 75 + 25 * this.shopRemovals, removed: false };
  }
  buy(item, kind) {
    if (item.sold || this.gold < item.price) return false;
    if (kind === 'potion' && this.potions.length >= 3) return false;
    this.gold -= item.price; item.sold = true;
    if (kind === 'card') this.addCard(item.id);
    if (kind === 'relic') this.gainRelic(item.id);
    if (kind === 'potion') this.gainPotion(item.id);
    this.emit('buy');
    return true;
  }
  restHeal() {
    for (const h of this.heroes) { if (h.dead) this.revive(h, 0.3); else h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * 0.3)); }
    this.emit('rest');
  }

  end(result) {
    if (this.over) return;
    this.over = result; this.mode = 'over'; this.steps = [];
    const k = this.stats.nodes + this.stats.elites * 2 + this.stats.bosses * 6 + (result === 'win' ? 10 : 0) + (this.nightmare ? 5 : 0);
    this.knowledge = Math.max(1, k);
    Meta.data.knowledge += this.knowledge; Meta.data.runs++;
    Meta.data.best = Math.max(Meta.data.best, this.floor * 10 + this.stats.nodes);
    if (result === 'win') { Meta.data.wins++; Meta.data.winsBy[this.cls] = (Meta.data.winsBy[this.cls] || 0) + 1; }
    Meta.write();
    this.emit('end', result);
  }
}
