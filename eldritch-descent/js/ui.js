// ============================================================
//  ELDRITCH DESCENT — UI / controller
// ============================================================
'use strict';

const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const POT_GLYPH = { heal: '♥', salts: '✚', powder: '✸', courage: '◆', strength: '▲', clarity: '✧' };

function spriteToCanvas(cv, spr, fi = 0, crop) {
  const k = cv.getContext('2d'); k.imageSmoothingEnabled = false; k.clearRect(0, 0, cv.width, cv.height);
  k.save();
  if (crop) { const s = cv.width / crop.w; k.scale(s, s); k.translate(-crop.x, -crop.y); }
  else { const s = Math.min(cv.width / spr.w, cv.height / spr.h); k.translate((cv.width - spr.w * s) / 2, (cv.height - spr.h * s) / 2); k.scale(s, s); }
  k.drawImage(spr.frames[fi], 0, 0);
  k.restore();
}
function cardIcon(c) {
  const d = CARDS[c.id];
  if (d.type === 'curse') return ['skull', '#5d636a'];
  if (d.type === 'power') return [/Block/.test(d.text) ? 'shield' : /Strength/.test(d.text) ? 'up' : 'swirl', '#c8a0e8'];
  if (d.type === 'attack') return [/every horror/.test(d.text) ? 'swirl' : /Bleed/.test(d.text) ? 'drop' : 'sword', '#d0503a'];
  if (/Revive/.test(d.text)) return ['cross', '#f0d870'];
  if (/Heal/.test(d.text)) return ['cross', '#a8d08a'];
  if (/Taunt/.test(d.text)) return ['roar', '#4a8ad0'];
  if (/Block/.test(d.text)) return ['shield', '#9ad0ff'];
  if (/Stun/.test(d.text)) return ['star', '#f0d870'];
  if (/Bleed/.test(d.text)) return ['drop', '#9a2a24'];
  if (/Draw|energy/.test(d.text)) return ['eye', '#c8a0e8'];
  return ['skull', '#c8a0e8'];
}

