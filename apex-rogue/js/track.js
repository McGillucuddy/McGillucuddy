'use strict';
// Procedural track generation, spatial queries and pre-rendering.

const BIOMES = {
  meadow: {
    name: 'Meadow Ring', bg: '#4f8f3a', bgDots: '#5d9e46', runoffColor: '#79b257',
    wall: '#ececec', wallStripe: '#d33a2c', asphalt: '#46494f', line: 'rgba(255,255,255,0.5)',
    curbA: '#d33a2c', curbB: '#f4f4f4', grip: 1.0, offroadTop: 0.55, offroadDrag: 0.9,
    deco: 'tree', night: false, hw: 72, runoff: 48,
    blurb: 'Grippy tarmac, punishing grass.',
  },
  desert: {
    name: 'Dust Bowl', bg: '#d6ae6b', bgDots: '#c99f5c', runoffColor: '#e4c88f',
    wall: '#9c5530', wallStripe: '#f0e2c0', asphalt: '#5b544c', line: 'rgba(255,240,210,0.45)',
    curbA: '#c2462b', curbB: '#f0e2c0', grip: 0.92, offroadTop: 0.72, offroadDrag: 0.45,
    deco: 'cactus', night: false, hw: 76, runoff: 64,
    blurb: 'Wide and fast. Sand is forgiving.',
  },
  tundra: {
    name: 'Frostbite Pass', bg: '#e6eef4', bgDots: '#d6e2eb', runoffColor: '#f5f9fc',
    wall: '#6f9bc4', wallStripe: '#ffffff', asphalt: '#5c6670', line: 'rgba(255,255,255,0.6)',
    curbA: '#3a78b5', curbB: '#ffffff', grip: 0.68, offroadTop: 0.5, offroadDrag: 1.1,
    deco: 'pine', night: false, hw: 74, runoff: 48,
    blurb: 'Icy. Brake early, slide often.',
  },
  neon: {
    name: 'Neon Sprawl', bg: '#13111e', bgDots: '#1b1830', runoffColor: '#23203a',
    wall: '#ff2fd0', wallStripe: '#2ff3ff', asphalt: '#2a2839', line: 'rgba(47,243,255,0.5)',
    curbA: '#ff2fd0', curbB: '#2ff3ff', grip: 1.04, offroadTop: 0.6, offroadDrag: 0.9,
    deco: 'building', night: true, hw: 64, runoff: 30,
    blurb: 'Night race. Tight walls, high grip.',
  },
};

const TRACK_SPACING = 10;
const WALL_T = 16;

function catmullClosed(P, steps) {
  // Centripetal Catmull-Rom (no cusps / self loops on uneven control points).
  const out = [];
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const t0 = 0;
    const t1 = t0 + Math.sqrt(dist(p0, p1));
    const t2 = t1 + Math.sqrt(dist(p1, p2));
    const t3 = t2 + Math.sqrt(dist(p2, p3));
    for (let s = 0; s < steps; s++) {
      const t = t1 + ((t2 - t1) * s) / steps;
      const mix = (a, b, ta, tb) => {
        const k = (t - ta) / (tb - ta);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      };
      const A1 = mix(p0, p1, t0, t1), A2 = mix(p1, p2, t1, t2), A3 = mix(p2, p3, t2, t3);
      const B1 = mix(A1, A2, t0, t2), B2 = mix(A2, A3, t1, t3);
      out.push(mix(B1, B2, t1, t2));
    }
  }
  return out;
}

function resampleClosed(pts, spacing) {
  const n = pts.length;
  const cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i % n]));
  const L = cum[n];
  const N = Math.max(20, Math.round(L / spacing));
  const step = L / N;
  const out = [];
  let seg = 0;
  for (let k = 0; k < N; k++) {
    const d = k * step;
    while (cum[seg + 1] < d) seg++;
    const a = pts[seg], b = pts[(seg + 1) % n];
    const t = (d - cum[seg]) / (cum[seg + 1] - cum[seg] || 1);
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return { pts: out, step };
}

function computeAngles(pts) {
  const N = pts.length;
  const ang = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N];
    ang[i] = Math.atan2(b.y - a.y, b.x - a.x);
  }
  return ang;
}

function computeCurvature(ang, step, smooth) {
  const N = ang.length;
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) raw[i] = wrapAngle(ang[(i + 1) % N] - ang[i]) / step;
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let k = -smooth; k <= smooth; k++) s += raw[(i + k + N) % N];
    out[i] = s / (smooth * 2 + 1);
  }
  return out;
}

