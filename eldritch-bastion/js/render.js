// ============================================================
//  ELDRITCH BASTION — procedural canvas rendering
// ============================================================
'use strict';

const TAU = Math.PI * 2;
function hashRng(n) { return mulberry32(n * 9301 + 49297); }

// Eyes are recorded in screen space so they can be redrawn glowing
// *above* the darkness layer: in the night you see the eyes first.
const EyeSink = { on: false, list: [], ss: 1 };
// Soft glow without canvas shadows (shadowBlur is ruinously slow at high resolution).
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function halo(ctx, x, y, r, color, a = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, a)); g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function eyes(ctx, pts, r, color, blur = 4) {
  ctx.save();
  for (const [x, y] of pts) {
    halo(ctx, x, y, r + blur * 0.45, color, 0.45);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (EyeSink.on) {
      const m = ctx.getTransform(), k = EyeSink.ss;
      EyeSink.list.push({ x: (m.a * x + m.c * y + m.e) / k, y: (m.b * x + m.d * y + m.f) / k, r: r * Math.hypot(m.a, m.b) / k, color, a: ctx.globalAlpha });
    }
  }
  ctx.restore();
}

// ---------- shared drawing helpers ----------
// Fill a path, then shade it (top highlight → bottom shadow) and outline it.
function solid(ctx, path, fill, s, hl = 'rgba(200,220,210,0.13)', outline = 'rgba(0,0,0,0.8)') {
  path(); ctx.fillStyle = fill; ctx.fill();
  ctx.save(); path(); ctx.clip();
  const g = ctx.createLinearGradient(-s * 0.4, -s * 1.3, s * 0.3, s * 1.2);
  g.addColorStop(0, hl || 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(-s * 4, -s * 4, s * 8, s * 8);
  ctx.restore();
  if (outline) { path(); ctx.strokeStyle = outline; ctx.lineWidth = 0.9; ctx.lineJoin = 'round'; ctx.stroke(); }
}
// Two-segment jointed limb with taper. Returns the joint position.
function limb(ctx, x0, y0, x1, y1, bend, w0, w1, color, dark = 'rgba(0,0,0,0.75)') {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  const jx = mx - dy / l * bend, jy = my + dx / l * bend;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass ? color : dark;
    const o = pass ? 0 : 1.4;
    ctx.lineWidth = w0 + o; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(jx, jy); ctx.stroke();
    ctx.lineWidth = w1 + o; ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(x1, y1); ctx.stroke();
  }
  return [jx, jy];
}
function claws(ctx, x, y, ang, len, n, spread, color = '#b9b3a0', w = 0.9) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = ang + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.7, y + Math.sin(a) * len * 0.7, x + Math.cos(a + 0.5) * len, y + Math.sin(a + 0.5) * len);
    ctx.stroke();
  }
}
function tentacle(ctx, x, y, ang, len, w0, phase, color, segs = 8, amp = 0.5) {
  ctx.lineCap = 'round';
  const pts = [[x, y]];
  let px = x, py = y;
  const sl = len / segs;
  for (let i = 0; i < segs; i++) {
    const a = ang + Math.sin(phase + i * 0.7) * amp * (i / segs + 0.3);
    px += Math.cos(a) * sl; py += Math.sin(a) * sl; pts.push([px, py]);
  }
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass ? color : 'rgba(0,0,0,0.7)';
    for (let i = 0; i < segs; i++) {
      ctx.lineWidth = Math.max(0.6, w0 * (1 - i / segs)) + (pass ? 0 : 1.2);
      ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
    }
  }
  return pts[segs];
}
// Bat-like wing seen from above. side = ±1.
function batWing(ctx, side, span, flap, fill, rim, bone = 'rgba(0,0,0,0.65)') {
  const f = 0.5 + 0.5 * flap, sw = span * (0.78 + 0.22 * f);
  const tipX = side * sw, tipY = -span * (0.15 + 0.3 * f);
  const fingers = [[tipX, tipY], [side * sw * 0.86, span * 0.16], [side * sw * 0.6, span * 0.36], [side * sw * 0.32, span * 0.42]];
  const path = () => {
    ctx.beginPath(); ctx.moveTo(side * span * 0.08, -span * 0.14);
    ctx.quadraticCurveTo(side * sw * 0.5, -span * (0.5 + 0.2 * f), tipX, tipY);
    let [px, py] = fingers[0];
    for (let i = 1; i < fingers.length; i++) {
      const [x, y] = fingers[i];
      ctx.quadraticCurveTo((px + x) / 2 - side * span * 0.07, (py + y) / 2 - span * 0.13, x, y);
      px = x; py = y;
    }
    ctx.quadraticCurveTo(side * span * 0.16, span * 0.3, side * span * 0.06, span * 0.24);
    ctx.closePath();
  };
  path(); ctx.fillStyle = fill; ctx.fill();
  ctx.save(); path(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, tipX, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(-span * 1.2, -span, span * 2.4, span * 2);
  ctx.restore();
  if (rim) { path(); ctx.strokeStyle = rim; ctx.lineWidth = 0.9; ctx.stroke(); }
  ctx.strokeStyle = bone; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
  for (const [x, y] of fingers) { ctx.beginPath(); ctx.moveTo(side * span * 0.1, -span * 0.1); ctx.quadraticCurveTo(x * 0.55, y * 0.5 - span * 0.12, x, y); ctx.stroke(); }
}
function fangs(ctx, x0, y0, x1, y1, n, len, color = '#cfc8ad') {
  ctx.fillStyle = color;
  const dx = (x1 - x0) / n, dy = (y1 - y0) / n, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  for (let i = 0; i < n; i++) {
    const x = x0 + dx * i, y = y0 + dy * i;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * 0.5 + nx * len, y + dy * 0.5 + ny * len); ctx.lineTo(x + dx * 0.85, y + dy * 0.85); ctx.closePath(); ctx.fill();
  }
}

