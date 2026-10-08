'use strict';
// Car state, arcade physics and drawing.

const CAR_LEN = 36;
const CAR_WID = 18;
const CAR_RADIUS = 13;

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
    if (this.offroad) top *= 1 - (1 - this.offroadTop) * s.offroadMul;
    if (this.nitroOn) { top *= 1 + 0.25 * s.nitroPower; acc *= 1 + 0.9 * s.nitroPower; }
    if (this.boostT > 0) { top *= 1.3; acc *= 2.4; this.boostT -= dt; }
    if (this.launchT > 0) { top *= 1.15; acc *= 2.2; this.launchT -= dt; }
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

    // Steering: needs speed to turn; slightly less authority at top speed.
    const sf = clamp(vF / 130, -1, 1);
    const hi = 1 - 0.28 * clamp(Math.abs(vF) / s.top, 0, 1);
    let turn = inp.steer * s.handling * sf * hi;
    if (inp.handbrake) turn *= 1.35;
    if (this.spinT > 0) { turn += this.spinDir * 3.5; this.spinT -= dt; }
    this.heading += turn * dt;

    // Lateral grip: bleed sideways velocity; some converts to forward momentum.
    let g = s.grip * gripMul;
    if (inp.handbrake) { g *= 0.22; vF -= vF * 0.6 * dt; }
    if (this.oilT > 0) { g *= 0.15; this.oilT -= dt; }
    if (this.offroad) g *= 0.8;
    const keep = Math.exp(-g * dt);
    const lost = vR * (1 - keep);
    vR *= keep;
    vF += Math.abs(lost) * 0.3 * Math.sign(vF);

    const speed = Math.hypot(vF, vR);
    this.slip = Math.abs(vR);
    this.drifting = this.slip > 85 && speed > 140;
    this.braking = inp.brake > 0 && vF > 120;

    this.vx = fx * vF - fy * vR;
    this.vy = fy * vF + fx * vR;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
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
    ctx.fillStyle = this.hitFlash > 0 && Math.floor(t * 30) % 2 ? '#fff' : this.color;
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
