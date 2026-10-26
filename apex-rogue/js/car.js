'use strict';
// Car state, arcade physics and drawing.

const CAR_LEN = 36;
const CAR_WID = 18;
const CAR_RADIUS = 13;
// Jumps (ramps, blasts). The world's scale is about 0.13m a unit (the car's 36 long), so real gravity would be ~75;
// this is game gravity, heavy enough to land with a thump but light enough for real air time off a ramp.
const JUMP = {
  g: 320, // gravity, units/s^2
  launch: 1.4, // how hard the ramp's lip throws you up (times the climb the slope gives)
  tip: 1.1, // how far the nose tips over in the air (times the ramp's angle): the rear wheels leave last
  steerRoll: 0.35, // roll rate from turning the wheel as you leave
  airSteer: 0.15, // the wheels turned in the air barely move the car
  bounce: 0.22, // a hard landing hops back up this much of its speed
  bounceMin: 150,
  squash: 0.06, // the suspension giving on landing (body drop per unit of impact)
};
const GRAVITY = JUMP.g;

class Car {
  constructor(opts) {
    this.name = opts.name;
    this.color = opts.color;
    this.accent = opts.accent || '#fff';
    this.isPlayer = !!opts.isPlayer;
    this.isBoss = !!opts.isBoss;
    this.stats = opts.stats;
    this.perks = new Set(opts.perks || []);
    this.hp = opts.hp != null ? opts.hp : this.stats.maxHp;
    this.nitro = opts.nitro != null ? opts.nitro : this.stats.nitroCap * 0.5;
    this.x = 0; this.y = 0; this.heading = 0;
    this.vx = 0; this.vy = 0;
    this.idx = 0; this.progress = 0; this.lat = 0;
    this.finished = false; this.finishTime = 0;
    this.boostT = 0; this.oilT = 0; this.spinT = 0; this.spinDir = 1;
    this.launchT = 0; this.wheelspinT = 0; this.draftT = 0;
    this.offroad = false; this.nitroOn = false; this.drifting = false;
    this.hitFlash = 0; this.place = 0; this.lapsDone = 0;
    this.wallHits = 0; this.input = null;
    this.lastWheels = null;
    // Height off the ground (ramps, jumps) and the body's pitch and roll on its springs (the 3D view shows them).
    this.z = 0; this.vz = 0; this.air = false; this.airT = 0; this.landImpact = 0;
    this.pitch = 0; this.vpitch = 0; this.roll = 0; this.vroll = 0;
    // The body's attitude off the ground: jp pitch (+ nose down), jr roll, free in the air and on stiff springs
    // on the ground (the ramp's slope, the bounce after a landing), and sq the suspension squashed (body drop).
    this.jp = 0; this.vjp = 0; this.jr = 0; this.vjr = 0; this.sq = 0; this.vsq = 0; this.groundPitch = 0;
  }

  get speed() { return Math.hypot(this.vx, this.vy); }
  get forwardSpeed() { return this.vx * Math.cos(this.heading) + this.vy * Math.sin(this.heading); }
  get limp() { return this.hp <= 0; }

  placeAt(x, y, heading) {
    this.x = x; this.y = y; this.heading = heading;
    this.vx = 0; this.vy = 0;
  }

