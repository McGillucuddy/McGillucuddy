// ============================================================
//  ELDRITCH DESCENT — simulation (no DOM)
// ============================================================
'use strict';

// ---------------- meta save ----------------
const SAVE_KEY = 'eldritchDescent_v1';
const Meta = {
  data: null,
  defaults() { return { knowledge: 0, spent: 0, rites: {}, runs: 0, wins: 0, best: 0, winsBy: {}, seen: {}, settings: { sound: true, autoAttack: false } }; },
  load() {
    let d = null; try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { d = null; }
    this.data = Object.assign(this.defaults(), d || {});
    this.data.settings = Object.assign(this.defaults().settings, this.data.settings || {});
    return this.data;
  },
  write() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ } },
  rank(id) { return this.data.rites[id] || 0; },
  available() { return this.data.knowledge - this.data.spent; },
  buy(id) {
    const r = RITES.find(x => x.id === id), k = this.rank(id);
    if (k >= r.cost.length || this.available() < r.cost[k]) return false;
    this.data.rites[id] = k + 1; this.data.spent += r.cost[k]; this.write(); return true;
  },
  refund() { this.data.rites = {}; this.data.spent = 0; this.write(); },
};

const BUDGET_COST = { cultist: 1, ghoul: 1, deepone: 2, nightgaunt: 1.6, migo: 2, byakhee: 1.6, shambler: 2.6, hound: 2.6, proto: 0.8 };
let _id = 1;

class Game {
  constructor(cls, opts = {}) {
    this.cls = cls;
    this.nightmare = !!opts.nightmare;
    this.events = [];
    this.chatLog = [];
    this.time = 0;
    this.level = 1; this.xp = 0;
    this.gold = 30 + 40 * Meta.rank('gold');
    this.draughts = 1 + Meta.rank('potion');
    this.rerolls = Meta.rank('reroll');
    this.xpMul = 1 + 0.1 * Meta.rank('xp');
    this.goldMul = 1;
    this.lightMul = 1;
    this.extraChoice = 0;
    this.partyMods = { compDmg: 0, compHp: 0, compCd: 1, regen: 0, dr: 0, flatHp: 0 };
    this.relics = [];
    this.relicFlags = {};
    this.boonCounts = {};
    this.stats = { kills: 0, rooms: 0, bosses: 0, dmg: 0, healed: 0 };
    this.pending = [];
    this.paused = false;
    this.over = null;
    this.floor = 0; this.roomIdx = 0;

    // party: you + the other three classes
    this.heroes = [];
    const order = [cls, ...CLASS_ORDER.filter(c => c !== cls)];
    order.forEach((c, i) => this.heroes.push(this.makeHero(c, i === 0)));
    this.player = this.heroes[0];
    this.refreshStats(true);
    if (Meta.rank('relic')) this.grantRelic(pick(RELICS).id, true);
    this.input = { mx: W / 2, my: H / 2, keys: {}, lmb: false };
    this.enterRoom('combat');
  }

  emit(type, data) { this.events.push({ type, data }); }
  chat(h, text) {
    if (!text) return;
    if (h && h.chatCd > 0) return;
    if (h) h.chatCd = 6;
    const line = { name: h ? h.name : null, color: h ? h.c.roleColor : '#c3c7cb', text, t: this.time };
    this.chatLog.push(line); if (this.chatLog.length > 40) this.chatLog.shift();
    this.emit('chat', line);
  }
  chatFor(event, h) {
    const table = CHATTER[event]; if (!table) return;
    const lines = table[h.cls] || table.any; if (!lines) return;
    this.chat(h, pick(lines));
  }

  // ---------------- heroes ----------------
  makeHero(cls, isPlayer) {
    const c = CLASSES[cls];
    return {
      id: _id++, team: 'hero', cls, c, player: isPlayer, name: isPlayer ? 'You' : pick(NAMES[cls]),
      x: W / 2, y: H - 40, vx: 0, vy: 0, r: 5, face: 1, hp: c.hp, maxHp: c.hp,
      mods: { dmg: 1, hp: 1, cd: 1, crit: 0.05, leech: 0, speed: 1, dodgeCd: 1, dr: 0, abil: 1, pierce: 0, volley: 0 },
      flags: {}, cd: { basic: 0, a0: 0, a1: 0, a2: 0, dodge: 0, draught: 0 },
      buffs: { wall: 0, shield: 0 }, stun: 0, downed: false, revive: 0, reviveTarget: null,
      anim: Math.random() * 10, moving: false, swing: 0, hitFlash: 0, dash: null, invuln: 0,
      atkCount: 0, eibon: false, idolCd: 0, chatCd: 0, ai: { tx: W / 2, ty: H - 40, target: null, think: 0 },
    };
  }
  isComp(h) { return !h.player; }
  heroMaxHp(h) {
    const lvl = 1 + 0.09 * (this.level - 1);
    const comp = this.isComp(h) ? 1 + this.partyMods.compHp : 1;
    return Math.round((h.c.hp * lvl * h.mods.hp * comp * (1 + 0.1 * Meta.rank('vet'))) + this.partyMods.flatHp);
  }
  refreshStats(full = false) {
    for (const h of this.heroes) {
      const m = this.heroMaxHp(h), ratio = h.maxHp ? h.hp / h.maxHp : 1;
      h.maxHp = m; h.hp = full ? m : Math.max(h.downed ? 0 : 1, Math.round(m * ratio));
    }
  }
  dmgMul(h, ability) {
    const lvl = 1 + 0.05 * (this.level - 1);
    const comp = this.isComp(h) ? 1 + this.partyMods.compDmg : 1;
    return lvl * h.mods.dmg * comp * (ability ? h.mods.abil : 1) * (this.nightmare ? 1 : 1);
  }
  cdOf(h, key) {
    const base = key === 'basic' ? h.c.basic.cd : h.c.abilities[+key[1]].cd;
    let m = key === 'basic' ? 1 : h.mods.cd;
    if (this.isComp(h)) m *= key === 'basic' ? (this.partyMods.compCd < 1 ? 0.9 : 1) : this.partyMods.compCd;
    if (key === 'a2' && h.flags.juggernaut) m *= 0.6;
    if (key === 'a0' && h.cls === 'physician' && h.flags.toxin) m *= 0.8;
    return base * m;
  }
  alive(h) { return h && !h.downed && !h.dead; }
  liveHeroes() { return this.heroes.filter(h => !h.downed); }

