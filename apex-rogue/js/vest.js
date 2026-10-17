'use strict';
// Your ammo vest (a cosmetic, picked in the paint shop): something an inmate would make out of what the prison
// throws away, worn over the jumpsuit. The spare ammo you carry (WORN in js/combat.js) rides on straps sewn across
// its front, one strap per rack gun, and you see what's left when you look down.
// Built in the torso's own frame: +x out of the chest, +y up, +z to the side.

const VESTS = {
  canvas: { base: '#b5ad95', strap: '#6a634e', trim: '#4a3a26', mark: 'C9 LAUNDRY', ink: '#2a2a2a' },
  mattress: { base: '#d8d6cc', strap: '#2c3a5a', trim: '#2c3a5a', stripes: ['#e2e0d6', '#3a4e7a'], mark: 'BLOCK D', ink: '#1a2238' },
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

  // Per gun: spacing and scale of what's tucked in the loops.
  ITEM: { pistol: [0.34, 0.5], smg: [0.4, 0.46], shotgun: [0.15, 0.55], rocket: [0.62, 0.32], flare: [0.3, 0.6], nailgun: [0.36, 0.5], flamer: [0.6, 0.42], harpoon: [0.42, 0.4],
    carbine: [0.4, 0.44], liberty: [0.3, 0.55], typewriter: [0.62, 0.26], lmg: [0.6, 0.3], pangun: [0.6, 0.26] },

  // The vest on a torso: style id, the rack (weapon objects, for what's in the loops), your inmate number and the
  // torso's width (People.BUILD). userData.rows: per rack gun, the items in its loops (for showing what's left).
  build(id, rack, inmate, w) {
    id = VESTS[id] ? id : 'canvas';
    w = w || 1;
    const V = VESTS[id], G = new THREE.Group();
    const cloth = LP.mat('#ffffff', { map: this.tex(id), roughness: V.rough || 0.95 }), strap = LP.mat(V.strap, { roughness: 0.95 });
    const trim = LP.mat(V.trim, { metalness: V.trim === '#8a8f94' || V.trim === '#9aa0a6' || V.trim === '#b8bcc0' ? 0.6 : 0, roughness: 0.6 });
    const rows = rack.length, top = 3.3, step = Math.min(0.62, 2.1 / Math.max(1, rows - 1 || 1));
    const s = new Sculpt(`vest:${id}:${rows}:${w}`, 0.06);
    // The shell: over the chest and belly, open at the neck and arms, cut off above the hips.
    // A padded slab, square at the hem and the shoulders, a V cut at the neck and holes for the arms.
    s.add(cloth, SDF.box([2.5, 3.3, 3.62 * w], 0.5, [0.08, 2.88, 0]), 0.2);
    s.cut(SDF.ellipsoid([1.3, 1.45, 0.95 * w], [1.25, 4.7, 0]), 0.12, [cloth]); // the V at the neck, deep enough to see your loops past
    s.cut(SDF.ellipsoid([1.2, 0.5, 0.75 * w], [-0.1, 4.75, 0]), 0.12, [cloth]); // round the back of the neck
    for (const z of [-1, 1]) s.cut(SDF.ellipsoid([0.85, 0.95, 0.5], [0.0, 4.15, z * 1.92 * w]), 0.15, [cloth]); // armholes
    for (const z of [-1, 1]) s.add(strap, SDF.path([[1.05, 4.1, z * 1.0 * w], [0.75, 4.75, z * 1.02 * w], [0.1, 5.02, z * 1.05 * w], [-0.6, 4.8, z * 1.02 * w], [-0.95, 4.1, z * 1.0 * w]], 0.19), 0.08); // shoulder straps, over the top and down the back
    // Each style's own make.
    if (V.patches) V.patches.forEach((col, k) => s.add(LP.mat(col, { roughness: 0.95 }), SDF.box([0.1, 0.5 + (k % 2) * 0.2, 0.55], 0.06, [1.33 + (k % 2) * 0.03, 1.7 + k * 0.5, (k % 2 ? -0.95 : 1.0) * w], [0, 0, 0.1 * (k - 1.5)]), 0.03));
    if (id === 'tube') for (const z of [-0.9, 0.9]) for (const y of [2.0, 2.8, 3.6]) s.add(trim, SDF.cyl(0.07, 0.08, 'x', 0.02, [1.33, y, z * 1.3 * w]), 0.01); // bolts through the rubber
    if (id === 'riot') s.add(strap, SDF.box([0.25, 2.0, 2.6 * w], 0.15, [1.3, 2.75, 0]), 0.1); // the plate pocket
    if (id === 'canvas') for (const z of [-1, 1]) s.add(trim, SDF.path([[0.6, 2.2, z * 1.82 * w], [0.1, 2.0, z * 1.9 * w], [-0.4, 2.2, z * 1.82 * w]], 0.06), 0.02); // rope ties at the sides
    if (id === 'mattress') for (const y of [2.0, 2.7, 3.4]) s.cut(SDF.box([2.7, 0.06, 3.8 * w], 0.02, [0.08, y, 0]), 0.03, [cloth]); // quilted
    // The ammo straps across the front.
    for (let r = 0; r < rows; r++) {
      const y = top - r * step;
      s.add(strap, SDF.box([0.3, 0.34, 2.5], 0.06, [1.38, y - 0.14, 0]), 0.03);
      s.add(trim, SDF.box([0.08, 0.2, 0.14], 0.02, [1.55, y - 0.14, 1.3]), 0.01); // buckle
    }
    s.build(G);
    // The words on the chest, above the straps.
    const m = LP.mesh(new THREE.PlaneGeometry(1.5, 0.56), LP.mat('#ffffff', { map: this.mark(id, inmate || '4471'), transparent: true, roughness: 0.9 }), 1.35, top + 0.62, 0.85 * w);
    m.rotation.y = Math.PI / 2;
    m.scale.setScalar(0.75);
    G.add(m);
    // What's in the loops.
    G.userData.rows = rack.map((wpn, r) => {
      const n = (WORN.loads[wpn.id] || 2), [gap0, sc] = this.ITEM[wpn.id] || [0.4, 0.45], y = top - r * step;
      const gap = Math.min(gap0, 2.1 / Math.max(1, n - 1)), items = [];
      for (let k = 0; k < n; k++) {
        const it = Models.ammoItem(wpn.id, k);
        it.position.set(1.55, y + 0.05, -((n - 1) * gap) / 2 + k * gap);
        it.rotation.y = Math.PI / 2; // its face out from the chest
        it.scale.setScalar(sc * 1.2);
        G.add(it);
        items.push(it);
      }
      return items;
    });
    return G;
  },
};