  // inp: {throttle, brake, steer, handbrake, nitro}
  step(inp, dt, gripMul) {
    const s = this.stats;
    if (this.air) { this.stepAir(inp, dt); return; }
    this.settleBody(dt);
    const fx = Math.cos(this.heading), fy = Math.sin(this.heading);
    let vF = this.vx * fx + this.vy * fy;
    let vR = -this.vx * fy + this.vy * fx;

    this.nitroOn = false;
    if (inp.nitro && this.nitro > 0 && inp.throttle > 0 && !this.limp) {
      this.nitroOn = true;
      this.nitro = Math.max(0, this.nitro - 32 * dt);
    } else {
      this.nitro = Math.min(s.nitroCap, this.nitro + s.nitroRegen * dt);
    }

    let top = s.top, acc = s.accel;
    if (this.limp) { top *= 0.6; acc *= 0.6; }
    if (this.flats) { const k = this.flatK || 1; top *= 1 - 0.13 * this.flats * k; acc *= 1 - 0.12 * this.flats * k; } // flat tyres
    if (this.offroad) top *= 1 - (1 - this.offroadTop) * s.offroadMul;
    if (this.nitroOn) { top *= 1 + 0.25 * s.nitroPower; acc *= 1 + 0.9 * s.nitroPower; }
    if (this.boostT > 0) { top *= 1.3; acc *= 2.4; this.boostT -= dt; }
    if (this.launchT > 0) { top *= 1.1; acc *= 1.6; this.launchT -= dt; }
    if (this.draftT > 0) { top *= 1.08; this.draftT -= dt; }
    if (this.wheelspinT > 0) { acc *= 0.25; this.wheelspinT -= dt; }
    if (this.rubber) top *= this.rubber;
    this.curTop = top;

    if (inp.throttle > 0) {
      if (vF < 0) vF += 900 * inp.throttle * dt;
      else if (vF < top) vF = Math.min(top, vF + acc * inp.throttle * (1 - 0.65 * (vF / top)) * dt);
    }
    if (inp.brake > 0) {
      if (vF > 15) vF = Math.max(0, vF - 850 * inp.brake * dt);
      else vF = Math.max(-top * 0.35, vF - 300 * inp.brake * dt);
    }
    if (!(inp.throttle > 0) && !(inp.brake > 0)) {
      vF -= Math.sign(vF) * Math.min(Math.abs(vF), 120 * dt);
    }
    if (vF > top) vF = Math.max(top, vF - 380 * dt);
    if (this.offroad) vF -= vF * this.offroadDrag * s.offroadMul * dt;

    // Steering: needs speed to turn; slightly less authority at top speed. Weight transfer: braking loads the
    // front tyres for a sharper turn-in, hard throttle lightens them.
    const sf = clamp(vF / (s.steerV || 130), -1, 1); // (steerV comes down with the game speed, so the tightest turn stays as tight)
    const hi = 1 - 0.28 * clamp(Math.abs(vF) / s.top, 0, 1);
    const load = 1 + 0.16 * (inp.brake || 0) * clamp(vF / 200, 0, 1) - 0.08 * (inp.throttle || 0) * clamp(vF / s.top, 0, 1);
    let turn = inp.steer * s.handling * sf * hi * load;
    if (inp.handbrake) turn *= 1.35;
    if (this.spinT > 0) { turn += this.spinDir * 3.5; this.spinT -= dt; }
    if (this.flatPull) turn += this.flatPull * (this.flatK || 1) * clamp(Math.abs(vF) / 300, 0, 1); // a flat drags the car to its side
    this.heading += turn * dt;

    // Lateral grip: bleed sideways velocity; some converts to forward momentum.
    let g = s.grip * gripMul;
    if (inp.handbrake) { g *= 0.22; vF -= vF * 0.6 * dt; }
    if (this.oilT > 0) { g *= 0.15; this.oilT -= dt; }
    if (this.flats) g *= 1 - 0.14 * this.flats * (this.flatK || 1);
    if (this.offroad) g *= 0.8;
    const keep = Math.exp(-g * dt);
    const lost = vR * (1 - keep);
    vR *= keep;
    vF += Math.abs(lost) * 0.3 * Math.sign(vF);

    const speed = Math.hypot(vF, vR);
    this.slip = Math.abs(vR);
    this.drifting = this.slip > 85 && speed > 140;
    this.braking = inp.brake > 0 && vF > 120;

    // Body on its springs: the nose dips under braking and lifts under power, the body leans out of a turn.
    const vF0 = this.vx * fx + this.vy * fy, aF = dt > 0 ? (vF - vF0) / dt : 0, aLat = vF * turn;
    this.springBody(dt, clamp(-aF * 0.00011, -0.07, 0.07), clamp(aLat * 0.00009, -0.09, 0.09));

    this.vx = fx * vF - fy * vR;
    this.vy = fy * vF + fx * vR;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  // Pitch (+ = nose down) and roll follow their targets on damped springs, with a little overshoot.
  springBody(dt, pT, rT) {
    const k = 90, c = 11;
    this.vpitch += ((pT - this.pitch) * k - this.vpitch * c) * dt;
    this.pitch += this.vpitch * dt;
    this.vroll += ((rT - this.roll) * k - this.vroll * c) * dt;
    this.roll += this.vroll * dt;
  }

  // On the ground, the jump attitude springs back to the road (or the ramp's slope) with a bounce, and the
  // suspension recovers from a landing.
  settleBody(dt) {
    const k = 160, c = 15;
    this.vjp += ((this.groundPitch - this.jp) * k - this.vjp * c) * dt; this.jp += this.vjp * dt;
    this.vjr += (-this.jr * k - this.vjr * c) * dt; this.jr += this.vjr * dt;
    this.vsq += (-this.sq * 220 - this.vsq * 17) * dt; this.sq += this.vsq * dt;
  }

  // Leaving the ground (a ramp's lip, a blast): up at vz, the body turning as it goes (pitch rate vp, roll rate vr).
  // set: the turning it leaves with replaces whatever the springs were doing (off a ramp's lip), else adds to it (a blast).
  launch(vz, vp, vr, set) {
    this.air = true; this.airT = 0; this.vz = vz; this.z = Math.max(this.z, 0.5);
    if (set) { this.vjp = vp; this.vjr = vr; } else { this.vjp += vp; this.vjr += vr; }
  }

  // In the air: no grip and no throttle, barely any steering, gravity. The body keeps turning the way it left
  // (the nose tips over), and how it meets the ground decides the landing: square, it squats and bounces; nose
  // or tail first, or tipped over, it slams, bounces harder, and scrubs more speed (and does more damage).
  stepAir(inp, dt) {
    this.airT += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const drag = 1 - 0.04 * dt;
    this.vx *= drag; this.vy *= drag;
    this.heading += (inp.steer || 0) * JUMP.airSteer * dt;
    this.vz -= JUMP.g * dt;
    this.z += this.vz * dt;
    this.jp += this.vjp * dt; this.vjp *= 1 - 0.25 * dt;
    this.jr += this.vjr * dt; this.vjr *= 1 - 0.25 * dt;
    this.vsq += (-this.sq * 220 - this.vsq * 17) * dt; this.sq += this.vsq * dt;
    this.springBody(dt, 0, this.roll * 0.5);
    this.nitro = Math.min(this.stats.nitroCap, this.nitro + this.stats.nitroRegen * dt);
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.z <= 0) {
      const down = -this.vz, bad = Math.max(0, Math.abs(this.jp) - 0.12) * 3 + Math.max(0, Math.abs(this.jr) - 0.15) * 2.5; // off square
      this.landImpact = down * (1 + bad);
      this.z = 0; this.groundPitch = 0;
      // The end that hits first slams the other down: the body rocks over onto its wheels.
      this.vjp += -this.jp * 6 + down * 0.002; // (and the front dips as the springs take it)
      this.vjr += -this.jr * 6;
      this.vsq -= this.landImpact * JUMP.squash * 14;
      const keep = 1 - Math.min(0.3, this.landImpact / 3000 + bad * 0.06); // a hard or crooked landing scrubs speed
      this.vx *= keep; this.vy *= keep;
      if (down > JUMP.bounceMin) { this.vz = down * JUMP.bounce * (1 + bad * 0.5); this.z = 0.5; this.vjp *= 0.6; } // back up off the springs
      else { this.vz = 0; this.air = false; }
    }
  }

