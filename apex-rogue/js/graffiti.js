'use strict';
// Graffiti for the garage walls. Nothing here uses a font: every letter is a hand-drawn skeleton (a few strokes on a
// 4 x 6 grid) sprayed with a wobbly hand, as a thin handstyle, a fat bubble throw-up, or a blocky outlined piece.
// Each mark is painted onto its own layer and then sprayed onto the wall: a soft edge, a speckled haze of overspray,
// thin patches where the can ran dry, and drips running down from wherever the paint pooled. Then the wall ages it:
// the paint skips the mortar between the blocks, rain streaks it, grime settles on it, it fades, flakes and gets
// scratched. And the inmates write about their world: the warden, the sponsors, the bosses, the dead.

// ---------- Letters ----------
// Skeletons on a grid 6 high (y down, 0 = cap height, 6 = baseline). Each is a list of strokes; w is the advance.
const GLYPHS = (() => {
  const O = [[1, 0], [3, 0], [4, 1.2], [4, 4.8], [3, 6], [1, 6], [0, 4.8], [0, 1.2], [1, 0]];
  const P = [[0, 6], [0, 0], [3, 0], [3.9, 0.8], [3.9, 2.4], [3, 3.2], [0, 3.2]];
  const G = {
    A: [[[0, 6], [2, 0], [4, 6]], [[0.8, 3.9], [3.2, 3.9]]],
    B: [[[0, 6], [0, 0], [2.8, 0], [3.6, 0.8], [3.6, 2.2], [2.8, 3], [0, 3]], [[2.8, 3], [3.9, 3.8], [3.9, 5.2], [3, 6], [0, 6]]],
    C: [[[3.9, 1], [3, 0], [1, 0], [0, 1.2], [0, 4.8], [1, 6], [3, 6], [3.9, 5]]],
    D: [[[0, 0], [0, 6], [2.4, 6], [3.9, 4.6], [3.9, 1.4], [2.4, 0], [0, 0]]],
    E: [[[3.6, 0], [0, 0], [0, 6], [3.6, 6]], [[0, 3], [2.8, 3]]],
    F: [[[3.6, 0], [0, 0], [0, 6]], [[0, 3], [2.8, 3]]],
    G: [[[3.9, 1], [3, 0], [1, 0], [0, 1.2], [0, 4.8], [1, 6], [3, 6], [3.9, 5], [3.9, 3.4], [2.2, 3.4]]],
    H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
    I: [[[1, 0], [1, 6]]],
    J: [[[3.4, 0], [3.4, 4.8], [2.4, 6], [1, 6], [0, 5]]],
    K: [[[0, 0], [0, 6]], [[3.8, 0], [0, 3.6]], [[1.2, 2.6], [4, 6]]],
    L: [[[0, 0], [0, 6], [3.4, 6]]],
    M: [[[0, 6], [0, 0], [2.2, 3.4], [4.4, 0], [4.4, 6]]],
    N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
    O: [O],
    P: [P],
    Q: [O, [[2.6, 4.4], [4.2, 6.2]]],
    R: [P, [[1.8, 3.2], [4, 6]]],
    S: [[[3.9, 0.8], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5.2]]],
    T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
    U: [[[0, 0], [0, 4.8], [1, 6], [3, 6], [4, 4.8], [4, 0]]],
    V: [[[0, 0], [2, 6], [4, 0]]],
    W: [[[0, 0], [1.1, 6], [2.2, 2.4], [3.3, 6], [4.4, 0]]],
    X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
    Y: [[[0, 0], [2, 3]], [[4, 0], [2, 3], [2, 6]]],
    Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
    0: [O, [[3.4, 0.8], [0.6, 5.2]]],
    1: [[[0.6, 1], [1.8, 0], [1.8, 6]]],
    2: [[[0.2, 1], [1, 0], [3, 0], [3.8, 1], [3.8, 2], [0, 6], [4, 6]]],
    3: [[[0.2, 0.8], [1, 0], [3, 0], [3.8, 0.8], [3.8, 2.2], [3, 3], [1.6, 3]], [[3, 3], [4, 3.8], [4, 5.2], [3, 6], [1, 6], [0.2, 5.2]]],
    4: [[[3, 6], [3, 0], [0, 4], [4, 4]]],
    5: [[[3.8, 0], [0.4, 0], [0.2, 2.6], [2.8, 2.4], [3.8, 3.4], [3.8, 5], [2.8, 6], [0.8, 6], [0, 5.2]]],
    6: [[[3.4, 0.4], [2.4, 0], [1, 0], [0, 1.4], [0, 4.8], [1, 6], [3, 6], [4, 5], [4, 3.8], [3, 3], [1, 3], [0, 4]]],
    7: [[[0, 0], [4, 0], [1.4, 6]]],
    8: [[[2, 3], [0.6, 2.2], [0.6, 0.8], [1.4, 0], [2.6, 0], [3.4, 0.8], [3.4, 2.2], [2, 3], [0.2, 4], [0.2, 5.2], [1, 6], [3, 6], [3.8, 5.2], [3.8, 4], [2, 3]]],
    9: [[[4, 2], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0.4, 5.4]]],
    '+': [[[2, 1.8], [2, 4.2]], [[0.8, 3], [3.2, 3]]],
    '-': [[[0.6, 3], [3.2, 3]]],
    '=': [[[0.6, 2.2], [3.4, 2.2]], [[0.6, 3.8], [3.4, 3.8]]],
    '!': [[[1, 0], [1, 4.2]], [[1, 5.6], [1, 6]]],
    '?': [[[0.4, 1], [1.2, 0], [2.8, 0], [3.6, 1], [3.6, 2], [2, 3.2], [2, 4.2]], [[2, 5.6], [2, 6]]],
    "'": [[[1, 0], [0.8, 1.4]]],
    '.': [[[0.5, 5.7], [0.5, 6]]],
    ',': [[[0.7, 5.6], [0.3, 6.6]]],
    '/': [[[3, 0], [1, 6]]],
    '#': [[[1.4, 0.6], [1, 5.4]], [[3, 0.6], [2.6, 5.4]], [[0.2, 2], [3.8, 2]], [[0.2, 4], [3.8, 4]]],
    '<': [[[3.4, 1.2], [0.4, 3], [3.4, 4.8]]],
    '>': [[[0.4, 1.2], [3.4, 3], [0.4, 4.8]]],
  };
  const out = {};
  for (const [ch, strokes] of Object.entries(G)) out[ch] = { s: strokes, w: Math.max(...strokes.flat().map((p) => p[0])) };
  out[' '] = { s: [], w: 2 };
  return out;
})();

