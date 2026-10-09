'use strict';
// Trinkets: the permanent charms of a run. Each is a small sculpted model (see js/sculpt.js) with a mount that says
// where it lives in the cabin: hung from the mirror or visor, stood up on the dash, or laid flat on it.
//   hang  - built hanging down from the origin (the cord or chain starts at y = 0)
//   stand - built standing on the origin (y = 0 is the dash top)
//   flat  - built lying flat on the origin

const TRINKET_MOUNT = {
  dice: 'hang', rabbit_foot: 'hang', keys: 'hang', rosary: 'hang', freshener: 'hang', dogtags: 'hang', shoes: 'hang', clover: 'hang',
  bobblehead: 'stand', troll: 'stand', teddy: 'stand', snowglobe: 'stand', eightball: 'stand', compass: 'stand', lighter: 'stand',
  horseshoe: 'flat', medal: 'flat', photo: 'flat', smokes: 'flat', tooth: 'flat', sparkplug: 'flat', cassette: 'flat',
};

const Trinkets = {
  // Shared helpers.
  mat: {
    steel: () => LP.mat('#9aa0a6', { metalness: 0.8, roughness: 0.3 }),
    gold: () => LP.mat('#c9a443', { metalness: 0.85, roughness: 0.28 }),
    brass: () => LP.mat('#b8963a', { metalness: 0.8, roughness: 0.35 }),
    bronze: () => LP.mat('#8a5a2a', { metalness: 0.7, roughness: 0.45 }),
    cord: () => LP.mat('#2a2420', { roughness: 0.9 }),
    black: () => LP.mat('#111111', { roughness: 0.6 }),
  },
  // A model built from one sculpt; fill(sc, M) adds the parts. Returns { g, sets }.
  make(id, cell, fill) {
    const g = new THREE.Group();
    g.name = id;
    const sc = new Sculpt('trinket:' + id, cell);
    fill(sc, Trinkets.mat);
    const sets = sc.build(g);
    return { g, sets };
  },
  // A ball chain or a cord from the origin down to y.
  chain(sc, mat, y, beads) {
    if (beads) for (let k = 0; k * 0.14 < -y; k++) sc.add(mat, SDF.ellipsoid([0.05, 0.05, 0.05], [0, -k * 0.14, 0]), 0.03);
    else sc.add(mat, SDF.path([[0, 0, 0], [0.02, y * 0.5, 0.01], [0, y, 0]], 0.03), 0.02);
  },
};