// ---------------- enemy art (ground creatures face +x) ----------------
const EnemyArt = {
  // ---------------------------------------------------------- CULTIST
  cultist(ctx, s, t) {
    const step = Math.sin(t * 5), sway = Math.sin(t * 2.5) * 0.06;
    ctx.save(); ctx.rotate(0.12 + sway);
    // raised back arm, fingers spread in invocation
    const [bx, by] = [-s * 0.15, -s * 0.25];
    const hx = -s * 0.55 + sway * 20, hy = -s * 1.05 + Math.sin(t * 3) * s * 0.06;
    limb(ctx, bx, by, hx, hy, -s * 0.18, s * 0.26, s * 0.2, '#22090c');
    claws(ctx, hx, hy, -Math.PI / 2, s * 0.22, 4, 1.4, '#8f8670', 0.8);
    // robe
    const robe = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.72, s * 1.0);
      for (let i = 1; i <= 8; i++) ctx.lineTo(-s * 0.72 + i * s * 0.18, s * (i % 2 ? 0.84 : 1.03) + (i % 3 ? step : -step) * s * 0.04);
      ctx.quadraticCurveTo(s * 0.62, s * 0.2, s * 0.4, -s * 0.2);
      ctx.quadraticCurveTo(s * 0.5, -s * 0.5, s * 0.3, -s * 0.55);
      ctx.lineTo(-s * 0.38, -s * 0.45);
      ctx.quadraticCurveTo(-s * 0.62, s * 0.1, -s * 0.72, s * 1.0);
      ctx.closePath();
    };
    solid(ctx, robe, '#3a0d12', s, 'rgba(255,120,110,0.14)');
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.9;
    for (const [x0, x1] of [[-0.3, -0.42], [-0.05, -0.1], [0.2, 0.26]]) { ctx.beginPath(); ctx.moveTo(s * x0, -s * 0.2); ctx.quadraticCurveTo(s * (x0 + x1) / 2 - 1, s * 0.4, s * x1, s * 0.92); ctx.stroke(); }
    // rope belt and a sigil daubed on the chest
    ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-s * 0.48, s * 0.12); ctx.quadraticCurveTo(0, s * 0.24, s * 0.52, s * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.2, s * 0.18); ctx.lineTo(s * 0.24, s * 0.5); ctx.stroke();
    ctx.strokeStyle = `rgba(190,40,30,${0.55 + 0.3 * Math.sin(t * 4)})`; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(s * 0.02, -s * 0.12, s * 0.11, 0, TAU); ctx.moveTo(s * 0.02, -s * 0.26); ctx.lineTo(s * 0.02, s * 0.02); ctx.moveTo(-s * 0.1, -s * 0.05); ctx.lineTo(s * 0.14, -s * 0.19); ctx.stroke();
    // cowl: peaked, drooping backward, with nothing inside
    const hood = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.4);
      ctx.quadraticCurveTo(-s * 0.62, -s * 1.15, -s * 0.5, -s * 1.5);
      ctx.quadraticCurveTo(-s * 0.2, -s * 1.5, s * 0.25, -s * 1.22);
      ctx.quadraticCurveTo(s * 0.62, -s * 0.95, s * 0.5, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.1, -s * 0.3, -s * 0.42, -s * 0.4);
      ctx.closePath();
    };
    solid(ctx, hood, '#2c0a0e', s, 'rgba(255,120,110,0.16)');
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(s * 0.22, -s * 0.8, s * 0.22, s * 0.3, 0.25, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.3, -s * 0.84], [s * 0.16, -s * 0.81]], 0.8, '#ff3b1f');
    // front arm thrusting a hooked ritual knife
    const kx = s * 0.9, ky = s * 0.02 + step * s * 0.06;
    limb(ctx, s * 0.18, -s * 0.25, kx, ky, s * 0.16, s * 0.28, s * 0.22, '#2a0a0e');
    ctx.fillStyle = '#8f8670'; ctx.beginPath(); ctx.arc(kx, ky, s * 0.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(kx, ky - 1); ctx.quadraticCurveTo(kx + s * 0.4, ky - s * 0.1, kx + s * 0.42, ky - s * 0.55); ctx.stroke();
    ctx.strokeStyle = '#b4b6b8'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(kx, ky - 1); ctx.quadraticCurveTo(kx + s * 0.4, ky - s * 0.1, kx + s * 0.42, ky - s * 0.55); ctx.stroke();
    ctx.restore();
  },
  // ---------------------------------------------------------- GHOUL
  ghoul(ctx, s, t) {
    const g = t * 10, lope = Math.sin(g) * s * 0.07;
    const skin = '#5f6450', dark = '#3d4133';
    ctx.save(); ctx.translate(0, lope);
    // far limbs
    limb(ctx, -s * 0.5, -s * 0.05, -s * 0.55 - Math.sin(g) * s * 0.35, s * 0.95, -s * 0.3, s * 0.24, s * 0.16, dark);
    limb(ctx, s * 0.35, -s * 0.35, s * 0.7 + Math.sin(g) * s * 0.35, s * 0.95, s * 0.22, s * 0.2, s * 0.14, dark);
    // hunched torso: deep chest, starved waist
    const torso = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.85, s * 0.05);
      ctx.quadraticCurveTo(-s * 0.75, -s * 0.5, -s * 0.2, -s * 0.72);
      ctx.quadraticCurveTo(s * 0.45, -s * 0.95, s * 0.72, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.8, -s * 0.05, s * 0.3, s * 0.05);
      ctx.quadraticCurveTo(-s * 0.1, -s * 0.1, -s * 0.45, s * 0.22);
      ctx.quadraticCurveTo(-s * 0.75, s * 0.3, -s * 0.85, s * 0.05);
      ctx.closePath();
    };
    solid(ctx, torso, skin, s);
    ctx.strokeStyle = 'rgba(20,22,14,0.8)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(s * (0.5 - i * 0.16), -s * 0.2, s * 0.26, 0.5, 1.9); ctx.stroke(); }
    ctx.fillStyle = '#7b806a';
    for (let i = 0; i < 7; i++) { const k = i / 6; ctx.beginPath(); ctx.arc(-s * 0.7 + k * s * 1.25, -s * (0.3 + Math.sin(k * 2.6) * 0.48), s * 0.065, 0, TAU); ctx.fill(); }
    // near limbs: digitigrade hind leg, long knuckle-walking arm
    const hf = -s * 0.25 + Math.sin(g) * s * 0.35;
    const [kx, ky] = limb(ctx, -s * 0.45, s * 0.05, hf - s * 0.2, s * 0.62, -s * 0.34, s * 0.3, s * 0.18, skin);
    limb(ctx, hf - s * 0.2, s * 0.62, hf, s * 0.98, s * 0.08, s * 0.15, s * 0.12, skin);
    ctx.fillStyle = '#1b1b14'; ctx.beginPath(); ctx.ellipse(hf + s * 0.05, s * 0.99, s * 0.14, s * 0.06, 0, 0, TAU); ctx.fill();
    const af = s * 0.75 - Math.sin(g) * s * 0.35;
    limb(ctx, s * 0.45, -s * 0.4, af, s * 0.92, s * 0.26, s * 0.22, s * 0.15, skin);
    claws(ctx, af, s * 0.92, 0.3, s * 0.3, 3, 0.9, '#c6bfa6');
    // head: canine muzzle, torn ears, lolling jaw
    ctx.save(); ctx.translate(s * 0.78, -s * 0.62); ctx.rotate(0.25 + Math.sin(g * 0.5) * 0.08);
    const jaw = 0.25 + Math.abs(Math.sin(t * 6)) * 0.3;
    ctx.save(); ctx.rotate(jaw);
    ctx.fillStyle = '#34372a'; ctx.beginPath(); ctx.moveTo(-s * 0.05, s * 0.05); ctx.lineTo(s * 0.62, s * 0.1); ctx.lineTo(s * 0.55, s * 0.2); ctx.lineTo(-s * 0.02, s * 0.2); ctx.closePath(); ctx.fill();
    fangs(ctx, s * 0.15, s * 0.1, s * 0.6, s * 0.1, 4, -s * 0.09);
    ctx.restore();
    ctx.fillStyle = '#1a0606'; ctx.beginPath(); ctx.moveTo(s * 0.02, s * 0.04); ctx.lineTo(s * 0.6, s * 0.02); ctx.lineTo(s * 0.5, s * 0.16); ctx.closePath(); ctx.fill();
    const skull = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.05);
      ctx.quadraticCurveTo(-s * 0.35, -s * 0.38, s * 0.05, -s * 0.36);
      ctx.quadraticCurveTo(s * 0.4, -s * 0.22, s * 0.72, -s * 0.1);
      ctx.lineTo(s * 0.7, s * 0.04); ctx.lineTo(s * 0.05, s * 0.08); ctx.closePath();
    };
    solid(ctx, skull, '#6d725b', s);
    fangs(ctx, s * 0.2, s * 0.05, s * 0.68, s * 0.03, 5, s * 0.1);
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.3); ctx.lineTo(-s * 0.42, -s * 0.72); ctx.lineTo(-s * 0.02, -s * 0.36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(s * 0.14, -s * 0.16, s * 0.12, s * 0.08, 0.3, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.16, -s * 0.16]], 0.7, '#d6ff52');
    // drool
    ctx.strokeStyle = 'rgba(190,200,160,0.5)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(s * 0.45, s * 0.14); ctx.lineTo(s * 0.45 + Math.sin(t * 5) * 1, s * 0.14 + s * 0.3 + Math.sin(t * 3) * s * 0.1); ctx.stroke();
    ctx.restore();
    ctx.restore();
  },
  // ---------------------------------------------------------- DEEP ONE
  deepone(ctx, s, t) {
    const w = t * 4, sway = Math.sin(w), hide = '#2f4b40', hideD = '#1b2d27', belly = '#8b9578';
    ctx.save(); ctx.translate(0, Math.abs(sway) * -s * 0.04);
    // far arm hanging, far leg
    limb(ctx, -s * 0.1, -s * 0.15, -s * 0.2 - sway * s * 0.2, s * 0.55, s * 0.12, s * 0.2, s * 0.15, hideD);
    limb(ctx, -s * 0.2, s * 0.35, -s * 0.15 - sway * s * 0.28, s * 0.98, s * 0.26, s * 0.3, s * 0.18, hideD);
    // dorsal crest: spines with membrane, from skull down the back
    ctx.fillStyle = 'rgba(40,80,66,0.85)'; ctx.strokeStyle = '#0c1613'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.5);
    const spine = [[-0.92, 0.25], [-1.0, -0.15], [-0.92, -0.55], [-0.62, -0.95], [-0.2, -1.32], [0.1, -1.12]];
    spine.forEach(([x, y], i) => { ctx.lineTo(s * x, s * y); ctx.lineTo(s * (x * 0.62 + 0.1), s * (y * 0.72 - 0.02) + (i === 5 ? 0 : s * 0.02)); });
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // body: hunched, pot-bellied
    const body = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.48, s * 0.55);
      ctx.quadraticCurveTo(-s * 0.82, -s * 0.05, -s * 0.4, -s * 0.62);
      ctx.quadraticCurveTo(-s * 0.1, -s * 0.9, s * 0.3, -s * 0.55);
      ctx.quadraticCurveTo(s * 0.62, -s * 0.1, s * 0.5, s * 0.3);
      ctx.quadraticCurveTo(s * 0.3, s * 0.7, -s * 0.48, s * 0.55);
      ctx.closePath();
    };
    solid(ctx, body, hide, s, 'rgba(170,230,210,0.16)');
    ctx.save(); body(); ctx.clip();
    ctx.fillStyle = belly; ctx.globalAlpha *= 0.55; ctx.beginPath(); ctx.ellipse(s * 0.36, s * 0.12, s * 0.26, s * 0.5, -0.15, 0, TAU); ctx.fill(); ctx.globalAlpha /= 0.55;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.7;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { ctx.beginPath(); ctx.arc(-s * 0.55 + c * s * 0.2 + (r % 2) * s * 0.1, -s * 0.4 + r * s * 0.24, s * 0.1, 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.restore();
    // near leg: frog-bent, webbed foot
    const fx = s * 0.1 + sway * s * 0.28;
    limb(ctx, -s * 0.1, s * 0.4, fx, s * 0.98, s * 0.3, s * 0.34, s * 0.2, hide);
    ctx.fillStyle = hideD; ctx.beginPath(); ctx.moveTo(fx - s * 0.1, s * 0.94); ctx.lineTo(fx + s * 0.4, s * 0.9); ctx.lineTo(fx + s * 0.42, s * 1.03); ctx.lineTo(fx - s * 0.1, s * 1.03); ctx.closePath(); ctx.fill();
    // head: wide, flat, neckless, thrust forward
    ctx.save(); ctx.translate(s * 0.28, -s * 0.72); ctx.rotate(0.1 + sway * 0.05);
    const gape = s * (0.1 + 0.08 * Math.abs(Math.sin(t * 2.3)));
    // lower jaw
    const jawP = () => { ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.12); ctx.quadraticCurveTo(s * 0.3, s * 0.42 + gape, s * 0.78, s * 0.08 + gape); ctx.lineTo(s * 0.7, -s * 0.02 + gape * 0.4); ctx.lineTo(-s * 0.2, 0); ctx.closePath(); };
    solid(ctx, jawP, '#26392f', s, null);
    ctx.fillStyle = '#060303'; ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.02); ctx.quadraticCurveTo(s * 0.4, s * 0.2 + gape * 0.5, s * 0.74, s * 0.03 + gape * 0.6); ctx.lineTo(s * 0.76, -s * 0.05); ctx.closePath(); ctx.fill();
    fangs(ctx, s * 0.12, s * 0.14 + gape * 0.5, s * 0.72, s * 0.04 + gape * 0.7, 6, -s * 0.1);
    const head = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.42, s * 0.1);
      ctx.quadraticCurveTo(-s * 0.55, -s * 0.38, -s * 0.05, -s * 0.46);
      ctx.quadraticCurveTo(s * 0.5, -s * 0.48, s * 0.86, -s * 0.12);
      ctx.quadraticCurveTo(s * 0.9, s * 0.0, s * 0.74, s * 0.0);
      ctx.quadraticCurveTo(s * 0.3, s * 0.14, -s * 0.42, s * 0.1);
      ctx.closePath();
    };
    solid(ctx, head, '#365548', s, 'rgba(170,230,210,0.2)');
    fangs(ctx, s * 0.1, s * 0.07, s * 0.78, -s * 0.02, 7, s * 0.11);
    // gill slits that flare
    ctx.strokeStyle = '#7a1c1c'; ctx.lineWidth = 0.9 + Math.sin(t * 3) * 0.3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-s * 0.2 - i * s * 0.09, s * 0.02, s * 0.16, -0.9, 0.9); ctx.stroke(); }
    // barbels
    tentacle(ctx, s * 0.7, s * 0.08 + gape * 0.5, 1.3, s * 0.35, 0.9, t * 4, '#26392f', 4, 0.8);
    // bulging lidless eyes
    for (const [ex, ey, er] of [[s * 0.44, -s * 0.3, s * 0.115], [s * 0.14, -s * 0.4, s * 0.07]]) {
      ctx.fillStyle = '#10201a'; ctx.beginPath(); ctx.arc(ex, ey, er * 1.25, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7d7a4e'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
      eyes(ctx, [[ex, ey]], er * 0.45, '#d8cf7a', 3);
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ex + er * 0.15, ey, er * 0.16, er * 0.8, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#132019'; ctx.lineWidth = er * 0.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - er * 1.5, ey - er * 1.3); ctx.lineTo(ex + er * 1.6, ey - er * 0.5); ctx.stroke();
    }
    ctx.restore();
    // near arm reaching, webbed talons spread
    const hx = s * 1.05 + sway * s * 0.1, hy = s * 0.12 - Math.abs(sway) * s * 0.1;
    limb(ctx, s * 0.12, -s * 0.25, hx, hy, s * 0.22, s * 0.26, s * 0.18, hide);
    ctx.fillStyle = 'rgba(60,110,90,0.55)'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + s * 0.3, hy - s * 0.26); ctx.lineTo(hx + s * 0.38, hy + s * 0.02); ctx.lineTo(hx + s * 0.26, hy + s * 0.26); ctx.closePath(); ctx.fill();
    claws(ctx, hx, hy, -0.2, s * 0.36, 4, 1.5, '#c2c4a4');
    ctx.restore();
  },
  // ---------------------------------------------------------- NIGHTGAUNT (top-down)
  nightgaunt(ctx, s, t) {
    const flap = Math.sin(t * 7), body = '#0c0c13', rim = 'rgba(130,115,180,0.5)';
    batWing(ctx, -1, s * 1.9, flap, '#08080d', rim); batWing(ctx, 1, s * 1.9, flap, '#08080d', rim);
    // barbed tail
    const [tx, ty] = tentacle(ctx, 0, s * 0.8, Math.PI / 2, s * 1.7, 2.2, t * 5, body, 9, 0.9);
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(tx, ty + s * 0.3); ctx.lineTo(tx - s * 0.16, ty - s * 0.05); ctx.lineTo(tx + s * 0.16, ty - s * 0.05); ctx.closePath(); ctx.fill();
    // trailing legs, reaching arms
    limb(ctx, -s * 0.12, s * 0.6, -s * 0.28, s * 1.25, -s * 0.08, s * 0.16, s * 0.1, body, rim);
    limb(ctx, s * 0.12, s * 0.6, s * 0.28, s * 1.25, s * 0.08, s * 0.16, s * 0.1, body, rim);
    const reach = Math.sin(t * 3) * s * 0.08;
    for (const sd of [-1, 1]) {
      limb(ctx, sd * s * 0.2, -s * 0.45, sd * s * 0.42, -s * 1.15 + reach * sd, sd * s * 0.16, s * 0.14, s * 0.1, body, rim);
      claws(ctx, sd * s * 0.42, -s * 1.15 + reach * sd, -Math.PI / 2, s * 0.26, 3, 1.0, '#3a3650', 0.8);
    }
    const torso = () => { ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.quadraticCurveTo(s * 0.42, -s * 0.5, s * 0.22, s * 0.3); ctx.quadraticCurveTo(s * 0.15, s * 0.8, 0, s * 0.9); ctx.quadraticCurveTo(-s * 0.15, s * 0.8, -s * 0.22, s * 0.3); ctx.quadraticCurveTo(-s * 0.42, -s * 0.5, 0, -s * 0.7); ctx.closePath(); };
    solid(ctx, torso, body, s, 'rgba(150,130,210,0.2)', rim);
    ctx.strokeStyle = 'rgba(130,115,180,0.3)'; ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.2 + i * s * 0.2); ctx.lineTo(s * 0.16, -s * 0.2 + i * s * 0.2); ctx.stroke(); }
    // smooth, faceless head with inward-curving horns
    ctx.strokeStyle = '#1c1a28'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.85); ctx.quadraticCurveTo(-s * 0.6, -s * 1.3, -s * 0.08, -s * 1.5);
    ctx.moveTo(s * 0.16, -s * 0.85); ctx.quadraticCurveTo(s * 0.6, -s * 1.3, s * 0.08, -s * 1.5); ctx.stroke();
    const hd = () => { ctx.beginPath(); ctx.ellipse(0, -s * 0.82, s * 0.2, s * 0.26, 0, 0, TAU); };
    solid(ctx, hd, '#11111a', s, 'rgba(170,150,230,0.3)', rim);
  },
  // ---------------------------------------------------------- MI-GO
  migo(ctx, s, t) {
    const shell = '#6a4a50', shellD = '#402b30', leg = '#4a3237', buzz = Math.sin(t * 26);
    // membranous wings, veined, blurring with speed
    for (const [rot, a] of [[-0.9 + buzz * 0.25, 0.3], [-0.45 - buzz * 0.25, 0.22]]) {
      ctx.save(); ctx.translate(-s * 0.1, -s * 0.35); ctx.rotate(rot);
      ctx.fillStyle = `rgba(150,120,130,${a})`; ctx.strokeStyle = 'rgba(40,25,30,0.6)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * 0.9, -s * 0.5, -s * 1.5, -s * 0.05); ctx.quadraticCurveTo(-s * 0.9, s * 0.3, 0, 0); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * (1.3 - i * 0.3), -s * 0.1 + i * s * 0.08); ctx.stroke(); }
      ctx.restore();
    }
    // far legs
    for (let i = 0; i < 3; i++) { const k = Math.sin(t * 11 + i * 2.1 + 1.5) * s * 0.16; limb(ctx, -s * 0.45 + i * s * 0.3, s * 0.05, -s * 0.5 + i * s * 0.34 + k, s * 0.98, -s * 0.22, s * 0.1, s * 0.07, shellD); }
    // curled abdomen + thorax plates
    const plates = [[-s * 0.72, s * 0.16, s * 0.24, 0.5], [-s * 0.45, -s * 0.02, s * 0.3, 0.2], [-s * 0.12, -s * 0.1, s * 0.34, 0], [s * 0.22, -s * 0.12, s * 0.3, -0.1]];
    plates.forEach(([x, y, r, rot], i) => {
      const p = () => { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.92, rot, 0, TAU); };
      solid(ctx, p, i % 2 ? shell : '#5c4046', s, 'rgba(255,200,210,0.16)');
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(x, y, r * 0.6, -2.4, -0.7); ctx.stroke();
    });
    // fungal growths
    ctx.fillStyle = 'rgba(180,170,120,0.55)';
    for (const [x, y] of [[-0.5, -0.25], [-0.15, -0.38], [0.2, -0.36], [-0.7, 0.0]]) { ctx.beginPath(); ctx.arc(s * x, s * y, s * 0.045, 0, TAU); ctx.fill(); }
    // near legs
    for (let i = 0; i < 3; i++) { const k = Math.sin(t * 11 + i * 2.1) * s * 0.16; const fx = -s * 0.35 + i * s * 0.36 + k; limb(ctx, -s * 0.38 + i * s * 0.3, s * 0.12, fx, s * 0.98, -s * 0.26, s * 0.13, s * 0.08, leg); claws(ctx, fx, s * 0.98, 0.2, s * 0.14, 2, 0.8, '#8a6a70', 0.7); }
    // great pincers, clacking
    const o = Math.abs(Math.sin(t * 4)) * 0.5;
    for (const [sy, col] of [[-s * 0.3, shellD], [s * 0.08, shell]]) {
      const ex = s * 0.98, ey = sy + s * 0.16;
      limb(ctx, s * 0.4, -s * 0.05, ex, ey, -s * 0.2, s * 0.17, s * 0.14, col);
      for (const d of [-1, 1]) {
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(d * (0.2 + o * 0.5));
        ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(-s * 0.05, 0); ctx.quadraticCurveTo(s * 0.2, d * s * 0.2, s * 0.46, d * s * 0.02); ctx.quadraticCurveTo(s * 0.2, d * s * 0.02, -s * 0.05, 0); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    // head: a pulsing ellipsoid bristling with feelers that change colour to "speak"
    const hx = s * 0.42, hy = -s * 0.62, hue = 320 + Math.sin(t * 2.2) * 40;
    for (let i = 0; i < 9; i++) tentacle(ctx, hx + Math.cos(i * 0.7 - 2.8) * s * 0.26, hy + Math.sin(i * 0.7 - 2.8) * s * 0.22, i * 0.7 - 2.8, s * 0.4, 1.3, t * 7 + i * 1.3, `hsl(${hue + i * 6},30%,32%)`, 4, 1.0);
    const hd = () => { ctx.beginPath(); ctx.ellipse(hx, hy, s * 0.36, s * 0.3, 0.3, 0, TAU); };
    solid(ctx, hd, `hsl(${hue},28%,28%)`, s, 'rgba(255,200,230,0.22)');
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(hx - s * 0.18 + i * s * 0.12, hy + (i % 2) * s * 0.06, s * 0.1, i * 1.3, i * 1.3 + 2.6); ctx.stroke(); }
    eyes(ctx, [[hx + s * 0.2, hy + s * 0.04], [hx + s * 0.06, hy - s * 0.12], [hx + s * 0.1, hy + s * 0.14]], 0.6, '#e0a0ff');
  },
  // ---------------------------------------------------------- BYAKHEE (top-down)
  byakhee(ctx, s, t) {
    const flap = Math.sin(t * 9), hide = '#3a2e24';
    batWing(ctx, -1, s * 1.85, flap, '#2c221a', 'rgba(110,85,60,0.5)', 'rgba(150,130,100,0.55)');
    batWing(ctx, 1, s * 1.85, flap, '#2c221a', 'rgba(110,85,60,0.5)', 'rgba(150,130,100,0.55)');
    // rot holes in the membranes
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (const [x, y, r] of [[0.7, 0.05, 0.1], [1.1, -0.1, 0.07], [0.5, 0.22, 0.06]]) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * s * x * (0.85 + flap * 0.1), s * y, s * r, s * r * 0.6, sd * 0.5, 0, TAU); ctx.fill(); }
    // taloned feet trailing
    for (const sd of [-1, 1]) { limb(ctx, sd * s * 0.16, s * 0.65, sd * s * 0.3, s * 1.25, sd * s * 0.1, s * 0.14, s * 0.09, hide); claws(ctx, sd * s * 0.3, s * 1.25, Math.PI / 2, s * 0.24, 3, 1.1, '#9a8a6a'); }
    const torso = () => { ctx.beginPath(); ctx.moveTo(0, -s * 0.65); ctx.quadraticCurveTo(s * 0.5, -s * 0.35, s * 0.3, s * 0.4); ctx.quadraticCurveTo(s * 0.15, s * 0.95, 0, s * 1.0); ctx.quadraticCurveTo(-s * 0.15, s * 0.95, -s * 0.3, s * 0.4); ctx.quadraticCurveTo(-s * 0.5, -s * 0.35, 0, -s * 0.65); ctx.closePath(); };
    solid(ctx, torso, hide, s, 'rgba(230,200,150,0.16)');
    // exposed ribs and spine
    ctx.strokeStyle = '#a8997a'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(0, s * 0.8); ctx.stroke();
    for (let i = 0; i < 5; i++) { const y = -s * 0.3 + i * s * 0.2, w = s * (0.3 - i * 0.03); ctx.beginPath(); ctx.moveTo(-w, y + s * 0.06); ctx.quadraticCurveTo(0, y - s * 0.06, w, y + s * 0.06); ctx.stroke(); }
    // long skull, antennae, serrated mandibles
    const m = Math.abs(Math.sin(t * 6)) * 0.35;
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(sd * s * 0.1, -s * 1.15); ctx.rotate(sd * (0.15 + m));
      ctx.fillStyle = '#8d7c58'; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sd * s * 0.2, -s * 0.2, sd * s * 0.02, -s * 0.42); ctx.quadraticCurveTo(sd * s * 0.06, -s * 0.15, -sd * s * 0.06, 0); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#4a3a2c'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(sd * s * 0.12, -s * 0.9); ctx.quadraticCurveTo(sd * s * 0.5, -s * 1.0, sd * s * 0.55, -s * 0.6); ctx.stroke();
    }
    const skull = () => { ctx.beginPath(); ctx.moveTo(0, -s * 1.28); ctx.quadraticCurveTo(s * 0.3, -s * 1.0, s * 0.2, -s * 0.65); ctx.lineTo(-s * 0.2, -s * 0.65); ctx.quadraticCurveTo(-s * 0.3, -s * 1.0, 0, -s * 1.28); ctx.closePath(); };
    solid(ctx, skull, '#2a2019', s, 'rgba(230,200,150,0.2)');
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(-s * 0.11, -s * 0.9, s * 0.07, s * 0.1, 0.3, 0, TAU); ctx.ellipse(s * 0.11, -s * 0.9, s * 0.07, s * 0.1, -0.3, 0, TAU); ctx.fill();
    eyes(ctx, [[-s * 0.11, -s * 0.9], [s * 0.11, -s * 0.9]], 0.75, '#ff4020');
  },
  // ---------------------------------------------------------- DIMENSIONAL SHAMBLER
  shambler(ctx, s, t) {
    const w = Math.sin(t * 3), hide = '#2e2637', hideD = '#17121c';
    ctx.save(); ctx.translate(0, Math.abs(w) * -s * 0.05);
    // far arm + legs
    limb(ctx, -s * 0.3, -s * 0.5, -s * 0.5 - w * s * 0.25, s * 0.85, s * 0.3, s * 0.3, s * 0.24, hideD);
    limb(ctx, -s * 0.25, s * 0.25, -s * 0.3 - w * s * 0.2, s * 0.98, -s * 0.12, s * 0.3, s * 0.24, hideD);
    limb(ctx, s * 0.1, s * 0.25, s * 0.15 + w * s * 0.2, s * 0.98, -s * 0.12, s * 0.34, s * 0.26, hide);
    // barrel torso, massive shoulders, no neck
    const torso = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.4);
      ctx.quadraticCurveTo(-s * 0.95, -s * 0.3, -s * 0.5, -s * 0.9);
      ctx.quadraticCurveTo(0, -s * 1.2, s * 0.55, -s * 0.85);
      ctx.quadraticCurveTo(s * 0.85, -s * 0.4, s * 0.5, s * 0.1);
      ctx.quadraticCurveTo(s * 0.35, s * 0.5, -s * 0.5, s * 0.4);
      ctx.closePath();
    };
    solid(ctx, torso, hide, s, 'rgba(200,170,255,0.18)');
    // loose, wrinkled hide
    ctx.save(); torso(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.7;
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.8, -s * 0.8 + i * s * 0.2); ctx.bezierCurveTo(-s * 0.3, -s * 0.9 + i * s * 0.2, s * 0.1, -s * 0.6 + i * s * 0.2, s * 0.7, -s * 0.8 + i * s * 0.2); ctx.stroke(); }
    ctx.restore();
    // head sunk between the shoulders: slack jaw, three eyes
    const hx = s * 0.45, hy = -s * 0.68;
    ctx.fillStyle = '#050305'; ctx.beginPath(); ctx.ellipse(hx + s * 0.12, hy + s * 0.2, s * 0.17, s * 0.1 + Math.abs(Math.sin(t * 2)) * s * 0.06, 0.2, 0, TAU); ctx.fill();
    fangs(ctx, hx - s * 0.02, hy + s * 0.13, hx + s * 0.28, hy + s * 0.16, 4, s * 0.08, '#b8b0c4');
    const hd = () => { ctx.beginPath(); ctx.ellipse(hx, hy, s * 0.3, s * 0.24, 0.2, 0, TAU); };
    solid(ctx, hd, '#3a3045', s, 'rgba(200,170,255,0.2)');
    eyes(ctx, [[hx + s * 0.16, hy - s * 0.04], [hx + s * 0.02, hy - s * 0.1], [hx + s * 0.1, hy + s * 0.04]], 0.7, '#b46cff');
    // near arm: dragging, with enormous hooked talons
    const ax = s * 0.95 + w * s * 0.2, ay = s * 0.82;
    limb(ctx, s * 0.35, -s * 0.55, ax, ay, -s * 0.35, s * 0.4, s * 0.3, hide);
    claws(ctx, ax, ay, 0.5, s * 0.5, 4, 1.2, '#c9c2d6', 1.3);
    ctx.restore();
  },
  // ---------------------------------------------------------- HOUND OF TINDALOS
  hound(ctx, s, t) {
    // it leaks out of angles: a wake of blue-black smoke
    for (let i = 1; i <= 6; i++) { ctx.fillStyle = `rgba(24,40,66,${0.3 - i * 0.04})`; ctx.beginPath(); ctx.arc(-s * 0.5 - i * s * 0.36, Math.sin(t * 5 + i) * s * 0.18 - s * 0.1, s * (0.6 - i * 0.07), 0, TAU); ctx.fill(); }
    const g = t * 12, shard = '#0f1722', edge = 'rgba(110,170,230,0.7)';
    // legs: jagged shards, never quite touching the ground
    for (const [bx, ph] of [[s * 0.55, 0], [s * 0.3, 2], [-s * 0.45, 3.1], [-s * 0.7, 1]]) {
      const k = Math.sin(g + ph) * s * 0.3;
      ctx.fillStyle = shard; ctx.strokeStyle = edge; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(bx - s * 0.14, -s * 0.05); ctx.lineTo(bx + s * 0.14, -s * 0.05); ctx.lineTo(bx + s * 0.18 + k * 0.4, s * 0.45); ctx.lineTo(bx + k, s * 0.98); ctx.lineTo(bx - s * 0.02 + k * 0.4, s * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    const body = () => {
      ctx.beginPath();
      const p = [[1.0, -0.42], [0.72, -0.62], [0.55, -1.02], [0.36, -0.6], [0.05, -0.92], [-0.12, -0.52], [-0.45, -0.8], [-0.52, -0.42], [-0.95, -0.6], [-0.85, -0.12], [-1.25, 0.12], [-0.7, 0.18], [-0.3, 0.3], [0.2, 0.22], [0.7, 0.2], [0.95, -0.05]];
      p.forEach(([x, y], i) => i ? ctx.lineTo(s * x, s * y) : ctx.moveTo(s * x, s * y));
      ctx.closePath();
    };
    solid(ctx, body, shard, s, 'rgba(120,180,255,0.25)', edge);
    ctx.strokeStyle = 'rgba(110,170,230,0.3)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(s * 0.55, -s * 1.0); ctx.lineTo(s * 0.4, s * 0.2); ctx.moveTo(s * 0.05, -s * 0.9); ctx.lineTo(-s * 0.05, s * 0.25); ctx.moveTo(-s * 0.45, -s * 0.8); ctx.lineTo(-s * 0.55, s * 0.2); ctx.stroke();
    // wedge head, split jaw, long hollow tongue
    const jaw = 0.15 + Math.abs(Math.sin(t * 5)) * 0.3;
    ctx.save(); ctx.translate(s * 0.95, -s * 0.2);
    ctx.save(); ctx.rotate(jaw); ctx.fillStyle = shard; ctx.strokeStyle = edge; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(s * 0.62, s * 0.06); ctx.lineTo(-s * 0.05, s * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    fangs(ctx, s * 0.1, s * 0.02, s * 0.55, s * 0.06, 4, -s * 0.1, '#bfe0ff'); ctx.restore();
    tentacle(ctx, s * 0.2, s * 0.05, 0.1 + Math.sin(t * 3) * 0.4, s * 1.1, 1.6, t * 9, '#6a1228', 8, 0.7);
    const hd = () => { ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.3); ctx.lineTo(s * 0.2, -s * 0.36); ctx.lineTo(s * 0.75, -s * 0.02); ctx.lineTo(-s * 0.1, s * 0.05); ctx.closePath(); };
    solid(ctx, hd, '#152030', s, 'rgba(120,180,255,0.3)', edge);
    fangs(ctx, s * 0.15, s * 0.02, s * 0.7, -s * 0.02, 5, s * 0.1, '#bfe0ff');
    eyes(ctx, [[s * 0.18, -s * 0.16]], 0.8, '#7ad8ff', 6);
    ctx.restore();
    // ichor drips
    for (let i = 0; i < 3; i++) { const p = (t * 1.3 + i * 0.37) % 1; ctx.fillStyle = `rgba(90,160,230,${0.7 * (1 - p)})`; ctx.beginPath(); ctx.arc(-s * 0.4 + i * s * 0.45, s * 0.3 + p * s * 0.7, 0.9, 0, TAU); ctx.fill(); }
  },
  // ---------------------------------------------------------- SHOGGOTH
  shoggoth(ctx, s, t, e) {
    const rng = hashRng(e ? e.id : 3);
    // thick pseudopods groping forward
    for (let i = 0; i < 5; i++) tentacle(ctx, s * 0.5, (i - 2) * s * 0.26, (i - 2) * 0.35 + Math.sin(t * 1.3 + i) * 0.35, s * (0.75 + 0.25 * Math.sin(t * 0.9 + i * 2)), s * 0.26, t * 2 + i, '#0d1210', 7, 0.6);
    for (let i = 0; i < 3; i++) tentacle(ctx, -s * 0.5, (i - 1) * s * 0.35, Math.PI + (i - 1) * 0.5, s * 0.5, s * 0.2, t * 1.5 + i * 2, '#0a0e0c', 5, 0.5);
    const blob = () => {
      ctx.beginPath();
      for (let i = 0; i <= 32; i++) {
        const a = i / 32 * TAU;
        const r = s * (1 + 0.12 * Math.sin(a * 3 + t * 2.6) + 0.08 * Math.sin(a * 7 - t * 3.7) + 0.05 * Math.sin(a * 11 + t * 5));
        const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.82;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    blob();
    const g = ctx.createRadialGradient(-s * 0.3, -s * 0.4, 1, 0, 0, s * 1.2);
    g.addColorStop(0, '#2a3531'); g.addColorStop(0.5, '#0f1513'); g.addColorStop(1, '#030504');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); blob(); ctx.clip();
    // oil-slick sheen sliding over the surface
    for (const [hue, ph] of [[280, 0], [160, 2], [40, 4]]) {
      const x = Math.sin(t * 0.6 + ph) * s * 0.6, y = Math.cos(t * 0.5 + ph) * s * 0.4;
      const og = ctx.createRadialGradient(x, y, 0, x, y, s * 0.7);
      og.addColorStop(0, `hsla(${hue},60%,50%,0.16)`); og.addColorStop(1, `hsla(${hue},60%,50%,0)`);
      ctx.fillStyle = og; ctx.fillRect(-s * 1.3, -s * 1.3, s * 2.6, s * 2.6);
    }
    // bubbles swelling and bursting
    for (let i = 0; i < 7; i++) {
      const a = rng() * TAU, d = rng() * s * 0.8, p = (t * (0.3 + rng() * 0.4) + rng()) % 1, r = s * 0.13 * p;
      ctx.strokeStyle = `rgba(150,190,170,${0.35 * (1 - p)})`; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.8, r, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    blob(); ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(190,230,210,0.22)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-s * 0.15, -s * 0.15, s * 0.72, 3.6, 4.9); ctx.stroke();
    // mouths that form, gape and dissolve
    for (let i = 0; i < 3; i++) {
      const a = rng() * TAU, d = (0.2 + rng() * 0.45) * s, mx = Math.cos(a) * d, my = Math.sin(a) * d * 0.8, rot = rng() - 0.5;
      const open = Math.max(0, Math.sin(t * 1.4 + i * 2.1)) * s * 0.16;
      if (open < 0.5) continue;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(rot);
      ctx.fillStyle = '#2a0808'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.26, open, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.2, open * 0.6, 0, 0, TAU); ctx.fill();
      fangs(ctx, -s * 0.2, -open * 0.75, s * 0.2, -open * 0.75, 5, open * 0.6);
      fangs(ctx, -s * 0.2, open * 0.75, s * 0.2, open * 0.75, 5, -open * 0.6);
      ctx.restore();
    }
    // too many eyes, none of them matching
    const n = Math.max(6, Math.round(s / 1.8));
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU + Math.sin(t * 0.3 + i) * 0.4, d = (0.12 + rng() * 0.72) * s, er = 0.9 + rng() * s * 0.09;
      const col = rng() < 0.5 ? '#c8d05a' : '#e0a030', sp = 0.8 + rng();
      const lid = Math.sin(t * sp + i * 1.9);
      if (lid < -0.4) continue;
      const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.82, sq = Math.min(1, (lid + 0.4) * 2.5);
      ctx.fillStyle = '#1a0a08'; ctx.beginPath(); ctx.ellipse(x, y, er * 1.3, er * 1.3 * sq, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b9aa70'; ctx.beginPath(); ctx.ellipse(x, y, er, er * sq, 0, 0, TAU); ctx.fill();
      eyes(ctx, [[x, y]], er * 0.5 * sq, col, 3);
      const lx = Math.cos(t * 0.7 + i) * er * 0.25;
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x + lx, y, er * 0.2, er * 0.7 * sq, 0, 0, TAU); ctx.fill();
    }
  },
  proto(ctx, s, t, e) { EnemyArt.shoggoth(ctx, s, t, e); },
  // ---------------------------------------------------------- STAR-SPAWN
  starspawn(ctx, s, t) {
    const w = Math.sin(t * 2.2), hide = '#24402e', hideD = '#12241a';
    ctx.save(); ctx.translate(-s * 0.35, -s * 0.5); ctx.rotate(-0.35 + Math.sin(t * 1.2) * 0.08);
    batWing(ctx, -1, s * 1.3, Math.sin(t * 1.5), '#0d1d14', 'rgba(70,130,95,0.35)'); ctx.restore();
    limb(ctx, -s * 0.3, s * 0.3, -s * 0.4 - w * s * 0.18, s * 0.98, s * 0.14, s * 0.36, s * 0.3, hideD);
    limb(ctx, -s * 0.25, -s * 0.3, -s * 0.6 - w * s * 0.15, s * 0.5, s * 0.2, s * 0.26, s * 0.2, hideD);
    limb(ctx, s * 0.1, s * 0.3, s * 0.18 + w * s * 0.18, s * 0.98, s * 0.14, s * 0.4, s * 0.32, hide);
    const torso = () => { ctx.beginPath(); ctx.moveTo(-s * 0.55, s * 0.45); ctx.quadraticCurveTo(-s * 0.85, -s * 0.2, -s * 0.4, -s * 0.6); ctx.quadraticCurveTo(s * 0.1, -s * 0.8, s * 0.5, -s * 0.45); ctx.quadraticCurveTo(s * 0.8, 0, s * 0.45, s * 0.45); ctx.quadraticCurveTo(0, s * 0.6, -s * 0.55, s * 0.45); ctx.closePath(); };
    solid(ctx, torso, hide, s, 'rgba(160,240,190,0.16)');
    ctx.save(); torso(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) { ctx.beginPath(); ctx.arc(-s * 0.7 + c * s * 0.26 + (r % 2) * s * 0.13, -s * 0.55 + r * s * 0.24, s * 0.12, 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.restore();
    // face tentacles
    for (let i = 0; i < 9; i++) tentacle(ctx, s * 0.32 + (i - 4) * s * 0.06, -s * 0.5, Math.PI / 2 - 0.35 + (i - 4) * 0.13, s * (0.7 + (i % 3) * 0.12), 2.6, t * 2.5 + i, i % 2 ? '#2f5a3e' : '#284a34', 8, 0.6);
    const hd = () => { ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.5); ctx.quadraticCurveTo(-s * 0.3, -s * 1.3, s * 0.3, -s * 1.42); ctx.quadraticCurveTo(s * 0.85, -s * 1.3, s * 0.72, -s * 0.6); ctx.quadraticCurveTo(s * 0.4, -s * 0.38, -s * 0.1, -s * 0.5); ctx.closePath(); };
    solid(ctx, hd, '#2c4f39', s, 'rgba(160,240,190,0.22)');
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(s * 0.3, -s * 1.25 + i * s * 0.14, s * 0.26, 0.5, Math.PI - 0.5); ctx.stroke(); }
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(s * 0.56, -s * 0.76, s * 0.13, s * 0.05, 0.6, 0, TAU); ctx.ellipse(s * 0.22, -s * 0.72, s * 0.12, s * 0.05, 0.35, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.56, -s * 0.76], [s * 0.22, -s * 0.72]], 0.9, '#ff2a14', 7);
    ctx.strokeStyle = '#142a1c'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * 0.06, -s * 0.9); ctx.lineTo(s * 0.34, -s * 0.78); ctx.moveTo(s * 0.44, -s * 0.9); ctx.lineTo(s * 0.72, -s * 0.74); ctx.stroke();
    const ax = s * 1.1 + w * s * 0.1, ay = s * 0.3 + Math.sin(t * 1.7) * s * 0.12;
    limb(ctx, s * 0.3, -s * 0.3, ax, ay, s * 0.26, s * 0.3, s * 0.22, hide);
    claws(ctx, ax, ay, 0.2, s * 0.36, 4, 1.4, '#b5b79a', 1.2);
  },
  // ---------------------------------------------------------- FATHER DAGON
  dagon(ctx, s, t) {
    // kelp and rotting nets dragging behind
    for (let i = 0; i < 5; i++) tentacle(ctx, -s * 0.5, -s * 0.3 + i * s * 0.2, Math.PI - 0.5 + i * 0.25, s * 0.8, 2, t * 2 + i, '#1c2d1a', 6, 0.7);
    EnemyArt.deepone(ctx, s, t);
    // barnacles crusting the hide
    ctx.fillStyle = '#9a947c'; ctx.strokeStyle = '#2a271e'; ctx.lineWidth = 0.6;
    for (const [x, y] of [[-0.55, 0.0], [-0.42, -0.3], [-0.6, 0.3], [-0.2, 0.4], [-0.3, -0.5]]) { ctx.beginPath(); ctx.arc(s * x, s * y, s * 0.06, 0, TAU); ctx.fill(); ctx.stroke(); }
    // crown of coral and drowned men's bones
    ctx.save(); ctx.translate(s * 0.3, -s * 1.12 + Math.abs(Math.sin(t * 4)) * -s * 0.04);
    ctx.fillStyle = '#bdb292'; ctx.strokeStyle = '#2e281c'; ctx.lineWidth = 0.8;
    const spikes = [[-0.5, -0.38, -0.12], [-0.28, -0.62, 0], [-0.05, -0.82, 0.05], [0.2, -0.6, 0.1], [0.42, -0.42, 0.2]];
    ctx.beginPath(); ctx.moveTo(-s * 0.56, s * 0.06);
    for (const [x, y, lean] of spikes) { ctx.lineTo(s * (x - 0.1), -s * 0.05); ctx.lineTo(s * (x + lean), s * y); ctx.lineTo(s * (x + 0.1), -s * 0.05); }
    ctx.lineTo(s * 0.56, s * 0.04); ctx.quadraticCurveTo(0, s * 0.22, -s * 0.56, s * 0.06); ctx.closePath(); ctx.fill(); ctx.stroke();
    eyes(ctx, [[0, -s * 0.02]], s * 0.08, '#3affc0', 10);
    ctx.restore();
  },
  // ---------------------------------------------------------- THE HAUNTER OF THE DARK (top-down)
  haunter(ctx, s, t) {
    for (let i = 0; i < 8; i++) { ctx.fillStyle = `rgba(0,0,0,${0.38 - i * 0.04})`; ctx.beginPath(); ctx.arc(Math.sin(t * 1.3 + i) * s * 0.45, s * (0.5 + i * 0.24), s * (0.7 - i * 0.06), 0, TAU); ctx.fill(); }
    const flap = Math.sin(t * 3.5);
    batWing(ctx, -1, s * 2.1, flap, '#030306', 'rgba(170,40,30,0.4)', 'rgba(120,20,20,0.5)');
    batWing(ctx, 1, s * 2.1, flap, '#030306', 'rgba(170,40,30,0.4)', 'rgba(120,20,20,0.5)');
    for (let i = 0; i < 6; i++) tentacle(ctx, (i - 2.5) * s * 0.14, s * 0.6, Math.PI / 2 + (i - 2.5) * 0.25, s * 1.0, 3, t * 3 + i, '#06060a', 7, 0.8);
    const b = () => { ctx.beginPath(); ctx.moveTo(0, -s * 0.95); ctx.quadraticCurveTo(s * 0.8, -s * 0.5, s * 0.5, s * 0.5); ctx.quadraticCurveTo(0, s * 1.0, -s * 0.5, s * 0.5); ctx.quadraticCurveTo(-s * 0.8, -s * 0.5, 0, -s * 0.95); ctx.closePath(); };
    solid(ctx, b, '#07070c', s, 'rgba(255,90,60,0.12)', 'rgba(170,40,30,0.45)');
    // the three-lobed burning eye
    const pulse = 0.85 + 0.15 * Math.sin(t * 6);
    const eg = ctx.createRadialGradient(0, -s * 0.2, 0, 0, -s * 0.2, s * 0.6);
    eg.addColorStop(0, `rgba(255,70,30,${0.5 * pulse})`); eg.addColorStop(1, 'rgba(255,40,10,0)');
    ctx.fillStyle = eg; ctx.fillRect(-s, -s, s * 2, s * 2);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * TAU / 3 + Math.sin(t) * 0.1, x = Math.cos(a) * s * 0.2, y = -s * 0.2 + Math.sin(a) * s * 0.2;
      eyes(ctx, [[x, y]], s * 0.15 * pulse, '#ff3a1a', 14);
      ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(x, y, s * 0.05, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.02, s * 0.1, a, 0, TAU); ctx.fill();
    }
  },
  // ---------------------------------------------------------- THE DUNWICH HORROR
  dunwich(ctx, s, t) {
    // a tangle of ropy limbs, each ending in a sucking mouth
    for (let i = 0; i < 14; i++) {
      const [ex, ey] = tentacle(ctx, 0, 0, i / 14 * TAU + Math.sin(t * 0.7 + i) * 0.3, s * (1.2 + (i % 3) * 0.15), 5 - (i % 2), t * 2 + i, i % 2 ? '#514a5a' : '#463f4f', 10, 0.8);
      if (i % 2 === 0) { ctx.fillStyle = '#8a2a2a'; ctx.beginPath(); ctx.arc(ex, ey, 2.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex, ey, 1.2, 0, TAU); ctx.fill(); }
    }
    const mass = () => { ctx.beginPath(); for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU, r = s * (0.78 + 0.08 * Math.sin(a * 5 + t * 2)); const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.85; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); };
    solid(ctx, mass, '#4a4354', s, 'rgba(220,200,255,0.18)');
    // great goat-like legs half seen
    ctx.save(); mass(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(Math.sin(i * 2.3) * s * 0.5, Math.cos(i * 1.7) * s * 0.4, s * 0.3, i, i + 2.2); ctx.stroke(); }
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + 0.4, mx = Math.cos(a) * s * 0.48, my = Math.sin(a) * s * 0.36 + s * 0.12, o = Math.max(0, Math.sin(t * 2 + i * 1.4)) * s * 0.1 + 0.6;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(a);
      ctx.fillStyle = '#1a0406'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.15, o, 0, 0, TAU); ctx.fill();
      if (o > 2) fangs(ctx, -s * 0.12, -o * 0.7, s * 0.12, -o * 0.7, 4, o * 0.6);
      ctx.restore();
    }
    eyes(ctx, [[-s * 0.4, -s * 0.05], [s * 0.42, s * 0.02], [-s * 0.1, s * 0.3], [s * 0.15, -s * 0.15], [-s * 0.25, -s * 0.32]], 1.7, '#b0ff40', 8);
    // and on top, half a man's face — Wilbur's
    ctx.save(); ctx.translate(s * 0.05, -s * 0.72); ctx.rotate(Math.sin(t * 0.8) * 0.15);
    const face = () => { ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.2); ctx.quadraticCurveTo(0, -s * 0.36, s * 0.2, -s * 0.2); ctx.quadraticCurveTo(s * 0.24, s * 0.1, 0, s * 0.3); ctx.quadraticCurveTo(-s * 0.24, s * 0.1, -s * 0.2, -s * 0.2); ctx.closePath(); };
    solid(ctx, face, '#a79a84', s, 'rgba(255,255,240,0.2)');
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(-s * 0.09, -s * 0.06, s * 0.055, s * 0.04, 0, 0, TAU); ctx.ellipse(s * 0.09, -s * 0.06, s * 0.055, s * 0.04, 0, 0, TAU); ctx.fill();
    eyes(ctx, [[-s * 0.09, -s * 0.06], [s * 0.09, -s * 0.06]], 0.8, '#fff0d0', 2);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 0.07, s * 0.05 + Math.abs(Math.sin(t * 3)) * s * 0.05, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
  // ---------------------------------------------------------- NYARLATHOTEP
  nyarlathotep(ctx, s, t) {
    const ag = ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 1.6);
    ag.addColorStop(0, 'rgba(60,0,80,0.45)'); ag.addColorStop(1, 'rgba(30,0,40,0)');
    ctx.fillStyle = ag; ctx.fillRect(-s * 1.7, -s * 1.7, s * 3.4, s * 3.4);
    // the robe ends in things that are not feet
    for (let i = 0; i < 9; i++) tentacle(ctx, (i - 4) * s * 0.17, s * 0.85, Math.PI / 2 + (i - 4) * 0.28, s * (0.7 + (i % 2) * 0.3), 3.5, t * 2 + i, '#07060b', 8, 0.9);
    // long arms, too many joints, spread in benediction
    for (const sd of [-1, 1]) {
      const hx = sd * s * 1.2, hy = -s * 0.3 + Math.sin(t * 1.5 + sd) * s * 0.15;
      limb(ctx, sd * s * 0.3, -s * 0.15, hx, hy, sd * s * 0.3, s * 0.2, s * 0.13, '#0a090e', 'rgba(140,110,50,0.5)');
      claws(ctx, hx, hy, sd > 0 ? -0.6 : Math.PI + 0.6, s * 0.4, 5, 1.6, '#1a1820', 1.1);
    }
    const robe = () => { ctx.beginPath(); ctx.moveTo(-s * 0.85, s * 1.0); ctx.quadraticCurveTo(-s * 0.5, s * 0.2, -s * 0.36, -s * 0.3); ctx.lineTo(s * 0.36, -s * 0.3); ctx.quadraticCurveTo(s * 0.5, s * 0.2, s * 0.85, s * 1.0); ctx.quadraticCurveTo(0, s * 1.15, -s * 0.85, s * 1.0); ctx.closePath(); };
    solid(ctx, robe, '#08070c', s, 'rgba(150,90,200,0.2)', 'rgba(140,110,50,0.4)');
    // broad collar
    ctx.fillStyle = '#6f5c22'; ctx.strokeStyle = '#1a1408'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.28); ctx.quadraticCurveTo(0, s * 0.2, s * 0.42, -s * 0.28); ctx.quadraticCurveTo(0, -s * 0.12, -s * 0.42, -s * 0.28); ctx.fill(); ctx.stroke();
    eyes(ctx, [[0, -s * 0.03]], s * 0.06, '#ff1838', 6);
    // nemes headdress
    const nem = () => { ctx.beginPath(); ctx.moveTo(-s * 0.7, s * 0.15); ctx.lineTo(-s * 0.48, -s * 1.0); ctx.quadraticCurveTo(0, -s * 1.3, s * 0.48, -s * 1.0); ctx.lineTo(s * 0.7, s * 0.15); ctx.lineTo(s * 0.34, -s * 0.22); ctx.lineTo(-s * 0.34, -s * 0.22); ctx.closePath(); };
    solid(ctx, nem, '#8a7230', s, 'rgba(255,230,150,0.3)');
    ctx.save(); nem(); ctx.clip(); ctx.strokeStyle = '#161c3a'; ctx.lineWidth = 2.2;
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.8, s * 0.1 - i * s * 0.2); ctx.quadraticCurveTo(0, s * 0.22 - i * s * 0.2, s * 0.8, s * 0.1 - i * s * 0.2); ctx.stroke(); }
    ctx.restore();
    // uraeus, and where the face should be: nothing
    ctx.strokeStyle = '#c9a840'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -s * 0.95); ctx.quadraticCurveTo(s * 0.12, -s * 1.25, 0, -s * 1.38); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, -s * 0.55, s * 0.3, s * 0.4, 0, 0, TAU); ctx.fill();
    const vg = ctx.createRadialGradient(0, -s * 0.55, 0, 0, -s * 0.55, s * 0.3);
    vg.addColorStop(0, `rgba(90,0,120,${0.3 + 0.2 * Math.sin(t * 2)})`); vg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vg; ctx.beginPath(); ctx.ellipse(0, -s * 0.55, s * 0.3, s * 0.4, 0, 0, TAU); ctx.fill();
    eyes(ctx, [[-s * 0.11, -s * 0.6], [s * 0.11, -s * 0.6]], 1.4, '#ff1838', 9);
  },
  // ---------------------------------------------------------- GREAT CTHULHU
  cthulhu(ctx, s, t) {
    const flap = Math.sin(t * 1.2), hide = '#1d3a28', hideD = '#0e1e15';
    batWing(ctx, -1, s * 2.1, flap, '#0a160e', 'rgba(80,150,105,0.4)', 'rgba(20,50,30,0.8)');
    batWing(ctx, 1, s * 2.1, flap, '#0a160e', 'rgba(80,150,105,0.4)', 'rgba(20,50,30,0.8)');
    // squat legs
    for (const sd of [-1, 1]) { limb(ctx, sd * s * 0.4, s * 0.7, sd * s * 0.55, s * 1.25 + Math.sin(t * 1.5 + sd) * s * 0.04, sd * s * 0.2, s * 0.5, s * 0.4, hideD); claws(ctx, sd * s * 0.55, s * 1.28, Math.PI / 2, s * 0.22, 3, 1.4, '#8f927a', 1.4); }
    // bloated body
    const body = () => { ctx.beginPath(); ctx.moveTo(0, -s * 0.2); ctx.quadraticCurveTo(s * 1.1, -s * 0.2, s * 0.95, s * 0.6); ctx.quadraticCurveTo(s * 0.7, s * 1.25, 0, s * 1.2); ctx.quadraticCurveTo(-s * 0.7, s * 1.25, -s * 0.95, s * 0.6); ctx.quadraticCurveTo(-s * 1.1, -s * 0.2, 0, -s * 0.2); ctx.closePath(); };
    solid(ctx, body, hide, s, 'rgba(160,240,190,0.16)');
    ctx.save(); body(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 0.9;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 9; c++) { ctx.beginPath(); ctx.arc(-s * 0.95 + c * s * 0.24 + (r % 2) * s * 0.12, -s * 0.05 + r * s * 0.2, s * 0.12, 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(150,170,130,0.14)'; ctx.beginPath(); ctx.ellipse(0, s * 0.7, s * 0.5, s * 0.45, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // arms spread wide, talons flexing
    for (const sd of [-1, 1]) {
      const cx = sd * s * 1.35, cy = s * 0.35 + Math.sin(t * 1.5 + sd) * s * 0.2;
      limb(ctx, sd * s * 0.75, s * 0.1, cx, cy, -sd * s * 0.4, s * 0.36, s * 0.26, hide);
      claws(ctx, cx, cy, Math.PI / 2 - sd * 0.5, s * 0.42, 4, 1.3, '#a3a68c', 1.6);
    }
    // the face: a writhing mass of feelers
    for (let i = 0; i < 13; i++) tentacle(ctx, (i - 6) * s * 0.065, -s * 0.12, Math.PI / 2 + (i - 6) * 0.1, s * (1.0 + (i % 3) * 0.22), 5.5, t * 1.8 + i * 0.7, i % 2 ? '#2e5a3d' : '#264a32', 11, 0.7);
    const head = () => { ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.1); ctx.quadraticCurveTo(-s * 0.85, -s * 1.0, 0, -s * 1.2); ctx.quadraticCurveTo(s * 0.85, -s * 1.0, s * 0.5, -s * 0.1); ctx.quadraticCurveTo(0, s * 0.1, -s * 0.5, -s * 0.1); ctx.closePath(); };
    solid(ctx, head, '#2b5239', s, 'rgba(160,240,190,0.25)');
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.1;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(0, -s * 1.05 + i * s * 0.14, s * (0.28 + i * 0.05), 0.55, Math.PI - 0.55); ctx.stroke(); }
    // deep-set eyes under a heavy brow
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(sd * s * 0.27, -s * 0.36, s * 0.15, s * 0.08, sd * -0.35, 0, TAU); ctx.fill();
      eyes(ctx, [[sd * s * 0.27, -s * 0.36]], s * 0.07, '#ff5a10', 14);
      eyes(ctx, [[sd * s * 0.5, -s * 0.55], [sd * s * 0.42, -s * 0.2]], s * 0.03, '#ff5a10', 6);
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(sd * s * 0.27, -s * 0.36, s * 0.015, s * 0.06, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#173022'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sd * s * 0.08, -s * 0.4); ctx.quadraticCurveTo(sd * s * 0.3, -s * 0.56, sd * s * 0.5, -s * 0.42); ctx.stroke();
    }
  },
};

