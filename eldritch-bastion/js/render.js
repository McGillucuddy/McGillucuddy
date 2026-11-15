// ============================================================
//  ELDRITCH BASTION — procedural canvas rendering
// ============================================================
'use strict';

const TAU = Math.PI * 2;
function hashRng(n) { return mulberry32(n * 9301 + 49297); }

// Eyes are recorded in screen space so they can be redrawn glowing
// *above* the darkness layer: in the night you see the eyes first.
const EyeSink = { on: false, list: [] };
function eyes(ctx, pts, r, color, blur = 4) {
  ctx.save();
  ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = blur;
  for (const [x, y] of pts) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (EyeSink.on) {
      const m = ctx.getTransform();
      EyeSink.list.push({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, r: r * Math.hypot(m.a, m.b), color, a: ctx.globalAlpha });
    }
  }
  ctx.restore();
}

function tentacle(ctx, x, y, ang, len, w0, phase, color, segs = 8, amp = 0.5) {
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  let px = x, py = y;
  const sl = len / segs;
  for (let i = 0; i < segs; i++) {
    const a = ang + Math.sin(phase + i * 0.7) * amp * (i / segs + 0.3);
    const nx = px + Math.cos(a) * sl, ny = py + Math.sin(a) * sl;
    ctx.lineWidth = Math.max(0.6, w0 * (1 - i / segs));
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
    px = nx; py = ny;
  }
  return [px, py];
}

// ragged, membranous wing (top-down), side = ±1
function raggedWing(ctx, side, span, flap, fill, rim) {
  const f = 0.55 + 0.45 * flap;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(side * span * 0.12, -span * 0.12);
  ctx.quadraticCurveTo(side * span * 0.55, -span * 0.75 * f, side * span, -span * 0.35 * f);
  const notches = 5;
  for (let i = 1; i <= notches; i++) {
    const k = i / notches;
    const x = side * span * (1 - k * 0.88), y = -span * 0.35 * f * (1 - k) + span * 0.3 * k;
    ctx.lineTo(x + side * span * 0.06, y - span * 0.14);
    ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = 0.8; ctx.stroke(); }
  // finger bones
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(side * span * 0.12, -span * 0.1);
    ctx.lineTo(side * span * (0.95 - i * 0.25), -span * 0.35 * f + i * span * 0.12);
    ctx.stroke();
  }
}

function teeth(ctx, x0, y0, x1, y1, n, len, color = '#c9c2a8') {
  ctx.strokeStyle = color; ctx.lineWidth = 0.8;
  for (let i = 0; i <= n; i++) {
    const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len * 0.2, y + len); ctx.stroke();
  }
}

