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
  // ---------------------------------------------------------- TIDEBRUTE (hunched, squid-headed, knuckle-walking)
  starspawn(ctx, s, t) {
    const w = Math.sin(t * 2.2), hide = '#2a4a38', hideD = '#14261c', belly = '#3e5a46';
    // vestigial ragged wing high on the back
    ctx.save(); ctx.translate(-s * 0.45, -s * 0.75); ctx.rotate(-0.55 + Math.sin(t * 1.2) * 0.06);
    batWing(ctx, -1, s * 1.05, Math.sin(t * 1.5) * 0.4, '#0b1610', 'rgba(70,120,90,0.35)'); ctx.restore();
    // far limbs
    limb(ctx, -s * 0.35, s * 0.25, -s * 0.55 - w * s * 0.12, s * 0.98, s * 0.2, s * 0.34, s * 0.26, hideD);
    limb(ctx, s * 0.05, -s * 0.35, s * 0.55 + w * s * 0.1, s * 0.95, -s * 0.25, s * 0.26, s * 0.2, hideD);
    claws(ctx, s * 0.55 + w * s * 0.1, s * 0.95, 0.3, s * 0.28, 3, 1.0, '#6a6a58', 1.1);
    // hunched torso: the back is the highest point
    const torso = () => { ctx.beginPath(); ctx.moveTo(-s * 0.85, s * 0.45); ctx.bezierCurveTo(-s * 1.0, -s * 0.35, -s * 0.55, -s * 0.95, s * 0.05, -s * 0.85); ctx.bezierCurveTo(s * 0.55, -s * 0.75, s * 0.75, -s * 0.3, s * 0.55, s * 0.1); ctx.bezierCurveTo(s * 0.3, s * 0.55, -s * 0.3, s * 0.65, -s * 0.85, s * 0.45); ctx.closePath(); };
    solid(ctx, torso, hide, s, 'rgba(160,240,190,0.14)');
    ctx.save(); torso(); ctx.clip();
    ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(s * 0.1, s * 0.35, s * 0.55, s * 0.32, -0.2, 0, TAU); ctx.fill();
    const rng = hashRng(5);
    for (let i = 0; i < 26; i++) { ctx.fillStyle = rng() < 0.6 ? 'rgba(0,0,0,0.28)' : 'rgba(170,220,190,0.12)'; ctx.beginPath(); ctx.ellipse(-s * 0.8 + rng() * s * 1.4, -s * 0.8 + rng() * s * 1.3, s * (0.04 + rng() * 0.06), s * 0.03, rng() * 3, 0, TAU); ctx.fill(); }
    ctx.restore();
    // dorsal spines along the hump
    ctx.fillStyle = '#0e1c14';
    for (let i = 0; i < 6; i++) { const k = i / 5, x = -s * 0.75 + k * s * 0.85, y = -s * (0.45 + Math.sin(k * 3.0) * 0.48); ctx.beginPath(); ctx.moveTo(x - s * 0.06, y + s * 0.04); ctx.lineTo(x - s * 0.14, y - s * (0.28 - Math.abs(k - 0.45) * 0.2)); ctx.lineTo(x + s * 0.07, y + s * 0.02); ctx.closePath(); ctx.fill(); }
    // near leg
    limb(ctx, -s * 0.2, s * 0.35, -s * 0.15 + w * s * 0.14, s * 0.98, s * 0.22, s * 0.4, s * 0.3, hide);
    // head: an elongated mantle thrust forward, face tentacles hanging beneath
    ctx.save(); ctx.translate(s * 0.55, -s * 0.48); ctx.rotate(-0.45 + Math.sin(t * 1.3) * 0.05);
    for (let i = 0; i < 9; i++) tentacle(ctx, s * 0.05 + (i - 4) * s * 0.035, s * 0.12, Math.PI / 2 + 0.45 + (i - 4) * 0.09, s * (0.65 + (i % 3) * 0.14), 2.4, t * 2.4 + i, i % 2 ? '#2a4a36' : '#223e2e', 8, 0.55);
    const mantle = () => { ctx.beginPath(); ctx.moveTo(-s * 0.18, s * 0.16); ctx.bezierCurveTo(-s * 0.32, -s * 0.15, -s * 0.1, -s * 0.72, s * 0.28, -s * 0.78); ctx.bezierCurveTo(s * 0.5, -s * 0.7, s * 0.45, -s * 0.1, s * 0.3, s * 0.16); ctx.closePath(); };
    solid(ctx, mantle, '#30553f', s, 'rgba(170,240,200,0.2)');
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.12 + i * s * 0.06, -s * 0.05 - i * s * 0.14); ctx.quadraticCurveTo(s * 0.12, -s * 0.12 - i * s * 0.14, s * 0.35, -s * 0.02 - i * s * 0.14); ctx.stroke(); }
    ctx.fillStyle = '#050a07'; ctx.beginPath(); ctx.ellipse(s * 0.22, s * 0.0, s * 0.08, s * 0.035, -0.3, 0, TAU); ctx.ellipse(s * 0.02, s * 0.04, s * 0.07, s * 0.03, -0.2, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.22, s * 0.0], [s * 0.02, s * 0.04]], 0.75, '#ff3a1a', 5);
    ctx.restore();
    // near arm, knuckles down
    const ax = s * 1.05 + w * s * 0.08, ay = s * 0.92;
    limb(ctx, s * 0.3, -s * 0.38, ax, ay, -s * 0.3, s * 0.32, s * 0.24, hide);
    claws(ctx, ax, ay, 0.2, s * 0.34, 4, 1.2, '#9a9a84', 1.2);
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
  // ---------------------------------------------------------- THE HOLLOW KING (gaunt, robed, faceless)
  nyarlathotep(ctx, s, t) {
    const sway = Math.sin(t * 1.4) * 0.04;
    const ag = ctx.createRadialGradient(0, -s * 0.3, s * 0.2, 0, -s * 0.2, s * 1.6);
    ag.addColorStop(0, 'rgba(70,20,90,0.35)'); ag.addColorStop(1, 'rgba(30,0,40,0)');
    ctx.fillStyle = ag; ctx.fillRect(-s * 1.7, -s * 1.8, s * 3.4, s * 3.4);
    // shadow bleeding from the hem
    for (let i = 0; i < 9; i++) tentacle(ctx, (i - 4) * s * 0.17, s * 0.88, Math.PI / 2 + (i - 4) * 0.22, s * (0.45 + (i % 3) * 0.2), 3.2, t * 1.8 + i, '#06050a', 7, 0.8);
    ctx.save(); ctx.rotate(sway);
    // far sleeve + arm
    const sleeve = (sd, hx, hy) => {
      const sl = () => { ctx.beginPath(); ctx.moveTo(sd * s * 0.22, -s * 0.55); ctx.quadraticCurveTo(sd * s * 0.75, -s * 0.5, hx - sd * s * 0.1, hy - s * 0.1); ctx.lineTo(hx + sd * s * 0.12, hy + s * 0.12); ctx.quadraticCurveTo(sd * s * 0.55, -s * 0.15, sd * s * 0.2, -s * 0.2); ctx.closePath(); };
      solid(ctx, sl, '#120e18', s, 'rgba(160,110,220,0.14)');
      claws(ctx, hx, hy, sd > 0 ? -0.5 : Math.PI + 0.5, s * 0.36, 5, 1.5, '#2a2430', 1.3);
    };
    sleeve(-1, -s * 0.95, -s * 0.15 + Math.sin(t * 1.3) * s * 0.06);
    // robe: tall, narrow at the shoulders, wide tattered hem, vertical folds
    const robe = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.55);
      ctx.bezierCurveTo(-s * 0.45, -s * 0.1, -s * 0.7, s * 0.4, -s * 0.78, s * 0.92);
      for (let i = 0; i <= 10; i++) { const x = -s * 0.78 + i * s * 0.156; ctx.lineTo(x, s * (0.92 + (i % 2 ? 0.1 : -0.02) + Math.sin(t * 2 + i) * 0.03)); }
      ctx.bezierCurveTo(s * 0.7, s * 0.4, s * 0.45, -s * 0.1, s * 0.3, -s * 0.55); ctx.closePath();
    };
    solid(ctx, robe, '#16121c', s, 'rgba(170,120,230,0.18)');
    ctx.save(); robe(); ctx.clip();
    for (let i = 0; i < 7; i++) { const x = -s * 0.5 + i * s * 0.16; ctx.strokeStyle = i % 2 ? 'rgba(0,0,0,0.55)' : 'rgba(120,90,160,0.16)'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(x * 0.4, -s * 0.5); ctx.quadraticCurveTo(x * 0.9, s * 0.2, x * 1.3, s * 1.0); ctx.stroke(); }
    ctx.restore();
    // dull gold trim and a heavy pectoral
    ctx.strokeStyle = '#6a5a28'; ctx.lineWidth = s * 0.035;
    ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.5); ctx.bezierCurveTo(-s * 0.1, -s * 0.2, s * 0.1, -s * 0.2, s * 0.3, -s * 0.5); ctx.stroke();
    ctx.fillStyle = '#5a4a20'; ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.38); ctx.lineTo(s * 0.18, -s * 0.38); ctx.lineTo(0, -s * 0.12); ctx.closePath(); ctx.fill();
    eyes(ctx, [[0, -s * 0.28]], s * 0.045, '#ff1838', 6);
    sleeve(1, s * 1.0, -s * 0.3 + Math.sin(t * 1.3 + 1) * s * 0.06);
    // headdress: tall, dull, its stripes worn
    const nem = () => { ctx.beginPath(); ctx.moveTo(-s * 0.48, -s * 0.28); ctx.lineTo(-s * 0.36, -s * 1.02); ctx.quadraticCurveTo(0, -s * 1.3, s * 0.36, -s * 1.02); ctx.lineTo(s * 0.48, -s * 0.28); ctx.lineTo(s * 0.24, -s * 0.5); ctx.lineTo(-s * 0.24, -s * 0.5); ctx.closePath(); };
    solid(ctx, nem, '#6e5c26', s, 'rgba(255,230,150,0.25)');
    ctx.save(); nem(); ctx.clip(); ctx.strokeStyle = 'rgba(16,20,40,0.75)'; ctx.lineWidth = s * 0.06;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 0.3 - i * s * 0.15); ctx.quadraticCurveTo(0, -s * 0.2 - i * s * 0.15, s * 0.7, -s * 0.3 - i * s * 0.15); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#8a7430'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -s * 1.02); ctx.quadraticCurveTo(s * 0.1, -s * 1.28, -s * 0.02, -s * 1.38); ctx.stroke();
    // where the face should be: nothing at all
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, -s * 0.72, s * 0.2, s * 0.27, 0, 0, TAU); ctx.fill();
    eyes(ctx, [[-s * 0.07, -s * 0.76], [s * 0.07, -s * 0.76]], 1.1, '#ff1838', 8);
    ctx.restore();
  },
  // ---------------------------------------------------------- THE DROWNED GOD (a colossus rising from the water)
  cthulhu(ctx, s, t) {
    const breathe = Math.sin(t * 1.1) * s * 0.02, hide = '#1f3a2a';
    const rng = hashRng(9);
    // tattered wings raised high behind
    ctx.save(); ctx.translate(0, -s * 0.45);
    batWing(ctx, -1, s * 2.0, 0.4 + Math.sin(t * 0.9) * 0.25, '#08120c', 'rgba(70,130,95,0.32)', 'rgba(20,45,30,0.9)');
    batWing(ctx, 1, s * 2.0, 0.4 + Math.sin(t * 0.9) * 0.25, '#08120c', 'rgba(70,130,95,0.32)', 'rgba(20,45,30,0.9)');
    ctx.restore();
    ctx.save(); ctx.translate(0, breathe);
    // torso: hunched shoulders, tapering down into the water
    const trunk = () => { ctx.beginPath(); ctx.moveTo(-s * 0.38, s * 0.75); ctx.bezierCurveTo(-s * 0.5, s * 0.25, -s * 0.95, 0, -s * 0.85, -s * 0.38); ctx.bezierCurveTo(-s * 0.7, -s * 0.72, -s * 0.3, -s * 0.62, 0, -s * 0.5); ctx.bezierCurveTo(s * 0.3, -s * 0.62, s * 0.7, -s * 0.72, s * 0.85, -s * 0.38); ctx.bezierCurveTo(s * 0.95, 0, s * 0.5, s * 0.25, s * 0.38, s * 0.75); ctx.closePath(); };
    solid(ctx, trunk, hide, s, 'rgba(160,240,190,0.12)');
    ctx.save(); trunk(); ctx.clip();
    for (let i = 0; i < 70; i++) { const x = (rng() - 0.5) * s * 1.8, y = -s * 0.7 + rng() * s * 1.5, v = rng(); ctx.fillStyle = v < 0.18 ? '#7a7a62' : v < 0.6 ? 'rgba(0,0,0,0.28)' : 'rgba(150,210,170,0.1)'; ctx.beginPath(); ctx.ellipse(x, y, s * (0.015 + rng() * 0.04), s * (0.012 + rng() * 0.02), rng() * 3, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = s * 0.025;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s * (0.55 - i * 0.04), -s * 0.15 + i * s * 0.18); ctx.quadraticCurveTo(-s * 0.1, -s * 0.05 + i * s * 0.2 + rng() * s * 0.05, s * (0.5 - i * 0.05), -s * 0.18 + i * s * 0.17); ctx.stroke(); }
    ctx.restore();
    // the tentacle mass he rises from, coiling in front of the torso
    for (let i = 0; i < 8; i++) { const k = i / 7 - 0.5; tentacle(ctx, k * s * 0.7, s * 0.6, Math.PI / 2 + k * 2.6, s * (0.5 + Math.abs(k) * 0.55), s * 0.17, t * 1.3 + i * 1.1, i % 2 ? '#1c3626' : '#17301f', 8, 0.55); }
    // long arms, elbows out, talons reaching down
    for (const sd of [-1, 1]) {
      const hx = sd * s * 1.22, hy = s * 0.5 + Math.sin(t * 1.2 + sd) * s * 0.08;
      limb(ctx, sd * s * 0.74, -s * 0.42, hx, hy, -sd * s * 0.42, s * 0.32, s * 0.22, hide);
      claws(ctx, hx, hy, Math.PI / 2 - sd * 0.35, s * 0.5, 4, 1.1, '#9a9c86', 1.5);
    }
    // a beard of feelers hanging to the waist
    for (let i = 0; i < 13; i++) { const k = (i - 6) / 6; tentacle(ctx, k * s * 0.28, -s * 0.55, Math.PI / 2 + k * 0.22, s * (0.75 + (1 - Math.abs(k)) * 0.5), s * 0.075, t * 1.6 + i * 0.7, i % 2 ? '#2c5238' : '#244630', 10, 0.55); }
    // the head: a heavy, lopsided mantle bowed forward, sunk between the shoulders
    const head = () => { ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.52); ctx.bezierCurveTo(-s * 0.66, -s * 0.85, -s * 0.5, -s * 1.38, -s * 0.12, -s * 1.5); ctx.bezierCurveTo(s * 0.18, -s * 1.58, s * 0.6, -s * 1.3, s * 0.58, -s * 0.9); ctx.bezierCurveTo(s * 0.56, -s * 0.66, s * 0.48, -s * 0.55, s * 0.4, -s * 0.5); ctx.quadraticCurveTo(0, -s * 0.4, -s * 0.42, -s * 0.52); ctx.closePath(); };
    solid(ctx, head, '#294a35', s, 'rgba(170,240,200,0.2)');
    ctx.save(); head(); ctx.clip();
    for (let i = 0; i < 9; i++) { ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = s * (0.015 + rng() * 0.02); const y = -s * (0.85 + rng() * 0.6), x = -s * 0.45 + rng() * s * 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.18, y - s * 0.06 + rng() * s * 0.1, x + s * (0.25 + rng() * 0.25), y + (rng() - 0.5) * s * 0.12); ctx.stroke(); }
    for (let i = 0; i < 18; i++) { ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(170,230,190,0.1)'; ctx.beginPath(); ctx.ellipse(-s * 0.5 + rng() * s, -s * 1.45 + rng() * s * 0.9, s * 0.04, s * 0.025, rng() * 3, 0, TAU); ctx.fill(); }
    ctx.restore();
    // heavy brow, deep-set burning eyes, and lesser eyes scattered on the mantle
    ctx.fillStyle = '#081209';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * s * 0.17, -s * 0.68, s * 0.11, s * 0.045, sd * -0.4, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#13281a'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.33, -s * 0.76); ctx.quadraticCurveTo(-s * 0.15, -s * 0.84, 0, -s * 0.74); ctx.quadraticCurveTo(s * 0.15, -s * 0.84, s * 0.33, -s * 0.78); ctx.stroke();
    eyes(ctx, [[-s * 0.17, -s * 0.675], [s * 0.17, -s * 0.675]], s * 0.032, '#ff6a1a', 12);
    eyes(ctx, [[-s * 0.33, -s * 1.02], [s * 0.36, -s * 1.08], [-s * 0.05, -s * 1.3]], s * 0.014, '#ff6a1a', 5);
    ctx.restore();
  },
};

const ICHOR = { cultist: '#3a080b', ghoul: '#26261a', deepone: '#0c2a20', nightgaunt: '#09090f', migo: '#3a1a2c', byakhee: '#2a1d14',
  shambler: '#1d1228', hound: '#0e1a2c', shoggoth: '#08110c', proto: '#08110c', starspawn: '#0c2014', scorch: '#050505' };

function drawEnemyBody(ctx, type, s, t, e) { (EnemyArt[type] || EnemyArt.cultist)(ctx, s, t, e); }
