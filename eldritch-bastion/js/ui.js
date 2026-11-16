// ============================================================
//  ELDRITCH BASTION — UI / controller
// ============================================================
'use strict';

const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const starStr = (n, max = 3) => '★'.repeat(n) + `<span class="off">${'★'.repeat(max - n)}</span>`;
const fmt = n => Math.round(n).toLocaleString();

const SPELL_GLYPH = { elder: '✦', cthugha: '🜂', powder: '✧' };
const TARGET_MODES = [['first', 'First'], ['last', 'Last'], ['strong', 'Strong'], ['close', 'Close']];

const UI = {
  game: null, renderer: null,
  placing: null, selected: null, hover: null, mouse: null, spellTarget: null,
  speed: 1, paused: false, lastFrame: 0, infoKey: '', autoTimer: 0,

  init() {
    Save.load();
    Sfx.setEnabled(Save.data.settings.sound);
    $('#opt-sound').checked = Save.data.settings.sound;
    $('#opt-auto').checked = Save.data.settings.autoWave;
    this.renderer = new Renderer($('#cv'), 2);

    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { Sfx.init(); Sfx.play('click'); this.show(b.dataset.go); }));
    $('#opt-sound').addEventListener('change', e => { Save.data.settings.sound = e.target.checked; Save.write(); Sfx.init(); Sfx.setEnabled(e.target.checked); });
    $('#opt-auto').addEventListener('change', e => { Save.data.settings.autoWave = e.target.checked; Save.write(); });
    $('#reset-save').addEventListener('click', () => {
      if (confirm('Erase all stars, research and unlocks? This cannot be undone.')) { Save.reset(); this.refreshTitle(); }
    });
    $('#research-refund').addEventListener('click', () => { Save.refundResearch(); this.renderResearch(); });

    this.buildTowerButtons();
    this.buildSpellButtons();
    this.bindCanvas();
    this.bindKeys();
    $('#btn-wave').addEventListener('click', () => this.callWave());
    $('#btn-speed').addEventListener('click', () => this.cycleSpeed());
    $('#btn-pause').addEventListener('click', () => this.togglePause());
    $('#pm-resume').addEventListener('click', () => this.togglePause(false));
    $('#pm-restart').addEventListener('click', () => this.startGame(this.game.mapIdx, this.game.mode));
    $('#pm-quit').addEventListener('click', () => this.quitToMaps());

    this.fitStage = () => {
      const wrap = document.querySelector('.canvas-wrap'), st = $('#stage');
      if (window.innerWidth <= 900 || !wrap.clientHeight) { st.style.width = ''; st.style.height = ''; return; }
      const k = Math.min(wrap.clientWidth / 960, wrap.clientHeight / 600);
      st.style.width = Math.floor(960 * k) + 'px'; st.style.height = Math.floor(600 * k) + 'px';
    };
    window.addEventListener('resize', this.fitStage);
    this.refreshTitle();
    requestAnimationFrame(t => this.loop(t));
  },

  show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    if (id === 'maps') this.renderMaps();
    if (id === 'research') this.renderResearch();
    if (id === 'bestiary') this.renderBestiary();
    if (id === 'title') this.refreshTitle();
    if (id !== 'game') { Sfx.stopDrone(); }
    window.scrollTo(0, 0);
  },
  refreshTitle() { $('#research-badge').textContent = Save.available() > 0 ? Save.available() : ''; },

  // ---------------- map select ----------------
  renderMaps() {
    const grid = $('#map-grid'); grid.innerHTML = '';
    const max = MAPS.length * 6;
    $('#stars-total').innerHTML = `★ ${Save.totalStars()} / ${max}`;
    MAPS.forEach((m, i) => {
      const unlocked = Save.mapUnlocked(i), cleared = Save.isCleared(i);
      const card = el('div', 'map-card' + (unlocked ? '' : ' locked'));
      const cv = el('canvas'); cv.width = 480; cv.height = 300;
      try {
        const g = new Game(i, 'normal'); const r = new Renderer(cv); r.prerender(g);
        const ctx = cv.getContext('2d'); ctx.drawImage(r.bg, 0, 0, 480, 300);
        if (!unlocked) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, 480, 300); }
      } catch (e) { console.error(e); }
      card.appendChild(cv);
      const body = el('div', 'body');
      body.appendChild(el('h3', '', `${i + 1}. ${m.name}`));
      body.appendChild(el('div', 'sub', m.sub));
      body.appendChild(el('div', 'desc', m.desc));
      body.appendChild(el('div', 'meta', `${m.waves} waves · from ${m.spawns.length} direction${m.spawns.length > 1 ? 's' : ''} · Boss: ${ENEMIES[m.boss].name}`));
      if (!unlocked) body.appendChild(el('div', 'lock', `Locked — clear ${MAPS[i - 1].name} first.`));
      const modes = el('div', 'modes');
      const mk = (mode, label, enabled) => {
        const b = el('button', 'btn' + (mode === 'nightmare' ? ' danger' : ''), `<span>${label}</span><span class="stars">${starStr(Save.getStars(i, mode))}</span>`);
        b.disabled = !enabled;
        if (mode === 'nightmare' && !cleared) b.title = 'Clear Normal mode first';
        b.addEventListener('click', () => { Sfx.init(); this.startGame(i, mode); });
        return b;
      };
      modes.appendChild(mk('normal', 'Normal', unlocked));
      modes.appendChild(mk('nightmare', 'Nightmare', cleared));
      body.appendChild(modes);
      card.appendChild(body);
      grid.appendChild(card);
    });
  },

  // ---------------- research ----------------
  renderResearch() {
    $('#research-avail').innerHTML = `★ ${Save.available()} available`;
    const list = $('#research-list'); list.innerHTML = '';
    for (const r of RESEARCH) {
      const rank = Save.rank(r.id), maxed = rank >= r.cost.length;
      const item = el('div', 'research-item');
      const txt = el('div', 'txt');
      txt.appendChild(el('h4', '', r.name));
      txt.appendChild(el('p', '', r.desc));
      const pips = el('div', 'pips');
      for (let k = 0; k < r.cost.length; k++) pips.appendChild(el('div', 'pip' + (k < rank ? ' on' : '')));
      txt.appendChild(pips);
      item.appendChild(txt);
      const b = el('button', 'btn gold', maxed ? 'Mastered' : `★ ${r.cost[rank]}`);
      b.disabled = maxed || Save.available() < r.cost[rank];
      b.addEventListener('click', () => { if (Save.buyResearch(r.id)) { Sfx.init(); Sfx.play('upgrade'); this.renderResearch(); this.refreshTitle(); } });
      item.appendChild(b);
      list.appendChild(item);
    }
  },

  // ---------------- bestiary ----------------
  renderBestiary() {
    const grid = $('#bestiary-grid'); grid.innerHTML = '';
    for (const id of ENEMY_ORDER) {
      const d = ENEMIES[id], seen = Save.data.seen[id];
      const card = el('div', 'beast' + (seen ? '' : ' unknown') + (d.boss ? ' boss' : ''));
      const cv = el('canvas'); cv.width = 144; cv.height = 144;
      card.appendChild(cv);
      const txt = el('div');
      if (seen) {
        drawEnemyIcon(cv, id);
        txt.appendChild(el('h4', '', d.name));
        txt.appendChild(el('p', '', d.desc));
        const tags = [`HP ${d.hp}`, `Armor ${d.armor}`, `Speed ${d.speed}`];
        txt.appendChild(el('div', 'tags', tags.join(' · ')));
      } else {
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#333'; ctx.font = '60px Georgia'; ctx.textAlign = 'center'; ctx.fillText('?', 72, 92);
        txt.appendChild(el('h4', '', '???'));
        txt.appendChild(el('p', '', d.boss ? 'A Great Old One, not yet encountered.' : 'Not yet encountered.'));
      }
      card.appendChild(txt);
      grid.appendChild(card);
    }
  },

  // ---------------- game ----------------
  startGame(mapIdx, mode) {
    this.game = new Game(mapIdx, mode);
    this.renderer.prerender(this.game);
    this.placing = null; this.selected = null; this.spellTarget = null; this.infoKey = '';
    this.paused = false; this.speed = 1; this.autoTimer = 0;
    $('#btn-speed').innerHTML = '1&times;';
    $('#pause-overlay').classList.add('hidden');
    $('#end-overlay').classList.add('hidden');
    $('#toasts').innerHTML = '';
    $('#hud-map').textContent = `${this.game.map.name}${mode === 'nightmare' ? ' — Nightmare' : ''}`;
    this.updateTowerButtons(true);
    this.updateSpellButtons(true);
    this.renderWavePreview();
    this.renderInfo(true);
    this.show('game');
    this.fitStage();
    Sfx.init(); Sfx.startDrone();
    this.toast(`${this.game.map.name}: ${this.game.map.sub}`, 'good');
    this.toast('Build defenses, then call the first wave.', '');
  },
  quitToMaps() { this.game = null; this.paused = false; $('#pause-overlay').classList.add('hidden'); this.show('maps'); },

  callWave() {
    const g = this.game; if (!g) return;
    if (g.callWave()) { this.renderWavePreview(); }
    else Sfx.play('deny');
  },
  cycleSpeed() { this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1; $('#btn-speed').innerHTML = this.speed + '&times;'; },
  togglePause(force) {
    if (!this.game || this.game.over) return;
    this.paused = force !== undefined ? force : !this.paused;
    $('#pause-overlay').classList.toggle('hidden', !this.paused);
  },

  // tower buttons
  buildTowerButtons() {
    const grid = $('#tower-grid'); grid.innerHTML = '';
    this.tbtns = {};
    TOWER_ORDER.forEach((id, i) => {
      const def = TOWERS[id];
      const b = el('button', 'tbtn');
      const cv = el('canvas'); cv.width = 88; cv.height = 88; drawTowerIcon(cv, id, 0);
      b.appendChild(el('span', 'key', i + 1));
      b.appendChild(cv);
      b.appendChild(el('span', 'cost', def.cost));
      b.addEventListener('click', () => this.selectBuild(id));
      b.addEventListener('mouseenter', () => { this.hoverBuild = id; this.renderInfo(true); });
      b.addEventListener('mouseleave', () => { this.hoverBuild = null; this.renderInfo(true); });
      grid.appendChild(b);
      this.tbtns[id] = b;
    });
  },
  updateTowerButtons() {
    const g = this.game; if (!g) return;
    for (const id of TOWER_ORDER) {
      const b = this.tbtns[id], unl = Save.towerUnlocked(id);
      b.classList.toggle('locked', !unl);
      b.classList.toggle('poor', unl && g.gold < TOWERS[id].cost);
      b.classList.toggle('selected', this.placing === id);
      b.title = unl ? `${TOWERS[id].name} (${TOWERS[id].cost})` : `Locked: ${TOWERS[id].unlock.text}`;
    }
  },
  selectBuild(id) {
    if (!this.game || this.game.over) return;
    if (!Save.towerUnlocked(id)) { Sfx.play('deny'); this.toast(`Locked — ${TOWERS[id].unlock.text}`, ''); return; }
    this.spellTarget = null;
    this.placing = this.placing === id ? null : id;
    this.selected = null;
    Sfx.play('click');
    this.updateTowerButtons(); this.renderInfo(true);
  },

  // spells
  buildSpellButtons() {
    const row = $('#spell-row'); row.innerHTML = '';
    this.sbtns = {};
    for (const id of SPELL_ORDER) {
      const sp = SPELLS[id];
      const b = el('button', 'sbtn', `<span class="glyph">${SPELL_GLYPH[id]}</span>${sp.name.replace('Powder of ', '')}<div class="cdmask"></div>`);
      b.title = `${sp.name} [${sp.key}] — ${sp.desc}`;
      b.addEventListener('click', () => this.useSpell(id));
      row.appendChild(b);
      this.sbtns[id] = b;
    }
  },
  updateSpellButtons() {
    const g = this.game; if (!g) return;
    for (const id of SPELL_ORDER) {
      const b = this.sbtns[id], unl = Save.spellUnlocked(id);
      b.classList.toggle('locked', !unl);
      const cdMax = SPELLS[id].cd * g.mods.spellCd;
      const k = unl ? g.spellCd[id] / cdMax : 1;
      b.querySelector('.cdmask').style.height = (k * 100) + '%';
      b.classList.toggle('ready', unl && k <= 0);
      b.classList.toggle('armed', this.spellTarget === id);
      if (!unl) b.title = `${SPELLS[id].name} — Locked: research it first.`;
    }
  },
  useSpell(id) {
    const g = this.game; if (!g || g.over) return;
    if (!Save.spellUnlocked(id)) { this.toast('Research Powder of Ibn-Ghazi to unlock.', ''); Sfx.play('deny'); return; }
    if (!g.spellReady(id)) { Sfx.play('deny'); return; }
    if (SPELLS[id].target) { this.spellTarget = this.spellTarget === id ? null : id; this.placing = null; this.updateTowerButtons(); }
    else g.castSpell(id);
  },

  // info panel
  renderInfo(force) {
    const g = this.game; if (!g) return;
    const box = $('#info');
    const t = this.selected;
    const showId = this.hoverBuild || this.placing;
    const key = t ? `t${t.id}:${t.level}:${t.targeting}:${g.gold >= (g.upgradeCost(t) ?? 1e9)}:${t.kills}` : showId ? `b${showId}:${Save.towerUnlocked(showId)}` : 'none';
    if (!force && key === this.infoKey) return;
    this.infoKey = key;
    if (t) {
      const s = t.stats, nextCost = g.upgradeCost(t);
      const next = nextCost !== null ? g.computeStats(t, t.level + 1) : null;
      const rows = this.statRows(t.type, s, next);
      box.innerHTML = `<h4>${t.def.levels[t.level].title}</h4><div class="lvl">${t.def.name} · Tier ${t.level + 1}/4 · ${t.kills} kills · ${fmt(t.dmg)} dmg</div>
        <table class="stat-table">${rows}</table>`;
      const act = el('div', 'info-actions');
      const up = el('button', 'btn gold', nextCost !== null ? `Upgrade ◉${nextCost} <kbd>U</kbd>` : 'Max tier');
      up.disabled = nextCost === null || g.gold < nextCost;
      up.addEventListener('click', () => this.upgradeSelected());
      const sell = el('button', 'btn danger', `Sell ◉${g.sellValue(t)} <kbd>S</kbd>`);
      sell.addEventListener('click', () => this.sellSelected());
      act.appendChild(up); act.appendChild(sell);
      box.appendChild(act);
      if (['bullet', 'mortar', 'chain', 'arcane', 'beam'].includes(t.def.kind)) {
        const tr = el('div', 'target-row');
        for (const [m, label] of TARGET_MODES) {
          const b = el('button', 'btn small' + (t.targeting === m ? ' active' : ''), label);
          b.addEventListener('click', () => { t.targeting = m; t.beamTarget = null; this.renderInfo(true); });
          tr.appendChild(b);
        }
        box.appendChild(tr);
      }
    } else if (showId) {
      const d = TOWERS[showId], unl = Save.towerUnlocked(showId);
      const fake = { type: showId, def: d, level: 0 };
      const s = g.computeStats(fake, 0);
      box.innerHTML = `<h4>${d.name}</h4><div class="lvl">Cost ◉${d.cost} · ${d.kind === 'income' ? 'Economy' : (d.air ? 'Hits air' : 'Ground only')}</div>
        <p>${d.desc}</p>${unl ? `<table class="stat-table">${this.statRows(showId, s, null)}</table>` : `<p style="color:#c06070">Locked: ${d.unlock.text}</p>`}`;
    } else {
      box.innerHTML = `<h4>The Watch</h4><p>Pick a defense and place it anywhere on the open field. Horrors flow around your towers, so build to funnel them — but leave them a way in.</p>
        <p>Horrors that reach the walls claw at them, draining <b>City Sanity</b> every second until you kill them.</p>`;
    }
  },
  statRows(type, s, n) {
    const row = (label, v, nv, f = x => x) => `<tr><td>${label}</td><td>${f(v)}${n && nv !== undefined && f(nv) !== f(v) ? ` <span class="up">→ ${f(nv)}</span>` : ''}</td></tr>`;
    const r1 = x => (Math.round(x * 10) / 10).toString();
    const pct = x => Math.round(x * 100) + '%';
    let h = '';
    if (s.dmg !== undefined) h += row('Damage', s.dmg, n && n.dmg, r1);
    if (s.dps !== undefined) h += row('Burn / sec', s.dps, n && n.dps, r1);
    if (s.rate !== undefined) h += row('Attacks / sec', s.rate, n && n.rate, r1);
    if (s.range) h += row('Range', s.range, n && n.range, r1);
    if (s.splash !== undefined) h += row('Blast radius', s.splash, n && n.splash, r1);
    if (s.chains !== undefined) h += row('Chain targets', s.chains, n && n.chains);
    if (s.slow !== undefined) h += row('Slow', s.slow, n && n.slow, pct);
    if (s.pulse) h += row('Arcane pulse / sec', s.pulse, n && n.pulse, r1);
    else if (n && n.pulse) h += row('Arcane pulse / sec', 0, n.pulse, r1);
    if (s.ramp !== undefined) h += row('Max intensity', s.ramp, n && n.ramp, x => r1(x) + '×');
    if (s.income !== undefined) h += row('Gold per wave', s.income, n && n.income);
    if (s.crit) h += row('Crit chance (3×)', s.crit, n && n.crit, pct); else if (n && n.crit) h += row('Crit chance (3×)', 0, n.crit, pct);
    if (s.stun) h += row('Stun chance', s.stun, n && n.stun, pct); else if (n && n.stun) h += row('Stun chance', 0, n.stun, pct);
    if (TOWERS[type].reveal) h += `<tr><td colspan="2" style="color:var(--violet)">Reveals phased horrors</td></tr>`;
    return h;
  },
  upgradeSelected() { const g = this.game, t = this.selected; if (g && t) { if (!g.upgrade(t)) Sfx.play('deny'); this.renderInfo(true); } },
  sellSelected() { const g = this.game, t = this.selected; if (g && t) { g.sell(t); this.selected = null; this.renderInfo(true); } },

  renderWavePreview() {
    const g = this.game; if (!g) return;
    const box = $('#wave-preview'); box.innerHTML = '';
    const next = g.wave + 1;
    if (next > g.totalWaves) { $('#next-wave-title').textContent = 'Final wave unleashed'; box.appendChild(el('span', 'dim', 'Survive!')); return; }
    $('#next-wave-title').textContent = `Next: Wave ${next}${next === g.totalWaves ? ' — BOSS' : ''}`;
    const counts = {};
    for (const s of g.getWave(next)) counts[s.type] = (counts[s.type] || 0) + 1;
    for (const [type, n] of Object.entries(counts)) {
      const it = el('div', 'wp-item' + (ENEMIES[type].boss ? ' boss' : ''));
      const cv = el('canvas'); cv.width = 60; cv.height = 60; drawEnemyIcon(cv, type);
      it.appendChild(cv); it.appendChild(el('span', '', `×${n}`));
      it.title = Save.data.seen[type] ? `${ENEMIES[type].name}: ${ENEMIES[type].desc}` : `${ENEMIES[type].name} (new!)`;
      box.appendChild(it);
    }
  },

  updateHud() {
    const g = this.game;
    $('#hud-sanity').textContent = Math.max(0, Math.ceil(g.sanity));
    $('#hud-sanity-bar').style.width = (100 * g.sanity / g.maxSanity) + '%';
    $('#hud-gold').textContent = fmt(g.gold);
    $('#hud-wave').textContent = `${g.wave}/${g.totalWaves}`;
    const wb = $('#btn-wave');
    wb.disabled = !g.canCallWave();
    const idle = g.canCallWave() && g.enemies.length === 0;
    wb.classList.toggle('pulse', idle);
    wb.innerHTML = g.wave === 0 ? 'Begin the Siege <kbd>Space</kbd>' : g.canCallWave() ? (g.enemies.length ? `Call Early (+bonus) <kbd>Space</kbd>` : `Call Wave ${g.wave + 1} <kbd>Space</kbd>`) : g.wave >= g.totalWaves ? 'Final wave' : 'Wave incoming…';
  },

  toast(text, cls) {
    const t = el('div', 'toast ' + (cls || ''), text);
    $('#toasts').appendChild(t);
    while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
    setTimeout(() => t.remove(), 3300);
  },

  handleEvents() {
    const g = this.game;
    for (const ev of g.events) {
      Sfx.play(ev.type, ev.data);
      switch (ev.type) {
        case 'wave':
          this.toast(`Wave ${ev.data.wave}${ev.data.early ? ' (called early)' : ''} — +${ev.data.income} gold`, '');
          this.renderWavePreview();
          break;
        case 'boss': this.toast(`${ENEMIES[ev.data].name} has awoken!`, 'boss'); break;
        case 'bossDown': this.toast(`${ENEMIES[ev.data].name} is banished!`, 'good'); break;
        case 'newEnemy': if (!ENEMIES[ev.data].boss) this.toast(`New horror: ${ENEMIES[ev.data].name}`, 'new'); break;
        case 'siege': if (ENEMIES[ev.data].boss || performance.now() - (this.lastLeakToast || 0) > 2500) { this.lastLeakToast = performance.now(); this.toast(ENEMIES[ev.data].boss ? `${ENEMIES[ev.data].name} is at the walls!` : `${ENEMIES[ev.data].name} is clawing at the walls!`, 'boss'); } break;
        case 'end': this.showEnd(ev.data); break;
      }
    }
    g.events.length = 0;
  },

  showEnd(result) {
    const g = this.game;
    Sfx.stopDrone();
    Sfx.play(result === 'win' ? 'win' : 'lose');
    const m = $('#end-modal');
    m.className = 'modal ' + result;
    let html = '';
    if (result === 'win') {
      html += `<h2>The City Endures</h2><div class="big-stars">${starStr(g.starsEarned)}</div>`;
      if (g.newStars > 0) html += `<div class="unlocks">+${g.newStars} Elder Sign${g.newStars > 1 ? 's' : ''} earned for research</div>`;
      if (g.firstClear) {
        const un = [];
        if (MAPS[g.mapIdx + 1]) un.push(`New map: <b>${MAPS[g.mapIdx + 1].name}</b>`);
        for (const id of TOWER_ORDER) if (TOWERS[id].unlock && TOWERS[id].unlock.map === g.mapIdx) un.push(`New tower: <b>${TOWERS[id].name}</b>`);
        un.push('Nightmare mode unlocked for this map');
        html += `<div class="unlocks">${un.join('<br>')}</div>`;
      }
      if (g.mapIdx === MAPS.length - 1 && g.firstClear) html += `<p><i>Great Cthulhu sinks back beneath the waves. That is not dead which can eternal lie&hellip; but tonight, mankind sleeps.</i></p>`;
    } else {
      html += `<h2>Madness Takes the City</h2><p class="dim">The streets fill with chanting. You held for ${Math.max(0, g.wave - 1)} of ${g.totalWaves} waves.</p>`;
    }
    html += `<div class="summary">Horrors slain: ${g.stats.kills} · Reached the walls: ${g.stats.breaches} · Sanity left: ${Math.ceil(g.sanity)}/${g.maxSanity}</div>`;
    m.innerHTML = html;
    const row = el('div', 'row');
    const b = (label, fn, cls = '') => { const x = el('button', 'btn ' + cls, label); x.addEventListener('click', fn); row.appendChild(x); };
    if (result === 'win' && MAPS[g.mapIdx + 1]) b('Next Map →', () => this.startGame(g.mapIdx + 1, 'normal'), 'gold');
    b(result === 'win' ? 'Replay' : 'Try Again', () => this.startGame(g.mapIdx, g.mode));
    if (Save.available() > 0) b(`Research (★${Save.available()})`, () => { this.game = null; this.show('research'); });
    b('Map Select', () => this.quitToMaps());
    m.appendChild(row);
    setTimeout(() => $('#end-overlay').classList.remove('hidden'), 900);
  },

  // ---------------- input ----------------
  toGame(ev) {
    const cv = $('#cv'), r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height };
  },
  bindCanvas() {
    const cv = $('#cv');
    cv.addEventListener('mousemove', ev => {
      const p = this.toGame(ev); this.mouse = p;
      this.hover = { c: Math.floor(p.x / TILE), r: Math.floor(p.y / TILE) };
    });
    cv.addEventListener('mouseleave', () => { this.hover = null; this.mouse = null; });
    cv.addEventListener('contextmenu', ev => { ev.preventDefault(); this.cancel(); });
    cv.addEventListener('click', ev => {
      const g = this.game; if (!g || g.over || this.paused) return;
      Sfx.init();
      const p = this.toGame(ev); this.mouse = p;
      const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE);
      this.hover = { c, r };
      if (this.spellTarget) {
        if (g.castSpell(this.spellTarget, p.x, p.y)) this.spellTarget = null;
        return;
      }
      if (this.placing) {
        const t = g.place(this.placing, c, r);
        if (t) { if (!ev.shiftKey) { this.placing = null; this.selected = t; } }
        else {
          Sfx.play('deny');
          if (g.towerAt[r] && g.towerAt[r][c]) { this.placing = null; this.selected = g.towerAt[r][c]; }
          else if (g.gold < TOWERS[this.placing].cost) this.toast('Not enough gold.', '');
          else { const why = g.placeProblem(c, r); if (why && why.startsWith('That')) this.toast(why, ''); }
        }
        this.updateTowerButtons(); this.renderInfo(true);
        return;
      }
      const t = g.towerAt[r] && g.towerAt[r][c];
      this.selected = t || null;
      if (t) Sfx.play('click');
      this.renderInfo(true);
    });
  },
  cancel() { this.placing = null; this.spellTarget = null; this.selected = null; this.updateTowerButtons(); this.renderInfo(true); },
  bindKeys() {
    window.addEventListener('keydown', ev => {
      if (!this.game || !$('#game').classList.contains('active')) return;
      if (ev.target.tagName === 'INPUT') return;
      const k = ev.key.toLowerCase();
      if (k >= '1' && k <= '7') { this.selectBuild(TOWER_ORDER[+k - 1]); }
      else if (k === ' ') { ev.preventDefault(); this.callWave(); }
      else if (k === 'escape') { if (this.placing || this.spellTarget || this.selected) this.cancel(); else this.togglePause(); }
      else if (k === 'p') this.togglePause();
      else if (k === 'f') this.cycleSpeed();
      else if (k === 'u') this.upgradeSelected();
      else if (k === 's') this.sellSelected();
      else if (k === 'q') this.useSpell('elder');
      else if (k === 'w') this.useSpell('cthugha');
      else if (k === 'e') this.useSpell('powder');
    });
  },

  // ---------------- loop ----------------
  loop(now) {
    const dt = Math.min(0.1, (now - (this.lastFrame || now)) / 1000);
    this.lastFrame = now;
    const g = this.game;
    if (g && $('#game').classList.contains('active')) {
      if (!this.paused) {
        let sim = dt * this.speed;
        while (sim > 0) { const step = Math.min(sim, 1 / 60); g.update(step); sim -= step; }
        // auto-wave
        if (Save.data.settings.autoWave && g.wave > 0 && g.canCallWave() && g.enemies.length === 0 && !g.over) {
          this.autoTimer += dt; if (this.autoTimer > 2.5) { this.autoTimer = 0; this.callWave(); }
        } else this.autoTimer = 0;
      }
      if (this.selected && !g.towers.includes(this.selected)) this.selected = null;
      this.handleEvents();
      this.renderer.draw(g, this, this.paused ? 0 : dt);
      // adaptive quality: if frames stay slow, fall back to 1x resolution
      this.frameEma = (this.frameEma || 0.016) * 0.97 + dt * 0.03;
      if (this.renderer.ss > 1 && this.frameEma > 0.04 && (this.slowT = (this.slowT || 0) + dt) > 2) { this.renderer.setQuality(1, g); this.frameEma = 0.016; }
      else if (this.frameEma <= 0.04) this.slowT = 0;
      this.updateHud();
      this.updateTowerButtons();
      this.updateSpellButtons();
      this.renderInfo(false);
    }
    requestAnimationFrame(t => this.loop(t));
  },
};

window.addEventListener('DOMContentLoaded', () => UI.init());
