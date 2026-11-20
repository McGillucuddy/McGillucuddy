'use strict';
// Your ammo vest (a cosmetic, picked in the paint shop): something an inmate would make out of what the prison
// throws away, worn over the jumpsuit. The spare ammo you carry (WORN in js/combat.js) rides on straps sewn across
// its front, one strap per rack gun, and you see what's left when you look down.
// Built in the torso's own frame: +x out of the chest, +y up, +z to the side.

const VESTS = {
  canvas: { base: '#b5ad95', strap: '#6a634e', trim: '#4a3a26', mark: 'C9 LAUNDRY', ink: '#2a2a2a' },
  mattress: { base: '#d8d6cc', strap: '#2c3a5a', trim: '#2c3a5a', stripes: ['#e2e0d6', '#3a4e7a'], mark: 'BLOCK D', ink: '#8a1a12' },
  tube: { base: '#1e1e1f', strap: '#2c2c2d', trim: '#8a8f94', mark: 'NO RETREAD', ink: '#d8d2c0', rough: 0.55 },
  riot: { base: '#3a4658', strap: '#141a22', trim: '#c9a227', mark: 'CORRECTIONS', ink: '#c9a227', cross: true },
  hivis: { base: '#b8b33a', strap: '#5a5a30', trim: '#b8bcc0', mark: 'ROAD CREW', ink: '#1a1a1a', bands: true },
  jumpsuit: { base: '#4a5a7a', strap: '#3a2a1e', trim: '#2a2a2a', mark: 'DEATH ROW', ink: '#e8e2d0', patches: ['#d8742a', '#8a8a86', '#d8d2c0', '#2a3a2a'] }, // old uniforms cut up: denim, orange, grey, white
  tape: { base: '#8e9093', strap: '#6a6c6e', trim: '#3a3a3a', mark: 'FRAGILE', ink: '#a8221a', wraps: true },
  fence: { base: '#4a4a36', strap: '#3a3626', trim: '#9aa0a6', mark: 'KEEP OUT', ink: '#c9c2a8', mesh: true },
};

