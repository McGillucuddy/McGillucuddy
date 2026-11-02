'use strict';
// Bosses: each act's garage is tagged with its boss's name (see Garage3D.setBoss), a health bar while you race
// them, and a signature move each, telegraphed before it lands. At half health every boss loses their temper.
// card: [small line, big line] and ink: the boss's piece in the garage graffiti (js/graffiti.js).

const BOSS_KIT = {
  'The Turnkey': {
    card: ['The', 'Turnkey'], ink: '#c9a43a',
    move: 'ram', tell: 'RIOT RAM!', every: 14, rage: 9,
    rageLine: 'THE TURNKEY IS PISSED',
    cons: 4, // lifers at the barred windows, each with a gun: they fire out of whichever side you're on
    help: 'A bus full of armed lifers: they shoot from whichever side you\'re on, so pick them off through the bars one by one. Armoured nose: bullets from in front do a third. Rams you when you get close.',
  },
  'Smokestack Sal': {
    card: ['Smokestack', 'Sal'], ink: '#8a5a32',
    move: 'smog', tell: 'SMOKESTACK!', every: 8, rage: 5,
    rageLine: 'SAL IS BURNING EVERYTHING',
    hook: { every: 15, rage: 10, range: 230, time: 7, hp: 5 }, // the wrecker's hook: it drags you backwards until you shoot the cable through
    help: 'Get close and he hooks you with the wrecker and drags you back: shoot the cable to cut yourself loose. Also belches smog you can\'t see through, and lays mines. Angry, he lays them two at a time.',
  },
  'Augustin Vale': {
    card: ['Augustin', 'Vale'], ink: '#e8c050',
    move: 'barrage', tell: 'SPONSOR BARRAGE!', every: 12, rage: 8, salvo: 3, rageSalvo: 5,
    rageLine: 'VALE HAS LOST HIS TEMPER',
    escort: 2, // a paid security detail in gold cars, who ram anyone who gets near him
    help: 'Two security cars in his colours ram anyone who gets near him. His buggy has no glass, so his driver is easy to hit. Fires a fan of rockets after a warning: slam the hatch on the first one to bat it back.',
  },
  'Vex "The Apex" Marlowe': {
    card: ['Vex The Apex', 'Marlowe'], ink: '#d8342a',
    move: 'apex', tell: 'APEX BARRAGE!', every: 13, rage: 8, salvo: 3, rageSalvo: 4,
    rageLine: 'THE APEX IS ANGRY',
    revive: 0.45, // wrecked once, the hearse gets up again with this much of its hull
    help: 'Rockets, then once angry: nitro bursts, rocket salvos, and coffins dropped out of the back. Wreck the hearse and it gets up again, once. Only a win sets you free.',
  },
};
const bossKit = (boss) => (boss && BOSS_KIT[boss.name]) || null;