  // ---------------- rooms ----------------
  enterRoom(type) {
    this.roomType = type;
    this.foes = []; this.projectiles = []; this.zones = []; this.teles = []; this.fx = []; this.floaters = []; this.timers = []; this.spawnQ = [];
    this.props = []; this.obstacles = []; this.doors = []; this.cleared = false; this.waves = 0; this.waveIdx = 0;
    this.boss = null; this.dreamT = 0; this.roomTime = 0;
    this.seed = Math.floor(Math.random() * 1e9);
    const rng = mulberry32(this.seed);
    const fl = FLOORS[this.floor];
    // obstacles
    const nObs = type === 'boss' ? 4 : ['combat', 'elite'].includes(type) ? 2 + Math.floor(rng() * 4) : Math.floor(rng() * 3);
    if (type === 'boss') {
      for (const [x, y] of [[120, 100], [360, 100], [120, 200], [360, 200]]) this.obstacles.push({ x, y, r: 8, kind: 'pillar' });
    } else {
      let guard = 0;
      while (this.obstacles.length < nObs && guard++ < 100) {
        const x = 50 + rng() * (W - 100), y = 70 + rng() * (H - 130);
        if (Math.abs(x - W / 2) < 50 && y > H - 90) continue;          // entry lane
        if (Math.abs(x - W / 2) < 40 && Math.abs(y - H / 2) < 40) continue;
        if (this.obstacles.some(o => dist2(o.x, o.y, x, y) < 60 * 60)) continue;
        this.obstacles.push({ x, y, r: 8, kind: 'pillar' });
      }
    }
    // party enters from the bottom
    this.heroes.forEach((h, i) => {
      h.x = W / 2 + (i - 1.5) * 18; h.y = H - 34; h.vx = h.vy = 0; h.dash = null; h.stun = 0;
      h.ai.tx = h.x; h.ai.ty = h.y - 30;
    });
    const mid = { x: W / 2, y: H / 2 - 10 };
    if (type === 'combat') { this.waves = 2 + (this.floor >= 1 ? 1 : 0) + (this.roomIdx >= 3 ? 1 : 0); }
    else if (type === 'elite') { this.waves = 1; }
    else if (type === 'boss') { this.waves = 1; }
    else if (type === 'shrine') this.props.push({ kind: 'altar', x: mid.x, y: mid.y, used: false });
    else if (type === 'rest') this.props.push({ kind: 'campfire', x: mid.x, y: mid.y, used: false });
    else if (type === 'merchant') this.props.push({ kind: 'merchant', x: mid.x, y: mid.y, used: false, stock: this.makeStock() });
    else if (type === 'treasure') this.props.push({ kind: 'chest', x: mid.x, y: mid.y, used: false });
    if (this.waves) { this.nextWave(); this.heroes.forEach(h => { if (!h.player && Math.random() < 0.35) this.chatFor(type === 'boss' ? 'boss' : 'start', h); }); }
    else this.clearRoom(true);
    this.emit('room', { type, floor: this.floor, room: this.roomIdx });
  }
  foeScale() {
    const f = this.floor, r = this.roomIdx, nm = this.nightmare ? 1.45 : 1;
    return { hp: 3.4 * (1 + 0.5 * f + 0.08 * r) * nm, dmg: 2.8 * (1 + 0.3 * f + 0.05 * r) * (this.nightmare ? 1.25 : 1) };
  }
  nextWave() {
    this.waveIdx++;
    const fl = FLOORS[this.floor];
    const list = [];
    if (this.roomType === 'boss') {
      list.push(fl.boss);
    } else {
      if (this.roomType === 'elite') list.push(pick(fl.elites));
      let budget = this.roomType === 'elite' ? 4 + this.floor * 2.5 : 6 + this.floor * 3.2 + this.roomIdx * 1.4 + (this.waveIdx - 1) * 1.2;
      const pool = fl.pool.filter(p => this.roomIdx >= p[2]);
      const wsum = pool.reduce((a, p) => a + p[1], 0);
      let guard = 0;
      while (budget > 0.6 && guard++ < 40) {
        let r = Math.random() * wsum, i = 0; while (r > pool[i][1]) { r -= pool[i][1]; i++; }
        const t = pool[Math.min(i, pool.length - 1)][0];
        list.push(t); budget -= BUDGET_COST[t] || 1.5;
      }
    }
    list.forEach((t, i) => this.queueSpawn(t, 0.4 + i * 0.25));
  }
  queueSpawn(type, delay, x, y) {
    if (x === undefined) {
      let guard = 0;
      do { x = 40 + Math.random() * (W - 80); y = 60 + Math.random() * (H - 140); }
      while (guard++ < 40 && (this.heroes.some(h => dist2(h.x, h.y, x, y) < 100 * 100) || this.obstacles.some(o => dist2(o.x, o.y, x, y) < 22 * 22)));
      if (FOES[type].boss) { x = W / 2; y = 92; }
    }
    this.spawnQ.push({ type, t: delay, x, y });
    this.fx.push({ kind: 'portal', x, y, t: 0, life: delay + 0.4, big: !!FOES[type].boss || !!FOES[type].elite });
  }
  makeFoe(type, x, y) {
    const d = FOES[type], sc = this.foeScale();
    const bossHp = d.boss ? 3.6 * (this.nightmare ? 1.45 : 1) : sc.hp;
    const f = {
      id: _id++, team: 'foe', type, d, art: d.art || type, x, y, vx: 0, vy: 0, r: Math.max(4, Math.round(d.size * 0.42)),
      hp: d.hp * bossHp, maxHp: d.hp * bossHp, dmg: d.dmg * (d.boss ? 2.2 * (this.nightmare ? 1.25 : 1) : sc.dmg), speed: d.speed, armor: d.armor || 0,
      threat: {}, taunt: null, target: null, cd: 0.6 + Math.random() * 0.8, windup: 0, stun: 0, slow: 0, slowT: 0, dots: [],
      face: 1, anim: Math.random() * 10, hitFlash: 0, special: 2 + Math.random() * 2, phased: 0, lock: 0, cast: null, done: {},
      flying: !!d.flying, elite: !!d.elite, boss: !!d.boss,
    };
    if (type === 'mask') { f.hp = f.maxHp = 160 * sc.hp; }
    // initial aggro on the nearest hero
    const near = this.nearestHero(x, y); if (near) f.threat[near.id] = 1;
    this.foes.push(f);
    if (!Meta.data.seen[type]) { Meta.data.seen[type] = 1; Meta.write(); }
    if (f.boss) { this.boss = f; this.emit('boss', type); }
    return f;
  }
  nearestHero(x, y, filter) {
    let best = null, bd = 1e9;
    for (const h of this.heroes) { if (h.downed || (filter && !filter(h))) continue; const d = dist2(h.x, h.y, x, y); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  clearRoom(silent) {
    if (this.cleared) return;
    this.cleared = true;
    this.teles = []; this.projectiles = this.projectiles.filter(p => p.team === 'hero');
    this.zones = this.zones.filter(z => z.kind !== 'safe');
    // fallen allies get back up after a fight
    for (const h of this.heroes) if (h.downed) { h.downed = false; h.hp = Math.round(h.maxHp * 0.3); this.fx.push({ kind: 'revive', x: h.x, y: h.y, t: 0, life: 0.8 }); }
    if (!silent) {
      this.stats.rooms++;
      const h = pick(this.heroes.filter(x => !x.player)); if (h && Math.random() < 0.6) this.chatFor('clear', h);
    }
    if (this.roomType === 'elite') this.pending.push({ kind: 'relic', options: this.relicOptions(3), title: 'The horror dropped something' });
    if (this.roomType === 'boss') {
      this.stats.bosses++;
      if (this.floor === FLOORS.length - 1) { this.end('win'); return; }
      this.pending.push({ kind: 'relic', options: this.relicOptions(3), title: `${FOES[FLOORS[this.floor].boss].name} has fallen` });
      this.stairs = { x: W / 2, y: H / 2 };
    } else this.makeDoors();
    this.emit('cleared', this.roomType);
  }
  makeDoors() {
    const fl = FLOORS[this.floor];
    let types;
    if (this.roomIdx >= fl.rooms - 1) types = ['boss'];
    else {
      const w = { combat: 4, elite: this.roomIdx >= 1 ? 1.8 : 0, shrine: 1.4, rest: this.roomIdx >= 2 ? 1.2 : 0.3, merchant: 1.1, treasure: 0.7 };
      const n = Math.random() < 0.6 ? 3 : 2; types = [];
      let guard = 0;
      while (types.length < n && guard++ < 50) {
        const tot = Object.values(w).reduce((a, b) => a + b, 0); let r = Math.random() * tot, k = null;
        for (const [t, v] of Object.entries(w)) { if ((r -= v) <= 0) { k = t; break; } }
        if (k && (!types.includes(k) || k === 'combat' && types.filter(x => x === 'combat').length < 1)) types.push(k);
      }
      if (!types.includes('combat') && Math.random() < 0.5) types[0] = 'combat';
    }
    const n = types.length;
    this.doors = types.map((t, i) => ({ type: t, x: Math.round(W / 2 + (i - (n - 1) / 2) * 120), y: 30 }));
  }
  takeDoor(door) {
    this.roomIdx++;
    this.emit('door', door.type);
    this.enterRoom(door.type);
  }
  descend() {
    this.floor++; this.roomIdx = 0; this.stairs = null;
    this.heroes.forEach(h => { h.downed = false; h.hp = Math.max(h.hp, Math.round(h.maxHp * 0.6)); });
    this.emit('floor', this.floor);
    this.enterRoom('combat');
  }

  // ---------------- choices ----------------
  boonOptions(n = 3) {
    n += this.extraChoice;
    const pool = BOONS.filter(b => (!b.cls || b.cls === this.cls) && (this.boonCounts[b.id] || 0) < b.max);
    const out = [];
    const cls = pool.filter(b => b.cls), gen = pool.filter(b => !b.cls);
    if (cls.length && Math.random() < 0.75) out.push(pick(cls));
    while (out.length < n && out.length < pool.length) { const b = pick(pool); if (!out.includes(b)) out.push(b); }
    return out.map(b => b.id);
  }
  relicOptions(n = 3) {
    const pool = RELICS.filter(r => !this.relics.includes(r.id));
    const out = []; while (out.length < n && out.length < pool.length) { const r = pick(pool); if (!out.includes(r)) out.push(r); }
    return out.map(r => r.id);
  }
  takeBoon(id) {
    const b = BOONS.find(x => x.id === id);
    this.boonCounts[id] = (this.boonCounts[id] || 0) + 1;
    if (b.flag) this.player.flags[b.flag] = true;
    if (b.apply) b.apply(this.player, this);
    this.refreshStats();
    this.emit('boon', id);
  }
  grantRelic(id, silent) {
    const r = RELICS.find(x => x.id === id);
    if (!r || this.relics.includes(id)) return;
    this.relics.push(id);
    if (r.flag) this.relicFlags[r.flag] = true;
    if (r.apply) r.apply(this);
    if (!silent) this.emit('relic', id);
  }
  makeStock() {
    const s = [{ kind: 'draught', price: 35 }, { kind: 'heal', price: 25 }];
    s.push({ kind: 'boon', id: this.boonOptions(1)[0], price: 70 });
    const rel = this.relicOptions(1)[0]; if (rel) s.push({ kind: 'relic', id: rel, price: 140 });
    return s;
  }
  buy(item) {
    if (item.sold || this.gold < item.price) return false;
    this.gold -= item.price; item.sold = true;
    if (item.kind === 'draught') this.draughts++;
    else if (item.kind === 'heal') this.heroes.forEach(h => { h.downed = false; this.healRaw(h, h.maxHp * 0.5); });
    else if (item.kind === 'boon') this.takeBoon(item.id);
    else if (item.kind === 'relic') this.grantRelic(item.id);
    this.emit('buy', item.kind);
    return true;
  }
  interact(prop) {
    if (prop.used && prop.kind !== 'merchant') return;
    if (prop.kind === 'altar') { prop.used = true; this.pending.push({ kind: 'boon', options: this.boonOptions(3), title: 'The Elder Sign offers a gift' }); }
    else if (prop.kind === 'chest') { prop.used = true; this.pending.push({ kind: 'relic', options: this.relicOptions(3), title: 'Inside the chest' }); }
    else if (prop.kind === 'campfire') { prop.used = true; this.pending.push({ kind: 'rest', title: 'The fire crackles' }); }
    else if (prop.kind === 'merchant') this.pending.push({ kind: 'merchant', prop, title: 'The Antiquarian' });
    this.emit('interact', prop.kind);
  }
  restHeal() { this.heroes.forEach(h => { h.downed = false; this.healRaw(h, h.maxHp * 0.6); }); this.emit('rest'); }

  // ---------------- combat core ----------------
  gainXp(n) {
    this.xp += n * this.xpMul;
    let need = this.xpNeed();
    while (this.xp >= need) {
      this.xp -= need; this.level++;
      this.refreshStats();
      this.heroes.forEach(h => { if (!h.downed) this.healRaw(h, h.maxHp * 0.25); });
      this.pending.push({ kind: 'boon', options: this.boonOptions(3), title: `Level ${this.level}` });
      this.emit('level', this.level);
      need = this.xpNeed();
    }
  }
  xpNeed() { return Math.round(22 + 16 * Math.pow(this.level, 1.35)); }

  damage(src, tgt, amount, o = {}) {
    if (!tgt || tgt.downed || tgt.dead || tgt.hp <= 0) return 0;
    if (tgt.team === 'hero' && tgt.invuln > 0) return 0;
    if (tgt.phased > 0 && !o.true) return 0;
    let d = amount, crit = false;
    if (src && src.team === 'hero') {
      let cc = src.mods.crit;
      if (src.flags.deadeye && dist2(src.x, src.y, tgt.x, tgt.y) > 120 * 120) cc += 0.25;
      if (!o.noCrit && Math.random() < cc) { d *= 2; crit = true; }
    }
    if (tgt.team === 'foe') d *= 1 - tgt.armor * (o.pierceArmor ? 0 : 1);
    else {
      let dr = tgt.c.armor + tgt.mods.dr + this.partyMods.dr + (tgt.buffs.wall > 0 ? 0.6 : 0);
      if (o.true) dr = Math.min(dr, 0.3);
      d *= 1 - Math.min(0.8, dr);
      if (tgt.buffs.shield > 0) { const a = Math.min(tgt.buffs.shield, d); tgt.buffs.shield -= a; d -= a; }
    }
    d = Math.max(0, d);
    tgt.hp -= d; if (!o.noCrit && d >= 2) tgt.hitFlash = 0.12;
    if (d >= 1 || crit) this.floaters.push({ x: tgt.x + rand(-4, 4), y: tgt.y - tgt.r * 2 - 4, text: Math.round(d), color: tgt.team === 'hero' ? '#d0503a' : crit ? '#f0d870' : '#eeeae0', t: 0, crit });
    if (src && src.team === 'hero' && tgt.team === 'foe') {
      this.stats.dmg += d;
      tgt.threat[src.id] = (tgt.threat[src.id] || 0) + d * src.c.threat * (src.buffs.wall > 0 ? 1.3 : 1);
      if (src.mods.leech > 0) this.healRaw(src, d * src.mods.leech, true);
      if (crit && this.relicFlags.fang && src.player) this.addDot(tgt, d * 0.6, 3, src);
    }
    if (tgt.team === 'hero' && src && src.team === 'foe') {
      if (tgt.player && this.relicFlags.idol && tgt.idolCd <= 0 && !src.boss) { src.stun = Math.max(src.stun, 1.5); tgt.idolCd = 6; this.fx.push({ kind: 'stone', x: src.x, y: src.y, t: 0, life: 0.6 }); }
      if (tgt.hp < tgt.maxHp * 0.3 && !tgt.player && Math.random() < 0.3) this.chatFor('lowhp', tgt);
      this.emit('hurt', { player: tgt.player, d });
    }
    if (tgt.hp <= 0) {
      if (tgt.team === 'foe') this.killFoe(tgt, src);
      else this.downHero(tgt);
    }
    return d;
  }
  healRaw(h, amount, quiet) {
    if (!h || h.downed) return 0;
    const before = h.hp; h.hp = Math.min(h.maxHp, h.hp + amount);
    const got = h.hp - before;
    if (got >= 1 && !quiet) this.floaters.push({ x: h.x + rand(-4, 4), y: h.y - 14, text: '+' + Math.round(got), color: '#a8d08a', t: 0 });
    return got;
  }
  heal(src, h, amount) {
    if (!h || h.downed) return 0;
    const over = Math.max(0, h.hp + amount - h.maxHp);
    const got = this.healRaw(h, amount);
    this.stats.healed += got;
    if (src && src.flags.overflow && over > 0) h.buffs.shield = Math.min(h.maxHp * 0.5, h.buffs.shield + over);
    // healing draws attention
    const engaged = this.foes.filter(f => Object.keys(f.threat).length);
    if (src && engaged.length) for (const f of engaged) f.threat[src.id] = (f.threat[src.id] || 0) + got * 0.4 / engaged.length;
    return got;
  }
  addDot(f, total, dur, src) { f.dots.push({ dps: total / dur, t: dur, src }); }
  killFoe(f, src) {
    if (f.dead) return;
    f.dead = true; f.hp = 0;
    this.stats.kills++;
    this.gainXp(f.d.xp);
    const g = Math.round(f.d.gold * this.goldMul * (0.8 + Math.random() * 0.4));
    if (g) { this.gold += g; this.floaters.push({ x: f.x, y: f.y - f.r * 2 - 12, text: '+' + g, color: '#f0d870', t: 0 }); }
    this.fx.push({ kind: 'death', x: f.x, y: f.y, t: 0, life: 0.6, r: f.r, color: ICHOR[f.art] || '#3a2418', big: f.boss || f.elite });
    if (this.relicFlags.trapezo && Math.random() < 0.15) { this.heroes.forEach(h => this.healRaw(h, h.maxHp * 0.08)); this.fx.push({ kind: 'ring', x: f.x, y: f.y, t: 0, life: 0.5, color: '#f0d870', r: 30 }); }
    if (src && src.flags && src.flags.burst && src.player && src.cls === 'occultist') {
      for (const o of this.foes) if (!o.dead && o !== f && dist2(o.x, o.y, f.x, f.y) < 26 * 26) this.damage(src, o, 18 * this.dmgMul(src, true), { noCrit: true });
      this.fx.push({ kind: 'burst', x: f.x, y: f.y, t: 0, life: 0.35, color: '#c8a0e8', r: 26 });
    }
    if (f.d.split) for (let i = 0; i < f.d.split; i++) { const a = i / f.d.split * Math.PI * 2; const p = this.makeFoe('proto', f.x + Math.cos(a) * 10, f.y + Math.sin(a) * 8); Object.assign(p.threat, f.threat); }
    if (f.boss) { this.boss = null; this.emit('bossDown', f.type); this.fx.push({ kind: 'shock', x: f.x, y: f.y, t: 0, life: 1.2 }); this.teles = []; }
    this.emit('kill', f.type);
  }
  downHero(h) {
    h.hp = 0; h.downed = true; h.dash = null; h.revive = 0; h.buffs.wall = 0;
    for (const f of this.foes) { delete f.threat[h.id]; if (f.taunt && f.taunt.by === h) f.taunt = null; }
    this.fx.push({ kind: 'death', x: h.x, y: h.y, t: 0, life: 0.6, r: 5, color: '#5a1418' });
    if (!h.player) this.chatFor('downed', h);
    this.emit('downed', { player: h.player, name: h.name });
    if (this.heroes.every(x => x.downed)) this.end('lose');
  }
  reviveHero(h, frac, by) {
    if (!h.downed) return;
    h.downed = false; h.hp = Math.round(h.maxHp * frac); h.invuln = 1.2;
    this.fx.push({ kind: 'revive', x: h.x, y: h.y, t: 0, life: 0.8 });
    if (by && !by.player) this.chatFor('revive', by);
    this.emit('revived', { player: h.player });
  }

  // ---------------- hero actions ----------------
  aimAt(h, tx, ty) { const a = Math.atan2(ty - h.y, tx - h.x); if (Math.abs(Math.cos(a)) > 0.2) h.face = Math.cos(a) > 0 ? 1 : -1; return a; }
  basicAttack(h, tx, ty) {
    if (h.cd.basic > 0 || h.stun > 0 || h.downed || h.dash) return false;
    const b = h.c.basic, a = this.aimAt(h, tx, ty);
    let mul = this.dmgMul(h, false);
    if (h.eibon) { mul *= 3; h.eibon = false; }
    h.cd.basic = this.cdOf(h, 'basic');
    h.swing = 1; h.atkCount++;
    if (b.kind === 'melee') {
      let n = 0;
      if (h.flags.vengeance) mul *= 1 + 0.25 * this.foes.filter(f => !f.dead && f.target === h).length;
      for (const f of this.foes) {
        if (f.dead || f.phased > 0) continue;
        const d = Math.hypot(f.x - h.x, f.y - h.y);
        if (d <= b.range + f.r && Math.abs(angDiff(Math.atan2(f.y - h.y, f.x - h.x), a)) <= b.arc / 2) { this.damage(h, f, b.dmg * mul); n++; }
      }
      this.fx.push({ kind: 'slash', x: h.x, y: h.y, a, t: 0, life: 0.18, r: b.range });
      this.emit('swing', h.cls);
    } else {
      const shots = h.cls === 'hunter' && h.flags.twin ? 2 : 1;
      for (let i = 0; i < shots; i++) {
        const aa = a + (shots > 1 ? (i - 0.5) * 0.08 : 0);
        this.shoot(h, h.x + Math.cos(aa) * 6, h.y - 6 + Math.sin(aa) * 6, aa, b.speed, b.dmg * mul, { color: b.color, range: b.range, pierce: h.mods.pierce, poison: h.flags.toxin && h.cls === 'physician' });
      }
      this.emit('shot', h.cls);
    }
    if (this.relicFlags.yithian && h.player && h.atkCount % 4 === 0) this.chainLightning(h, tx, ty, 26 * mul);
    return true;
  }
  shoot(src, x, y, a, speed, dmg, o = {}) {
    this.projectiles.push({ team: src.team, src, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg, r: o.r || 2, life: (o.range || 200) / speed, pierce: o.pierce || 0, hit: new Set(), color: o.color || '#fff', kind: o.kind || 'bolt', knock: o.knock || 0, poison: o.poison });
  }
  chainLightning(h, tx, ty, dmg) {
    let cur = { x: h.x, y: h.y }; const hit = [];
    for (let i = 0; i < 3; i++) {
      let best = null, bd = 90 * 90;
      for (const f of this.foes) { if (f.dead || hit.includes(f)) continue; const d = dist2(f.x, f.y, cur.x, cur.y); if (d < bd) { bd = d; best = f; } }
      if (!best) break; hit.push(best); this.fx.push({ kind: 'zap', x: cur.x, y: cur.y, x2: best.x, y2: best.y, t: 0, life: 0.15 }); cur = best;
      this.damage(h, best, dmg, { noCrit: true });
    }
  }
  useAbility(h, i, tx, ty) {
    const key = 'a' + i;
    if (h.cd[key] > 0 || h.stun > 0 || h.downed || h.dash) return false;
    const ab = h.c.abilities[i], m = this.dmgMul(h, true);
    const a = this.aimAt(h, tx, ty);
    const clampR = (r) => { const d = Math.hypot(tx - h.x, ty - h.y); if (d > r) { tx = h.x + (tx - h.x) / d * r; ty = h.y + (ty - h.y) / d * r; } };
    let ok = true;
    switch (ab.id) {
      case 'taunt': {
        for (const f of this.foes) if (!f.dead && dist2(f.x, f.y, h.x, h.y) < 95 * 95) {
          const top = Math.max(0, ...Object.values(f.threat));
          f.threat[h.id] = top * 1.3 + 60; f.taunt = { by: h, t: 4 };
          if (h.flags.roarDmg) this.damage(h, f, 45 * m);
        }
        this.fx.push({ kind: 'ring', x: h.x, y: h.y, t: 0, life: 0.45, color: '#d0503a', r: 95 });
        if (!h.player) this.chatFor('taunt', h);
        break;
      }
      case 'wall': h.buffs.wall = 5; if (h.flags.wallHeal) this.healRaw(h, h.maxHp * 0.25); this.fx.push({ kind: 'ring', x: h.x, y: h.y, t: 0, life: 0.4, color: '#9ad0ff', r: 16 }); break;
      case 'charge': {
        clampR(105);
        const d = Math.hypot(tx - h.x, ty - h.y) || 1, dur = 0.22;
        h.dash = { vx: (tx - h.x) / dur, vy: (ty - h.y) / dur, t: dur, kind: 'charge', m };
        h.invuln = Math.max(h.invuln, dur);
        break;
      }
      case 'rift': {
        clampR(160);
        const big = h.flags.bigRift;
        this.zones.push({ kind: 'rift', x: tx, y: ty, r: big ? 44 : 30, t: 0, dur: big ? 5.5 : 4, tick: 0.5, acc: 0, owner: h, dmg: 11 * m });
        break;
      }
      case 'blast': {
        const doBlast = () => {
          for (const f of this.foes) {
            if (f.dead || f.phased > 0) continue;
            const d = Math.hypot(f.x - h.x, f.y - h.y);
            if (d <= 78 && Math.abs(angDiff(Math.atan2(f.y - h.y, f.x - h.x), a)) <= 0.6) {
              this.damage(h, f, 36 * m);
              if (!f.boss) { const k = (f.elite ? 12 : 34) / (d || 1); f.x += (f.x - h.x) * k; f.y += (f.y - h.y) * k; f.slow = 0.5; f.slowT = 2; }
            }
          }
          this.fx.push({ kind: 'cone', x: h.x, y: h.y, a, arc: 1.2, r: 78, t: 0, life: 0.3, color: '#c8a0e8' });
        };
        doBlast(); if (h.flags.echo) this.timers.push({ t: 0.4, fn: doBlast });
        break;
      }
      case 'word': {
        clampR(170);
        for (const f of this.foes) if (!f.dead && dist2(f.x, f.y, tx, ty) < 62 * 62) { this.damage(h, f, 70 * m); f.stun = Math.max(f.stun, f.boss ? 0.8 : 2); }
        this.fx.push({ kind: 'word', x: tx, y: ty, t: 0, life: 0.7, r: 62 });
        this.emit('boom');
        break;
      }
      case 'mend': {
        const allies = this.heroes.filter(x => !x.downed);
        let tgt = null;
        if (h.player) {
          let bd = 34 * 34; for (const x of allies) { const d = dist2(x.x, x.y, tx, ty); if (d < bd) { bd = d; tgt = x; } }
        }
        if (!tgt) tgt = allies.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
        const amt = 58 * this.dmgMul(h, true);
        this.heal(h, tgt, amt);
        this.fx.push({ kind: 'mend', x: tgt.x, y: tgt.y, t: 0, life: 0.5 });
        this.fx.push({ kind: 'beam', x: h.x, y: h.y - 8, x2: tgt.x, y2: tgt.y - 6, t: 0, life: 0.2, color: '#a8d08a' });
        if (h.flags.chainMend) {
          const second = allies.filter(x => x !== tgt).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          if (second) { this.heal(h, second, amt * 0.6); this.fx.push({ kind: 'beam', x: tgt.x, y: tgt.y - 6, x2: second.x, y2: second.y - 6, t: 0, life: 0.2, color: '#a8d08a' }); }
        }
        if (!h.player && tgt !== h && Math.random() < 0.15) this.chatFor('heal', h);
        break;
      }
      case 'sanct': {
        if (h.player) clampR(120); else { tx = h.ai.sx ?? h.x; ty = h.ai.sy ?? h.y; }
        const big = h.flags.bigSanct;
        this.zones.push({ kind: 'sanct', x: tx, y: ty, r: big ? 54 : 36, t: 0, dur: 5, tick: 0.5, acc: 0, owner: h, heal: (big ? 9 : 7) * this.dmgMul(h, true) });
        break;
      }
      case 'salts': {
        let n = 0;
        for (const x of this.heroes) if (x.downed && dist2(x.x, x.y, h.x, h.y) < 100 * 100) { this.reviveHero(x, 0.45, h); n++; }
        if (!n) this.heroes.forEach(x => this.heal(h, x, x.maxHp * 0.25));
        this.fx.push({ kind: 'ring', x: h.x, y: h.y, t: 0, life: 0.5, color: '#a8d08a', r: 100 });
        break;
      }
      case 'volley': {
        const n = 5 + h.mods.volley;
        for (let k = 0; k < n; k++) { const aa = a + (k / (n - 1) - 0.5) * 0.75; this.shoot(h, h.x, h.y - 6, aa, 300, 14 * m, { color: '#f0d870', range: 170 }); }
        this.emit('shot', 'volley');
        break;
      }
      case 'trap': {
        clampR(110);
        const mine = this.zones.filter(z => z.kind === 'trap' && z.owner === h);
        if (mine.length >= 3) this.zones.splice(this.zones.indexOf(mine[0]), 1);
        this.zones.push({ kind: 'trap', x: tx, y: ty, r: 9, t: 0, dur: 60, owner: h, dmg: 30 * m, armed: 0.4 });
        break;
      }
      case 'silver': {
        this.shoot(h, h.x, h.y - 6, a, 420, 85 * m, { color: '#eeeae0', range: 320, pierce: 99, r: 3, kind: 'silver', knock: 18 });
        this.emit('shot', 'silver');
        break;
      }
      default: ok = false;
    }
    if (ok) { h.cd[key] = this.cdOf(h, key); h.swing = 1; this.emit('ability', ab.id); }
    return ok;
  }
  dodge(h, dx, dy) {
    if (h.cd.dodge > 0 || h.downed || h.stun > 0 || h.dash) return false;
    const l = Math.hypot(dx, dy); if (l < 0.1) { dx = h.face; dy = 0; } else { dx /= l; dy /= l; }
    const dur = 0.22, dist = 58;
    h.dash = { vx: dx * dist / dur, vy: dy * dist / dur, t: dur, kind: 'dodge' };
    h.invuln = Math.max(h.invuln, 0.32);
    h.cd.dodge = 2.4 * h.mods.dodgeCd;
    if (this.relicFlags.eibon && h.player) h.eibon = true;
    this.emit('dodge');
    return true;
  }
  drinkDraught(h) {
    if (this.draughts <= 0 || h.downed || h.cd.draught > 0 || h.hp >= h.maxHp) return false;
    this.draughts--; h.cd.draught = 1;
    this.healRaw(h, h.maxHp * 0.5);
    this.fx.push({ kind: 'mend', x: h.x, y: h.y, t: 0, life: 0.5 });
    this.emit('drink');
    return true;
  }

  // ---------------- movement ----------------
  moveEnt(e, dx, dy) {
    e.x += dx; e.y += dy;
    const m = e.r + 1;
    e.x = clamp(e.x, 16 + m, W - 16 - m); e.y = clamp(e.y, 40 + m * 0.5, H - 10 - m * 0.5);
    if (!e.flying) for (const o of this.obstacles) {
      const ddx = e.x - o.x, ddy = e.y - o.y, d = Math.hypot(ddx, ddy), min = o.r + e.r;
      if (d < min && d > 0.001) { e.x = o.x + ddx / d * min; e.y = o.y + ddy / d * min; }
    }
  }
  separate() {
    const all = this.heroes.filter(h => !h.downed).concat(this.foes.filter(f => !f.dead && f.phased <= 0));
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      if (a.flying !== b.flying && (a.flying || b.flying)) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = (a.r + b.r) * 0.9;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2, nx = dx / d, ny = dy / d;
        // big things don't get shoved by small things
        const wa = a.boss || a.elite ? 0.1 : 1, wb = b.boss || b.elite ? 0.1 : 1, s = wa + wb;
        this.moveEnt(a, -nx * push * 2 * wa / s, -ny * push * 2 * wa / s);
        this.moveEnt(b, nx * push * 2 * wb / s, ny * push * 2 * wb / s);
      }
    }
  }

