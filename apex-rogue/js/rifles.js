'use strict';
// Rifles and machine guns: the Warden Corp carbine and Grinder LMG (modern, guard issue, liberated), and three
// pre-war guns from the arsenals that were sealed when the Plate went up: the Liberty rifle, the Typewriter drum gun
// and the Widow pan-fed machine gun. Same conventions as the other guns (js/models.js): sculpted, -Z is forward,
// the grip near the origin, side profiles are [forward, up] (SDF.side), moving parts gathered on pivots.

Object.assign(Models, {
  // WC-9 Carbine: a flat-top rifle with a curved magazine, vented handguard, birdcage flash hider and a collapsible
  // stock, with the Warden Corp yellow band still on it.
  carbine() {
    const g = new THREE.Group();
    g.name = 'carbine';
    const M = GUNTEX.mats({ steel: '#26282b', poly: '#3b3e30' }), steel = M.steel, worn = M.worn, poly = M.poly;
    const hazard = LP.mat('#c9a43a', { roughness: 0.6 }), rubber = LP.mat('#151515', { roughness: 0.9 });
    const sc = new Sculpt('carbine', 0.04);
    // Upper receiver and its flat-top rail, ejection port, forward assist and charging handle.
    sc.add(steel, SDF.side([[2.65, 0.0], [-2.8, 0.0], [-2.8, 0.52], [2.65, 0.52]], 0.78, 0.1), 0.05);
    sc.add(worn, SDF.box([0.44, 0.16, 5.3], 0.03, [0, 0.6, -0.05]), 0.03);
    for (let z = -2.45; z < 2.6; z += 0.32) sc.cut(SDF.box([0.6, 0.06, 0.12], 0.01, [0, 0.67, z]), 0.01, [worn]);
    sc.cut(SDF.box([0.12, 0.28, 1.1], 0.04, [0.4, 0.25, -0.5]), 0.03, [steel]);
    sc.add(worn, SDF.cyl(0.12, 0.2, 'x', 0.03, [0.42, 0.2, 0.8]), 0.02);
    sc.add(worn, SDF.box([0.55, 0.14, 0.35], 0.05, [0, 0.47, 2.72]), 0.03);
    sc.add(steel, SDF.box([0.4, 0.34, 0.34], 0.06, [0, 0.82, 2.1]), 0.04); // rear sight on the rail
    // Lower receiver with the magazine well, trigger guard, trigger and selector.
    sc.add(steel, SDF.side([[1.75, -0.65], [0.55, -0.65], [0.2, -0.5], [-1.9, -0.5], [-1.9, 0.02], [1.9, 0.02]], 0.72, 0.08), 0.05);
    sc.add(steel, SDF.path([[0, -0.55, -0.45], [0, -1.02, -0.35], [0, -1.08, 0.35], [0, -0.85, 0.6]], 0.06), 0.04);
    sc.add(worn, SDF.box([0.12, 0.4, 0.14], 0.05, [0, -0.76, 0.0], [0.25, 0, 0]), 0.03);
    sc.add(worn, SDF.box([0.08, 0.14, 0.3], 0.03, [-0.39, -0.25, 0.9]), 0.02);
    // Pistol grip, raked back, with a palm swell.
    sc.add(poly, SDF.side([[-0.45, -0.45], [-1.25, -0.45], [-1.85, -2.5], [-1.05, -2.6], [-0.75, -1.3]], 0.6, 0.15), 0.08);
    // Handguard with vents and a top rail; barrel, gas block, front sight post and a birdcage flash hider.
    sc.add(poly, SDF.box([0.74, 0.74, 3.3], 0.22, [0, 0.22, -4.3]), 0.05);
    for (let k = 0; k < 5; k++) for (const x of [-0.37, 0.37]) sc.cut(SDF.box([0.14, 0.12, 0.42], 0.04, [x, 0.22, -3.1 - k * 0.6]), 0.02, [poly]);
    sc.add(worn, SDF.box([0.42, 0.12, 3.1], 0.03, [0, 0.62, -4.3]), 0.02);
    sc.add(steel, SDF.lathe([[0.17, -5.9], [0.15, -7.0]], [0, 0.25, 0]), 0.03);
    sc.add(steel, SDF.box([0.36, 0.4, 0.35], 0.06, [0, 0.25, -6.2]), 0.04);
    sc.add(steel, SDF.side([[6.05, 0.3], [6.35, 0.3], [6.28, 1.0], [6.14, 1.0]], 0.14, 0.04), 0.06);
    sc.add(worn, SDF.lathe([[0.22, -7.0], [0.22, -7.6], [0.18, -7.65]], [0, 0.25, 0]), 0.02);
    for (let k = 0; k < 4; k++) sc.cut(SDF.box([0.6, 0.07, 0.38], 0.01, [0, 0.25, -7.35], [0, 0, (k * Math.PI) / 4]), 0.01, [worn]);
    sc.cut(SDF.cyl(0.1, 0.8, 'z', 0.01, [0, 0.25, -7.6]), 0.01, [worn]);
    // Buffer tube and collapsible stock, the yellow band and a rubber butt pad.
    sc.add(steel, SDF.cyl(0.22, 2.4, 'z', 0.05, [0, 0.2, 3.9]), 0.05);
    sc.add(poly, SDF.side([[-3.6, 0.5], [-6.0, 0.5], [-6.15, -1.45], [-5.7, -1.55], [-4.4, -0.35], [-3.6, -0.15]], 0.62, 0.12), 0.06);
    sc.add(hazard, SDF.box([0.66, 0.24, 0.45], 0.05, [0, 0.38, 4.95]), 0.02);
    sc.add(rubber, SDF.box([0.66, 2.0, 0.18], 0.06, [0, -0.5, 6.12]), 0.03);
    // The magazine: curved and ribbed, its own piece so it can drop out on a reload.
    sc.add(steel, SDF.side([[0.62, -0.55], [1.62, -0.55], [1.85, -1.7], [2.3, -2.95], [1.45, -3.1], [1.05, -1.8], [0.72, -0.9]], 0.5, 0.06), 0.04, 'mag');
    for (let k = 0; k < 4; k++) sc.cut(SDF.box([0.62, 0.06, 0.5], 0.02, [0, -1.25 - k * 0.42, -1.35 - k * 0.17], [0.35, 0, 0]), 0.01, [steel]);
    sc.uv(steel, 0.32).uv(worn, 0.3).uv(poly, 0.4);
    const sets = sc.build(g);
    g.userData.mag = LP.pivot(g, sets.mag, [0, -0.6, -1.1]);
    g.userData.magRest = [0, -0.6, -1.1];
    for (const x of [-0.39, 0.39]) for (const z of [-1.3, 1.4]) g.add(GUNTEX.screw(worn, x, -0.25, z, 0.06));
    const barrel = new THREE.Object3D();
    barrel.position.set(0, 0.25, -7.65);
    g.add(barrel);
    g.userData.barrel = barrel;
    return g;
  },

  // Liberty Rifle: pre-war service rifle. Walnut stock and handguards, parkerised steel, barrel bands, an aperture
  // rear sight and a brass en-bloc clip of eight showing in the open top of the receiver.
  libertyRifle() {
    const g = new THREE.Group();
    g.name = 'liberty';
    const M = GUNTEX.mats({ steel: '#3a3c3a', worn: '#5a5c58', wood: '#7a4a26' }), steel = M.steel, worn = M.worn, wood = M.wood;
    const brass = LP.mat('#c9a443', { metalness: 0.85, roughness: 0.3 });
    const sc = new Sculpt('liberty', 0.045);
    // Receiver, open on top where the clip sits; the operating rod down the right side.
    sc.add(steel, SDF.side([[1.3, -0.25], [-1.7, -0.25], [-1.75, 0.3], [-1.2, 0.5], [1.3, 0.5]], 0.68, 0.1), 0.05);
    sc.cut(SDF.box([0.32, 0.4, 1.4], 0.06, [0, 0.5, -0.1]), 0.04, [steel]);
    sc.add(worn, SDF.box([0.1, 0.14, 2.9], 0.04, [0.38, 0.06, -1.6]), 0.03);
    sc.add(worn, SDF.box([0.18, 0.2, 0.26], 0.05, [0.45, 0.1, 0.15]), 0.03);
    sc.add(steel, SDF.box([0.36, 0.45, 0.3], 0.07, [0, 0.62, 1.15]), 0.05); // rear aperture sight
    sc.cut(SDF.cyl(0.05, 0.6, 'z', 0.01, [0, 0.72, 1.15]), 0.01, [steel]);
    for (const x of [-0.24, 0.24]) sc.add(worn, SDF.cyl(0.1, 0.1, 'x', 0.03, [x, 0.55, 1.15]), 0.02);
    // The clip: eight rounds in two staggered rows, its own piece (it pings out when the last one goes).
    for (const x of [-0.065, 0.065]) sc.add(brass, SDF.cyl(0.075, 1.2, 'z', 0.03, [x, 0.42 + (x > 0 ? 0.04 : 0), -0.1]), 0.02, 'clip');
    sc.add(brass, SDF.box([0.32, 0.1, 0.14], 0.03, [0, 0.4, 0.5]), 0.02, 'clip');
    // Barrel, the gas cylinder under the muzzle, front sight with ears, bayonet lug.
    sc.add(steel, SDF.lathe([[0.2, -1.3], [0.17, -2.2], [0.15, -8.8]], [0, 0.15, 0]), 0.06);
    sc.add(steel, SDF.lathe([[0.22, -7.9], [0.24, -8.0], [0.24, -8.75], [0.2, -8.85]], [0, -0.1, 0]), 0.06);
    sc.add(steel, SDF.side([[8.45, 0.25], [8.72, 0.25], [8.66, 0.62], [8.52, 0.62]], 0.1, 0.03), 0.04);
    for (const x of [-0.13, 0.13]) sc.add(steel, SDF.box([0.06, 0.32, 0.3], 0.02, [x, 0.42, -8.6]), 0.04);
    sc.add(worn, SDF.box([0.16, 0.18, 0.4], 0.04, [0, -0.38, -8.5]), 0.03);
    // Stock: forend under the barrel, an upper handguard in two pieces either side of the barrel band, a pistol grip
    // swelling down from the wrist, and the buttstock with a steel butt plate.
    sc.add(wood, SDF.side([[1.4, 0.26], [7.55, 0.2], [7.7, -0.3], [1.3, -0.5]], 0.74, 0.18), 0.05);
    for (const [u0, u1] of [[1.6, 3.95], [4.65, 7.2]]) sc.add(wood, SDF.side([[u0, 0.12], [u1, 0.12], [u1 - 0.1, 0.4], [u0 + 0.1, 0.42]], 0.5, 0.14), 0.04);
    sc.add(wood, SDF.side(chaikin([[1.4, -0.25], [-0.9, -0.5], [-1.4, -0.7], [-1.95, -1.85], [-1.25, -2.0], [-0.95, -1.15], [-0.5, -0.75]], 1, 0.25).concat([[1.4, -0.25]]), 0.68, 0.2), 0.3);
    const stockPts = chaikin([[-1.6, 0.3], [-3.0, 0.22], [-6.4, -0.05], [-6.45, -1.9], [-5.8, -1.85], [-3.4, -1.0], [-2.1, -0.75], [-1.6, -0.35]], 2, 0.2);
    sc.add(wood, SDF.side(stockPts, 0.8, 0.18), 0.3);
    sc.add(steel, SDF.side([[-6.35, 0.0], [-6.58, 0.0], [-6.62, -1.92], [-6.4, -1.92]], 0.82, 0.05), 0.03);
    // Trigger guard and trigger; the barrel bands and sling swivels.
    sc.add(steel, SDF.path([[0, -0.4, -0.45], [0, -0.85, -0.25], [0, -0.9, 0.5], [0, -0.62, 0.85]], 0.06), 0.04);
    sc.add(worn, SDF.box([0.12, 0.36, 0.14], 0.05, [0, -0.6, 0.15], [0.2, 0, 0]), 0.03);
    for (const z of [-4.3, -7.35]) sc.add(worn, SDF.box([0.8, 0.86, 0.22], 0.1, [0, -0.04, z]), 0.03);
    sc.add(worn, SDF.torus(0.17, 0.045, [0, -0.62, -6.9], [0, Math.PI / 2, 0]), 0.03);
    sc.add(worn, SDF.torus(0.17, 0.045, [0, -1.7, 4.6], [0, Math.PI / 2, 0]), 0.03);
    sc.uv(steel, 0.3).uv(worn, 0.3).uv(wood, 0.22);
    const sets = sc.build(g);
    g.userData.clip = LP.pivot(g, sets.clip, [0, 0.42, -0.1]);
    const barrel = new THREE.Object3D();
    barrel.position.set(0, 0.15, -8.9);
    g.add(barrel);
    g.userData.barrel = barrel;
    return g;
  },

  // Typewriter: a pre-war drum gun. Blued receiver with an actuator knob, a finned barrel and slotted compensator,
  // walnut pistol grip, vertical foregrip and stock, and a fat fifty-round drum.
  typewriter() {
    const g = new THREE.Group();
    g.name = 'typewriter';
    const M = GUNTEX.mats({ steel: '#1f2124', worn: '#4b4e52', wood: '#5a3018' }), steel = M.steel, worn = M.worn, wood = M.wood;
    const sc = new Sculpt('typewriter', 0.04);
    sc.add(steel, SDF.side([[2.3, -0.3], [-2.7, -0.3], [-2.7, 0.4], [-2.3, 0.55], [2.3, 0.55]], 0.78, 0.14), 0.05);
    sc.cut(SDF.box([0.12, 0.2, 2.0], 0.04, [0, 0.56, 0.3]), 0.02, [steel]);
    sc.add(worn, SDF.cyl(0.16, 0.25, 'y', 0.06, [0, 0.66, 0.8]), 0.03);
    sc.add(steel, SDF.box([0.36, 0.34, 0.25], 0.06, [0, 0.7, 2.3]), 0.04);
    // Finned barrel and the Cutts compensator, slotted on top.
    const fins = [[0.3, -2.2]];
    for (let k = 0; k <= 18; k++) fins.push([k % 2 ? 0.24 : 0.32, -2.3 - k * 0.14]);
    fins.push([0.2, -4.95]);
    sc.add(steel, SDF.lathe(fins, [0, 0.1, 0]), 0.02);
    sc.add(steel, SDF.lathe([[0.16, -4.9], [0.16, -5.1]], [0, 0.1, 0]), 0.02);
    sc.add(worn, SDF.cyl(0.3, 0.55, 'z', 0.06, [0, 0.1, -5.35]), 0.03);
    for (const dz of [-0.15, 0.05, 0.25]) sc.cut(SDF.box([0.4, 0.4, 0.08], 0.02, [0, 0.36, -5.35 + dz]), 0.01, [worn]);
    sc.cut(SDF.cyl(0.11, 0.8, 'z', 0.01, [0, 0.1, -5.6]), 0.01, [worn]);
    sc.add(steel, SDF.box([0.08, 0.3, 0.14], 0.03, [0, 0.42, -4.95]), 0.03);
    // Trigger frame under the receiver, guard and trigger, and the walnut pistol grip behind them.
    sc.add(steel, SDF.side([[0.3, -0.2], [-1.6, -0.2], [-1.6, -0.65], [0.3, -0.65]], 0.66, 0.08), 0.05);
    sc.add(steel, SDF.path([[0, -0.6, -0.1], [0, -1.05, 0.0], [0, -1.08, 0.8], [0, -0.62, 1.1]], 0.06), 0.04);
    sc.add(worn, SDF.box([0.12, 0.38, 0.14], 0.05, [0, -0.82, 0.45], [0.2, 0, 0]), 0.03);
    sc.add(wood, SDF.side([[-0.95, -0.4], [-1.85, -0.4], [-2.35, -2.35], [-1.5, -2.45], [-1.15, -1.1]], 0.64, 0.18), 0.1);
    // Vertical foregrip with finger grooves down the front, on a steel mount.
    const fg = chaikin([[3.0, -0.2], [3.75, -0.2], [3.7, -0.9], [3.85, -1.1], [3.7, -1.35], [3.85, -1.55], [3.7, -1.8], [3.8, -2.05], [3.55, -2.3], [3.05, -2.3], [2.95, -1.0]], 1, 0.25);
    sc.add(wood, SDF.side(fg, 0.62, 0.16), 0.08);
    sc.add(steel, SDF.box([0.5, 0.2, 0.9], 0.05, [0, -0.22, -3.35]), 0.04);
    // Walnut stock and its steel butt plate.
    sc.add(wood, SDF.side(chaikin([[-2.6, 0.45], [-3.6, 0.35], [-6.3, 0.1], [-6.4, -1.75], [-5.8, -1.8], [-3.8, -0.75], [-2.6, -0.3]], 1, 0.2), 0.72, 0.16), 0.05);
    sc.add(steel, SDF.side([[-6.3, 0.1], [-6.5, 0.1], [-6.55, -1.8], [-6.35, -1.8]], 0.74, 0.05), 0.03);
    // The drum: rims, a hub, the winding key and a neck up into the frame. Its own piece for reloads.
    const D = [0, -1.6, -1.2];
    sc.add(steel, SDF.cyl(1.15, 0.6, 'x', 0.08, D), 0.03, 'mag');
    for (const x of [-0.31, 0.31]) sc.add(worn, SDF.torus(1.08, 0.05, [x, D[1], D[2]], [0, Math.PI / 2, 0]), 0.02, 'mag');
    sc.add(worn, SDF.cyl(0.26, 0.74, 'x', 0.06, D), 0.03, 'mag');
    sc.add(worn, SDF.box([0.1, 0.5, 0.12], 0.03, [-0.42, D[1], D[2]]), 0.02, 'mag');
    sc.add(steel, SDF.box([0.4, 0.5, 0.5], 0.06, [0, -0.62, -1.2]), 0.04, 'mag');
    sc.uv(steel, 0.32).uv(worn, 0.3).uv(wood, 0.22);
    const sets = sc.build(g);
    g.userData.mag = LP.pivot(g, sets.mag, D);
    g.userData.magRest = D;
    const barrel = new THREE.Object3D();
    barrel.position.set(0, 0.1, -5.65);
    g.add(barrel);
    g.userData.barrel = barrel;
    return g;
  },

  // Grinder LMG: belt-fed. A big receiver with a ribbed feed cover, carry handle, heavy barrel with a folded bipod,
  // and an olive canvas ammo box hanging underneath with the brass belt climbing into the feed tray.
  grinder() {
    const g = new THREE.Group();
    g.name = 'lmg';
    const M = GUNTEX.mats({ steel: '#232527', poly: '#2c2e2a' }), steel = M.steel, worn = M.worn, poly = M.poly;
    const olive = LP.mat('#4a4f2c', { roughness: 0.95 }), brass = LP.mat('#c9a443', { metalness: 0.85, roughness: 0.3 }), copper = LP.mat('#b06a3a', { metalness: 0.8, roughness: 0.35 });
    const rubber = LP.mat('#151515', { roughness: 0.9 });
    const sc = new Sculpt('lmg', 0.045);
    sc.add(steel, SDF.side([[2.9, -0.6], [-3.3, -0.6], [-3.3, 0.55], [2.9, 0.55]], 1.0, 0.1), 0.05);
    sc.add(steel, SDF.side([[2.4, 0.5], [-0.6, 0.5], [-0.8, 0.85], [2.2, 0.85]], 0.9, 0.08), 0.06); // feed cover
    for (let k = 0; k < 6; k++) sc.cut(SDF.box([1.0, 0.06, 0.08], 0.01, [0, 0.86, -1.9 + k * 0.35]), 0.01, [steel]);
    sc.add(worn, SDF.box([0.42, 0.12, 1.4], 0.03, [0, 0.9, 0.2]), 0.02); // optics rail at the back of the cover
    sc.add(worn, SDF.path([[0, 0.4, -3.75], [0, 1.15, -3.55], [0, 1.22, -2.65], [0, 0.6, -2.45]], 0.08), 0.04); // carry handle
    // Heavy barrel, flash hider, gas tube and block, front sight; the bipod folded under the barrel.
    sc.add(steel, SDF.lathe([[0.3, -2.8], [0.26, -3.2], [0.24, -8.8]], [0, 0.15, 0]), 0.05);
    sc.add(worn, SDF.lathe([[0.26, -8.8], [0.26, -9.5], [0.2, -9.55]], [0, 0.15, 0]), 0.02);
    for (let k = 0; k < 4; k++) sc.cut(SDF.box([0.7, 0.07, 0.4], 0.01, [0, 0.15, -9.25], [0, 0, (k * Math.PI) / 4]), 0.01, [worn]);
    sc.cut(SDF.cyl(0.11, 0.8, 'z', 0.01, [0, 0.15, -9.55]), 0.01, [worn]);
    sc.add(steel, SDF.cyl(0.13, 4.4, 'z', 0.04, [0, -0.2, -5.1]), 0.04);
    sc.add(steel, SDF.box([0.4, 0.62, 0.4], 0.08, [0, -0.02, -7.4]), 0.05);
    sc.add(steel, SDF.box([0.08, 0.5, 0.14], 0.03, [0, 0.5, -7.4]), 0.04);
    sc.add(worn, SDF.box([0.62, 0.22, 0.35], 0.06, [0, -0.3, -7.85]), 0.03);
    for (const x of [-0.2, 0.2]) {
      sc.add(worn, SDF.path([[x, -0.38, -7.8], [x, -0.48, -6.6], [x, -0.5, -5.4]], 0.065), 0.03);
      sc.add(rubber, SDF.box([0.16, 0.14, 0.3], 0.05, [x, -0.5, -5.3]), 0.03);
    }
    // Handguard under the barrel, vented.
    sc.add(poly, SDF.box([0.82, 0.72, 1.9], 0.2, [0, -0.05, -3.95]), 0.05);
    for (let k = 0; k < 3; k++) for (const x of [-0.41, 0.41]) sc.cut(SDF.box([0.14, 0.14, 0.4], 0.04, [x, -0.05, -3.35 - k * 0.6]), 0.02, [poly]);
    // Trigger group, guard, trigger and the pistol grip.
    sc.add(steel, SDF.side([[0.9, -0.55], [-1.2, -0.55], [-1.2, -0.8], [0.9, -0.8]], 0.7, 0.06), 0.05);
    sc.add(steel, SDF.path([[0, -0.75, -0.7], [0, -1.2, -0.6], [0, -1.25, 0.2], [0, -0.95, 0.55]], 0.06), 0.04);
    sc.add(worn, SDF.box([0.12, 0.4, 0.14], 0.05, [0, -1.0, -0.2], [0.2, 0, 0]), 0.03);
    sc.add(poly, SDF.side([[-0.55, -0.7], [-1.35, -0.7], [-1.95, -2.7], [-1.15, -2.8], [-0.85, -1.5]], 0.64, 0.15), 0.08);
    // Stock and butt pad.
    sc.add(poly, SDF.side([[-3.3, 0.5], [-6.6, 0.35], [-6.7, -1.55], [-6.2, -1.65], [-4.2, -0.55], [-3.3, -0.5]], 0.75, 0.14), 0.06);
    sc.add(rubber, SDF.box([0.78, 2.0, 0.18], 0.06, [0, -0.6, 6.72]), 0.03);
    // Ammo box (canvas, flap and snaps) and the belt rising out of it up the left side: one piece for reloads.
    const B = [0, -1.45, -1.85];
    sc.add(olive, SDF.box([0.95, 1.7, 1.8], 0.14, B), 0.03, 'mag');
    sc.add(olive, SDF.box([1.02, 0.36, 1.86], 0.12, [B[0], B[1] + 0.72, B[2]]), 0.05, 'mag');
    for (const z of [-0.5, 0.5]) sc.add(worn, SDF.cyl(0.08, 0.1, 'x', 0.02, [0.52, B[1] + 0.6, B[2] + z]), 0.01, 'mag');
    const belt = new THREE.CatmullRomCurve3([[-0.25, -0.62, -1.3], [-0.6, -0.3, -1.05], [-0.68, 0.15, -0.85], [-0.56, 0.48, -0.7]].map((p) => new THREE.Vector3(...p)));
    for (let k = 0; k < 9; k++) {
      const p = belt.getPointAt(k / 8);
      sc.add(brass, SDF.cyl(0.075, 0.5, 'z', 0.03, [p.x, p.y, p.z + 0.1]), 0.01, 'mag');
      sc.add(copper, SDF.cone([p.x, p.y, p.z - 0.15], [p.x, p.y, p.z - 0.32], 0.065, 0.015), 0.01, 'mag');
    }
    sc.uv(steel, 0.32).uv(worn, 0.3).uv(poly, 0.4).uv(olive, 0.5);
    const sets = sc.build(g);
    g.userData.mag = LP.pivot(g, sets.mag, B);
    g.userData.magRest = B;
    for (const x of [-0.5, 0.5]) for (const z of [-2.2, 2.2]) g.add(GUNTEX.screw(worn, x, -0.3, z, 0.07));
    const barrel = new THREE.Object3D();
    barrel.position.set(0, 0.15, -9.6);
    g.add(barrel);
    g.userData.barrel = barrel;
    return g;
  },

  // Widow MG: pre-war, air-cooled. A fat cooling jacket with a conical nose, a tall leaf rear sight, walnut grip and
  // stock, and the flat pan magazine on top, which turns a notch with every shot.
  panGun() {
    const g = new THREE.Group();
    g.name = 'pangun';
    const M = GUNTEX.mats({ steel: '#2a2b28', worn: '#585a55', wood: '#6a3c1e' }), steel = M.steel, worn = M.worn, wood = M.wood;
    const sc = new Sculpt('pangun', 0.045);
    sc.add(steel, SDF.side([[1.7, -0.45], [-2.5, -0.45], [-2.5, 0.45], [1.7, 0.45]], 0.82, 0.16), 0.05);
    sc.add(steel, SDF.lathe([[0.42, -1.6], [0.56, -1.75], [0.56, -6.9], [0.5, -7.0], [0.3, -7.9], [0.22, -8.1]], [0, 0.05, 0]), 0.04);
    for (const z of [-2.0, -4.3, -6.6]) sc.add(worn, SDF.torus(0.57, 0.05, [0, 0.05, z]), 0.02); // clamp bands
    sc.add(steel, SDF.lathe([[0.14, -8.0], [0.14, -8.6], [0.17, -8.65]], [0, 0.05, 0]), 0.02);
    sc.cut(SDF.cyl(0.08, 0.6, 'z', 0.01, [0, 0.05, -8.65]), 0.01, [steel]);
    sc.add(steel, SDF.box([0.08, 0.32, 0.12], 0.03, [0, 0.45, -7.35]), 0.03); // front sight
    sc.add(steel, SDF.side([[-1.6, 0.4], [-1.9, 0.4], [-1.85, 1.05], [-1.68, 1.05]], 0.18, 0.04), 0.04); // leaf rear sight
    sc.cut(SDF.cyl(0.05, 0.4, 'z', 0.01, [0, 0.92, 1.77]), 0.01, [steel]);
    sc.add(worn, SDF.box([0.14, 0.18, 0.3], 0.05, [0.48, 0.0, 0.3]), 0.03); // cocking handle
    // Bipod folded back under the jacket.
    for (const x of [-0.18, 0.18]) sc.add(worn, SDF.path([[x, -0.5, -6.8], [x, -0.62, -5.6], [x, -0.64, -4.6]], 0.06), 0.03);
    sc.add(worn, SDF.box([0.5, 0.18, 0.3], 0.05, [0, -0.52, -6.85]), 0.03);
    // Trigger housing, guard, trigger and walnut grip; the walnut stock and butt plate.
    sc.add(steel, SDF.side([[0.5, -0.35], [-1.4, -0.35], [-1.4, -0.65], [0.5, -0.65]], 0.66, 0.06), 0.05);
    sc.add(steel, SDF.path([[0, -0.6, -0.3], [0, -1.05, -0.2], [0, -1.1, 0.55], [0, -0.62, 0.9]], 0.06), 0.04);
    sc.add(worn, SDF.box([0.12, 0.38, 0.14], 0.05, [0, -0.85, 0.2], [0.2, 0, 0]), 0.03);
    sc.add(wood, SDF.side([[-0.75, -0.45], [-1.6, -0.45], [-2.1, -2.4], [-1.3, -2.5], [-1.0, -1.2]], 0.64, 0.18), 0.1);
    sc.add(wood, SDF.side(chaikin([[-2.5, 0.35], [-3.4, 0.25], [-5.9, 0.0], [-6.0, -1.6], [-5.4, -1.65], [-3.5, -0.7], [-2.5, -0.4]], 1, 0.2), 0.72, 0.16), 0.05);
    sc.add(steel, SDF.side([[-5.9, 0.0], [-6.1, 0.0], [-6.15, -1.65], [-5.95, -1.65]], 0.74, 0.05), 0.03);
    // The pan: a flat drum on a post, ribbed on top round a hub. Its own piece: it turns, and comes off to reload.
    const P = [0, 0.75, -0.55];
    sc.add(steel, SDF.cyl(0.2, 0.4, 'y', 0.04, [0, 0.5, -0.55]), 0.03);
    sc.add(steel, SDF.cyl(1.3, 0.3, 'y', 0.06, P), 0.02, 'mag');
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      sc.add(worn, SDF.box([0.95, 0.07, 0.1], 0.02, [P[0] + Math.cos(a) * 0.72, P[1] + 0.16, P[2] + Math.sin(a) * 0.72], [0, -a, 0]), 0.02, 'mag');
    }
    sc.add(worn, SDF.cyl(0.3, 0.42, 'y', 0.06, P), 0.03, 'mag');
    sc.add(worn, SDF.box([0.12, 0.1, 0.4], 0.03, [P[0], P[1] + 0.25, P[2]]), 0.02, 'mag');
    sc.uv(steel, 0.32).uv(worn, 0.3).uv(wood, 0.22);
    const sets = sc.build(g);
    g.userData.mag = LP.pivot(g, sets.mag, P);
    g.userData.magRest = P;
    g.userData.pan = g.userData.mag; // turned a notch per shot (see Cockpit3D)
    const barrel = new THREE.Object3D();
    barrel.position.set(0, 0.05, -8.7);
    g.add(barrel);
    g.userData.barrel = barrel;
    return g;
  },
});