// ---------- Signature moves (mixed into Combat) ----------
Object.assign(Combat.prototype, {
  updateBoss(dt) {
    const bc = this.race.bossCar, B = this.race.boss, K = bossKit(B), p = this.player;
    if (!bc || !K || this.race.state !== 'racing') return;
    const S = this.bossState || (this.bossState = { t: 0, next: K.every * 0.7, tell: 0, rage: false, salvo: 0, salvoT: 0, mineT: 0, boostT: 0 });
    S.t += dt;
    const down = bc.hp <= 0 || bc.finished || p.finished;
    if (!S.rage && bc.hp < bc.stats.maxHp * 0.5 && !down) {
      S.rage = true;
      this.race.message(K.rageLine, '#ff3b1f', true, true);
      this.events.push({ type: 'bossRage' });
      if (bc.wpn) bc.wpn.cd = 0;
    }
    const dx = p.x - bc.x, dy = p.y - bc.y, d = Math.hypot(dx, dy);
    this.bossGimmick(dt, bc, K, S, d, down); // each boss's own trick (below)
    // A salvo in progress: the rockets go out one after another.
    if (S.salvo > 0) {
      S.salvoT -= dt;
      if (S.salvoT <= 0 && !down) {
        const n = S.salvoN, k = n - S.salvo, a = Math.atan2(dy + p.vy * 0.35, dx + p.vx * 0.35) + (k - (n - 1) / 2) * 0.16;
        this.spawn('rocket', bc, a, ROCKET_SPEED, 0.3, { dmg: 14, radius: 46, life: 3, target: p, turn: 1.1 });
        this.events.push({ type: 'enemyRocket', x: bc.x, y: bc.y });
        S.salvo--; S.salvoT = 0.22;
      }
    }
    // The tell: a warning, then the move goes off.
    if (S.tell > 0) {
      S.tell -= dt;
      if (bc.wpn && K.move !== 'ram' && K.move !== 'smog') bc.wpn.lock = Math.max(bc.wpn.lock, 1e-3); // the laser's on you
      if (S.tell <= 0 && !down) this.bossMove(bc, K, S, d);
    } else if (!down && S.t >= S.next) {
      S.next = S.t + (S.rage ? K.rage : K.every) * randRange(this.rng, 0.85, 1.15);
      const inRange = K.move === 'ram' ? d < 300 : K.move === 'smog' ? true : d < 760;
      if (inRange) {
        S.tell = K.move === 'smog' ? 0.6 : 1.1;
        this.race.message(`${shortName(bc)}: ${K.tell}`, '#ff3b1f', true, true);
        this.events.push({ type: 'bossTell' });
      }
    }
    // Rage extras: Sal's second mine, the Apex's nitro bursts.
    if (S.rage && !down) {
      if (K.move === 'smog') {
        S.mineT -= dt;
        const fwd = dx * Math.cos(bc.heading) + dy * Math.sin(bc.heading);
        if (S.mineT <= 0 && fwd < -40 && d < 600) {
          S.mineT = 2.6;
          for (const side of [-1, 1]) this.mines.push({ x: bc.x - Math.cos(bc.heading) * 24 - Math.sin(bc.heading) * side * 9, y: bc.y - Math.sin(bc.heading) * 24 + Math.cos(bc.heading) * side * 9, owner: bc, t: 0, arm: 0.6, hp: 2 });
          this.events.push({ type: 'mine' });
        }
      }
      if (K.move === 'apex') {
        S.coffinT = (S.coffinT ?? 2) - dt;
        const fwd = dx * Math.cos(bc.heading) + dy * Math.sin(bc.heading);
        if (S.coffinT <= 0 && fwd < -30 && d < 650) { S.coffinT = randRange(this.rng, 2.6, 4); this.dropCoffin(bc); }
        S.boostT -= dt;
        if (S.boostT <= 0) { S.boostT = 7; bc.boostT = Math.max(bc.boostT, 1.4); }
      }
    }
    if (S.grudgeT > 0 && (S.grudgeT -= dt) <= 0 && bc.ai && !(bc.tiltT > 0)) { bc.ai.grudge = null; bc.ai.rammer = false; }
  },

  bossMove(bc, K, S, d) {
    const p = this.player;
    if (K.move === 'ram') { // floor it and steer into you
      bc.boostT = Math.max(bc.boostT, 1.8);
      if (bc.ai) { bc.ai.grudge = p; bc.ai.rammer = true; }
      S.grudgeT = 3.2;
    } else if (K.move === 'smog') { // a choking cloud out of the stacks behind him
      const c = Math.cos(bc.heading), s = Math.sin(bc.heading);
      this.clouds.push({ x: bc.x - c * 50, y: bc.y - s * 50, r: 150, t: 0, life: 8, smog: true });
      if (S.rage) this.clouds.push({ x: bc.x - c * 130, y: bc.y - s * 130, r: 130, t: 0, life: 7, smog: true });
      this.events.push({ type: 'smog' });
    } else { // barrage
      S.salvoN = S.rage ? K.rageSalvo : K.salvo;
      S.salvo = S.salvoN;
      S.salvoT = 0;
      if (bc.wpn) bc.wpn.lock = 0;
    }
    void d;
  },

  // ---------- Gimmicks ----------
  bossGimmick(dt, bc, K, S, d, down) {
    const p = this.player, R = this.race;
    // The Turnkey's lifers: each at their own window, firing out of the side you're on.
    if (K.cons && !S.cons) {
      S.cons = bc.cons = CON_SEATS.slice(0, K.cons)
        .map(([x, side], i) => ({ x, side, hp: 14, cd: 1.5 + i * 0.7, burst: 0, bt: 0, dead: false }));
    }
    if (S.cons && !down) {
      const ch = Math.cos(bc.heading), sh = Math.sin(bc.heading), lat = -sh * (p.x - bc.x) + ch * (p.y - bc.y);
      for (const cn of S.cons) {
        if (cn.dead) continue;
        cn.cd -= dt;
        if (cn.flinch > 0) cn.flinch -= dt;
        const facing = Math.sign(lat) === cn.side && Math.abs(lat) > 6;
        if (cn.burst > 0 && facing && !(cn.flinch > 0)) {
          if ((cn.bt -= dt) > 0) continue;
          cn.burst--; cn.bt = 0.13;
          const [x, y] = conPos(bc, cn), a = Math.atan2(p.y + p.vy * 0.25 - y, p.x + p.vx * 0.25 - x) + randRange(this.rng, -0.1, 0.1);
          this.spawn('bullet', bc, a, 1400, 1, { x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 4, dmg: 2, life: 0.45 });
          this.events.push({ type: 'enemyShot', x, y });
        } else if (cn.cd <= 0 && facing && d < 460 && !(bc.empT > 0) && !(bc.blindT > 0)) {
          cn.burst = 3 + (S.rage ? 2 : 0); cn.bt = 0;
          cn.cd = randRange(this.rng, 2.4, 4) * (S.rage ? 0.65 : 1);
        }
      }
    }
    // Sal's hook: in close, he swings it onto your car and drags you back until the cable gives or you cut it.
    if (K.hook) {
      const H = K.hook;
      S.hookCd = (S.hookCd ?? H.every * 0.6) - dt;
      if (S.tow) {
        const T = S.tow;
        T.t -= dt;
        const [hx, hy] = hookPos(bc), ux = p.x - hx, uy = p.y - hy, L = Math.hypot(ux, uy) || 1, nx = ux / L, ny = uy / L;
        // Cut it: any of your rounds crossing the cable.
        for (const pr of this.projectiles) {
          if (pr.owner !== p || pr.dead || pr.type === 'rocket' || pr.cutTested === T) continue;
          const px0 = pr.x - pr.vx * dt, py0 = pr.y - pr.vy * dt;
          if (segDist2(px0, py0, pr.x, pr.y, hx, hy, p.x, p.y) < 4.5 * 4.5) { pr.cutTested = T; pr.dead = true; T.hp--; this.events.push({ type: 'deflect', x: (hx + p.x) / 2, y: (hy + p.y) / 2 }); }
        }
        if (T.hp <= 0 || T.t <= 0 || down || p.finished) {
          if (T.hp <= 0) { R.message('Cable cut! You\'re loose!', '#5ad8ff', true); if (this.fame) this.fame(INFAMY.shotDown, 'CUT LOOSE'); }
          else if (!down) R.message('The hook tears loose', '#9fd0ff');
          S.tow = null; p.hookT = 0; p.hookBy = null;
        } else {
          // The cable's taut past its length: it hauls you back towards the wrecker, and costs you speed all the while.
          const slack = 55, over = L - slack;
          if (over > 0) {
            const vr = p.vx * nx + p.vy * ny;
            if (vr > 0) { p.vx -= nx * vr * Math.min(1, dt * 6); p.vy -= ny * vr * Math.min(1, dt * 6); }
            p.vx -= nx * over * 9 * dt; p.vy -= ny * over * 9 * dt;
          }
          p.slowT = Math.max(p.slowT || 0, 0.1); p.slowDrag = Math.max(p.slowDrag || 0, 0.9);
          p.hookT = 0.1; p.hookBy = bc; // drawn like a harpoon line (js/cockpit3d.js)
          bc.boostT = Math.max(bc.boostT, 0.2); // he floors it, towing you
        }
      } else if (!down && S.hookCd <= 0 && d < H.range && !(bc.empT > 0)) {
        if (!S.hookTell) { S.hookTell = 0.9; R.message(`${shortName(bc)}: TOW HOOK!`, '#ff3b1f', true, true); this.events.push({ type: 'bossTell' }); }
      }
      if (S.hookTell > 0 && (S.hookTell -= dt) <= 0) {
        S.hookTell = 0;
        S.hookCd = (S.rage ? H.rage : H.every) * randRange(this.rng, 0.85, 1.15);
        if (!down && d < H.range * 1.25 && !this.guarded) {
          S.tow = { t: H.time, hp: H.hp + (S.rage ? 2 : 0) };
          R.message('HOOKED! Shoot the cable!', '#ff3b1f', true, true);
          this.events.push({ type: 'hurt', ang: Math.atan2(bc.y - p.y, bc.x - p.x), dmg: 4, kind: 'the boss' });
        } else if (this.guarded) R.message('The hook clangs off the hatch', '#9fd0ff');
      }
    }
    // Vale's security detail: ram anyone who gets near him, peel off once he's clear.
    if (K.escort && R.escorts) {
      for (const e of R.escorts) {
        if (e.hp <= 0 || !e.ai) continue;
        const near = Math.hypot(p.x - bc.x, p.y - bc.y) < 380;
        e.ai.grudge = near && !down ? p : null;
        e.ai.rammer = near;
        if (near && !(e.boostT > 0) && Math.hypot(p.x - e.x, p.y - e.y) > 90 && this.rng() < dt * 0.4) e.boostT = 0.8; // catching up
      }
      if (!S.escortSaid && d < 380) { S.escortSaid = true; R.message('Vale\'s security is on you!', '#ffd23f', true); }
    }
    // The Apex won't stay down: the first wreck, he gets up again.
    if (K.revive && !S.reviveSet) {
      S.reviveSet = true;
      const f0 = bc.damageFilter;
      bc.damageFilter = (amount, info) => {
        if (f0) amount = f0(amount, info);
        if (!S.revived && amount >= bc.hp && bc.hp > 0 && !bc.driverDead) { S.revived = true; S.reviveNow = true; return bc.hp - 1; }
        return amount;
      };
    }
    if (S.reviveNow) {
      S.reviveNow = false;
      bc.hp = bc.stats.maxHp * K.revive;
      bc.boostT = Math.max(bc.boostT, 2.5); bc.spinT = 0; bc.burnT = 0;
      if (!S.rage) { S.rage = true; this.events.push({ type: 'bossRage' }); }
      this.explosions.push({ x: bc.x, y: bc.y, r: 70, t: 0 });
      R.message('THE APEX WON\'T STAY DOWN', '#ff3b1f', true, true);
      this.events.push({ type: 'bossRevive', car: bc });
    }
  },

  // A coffin out of the hearse's back door: it skids along the road, hits like a wall, and takes a few rounds to break.
  dropCoffin(bc) {
    const c = Math.cos(bc.heading), s = Math.sin(bc.heading);
    this.mines.push({ kind: 'coffin', x: bc.x - c * 26, y: bc.y - s * 26, vx: bc.vx * 0.55 - c * 40, vy: bc.vy * 0.55 - s * 40, rot: bc.heading + randRange(this.rng, -0.4, 0.4), spin: randRange(this.rng, -2, 2), owner: bc, t: 0, arm: 0.25, hp: 4 });
    this.events.push({ type: 'coffin', x: bc.x, y: bc.y });
  },

  // The Turnkey's armoured nose: rounds from in front glance off.
  bossArmour(c, dmg, ang, kind) {
    if (!c.isBoss || kind !== 'bullet') return dmg;
    const K = bossKit(this.race.boss);
    if (!K || K.move !== 'ram') return dmg;
    if (Math.abs(wrapAngle(ang - c.heading)) > 0.8) return dmg;
    this.events.push({ type: 'deflect', x: c.x, y: c.y });
    return dmg * 0.33;
  },

  // Are you sitting in Sal's smog? (0..1, for the fog in the cockpit)
  smogOn() {
    const p = this.player;
    let k = 0;
    for (const cl of this.clouds) {
      if (!cl.smog || !cl.cur) continue;
      const d = Math.hypot(p.x - cl.x, p.y - cl.y);
      k = Math.max(k, clamp(1.3 - d / cl.cur, 0, 1));
    }
    return k;
  },
});

