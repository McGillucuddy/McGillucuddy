'use strict';
// Driver orders: you're the gunner, not the driver, but you can shout. Middle mouse: "Ram them!" at the car under
// your crosshair. Hold C for the order wheel: get alongside (for a broadside), tail them (sit on their bumper),
// floor it, or ease off (a steadier platform: your aim settles). Tap C to repeat your last order.
// The driver answers on the radio, takes a moment to act (the chip they run decides how keen they are) and gives up
// after a few seconds. A/D swerves are still instant.

const ORDERS = {
  alongside: { name: 'Get alongside', icon: '⇉', t: 8, cd: 1.5, needsTarget: true, ack: ['"Pulling up beside them."', '"Get your window down."', '"Side by side. Make it count."'] },
  floor: { name: 'Floor it', icon: '⏩', t: 6, cd: 1.5, ack: ['"Flooring it!"', '"Everything she\'s got!"', '"Hold on to your teeth."'] },
  ease: { name: 'Ease off', icon: '⏸', t: 6, cd: 1.5, ack: ['"Easing off. Take your shot."', '"Steady now."', '"Nice and smooth."'] },
  tail: { name: 'Tail them', icon: '⇈', t: 8, cd: 1.5, needsTarget: true, ack: ['"Sitting on their bumper."', '"Right behind them."', '"I\'m on them."'] },
  ram: { name: 'Ram them', icon: '💥', t: 6, cd: 3, needsTarget: true, ack: ['"Hold on to something!"', '"Ramming speed!"', '"They\'re getting the bumper!"'] },
};
const ORDER_WHEEL = ['alongside', 'floor', 'ease', 'tail']; // up, right, down, left
const ORDER_DONE = {
  hit: ['"Got \'em!"', '"Ha! Felt that one."', '"Bumper to bumper!"'],
  gone: ['"They\'re done."', '"Nothing left to hit."'],
  timeout: ['"Lost them."', '"Can\'t keep this up."', '"Back to the line."'],
  none: ['"Ram who?"', '"Point at someone first!"'],
  behind: ['"They\'re behind us now."', '"Already passed them."'],
};
const ORDER = { delay: 0.4, easeAim: 0.75, tailGap: 90 };
// How each driver chip takes orders: how long before they act, and per order a strength (0 refuses, 1 normal).
const ORDER_CHIP = {
  hothead: { delay: 0.15, ram: 1.3, ease: 0.5, line: { ease: '"Ease off? Fine. FINE."' } },
  cautious: { delay: 0.7, ram: 0.7, floor: 0.6, line: { ram: '"Are you out of your mind?! ...Alright."', floor: '"Not too fast, mind."' } },
  daredevil: { floor: 1.3, line: { floor: '"Now we\'re talking!"' } },
};

// ---------- The driver's side: lanes and speed while an order is on ----------
Object.assign(AIDriver.prototype, {
  // Called with the lane the driver wanted; returns the lane the order wants.
  orderLane(race, lane) {
    const O = this.order, car = this.car, tr = race.track;
    this.orderMode = null;
    if (!O || O.delay > 0) return lane; // still taking it in
    const o = O.target;
    if (o && (o.hp <= 0 || o.finished)) { O.done = O.done || 'gone'; return lane; }
    if (O.t <= 0) { O.done = O.done || 'timeout'; return lane; }
    this.orderMode = O.kind;
    if (!o) return lane;
    const gap = (o.progress - car.progress) * tr.step; // + ahead of us along the track
    this.orderGap = gap;
    if (gap < (O.kind === 'ram' ? -60 : -250)) { O.done = 'behind'; return lane; } // never crawl waiting for someone way back
    if (O.kind === 'ram') {
      if (Math.hypot(o.x - car.x, o.y - car.y) < CAR_RADIUS * 2 + 6) O.done = 'hit';
      return gap > -20 ? clamp(o.lat / tr.hw, -0.9, 0.9) : lane;
    }
    if (O.kind === 'tail') return clamp(o.lat / tr.hw, -0.85, 0.85);
    if (O.kind === 'alongside') return clamp(o.lat / tr.hw + (o.lat > 0 ? -0.42 : 0.42), -0.9, 0.9);
    return lane;
  },

  // Throttle, brake and nitro under orders. target: the safe corner speed the driver worked out.
  orderSpeed(out, speed, target) {
    const m = this.orderMode, O = this.order, k = O ? O.k : 1, gap = this.orderGap || 0;
    if (!m) return out;
    if (m === 'floor') { // brake only well past the safe speed (a cautious driver still lifts early)
      out.throttle = 1; out.brake = speed > target * (1 + 0.12 * k) ? 0.4 : 0; out.nitro = this.car.nitro > 5;
    } else if (m === 'ram') {
      out.throttle = 1; out.brake = speed > target * (1 + 0.08 * k) ? 0.3 : 0; out.nitro = gap > 40 && this.car.nitro > 5;
    } else if (m === 'ease') {
      const cap = Math.min(target, this.car.stats.top) * (1 - 0.3 * k);
      if (speed > cap) { out.throttle = 0; out.brake = Math.max(out.brake, 0.15); out.nitro = false; } else out.throttle = Math.min(out.throttle, 0.6);
    } else if (m === 'tail') {
      if (gap < ORDER.tailGap - 30) { out.throttle = speed < this.car.stats.top * 0.45 ? 0.6 : 0.15; out.brake = gap < 40 && speed > this.car.stats.top * 0.45 ? 0.35 : 0; out.nitro = false; } else if (gap > ORDER.tailGap + 50) { out.throttle = 1; out.nitro = gap > 300 && this.car.nitro > 20; }
    } else if (m === 'alongside') {
      if (gap < -25) { out.throttle = speed < this.car.stats.top * 0.45 ? 0.6 : 0.15; out.brake = gap < -60 && speed > this.car.stats.top * 0.45 ? 0.3 : 0; out.nitro = false; } else if (gap > 25) { out.throttle = 1; out.nitro = gap > 160 && this.car.nitro > 20; }
    }
    return out;
  },
});