const ICHOR = { cultist: '#3a080b', ghoul: '#26261a', deepone: '#0c2a20', nightgaunt: '#09090f', migo: '#3a1a2c', byakhee: '#2a1d14',
  shambler: '#1d1228', hound: '#0e1a2c', shoggoth: '#08110c', proto: '#08110c', starspawn: '#0c2014', scorch: '#050505' };

function drawEnemyBody(ctx, type, s, t, e) { (EnemyArt[type] || EnemyArt.cultist)(ctx, s, t, e); }

// ---------------- tower art ----------------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// A worn flagstone dais every defense stands on.
function drawTowerBase(ctx, def, level) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(1, 5, 18, 15, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, 18);
  g.addColorStop(0, '#5d5850'); g.addColorStop(1, '#2b2824');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, TAU); ctx.stroke();
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10.5, Math.sin(a) * 10.5); ctx.lineTo(Math.cos(a) * 16.5, Math.sin(a) * 16.5); ctx.stroke(); }
  ctx.strokeStyle = '#15130f'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, 16.5, 0, TAU); ctx.stroke();
  ctx.strokeStyle = def.color; ctx.globalAlpha *= 0.7; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.stroke(); ctx.globalAlpha /= 0.7;
  // brass studs mark the tier
  for (let i = 0; i < level; i++) {
    const a = Math.PI / 2 + (i - (level - 1) / 2) * 0.42, x = Math.cos(a) * 13.2, y = Math.sin(a) * 13.2;
    ctx.fillStyle = '#3a2c10'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
  }
}
function fired(t, window = 0.07) { return t.stats && t.stats.rate && t.cd > 1 / t.stats.rate - window; }
function flame(ctx, x, y, r, time, seed = 0) {
  const f = 0.8 + 0.2 * Math.sin(time * 17 + seed);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3 * f);
  g.addColorStop(0, 'rgba(255,190,90,0.55)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); ctx.restore();
  ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.ellipse(x, y - r * 0.4, r * 0.55, r * 1.1 * f, 0, 0, TAU); ctx.fill();
}