const TRINKET_BUILD = {
  // ---------- Hung from the mirror ----------

  dice() {
    return Trinkets.make('dice', 0.028, (sc, M) => {
      const cord = LP.mat('#eeeeee'), pip = LP.mat('#111111', { roughness: 1 });
      sc.add(cord, SDF.path([[0, 0, 0], [0, -1.5, 0], [0.04, -2.15, -0.36], [0, -1.5, 0], [0.08, -2.4, 0.42]], 0.03), 0.02);
      sc.add(cord, SDF.ellipsoid([0.1, 0.12, 0.1], [0, -1.5, 0]), 0.04); // the knot
      const die = (mat, p, rot) => {
        // Plush: a soft, very rounded cube with a fuzzy surface and pips sewn in.
        sc.add(mat, SDF.warp(SDF.box([0.82, 0.82, 0.82], 0.28, p, rot), (x, y, z) => { const n = 1 + 0.02 * Math.sin(x * 40) * Math.sin(y * 37) * Math.sin(z * 43); return [p[0] + (x - p[0]) / n, p[1] + (y - p[1]) / n, p[2] + (z - p[2]) / n]; }, 0.03), 0.02);
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot));
        const at = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m).add(new THREE.Vector3(...p)).toArray();
        const pips = [[[0, 0]], [[-0.2, -0.2], [0.2, 0.2]], [[-0.2, -0.2], [0, 0], [0.2, 0.2]], [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]];
        const face = (n, axis) => {
          for (const [u, v] of pips[n]) {
            const q = axis === 'z' ? at(u, v, 0.41) : axis === 'x' ? at(0.41, u, v) : at(u, 0.41, v);
            sc.cut(SDF.ellipsoid([0.075, 0.075, 0.075], q), 0.02, [mat]);
            sc.add(pip, SDF.ellipsoid([0.065, 0.065, 0.065], q), 0.01);
          }
        };
        face(2, 'z'); face(1, 'x'); face(0, 'y');
      };
      die(LP.mat('#f2f2f2', { roughness: 1 }), [0, -2.6, -0.36], [0.4, 0.3, 0.2]);
      die(LP.mat('#ff3b6b', { roughness: 1 }), [0.1, -2.86, 0.42], [-0.3, 0.6, 0.2]);
    }).g;
  },

  rabbit_foot() {
    return Trinkets.make('rabbit_foot', 0.025, (sc, M) => {
      const fur = LP.mat('#d8cfc0', { roughness: 1 }), claw = LP.mat('#3a3028', { roughness: 0.5 });
      Trinkets.chain(sc, M.steel(), -1.75, true);
      sc.add(M.gold(), SDF.lathe([[0.1, 0.0], [0.2, 0.1], [0.28, 0.3], [0.3, 0.42]], [0, -1.8, 0], [Math.PI / 2, 0, 0]), 0.04); // cap
      // Fur: a tapering foot with a shaggy surface and three toes.
      sc.add(fur, SDF.warp(SDF.cone([0, -2.1, 0], [0.04, -3.0, 0.1], 0.3, 0.34), (x, y, z) => { const n = 1 + 0.07 * Math.sin(y * 31 + x * 13) * Math.sin(z * 29); return [x / n, y, z / n]; }, 0.05), 0.08);
      for (const [x, z] of [[-0.14, 0.18], [0.03, 0.26], [0.18, 0.16]]) {
        sc.add(fur, SDF.ellipsoid([0.13, 0.17, 0.12], [x, -3.2, z]), 0.12);
        sc.add(claw, SDF.cone([x, -3.3, z + 0.08], [x, -3.42, z + 0.16], 0.04, 0.01), 0.01);
      }
    }).g;
  },

  keys() {
    return Trinkets.make('keys', 0.025, (sc, M) => {
      const brass = M.brass(), steel = M.steel(), leather = LP.mat('#5a3a22', { roughness: 0.8 });
      sc.add(steel, SDF.path([[0, 0, 0], [0.02, -0.7, 0], [0, -1.35, 0]], 0.03), 0.02);
      sc.add(steel, SDF.torus(0.4, 0.05, [0, -1.75, 0]), 0.03);
      sc.add(leather, SDF.box([0.36, 0.9, 0.08], 0.08, [-0.42, -2.4, 0.05], [0, 0, 0.3]), 0.03); // leather fob
      sc.cut(SDF.box([0.2, 0.4, 0.2], 0.05, [-0.4, -2.45, 0.05], [0, 0, 0.3]), 0.02, [leather]); // stamped number plate recess
      const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
      for (const [a, len] of [[-0.2, 1.1], [0.15, 1.4], [0.55, 0.9]]) {
        const ox = Math.sin(a) * 0.35, oy = -2.1, at = (x, y) => { const [u, v] = rot(x, y, a); return [ox + u, oy + v, 0]; };
        sc.add(brass, SDF.cyl(0.22, 0.08, 'z', 0.03, at(0, 0), [0, 0, a]), 0.03); // bow
        sc.cut(SDF.cyl(0.09, 0.4, 'z', 0.01, at(0, 0)), 0.01, [brass]);
        sc.add(brass, SDF.box([0.11, len, 0.08], 0.03, at(0, -len / 2 - 0.2), [0, 0, a]), 0.05); // blade
        sc.add(brass, SDF.box([0.3, 0.16, 0.08], 0.03, at(0.13, -len - 0.1), [0, 0, a]), 0.03); // bit
        sc.cut(SDF.box([0.08, 0.08, 0.2], 0.01, at(0.2, -len - 0.08), [0, 0, a]), 0.01, [brass]); // ward cut
      }
    }).g;
  },

  rosary() {
    return Trinkets.make('rosary', 0.025, (sc, M) => {
      const wood = LP.mat('#3a2418', { roughness: 0.6 }), cord = M.cord(), metal = LP.mat('#2a2a2a', { metalness: 0.5, roughness: 0.4 });
      const loop = [];
      for (let k = 0; k <= 16; k++) { const a = (k / 16) * TAU; loop.push([Math.sin(a) * 0.5, -1.0 + Math.cos(a) * 0.9, 0]); }
      sc.add(cord, SDF.path(loop, 0.022), 0.01);
      sc.add(cord, SDF.path([[0, -1.9, 0], [0, -2.05, 0]], 0.022), 0.01);
      for (let k = 0; k < 15; k++) {
        const a = (k / 15) * TAU, big = k % 5 === 0;
        sc.add(wood, SDF.ellipsoid(big ? [0.15, 0.15, 0.15] : [0.1, 0.11, 0.1], [Math.sin(a) * 0.5, -1.0 + Math.cos(a) * 0.9, 0]), 0.01);
      }
      // Scorched cross with the figure.
      sc.add(metal, SDF.box([0.1, 0.72, 0.07], 0.03, [0, -2.42, 0]), 0.05);
      sc.add(metal, SDF.box([0.44, 0.1, 0.07], 0.03, [0, -2.24, 0]), 0.05);
      sc.add(metal, SDF.ellipsoid([0.05, 0.16, 0.04], [0, -2.36, 0.05]), 0.03);
      sc.add(metal, SDF.ellipsoid([0.04, 0.04, 0.035], [0, -2.17, 0.05]), 0.02);
    }).g;
  },

  freshener() {
    return Trinkets.make('freshener', 0.02, (sc) => {
      const card = LP.mat('#2f7a3a', { roughness: 1 }), string = LP.mat('#dddddd');
      sc.add(string, SDF.path([[0, 0, 0], [0.08, -0.6, 0], [0, -1.15, 0]], 0.02), 0.01);
      sc.add(string, SDF.torus(0.06, 0.02, [0, -1.22, 0], [0, Math.PI / 2, 0]), 0.01);
      const tree = [[0, -1.2], [0.55, -1.8], [0.3, -1.8], [0.7, -2.3], [0.4, -2.3], [0.8, -2.8], [0.1, -2.8], [0.1, -3.1], [-0.1, -3.1], [-0.1, -2.8], [-0.8, -2.8], [-0.4, -2.3], [-0.7, -2.3], [-0.3, -1.8], [-0.55, -1.8]];
      sc.add(card, SDF.warp(SDF.sideX(tree, 0.05, 0.02), (x, y, z) => [x, y, z - 0.06 * Math.sin(x * 2.2)], 0.06), 0.01);
      sc.cut(SDF.cyl(0.05, 0.2, 'z', 0.01, [0, -1.32, 0]), 0.01); // the hole the string runs through
    }).g;
  },

  dogtags() {
    return Trinkets.make('dogtags', 0.02, (sc, M) => {
      const steel = M.steel();
      Trinkets.chain(sc, steel, -1.6, true);
      // Two stamped tags with a rolled rim, one hanging a little lower and turned.
      for (const [dy, rz, dz] of [[0, 0.08, 0], [-0.3, -0.12, 0.06]]) {
        const p = [0.05, -2.15 + dy, dz];
        sc.add(steel, SDF.box([0.62, 1.0, 0.05], 0.22, p, [0, 0, rz]), 0.01);
        sc.add(steel, SDF.warp(SDF.box([0.62, 1.0, 0.07], 0.22, p, [0, 0, rz]), (x, y, z) => [p[0] + (x - p[0]) * 1.08, p[1] + (y - p[1]) * 1.05, z], 0.05), 0.0001);
        sc.cut(SDF.box([0.48, 0.86, 0.05], 0.16, [p[0], p[1], p[2] + 0.04], [0, 0, rz]), 0.01); // pressed face
        for (let k = 0; k < 4; k++) sc.add(steel, SDF.box([0.3 - (k % 2) * 0.08, 0.04, 0.03], 0.01, [p[0] - 0.03, p[1] + 0.25 - k * 0.15, p[2] + 0.03], [0, 0, rz]), 0.005); // stamped lines
        sc.cut(SDF.cyl(0.05, 0.2, 'z', 0.01, [p[0], p[1] + 0.38, p[2]]), 0.01);
      }
    }).g;
  },

  shoes() {
    return Trinkets.make('shoes', 0.022, (sc, M) => {
      const bronze = M.bronze(), lace = M.cord();
      sc.add(lace, SDF.path([[0, 0, 0], [0, -1.3, 0], [-0.3, -1.7, 0], [0, -1.3, 0], [0.32, -1.85, 0]], 0.025), 0.02);
      // Two bronzed baby shoes hung by their laces: sole, toe cap, heel counter and an open collar.
      for (const [x, y, rz] of [[-0.35, -2.2, 0.4], [0.35, -2.4, -0.3]]) {
        const p = [x, y, 0], rot = [Math.PI / 2 - 0.3, 0, rz];
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot));
        const at = (u, v, w) => new THREE.Vector3(u, v, w).applyMatrix4(m).add(new THREE.Vector3(...p)).toArray();
        sc.add(bronze, SDF.ellipsoid([0.28, 0.6, 0.22], at(0, 0, 0), rot), 0.08); // foot
        sc.add(bronze, SDF.ellipsoid([0.24, 0.24, 0.26], at(0, -0.36, 0.06), rot), 0.15); // toe
        sc.add(bronze, SDF.cone(at(0, 0.28, 0.05), at(0, 0.32, 0.36), 0.22, 0.2), 0.15); // heel and ankle
        sc.cut(SDF.ellipsoid([0.15, 0.2, 0.2], at(0, 0.24, 0.42), rot), 0.04, [bronze]); // collar opening
        sc.add(bronze, SDF.box([0.3, 0.68, 0.06], 0.05, at(0, -0.04, -0.2), rot), 0.06); // sole
      }
    }).g;
  },

  clover() {
    return Trinkets.make('clover', 0.02, (sc, M) => {
      const gold = M.gold(), leaf = LP.mat('#3a8a3a', { roughness: 0.5 });
      Trinkets.chain(sc, gold, -1.4, true);
      sc.add(gold, SDF.torus(0.1, 0.03, [0, -1.48, 0], [0, Math.PI / 2, 0]), 0.01); // bail
      sc.add(gold, SDF.lathe([[0, -0.05], [0.58, -0.05], [0.62, 0], [0.58, 0.05], [0.52, 0.05], [0.5, 0.02], [0, 0.02]], [0, -2.15, 0]), 0.02); // pendant with a raised rim
      // The clover pressed in the middle: four heart-shaped leaves and a stem.
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
        for (const sd of [-1, 1]) sc.add(leaf, SDF.ellipsoid([0.13, 0.13, 0.04], [c * 0.2 - s * 0.08 * sd, -2.15 + s * 0.2 + c * 0.08 * sd, 0.04]), 0.04);
      }
      sc.add(leaf, SDF.path([[0, -2.15, 0.04], [0.06, -2.32, 0.04], [0.14, -2.45, 0.04]], 0.025), 0.03);
    }).g;
  },

  // ---------- Stood on the dash ----------

  bobblehead() {
    const { g, sets } = Trinkets.make('bobblehead', 0.04, (sc) => {
      const base = LP.mat('#222222'), shirt = LP.mat('#2a62c9'), skin = LP.mat('#f1c27d'), cap = LP.mat('#e8423f'), black = LP.mat('#111111'), spring = LP.mat('#999999', { metalness: 0.7 });
      sc.add(base, SDF.lathe([[1.1, 0], [1.1, 0.25], [0.95, 0.4], [0, 0.4]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.05);
      sc.add(shirt, SDF.cone([0, 0.6, 0], [0, 1.7, 0], 0.62, 0.48), 0.1);
      sc.add(shirt, SDF.ellipsoid([0.42, 0.24, 0.72], [0, 1.68, 0]), 0.25);
      sc.add(LP.mat('#ffffff'), SDF.box([0.05, 0.5, 0.4], 0.04, [0.6, 1.2, 0]), 0.03); // number patch
      for (const sd of [-1, 1]) sc.add(skin, SDF.cone([0, 1.6, 0.72 * sd], [0.25, 0.9, 0.82 * sd], 0.15, 0.13), 0.08);
      const helix = [];
      for (let k = 0; k <= 24; k++) { const a = k * 0.8; helix.push([Math.cos(a) * 0.1, 1.85 + k * 0.016, Math.sin(a) * 0.1]); }
      sc.add(spring, SDF.path(helix, 0.025), 0.01, 'neck');
      sc.add(skin, SDF.ellipsoid([0.92, 0.98, 0.92], [0, 2.9, 0]), 0.1, 'neck');
      sc.add(skin, SDF.ellipsoid([0.16, 0.2, 0.14], [0.9, 2.82, 0]), 0.1, 'neck');
      for (const z of [-0.9, 0.9]) sc.add(skin, SDF.ellipsoid([0.12, 0.22, 0.1], [0, 2.9, z]), 0.08, 'neck'); // ears
      sc.add(cap, SDF.ellipsoid([0.95, 0.62, 0.95], [-0.05, 3.42, 0]), 0.05, 'neck');
      sc.add(cap, SDF.box([1.0, 0.1, 1.2], 0.05, [0.78, 3.28, 0], [0, 0, -0.12]), 0.12, 'neck');
      for (const z of [-0.32, 0.32]) sc.add(black, SDF.ellipsoid([0.06, 0.1, 0.08], [0.85, 3.0, z]), 0.01, 'neck');
      sc.add(black, SDF.path([[0.86, 2.6, -0.25], [0.92, 2.55, 0], [0.86, 2.6, 0.25]], 0.035), 0.01, 'neck');
    });
    g.userData.neck = LP.pivot(g, sets.neck, [0, 1.9, 0]);
    return g;
  },

  troll() {
    return Trinkets.make('troll', 0.035, (sc) => {
      const skin = LP.mat('#e8b48a', { roughness: 0.7 }), hair = LP.mat('#ff3aa8', { roughness: 1 }), gem = LP.mat('#3ad8ff', { metalness: 0.3, roughness: 0.15, emissive: '#1a6a8a', emissiveIntensity: 0.3 });
      // Pot belly, stubby legs and arms, a big grinning head, huge ears and a shock of upright hair.
      sc.add(skin, SDF.ellipsoid([0.62, 0.7, 0.56], [0, 0.95, 0]), 0.1);
      for (const sd of [-1, 1]) {
        sc.add(skin, SDF.ellipsoid([0.24, 0.32, 0.26], [0.08, 0.25, sd * 0.3]), 0.15); // legs
        sc.add(skin, SDF.ellipsoid([0.32, 0.12, 0.2], [0.26, 0.06, sd * 0.32]), 0.12); // feet
        sc.add(skin, SDF.path([[0, 1.3, sd * 0.5], [0.15, 1.0, sd * 0.75], [0.35, 0.85, sd * 0.68]], 0.12), 0.12); // arms
        sc.add(skin, SDF.ellipsoid([0.1, 0.32, 0.2], [-0.05, 2.0, sd * 0.68], [sd * 0.5, 0, 0]), 0.1); // ears
      }
      sc.add(skin, SDF.ellipsoid([0.58, 0.55, 0.58], [0.02, 1.95, 0]), 0.25); // head
      sc.add(skin, SDF.ellipsoid([0.2, 0.18, 0.24], [0.55, 1.88, 0]), 0.12); // wide nose
      sc.cut(SDF.path([[0.5, 1.62, -0.25], [0.56, 1.56, 0], [0.5, 1.62, 0.25]], 0.04), 0.03, [skin]); // grin
      sc.add(LP.mat('#2a1a10'), SDF.ellipsoid([0.06, 0.08, 0.08], [0.5, 2.08, -0.2]), 0.01);
      sc.add(LP.mat('#2a1a10'), SDF.ellipsoid([0.06, 0.08, 0.08], [0.5, 2.08, 0.2]), 0.01);
      sc.add(gem, SDF.ellipsoid([0.08, 0.12, 0.12], [0.6, 1.0, 0]), 0.03); // belly gem
      sc.add(hair, SDF.warp(SDF.cone([0, 2.3, 0], [0, 3.6, 0], 0.5, 0.14), (x, y, z) => { const a = Math.atan2(z, x), k = 1 + 0.25 * Math.sin(a * 11 + y * 4); return [x / k, y, z / k]; }, 0.2), 0.15);
    }).g;
  },

  teddy() {
    return Trinkets.make('teddy', 0.035, (sc) => {
      const fur = LP.mat('#8a6a48', { roughness: 1 }), pale = LP.mat('#c8a882', { roughness: 1 }), black = LP.mat('#111111', { roughness: 0.4 }), patch = LP.mat('#d96a1e', { roughness: 1 }), thread = LP.mat('#e8e0c8');
      // Sitting: round body, legs out front, arms at the sides, head with ears and a muzzle; a prison-orange patch.
      sc.add(fur, SDF.ellipsoid([0.62, 0.72, 0.6], [0, 0.75, 0]), 0.1);
      for (const sd of [-1, 1]) {
        sc.add(fur, SDF.cone([0.1, 0.35, sd * 0.35], [0.75, 0.25, sd * 0.45], 0.28, 0.26), 0.2);
        sc.add(pale, SDF.cyl(0.22, 0.06, 'x', 0.03, [0.98, 0.25, sd * 0.45]), 0.04); // foot pads
        sc.add(fur, SDF.path([[0, 1.2, sd * 0.55], [0.2, 0.85, sd * 0.72], [0.38, 0.6, sd * 0.62]], 0.17), 0.15);
        sc.add(fur, SDF.ellipsoid([0.1, 0.24, 0.22], [-0.05, 2.15, sd * 0.42]), 0.08); // ears
        sc.add(pale, SDF.ellipsoid([0.06, 0.15, 0.13], [0.02, 2.15, sd * 0.42]), 0.02);
        sc.add(black, SDF.ellipsoid([0.06, 0.07, 0.07], [0.48, 1.86, sd * 0.18]), 0.01); // button eyes
      }
      sc.add(fur, SDF.ellipsoid([0.5, 0.48, 0.52], [0.04, 1.78, 0]), 0.2);
      sc.add(pale, SDF.ellipsoid([0.22, 0.17, 0.2], [0.46, 1.66, 0]), 0.1); // muzzle
      sc.add(black, SDF.ellipsoid([0.08, 0.06, 0.1], [0.66, 1.72, 0]), 0.02);
      sc.add(patch, SDF.box([0.05, 0.36, 0.36], 0.04, [0.6, 0.85, -0.18]), 0.02);
      for (let k = 0; k < 5; k++) sc.add(thread, SDF.box([0.07, 0.02, 0.06], 0.01, [0.63, 0.7 + k * 0.08, -0.38]), 0.005); // stitches
    }).g;
  },

  snowglobe() {
    const { g } = Trinkets.make('snowglobe', 0.03, (sc) => {
      const wood = LP.mat('#4a2e1a', { roughness: 0.6 }), white = LP.mat('#f2f4f8', { roughness: 1 }), tower = LP.mat('#6a6a6a', { roughness: 0.8 }), lit = LP.glow('#ffd27a', 0.8);
      sc.add(wood, SDF.lathe([[0.85, 0], [0.9, 0.08], [0.8, 0.5], [0.62, 0.62], [0, 0.62]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.05);
      sc.add(white, SDF.ellipsoid([0.55, 0.14, 0.55], [0, 0.66, 0]), 0.05); // snow drift
      // The prison inside: a little watchtower and wall.
      sc.add(tower, SDF.cone([0, 0.7, 0], [0, 1.35, 0], 0.13, 0.1), 0.03);
      sc.add(tower, SDF.box([0.36, 0.18, 0.36], 0.05, [0, 1.42, 0]), 0.05);
      sc.add(lit, SDF.box([0.38, 0.06, 0.38], 0.02, [0, 1.42, 0]), 0.01);
      sc.add(tower, SDF.box([0.8, 0.22, 0.1], 0.03, [-0.1, 0.8, 0.25], [0, 0.4, 0]), 0.04);
    });
    const glass = LP.mesh(new THREE.SphereGeometry(0.7, 28, 20), LP.mat('#d8ecff', { transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false }), 0, 1.25, 0);
    g.add(glass);
    for (let k = 0; k < 18; k++) { // snow drifting in the water
      const a = k * 2.4, r = 0.15 + ((k * 37) % 10) / 22;
      g.add(LP.mesh(new THREE.SphereGeometry(0.025, 6, 4), LP.mat('#ffffff'), Math.cos(a) * r, 0.8 + ((k * 53) % 10) / 12, Math.sin(a) * r));
    }
    return g;
  },

  eightball() {
    const { g } = Trinkets.make('eightball', 0.03, (sc) => {
      const black = LP.mat('#0c0c0e', { roughness: 0.15, metalness: 0.1 }), white = LP.mat('#f2f2ee', { roughness: 0.4 }), stand = LP.mat('#3a3a3c', { metalness: 0.6 });
      sc.add(stand, SDF.torus(0.36, 0.06, [0, 0.06, 0], [Math.PI / 2, 0, 0]), 0.02); // little stand ring
      sc.add(black, SDF.ellipsoid([0.62, 0.62, 0.62], [0, 0.66, 0]), 0.02);
      // White circle with the 8 on the front.
      sc.add(white, SDF.cyl(0.26, 0.06, 'x', 0.02, [0.6, 0.78, 0]), 0.03);
      sc.add(black, SDF.torus(0.065, 0.025, [0.64, 0.86, 0], [0, Math.PI / 2, 0]), 0.005);
      sc.add(black, SDF.torus(0.08, 0.025, [0.64, 0.7, 0], [0, Math.PI / 2, 0]), 0.005);
    });
    g.rotation.y = -0.4;
    return g;
  },

  compass() {
    const { g } = Trinkets.make('compass', 0.025, (sc, M) => {
      const black = LP.mat('#1a1a1a', { roughness: 0.5 }), card = LP.mat('#f2ead6'), red = LP.mat('#c22a1a'), steel = M.steel();
      // A dash-top ball compass: a base plate, a bracket, a black housing and a domed top over the card.
      sc.add(black, SDF.box([0.9, 0.08, 0.7], 0.04, [0, 0.04, 0]), 0.03);
      sc.add(steel, SDF.box([0.1, 0.5, 0.5], 0.04, [-0.1, 0.32, 0]), 0.06);
      sc.add(black, SDF.ellipsoid([0.48, 0.42, 0.48], [0, 0.72, 0]), 0.08);
      sc.add(card, SDF.cyl(0.38, 0.08, 'x', 0.03, [0.42, 0.74, 0]), 0.02); // the card behind the glass
      sc.add(red, SDF.box([0.05, 0.28, 0.04], 0.015, [0.46, 0.74, 0]), 0.01); // lubber line
      sc.add(black, SDF.box([0.05, 0.04, 0.14], 0.01, [0.46, 0.92, 0]), 0.005); // N mark
      for (const sd of [-1, 1]) sc.add(steel, SDF.cyl(0.05, 0.1, 'z', 0.02, [-0.1, 0.5, sd * 0.24]), 0.02); // adjusting screws
    });
    g.add(LP.mesh(new THREE.SphereGeometry(0.4, 20, 14, 0, TAU, 0, Math.PI / 2), LP.mat('#e8f4ff', { transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }), 0.44, 0.74, 0).rotateZ(-Math.PI / 2));
    return g;
  },

  lighter() {
    const { g } = Trinkets.make('lighter', 0.02, (sc, M) => {
      const steel = LP.mat('#b8bcc2', { map: GUNTEX.get('steel'), metalness: 0.85, roughness: 0.32 });
      // Brushed steel case, the hinged lid thrown back, the chimney with its holes, the striker wheel.
      sc.add(steel, SDF.box([0.5, 0.95, 0.3], 0.07, [0, 0.48, 0]), 0.02);
      sc.add(steel, SDF.box([0.5, 0.42, 0.3], 0.07, [-0.12, 1.02, 0], [0, 0, 1.0]), 0.02); // open lid
      sc.add(steel, SDF.box([0.36, 0.32, 0.24], 0.03, [0.04, 1.1, 0]), 0.02); // chimney
      for (const y of [1.02, 1.16]) for (const z of [-0.06, 0.06]) sc.cut(SDF.cyl(0.03, 0.6, 'x', 0.005, [0.04, y, z]), 0.005);
      sc.cut(SDF.box([0.28, 0.28, 0.2], 0.03, [0.04, 1.14, 0]), 0.01); // hollow chimney
      sc.add(LP.mat('#4a4a4a', { metalness: 0.8 }), SDF.cyl(0.07, 0.12, 'z', 0.02, [0.18, 1.16, 0]), 0.01); // striker wheel
      sc.add(LP.mat('#f2f0e6'), SDF.cyl(0.04, 0.12, 'y', 0.02, [0.04, 1.2, 0]), 0.01); // wick
    });
    const flame = LP.mesh(new THREE.ConeGeometry(0.08, 0.32, 10), LP.glow('#ffb03a', 2.2), 0.04, 1.42, 0);
    flame.userData.flame = true;
    g.add(flame);
    return g;
  },

  // ---------- Laid flat on the dash ----------

  horseshoe() {
    return Trinkets.make('horseshoe', 0.025, (sc) => {
      const iron = LP.mat('#6b4a32', { metalness: 0.6, roughness: 0.8 });
      const arc = [];
      for (let k = 0; k <= 12; k++) { const a = -0.55 - (k / 12) * Math.PI * 1.35 + Math.PI * 0.85; arc.push([Math.cos(a) * 0.8, 0.09, Math.sin(a) * 0.8]); }
      sc.add(iron, SDF.warp(SDF.path(arc, 0.17), (x, y, z) => [x, 0.09 + (y - 0.09) / 0.55, z], 0), 0.04); // a flat bar bent round
      for (const e of [arc[0], arc[12]]) sc.add(iron, SDF.box([0.26, 0.16, 0.2], 0.06, [e[0], 0.08, e[2] - 0.06]), 0.06); // heel calks
      for (const k of [2, 4, 8, 10]) sc.cut(SDF.box([0.07, 0.5, 0.12], 0.02, arc[k]), 0.01); // nail holes
      for (const k of [3, 9]) sc.add(LP.mat('#3a3632', { metalness: 0.6 }), SDF.cyl(0.04, 0.12, 'y', 0.01, [arc[k][0], 0.2, arc[k][2]]), 0.005); // a nail left in
    }).g;
  },

  medal() {
    return Trinkets.make('medal', 0.02, (sc, M) => {
      const gold = M.gold();
      sc.add(gold, SDF.lathe([[0.0, 0], [0.55, 0], [0.62, 0.05], [0.6, 0.11], [0.5, 0.11], [0.47, 0.08], [0.0, 0.08]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.02); // struck disc with a rim
      sc.add(gold, SDF.torus(0.12, 0.04, [0, 0.05, -0.68], [Math.PI / 2, 0, 0]), 0.03); // loop
      // The saint wading with the child on his shoulder and a staff, in relief.
      sc.add(gold, SDF.ellipsoid([0.13, 0.05, 0.3], [0.02, 0.1, 0.05]), 0.04);
      sc.add(gold, SDF.ellipsoid([0.08, 0.05, 0.08], [0.02, 0.1, -0.3]), 0.04);
      sc.add(gold, SDF.ellipsoid([0.07, 0.05, 0.07], [0.15, 0.1, -0.24]), 0.04);
      sc.add(gold, SDF.path([[-0.22, 0.1, 0.38], [-0.18, 0.1, -0.36]], 0.025), 0.03);
      sc.add(gold, SDF.path([[-0.4, 0.1, 0.3], [-0.2, 0.1, 0.36], [0, 0.1, 0.3], [0.2, 0.1, 0.36], [0.4, 0.1, 0.3]], 0.02), 0.02); // waves
    }).g;
  },

  photo() {
    const { g } = Trinkets.make('photo', 0.02, (sc) => {
      const card = LP.mat('#f2efe6', { roughness: 0.9 }), tape = LP.mat('#d8d0a0', { roughness: 1, transparent: true, opacity: 0.85 });
      sc.add(card, SDF.warp(SDF.box([1.1, 0.03, 1.3], 0.01, [0, 0.02, 0]), (x, y, z) => [x, y - 0.03 * Math.sin(x * 2.5), z], 0.04), 0.0001); // a curled polaroid
      sc.add(tape, SDF.box([0.18, 0.02, 0.6], 0.01, [0.48, 0.05, -0.55], [0, 0.6, 0]), 0.0001);
    });
    const pic = LP.mesh(new THREE.PlaneGeometry(0.92, 0.92), LP.mat('#ffffff', { map: DECALS.get('photo') }), 0, 0.045, -0.08);
    pic.rotation.x = -Math.PI / 2;
    g.add(pic);
    return g;
  },

  smokes() {
    return Trinkets.make('smokes', 0.02, (sc) => {
      const pack = LP.mat('#c23a2a', { roughness: 0.7 }), white = LP.mat('#f2efe6'), foil = LP.mat('#c8c8c8', { metalness: 0.8, roughness: 0.3 }), filter = LP.mat('#c98a3a');
      // A crushed soft pack lying on its back, flip top open, three cigarettes sliding out.
      sc.add(pack, SDF.warp(SDF.box([1.4, 0.32, 0.9], 0.08, [0, 0.16, 0]), (x, y, z) => [x, y + 0.04 * Math.sin(x * 3) * Math.cos(z * 4), z], 0.05), 0.02);
      sc.add(white, SDF.box([0.5, 0.33, 0.92], 0.06, [-0.3, 0.165, 0]), 0.01); // white band
      sc.add(pack, SDF.box([0.36, 0.06, 0.88], 0.03, [0.82, 0.38, 0], [0, 0, 0.9]), 0.02); // the lid flipped open
      sc.cut(SDF.box([0.25, 0.26, 0.76], 0.04, [0.62, 0.2, 0]), 0.02, [pack]);
      sc.add(foil, SDF.box([0.06, 0.22, 0.74], 0.02, [0.58, 0.2, 0]), 0.01);
      for (const [z, out] of [[-0.2, 0.25], [0.02, 0.45], [0.24, 0.12]]) {
        sc.add(white, SDF.cyl(0.07, 0.9, 'x', 0.03, [0.3 + out, 0.18, z]), 0.005);
        sc.add(filter, SDF.cyl(0.072, 0.24, 'x', 0.03, [0.62 + out, 0.18, z]), 0.005);
      }
    }).g;
  },

  tooth() {
    return Trinkets.make('tooth', 0.015, (sc, M) => {
      const gold = M.gold(), cloth = LP.mat('#5a1a2a', { roughness: 1 });
      sc.add(cloth, SDF.warp(SDF.box([0.9, 0.04, 0.9], 0.02, [0, 0.02, 0], [0, 0.4, 0]), (x, y, z) => [x, y - 0.03 * Math.sin(x * 4 + z * 3), z], 0.04), 0.0001); // a little velvet square
      // A gold molar on its side: crown with cusps and two roots.
      sc.add(gold, SDF.box([0.36, 0.3, 0.32], 0.12, [0, 0.2, 0]), 0.05);
      for (const [x, z] of [[-0.09, -0.08], [0.09, -0.08], [-0.09, 0.08], [0.09, 0.08]]) sc.add(gold, SDF.ellipsoid([0.08, 0.06, 0.08], [x, 0.34, z]), 0.05);
      for (const z of [-0.08, 0.08]) sc.add(gold, SDF.cone([0, 0.12, z], [0.42, 0.08, z * 1.4], 0.1, 0.035), 0.06);
    }).g;
  },

  sparkplug() {
    return Trinkets.make('sparkplug', 0.015, (sc, M) => {
      const ceramic = LP.mat('#f2efe6', { roughness: 0.3 }), steel = M.steel(), nut = LP.mat('#8a8a86', { metalness: 0.8, roughness: 0.35 });
      // Lying on its side along X: terminal, ribbed ceramic insulator, hex nut, threads, ground electrode.
      const c = [0, 0.16, 0];
      sc.add(steel, SDF.cyl(0.05, 0.16, 'x', 0.02, [-0.92, 0.16, 0]), 0.02);
      sc.add(ceramic, SDF.lathe([[0.07, -0.85], [0.12, -0.8], [0.12, -0.72], [0.1, -0.68], [0.12, -0.6], [0.1, -0.56], [0.12, -0.48], [0.14, -0.3], [0.14, -0.05]], c, [0, Math.PI / 2, 0]), 0.02);
      sc.add(nut, SDF.warp(SDF.cyl(0.18, 0.22, 'x', 0.02, [0.04, 0.16, 0]), (x, y, z) => { const a = Math.atan2(z, y - 0.16), k = Math.cos(Math.PI / 6) / Math.cos(((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6); return [x, 0.16 + (y - 0.16) * k, z * k]; }, 0.03), 0.02);
      sc.add(steel, SDF.cyl(0.11, 0.36, 'x', 0.01, [0.33, 0.16, 0]), 0.01);
      for (let k = 0; k < 6; k++) sc.cut(SDF.torus(0.115, 0.012, [0.18 + k * 0.055, 0.16, 0], [0, Math.PI / 2, 0]), 0.004); // threads
      sc.add(steel, SDF.path([[0.5, 0.25, 0], [0.6, 0.26, 0], [0.62, 0.16, 0]], 0.025), 0.01); // ground electrode
    }).g;
  },

  cassette() {
    const { g } = Trinkets.make('cassette', 0.015, (sc) => {
      const shell = LP.mat('#1a1a1c', { roughness: 0.4 }), clear = LP.mat('#6a6a72', { roughness: 0.1, metalness: 0.2 }), hub = LP.mat('#f2f2ee'), tape = LP.mat('#3a2418', { roughness: 0.5 });
      sc.add(shell, SDF.box([1.6, 0.18, 1.0], 0.05, [0, 0.09, 0]), 0.01);
      sc.cut(SDF.box([0.8, 0.1, 0.26], 0.05, [0, 0.19, 0.0]), 0.01, [shell]); // window
      sc.add(clear, SDF.box([0.8, 0.03, 0.26], 0.02, [0, 0.12, 0]), 0.0001);
      for (const x of [-0.42, 0.42]) {
        sc.add(tape, SDF.cyl(x < 0 ? 0.26 : 0.16, 0.08, 'y', 0.01, [x, 0.12, 0]), 0.0001);
        sc.add(hub, SDF.cyl(0.08, 0.1, 'y', 0.01, [x, 0.13, 0]), 0.005);
        sc.cut(SDF.cyl(0.035, 0.4, 'y', 0.005, [x, 0.13, 0]), 0.005, [hub]);
      }
      sc.add(shell, SDF.box([1.0, 0.2, 0.18], 0.04, [0, 0.1, 0.46]), 0.02); // head edge
    });
    // A hand-written label.
    const c = document.createElement('canvas'); c.width = 64; c.height = 32;
    const x = c.getContext('2d');
    x.fillStyle = '#f2ead6'; x.fillRect(0, 0, 64, 32);
    x.fillStyle = '#c22a1a'; x.fillRect(0, 0, 64, 4);
    x.fillStyle = '#1a1a40'; x.font = 'italic 11px cursive'; x.fillText('for the road', 4, 20);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const label = LP.mesh(new THREE.PlaneGeometry(1.36, 0.36), LP.mat('#ffffff', { map: tex }), 0, 0.185, -0.28);
    label.rotation.x = -Math.PI / 2;
    g.add(label);
    return g;
  },
};

Object.assign(Models, {
  trinket(id) {
    const g = (TRINKET_BUILD[id] || TRINKET_BUILD.dice)();
    g.userData.mount = TRINKET_MOUNT[id] || 'hang';
    return g;
  },
  // Kept for the model viewer and older call sites.
  fuzzyDice: () => Models.trinket('dice'),
  bobblehead: () => Models.trinket('bobblehead'),
});
