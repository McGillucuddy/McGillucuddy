// ============================================================
//  ELDRITCH DESCENT — UI / controller
// ============================================================
'use strict';

const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function spriteToCanvas(cv, spr, fi = 0, face = 1, crop) {
  const k = cv.getContext('2d'); k.imageSmoothingEnabled = false; k.clearRect(0, 0, cv.width, cv.height);
  const img = spr.frames[fi];
  k.save();
  if (crop) { // portrait: head and shoulders
    const s = cv.width / crop.w;
    k.scale(s, s); k.translate(-crop.x, -crop.y);
  } else {
    const s = Math.min(cv.width / spr.w, cv.height / spr.h);
    k.translate((cv.width - spr.w * s) / 2, (cv.height - spr.h * s) / 2); k.scale(s, s);
  }
  if (face < 0) { k.translate(spr.w, 0); k.scale(-1, 1); }
  k.drawImage(img, 0, 0);
  k.restore();
}

const UI = {
  g: null, r: null, acc: 0, last: 0, sel: null, modalOpen: null, touch: false, showReticle: true, showAggro: true,

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
    k.globalAlpha = 0.85; k.drawImage(ct.frames[2], 150 - ct.ox, 64 - ct.oy); k.globalAlpha = 1;
    for (const e of ct.eyes[2]) { k.fillStyle = e.color; k.fillRect(150 + e.x, 64 + e.y, 1, 1); k.fillStyle = hexA(e.color, 0.35); k.fillRect(149 + e.x, 63 + e.y, 3, 3); }
    const sh = k.createRadialGradient(150, 50, 10, 150, 50, 90); sh.addColorStop(0, 'rgba(5,7,10,0.1)'); sh.addColorStop(1, 'rgba(5,7,10,0.7)'); k.fillStyle = sh; k.fillRect(60, 0, 180, 90);
    CLASS_ORDER.forEach((c, i) => { const s = heroSprite(c); k.drawImage(s.frames[0], 24 + i * 24 - s.ox, 70 - s.oy); });
    const lg = k.createRadialGradient(60, 66, 2, 60, 66, 70); lg.addColorStop(0, 'rgba(240,200,120,0.18)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); k.fillStyle = lg; k.fillRect(0, 0, 240, 90);
  },

  // ---------------- class select ----------------
  renderClasses() {
    const grid = $('#class-grid'); grid.innerHTML = '';
    this.classCanvases = [];
    for (const id of CLASS_ORDER) {
      const c = CLASSES[id], card = el('div', 'ccard' + (this.sel === id ? ' sel' : ''));
      const cv = el('canvas'); const spr = heroSprite(id); cv.width = spr.w; cv.height = spr.h;
      spriteToCanvas(cv, spr, 0); card.appendChild(cv); this.classCanvases.push({ cv, spr });
      card.appendChild(el('h3', '', c.name));
      card.appendChild(el('div', 'role', `<span style="color:${c.roleColor}">${c.role}</span> · ${c.hp} health`));
      card.appendChild(el('p', '', c.blurb));
      const ul = el('ul');
      ul.appendChild(el('li', '', `<b>Click</b> ${c.basic.name}`));
      c.abilities.forEach((a, i) => ul.appendChild(el('li', '', `<b>${i + 1}</b> ${a.name}: <span class="dim">${a.desc}</span>`)));
      card.appendChild(ul);
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
      if (id === 'mask') continue;
      const seen = Meta.data.seen[id];
      const card = el('div', 'beast' + (d.boss ? ' boss' : ''));
      const cv = el('canvas');
      if (seen) { const s = foeSprite(id); cv.width = s.w; cv.height = s.h; spriteToCanvas(cv, s, 0); }
      else { cv.width = 24; cv.height = 24; const k = cv.getContext('2d'); k.fillStyle = '#3c4146'; pxText(k, '?', 12, 10, '#3c4146', null, 1); }
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
    this.modalOpen = null; $('#modal').classList.add('hidden');
    $('#chat').innerHTML = '';
    this.buildParty(); this.buildActionBar();
    this.show('game');
    this.fitStage();
    Sfx.init(); Sfx.startDrone();
    this.banner(FLOORS[0].name, FLOORS[0].sub);
    this.sysChat(`Your party: ${this.g.heroes.map(h => `${h.name} (${h.c.name})`).join(', ')}.`);
    this.g.heroes.filter(h => !h.player).forEach((h, i) => setTimeout(() => this.g && this.g.chat(h, pick(CHATTER.start[h.cls] || ['Ready.'])), 400 + i * 700));
  },
  fitStage() {
    const wrap = $('#stagewrap'), st = $('#stage');
    if (!wrap.clientWidth) return;
    const fw = wrap.clientWidth / W, fh = wrap.clientHeight / H;
    let k = Math.min(fw, fh);
    if (k >= 2 && Math.floor(k) / k > 0.85) k = Math.floor(k);
    st.style.width = Math.floor(W * k) + 'px'; st.style.height = Math.floor(H * k) + 'px';
    st.style.setProperty('--u', k + 'px');
    this.scale = k;
  },
  buildParty() {
    const p = $('#party'); p.innerHTML = ''; this.pfs = [];
    for (const h of this.g.heroes) {
      const f = el('div', 'pf' + (h.player ? ' me' : ''));
      f.appendChild(el('div', 'rolebar')).style.background = h.c.roleColor;
      const cv = el('canvas'); cv.width = 16; cv.height = 16;
      const spr = heroSprite(h.cls); spriteToCanvas(cv, spr, 0, 1, { x: spr.ox - 8, y: spr.oy - 15, w: 16 });
      f.appendChild(cv);
      f.appendChild(el('div', 'pf-name', `${esc(h.name)} <small>${h.c.name}</small>`));
      const hb = el('div', 'hpbar', '<div></div><div class="sh"></div><span></span>'); f.appendChild(hb);
      const ag = el('div', 'aggro'); f.appendChild(ag);
      p.appendChild(f);
      this.pfs.push({ h, f, hp: hb.children[0], sh: hb.children[1], txt: hb.children[2], ag, key: '' });
    }
  },
  buildActionBar() {
    const bar = $('#actionbar'); bar.innerHTML = ''; this.slots = [];
    const p = this.g.player, c = p.c;
    const mk = (key, name, cdKey, desc, fn) => {
      const s = el('div', 'slot', `<span class="k">${key}</span><div class="nm">${name}</div><div class="cdv"></div><div class="cdt"></div>`);
      s.title = `${name}: ${desc}`;
      if (fn) s.addEventListener('mousedown', e => { e.preventDefault(); fn(); });
      bar.appendChild(s);
      this.slots.push({ s, cdKey, cdv: s.querySelector('.cdv'), cdt: s.querySelector('.cdt'), nm: s.querySelector('.nm') });
    };
    mk('LMB', c.basic.name, 'basic', c.basic.desc);
    c.abilities.forEach((a, i) => mk(String(i + 1), a.name, 'a' + i, a.desc, () => this.ability(i)));
    mk('SPC', 'Dodge', 'dodge', 'Roll and become briefly untouchable.', () => this.doDodge());
    mk('F', 'Draught', 'draught', 'Drink a Healing Draught (heals 50%).', () => this.g.drinkDraught(this.g.player));
    // touch buttons mirror the action bar
    const tb = $('#tbtns'); tb.innerHTML = ''; this.tbtns = [];
    const tmk = (label, cdKey, fn) => { const b = el('button', '', label); b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); }); tb.appendChild(b); this.tbtns.push({ b, cdKey }); };
    c.abilities.forEach((a, i) => tmk(a.name.split(' ').slice(-1)[0], 'a' + i, () => this.ability(i)));
    tmk('Dodge', 'dodge', () => this.doDodge());
    tmk('Drink', 'draught', () => this.g.drinkDraught(this.g.player));
    tmk('Use', null, () => this.interact());
  },
  aimPoint(i) {
    const g = this.g, p = g.player;
    if (g.input.autoAim) {
      const ab = i !== undefined ? p.c.abilities[i].id : null;
      if (ab === 'sanct' || ab === 'wall' || ab === 'taunt' || ab === 'salts') return { x: p.x, y: p.y };
      if (ab === 'mend') return { x: -999, y: -999 };
      const f = g.nearestFoe(p.x, p.y, 300); return f ? { x: f.x, y: f.y } : { x: p.x + p.face * 40, y: p.y };
    }
    return { x: g.input.mx, y: g.input.my };
  },
  ability(i) { const g = this.g; if (!g || g.paused || g.over) return; const a = this.aimPoint(i); if (!g.useAbility(g.player, i, a.x, a.y)) Sfx.play('deny'); },
  doDodge() { const g = this.g; if (!g || g.paused) return; const m = g.player.lastMove || { x: 0, y: 0 }; g.dodge(g.player, m.x, m.y); },
  interact() {
    const g = this.g; if (!g || g.paused || !g.cleared) return;
    const p = g.player, prop = g.props.find(o => dist2(o.x, o.y, p.x, p.y) < 30 * 30);
    if (prop) g.interact(prop);
  },

  // ---------------- input ----------------
  toGame(e) { const r = $('#cv').getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; },
  bindInput() {
    const cv = $('#cv');
    window.addEventListener('keydown', e => {
      if (!this.g || !$('#game').classList.contains('active')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { e.preventDefault(); if (this.modalOpen === 'pause') this.closeModal(); else if (!this.modalOpen) this.openPause(); return; }
      if (this.modalOpen) return;
      this.g.input.keys[k] = true;
      if (k === '1' || k === '2' || k === '3') this.ability(+k - 1);
      else if (k === ' ') { e.preventDefault(); this.doDodge(); }
      else if (k === 'f') this.g.drinkDraught(this.g.player);
      else if (k === 'e') this.interact();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { if (this.g) this.g.input.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { if (this.g) { this.g.input.keys = {}; this.g.input.lmb = false; } });
    cv.addEventListener('pointermove', e => { if (!this.g || e.pointerType === 'touch') return; const p = this.toGame(e); this.g.input.mx = p.x; this.g.input.my = p.y; });
    cv.addEventListener('pointerdown', e => {
      Sfx.init();
      if (!this.g) return;
      if (e.pointerType === 'touch') { this.enableTouch(); return; }
      if (e.button === 0) { const p = this.toGame(e); this.g.input.mx = p.x; this.g.input.my = p.y; this.g.input.lmb = true; }
    });
    window.addEventListener('pointerup', e => { if (this.g && e.button === 0 && e.pointerType !== 'touch') this.g.input.lmb = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    // joystick
    const joy = $('#joy'), knob = $('#joy-knob');
    let jid = null, jc = null;
    const jmove = e => { if (e.pointerId !== jid) return; const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; let dx = e.clientX - jc.x, dy = e.clientY - jc.y; const l = Math.hypot(dx, dy), m = r.width / 2; if (l > m) { dx *= m / l; dy *= m / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; if (this.g) this.g.input.joy = { x: dx / m, y: dy / m }; };
    joy.addEventListener('pointerdown', e => { e.preventDefault(); jid = e.pointerId; joy.setPointerCapture(jid); jmove(e); });
    joy.addEventListener('pointermove', jmove);
    const jend = e => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; if (this.g) this.g.input.joy = null; };
    joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
    window.addEventListener('touchstart', () => this.enableTouch(), { once: true, passive: true });
  },
  enableTouch() {
    if (this.touch) return;
    this.touch = true; this.showReticle = false;
    $('#touch').classList.remove('hidden');
    if (this.g) this.g.input.autoAim = true;
  },

  // ---------------- HUD ----------------
  sysChat(text, cls = 'sys') { const c = $('#chat'); const ln = el('div', 'ln ' + cls, esc(text)); c.appendChild(ln); while (c.children.length > 30) c.firstChild.remove(); },
  heroChat(line) {
    const c = $('#chat'); const ln = el('div', 'ln', `<span class="who" style="color:${line.color}">[${esc(line.name)}]</span> ${esc(line.text)}`);
    c.appendChild(ln); while (c.children.length > 30) c.firstChild.remove();
  },
  banner(text, sub, warn) {
    const b = $('#banner'); b.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
    b.className = warn ? 'warn' : ''; b.classList.remove('hidden');
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => b.classList.add('hidden'), warn ? 3200 : 2400);
  },
  updateHud() {
    const g = this.g;
    for (const pf of this.pfs) {
      const h = pf.h, k = h.hp / h.maxHp;
      const targetedBy = g.foes.filter(f => f.target === h).length;
      const key = `${Math.round(h.hp)}/${h.maxHp}/${h.downed}/${Math.round(h.buffs.shield)}/${targetedBy}`;
      if (key === pf.key) continue; pf.key = key;
      pf.hp.style.width = (k * 100) + '%';
      pf.hp.style.background = k > 0.5 ? '#3f7f62' : k > 0.25 ? '#a0703c' : '#9a2a24';
      pf.sh.style.width = Math.min(100, h.buffs.shield / h.maxHp * 100) + '%';
      pf.sh.style.height = '100%';
      pf.txt.textContent = h.downed ? 'FALLEN' : `${Math.ceil(h.hp)} / ${h.maxHp}`;
      pf.f.classList.toggle('downed', h.downed);
      pf.ag.textContent = targetedBy ? '!'.repeat(Math.min(3, targetedBy)) : '';
      pf.ag.title = targetedBy ? `${targetedBy} horror(s) attacking` : '';
    }
    $('#ri-floor').textContent = `${FLOORS[g.floor].name} · Room ${g.roomIdx + 1}/${FLOORS[g.floor].rooms}`;
    $('#ri-gold').textContent = `◆ ${g.gold} gold`;
    $('#ri-draught').textContent = `✚ ${g.draughts}`;
    $('#ri-level').textContent = `Lv ${g.level}`;
    $('#ri-xp').style.width = (g.xp / g.xpNeed() * 100) + '%';
    const rk = g.relics.join(',');
    if (rk !== this.relicKey) {
      this.relicKey = rk; const box = $('#relics'); box.innerHTML = '';
      for (const id of g.relics) { const r = RELICS.find(x => x.id === id); const d = el('div', 'relic', r.name[0]); d.title = `${r.name}: ${r.desc}`; box.appendChild(d); }
    }
    // action bar
    const p = g.player;
    for (const s of this.slots) {
      let cd = 0, max = 1;
      if (s.cdKey === 'draught') { cd = p.cd.draught; max = 1; s.nm.textContent = `Draught ×${g.draughts}`; }
      else { cd = p.cd[s.cdKey]; max = s.cdKey === 'dodge' ? 2.4 * p.mods.dodgeCd : g.cdOf(p, s.cdKey); }
      const k = cd > 0 ? cd / max : 0;
      s.cdv.style.setProperty('--p', (k * 100) + '%');
      s.cdt.textContent = cd > 0.6 && s.cdKey !== 'basic' ? Math.ceil(cd) : '';
      s.s.classList.toggle('ready', cd <= 0 && (s.cdKey !== 'draught' || g.draughts > 0));
    }
    if (this.touch) for (const t of this.tbtns) if (t.cdKey) t.b.classList.toggle('cd', p.cd[t.cdKey] > 0 || (t.cdKey === 'draught' && !g.draughts));
    // boss frame
    const b = g.boss;
    $('#bossframe').classList.toggle('hidden', !b);
    if (b) {
      $('#bf-name').textContent = b.d.name;
      $('#bf-hp').style.width = (b.hp / b.maxHp * 100) + '%';
      $('#bf-cast').classList.toggle('hidden', !b.cast);
      if (b.cast) { $('#bf-castfill').style.width = Math.min(100, b.cast.t / b.cast.dur * 100) + '%'; b.cast.t += 0; $('#bf-castname').textContent = b.cast.name; }
    }
    // prompt
    let prompt = '';
    if (!p.downed) {
      const dn = g.heroes.find(h => h.downed && dist2(h.x, h.y, p.x, p.y) < 24 * 24);
      const prop = g.cleared && g.props.find(o => dist2(o.x, o.y, p.x, p.y) < 30 * 30 && (!o.used || o.kind === 'merchant'));
      if (dn) prompt = `Hold E — revive ${dn.name}`;
      else if (prop) prompt = { altar: 'E — Pray at the Elder Sign', chest: 'E — Open the chest', campfire: 'E — Rest by the fire', merchant: 'E — Trade with the Antiquarian' }[prop.kind];
      else if (g.cleared && g.doors.length && !g.pending.length && g.roomTime > 0) prompt = 'Walk through a door to choose your path';
      else if (g.cleared && g.stairs && !g.pending.length) prompt = 'Take the stairs down';
    } else prompt = 'You have fallen — your companions may still save you';
    const pr = $('#prompt'); pr.textContent = prompt; pr.classList.toggle('hidden', !prompt);
  },

  handleEvents() {
    const g = this.g;
    for (const ev of g.events) {
      const d = ev.data;
      switch (ev.type) {
        case 'chat': if (d.name) this.heroChat(d); else this.sysChat(d.text); break;
        case 'room':
          if (d.type === 'boss') { this.banner(FOES[FLOORS[d.floor].boss].name, FLOORS[d.floor].name); Sfx.play('boss'); }
          else if (d.room > 0) this.sysChat(`You enter: ${ROOM_TYPES[d.type].name}.`);
          break;
        case 'floor': this.banner(FLOORS[d].name, FLOORS[d].sub); this.sysChat(`The party descends to ${FLOORS[d].name}.`); break;
        case 'cleared': this.sysChat('The room falls silent.'); Sfx.play('win'); break;
        case 'level': this.banner(`Level ${d}`); Sfx.play('upgrade'); this.sysChat(`The party reaches level ${d}.`, 'loot'); break;
        case 'boss': break;
        case 'bossYell': this.banner(d, null, true); this.heroChat({ name: g.boss ? g.boss.d.name : 'Horror', color: '#d0503a', text: d }); break;
        case 'dream': Sfx.play('spell'); break;
        case 'downed':
          this.sysChat(`${d.name} has fallen!`); Sfx.play('leak');
          if (d.player) this.banner('You have fallen', 'Hold on. They may still reach you.', true);
          break;
        case 'revived': if (d.player) this.banner('You rise again'); break;
        case 'relic': { const r = RELICS.find(x => x.id === d); this.sysChat(`Relic obtained: ${r.name}.`, 'loot'); break; }
        case 'boon': { const b = BOONS.find(x => x.id === d); this.sysChat(`Boon: ${b.name}.`, 'loot'); break; }
        case 'hurt': if (d.player) this.r.shake = Math.max(this.r.shake, Math.min(3, d.d / 12)); Sfx.play('hurt'); break;
        case 'boom': this.r.shake = Math.max(this.r.shake, 3); Sfx.play('boom'); break;
        case 'bossDown': this.r.shake = 6; Sfx.play('bossDown'); this.banner(`${FOES[d].name} is vanquished`); break;
        case 'end': this.showEnd(d); break;
        default: Sfx.play(ev.type, d);
      }
    }
    g.events.length = 0;
    if (!this.modalOpen && g.pending.length && !g.over) this.openChoice(g.pending[0]);
  },

  // ---------------- modals ----------------
  openModal(kind, build) {
    this.modalOpen = kind; this.g.paused = true;
    if (this.g.input) { this.g.input.lmb = false; this.g.input.keys = {}; }
    const m = $('#mbox'); m.innerHTML = ''; build(m);
    $('#modal').classList.remove('hidden');
  },
  closeModal() {
    $('#modal').classList.add('hidden'); this.modalOpen = null;
    if (this.g && !this.g.over) this.g.paused = false;
  },
  resolvePending() { this.g.pending.shift(); this.closeModal(); },
  card(kind, name, desc, extra, cls) { const c = el('div', 'card ' + (cls || ''), `<div class="kind">${kind}</div><h4>${esc(name)}</h4><p>${esc(desc)}</p>${extra || ''}`); return c; },
  openChoice(pend) {
    const g = this.g;
    if (pend.kind === 'boon') this.openModal('boon', m => {
      m.appendChild(el('h2', '', esc(pend.title))); m.appendChild(el('div', 'sub', 'Choose a boon'));
      const cards = el('div', 'cards');
      for (const id of pend.options) {
        const b = BOONS.find(x => x.id === id), n = g.boonCounts[id] || 0;
        const c = this.card(b.cls ? CLASSES[b.cls].name : 'Boon', b.name, b.desc, n ? `<div class="stack">Owned ×${n}</div>` : '', b.cls ? 'cls' : '');
        c.addEventListener('click', () => { g.takeBoon(id); Sfx.play('upgrade'); this.resolvePending(); });
        cards.appendChild(c);
      }
      m.appendChild(cards);
      const row = el('div', 'mrow');
      if (g.rerolls > 0) { const rr = el('button', 'btn small', `Reroll (${g.rerolls})`); rr.addEventListener('click', () => { g.rerolls--; pend.options = g.boonOptions(3); this.modalOpen = null; this.openChoice(pend); }); row.appendChild(rr); }
      m.appendChild(row);
    });
    else if (pend.kind === 'relic') this.openModal('relic', m => {
      m.appendChild(el('h2', '', esc(pend.title))); m.appendChild(el('div', 'sub', 'Take one relic'));
      const cards = el('div', 'cards');
      for (const id of pend.options) {
        const r = RELICS.find(x => x.id === id);
        const c = this.card('Relic', r.name, r.desc, '', 'relic-c');
        c.addEventListener('click', () => { g.grantRelic(id); Sfx.play('upgrade'); this.resolvePending(); });
        cards.appendChild(c);
      }
      m.appendChild(cards);
      if (!pend.options.length) m.appendChild(el('p', 'dim', 'There is nothing left you do not already carry.'));
      const row = el('div', 'mrow'); const sk = el('button', 'btn small', pend.options.length ? 'Leave it' : 'Continue'); sk.addEventListener('click', () => this.resolvePending()); row.appendChild(sk); m.appendChild(row);
    });
    else if (pend.kind === 'rest') this.openModal('rest', m => {
      m.appendChild(el('h2', '', esc(pend.title))); m.appendChild(el('div', 'sub', 'You have time for one thing'));
      const cards = el('div', 'cards');
      const a = this.card('Rest', 'Tend Wounds', 'Heal the whole party for 60% and raise the fallen.');
      a.addEventListener('click', () => { g.restHeal(); Sfx.play('drink'); this.resolvePending(); });
      const b = this.card('Rest', 'Meditate', 'Steady your mind. Choose a boon.');
      b.addEventListener('click', () => { g.pending[0] = { kind: 'boon', options: g.boonOptions(3), title: 'Meditation' }; this.modalOpen = null; this.openChoice(g.pending[0]); });
      cards.appendChild(a); cards.appendChild(b); m.appendChild(cards);
    });
    else if (pend.kind === 'merchant') this.openModal('merchant', m => this.buildShop(m, pend));
  },
  buildShop(m, pend) {
    const g = this.g;
    m.innerHTML = '';
    m.appendChild(el('h2', '', 'The Antiquarian')); m.appendChild(el('div', 'sub', `"Everything here was found. None of it was stolen." · You have ${g.gold} gold`));
    const shop = el('div', 'shop');
    for (const it of pend.prop.stock) {
      let name, desc;
      if (it.kind === 'draught') { name = 'Healing Draught'; desc = 'Press F to heal yourself for 50%.'; }
      else if (it.kind === 'heal') { name = 'Laudanum for Everyone'; desc = 'Heal the party for 50% and raise the fallen.'; }
      else if (it.kind === 'boon') { const b = BOONS.find(x => x.id === it.id); name = b.name; desc = b.desc; }
      else { const r = RELICS.find(x => x.id === it.id); name = 'Relic: ' + r.name; desc = r.desc; }
      const row = el('div', 'item', `<div class="txt"><h4>${esc(name)}</h4><p>${esc(desc)}</p></div>`);
      const b = el('button', 'btn gold small', it.sold ? 'Sold' : `${it.price} gold`);
      b.disabled = it.sold || g.gold < it.price || (it.kind !== 'draught' && it.kind !== 'heal' && it.sold);
      b.addEventListener('click', () => { if (g.buy(it)) { Sfx.play('upgrade'); if (it.kind === 'draught' || it.kind === 'heal') { it.sold = false; it.price = Math.round(it.price * 1.4); } this.buildShop(m, pend); } else Sfx.play('deny'); });
      row.appendChild(b); shop.appendChild(row);
    }
    m.appendChild(shop);
    const r = el('div', 'mrow'); const lv = el('button', 'btn', 'Leave'); lv.addEventListener('click', () => this.resolvePending()); r.appendChild(lv); m.appendChild(r);
  },
  openPause() {
    const g = this.g;
    this.openModal('pause', m => {
      m.appendChild(el('h2', '', 'Paused'));
      const s = g.stats;
      m.appendChild(el('div', 'summary', `Level <b>${g.level}</b> · Horrors slain <b>${s.kills}</b> · Damage <b>${Math.round(s.dmg)}</b> · Healing <b>${Math.round(s.healed)}</b>`));
      if (g.relics.length) m.appendChild(el('div', 'summary', 'Relics: ' + g.relics.map(id => RELICS.find(r => r.id === id).name).join(', ')));
      const boons = Object.entries(g.boonCounts).map(([id, n]) => BOONS.find(b => b.id === id).name + (n > 1 ? ` ×${n}` : ''));
      if (boons.length) m.appendChild(el('div', 'summary', 'Boons: ' + boons.join(', ')));
      const opt = el('div', 'mrow');
      const aa = el('label', 'toggle', `<input type="checkbox" ${Meta.data.settings.autoAttack ? 'checked' : ''}> Auto-attack`);
      aa.querySelector('input').addEventListener('change', e => { Meta.data.settings.autoAttack = e.target.checked; Meta.write(); });
      opt.appendChild(aa);
      const ag = el('label', 'toggle', `<input type="checkbox" ${this.showAggro ? 'checked' : ''}> Show loose aggro markers`);
      ag.querySelector('input').addEventListener('change', e => { this.showAggro = e.target.checked; });
      opt.appendChild(ag);
      m.appendChild(opt);
      const row = el('div', 'mrow');
      const r = el('button', 'btn', 'Resume'); r.addEventListener('click', () => this.closeModal());
      const q = el('button', 'btn red', 'Abandon Expedition'); q.addEventListener('click', () => { this.closeModal(); g.end('lose'); });
      row.appendChild(r); row.appendChild(q); m.appendChild(row);
    });
  },
  showEnd(result) {
    const g = this.g;
    Sfx.stopDrone(); Sfx.play(result === 'win' ? 'win' : 'lose');
    setTimeout(() => this.openModal('end', m => {
      m.appendChild(el('h2', '', result === 'win' ? 'The Stars Go Dark Again' : 'The Expedition Is Lost'));
      m.appendChild(el('div', 'sub', result === 'win' ? 'Great Cthulhu sinks back into the black water. Your party climbs into a grey dawn.' : `The dark of ${FLOORS[g.floor].name} closes over your party.`));
      const s = g.stats;
      m.appendChild(el('div', 'summary', `Reached <b>${FLOORS[g.floor].name}, room ${g.roomIdx + 1}</b> · Level <b>${g.level}</b><br>Horrors slain <b>${s.kills}</b> · Rooms cleared <b>${s.rooms}</b> · Bosses <b>${s.bosses}</b><br>Damage <b>${Math.round(s.dmg)}</b> · Healing <b>${Math.round(s.healed)}</b>`));
      m.appendChild(el('h2', '', `+${g.knowledge} Forbidden Knowledge`));
      const row = el('div', 'mrow');
      const a = el('button', 'btn big', 'New Expedition'); a.addEventListener('click', () => { this.closeModal(); this.g = null; this.show('classsel'); });
      const b = el('button', 'btn', 'Forbidden Rites'); b.addEventListener('click', () => { this.closeModal(); this.g = null; this.show('rites'); });
      const c = el('button', 'btn', 'Title'); c.addEventListener('click', () => { this.closeModal(); this.g = null; this.show('title'); });
      row.appendChild(a); row.appendChild(b); row.appendChild(c); m.appendChild(row);
    }), 1200);
  },

  // ---------------- loop ----------------
  loop(now) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
    const g = this.g;
    if (g && $('#game').classList.contains('active')) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= 1 / 60 && steps++ < 5) { g.update(1 / 60); this.acc -= 1 / 60; }
      if (steps >= 5) this.acc = 0;
      this.handleEvents();
      if (this.g === g) { this.r.draw(g, this, g.paused ? 0 : dt); this.updateHud(); }
    } else if ($('#classsel').classList.contains('active') && this.classCanvases) {
      this.animT = (this.animT || 0) + dt * 10;
      for (const { cv, spr } of this.classCanvases) spriteToCanvas(cv, spr, frameOf(spr, this.animT));
    }
    requestAnimationFrame(t => this.loop(t));
  },
};

window.addEventListener('DOMContentLoaded', () => UI.init());