function validateLayout(pts, step, clearance, minRadius) {
  const N = pts.length;
  const ang = computeAngles(pts);
  const curv = computeCurvature(ang, step, 3);
  for (let i = 0; i < N; i++) if (Math.abs(curv[i]) > 1 / minRadius) return false;
  // Distinct parts of the track must not come close enough for walls to merge.
  const minD2 = (2 * clearance + 24) ** 2;
  const skip = Math.ceil((clearance * 3.6) / step);
  for (let i = 0; i < N; i += 2) {
    for (let j = i + skip; j < N; j += 2) {
      if (N - (j - i) < skip) continue;
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
      if (dx * dx + dy * dy < minD2) return false;
    }
  }
  return true;
}

function generateTrack(seed, biomeKey, opts = {}) {
  const biome = BIOMES[biomeKey];
  const rng = mulberry32(seed);
  const hw = biome.hw, runoff = biome.runoff;
  const clearance = hw + runoff + WALL_T;
  const sizeMul = opts.sizeMul || 1;

  let layout = null;
  for (let attempt = 0; attempt < 400 && !layout; attempt++) {
    const n = randInt(rng, 8, 14);
    const R = randRange(rng, 1100, 1500) * sizeMul;
    const sx = randRange(rng, 0.95, 1.5), sy = randRange(rng, 0.8, 1.05);
    const ctrl = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + randRange(rng, -0.3, 0.3) * (TAU / n);
      const r = R * randRange(rng, 0.42, 1.0);
      ctrl.push({ x: Math.cos(a) * r * sx, y: Math.sin(a) * r * sy });
    }
    const res = resampleClosed(catmullClosed(ctrl, 40), TRACK_SPACING);
    if (validateLayout(res.pts, res.step, clearance, hw * 1.15)) layout = res;
  }
  if (!layout) {
    // Fallback: a plain stadium oval that is always valid.
    const ctrl = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctrl.push({ x: Math.cos(a) * 1500, y: Math.sin(a) * 800 });
    }
    layout = resampleClosed(catmullClosed(ctrl, 40), TRACK_SPACING);
  }

  let pts = layout.pts;
  const step = layout.step;
  if (rng() < 0.5) pts.reverse();

  // Start/finish goes on the straightest stretch.
  {
    const ang0 = computeAngles(pts);
    const N = pts.length;
    let best = 0, bestScore = Infinity;
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let k = -30; k < 25; k++) {
        const a = (i + k + N) % N;
        s += Math.abs(wrapAngle(ang0[(a + 1) % N] - ang0[a]));
      }
      if (s < bestScore) { bestScore = s; best = i; }
    }
    pts = pts.slice(best).concat(pts.slice(0, best));
  }

  const N = pts.length;
  const ang = computeAngles(pts);
  const curv = computeCurvature(ang, step, 4);
  const nx = new Float32Array(N), ny = new Float32Array(N);
  for (let i = 0; i < N; i++) { nx[i] = -Math.sin(ang[i]); ny[i] = Math.cos(ang[i]); }

  const track = {
    seed, biomeKey, biome, pts, ang, curv, nx, ny, N, step,
    length: N * step, hw, runoff, wallT: WALL_T, clearance,
    hazards: [], decos: [],
  };

  placeHazards(track, rng, opts.hazardLevel || 0);
  placeDecos(track, rng);
  return track;
}

function cornerness(track, i, ahead) {
  let s = 0;
  for (let k = 0; k < ahead; k++) s += Math.abs(track.curv[(i + k) % track.N]);
  return s * track.step;
}

function placeHazards(track, rng, hazardLevel) {
  const { N, hw } = track;
  const used = [];
  const free = (i) => used.every((u) => Math.min(Math.abs(u - i), N - Math.abs(u - i)) > 35);
  const boosts = randInt(rng, 2, 4);
  for (let tries = 0, placed = 0; placed < boosts && tries < 300; tries++) {
    const i = randInt(rng, 40, N - 30);
    if (!free(i) || cornerness(track, i, 25) > 0.5) continue;
    used.push(i);
    placed++;
    track.hazards.push({ type: 'boost', idx: i, lat: randRange(rng, -0.45, 0.45) * hw, r: 26 });
  }
  const oils = randInt(rng, 0, 1) + hazardLevel;
  for (let tries = 0, placed = 0; placed < oils && tries < 300; tries++) {
    const i = randInt(rng, 60, N - 30);
    if (!free(i)) continue;
    used.push(i);
    placed++;
    track.hazards.push({ type: 'oil', idx: i, lat: randRange(rng, -0.55, 0.55) * hw, r: 30 });
  }
  for (const h of track.hazards) {
    h.x = track.pts[h.idx].x + track.nx[h.idx] * h.lat;
    h.y = track.pts[h.idx].y + track.ny[h.idx] * h.lat;
    h.ang = track.ang[h.idx];
  }
}

