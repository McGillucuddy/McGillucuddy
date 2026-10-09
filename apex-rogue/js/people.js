'use strict';
// People: one sculpted body for everyone in the game. Your driver at the wheel, your own lap and chest when you look
// down, the rival crews, the commissary trader. A head with a jaw, brow, nose, eyes and ears, under a beanie,
// bandana, cap, helmet or a shaved scalp. A torso in a jumpsuit with a collar and a number patch, and limbs posed
// from joint positions.
//
// Figure space: origin at the hips (on the seat for a seated pose, the pelvis for a standing one), +x forward,
// +y up, +z to the right, as in the cabin. The torso pivots at the hips and the head at the top of the neck, so the
// 3D view can make people flinch, glance about and slump.

const People = {
  SKIN: ['#f0cdb0', '#e0b89a', '#c48a64', '#a06a46', '#7a4a2e', '#5a3a26'],
  SUIT: ['#d96a1e', '#d0601a', '#c85a14', '#d98a1e'],
  HAIR: ['#1a1410', '#3a2a1a', '#6a4a2a', '#8a8070', '#2a2420'],
  HAT: ['#2a2a2e', '#7a1e1a', '#2a4a6a', '#3a4a2a', '#5a4a3a'],

  // Everything random about a person, from a seed.
  looks(seed) {
    const r = mulberry32(((seed | 0) * 7919 + 13) >>> 0), pick = (a) => a[Math.floor(r() * a.length)];
    return {
      skin: pick(People.SKIN), suit: pick(People.SUIT), hair: pick(People.HAIR), hat: pick(People.HAT),
      gear: pick(['beanie', 'bandana', 'shaved', 'hair', 'beanie', 'cap']), beard: r() < 0.4, shades: r() < 0.5,
      number: String(1000 + Math.floor(r() * 9000)),
    };
  },

  // The head, sculpted round the top of the neck (origin), facing +x.
  head(sc, M, o) {
    sc.add(M.skin, SDF.ellipsoid([0.82, 0.9, 0.66], [0.05, 0.98, 0]), 0.25); // cranium
    sc.add(M.skin, SDF.ellipsoid([0.6, 0.44, 0.54], [0.3, 0.44, 0]), 0.3); // jaw
    sc.add(M.skin, SDF.ellipsoid([0.26, 0.24, 0.3], [0.66, 0.24, 0]), 0.15); // chin
    for (const s of [-1, 1]) sc.add(M.skin, SDF.ellipsoid([0.3, 0.22, 0.2], [0.62, 0.78, s * 0.38]), 0.15); // cheekbones
    sc.add(M.skin, SDF.box([0.3, 0.2, 1.0], 0.1, [0.72, 1.16, 0]), 0.2); // brow ridge
    sc.add(M.skin, SDF.ellipsoid([0.2, 0.32, 0.13], [0.9, 0.82, 0], [0, 0, -0.25]), 0.12); // nose
    for (const s of [-1, 1]) {
      sc.cut(SDF.ellipsoid([0.14, 0.11, 0.15], [0.83, 1.0, s * 0.27]), 0.06, [M.skin]); // eye sockets
      sc.add(M.eye, SDF.ellipsoid([0.08, 0.07, 0.09], [0.76, 1.0, s * 0.27]), 0.02);
      sc.add(M.skin, SDF.ellipsoid([0.16, 0.3, 0.1], [0.02, 0.92, s * 0.66]), 0.08); // ears
    }
    sc.add(M.lip, SDF.box([0.08, 0.07, 0.38], 0.03, [0.88, 0.5, 0]), 0.04); // mouth
    if (o.beard) sc.add(M.hair, SDF.ellipsoid([0.66, 0.5, 0.6], [0.36, 0.38, 0]), 0.12); // beard over the jaw
    if (o.shades) sc.add(M.shades, SDF.box([0.14, 0.2, 1.1], 0.06, [0.86, 1.02, 0]), 0.05);
    const g = o.helmet ? 'helmet' : o.gear;
    if (g === 'helmet') {
      sc.add(M.helmet, SDF.ellipsoid([0.98, 0.98, 0.82], [0, 1.28, 0]), 0.2);
      sc.add(M.shades, SDF.box([0.2, 0.34, 1.3], 0.1, [0.82, 1.06, 0]), 0.12); // visor
    } else if (g === 'beanie') {
      sc.add(M.hat, SDF.ellipsoid([0.9, 0.66, 0.74], [-0.02, 1.48, 0]), 0.2);
      sc.add(M.hat, SDF.torus(0.72, 0.14, [0.02, 1.2, 0], [0, 0, 0.1]), 0.1); // rolled brim
    } else if (g === 'bandana') {
      sc.add(M.hat, SDF.ellipsoid([0.88, 0.5, 0.71], [0.0, 1.5, 0]), 0.15);
      sc.add(M.hat, SDF.ellipsoid([0.2, 0.32, 0.28], [-0.84, 1.18, 0]), 0.1); // the knot
    } else if (g === 'cap') {
      sc.add(M.hat, SDF.ellipsoid([0.88, 0.58, 0.72], [-0.02, 1.52, 0]), 0.2);
      sc.add(M.hat, SDF.box([0.9, 0.1, 0.9], 0.08, [0.85, 1.3, 0], [0, 0, -0.12]), 0.1); // brim
    } else if (g === 'hair') {
      sc.add(M.hair, SDF.ellipsoid([0.86, 0.62, 0.7], [-0.06, 1.38, 0]), 0.2);
    } else sc.add(M.hair, SDF.ellipsoid([0.84, 0.5, 0.68], [0.0, 1.45, 0]), 0.2); // shaved: stubble
  },

  // A fist round a bar (or just a fist): palm, a roll of curled fingers, a thumb across them.
  fist(sc, M, at, dir, side) {
    const d = new THREE.Vector3(...dir).normalize(), p = (k) => [at[0] + d.x * k, at[1] + d.y * k, at[2] + d.z * k];
    sc.add(M.glove, SDF.ellipsoid([0.42, 0.36, 0.4], p(0.1)), 0.15);
    sc.add(M.glove, SDF.cone(p(0.25), p(0.62), 0.34, 0.3), 0.15); // fingers
    sc.add(M.glove, SDF.cone([at[0], at[1] + 0.2, at[2] + side * 0.18], p(0.5).map((v, i) => v + (i === 1 ? 0.28 : 0)), 0.14, 0.12), 0.08); // thumb
  },

  // A whole person. o: { seed, pose: 'seated' | 'stand', role: 'driver' | 'gunner' | 'passenger' | 'trader',
  // head (default true), arms: 'static' | 'none' (default static), helmet, cell (sculpt detail), suit (colour) }.
  figure(o) {
    o = Object.assign({ pose: 'seated', role: 'driver', head: true, arms: 'static', cell: 0.1 }, o);
    const L = Object.assign(People.looks(o.seed || 1), o.looks || {});
    const M = {
      skin: LP.mat(L.skin, { roughness: 0.75 }), suit: LP.mat(o.suit || L.suit, { roughness: 0.95 }), hair: LP.mat(L.hair, { roughness: 0.95 }),
      hat: LP.mat(L.hat, { roughness: 0.95 }), eye: LP.mat('#141210', { roughness: 0.3 }), lip: LP.mat('#6a3a2a', { roughness: 0.8 }),
      shades: LP.mat('#0e0e10', { metalness: 0.5, roughness: 0.2 }), helmet: LP.mat('#1c1c1e', { metalness: 0.4, roughness: 0.35 }),
      glove: LP.mat(o.role === 'trader' ? L.skin : '#2a221c', { roughness: 0.8 }), boot: LP.mat('#1a1410', { roughness: 0.8 }), dark: LP.mat('#1c1c1c', { roughness: 0.7 }),
    };
    const stand = o.pose === 'stand';
    const gear = o.helmet ? 'helmet' : L.gear;
    const key = ['person', o.pose, o.role, o.arms, o.head ? 'h' : 'n', gear, L.beard ? 'b' : '', L.shades && o.role !== 'trader' ? 's' : '', o.cell].join(':');
    const g = new THREE.Group();
    const torso = new THREE.Group(); g.add(torso);
    // Body (and legs, which don't move with the torso pivot, so they're sculpted onto the figure itself).
    const body = new Sculpt(key + ':body', o.cell), legs = new Sculpt(key + ':legs', o.cell * 1.2);
    body.add(M.suit, SDF.ellipsoid([1.15, 0.78, 1.5], [0, 0.75, 0]), 0.4); // pelvis
    body.add(M.suit, SDF.ellipsoid([1.0, 1.05, 1.42], [0.12, 2.0, 0]), 0.6); // belly
    body.add(M.suit, SDF.ellipsoid([1.05, 1.38, 1.72], [0.05, 3.45, 0]), 0.6); // chest
    for (const s of [-1, 1]) body.add(M.suit, SDF.ellipsoid([0.78, 0.62, 0.72], [0, 4.32, s * 1.55]), 0.5); // shoulders
    body.add(M.suit, SDF.torus(0.5, 0.13, [0.12, 4.86, 0]), 0.1); // collar
    body.add(M.suit, SDF.box([0.1, 2.4, 0.16], 0.04, [1.0, 2.9, 0.2]), 0.05); // zip placket
    for (const s of [-1, 1]) body.add(M.suit, SDF.box([0.12, 0.55, 0.6], 0.06, [1.02, 3.7, s * 0.85]), 0.05); // chest pockets
    if (o.head) body.add(M.skin, SDF.cyl(0.42, 0.9, 'y', 0.2, [0.12, 5.05, 0]), 0.25); // neck
    // Arms, sculpted to a pose (the player's driver gets live arms instead, see People.liveArms).
    if (o.arms === 'static') {
      const A = People.ARM_POSES[o.role] || People.ARM_POSES.driver;
      for (const s of [-1, 1]) {
        const [el, wr] = A[s < 0 ? 0 : 1], sh = [0.05, 4.3, s * 1.75];
        body.add(M.suit, SDF.path([sh, el, wr], 0.44), 0.3);
        body.add(M.suit, SDF.torus(0.4, 0.1, wr, [0, 0, Math.PI / 2]), 0.05); // cuff
        People.fist(body, M, wr, [wr[0] - el[0], wr[1] - el[1], wr[2] - el[2]], s);
      }
      if (o.role === 'driver') body.add(M.dark, SDF.torus(1.25, 0.16, [3.75, 3.95, 0], [0, Math.PI / 2 - 0.35, 0]), 0.05); // their wheel
      if (o.role === 'gunner') body.add(M.dark, SDF.box([2.8, 0.5, 0.4], 0.12, [3.3, 3.6, 0.2]), 0.1); // their gun
    }
    body.build(torso);
    // Legs: seated (thighs along the seat, shins down to the floor) or standing.
    const LEG = stand ? [[0.05, -0.1], [0.25, -3.9], [0.05, -7.6]] : [[0.3, 0.55], [4.1, 0.9], [4.7, -3.3]];
    for (const s of [-1, 1]) {
      const hip = [LEG[0][0], LEG[0][1], s * 0.85], knee = [LEG[1][0], LEG[1][1], s * 1.0], ank = [LEG[2][0], LEG[2][1], s * 1.05];
      legs.add(M.suit, SDF.cone(hip, knee, 0.74, 0.58), 0.4); // thigh
      legs.add(M.suit, SDF.cone(knee, ank, 0.56, 0.44), 0.3); // shin
      legs.add(M.suit, SDF.ellipsoid([0.5, 0.5, 0.55], [knee[0] + 0.25, knee[1] + 0.05, knee[2]]), 0.25); // knee
      const mid = [(hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2 + 0.1, hip[2] + s * 0.62];
      legs.add(M.suit, SDF.box([1.4, 0.9, 0.22], 0.12, mid), 0.08); // cargo pocket on the outside of the thigh
      for (const f of [0.3, 0.62]) { const c = [hip[0] + (knee[0] - hip[0]) * f, hip[1] + (knee[1] - hip[1]) * f + 0.62, hip[2]]; legs.cut(SDF.torus(0.66, 0.06, c, [0, 0, Math.PI / 2 + 0.1]), 0.05, [M.suit]); } // creases
      legs.add(M.boot, SDF.box([2.0, 0.95, 1.0], 0.35, [ank[0] + 0.55, ank[1] - 0.35, ank[2]]), 0.2); // boot
      legs.add(M.dark, SDF.box([2.1, 0.22, 1.05], 0.08, [ank[0] + 0.55, ank[1] - 0.8, ank[2]]), 0.1); // sole
    }
    legs.build(g);
    // Head on its pivot.
    const head = new THREE.Group();
    head.position.set(0.15, 5.4, 0);
    torso.add(head);
    if (o.head) {
      const hs = new Sculpt(key + ':head', o.cell * 0.8);
      People.head(hs, M, Object.assign({}, L, { helmet: o.helmet, gear, shades: L.shades && o.role !== 'trader' }));
      hs.build(head);
    }
    // The number stencilled on the chest.
    const tex = People.patch(o.number || L.number);
    const patch = LP.mesh(new THREE.PlaneGeometry(1.3, 0.55), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, transparent: true }), 1.07, 3.05, -0.55);
    patch.rotation.y = Math.PI / 2;
    torso.add(patch);
    g.userData = { torso, head, looks: L, M, shoulders: [[0.05, 4.3, -1.75], [0.05, 4.3, 1.75]] };
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
