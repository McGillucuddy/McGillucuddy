// ============================================================
//  ELDRITCH DESCENT — core helpers + pixel-art pipeline
//  Vector art is drawn small, snapped to one shared palette and
//  given a 1px outline, so every sprite reads as hand-placed pixels.
// ============================================================
'use strict';

const W = 480, H = 272, TILE = 16;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

// One palette for the whole game: dark, desaturated, with a few sickly accents.
// Grouped as material ramps (dark → light) so dithering stays within a material.
const PALETTE_HEX = [
  '#000000', '#0b0d10', '#17191d', '#262a2e', '#3c4146', '#5d636a', '#8a9097', '#c3c7cb', '#eeeae0',   // stone / bone-grey
  '#08130f', '#0e1f1a', '#16302a', '#1a3a30', '#22463a', '#2a5a48', '#3f7f62', '#5a9474', '#6aa77f', '#a8d08a', // sea-green flesh
  '#120a1a', '#1c1028', '#35204a', '#5a3a78', '#8d63b0', '#c8a0e8',                                   // void violet
  '#1a0608', '#2a0a0c', '#5a1418', '#7a1c1c', '#9a2a24', '#d0503a', '#ff7a5a',                         // blood
  '#1e140c', '#3a2418', '#5a3a22', '#6b4428', '#8a5a34', '#a0703c', '#c99a72',                         // leather / wood / skin
  '#7a7048', '#b0a070', '#d8c890', '#f0d870', '#ffe9a8',                                               // bone / gold
  '#0a1020', '#12203a', '#24467a', '#4a8ad0', '#9ad0ff',                                               // cold blue
  '#2a2e20', '#4a5236', '#7a8656', '#3a3436', '#6a5a5c', '#4a3a4a', '#2a2430',                         // drab cloth
];
const PALETTE = PALETTE_HEX.map(h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; });
const OUTLINE = [5, 7, 10];
const _palCache = new Map();
function palDist(r, g, b, p) {
  const rm = (r + p[0]) / 2, dr = r - p[0], dg = g - p[1], db = b - p[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}
// nearest two palette entries, for dithering between neighbouring shades
function nearestPal2(r, g, b) {
  const key = (r >> 2) << 12 | (g >> 2) << 6 | (b >> 2);
  let v = _palCache.get(key);
  if (v) return v;
  let i1 = 0, d1 = 1e12, i2 = 0, d2 = 1e12;
  for (let p = 0; p < PALETTE.length; p++) {
    const e = palDist(r, g, b, PALETTE[p]);
    if (e < d1) { i2 = i1; d2 = d1; i1 = p; d1 = e; } else if (e < d2) { i2 = p; d2 = e; }
  }
  v = [i1, d1, i2, d2];
  _palCache.set(key, v);
  return v;
}
function nearestPal(r, g, b) { return nearestPal2(r, g, b)[0]; }
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;

// Turn a supersampled vector render into hand-placed-looking pixel art.
//  1) box-filter down by `ss`   2) light from the top-left (rim + form shadow)
//  3) ordered-dither between neighbouring palette shades   4) remove orphan pixels
//  5) selective outline: a darkened version of the colour it borders, darkest on the shadow side
function pixelArt(big, ss, N) {
  const bw = big.width, bd = big.getContext('2d').getImageData(0, 0, bw, big.height).data;
  const R = new Float32Array(N * N), G = new Float32Array(N * N), B = new Float32Array(N * N), A = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let yy = 0; yy < ss; yy++) for (let xx = 0; xx < ss; xx++) {
      const i = ((y * ss + yy) * bw + (x * ss + xx)) * 4, al = bd[i + 3] / 255;
      r += bd[i] * al; g += bd[i + 1] * al; b += bd[i + 2] * al; a += al;
    }
    const k = y * N + x, n = ss * ss;
    A[k] = a / n;
    if (a > 0) { R[k] = r / a; G[k] = g / a; B[k] = b / a; }
  }
  const solid = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) solid[k] = A[k] >= 0.45 ? 1 : 0;
  const S = (x, y) => x >= 0 && y >= 0 && x < N && y < N && solid[y * N + x];
  // height map from distance-to-edge → surface normals → directional light from the top-left.
  // Gives each silhouette real volume instead of flat cut-out fills.
  const D = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) D[k] = solid[k] ? 1e3 : 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = y * N + x; if (!solid[k]) continue; let v = D[k]; if (x > 0) v = Math.min(v, D[k - 1] + 1); if (y > 0) v = Math.min(v, D[k - N] + 1); if (x > 0 && y > 0) v = Math.min(v, D[k - N - 1] + 1.4); if (x < N - 1 && y > 0) v = Math.min(v, D[k - N + 1] + 1.4); D[k] = v; }
  for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) { const k = y * N + x; if (!solid[k]) continue; let v = D[k]; if (x < N - 1) v = Math.min(v, D[k + 1] + 1); if (y < N - 1) v = Math.min(v, D[k + N] + 1); if (x < N - 1 && y < N - 1) v = Math.min(v, D[k + N + 1] + 1.4); if (x > 0 && y < N - 1) v = Math.min(v, D[k + N - 1] + 1.4); D[k] = v; }
  const DM = Math.max(3, Math.min(7, N / 14));
  const Hh = k => solid[k] ? Math.sqrt(Math.min(D[k], DM) / DM) : 0;
  const LX = -0.55, LY = -0.62, LZ = 0.56;
  const out = new Uint8ClampedArray(N * N * 4), idx = new Int16Array(N * N).fill(-1);
  const noise = mulberry32(N * 7919 + 13);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x; if (!solid[k]) continue;
    let r = R[k], g = G[k], b = B[k];
    const L = lum(r, g, b);
    const gx = (x < N - 1 ? Hh(k + 1) : 0) - (x > 0 ? Hh(k - 1) : 0);
    const gy = (y < N - 1 ? Hh(k + N) : 0) - (y > 0 ? Hh(k - N) : 0);
    let nx = -gx * 1.6, ny = -gy * 1.6, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const lam = Math.max(0, nx * LX + ny * LY + nz * LZ);
    let f = 0.42 + 0.95 * lam;                       // ~0.42 in shadow … ~1.37 facing the light
    f *= 1.05 - 0.18 * (y / N);                      // gentle falloff toward the floor
    if (!S(x - 1, y) || !S(x, y - 1)) f *= 1.15;     // crisp rim on the lit edge
    f *= 0.96 + noise() * 0.08;                      // grain
    r *= f; g *= f; b *= f;
    // hue-shift: shadows go cool and violet, light goes warm
    if (f < 1) { const t = 1 - f; r *= 1 - 0.18 * t; g *= 1 - 0.08 * t; b *= 1 + 0.22 * t; }
    else { const t = Math.min(1, f - 1); r *= 1 + 0.1 * t; g *= 1 + 0.06 * t; b *= 1 - 0.1 * t; }
    if (L < 40 && lam > 0.75) { r += 8; g += 10; b += 16; }   // dark hides still catch a cold sheen
    r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
    const [i1, d1, i2, d2] = nearestPal2(r, g, b);
    let pi = i1;
    // dither only between close shades of the same material, never between unrelated colours
    const p1 = PALETTE[i1], p2 = PALETTE[i2];
    const gap = palDist(p1[0], p1[1], p1[2], p2);
    if (gap < 9000 && d2 < gap * 1.25) {
      const tdist = Math.sqrt(d1) / (Math.sqrt(d1) + Math.sqrt(d2));
      if (tdist > BAYER4[(y & 3) * 4 + (x & 3)] * 0.9) pi = i2;
    }
    idx[k] = pi;
  }
  // orphan cleanup: a lone pixel surrounded by one other colour joins it
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const k = y * N + x; if (idx[k] < 0) continue;
    const n4 = [idx[k - 1], idx[k + 1], idx[k - N], idx[k + N]];
    if (n4.every(v => v >= 0 && v === n4[0]) && n4[0] !== idx[k]) {
      const a = PALETTE[idx[k]], b = PALETTE[n4[0]];
      if (Math.abs(lum(...a) - lum(...b)) < 70) idx[k] = n4[0];
    }
  }
  for (let k = 0; k < N * N; k++) if (idx[k] >= 0) { const p = PALETTE[idx[k]]; out[k * 4] = p[0]; out[k * 4 + 1] = p[1]; out[k * 4 + 2] = p[2]; out[k * 4 + 3] = 255; }
  // selective outline
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x; if (solid[k]) continue;
    const nb = [[0, -1, 0.55], [-1, 0, 0.5], [1, 0, 0.32], [0, 1, 0.26]].filter(([dx, dy]) => S(x + dx, y + dy));
    if (!nb.length) continue;
    let r = 0, g = 0, b = 0, w = 0, f = 0;
    for (const [dx, dy, ff] of nb) { const kk = (y + dy) * N + x + dx; r += out[kk * 4]; g += out[kk * 4 + 1]; b += out[kk * 4 + 2]; w++; f += ff; }
    f /= nb.length; r = r / w * f; g = g / w * f; b = b / w * f;
    const p = PALETTE[nearestPal(r * 0.8, g * 0.8, b * 0.85)];
    const dark = lum(...p) > 70 ? OUTLINE : p;
    out[k * 4] = dark[0]; out[k * 4 + 1] = dark[1]; out[k * 4 + 2] = dark[2]; out[k * 4 + 3] = 255;
  }
  const c = document.createElement('canvas'); c.width = N; c.height = N;
  c.getContext('2d').putImageData(new ImageData(out, N, N), 0, 0);
  return c;
}
function whiteOf(canvas) {
  const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
  const k = c.getContext('2d'); k.drawImage(canvas, 0, 0);
  k.globalCompositeOperation = 'source-in'; k.fillStyle = '#fff'; k.fillRect(0, 0, c.width, c.height);
  return c;
}

