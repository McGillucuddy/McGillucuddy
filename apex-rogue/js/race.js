'use strict';
// A single race: cars, collisions, laps, positions, effects and rendering.

class Race {
  // cfg: { track, laps, playerCar, opponents:[{name,color,skill,isBoss}], rng, qualify, headless }
  constructor(cfg) {
    this.cfg = cfg;
    this.track = cfg.track;
    this.laps = cfg.laps;
    this.qualify = cfg.qualify;
    this.rng = cfg.rng;
    this.time = 0;
    this.state = 'countdown';
    this.countdown = 3.6;
    this.cars = [];
    this.particles = [];
    this.messages = [];
    this.finishOrder = [];
    this.overtakes = 0;
    this.overtakeCash = 0;
    this.events = []; // for audio: {type, ...}
    this.endTimer = 0;
    this.throttleHeldEarly = false;
    this.launchArmed = true;

    const bio = this.track.biome;
    const all = [];
    for (const o of cfg.opponents) {
      const car = new Car({
        name: o.name, color: o.color, accent: o.accent || '#222', isBoss: o.isBoss,
        stats: aiStats(o.skill, bio.grip),
      });
      car.ai = new AIDriver(car, o.skill, this.rng);
      all.push(car);
    }
    // Player starts towards the back of the grid; worse grid in later races.
    const playerSlot = Math.min(all.length, cfg.playerGrid != null ? cfg.playerGrid : all.length);
    all.splice(playerSlot, 0, cfg.playerCar);
    this.player = cfg.playerCar;

    all.forEach((car, g) => {
      const slot = gridSlot(this.track, g);
      car.placeAt(slot.x, slot.y, slot.ang);
      car.offroadTop = bio.offroadTop;
      car.offroadDrag = bio.offroadDrag;
      const q = trackQuery(this.track, car.x, car.y, slot.idx, 4);
      car.idx = q.idx;
      car.steps = q.idx - this.track.N;
      car.progress = car.steps + q.frac;
      car.place = g + 1;
      this.cars.push(car);
    });
    if (this.player.perks.has('rocketstart')) this.player.nitro = this.player.stats.nitroCap;
    this.rankCars();
  }

  get playerPlace() { return this.player.place; }

  message(text, color, big) {
    this.messages.push({ text, color: color || '#fff', t: 0, life: big ? 2.2 : 1.6, big });
  }

  respawn(car) {
    const tr = this.track;
    const q = trackQuery(tr, car.x, car.y, car.idx, 40);
    const i = q.idx;
    car.placeAt(tr.pts[i].x + tr.nx[i] * clamp(q.lat, -tr.hw * 0.5, tr.hw * 0.5),
      tr.pts[i].y + tr.ny[i] * clamp(q.lat, -tr.hw * 0.5, tr.hw * 0.5), tr.ang[i]);
    car.spinT = 0; car.oilT = 0;
  }

  rankCars() {
    const sorted = this.cars.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((c, k) => { c.place = k + 1; });
    this.ranking = sorted;
  }

