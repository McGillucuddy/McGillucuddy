'use strict';
// People: one sculpted body for everyone in the game. Your driver at the wheel, your own lap and chest when you look
// down, the rival crews, the commissary trader. A head with a jaw, cheekbones, brows, eyes (whites and irises), a
// nose with a bridge and nostrils, lips and ears, four face shapes, beards (stubble, full, goatee, moustache), a
// hairline (buzz cut, slicked back) or a beanie, bandana, cap or helmet. A torso with a chest, waist and sloping
// shoulders in three builds, in a jumpsuit (fold-over collar, zip, pocket, waist seam, number patch) or with the top
// tied round the waist over a vest; sleeves sometimes rolled; prison tattoos. Limbs posed from joint positions.
//
// Figure space: origin at the hips (on the seat for a seated pose, the pelvis for a standing one), +x forward,
// +y up, +z to the right, as in the cabin. The torso pivots at the hips and the head at the top of the neck, so the
// 3D view can make people flinch, glance about and slump.

const People = {
  SKIN: ['#f0cdb0', '#e0b89a', '#c48a64', '#a06a46', '#7a4a2e', '#5a3a26'],
  SUIT: ['#d96a1e', '#d0601a', '#c85a14', '#d98a1e'],
  HAIR: ['#1a1410', '#3a2a1a', '#6a4a2a', '#8a8070', '#2a2420'],
  HAT: ['#2a2a2e', '#7a1e1a', '#2a4a6a', '#3a4a2a', '#5a4a3a'],
  BUILD: { slim: 0.88, avg: 1, heavy: 1.14 }, // shoulder and chest width

  // Everything random about a person, from a seed.
  looks(seed) {
    const r = mulberry32(((seed | 0) * 7919 + 13) >>> 0), pick = (a) => a[Math.floor(r() * a.length)];
    return {
      skin: pick(People.SKIN), suit: pick(People.SUIT), hair: pick(People.HAIR), hat: pick(People.HAT),
      gear: pick(['beanie', 'bandana', 'shaved', 'hair', 'buzz', 'cap', 'beanie', 'buzz']),
      beard: pick(['none', 'none', 'stubble', 'full', 'goatee', 'moustache']), shades: r() < 0.4,
      number: String(1000 + Math.floor(r() * 9000)),
      build: pick(['slim', 'avg', 'avg', 'heavy']), face: Math.floor(r() * 4), // jaw and nose shape
      top: r() < 0.25 ? 'vest' : 'suit', // the jumpsuit top tied round the waist over a vest
      rolled: r() < 0.35, // sleeves pushed up to the elbow
      tattoo: r() < 0.35 ? pick(['tear', 'neck', 'arms']) : null, brow: r() < 0.5 ? 'scowl' : 'flat',
    };
  },

  // The head, sculpted round the top of the neck (origin), facing +x. Chin at about y 0.2, crown at about 1.95.
  head(sc, M, o) {
    const f = o.face || 0, jaw = [0, 0.06, -0.04, 0.1][f], nose = [1, 1.2, 0.9, 1.1][f], beard = o.beard === true ? 'full' : o.beard;
    sc.add(M.skin, SDF.ellipsoid([0.8, 0.92, 0.66], [0.0, 1.04, 0]), 0.25); // cranium
    sc.add(M.skin, SDF.ellipsoid([0.58, 0.44, 0.5 + jaw], [0.32, 0.5, 0]), 0.3); // jaw
    sc.add(M.skin, SDF.ellipsoid([0.24, 0.22, 0.26 + jaw * 0.5], [0.66, 0.28, 0]), 0.15); // chin
    for (const s of [-1, 1]) sc.add(M.skin, SDF.ellipsoid([0.24, 0.16, 0.18], [0.6, 0.8, s * 0.4]), 0.25); // cheekbones
    sc.add(M.skin, SDF.ellipsoid([0.16, 0.12, 0.62], [0.74, 1.15, 0]), 0.22); // brow ridge
    // Eyes: sockets, whites and a dark iris looking ahead.
    for (const s of [-1, 1]) {
      sc.cut(SDF.ellipsoid([0.13, 0.1, 0.15], [0.82, 0.98, s * 0.27]), 0.06, [M.skin]);
      sc.add(M.white, SDF.ellipsoid([0.06, 0.055, 0.085], [0.73, 0.98, s * 0.27]), 0.02);
      sc.add(M.eye, SDF.ellipsoid([0.035, 0.05, 0.05], [0.785, 0.98, s * 0.27]), 0.01);
      sc.add(M.skin, SDF.ellipsoid([0.08, 0.035, 0.11], [0.76, 1.035, s * 0.27]), 0.03); // upper lid, half over the eye
      const tilt = o.brow === 'scowl' ? s * 0.28 : s * 0.05; // a scowl: brows down at the middle
      sc.add(M.hair, SDF.box([0.07, 0.07, 0.3], 0.03, [0.87, 1.14, s * 0.27], [tilt, 0, 0]), 0.02); // eyebrow
      // Ears: a shell with the hollow cut in.
      sc.add(M.skin, SDF.ellipsoid([0.14, 0.27, 0.09], [0.02, 0.92, s * 0.66]), 0.1);
      sc.cut(SDF.ellipsoid([0.06, 0.15, 0.05], [0.05, 0.92, s * 0.72]), 0.03, [M.skin]);
    }
    // Nose: the bridge, the tip, the wings either side.
    sc.add(M.skin, SDF.cone([0.84, 1.0, 0], [0.96 + 0.04 * nose, 0.74, 0], 0.07, 0.11 * nose), 0.08);
    sc.add(M.skin, SDF.ellipsoid([0.11 * nose, 0.1, 0.13 * nose], [0.95 + 0.04 * nose, 0.72, 0]), 0.06);
    for (const s of [-1, 1]) sc.add(M.skin, SDF.ellipsoid([0.08, 0.07, 0.07], [0.9, 0.69, s * 0.1 * nose]), 0.05);
    // Mouth: upper and lower lip with the line between.
    sc.add(M.lip, SDF.ellipsoid([0.06, 0.05, 0.21], [0.88, 0.51, 0]), 0.03);
    sc.add(M.lip, SDF.ellipsoid([0.07, 0.055, 0.19], [0.86, 0.45, 0]), 0.03);
    sc.cut(SDF.box([0.1, 0.018, 0.24], 0.01, [0.92, 0.48, 0]), 0.01, [M.lip, M.skin]);
    // Facial hair.
    if (beard === 'full') { sc.add(M.hair, SDF.ellipsoid([0.62, 0.48, 0.58 + jaw], [0.38, 0.42, 0]), 0.12); sc.cut(SDF.ellipsoid([0.12, 0.08, 0.22], [0.9, 0.48, 0]), 0.03, [M.hair]); }
    else if (beard === 'goatee') sc.add(M.hair, SDF.ellipsoid([0.16, 0.22, 0.2], [0.76, 0.3, 0]), 0.06);
    else if (beard === 'moustache') sc.add(M.hair, SDF.ellipsoid([0.08, 0.06, 0.26], [0.92, 0.57, 0]), 0.03);
    else if (beard === 'stubble') { sc.add(M.stubble, SDF.ellipsoid([0.59, 0.43, 0.51 + jaw], [0.33, 0.48, 0]), 0.04); sc.cut(SDF.box([1.4, 0.6, 1.4], 0.1, [0.4, 1.0, 0]), 0.1, [M.stubble]); } // shadow along the jaw only
    if (o.tattoo === 'tear') sc.add(M.ink, SDF.ellipsoid([0.03, 0.06, 0.03], [0.8, 0.84, 0.32]), 0.01); // a teardrop under the eye
    if (o.shades) sc.add(M.shades, SDF.box([0.14, 0.18, 1.08], 0.06, [0.88, 1.0, 0]), 0.05);
    const g = o.helmet ? 'helmet' : o.gear;
    // Hair: a shell over the skull, cut back to a hairline at the forehead and above the ears.
    const hairline = (shell) => { sc.add(M.hair, shell, 0.15); sc.cut(SDF.box([1.2, 0.8, 1.6], 0.2, [0.95, 0.75, 0]), 0.15, [M.hair]); sc.cut(SDF.box([1.4, 0.7, 1.8], 0.2, [0.0, 0.35, 0]), 0.2, [M.hair]); };
    if (g === 'helmet') {
      sc.add(M.helmet, SDF.ellipsoid([0.98, 0.98, 0.82], [0, 1.28, 0]), 0.2);
      sc.add(M.shades, SDF.box([0.2, 0.34, 1.3], 0.1, [0.82, 1.06, 0]), 0.12); // visor
    } else if (g === 'beanie') {
      sc.add(M.hat, SDF.ellipsoid([0.88, 0.68, 0.74], [-0.04, 1.5, 0]), 0.2);
      sc.add(M.hat, SDF.torus(0.74, 0.14, [0.0, 1.22, 0], [Math.PI / 2, 0.12, 0]), 0.1); // rolled brim
    } else if (g === 'bandana') {
      sc.add(M.hat, SDF.ellipsoid([0.86, 0.52, 0.71], [-0.02, 1.52, 0]), 0.15);
      sc.add(M.hat, SDF.ellipsoid([0.2, 0.3, 0.26], [-0.84, 1.2, 0]), 0.1); // the knot
      sc.add(M.hat, SDF.cone([-0.9, 1.1, 0], [-1.2, 0.6, 0.12], 0.12, 0.04), 0.05); // a tail
    } else if (g === 'cap') {
      sc.add(M.hat, SDF.ellipsoid([0.86, 0.6, 0.72], [-0.04, 1.52, 0]), 0.2);
      sc.add(M.hat, SDF.box([0.9, 0.08, 0.86], 0.06, [0.85, 1.32, 0], [0, 0, -0.14]), 0.1); // brim
    } else if (g === 'hair') {
      hairline(SDF.ellipsoid([0.86, 0.7, 0.71], [-0.08, 1.42, 0]));
      sc.add(M.hair, SDF.ellipsoid([0.5, 0.3, 0.5], [0.3, 1.82, 0]), 0.2); // a slicked-back quiff
    } else if (g === 'buzz') hairline(SDF.ellipsoid([0.83, 0.62, 0.69], [-0.02, 1.36, 0]));
    // shaved: just the scalp
  },

  // A fist round a bar (or just a fist): palm, a roll of curled fingers, knuckles, a thumb across them.
  fist(sc, M, at, dir, side) {
    const d = new THREE.Vector3(...dir).normalize(), p = (k) => [at[0] + d.x * k, at[1] + d.y * k, at[2] + d.z * k];
    sc.add(M.glove, SDF.ellipsoid([0.42, 0.36, 0.4], p(0.1)), 0.15);
    sc.add(M.glove, SDF.cone(p(0.25), p(0.62), 0.34, 0.3), 0.15); // fingers
    sc.add(M.glove, SDF.ellipsoid([0.16, 0.14, 0.38], p(0.5).map((v, i) => v + (i === 1 ? 0.18 : 0))), 0.08); // knuckles
    sc.add(M.glove, SDF.cone([at[0], at[1] + 0.2, at[2] + side * 0.18], p(0.5).map((v, i) => v + (i === 1 ? 0.28 : 0)), 0.14, 0.12), 0.08); // thumb
  },

  // A whole person. o: { seed, pose: 'seated' | 'stand', role: 'driver' | 'gunner' | 'passenger' | 'trader',
  // head (default true), arms: 'static' | 'none' (default static), helmet, cell (sculpt detail), suit (colour) }.
  figure(o) {
    o = Object.assign({ pose: 'seated', role: 'driver', head: true, arms: 'static', cell: 0.1 }, o);
    const L = Object.assign(People.looks(o.seed || 1), o.looks || {});
    if (L.beard === true) L.beard = 'full';
    else if (L.beard === false) L.beard = 'none';
    const mix = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
    const M = {
      skin: LP.mat(L.skin, { roughness: 0.75 }), suit: LP.mat(o.suit || L.suit, { roughness: 0.95 }), hair: LP.mat(L.hair, { roughness: 0.95 }),
      hat: LP.mat(L.hat, { roughness: 0.95 }), eye: LP.mat('#141210', { roughness: 0.3 }), lip: LP.mat(mix(L.skin, '#6a2a22', 0.4), { roughness: 0.8 }),
      white: LP.mat('#cfc6b4', { roughness: 0.5 }), stubble: LP.mat(mix(mix(L.skin, '#000000', 0.22), L.hair, 0.2), { roughness: 1 }), ink: LP.mat(mix(L.skin, '#1a2a3a', 0.7), { roughness: 0.9 }),
      vest: LP.mat('#e4e0d6', { roughness: 0.95 }), seam: LP.mat(mix(o.suit || L.suit, '#000000', 0.35), { roughness: 0.95 }),
      shades: LP.mat('#0e0e10', { metalness: 0.5, roughness: 0.2 }), helmet: LP.mat('#1c1c1e', { metalness: 0.4, roughness: 0.35 }),
      glove: LP.mat(o.role === 'trader' ? L.skin : '#2a221c', { roughness: 0.8 }), boot: LP.mat('#1a1410', { roughness: 0.8 }), dark: LP.mat('#1c1c1c', { roughness: 0.7 }),
    };
    const stand = o.pose === 'stand', w = People.BUILD[L.build] || 1, heavy = L.build === 'heavy';
    const vest = L.top === 'vest' && o.role !== 'trader', bare = vest ? M.skin : M.suit; // vest: the arms are bare
    const gear = o.helmet ? 'helmet' : L.gear;
    const key = ['person2', o.pose, o.role, o.arms, o.head ? 'h' : 'n', gear, L.beard, L.shades && o.role !== 'trader' ? 's' : '', L.build, L.face, vest ? 'v' : '', L.rolled ? 'r' : '', L.tattoo || '', L.brow, o.cell].join(':');
    const g = new THREE.Group();
    const torso = new THREE.Group(); g.add(torso);
    // Body (and legs, which don't move with the torso pivot, so they're sculpted onto the figure itself).
    const body = new Sculpt(key + ':body', o.cell), legs = new Sculpt(key + ':legs', o.cell * 1.2);
    const top = vest ? M.vest : M.suit;
    body.add(M.suit, SDF.ellipsoid([1.1, 0.8, 1.45 * w], [0, 0.75, 0]), 0.4); // pelvis
    body.add(top, SDF.ellipsoid([0.95 + (heavy ? 0.2 : 0), 1.0, 1.25 * w], [0.12 + (heavy ? 0.12 : 0), 2.0, 0]), 0.6); // belly
    body.add(top, SDF.ellipsoid([1.02, 1.3, 1.62 * w], [0.06, 3.42, 0]), 0.6); // ribcage
    for (const s of [-1, 1]) body.add(top, SDF.ellipsoid([0.45, 0.42, 0.62 * w], [0.55, 3.8, s * 0.6 * w]), 0.5); // chest
    for (const s of [-1, 1]) body.add(top, SDF.cone([0.0, 4.85, 0], [0.0, 4.45, s * 1.45 * w], 0.5, 0.42), 0.5); // shoulder slope (trapezius)
    for (const s of [-1, 1]) body.add(bare, SDF.ellipsoid([0.62, 0.6, 0.62], [0.0, 4.28, s * 1.62 * w]), 0.4); // deltoids
    if (o.head) body.add(M.skin, SDF.cyl(0.46, 0.95, 'y', 0.25, [0.12, 5.05, 0]), 0.3); // neck
    if (L.tattoo === 'neck') body.add(M.ink, SDF.cyl(0.47, 0.18, 'y', 0.05, [0.12, 5.1, 0]), 0.02); // a band of ink round the neck
    if (vest) {
      body.cut(SDF.ellipsoid([0.42, 0.42, 0.75], [0.6, 4.72, 0]), 0.15, [M.vest]); // the vest's wide scoop neck
      body.add(M.skin, SDF.ellipsoid([0.99, 1.27, 1.58 * w], [0.06, 3.42, 0]), 0.6); // chest skin just under the vest, showing in the scoop
      body.add(M.suit, SDF.torus(1.12 * w, 0.32, [0.1, 1.3, 0], [Math.PI / 2, 0, 0]), 0.2); // the jumpsuit top tied round the waist
      body.add(M.suit, SDF.ellipsoid([0.36, 0.3, 0.34], [1.15, 1.32, 0.2]), 0.1); // the knot of its sleeves
      body.add(M.suit, SDF.cone([1.2, 1.2, 0.2], [1.3, 0.3, 0.5], 0.22, 0.16), 0.1);
    } else {
      body.add(M.suit, SDF.torus(0.52, 0.12, [0.1, 4.9, 0], [Math.PI / 2, 0, 0]), 0.1); // collar band
      body.add(M.seam, SDF.box([0.07, 2.7, 0.12], 0.03, [1.05, 2.85, 0.05]), 0.04); // zip
      body.add(M.suit, SDF.box([0.12, 0.55, 0.55], 0.06, [1.04, 3.72, 0.78]), 0.05); // chest pocket
      body.add(M.seam, SDF.torus(1.02 * w, 0.06, [0.1, 1.42, 0], [Math.PI / 2, 0, 0]), 0.03); // the waist seam
    }
    // Arms, sculpted to a pose (the player's driver gets live arms instead, see People.liveArms).
    if (o.arms === 'static') {
      const A = People.ARM_POSES[o.role] || People.ARM_POSES.driver, fore = vest || L.rolled ? M.skin : M.suit;
      for (const s of [-1, 1]) {
        const [el, wr] = A[s < 0 ? 0 : 1], sh = [0.05, 4.25, s * 1.72 * w];
        body.add(bare, SDF.cone(sh, el, 0.46 * w, 0.38), 0.3); // upper arm
        body.add(fore, SDF.cone(el, wr, 0.38, 0.3), 0.25); // forearm
        body.add(L.rolled && !vest ? M.suit : fore, SDF.ellipsoid([0.42, 0.42, 0.42], el), 0.2); // elbow (and a rolled sleeve)
        if (!vest && !L.rolled) body.add(M.suit, SDF.torus(0.34, 0.09, wr, [0, 0, Math.PI / 2]), 0.05); // cuff
        if (L.tattoo === 'arms' && (vest || L.rolled)) body.add(M.ink, SDF.cone(el.map((v, i) => v + (wr[i] - v) * 0.3), el.map((v, i) => v + (wr[i] - v) * 0.6), 0.39, 0.35), 0.02); // sleeve tattoo
        People.fist(body, M, wr, [wr[0] - el[0], wr[1] - el[1], wr[2] - el[2]], s);
      }
      if (o.role === 'driver') body.add(M.dark, SDF.torus(1.25, 0.16, [3.75, 3.95, 0], [0, Math.PI / 2 - 0.35, 0]), 0.05); // their wheel
      if (o.role === 'gunner') body.add(M.dark, SDF.box([2.8, 0.5, 0.4], 0.12, [3.3, 3.6, 0.2]), 0.1); // their gun
    }
    body.build(torso);
    // Legs: seated (thighs along the seat, shins down to the floor) or standing (a little apart, knees soft).
    const LEG = stand ? [[0.05, -0.1], [0.35, -3.8], [0.05, -7.5]] : [[0.3, 0.55], [4.1, 0.9], [4.7, -3.3]];
    for (const s of [-1, 1]) {
      const sp = stand ? 0.15 : 0, hip = [LEG[0][0], LEG[0][1], s * 0.85 * w], knee = [LEG[1][0], LEG[1][1], s * (1.0 + sp) * w], ank = [LEG[2][0], LEG[2][1], s * (1.05 + sp * 2)];
      legs.add(M.suit, SDF.cone(hip, knee, 0.82 * w, 0.6), 0.45); // thigh
      legs.add(M.suit, SDF.cone(knee, ank, 0.58, 0.46), 0.3); // shin
      legs.add(M.suit, SDF.ellipsoid([0.52, 0.52, 0.56], [knee[0] + 0.25, knee[1] + 0.05, knee[2]]), 0.25); // knee
      const mid = [(hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2 + 0.1, hip[2] + s * 0.7 * w];
      legs.add(M.suit, SDF.box([1.4, 0.9, 0.22], 0.12, mid), 0.08); // cargo pocket on the outside of the thigh
      for (const f of [0.3, 0.62]) { const c = [hip[0] + (knee[0] - hip[0]) * f, hip[1] + (knee[1] - hip[1]) * f + 0.66, hip[2]]; legs.cut(SDF.torus(0.7, 0.06, c, [0, 0, Math.PI / 2 + 0.1]), 0.05, [M.suit]); } // creases
      legs.add(M.boot, SDF.box([2.2, 1.05, 1.1], 0.38, [ank[0] + 0.6, ank[1] - 0.35, ank[2]]), 0.2); // boot
      legs.add(M.boot, SDF.cyl(0.55, 0.7, 'y', 0.15, [ank[0], ank[1] + 0.15, ank[2]]), 0.2); // boot top round the ankle
      legs.add(M.dark, SDF.box([2.3, 0.24, 1.15], 0.08, [ank[0] + 0.6, ank[1] - 0.82, ank[2]]), 0.1); // sole
    }
    legs.build(g);
    // Head on its pivot.
    const head = new THREE.Group();
    head.position.set(0.15, 5.4, 0);
    torso.add(head);
    if (o.head) {
      const hs = new Sculpt(key + ':head', Math.min(o.cell * 0.7, 0.07));
      People.head(hs, M, Object.assign({}, L, { helmet: o.helmet, gear, shades: L.shades && o.role !== 'trader' }));
      hs.build(head);
    }
    // The number stencilled on the chest (on the vest's back strap it'd be hidden: only on the jumpsuit).
    if (!vest) {
      const tex = People.patch(o.number || L.number);
      const patch = LP.mesh(new THREE.PlaneGeometry(1.3, 0.55), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, transparent: true }), 1.09, 3.05, -0.6);
      patch.rotation.y = Math.PI / 2;
      torso.add(patch);
    }
    g.userData = { torso, head, looks: L, M, helmet: !!o.helmet, armMat: vest ? M.skin : M.suit, shoulders: [[0.05, 4.25, -1.72 * w], [0.05, 4.25, 1.72 * w]] };
    return g;
  },

  // Elbow and wrist per arm ([left, right], figure space) for the sculpted poses.
  ARM_POSES: {
    driver: [[[1.9, 3.1, -2.0], [3.45, 3.95, -1.15]], [[1.9, 3.1, 2.0], [3.45, 3.95, 1.15]]], // hands at ten to two
    gunner: [[[1.7, 2.8, -1.7], [3.2, 3.5, -0.3]], [[1.6, 3.0, 2.0], [2.5, 3.5, 0.6]]], // gun up across the chest
    trader: [[[1.7, 2.6, -2.0], [2.7, 3.0, 0.9]], [[1.7, 2.8, 2.0], [2.7, 3.2, -0.9]]], // arms folded on the counter
    passenger: [[[1.4, 2.3, -1.8], [2.6, 1.6, -0.9]], [[1.4, 2.3, 1.8], [2.6, 1.6, 0.9]]], // hands in the lap
  },

  patch(text) {
    People.patches = People.patches || {};
    if (People.patches[text]) return People.patches[text];
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 28;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(240,232,208,0.92)'; c.fillRect(2, 2, 60, 24);
    c.fillStyle = '#1a1410'; c.font = 'bold 18px monospace'; c.textAlign = 'center'; c.fillText(text, 32, 21);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return (People.patches[text] = t);
  },

  // Live arms: upper arm and forearm as capsules re-posed every frame from a shoulder to a wrist (two-bone IK,
  // elbows dropping down and out), so a driver's hands can stay on a wheel that turns.
  liveArms(parent, mat, n) {
    const arms = [];
    for (let k = 0; k < (n || 2); k++) {
      const seg = () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10, 1), mat); parent.add(m); return m; };
      const ball = (r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat); parent.add(m); return m; };
      arms.push({ up: seg(), fore: seg(), elbow: ball(0.42), wrist: ball(0.38) });
    }
    return arms;
  },

  poseArm(arm, S, W, out, la, lb) {
    la = la || 2.9; lb = lb || 2.8;
    const dir = W.clone().sub(S), d = Math.min(dir.length(), la + lb - 0.02);
    dir.normalize();
    const x = (la * la - lb * lb + d * d) / (2 * d), h = Math.sqrt(Math.max(0, la * la - x * x));
    const pole = out.clone().projectOnPlane(dir).normalize();
    const E = S.clone().addScaledVector(dir, x).addScaledVector(pole, h);
    const place = (m, a, b, r) => {
      const v = b.clone().sub(a), len = v.length();
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
      m.scale.set(r, len, r);
    };
    place(arm.up, S, E, 0.46);
    place(arm.fore, E, W, 0.4);
    arm.elbow.position.copy(E);
    arm.wrist.position.copy(W);
  },
};