  // ---------------- telegraphs ----------------
  tele(o) { const t = Object.assign({ t: 0, color: 'red' }, o); this.teles.push(t); return t; }
  inTele(t, x, y, pad = 0) {
    if (t.shape === 'circle') return dist2(x, y, t.x, t.y) <= (t.r + pad) * (t.r + pad);
    if (t.shape === 'cone') return dist2(x, y, t.x, t.y) <= (t.r + pad) * (t.r + pad) && Math.abs(angDiff(Math.atan2(y - t.y, x - t.x), t.ang)) <= t.arc / 2 + pad / Math.max(20, t.r);
    if (t.shape === 'line') {
      const cx = Math.cos(t.ang), cy = Math.sin(t.ang), dx = x - t.x, dy = y - t.y;
      const along = dx * cx + dy * cy, perp = Math.abs(-dx * cy + dy * cx);
      return along >= -pad && along <= t.len + pad && perp <= t.w / 2 + pad;
    }
    return false;
  }
  fireTele(t) {
    if (t.dmg) for (const h of this.heroes) if (!h.downed && this.inTele(t, h.x, h.y, h.r * 0.4)) this.damage(t.src && !t.src.dead ? t.src : null, h, t.dmg, { tele: true });
    if (t.onFire) t.onFire(t);
    this.fx.push({ kind: 'teleHit', shape: t.shape, x: t.x, y: t.y, r: t.r, ang: t.ang, arc: t.arc, len: t.len, w: t.w, t: 0, life: 0.3 });
    this.emit('tele');
  }

