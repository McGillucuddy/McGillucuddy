'use strict';
// Drivers dodge. Yours watches for rockets coming at the car and mines on the road ahead, and swerves on their
// own: it takes a moment to react, and they don't always see it coming. The closer you are (the bond, js/bond.js)
// the sooner and more surely they react. A homing rocket can't be shaken (it turns harder than a car), so yours shouts instead: that's your cue for the hatch.
// Rivals dodge too, but not as well: the better the driver, the more likely (bosses most of all).

const DODGE = {
  look: 1.1, // seconds out a rocket coming at the car is noticed
  miss: 46, // how close it has to be passing to count as coming at you
  lock: 0.9, // a homing rocket on you: how far out (seconds) your driver calls it
  react: [0.26, 0.22, 0.18, 0.14, 0.1], // seconds before they move, by bond level
  sees: [0.6, 0.72, 0.84, 0.92, 1], // the chance they spot it at all, by bond level
  rival: 0.3, // rivals: the chance they spot it, at skill 1 (bosses twice that)
  mineAhead: 1.3, // seconds ahead (at the speed you're doing) a mine on your line is noticed
  mineWidth: 44, // how far either side of the car's line a mine is in the way (its trigger plus the car)
  hold: 0.55, // how long a dodge holds the swerve
  jink: 0.35, // and how long the wheel's thrown over for a rocket
};

// Which side of the car a point is on: + right, - left (the car's right is (-sin, cos) of its heading: heading
// rises as it turns right, and the lane and the steering count the same way).
const sideOf = (car, x, y) => -(x - car.x) * Math.sin(car.heading) + (y - car.y) * Math.cos(car.heading);

Object.assign(Combat.prototype, {
  updateDodge(dt) {
    if (this.tutorial || this.race.state !== 'racing') return;
    this.dodgeQ = (this.dodgeQ || []).filter((q) => (q.t -= dt) > 0 || this.doDodge(q) || false);
    const p = this.player, rec = this.bondRec ? this.bondRec() : null, lv = rec ? Bond.level(rec.xp) : 0;
    for (const car of this.race.cars) {
      const D = car === p ? this.driver : car.ai;
      if (!D || car.finished || car.wrecked || car.downed || (car === p && this.ownDriverDead)) continue;
      const mine = car === p, sees = mine ? DODGE.sees[lv] : DODGE.rival * (D.skill || 0.8) * (car.isBoss ? 2 : 1), react = mine ? DODGE.react[lv] : 0.38;
      // Rockets: where it passes closest, and when.
      for (const pr of this.projectiles) {
        if (pr.dead || pr.type !== 'rocket' || pr.owner === car || (pr.seen && pr.seen.has(car))) continue;
        const rx = pr.x - car.x, ry = pr.y - car.y, vx = pr.vx - car.vx, vy = pr.vy - car.vy, vv = vx * vx + vy * vy;
        if (vv < 1) continue;
        const tc = -(rx * vx + ry * vy) / vv;
        if (tc < 0 || tc > DODGE.look) continue;
        const homing = pr.target === car, cx = car.x + rx + vx * tc, cy = car.y + ry + vy * tc;
        if (!homing && Math.hypot(cx - car.x, cy - car.y) > DODGE.miss) continue;
        if (homing && (!mine || tc > DODGE.lock)) continue; // (rivals don't bother; yours calls it when it's close)
        (pr.seen || (pr.seen = new Set())).add(car);
        if (this.rng() > sees) continue; // never saw it
        // Away from the side it's passing on; dead on: towards the roomier side of the road.
        const s = sideOf(car, cx, cy), side = Math.abs(s) > 6 ? (s > 0 ? -1 : 1) : (D.lane > 0 ? -1 : 1);
        this.dodgeQ.push({ t: react, car, D, side, why: homing ? 'lock' : 'rocket', brake: 0.8 });
      }
      // Mines on the line ahead.
      const f = [Math.cos(car.heading), Math.sin(car.heading)], ahead = Math.max(120, car.speed * DODGE.mineAhead);
      for (const m of this.mines) {
        if (m.dead || m.owner === car || (m.seen && m.seen.has(car))) continue;
        const fwd = (m.x - car.x) * f[0] + (m.y - car.y) * f[1];
        if (fwd < 15 || fwd > ahead) continue;
        if (Math.abs(sideOf(car, m.x, m.y)) > DODGE.mineWidth * 3) continue;
        // Where it sits across the road (measured off the road at the mine, not off a straight line ahead, which a
        // bend leaves behind), and a lane that clears it on whichever side has room (lane + is the car's right).
        const tr = this.race.track, hw = tr.hw;
        // (where they'll be: partway from where the car is to the lane they're steering for)
        const mineLane = trackQuery(tr, m.x, m.y, (car.idx + Math.round(fwd / tr.step)) % tr.N, 12).lat / hw, carLane = 0.35 * car.lat / hw + 0.65 * D.lane, need = (DODGE.mineWidth + 22) / hw;
        if (Math.abs(carLane - mineLane) > DODGE.mineWidth / hw) continue; // the line they're on takes them clear of it anyway
        (m.seen || (m.seen = new Set())).add(car);
        if (this.rng() > (mine ? Math.min(1, sees + 0.15) : sees)) continue;
        const opts = [mineLane + need, mineLane - need].filter((l) => Math.abs(l) <= 0.85).sort((a, b) => Math.abs(a - carLane) - Math.abs(b - carLane));
        const lane = opts.length ? opts[0] : (mineLane > 0 ? mineLane - need : mineLane + need);
        this.dodgeQ.push({ t: react, car, D, side: lane > carLane ? 1 : -1, lane, hold: Math.min(1.4, fwd / Math.max(car.speed, 100) + 0.35), why: 'mine' });
      }
    }
  },

  // The swerve itself, once they've reacted.
  doDodge(q) {
    if (q.car.finished || q.car.wrecked || (q.car === this.player && this.ownDriverDead)) return;
    if (q.why === 'lock') { if (!this.hatchDown) { this.radio(['"It\'s locked on us! Hatch!"', '"Homer on our tail! Get down!"', '"Can\'t shake that one! Hatch!"']); this.yellCd = 2.5; } return; }
    if (q.lane != null && q.D.dodgeTo) q.D.dodgeTo(q.lane, q.hold); else q.D.swerve(q.side, q.hold || DODGE.hold);
    if (q.D.jink) q.D.jink(q.side, q.why === 'mine' ? 0.3 : DODGE.jink, q.brake);
    if (q.car !== this.player) return;
    this.events.push({ type: 'swerve' });
    this.stats.dodges = (this.stats.dodges || 0) + 1;
    if ((this.yellCd || 0) <= 0 && this.rng() < 0.5) {
      this.radio(q.why === 'mine' ? ['"Mine!"', '"Seen it!"', '"Hold on!"'] : ['"Hold on!"', '"Incoming!"', '"Not today!"']);
      this.yellCd = 2.5;
    }
  },
});
