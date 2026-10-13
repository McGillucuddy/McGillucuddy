'use strict';
// Gunplay layer on top of a Race: the player's build (ammo weapons, abilities, trinkets,
// parts that wear and break), armed rivals, projectiles, mines, grenades, explosions.
// Pure simulation (2D world units); views read its state to draw it.

const ROCKET_SPEED = 820;
const LOCK_TIME = 1.35;
const PARRY_WINDOW = 0.3;
const GRENADE_G = 700;
const FIT_TIME = 2.5;

// Tyres: hit points per tyre, and how hard rivals' stray shots hit yours (they never aim for them).
const TYRE_HP = 40;
const TYRE_R = 4.2; // how close a shot's path must pass a wheel to hit the tyre
// Standing up at the roof gun: steadier aim (braced on the mount) but exposed. A round that gets past the shield
// hits you rather than the car a share of the time (exposure): more damage, a flinch, and enough of them in a few
// seconds knock you back down. Climbing up or down takes a moment.
const ROOF = { steady: 0.6, climb: 0.6, drop: 0.45, exposure: 0.45, youDmg: 1.6, blastMul: 1.3, knockHits: 3, knockWindow: 2.5 };
const RIVAL_TYRE = 0.15; // a stray rival round that happens to land by a wheel
// A tyre hunter's aimed burst: a longer wind-up (you see it coming), eight rounds at one wheel. 'start' is how long
// into the race before anyone tries it; 'gap' is the least time between any two attempts on you.
const TYRE_HUNT = { rate: 2.0, burst: 8, spread: 0.025, range: 320, start: 25, gap: 12, chance: 0.6 };

// What hurt you, in words (for the playtest report).
const HURT_KIND = { exposed: 'hits on you at the roof gun', bullet: 'gunfire', rocket: 'rockets', blast: 'explosions', flame: 'fire', mine: 'mines', harpoon: 'harpoons', boss: 'the boss' };

class Combat {
  constructor(race, opts) {
    this.race = race;
    this.player = race.player;
    this.driver = opts.driver;
    this.build = opts.build;
    this.rng = race.rng;
    this.projectiles = [];
    this.mines = [];
    this.grenades = [];
    this.explosions = [];
    this.clouds = [];
    this.hits = []; // recent hits on the player: {ang (world), t}
    this.events = [];
    const b = this.build;
    this.wi = 0;
    this.wstate = b.rack.map(() => ({ cd: 0, reloadT: 0 }));
    // The roof gun, if one's mounted: it takes the slot after the rack (wi === roofIdx while you're up top).
    const R = ensureRoof(b);
    this.roofIdx = R.gun ? b.rack.length : -1;
    if (R.gun) this.wstate.push({ cd: 0, reloadT: 0 });
    this.up = 0; // 0 in your seat, 1 stood up in the roof hatch
    this.climbT = 0; // climbing up or dropping down: hands busy
    this.seatWi = 0; // what you had in your hands before you went up
    this.exposedHits = []; // times you were hit up top (enough in a row knocks you back down)
    this.aimAng = 0;
    this.abil = b.abilities.map((id) => (id ? { id, cd: 0 } : null));
    // The blast hatch (see HATCH in build.js): pos 0 is up, 1 is shut.
    this.hatch = { want: false, closing: false, pos: 0, downT: 0, shutAge: 9, jammed: ensureHatch(b).hp <= 0 };
    this.swerveCd = 0;
    this.invulnT = 0;
    this.fitT = 0;
    this.footUsed = false;
    this.lastFire = 9;
    // Suppressed guns keep you off the rivals' radar: they take longer to lock on.
    this.quiet = b.rack.some((w) => weaponStats(w).quiet);
    this.weather = opts.weather || {};
    this.lockTime = LOCK_TIME * (has(b, 'keys') ? 0.75 : 1) * (this.quiet ? 1.4 : 1) * (b.chip === 'showboat' ? 0.75 : 1) * (this.weather.lock || 1) * (has(b, 'deadrosary') ? 0.85 : 1);
    this.buffs = null; // contraband taken at the briefing (js/blackmarket.js), set when the race starts
    this.stats = { dealt: 0, parries: 0, shotDown: 0, taken: 0, wrecked: 0, scrapBonus: 0 };

    // The player's car runs every hit through the build (armour, parts, trinkets).
    const p = this.player;
    p.damageFilter = (amount, info) => this.filterDamage(amount, info);
    p.ramMul = p.stats.ram * (has(b, 'horseshoe') ? 3 : 1) * (b.chip === 'hothead' ? 1.5 : 1);
    this.ramBase = p.ramMul; // rams before any bayonet in your hands
    p.ramTakenMul = (has(b, 'horseshoe') ? 1.5 : 1) * (b.chip === 'veteran' ? 1.25 : 1) * (has(b, 'spikes') ? 1.25 : 1);
    p.oilMul = b.chip === 'daredevil' ? 2 : 1;

    // Arm the field: two rocket gunners, a mine layer and a gunner; elites bring an extra gun of each kind.
    // The boss always carries their own weapon. A snitch tip-off leaves everyone else unarmed.
    const loadout = opts.elite ? ['rocket', 'rocket', 'mine', 'gun', 'gun', 'rocket'] : ['rocket', 'rocket', 'mine', 'gun'];
    const rivals = shuffle(this.rng, race.cars.filter((c) => c !== this.player && !c.isBoss));
    rivals.forEach((c, i) => { if (!opts.disarm && loadout[i]) c.weapon = loadout[i]; });
    const bossCar = race.cars.find((c) => c.isBoss);
    if (bossCar && opts.boss) bossCar.weapon = opts.boss.weapon;
    for (const c of race.cars) if (c.weapon && c !== this.player) c.wpn = { cd: randRange(this.rng, 3, 7), lock: 0 };
    // Tyres: four per car. From Act II on, more and more rivals run armoured tyres (steel guards over the rims);
    // bosses past the first act always do.
    const armour = [0, 0.25, 0.6, 0.9][opts.act || 0] || 0;
    // Rival guns hit softer early on: a wreck puts you out of the race, so Act I has to be survivable with a pistol.
    this.rivalMul = [0.6, 0.8, 0.95, 1.05][opts.act || 0] || 1;
    this.player.ramTakenMul *= this.rivalMul; // rams too
    // Tyre hunters: some rival gunners (none in Act I, more each act after) will go for your tyres, but only once the
    // race has settled, from close beside or behind you, one at a time, and never straight away. See rivalGuns.
    const hunters = [0, 0.3, 0.5, 0.7][opts.act || 0] || 0;
    this.tyreHuntCd = TYRE_HUNT.start;
    for (const c of race.cars) {
      if (c !== this.player && !c.isBoss && c.tyreHunter == null) c.tyreHunter = this.rng() < hunters;
      if (c !== this.player && c.armorTyres == null) c.armorTyres = (c.isBoss && opts.act > 0) || this.rng() < armour;
      this.initTyres(c);
    }
  }

