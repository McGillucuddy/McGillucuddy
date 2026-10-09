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
    if (beads) {
      const n = Math.max(1, Math.round(-y / 0.14));
      sc.add(mat, SDF.cyl(0.014, -y, 'y', 0.005, [0, y / 2, 0]), 0.005); // the links between the balls
      for (let k = 0; k <= n; k++) sc.add(mat, SDF.ellipsoid([0.05, 0.05, 0.05], [0, (y * k) / n, 0]), 0.005);
    } else sc.add(mat, SDF.path([[0, 0, 0], [0.02, y * 0.5, 0.01], [0, y, 0]], 0.03), 0.02);
  },
};

const TRINKET_BUILD = {
  // ---------- Hung from the mirror ----------

  dice() {
    return Trinkets.make('dice', 0.028, (sc) => {
      const cord = LP.mat('#eeeeee'), pip = LP.mat('#111111', { roughness: 1 });
      const A = [0, -2.6, -0.36], B = [0.1, -2.86, 0.42];
      // One cord doubled through a knot, each end sewn into the middle of a die.
      sc.add(cord, SDF.path([[0, 0, 0], [0, -1.5, 0], [0.02, -2.0, -0.2], A], 0.03), 0.02);
      sc.add(cord, SDF.path([[0, -1.5, 0], [0.05, -2.1, 0.22], B], 0.03), 0.02);
      sc.add(cord, SDF.ellipsoid([0.1, 0.12, 0.1], [0, -1.5, 0]), 0.04); // the knot
      // Opposite faces add up to seven, like a real die.
      const pips = {
        1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
        5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
      };
      const die = (mat, p, rot) => {
        // Plush: a soft rounded cube with a fuzzy surface and pips sewn into its flat faces.
        sc.add(mat, SDF.warp(SDF.box([0.82, 0.82, 0.82], 0.2, p, rot), (x, y, z) => { const n = 1 + 0.015 * Math.sin(x * 40) * Math.sin(y * 37) * Math.sin(z * 43); return [p[0] + (x - p[0]) / n, p[1] + (y - p[1]) / n, p[2] + (z - p[2]) / n]; }, 0.02), 0.02);
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot));
        const at = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m).add(new THREE.Vector3(...p)).toArray();
        for (const [n, axis, sd] of [[1, 'y', 1], [6, 'y', -1], [2, 'x', 1], [5, 'x', -1], [3, 'z', 1], [4, 'z', -1]]) {
          for (const [u0, v0] of pips[n]) {
            const u = u0 * 0.15, v = v0 * 0.15, f = 0.41 * sd;
            const q = axis === 'z' ? at(u, v, f) : axis === 'x' ? at(f, u, v) : at(u, f, v);
            sc.cut(SDF.ellipsoid([0.07, 0.07, 0.07], q), 0.015, [mat]);
            sc.add(pip, SDF.ellipsoid([0.06, 0.06, 0.06], q), 0.005);
          }
        }
      };
      die(LP.mat('#f2f2f2', { roughness: 1 }), A, [0.4, 0.3, 0.2]);
      die(LP.mat('#ff3b6b', { roughness: 1 }), B, [-0.3, 0.6, 0.2]);
    }).g;
  },

  rabbit_foot() {
    return Trinkets.make('rabbit_foot', 0.022, (sc, M) => {
      const fur = LP.mat('#d8cfc0', { roughness: 1 }), claw = LP.mat('#3a3028', { roughness: 0.5 }), gold = M.gold();
      Trinkets.chain(sc, M.steel(), -1.62, true);
      sc.add(gold, SDF.torus(0.08, 0.025, [0, -1.66, 0], [0, Math.PI / 2, 0]), 0.01); // eye the chain hangs from
      sc.add(gold, SDF.lathe([[0.06, 0.0], [0.17, 0.06], [0.24, 0.2], [0.26, 0.3]], [0, -1.72, 0], [Math.PI / 2, 0, 0]), 0.03); // crimped cap
      // The foot: slim at the cap, swelling to the paw, which bends forward; shaggy fur and three toes with claws.
      const shag = (x, y, z) => { const n = 1 + 0.035 * Math.sin(y * 47 + x * 19) * Math.sin(z * 41 - y * 13) + 0.02 * Math.sin(x * 71 + z * 67); return [x / n, y, (z - 0.05) / n + 0.05]; };
      sc.add(fur, SDF.warp(SDF.union([
        SDF.cone([0, -1.95, 0], [0, -2.55, 0.04], 0.24, 0.28),
        SDF.cone([0, -2.55, 0.04], [0.02, -2.95, 0.16], 0.28, 0.3),
      ]), shag, 0.03), 0.1);
      for (const [x, z] of [[-0.15, 0.3], [0.02, 0.38], [0.18, 0.28]]) {
        sc.add(fur, SDF.ellipsoid([0.12, 0.14, 0.12], [x, -3.1, z]), 0.12);
        sc.add(claw, SDF.cone([x, -3.14, z + 0.06], [x, -3.24, z + 0.16], 0.035, 0.008), 0.01);
      }
    }).g;
  },

  keys() {
    return Trinkets.make('keys', 0.02, (sc, M) => {
      const brass = M.brass(), steel = M.steel(), leather = LP.mat('#5a3a22', { roughness: 0.8 });
      const R = 0.4, cy = -1.75, wire = (x) => cy - Math.sqrt(R * R - x * x); // the bottom of the split ring
      sc.add(steel, SDF.path([[0, 0, 0], [0.02, -0.7, 0], [0, cy + R + 0.02, 0]], 0.03), 0.02);
      sc.add(steel, SDF.torus(R, 0.045, [0, cy, 0]), 0.02); // split ring, in the XY plane
      // Keys hang across the ring, so the wire runs straight through each bow's hole.
      for (const [ox, a, len] of [[-0.2, 0.25, 1.1], [0, -0.05, 1.4], [0.2, -0.3, 0.9]]) {
        const P = [ox, wire(ox), 0];
        const at = (v, w) => [P[0], P[1] + v * Math.cos(a) - w * Math.sin(a), P[2] + v * Math.sin(a) + w * Math.cos(a)];
        const rot = [a, 0, 0];
        sc.add(brass, SDF.cyl(0.22, 0.08, 'x', 0.03, at(-0.12, 0), rot), 0.03); // bow
        sc.cut(SDF.cyl(0.09, 0.4, 'x', 0.01, at(-0.02, 0), rot), 0.01, [brass]); // the hole the ring passes through
        sc.add(brass, SDF.box([0.08, len, 0.11], 0.03, at(-len / 2 - 0.3, 0), rot), 0.05); // blade
        sc.add(brass, SDF.box([0.08, 0.16, 0.3], 0.03, at(-len - 0.2, 0.13), rot), 0.03); // bit
        sc.cut(SDF.box([0.2, 0.08, 0.08], 0.01, at(-len - 0.18, 0.2), rot), 0.01, [brass]); // ward cut
      }
      // Leather fob on its own little ring, linked through the split ring.
      const t = Math.PI * 1.22, rx = Math.cos(t), ry = Math.sin(t), wp = [R * rx, cy + R * ry, 0];
      const c = [wp[0] + rx * 0.07, wp[1] + ry * 0.07, 0];
      sc.add(steel, SDF.torus(0.1, 0.022, c, [Math.PI / 2, 0, Math.atan2(ry, rx)]), 0.01);
      const top = [c[0] + rx * 0.1, c[1] + ry * 0.1];
      sc.add(leather, SDF.box([0.36, 0.86, 0.08], 0.08, [top[0], top[1] - 0.38, 0]), 0.03);
      sc.cut(SDF.cyl(0.05, 0.3, 'z', 0.01, [top[0], top[1] - 0.06, 0]), 0.01, [leather]); // punched hole
      sc.cut(SDF.box([0.2, 0.4, 0.2], 0.05, [top[0], top[1] - 0.48, 0.1]), 0.02, [leather]); // stamped number plate recess
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
    return Trinkets.make('dogtags', 0.018, (sc, M) => {
      const steel = M.steel();
      const H = [0.05, -1.86, 0]; // where the holes line up
      Trinkets.chain(sc, steel, -1.63, true);
      // A jump ring through both holes, hanging from the end of the chain.
      sc.add(steel, SDF.torus(0.1, 0.018, [H[0], H[1] + 0.09, 0.035], [0, Math.PI / 2, 0]), 0.005);
      // Two stamped tags with a rolled rim, turned a little apart on the ring.
      for (const [rz, dz] of [[0.1, 0], [-0.16, 0.07]]) {
        const p = [H[0] + 0.38 * Math.sin(rz), H[1] - 0.38 * Math.cos(rz), dz];
        const rot = [0, 0, rz];
        sc.add(steel, SDF.box([0.62, 1.0, 0.04], 0.018, p, rot), 0.01);
        sc.cut(SDF.box([0.5, 0.86, 0.04], 0.016, [p[0], p[1], p[2] + 0.03], rot), 0.008); // pressed face, leaving a rim
        for (let k = 0; k < 4; k++) {
          const v = 0.2 - k * 0.15, q = [p[0] - 0.03 * Math.cos(rz) - v * Math.sin(rz), p[1] - 0.03 * Math.sin(rz) + v * Math.cos(rz), p[2] + 0.012];
          sc.add(steel, SDF.box([0.3 - (k % 2) * 0.08, 0.04, 0.02], 0.008, q, rot), 0.004); // stamped lines
        }
        sc.cut(SDF.cyl(0.05, 0.3, 'z', 0.01, [H[0], H[1], dz]), 0.008); // the hole
      }
    }).g;
  },

  shoes() {
    return Trinkets.make('shoes', 0.018, (sc, M) => {
      const bronze = M.bronze(), lace = M.cord();
      const ends = [[-0.3, -1.72, 0], [0.32, -1.86, 0]];
      sc.add(lace, SDF.path([[0, 0, 0], [0, -1.3, 0], ends[0]], 0.025), 0.02);
      sc.add(lace, SDF.path([[0, -1.3, 0], ends[1]], 0.025), 0.02);
      // Two bronzed baby shoes hung toe-down by their laces: sole, toe box, heel, ankle collar, an instep strap.
      [[ends[0], 1.15, 0.5, 0.2], [ends[1], 1.3, -0.4, -0.15]].forEach(([L, rx, ry, rz]) => {
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
        const collar = new THREE.Vector3(0, 0.36, -0.14).applyMatrix4(m);
        const o = new THREE.Vector3(...L).sub(collar);
        const at = (u, v, w) => new THREE.Vector3(u, v, w).applyMatrix4(m).add(o).toArray(), rot = [rx, ry, rz];
        sc.add(bronze, SDF.box([0.34, 0.07, 0.78], 0.03, at(0, 0.035, 0), rot), 0.04); // sole
        sc.add(bronze, SDF.ellipsoid([0.17, 0.15, 0.25], at(0, 0.13, 0.15), rot), 0.1); // toe box
        sc.add(bronze, SDF.ellipsoid([0.16, 0.19, 0.2], at(0, 0.17, -0.17), rot), 0.1); // heel
        sc.add(bronze, SDF.cyl(0.15, 0.16, 'y', 0.05, at(0, 0.3, -0.14), rot), 0.08); // ankle
        sc.cut(SDF.ellipsoid([0.1, 0.16, 0.11], at(0, 0.42, -0.13), rot), 0.03, [bronze]); // collar opening
        sc.add(bronze, SDF.box([0.36, 0.05, 0.1], 0.02, at(0, 0.27, 0.02), [rx + 0.5, ry, rz]), 0.03); // strap
      });
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
        sc.add(skin, SDF.ellipsoid([0.24, 0.32, 0.26], [0.08, 0.32, sd * 0.3]), 0.15); // legs
        sc.add(skin, SDF.ellipsoid([0.32, 0.12, 0.2], [0.26, 0.12, sd * 0.32]), 0.12); // feet, flat on the base
        sc.add(skin, SDF.path([[0, 1.3, sd * 0.5], [0.15, 1.0, sd * 0.75], [0.35, 0.85, sd * 0.68]], 0.12), 0.12); // arms
        sc.add(skin, SDF.ellipsoid([0.1, 0.32, 0.2], [-0.05, 2.0, sd * 0.68], [sd * 0.5, 0, 0]), 0.1); // ears
      }
      sc.add(skin, SDF.ellipsoid([0.58, 0.55, 0.58], [0.02, 1.95, 0]), 0.25); // head
      sc.add(skin, SDF.ellipsoid([0.2, 0.18, 0.24], [0.55, 1.88, 0]), 0.12); // wide nose
      sc.cut(SDF.path([[0.5, 1.62, -0.25], [0.56, 1.56, 0], [0.5, 1.62, 0.25]], 0.04), 0.03, [skin]); // grin
      sc.add(LP.mat('#2a1a10'), SDF.ellipsoid([0.06, 0.08, 0.08], [0.5, 2.08, -0.2]), 0.01);
      sc.add(LP.mat('#2a1a10'), SDF.ellipsoid([0.06, 0.08, 0.08], [0.5, 2.08, 0.2]), 0.01);
      sc.add(gem, SDF.ellipsoid([0.08, 0.12, 0.12], [0.6, 1.0, 0]), 0.03); // belly gem
      // Hair: strands rooted in the crown, sweeping up into one tall flame of a tuft.
      const rnd = mulberry32(5);
      for (let k = 0; k < 36; k++) {
        const a = k * 2.4, r = 0.12 + 0.24 * Math.sqrt((k + 0.5) / 36), bx = Math.cos(a) * r, bz = Math.sin(a) * r;
        const h = 3.3 + rnd() * 0.45, tw = 0.25 + rnd() * 0.15;
        sc.add(hair, SDF.path([[bx * 0.9, 2.3, bz * 0.9], [bx * 1.35, 2.75, bz * 1.35], [bx * tw + (rnd() - 0.5) * 0.12, h, bz * tw + (rnd() - 0.5) * 0.12]], 0.06), 0.08);
      }
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
      // The prison inside: a little watchtower and a stretch of wall, both standing in the snow.
      sc.add(tower, SDF.cone([0, 0.66, 0], [0, 1.35, 0], 0.13, 0.1), 0.03);
      sc.add(tower, SDF.box([0.36, 0.18, 0.36], 0.05, [0, 1.42, 0]), 0.05);
      sc.add(lit, SDF.box([0.38, 0.06, 0.38], 0.02, [0, 1.42, 0]), 0.01);
      sc.add(tower, SDF.box([0.5, 0.26, 0.1], 0.03, [-0.12, 0.8, 0.22], [0, 0.4, 0]), 0.04);
    });
    const glass = LP.mesh(new THREE.SphereGeometry(0.7, 28, 20), LP.mat('#d8ecff', { transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false }), 0, 1.25, 0);
    g.add(glass);
    const rnd = mulberry32(9), flake = LP.mat('#ffffff');
    for (let k = 0; k < 18;) { // snow drifting in the water, all of it inside the glass and above the drift
      const x = (rnd() - 0.5) * 1.2, y = 0.85 + rnd() * 0.95, z = (rnd() - 0.5) * 1.2;
      if (Math.hypot(x, y - 1.25, z) > 0.6) continue;
      g.add(LP.mesh(new THREE.SphereGeometry(0.025, 6, 4), flake, x, y, z));
      k++;
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
    const { g } = Trinkets.make('compass', 0.022, (sc, M) => {
      const black = LP.mat('#1a1a1a', { roughness: 0.5 }), card = LP.mat('#f2ead6'), red = LP.mat('#c22a1a'), ink = LP.mat('#111111'), steel = M.steel();
      // A dash-top ball compass: base plate, a U bracket, the black ball with a window, the card floating inside.
      const C = [0, 0.78, 0], R = 0.45;
      sc.add(steel, SDF.box([0.7, 0.08, 1.2], 0.03, [0, 0.04, 0]), 0.02);
      for (const sd of [-1, 1]) {
        sc.add(steel, SDF.box([0.22, 0.82, 0.06], 0.03, [0, 0.45, sd * 0.5]), 0.03); // bracket arms
        sc.add(steel, SDF.cyl(0.07, 0.12, 'z', 0.02, [0, C[1], sd * 0.56]), 0.01); // pivot screws
      }
      sc.add(black, SDF.ellipsoid([R, R, R], C), 0.01);
      sc.cut(SDF.ellipsoid([0.32, 0.32, 0.32], [C[0] + 0.42, C[1], 0]), 0.02, [black]); // the window bowl
      sc.add(card, SDF.cyl(0.27, 0.05, 'x', 0.02, [0.13, C[1], 0]), 0.005); // the card
      sc.add(red, SDF.box([0.03, 0.3, 0.03], 0.01, [0.16, C[1], 0]), 0.005); // lubber line
      sc.add(ink, SDF.box([0.03, 0.06, 0.12], 0.01, [0.16, C[1] + 0.19, 0]), 0.005); // N
      for (const a of [Math.PI / 2, Math.PI, -Math.PI / 2]) sc.add(ink, SDF.box([0.03, 0.03, 0.08], 0.01, [0.16, C[1] + Math.sin(a) * 0.2, Math.cos(a) * 0.2], [a, 0, 0]), 0.005); // E S W ticks
    });
    // Glass: a cap over the window only, so it never fights the housing.
    g.add(LP.mesh(new THREE.SphereGeometry(0.452, 24, 8, 0, TAU, 0, 0.8).rotateZ(-Math.PI / 2), LP.mat('#e8f4ff', { transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false }), 0, 0.78, 0));
    return g;
  },

  lighter() {
    const { g } = Trinkets.make('lighter', 0.018, (sc) => {
      const steel = LP.mat('#b8bcc2', { metalness: 0.85, roughness: 0.32 }), dark = LP.mat('#4a4a4a', { metalness: 0.8 });
      // Brushed steel case, the lid thrown back on its hinge, the chimney with its holes, the striker wheel and wick.
      sc.add(steel, SDF.box([0.5, 0.95, 0.3], 0.06, [0, 0.475, 0]), 0.02);
      const hinge = [-0.25, 0.95], a = 1.75, ca = Math.cos(a), sa = Math.sin(a);
      const lid = (u, v) => [hinge[0] + u * ca - v * sa, hinge[1] + u * sa + v * ca, 0]; // lid space: hinge at its corner
      sc.add(steel, SDF.box([0.5, 0.42, 0.3], 0.06, lid(0.25, 0.21), [0, 0, a]), 0.02);
      sc.cut(SDF.box([0.42, 0.38, 0.22], 0.03, lid(0.25, 0.17), [0, 0, a]), 0.01, [steel]); // hollow inside of the lid
      sc.add(dark, SDF.cyl(0.04, 0.3, 'z', 0.01, [hinge[0], hinge[1], 0]), 0.01); // hinge pin
      sc.add(steel, SDF.box([0.34, 0.3, 0.24], 0.03, [0.04, 1.1, 0]), 0.02); // chimney
      sc.cut(SDF.box([0.28, 0.3, 0.18], 0.03, [0.04, 1.16, 0]), 0.01, [steel]); // open top of the chimney
      for (const y of [1.02, 1.14]) for (const z of [-0.06, 0.06]) sc.cut(SDF.cyl(0.028, 0.6, 'x', 0.005, [0.04, y, z]), 0.005, [steel]);
      sc.add(dark, SDF.cyl(0.07, 0.1, 'z', 0.02, [0.18, 1.2, 0]), 0.01); // striker wheel
      sc.add(LP.mat('#f2f0e6'), SDF.cyl(0.035, 0.22, 'y', 0.015, [0.04, 1.16, 0]), 0.005); // wick
    });
    // A small teardrop flame sitting on the wick.
    const prof = [[0, 0], [0.04, 0.03], [0.055, 0.08], [0.045, 0.14], [0.02, 0.21], [0, 0.26]].map(([x, y]) => new THREE.Vector2(x, y));
    const flame = LP.mesh(new THREE.LatheGeometry(prof, 12), LP.glow('#ffb03a', 2.2), 0.04, 1.26, 0);
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
    const curl = (x) => 0.03 * Math.sin(x * 2.5); // how far the card has curled up at x
    const { g } = Trinkets.make('photo', 0.02, (sc) => {
      const card = LP.mat('#f2efe6', { roughness: 0.9 }), tape = LP.mat('#d8d0a0', { roughness: 1, transparent: true, opacity: 0.85 });
      sc.add(card, SDF.warp(SDF.box([1.1, 0.03, 1.3], 0.01, [0, 0.045, 0]), (x, y, z) => [x, y - curl(x), z], 0.04), 0.0001); // a curled polaroid
      sc.add(tape, SDF.warp(SDF.box([0.14, 0.02, 0.4], 0.008, [0.36, 0.07, -0.45], [0, 0.6, 0]), (x, y, z) => [x, y - curl(x), z], 0.04), 0.0001);
    });
    const geo = new THREE.PlaneGeometry(0.92, 0.92, 12, 1).rotateX(-Math.PI / 2), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, 0.064 + curl(pos.getX(i)));
    geo.computeVertexNormals();
    g.add(LP.mesh(geo, LP.mat('#ffffff', { map: DECALS.get('photo') }), 0, 0, -0.08));
    return g;
  },

  smokes() {
    return Trinkets.make('smokes', 0.02, (sc) => {
      const pack = LP.mat('#c23a2a', { roughness: 0.7 }), white = LP.mat('#f2efe6'), foil = LP.mat('#c8c8c8', { metalness: 0.8, roughness: 0.3 }), filter = LP.mat('#c98a3a');
      // A pack lying on its back, flip top open, three cigarettes sliding out.
      sc.add(pack, SDF.box([1.4, 0.32, 0.9], 0.06, [0, 0.16, 0]), 0.02);
      sc.add(white, SDF.box([0.5, 0.336, 0.916], 0.065, [-0.3, 0.16, 0]), 0.005); // white band round the pack
      const hx = 0.7, hy = 0.32, a = 0.9; // the lid hinges on the top edge of the open end
      sc.add(pack, SDF.box([0.36, 0.06, 0.88], 0.03, [hx + 0.18 * Math.cos(a) - 0.03 * Math.sin(a), hy + 0.18 * Math.sin(a) + 0.03 * Math.cos(a) - 0.03, 0], [0, 0, a]), 0.02);
      sc.cut(SDF.box([0.25, 0.26, 0.76], 0.04, [0.62, 0.17, 0]), 0.02, [pack]);
      sc.add(foil, SDF.box([0.06, 0.22, 0.74], 0.02, [0.58, 0.17, 0]), 0.01);
      for (const [z, out] of [[-0.2, 0.25], [0.02, 0.45], [0.24, 0.12]]) {
        sc.add(white, SDF.cyl(0.07, 0.9, 'x', 0.03, [0.3 + out, 0.17, z]), 0.005);
        sc.add(filter, SDF.cyl(0.072, 0.24, 'x', 0.03, [0.62 + out, 0.17, z]), 0.005);
      }
    }).g;
  },

  tooth() {
    return Trinkets.make('tooth', 0.015, (sc, M) => {
      const gold = M.gold(), cloth = LP.mat('#5a1a2a', { roughness: 1 });
      sc.add(cloth, SDF.warp(SDF.box([0.9, 0.04, 0.9], 0.015, [0, 0.035, 0], [0, 0.4, 0]), (x, y, z) => [x, y - 0.015 * Math.sin(x * 4 + z * 3), z], 0.02), 0.0001); // a little velvet square
      // A gold molar lying on its side on the cloth: crown with four cusps facing -x, two roots reaching +x.
      sc.add(gold, SDF.box([0.32, 0.34, 0.36], 0.12, [-0.08, 0.24, 0]), 0.05); // crown
      for (const [y, z] of [[0.15, -0.09], [0.15, 0.09], [0.33, -0.09], [0.33, 0.09]]) sc.add(gold, SDF.ellipsoid([0.07, 0.08, 0.08], [-0.24, y, z]), 0.05); // cusps
      for (const z of [-0.09, 0.09]) sc.add(gold, SDF.cone([0.05, 0.22, z], [0.4, 0.17, z * 1.4], 0.1, 0.05), 0.06); // roots
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
