// ============================================================
//  ELDRITCH BASTION — procedural canvas rendering
// ============================================================
'use strict';

const TAU = Math.PI * 2;

function hashRng(n) { return mulberry32(n * 9301 + 49297); }

function tentacle(ctx, x, y, ang, len, w0, phase, color, segs = 8, amp = 0.5) {
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  let px = x, py = y, a = ang;
  const sl = len / segs;
  for (let i = 0; i < segs; i++) {
    a = ang + Math.sin(phase + i * 0.7) * amp * (i / segs + 0.3);
    const nx = px + Math.cos(a) * sl, ny = py + Math.sin(a) * sl;
    ctx.lineWidth = Math.max(0.8, w0 * (1 - i / segs));
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
    px = nx; py = ny;
  }
}

function glowEyes(ctx, pts, r, color) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.fillStyle = color;
  for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function wing(ctx, side, span, flap, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  const f = 0.55 + 0.45 * flap;
  ctx.quadraticCurveTo(side * span * 0.5, -span * 0.7 * f, side * span, -span * 0.25 * f);
  ctx.lineTo(side * span * 0.75, span * 0.05);
  ctx.lineTo(side * span * 0.55, -span * 0.08 * f);
  ctx.lineTo(side * span * 0.35, span * 0.12);
  ctx.lineTo(0, 4);
  ctx.closePath(); ctx.fill();
}