  wheelPositions() {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    const bx = -CAR_LEN * 0.32, oy = CAR_WID * 0.42;
    return [
      { x: this.x + c * bx - s * -oy, y: this.y + s * bx + c * -oy },
      { x: this.x + c * bx - s * oy, y: this.y + s * bx + c * oy },
    ];
  }

  draw(ctx, t) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.heading);
    const L = CAR_LEN, W = CAR_WID;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -L / 2 + 3, -W / 2 + 4, L, W, 6);
    ctx.fill();

    // Nitro / boost flame
    if (this.nitroOn || this.boostT > 0 || this.launchT > 0) {
      const fl = 10 + Math.sin(t * 60) * 4 + (this.nitroOn ? 8 : 0);
      ctx.fillStyle = this.nitroOn ? '#5ad8ff' : '#ffb13b';
      ctx.beginPath();
      ctx.moveTo(-L / 2, -4); ctx.lineTo(-L / 2 - fl, 0); ctx.lineTo(-L / 2, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(-L / 2, -2); ctx.lineTo(-L / 2 - fl * 0.5, 0); ctx.lineTo(-L / 2, 2);
      ctx.fill();
    }

    // Wheels
    ctx.fillStyle = '#111';
    ctx.fillRect(L * 0.18, -W / 2 - 2, 9, 5);
    ctx.fillRect(L * 0.18, W / 2 - 3, 9, 5);
    ctx.fillRect(-L * 0.38, -W / 2 - 2, 9, 5);
    ctx.fillRect(-L * 0.38, W / 2 - 3, 9, 5);

    // Body
    ctx.fillStyle = this.color;
    roundRect(ctx, -L / 2, -W / 2, L, W, 6);
    ctx.fill();
    // Stripe
    ctx.fillStyle = this.accent;
    ctx.fillRect(-L / 2 + 2, -2, L - 4, 4);
    // Cockpit
    ctx.fillStyle = 'rgba(20,30,45,0.9)';
    roundRect(ctx, -L * 0.12, -W / 2 + 3, L * 0.32, W - 6, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,255,0.5)';
    ctx.fillRect(L * 0.08, -W / 2 + 4, 3, W - 8);
    // Spoiler
    ctx.fillStyle = this.accent;
    ctx.fillRect(-L / 2 - 1, -W / 2, 4, W);
    // Headlights
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(L / 2 - 3, -W / 2 + 2, 3, 4);
    ctx.fillRect(L / 2 - 3, W / 2 - 6, 3, 4);
    // Brake lights
    if (this.braking) {
      ctx.fillStyle = '#ff2020';
      ctx.fillRect(-L / 2 + 3, -W / 2 + 1, 3, 4);
      ctx.fillRect(-L / 2 + 3, W / 2 - 5, 3, 4);
    }
    if (this.weapon) {
      // Roof-mounted launcher / mine dropper so armed rivals are readable.
      ctx.fillStyle = '#222';
      ctx.fillRect(-8, -4, 16, 8);
      ctx.fillStyle = this.weapon === 'rocket' ? '#ff5a3c' : '#ffd23f';
      if (this.weapon === 'rocket') ctx.fillRect(-4, -2.5, 16, 5);
      else ctx.fillRect(-14, -3, 6, 6);
    }
    if (this.isBoss) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(-6, -4); ctx.lineTo(-3, 0); ctx.lineTo(0, -4); ctx.lineTo(3, 0); ctx.lineTo(6, -4);
      ctx.lineTo(6, 4); ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
