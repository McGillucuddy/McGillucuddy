// ============================================================
//  ELDRITCH DESCENT — hero, NPC and prop source art (faces +x)
//  Same vector toolkit as the monsters; baked to pixels by pixel.js
// ============================================================
'use strict';

function legs(ctx, s, t, col, boot, spread = 0.18, len = 0.95) {
  const w = Math.sin(t * 9);
  for (const [ph, c] of [[Math.PI, shade(col, -0.35)], [0, col]]) {
    const k = Math.sin(t * 9 + ph);
    const fx = k * s * 0.32, lift = Math.max(0, -Math.cos(t * 9 + ph)) * s * 0.14;
    limb(ctx, (ph ? -1 : 1) * s * spread * 0.4, s * 0.15, fx, s * len - lift, s * 0.12 * (ph ? 1 : -1), s * 0.28, s * 0.22, c);
    ctx.fillStyle = boot; ctx.beginPath(); ctx.ellipse(fx + s * 0.1, s * len - lift, s * 0.2, s * 0.1, 0, 0, TAU); ctx.fill();
  }
  return w;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

const HeroArt = {
  // -------- WARDEN: dockside bruiser in a doughboy helmet, church-door shield, nailed club
  warden(ctx, s, t, o = {}) {
    const bob = Math.abs(Math.sin(t * 9)) * s * 0.05;
    ctx.save(); ctx.translate(0, -bob);
    legs(ctx, s, t, '#3a3e34', '#141210', 0.3);
    // club raised behind
    const sw = o.swing || 0;
    ctx.save(); ctx.translate(-s * 0.35, -s * 0.55); ctx.rotate(-1.1 + sw * 2.2);
    ctx.fillStyle = '#5a3a20'; ctx.strokeStyle = '#140c06'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-s * 0.06, 0); ctx.lineTo(s * 0.06, 0); ctx.lineTo(s * 0.12, -s * 0.95); ctx.lineTo(-s * 0.12, -s * 0.95); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9aa0a8'; for (let i = 0; i < 3; i++) { ctx.fillRect(s * 0.1, -s * (0.55 + i * 0.15), s * 0.12, s * 0.05); ctx.fillRect(-s * 0.22, -s * (0.62 + i * 0.15), s * 0.12, s * 0.05); }
    ctx.restore();
    // greatcoat torso
    const coat = () => { ctx.beginPath(); ctx.moveTo(-s * 0.55, s * 0.4); ctx.lineTo(-s * 0.5, -s * 0.7); ctx.quadraticCurveTo(0, -s * 0.92, s * 0.5, -s * 0.7); ctx.lineTo(s * 0.55, s * 0.4); ctx.quadraticCurveTo(0, s * 0.52, -s * 0.55, s * 0.4); ctx.closePath(); };
    solid(ctx, coat, '#4f5a38', s, 'rgba(220,240,180,0.18)');
    ctx.fillStyle = '#2a2014'; ctx.fillRect(-s * 0.52, -s * 0.05, s * 1.04, s * 0.14);
    ctx.fillStyle = '#c9a840'; ctx.fillRect(-s * 0.06, -s * 0.05, s * 0.14, s * 0.14);
    // head + brodie helmet
    ctx.fillStyle = '#c99a72'; ctx.beginPath(); ctx.ellipse(s * 0.08, -s * 1.02, s * 0.26, s * 0.27, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3a28'; ctx.fillRect(s * 0.0, -s * 0.86, s * 0.32, s * 0.08);
    eyes(ctx, [[s * 0.22, -s * 1.02]], s * 0.05, '#e8f0ff', 1);
    const helm = () => { ctx.beginPath(); ctx.ellipse(s * 0.05, -s * 1.12, s * 0.5, s * 0.1, 0, 0, TAU); ctx.moveTo(-s * 0.3, -s * 1.12); ctx.quadraticCurveTo(s * 0.05, -s * 1.55, s * 0.4, -s * 1.12); ctx.closePath(); };
    solid(ctx, helm, '#5d6650', s, 'rgba(230,240,210,0.35)');
    // tower shield with a painted Elder Sign
    const sh = () => { ctx.beginPath(); ctx.moveTo(s * 0.45, -s * 1.0); ctx.quadraticCurveTo(s * 0.95, -s * 1.05, s * 0.95, -s * 0.3); ctx.quadraticCurveTo(s * 0.95, s * 0.55, s * 0.62, s * 0.75); ctx.quadraticCurveTo(s * 0.4, s * 0.55, s * 0.4, -s * 0.3); ctx.closePath(); };
    solid(ctx, sh, '#6b6f74', s, 'rgba(255,255,255,0.35)');
    ctx.strokeStyle = '#2a2c30'; ctx.lineWidth = s * 0.08; sh(); ctx.stroke();
    ctx.strokeStyle = '#6aff9a'; ctx.lineWidth = s * 0.07; ctx.lineJoin = 'round';
    ctx.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 2 * TAU / 5, r = s * 0.2; const x = s * 0.68 + Math.cos(a) * r, y = -s * 0.15 + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    ctx.restore();
  },

  // -------- OCCULTIST: hooded, a burning tome floating before the hands
  occultist(ctx, s, t, o = {}) {
    const bob = Math.sin(t * 4) * s * 0.04;
    ctx.save(); ctx.translate(0, bob);
    legs(ctx, s, t, '#20142e', '#0c0810', 0.15, 0.9);
    const robe = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.6, s * 0.85);
      for (let i = 1; i <= 6; i++) ctx.lineTo(-s * 0.6 + i * s * 0.21, s * (i % 2 ? 0.72 : 0.9));
      ctx.lineTo(s * 0.38, -s * 0.6); ctx.quadraticCurveTo(0, -s * 0.85, -s * 0.38, -s * 0.6); ctx.closePath();
    };
    solid(ctx, robe, '#3d2558', s, 'rgba(220,180,255,0.22)');
    ctx.strokeStyle = '#c9a840'; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.6); ctx.lineTo(s * 0.1, s * 0.82); ctx.stroke();
    // hood
    const hood = () => { ctx.beginPath(); ctx.moveTo(-s * 0.36, -s * 0.55); ctx.quadraticCurveTo(-s * 0.5, -s * 1.25, -s * 0.15, -s * 1.5); ctx.quadraticCurveTo(s * 0.45, -s * 1.3, s * 0.42, -s * 0.6); ctx.closePath(); };
    solid(ctx, hood, '#2c1a40', s, 'rgba(220,180,255,0.25)');
    ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.ellipse(s * 0.18, -s * 0.98, s * 0.18, s * 0.24, 0.2, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.25, -s * 1.0], [s * 0.13, -s * 0.98]], s * 0.05, '#d8a0ff', 2);
    // arms + tome
    const ty = -s * 0.35 + Math.sin(t * 3) * s * 0.06 - (o.swing || 0) * s * 0.3;
    limb(ctx, s * 0.05, -s * 0.5, s * 0.55, ty + s * 0.1, s * 0.1, s * 0.2, s * 0.16, '#2c1a40');
    ctx.fillStyle = '#4a1e14'; ctx.strokeStyle = '#120604'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(s * 0.45, ty); ctx.lineTo(s * 0.95, ty - s * 0.1); ctx.lineTo(s * 0.95, ty + s * 0.22); ctx.lineTo(s * 0.45, ty + s * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e6d8b4'; ctx.fillRect(s * 0.5, ty + s * 0.02, s * 0.4, s * 0.16);
    eyes(ctx, [[s * 0.7, ty - s * 0.25]], s * 0.09, '#c070ff', 6);
    ctx.restore();
  },

  // -------- PHYSICIAN: plague-doctor beak, wide hat, glowing vials
  physician(ctx, s, t, o = {}) {
    const bob = Math.abs(Math.sin(t * 9)) * s * 0.04;
    ctx.save(); ctx.translate(0, -bob);
    legs(ctx, s, t, '#1e1e24', '#0a0a0c', 0.2);
    // cane
    ctx.strokeStyle = '#3a2416'; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * 0.62, -s * 0.2); ctx.lineTo(s * 0.72 + Math.sin(t * 9) * s * 0.1, s * 0.95); ctx.stroke();
    ctx.fillStyle = '#c9a840'; ctx.beginPath(); ctx.arc(s * 0.62, -s * 0.24, s * 0.08, 0, TAU); ctx.fill();
    const coat = () => { ctx.beginPath(); ctx.moveTo(-s * 0.55, s * 0.75); ctx.lineTo(-s * 0.45, -s * 0.7); ctx.quadraticCurveTo(0, -s * 0.9, s * 0.42, -s * 0.7); ctx.lineTo(s * 0.5, s * 0.75); ctx.quadraticCurveTo(0, s * 0.85, -s * 0.55, s * 0.75); ctx.closePath(); };
    solid(ctx, coat, '#24242c', s, 'rgba(220,220,240,0.22)');
    // satchel + vials
    ctx.fillStyle = '#4a3020'; ctx.fillRect(-s * 0.45, s * 0.0, s * 0.35, s * 0.32);
    ctx.strokeStyle = '#4a3020'; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.02); ctx.lineTo(s * 0.3, -s * 0.65); ctx.stroke();
    eyes(ctx, [[s * 0.2, s * 0.1], [s * 0.32, s * 0.12]], s * 0.07, '#8aff9a', 3);
    limb(ctx, s * 0.1, -s * 0.5, s * 0.6, -s * 0.22 - (o.swing || 0) * s * 0.3, s * 0.1, s * 0.2, s * 0.16, '#24242c');
    // head: beak mask
    ctx.fillStyle = '#d9cfae'; ctx.strokeStyle = '#2a2418'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(s * 0.18, -s * 1.12); ctx.quadraticCurveTo(s * 0.7, -s * 1.0, s * 0.95, -s * 0.72); ctx.quadraticCurveTo(s * 0.55, -s * 0.78, s * 0.2, -s * 0.82); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#20202a'; ctx.beginPath(); ctx.ellipse(s * 0.05, -s * 0.98, s * 0.27, s * 0.26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0c1a10'; ctx.beginPath(); ctx.arc(s * 0.22, -s * 1.02, s * 0.1, 0, TAU); ctx.fill();
    eyes(ctx, [[s * 0.22, -s * 1.02]], s * 0.065, '#8aff9a', 3);
    // wide-brim hat
    const hat = () => { ctx.beginPath(); ctx.ellipse(s * 0.05, -s * 1.18, s * 0.62, s * 0.11, -0.05, 0, TAU); ctx.moveTo(-s * 0.25, -s * 1.18); ctx.lineTo(-s * 0.22, -s * 1.55); ctx.lineTo(s * 0.32, -s * 1.55); ctx.lineTo(s * 0.35, -s * 1.18); ctx.closePath(); };
    solid(ctx, hat, '#16161a', s, 'rgba(220,220,240,0.3)');
    ctx.fillStyle = '#6a1a1a'; ctx.fillRect(-s * 0.23, -s * 1.3, s * 0.56, s * 0.08);
    ctx.restore();
  },

  // -------- HUNTER: duster coat, wide hat, long rifle levelled
  hunter(ctx, s, t, o = {}) {
    const bob = Math.abs(Math.sin(t * 9)) * s * 0.05;
    ctx.save(); ctx.translate(0, -bob);
    legs(ctx, s, t, '#3a2c20', '#140e08', 0.22);
    const coat = () => {
      ctx.beginPath(); ctx.moveTo(-s * 0.62, s * 0.85); ctx.lineTo(-s * 0.42, -s * 0.7); ctx.quadraticCurveTo(0, -s * 0.88, s * 0.42, -s * 0.7);
      ctx.lineTo(s * 0.45, s * 0.3); ctx.lineTo(s * 0.2, s * 0.86); ctx.lineTo(-s * 0.2, s * 0.7); ctx.closePath();
    };
    solid(ctx, coat, '#6b4a2c', s, 'rgba(255,230,190,0.22)');
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(-s * 0.42, -s * 0.15, s * 0.86, s * 0.1);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#c9a840'; ctx.fillRect(-s * 0.32 + i * s * 0.18, -s * 0.13, s * 0.06, s * 0.08); }
    // scarf
    ctx.fillStyle = '#8a2420'; ctx.fillRect(-s * 0.25, -s * 0.78, s * 0.5, s * 0.14);
    ctx.beginPath(); ctx.moveTo(-s * 0.25, -s * 0.7); ctx.lineTo(-s * 0.6, -s * 0.45 + Math.sin(t * 6) * s * 0.06); ctx.lineTo(-s * 0.2, -s * 0.6); ctx.closePath(); ctx.fill();
    // rifle levelled forward
    const k = -(o.swing || 0) * s * 0.15;
    ctx.save(); ctx.translate(k, 0);
    ctx.fillStyle = '#5a3a1c'; ctx.strokeStyle = '#120a04'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.35); ctx.lineTo(s * 0.45, -s * 0.45); ctx.lineTo(s * 0.5, -s * 0.32); ctx.lineTo(-s * 0.1, -s * 0.18); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b8bec6'; ctx.fillRect(s * 0.45, -s * 0.46, s * 0.85, s * 0.08);
    ctx.fillStyle = '#2a2c30'; ctx.fillRect(s * 0.25, -s * 0.56, s * 0.3, s * 0.08);
    ctx.restore();
    limb(ctx, -s * 0.1, -s * 0.55, s * 0.4, -s * 0.38, s * 0.08, s * 0.2, s * 0.16, '#5a3c22');
    // head + hat
    ctx.fillStyle = '#c99a72'; ctx.beginPath(); ctx.ellipse(s * 0.08, -s * 1.0, s * 0.24, s * 0.26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a3020'; ctx.fillRect(s * 0.0, -s * 0.86, s * 0.3, s * 0.1);
    eyes(ctx, [[s * 0.22, -s * 1.02]], s * 0.045, '#fff0c0', 1);
    const hat = () => { ctx.beginPath(); ctx.ellipse(s * 0.05, -s * 1.16, s * 0.58, s * 0.1, 0.08, 0, TAU); ctx.moveTo(-s * 0.25, -s * 1.16); ctx.quadraticCurveTo(-s * 0.2, -s * 1.5, s * 0.08, -s * 1.45); ctx.quadraticCurveTo(s * 0.35, -s * 1.5, s * 0.35, -s * 1.16); ctx.closePath(); };
    solid(ctx, hat, '#3a2616', s, 'rgba(255,230,190,0.25)');
    ctx.restore();
  },

  // -------- the Antiquarian (merchant): hunched, lantern, enormous pack
  merchant(ctx, s, t) {
    ctx.fillStyle = '#4a3624'; ctx.strokeStyle = '#140c06'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(-s * 0.45, -s * 0.5, s * 0.55, s * 0.75, -0.2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#2a1c10'; ctx.beginPath(); ctx.moveTo(-s * 0.9, -s * 0.6); ctx.lineTo(0, -s * 0.4); ctx.moveTo(-s * 0.8, -s * 0.1); ctx.lineTo(-s * 0.1, 0); ctx.stroke();
    ctx.fillStyle = '#7a1c1c'; ctx.fillRect(-s * 0.7, -s * 1.25, s * 0.3, s * 0.25);
    const robe = () => { ctx.beginPath(); ctx.moveTo(-s * 0.4, s); ctx.quadraticCurveTo(-s * 0.3, -s * 0.5, s * 0.15, -s * 0.75); ctx.quadraticCurveTo(s * 0.55, -s * 0.4, s * 0.45, s); ctx.closePath(); };
    solid(ctx, robe, '#3a3440', s, 'rgba(220,220,240,0.2)');
    ctx.fillStyle = '#b8a888'; ctx.beginPath(); ctx.ellipse(s * 0.35, -s * 0.78, s * 0.2, s * 0.22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.62); ctx.lineTo(s * 0.5, -s * 0.62); ctx.lineTo(s * 0.4, -s * 0.2); ctx.closePath(); ctx.fill();
    eyes(ctx, [[s * 0.45, -s * 0.8]], s * 0.045, '#ffe8a0', 1);
    const hood = () => { ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.6); ctx.quadraticCurveTo(s * 0.0, -s * 1.15, s * 0.4, -s * 1.12); ctx.quadraticCurveTo(s * 0.7, -s * 1.0, s * 0.62, -s * 0.72); ctx.quadraticCurveTo(s * 0.45, -s * 0.95, s * 0.2, -s * 0.85); ctx.closePath(); };
    solid(ctx, hood, '#2a2430', s, 'rgba(220,220,240,0.25)');
    ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(s * 0.55, -s * 0.3); ctx.lineTo(s * 0.8, -s * 0.3); ctx.lineTo(s * 0.8, -s * 0.05); ctx.stroke();
    ctx.fillStyle = '#2a2420'; ctx.fillRect(s * 0.68, -s * 0.05, s * 0.24, s * 0.3);
    eyes(ctx, [[s * 0.8, s * 0.1]], s * 0.1, '#ffc860', 8 + Math.sin(t * 9) * 2);
  },
};

