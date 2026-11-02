'use strict';
// The route sheet drawn as a grubby prison document: aged paper with folds and coffee rings, a pencil sketch of
// the act's district underneath, pencil links between stops, your route in red marker, hand-drawn circles round
// the stops you can take. The stops themselves are HTML rubber stamps laid over this canvas.

const DISTRICTS = [
  { labels: ['CELL BLOCK C', 'THE YARD', 'PLATE PILLAR 9', 'LAUNDRY', 'SEWER LINE', 'GATE 4', 'SOLITARY'], feature: 'pillars' },
  { labels: ['FOUNDRY', 'STACK 12', 'COOLING TOWERS', 'TENEMENTS', 'RAIL YARD', 'SLAG HEAP', 'PUMP HOUSE'], feature: 'stacks' },
  { labels: ['THE TERRACES', 'AUREUM GARDENS', 'VILLA ROW', 'FOUNTAIN SQ.', 'SKY BRIDGE', 'GOLF CLUB', 'ORANGERY'], feature: 'gardens' },
  { labels: ['THE SPIRE', 'CROWN AVENUE', 'GRANDSTAND', 'MARBLE COURT', 'VIP BOXES', "WARDEN'S BALCONY", 'PRESS ROW'], feature: 'spire' },
];

const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';

const RouteSheet = {
  // Stop position on the sheet, in 0..1 of the map area (start at the bottom, boss at the top).
  pos(n) { return { x: 0.13 + n.col * 0.247, y: 0.95 - (n.row / MAP_ROWS) * 0.89 }; },

  draw(canvas, map, reach, curId) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);
    const rng = mulberry32(map.seed || 7);
    this.paper(g, W, H, rng);
    this.streets(g, W, H, rng);
    // Links: faint pencil for the routes, red marker for the way you came and the ways you can go next.
    const P = (n) => { const p = this.pos(n); return [p.x * W, p.y * H]; };
    for (const n of map.nodes) for (const t of n.next) {
      const m = mapNode(map, t);
      if (n.done && m.done) continue; // drawn in marker below
      if (n.id === curId && reach.includes(m.id)) continue; // drawn bold below
      this.pencil(g, P(n), P(m), rng);
    }
    for (const n of map.nodes) for (const t of n.next) {
      const m = mapNode(map, t);
      if (n.done && m.done) this.marker(g, P(n), P(m), rng);
    }
    // The leg you are about to take starts from where you are.
    if (curId != null) for (const t of reach) this.marker(g, P(mapNode(map, curId)), P(mapNode(map, t)), rng, true);
    for (const id of reach) { const [x, y] = P(mapNode(map, id)); this.circle(g, x, y, mapNode(map, id).type === 'boss' ? 52 : 42, rng); }
  },

  // Plain aged paper: light texture, one fold, one coffee ring tucked in a corner, soft edges.
  paper(g, W, H, rng) {
    g.fillStyle = '#ebe2c8';
    g.fillRect(0, 0, W, H);
    for (let k = 0; k < (W * H) / 140; k++) {
      g.fillStyle = rng() < 0.5 ? `rgba(120,90,50,${rng() * 0.04})` : `rgba(255,250,235,${rng() * 0.08})`;
      g.fillRect(rng() * W, rng() * H, 1 + rng() * 2, 1);
    }
    g.strokeStyle = 'rgba(90,70,40,0.1)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, H * 0.5); g.lineTo(W, H * 0.5 - 4); g.stroke();
    g.strokeStyle = 'rgba(255,255,245,0.3)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, H * 0.5 + 2); g.lineTo(W, H * 0.5 - 2); g.stroke();
    g.strokeStyle = 'rgba(120,70,30,0.14)'; g.lineWidth = 3;
    g.beginPath(); g.arc(W * 0.9, H * 0.93, 34, 0.4, 5.2); g.stroke();
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,60,25,0.22)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  },

  // Just a whisper of the district: a few faint streets, nothing under the stops.
  streets(g, W, H, rng) {
    g.strokeStyle = 'rgba(70,65,60,0.07)';
    g.lineWidth = 7;
    g.lineCap = 'round';
    for (const f of [0.02, 0.98]) { g.beginPath(); g.moveTo(f * W, 0); g.lineTo(f * W + (rng() - 0.5) * 20, H); g.stroke(); }
    for (const f of [0.18, 0.5, 0.82]) { g.beginPath(); g.moveTo(0, f * H); g.lineTo(W, f * H + (rng() - 0.5) * 20); g.stroke(); }
  },

  // A wobbly pencil sketch of the district: streets, hatched blocks, landmarks and handwritten labels.
  district(g, W, H, rng, d) {
    const wob = (pts, w, col) => {
      g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
      g.beginPath();
      pts.forEach(([x, y], i) => { const jx = x + (rng() - 0.5) * 2, jy = y + (rng() - 0.5) * 2; i ? g.lineTo(jx, jy) : g.moveTo(jx, jy); });
      g.stroke();
    };
    const pencil = 'rgba(70,65,60,0.28)';
    // Streets: a loose grid with a couple of diagonals.
    const xs = [0.08, 0.34, 0.66, 0.92].map((f) => f * W + (rng() - 0.5) * 20);
    const ys = [0.12, 0.38, 0.62, 0.86].map((f) => f * H + (rng() - 0.5) * 20);
    for (const x of xs) wob([[x, 0], [x + (rng() - 0.5) * 30, H * 0.5], [x + (rng() - 0.5) * 30, H]], 6, 'rgba(70,65,60,0.12)');
    for (const y of ys) wob([[0, y], [W * 0.5, y + (rng() - 0.5) * 30], [W, y + (rng() - 0.5) * 30]], 6, 'rgba(70,65,60,0.12)');
    // Hatched blocks between the streets.
    for (let i = 0; i < 9; i++) {
      const x = W * (0.1 + rng() * 0.75), y = H * (0.08 + rng() * 0.8), w = 30 + rng() * 60, h = 20 + rng() * 40;
      wob([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], 1, pencil);
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      g.strokeStyle = 'rgba(70,65,60,0.12)'; g.lineWidth = 1;
      for (let k = -h; k < w; k += 6) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); g.stroke(); }
      g.restore();
    }
    // Landmarks for the act.
    if (d.feature === 'pillars') {
      for (let k = 0; k < 6; k++) {
        const x = W * (0.08 + rng() * 0.84), y = H * (0.1 + rng() * 0.8), r = 8 + rng() * 6;
        g.strokeStyle = pencil; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(x - r * 0.7, y - r * 0.7); g.lineTo(x + r * 0.7, y + r * 0.7); g.moveTo(x + r * 0.7, y - r * 0.7); g.lineTo(x - r * 0.7, y + r * 0.7); g.stroke();
      }
      // Perimeter wall with barbed wire.
      const y = H * 0.97;
      wob([[0, y], [W, y]], 2, 'rgba(70,65,60,0.4)');
      g.strokeStyle = 'rgba(70,65,60,0.35)'; g.lineWidth = 1; g.beginPath();
      for (let x = 0; x < W; x += 8) { g.moveTo(x, y - 4); g.lineTo(x + 4, y + 4); g.moveTo(x + 4, y - 4); g.lineTo(x, y + 4); }
      g.stroke();
    } else if (d.feature === 'stacks') {
      for (let k = 0; k < 5; k++) {
        const x = W * (0.08 + rng() * 0.84), y = H * (0.1 + rng() * 0.8);
        g.strokeStyle = pencil; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(x, y - 7);
        for (let s = 1; s < 6; s++) g.quadraticCurveTo(x + (s % 2 ? 8 : -8), y - 7 - s * 5, x + (rng() - 0.5) * 4, y - 7 - s * 7);
        g.stroke();
      }
      // Rail line.
      const y = H * (0.3 + rng() * 0.4);
      wob([[0, y], [W, y - 20]], 1.5, 'rgba(70,65,60,0.35)');
      for (let x = 0; x < W; x += 10) { g.beginPath(); g.moveTo(x, y - (x / W) * 20 - 4); g.lineTo(x, y - (x / W) * 20 + 4); g.stroke(); }
    } else if (d.feature === 'gardens') {
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = 'rgba(70,65,60,0.25)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(rng() * W, 0);
        g.bezierCurveTo(rng() * W, H * 0.3, rng() * W, H * 0.7, rng() * W, H); g.stroke();
      }
      for (let k = 0; k < 18; k++) {
        const x = W * rng(), y = H * rng(), r = 4 + rng() * 5;
        g.strokeStyle = pencil; g.lineWidth = 1; g.beginPath();
        for (let a = 0; a <= TAU + 0.1; a += 0.6) g.lineTo(x + Math.cos(a) * r * (0.8 + rng() * 0.4), y + Math.sin(a) * r * (0.8 + rng() * 0.4));
        g.stroke();
      }
    } else {
      const cx = W * 0.5, cy = H * 0.18;
      g.strokeStyle = pencil; g.lineWidth = 1.5;
      for (const r of [16, 30, 60]) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + 0.2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60); g.lineTo(cx + Math.cos(a) * W, cy + Math.sin(a) * W); g.stroke(); }
    }
    // Handwritten place names.
    g.fillStyle = 'rgba(60,55,50,0.5)';
    const labels = shuffle(rng, d.labels.slice());
    labels.slice(0, 5).forEach((t, i) => {
      g.save();
      g.translate(W * (0.06 + rng() * 0.7), H * (0.08 + (i / 5) * 0.84 + rng() * 0.05));
      g.rotate((rng() - 0.5) * 0.25);
      g.font = `${11 + Math.floor(rng() * 3)}px ${HAND}`;
      g.fillText(t, 0, 0);
      g.restore();
    });
  },

  pencil(g, [x0, y0], [x1, y1], rng) {
    g.strokeStyle = 'rgba(50,45,40,0.3)';
    g.lineWidth = 1.3;
    g.setLineDash([5, 6]);
    g.beginPath();
    g.moveTo(x0, y0);
    const mx = (x0 + x1) / 2 + (rng() - 0.5) * 10, my = (y0 + y1) / 2 + (rng() - 0.5) * 6;
    g.quadraticCurveTo(mx, my, x1, y1);
    g.stroke();
    g.setLineDash([]);
  },

  // Animate the red marker drawing itself from where you are to the stop you picked, then call done().
  drawTo(canvas, map, fromId, toId, done) {
    const g = canvas.getContext('2d'), dpr = canvas.width / canvas.clientWidth, W = canvas.clientWidth, H = canvas.clientHeight;
    const to = this.pos(mapNode(map, toId)), from = fromId != null ? this.pos(mapNode(map, fromId)) : { x: to.x, y: 1.02 };
    const x0 = from.x * W, y0 = from.y * H, x1 = to.x * W, y1 = to.y * H;
    const t0 = performance.now(), dur = 420;
    let last = 0;
    g.save();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = 'rgba(178,34,28,0.9)'; g.lineWidth = 4.5; g.lineCap = 'round';
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) * (1 - k);
      g.beginPath();
      g.moveTo(x0 + (x1 - x0) * last, y0 + (y1 - y0) * last);
      g.lineTo(x0 + (x1 - x0) * e + (Math.random() - 0.5), y0 + (y1 - y0) * e + (Math.random() - 0.5));
      g.stroke();
      last = e;
      if (k < 1) requestAnimationFrame(step); else { g.restore(); done(); }
    };
    requestAnimationFrame(step);
  },

  // Felt-tip marker: a wobbly double stroke.
  marker(g, [x0, y0], [x1, y1], rng, faint) {
    for (let k = 0; k < 2; k++) {
      g.strokeStyle = `rgba(178,34,28,${(faint ? 0.6 : 0.8) - k * 0.3})`;
      g.lineWidth = faint ? 3 - k : 4 - k * 1.5;
      g.lineCap = 'round';
      if (faint) g.setLineDash([9, 6]);
      g.beginPath();
      g.moveTo(x0 + (rng() - 0.5) * 2, y0 + (rng() - 0.5) * 2);
      const mx = (x0 + x1) / 2 + (rng() - 0.5) * 8, my = (y0 + y1) / 2 + (rng() - 0.5) * 8;
      g.quadraticCurveTo(mx, my, x1 + (rng() - 0.5) * 2, y1 + (rng() - 0.5) * 2);
      g.stroke();
      g.setLineDash([]);
    }
  },

  // A hand-drawn marker circle that doesn't quite close.
  circle(g, x, y, r, rng) {
    g.strokeStyle = 'rgba(178,34,28,0.8)';
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.beginPath();
    const a0 = rng() * TAU;
    for (let a = 0; a <= TAU + 0.5; a += 0.15) {
      const rr = r * (1 + 0.06 * Math.sin(a * 3 + a0)) + (a > TAU ? (a - TAU) * 6 : 0);
      const px = x + Math.cos(a + a0) * rr * 1.1, py = y + Math.sin(a + a0) * rr * 0.92;
      a ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
  },

  // Mugshot of the boss for the photo taped to the sheet.
  mugshot(canvas, boss) {
    const W = canvas.width, H = canvas.height, g = canvas.getContext('2d');
    g.fillStyle = '#b8b2a2'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(30,30,30,0.45)'; g.lineWidth = 1; g.font = '7px "Courier New", monospace'; g.fillStyle = 'rgba(30,30,30,0.6)';
    for (let k = 0; k < 8; k++) { const y = 8 + k * 12; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.fillText(`${6 - k * 0.5}'`, 2, y - 2); }
    // Silhouette: shoulders and head, the boss's colour on the jacket.
    g.fillStyle = '#2a2622';
    g.beginPath(); g.ellipse(W / 2, H * 0.42, W * 0.17, H * 0.2, 0, 0, TAU); g.fill();
    g.fillStyle = boss.color;
    g.beginPath(); g.moveTo(W * 0.12, H); g.quadraticCurveTo(W * 0.2, H * 0.62, W / 2, H * 0.6); g.quadraticCurveTo(W * 0.8, H * 0.62, W * 0.88, H); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
    // Name placard.
    g.fillStyle = '#141414'; g.fillRect(W * 0.12, H * 0.72, W * 0.76, H * 0.2);
    g.fillStyle = '#e8e2d4'; g.font = `bold ${Math.round(W / 12)}px "Courier New", monospace`; g.textAlign = 'center';
    g.fillText(boss.name.replace(/".*" /, '').toUpperCase(), W / 2, H * 0.81, W * 0.72);
    g.font = `${Math.round(W / 15)}px "Courier New", monospace`;
    g.fillText('ACT ' + ['I', 'II', 'III', 'IV'][BOSSES.indexOf(boss)] + ' QUALIFIER', W / 2, H * 0.89, W * 0.72);
    g.textAlign = 'start';
  },
};
