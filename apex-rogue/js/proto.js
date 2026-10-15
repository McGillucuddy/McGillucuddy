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
const RUN_KEY = 'apexrogue_run_v1'; // the run in progress, so it survives a reload

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
    Trinkets.inmate = this.cos.inmate; // the number on the Signed Mugshot
    Settings.load();
    Playtest.load();
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
      Intro.warm(this); // the cold open's car and people go first: they mesh while the gate and the sting are up
      for (const id of Object.keys(WEAPONS)) Models.weapon(id); // the guns (their fitted gloves follow once these are meshed)
      for (const id of Object.keys(WEAPONS)) Models.gunKit(Models.weapon(id), id, this.cos.gunKit[id], this.cos.patchSeed[id]); // your welded-on junk
      for (const style of Object.keys(CAR_STYLES)) Models.car({ style, color: '#888888' });
      Models.car(Object.assign({}, carLook(this.cos, this.build), { shell: true })); // your own car, seen from inside
      Models.interior('#888888', {});
      Models.rocketPod(); Models.mineDropper(); Models.gunner(); Models.grenade(); Models.rocket(); Models.mine(); Models.grenadeCrate();
      for (const id of Object.keys(TRINKET_MOUNT)) Models.trinket(id);
      for (const id of ['hula', 'dog', 'saint', 'skull']) Models.ornament(id);
      for (const id of Object.keys(WEAPONS)) Models.ammoItem(id);
      Models.harpoonBolt();
      Models.ammoItem('flare', 1);
      const M = Env.models; // the undercity first (act I), then the rest
      M.fireBarrel(); M.wreck(4); M.wreck(8); M.junk(5); Env.guardTower(); M.palm(3); M.palm(8); M.palm(5); M.palm(13);
      M.topiary(1); M.topiary(2); M.fountain(); M.statue(); M.colonnade(); M.flags(1); M.flags(2);
      // Last: every bolt-on kit piece on every body, so rivals' random kits never stall a race load.
      for (const style of Object.keys(CAR_STYLES)) for (const [bumper, roof] of [['pushbar', 'rails'], ['bullbar', 'rack'], ['plow', 'lightbar'], ['stock', 'cage']]) Models.car({ style, color: '#888888', bumper, roof });
    } finally { Sculpt.collect = false; }
    // The gloves are fitted to each gun's measured grip, so they're queued as soon as the guns themselves are meshed
    // (the guns go first), and jump the queue: a race can't start without them.
    let gloves = false, check = 0;
    const pump = (t) => {
      if (!gloves && t - check > 250) {
        check = t;
        const ready = Sculpt.jobs.every((j) => !Object.keys(WEAPONS).some((id) => Models.SCULPT_KEY(id) === j.key));
        if (ready) {
          gloves = true;
          const n = Sculpt.jobs.length;
          Sculpt.collect = true;
          try { for (const id of Object.keys(WEAPONS)) Models.hands(Models.weapon(id), id); } finally { Sculpt.collect = false; }
          Sculpt.jobs.unshift(...Sculpt.jobs.splice(n));
        }
      }
      if (Sculpt.runJobs(10) || !gloves) requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);
    window.addEventListener('resize', () => this.resize());
    this.resize();

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      const wheel = (this.emoteHold && this.emoteHold.open && this.emoteHold) || (this.orderHold && this.orderHold.open && this.orderHold);
      if (this.locked && wheel) { // steering the emote or order wheel
        const E = wheel;
        E.x = clamp(E.x + e.movementX, -120, 120); E.y = clamp(E.y + e.movementY, -120, 120);
      } else if (this.locked && this.cockpit) {
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
      if (e.button === 2) { this.mouse.rdown = true; this.combat.cookGrenade(); } // pull the pin; let go to throw
      if (e.button === 1) { e.preventDefault(); this.combat.order('ram', this.aimAngle()); } // "Ram them!" (js/orders.js)
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) { this.mouse.rdown = false; if (this.state === 'race' && this.combat && this.combat.cook) this.throwGrenade(); }
    });
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
      if (this.state === 'garage') this.saveRun(); // purchases, fittings, tuning
    });
    this.ui.addEventListener('change', (e) => {
      if (e.target.id === 'plateInput') this.action('cosmetic', 'plate:' + e.target.value);
      if (e.target.id === 'inmateInput') this.action('cosmetic', 'inmate:' + e.target.value);
      if (e.target.id === 'carNameInput' && this.build) { CarHistory.rename(this.build, e.target.value); this.saveRun(); this.showGarage(); }
    });

    // Browsers hold sound back until the first click or key; wake it then so the menu theme can start.
    const wake = () => Sound.resume();
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    if (/[?&]run\b/.test(location.search)) this.newRun(); // prototype.html?run skips the menu (and the intro)
    else if (/[?&]nointro\b/.test(location.search)) this.showTitle(this.loadRun() ? 'saved' : null);
    else this.playIntro({ gate: true, cold: !Settings.data.introSeen || /[?&]intro\b/.test(location.search) }); // ?intro forces the cold open
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    if (this.intro) this.intro.resize();
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
      case 'feedback': Playtest.show(); break;
      case 'resume': this.resume(); break;
      case 'to-briefing': this.showMap(); break;
      case 'to-map': this.showMap(); break;
      case 'tv-flip': this.tvFlip(this.tvSel + +arg); break;
      case 'tv-ch': if (+arg !== this.tvSel) this.tvFlip(+arg); else this.tvBook(); break; // a second click books it
      case 'tv-book': this.tvBook(); break;
      case 'tv-guide': this.guideOpen = !this.guideOpen; this.showMap(); break;
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
      case 'new-run': this.titleFrom = null; this.newRun(); break;
      case 'menu': if (this.picking) break; if (this.tutorial) this.leaveTutorial(); else this.showTitle(this.state === 'tutdone' ? this.titleFrom || null : undefined); break;
      case 'tutorial': this.startTutorial(); break;
      case 'tut-real': if (this.titleFrom) this.continueRun(); else this.action('new-run'); break;
      case 'title': this.showTitle(this.titleFrom || null); break;
      case 'title-new': if (this.titleFrom) this.showTitle(this.titleFrom, 'confirm'); else this.action('new-run'); break;
      case 'continue': this.continueRun(); break;
      case 'how-to': this.showTitle(this.titleFrom, 'howto'); break;
      case 'intro': this.playIntro({ cold: true, from: this.titleFrom }); break;
      case 'exit': this.exitGame(); break;
      case 'abandon': this.gameOver(false); break;
      case 'after-results': this.afterResults(); break;
      // Garage & shop
      case 'tab': this.tab = arg; if (this.preview) this.preview.setMode(arg === 'paint' ? ({ cabin: 'interior', guns: 'guns' }[this.paintTab] || 'car') : 'car'); this.showGarage(); break;
      case 'patch-gunner': { const c = Crew.gunnerPatchCost(b); if (c > 0 && buy(c)) b.gunnerHp = GUNNER.hp; this.showGarage(); break; }
      case 'patch-driver': { const c = Crew.patchCost(b); if (c > 0 && buy(c)) b.driverHp = DRIVER.hp; this.showGarage(); break; }
      case 'car-reroll': CarHistory.reroll(b); this.showGarage(); break;
      case 'repair-hull': { const c = repairHullCost(b); if (c > 0 && buy(c)) { b.hull = b.maxHull; CarHistory.repaired(b); } this.showGarage(); break; }
      case 'repair-hatch': { const c = repairHatchCost(b); if (c > 0 && buy(c)) b.hatch.hp = HATCH.max; this.showGarage(); break; }
      case 'repair-part': { const c = repairPartCost(b, arg); if (c > 0 && buy(c)) b.parts[arg].dur = partMaxDur(b, b.parts[arg].id); this.showGarage(); break; }
      case 'buy-spare': if (!b.spare && buy(spareCost(b, arg))) b.spare = { id: b.parts[arg].id }; this.showGarage(); break;
      case 'buy-ammo': { const w = b.rack[+arg], d = weaponStats(w); if (buy(d.packPrice)) w.reserve += d.pack; this.showGarage(); break; }
      case 'buy-roof-ammo': { const w = ensureRoof(b).gun; if (w) { const d = weaponStats(w); if (buy(d.packPrice)) w.reserve += d.pack; } this.showGarage(); break; }
      case 'buy-shield': { const R = ensureRoof(b), T = ROOF_SHIELDS[arg]; if (R.gun && T && R.shield !== arg && buy(T.price)) { R.shield = arg; R.shieldHp = T.hp; } this.showGarage(); break; }
      case 'repair-shield': { const R = ensureRoof(b), c = shieldRepairCost(b); if (c > 0 && buy(c)) R.shieldHp = ROOF_SHIELDS[R.shield].hp; this.showGarage(); break; }
      case 'buy-nade': if (b.grenades < MAX_GRENADES && buy(GRENADE_PRICE)) b.grenades++; this.showGarage(); break;
      case 'buy-item': {
        const card = this.shop[+arg];
        if (!card || card.sold || !buy(card.price)) break;
        applyItem(b, card);
        card.sold = true;
        this.showGarage();
        break;
      }
      case 'buy-contra': {
        const c = this.dealer && this.dealer.stock[+arg];
        if (!c || c.sold || (c.type !== 'trinket' && b.pocket.length >= POCKET_MAX) || !buy(c.price)) break;
        if (c.type === 'trinket') applyItem(b, itemCard('trinket', c.id));
        else b.pocket.push({ id: c.id });
        c.sold = true;
        this.saveRun();
        this.showGarage();
        break;
      }
      case 'buy-fan': {
        const c = this.fans && this.fans.stock[+arg], run = this.run;
        if (!c || Infamy.blocked(c, b, run) || (b.infamy || 0) < c.price) break;
        b.infamy -= c.price;
        if (c.type === 'trinket') applyItem(b, itemCard('trinket', c.id));
        else if (c.id === 'care') { b.hull = Math.min(b.maxHull, b.hull + 40); b.grenades = Math.min(MAX_GRENADES, b.grenades + 1); }
        else if (c.id === 'ammo') { for (const w of b.rack.concat(b.roof && b.roof.gun ? [b.roof.gun] : [])) { const d = weaponStats(w); if (d.pack) w.reserve += d.pack * 2; } }
        else if (c.id === 'donations') b.scrap += FAN_DONATION(run.act);
        else if (c.id === 'crowd') run.flags.crowd = true;
        else if (c.id === 'encore') { b.strikes = Math.max(0, b.strikes - 1); run.flags.encoreAct = run.act; }
        c.sold = true;
        Sound.play({ type: 'buy' });
        this.saveRun();
        this.showGarage();
        break;
      }
      case 'pocket-use': {
        const x = b.pocket[+arg];
        if (!x) break;
        x.use = !x.use;
        if (x.use) for (const y of b.pocket) if (y !== x && CONTRABAND[y.id].kind === CONTRABAND[x.id].kind) y.use = false; // one of each kind a race
        this.showBriefing();
        break;
      }
      case 'pick-reward': applyItem(b, this.rewards[+arg]); Sound.play({ type: 'buy' }); this.afterReward(); break;
      case 'skip-reward': b.scrap += SKIP_SCRAP; this.afterReward(); break;
      // Loadout (swappable here; only trinkets are permanent)
      case 'equip-part': equipPart(b, +arg); this.showGarage(); break;
      case 'equip-weapon': { const [si, ri] = arg.split(':').map(Number); equipWeapon(b, si, ri >= 0 ? ri : null); this.showGarage(); break; }
      case 'unequip-weapon': unequipWeapon(b, +arg); this.showGarage(); break;
      case 'equip-ability': { const [si, slot] = arg.split(':').map(Number); equipAbility(b, si, slot); this.showGarage(); break; }
      case 'equip-chip': equipChip(b, +arg); this.showGarage(); break;
      case 'fit-mod': { const [si, ri, slot] = arg.split(':').map(Number); fitMod(b, si, ri, slot); Sound.play({ type: 'reloaded' }); this.showGarage(); break; }
      case 'remove-mod': { const [ri, slot] = arg.split(':').map(Number); removeMod(b, ri, slot); this.showGarage(); break; }
      case 'tune': { const [slot, v] = arg.split(':'), R = tuneRange(b, slot), n = Math.round(+v * 2); if (n >= R.lo && n <= R.hi) b.parts[slot].tune = +v; this.showGarage(); break; }
      case 'weld': { const [slot, dir] = arg.split(':'); if (weldNotch(b, slot, +dir)) Sound.play({ type: 'buy' }); this.showGarage(); break; }
      // Paint shop (saved between runs)
      case 'paint-tab': this.paintTab = arg; if (this.preview) this.preview.setMode({ cabin: 'interior', guns: 'guns' }[arg] || 'car'); this.showGarage(); break;
      case 'preset-save': savePreset(this.cos, +arg); saveCosmetics(this.cos); this.showGarage(); break;
      case 'preset-load': loadPreset(this.cos, +arg); saveCosmetics(this.cos); if (this.preview) this.preview.setLook(carLook(this.cos, this.build)); this.showGarage(); break;
      case 'cosmetic': {
        const i = arg.indexOf(':'), key = arg.slice(0, i), val = arg.slice(i + 1);
        if (key === 'number') this.cos.number = (+val + 100) % 100;
        else if (key === 'plate') this.cos.plate = val.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 8) || 'INM 4471';
        else if (key === 'inmate') this.cos.inmate = val.replace(/[^0-9]/g, '').slice(0, 6) || '4471';
        else if (key.startsWith('gun.')) this.cos.gunFinish[key.slice(4)] = val;
        else if (key.startsWith('kit.')) this.cos.gunKit[key.slice(4)] = val;
        else if (key.startsWith('reweld.')) this.cos.patchSeed[key.slice(7)] = (this.cos.patchSeed[key.slice(7)] || 0) + 1;
        else this.cos[key] = val;
        saveCosmetics(this.cos);
        if (this.preview) this.preview.setLook(carLook(this.cos, this.build));
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

  // ---------- Title ----------

  // The start menu, over the garage with your car turning slowly on the lift.
  // `from` is the state a run in progress was left in, so Continue can drop you back into it.
  showTitle(from, panel) {
    if (this.locked) document.exitPointerLock();
    Sound.engine(0, 0, false, false);
    if (from === undefined) from = this.build && ['map', 'garage', 'briefing', 'paused'].includes(this.state) ? this.state : null;
    this.titleFrom = from;
    this.titlePanel = panel || null;
    this.state = 'title';
    this.mouse.down = false;
    if (this.preview) this.preview.setLook(carLook(this.cos, this.build || newBuild()));
    const b = this.build, run = this.run;
    const where = from && run ? `Act ${ROMAN[run.act]} · ${ACTS[run.act].title} · ${b.scrap} scrap · strikes ${'●'.repeat(b.strikes)}${'○'.repeat(STRIKES_TO_LOSE - b.strikes)}` : '';
    let side = '';
    if (panel === 'confirm') {
      side = `<div class="t-panel">
        <h2>Abandon this run?</h2>
        <p>Your run in ${ACTS[run.act].title} ends here. Your paint and finishes are kept; nothing else is.</p>
        <div class="t-row"><button class="btn primary" data-action="new-run">Start over</button><button class="btn" data-action="title">Keep it</button></div>
      </div>`;
    } else if (panel === 'howto') {
      side = `<div class="t-panel howto">
        <h2>How it works</h2>
        <p>You are a prisoner riding gun in a death race. Climb the channels from public access to prime time and win the Crown to walk free. Finish outside the qualifying places three times and you're back in your cell.</p>
        <p>Between races: buy and fit parts in the garage, tune them, load the gun rack, and paint the car. Scrap is your money and Infamy is your fame, both for this run only: every run starts from nothing, with every gun, part and paint job out there to find.</p>
        <h3>In the car</h3>
        <div class="ctl"><kbd>Mouse</kbd> Aim · <kbd>LMB</kbd> Fire · <kbd>R</kbd> Reload</div>
        <div class="ctl"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Weapons · <kbd>Q</kbd>/<kbd>Wheel</kbd> switch</div>
        <div class="ctl"><kbd>RMB</kbd>/<kbd>G</kbd> Grenade (land one in a rival's open hatch or window) · <kbd>E</kbd>/<kbd>F</kbd> Abilities</div>
        <div class="ctl"><kbd>Space</kbd> (hold) Slam the blast hatch: it stops bullets and most of a blast, but you can't shoot. Slam it as a rocket hits to bat it back.</div>
        <div class="ctl"><kbd>A</kbd>/<kbd>D</kbd> Tell the driver to swerve · <kbd>B</kbd> Fit spare part</div>
        <div class="ctl"><kbd>V</kbd> (or <kbd>4</kbd>) Climb up to the roof gun, if you've mounted one, and back down. Steadier and all the way round, but you're exposed and the blast hatch can't cover you.</div>
        <div class="ctl"><kbd>T</kbd> Emote at a rival (hold for the wheel): they get tilted. Pass or wreck them while they're seething for Infamy.</div>
        <div class="ctl"><kbd>M</kbd> Mute · <kbd>Esc</kbd> Pause</div>
        <button class="btn" data-action="title">Back</button>
      </div>`;
    }
    this.setUI(`<div class="screen titlescreen g3d">
      <div class="t-menu">
        <h1 class="t-logo"><small>${STUDIO.name} presents</small>DEATH ROW<span>DERBY</span></h1>
        <p class="t-tag">Win the Crown and walk free. Three strikes and you go back to the cell.</p>
        ${from ? `<button class="btn primary big" data-action="continue">Continue ▶<small>${where}</small></button>` : ''}
        <button class="btn ${from ? '' : 'primary big'}" data-action="title-new">New run</button>
        <button class="btn" data-action="tutorial">Tutorial${Settings.data.tutorialDone ? '' : '<small>New here? Start with a practice race.</small>'}</button>
        <button class="btn" data-action="settings">Settings</button>
        <button class="btn" data-action="how-to">How to play</button>
        <button class="btn ghost" data-action="exit">Exit</button>
        <p class="t-links small"><a href="#" data-action="feedback">Send feedback</a> · <a href="#" data-action="intro">Watch intro</a>${window.RELEASE ? '' : ' · <a href="models.html">Model viewer</a>'} ${window.BUILD ? ` · <span class="muted">${window.BUILD}</span>` : ''}</p>
      </div>
      ${side}
    </div>`);
  },

  // The studio sting, then (the first time, or from the title menu) the cold open. See js/intro.js.
  playIntro(opts) {
    if (this.locked) document.exitPointerLock();
    this.introFrom = opts.from;
    this.state = 'intro';
    this.setUI('');
    try { this.intro = new Intro(this, opts); } catch (e) { console.error(e); this.intro = null; this.introDone(); }
  },

  introDone() {
    Settings.data.introSeen = true;
    Settings.save();
    this.intro = null;
    if (this.introFrom === undefined) this.showTitle(this.loadRun() ? 'saved' : null);
    else this.showTitle(this.introFrom);
  },

  continueRun() {
    const from = this.titleFrom;
    this.titleFrom = null;
    this.titlePanel = null;
    if (from === 'saved') { // a run from an earlier session
      Playtest.resumeRun();
      const d = this.saved;
      this.saved = null;
      if (d.where === 'pending' && d.pending != null) { this.state = 'map'; this.pickNode(d.pending); }
      else if (d.where === 'garage') this.toGarage();
      else if (d.where === 'reward' && this.rewards) { this.state = 'reward'; this.showReward(); }
      else this.showMap();
      return;
    }
    if (from === 'paused') { this.state = 'paused'; this.showPause(); }
    else if (from === 'briefing') { this.state = 'briefing'; this.showBriefing(); }
    else if (from === 'garage') this.toGarage();
    else if (from === 'map') this.showMap();
    else this.newRun();
  },

  // Browsers only let a page close a tab it opened, so fall back to a lights-out screen.
  exitGame() {
    const from = this.titleFrom;
    Sound.engine(0, 0, false, false);
    try { window.close(); } catch (e) { /* not ours to close */ }
    setTimeout(() => {
      if (window.closed) return;
      this.state = 'bye';
      this.titleFrom = from;
      this.setUI(`<div class="screen bye">
        <h1>Lights out</h1>
        <p class="muted">The garage door rolls down. You can close this tab now${from ? '; your run waits here until you do' : ''}.</p>
        <button class="btn" data-action="title">Back to the menu</button>
      </div>`);
    }, 150);
  },

  // ---------- Saving the run ----------
  // The run is saved at the calm points: the route sheet, the garage, a reward pick. If you were in the middle of
  // a stop (a race, an event) when the page went away, the save remembers which one, and loading replays that pick
  // from the same random state, so you get the identical race back at its briefing.

  saveRun(pending) {
    if (this.tutorial || !this.build || !this.run || ['over', 'tutdone'].includes(this.state)) return;
    const where = pending != null ? 'pending' : this.state === 'garage' ? 'garage' : this.state === 'reward' ? 'reward' : 'map';
    if (pending == null && !['map', 'garage', 'reward'].includes(this.state)) return;
    const rng = this.runRng.state(); // nothing rolls between the route sheet and a pick, so a replay rolls the same race
    const data = {
      v: 1, where, pending, rng, runSeed: this.runSeed, build: this.build,
      run: Object.assign({}, this.run, { node: this.run.node ? this.run.node.id : null }),
      shop: this.shop, shopOpen: this.shopOpen, dealer: this.dealer || null, dealerKey: this.dealerKey || 0, fans: this.fans || null, tab: this.tab, rewards: this.rewards || null, rewardKind: this.rewardKind || null, pendingAct: this.pendingAct ?? null,
      saved: Date.now(),
    };
    try { localStorage.setItem(RUN_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  },

  clearRun() { try { localStorage.removeItem(RUN_KEY); } catch (e) { /* storage unavailable */ } },

  // Read a saved run back in (without showing anything). Returns true if there was one.
  loadRun() {
    let d;
    try { d = JSON.parse(localStorage.getItem(RUN_KEY)); } catch (e) { d = null; }
    if (!d || d.v !== 1 || !d.build || !d.run) return false;
    this.build = d.build;
    // Older saves: the shield became the blast hatch.
    ensureHatch(this.build);
    this.build.abilities = this.build.abilities.map((id) => (ABILITIES[id] ? id : null));
    this.build.stash.abilities = this.build.stash.abilities.filter((id) => ABILITIES[id]);
    this.run = d.run;
    this.run.node = d.run.node != null ? mapNode(this.run.map, d.run.node) : null;
    this.runSeed = d.runSeed;
    Crew.runSeed = this.runSeed; // your driver's name this run (js/crew.js)
    Crew.gens = this.build.crewGen = this.build.crewGen || {};
    this.runRng = mulberry32(d.rng);
    this.shop = d.shop || [];
    this.shopOpen = !!d.shopOpen;
    this.dealer = d.dealer || null;
    this.dealerKey = d.dealerKey || 0;
    this.fans = d.fans || null;
    { // older saves: machine guns used to be held; they live on the roof now
      const B = this.build, R = ensureRoof(B);
      for (let i = B.rack.length - 1; i >= 0; i--) if (WEAPONS[B.rack[i].id].roof && B.rack.length > 1) { const [w] = B.rack.splice(i, 1); if (!R.gun) R.gun = w; else B.stash.weapons.push(w); }
    }
    this.build.pocket = (this.build.pocket || []).map((x) => Object.assign(x, { id: CONTRA_RENAMED[x.id] || x.id })).filter((x) => CONTRABAND[x.id]);
    if (this.run.flags.comedown) this.run.flags.comedown = this.run.flags.comedown.map((id) => CONTRA_RENAMED[id] || id);
    this.tab = d.tab || 'car';
    this.rewards = d.rewards;
    this.rewardKind = d.rewardKind;
    this.pendingAct = d.pendingAct;
    this.race = null;
    this.saved = d;
    return true;
  },

  // ---------- Tutorial ----------

  // A practice race with a coach. Any run in progress is set aside and handed back afterwards.
  startTutorial() {
    if (this.locked) document.exitPointerLock();
    this.stash = this.build ? { build: this.build, run: this.run, runRng: this.runRng, race: this.race, combat: this.combat, driver: this.driver, seed: this.seed, from: this.titleFrom } : null;
    this.titleFrom = null;
    const b = this.build = newBuild();
    b.hull = b.maxHull = 300; // room to learn without wrecking
    addWeapon(b, 'rocket'); // a loaner from the warden, to learn the second slot
    b.grenades = 3;
    for (const w of b.rack) w.reserve = WEAPONS[w.id].pack * 8; // plenty to practise with: running dry would stall the reload step
    this.runRng = mulberry32(20261009);
    this.run = { act: 0, map: genActMap(this.runRng, 0), cur: null, node: null, flags: { disarm: true } };
    this.tutorial = new Tutorial(this);
    this.newRace({ type: 'race', row: 0, tutorial: true });
  },

  // Put back whatever run was going before the tutorial (or nothing).
  restoreStash() {
    if (this.tutorial) { this.tutorial.destroy(); this.tutorial = null; }
    const s = this.stash;
    this.stash = null;
    if (!s) { this.build = this.run = this.race = this.combat = null; this.titleFrom = null; return; }
    Object.assign(this, { build: s.build, run: s.run, runRng: s.runRng, race: s.race, combat: s.combat, driver: s.driver, seed: s.seed });
    this.titleFrom = s.from;
    if (s.race && this.cockpit && ['paused', 'briefing'].includes(s.from)) this.cockpit.load(s.race, s.combat, carLook(this.cos, s.build));
  },

  leaveTutorial() {
    if (this.locked) document.exitPointerLock();
    this.restoreStash();
    this.showTitle(this.titleFrom || null);
  },

  finishTutorial() {
    const p = this.race.player;
    this.race.rankCars();
    const place = p.place;
    Settings.data.tutorialDone = true;
    Settings.save();
    this.restoreStash();
    this.state = 'tutdone';
    this.setUI(`<div class="screen tut-end">
      <h1>Training done</h1>
      <p>You finished <b>${ordinal(place)}</b>. In a real race that ${place <= 3 ? '<b class="good">qualifies</b>' : '<b class="bad">is a strike</b>'}.</p>
      <h2>Between races</h2>
      <div class="tut-cards">
        <div class="panel"><h3>📺 Tonight's channels</h3><p>Each night the warden's office books you onto one of a few channels: races pay scrap, home shopping opens the commissary, the test card means free repairs, and the news can go either way. The TV guide shows where each choice leads. The boss is the special at the end of the act.</p></div>
        <div class="panel"><h3>🔧 Garage</h3><p>Fit better engines, tyres, armour and nitro, then tune them. Load the gun rack, fit attachments, buy ammo and grenades, and paint the car.</p></div>
        <div class="panel"><h3>⚖ Strikes and rep</h3><p>Miss the top 3 and you take a strike; three ends the run. Wrecks and podiums earn rep, which unlocks paint and finishes for every run after.</p></div>
      </div>
      <button class="btn primary big" data-action="tut-real">${this.titleFrom ? 'Back to my run' : 'Start a real run ▶'}</button>
      <button class="btn" data-action="menu">Main menu</button>
    </div>`);
  },

  // ---------- Run flow ----------

  newRun() {
    if (this.locked) document.exitPointerLock();
    this.build = newBuild();
    this.runSeed = (Math.random() * 2 ** 31) | 0;
    Crew.runSeed = this.runSeed;
    Crew.gens = this.build.crewGen = {};
    this.runRng = mulberry32(this.runSeed);
    this.race = null;
    this.shop = [];
    this.shopOpen = false;
    this.dealer = null;
    this.dealerKey = 0;
    this.fans = null;
    this.startAct(0, true);
    this.tab = 'car';
    if (this.preview) this.preview.setMode('car');
    this.toGarage(); // a new run starts in the garage: look the car over, then pick your race
    Playtest.startRun();
  },

  get act() { return ACTS[this.run.act]; },

  startAct(i, quiet) {
    this.run = { act: i, map: genActMap(this.runRng, i), cur: null, node: null, flags: (this.run && this.run.flags) || {}, seed: this.runSeed };
    if (!quiet) this.showMap();
  },

  // ---------- The wall of TVs (js/tv.js): tonight's channels ----------
  // A stack of mismatched sets, every one tuned to something. Tonight's channels (each reachable stop) play on the
  // big sets in the middle: click one (or ← →) to look at it, click it again (or Enter, or Book it) to take it. The
  // smaller sets round them show whatever else is on. The full route is the TV guide (the route sheet below).
  showMap() {
    if (this.guideOpen) { this.showGuide(); return; }
    this.state = 'map';
    this.saveRun();
    this.shopOpen = false;
    const b = this.build, run = this.run, act = this.act, shows = TV.lineup(run, b);
    this.tvShows = shows;
    this.tvSel = clamp(this.tvSel || 0, 0, shows.length - 1);
    const reachRow = shows.length ? shows[0].node.row : MAP_ROWS, left = MAP_ROWS - reachRow;
    const night = `Act ${ROMAN[run.act]} · ${TV.BLOCKS[run.act][2].toLowerCase()} · night ${reachRow + 1}${reachRow < MAP_ROWS ? ` · the special in ${left}` : ' · <b>tonight: the special</b>'}`;
    const fill = TV.fillers(run, 9);
    const ch = (n) => (n == null ? '' : `CH ${String(n).padStart(2, '0')}`);
    const unit = (show, i, main, v) => `<div class="tv-unit v${v} ${main ? 'main' : ''} ${main && i === this.tvSel ? 'on' : ''}" ${main ? `data-action="tv-ch" data-arg="${i}" title="${show.name}: click to look, click again to book"` : ''}>
        <div class="tv-screen"><canvas data-tv="${main ? 'm' : 'f'}${i}"></canvas><div class="tv-osd">${ch(show.ch)}</div>${main ? `<div class="tv-mini">${show.name}</div>` : ''}<div class="tv-glass"></div></div>
        <div class="tv-knobs"><i></i><i></i></div></div>`;
    const top = fill.slice(0, 5).map((f, i) => unit(f, i, false, (i * 3 + 1) % 4)).join('');
    const bottom = fill.slice(5).map((f, i) => unit(f, i + 5, false, (i * 3 + 2) % 4)).join('');
    const mid = shows.map((s, i) => unit(s, i, true, [0, 2, 1, 3][i % 4])).join('');
    this.setUI(`<div class="screen mapscreen tvscreen g3d">
      <div class="g-top">
        <div><b>Act ${ROMAN[run.act]}</b> · ${act.title}</div>
        <div class="cash">${b.scrap} scrap</div>
        <div class="infamy">${b.infamy || 0} infamy</div>
        <div>Hull <b>${Math.ceil(b.hull)}</b>/${b.maxHull}</div>
        <div>Strikes <b class="bad">${'●'.repeat(b.strikes)}</b><b>${'○'.repeat(STRIKES_TO_LOSE - b.strikes)}</b></div>
        <button class="g-settings" data-action="settings" title="Settings">⚙ Settings</button>
        <button class="g-settings g-menu" data-action="menu" title="Main menu">☰ Menu</button>
      </div>
      <div class="tv-wrap wall">
        <div class="tv-sheet">Booking sheet from the warden's office: <i>the following programmes will have you tonight.</i> <span class="muted">${night}</span></div>
        <div class="tv-row fill">${top}</div>
        <div class="tv-row mainrow">${mid}</div>
        <div class="tv-row fill">${bottom}</div>
        <div class="tv-detail" id="tvCap"></div>
        <div class="tv-actions">
          <button class="btn primary big" data-action="tv-book">Book it ▶</button>
          <button class="btn" data-action="tv-guide" title="The whole act: every channel and where each night leads">📰 TV guide</button>
          <button class="btn" data-action="open-garage">Garage</button>
        </div>
        <p class="muted small tv-hint">← → or A / D to pick a set · Enter (or click it again) to book</p>
      </div>
    </div>`);
    this.tvStates = shows.map((s) => ({ show: s, staticT: 0.3 + Math.random() * 0.3 }));
    document.querySelectorAll('canvas[data-tv]').forEach((cv) => {
      const k = cv.dataset.tv, i = +k.slice(1);
      if (k[0] === 'm') TV.run(cv, () => this.tvStates[i]);
      else { const st = { show: fill[i], staticT: Math.random() * 0.5 }; TV.run(cv, () => st, true); }
    });
    this.tvCaption();
    this.syncGarage();
    if (this.preview) this.preview.setStation('overview');
  },

  // Look at another set: it lights up, and its caption goes under the wall.
  tvFlip(i) {
    const shows = this.tvShows;
    if (!shows || !shows.length) return;
    this.tvSel = (i + shows.length) % shows.length;
    Sound.play({ type: 'click' });
    document.querySelectorAll('.tv-unit.main').forEach((el, k) => el.classList.toggle('on', k === this.tvSel));
    this.tvCaption();
  },

  tvCaption() {
    const S = this.tvShows && this.tvShows[this.tvSel], cap = document.getElementById('tvCap');
    if (!S || !cap) return;
    const wx = S.wx && S.wx !== WEATHER.clear ? ` · ${S.wx.icon} ${S.wx.name}` : '';
    cap.innerHTML = `<div class="tv-cap-top"><span class="tv-tag">CH ${String(S.ch).padStart(2, '0')}</span><b>${S.name}${S.sub ? ': ' + S.sub : ''}</b></div>
      <div class="tv-cap-line">${S.line}${wx}</div><div class="tv-cap-line2">${S.line2}</div>
      ${this.build && !this.tutorial ? `<div class="tv-cap-line2">Featuring ${this.cos.inmate || '4471'} in <b>${CarHistory.name(this.build)}</b>${CarHistory.of(this.build).kills.length ? ` · ${CarHistory.of(this.build).kills.length} kills` : ''}</div>` : ''}`;
  },

  tvBook() {
    const S = this.tvShows && this.tvShows[this.tvSel];
    if (!S || this.picking) return;
    this.picking = true;
    Sound.play({ type: 'click' });
    this.fadeThrough(() => { this.picking = false; this.tvSel = 0; this.pickNode(S.node.id); });
  },

  // ---------- Route sheet (the TV guide) ----------

  showGuide() {
    this.state = 'map';
    this.saveRun();
    this.shopOpen = false;
    const b = this.build, run = this.run, map = run.map, act = this.act, boss = BOSSES[run.act];
    const reach = reachableNodes(map, run.cur);
    // Stops: clear colour-coded markers with a plain label underneath.
    const nodes = map.nodes.map((n) => {
      const t = NODE_TYPES_RUN[n.type], can = reach.includes(n.id), p = RouteSheet.pos(n);
      const racing = ['race', 'elite', 'bounty', 'boss'].includes(n.type), wx = racing && !n.done ? wxOf(weatherFor(run.seed || 0, run.act, n.id)) : null; // the forecast
      const info = (n.type === 'boss' ? `<b>Qualifier: ${boss.name}</b>, ${boss.title}. ${boss.desc}` : `<b>${t.label}.</b> ${t.desc}`) + (wx ? `<br>${wx.icon} <b>${wx.name}:</b> ${wx.desc}` : '');
      return `<button class="stop t-${n.type} ${n.done ? 'done' : ''} ${can ? 'can' : ''}" style="left:${p.x * 100}%;top:${p.y * 100}%;--d:${(n.row * 0.05 + n.col * 0.02).toFixed(2)}s"
        ${can ? `data-action="pick-node" data-arg="${n.id}"` : 'disabled'} data-info="${info.replace(/"/g, '&quot;')}"><span>${t.icon}</span><small>${n.type === 'boss' ? 'Boss' : t.label}</small>${wx && wx !== WEATHER.clear ? `<i class="wx" title="${wx.name}">${wx.icon}</i>` : ''}</button>`;
    }).join('');
    const here = run.cur != null ? RouteSheet.pos(mapNode(map, run.cur)) : null;
    const hint = reach.length === 1 && mapNode(map, reach[0]).type === 'boss' ? `Next: the qualifier against ${boss.name}.` : 'Circled: tonight\'s channels. Click one to book it, or go back to the TV.';
    this.setUI(`<div class="screen mapscreen g3d">
      <div class="g-top">
        <div><b>Act ${ROMAN[run.act]}</b> · ${act.title}</div>
        <div class="cash">${b.scrap} scrap</div>
        <div>Hull <b>${Math.ceil(b.hull)}</b>/${b.maxHull}</div>
        <div>Strikes <b class="bad">${'●'.repeat(b.strikes)}</b><b>${'○'.repeat(STRIKES_TO_LOSE - b.strikes)}</b></div>
        <button class="g-settings" data-action="settings" title="Settings">⚙ Settings</button>
        <button class="g-settings g-menu" data-action="menu" title="Main menu">☰ Menu</button>
      </div>
      <div class="route clipboard sheet">
        <div class="clip"></div>
        <div class="form-head">
          <canvas id="mugshot" width="120" height="140"></canvas>
          <div>
            <div class="form-title">TV guide · Act ${ROMAN[run.act]}: ${act.title}</div>
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
      <button class="btn big g-go garage-btn" data-action="tv-guide">📺 Back to the TV</button>
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
    this.guideOpen = false;
    const run = this.run, node = mapNode(run.map, id);
    if (!node || !reachableNodes(run.map, run.cur).includes(id)) return;
    this.saveRun(id); // if the page goes away mid-stop, this stop replays from here
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
      this.shop = rollShop(this.build, this.runRng, this.run.act);
      this.shopOpen = true;
      this.tab = 'market';
      this.toGarage();
    } else if (node.type === 'repair') {
      const b = this.build;
      b.hull = b.maxHull;
      CarHistory.repaired(b);
      for (const slot of PART_SLOTS) b.parts[slot].dur = partMaxDur(b, b.parts[slot].id);
      ensureHatch(b).hp = HATCH.max;
      this.showEvent({ title: 'The mechanic', text: 'An old lifer with oil to his elbows waves you into his bay, hammers the dents out of your hatch and says, "On the house. Just win."', result: 'Hull, hatch and every part repaired to full.' });
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
    // The dealer behind the wall: maybe there, once per stretch between races (js/blackmarket.js).
    const b = this.build;
    if (!this.tutorial && b.race > 0 && this.dealerKey !== b.race) { this.dealerKey = b.race; this.dealer = BlackMarket.roll(b, this.runRng, this.run.act); }
    // The Fan Club (js/infamy.js): fresh mail after every race, rolled on its own so it doesn't disturb the run's dice.
    if (!this.tutorial && (!this.fans || this.fans.key !== b.race)) this.fans = { key: b.race, stock: Infamy.roll(b, this.run, mulberry32((this.runSeed ^ (b.race + 1) * 7919) >>> 0)) };
    if (this.tab === 'wall' && !this.dealer) this.tab = 'car';
    this.saveRun();
    if (this.preview) this.preview.setLook(carLook(this.cos, this.build));
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
    this.clearRun();
    Playtest.endRun(this.build.strikes >= STRIKES_TO_LOSE ? 'three strikes: back to the cell' : 'abandoned');
    const b = this.build;
    this.state = 'over';
    this.setUI(`<div class="screen end lost">
      <h1>Escape failed</h1>
      <p>Three strikes. The warden sends you back to your cell after ${b.race} race${b.race === 1 ? '' : 's'} and ${b.wins} win${b.wins === 1 ? '' : 's'}.</p>
      <p class="muted">Trinkets collected: ${b.trinkets.map((t) => TRINKETS[t].name).join(', ') || 'none'}</p>
      <button class="btn primary big" data-action="new-run">New run ▶</button>
      <button class="btn" data-action="feedback">Send feedback</button>
      <button class="btn" data-action="menu">Main menu</button>
    </div>`);
  },

  victory() {
    const b = this.build;
    Playtest.endRun('won the Crown: walked free');
    this.state = 'over';
    this.clearRun();
    this.setUI(`<div class="screen end won">
      <h1>Free</h1>
      <p>You won the Crown. The warden signs two releases in front of the whole upper city, smiling for the cameras: yours, and ${Crew.current(b).name}'s. The collars come off together.</p>
      <p class="muted">${b.race} races · ${b.wins} wins · trinkets: ${b.trinkets.map((t) => TRINKETS[t].name).join(', ') || 'none'}</p>
      <button class="btn primary big" data-action="new-run">New run ▶</button>
      <button class="btn" data-action="feedback">Send feedback</button>
      <button class="btn" data-action="menu">Main menu</button>
    </div>`);
  },

  // The game is played from the cockpit; the top-down view is only a fallback for machines without WebGL.
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
    this.dealer = null; // he's gone by the time you're back
    const boss = node.type === 'boss' ? BOSSES[run.act] : null;
    const d = run.act * 4 + Math.round((Math.min(node.row, MAP_ROWS - 1) * 3) / (MAP_ROWS - 1)) + (node.type === 'elite' ? 2 : 0);
    const track = generateTrack(this.seed, biome, { hazardLevel: 1, features: 1 + Math.min(2, run.act) }); // ramps and obstacles, more each act
    renderTrack(track);
    const base = CARS.comet;
    // Stats come from the parts you have fitted; the driver chip changes how the AI drives.
    const stats = buildStats(b);
    if (biome === 'tundra') stats.grip *= stats.iceGrip;
    const chipLat = { cautious: 0.85, hothead: 1.08, daredevil: 1.04, veteran: 1.06 }[b.chip] || 1;
    const bondP = Bond.perks(node.tutorial ? 0 : Bond.level(Bond.rec(b).xp)); // how well your driver knows you (js/bond.js)
    stats.aLat = (1050 + 650 * 0.15) * Math.sqrt(track.biome.grip) * chipLat * bondP.grip;
    const player = new Car({ name: 'You', color: paintColor(this.cos), accent: '#1d1d1d', isPlayer: true, stats, hp: b.hull });
    const driver = new AIDriver(player, 0.95, rng);
    driver.rammer = b.chip === 'hothead';
    driver.insideMul = b.chip === 'daredevil' ? 2.2 : 1;
    // Rivals as quick as a stock car from the start, getting sharper through the run; the boss drives above the field.
    const tut = !!node.tutorial; // practice: slower rivals
    const opponents = buildOpponents(rng, 0, { aiBonus: 0 }, false).map((o) => Object.assign(o, { skill: RIVAL_SKILL(d) + randRange(rng, -0.035, 0.03) - (tut ? 0.08 : 0) }));
    if (boss) opponents[opponents.length - 1] = { name: boss.name, color: boss.color, accent: '#111', skill: RIVAL_SKILL(d) + boss.skill, isBoss: true };
    this.race = new Race({
      track, laps: boss ? 4 : 3, playerCar: player, rng, qualify: boss && boss.mustWin ? 1 : 3,
      opponents, playerGrid: boss ? 5 : 4,
    });
    this.race.node = node;
    this.race.boss = boss;
    // Everyone on the grid gets a prison nickname, fresh every race (js/crew.js); bosses keep theirs.
    const taken = new Set([Crew.current(b).nick]);
    this.race.cars.forEach((c, k) => { if (c !== player && !c.isBoss) { const n = Crew.rival(this.seed, k, taken); c.name = n.name; c.nick = n.nick; c.last = n.last; } });
    this.race.wreckOut = !node.tutorial; // a wreck puts you out (see updateRace), no limping on
    this.race.music = null; // set once the weather is known, below
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
    // A vendetta: someone you put out of an earlier race is back, in place of an ordinary rival.
    const vend = Vendetta.pick(run, rng, node);
    if (vend) {
      const field = this.race.cars.filter((c) => c !== player && !c.isBoss && !c.bounty);
      const vc = field[Math.floor(rng() * field.length)];
      Vendetta.apply(vc, vend, player);
      this.race.vendetta = { car: vc, v: vend };
    }
    // Contraband: a heavy load costs hull at the start.
    if (run.flags.hullHit) { player.hp = Math.max(1, player.hp - run.flags.hullHit); run.flags.hullHit = 0; }
    // Slower, heavier racing than the arcade game: more time to aim, and a pack that stays together.
    // Weather: the forecast for this stop (the tutorial is always clear).
    const wxId = node.tutorial || node.id == null ? 'clear' : weatherFor(run.seed || 0, run.act, node.id), wx = wxOf(wxId);
    this.race.weather = wxId;
    for (const c of this.race.cars) {
      c.stats.grip *= wx.grip || 1;
      c.stats.top *= PACE;
      c.stats.accel *= PACE;
      c.stats.aLat *= 0.88;
    }
    this.race.rubberCfg = { dist: 2200, ahead: -0.07, behind: 0.12 };
    this.driver = driver;
    this.combat = new Combat(this.race, { driver, build: b, elite: node.type === 'elite', boss, disarm: !!run.flags.disarm, weather: wx, act: node.tutorial ? 0 : run.act });
    run.flags.disarm = false;
    if (vend) { const vc = this.race.vendetta.car; if (!vc.weapon || vend.how === 'tyres') vc.weapon = 'gun'; vc.wpn = vc.wpn || { cd: randRange(rng, 2, 4), lock: 0 }; } // they come armed
    this.combat.pace = PACE;
    this.combat.tutorial = !!node.tutorial;
    this.combat.inmate = this.cos.inmate || '4471'; // for the broadcast's captions
    this.combat.crew = Crew.current(b); // your driver, for the radio (js/crew.js)
    driver.skill = 0.95 - DRIVER.wobble * (1 - Crew.hp(b) / DRIVER.hp) + bondP.skill; // still nursing a wound from last time
    this.combat.bondPerks = bondP;
    this.combat.crowdTurns = !node.tutorial && !!run.flags.crowd; // bought at the Fan Club (js/infamy.js)
    // Bounties on every rival (the bounty stop's most-wanted keeps its big one).
    if (!node.tutorial) for (const c of this.race.cars) if (c !== player && !c.isBoss) c.bounty = Math.max(c.bounty || 0, rivalBounty(c, run.act, node.type === 'elite'));
    this.race.onRenderWorld = (ctx, t) => this.combat.render2D(ctx, t);
    this.race.music = Music.forRace(run.act, node.type, this.seed, !!(boss && boss.mustWin), wxId);
    WeatherGlass.reset();
    if (this.cockpit) this.cockpit.load(this.race, this.combat, carLook(this.cos, this.build));
    this.cam.x = player.x;
    this.cam.y = player.y;
    this.cam.zoom = this.baseZoom();
    this.state = 'briefing';
    this.setView(this.view);
    this.showBriefing();
  },

  startRace() {
    this.state = 'race';
    this.wreckT = 0;
    this.finishMoment = false;
    this.useContraband();
    if (!this.tutorial && this.race) Playtest.raceStart({ act: this.run.act, type: this.race.node && this.race.node.type, boss: this.race.boss && this.race.boss.name, weather: this.race.weather });
    this.setUI('');
    if (this.view === 'cockpit') this.lock();
    if (!this.tutorial && this.race && this.combat && this.combat.crew) {
      this.race.message(`On air: ${this.combat.inmate} and ${this.combat.crew.short} in ${CarHistory.name(this.build)}`, '#c9c2a8');
      const line = Bond.opener(Bond.rec(this.build), Math.random, this.combat.inmate); // something you've been through together
      if (line) this.combat.radio([line]);
    }
  },

  // Whatever you picked from your pocket goes in now, plus the comedown from last race's.
  useContraband() {
    const b = this.build, run = this.run, race = this.race;
    if (this.tutorial || !race || !this.combat || !b.pocket) return;
    const used = b.pocket.filter((x) => x.use).map((x) => ({ id: x.id, p: BlackMarket.potency(run, x.id) }));
    b.pocket = b.pocket.filter((x) => !x.use);
    const down = run.flags.comedown || [];
    const B = BlackMarket.buffs(used, down);
    run.flags.comedown = used.map((u) => u.id).filter((id) => CONTRABAND[id].comedown);
    const tol = run.flags.tolerance || (run.flags.tolerance = {});
    for (const u of used) if (CONTRABAND[u.id].kind !== 'ammo') tol[u.id] = (tol[u.id] || 0) + 1;
    this.combat.buffs = Object.keys(B).length ? B : null;
    if (B.hull) race.player.hp = Math.max(1, race.player.hp - B.hull);
    const verb = { drug: 'You take the', booze: 'You drink the', ammo: 'You load the' };
    for (const u of used) {
      const c = CONTRABAND[u.id];
      race.message(`${verb[c.kind]} ${c.name}${u.p < 1 ? ` (it barely touches you now: ${Math.round(u.p * 100)}%)` : ''}`, '#c9a0ff');
    }
    if (down.length) race.message('Coming down hard', '#ff8a6a');
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

  // Emotes: tap T for your last one, hold it for the wheel (the mouse picks instead of aiming while it's open).
  updateEmoteKey(dt) {
    const E = this.emoteHold;
    if (!E && Input.consume('KeyT')) { this.emoteHold = { t: 0, x: 0, y: 0, open: false }; return; }
    if (!E) return;
    E.t += dt;
    if (E.t > 0.18) E.open = true;
    if (Input.keys.has('KeyT')) return;
    this.emoteHold = null;
    let id = this.lastEmote || 'flip';
    if (E.open) {
      if (Math.hypot(E.x, E.y) < 30) return; // opened the wheel and let go in the middle: never mind
      id = this.emoteAt(E);
    }
    this.lastEmote = id;
    this.combat.emote(id, this.aimAngle());
  },

  // Orders: tap C to repeat your last order, hold it for the wheel (js/orders.js).
  updateOrderKey(dt) {
    const E = this.orderHold;
    if (!E && Input.consume('KeyC')) { this.orderHold = { t: 0, x: 0, y: 0, open: false }; return; }
    if (!E) return;
    E.t += dt;
    if (E.t > 0.18) E.open = true;
    if (Input.keys.has('KeyC')) return;
    this.orderHold = null;
    let id = this.combat.lastOrder || 'alongside';
    if (E.open) {
      if (Math.hypot(E.x, E.y) < 30) return;
      id = this.orderAt(E);
    }
    this.combat.order(id, this.aimAngle());
  },
  orderAt(E) {
    const a = Math.atan2(E.y, E.x);
    return ORDER_WHEEL[Math.round(((a + Math.PI / 2 + TAU) % TAU) / (Math.PI / 2)) % 4];
  },

  emoteAt(E) { // up, right, down, left
    const a = Math.atan2(E.y, E.x);
    return EMOTE_ORDER[Math.round(((a + Math.PI / 2 + TAU) % TAU) / (Math.PI / 2)) % 4];
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
      ${c.isBoss ? '<em class="tag yellow">👑 Boss</em>' : ''}${c.bounty ? `<em class="tag yellow">💰 ${c.bounty}</em>` : ''}${c.weapon === 'rocket' ? '<em class="tag red">🚀 Rocket gunner</em>' : c.weapon === 'mine' ? '<em class="tag yellow">💣 Mine layer</em>' : c.weapon === 'gun' ? '<em class="tag red">🔫 Gunner</em>' : ''}</div>`).join('');
    const boosts = tr.hazards.filter((h) => h.type === 'boost').length, oils = tr.hazards.length - boosts;
    this.setUI(`<div class="screen briefing">
      <h1>${race.node.tutorial ? 'Tutorial: practice race' : race.boss ? 'Qualifier: ' + race.boss.name : race.node.type === 'elite' ? 'Elite race' : race.node.type === 'bounty' ? 'Bounty race' : 'Race briefing'}</h1>
      <p class="act-line">Act ${ROMAN[this.run.act]} · ${this.act.title}${race.boss && race.boss.mustWin ? ' · <b class="bad">FINAL: win it or stay a prisoner</b>' : ''}</p>
      <p class="wx-line"><span>${wxOf(race.weather).icon}</span> <b>${wxOf(race.weather).name}.</b> ${wxOf(race.weather).desc}</p>
      ${race.node.tutorial ? '<p class="boss-line">No strikes, no scrap, no armed rivals. A coach card will walk you through every gun and trick, one step at a time.</p>' : ''}
      ${race.node.tutorial ? '' : race.boss ? `<p class="boss-line"><b>${race.boss.title}.</b> ${race.boss.desc}${bossKit(race.boss) ? ` <span class="boss-help">${bossKit(race.boss).help}</span>` : ''}</p>` : race.node.type === 'elite' ? '<p class="boss-line">Sharper drivers and more guns on the grid. A trinket waits for you if you make the cut.</p>' : ''}
      <p class="muted">${this.build.scrap} scrap · hull ${Math.ceil(this.build.hull)}/${this.build.maxHull} · strikes ${'●'.repeat(this.build.strikes)}${'○'.repeat(STRIKES_TO_LOSE - this.build.strikes)}</p>
      <div class="brief-grid">
        <div class="panel"><canvas id="preview" width="320" height="320"></canvas>
          <h2>${bio.name}</h2><p class="muted">${bio.blurb}</p>
          <p>${race.laps} laps · ${Math.round((tr.length * 0.125) / 10) * 10}m lap · ${boosts} boost pads · ${oils} oil slicks</p>
          <p><b>${race.boss ? (race.boss.mustWin ? 'Win the race outright' : 'Finish ahead of ' + race.boss.name) : 'Finish top ' + race.qualify}</b></p>
          <p class="small">Purse: win <b>${PLACE_PURSE[0][0]}-${PLACE_PURSE[0][1]}</b>${race.qualify > 1 && PLACE_PURSE[race.qualify - 1] ? ` · ${ordinal(race.qualify)} ${PLACE_PURSE[race.qualify - 1][0]}-${PLACE_PURSE[race.qualify - 1][1]}` : ''} · a bounty (💰) on every rival${race.boss ? ` · beat ${race.boss.name} ${BOSS_PURSE[0]}-${BOSS_PURSE[1]}` : ''}${race.node.type === 'elite' ? ' · elite +40%' : ''}</p>
        </div>
        <div class="panel"><h2>Rivals</h2>${rivals}${this.pocketHTML()}
          <details class="ctl-box" ${this.build.race < 2 ? 'open' : ''}><summary><h2>Controls</h2></summary>
          <div class="ctl"><kbd>Mouse</kbd> Aim / look around · <kbd>LMB</kbd> Fire</div>
          <div class="ctl"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Weapons · <kbd>Q</kbd>/<kbd>Wheel</kbd> switch · <kbd>R</kbd> Reload</div>
          <div class="ctl"><kbd>RMB</kbd>/<kbd>G</kbd> Grenade (look higher to throw further). Drop one down a rocket car's roof hatch or in a gunner's window.</div>
          <div class="ctl"><kbd>T</kbd> Flip off a rival (hold for the emote wheel)</div>
          <div class="ctl"><kbd>Space</kbd> (hold) Blast hatch · <kbd>E</kbd> / <kbd>F</kbd> Abilities · <kbd>B</kbd> Fit your spare part</div>
          ${this.build.roof && this.build.roof.gun ? `<div class="ctl"><kbd>V</kbd> Up to the ${WEAPONS[this.build.roof.gun.id].name} on the roof, and back down</div>` : ''}
          <div class="ctl"><kbd>A</kbd>/<kbd>D</kbd> Order the driver to swerve · <kbd>MMB</kbd> "Ram them!" at the car you're aiming at</div>
          <div class="ctl"><kbd>C</kbd> (hold) Orders: get alongside, tail them, floor it, ease off (a steadier aim). Tap to repeat.</div>
          <div class="ctl"><kbd>Esc</kbd> Pause · <kbd>M</kbd> Mute</div>
          <p class="muted small">Shoot rockets and mines out of the air with bullets. Red laser = a gunner is locking on to you.</p>
          </details>
        </div>
      </div>
      <button class="btn primary big" data-action="start">Start race ▶</button>
      <button class="btn ghost" data-action="menu">Main menu</button>
    </div>`);
    drawTrackPreview(document.getElementById('preview'), race);
  },

  // The briefing's pocket: contraband from the wall to take or load for this race, and last race's comedown.
  pocketHTML() {
    const b = this.build, run = this.run;
    if (this.tutorial || !b) return '';
    const down = (run.flags.comedown || []).map((id) => CONTRABAND[id]).filter((c) => c && c.comedown);
    if (!b.pocket.length && !down.length) return '';
    const verb = { drug: 'Take', booze: 'Drink', ammo: 'Load' };
    const items = b.pocket.map((x, i) => {
      const c = CONTRABAND[x.id];
      return `<button class="opt ${x.use ? 'on' : ''}" data-action="pocket-use" data-arg="${i}" title="This race: ${contraFx(BlackMarket.scale(c.buff, BlackMarket.potency(run, x.id)))}${c.comedown ? '. Next race: ' + contraFx(c.comedown) : ''}">${x.use ? '✔ ' : ''}${verb[c.kind]} the ${c.name}${BlackMarket.potency(run, x.id) < 1 ? ` (${Math.round(BlackMarket.potency(run, x.id) * 100)}%)` : ''}</button>`;
    }).join('');
    return `<h2>Your pocket</h2>${items ? `<div class="opts">${items}</div><p class="muted small">One of each kind a race. Used when the lights go green.</p>` : ''}
      ${down.length ? `<p class="small bad">Coming down off the ${down.map((c) => c.name).join(' and the ')}: ${down.map((c) => contraFx(c.comedown)).join('; ')}.</p>` : ''}`;
  },

  showPause() {
    this.setUI(`<div class="screen pause">
      <h1>Paused</h1>
      <button class="btn primary big" data-action="resume">${this.view === 'cockpit' ? 'Click to resume aiming' : 'Resume'}</button>
      <button class="btn" data-action="settings">Settings</button>
      <button class="btn" data-action="feedback">Send feedback</button>
      ${this.tutorial ? '<button class="btn ghost" data-action="menu">Leave tutorial</button>' : `<button class="btn" data-action="menu">Main menu</button>
      <button class="btn ghost" data-action="abandon">Abandon run</button>`}
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
        if (k === 'quality') { Settings.data.quality = v; Settings.save(); this.resize(); } // the render size changes now; tower counts from the next race
        if (k === 'fps') Settings.data.showFps = !Settings.data.showFps;
        if (k === 'slowmo') Settings.data.slowmo = !Settings.data.slowmo;
        if (k === 'flicker') Settings.data.flicker = !Settings.data.flicker;
        if (k === 'ff') Settings.data.friendlyFire = !Settings.data.friendlyFire;
        if (k === 'mute') Sound.toggleMute();
        Settings.save();
        Sound.play({ type: 'click' });
        this.showSettings();
      });
      el.addEventListener('input', (e) => {
        if (e.target.id === 'setSens') Settings.data.sens = +e.target.value;
        if (e.target.id === 'setVol') Settings.data.volume = +e.target.value;
        if (e.target.id === 'setMusic') Settings.data.music = +e.target.value;
        if (e.target.id === 'setRaceMusic') Settings.data.raceMusic = +e.target.value;
        Settings.save();
        const l = el.querySelector(`[data-val="${e.target.id}"]`);
        if (l) l.textContent = e.target.id === 'setSens' ? Settings.data.sens.toFixed(2) + 'x' : Math.round(Settings.data[{ setVol: 'volume', setMusic: 'music', setRaceMusic: 'raceMusic' }[e.target.id]] * 100) + '%';
      });
    }
    const d = Settings.data, opt = (k, v, label) => `<button class="opt ${d.cabinSway === v ? 'on' : ''}" data-set="${k}:${v}">${label}</button>`;
    el.innerHTML = `<div class="settings-card clipboard">
      <div class="clip"></div>
      <h2 class="g-title">Settings</h2>
      <h3>Cabin sway</h3>
      <p class="muted small">How much the cabin rolls and pitches with the car. Turn it down if it makes you queasy.</p>
      <div class="opts">${opt('sway', 'off', 'Off')}${opt('sway', 'subtle', 'Subtle')}${opt('sway', 'full', 'Full')}</div>
      <h3>Graphics</h3>
      <p class="muted small">If the game feels choppy, go down a step. Low draws fewer pixels and fewer buildings.</p>
      <div class="opts">${['low', 'medium', 'high'].map((q) => `<button class="opt ${d.quality === q ? 'on' : ''}" data-set="quality:${q}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}
        <button class="opt ${d.showFps ? 'on' : ''}" data-set="fps:1">${d.showFps ? 'FPS shown' : 'Show FPS'}</button></div>
      <h3>Big moments</h3>
      <p class="muted small">A clean kill, a grenade in the cabin, a boss beaten: the broadcast cuts to you. The caption always shows; these are extra.</p>
      <div class="opts"><button class="opt ${d.slowmo !== false ? 'on' : ''}" data-set="slowmo:1">Slow motion ${d.slowmo !== false ? 'on' : 'off'}</button>
        <button class="opt ${d.flicker !== false ? 'on' : ''}" data-set="flicker:1">TV flicker ${d.flicker !== false ? 'on' : 'off'}</button></div>
      <h3>Friendly fire</h3>
      <p class="muted small">Your driver sits right beside you. With this on, rounds you fire into them hit them.</p>
      <div class="opts"><button class="opt ${d.friendlyFire !== false ? 'on' : ''}" data-set="ff:1">Friendly fire ${d.friendlyFire !== false ? 'on' : 'off'}</button></div>
      <h3>Mouse sensitivity <small data-val="setSens">${d.sens.toFixed(2)}x</small></h3>
      <input type="range" id="setSens" min="0.3" max="2.5" step="0.05" value="${d.sens}">
      <h3>Volume <small data-val="setVol">${Math.round(d.volume * 100)}%</small></h3>
      <input type="range" id="setVol" min="0" max="1" step="0.05" value="${d.volume}">
      <h3>Menu music <small data-val="setMusic">${Math.round(d.music * 100)}%</small></h3>
      <input type="range" id="setMusic" min="0" max="1" step="0.05" value="${d.music}">
      <h3>Race music <small data-val="setRaceMusic">${Math.round(d.raceMusic * 100)}%</small></h3>
      <input type="range" id="setRaceMusic" min="0" max="1" step="0.05" value="${d.raceMusic}">
      <div class="opts" style="margin-top:8px"><button class="opt ${Sound.muted ? 'on' : ''}" data-set="mute:1">${Sound.muted ? 'Sound muted (M)' : 'Mute (M)'}</button></div>
      <button class="btn primary" data-set="close" style="margin-top:14px">Done</button>
    </div>`;
  },

  showResults() {
    const race = this.race, p = race.player, s = this.combat.stats, b = this.build;
    race.rankCars();
    const boss = race.boss, run = this.run;
    const ok = boss ? (boss.mustWin ? p.place === 1 : p.place < race.bossCar.place) : p.place <= race.qualify;
    const pt = this.tutorial ? null : Playtest.raceEnd({ place: p.place, of: race.cars.length, ok, wrecked: p.hp <= 0 });
    // Running slowly: say so, and where to fix it.
    const slow = pt && pt.fps && pt.fps.avg < 30 && Settings.data.quality !== 'low'
      ? `<div class="unlock small">That race ran at about ${pt.fps.avg} frames a second. If it felt choppy, try <b>Graphics: Low</b> in Settings.</div>` : '';
    this.lastOk = ok;
    // Bank the race: hull carries over, scrap paid out, strikes for missing the cut.
    const show = b.chip === 'showboat' ? 1.5 : 1;
    // Purses roll in a range (seeded per race, so a reload pays the same): half luck, half how you raced.
    const prng = mulberry32((this.seed ^ 0x5c4a) >>> 0), style = raceStyle(s), range = purseRange(p.place);
    const loaded = has(b, 'loaded'), purseRoll = (r, rng, st) => (loaded ? r[1] : rollPurse(r, rng, st)); // Loaded Dice: always the top
    // Bounties on everyone you put out (clean kills, the driver shot through the glass, pay half as much again).
    const claimed = race.cars.filter((c) => c !== p && c.downed && c.bounty).map((c) => ({ c, pay: Math.round(c.bounty * (c.downed.how === 'driver' ? BOUNTY.cleanKill : 1)), clean: c.downed.how === 'driver' }));
    if (has(b, 'letters')) for (const x of claimed) x.pay = Math.round(x.pay * 1.25); // Love Letters
    const wreckRoll = claimed.reduce((a, x) => a + x.pay, 0);
    const wx = wxOf(race.weather), mult = show * (race.node.type === 'elite' ? 1.4 : 1) * (has(b, 'tooth') ? 1.3 : 1) * (wx.scrap || 1);
    const placePay = p.dnf ? 0 : Math.round(purseRoll(range, prng, style) * mult), wreckPay = Math.round((wreckRoll + s.scrapBonus) * show);
    const bossPay = boss && ok ? purseRoll(BOSS_PURSE, prng, style) : 0;
    const bc = race.bountyCar, bountyPay = 0; // the most-wanted's price is paid with the other bounties
    // Vendettas: settle the one that came back (wreck it, get paid), and remember who might.
    const vres = this.tutorial ? null : Vendetta.afterRace(run, race, prng, (c) => c.look3d || null);
    const vendPay = vres ? vres.settled.reduce((a) => a + Math.round(purseRoll(VENDETTA.purse, prng, style) * show), 0) : 0;
    let sponsorCut = 0;
    if (run.flags.sponsor) { if (!ok) sponsorCut = Math.min(b.scrap + placePay + wreckPay, run.flags.sponsor); run.flags.sponsor = 0; }
    let betPay = 0;
    if (run.flags.bet) { if (p.place <= 2) betPay = run.flags.bet; run.flags.bet = 0; }
    b.scrap += placePay + wreckPay + bossPay + betPay + bountyPay + vendPay - sponsorCut;
    b.hull = Math.max(Math.round(b.maxHull * CREW_PATCH), Math.round(p.hp)); // the crew patches a wreck back to running; the rest is yours to pay for
    const bondWas = this.tutorial ? null : Bond.info(b); // before a dead driver's place is taken
    const bond = this.tutorial || this.combat.crewDone ? null : this.combat.bondAfterRace(p.place, ok, boss && boss.name); // js/bond.js
    const lost = this.tutorial || this.combat.crewDone ? null : Crew.afterRace(b, run, !!this.combat.ownDriverDead); // your driver: heals, or is replaced
    if (!this.tutorial && !this.combat.crewDone) Crew.gunnerAfterRace(b, !!this.combat.gunnerOut);
    if (lost) lost.by = this.combat.driverKilledBy;
    if (!this.tutorial && !this.combat.crewDone) CarHistory.afterRace(b, race, mulberry32((this.seed ^ 0x3a7) >>> 0), !!(boss && ok), run.act);
    this.combat.crewDone = true;
    // A wreck breaks things: the crew bodges broken parts back to a quarter so you're not crippled next race.
    const bodged = p.dnf ? PART_SLOTS.filter((k) => b.parts[k].dur <= 0) : [];
    for (const k of bodged) b.parts[k].dur = Math.round(partMaxDur(b, b.parts[k].id) * 0.25);
    if (has(b, 'snowglobe')) b.grenades = Math.min(MAX_GRENADES, b.grenades + 1);
    // Infamy (js/infamy.js): what you earned live, plus the win, the podium, the boss; and the record for the walls.
    if (!this.tutorial) for (const [why, n] of Infamy.finish(race, ok)) this.combat.fame(n, why.toUpperCase());
    const fameGot = this.tutorial ? 0 : (s.infamy || 0);
    b.infamy = (b.infamy || 0) + fameGot;
    if (!this.tutorial) { Infamy.afterRace(run, race, s, ok, claimed); Infamy.rec(run).total += fameGot; }
    run.flags.crowd = false;
    const fameWhy = {};
    for (const [why, n] of s.fameLog || []) fameWhy[why] = (fameWhy[why] || 0) + n;
    b.race++;
    if (p.place === 1) b.wins++;
    if (!ok) b.strikes++;
    const parts = PART_SLOTS.map((slot) => `<span class="${b.parts[slot].dur <= 0 ? 'bad' : ''}">${SLOT_NAMES[slot]} ${b.parts[slot].dur <= 0 ? 'BROKEN' : Math.round((100 * b.parts[slot].dur) / partMaxDur(b, b.parts[slot].id)) + '%'}</span>`).join(' · ');
    const rows = race.ranking.map((c, i) => `<tr class="${c.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><span class="dot" style="background:${c.color}"></span>${c.name}${c.weapon ? ' ⚔' : ''}</td><td>${c.finished ? fmtTime(c.finishTime) : c.wrecked || (c.isPlayer && c.dnf) ? '<b class="bad">WRECKED</b>' : '—'}</td><td>${Math.ceil(c.hp)} HP</td></tr>`).join('');
    this.setUI(`<div class="screen results">
      <h1 class="${ok ? 'good' : 'bad'}">${p.dnf ? 'Wrecked' : ordinal(p.place) + ' place'}: ${ok ? (boss ? (boss.mustWin ? 'you won the Crown' : boss.name + ' beaten') : 'you survived') : 'strike ' + b.strikes + ' of ' + STRIKES_TO_LOSE}</h1>
      <p class="muted">${boss ? (ok ? (boss.mustWin ? 'The upper city is on its feet.' : 'You qualify for the next act.') : `${boss.name} is still ahead of you. Patch up and face them again.`) : ok ? 'Top 3 keeps the warden happy.' : 'Finish outside the top 3 three times and the run is over.'}</p>
      <div class="results-grid">
        <table class="standings">${rows}</table>
        <div class="payout">
          <div><span>Damage dealt</span><b>${Math.round(s.dealt)}</b></div>
          <div><span>Rivals wrecked</span><b>${s.wrecked}</b></div>
          <div><span>Rockets &amp; mines shot down</span><b>${s.shotDown}</b></div>
          <div><span>Parries</span><b>${s.parries}</b></div>
          <div><span>Damage taken</span><b>${Math.round(s.taken)}</b></div>
          <div><span>Hull left</span><b>${Math.ceil(p.hp)} / ${b.maxHull}${b.hull > Math.ceil(p.hp) ? ` <small class="muted">(crew patched to ${b.hull}${bodged.length ? ', and bodged the ' + bodged.map((k) => SLOT_NAMES[k].toLowerCase()).join(' and ') + ' back to running' : ''})</small>` : ''}</b></div>
          <div><span>Placing purse <small class="muted">${p.dnf ? 'did not finish' : `${range[0]}-${range[1]}`}</small></span><b>${placePay} scrap</b></div>
          <div><span>Bounties${claimed.length ? ` <small class="muted">${claimed.map((x) => `${shortName(x.c)} ${x.pay}${x.clean ? ' (clean kill)' : ''}`).join(', ')}</small>` : ''}</span><b>${wreckPay} scrap</b></div>
          ${bossPay ? `<div><span>Qualifier purse</span><b>${bossPay} scrap</b></div>` : ''}
          ${bc && !bc.downed ? `<div><span>Most wanted: ${bc.name}</span><b>got away</b></div>` : ''}
          ${sponsorCut ? `<div><span>Sponsor takes back</span><b class="bad">-${sponsorCut} scrap</b></div>` : ''}
          ${betPay ? `<div><span>Bet winnings</span><b>${betPay} scrap</b></div>` : ''}
          ${vres && vres.settled.length ? `<div><span>☠ Vendetta settled: ${vres.settled.map((v) => v.name + (v.over === 'dead' ? ' (for good)' : '')).join(', ')}</span><b>${vendPay} scrap</b></div>` : ''}
          ${vres && vres.escaped.length ? `<div class="unlock small">☠ ${vres.escaped.map((v) => v.name).join(', ')} got away. They're still out there.</div>` : ''}
          ${(() => { if (this.tutorial) return ''; const h = CarHistory.of(b), k = race.cars.filter((c) => c !== p && c.downed && c.downed.how !== 'crowd').length, tr = boss && ok ? BOSSES[run.act] : null; return k || tr ? `<div class="unlock small">${k ? `${k} more kill mark${k === 1 ? '' : 's'} stencilled on <b>${h.name}</b> (${h.kills.length} in all).` : ''}${tr ? ` ${tr.name}'s trophy gets bolted on.` : ''}</div>` : ''; })()}
          ${lost ? `<div class="unlock" style="color:#ff6b5a">☠ ${lost.by === 'rival' ? `They shot ${lost.was.name} through the glass.` : `You shot ${lost.was.name}.`} They're dead${bondWas && bondWas.r.races ? ` after ${bondWas.r.races + 1} race${bondWas.r.races ? 's' : ''} together (${bondWas.name})` : ''}. The block sends ${lost.now.name} to drive for you.</div>` : ''}
          ${bond ? `<div class="unlock small" style="color:#9fd0ff">Bond with ${this.combat.crew.short}: <b>${bond.got >= 0 ? '+' : ''}${bond.got}</b> · ${bond.info.name}${bond.up ? ' (new level!)' : ''}${bond.info.nextName ? ` · ${Math.ceil(bond.info.next)} to ${bond.info.nextName}` : ''}</div>` : ''}
          <div class="total"><span>Scrap</span><b>${b.scrap}</b></div>
          ${this.tutorial ? '' : `<div class="infamy-row"><span>Infamy${fameGot ? ` <small class="muted">${Object.entries(fameWhy).map(([w, n]) => `${w.toLowerCase()} ${n}`).join(', ')}</small>` : ' <small class="muted">nobody noticed you</small>'}</span><b>+${fameGot} (${b.infamy})</b></div>`}
          ${slow}
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
    if (this.preview) { // parts or tuning changed: rebuild the car on the lift so it shows them
      const gk = JSON.stringify([gearLook(b), b.roof && b.roof.gun ? [b.roof.gun.id, b.roof.shield] : 0, CarHistory.key(b)]);
      if (gk !== this.gearKey) { this.gearKey = gk; this.preview.setLook(carLook(this.cos, b)); }
    }
    const bar = (f, broken) => `<div class="bar"><div style="width:${Math.round(clamp(f, 0, 1) * 100)}%" class="${broken || f < 0.3 ? 'low' : ''}"></div></div>`;
    const stations = [['car', 'Workshop', 'Parts, tuning & repairs'], ['weapons', 'Armory', 'Weapons, mods & ammo'], ['market', ACT_LUXURY(this.run.act) ? 'Concierge' : 'Commissary', this.shopOpen ? 'Open now' : 'Closed'], ['paint', 'Paint booth', 'Looks, kept between runs']];
    if (this.dealer) stations.push(['wall', 'The wall', 'Someone\'s tapping']);
    if (this.fans) stations.push(['fans', 'Fan mail', `${b.infamy || 0} Infamy`]);
    const nav = stations.map(([id, label, sub]) => `<button class="g-station ${this.tab === id ? 'on' : ''}" data-action="tab" data-arg="${id}"><b>${label}</b><small>${sub}</small></button>`).join('');
    const trinkets = b.trinkets.length ? b.trinkets.map((t) => `<span class="perk rarity-epic" title="${TRINKETS[t].desc}">${TRINKETS[t].name}</span>`).join('') : '<span class="muted small">No trinkets yet. They are the only things you keep for the whole run.</span>';
    const body = { car: () => this.garageCar(bar), weapons: () => this.garageWeapons(), market: () => this.garageMarket(), paint: () => this.garagePaint(), wall: () => this.garageWall(), fans: () => this.garageFans() }[this.tab]();
    const title = stations.find((st) => st[0] === this.tab);
    this.setUI(`<div class="screen garage proto-garage g3d">
      <div class="g-top">
        <div><b>Act ${ROMAN[this.run.act]}</b> · ${act.title}</div>
        <div class="cash">${b.scrap} scrap</div>
        <div class="infamy" title="Infamy: earned by putting on a show, spent on fan mail">${b.infamy || 0} infamy</div>
        <div>Strikes <b class="bad">${'●'.repeat(b.strikes)}</b><b>${'○'.repeat(STRIKES_TO_LOSE - b.strikes)}</b></div>
        <button class="g-settings" data-action="settings" title="Settings">⚙ Settings</button>
        <button class="g-settings g-menu" data-action="menu" title="Main menu">☰ Menu</button>
      </div>
      <nav class="g-nav">${nav}</nav>
      <div class="g-panel clipboard">
        <div class="clip"></div>
        <div class="g-head"><h2 class="g-title">${title[1]}</h2><button class="btn small g-route" data-action="to-map" title="Tonight's channels: choose your next stop">📺 Tonight's channels</button></div>
        ${this.tab === 'car' ? '<p class="small muted g-hint">Drag the car to spin it round · scroll to zoom</p>' : ''}
        <div class="perks trinket-row">${trinkets}</div>
        ${body}
        <p class="small muted g-links"><a href="#" data-action="feedback">Send feedback</a>${window.RELEASE ? '' : ' · <a href="models.html">Model viewer</a>'}</p>
      </div>
      <button class="btn primary big g-go" data-action="to-map">📺 Tonight's channels ▶</button>
    </div>`);
    this.syncGarage();
  },

  syncGarage() {
    if (!this.preview) return;
    const b = this.build, act = this.act, run = this.run;
    const done = run.map.nodes.filter((n) => n.done && n.type !== 'boss').length;
    this.preview.sync({
      build: b, shop: this.shopOpen ? this.shop : [], cos: this.cos, dealer: this.dealer ? this.dealer.stock : null,
      fans: this.fans ? { stock: this.fans.stock, total: Infamy.rec(run).total } : null, wall: Infamy.wall(run, this.cos, b),
      act: { luxury: ACT_LUXURY(run.act), boss: BOSSES[run.act], label: `Act ${ROMAN[run.act]}: ${act.title}`, progress: `Stop ${done + 1} of ${MAP_ROWS + 1} this act`, maxStrikes: STRIKES_TO_LOSE },
    });
    this.preview.setStation(this.tab);
  },

  garageCar(bar) {
    const b = this.build, hullCost = repairHullCost(b), hatch = ensureHatch(b), hatchCost = repairHatchCost(b);
    const slots = PART_SLOTS.map((slot) => {
      const part = b.parts[slot], def = PARTS[part.id], max = partMaxDur(b, part.id), broken = part.dur <= 0;
      const cost = repairPartCost(b, slot), tu = TUNING[slot];
      // Tuning notches: open ones are buttons; beyond them, a weld (scrap) or a lock (rep) at each end.
      const R = tuneRange(b, slot);
      const tune = TUNE_STEPS.map((v) => { const n = Math.round(v * 2), open = n >= R.lo && n <= R.hi;
        return `<button class="tune-step ${part.tune === v ? 'on' : ''} ${open ? '' : 'shut'}" ${open ? `data-action="tune" data-arg="${slot}:${v}"` : 'disabled'} title="${open ? 'Notch ' + n : 'Not welded on yet'}"></button>`; }).join('');
      const weld = (dir) => { const w = nextWeld(b, slot, dir); if (!w) return '<span class="weld-max">max</span>';
        if (w.locked) return `<span class="weld-lock" title="${TUNE_EXTREME[slot].desc}">🔒 ${unlockRep('tune', slot)} rep</span>`;
        return `<button class="btn tiny weld" data-action="weld" data-arg="${slot}:${dir}" ${b.scrap < w.cost ? 'disabled' : ''} title="Weld on notch ${w.notch} (${dir > 0 ? tu.right : tu.left})">+ ${w.cost}</button>`; };
      const alts = b.stash.parts.map((inst, i) => ({ inst, i })).filter(({ inst }) => PARTS[inst.id].slot === slot)
        .map(({ inst, i }) => `<button class="btn small" data-action="equip-part" data-arg="${i}" title="${PARTS[inst.id].desc}">Fit ${PARTS[inst.id].name} (${Math.max(0, Math.round(inst.dur))}/${partMaxDur(b, inst.id)})</button>`).join('');
      return `<div class="part-card">
        <div class="gp-row">
          <div class="gp-name"><small>${SLOT_NAMES[slot]}</small><b>${def.name}</b><small class="muted">${def.desc}</small></div>
          <div class="gp-bar">${bar(part.dur / max, broken)}<small>${broken ? '<span class="bad">BROKEN</span>' : Math.round(part.dur) + ' / ' + max}</small></div>
          <button class="btn small" data-action="repair-part" data-arg="${slot}" ${cost <= 0 || b.scrap < cost ? 'disabled' : ''}>${cost <= 0 ? 'OK' : 'Fix ' + cost}</button>
          <button class="btn small" data-action="buy-spare" data-arg="${slot}" ${b.spare || b.scrap < spareCost(b, slot) ? 'disabled' : ''} title="Carry a spare ${def.name} to fit mid-race">Spare ${spareCost(b, slot)}</button>
        </div>
        <div class="tune-row">${weld(-1)}<small>${tu.left}</small><span class="tune">${tune}</span><small>${tu.right}</small>${weld(1)}<small class="muted">${tu.desc}</small></div>
        ${alts ? `<div class="alts"><small class="muted">In your stash:</small> ${alts}</div>` : ''}
      </div>`;
    }).join('');
    const chips = b.stash.chips.map((id, i) => `<button class="btn small" data-action="equip-chip" data-arg="${i}" title="${CHIPS[id].name}: ${CHIPS[id].desc}">Swap in ${Crew.id(id).name} (${CHIPS[id].name}, ${Bond.info(b, id + ':' + ((b.crewGen && b.crewGen[id]) || 0)).name})</button>`).join('');
    const hist = CarHistory.of(b), scars = CarHistory.shown(b).length;
    return `<div class="garage-grid one">
      <div class="panel">
        <div class="car-name-row"><small class="muted">The car</small><input id="carNameInput" class="plate-input car-name" maxlength="${HISTORY.nameLen}" value="${hist.name}"><button class="btn tiny" data-action="car-reroll" title="Paint a different name on">↻</button>
          <small class="muted">${hist.kills.length ? `${hist.kills.length} kill mark${hist.kills.length === 1 ? '' : 's'}` : 'No kill marks yet'}${hist.trophies.length ? ` · ${hist.trophies.map((a) => BOSSES[a] ? BOSSES[a].name : '?').join(', ')} on the bodywork` : ''}${scars ? ` · ${scars} scar${scars === 1 ? '' : 's'} until the hull's repaired` : ''}</small></div>
        <div class="gp-row"><div class="gp-name"><small>Hull</small><b>${Math.ceil(b.hull)} / ${b.maxHull}</b></div>
          <div class="gp-bar">${bar(b.hull / b.maxHull)}</div>
          <button class="btn small" data-action="repair-hull" ${hullCost <= 0 || b.scrap < hullCost ? 'disabled' : ''}>${hullCost <= 0 ? 'OK' : 'Repair ' + hullCost}</button></div>
        <div class="gp-row"><div class="gp-name"><small>Blast hatch</small><b>${Math.ceil(hatch.hp)} / ${HATCH.max}</b><small class="muted">Steel plate over the glass. Hold <kbd>Space</kbd> to slam it shut. Every hit dents it; dented through, it jams open.</small></div>
          <div class="gp-bar">${bar(hatch.hp / HATCH.max, hatch.hp <= 0)}<small>${hatch.hp <= 0 ? '<span class="bad">JAMMED</span>' : ''}</small></div>
          <button class="btn small" data-action="repair-hatch" ${hatchCost <= 0 || b.scrap < hatchCost ? 'disabled' : ''}>${hatchCost <= 0 ? 'OK' : 'Beat out ' + hatchCost}</button></div>
        ${slots}
        <p class="small">Spare part: <b>${b.spare ? PARTS[b.spare.id].name : 'none'}</b> <span class="muted">(press <kbd>B</kbd> mid-race to fit it when that part breaks)</span></p>
        <h3>Your driver</h3>
        <div class="gp-chip">${(() => { const c = Crew.current(b); const bi = Bond.info(b); return `<b>${c.name}</b> <small class="muted">#${c.number} · ${b.chip ? `${CHIPS[b.chip].name}: ${CHIPS[b.chip].desc}` : 'whoever the block sent you: no particular habits'}</small>
          <div class="bond-row"><span class="bond-lv">${bi.name}</span><div class="bar bond-bar"><div style="width:${Math.round(bi.f * 100)}%"></div></div><small class="muted">${bi.nextName ? `${Math.ceil(bi.next)} to ${bi.nextName}` : 'as close as it gets'}</small></div>
          <small class="muted">${bi.r.races ? `${bi.r.races} race${bi.r.races === 1 ? '' : 's'} together · ${bi.r.kills} kill${bi.r.kills === 1 ? '' : 's'}${bi.r.wins ? ` · ${bi.r.wins} win${bi.r.wins === 1 ? '' : 's'}` : ''}${bi.r.ff ? ` · you've shot them ${bi.r.ff === 1 ? 'once' : bi.r.ff + ' times'}` : ''}` : 'You haven\'t raced together yet.'}</small>
          <div class="bond-perks small">${BOND_LEVELS.slice(1).map((L, i) => `<span class="${bi.lv > i ? 'on' : ''}" title="${L.perk}">${bi.lv > i ? '✔' : '·'} ${L.name}: ${L.perk}</span>`).join('')}</div>${Crew.hp(b) < DRIVER.hp ? `<br><span class="bad small">Wounded: ${Math.round((100 * Crew.hp(b)) / DRIVER.hp)}%. Drives worse until patched up.</span> <button class="btn tiny" data-action="patch-driver" ${b.scrap < Crew.patchCost(b) ? 'disabled' : ''}>Patch up: ${Crew.patchCost(b)} scrap</button>` : ''}`; })()}</div>
        ${Crew.gunnerHp(b) < GUNNER.hp ? `<div class="gp-chip"><b>You</b> <span class="bad small">Wounded: ${Math.round((100 * Crew.gunnerHp(b)) / GUNNER.hp)}%. Your aim shakes until you're stitched up.</span> <button class="btn tiny" data-action="patch-gunner" ${b.scrap < Crew.gunnerPatchCost(b) ? 'disabled' : ''}>Stitch up: ${Crew.gunnerPatchCost(b)} scrap</button></div>` : ''}
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
      const btns = WEAPONS[w.id].roof ? `<button class="btn small" data-action="equip-weapon" data-arg="${si}:-1">${b.roof && b.roof.gun ? 'Swap onto the roof' : 'Mount on the roof'}</button>`
        : b.rack.length < slots
        ? `<button class="btn small" data-action="equip-weapon" data-arg="${si}:-1">Add to rack</button>`
        : b.rack.map((r, ri) => `<button class="btn small" data-action="equip-weapon" data-arg="${si}:${ri}">Swap for ${WEAPONS[r.id].name}</button>`).join('');
      return `<div class="gp-row"><div class="gp-name"><b>${WEAPONS[w.id].name}</b><small class="muted">${w.mag}+${w.reserve} rounds${w.mods.some(Boolean) ? ' · ' + w.mods.filter(Boolean).map((m) => MODS[m].name).join(', ') : ''}</small></div>${btns}</div>`;
    }).join('');
    const abil = b.abilities.map((id, i) => `<div class="gp-chip"><kbd>${i === 0 ? 'E' : 'F'}</kbd> ${id ? `<b>${ABILITIES[id].name}</b> <small class="muted">${ABILITIES[id].desc}</small>` : '<span class="muted">Empty</span>'}</div>`).join('');
    const stashA = b.stash.abilities.map((id, si) => `<div class="gp-row"><div class="gp-name"><b>${ABILITIES[id].name}</b><small class="muted">${ABILITIES[id].desc}</small></div>
      <button class="btn small" data-action="equip-ability" data-arg="${si}:0">On E</button><button class="btn small" data-action="equip-ability" data-arg="${si}:1">On F</button></div>`).join('');
    const stashM = b.stash.mods.map((id) => `<span class="mod-chip" title="${MODS[id].desc}">${MODS[id].name} <small class="muted">(${MODS[id].fits.map((f) => SHORT_WEAPON[f]).join('/')})</small></span>`).join('');
    return `<div class="garage-grid">
      <div class="panel"><h2>Rack <small class="muted">(${b.rack.length}/${slots})</small></h2>${rack}
        <div class="gp-row"><div class="gp-name"><small>Throwable</small><b>Grenades</b></div><div class="gp-ammo">${b.grenades} / ${MAX_GRENADES}</div>
          <button class="btn small" data-action="buy-nade" ${b.grenades >= MAX_GRENADES || b.scrap < GRENADE_PRICE ? 'disabled' : ''}>+1 for ${GRENADE_PRICE}</button></div>
      </div>
      ${this.roofPanel()}
      <div class="panel">
        <h2>Abilities</h2>${abil}
        <h2>Stash</h2>
        ${stashW || stashA || stashM ? '' : '<p class="muted small">Empty. Anything you win or buy that isn\'t equipped waits here.</p>'}
        ${stashW}${stashA}
        ${stashM ? `<h3>Loose mods</h3><div class="mods">${stashM}</div>` : ''}
      </div>
    </div>`;
  },

  // The roof mount: the machine gun up there, its ammo, and the shielding you can buy round it.
  roofPanel() {
    const b = this.build, R = ensureRoof(b);
    if (!R.gun) return `<div class="panel"><h2>Roof mount</h2><p class="muted small">No gun on the roof. The machine guns (the Grinder LMG and the Widow MG) don't go in your hands: they mount here, over a hatch above your seat, and you climb up to them mid-race with <kbd>V</kbd>. Win or buy one and it goes straight on.</p></div>`;
    const w = R.gun, d = weaponStats(w), S = ROOF_SHIELDS[R.shield], rep = shieldRepairCost(b);
    const shields = SHIELD_ORDER.filter((id) => id !== 'none').map((id) => {
      const T = ROOF_SHIELDS[id], on = R.shield === id;
      return `<div class="shop-card ${on ? 'sold' : ''}">${Thumbs.img({ type: 'shield', id })}<b>${T.name}</b><small>${T.desc}</small>
        ${on ? `<small class="good">Fitted · ${Math.max(0, Math.round(R.shieldHp))}/${T.hp}</small>${rep ? `<button class="btn small" data-action="repair-shield" ${b.scrap < rep ? 'disabled' : ''}>Repair for ${rep}</button>` : ''}`
        : `<button class="btn small" data-action="buy-shield" data-arg="${id}" ${b.scrap < T.price ? 'disabled' : ''}>Fit for ${T.price}</button>`}</div>`;
    }).join('');
    return `<div class="panel"><h2>Roof mount</h2>
      <div class="gp-row">${Thumbs.img({ type: 'mount', id: w.id + '-' + R.shield })}</div>
      <div class="gp-row"><div class="gp-name"><b>${d.name}</b><small class="muted">Press <kbd>V</kbd> mid-race to climb up to it, and again to drop back down. Steadier than in your hands and it swings ${S.arc >= Math.PI ? 'all the way round' : 'only so far round inside the ' + S.name.toLowerCase()}, but up there you're exposed: rounds that get past the shield can hit you, and the blast hatch can't cover you.</small></div>
        <div class="gp-ammo">${w.mag}/${d.mag} · ${w.reserve}</div>
        <button class="btn small" data-action="buy-roof-ammo" ${b.scrap < d.packPrice ? 'disabled' : ''}>+${d.pack} for ${d.packPrice}</button></div>
      <h3 class="shop-sec">Shielding <small class="muted">(now: ${S.name}${S.weight ? `, ${Math.round(S.weight * 100)}% off top speed` : ''})</small></h3>
      <div class="shop-grid three">${shields}</div></div>`;
  },

  garageMarket() {
    const b = this.build;
    if (!this.shopOpen) return `<div class="panel"><h2>Shuttered</h2><p>The hatch is padlocked. The ${ACT_LUXURY(this.run.act) ? 'concierge only sees drivers at a Concierge stop' : 'commissary only opens when you book the home shopping channel'} on the TV (🛒).</p><p class="muted small">Repairs, ammo, grenades and spare parts are always available in the Workshop and Armory.</p></div>`;
    const label = { weapon: 'GUN', mod: 'ATTACHMENT', trinket: 'TRINKET', part: 'PART', ability: 'ABILITY', chip: 'DRIVER FOR HIRE' };
    const card = (c, i) => {
      const fitsMine = c.type === 'mod' && MODS[c.id].fits.some((f) => b.rack.concat(b.stash.weapons).some((w) => w.id === f));
      return `<div class="shop-card ${c.sold ? 'sold' : ''}">
        <small class="muted">${label[c.type] || c.type.toUpperCase()}${c.type === 'part' ? ' · ' + SLOT_NAMES[PARTS[c.id].slot] : ''}${c.type === 'mod' ? ` · fits ${MODS[c.id].fits.map((f) => WEAPONS[f].name).join(', ')}${fitsMine ? ' <b class="good">(you own one)</b>' : ''}` : ''}</small>
        ${Thumbs.img(c, b)}<b>${c.name}</b><small>${c.desc}</small>
        <button class="btn small" data-action="buy-item" data-arg="${i}" ${c.sold || b.scrap < c.price ? 'disabled' : ''}>${c.sold ? 'Sold' : 'Buy ' + c.price}</button>
      </div>`;
    };
    // Grouped by counter section (older saves without sections fall into the vehicle bay by type).
    const secOf = (c) => c.section || (c.type === 'weapon' || c.type === 'mod' ? 'weapons' : c.type === 'trinket' ? 'trinkets' : 'vehicle');
    const sections = SHOP_SECTIONS.map((sec) => {
      const cards = this.shop.map((c, i) => [c, i]).filter(([c]) => secOf(c) === sec.id).map(([c, i]) => card(c, i)).join('');
      return cards ? `<h3 class="shop-sec">${sec.name}</h3><div class="shop-grid three">${cards}</div>` : '';
    }).join('');
    return `<div class="panel"><h2>Commissary</h2><p class="muted small">Stock changes every visit. You have <b>${b.scrap} scrap</b>: you won't afford it all, so choose. Purchases go into your stash (or a free slot).</p>${sections}</div>`;
  },

  // The hole in the wall: the dealer's three things, and what's in your pocket.
  garageWall() {
    const b = this.build, D = this.dealer;
    if (!D) return '';
    const full = b.pocket.length >= POCKET_MAX;
    const card = (c, i) => {
      const t = c.type === 'trinket' ? TRINKETS[c.id] : CONTRABAND[c.id], kind = c.type === 'trinket' ? 'SHADY TRINKET' : CONTRA_KIND[t.kind];
      const no = c.sold || b.scrap < c.price || (c.type !== 'trinket' && full);
      return `<div class="shop-card ${c.sold ? 'sold' : ''}">
        <small class="muted">${kind}</small>${Thumbs.img(c, b)}<b>${t.name}</b>${t.street ? `<small class="muted">"${t.street}"</small>` : ''}<small>${c.type === 'trinket' ? t.desc : contraDesc(t, BlackMarket.potency(this.run, c.id))}</small>
        <button class="btn small" data-action="buy-contra" data-arg="${i}" ${no ? 'disabled' : ''}>${c.sold ? 'Sold' : full && c.type !== 'trinket' ? 'Pocket full' : 'Buy ' + c.price}</button>
      </div>`;
    };
    const pocket = b.pocket.length ? b.pocket.map((x) => `<span class="perk">${CONTRABAND[x.id].name}</span>`).join('') : '<span class="muted small">Empty.</span>';
    return `<div class="panel wall-panel"><h2>The hole in the wall</h2>
      <p class="small"><i>${D.hello}</i></p>
      <p class="muted small">Two eyes and a cigarette in the dark. Nothing here is legal and nothing is refunded. The more of something you take, the less it does for you.</p>
      <div class="shop-grid three">${D.stock.map(card).join('')}</div>
      <h3 class="shop-sec">Your pocket (${b.pocket.length}/${POCKET_MAX})</h3><div class="perks">${pocket}</div>
      <p class="muted small">Take drugs and booze, and load hot ammo, from the race briefing.</p></div>`;
  },

  // The Fan Club: what the fans shove under the track door, paid for in Infamy (js/infamy.js).
  garageFans() {
    const b = this.build, run = this.run, F = this.fans, got = b.infamy || 0, R = Infamy.rec(run);
    if (!F) return '';
    if (R.total < FAN_CLUB_OPEN) {
      return `<div class="panel fans-panel"><h2>Fan mail</h2><p class="muted small">A couple of letters under the door, both addressed to whoever had this seat before you. Nobody's watching you yet.</p>
        <p class="small">Put on a show: clean kills, wrecks, parries, a grenade through a window, flip someone off and then pass them. Earn <b>${FAN_CLUB_OPEN} Infamy</b> and the fans start writing.</p>
        <p class="muted small">You have <b>${got}</b> Infamy.</p></div>`;
    }
    const card = (c, i) => {
      const t = c.type === 'trinket' ? TRINKETS[c.id] : FAN_CLUB[c.id], why = Infamy.blocked(c, b, run), no = !!why || got < c.price;
      const desc = (t.desc || '').replace('{scrap}', FAN_DONATION(run.act));
      return `<div class="shop-card ${c.sold ? 'sold' : ''}">
        <small class="muted">${c.type === 'trinket' ? 'FAN-MADE TRINKET' : 'FROM THE FANS'}</small>${Thumbs.img(c, b)}<b>${t.name}</b><small>${desc}</small>
        <button class="btn small" data-action="buy-fan" data-arg="${i}" ${no ? 'disabled' : ''}>${why || c.price + ' Infamy'}</button>
      </div>`;
    };
    const letters = ['"Saw you put that rocket back where it came from. Do it again."', '"My cellmate has your number on his wall. Don\'t die, he\'ll be unbearable."', '"I bet twenty scrap on you and you made me look stupid. Do it again."', '"Flip off Vale for me."', '"Mum says you\'re a bad influence. I made you this anyway."'];
    return `<div class="panel fans-panel"><h2>Fan mail</h2>
      <p class="small"><i>${letters[(b.race + R.total) % letters.length]}</i></p>
      <p class="muted small">Shoved under the track door since your last race. Paid for in <b>Infamy</b>: you have <b>${got}</b> (${R.total} earned this run).</p>
      <div class="shop-grid three">${F.stock.map(card).join('')}</div></div>`;
  },

  garagePaint() {
    const c = this.cos, sub = this.paintTab || 'body';
    const opt = (key, list, render, cur = c[key], argKey = key) => list.map((o) => {
      const locked = false, on = cur === o.id; // every paint job is open: runs are self-contained
      return `<button class="opt ${on ? 'on' : ''} ${locked ? 'locked' : ''}" ${locked ? 'disabled' : ''} data-action="cosmetic" data-arg="${argKey}:${o.id}" title="${locked ? 'Unlocks at ' + o.rep + ' reputation' : o.name}">${render ? render(o) : ''}<span>${locked ? '🔒 ' + o.rep : o.name}</span></button>`;
    }).join('');
    const sw = (o) => `<i class="swatch" style="background:${o.color}"></i>`;
    const L = COSMETICS, row = (title, html) => `<h3>${title}</h3><div class="opts">${html}</div>`;
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
      guns: () => Object.keys(SHORT_WEAPON).map((w) => row(SHORT_WEAPON[w] + ': finish', opt('gunFinish', L.gunFinish, (o) => (o.color ? sw(o) : ''), c.gunFinish[w], 'gun.' + w))
        + row(SHORT_WEAPON[w] + ': welded-on junk', opt('gunKit', L.gunKit, null, c.gunKit[w], 'kit.' + w)
          + (c.gunKit[w] === 'patched' ? `<button class="opt" data-action="cosmetic" data-arg="reweld.${w}:1">Re-weld patches</button>` : ''))).join(''),
      presets: () => `<p class="muted small">Save your whole look (car, cabin and guns) into a slot and swap between them any time.</p>` + c.presets.map((p, i) => `<div class="preset-row">
          <b>Slot ${i + 1}</b> <span class="muted small">${p ? `${(cosOption('style', p.style) || {}).name || ''} · ${(cosOption('paint', p.paint) || {}).name || ''} · #${p.number}` : 'empty'}</span>
          <button class="opt" data-action="preset-save" data-arg="${i}">Save</button>
          <button class="opt" ${p ? '' : 'disabled'} data-action="preset-load" data-arg="${i}">Load</button></div>`).join(''),
    };
    const tabs = [['body', 'Body'], ['kit', 'Kit'], ['cabin', 'Cabin'], ['guns', 'Guns'], ['presets', 'Presets']]
      .map(([id, n]) => `<button class="opt ${sub === id ? 'on' : ''}" data-action="paint-tab" data-arg="${id}">${n}</button>`).join('');
    return `<div class="paint-opts">
      <p class="muted small">Your look is kept between runs. Every finish, paint and part of the kit is yours to choose.</p>
      <div class="opts subtabs">${tabs}</div>
      ${sub === 'cabin' || sub === 'body' || sub === 'kit' ? `<p class="muted small">Drag the view to look ${sub === 'cabin' ? 'round the cabin' : 'round the car'}${sub === 'cabin' ? '' : ' · scroll to zoom'}.</p>` : ''}${pages[sub]()}</div>`;
  },

  showReward() {
    this.saveRun();
    const cards = this.rewards.map((c, i) => `<button class="up-card rarity-${c.type === 'trinket' || c.type === 'chip' ? 'epic' : c.type === 'part' ? 'common' : 'rare'}" data-action="pick-reward" data-arg="${i}">
      <div class="up-rarity">${c.type === 'chip' ? 'driver' : c.type}</div>
      ${Thumbs.img(c, this.build)}
      <div class="up-name">${c.name}</div>
      <div class="up-desc">${c.desc}</div>
      ${c.type === 'part' ? `<div class="up-desc"><i>Replaces your ${PARTS[this.build.parts[PARTS[c.id].slot].id].name}</i></div>` : ''}
    </button>`).join('');
    this.setUI(`<div class="screen reward">
      <h1>${this.rewardKind === 'boss' ? 'A driver wants in' : this.rewardKind === 'elite' ? 'Elite spoils' : this.rewardKind === 'stash' ? 'Contraband stash' : 'Pick your cut'}</h1>
      <p class="muted">${this.rewardKind === 'boss' ? `${BOSSES[this.run.act].name} is beaten, and the block noticed. Inmates who want to ride with you: take one on (they drive for you from the next race; whoever they replace waits in the garage).` : this.build.scrap + ' scrap · choose one'}</p>
      <div class="cards">${cards}</div>
      <button class="btn ghost" data-action="skip-reward">Skip (+${SKIP_SCRAP} scrap)</button>
    </div>`);
  },

  // ---------- Loop ----------

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    if (Input.consume('KeyM')) Sound.toggleMute();

    if (this.state === 'title' && Input.consume('Escape') && !document.getElementById('settings')) {
      if (this.titlePanel) this.showTitle(this.titleFrom);
      else if (this.titleFrom) this.continueRun();
    }
    if (this.state === 'map' && !this.guideOpen && this.tvShows && !document.getElementById('settings')) { // the TV's remote
      if (Input.consume('ArrowLeft') || Input.consume('KeyA')) this.tvFlip(this.tvSel - 1);
      if (Input.consume('ArrowRight') || Input.consume('KeyD')) this.tvFlip(this.tvSel + 1);
      if (Input.consume('Enter')) this.tvBook();
    }
    if (this.state === 'race') {
      if (Input.consume('KeyP') || Input.consume('Escape')) this.pause();
      else if (this.view === 'cockpit' && !this.locked && !this.noLock) Sound.engine(0, 0, false, false); // wait for a click
      else {
        // A big moment (js/infamy.js) slows the race for a beat; real time keeps running out the slow motion.
        const C = this.combat, slow = C && C.slowT > 0;
        if (slow) C.slowT -= dt;
        this.updateRace(slow ? dt * BIG.slow : dt);
      }
    }
    if (this.tutorial) this.tutorial.update(dt);
    if (this.state === 'intro' && this.intro) this.intro.update(dt);
    // Menu theme on the title; the race's own track from the briefing to the flag (quieter while paused).
    const racing = this.race && this.race.music && ['briefing', 'race', 'paused'].includes(this.state);
    Music.set(this.state === 'intro' ? (this.intro ? this.intro.music() : null) : this.state === 'title' ? Music.MENU : racing ? this.race.music : null, this.state === 'paused' ? 0.4 : this.state === 'briefing' ? 0.7 : 1);
    WeatherSound.set(racing ? wxOf(this.race.weather).ambience || null : null, this.state === 'paused' ? 0.3 : 1);
    this.render(dt);
    this.renderPreview(dt);
    Input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  },

  updateRace(dt) {
    const race = this.race, combat = this.combat, p = race.player;
    Playtest.frame(race.state === 'racing');
    if (Input.consume('Digit1')) combat.select(0);
    if (Input.consume('Digit2')) combat.select(1);
    if (Input.consume('Digit3')) combat.select(2);
    if (Input.consume('KeyQ')) combat.cycle(1);
    if (Input.consume('KeyR')) combat.reload();
    if (Input.consume('KeyE')) combat.activateAbility(0);
    if (Input.consume('KeyF')) combat.activateAbility(1);
    combat.setHatch(Input.keys.has('Space'));
    this.updateEmoteKey(dt);
    this.updateOrderKey(dt);
    if (Input.consume('KeyB')) combat.fitSpare();
    if (Input.consume('KeyV') || Input.consume('Digit4')) combat.toggleRoof(); // up into the roof hatch to the mounted gun, or back down
    if (Input.consume('KeyA') || Input.consume('ArrowLeft')) combat.swerve(-1);
    if (Input.consume('KeyD') || Input.consume('ArrowRight')) combat.swerve(1);
    if (Input.consume('KeyG')) combat.cookGrenade(); // hold G (or the right button) to cook it, let go to throw
    if (combat.cook && !Input.keys.has('KeyG') && !this.mouse.rdown) this.throwGrenade();

    const aim = this.aimAngle();
    const sub = 2;
    for (let k = 0; k < sub; k++) {
      const sdt = dt / sub;
      const inp = race.state === 'racing'
        ? this.driver.update(race, sdt)
        : { throttle: race.countdown < 0.2 ? 1 : 0, brake: 0, steer: 0, handbrake: false, nitro: false };
      race.update(sdt, inp);
      combat.update(sdt, { aim, firing: this.mouse.down, pressed: this.mouse.pressed && k === 0 });
      for (const ev of race.events) { Sound.play(ev); if (ev.type === 'crash' && this.cockpit) this.cockpit.crash(ev); }
      for (const ev of combat.events) {
        Sound.play(ev);
        Playtest.event(ev, combat.weapon.id);
        if (this.cockpit) this.cockpit.onEvent(ev);
        if (this.tutorial) this.tutorial.onEvent(ev);
        if (ev.type === 'crewHit' || ev.type === 'crewKill') this.hitMark = { t: ev.type === 'crewKill' ? 0.7 : 0.3, kill: ev.type === 'crewKill' };
      }
      combat.events.length = 0;
    }
    // Crossing the line can be a big moment too: beating a boss, or winning by a nose.
    if (p.finished && !this.finishMoment && !this.tutorial) {
      this.finishMoment = true;
      const N = combat.inmate, boss = race.boss, bc = race.bossCar, second = race.cars.filter((c) => c !== p && !c.finished).sort((a, b) => b.progress - a.progress)[0];
      if (boss && (boss.mustWin ? p.place === 1 : !bc.finished || p.place < bc.place)) combat.bigMoment(`${N} BEATS ${boss.name.toUpperCase()}`, boss.mustWin ? 'THE CROWN · THE CITY IS ON ITS FEET' : 'QUALIFIED FOR THE NEXT ACT', true);
      else if (p.place === 1 && second && Math.hypot(second.x - p.x, second.y - p.y) < 90) combat.bigMoment('BY A NOSE', `${N} TAKES IT FROM ${shortName(second).toUpperCase()}`, true);
    }
    this.mouse.pressed = false;
    Sound.engine(clamp(p.speed / p.stats.top, 0, 1.4), p.input ? p.input.throttle : 0, p.nitroOn, true);

    const lead = 0.3;
    this.cam.x = lerp(this.cam.x, p.x + p.vx * lead, Math.min(1, dt * 5));
    this.cam.y = lerp(this.cam.y, p.y + p.vy * lead, Math.min(1, dt * 5));
    this.cam.zoom = lerp(this.cam.zoom, this.baseZoom() * clamp(1.0 - p.speed / 2600, 0.78, 1), Math.min(1, dt * 1.5));

    // Wrecked: no crawling home on the rims. A beat for it to land, then you're out of the race (last place).
    // A vendetta is a surprise: nothing in the briefing, just the reveal a few seconds after the green light.
    const V = race.vendetta;
    if (V && !V.shown && race.state === 'racing' && race.time > 4) {
      V.shown = true;
      race.message(`☠ ${V.v.name} is back from the dead`, '#ff2a2a', true);
      Sound.play({ type: 'bossTell' });
    }
    if (V && V.shown === true && race.time > 6.4) { V.shown = 2; race.message(`${vendettaAdapt(V.v.how).label}, and hunting you. Wreck them: ${VENDETTA.purse[0]}-${VENDETTA.purse[1]} scrap`, '#ff8a6a'); }
    // Dead Man's Rosary: once a run, a wreck doesn't take.
    if (race.state === 'racing' && p.hp <= 0 && !p.finished && !this.tutorial && has(this.build, 'deadrosary') && !this.run.flags.rosaryUsed) {
      this.run.flags.rosaryUsed = true;
      p.hp = 30;
      race.message('The rosary burns in your fist. Not today.', '#c9a0ff', true, true);
      Sound.play({ type: 'bossTell' });
    }
    if (race.state === 'racing' && p.hp <= 0 && !p.finished && !this.tutorial) {
      if (!this.wreckT) {
        this.wreckT = 1e-3;
        race.message('WRECKED', '#ff3b1f', true, true);
        Sound.play({ type: 'explode', big: true });
        if (this.cockpit) this.cockpit.shake = Math.max(this.cockpit.shake || 0, 1.2);
      }
      this.wreckT += dt;
      if (this.wreckT > 2.5) { p.dnf = true; race.rankCars(); race.state = 'done'; }
    }
    if (race.state === 'done' && this.tutorial) {
      if (this.locked) document.exitPointerLock();
      Sound.engine(0, 0, false, false);
      this.finishTutorial();
    } else if (race.state === 'done') {
      this.state = 'results';
      if (this.locked) document.exitPointerLock();
      Sound.engine(0, 0, false, false);
      this.showResults();
    }
  },

  // The 3D garage fills the screen behind the clipboard (and behind the reward pick).
  renderPreview(dt) {
    const cv = this.previewCanvas;
    const show = this.preview && ['garage', 'reward', 'map', 'event', 'title'].includes(this.state);
    if (!show) { cv.style.display = 'none'; if (this.tip) this.tip.classList.add('hidden'); return; }
    cv.style.display = 'block';
    if (this.state !== 'garage') this.preview.setStation(this.state === 'title' ? 'title' : 'overview');
    const panel = this.W <= 900 ? 0 : this.state === 'garage' ? 500 : this.state === 'title' ? -420 : 0;
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
    const offTrack = ['garage', 'reward', 'over', 'title', 'bye', 'tutdone', 'intro'].includes(this.state);
    this.c3d.style.visibility = offTrack ? 'hidden' : 'visible';
    if (!race || offTrack) { ctx.fillStyle = '#100f0c'; ctx.fillRect(0, 0, W, H); return; }
    const live = this.state !== 'briefing';
    if (this.view === 'cockpit') {
      this.cockpit.render(this.state === 'race' ? dt : 0, this.time);
      ctx.clearRect(0, 0, W, H);
      if (live) WeatherGlass.draw(ctx, this.cockpit.wx, W, H, this.state === 'race' ? dt : 0, race.player.speed / 500);
      if (live) drawCockpitHUD(ctx, this, W, H, this.time);
      if (live && this.hitMark && this.hitMark.t > 0) { // a hit marker: you got someone through the glass
        const hm = this.hitMark, a = Math.min(1, hm.t / 0.2), r0 = hm.kill ? 10 : 7, r1 = hm.kill ? 22 : 14;
        hm.t -= this.state === 'race' ? dt : 0;
        ctx.strokeStyle = hm.kill ? `rgba(255,210,63,${a})` : `rgba(255,90,70,${a})`;
        ctx.lineWidth = hm.kill ? 3 : 2;
        ctx.beginPath();
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { ctx.moveTo(W / 2 + sx * r0, H / 2 + sy * r0); ctx.lineTo(W / 2 + sx * r1, H / 2 + sy * r1); }
        ctx.stroke();
      }
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

const SHORT_WEAPON = { pistol: 'Pistol', smg: 'SMG', shotgun: 'Shotgun', rocket: 'Launcher', flare: 'Flare', nailgun: 'Nail Gun', flamer: 'Flamer', harpoon: 'Harpoon', carbine: 'Carbine', liberty: 'Liberty', typewriter: 'Typewriter', lmg: 'Grinder', pangun: 'Widow' };

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

// The loadout, bottom right. Only what you need now: your guns (the one in your hands bright), grenades, and the
// rest only when it matters (an ability you've fitted, the hatch once it's taken damage or is shut, swerve while
// it recharges, a part that's failing, a spare to fit). The dashboard carries hull, place and lap.
function drawWeaponPanel(ctx, P, W, H) {
  const c = P.combat, b = c.build, rows = [];
  b.rack.forEach((w, i) => {
    const d = weaponStats(w), st = c.wstate[i], reloading = st.reloadT > 0;
    rows.push([i === c.wi, `${i + 1} ${d.name}`, reloading ? 'RELOADING' : `${w.mag} | ${w.reserve}`, i === c.wi ? (reloading ? 1 - st.reloadT / d.reload : w.mag / d.mag) : null, reloading ? '#ff9f1c' : '#5ad8ff']);
  });
  const hh = ensureHatch(b), hf = hh.hp / HATCH.max;
  const hatch = c.hatch.jammed ? 'HATCH JAMMED' : c.guarded ? 'HATCH SHUT' : hf < 0.995 ? `HATCH ${Math.ceil(hh.hp)}%` : '';
  rows.push([false, `G ×${b.grenades}`, hatch, hatch && !c.guarded ? hf : null, c.hatch.jammed ? '#ff3b1f' : hf < 0.3 ? '#ff7a1f' : '#c9a43a']);
  c.abil.forEach((a, i) => {
    if (!a) return;
    const def = ABILITIES[a.id];
    rows.push([false, `${i === 0 ? 'E' : 'F'} ${def.name}`, a.cd > 0 ? `${a.cd.toFixed(1)}s` : 'READY', a.cd > 0 ? 1 - a.cd / def.cooldown : null, '#7cfc00']);
  });
  if (c.swerveCd > 0) rows.push([false, 'Swerve', `${c.swerveCd.toFixed(1)}s`, null]);
  if (Crew.gunnerHp(b) < GUNNER.hp) rows.push([false, 'You', c.gunnerOut ? 'OUT' : `${Math.round((100 * Crew.gunnerHp(b)) / GUNNER.hp)}%`, Crew.gunnerHp(b) / GUNNER.hp, '#ff8a5a']);
  if (Crew.hp(b) < DRIVER.hp) rows.push([false, `Driver: ${(c.crew || Crew.current(b)).short}`, c.ownDriverDead ? 'DEAD' : `${Math.round((100 * Crew.hp(b)) / DRIVER.hp)}%`, Crew.hp(b) / DRIVER.hp, '#ff5a3a']);
  const failing = PART_SLOTS.map((slot, i) => {
    const part = b.parts[slot], f = clamp(part.dur / partMaxDur(b, part.id), 0, 1);
    return part.dur <= 0 ? `${['ENG', 'TYR', 'ARM', 'NOS'][i]} BROKEN` : f < 0.3 ? `${['ENG', 'TYR', 'ARM', 'NOS'][i]} ${Math.round(f * 100)}%` : null;
  }).filter(Boolean);
  const spare = b.spare && partBroken(b, PARTS[b.spare.id].slot);
  const extra = (failing.length ? 1 : 0) + (spare ? 1 : 0);
  const h = 14 + rows.length * 22 + extra * 18;
  const x = W - 236, y = H - h - 12;
  hudPanel(ctx, x, y, 224, h);
  let yy = y + 20;
  for (const [active, label, right, frac, col] of rows) {
    ctx.fillStyle = active ? '#ffd23f' : 'rgba(255,255,255,0.6)';
    ctx.font = `${active ? 'bold ' : ''}13px ${hudFont()}`;
    ctx.textAlign = 'left'; ctx.fillText(label, x + 10, yy);
    ctx.textAlign = 'right'; ctx.fillText(right, x + 214, yy);
    if (frac != null) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 10, yy + 4, 204, 3);
      ctx.fillStyle = col; ctx.fillRect(x + 10, yy + 4, 204 * clamp(frac, 0, 1), 3);
    }
    yy += 22;
  }
  ctx.textAlign = 'left';
  ctx.font = `bold 11px ${hudFont()}`;
  if (failing.length) { ctx.fillStyle = Math.floor(P.time * 3) % 2 ? '#ff7a1f' : '#ffb070'; ctx.fillText(failing.join('  '), x + 10, yy - 4); yy += 18; }
  if (spare) { ctx.fillStyle = Math.floor(P.time * 3) % 2 ? '#ffd23f' : '#fff'; ctx.fillText(`B: FIT SPARE ${PARTS[b.spare.id].name.toUpperCase()}`, x + 10, yy - 4); }
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

// Messages stay out of your sightline. Race-flow calls (GO, laps, the finish, WRECKED, a boss's warning) sit near
// the top of the screen; everything else (wrecks, bounties, kills, Infamy) is a small feed in the top-right corner,
// newest first, like a kill feed.
function drawMessages(ctx, race, W, H, fame) {
  const fade = (t, life) => clamp(Math.min(t * 6, (life - t) * 2.5), 0, 1);
  ctx.textAlign = 'center';
  let y = race.bossCar ? 98 : 40; // under the boss's health bar
  for (const m of race.messages) {
    if (!m.center) continue;
    ctx.globalAlpha = fade(m.t, m.life);
    ctx.font = `bold 26px ${hudFont()}`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(m.text, W / 2 + 2, y + 2);
    ctx.fillStyle = m.color;
    ctx.fillText(m.text, W / 2, y);
    y += 32;
  }
  // Infamy earned in the same instant as an event rides on that event's line instead of taking its own.
  const feed = race.messages.filter((m) => !m.center).map((m) => ({ text: m.text, color: m.color, t: m.t, life: m.life, fame: 0 }));
  for (const f of fame || []) {
    const n = +(/\+(\d+)/.exec(f.text) || [0, 0])[1], host = feed.find((m) => Math.abs(m.t - f.t) < 0.05);
    if (host) host.fame += n; else feed.push({ text: f.text, color: '#ff6ad5', t: f.t, life: 3, fame: 0 });
  }
  feed.sort((a, b) => a.t - b.t).splice(5);
  ctx.textAlign = 'right';
  ctx.font = `bold 14px ${hudFont()}`;
  y = 28;
  for (const m of feed) {
    const tail = m.fame ? `  +${m.fame} INFAMY` : '', tw = tail ? ctx.measureText(tail).width : 0;
    const a = fade(m.t, m.life), w = ctx.measureText(m.text).width + tw, dx = (1 - clamp(m.t * 8, 0, 1)) * 24;
    ctx.globalAlpha = a * 0.6;
    ctx.fillStyle = '#000';
    ctx.fillRect(W - 24 - w - 8 + dx, y - 14, w + 16, 20);
    ctx.globalAlpha = a;
    if (tail) { ctx.fillStyle = '#ff6ad5'; ctx.fillText(tail, W - 24 + dx, y); }
    ctx.fillStyle = m.color;
    ctx.fillText(m.text, W - 24 - tw + dx, y);
    y += 23;
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
}

// The emote wheel while T is held: four gestures round the crosshair, the one you're flicking towards lit up.
function drawEmoteWheel(ctx, P, W, H) {
  const E = P.emoteHold;
  if (!E || !E.open) return;
  const cx = W / 2, cy = H / 2, R = 92, sel = Math.hypot(E.x, E.y) >= 30 ? P.emoteAt(E) : null;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.arc(cx, cy, R + 46, 0, TAU); ctx.fill();
  EMOTE_ORDER.forEach((id, i) => {
    const a = -Math.PI / 2 + i * (Math.PI / 2), x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, on = id === sel;
    ctx.fillStyle = on ? 'rgba(255,210,63,0.9)' : 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = '30px system-ui';
    ctx.fillText(EMOTES[id].icon, x, y + 10);
    ctx.font = `bold 12px ${hudFont()}`;
    ctx.fillStyle = on ? '#ffd23f' : '#ddd';
    ctx.fillText(EMOTES[id].name.toUpperCase(), x, y + 50);
  });
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + E.x * 0.6, cy + E.y * 0.6); ctx.stroke();
  ctx.restore();
}

function drawCockpitHUD(ctx, P, W, H, t) {
  const race = P.race, c = P.combat, p = race.player;
  const viewAng = P.cockpit.aimAngle();
  drawDamageVignette(ctx, P, W, H, viewAng);
  drawBossBar(ctx, P, W, H, t);
  if (Settings.data.showFps) { // the frame-rate readout (Settings)
    const f = Math.round(Playtest.fps.now || 0);
    ctx.save(); ctx.font = `bold 13px ${hudFont()}`; ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W - 78, 8, 68, 20);
    ctx.fillStyle = f >= 50 ? '#7CFC00' : f >= 30 ? '#ffd23f' : '#ff5a3a'; ctx.fillText(`${f} FPS`, W - 16, 23);
    ctx.restore();
  }
  drawEmoteWheel(ctx, P, W, H);
  drawOrderWheel(ctx, P, W, H);

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
  if (c.weapon.id === 'pistol') { // a plain dot in a gap ring
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) { ctx.beginPath(); ctx.arc(cx, cy, 9, a + 0.35, a + Math.PI / 2 - 0.35); ctx.stroke(); }
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  } else if (c.weapon.id === 'smg') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath(); ctx.moveTo(cx + dx * 6, cy + dy * 6); ctx.lineTo(cx + dx * 14, cy + dy * 14); ctx.stroke();
    }
  } else if (c.weapon.id === 'shotgun') {
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  } else if (c.weapon.id === 'flare') {
    ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx + 10, cy); ctx.lineTo(cx, cy + 10); ctx.lineTo(cx - 10, cy); ctx.closePath(); ctx.stroke();
  } else if (c.weapon.id === 'nailgun') { // a little T for the nail
    ctx.beginPath(); ctx.moveTo(cx - 7, cy - 6); ctx.lineTo(cx + 7, cy - 6); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 8); ctx.stroke();
  } else if (c.weapon.id === 'flamer') { // the cone it reaches
    ctx.beginPath(); ctx.arc(cx, cy + 30, 34, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.stroke();
    ctx.fillStyle = '#ff9a2a'; ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  } else if (c.weapon.id === 'carbine' || c.weapon.id === 'liberty') { // a post in a ring (the Liberty's aperture sight), a fine cross on the carbine
    if (c.weapon.id === 'liberty') { ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, cy + 12); ctx.lineTo(cx, cy); ctx.stroke(); }
    else for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(cx + dx * 4, cy + dy * 4); ctx.lineTo(cx + dx * 10, cy + dy * 10); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1, cy - 1, 2, 2);
  } else if (['typewriter', 'lmg', 'pangun'].includes(c.weapon.id)) { // corner brackets that open up as the gun climbs
    const g = 10 + 14 * ((wst.bloom || 0) / 1.5);
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.beginPath(); ctx.moveTo(cx + sx * g, cy + sy * (g - 6)); ctx.lineTo(cx + sx * g, cy + sy * g); ctx.lineTo(cx + sx * (g - 6), cy + sy * g); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1, cy - 1, 2, 2);
  } else if (c.weapon.id === 'harpoon') { // barbed arrowhead
    ctx.beginPath(); ctx.moveTo(cx - 9, cy + 6); ctx.lineTo(cx, cy - 6); ctx.lineTo(cx + 9, cy + 6); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 14); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  }
  if (wst.reloadT > 0) {
    ctx.strokeStyle = '#ff9f1c';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 34, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - wst.reloadT / wd.reload)); ctx.stroke();
  }
  // A live grenade in your hand: the fuse burning down round the crosshair, red when it's nearly gone.
  if (c.cook) {
    const left = Math.max(0, GRENADE.fuse - c.cook.t), f = left / GRENADE.fuse, hot = left < 0.6;
    ctx.strokeStyle = hot ? (Math.floor(c.cook.t * 12) % 2 ? '#ff3b1f' : '#ffd23f') : '#9be36a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = `bold 12px ${hudFont()}`; ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(left < GRENADE.fuse - GRENADE.air ? 'COOKED: THROW!' : `PIN OUT ${left.toFixed(1)}`, cx, cy - 36);
  }
  // Ammo by the crosshair only when it's running out (the full count is in the loadout panel).
  const low = c.weapon.mag <= Math.max(1, Math.floor(wd.mag * 0.3));
  if (wst.reloadT > 0 || low) {
    ctx.textAlign = 'center';
    ctx.font = `bold 12px ${hudFont()}`;
    ctx.fillStyle = c.weapon.mag === 0 ? '#ff6b6b' : 'rgba(255,200,120,0.9)';
    ctx.fillText(wst.reloadT > 0 ? 'RELOADING' : c.weapon.mag === 0 ? (c.weapon.reserve > 0 ? 'R TO RELOAD' : 'NO AMMO') : `${c.weapon.mag}`, cx, cy + 48);
  }

  // Minimal race info (the rest lives on the dashboard).
  // Place and lap, small in the corner (green while you're making the cut).
  const lap = clamp(Math.floor(p.progress / race.track.N) + 1, 1, race.laps);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(12, 12, 132, 34);
  ctx.fillStyle = p.place <= race.qualify ? '#7CFC00' : '#ff6b6b';
  ctx.font = `bold 22px ${hudFont()}`;
  ctx.fillText(ordinal(p.place), 20, 37);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `13px ${hudFont()}`;
  ctx.fillText(`Lap ${p.finished ? race.laps : lap}/${race.laps}`, 74, 35);
  drawOrderStatus(ctx, P);

  if (PSX.enabled) {
    // Chunky name tags drawn on the crisp HUD layer (3D text would be mush at 240p).
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Courier New", monospace';
    const shown = [];
    for (const tg of P.cockpit.tags(W, H).sort((a, b2) => a.d - b2.d)) {
      // Only the ones close by, or the one you're aiming at; never two on top of each other.
      const aimed = Math.hypot(tg.x - W / 2, tg.y - H / 2) < 110;
      if (tg.d > 520 && !aimed && !tg.target) continue;
      if (tg.target) tg.label = '▼ ' + tg.label; // the car your driver's after
      if (shown.some((s) => Math.abs(s.x - tg.x) < 90 && Math.abs(s.y - tg.y) < 18)) continue;
      shown.push(tg);
      if (aimed && tg.bounty) tg.label += ' $' + tg.bounty;
      const a = clamp(1.3 - tg.d / 700, 0.35, 1);
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
  drawMessages(ctx, race, W, H, P.combat && P.combat.fameFeed);
  drawBigMoment(ctx, P, W, H);
}

// The broadcast cuts to you (js/infamy.js): a TV caption slides in low over the dash (never over the road you're
// aiming at), and for half a second the screen edges flicker to the C9TV feed.
function drawBigMoment(ctx, P, W, H) {
  const B = P.combat && P.combat.big;
  if (!B || B.t > BIG.hold + 0.4) return;
  const t = B.t, slideIn = clamp(t / 0.22, 0, 1), out = clamp((t - BIG.hold) / 0.3, 0, 1);
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  // Edge flicker: scanlines and a cold TV tint creeping in from the borders, gone in half a second.
  if (Settings.data.flicker !== false && t < 0.55) {
    const a = (1 - t / 0.55) * (0.6 + 0.4 * Math.sin(t * 70));
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(1, `rgba(120,200,255,${0.32 * a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(0,0,0,${0.22 * a})`;
    const band = (t * 900) % H;
    for (let y = 0; y < H; y += 4) if (y < H * 0.12 || y > H * 0.88 || Math.abs(y - band) < 18) ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = `rgba(255,40,40,${0.9 * a})`; ctx.font = `bold 16px ${hudFont()}`; ctx.textAlign = 'left';
    ctx.fillText('● REC  C9TV  CAM 4', 26, H - 26);
  }
  // The caption: a red LIVE tag, the line in black on white, the details in a strip under it.
  ctx.save();
  ctx.font = `bold 26px ${hudFont()}`;
  const lw = Math.max(ctx.measureText(B.line).width + 36, 280), tagW = 104, w = tagW + lw;
  const x = W * 0.5 - w / 2 + (1 - ease(slideIn)) * -W * 0.6 + ease(out) * W * 0.8, y = H * 0.8;
  ctx.globalAlpha = 1 - out;
  ctx.fillStyle = '#c8141a'; ctx.fillRect(x, y, tagW, 44);
  ctx.fillStyle = '#fff'; ctx.font = `bold 15px ${hudFont()}`; ctx.textAlign = 'left';
  ctx.fillText((Math.floor(t * 3) % 2 ? '●' : '○') + ' LIVE', x + 12, y + 19); ctx.fillText('C9TV', x + 12, y + 36);
  ctx.fillStyle = '#f4f0e6'; ctx.fillRect(x + tagW, y, lw, 44);
  ctx.fillStyle = '#111'; ctx.font = `bold 26px ${hudFont()}`; ctx.fillText(B.line, x + tagW + 18, y + 31);
  if (B.sub) {
    ctx.font = `bold 14px ${hudFont()}`;
    const sw = ctx.measureText(B.sub).width + 30;
    ctx.fillStyle = 'rgba(10,10,12,0.85)'; ctx.fillRect(x + tagW, y + 44, sw, 24);
    ctx.fillStyle = '#ff6ad5'; ctx.fillText(B.sub, x + tagW + 15, y + 61);
  }
  ctx.restore();
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
