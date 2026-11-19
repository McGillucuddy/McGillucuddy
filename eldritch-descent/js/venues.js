// ============================================================
//  ELDRITCH DESCENT — places in old Brinehollow
//  Every fight happens somewhere in the drowned city: a quay, an alley,
//  a street the city built over, a flooded nave. Each boss keeps a lair.
//  paint() draws the static backdrop once; back()/front() animate it.
// ============================================================
'use strict';

const VR = Math.round;
function vRect(c, x, y, w, h, col) { if (col) c.fillStyle = col; c.fillRect(VR(x), VR(y), Math.max(1, VR(w)), Math.max(1, VR(h))); }
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
// vertical gradient through several colours, ordered-dithered so it stays pixel art
function vSky(c, y0, y1, cols) {
  const hh = y1 - y0, img = c.getImageData(0, y0, W, hh), d = img.data, rgb = cols.map(hexRGB), n = cols.length - 1;
  for (let y = 0; y < hh; y++) {
    const k = y / Math.max(1, hh - 1) * n, i = Math.min(n - 1, Math.floor(k)), f = k - i;
    for (let x = 0; x < W; x++) { const q = f > BAYER4[(y % 4) * 4 + (x % 4)] ? rgb[i + 1] : rgb[i], o = (y * W + x) * 4; d[o] = q[0]; d[o + 1] = q[1]; d[o + 2] = q[2]; d[o + 3] = 255; }
  }
  c.putImageData(img, 0, y0);
}
function vLine(c, x0, y0, x1, y1, col, w = 1) {
  c.fillStyle = col; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i++) c.fillRect(VR(x0 + (x1 - x0) * i / (n || 1)), VR(y0 + (y1 - y0) * i / (n || 1)), w, w);
}
function vMoon(c, x, y, r) {
  for (let k = 3; k >= 1; k--) { c.fillStyle = `rgba(190,205,190,${0.05 * k})`; c.beginPath(); c.arc(x, y, r + (4 - k) * 5, 0, TAU); c.fill(); }
  c.fillStyle = '#c8cfc0'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.fillStyle = '#a8b0a2'; for (const [dx, dy, rr] of [[-3, -2, 3], [4, 3, 2], [1, -5, 1.5]]) { c.beginPath(); c.arc(x + dx, y + dy, rr, 0, TAU); c.fill(); }
}
// a row of rooftops: gables, chimneys, the odd spire, a few lit windows
function vRoofs(c, rng, base, o) {
  let x = -rng() * 20;
  while (x < W + 10) {
    const w = VR(o.wMin + rng() * (o.wMax - o.wMin)), h = VR(o.hMin + rng() * (o.hMax - o.hMin)), lean = (rng() - 0.5) * (o.lean || 0);
    const top = base - h, roof = rng() < (o.flat ?? 0.15) ? 0 : VR(w * (0.35 + rng() * 0.3)), spire = rng() < (o.spire || 0), sp = spire ? VR(h * 0.9) : 0;
    c.fillStyle = o.col;
    for (let y = top - roof - sp; y < base; y++) {
      let l, r;
      if (y < top - roof) { const hw = Math.max(0.5, (y - (top - roof - sp)) / sp * 3); l = x + w / 2 - hw + lean; r = x + w / 2 + hw + lean; }
      else if (y < top) { const rk = (y - (top - roof)) / roof; l = x + w / 2 - rk * (w / 2 + 2) + lean; r = x + w / 2 + rk * (w / 2 + 2) + lean; }
      else { const k = (y - top) / h; l = x + lean * (1 - k); r = x + w + lean * (1 - k); }
      c.fillRect(VR(l), y, Math.max(1, VR(r) - VR(l)), 1);
    }
    if (roof && rng() < 0.5) { const cx = x + w * (0.2 + rng() * 0.5) + lean, ch = 4 + rng() * 6; vRect(c, cx, top - roof * 0.55 - ch, 3, ch + 2, o.col); vRect(c, cx - 1, top - roof * 0.55 - ch, 5, 1); }
    if (o.win) for (let wy = top + 4; wy < base - 5; wy += 9) for (let wx = x + 3; wx < x + w - 4; wx += 7) if (rng() < o.winP) vRect(c, wx + lean * (1 - (wy - top) / h), wy, 2, 3, rng() < 0.6 ? o.win : (o.win2 || o.win));
    x += w + (rng() < 0.3 ? rng() * 6 : -1);
  }
}
// a timber-framed house front, upper storeys jutting out over the street
function vFacade(c, rng, x, w, base, floors, o) {
  let y = base; const fh = o.fh || 26;
  for (let f = 0; f < floors; f++) {
    const jut = f * 3, x0 = x - jut, ww = w + jut * 2, top = y - fh;
    vRect(c, x0, top, ww, fh, o.wall);
    for (let i = 0; i < ww * fh / 28; i++) vRect(c, x0 + rng() * ww, top + rng() * fh, 1 + rng() * 3, 1, rng() < 0.6 ? o.grime : o.wallHi);
    c.fillStyle = o.beam; vRect(c, x0, top, ww, 2); vRect(c, x0, y - 2, ww, 2); vRect(c, x0 - 1, y - 1, ww + 2, 1, '#05070a');
    for (let bx = x0; bx <= x0 + ww - 2; bx += 12) vRect(c, bx, top, 2, fh, o.beam);
    vRect(c, x0 + ww - 2, top, 2, fh, o.beam);
    if (rng() < 0.6 && ww > 26) { const bx = x0 + 12 * Math.floor(rng() * Math.max(1, (ww - 14) / 12)); for (let i = 0; i < 10; i++) vRect(c, bx + 2 + i, y - 4 - i * (fh - 6) / 10, 2, 2, o.beam); }
    for (let wx = x0 + 4; wx < x0 + ww - 8; wx += 12) {
      if (f === 0 && Math.abs(wx + 3 - (x + w / 2)) < 10) continue;
      if (rng() < 0.3) continue;
      const lit = rng() < (o.litP ?? 0.3);
      vRect(c, wx, top + 7, 6, 10, '#05070a');
      vRect(c, wx + 1, top + 8, 4, 8, lit ? o.lit : (o.boarded ? o.beam : o.glass));
      if (o.boarded && !lit) { vRect(c, wx, top + 10, 6, 1, '#05070a'); vRect(c, wx, top + 13, 6, 1, '#05070a'); }
      else { vRect(c, wx + 3, top + 8, 1, 8, '#05070a'); vRect(c, wx + 1, top + 11, 4, 1, '#05070a'); }
      if (rng() < 0.4) vRect(c, wx - 2, top + 7, 2, 10, o.beam);
      if (lit && o.lights) o.lights.push({ x: wx + 3, y: top + 12, col: '#e6aa50', r: 18, a: 0.16, win: true });
    }
    y = top;
  }
  const dx = x + w / 2 - 5;
  vRect(c, dx - 1, base - 19, 12, 19, o.beam); vRect(c, dx, base - 18, 10, 18, o.door || '#1a120c');
  if (o.bricked) for (let by = base - 17; by < base; by += 3) for (let bx = dx + ((by / 3) % 2 ? 0 : 2); bx < dx + 9; bx += 4) vRect(c, bx, by, 3, 2, o.wallHi);
  else vRect(c, dx + 7, base - 9, 1, 1, '#8a7a50');
  const top = y, ww = w + (floors - 1) * 6, x0 = x - (floors - 1) * 3, rh = o.roofH || VR(ww * 0.42);
  c.fillStyle = o.roof;
  for (let i = 0; i < rh; i++) { const k = i / rh; c.fillRect(VR(x0 - 3 + k * (ww / 2 + 3)), top - i, Math.max(1, VR((1 - k) * (ww + 6))), 1); }
  return { top, x0, ww };
}
function vSign(c, x, y, icon, o) {
  vRect(c, x - 1, y - 2, 14, 1, '#141210'); vRect(c, x + 1, y - 1, 1, 3, '#141210'); vRect(c, x + 10, y - 1, 1, 3, '#141210');
  vRect(c, x - 1, y + 2, 14, 10, '#0c0a08'); vRect(c, x, y + 3, 12, 8, o || '#4a3a26');
  c.fillStyle = '#b8a070';
  if (icon === 'fish') { vRect(c, x + 2, y + 6, 6, 2); vRect(c, x + 3, y + 5, 4, 4); vRect(c, x + 8, y + 5, 1, 4); vRect(c, x + 9, y + 4, 1, 6); }
  if (icon === 'anchor') { vRect(c, x + 5, y + 4, 2, 6); vRect(c, x + 3, y + 5, 6, 1); vRect(c, x + 3, y + 9, 1, 1); vRect(c, x + 8, y + 9, 1, 1); vRect(c, x + 4, y + 10, 4, 1); }
  if (icon === 'key') { vRect(c, x + 2, y + 5, 3, 3); vRect(c, x + 5, y + 6, 5, 1); vRect(c, x + 8, y + 7, 1, 2); }
  if (icon === 'mask') { vRect(c, x + 3, y + 4, 6, 6); vRect(c, x + 4, y + 6, 1, 1, '#0c0a08'); vRect(c, x + 7, y + 6, 1, 1, '#0c0a08'); }
}
function vLamp(c, x, base, top, lights, col = '#e0b860') {
  vRect(c, x - 2, base - 3, 5, 3, '#141618'); vRect(c, x, top, 2, base - top, '#1c1f22'); vRect(c, x - 1, top + 6, 4, 1, '#1c1f22');
  vRect(c, x - 4, top - 1, 9, 1, '#1c1f22'); vRect(c, x - 3, top - 8, 7, 7, '#141618'); vRect(c, x - 2, top - 7, 5, 5, col); vRect(c, x - 3, top - 10, 7, 2, '#1c1f22');
  lights.push({ x: x + 0.5, y: top - 4, col, r: 46, a: 0.2, lamp: true });
}
function vCobbles(c, rng, y0, o) {
  let y = y0;
  while (y < H) {
    const k = (y - y0) / (H - y0), h = VR(3 + k * 5), sw = 6 + k * 11; let x = -rng() * sw;
    vRect(c, 0, y, W, h, o.seam);
    while (x < W) { const w = sw * (0.7 + rng() * 0.6); vRect(c, x + 1, y + 1, w - 1, h - 1, rng() < 0.5 ? o.a : o.b); if (rng() < 0.35) vRect(c, x + 2, y + 1, Math.max(1, w * 0.4), 1, o.hi); x += w; }
    y += h;
  }
  vRect(c, 0, y0, W, 2, 'rgba(0,0,0,0.5)');
}
function vPlanks(c, rng, y0, o) {
  let y = y0;
  while (y < H) {
    const k = (y - y0) / (H - y0), h = VR(3 + k * 6);
    vRect(c, 0, y, W, h, rng() < 0.5 ? o.a : o.b); vRect(c, 0, y + h - 1, W, 1, o.seam);
    let x = -rng() * 80; while (x < W) { vRect(c, x, y, 1, h - 1, o.seam); if (rng() < 0.6) vRect(c, x + 3, y + 1, 1, 1, o.nail); x += 40 + rng() * 70; }
    if (rng() < 0.4) vRect(c, rng() * W, y + 1, 6 + rng() * 20, 1, o.hi);
    y += h;
  }
  vRect(c, 0, y0, W, 2, 'rgba(0,0,0,0.5)');
}
function vPuddle(c, x, y, w, col = 'rgba(8,14,18,0.7)') {
  c.fillStyle = col; c.beginPath(); c.ellipse(x, y, w, w * 0.18, 0, 0, TAU); c.fill();
  vRect(c, x - w * 0.4, y - 1, w * 0.35, 1, 'rgba(120,150,150,0.35)');
}
// shallow water lying over the floor
function vFlood(c, y0, col, rng) {
  c.fillStyle = col; c.fillRect(0, y0, W, H - y0);
  for (let i = 0; i < 70; i++) { const y = y0 + 3 + rng() * (H - y0 - 3), k = (y - y0) / (H - y0); vRect(c, rng() * W, y, 4 + k * 22 * rng(), 1, `rgba(140,180,170,${0.06 + 0.1 * rng()})`); }
  vRect(c, 0, y0, W, 1, 'rgba(150,190,180,0.35)');
}
function vRain(ctx, st, t, n, slant, col, dt) {
  if (!st.rain) st.rain = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 220 + Math.random() * 120 }));
  ctx.fillStyle = col;
  for (const d of st.rain) {
    d.y += d.v * dt; d.x += slant * d.v * dt; if (d.y > H) { d.y = -6; d.x = Math.random() * (W + 60) - 30; }
    for (let i = 0; i < 4; i++) ctx.fillRect(VR(d.x - slant * i * 1.5), VR(d.y - i * 1.5), 1, 1);
  }
}
function vRipples(ctx, st, t, y0, n, col) {
  if (!st.rip) st.rip = Array.from({ length: n }, () => ({ x: Math.random() * W, y: y0 + Math.random() * (H - y0), p: Math.random() }));
  ctx.fillStyle = col;
  for (const r of st.rip) {
    r.p += 0.012; if (r.p > 1) { r.p = 0; r.x = Math.random() * W; r.y = y0 + Math.random() * (H - y0); }
    const k = (r.y - y0) / (H - y0), rx = (2 + r.p * 10) * (0.6 + k), ry = rx * 0.25;
    if (r.p < 0.85) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.fillRect(VR(r.x + Math.cos(a) * rx), VR(r.y + Math.sin(a) * ry), 1, 1); }
  }
}
function vFog(ctx, t, y, h, a, speed = 6) {
  for (let i = 0; i < 6; i++) {
    const x = ((t * speed * (1 + i * 0.2) + i * 97) % (W + 160)) - 80, yy = y + Math.sin(i * 2.3) * h * 0.4;
    const g = ctx.createRadialGradient(x, yy, 0, x, yy, 70); g.addColorStop(0, `rgba(150,170,165,${a})`); g.addColorStop(1, 'rgba(150,170,165,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 70, yy - 70, 140, 140);
  }
}
function vLightning(ctx, st, t, dt, area) {
  st.lt = (st.lt ?? 3) - dt;
  if (st.lt <= 0) { st.flash = 0.35; st.lt = 4 + Math.random() * 6; st.bolt = Math.random() * W; }
  if (st.flash > 0) {
    st.flash -= dt;
    if (st.flash > 0.22 && area) { // the bolt itself, only inside the sky region
      ctx.save(); ctx.beginPath(); area(ctx); ctx.clip();
      let x = st.bolt, y = 0; ctx.fillStyle = '#e8f0ff';
      while (y < 150) { const nx = x + (Math.random() - 0.5) * 14, ny = y + 6 + Math.random() * 8; vLine(ctx, x, y, nx, ny, '#e8f0ff'); x = nx; y = ny; }
      ctx.restore();
    }
    return Math.max(0, st.flash / 0.35);
  }
  return 0;
}

// a round-headed opening into darkness
function vArch(c, cx, top, hw, bottom, col) {
  for (let y = top; y < bottom; y++) { const dy = top + hw - y, w = y < top + hw ? Math.sqrt(Math.max(0, hw * hw - dy * dy)) : hw; vRect(c, cx - w, y, w * 2, 1, col); }
}
// ---------------------------------------------------------------- the places
const VENUES = {
  // ------------------------------------------------ FLOOR 1: BRINEHOLLOW DOCKS
  quay: {
    name: 'The Harbour Quay', dark: 0.5,
    paint(c, rng, L) {
      vSky(c, 0, 132, ['#06090c', '#0c1418', '#17242a', '#22323a']);
      vMoon(c, 372, 34, 11);
      for (let i = 0; i < 5; i++) vRect(c, rng() * W, 20 + rng() * 50, 60 + rng() * 90, 2 + rng() * 3, 'rgba(10,16,20,0.7)');
      // ships at anchor: hulls, masts, yards, rigging
      for (const [sx, sw, mh] of [[30, 90, 96], [196, 120, 112], [330, 80, 84]]) {
        vRect(c, sx, 112, sw, 9, '#0a1014'); vRect(c, sx + 4, 121, sw - 10, 4, '#0a1014');
        vRect(c, sx + sw - 18, 106, 18, 6, '#0a1014');
        for (const mx of [sx + sw * 0.3, sx + sw * 0.62]) {
          vRect(c, mx, 112 - mh * (mx > sx + sw / 2 ? 0.85 : 1), 2, mh * (mx > sx + sw / 2 ? 0.85 : 1), '#0c1216');
          for (let k = 0; k < 3; k++) vRect(c, mx - 12 + k * 3, 112 - mh * (0.85 - k * 0.25), 26 - k * 6, 1, '#0c1216');
          vLine(c, mx, 112 - mh * 0.95, sx, 112, 'rgba(20,30,34,0.8)'); vLine(c, mx, 112 - mh * 0.95, sx + sw, 110, 'rgba(20,30,34,0.8)');
        }
      }
      vRoofs(c, rng, 124, { col: '#0d151a', wMin: 18, wMax: 40, hMin: 8, hMax: 22, flat: 0.4, win: '#a87838', winP: 0.08 });
      // black harbour water
      vRect(c, 0, 124, W, 16, '#081014');
      for (let i = 0; i < 40; i++) vRect(c, rng() * W, 126 + rng() * 13, 3 + rng() * 10, 1, 'rgba(60,90,96,0.5)');
      for (let i = 0; i < 7; i++) vRect(c, 368 + (rng() - 0.5) * 8, 126 + i * 2, 4 + rng() * 6, 1, 'rgba(200,210,190,0.45)');
      // quay wall, bollards, coiled rope
      for (let x = 0; x < W; x += 16) { vRect(c, x, 138, 15, 6, (x / 16) % 2 ? '#2a2e30' : '#25292b'); vRect(c, x, 144, 15, 6, (x / 16) % 2 ? '#212527' : '#2a2e30'); }
      vRect(c, 0, 137, W, 1, '#3c4246');
      for (const bx of [118, 296]) { vRect(c, bx, 130, 6, 10, '#141618'); vRect(c, bx - 1, 129, 8, 2, '#1e2224'); vRect(c, bx + 1, 131, 1, 6, '#2a2e30'); }
      c.fillStyle = '#5a4a32'; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(135, 146 - i, 8 - i, 2, 0, 0, TAU); c.fill(); }
      vPlanks(c, rng, 150, { a: '#3a2a1c', b: '#33251a', seam: '#160e08', nail: '#6a6058', hi: '#4a3828' });
      // crates and a barrel at the edges
      for (const [x, w, h] of [[6, 18, 16], [20, 14, 10], [452, 20, 18]]) { vRect(c, x, 152 - h, w, h, '#2e2014'); vRect(c, x, 152 - h, w, 1, '#4a3622'); vRect(c, x + 1, 152 - h + 1, 1, h - 2, '#1a120a'); vLine(c, x + 1, 151, x + w - 2, 152 - h + 1, '#1a120a'); }
      vRect(c, 436, 136, 12, 16, '#2a1c10'); vRect(c, 436, 140, 12, 1, '#151518'); vRect(c, 436, 147, 12, 1, '#151518');
      vLamp(c, 70, 151, 98, L); vLamp(c, 408, 151, 98, L);
    },
    back(ctx, t, st) { ctx.fillStyle = 'rgba(80,110,116,0.5)'; for (let i = 0; i < 10; i++) ctx.fillRect(VR(((t * 8 + i * 53) % W)), 127 + (i * 5) % 12, 3 + (i % 3) * 2, 1); },
    front(ctx, t) { vFog(ctx, t, 150, 40, 0.06); },
  },
  alley: {
    name: "Net-Maker's Row", dark: 0.55,
    paint(c, rng, L) {
      vSky(c, 0, 70, ['#05070a', '#0b1116', '#131c22']);
      // the far end of the alley: smaller houses, an arch through to the harbour
      vRoofs(c, rng, 132, { col: '#10171c', wMin: 20, wMax: 34, hMin: 40, hMax: 70, lean: 6, win: '#b07a38', win2: '#6a5030', winP: 0.12 });
      vRect(c, 222, 96, 36, 46, '#05070a'); for (let i = 0; i < 18; i++) vRect(c, 240 - Math.sqrt(324 - (18 - i) ** 2), 96 - i * 0.6 + 6, Math.sqrt(324 - (18 - i) ** 2) * 2, 1, '#05070a');
      vRect(c, 226, 122, 28, 20, '#0c1a1c'); for (let i = 0; i < 4; i++) vRect(c, 230 + i * 6, 126 + (i % 2) * 5, 4, 1, '#22383c');
      const o = { wall: '#2e2a24', wallHi: '#3e3830', grime: '#221e1a', beam: '#1a120c', glass: '#0e1418', lit: '#c8904a', roof: '#16161a', lights: L, litP: 0.35 };
      vFacade(c, rng, -14, 70, 152, 4, Object.assign({}, o, { fh: 30 }));
      vFacade(c, rng, 60, 54, 150, 3, Object.assign({}, o, { fh: 28, wall: '#2a2620' }));
      vFacade(c, rng, 368, 56, 150, 3, Object.assign({}, o, { fh: 28, wall: '#2c2822' }));
      vFacade(c, rng, 426, 70, 152, 4, Object.assign({}, o, { fh: 30 }));
      // nets and washing strung across the alley
      for (const [y, x0, x1] of [[34, 30, 450], [58, 70, 410]]) {
        for (let x = x0; x < x1; x++) { const sag = Math.sin((x - x0) / (x1 - x0) * Math.PI) * 10; c.fillStyle = '#3a3428'; c.fillRect(x, VR(y + sag), 1, 1); }
        for (let i = 0; i < 7; i++) { const x = x0 + 20 + rng() * (x1 - x0 - 40), sag = Math.sin((x - x0) / (x1 - x0) * Math.PI) * 10, h = 6 + rng() * 10; vRect(c, x, y + sag + 1, 5 + rng() * 6, h, rng() < 0.5 ? '#3a3a36' : '#2a3430'); }
      }
      vSign(c, 118, 92, 'fish'); vSign(c, 350, 96, 'anchor', '#3a2e22');
      vCobbles(c, rng, 150, { a: '#33363a', b: '#2c2f33', seam: '#141618', hi: '#44484c' });
      vPuddle(c, 190, 178, 22); vPuddle(c, 420, 230, 30); vPuddle(c, 70, 250, 26);
      // a lantern hung on a bracket over the street
      vRect(c, 236, 70, 1, 12, '#141210'); vRect(c, 233, 82, 7, 8, '#141210'); vRect(c, 234, 83, 5, 6, '#d8a048');
      L.push({ x: 236.5, y: 86, col: '#e0a050', r: 46, a: 0.11, lamp: true });
    },
    back(ctx, t) { if (Math.sin(t * 0.7) > 0.96) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(16, 108, 8, 10); } const p = (t * 0.8) % 1; ctx.fillStyle = 'rgba(150,180,180,0.6)'; ctx.fillRect(124, VR(104 + p * 46), 1, 2); },
    front(ctx, t) { vFog(ctx, t, 140, 30, 0.04, 4); },
  },
  // the Tide Patriarch's lair
  chapel: {
    name: 'The Drowned Chapel', dark: 0.5, lair: true,
    paint(c, rng, L) {
      for (let y = 0; y < 152; y += 10) for (let x = -((y / 10) % 2) * 11; x < W; x += 22) { vRect(c, x + 1, y + 1, 21, 9, rng() < 0.5 ? '#1c2224' : '#171c1e'); vRect(c, x + 1, y + 9, 21, 1, 'rgba(0,0,0,0.4)'); if (rng() < 0.12) vRect(c, x + 3, y + 3, 5 + rng() * 8, 1, '#26302e'); }
      // tall lancet windows of broken stained glass
      const glass = ['#1f4a4a', '#2a5a48', '#1a3448', '#3a5a3a', '#284040'];
      for (const [wx, ww, top] of [[96, 34, 26], [240, 44, 12], [384, 34, 26]]) {
        const win = (y) => { const k = (y - top) / 22; return y < top + 22 ? ww / 2 * Math.sqrt(Math.max(0, 1 - (1 - k) ** 2)) : ww / 2; };
        for (let y = top - 2; y < 124; y++) { const hw = win(y + 2) + 3; vRect(c, wx - hw, y, hw * 2, 1, '#0c1012'); }
        for (let y = top; y < 122; y++) {
          const hw = win(y);
          for (let x = -hw; x < hw; x += 4) { const pane = ((Math.floor((y - top) / 7) * 7 + Math.floor((x + 40) / 4)) * 2654435761 >>> 0) % 100; c.fillStyle = pane < 12 ? '#06090a' : glass[pane % glass.length]; c.fillRect(VR(wx + x), y, 4, 1); }
        }
        for (let y = top + 6; y < 122; y += 7) vRect(c, wx - win(y), y, win(y) * 2, 1, '#0a0e0e');
        vRect(c, wx - 1, top, 2, 122 - top, '#0a0e0e');
        L.push({ x: wx, y: 70, col: '#4ab0a0', r: 70, a: 0.1, win: true });
      }
      // rafters, with nets and weed hanging from them
      vRect(c, 0, 0, W, 6, '#0c0a08'); vRect(c, 0, 6, W, 2, '#1e1610');
      for (const x of [40, 170, 310, 440]) { vRect(c, x, 0, 6, 14, '#0c0a08'); vLine(c, x + 3, 12, x - 26, 30, '#140f0a', 3); vLine(c, x + 3, 12, x + 32, 30, '#140f0a', 3); }
      for (let i = 0; i < 26; i++) { const x = rng() * W, h = 10 + rng() * 40; for (let y = 8; y < 8 + h; y += 2) vRect(c, x + Math.sin(y * 0.3 + i) * 1.5, y, 1, 2, rng() < 0.5 ? '#1c2614' : '#26301a'); }
      for (let x = 120; x < 380; x += 4) { const s1 = Math.sin((x - 120) / 260 * Math.PI) * 26; vRect(c, x, 8 + s1, 1, 1, '#3a3628'); vRect(c, x, 8 + s1 * 0.6, 1, 1, '#3a3628'); if (x % 12 === 0) vLine(c, x, 8 + s1 * 0.6, x + 2, 8 + s1, '#3a3628'); }
      // pews, rotting, half sunk
      for (let r = 0; r < 3; r++) for (const px0 of [24, 140]) { const y = 128 + r * 8, x0 = px0 + r * 4; vRect(c, x0, y - 9, 96 - r * 6, 3, '#24180e'); vRect(c, x0, y - 6, 96 - r * 6, 6, '#1a110a'); vRect(c, x0 + 3, y, 2, 4, '#140c06'); vRect(c, x0 + 88 - r * 6, y, 2, 4, '#140c06'); }
      // a throne of anchors and ship's ribs behind where he stands
      const tx = 360;
      for (let i = -3; i <= 3; i++) { const x = tx + i * 9; for (let y = 64; y < 150; y += 1) { const bow = Math.sin((y - 64) / 86 * Math.PI) * i * 2.4; vRect(c, x + bow, y, 3, 1, '#2a1e12'); } }
      vRect(c, tx - 34, 112, 68, 6, '#2e2214'); vRect(c, tx - 30, 118, 60, 32, '#1e160c');
      vRect(c, tx - 2, 50, 4, 30, '#2a3032'); vRect(c, tx - 10, 54, 20, 3, '#2a3032'); c.fillStyle = '#2a3032'; c.beginPath(); c.arc(tx, 80, 12, 0, Math.PI); c.lineWidth = 3; c.strokeStyle = '#2a3032'; c.stroke(); vRect(c, tx - 4, 44, 8, 6, '#2a3032');
      vRect(c, tx - 13, 80, 3, 3, '#3a4446'); vRect(c, tx + 10, 80, 3, 3, '#3a4446');
      // candles on the altar step
      for (const cx of [tx - 28, tx - 20, tx + 20, tx + 27]) { vRect(c, cx, 106, 2, 6, '#b8b098'); L.push({ x: cx + 1, y: 104, col: '#f0c060', r: 26, a: 0.18, flame: true }); }
      // flagstones under shallow seawater
      vCobbles(c, rng, 150, { a: '#2a3030', b: '#242a2a', seam: '#101414', hi: '#38403e' });
      vFlood(c, 150, 'rgba(10,40,40,0.5)', rng);
      for (const wx of [96, 240, 384]) for (let i = 0; i < 9; i++) vRect(c, wx - 10 + rng() * 20, 156 + i * 11, 4 + rng() * 10, 1, 'rgba(90,170,150,0.3)');
    },
    back(ctx, t) {
      for (const [wx, w] of [[96, 26], [240, 34], [384, 26]]) {
        const a = 0.05 + 0.025 * Math.sin(t * 1.3 + wx);
        ctx.fillStyle = `rgba(90,190,170,${a})`; ctx.beginPath(); ctx.moveTo(wx - w / 2, 120); ctx.lineTo(wx + w / 2, 120); ctx.lineTo(wx + w * 1.6 + 30, 230); ctx.lineTo(wx - w * 0.4 + 30, 230); ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 4; i++) { const p = (t * 0.5 + i * 0.27) % 1, x = 60 + i * 117; ctx.fillStyle = `rgba(150,190,180,${0.7 * (1 - p)})`; ctx.fillRect(x, VR(30 + p * 120), 1, 2); }
    },
    front(ctx, t, st) { vRipples(ctx, st, t, 152, 10, 'rgba(140,190,180,0.35)'); },
  },
  // ------------------------------------------------ FLOOR 2: THE HOLLOW OSSUARY
  buried: {
    name: 'The Buried Street', dark: 0.6,
    paint(c, rng, L) {
      vRect(c, 0, 0, W, 152, '#08080a');
      // an old street the city built over: house fronts under a ceiling of rock and roots
      const o = { wall: '#2a2626', wallHi: '#3a3434', grime: '#1c1a1a', beam: '#16100c', glass: '#0a0a0c', lit: '#9a7aa8', roof: '#141214', litP: 0.06, boarded: true, bricked: true, lights: L };
      vFacade(c, rng, 8, 60, 150, 3, Object.assign({}, o, { fh: 26 }));
      vFacade(c, rng, 96, 48, 150, 3, Object.assign({}, o, { fh: 24, wall: '#262224' }));
      vFacade(c, rng, 190, 64, 150, 2, Object.assign({}, o, { fh: 28 }));
      vFacade(c, rng, 300, 52, 150, 3, Object.assign({}, o, { fh: 25, wall: '#282426' }));
      vFacade(c, rng, 392, 70, 150, 3, Object.assign({}, o, { fh: 27 }));
      // the cave roof pressing down onto the rooftops
      for (let x = 0; x < W; x++) { const h = 26 + Math.sin(x * 0.05) * 8 + Math.sin(x * 0.17 + 2) * 4 + rng() * 3; vRect(c, x, 0, 1, h, x % 7 < 3 ? '#151316' : '#121014'); vRect(c, x, h, 1, 1, '#221e22'); }
      for (let i = 0; i < 14; i++) { const x = rng() * W, h = 6 + rng() * 22; for (let y = 0; y < h; y++) vRect(c, x - (h - y) / h * 2, 28 + y, Math.max(1, (h - y) / h * 4), 1, '#121014'); }
      for (let i = 0; i < 22; i++) { let x = rng() * W, y = 24; const len = 20 + rng() * 60; for (let j = 0; j < len; j++) { x += (rng() - 0.5) * 1.6; y += 1; vRect(c, x, y, 1, 1, '#2a2018'); } }
      // bones heaped against the walls
      for (let i = 0; i < 60; i++) { const x = rng() * W, y = 140 + rng() * 10; if (rng() < 0.3) { vRect(c, x, y, 4, 3, '#8a8478'); vRect(c, x + 1, y + 1, 1, 1, '#141214'); vRect(c, x + 2, y + 1, 1, 1, '#141214'); } else vRect(c, x, y, 5 + rng() * 5, 1, '#6a6458'); }
      // candles someone keeps lit
      for (const [cx, cy] of [[40, 146], [158, 147], [276, 146], [454, 147]]) { vRect(c, cx, cy - 5, 2, 5, '#b8b098'); vRect(c, cx + 3, cy - 3, 2, 3, '#a8a088'); L.push({ x: cx + 1, y: cy - 7, col: '#e8c070', r: 30, a: 0.18, flame: true }); }
      // a dead street lamp
      vRect(c, 352, 92, 2, 58, '#141416'); vRect(c, 348, 86, 10, 7, '#0e0e10'); vRect(c, 350, 88, 6, 4, '#1e1e22');
      vCobbles(c, rng, 150, { a: '#2a2a2e', b: '#252428', seam: '#101012', hi: '#38383c' });
      for (let i = 0; i < 30; i++) vRect(c, rng() * W, 152 + rng() * 110, 3 + rng() * 6, 1, 'rgba(120,110,100,0.25)');
    },
    back(ctx, t) { const p = (t * 0.25) % 1; ctx.fillStyle = `rgba(140,130,120,${0.6 * (1 - p)})`; ctx.fillRect(VR(120 + Math.sin(t) * 2), VR(34 + p * 110), 1, 1); ctx.fillRect(VR(330 + Math.sin(t * 1.3) * 2), VR(30 + ((p + 0.5) % 1) * 110), 1, 1); },
    front(ctx, t) { vFog(ctx, t, 160, 30, 0.035, 3); },
  },
  catacomb: {
    name: 'The Bone Galleries', dark: 0.6,
    paint(c, rng, L) {
      vRect(c, 0, 0, W, 152, '#0a090a');
      // walls built of the dead: rows of skulls between courses of stacked long bones
      for (let y = 4; y < 150; y += 10) {
        const skullRow = (y / 10) % 2 === 0;
        for (let x = (y % 20 ? 0 : 5) - 3; x < W; x += skullRow ? 10 : 4) {
          const r = rng();
          if (skullRow) {
            if (r < 0.08) { vRect(c, x, y, 8, 7, '#060506'); continue; }
            const col = r < 0.3 ? '#4a4640' : r < 0.75 ? '#5a554e' : '#68625a';
            vRect(c, x, y + (r > 0.9 ? 1 : 0), 8, 7, col); vRect(c, x + 1, y + 2, 2, 2, '#080708'); vRect(c, x + 5, y + 2, 2, 2, '#080708'); vRect(c, x + 3, y + 5, 2, 1, '#1e1c1a'); vRect(c, x + 1, y, 5, 1, '#78726a');
          } else { vRect(c, x, y + 1, 3, 8, r < 0.3 ? '#38342e' : '#46423c'); vRect(c, x, y + 1, 3, 1, '#5a564e'); vRect(c, x, y + 8, 3, 1, '#5a564e'); }
        }
      }
      for (let y = 0; y < 152; y++) { const k = 1 - y / 152; vRect(c, 0, y, W, 1, `rgba(0,0,0,${0.15 + 0.4 * k})`); }
      // passages leading off into black, framed with stacked femurs
      for (const ax of [70, 240, 410]) {
        vArch(c, ax, 44, 33, 150, '#3a3630'); vArch(c, ax, 47, 30, 150, '#030304');
        for (let i = 0; i < 18; i++) { const a = Math.PI + i / 17 * Math.PI; vRect(c, ax + Math.cos(a) * 31.5 - 1, 77 + Math.sin(a) * 31.5 - 1, 3, 3, i % 2 ? '#6a645c' : '#56514a'); }
        vRect(c, ax - 20, 132, 40, 18, 'rgba(24,18,30,0.5)');
      }
      for (const [cx, cy] of [[150, 96], [330, 96]]) { vRect(c, cx - 6, cy, 14, 3, '#2a2420'); vRect(c, cx - 2, cy - 6, 2, 6, '#b8b098'); vRect(c, cx + 2, cy - 4, 2, 4, '#a8a088'); L.push({ x: cx, y: cy - 8, col: '#e8c070', r: 44, a: 0.2, flame: true }); }
      vCobbles(c, rng, 150, { a: '#2e2c2a', b: '#282624', seam: '#121110', hi: '#3c3a36' });
    },
    front(ctx, t) { vFog(ctx, t, 170, 30, 0.03, 3); },
  },
  // the Hollow King's lair
  playhouse: {
    name: 'The Old Playhouse', dark: 0.55, lair: true,
    paint(c, rng, L, st) {
      vSky(c, 0, 152, ['#0a0710', '#120c18', '#160f1c']);
      // the back of the stage: a wall of a hundred faces
      st.masks = [];
      for (let y = 30; y < 124; y += 13) for (let x = 40 + ((y / 13) % 2) * 6; x < 444; x += 12) {
        if (rng() < 0.22) continue;
        const tilt = (rng() - 0.5) * 2, dk = Math.min(1, Math.abs(x - 240) / 200 + Math.abs(y - 70) / 90), r = rng();
        const pale = dk > 0.8 ? '#3a3632' : dk > 0.55 ? (r < 0.5 ? '#5a564c' : '#4e4a42') : (r < 0.2 ? '#5e5a50' : r < 0.6 ? '#8a8478' : '#9e9888');
        x += VR((rng() - 0.5) * 3);
        vRect(c, x - 1, y - 1, 9, 11, '#08060a'); vRect(c, x, y, 7, 9, pale); vRect(c, x + 1, y + 9, 5, 1, pale); if (dk < 0.55) vRect(c, x, y, 7, 1, '#b8b2a2');
        vRect(c, x + 1 + (tilt > 0.6 ? 1 : 0), y + 3, 2, 2, '#0a060c'); vRect(c, x + 4, y + 3 + (tilt < -0.6 ? 1 : 0), 2, 2, '#0a060c');
        vRect(c, x + 2, y + 7, 3, 1, rng() < 0.3 ? '#3a1018' : '#2a2026');
        if (rng() < 0.15) vLine(c, x + 4, y, x + 2, y + 6, '#3a3434');
        st.masks.push([x, y]);
      }
      // an empty high-backed throne, centre stage
      vRect(c, 232, 86, 16, 58, '#0e0a10'); vRect(c, 228, 120, 24, 6, '#16101a'); vRect(c, 230, 126, 3, 18, '#0e0a10'); vRect(c, 247, 126, 3, 18, '#0e0a10');
      vRect(c, 234, 90, 12, 30, '#3a1a3e'); vRect(c, 230, 82, 4, 6, '#5a4a28'); vRect(c, 246, 82, 4, 6, '#5a4a28'); vRect(c, 238, 78, 4, 8, '#5a4a28');
      // proscenium: dull gilt frame, heavy curtains tied back
      vRect(c, 0, 0, W, 20, '#2a1e10'); vRect(c, 0, 18, W, 2, '#5a4a28'); vRect(c, 0, 0, W, 1, '#5a4a28');
      for (let x = 6; x < W; x += 12) vRect(c, x, 8, 3, 3, '#7a6432');
      vRect(c, 226, 2, 28, 16, '#1a1208'); vRect(c, 234, 5, 12, 10, '#c8c2b0'); vRect(c, 236, 8, 3, 2, '#1a1208'); vRect(c, 241, 8, 3, 2, '#1a1208');
      // heavy curtains, cinched at the middle and swept back to the sides
      const curtain = (x0, dir) => {
        for (let y = 20; y < 152; y++) {
          const k = Math.abs(y - 92) / 60, reach = 34 + 36 * Math.min(1, k * k), sag = y > 92 ? (y - 92) * 0.1 : 0;
          for (let x = 0; x < reach + sag; x++) {
            const fold = Math.sin(x * 0.5 + y * 0.02 * (x / 20)) * 0.5 + 0.5, edge = x > reach + sag - 2;
            c.fillStyle = edge ? '#14040a' : fold > 0.78 ? '#5a1820' : fold > 0.38 ? '#3e0e16' : '#24080c';
            c.fillRect(dir > 0 ? x0 + x : x0 - x, y, 1, 1);
          }
        }
        vRect(c, dir > 0 ? x0 + 28 : x0 - 36, 89, 9, 6, '#7a6432'); vRect(c, dir > 0 ? x0 + 31 : x0 - 33, 95, 3, 10, '#5a4a28');
      };
      curtain(0, 1); curtain(W - 1, -1);
      // valance
      for (let x = 0; x < W; x++) { const h = 6 + Math.abs(Math.sin(x * 0.13)) * 6; vRect(c, x, 20, 1, h, ((x / 9) | 0) % 2 ? '#4a1018' : '#3a0c14'); }
      // the stage itself
      vPlanks(c, rng, 150, { a: '#2a1e18', b: '#241a14', seam: '#0e0806', nail: '#4a3a30', hi: '#36281e' });
      vRect(c, 0, 258, W, 14, '#1a0e0a'); vRect(c, 0, 258, W, 1, '#5a4a28');
      // footlights: a row of violet flames along the lip of the stage
      st.foot = [];
      for (let x = 20; x < W; x += 40) { vRect(c, x - 4, 259, 9, 4, '#2a2010'); vRect(c, x - 3, 258, 7, 1, '#5a4a28'); st.foot.push(x); L.push({ x, y: 255, col: '#a070ff', r: 60, a: 0.16, flame: true, violet: true }); }
    },
    back(ctx, t, st) {
      // some of the masks are not empty
      for (let i = 0; i < st.masks.length; i++) {
        const blink = Math.sin(t * 0.9 + i * 7.31);
        if (blink > 0.985 || (i % 47 === 0 && blink > 0.55)) { const [x, y] = st.masks[i]; ctx.fillStyle = '#d0a0ff'; ctx.fillRect(x + 1, y + 3, 2, 2); ctx.fillRect(x + 4, y + 3, 2, 2); ctx.fillStyle = 'rgba(200,150,255,0.25)'; ctx.fillRect(x - 1, y + 2, 9, 4); }
      }
    },
    front(ctx, t, st) { for (const x of st.foot) { const f = Math.sin(t * 9 + x) > 0 ? 1 : 0; ctx.fillStyle = '#c8a0ff'; ctx.fillRect(x - 1, 253 - f, 3, 4 + f); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, 255, 1, 2); } },
  },
  // ------------------------------------------------ FLOOR 3: THE DROWNED SPIRE
  sunken: {
    name: 'The Sunken Street', dark: 0.6, rain: true,
    paint(c, rng, L) {
      vSky(c, 0, 140, ['#040706', '#0a1210', '#12201c', '#1a2c26']);
      for (let i = 0; i < 8; i++) vRect(c, rng() * W - 40, 8 + rng() * 60, 80 + rng() * 120, 3 + rng() * 5, 'rgba(4,8,7,0.6)');
      // the Spire itself, far off, one light burning at the top
      const sx = 300; for (let y = 10; y < 132; y++) { const hw = y < 40 ? (y - 10) / 30 * 5 : y < 60 ? 6 : 9; vRect(c, sx - hw, y, hw * 2, 1, '#0a1210'); }
      vRect(c, sx - 1, 36, 2, 3, '#7affc8'); L.push({ x: sx, y: 37, col: '#7affc8', r: 22, a: 0.2 });
      vRoofs(c, rng, 140, { col: '#0c1513', wMin: 20, wMax: 44, hMin: 18, hMax: 46, lean: 10, spire: 0.12, win: '#6a8a5a', winP: 0.03 });
      const o = { wall: '#22282a', wallHi: '#30383a', grime: '#161a1a', beam: '#121010', glass: '#081010', lit: '#a8c890', roof: '#0e1212', litP: 0.08, boarded: true, lights: L };
      vFacade(c, rng, -20, 74, 156, 3, Object.assign({}, o, { fh: 28 }));
      vFacade(c, rng, 420, 74, 156, 3, Object.assign({}, o, { fh: 28 }));
      // a boat that sank where the street used to be
      vRect(c, 150, 141, 46, 5, '#1c140c'); vRect(c, 154, 146, 38, 3, '#140e08'); vRect(c, 168, 120, 2, 22, '#1c140c'); vLine(c, 168, 121, 150, 141, '#2a2016');
      // a lamp post leaning out of the water, still lit
      for (let y = 96; y < 150; y++) vRect(c, 112 + (150 - y) * 0.18, y, 2, 1, '#1a1e1e');
      vRect(c, 118, 89, 7, 7, '#141618'); vRect(c, 119, 90, 5, 5, '#a8c890'); L.push({ x: 121.5, y: 92, col: '#a8c890', r: 44, a: 0.2, lamp: true });
      vCobbles(c, rng, 150, { a: '#262c2c', b: '#202626', seam: '#0e1212', hi: '#323a3a' });
      vFlood(c, 146, 'rgba(8,24,22,0.72)', rng);
    },
    back(ctx, t, st) { vRipples(ctx, st, t, 150, 18, 'rgba(140,180,170,0.35)'); },
    front(ctx, t, st, dt) {
      const f = vLightning(ctx, st, t, dt, k => k.rect(0, 0, W, 132));
      if (f) { ctx.fillStyle = `rgba(200,220,230,${0.12 * f})`; ctx.fillRect(0, 0, W, H); }
      vRain(ctx, st, t, 140, 0.18, 'rgba(150,180,180,0.4)', dt);
    },
  },
  nave: {
    name: 'The Flooded Nave', dark: 0.6, rain: true,
    paint(c, rng, L) {
      vRect(c, 0, 0, W, 152, '#0c1412');
      for (let y = 0; y < 152; y += 9) for (let x = -((y / 9) % 2) * 10; x < W; x += 20) { vRect(c, x + 1, y + 1, 19, 8, rng() < 0.5 ? '#14201c' : '#111a17'); if (rng() < 0.1) vRect(c, x + 3, y + 3, 6, 1, '#1e2e28'); }
      // a broken rose window, the storm showing through it
      const rx = 240, ry = 50, rr = 34;
      c.fillStyle = '#060a09'; c.beginPath(); c.arc(rx, ry, rr + 4, 0, TAU); c.fill();
      c.fillStyle = '#1a2a2c'; c.beginPath(); c.arc(rx, ry, rr, 0, TAU); c.fill();
      c.fillStyle = '#0a1414'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.arc(rx + Math.cos(a) * rr * 0.62, ry + Math.sin(a) * rr * 0.62, 7, 0, TAU); c.fill(); }
      c.fillStyle = '#2a5a48'; for (let i = 0; i < 12; i++) { if (i === 2 || i === 3 || i === 7) continue; const a = i / 12 * TAU; c.beginPath(); c.arc(rx + Math.cos(a) * rr * 0.62, ry + Math.sin(a) * rr * 0.62, 5, 0, TAU); c.fill(); }
      c.fillStyle = '#3a6a58'; c.beginPath(); c.arc(rx, ry, 9, 0, TAU); c.fill();
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; vLine(c, rx, ry, rx + Math.cos(a) * rr, ry + Math.sin(a) * rr, '#060a09'); }
      L.push({ x: rx, y: ry, col: '#6aa77f', r: 70, a: 0.12, win: true });
      // columns and the pointed arches between them
      for (const x of [40, 150, 330, 440]) {
        vRect(c, x - 9, 20, 18, 132, '#18241f'); vRect(c, x - 9, 20, 3, 132, '#22322b'); vRect(c, x + 6, 20, 3, 132, '#0e1612');
        vRect(c, x - 12, 18, 24, 5, '#22322b'); vRect(c, x - 12, 140, 24, 10, '#22322b');
      }
      for (const [a, b] of [[40, 150], [330, 440]]) { const m = (a + b) / 2, hw = (b - a) / 2; for (let x = a; x <= b; x++) { const k = Math.abs(x - m) / hw, y = 22 + (1 - Math.sqrt(1 - k * k * 0.95)) * 0 + k * k * 30; vRect(c, x, 20 + 34 - Math.sqrt(Math.max(0, 1 - k * k)) * 34, 1, 3, '#22322b'); } vRect(c, a + 10, 60, b - a - 20, 80, '#070c0a'); }
      // toppled pews and a hanging chain where a chandelier fell
      for (const [x, y, w] of [[60, 138, 70], [356, 136, 66]]) { vRect(c, x, y, w, 4, '#1e160c'); vRect(c, x + 4, y + 4, 3, 6, '#140e08'); vRect(c, x + w - 8, y - 6, 3, 6, '#140e08'); }
      for (let y = 0; y < 80; y += 3) vRect(c, 196 + Math.sin(y * 0.2), y, 2, 2, '#2a2e2e');
      vCobbles(c, rng, 150, { a: '#22302a', b: '#1c2822', seam: '#0c1210', hi: '#2c3e36' });
      vFlood(c, 150, 'rgba(8,26,22,0.65)', rng);
      for (let i = 0; i < 12; i++) vRect(c, 220 + rng() * 40, 156 + i * 9, 6 + rng() * 14, 1, 'rgba(110,180,140,0.3)');
    },
    back(ctx, t, st, dt) {
      // rain pouring through the broken window into the nave
      ctx.fillStyle = 'rgba(150,190,180,0.35)';
      for (let i = 0; i < 26; i++) { const x = 222 + (i * 37 % 36), y = ((t * 220 + i * 61) % 180) + 60; ctx.fillRect(x, VR(y), 1, 3); }
      vRipples(ctx, st, t, 150, 12, 'rgba(140,190,170,0.35)');
    },
    front(ctx, t, st, dt) { const f = vLightning(ctx, st, t, dt, k => { k.arc(240, 50, 34, 0, TAU); }); if (f) { ctx.fillStyle = `rgba(200,230,220,${0.1 * f})`; ctx.fillRect(0, 0, W, H); } },
  },
  // the Drowned God's lair: the top of the Spire, where the bell used to hang
  belfry: {
    name: 'The Belfry', dark: 0.55, lair: true, rain: true,
    paint(c, rng, L, st) {
      vRect(c, 0, 0, W, 152, '#0e1412');
      for (let y = 0; y < 152; y += 10) for (let x = -((y / 10) % 2) * 12; x < W; x += 24) { vRect(c, x + 1, y + 1, 23, 9, rng() < 0.5 ? '#18201d' : '#141b18'); if (rng() < 0.1) vRect(c, x + 3, y + 3, 7, 1, '#22302a'); }
      // great louvred openings onto the storm
      st.wins = [[78, 30, 64, 96], [338, 30, 64, 96]];
      for (const [x, y, w, h] of st.wins) {
        vRect(c, x - 4, y - 4, w + 8, h + 8, '#080c0a');
        vSkyRect(c, x, y, w, h);
        for (let ly = y + 6; ly < y + h; ly += 9) { if (rng() < 0.25) continue; vLine(c, x, ly, x + w, ly + 4, '#1a1410', 1); for (let k = 0; k < 3; k++) vRect(c, x, ly + 1 + k, w, 1, k ? 'rgba(20,14,10,0.0)' : '#2a1e14'); }
        vRect(c, x + w / 2 - 1, y, 2, h, '#120e0a');
      }
      // the bell frame: massive timbers, and an empty yoke where the bell hung
      const beam = '#2a1c10', beamHi = '#3a2818', beamLo = '#160e08';
      const timber = (x, y, w, h) => { vRect(c, x, y, w, h, beam); vRect(c, x, y, w, 1, beamHi); vRect(c, x, y + h - 1, w, 1, beamLo); for (let i = 0; i < w * h / 40; i++) vRect(c, x + rng() * w, y + 1 + rng() * (h - 2), 2 + rng() * 6, 1, beamLo); };
      timber(150, 0, 12, 152); timber(318, 0, 12, 152);
      timber(110, 24, 260, 12); timber(130, 112, 220, 8);
      for (const [x0, y0, x1, y1] of [[162, 36, 216, 112], [318, 36, 264, 112]]) vLine(c, x0, y0, x1, y1, beam, 5);
      // the yoke, its iron straps torn open
      timber(206, 36, 68, 10); vRect(c, 214, 46, 4, 18, '#2a2e30'); vRect(c, 262, 46, 4, 14, '#2a2e30'); vLine(c, 214, 64, 206, 72, '#2a2e30', 2); vLine(c, 266, 60, 276, 64, '#2a2e30', 2);
      vRect(c, 214, 46, 1, 18, '#4a3020'); vRect(c, 262, 46, 1, 14, '#4a3020');
      // a heap of smaller bells, cracked and green
      for (const [x, y, s] of [[28, 140, 10], [44, 144, 8], [16, 146, 7], [460, 142, 9]]) { for (let i = 0; i < s; i++) vRect(c, x - (s * 0.4 + i * 0.5), y - s + i, s * 0.8 + i, 1, i % 4 ? '#3e5a4a' : '#5a7a66'); vRect(c, x - s, y, s * 2, 2, '#22342a'); }
      // ropes hang from the frame; drawn live so they can sway
      st.ropes = [[188, 36, 118], [232, 46, 132], [292, 36, 110]];
      vPlanks(c, rng, 150, { a: '#2a1e14', b: '#241a10', seam: '#0e0806', nail: '#4a4038', hi: '#34261a' });
      vFlood(c, 150, 'rgba(8,24,22,0.45)', rng);
      vRect(c, 200, 190, 80, 20, 'rgba(0,0,0,0.25)'); vRect(c, 200, 190, 80, 1, '#3a2818');
      L.push({ x: 110, y: 78, col: '#9ad0c8', r: 70, a: 0.08, win: true }); L.push({ x: 370, y: 78, col: '#9ad0c8', r: 70, a: 0.08, win: true });
    },
    back(ctx, t, st, dt) {
      const f = vLightning(ctx, st, t, dt, k => { for (const [x, y, w, h] of st.wins) k.rect(x, y, w, h); });
      if (f) { ctx.fillStyle = `rgba(220,235,240,${0.55 * f})`; for (const [x, y, w, h] of st.wins) ctx.fillRect(x, y, w, h); }
      for (const [x, y0, len] of st.ropes) {
        const sw = Math.sin(t * 0.9 + x) * 6;
        for (let i = 0; i < len; i++) { const k = i / len, xx = x + sw * k * k; ctx.fillStyle = i % 4 ? '#5a4a30' : '#3a2e1e'; ctx.fillRect(VR(xx), y0 + i, 2, 1); }
        const ex = x + sw; ctx.fillStyle = '#5a1a1c'; ctx.fillRect(VR(ex) - 1, y0 + len - 18, 4, 4); ctx.fillStyle = '#c8b890'; ctx.fillRect(VR(ex) - 1, y0 + len - 14, 4, 3); ctx.fillStyle = '#5a1a1c'; ctx.fillRect(VR(ex) - 1, y0 + len - 11, 4, 4);
      }
      vRipples(ctx, st, t, 152, 10, 'rgba(140,190,180,0.3)');
      st.f = f;
    },
    front(ctx, t, st, dt) {
      if (!st.wr) st.wr = [];
      if (st.wr.length < 80) for (const [x, y, w, h] of st.wins) st.wr.push({ x: x + Math.random() * w, y: y + Math.random() * h, vx: (x < W / 2 ? 1 : -1) * (40 + Math.random() * 60), vy: 160 + Math.random() * 80, l: 0 });
      ctx.fillStyle = 'rgba(160,200,200,0.45)';
      st.wr = st.wr.filter(d => { d.x += d.vx * dt; d.y += d.vy * dt; d.l += dt; if (d.y < H && d.l < 1.2) { ctx.fillRect(VR(d.x), VR(d.y), 1, 2); return true; } return false; });
      if (st.f) { ctx.fillStyle = `rgba(200,225,230,${0.12 * st.f})`; ctx.fillRect(0, 0, W, H); }
    },
  },
};
function vSkyRect(c, x, y, w, h) {
  for (let yy = 0; yy < h; yy++) { const k = yy / h; c.fillStyle = k < 0.5 ? '#0c1618' : '#14222a'; c.fillRect(x, y + yy, w, 1); }
  for (let i = 0; i < 6; i++) vRect(c, x + Math.random() * w * 0.7, y + Math.random() * h, w * 0.3, 2, '#1c2c30');
}

// which place a fight happens in
const FLOOR_VENUES = [['quay', 'alley'], ['buried', 'catacomb'], ['sunken', 'nave']];
const LAIRS = { dagon: 'chapel', nyarlathotep: 'playhouse', cthulhu: 'belfry' };
function pickVenue(g) {
  if (g.combatKind === 'boss') return LAIRS[FLOORS[g.floor].boss] || FLOOR_VENUES[g.floor][0];
  const list = FLOOR_VENUES[g.floor] || FLOOR_VENUES[0];
  return list[((g.stats.nodes || 0) * 7 + (g.stats.fights || 0)) % list.length];
}