  // ---------------- update ----------------
  update(dt) {
    if (this.over || this.paused) return;
    this.time += dt; this.roomTime += dt;

    // spawns
    for (const s of this.spawnQ) { s.t -= dt; if (s.t <= 0) this.makeFoe(s.type, s.x, s.y); }
    this.spawnQ = this.spawnQ.filter(s => s.t > 0);
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) tm.fn(); }
    this.timers = this.timers.filter(tm => tm.t > 0);

    for (const h of this.heroes) this.updateHero(h, dt);
    for (const f of this.foes) if (!f.dead) this.updateFoe(f, dt);
    this.separate();
    this.updateProjectiles(dt);
    this.updateZones(dt);
    for (const t of this.teles) { t.t += dt; if (t.t >= t.delay && !t.fired) { t.fired = true; this.fireTele(t); } }
    this.teles = this.teles.filter(t => !t.fired);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.life);
    for (const f of this.floaters) { f.t += dt; f.y -= 16 * dt; }
    this.floaters = this.floaters.filter(f => f.t < 0.9);
    this.foes = this.foes.filter(f => !f.dead);

    // wave / room flow
    if (!this.cleared && this.waves && !this.spawnQ.length) {
      const left = this.foes.length;
      if (left === 0 || (left <= 1 && this.roomType === 'combat' && this.waveIdx < this.waves && this.roomTime > 6)) {
        if (this.waveIdx < this.waves) this.nextWave();
        else if (left === 0) this.clearRoom();
      }
    }
    // doors / stairs / props
    if (this.cleared && !this.pending.length) {
      const p = this.player;
      for (const d of this.doors) if (!p.downed && Math.abs(p.x - d.x) < 13 && p.y < 52) { this.takeDoor(d); return; }
      if (this.stairs && dist2(p.x, p.y, this.stairs.x, this.stairs.y) < 12 * 12) { this.descend(); return; }
    }
  }

  updateHero(h, dt) {
    for (const k in h.cd) if (h.cd[k] > 0) h.cd[k] -= dt;
    h.chatCd -= dt; h.idolCd -= dt;
    if (h.hitFlash > 0) h.hitFlash -= dt;
    if (h.swing > 0) h.swing = Math.max(0, h.swing - dt * 4);
    if (h.invuln > 0) h.invuln -= dt;
    if (h.buffs.wall > 0) h.buffs.wall -= dt;
    if (h.downed) { h.moving = false; return; }
    if (this.partyMods.regen) this.healRaw(h, h.maxHp * this.partyMods.regen * dt, true);
    if (h.stun > 0) { h.stun -= dt; h.moving = false; return; }
    if (h.dash) {
      h.dash.t -= dt;
      this.moveEnt(h, h.dash.vx * dt, h.dash.vy * dt);
      if (Math.random() < 0.6) this.fx.push({ kind: 'dust', x: h.x, y: h.y + 4, t: 0, life: 0.3 });
      if (h.dash.t <= 0) {
        if (h.dash.kind === 'charge') {
          const stun = h.flags.juggernaut ? 2 : 1.2;
          for (const f of this.foes) if (!f.dead && dist2(f.x, f.y, h.x, h.y) < 30 * 30) { this.damage(h, f, 24 * h.dash.m); f.stun = Math.max(f.stun, f.boss ? 0.4 : stun); f.threat[h.id] = (f.threat[h.id] || 0) + 40; }
          this.fx.push({ kind: 'ring', x: h.x, y: h.y, t: 0, life: 0.3, color: '#c3c7cb', r: 30 }); this.emit('boom');
        }
        h.dash = null;
      }
      h.moving = true; h.anim += dt * 14;
      return;
    }
    // revive channel
    if (h.reviveTarget) {
      const t = h.reviveTarget;
      if (!t.downed || dist2(t.x, t.y, h.x, h.y) > 22 * 22) { h.reviveTarget = null; t.revive = 0; }
      else { t.revive += dt; if (t.revive >= 2.5) { this.reviveHero(t, 0.35, h); h.reviveTarget = null; } return; }
    }
    if (h.player && !this.autoPlayer) this.controlPlayer(h, dt);
    else this.aiHero(h, dt);
  }

  controlPlayer(h, dt) {
    const k = this.input.keys, I = this.input;
    let dx = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0), dy = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
    if (I.joy) { dx = I.joy.x; dy = I.joy.y; }
    const l = Math.hypot(dx, dy);
    const sp = h.c.speed * h.mods.speed;
    if (l > 0.1) { this.moveEnt(h, dx / Math.max(1, l) * sp * dt, dy / Math.max(1, l) * sp * dt); h.moving = true; h.anim += dt * 10; if (Math.abs(dx) > 0.2) h.face = dx > 0 ? 1 : -1; }
    else h.moving = false;
    h.lastMove = { x: dx, y: dy };
    // aim: mouse, or nearest horror when auto-aiming (touch)
    let ax = I.mx, ay = I.my;
    if (I.autoAim) { const f = this.nearestFoe(h.x, h.y, 260); if (f) { ax = f.x; ay = f.y; } }
    h.aim = { x: ax, y: ay };
    if ((I.lmb || Meta.data.settings.autoAttack || I.autoAim) && this.foes.length) {
      if (!I.autoAim || this.nearestFoe(h.x, h.y, h.c.basic.range + 10)) this.basicAttack(h, ax, ay);
    }
    // revive with E (hold)
    if (k.e) {
      const t = this.heroes.find(x => x.downed && dist2(x.x, x.y, h.x, h.y) < 20 * 20);
      if (t) { h.reviveTarget = t; t.revive = t.revive || 0; }
    }
  }
  nearestFoe(x, y, maxD = 1e9, filter) {
    let best = null, bd = maxD * maxD;
    for (const f of this.foes) { if (f.dead || f.phased > 0 || (filter && !filter(f))) continue; const d = dist2(f.x, f.y, x, y); if (d < bd) { bd = d; best = f; } }
    return best;
  }

  // ---------------- companion AI ----------------
  dangerAt(x, y, pad = 6, horizon = 1.6) {
    for (const t of this.teles) if (t.delay - t.t < horizon && t.dmg && this.inTele(t, x, y, pad)) return t;
    return null;
  }
  safeSpotNear(h) {
    // sample points around; pick nearest one outside every telegraph
    const dream = this.zones.filter(z => z.kind === 'safe');
    if (dream.length && this.dreamT > 0) {
      const z = dream.reduce((a, b) => dist2(a.x, a.y, h.x, h.y) < dist2(b.x, b.y, h.x, h.y) ? a : b);
      return { x: z.x + rand(-4, 4), y: z.y + rand(-4, 4) };
    }
    let best = null, bd = 1e9;
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2, r = 22 + (i % 3) * 18;
      const x = clamp(h.x + Math.cos(a) * r, 24, W - 24), y = clamp(h.y + Math.sin(a) * r, 48, H - 16);
      if (this.dangerAt(x, y, 8, 3)) continue;
      if (this.obstacles.some(o => dist2(o.x, o.y, x, y) < (o.r + 6) ** 2)) continue;
      const d = dist2(x, y, h.x, h.y) + (this.boss ? 0 : 0); if (d < bd) { bd = d; best = { x, y }; }
    }
    return best;
  }
  aiHero(h, dt) {
    const ai = h.ai;
    ai.think -= dt;
    const foes = this.foes.filter(f => !f.dead && f.phased <= 0);
    const tank = this.heroes.find(x => x.cls === 'warden' && !x.downed);
    // ---- 1. survival: get out of danger / into Elder Signs
    const inDanger = this.dangerAt(h.x, h.y, h.r + 4) || (this.dreamT > 0 && !this.zones.some(z => z.kind === 'safe' && dist2(z.x, z.y, h.x, h.y) < (z.r - 4) ** 2));
    if (inDanger) {
      if (ai.think <= 0 || !ai.safe) { ai.safe = this.safeSpotNear(h); ai.think = 0.2; }
      if (ai.safe) { ai.tx = ai.safe.x; ai.ty = ai.safe.y; }
      if (h.player && inDanger && this.teles.some(t => t.delay - t.t < 0.35 && this.inTele(t, h.x, h.y, 2))) this.dodge(h, ai.tx - h.x, ai.ty - h.y);
    } else ai.safe = null;

    if (!inDanger && ai.think <= 0) {
      ai.think = 0.15 + Math.random() * 0.08;
      const role = h.cls;
      // revive fallen allies when it is reasonably safe
      const downed = this.heroes.filter(x => x.downed);
      if (downed.length && role === 'physician' && h.cd.a2 <= 0) {
        const t = downed[0];
        if (dist2(t.x, t.y, h.x, h.y) < 90 * 90) this.useAbility(h, 2, t.x, t.y);
        else { ai.tx = t.x; ai.ty = t.y; }
      } else if (downed.length && (!foes.length || (role !== 'warden' && downed.some(d => !foes.some(f => dist2(f.x, f.y, d.x, d.y) < 50 * 50))))) {
        const t = downed.find(d => !foes.some(f => dist2(f.x, f.y, d.x, d.y) < 50 * 50)) || downed[0];
        ai.tx = t.x; ai.ty = t.y;
        if (dist2(t.x, t.y, h.x, h.y) < 16 * 16) { h.reviveTarget = t; }
        ai.target = null;
      } else if (!foes.length) {
        // idle: drift toward the player / a door
        const p = this.player.downed ? h : this.player;
        if (dist2(p.x, p.y, h.x, h.y) > 40 * 40) { ai.tx = p.x + rand(-20, 20); ai.ty = p.y + rand(8, 22); }
        ai.target = null;
        if (role === 'physician') { const w = this.heroes.filter(x => !x.downed && x.hp < x.maxHp * 0.8); if (w.length && h.cd.a0 <= 0) this.useAbility(h, 0, w[0].x, w[0].y); }
      } else if (role === 'warden') this.aiTank(h, foes);
      else if (role === 'physician') this.aiHealer(h, foes, tank);
      else this.aiDps(h, foes, tank);
    }

    // ---- movement toward ai target point
    const dx = ai.tx - h.x, dy = ai.ty - h.y, d = Math.hypot(dx, dy);
    const sp = h.c.speed * (h.player ? h.mods.speed : 1) * (inDanger ? 1.15 : 1);
    if (d > 3) { const s = Math.min(d, sp * dt); this.moveEnt(h, dx / d * s, dy / d * s); h.moving = true; h.anim += dt * 10; if (Math.abs(dx) > 1) h.face = dx > 0 ? 1 : -1; }
    else h.moving = false;
    // keep swinging at whatever is in reach
    const t = ai.target && !ai.target.dead ? ai.target : null;
    if (t) {
      const inRange = dist2(t.x, t.y, h.x, h.y) <= (h.c.basic.range + t.r) ** 2;
      if (inRange) this.basicAttack(h, t.x, t.y);
      h.face = t.x > h.x ? 1 : -1;
    }
  }
  aiTank(h, foes) {
    const ai = h.ai;
    // peel: anything chewing on someone else, closest first; otherwise the boss; otherwise nearest
    const loose = foes.filter(f => f.target && f.target !== h);
    let t = this.boss && !this.boss.dead ? this.boss : null;
    if (loose.length) t = loose.reduce((a, b) => dist2(a.x, a.y, h.x, h.y) < dist2(b.x, b.y, h.x, h.y) ? a : b);
    if (!t) t = this.nearestFoe(h.x, h.y);
    ai.target = t;
    if (!t) return;
    const d = Math.hypot(t.x - h.x, t.y - h.y);
    const near = foes.filter(f => dist2(f.x, f.y, h.x, h.y) < 92 * 92);
    if (h.cd.a0 <= 0 && (near.filter(f => f.target !== h).length >= 2 || (this.boss && this.boss.target !== h && dist2(this.boss.x, this.boss.y, h.x, h.y) < 90 * 90) || near.some(f => f.d.ai === 'assassin' && f.target !== h))) this.useAbility(h, 0, h.x, h.y);
    if (h.cd.a2 <= 0 && d > 50 && d < 110 && t.target !== h) this.useAbility(h, 2, t.x, t.y);
    if (h.cd.a1 <= 0 && (h.hp < h.maxHp * 0.5 || (this.boss && this.boss.cast)) && foes.some(f => f.target === h)) this.useAbility(h, 1, h.x, h.y);
    // stand in front of it, between it and the party where possible
    const party = this.heroes.filter(x => !x.downed && x !== h);
    let px = W / 2, py = H - 50;
    if (party.length) { px = party.reduce((a, b) => a + b.x, 0) / party.length; py = party.reduce((a, b) => a + b.y, 0) / party.length; }
    const ux = t.x - px, uy = t.y - py, ul = Math.hypot(ux, uy) || 1;
    const reach = h.c.basic.range + t.r - 6;
    ai.tx = t.x - ux / ul * reach; ai.ty = t.y - uy / ul * reach;
  }
  aiDps(h, foes, tank) {
    const ai = h.ai;
    let t = null;
    // threats to me or the healer first, then the tank's target, then whoever's weakest
    const healer = this.heroes.find(x => x.cls === 'physician' && !x.downed);
    t = foes.find(f => f.target === h && dist2(f.x, f.y, h.x, h.y) < 40 * 40) || (healer ? foes.find(f => f.target === healer) : null);
    if (!t && this.boss && !this.boss.dead) t = this.boss;
    if (!t && tank && tank.ai.target && !tank.ai.target.dead) t = tank.ai.target;
    if (!t) t = foes.reduce((a, b) => (a.hp < b.hp ? a : b));
    ai.target = t;
    const b = h.c.basic, pref = Math.min(b.range * 0.7, h.cls === 'hunter' ? 140 : 110);
    // abilities
    const cluster = (x, y, r) => foes.filter(f => dist2(f.x, f.y, x, y) < r * r).length;
    const dT = Math.hypot(t.x - h.x, t.y - h.y);
    if (h.cls === 'occultist') {
      if (h.cd.a0 <= 0 && dT < 160 && (cluster(t.x, t.y, 34) >= 2 || t.boss || t.elite)) this.useAbility(h, 0, t.x, t.y);
      const close = foes.filter(f => dist2(f.x, f.y, h.x, h.y) < 60 * 60);
      if (h.cd.a1 <= 0 && close.length) this.useAbility(h, 1, close[0].x, close[0].y);
      if (h.cd.a2 <= 0 && dT < 170 && (cluster(t.x, t.y, 60) >= 3 || t.boss)) this.useAbility(h, 2, t.x, t.y);
    } else {
      if (h.cd.a0 <= 0 && dT < 120 && (cluster(h.x, h.y, 120) >= 3 || t.elite || t.boss)) this.useAbility(h, 0, t.x, t.y);
      const charger = foes.find(f => f.target && f.target !== tank && dist2(f.x, f.y, h.x, h.y) < 90 * 90);
      if (h.cd.a1 <= 0 && charger && !charger.flying) this.useAbility(h, 1, (charger.x + h.x) / 2, (charger.y + h.y) / 2);
      if (h.cd.a2 <= 0 && dT < 300) this.useAbility(h, 2, t.x, t.y);
    }
    // position: on the far side of the fight from the target, at preferred range
    let ax = h.x - t.x, ay = h.y - t.y; const al = Math.hypot(ax, ay) || 1;
    ax /= al; ay /= al;
    // hang back behind the tank
    if (tank) { const bx = tank.x - t.x, by = tank.y - t.y, bl = Math.hypot(bx, by) || 1; ax = ax * 0.6 + bx / bl * 0.4; ay = ay * 0.6 + by / bl * 0.4; }
    const near = foes.find(f => dist2(f.x, f.y, h.x, h.y) < 34 * 34);
    const r = near ? pref + 30 : pref;
    ai.tx = t.x + ax * r + Math.sin(this.time * 0.7 + h.id) * 12; ai.ty = t.y + ay * r + Math.cos(this.time * 0.6 + h.id) * 10;
    if (dT > b.range + t.r - 4) { ai.tx = t.x + ax * (b.range * 0.6); ai.ty = t.y + ay * (b.range * 0.6); }
  }
  aiHealer(h, foes, tank) {
    const ai = h.ai;
    const live = this.heroes.filter(x => !x.downed);
    const hurt = live.filter(x => x.hp < x.maxHp * 0.72).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    const low = live.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
    if (h.cd.a0 <= 0 && hurt.length) {
      const t = hurt[0];
      if (dist2(t.x, t.y, h.x, h.y) < 170 * 170) this.useAbility(h, 0, t.x, t.y);
    }
    if (h.cd.a1 <= 0) {
      const grp = live.filter(x => x.hp < x.maxHp * 0.8);
      if (grp.length >= 2) {
        const cx = grp.reduce((a, b) => a + b.x, 0) / grp.length, cy = grp.reduce((a, b) => a + b.y, 0) / grp.length;
        if (grp.filter(x => dist2(x.x, x.y, cx, cy) < 40 * 40).length >= 2) { ai.sx = cx; ai.sy = cy; this.useAbility(h, 1, cx, cy); }
      }
    }
    if (h.cd.a2 <= 0 && live.filter(x => x.hp < x.maxHp * 0.45).length >= 2) this.useAbility(h, 2, h.x, h.y);
    // chip damage on the tank's target
    const t = (tank && tank.ai.target && !tank.ai.target.dead) ? tank.ai.target : this.nearestFoe(h.x, h.y);
    ai.target = t;
    // stand behind the group, in reach of the most wounded
    const anchor = tank || low;
    let ax = 0, ay = 1;
    if (t) { ax = anchor.x - t.x; ay = anchor.y - t.y; const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l; }
    const threat = foes.find(f => dist2(f.x, f.y, h.x, h.y) < 40 * 40);
    let back = threat ? 95 : 70;
    ai.tx = anchor.x + ax * back + Math.sin(this.time * 0.5) * 10; ai.ty = anchor.y + ay * back;
    if (hurt.length && dist2(hurt[0].x, hurt[0].y, ai.tx, ai.ty) > 150 * 150) { ai.tx = (hurt[0].x + ai.tx) / 2; ai.ty = (hurt[0].y + ai.ty) / 2; }
  }

  // ---------------- foe AI ----------------
  pickFoeTarget(f) {
    if (f.taunt && f.taunt.t > 0 && this.alive(f.taunt.by)) return f.taunt.by;
    const live = this.heroes.filter(h => !h.downed);
    if (!live.length) return null;
    if (f.d.ai === 'assassin') {
      // hounds want the soft targets
      const soft = live.filter(h => h.cls !== 'warden');
      if (soft.length) return soft.reduce((a, b) => (a.maxHp < b.maxHp ? a : b));
    }
    let best = null, bv = -1;
    for (const h of live) { const v = f.threat[h.id] || 0; if (v > bv) { bv = v; best = h; } }
    if (bv <= 0) best = this.nearestHero(f.x, f.y);
    return best;
  }
  updateFoe(f, dt) {
    f.anim += dt * (f.boss ? 5 : 8);
    if (f.hitFlash > 0) f.hitFlash -= dt;
    if (f.taunt) { f.taunt.t -= dt; if (f.taunt.t <= 0) f.taunt = null; }
    if (f.slowT > 0) { f.slowT -= dt; if (f.slowT <= 0) f.slow = 0; }
    for (const d of f.dots) { d.t -= dt; this.damage(d.src, f, d.dps * dt, { noCrit: true }); if (f.dead) return; }
    f.dots = f.dots.filter(d => d.t > 0);
    if (f.cast) f.cast.t += dt;
    if (f.type === 'cthulhu') this.cthulhuDream(f, dt);
    if (f.phased > 0) {
      f.phased -= dt;
      if (f.phased <= 0) {
        const t = f.target && !f.target.downed ? f.target : this.pickFoeTarget(f);
        if (t) { f.x = clamp(t.x - t.face * 14, 24, W - 24); f.y = clamp(t.y + 2, 48, H - 16); f.windup = 0.35; f.cd = 0; }
        this.fx.push({ kind: 'blink', x: f.x, y: f.y, t: 0, life: 0.4 });
      }
      return;
    }
    if (f.stun > 0) { f.stun -= dt; f.windup = 0; return; }
    if (f.lock > 0) { f.lock -= dt; return; }

    f.target = this.pickFoeTarget(f);
    const t = f.target; if (!t) return;
    const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy) || 1;
    if (Math.abs(dx) > 2) f.face = dx > 0 ? 1 : -1;
    const sp = f.speed * (1 - f.slow);
    f.cd -= dt; f.special -= dt;

    // auras
    if (f.d.aura) for (const h of this.heroes) if (!h.downed && dist2(h.x, h.y, f.x, f.y) < f.d.aura ** 2) this.damage(f, h, 4 * this.foeScale().dmg * dt, { noCrit: true });

    if (f.boss) { this.bossThink(f, t, d, dt); if (f.lock > 0 || f.cast) return; }

    // specials
    switch (f.d.ai) {
      case 'swooper':
        if (f.special <= 0 && d < 140) {
          f.special = 4.5 + Math.random() * 1.5;
          const ang = Math.atan2(dy, dx), len = Math.min(150, d + 40);
          const tl = this.tele({ shape: 'line', x: f.x, y: f.y, ang, len, w: 14, delay: 0.75, dmg: f.dmg * 1.4, src: f });
          f.lock = 0.75;
          tl.onFire = () => { if (!f.dead) { f.x = clamp(f.x + Math.cos(ang) * len, 24, W - 24); f.y = clamp(f.y + Math.sin(ang) * len, 48, H - 16); this.fx.push({ kind: 'dust', x: f.x, y: f.y, t: 0, life: 0.3 }); } };
          return;
        }
        break;
      case 'phaser':
        if (f.special <= 0) { f.special = 5 + Math.random() * 2; f.phased = 1.1; this.fx.push({ kind: 'blink', x: f.x, y: f.y, t: 0, life: 0.4 }); return; }
        break;
      case 'assassin':
        if (f.special <= 0 && d > 30) {
          f.special = 6;
          this.fx.push({ kind: 'blink', x: f.x, y: f.y, t: 0, life: 0.4 });
          f.x = clamp(t.x - dx / d * 16, 24, W - 24); f.y = clamp(t.y - dy / d * 16, 48, H - 16);
          this.fx.push({ kind: 'blink', x: f.x, y: f.y, t: 0, life: 0.4 });
          f.cd = Math.min(f.cd, 0.3);
          return;
        }
        break;
      case 'slammer':
        if (f.special <= 0 && d < 50) { f.special = 5; this.tele({ shape: 'circle', x: f.x, y: f.y, r: 42, delay: 1.1, dmg: f.dmg * 1.5, src: f }); f.lock = 1.1; return; }
        break;
      case 'brute':
        if (f.special <= 0 && d < 70) { f.special = 5.5; this.tele({ shape: 'cone', x: f.x, y: f.y, r: 66, ang: Math.atan2(dy, dx), arc: 1.4, delay: 1.0, dmg: f.dmg * 1.6, src: f }); f.lock = 1.0; return; }
        break;
    }

    // windup → strike
    if (f.windup > 0) {
      f.windup -= dt;
      if (f.windup <= 0) {
        if (f.d.proj) {
          const n = f.d.proj.n || 1, a0 = Math.atan2(dy, dx);
          for (let i = 0; i < n; i++) { const a = a0 + (n > 1 ? (i / (n - 1) - 0.5) * f.d.proj.spread : 0); this.shoot(f, f.x, f.y - f.r, a, f.d.proj.speed, f.dmg, { color: f.d.proj.color, range: f.d.range * 1.6, r: 2 }); }
          this.emit('foeShot');
        } else if (d <= f.d.range + t.r + f.r + 8) {
          this.damage(f, t, f.dmg);
          this.fx.push({ kind: 'claw', x: t.x, y: t.y - 4, t: 0, life: 0.2 });
        }
      }
      return;
    }
    const range = f.d.range + t.r + f.r;
    if (f.d.proj) {
      // casters: keep their distance and strafe
      const want = f.d.range * 0.75;
      let mx = 0, my = 0;
      if (d > f.d.range) { mx = dx / d; my = dy / d; }
      else if (d < want * 0.6) { mx = -dx / d; my = -dy / d; }
      else { mx = -dy / d * 0.5 * Math.sin(this.time + f.id); my = dx / d * 0.5 * Math.sin(this.time + f.id); }
      this.moveEnt(f, mx * sp * dt, my * sp * dt);
      if (d <= f.d.range && f.cd <= 0) { f.cd = f.d.atkCd * rand(0.85, 1.2); f.windup = 0.35; }
    } else {
      if (d > range - 2) this.moveEnt(f, dx / d * sp * dt, dy / d * sp * dt);
      else if (f.cd <= 0) { f.cd = f.d.atkCd * rand(0.9, 1.15); f.windup = f.elite ? 0.4 : 0.28; }
    }
  }

  // ---------------- bosses ----------------
  cthulhuDream(f, dt) {
    if (this.dreamT > 0) this.dreamT -= dt;
    // the Dreaming: a raid-wide pulse only the Elder Signs protect against
    f.dream = (f.dream ?? 12) - dt;
    if (f.dream <= 0) {
      f.dream = 17;
      this.dreamT = 4.2;
      const spots = [];
      while (spots.length < 2) { const x = rand(70, W - 70), y = rand(90, H - 50); if (spots.every(s => dist2(s.x, s.y, x, y) > 110 * 110) && dist2(x, y, f.x, f.y) > 60 * 60) spots.push({ x, y }); }
      spots.forEach(s => this.zones.push({ kind: 'safe', x: s.x, y: s.y, r: 26, t: 0, dur: 4.6 }));
      this.emit('bossYell', 'THE DREAMING COMES — stand within an Elder Sign!');
      this.emit('dream');
      this.timers.push({ t: 4.2, fn: () => {
        this.dreamT = 0;
        for (const h of this.heroes) if (!h.downed && !this.zones.some(z => z.kind === 'safe' && dist2(z.x, z.y, h.x, h.y) < z.r * z.r)) this.damage(f, h, h.maxHp * 0.6, { true: true, noCrit: true });
        this.fx.push({ kind: 'dreampulse', x: f.x, y: f.y, t: 0, life: 0.9 });
        this.emit('boom');
      } });
      f.special = Math.max(f.special, 1.5);
    }
  }
  bossThink(f, t, d, dt) {
    const hpf = f.hp / f.maxHp;
    const live = this.heroes.filter(h => !h.downed);
    const startCast = (name, dur, fn) => { f.cast = { name, t: 0, dur }; f.lock = dur; this.emit('cast', name); fn(); this.timers.push({ t: dur, fn: () => { f.cast = null; } }); };
    const sideSpawn = (type, n) => { for (let i = 0; i < n; i++) { const left = i % 2 === 0; this.queueSpawn(type, 0.8 + i * 0.3, left ? 34 : W - 34, rand(80, H - 60)); } };
    if (f.cast) return;
    if (f.type === 'dagon') {
      if (hpf < 0.7 && !f.done.a) { f.done.a = 1; sideSpawn('deepone', 3); this.emit('bossYell', 'The deep calls its children!'); }
      if (hpf < 0.35 && !f.done.b) { f.done.b = 1; sideSpawn('deepone', 3); sideSpawn('cultist', 2); this.emit('bossYell', 'Iä! Iä! Dagon!'); }
      if (f.special > 0) return;
      const fast = hpf < 0.5 ? 0.8 : 1;
      const opts = ['sweep', 'tide', ...(hpf < 0.5 ? ['wave'] : [])].filter(o => o !== f.last);
      const o = pick(opts); f.last = o; f.special = (3.2 + Math.random()) * fast;
      if (o === 'sweep') startCast('Trident Sweep', 1.0 * fast, () => this.tele({ shape: 'cone', x: f.x, y: f.y, r: 92, ang: Math.atan2(t.y - f.y, t.x - f.x), arc: 2.1, delay: 1.0 * fast, dmg: f.dmg * 1.7, src: f }));
      if (o === 'tide') startCast('Tidal Crush', 0.6, () => live.forEach(h => this.tele({ shape: 'circle', x: h.x, y: h.y, r: 24, delay: 1.35 * fast, dmg: f.dmg * 1.4, src: f })));
      if (o === 'wave') startCast('Black Wave', 0.7, () => { const rows = [90, 150, 210].sort(() => Math.random() - 0.5).slice(0, 2); rows.forEach(y => this.tele({ shape: 'line', x: 16, y, ang: 0, len: W - 32, w: 30, delay: 1.6, dmg: f.dmg * 1.5, src: f })); });
    } else if (f.type === 'nyarlathotep') {
      if (hpf < 0.66 && !f.done.a) { f.done.a = 1; for (let i = 0; i < 3; i++) this.queueSpawn('mask', 0.6 + i * 0.3); this.emit('bossYell', 'I have a thousand faces. Which one is mine?'); }
      if (hpf < 0.4 && !f.done.b) { f.done.b = 1; sideSpawn('hound', 2); this.emit('bossYell', 'Hounds. Fetch.'); }
      if (f.special > 0) return;
      const opts = ['fan', 'blink', 'fan', 'pulse'].filter(o => o !== f.last);
      const o = pick(opts); f.last = o; f.special = 2.8 + Math.random();
      if (o === 'fan') startCast('Shadow Fan', 0.8, () => this.timers.push({ t: 0.8, fn: () => { if (f.dead) return; const a0 = Math.atan2(t.y - f.y, t.x - f.x); for (let i = 0; i < 11; i++) this.shoot(f, f.x, f.y - 10, a0 + (i / 10 - 0.5) * 1.5, 120, f.dmg * 0.9, { color: '#8d63b0', range: 320, r: 3 }); this.emit('foeShot'); } }));
      if (o === 'blink') startCast('Crawling Chaos', 1.0, () => {
        this.fx.push({ kind: 'blink', x: f.x, y: f.y, t: 0, life: 0.5 });
        f.x = rand(100, W - 100); f.y = rand(80, H - 90);
        this.fx.push({ kind: 'blink', x: f.x, y: f.y, t: 0, life: 0.5 });
        this.tele({ shape: 'circle', x: f.x, y: f.y, r: 52, delay: 1.0, dmg: f.dmg * 1.6, src: f });
      });
      if (o === 'pulse') startCast('Thousand Eyes', 0.6, () => live.forEach(h => this.tele({ shape: 'circle', x: h.x, y: h.y, r: 22, delay: 1.3, dmg: f.dmg * 1.2, src: f })));
    } else if (f.type === 'cthulhu') {
      if (hpf < 0.6 && !f.done.a) { f.done.a = 1; sideSpawn('deepone', 4); this.emit('bossYell', 'Ph\'nglui mglw\'nafh...'); }
      if (hpf < 0.3 && !f.done.b) { f.done.b = 1; this.queueSpawn('starspawn', 1.0, W / 2 + (Math.random() < 0.5 ? -150 : 150), 200); this.emit('bossYell', 'My spawn. Rise.'); }
      if (f.special > 0) return;
      const opts = ['slam', 'claws', 'slam'].filter(o => o !== f.last);
      const o = pick(opts); f.last = o; f.special = 3.0 + Math.random();
      if (o === 'slam') startCast('Tentacle Slam', 0.6, () => live.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(3, live.length)).forEach(h => {
        const a = Math.atan2(h.y - f.y, h.x - f.x); this.tele({ shape: 'line', x: f.x, y: f.y, ang: a, len: 320, w: 22, delay: 1.25, dmg: f.dmg * 1.5, src: f });
      }));
      if (o === 'claws') startCast('Rending Claws', 1.0, () => this.tele({ shape: 'cone', x: f.x, y: f.y, r: 100, ang: Math.atan2(t.y - f.y, t.x - f.x), arc: 1.7, delay: 1.0, dmg: f.dmg * 1.8, src: f }));
    }
  }

  // ---------------- projectiles & zones ----------------
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0 || p.x < 12 || p.x > W - 12 || p.y < 30 || p.y > H - 6) { p.dead = true; continue; }
      if (this.obstacles.some(o => dist2(o.x, o.y, p.x, p.y) < o.r * o.r)) { p.dead = true; this.fx.push({ kind: 'spark', x: p.x, y: p.y, t: 0, life: 0.2, color: p.color }); continue; }
      if (p.team === 'hero') {
        for (const f of this.foes) {
          if (f.dead || f.phased > 0 || p.hit.has(f.id)) continue;
          if (dist2(f.x, f.y - f.r * 0.6, p.x, p.y) < (f.r + p.r + 1) ** 2) {
            p.hit.add(f.id);
            this.damage(p.src, f, p.dmg);
            if (p.poison) this.addDot(f, p.dmg * 1.2, 3, p.src);
            if (p.knock && !f.boss) { const l = Math.hypot(p.vx, p.vy); this.moveEnt(f, p.vx / l * p.knock, p.vy / l * p.knock); }
            this.fx.push({ kind: 'spark', x: p.x, y: p.y, t: 0, life: 0.2, color: p.color });
            if (p.pierce-- <= 0) { p.dead = true; break; }
          }
        }
      } else {
        for (const h of this.heroes) {
          if (h.downed || h.invuln > 0) continue;
          if (dist2(h.x, h.y - 5, p.x, p.y) < (h.r + p.r + 1) ** 2) { this.damage(p.src, h, p.dmg); p.dead = true; this.fx.push({ kind: 'spark', x: p.x, y: p.y, t: 0, life: 0.2, color: p.color }); break; }
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }
  updateZones(dt) {
    for (const z of this.zones) {
      z.t += dt;
      if (z.kind === 'rift' || z.kind === 'sanct') {
        z.acc += dt;
        while (z.acc >= z.tick) {
          z.acc -= z.tick;
          if (z.kind === 'rift') for (const f of this.foes) if (!f.dead && dist2(f.x, f.y, z.x, z.y) < z.r * z.r) { this.damage(z.owner, f, z.dmg, { noCrit: true }); f.slow = Math.max(f.slow, 0.45); f.slowT = 0.6; }
          if (z.kind === 'sanct') for (const h of this.heroes) if (!h.downed && dist2(h.x, h.y, z.x, z.y) < z.r * z.r) this.heal(z.owner, h, z.heal);
        }
      }
      if (z.kind === 'trap' && z.t > z.armed) {
        const f = this.foes.find(f => !f.dead && !f.flying && dist2(f.x, f.y, z.x, z.y) < (z.r + f.r) ** 2);
        if (f) {
          this.damage(z.owner, f, z.dmg);
          f.stun = Math.max(f.stun, f.boss ? 0.5 : 2.5);
          if (z.owner.flags.bleedTrap) this.addDot(f, z.dmg * 1.6, 4, z.owner);
          z.dead = true; this.fx.push({ kind: 'snap', x: z.x, y: z.y, t: 0, life: 0.3 }); this.emit('swing', 'trap');
        }
      }
    }
    this.zones = this.zones.filter(z => !z.dead && z.t < z.dur);
  }

  end(result) {
    if (this.over) return;
    this.over = result;
    const k = this.stats.rooms * 1 + this.stats.bosses * 5 + (result === 'win' ? 10 : 0) + (this.nightmare ? Math.round(this.stats.rooms * 0.5) : 0);
    this.knowledge = Math.max(1, k);
    Meta.data.knowledge += this.knowledge;
    Meta.data.runs++;
    const depth = this.floor * 10 + this.roomIdx;
    Meta.data.best = Math.max(Meta.data.best, depth);
    if (result === 'win') { Meta.data.wins++; Meta.data.winsBy[this.cls] = (Meta.data.winsBy[this.cls] || 0) + 1; }
    Meta.write();
    this.emit('end', result);
  }
}