const Graffiti = {
  // Writers, crews and the things inmates write. The lore lines are the world talking: see LORE.md.
  WRITERS: ['KASE', 'RUSK', 'DOZE', 'NOMAD', 'SLAB', 'OMEN', 'GRIM', 'SOLO', 'MAKO', 'ZERO', 'HAVOC', 'BONES', 'REKS', 'TOXE', 'DEZ'],
  CREWS: ['C9K', 'D BLOCK', 'LIFERS', 'YARD BOYZ', 'XLI', 'WKND'],
  LORE: [
    // Every act: the prison, the Derby, the dead.
    [['C9 NEVER FORGETS'], ['FREE C9'], ['LAP 3 IS WHERE THEY GET YOU'], ['THE CAMERAS ARE ALWAYS ON'], ['DERBY XLI'], ['4471 IS NEXT'],
      ['DEZ WALKED FREE', 'NO HE DIDNT'], ['NOBODY WALKS FREE', 'DEZ DID'], ['HALLORAN LIES'], ['THEY STOPPED COUNTING AT 300']],
    // Act I, the Undercity: the Turnkey and the warden.
    [['TURNKEY = HALLORANS DOG'], ['THE TURNKEY HAS A KEY FOR EVERY CELL'], ['WARDEN HALLORAN', 'COWARD'], ['NO GODS NO WARDENS']],
    // Act II, the Stacks: Sal.
    [['SALS SMOKE TOOK D BLOCK'], ['RUSK WAS RIGHT ABOUT SAL'], ['BREATHE DEEP KID'], ['THE STACKS NEVER SLEEP']],
    // Act III, the Gilded Terraces: Vale and the sponsors.
    [['AUREUM OWNS YOU'], ['VALES DADDY BOUGHT HIS SEAT'], ['SMILE FOR THE SPONSORS'], ['GOLD BLEEDS TOO']],
    // Act IV, the Crown: Marlowe.
    [['MARLOWE WAS ONE OF US'], ['MARLOWE TOOK THE DEAL', 'TRAITOR'], ['THE CROWN EATS ITS OWN'], ['C9 0001 = MARLOWE']],
  ],
  MEMORIAL: ['TOMMY K XXXVIII', 'BONES XL', 'RUSK XL', 'LITTLE JO XL', 'SANTI XLI', 'OLD MAN REY XXXIX'],
  PAINT: ['#d8d4cc', '#b8bcc0', '#b8322a', '#2f5aa8', '#3f9a3f', '#c84a8a', '#d8b83a', '#c86a22', '#151515', '#6a3aa8'],
  pick(r, a) { return a[Math.floor(r() * a.length)]; },

  // ---------- Strokes ----------

  // Lay out text as stroke lists in canvas pixels: h = letter height, slant (x shift per unit up), jitter (px),
  // spacing (fraction of a letter's advance). Returns { strokes, w }.
  layout(txt, x, y, h, r, o) {
    const k = h / 6, strokes = [];
    let cx = x;
    const sl = o.slant || 0, jit = o.jitter || 0, bounce = o.bounce || 0, slope = o.slope || 0, sag = o.sag || 0;
    for (const ch of txt.toUpperCase()) {
      const gl = GLYPHS[ch] || GLYPHS[' '];
      const run = cx - x; // the hand drifts off level as it writes, and sags in the middle of a long line
      const dy = (r() - 0.5) * bounce * h + run * slope + Math.sin(Math.min(1, run / (h * 12)) * Math.PI) * sag * h, sc = 1 + (r() - 0.5) * (o.vary || 0), rot = (r() - 0.5) * (o.tilt || 0);
      for (const s of gl.s) strokes.push(s.map(([gx, gy]) => {
        const lx = gx * k * sc, ly = (gy - 6) * k * sc; // from the letter's baseline-left corner
        const rx = lx * Math.cos(rot) - ly * Math.sin(rot), ry = lx * Math.sin(rot) + ly * Math.cos(rot);
        return [cx + rx - sl * ry + (r() - 0.5) * jit, y + dy + ry + (r() - 0.5) * jit];
      }));
      cx += (gl.w * sc + 1.6) * k * (o.spacing || 1);
    }
    return { strokes, w: cx - x };
  },

  // One stroke, smoothed through its points like a moving hand (a wobble on the straights), round blobs where the
  // can started and stopped.
  path(g, pts, wobble, r) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const mx = (ax + bx) / 2 + (r() - 0.5) * wobble, my = (ay + by) / 2 + (r() - 0.5) * wobble;
      g.quadraticCurveTo(mx, my, bx, by);
    }
  },
  stroke(g, S, width, col, r, o) {
    o = o || {};
    g.strokeStyle = col; g.fillStyle = col;
    g.lineWidth = width; g.lineCap = o.cap || 'round'; g.lineJoin = o.join || 'round';
    for (const pts of S.strokes) {
      if (pts.length < 2) continue;
      if (o.pressure) g.lineWidth = width * (1 - o.pressure / 2 + r() * o.pressure);
      Graffiti.path(g, pts.map(([x, y]) => [x + (o.dx || 0), y + (o.dy || 0)]), o.wobble || 0, r);
      g.stroke();
      if (o.blobs) for (const p of [pts[0], pts[pts.length - 1]]) if (r() < 0.6) { g.beginPath(); g.arc(p[0] + (o.dx || 0), p[1] + (o.dy || 0), width * (0.55 + r() * 0.3), 0, TAU); g.fill(); }
    }
  },

  // ---------- Spraying a layer onto the wall ----------

  layer(W, H) { const c = document.createElement('canvas'); c.width = W; c.height = H; return { c, g: c.getContext('2d') }; },

  // Composite a finished mark onto the wall: thin patches, overspray haze, the soft-edged paint, then drips.
  // o: { soft (px of edge blur), haze (px), hazeA, drips (chance per pooled spot), P (px a world unit) }
  spray(dst, L, r, o) {
    const W = L.c.width, H = L.c.height, P = o.P || 9;
    // Where the can ran thin: low-alpha holes in the coverage.
    L.g.save();
    L.g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < (W * H) / 2600; k++) {
      const x = r() * W, y = r() * H, rad = (0.4 + r() * 1.6) * P;
      const gr = L.g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(0,0,0,${0.12 + r() * 0.25})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      L.g.fillStyle = gr; L.g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    L.g.restore();
    // Overspray: the mark blurred wide and broken up into droplets.
    if (o.haze) {
      const T = Graffiti.layer(W, H);
      T.g.filter = `blur(${o.haze}px)`;
      T.g.drawImage(L.c, 0, 0);
      T.g.filter = 'none';
      T.g.globalCompositeOperation = 'destination-in';
      T.g.drawImage(Graffiti.speckle(W, H, r), 0, 0);
      dst.save(); dst.globalAlpha = o.hazeA || 0.5; dst.drawImage(T.c, 0, 0); dst.restore();
    }
    dst.save();
    dst.filter = `blur(${o.soft || 0.6}px)`;
    dst.drawImage(L.c, 0, 0);
    dst.restore();
    if (o.drips) Graffiti.drips(dst, L, r, o.drips, P, o.box);
  },

  // A field of droplets for overspray (shared per size).
  speckle(W, H, r) {
    const key = W + 'x' + H;
    Graffiti.speckles = Graffiti.speckles || {};
    if (Graffiti.speckles[key]) return Graffiti.speckles[key];
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    for (let k = 0; k < (W * H) / 7; k++) { g.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`; const s = r() < 0.9 ? 1 : 2; g.fillRect(r() * W, r() * H, s, s); }
    return (Graffiti.speckles[key] = c);
  },

  // Drips: find where paint sits on a bottom edge, and let some of it run down the wall.
  drips(dst, L, r, chance, P, box) {
    const [bx, by, bw, bh] = box || [0, 0, L.c.width, L.c.height];
    const x0 = Math.max(0, Math.floor(bx)), y0 = Math.max(0, Math.floor(by)), w = Math.min(L.c.width - x0, Math.ceil(bw)), h = Math.min(L.c.height - y0, Math.ceil(bh));
    if (w <= 0 || h <= 0) return;
    const d = L.g.getImageData(x0, y0, w, h).data, step = Math.max(2, Math.round(P * 0.35));
    dst.save();
    dst.lineCap = 'round';
    for (let x = 0; x < w; x += step) {
      for (let y = h - 2; y > 0; y--) {
        const i = (y * w + x) * 4, below = ((y + 1) * w + x) * 4;
        if (d[i + 3] > 180 && d[below + 3] < 40) {
          if (r() < chance) {
            const len = P * (0.6 + Math.pow(r(), 2) * 6), wid = Math.max(1, P * (0.08 + r() * 0.1));
            dst.strokeStyle = dst.fillStyle = `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`;
            dst.globalAlpha = 0.85;
            const sx = x0 + x, sy = y0 + y;
            dst.lineWidth = wid;
            dst.beginPath(); dst.moveTo(sx, sy); dst.lineTo(sx + (r() - 0.5) * 0.6, sy + len); dst.stroke();
            dst.beginPath(); dst.arc(sx, sy + len, wid * 0.9, 0, TAU); dst.fill(); // the bead at the end
          }
          y -= Math.round(P * 2); // one drip per run of edge
        }
      }
    }
    dst.restore();
  },

  // ---------- Marks ----------

  // A handstyle tag: thin, fast, slanted, letters crowding each other, a swoosh under it, sometimes a crown.
  tag(dst, x, y, h, r, txt, col, P) {
    const L = Graffiti.layer(dst.canvas.width, dst.canvas.height);
    const S = Graffiti.layout(txt, x, y, h, r, { slant: 0.35, jitter: h * 0.06, spacing: 0.78, bounce: 0.12, vary: 0.25, tilt: 0.2 });
    const wd = Math.max(1.5, h * 0.09);
    Graffiti.stroke(L.g, S, wd, col, r, { wobble: h * 0.12, blobs: true });
    L.g.lineWidth = wd * 0.9; L.g.lineCap = 'round';
    L.g.beginPath(); L.g.moveTo(x - h * 0.2, y + h * 0.3); L.g.bezierCurveTo(x + S.w * 0.3, y + h * 0.65, x + S.w * 0.7, y + h * 0.05, x + S.w + h * 0.3, y + h * 0.15); L.g.stroke();
    const e = r();
    if (e < 0.3) { L.g.beginPath(); const cx = x + S.w * 0.2; L.g.moveTo(cx, y - h * 1.15); L.g.lineTo(cx + h * 0.15, y - h * 1.6); L.g.lineTo(cx + h * 0.35, y - h * 1.3); L.g.lineTo(cx + h * 0.55, y - h * 1.65); L.g.lineTo(cx + h * 0.75, y - h * 1.3); L.g.lineTo(cx + h * 0.95, y - h * 1.6); L.g.lineTo(cx + h * 1.0, y - h * 1.15); L.g.closePath(); L.g.stroke(); }
    else if (e < 0.5) { L.g.beginPath(); L.g.ellipse(x + S.w * 0.35, y - h * 1.25, h * 0.55, h * 0.13, -0.1, 0, TAU); L.g.stroke(); }
    Graffiti.spray(dst, L, r, { soft: 0.5, haze: h * 0.12, hazeA: 0.35, drips: 0.05, P, box: [x - h, y - h * 2, S.w + h * 2, h * 3] });
    return S.w;
  },

  // Marker writing: what people say on the walls. A tight hand, a little slant, sometimes in two hands (a reply).
  write(dst, x, y, h, r, txt, col, P, maxW, sprayed) {
    if (sprayed === undefined) sprayed = r() < 0.45; // a can, or a marker
    const L = Graffiti.layer(dst.canvas.width, dst.canvas.height);
    const slope = (r() - 0.5) * 0.09, sag = (r() - 0.3) * 0.5;
    const words = txt.split(' '), lines = [];
    let line = '';
    for (const wd of words) {
      const test = (line ? line + ' ' : '') + wd;
      if (Graffiti.layout(test, 0, 0, h, () => 0.5, { spacing: 0.9 }).w > maxW && line) { lines.push(line); line = wd; } else line = test;
    }
    lines.push(line);
    let w = 0;
    lines.forEach((ln, i) => {
      const S = Graffiti.layout(ln, x + (r() - 0.5) * h * 0.6, y + i * h * 1.6, h, r, { slant: 0.1 + r() * 0.15, jitter: h * 0.1, spacing: 0.82 + r() * 0.2, bounce: 0.12, vary: 0.22, tilt: 0.16, slope, sag });
      Graffiti.stroke(L.g, S, Math.max(1.2, h * (sprayed ? 0.2 : 0.12)), col, r, { wobble: h * 0.18, pressure: 0.6, blobs: sprayed });
      w = Math.max(w, S.w);
    });
    Graffiti.spray(dst, L, r, sprayed
      ? { soft: 0.8, haze: h * 0.22, hazeA: 0.4, drips: 0.16, P, box: [x - h, y - h * 1.5, w + h * 2, lines.length * h * 1.6 + h * 2] }
      : { soft: 0.4, haze: 0, drips: 0.05, P, box: [x - h, y - h * 1.5, w + h * 2, lines.length * h * 1.6 + h * 2] });
    return { w, h: lines.length * h * 1.55 };
  },

  // A bubble throw-up: fat round letters crowding each other, a hard outline, a quick two-tone fill and shines.
  throwup(dst, x, y, h, r, txt, P) {
    const [fill, line] = Graffiti.pick(r, [['#b8bcc0', '#151515'], ['#d8d4cc', '#b8322a'], ['#c84a8a', '#151515'], ['#d8b83a', '#2f5aa8'], ['#3f9a3f', '#d8d4cc'], ['#d8d4cc', '#151515']]);
    const L = Graffiti.layer(dst.canvas.width, dst.canvas.height);
    const S = Graffiti.layout(txt, x, y, h, r, { jitter: h * 0.05, spacing: 0.62, bounce: 0.1, vary: 0.15, tilt: 0.15 });
    const fat = h * 0.42;
    Graffiti.stroke(L.g, S, fat + h * 0.22, line, r, { wobble: h * 0.06 });
    Graffiti.stroke(L.g, S, fat, fill, r, { wobble: h * 0.06 });
    L.g.save(); L.g.beginPath(); L.g.rect(x - h, y - h * 0.42, S.w + h * 2, h); L.g.clip(); // a darker lower half, sprayed in a hurry
    L.g.globalAlpha = 0.3; Graffiti.stroke(L.g, S, fat * 0.92, '#000', r, { wobble: h * 0.06 }); L.g.restore();
    L.g.fillStyle = 'rgba(255,255,255,0.75)';
    for (const pts of S.strokes) if (r() < 0.5) { const p = pts[0]; L.g.beginPath(); L.g.ellipse(p[0] - fat * 0.15, p[1] - fat * 0.1, fat * 0.12, fat * 0.24, -0.5, 0, TAU); L.g.fill(); }
    Graffiti.spray(dst, L, r, { soft: 0.8, haze: h * 0.1, hazeA: 0.4, drips: 0.12, P, box: [x - h, y - h * 1.4, S.w + h * 2, h * 2] });
    return S.w;
  },

  // The boss's name as a proper piece: blocky letters, a 3D drop in a darker shade, black outline, a two-tone fill
  // and a white keyline, slightly irregular because it was sprayed by hand in the dark.
  piece(dst, W, H, r, boss, layout, info) {
    const K = bossKit(boss) || { card: ['', boss.name], ink: '#d8342a' }, P = info.P, act = info.act;
    const [small, big] = K.card || ['', boss.name];
    const wide = layout === 'wide';
    // Older paint first, then the name over it.
    Graffiti.buff(dst, W, H, r, P);
    const nameBox = wide ? [0, H * 0.06, W * 0.98, H * 0.62] : [0, H * 0.06, W, H * 0.78];
    Graffiti.fill(dst, W, H, r, wide ? 9 : 4, info, nameBox);
    // The boss's mark, loose and big behind the letters.
    const ML = Graffiti.layer(W, H);
    Graffiti.mark(ML.g, boss.name, K.ink, ...(wide ? [W * 0.83, H * 0.36, H * 0.3] : [W * 0.5, H * 0.26, W * 0.26]), P);
    Graffiti.spray(dst, ML, r, { soft: 1.5, haze: P * 1.2, hazeA: 0.5, drips: 0.1, P });
    // The name.
    let h = wide ? 22 * P : 14 * P, tx = wide ? W * 0.05 : W * 0.07;
    const maxW = wide ? W * 0.7 : W * 0.86;
    const probe = Graffiti.layout(big, 0, 0, h, () => 0.5, { spacing: 0.78 });
    if (probe.w > maxW) h *= maxW / probe.w;
    const by = wide ? H * 0.58 : H * 0.7;
    const L = Graffiti.layer(W, H);
    const S = Graffiti.layout(big, tx, by, h, r, { jitter: h * 0.02, spacing: 0.78, bounce: 0.05, tilt: 0.06 });
    const fat = h * 0.3, dark = Graffiti.shade(K.ink, 0.45);
    for (let k = 1; k <= 6; k++) Graffiti.stroke(L.g, S, fat + h * 0.1, '#0c0b0a', r, { dx: k * h * 0.018, dy: k * h * 0.018, join: 'miter', cap: 'square' }); // 3D drop
    Graffiti.stroke(L.g, S, fat + h * 0.1, '#0c0b0a', r, { join: 'miter', cap: 'square' }); // outline
    Graffiti.stroke(L.g, S, fat, K.ink, r, { join: 'miter', cap: 'square' });
    L.g.save(); L.g.beginPath(); L.g.moveTo(0, H); // two-tone: the lower half darker, split along a wavy freehand line
    for (let x = 0; x <= W; x += h * 0.25) L.g.lineTo(x, by - h * 0.42 + Math.sin(x / (h * 0.9)) * h * 0.06 + (r() - 0.5) * h * 0.03);
    L.g.lineTo(W, H); L.g.closePath(); L.g.clip();
    Graffiti.stroke(L.g, S, fat * 0.94, dark, r, { join: 'miter', cap: 'square' }); L.g.restore();
    L.g.globalAlpha = 0.8;
    Graffiti.stroke(L.g, S, Math.max(1, h * 0.022), '#f4eedc', r, { dx: -fat * 0.28, dy: -fat * 0.28, wobble: h * 0.02 }); // keyline
    L.g.globalAlpha = 1;
    Graffiti.spray(dst, L, r, { soft: 0.9, haze: P * 0.9, hazeA: 0.45, drips: 0.22, P, box: [0, by - h * 1.5, W, h * 2.2] });
    if (small) Graffiti.tag(dst, tx + h * 0.2, by - h * 1.25, h * 0.32, r, small, '#f0ead8', P);
    // A lore line about this boss, and somebody already going over a corner of the piece.
    const lore = Graffiti.pick(r, Graffiti.LORE[act + 1]);
    Graffiti.conversation(dst, wide ? W * 0.06 : W * 0.08, wide ? H * 0.82 : H * 0.88, 2.2 * P, r, lore, P, wide ? W * 0.55 : W * 0.85);
    Graffiti.tag(dst, wide ? W * 0.6 : W * 0.5, wide ? H * 0.66 : H * 0.84, 3.4 * P, r, Graffiti.pick(r, Graffiti.WRITERS), Graffiti.pick(r, ['#d8d4cc', '#151515', '#c84a8a']), P);
    Graffiti.age(dst, W, H, r, info);
  },

  // A line and its reply: the second hand writes smaller, in another colour, with an arrow.
  conversation(dst, x, y, h, r, lines, P, maxW) {
    const first = Graffiti.write(dst, x, y, h, r, lines[0], Graffiti.pick(r, ['#e8e4d8', '#151515', '#d8d4cc']), P, maxW);
    if (lines[1]) {
      const rx = x + Math.min(first.w, maxW * 0.7) + h * 0.8, ry = y + first.h + h * 0.4;
      const L = Graffiti.layer(dst.canvas.width, dst.canvas.height);
      L.g.strokeStyle = '#b8322a'; L.g.lineWidth = Math.max(1.2, h * 0.12); L.g.lineCap = 'round';
      L.g.beginPath(); L.g.moveTo(rx - h * 1.2, y + first.h * 0.4); L.g.quadraticCurveTo(rx - h * 1.4, ry - h * 0.2, rx - h * 0.3, ry - h * 0.35); L.g.stroke();
      Graffiti.spray(dst, L, r, { soft: 0.3, P });
      Graffiti.write(dst, rx, ry, h * 0.85, r, lines[1], '#b8322a', P, maxW * 0.5);
    }
  },

  // A memorial: RIP and the names, with the Derby each of them died in, and a cross.
  memorial(dst, x, y, h, r, P) {
    const names = [...Graffiti.MEMORIAL].sort(() => r() - 0.5).slice(0, 4);
    Graffiti.write(dst, x, y, h * 1.8, r, 'RIP', '#e8e4d8', P, 9999, true);
    const L = Graffiti.layer(dst.canvas.width, dst.canvas.height);
    L.g.strokeStyle = '#e8e4d8'; L.g.lineWidth = h * 0.25; L.g.lineCap = 'round';
    const cx = x + h * 6.6;
    L.g.beginPath(); L.g.moveTo(cx, y - h * 2.2); L.g.lineTo(cx, y + h * 0.6); L.g.moveTo(cx - h * 0.8, y - h * 1.4); L.g.lineTo(cx + h * 0.8, y - h * 1.4); L.g.stroke();
    Graffiti.spray(dst, L, r, { soft: 0.5, haze: h * 0.2, hazeA: 0.3, drips: 0.3, P });
    names.forEach((n, i) => Graffiti.write(dst, x + h * 0.2, y + h * 1.4 + i * h * 1.6, h * 0.8, r, n, i % 2 ? '#d8d4cc' : '#c8c0b0', P, 9999, false)); // each added in its own hand
  },

  // The rest of a wall: buffing, then n marks (tags, throw-ups, stencils, writing), aged together.
  wall(dst, W, H, r, n, info, memorial) {
    Graffiti.buff(dst, W, H, r, info.P);
    if (memorial) Graffiti.memorial(dst, W * 0.62, H * 0.5, 2.2 * info.P, r, info.P);
    Graffiti.fill(dst, W, H, r, n, info, memorial ? [W * 0.58, H * 0.3, W, H * 0.95] : null);
    Graffiti.age(dst, W, H, r, info);
  },

  // Buffed patches: somebody rollered over old work in a not-quite-matching grey.
  buff(dst, W, H, r, P) {
    for (let k = 0; k < 2; k++) {
      const w = W * (0.2 + r() * 0.35), h = H * (0.25 + r() * 0.4), x = r() * (W - w), y = r() * (H - h);
      dst.save();
      dst.fillStyle = Graffiti.pick(r, ['#5e5b55', '#545656', '#6a6258']);
      dst.globalAlpha = 0.6 + r() * 0.25;
      dst.beginPath(); dst.moveTo(x, y);
      for (let i = 0; i <= 10; i++) dst.lineTo(x + (w * i) / 10, y + (r() - 0.5) * P * 0.8); // rough roller edges
      for (let i = 10; i >= 0; i--) dst.lineTo(x + (w * i) / 10, y + h + (r() - 0.5) * P * 0.8);
      dst.fill();
      dst.restore();
    }
  },

  // n assorted marks, mostly clear of `avoid` ([x0, y0, x1, y1]).
  fill(dst, W, H, r, n, info, avoid) {
    const P = info.P, act = info.act, placed = [];
    const kinds = ['tag', 'tag', 'tag', 'throwup', 'throwup', 'lore', 'lore', 'stencil', 'crew', 'smiley'];
    for (let k = 0, tries = 0; k < n && tries < n * 40; tries++) {
      const kind = Graffiti.pick(r, kinds);
      const h = { tag: 3.2, throwup: 7, lore: 2, stencil: 6, crew: 3.6, smiley: 4.5 }[kind] * P * (0.8 + r() * 0.45);
      const bw = { tag: 3.4, throwup: 3.6, lore: 11, stencil: 1.4, crew: 3.6, smiley: 1.2 }[kind] * h, bh = { lore: 2.6, throwup: 1.4 }[kind] * h || 1.6 * h;
      if (bw > W * 1.05 || bh > H) continue;
      const x = r() * Math.max(1, W - bw), y = bh * 0.8 + r() * Math.max(1, H - bh);
      const box = [x, y - bh, x + bw, y + bh * 0.2];
      const hit = (a) => !(box[2] < a[0] || box[0] > a[2] || box[3] < a[1] || box[1] > a[3]);
      if (avoid && hit(avoid) && r() < 0.93) continue;
      if (placed.some(hit) && r() < 0.85) continue;
      placed.push(box); k++;
      const col = Graffiti.pick(r, Graffiti.PAINT);
      if (kind === 'tag') Graffiti.tag(dst, x, y, h, r, Graffiti.pick(r, Graffiti.WRITERS), col, P);
      else if (kind === 'crew') Graffiti.tag(dst, x, y, h, r, Graffiti.pick(r, Graffiti.CREWS), col, P);
      else if (kind === 'throwup') Graffiti.throwup(dst, x, y, h, r, Graffiti.pick(r, Graffiti.WRITERS).slice(0, 3 + Math.floor(r() * 2)), P);
      else if (kind === 'lore') Graffiti.conversation(dst, x, y - bh * 0.6, h, r, Graffiti.pick(r, r() < 0.5 ? Graffiti.LORE[0] : Graffiti.LORE[act + 1]), P, Math.min(bw, W - x - h));
      else if (kind === 'stencil') { const L = Graffiti.layer(W, H); Graffiti.stencil(L.g, x + h * 0.6, y - h * 0.55, h, r, col === '#151515' ? col : Graffiti.pick(r, ['#151515', '#d8d4cc', '#b8322a'])); Graffiti.spray(dst, L, r, { soft: 1.0, haze: h * 0.1, hazeA: 0.6, drips: 0.06, P }); }
      else { const L = Graffiti.layer(W, H); Graffiti.smiley(L.g, x + h * 0.5, y - h * 0.5, h * 0.42, col === '#151515' ? '#d8b83a' : col); Graffiti.spray(dst, L, r, { soft: 0.6, haze: h * 0.06, hazeA: 0.4, drips: 0.25, P }); }
    }
  },

  // ---------- Time ----------
  // Everything on the wall ages together: the paint skips the mortar, rain streaks it, grime settles, it fades,
  // flakes off and gets scratched.
  age(dst, W, H, r, info) {
    const P = info.P;
    dst.save();
    // Faded towards the wall.
    dst.globalCompositeOperation = 'source-atop';
    dst.fillStyle = 'rgba(96,92,84,0.13)'; dst.fillRect(0, 0, W, H);
    // Rain streaks from the top, and grime pooled low.
    for (let k = 0; k < W / (P * 2.5); k++) {
      const x = r() * W, w = P * (0.15 + r() * 0.5), len = H * (0.2 + r() * 0.8);
      const gr = dst.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, `rgba(28,22,14,${0.15 + r() * 0.3})`); gr.addColorStop(1, 'rgba(28,22,14,0)');
      dst.fillStyle = gr; dst.fillRect(x, 0, w, len);
    }
    const low = dst.createLinearGradient(0, H * 0.6, 0, H);
    low.addColorStop(0, 'rgba(30,24,16,0)'); low.addColorStop(1, 'rgba(30,24,16,0.35)');
    dst.fillStyle = low; dst.fillRect(0, 0, W, H);
    for (let k = 0; k < (W * H) / (P * P * 40); k++) {
      const x = r() * W, y = r() * H, rad = P * (1 + r() * 4);
      const gr = dst.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(24,20,14,${r() * 0.22})`); gr.addColorStop(1, 'rgba(24,20,14,0)');
      dst.fillStyle = gr; dst.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // Wear: the paint missing in the mortar courses, flaked off in clusters, scratched through, pitted.
    dst.globalCompositeOperation = 'destination-out';
    if (info.blocks) {
      for (let py = 0; py < H; py++) {
        const wy = info.top - py / P; // world height of this row
        const t = ((wy / 64) % 1 + 1) % 1, cy = (1 - t) * 128; // where the wall's texture puts it (see buildShell)
        const row = Math.floor(cy / 16), inBed = cy - row * 16 < 2;
        if (inBed) { dst.fillStyle = 'rgba(0,0,0,0.38)'; dst.fillRect(0, py, W, 1); continue; }
        const off = row % 2 ? 0 : 4; // joints: every 8 units, staggered by 4
        for (let jx = Math.ceil((info.x0 + info.wallW / 2 - off) / 8) * 8 + off - info.wallW / 2; jx < info.x0 + W / P; jx += 8) {
          const px = (jx - info.x0) * P;
          dst.fillStyle = 'rgba(0,0,0,0.26)'; dst.fillRect(px, py, Math.max(1, P * 0.35), 1);
        }
      }
    }
    for (let k = 0; k < (W * H) / (P * P * 60); k++) { // flakes
      const cx = r() * W, cy = r() * H;
      for (let j = 0; j < 6; j++) {
        const x = cx + (r() - 0.5) * P * 2, y = cy + (r() - 0.5) * P * 2, s = P * (0.1 + r() * 0.4);
        dst.fillStyle = `rgba(0,0,0,${0.6 + r() * 0.4})`;
        dst.beginPath(); dst.moveTo(x, y); dst.lineTo(x + s, y + s * 0.3); dst.lineTo(x + s * 0.6, y + s); dst.lineTo(x - s * 0.2, y + s * 0.6); dst.fill();
      }
    }
    dst.strokeStyle = 'rgba(0,0,0,0.7)'; dst.lineWidth = 1;
    for (let k = 0; k < W / (P * 4); k++) { const x = r() * W, y = r() * H, a = r() * TAU, l = P * (0.5 + r() * 3); dst.beginPath(); dst.moveTo(x, y); dst.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); dst.stroke(); }
    for (let k = 0; k < (W * H) / 40; k++) { dst.fillStyle = `rgba(0,0,0,${r() * 0.5})`; dst.fillRect(r() * W, r() * H, 1, 1); }
    dst.restore();
  },

  // ---------- Pictures ----------

  stencil(g, cx, cy, s, r, col) {
    g.save();
    g.translate(cx, cy);
    g.rotate((r() - 0.5) * 0.2);
    g.fillStyle = col;
    const kind = Math.floor(r() * 4);
    if (kind === 0) { // skull
      g.beginPath(); g.arc(0, -s * 0.1, s * 0.42, 0, TAU); g.fill();
      g.fillRect(-s * 0.24, s * 0.2, s * 0.48, s * 0.28);
      g.globalCompositeOperation = 'destination-out';
      for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * s * 0.17, -s * 0.12, s * 0.12, 0, TAU); g.fill(); }
      g.beginPath(); g.moveTo(0, s * 0.02); g.lineTo(-s * 0.06, s * 0.14); g.lineTo(s * 0.06, s * 0.14); g.fill();
      for (let k = -1; k <= 1; k++) g.fillRect(k * s * 0.12 - s * 0.025, s * 0.3, s * 0.05, s * 0.18);
    } else if (kind === 1) { // rat
      g.beginPath(); g.ellipse(0, 0, s * 0.45, s * 0.22, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(s * 0.4, -s * 0.05); g.lineTo(s * 0.75, s * 0.06); g.lineTo(s * 0.4, s * 0.15); g.fill();
      g.beginPath(); g.arc(s * 0.3, -s * 0.2, s * 0.1, 0, TAU); g.fill();
      g.lineWidth = s * 0.05; g.strokeStyle = col; g.beginPath(); g.moveTo(-s * 0.42, 0); g.quadraticCurveTo(-s * 0.8, -s * 0.3, -s * 0.95, s * 0.15); g.stroke();
      for (const lx of [-0.2, 0.2]) g.fillRect(lx * s, s * 0.15, s * 0.05, s * 0.18);
    } else if (kind === 2) { // fist
      g.fillRect(-s * 0.3, -s * 0.2, s * 0.6, s * 0.45);
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(-s * 0.22 + k * s * 0.15, -s * 0.22, s * 0.08, 0, TAU); g.fill(); }
      g.fillRect(-s * 0.2, s * 0.22, s * 0.4, s * 0.45);
      g.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 3; k++) g.fillRect(-s * 0.15 + k * s * 0.15, -s * 0.2, s * 0.02, s * 0.2);
    } else { // a CCTV camera, crossed out
      g.fillRect(-s * 0.4, -s * 0.15, s * 0.6, s * 0.3);
      g.beginPath(); g.moveTo(s * 0.2, -s * 0.1); g.lineTo(s * 0.42, -s * 0.2); g.lineTo(s * 0.42, s * 0.2); g.lineTo(s * 0.2, s * 0.1); g.fill();
      g.fillRect(-s * 0.15, s * 0.15, s * 0.06, s * 0.3);
      g.strokeStyle = '#b8322a'; g.lineWidth = s * 0.08;
      g.beginPath(); g.moveTo(-s * 0.5, -s * 0.45); g.lineTo(s * 0.5, s * 0.45); g.moveTo(s * 0.5, -s * 0.45); g.lineTo(-s * 0.5, s * 0.45); g.stroke();
    }
    g.restore();
  },

  smiley(g, cx, cy, R, col) {
    g.save();
    g.strokeStyle = col; g.lineWidth = R * 0.16; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy, R, 0.1, TAU - 0.15); g.stroke(); // not quite closed: done in one sweep
    for (const sx of [-1, 1]) { const ex = cx + sx * R * 0.35, ey = cy - R * 0.25, e = R * 0.14; g.beginPath(); g.moveTo(ex - e, ey - e); g.lineTo(ex + e, ey + e); g.moveTo(ex + e, ey - e); g.lineTo(ex - e, ey + e); g.stroke(); }
    g.beginPath(); g.arc(cx, cy + R * 0.05, R * 0.5, 0.25, Math.PI - 0.25); g.stroke();
    g.restore();
  },

  // Each boss's mark: the Turnkey's ring of keys, Sal's smokestacks, Vale's dollar star, the Crown slashed through.
  mark(g, name, ink, cx, cy, R) {
    g.save();
    g.translate(cx, cy);
    g.strokeStyle = ink; g.fillStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
    g.globalAlpha = 0.7;
    g.lineWidth = R * 0.1;
    if (name === 'The Turnkey') {
      g.beginPath(); g.arc(0, -R * 0.35, R * 0.32, 0, TAU); g.stroke();
      for (const a of [-0.9, -0.3, 0.3, 0.9]) {
        g.save(); g.translate(Math.sin(a) * R * 0.32, -R * 0.35 + Math.cos(a) * R * 0.32); g.rotate(-a * 0.6);
        g.fillRect(-R * 0.04, 0, R * 0.08, R * 0.75);
        g.fillRect(0, R * 0.55, R * 0.18, R * 0.07); g.fillRect(0, R * 0.68, R * 0.14, R * 0.07);
        g.beginPath(); g.arc(0, 0, R * 0.09, 0, TAU); g.fill();
        g.restore();
      }
    } else if (name === 'Smokestack Sal') {
      for (const [x, h] of [[-0.45, 1.1], [0, 1.4], [0.45, 0.95]]) {
        g.fillRect(x * R - R * 0.12, R * 0.9 - h * R, R * 0.24, h * R);
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x * R + k * R * 0.14, R * 0.9 - h * R - R * 0.18 - k * R * 0.22, R * (0.14 + k * 0.05), 0, TAU); g.stroke(); }
      }
    } else if (name === 'Augustin Vale') {
      g.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? R * 0.42 : R; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.stroke();
      g.lineWidth = R * 0.12; // a dollar sign, drawn not typed
      g.beginPath(); g.moveTo(R * 0.2, -R * 0.22); g.quadraticCurveTo(0, -R * 0.38, -R * 0.18, -R * 0.2); g.quadraticCurveTo(-R * 0.25, 0, 0, R * 0.02); g.quadraticCurveTo(R * 0.25, R * 0.06, R * 0.18, R * 0.24); g.quadraticCurveTo(0, R * 0.42, -R * 0.2, R * 0.26); g.stroke();
      g.beginPath(); g.moveTo(0, -R * 0.45); g.lineTo(0, R * 0.48); g.stroke();
    } else {
      g.beginPath();
      g.moveTo(-R, R * 0.5); g.lineTo(-R, -R * 0.4); g.lineTo(-R * 0.5, R * 0.05); g.lineTo(0, -R * 0.7); g.lineTo(R * 0.5, R * 0.05); g.lineTo(R, -R * 0.4); g.lineTo(R, R * 0.5); g.closePath();
      g.stroke();
      for (const [x, y] of [[-1, -0.5], [0, -0.82], [1, -0.5]]) { g.beginPath(); g.arc(x * R, y * R, R * 0.1, 0, TAU); g.fill(); }
      g.strokeStyle = '#b8322a'; g.lineWidth = R * 0.08; g.beginPath(); g.moveTo(-R * 1.1, -R * 0.9); g.lineTo(R * 1.1, R * 0.8); g.stroke();
    }
    g.restore();
  },

  shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  },
};
