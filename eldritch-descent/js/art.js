// ============================================================
//  ELDRITCH DESCENT — vector source art (shared with Eldritch Bastion)
//  Drawn once into tiny canvases and quantised to pixel art by pixel.js
// ============================================================

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
function fangs(ctx, x0, y0, x1, y1, n, len, color = '#b8ae8c') {
  // irregular, yellowed needles: uneven lengths, gaps, a few broken
  const dx = (x1 - x0) / n, dy = (y1 - y0) / n, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  for (let i = 0; i < n; i++) {
    const h = Math.abs(Math.sin(i * 12.9898 + x0 * 0.37 + y0 * 0.11) * 43758.5453 % 1);
    if (h < 0.22) continue;
    const L = len * (0.45 + 0.8 * h), x = x0 + dx * (i + (h - 0.5) * 0.35), y = y0 + dy * i;
    ctx.fillStyle = h > 0.6 ? color : '#8a8266';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * 0.32 + nx * L, y + dy * 0.32 + ny * L); ctx.lineTo(x + dx * 0.55, y + dy * 0.55); ctx.closePath(); ctx.fill();
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
    ctx.strokeStyle = '#1e0a0c'; ctx.lineWidth = 0.7 + Math.sin(t * 3) * 0.15;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-s * 0.2 - i * s * 0.08, s * 0.02, s * 0.13, -0.6, 0.7); ctx.stroke(); }
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
  // ---------------------------------------------------------- RIFT HOUND (starved, eyeless, coming apart behind)
  hound(ctx, s, t) {
    const g = t * 7, skin = '#3a4452', dark = '#1e2430', bone = '#9aa0a8', crack = '#7ad0ff';
    const bob = Math.sin(g * 2) * s * 0.025;
    ctx.save(); ctx.translate(0, bob);
    const fore = (x, ph, col) => {
      const sw = Math.sin(g + ph) * s * 0.26, lift = Math.max(0, Math.cos(g + ph)) * s * 0.14;
      const px = x + s * 0.12 + sw, py = s * 0.98 - lift, wx = px - s * 0.05, wy = py - s * 0.3;
      limb(ctx, x, -s * 0.32, wx, wy, s * 0.12, s * 0.2, s * 0.1, col);
      limb(ctx, wx, wy, px + s * 0.1, py, -s * 0.04, s * 0.1, s * 0.08, col);
      claws(ctx, px + s * 0.1, py - s * 0.02, 0.05, s * 0.16, 3, 0.7, bone, 0.7);
    };
    const hind = (x, ph, col) => {
      const sw = Math.sin(g + ph) * s * 0.26, lift = Math.max(0, Math.cos(g + ph)) * s * 0.14;
      const px = x + sw, py = s * 0.98 - lift, hx = px - s * 0.2, hy = py - s * 0.38;
      limb(ctx, x, -s * 0.28, hx, hy, -s * 0.24, s * 0.3, s * 0.12, col);
      limb(ctx, hx, hy, px, py, s * 0.03, s * 0.1, s * 0.08, col);
      claws(ctx, px, py - s * 0.02, 0.05, s * 0.14, 3, 0.7, bone, 0.7);
    };
    // far legs
    fore(s * 0.42, Math.PI, dark); hind(-s * 0.58, 0, dark);
    // starved body: deep keel of a chest, waist pinched to nothing
    const body = () => {
      ctx.beginPath(); ctx.moveTo(s * 0.82, -s * 0.48);
      ctx.quadraticCurveTo(s * 0.52, -s * 0.74, s * 0.2, -s * 0.62);
      ctx.quadraticCurveTo(-s * 0.15, -s * 0.5, -s * 0.5, -s * 0.62);
      ctx.quadraticCurveTo(-s * 0.86, -s * 0.62, -s * 0.92, -s * 0.32);
      ctx.quadraticCurveTo(-s * 0.86, -s * 0.06, -s * 0.6, -s * 0.1);
      ctx.quadraticCurveTo(-s * 0.25, -s * 0.28, s * 0.12, -s * 0.06);
      ctx.quadraticCurveTo(s * 0.48, s * 0.12, s * 0.72, -s * 0.12);
      ctx.quadraticCurveTo(s * 0.92, -s * 0.3, s * 0.82, -s * 0.48);
      ctx.closePath();
    };
    solid(ctx, body, skin, s, 'rgba(190,210,235,0.16)');
    ctx.save(); body(); ctx.clip();
    // ribs under taut skin
    for (let i = 0; i < 6; i++) {
      const x = s * (0.58 - i * 0.1);
      ctx.strokeStyle = 'rgba(8,10,16,0.7)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(x + s * 0.03, -s * 0.56); ctx.quadraticCurveTo(x - s * 0.1, -s * 0.3, x - s * 0.02, s * 0.02); ctx.stroke();
      ctx.strokeStyle = 'rgba(170,185,205,0.3)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(x + s * 0.07, -s * 0.54); ctx.quadraticCurveTo(x - s * 0.05, -s * 0.3, x + s * 0.02, -s * 0.02); ctx.stroke();
    }
    // the haunch: a hard pelvis under the skin
    ctx.strokeStyle = 'rgba(8,10,16,0.6)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(-s * 0.58, -s * 0.36, s * 0.2, -2.2, 0.6); ctx.stroke();
    ctx.restore();
    // vertebrae standing out along the spine
    ctx.fillStyle = bone;
    for (let i = 0; i < 9; i++) { const k = i / 8, x = s * (0.6 - k * 1.3), y = -s * (0.66 - Math.sin(k * Math.PI) * 0.1 + (k > 0.5 ? (k - 0.5) * 0.08 : 0)); ctx.beginPath(); ctx.arc(x, y - s * 0.02, s * 0.045, 0, TAU); ctx.fill(); }
    // its hindquarters are not entirely here: slivers cut away and drifting loose
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    for (const [x, y, a, l] of [[-0.62, -0.5, 0.9, 0.3], [-0.78, -0.25, 0.3, 0.26], [-0.5, -0.2, 1.6, 0.18]]) {
      ctx.save(); ctx.translate(s * x, s * y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(-s * l, 0); ctx.lineTo(0, -s * 0.035); ctx.lineTo(s * l, 0); ctx.lineTo(0, s * 0.045); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const p = (t * 0.8 + i / 4) % 1, x = -s * (0.95 + p * 0.85 + (i % 3) * 0.08), y = -s * (0.55 - (i % 4) * 0.13) - p * s * 0.12, r = s * (0.15 - p * 0.07);
      ctx.save(); ctx.translate(x, y); ctx.rotate(i * 1.7 + p * 1.5);
      ctx.fillStyle = i % 2 ? skin : '#262d38'; ctx.strokeStyle = 'rgba(122,208,255,0.35)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(-r, -r * 0.3); ctx.lineTo(r * 0.1, -r * 0.8); ctx.lineTo(r, r * 0.2); ctx.lineTo(-r * 0.4, r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // cold light leaking through the cracks
    ctx.strokeStyle = crack; ctx.lineWidth = 0.7; ctx.lineJoin = 'miter';
    ctx.beginPath(); ctx.moveTo(-s * 0.9, -s * 0.38); ctx.lineTo(-s * 0.66, -s * 0.44); ctx.lineTo(-s * 0.55, -s * 0.3); ctx.lineTo(-s * 0.36, -s * 0.36); ctx.lineTo(-s * 0.22, -s * 0.22);
    ctx.moveTo(-s * 0.55, -s * 0.3); ctx.lineTo(-s * 0.6, -s * 0.14); ctx.stroke();
    eyes(ctx, [[-s * 0.55, -s * 0.3]], 0.6, crack, 3);
    // near legs
    hind(-s * 0.55, Math.PI, skin); fore(s * 0.48, 0, skin);
    // neck and the long, eyeless head, carried low
    const nk = () => { ctx.beginPath(); ctx.moveTo(s * 0.55, -s * 0.66); ctx.quadraticCurveTo(s * 0.95, -s * 0.66, s * 1.08, -s * 0.36); ctx.lineTo(s * 0.98, -s * 0.12); ctx.quadraticCurveTo(s * 0.8, -s * 0.2, s * 0.62, -s * 0.16); ctx.closePath(); };
    solid(ctx, nk, skin, s, 'rgba(190,210,235,0.16)');
    ctx.save(); ctx.translate(s * 1.02, -s * 0.3); ctx.rotate(0.38 + Math.sin(t * 2.5) * 0.06);
    const jaw = 0.12 + Math.abs(Math.sin(t * 4)) * 0.16;
    ctx.save(); ctx.rotate(jaw);
    const lj = () => { ctx.beginPath(); ctx.moveTo(-s * 0.08, s * 0.04); ctx.lineTo(s * 0.6, s * 0.06); ctx.lineTo(s * 0.55, s * 0.14); ctx.lineTo(-s * 0.04, s * 0.17); ctx.closePath(); };
    solid(ctx, lj, dark, s, null);
    fangs(ctx, s * 0.12, s * 0.06, s * 0.56, s * 0.07, 6, -s * 0.09, '#c9c6b4');
    ctx.restore();
    ctx.fillStyle = '#0a0406'; ctx.beginPath(); ctx.moveTo(0, s * 0.04); ctx.lineTo(s * 0.6, s * 0.04); ctx.lineTo(s * 0.5, s * 0.15); ctx.closePath(); ctx.fill();
    // a thin red tongue tasting the air
    tentacle(ctx, s * 0.25, s * 0.08, 0.9 + Math.sin(t * 3) * 0.3, s * 0.5, 0.9, t * 8, '#8a1c24', 6, 0.6);
    const skull = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.22, s * 0.06);
      ctx.quadraticCurveTo(-s * 0.28, -s * 0.24, s * 0.02, -s * 0.24);
      ctx.quadraticCurveTo(s * 0.35, -s * 0.18, s * 0.7, -s * 0.02);
      ctx.lineTo(s * 0.66, s * 0.06); ctx.lineTo(s * 0.02, s * 0.07); ctx.closePath();
    };
    solid(ctx, skull, '#46505e', s, 'rgba(200,220,240,0.22)');
    fangs(ctx, s * 0.14, s * 0.05, s * 0.64, s * 0.04, 7, s * 0.09, '#c9c6b4');
    // lips drawn back hard from the teeth
    ctx.strokeStyle = '#141820'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(s * 0.0, s * 0.02); ctx.quadraticCurveTo(s * 0.3, -s * 0.06, s * 0.66, s * 0.0); ctx.stroke();
    // no eyes; where they should be, a split in the skull with light behind it
    ctx.fillStyle = '#12161e'; ctx.beginPath(); ctx.ellipse(s * 0.12, -s * 0.13, s * 0.09, s * 0.03, 0.15, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.14, -s * 0.13]], 0.55, crack, 3);
    ctx.strokeStyle = 'rgba(10,12,18,0.7)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-s * 0.12, -s * 0.16); ctx.lineTo(-s * 0.2, -s * 0.05); ctx.moveTo(s * 0.3, -s * 0.15); ctx.lineTo(s * 0.45, -s * 0.09); ctx.stroke();
    ctx.restore();
    ctx.restore();
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
  // ---------------------------------------------------------- TIDEBRUTE (slumped, barnacled, its face hidden under a fold of flesh)
  starspawn(ctx, s, t) {
    const w = Math.sin(t * 2.2), hide = '#34433a', hideD = '#1c2620', belly = '#7a7c62', kelp = '#2a3018';
    const rng = hashRng(5);
    const barnacles = (pts, r) => {
      for (const [x, y, k] of pts) {
        const rr = s * r * k;
        ctx.fillStyle = '#9c967e'; ctx.beginPath(); ctx.moveTo(x - rr, y + rr * 0.5); ctx.lineTo(x - rr * 0.45, y - rr * 0.8); ctx.lineTo(x + rr * 0.45, y - rr * 0.8); ctx.lineTo(x + rr, y + rr * 0.5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 0.6; ctx.stroke();
        ctx.fillStyle = '#1a1c16'; ctx.beginPath(); ctx.ellipse(x, y - rr * 0.75, rr * 0.35, rr * 0.18, 0, 0, TAU); ctx.fill();
      }
    };
    ctx.save(); ctx.translate(0, Math.abs(w) * -s * 0.02);
    // far limbs: thick short leg, long arm dragging knuckles
    limb(ctx, -s * 0.3, s * 0.35, -s * 0.48 - w * s * 0.1, s * 0.98, s * 0.16, s * 0.4, s * 0.3, hideD);
    limb(ctx, s * 0.1, -s * 0.55, s * 0.62 + w * s * 0.08, s * 0.94, -s * 0.28, s * 0.28, s * 0.2, hideD);
    claws(ctx, s * 0.62 + w * s * 0.08, s * 0.94, 0.3, s * 0.26, 3, 1.0, '#6e6c5a', 1.1);
    // ragged fin-crest along the hump: torn membrane between uneven spines
    const crest = [[-0.86, 0.0, 0.3], [-0.78, -0.38, 0.42], [-0.6, -0.72, 0.5], [-0.36, -0.96, 0.46], [-0.08, -1.06, 0.36], [0.18, -1.0, 0.24]];
    ctx.fillStyle = 'rgba(44,56,46,0.92)'; ctx.strokeStyle = '#0c120e'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-s * 0.7, s * 0.2);
    crest.forEach(([x, y, l], i) => {
      const tx = s * (x - l * 0.55), ty = s * (y - l * 0.75) + Math.sin(t * 2 + i) * s * 0.02;
      ctx.lineTo(tx, ty); ctx.lineTo(tx + s * 0.08, ty + s * l * (i % 2 ? 0.55 : 0.32)); ctx.lineTo(s * (x - l * 0.2), s * (y - l * 0.3));
    });
    ctx.lineTo(s * 0.25, -s * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#0a0f0b'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    for (const [x, y, l] of crest) { ctx.beginPath(); ctx.moveTo(s * x, s * y); ctx.lineTo(s * (x - l * 0.55), s * (y - l * 0.75)); ctx.stroke(); }
    // slumped torso: the back is the highest point, belly sagging forward
    const torso = () => { ctx.beginPath(); ctx.moveTo(-s * 0.85, s * 0.45); ctx.bezierCurveTo(-s * 1.02, -s * 0.35, -s * 0.6, -s * 1.02, s * 0.0, -s * 0.95); ctx.bezierCurveTo(s * 0.5, -s * 0.88, s * 0.72, -s * 0.4, s * 0.6, s * 0.05); ctx.bezierCurveTo(s * 0.5, s * 0.6, -s * 0.3, s * 0.68, -s * 0.85, s * 0.45); ctx.closePath(); };
    solid(ctx, torso, hide, s, 'rgba(190,220,190,0.14)');
    ctx.save(); torso(); ctx.clip();
    ctx.fillStyle = belly; ctx.globalAlpha *= 0.7; ctx.beginPath(); ctx.ellipse(s * 0.25, s * 0.32, s * 0.42, s * 0.34, -0.3, 0, TAU); ctx.fill(); ctx.globalAlpha /= 0.7;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(s * 0.35, s * 0.6, s * (0.25 + i * 0.13), -2.6, -1.4); ctx.stroke(); }
    for (let i = 0; i < 34; i++) { const v = rng(); ctx.fillStyle = v < 0.55 ? 'rgba(0,0,0,0.3)' : v < 0.8 ? 'rgba(90,110,60,0.35)' : 'rgba(200,220,200,0.12)'; ctx.beginPath(); ctx.ellipse(-s * 0.85 + rng() * s * 1.3, -s * 0.9 + rng() * s * 1.0, s * (0.03 + rng() * 0.06), s * 0.025, rng() * 3, 0, TAU); ctx.fill(); }
    ctx.restore();
    barnacles([[-s * 0.55, -s * 0.55, 1], [-s * 0.4, -s * 0.72, 0.8], [-s * 0.68, -s * 0.3, 0.9], [-s * 0.22, -s * 0.8, 0.7], [-s * 0.5, -s * 0.15, 0.6], [-s * 0.32, -s * 0.48, 0.55]], 0.09);
    // kelp hanging off the back
    // near leg: short, thick, bowed under the weight
    limb(ctx, -s * 0.12, s * 0.35, -s * 0.05 + w * s * 0.12, s * 0.98, s * 0.2, s * 0.44, s * 0.34, hide);
    ctx.fillStyle = hideD; ctx.beginPath(); ctx.ellipse(-s * 0.0 + w * s * 0.12, s * 0.99, s * 0.22, s * 0.07, 0, 0, TAU); ctx.fill();
    // near arm thrust forward under the head, webbed claws spread to crush
    const hx = s * 1.32 + w * s * 0.05, hy = s * 0.02 + Math.sin(t * 2.2 + 1) * s * 0.06;
    limb(ctx, s * 0.32, -s * 0.42, hx, hy, s * 0.26, s * 0.38, s * 0.27, hide);
    barnacles([[s * 0.62, -s * 0.12, 0.8], [s * 0.76, -s * 0.06, 0.6]], 0.08);
    ctx.fillStyle = 'rgba(52,66,54,0.9)'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + s * 0.22, hy - s * 0.32); ctx.lineTo(hx + s * 0.4, hy - s * 0.12); ctx.lineTo(hx + s * 0.36, hy + s * 0.14); ctx.closePath(); ctx.fill();
    claws(ctx, hx, hy, -0.75, s * 0.42, 4, 1.4, '#b0ae98', 1.3);
    tentacle(ctx, s * 0.85, -s * 0.0, Math.PI / 2, s * 0.42, 1.5, t * 2, kelp, 5, 0.3);
    // the face: a heavy fold of flesh slumped forward over it, feelers hanging below
    ctx.save(); ctx.translate(s * 0.76, -s * 0.5); ctx.rotate(Math.sin(t * 1.3) * 0.04);
    for (let i = 0; i < 7; i++) tentacle(ctx, s * (0.1 + i * 0.075), s * 0.26, Math.PI / 2 - 0.1 + (i - 3) * 0.07, s * (0.28 + (i % 3) * 0.12), 2.0, t * 2.6 + i, i % 2 ? '#3a4a3c' : '#2c382e', 6, 0.5);
    // beneath the fold: a wet dark gap, crooked teeth, one sick yellow eye peering out
    ctx.fillStyle = '#040504'; ctx.beginPath(); ctx.ellipse(s * 0.3, s * 0.2, s * 0.34, s * 0.15, 0.15, 0, TAU); ctx.fill();
    fangs(ctx, s * 0.05, s * 0.26, s * 0.55, s * 0.32, 6, -s * 0.08, '#a8a088');
    ctx.fillStyle = '#2a2a10'; ctx.beginPath(); ctx.ellipse(s * 0.44, s * 0.14, s * 0.09, s * 0.065, 0, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.45, s * 0.14]], s * 0.05, '#e8d040', 6);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(s * 0.46, s * 0.14, s * 0.012, s * 0.045, 0, 0, TAU); ctx.fill();
    const fold = () => { ctx.beginPath(); ctx.moveTo(-s * 0.4, s * 0.12); ctx.bezierCurveTo(-s * 0.42, -s * 0.38, s * 0.1, -s * 0.56, s * 0.42, -s * 0.36); ctx.bezierCurveTo(s * 0.7, -s * 0.2, s * 0.76, s * 0.12, s * 0.66, s * 0.3); ctx.quadraticCurveTo(s * 0.6, s * 0.12, s * 0.48, s * 0.06); ctx.quadraticCurveTo(s * 0.1, s * 0.0, -s * 0.4, s * 0.12); ctx.closePath(); };
    solid(ctx, fold, '#4a5a48', s, 'rgba(210,235,200,0.26)');
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.9;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.2 + i * s * 0.14, -s * 0.34 + i * s * 0.03); ctx.quadraticCurveTo(s * 0.25, -s * 0.24 + i * s * 0.08, s * 0.6, s * 0.06 + i * s * 0.06); ctx.stroke(); }
    barnacles([[s * 0.0, -s * 0.3, 1], [s * 0.18, -s * 0.38, 0.8], [-s * 0.18, -s * 0.18, 0.7]], 0.08);
    ctx.restore();
    ctx.restore();
  },
  // ---------------------------------------------------------- THE TIDE PATRIARCH (ancient, stooped, wrapped in drowned nets)
  dagon(ctx, s, t) {
    const sway = Math.sin(t * 1.6), skin = '#55604f', skinD = '#2c3329', net = '#1a221d', rot = '#3a3020';
    const rng = hashRng(12);
    ctx.save(); ctx.translate(0, Math.abs(sway) * -s * 0.015);
    // far arm raised, long webbed fingers spread: calling the tide
    const rx = s * 0.05 + sway * s * 0.04, ry = -s * 1.72;
    limb(ctx, s * 0.05, -s * 0.85, rx, ry, -s * 0.16, s * 0.15, s * 0.11, skinD);
    ctx.fillStyle = 'rgba(40,52,42,0.85)'; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - s * 0.2, ry - s * 0.3); ctx.lineTo(rx + s * 0.05, ry - s * 0.38); ctx.lineTo(rx + s * 0.24, ry - s * 0.24); ctx.closePath(); ctx.fill();
    claws(ctx, rx, ry, -Math.PI / 2 - 0.3, s * 0.36, 4, 1.4, '#8a8a74', 1.0);
    // cape of rotting fishing nets, dragging on the ground behind him
    const cape = () => {
      ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 1.0);
      ctx.bezierCurveTo(-s * 0.5, -s * 1.1, -s * 0.85, -s * 0.3, -s * 1.15, s * 0.95);
      for (let i = 1; i <= 9; i++) ctx.lineTo(-s * 1.15 + i * s * 0.15, s * (0.98 + (i % 2 ? -0.1 : 0.04) + (i % 3 === 0 ? -0.12 : 0)) + Math.sin(t * 2 + i) * s * 0.02);
      ctx.bezierCurveTo(-s * 0.1, s * 0.3, -s * 0.05, -s * 0.5, s * 0.1, -s * 1.0); ctx.closePath();
    };
    solid(ctx, cape, net, s, 'rgba(160,190,160,0.12)');
    ctx.save(); cape(); ctx.clip();
    ctx.strokeStyle = 'rgba(110,120,96,0.5)'; ctx.lineWidth = 0.6;
    for (let i = -10; i < 12; i++) { ctx.beginPath(); ctx.moveTo(-s * 1.4 + i * s * 0.14, -s * 1.2); ctx.lineTo(-s * 0.2 + i * s * 0.14, s * 1.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 1.4 + i * s * 0.14, s * 1.1); ctx.lineTo(-s * 0.4 + i * s * 0.14, -s * 1.2); ctx.stroke(); }
    // torn holes, rot stains
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#05070a' : rot; ctx.beginPath(); ctx.ellipse(-s * (0.3 + rng() * 0.75), -s * 0.5 + rng() * s * 1.3, s * (0.05 + rng() * 0.07), s * (0.04 + rng() * 0.05), rng() * 3, 0, TAU); ctx.fill(); }
    ctx.restore();
    // cork floats and kelp knotted into the net
    for (const [x, y] of [[-0.55, -0.35], [-0.85, 0.3], [-0.4, 0.45]]) { ctx.fillStyle = '#6a5034'; ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(s * x, s * y, s * 0.06, s * 0.045, 0.4, 0, TAU); ctx.fill(); ctx.stroke(); }
    for (let i = 0; i < 4; i++) tentacle(ctx, -s * (0.25 + i * 0.22), -s * (0.7 - i * 0.35), Math.PI / 2 + 0.2, s * (0.4 + (i % 2) * 0.2), 1.4, t * 1.8 + i, '#2a3018', 5, 0.35);
    // stooped body in a sodden robe
    const robe = () => {
      ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.95);
      ctx.bezierCurveTo(s * 0.5, -s * 0.9, s * 0.62, -s * 0.4, s * 0.5, s * 0.1);
      ctx.bezierCurveTo(s * 0.45, s * 0.5, s * 0.55, s * 0.8, s * 0.6, s * 1.0);
      ctx.lineTo(s * 0.4, s * 0.94); ctx.lineTo(s * 0.25, s * 1.0); ctx.lineTo(s * 0.05, s * 0.92); ctx.lineTo(-s * 0.15, s * 1.0);
      ctx.bezierCurveTo(-s * 0.15, s * 0.4, -s * 0.2, -s * 0.4, s * 0.1, -s * 0.95); ctx.closePath();
    };
    solid(ctx, robe, '#26302a', s, 'rgba(170,200,170,0.14)');
    ctx.save(); robe(); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = s * 0.03;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(s * (0.05 + i * 0.1), -s * 0.4); ctx.quadraticCurveTo(s * (0.0 + i * 0.12), s * 0.3, s * (0.0 + i * 0.16), s * 1.0); ctx.stroke(); }
    // gaunt chest, ribbed and scaled, showing where the robe hangs open
    ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.85); ctx.quadraticCurveTo(s * 0.6, -s * 0.7, s * 0.5, -s * 0.1); ctx.lineTo(s * 0.32, -s * 0.15); ctx.quadraticCurveTo(s * 0.32, -s * 0.55, s * 0.2, -s * 0.85); ctx.fill();
    ctx.strokeStyle = 'rgba(10,14,10,0.6)'; ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(s * 0.3, -s * (0.68 - i * 0.14), s * 0.2, -0.5, 0.4); ctx.stroke(); }
    ctx.restore();
    // a rope of shells and teeth hung round his neck
    ctx.strokeStyle = '#4a4232'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(s * 0.12, -s * 0.9); ctx.quadraticCurveTo(s * 0.32, -s * 0.5, s * 0.52, -s * 0.72); ctx.stroke();
    ctx.fillStyle = '#b8ae90'; for (const [x, y] of [[0.22, -0.66], [0.32, -0.6], [0.42, -0.62]]) { ctx.beginPath(); ctx.moveTo(s * x - 1, s * y); ctx.lineTo(s * x + 1, s * y); ctx.lineTo(s * x, s * y + s * 0.09); ctx.closePath(); ctx.fill(); }
    // the head: a long fish skull thrust forward on a bent neck
    ctx.save(); ctx.translate(s * 0.5, -s * 1.0); ctx.rotate(0.28 + sway * 0.03);
    const gape = s * (0.1 + 0.07 * Math.abs(Math.sin(t * 1.8)));
    // gill frills fanning behind the jaw
    ctx.fillStyle = '#5a3430'; ctx.strokeStyle = '#1a0c0a'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-s * 0.12, s * 0.05);
    for (let i = 0; i < 5; i++) { const a = 1.9 + i * 0.32 + Math.sin(t * 3 + i) * 0.05, l = s * (0.34 + (i % 2) * 0.1); ctx.lineTo(-s * 0.12 + Math.cos(a) * l, s * 0.05 + Math.sin(a) * l); ctx.lineTo(-s * 0.12 + Math.cos(a + 0.16) * l * 0.7, s * 0.05 + Math.sin(a + 0.16) * l * 0.7); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // lower jaw hanging open
    const lj = () => { ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.08); ctx.quadraticCurveTo(s * 0.3, s * 0.2 + gape, s * 0.72, s * 0.1 + gape); ctx.lineTo(s * 0.68, s * 0.02 + gape * 0.6); ctx.lineTo(-s * 0.05, s * 0.0); ctx.closePath(); };
    solid(ctx, lj, '#3e483a', s, null);
    ctx.fillStyle = '#060404'; ctx.beginPath(); ctx.moveTo(0, s * 0.02); ctx.quadraticCurveTo(s * 0.35, s * 0.12 + gape * 0.6, s * 0.68, s * 0.06 + gape * 0.6); ctx.lineTo(s * 0.72, -s * 0.02); ctx.closePath(); ctx.fill();
    fangs(ctx, s * 0.12, s * 0.09 + gape * 0.55, s * 0.66, s * 0.07 + gape * 0.7, 7, -s * 0.11, '#c8c0a0');
    const skull = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.28, s * 0.08);
      ctx.quadraticCurveTo(-s * 0.38, -s * 0.32, -s * 0.02, -s * 0.36);
      ctx.quadraticCurveTo(s * 0.4, -s * 0.32, s * 0.8, -s * 0.04);
      ctx.lineTo(s * 0.74, s * 0.02); ctx.quadraticCurveTo(s * 0.3, s * 0.06, -s * 0.28, s * 0.08); ctx.closePath();
    };
    solid(ctx, skull, '#6e7864', s, 'rgba(220,235,210,0.24)');
    fangs(ctx, s * 0.12, s * 0.04, s * 0.74, -s * 0.0, 8, s * 0.12, '#c8c0a0');
    // bony ridges and old scars along the snout
    ctx.strokeStyle = 'rgba(20,26,18,0.65)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.24); ctx.quadraticCurveTo(s * 0.35, -s * 0.24, s * 0.72, -s * 0.05); ctx.moveTo(s * 0.3, -s * 0.18); ctx.lineTo(s * 0.4, -s * 0.06); ctx.stroke();
    // one milky, bulging eye
    ctx.fillStyle = '#1c2218'; ctx.beginPath(); ctx.arc(s * 0.12, -s * 0.17, s * 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#bfc4b0'; ctx.beginPath(); ctx.arc(s * 0.13, -s * 0.17, s * 0.09, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.14, -s * 0.17]], s * 0.035, '#e8f0d8', 3);
    ctx.strokeStyle = '#2a3226'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s * 0.04, -s * 0.3); ctx.lineTo(s * 0.26, -s * 0.24); ctx.stroke();
    // barnacles crusting the skull
    ctx.fillStyle = '#9c967e'; ctx.strokeStyle = '#1e1c14'; ctx.lineWidth = 0.5;
    for (const [x, y] of [[-0.2, -0.2], [-0.12, -0.3], [-0.24, -0.06]]) { ctx.beginPath(); ctx.arc(s * x, s * y, s * 0.045, 0, TAU); ctx.fill(); ctx.stroke(); }
    // a small crown of coral and bone, slipped askew
    ctx.save(); ctx.translate(-s * 0.1, -s * 0.36); ctx.rotate(-0.35);
    ctx.fillStyle = '#b0a486'; ctx.strokeStyle = '#2a2418'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-s * 0.22, s * 0.04);
    for (const [x, h] of [[-0.16, 0.2], [-0.06, 0.3], [0.04, 0.16], [0.13, 0.26], [0.21, 0.12]]) { ctx.lineTo(s * (x - 0.04), -s * 0.02); ctx.lineTo(s * x, -s * h); ctx.lineTo(s * (x + 0.04), -s * 0.02); }
    ctx.lineTo(s * 0.24, s * 0.04); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a3a34'; ctx.beginPath(); ctx.arc(s * 0.13, -s * 0.24, s * 0.03, 0, TAU); ctx.fill();
    eyes(ctx, [[0, s * 0.0]], s * 0.035, '#5affc0', 4);
    ctx.restore();
    ctx.restore();
    // near hand gripping a broken trident, its shaft crusted with barnacles
    const sx = s * 1.0 + sway * s * 0.02;
    ctx.strokeStyle = '#000'; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx - s * 0.04, s * 0.98); ctx.lineTo(sx + s * 0.1, -s * 1.7); ctx.stroke();
    ctx.strokeStyle = '#4a3e2a'; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.moveTo(sx - s * 0.04, s * 0.98); ctx.lineTo(sx + s * 0.1, -s * 1.7); ctx.stroke();
    ctx.fillStyle = '#9c967e'; for (const k of [0.15, 0.22, 0.6, 0.66]) { ctx.beginPath(); ctx.arc(sx - s * 0.04 + k * s * 0.14, s * 0.98 - k * s * 2.68, s * 0.035, 0, TAU); ctx.fill(); }
    const hx = sx + s * 0.1, hy = -s * 1.7;
    ctx.strokeStyle = '#000'; ctx.lineWidth = s * 0.08;
    const prongs = () => { ctx.beginPath(); ctx.moveTo(hx - s * 0.2, hy - s * 0.02); ctx.lineTo(hx + s * 0.2, hy + s * 0.02); ctx.moveTo(hx - s * 0.2, hy - s * 0.02); ctx.lineTo(hx - s * 0.24, hy - s * 0.32); ctx.moveTo(hx, hy); ctx.lineTo(hx + s * 0.01, hy - s * 0.42); ctx.moveTo(hx + s * 0.2, hy + s * 0.02); ctx.lineTo(hx + s * 0.22, hy - s * 0.1); };
    prongs(); ctx.stroke(); ctx.strokeStyle = '#5a7466'; ctx.lineWidth = s * 0.045; prongs(); ctx.stroke();
    ctx.fillStyle = '#5a7466'; ctx.beginPath(); ctx.moveTo(hx - s * 0.04, hy - s * 0.42); ctx.lineTo(hx + s * 0.01, hy - s * 0.52); ctx.lineTo(hx + s * 0.06, hy - s * 0.42); ctx.closePath(); ctx.fill();
    limb(ctx, s * 0.4, -s * 0.72, sx + s * 0.05, -s * 0.5, s * 0.2, s * 0.16, s * 0.12, skin);
    ctx.fillStyle = skin; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.ellipse(sx + s * 0.06, -s * 0.5, s * 0.08, s * 0.1, 0.2, 0, TAU); ctx.fill(); ctx.stroke();
    claws(ctx, sx + s * 0.1, -s * 0.46, 0.4, s * 0.12, 3, 0.6, '#8a8a74', 0.8);
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
  // ---------------------------------------------------------- THE HOLLOW KING (an empty robe, a porcelain face, a crown that floats)
  nyarlathotep(ctx, s, t) {
    const sway = Math.sin(t * 1.4) * 0.035, robeC = '#14101a', rim = 'rgba(170,120,230,0.2)';
    const ag = ctx.createRadialGradient(0, -s * 0.3, s * 0.2, 0, -s * 0.2, s * 1.6);
    ag.addColorStop(0, 'rgba(60,20,80,0.3)'); ag.addColorStop(1, 'rgba(30,0,40,0)');
    ctx.fillStyle = ag; ctx.fillRect(-s * 1.7, -s * 1.9, s * 3.4, s * 3.4);
    // the hem frays into smoke
    for (let i = 0; i < 9; i++) tentacle(ctx, (i - 4) * s * 0.16, s * 0.84, Math.PI / 2 + (i - 4) * 0.2 - 0.3, s * (0.3 + (i % 3) * 0.14), 2.6, t * 1.8 + i, '#0a0810', 6, 0.9);
    ctx.save(); ctx.rotate(sway);
    // far arm: a sleeve, and a hand of long bones reaching out
    const sleeve = (sd, hx, hy, col) => {
      const sl = () => { ctx.beginPath(); ctx.moveTo(sd * s * 0.2, -s * 0.68); ctx.quadraticCurveTo(sd * s * 0.7, -s * 0.62, hx - sd * s * 0.12, hy - s * 0.12); ctx.lineTo(hx + sd * s * 0.06, hy + s * 0.16); ctx.quadraticCurveTo(sd * s * 0.45, -s * 0.2, sd * s * 0.16, -s * 0.3); ctx.closePath(); };
      solid(ctx, sl, col, s, rim);
      ctx.save(); sl(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(sd * s * (0.3 + i * 0.12), -s * 0.6); ctx.lineTo(hx - sd * s * (0.25 - i * 0.08), hy + s * 0.05); ctx.stroke(); }
      ctx.restore();
    };
    const boneHand = (x, y, ang, n, len) => {
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const a = ang + (i / (n - 1) - 0.5) * 1.0, l = len * (0.75 + 0.25 * Math.sin(i * 2.1));
        const mx = x + Math.cos(a) * l * 0.55, my = y + Math.sin(a) * l * 0.55, ex = x + Math.cos(a + 0.35) * l, ey = y + Math.sin(a + 0.35) * l;
        for (const [c, wd] of [['#000', 1.8], ['#c8c0aa', 0.8]]) { ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke(); }
      }
    };
    const fx = -s * 0.95, fy = -s * 0.3 + Math.sin(t * 1.3) * s * 0.06;
    sleeve(-1, fx, fy, '#100c15');
    boneHand(fx - s * 0.04, fy + s * 0.04, Math.PI + 0.1, 4, s * 0.42);
    // the robe: tall, narrow shoulders, wide frayed hem, deep folds
    const robe = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.28, -s * 0.7);
      ctx.bezierCurveTo(-s * 0.45, -s * 0.1, -s * 0.7, s * 0.4, -s * 0.8, s * 0.9);
      for (let i = 0; i <= 10; i++) { const x = -s * 0.8 + i * s * 0.16; ctx.lineTo(x, s * (0.9 + (i % 2 ? 0.1 : -0.03) + Math.sin(t * 2 + i) * 0.03)); }
      ctx.bezierCurveTo(s * 0.7, s * 0.4, s * 0.45, -s * 0.1, s * 0.28, -s * 0.7); ctx.closePath();
    };
    solid(ctx, robe, robeC, s, rim);
    ctx.save(); robe(); ctx.clip();
    for (let i = 0; i < 7; i++) { const x = -s * 0.5 + i * s * 0.16; ctx.strokeStyle = i % 2 ? 'rgba(0,0,0,0.6)' : 'rgba(120,90,160,0.14)'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(x * 0.4, -s * 0.6); ctx.quadraticCurveTo(x * 0.9, s * 0.2, x * 1.3, s * 1.0); ctx.stroke(); }
    // where a body should be, the robe hangs open on nothing
    ctx.fillStyle = '#030205'; ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.5); ctx.quadraticCurveTo(-s * 0.2, s * 0.2, -s * 0.3, s * 1.0); ctx.lineTo(s * 0.3, s * 1.0); ctx.quadraticCurveTo(s * 0.2, s * 0.2, s * 0.1, -s * 0.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // a cord at the waist strung with tiny porcelain faces
    ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-s * 0.4, s * 0.02); ctx.quadraticCurveTo(0, s * 0.16, s * 0.42, s * 0.0); ctx.stroke();
    for (const [x, y, r] of [[-0.24, 0.12, 0.07], [0.02, 0.17, 0.08], [0.27, 0.11, 0.065]]) {
      ctx.fillStyle = '#cfc8b4'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.ellipse(s * x, s * (y + 0.06), s * r * 0.75, s * r, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a1018'; ctx.beginPath(); ctx.arc(s * (x - r * 0.3), s * (y + 0.04), s * 0.016, 0, TAU); ctx.arc(s * (x + r * 0.3), s * (y + 0.04), s * 0.016, 0, TAU); ctx.fill();
    }
    // the hood, deep and black
    const hood = () => { ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.5); ctx.quadraticCurveTo(-s * 0.48, -s * 1.15, -s * 0.05, -s * 1.3); ctx.quadraticCurveTo(s * 0.42, -s * 1.22, s * 0.45, -s * 0.6); ctx.quadraticCurveTo(0, -s * 0.42, -s * 0.4, -s * 0.5); ctx.closePath(); };
    solid(ctx, hood, '#18131f', s, 'rgba(180,130,240,0.22)');
    ctx.fillStyle = '#020103'; ctx.beginPath(); ctx.ellipse(s * 0.04, -s * 0.84, s * 0.27, s * 0.34, 0.08, 0, TAU); ctx.fill();
    // inside it, a cracked porcelain face
    const mx = s * 0.05, my = -s * 0.84;
    const mask = () => { ctx.beginPath(); ctx.ellipse(mx, my, s * 0.18, s * 0.25, 0.08, 0, TAU); };
    solid(ctx, mask, '#d8d2c0', s, 'rgba(255,255,255,0.3)');
    ctx.fillStyle = '#100810';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(mx + sd * s * 0.075, my - s * 0.04, s * 0.045, s * 0.03, sd * 0.25, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(mx + s * 0.01, my + s * 0.13, s * 0.06, s * 0.012, 0, 0, TAU); ctx.fill();
    eyes(ctx, [[mx - s * 0.075, my - s * 0.04], [mx + s * 0.075, my - s * 0.04]], s * 0.018, '#d8a8ff', 6);
    ctx.strokeStyle = '#2a2028'; ctx.lineWidth = 0.7; ctx.lineJoin = 'miter';
    ctx.beginPath(); ctx.moveTo(mx + s * 0.04, my - s * 0.25); ctx.lineTo(mx + s * 0.08, my - s * 0.15); ctx.lineTo(mx + s * 0.06, my - s * 0.07); ctx.moveTo(mx + s * 0.09, my - s * 0.01); ctx.lineTo(mx + s * 0.05, my + s * 0.06); ctx.lineTo(mx + s * 0.1, my + s * 0.14); ctx.moveTo(mx + s * 0.08, my - s * 0.15); ctx.lineTo(mx + s * 0.15, my - s * 0.13); ctx.stroke();
    // a dark tear run from one eye hole
    ctx.strokeStyle = 'rgba(30,8,30,0.85)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(mx - s * 0.08, my - s * 0.01); ctx.lineTo(mx - s * 0.085, my + s * 0.1); ctx.stroke();
    // an iron crown of spikes, hanging in the air above the hood
    ctx.save(); ctx.translate(s * 0.02, -s * 1.48 + Math.sin(t * 1.7) * s * 0.035); ctx.rotate(-0.06 + Math.sin(t * 1.1) * 0.03);
    const spikes = [[-0.24, 0.24], [-0.14, 0.34], [-0.04, 0.42], [0.06, 0.38], [0.16, 0.3], [0.25, 0.22]];
    ctx.fillStyle = '#2a2830'; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.06);
    for (const [x, h] of spikes) { ctx.lineTo(s * (x - 0.035), -s * 0.02); ctx.lineTo(s * x, -s * h); ctx.lineTo(s * (x + 0.035), -s * 0.02); }
    ctx.lineTo(s * 0.3, s * 0.06); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6a5a28'; ctx.beginPath(); ctx.moveTo(-s * 0.31, s * 0.0); ctx.quadraticCurveTo(0, s * 0.08, s * 0.31, s * 0.0); ctx.lineTo(s * 0.3, s * 0.08); ctx.quadraticCurveTo(0, s * 0.15, -s * 0.3, s * 0.08); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,190,220,0.35)'; ctx.lineWidth = 0.6;
    for (const [x, h] of spikes) { ctx.beginPath(); ctx.moveTo(s * (x - 0.015), -s * 0.03); ctx.lineTo(s * x, -s * h * 0.9); ctx.stroke(); }
    ctx.restore();
    // near arm: a lantern on a chain, burning violet
    const nx = s * 0.95, ny = -s * 0.42 + Math.sin(t * 1.3 + 1) * s * 0.05;
    sleeve(1, nx, ny, robeC);
    const lx = nx + s * 0.12, ly = ny + s * 0.5 + Math.sin(t * 2) * s * 0.02;
    ctx.strokeStyle = '#3a3640'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(nx + s * 0.08, ny + s * 0.06); ctx.lineTo(lx, ly - s * 0.16); ctx.stroke();
    halo(ctx, lx, ly, s * 0.5, '#9a5aff', 0.28);
    ctx.fillStyle = '#1e1a22'; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(lx - s * 0.08, ly - s * 0.16); ctx.lineTo(lx + s * 0.08, ly - s * 0.16); ctx.lineTo(lx + s * 0.11, ly + s * 0.12); ctx.lineTo(lx - s * 0.11, ly + s * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c69cff'; ctx.beginPath(); ctx.moveTo(lx - s * 0.06, ly + s * 0.08); ctx.quadraticCurveTo(lx - s * 0.05, ly - s * 0.04, lx + Math.sin(t * 6) * s * 0.02, ly - s * 0.1); ctx.quadraticCurveTo(lx + s * 0.05, ly - s * 0.04, lx + s * 0.06, ly + s * 0.08); ctx.closePath(); ctx.fill();
    eyes(ctx, [[lx, ly + s * 0.02]], s * 0.035, '#e8d0ff', 6);
    ctx.strokeStyle = '#1e1a22'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(lx, ly - s * 0.15); ctx.lineTo(lx, ly + s * 0.12); ctx.stroke();
    boneHand(nx + s * 0.04, ny + s * 0.06, 0.6, 4, s * 0.3);
    ctx.restore();
  },
  // ---------------------------------------------------------- HOLLOW MASK (one of the King's faces, drifting)
  mask(ctx, s, t) {
    const bob = Math.sin(t * 2.2) * s * 0.06, tilt = Math.sin(t * 1.5) * 0.08;
    ctx.save(); ctx.translate(0, -s * 0.15 + bob);
    // a tattered black veil hanging from behind the face
    const veil = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.75);
      ctx.quadraticCurveTo(-s * 0.62, -s * 0.1, -s * 0.55, s * 0.6);
      for (let i = 1; i <= 7; i++) ctx.lineTo(-s * 0.55 + i * s * 0.16, s * (0.6 + (i % 2 ? 0.22 : -0.02) + (i % 3 ? 0 : 0.1)) + Math.sin(t * 3 + i) * s * 0.04);
      ctx.quadraticCurveTo(s * 0.62, -s * 0.1, s * 0.42, -s * 0.75); ctx.closePath();
    };
    solid(ctx, veil, '#100c14', s, 'rgba(170,120,230,0.18)');
    ctx.save(); veil(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = s * 0.05;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.3 + i * s * 0.15, -s * 0.4); ctx.lineTo(-s * 0.45 + i * s * 0.22, s * 0.9); ctx.stroke(); }
    ctx.restore();
    for (let i = 0; i < 4; i++) tentacle(ctx, -s * 0.4 + i * s * 0.27, s * 0.7, Math.PI / 2 + (i - 1.5) * 0.2, s * 0.35, 1.8, t * 2 + i, '#0a0810', 5, 0.9);
    // thin hands of bone, held up beside the face
    for (const sd of [-1, 1]) {
      const hx = sd * s * 0.7, hy = -s * 0.15 + Math.sin(t * 2 + sd) * s * 0.05;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + sd * (0.1 + i * 0.22), l = s * (0.28 + (i === 1 ? 0.06 : 0));
        for (const [c, wd] of [['#000', 1.6], ['#c8c0aa', 0.7]]) { ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * l * 0.55, hy + Math.sin(a) * l * 0.55); ctx.lineTo(hx + Math.cos(a - sd * 0.3) * l, hy + Math.sin(a - sd * 0.3) * l); ctx.stroke(); }
      }
      for (const [c, wd] of [['#000', 1.8], ['#c8c0aa', 0.8]]) { ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(sd * s * 0.45, s * 0.2); ctx.stroke(); }
    }
    // the face
    ctx.save(); ctx.translate(s * 0.04, -s * 0.55); ctx.rotate(tilt);
    const face = () => { ctx.beginPath(); ctx.moveTo(0, -s * 0.42); ctx.bezierCurveTo(s * 0.34, -s * 0.42, s * 0.36, s * 0.1, s * 0.16, s * 0.36); ctx.quadraticCurveTo(0, s * 0.46, -s * 0.16, s * 0.36); ctx.bezierCurveTo(-s * 0.36, s * 0.1, -s * 0.34, -s * 0.42, 0, -s * 0.42); ctx.closePath(); };
    solid(ctx, face, '#d8d2c0', s, 'rgba(255,255,255,0.35)');
    // brow ridge and a long thin nose
    ctx.strokeStyle = 'rgba(90,80,70,0.55)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.14); ctx.quadraticCurveTo(-s * 0.1, -s * 0.2, 0, -s * 0.12); ctx.quadraticCurveTo(s * 0.1, -s * 0.2, s * 0.2, -s * 0.14); ctx.moveTo(0, -s * 0.1); ctx.lineTo(s * 0.02, s * 0.1); ctx.stroke();
    ctx.fillStyle = '#0e0810';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * s * 0.11, -s * 0.06, s * 0.07, s * 0.045, sd * 0.2, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.22); ctx.quadraticCurveTo(0, s * 0.18, s * 0.1, s * 0.22); ctx.quadraticCurveTo(0, s * 0.25, -s * 0.1, s * 0.22); ctx.fill();
    eyes(ctx, [[-s * 0.11, -s * 0.06], [s * 0.11, -s * 0.06]], s * 0.025, '#d8a8ff', 5);
    // a crack through it, and a chip gone from the edge
    ctx.strokeStyle = '#2a2028'; ctx.lineWidth = 0.8; ctx.lineJoin = 'miter';
    ctx.beginPath(); ctx.moveTo(s * 0.06, -s * 0.42); ctx.lineTo(s * 0.12, -s * 0.24); ctx.lineTo(s * 0.09, -s * 0.12); ctx.moveTo(s * 0.14, -s * 0.02); ctx.lineTo(s * 0.08, s * 0.1); ctx.lineTo(s * 0.14, s * 0.24); ctx.moveTo(s * 0.12, -s * 0.24); ctx.lineTo(s * 0.24, -s * 0.22); ctx.stroke();
    ctx.fillStyle = '#100c14'; ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.0); ctx.lineTo(-s * 0.2, s * 0.08); ctx.lineTo(-s * 0.26, s * 0.18); ctx.lineTo(-s * 0.34, s * 0.06); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  },
  // ---------------------------------------------------------- THE DROWNED GOD (a bloated titan rising out of black water)
  cthulhu(ctx, s, t) {
    const breathe = Math.sin(t * 1.1) * s * 0.02, skin = '#4f5c52', skinD = '#2a322d', bone = '#b8b49c', iron = '#34343a', rust = '#6a4028';
    const rng = hashRng(9);
    const barn = (x, y, r) => { ctx.fillStyle = '#a49e86'; ctx.strokeStyle = '#1e1c14'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#1a1a14'; ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 0.4, 0, TAU); ctx.fill(); };
    const chain = (pts, w) => {
      // links alternate face-on and edge-on along a polyline
      let n = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], l = Math.hypot(x1 - x0, y1 - y0), m = Math.max(1, Math.round(l / (w * 1.5))), a = Math.atan2(y1 - y0, x1 - x0);
        for (let j = 0; j < m; j++, n++) {
          const x = x0 + (x1 - x0) * (j + 0.5) / m, y = y0 + (y1 - y0) * (j + 0.5) / m;
          ctx.save(); ctx.translate(x, y); ctx.rotate(a);
          ctx.strokeStyle = '#000'; ctx.lineWidth = w * 0.55;
          if (n % 2) { ctx.beginPath(); ctx.moveTo(-w * 0.9, 0); ctx.lineTo(w * 0.9, 0); ctx.stroke(); ctx.strokeStyle = n % 3 ? rust : iron; ctx.lineWidth = w * 0.3; ctx.stroke(); }
          else { ctx.beginPath(); ctx.ellipse(0, 0, w, w * 0.6, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = n % 4 ? iron : rust; ctx.lineWidth = w * 0.28; ctx.stroke(); }
          ctx.restore();
        }
      }
    };
    ctx.save(); ctx.translate(0, breathe);
    // far arm sunk to the elbow, hand clawing at the surface
    limb(ctx, -s * 0.92, -s * 0.55, -s * 1.42, s * 0.5, s * 0.35, s * 0.42, s * 0.34, skinD);
    // the bloated trunk, swollen with water
    const trunk = () => { ctx.beginPath(); ctx.moveTo(-s * 0.7, s * 0.9); ctx.bezierCurveTo(-s * 1.15, s * 0.4, -s * 1.25, -s * 0.2, -s * 1.0, -s * 0.62); ctx.bezierCurveTo(-s * 0.8, -s * 0.95, -s * 0.45, -s * 0.95, -s * 0.22, -s * 1.02); ctx.lineTo(s * 0.22, -s * 1.02); ctx.bezierCurveTo(s * 0.45, -s * 0.95, s * 0.8, -s * 0.95, s * 1.0, -s * 0.62); ctx.bezierCurveTo(s * 1.25, -s * 0.2, s * 1.15, s * 0.4, s * 0.7, s * 0.9); ctx.closePath(); };
    solid(ctx, trunk, skin, s, 'rgba(220,235,220,0.16)');
    ctx.save(); trunk(); ctx.clip();
    { const fg = ctx.createRadialGradient(-s * 0.15, -s * 0.55, s * 0.1, 0, -s * 0.1, s * 1.35); fg.addColorStop(0, 'rgba(200,215,200,0.22)'); fg.addColorStop(0.5, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = fg; ctx.fillRect(-s * 1.4, -s * 1.1, s * 2.8, s * 2.2); }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = s * 0.03;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * s * 0.3, -s * 0.74); ctx.quadraticCurveTo(sd * s * 0.62, -s * 0.66, sd * s * 0.86, -s * 0.72); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sd * s * 0.88, -s * 0.5); ctx.quadraticCurveTo(sd * s * 0.75, -s * 0.05, sd * s * 0.5, s * 0.05); ctx.stroke(); }
    // mottled, bruised, drowned skin
    for (let i = 0; i < 80; i++) { const x = (rng() - 0.5) * s * 2.3, y = -s * 0.9 + rng() * s * 1.8, v = rng(); ctx.fillStyle = v < 0.3 ? 'rgba(70,60,80,0.35)' : v < 0.8 ? 'rgba(0,0,0,0.25)' : 'rgba(200,215,190,0.08)'; ctx.beginPath(); ctx.ellipse(x, y, s * (0.03 + rng() * 0.07), s * (0.02 + rng() * 0.04), rng() * 3, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 7; i++) { const x = (rng() - 0.5) * s * 1.7, y = -s * 0.5 + rng() * s * 1.1; ctx.fillStyle = '#3a1c1e'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.05, s * 0.035, rng() * 3, 0, TAU); ctx.fill(); ctx.fillStyle = '#6a3a34'; ctx.beginPath(); ctx.ellipse(x - s * 0.01, y - s * 0.01, s * 0.025, s * 0.015, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(40,40,70,0.45)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) { let x = (rng() - 0.5) * s * 1.8, y = -s * 0.6 + rng() * s * 0.9; ctx.beginPath(); ctx.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (rng() - 0.5) * s * 0.18; y += s * 0.08; ctx.lineTo(x, y); } ctx.stroke(); }
    // sagging folds of the belly
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = s * 0.025;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, s * (0.05 + i * 0.2), s * (0.75 - i * 0.05), 0.5, Math.PI - 0.5); ctx.stroke(); }
    ctx.restore();
    // the chest opened like a door: a ribcage over a dark hollow with things living in it
    const cav = () => { ctx.beginPath(); ctx.ellipse(-s * 0.02, -s * 0.28, s * 0.36, s * 0.4, 0, 0, TAU); };
    ctx.fillStyle = '#4a2a2c'; ctx.beginPath(); ctx.ellipse(-s * 0.02, -s * 0.28, s * 0.42, s * 0.46, 0, 0, TAU); ctx.fill();
    cav(); ctx.fillStyle = '#080406'; ctx.fill();
    ctx.save(); cav(); ctx.clip();
    halo(ctx, 0, -s * 0.2, s * 0.4, '#5affc8', 0.22 + 0.06 * Math.sin(t * 3));
    eyes(ctx, [[-s * 0.12, -s * 0.38], [s * 0.1, -s * 0.18], [-s * 0.05, -s * 0.05], [s * 0.15, -s * 0.42], [-s * 0.18, -s * 0.16]], s * 0.022, '#9affd8', 5);
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      const y = -s * 0.56 + i * s * 0.13, wd = s * (0.36 - Math.abs(i - 1.5) * 0.04);
      for (const sd of [-1, 1]) { ctx.strokeStyle = '#000'; ctx.lineWidth = s * 0.055; ctx.beginPath(); ctx.moveTo(sd * s * 0.04, y); ctx.quadraticCurveTo(sd * wd, y - s * 0.05, sd * wd * 0.95, y + s * 0.1); ctx.stroke(); ctx.strokeStyle = bone; ctx.lineWidth = s * 0.032; ctx.stroke(); }
    }
    ctx.strokeStyle = '#000'; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.moveTo(0, -s * 0.62); ctx.lineTo(0, s * 0.02); ctx.stroke(); ctx.strokeStyle = bone; ctx.lineWidth = s * 0.035; ctx.stroke();
    // barnacles on shoulders and flanks
    for (const [x, y, r] of [[-0.82, -0.6, 0.06], [-0.7, -0.68, 0.045], [-0.92, -0.42, 0.05], [0.78, -0.66, 0.055], [0.9, -0.5, 0.045], [-0.8, 0.1, 0.05], [0.85, 0.2, 0.06], [0.7, 0.32, 0.04]]) barn(s * x, s * y, s * r);
    // heavy rusted chain slung across him
    chain([[-s * 0.82, -s * 0.72], [-s * 0.3, -s * 0.05], [s * 0.35, s * 0.35], [s * 0.82, s * 0.44]], s * 0.07);
    // the head: small for that body, sunk between the shoulders, crusted over
    const hx = 0, hy = -s * 1.0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.ellipse(0, -s * 0.72, s * 0.36, s * 0.12, 0, 0, TAU); ctx.fill();
    const head = () => { ctx.beginPath(); ctx.moveTo(-s * 0.32, -s * 0.72); ctx.bezierCurveTo(-s * 0.42, -s * 1.1, -s * 0.28, -s * 1.42, 0, -s * 1.44); ctx.bezierCurveTo(s * 0.28, -s * 1.42, s * 0.42, -s * 1.1, s * 0.32, -s * 0.72); ctx.quadraticCurveTo(0, -s * 0.62, -s * 0.32, -s * 0.72); ctx.closePath(); };
    solid(ctx, head, '#5e6a62', s, 'rgba(230,240,225,0.24)');
    // kelp hair plastered down over the skull and shoulders
    for (let i = 0; i < 11; i++) { const k = (i - 5) / 5; if (Math.abs(k) < 0.5) continue; tentacle(ctx, k * s * 0.3, -s * (1.38 - Math.abs(k) * 0.18), Math.PI / 2 + k * 0.45, s * (0.5 + Math.abs(k) * 0.55), s * 0.05, t * 1.2 + i, i % 2 ? '#262c16' : '#30361c', 8, 0.25); }
    for (const [x, y, r] of [[-0.18, -1.3, 0.05], [0.1, -1.36, 0.04], [0.22, -1.18, 0.045], [-0.26, -1.08, 0.04]]) barn(s * x, s * y, s * r);
    // one socket barnacled shut; the other holds an enormous lidless eye
    ctx.fillStyle = '#2a3028'; ctx.beginPath(); ctx.ellipse(s * 0.14, -s * 1.0, s * 0.08, s * 0.06, 0, 0, TAU); ctx.fill();
    barn(s * 0.14, -s * 1.0, s * 0.045);
    ctx.fillStyle = '#141a14'; ctx.beginPath(); ctx.ellipse(hx - s * 0.1, hy - s * 0.02, s * 0.17, s * 0.15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c8ccbc'; ctx.beginPath(); ctx.ellipse(hx - s * 0.1, hy - s * 0.02, s * 0.14, s * 0.125, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(120,60,60,0.5)'; ctx.lineWidth = 0.7;
    for (let i = 0; i < 5; i++) { const a = i * 1.3; ctx.beginPath(); ctx.moveTo(hx - s * 0.1 + Math.cos(a) * s * 0.13, hy - s * 0.02 + Math.sin(a) * s * 0.11); ctx.lineTo(hx - s * 0.1 + Math.cos(a + 0.2) * s * 0.07, hy - s * 0.02 + Math.sin(a + 0.2) * s * 0.06); ctx.stroke(); }
    const look = Math.sin(t * 0.8) * s * 0.02;
    eyes(ctx, [[hx - s * 0.1 + look, hy - s * 0.02]], s * 0.03, '#f0f4e0', 6);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(hx - s * 0.1 + look, hy - s * 0.02, s * 0.018, 0, TAU); ctx.fill();
    // slack, drowned mouth
    ctx.fillStyle = '#0a0606'; ctx.beginPath(); ctx.ellipse(hx + s * 0.0, hy + s * 0.2, s * 0.12, s * 0.05 + Math.abs(Math.sin(t * 1.2)) * s * 0.025, 0, 0, TAU); ctx.fill();
    fangs(ctx, hx - s * 0.1, hy + s * 0.17, hx + s * 0.1, hy + s * 0.17, 5, s * 0.05, '#a8a088');
    // near arm raised out of the water, a broken shackle dragging its chain
    const ax = s * 1.55, ay = -s * 1.15 + Math.sin(t * 1.2) * s * 0.06;
    limb(ctx, s * 0.92, -s * 0.5, ax + s * 0.04, ay + s * 0.06, -s * 0.3, s * 0.44, s * 0.34, skinD);
    limb(ctx, s * 0.9, -s * 0.6, ax - s * 0.02, ay, -s * 0.3, s * 0.34, s * 0.25, skin, 'rgba(0,0,0,0)');
    barn(s * 1.12, -s * 0.38, s * 0.05); barn(s * 1.25, -s * 0.5, s * 0.04);
    ctx.fillStyle = iron; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(ax - s * 0.06, ay + s * 0.14, s * 0.17, s * 0.09, -0.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = rust; ctx.beginPath(); ctx.ellipse(ax - s * 0.1, ay + s * 0.17, s * 0.07, s * 0.035, -0.5, 0, TAU); ctx.fill();
    chain([[ax - s * 0.1, ay + s * 0.22], [ax - s * 0.04, ay + s * 0.7], [ax + s * 0.04 + Math.sin(t * 1.2) * s * 0.04, ay + s * 1.4], [ax + s * 0.08, s * 0.6]], s * 0.06);
    claws(ctx, ax, ay, -Math.PI / 2 - 0.4, s * 0.42, 4, 1.2, '#a8a490', 1.6);
    // water running off him
    ctx.strokeStyle = 'rgba(150,180,175,0.45)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) { const x = -s * 0.9 + rng() * s * 1.8, y0 = -s * 0.6 + rng() * s * 0.5, p = (t * 0.6 + rng()) % 1; ctx.beginPath(); ctx.moveTo(x, y0 + p * s * 0.3); ctx.lineTo(x, y0 + p * s * 0.3 + s * 0.18); ctx.stroke(); }
    ctx.restore();
    // the black water he rises from
    const wy = s * 0.58;
    const water = () => { ctx.beginPath(); ctx.moveTo(-s * 2.15, wy + s * 0.08); for (let i = 1; i <= 21; i++) { const x = -s * 2.15 + i * s * 0.2048; ctx.lineTo(x, wy + Math.sin(i * 1.3 + t * 2.4) * s * 0.03 - Math.max(0, 1 - Math.abs(x) / (s * 1.3)) * s * 0.06); } ctx.lineTo(s * 2.15, wy + s * 0.08); ctx.bezierCurveTo(s * 1.9, s * 0.95, s * 0.8, s * 1.02, 0, s * 1.02); ctx.bezierCurveTo(-s * 0.8, s * 1.02, -s * 1.9, s * 0.95, -s * 2.15, wy + s * 0.08); ctx.closePath(); };
    water(); ctx.fillStyle = '#05080b'; ctx.fill();
    ctx.save(); water(); ctx.clip();
    ctx.strokeStyle = 'rgba(70,100,110,0.55)'; ctx.lineWidth = 0.8;
    for (let r = 0; r < 4; r++) { const ph = (t * 0.5 + r * 0.25) % 1, rx = s * (0.9 + ph * 1.2), ry = s * (0.05 + ph * 0.1); ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(0, wy + s * 0.06, rx, ry, 0, 0, Math.PI); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // his reflection: just a pale smear, and the eye
    ctx.fillStyle = 'rgba(90,110,100,0.25)'; ctx.beginPath(); ctx.ellipse(0, wy + s * 0.25, s * 0.8, s * 0.12, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(150,180,180,0.5)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-s * 1.25, wy - s * 0.04); ctx.quadraticCurveTo(0, wy - s * 0.12, s * 1.25, wy - s * 0.04); ctx.stroke();
    // the drowned hand breaking the surface
    claws(ctx, -s * 1.42, wy - s * 0.02, Math.PI / 2 + 0.9, s * 0.36, 4, 1.0, '#a8a490', 1.5);
  },
};

const ICHOR = { cultist: '#3a080b', ghoul: '#26261a', deepone: '#0c2a20', nightgaunt: '#09090f', migo: '#3a1a2c', byakhee: '#2a1d14',
  shambler: '#1d1228', hound: '#0e1a2c', shoggoth: '#08110c', proto: '#08110c', starspawn: '#0c2014', scorch: '#050505' };

function drawEnemyBody(ctx, type, s, t, e) { (EnemyArt[type] || EnemyArt.cultist)(ctx, s, t, e); }