// ---------------- enemy art ----------------
const EnemyArt = {
  cultist(ctx, s, t) {
    ctx.fillStyle = '#5c1a1e';
    ctx.beginPath(); ctx.moveTo(-s * 0.85, s); ctx.lineTo(s * 0.85, s); ctx.lineTo(s * 0.4, -s * 0.3); ctx.lineTo(-s * 0.4, -s * 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a0e12'; ctx.beginPath(); ctx.arc(0, -s * 0.45, s * 0.58, 0, TAU); ctx.fill();
    ctx.fillStyle = '#120406'; ctx.beginPath(); ctx.arc(0, -s * 0.35, s * 0.35, 0, TAU); ctx.fill();
    glowEyes(ctx, [[-2.2, -s * 0.38], [2.2, -s * 0.38]], 1.2, '#ffcc44');
    // candle
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(s * 0.55, -s * 0.1, 2, 5);
    ctx.fillStyle = `rgba(255,${180 + Math.sin(t * 20) * 40},60,0.9)`; ctx.beginPath(); ctx.arc(s * 0.55 + 1, -s * 0.2, 1.6, 0, TAU); ctx.fill();
  },
  ghoul(ctx, s, t) {
    ctx.strokeStyle = '#6d7158'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    const sw = Math.sin(t * 14) * 3;
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(s * 0.9, s * 0.6 + sw); ctx.moveTo(-2, 0); ctx.lineTo(s * 0.7, s * 0.9 - sw); ctx.stroke();
    ctx.fillStyle = '#8a8f6a'; ctx.beginPath(); ctx.ellipse(-2, 1, s * 0.8, s * 0.55, -0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9da279'; ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.35, s * 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a2a1a'; ctx.fillRect(s * 0.55, -s * 0.2, s * 0.4, 1.5);
    glowEyes(ctx, [[s * 0.65, -s * 0.48]], 1.2, '#e8ff90');
  },
  deepone(ctx, s, t) {
    ctx.fillStyle = '#1f4f45';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 3 - 2, -s * 0.5); ctx.lineTo(i * 3, -s * 1.05 - Math.abs(i) * -1.5); ctx.lineTo(i * 3 + 2, -s * 0.5); ctx.fill(); }
    const g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, '#3d8a78'); g.addColorStop(1, '#1d4a40');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.75, s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(160,220,200,0.25)'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, s * 0.2 + i * 3, s * 0.5, 0.3, Math.PI - 0.3); ctx.stroke(); }
    ctx.fillStyle = '#e8f0d8'; ctx.beginPath(); ctx.arc(-s * 0.32, -s * 0.4, s * 0.24, 0, TAU); ctx.arc(s * 0.32, -s * 0.4, s * 0.24, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-s * 0.32, -s * 0.38, s * 0.11, 0, TAU); ctx.arc(s * 0.32, -s * 0.38, s * 0.11, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#0c2520'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.35, 0.2, Math.PI - 0.2); ctx.stroke();
  },
  nightgaunt(ctx, s, t) {
    const flap = Math.sin(t * 10);
    wing(ctx, -1, s * 1.6, flap, '#121219'); wing(ctx, 1, s * 1.6, flap, '#121219');
    ctx.fillStyle = '#1e1e2a'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.35, s * 0.9, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1e1e2a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-3, -s * 0.8); ctx.quadraticCurveTo(-6, -s * 1.3, -2, -s * 1.5); ctx.moveTo(3, -s * 0.8); ctx.quadraticCurveTo(6, -s * 1.3, 2, -s * 1.5); ctx.stroke();
    tentacle(ctx, 0, s * 0.8, Math.PI / 2, s * 1.2, 2, t * 6, '#1e1e2a', 6, 0.8);
  },
  migo(ctx, s, t) {
    ctx.fillStyle = 'rgba(220,170,190,0.35)';
    const f = Math.sin(t * 18);
    ctx.beginPath(); ctx.ellipse(-s * 0.7, -s * 0.3, s * 0.8, s * 0.35 + f * 2, -0.5, 0, TAU); ctx.ellipse(s * 0.7, -s * 0.3, s * 0.8, s * 0.35 + f * 2, 0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a4a5e'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) { const y = s * (0.1 + i * 0.3); ctx.beginPath(); ctx.moveTo(-s * 0.4, y); ctx.lineTo(-s, y + 4 + Math.sin(t * 12 + i) * 2); ctx.moveTo(s * 0.4, y); ctx.lineTo(s, y + 4 + Math.cos(t * 12 + i) * 2); ctx.stroke(); }
    ctx.fillStyle = '#b5657d'; ctx.beginPath(); ctx.ellipse(0, s * 0.3, s * 0.5, s * 0.75, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#7d3a50'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.45, s * (0.1 + i * 0.3)); ctx.lineTo(s * 0.45, s * (0.1 + i * 0.3)); ctx.stroke(); }
    const hue = (t * 120) % 360;
    ctx.fillStyle = `hsl(${hue},60%,60%)`; ctx.beginPath(); ctx.ellipse(0, -s * 0.55, s * 0.45, s * 0.38, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `hsl(${(hue + 120) % 360},60%,55%)`; ctx.beginPath(); ctx.arc(-2, -s * 0.6, s * 0.18, 0, TAU); ctx.arc(3, -s * 0.5, s * 0.15, 0, TAU); ctx.fill();
  },
  byakhee(ctx, s, t) {
    const flap = Math.sin(t * 12);
    wing(ctx, -1, s * 1.7, flap, '#4a3a2c'); wing(ctx, 1, s * 1.7, flap, '#4a3a2c');
    ctx.fillStyle = '#5b4a3a'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.4, s * 0.85, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2c20'; ctx.beginPath(); ctx.arc(0, -s * 0.8, s * 0.32, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c0a060'; ctx.beginPath(); ctx.moveTo(-2, -s * 1.0); ctx.lineTo(0, -s * 1.5); ctx.lineTo(2, -s * 1.0); ctx.fill();
    glowEyes(ctx, [[-2, -s * 0.85], [2, -s * 0.85]], 1, '#ffd050');
  },
  shambler(ctx, s, t) {
    ctx.fillStyle = '#3a2a4a';
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + t; ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.35, Math.sin(a) * s * 0.35, s * 0.55, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#2a1e36'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    const sw = Math.sin(t * 5) * 0.3;
    ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.quadraticCurveTo(-s * 1.4, s * 0.2, -s * 1.1, s * (1 + sw)); ctx.moveTo(s * 0.5, 0); ctx.quadraticCurveTo(s * 1.4, s * 0.2, s * 1.1, s * (1 - sw)); ctx.stroke();
    ctx.strokeStyle = '#d8d0e8'; ctx.lineWidth = 1;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * s * 1.1, s * 1); ctx.lineTo(sx * s * 1.3, s * 1.25); ctx.moveTo(sx * s * 1.1, s * 1); ctx.lineTo(sx * s * 0.95, s * 1.3); ctx.stroke(); }
    glowEyes(ctx, [[-3, -s * 0.2], [3, -s * 0.2], [0, -s * 0.5]], 1.3, '#d080ff');
  },
  hound(ctx, s, t) {
    ctx.fillStyle = 'rgba(80,120,170,0.18)';
    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(-i * 5, Math.sin(t * 6 + i) * 2, s * (0.6 - i * 0.1), 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#3d5a7a';
    ctx.beginPath(); ctx.moveTo(s * 1.1, -s * 0.1); ctx.lineTo(s * 0.4, -s * 0.7); ctx.lineTo(-s * 0.3, -s * 0.5); ctx.lineTo(-s * 1.0, -s * 0.8); ctx.lineTo(-s * 0.7, 0); ctx.lineTo(-s * 1.0, s * 0.7); ctx.lineTo(-s * 0.2, s * 0.5); ctx.lineTo(s * 0.5, s * 0.6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#9ac0e8'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#c8e8ff'; ctx.beginPath(); ctx.moveTo(s * 1.1, -s * 0.1); ctx.lineTo(s * 0.7, s * 0.1); ctx.lineTo(s * 0.8, -s * 0.25); ctx.fill();
    glowEyes(ctx, [[s * 0.55, -s * 0.3]], 1.4, '#6ad0ff');
  },
  shoggoth(ctx, s, t, e) {
    const g = ctx.createRadialGradient(-s * 0.3, -s * 0.3, 2, 0, 0, s * 1.2);
    g.addColorStop(0, '#2e3a36'); g.addColorStop(0.6, '#121814'); g.addColorStop(1, '#0a0d0c');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = i / 24 * TAU;
      const r = s * (1 + 0.12 * Math.sin(a * 3 + t * 3) + 0.08 * Math.sin(a * 5 - t * 4));
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.85;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,200,160,0.25)'; ctx.lineWidth = 1.2; ctx.stroke();
    const rng = hashRng(e ? e.id : 3);
    const n = Math.max(4, Math.round(s / 2));
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, d = rng() * s * 0.75, er = 1 + rng() * s * 0.12;
      const open = Math.sin(t * 2 + i * 1.7) > -0.6;
      if (!open) continue;
      const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.85;
      ctx.fillStyle = '#d8f0c8'; ctx.beginPath(); ctx.arc(x, y, er, 0, TAU); ctx.fill();
      ctx.fillStyle = rng() < 0.5 ? '#2a8a3a' : '#000'; ctx.beginPath(); ctx.arc(x, y, er * 0.5, 0, TAU); ctx.fill();
    }
  },
  proto(ctx, s, t, e) { EnemyArt.shoggoth(ctx, s, t, e); },
  starspawn(ctx, s, t) {
    const flap = Math.sin(t * 2);
    wing(ctx, -1, s * 1.5, flap, '#1d3a2a'); wing(ctx, 1, s * 1.5, flap, '#1d3a2a');
    for (let i = 0; i < 6; i++) tentacle(ctx, (i - 2.5) * s * 0.15, s * 0.3, Math.PI / 2 + (i - 2.5) * 0.15, s * 1.0, 3, t * 3 + i, '#3a6a4a', 7, 0.6);
    const g = ctx.createRadialGradient(-s * 0.2, -s * 0.4, 2, 0, -s * 0.2, s);
    g.addColorStop(0, '#5a9a6a'); g.addColorStop(1, '#22442e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -s * 0.2, s * 0.7, s * 0.8, 0, 0, TAU); ctx.fill();
    glowEyes(ctx, [[-s * 0.25, -s * 0.15], [s * 0.25, -s * 0.15]], 2.2, '#ff4030');
  },
  dagon(ctx, s, t) {
    for (let i = 0; i < 4; i++) tentacle(ctx, (i - 1.5) * s * 0.3, s * 0.6, Math.PI / 2, s * 0.7, 4, t * 3 + i, '#1f4f45', 6, 0.5);
    EnemyArt.deepone(ctx, s, t);
    ctx.fillStyle = '#d4af37';
    ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.85);
    for (let i = 0; i <= 4; i++) { ctx.lineTo(-s * 0.5 + i * s * 0.25, -s * (i % 2 ? 1.0 : 1.35)); }
    ctx.lineTo(s * 0.5, -s * 0.85); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#40e0c0'; ctx.beginPath(); ctx.arc(0, -s * 1.05, 2.5, 0, TAU); ctx.fill();
  },
  haunter(ctx, s, t) {
    const flap = Math.sin(t * 4);
    wing(ctx, -1, s * 1.8, flap, '#07070c'); wing(ctx, 1, s * 1.8, flap, '#07070c');
    ctx.fillStyle = '#0d0d14'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.9, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.shadowColor = '#ff3020'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff5030';
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * 4, -s * 0.2 + Math.sin(a) * 4, 3.2, 0, TAU); ctx.fill(); }
    ctx.restore();
  },
  dunwich(ctx, s, t) {
    for (let i = 0; i < 10; i++) tentacle(ctx, 0, 0, i / 10 * TAU + Math.sin(t) * 0.2, s * 1.3, 4, t * 2 + i, 'rgba(110,100,120,0.85)', 8, 0.7);
    ctx.fillStyle = 'rgba(90,80,100,0.9)'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s * 0.7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c8b8a0'; ctx.beginPath(); ctx.arc(0, -s * 0.6, s * 0.25, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.fillRect(-3, -s * 0.65, 2, 2); ctx.fillRect(1, -s * 0.65, 2, 2);
    glowEyes(ctx, [[-s * 0.3, 0], [s * 0.3, 0.1 * s], [0, s * 0.25]], 2, '#c0ff60');
  },
  nyarlathotep(ctx, s, t) {
    ctx.fillStyle = 'rgba(40,0,60,0.35)'; ctx.beginPath(); ctx.arc(0, 0, s * 1.3 + Math.sin(t * 3) * 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0c0a10';
    ctx.beginPath(); ctx.moveTo(-s * 0.9, s * 1.1); ctx.lineTo(s * 0.9, s * 1.1); ctx.lineTo(s * 0.35, -s * 0.3); ctx.lineTo(-s * 0.35, -s * 0.3); ctx.closePath(); ctx.fill();
    // nemes headdress
    ctx.fillStyle = '#d4af37';
    ctx.beginPath(); ctx.moveTo(-s * 0.7, s * 0.2); ctx.lineTo(-s * 0.45, -s * 1.0); ctx.lineTo(s * 0.45, -s * 1.0); ctx.lineTo(s * 0.7, s * 0.2); ctx.lineTo(s * 0.35, -s * 0.2); ctx.lineTo(-s * 0.35, -s * 0.2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1a3a8a'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.6 + i * 0.03 * s, -s * 0.1 - i * s * 0.22); ctx.lineTo(s * 0.6 - i * 0.03 * s, -s * 0.1 - i * s * 0.22); ctx.stroke(); }
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, -s * 0.5, s * 0.3, s * 0.38, 0, 0, TAU); ctx.fill();
    glowEyes(ctx, [[-s * 0.12, -s * 0.55], [s * 0.12, -s * 0.55]], 1.8, '#ff2040');
  },
  cthulhu(ctx, s, t) {
    const flap = Math.sin(t * 1.5);
    wing(ctx, -1, s * 1.9, flap, '#14281c'); wing(ctx, 1, s * 1.9, flap, '#14281c');
    ctx.fillStyle = '#1e3a28'; ctx.beginPath(); ctx.ellipse(0, s * 0.4, s * 0.9, s * 0.8, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 9; i++) tentacle(ctx, (i - 4) * s * 0.1, s * 0.05, Math.PI / 2 + (i - 4) * 0.12, s * 1.3, 5, t * 2 + i * 0.8, '#3c7050', 9, 0.7);
    const g = ctx.createRadialGradient(-s * 0.2, -s * 0.6, 3, 0, -s * 0.35, s * 0.9);
    g.addColorStop(0, '#6aa47a'); g.addColorStop(1, '#244a32');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -s * 0.35, s * 0.62, s * 0.75, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,40,28,0.6)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, -s * 0.9 + i * 5, s * 0.3, 0.4, Math.PI - 0.4); ctx.stroke(); }
    glowEyes(ctx, [[-s * 0.25, -s * 0.25], [s * 0.25, -s * 0.25]], 3, '#ffd020');
  },
};