// ---------- The gunner's side: giving orders, and the radio ----------
Object.assign(Combat.prototype, {
  order(kind, aim) {
    const p = this.player, D = this.driver, def = ORDERS[kind];
    if (!D || !def || p.finished || this.race.state !== 'racing' || (this.orderCd || 0) > 0) return false;
    const target = def.needsTarget ? Emotes.target(this, aim) || (kind === 'ram' ? null : this.nearestAhead()) : null;
    if (def.needsTarget && !target) { this.radio(ORDER_DONE.none); this.orderCd = 0.8; return false; }
    const C = ORDER_CHIP[this.build.chip] || {}, k = C[kind] ?? 1;
    const B = this.bondPerks || {}; // a driver who knows you acts sooner and holds on longer (js/bond.js)
    D.order = { kind, target, t: def.t * (B.hold || 1), delay: (C.delay ?? ORDER.delay) * (B.delay || 1), k, done: null };
    this.orderCd = def.cd;
    this.lastOrder = kind;
    if (C.line && C.line[kind]) this.radio([C.line[kind]]); else this.speakOr('order', def.ack);
    this.events.push({ type: 'order', kind });
    return true;
  },
  nearestAhead() {
    const p = this.player, tr = this.race.track;
    let best = null, bd = 1e9;
    for (const c of this.race.cars) {
      if (c === p || c.hp <= 0 || c.finished) continue;
      const gap = Math.abs((c.progress - p.progress) * tr.step);
      if (gap < bd && gap < 700) { bd = gap; best = c; }
    }
    return best;
  },
  // Your driver says it out loud (js/voice.js), or, with no voice to hand, it goes out on the radio as text.
  speakOr(kind, lines) { const said = this.voiceHook ? this.voiceHook(kind) : null; if (!said && lines) this.radio(lines); return said; },
  radio(lines) { this.race.message(`${((this.crew && this.crew.short) || 'Driver').toUpperCase()}: ${lines[Math.floor(this.rng() * lines.length)]}`, '#9fd0ff'); },
  // Each frame: count the order down, and report back when it's over.
  updateOrders(dt) {
    this.orderCd = Math.max(0, (this.orderCd || 0) - dt);
    const O = this.driver && this.driver.order;
    if (!O) return;
    if (O.delay > 0) O.delay -= dt; else O.t -= dt;
    if (O.done) {
      if (O.done === 'hit') { this.events.push({ type: 'crowd' }); if (this.bondEvent) this.bondEvent('order'); }
      this.radio(ORDER_DONE[O.done] || ORDER_DONE.timeout);
      this.driver.order = null;
    }
  },
});
// Easing off makes a steadier platform for your aim (see Combat.weaponDef). A getter, so defined, not assigned.
Object.defineProperty(Combat.prototype, 'orderAiming', { get() { const O = this.driver && this.driver.order; return !!(O && O.kind === 'ease' && O.delay <= 0); } });

// The wheel while C is held: four orders round the crosshair (same feel as the emote wheel).
function drawOrderWheel(ctx, P, W, H) {
  const E = P.orderHold;
  if (!E || !E.open) return;
  const cx = W / 2, cy = H / 2, R = 92, sel = Math.hypot(E.x, E.y) >= 30 ? P.orderAt(E) : null;
  ctx.save();
  ctx.fillStyle = 'rgba(0,10,30,0.5)';
  ctx.beginPath(); ctx.arc(cx, cy, R + 46, 0, TAU); ctx.fill();
  ORDER_WHEEL.forEach((id, i) => {
    const a = -Math.PI / 2 + i * (Math.PI / 2), x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, on = id === sel;
    ctx.fillStyle = on ? 'rgba(120,190,255,0.9)' : 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = '26px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText(ORDERS[id].icon, x, y + 9);
    ctx.font = `bold 12px ${hudFont()}`;
    ctx.fillStyle = on ? '#9fd0ff' : '#ddd';
    ctx.fillText(ORDERS[id].name.toUpperCase(), x, y + 50);
  });
  ctx.fillStyle = '#9fd0ff'; ctx.font = `bold 11px ${hudFont()}`; ctx.textAlign = 'center';
  ctx.fillText('ORDERS FOR THE DRIVER', cx, cy - R - 54);
  ctx.strokeStyle = '#9fd0ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + E.x * 0.6, cy + E.y * 0.6); ctx.stroke();
  ctx.restore();
}

// The order in force, small under the place readout: what, at whom, how long.
function drawOrderStatus(ctx, P) {
  const O = P.combat && P.combat.driver && P.combat.driver.order;
  if (!O) return;
  const txt = `${O.delay > 0 ? '…' : '▶'} ${ORDERS[O.kind].name.toUpperCase()}${O.target ? ' ' + shortName(O.target).toUpperCase() : ''}  ${Math.max(0, O.t).toFixed(1)}s`;
  ctx.save();
  ctx.font = `bold 13px ${hudFont()}`; ctx.textAlign = 'left';
  const w = ctx.measureText(txt).width + 16;
  ctx.fillStyle = 'rgba(0,10,30,0.6)'; ctx.fillRect(12, 50, w, 22);
  ctx.fillStyle = '#9fd0ff'; ctx.fillText(txt, 20, 66);
  ctx.restore();
}
