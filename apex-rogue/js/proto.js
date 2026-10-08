'use strict';
// Gunner prototype: the car drives itself, you handle weapons and defence.
// A run is a string of races with a garage between them: build your car, survive, earn scrap.
// Press V to swap between the first-person cockpit and the top-down view.

const LOOK_SENS = 0.0024;
// The run climbs out of the undercity: two acts under the megastructures, then two racing for the rich.
const ACTS = [
  { biome: 'undercity', name: 'Act I', title: 'The Undercity' },
  { biome: 'stacks', name: 'Act II', title: 'The Stacks' },
  { biome: 'terraces', name: 'Act III', title: 'The Gilded Terraces' },
  { biome: 'crown', name: 'Act IV', title: 'The Crown' },
];
const PACE = 0.72; // global speed scale for the gunner races
// Rival skill rises through the run: d = act * 4 + row on the route sheet (0..15).
const RIVAL_SKILL = (d) => Math.min(1.08, 0.97 + d * 0.007);
const ACT_LUXURY = (act) => act >= 2;
const ROMAN = ['I', 'II', 'III', 'IV'];

const Proto = {
  view: 'cockpit',
  state: 'garage',
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
    this.cos = loadCosmetics();
    Settings.load();
    this.tab = 'car';
    this.previewCanvas = document.getElementById('preview3d');
    try { this.preview = new Garage3D(this.previewCanvas); } catch (e) { console.error(e); this.preview = null; }
    this.fadeEl = document.createElement('div');
    this.fadeEl.id = 'fade';
    document.body.appendChild(this.fadeEl);
    this.tip = document.createElement('div');
    this.tip.className = 'garage-tip hidden';
    document.body.appendChild(this.tip);
    // The garage is clickable: stations, goods on the counter, the door out.
    // Drag to look round the cabin / orbit the car; a click without dragging uses whatever is under the mouse.
    this.previewCanvas.addEventListener('mousedown', (e) => { this.gDrag = { x: e.clientX, y: e.clientY, moved: false }; });
    window.addEventListener('mouseup', () => { setTimeout(() => { this.gDrag = null; }, 0); });
    this.previewCanvas.addEventListener('wheel', (e) => { if (this.preview) this.preview.zoom(e.deltaY); }, { passive: true });
    this.previewCanvas.addEventListener('mousemove', (e) => {
      if (!this.preview || this.state !== 'garage') return;
      if (this.gDrag && e.buttons & 1) {
        const dx = e.clientX - this.gDrag.x, dy = e.clientY - this.gDrag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.gDrag.moved = true;
        if (this.gDrag.moved) {
          this.preview.drag(dx, dy);
          this.gDrag.x = e.clientX; this.gDrag.y = e.clientY;
          this.previewCanvas.style.cursor = 'grabbing';
          this.tip.classList.add('hidden');
          return;
        }
      }
      const r = this.previewCanvas.getBoundingClientRect();
      this.gMouse = { x: e.clientX, y: e.clientY };
      const hot = this.preview.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.previewCanvas.style.cursor = hot ? 'pointer' : 'default';
      this.tip.classList.toggle('hidden', !hot);
      if (hot) { this.tip.textContent = hot.label; this.tip.style.left = e.clientX + 14 + 'px'; this.tip.style.top = e.clientY + 14 + 'px'; }
    });
    this.previewCanvas.addEventListener('mouseleave', () => { this.tip.classList.add('hidden'); this.gMouse = null; });
    this.previewCanvas.addEventListener('click', (e) => {
      if (!this.preview || this.state !== 'garage' || (this.gDrag && this.gDrag.moved)) return;
      // Re-check what is under the cursor right now (the camera may have eased since the last mouse move).
      const r = this.previewCanvas.getBoundingClientRect();
      const h = this.preview.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (!h) return;
      Sound.resume();
      Sound.play({ type: 'click' });
      this.tip.classList.add('hidden');
      this.action(h.action, h.arg);
    });
    Input.init();
    // Sculpted models (gloves, guns, car bodies, cabin) are meshed once and shared. Queue them all now and mesh
    // them a few milliseconds per frame while the menus idle, so neither the menus nor the first race stall.
    Sculpt.collect = true;
    try {
      for (const id of ['smg', 'shotgun', 'rocket', 'flare']) Models.hands(Models.weapon(id), id); // guns and their fitted gloves
      for (const style of Object.keys(CAR_STYLES)) Models.car({ style, color: '#888888' });
      Models.car(Object.assign({}, carLook(this.cos), { shell: true })); // your own car, seen from inside
      Models.interior('#888888', {});
      Models.rocketPod(); Models.mineDropper(); Models.gunner(); Models.grenade();
    } finally { Sculpt.collect = false; }
    const pump = () => { if (Sculpt.runJobs(10)) requestAnimationFrame(pump); };
    requestAnimationFrame(pump);
    window.addEventListener('resize', () => this.resize());
    this.resize();

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (this.locked && this.cockpit) {
        const l = this.cockpit.look;
        const sens = LOOK_SENS * Settings.data.sens;
        l.yaw = wrapAngle(l.yaw + e.movementX * sens);
        l.pitch = clamp(l.pitch - e.movementY * sens, -0.75, 0.6);
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
      this.action(el.dataset.action, el.dataset.arg);
    });
    this.ui.addEventListener('change', (e) => {
      if (e.target.id === 'plateInput') this.action('cosmetic', 'plate:' + e.target.value);
      if (e.target.id === 'inmateInput') this.action('cosmetic', 'inmate:' + e.target.value);
    });

    this.newRun();
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
    if (this.state === 'map') this.showMap(); // redraw the route sheet at the new size
  },

  lock() {
    if (this.c2d.requestPointerLock) this.c2d.requestPointerLock();
  },

  // Fade to black, swap the screen, fade back in.
  fadeThrough(fn) {
    const f = this.fadeEl;
    if (!f) { fn(); return; }
    f.classList.add('on');
    setTimeout(() => { fn(); requestAnimationFrame(() => f.classList.remove('on')); }, 230);
  },

  setUI(html) {
    this.ui.innerHTML = html;
    this.ui.classList.toggle('hidden', !html);
    this.ui.classList.toggle('g3d-mode', html.includes('g3d'));
  },

  action(a, arg) {
    const b = this.build;
    const buy = (cost) => { if (b.scrap < cost) return false; b.scrap -= cost; Sound.play({ type: 'buy' }); return true; };
    switch (a) {
      case 'start': this.startRace(); break;
      case 'settings': this.showSettings(); break;
      case 'resume': this.resume(); break;
      case 'view-cockpit': this.setView('cockpit'); this.refresh(); break;
      case 'view-top': this.setView('top'); this.refresh(); break;
      case 'retro': this.toggleRetro(); this.refresh(); break;
      case 'to-briefing': this.showMap(); break;
      case 'to-map': this.showMap(); break;
      case 'open-garage': this.toGarage(); break;
      case 'pick-node': {
        // Draw the marker to the stop, thump the stamp, fade to black, then go.
        if (this.picking) break;
        const id = +arg, cv = document.getElementById('routeCanvas');
        if (!cv || !reachableNodes(this.run.map, this.run.cur).includes(id)) { this.pickNode(id); break; }
        this.picking = true;
        Sound.play({ type: 'click' });
        RouteSheet.drawTo(cv, this.run.map, this.run.cur, id, () => {
          const el = document.querySelector(`.stop[data-arg="${id}"]`);
          if (el) el.classList.add('picked');
          setTimeout(() => this.fadeThrough(() => { this.picking = false; this.pickNode(id); }), 260);
        });
        break;
      }
      case 'event-choice': {
        const o = this.event.options[+arg];
        if (o.ok && !o.ok(b)) break;
        const res = o.apply(b, this.run, this.runRng);
        Sound.play({ type: 'click' });
        this.showEvent(this.event, res);
        break;
      }
      case 'new-run': this.newRun(); break;
      case 'abandon': this.gameOver(false); break;
      case 'after-results': this.afterResults(); break;
      // Garage & shop
      case 'tab': this.tab = arg; if (this.preview) this.preview.setMode(arg === 'paint' ? ({ cabin: 'interior', guns: 'guns' }[this.paintTab] || 'car') : 'car'); this.showGarage(); break;
      case 'repair-hull': { const c = repairHullCost(b); if (c > 0 && buy(c)) b.hull = b.maxHull; this.showGarage(); break; }
      case 'repair-part': { const c = repairPartCost(b, arg); if (c > 0 && buy(c)) b.parts[arg].dur = partMaxDur(b, b.parts[arg].id); this.showGarage(); break; }
      case 'buy-spare': if (!b.spare && buy(spareCost(b, arg))) b.spare = { id: b.parts[arg].id }; this.showGarage(); break;
      case 'buy-ammo': { const w = b.rack[+arg], d = weaponStats(w); if (buy(d.packPrice)) w.reserve += d.pack; this.showGarage(); break; }
      case 'buy-nade': if (b.grenades < MAX_GRENADES && buy(GRENADE_PRICE)) b.grenades++; this.showGarage(); break;
      case 'buy-item': {
        const card = this.shop[+arg];
        if (!card || card.sold || !buy(card.price)) break;
        applyItem(b, card);
        card.sold = true;
        this.showGarage();
        break;
      }
      case 'pick-reward': applyItem(b, this.rewards[+arg]); Sound.play({ type: 'buy' }); this.afterReward(); break;
      case 'skip-reward': b.scrap += 50; this.afterReward(); break;
      // Loadout (swappable here; only trinkets are permanent)
      case 'equip-part': equipPart(b, +arg); this.showGarage(); break;
      case 'equip-weapon': { const [si, ri] = arg.split(':').map(Number); equipWeapon(b, si, ri >= 0 ? ri : null); this.showGarage(); break; }
      case 'unequip-weapon': unequipWeapon(b, +arg); this.showGarage(); break;
      case 'equip-ability': { const [si, slot] = arg.split(':').map(Number); equipAbility(b, si, slot); this.showGarage(); break; }
      case 'equip-chip': equipChip(b, +arg); this.showGarage(); break;
      case 'fit-mod': { const [si, ri, slot] = arg.split(':').map(Number); fitMod(b, si, ri, slot); Sound.play({ type: 'reloaded' }); this.showGarage(); break; }
      case 'remove-mod': { const [ri, slot] = arg.split(':').map(Number); removeMod(b, ri, slot); this.showGarage(); break; }
      case 'tune': { const [slot, v] = arg.split(':'); b.parts[slot].tune = +v; this.showGarage(); break; }
      // Paint shop (saved between runs)
      case 'paint-tab': this.paintTab = arg; if (this.preview) this.preview.setMode({ cabin: 'interior', guns: 'guns' }[arg] || 'car'); this.showGarage(); break;
      case 'preset-save': savePreset(this.cos, +arg); saveCosmetics(this.cos); this.showGarage(); break;
      case 'preset-load': loadPreset(this.cos, +arg); saveCosmetics(this.cos); if (this.preview) this.preview.setLook(carLook(this.cos)); this.showGarage(); break;
      case 'cosmetic': {
        const i = arg.indexOf(':'), key = arg.slice(0, i), val = arg.slice(i + 1);
        if (key === 'number') this.cos.number = (+val + 100) % 100;
        else if (key === 'plate') this.cos.plate = val.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 8) || 'INM 4471';
        else if (key === 'inmate') this.cos.inmate = val.replace(/[^0-9]/g, '').slice(0, 6) || '4471';
        else if (key.startsWith('gun.')) this.cos.gunFinish[key.slice(4)] = val;
        else this.cos[key] = val;
        saveCosmetics(this.cos);
        if (this.preview) this.preview.setLook(carLook(this.cos));
        this.showGarage();
        break;
      }
    }
  },

  refresh() {
    if (this.state === 'briefing') this.showBriefing();
    else if (this.state === 'paused') this.showPause();
    else if (this.state === 'garage') this.showGarage();
  },

  // ---------- Run flow ----------

  newRun() {
    if (this.locked) document.exitPointerLock();
    this.build = newBuild();
    this.runRng = mulberry32((Math.random() * 2 ** 31) | 0);
    this.race = null;
    this.shop = [];
    this.shopOpen = false;
    this.startAct(0);
  },

  get act() { return ACTS[this.run.act]; },

  startAct(i) {
    this.run = { act: i, map: genActMap(this.runRng, i), cur: null, node: null, flags: (this.run && this.run.flags) || {} };
    this.showMap();
  },

  // ---------- Route sheet ----------

  showMap() {
    this.state = 'map';
    this.shopOpen = false;
    const b = this.build, run = this.run, map = run.map, act = this.act, boss = BOSSES[run.act];
    const reach = reachableNodes(map, run.cur);
    // Stops: clear colour-coded markers with a plain label underneath.
    const nodes = map.nodes.map((n) => {
      const t = NODE_TYPES_RUN[n.type], can = reach.includes(n.id), p = RouteSheet.pos(n);
      const info = n.type === 'boss' ? `<b>Qualifier: ${boss.name}</b>, ${boss.title}. ${boss.desc}` : `<b>${t.label}.</b> ${t.desc}`;
      return `<button class="stop t-${n.type} ${n.done ? 'done' : ''} ${can ? 'can' : ''}" style="left:${p.x * 100}%;top:${p.y * 100}%;--d:${(n.row * 0.05 + n.col * 0.02).toFixed(2)}s"
        ${can ? `data-action="pick-node" data-arg="${n.id}"` : 'disabled'} data-info="${info.replace(/"/g, '&quot;')}"><span>${t.icon}</span><small>${n.type === 'boss' ? 'Boss' : t.label}</small></button>`;
    }).join('');
    const here = run.cur != null ? RouteSheet.pos(mapNode(map, run.cur)) : null;
    const hint = reach.length === 1 && mapNode(map, reach[0]).type === 'boss' ? `Next: the qualifier against ${boss.name}.` : 'Pick one of the circled stops.';
    this.setUI(`<div class="screen mapscreen g3d">
      <div class="g-top">
        <div><b>Act ${ROMAN[run.act]}</b> · ${act.title}</div>
        <div class="cash">${b.scrap} scrap</div>
        <div>Hull <b>${Math.ceil(b.hull)}</b>/${b.maxHull}</div>
        <div>Strikes <b class="bad">${'●'.repeat(b.strikes)}</b><b>${'○'.repeat(STRIKES_TO_LOSE - b.strikes)}</b></div>
        <div>Rep <b>${this.cos.rep}</b></div>
        <button class="g-settings" data-action="settings" title="Settings">⚙ Settings</button>
      </div>
      <div class="route clipboard sheet">
        <div class="clip"></div>
        <div class="form-head">
          <canvas id="mugshot" width="120" height="140"></canvas>
          <div>
            <div class="form-title">Route sheet · Act ${ROMAN[run.act]}: ${act.title}</div>
            <div class="form-boss">At the top: <b>${boss.name}</b>, ${boss.title}</div>
          </div>
        </div>
        <div class="route-map" id="routeMap">
          <canvas class="route-canvas" id="routeCanvas"></canvas>
          ${nodes}
          ${here ? `<div class="pushpin" style="left:${here.x * 100}%;top:${here.y * 100}%"></div>` : ''}
        </div>
        <div class="route-info" id="routeInfo">${hint}</div>
      </div>
      <button class="btn big g-go garage-btn" data-action="open-garage">Garage: repairs, loadout, paint</button>
    </div>`);
    const cv = document.getElementById('routeCanvas');
    if (cv) RouteSheet.draw(cv, map, reach, run.cur);
    // Open the sheet scrolled to where you are on it.
    const sheet = document.querySelector('.route.sheet'), first = document.querySelector('.stop.can');
    if (sheet && first) sheet.scrollTop = Math.max(0, first.offsetTop + first.parentElement.offsetTop - sheet.clientHeight * 0.55);
    const mug = document.getElementById('mugshot');
    if (mug) RouteSheet.mugshot(mug, boss);
    // Hovering a stop explains it in the line under the map.
    const info = document.getElementById('routeInfo'), rm = document.getElementById('routeMap');
    if (rm && info) {
      rm.addEventListener('mouseover', (e) => { const el = e.target.closest('.stop'); if (el) info.innerHTML = el.dataset.info; });
      rm.addEventListener('mouseleave', () => { info.textContent = hint; });
    }
    this.syncGarage();
    if (this.preview) this.preview.setStation('overview');
  },

  pickNode(id) {
    const run = this.run, node = mapNode(run.map, id);
    if (!node || !reachableNodes(run.map, run.cur).includes(id)) return;
    run.node = node;
    if (['race', 'elite', 'boss', 'bounty'].includes(node.type)) { this.newRace(node); return; }
    if (node.type === 'stash') {
      node.done = true;
      run.cur = node.id;
      this.state = 'reward';
      this.rewardKind = 'stash';
      this.rewards = rollRewards(this.build, this.runRng, 2);
      this.showReward();
      return;
    }
    // Non-race stops resolve here, then you move on.
    node.done = true;
    run.cur = node.id;
    if (node.type === 'shop') {
      this.shop = rollShop(this.build, this.runRng);
      this.shopOpen = true;
      this.tab = 'market';
      this.toGarage();
    } else if (node.type === 'repair') {
      const b = this.build;
      b.hull = b.maxHull;
      for (const slot of PART_SLOTS) b.parts[slot].dur = partMaxDur(b, b.parts[slot].id);
      this.showEvent({ title: 'The mechanic', text: 'An old lifer with oil to his elbows waves you into his bay. "On the house. Just win."', result: 'Hull and every part repaired to full.' });
    } else {
      const seen = run.flags.seenEvents || (run.flags.seenEvents = []);
      const pool = EVENTS.filter((e) => !seen.includes(e.id));
      const ev = (pool.length ? pool : EVENTS)[Math.floor(this.runRng() * (pool.length || EVENTS.length))];
      seen.push(ev.id);
      this.event = ev;
      this.showEvent(ev);
    }
  },

  showEvent(ev, result) {
    this.state = 'event';
    const b = this.build;
    const opts = result || ev.result ? `<p class="event-result">${result || ev.result}</p><button class="btn primary big" data-action="to-map">Continue ▶</button>`
      : ev.options.map((o, i) => {
        const ok = !o.ok || o.ok(b);
        return `<button class="btn event-opt" ${ok ? `data-action="event-choice" data-arg="${i}"` : 'disabled'}><b>${o.label}</b><small>${o.desc}</small></button>`;
      }).join('');
    this.setUI(`<div class="screen eventscreen g3d">
      <div class="route clipboard event-card">
        <div class="clip"></div>
        <h2 class="g-title">${ev.title}</h2>
        <p class="event-text">${ev.text}</p>
        <div class="event-opts">${opts}</div>
        <p class="small muted">${b.scrap} scrap · hull ${Math.ceil(b.hull)}/${b.maxHull} · strikes ${b.strikes}/${STRIKES_TO_LOSE}</p>
      </div>
    </div>`);
    if (this.preview) this.preview.setStation('overview');
  },

  toGarage() {
    this.state = 'garage';
    if (!this.shopOpen) this.shop = [];
    if (this.preview) this.preview.setLook(carLook(this.cos));
    this.showGarage();
  },

  // After the results: strikes, boss outcome, then the reward pick.
  afterResults() {
    const b = this.build, run = this.run, node = run.node, ok = this.lastOk;
    if (b.strikes >= STRIKES_TO_LOSE) { this.gameOver(false); return; }
    if (node.type === 'boss') {
      if (!ok) { this.toGarage(); return; } // the boss waits for you; patch up and try again
      node.done = true;
      run.cur = node.id;
      if (run.act === ACTS.length - 1) { this.victory(); return; }
      this.pendingAct = run.act + 1;
      this.state = 'reward';
      this.rewardKind = 'boss';
      this.rewards = rollBossRewards(b, this.runRng);
      this.showReward();
      return;
    }
    node.done = true;
    run.cur = node.id;
    if (!ok) { this.toGarage(); return; } // a bad race earns nothing but the strike
    this.state = 'reward';
    this.rewardKind = node.type;
    this.rewards = node.type === 'elite' ? rollEliteRewards(b, this.runRng) : rollRewards(b, this.runRng, 3);
    this.showReward();
  },

  afterReward() {
    if (this.rewardKind === 'stash') { this.rewardKind = null; this.showMap(); return; }
    if (this.pendingAct != null) {
      const next = this.pendingAct;
      this.pendingAct = null;
      this.run.act = next;
      this.run.map = genActMap(this.runRng, next);
      this.run.cur = null;
    }
    this.toGarage();
  },

  gameOver() {
    if (this.locked) document.exitPointerLock();
    const b = this.build;
    this.state = 'over';
    this.setUI(`<div class="screen end lost">
      <h1>Escape failed</h1>
      <p>Three strikes. The warden sends you back to your cell after ${b.race} race${b.race === 1 ? '' : 's'} and ${b.wins} win${b.wins === 1 ? '' : 's'}.</p>
      <p class="muted">Trinkets collected: ${b.trinkets.map((t) => TRINKETS[t].name).join(', ') || 'none'}</p>
      <button class="btn primary big" data-action="new-run">New run ▶</button>
    </div>`);
  },

  victory() {
    const b = this.build;
    this.state = 'over';
    this.setUI(`<div class="screen end won">
      <h1>Free</h1>
      <p>You won the Crown. The warden signs your release in front of the whole upper city, smiling for the cameras.</p>
      <p class="muted">${b.race} races · ${b.wins} wins · trinkets: ${b.trinkets.map((t) => TRINKETS[t].name).join(', ') || 'none'}</p>
      <button class="btn primary big" data-action="new-run">New run ▶</button>
    </div>`);
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

  newRace(node) {
    if (this.locked) document.exitPointerLock();
    const b = this.build, run = this.run;
    node = node || run.node || { type: 'race', row: 0 };
    this.seed = (this.runRng() * 2 ** 31) | 0;
    const rng = mulberry32(this.seed);
    const biome = this.act.biome;
    const boss = node.type === 'boss' ? BOSSES[run.act] : null;
    const d = run.act * 4 + Math.round((Math.min(node.row, MAP_ROWS - 1) * 3) / (MAP_ROWS - 1)) + (node.type === 'elite' ? 2 : 0);
    const track = generateTrack(this.seed, biome, { hazardLevel: 1 });
    renderTrack(track);
    const base = CARS.comet;
    // Stats come from the parts you have fitted; the driver chip changes how the AI drives.
    const stats = buildStats(b);
    if (biome === 'tundra') stats.grip *= stats.iceGrip;
    const chipLat = { cautious: 0.85, hothead: 1.08, daredevil: 1.04, veteran: 1.06 }[b.chip] || 1;
    stats.aLat = (1050 + 650 * 0.15) * Math.sqrt(track.biome.grip) * chipLat;
    const player = new Car({ name: 'You', color: paintColor(this.cos), accent: '#1d1d1d', isPlayer: true, stats, hp: b.hull });
    const driver = new AIDriver(player, 0.95, rng);
    driver.rammer = b.chip === 'hothead';
    driver.insideMul = b.chip === 'daredevil' ? 2.2 : 1;
    // Rivals as quick as a stock car from the start, getting sharper through the run; the boss drives above the field.
    const opponents = buildOpponents(rng, 0, { aiBonus: 0 }, false).map((o) => Object.assign(o, { skill: RIVAL_SKILL(d) + randRange(rng, -0.035, 0.03) }));
    if (boss) opponents[opponents.length - 1] = { name: boss.name, color: boss.color, accent: '#111', skill: RIVAL_SKILL(d) + boss.skill, isBoss: true };
    this.race = new Race({
      track, laps: boss ? 4 : 3, playerCar: player, rng, qualify: boss && boss.mustWin ? 1 : 3,
      opponents, playerGrid: boss ? 5 : 4,
    });
    this.race.node = node;
    this.race.boss = boss;
    if (node.type === 'bounty') {
      // A price on one rival's head: the strongest non-boss driver on the grid.
      const field = this.race.cars.filter((c) => c !== player && !c.isBoss);
      this.race.bountyCar = field[field.length - 1];
      this.race.bountyCar.bounty = 150 + run.act * 50;
    }
    if (boss) {
      const bc = this.race.cars.find((c) => c.isBoss);
      bc.stats.maxHp = bc.hp = boss.hp;
      bc.stats.mass = boss.mass;
      bc.bossLook = boss.look;
      this.race.bossCar = bc;
    }
    // Contraband: a heavy load costs hull at the start.
    if (run.flags.hullHit) { player.hp = Math.max(1, player.hp - run.flags.hullHit); run.flags.hullHit = 0; }
    // Slower, heavier racing than the arcade game: more time to aim, and a pack that stays together.
    for (const c of this.race.cars) {
      c.stats.top *= PACE;
      c.stats.accel *= PACE;
      c.stats.aLat *= 0.88;
    }
    this.race.rubberCfg = { dist: 2200, ahead: -0.07, behind: 0.12 };
    this.driver = driver;
    this.combat = new Combat(this.race, { driver, build: b, elite: node.type === 'elite', boss, disarm: !!run.flags.disarm });
    run.flags.disarm = false;
    this.combat.pace = PACE;
    this.race.onRenderWorld = (ctx, t) => this.combat.render2D(ctx, t);
    if (this.cockpit) this.cockpit.load(this.race, this.combat, carLook(this.cos));
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
      ${c.isBoss ? '<em class="tag yellow">👑 Boss</em>' : ''}${c.bounty ? `<em class="tag yellow">💰 Bounty ${c.bounty}</em>` : ''}${c.weapon === 'rocket' ? '<em class="tag red">🚀 Rocket gunner</em>' : c.weapon === 'mine' ? '<em class="tag yellow">💣 Mine layer</em>' : c.weapon === 'gun' ? '<em class="tag red">🔫 Gunner</em>' : ''}</div>`).join('');
    const boosts = tr.hazards.filter((h) => h.type === 'boost').length, oils = tr.hazards.length - boosts;
    this.setUI(`<div class="screen briefing">
      <h1>${race.boss ? 'Qualifier: ' + race.boss.name : race.node.type === 'elite' ? 'Elite race' : race.node.type === 'bounty' ? 'Bounty race' : 'Race briefing'}</h1>
      <p class="act-line">Act ${ROMAN[this.run.act]} · ${this.act.title}${race.boss && race.boss.mustWin ? ' · <b class="bad">FINAL: win it or stay a prisoner</b>' : ''}</p>
      ${race.boss ? `<p class="boss-line"><b>${race.boss.title}.</b> ${race.boss.desc}</p>` : race.node.type === 'elite' ? '<p class="boss-line">Sharper drivers and more guns on the grid. A trinket waits for you if you make the cut.</p>' : ''}
      <p class="muted">${this.build.scrap} scrap · hull ${Math.ceil(this.build.hull)}/${this.build.maxHull} · strikes ${'●'.repeat(this.build.strikes)}${'○'.repeat(STRIKES_TO_LOSE - this.build.strikes)}</p>
      <div class="brief-grid">
        <div class="panel"><canvas id="preview" width="320" height="320"></canvas>
          <h2>${bio.name}</h2><p class="muted">${bio.blurb}</p>
          <p>${race.laps} laps · ${Math.round((tr.length * 0.125) / 10) * 10}m lap · ${boosts} boost pads · ${oils} oil slicks</p>
          <p><b>${race.boss ? (race.boss.mustWin ? 'Win the race outright' : 'Finish ahead of ' + race.boss.name) : 'Finish top ' + race.qualify}</b></p>
        </div>
        <div class="panel"><h2>Rivals</h2>${rivals}
          <h2>Controls</h2>
          <div class="ctl"><kbd>Mouse</kbd> Aim / look around · <kbd>LMB</kbd> Fire</div>
          <div class="ctl"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Weapons · <kbd>Q</kbd>/<kbd>Wheel</kbd> switch · <kbd>R</kbd> Reload</div>
          <div class="ctl"><kbd>RMB</kbd>/<kbd>G</kbd> Grenade (look higher to throw further)</div>
          <div class="ctl"><kbd>Space</kbd> / <kbd>E</kbd> Abilities · <kbd>B</kbd> Fit your spare part when one breaks</div>
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
      <button class="btn" data-action="settings">Settings</button>
      <button class="btn ghost" data-action="abandon">Abandon run</button>
    </div>`);
  },

  // Settings sheet: a modal over whatever screen you are on.
  showSettings() {
    let el = document.getElementById('settings');
    if (!el) {
      el = document.createElement('div');
      el.id = 'settings';
      document.body.appendChild(el);
      el.addEventListener('click', (e) => {
        const a = e.target.closest('[data-set]');
        if (e.target === el || (a && a.dataset.set === 'close')) { el.remove(); return; }
        if (!a) return;
        const [k, v] = a.dataset.set.split(':');
        if (k === 'sway') Settings.data.cabinSway = v;
        if (k === 'retro') this.toggleRetro();
        if (k === 'mute') Sound.toggleMute();
        Settings.save();
        Sound.play({ type: 'click' });
        this.showSettings();
      });
      el.addEventListener('input', (e) => {
        if (e.target.id === 'setSens') Settings.data.sens = +e.target.value;
        if (e.target.id === 'setVol') Settings.data.volume = +e.target.value;
        Settings.save();
        const l = el.querySelector(`[data-val="${e.target.id}"]`);
        if (l) l.textContent = e.target.id === 'setSens' ? Settings.data.sens.toFixed(2) + 'x' : Math.round(Settings.data.volume * 100) + '%';
      });
    }
    const d = Settings.data, opt = (k, v, label) => `<button class="opt ${d.cabinSway === v ? 'on' : ''}" data-set="${k}:${v}">${label}</button>`;
    el.innerHTML = `<div class="settings-card clipboard">
      <div class="clip"></div>
      <h2 class="g-title">Settings</h2>
      <h3>Cabin sway</h3>
      <p class="muted small">How much the cabin rolls and pitches with the car. Turn it down if it makes you queasy.</p>
      <div class="opts">${opt('sway', 'off', 'Off')}${opt('sway', 'subtle', 'Subtle')}${opt('sway', 'full', 'Full')}</div>
      <h3>Mouse sensitivity <small data-val="setSens">${d.sens.toFixed(2)}x</small></h3>
      <input type="range" id="setSens" min="0.3" max="2.5" step="0.05" value="${d.sens}">
      <h3>Volume <small data-val="setVol">${Math.round(d.volume * 100)}%</small></h3>
      <input type="range" id="setVol" min="0" max="1" step="0.05" value="${d.volume}">
      <div class="opts" style="margin-top:8px"><button class="opt ${Sound.muted ? 'on' : ''}" data-set="mute:1">${Sound.muted ? 'Sound muted (M)' : 'Mute (M)'}</button></div>
      <h3>Look</h3>
      <div class="opts"><button class="opt ${PSX.enabled ? 'on' : ''}" data-set="retro:1">Retro filter: ${PSX.enabled ? 'On' : 'Off'} (F)</button></div>
      <button class="btn primary" data-set="close" style="margin-top:14px">Done</button>
    </div>`;
  },

  showResults() {
    const race = this.race, p = race.player, s = this.combat.stats, b = this.build;
    race.rankCars();
    const boss = race.boss, run = this.run;
    const ok = boss ? (boss.mustWin ? p.place === 1 : p.place < race.bossCar.place) : p.place <= race.qualify;
    this.lastOk = ok;
    // Bank the race: hull carries over, scrap paid out, strikes for missing the cut.
    const show = b.chip === 'showboat' ? 1.5 : 1;
    const placePay = Math.round((PLACE_SCRAP[p.place - 1] || 0) * show * (race.node.type === 'elite' ? 1.4 : 1)), wreckPay = Math.round((s.wrecked * WRECK_SCRAP + s.scrapBonus) * show);
    const bossPay = boss && ok ? 250 : 0;
    const bc = race.bountyCar, bountyPay = bc && bc.hp <= 0 ? bc.bounty : 0;
    let sponsorCut = 0;
    if (run.flags.sponsor) { if (!ok) sponsorCut = Math.min(b.scrap + placePay + wreckPay, run.flags.sponsor); run.flags.sponsor = 0; }
    let betPay = 0;
    if (run.flags.bet) { if (p.place <= 2) betPay = run.flags.bet; run.flags.bet = 0; }
    b.scrap += placePay + wreckPay + bossPay + betPay + bountyPay - sponsorCut;
    b.hull = Math.max(1, Math.round(p.hp));
    b.race++;
    if (p.place === 1) b.wins++;
    if (!ok) b.strikes++;
    // Reputation persists between runs and unlocks paint-shop options.
    const repGain = raceRep(p.place, s.wrecked) + (run.flags.repGain || 0) - (run.flags.repLoss || 0), repBefore = this.cos.rep;
    run.flags.repGain = run.flags.repLoss = 0;
    this.cos.rep += repGain;
    saveCosmetics(this.cos);
    const unlocked = allCosmeticOptions().filter((o) => o.rep > repBefore && o.rep <= this.cos.rep).map((o) => o.name);
    const parts = PART_SLOTS.map((slot) => `<span class="${b.parts[slot].dur <= 0 ? 'bad' : ''}">${SLOT_NAMES[slot]} ${b.parts[slot].dur <= 0 ? 'BROKEN' : Math.round((100 * b.parts[slot].dur) / partMaxDur(b, b.parts[slot].id)) + '%'}</span>`).join(' · ');
    const rows = race.ranking.map((c, i) => `<tr class="${c.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><span class="dot" style="background:${c.color}"></span>${c.name}${c.weapon ? ' ⚔' : ''}</td><td>${c.finished ? fmtTime(c.finishTime) : '—'}</td><td>${Math.ceil(c.hp)} HP</td></tr>`).join('');
    this.setUI(`<div class="screen results">
      <h1 class="${ok ? 'good' : 'bad'}">${ordinal(p.place)} place: ${ok ? (boss ? (boss.mustWin ? 'you won the Crown' : boss.name + ' beaten') : 'you survived') : 'strike ' + b.strikes + ' of ' + STRIKES_TO_LOSE}</h1>
      <p class="muted">${boss ? (ok ? (boss.mustWin ? 'The upper city is on its feet.' : 'You qualify for the next act.') : `${boss.name} is still ahead of you. Patch up and face them again.`) : ok ? 'Top 3 keeps the warden happy.' : 'Finish outside the top 3 three times and the run is over.'}</p>
      <div class="results-grid">
        <table class="standings">${rows}</table>
        <div class="payout">
          <div><span>Damage dealt</span><b>${Math.round(s.dealt)}</b></div>
          <div><span>Rivals wrecked</span><b>${s.wrecked}</b></div>
          <div><span>Rockets &amp; mines shot down</span><b>${s.shotDown}</b></div>
          <div><span>Parries</span><b>${s.parries}</b></div>
          <div><span>Damage taken</span><b>${Math.round(s.taken)}</b></div>
          <div><span>Hull left</span><b>${Math.ceil(p.hp)} / ${b.maxHull}</b></div>
          <div><span>Placing pay</span><b>${placePay} scrap</b></div>
          <div><span>Wreck bounties</span><b>${wreckPay} scrap</b></div>
          ${bossPay ? `<div><span>Qualifier purse</span><b>${bossPay} scrap</b></div>` : ''}
          ${bc ? `<div><span>Bounty on ${bc.name}</span><b>${bountyPay ? bountyPay + ' scrap' : 'not wrecked'}</b></div>` : ''}
          ${sponsorCut ? `<div><span>Sponsor takes back</span><b class="bad">-${sponsorCut} scrap</b></div>` : ''}
          ${betPay ? `<div><span>Bet winnings</span><b>${betPay} scrap</b></div>` : ''}
          <div class="total"><span>Scrap</span><b>${b.scrap}</b></div>
          <div><span>Reputation</span><b>+${repGain} (${this.cos.rep})</b></div>
          ${unlocked.length ? `<div class="unlock small">Paint shop unlocked: ${unlocked.join(', ')}</div>` : ''}
          <p class="small">${parts}</p>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn primary big" data-action="after-results">${b.strikes >= STRIKES_TO_LOSE ? 'Face the warden' : ok ? (boss && boss.mustWin ? 'Walk free ▶' : 'Collect reward ▶') : 'Back to the garage ▶'}</button>
      </div>
    </div>`);
  },

  // ---------- Garage / shop / rewards ----------

  showGarage() {
    this.state = 'garage';
    const b = this.build, act = this.act;
    const bar = (f, broken) => `<div class="bar"><div style="width:${Math.round(clamp(f, 0, 1) * 100)}%" class="${broken || f < 0.3 ? 'low' : ''}"></div></div>`;
    const stations = [['car', 'Workshop', 'Parts, tuning & repairs'], ['weapons', 'Armory', 'Weapons, mods & ammo'], ['market', ACT_LUXURY(this.run.act) ? 'Concierge' : 'Commissary', this.shopOpen ? 'Open now' : 'Closed'], ['paint', 'Paint booth', 'Looks, kept between runs']];
    const nav = stations.map(([id, label, sub]) => `<button class="g-station ${this.tab === id ? 'on' : ''}" data-action="tab" data-arg="${id}"><b>${label}</b><small>${sub}</small></button>`).join('');
    const trinkets = b.trinkets.length ? b.trinkets.map((t) => `<span class="perk rarity-epic" title="${TRINKETS[t].desc}">${TRINKETS[t].name}</span>`).join('') : '<span class="muted small">No trinkets yet. They are the only things you keep for the whole run.</span>';
    const body = { car: () => this.garageCar(bar), weapons: () => this.garageWeapons(), market: () => this.garageMarket(), paint: () => this.garagePaint() }[this.tab]();
    const title = stations.find((st) => st[0] === this.tab);
    this.setUI(`<div class="screen garage proto-garage g3d">
      <div class="g-top">
        <div><b>Act ${ROMAN[this.run.act]}</b> · ${act.title}</div>
        <div class="cash">${b.scrap} scrap</div>
        <div>Strikes <b class="bad">${'●'.repeat(b.strikes)}</b><b>${'○'.repeat(STRIKES_TO_LOSE - b.strikes)}</b></div>
        <div>Rep <b>${this.cos.rep}</b></div>
        <button class="g-settings" data-action="settings" title="Settings">⚙ Settings</button>
      </div>
      <nav class="g-nav">${nav}</nav>
      <div class="g-panel clipboard">
        <div class="clip"></div>
        <h2 class="g-title">${title[1]}</h2>
        <div class="perks trinket-row">${trinkets}</div>
        ${body}
        <p class="small muted g-links"><a href="models.html">Model viewer</a> · <a href="index.html">Top-down game</a></p>
      </div>
      <button class="btn primary big g-go" data-action="to-map">Route sheet ▶</button>
    </div>`);
    this.syncGarage();
  },

  syncGarage() {
    if (!this.preview) return;
    const b = this.build, act = this.act, run = this.run;
    const done = run.map.nodes.filter((n) => n.done && n.type !== 'boss').length;
    this.preview.sync({
      build: b, shop: this.shopOpen ? this.shop : [], cos: this.cos,
      act: { luxury: ACT_LUXURY(run.act), label: `Act ${ROMAN[run.act]}: ${act.title}`, progress: `Stop ${done + 1} of ${MAP_ROWS + 1} this act`, maxStrikes: STRIKES_TO_LOSE },
    });
    this.preview.setStation(this.tab);
  },

  garageCar(bar) {
    const b = this.build, hullCost = repairHullCost(b);
    const slots = PART_SLOTS.map((slot) => {
      const part = b.parts[slot], def = PARTS[part.id], max = partMaxDur(b, part.id), broken = part.dur <= 0;
      const cost = repairPartCost(b, slot), tu = TUNING[slot];
      const tune = TUNE_STEPS.map((v) => `<button class="tune-step ${part.tune === v ? 'on' : ''}" data-action="tune" data-arg="${slot}:${v}" title="${v}"></button>`).join('');
      const alts = b.stash.parts.map((inst, i) => ({ inst, i })).filter(({ inst }) => PARTS[inst.id].slot === slot)
        .map(({ inst, i }) => `<button class="btn small" data-action="equip-part" data-arg="${i}" title="${PARTS[inst.id].desc}">Fit ${PARTS[inst.id].name} (${Math.max(0, Math.round(inst.dur))}/${partMaxDur(b, inst.id)})</button>`).join('');
      return `<div class="part-card">
        <div class="gp-row">
          <div class="gp-name"><small>${SLOT_NAMES[slot]}</small><b>${def.name}</b><small class="muted">${def.desc}</small></div>
          <div class="gp-bar">${bar(part.dur / max, broken)}<small>${broken ? '<span class="bad">BROKEN</span>' : Math.round(part.dur) + ' / ' + max}</small></div>
          <button class="btn small" data-action="repair-part" data-arg="${slot}" ${cost <= 0 || b.scrap < cost ? 'disabled' : ''}>${cost <= 0 ? 'OK' : 'Fix ' + cost}</button>
          <button class="btn small" data-action="buy-spare" data-arg="${slot}" ${b.spare || b.scrap < spareCost(b, slot) ? 'disabled' : ''} title="Carry a spare ${def.name} to fit mid-race">Spare ${spareCost(b, slot)}</button>
        </div>
        <div class="tune-row"><small>${tu.left}</small><span class="tune">${tune}</span><small>${tu.right}</small><small class="muted">${tu.desc}</small></div>
        ${alts ? `<div class="alts"><small class="muted">In your stash:</small> ${alts}</div>` : ''}
      </div>`;
    }).join('');
    const chips = b.stash.chips.map((id, i) => `<button class="btn small" data-action="equip-chip" data-arg="${i}" title="${CHIPS[id].desc}">Install ${CHIPS[id].name}</button>`).join('');
    return `<div class="garage-grid one">
      <div class="panel">
        <div class="gp-row"><div class="gp-name"><small>Hull</small><b>${Math.ceil(b.hull)} / ${b.maxHull}</b></div>
          <div class="gp-bar">${bar(b.hull / b.maxHull)}</div>
          <button class="btn small" data-action="repair-hull" ${hullCost <= 0 || b.scrap < hullCost ? 'disabled' : ''}>${hullCost <= 0 ? 'OK' : 'Repair ' + hullCost}</button></div>
        ${slots}
        <p class="small">Spare part: <b>${b.spare ? PARTS[b.spare.id].name : 'none'}</b> <span class="muted">(press <kbd>B</kbd> mid-race to fit it when that part breaks)</span></p>
        <h3>Driver chip</h3>
        <div class="gp-chip">${b.chip ? `<b>${CHIPS[b.chip].name}</b> <small class="muted">${CHIPS[b.chip].desc}</small>` : '<span class="muted small">Stock driver AI</span>'}</div>
        ${chips ? `<div class="alts">${chips}</div>` : ''}
      </div>
    </div>`;
  },

  garageWeapons() {
    const b = this.build, slots = rackSlots(b);
    const rack = b.rack.map((w, ri) => {
      const d = weaponStats(w);
      const mods = w.mods.map((m, ms) => {
        if (m) return `<span class="mod-chip on" title="${MODS[m].desc}">${MODS[m].name} <button class="x" data-action="remove-mod" data-arg="${ri}:${ms}">✕</button></span>`;
        const fits = b.stash.mods.map((id, si) => ({ id, si })).filter(({ id }) => modFits(id, w.id) && !w.mods.includes(id));
        return `<span class="mod-chip">Empty mod slot${fits.length ? ': ' + fits.map(({ id, si }) => `<button class="btn tiny" data-action="fit-mod" data-arg="${si}:${ri}:${ms}" title="${MODS[id].desc}">${MODS[id].name}</button>`).join('') : ''}</span>`;
      }).join('');
      return `<div class="part-card">
        <div class="gp-row"><div class="gp-name"><small>Rack ${ri + 1}</small><b>${d.name}</b><small class="muted">${WEAPONS[w.id].desc}</small></div>
          <div class="gp-ammo">${w.mag}/${d.mag} · ${w.reserve}</div>
          <button class="btn small" data-action="buy-ammo" data-arg="${ri}" ${b.scrap < d.packPrice ? 'disabled' : ''}>+${d.pack} for ${d.packPrice}</button>
          <button class="btn small ghost" data-action="unequip-weapon" data-arg="${ri}" ${b.rack.length <= 1 ? 'disabled' : ''}>To stash</button></div>
        <div class="mods">${mods}</div>
      </div>`;
    }).join('') + Array.from({ length: slots - b.rack.length }, () => '<div class="part-card muted small">Empty rack slot</div>').join('');
    const stashW = b.stash.weapons.map((w, si) => {
      const btns = b.rack.length < slots
        ? `<button class="btn small" data-action="equip-weapon" data-arg="${si}:-1">Add to rack</button>`
        : b.rack.map((r, ri) => `<button class="btn small" data-action="equip-weapon" data-arg="${si}:${ri}">Swap for ${WEAPONS[r.id].name}</button>`).join('');
      return `<div class="gp-row"><div class="gp-name"><b>${WEAPONS[w.id].name}</b><small class="muted">${w.mag}+${w.reserve} rounds${w.mods.some(Boolean) ? ' · ' + w.mods.filter(Boolean).map((m) => MODS[m].name).join(', ') : ''}</small></div>${btns}</div>`;
    }).join('');
    const abil = b.abilities.map((id, i) => `<div class="gp-chip"><kbd>${i === 0 ? 'Space' : 'E'}</kbd> ${id ? `<b>${ABILITIES[id].name}</b> <small class="muted">${ABILITIES[id].desc}</small>` : '<span class="muted">Empty</span>'}</div>`).join('');
    const stashA = b.stash.abilities.map((id, si) => `<div class="gp-row"><div class="gp-name"><b>${ABILITIES[id].name}</b><small class="muted">${ABILITIES[id].desc}</small></div>
      <button class="btn small" data-action="equip-ability" data-arg="${si}:0">On Space</button><button class="btn small" data-action="equip-ability" data-arg="${si}:1">On E</button></div>`).join('');
    const stashM = b.stash.mods.map((id) => `<span class="mod-chip" title="${MODS[id].desc}">${MODS[id].name} <small class="muted">(${MODS[id].fits.map((f) => SHORT_WEAPON[f]).join('/')})</small></span>`).join('');
    return `<div class="garage-grid">
      <div class="panel"><h2>Rack <small class="muted">(${b.rack.length}/${slots})</small></h2>${rack}
        <div class="gp-row"><div class="gp-name"><small>Throwable</small><b>Grenades</b></div><div class="gp-ammo">${b.grenades} / ${MAX_GRENADES}</div>
          <button class="btn small" data-action="buy-nade" ${b.grenades >= MAX_GRENADES || b.scrap < GRENADE_PRICE ? 'disabled' : ''}>+1 for ${GRENADE_PRICE}</button></div>
      </div>
      <div class="panel">
        <h2>Abilities</h2>${abil}
        <h2>Stash</h2>
        ${stashW || stashA || stashM ? '' : '<p class="muted small">Empty. Anything you win or buy that isn\'t equipped waits here.</p>'}
        ${stashW}${stashA}
        ${stashM ? `<h3>Loose mods</h3><div class="mods">${stashM}</div>` : ''}
      </div>
    </div>`;
  },

  garageMarket() {
    const b = this.build;
    if (!this.shopOpen) return `<div class="panel"><h2>Shuttered</h2><p>The hatch is padlocked. The ${ACT_LUXURY(this.run.act) ? 'concierge only sees drivers at a Concierge stop' : 'commissary only opens at a Commissary stop'} on the route sheet (🛒).</p><p class="muted small">Repairs, ammo, grenades and spare parts are always available in the Workshop and Armory.</p></div>`;
    const shop = this.shop.map((c, i) => `<div class="shop-card ${c.sold ? 'sold' : ''}">
        <small class="muted">${c.type.toUpperCase()}${c.type === 'part' ? ' · ' + SLOT_NAMES[PARTS[c.id].slot] : ''}${c.type === 'mod' ? ' · fits ' + MODS[c.id].fits.map((f) => WEAPONS[f].name).join(', ') : ''}</small>
        <b>${c.name}</b><small>${c.desc}</small>
        <button class="btn small" data-action="buy-item" data-arg="${i}" ${c.sold || b.scrap < c.price ? 'disabled' : ''}>${c.sold ? 'Sold' : 'Buy ' + c.price}</button>
      </div>`).join('');
    return `<div class="panel"><h2>Black market</h2><p class="muted small">Stock changes every visit. Purchases go into your stash (or a free slot).</p><div class="shop-grid three">${shop}</div></div>`;
  },

  garagePaint() {
    const c = this.cos, sub = this.paintTab || 'body';
    const opt = (key, list, render, cur = c[key], argKey = key) => list.map((o) => {
      const locked = o.rep > c.rep, on = cur === o.id;
      return `<button class="opt ${on ? 'on' : ''} ${locked ? 'locked' : ''}" ${locked ? 'disabled' : ''} data-action="cosmetic" data-arg="${argKey}:${o.id}" title="${locked ? 'Unlocks at ' + o.rep + ' reputation' : o.name}">${render ? render(o) : ''}<span>${locked ? '🔒 ' + o.rep : o.name}</span></button>`;
    }).join('');
    const sw = (o) => `<i class="swatch" style="background:${o.color}"></i>`;
    const L = COSMETICS, row = (title, html) => `<h3>${title}</h3><div class="opts">${html}</div>`;
    const next = allCosmeticOptions().filter((o) => o.rep > c.rep).sort((a, b2) => a.rep - b2.rep)[0];
    const pages = {
      body: () => row('Body', opt('style', L.style)) + row('Paint', opt('paint', L.paint, sw)) + row('Two-tone', opt('twoTone', L.twoTone))
        + (c.twoTone !== 'none' ? row('Second colour', opt('paint2', L.paint, sw)) : '')
        + row('Finish', opt('finish', L.finish)) + row('Grime', opt('grime', L.grime)) + row('Livery', opt('livery', L.livery))
        + `<h3>Race number</h3><div class="opts"><button class="opt" data-action="cosmetic" data-arg="number:${c.number - 1}">−</button><b class="num">${c.number}</b><button class="opt" data-action="cosmetic" data-arg="number:${c.number + 1}">+</button>
          <button class="opt" data-action="cosmetic" data-arg="number:${Math.floor(Math.random() * 100)}">Random</button></div>
          <h3>Number plate</h3><input id="plateInput" class="plate-input" maxlength="8" value="${c.plate}">`,
      kit: () => row('Rims', opt('rims', L.rims)) + row('Front bumper', opt('bumper', L.bumper)) + row('Roof', opt('roof', L.roof))
        + row('Spoiler', opt('spoiler', L.spoiler)) + row('Exhaust', opt('exhaust', L.exhaust)) + row('Underglow', opt('underglow', L.underglow, (o) => (o.color ? sw(o) : ''))),
      cabin: () => row('Seat covers', opt('seats', L.seats)) + row('Wheel wrap', opt('wheelWrap', L.wheelWrap)) + row('Dash', opt('dash', L.dash, sw))
        + row('Cabin bulb', opt('bulb', L.bulb, sw)) + row('Dash ornament', opt('ornament', L.ornament))
        + `<h3>Inmate number</h3><input id="inmateInput" class="plate-input" maxlength="6" value="${c.inmate}"><p class="muted small">Stencilled on the glovebox.</p>`,
      guns: () => Object.keys(SHORT_WEAPON).map((w) => row(SHORT_WEAPON[w], opt('gunFinish', L.gunFinish, null, c.gunFinish[w], 'gun.' + w))).join(''),
      presets: () => `<p class="muted small">Save your whole look (car, cabin and guns) into a slot and swap between them any time.</p>` + c.presets.map((p, i) => `<div class="preset-row">
          <b>Slot ${i + 1}</b> <span class="muted small">${p ? `${(cosOption('style', p.style) || {}).name || ''} · ${(cosOption('paint', p.paint) || {}).name || ''} · #${p.number}` : 'empty'}</span>
          <button class="opt" data-action="preset-save" data-arg="${i}">Save</button>
          <button class="opt" ${p ? '' : 'disabled'} data-action="preset-load" data-arg="${i}">Load</button></div>`).join(''),
    };
    const tabs = [['body', 'Body'], ['kit', 'Kit'], ['cabin', 'Cabin'], ['guns', 'Guns'], ['presets', 'Presets']]
      .map(([id, n]) => `<button class="opt ${sub === id ? 'on' : ''}" data-action="paint-tab" data-arg="${id}">${n}</button>`).join('');
    return `<div class="paint-opts">
      <p class="muted small">Your look is kept between runs. Reputation: <b>${c.rep}</b>${next ? ` · next unlock: ${next.name} at ${next.rep}` : ' · everything unlocked'}</p>
      <div class="opts subtabs">${tabs}</div>
      ${sub === 'cabin' || sub === 'body' || sub === 'kit' ? `<p class="muted small">Drag the view to look ${sub === 'cabin' ? 'round the cabin' : 'round the car'}${sub === 'cabin' ? '' : ' · scroll to zoom'}.</p>` : ''}${pages[sub]()}</div>`;
  },

  showReward() {
    const cards = this.rewards.map((c, i) => `<button class="up-card rarity-${c.type === 'trinket' || c.type === 'chip' ? 'epic' : c.type === 'part' ? 'common' : 'rare'}" data-action="pick-reward" data-arg="${i}">
      <div class="up-rarity">${c.type}</div>
      <div class="up-name">${c.name}</div>
      <div class="up-desc">${c.desc}</div>
      ${c.type === 'part' ? `<div class="up-desc"><i>Replaces your ${PARTS[this.build.parts[PARTS[c.id].slot].id].name}</i></div>` : ''}
    </button>`).join('');
    this.setUI(`<div class="screen reward">
      <h1>${this.rewardKind === 'boss' ? 'Driver trait' : this.rewardKind === 'elite' ? 'Elite spoils' : this.rewardKind === 'stash' ? 'Contraband stash' : 'Pick your cut'}</h1>
      <p class="muted">${this.rewardKind === 'boss' ? `${BOSSES[this.run.act].name} is beaten. Your driver picked up a habit or two: choose one (it fills your chip slot, swappable in the garage).` : this.build.scrap + ' scrap · choose one'}</p>
      <div class="cards">${cards}</div>
      <button class="btn ghost" data-action="skip-reward">Skip (+50 scrap)</button>
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
    this.renderPreview(dt);
    Input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  },

  updateRace(dt) {
    const race = this.race, combat = this.combat, p = race.player;
    if (Input.consume('Digit1')) combat.select(0);
    if (Input.consume('Digit2')) combat.select(1);
    if (Input.consume('Digit3')) combat.select(2);
    if (Input.consume('KeyQ')) combat.cycle(1);
    if (Input.consume('KeyR')) combat.reload();
    if (Input.consume('Space')) combat.activateAbility(0);
    if (Input.consume('KeyE')) combat.activateAbility(1);
    if (Input.consume('KeyB')) combat.fitSpare();
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

  // The 3D garage fills the screen behind the clipboard (and behind the reward pick).
  renderPreview(dt) {
    const cv = this.previewCanvas;
    const show = this.preview && ['garage', 'reward', 'map', 'event'].includes(this.state);
    if (!show) { cv.style.display = 'none'; if (this.tip) this.tip.classList.add('hidden'); return; }
    cv.style.display = 'block';
    if (this.state !== 'garage') this.preview.setStation('overview');
    const panel = this.state === 'garage' && this.W > 900 ? 500 : 0;
    this.preview.render(this.W, this.H, dt, this.time, panel);
    // Keep the hover and tooltip true to what is under the cursor while the camera eases between stations.
    if (this.state === 'garage' && this.gMouse && !(this.gDrag && this.gDrag.moved)) {
      const r = cv.getBoundingClientRect(), m = this.gMouse;
      const hot = this.preview.pick(((m.x - r.left) / r.width) * 2 - 1, -((m.y - r.top) / r.height) * 2 + 1);
      cv.style.cursor = hot ? 'pointer' : 'default';
      this.tip.classList.toggle('hidden', !hot);
      if (hot) this.tip.textContent = hot.label;
    }
  },

  render(dt) {
    const ctx = this.ctx, W = this.W, H = this.H, race = this.race;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const offTrack = ['garage', 'reward', 'over'].includes(this.state);
    this.c3d.style.visibility = offTrack ? 'hidden' : 'visible';
    if (!race || offTrack) { ctx.fillStyle = '#100f0c'; ctx.fillRect(0, 0, W, H); return; }
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

const SHORT_WEAPON = { smg: 'SMG', shotgun: 'Shotgun', rocket: 'Launcher', flare: 'Flare' };

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
  const c = P.combat, b = c.build;
  const rows = b.rack.length + 1 + 2 + 1;
  const h = 26 + rows * 24 + 34;
  const x = W - 262, y = H - h - 12;
  hudPanel(ctx, x, y, 250, h);
  ctx.textAlign = 'left';
  let yy = y + 22;
  const line = (active, label, right, frac, col) => {
    ctx.fillStyle = active ? '#ffd23f' : 'rgba(255,255,255,0.65)';
    ctx.font = `${active ? 'bold ' : ''}14px ${hudFont()}`;
    ctx.fillText(label, x + 12, yy);
    ctx.textAlign = 'right';
    ctx.fillText(right, x + 238, yy);
    ctx.textAlign = 'left';
    if (frac != null) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 12, yy + 5, 226, 4);
      ctx.fillStyle = col;
      ctx.fillRect(x + 12, yy + 5, 226 * clamp(frac, 0, 1), 4);
    }
    yy += 24;
  };
  b.rack.forEach((w, i) => {
    const d = weaponStats(w), st = c.wstate[i];
    const reloading = st.reloadT > 0;
    line(i === c.wi, `${i + 1} ${d.name}`, reloading ? 'RELOADING' : `${w.mag} | ${w.reserve}`, reloading ? 1 - st.reloadT / d.reload : w.mag / d.mag, reloading ? '#ff9f1c' : '#5ad8ff');
  });
  line(false, 'G Grenades', `${b.grenades}`, null);
  c.abil.forEach((a, i) => {
    if (!a) { line(false, `${i === 0 ? '␣' : 'E'} —`, '', null); return; }
    const def = ABILITIES[a.id];
    const active = a.id === 'shield' && c.shield.t > 0;
    line(active, `${i === 0 ? '␣' : 'E'} ${def.name}`, active ? 'ACTIVE' : a.cd > 0 ? `${a.cd.toFixed(1)}s` : 'READY', a.cd > 0 ? 1 - a.cd / def.cooldown : 1, '#7cfc00');
  });
  line(false, 'A/D Swerve', c.swerveCd > 0 ? `${c.swerveCd.toFixed(1)}s` : 'ready', null);
  // Parts strip
  PART_SLOTS.forEach((slot, i) => {
    const part = b.parts[slot], f = clamp(part.dur / partMaxDur(b, part.id), 0, 1), broken = part.dur <= 0;
    const px = x + 12 + i * 58;
    ctx.fillStyle = broken ? '#ff3b1f' : 'rgba(255,255,255,0.65)';
    ctx.font = `bold 11px ${hudFont()}`;
    ctx.fillText(['ENG', 'TYR', 'ARM', 'NOS'][i], px, yy - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(px, yy, 50, 5);
    ctx.fillStyle = broken ? (Math.floor(P.time * 4) % 2 ? '#ff3b1f' : '#551008') : f < 0.3 ? '#ff7a1f' : '#ffd23f';
    ctx.fillRect(px, yy, 50 * (broken ? 1 : f), 5);
  });
  if (b.spare) {
    const canFit = partBroken(b, PARTS[b.spare.id].slot);
    ctx.fillStyle = canFit ? (Math.floor(P.time * 3) % 2 ? '#ffd23f' : '#fff') : 'rgba(255,255,255,0.5)';
    ctx.font = `bold 11px ${hudFont()}`;
    ctx.fillText(canFit ? `B: FIT SPARE ${PARTS[b.spare.id].name.toUpperCase()}` : `Spare: ${PARTS[b.spare.id].name}`, x + 12, yy + 20);
  }
}

// Fitting a spare: a progress bar in the middle of the screen.
function drawFitProgress(ctx, P, W, H) {
  const c = P.combat;
  if (!c.busy) return;
  const f = 1 - c.fitT / FIT_TIME;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(W / 2 - 140, H * 0.62, 280, 44);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(W / 2 - 128, H * 0.62 + 28, 256 * f, 8);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = `bold 15px ${hudFont()}`;
  ctx.fillText('FITTING SPARE PART…', W / 2, H * 0.62 + 20);
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

  // Crosshair: shape depends on the weapon; a ring fills while reloading.
  const cx = W / 2, cy = H / 2, wd = c.weaponDef, wst = c.wstate[c.wi];
  ctx.strokeStyle = c.weapon.mag <= 0 && c.weapon.reserve <= 0 ? '#ff3b1f' : 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  if (c.weapon.id === 'smg') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath(); ctx.moveTo(cx + dx * 6, cy + dy * 6); ctx.lineTo(cx + dx * 14, cy + dy * 14); ctx.stroke();
    }
  } else if (c.weapon.id === 'shotgun') {
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  } else if (c.weapon.id === 'flare') {
    ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx + 10, cy); ctx.lineTo(cx, cy + 10); ctx.lineTo(cx - 10, cy); ctx.closePath(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  }
  if (wst.reloadT > 0) {
    ctx.strokeStyle = '#ff9f1c';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 34, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - wst.reloadT / wd.reload)); ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.font = `bold 12px ${hudFont()}`;
  ctx.fillStyle = c.weapon.mag === 0 ? '#ff6b6b' : 'rgba(255,255,255,0.8)';
  ctx.fillText(wst.reloadT > 0 ? 'RELOADING' : c.weapon.mag === 0 ? (c.weapon.reserve > 0 ? 'R TO RELOAD' : 'NO AMMO') : `${c.weapon.mag}`, cx, cy + 48);

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
  drawFitProgress(ctx, P, W, H);
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
  ctx.strokeStyle = c.weapon.mag <= 0 ? '#ff3b1f' : '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx, my, 10, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx - 16, my); ctx.lineTo(mx - 6, my); ctx.moveTo(mx + 6, my); ctx.lineTo(mx + 16, my);
  ctx.moveTo(mx, my - 16); ctx.lineTo(mx, my - 6); ctx.moveTo(mx, my + 6); ctx.lineTo(mx, my + 16); ctx.stroke();
  drawWeaponPanel(ctx, P, W, H);
  drawFitProgress(ctx, P, W, H);
}

window.addEventListener('load', () => Proto.init());