const TowerArt = {
  // -------- Militia Marksman: a rifleman in a sandbag nest
  rifle(ctx, t, lvl, time) {
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU, x = Math.cos(a) * 11.5, y = Math.sin(a) * 11.5;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = i % 2 ? '#6f6247' : '#7d6f51'; ctx.strokeStyle = '#2a2418'; ctx.lineWidth = 0.7;
      roundRect(ctx, -4.4, -2.6, 8.8, 5.2, 2.2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    const coat = ['#7a5c3a', '#5f6a44', '#4c5166', '#3a3e50'][lvl], hat = ['#a08050', '#7a8656', '#6a7088', '#22242c'][lvl];
    const kick = fired(t) ? -2 : 0;
    ctx.save(); ctx.rotate(t.angle); ctx.translate(kick, 0);
    // rifle: stock, barrel, and at higher tiers a scope
    ctx.fillStyle = '#8a5a30'; ctx.strokeStyle = '#140c06'; ctx.lineWidth = 0.7;
    roundRect(ctx, 0, -1.8 - lvl * 0.15, 9, 3.6 + lvl * 0.3, 1); ctx.fill(); ctx.stroke();
    ctx.fillStyle = lvl >= 3 ? '#e4e8ee' : '#9aa0a8';
    ctx.fillRect(8, -1 - lvl * 0.12, 10 + lvl * 1.6, 2 + lvl * 0.24); ctx.strokeRect(8, -1 - lvl * 0.12, 10 + lvl * 1.6, 2 + lvl * 0.24);
    if (lvl >= 2) { ctx.fillStyle = '#111'; ctx.fillRect(4, -2.6, 6, 1.6); ctx.fillStyle = '#8fd0ff'; ctx.fillRect(9.4, -2.5, 0.9, 1.4); }
    if (fired(t)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,220,140,0.9)'; ctx.beginPath(); ctx.moveTo(18 + lvl * 1.6, 0); ctx.lineTo(24 + lvl * 2, -3); ctx.lineTo(29 + lvl * 2, 0); ctx.lineTo(24 + lvl * 2, 3); ctx.closePath(); ctx.fill(); ctx.restore(); }
    // arms, shoulders
    ctx.strokeStyle = coat; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-1, -4.5); ctx.lineTo(7, -1); ctx.moveTo(-1, 4.5); ctx.lineTo(3, 1); ctx.stroke();
    ctx.fillStyle = coat; ctx.strokeStyle = '#0e0b08'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(-2, 0, 4, 6.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // hat with brim
    ctx.fillStyle = hat; ctx.beginPath(); ctx.arc(-1, 0, 4.6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = lvl >= 3 ? '#c9ced6' : '#2a1e12'; ctx.beginPath(); ctx.arc(-1.4, 0, 2.9, 0, TAU); ctx.fill();
    ctx.fillStyle = hat; ctx.beginPath(); ctx.arc(-1.4, 0, 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  },
  // -------- Dynamite Mortar: a stubby tube in a timbered pit
  mortar(ctx, t, lvl, time) {
    ctx.fillStyle = '#17120c'; ctx.beginPath(); ctx.arc(0, 0, 12.5, 0, TAU); ctx.fill();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      ctx.save(); ctx.rotate(a); ctx.fillStyle = i % 2 ? '#5a4128' : '#4c3722'; ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 0.6;
      ctx.fillRect(10, -3.2, 3.6, 6.4); ctx.strokeRect(10, -3.2, 3.6, 6.4); ctx.restore();
    }
    // crate of dynamite
    ctx.save(); ctx.translate(-7, 7); ctx.rotate(-0.3);
    ctx.fillStyle = '#4a3520'; ctx.strokeStyle = '#140d06'; ctx.lineWidth = 0.6; ctx.fillRect(-4, -3, 8, 6); ctx.strokeRect(-4, -3, 8, 6);
    for (let i = 0; i < 3 + Math.min(lvl, 1); i++) { ctx.fillStyle = lvl >= 3 ? '#ff7a30' : '#b02a1c'; ctx.fillRect(-3.2 + i * 1.9, -2.2, 1.4, 4.4); }
    ctx.restore();
    const rec = fired(t, 0.18) ? -2.5 : 0;
    ctx.save(); ctx.rotate(t.angle);
    ctx.strokeStyle = '#2a2a2c'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-4, -7); ctx.moveTo(4, 0); ctx.lineTo(-4, 7); ctx.stroke();
    ctx.fillStyle = '#3a3a3e'; ctx.strokeStyle = '#0a0a0c'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(-4, 0, 4.4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.translate(rec, 0);
    const w = 4.2 + lvl * 0.5;
    const g = ctx.createLinearGradient(0, -w, 0, w); g.addColorStop(0, '#6a6c72'); g.addColorStop(0.5, '#3a3c42'); g.addColorStop(1, '#1c1d20');
    ctx.fillStyle = g; roundRect(ctx, -4, -w, 15 + lvl, w * 2, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8a7a40'; ctx.fillRect(1, -w, 1.6, w * 2); ctx.fillRect(7, -w, 1.6, w * 2);
    ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.ellipse(11 + lvl, 0, 1.6, w - 1.2, 0, 0, TAU); ctx.fill();
    if (fired(t, 0.1)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const fg = ctx.createRadialGradient(14 + lvl, 0, 0, 14 + lvl, 0, 10); fg.addColorStop(0, 'rgba(255,200,110,0.9)'); fg.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = fg; ctx.fillRect(4, -10, 22, 20); ctx.restore(); }
    ctx.restore();
  },
  // -------- Elder Sign Ward: a carved menhir that hates them back
  ward(ctx, t, lvl, time) {
    const a = (t.anim || 0) * 0.35, glow = 0.55 + 0.25 * Math.sin(time * 3 + (t.id || 0));
    // chalked ring of runes turning on the flagstones
    ctx.save(); ctx.rotate(a); ctx.strokeStyle = `rgba(120,255,180,${0.35 + lvl * 0.08})`; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(0, 0, 12.5, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8 + lvl * 2; i++) { ctx.save(); ctx.rotate(i / (8 + lvl * 2) * TAU); ctx.beginPath(); ctx.moveTo(10.2, -1.2); ctx.lineTo(12.5, 0); ctx.lineTo(10.2, 1.2); if (i % 2) { ctx.moveTo(9, 0); ctx.lineTo(10.4, 0); } ctx.stroke(); ctx.restore(); }
    ctx.restore();
    // the stone
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(2, 9, 9, 3.5, 0, 0, TAU); ctx.fill();
    const stone = () => { ctx.beginPath(); ctx.moveTo(-7.5, 9); ctx.lineTo(-8.5, -8); ctx.lineTo(-5, -18 - lvl); ctx.lineTo(2, -21 - lvl); ctx.lineTo(7.5, -14); ctx.lineTo(8.5, 9); ctx.closePath(); };
    stone(); const g = ctx.createLinearGradient(-9, 0, 9, 0); g.addColorStop(0, '#6c6f6a'); g.addColorStop(0.55, '#4b4e4a'); g.addColorStop(1, '#2a2c2a'); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#0e0f0e'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-4, -17); ctx.lineTo(-2, -9); ctx.lineTo(-5, -2); ctx.moveTo(5, -10); ctx.lineTo(3, 2); ctx.stroke();
    ctx.fillStyle = 'rgba(70,110,60,0.5)'; ctx.beginPath(); ctx.ellipse(-5, 6, 3.5, 2.5, 0, 0, TAU); ctx.ellipse(6, 7, 2.5, 2, 0, 0, TAU); ctx.fill();
    // the sign itself: a warped star around a burning eye
    ctx.save(); ctx.translate(0, -6); halo(ctx, 0, 0, 11 + lvl * 2, '#7affb0', 0.3 + lvl * 0.06);
    ctx.strokeStyle = `rgba(${150 + lvl * 20},255,${190 + lvl * 15},${glow + 0.2})`; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
    ctx.beginPath(); for (let i = 0; i <= 5; i++) { const an = -Math.PI / 2 + i * 2 * TAU / 5, r = i % 2 ? 6.2 : 6.8; const x = Math.cos(an) * r, y = Math.sin(an) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    ctx.restore();
    flame(ctx, 0, -5.5, 1.5, time, t.id || 0);
    if (lvl >= 1) { ctx.fillStyle = '#d8ceb0'; ctx.fillRect(-12.5, 5, 1.6, 4); ctx.fillRect(11, 5, 1.6, 4); flame(ctx, -11.7, 4.2, 0.9, time, 1); flame(ctx, 11.8, 4.2, 0.9, time, 2); }
    if (lvl >= 3) for (let i = 0; i < 3; i++) { const an = time * 0.9 + i * TAU / 3; ctx.fillStyle = '#9affc8'; ctx.save(); ctx.translate(Math.cos(an) * 12, -12 + Math.sin(an) * 4); ctx.rotate(an * 2); ctx.fillRect(-1.2, -1.2, 2.4, 2.4); ctx.restore(); }
  },
  // -------- Tesla Coil
  tesla(ctx, t, lvl, time) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(2, 9, 10, 4, 0, 0, TAU); ctx.fill();
    // riveted iron footing and cables
    ctx.strokeStyle = '#1a1a1e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-9, 9); ctx.quadraticCurveTo(-14, 4, -13, -2); ctx.moveTo(9, 9); ctx.quadraticCurveTo(13, 12, 14, 5); ctx.stroke();
    ctx.fillStyle = '#34363c'; ctx.strokeStyle = '#0c0c0e'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-10, 11); ctx.lineTo(-7, 3); ctx.lineTo(7, 3); ctx.lineTo(10, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8a7a40'; for (const x of [-7, 0, 7]) { ctx.beginPath(); ctx.arc(x, 8.5, 0.9, 0, TAU); ctx.fill(); }
    // primary winding
    ctx.strokeStyle = '#b06a30'; ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 3 - i * 2.2, 7.5 - i * 0.6, 2.2, 0, 0, TAU); ctx.stroke(); }
    // stacked ceramic insulators
    const n = 5 + lvl;
    for (let i = 0; i < n; i++) {
      const y = -3 - i * 2.6, w = 5.2 - i * 0.28;
      const g = ctx.createLinearGradient(-w, 0, w, 0); g.addColorStop(0, '#d9d2c2'); g.addColorStop(0.5, '#8f8a7e'); g.addColorStop(1, '#3e3c36');
      ctx.fillStyle = g; ctx.strokeStyle = '#141412'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.ellipse(0, y, w, 1.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }
    const top = -3 - n * 2.6 - 1.5;
    // copper toroid + terminal
    ctx.strokeStyle = '#0c0c0e'; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.ellipse(0, top, 7 + lvl * 0.6, 2.4, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#c9803a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, top, 7 + lvl * 0.6, 2.4, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,170,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(0, top - 0.7, 6.4 + lvl * 0.6, 1.8, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.save(); halo(ctx, 0, top - 3, 9 + lvl * 2, '#80c0ff', 0.7);
    ctx.fillStyle = '#d6ecff'; ctx.beginPath(); ctx.arc(0, top - 3, 2.8 + lvl * 0.4, 0, TAU); ctx.fill(); ctx.restore();
    // crawling arcs
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(170,215,255,0.85)'; ctx.lineWidth = 0.9;
    const arcs = fired(t, 0.15) ? 5 : 1 + (Math.random() < 0.4 ? 1 : 0);
    for (let k = 0; k < arcs; k++) {
      const a = Math.random() * TAU, len = 6 + Math.random() * (fired(t, 0.15) ? 12 : 6);
      ctx.beginPath(); let x = 0, y = top - 3; ctx.moveTo(x, y);
      for (let i = 0; i < 4; i++) { x += Math.cos(a) * len / 4 + (Math.random() - 0.5) * 4; y += Math.sin(a) * len / 4 * 0.7 + (Math.random() - 0.5) * 4; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
  },
  // -------- Occult Scholar: reading aloud inside a chalk circle
  scholar(ctx, t, lvl, time) {
    ctx.save(); ctx.rotate(time * 0.4); ctx.strokeStyle = `rgba(200,140,255,${0.45 + lvl * 0.08})`; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke();
    ctx.beginPath(); for (let i = 0; i <= 3; i++) { const a = i * TAU / 3; i ? ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13) : ctx.moveTo(13, 0); } ctx.stroke();
    if (lvl >= 2) { ctx.beginPath(); for (let i = 0; i <= 3; i++) { const a = i * TAU / 3 + Math.PI; i ? ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13) : ctx.moveTo(-13, 0); } ctx.stroke(); }
    ctx.restore();
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.5, x = Math.cos(a) * 13, y = Math.sin(a) * 11; ctx.fillStyle = '#d8ceb0'; ctx.fillRect(x - 0.8, y - 2, 1.6, 3.5); flame(ctx, x, y - 2.8, 0.9, time, i); }
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(1, 9, 7, 3, 0, 0, TAU); ctx.fill();
    // robes
    const robe = () => { ctx.beginPath(); ctx.moveTo(-7.5, 10); ctx.quadraticCurveTo(-6, -2, -3.5, -7); ctx.lineTo(3.5, -7); ctx.quadraticCurveTo(6, -2, 7.5, 10); ctx.quadraticCurveTo(0, 12, -7.5, 10); ctx.closePath(); };
    robe(); const g = ctx.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, ['#4a2d68', '#4a2d68', '#3a2a70', '#2a2460'][lvl]); g.addColorStop(1, '#170d24'); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#08040e'; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.strokeStyle = lvl >= 2 ? '#c9a840' : 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 10.5); ctx.stroke();
    // head: spectacles catching the light
    ctx.fillStyle = '#c9b594'; ctx.beginPath(); ctx.arc(0, -10, 3.6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1e1230'; ctx.beginPath(); ctx.arc(0, -11.2, 3.9, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    ctx.fillStyle = '#bfe0ff'; ctx.beginPath(); ctx.arc(-1.4, -9.8, 0.9, 0, TAU); ctx.arc(1.4, -9.8, 0.9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a6258'; ctx.beginPath(); ctx.moveTo(-2.2, -7.6); ctx.quadraticCurveTo(0, -4.5, 2.2, -7.6); ctx.closePath(); ctx.fill();
    // the open book and what rises from it
    ctx.strokeStyle = '#2a1c3a'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(-3.5, 1.5); ctx.moveTo(5, -3); ctx.lineTo(3.5, 1.5); ctx.stroke();
    ctx.fillStyle = '#3a1e14'; ctx.strokeStyle = '#0c0604'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-6.5, 0); ctx.lineTo(0, 1.6); ctx.lineTo(6.5, 0); ctx.lineTo(6.5, 4.5); ctx.lineTo(0, 6); ctx.lineTo(-6.5, 4.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e4d8b4'; ctx.beginPath(); ctx.moveTo(-5.6, 0.6); ctx.lineTo(0, 2); ctx.lineTo(5.6, 0.6); ctx.lineTo(5.6, 3.8); ctx.lineTo(0, 5.2); ctx.lineTo(-5.6, 3.8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,20,0.6)'; ctx.lineWidth = 0.4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-4.8, 1.4 + i * 0.9); ctx.lineTo(-0.8, 2.4 + i * 0.9); ctx.moveTo(0.8, 2.4 + i * 0.9); ctx.lineTo(4.8, 1.4 + i * 0.9); ctx.stroke(); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const charge = fired(t, 0.2) ? 1.6 : 1, oy = -17 - lvl + Math.sin(time * 2.5) * 1.2;
    const og = ctx.createRadialGradient(0, oy, 0, 0, oy, 8 * charge);
    og.addColorStop(0, 'rgba(230,200,255,0.95)'); og.addColorStop(0.3, 'rgba(180,110,255,0.6)'); og.addColorStop(1, 'rgba(120,40,220,0)');
    ctx.fillStyle = og; ctx.fillRect(-13, oy - 13, 26, 26);
    ctx.strokeStyle = 'rgba(210,170,255,0.8)'; ctx.lineWidth = 0.7;
    for (let i = 0; i <= lvl; i++) { ctx.beginPath(); ctx.ellipse(0, oy, 4 + i * 1.6, 1.6 + i * 0.6, time * (1.5 + i) + i, 0, TAU); ctx.stroke(); }
    ctx.restore();
  },
  // -------- Lighthouse Beam
  lighthouse(ctx, t, lvl, time) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(3, 10, 11, 4, 0, 0, TAU); ctx.fill();
    // rocks
    ctx.fillStyle = '#3c3b38'; ctx.strokeStyle = '#121211'; ctx.lineWidth = 0.7;
    for (const [x, y, r] of [[-9, 9, 4], [8, 10, 4.5], [-2, 12, 3.5], [11, 5, 2.5]]) { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0.3, 0, TAU); ctx.fill(); ctx.stroke(); }
    const h = 25 + lvl * 1.5;
    const tower = () => { ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(-4.6, 10 - h); ctx.lineTo(4.6, 10 - h); ctx.lineTo(8, 10); ctx.closePath(); };
    tower(); const g = ctx.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, '#f1ead8'); g.addColorStop(0.5, '#b9b2a0'); g.addColorStop(1, '#5a564c'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); tower(); ctx.clip();
    ctx.fillStyle = '#8f2a26'; ctx.fillRect(-9, 3, 18, 4.5); ctx.fillRect(-9, -7, 18, 4.5);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(1.5, -20, 9, 32);
    ctx.restore();
    tower(); ctx.strokeStyle = '#141310'; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.fillStyle = '#12100c'; roundRect(ctx, -1.6, 5.5, 3.2, 4.5, 1.4); ctx.fill(); ctx.fillRect(-1, -3, 2, 2.6);
    // gallery, lantern room, cap
    const gy = 10 - h;
    ctx.fillStyle = '#24231f'; ctx.fillRect(-7, gy - 1.5, 14, 2.4);
    ctx.strokeStyle = '#24231f'; ctx.lineWidth = 0.7; for (let x = -6.5; x <= 6.5; x += 2.6) { ctx.beginPath(); ctx.moveTo(x, gy - 1.5); ctx.lineTo(x, gy - 4.5); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-7, gy - 4.5); ctx.lineTo(7, gy - 4.5); ctx.stroke();
    const ly = gy - 5.5, on = t.beamTarget && t.beamTime > 0;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // the turning lamp throws a pale cone even at rest
    const ba = on ? t.angle : time * 0.9 + (t.id || 0);
    ctx.translate(0, ly); ctx.rotate(ba);
    const cg = ctx.createLinearGradient(0, 0, 34, 0); cg.addColorStop(0, `rgba(255,245,180,${on ? 0.5 : 0.28})`); cg.addColorStop(1, 'rgba(255,245,180,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(34, -8); ctx.lineTo(34, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff6b8'; ctx.strokeStyle = '#1c1b17'; ctx.lineWidth = 0.8; ctx.fillRect(-3.6, ly - 3.5, 7.2, 7); ctx.strokeRect(-3.6, ly - 3.5, 7.2, 7);
    ctx.beginPath(); ctx.moveTo(-1.2, ly - 3.5); ctx.lineTo(-1.2, ly + 3.5); ctx.moveTo(1.2, ly - 3.5); ctx.lineTo(1.2, ly + 3.5); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(0, ly, 0, 0, ly, 10 + lvl * 2); lg.addColorStop(0, 'rgba(255,250,200,0.9)'); lg.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = lg; ctx.fillRect(-14, ly - 14, 28, 28); ctx.restore();
    ctx.fillStyle = '#6e221f'; ctx.strokeStyle = '#141310';
    ctx.beginPath(); ctx.moveTo(-5, ly - 3.5); ctx.lineTo(0, ly - 9); ctx.lineTo(5, ly - 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9a840'; ctx.beginPath(); ctx.arc(0, ly - 9.5, 1, 0, TAU); ctx.fill();
  },
  // -------- Curio Shop
  shop(ctx, t, lvl, time) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(2, 11, 14, 4, 0, 0, TAU); ctx.fill();
    // walls
    const wg = ctx.createLinearGradient(-12, 0, 12, 0); wg.addColorStop(0, '#5c4330'); wg.addColorStop(1, '#2c1f16');
    ctx.fillStyle = wg; ctx.strokeStyle = '#100a06'; ctx.lineWidth = 0.9; ctx.fillRect(-11.5, -4, 23, 15); ctx.strokeRect(-11.5, -4, 23, 15);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.6; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-11.5, -4 + i * 3); ctx.lineTo(11.5, -4 + i * 3); ctx.stroke(); }
    // gambrel roof with a crooked chimney
    ctx.fillStyle = '#2a2420'; ctx.strokeStyle = '#0c0a08'; ctx.lineWidth = 0.9; ctx.fillRect(5.5, -19, 3.4, 8); ctx.strokeRect(5.5, -19, 3.4, 8);
    const rg = ctx.createLinearGradient(0, -18, 0, -3); rg.addColorStop(0, '#3e3640'); rg.addColorStop(1, '#1c181e');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(-13.5, -3.5); ctx.lineTo(-10, -11); ctx.lineTo(-4, -16.5); ctx.lineTo(4, -16.5); ctx.lineTo(10, -11); ctx.lineTo(13.5, -3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-10, -11); ctx.lineTo(10, -11); ctx.moveTo(-12, -7); ctx.lineTo(12, -7); ctx.stroke();
    // lit window crammed with curios, door, striped awning
    ctx.fillStyle = '#ffc860'; ctx.fillRect(-9, 0, 9, 6.5);
    ctx.fillStyle = '#3a2410'; ctx.fillRect(-7.6, 3.4, 1.6, 3.1); ctx.beginPath(); ctx.arc(-3.6, 4.6, 1.6, 0, TAU); ctx.fill(); ctx.fillRect(-1.8, 2.4, 1, 4.1);
    ctx.strokeStyle = '#1a1008'; ctx.lineWidth = 0.8; ctx.strokeRect(-9, 0, 9, 6.5); ctx.beginPath(); ctx.moveTo(-4.5, 0); ctx.lineTo(-4.5, 6.5); ctx.stroke();
    ctx.fillStyle = '#1e140c'; roundRect(ctx, 3, 1, 5.5, 10, 1); ctx.fill(); ctx.fillStyle = '#c9a840'; ctx.beginPath(); ctx.arc(7.2, 6.5, 0.6, 0, TAU); ctx.fill();
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#7a1f1c' : '#d8cdb0'; ctx.beginPath(); ctx.moveTo(-12 + i * 3, -3.6); ctx.lineTo(-9 + i * 3, -3.6); ctx.lineTo(-9.4 + i * 3, 0); ctx.lineTo(-12.4 + i * 3, 0); ctx.closePath(); ctx.fill(); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(-4.5, 3, 0, -4.5, 3, 11); g.addColorStop(0, 'rgba(255,190,90,0.4)'); g.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = g; ctx.fillRect(-16, -8, 23, 22); ctx.restore();
    // swinging sign
    ctx.save(); ctx.translate(12.5, -8); ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1.5, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.translate(2.5, 0); ctx.rotate(Math.sin(time * 1.8 + (t.id || 0)) * 0.25);
    ctx.fillStyle = '#2a1c10'; ctx.strokeStyle = '#c9a840'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(0, 4.6, 3.6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.arc(0, 4.6, 1.7, 0, TAU); ctx.fill();
    ctx.restore();
    // hoarded gold piles up with each tier
    for (let i = 0; i < lvl; i++) { const x = -13 + i * 3.2, y = 11.5 - (i % 2) * 1.2; ctx.fillStyle = '#7a5a14'; ctx.beginPath(); ctx.ellipse(x, y + 0.6, 2, 1, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.ellipse(x, y, 2, 1, 0, 0, TAU); ctx.fill(); }
  },
};

