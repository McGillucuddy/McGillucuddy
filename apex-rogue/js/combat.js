'use strict';
// Gunplay layer on top of a Race: the player's arsenal, armed rivals,
// projectiles, mines, grenades, explosions, shield/parry and swerve orders.
// Pure simulation (2D world units); views read its state to draw it.

const ARSENAL = {
  smg: { name: 'SMG', slot: 1 },
  rocket: { name: 'Rocket Launcher', slot: 2 },
};

const SMG_RATE = 0.085;
const SMG_HEAT = 0.06;
const BULLET_SPEED = 1500;
const ROCKET_SPEED = 820;
const PLAYER_ROCKET_SPEED = 950;
const LOCK_TIME = 1.35;
const PARRY_WINDOW = 0.3;
const GRENADE_G = 700;

class Combat {
  constructor(race, opts) {
    this.race = race;
    this.player = race.player;
    this.driver = opts.driver;
    this.rng = race.rng;
    this.projectiles = [];
    this.mines = [];
    this.grenades = [];
    this.explosions = [];
    this.hits = []; // recent hits on the player: {ang (world), t}
    this.events = [];
    this.weapon = 'smg';
    this.smg = { heat: 0, overheated: false, cd: 0 };
    this.rockets = { ammo: 3, max: 3, reload: 0, cd: 0 };
    this.nades = { ammo: 3, max: 3, regen: 0 };
    this.shield = { t: 0, age: 0, cd: 0, dur: 1.1, cooldown: 7 };
    this.swerveCd = 0;
    this.stats = { dealt: 0, parries: 0, shotDown: 0, taken: 0, wrecked: 0 };

    // Arm some rivals: two rocket gunners and a mine layer.
    const rivals = shuffle(this.rng, race.cars.filter((c) => c !== this.player));
    rivals.forEach((c, i) => {
      if (i < 2) c.weapon = 'rocket';
      else if (i === 2) c.weapon = 'mine';
      if (c.weapon) c.wpn = { cd: randRange(this.rng, 3, 7), lock: 0 };
    });
  }

  // ---------- Player actions ----------

  select(weapon) {
    if (ARSENAL[weapon] && weapon !== this.weapon) {
      this.weapon = weapon;
      this.events.push({ type: 'switch' });
    }
  }

  cycle(dir) {
    const keys = Object.keys(ARSENAL);
    this.select(keys[(keys.indexOf(this.weapon) + dir + keys.length) % keys.length]);
  }

  activateShield() {
    const s = this.shield;
    if (s.cd > 0 || this.player.finished) return false;
    s.t = s.dur;
    s.age = 0;
    s.cd = s.cooldown;
    this.events.push({ type: 'shield' });
    return true;
  }

  swerve(side) {
    if (this.swerveCd > 0 || this.player.finished) return false;
    this.driver.swerve(side, 0.9);
    this.swerveCd = 2.2;
    this.events.push({ type: 'swerve' });
    return true;
  }

  throwGrenade(aim, dist) {
    const n = this.nades, p = this.player;
    if (n.ammo <= 0 || p.finished) { this.events.push({ type: 'empty' }); return false; }
    n.ammo--;
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

  // ctl: { aim (world angle), firing (held), pressed (edge) }
  updatePlayerWeapons(dt, ctl) {
    const p = this.player;
    const g = this.smg;
    g.cd -= dt;
    g.heat = Math.max(0, g.heat - (g.overheated ? 0.55 : 0.4) * dt);
    if (g.overheated && g.heat < 0.25) g.overheated = false;

    const r = this.rockets;
    r.cd -= dt;
    if (r.ammo < r.max) {
      r.reload += dt;
      if (r.reload >= 3.5) { r.ammo++; r.reload = 0; }
    }
    const n = this.nades;
    if (n.ammo < n.max) {
      n.regen += dt;
      if (n.regen >= 9) { n.ammo++; n.regen = 0; }
    }

    if (p.finished || this.race.state !== 'racing') return;
    if (this.weapon === 'smg' && ctl.firing && !g.overheated && g.cd <= 0) {
      g.cd = SMG_RATE;
      g.heat += SMG_HEAT;
      if (g.heat >= 1) { g.overheated = true; this.events.push({ type: 'overheat' }); }
      const a = ctl.aim + randRange(this.rng, -0.035, 0.035);
      this.spawn('bullet', p, a, BULLET_SPEED, 1, { dmg: 3.2, life: 0.6 });
      this.events.push({ type: 'shoot' });
    } else if (this.weapon === 'rocket' && ctl.pressed) {
      if (r.ammo > 0 && r.cd <= 0) {
        r.ammo--;
        r.cd = 0.6;
        this.spawn('rocket', p, ctl.aim, PLAYER_ROCKET_SPEED, 1, { dmg: 26, radius: 62, life: 2.2 });
        this.events.push({ type: 'rocket' });
      } else {
        this.events.push({ type: 'empty' });
      }
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
    const s = this.shield;
    if (s.t > 0) { s.t -= dt; s.age += dt; }
    s.cd -= dt;
    this.swerveCd -= dt;
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
      const disabled = c.hp <= 0 || c.finished || p.finished;
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
          if (w.lock >= LOCK_TIME) {
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

      const armed = pr.t > 0.12;
      for (const c of cars) {
        if (c === pr.owner && !armed) continue;
        if (c === pr.owner && pr.type === 'bullet') continue;
        const r = CAR_RADIUS + (pr.type === 'rocket' ? 6 : 2);
        if ((c.x - pr.x) ** 2 + (c.y - pr.y) ** 2 > r * r) continue;
        if (c === p && this.shield.t > 0) {
          this.blockWithShield(pr);
          break;
        }
        pr.dead = true;
        if (pr.type === 'rocket') this.explode(pr.x, pr.y, pr.radius, pr.dmg, pr.owner, pr);
        else this.hitCar(c, pr.dmg, pr.owner, Math.atan2(-pr.vy, -pr.vx), 0.985);
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
    this.events.push({ type: 'explode', x, y, big: radius > 55 });
    for (const c of this.race.cars) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d > radius + CAR_RADIUS) continue;
      if (c === p && owner === p) continue; // your own explosives don't hurt you
      if (c === p && this.shield.t > 0) { this.events.push({ type: 'block' }); continue; }
      const f = 1 - clamp(d / (radius + CAR_RADIUS), 0, 1) * 0.6;
      const ang = Math.atan2(y - c.y, x - c.x);
      this.hitCar(c, dmg * f, owner, ang, 0.75);
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
  hitCar(c, dmg, owner, ang, slow) {
    const p = this.player;
    const before = c.hp;
    this.race.damage(c, dmg);
    c.vx *= slow;
    c.vy *= slow;
    if (c === p) {
      this.stats.taken += dmg;
      this.hits.push({ ang, t: 0, dmg });
      this.events.push({ type: 'hurt', ang, dmg });
    } else if (owner === p) {
      this.stats.dealt += Math.min(dmg, before);
      if (before > 0 && c.hp <= 0) {
        this.stats.wrecked++;
        this.race.message(`${c.name.split(' ')[0]} wrecked!`, '#ffd23f');
      }
    }
  }

  // Incoming danger for indicators: locks on you and enemy rockets nearby.
  threats() {
    const p = this.player, out = [];
    for (const c of this.race.cars) {
      if (c.wpn && c.wpn.lock > 0) out.push({ x: c.x, y: c.y, kind: 'lock', k: c.wpn.lock / LOCK_TIME });
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
      const k = c.wpn.lock / LOCK_TIME;
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
    for (const pr of this.projectiles) {
      if (pr.type === 'bullet') {
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
