'use strict';
// Low-poly model library (Three.js). Flat-shaded, chamfered, few segments.
// World units: a car is 36 long (~4.5m, so 1 unit ~ 12.5cm).
// Car-local axes: +X forward, +Y up, +Z right. Hand-held items point down -Z.

// Eye position in the passenger seat (the driver's seat is empty).
const EYE = { x: -2.6, y: 9.8, z: 4.2 };

const LP = {
  mat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.8, metalness: 0.05 }, opts));
  },
  glow(color, intensity) {
    return LP.mat(color, { emissive: color, emissiveIntensity: intensity == null ? 0.8 : intensity });
  },
  mesh(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  },
  box(w, h, d, mat, x, y, z) {
    return LP.mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  },
  // Side profile (x forward, y up) extruded across the width, with a one-step chamfer.
  side(points, width, mat, bevel) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const b = bevel == null ? 0.5 : bevel;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.01, width - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b,
      bevelSegments: 1, curveSegments: 1,
    });
    geo.translate(0, 0, -(width - 2 * b) / 2);
    return new THREE.Mesh(geo, mat);
  },
  // Same, but for hand-held items: profile u = forward, v = up; result points down -Z.
  sideZ(points, width, mat, bevel) {
    const m = LP.side(points, width, mat, bevel);
    m.geometry.rotateY(Math.PI / 2);
    return m;
  },
  // A box stretched between two points (pillars, struts).
  beam(a, b, thick, mat) {
    const va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
    const m = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, va.distanceTo(vb)), mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.lookAt(vb);
    return m;
  },
  cyl(rTop, rBot, h, seg, mat, x, y, z) {
    return LP.mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat, x, y, z);
  },
  // Deterministic vertex jitter for organic shapes (rocks, foliage).
  jitter(geo, amount, seed) {
    const rng = mulberry32(seed || 7);
    const pos = geo.attributes.position;
    const seen = new Map();
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      if (!seen.has(key)) seen.set(key, [(rng() - 0.5) * amount, (rng() - 0.5) * amount, (rng() - 0.5) * amount]);
      const d = seen.get(key);
      pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
    }
    geo.computeVertexNormals();
    return geo;
  },
};