function drawEnemyBody(ctx, type, s, t, e) {
  (EnemyArt[type] || EnemyArt.cultist)(ctx, s, t, e);
}

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
  const sc = canvas.width / Math.max(30, def.size * 3.4);
  ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2 + 2 * sc); ctx.scale(sc, sc);
  drawEnemyBody(ctx, type, def.size, time, { id: 7 });
  ctx.restore();
}

// ---------------- Renderer ----------------
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
    this.rain = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 300 + Math.random() * 200 }));
    this.fog = Array.from({ length: 7 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, r: 120 + Math.random() * 140, vx: 6 + Math.random() * 10 }));
  }

  prerender(game) {
    const bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const ctx = bg.getContext('2d');
    const th = game.map.theme;
    const rng = mulberry32(game.map.seed * 31);
    ctx.fillStyle = th.ground; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rng() < 0.5 ? th.ground2 : 'rgba(0,0,0,0.18)';
      const x = rng() * W, y = rng() * H, r = 2 + rng() * 10;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, rng() * 3, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(90,110,70,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 400; i++) { const x = rng() * W, y = rng() * H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 4, y - 3 - rng() * 3); ctx.stroke(); }

    const G = game.grid;
    const isP = (c, r) => r < 0 || r >= ROWS || c < 0 || c >= COLS ? false : G[r][c] === 1;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = c * TILE, y = r * TILE;
      if (G[r][c] === 2) {
        ctx.fillStyle = th.water; ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(120,180,170,0.12)';
        for (let k = 0; k < 2; k++) { const yy = y + 10 + rng() * 22; ctx.beginPath(); ctx.moveTo(x + 4, yy); ctx.quadraticCurveTo(x + 20, yy - 3, x + 36, yy); ctx.stroke(); }
      } else if (G[r][c] === 1) {
        ctx.fillStyle = th.path; ctx.fillRect(x, y, TILE, TILE);
        for (let k = 0; k < 7; k++) {
          ctx.fillStyle = `rgba(${rng() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + rng() * 0.06})`;
          roundRect(ctx, x + rng() * 30, y + rng() * 30, 6 + rng() * 8, 5 + rng() * 6, 2); ctx.fill();
        }
      }
    }
    // path edges
    ctx.strokeStyle = th.edge; ctx.lineWidth = 3;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (G[r][c] === 1) {
      const x = c * TILE, y = r * TILE;
      ctx.beginPath();
      if (!isP(c, r - 1) && r > 0) { ctx.moveTo(x, y + 1); ctx.lineTo(x + TILE, y + 1); }
      if (!isP(c, r + 1) && r < ROWS - 1) { ctx.moveTo(x, y + TILE - 1); ctx.lineTo(x + TILE, y + TILE - 1); }
      if (!isP(c - 1, r) && c > 0) { ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + TILE); }
      if (!isP(c + 1, r) && c < COLS - 1) { ctx.moveTo(x + TILE - 1, y); ctx.lineTo(x + TILE - 1, y + TILE); }
      ctx.stroke();
    }
    // decor
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (G[r][c] === 3) this.drawDecor(ctx, th.deco, c * TILE + TILE / 2, r * TILE + TILE / 2, rng);
    // city gate at exit
    const end = game.map.paths[0][game.map.paths[0].length - 1];
    this.drawCity(ctx, end);
    this.bg = bg;
  }

  drawDecor(ctx, deco, x, y, rng) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(2, 12, 14, 5, 0, 0, TAU); ctx.fill();
    const v = rng();
    if (deco === 'dock') {
      if (v < 0.5) { ctx.fillStyle = '#5a4630'; ctx.fillRect(-10, -8, 20, 18); ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.strokeRect(-10, -8, 20, 18); ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(10, 10); ctx.stroke(); }
      else { ctx.fillStyle = '#4a3a28'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 12, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(9, -4); ctx.moveTo(-9, 4); ctx.lineTo(9, 4); ctx.stroke(); }
    } else if (deco === 'campus') {
      if (v < 0.6) this.tree(ctx, '#2a3a24', '#3a2a1a');
      else { ctx.fillStyle = '#6a6458'; ctx.fillRect(-6, -14, 12, 24); ctx.fillStyle = '#8a8478'; ctx.fillRect(-9, 6, 18, 5); ctx.beginPath(); ctx.arc(0, -16, 6, 0, TAU); ctx.fill(); }
    } else if (deco === 'hills') {
      if (v < 0.55) { ctx.fillStyle = '#5a5a58'; ctx.beginPath(); ctx.moveTo(-7, 10); ctx.lineTo(-5, -16); ctx.lineTo(5, -18); ctx.lineTo(7, 10); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(120,200,120,0.15)'; ctx.fillRect(-3, -6, 6, 2); }
      else this.tree(ctx, null, '#2a2018');
    } else if (deco === 'city') {
      ctx.fillStyle = '#3a3038'; ctx.fillRect(-12, -6, 24, 18);
      ctx.fillStyle = '#2a2228'; ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(-8, -16); ctx.lineTo(8, -16); ctx.lineTo(14, -6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = v < 0.5 ? '#e8c060' : '#1a1418'; ctx.fillRect(-7, -1, 5, 6); ctx.fillStyle = v < 0.3 ? '#e8c060' : '#1a1418'; ctx.fillRect(3, -1, 5, 6);
    } else if (deco === 'ruins') {
      ctx.fillStyle = '#3a4a42'; ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(-8, -12); ctx.lineTo(4, -17); ctx.lineTo(10, 10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(100,255,170,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -2, 4, 0, TAU); ctx.moveTo(-4, 4); ctx.lineTo(4, -8); ctx.stroke();
    }
    ctx.restore();
  }
  tree(ctx, leaf, trunk) {
    ctx.strokeStyle = trunk; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -6); ctx.moveTo(0, -2); ctx.lineTo(-8, -12); ctx.moveTo(0, -4); ctx.lineTo(7, -14); ctx.moveTo(-4, -7); ctx.lineTo(-10, -6); ctx.stroke();
    if (leaf) { ctx.fillStyle = leaf; ctx.beginPath(); ctx.arc(-6, -12, 7, 0, TAU); ctx.arc(5, -14, 8, 0, TAU); ctx.arc(0, -8, 7, 0, TAU); ctx.fill(); }
  }
  drawCity(ctx, end) {
    // exit is off the right/left/top/bottom; draw a gate at the edge tile
    const cx = clamp(end[0], 0, COLS - 1) * TILE + TILE / 2, cy = clamp(end[1], 0, ROWS - 1) * TILE + TILE / 2;
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#4a4440';
    ctx.fillRect(-18, -26, 8, 40); ctx.fillRect(10, -26, 8, 40);
    ctx.fillStyle = '#5a5450'; ctx.fillRect(-20, -30, 12, 6); ctx.fillRect(8, -30, 12, 6);
    ctx.fillStyle = '#ffcc66'; ctx.save(); ctx.shadowColor = '#ffcc66'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(-14, -33, 2.5, 0, TAU); ctx.arc(14, -33, 2.5, 0, TAU); ctx.fill(); ctx.restore();
    ctx.restore();
  }

  // ---------------- frame ----------------
  draw(game, ui, dt) {
    this.time += dt;
    const ctx = this.ctx, t = this.time;
    ctx.save();
    if (game.shake > 0) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    ctx.drawImage(this.bg, 0, 0);

    // water shimmer
    ctx.strokeStyle = 'rgba(140,200,190,0.10)'; ctx.lineWidth = 1;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (game.grid[r][c] === 2) {
      const x = c * TILE, y = r * TILE + 20 + Math.sin(t * 1.5 + c * 0.7 + r) * 8;
      ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + 30, y); ctx.stroke();
    }

    // portals
    for (const p of game.map.paths) {
      const s = p[0];
      const x = clamp(s[0], 0, COLS - 1) * TILE + TILE / 2, y = clamp(s[1], 0, ROWS - 1) * TILE + TILE / 2;
      ctx.save(); ctx.translate(x, y);
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
      g.addColorStop(0, 'rgba(160,255,120,0.55)'); g.addColorStop(1, 'rgba(40,120,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(160,255,140,0.6)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 8 + i * 5, t * (1 + i * 0.5) + i, t * (1 + i * 0.5) + i + 3.5); ctx.stroke(); }
      ctx.restore();
    }

    // placement / hover grid
    if (ui.placing && ui.hover) {
      const { c, r } = ui.hover;
      const ok = game.canPlace(c, r) && game.gold >= TOWERS[ui.placing].cost;
      ctx.fillStyle = ok ? 'rgba(120,255,160,0.18)' : 'rgba(255,80,80,0.22)';
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      const fake = { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, type: ui.placing, def: TOWERS[ui.placing], level: 0, angle: -Math.PI / 2, anim: t };
      const st = game.computeStats(fake, 0);
      if (st.range) this.rangeCircle(ctx, fake.x, fake.y, st.range * TILE, ok);
      drawTower(ctx, fake, t, 0.6);
    }

    // towers (sorted by y for overlap)
    const sel = ui.selected;
    if (sel && sel.stats.range) this.rangeCircle(ctx, sel.x, sel.y, sel.stats.range * TILE, true);
    for (const tw of game.towers) {
      if (tw.def.kind === 'aura') {
        const rr = tw.stats.range * TILE;
        ctx.strokeStyle = `rgba(120,255,180,${0.08 + 0.05 * Math.sin(t * 2 + tw.id)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tw.x, tw.y, rr * (0.6 + 0.4 * ((t * 0.5 + tw.id * 0.3) % 1)), 0, TAU); ctx.stroke();
      }
    }
    for (const tw of game.towers) drawTower(ctx, tw, t);
    if (sel) { ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; roundRect(ctx, sel.x - 18, sel.y - 18, 36, 36, 7); ctx.stroke(); }

    // enemies: ground first, then flyers
    const ens = game.enemies.slice().sort((a, b) => (a.def.flying ? 1 : 0) - (b.def.flying ? 1 : 0) || a.y - b.y);
    for (const e of ens) this.drawEnemy(ctx, e, t);

    // beams
    for (const tw of game.towers) if (tw.def.kind === 'beam' && tw.beamTarget && tw.beamTarget.alive && tw.beamTime > 0) {
      const e = tw.beamTarget;
      const ramp = Math.min(1, tw.beamTime / 3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,240,150,${0.35 + ramp * 0.3})`; ctx.lineWidth = 6 + ramp * 6 + Math.sin(t * 30) * 1.5;
      ctx.beginPath(); ctx.moveTo(tw.x, tw.y - 13); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,230,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tw.x, tw.y - 13); ctx.lineTo(e.x, e.y); ctx.stroke();
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 14 + ramp * 8);
      g.addColorStop(0, 'rgba(255,230,140,0.8)'); g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, 14 + ramp * 8, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // projectiles
    for (const p of game.projectiles) {
      if (p.kind === 'shell') {
        const k = p.t / p.dur;
        const x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k;
        const h = Math.sin(Math.PI * k) * 70;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y, 5, 2.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#a03020'; ctx.fillRect(x - 3, y - h - 4, 6, 8);
        ctx.fillStyle = `rgba(255,${150 + Math.random() * 100},50,1)`; ctx.beginPath(); ctx.arc(x + 2, y - h - 6, 2, 0, TAU); ctx.fill();
      } else if (p.kind === 'bolt') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        p.trail.forEach((q, i) => { ctx.fillStyle = `rgba(170,100,255,${i / p.trail.length * 0.4})`; ctx.beginPath(); ctx.arc(q.x, q.y, 2 + i * 0.4, 0, TAU); ctx.fill(); });
        ctx.shadowColor = '#c58cff'; ctx.shadowBlur = 12; ctx.fillStyle = '#e8d0ff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }

    this.drawEffects(ctx, game, t);

    // floaters
    ctx.textAlign = 'center'; ctx.font = 'bold 12px Georgia, serif';
    for (const f of game.floaters) {
      ctx.globalAlpha = 1 - f.t / f.life;
      ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // spell targeting
    if (ui.spellTarget && ui.mouse) {
      const r = SPELLS[ui.spellTarget].radius * TILE;
      ctx.strokeStyle = 'rgba(255,140,60,0.9)'; ctx.fillStyle = 'rgba(255,100,40,0.15)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ui.mouse.x, ui.mouse.y, r, 0, TAU); ctx.fill(); ctx.stroke();
    }

    this.drawAtmosphere(ctx, game, t, dt);
    ctx.restore();

    if (game.bossAlive && game.bossAlive.alive) this.drawBossBar(ctx, game.bossAlive);
    if (game.flash > 0) { ctx.fillStyle = `rgba(200,255,220,${game.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
  }

  rangeCircle(ctx, x, y, r, ok) {
    ctx.fillStyle = ok ? 'rgba(200,230,255,0.07)' : 'rgba(255,80,80,0.07)';
    ctx.strokeStyle = ok ? 'rgba(200,230,255,0.45)' : 'rgba(255,80,80,0.5)';
    ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
  }

  drawEnemy(ctx, e, t) {
    const d = e.def, s = d.size;
    ctx.save();
    ctx.translate(e.x, e.y + (d.flying ? -8 : Math.sin(e.bob * 6) * 1));
    let alpha = 1;
    if (e.phased) alpha = e.revealed ? 0.55 : 0.18;
    ctx.globalAlpha = alpha;
    // shadow
    if (d.flying) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 14, s * 0.8, s * 0.3, 0, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, s * 0.85, s * 0.9, s * 0.3, 0, 0, TAU); ctx.fill(); }
    if (d.aura) {
      ctx.fillStyle = `rgba(120,40,160,${0.07 + 0.04 * Math.sin(t * 3)})`;
      ctx.beginPath(); ctx.arc(0, 0, d.aura * TILE, 0, TAU); ctx.fill();
    }
    if (e.slow < 1) { ctx.strokeStyle = 'rgba(120,255,180,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, s * 0.8, s, s * 0.35, 0, 0, TAU); ctx.stroke(); }
    ctx.save();
    const rotating = d.flying;
    if (rotating) ctx.rotate(e.angle + Math.PI / 2);
    else if (Math.cos(e.angle) < -0.1) ctx.scale(-1, 1);
    drawEnemyBody(ctx, e.type, s, e.bob, e);
    if (e.hitFlash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (e.revealed && e.phased) { ctx.strokeStyle = 'rgba(200,140,255,0.8)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(0, 0, s + 4, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (e.stun > 0) {
      ctx.fillStyle = '#ffe08a';
      for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.8, -s - 4 + Math.sin(a) * 3, 1.8, 0, TAU); ctx.fill(); }
    }
    if (e.burn > 0) {
      for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(255,${100 + Math.random() * 120},30,0.8)`; ctx.beginPath(); ctx.arc((Math.random() - 0.5) * s * 1.5, (Math.random() - 0.5) * s, 2, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = Math.max(alpha, 0.35);
    if (!d.boss && e.hp < e.maxHp) {
      const bw = Math.max(18, s * 2), y = -s - 9;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw / 2 - 1, y - 1, bw + 2, 5);
      const k = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = k > 0.5 ? '#7ad070' : k > 0.25 ? '#e0c050' : '#e05040';
      ctx.fillRect(-bw / 2, y, bw * k, 3);
    }
    ctx.restore();
  }

  drawEffects(ctx, game, t) {
    for (const f of game.effects) {
      const k = f.t / f.life;
      ctx.save();
      switch (f.kind) {
        case 'ring':
          ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r + (f.max - f.r) * k, 0, TAU); ctx.stroke(); break;
        case 'tracer':
          ctx.strokeStyle = f.crit ? 'rgba(255,255,255,0.95)' : 'rgba(255,230,160,0.85)'; ctx.lineWidth = f.crit ? 2.5 : 1.5; ctx.globalAlpha = 1 - k;
          ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
          ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, TAU); ctx.fill(); break;
        case 'boom': {
          ctx.globalCompositeOperation = 'lighter';
          const r = f.r * (0.5 + k * 0.6);
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
          g.addColorStop(0, `rgba(255,220,120,${1 - k})`); g.addColorStop(0.5, `rgba(255,120,40,${0.7 * (1 - k)})`); g.addColorStop(1, 'rgba(120,30,0,0)');
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
        case 'death': {
          ctx.globalAlpha = (1 - k) * 0.8;
          ctx.fillStyle = f.big ? '#80ff90' : '#4a7a3a';
          const n = f.big ? 16 : 7;
          for (let i = 0; i < n; i++) { const a = i / n * TAU + f.x; const d = k * f.r * (f.big ? 4 : 1.8); ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, (f.big ? 4 : 2.5) * (1 - k * 0.5), 0, TAU); ctx.fill(); }
          ctx.fillStyle = 'rgba(30,50,25,0.5)'; ctx.beginPath(); ctx.ellipse(f.x, f.y + 4, f.r * (0.6 + k * 0.5), f.r * 0.3, 0, 0, TAU); ctx.fill();
          break;
        }
        case 'blink':
          ctx.strokeStyle = `rgba(110,200,255,${1 - k})`; ctx.lineWidth = 2;
          ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(a) * 18 * k, f.y + Math.sin(a) * 18 * k); } ctx.stroke(); break;
        case 'summon':
          ctx.strokeStyle = `rgba(150,255,120,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * 26, 0, TAU); ctx.stroke(); break;
        case 'elder': {
          ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#a0ffc8'; ctx.lineWidth = 4; ctx.shadowColor = '#60ffa0'; ctx.shadowBlur = 20;
          const R = 60 + k * 500;
          ctx.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 2 * TAU / 5 + k; const x = f.x + Math.cos(a) * R, y = f.y + Math.sin(a) * R; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
          break;
        }
        case 'fire': {
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 18; i++) {
            const a = Math.random() * TAU, d = Math.random() * f.r;
            const g = ctx.createRadialGradient(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 0, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 18);
            g.addColorStop(0, `rgba(255,${120 + Math.random() * 100},40,${0.6 * (1 - k)})`); g.addColorStop(1, 'rgba(255,60,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 18, 0, TAU); ctx.fill();
          }
          ctx.strokeStyle = `rgba(255,160,60,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + k * 0.6), 0, TAU); ctx.stroke();
          break;
        }
        case 'powder':
          ctx.fillStyle = `rgba(255,220,140,${0.5 * (1 - k)})`;
          for (let i = 0; i < 120; i++) { ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
          break;
      }
      ctx.restore();
    }
  }

  drawAtmosphere(ctx, game, t, dt) {
    // fog
    ctx.save();
    for (const f of this.fog) {
      f.x += f.vx * dt; if (f.x - f.r > W) f.x = -f.r;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, 'rgba(170,200,190,0.07)'); g.addColorStop(1, 'rgba(170,200,190,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
    if (game.map.theme.rain) {
      ctx.strokeStyle = 'rgba(170,200,220,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const r of this.rain) {
        r.y += r.s * dt; r.x -= r.s * 0.2 * dt;
        if (r.y > H) { r.y = -10; r.x = Math.random() * (W + 100); }
        ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 3, r.y + 12);
      }
      ctx.stroke();
    }
    if (game.powderTime > 0) { ctx.fillStyle = `rgba(255,220,140,${0.04 + 0.02 * Math.sin(t * 4)})`; ctx.fillRect(0, 0, W, H); }
    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,10,5,${0.55 + (1 - game.sanity / game.maxSanity) * 0.3})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // madness tint when sanity low
    const ins = 1 - game.sanity / game.maxSanity;
    if (ins > 0.5) { ctx.fillStyle = `rgba(80,0,60,${(ins - 0.5) * 0.25 * (0.7 + 0.3 * Math.sin(t * 2))})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  drawBossBar(ctx, e) {
    const bw = 420, x = (W - bw) / 2, y = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; roundRect(ctx, x - 8, y - 4, bw + 16, 30, 6); ctx.fill();
    ctx.fillStyle = '#2a0a12'; ctx.fillRect(x, y + 12, bw, 9);
    const k = Math.max(0, e.hp / e.maxHp);
    const g = ctx.createLinearGradient(x, 0, x + bw, 0); g.addColorStop(0, '#6a1030'); g.addColorStop(1, '#c03050');
    ctx.fillStyle = g; ctx.fillRect(x, y + 12, bw * k, 9);
    ctx.fillStyle = '#e8d8c0'; ctx.font = 'bold 11px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText(e.def.name.toUpperCase() + (e.phased && !e.revealed ? '  (phased)' : ''), W / 2, y + 8);
  }
}