// Bake an animated sprite. draw(ctx, s, t) draws in art units around (0,0).
// Rendered supersampled, then converted by pixelArt(). Returns frames (ping-pong
// order), white flash frames, origin, and eye spots for the glow pass.
const SPRITES = {};
function bakeSprite(key, draw, s, opts = {}) {
  const scale = opts.scale ?? 0.9, span = opts.span ?? 4.6, nf = opts.frames ?? 6;
  const N = Math.ceil(s * span * scale) + 2;
  const ss = N > 150 ? 3 : 4;
  const ox = Math.round(N * (opts.ox ?? 0.5)), oy = Math.round(N * (opts.oy ?? 0.6));
  const frames = [], white = [], eyesPerFrame = [];
  const big = document.createElement('canvas'); big.width = N * ss; big.height = N * ss;
  const k = big.getContext('2d');
  for (let f = 0; f < nf; f++) {
    k.setTransform(1, 0, 0, 1, 0, 0); k.clearRect(0, 0, big.width, big.height);
    k.setTransform(scale * ss, 0, 0, scale * ss, ox * ss, oy * ss);
    EyeSink.on = true; EyeSink.list = []; EyeSink.ss = ss;
    draw(k, s, (opts.t0 ?? 0.2) + f * (opts.dt ?? 0.13));
    EyeSink.on = false;
    const c = pixelArt(big, ss, N);
    frames.push(c); white.push(whiteOf(c));
    eyesPerFrame.push(EyeSink.list.map(e => ({ x: Math.round(e.x - ox), y: Math.round(e.y - oy), r: Math.max(1, e.r), color: e.color })));
  }
  const order = []; for (let i = 0; i < nf; i++) order.push(i); if (!opts.loop) for (let i = nf - 2; i > 0; i--) order.push(i);
  const spr = { frames, white, eyes: eyesPerFrame, order, w: N, h: N, ox, oy, fps: opts.fps || 4 };
  SPRITES[key] = spr;
  return spr;
}
function frameOf(spr, t) { return spr.order[Math.floor(t) % spr.order.length]; }