  // ---------- Tyres ----------
  // Four tyres per car, indexed front-right, front-left, rear-right, rear-left (the car model's wheel order). A shot
  // that lands near a corner hits that wheel's tyre. How much a gun hurts tyres is its 'tyre' rating (starter guns are
  // poor at it; rifles and the nail gun are good); rivals only ever hit yours by accident, at a low rating. Armoured
  // tyres shrug most of it off. A flat slows the car, costs grip and pulls it towards the flat side.
  initTyres(c) {
    const runFlat = c === this.player && PARTS[this.build.parts.tyres.id].mods.runFlat;
    c.tyres = [TYRE_HP, TYRE_HP, TYRE_HP, TYRE_HP].map((h) => h * (runFlat ? 1.5 : 1));
    c.tyreMax = c.tyres[0]; c.flats = 0; c.flatPull = 0; c.flatK = runFlat ? 0.3 : 1; // run-flats: tougher, and you barely feel a flat
  }
  // Which tyre a shot travelling (ux, uy) from (x, y) hits first, or -1: the first wheel whose position the path
  // passes within TYRE_R of. Wheels sit at the car's four corners (the model's wheelbase and track).
  tyreAt(c, x, y, ux, uy) {
    const fx = Math.cos(c.heading), fy = Math.sin(c.heading);
    let best = -1, bt = 1e9;
    for (let i = 0; i < 4; i++) {
      const f = i < 2 ? 11 : -11, s = i % 2 ? 7.3 : -7.3; // left is +s
      const wx = c.x + fx * f - fy * s, wy = c.y + fy * f + fx * s, t = (wx - x) * ux + (wy - y) * uy;
      if (t < -2) continue;
      const px = x + ux * t - wx, py = y + uy * t - wy;
      if (px * px + py * py < TYRE_R * TYRE_R && t < bt) { bt = t; best = i; }
    }
    return best;
  }
  // The Spiked Hubcap trinket: a rival side by side with you has the tyre nearest your wheels shredded.
  spikeHubs(dt) {
    const p = this.player, fx = Math.cos(p.heading), fy = Math.sin(p.heading);
    for (const c of this.race.cars) {
      if (c === p || c.hp <= 0 || !c.tyres || Math.abs((c.z || 0) - (p.z || 0)) > 6) continue;
      const dx = c.x - p.x, dy = c.y - p.y, f = dx * fx + dy * fy, s = -dx * fy + dy * fx;
      if (Math.abs(f) > 18 || Math.abs(s) > CAR_RADIUS * 2 + 5) continue;
      // Their wheel on the side facing you, front or rear by which is closer to your hubs.
      const cx = Math.cos(c.heading), cy = Math.sin(c.heading), cf = -dx * cx - dy * cy, cs = dx * cy - dy * cx;
      const i = (cf > 0 ? 0 : 2) + (cs > 0 ? 1 : 0);
      if (c.tyres[i] > 0) {
        this.damageTyre(c, i, 26 * dt, p, true);
        if (this.rng() < dt * 12) this.events.push({ type: 'deflect', x: (c.x + p.x) / 2, y: (c.y + p.y) / 2 });
      }
    }
  }
  damageTyre(c, i, dmg, owner, quiet) {
    if (!c.tyres || c.tyres[i] <= 0 || dmg <= 0) return false;
    const p = this.player;
    if (c.armorTyres) {
      dmg *= 0.25;
      if (owner === p && !quiet && this.rng() < 0.3) this.events.push({ type: 'deflect', x: c.x, y: c.y });
    }
    c.tyres[i] -= dmg;
    c.tyreBy = owner;
    if (c.tyres[i] > 0) return true;
    c.flats++;
    const left = (k) => (c.tyres[k] <= 0 ? 1 : 0);
    c.flatPull = 0.18 * (left(1) + left(3) - left(0) - left(2)); // turns towards the flat side
    this.explosions.push({ x: c.x, y: c.y, r: 14, t: 0, kind: 'spark' });
    this.events.push({ type: 'tyrePop', x: c.x, y: c.y, mine: c === p, by: owner === p, side: i % 2 ? 1 : -1 });
    const where = (i < 2 ? 'front ' : 'rear ') + (i % 2 ? 'left' : 'right');
    if (c === p) this.race.message(`Your ${where} tyre is gone!`, '#ff9f1c', true);
    else if (owner === p) { this.race.message(`Popped ${shortName(c)}'s ${where} tyre!`, '#7CFC00'); this.stats.tyres = (this.stats.tyres || 0) + 1; c.tyredBy = true; }
    return true;
  }
  // Should this tyre hunter go for a wheel this time, and which? Only when the race has settled, from close beside or
  // behind you (never head-on from in front), one attempt at a time across the whole field, and only some of the time.
  tyreTarget(c, d) {
    const p = this.player;
    if (!c.tyreHunter || this.race.time < this.tyreHuntCd || d > TYRE_HUNT.range || p.tyres.every((h) => h <= 0)) return null;
    if (this.rng() > TYRE_HUNT.chance) return null;
    const fx = Math.cos(p.heading), fy = Math.sin(p.heading), dx = c.x - p.x, dy = c.y - p.y;
    const f = dx * fx + dy * fy, s = -dx * fy + dy * fx;
    if (f > 60) return null; // they're ahead of you: no angle on your wheels
    this.tyreHuntCd = this.race.time + TYRE_HUNT.gap;
    const left = s > 0, rear = f < 0;
    let i = (rear ? 2 : 0) + (left ? 1 : 0);
    if (p.tyres[i] <= 0) i = p.tyres.findIndex((h) => h > 0);
    this.race.message(`${shortName(c)} is going for your tyres!`, '#ff9f1c');
    return i;
  }

  // A bullet that lands next to a wheel goes into the tyre (and only half of it into the body).
  bulletTyre(c, pr) {
    // A round covers ~25 units a frame, so it's caught well inside the car: trace it back to where it came in.
    const qx = pr.x - c.x, qy = pr.y - c.y, v = Math.hypot(pr.vx, pr.vy) || 1, ux = pr.vx / v, uy = pr.vy / v, R = CAR_RADIUS + 2;
    const qu = qx * ux + qy * uy, back = qu + Math.sqrt(Math.max(0, qu * qu - (qx * qx + qy * qy - R * R)));
    const i = this.tyreAt(c, pr.x - ux * back, pr.y - uy * back, ux, uy);
    if (i < 0 || !c.tyres || c.tyres[i] <= 0) return false;
    const rate = pr.tyre != null ? pr.tyre : pr.owner === this.player ? 0.5 : RIVAL_TYRE;
    return this.damageTyre(c, i, pr.dmg * rate, pr.owner);
  }

  get weapon() { return this.wi === this.roofIdx ? this.build.roof.gun : this.build.rack[this.wi]; }
  get exposed() { return this.roofIdx >= 0 && this.wi === this.roofIdx; } // stood up in the roof hatch
  get shield() { const R = this.build.roof; return R && R.gun ? ROOF_SHIELDS[R.shield] || ROOF_SHIELDS.none : ROOF_SHIELDS.none; }
  get weaponDef() {
    const d = BlackMarket.apply(weaponStats(this.weapon), this.buffs);
    if (this.exposed) { d.spread *= ROOF.steady; d.bloom = (d.bloom || 0) * ROOF.steady; } // braced on the mount
    if (this.flinchT > 0) d.spread *= 2.2; // just hit: your aim's all over the place
    return d;
  }
  get busy() { return this.fitT > 0 || this.climbT > 0; }
  get guarded() { return this.hatch.pos >= HATCH.guard; }
  get hatchDown() { return this.hatch.pos > 0.05; } // anywhere off its stop: you can't shoot past it

  // Called every frame with whether Space is held.
  setHatch(want) { this.hatch.want = !!want && !this.exposed; } // no slamming the blast hatch with your head out of the roof

  // Climb up into the roof hatch to the mounted gun, or drop back into your seat.
  toggleRoof() {
    if (this.roofIdx < 0) { this.race.message('No gun on the roof: mount one in the Armory', '#ccc'); return; }
    if (this.climbT > 0 || this.fitT > 0 || this.player.finished) return;
    if (this.exposed) this.dropDown();
    else {
      this.seatWi = this.wi;
      this.wi = this.roofIdx;
      this.climbT = ROOF.climb;
      this.hatch.want = false;
      this.events.push({ type: 'roofUp' });
    }
  }
  dropDown(knocked) {
    if (!this.exposed) return;
    this.wi = Math.min(this.seatWi, this.build.rack.length - 1);
    this.climbT = ROOF.drop * (knocked ? 1.6 : 1);
    this.events.push({ type: 'roofDown', knocked: !!knocked });
    if (knocked) this.race.message('You\'re knocked back down into your seat!', '#ff6a4a', true);
  }
  updateRoof(dt) {
    this.climbT = Math.max(0, this.climbT - dt);
    this.flinchT = Math.max(0, (this.flinchT || 0) - dt);
    const want = this.exposed ? 1 : 0;
    this.up += clamp(want - this.up, -dt / ROOF.drop, dt / ROOF.climb);
    const R = this.build.roof;
    if (R && R.gun && this.shield.hp && R.shieldHp <= 0 && !this.shieldGone) { this.shieldGone = true; } // a wrecked shield covers nothing
  }