function trackBounds(track, pad) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of track.pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const m = track.clearance + pad;
  return { minX: minX - m, minY: minY - m, maxX: maxX + m, maxY: maxY + m };
}

function placeDecos(track, rng) {
  const b = trackBounds(track, 260);
  track.bounds = b;
  const area = (b.maxX - b.minX) * (b.maxY - b.minY);
  const count = Math.floor(area / 26000);
  const minD = track.clearance + 40;
  for (let k = 0; k < count; k++) {
    const x = randRange(rng, b.minX, b.maxX), y = randRange(rng, b.minY, b.maxY);
    let ok = true;
    for (let i = 0; i < track.N; i += 3) {
      const p = track.pts[i];
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < minD * minD) { ok = false; break; }
    }
    if (ok) track.decos.push({ x, y, s: randRange(rng, 0.7, 1.4), r: rng() });
  }
  track.decos.sort((a, b2) => a.y - b2.y);
}

// Nearest centerline sample. Searches a window around `hint` (or everything).
function trackQuery(track, x, y, hint, windowSize) {
  const { N, pts } = track;
  let best = 0, bestD = Infinity;
  if (hint == null) {
    for (let i = 0; i < N; i++) {
      const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
  } else {
    const w = windowSize || 30;
    for (let k = -w; k <= w; k++) {
      const i = (hint + k + N) % N;
      const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
  }
  const p = pts[best];
  const dx = x - p.x, dy = y - p.y;
  const lat = dx * track.nx[best] + dy * track.ny[best];
  const along = dx * Math.cos(track.ang[best]) + dy * Math.sin(track.ang[best]);
  return { idx: best, lat, frac: clamp(along / track.step, -0.5, 0.5), dist: Math.sqrt(bestD) };
}

// ---------- Rendering (browser only) ----------

function tracePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function drawDeco(ctx, kind, d) {
  const s = d.s;
  ctx.save();
  ctx.translate(d.x, d.y);
  if (kind === 'tree') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.arc(8 * s, 8 * s, 24 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = d.r < 0.5 ? '#2f6b2a' : '#38792f';
    ctx.beginPath(); ctx.arc(0, 0, 24 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.arc(-7 * s, -7 * s, 12 * s, 0, TAU); ctx.fill();
  } else if (kind === 'pine') {
    ctx.fillStyle = 'rgba(40,60,80,0.15)';
    ctx.beginPath(); ctx.arc(7 * s, 7 * s, 20 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2d5a45';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.arc(0, 0, (20 - k * 6) * s, 0, TAU); ctx.fill();
      ctx.fillStyle = k === 0 ? '#3b6f57' : '#f4f8fb';
    }
  } else if (kind === 'cactus') {
    if (d.r < 0.55) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(5, 5, 14 * s, 10 * s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4f8a3c';
      ctx.beginPath(); ctx.arc(0, 0, 9 * s, 0, TAU); ctx.fill();
      ctx.fillRect(-16 * s, -4 * s, 32 * s, 8 * s);
    } else {
      ctx.fillStyle = '#a07a4d';
      ctx.beginPath(); ctx.ellipse(0, 0, 18 * s, 12 * s, d.r * 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b8915f';
      ctx.beginPath(); ctx.ellipse(-4 * s, -3 * s, 9 * s, 6 * s, d.r * 6, 0, TAU); ctx.fill();
    }
  } else if (kind === 'building') {
    const w = 50 * s, h = 40 * s + d.r * 30;
    ctx.fillStyle = '#0b0a14';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = d.r < 0.5 ? 'rgba(255,47,208,0.6)' : 'rgba(47,243,255,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(255,220,120,0.5)';
    for (let yy = -h / 2 + 6; yy < h / 2 - 6; yy += 10)
      for (let xx = -w / 2 + 6; xx < w / 2 - 6; xx += 10)
        if (Math.sin(xx * 12.9 + yy * 78.2 + d.r * 99) > 0.3) ctx.fillRect(xx, yy, 4, 4);
  }
  ctx.restore();
}

function renderTrack(track) {
  const b = track.bounds;
  const W = Math.ceil(b.maxX - b.minX), H = Math.ceil(b.maxY - b.minY);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const bio = track.biome;
  const rng = mulberry32(track.seed ^ 0x9e3779b9);
  ctx.translate(-b.minX, -b.minY);

  ctx.fillStyle = bio.bg;
  ctx.fillRect(b.minX, b.minY, W, H);
  ctx.fillStyle = bio.bgDots;
  for (let k = 0; k < (W * H) / 900; k++) {
    ctx.fillRect(b.minX + rng() * W, b.minY + rng() * H, 3 + rng() * 5, 3 + rng() * 5);
  }
  if (bio.night) {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 2;
    for (let x = Math.floor(b.minX / 160) * 160; x < b.maxX; x += 160) {
      ctx.beginPath(); ctx.moveTo(x, b.minY); ctx.lineTo(x, b.maxY); ctx.stroke();
    }
    for (let y = Math.floor(b.minY / 160) * 160; y < b.maxY; y += 160) {
      ctx.beginPath(); ctx.moveTo(b.minX, y); ctx.lineTo(b.maxX, y); ctx.stroke();
    }
  }
  for (const d of track.decos) drawDeco(ctx, bio.deco, d);

  const { hw, runoff, pts } = track;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  tracePath(ctx, pts);

  // Wall band, then runoff carves out the inside, leaving walls on both sides.
  if (bio.night) { ctx.shadowColor = bio.wall; ctx.shadowBlur = 25; }
  ctx.strokeStyle = bio.wall;
  ctx.lineWidth = 2 * (hw + runoff + WALL_T);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.setLineDash([40, 40]);
  ctx.strokeStyle = bio.wallStripe;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = bio.runoffColor;
  ctx.lineWidth = 2 * (hw + runoff);
  ctx.stroke();

  ctx.strokeStyle = bio.curbA;
  ctx.lineWidth = 2 * hw + 18;
  ctx.stroke();
  ctx.setLineDash([22, 22]);
  ctx.strokeStyle = bio.curbB;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = bio.asphalt;
  ctx.lineWidth = 2 * hw;
  ctx.stroke();

  // Asphalt grain.
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let i = 0; i < track.N; i++) {
    for (let k = 0; k < 3; k++) {
      const lat = (rng() * 2 - 1) * hw * 0.95;
      ctx.fillRect(pts[i].x + track.nx[i] * lat, pts[i].y + track.ny[i] * lat, 3, 3);
    }
  }

  ctx.setLineDash([30, 36]);
  ctx.strokeStyle = bio.line;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);

  // Start / finish checkerboard.
  ctx.save();
  ctx.translate(pts[0].x, pts[0].y);
  ctx.rotate(track.ang[0]);
  const cells = 12, cs = (2 * hw) / cells;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cells; c++) {
      ctx.fillStyle = (r + c) % 2 ? '#111' : '#f5f5f5';
      ctx.fillRect(-cs + r * cs, -hw + c * cs, cs, cs);
    }
  }
  ctx.restore();

  // Grid boxes.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  for (let g = 0; g < 8; g++) {
    const slot = gridSlot(track, g);
    ctx.save();
    ctx.translate(slot.x, slot.y);
    ctx.rotate(slot.ang);
    ctx.beginPath();
    ctx.moveTo(22, -16); ctx.lineTo(28, -16); ctx.lineTo(28, 16); ctx.lineTo(22, 16);
    ctx.stroke();
    ctx.restore();
  }

  track.canvas = canvas;
  track.ctx = ctx; // skid marks are painted straight onto the track
  buildMinimap(track);
}

