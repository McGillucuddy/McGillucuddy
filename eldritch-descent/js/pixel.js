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
const PALETTE_HEX = [
  '#000000', '#0b0d10', '#17191d', '#262a2e', '#3c4146', '#5d636a', '#8a9097', '#c3c7cb', '#eeeae0',
  '#0e1f1a', '#1a3a30', '#2a5a48', '#3f7f62', '#6aa77f', '#a8d08a',
  '#1c1028', '#35204a', '#5a3a78', '#8d63b0', '#c8a0e8',
  '#2a0a0c', '#5a1418', '#9a2a24', '#d0503a',
  '#3a2418', '#6b4428', '#a0703c', '#d8c890', '#f0d870', '#ffe9a8',
  '#12203a', '#24467a', '#4a8ad0', '#9ad0ff',
  '#4a5236', '#7a8656', '#3a3436', '#6a5a5c',
];
const PALETTE = PALETTE_HEX.map(h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; });
const OUTLINE = [5, 7, 10];
const _palCache = new Map();
function nearestPal(r, g, b) {
  const key = (r >> 2) << 12 | (g >> 2) << 6 | (b >> 2);
  let v = _palCache.get(key);
  if (v !== undefined) return v;
  let best = 0, bd = 1e12;
  for (let p = 0; p < PALETTE.length; p++) {
    const [pr, pg, pb] = PALETTE[p];
    const rm = (r + pr) / 2, dr = r - pr, dg = g - pg, db = b - pb;
    const e = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (e < bd) { bd = e; best = p; }
  }
  _palCache.set(key, best);
  return best;
}

// Quantise a canvas in place: alpha threshold, palette snap, 1px outline.
function pixelize(canvas, outline = true) {
  const w = canvas.width, h = canvas.height, k = canvas.getContext('2d');
  const im = k.getImageData(0, 0, w, h), d = im.data, solidPx = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3];
    if (a < 110) { d[i * 4 + 3] = 0; continue; }
    // un-premultiply the edge pixels a little so outlines stay dark, not grey
    const p = PALETTE[nearestPal(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])];
    d[i * 4] = p[0]; d[i * 4 + 1] = p[1]; d[i * 4 + 2] = p[2]; d[i * 4 + 3] = 255; solidPx[i] = 1;
  }
  if (outline) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (solidPx[i]) continue;
    if ((x > 0 && solidPx[i - 1]) || (x < w - 1 && solidPx[i + 1]) || (y > 0 && solidPx[i - w]) || (y < h - 1 && solidPx[i + w])) {
      d[i * 4] = OUTLINE[0]; d[i * 4 + 1] = OUTLINE[1]; d[i * 4 + 2] = OUTLINE[2]; d[i * 4 + 3] = 255;
    }
  }
  k.putImageData(im, 0, 0);
}
function whiteOf(canvas) {
  const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
  const k = c.getContext('2d'); k.drawImage(canvas, 0, 0);
  k.globalCompositeOperation = 'source-in'; k.fillStyle = '#fff'; k.fillRect(0, 0, c.width, c.height);
  return c;
}

// Bake an animated sprite. draw(ctx, s, t) draws in art units around (0,0).
// Returns frames (ping-pong order), white flash frames, origin, and eye spots.
const SPRITES = {};
function bakeSprite(key, draw, s, opts = {}) {
  const scale = opts.scale ?? 0.9, span = opts.span ?? 4.6, nf = opts.frames ?? 6;
  const N = Math.ceil(s * span * scale) + 2;
  const ox = Math.round(N * (opts.ox ?? 0.5)), oy = Math.round(N * (opts.oy ?? 0.6));
  const frames = [], white = [], eyesPerFrame = [];
  for (let f = 0; f < nf; f++) {
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const k = c.getContext('2d');
    k.translate(ox, oy); k.scale(scale, scale);
    EyeSink.on = true; EyeSink.list = []; EyeSink.ss = 1;
    draw(k, s, (opts.t0 ?? 0.2) + f * (opts.dt ?? 0.13));
    EyeSink.on = false;
    pixelize(c, opts.outline !== false);
    frames.push(c); white.push(whiteOf(c));
    eyesPerFrame.push(EyeSink.list.map(e => ({ x: Math.round(e.x - ox), y: Math.round(e.y - oy), r: Math.max(1, e.r), color: e.color })));
  }
  // ping-pong: 0 1 2 3 4 5 4 3 2 1
  const order = []; for (let i = 0; i < nf; i++) order.push(i); for (let i = nf - 2; i > 0; i--) order.push(i);
  const spr = { frames, white, eyes: eyesPerFrame, order, w: N, h: N, ox, oy };
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