  // A round arriving while you're up top: the shield may stop it; if not, it may hit you rather than the car.
  // dir: the world angle it came from. Returns 'blocked', 'you' or null (it hits the car as usual).
  exposedHit(dmg, dir) {
    const R = this.build.roof, S = this.shield, rel = Math.abs(wrapAngle(dir - this.aimAng));
    if (S.hp && R.shieldHp > 0 && rel <= S.cover && this.rng() < S.block) {
      R.shieldHp -= dmg;
      this.events.push({ type: 'deflect', x: this.player.x, y: this.player.y });
      if (R.shieldHp <= 0) { this.race.message(`Your ${S.name.toLowerCase()} is shot to pieces!`, '#ff9f1c', true); this.events.push({ type: 'partBreak' }); }
      return 'blocked';
    }
    if (this.rng() > ROOF.exposure) return null;
    this.flinchT = 0.45;
    const t = this.race.time;
    this.exposedHits = this.exposedHits.filter((h) => t - h < ROOF.knockWindow);
    this.exposedHits.push(t);
    this.events.push({ type: 'gunnerHit' });
    if (this.exposedHits.length >= ROOF.knockHits) { this.exposedHits = []; this.dropDown(true); }
    return 'you';
  }

  updateHatch(dt) {
    const H = this.hatch, p = this.player, fast = (has(this.build, 'teddy') ? 2 : 1) * ((this.buffs && this.buffs.hatch) || 1);
    const live = this.race.state === 'racing' && !p.finished && !H.jammed;
    if (H.want && live && !H.closing && H.pos < 0.6) { // slam it
      H.closing = true; H.downT = 0; H.shutAge = 0;
      this.events.push({ type: 'hatch' });
    }
    if (H.closing) {
      H.downT += dt;
      if (!live || (!H.want && H.downT >= HATCH.minDown)) { H.closing = false; this.events.push({ type: 'hatchUp' }); }
    }
    const was = H.pos;
    H.pos = clamp(H.pos + (H.closing ? dt / HATCH.slam : -dt / HATCH.lift) * fast, 0, 1);
    if (H.closing && H.pos >= HATCH.guard) H.shutAge += dt;
    if (was < 1 && H.pos >= 1) this.events.push({ type: 'hatchShut' });
  }

  // Dents in the plate. Dented through, it jams open until it's fixed in the garage.
  wearHatch(amount) {
    const hh = ensureHatch(this.build), H = this.hatch;
    if (H.jammed) return;
    hh.hp -= amount * (has(this.build, 'teddy') ? 0.75 : 1);
    this.events.push({ type: 'dent', hp: hh.hp });
    if (hh.hp <= 0) {
      hh.hp = 0;
      H.jammed = true;
      H.closing = false;
      this.race.message('HATCH JAMMED: fix it in the garage', '#ff7a1f', true);
      this.events.push({ type: 'jam' });
    }
  }

  // ---------- Player actions ----------

  select(i) {
    if (i < 0 || i >= this.build.rack.length || i === this.wi || this.busy) return;
    if (this.exposed) { this.seatWi = i; this.dropDown(); return; } // a hand gun: back down into the seat for it
    this.wi = i;
    this.events.push({ type: 'switch' });
  }

  cycle(dir) {
    if (this.exposed) return;
    const n = this.build.rack.length;
    this.select((this.wi + dir + n) % n);
  }

  // Four-leaf clover: a wreck refills the magazine of the gun in your hands.
  cloverRefill() {
    if (!has(this.build, 'clover')) return;
    const w = this.weapon, def = this.weaponDef, take = Math.min(def.mag - w.mag, w.reserve);
    if (take > 0) { w.mag += take; w.reserve -= take; this.wstate[this.wi].reloadT = 0; }
  }

  reload() {
    const w = this.weapon, def = this.weaponDef, st = this.wstate[this.wi];
    if (st.reloadT > 0 || w.mag >= def.mag || w.reserve <= 0 || this.busy) return;
    st.reloadT = def.reload;
    this.events.push({ type: 'reload' });
  }

  activateAbility(slot) {
    const a = this.abil[slot], p = this.player;
    if (!a || a.cd > 0 || p.finished || this.race.state !== 'racing') return false;
    a.cd = ABILITIES[a.id].cooldown;
    if (a.id === 'nitro_burst') {
      p.boostT = Math.max(p.boostT, 2.0);
      this.events.push({ type: 'boost' });
    } else if (a.id === 'smoke') {
      const c = Math.cos(p.heading), s = Math.sin(p.heading);
      this.clouds.push({ x: p.x - c * 30, y: p.y - s * 30, r: 100, t: 0, life: 6 });
      this.events.push({ type: 'smoke' });
    } else if (a.id === 'emp') {
      this.emp(p.x, p.y, 230);
    }
    return true;
  }

  swerve(side) {
    if (this.swerveCd > 0 || this.player.finished) return false;
    this.driver.swerve(side, 0.9);
    const medal = has(this.build, 'medal');
    this.swerveCd = (medal ? 1.1 : 2.2) * (this.build.chip === 'ghost' ? 0.5 : 1);
    if (medal) this.invulnT = 0.4;
    this.events.push({ type: 'swerve' });
    return true;
  }

  // Fit the spare part in place of a broken one: hands busy for a few seconds.
  fitSpare() {
    const b = this.build;
    if (!b.spare || this.busy || this.player.finished) return false;
    const slot = PARTS[b.spare.id].slot;
    if (!partBroken(b, slot)) { this.race.message(`Your ${SLOT_NAMES[slot].toLowerCase()} isn't broken`, '#ccc'); return false; }
    this.fitT = FIT_TIME;
    this.events.push({ type: 'fit' });
    return true;
  }

  throwGrenade(aim, dist) {
    const b = this.build, p = this.player;
    if (this.hatchDown) return false; // the window's shut
    if (b.grenades <= 0 || p.finished || this.busy) { this.events.push({ type: 'empty' }); return false; }
    b.grenades--;
    const d = clamp(dist, 80, 380);
    const fuse = 0.8;
    this.grenades.push({
      x: p.x, y: p.y,
      vx: p.vx + (Math.cos(aim) * d) / fuse, vy: p.vy + (Math.sin(aim) * d) / fuse,
      t: 0, fuse, z: 6, vz0: 0.5 * GRENADE_G * fuse,
    });
    this.events.push({ type: 'throw' });
    return true;
  }

  // Rebuild the player's stats after a part breaks or is replaced.
  refreshStats() {
    const p = this.player, s = buildStats(this.build);
    s.aLat = p.stats.aLat;
    s.top *= this.pace || 1; // the gunner races run at a slower global pace
    s.accel *= this.pace || 1;
    if (this.race.track.biomeKey === 'tundra') s.grip *= s.iceGrip;
    p.stats = s;
    p.nitro = Math.min(p.nitro, s.nitroCap);
    p.ramMul = s.ram * (has(this.build, 'horseshoe') ? 3 : 1) * (this.build.chip === 'hothead' ? 1.5 : 1);
    this.ramBase = p.ramMul;
  }

  breakPart(slot) {
    const b = this.build;
    b.parts[slot].dur = 0;
    this.refreshStats();
    this.race.message(`${SLOT_NAMES[slot].toUpperCase()} BROKEN`, '#ff6b3c', true);
    this.race.message(BROKEN_TEXT[slot].split(': ')[1], '#ff9f7a');
    this.events.push({ type: 'partBreak', slot });
    if (b.spare && PARTS[b.spare.id].slot === slot) this.race.message('Press B to fit your spare', '#ffd23f');
  }

