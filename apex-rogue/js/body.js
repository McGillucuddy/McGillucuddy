'use strict';
// People built on a rigged low-poly body (js/basemesh.js) in place of lofted tubes: one skinned mesh with real
// shoulders, hands and feet, dressed by painting its faces (jumpsuit, skin, gloves, boots) and posed by turning its
// bones. Flat-shaded, so it keeps the faceted look.
const Body = {
  K: 8.4, // metres to figure units: the shoulders land where the old figure's did, the soles where its boots stood

  // Which part of the body a bone belongs to (decides what a face is painted as).
  region(n) {
    if (n === 'head') return 'head';
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

  // The skinned body. paint: { suit, skin, glove, boot, top ('suit' | 'vest'), rolled, head (keep the mesh's own head) }.
  make(kind, paint) {
    const D = BASEMESH[kind] || BASEMESH.male, K = Body.K, col = (c) => new THREE.Color(c);
    const C = { suit: col(paint.suit), skin: col(paint.skin), glove: col(paint.glove || paint.skin), boot: col(paint.boot || '#22180f'), vest: col('#eeeae0'), trim: col(paint.suit).lerp(col('#f2e6c8'), 0.45), belt: col('#3a2416'), seam: col(paint.suit).lerp(col('#000000'), 0.3) };
    const vest = paint.top === 'vest', bare = vest || paint.rolled;
    const reg = D.weights.map((w) => Body.region(D.bones[w[0][0]].n));
    // Smooth normals of the bare body: the average of the faces round each vertex.
    const vn = D.verts.map(() => new THREE.Vector3()), P3 = (i) => new THREE.Vector3(...D.verts[i]);
    for (const f of D.tris) { const a = P3(f[0]), fn = P3(f[1]).sub(a).cross(P3(f[2]).sub(a)); for (const i of f) vn[i].add(fn); }
    for (const v of vn) v.normalize();
    // Clothes. Every face is one garment, and a garment stands off the body by its own thickness (pushed out along
    // the normals), so cloth hangs outside the skin with an edge where it ends: an open cuff round the wrist, a
    // collar standing off the neck, a trouser leg bloused over a boot wider than the ankle. WEAR: [colour, stand-off
    // in metres, how much it wrinkles]. Heights are metres above the hips (belt 0.1, shoulder 0.5, knee -0.44, sole -0.99).
    const WEAR = {
      skin: [C.skin, 0, 0], glove: [C.glove, 0.007, 0], suit: [C.suit, 0.03, 1], sleeve: [C.suit, 0.026, 1], cuff: [C.trim, 0.034, 0.3], roll: [C.suit, 0.046, 0.4],
      collar: [C.trim, 0.04, 0], placket: [col(paint.suit).lerp(col('#f2e6c8'), 0.2), 0.036, 0.2], pocket: [C.seam, 0.037, 0.2], belt: [C.belt, 0.043, 0], boot: [C.boot, 0.036, 0], blouse: [C.suit, 0.05, 1],
      vest: [C.vest, 0.016, 0.5], tie: [C.suit, 0.062, 1.4],
    };
    const wear = (f) => {
      const r = f.map((i) => reg[i]), has = (x) => r.includes(x), all = (x) => r.every((q) => q === x);
      const avg = (g) => f.reduce((a, i) => a + g(i), 0) / f.length, cy = avg((i) => D.verts[i][1]), cz = avg((i) => D.verts[i][2]), front = avg((i) => vn[i].x) > 0.55;
      const zMax = Math.max(...f.map((i) => Math.abs(D.verts[i][2])));
      if (all('hand')) return 'glove';
      if (has('hand')) return bare ? 'glove' : 'cuff';
      if (has('foot') || (has('shin') && cy < -0.69)) return 'boot';
      if (has('shin') && cy < -0.6) return 'blouse'; // the trouser leg gathered into the boot top
      if (has('head') || all('neck')) return 'skin';
      if (has('neck')) return vest ? 'skin' : 'collar';
      if (has('forearm') && !has('arm')) return bare ? 'skin' : 'sleeve';
      if (has('forearm') && has('arm')) return vest ? 'skin' : paint.rolled ? 'roll' : 'sleeve'; // the elbow (where a rolled sleeve sits)
      if (has('arm')) return has('chest') ? (vest ? 'vest' : 'suit') : vest ? 'skin' : 'sleeve';
      if (has('leg') || has('shin')) return 'suit';
      if (vest) return cy > 0.17 ? 'vest' : cy > 0.02 ? 'tie' : 'suit'; // (the jumpsuit's top half tied round the waist)
      if (cy > 0.095 && cy < 0.155) return 'belt';
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
    const tris = D.tris.filter((f, t) => keep[t]), kinds = kindOf.filter((k, t) => keep[t]), n = tris.length * 3;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), colr = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const out = (vi, kd) => { // where a vertex sits when it belongs to this garment
      const v = D.verts[vi], W = WEAR[kd], fold = W[2] ? 0.006 * W[2] * (Math.sin(v[1] * 46 + Math.sin(v[0] * 31 + v[2] * 23) * 2.2) + 0.6 * Math.sin(v[2] * 58 + v[1] * 19)) : 0;
      return new THREE.Vector3(v[0], v[1], v[2]).addScaledVector(vn[vi], W[1] + fold);
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
        const o = t * 3 + k, v = out(vi, kd), w = D.weights[vi], nn = gn.get(key(vi, kd)).clone().normalize();
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
      const ft = D.bones.find((x) => x.n === 'foot.' + S), tz = (ft.h[2] + ft.t[2]) / 2 + (ft.t[2] - ft.h[2]) * 0.1;
      part('foot.' + S, new THREE.BoxGeometry(0.33 * K, 0.035 * K, 0.125 * K), '#141210', [ft.h[0] + 0.115, -0.985, tz]).rotation.y = -Math.atan2(ft.t[2] - ft.h[2], ft.t[0] - ft.h[0]); // sole
      part('foot.' + S, new THREE.BoxGeometry(0.08 * K, 0.05 * K, 0.125 * K), '#141210', [ft.h[0] - 0.03, -0.95, ft.h[2]]).rotation.y = -Math.atan2(ft.t[2] - ft.h[2], ft.t[0] - ft.h[0]); // heel
      const cap = part('toe.' + S, new THREE.SphereGeometry(0.062 * K, 8, 6), paint.boot || '#22180f', [ft.t[0] + 0.035, -0.935, ft.t[2] + (ft.t[2] - ft.h[2]) * 0.2]); cap.scale.set(1.5, 0.8, 1.05); // toe cap, over the toes
    }
    if (!vest) part('hips', new THREE.BoxGeometry(0.014 * K, 0.05 * K, 0.06 * K), '#d9b24a', [frontAt(0.125) + 0.045, 0.125, 0], { metalness: 0.4, roughness: 0.4 });
    else if (typeof People !== 'undefined') {
      // The jumpsuit's top half tied round the waist: its two sleeves knotted in front, a little off-centre, the knot
      // a lump of bunched cloth, and the sleeve ends hanging from it at different lengths, each still with its cuff.
      const tie = new THREE.Group(), P = People, cloth = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 });
      const suitM = cloth(paint.suit), foldM = cloth(C.seam), cuffM = cloth(C.trim);
      const X = (frontAt(0.08) + 0.052) * K, Y = 0.085 * K, Z = 0.28;
      const k1 = P.lump(tie, [0.2, 0.19, 0.3], suitM, [X, Y, Z], 8); k1.rotation.set(0.5, 0, 0.2);
      const k2 = P.lump(tie, [0.17, 0.15, 0.22], foldM, [X + 0.07, Y - 0.1, Z - 0.1], 7); k2.rotation.set(-0.6, 0.2, 0); // the wrap over the knot, in shadow
      for (const [pts, r] of [
        [[[X + 0.02, Y - 0.12, Z - 0.12], [X + 0.14, Y - 0.75, Z - 0.42], [X + 0.1, Y - 1.5, Z - 0.56], [X + 0.02, Y - 1.78, Z - 0.6]], [0.17, 0.26, 0.29, 0.3]],
        [[[X + 0.02, Y - 0.1, Z + 0.1], [X + 0.12, Y - 0.6, Z + 0.34], [X + 0.06, Y - 1.1, Z + 0.5], [X - 0.02, Y - 1.34, Z + 0.56]], [0.16, 0.25, 0.28, 0.29]],
      ]) P.tube(tie, pts, r, [suitM, cuffM], [0, 0, 1]);
      tie.scale.x = 0.5; tie.position.x = X * 0.5; // sleeves hang flat against the legs, not as round tubes
      tie.traverse((m) => { if (m.isMesh) m.userData.noGrime = true; });
      by.hips.add(tie);
    }
    return { mesh, bones: by, root: bones[0], data: D, index: Object.fromEntries(D.bones.map((b, i) => [b.n, i])) };
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
  leg(B, side, thigh, shin, foot) {
    const S = side < 0 ? 'L' : 'R';
    Body.aim(B, 'thigh.' + S, thigh); Body.aim(B, 'shin.' + S, shin); Body.aim(B, 'foot.' + S, foot || [1, -0.25, 0]); Body.aim(B, 'toe.' + S, [1, 0, 0]);
  },
  // The whole person: same options and userData as People.polyFigure (which hands over to this), on the rigged body.
  figure(o, L, M, skinC, suitC) {
    const P = People, w = P.BUILD[L.build] || 1, walk = o.pose === 'walk', stand = o.pose === 'stand' || walk, vest = L.top === 'vest' && o.role !== 'trader';
    const B = Body.make('male', { suit: suitC, skin: skinC, glove: o.role === 'trader' ? skinC : '#3a2a20', top: vest ? 'vest' : 'suit', rolled: L.rolled });
    const g = new THREE.Group(), torso = new THREE.Group();
    g.add(torso, B.mesh);
    B.mesh.scale.set(1.12, 1, 1.14 + (w - 1) * 1.1); // a stockier frame than the base mesh's; builds differ in breadth
    if (stand) {
      for (const s of [-1, 1]) { Body.leg(B, s, [0.02, -1, s * 0.07], [-0.04, -1, s * 0.03]); }
    } else {
      const LEG = o.leg ? [[0.3, 0.55], o.leg.knee, o.leg.ankle] : [[0.3, 0.55], [4.1, 0.9], [4.7, -3.3]];
      for (const s of [-1, 1]) Body.leg(B, s, [LEG[1][0] - LEG[0][0], LEG[1][1] - LEG[0][1] + 0.9, s * 0.55], [LEG[2][0] - LEG[1][0], LEG[2][1] - LEG[1][1], s * 0.05], [1, 0.15, 0]);
    }
    if (o.arms === 'static') {
      const A = P.ARM_POSES[o.role] || P.ARM_POSES.driver;
      for (const s of [-1, 1]) { const [el, wr] = A[s < 0 ? 0 : 1]; Body.reach(B, s, el.map((v, i) => v / (i === 2 ? B.mesh.scale.z : i ? 1 : B.mesh.scale.x)), wr.map((v, i) => v / (i === 2 ? B.mesh.scale.z : i ? 1 : B.mesh.scale.x))); Body.grip(B, s, 0.85); }
      if (o.role === 'driver') { const r = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.16, 5, 12), M.dark); r.position.set(3.75, 3.95, 0); r.rotation.y = Math.PI / 2 - 0.35; g.add(r); }
      if (o.role === 'gunner') P.slab(g, [2.8, 0.5, 0.4], M.dark, [3.3, 3.6, 0.2]);
    } else if (o.arms !== 'none') {
      for (const s of [-1, 1]) { Body.reach(B, s, [-0.6, 2.3, s * 2.0], [0.55, 0.45, s * 1.95]); Body.grip(B, s, 0.35); }
    }
    // The head we already have (the face, hair and hats), on the body's neck.
    const head = new THREE.Group(), hb = B.bones.head, hp = Body.at(B, 'head');
    head.position.set(hp.x - 0.35, hp.y + 0.12, hp.z);
    g.add(head);
    if (o.head !== false && o.head) P.polyHead(head, M, Object.assign({}, L, { shades: L.shades && o.role !== 'trader' }), o.helmet ? 'helmet' : L.gear);
    let patch = null;
    if (!vest) {
      patch = LP.mesh(new THREE.PlaneGeometry(1.2, 0.5), new THREE.MeshStandardMaterial({ map: P.patch(o.number || L.number), roughness: 0.9, transparent: true }), 1.2, 3.35, -0.62);
      patch.rotation.y = Math.PI / 2 + 0.3;
      g.add(patch);
    }
    g.traverse((m) => { if (m.isMesh) m.userData.noGrime = true; });
    g.userData = { torso, head, patch, looks: L, M, legs: [], arms: [], helmet: !!o.helmet, armMat: vest ? M.skin : M.suit, shoulders: [[0.05, 4.25, -1.72 * w], [0.05, 4.25, 1.72 * w]], poly: true, body: B };
    return g;
  },

  // Curl the fingers of one hand round something (0 = as modelled, 1 = a fist). Each joint bends about the line of
  // the knuckles, the way that brings the fingertips in towards the thumb.
  grip(B, side, k) {
    const S = side < 0 ? 'L' : 'R', D = B.data, bn = (n) => D.bones[B.index[n]], v = (a) => new THREE.Vector3(...a);
    const across = v(bn('palm.04.' + S).t).sub(v(bn('palm.01.' + S).t)).normalize();
    const f0 = bn('f_middle.01.' + S), fd = v(f0.t).sub(v(f0.h)).normalize(), toThumb = v(bn('thumb.03.' + S).t).sub(v(f0.h)).normalize();
    const sign = fd.clone().applyAxisAngle(across, 0.4).dot(toThumb) > fd.clone().applyAxisAngle(across, -0.4).dot(toThumb) ? 1 : -1;
    for (const f of ['f_index', 'f_middle', 'f_ring', 'f_pinky']) for (const j of ['01', '02', '03']) {
      const b = B.bones[`${f}.${j}.${S}`];
      if (b) b.quaternion.setFromAxisAngle(across, sign * k * (j === '01' ? 0.75 : 0.95));
    }
  },
};