function drawTower(ctx, t, time, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(t.x, t.y);
  drawTowerBase(ctx, t.def, t.level);
  TowerArt[t.type](ctx, t, t.level, time);
  if (t.maddened) {
    ctx.fillStyle = `rgba(190,80,240,${0.6 + Math.sin(time * 6) * 0.3})`;
    ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('?!', 0, -26);
  }
  ctx.restore();
}

// ---------------- icon helpers (for DOM canvases) ----------------
function drawTowerIcon(canvas, type, level = 0) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width / 50;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.scale(s, s);
  drawTower(ctx, { x: 25, y: 31, type, def: TOWERS[type], level, angle: -Math.PI / 4, anim: 0, id: 1 }, 0.5);
  ctx.restore();
}
function drawEnemyIcon(canvas, type, time = 0.3) {
  const ctx = canvas.getContext('2d');
  const def = ENEMIES[type];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sc = canvas.width / Math.max(26, def.size * (def.flying ? 4.5 : def.boss ? 3.9 : 3.4));
  ctx.save(); ctx.translate(canvas.width / 2 - (def.flying ? 0 : def.size * 0.12 * sc), canvas.height / 2 + def.size * 0.15 * sc); ctx.scale(sc, sc);
  drawEnemyBody(ctx, type, def.size, time, { id: 7 });
  ctx.restore();
}

