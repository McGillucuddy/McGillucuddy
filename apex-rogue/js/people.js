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
    if (People.poly()) return People.polyFigure(o, L); // the low-poly look (below)
    const mix = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
    const M = {
      skin: LP.mat(L.skin, { roughness: 0.75 }), suit: LP.mat(o.suit || L.suit, { roughness: 0.95 }), hair: LP.mat(L.hair, { roughness: 0.95 }),
      hat: LP.mat(L.hat, { roughness: 0.95 }), eye: LP.mat('#141210', { roughness: 0.3 }), lip: LP.mat(mix(L.skin, '#6a2a22', 0.4), { roughness: 0.8 }),
      white: LP.mat('#cfc6b4', { roughness: 0.5 }), stubble: LP.mat(mix(mix(L.skin, '#000000', 0.22), L.hair, 0.2), { roughness: 1 }), ink: LP.mat(mix(L.skin, '#1a2a3a', 0.7), { roughness: 0.9 }),
      vest: LP.mat('#e4e0d6', { roughness: 0.95 }), seam: LP.mat(mix(o.suit || L.suit, '#000000', 0.35), { roughness: 0.95 }),
      shades: LP.mat('#0e0e10', { metalness: 0.5, roughness: 0.2 }), helmet: LP.mat('#1c1c1e', { metalness: 0.4, roughness: 0.35 }),
      glove: LP.mat(o.role === 'trader' ? L.skin : '#2a221c', { roughness: 0.8 }), boot: LP.mat('#1a1410', { roughness: 0.8 }), dark: LP.mat('#1c1c1c', { roughness: 0.7 }),
    };
    const walk = o.pose === 'walk', stand = o.pose === 'stand' || walk, w = People.BUILD[L.build] || 1, heavy = L.build === 'heavy';
    const vest = L.top === 'vest' && o.role !== 'trader', bare = vest ? M.skin : M.suit; // vest: the arms are bare
    const gear = o.helmet ? 'helmet' : L.gear;
    const key = ['person2', o.pose, o.role, o.arms, o.head ? 'h' : 'n', gear, L.beard, L.shades && o.role !== 'trader' ? 's' : '', L.build, L.face, vest ? 'v' : '', L.rolled ? 'r' : '', L.tattoo || '', L.brow, o.cell, o.leg ? o.leg.knee.concat(o.leg.ankle).join(',') : ''].join(':');
    const g = new THREE.Group();
    const torso = new THREE.Group(); g.add(torso);
    // Body (and legs, which don't move with the torso pivot, so they're sculpted onto the figure itself).
    const body = new Sculpt(key + ':body', o.cell), legsAll = new Sculpt(key + ':legs', o.cell * 1.2);
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
    const swing = [];
    if (o.arms === 'swing') { // hanging at the sides on shoulder pivots, so they can swing as the figure walks
      const fore = vest || L.rolled ? M.skin : M.suit;
      for (const s of [-1, 1]) {
        const sh = [0.05, 4.25, s * 1.72 * w], el = [0.15, -2.0, s * 0.28], wr = [0.4, -3.75, s * 0.32];
        const a = new Sculpt(key + ':arm' + s, o.cell), piv = new THREE.Group();
        a.add(bare, SDF.cone([0, 0, 0], el, 0.46 * w, 0.38), 0.3);
        a.add(fore, SDF.cone(el, wr, 0.38, 0.3), 0.25);
        a.add(L.rolled && !vest ? M.suit : fore, SDF.ellipsoid([0.42, 0.42, 0.42], el), 0.2);
        if (!vest && !L.rolled) a.add(M.suit, SDF.torus(0.34, 0.09, wr, [0, 0, Math.PI / 2]), 0.05);
        People.fist(a, M, wr, [wr[0] - el[0], wr[1] - el[1], wr[2] - el[2]], s);
        a.build(piv);
        piv.position.set(...sh);
        torso.add(piv);
        swing.push(piv);
      }
    }
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
    // (o.leg: a seated figure's knee and ankle for a particular seat, so the feet land on that floor.)
    const LEG = stand ? [[0.05, -0.1], [0.35, -3.8], [0.05, -7.5]] : o.leg ? [[0.3, 0.55], o.leg.knee, o.leg.ankle] : [[0.3, 0.55], [4.1, 0.9], [4.7, -3.3]];
    const strides = [];
    for (const s of [-1, 1]) {
      const sp = walk ? 0.02 : stand ? 0.15 : 0;
      let hip = [LEG[0][0], LEG[0][1], s * 0.85 * w], knee = [LEG[1][0], LEG[1][1], s * (1.0 + sp) * w], ank = [LEG[2][0], LEG[2][1], s * (1.05 + sp * 2)];
      // Walking: each leg is its own piece on a hip pivot (sculpted relative to the hip), so it can swing.
      let legs = legsAll, piv = null;
      if (walk) {
        piv = new THREE.Group(); piv.position.set(...hip);
        const rel = (v) => [v[0] - hip[0], v[1] - hip[1], v[2] - hip[2]];
        [hip, knee, ank] = [rel(hip), rel(knee), rel(ank)];
        legs = new Sculpt(key + ':leg' + s, o.cell * 1.2);
      }
      legs.add(M.suit, SDF.cone(hip, knee, 0.82 * w, 0.6), 0.45); // thigh
      legs.add(M.suit, SDF.cone(knee, ank, 0.58, 0.46), 0.3); // shin
      legs.add(M.suit, SDF.ellipsoid([0.52, 0.52, 0.56], [knee[0] + 0.25, knee[1] + 0.05, knee[2]]), 0.25); // knee
      const mid = [(hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2 + 0.1, hip[2] + s * 0.7 * w];
      legs.add(M.suit, SDF.box([1.4, 0.9, 0.22], 0.12, mid), 0.08); // cargo pocket on the outside of the thigh
      for (const f of [0.3, 0.62]) { const c = [hip[0] + (knee[0] - hip[0]) * f, hip[1] + (knee[1] - hip[1]) * f + 0.66, hip[2]]; legs.cut(SDF.torus(0.7, 0.06, c, [0, 0, Math.PI / 2 + 0.1]), 0.05, [M.suit]); } // creases
      legs.add(M.boot, SDF.box([2.2, 1.05, 1.1], 0.38, [ank[0] + 0.6, ank[1] - 0.35, ank[2]]), 0.2); // boot
      legs.add(M.boot, SDF.cyl(0.55, 0.7, 'y', 0.15, [ank[0], ank[1] + 0.15, ank[2]]), 0.2); // boot top round the ankle
      legs.add(M.dark, SDF.box([2.3, 0.24, 1.15], 0.08, [ank[0] + 0.6, ank[1] - 0.82, ank[2]]), 0.1); // sole
      if (piv) { legs.build(piv); g.add(piv); strides.push(piv); }
    }
    if (!walk) legsAll.build(g);
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
    let patch = null;
    if (!vest) {
      const tex = People.patch(o.number || L.number);
      patch = LP.mesh(new THREE.PlaneGeometry(1.3, 0.55), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, transparent: true }), 1.09, 3.05, -0.6);
      patch.rotation.y = Math.PI / 2;
      torso.add(patch);
    }
    g.userData = { torso, head, patch, looks: L, M, legs: strides, arms: swing, helmet: !!o.helmet, armMat: vest ? M.skin : M.suit, shoulders: [[0.05, 4.25, -1.72 * w], [0.05, 4.25, 1.72 * w]] };
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
      const poly = People.poly(); // (six-sided and faceted in the low-poly look)
      const seg = () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, poly ? 6 : 10, 1), mat); parent.add(m); return m; };
      const ball = (r) => { const m = new THREE.Mesh(poly ? new THREE.IcosahedronGeometry(r, 0) : new THREE.SphereGeometry(r, 10, 8), mat); parent.add(m); return m; };
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