// The lifers' seats in the bus: [x along the car, side]. The 3D view sits a figure in each (js/cockpit3d.js).
const CON_SEATS = [[-1.4, 1], [-7.2, 1], [-1.4, -1], [-7.2, -1], [-12.8, 1], [-12.8, -1]];
// Where a lifer sits in the bus (world x, y), and where the wrecker's hook hangs.
function conPos(c, cn) {
  const ch = Math.cos(c.heading), sh = Math.sin(c.heading), z = cn.side * 6.4;
  return [c.x + ch * cn.x - sh * z, c.y + sh * cn.x + ch * z];
}
function hookPos(c) { return [c.x - Math.cos(c.heading) * 22, c.y - Math.sin(c.heading) * 22]; }
// Squared distance between two 2D segments (a bullet's step and a cable).
function segDist2(ax, ay, bx, by, cx, cy, dx, dy) {
  const ptSeg = (px, py, x0, y0, x1, y1) => { const vx = x1 - x0, vy = y1 - y0, L = vx * vx + vy * vy || 1, t = clamp(((px - x0) * vx + (py - y0) * vy) / L, 0, 1); return (px - x0 - vx * t) ** 2 + (py - y0 - vy * t) ** 2; };
  const cross = (x0, y0, x1, y1, x2, y2) => (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  const d1 = cross(ax, ay, bx, by, cx, cy), d2 = cross(ax, ay, bx, by, dx, dy), d3 = cross(cx, cy, dx, dy, ax, ay), d4 = cross(cx, cy, dx, dy, bx, by);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(ptSeg(ax, ay, cx, cy, dx, dy), ptSeg(bx, by, cx, cy, dx, dy), ptSeg(cx, cy, ax, ay, bx, by), ptSeg(dx, dy, ax, ay, bx, by));
}

// ---------- Boss health bar (cockpit HUD) ----------
function drawBossBar(ctx, P, W, H, t) {
  const race = P.race, bc = race.bossCar, B = race.boss;
  if (!bc || !B) return;
  const w = Math.min(520, W * 0.5), x = W / 2 - w / 2, y = 54, f = clamp(bc.hp / bc.stats.maxHp, 0, 1);
  const rage = P.combat.bossState && P.combat.bossState.rage;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `bold 15px ${hudFont()}`;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(`☠ ${B.name.toUpperCase()}`, W / 2 + 1, y - 7);
  ctx.fillStyle = rage && Math.floor(t * 4) % 2 ? '#ff3b1f' : '#ffd23f';
  ctx.fillText(`☠ ${B.name.toUpperCase()}`, W / 2, y - 8);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - 3, y - 3, w + 6, 14);
  ctx.fillStyle = '#3a0c08';
  ctx.fillRect(x, y, w, 8);
  ctx.fillStyle = bc.hp <= 0 ? '#555' : rage ? '#ff3b1f' : '#d8342a';
  ctx.fillRect(x, y, w * f, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, w * f, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x + w * 0.5 - 1, y - 2, 2, 12); // the rage line
  ctx.restore();
}