// ---------------- Renderer ----------------
class Renderer {
  constructor(canvas, ss = 1) {
    this.canvas = canvas;
    this.ss = ss;                      // supersampling factor for crisp art
    if (ss > 1) { canvas.width = W * ss; canvas.height = H * ss; }
    this.ctx = canvas.getContext('2d');
    this.time = 0;
    this.light = document.createElement('canvas'); this.light.width = W; this.light.height = H;
    this.lctx = this.light.getContext('2d');
    this.rain = Array.from({ length: 110 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 320 + Math.random() * 200 }));
    this.fog = Array.from({ length: 9 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 120 + Math.random() * 160, vx: 4 + Math.random() * 9 }));
    this.boltT = 8 + Math.random() * 10;
    this.flashLvl = 0;
  }

  // Change the supersampling factor on the fly (used to drop quality on slow machines).
  setQuality(ss, game) {
    this.ss = ss;
    this.canvas.width = W * ss; this.canvas.height = H * ss;
    if (game) this.prerender(game, true);
  }

  // ---------- static background ----------
  prerender(game, keepStains = false) {
    const bg = document.createElement('canvas'); bg.width = W * this.ss; bg.height = H * this.ss;
    const ctx = bg.getContext('2d');
    ctx.scale(this.ss, this.ss);
    const th = game.map.theme;
    const rng = mulberry32(game.map.seed * 31);
    ctx.fillStyle = th.ground; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = rng() < 0.5 ? th.ground2 : 'rgba(0,0,0,0.22)';
      const x = rng() * W, y = rng() * H, r = 3 + rng() * 14;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, rng() * 3, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 40; i++) { // mud and puddles
      ctx.fillStyle = rng() < 0.7 ? th.mud : 'rgba(20,30,34,0.6)';
      const x = rng() * W, y = rng() * H; ctx.beginPath(); ctx.ellipse(x, y, 10 + rng() * 26, 5 + rng() * 12, rng() * 3, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(70,72,50,0.45)'; ctx.lineWidth = 1;
    for (let i = 0; i < 600; i++) { const x = rng() * W, y = rng() * H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 5, y - 2 - rng() * 4); ctx.stroke(); }
    // bones
    ctx.strokeStyle = 'rgba(170,160,135,0.35)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x = rng() * W, y = rng() * H, a = rng() * 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); ctx.stroke();
      if (rng() < 0.3) { ctx.fillStyle = 'rgba(170,160,135,0.4)'; ctx.beginPath(); ctx.arc(x + 9, y, 2.5, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 8, y - 1, 1, 1); ctx.fillRect(x + 10, y - 1, 1, 1); }
    }
    const G = game.grid;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (G[r][c] === 2) {
      const x = c * TILE, y = r * TILE;
      ctx.fillStyle = th.water; ctx.fillRect(x, y, TILE, TILE);
    }
    // soft shorelines
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (G[r][c] === 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || G[nr][nc] === 2) continue;
        ctx.fillRect(c * TILE + (dc > 0 ? TILE - 4 : 0), r * TILE + (dr > 0 ? TILE - 4 : 0), dc ? 4 : TILE, dr ? 4 : TILE);
      }
    }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (G[r][c] === 3) this.drawDecor(ctx, th.deco, c * TILE + TILE / 2, r * TILE + TILE / 2, rng);
    this.drawCity(ctx, game, rng);
    this.bg = bg;
    if (!keepStains || !this.stain) { this.stain = document.createElement('canvas'); this.stain.width = W; this.stain.height = H; }
  }

  drawDecor(ctx, deco, x, y, rng) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(2, 12, 15, 5, 0, 0, TAU); ctx.fill();
    const v = rng();
    if (deco === 'dock') {
      if (v < 0.4) { ctx.fillStyle = '#3a2e20'; ctx.fillRect(-10, -8, 20, 18); ctx.strokeStyle = '#1c150e'; ctx.lineWidth = 2; ctx.strokeRect(-10, -8, 20, 18); ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(10, 10); ctx.stroke(); }
      else if (v < 0.7) { ctx.strokeStyle = '#2e2418'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 10, 6 + i * 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } }
      else this.tree(ctx, '#1c150e');
    } else if (deco === 'campus') {
      if (v < 0.6) this.tree(ctx, '#1e1812');
      else { ctx.fillStyle = '#3e3a34'; ctx.fillRect(-6, -14, 12, 24); ctx.fillStyle = '#4a463e'; ctx.fillRect(-9, 6, 18, 5); ctx.beginPath(); ctx.arc(0, -16, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(-3, -18, 2, 2); ctx.fillRect(1, -18, 2, 2); }
    } else if (deco === 'hills') {
      if (v < 0.55) { ctx.fillStyle = '#3c3c3a'; ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(-6, -17); ctx.lineTo(5, -19); ctx.lineTo(8, 10); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.moveTo(-2, -12); ctx.lineTo(2, -4); ctx.lineTo(-1, 4); ctx.stroke(); }
      else this.tree(ctx, '#1a140e');
    } else if (deco === 'city') {
      ctx.fillStyle = '#211c22'; ctx.fillRect(-12, -6, 24, 18);
      ctx.fillStyle = '#151116'; ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(-8, -17); ctx.lineTo(5, -14); ctx.lineTo(14, -6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#060406'; ctx.fillRect(-7, -1, 5, 6); ctx.fillRect(3, -1, 5, 6);
    } else if (deco === 'ruins') {
      ctx.fillStyle = '#26332d'; ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(-8, -12); ctx.lineTo(4, -18); ctx.lineTo(11, 10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(80,200,140,0.3)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -2, 4, 0, TAU); ctx.moveTo(-4, 4); ctx.lineTo(4, -8); ctx.stroke();
    }
    ctx.restore();
  }
  tree(ctx, trunk) {
    ctx.strokeStyle = trunk; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(1, -6); ctx.moveTo(1, -2); ctx.lineTo(-9, -13); ctx.moveTo(0, -5); ctx.lineTo(8, -16); ctx.moveTo(-5, -8); ctx.lineTo(-12, -7); ctx.moveTo(5, -12); ctx.lineTo(11, -11); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, -13); ctx.lineTo(-12, -18); ctx.moveTo(8, -16); ctx.lineTo(7, -21); ctx.stroke();
  }

  drawCity(ctx, game, rng) {
    const k = game.city;
    this.windows = [];
    this.roofs = [];
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(k.x - 4, k.y + 4, k.w + 8, k.h + 6);
    ctx.fillStyle = '#211e1b'; ctx.fillRect(k.x, k.y, k.w, k.h);
    for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(255,255,255,${0.02 + rng() * 0.03})`; ctx.fillRect(k.x + rng() * k.w, k.y + rng() * k.h, 4, 3); }
    // houses with gambrel roofs
    const midC = k.c + Math.floor(k.cw / 2), midR = k.r + Math.floor(k.ch / 2);
    for (let r = k.r; r < k.r + k.ch; r++) for (let c = k.c; c < k.c + k.cw; c++) {
      const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
      if (c === midC && r === midR) continue;
      const hw = 12 + rng() * 4, hh = 8 + rng() * 4;
      ctx.fillStyle = '#2c2723'; ctx.fillRect(x - hw, y - 2, hw * 2, hh + 4);
      ctx.fillStyle = '#151211';
      ctx.beginPath(); ctx.moveTo(x - hw - 2, y - 2); ctx.lineTo(x - hw + 3, y - 9); ctx.lineTo(x - 4, y - 13); ctx.lineTo(x + 4, y - 13); ctx.lineTo(x + hw - 3, y - 9); ctx.lineTo(x + hw + 2, y - 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0a0808';
      const wins = [[x - hw + 4, y + 1], [x + hw - 9, y + 1], [x - 2, y + 2]];
      for (const [wx, wy] of wins) { ctx.fillRect(wx, wy, 5, 5); this.windows.push({ x: wx + 2.5, y: wy + 2.5, p: rng() * 10, th: rng() }); }
      this.roofs.push({ x, y: y - 9, th: rng() });
      if (rng() < 0.5) { ctx.fillStyle = '#1a1614'; ctx.fillRect(x + hw - 8, y - 17, 3, 6); }
    }
    // church with steeple
    const cx = midC * TILE + TILE / 2, cy = midR * TILE + TILE / 2;
    ctx.fillStyle = '#2f2a26'; ctx.fillRect(cx - 9, cy - 6, 18, 20);
    ctx.fillStyle = '#141110'; ctx.beginPath(); ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx, cy - 34); ctx.lineTo(cx + 6, cy - 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a3430'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx, cy - 34); ctx.lineTo(cx, cy - 40); ctx.moveTo(cx - 3, cy - 37); ctx.lineTo(cx + 3, cy - 37); ctx.stroke();
    ctx.fillStyle = '#0a0808'; ctx.beginPath(); ctx.arc(cx, cy + 2, 4, Math.PI, TAU); ctx.fillRect(cx - 4, cy + 2, 8, 6); ctx.fill();
    this.windows.push({ x: cx, y: cy + 3, p: 0, th: -1, church: true });
    // walls, crenellations, corner towers
    ctx.strokeStyle = '#3d3833'; ctx.lineWidth = 7; ctx.strokeRect(k.x + 2, k.y + 2, k.w - 4, k.h - 4);
    ctx.strokeStyle = '#26221f'; ctx.lineWidth = 1; ctx.strokeRect(k.x + 5.5, k.y + 5.5, k.w - 11, k.h - 11);
    ctx.fillStyle = '#48423c';
    for (let x = k.x; x < k.x + k.w; x += 9) { ctx.fillRect(x, k.y - 3, 5, 4); ctx.fillRect(x, k.y + k.h - 1, 5, 4); }
    for (let y = k.y; y < k.y + k.h; y += 9) { ctx.fillRect(k.x - 3, y, 4, 5); ctx.fillRect(k.x + k.w - 1, y, 4, 5); }
    for (const [x, y] of [[k.x, k.y], [k.x + k.w, k.y], [k.x, k.y + k.h], [k.x + k.w, k.y + k.h]]) {
      ctx.fillStyle = '#3a3530'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a1714'; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
      this.windows.push({ x, y, p: rng() * 10, th: -1, torch: true });
    }
    ctx.restore();
  }

  bakeStains(game) {
    if (!game.stains.length) return;
    const ctx = this.stain.getContext('2d');
    for (const s of game.stains) {
      const col = ICHOR[s.type] || '#1a1410';
      ctx.fillStyle = col;
      ctx.globalAlpha = s.type === 'scorch' ? 0.35 : 0.55;
      const n = s.type === 'scorch' ? 5 : 9;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, d = Math.random() * s.r * 1.1;
        ctx.beginPath(); ctx.ellipse(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * 0.7, s.r * (0.25 + Math.random() * 0.4), s.r * (0.15 + Math.random() * 0.25), a, 0, TAU); ctx.fill();
      }
      if (s.type !== 'scorch') for (let i = 0; i < 5; i++) {
        const a = Math.random() * TAU, d = s.r * (1.3 + Math.random() * 1.4);
        ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * 0.7, 1 + Math.random() * 1.5, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    game.stains.length = 0;
  }

  // ---------- frame ----------
  draw(game, ui, dt) {
    this.time += dt;
    const ctx = this.ctx, t = this.time;
    this.bakeStains(game);
    // distant lightning
    if (dt > 0) {
      this.boltT -= dt;
      if (this.boltT <= 0) { this.boltT = 14 + Math.random() * 22; this.flashLvl = 1; setTimeout(() => Sfx.play('thunder'), 500 + Math.random() * 900); }
      this.flashLvl = Math.max(0, this.flashLvl - dt * 2.2);
    }
    const flick = this.flashLvl > 0 ? this.flashLvl * (0.6 + 0.4 * Math.sin(t * 60)) : 0;

    ctx.setTransform(this.ss, 0, 0, this.ss, 0, 0);
    EyeSink.ss = this.ss;
    ctx.save();
    if (game.shake > 0) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    ctx.drawImage(this.bg, 0, 0, W, H);
    ctx.drawImage(this.stain, 0, 0);

    // water movement
    ctx.strokeStyle = 'rgba(110,150,150,0.08)'; ctx.lineWidth = 1;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (game.grid[r][c] === 2) {
      const x = c * TILE, y = r * TILE + 20 + Math.sin(t * 1.2 + c * 0.7 + r) * 9;
      ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + 30, y); ctx.stroke();
    }

    // towers
    for (const tw of game.towers) if (tw.def.kind === 'aura') {
      const rr = tw.stats.range * TILE;
      ctx.strokeStyle = `rgba(120,255,180,${0.06 + 0.04 * Math.sin(t * 2 + tw.id)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tw.x, tw.y, rr * (0.6 + 0.4 * ((t * 0.5 + tw.id * 0.3) % 1)), 0, TAU); ctx.stroke();
    }
    for (const tw of game.towers) drawTower(ctx, tw, t);

    // enemies — ground, then flyers. Eyes are recorded for the glow pass.
    EyeSink.on = true; EyeSink.list.length = 0;
    const ens = game.enemies.slice().sort((a, b) => (a.def.flying ? 1 : 0) - (b.def.flying ? 1 : 0) || a.y - b.y);
    for (const e of ens) this.drawEnemy(ctx, e, t);
    EyeSink.on = false;

    // shells (non-emissive bodies)
    for (const p of game.projectiles) if (p.kind === 'shell') {
      const k = p.t / p.dur, x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k, h = Math.sin(Math.PI * k) * 70;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, 5, 2.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6a2018'; ctx.fillRect(x - 3, y - h - 4, 6, 8);
    }
    this.drawDeaths(ctx, game);

    // ---- darkness ----
    this.drawDarkness(game, t, flick);
    ctx.drawImage(this.light, 0, 0);

    // ---- emissive pass ----
    this.drawCityLights(ctx, game, t);
    this.drawEyes(ctx, flick);
    this.drawEmissive(ctx, game, t);
    this.drawSpawnMist(ctx, game, t);
    this.drawAtmosphere(ctx, game, t, dt);

    // ---- UI overlays ----
    if (ui.placing && ui.hover) {
      const { c, r } = ui.hover;
      const ok = game.canPlace(c, r) && game.gold >= TOWERS[ui.placing].cost;
      ctx.fillStyle = ok ? 'rgba(120,255,160,0.16)' : 'rgba(255,60,60,0.2)';
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      const fake = { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, type: ui.placing, def: TOWERS[ui.placing], level: 0, angle: -Math.PI / 2, anim: t };
      const st = game.computeStats(fake, 0);
      if (st.range) this.rangeCircle(ctx, fake.x, fake.y, st.range * TILE, ok);
      drawTower(ctx, fake, t, 0.6);
    }
    const sel = ui.selected;
    if (sel) {
      if (sel.stats.range) this.rangeCircle(ctx, sel.x, sel.y, sel.stats.range * TILE, true);
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; roundRect(ctx, sel.x - 18, sel.y - 18, 36, 36, 7); ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.font = 'bold 12px Georgia, serif';
    for (const f of game.floaters) {
      ctx.globalAlpha = 1 - f.t / f.life;
      ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    if (ui.spellTarget && ui.mouse) {
      const r = SPELLS[ui.spellTarget].radius * TILE;
      ctx.strokeStyle = 'rgba(255,140,60,0.9)'; ctx.fillStyle = 'rgba(255,100,40,0.15)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ui.mouse.x, ui.mouse.y, r, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    if (game.bossAlive && game.bossAlive.alive) this.drawBossBar(ctx, game.bossAlive);
    if (game.flash > 0) { ctx.fillStyle = `rgba(200,255,220,${game.flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
  }

  drawDarkness(game, t, flick) {
    const l = this.lctx;
    const base = game.mode === 'nightmare' ? 0.8 : 0.7;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, W, H);
    l.fillStyle = `rgba(3,5,9,${base * (1 - flick * 0.75)})`;
    l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'destination-out';
    const cut = (x, y, r, a = 1) => {
      if (r <= 1) return;
      const g = l.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const k = game.city, sr = game.sanity / game.maxSanity;
    cut(k.cx, k.cy, (Math.max(k.w, k.h) / 2 + TILE * (1.8 + 1.6 * sr)) * (0.97 + 0.03 * Math.sin(t * 7)), 0.95);
    for (const tw of game.towers) {
      let r = TILE * 2, a = 0.85;
      if (tw.def.kind === 'aura') { r = tw.stats.range * TILE * 0.85; a = 0.6; }
      if (tw.def.kind === 'beam') r = TILE * 2.2;
      if (tw.def.kind === 'income') r = TILE * 1.2;
      cut(tw.x, tw.y, r, a);
      if (tw.def.kind === 'beam' && tw.beamTarget && tw.beamTarget.alive && tw.beamTime > 0) {
        const e = tw.beamTarget;
        for (let i = 1; i <= 4; i++) cut(tw.x + (e.x - tw.x) * i / 4, tw.y + (e.y - tw.y) * i / 4, TILE * 0.9, 0.7);
      }
    }
    for (const f of game.effects) {
      const q = f.t / f.life;
      if (f.kind === 'boom') cut(f.x, f.y, f.r * 2.8 * (1 - q * 0.6), 0.95 * (1 - q));
      else if (f.kind === 'fire') cut(f.x, f.y, f.r * 2.2, 1 - q);
      else if (f.kind === 'lightning') for (const p of f.pts) cut(p.x, p.y, TILE * 1.3, 1 - q);
      else if (f.kind === 'tracer') cut(f.x, f.y, TILE * 1.1, 0.7 * (1 - q));
      else if (f.kind === 'elder') cut(f.x, f.y, 80 + q * 600, 0.9 * (1 - q));
      else if (f.kind === 'spark') cut(f.x, f.y, TILE * 0.7, 1 - q);
    }
    for (const p of game.projectiles) if (p.kind === 'bolt') cut(p.x, p.y, TILE * 0.9, 0.8);
    for (const e of game.enemies) if (e.burn > 0) cut(e.x, e.y, TILE * 1.2, 0.8);
    if (game.powderTime > 0) { l.fillStyle = 'rgba(0,0,0,0.35)'; l.fillRect(0, 0, W, H); }
    l.globalCompositeOperation = 'source-over';
  }

  drawCityLights(ctx, game, t) {
    const sr = game.sanity / game.maxSanity;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const w of this.windows) {
      if (w.th > sr && !w.torch) continue;              // windows go dark as the city loses its mind
      const f = 0.75 + 0.25 * Math.sin(t * (w.torch ? 13 : 2) + w.p) * (w.torch ? 1 : 0.4);
      const r = w.torch ? 9 : w.church ? 8 : 5;
      const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, r);
      const col = w.church ? '255,210,140' : '255,180,90';
      g.addColorStop(0, `rgba(${col},${0.85 * f})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(w.x - r, w.y - r, r * 2, r * 2);
    }
    // fires break out as sanity collapses
    if (sr < 0.6) for (const r of this.roofs) {
      if (r.th < sr + 0.1) continue;
      for (let i = 0; i < 3; i++) {
        const fx = r.x + (Math.random() - 0.5) * 12, fy = r.y - Math.random() * 10;
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 9);
        g.addColorStop(0, 'rgba(255,170,60,0.55)'); g.addColorStop(1, 'rgba(200,40,0,0)');
        ctx.fillStyle = g; ctx.fillRect(fx - 9, fy - 9, 18, 18);
      }
    }
    ctx.restore();
  }

  drawEyes(ctx, flick) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of EyeSink.list) {
      ctx.globalAlpha = Math.min(1, e.a * (1 - flick * 0.5) + 0.05);
      halo(ctx, e.x, e.y, 2.5 + e.r * 2.4, e.color, 0.5);
      ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(0.7, e.r * 0.9), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawEmissive(ctx, game, t) {
    // beams
    for (const tw of game.towers) if (tw.def.kind === 'beam' && tw.beamTarget && tw.beamTarget.alive && tw.beamTime > 0) {
      const e = tw.beamTarget, ramp = Math.min(1, tw.beamTime / 3);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,240,150,${0.3 + ramp * 0.3})`; ctx.lineWidth = 6 + ramp * 6 + Math.sin(t * 30) * 1.5;
      ctx.beginPath(); ctx.moveTo(tw.x, tw.y - 20.5 - tw.level * 1.5); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,230,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tw.x, tw.y - 20.5 - tw.level * 1.5); ctx.lineTo(e.x, e.y); ctx.stroke();
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 14 + ramp * 8);
      g.addColorStop(0, 'rgba(255,230,140,0.8)'); g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, 14 + ramp * 8, 0, TAU); ctx.fill();
      ctx.restore();
    }
    for (const p of game.projectiles) {
      if (p.kind === 'shell') {
        const k = p.t / p.dur, x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k, h = Math.sin(Math.PI * k) * 70;
        ctx.fillStyle = `rgba(255,${150 + Math.random() * 100},50,1)`; ctx.beginPath(); ctx.arc(x + 2, y - h - 6, 2, 0, TAU); ctx.fill();
      } else if (p.kind === 'bolt') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        p.trail.forEach((q, i) => { ctx.fillStyle = `rgba(170,100,255,${i / p.trail.length * 0.4})`; ctx.beginPath(); ctx.arc(q.x, q.y, 2 + i * 0.4, 0, TAU); ctx.fill(); });
        halo(ctx, p.x, p.y, 13, '#c58cff', 0.7); ctx.fillStyle = '#e8d0ff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    for (const tw of game.towers) { // small lamps on towers
      const col = { ward: '120,255,170', tesla: '150,200,255', scholar: '200,140,255', lighthouse: '255,245,180', shop: '255,210,110' }[tw.type] || '255,190,110';
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(tw.x, tw.y - 10, 0, tw.x, tw.y - 10, 10);
      g.addColorStop(0, `rgba(${col},0.35)`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(tw.x - 10, tw.y - 20, 20, 20); ctx.restore();
    }
    for (const f of game.effects) {
      const k = f.t / f.life;
      ctx.save();
      switch (f.kind) {
        case 'ring':
          ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r + (f.max - f.r) * k, 0, TAU); ctx.stroke(); break;
        case 'tracer':
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = f.crit ? 'rgba(255,255,255,0.95)' : 'rgba(255,220,150,0.85)'; ctx.lineWidth = f.crit ? 2.5 : 1.5; ctx.globalAlpha = 1 - k;
          ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
          ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, TAU); ctx.fill(); break;
        case 'boom': {
          ctx.globalCompositeOperation = 'lighter';
          const r = f.r * (0.5 + k * 0.6);
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
          g.addColorStop(0, `rgba(255,220,120,${1 - k})`); g.addColorStop(0.5, `rgba(255,110,30,${0.7 * (1 - k)})`); g.addColorStop(1, 'rgba(120,30,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill(); break;
        }
        case 'lightning': {
          ctx.globalCompositeOperation = 'lighter';
          for (const q of f.pts) halo(ctx, q.x, q.y, 16, '#80c0ff', 0.5 * (1 - k));
          ctx.strokeStyle = `rgba(190,225,255,${1 - k})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(f.pts[0].x, f.pts[0].y);
          for (let i = 1; i < f.pts.length; i++) {
            const a = f.pts[i - 1], b = f.pts[i];
            for (let j = 1; j <= 4; j++) { const q = j / 4; ctx.lineTo(a.x + (b.x - a.x) * q + (j < 4 ? (Math.random() - 0.5) * 12 : 0), a.y + (b.y - a.y) * q + (j < 4 ? (Math.random() - 0.5) * 12 : 0)); }
          }
          ctx.stroke(); break;
        }
        case 'spark':
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = f.color; ctx.globalAlpha = 1 - k;
          for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * k * 12, f.y + Math.sin(a) * k * 12, 2, 0, TAU); ctx.fill(); }
          break;
        case 'blink':
          ctx.strokeStyle = `rgba(110,200,255,${1 - k})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(a) * 20 * k, f.y + Math.sin(a) * 20 * k); } ctx.stroke(); break;
        case 'summon':
          ctx.strokeStyle = `rgba(150,40,40,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * 26, 0, TAU); ctx.stroke(); break;
        case 'elder': {
          ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#a0ffc8'; ctx.lineWidth = 4;
          const R = 60 + k * 500;
          ctx.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 2 * TAU / 5 + k; const x = f.x + Math.cos(a) * R, y = f.y + Math.sin(a) * R; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
          break;
        }
        case 'fire': {
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 18; i++) {
            const a = Math.random() * TAU, d = Math.random() * f.r, x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d;
            const g = ctx.createRadialGradient(x, y, 0, x, y, 18);
            g.addColorStop(0, `rgba(255,${120 + Math.random() * 100},40,${0.6 * (1 - k)})`); g.addColorStop(1, 'rgba(255,60,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
          }
          ctx.strokeStyle = `rgba(255,160,60,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + k * 0.6), 0, TAU); ctx.stroke();
          break;
        }
        case 'powder':
          ctx.fillStyle = `rgba(255,220,140,${0.5 * (1 - k)})`;
          for (let i = 0; i < 120; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
          break;
      }
      ctx.restore();
    }
    for (const e of game.enemies) if (e.burn > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(255,${100 + Math.random() * 120},30,0.8)`; ctx.beginPath(); ctx.arc(e.x + (Math.random() - 0.5) * e.def.size * 1.5, e.y + (Math.random() - 0.5) * e.def.size, 2, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }

  drawDeaths(ctx, game) {
    for (const f of game.effects) if (f.kind === 'death') {
      const k = f.t / f.life;
      ctx.save(); ctx.globalAlpha = (1 - k) * 0.9;
      ctx.fillStyle = ICHOR[f.type] || '#2a1a14';
      const n = f.big ? 22 : 10;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + f.x, d = k * f.r * (f.big ? 4 : 2.2) * (0.6 + (i % 3) * 0.25);
        ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d - Math.sin(k * Math.PI) * 8, (f.big ? 4 : 2.4) * (1 - k * 0.5), 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawSpawnMist(ctx, game, t) {
    let sides, strong;
    if (game.queue.length) { sides = [...new Set(game.queue.map(q => q.spawn))]; strong = 1; }
    else if (game.canCallWave()) { sides = game.nextSpawnSides(); strong = 0.55; }
    else return;
    ctx.save();
    const pulse = 0.65 + 0.35 * Math.sin(t * 2.2);
    for (const i of sides) {
      const sp = game.map.spawns[i];
      const a = sp.a * TILE, b = (sp.b + 1) * TILE, d = TILE * 1.6;
      let g;
      if (sp.side === 'left') { g = ctx.createLinearGradient(0, 0, d, 0); }
      else if (sp.side === 'right') { g = ctx.createLinearGradient(W, 0, W - d, 0); }
      else if (sp.side === 'top') { g = ctx.createLinearGradient(0, 0, 0, d); }
      else { g = ctx.createLinearGradient(0, H, 0, H - d); }
      g.addColorStop(0, `rgba(150,15,20,${0.42 * strong * pulse})`); g.addColorStop(1, 'rgba(120,0,10,0)');
      ctx.fillStyle = g;
      if (sp.side === 'left') ctx.fillRect(0, a, d, b - a);
      else if (sp.side === 'right') ctx.fillRect(W - d, a, d, b - a);
      else if (sp.side === 'top') ctx.fillRect(a, 0, b - a, d);
      else ctx.fillRect(a, H - d, b - a, d);
    }
    ctx.restore();
  }

  rangeCircle(ctx, x, y, r, ok) {
    ctx.fillStyle = ok ? 'rgba(200,230,255,0.06)' : 'rgba(255,80,80,0.07)';
    ctx.strokeStyle = ok ? 'rgba(200,230,255,0.45)' : 'rgba(255,80,80,0.5)';
    ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
  }

  drawEnemy(ctx, e, t) {
    const d = e.def, s = d.size * 1.3;
    ctx.save();
    let ox = 0, oy = 0;
    if (e.twitch > 0) { ox = (Math.random() - 0.5) * 3; oy = (Math.random() - 0.5) * 3; }
    if (e.sieging && e.stun <= 0) { const l = Math.sin(t * 9 + e.id) * 2.5; ox += Math.cos(e.angle) * l; oy += Math.sin(e.angle) * l; }
    ctx.translate(e.x + ox, e.y + oy + (d.flying ? -10 : 0));
    let alpha = 1;
    if (e.phased) alpha = e.revealed ? 0.5 : 0.1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    if (d.flying) { ctx.beginPath(); ctx.ellipse(0, 18, s * 0.9, s * 0.3, 0, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(0, s * 0.9, s * 0.95, s * 0.3, 0, 0, TAU); ctx.fill(); }
    if (d.aura) {
      ctx.fillStyle = `rgba(110,20,150,${0.06 + 0.04 * Math.sin(t * 3)})`;
      ctx.beginPath(); ctx.arc(0, 0, d.aura * TILE, 0, TAU); ctx.fill();
    }
    if (e.slow < 1) { ctx.strokeStyle = 'rgba(120,255,180,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, s * 0.85, s, s * 0.32, 0, 0, TAU); ctx.stroke(); }
    ctx.save();
    if (d.flying) ctx.rotate(e.angle + Math.PI / 2);
    else if (Math.cos(e.angle) < -0.1) ctx.scale(-1, 1);
    // phase-shifters smear across planes
    if ((d.phase || d.blink) && (e.twitch > 0 || e.phased)) {
      ctx.save(); ctx.globalAlpha = alpha * 0.3; ctx.translate(3, 0); drawEnemyBody(ctx, e.type, s, e.bob - 0.1, e); ctx.restore();
    }
    drawEnemyBody(ctx, e.type, s, e.bob, e);
    if (e.hitFlash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,220,200,0.25)'; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (e.revealed && e.phased) { ctx.strokeStyle = 'rgba(200,140,255,0.7)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(0, 0, s + 4, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (e.stun > 0) {
      ctx.fillStyle = '#9affc8';
      for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.8, -s - 4 + Math.sin(a) * 3, 1.5, 0, TAU); ctx.fill(); }
    }
    if (!d.boss && e.hp < e.maxHp) {
      ctx.globalAlpha = Math.max(alpha, 0.5);
      const bw = Math.max(16, s * 1.6), y = -s - 10;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(-bw / 2 - 1, y - 1, bw + 2, 4);
      ctx.fillStyle = '#9a1c1c'; ctx.fillRect(-bw / 2, y, bw * Math.max(0, e.hp / e.maxHp), 2);
    }
    ctx.restore();
  }

  drawAtmosphere(ctx, game, t, dt) {
    ctx.save();
    for (const f of this.fog) {
      f.x += f.vx * dt; if (f.x - f.r > W) f.x = -f.r;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, 'rgba(120,140,135,0.06)'); g.addColorStop(1, 'rgba(120,140,135,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
    if (game.map.theme.rain) {
      ctx.strokeStyle = 'rgba(150,175,200,0.14)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const r of this.rain) {
        r.y += r.s * dt; r.x -= r.s * 0.2 * dt;
        if (r.y > H) { r.y = -10; r.x = Math.random() * (W + 100); }
        ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 3, r.y + 12);
      }
      ctx.stroke();
    }
    if (game.powderTime > 0) { ctx.fillStyle = `rgba(255,220,140,${0.03 + 0.02 * Math.sin(t * 4)})`; ctx.fillRect(0, 0, W, H); }
    const ins = 1 - game.sanity / game.maxSanity;
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${0.5 + ins * 0.3})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (ins > 0.4) { ctx.fillStyle = `rgba(90,0,30,${(ins - 0.4) * 0.3 * (0.6 + 0.4 * Math.sin(t * 2.5))})`; ctx.fillRect(0, 0, W, H); }
    if (game.drainRate > 0) { ctx.strokeStyle = `rgba(180,20,30,${Math.min(0.5, game.drainRate * 0.04) * (0.6 + 0.4 * Math.sin(t * 8))})`; ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6); }
    ctx.restore();
  }

  drawBossBar(ctx, e) {
    const bw = 420, x = (W - bw) / 2, y = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; roundRect(ctx, x - 8, y - 4, bw + 16, 30, 6); ctx.fill();
    ctx.fillStyle = '#1a0508'; ctx.fillRect(x, y + 12, bw, 9);
    const k = Math.max(0, e.hp / e.maxHp);
    const g = ctx.createLinearGradient(x, 0, x + bw, 0); g.addColorStop(0, '#4a0818'); g.addColorStop(1, '#a01830');
    ctx.fillStyle = g; ctx.fillRect(x, y + 12, bw * k, 9);
    ctx.fillStyle = '#d8c8b0'; ctx.font = 'bold 11px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText(e.def.name.toUpperCase() + (e.phased && !e.revealed ? '  (unseen)' : ''), W / 2, y + 8);
  }
}
