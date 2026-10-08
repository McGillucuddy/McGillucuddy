'use strict';
// AI driver: follows a racing line, brakes for corners, dodges traffic.

const AI_NAMES = [
  'Rex Torque', 'Mila Vance', 'Dusty Reyes', 'Kenji Hollow', 'Bo Static', 'Ivy Lancer',
  'Sal Grimes', 'Nova Pike', 'Ozzy Crank', 'Tess Burnout', 'Viktor Lug', 'Luz Ferro',
  'Hank Piston', 'Wren Apex', 'Juno Skid', 'Cass Diesel', 'Pip Camber', 'Rook Valve',
];
const AI_COLORS = [
  '#2ec4b6', '#ff9f1c', '#8ac926', '#1982c4', '#ff595e', '#c77dff',
  '#f15bb5', '#00bbf9', '#fee440', '#9ef01a', '#ffffff', '#ff7b00',
];

function aiStats(skill, biomeGrip) {
  return {
    top: 560 * skill,
    accel: 330 * (0.85 + 0.15 * skill),
    handling: 2.7,
    grip: 9.5,
    nitroCap: 100,
    nitroPower: 1,
    nitroRegen: 4,
    maxHp: 100,
    mass: 1,
    offroadMul: 1,
    // Cornering confidence: how hard this driver commits to a turn.
    aLat: (1050 + 650 * (skill - 0.8)) * Math.sqrt(biomeGrip),
  };
}

class AIDriver {
  constructor(car, skill, rng) {
    this.car = car;
    this.skill = skill;
    this.rng = rng;
    this.lane = randRange(rng, -0.3, 0.3);
    this.laneTarget = this.lane;
    this.laneTimer = randRange(rng, 1, 4);
    this.stuckT = 0;
    this.nitroHold = 0;
    this.wobble = 0;
    this.wobblePhase = rng() * 10;
  }

  // Max safe speed at sample j for this driver.
  vmax(track, j) {
    const c = Math.abs(track.curv[j % track.N]);
    if (c < 1e-5) return 1e4;
    return Math.sqrt(this.car.stats.aLat / c);
  }

  update(race, dt) {
    const car = this.car, tr = race.track, N = tr.N;
    const speed = car.speed;
    const i = car.idx;

    // Lane choice: slow drift + inside line through corners + traffic avoidance.
    this.laneTimer -= dt;
    if (this.laneTimer <= 0) {
      this.laneTimer = randRange(this.rng, 1.5, 4);
      this.laneTarget = randRange(this.rng, -0.35, 0.35);
    }
    const ahead = Math.round((60 + speed * 0.45) / tr.step);
    let curvAhead = 0;
    for (let k = ahead; k < ahead + 20; k++) curvAhead += tr.curv[(i + k) % N];
    curvAhead /= 20;
    const inside = clamp(curvAhead * 110, -1, 1) * 0.5;

    let avoid = 0;
    for (const o of race.cars) {
      if (o === car || o.finished) continue;
      const dx = o.x - car.x, dy = o.y - car.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 140 * 140) continue;
      const fwd = dx * Math.cos(car.heading) + dy * Math.sin(car.heading);
      if (fwd < 0) continue;
      const side = o.lat - car.lat;
      if (Math.abs(side) < 30) avoid += (side > 0 ? -1 : 1) * (1 - Math.sqrt(d2) / 140);
    }
    const lane = clamp(this.laneTarget + inside + avoid * 0.6, -0.7, 0.7);
    this.lane += (lane - this.lane) * Math.min(1, dt * 2.5);

    const j = (i + ahead) % N;
    const lat = this.lane * tr.hw;
    const tx = tr.pts[j].x + tr.nx[j] * lat, ty = tr.pts[j].y + tr.ny[j] * lat;
    this.wobblePhase += dt * 1.7;
    const noise = Math.sin(this.wobblePhase) * (1.05 - this.skill) * 0.25;
    const err = wrapAngle(Math.atan2(ty - car.y, tx - car.x) - car.heading) + noise;
    const steer = clamp(err * 2.8, -1, 1);

    // Speed: lowest of (corner speed + braking distance) over the next ~700px.
    const B = 520;
    let target = car.curTop || car.stats.top;
    for (let m = 1; m < 70; m++) {
      const v = this.vmax(tr, i + m);
      const allow = Math.sqrt(v * v + 2 * B * m * tr.step);
      if (allow < target) target = allow;
    }
    let throttle = 1, brake = 0;
    if (speed > target + 25) { throttle = 0; brake = clamp((speed - target) / 120, 0.2, 1); }
    else if (speed > target) throttle = 0.3;
    if (car.offroad) throttle = Math.max(throttle, 0.6);

    // Nitro on long straights.
    let nitro = false;
    if (this.nitroHold > 0) { this.nitroHold -= dt; nitro = target > car.stats.top * 1.15; }
    else if (car.nitro > 60 && target > car.stats.top * 1.3 && this.rng() < dt * 0.6 * this.skill) {
      this.nitroHold = randRange(this.rng, 1, 2.5);
    }

    // Unstick: reverse briefly, then reset onto the track if still stuck.
    if (speed < 40 && race.state === 'racing') this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 1.2 && this.stuckT < 2.2) {
      return { throttle: 0, brake: 1, steer: -steer, handbrake: false, nitro: false };
    }
    if (this.stuckT >= 3) { race.respawn(car); this.stuckT = 0; }

    return { throttle, brake, steer, handbrake: false, nitro };
  }
}