// ---------------- props ----------------
const PropArt = {
  pillar(ctx, s, t, theme) {
    const col = { docks: '#4a3a28', crypt: '#4a4844', rlyeh: '#2c4038' }[theme] || '#4a4844';
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(0, s * 0.95, s * 0.7, s * 0.25, 0, 0, TAU); ctx.fill();
    if (theme === 'docks') {
      const b = () => { ctx.beginPath(); ctx.ellipse(0, s * 0.3, s * 0.55, s * 0.7, 0, 0, TAU); };
      solid(ctx, b, '#5a4028', s, 'rgba(255,220,170,0.2)');
      ctx.strokeStyle = '#2a2018'; ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.moveTo(-s * 0.53, 0); ctx.lineTo(s * 0.53, 0); ctx.moveTo(-s * 0.53, s * 0.6); ctx.lineTo(s * 0.53, s * 0.6); ctx.stroke();
      return;
    }
    const p = () => { ctx.beginPath(); ctx.rect(-s * 0.45, -s * 1.4, s * 0.9, s * 2.3); };
    solid(ctx, p, col, s, 'rgba(230,240,230,0.25)');
    ctx.fillStyle = shade(col, 0.15); ctx.fillRect(-s * 0.6, -s * 1.55, s * 1.2, s * 0.25); ctx.fillRect(-s * 0.6, s * 0.78, s * 1.2, s * 0.2);
    if (theme === 'rlyeh') { ctx.strokeStyle = 'rgba(110,255,170,0.6)'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.arc(0, -s * 0.4, s * 0.2, 0, TAU); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(s * 0.2, -s * 0.8); ctx.stroke(); }
    else { ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 1.2); ctx.lineTo(s * 0.1, -s * 0.6); ctx.lineTo(-s * 0.05, 0); ctx.stroke(); }
  },
  chest(ctx, s, t, open) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(0, s * 0.55, s * 0.9, s * 0.25, 0, 0, TAU); ctx.fill();
    const b = () => { ctx.beginPath(); ctx.rect(-s * 0.8, -s * 0.2, s * 1.6, s * 0.75); };
    solid(ctx, b, '#5a3a1c', s, 'rgba(255,220,170,0.2)');
    if (open) { eyes(ctx, [[0, -s * 0.25]], s * 0.35, '#ffd76a', 8); ctx.fillStyle = '#3a2410'; ctx.fillRect(-s * 0.8, -s * 0.9, s * 1.6, s * 0.3); }
    else { const l = () => { ctx.beginPath(); ctx.moveTo(-s * 0.8, -s * 0.2); ctx.quadraticCurveTo(0, -s * 0.8, s * 0.8, -s * 0.2); ctx.closePath(); }; solid(ctx, l, '#6a4422', s, 'rgba(255,220,170,0.3)'); }
    ctx.fillStyle = '#c9a840'; ctx.fillRect(-s * 0.85, -s * 0.05, s * 1.7, s * 0.12); ctx.fillRect(-s * 0.12, -s * 0.2, s * 0.24, s * 0.3);
  },
  altar(ctx, s, t) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(0, s * 0.6, s, s * 0.3, 0, 0, TAU); ctx.fill();
    const b = () => { ctx.beginPath(); ctx.rect(-s * 0.85, -s * 0.3, s * 1.7, s * 0.9); };
    solid(ctx, b, '#4a4844', s, 'rgba(230,240,230,0.25)');
    ctx.fillStyle = '#3a3836'; ctx.fillRect(-s, -s * 0.45, s * 2, s * 0.2);
    ctx.strokeStyle = '#9affc8'; ctx.lineWidth = s * 0.08; ctx.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 2 * TAU / 5; const x = Math.cos(a) * s * 0.25, y = s * 0.15 + Math.sin(a) * s * 0.25; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    eyes(ctx, [[0, -s * 0.85 + Math.sin(t * 3) * s * 0.1]], s * 0.2, '#9affc8', 8);
  },
  campfire(ctx, s, t) {
    ctx.fillStyle = '#3a2a1c'; for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * 1.05 - 1); ctx.fillRect(-s * 0.8, -s * 0.1, s * 1.6, s * 0.2); ctx.restore(); }
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; ctx.fillStyle = '#5d636a'; ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.4, s * 0.17, 0, TAU); ctx.fill(); }
    const f = Math.sin(t * 11);
    ctx.fillStyle = '#d0503a'; ctx.beginPath(); ctx.moveTo(-s * 0.45, 0); ctx.quadraticCurveTo(-s * 0.3, -s * 0.9, 0, -s * (1.3 + f * 0.15)); ctx.quadraticCurveTo(s * 0.3, -s * 0.8, s * 0.45, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0d870'; ctx.beginPath(); ctx.moveTo(-s * 0.22, 0); ctx.quadraticCurveTo(-s * 0.1, -s * 0.5, 0, -s * (0.8 - f * 0.1)); ctx.quadraticCurveTo(s * 0.12, -s * 0.5, s * 0.22, 0); ctx.closePath(); ctx.fill();
  },
};