// Small hand-made decal textures (grille, lenses, plates, rims, gauges...). Always on: they are part of the model.
const DECALS = {
  cache: {},
  get(kind, arg) {
    const key = kind + (arg || '');
    if (this.cache[key]) return this.cache[key];
    const size = { plate: [64, 24], grille: [64, 24], gauges: [64, 32], vent: [32, 16], stencil: [48, 28] }[kind] || [32, 32];
    const c = document.createElement('canvas');
    [c.width, c.height] = size;
    const g = c.getContext('2d');
    const W = c.width, H = c.height;
    if (kind === 'grille') {
      g.fillStyle = '#0c0d0e'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#2a2c2f';
      for (let x = 2; x < W; x += 4) g.fillRect(x, 2, 2, H - 4);
      g.fillStyle = '#5c6066'; g.fillRect(0, 0, W, 2); g.fillRect(0, H - 2, W, 2);
      g.fillStyle = '#9aa0a6'; g.fillRect(W / 2 - 4, H / 2 - 3, 8, 6); // badge
    } else if (kind === 'headlight') {
      g.fillStyle = '#d8d4c0'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fffbe6'; g.fillRect(3, 3, W - 6, H - 6);
      g.strokeStyle = 'rgba(120,110,80,0.6)';
      for (let x = 6; x < W; x += 6) { g.beginPath(); g.moveTo(x, 3); g.lineTo(x, H - 3); g.stroke(); }
      g.fillStyle = '#ffffff'; g.fillRect(W / 2 - 4, H / 2 - 4, 8, 8);
    } else if (kind === 'taillight') {
      g.fillStyle = '#4a0606'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#c21b12'; g.fillRect(2, 2, W - 4, H - 4);
      g.fillStyle = '#e86a1a'; g.fillRect(2, 2, 8, H - 4); // indicator
      g.fillStyle = 'rgba(255,255,255,0.25)';
      for (let y = 4; y < H; y += 5) g.fillRect(2, y, W - 4, 1);
    } else if (kind === 'plate') {
      g.fillStyle = '#e9e4d0'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#222'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
      g.fillStyle = '#1a1a1a'; g.font = 'bold 14px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(arg || 'APX 714', W / 2, H / 2 + 1);
    } else if (kind === 'rim') {
      g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#9ea4aa'; g.beginPath(); g.arc(16, 16, 15, 0, TAU); g.fill();
      g.fillStyle = '#26282b';
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + 0.3;
        g.beginPath(); g.moveTo(16, 16);
        g.arc(16, 16, 13, a, a + 0.75); g.fill();
      }
      g.fillStyle = '#c4c9ce'; g.beginPath(); g.arc(16, 16, 4, 0, TAU); g.fill();
      g.fillStyle = '#555';
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; g.fillRect(16 + Math.cos(a) * 6 - 1, 16 + Math.sin(a) * 6 - 1, 2, 2); }
    } else if (kind === 'gauges') {
      g.fillStyle = '#0b0b0c'; g.fillRect(0, 0, W, H);
      for (const cx of [16, 48]) {
        g.fillStyle = '#1d1f1a'; g.beginPath(); g.arc(cx, 16, 14, 0, TAU); g.fill();
        g.strokeStyle = '#d8d2b0'; g.lineWidth = 1;
        for (let k = 0; k <= 8; k++) { const a = Math.PI * 0.75 + (k / 8) * Math.PI * 1.5; g.beginPath(); g.moveTo(cx + Math.cos(a) * 10, 16 + Math.sin(a) * 10); g.lineTo(cx + Math.cos(a) * 13, 16 + Math.sin(a) * 13); g.stroke(); }
        g.strokeStyle = '#ff5a2a'; g.lineWidth = 2;
        const a = cx < 32 ? 0.3 : -1.2;
        g.beginPath(); g.moveTo(cx, 16); g.lineTo(cx + Math.cos(a) * 11, 16 + Math.sin(a) * 11); g.stroke();
      }
    } else if (kind === 'vent') {
      g.fillStyle = '#121314'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#34373b';
      for (let y = 2; y < H; y += 3) g.fillRect(2, y, W - 4, 1);
    } else if (kind === 'glass') {
      // Fake sky reflection: bright top, dark bottom, a diagonal streak.
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#7f8f9a'); gr.addColorStop(0.45, '#2a3540'); gr.addColorStop(1, '#10161c');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath(); g.moveTo(6, 0); g.lineTo(12, 0); g.lineTo(0, 20); g.lineTo(0, 10); g.fill();
    } else if (kind === 'hazard') {
      g.fillStyle = '#c9a227'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#1a1a1a';
      for (let k = -W; k < W * 2; k += 10) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 5, 0); g.lineTo(k + 5 - H, H); g.lineTo(k - H, H); g.fill(); }
    } else if (kind === 'tape') {
      g.fillStyle = '#8d8f8c'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      for (let y = 1; y < H; y += 3) g.fillRect(0, y, W, 1);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k < 6; k++) g.fillRect(Math.random() * W, 0, 1, H); // creases
      g.fillStyle = '#6e706d'; g.fillRect(0, 0, 2, H); g.fillRect(W - 2, 0, 2, H); // torn ends
    } else if (kind === 'foam') {
      g.fillStyle = '#3b2a24'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#c9a85a';
      g.beginPath(); g.moveTo(8, 4); g.lineTo(24, 6); g.lineTo(27, 18); g.lineTo(20, 28); g.lineTo(9, 25); g.lineTo(4, 14); g.fill();
      g.fillStyle = 'rgba(120,90,30,0.6)';
      for (let k = 0; k < 30; k++) g.fillRect(6 + Math.random() * 20, 6 + Math.random() * 20, 1, 1);
      g.strokeStyle = '#1e1512'; g.lineWidth = 1; g.stroke();
    } else if (kind === 'tally') {
      g.fillStyle = '#1b1d22'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(200,195,180,0.85)'; g.lineWidth = 1;
      const n = arg ? +arg : 7;
      for (let k = 0; k < n; k++) {
        const grp = Math.floor(k / 5), i = k % 5, x = 3 + grp * 14 + i * 2.5;
        g.beginPath();
        if (i === 4) { g.moveTo(x - 11, 22); g.lineTo(x + 1, 8); } else { g.moveTo(x, 7); g.lineTo(x + 0.5, 24); }
        g.stroke();
      }
    } else if (kind === 'stencil') {
      g.fillStyle = '#1b1d22'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(220,210,180,0.85)'; g.font = 'bold 9px monospace'; g.textAlign = 'center';
      g.fillText('INMATE', W / 2, 10); g.font = 'bold 11px monospace'; g.fillText(arg || '4471', W / 2, 22);
      g.fillStyle = 'rgba(27,29,34,0.9)';
      for (let k = 0; k < 6; k++) g.fillRect(Math.random() * W, Math.random() * H, 2, 1); // flaked paint
    } else if (kind === 'photo') {
      g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#6b7f8c'; g.fillRect(3, 3, W - 6, H - 10);
      g.fillStyle = '#3d4a2c'; g.fillRect(3, 16, W - 6, 9);
      g.fillStyle = '#d9b48a'; g.beginPath(); g.arc(12, 13, 4, 0, TAU); g.fill(); g.fillRect(9, 16, 6, 7);
      g.fillStyle = '#c99a7a'; g.beginPath(); g.arc(21, 14, 3, 0, TAU); g.fill(); g.fillRect(19, 16, 5, 6);
      g.fillStyle = 'rgba(120,90,40,0.25)'; g.fillRect(0, 0, W, H); // yellowed
    } else if (kind === 'mesh') {
      g.clearRect(0, 0, W, H);
      g.strokeStyle = '#5c5a52'; g.lineWidth = 1;
      for (let k = -W; k < W * 2; k += 6) {
        g.beginPath(); g.moveTo(k, 0); g.lineTo(k + H, H); g.stroke();
        g.beginPath(); g.moveTo(k + H, 0); g.lineTo(k, H); g.stroke();
      }
    } else if (kind === 'rust') {
      g.fillStyle = '#5a5850'; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(${110 + Math.random() * 50},${50 + Math.random() * 25},20,${0.3 + Math.random() * 0.5})`;
        g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 4, 1 + Math.random() * 3);
      }
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k < 8; k++) g.fillRect(Math.random() * W, Math.random() * H, 1, 3 + Math.random() * 6);
    } else if (kind === 'paper') {
      g.fillStyle = '#d8d3c2'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(Math.random() * W, Math.random() * H); g.lineTo(Math.random() * W, Math.random() * H); g.stroke(); }
      g.fillStyle = 'rgba(60,60,80,0.5)';
      for (let y = 6; y < H - 4; y += 4) g.fillRect(4, y, 10 + Math.random() * 14, 1);
    } else if (kind === 'crackdash') {
      g.fillStyle = '#1b1d22'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1;
      let x = 2, y = 18;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += 3 + Math.random() * 2; y += (Math.random() - 0.5) * 6; g.lineTo(x, y); }
      g.stroke();
      g.strokeStyle = 'rgba(120,120,110,0.4)'; g.beginPath(); g.moveTo(2, 19); g.lineTo(x, y + 1); g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.name = 'decal_' + key;
    this.cache[key] = tex;
    return tex;
  },
  mat(kind, extra, arg) {
    return LP.mat('#ffffff', Object.assign({ map: this.get(kind, arg) }, extra));
  },
};

// Points along a wheel arch, from the rear edge over the top to the front edge.
function archPts(cx, cy, r, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (i / n) * Math.PI;
    out.push([+(cx + Math.cos(a) * r).toFixed(2), +(cy + Math.sin(a) * r).toFixed(2)]);
  }
  return out;
}

// Real-world proportions: 1 unit ~ 12.5cm. Wheels ~0.65m, cars ~1.3-1.55m tall.
// top: outline from the front-bottom corner, over the car, down to the rear-bottom corner.
const CAR_STYLES = {
  // Comet: a 90s two-door coupe.
  comet: {
    top: [[18.2, 1.8], [18.6, 4.4], [17.8, 5.6], [8.5, 6.7], [-11, 7.1], [-16.6, 6.9], [-17.8, 5.8], [-17.9, 2.0]],
    cabin: [[8.4, 6.8], [2.2, 10.8], [-7, 10.8], [-12.2, 7.1]], cabinW: 14.2, bodyW: 16,
    wheels: [11.2, -10.8], wheelR: 2.7, wheelZ: 7.25,
    lightY: 4.1, tailY: 5.6, frontPlateY: 2.5, rearPlateY: 4.2, mirrorX: 7.6, mirrorY: 7.6,
    bPillar: -1.6, seams: [6.6, -4.8], cPillar: [[-5.4, 7.1], [-7, 10.8], [-12.2, 7.1]],
    extras(g, m, st) {
      g.add(LP.side([[-15.8, 7.4], [-12.9, 7.6], [-12.9, 7.9], [-16.2, 7.8]], 14, m.body, 0.1)); // decklid lip spoiler
    },
  },
  // Brick: a boxy 80s estate car with a bull bar and roof rails.
  brick: {
    top: [[18.4, 1.9], [18.6, 5.2], [17.6, 6.5], [9, 7.3], [-17.2, 7.7], [-17.9, 6.8], [-18, 2.1]],
    cabin: [[9, 7.4], [4.8, 12], [-16.4, 12], [-17.4, 7.8]], cabinW: 15, bodyW: 16.5,
    wheels: [11.4, -11], wheelR: 3, wheelZ: 7.4,
    lightY: 4.7, tailY: 6.4, frontPlateY: 2.6, rearPlateY: 4.6, mirrorX: 8.2, mirrorY: 8.2,
    bPillar: -1.2, seams: [7.4, -3.4, -11.5], cPillar: [[-10.6, 7.8], [-10.6, 12], [-11.6, 12], [-11.6, 7.8]],
    extras(g, m, st) {
      const steel = LP.mat('#8a8f94', { metalness: 0.7, roughness: 0.4 });
      for (const s of [-1, 1]) g.add(LP.box(0.7, 5.2, 0.7, steel, 19.7, 3.8, 5 * s)); // bull bar
      g.add(LP.box(0.7, 0.7, 12, steel, 19.7, 6.1, 0));
      g.add(LP.box(0.7, 0.7, 12, steel, 19.7, 3.6, 0));
      for (const s of [-1, 1]) g.add(LP.box(19, 0.4, 0.5, m.dark, -5.6, 12.75, 6.4 * s)); // roof rails
      for (const x of [3, -14]) for (const s of [-1, 1]) g.add(LP.box(0.6, 0.6, 0.6, m.dark, x, 12.4, 6.4 * s));
    },
  },
  // Wasp: a hot hatch.
  wasp: {
    top: [[16.9, 1.8], [17.3, 4.2], [16.3, 5.4], [7.2, 6.4], [-13.6, 6.9], [-14.4, 6.2], [-14.6, 2]],
    cabin: [[7.1, 6.5], [1.4, 10.4], [-10.8, 10.3], [-13.9, 7]], cabinW: 13.6, bodyW: 15,
    wheels: [10.4, -9.6], wheelR: 2.6, wheelZ: 6.8,
    lightY: 4, tailY: 5.4, frontPlateY: 2.4, rearPlateY: 3.8, mirrorX: 6.4, mirrorY: 7.3,
    bPillar: -2.4, seams: [5.6, -5.4], cPillar: [[-7.6, 6.9], [-9.2, 10.3], [-10.8, 10.3], [-13.9, 7]],
    extras(g, m, st) {
      g.add(LP.side([[-9.6, 10.6], [-14.4, 10.2], [-14.6, 9.6], [-10.4, 10.2]], 13, m.body, 0.1)); // roof spoiler
      g.add(LP.box(1.4, 0.4, 13, m.dark, 17.6, 1.6, 0)); // front lip
    },
  },
  // Phantom: a 70s fastback muscle car.
  phantom: {
    top: [[18.8, 1.9], [19, 4.6], [18.4, 5.6], [6, 6.5], [-11.5, 6.6], [-17.4, 6.6], [-17.8, 5.6], [-18, 2]],
    cabin: [[4.5, 6.6], [-0.5, 10.3], [-4.5, 10.4], [-16.4, 6.8]], cabinW: 14.2, bodyW: 16.5,
    wheels: [11.8, -11.2], wheelR: 2.9, wheelZ: 7.4,
    lightY: 4.4, tailY: 5.2, frontPlateY: 2.6, rearPlateY: 3.6, mirrorX: 4.4, mirrorY: 7.4,
    bPillar: -3.4, seams: [3.4, -6.2], cPillar: [[-6.4, 6.8], [-4.6, 10.3], [-16.4, 6.8]],
    extras(g, m, st) {
      g.add(LP.side([[13, 6.5], [7.5, 7], [7.2, 7.8], [10.5, 7.8]], 4, m.dark, 0.15)); // hood scoop
      g.add(LP.side([[-15.5, 7], [-17.6, 7.2], [-17.8, 7.8], [-16, 7.6]], 14.5, m.body, 0.1)); // ducktail
    },
  },
};

// Full body outline: the top chain plus a bottom edge with proper wheel arches.
function bodyOutline(st) {
  const [wf, wr] = st.wheels, R = st.wheelR + 0.75, cy = st.wheelR - 0.2;
  const rearX = st.top[st.top.length - 1][0], frontX = st.top[0][0];
  return [
    ...st.top,
    [rearX + 2.2, 1.5],
    ...archPts(wr, cy, R, 7),
    [wr + R + 0.2, 1.3], [wf - R - 0.2, 1.3],
    ...archPts(wf, cy, R, 7),
    [frontX - 2.2, 1.5],
  ];
}

// Split a body outline into a front clip (x >= xf) and rear deck (x <= xr) for the player's open shell.
function shellProfiles(st, xf, xr) {
  const top = st.top.slice(1);
  const topY = (x) => {
    for (let i = 0; i < top.length - 1; i++) {
      const [x1, y1] = top[i], [x2, y2] = top[i + 1];
      if ((x <= x1 && x >= x2) || (x >= x1 && x <= x2)) return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1 || 1);
    }
    return top[top.length - 1][1];
  };
  const [wf, wr] = st.wheels, R = st.wheelR + 0.75, cy = st.wheelR - 0.2;
  // Where the cut line crosses an arch, start the bottom edge on the arch itself.
  const bottomY = (x, wc) => (Math.abs(x - wc) < R ? cy + Math.sqrt(R * R - (x - wc) ** 2) : 1.3);
  const front = [st.top[0], ...top.filter(([x]) => x > xf), [xf, topY(xf)], [xf, bottomY(xf, wf)], ...archPts(wf, cy, R, 7).filter(([x]) => x > xf), [st.top[0][0] - 2.2, 1.5]];
  const rearX = st.top[st.top.length - 1][0];
  const rear = [[xr, topY(xr)], ...top.filter(([x]) => x < xr), [rearX + 2.2, 1.5], ...archPts(wr, cy, R, 7).filter(([x]) => x < xr), [xr, bottomY(xr, wr)]];
  return [front, rear];
}

// Darken vertices near the ground: road grime and fake ambient occlusion baked into vertex colours.
function bakeGrime(root, height) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noGrime) return;
    const geo = o.geometry, pos = geo.attributes.position;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      const t = clamp(v.y / height, 0, 1);
      const k = 0.55 + 0.45 * t * t * (3 - 2 * t); // smoothstep: dark at the sills, clean up top
      col[i * 3] = k * 1.0; col[i * 3 + 1] = k * 0.97; col[i * 3 + 2] = k * 0.92; // brownish road dirt
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const mt of Array.isArray(o.material) ? o.material : [o.material]) mt.vertexColors = true;
  });
}

const Models = {
  // ---------- Cars ----------

  // opts: { style, color, accent, weapon: 'rocket'|'mine'|null, shell: true for the player's own car
  //         (open middle so the cockpit interior shows from inside), plate: 'ABC 123' }
  car(opts) {
    const st = CAR_STYLES[opts.style] || CAR_STYLES.comet;
    const g = new THREE.Group();
    g.name = opts.name || 'car';
    const paint = new THREE.Color(opts.color).lerp(new THREE.Color('#77736a'), 0.18); // real paint is less saturated
    const body = LP.mat(paint, { metalness: 0.3, roughness: 0.55 });
    const dark = LP.mat('#1b1c1e', { roughness: 0.9 });
    const chrome = LP.mat('#a7adb3', { metalness: 0.8, roughness: 0.3 });
    const glass = DECALS.mat('glass', { metalness: 0.4, roughness: 0.2 });
    g.userData.bodyMat = body;
    const W = opts.shell ? 18 : st.bodyW, hw = W / 2;
    const bev = 0.35;

    if (opts.shell) {
      const [front, rear] = shellProfiles(st, 8.5, -12.5);
      g.add(LP.side(front, W, body, bev), LP.side(rear, W, body, bev));
    } else {
      g.add(LP.side(bodyOutline(st), W, body, bev));
      // Glasshouse: tinted glass, roof skin, pillars.
      const cab = st.cabin, cw = st.cabinW;
      g.add(LP.side(cab, cw, glass, 0.25));
      const roofY = cab[1][1];
      g.add(LP.side([[cab[1][0] - 0.2, roofY - 0.2], [cab[2][0] + 0.2, roofY - 0.2], [cab[2][0], roofY + 0.35], [cab[1][0] - 0.3, roofY + 0.35]], cw + 0.3, body, 0.1));
      for (const s of [-1, 1]) {
        const z = (cw / 2 + 0.1) * s;
        g.add(LP.beam([cab[0][0], cab[0][1], z], [cab[1][0], cab[1][1], z], 0.55, body)); // A-pillar
        g.add(LP.box(0.9, roofY - cab[0][1] + 0.1, 0.4, body, st.bPillar, (roofY + cab[0][1]) / 2, z)); // B-pillar
        g.add(LP.side(st.cPillar, 0.45, body, 0.05).translateZ(z)); // C-pillar
      }
    }

    // Front: bumper, grille, headlights, plate. Rear: bumper, tail lights, plate, exhaust.
    const fx = st.top[0][0] + bev, rx = st.top[st.top.length - 1][0] - bev;
    g.add(LP.box(1, 1.3, W - 0.6, dark, fx + 0.3, 2.3, 0));
    g.add(LP.box(1, 1.3, W - 0.6, dark, rx - 0.3, 2.4, 0));
    const grille = LP.box(0.2, 1.3, 6, DECALS.mat('grille'), fx + 0.35, st.lightY - 0.2, 0);
    grille.userData.noGrime = true;
    g.add(grille);
    for (const s of [-1, 1]) {
      const hl = LP.box(0.3, 1.1, 2.8, DECALS.mat('headlight', { emissive: '#fff3c8', emissiveIntensity: 0.35 }), fx + 0.3, st.lightY, (hw - 2.3) * s);
      const tl = LP.box(0.3, 1.0, 3.2, DECALS.mat('taillight', { emissive: '#ff2a1a', emissiveIntensity: 0.25 }), rx - 0.2, st.tailY, (hw - 2.4) * s);
      hl.userData.noGrime = tl.userData.noGrime = true;
      g.add(hl, tl);
    }
    const plate = opts.plate || 'APX ' + (100 + Math.floor(paint.r * 899));
    g.add(LP.box(0.12, 1.0, 2.6, DECALS.mat('plate', {}, plate), fx + 0.85, st.frontPlateY, 0));
    g.add(LP.box(0.12, 1.0, 2.6, DECALS.mat('plate', {}, plate), rx - 0.85, st.rearPlateY, 0));
    const exhaust = LP.cyl(0.35, 0.35, 1.6, 6, chrome, rx - 0.2, 1.5, -hw + 3);
    exhaust.rotation.z = Math.PI / 2;
    g.add(exhaust);

    // Sides: door seams and handles, mirrors.
    if (!opts.shell) {
      for (const s of [-1, 1]) {
        const z = (hw + bev + 0.02) * s;
        for (const x of st.seams) g.add(LP.box(0.12, 5, 0.06, dark, x, 4.1, z));
        g.add(LP.box(0.9, 0.25, 0.12, chrome, st.seams[st.seams.length - 1] + 1.2, 6.0, z));
        g.add(LP.box(0.8, 0.8, 1.2, body, st.mirrorX, st.mirrorY, (hw + 0.9) * s)); // mirror housing
        g.add(LP.box(0.3, 0.3, 1, dark, st.mirrorX + 0.2, st.mirrorY - 0.3, (hw + 0.3) * s));
      }
      g.add(LP.cyl(0.06, 0.06, 4.5, 4, dark, rx + 3.5, st.top[st.top.length - 2][1] + 2.4, -hw + 2.5)); // antenna
    }
    // Underbody so you never see daylight through the car.
    g.add(LP.box(Math.abs(fx - rx) - 4, 0.6, W - 2, dark, (fx + rx) / 2, 1.5, 0));

    // Wheels: 12-sided tyres, spoked rims on the outer face.
    const tyre = LP.mat('#151515', { roughness: 1 });
    g.userData.wheels = [];
    for (const x of st.wheels) {
      for (const s of [-1, 1]) {
        const w = new THREE.Group();
        const t = LP.cyl(st.wheelR, st.wheelR, 2.2, 12, tyre);
        t.rotation.x = Math.PI / 2;
        const rim = LP.mesh(new THREE.CircleGeometry(st.wheelR * 0.66, 12), DECALS.mat('rim', { metalness: 0.5, roughness: 0.4 }), 0, 0, 1.12 * s);
        if (s < 0) rim.rotation.y = Math.PI;
        rim.userData.noGrime = true;
        w.add(t, rim);
        w.position.set(x, st.wheelR, st.wheelZ * s);
        g.add(w);
        g.userData.wheels.push(w);
      }
    }
    st.extras(g, { body, dark, chrome }, st);

    if (opts.weapon === 'rocket') {
      const pod = Models.rocketPod();
      pod.position.set(st.cabin[1][0] - 4.2, st.cabin[1][1] + 0.35, 0);
      g.add(pod);
    } else if (opts.weapon === 'mine') {
      const d = Models.mineDropper();
      d.position.set(rx - 0.6, 0, 0);
      g.add(d);
    }
    bakeGrime(g, 9);
    return g;
  },

  // Improvised roof-mounted rocket pod on welded brackets.
  rocketPod() {
    const g = new THREE.Group();
    g.name = 'rocket pod';
    const steel = LP.mat('#5a5d52', { metalness: 0.6, roughness: 0.6 });
    for (const s of [-1, 1]) g.add(LP.box(6, 0.5, 0.6, steel, 0, 0.3, 4.5 * s));
    for (const x of [-2, 2]) g.add(LP.box(0.6, 1.4, 9.6, steel, x, 0.9, 0));
    g.add(LP.side([[-4.2, 1.6], [3.6, 1.6], [4.2, 2.6], [3.6, 4.4], [-4.2, 4.4]], 5.2, LP.mat('#4b5a2e', { metalness: 0.3 }), 0.15));
    g.add(LP.box(0.2, 0.6, 5.2, DECALS.mat('hazard'), -1, 4.5, 0));
    const tube = LP.mat('#111');
    for (const y of [2.4, 3.6]) for (const z of [-1.3, 1.3]) {
      const t = LP.cyl(0.55, 0.55, 0.5, 8, tube, 4.2, y, z);
      t.rotation.z = Math.PI / 2;
      g.add(t);
    }
    return g;
  },

  // Welded steel crate hanging off the rear bumper; drops mines through a chute.
  mineDropper() {
    const g = new THREE.Group();
    g.name = 'mine dropper';
    const steel = LP.mat('#4a4c48', { metalness: 0.6, roughness: 0.7 });
    g.add(LP.side([[-4, 2.2], [0, 2.2], [0, 6.6], [-3.4, 6.6]], 8, steel, 0.15));
    g.add(LP.box(0.15, 1.2, 7.6, DECALS.mat('hazard'), -4.1, 5.4, 0));
    g.add(LP.box(2, 0.9, 3, LP.mat('#1a1a1a'), -3.2, 1.8, 0)); // chute
    for (const s of [-1, 1]) g.add(LP.box(1.4, 0.5, 0.5, steel, 0.4, 3.2, 3 * s)); // brackets
    return g;
  },

  // ---------- Hand-held weapons (point down -Z) ----------

  // Compact SMG: stamped-steel receiver, folding wire stock, magazine in the grip.
  smg() {
    const g = new THREE.Group();
    g.name = 'smg';
    const steel = LP.mat('#2b2d30', { metalness: 0.6, roughness: 0.45 });
    const poly = LP.mat('#18191b', { roughness: 0.8 });
    g.add(LP.sideZ([[-2.6, -0.5], [2.4, -0.5], [2.6, 0.1], [2.4, 0.6], [-2.6, 0.6]], 1.0, steel, 0.08)); // receiver
    g.add(LP.sideZ([[-2.4, 0.6], [1.6, 0.6], [1.6, 0.85], [-2.4, 0.85]], 0.5, steel, 0.04)); // top cover
    g.add(LP.sideZ([[-0.4, -0.5], [0.5, -0.5], [0.2, -2.6], [-0.7, -2.6]], 0.85, poly, 0.1)); // grip
    g.add(LP.sideZ([[-0.3, -2.6], [0.4, -2.6], [0.3, -3.5], [-0.4, -3.5]], 0.6, steel, 0.05)); // mag base in grip
    g.add(LP.sideZ([[0.5, -0.5], [1.5, -0.5], [1.5, -0.65], [0.5, -1.2]], 0.15, steel, 0)); // trigger guard
    g.add(LP.sideZ([[1.4, -0.5], [2.4, -0.5], [2.2, -1.6], [1.6, -1.6]], 0.7, poly, 0.08)); // front grip
    const barrel = LP.cyl(0.2, 0.2, 1.6, 8, steel, 0, 0.1, -3.2);
    barrel.rotation.x = Math.PI / 2;
    g.add(barrel);
    const muzzle = LP.cyl(0.28, 0.28, 0.5, 8, steel, 0, 0.1, -3.9);
    muzzle.rotation.x = Math.PI / 2;
    g.add(muzzle);
    for (const s of [-1, 1]) g.add(LP.box(0.08, 0.08, 3, steel, 0.35 * s, -0.1, 3.9)); // wire stock
    g.add(LP.box(0.8, 1.0, 0.12, steel, 0, -0.35, 5.4));
    g.add(LP.box(0.25, 0.4, 0.35, steel, 0, 1.05, 1.6)); // rear sight
    g.add(LP.box(0.15, 0.4, 0.2, steel, 0, 1.0, -2.2)); // front sight
    g.add(LP.box(0.3, 0.2, 0.6, steel, 0.6, 0.35, 0.4)); // charging handle
    g.userData.barrel = barrel;
    return g;
  },

  // RPG-style launcher: steel tube, wooden heat guard, finned warhead.
  launcher() {
    const g = new THREE.Group();
    g.name = 'launcher';
    const steel = LP.mat('#3a3d3a', { metalness: 0.6, roughness: 0.5 });
    const wood = LP.mat('#7a4e2a');
    const tube = LP.cyl(0.55, 0.55, 10, 8, steel);
    tube.rotation.x = Math.PI / 2;
    g.add(tube);
    const guard = LP.cyl(0.9, 0.9, 3.4, 8, wood, 0, 0, 0.6);
    guard.rotation.x = Math.PI / 2;
    g.add(guard);
    const bell = LP.cyl(0.6, 1.0, 1.6, 8, steel, 0, 0, 5.6);
    bell.rotation.x = Math.PI / 2;
    g.add(bell);
    g.add(LP.sideZ([[-1.2, -0.5], [-0.3, -0.5], [-0.6, -2.4], [-1.5, -2.4]], 0.7, wood, 0.08)); // rear grip
    g.add(LP.sideZ([[1.8, -0.5], [2.6, -0.5], [2.3, -2.2], [1.5, -2.2]], 0.7, steel, 0.08)); // front grip
    g.add(LP.box(0.5, 1.0, 1.4, steel, -0.85, 0.8, -1.2)); // optic
    // Warhead: olive cone and body with fins, sitting in the muzzle.
    const tip = new THREE.Group();
    const war = LP.cyl(0.05, 1.05, 2.4, 8, LP.mat('#4b5a2e', { metalness: 0.3 }), 0, 0, -1.2);
    war.rotation.x = -Math.PI / 2;
    const neck = LP.cyl(1.05, 0.5, 0.8, 8, LP.mat('#4b5a2e'), 0, 0, 0.4);
    neck.rotation.x = -Math.PI / 2;
    tip.add(war, neck);
    for (let k = 0; k < 4; k++) {
      const f = LP.box(0.08, 0.7, 0.8, steel, 0, 0.6, 1.0);
      const p = new THREE.Group();
      p.rotation.z = (k / 4) * TAU;
      p.add(f);
      tip.add(p);
    }
    tip.position.z = -6.2;
    g.add(tip);
    g.userData.tip = tip;
    return g;
  },

  // Classic round fragmentation grenade with spoon and pin.
  grenade() {
    const g = new THREE.Group();
    g.name = 'grenade';
    const body = LP.mesh(new THREE.IcosahedronGeometry(1, 1), LP.mat('#3f4a2a', { roughness: 0.7 }));
    body.scale.set(0.95, 1.05, 0.95);
    g.add(body);
    const metal = LP.mat('#8a8f94', { metalness: 0.7, roughness: 0.35 });
    g.add(LP.cyl(0.4, 0.45, 0.5, 8, metal, 0, 1.15, 0)); // fuse
    const spoon = LP.box(0.22, 1.7, 0.4, metal, 0.5, 0.5, 0);
    spoon.rotation.z = -0.25;
    g.add(spoon);
    const ring = LP.mesh(new THREE.TorusGeometry(0.35, 0.06, 4, 10), metal, -0.4, 1.3, 0);
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
    return g;
  },

  // Pump shotgun: long barrel over a tube magazine, wooden pump and stock.
  shotgun() {
    const g = new THREE.Group();
    g.name = 'shotgun';
    const steel = LP.mat('#2d2f31', { metalness: 0.6, roughness: 0.45 });
    const wood = LP.mat('#6e4526');
    g.add(LP.sideZ([[-2.2, -0.45], [1.4, -0.45], [1.4, 0.55], [-2.2, 0.55]], 0.9, steel, 0.08)); // receiver
    const barrel = LP.cyl(0.26, 0.26, 6.4, 8, steel, 0, 0.3, -4.6);
    barrel.rotation.x = Math.PI / 2;
    const tube = LP.cyl(0.22, 0.22, 4.6, 8, steel, 0, -0.25, -3.7);
    tube.rotation.x = Math.PI / 2;
    g.add(barrel, tube);
    const pump = LP.cyl(0.42, 0.42, 2, 8, wood, 0, -0.25, -3.2);
    pump.rotation.x = Math.PI / 2;
    g.add(pump);
    g.add(LP.sideZ([[-2.2, 0.4], [-6.2, -0.6], [-6.2, -1.7], [-5.6, -1.7], [-2.2, -0.6]], 0.75, wood, 0.12)); // stock
    g.add(LP.sideZ([[-1.4, -0.45], [-0.6, -0.45], [-1.0, -1.6], [-1.8, -1.6]], 0.65, wood, 0.08)); // grip
    g.add(LP.box(0.15, 0.3, 0.2, steel, 0, 0.65, -7.6)); // bead sight
    g.userData.barrel = barrel;
    return g;
  },

  // Orange flare pistol with a fat barrel.
  flareGun() {
    const g = new THREE.Group();
    g.name = 'flare gun';
    const orange = LP.mat('#d9601e', { roughness: 0.6 });
    const black = LP.mat('#1a1a1a');
    const barrel = LP.cyl(0.55, 0.55, 3.4, 8, orange, 0, 0.2, -1.6);
    barrel.rotation.x = Math.PI / 2;
    g.add(barrel);
    g.add(LP.cyl(0.4, 0.4, 0.2, 8, black, 0, 0.2, -3.35).rotateX(Math.PI / 2));
    g.add(LP.sideZ([[-0.5, -0.3], [0.5, -0.3], [0.1, -2.0], [-0.8, -2.0]], 0.8, orange, 0.1)); // grip
    g.add(LP.box(0.5, 0.5, 0.8, black, 0, 0.5, 0.4)); // hammer
    g.userData.barrel = barrel;
    return g;
  },

  weapon(id) {
    return id === 'shotgun' ? Models.shotgun() : id === 'rocket' ? Models.launcher() : id === 'flare' ? Models.flareGun() : Models.smg();
  },

  // ---------- Trinkets (each hangs or sits somewhere in the cabin) ----------

  rabbitFoot() {
    const g = new THREE.Group();
    g.name = "rabbit's foot";
    g.add(LP.box(0.05, 1.8, 0.05, LP.mat('#888'), 0, -0.9, 0));
    g.add(LP.mesh(new THREE.TorusGeometry(0.18, 0.05, 4, 8), LP.mat('#c9b26a', { metalness: 0.7 }), 0, -1.9, 0));
    const fur = LP.mesh(LP.jitter(new THREE.IcosahedronGeometry(0.4, 0), 0.12, 5), LP.mat('#d8cfc0', { roughness: 1 }), 0, -2.5, 0);
    fur.scale.set(0.8, 1.6, 0.8);
    g.add(fur);
    return g;
  },

  horseshoe() {
    const g = new THREE.Group();
    g.name = 'horseshoe';
    const shoe = LP.mesh(new THREE.TorusGeometry(0.8, 0.16, 4, 10, Math.PI * 1.35), LP.mat('#6b4a32', { metalness: 0.6, roughness: 0.8 }));
    shoe.rotation.z = -Math.PI * 0.175;
    g.add(shoe);
    for (const a of [0.4, 1.2, 2.0, 2.8, 3.6]) g.add(LP.box(0.08, 0.08, 0.3, LP.mat('#999', { metalness: 0.8 }), Math.cos(a - 0.55) * 0.8, Math.sin(a - 0.55) * 0.8, 0.12));
    return g;
  },

  keyRing() {
    const g = new THREE.Group();
    g.name = "warden's keys";
    const brass = LP.mat('#b8963a', { metalness: 0.8, roughness: 0.35 });
    g.add(LP.box(0.05, 1.4, 0.05, LP.mat('#888'), 0, -0.7, 0));
    const ring = LP.mesh(new THREE.TorusGeometry(0.4, 0.05, 4, 10), LP.mat('#9aa0a6', { metalness: 0.8 }), 0, -1.75, 0);
    g.add(ring);
    for (const [a, len] of [[-0.5, 1.1], [0.1, 1.4], [0.6, 0.9]]) {
      const k = new THREE.Group();
      k.position.set(Math.sin(a) * 0.35, -2.1, 0);
      k.rotation.z = a;
      k.add(LP.mesh(new THREE.TorusGeometry(0.2, 0.07, 4, 6), brass, 0, 0, 0));
      k.add(LP.box(0.1, len, 0.08, brass, 0, -len / 2 - 0.2, 0));
      k.add(LP.box(0.3, 0.14, 0.08, brass, 0.15, -len - 0.1, 0));
      g.add(k);
    }
    return g;
  },

  rosary() {
    const g = new THREE.Group();
    g.name = 'rosary';
    const bead = LP.mat('#3a2418', { roughness: 0.6 });
    const n = 14;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      g.add(LP.mesh(new THREE.OctahedronGeometry(0.11, 0), bead, Math.sin(a) * 0.5, -1.0 + Math.cos(a) * 0.9, 0));
    }
    const cross = LP.mat('#2a2a2a', { metalness: 0.5 });
    g.add(LP.box(0.1, 0.7, 0.06, cross, 0, -2.35, 0));
    g.add(LP.box(0.4, 0.1, 0.06, cross, 0, -2.2, 0));
    g.add(LP.box(0.05, 0.4, 0.05, bead, 0, -2.0 + 0.0, 0));
    return g;
  },

  airFreshener() {
    const g = new THREE.Group();
    g.name = 'air freshener';
    g.add(LP.box(0.04, 1.2, 0.04, LP.mat('#ddd'), 0, -0.6, 0));
    const tree = new THREE.Shape([[0, 0], [0.55, -0.6], [0.3, -0.6], [0.7, -1.1], [0.4, -1.1], [0.8, -1.6], [0.1, -1.6], [0.1, -1.9], [-0.1, -1.9], [-0.1, -1.6], [-0.8, -1.6], [-0.4, -1.1], [-0.7, -1.1], [-0.3, -0.6], [-0.55, -0.6]].map(([x, y]) => new THREE.Vector2(x, y)));
    const card = new THREE.Mesh(new THREE.ExtrudeGeometry(tree, { depth: 0.04, bevelEnabled: false }), LP.mat('#2f7a3a', { roughness: 1 }));
    card.position.y = -1.2;
    g.add(card);
    return g;
  },

  medal() {
    const g = new THREE.Group();
    g.name = 'st christopher medal';
    const gold = LP.mat('#c9a443', { metalness: 0.8, roughness: 0.3 });
    const disc = LP.cyl(0.55, 0.55, 0.1, 10, gold);
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
    g.add(LP.mesh(new THREE.TorusGeometry(0.55, 0.06, 4, 10), gold));
    g.add(LP.box(0.12, 0.6, 0.05, LP.mat('#8a6a20', { metalness: 0.8 }), 0, 0.05, 0.06)); // figure
    g.add(LP.box(0.35, 0.12, 0.05, LP.mat('#8a6a20', { metalness: 0.8 }), 0, 0.15, 0.06));
    return g;
  },

  trinket(id) {
    return {
      dice: Models.fuzzyDice, rabbit_foot: Models.rabbitFoot, horseshoe: Models.horseshoe, keys: Models.keyRing,
      rosary: Models.rosary, bobblehead: Models.bobblehead, freshener: Models.airFreshener, medal: Models.medal,
    }[id]();
  },

  rocket(color) {
    const g = new THREE.Group();
    g.name = 'rocket';
    const body = LP.mat(color || '#dddddd', { metalness: 0.3 });
    const b = LP.cyl(1.1, 1.1, 7, 6, body);
    b.rotation.z = Math.PI / 2;
    const nose = LP.cyl(0.05, 1.1, 2.6, 6, LP.mat('#ff5a3c'), 4.8, 0, 0);
    nose.rotation.z = -Math.PI / 2;
    g.add(b, nose);
    const fin = LP.mat('#333');
    for (let k = 0; k < 4; k++) {
      const f = LP.box(2, 0.2, 1.6, fin, -3, 0, 0);
      f.geometry.translate(0, 0, 0.9);
      f.rotation.x = (k * Math.PI) / 2;
      g.add(f);
    }
    const flame = LP.mesh(new THREE.OctahedronGeometry(1.6, 0), new THREE.MeshBasicMaterial({ color: '#ffb13b' }), -4.6, 0, 0);
    flame.scale.set(1.6, 0.8, 0.8);
    g.add(flame);
    g.userData.body = b;
    return g;
  },

  mine() {
    const g = new THREE.Group();
    g.name = 'mine';
    const metal = LP.mat('#2a2a2a', { metalness: 0.6, roughness: 0.5 });
    g.add(LP.cyl(6.5, 7.5, 2.4, 8, metal, 0, 1.2, 0));
    g.add(LP.cyl(3.5, 4, 1, 8, LP.mat('#3a3a3a', { metalness: 0.6 }), 0, 2.9, 0));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + Math.PI / 4;
      const sp = LP.cyl(0.05, 0.6, 1.8, 4, LP.mat('#9aa0a6', { metalness: 0.7 }), Math.cos(a) * 5, 2.8, Math.sin(a) * 5);
      g.add(sp);
    }
    const led = LP.mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#ff2a2a' }), 0, 3.8, 0);
    g.add(led);
    g.userData.led = led;
    return g;
  },

  // ---------- Trinkets & cabin props ----------

  fuzzyDice() {
    const g = new THREE.Group();
    g.name = 'fuzzy dice';
    g.add(LP.box(0.06, 2.3, 0.06, LP.mat('#eeeeee'), 0, -1.15, 0)); // string
    const pip = LP.mat('#111');
    const die = (color, x, y, z, rx, ry) => {
      const d = new THREE.Group();
      d.add(LP.mesh(LP.jitter(new THREE.BoxGeometry(0.8, 0.8, 0.8, 1, 1, 1), 0.08, Math.round(x * 100 + 3)), LP.mat(color, { roughness: 1 })));
      for (const [px, py] of [[-0.2, -0.2], [0, 0], [0.2, 0.2]]) d.add(LP.box(0.12, 0.12, 0.04, pip, px, py, 0.42));
      d.add(LP.box(0.04, 0.12, 0.12, pip, 0.42, 0.18, 0.18));
      d.add(LP.box(0.04, 0.12, 0.12, pip, 0.42, -0.18, -0.18));
      d.position.set(x, y, z);
      d.rotation.set(rx, ry, 0.2);
      return d;
    };
    g.add(die('#f2f2f2', 0, -2.6, -0.35, 0.4, 0.3), die('#ff3b6b', 0.1, -2.85, 0.42, -0.3, 0.6));
    return g;
  },

  bobblehead() {
    const g = new THREE.Group();
    g.name = 'bobblehead';
    g.add(LP.cyl(1, 1.1, 0.4, 8, LP.mat('#222'), 0, 0.2, 0)); // base
    g.add(LP.cyl(0.55, 0.75, 1.5, 6, LP.mat('#2a62c9'), 0, 1.15, 0)); // body
    g.add(LP.box(0.5, 0.35, 0.9, LP.mat('#2a62c9'), 0, 1.6, 0)); // shoulders
    const neck = new THREE.Group();
    neck.position.y = 1.9;
    neck.add(LP.cyl(0.08, 0.08, 0.5, 4, LP.mat('#999'), 0, 0.15, 0)); // spring
    neck.add(LP.mesh(new THREE.IcosahedronGeometry(0.95, 1), LP.mat('#f1c27d'), 0, 1.0, 0));
    neck.add(LP.cyl(0.85, 1, 0.55, 8, LP.mat('#e8423f'), 0, 1.6, 0)); // cap
    neck.add(LP.box(0.9, 0.12, 1.2, LP.mat('#e8423f'), 0.75, 1.38, 0)); // brim
    for (const z of [-0.32, 0.32]) neck.add(LP.box(0.1, 0.18, 0.14, LP.mat('#111'), 0.88, 1.05, z)); // eyes
    g.add(neck);
    g.userData.neck = neck;
    return g;
  },

  grenadeCrate() {
    const g = new THREE.Group();
    g.name = 'grenade crate';
    const wood = LP.mat('#4a5a2a'), slat = LP.mat('#3b4822');
    g.add(LP.box(4.2, 1.4, 3.6, wood, 0, 0, 0));
    for (const x of [-1.6, 0, 1.6]) g.add(LP.box(0.3, 1.45, 3.65, slat, x, 0, 0));
    g.add(LP.box(1.2, 0.5, 0.2, LP.mat('#d8c27a'), 0, 0, 1.85)); // stencil plate
    g.userData.nades = [];
    for (let k = 0; k < 3; k++) {
      const n = Models.grenade();
      n.scale.setScalar(0.5);
      n.position.set(-1.1 + k * 1.1, 1.0, 0);
      g.add(n);
      g.userData.nades.push(n);
    }
    return g;
  },

  // The cabin you sit in. Screens, mirror and windshield get live textures in the cockpit view.
  interior(color, opts) {
    const noRoof = opts && opts.noRoof;
    const I = new THREE.Group();
    I.name = 'cockpit interior';
    const refs = {};
    const m3 = LP.mat, box = LP.box, beam = LP.beam;
    const dark = m3('#1b1d22'), trim = m3('#2a2d33'), seat = m3('#3b2a24'), body = m3(color, { metalness: 0.3, roughness: 0.5 });
    I.add(box(34, 1, 17, m3('#15161a'), -1, 1, 0)); // floor
    I.add(box(5, 2.6, 17.2, dark, 6.5, 5, 0)); // dashboard
    I.add(box(3.5, 0.6, 17.2, trim, 5.6, 6.5, 0)); // dash top lip
    for (const s of [-1, 1]) {
      I.add(beam([8.4, 6.6, 8.6 * s], [2.5, 12.6, 8.2 * s], 1.1, body)); // A-pillars
      I.add(beam([-4, 5.5, 8.6 * s], [-4, 12.6, 8.6 * s], 1.4, body)); // B-pillars
      I.add(beam([-12, 12.6, 8.4 * s], [-16.5, 7, 8.6 * s], 1.3, body)); // C-pillars
      I.add(box(22, 5.5, 0.8, trim, -3.5, 3.6, 8.9 * s)); // doors
      I.add(box(22, 0.8, 1.6, dark, -3.5, 6.4, 8.4 * s)); // window sill
    }
    if (!noRoof) {
      I.add(box(14.6, 0.8, 17.4, body, -4.75, 12.95, 0)); // roof
      I.add(box(14.6, 0.3, 16, m3('#4a4740'), -4.75, 12.5, 0)); // headliner
    }
    I.add(box(2, 2, 17.2, body, -17.2, 6.5, 0)); // rear deck
    I.add(box(4.5, 0.6, 17, body, 8.8, 6.6, 0)); // cowl under windshield
    // Seats: rear bench, the empty driver's seat, your seat.
    I.add(box(5, 4, 16, seat, -9.5, 4, 0));
    I.add(box(1.5, 4.5, 16, seat, -12, 6.8, 0)); // low bench back keeps the rear window clear
    for (const z of [-4.5, 4.5]) {
      I.add(box(6, 1.6, 6, seat, -1.5, 3.6, z));
      if (z > 0) continue; // you're sitting in this one; its back would fill the view when you turn around
      const back = box(1.6, 8, 6, seat, -4.6, 8, z);
      back.rotation.z = 0.12;
      I.add(back);
      I.add(box(1.4, 2.2, 4, seat, -5.2, 13, z).translateY(-1.8));
    }
    I.add(box(10, 3.6, 3, dark, 0.5, 3.7, 0)); // center console

    // Steering wheel turning on its own.
    const col = beam([6, 5.6, -4.5], [3.6, 7.5, -4.5], 0.8, dark);
    I.add(col);
    const wheelTilt = new THREE.Group();
    wheelTilt.position.set(3.4, 7.7, -4.5);
    wheelTilt.rotation.z = 0.45;
    const wheelFace = new THREE.Group();
    wheelFace.rotation.y = Math.PI / 2;
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.32, 4, 10), m3('#111')));
    wheel.add(box(5, 0.5, 0.4, m3('#222')));
    wheel.add(box(0.5, 2.6, 0.4, m3('#222'), 0, -1.3, 0));
    wheelFace.add(wheel);
    wheelTilt.add(wheelFace);
    I.add(wheelTilt);
    refs.wheel = wheel;

    // A bare bulb hanging from the headliner on a cable.
    const bulb = new THREE.Group();
    bulb.position.set(-7.5, 12.3, -1.5);
    bulb.add(beam([0, 0, 0], [0, -1.6, 0], 0.08, m3('#111')));
    bulb.add(LP.cyl(0.25, 0.25, 0.4, 6, m3('#8a8f94', { metalness: 0.7 }), 0, -1.7, 0));
    const glass = LP.mesh(new THREE.IcosahedronGeometry(0.45, 0), LP.glow('#ffd9a0', 1.4), 0, -2.2, 0);
    bulb.add(glass);
    bulb.userData.glass = glass;
    I.add(bulb);
    refs.bulb = bulb;

    // Rear-view mirror (live feed in the cockpit view).
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.35), new THREE.MeshBasicMaterial({ color: '#8fa3b8' }));
    refs.mirror = mirror;
    mirror.position.set(3.1, 11.6, 0);
    mirror.lookAt(EYE.x, EYE.y + 0.6, EYE.z);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.7), new THREE.MeshBasicMaterial({ color: '#111' }));
    frame.position.copy(mirror.position);
    frame.quaternion.copy(mirror.quaternion);
    frame.translateZ(-0.08);
    I.add(frame, mirror);
    I.add(beam([3.4, 12.5, 0], [3.4, 11.6, 0], 0.4, m3('#111')));

    // Dashboard screens: radar + status.
    const radar = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ color: '#0b3a1a' }));
    refs.radar = radar;
    radar.position.set(5.6, 7.75, 0.4);
    radar.lookAt(EYE.x, EYE.y, EYE.z);
    I.add(radar);
    const bezel = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), new THREE.MeshBasicMaterial({ color: '#0a0a0a' }));
    bezel.position.copy(radar.position);
    bezel.quaternion.copy(radar.quaternion);
    bezel.translateZ(-0.05);
    I.add(bezel);
    const status = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.4), new THREE.MeshBasicMaterial({ color: '#3a2400' }));
    refs.status = status;
    status.position.set(5.6, 7.35, -2.6);
    status.lookAt(EYE.x, EYE.y, EYE.z);
    I.add(status);

    // Grenade crate on the console: ammo you can count.
    const crate = Models.grenadeCrate();
    crate.position.set(-1.4, 6.2, 0);
    I.add(crate);
    refs.nades = crate.userData.nades;

    // Gun rack on the empty driver's door: the weapon in your hands is missing from it.
    const steel = m3('#777', { metalness: 0.8, roughness: 0.3 });
    for (const x of [-3.6, 1.4]) {
      for (const y of [6.7, 5.5, 4.3]) I.add(box(0.4, 0.4, 1.4, steel, x, y, -7.9));
    }
    // (The weapons themselves are hung on these hooks by the cockpit, from your build.)

    // Windshield (cracks get painted onto it in the cockpit view).
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(17, 8.4), new THREE.MeshBasicMaterial({ color: '#9fd3ff', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
    refs.windshield = ws;
    const u = new THREE.Vector3(0, 0, 1), v = new THREE.Vector3(-5.9, 6, 0).normalize(), n = new THREE.Vector3().crossVectors(u, v);
    // ---- Grit: this is a prisoner's death-race car ----
    const rusty = LP.mat('#6b4a32', { metalness: 0.6, roughness: 0.7 });
    const tapeMat = DECALS.mat('tape', { roughness: 1 });
    // Welded roll cage: A-pillar tubes, main hoop behind the seats, diagonal brace, door X-bars.
    const tube = (a, b) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const t = LP.cyl(0.32, 0.32, va.distanceTo(vb), 6, rusty);
      t.position.copy(va).add(vb).multiplyScalar(0.5);
      t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      I.add(t);
    };
    for (const s of [-1, 1]) {
      tube([7.6, 6.8, 7.7 * s], [2.4, 12.1, 7.4 * s]); // along A-pillars
      tube([-5.6, 1.6, 7.6 * s], [-5.6, 12.1, 7.4 * s]); // main hoop legs
      tube([2.4, 12.1, 7.4 * s], [-5.6, 12.1, 7.4 * s]); // roof rails
      tube([-5.6, 12.1, 7.4 * s], [-15.5, 7.4, 7.2 * s]); // rear stays
    }
    tube([-5.6, 12.1, -7.4], [-5.6, 12.1, 7.4]); // hoop top
    tube([-5.8, 12.0, 7.2], [-5.8, 2.0, -7.2]); // diagonal brace behind the seats
    tube([5.5, 6.2, -8.3], [-4.6, 3.2, -8.3]); // driver door X-bars (behind the gun rack)
    tube([5.5, 3.2, -8.3], [-4.6, 6.2, -8.3]);
    // Weld blobs where tubes meet.
    for (const p of [[-5.6, 12.1, 7.4], [-5.6, 12.1, -7.4], [2.4, 12.1, 7.4], [2.4, 12.1, -7.4]]) I.add(LP.mesh(new THREE.IcosahedronGeometry(0.5, 0), rusty, ...p));

    // Bolted steel plate over the passenger door card, with rivets.
    I.add(box(9, 2.8, 0.3, DECALS.mat('rust', { metalness: 0.5, roughness: 0.8 }), -0.6, 3.2, 8.25));
    for (const x of [-4.6, -1.8, 1, 3.6]) for (const y of [2.2, 4.2]) I.add(LP.mesh(new THREE.IcosahedronGeometry(0.16, 0), rusty, x, y, 8.05));

    // Wire mesh over the rear side windows.
    for (const s of [-1, 1]) {
      const mesh = LP.mesh(new THREE.PlaneGeometry(6.5, 4.6), LP.mat('#ffffff', { map: DECALS.get('mesh'), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.5 }), -9.6, 9.4, 8.35 * s);
      I.add(mesh);
    }

    // Shackle bolted to the floor by your feet: ring, chain, ankle cuff.
    const iron = LP.mat('#3a3b3c', { metalness: 0.7, roughness: 0.5 });
    I.add(LP.cyl(0.6, 0.7, 0.3, 6, iron, 2.8, 1.85, 6.4)); // floor plate in your footwell
    const links = 9;
    for (let k = 0; k < links; k++) {
      const t = k / (links - 1);
      const link = LP.mesh(new THREE.TorusGeometry(0.28, 0.08, 4, 6), iron, lerp(2.8, 1.2, t), 2.0 + Math.sin(t * Math.PI) * 0.25, lerp(6.4, 4.5, t));
      link.rotation.set(k % 2 ? Math.PI / 2 : 0, 0.6, 0);
      I.add(link);
    }
    const cuff = LP.mesh(new THREE.TorusGeometry(0.75, 0.2, 4, 8), iron, 0.9, 2.2, 4.2);
    cuff.rotation.set(Math.PI / 2, 0, 0.3);
    I.add(cuff);

    // Dash: crack taped over, scratched tally marks, inmate stencil on the glovebox.
    const crack = LP.mesh(new THREE.PlaneGeometry(4, 2), LP.mat('#ffffff', { map: DECALS.get('crackdash') }), 6.6, 6.82, 3.2);
    crack.rotation.x = -Math.PI / 2;
    crack.rotation.z = 0.2;
    I.add(crack);
    for (const r of [0.6, -0.6]) {
      const strip = box(0.4, 0.06, 2.4, tapeMat, 6.6, 6.86, 3.2);
      strip.rotation.y = r;
      I.add(strip);
    }
    const tally = LP.mesh(new THREE.PlaneGeometry(3, 1.5), LP.mat('#ffffff', { map: DECALS.get('tally', '7') }), 5.2, 6.84, 6.4);
    tally.rotation.x = -Math.PI / 2;
    tally.rotation.z = Math.PI / 2;
    I.add(tally);
    refs.tally = tally;
    const sten = LP.mesh(new THREE.PlaneGeometry(3.0, 1.2), LP.mat('#ffffff', { map: DECALS.get('stencil', '4471') }), 3.9, 4.6, 4.6);
    sten.rotation.y = -Math.PI / 2;
    I.add(sten);

    // Polaroid taped to the passenger sun visor.
    const photo = LP.mesh(new THREE.PlaneGeometry(1.4, 1.4), LP.mat('#ffffff', { map: DECALS.get('photo') }), 1.0, 11.6, 4.4);
    photo.rotation.set(0, -Math.PI / 2, 0.08);
    photo.rotateX(-0.25);
    I.add(photo);
    I.add(box(0.05, 0.25, 0.9, tapeMat, 0.98, 12.3, 4.4));

    // Torn seats: exposed foam and duct-tape patches.
    const foam = LP.mesh(new THREE.PlaneGeometry(2.4, 2.4), LP.mat('#ffffff', { map: DECALS.get('foam') }), -3.75, 8.6, -4.5);
    foam.rotation.y = Math.PI / 2;
    foam.rotation.x = -0.12;
    I.add(foam);
    for (const r of [0.7, -0.7]) {
      const p = box(0.06, 0.45, 2.6, tapeMat, -3.7, 6.4, -4.5);
      p.rotation.x = r;
      I.add(p);
    }
    I.add(box(2.6, 0.06, 0.5, tapeMat, -1.4, 4.45, 4.5)); // your cushion, taped
    I.add(box(0.5, 0.06, 2.4, tapeMat, -2.2, 4.45, 4.0));

    // Tape wrapped around the steering wheel rim.
    for (const a of [0.4, 2.2, 4.0]) wheel.add(box(0.9, 0.75, 0.75, tapeMat, Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0).rotateZ(a + Math.PI / 2));

    // Exposed wiring drooping from under the dash.
    const wireCols = ['#b52b1e', '#d9b52c', '#1a1a1a', '#2b5fae'];
    wireCols.forEach((c, k) => {
      const z = 2.4 + k * 0.35, wm = LP.mat(c);
      I.add(LP.beam([4.0, 3.9, z], [3.0, 2.6 - k * 0.15, z + 0.4], 0.09, wm));
      I.add(LP.beam([3.0, 2.6 - k * 0.15, z + 0.4], [3.7, 1.9, z + 0.9], 0.09, wm));
    });
    I.add(box(0.5, 0.5, 0.5, tapeMat, 3.05, 2.55, 3.3)); // taped splice

    // Floor junk: crushed cans, crumpled paper, a cigarette pack.
    const can = LP.mat('#b8b0a0', { metalness: 0.7, roughness: 0.4 });
    for (const [x, z, r] of [[2.4, -6.4, 0.4], [-6.2, 5.6, 1.6], [-6.4, -2.0, 2.4]]) {
      const c = LP.cyl(0.42, 0.42, 1.2, 6, can, x, 2.05, z);
      c.scale.set(1, 0.55, 1);
      c.rotation.set(Math.PI / 2, r, 0.3);
      I.add(c);
    }
    for (const [x, z, s] of [[-6.6, 1.0, 0.9], [3.4, 7.2, 0.7], [-6.0, -6.4, 1.1]]) {
      I.add(LP.mesh(LP.jitter(new THREE.IcosahedronGeometry(0.5 * s, 0), 0.25, Math.round(x * 10)), LP.mat('#ffffff', { map: DECALS.get('paper') }), x, 2.0, z));
    }
    const pack = box(0.9, 0.35, 0.55, LP.mat('#c23a2a'), 2.8, 5.7, -0.9);
    pack.rotation.y = 0.5;
    I.add(pack);

    // ---- Real-car details ----
    const fabric = m3('#2f2b28'), plastic = m3('#26282b');
    I.add(box(30, 0.3, 16.6, m3('#24211e'), -1, 1.6, 0)); // carpet
    // Gauge cluster behind the wheel, with a hood over it.
    const cluster = LP.mesh(new THREE.PlaneGeometry(3.6, 1.8), DECALS.mat('gauges', { emissive: '#ffffff', emissiveIntensity: 0.25, map: DECALS.get('gauges') }), 4.4, 7.0, -4.5);
    cluster.lookAt(-10, 9.5, -4.5);
    I.add(cluster);
    I.add(box(1.6, 0.4, 4.4, dark, 4.9, 7.95, -4.5)); // cluster hood
    // Air vents.
    for (const z of [-7.2, -1.6, 1.6, 7.2]) {
      const vent = LP.mesh(new THREE.PlaneGeometry(1.6, 0.8), DECALS.mat('vent'), 3.98, 6.0, z);
      vent.rotation.y = -Math.PI / 2;
      I.add(vent);
    }
    // Glovebox seam and latch on the passenger side.
    I.add(box(0.06, 1.5, 4.2, m3('#0e0f10'), 3.98, 4.9, 4.6));
    I.add(box(0.12, 0.3, 0.8, plastic, 3.95, 5.4, 4.6));
    // Sun visors.
    for (const z of [-4.4, 4.4]) {
      const visor = box(2.6, 0.3, 5.4, m3('#4a4740'), 1.6, 12.1, z);
      visor.rotation.z = 0.25;
      I.add(visor);
    }
    // Gear stick and handbrake on the console.
    I.add(box(1.6, 0.5, 1.6, m3('#111111'), 4.6, 5.7, 0)); // gaiter
    I.add(beam([4.6, 5.8, 0], [4.2, 7.4, 0], 0.22, m3('#8a8f94', { metalness: 0.7 })));
    I.add(LP.mesh(new THREE.IcosahedronGeometry(0.42, 0), m3('#111111'), 4.2, 7.5, 0));
    const hb = box(2.6, 0.45, 0.6, plastic, 2.0, 5.85, 0.9);
    hb.rotation.z = 0.25;
    I.add(hb);
    // Seat belt across the empty driver's seat.
    const belt = beam([-4.3, 11.2, -7.2], [-1.2, 4.6, -2.2], 0.12, m3('#161616'));
    belt.scale.x = 4;
    I.add(belt);
    // Door cards: armrest, pull handle, window crank, speaker.
    for (const s of [-1, 1]) {
      const z = 8.45 * s;
      I.add(box(7, 0.6, 0.9, fabric, -2.5, 5.0, z - 0.3 * s)); // armrest
      I.add(box(1.2, 0.3, 0.25, m3('#8a8f94', { metalness: 0.7 }), 2.2, 5.6, z - 0.15 * s)); // handle
      const crank = new THREE.Group();
      crank.position.set(-1, 4.1, z - 0.25 * s);
      crank.add(LP.cyl(0.25, 0.25, 0.3, 6, plastic, 0, 0, 0).rotateX(Math.PI / 2));
      crank.add(box(0.12, 1.1, 0.12, m3('#8a8f94', { metalness: 0.7 }), 0, -0.5, 0));
      I.add(crank);
      I.add(LP.mesh(new THREE.CircleGeometry(0.9, 8), m3('#0e0f10'), 3.8, 2.6, z - 0.42 * s).rotateY(-Math.PI / 2 * s));
    }

    ws.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
    ws.position.set(5.45, 9.6, 0);
    I.add(ws);
    return { group: I, refs };
  },

  // ---------- Scenery ----------

  tree(seed) {
    const g = new THREE.Group();
    g.name = 'tree';
    const rng = mulberry32(seed || 3);
    g.add(LP.cyl(1.6, 2.6, 30, 6, LP.mat('#4e3a28'), 0, 15, 0));
    const b1 = LP.beam([0, 18, 0], [6, 26, 2], 0.9, LP.mat('#4e3a28'));
    const b2 = LP.beam([0, 22, 0], [-5, 29, -2], 0.8, LP.mat('#4e3a28'));
    g.add(b1, b2);
    const leaves = ['#2f5a26', '#36652c', '#2a4f22'];
    const blobs = [[0, 36, 0, 12], [6, 30, 3, 9], [-5, 32, -3, 9], [2, 42, -2, 8], [-2, 27, 4, 7]];
    blobs.forEach(([x, y, z, r], i) => {
      g.add(LP.mesh(LP.jitter(new THREE.IcosahedronGeometry(r, 0), r * 0.35, (seed || 3) * 10 + i), LP.mat(leaves[Math.floor(rng() * 3)]), x, y, z));
    });
    return g;
  },

  pine() {
    const g = new THREE.Group();
    g.name = 'pine';
    g.add(LP.cyl(1.2, 2.0, 16, 6, LP.mat('#3e2c1e'), 0, 8, 0));
    const leaf = LP.mat('#24463a'), snow = LP.mat('#e9eef2');
    const layers = [[14, 12, 10], [12, 11, 18], [10, 10, 25], [7.5, 9, 31], [5, 8, 37]];
    layers.forEach(([r, h, y], i) => {
      g.add(LP.mesh(LP.jitter(new THREE.ConeGeometry(r, h, 7), 1.2, 40 + i), leaf, 0, y, 0));
      g.add(LP.mesh(new THREE.ConeGeometry(r * 0.55, h * 0.35, 7), snow, 0, y + h * 0.33, 0));
    });
    return g;
  },

  cactus() {
    const g = new THREE.Group();
    g.name = 'cactus';
    const green = LP.mat('#4f8a3c');
    g.add(LP.cyl(3.6, 4.2, 34, 6, green, 0, 17, 0));
    g.add(LP.cyl(3.6, 3.6, 2, 6, green, 0, 34.5, 0));
    for (const [s, y, h] of [[1, 14, 12], [-1, 20, 10]]) {
      const elbow = LP.cyl(2.4, 2.4, 7, 6, green, s * 6, y, 0);
      elbow.rotation.z = Math.PI / 2;
      g.add(elbow, LP.cyl(2.4, 2.4, h, 6, green, s * 9, y + h / 2, 0));
    }
    return g;
  },

  rock(seed) {
    const g = new THREE.Group();
    g.name = 'rock';
    const r = LP.mesh(LP.jitter(new THREE.DodecahedronGeometry(12, 0), 5, seed || 11), LP.mat('#a07a4d'), 0, 4, 0);
    r.scale.set(1.3, 0.65, 1);
    g.add(r);
    return g;
  },

  building(seed) {
    const g = new THREE.Group();
    g.name = 'building';
    const rng = mulberry32(seed || 5);
    const h = 70 + rng() * 120;
    g.add(LP.box(50, h, 50, LP.mat('#14121f'), 0, h / 2, 0));
    const neon = rng() < 0.5 ? '#ff2fd0' : '#2ff3ff';
    const winMat = LP.glow('#ffd27a', 0.7);
    for (let y = 12; y < h - 8; y += 14) {
      for (const s of [-1, 1]) {
        if (rng() < 0.75) g.add(LP.box(36, 3, 0.4, winMat, 0, y, 25.2 * s));
        if (rng() < 0.75) g.add(LP.box(0.4, 3, 36, winMat, 25.2 * s, y, 0));
      }
    }
    g.add(LP.box(51, 1.5, 51, LP.glow(neon, 1), 0, h, 0)); // neon roof edge
    g.add(LP.box(20, 8, 1, LP.glow(neon, 1.2), 0, h + 6, 0)); // rooftop sign
    return g;
  },
};

// Turn a multi-part template into instanced meshes, one per part (scenery).
function instanceTemplate(template, transforms) {
  const out = [];
  template.updateMatrixWorld(true);
  const dummy = new THREE.Object3D();
  const tmp = new THREE.Matrix4();
  template.traverse((child) => {
    if (!child.isMesh) return;
    const inst = new THREE.InstancedMesh(child.geometry, child.material, transforms.length);
    transforms.forEach((t, i) => {
      dummy.position.set(t.x, t.y || 0, t.z);
      dummy.rotation.set(0, t.ry || 0, 0);
      dummy.scale.setScalar(t.s || 1);
      dummy.updateMatrix();
      tmp.multiplyMatrices(dummy.matrix, child.matrixWorld);
      inst.setMatrixAt(i, tmp);
    });
    out.push(inst);
  });
  return out;
}
