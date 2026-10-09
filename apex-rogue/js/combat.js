'use strict';
// Gunplay layer on top of a Race: the player's build (ammo weapons, abilities, trinkets,
// parts that wear and break), armed rivals, projectiles, mines, grenades, explosions.
// Pure simulation (2D world units); views read its state to draw it.

const ROCKET_SPEED = 820;
const LOCK_TIME = 1.35;
const PARRY_WINDOW = 0.3;
const GRENADE_G = 700;
const FIT_TIME = 2.5;

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
    this.abil = b.abilities.map((id) => (id ? { id, cd: 0 } : null));
    this.shield = { t: 0, age: 0 };
    this.swerveCd = 0;
    this.invulnT = 0;
    this.fitT = 0;
    this.footUsed = false;
    this.lastFire = 9;
    // Suppressed guns keep you off the rivals' radar: they take longer to lock on.
    this.quiet = b.rack.some((w) => weaponStats(w).quiet);
    this.weather = opts.weather || {};
    this.lockTime = LOCK_TIME * (has(b, 'keys') ? 0.75 : 1) * (this.quiet ? 1.4 : 1) * (b.chip === 'showboat' ? 0.75 : 1) * (this.weather.lock || 1);
    this.stats = { dealt: 0, parries: 0, shotDown: 0, taken: 0, wrecked: 0, scrapBonus: 0 };

    // The player's car runs every hit through the build (armour, parts, trinkets).
    const p = this.player;
    p.damageFilter = (amount, info) => this.filterDamage(amount, info);
    p.ramMul = p.stats.ram * (has(b, 'horseshoe') ? 3 : 1) * (b.chip === 'hothead' ? 1.5 : 1);
    this.ramBase = p.ramMul; // rams before any bayonet in your hands
    p.ramTakenMul = (has(b, 'horseshoe') ? 1.5 : 1) * (b.chip === 'veteran' ? 1.25 : 1);
    p.oilMul = b.chip === 'daredevil' ? 2 : 1;

    // Arm the field: two rocket gunners, a mine layer and a gunner; elites bring an extra gun of each kind.
    // The boss always carries their own weapon. A snitch tip-off leaves everyone else unarmed.
    const loadout = opts.elite ? ['rocket', 'rocket', 'mine', 'gun', 'gun', 'rocket'] : ['rocket', 'rocket', 'mine', 'gun'];
    const rivals = shuffle(this.rng, race.cars.filter((c) => c !== this.player && !c.isBoss));
    rivals.forEach((c, i) => { if (!opts.disarm && loadout[i]) c.weapon = loadout[i]; });
    const bossCar = race.cars.find((c) => c.isBoss);
    if (bossCar && opts.boss) bossCar.weapon = opts.boss.weapon;
    for (const c of race.cars) if (c.weapon && c !== this.player) c.wpn = { cd: randRange(this.rng, 3, 7), lock: 0 };
  }

  get weapon() { return this.build.rack[this.wi]; }
  get weaponDef() { return weaponStats(this.weapon); }
  get busy() { return this.fitT > 0; }

  // ---------- Player actions ----------

  select(i) {
    if (i < 0 || i >= this.build.rack.length || i === this.wi || this.busy) return;
    this.wi = i;
    this.events.push({ type: 'switch' });
  }

  cycle(dir) {
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
    if (a.id === 'shield') {
      this.shield.t = 1.1 * (has(this.build, 'teddy') ? 1.5 : 1);
      this.shield.age = 0;
      this.events.push({ type: 'shield' });
    } else if (a.id === 'nitro_burst') {
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
    if (def.dazzle && ctl.aim != null) for (const c of this.race.cars) { // the flashlight: whoever's in the beam can't hold a lock
      if (c === p || !c.wpn || !(c.wpn.lock > 0)) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y), off = Math.abs(wrapAngle(Math.atan2(c.y - p.y, c.x - p.x) - ctl.aim));
      if (d < 650 && off < 0.12) c.wpn.lock = Math.max(0, c.wpn.lock - dt * 2.5);
    }
    if (this.driver) this.driver.shaky = b.chip === 'gun_nut' && this.lastFire < 0.4;
    if (p.finished || this.race.state !== 'racing' || this.busy) return;
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
      for (let k = 0; k < def.pellets; k++) {
        const a = ctl.aim + randRange(this.rng, -def.spread, def.spread);
        this.spawn('bullet', p, a, def.speed * randRange(this.rng, 0.92, 1.05), 1, { dmg: def.dmg, life: def.life, knock: def.knock || 0, burn: def.burn || 0, tracer: !!def.tracer, puncture: def.puncture || 0, shock: def.shock || 0 });
      }
      this.events.push({ type: def.pellets > 1 ? 'shotgun' : def.puncture ? 'nail' : 'shoot', w: this.weapon.id });
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
    const s = this.shield;
    if (s.t > 0) { s.t -= dt; s.age += dt; }
    for (const a of this.abil) if (a) a.cd -= dt * (this.weather.cd || 1);
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
          if (before > 0 && c.hp <= 0) { this.stats.wrecked++; if (has(this.build, 'bobblehead')) this.stats.scrapBonus += 40; this.cloverRefill(); }
        }
      }
      if (c.burnT > 0) {
        c.burnT -= dt;
        const before = c.hp;
        race.damage(c, c.burnDps * dt, { kind: 'fire' });
        if (c.burnBy === p && c !== p) {
          this.stats.dealt += before - c.hp;
          if (before > 0 && c.hp <= 0) { this.stats.wrecked++; if (has(this.build, 'bobblehead')) this.stats.scrapBonus += 40; this.cloverRefill(); this.race.message(`${shortName(c)} burned out!`, '#ffd23f'); }
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
      if (!c.weapon || c === p) continue;
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
            const a = Math.atan2(dy + p.vy * d / 1500, dx + p.vx * d / 1500) + randRange(this.rng, -0.07, 0.07);
            this.spawn('bullet', c, a, 1500, 1, { dmg: 2.5, life: 0.45 });
            this.events.push({ type: 'enemyShot' });
          }
        } else if (w.lock > 0) {
          if (disabled || d > 520 || c.spinT > 0) { w.lock = 0; w.cd = 2; continue; }
          w.lock += dt * 2; // half a rocket lock
          if (w.lock >= this.lockTime) { w.lock = 0; w.burst = 6; w.bt = 0; w.cd = randRange(this.rng, 4, 6); }
        } else if (!disabled && w.cd <= 0 && d > 60 && d < 450) {
          w.lock = 1e-4;
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
              this.explode(m.x, m.y, 60, 16, pr.owner);
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
        if (c === p && this.shield.t > 0) {
          this.blockWithShield(pr);
          break;
        }
        pr.dead = true;
        if (pr.type === 'rocket') this.explode(pr.x, pr.y, pr.radius, pr.dmg, pr.owner, pr);
        else {
          this.hitCar(c, pr.dmg, pr.owner, Math.atan2(-pr.vy, -pr.vx), 0.985, pr.type === 'flame' ? 'fire' : 'bullet');
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

  blockWithShield(pr) {
    const p = this.player;
    if (pr.type === 'rocket' && this.shield.age < PARRY_WINDOW && pr.owner !== p) {
      // Perfect block: send it back to whoever fired it.
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
      this.events.push({ type: 'parry' });
    } else {
      pr.dead = true;
      this.events.push({ type: 'block' });
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
          this.explode(m.x, m.y, 60, 16, m.owner);
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
      if (c === p && this.shield.t > 0) { this.events.push({ type: 'block' }); continue; }
      const f = 1 - clamp(d / (radius + CAR_RADIUS), 0, 1) * 0.6;
      const ang = Math.atan2(y - c.y, x - c.x);
      this.hitCar(c, dmg * f, owner, ang, 0.75, 'blast');
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
  hitCar(c, dmg, owner, ang, slow, kind) {
    const p = this.player;
    if (c !== p && c.markT > 0) dmg *= 1.2; // tracer-marked
    const before = c.hp;
    this.race.damage(c, dmg, { kind: kind || 'bullet', ang });
    c.vx *= slow;
    c.vy *= slow;
    if (c === p) {
      const taken = before - c.hp;
      if (taken > 0) {
        this.hits.push({ ang, t: 0, dmg: taken });
        this.events.push({ type: 'hurt', ang, dmg: taken });
      }
    } else if (owner === p) {
      this.stats.dealt += Math.min(dmg, before);
      if (before > 0 && c.hp <= 0) {
        this.stats.wrecked++;
        if (has(this.build, 'bobblehead')) this.stats.scrapBonus += 40;
        this.cloverRefill();
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
    if (this.shield.t > 0) {
      const perfect = this.shield.age < PARRY_WINDOW;
      ctx.strokeStyle = perfect ? 'rgba(255,255,255,0.95)' : 'rgba(90,216,255,0.85)';
      ctx.fillStyle = 'rgba(90,216,255,0.18)';
      ctx.lineWidth = perfect ? 4 : 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }
}
