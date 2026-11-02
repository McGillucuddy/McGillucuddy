// In-page playtest bot: plays whole runs of Death Row Derby through the game's own code (Proto), as a reasonable
// human might. Injected into the page; the node driver calls Bot.step() repeatedly and collects Bot.log.
window.Bot = {
  log: { runs: [], errors: [] },
  run: null, pics: [], hold: 0, semi: 0, frames: 0, raceFrames: 0, shots: {},
  skill: 1, // aim jitter scale (1 = decent human)

  startRun() {
    Proto.action('new-run');
    this.run = { races: [], events: [], shop: [], end: null, maxAct: 0, scrapPeak: 0, rewards: [], t0: Date.now() };
    this.log.runs.push(this.run);
  },

  // ---------- In the race ----------
  target(p, def) {
    const range = def.speed * def.life * 0.95;
    let best = null, bs = 1e9;
    for (const c of Proto.race.cars) {
      if (c === p || c.hp <= 0 || c.finished) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d > range) continue;
      const a = Math.abs(wrapAngle(Math.atan2(c.y - p.y, c.x - p.x) - p.heading));
      const score = d * (1 + a) * (c.isBoss ? 0.6 : 1); // in front and close; the boss first
      if (score < bs) { bs = score; best = c; }
    }
    return best;
  },
  raceFrame() {
    const race = Proto.race, cb = Proto.combat, p = race.player;
    let def = cb.weaponDef, w = cb.weapon;
    // A dry gun: switch to one with ammo.
    if (w.mag + w.reserve <= 0) {
      const i = cb.build.rack.findIndex((x) => x.mag + x.reserve > 0);
      if (i >= 0 && i !== cb.wi) cb.select(i);
      def = cb.weaponDef; w = cb.weapon;
    }
    const t = this.target(p, def);
    let aim = p.heading;
    if (t) {
      const d = Math.hypot(t.x - p.x, t.y - p.y), lead = d / def.speed;
      const tx = t.x + (t.vx || 0) * lead, ty = t.y + (t.vy || 0) * lead;
      aim = Math.atan2(ty - p.y, tx - p.x) + (Math.random() - 0.5) * 0.06 * this.skill;
    }
    Proto.aimAngle = () => aim;
    Proto.mouse.down = !!t && race.state === 'racing';
    Proto.mouse.pressed = !!t && race.state === 'racing' && (this.semi++ % 6 === 0);
    // Incoming rockets: slam the hatch.
    let threat = false;
    for (const q of cb.projectiles) {
      if (q.type !== 'rocket' || q.owner === p || q.dead) continue;
      const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
      if (d < 200 && (q.vx * dx + q.vy * dy) > 0) threat = true;
    }
    if (threat) this.hold = 0.35;
    this.hold -= 1 / 60;
    if (this.hold > 0) Input.keys.add('Space'); else Input.keys.delete('Space');
    // Abilities when a rival is near; a grenade at close range now and then.
    if (t && Math.hypot(t.x - p.x, t.y - p.y) < 350) {
      cb.activateAbility(0); cb.activateAbility(1);
      if (Math.random() < 0.004 && cb.build.grenades > 0) Proto.throwGrenade();
    }
    if (cb.spareNeeded && cb.build.spare) cb.fitSpare && cb.fitSpare();
    Proto.updateRace(1 / 60);
    Proto.mouse.pressed = false;
    this.raceFrames++;
    // A snapshot of a few races, from the seat (one render, half a minute in).
    if (this.raceFrames === 1800 && this.pics.length < 6 && Math.random() < 0.5 && Proto.cockpit) {
      const c = Proto.cockpit; c.look.yaw = 0; c.look.pitch = 0;
      c.render(1 / 60, this.raceFrames / 60);
      this.pics.push(c.renderer.domElement.toDataURL('image/jpeg', 0.8));
    }
  },

  // ---------- Between races ----------
  rewardPick() {
    const b = Proto.build, rs = Proto.rewards || [];
    const val = (c) => {
      if (!c) return -1;
      if (c.type === 'weapon') return b.rack.some((w) => w.id === c.id) ? 1 : b.rack.length < rackSlots(b) ? 9 : 5;
      if (c.type === 'part') return 6;
      if (c.type === 'trinket') return 7;
      if (c.type === 'mod') return b.rack.some((w) => modFits(c.id, w.id)) ? 6 : 1;
      if (c.type === 'ability') return b.abilities.some((a) => !a) ? 8 : 3;
      if (c.type === 'chip') return b.chip ? 2 : 7;
      return 3;
    };
    let bi = 0;
    rs.forEach((c, i) => { if (val(c) > val(rs[bi])) bi = i; });
    this.run.rewards.push(rs[bi] ? `${rs[bi].type}:${rs[bi].id}` : 'none');
    Proto.action('pick-reward', String(bi));
  },
  manageLoadout() {
    const b = Proto.build;
    // Fill empty rack slots from the stash; fit mods; slot abilities; fit the chip.
    while (b.stash.weapons.length && b.rack.length < rackSlots(b)) Proto.action('equip-weapon', '0:-1');
    b.stash.mods.forEach((m, si) => {
      b.rack.forEach((w, ri) => { const slot = w.mods.indexOf(null); if (slot >= 0 && modFits(m, w.id) && b.stash.mods[si] === m) Proto.action('fit-mod', `${si}:${ri}:${slot}`); });
    });
    for (let i = b.stash.abilities.length - 1; i >= 0; i--) { const slot = b.abilities.indexOf(null); if (slot >= 0) Proto.action('equip-ability', `${i}:${slot}`); }
    if (!b.chip && b.stash.chips && b.stash.chips.length) Proto.action('equip-chip', '0');
    // Parts: fit stashed parts that cost more than what's fitted (a fair proxy for better).
    for (let i = b.stash.parts.length - 1; i >= 0; i--) {
      const sp = b.stash.parts[i], def = PARTS[sp.id || sp], cur = PARTS[b.parts[def.slot].id];
      if (def && cur && (def.price || 0) > (cur.price || 0)) Proto.action('equip-part', String(i));
    }
  },
  garage() {
    const b = Proto.build, keep = 60, before = b.scrap;
    this.run.visits = this.run.visits || [];
    this.manageLoadout();
    if (b.hull < b.maxHull * 0.8) Proto.action('repair-hull');
    if (b.hatch && b.hatch.hp < 70) Proto.action('repair-hatch');
    for (const slot of PART_SLOTS) if (b.parts[slot].dur < partMaxDur(b, b.parts[slot].id) * 0.5) Proto.action('repair-part', slot);
    b.rack.forEach((w, i) => { const d = weaponStats(w); let n = 0; while (w.reserve < d.pack * 2 && b.scrap - d.packPrice > keep && n++ < 4) Proto.action('buy-ammo', String(i)); });
    if (Proto.shopOpen) (Proto.shop || []).forEach((c, i) => {
      if (c.sold || b.scrap - c.price < keep) return;
      const want = (c.type === 'weapon' && !b.rack.some((w) => w.id === c.id) && b.rack.length < rackSlots(b)) || c.type === 'trinket' || (c.type === 'part' && (PARTS[c.id].price || 0) > (PARTS[b.parts[PARTS[c.id].slot].id].price || 0));
      if (want) { this.run.shop.push(`${c.type}:${c.id}@${c.price}`); Proto.action('buy-item', String(i)); }
    });
    this.manageLoadout();
    this.run.scrapPeak = Math.max(this.run.scrapPeak, b.scrap);
    this.run.visits.push(`${before}->${b.scrap}${Proto.shopOpen ? ' (shop)' : ''}`);
    Proto.shopOpen = false;
    Proto.action('to-map');
  },
  pickMap() {
    const run = Proto.run, b = Proto.build, ids = reachableNodes(run.map, run.cur), nodes = ids.map((id) => mapNode(run.map, id));
    const score = (n) => ({ repair: b.hull < b.maxHull * 0.55 ? 10 : 1, shop: b.scrap > 180 ? 7 : 2, stash: 6, event: 4, race: 5, bounty: 5, elite: b.hull > b.maxHull * 0.7 ? 5.5 : 3, boss: 5 }[n.type] || 3) + Math.random();
    let best = nodes[0];
    for (const n of nodes) if (score(n) > score(best)) best = n;
    Proto.pickNode(best.id);
  },
  event() {
    const ev = Proto.event, b = Proto.build;
    const btn = document.querySelector('[data-action="event-choice"]');
    if (btn && ev && ev.options) {
      const ok = ev.options.map((o, i) => [o, i]).filter(([o]) => !o.ok || o.ok(b));
      const pick = ok[Math.floor(Math.random() * ok.length)];
      this.run.events.push(`${ev.id}:${pick[1]}`);
      Proto.action('event-choice', String(pick[1]));
    } else Proto.action('to-map');
  },

  // One chunk of play. Returns the state, so the driver knows when a run is over.
  step(budget) {
    const t0 = performance.now();
    try {
      while (performance.now() - t0 < budget) {
        const st = Proto.state;
        if (!this.run || this.run.end) return 'idle';
        if (st === 'race') {
          const race = Proto.race;
          if (!this.raceInfo) {
            this.raceInfo = { act: Proto.run.act, type: Proto.run.node.type, boss: race.boss && race.boss.name, weather: race.weather, rack: Proto.build.rack.map((w) => w.id).join('+'), hullStart: Math.round(Proto.build.hull) };
            this.raceFrames = 0;
          }
          this.raceFrame();
          if (this.raceFrames > 60 * 600) { race.state = 'done'; this.raceInfo.timeout = true; } // a stuck race
          continue;
        }
        if (this.raceInfo && st === 'results') {
          const p = Proto.race.player, s = Proto.combat.stats;
          Object.assign(this.raceInfo, { place: p.place, of: Proto.race.cars.length, ok: Proto.lastOk, hpEnd: Math.round(p.hp), wrecked: p.hp <= 0, dealt: Math.round(s.dealt), taken: Math.round(s.taken), kills: s.wrecked, parries: s.parries, secs: Math.round(this.raceFrames / 60), strikes: Proto.build.strikes, scrap: Proto.build.scrap });
          this.run.races.push(this.raceInfo);
          this.run.maxAct = Math.max(this.run.maxAct, this.raceInfo.act);
          this.raceInfo = null;
          Proto.action('after-results');
          continue;
        }
        if (st === 'briefing') { Proto.noLock = true; Proto.action('start'); continue; }
        if (st === 'paused') { Proto.state = 'race'; Proto.setUI(''); this.log.pauses = (this.log.pauses || 0) + 1; continue; } // the pointer-lock auto-pause
        if (st === 'reward') { this.rewardPick(); continue; }
        if (st === 'garage') { this.garage(); continue; }
        if (st === 'map') { this.pickMap(); continue; }
        if (st === 'event') { this.event(); continue; }
        if (st === 'over') {
          this.run.end = document.querySelector('.screen.end.won') ? 'WALKED FREE' : 'three strikes';
          this.run.mins = ((Date.now() - this.run.t0) / 60000).toFixed(1);
          return 'over';
        }
        return 'stuck:' + st;
      }
    } catch (e) {
      this.log.errors.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | '));
      return 'error';
    }
    return 'running';
  },
};