  // Every hit on the player passes through here: invulnerability, armour, part wear, trinkets.
  filterDamage(amount, info) {
    const b = this.build, p = this.player, s = p.stats;
    if (this.invulnT > 0) return 0;
    if (this.buffs && this.buffs.taken) amount *= this.buffs.taken; // painkillers
    if (info.kind === 'bullet' && this.weaponDef.hubcap) amount *= 0.8; // the hubcap on the gun in your hands
    if (info.kind === 'wall' && b.chip === 'cautious') amount *= 0.3;
    if (info.kind === 'wall' && has(b, 'troll')) amount *= 0.6;
    const arm = b.parts.armour;
    if (arm.dur > 0) {
      const a = info.kind === 'blast' && s.blastAbsorb ? s.blastAbsorb : info.kind === 'bullet' && s.bulletAbsorb ? s.bulletAbsorb : s.absorb;
      const absorbed = amount * a;
      arm.dur -= absorbed * (s.armourWear || 1);
      amount -= absorbed;
      if (arm.dur <= 0) this.breakPart('armour');
    }
    const rel = info.ang != null ? Math.abs(wrapAngle(info.ang - p.heading)) : Math.PI / 2;
    const slot = rel < 0.8 ? 'engine' : rel > 2.3 && info.kind !== 'wall' ? 'nitro' : 'tyres';
    const part = b.parts[slot];
    if (part.dur > 0) {
      part.dur -= amount * 1.4 * wearMul(b, slot) * wearOf(this.weather, slot); // parts wear faster than the hull, so breakdowns come before wrecks
      if (part.dur <= 0) this.breakPart(slot);
    }
    if (has(b, 'rabbit_foot') && !this.footUsed && p.hp > 1 && p.hp - amount <= 0) {
      this.footUsed = true;
      amount = p.hp - 1;
      this.race.message("Rabbit's foot: still alive", '#7CFC00', true);
    }
    if (has(b, 'shoes') && !this.shoesUsed && p.hp - amount > 0 && p.hp - amount < s.maxHp * 0.3) {
      this.shoesUsed = true;
      this.shoesHeal = 25; // patched next frame
    }
    this.stats.taken += amount;
    return amount;
  }