const Vest = {
  textures: {},
  // A cloth map: stripes of ticking, a chain-link diamond, or plain (with grime either way).
  tex(id) {
    if (this.textures[id]) return this.textures[id];
    const V = VESTS[id], c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = V.base; g.fillRect(0, 0, 64, 64);
    if (V.stripes) for (let x = 0; x < 64; x += 8) { g.fillStyle = V.stripes[1]; g.fillRect(x, 0, 3, 64); }
    if (V.mesh) {
      g.strokeStyle = '#8a9096'; g.lineWidth = 1.5;
      for (let k = -64; k < 128; k += 12) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.moveTo(k + 64, 0); g.lineTo(k, 64); g.stroke(); }
    }
    if (V.bands) for (const y of [16, 44]) { g.fillStyle = '#c8ccd0'; g.fillRect(0, y, 64, 7); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, y + 1, 64, 1); } // reflective bands
    if (V.wraps) for (let y = 0; y < 64; y += 10) { g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, y, 64, 1); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y + 9, 64, 1); }
    // grime: blotches and a few stains
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(30,24,16,${0.05 + Math.random() * 0.1})`; g.beginPath(); g.arc(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 5, 0, Math.PI * 2); g.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (this.textures[id] = t);
  },
  // The words sprayed or stencilled across the chest, and your number.
  mark(id, inmate) {
    const key = id + ':' + inmate;
    if (this.textures[key]) return this.textures[key];
    const V = VESTS[id], c = document.createElement('canvas');
    c.width = 128; c.height = 48;
    const g = c.getContext('2d');
    g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.fillStyle = V.ink;
    g.fillText(V.mark, 64, 20);
    g.font = 'bold 20px monospace'; g.fillText(String(inmate).slice(0, 6), 64, 42);
    if (V.cross) { g.strokeStyle = '#b01a12'; g.lineWidth = 4; g.beginPath(); g.moveTo(6, 16); g.lineTo(122, 8); g.stroke(); } // their word sprayed out
    // worn through in places
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.8})`; g.fillRect(Math.random() * 128, Math.random() * 48, 1 + Math.random() * 3, 1 + Math.random() * 2); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return (this.textures[key] = t);
  },

  // Across the back: your number big, the vest's words over it, sprayed through a card stencil.
  backMark(id, inmate) {
    const key = 'back:' + id + ':' + inmate;
    if (this.textures[key]) return this.textures[key];
    const V = VESTS[id], c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.textAlign = 'center'; g.fillStyle = V.ink;
    g.font = 'bold 24px monospace'; g.fillText(V.mark, 128, 30);
    g.font = 'bold 72px monospace'; g.fillText(String(inmate).slice(0, 6), 128, 104);
    if (V.cross) { g.strokeStyle = '#b01a12'; g.lineWidth = 7; g.beginPath(); g.moveTo(30, 28); g.lineTo(226, 14); g.stroke(); }
    g.fillStyle = V.ink; for (let k = 0; k < 14; k++) { const x = 40 + Math.random() * 176, y = 50 + Math.random() * 60; g.fillRect(x, y, 2, 6 + Math.random() * 14); } // runs of paint
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.8})`; g.fillRect(Math.random() * 256, Math.random() * 128, 1 + Math.random() * 4, 1 + Math.random() * 3); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return (this.textures[key] = t);
  },

  // Per gun: spacing and scale of what's tucked in the loops.
  ITEM: { pistol: [0.34, 0.5], smg: [0.4, 0.46], shotgun: [0.15, 0.55], rocket: [0.62, 0.32], flare: [0.3, 0.6], nailgun: [0.36, 0.5], flamer: [0.6, 0.42], harpoon: [0.42, 0.4],
    carbine: [0.4, 0.44], liberty: [0.3, 0.55], typewriter: [0.62, 0.26], lmg: [0.6, 0.3], pangun: [0.6, 0.26] },

  // How each vest is put together: padding (how far it stands off the jumpsuit), where the hem falls, and its
  // build: a solid shell, open down the front, cropped at the ribs, bands of rubber with gaps between, or plates.
  CUT: {
    canvas: { T: 0.2, hem: 1.0, round: true }, // baggy sack, long, a round rolled neck
    jumpsuit: { T: 0.14, hem: 1.3 }, // a sleeveless jacket
    mattress: { T: 0.32, hem: 1.3 }, // fat and puffy
    tube: { T: 0.18, bands: true }, // rubber strips wrapped round
    tape: { T: 0.12, hem: 2.15 }, // cropped at the ribs
    hivis: { T: 0.08, hem: 1.0, open: true }, // thin, long, open down the front
    fence: { T: 0.16, hem: 1.35 },
    riot: { T: 0.14, hem: 1.45, plates: true }, // a plate carrier
  },

  // The vest on a torso: style id, the rack (weapon objects, for what's in the loops), your inmate number and the
  // torso's width (People.BUILD). userData.rows: per rack gun, the items in its loops (for showing what's left).
  // Every vest starts from the torso's own shape (ribcage, chest, belly; see People.figure) let out a little, so
  // it sits on the body; then each is built its own way (CUT, and the makes below).
  build(id, rack, inmate, w) {
    id = VESTS[id] ? id : 'canvas';
    w = w || 1;
    const V = VESTS[id], K = this.CUT[id], G = new THREE.Group(), heavy = w > 1.1, rnd = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
    const clothMat = () => LP.mat('#ffffff', { map: this.tex(id), roughness: V.rough || 0.95 }), cloth = clothMat();
    const strapMat = () => LP.mat(V.strap, { roughness: 0.95 }), strap = strapMat();
    const metal = V.trim === '#8a8f94' || V.trim === '#9aa0a6' || V.trim === '#b8bcc0';
    const trim = LP.mat(V.trim, { metalness: metal ? 0.6 : 0, roughness: 0.6 }), steel = LP.mat('#8a8e92', { metalness: 0.7, roughness: 0.4 });
    const rows = rack.length, top = 3.2, step = Math.min(0.52, 1.6 / Math.max(1, rows - 1 || 1)), T = K.T, HEM = K.hem || 1.3;
    // The torso's shapes, let out by t: [radii, centre].
    const body = (t) => [
      [[1.02 + t, 1.3 + t, 1.62 * w + t], [0.06, 3.42, 0]], // ribcage
      [[0.95 + (heavy ? 0.2 : 0) + t, 1.0 + t, 1.25 * w + t], [0.12 + (heavy ? 0.12 : 0), 2.0, 0]], // belly
      [[0.45 + t, 0.42 + t, 0.62 * w + t], [0.55, 3.8, -0.6 * w]], [[0.45 + t, 0.42 + t, 0.62 * w + t], [0.55, 3.8, 0.6 * w]], // chest
    ];
    // How far out the front is at height y and side z (for putting things on it), and the angle it faces there.
    const surf = (y, z, t) => {
      let x = -9;
      for (const [[a, b, c], [px, py, pz]] of body(t)) { const k = 1 - ((y - py) / b) ** 2 - ((z - pz) / c) ** 2; if (k > 0) x = Math.max(x, px + a * Math.sqrt(k)); }
      return x;
    };
    const facing = (y, z, t) => Math.atan2(1, -(surf(y, z + 0.05, t) - surf(y, z - 0.05, t)) / 0.1); // rotation.y that turns +z out of the surface
    const on = (y, z, t, out) => [surf(y, z, t) + (out || 0), y, z]; // a point on the surface
    const turn = (y, z, t, roll) => [0, facing(y, z, t) - Math.PI / 2, roll || 0]; // turns local x out of the surface there
    const s = new Sculpt(`vest4:${id}:${rows}:${w}`, 0.06), collar = []; // (collar pieces: hidden in your own view, they'd sit under your chin)
    const collarMat = (m) => { collar.push(m); return m; };
    // A band round the body at height y, h tall (its own material, so it can be trimmed to its own height).
    const band = (mat, y, h, t, k) => {
      for (const [r, c] of body(t)) s.add(mat, SDF.ellipsoid(r, c), k == null ? 0.3 : k);
      s.cut(SDF.box([5, 3, 5], 0.02, [0, y + h / 2 + 1.5, 0]), 0.02, [mat]);
      s.cut(SDF.box([5, 3, 5], 0.02, [0, y - h / 2 - 1.5, 0]), 0.02, [mat]);
    };
    // A strip laid along the surface from (y0, z0) to (y1, z1): tape, a placket, a lapel.
    const strip = (mat, y0, z0, y1, z1, wd, t, n) => {
      for (let k = 0; k <= n; k++) {
        const f = k / n, y = y0 + (y1 - y0) * f, z = z0 + (z1 - z0) * f;
        s.add(mat, SDF.box([0.07, wd, 0.34], 0.03, on(y, z, t, 0.01), [Math.atan2(z1 - z0, y1 - y0), facing(y, z, t) - Math.PI / 2, 0]), 0.05);
      }
    };

    // ---- The shell ----
    if (K.bands) { // strips of inner tube wrapped round, the jumpsuit showing between
      for (const [k, y] of [1.55, 2.08, 2.61, 3.14, 3.67, 4.12].entries()) band(clothMat(), y, k === 5 ? 0.36 : 0.44, T + (k % 2) * 0.03, 0.25);
    } else {
      for (const [r, c] of body(T)) s.add(cloth, SDF.ellipsoid(r, c), 0.45);
      s.cut(SDF.box([4, 2, 5], 0.05, [0, HEM - 1, 0]), 0.1, [cloth]); // the hem
      s.cut(SDF.box([4, 2, 5], 0.05, [0, 5.75, 0]), 0.1, [cloth]); // over the shoulders, only the straps
      if (K.round) s.cut(SDF.ellipsoid([0.95, 0.62, 0.82 * w], [0.45, 4.8, 0]), 0.12, [cloth]); // a round neck
      else s.cut(SDF.ellipsoid([0.95, 1.25, 0.72 * w], [1.2, 4.75, 0]), 0.12, [cloth]); // the V at the neck, deep enough to see your loops past
      s.cut(SDF.ellipsoid([1.0, 0.45, 0.72 * w], [-0.1, 4.75, 0]), 0.12, [cloth]); // round the back of the neck
      for (const z of [-1, 1]) s.cut(SDF.ellipsoid([0.95, 1.05, 0.55], [0.0, 4.1, z * 1.9 * w]), 0.15, [cloth]); // armholes
      if (K.open) s.cut(SDF.box([1.6, 3.6, 0.42 * w], 0.08, [1.0, HEM + 1.6, 0]), 0.05, [cloth]); // open down the front
    }
    for (const z of [-1, 1]) s.add(strap, SDF.path([[surf(4.2, z * 1.0 * w, T) - 0.05, 4.2, z * 1.0 * w], [0.75, 4.78, z * 1.02 * w], [0.1, 5.02, z * 1.05 * w], [-0.6, 4.8, z * 1.02 * w], [-0.95, 4.2, z * 1.0 * w]], 0.17), 0.08); // shoulder straps, over the top and down the back

    // ---- Each one's own make ----
    let face = null; // a flat face the ammo rides on instead of belts round the body (the riot vest's plate)
    if (id === 'canvas') { // a laundry sack: rolled neck, drawstring hem with toggles, a big pocket, rope ties
      s.add(collarMat(clothMat()), SDF.torus(0.78 * w, 0.15, [0.42, 4.5, 0], [Math.PI / 2 + 0.25, 0, 0]), 0.1); // the neck, rolled over
      band(LP.mat(V.trim, { roughness: 0.8 }), HEM + 0.1, 0.12, T + 0.03, 0.2); // drawstring in the hem
      for (const z of [-0.18, 0.18]) s.add(trim, SDF.path([on(HEM + 0.1, z, T, 0.02), on(HEM - 0.2, z * 1.6, T, 0.05), on(HEM - 0.45, z * 1.3, T, 0.06)], 0.04), 0.02); // its two ends
      for (const z of [-0.18, 0.18]) s.add(steel, SDF.cyl(0.07, 0.16, 'y', 0.03, on(HEM - 0.45, z * 1.3, T, 0.06)), 0.02); // toggles
      s.add(clothMat(), SDF.box([0.12, 0.6, 1.5 * w], 0.08, on(1.52, 0, T, -0.02), turn(1.52, 0, T)), 0.06); // the pocket
      for (const z of [-1, 1]) s.add(trim, SDF.path([[0.55, 2.2, z * 1.48 * w], [0.1, 2.0, z * 1.58 * w], [-0.35, 2.2, z * 1.48 * w]], 0.06), 0.02); // rope ties at the sides
    }
    if (id === 'jumpsuit') { // a jacket cut from old jumpsuits: lapels, a button placket, the stubs of sleeves, patches
      strip(strap, HEM + 0.05, 0, 3.45, 0, 0.26, T, 8); // placket
      for (let y = HEM + 0.3; y < 3.4; y += 0.45) s.add(steel, SDF.ellipsoid([0.06, 0.08, 0.08], on(y, 0, T, 0.06)), 0.01); // buttons
      const lapel = collarMat(clothMat());
      for (const z of [-1, 1]) s.add(lapel, SDF.cone(on(3.5, z * 0.12, T, 0.04), [0.85, 4.55, z * 0.62 * w], 0.12, 0.16), 0.08); // lapels up the V
      const sleeve = clothMat();
      for (const z of [-1, 1]) s.add(sleeve, SDF.ellipsoid([0.66, 0.5, 0.42], [0.0, 4.15, z * 1.82 * w]), 0.15); // cap sleeves over the shoulders
      for (const z of [-1, 1]) s.cut(SDF.ellipsoid([0.55, 0.6, 0.6], [0.0, 3.85, z * 2.0 * w]), 0.05, [sleeve]); // open underneath, the arm through
      V.patches.forEach((col, k) => { const y = 1.75 + k * 0.5, z = (k % 2 ? -0.75 : 0.8) * w; s.add(LP.mat(col, { roughness: 0.95 }), SDF.ellipsoid([0.08, 0.3 + (k % 2) * 0.1, 0.32], on(y, z, T, -0.02), turn(y, z, T, 0.1 * (k - 1.5))), 0.03); });
    }
    if (id === 'mattress') { // fat quilting, a padded roll round the neck, stuffing coming out of a split
      for (const y of [1.85, 2.45, 3.05, 3.65]) s.cut(SDF.box([3.2, 0.1, 4.5 * w], 0.03, [0.08, y, 0]), 0.05, [cloth]);
      for (const z of [-0.55, 0.55]) s.cut(SDF.box([1.6, 3.2, 0.1], 0.03, [1.2, 2.7, z * w]), 0.05, [cloth]); // channels both ways
      s.add(collarMat(clothMat()), SDF.torus(0.86 * w, 0.26, [0.3, 4.62, 0], [Math.PI / 2 + 0.15, 0, 0]), 0.15); // the collar roll
      const ty = 2.2, tz = -1.0 * w, stuff = LP.mat('#e8e2d0', { roughness: 1 });
      s.cut(SDF.ellipsoid([0.35, 0.22, 0.3], on(ty, tz, T, 0)), 0.05, [cloth]); // a split
      for (let k = 0; k < 4; k++) s.add(stuff, SDF.ellipsoid([0.16, 0.13, 0.15], on(ty + (rnd() - 0.5) * 0.25, tz + (rnd() - 0.5) * 0.3, T, -0.05 + rnd() * 0.12)), 0.08); // stuffing
    }
    if (id === 'tube') { // bolted where the strips meet, a patch or two, and a valve stem still on
      for (const z of [-0.9, 0.9]) for (const y of [1.55, 2.08, 2.61, 3.14, 3.67]) s.add(trim, SDF.ellipsoid([0.08, 0.08, 0.08], on(y, z * w, T, 0.02)), 0.01);
      for (const [y, z] of [[2.08, 0.4], [3.14, -0.5]]) s.add(LP.mat('#7a2a1e', { roughness: 0.6 }), SDF.ellipsoid([0.06, 0.18, 0.24], on(y, z * w, T, 0.02), turn(y, z * w, T)), 0.02);
      s.add(steel, SDF.cone(on(2.61, 0.55 * w, T, 0.02), on(2.71, 0.55 * w, T, 0.32), 0.06, 0.045), 0.02); // valve stem
    }
    if (id === 'tape') { // cropped, a cross of tape over the chest, loose ends hanging
      const tape = LP.mat('#9a9c9e', { metalness: 0.35, roughness: 0.45 });
      strip(tape, 4.3, -1.15 * w, 3.45, 0.95 * w, 0.3, T, 10); // an X over the top of the chest
      strip(tape, 4.3, 1.15 * w, 3.45, -0.95 * w, 0.3, T + 0.03, 10);
      for (const y of [2.35, 2.75]) band(LP.mat('#9a9c9e', { metalness: 0.35, roughness: 0.45 }), y, 0.26, T + 0.02, 0.2); // wound round and round below it
      for (const z of [-0.6, 0.35]) s.add(tape, SDF.box([0.05, 0.62, 0.28], 0.02, on(HEM - 0.25, z * w, T, -0.04), turn(HEM, z * w, T, z * 0.4)), 0.02); // loose ends
    }
    if (id === 'hivis') { // open-fronted, a badge clipped on, and a length of chain from the hem
      for (const z of [-1, 1]) strip(trim, HEM + 0.05, z * 0.25 * w, 3.5, z * 0.3 * w, 0.12, T, 8); // the edges either side of the opening
      s.add(LP.mat('#e8e6dc', { roughness: 0.4 }), SDF.box([0.05, 0.44, 0.32], 0.03, on(3.85, -0.72 * w, T, 0.04), turn(3.85, -0.72 * w, T)), 0.02); // ID badge
      for (let k = 0; k < 6; k++) { const p = on(HEM + 0.05, 1.05 * w, T, 0.06); p[1] -= k * 0.17; p[0] += Math.sin(k * 0.8) * 0.05; s.add(steel, SDF.torus(0.09, 0.03, p, [0, k % 2 ? Math.PI / 2 : 0, 0]), 0.01); } // chain
    }
    if (id === 'fence') { // tin plates wired over the front, cut-off wire bristling at the shoulders
      const tins = [LP.mat('#b4b6b0', { metalness: 0.7, roughness: 0.4 }), LP.mat('#8a4e2c', { metalness: 0.3, roughness: 0.8 })]; // galvanised and rusted
      for (const [k, [y, z]] of [[3.8, -0.62], [3.8, 0.62], [1.7, -0.7], [1.7, 0.1], [1.75, 0.85], [3.0, -1.2], [3.0, 1.2]].entries()) {
        const zz = z * w, tin = tins[k % 2];
        s.add(tin, SDF.box([0.07, 0.62, 0.78], 0.03, on(y, zz, T, 0.04), turn(y, zz, T, (rnd() - 0.5) * 0.25)), 0.02);
        for (const dy of [-0.18, 0, 0.18]) s.add(tin, SDF.box([0.05, 0.05, 0.72], 0.02, on(y + dy, zz, T, 0.09), turn(y, zz, T)), 0.01); // corrugated
        for (const dz of [-0.32, 0.32]) s.add(steel, SDF.torus(0.06, 0.02, on(y + 0.27, zz + dz, T, 0.08), turn(y, zz, T)), 0.01); // wired on
      }
      for (const z of [-1, 1]) for (let k = 0; k < 4; k++) { const b = [0.5 - k * 0.3, 4.75 + Math.sin(k) * 0.12, z * (0.95 + rnd() * 0.2) * w]; s.add(steel, SDF.cone(b, [b[0] + (rnd() - 0.5) * 0.3, b[1] + 0.35 + rnd() * 0.2, b[2] + z * 0.15], 0.03, 0.01), 0.005); }
    }
    if (id === 'riot') { // a plate carrier: plates front and back, a cummerbund, shoulder pads, a neck guard
      const plate = strapMat(), px = surf(2.9, 0, T) + 0.08, bx = -(1.02 + T) + 0.06 - 0.1;
      s.add(plate, SDF.box([0.32, 2.15, 2.25 * w], 0.2, [px, 2.9, 0]), 0.1);
      s.add(plate, SDF.box([0.3, 2.3, 2.3 * w], 0.2, [bx, 3.0, 0]), 0.1);
      band(strapMat(), 2.05, 1.0, T + 0.06, 0.2); // cummerbund
      for (const z of [-1, 1]) s.add(plate, SDF.ellipsoid([0.62, 0.2, 0.55], [0.05, 4.98, z * 1.2 * w]), 0.08); // shoulder pads
      const neck = collarMat(strapMat());
      s.add(neck, SDF.torus(0.82 * w, 0.17, [-0.05, 4.85, 0], [Math.PI / 2 - 0.2, 0, 0]), 0.08);
      s.cut(SDF.box([2, 1.4, 3], 0.05, [1.15, 4.85, 0]), 0.05, [neck]); // open at the front
      face = px + 0.16;
    }

    // ---- The ammo: each vest carries it its own way ----
    // loops: a stitched strip of loops; pocket: tall sack-cloth pockets; tape: each one taped straight on; tube:
    // tucked under a rubber strap; sash: crossed bandoliers; hook: hung on wire hooks through the mesh; pouch:
    // pouches on the plate.
    const carry = { canvas: 'pocket', tape: 'tape', tube: 'tube', hivis: 'sash', fence: 'hook', riot: 'pouch' }[id] || 'loops';
    const AT = T + (id === 'mattress' ? 0.06 : 0.1), place = [];
    const tapeMat = LP.mat('#9a9c9e', { metalness: 0.35, roughness: 0.45 }), rubber = LP.mat('#1a1a1b', { roughness: 0.55 });
    for (let r = 0; r < rows; r++) {
      const wpn = rack[r], n = (WORN.loads[wpn.id] || 2), [gap0, sc] = this.ITEM[wpn.id] || [0.4, 0.45];
      const y = top - r * step - 0.14, items = [];
      if (carry === 'sash' && r < 2) { // a bandolier from one shoulder to the other hip, the second crossing it
        const sd = r ? -1 : 1, y0 = 4.25, z0 = -1.1 * w * sd, y1 = 1.5, z1 = 1.05 * w * sd;
        strip(strapMat(), y0, z0, y1, z1, 0.36, AT - 0.04 + r * 0.04, 14);
        const roll = -Math.atan2(y1 - y0, z1 - z0) * (sd > 0 ? 1 : -1) - (sd > 0 ? 0 : Math.PI);
        for (let k = 0; k < n; k++) { const f = 0.12 + (0.76 * (k + 0.5)) / n, yy = y0 + (y1 - y0) * f, zz = z0 + (z1 - z0) * f; items.push({ y: yy, z: zz, t: AT + r * 0.04, roll, sc }); }
        place.push(items);
        continue;
      }
      const sashBelt = carry === 'sash'; // a third gun on the hi-vis: a belt round the waist
      const yy = sashBelt ? 1.45 : y, gap = Math.min(gap0, (face != null ? 1.8 : 2.1) * w / Math.max(1, n - 1));
      for (let k = 0; k < n; k++) items.push({ y: yy + 0.19, z: -((n - 1) * gap) / 2 + k * gap, t: AT, roll: 0, sc });
      if (carry === 'loops' || sashBelt) {
        for (let z = -1.0 * w; z <= 1.0 * w + 1e-6; z += 0.2 * w) if (!K.open || sashBelt || Math.abs(z) > 0.3 * w) s.add(strap, SDF.box([0.12, 0.34, 0.3], 0.04, on(yy, z, AT, -0.04), turn(yy, z, AT)), 0.06);
        for (const z of [-1.05 * w, 1.05 * w]) s.add(trim, SDF.box([0.1, 0.24, 0.12], 0.02, on(yy, z, AT, -0.01), turn(yy, z, AT)), 0.01); // stitched ends
      } else if (carry === 'pocket') { // a row of sack-cloth pockets, the tops of the mags showing
        const pk = clothMat();
        for (const it of items) { s.add(pk, SDF.box([0.16, 0.5, gap * 0.92], 0.06, on(yy + 0.05, it.z, AT, 0.04), turn(yy + 0.05, it.z, AT)), 0.04); s.add(trim, SDF.box([0.04, 0.03, gap * 0.8], 0.01, on(yy + 0.29, it.z, AT, 0.13), turn(yy, it.z, AT)), 0.005); }
      } else if (carry === 'tape') { // taped straight on, any old how
        for (const it of items) { it.roll = (rnd() - 0.5) * 0.5; it.t = AT - 0.06; s.add(tapeMat, SDF.box([0.05, 0.16, Math.max(0.42, sc * 0.9)], 0.02, on(it.y, it.z, it.t, 0.14), turn(it.y, it.z, it.t, it.roll * 0.6)), 0.01); }
      } else if (carry === 'tube') { // tucked under a strip of rubber nailed across
        for (const it of items) it.t = AT - 0.06;
        for (let z = -1.05 * w; z <= 1.05 * w + 1e-6; z += 0.21 * w) s.add(rubber, SDF.box([0.07, 0.18, 0.3], 0.03, on(yy + 0.12, z, AT, 0.1), turn(yy + 0.12, z, AT)), 0.05);
      } else if (carry === 'hook') { // hung through the mesh on bent wire
        for (const it of items) { it.y -= 0.08; it.roll = (rnd() - 0.5) * 0.3; s.add(steel, SDF.torus(0.09, 0.025, on(it.y + 0.42, it.z, AT, 0.02), [Math.PI / 2, facing(it.y, it.z, AT), 0]), 0.01); }
      } else if (carry === 'pouch') { // a pouch each on the plate, flaps tucked back
        for (const it of items) { it.face = true; s.add(strap, SDF.box([0.26, 0.46, gap * 0.86], 0.06, [face + 0.12, yy, it.z]), 0.04); s.add(strap, SDF.box([0.05, 0.22, gap * 0.8], 0.02, [face + 0.02, yy + 0.36, it.z]), 0.02); }
      }
      place.push(items);
    }
    s.build(G);
    G.traverse((o) => { if (o.isMesh && collar.includes(o.material)) o.userData.collar = true; });
    // The words: small on the chest, big across the back.
    const ym = top + 0.55, zm = 0.72 * w;
    const m = LP.mesh(new THREE.PlaneGeometry(1.5, 0.56), LP.mat('#ffffff', { map: this.mark(id, inmate || '4471'), transparent: true, roughness: 0.9 }), face != null ? face + 0.01 : surf(ym, zm, T) + 0.03, face != null ? 3.75 : ym, face != null ? 0 : zm);
    m.rotation.y = face != null ? Math.PI / 2 : facing(ym, zm, T);
    m.scale.setScalar(0.85);
    G.add(m);
    const back = (y, z, t) => { let x = 9; for (const [[a, b, c], [px, py, pz]] of body(t)) { const k = 1 - ((y - py) / b) ** 2 - ((z - pz) / c) ** 2; if (k > 0) x = Math.min(x, px - a * Math.sqrt(k)); } return x; };
    const by = 3.15, bxp = id === 'riot' ? -(1.02 + T) + 0.06 - 0.1 - 0.16 : back(by, 0, T + (K.bands ? 0.03 : 0)) - 0.04;
    const bm = LP.mesh(new THREE.PlaneGeometry(2.6, 1.3), LP.mat('#ffffff', { map: this.backMark(id, inmate || '4471'), transparent: true, roughness: 0.9 }), bxp, by, 0);
    bm.rotation.y = -Math.PI / 2;
    G.add(bm);
    // What's in the loops (and pockets, tape, straps, hooks, pouches).
    G.userData.rows = place.map((items, r) => items.map((p0, k) => {
      const it = Models.ammoItem(rack[r].id, k);
      if (p0.face) { it.position.set(face + 0.2, p0.y + 0.08, p0.z); it.rotation.y = Math.PI / 2; }
      else { it.position.set(surf(p0.y, p0.z, p0.t) + 0.1, p0.y, p0.z); it.rotation.set(0, facing(p0.y, p0.z, p0.t), 0); if (p0.roll) it.rotateZ(p0.roll); } // its face out from the chest
      it.scale.setScalar(p0.sc * 1.2);
      G.add(it);
      return it;
    }));
    return G;
  },
};
