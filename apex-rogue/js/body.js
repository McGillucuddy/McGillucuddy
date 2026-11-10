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
    const C = { suit: col(paint.suit), skin: col(paint.skin), glove: col(paint.glove || paint.skin), boot: col(paint.boot || '#22180f'), vest: col('#eeeae0'), trim: col(paint.suit).lerp(col('#f2e6c8'), 0.45), belt: col('#3a2416') };
    const vest = paint.top === 'vest';
    const reg = D.weights.map((w) => Body.region(D.bones[w[0][0]].n));
    const faceCol = (f) => {
      const r = f.map((i) => reg[i]), has = (x) => r.includes(x), all = (x) => r.every((q) => q === x), y = Math.min(...f.map((i) => D.verts[i][1])), yTop = Math.max(...f.map((i) => D.verts[i][1]));
      if (all('hand') || (has('hand') && !vest && !paint.rolled && false)) return C.glove;
      if (has('hand')) return vest || paint.rolled ? C.glove : C.trim; // the cuff
      if (has('foot') || (has('shin') && yTop < -0.66)) return C.boot;
      if (has('neck') || has('head')) return all('neck') || has('head') ? C.skin : (vest ? C.skin : C.trim); // the collar
      if (has('forearm') && !has('arm')) return vest || paint.rolled ? C.skin : C.suit;
      if (has('arm') && has('chest')) return vest ? C.vest : C.suit; // the shoulder seam
      if (has('arm') || has('forearm')) return vest ? C.skin : C.suit;
      if (y > 0.1 && yTop < 0.2 && !has('leg')) return C.belt;
      if (has('chest') || (has('waist') && y > 0.16)) return vest ? C.vest : C.suit;
      return C.suit;
    };
    const tris = paint.head ? D.tris : D.tris.filter((f) => !f.every((i) => reg[i] === 'head'));
    const n = tris.length * 3, pos = new Float32Array(n * 3), colr = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    tris.forEach((f, t) => {
      const c = faceCol(f);
      f.forEach((vi, k) => {
        const o = t * 3 + k, v = D.verts[vi], w = D.weights[vi];
        pos.set([v[0] * K, v[1] * K, v[2] * K], o * 3); colr.set([c.r, c.g, c.b], o * 3);
        for (let j = 0; j < 4; j++) { si[o * 4 + j] = w[j] ? w[j][0] : 0; sw[o * 4 + j] = w[j] ? w[j][1] : 0; }
      });
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.computeVertexNormals();
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
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.02 }));
    mesh.add(bones[0]);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.frustumCulled = false; // (its bounds are the resting pose's; a posed figure can be outside them)
    mesh.userData.noGrime = true;
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