const UI = {
  g: null, r: null, last: 0, sel: null, selCard: null, armedPot: null, hover: null, hoverNode: null, modal: null, lastMode: null, handKey: '',

  init() {
    Meta.load();
    Sfx.setEnabled(Meta.data.settings.sound);
    $('#opt-sound').checked = Meta.data.settings.sound;
    this.r = new Renderer($('#cv'));
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { Sfx.init(); Sfx.play('click'); this.show(b.dataset.go); }));
    $('#opt-sound').addEventListener('change', e => { Meta.data.settings.sound = e.target.checked; Meta.write(); Sfx.init(); Sfx.setEnabled(e.target.checked); });
    $('#reset-save').addEventListener('click', () => { if (confirm('Erase all Forbidden Knowledge, rites and records?')) { localStorage.removeItem(SAVE_KEY); Meta.load(); this.refreshTitle(); } });
    $('#rites-refund').addEventListener('click', () => { Meta.refund(); this.renderRites(); });
    $('#btn-start').addEventListener('click', () => { if (this.sel) this.startRun(this.sel, $('#opt-nightmare').checked); });
    $('#btn-end').addEventListener('click', () => this.endTurn());
    $('#btn-deck').addEventListener('click', () => this.openDeck('Your Deck'));
    $('#btn-menu').addEventListener('click', () => this.openPause());
    $('#pile-draw').addEventListener('click', () => this.g && this.g.drawPile && this.openPile('Draw Pile (shuffled order hidden)', this.g.drawPile.slice().sort((a, b) => CARDS[a.id].name.localeCompare(CARDS[b.id].name))));
    $('#pile-disc').addEventListener('click', () => this.g && this.g.discard && this.openPile('Discard Pile', this.g.discard));
    this.bindInput();
    window.addEventListener('resize', () => this.fitStage());
    this.drawTitleArt();
    this.refreshTitle();
    requestAnimationFrame(t => this.loop(t));
  },

  show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    if (id === 'classsel') this.renderClasses();
    if (id === 'rites') this.renderRites();
    if (id === 'bestiary') this.renderBestiary();
    if (id === 'title') this.refreshTitle();
    if (id !== 'game') Sfx.stopDrone();
  },
  refreshTitle() {
    const d = Meta.data;
    $('#rites-badge').textContent = Meta.available() > 0 ? Meta.available() : '';
    $('#meta-line').textContent = d.runs ? `${d.runs} expedition${d.runs > 1 ? 's' : ''} · ${d.wins} survived · Knowledge ${Meta.available()}` : 'No expeditions yet';
  },
  drawTitleArt() {
    const cv = $('#title-art'), k = cv.getContext('2d'); k.imageSmoothingEnabled = false;
    const g = k.createLinearGradient(0, 0, 0, 90); g.addColorStop(0, '#05070a'); g.addColorStop(1, '#17191d');
    k.fillStyle = g; k.fillRect(0, 0, 240, 90);
    k.fillStyle = '#0b0d10'; for (let x = 0; x < 240; x += 16) k.fillRect(x, 78, 15, 12);
    const ct = foeSprite('cthulhu');
    k.globalAlpha = 0.85; k.drawImage(ct.frames[2], 160 - ct.ox, 64 - ct.oy); k.globalAlpha = 1;
    for (const e of ct.eyes[2]) { k.fillStyle = e.color; k.fillRect(160 + e.x, 64 + e.y, 1, 1); k.fillStyle = hexA(e.color, 0.35); k.fillRect(159 + e.x, 63 + e.y, 3, 3); }
    const sh = k.createRadialGradient(160, 50, 10, 160, 50, 90); sh.addColorStop(0, 'rgba(5,7,10,0.1)'); sh.addColorStop(1, 'rgba(5,7,10,0.7)'); k.fillStyle = sh; k.fillRect(60, 0, 180, 90);
    [...CLASS_ORDER].reverse().forEach((c, i) => { const s = heroSprite(c); k.drawImage(s.frames[0], 22 + i * 22 - s.ox, 70 - s.oy); });
    const lg = k.createRadialGradient(60, 66, 2, 60, 66, 70); lg.addColorStop(0, 'rgba(240,200,120,0.18)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); k.fillStyle = lg; k.fillRect(0, 0, 240, 90);
  },
  renderClasses() {
    const grid = $('#class-grid'); grid.innerHTML = ''; this.classCanvases = [];
    for (const id of CLASS_ORDER) {
      const c = CLASSES[id], card = el('div', 'ccard' + (this.sel === id ? ' sel' : ''));
      const cv = el('canvas'); const spr = heroSprite(id); cv.width = spr.w; cv.height = spr.h; spriteToCanvas(cv, spr, 0);
      card.appendChild(cv); this.classCanvases.push({ cv, spr });
      card.appendChild(el('h3', '', c.name));
      card.appendChild(el('div', '', `<span style="color:${c.color}">${c.role}</span> · ${c.hp} health · rank ${c.rank}`));
      card.appendChild(el('p', '', c.blurb));
      const counts = {}; STARTER[id].forEach(x => counts[x] = (counts[x] || 0) + 1);
      card.appendChild(el('div', 'deck', 'Starting deck: ' + Object.entries(counts).map(([k, n]) => `<b>${CARDS[k].name}</b>${n > 1 ? ' ×' + n : ''}`).join(', ')));
      if (Meta.data.winsBy[id]) card.appendChild(el('div', 'wins', `Survived ${Meta.data.winsBy[id]}×`));
      card.addEventListener('click', () => { this.sel = id; Sfx.init(); Sfx.play('click'); this.renderClasses(); });
      grid.appendChild(card);
    }
    $('#btn-start').disabled = !this.sel;
    $('#nm-wrap').classList.toggle('hidden', !Meta.data.wins);
  },
  renderRites() {
    $('#rites-kn').textContent = `Knowledge: ${Meta.available()}`;
    const list = $('#rites-list'); list.innerHTML = '';
    for (const r of RITES) {
      const k = Meta.rank(r.id), maxed = k >= r.cost.length;
      const it = el('div', 'item'), tx = el('div', 'txt');
      tx.appendChild(el('h4', '', r.name)); tx.appendChild(el('p', '', r.desc));
      const pips = el('div', 'pips'); for (let i = 0; i < r.cost.length; i++) pips.appendChild(el('div', 'pip' + (i < k ? ' on' : ''))); tx.appendChild(pips);
      it.appendChild(tx);
      const b = el('button', 'btn gold', maxed ? 'Mastered' : `${r.cost[k]} Knowledge`);
      b.disabled = maxed || Meta.available() < r.cost[k];
      b.addEventListener('click', () => { if (Meta.buy(r.id)) { Sfx.init(); Sfx.play('upgrade'); this.renderRites(); } });
      it.appendChild(b); list.appendChild(it);
    }
  },
  renderBestiary() {
    const grid = $('#beast-grid'); grid.innerHTML = '';
    for (const [id, d] of Object.entries(FOES)) {
      const seen = Meta.data.seen[id];
      const card = el('div', 'beast' + (d.boss ? ' boss' : ''));
      const cv = el('canvas');
      if (seen) { const s = foeSprite(id); cv.width = s.w; cv.height = s.h; spriteToCanvas(cv, s, 0); } else { cv.width = 8; cv.height = 8; }
      card.appendChild(cv);
      const tx = el('div');
      tx.appendChild(el('h4', '', seen ? d.name : '???'));
      tx.appendChild(el('p', '', seen ? d.desc : (d.boss ? 'Something waits at the bottom of a floor.' : 'Not yet encountered.')));
      card.appendChild(tx); grid.appendChild(card);
    }
  },

  // ---------------- run ----------------
  startRun(cls, nightmare) {
    this.g = new Game(cls, { nightmare });
    this.closeModal(); this.selCard = null; this.armedPot = null; this.lastMode = null; this.handKey = '';
    this.r.bgKey = null;
    this.show('game'); this.fitStage();
    Sfx.init(); Sfx.startDrone();
    this.banner(FLOORS[0].name, FLOORS[0].sub);
  },
  fitStage() {
    const wrap = $('#stagewrap'), st = $('#stage');
    if (!wrap.clientWidth) return;
    let k = Math.min(wrap.clientWidth / W, wrap.clientHeight / H);
    if (k >= 2 && Math.floor(k) / k > 0.85) k = Math.floor(k);
    st.style.width = Math.floor(W * k) + 'px'; st.style.height = Math.floor(H * k) + 'px';
    st.style.setProperty('--u', k + 'px');
  },
  banner(text, sub) {
    const b = $('#banner'); b.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
    b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => b.classList.add('hidden'), 2200);
  },

  // ---------------- cards ----------------
  cardText(c, target) {
    const d = CARDS[c.id], V = cardVals(c), g = this.g;
    return esc(d.text).replace(/\{(\w)\}/g, (m, k) => {
      let v = V[k];
      if (k === 'd' && d.type === 'attack' && g && g.mode === 'combat' && g.player) {
        const dummy = target || { st: {}, team: 'foe' };
        const p = g.dmgCalc(g.player, dummy, v, { noStr: false });
        if (p !== v) return `<span class="${p > v ? 'mod' : 'nerf'}">${p}</span>`;
      }
      return c.up && Array.isArray(d.vals[k]) && d.vals[k][0] !== d.vals[k][1] ? `<span class="mod">${v}</span>` : v;
    });
  },
  cardEl(c, opts = {}) {
    const d = CARDS[c.id];
    const e = el('div', `card ${d.type}`);
    const cost = d.type === 'curse' ? '' : cardCost(c);
    if (d.type !== 'curse') e.appendChild(el('div', 'cost' + (Array.isArray(d.cost) && c.up && d.cost[1] < d.cost[0] ? ' free' : ''), cost));
    if (d.rarity === 'uncommon' || d.rarity === 'rare') e.appendChild(el('div', 'gem ' + d.rarity));
    e.appendChild(el('div', 'cname' + (c.up ? ' up' : ''), esc(cardName(c))));
    const cv = el('canvas'); cv.width = 16; cv.height = 16;
    const [ic, col] = cardIcon(c); const k = cv.getContext('2d'); drawIcon(k, ic, 4, 4, '#05070a'); drawIcon(k, ic, 3, 3, col);
    e.appendChild(cv);
    e.appendChild(el('div', 'ctype', d.type + (d.target === 'front' ? ' · front' : '')));
    e.appendChild(el('div', 'ctext' + (CARDS[c.id].text.length > 54 ? ' long' : ''), this.cardText(c, opts.target)));
    if (opts.price !== undefined) e.appendChild(el('div', 'price', `◆ ${opts.price}`));
    return e;
  },
  renderHand() {
    const g = this.g, hand = $('#hand');
    const p = g.player;
    const key = g.hand.map(c => c.uid + (c.up ? '+' : '')).join(',') + '|' + g.energy + '|' + g.phase + '|' + (this.selCard ? this.selCard.uid : '') + '|' + (p.st.str || 0) + (p.st.weak || 0) + (p.st.aim || 0) + (g.deadeyeUsed ? 1 : 0) + '|' + g.steps.length;
    if (key === this.handKey) return; this.handKey = key;
    hand.innerHTML = '';
    g.hand.forEach((c, i) => {
      const e = this.cardEl(c);
      if (!g.canPlay(c)) e.classList.add('unplayable');
      if (this.selCard === c) e.classList.add('sel');
      e.addEventListener('click', ev => { ev.stopPropagation(); this.clickCard(c); });
      e.addEventListener('mouseenter', () => { if (!this.selCard) this.hoverCard = c; });
      e.addEventListener('mouseleave', () => { this.hoverCard = null; });
      e.title = `[${i + 1}]`;
      hand.appendChild(e);
    });
  },
  clickCard(c) {
    const g = this.g; if (!g || g.mode !== 'combat') return;
    this.armedPot = null;
    if (this.selCard === c) { this.selCard = null; this.handKey = ''; return; }
    if (!g.canPlay(c)) { Sfx.play('deny'); if (CARDS[c.id].type !== 'curse' && cardCost(c) > g.energy) this.flashHint('Not enough energy'); return; }
    if (!g.needsTarget(c)) { this.play(c, null); return; }
    const vt = g.validTargets(c);
    if (vt.length === 1 && CARDS[c.id].target !== 'enemy' && CARDS[c.id].target !== 'front') { this.play(c, vt[0]); return; }
    this.selCard = c; this.handKey = ''; Sfx.play('click');
  },
  play(c, target) {
    const g = this.g;
    if (g.playCard(c, target)) { this.selCard = null; this.handKey = ''; Sfx.play(CARDS[c.id].type === 'attack' ? 'swing' : 'ability', c.id); }
    else Sfx.play('deny');
  },
  endTurn() {
    const g = this.g; if (!g || g.mode !== 'combat' || g.phase !== 'player' || g.steps.length) return;
    this.selCard = null; this.armedPot = null; this.handKey = '';
    g.endTurn(); Sfx.play('door');
  },
  flashHint(t) { this.tempHint = t; this.tempHintT = 1.4; },

  // ---------------- input ----------------
  toGame(e) { const r = $('#cv').getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; },
  bindInput() {
    const cv = $('#cv');
    cv.addEventListener('pointermove', e => {
      const g = this.g; if (!g) return;
      const p = this.toGame(e);
      if (g.mode === 'map') { this.hoverNode = this.r.hitNode(g, p.x, p.y); this.hover = null; cv.style.cursor = this.hoverNode && g.reachable().includes(this.hoverNode) ? 'pointer' : 'default'; this.showNodeTip(e); }
      else if (g.mode === 'combat') { this.hover = this.r.hitUnit(g, p.x, p.y); this.hoverNode = null; this.showUnitTip(e); cv.style.cursor = this.hover ? 'pointer' : 'default'; }
    });
    cv.addEventListener('pointerleave', () => { this.hover = null; this.hoverNode = null; $('#tip').classList.add('hidden'); });
    cv.addEventListener('pointerdown', e => {
      Sfx.init();
      const g = this.g; if (!g || this.modal) return;
      const p = this.toGame(e);
      if (e.button === 2) { this.cancel(); return; }
      if (g.mode === 'map') {
        const n = this.r.hitNode(g, p.x, p.y);
        if (n && g.travel(n)) { this.hoverNode = null; $('#tip').classList.add('hidden'); Sfx.play('door'); }
        return;
      }
      if (g.mode !== 'combat') return;
      const u = this.r.hitUnit(g, p.x, p.y);
      if (this.armedPot !== null) {
        if (u && g.usePotion(this.armedPot, u)) { Sfx.play('drink'); this.armedPot = null; } else Sfx.play('deny');
        return;
      }
      if (this.selCard) {
        if (u && g.validTargets(this.selCard).includes(u)) this.play(this.selCard, u);
        else if (!u) this.cancel();
        else Sfx.play('deny');
      }
    });
    cv.addEventListener('contextmenu', e => { e.preventDefault(); this.cancel(); });
    window.addEventListener('keydown', e => {
      const g = this.g; if (!g || !$('#game').classList.contains('active')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { if (this.modal === 'pause' || this.modal === 'pile') this.closeModal(); else if (this.selCard || this.armedPot !== null) this.cancel(); else if (!this.modal) this.openPause(); return; }
      if (this.modal) return;
      if (g.mode === 'combat') {
        if (/^[1-9]$/.test(k)) { const c = g.hand[+k - 1]; if (c) this.clickCard(c); }
        if (k === 'e') this.endTurn();
      }
    });
  },
  cancel() { this.selCard = null; this.armedPot = null; this.handKey = ''; },
  tipAt(e, html) {
    const tip = $('#tip'), st = $('#stage').getBoundingClientRect();
    tip.innerHTML = html; tip.classList.remove('hidden');
    let x = e.clientX - st.left + 16, y = e.clientY - st.top + 12;
    if (x + 300 > st.width) x = e.clientX - st.left - 316;
    tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, Math.min(y, st.height - tip.offsetHeight - 4)) + 'px';
  },
  showNodeTip(e) {
    const n = this.hoverNode; if (!n) { $('#tip').classList.add('hidden'); return; }
    const g = this.g, nt = NODE_TYPES[n.type];
    let html = n.seen ? `<h4>${nt.name}</h4><div class="st">${nt.desc}</div>` : `<h4>A dark room</h4><div class="st">Your lantern doesn't reach it. Anything could be inside.</div>`;
    if (n.seen && n.visited && n.type !== 'boss') html += `<div class="st">Already explored.</div>`;
    if (g.consumed(n)) html += `<div class="int">Swallowed by the Gloam. Moving through it hurts everyone.</div>`;
    else if (!g.reachable().includes(n) && n.id !== g.map.at) html += `<div class="st">No open passage from here.</div>`;
    if (n.type === 'boss') html = `<h4>${FOES[FLOORS[this.g.floor].boss].name}</h4><div class="st">${FOES[FLOORS[this.g.floor].boss].desc}</div>`;
    this.tipAt(e, html);
  },
  showUnitTip(e) {
    const u = this.hover, g = this.g; if (!u) { $('#tip').classList.add('hidden'); return; }
    let html = `<h4>${esc(u.name)}${u.team === 'hero' ? ` <span class="dim">· ${u.c.name}</span>` : ''}</h4><div class="st">${Math.max(0, u.hp)} / ${u.maxHp} health${u.st.block ? ` · <b style="color:#9ad0ff">${u.st.block} Block</b>` : ''}</div>`;
    for (const [k, v] of Object.entries(u.st)) if (v > 0 && k !== 'block' && STATUS[k]) html += `<div class="st"><b style="color:${STATUS[k].color}">${STATUS[k].name} ${v}</b>: ${STATUS[k].desc}</div>`;
    if (u.team === 'foe') {
      if (u.d && u.d.desc) html += `<div class="st" style="margin-top:3px">${esc(u.d.desc)}</div>`;
      const it = u.intent;
      if (u.st.stun > 0) html += `<div class="int">Stunned. It will lose its next action.</div>`;
      else if (it) {
        let s = `Intends: <b>${esc(it.name)}</b>`;
        if (it.dmg) { const per = g.dmgCalc(u, it.targets[0] || g.player, it.dmg); s += `: ${per} damage${(it.hits || 1) > 1 ? ` ×${it.hits}` : ''}`; }
        if (it.all) s += ' to the whole party';
        else if (it.perHit) s += ', each at a random hero';
        else if (it.targets && it.targets.length) s += ` to ${it.targets.map(h => esc(h.name)).join(' and ')}`;
        const extra = []; if (it.vuln) extra.push(`${it.vuln} Vulnerable`); if (it.weak) extra.push(`${it.weak} Weak`); if (it.bleed) extra.push(`${it.bleed} Bleed`); if (it.block) extra.push(`gains Block`); if (it.str) extra.push(`+${it.str} Strength${it.allFoes ? ' to every horror' : ''}`); if (it.summon) extra.push('summons'); if (it.intangible) extra.push('phases out'); if (it.heal) extra.push('heals');
        if (it.kind === 'charge') extra.push('when the count ends, the bell tolls and strikes everyone. Stack Block.');
        if (extra.length) s += ` (${extra.join(', ')})`;
        html += `<div class="int">${s}.</div>`;
      }
    } else if (!u.dead) {
      const inc = g.incoming(u);
      if (inc) html += `<div class="int">Incoming: ${inc} damage${u.st.block ? ` (${Math.max(0, inc - u.st.block)} after Block)` : ''}</div>`;
      if (u.intent && !u.player) { const sk = u.intent.sk, t = u.intent.target; html += `<div class="int ally">Will use <b>${sk.name}</b>: ${esc(sk.show(g))}${t && t !== u && t.name ? ` on ${esc(t.name)}` : ''}</div>`; }
      if (u.player) html += `<div class="st">This is you. If you fall, the expedition ends.</div>`;
    } else html += `<div class="st">Fallen. Revive them with salts, the Physician, or a rest site.</div>`;
    this.tipAt(e, html);
  },

  // ---------------- HUD ----------------
  updateHud(dt) {
    const g = this.g;
    $('#tb-class').textContent = `${CLASSES[g.cls].name}${g.nightmare ? ' · Nightmare' : ''}`;
    $('#tb-floor').textContent = `${FLOORS[g.floor].name}`;
    $('#tb-gold').textContent = `◆ ${g.gold}`;
    $('#deck-n').textContent = g.deck.length;
    const pk = g.potions.join(',') + '|' + this.armedPot;
    if (pk !== this.potKey) {
      this.potKey = pk; const box = $('#potions'); box.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const id = g.potions[i], d = el('div', 'pot' + (id ? '' : ' empty') + (this.armedPot === i ? ' armed' : ''), id ? POT_GLYPH[id] : '');
        if (id) { d.title = `${POTIONS[id].name}: ${POTIONS[id].desc}`; d.style.color = { heal: '#d0503a', salts: '#f0d870', powder: '#c3c7cb', courage: '#9ad0ff', strength: '#f0d870', clarity: '#c8a0e8' }[id]; d.addEventListener('click', () => this.clickPotion(i)); }
        box.appendChild(d);
      }
    }
    const rk = g.relics.join(',');
    if (rk !== this.relicKey) {
      this.relicKey = rk; const box = $('#relics'); box.innerHTML = '';
      for (const id of g.relics) { const r = RELICS.find(x => x.id === id); const d = el('div', 'relic' + (r.boss ? ' boss' : ''), r.name.replace(/^The /, '')[0]); d.title = `${r.name}: ${r.desc}`; box.appendChild(d); }
    }
    const inCombat = g.mode === 'combat';
    $('#combatbar').classList.toggle('hidden', !inCombat);
    if (inCombat !== this.lastCombatBar) { this.lastCombatBar = inCombat; this.fitStage(); }
    if (inCombat) {
      $('#en-n').textContent = g.energy; $('#en-max').textContent = '/' + g.maxEnergy;
      $('#energy').classList.toggle('empty', g.energy === 0);
      $('#n-draw').textContent = g.drawPile.length; $('#n-disc').textContent = g.discard.length;
      const canEnd = g.phase === 'player' && !g.steps.length;
      $('#btn-end').disabled = !canEnd;
      $('#btn-end').textContent = canEnd ? 'End Turn' : g.phase === 'allies' ? 'Allies…' : 'Horrors…';
      $('#btn-end').classList.toggle('pulse', canEnd && !g.hand.some(c => g.canPlay(c)));
      this.renderHand();
    }
    // hint
    let hint = '';
    if (this.tempHintT > 0) { this.tempHintT -= dt; hint = this.tempHint; }
    else if (inCombat && this.selCard) { const t = CARDS[this.selCard.id].target; hint = t === 'ally' ? 'Choose an ally' : t === 'fallen' ? 'Choose a fallen ally' : t === 'front' ? 'Choose a front-rank horror' : 'Choose a horror'; }
    else if (inCombat && this.armedPot !== null) hint = POTIONS[g.potions[this.armedPot]] && POTIONS[g.potions[this.armedPot]].target === 'fallen' ? 'Choose a fallen ally' : 'Choose an ally';
    else if (g.mode === 'map') hint = `${FLOORS[g.floor].name}: move to a lit room`;
    $('#hint').textContent = hint; $('#hint').classList.toggle('hidden', !hint);
  },
  clickPotion(i) {
    const g = this.g, id = g.potions[i]; if (!id) return;
    if (g.mode !== 'combat' || g.phase !== 'player' || g.steps.length) { this.flashHint('Draughts can only be used on your turn in combat'); Sfx.play('deny'); return; }
    const p = POTIONS[id]; this.selCard = null; this.handKey = '';
    if (p.target === 'none') { if (g.usePotion(i)) Sfx.play('drink'); return; }
    this.armedPot = this.armedPot === i ? null : i;
  },

  handleEvents() {
    const g = this.g;
    for (const ev of g.events) {
      const d = ev.data;
      switch (ev.type) {
        case 'combat': this.r.bgKey = null; if (d === 'boss') { this.banner(FOES[FLOORS[g.floor].boss].name, FLOORS[g.floor].name); Sfx.play('boss'); } else if (d === 'elite') { this.banner('Elite'); Sfx.play('cast'); } break;
        case 'hit': if (d.hero) { this.r.shake = Math.max(this.r.shake, d.big ? 4 : 2); Sfx.play(d.blocked ? 'click' : 'hurt'); } else Sfx.play(d.big ? 'boom' : 'swing'); break;
        case 'foeAct': if (d.kind === 'summon') Sfx.play('spell'); else if (d.kind === 'charge') Sfx.play('cast'); break;
        case 'compAct': Sfx.play('ability'); break;
        case 'foeDown': Sfx.play(d.boss ? 'bossDown' : 'kill'); if (d.boss) this.r.shake = 6; break;
        case 'heroDown': Sfx.play('leak'); if (!d.player) this.banner(`${d.name} has fallen`); break;
        case 'revive': Sfx.play('upgrade'); break;
        case 'win': Sfx.play('win'); break;
        case 'floor': this.banner(FLOORS[d].name, FLOORS[d].sub); this.r.bgKey = null; break;
        case 'relic': Sfx.play('upgrade'); break;
        case 'gloam': Sfx.play('boss'); this.r.shake = 3; this.flashHint('The Gloam swallows another column of rooms'); break;
        case 'gloamHit': Sfx.play('leak'); this.banner('The Gloam takes its toll', 'Every hero loses 12% of their health'); break;
        case 'echo': this.flashHint('Black Psalter Page: played twice'); break;
        case 'shuffle': Sfx.play('click'); break;
        case 'end': setTimeout(() => this.openEnd(d), 900); break;
      }
    }
    g.events.length = 0;
  },
  syncMode() {
    const g = this.g;
    if (g.mode === this.lastMode) return;
    this.lastMode = g.mode;
    $('#tip').classList.add('hidden'); this.hover = null; this.hoverNode = null;
    if (['map', 'combat'].includes(g.mode)) { if (this.modal && this.modal !== 'pause') this.closeModal(); }
    if (g.mode === 'reward') setTimeout(() => this.g === g && g.mode === 'reward' && this.openReward(), 600);
    if (g.mode === 'event') this.openEvent();
    if (g.mode === 'rest') this.openRest();
    if (g.mode === 'shop') this.openShop();
    if (g.mode === 'treasure') this.openTreasure();
  },

  // ---------------- modals ----------------
  openModal(kind, build) { this.modal = kind; const m = $('#mbox'); m.innerHTML = ''; build(m); $('#modal').classList.remove('hidden'); m.scrollTop = 0; },
  closeModal() { $('#modal').classList.add('hidden'); this.modal = null; },
  pickCard(kind, name, desc, onClick) { const c = el('div', 'pickcard', `<div class="kind">${kind}</div><h4>${esc(name)}</h4><p>${esc(desc)}</p>`); c.addEventListener('click', onClick); return c; },
  openReward() {
    const g = this.g, R = g.reward;
    this.openModal('reward', m => {
      m.appendChild(el('h2', '', g.combatKind === 'boss' ? `${FOES[FLOORS[g.floor].boss].name} Is Vanquished` : g.combatKind === 'elite' ? 'The Elite Falls' : 'Victory'));
      m.appendChild(el('div', 'rrow done', `<span class="gold">◆ ${R.gold} gold</span><span class="dim">collected</span>`));
      if (R.potion) {
        const row = el('div', 'rrow' + (R.potionTaken ? ' done' : ''), `<span>${POT_GLYPH[R.potion]} ${POTIONS[R.potion].name}: <span class="dim">${POTIONS[R.potion].desc}</span></span>`);
        if (!R.potionTaken) { const b = el('button', 'btn small', g.potions.length >= 3 ? 'Full' : 'Take'); b.disabled = g.potions.length >= 3; b.addEventListener('click', () => { g.gainPotion(R.potion); R.potionTaken = true; this.openReward(); }); row.appendChild(b); }
        m.appendChild(row);
      }
      if (R.relic) {
        const r = RELICS.find(x => x.id === R.relic);
        const row = el('div', 'rrow' + (R.relicTaken ? ' done' : ''), `<span><span class="gold">Relic: ${esc(r.name)}</span>. <span class="dim">${esc(r.desc)}</span></span>`);
        if (!R.relicTaken) { const b = el('button', 'btn small gold', 'Take'); b.addEventListener('click', () => { g.gainRelic(R.relic); R.relicTaken = true; this.openReward(); }); row.appendChild(b); }
        m.appendChild(row);
      }
      if (R.bossRelics && !R.relicTaken) {
        m.appendChild(el('div', 'sub', 'Take one boss relic. Each is powerful, with a price.'));
        const p = el('div', 'picks');
        for (const id of R.bossRelics) { const r = RELICS.find(x => x.id === id); p.appendChild(this.pickCard('Boss relic', r.name, r.desc, () => { g.gainRelic(id); R.relicTaken = true; this.openReward(); })); }
        m.appendChild(p);
      }
      if (!R.cardTaken) {
        m.appendChild(el('div', 'sub', 'Add a card to your deck'));
        const cards = el('div', 'cards');
        for (const id of R.cards) { const ce = this.cardEl({ id, up: false }); ce.addEventListener('click', () => { g.addCard(id); R.cardTaken = true; Sfx.play('upgrade'); this.openReward(); }); cards.appendChild(ce); }
        m.appendChild(cards);
      } else m.appendChild(el('div', 'rrow done', '<span>Card chosen</span>'));
      const row = el('div', 'mrow');
      const b = el('button', 'btn big', R.cardTaken ? 'Continue' : 'Skip the card');
      b.addEventListener('click', () => { this.closeModal(); g.finishReward(); if (g.mode === 'map') this.lastMode = 'reward'; });
      row.appendChild(b); m.appendChild(row);
    });
  },
  openEvent() {
    const g = this.g, ev = g.event.ev;
    this.openModal('event', m => {
      m.appendChild(el('h2', '', esc(ev.title)));
      if (!g.event.result) {
        m.appendChild(el('div', 'story', esc(ev.text)));
        const opts = el('div', 'opts');
        for (const o of ev.options) {
          const b = el('button', 'btn opt', `${esc(o.label)}${o.desc ? `<small>${esc(o.desc)}</small>` : ''}`);
          b.addEventListener('click', () => { g.event.result = o.act(g); Sfx.play('interact'); this.openEvent(); });
          opts.appendChild(b);
        }
        m.appendChild(opts);
      } else {
        m.appendChild(el('div', 'story', esc(g.event.result)));
        const row = el('div', 'mrow'); const b = el('button', 'btn big', 'Continue');
        b.addEventListener('click', () => this.afterEvent()); row.appendChild(b); m.appendChild(row);
      }
    });
  },
  afterEvent() {
    const g = this.g;
    if (g.pendingRemove) { g.pendingRemove = false; this.openDeck('Choose a card to remove', c => { g.removeCard(c.uid); Sfx.play('leak'); this.afterEvent(); }, null, true); return; }
    if (g.pendingUpgrade) { g.pendingUpgrade = false; this.openDeck('Choose a card to upgrade', c => { g.upgradeCard(c.uid); Sfx.play('upgrade'); this.afterEvent(); }, c => !c.up && CARDS[c.id].type !== 'curse', true); return; }
    if (g.pendingDuplicate) { g.pendingDuplicate = false; this.openDeck('Choose a card to duplicate', c => { g.addCard(c.id, c.up); this.afterEvent(); }, c => CARDS[c.id].type !== 'curse', true); return; }
    this.closeModal(); g.backToMap();
  },
  openRest() {
    const g = this.g;
    this.openModal('rest', m => {
      m.appendChild(el('h2', '', 'A Fire in the Dark'));
      m.appendChild(el('div', 'story', 'The party huddles close. Somewhere above, something is listening for your voices. You have time for one thing.'));
      const p = el('div', 'picks');
      const dead = g.heroes.filter(h => h.dead).length;
      p.appendChild(this.pickCard('Rest', 'Tend Wounds', `Every hero heals 30% of their health.${dead ? ` Your ${dead} fallen companion${dead > 1 ? 's rise' : ' rises'} at 30%.` : ''}`, () => { g.restHeal(); Sfx.play('drink'); this.closeModal(); g.backToMap(); }));
      const n = g.has('pnakotic') ? 2 : 1;
      p.appendChild(this.pickCard('Study', 'Read by Firelight', `Upgrade ${n === 2 ? 'two cards' : 'a card'}.`, () => {
        let left = n;
        const go = () => this.openDeck(`Choose a card to upgrade${left > 1 ? ` (${left} left)` : ''}`, c => { g.upgradeCard(c.uid); Sfx.play('upgrade'); left--; if (left > 0 && g.deck.some(x => !x.up && CARDS[x.id].type !== 'curse')) go(); else { this.closeModal(); g.backToMap(); } }, c => !c.up && CARDS[c.id].type !== 'curse', true);
        go();
      }));
      m.appendChild(p);
      m.appendChild(el('div', 'summary', g.heroes.map(h => `${esc(h.name)} <b>${h.dead ? 'fallen' : h.hp + '/' + h.maxHp}</b>`).join(' · ')));
    });
  },
  openShop() {
    const g = this.g, S = g.shop;
    this.openModal('shop', m => {
      m.appendChild(el('h2', '', 'The Peddler'));
      m.appendChild(el('div', 'sub', `"Everything here was found. None of it was stolen." · You have <span class="gold">◆ ${g.gold}</span>`));
      const grid = el('div', 'shopgrid');
      for (const it of S.cards) {
        const ce = this.cardEl({ id: it.id, up: false }, { price: it.price });
        if (it.sold) ce.classList.add('sold'); else if (g.gold < it.price) ce.classList.add('unplayable');
        ce.addEventListener('click', () => { if (g.buy(it, 'card')) { Sfx.play('buy'); this.openShop(); } else Sfx.play('deny'); });
        grid.appendChild(ce);
      }
      m.appendChild(grid);
      const side = el('div', 'shopside');
      for (const it of S.relics) { const r = RELICS.find(x => x.id === it.id); const pc = this.pickCard(`Relic · ◆ ${it.price}`, r.name, r.desc, () => { if (g.buy(it, 'relic')) { Sfx.play('buy'); this.openShop(); } else Sfx.play('deny'); }); if (it.sold) pc.style.opacity = .25; side.appendChild(pc); }
      for (const it of S.potions) { const p = POTIONS[it.id]; const pc = this.pickCard(`Draught · ◆ ${it.price}`, p.name, p.desc, () => { if (g.buy(it, 'potion')) { Sfx.play('buy'); this.openShop(); } else Sfx.play('deny'); }); if (it.sold) pc.style.opacity = .25; side.appendChild(pc); }
      const rm = this.pickCard(`Service · ◆ ${S.removePrice}`, 'Forget a Card', 'Remove a card from your deck. Once per visit.', () => {
        if (S.removed || g.gold < S.removePrice) { Sfx.play('deny'); return; }
        this.openDeck('Choose a card to remove', c => { g.gold -= S.removePrice; g.shopRemovals++; S.removed = true; g.removeCard(c.uid); Sfx.play('buy'); this.openShop(); }, null, true, () => this.openShop());
      });
      if (S.removed) rm.style.opacity = .25;
      side.appendChild(rm);
      m.appendChild(side);
      const row = el('div', 'mrow'); const b = el('button', 'btn big', 'Leave'); b.addEventListener('click', () => { this.closeModal(); g.backToMap(); }); row.appendChild(b); m.appendChild(row);
    });
  },
  openTreasure() {
    const g = this.g, T = g.treasure;
    this.openModal('treasure', m => {
      m.appendChild(el('h2', '', 'A Rusted Chest'));
      const r = T.relic && RELICS.find(x => x.id === T.relic);
      m.appendChild(el('div', 'story', `Inside: <span class="gold">◆ ${T.gold} gold</span>${r ? ` and <span class="gold">${esc(r.name)}</span>. <span class="dim">${esc(r.desc)}</span>` : '.'}`));
      const row = el('div', 'mrow'); const b = el('button', 'btn big gold', 'Take it');
      b.addEventListener('click', () => { g.gold += T.gold; if (T.relic) g.gainRelic(T.relic); this.closeModal(); g.backToMap(); });
      row.appendChild(b); m.appendChild(row);
    });
  },
  openDeck(title, onPick, filter, mustPick, onCancel) {
    const g = this.g;
    const prevModal = this.modal;
    this.openModal(onPick ? 'pick' : 'pile', m => {
      m.appendChild(el('h2', '', esc(title)));
      const grid = el('div', 'deckgrid');
      const cards = g.deck.slice().sort((a, b) => (CARDS[a.id].type + CARDS[a.id].name).localeCompare(CARDS[b.id].type + CARDS[b.id].name));
      for (const c of cards) {
        if (filter && !filter(c)) continue;
        const show = onPick && /upgrade/i.test(title) ? { ...c, up: true } : c;
        const ce = this.cardEl(show);
        if (onPick) ce.addEventListener('click', () => onPick(c));
        grid.appendChild(ce);
      }
      m.appendChild(grid);
      const row = el('div', 'mrow');
      if (!mustPick || onCancel) { const b = el('button', 'btn', onPick ? 'Cancel' : 'Close'); b.addEventListener('click', () => { if (onCancel) onCancel(); else { this.closeModal(); if (prevModal && prevModal !== 'pile' && prevModal !== 'pick') this.reopen(prevModal); } }); row.appendChild(b); }
      m.appendChild(row);
    });
  },
  openPile(title, list) {
    const prev = this.modal;
    this.openModal('pile', m => {
      m.appendChild(el('h2', '', esc(title)));
      const grid = el('div', 'deckgrid'); for (const c of list) grid.appendChild(this.cardEl(c)); m.appendChild(grid);
      if (!list.length) m.appendChild(el('div', 'sub', 'Empty.'));
      const row = el('div', 'mrow'); const b = el('button', 'btn', 'Close'); b.addEventListener('click', () => { this.closeModal(); if (prev && prev !== 'pile') this.reopen(prev); }); row.appendChild(b); m.appendChild(row);
    });
  },
  reopen(kind) { ({ reward: () => this.openReward(), event: () => this.openEvent(), rest: () => this.openRest(), shop: () => this.openShop(), treasure: () => this.openTreasure() }[kind] || (() => {}))(); },
  openPause() {
    const g = this.g, prev = this.modal;
    this.openModal('pause', m => {
      m.appendChild(el('h2', '', 'Paused'));
      const s = g.stats;
      m.appendChild(el('div', 'summary', `Fights won <b>${s.fights}</b> · Elites <b>${s.elites}</b> · Damage dealt <b>${s.dmg}</b> · Healing <b>${s.healed}</b>`));
      if (g.relics.length) m.appendChild(el('div', 'summary', 'Relics: ' + g.relics.map(id => `<b>${esc(RELICS.find(r => r.id === id).name)}</b>`).join(', ')));
      const opt = el('div', 'mrow');
      const fast = el('label', 'toggle', `<input type="checkbox" ${Meta.data.settings.fast ? 'checked' : ''}> Fast animations`);
      fast.querySelector('input').addEventListener('change', e => { Meta.data.settings.fast = e.target.checked; Meta.write(); });
      opt.appendChild(fast); m.appendChild(opt);
      const row = el('div', 'mrow');
      const r = el('button', 'btn', 'Resume'); r.addEventListener('click', () => { this.closeModal(); if (prev && prev !== 'pause') this.reopen(prev); });
      const q = el('button', 'btn red', 'Abandon Expedition'); q.addEventListener('click', () => { if (confirm('Abandon this expedition?')) { this.closeModal(); g.end('lose'); } });
      row.appendChild(r); row.appendChild(q); m.appendChild(row);
    });
  },
  openEnd(result) {
    const g = this.g;
    Sfx.stopDrone(); Sfx.play(result === 'win' ? 'win' : 'lose');
    this.openModal('end', m => {
      m.appendChild(el('h2', '', result === 'win' ? 'The Stars Go Dark Again' : 'The Expedition Is Lost'));
      m.appendChild(el('div', 'story', result === 'win' ? 'The Drowned God sinks back into the black water. Your party climbs into a grey dawn over Brinehollow, and none of you speak of it again.' : `You fell in ${FLOORS[g.floor].name}. The dark keeps what it takes.`));
      const s = g.stats;
      m.appendChild(el('div', 'summary', `Floor <b>${g.floor + 1}</b> · Fights won <b>${s.fights}</b> · Elites <b>${s.elites}</b> · Bosses <b>${s.bosses}</b><br>Cards played <b>${s.cards}</b> · Damage <b>${s.dmg}</b> · Healing <b>${s.healed}</b> · Deck <b>${g.deck.length}</b>`));
      m.appendChild(el('h2', '', `+${g.knowledge} Forbidden Knowledge`));
      const row = el('div', 'mrow');
      const a = el('button', 'btn big', 'New Expedition'); a.addEventListener('click', () => { this.closeModal(); this.g = null; this.show('classsel'); });
      const b = el('button', 'btn', 'Forbidden Rites'); b.addEventListener('click', () => { this.closeModal(); this.g = null; this.show('rites'); });
      const c = el('button', 'btn', 'Title'); c.addEventListener('click', () => { this.closeModal(); this.g = null; this.show('title'); });
      row.appendChild(a); row.appendChild(b); row.appendChild(c); m.appendChild(row);
    });
  },

  // ---------------- loop ----------------
  loop(now) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
    const g = this.g;
    if (g && $('#game').classList.contains('active')) {
      g.tick(dt * (Meta.data.settings.fast ? 2 : 1));
      this.handleEvents();
      if (this.g === g) {
        this.syncMode();
        this.r.draw(g, this, dt);
        this.updateHud(dt);
      }
    } else if ($('#classsel').classList.contains('active') && this.classCanvases) {
      this.animT = (this.animT || 0) + dt * 10;
      for (const { cv, spr } of this.classCanvases) spriteToCanvas(cv, spr, frameOf(spr, this.animT));
    }
    requestAnimationFrame(t => this.loop(t));
  },
};

window.addEventListener('DOMContentLoaded', () => UI.init());