// ---------------- enemy art (ground creatures face +x) ----------------
const EnemyArt = {
  cultist(ctx, s, t) {
    const step = Math.sin(t * 5) * s * 0.06;
    ctx.save(); ctx.rotate(0.16 + Math.sin(t * 2.7) * 0.05);
    const g = ctx.createLinearGradient(0, -s * 1.4, 0, s);
    g.addColorStop(0, '#2e0c10'); g.addColorStop(1, '#070203');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-s * 0.6, s);
    for (let i = 1; i <= 7; i++) ctx.lineTo(-s * 0.6 + i * s * 0.17, s * (i % 2 ? 0.86 : 1.02) + (i % 3 ? step : -step));
    ctx.lineTo(s * 0.45, -s * 0.15);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.95, s * 0.05, -s * 1.5);
    ctx.quadraticCurveTo(-s * 0.6, -s * 0.9, -s * 0.5, -s * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.2); ctx.lineTo(-s * 0.25, s * 0.9); ctx.moveTo(s * 0.15, -s * 0.1); ctx.lineTo(s * 0.15, s * 0.9); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(s * 0.22, -s * 0.62, s * 0.2, s * 0.3, 0.25, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.29, -s * 0.64], [s * 0.17, -s * 0.61]], 0.75, '#ff3b1f');
    // gaunt hand clutching a curved blade
    ctx.strokeStyle = '#13050a'; ctx.lineWidth = s * 0.26; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.2); ctx.lineTo(s * 0.72, s * 0.04 + step); ctx.stroke();
    ctx.fillStyle = '#8f8670'; ctx.beginPath(); ctx.arc(s * 0.74, s * 0.04 + step, s * 0.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(s * 0.76, step); ctx.quadraticCurveTo(s * 1.1, -s * 0.05 + step, s * 1.2, -s * 0.4 + step); ctx.stroke();
    ctx.restore();
  },
  ghoul(ctx, s, t) {
    const gait = t * 9;
    ctx.strokeStyle = '#3f4234'; ctx.lineWidth = s * 0.17; ctx.lineCap = 'round';
    [[s * 0.5, 0], [s * 0.3, Math.PI], [-s * 0.35, Math.PI], [-s * 0.55, 0]].forEach(([bx, ph], i) => {
      const fx = bx + Math.sin(gait + ph) * s * 0.32, lift = Math.max(0, Math.cos(gait + ph)) * s * 0.15;
      ctx.beginPath(); ctx.moveTo(bx, -s * 0.05); ctx.quadraticCurveTo(bx + (i < 2 ? s * 0.35 : -s * 0.3), s * 0.15, fx, s * 0.78 - lift); ctx.stroke();
      ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(fx, s * 0.78 - lift); ctx.lineTo(fx + s * 0.2, s * 0.85 - lift); ctx.moveTo(fx, s * 0.78 - lift); ctx.lineTo(fx + s * 0.15, s * 0.95 - lift); ctx.stroke();
      ctx.lineWidth = s * 0.17;
    });
    ctx.fillStyle = '#545846';
    ctx.beginPath(); ctx.ellipse(-s * 0.05, -s * 0.12, s * 0.78, s * 0.3, -0.12, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(15,16,10,0.75)'; ctx.lineWidth = 0.9;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-s * 0.4 + i * s * 0.18, -s * 0.05, s * 0.18, 0.4, 2.0); ctx.stroke(); }
    ctx.fillStyle = '#3a3c2e'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-s * 0.6 + i * s * 0.22, -s * 0.38 + Math.abs(i - 2.5) * s * 0.03, s * 0.06, 0, TAU); ctx.fill(); }
    // canine skull
    const jaw = Math.sin(t * 7) * s * 0.06;
    ctx.fillStyle = '#2a2b20';
    ctx.beginPath(); ctx.moveTo(s * 0.95, -s * 0.02); ctx.lineTo(s * 1.38, s * 0.16 + jaw); ctx.lineTo(s * 0.9, s * 0.08); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#74765f';
    ctx.beginPath(); ctx.moveTo(s * 0.62, -s * 0.38); ctx.lineTo(s * 1.0, -s * 0.46); ctx.lineTo(s * 1.48, -s * 0.12); ctx.lineTo(s * 0.98, -s * 0.02); ctx.closePath(); ctx.fill();
    teeth(ctx, s * 1.0, -s * 0.03, s * 1.4, -s * 0.1, 5, s * 0.1);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(s * 0.98, -s * 0.27, s * 0.11, s * 0.08, 0.3, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 1.0, -s * 0.27]], 0.6, '#d6ff52');
  },
  deepone(ctx, s, t) {
    const sway = Math.sin(t * 3) * s * 0.06;
    ctx.strokeStyle = '#15231e'; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.2;
    ctx.beginPath(); ctx.moveTo(-s * 0.15, s * 0.5); ctx.lineTo(-s * 0.35 + sway, s * 1.0); ctx.moveTo(s * 0.15, s * 0.5); ctx.lineTo(s * 0.2 - sway, s * 1.0); ctx.stroke();
    // dorsal fin spines
    ctx.strokeStyle = '#0d1714'; ctx.lineWidth = 1.2;
    ctx.fillStyle = 'rgba(30,50,42,0.8)';
    ctx.beginPath(); ctx.moveTo(-s * 0.65, s * 0.15);
    for (let i = 0; i <= 5; i++) { const k = i / 5; ctx.lineTo(-s * 0.65 + k * s * 0.5 - s * 0.35, s * 0.15 - k * s * 0.95 - s * 0.2); ctx.lineTo(-s * 0.65 + k * s * 0.5, s * 0.15 - k * s * 0.95); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    const g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, '#2c473d'); g.addColorStop(1, '#101c18');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.7);
    ctx.quadraticCurveTo(-s * 0.85, -s * 0.15, -s * 0.2, -s * 0.78);
    ctx.quadraticCurveTo(s * 0.45, -s * 1.08, s * 0.8, -s * 0.55);
    ctx.lineTo(s * 0.72, -s * 0.15);
    ctx.quadraticCurveTo(s * 0.45, s * 0.45, s * 0.3, s * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(110,120,92,0.18)'; ctx.beginPath(); ctx.ellipse(s * 0.32, s * 0.15, s * 0.16, s * 0.42, -0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(s * 0.05 + i * s * 0.08, -s * 0.38, s * 0.15, 1.2, 2.4); ctx.stroke(); }
    // gaping, downturned mouth
    ctx.fillStyle = '#030605';
    ctx.beginPath(); ctx.moveTo(s * 0.82, -s * 0.5); ctx.quadraticCurveTo(s * 0.55, -s * 0.38, s * 0.38, -s * 0.22); ctx.lineTo(s * 0.74, -s * 0.12); ctx.closePath(); ctx.fill();
    teeth(ctx, s * 0.78, -s * 0.47, s * 0.45, -s * 0.28, 5, s * 0.07);
    // single bulging lidless eye with slit pupil
    ctx.fillStyle = '#a8a372'; ctx.beginPath(); ctx.arc(s * 0.45, -s * 0.72, s * 0.14, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.45, -s * 0.72]], s * 0.06, '#e8e09a', 3);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(s * 0.47, -s * 0.72, s * 0.025, s * 0.11, 0, 0, TAU); ctx.fill();
    // reaching webbed claw
    ctx.strokeStyle = '#1a2b25'; ctx.lineWidth = s * 0.17;
    const hx = s * 0.95 + sway, hy = s * 0.1;
    ctx.beginPath(); ctx.moveTo(s * 0.25, -s * 0.05); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.lineWidth = 0.8; ctx.strokeStyle = '#2a3a32';
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + s * 0.28, hy + i * s * 0.14); ctx.stroke(); }
  },
  nightgaunt(ctx, s, t) {
    const flap = Math.sin(t * 7);
    raggedWing(ctx, -1, s * 1.9, flap, '#07070b', 'rgba(110,100,150,0.35)');
    raggedWing(ctx, 1, s * 1.9, flap, '#07070b', 'rgba(110,100,150,0.35)');
    tentacle(ctx, 0, s * 0.7, Math.PI / 2, s * 1.6, 2, t * 5, '#0b0b11', 8, 0.9);
    ctx.fillStyle = '#0d0d14'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.3, s * 0.95, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(110,100,150,0.4)'; ctx.lineWidth = 0.8; ctx.stroke();
    // inward-curving horns; no face at all
    ctx.strokeStyle = '#16141e'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.8); ctx.quadraticCurveTo(-s * 0.7, -s * 1.4, -s * 0.05, -s * 1.55);
    ctx.moveTo(s * 0.15, -s * 0.8); ctx.quadraticCurveTo(s * 0.7, -s * 1.4, s * 0.05, -s * 1.55); ctx.stroke();
  },
  migo(ctx, s, t) {
    const f = Math.sin(t * 22);
    ctx.fillStyle = 'rgba(110,80,90,0.28)';
    ctx.beginPath(); ctx.ellipse(-s * 0.2, -s * 0.6, s * 0.9, s * 0.28 + f * 2, -0.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3e2629'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const bx = -s * 0.4 + i * s * 0.35, k = Math.sin(t * 10 + i * 2) * s * 0.12;
      ctx.beginPath(); ctx.moveTo(bx, s * 0.1); ctx.lineTo(bx + s * 0.15 + k, s * 0.45); ctx.lineTo(bx + k, s * 0.9); ctx.stroke();
    }
    [['#4e3436', -s * 0.45], ['#5c3e3f', -s * 0.1], ['#4a3233', s * 0.25]].forEach(([c, x]) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, 0, s * 0.32, s * 0.3, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
    });
    // pincers
    ctx.strokeStyle = '#4a3032'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s * 0.45, s * 0.05); ctx.lineTo(s * 0.95, -s * 0.05); ctx.stroke();
    const o = Math.abs(Math.sin(t * 4)) * s * 0.15;
    ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(s * 0.95, -s * 0.05); ctx.lineTo(s * 1.2, -s * 0.15 - o); ctx.moveTo(s * 0.95, -s * 0.05); ctx.lineTo(s * 1.2, s * 0.05 + o); ctx.stroke();
    // convoluted head with writhing feelers
    const hx = s * 0.5, hy = -s * 0.5;
    for (let i = 0; i < 7; i++) tentacle(ctx, hx, hy, -Math.PI / 2 + (i - 3) * 0.4, s * 0.55, 1.4, t * 6 + i, '#3a2230', 5, 0.9);
    ctx.fillStyle = `hsl(${330 + Math.sin(t * 2) * 15},22%,30%)`;
    ctx.beginPath(); ctx.ellipse(hx, hy, s * 0.38, s * 0.32, 0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(hx - s * 0.15 + i * s * 0.1, hy, s * 0.12, i, i + 2.2); ctx.stroke(); }
    eyes(ctx, [[hx + s * 0.2, hy + s * 0.05], [hx + s * 0.05, hy - s * 0.12]], 0.6, '#d49cff');
  },
  byakhee(ctx, s, t) {
    const flap = Math.sin(t * 9);
    raggedWing(ctx, -1, s * 1.8, flap, 'rgba(48,38,30,0.92)', 'rgba(0,0,0,0.6)');
    raggedWing(ctx, 1, s * 1.8, flap, 'rgba(48,38,30,0.92)', 'rgba(0,0,0,0.6)');
    ctx.fillStyle = '#342a22'; ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.34, s * 0.85, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#120d0a'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.2 + i * s * 0.2); ctx.lineTo(s * 0.3, -s * 0.2 + i * s * 0.2); ctx.stroke(); }
    ctx.fillStyle = '#251d17'; ctx.beginPath(); ctx.ellipse(0, -s * 0.85, s * 0.2, s * 0.32, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6a5a40'; ctx.lineWidth = 1.2; const m = Math.sin(t * 6) * 0.3;
    ctx.beginPath(); ctx.moveTo(-s * 0.08, -s * 1.1); ctx.lineTo(-s * 0.2 - m * 4, -s * 1.45); ctx.moveTo(s * 0.08, -s * 1.1); ctx.lineTo(s * 0.2 + m * 4, -s * 1.45); ctx.stroke();
    eyes(ctx, [[-s * 0.1, -s * 0.9], [s * 0.1, -s * 0.9]], 0.7, '#ff4020');
  },
  shambler(ctx, s, t) {
    const sw = Math.sin(t * 2.5);
    ctx.strokeStyle = '#1b1621'; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.2, s * 0.4); ctx.lineTo(-s * 0.3, s * 1.0); ctx.moveTo(s * 0.15, s * 0.4); ctx.lineTo(s * 0.2, s * 1.0); ctx.stroke();
    const g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, '#2a2232'); g.addColorStop(1, '#0e0b12');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.5); ctx.quadraticCurveTo(-s * 0.9, -s * 0.5, -s * 0.1, -s * 0.85);
    ctx.quadraticCurveTo(s * 0.7, -s * 0.9, s * 0.6, -s * 0.2); ctx.quadraticCurveTo(s * 0.5, s * 0.5, s * 0.1, s * 0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-s * 0.3 + (i % 3) * s * 0.25, -s * 0.4 + Math.floor(i / 3) * s * 0.35, s * 0.07, 0, TAU); ctx.fill(); }
    // arms hanging to the ground, hooked claws
    ctx.strokeStyle = '#1e1826'; ctx.lineWidth = s * 0.18;
    const ax = s * 0.85 + sw * s * 0.1;
    ctx.beginPath(); ctx.moveTo(s * 0.4, -s * 0.5); ctx.quadraticCurveTo(s * 1.0, -s * 0.1, ax, s * 0.85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.5); ctx.quadraticCurveTo(-s * 0.8, s * 0.1, -s * 0.55 - sw * s * 0.1, s * 0.9); ctx.stroke();
    ctx.strokeStyle = '#a8a0b2'; ctx.lineWidth = 0.9;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(ax, s * 0.85); ctx.quadraticCurveTo(ax + s * 0.25, s * 0.9 + i * s * 0.08, ax + s * 0.2, s * 1.1 + i * s * 0.05); ctx.stroke(); }
    ctx.fillStyle = '#171219'; ctx.beginPath(); ctx.arc(s * 0.35, -s * 0.72, s * 0.24, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.42, -s * 0.78], [s * 0.3, -s * 0.74], [s * 0.38, -s * 0.64]], 0.6, '#b46cff');
  },
  hound(ctx, s, t) {
    ctx.fillStyle = 'rgba(20,30,48,0.35)';
    for (let i = 1; i <= 5; i++) { ctx.beginPath(); ctx.arc(-s * 0.6 - i * s * 0.35, Math.sin(t * 5 + i) * s * 0.15, s * (0.55 - i * 0.08), 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#121a26';
    ctx.beginPath();
    ctx.moveTo(s * 1.15, -s * 0.15); ctx.lineTo(s * 0.55, -s * 0.6); ctx.lineTo(s * 0.35, -s * 1.0); ctx.lineTo(s * 0.15, -s * 0.5);
    ctx.lineTo(-s * 0.2, -s * 0.8); ctx.lineTo(-s * 0.35, -s * 0.45); ctx.lineTo(-s * 0.75, -s * 0.75); ctx.lineTo(-s * 0.65, -s * 0.15);
    ctx.lineTo(-s * 1.05, s * 0.8); ctx.lineTo(-s * 0.45, s * 0.3); ctx.lineTo(-s * 0.1, s * 0.9); ctx.lineTo(s * 0.15, s * 0.35);
    ctx.lineTo(s * 0.55, s * 0.85); ctx.lineTo(s * 0.6, s * 0.15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(80,130,190,0.45)'; ctx.lineWidth = 0.8; ctx.stroke();
    // long hollow tongue probing ahead
    tentacle(ctx, s * 1.1, -s * 0.1, Math.sin(t * 3) * 0.3, s * 1.0, 1.6, t * 8, '#5a1424', 7, 0.6);
    if (Math.sin(t * 13) > 0.7) { ctx.fillStyle = 'rgba(90,150,210,0.6)'; ctx.beginPath(); ctx.arc(s * 0.2, s * 0.6 + (t * 30 % 6), 1, 0, TAU); ctx.fill(); }
    eyes(ctx, [[s * 0.7, -s * 0.35]], 0.7, '#7ad8ff');
  },
  shoggoth(ctx, s, t, e) {
    const rng = hashRng(e ? e.id : 3);
    // pseudopods reaching forward
    for (let i = 0; i < 4; i++) tentacle(ctx, s * 0.6, (i - 1.5) * s * 0.3, (i - 1.5) * 0.4 + Math.sin(t + i) * 0.3, s * 0.8, s * 0.22, t * 2 + i, '#0b0f0d', 6, 0.6);
    const g = ctx.createRadialGradient(-s * 0.3, -s * 0.35, 1, 0, 0, s * 1.15);
    g.addColorStop(0, '#1d2522'); g.addColorStop(0.55, '#0c100e'); g.addColorStop(1, '#040605');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = i / 28 * TAU;
      const r = s * (1 + 0.13 * Math.sin(a * 3 + t * 2.6) + 0.09 * Math.sin(a * 7 - t * 3.7) + 0.05 * Math.sin(a * 11 + t * 5));
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.82;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,170,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(90,160,140,0.12)'; ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.25, s * 0.6, 3.5, 5.2); ctx.stroke();
    // mouths that open and close
    for (let i = 0; i < 3; i++) {
      const a = rng() * TAU, d = rng() * s * 0.6, mx = Math.cos(a) * d, my = Math.sin(a) * d * 0.8;
      const open = Math.max(0, Math.sin(t * 1.7 + i * 2.1)) * s * 0.12;
      if (open < 0.4) continue;
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(mx, my, s * 0.2, open, rng() - 0.5, 0, TAU); ctx.fill();
      teeth(ctx, mx - s * 0.17, my - open * 0.6, mx + s * 0.17, my - open * 0.6, 6, open * 0.7);
    }
    // many mismatched eyes, forming and dissolving
    const n = Math.max(5, Math.round(s / 2.2));
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU + Math.sin(t * 0.3 + i) * 0.4, d = (0.15 + rng() * 0.7) * s, er = 0.7 + rng() * s * 0.08;
      const lid = Math.sin(t * (0.8 + rng()) + i * 1.9);
      if (lid < -0.3) continue;
      const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.82;
      ctx.fillStyle = '#b8a96a'; ctx.beginPath(); ctx.arc(x, y, er, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(160,30,20,0.6)'; ctx.lineWidth = 0.5; ctx.stroke();
      eyes(ctx, [[x, y]], er * 0.55, rng() < 0.5 ? '#c8d05a' : '#e0b040', 3);
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, er * 0.18, er * 0.6, 0, 0, TAU); ctx.fill();
    }
  },
  proto(ctx, s, t, e) { EnemyArt.shoggoth(ctx, s, t, e); },
  starspawn(ctx, s, t) {
    const flap = Math.sin(t * 1.5);
    ctx.save(); ctx.translate(-s * 0.3, -s * 0.4); ctx.rotate(-0.4);
    raggedWing(ctx, -1, s * 1.4, flap, '#0b1810', 'rgba(60,110,80,0.3)'); ctx.restore();
    ctx.strokeStyle = '#13241a'; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.25, s * 0.4); ctx.lineTo(-s * 0.4, s * 0.95); ctx.moveTo(s * 0.2, s * 0.4); ctx.lineTo(s * 0.3, s * 0.95); ctx.stroke();
    const g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, '#22382a'); g.addColorStop(1, '#09130d');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.6, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = s * 0.14; ctx.strokeStyle = '#162a1d';
    ctx.beginPath(); ctx.moveTo(s * 0.4, -s * 0.1); ctx.quadraticCurveTo(s * 0.9, s * 0.1, s * 1.0 + Math.sin(t) * s * 0.1, s * 0.45); ctx.stroke();
    ctx.strokeStyle = '#9a9a80'; ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(s * 1.0, s * 0.45); ctx.lineTo(s * 1.2, s * 0.5 + i * s * 0.12); ctx.stroke(); }
    for (let i = 0; i < 8; i++) tentacle(ctx, s * 0.35 + (i - 3.5) * s * 0.05, -s * 0.35, Math.PI / 2 - 0.3 + (i - 3.5) * 0.12, s * 0.75, 2.4, t * 2.5 + i, '#28442f', 7, 0.6);
    const hg = ctx.createRadialGradient(s * 0.2, -s * 0.9, 1, s * 0.3, -s * 0.7, s * 0.6);
    hg.addColorStop(0, '#3a5a42'); hg.addColorStop(1, '#14261a');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(s * 0.3, -s * 0.72, s * 0.42, s * 0.52, 0.35, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(s * 0.5, -s * 0.62, s * 0.09, 0, TAU); ctx.arc(s * 0.25, -s * 0.58, s * 0.09, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.5, -s * 0.62], [s * 0.25, -s * 0.58]], 1.2, '#ff2a14', 6);
  },
  dagon(ctx, s, t) {
    EnemyArt.deepone(ctx, s, t);
    ctx.fillStyle = '#b9ae92'; ctx.strokeStyle = '#3a3428'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-s * 0.25, -s * 0.78);
    const pts = [[-s * 0.3, -s * 1.15], [-s * 0.12, -s * 0.95], [-s * 0.02, -s * 1.35], [s * 0.12, -s * 1.0], [s * 0.25, -s * 1.28], [s * 0.35, -s * 0.98], [s * 0.55, -s * 1.12], [s * 0.5, -s * 0.85]];
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    eyes(ctx, [[s * 0.1, -s * 1.02]], 1.6, '#3affc0', 8);
    for (let i = 0; i < 4; i++) tentacle(ctx, s * 0.55, -s * 0.15, Math.PI / 2 - 0.4 + i * 0.25, s * 0.5, 2, t * 3 + i, '#1a2e26', 5, 0.5);
  },
  haunter(ctx, s, t) {
    for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(0,0,0,${0.35 - i * 0.05})`; ctx.beginPath(); ctx.arc(Math.sin(t + i) * s * 0.4, s * (0.6 + i * 0.25), s * (0.6 - i * 0.06), 0, TAU); ctx.fill(); }
    const flap = Math.sin(t * 3.5);
    raggedWing(ctx, -1, s * 2.0, flap, '#040407', 'rgba(150,40,30,0.25)');
    raggedWing(ctx, 1, s * 2.0, flap, '#040407', 'rgba(150,40,30,0.25)');
    ctx.fillStyle = '#08080d'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.55, s * 0.9, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 2.1;
      eyes(ctx, [[Math.cos(a) * s * 0.17, -s * 0.2 + Math.sin(a) * s * 0.17]], s * 0.13 * (0.85 + 0.15 * Math.sin(t * 6 + i)), '#ff3a1a', 14);
    }
  },
  dunwich(ctx, s, t) {
    for (let i = 0; i < 12; i++) {
      const [ex, ey] = tentacle(ctx, 0, 0, i / 12 * TAU + Math.sin(t * 0.7) * 0.3, s * 1.35, 4.5, t * 2 + i, 'rgba(70,64,78,0.85)', 9, 0.8);
      if (i % 3 === 0) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex, ey, 2, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(58,52,64,0.92)'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s * 0.65, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6 + 0.4, mx = Math.cos(a) * s * 0.45, my = Math.sin(a) * s * 0.35;
      const o = Math.max(0, Math.sin(t * 2 + i)) * s * 0.08 + 0.5;
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(mx, my, s * 0.13, o, a, 0, TAU); ctx.fill();
    }
    // the half-human face near the top
    ctx.fillStyle = '#9d907c'; ctx.beginPath(); ctx.ellipse(s * 0.05, -s * 0.55, s * 0.2, s * 0.25, 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(s * 0.05, -s * 0.42, s * 0.08, s * 0.05, 0, 0, TAU); ctx.fill();
    eyes(ctx, [[-s * 0.02, -s * 0.6], [s * 0.12, -s * 0.6]], 1, '#e8e0c0', 2);
    eyes(ctx, [[-s * 0.35, s * 0.05], [s * 0.38, s * 0.15], [0, s * 0.3]], 1.6, '#b0ff40', 8);
  },
  nyarlathotep(ctx, s, t) {
    for (let i = 0; i < 7; i++) tentacle(ctx, (i - 3) * s * 0.18, s * 0.9, Math.PI / 2 + (i - 3) * 0.3, s * 0.9, 3, t * 2 + i, '#06050a', 7, 0.9);
    ctx.fillStyle = 'rgba(30,0,40,0.4)'; ctx.beginPath(); ctx.arc(0, 0, s * 1.2 + Math.sin(t * 3) * 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#050407';
    ctx.beginPath(); ctx.moveTo(-s * 0.85, s * 1.05); ctx.lineTo(s * 0.85, s * 1.05); ctx.lineTo(s * 0.32, -s * 0.3); ctx.lineTo(-s * 0.32, -s * 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a6528';
    ctx.beginPath(); ctx.moveTo(-s * 0.68, s * 0.2); ctx.lineTo(-s * 0.42, -s * 1.05); ctx.lineTo(s * 0.42, -s * 1.05); ctx.lineTo(s * 0.68, s * 0.2); ctx.lineTo(s * 0.32, -s * 0.2); ctx.lineTo(-s * 0.32, -s * 0.2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#141a30'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.58, -s * 0.12 - i * s * 0.22); ctx.lineTo(s * 0.58, -s * 0.12 - i * s * 0.22); ctx.stroke(); }
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, -s * 0.52, s * 0.3, s * 0.4, 0, 0, TAU); ctx.fill();
    eyes(ctx, [[-s * 0.11, -s * 0.56], [s * 0.11, -s * 0.56]], 1.3, '#ff1838', 8);
  },
  cthulhu(ctx, s, t) {
    const flap = Math.sin(t * 1.2);
    raggedWing(ctx, -1, s * 2.0, flap, '#08130c', 'rgba(70,130,90,0.25)');
    raggedWing(ctx, 1, s * 2.0, flap, '#08130c', 'rgba(70,130,90,0.25)');
    ctx.fillStyle = '#132619'; ctx.beginPath(); ctx.ellipse(0, s * 0.4, s * 0.95, s * 0.8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#14281a'; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) {
      const cx = sd * s * 1.15, cy = s * 0.2 + Math.sin(t * 1.5 + sd) * s * 0.15;
      ctx.beginPath(); ctx.moveTo(sd * s * 0.6, s * 0.1); ctx.quadraticCurveTo(sd * s * 1.1, -s * 0.3, cx, cy); ctx.stroke();
      ctx.save(); ctx.strokeStyle = '#8a8a70'; ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + sd * s * 0.2, cy + s * 0.1, cx + sd * s * 0.15 + i * s * 0.1, cy + s * 0.3); ctx.stroke(); }
      ctx.restore();
    }
    for (let i = 0; i < 11; i++) tentacle(ctx, (i - 5) * s * 0.07, -s * 0.05, Math.PI / 2 + (i - 5) * 0.1, s * 1.35, 5, t * 1.8 + i * 0.7, '#25432e', 10, 0.7);
    const g = ctx.createRadialGradient(-s * 0.15, -s * 0.65, 2, 0, -s * 0.35, s * 0.85);
    g.addColorStop(0, '#3e6a4a'); g.addColorStop(1, '#122418');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -s * 0.38, s * 0.6, s * 0.72, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, -s * 0.95 + i * 5, s * 0.32, 0.5, Math.PI - 0.5); ctx.stroke(); }
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(-s * 0.24, -s * 0.28, s * 0.12, s * 0.07, 0.3, 0, TAU); ctx.ellipse(s * 0.24, -s * 0.28, s * 0.12, s * 0.07, -0.3, 0, TAU); ctx.fill();
    eyes(ctx, [[-s * 0.24, -s * 0.28], [s * 0.24, -s * 0.28]], 2.4, '#ff5a10', 14);
  },
};

const ICHOR = { cultist: '#3a080b', ghoul: '#26261a', deepone: '#0c2a20', nightgaunt: '#09090f', migo: '#3a1a2c', byakhee: '#2a1d14',
  shambler: '#1d1228', hound: '#0e1a2c', shoggoth: '#08110c', proto: '#08110c', starspawn: '#0c2014', scorch: '#050505' };

function drawEnemyBody(ctx, type, s, t, e) { (EnemyArt[type] || EnemyArt.cultist)(ctx, s, t, e); }
// ---------------- tower art ----------------
function drawTowerBase(ctx, def, level) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 12, 16, 6, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -16, 0, 16);
  g.addColorStop(0, '#5a5650'); g.addColorStop(1, '#2e2c28');
  ctx.fillStyle = g;
  roundRect(ctx, -15, -15, 30, 30, 6); ctx.fill();
  ctx.strokeStyle = def.color; ctx.lineWidth = 2; roundRect(ctx, -15, -15, 30, 30, 6); ctx.stroke();
  ctx.fillStyle = '#ffd76a';
  for (let i = 0; i < level; i++) { ctx.beginPath(); ctx.arc(-9 + i * 6, 12, 1.8, 0, TAU); ctx.fill(); }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

const TowerArt = {
  rifle(ctx, t, lvl, time) {
    ctx.save(); ctx.rotate(t.angle);
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(4, -1.5, 14 + lvl * 2, 3);
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(0, -2.5, 8, 5);
    ctx.restore();
    ctx.fillStyle = ['#6a5a40', '#5a6a40', '#4a4a5a', '#c8c8d8'][lvl]; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a2018'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d8c090'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill();
  },
  mortar(ctx, t, lvl) {
    ctx.save(); ctx.rotate(t.angle);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, -5 - lvl * 0.5, 12, 10 + lvl);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(12, 0, 4 + lvl * 0.5, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = lvl >= 3 ? '#ff7a30' : '#c04020'; ctx.fillRect(-4, -9, 3, 6); ctx.fillRect(1, -9, 3, 6);
  },
  ward(ctx, t, lvl, time) {
    const a = (t.anim || 0) * 0.5;
    ctx.save();
    ctx.shadowColor = '#7affb0'; ctx.shadowBlur = 6 + lvl * 3;
    ctx.strokeStyle = lvl >= 3 ? '#b0ffd0' : '#6ad0a0'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) { const ang = a - Math.PI / 2 + i * 2 * TAU / 5; const x = Math.cos(ang) * 11, y = Math.sin(ang) * 11; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.ellipse(0, 0, 2.2, 3.6 + Math.sin(time * 8) * 0.6, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
  tesla(ctx, t, lvl, time) {
    ctx.fillStyle = '#704a20';
    for (let i = 0; i < 4; i++) { ctx.fillRect(-5 + i * 0.5, 6 - i * 5, 10 - i, 3); }
    ctx.fillStyle = '#3a3a4a'; ctx.fillRect(-1.5, -14, 3, 22);
    ctx.save(); ctx.shadowColor = '#80c0ff'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#c0e0ff'; ctx.beginPath(); ctx.arc(0, -16, 4 + lvl * 0.6, 0, TAU); ctx.fill(); ctx.restore();
    if (Math.random() < 0.3) {
      ctx.strokeStyle = 'rgba(160,210,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -16);
      for (let i = 0; i < 3; i++) ctx.lineTo((Math.random() - 0.5) * 16, -16 + (Math.random() - 0.5) * 16); ctx.stroke();
    }
  },
  scholar(ctx, t, lvl, time) {
    ctx.fillStyle = '#3a2050'; ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(8, 10); ctx.lineTo(4, -4); ctx.lineTo(-4, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8c0a0'; ctx.beginPath(); ctx.arc(0, -7, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1838'; ctx.beginPath(); ctx.arc(0, -8.5, 4.3, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#5a2a1a'; ctx.fillRect(-7, 0, 6, 5); ctx.fillStyle = '#e8d8b0'; ctx.fillRect(-6.5, 0.5, 5, 4);
    ctx.save(); ctx.shadowColor = '#c58cff'; ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(200,140,255,${0.6 + Math.sin(time * 4) * 0.3})`;
    ctx.beginPath(); ctx.arc(7 + Math.cos(time * 2) * 2, -6 + Math.sin(time * 3) * 2, 2.5 + lvl * 0.5, 0, TAU); ctx.fill(); ctx.restore();
  },
  lighthouse(ctx, t, lvl, time) {
    ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(-7, 10); ctx.lineTo(7, 10); ctx.lineTo(4, -10); ctx.lineTo(-4, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a03030'; ctx.fillRect(-6, 2, 12, 3); ctx.fillRect(-4.6, -5, 9.2, 3);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-5, -14, 10, 4);
    ctx.save(); ctx.shadowColor = '#fff6a0'; ctx.shadowBlur = 12 + lvl * 3;
    ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(0, -13, 3.5, 0, TAU); ctx.fill(); ctx.restore();
  },
  shop(ctx, t, lvl, time) {
    ctx.fillStyle = '#5a3a2a'; ctx.fillRect(-11, -4, 22, 14);
    ctx.fillStyle = '#3a2a2a'; ctx.beginPath(); ctx.moveTo(-13, -4); ctx.lineTo(0, -14); ctx.lineTo(13, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd76a'; ctx.fillRect(-7, 0, 5, 5); ctx.fillRect(2, 0, 5, 5);
    ctx.save(); ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#e8c040'; ctx.beginPath(); ctx.arc(0, -8 + Math.sin(time * 2) * 1, 3 + lvl * 0.4, 0, TAU); ctx.fill(); ctx.restore();
  },
};

function drawTower(ctx, t, time, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(t.x, t.y);
  drawTowerBase(ctx, t.def, t.level);
  TowerArt[t.type](ctx, t, t.level, time);
  if (t.maddened) {
    ctx.fillStyle = `rgba(160,40,200,${0.35 + Math.sin(time * 6) * 0.15})`;
    ctx.font = 'bold 12px serif'; ctx.textAlign = 'center'; ctx.fillText('?!', 0, -20);
  }
  ctx.restore();
}


// ---------------- icon helpers (for DOM canvases) ----------------
function drawTowerIcon(canvas, type, level = 0) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width / 40;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.scale(s, s);
  drawTower(ctx, { x: 20, y: 20, type, def: TOWERS[type], level, angle: -Math.PI / 4, anim: 0 }, 0.5);
  ctx.restore();
}
function drawEnemyIcon(canvas, type, time = 0.3) {
  const ctx = canvas.getContext('2d');
  const def = ENEMIES[type];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sc = canvas.width / Math.max(26, def.size * (def.flying ? 3.6 : 2.8));
  ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2 + 1 * sc); ctx.scale(sc, sc);
  drawEnemyBody(ctx, type, def.size, time, { id: 7 });
  ctx.restore();
}