function gridSlot(track, g) {
  const row = Math.floor(g / 2);
  const side = g % 2 ? 1 : -1;
  const idx = (track.N - 5 - row * 6 - (g % 2) * 3 + track.N) % track.N;
  const lat = side * track.hw * 0.42;
  return {
    idx,
    x: track.pts[idx].x + track.nx[idx] * lat,
    y: track.pts[idx].y + track.ny[idx] * lat,
    ang: track.ang[idx],
  };
}

function buildMinimap(track) {
  const size = 180;
  const b = track.bounds;
  const sc = (size - 20) / Math.max(b.maxX - b.minX, b.maxY - b.minY);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const ox = (size - (b.maxX - b.minX) * sc) / 2, oy = (size - (b.maxY - b.minY) * sc) / 2;
  const map = (p) => ({ x: ox + (p.x - b.minX) * sc, y: oy + (p.y - b.minY) * sc });
  ctx.lineJoin = 'round';
  ctx.beginPath();
  track.pts.forEach((p, i) => {
    const m = map(p);
    i ? ctx.lineTo(m.x, m.y) : ctx.moveTo(m.x, m.y);
  });
  ctx.closePath();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  ctx.stroke();
  const s = map(track.pts[0]);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
  track.minimap = { canvas: c, map, size };
}