// ---------------- 3x5 pixel font ----------------
const FONT = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
  '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', '?': '111001011000010', '/': '001001010100100',
  'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'D': '110101101101110', 'E': '111100110100111',
  'F': '111100110100100', 'G': '011100101101011', 'H': '101101111101101', 'I': '111010010010111', 'J': '001001001101010',
  'K': '101101110101101', 'L': '100100100100111', 'M': '101111111101101', 'N': '110101101101101', 'O': '010101101101010',
  'P': '110101110100100', 'Q': '010101101110011', 'R': '110101110101101', 'S': '011100010001110', 'T': '111010010010010',
  'U': '101101101101111', 'V': '101101101101010', 'W': '101101111111101', 'X': '101101010101101', 'Y': '101101010010010',
  'Z': '111001010100111', ' ': '000000000000000', '.': '000000000000010', ':': '000010000010000',
};
function pxText(ctx, str, x, y, color, shadow = '#05070a', scale = 1) {
  str = String(str).toUpperCase();
  const w = str.length * 4 * scale - scale;
  let cx = Math.round(x - w / 2); y = Math.round(y);
  for (const pass of shadow ? [0, 1] : [1]) {
    ctx.fillStyle = pass ? color : shadow;
    const o = pass ? 0 : scale;
    let px = cx;
    for (const ch of str) {
      const g = FONT[ch] || FONT['?'];
      for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(px + (i % 3) * scale + o, y + Math.floor(i / 3) * scale + o, scale, scale);
      px += 4 * scale;
    }
  }
}

// Pixel-crisp filled circle / ring via row spans (no anti-aliasing).
function pxCircle(ctx, cx, cy, r) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.max(1, Math.round(r));
  for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.6)); ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
}
function pxEllipse(ctx, cx, cy, rx, ry) {
  cx = Math.round(cx); cy = Math.round(cy); rx = Math.max(1, Math.round(rx)); ry = Math.max(1, Math.round(ry));
  for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + ry * 0.6)))); ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
}
function pxRing(ctx, cx, cy, r) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.max(1, Math.round(r));
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) ctx.fillRect(cx + a, cy + b, 1, 1);
    y++; if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
}