  // ctl: { aim (world angle), firing (held), pressed (edge) }
  updatePlayerWeapons(dt, ctl) {
    const p = this.player, b = this.build;
    const speed = (b.chip === 'gun_nut' ? 1.4 : 1) * (has(b, 'cassette') ? 1.2 : 1);
    for (const st of this.wstate) st.cd -= dt;
    const w = this.weapon, def = this.weaponDef, st = this.wstate[this.wi];
    // Bloom: guns that climb (the drum gun, the machine guns) spread wider the longer the trigger's held, and settle
    // once you let go.
    if (this.lastFire > 0.18) st.bloom = Math.max(0, (st.bloom || 0) - dt * 3);
    if (st.reloadT > 0) {
      st.reloadT -= dt * speed;
      if (st.reloadT <= 0) {
        const take = Math.min(def.mag - w.mag, w.reserve);
        w.mag += take;
        w.reserve -= take;
        this.events.push({ type: 'reloaded' });
      }
    }
    this.lastFire += dt;
    p.ramMul = this.ramBase * (def.bayonet ? 1.35 : 1); // a bayonet in your hands bites on rams
    if (ctl.aim != null) this.aimAng = ctl.aim;
    if (def.dazzle && ctl.aim != null) for (const c of this.race.cars) { // the flashlight: whoever's in the beam can't hold a lock
      if (c === p || !c.wpn || !(c.wpn.lock > 0)) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y), off = Math.abs(wrapAngle(Math.atan2(c.y - p.y, c.x - p.x) - ctl.aim));
      if (d < 650 && off < 0.12) c.wpn.lock = Math.max(0, c.wpn.lock - dt * 2.5);
    }
    if (this.driver) this.driver.shaky = b.chip === 'gun_nut' && this.lastFire < 0.4;
    if (p.finished || this.race.state !== 'racing' || this.busy || this.hatchDown) return; // you can reload behind the hatch, not shoot
    // Remote detonator: pulling the trigger again blows your rocket mid-air.
    if (def.remote && ctl.pressed) {
      const live = this.projectiles.filter((o) => o.owner === p && o.type === 'rocket' && !o.dead && o.t > 0.15);
      if (live.length) {
        for (const o of live) { o.dead = true; this.explode(o.x, o.y, o.radius * 1.15, o.dmg, p, o); }
        this.race.message('Detonated!', '#ffcf3a');
        return;
      }
    }
    const trigger = def.auto ? ctl.firing : ctl.pressed;
    if (!trigger || st.cd > 0 || st.reloadT > 0) return;
    if (w.mag <= 0) {
      if (w.reserve > 0) this.reload();
      else if (ctl.pressed) { this.events.push({ type: 'empty' }); this.race.message(`Out of ${def.name} ammo`, '#ccc'); }
      return;
    }
    st.cd = def.rate;
    w.mag--;
    this.lastFire = 0;
    if (def.kind === 'bullet') {
      const spread = def.spread * (1 + (st.bloom || 0));
      if (def.bloom) st.bloom = Math.min(1.5, (st.bloom || 0) + def.bloom);
      for (let k = 0; k < def.pellets; k++) {
        const a = ctl.aim + randRange(this.rng, -spread, spread);
        this.spawn('bullet', p, a, def.speed * randRange(this.rng, 0.92, 1.05), 1, { dmg: def.dmg, life: def.life, knock: def.knock || 0, burn: def.burn || 0, tracer: !!def.tracer, puncture: def.puncture || 0, shock: def.shock || 0, tyre: def.tyre });
      }
      this.events.push({ type: def.pellets > 1 ? 'shotgun' : def.puncture ? 'nail' : 'shoot', w: this.weapon.id });
      if (def.ping && w.mag === 0) this.events.push({ type: 'ping' }); // the empty clip flies out with a ping
    } else if (def.kind === 'flame') {
      // A gout of burning fuel: short-lived blobs that spread and slow, lighting whatever they touch.
      for (let k = 0; k < def.pellets; k++) {
        const a = ctl.aim + randRange(this.rng, -def.spread, def.spread);
        this.spawn('flame', p, a, def.speed * randRange(this.rng, 0.8, 1.1), 1, { dmg: def.dmg, life: def.life * randRange(this.rng, 0.85, 1.1), burn: def.burn, burnTime: def.burnTime || 3 });
      }
      this.events.push({ type: 'flame' });
    } else if (def.kind === 'harpoon') {
      this.spawn('harpoon', p, ctl.aim + randRange(this.rng, -(def.spread || 0), def.spread || 0), def.speed, 1, { dmg: def.dmg, life: def.life, hook: def.hook, bleed: def.bleed || 0, shock: def.shock || 0 });
      this.events.push({ type: 'harpoon' });
    } else if (def.kind === 'rocket') {
      // Homing fins: lock onto the rival nearest the aim direction.
      let target = null;
      if (def.homing) {
        let best = 0.55;
        for (const c of this.race.cars) {
          if (c === p || c.finished) continue;
          const d = Math.hypot(c.x - p.x, c.y - p.y);
          const off = Math.abs(wrapAngle(Math.atan2(c.y - p.y, c.x - p.x) - ctl.aim));
          if (d < 950 && off < best) { best = off; target = c; }
        }
      }
      const opts = { dmg: def.dmg, radius: def.radius, life: def.life, target, turn: target ? 1.6 * (has(this.build, 'compass') ? 1.4 : 1) : 0 };
      if (def.twin) {
        // Twin tube: a second rocket alongside, if there's a round for it.
        this.spawn('rocket', p, ctl.aim - 0.05, def.speed, 1, Object.assign({}, opts));
        if (w.mag > 0) { w.mag--; this.spawn('rocket', p, ctl.aim + 0.05, def.speed, 1, Object.assign({}, opts)); }
      } else this.spawn('rocket', p, ctl.aim, def.speed, 1, opts);
      this.events.push({ type: 'rocket' });
    } else if (def.kind === 'flare') {
      this.spawn('flare', p, ctl.aim, def.speed, 1, { dmg: def.dmg, life: def.life, blind: def.blind, cluster: !!def.cluster });
      this.events.push({ type: 'flare' });
    }
    if (w.mag === 0 && w.reserve > 0) this.reload();
  }

  emp(x, y, r) {
    const p = this.player;
    this.explosions.push({ x, y, r, t: 0, kind: 'emp' });
    this.events.push({ type: 'emp' });
    for (const o of this.projectiles) if (o.owner !== p && o.type === 'rocket' && Math.hypot(o.x - x, o.y - y) < r) { o.dead = true; this.stats.shotDown++; }
    for (const m of this.mines) if (Math.hypot(m.x - x, m.y - y) < r) { m.dead = true; this.stats.shotDown++; }
    for (const c of this.race.cars) {
      if (c === p || Math.hypot(c.x - x, c.y - y) > r) continue;
      c.empT = 4;
      if (c.wpn) { c.wpn.lock = 0; c.wpn.cd = Math.max(c.wpn.cd, 4); }
    }
  }

  spawn(type, owner, ang, speed, inherit, extra) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const pr = Object.assign({
      type, owner, x: owner.x + c * 16, y: owner.y + s * 16,
      vx: c * speed + owner.vx * inherit, vy: s * speed + owner.vy * inherit,
      t: 0, life: 1, hp: 1, target: null, turn: 0,
    }, extra);
    this.projectiles.push(pr);
    return pr;
  }

  // ---------- Simulation ----------

  update(dt, ctl) {
    const race = this.race, p = this.player;
    this.updatePlayerWeapons(dt, ctl);
    // Barrels the race says have blown (hit by a car, a bullet or another blast).
    for (const bl of race.blasts.splice(0)) this.explode(bl.x, bl.y, bl.r, bl.dmg, bl.owner, 'barrel');
    this.updateHatch(dt);
    this.updateRoof(dt);
    if (has(this.build, 'spikes') && race.state === 'racing') this.spikeHubs(dt);
    this.updateBoss(dt); // js/bosses.js
    this.updateTilt(dt); // js/emotes.js
    for (const a of this.abil) if (a) a.cd -= dt * (this.weather.cd || 1) * ((this.buffs && this.buffs.cdRate) || 1);
    this.swerveCd -= dt;
    this.invulnT -= dt;
    if (this.shoesHeal) {
      p.hp = Math.min(p.stats.maxHp, p.hp + this.shoesHeal);
      this.shoesHeal = 0;
      race.message('Baby shoes: hull patched', '#7CFC00', true);
    }
    if (this.fitT > 0) {
      this.fitT -= dt;
      if (this.fitT <= 0) {
        const b = this.build;
        installPart(b, b.spare.id);
        b.spare = null;
        this.refreshStats();
        this.race.message('Spare fitted!', '#7CFC00', true);
        this.events.push({ type: 'fitted' });
      }
    }
    for (const c of race.cars) {
      if (c.gFlinchT > 0) c.gFlinchT -= dt;
      if (c.empT > 0) c.empT -= dt;
      if (c.blindT > 0) c.blindT -= dt;
      if (c.markT > 0) c.markT -= dt;
      if (c.hookT > 0) c.hookT -= dt;
      if (c.slowT > 0) { // punctured tyres / a harpoon line: bleed off speed
        c.slowT -= dt;
        const k = Math.max(0, 1 - c.slowDrag * dt);
        c.vx *= k; c.vy *= k;
        if (c.slowT <= 0) c.slowDrag = 0;
      }
      if (c.bleedT > 0) {
        c.bleedT -= dt;
        const before = c.hp;
        race.damage(c, c.bleedDps * dt, { kind: 'bullet' });
        if (c.bleedBy === p && c !== p) {
          this.stats.dealt += before - c.hp;
          if (before > 0 && c.hp <= 0) this.creditWreck(c, 'bullet');
        }
      }
      if (c.fireproof) c.burnT = 0; // a vendetta car that burned last time came back in fire-retardant paint
      if (c.burnT > 0) {
        c.burnT -= dt;
        const before = c.hp;
        race.damage(c, c.burnDps * dt, { kind: 'fire' });
        if (c.burnBy === p && c !== p) {
          this.stats.dealt += before - c.hp;
          if (before > 0 && c.hp <= 0) { this.creditWreck(c, 'fire'); this.race.message(`${shortName(c)} burned out!`, '#ffd23f'); }
        }
      }
    }
    // Smoke clouds: rivals inside lose their lock and choke; rockets lose their target.
    for (const cl of this.clouds) {
      cl.t += dt;
      const k = Math.min(1, cl.t * 3) * (1 - Math.max(0, (cl.t - cl.life + 1)));
      cl.cur = cl.r * k;
      for (const c of race.cars) {
        if (c === p || Math.hypot(c.x - cl.x, c.y - cl.y) > cl.cur) continue;
        if (c.wpn) c.wpn.lock = 0;
        c.vx *= 1 - dt * 0.9;
        c.vy *= 1 - dt * 0.9;
      }
      for (const o of this.projectiles) if (o.target === p && Math.hypot(o.x - cl.x, o.y - cl.y) < cl.cur) o.target = null;
    }
    this.clouds = this.clouds.filter((cl) => cl.t < cl.life);
    for (const h of this.hits) h.t += dt;
    this.hits = this.hits.filter((h) => h.t < 1.2);

    if (race.state === 'racing') this.updateRivals(dt);
    this.updateProjectiles(dt);
    this.updateMines(dt);
    this.updateGrenades(dt);
    for (const e of this.explosions) e.t += dt;
    this.explosions = this.explosions.filter((e) => e.t < 0.5);
  }

  updateRivals(dt) {
    const p = this.player;
    for (const c of this.race.cars) {
      if (!c.weapon || c === p || c.gunnerDead) continue; // a dead gunner fires no more
      const w = c.wpn;
      const disabled = c.hp <= 0 || c.finished || p.finished || c.empT > 0 || c.blindT > 0;
      w.cd -= dt;
      const dx = p.x - c.x, dy = p.y - c.y;
      const d = Math.hypot(dx, dy);
      if (c.weapon === 'rocket') {
        if (w.lock > 0) {
          if (disabled || d > 950 || c.spinT > 0) {
            w.lock = 0;
            w.cd = 2.5;
            continue;
          }
          w.lock += dt;
          if (w.lock >= this.lockTime) {
            w.lock = 0;
            w.cd = randRange(this.rng, 5, 8);
            const lead = d / ROCKET_SPEED;
            const tx = p.x + p.vx * lead * 0.6, ty = p.y + p.vy * lead * 0.6;
            const a = Math.atan2(ty - c.y, tx - c.x);
            this.spawn('rocket', c, a, ROCKET_SPEED, 0.3, { dmg: 18, radius: 50, life: 3, target: p, turn: 1.5 });
            this.events.push({ type: 'enemyRocket', x: c.x, y: c.y });
          }
        } else if (!disabled && w.cd <= 0 && d > 150 && d < 650) {
          w.lock = 1e-4;
          this.events.push({ type: 'lock', car: c });
        }
      } else if (c.weapon === 'gun') {
        // Gunner: winds up (shown like a lock), then rakes you with a burst.
        if (w.burst > 0) {
          w.bt -= dt;
          if (disabled) { w.burst = 0; continue; }
          if (w.bt <= 0) {
            w.burst--;
            w.bt = 0.09;
            if (w.wheel != null) { // a tyre burst: at the wheel nearest them, tighter, rounds that chew rubber
              const f = w.wheel < 2 ? 11 : -11, sd = w.wheel % 2 ? 7.3 : -7.3, hx = Math.cos(p.heading), hy = Math.sin(p.heading), lead = d / 1500;
              const tx = p.x + hx * f - hy * sd + p.vx * lead, ty = p.y + hy * f + hx * sd + p.vy * lead; // the wheel itself
              const a = Math.atan2(ty - c.y, tx - c.x) + randRange(this.rng, -TYRE_HUNT.spread, TYRE_HUNT.spread);
              this.spawn('bullet', c, a, 1500, 1, { dmg: 2.5, life: 0.45, tyre: TYRE_HUNT.rate });
              if (w.burst <= 0) w.wheel = null;
              this.events.push({ type: 'enemyShot' });
              continue;
            }
            const a = Math.atan2(dy + p.vy * d / 1500, dx + p.vx * d / 1500) + randRange(this.rng, -0.07, 0.07);
            this.spawn('bullet', c, a, 1500, 1, { dmg: 2.5, life: 0.45 });
            this.events.push({ type: 'enemyShot' });
          }
        } else if (w.lock > 0) {
          if (disabled || d > 520 || c.spinT > 0) { w.lock = 0; w.wheel = null; w.cd = 2; continue; }
          w.lock += dt * (w.wheel != null ? 1.4 : 2); // half a rocket lock; a tyre shot takes longer to line up
          if (w.lock >= this.lockTime) { w.lock = 0; w.burst = w.wheel != null ? TYRE_HUNT.burst : 6; w.bt = 0; w.cd = randRange(this.rng, 4, 6); }
        } else if (!disabled && w.cd <= 0 && d > 60 && d < 450) {
          w.lock = 1e-4;
          w.wheel = this.tyreTarget(c, d);
          this.events.push({ type: 'lock', car: c });
        }
      } else if (c.weapon === 'mine' && !disabled && w.cd <= 0) {
        const fwd = dx * Math.cos(c.heading) + dy * Math.sin(c.heading);
        if (fwd < -40 && d < 600) {
          w.cd = randRange(this.rng, 2.2, 3.4);
          this.mines.push({
            x: c.x - Math.cos(c.heading) * 22, y: c.y - Math.sin(c.heading) * 22,
            owner: c, t: 0, arm: 0.6, hp: 2,
          });
          this.events.push({ type: 'mine' });
        }
      }
    }
  }

  updateProjectiles(dt) {
    const cars = this.race.cars, p = this.player;
    for (const pr of this.projectiles) {
      pr.t += dt;
      if (pr.target && pr.turn) {
        // Homing: rotate velocity toward the target.
        const want = Math.atan2(pr.target.y - pr.y, pr.target.x - pr.x);
        const cur = Math.atan2(pr.vy, pr.vx);
        const sp = Math.hypot(pr.vx, pr.vy);
        const na = cur + clamp(wrapAngle(want - cur), -pr.turn * dt, pr.turn * dt);
        pr.vx = Math.cos(na) * sp;
        pr.vy = Math.sin(na) * sp;
      }
      if (pr.type === 'flame') { const k = Math.max(0, 1 - 2.2 * dt); pr.vx *= k; pr.vy *= k; } // burning fuel loses speed
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.t >= pr.life) {
        pr.dead = true;
        if (pr.type === 'rocket') this.explode(pr.x, pr.y, pr.radius * 0.7, pr.dmg * 0.5, pr.owner);
        continue;
      }

      // Bullets can shoot down rockets and mines.
      if (pr.type === 'bullet') {
        for (const o of this.projectiles) {
          if (o.type !== 'rocket' || o.dead || o.owner === pr.owner) continue;
          if ((o.x - pr.x) ** 2 + (o.y - pr.y) ** 2 < 15 * 15) {
            o.dead = true;
            pr.dead = true;
            this.explode(o.x, o.y, 30, 6, pr.owner);
            if (pr.owner === p) { this.stats.shotDown++; this.race.message('Rocket shot down!', '#5ad8ff'); }
            break;
          }
        }
        if (pr.dead) continue;
        for (const m of this.mines) {
          if (m.dead) continue;
          if ((m.x - pr.x) ** 2 + (m.y - pr.y) ** 2 < 16 * 16) {
            pr.dead = true;
            if (--m.hp <= 0) {
              m.dead = true;
              this.explode(m.x, m.y, 60, 16, pr.owner, 'mine');
              if (pr.owner === p) this.stats.shotDown++;
            }
            break;
          }
        }
        if (pr.dead) continue;
      }

      // Obstacles stop shots: bullets spark off, rockets go off, and barrels take the hit (enough and they blow).
      for (const o of this.race.track.obstacles || []) {
        if (!o.alive || (o.x - pr.x) ** 2 + (o.y - pr.y) ** 2 > o.r * o.r) continue;
        pr.dead = true;
        if (pr.type === 'rocket') this.explode(pr.x, pr.y, pr.radius, pr.dmg, pr.owner, pr);
        else {
          this.explosions.push({ x: pr.x, y: pr.y, r: 8, t: 0, kind: 'spark' });
          if (o.kind === 'barrels' && (o.hp -= pr.dmg * (pr.type === 'flame' ? 3 : 1)) <= 0) this.race.blowBarrel(o, pr.owner);
        }
        break;
      }
      if (pr.dead) continue;

      const armed = pr.t > 0.12;
      for (const c of cars) {
        if (c === pr.owner && !armed) continue;
        if (c === pr.owner && pr.type !== 'rocket') continue;
        const r = CAR_RADIUS + (pr.type === 'rocket' ? 6 : 2);
        if ((c.x - pr.x) ** 2 + (c.y - pr.y) ** 2 > r * r) continue;
        if (c === p && this.guarded) {
          this.blockWithHatch(pr);
          break;
        }
        let you = null;
        if (c === p && this.exposed && pr.type !== 'rocket') { // stood up in the roof: the shield, or you
          you = this.exposedHit(pr.dmg, Math.atan2(-pr.vy, -pr.vx));
          if (you === 'blocked') { pr.dead = true; break; }
        }
        pr.dead = true;
        if (pr.type === 'rocket') this.explode(pr.x, pr.y, pr.radius, pr.dmg, pr.owner, pr);
        else {
          const role = this.crewHit(c, pr); // through the glass and into the driver or gunner?
          if (role) this.woundCrew(c, role, pr.dmg * (pr.type === 'harpoon' ? 2.5 : 1), pr.owner);
          const tyre = !role && pr.type === 'bullet' && this.bulletTyre(c, pr); // or into a tyre
          this.hitCar(c, pr.dmg * (tyre ? 0.5 : 1) * (you === 'you' ? ROOF.youDmg : 1), pr.owner, Math.atan2(-pr.vy, -pr.vx), 0.985, you === 'you' ? 'exposed' : pr.type === 'flame' ? 'fire' : 'bullet');
          if (pr.puncture && c !== pr.owner) { // nails in the tyres: each one drags a little more
            c.slowDrag = Math.min(2.2, (c.slowT > 0 ? c.slowDrag : 0) + pr.puncture * 0.25);
            c.slowT = 1.5;
          }
          if (pr.type === 'flame') { c.burnT = Math.max(c.burnT || 0, pr.burnTime); c.burnDps = Math.max(c.burnT > 0 ? c.burnDps || 0 : 0, pr.burn); c.burnBy = pr.owner; }
          if (pr.type === 'harpoon' && c !== pr.owner) { // hooked: the line goes taut and drags them back towards you
            c.hookT = pr.hook; c.hookBy = pr.owner; c.slowT = Math.max(c.slowT || 0, pr.hook); c.slowDrag = 2.6;
            const o = pr.owner, a = Math.atan2(o.y - c.y, o.x - c.x);
            c.vx += Math.cos(a) * 140; c.vy += Math.sin(a) * 140;
            if (pr.bleed) { c.bleedT = 4; c.bleedDps = pr.bleed; c.bleedBy = pr.owner; }
            if (pr.owner === p) this.race.message(`${shortName(c)} is hooked!`, '#5ad8ff');
          }
          if (pr.knock) {
            const a = Math.atan2(pr.vy, pr.vx);
            c.vx += Math.cos(a) * pr.knock;
            c.vy += Math.sin(a) * pr.knock;
          }
          if (pr.burn && pr.type !== 'flame') { c.burnT = 3; c.burnDps = pr.burn; c.burnBy = pr.owner; }
          else if (pr.owner === p && c !== p && has(this.build, 'lighter') && Math.random() < 0.12) { c.burnT = 3; c.burnDps = 4; c.burnBy = p; }
          if (pr.tracer && c !== p) c.markT = 3;
          if (pr.shock && c !== pr.owner && Math.random() < pr.shock) { // the shock coil shorts them out
            c.empT = Math.max(c.empT || 0, 1.5);
            if (c.wpn) c.wpn.lock = 0;
            this.explosions.push({ x: c.x, y: c.y, r: 40, t: 0, kind: 'emp' });
          }
          if (pr.type === 'flare') {
            c.blindT = pr.blind;
            if (c.wpn) c.wpn.lock = 0;
            if (pr.owner === p) this.race.message(`${shortName(c)} is blinded!`, '#ff8a3c');
            if (pr.cluster) {
              // Cluster flare: the burst blinds everyone nearby.
              this.explosions.push({ x: pr.x, y: pr.y, r: 120, t: 0, kind: 'flare' });
              for (const o of this.race.cars) {
                if (o === pr.owner || o === c || Math.hypot(o.x - pr.x, o.y - pr.y) > 120) continue;
                o.blindT = pr.blind * 0.8;
                if (o.wpn) o.wpn.lock = 0;
              }
            }
          }
        }
        break;
      }
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
  }

  blockWithHatch(pr) {
    const p = this.player;
    if (pr.type === 'rocket' && this.hatch.shutAge < PARRY_WINDOW && pr.owner !== p) {
      // Slammed just as it arrived: the plate bats it back at whoever fired it.
      const shooter = pr.owner;
      pr.owner = p;
      pr.target = shooter;
      pr.turn = 3.5;
      pr.t = 0;
      pr.life = 3;
      pr.vx = -pr.vx * 1.2;
      pr.vy = -pr.vy * 1.2;
      this.stats.parries++;
      this.race.message('PARRY!', '#5ad8ff', true);
      if (has(this.build, 'dice')) {
        // Fuzzy dice: a parry tops up the magazine in your hands.
        const w = this.weapon, def = this.weaponDef, take = Math.min(def.mag - w.mag, w.reserve);
        w.mag += take;
        w.reserve -= take;
        this.wstate[this.wi].reloadT = 0;
      }
      this.wearHatch(4);
      this.events.push({ type: 'parry' });
    } else if (pr.type === 'rocket') {
      pr.dead = true;
      this.explode(pr.x, pr.y, pr.radius, pr.dmg, pr.owner, pr); // it goes off on the plate (see explode)
    } else {
      pr.dead = true;
      this.wearHatch(pr.dmg * (pr.type === 'flame' ? 0.4 : pr.type === 'harpoon' ? 2 : 1));
      this.events.push({ type: 'block', kind: pr.type });
    }
  }

  updateMines(dt) {
    for (const m of this.mines) {
      m.t += dt;
      if (m.t < m.arm || m.dead) continue;
      for (const c of this.race.cars) {
        if (c === m.owner && m.t < 3) continue;
        if ((c.x - m.x) ** 2 + (c.y - m.y) ** 2 < 20 * 20) {
          m.dead = true;
          this.explode(m.x, m.y, 60, 16, m.owner, 'mine');
          break;
        }
      }
      if (m.t > 40) m.dead = true;
    }
    this.mines = this.mines.filter((m) => !m.dead);
  }

  updateGrenades(dt) {
    for (const g of this.grenades) {
      g.t += dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z = 6 + g.vz0 * g.t - 0.5 * GRENADE_G * g.t * g.t;
      if (g.t >= g.fuse) {
        g.dead = true;
        this.explode(g.x, g.y, 90, 24, this.player);
      }
    }
    this.grenades = this.grenades.filter((g) => !g.dead);
  }

  explode(x, y, radius, dmg, owner, src) {
    const p = this.player;
    this.explosions.push({ x, y, r: radius, t: 0 });
    // Barrels caught in a blast go up too (a chain reaction, one blast per frame).
    for (const o of this.race.track.obstacles || []) if (o.alive && o.kind === 'barrels' && Math.hypot(o.x - x, o.y - y) < radius + o.r) this.race.blowBarrel(o, owner);
    this.events.push({ type: 'explode', x, y, big: radius > 55 });
    if (has(this.build, 'rosary') && Math.hypot(p.x - x, p.y - y) < 150) {
      for (const a of this.abil) if (a) a.cd = Math.max(0, a.cd - 2);
    }
    for (const c of this.race.cars) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d > radius + CAR_RADIUS) continue;
      if (c === p && owner === p) continue; // your own explosives don't hurt you
      let f = 1 - clamp(d / (radius + CAR_RADIUS), 0, 1) * 0.6;
      const ang = Math.atan2(y - c.y, x - c.x);
      if (c === p && this.guarded && src !== 'mine') { // the hatch takes most of it; a mine goes off underneath
        this.wearHatch(dmg * f * (1 - HATCH.blastPass));
        this.events.push({ type: 'block', kind: 'blast' });
        f *= HATCH.blastPass;
      }
      if (c === p && this.exposed && !(this.shield.cover >= Math.PI && this.build.roof.shieldHp > 0)) { f *= ROOF.blastMul; this.flinchT = 0.6; } // a blast with your head out
      this.hitCar(c, dmg * f, owner, ang, 0.75, 'blast');
      for (let i = 0; i < 4; i++) if (this.rng() < f) this.damageTyre(c, i, dmg * f * 0.5, owner); // the blast shreds rubber
      // Knockback + spin.
      c.vx -= Math.cos(ang) * 220 * f;
      c.vy -= Math.sin(ang) * 220 * f;
      c.spinT = Math.max(c.spinT, 0.35 * f);
      c.spinDir = this.rng() < 0.5 ? -1 : 1;
      if (c.wpn) { c.wpn.lock = 0; c.wpn.cd = Math.max(c.wpn.cd, 2); }
    }
    // Chain reactions: blasts destroy nearby mines and rockets.
    for (const m of this.mines) if (!m.dead && Math.hypot(m.x - x, m.y - y) < radius) { m.dead = true; this.explosions.push({ x: m.x, y: m.y, r: 40, t: 0 }); }
    for (const o of this.projectiles) if (o.type === 'rocket' && o !== src && !o.dead && Math.hypot(o.x - x, o.y - y) < radius * 0.7) o.dead = true;
  }

  // ang: world angle from the victim toward the damage source.
  // Rival crews sit behind the glass: the driver on the left, a gunner on the right in armed cars. A shot whose
  // line passes close to a seat on its way through the car hits whoever's in it.
  crewHit(c, pr) {
    if (c === this.player || c.hp <= 0 && c.driverDead || !['bullet', 'harpoon'].includes(pr.type)) return null;
    const sp = Math.hypot(pr.vx, pr.vy) || 1, dx = pr.vx / sp, dy = pr.vy / sp, ch = Math.cos(c.heading), sh = Math.sin(c.heading);
    for (const role of ['driver', 'gunner']) {
      if (role === 'driver' ? c.driverDead : !c.weapon || c.gunnerDead) continue;
      const side = role === 'driver' ? -4.2 : 4.2, sx = c.x - ch * 1.5 - sh * side, sy = c.y - sh * 1.5 + ch * side;
      const rx = sx - pr.x, ry = sy - pr.y, along = rx * dx + ry * dy;
      if (along < -CAR_RADIUS || along > CAR_RADIUS * 2) continue;
      if (Math.abs(rx * dy - ry * dx) < 3.6) return role;
    }
    return null;
  }

  // A hit on the crew. Drivers flinch the car into a swerve; gunners lose their lock. Kill the driver and the car
  // is out (it coasts on, steering itself into a wall); kill the gunner and its weapon falls silent.
  woundCrew(c, role, dmg, owner) {
    const p = this.player;
    if (!c.crewHp) c.crewHp = { driver: c.isBoss ? 45 : 16, gunner: c.isBoss ? 30 : 10 }; // bosses wear helmets
    c.crewHp[role] -= dmg;
    if (role === 'driver') { c.flinchT = 0.5; c.spinT = Math.max(c.spinT, 0.16); c.spinDir = Math.random() < 0.5 ? -1 : 1; }
    else { c.gFlinchT = 0.5; if (c.wpn) c.wpn.lock = 0; }
    if (c.crewHp[role] > 0) {
      this.events.push({ type: 'crewHit', role });
      if (owner === p) this.race.message(role === 'driver' ? 'Driver hit!' : 'Gunner hit!', '#ff8a6a');
      return;
    }
    this.events.push({ type: 'crewKill', role });
    if (role === 'gunner') { c.gunnerDead = true; if (owner === p) this.race.message(`${shortName(c)}'s gunner is down!`, '#ffd23f', true); return; }
    c.driverDead = true;
    c.deadSteer = (Math.random() - 0.5) * 0.5;
    if (c.hp > 0) {
      c.hp = 0;
      if (owner === p) this.creditWreck(c, 'driver');
    }
    if (owner === p) this.race.message(`${shortName(c)}'s driver is down!`, '#ffd23f', true);
  }

  // A rival you wrecked: paid for, and remembered (how you did it decides how they come back, if they live; see
  // Proto.noteVendettas).
  creditWreck(c, how) {
    this.stats.wrecked++;
    if (has(this.build, 'bobblehead')) this.stats.scrapBonus += 40;
    this.cloverRefill();
    if (!c.downed) c.downed = { how };
  }

  hitCar(c, dmg, owner, ang, slow, kind) {
    const p = this.player;
    if (c !== p && c.markT > 0) dmg *= 1.2; // tracer-marked
    if (c.plate && c.plate[kind || 'bullet']) dmg *= c.plate[kind || 'bullet'];
    if (c === p && owner && owner !== p) dmg *= this.rivalMul || 1; // a vendetta car, plated against what beat it last time
    if (c !== p) dmg = this.bossArmour(c, dmg, ang, kind);
    const before = c.hp;
    this.race.damage(c, dmg, { kind: kind || 'bullet', ang });
    c.vx *= slow;
    c.vy *= slow;
    if (c === p) {
      const taken = before - c.hp;
      if (taken > 0) {
        this.hits.push({ ang, t: 0, dmg: taken });
        this.events.push({ type: 'hurt', ang, dmg: taken, kind: HURT_KIND[kind] || HURT_KIND[owner && owner.isBoss ? 'boss' : ''] || kind });
      }
    } else if (owner === p) {
      this.stats.dealt += Math.min(dmg, before);
      if (before > 0 && c.hp <= 0) {
        this.creditWreck(c, kind || 'bullet');
        this.race.message(`${shortName(c)} wrecked!`, '#ffd23f');
      }
    }
  }

  // Incoming danger for indicators: locks on you and enemy rockets nearby.
  threats() {
    const p = this.player, out = [];
    for (const c of this.race.cars) {
      if (c.wpn && c.wpn.lock > 0) out.push({ x: c.x, y: c.y, kind: 'lock', k: c.wpn.lock / this.lockTime });
    }
    for (const pr of this.projectiles) {
      if (pr.type !== 'rocket' || pr.owner === p) continue;
      const d = Math.hypot(pr.x - p.x, pr.y - p.y);
      if (d < 900) out.push({ x: pr.x, y: pr.y, kind: 'rocket', k: 1 - d / 900 });
    }
    return out;
  }

  // ---------- 2D (top-down) drawing, in world space ----------

  render2D(ctx, t) {
    const p = this.player;
    for (const c of this.race.cars) {
      if (!c.wpn || !(c.wpn.lock > 0)) continue;
      const k = c.wpn.lock / this.lockTime;
      ctx.strokeStyle = `rgba(255,40,40,${0.35 + 0.6 * k})`;
      ctx.lineWidth = 1 + k * 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34 - k * 14, 0, TAU);
      ctx.stroke();
    }
    for (const m of this.mines) {
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(m.x, m.y, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = m.t < m.arm || Math.floor(t * 4) % 2 ? '#ff2a2a' : '#661010';
      ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, TAU); ctx.fill();
    }
    for (const cl of this.clouds) {
      ctx.fillStyle = `rgba(150,150,145,${0.55 * Math.min(1, (cl.life - cl.t) / 1.5)})`;
      for (let k = 0; k < 6; k++) {
        const a = k * 1.05 + cl.t * 0.3;
        ctx.beginPath(); ctx.arc(cl.x + Math.cos(a) * cl.cur * 0.4, cl.y + Math.sin(a) * cl.cur * 0.4, cl.cur * 0.6, 0, TAU); ctx.fill();
      }
    }
    for (const c of this.race.cars) {
      if (c.blindT > 0) { ctx.fillStyle = 'rgba(255,90,40,0.35)'; ctx.beginPath(); ctx.arc(c.x, c.y, 26, 0, TAU); ctx.fill(); }
      if (c.burnT > 0 && Math.random() < 0.8) this.race.particles.push({ x: c.x + (Math.random() - 0.5) * 16, y: c.y + (Math.random() - 0.5) * 16, vx: 0, vy: 0, life: 0.5, t: 0, size: 6, color: Math.random() < 0.5 ? '#ff7a1a' : '#ffcf3a', type: 'smoke' });
      if (c.empT > 0 && Math.floor(t * 10) % 2) { ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, 20, 0, TAU); ctx.stroke(); }
    }
    for (const c of this.race.cars) if (c.hookT > 0 && c.hookBy) { // the harpoon line
      ctx.strokeStyle = 'rgba(220,210,190,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(c.hookBy.x, c.hookBy.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
    for (const pr of this.projectiles) {
      if (pr.type === 'flame') {
        const k = pr.t / pr.life;
        ctx.fillStyle = `rgba(255,${Math.round(180 - 120 * k)},40,${0.7 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 4 + 14 * k, 0, TAU); ctx.fill();
        continue;
      }
      if (pr.type === 'harpoon') {
        ctx.strokeStyle = '#cfd4d8'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02); ctx.stroke();
        ctx.strokeStyle = 'rgba(220,210,190,0.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.owner.x, pr.owner.y); ctx.stroke();
        continue;
      }
      if (pr.type === 'flare') {
        ctx.fillStyle = '#ff6a2a';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,120,60,0.3)';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 14, 0, TAU); ctx.fill();
      } else if (pr.type === 'bullet') {
        ctx.strokeStyle = '#ffe680';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x - pr.vx * 0.012, pr.y - pr.vy * 0.012);
        ctx.stroke();
      } else {
        const a = Math.atan2(pr.vy, pr.vx);
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(a);
        ctx.fillStyle = pr.owner === p ? '#5ad8ff' : '#ff5a3c';
        ctx.fillRect(-8, -3, 16, 6);
        ctx.fillStyle = '#ffd27a';
        ctx.fillRect(-14 - Math.random() * 6, -2, 6, 4);
        ctx.restore();
        if (Math.random() < 0.7) this.race.particles.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, life: 0.6, t: 0, size: 5, color: '#bbb', type: 'smoke' });
      }
    }
    for (const g of this.grenades) {
      const s = 1 + g.z / 60;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(g.x, g.y, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4a7a2a';
      ctx.beginPath(); ctx.arc(g.x, g.y - g.z * 0.5, 6 * s, 0, TAU); ctx.fill();
    }
    for (const e of this.explosions) {
      const k = e.t / 0.5;
      if (e.kind === 'emp' || e.kind === 'flare') {
        ctx.strokeStyle = e.kind === 'flare' ? `rgba(255,120,40,${1 - k})` : `rgba(127,216,255,${1 - k})`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * k, 0, TAU); ctx.stroke();
        continue;
      }
      ctx.fillStyle = `rgba(255,${Math.round(200 - 150 * k)},60,${0.75 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + 0.6 * k), 0, TAU); ctx.fill();
    }
    if (this.hatchDown) { // the plate across the front of your car
      const c = Math.cos(p.heading), s = Math.sin(p.heading), k = this.hatch.pos;
      ctx.strokeStyle = this.hatch.shutAge < PARRY_WINDOW ? '#fff' : '#9a9c9e';
      ctx.lineWidth = 3 + 3 * k;
      ctx.beginPath(); ctx.moveTo(p.x + c * 10 - s * 11, p.y + s * 10 + c * 11); ctx.lineTo(p.x + c * 10 + s * 11, p.y + s * 10 - c * 11); ctx.stroke();
    }
  }
}