// ---------- The low-poly look (Settings: Characters) ----------
// The same people, built the way a low-poly game builds them: not boxes, but the same organic shapes cut into flat
// facets. Each part is lofted through a stack of rings (ten sides, each ring its own depth and width, the front of
// the head flattened into a face), so a torso still has its chest, waist and hips, a head its jaw, cheeks and brow.
// The face is laid on in flat shapes (eyes with a glint, brows, nose, mouth, moustache), clothes have raised trim
// (collar, cuffs, hems, a belt with a buckle), colours are bright and clean. Same joints, pivots and userData as the
// sculpted figure, so the cabin, the ragdolls, the vest and the crew animation all work unchanged.
Object.assign(People, {
  poly: () => typeof Settings === 'undefined' || Settings.data.people !== 'classic',

  polyMat(c, o) { return LP.mat(c, Object.assign({ flatShading: true, roughness: 0.8, metalness: 0 }, o)); },

  // A shape lofted through rings, bottom to top: { y, rx (depth, along x), rz (width), x, z (centre), flat (the
  // front flattened at that share of rx), dy(cos) (lifts the ring towards the front: a hairline) }. Capped both ends.
  loft(g, rings, mat, seg) {
    seg = seg || 8; // big facets, like the references
    const pos = [], idx = [], n = seg;
    for (const R of rings) for (let k = 0; k < n; k++) {
      const a = ((k + 0.5) / n) * TAU, c = Math.cos(a), sn = Math.sin(a);
      let x = c * R.rx;
      if (R.flat && x > R.rx * R.flat) x = R.rx * R.flat;
      pos.push(x + (R.x || 0), R.y + (R.dy ? R.dy(c) : 0), sn * R.rz + (R.z || 0));
    }
    for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < n; k++) {
      const a = r * n + k, b = r * n + ((k + 1) % n), c = a + n, d = b + n;
      idx.push(a, c, b, b, c, d);
    }
    const cap = (r, up) => {
      const R = rings[r], ci = pos.length / 3;
      pos.push(R.x || 0, R.y + (up ? 0.02 : -0.02), R.z || 0);
      for (let k = 0; k < n; k++) { const a = r * n + k, b = r * n + ((k + 1) % n); if (up) idx.push(ci, b, a); else idx.push(ci, a, b); }
    };
    cap(0, false); cap(rings.length - 1, true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); g.add(m);
    return m;
  },
  // A faceted limb from a to b (radius ra at a, rb at b).
  prism(g, a, b, ra, rb, mat, seg) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), v = B.clone().sub(A), len = v.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, len, seg || 7, 1), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    g.add(m);
    return m;
  },
  // A limb as one continuous faceted tube through points (no joints showing): radii per point, and the material
  // for each stretch between them (mats[segMat[i]]), so a sleeve can end at the elbow without a seam.
  tube(g, pts, radii, mats, segMat, seg) {
    const n = seg || 7, V = pts.map((q) => new THREE.Vector3(...q)), pos = [];
    let N = null;
    V.forEach((Pt, i) => {
      const T = (i === 0 ? V[1].clone().sub(V[0]) : i === V.length - 1 ? Pt.clone().sub(V[i - 1]) : V[i + 1].clone().sub(V[i - 1])).normalize();
      if (!N) { const ref = Math.abs(T.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1); N = new THREE.Vector3().crossVectors(T, ref).normalize(); }
      else N = N.clone().sub(T.clone().multiplyScalar(N.dot(T))).normalize(); // carried along the limb, so the facets don't twist
      const B = new THREE.Vector3().crossVectors(T, N), r = radii[i];
      for (let k = 0; k < n; k++) { const a = (k / n) * TAU, c = Math.cos(a), sn = Math.sin(a); pos.push(Pt.x + (N.x * c + B.x * sn) * r, Pt.y + (N.y * c + B.y * sn) * r, Pt.z + (N.z * c + B.z * sn) * r); }
    });
    const byMat = mats.map(() => []);
    for (let i = 0; i < V.length - 1; i++) for (let k = 0; k < n; k++) {
      const a = i * n + k, b = i * n + ((k + 1) % n), c = a + n, d = b + n;
      byMat[segMat ? segMat[i] : 0].push(a, b, c, b, d, c);
    }
    const ends = (i, start) => {
      const ci = pos.length / 3; pos.push(V[i].x, V[i].y, V[i].z);
      const out = byMat[segMat ? segMat[start ? 0 : V.length - 2] : 0];
      for (let k = 0; k < n; k++) { const a = i * n + k, b = i * n + ((k + 1) % n); if (start) out.push(ci, b, a); else out.push(ci, a, b); }
    };
    ends(0, true); ends(V.length - 1, false);
    const geo = new THREE.BufferGeometry(), idx = [];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    byMat.forEach((list, m) => { geo.addGroup(idx.length, list.length, m); idx.push(...list); });
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mats); g.add(mesh);
    return mesh;
  },
  // A faceted ball (a joint, a hand, an ear): radii [x, y, z].
  lump(g, r, mat, pos, seg) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg || 8, Math.max(4, Math.round((seg || 8) * 0.7))), mat);
    m.scale.set(...r); m.position.set(...pos); g.add(m);
    return m;
  },
  slab(g, size, mat, pos, rot) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    m.position.set(...pos); if (rot) m.rotation.set(...rot); g.add(m);
    return m;
  },
  // A mitten of a hand with a thumb, at the wrist, along the forearm.
  polyHand(g, M, at, dir) {
    const d = new THREE.Vector3(...dir).normalize(), h = new THREE.Group();
    h.position.set(...at);
    h.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d);
    People.lump(h, [0.44, 0.34, 0.3], M.glove, [0.36, 0, 0], 7);
    People.prism(h, [0.12, 0.06, 0.22], [0.42, 0.14, 0.3], 0.12, 0.1, M.glove, 6); // the thumb
    g.add(h);
    return h;
  },

  // The head as one faceted surface: a profile of rings, chin to crown, with the face shaped into it (nose, brow
  // ridge, eye hollows, cheekbones, chin). Twenty sides by sixteen rings: still flat facets, but enough of them that
  // it reads as a head, not a box. HEAD_P: [y, depth, width, centre x].
  HEAD_P: [[0.16, 0.12, 0.1, 0.44], [0.27, 0.34, 0.27, 0.37], [0.42, 0.55, 0.47, 0.24], [0.62, 0.7, 0.58, 0.13], [0.9, 0.78, 0.65, 0.06],
    [1.18, 0.8, 0.67, 0.04], [1.5, 0.76, 0.63, 0.01], [1.74, 0.6, 0.53, -0.02], [1.9, 0.38, 0.34, -0.04], [1.99, 0.08, 0.07, -0.05]],
  headProfile(y) {
    const P = People.HEAD_P;
    if (y <= P[0][0]) return P[0];
    for (let i = 0; i < P.length - 1; i++) if (y <= P[i + 1][0]) {
      const a = P[i], b = P[i + 1], k = (y - a[0]) / (b[0] - a[0]), e = k * k * (3 - 2 * k); // eased, so the outline curves
      return [y, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e, a[3] + (b[3] - a[3]) * e];
    }
    return P[P.length - 1];
  },
  // A point on the head at angle th (0 = straight ahead) and height y, pushed out by off.
  headPt(th, y, off) {
    const [, rx, rz, cx] = People.headProfile(y), c = Math.cos(th), s = Math.sin(th);
    let x = c >= 0 ? rx * Math.pow(c, 0.72) : rx * 0.96 * c; // a flatter face at the front, a round skull behind
    let z = rz * s;
    if (c > 0) { // the face, shaped in
      const g = (v, m, w) => Math.exp(-((v - m) ** 2) / (2 * w * w));
      const zz = z / Math.max(0.3, rz);
      x += 0.17 * g(y, 0.82, 0.09) * g(zz, 0, 0.13) * c; // the nose
      x += 0.06 * g(y, 1.0, 0.13) * g(zz, 0, 0.09) * c; // its bridge
      x += 0.05 * g(y, 1.17, 0.05) * g(Math.abs(zz), 0.38, 0.28) * c; // the brow ridge
      x -= 0.045 * g(y, 1.0, 0.07) * g(Math.abs(zz), 0.38, 0.14) * c; // eye hollows
      x += 0.04 * g(y, 0.3, 0.08) * g(zz, 0, 0.3) * c; // the chin
      x -= 0.015 * g(y, 0.55, 0.03) * g(zz, 0, 0.25) * c; // the line of the mouth
      const cheek = 0.05 * g(y, 0.86, 0.1) * g(Math.abs(zz), 0.62, 0.15); // cheekbones, out to the sides
      z += Math.sign(z) * cheek;
    }
    if (off) { const L = Math.hypot(x, z) || 1; x += (x / L) * off; z += (z / L) * off; }
    return [x + cx, y, z];
  },
  // A surface over the head: th from th0 to th1 (a full turn closes it), heights from yA(th) to yB(th), n x m facets.
  headSurf(H, mat, o) {
    const n = o.n || 20, m = o.m || 16, full = o.th1 - o.th0 >= TAU - 1e-6, cols = full ? n : n + 1, pos = [], idx = [];
    for (let j = 0; j <= m; j++) for (let i = 0; i < cols; i++) {
      const th = o.th0 + ((o.th1 - o.th0) * (i + (full ? 0.5 : 0))) / n, t = j / m;
      const u = o.ease ? 0.5 - 0.5 * Math.cos(Math.PI * t) : t, y = o.yA(th) + (o.yB(th) - o.yA(th)) * u;
      pos.push(...People.headPt(th, y, typeof o.off === 'function' ? o.off(th, t) : o.off || 0));
    }
    for (let j = 0; j < m; j++) for (let i = 0; i < (full ? n : n); i++) {
      const a = j * cols + i, b = j * cols + ((i + 1) % cols), c = a + cols, d = b + cols;
      idx.push(a, c, b, b, c, d); // (outward, like the lofts)
    }
    if (o.capTop) { const ci = pos.length / 3, top = People.headPt(0, o.yB(0), 0); pos.push(top[0] * 0 + People.headProfile(o.yB(0))[3], o.yB(0) + 0.01, 0); for (let i = 0; i < n; i++) idx.push(ci, (m * cols) + ((i + 1) % cols), m * cols + i); }
    if (o.capBottom) { const ci = pos.length / 3; pos.push(People.headProfile(o.yA(0))[3], o.yA(0) - 0.01, 0); for (let i = 0; i < n; i++) idx.push(ci, i, (i + 1) % cols); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    if (!full) mesh.material = mat.side === THREE.DoubleSide ? mat : (o.dbl || mat);
    H.add(mesh);
    return mesh;
  },
  // How far forward the face is at height y, a little to one side (for laying the eyes and brows on it).
  faceX(y, z) { const [, rx, rz] = People.headProfile(y); return People.headPt(Math.asin(Math.max(-1, Math.min(1, (z || 0) / rz))), y, 0)[0] + 0 * rx; },

  polyHead(head, M, L, gear) {
    const P = People, H = new THREE.Group(), K = (v) => () => v;
    H.position.y = -0.28; // sat down on a short neck
    head.add(H);
    P.headSurf(H, M.skin, { th0: 0, th1: TAU, yA: K(0.16), yB: K(1.99), capTop: true, capBottom: true, ease: true });
    for (const s of [-1, 1]) { const e = P.lump(H, [0.1, 0.22, 0.07], M.skin, [0.0, 0.95, s * 0.68], 7); e.rotation.x = s * 0.2; } // ears
    const beard = L.beard === true ? 'full' : L.beard, face = (y, z) => P.faceX(y, z);
    // Facial hair laid on the jaw, following it.
    const jaw = (mat, top, off) => P.headSurf(H, mat, { th0: -1.75, th1: 1.75, n: 14, m: 6, yA: K(0.15), yB: (th) => top + (1 - Math.cos(th)) * 0.32, off, dbl: mat });
    if (beard === 'full') jaw(M.hairD, 0.5, 0.06);
    if (beard === 'stubble') jaw(M.stubble, 0.5, 0.012);
    if (beard === 'goatee') P.headSurf(H, M.hairD, { th0: -0.42, th1: 0.42, n: 4, m: 3, yA: K(0.16), yB: K(0.48), off: 0.05 });
    if (beard === 'moustache' || beard === 'full') P.headSurf(H, M.hairD, { th0: -0.62, th1: 0.62, n: 6, m: 2, yA: (th) => 0.6 - Math.abs(th) * 0.12, yB: K(0.69), off: 0.05 });
    // Eyes, brows and the mouth, set on the surface.
    for (const s of [-1, 1]) {
      if (!L.shades) {
        P.slab(H, [0.03, 0.14, 0.1], M.eye, [face(1.0, s * 0.24) + 0.005, 1.0, s * 0.24]);
        P.slab(H, [0.03, 0.04, 0.035], M.white, [face(1.03, s * 0.22) + 0.02, 1.035, s * 0.22]); // the glint
      }
      const tilt = L.brow === 'scowl' ? s * 0.25 : s * 0.06;
      P.slab(H, [0.05, 0.06, 0.24], M.brow, [face(1.15, s * 0.25) + 0.02, 1.15, s * 0.25], [tilt, s * -0.25, 0]);
    }
    if (L.shades) P.headSurf(H, M.shadesD, { th0: -1.05, th1: 1.05, n: 12, m: 2, yA: K(0.92), yB: K(1.09), off: 0.04 }); // wrapping round the face
    if (beard !== 'full') P.slab(H, [0.03, 0.035, 0.22], M.mouth, [face(0.55, 0) + 0.005, 0.55, 0]);
    if (L.tattoo === 'tear') P.slab(H, [0.02, 0.07, 0.035], M.ink, [face(0.88, 0.3) + 0.01, 0.88, 0.3]);
    // Hair and hats: shells over the skull, following it, the hairline lifted over the brow.
    const shell = (mat, off, hair) => P.headSurf(H, mat, { th0: 0, th1: TAU, n: 20, m: 8, yA: hair, yB: K(1.99), off, capTop: true });
    const hairline = (front, side, back) => (th) => { const c = Math.cos(th); return c >= 0 ? side + (front - side) * c : side + (side - back) * c; };
    if (gear === 'helmet') {
      P.lump(H, [0.98, 0.92, 0.85], M.helmet, [-0.02, 1.3, 0], 14);
      P.slab(H, [0.1, 0.32, 1.2], M.shades, [0.86, 1.06, 0]); // visor
    } else if (gear === 'beanie') {
      shell(M.hat, (th, t) => 0.07 + 0.06 * Math.sin(Math.PI * t), hairline(1.3, 1.22, 1.0));
      P.headSurf(H, M.hatBand, { th0: 0, th1: TAU, n: 20, m: 2, yA: hairline(1.24, 1.16, 0.94), yB: hairline(1.46, 1.38, 1.16), off: 0.12 }); // the rolled brim
    } else if (gear === 'bandana') {
      shell(M.hat, 0.05, hairline(1.38, 1.28, 1.05));
      P.lump(H, [0.14, 0.16, 0.2], M.hat, [-0.84, 1.3, 0], 7); // the knot
      P.prism(H, [-0.88, 1.24, 0], [-1.12, 0.74, 0.14], 0.1, 0.04, M.hat, 6);
    } else if (gear === 'cap') {
      shell(M.hat, 0.05, hairline(1.36, 1.3, 1.1));
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 14, 1, false, -Math.PI / 2, Math.PI), M.hat);
      brim.position.set(0.62, 1.38, 0); brim.rotation.z = -0.14; brim.scale.set(1, 1, 1.15);
      H.add(brim);
    } else if (gear === 'hair') {
      shell(M.hair, (th, t) => 0.06 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.4)), hairline(1.5, 1.08, 0.78));
      for (const [x, y, z, sx, sy, sz, r] of [[0.32, 1.9, 0.18, 0.36, 0.17, 0.27, 0.4], [0.28, 1.92, -0.2, 0.34, 0.17, 0.25, -0.3], [-0.12, 2.0, 0.05, 0.44, 0.17, 0.36, 0.1]]) { const lock = P.lump(H, [sx, sy, sz], M.hair, [x, y, z], 7); lock.rotation.set(r * 0.4, r, r * 0.3); } // locks, swept back
    } else if (gear === 'buzz') shell(M.hair, 0.025, hairline(1.48, 1.1, 0.8));
  },

  // The whole person, low-poly. Same options and userData as People.figure.
  polyFigure(o, L) {
    const P = People, w = P.BUILD[L.build] || 1, heavy = L.build === 'heavy', mix = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
    const suitC = o.suit || L.suit;
    const M = {
      skin: P.polyMat(L.skin), suit: P.polyMat(suitC), hair: P.polyMat(L.hair), hat: P.polyMat(L.hat), hatBand: P.polyMat(mix(L.hat, '#000000', 0.25)),
      trim: P.polyMat(mix(suitC, '#f2e6c8', 0.45)), // collar, cuffs and hems: a pale band against the suit
      belt: P.polyMat('#3a2416'), pouch: P.polyMat('#5a4028'), leather: P.polyMat('#4a3020'), buckle: P.polyMat('#d9b24a', { metalness: 0.4, roughness: 0.4 }),
      vest: P.polyMat('#eeeae0'), shades: P.polyMat('#0e0e10'), helmet: P.polyMat('#22232a'),
      glove: P.polyMat(o.role === 'trader' ? L.skin : '#3a2a20'), boot: P.polyMat('#22180f'), dark: P.polyMat('#1c1c1c'),
      eye: P.polyMat('#2a1c14'), eyeSet: P.polyMat(mix(L.skin, '#2a1810', 0.35)), brow: P.polyMat(mix(L.hair, L.skin, 0.2)), hairD: P.polyMat(L.hair, { side: THREE.DoubleSide }), shadesD: P.polyMat('#0e0e10', { side: THREE.DoubleSide, roughness: 0.3, metalness: 0.4 }), white: P.polyMat('#f4efe2'), mouth: P.polyMat(mix(L.skin, '#4a1a14', 0.4)),
      stubble: P.polyMat(mix(L.skin, L.hair, 0.35)), ink: P.polyMat('#2a3a5a'),
    };
    M.seam = M.trim; M.lip = M.mouth;
    const walk = o.pose === 'walk', stand = o.pose === 'stand' || walk, vest = L.top === 'vest' && o.role !== 'trader';
    const top = vest ? M.vest : M.suit, bare = vest ? M.skin : M.suit, fore = vest || L.rolled ? M.skin : M.suit, gear = o.helmet ? 'helmet' : L.gear;
    const g = new THREE.Group(), torso = new THREE.Group(); g.add(torso);
    // The torso: hips, waist, chest and shoulders, lofted (the top half its own piece, for the vest).
    const hb = heavy ? 0.22 : 0;
    P.loft(torso, [
      { y: 0.0, rx: 0.9, rz: 1.18 * w }, { y: 0.7, rx: 1.0, rz: 1.34 * w }, { y: 1.45, rx: 0.9 + hb, rz: 1.14 * w, x: hb * 0.6 },
    ], M.suit);
    P.loft(torso, [
      { y: 1.44, rx: 0.9 + hb, rz: 1.14 * w, x: hb * 0.6 }, { y: 2.3, rx: 0.98 + hb, rz: 1.3 * w, x: 0.02 + hb * 0.6 }, { y: 3.3, rx: 1.06, rz: 1.56 * w, x: 0.06 },
      { y: 4.2, rx: 0.95, rz: 1.72 * w, x: 0.02 }, { y: 4.7, rx: 0.75, rz: 1.28 * w }, { y: 5.05, rx: 0.56, rz: 0.6 },
    ], top);
    for (const s of [-1, 1]) P.lump(torso, [0.46, 0.4, 0.44], bare, [0, 4.3, s * 1.5 * w], 7); // rounding the shoulders off
    if (o.head) P.prism(torso, [0.12, 4.85, 0], [0.14, 5.55, 0], 0.54, 0.5, M.skin);
    P.loft(torso, [{ y: 1.27, rx: 0.97 + hb, rz: 1.22 * w, x: hb * 0.6 }, { y: 1.6, rx: 0.97 + hb, rz: 1.22 * w, x: hb * 0.6 }], M.belt); // belt
    P.slab(torso, [0.12, 0.34, 0.46], M.buckle, [0.99 + hb * 1.2, 1.44, 0]);
    for (const [z, x] of [[-0.95 * w, 0.3], [0.85 * w, -0.45]]) P.slab(torso, [0.5, 0.55, 0.3], M.pouch, [x, 1.2, z + Math.sign(z) * 0.32], [0, Math.sign(z) * 0.4, 0]); // pouches on the belt
    if (vest) {
      P.loft(torso, [{ y: 1.05, rx: 1.12, rz: 1.46 * w }, { y: 1.35, rx: 1.12, rz: 1.46 * w }], M.suit); // the jumpsuit top tied round the waist
      P.lump(torso, [0.3, 0.3, 0.3], M.suit, [1.15, 1.12, 0.3], 6); // its knot
      P.lump(torso, [0.5, 0.5, 0.6], M.skin, [0.55, 4.75, 0], 6); // the scoop neck
    } else {
      P.loft(torso, [{ y: 4.82, rx: 0.62, rz: 0.66 }, { y: 5.1, rx: 0.56, rz: 0.6 }], M.trim); // collar
      P.slab(torso, [0.06, 2.3, 0.14], M.trim, [1.12, 3.0, 0]); // zip
      P.slab(torso, [0.08, 0.5, 0.52], M.trim, [1.08, 3.75, 0.78], [0, 0.35, 0]); // chest pocket
    }
    // Arms.
    const arm = (parent, sh, el, wr) => {
      const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k), side = Math.sign(sh[2]) || 1;
      const inside = [sh[0], sh[1] + 0.15, sh[2] - side * 0.4]; // the arm grows out of the shoulder, not stuck on it
      P.tube(parent, [inside, sh, lerp3(sh, el, 0.45), el, lerp3(el, wr, 0.4), wr], [0.42 * w, 0.44 * w, 0.42 * w, 0.33, 0.32, 0.26], [bare, fore], [0, 0, 0, 1, 1]);
      if (L.rolled && !vest) P.prism(parent, lerp3(el, sh, 0.16), lerp3(el, wr, 0.06), 0.38, 0.36, M.suit); // the rolled sleeve
      if (vest || L.rolled) P.prism(parent, wr.map((v, i) => v + (el[i] - v) * 0.45), wr.map((v, i) => v + (el[i] - v) * 0.05), 0.33, 0.3, M.leather); // a leather bracer
      if (!vest && !L.rolled) P.prism(parent, wr.map((v, i) => v + (el[i] - v) * 0.14), wr.map((v, i) => v + (el[i] - v) * 0.02), 0.37, 0.35, M.trim); // cuff
      P.polyHand(parent, M, wr, [wr[0] - el[0], wr[1] - el[1], wr[2] - el[2]]);
    };
    const swing = [];
    if (o.arms === 'swing') for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(0.05, 4.25, s * 1.72 * w);
      arm(piv, [0, 0, 0], [0.2, -1.95, s * 0.42], [0.6, -3.65, s * 0.58]);
      torso.add(piv); swing.push(piv);
    }
    if (o.arms === 'static') {
      const A = P.ARM_POSES[o.role] || P.ARM_POSES.driver;
      for (const s of [-1, 1]) { const [el, wr] = A[s < 0 ? 0 : 1]; arm(torso, [0.05, 4.25, s * 1.72 * w], el, wr); }
      if (o.role === 'driver') { const r = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.16, 5, 12), M.dark); r.position.set(3.75, 3.95, 0); r.rotation.y = Math.PI / 2 - 0.35; torso.add(r); } // their wheel
      if (o.role === 'gunner') P.slab(torso, [2.8, 0.5, 0.4], M.dark, [3.3, 3.6, 0.2]); // their gun
    }
    // Legs.
    const LEG = stand ? [[0.05, -0.1], [0.35, -3.8], [0.05, -7.5]] : o.leg ? [[0.3, 0.55], o.leg.knee, o.leg.ankle] : [[0.3, 0.55], [4.1, 0.9], [4.7, -3.3]];
    const strides = [];
    for (const s of [-1, 1]) {
      const sp = walk ? 0.02 : stand ? 0.15 : 0;
      let hip = [LEG[0][0], LEG[0][1], s * 0.85 * w], knee = [LEG[1][0], LEG[1][1], s * (1.0 + sp) * w], ank = [LEG[2][0], LEG[2][1], s * (1.05 + sp * 2)];
      let parent = g, piv = null;
      if (walk) {
        piv = new THREE.Group(); piv.position.set(...hip);
        const rel = (v) => [v[0] - hip[0], v[1] - hip[1], v[2] - hip[2]];
        [hip, knee, ank] = [rel(hip), rel(knee), rel(ank)];
        parent = piv;
      }
      const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
      P.tube(parent, [[hip[0], hip[1] + 0.4, hip[2] * 0.7], hip, lerp3(hip, knee, 0.5), knee, lerp3(knee, ank, 0.45), ank], [0.8 * w, 0.8 * w, 0.7 * w, 0.54, 0.5, 0.4], [M.suit]); // one piece, hip to ankle
      P.prism(parent, [ank[0], ank[1] - 0.5, ank[2]], ank.map((v, i) => v + (knee[i] - v) * 0.3), 0.6, 0.52, M.boot, 7); // the boot, up the shin
      P.prism(parent, ank.map((v, i) => v + (knee[i] - v) * 0.24), ank.map((v, i) => v + (knee[i] - v) * 0.34), 0.58, 0.58, M.leather, 7); // its cuff
      P.lump(parent, [0.72, 0.42, 0.52], M.boot, [ank[0] + 0.95, ank[1] - 0.48, ank[2]], 7); // its toe
      P.slab(parent, [2.1, 0.2, 1.05], M.dark, [ank[0] + 0.55, ank[1] - 0.84, ank[2]]); // sole
      if (piv) { g.add(piv); strides.push(piv); }
    }
    // Head on its pivot.
    const head = new THREE.Group(); head.position.set(0.15, 5.4, 0); torso.add(head);
    if (o.head) P.polyHead(head, M, Object.assign({}, L, { shades: L.shades && o.role !== 'trader' }), gear);
    // The number on the chest.
    let patch = null;
    if (!vest) {
      patch = LP.mesh(new THREE.PlaneGeometry(1.2, 0.5), new THREE.MeshStandardMaterial({ map: P.patch(o.number || L.number), roughness: 0.9, transparent: true }), 1.07, 3.05, -0.66);
      patch.rotation.y = Math.PI / 2 + 0.32;
      torso.add(patch);
    }
    g.traverse((m) => { if (m.isMesh) m.userData.noGrime = true; });
    g.userData = { torso, head, patch, looks: L, M, legs: strides, arms: swing, helmet: !!o.helmet, armMat: vest ? M.skin : M.suit, shoulders: [[0.05, 4.25, -1.72 * w], [0.05, 4.25, 1.72 * w]], poly: true };
    return g;
  },
});