// ---------------- Renderer ----------------
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
    this.light = document.createElement('canvas'); this.light.width = W; this.light.height = H;
    this.lctx = this.light.getContext('2d');
    this.rain = Array.from({ length: 110 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 320 + Math.random() * 200 }));
    this.fog = Array.from({ length: 9 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 120 + Math.random() * 160, vx: 4 + Math.random() * 9 }));
    this.boltT = 8 + Math.random() * 10;
    this.flashLvl = 0;
  }

  // ---------- static background ----------
  prerender(game) {
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const ctx = bg.getContext('2d');
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
    this.stain = document.createElement('canvas'); this.stain.width = W; this.stain.height = H;
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

    ctx.save();
    if (game.shake > 0) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    ctx.drawImage(this.bg, 0, 0);
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
      ctx.fillStyle = e.color; ctx.shadowColor = e.color; ctx.shadowBlur = 6 + e.r * 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(0.7, e.r * 0.9), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawEmissive(ctx, game, t) {
    // beams
    for (const tw of game.towers) if (tw.def.kind === 'beam' && tw.beamTarget && tw.beamTarget.alive && tw.beamTime > 0) {
      const e = tw.beamTarget, ramp = Math.min(1, tw.beamTime / 3);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,240,150,${0.3 + ramp * 0.3})`; ctx.lineWidth = 6 + ramp * 6 + Math.sin(t * 30) * 1.5;
      ctx.beginPath(); ctx.moveTo(tw.x, tw.y - 13); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,230,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tw.x, tw.y - 13); ctx.lineTo(e.x, e.y); ctx.stroke();
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
        ctx.shadowColor = '#c58cff'; ctx.shadowBlur = 12; ctx.fillStyle = '#e8d0ff';
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
          ctx.strokeStyle = `rgba(170,210,255,${1 - k})`; ctx.shadowColor = '#80c0ff'; ctx.shadowBlur = 10; ctx.lineWidth = 2;
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
          ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#a0ffc8'; ctx.lineWidth = 4; ctx.shadowColor = '#60ffa0'; ctx.shadowBlur = 20;
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
    const d = e.def, s = d.size;
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
