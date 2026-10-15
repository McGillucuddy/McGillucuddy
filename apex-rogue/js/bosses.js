'use strict';
// Bosses: each act's garage is tagged with its boss's name (see Garage3D.setBoss), a health bar while you race
// them, and a signature move each, telegraphed before it lands. At half health every boss loses their temper.
// card: [small line, big line] and ink: the boss's piece in the garage graffiti (js/graffiti.js).

const BOSS_KIT = {
  'The Turnkey': {
    card: ['The', 'Turnkey'], ink: '#c9a43a',
    move: 'ram', tell: 'RIOT RAM!', every: 14, rage: 9,
    rageLine: 'THE TURNKEY IS PISSED',
    help: 'Armoured nose: bullets from in front do a third. Hit him from the side or behind. Rams you when you get close.',
  },
  'Smokestack Sal': {
    card: ['Smokestack', 'Sal'], ink: '#8a5a32',
    move: 'smog', tell: 'SMOKESTACK!', every: 8, rage: 5,
    rageLine: 'SAL IS BURNING EVERYTHING',
    help: 'Belches smog clouds you can\'t see through, and lays mines. Angry, he lays them two at a time.',
  },
  'Augustin Vale': {
    card: ['Augustin', 'Vale'], ink: '#e8c050',
    move: 'barrage', tell: 'SPONSOR BARRAGE!', every: 12, rage: 8, salvo: 3, rageSalvo: 5,
    rageLine: 'VALE HAS LOST HIS TEMPER',
    help: 'Fires a fan of rockets at once after a warning. Slam the hatch on the first one to bat it back.',
  },
  'Vex "The Apex" Marlowe': {
    card: ['Vex The Apex', 'Marlowe'], ink: '#d8342a',
    move: 'apex', tell: 'APEX BARRAGE!', every: 13, rage: 8, salvo: 3, rageSalvo: 4,
    rageLine: 'THE APEX IS ANGRY',
    help: 'Rockets, then once angry: nitro bursts and rocket salvos. Only a win sets you free.',
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
