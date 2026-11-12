'use strict';
// People built on a rigged low-poly body (js/basemesh.js) in place of lofted tubes: one skinned mesh with real
// shoulders, hands and feet, dressed by painting its faces (jumpsuit, skin, gloves, boots) and posed by turning its
// bones. Flat-shaded, so it keeps the faceted look.
const Body = {
  K: 8.4, // metres to figure units: the shoulders land where the old figure's did, the soles where its boots stood

  // Which part of the body a bone belongs to (decides what a face is painted as).
  region(n) {
    if (n === 'head' || /^(Head_|Eye)/.test(n)) return 'head';
    if (/^WeaponMount/.test(n)) return 'hand';
    if (n === 'neck') return 'neck';
    if (/^(hand|palm|f_|thumb)/.test(n)) return 'hand';
    if (/^forearm/.test(n)) return 'forearm';
    if (/^upper_arm/.test(n)) return 'arm';
    if (/^shoulder/.test(n)) return 'chest';
    if (/^(foot|toe)/.test(n)) return 'foot';
    if (/^shin/.test(n)) return 'shin';
    if (/^thigh/.test(n)) return 'leg';
    return n === 'chest' ? 'chest' : 'waist';
  },

  // The model as the game uses it. 'full' (the one with a face) is a thin, long-bodied, small-headed figure in a T
  // pose; it is re-proportioned here, once: heights remapped so its hips, shoulders and neck sit where the clothes
  // expect them, the torso, arms and legs filled out, the head enlarged. Each vertex takes the change of the bones
  // that carry it (blended by their weights), and each bone takes its own, so skin and skeleton stay together.
  shapes: {},
  shaped(kind) {
    if (Body.shapes[kind]) return Body.shapes[kind];
    const S = BASEMESH[kind] || BASEMESH.male;
    if (kind !== 'full') return (Body.shapes[kind] = S);
    const lin = (y, a, b, c, d) => c + ((y - a) * (d - c)) / (b - a);
    const fy = (y) => (y < 0 ? y * 1.0414 : y < 0.5895 ? lin(y, 0, 0.5895, 0, 0.52) : lin(y, 0.5895, 0.6928, 0.52, 0.62)); // (above the neck: carried on by the head's own scale)
    const group = (n) => (/^(head|Head_|Eye)/.test(n) ? 'head' : n === 'neck' ? 'neck' : /^(upper_arm|forearm|hand|palm|f_|thumb|WeaponMount)/.test(n) ? 'arm' : /^(thigh|shin|foot|toe)/.test(n) ? 'leg' : 'torso');
    const T = {
      torso: ([x, y, z]) => [x * 1.2, fy(y), z * 1.26],
      neck: ([x, y, z]) => [x * 1.22, fy(y), z * 1.22],
      head: ([x, y, z]) => [x * 1.3, 0.62 + (y - 0.6928) * 1.3, z * 1.3],
      arm: ([x, y, z]) => [-0.0167 + (x + 0.0139) * 1.22, 0.52 + (y - 0.5895) * 1.22, z + Math.sign(z) * 0.044], // thicker round its own line, carried out with the wider shoulders
      leg: ([x, y, z]) => { const s = Math.sign(z) || 1; return [x * 1.2, fy(y), s * 0.116 + (z - s * 0.105) * 1.2]; },
    };
    const gi = S.bones.map((b) => group(b.n));
    const verts = S.verts.map((v, i) => {
      const o = [0, 0, 0];
      for (const [bi, w] of S.weights[i]) { const q = T[gi[bi]](v); o[0] += q[0] * w; o[1] += q[1] * w; o[2] += q[2] * w; }
      return o;
    });
    const bones = S.bones.map((b, i) => ({ n: b.n, p: b.p, h: T[gi[i]](b.h), t: T[gi[i]](b.t) }));
    return (Body.shapes[kind] = { bones, verts, weights: S.weights, tris: S.tris, tag: S.tag });
  },

  // The skinned body. paint: { suit, skin, glove, boot, top ('suit' | 'vest'), rolled, head (keep the mesh's own head) }.
  make(kind, paint) {
    const D = Body.shaped(kind), K = Body.K, col = (c) => new THREE.Color(c);
    const VV = D.verts.slice(), WW = D.weights.slice(); // (grown below, where faces are cut along a garment's edge)
    // A slimmer neck. The base mesh's is nearly as wide as the head that goes on it; whatever the neck and head bones
    // carry is drawn in towards the line of the neck, by how much of it they carry (so it runs smoothly into the shoulders).
    if (kind !== 'full') {
      const nk = D.bones.find((b) => b.n === 'neck'), ni = D.bones.findIndex((b) => b.n === 'neck'), hi = D.bones.findIndex((b) => b.n === 'head');
      VV.forEach((v, i) => {
        const w = WW[i].reduce((a, [bi, x]) => a + (bi === ni || bi === hi ? x : 0), 0);
        if (w <= 0) return;
        const t = clamp((v[1] - nk.h[1]) / (nk.t[1] - nk.h[1]), -0.5, 2), cx = nk.h[0] + (nk.t[0] - nk.h[0]) * t, k = 1 - 0.3 * w * w * (3 - 2 * w);
        VV[i] = [cx + (v[0] - cx) * (1 - (1 - k) * 0.8), v[1], v[2] * k];
      });
    }
    const C = { suit: col(paint.suit), skin: col(paint.skin), glove: col(paint.glove || paint.skin), boot: col(paint.boot || '#22180f'), vest: col('#eeeae0'), trim: col(paint.suit).lerp(col('#f2e6c8'), 0.3), belt: col('#3a2416'), seam: col(paint.suit).lerp(col('#000000'), 0.3) };
    const vest = paint.top === 'vest', bare = vest || paint.rolled;
    const reg = WW.map((w) => Body.region(D.bones[w[0][0]].n));
    // Smooth normals of the bare body: the average of the faces round each vertex.
    const vn = VV.map(() => new THREE.Vector3()), P3 = (i) => new THREE.Vector3(...VV[i]);
    for (const f of D.tris) { const a = P3(f[0]), fn = P3(f[1]).sub(a).cross(P3(f[2]).sub(a)); for (const i of f) vn[i].add(fn); }
    for (const v of vn) v.normalize();
    // Clothes. Every face is one garment, and a garment stands off the body by its own thickness (pushed out along
    // the normals), so cloth hangs outside the skin with an edge where it ends: an open cuff round the wrist, a
    // collar standing off the neck, a trouser leg bloused over a boot wider than the ankle. WEAR: [colour, stand-off
    // in metres, how much it wrinkles]. Heights are metres above the hips (belt 0.1, shoulder 0.5, knee -0.44, sole -0.99).
    const WEAR = {
      skin: [C.skin, 0, 0], glove: [C.glove, 0.007, 0], suit: [C.suit, 0.03, 0], sleeve: [C.suit, 0.026, 0], cuff: [C.seam, 0.03, 0], roll: [C.suit, 0.046, 0],
      collar: [C.trim, 0.042, 0], placket: [col(paint.suit).lerp(col('#f2e6c8'), 0.07), 0.036, 0], pocket: [C.seam, 0.037, 0], belt: [C.belt, 0.043, 0], boot: [C.boot, 0.047, 0], toes: [C.boot, 0.008, 0], blouse: [C.suit, 0.04, 0],
      vest: [C.vest, 0.016, 0], tie: [C.suit, 0.062, 0.5],
      eye: [col('#e6ddd0'), 0, 0], iris: [col(paint.eye || '#3a2414'), 0.0004, 0], pupil: [col('#0c0806'), 0.0008, 0],
      head: [C.skin, 0, 0], lip: [col(paint.skin).lerp(col('#7a2a22'), 0.36), 0.0012, 0], brow: [col(paint.hair || '#2a1c14').lerp(col(paint.skin), 0.15), 0.004, 0],
      hair: [col(paint.hair || '#2a1c14'), 0.013, 0], buzz: [col(paint.hair || '#2a1c14').lerp(col(paint.skin), 0.4), 0.003, 0], beard: [col(paint.hair || '#2a1c14'), 0.011, 0], stubble: [col(paint.skin).lerp(col(paint.hair || '#2a1c14'), 0.32), 0.0015, 0],
      hat: [col(paint.hat || '#3a3a3a'), 0.02, 0], hatBand: [col(paint.hat || '#3a3a3a').lerp(col('#000000'), 0.25), 0.03, 0],
    };
    const wear = (f) => {
      const r = f.map((i) => reg[i]), has = (x) => r.includes(x), all = (x) => r.every((q) => q === x);
      const avg = (g) => f.reduce((a, i) => a + g(i), 0) / f.length, cy = avg((i) => VV[i][1]), cz = avg((i) => VV[i][2]), front = avg((i) => vn[i].x) > 0.55;
      const zMax = Math.max(...f.map((i) => Math.abs(VV[i][2])));
      if (D.tag && f.every((i) => D.tag[i])) return 'eye'; // an eyeball (its iris and pupil are cut into it below)
      if (all('hand')) return 'glove';
      if (has('hand')) return bare ? 'glove' : 'cuff';
      if (has('foot')) return 'boot';
      if (has('shin')) return 'shin'; // (cut below into boot, the trouser gathered over it, and trouser)
      if (has('head')) return D.tag && all('head') ? 'head' : 'skin'; // (the face and scalp of the model with one: hair, brows, lips and beard are cut into it below)
      if ((has('neck') || has('chest')) && !has('arm') && cy > 0.5) return vest ? 'torso' : 'neckline'; // (cut below where the suit's neck ends; the collar itself is a ring of its own, added with the figure)
      if (has('forearm') && !has('arm')) return bare ? 'skin' : 'sleeve';
      if (has('forearm') && has('arm')) return vest ? 'skin' : paint.rolled ? 'roll' : 'sleeve'; // the elbow (where a rolled sleeve sits)
      if (has('arm')) return has('chest') ? (vest ? 'torso' : 'suit') : vest ? 'skin' : 'sleeve';
      if (has('leg') || has('shin')) return 'suit';
      if (vest) return cy > 0.02 ? 'torso' : 'suit'; // (the jumpsuit's top half tied round the waist; the singlet is cut out of 'torso' below)
      if (front && cy > 0.155 && zMax < 0.06) return 'placket'; // the zip's cover, down the middle
      if (front && cy > 0.36 && cy < 0.45 && cz > 0.05 && cz < 0.13) return 'pocket';
      return 'suit';
    };
    // Garments are chosen a quad at a time (the mesh is quads, each exported as two triangles), so their edges run
    // along the body's own rings of faces and never zigzag.
    const kindOf = [];
    for (let t = 0; t < D.tris.length; t++) {
      const a = D.tris[t], b = D.tris[t + 1], quad = b && a.filter((i) => b.includes(i)).length === 2;
      const k = wear(quad ? [...new Set(a.concat(b))] : a);
      kindOf[t] = k; if (quad) kindOf[++t] = k;
    }
    const keep = D.tris.map((f) => paint.head || !f.every((i) => reg[i] === 'head'));
    let tris = D.tris.filter((f, t) => keep[t]), kinds = kindOf.filter((k, t) => keep[t]);
    // Garment edges that do not follow the mesh are cut into it: wherever a line (the top of a boot, the edges of the
    // belt, the neck and armholes of a singlet) crosses a face, the face is split along it, with new vertices on
    // the line. So an edge is straight and clean however the faces under it happen to run.
    const edges = new Map();
    const mid = (a, b, t, id) => {
      const k = id + ':' + (a < b ? a + '_' + b : b + '_' + a);
      if (edges.has(k)) return edges.get(k);
      const va = VV[a], vb = VV[b], w = new Map();
      VV.push([va[0] + (vb[0] - va[0]) * t, va[1] + (vb[1] - va[1]) * t, va[2] + (vb[2] - va[2]) * t]);
      vn.push(vn[a].clone().lerp(vn[b], t).normalize()); reg.push(reg[t < 0.5 ? a : b]);
      for (const [i, x] of WW[a]) w.set(i, (w.get(i) || 0) + x * (1 - t));
      for (const [i, x] of WW[b]) w.set(i, (w.get(i) || 0) + x * t);
      const top = [...w].sort((x, y) => y[1] - x[1]).slice(0, 4), sum = top.reduce((q, x) => q + x[1], 0) || 1;
      WW.push(top.map(([i, x]) => [i, x / sum]));
      edges.set(k, VV.length - 1);
      return VV.length - 1;
    };
    let cuts = 0;
    // Faces that pass `pred` become inK where f >= 0 and outK (or stay as they were) where f < 0.
    const split = (pred, f, inK, outK) => {
      const id = cuts++, T2 = [], K2 = [];
      tris.forEach((tr, t) => {
        const kd = kinds[t];
        if (!pred(kd, tr)) { T2.push(tr); K2.push(kd); return; }
        const fv = tr.map((i) => f(VV[i], i)), ins = fv.map((x) => x >= 0), np = ins.filter(Boolean).length, ko = outK || kd;
        if (np === 3 || np === 0) { T2.push(tr); K2.push(np ? inK : ko); return; }
        const l = np === 1 ? ins.indexOf(true) : ins.indexOf(false), a = tr[l], b = tr[(l + 1) % 3], c = tr[(l + 2) % 3], fa = fv[l], fb = fv[(l + 1) % 3], fc = fv[(l + 2) % 3];
        const ab = mid(a, b, fa / (fa - fb), id), ac = mid(a, c, fa / (fa - fc), id), kl = np === 1 ? inK : ko, kr = np === 1 ? ko : inK;
        T2.push([a, ab, ac], [ab, b, c], [ab, c, ac]); K2.push(kl, kr, kr);
      });
      tris = T2; kinds = K2;
    };
    const is = (...ks) => (kd) => ks.includes(kd);
    if (D.tag) {
      // The face. Everything is placed from the eyes (their middle E, and how far apart): iris and pupil cut into
      // each eyeball as circles round the point that looks forward, then brows, lips, hair or a hat, and a beard cut
      // into the head's own faces, each standing off the skin a little.
      const eyes = [1, 2].map((tg) => { const ev = D.verts.filter((v, i) => D.tag[i] === tg); return { c: [0, 1, 2].map((k) => ev.reduce((a, v) => a + v[k], 0) / ev.length), r: (Math.max(...ev.map((v) => v[1])) - Math.min(...ev.map((v) => v[1]))) / 2 }; });
      for (const { c, r } of eyes) {
        const near = (tr) => Math.abs(VV[tr[0]][2] - c[2]) < r * 1.5;
        split((kd, tr) => kd === 'eye' && near(tr), (v) => v[0] - c[0] - r * 0.45, 'iris', 'eye');
        split((kd, tr) => kd === 'iris' && near(tr), (v) => v[0] - c[0] - r * 0.84, 'pupil', 'iris');
      }
      const ey = eyes[0].c[1], ez = Math.abs(eyes[0].c[2]), hx = D.bones.find((q) => q.n === 'head').h[0];
      const round = (v, front, side, back) => { const c = Math.cos(Math.atan2(v[2], v[0] - hx)); return c >= 0 ? side + (front - side) * c * c : side + (back - side) * c * c; }; // a height that varies round the head
      for (const sd of [-1, 1]) { // brows: thick at the nose, thinning out, tipped down in the middle for a scowl
        const tilt = paint.brow === 'scowl' ? 0.2 : 0.02;
        split(is('head'), (v, i) => { const u = (sd * v[2] - ez) / 0.034; return Math.min(1 - Math.abs(u), (0.0085 - 0.0025 * u) - Math.abs(v[1] - (ey + 0.034 + tilt * 0.034 * u * 0.5 + 0.004 * (1 - u * u))), vn[i].x - 0.25) ; }, 'brow', 'head');
      }
      split(is('head'), (v, i) => Math.min(0.033 - Math.abs(v[2]), 0.02 - Math.abs(v[1] - (ey - 0.099)), vn[i].x - 0.3), 'lip', 'head');
      const beard = paint.beard === true ? 'full' : paint.beard;
      if (beard === 'full' || beard === 'stubble') split(is('head'), (v) => Math.min(ey - 0.066 + 0.03 * (1 - Math.cos(Math.atan2(v[2], v[0] - hx))) - v[1], v[0] - hx + 0.01), beard === 'full' ? 'beard' : 'stubble', 'head');
      if (beard === 'goatee') split(is('head'), (v, i) => Math.min(0.034 - Math.abs(v[2]), ey - 0.124 - v[1], vn[i].x - 0.1), 'beard', 'head');
      if (beard === 'moustache' || beard === 'full') split(is('head'), (v, i) => Math.min(0.046 - Math.abs(v[2]), 0.0105 - Math.abs(v[1] - (ey - 0.07 - Math.abs(v[2]) * 0.18)), vn[i].x - 0.2), 'beard', 'head');
      const g = paint.gear;
      if (g === 'hair') split(is('head'), (v) => v[1] - round(v, ey + 0.094, ey + 0.036, ey - 0.1), 'hair', 'head');
      if (g === 'buzz') split(is('head'), (v) => v[1] - round(v, ey + 0.09, ey + 0.04, ey - 0.095), 'buzz', 'head');
      if (g === 'beanie' || g === 'bandana' || g === 'cap') {
        const line = (v) => (g === 'beanie' ? round(v, ey + 0.062, ey + 0.036, ey - 0.03) : g === 'bandana' ? round(v, ey + 0.07, ey + 0.05, ey - 0.02) : round(v, ey + 0.075, ey + 0.05, ey - 0.0));
        split(is('head'), (v) => v[1] - line(v), 'hat', 'head');
        if (g === 'beanie') split(is('hat'), (v) => line(v) + 0.03 - v[1], 'hatBand', 'hat'); // its rolled brim
      }
    }
    split(is('neckline'), (v) => 0.562 - v[1], 'suit', 'skin');
    split(is('shin'), (v) => -0.7 - v[1], 'boot', 'shin');
    split(is('shin'), (v) => -0.61 - v[1], 'blouse', 'suit');
    if (vest) {
      split(is('torso'), (v) => 0.17 - v[1], 'tie', 'torso'); // the jumpsuit's top half tied round the waist, up to here
      // The singlet: a scooped neck (deeper in front than behind) between two straps over the shoulders, and armholes
      // that open up towards the shoulder.
      split(is('torso'), (v, i) => {
        const az = Math.abs(v[2]), low = vn[i].x < 0 ? 0.5 : 0.445, e = Math.min(1, Math.max(0, (az - 0.035) / 0.04));
        const top = low + (0.64 - low) * e * e * (3 - 2 * e), arm = v[1] < 0.37 ? 0.3 : Math.max(0.112, 0.3 - ((v[1] - 0.37) / 0.15) * 0.19);
        return Math.min(top - v[1], arm - az, reg[i] === 'arm' ? -0.004 : 1);
      }, 'vest', 'skin');
    } else {
      const waist = (kd, tr) => (kd === 'suit' || kd === 'placket') && tr.every((i) => reg[i] === 'waist' || reg[i] === 'chest' || reg[i] === 'leg');
      split(waist, (v) => v[1] - 0.095, 'beltish', null);
      split(is('beltish'), (v) => 0.155 - v[1], 'belt', 'suit');
    }
    const n = tris.length * 3;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), colr = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    // The base mesh has toes. Inside a boot there are none: every toe vertex is moved onto one rounded toe box (an
    // ellipsoid set along each foot), so the boot is a single smooth shape that still bends with the toe bone.
    const toeBox = {};
    // (Which way a foot points is read off the mesh, ankle to the middle of its toes: the bone runs straighter than the foot does.)
    const footDir = (S) => { // the long axis of the foot's own vertices, pointing forwards
      const names = ['foot.' + S, 'toe.' + S], fv = D.verts.filter((v, i) => names.includes(D.bones[D.weights[i][0][0]].n) && v[1] < Math.min(...D.verts.map((q) => q[1])) + 0.085);
      const mx = fv.reduce((a, v) => a + v[0], 0) / fv.length, mz = fv.reduce((a, v) => a + v[2], 0) / fv.length;
      let sxx = 0, szz = 0, sxz = 0;
      for (const v of fv) { sxx += (v[0] - mx) ** 2; szz += (v[2] - mz) ** 2; sxz += (v[0] - mx) * (v[2] - mz); }
      const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang);
      const al = fv.map((v) => (v[0] - mx) * ux + (v[2] - mz) * uz), la = fv.map((v) => -(v[0] - mx) * uz + (v[2] - mz) * ux);
      return { ux, uz, mx, mz, a0: Math.min(...al), a1: Math.max(...al), l0: Math.min(...la), l1: Math.max(...la) };
    };
    const soleY = Math.min(...D.verts.map((v) => v[1]));
    for (const S of ['L', 'R']) { // the toe box sits at the front of the foot as the mesh has it (models differ in how their foot bones run)
      const F = footDir(S), lm = (F.l0 + F.l1) / 2, d = F.a1 - 0.07;
      toeBox[S] = { c: [F.mx + F.ux * d - F.uz * lm, soleY + 0.05, F.mz + F.uz * d + F.ux * lm], ux: F.ux, uz: F.uz, mx: F.mx, mz: F.mz, from: F.a1 - 0.16 };
    }
    // (Everything towards the front of the foot, whichever bone carries it, eased in over a few centimetres so the
    // toe box runs smoothly out of the boot.)
    const toeOf = WW.map((w, i) => {
      const m = /^(foot|toe)\.(L|R)$/.exec(D.bones[w[0][0]].n); if (!m || VV[i][1] > soleY + 0.12) return null;
      const T = toeBox[m[2]], q = VV[i], d = (q[0] - T.mx) * T.ux + (q[2] - T.mz) * T.uz, t = Math.min(1, Math.max(0, (d - T.from) / 0.06));
      return t > 0 ? [m[2], t * t * (3 - 2 * t)] : null;
    });
    const out = (vi, kd) => { // where a vertex sits when it belongs to this garment
      if (toeOf[vi]) {
        const T = toeBox[toeOf[vi][0]], q = VV[vi], rx = q[0] - T.c[0], ry = q[1] - T.c[1], rz = q[2] - T.c[2];
        let a = rx * T.ux + rz * T.uz, b = ry, c = -rx * T.uz + rz * T.ux; // along the foot, up, across it
        const A = 0.105, Bh = 0.054, Cw = 0.068, k = 1 / (Math.hypot(a / A, b / Bh, c / Cw) || 1);
        a *= k; b = Math.max(b * k, -0.046); c *= k;
        const box = new THREE.Vector3(T.c[0] + a * T.ux - c * T.uz, T.c[1] + b, T.c[2] + a * T.uz + c * T.ux);
        return new THREE.Vector3(q[0], q[1], q[2]).addScaledVector(vn[vi], WEAR.boot[1]).lerp(box, toeOf[vi][1]);
      }
      const v = VV[vi], W = WEAR[kd], fold = W[2] ? 0.006 * W[2] * (Math.sin(v[1] * 46 + Math.sin(v[0] * 31 + v[2] * 23) * 2.2) + 0.6 * Math.sin(v[2] * 58 + v[1] * 19)) : 0;
      // The trouser leg above the boot: tucked in at the bottom (inside the boot top), bulging over it, easing back
      // to the leg's own fit above.
      let off = W[1];
      if (kd === 'blouse') { const t = Math.min(1, Math.max(0, (v[1] + 0.69) / 0.09)); off = 0.018 + 0.012 * t + 0.03 * Math.sin(Math.PI * Math.min(1, t * 1.15)); }
      return new THREE.Vector3(v[0], v[1], v[2]).addScaledVector(vn[vi], off + fold);
    };
    // Each garment is shaded smooth over itself (normals averaged per vertex within the garment's stand-off), so
    // its folds catch the light and its edge against the next garment stays crisp.
    const gn = new Map(), key = (vi, kd) => vi + ':' + WEAR[kd][1] + ':' + WEAR[kd][2];
    tris.forEach((f, t) => {
      const p = f.map((vi) => out(vi, kinds[t])), fn = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
      for (const vi of f) { const k = key(vi, kinds[t]); if (!gn.has(k)) gn.set(k, new THREE.Vector3()); gn.get(k).add(fn); }
    });
    tris.forEach((f, t) => {
      const kd = kinds[t], c = WEAR[kd][0];
      f.forEach((vi, k) => {
        const o = t * 3 + k, v = out(vi, kd), w = WW[vi], nn = gn.get(key(vi, kd)).clone().normalize();
        pos.set([v.x * K, v.y * K, v.z * K], o * 3); colr.set([c.r, c.g, c.b], o * 3); nrm.set([nn.x, nn.y, nn.z], o * 3);
        for (let j = 0; j < 4; j++) { si[o * 4 + j] = w[j] ? w[j][0] : 0; sw[o * 4 + j] = w[j] ? w[j][1] : 0; }
      });
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    // Bones: every one starts unrotated (its axes are the figure's), placed by its head; so a bone's turn is simply
    // the turn that takes its resting direction to where it should point.
    const bones = D.bones.map((b) => { const o = new THREE.Bone(); o.name = b.n; return o; }), by = {};
    D.bones.forEach((b, i) => {
      const ph = b.p >= 0 ? D.bones[b.p].h : [0, 0, 0];
      bones[i].position.set((b.h[0] - ph[0]) * K, (b.h[1] - ph[1]) * K, (b.h[2] - ph[2]) * K);
      bones[i].userData.rest = new THREE.Vector3(b.t[0] - b.h[0], b.t[1] - b.h[1], b.t[2] - b.h[2]).normalize();
      bones[i].userData.len = Math.hypot(b.t[0] - b.h[0], b.t[1] - b.h[1], b.t[2] - b.h[2]) * K;
      if (b.p >= 0) bones[b.p].add(bones[i]);
      by[b.n] = bones[i];
    });
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02, side: THREE.DoubleSide }));
    mesh.add(bones[0]);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.frustumCulled = false; // (its bounds are the resting pose's; a posed figure can be outside them)
    mesh.userData.noGrime = true;
    // Hard parts that ride on a bone: boot soles and toe caps (the base mesh has bare feet), and a belt buckle.
    const part = (bone, geo, color, at, extra) => { const b = D.bones.find((x) => x.n === bone), m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, flatShading: true }, extra))); m.position.set((at[0] - b.h[0]) * K, (at[1] - b.h[1]) * K, (at[2] - b.h[2]) * K); m.userData.noGrime = true; by[bone].add(m); return m; };
    const frontAt = (y) => Math.max(...D.verts.filter((v) => Math.abs(v[1] - y) < 0.03 && Math.abs(v[2]) < 0.05).map((v) => v[0]));
    for (const S of ['L', 'R']) {
      // (Their turn to follow the foot is baked into the shapes: turned in place under the body's uneven scale they would shear.)
      const F = footDir(S), turn = -Math.atan2(F.uz, F.ux), len = F.a1 - F.a0 + 0.07, wid = F.l1 - F.l0 + 0.07, lm = (F.l0 + F.l1) / 2;
      const on = (d) => [F.mx + F.ux * d - F.uz * lm, 0, F.mz + F.uz * d + F.ux * lm]; // a point along the middle of the foot
      const sole = on((F.a0 + F.a1) / 2), heel = on(F.a0 + 0.02);
      part('foot.' + S, new THREE.BoxGeometry(len * K, 0.034 * K, wid * K).rotateY(turn), '#141210', [sole[0], soleY - 0.003, sole[2]]);
      part('foot.' + S, new THREE.BoxGeometry(0.09 * K, 0.05 * K, wid * K).rotateY(turn), '#141210', [heel[0], soleY + 0.03, heel[2]]);
    }
    if (!vest) part('hips', new THREE.BoxGeometry(0.014 * K, 0.05 * K, 0.06 * K), '#d9b24a', [frontAt(0.125) + 0.045, 0.125, 0], { metalness: 0.4, roughness: 0.4 });
    else if (typeof People !== 'undefined') {
      // The jumpsuit's top half tied round the waist, the knot on the hip (round to the right, well clear of the
      // middle): a lump of bunched cloth, and the two sleeve ends hanging down the outside of the thigh at different
      // lengths, flat against the leg, each still with its cuff.
      const tie = new THREE.Group(), P = People, cloth = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 });
      const suitM = cloth(paint.suit), foldM = cloth(C.seam), cuffM = cloth(C.trim);
      const ang = 0.82, dx = Math.cos(ang), dz = Math.sin(ang); // which way round the waist the knot sits
      const hip = D.verts.filter((v, i) => Math.abs(v[1] - 0.08) < 0.03 && (reg[i] === 'waist' || reg[i] === 'leg')).reduce((m, v) => (v[0] * dx + v[2] * dz > m[0] * dx + m[2] * dz ? v : m));
      tie.position.set((hip[0] + dx * 0.06) * K, 0.085 * K, (hip[2] + dz * 0.06) * K);
      tie.rotation.y = -ang; // its own x axis points out from the hip
      const k1 = P.lump(tie, [0.2, 0.2, 0.3], suitM, [0, 0, 0], 8); k1.rotation.set(0.5, 0, 0.2);
      const k2 = P.lump(tie, [0.16, 0.14, 0.22], foldM, [0.06, -0.1, -0.08], 7); k2.rotation.set(-0.6, 0.2, 0); // the wrap over the knot, in shadow
      for (const [pts, r] of [
        [[[0, -0.12, -0.14], [0.06, -0.8, -0.34], [0.02, -1.6, -0.4], [-0.04, -1.9, -0.4]], [0.17, 0.26, 0.29, 0.3]],
        [[[0, -0.1, 0.14], [0.05, -0.65, 0.36], [0, -1.15, 0.44], [-0.05, -1.4, 0.45]], [0.16, 0.25, 0.28, 0.29]],
      ]) P.tube(tie, pts, r, [suitM, cuffM], [0, 0, 1]);
      tie.scale.x = 0.45; // sleeves hang flat, not as round tubes
      tie.traverse((m) => { if (m.isMesh) m.userData.noGrime = true; });
      by.hips.add(tie);
    }
    return { mesh, bones: by, root: bones[0], data: D, verts: VV, eyes: D.tag ? [1, 2].map((tg) => { const ev = D.verts.filter((v, i) => D.tag[i] === tg); return { c: [0, 1, 2].map((k) => ev.reduce((a, v) => a + v[k], 0) / ev.length), r: (Math.max(...ev.map((v) => v[1])) - Math.min(...ev.map((v) => v[1]))) / 2 }; }) : null, index: Object.fromEntries(D.bones.map((b, i) => [b.n, i])) };
  },

  // Turn a bone so it points along dir (in the figure's own axes), its parents already posed.
  aim(B, name, dir) {
    const b = B.bones[name], pq = new THREE.Quaternion();
    for (let p = b.parent; p && p.isBone; p = p.parent) pq.premultiply(p.quaternion);
    const want = new THREE.Quaternion().setFromUnitVectors(b.userData.rest, new THREE.Vector3(...dir).normalize());
    b.quaternion.copy(pq.invert().multiply(want));
  },
  // Where a bone's head is, in the figure's axes, as posed so far.
  at(B, name) {
    const chain = []; for (let p = B.bones[name]; p && p.isBone; p = p.parent) chain.unshift(p);
    const v = new THREE.Vector3(), q = new THREE.Quaternion();
    for (const p of chain) { v.add(p.position.clone().applyQuaternion(q)); q.multiply(p.quaternion); }
    return v;
  },
  // An arm reaching for a wrist point, its elbow out towards a hint point (figure units): two bones of fixed length,
  // so the elbow is placed where they meet. The hand carries on along the forearm unless given its own direction.
  reach(B, side, elbow, wrist, handDir) {
    const S = side < 0 ? 'L' : 'R', up = B.bones['upper_arm.' + S], fo = B.bones['forearm.' + S];
    const sh = Body.at(B, 'upper_arm.' + S), W = new THREE.Vector3(...wrist), l1 = up.userData.len, l2 = fo.userData.len;
    const sw = W.clone().sub(sh), d = Math.min(sw.length(), (l1 + l2) * 0.999), dir = sw.clone().normalize();
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const pole = new THREE.Vector3(...elbow).sub(sh); pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const E = sh.clone().addScaledVector(dir, a).addScaledVector(pole, h), Wr = sh.clone().addScaledVector(dir, d);
    Body.aim(B, 'upper_arm.' + S, E.clone().sub(sh).toArray());
    Body.aim(B, 'forearm.' + S, Wr.clone().sub(E).toArray());
    Body.aim(B, 'hand.' + S, handDir || Wr.clone().sub(E).toArray());
  },
  // A leg. Standing, the foot and toes keep the set they were modelled with (so boots and their soles stay in
  // line); seated, the foot is given a direction and the toes follow it.
  leg(B, side, thigh, shin, foot) {
    const S = side < 0 ? 'L' : 'R', rest = (n) => B.bones[n + '.' + S].userData.rest.toArray();
    Body.aim(B, 'thigh.' + S, thigh); Body.aim(B, 'shin.' + S, shin);
    Body.aim(B, 'foot.' + S, foot ? [foot[0], foot[1], rest('foot')[2] * foot[0] / rest('foot')[0]] : rest('foot'));
    Body.aim(B, 'toe.' + S, foot ? [foot[0], foot[1] + 0.08, rest('toe')[2]] : rest('toe'));
  },

  // The whole person: same options and userData as People.polyFigure (which hands over to this), on the rigged body.
  figure(o, L, M, skinC, suitC) {
    const P = People, w = P.BUILD[L.build] || 1, walk = o.pose === 'walk', stand = o.pose === 'stand' || walk, vest = L.top === 'vest' && o.role !== 'trader';
    const kind = o.fullHead ? 'full' : 'male';
    const B = Body.make(kind, { suit: suitC, skin: skinC, glove: o.role === 'trader' ? skinC : '#3a2a20', top: vest ? 'vest' : 'suit', rolled: L.rolled, head: !!o.fullHead, eye: L.eye, hair: L.hair, hat: L.hat, gear: o.helmet ? 'shaved' : L.gear, beard: L.beard, brow: L.brow });
    const g = new THREE.Group(), torso = new THREE.Group();
    g.add(torso, B.mesh);
    if (kind === 'full') B.mesh.scale.set(1, 1, 1 + (w - 1) * 1.1); else B.mesh.scale.set(1.12, 1, 1.14 + (w - 1) * 1.1); // a stockier frame than the base mesh's; builds differ in breadth
    if (stand) {
      for (const s of [-1, 1]) { Body.leg(B, s, [0.02, -1, s * 0.07], [-0.04, -1, s * 0.03]); }
    } else {
      const LEG = o.leg ? [[0.3, 0.55], o.leg.knee, o.leg.ankle] : [[0.3, 0.55], [4.1, 0.9], [4.7, -3.3]];
      for (const s of [-1, 1]) Body.leg(B, s, [LEG[1][0] - LEG[0][0], LEG[1][1] - LEG[0][1] + 0.45, s * 0.45], [LEG[2][0] - LEG[1][0], LEG[2][1] - LEG[1][1], s * 0.05], [1, -0.12, 0]);
    }
    if (o.arms === 'static') {
      const A = P.ARM_POSES[o.role] || P.ARM_POSES.driver;
      const sx = B.mesh.scale.x, sz = B.mesh.scale.z, un = (q) => [q[0] / sx, q[1], q[2] / sz]; // (targets are in the figure's units; the body is scaled)
      for (const s of [-1, 1]) {
        const [el, wr] = A[s < 0 ? 0 : 1];
        if (o.role === 'driver') { Body.reach(B, s, un(el), un([wr[0] - 0.5, wr[1] + 0.3, wr[2] * 1.12]), [0.45, 0.75, -s * 0.12]); Body.grip(B, s, 1); } // wrists short of the rim, fists closed round it at ten to two
        else { Body.reach(B, s, un(el), un(wr)); Body.grip(B, s, 0.85); }
      }
      if (o.role === 'driver') { const r = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.16, 5, 12), M.dark); r.position.set(3.75, 3.95, 0); r.rotation.y = Math.PI / 2 - 0.35; g.add(r); }
      if (o.role === 'gunner') P.slab(g, [2.8, 0.5, 0.4], M.dark, [3.3, 3.6, 0.2]);
    } else if (o.arms !== 'none') {
      for (const s of [-1, 1]) { Body.reach(B, s, [-0.6, 2.3, s * 2.0], [0.55, 0.45, s * 1.95]); Body.grip(B, s, 0.35); }
    }
    // The head we already have (the face, hair and hats), on the body's neck.
    const head = new THREE.Group(), hb = B.bones.head, hp = Body.at(B, 'head');
    head.position.set(hp.x + 0.12, hp.y + 0.1, hp.z);
    g.add(head);
    if (o.fullHead) { // the model's mouth hangs open: its lower lip is brought up, and the upper down a touch, to close it
      for (const n of ['Head_L.001', 'Head_R.001']) if (B.bones[n]) B.bones[n].position.y += 0.023 * Body.K;
      for (const n of ['Head_L', 'Head_R']) if (B.bones[n]) B.bones[n].position.y -= 0.005 * Body.K;
      if (L.shades && o.role !== 'trader' && B.eyes) { // sunglasses, on the head bone: two lenses, a bridge, and arms back to the ears
        const K = Body.K, hb = B.data.bones[B.index.head], E = B.eyes, frame = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.4 }), lens = new THREE.MeshStandardMaterial({ color: '#2c3a48', roughness: 0.12, metalness: 0.5 });
        const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set((x - hb.h[0]) * K, (y - hb.h[1]) * K, (z - hb.h[2]) * K); m.userData.noGrime = true; B.bones.head.add(m); return m; };
        const fx = E[0].c[0] + E[0].r + 0.012, ey = E[0].c[1] + 0.002, ez = Math.abs(E[0].c[2]);
        for (const sd of [-1, 1]) {
          put(new THREE.BoxGeometry(0.006 * K, 0.036 * K, 0.06 * K), lens, fx, ey, sd * ez).rotation.y = sd * -0.12;
          put(new THREE.BoxGeometry(0.008 * K, 0.042 * K, 0.066 * K), frame, fx - 0.004, ey, sd * ez).rotation.y = sd * -0.12;
          put(new THREE.BoxGeometry(0.12 * K, 0.008 * K, 0.005 * K), frame, fx - 0.062, ey + 0.008, sd * (ez + 0.036)).rotation.y = sd * -0.22;
        }
        put(new THREE.BoxGeometry(0.006 * K, 0.008 * K, 0.03 * K), frame, fx, ey + 0.006, 0);
      }
    }
    if (o.head !== false && o.head && !o.fullHead) P.polyHead(head, M, Object.assign({}, L, { shades: L.shades && o.role !== 'trader' }), o.helmet ? 'helmet' : L.gear);
    if (!vest && o.head) {
      // The collar: a clean ring standing round the base of the neck (on the chest bone), a little open at the throat.
      const D = B.data, cb = D.bones[B.index.chest], K = Body.K, ni = B.index.neck, ring = B.verts.slice(0, D.verts.length).filter((v, i) => v[1] > 0.56 && v[1] < 0.6 && D.weights[i].some(([bi, w]) => bi === ni && w > 0.25));
      const xs = ring.map((v) => v[0]), zs = ring.map((v) => Math.abs(v[2])), cx = (Math.min(...xs) + Math.max(...xs)) / 2, rx = (Math.max(...xs) - Math.min(...xs)) / 2, rz = Math.max(...zs);
      const col = new THREE.Group();
      col.position.set(-cb.h[0] * K, -cb.h[1] * K, -cb.h[2] * K);
      P.loft(col, [{ y: 0.55 * K, rx: (rx + 0.05) * K, rz: (rz + 0.054) * K, x: (cx - 0.012) * K }, { y: 0.572 * K, rx: (rx + 0.03) * K, rz: (rz + 0.032) * K, x: cx * K }, { y: 0.59 * K, rx: (rx + 0.022) * K, rz: (rz + 0.024) * K, x: (cx + 0.003) * K }], M.trim);
      col.traverse((m) => { if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(suitC).lerp(new THREE.Color('#f2e6c8'), 0.14), roughness: 0.9, side: THREE.DoubleSide }); });
      B.bones.chest.add(col);
    }
    let patch = null;
    if (!vest) { // the number, sewn on the chest and riding on the chest bone
      const cb = B.data.bones[B.index.chest], py = 0.4, pz = -0.075, px = Math.max(...B.data.verts.filter((v) => Math.abs(v[1] - py) < 0.035 && Math.abs(v[2] - pz) < 0.05).map((v) => v[0])) + 0.043;
      patch = LP.mesh(new THREE.PlaneGeometry(1.15, 0.48), new THREE.MeshStandardMaterial({ map: P.patch(o.number || L.number), roughness: 0.9, transparent: true }), (px - cb.h[0]) * Body.K, (py - cb.h[1]) * Body.K, (pz - cb.h[2]) * Body.K);
      patch.rotation.y = Math.PI / 2 + 0.22;
      B.bones.chest.add(patch);
    }
    g.traverse((m) => { if (m.isMesh) m.userData.noGrime = true; });
    g.userData = { torso, head, patch, looks: L, M, legs: [], arms: [], helmet: !!o.helmet, armMat: vest ? M.skin : M.suit, shoulders: [[0.05, 4.25, -1.72 * w], [0.05, 4.25, 1.72 * w]], poly: true, body: B };
    return g;
  },

  // Curl the fingers of one hand round something (0 = as modelled, 1 = a fist). Each joint bends about the line of
  // the knuckles, the way that closes the hand on its palm. (One model has four fingers; the other a single mitten.)
  grip(B, side, k) {
    const S = side < 0 ? 'L' : 'R', D = B.data, bn = (n) => D.bones[B.index[n]], v = (a) => new THREE.Vector3(...a);
    const mitt = B.index['f_all.01.' + S] != null, f0 = bn((mitt ? 'f_all.01.' : 'f_middle.01.') + S), fd = v(f0.t).sub(v(f0.h)).normalize();
    // the palm's side: modelled palm-down in the T pose on the mitten model; towards the thumb's tip on the other
    const palm = mitt ? v([0, -1, 0]) : v(bn('thumb.03.' + S).t).sub(v(f0.h)).normalize();
    const across = mitt ? new THREE.Vector3().crossVectors(fd, palm).normalize() : v(bn('palm.04.' + S).t).sub(v(bn('palm.01.' + S).t)).normalize();
    const sign = fd.clone().applyAxisAngle(across, 0.4).dot(palm) > fd.clone().applyAxisAngle(across, -0.4).dot(palm) ? 1 : -1;
    for (const f of mitt ? ['f_all'] : ['f_index', 'f_middle', 'f_ring', 'f_pinky']) for (const j of ['01', '02', '03']) {
      const b = B.bones[`${f}.${j}.${S}`];
      if (b) b.quaternion.setFromAxisAngle(across, sign * k * (j === '01' ? 0.75 : 0.95));
    }
  },
};