  update(dt, playerInput) {
    this.events.length = 0;
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before && after > 0) this.events.push({ type: 'beep', hi: false });
      // Launch timing: throttle held too early = wheelspin; pressed late in the count = rocket launch.
      const win = this.player.perks.has('rocketstart') ? 0.55 : 0.3;
      if (playerInput.throttle > 0 && this.countdown > win) this.throttleHeldEarly = true;
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.events.push({ type: 'beep', hi: true });
        this.message('GO!', '#7CFC00', true);
        if (playerInput.throttle > 0) {
          if (this.throttleHeldEarly) {
            this.player.wheelspinT = 0.8;
            this.message('Wheelspin!', '#ff6b6b');
          } else {
            this.player.launchT = this.player.perks.has('rocketstart') ? 2.2 : 1.1;
            this.message('Perfect launch!', '#ffd23f');
            this.events.push({ type: 'boost' });
          }
        }
        for (const c of this.cars) {
          if (c.ai && this.rng() < 0.5 * c.ai.skill) c.launchT = 0.6;
        }
      }
      return;
    }

    this.time += dt;
    const tr = this.track;
    const bio = tr.biome;

    for (const car of this.cars) {
      let inp;
      if (car === this.player && !car.finished) inp = playerInput;
      else if (car.ai) inp = car.ai.update(this, dt);
      else {
        // Player car after finishing: hand it to an autopilot.
        if (!car.autopilot) car.autopilot = new AIDriver(car, 0.85, this.rng);
        car.stats.aLat = car.stats.aLat || 1000;
        inp = car.autopilot.update(this, dt);
        inp.throttle *= 0.6;
      }
      car.input = inp;
      car.step(inp, dt, bio.grip);
    }

    this.collideCars();

    for (const car of this.cars) this.trackInteraction(car, dt);

    // Slipstream perk.
    const p = this.player;
    if (p.perks.has('slipstream') && !p.finished) {
      for (const o of this.cars) {
        if (o === p) continue;
        const dx = o.x - p.x, dy = o.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 170 && d > 30) {
          const fwd = (dx * Math.cos(p.heading) + dy * Math.sin(p.heading)) / d;
          if (fwd > 0.92 && p.speed > 250) {
            p.draftT = 0.3;
            p.nitro = Math.min(p.stats.nitroCap, p.nitro + 10 * dt);
          }
        }
      }
    }
    if (p.perks.has('driftking') && p.drifting) p.nitro = Math.min(p.stats.nitroCap, p.nitro + 20 * dt);

    const prevPlace = p.place;
    this.rankCars();
    this.rubberBand();
    if (!p.finished && this.time > 2) {
      if (p.place < prevPlace) {
        this.overtakes += prevPlace - p.place;
        if (p.perks.has('overtaker')) {
          this.overtakeCash += 20 * (prevPlace - p.place);
          p.nitro = Math.min(p.stats.nitroCap, p.nitro + 15);
          this.message('Overtake! +$20', '#7CFC00');
        }
      } else if (p.place > prevPlace && p.perks.has('slingshot')) {
        p.boostT = Math.max(p.boostT, 1.0);
        this.message('Slingshot!', '#5ad8ff');
      }
    }

    this.updateEffects(dt);
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter((m) => m.t < m.life);

    if (p.finished) {
      this.endTimer += dt;
      if (this.endTimer > 3 || this.finishOrder.length === this.cars.length) this.state = 'done';
    }
    if (this.time > 600) this.state = 'done'; // safety net
  }

  rubberBand() {
    // Mild catch-up so the pack stays together without feeling unfair.
    const p = this.player;
    for (const c of this.cars) {
      if (!c.ai) continue;
      const gap = (c.progress - p.progress) * this.track.step; // + means AI ahead
      c.rubber = 1 + clamp(-gap / 4000, -0.05, 0.06);
    }
  }

  trackInteraction(car, dt) {
    const tr = this.track;
    const q = trackQuery(tr, car.x, car.y, car.idx, 25);
    let delta = q.idx - car.idx;
    if (delta > tr.N / 2) delta -= tr.N;
    if (delta < -tr.N / 2) delta += tr.N;
    const oldLap = Math.floor(car.progress / tr.N);
    car.idx = q.idx;
    car.steps += delta; // whole samples travelled since the grid (negative behind the line)
    car.progress = car.steps + q.frac;
    car.lat = q.lat;

    const newLap = Math.floor(car.progress / tr.N);
    if (newLap > oldLap && newLap >= 1 && !car.finished) {
      car.lapsDone = newLap;
      if (newLap >= this.laps) {
        car.finished = true;
        car.finishTime = this.time;
        this.finishOrder.push(car);
        if (car === this.player) {
          this.events.push({ type: 'finish' });
          this.message(`Finished ${ordinal(this.finishOrder.length)}!`, '#ffd23f', true);
        }
      } else if (car === this.player) {
        this.message(newLap === this.laps - 1 ? 'Final lap!' : `Lap ${newLap + 1}/${this.laps}`, '#fff', true);
        if (car.perks.has('pitcrew') && car.hp < car.stats.maxHp) {
          car.hp = Math.min(car.stats.maxHp, car.hp + 15);
          this.message('Pit crew: +15 HP', '#7CFC00');
        }
      }
    }

    const absLat = Math.abs(q.lat);
    car.offroad = absLat > tr.hw + 4;
    const limit = tr.hw + tr.runoff - CAR_RADIUS + 4;
    if (absLat > limit) {
      const i = q.idx, sgn = Math.sign(q.lat);
      const nx = tr.nx[i] * sgn, ny = tr.ny[i] * sgn; // outward normal
      const push = absLat - limit;
      car.x -= nx * push;
      car.y -= ny * push;
      const vn = car.vx * nx + car.vy * ny;
      if (vn > 0) {
        const bumpers = car.perks.has('bumpers');
        car.vx -= nx * vn * 1.3;
        car.vy -= ny * vn * 1.3;
        const keep = bumpers ? 0.97 : 0.88;
        car.vx *= keep;
        car.vy *= keep;
        if (vn > 70) {
          const dmg = bumpers ? 0 : (vn - 70) * 0.05;
          this.damage(car, dmg);
          car.wallHits++;
          this.spark(car.x + nx * CAR_RADIUS, car.y + ny * CAR_RADIUS, vn);
          if (car === this.player) this.events.push({ type: 'hit', power: vn });
        }
      }
    }

    // Hazards
    for (const h of tr.hazards) {
      const d2 = (h.x - car.x) ** 2 + (h.y - car.y) ** 2;
      if (d2 > h.r * h.r) continue;
      if (h.type === 'boost') {
        const junkie = car.perks.has('boostjunkie');
        if (car.boostT <= 0.1 && car === this.player) {
          this.events.push({ type: 'boost' });
          if (junkie) car.nitro = Math.min(car.stats.nitroCap, car.nitro + 30);
        }
        car.boostT = junkie ? 2.0 : 1.0;
      } else if (h.type === 'oil' && car.oilT <= 0) {
        car.oilT = 0.9;
        car.spinT = 0.35;
        car.spinDir = this.rng() < 0.5 ? -1 : 1;
        if (car === this.player) this.message('Oil!', '#ccc');
      }
    }
  }

  damage(car, amount) {
    if (amount <= 0) return;
    const wasAlive = car.hp > 0;
    car.hp = Math.max(0, car.hp - amount);
    car.hitFlash = 0.25;
    if (wasAlive && car.hp <= 0 && car === this.player) this.message('Engine wrecked! Limp mode', '#ff4040', true);
  }

  collideCars() {
    const cars = this.cars;
    const R2 = (CAR_RADIUS * 2) ** 2;
    for (let a = 0; a < cars.length; a++) {
      for (let b = a + 1; b < cars.length; b++) {
        const A = cars[a], B = cars[b];
        const ghost = (A.isPlayer && A.perks.has('ghost')) || (B.isPlayer && B.perks.has('ghost'));
        if (ghost) continue;
        const dx = B.x - A.x, dy = B.y - A.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R2 || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const overlap = CAR_RADIUS * 2 - d;
        const mA = A.stats.mass, mB = B.stats.mass;
        const tot = mA + mB;
        A.x -= nx * overlap * (mB / tot); A.y -= ny * overlap * (mB / tot);
        B.x += nx * overlap * (mA / tot); B.y += ny * overlap * (mA / tot);
        const rel = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
        if (rel <= 0) continue;
        const e = 0.4;
        let j = ((1 + e) * rel) / (1 / mA + 1 / mB);
        let shoveA = 1, shoveB = 1;
        if (A.isPlayer && A.perks.has('ramplates')) shoveB = 1.6;
        if (B.isPlayer && B.perks.has('ramplates')) shoveA = 1.6;
        A.vx -= (j / mA) * nx * shoveA; A.vy -= (j / mA) * ny * shoveA;
        B.vx += (j / mB) * nx * shoveB; B.vy += (j / mB) * ny * shoveB;
        if (rel > 90) {
          const base = (rel - 90) * 0.05;
          const dmgA = base * (mB / tot) * 2, dmgB = base * (mA / tot) * 2;
          const ramA = A.isPlayer && A.perks.has('ramplates');
          const ramB = B.isPlayer && B.perks.has('ramplates');
          this.damage(A, dmgA * (ramA ? 0.5 : 1) * (ramB ? 3 : 1));
          this.damage(B, dmgB * (ramB ? 0.5 : 1) * (ramA ? 3 : 1));
          this.spark((A.x + B.x) / 2, (A.y + B.y) / 2, rel);
          if (A.isPlayer || B.isPlayer) this.events.push({ type: 'hit', power: rel * 0.8 });
        }
      }
    }
  }

  // ---------- Effects ----------

  spark(x, y, power) {
    if (this.cfg.headless) return;
    const n = Math.min(14, 3 + power / 40);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, s = 80 + Math.random() * power;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35, t: 0, size: 2.5, color: '#ffd27a', type: 'spark' });
    }
  }

  updateEffects(dt) {
    if (this.cfg.headless) return;
    const tr = this.track;
    for (const car of this.cars) {
      const wheels = car.wheelPositions();
      const marking = (car.drifting || car.braking || car.spinT > 0) && !car.offroad;
      if (marking && car.lastWheels) {
        const ctx = tr.ctx;
        ctx.save();
        ctx.translate(-tr.bounds.minX, -tr.bounds.minY);
        ctx.strokeStyle = tr.biome.night ? 'rgba(0,0,0,0.35)' : 'rgba(20,20,20,0.28)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (let w = 0; w < 2; w++) {
          ctx.beginPath();
          ctx.moveTo(car.lastWheels[w].x, car.lastWheels[w].y);
          ctx.lineTo(wheels[w].x, wheels[w].y);
          ctx.stroke();
        }
        ctx.restore();
      }
      car.lastWheels = wheels;

      const sp = car.speed;
      if ((car.drifting || (car.offroad && sp > 120)) && Math.random() < 0.6) {
        const w = wheels[Math.random() < 0.5 ? 0 : 1];
        const col = car.offroad ? (tr.biomeKey === 'tundra' ? '#ffffff' : tr.biomeKey === 'desert' ? '#e8cf9b' : '#8a6b45') : '#d8d8d8';
        this.particles.push({ x: w.x, y: w.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 0.7, t: 0, size: 6 + Math.random() * 5, color: col, type: 'smoke' });
      }
      if (car.hp < car.stats.maxHp * 0.3 && Math.random() < (car.hp <= 0 ? 0.7 : 0.25)) {
        this.particles.push({ x: car.x, y: car.y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 1.1, t: 0, size: 7 + Math.random() * 6, color: car.hp <= 0 ? '#222' : '#777', type: 'smoke' });
      }
    }
    for (const pt of this.particles) {
      pt.t += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
    }
    this.particles = this.particles.filter((pt) => pt.t < pt.life);
    if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
  }

  // ---------- Rendering ----------

  render(ctx, cam, W, H, t) {
    const tr = this.track;
    const bio = tr.biome;
    ctx.fillStyle = bio.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    ctx.drawImage(tr.canvas, tr.bounds.minX, tr.bounds.minY);

    for (const h of tr.hazards) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.ang);
      if (h.type === 'boost') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        roundRect(ctx, -h.r, -h.r * 0.8, h.r * 2, h.r * 1.6, 6);
        ctx.fill();
        for (let k = 0; k < 3; k++) {
          const ph = (t * 2 + k / 3) % 1;
          ctx.strokeStyle = `rgba(90,216,255,${0.35 + 0.65 * (1 - ph)})`;
          ctx.lineWidth = 5;
          const x0 = -h.r * 0.7 + k * 12;
          ctx.beginPath();
          ctx.moveTo(x0, -h.r * 0.55); ctx.lineTo(x0 + 10, 0); ctx.lineTo(x0, h.r * 0.55);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = 'rgba(10,10,15,0.85)';
        ctx.beginPath();
        ctx.ellipse(0, 0, h.r, h.r * 0.7, 0.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(120,80,200,0.25)';
        ctx.beginPath();
        ctx.ellipse(-6, -4, h.r * 0.5, h.r * 0.3, 0.4, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const pt of this.particles) {
      if (pt.type !== 'smoke') continue;
      const k = pt.t / pt.life;
      ctx.globalAlpha = 0.45 * (1 - k);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1 + k * 1.5), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const car of this.cars) car.draw(ctx, t);

    for (const pt of this.particles) {
      if (pt.type !== 'spark') continue;
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = 1 - pt.t / pt.life;
      ctx.fillRect(pt.x - 1.5, pt.y - 1.5, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    if (this.onRenderWorld) this.onRenderWorld(ctx, t);

    // Name tags
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const car of this.cars) {
      if (car === this.player) continue;
      const d = Math.hypot(car.x - this.player.x, car.y - this.player.y);
      if (d > 600) continue;
      ctx.fillStyle = car.isBoss ? '#ffd23f' : 'rgba(255,255,255,0.8)';
      ctx.fillText(`${car.place}. ${car.name.split(' ')[0]}`, car.x, car.y - 22);
    }
    ctx.restore();

    if (bio.night) this.renderNight(ctx, cam, W, H);
  }

  renderNight(ctx, cam, W, H) {
    if (!this.lightCanvas || this.lightCanvas.width !== W || this.lightCanvas.height !== H) {
      this.lightCanvas = document.createElement('canvas');
      this.lightCanvas.width = W;
      this.lightCanvas.height = H;
    }
    const lc = this.lightCanvas.getContext('2d');
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, W, H);
    lc.fillStyle = 'rgba(5,4,20,0.62)';
    lc.fillRect(0, 0, W, H);
    lc.globalCompositeOperation = 'destination-out';
    for (const car of this.cars) {
      const sx = W / 2 + (car.x - cam.x) * cam.zoom, sy = H / 2 + (car.y - cam.y) * cam.zoom;
      if (sx < -400 || sy < -400 || sx > W + 400 || sy > H + 400) continue;
      const len = 260 * cam.zoom;
      const hx = sx + Math.cos(car.heading) * len * 0.55, hy = sy + Math.sin(car.heading) * len * 0.55;
      const g = lc.createRadialGradient(hx, hy, 0, hx, hy, len * 0.6);
      g.addColorStop(0, 'rgba(0,0,0,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.beginPath();
      lc.arc(hx, hy, len * 0.6, 0, TAU);
      lc.fill();
      const g2 = lc.createRadialGradient(sx, sy, 0, sx, sy, 50 * cam.zoom);
      g2.addColorStop(0, 'rgba(0,0,0,0.8)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g2;
      lc.beginPath();
      lc.arc(sx, sy, 50 * cam.zoom, 0, TAU);
      lc.fill();
    }
    ctx.drawImage(this.lightCanvas, 0, 0);
  }
}
