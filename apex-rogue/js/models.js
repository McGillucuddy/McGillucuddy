'use strict';
// Low-poly model library (Three.js). Flat-shaded, chamfered, few segments.
// World units: a car is 36 long (~4.5m, so 1 unit ~ 12.5cm).
// Car-local axes: +X forward, +Y up, +Z right. Hand-held items point down -Z.

// Eye position in the passenger seat (the driver's seat is empty).
const EYE = { x: -2.6, y: 9.8, z: 4.2 };

const LP = {
  mat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0.05 }, opts));
  },
  glow(color, intensity) {
    return LP.mat(color, { emissive: color, emissiveIntensity: intensity == null ? 0.8 : intensity });
  },
  mesh(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  },
  // Boxes get softly rounded edges (cached per size). Decal-mapped boxes stay sharp so their textures map 1:1.
  box(w, h, d, mat, x, y, z) {
    if (mat && mat.map && !mat.userData.psxTex) return LP.mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
    return LP.mesh(LP.roundBoxGeo(w, h, d), mat, x, y, z);
  },
  _rbCache: new Map(),
  roundBoxGeo(w, h, d, radius) {
    const r = Math.min(radius || Math.min(w, h, d) * 0.22, 0.35);
    const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`;
    let geo = LP._rbCache.get(key);
    if (geo) return geo;
    if (r < 0.015) geo = new THREE.BoxGeometry(w, h, d);
    else {
      const s = new THREE.Shape(), hw = Math.max(0.001, w / 2 - r), hh = Math.max(0.001, h / 2 - r);
      s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.lineTo(-hw, -hh);
      geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 1 });
      geo.translate(0, 0, -Math.max(0.001, d - 2 * r) / 2);
      geo = LP.smooth(geo, 50);
      // Box-style UVs (0..1 across each face direction) so tiling textures behave like on a plain box.
      const pos = geo.attributes.position, nrm = geo.attributes.normal, uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
        const px = pos.getX(i) / w + 0.5, py = pos.getY(i) / h + 0.5, pz = pos.getZ(i) / d + 0.5;
        if (ax >= ay && ax >= az) { uv[i * 2] = pz; uv[i * 2 + 1] = py; } else if (ay >= az) { uv[i * 2] = px; uv[i * 2 + 1] = pz; } else { uv[i * 2] = px; uv[i * 2 + 1] = py; }
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    geo.userData.shared = true;
    LP._rbCache.set(key, geo);
    return geo;
  },
  // Side profile (x forward, y up) extruded across the width, with rounded edges.
  // steps: slices across the width (lets LP.warp bend the shape in plan view).
  side(points, width, mat, bevel, steps) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const b = bevel == null ? 0.5 : bevel;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.01, width - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b,
      bevelSegments: b > 0.02 ? 3 : 1, curveSegments: 1, steps: steps || 1,
    });
    geo.translate(0, 0, -(width - 2 * b) / 2);
    return new THREE.Mesh(LP.smooth(geo), mat);
  },
  // Smooth normals across gentle bends, hard edges kept where faces meet at more than `angle` degrees.
  smooth(geo, angle) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.attributes.position, n = pos.count, cos = Math.cos(((angle || 38) * Math.PI) / 180);
    const fn = new Float32Array(n * 3), a = new THREE.Vector3(), b2 = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i + 2 < n; i += 3) {
      a.fromBufferAttribute(pos, i); b2.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      const f = b2.sub(a).cross(c.sub(a));
      const L = f.length() || 1;
      for (let k = 0; k < 3; k++) fn.set([f.x / L, f.y / L, f.z / L], (i + k) * 3);
    }
    const groups = new Map();
    for (let i = 0; i < n; i++) {
      const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      let l = groups.get(key);
      if (!l) groups.set(key, (l = []));
      l.push(i);
    }
    const out = new Float32Array(n * 3);
    for (const l of groups.values()) {
      for (const i of l) {
        let x = 0, y = 0, z = 0;
        for (const j of l) {
          const d = fn[i * 3] * fn[j * 3] + fn[i * 3 + 1] * fn[j * 3 + 1] + fn[i * 3 + 2] * fn[j * 3 + 2];
          if (d >= cos) { x += fn[j * 3]; y += fn[j * 3 + 1]; z += fn[j * 3 + 2]; }
        }
        const L = Math.hypot(x, y, z) || 1;
        out[i * 3] = x / L; out[i * 3 + 1] = y / L; out[i * 3 + 2] = z / L;
      }
    }
    g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
    return g;
  },
  // Smooth round rod along a curve through points (trigger guards, hoses, bent wire).
  path(points, r, mat, closed) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), !!closed, 'centripetal');
    return new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 8, r, 10, !!closed), mat);
  },
  // Rounded box (extruded rounded rectangle with rounded edges): fingers, grips, soft parts.
  rbox(w, h, d, r, mat, x, y, z) {
    r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
    const s = new THREE.Shape(), hw = w / 2 - r, hh = h / 2 - r;
    s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.lineTo(-hw, -hh);
    const geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 4 });
    geo.translate(0, 0, -(d - 2 * r) / 2);
    return LP.mesh(LP.smooth(geo, 50), mat, x, y, z);
  },
  // Same, but for hand-held items: profile u = forward, v = up; result points down -Z.
  sideZ(points, width, mat, bevel) {
    // Softly round every corner of the outline (closed-loop corner cutting) so stocks and grips aren't knife-edged.
    if (points.length >= 4) {
      const out = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
        out.push([x1 + (x2 - x1) * 0.14, y1 + (y2 - y1) * 0.14], [x1 + (x2 - x1) * 0.86, y1 + (y2 - y1) * 0.86]);
      }
      points = out;
    }
    const m = LP.side(points, width, mat, bevel);
    m.geometry.rotateY(Math.PI / 2);
    return m;
  },
  // A box stretched between two points (pillars, struts).
  beam(a, b, thick, mat) {
    const va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
    const m = new THREE.Mesh(LP.roundBoxGeo(thick, thick, va.distanceTo(vb)), mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.lookAt(vb);
    return m;
  },
  // A round tube between two points (cages, bars).
  tube(a, b, r, mat) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 14), mat);
    t.position.copy(va).add(vb).multiplyScalar(0.5);
    t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return t;
  },
  cyl(rTop, rBot, h, seg, mat, x, y, z) {
    // Round things stay round: at least 18 sides, whatever the model asked for.
    return LP.mesh(new THREE.CylinderGeometry(rTop, rBot, h, Math.max(18, seg || 0)), mat, x, y, z);
  },
  // Round part turned on a lathe around the Z axis (barrels, tubes, warheads): profile is [[radius, z], ...].
  lathe(profile, seg, mat, x, y, z) {
    // Faces point outward only when the profile runs towards +Z, so flip it if it was drawn the other way.
    if (profile[0][1] > profile[profile.length - 1][1]) profile = profile.slice().reverse();
    const geo = new THREE.LatheGeometry(profile.map(([r, zz]) => new THREE.Vector2(Math.max(0.001, r), zz)), Math.max(20, seg || 0));
    geo.rotateX(Math.PI / 2);
    return LP.mesh(geo, mat, x, y, z);
  },
  // Bake each mesh's transform into its geometry, then move every vertex with fn(v) (in the parent's space).
  // Used to give extruded bodies rounded corners and a glasshouse that leans in.
  warp(meshes, fn) {
    const v = new THREE.Vector3();
    for (const m of meshes) {
      m.updateMatrix();
      let geo = m.geometry.clone();
      geo.applyMatrix4(m.matrix);
      if (geo.index) geo = geo.toNonIndexed();
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); fn(v); pos.setXYZ(i, v.x, v.y, v.z); }
      m.geometry = LP.smooth(geo);
      m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    }
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

// Gun surfaces: near-white detail maps multiplied with each material's colour (so gun finishes still recolour them).
const GUNTEX = {
  cache: {},
  get(kind) {
    if (this.cache[kind]) return this.cache[kind];
    const S = 128, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d'), rng = mulberry32(kind.length * 131 + 7);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
    if (kind === 'wood') {
      // Long grain running along the stock, a few darker streaks and a knot.
      for (let y = 0; y < S; y++) {
        const v = 0.86 + 0.08 * Math.sin(y * 0.55 + Math.sin(y * 0.09) * 4) + (rng() - 0.5) * 0.04;
        const k = Math.round(v * 255); g.fillStyle = `rgb(${k},${Math.round(k * 0.96)},${Math.round(k * 0.9)})`; g.fillRect(0, y, S, 1);
      }
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = `rgba(60,30,10,${0.12 + rng() * 0.15})`; g.lineWidth = 1;
        let y = rng() * S; g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= S; x += 16) { y += (rng() - 0.5) * 3; g.lineTo(x, y); }
        g.stroke();
      }
      g.strokeStyle = 'rgba(60,30,10,0.3)';
      for (let r = 2; r < 9; r += 2) { g.beginPath(); g.ellipse(80, 60, r * 2.2, r * 0.8, 0, 0, TAU); g.stroke(); }
    } else if (kind === 'steel') {
      // Blued / parkerised steel: fine speckle and faint machining lines.
      for (let k = 0; k < 2600; k++) { const v = 215 + Math.floor(rng() * 40); g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(rng() * S, rng() * S, 1, 1); }
      g.fillStyle = 'rgba(255,255,255,0.25)'; for (let y = 0; y < S; y += 3) g.fillRect(0, y, S, 1);
    } else if (kind === 'polymer') {
      // Stippled grip texture.
      g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
      for (let k = 0; k < 1400; k++) { g.fillStyle = rng() < 0.5 ? '#ffffff' : '#bdbdbd'; g.beginPath(); g.arc(rng() * S, rng() * S, 0.9 + rng(), 0, TAU); g.fill(); }
    } else if (kind === 'checker') {
      // Checkering on grips and pumps.
      g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, S, S);
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      for (let i = -S; i < S * 2; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); g.beginPath(); g.moveTo(i, S); g.lineTo(i + S, 0); g.stroke(); }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(0.35, 0.35);
    tex.magFilter = THREE.NearestFilter;
    this.cache[kind] = tex;
    return tex;
  },
  // Gun materials: steel, worn steel edges, polymer, wood, checkered wood.
  mats(colors) {
    const c = Object.assign({ steel: '#2b2d30', worn: '#4a4d52', poly: '#1c1d1f', wood: '#6e4526' }, colors);
    return {
      steel: LP.mat(c.steel, { map: this.get('steel'), metalness: 0.65, roughness: 0.42 }),
      worn: LP.mat(c.worn, { map: this.get('steel'), metalness: 0.8, roughness: 0.3 }),
      poly: LP.mat(c.poly, { map: this.get('polymer'), roughness: 0.85 }),
      wood: LP.mat(c.wood, { map: this.get('wood'), roughness: 0.6 }),
      checker: LP.mat(c.wood, { map: this.get('checker'), roughness: 0.7 }),
      hole: LP.mat('#050505', { roughness: 1 }),
    };
  },
  // Small round hardware: screws and pins, seen side-on on a gun (axis along X).
  screw(mat, x, y, z, r) {
    const m = LP.cyl(r || 0.09, r || 0.09, 0.06, 12, mat, x, y, z);
    m.rotation.z = Math.PI / 2;
    return m;
  },
};

// Small hand-made decal textures (grille, lenses, plates, rims, gauges...). Always on: they are part of the model.
const DECALS = {
  cache: {},
  get(kind, arg) {
    const key = kind + (arg || '');
    if (this.cache[key]) return this.cache[key];
    const size = { plate: [64, 24], grille: [64, 24], gauges: [64, 32], vent: [32, 16], stencil: [48, 28], flames: [64, 24] }[kind] || [32, 32];
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
      const v = arg || 'spoke5';
      const metal = v === 'black' ? '#2c2e31' : v === 'steel' ? '#7a7f84' : '#9ea4aa';
      g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, W, H);
      g.fillStyle = metal; g.beginPath(); g.arc(16, 16, 15, 0, TAU); g.fill();
      g.fillStyle = '#1e2022';
      if (v === 'steel') {
        for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.beginPath(); g.arc(16 + Math.cos(a) * 9.5, 16 + Math.sin(a) * 9.5, 2.2, 0, TAU); g.fill(); }
        g.fillStyle = '#b8bdc2'; g.beginPath(); g.arc(16, 16, 6, 0, TAU); g.fill();
      } else if (v === 'slotted') {
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; g.save(); g.translate(16, 16); g.rotate(a); g.fillRect(5, -1.6, 8, 3.2); g.restore(); }
      } else if (v === 'wire') {
        g.strokeStyle = '#d8dde2'; g.lineWidth = 1;
        g.fillStyle = '#30332f'; g.beginPath(); g.arc(16, 16, 13, 0, TAU); g.fill();
        for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; g.beginPath(); g.moveTo(16 + Math.cos(a) * 3, 16 + Math.sin(a) * 3); g.lineTo(16 + Math.cos(a + 0.5) * 13, 16 + Math.sin(a + 0.5) * 13); g.stroke(); }
        g.strokeStyle = metal; g.lineWidth = 2; g.beginPath(); g.arc(16, 16, 14, 0, TAU); g.stroke();
      } else {
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU + 0.3;
          g.beginPath(); g.moveTo(16, 16);
          g.arc(16, 16, 13, a, a + 0.75); g.fill();
        }
      }
      g.fillStyle = v === 'black' ? '#4a4d50' : '#c4c9ce'; g.beginPath(); g.arc(16, 16, 4, 0, TAU); g.fill();
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
    } else if (kind === 'number') {
      // arg = "style:number". Spray stencil with drips, or a white racing roundel.
      const [style, num] = (arg || 'stencil:47').split(':');
      g.clearRect(0, 0, W, H);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (style === 'roundel') {
        g.fillStyle = '#ece6d6'; g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 1, 0, TAU); g.fill();
        g.fillStyle = '#141414'; g.font = 'bold 20px monospace'; g.fillText(num, W / 2, H / 2 + 1);
      } else {
        g.fillStyle = 'rgba(236,230,214,0.92)'; g.font = 'bold 24px monospace'; g.fillText(num, W / 2, H / 2);
        for (let k = 0; k < 5; k++) g.fillRect(6 + Math.random() * (W - 12), H / 2 + 8, 1, 2 + Math.random() * 7); // drips
        g.fillStyle = 'rgba(0,0,0,0.35)';
        for (let k = 0; k < 10; k++) g.fillRect(Math.random() * W, Math.random() * H, 2, 1); // flaking
      }
    } else if (kind === 'flames') {
      g.clearRect(0, 0, W, H);
      for (const [col, sc] of [['#c2361a', 1], ['#e8871e', 0.72], ['#f2cf3a', 0.45]]) {
        g.fillStyle = col;
        g.beginPath(); g.moveTo(0, H * 0.5 - H * 0.4 * sc);
        for (let k = 0; k <= 5; k++) { const x = (k / 5) * W * (0.6 + 0.4 * sc); g.quadraticCurveTo(x + 3, H * 0.5 - (k % 2 ? 2 : H * 0.35) * sc, x + 6, H * 0.5); }
        g.lineTo(0, H * 0.5 + H * 0.4 * sc); g.closePath(); g.fill();
      }
    } else if (kind === 'skull') {
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#ece6d6';
      g.beginPath(); g.arc(16, 13, 10, 0, TAU); g.fill(); g.fillRect(10, 18, 12, 8);
      g.fillStyle = '#141414';
      g.beginPath(); g.arc(12, 13, 3, 0, TAU); g.arc(20, 13, 3, 0, TAU); g.fill();
      g.fillRect(15, 17, 2, 3); for (let x = 11; x < 22; x += 3) g.fillRect(x, 23, 1, 3);
    } else if (kind === 'tartan') {
      g.fillStyle = '#7a1c1c'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(20,40,20,0.6)'; for (let k = 0; k < W; k += 16) { g.fillRect(k, 0, 6, H); g.fillRect(0, k, W, 6); }
      g.fillStyle = 'rgba(230,200,90,0.7)'; for (let k = 10; k < W; k += 16) { g.fillRect(k, 0, 1, H); g.fillRect(0, k, W, 1); }
    } else if (kind === 'beads') {
      g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, W, H);
      for (let y = 2; y < H; y += 4) for (let x = (y % 8 ? 2 : 4); x < W; x += 4) { g.fillStyle = (x + y) % 3 ? '#b8946a' : '#8a6a44'; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
    } else if (kind === 'leopard') {
      g.fillStyle = '#c99a4a'; g.fillRect(0, 0, W, H);
      const r = mulberry32(7);
      for (let k = 0; k < 14; k++) {
        const x = r() * W, y = r() * H;
        g.fillStyle = '#1a120a'; g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill();
        g.fillStyle = '#8a5a24'; g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill();
      }
    } else if (kind === 'fur') {
      g.fillStyle = arg || '#d86aa8'; g.fillRect(0, 0, W, H);
      const r = mulberry32(3);
      for (let k = 0; k < 120; k++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'; g.fillRect(r() * W, r() * H, 1, 2); }
    } else if (kind === 'camo') {
      g.fillStyle = '#5a6040'; g.fillRect(0, 0, W, H);
      const r = mulberry32(11), cols = ['#3a3a26', '#7a6a48', '#262a1c'];
      for (let k = 0; k < 16; k++) { g.fillStyle = cols[k % 3]; g.beginPath(); g.ellipse(r() * W, r() * H, 3 + r() * 5, 2 + r() * 3, r() * 3, 0, TAU); g.fill(); }
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
    tex.minFilter = THREE.LinearMipmapLinearFilter;
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
    kit: { bumper: 'none', roof: 'none', spoiler: 'lip' },
    extras() {},
  },
  // Brick: a boxy 80s estate car with a bull bar and roof rails.
  brick: {
    top: [[18.4, 1.9], [18.6, 5.2], [17.6, 6.5], [9, 7.3], [-17.2, 7.7], [-17.9, 6.8], [-18, 2.1]],
    cabin: [[9, 7.4], [4.8, 12], [-16.4, 12], [-17.4, 7.8]], cabinW: 15, bodyW: 16.5,
    wheels: [11.4, -11], wheelR: 3, wheelZ: 7.4,
    lightY: 4.7, tailY: 6.4, frontPlateY: 2.6, rearPlateY: 4.6, mirrorX: 8.2, mirrorY: 8.2,
    bPillar: -1.2, seams: [7.4, -3.4, -11.5], cPillar: [[-10.6, 7.8], [-10.6, 12], [-11.6, 12], [-11.6, 7.8]],
    kit: { bumper: 'bullbar', roof: 'rails', spoiler: 'none' },
    extras() {},
  },
  // Wasp: a hot hatch.
  wasp: {
    top: [[16.9, 1.8], [17.3, 4.2], [16.3, 5.4], [7.2, 6.4], [-13.6, 6.9], [-14.4, 6.2], [-14.6, 2]],
    cabin: [[7.1, 6.5], [1.4, 10.4], [-10.8, 10.3], [-13.9, 7]], cabinW: 13.6, bodyW: 15,
    wheels: [10.4, -9.6], wheelR: 2.6, wheelZ: 6.8,
    lightY: 4, tailY: 5.4, frontPlateY: 2.4, rearPlateY: 3.8, mirrorX: 6.4, mirrorY: 7.3,
    bPillar: -2.4, seams: [5.6, -5.4], cPillar: [[-7.6, 6.9], [-9.2, 10.3], [-10.8, 10.3], [-13.9, 7]],
    kit: { bumper: 'none', roof: 'none', spoiler: 'roofspoiler' },
    extras(g, m) {
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
    kit: { bumper: 'none', roof: 'none', spoiler: 'ducktail' },
    extras(g, m) {
      g.add(LP.side([[13, 6.5], [7.5, 7], [7.2, 7.8], [10.5, 7.8]], 4, m.dark, 0.15)); // hood scoop
    },
  },
};

// Chaikin corner cutting: rounds a polyline's corners (ends stay put).
function chaikin(pts, iters, cut) {
  let p = pts;
  for (let k = 0; k < (iters || 2); k++) {
    const out = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [x1, y1] = p[i], [x2, y2] = p[i + 1], q = cut || 0.25;
      out.push([x1 + (x2 - x1) * q, y1 + (y2 - y1) * q], [x1 + (x2 - x1) * (1 - q), y1 + (y2 - y1) * (1 - q)]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

// Full body outline: the (rounded) top chain plus a bottom edge with proper wheel arches.
function bodyOutline(st) {
  const [wf, wr] = st.wheels, R = st.wheelR + 0.75, cy = st.wheelR - 0.2;
  const rearX = st.top[st.top.length - 1][0], frontX = st.top[0][0];
  return [
    ...chaikin(st.top, 2, 0.22),
    [rearX + 2.2, 1.5],
    ...archPts(wr, cy, R, 14),
    [wr + R + 0.2, 1.3], [wf - R - 0.2, 1.3],
    ...archPts(wf, cy, R, 14),
    [frontX - 2.2, 1.5],
  ].map(([x, y]) => [x, y]);
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
function bakeGrime(root, height, strength) {
  const amt = 0.45 * (strength == null ? 1 : strength);
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noGrime) return;
    if (o.geometry.userData.shared) o.geometry = o.geometry.clone(); // cached shapes are shared; grime is per mesh
    const geo = o.geometry, pos = geo.attributes.position;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      const t = clamp(v.y / height, 0, 1);
      const k = Math.max(0.2, 1 - amt * (1 - t * t * (3 - 2 * t))); // smoothstep: dark at the sills, clean up top
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
    const finish = opts.finish || 'gloss';
    const body = LP.mat(paint, finish === 'gloss' ? { metalness: 0.35, roughness: 0.4 } : { metalness: 0.05, roughness: 0.95 });
    const dark = LP.mat('#1b1c1e', { roughness: 0.9 });
    const chrome = LP.mat('#a7adb3', { metalness: 0.8, roughness: 0.3 });
    const glass = DECALS.mat('glass', { metalness: 0.4, roughness: 0.2 });
    const paint2 = new THREE.Color(opts.paint2 || '#2a2a2e').lerp(new THREE.Color('#77736a'), 0.18);
    const body2 = LP.mat(paint2, finish === 'gloss' ? { metalness: 0.35, roughness: 0.4 } : { metalness: 0.05, roughness: 0.95 });
    const roofMat = opts.twoTone === 'roof' ? body2 : body;
    g.userData.bodyMat = body;
    const W = opts.shell ? 18 : st.bodyW, hw = W / 2;
    const bev = 0.5;

    if (opts.shell) {
      const [front, rear] = shellProfiles(st, 8.5, -12.5);
      g.add(LP.side(front, W, body, bev), LP.side(rear, W, body, bev));
    } else {
      const shell = LP.side(bodyOutline(st), W, body, bev, 8);
      g.add(shell);
      // Round the body off: corners pulled in towards the nose and tail, a softened shoulder along the top.
      const [wf, wr] = st.wheels, ar = st.wheelR + 0.75, fX = st.top[0][0], rX = st.top[st.top.length - 1][0];
      const belt = st.cabin[0][1];
      LP.warp([shell], (v) => {
        const tf = clamp((v.x - (wf + ar * 0.4)) / (fX - wf - ar * 0.4), 0, 1), tr = clamp(((wr - ar * 0.4) - v.x) / (wr - ar * 0.4 - rX), 0, 1);
        let k = 1 - 0.11 * tf * tf - 0.08 * tr * tr;
        k -= 0.035 * clamp((v.y - (belt - 0.6)) / 0.8, 0, 1); // shoulder
        k -= 0.03 * clamp((2.2 - v.y) / 1.0, 0, 1); // sills tuck under
        v.z *= k;
        // Corners rounded in plan view: the outer edges of the nose and tail sweep back.
        const e = Math.pow(Math.abs(v.z) / (W / 2 + bev), 3);
        v.x -= 1.8 * e * clamp((v.x - (fX - 4)) / 4, 0, 1);
        v.x += 1.4 * e * clamp(((rX + 4) - v.x) / 4, 0, 1);
      });
      // Glasshouse: tinted glass, roof skin, pillars, window trim; it leans in as it rises (tumblehome).
      const cab = st.cabin, cw = st.cabinW;
      const house = [LP.side(cab, cw, glass, 0.25)];
      const roofY = cab[1][1];
      house.push(LP.side([[cab[1][0] - 0.2, roofY - 0.2], [cab[2][0] + 0.2, roofY - 0.2], [cab[2][0], roofY + 0.35], [cab[1][0] - 0.3, roofY + 0.35]], cw + 0.3, roofMat, 0.1));
      for (const s of [-1, 1]) {
        const z = (cw / 2 + 0.1) * s;
        house.push(LP.beam([cab[0][0], cab[0][1], z], [cab[1][0], cab[1][1], z], 0.55, roofMat)); // A-pillar
        house.push(LP.box(0.9, roofY - cab[0][1] + 0.1, 0.4, roofMat, st.bPillar, (roofY + cab[0][1]) / 2, z)); // B-pillar
        house.push(LP.side(st.cPillar, 0.45, roofMat, 0.05).translateZ(z)); // C-pillar
        house.push(LP.beam([cab[0][0] - 0.4, belt + 0.12, (cw / 2 + 0.12) * s], [cab[cab.length - 1][0] + 0.4, belt + 0.12, (cw / 2 + 0.12) * s], 0.22, chrome)); // belt trim
        house.push(LP.beam([cab[1][0] - 0.2, roofY - 0.05, (cw / 2 + 0.16) * s], [cab[2][0] + 0.3, roofY - 0.05, (cw / 2 + 0.16) * s], 0.2, dark)); // drip rail
      }
      LP.warp(house, (v) => { v.z *= 1 - 0.15 * clamp((v.y - belt) / (roofY - belt), 0, 1); });
      g.add(...house);
      // Wipers at the base of the windscreen.
      for (const z of [-3.2, 1.6]) {
        const wpr = LP.beam([cab[0][0] - 0.2, belt + 0.25, z], [cab[0][0] - 1.6, belt + 1.1, z + 3.4], 0.15, dark);
        g.add(wpr);
      }
    }

    // Front: bumper, grille, headlights, plate. Rear: bumper, tail lights, plate, exhaust.
    const fx = st.top[0][0] + bev, rx = st.top[st.top.length - 1][0] - bev;
    // Bumpers follow the rounded corners in plan view: a slab with chamfered ends.
    const bumperSlab = (x0, x1, y, h, half, mat) => {
      const dir = Math.sign(x1 - x0), cut = 1.3;
      const pts = [[x0, -half], [x1 - dir * 0.3, -(half - cut)], [x1, -(half - cut - 0.4)], [x1, half - cut - 0.4], [x1 - dir * 0.3, half - cut], [x0, half]];
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3 });
      geo.rotateX(-Math.PI / 2);
      return LP.mesh(LP.smooth(geo), mat, 0, y, 0);
    };
    g.add(bumperSlab(fx - 0.6, fx + 0.85, 1.65, 1.3, (W / 2 - 0.3) * 0.9, dark));
    g.add(bumperSlab(rx + 0.6, rx - 0.85, 1.75, 1.3, (W / 2 - 0.3) * 0.93, dark));
    const grille = LP.box(0.2, 1.3, 6, DECALS.mat('grille'), fx + 0.35, st.lightY - 0.2, 0);
    grille.userData.noGrime = true;
    g.add(grille);
    // Light positions follow the rounded nose/tail (the corners are pulled in).
    const hz = (hw - 2.3) * 0.93, tz = (hw - 2.4) * 0.95;
    for (const s of [-1, 1]) {
      g.add(LP.box(0.4, 1.5, 3.3, chrome, fx - 0.05, st.lightY, hz * s)); // bezel
      const hl = LP.box(0.3, 1.1, 2.8, DECALS.mat('headlight', { emissive: '#fff3c8', emissiveIntensity: 0.35 }), fx + 0.12, st.lightY, hz * s);
      const ind = LP.box(0.3, 0.5, 0.9, LP.glow('#ff9a1a', 0.35), fx + 0.1, st.lightY - 1.05, (hz + 0.9) * s); // indicator
      const tl = LP.box(0.3, 1.0, 3.2, DECALS.mat('taillight', { emissive: '#ff2a1a', emissiveIntensity: 0.25 }), rx - 0.2, st.tailY, tz * s);
      const wrap = LP.box(1.4, 0.9, 0.2, DECALS.mat('taillight', { emissive: '#ff2a1a', emissiveIntensity: 0.2 }), rx + 0.6, st.tailY, (hw * 0.93 + bev - 0.05) * s); // wraps round the corner
      hl.userData.noGrime = tl.userData.noGrime = ind.userData.noGrime = wrap.userData.noGrime = true;
      g.add(hl, ind, tl, wrap);
    }
    g.add(LP.box(0.6, 0.8, 7, DECALS.mat('grille'), fx + 0.55, 2.2, 0)); // lower intake
    g.add(LP.box(0.5, 0.5, W - 2.4, dark, rx - 0.5, 1.4, 0)); // rear valance
    const plate = opts.plate || 'APX ' + (100 + Math.floor(paint.r * 899));
    g.add(LP.box(0.12, 1.0, 2.6, DECALS.mat('plate', {}, plate), fx + 0.85, st.frontPlateY, 0));
    g.add(LP.box(0.12, 1.0, 2.6, DECALS.mat('plate', {}, plate), rx - 0.85, st.rearPlateY, 0));

    // Sides: door seams and handles, mirrors.
    if (!opts.shell) {
      for (const s of [-1, 1]) {
        const z = (hw + bev + 0.02) * s;
        for (const x of st.seams) g.add(LP.box(0.12, 5, 0.06, dark, x, 4.1, z));
        g.add(LP.box(0.9, 0.25, 0.12, chrome, st.seams[st.seams.length - 1] + 1.2, 6.0, z));
        // Wheel-arch flares and a side skirt between them.
        const ar = st.wheelR + 0.75, cy = st.wheelR - 0.2;
        for (const wc of st.wheels) {
          const band = [...archPts(wc, cy, ar + 0.55, 16), ...archPts(wc, cy, ar - 0.05, 16).reverse()];
          g.add(LP.side(band, 0.5, body, 0.08).translateZ((hw * (wc > 0 ? 0.985 : 0.99) + bev - 0.12) * s));
        }
        const sx0 = st.wheels[1] + ar + 0.4, sx1 = st.wheels[0] - ar - 0.4;
        g.add(LP.box(sx1 - sx0, 0.7, 0.5, dark, (sx0 + sx1) / 2, 1.75, (hw * 0.97 + bev - 0.05) * s));
        if (s > 0) g.add(LP.mesh(new THREE.CircleGeometry(0.55, 8), chrome, st.wheels[1] + ar + 1.6, 5.4, z + 0.02)); // fuel cap
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
        const R = st.wheelR;
        // Tyre with rounded shoulders and sidewalls, turned on a lathe.
        const t = LP.lathe([[R * 0.66, -1.15], [R * 0.9, -1.15], [R - 0.12, -0.95], [R, -0.55], [R, 0.55], [R - 0.12, 0.95], [R * 0.9, 1.15], [R * 0.66, 1.15]], 28, tyre);
        // Rim dished in from the sidewall, with a brake disc behind the spokes.
        const dish = LP.lathe([[R * 0.66, 1.12 * s], [R * 0.6, 0.85 * s], [R * 0.22, 0.75 * s]], 16, LP.mat('#2a2c2e', { metalness: 0.6, roughness: 0.5 }));
        const disc = LP.cyl(R * 0.48, R * 0.48, 0.25, 14, LP.mat('#6a6c6e', { metalness: 0.7, roughness: 0.4 }), 0, 0, 0.55 * s).rotateX(Math.PI / 2);
        const rim = LP.mesh(new THREE.CircleGeometry(R * 0.64, 28), DECALS.mat('rim', { metalness: 0.5, roughness: 0.4 }, opts.rims || 'spoke5'), 0, 0, 0.98 * s);
        if (s < 0) rim.rotation.y = Math.PI;
        rim.userData.noGrime = true;
        w.add(t, dish, disc, rim);
        w.position.set(x, st.wheelR, st.wheelZ * s);
        g.add(w);
        g.userData.wheels.push(w);
      }
    }
    st.extras(g, { body, dark, chrome }, st);
    Models.bodyKit(g, st, opts, { body, body2, dark, chrome }, W, bev, fx, rx);
    Models.livery(g, st, opts, W, bev);

    if (opts.weapon === 'rocket') {
      const pod = Models.rocketPod();
      pod.position.set(st.cabin[1][0] - 4.2, st.cabin[1][1] + 0.35, 0);
      g.add(pod);
    } else if (opts.weapon === 'gun') {
      // Gunner: a passenger leaning out of the window with a rifle.
      const z = W / 2 + 0.2, y = st.cabin[1][1] - 1.6, x = st.cabin[1][0] - 2;
      g.add(LP.box(1.4, 1.6, 1.2, LP.mat('#d96a1e'), x, y, z)); // arm in a prison jumpsuit
      g.add(LP.box(5.5, 0.5, 0.5, LP.mat('#1a1b1d', { metalness: 0.6 }), x + 2.6, y + 0.6, z + 0.5));
      g.add(LP.box(1.2, 0.9, 0.5, LP.mat('#3a2a1a'), x - 0.4, y + 0.3, z + 0.5));
    } else if (opts.weapon === 'mine') {
      const d = Models.mineDropper();
      d.position.set(rx - 0.6, 0, 0);
      g.add(d);
    }
    bakeGrime(g, 9, { clean: 0.35, dirty: 1, filthy: 1.6 }[opts.grime || 'dirty']);
    if (opts.underglow) {
      // Neon underglow: an additive glow pad under the car.
      const L = Math.abs(fx - rx);
      for (const [sc, op] of [[1, 0.55], [1.35, 0.2]]) {
        const pad = LP.mesh(new THREE.PlaneGeometry((L - 4) * sc, (W - 2) * sc).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: opts.underglow, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }), (fx + rx) / 2, 0.25, 0);
        pad.userData.noGrime = true;
        g.add(pad);
      }
    }
    return g;
  },

  // Bolt-ons: bumpers, roof gear, spoilers, exhausts, two-tone panels, mud.
  bodyKit(g, st, opts, m, W, bev, fx, rx) {
    const hw = W / 2;
    const steel = LP.mat('#8a8f94', { metalness: 0.7, roughness: 0.4 });
    const rusty = LP.mat('#6b4a32', { metalness: 0.6, roughness: 0.75 });
    const pickKit = (k) => (opts[k] && opts[k] !== 'stock' ? opts[k] : st.kit[k]);
    const [xd, yd] = st.top[st.top.length - 3]; // rear deck
    const cab = st.cabin, cw = st.cabinW, roofTop = cab[1][1] + 0.35;

    // Bumper
    const bumper = pickKit('bumper');
    if (bumper === 'bullbar') {
      for (const s of [-1, 1]) g.add(LP.box(0.7, 5.2, 0.7, steel, fx + 1.3, 3.8, 5 * s));
      g.add(LP.box(0.7, 0.7, 12, steel, fx + 1.3, st.lightY + 1.4, 0));
      g.add(LP.box(0.7, 0.7, 12, steel, fx + 1.3, 3.6, 0));
    } else if (bumper === 'pushbar') {
      for (const s of [-1, 1]) g.add(LP.box(0.6, 4.6, 0.6, m.dark, fx + 1.1, 3.4, 2.4 * s));
      g.add(LP.box(0.9, 3, 6.2, LP.mat('#111', { roughness: 1 }), fx + 1.5, 3.4, 0));
      g.add(LP.box(0.6, 0.6, 6.4, m.dark, fx + 1.1, 5.4, 0));
    } else if (bumper === 'plow') {
      g.add(LP.side([[fx + 0.3, 0.6], [fx + 4.4, 0.6], [fx + 1.0, st.lightY + 0.6], [fx + 0.3, st.lightY + 0.6]], W + 1, rusty, 0.1));
      for (const z of [-4, 0, 4]) g.add(LP.side([[fx + 0.5, 0.7], [fx + 4.6, 0.7], [fx + 1.2, st.lightY + 0.5]], 0.3, steel, 0).translateZ(z));
    }

    // Roof
    const roof = opts.shell ? 'none' : pickKit('roof');
    const rx0 = cab[2][0] + 0.6, rx1 = cab[1][0] - 0.6, rlen = rx1 - rx0, rmid = (rx0 + rx1) / 2;
    if (roof === 'rails' || roof === 'rack') {
      for (const s of [-1, 1]) {
        g.add(LP.box(rlen, 0.4, 0.5, m.dark, rmid, roofTop + 0.55, (cw / 2 - 0.7) * s));
        for (const x of [rx0 + 0.4, rx1 - 0.4]) g.add(LP.box(0.6, 0.6, 0.6, m.dark, x, roofTop + 0.25, (cw / 2 - 0.7) * s));
      }
    }
    if (roof === 'rack') {
      for (const x of [rx0 + 1.5, rmid, rx1 - 1.5]) g.add(LP.box(0.4, 0.35, cw - 1.2, m.dark, x, roofTop + 0.8, 0));
      const spare = LP.cyl(2.3, 2.3, 1.2, 12, LP.mat('#151515', { roughness: 1 }), rmid - 2, roofTop + 1.6, -1.6);
      g.add(spare);
      g.add(LP.box(2.2, 1.4, 1.2, LP.mat('#4b5a2e'), rmid + 2.6, roofTop + 1.7, 2.4)); // jerrycan
      g.add(LP.box(2.6, 1.1, 2.4, LP.mat('#5a4a32', { roughness: 1 }), rmid + 2.2, roofTop + 1.5, -0.6)); // tarp bundle
    } else if (roof === 'lightbar') {
      g.add(LP.box(1.0, 0.7, cw - 1.5, m.dark, rx1 - 0.8, roofTop + 0.6, 0));
      [-4.2, -1.4, 1.4, 4.2].forEach((z, i) => g.add(LP.box(0.35, 0.55, 1.6, LP.glow(i % 3 === 0 ? '#ffb000' : '#fff6d8', 0.9), rx1 - 0.25, roofTop + 0.62, z)));
      for (const s of [-1, 1]) g.add(LP.box(0.5, 0.6, 0.5, m.dark, rx1 - 0.8, roofTop + 0.2, (cw / 2 - 1.5) * s));
    } else if (roof === 'cage') {
      const r = 0.32;
      for (const x of [rx1, rx0]) {
        for (const s of [-1, 1]) g.add(LP.tube([x, 6.6, (hw + 0.5) * s], [x, roofTop + 1.1, (cw / 2 + 0.2) * s], r, rusty));
        g.add(LP.tube([x, roofTop + 1.1, -cw / 2 - 0.2], [x, roofTop + 1.1, cw / 2 + 0.2], r, rusty));
      }
      for (const s of [-1, 1]) {
        g.add(LP.tube([rx0, roofTop + 1.1, (cw / 2 + 0.2) * s], [rx1, roofTop + 1.1, (cw / 2 + 0.2) * s], r, rusty));
        g.add(LP.tube([rx1, roofTop + 1.1, (cw / 2 + 0.2) * s], [fx - 1.5, st.lightY + 1.2, (hw - 1.2) * s], r, rusty)); // down to the front
      }
    }

    // Spoiler
    const spoiler = pickKit('spoiler');
    if (spoiler === 'lip') {
      g.add(LP.side([[xd + 0.8, yd + 0.5], [xd + 3.7, yd + 0.7], [xd + 3.7, yd + 1.0], [xd + 0.4, yd + 0.9]], W - 2, m.body, 0.1));
    } else if (spoiler === 'roofspoiler' && !opts.shell) {
      const [x2, y2] = cab[2];
      g.add(LP.side([[x2 + 1.2, y2 + 0.3], [x2 - 3.6, y2 - 0.1], [x2 - 3.8, y2 - 0.7], [x2 + 0.4, y2 - 0.1]], cw - 0.6, m.body, 0.1));
    } else if (spoiler === 'ducktail') {
      g.add(LP.side([[xd + 1.9, yd + 0.4], [xd - 0.2, yd + 0.6], [xd - 0.4, yd + 1.2], [xd + 1.4, yd + 1.0]], W - 1.5, m.body, 0.1));
    } else if (spoiler === 'wing') {
      g.add(LP.box(3.2, 0.5, W + 0.8, m.body, xd + 1.4, yd + 3.0, 0));
      for (const s of [-1, 1]) g.add(LP.box(1, 2.6, 0.6, m.dark, xd + 1.8, yd + 1.6, (hw - 3) * s));
    } else if (spoiler === 'bigwing') {
      g.add(LP.side([[xd + 0.4, yd + 5.3], [xd + 5.4, yd + 5.7], [xd + 5.4, yd + 6.5], [xd + 0.4, yd + 6.3]], W + 2.5, m.dark, 0.15));
      for (const s of [-1, 1]) {
        g.add(LP.box(1, 5.4, 0.7, m.dark, xd + 3, yd + 2.9, (hw - 2.5) * s));
        g.add(LP.box(4.6, 2.2, 0.15, m.body, xd + 3, yd + 6.2, (hw + 1.3) * s)); // end plates
      }
    }

    // Exhaust
    const R = st.wheelR + 0.75;
    const pipe = (x, z) => { const e = LP.cyl(0.35, 0.35, 1.6, 6, m.chrome, x, 1.5, z); e.rotation.z = Math.PI / 2; g.add(e); };
    if (opts.exhaust === 'twin') { pipe(rx - 0.2, -hw + 3); pipe(rx - 0.2, hw - 3); } else if (opts.exhaust === 'side') {
      const x0 = st.wheels[1] + R + 0.8, x1 = st.wheels[0] - R - 0.8;
      for (const s of [-1, 1]) {
        const p = LP.cyl(0.42, 0.42, x1 - x0, 8, m.chrome, (x0 + x1) / 2, 1.8, (hw + 0.75) * s);
        p.rotation.z = Math.PI / 2;
        g.add(p);
        g.add(LP.box(x1 - x0 - 2, 0.5, 0.15, LP.mat('#3a3a3a', { metalness: 0.6 }), (x0 + x1) / 2, 2.35, (hw + 0.85) * s)); // heat shield
      }
    } else pipe(rx - 0.2, -hw + 3);

    // Two-tone panels
    if (opts.twoTone === 'hood') {
      const [p2x, p2y] = st.top[2], [p3x0, p3y0] = st.top[3];
      const p3x = opts.shell ? Math.max(p3x0, 9) : p3x0;
      const p3y = p2y + ((p3y0 - p2y) * (p2x - p3x)) / (p2x - p3x0);
      g.add(LP.side([[p2x, p2y + bev + 0.03], [p3x, p3y + bev + 0.03], [p3x, p3y + bev + 0.14], [p2x, p2y + bev + 0.14]], W - 1.2, m.body2, 0));
    } else if (opts.twoTone === 'lower' && !opts.shell) {
      const x0 = st.wheels[1] + R, x1 = st.wheels[0] - R;
      for (const s of [-1, 1]) g.add(LP.box(x1 - x0, 1.7, 0.08, m.body2, (x0 + x1) / 2, 2.35, (hw + bev + 0.03) * s));
      g.add(LP.box(0.08, 1.4, W - 1, m.body2, fx + 0.85, 1.9, 0));
    }

    // Mud splatter for the filthiest look.
    if (opts.grime === 'filthy' && !opts.shell) {
      const rng = mulberry32((opts.number || 3) * 31 + 7);
      const mud = LP.mat('#3a2a1a', { roughness: 1 });
      for (let k = 0; k < 14; k++) {
        const s = k % 2 ? 1 : -1;
        const blob = LP.mesh(new THREE.CircleGeometry(randRange(rng, 0.3, 0.9), 5), mud, randRange(rng, rx + 1, fx - 1), randRange(rng, 1.3, 3.6), (hw + bev + 0.05) * s);
        if (s < 0) blob.rotation.y = Math.PI;
        blob.userData.noGrime = true;
        g.add(blob);
      }
    }
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

  // Compact SMG: stamped-steel receiver, perforated barrel shroud, magazine through the grip, folding wire stock.
  smg() {
    const g = new THREE.Group();
    g.name = 'smg';
    const { steel, worn, poly, hole } = GUNTEX.mats();
    // Rivets/screws down the receiver, mag release, fire selector, ribbed top cover.
    for (const x of [-0.54, 0.54]) for (const [y, z] of [[-0.3, 2.0], [-0.3, -1.6], [0.45, 2.1], [0.45, -1.9]]) g.add(GUNTEX.screw(worn, x, y, z, 0.08));
    g.add(LP.cyl(0.13, 0.13, 0.12, 12, worn, -0.5, -1.0, 0.0).rotateZ(Math.PI / 2)); // mag release
    const sel = LP.box(0.08, 0.16, 0.55, worn, 0.58, 0.35, 1.05);
    sel.rotation.x = 0.4;
    g.add(sel, LP.cyl(0.12, 0.12, 0.08, 12, worn, 0.57, 0.35, 1.25).rotateZ(Math.PI / 2)); // selector
    for (const z of [-0.9, -0.3, 0.3, 0.9]) g.add(LP.box(0.5, 0.05, 0.08, hole, 0, 0.96, z)); // cover ribs
    g.add(LP.sideZ([[-2.6, -0.55], [2.3, -0.55], [2.5, -0.3], [2.5, 0.55], [2.2, 0.75], [-2.4, 0.75], [-2.6, 0.5]], 1.05, steel, 0.08)); // receiver
    g.add(LP.sideZ([[-2.2, 0.75], [1.8, 0.75], [1.7, 0.95], [-2.1, 0.95]], 0.62, worn, 0.04)); // top cover
    g.add(LP.box(0.05, 0.42, 1.3, hole, 0.54, 0.18, -0.4)); // ejection port
    g.add(LP.box(0.06, 0.12, 2.6, hole, -0.54, 0.0, 0.2)); // stamped seam
    g.add(LP.cyl(0.16, 0.16, 0.45, 6, worn, 0, 1.15, -0.9)); // cocking knob
    g.add(LP.box(0.12, 0.05, 2.4, hole, 0, 0.96, -0.2)); // knob slot
    for (const x of [-0.24, 0.24]) g.add(LP.box(0.1, 0.45, 0.35, steel, x, 1.05, -2.0)); // front sight ears
    g.add(LP.box(0.1, 0.32, 0.12, worn, 0, 1.0, -2.0)); // front post
    g.add(LP.box(0.55, 0.38, 0.3, steel, 0, 1.08, 1.6)); // rear sight
    g.add(LP.box(0.15, 0.15, 0.32, hole, 0, 1.12, 1.6)); // peep
    // Barrel shroud with cooling holes, then the bare barrel and a muzzle nut.
    g.add(LP.lathe([[0.36, -2.5], [0.36, -3.6], [0.3, -3.68]], 8, steel, 0, 0.1, 0));
    for (const z of [-2.75, -3.05, -3.35]) for (const x of [-0.34, 0.34]) g.add(LP.box(0.06, 0.16, 0.18, hole, x, 0.1, z));
    g.add(LP.lathe([[0.19, -3.6], [0.19, -4.0], [0.27, -4.02], [0.29, -4.07], [0.27, -4.12], [0.29, -4.17], [0.27, -4.22], [0.29, -4.27], [0.27, -4.32], [0.15, -4.34]], 8, worn, 0, 0.1, 0)); // knurled muzzle nut
    const barrel = new THREE.Object3D(); // muzzle marker
    barrel.position.set(0, 0.1, -4.3);
    g.add(barrel);
    // Grip with moulded panels, magazine running through it, trigger and guard.
    g.add(LP.sideZ([[-0.55, -0.55], [0.45, -0.55], [0.25, -2.7], [-0.85, -2.7]], 0.9, poly, 0.1));
    for (const y of [-1.2, -1.6, -2.0]) for (const x of [-0.47, 0.47]) g.add(LP.box(0.05, 0.08, 0.85, hole, x, y, 0.15 + (y + 1.2) * -0.1));
    g.add(LP.sideZ([[-0.42, -2.7], [0.18, -2.7], [0.02, -4.5], [-0.6, -4.5]], 0.62, steel, 0.05)); // magazine
    g.add(LP.sideZ([[-0.5, -4.5], [0.12, -4.5], [0.1, -4.75], [-0.66, -4.75]], 0.78, worn, 0.05)); // base plate
    g.add(LP.sideZ([[0.6, -0.55], [1.55, -0.55], [1.5, -1.3], [0.55, -1.38], [0.55, -1.25], [1.36, -1.18], [1.42, -0.62], [0.6, -0.62]], 0.18, steel, 0)); // trigger guard
    const trig = LP.box(0.14, 0.55, 0.16, worn, 0, -0.85, -0.95);
    trig.rotation.x = 0.35;
    g.add(trig);
    g.add(LP.sideZ([[1.5, -0.55], [2.4, -0.55], [2.25, -1.0], [1.55, -1.0]], 0.8, poly, 0.08)); // handguard lip
    // Folding wire stock and butt plate, sling loop.
    for (const s of [-1, 1]) {
      g.add(LP.tube([0.4 * s, 0.25, 2.5], [0.35 * s, -0.1, 5.2], 0.07, worn));
      g.add(LP.tube([0.35 * s, -0.1, 5.2], [0.3 * s, -0.9, 5.35], 0.07, worn));
    }
    g.add(LP.box(0.85, 1.35, 0.2, steel, 0, -0.45, 5.45));
    g.add(LP.box(0.9, 1.4, 0.12, poly, 0, -0.45, 5.58)); // rubber pad
    g.add(LP.mesh(new THREE.TorusGeometry(0.22, 0.05, 4, 8), worn, 0, -0.25, 2.75).rotateY(Math.PI / 2)); // sling loop
    g.userData.barrel = barrel;
    return g;
  },

  // RPG-style launcher: steel tube, wooden heat shields with steel bands, flared venturi, optic, finned warhead.
  launcher() {
    const g = new THREE.Group();
    g.name = 'launcher';
    const M = GUNTEX.mats({ steel: '#3a3d3a', wood: '#7a4e2a', poly: '#1c1d1c' });
    const steel = M.steel, dark = M.poly, wood = M.wood;
    for (const z of [-0.45, 0.8, 2.05]) for (const a of [0, Math.PI]) g.add(GUNTEX.screw(M.worn, Math.cos(a) * 0.95, 0, z, 0.07)); // band screws
    const safety = LP.box(0.08, 0.2, 0.5, M.worn, 0.4, -0.75, 0.35);
    safety.rotation.x = -0.3;
    g.add(safety);
    const olive = LP.mat('#4b5a2e', { metalness: 0.3, roughness: 0.6 });
    g.add(LP.lathe([[0.62, -5.05], [0.55, -4.9], [0.52, -4.6], [0.52, 4.4], [0.6, 4.6]], 10, steel)); // main tube
    g.add(LP.lathe([[0.6, 4.6], [0.72, 5.0], [1.05, 5.9], [1.12, 6.2], [0.95, 6.2], [0.6, 5.2]], 10, dark)); // venturi bell
    // Heat shields: wood sleeve with three steel bands.
    g.add(LP.lathe([[0.82, -0.6], [0.9, -0.4], [0.9, 2.0], [0.82, 2.2]], 10, wood));
    for (const z of [-0.45, 0.8, 2.05]) g.add(LP.lathe([[0.94, z - 0.1], [0.94, z + 0.1]], 10, steel));
    // Pistol grip with trigger guard, front grip.
    g.add(LP.sideZ([[-1.25, -0.5], [-0.35, -0.5], [-0.6, -2.5], [-1.55, -2.5]], 0.72, wood, 0.1));
    g.add(LP.sideZ([[-0.3, -0.5], [0.75, -0.5], [0.7, -1.35], [-0.25, -1.4], [-0.25, -1.28], [0.6, -1.24], [0.62, -0.6], [-0.3, -0.6]], 0.16, steel, 0));
    const trig = LP.box(0.14, 0.55, 0.16, steel, 0, -0.9, -0.15);
    trig.rotation.x = 0.35;
    g.add(trig);
    g.add(LP.sideZ([[1.8, -0.5], [2.6, -0.5], [2.35, -2.25], [1.55, -2.25]], 0.7, dark, 0.08));
    // Iron sights and an optic on the left with a glowing lens and rubber eyecup.
    g.add(LP.box(0.12, 0.7, 0.12, steel, 0, 0.85, -4.4));
    g.add(LP.box(0.4, 0.5, 0.15, steel, 0, 0.75, -0.9));
    g.add(LP.box(0.15, 0.6, 1.8, steel, -0.62, 0.3, -1.2)); // optic bracket
    g.add(LP.lathe([[0.32, -2.2], [0.36, -2.0], [0.32, -0.6], [0.4, -0.3], [0.28, 0.0]], 8, dark, -0.95, 0.85, 0));
    g.add(LP.mesh(new THREE.CircleGeometry(0.28, 8), LP.glow('#5ad87a', 0.6), -0.95, 0.85, -2.21).rotateY(Math.PI));
    // Warhead: bulbous olive body with a fuse nose, painted band and stabiliser fins, sitting in the muzzle.
    const tip = new THREE.Group();
    tip.add(LP.lathe([[0.02, -2.75], [0.12, -2.7], [0.16, -2.4], [0.5, -2.1], [0.98, -1.35], [1.08, -0.9], [0.95, -0.4], [0.5, -0.05], [0.42, 0.5], [0.36, 1.0]], 10, olive));
    tip.add(LP.lathe([[1.0, -1.25], [1.09, -1.05], [1.07, -0.85]], 10, LP.mat('#c9a227')));
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Group();
      p.rotation.z = (k / 4) * TAU + Math.PI / 4;
      p.add(LP.box(0.06, 0.55, 0.7, steel, 0, 0.6, 0.75));
      tip.add(p);
    }
    tip.position.z = -6.3;
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

  // Pump shotgun (classic 870-style): rounded receiver, vent-rib barrel over the magazine tube, a fat grooved
  // forend on action bars, and a straight wooden stock that narrows at the wrist and flares to the butt.
  shotgun() {
    const g = new THREE.Group();
    g.name = 'shotgun';
    const M = GUNTEX.mats({ steel: '#2a2c2e' });
    const steel = M.steel, worn = M.worn, wood = M.wood, hole = M.hole;
    // Receiver: flat sides, rounded top, ejection port on the right, loading port underneath.
    const rec = LP.sideZ([[-2.3, -0.48], [1.55, -0.48], [1.6, 0.25], [1.4, 0.5], [0.9, 0.62], [-1.6, 0.62], [-2.1, 0.5], [-2.35, 0.2]], 0.92, steel, 0.1);
    LP.warp([rec], (v) => { v.x *= 1 - 0.22 * clamp((v.y - 0.15) / 0.5, 0, 1); }); // top rolls in
    g.add(rec);
    g.add(LP.rbox(0.06, 0.42, 1.5, 0.02, hole, 0.47, 0.12, -0.25));
    g.add(LP.rbox(0.55, 0.06, 1.7, 0.02, hole, 0, -0.5, -0.2));
    for (const x of [-0.47, 0.47]) for (const z of [1.0, -1.0]) g.add(GUNTEX.screw(worn, x, -0.25, z, 0.07));
    g.add(LP.rbox(0.07, 0.22, 0.4, 0.03, worn, -0.47, -0.36, 1.35)); // slide release
    // Trigger plate, smooth trigger guard, trigger, cross-bolt safety.
    g.add(LP.sideZ([[-1.9, -0.48], [0.7, -0.48], [0.55, -0.72], [-1.8, -0.72]], 0.7, M.poly, 0.06));
    g.add(LP.path([[0, -0.7, -0.55], [0, -1.15, -0.35], [0, -1.25, 0.3], [0, -1.05, 0.85], [0, -0.7, 1.0]], 0.07, M.poly));
    const trig = LP.path([[0, -0.72, -0.05], [0, -0.92, -0.12], [0, -1.08, -0.02]], 0.06, worn);
    g.add(trig);
    g.add(LP.cyl(0.09, 0.09, 0.72, 12, worn, 0, -0.62, 0.45).rotateZ(Math.PI / 2));
    // Barrel: crowned muzzle, vent rib on posts, brass bead. Magazine tube with a knurled cap and sling swivel.
    g.add(LP.lathe([[0.3, -1.55], [0.28, -1.75], [0.27, -7.75], [0.29, -7.8], [0.29, -7.88], [0.2, -7.9]], 16, steel, 0, 0.3, 0));
    g.add(LP.rbox(0.16, 0.06, 6.0, 0.02, worn, 0, 0.66, -4.75));
    for (let z = -2.0; z > -7.6; z -= 0.6) g.add(LP.rbox(0.07, 0.12, 0.1, 0.02, steel, 0, 0.58, z));
    g.add(LP.mesh(new THREE.SphereGeometry(0.08, 10, 6), LP.mat('#c9a443', { metalness: 0.9, roughness: 0.25 }), 0, 0.73, -7.6));
    g.add(LP.lathe([[0.24, -1.55], [0.24, -6.35], [0.32, -6.4], [0.3, -6.45], [0.32, -6.5], [0.3, -6.55], [0.32, -6.6], [0.3, -6.65], [0.22, -6.7]], 16, steel, 0, -0.27, 0));
    g.add(LP.rbox(0.36, 0.7, 0.3, 0.1, worn, 0, 0.02, -5.95)); // barrel clamp
    g.add(LP.mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 14), worn, 0, -0.62, -6.5).rotateY(Math.PI / 2));
    // Forend: fat, grooved, slightly oval, riding on two action bars back into the receiver.
    const pump = [[0.36, -2.15]];
    for (let k = 0; k <= 12; k++) pump.push([k % 2 ? 0.5 : 0.56, -2.3 - k * 0.2]);
    pump.push([0.4, -4.85]);
    const fore = LP.lathe(pump, 20, M.checker, 0, -0.24, 0);
    fore.scale.x = 0.86;
    g.add(fore);
    for (const x of [-0.3, 0.3]) g.add(LP.rbox(0.06, 0.12, 2.3, 0.02, worn, x, -0.12, -1.1));
    // Stock: smooth straight stock with a comb, narrowing at the wrist; rubber recoil pad.
    const stockPts = chaikin([[-2.25, 0.5], [-3.2, 0.32], [-5.4, 0.22], [-6.85, 0.18], [-6.95, -0.6], [-6.9, -1.95], [-5.6, -1.62], [-3.6, -0.9], [-2.7, -0.62], [-2.3, -0.5]], 2, 0.2);
    const stock = LP.side(stockPts, 0.86, wood, 0.12, 6);
    stock.geometry.rotateY(Math.PI / 2);
    LP.warp([stock], (v) => {
      const t = clamp((v.z - 2.4) / 3.6, 0, 1);
      v.x *= 0.68 + 0.32 * t; // slim wrist, full butt
      v.x *= 1 - 0.25 * clamp((v.y - 0.0) / 0.3, 0, 1) * t; // rounded comb
    });
    g.add(stock);
    g.add(LP.sideZ([[-6.92, 0.22], [-7.2, 0.24], [-7.22, -2.0], [-6.94, -1.98]], 0.9, M.poly, 0.06)); // recoil pad
    g.add(LP.mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 14), worn, 0, -1.6, 5.6).rotateY(Math.PI / 2)); // rear swivel
    const barrel = new THREE.Object3D(); // muzzle marker
    barrel.position.set(0, 0.3, -7.9);
    g.add(barrel);
    g.userData.barrel = barrel;
    return g;
  },

  // 12-gauge flare pistol: one moulded orange frame (grip, hammer housing and trigger guard in one piece),
  // a thick barrel that tips down on a hinge, checkered grip panels set into the frame.
  flareGun() {
    const g = new THREE.Group();
    g.name = 'flare gun';
    const orange = LP.mat('#d9601e', { map: GUNTEX.get('steel'), roughness: 0.5 });
    const frameMat = LP.mat('#c4561c', { map: GUNTEX.get('steel'), roughness: 0.62 });
    const grip = LP.mat('#1c1c1c', { map: GUNTEX.get('checker'), roughness: 0.8 });
    const black = LP.mat('#1a1a1a', { roughness: 0.6 });
    const steel = LP.mat('#7a7c7e', { map: GUNTEX.get('steel'), metalness: 0.7, roughness: 0.35 });
    // Barrel with a swelling muzzle and a dark bore; small front sight.
    g.add(LP.lathe([[0.5, 0.05], [0.5, -2.9], [0.56, -3.0], [0.6, -3.35], [0.5, -3.45]], 20, orange, 0, 0.3, 0));
    g.add(LP.mesh(new THREE.CircleGeometry(0.4, 18), LP.mat('#050505'), 0, 0.3, -3.44).rotateY(Math.PI));
    g.add(LP.rbox(0.1, 0.22, 0.4, 0.04, orange, 0, 0.86, -3.0));
    // Frame: one smooth piece from the barrel breech, over the hammer housing, down the grip.
    const frame = LP.sideZ([[1.0, -0.26], [1.0, -0.02], [0.2, -0.02], [0.0, 0.42], [-0.45, 0.58], [-0.95, 0.45], [-1.15, 0.1], [-1.62, -2.35], [-1.5, -2.6], [-0.85, -2.62], [-0.68, -2.4], [-0.42, -1.6], [-0.2, -1.1], [-0.12, -0.7], [0.15, -0.36]], 0.76, frameMat, 0.12);
    // Grip slims towards the butt.
    LP.warp([frame], (v) => { v.x *= 1 - 0.12 * clamp((-v.y - 0.8) / 1.6, 0, 1); });
    g.add(frame);
    g.add(LP.lathe([[0.52, 0.02], [0.52, -0.06]], 20, LP.mat('#0a0a0a'), 0, 0.3, 0)); // hinge seam at the breech
    // Checkered panels set into both sides of the raked grip.
    for (const s of [-1, 1]) g.add(LP.sideZ([[-0.42, -0.8], [-0.22, -0.85], [-0.62, -2.25], [-1.4, -2.25], [-1.12, -0.75]], 0.05, grip, 0).translateX(0.37 * s));
    for (const s of [-1, 1]) g.add(GUNTEX.screw(steel, 0.4 * s, -1.5, 0.9, 0.08));
    // Trigger guard as one smooth loop, curved trigger.
    g.add(LP.path([[0, -0.3, -0.2], [0, -0.55, -0.95], [0, -0.95, -1.0], [0, -1.12, -0.5], [0, -1.05, 0.05]], 0.09, orange));
    g.add(LP.path([[0, -0.32, -0.38], [0, -0.58, -0.48], [0, -0.82, -0.36]], 0.07, black));
    // Spur hammer with grip grooves, hinge pin, barrel latch, lanyard ring.
    const hammer = LP.sideZ([[-0.55, 0.42], [-0.72, 0.52], [-1.12, 0.88], [-1.24, 0.78], [-0.98, 0.38]], 0.3, black, 0.05);
    g.add(hammer);
    g.add(LP.cyl(0.13, 0.13, 0.95, 16, steel, 0, -0.1, -0.75).rotateZ(Math.PI / 2));
    const latch = LP.rbox(0.12, 0.2, 0.55, 0.05, black, -0.4, 0.22, -0.05);
    latch.rotation.x = 0.25;
    g.add(latch);
    g.add(LP.mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 16), steel, 0, -2.8, 1.2).rotateY(Math.PI / 2));
    const barrel = new THREE.Object3D(); // muzzle marker
    barrel.position.set(0, 0.3, -3.45);
    g.add(barrel);
    g.userData.barrel = barrel;
    return g;
  },

  // Paint job details: race number + livery decals, and rust/primer patches for worn finishes.
  livery(g, st, opts, W, bev) {
    const hw = W / 2, side = hw + bev + 0.05;
    const rng = mulberry32((opts.number || 7) * 97 + 13);
    const decal = (tex, w, h) => LP.mesh(new THREE.PlaneGeometry(w, h), LP.mat('#ffffff', { map: tex, transparent: true, alphaTest: 0.3, roughness: 0.9 }));
    const doorX = (st.seams[0] + st.seams[1]) / 2;
    const onDoors = (tex, w, h, y, x) => {
      if (opts.shell) return;
      for (const s of [-1, 1]) {
        const m = decal(tex, w, h);
        m.position.set(x == null ? doorX : x, y, side * s);
        if (s < 0) m.rotation.y = Math.PI;
        m.userData.noGrime = true;
        g.add(m);
      }
    };
    // Hood decal, lying on the hood slope, reading from the driver's seat.
    const [hx1, hy1] = st.top[2], [hx2, hy2] = st.top[3];
    const onHood = (tex, w, h, t) => {
      const x = lerp(hx1, Math.max(hx2, opts.shell ? 9 : hx2), t == null ? 0.5 : t);
      const y = lerp(hy1, hy2, (hx1 - x) / (hx1 - hx2)) + bev + 0.06;
      const tilt = new THREE.Group();
      tilt.position.set(x, y, 0);
      tilt.rotation.z = -Math.atan2(hy2 - hy1, hx1 - hx2);
      const m = decal(tex, w, h);
      m.geometry.rotateX(-Math.PI / 2);
      m.rotation.y = -Math.PI / 2;
      m.userData.noGrime = true;
      tilt.add(m);
      g.add(tilt);
    };
    const num = String(opts.number == null ? 47 : opts.number);
    const lv = opts.livery || 'none';
    if (lv === 'stencil' || lv === 'roundel') {
      const tex = DECALS.get('number', `${lv}:${num}`);
      onDoors(tex, 3.6, 3.6, 4.3);
      onHood(tex, 3.4, 3.4, 0.45);
    } else if (lv === 'stripes') {
      const white = LP.mat('#e6e0cf', { roughness: 0.9 });
      for (const z of [-1.3, 1.3]) {
        const len = Math.abs(hx1 - Math.max(hx2, opts.shell ? 9 : hx2));
        const tilt = new THREE.Group();
        tilt.position.set((hx1 + Math.max(hx2, opts.shell ? 9 : hx2)) / 2, (hy1 + hy2) / 2 + bev + 0.05, z);
        tilt.rotation.z = -Math.atan2(hy2 - hy1, hx1 - hx2);
        tilt.add(LP.box(len, 0.06, 1.1, white));
        g.add(tilt);
        if (!opts.shell) g.add(LP.box(Math.abs(st.cabin[1][0] - st.cabin[2][0]), 0.06, 1.1, white, (st.cabin[1][0] + st.cabin[2][0]) / 2, st.cabin[1][1] + 0.4, z));
      }
      onDoors(DECALS.get('number', `stencil:${num}`), 3, 3, 4.3);
    } else if (lv === 'flames') {
      onDoors(DECALS.get('flames'), 7, 2.6, 3.6, st.seams[0] + 3.2);
      onHood(DECALS.get('flames'), 6, 2.2, 0.3);
    } else if (lv === 'skull') {
      onHood(DECALS.get('skull'), 4, 4, 0.5);
      onDoors(DECALS.get('number', `stencil:${num}`), 3.2, 3.2, 4.3);
    }
    // Worn finishes: rust or grey primer patches.
    if (opts.finish === 'rusty' || opts.finish === 'patched') {
      const col = opts.finish === 'rusty' ? ['#6b3a1e', '#7d4422', '#5a3018'] : ['#7a7a74', '#86857d'];
      for (let k = 0; k < (opts.shell ? 3 : 9); k++) {
        const patch = LP.mesh(new THREE.CircleGeometry(randRange(rng, 0.5, 1.4), 6), LP.mat(pick(rng, col), { roughness: 1 }));
        patch.scale.set(randRange(rng, 1, 1.8), 1, 1);
        patch.userData.noGrime = true;
        if (opts.shell || k % 3 === 0) {
          patch.geometry.rotateX(-Math.PI / 2);
          const x = randRange(rng, opts.shell ? 10 : hx2, hx1 - 1);
          patch.position.set(x, lerp(hy1, hy2, (hx1 - x) / (hx1 - hx2)) + bev + 0.04, randRange(rng, -hw + 1.5, hw - 1.5));
        } else {
          const s = k % 2 ? 1 : -1;
          patch.position.set(randRange(rng, st.top[st.top.length - 1][0] + 2, st.top[0][0] - 2), randRange(rng, 2.2, 5.5), (side - 0.01) * s);
          if (s < 0) patch.rotation.y = Math.PI;
        }
        g.add(patch);
      }
    }
  },

  // Mod attachments, so you can see what's fitted. beam: draw the laser sight's beam (held weapon only).
  modVisuals(gun, weaponId, mods, beam) {
    const A = {
      smg: { mag: [0, -3.6, -0.8], side: [0.55, 0.1, 0.2], muzzle: [0, 0.1, -4.3], under: [0, -0.6, -2.7] },
      shotgun: { mag: [0.5, -0.1, -1.5], side: [0.5, 0.1, -0.3], muzzle: [0, 0.3, -7.95], under: [0, -0.7, -5.4] },
      rocket: { mag: [1.0, -0.4, 1.6], side: [0.65, 0.4, -1.4], muzzle: [0, 0, -5.4], under: [0, -1.0, -3.0] },
      flare: { mag: [0, -2.2, 0.0], side: [0.6, 0.25, -1.0], muzzle: [0, 0.2, -3.45], under: [0, -0.5, -2.6] },
    }[weaponId];
    const steel = LP.mat('#2b2d30', { metalness: 0.6, roughness: 0.45 });
    const add = (m) => { m.userData.modVis = true; gun.add(m); return m; };
    for (const id of mods.filter(Boolean)) {
      if (id === 'ext_mag') {
        if (weaponId === 'smg') add(LP.box(0.62, 2.4, 0.95, steel, A.mag[0], A.mag[1], A.mag[2]));
        else add(LP.box(0.9, 1.6, 2.2, LP.mat('#4a3a24'), A.mag[0], A.mag[1], A.mag[2])); // ammo pouch / shell carrier
      } else if (id === 'quick_mag') {
        add(LP.box(0.5, 1.2, 0.8, steel, A.side[0] + 0.25, A.side[1] - 0.8, A.side[2]));
        add(LP.box(0.55, 0.25, 0.85, LP.mat('#d9b52c'), A.side[0] + 0.25, A.side[1] - 0.8, A.side[2])); // taped together
      } else if (id === 'incendiary') {
        add(LP.box(0.06, 0.35, 2.2, LP.glow('#ff6a1a', 0.6), A.side[0] - 0.02, A.side[1], A.side[2]));
      } else if (id === 'ap_rounds') {
        add(LP.box(0.06, 0.35, 1.4, LP.mat('#3fc8c0', { metalness: 0.6 }), A.side[0] - 0.02, A.side[1] - 0.4, A.side[2]));
      } else if (id === 'laser') {
        add(LP.box(0.35, 0.35, 0.9, steel, A.under[0], A.under[1], A.under[2]));
        add(LP.box(0.2, 0.2, 0.05, LP.glow('#ff2020', 1.5), A.under[0], A.under[1], A.under[2] - 0.48));
        if (beam) {
          const b = LP.mesh(new THREE.BoxGeometry(0.03, 0.03, 80), new THREE.MeshBasicMaterial({ color: '#ff2020', transparent: true, opacity: 0.35, depthWrite: false }), A.under[0], A.under[1], A.under[2] - 40.5);
          add(b);
        }
      } else if (id === 'choke') {
        const ring = LP.cyl(0.4, 0.4, 0.6, 8, steel, A.muzzle[0], A.muzzle[1], A.muzzle[2]);
        ring.rotation.x = Math.PI / 2;
        add(ring);
      } else if (id === 'homing') {
        add(LP.box(0.4, 0.5, 0.8, steel, A.side[0], A.side[1], A.side[2]));
        add(LP.box(0.06, 1.0, 0.06, steel, A.side[0], A.side[1] + 0.7, A.side[2]));
        add(LP.box(0.15, 0.15, 0.05, LP.glow('#ff2020', 1.2), A.side[0], A.side[1] + 0.2, A.side[2] - 0.43));
      } else if (id === 'suppressor') {
        add(LP.cyl(0.42, 0.42, 2.6, 8, steel, A.muzzle[0], A.muzzle[1], A.muzzle[2] - 1.2).rotateX(Math.PI / 2));
      } else if (id === 'tracer') {
        add(LP.box(0.06, 0.3, 1.8, LP.glow('#7aff5a', 0.8), A.side[0] - 0.02, A.side[1] + 0.35, A.side[2]));
      } else if (id === 'hair_trigger') {
        add(LP.box(0.2, 0.5, 0.3, LP.mat('#c22a1a'), A.under[0], A.under[1] - 0.2, A.under[2] + 2.0));
      } else if (id === 'sawn_off') {
        const tape = DECALS.mat('tape', { roughness: 1 });
        add(LP.box(1.0, 1.0, 0.5, tape, A.muzzle[0], A.muzzle[1] - 0.2, A.muzzle[2] + 1.2));
        for (let k = 0; k < 4; k++) add(LP.box(0.12, 0.25, 0.25, steel, A.muzzle[0] - 0.3 + k * 0.2, A.muzzle[1] + 0.2, A.muzzle[2] + 0.2));
      } else if (id === 'slugs') {
        for (let k = 0; k < 4; k++) add(LP.cyl(0.16, 0.16, 0.7, 6, LP.mat(k % 2 ? '#b8862a' : '#7a2a1a', { metalness: 0.5 }), A.side[0] + 0.1, A.side[1] - 0.2, A.side[2] - 0.6 + k * 0.4));
      } else if (id === 'bunker_buster') {
        const cone = LP.mesh(new THREE.ConeGeometry(0.55, 1.4, 6), LP.mat('#5a5e62', { metalness: 0.7 }), A.muzzle[0], A.muzzle[1], A.muzzle[2] - 0.8);
        cone.rotation.x = -Math.PI / 2;
        add(cone);
      } else if (id === 'twin_tube') {
        add(LP.cyl(0.7, 0.7, 7.5, 8, LP.mat('#3a4a2a'), A.side[0] + 0.8, A.side[1] + 0.2, -1.6).rotateX(Math.PI / 2));
        for (const z of [-4.2, 1.2]) add(LP.box(0.3, 1.6, 0.4, steel, A.side[0] + 0.3, A.side[1] + 0.2, z));
      } else if (id === 'remote_det') {
        add(LP.box(0.5, 0.6, 0.9, LP.mat('#d9b52c'), A.side[0], A.side[1] - 0.4, A.side[2] + 1.0));
        add(LP.box(0.05, 1.4, 0.05, steel, A.side[0], A.side[1] + 0.5, A.side[2] + 1.2));
        add(LP.box(0.12, 0.12, 0.12, LP.glow('#ffcf3a', 1.4), A.side[0], A.side[1] + 1.25, A.side[2] + 1.2));
      } else if (id === 'long_burn') {
        add(LP.cyl(0.35, 0.35, 1.4, 6, LP.mat('#d9601e'), A.under[0], A.under[1] - 0.2, A.under[2]).rotateX(Math.PI / 2));
      } else if (id === 'phosphor') {
        add(LP.box(0.06, 0.4, 1.6, LP.glow('#f4f8ff', 1.0), A.side[0] - 0.02, A.side[1], A.side[2]));
      } else if (id === 'cluster') {
        for (let k = 0; k < 3; k++) add(LP.cyl(0.18, 0.18, 0.9, 6, LP.mat('#d9601e'), A.side[0] + 0.1, A.side[1] - 0.3 - k * 0.4, A.side[2] + 0.8).rotateX(Math.PI / 2));
      }
    }
    return gun;
  },

  // Gun finish: re-skins the metal and furniture; mod attachments and glowing bits keep their own look.
  gunFinish(gun, finish) {
    if (!finish || finish === 'stock') return gun;
    const tint = { rust: '#6b4a32', chrome: '#eef2f6', gold: '#e0b44a', camo: '#ffffff' }[finish];
    gun.traverse((o) => {
      if (!o.isMesh || o.userData.modVis || !o.material || !o.material.isMeshStandardMaterial) return;
      const m = o.material;
      if (m.emissiveIntensity > 0 && m.emissive && m.emissive.getHex() !== 0) return;
      if (finish === 'tape') return;
      const nm = m.clone();
      nm.color.set(tint);
      if (finish === 'rust') { nm.color.lerp(m.color, 0.3); nm.metalness = 0.4; nm.roughness = 0.95; }
      else if (finish === 'chrome') { nm.metalness = 0.55; nm.roughness = 0.25; } // no env map, so full metal would read black
      else if (finish === 'gold') { nm.metalness = 0.45; nm.roughness = 0.3; }
      else if (finish === 'camo') { nm.map = DECALS.get('camo'); nm.metalness = 0.1; nm.roughness = 0.9; }
      o.material = nm;
    });
    if (finish === 'tape') {
      const bb = new THREE.Box3().setFromObject(gun), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      const tape = DECALS.mat('tape', { roughness: 1 });
      for (const t of [-0.3, 0.05, 0.3]) {
        const band = LP.box(Math.min(sz.x, 1.4) + 0.12, Math.min(sz.y, 1.2) + 0.12, 0.5, tape, c.x, c.y + sz.y * 0.1, c.z + t * sz.z);
        band.userData.modVis = true;
        gun.add(band);
      }
    }
    return gun;
  },

  // Dash ornaments (cosmetic). userData.sway is the part that wobbles with the car.
  ornament(id) {
    const g = new THREE.Group(), m3 = LP.mat;
    g.name = id + ' ornament';
    const sway = new THREE.Group();
    g.add(sway);
    g.userData.sway = sway;
    if (id === 'hula') {
      g.add(LP.cyl(0.9, 1, 0.3, 8, m3('#3a2a1a'), 0, 0.15, 0));
      g.add(LP.cyl(0.25, 0.75, 1.3, 7, m3('#6a8a2a', { roughness: 1 }), 0, 0.95, 0)); // grass skirt
      sway.position.y = 1.6;
      sway.add(LP.cyl(0.32, 0.25, 1.1, 6, m3('#c98a5a'), 0, 0.55, 0));
      sway.add(LP.box(0.2, 0.25, 0.7, m3('#d84a6a'), 0.12, 0.8, 0)); // top
      sway.add(LP.mesh(new THREE.IcosahedronGeometry(0.42, 0), m3('#c98a5a'), 0, 1.4, 0));
      sway.add(LP.mesh(new THREE.IcosahedronGeometry(0.44, 0), m3('#1a120a'), -0.12, 1.5, 0)); // hair
      sway.add(LP.mesh(new THREE.TorusGeometry(0.35, 0.09, 4, 8), m3('#ff5a8a'), 0, 1.05, 0).rotateX(Math.PI / 2)); // lei
      for (const z of [-1, 1]) sway.add(LP.beam([0, 0.95, 0.3 * z], [0.1, 1.5, 0.75 * z], 0.12, m3('#c98a5a')));
      sway.userData.axis = 'z';
    } else if (id === 'dog') {
      g.add(LP.box(2.2, 1.2, 1.1, m3('#7a5a3a'), 0, 0.6, 0));
      g.add(LP.box(0.6, 0.5, 0.25, m3('#e8e0c8'), 0.6, 0.5, 0.56)); // spot
      sway.position.set(0.9, 1.25, 0);
      sway.add(LP.box(1.1, 0.9, 0.9, m3('#7a5a3a'), 0.4, 0.3, 0));
      sway.add(LP.box(0.5, 0.5, 0.6, m3('#e8e0c8'), 1.05, 0.15, 0)); // snout
      sway.add(LP.box(0.18, 0.18, 0.2, m3('#111'), 1.32, 0.3, 0));
      for (const z of [-0.5, 0.5]) sway.add(LP.box(0.4, 0.8, 0.12, m3('#4a3420'), 0.25, 0.1, z)); // ears
      sway.userData.axis = 'nod';
    } else if (id === 'saint') {
      g.add(LP.cyl(0.6, 0.7, 0.3, 8, m3('#d8d0b8'), 0, 0.15, 0));
      sway.position.y = 0.3;
      sway.add(LP.mesh(new THREE.ConeGeometry(0.6, 2.2, 7), m3('#3a5a9a'), 0, 1.1, 0)); // robe
      sway.add(LP.mesh(new THREE.IcosahedronGeometry(0.32, 0), m3('#e8c8a0'), 0, 2.35, 0));
      sway.add(LP.mesh(new THREE.TorusGeometry(0.42, 0.06, 4, 10), LP.glow('#ffd86a', 0.8), -0.15, 2.55, 0).rotateY(Math.PI / 2));
      sway.userData.axis = 'z';
      sway.userData.stiff = true;
    } else {
      g.add(LP.cyl(0.7, 0.8, 0.25, 6, m3('#2a2a2a'), 0, 0.12, 0));
      sway.position.y = 0.25;
      sway.add(LP.mesh(LP.jitter(new THREE.IcosahedronGeometry(0.8, 1), 0.06, 4), m3('#e0d8c0'), 0, 0.9, 0));
      sway.add(LP.box(0.7, 0.4, 0.9, m3('#d8d0b8'), 0.25, 0.25, 0)); // jaw
      for (const z of [-0.3, 0.3]) sway.add(LP.box(0.2, 0.3, 0.26, m3('#0a0a0a'), 0.72, 1.0, z));
      sway.add(LP.box(0.15, 0.2, 0.14, m3('#0a0a0a'), 0.78, 0.65, 0));
      sway.userData.axis = 'z';
      sway.userData.stiff = true;
    }
    return g;
  },

  // First-person hands: fingerless gloves and orange prison-jumpsuit sleeves, posed on each gun's grips.
  // 'pistol' wraps a vertical grip (axis = local Y); 'support' cradles a tube or handguard from below (axis = Z).
  hand(kind, arm) {
    const g = new THREE.Group();
    const opts = { side: THREE.DoubleSide, roughness: 0.85 };
    const skin = LP.mat('#c08a62', opts), glove = LP.mat('#2e2620', opts), suit = LP.mat('#d9661e', opts), cuff = LP.mat('#a8481a', opts);
    if (kind === 'pistol') {
      g.add(LP.rbox(0.42, 1.5, 1.2, 0.13, glove, 0.68, -0.1, 0.05)); // back of the hand
      g.add(LP.rbox(0.46, 1.25, 0.42, 0.13, glove, 0.64, -0.2, -0.55)); // knuckles
      g.add(LP.rbox(0.9, 0.42, 0.45, 0.13, glove, 0.22, 0.6, 0.55)); // web over the top of the grip
      for (let k = 0; k < 3; k++) {
        const y = -0.05 - k * 0.38;
        g.add(LP.rbox(1.05, 0.32, 0.36, 0.13, skin, 0.05, y, -0.74)); // finger across the front
        g.add(LP.rbox(0.34, 0.3, 0.46, 0.13, skin, -0.6, y, -0.46)); // fingertip on the far side
      }
      g.add(LP.rbox(0.3, 0.3, 1.0, 0.13, skin, 0.62, 0.42, -0.95)); // trigger finger along the frame
      const thumb = LP.rbox(0.32, 0.32, 0.95, 0.13, skin, -0.55, 0.45, 0.05);
      thumb.rotation.y = 0.3;
      g.add(thumb);
      g.add(LP.rbox(0.85, 0.95, 0.85, 0.13, glove, 0.6, -0.45, 0.85)); // wrist
    } else {
      g.add(LP.rbox(1.0, 0.36, 1.45, 0.13, glove, 0.05, -0.62, 0)); // palm under the tube
      for (let k = 0; k < 4; k++) {
        const z = -0.55 + k * 0.37;
        g.add(LP.rbox(0.3, 0.7, 0.3, 0.13, skin, 0.56, -0.2, z)); // fingers up the far side
        g.add(LP.rbox(0.3, 0.26, 0.3, 0.13, skin, 0.36, 0.22, z)); // tips curled over
      }
      g.add(LP.rbox(0.3, 0.66, 0.34, 0.13, skin, -0.55, -0.22, 0.35)); // thumb
      g.add(LP.rbox(0.9, 0.8, 0.8, 0.13, glove, -0.1, -0.85, 0.85)); // wrist
    }
    // Forearm in the jumpsuit sleeve, running back towards the camera.
    const w = kind === 'pistol' ? [0.62, -0.55, 1.15] : [-0.1, -0.95, 1.15];
    g.add(LP.tube(w, [w[0] + arm[0] * 0.12, w[1] + arm[1] * 0.12, w[2] + arm[2] * 0.12], 0.62, cuff));
    g.add(LP.tube([w[0] + arm[0] * 0.1, w[1] + arm[1] * 0.1, w[2] + arm[2] * 0.1], [w[0] + arm[0], w[1] + arm[1], w[2] + arm[2]], 0.72, suit));
    g.traverse((o) => { if (o.isMesh) o.userData.modVis = true; });
    return g;
  },

  // Where the hands go on each gun: [kind, position, x-tilt, arm direction, mirrored].
  GRIPS: {
    smg: [['pistol', [0, -1.45, 0.15], -0.12, [2.2, -3.6, 6], false], ['support', [0, -0.78, -1.95], 0, [-2.4, -3.2, 6], false]],
    shotgun: [['pistol', [0, -0.75, 2.75], 1.05, [2.2, -3.0, 6], false], ['support', [0, -0.24, -3.5], 0, [-2.6, -3, 6.5], false]],
    rocket: [['pistol', [0, -1.45, 0.95], -0.15, [2.2, -3.4, 6], false], ['pistol', [0, -1.35, -1.95], -0.15, [-2.6, -3.2, 7], true]],
    flare: [['pistol', [0, -1.45, 0.95], -0.3, [2.2, -3.6, 6], false]],
  },

  hands(gun, weaponId) {
    for (const [kind, pos, tilt, arm, mirror] of Models.GRIPS[weaponId] || []) {
      const h = Models.hand(kind, mirror ? [-arm[0], arm[1], arm[2]] : arm);
      if (mirror) h.scale.x = -1;
      h.position.set(...pos);
      h.rotation.x = tilt;
      gun.add(h);
    }
    return gun;
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
    const cab = Object.assign({ seats: 'vinyl', wheelWrap: 'tape', dash: '#1b1d22', bulb: '#ffd9a0', ornament: 'none', inmate: '4471' }, (opts && opts.cabin) || {});
    const I = new THREE.Group();
    I.name = 'cockpit interior';
    const refs = {};
    const m3 = LP.mat, box = LP.box, beam = LP.beam;
    const dark = m3(cab.dash), trim = m3('#2a2d33'), seat = {
      vinyl: () => m3('#3b2a24'), leather: () => m3('#161412', { roughness: 0.35 }), tartan: () => DECALS.mat('tartan', { roughness: 1 }),
      beaded: () => DECALS.mat('beads', { roughness: 0.6 }), leopard: () => DECALS.mat('leopard', { roughness: 1 }),
    }[cab.seats in { vinyl: 1, leather: 1, tartan: 1, beaded: 1, leopard: 1 } ? cab.seats : 'vinyl'](), body = m3(color, { metalness: 0.3, roughness: 0.5 });
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
    const glass = LP.mesh(new THREE.IcosahedronGeometry(0.45, 0), LP.glow(cab.bulb, 1.4), 0, -2.2, 0);
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
    const sten = LP.mesh(new THREE.PlaneGeometry(3.0, 1.2), LP.mat('#ffffff', { map: DECALS.get('stencil', cab.inmate) }), 3.9, 4.6, 4.6);
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

    // Steering wheel wrap.
    if (cab.wheelWrap === 'leather' || cab.wheelWrap === 'fur') {
      const wrapMat = cab.wheelWrap === 'fur' ? DECALS.mat('fur', { roughness: 1 }) : m3('#4a2c1a', { roughness: 0.5 });
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(2.6, cab.wheelWrap === 'fur' ? 0.55 : 0.4, 5, 12), wrapMat));
    } else if (cab.wheelWrap === 'chain') {
      const iron2 = m3('#6a6c6e', { metalness: 0.8, roughness: 0.35 });
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU, l = LP.mesh(new THREE.TorusGeometry(0.42, 0.13, 4, 6), iron2, Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0);
        l.rotation.set(k % 2 ? Math.PI / 2 : 0, 0, a);
        wheel.add(l);
      }
    } else {
      for (const a of [0.4, 2.2, 4.0]) wheel.add(box(0.9, 0.75, 0.75, tapeMat, Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0).rotateZ(a + Math.PI / 2));
    }

    // Dash ornament.
    if (cab.ornament && cab.ornament !== 'none') {
      const orn = Models.ornament(cab.ornament);
      orn.position.set(6.3, 6.8, 2.9);
      orn.rotation.y = Math.PI;
      orn.scale.setScalar(0.6);
      I.add(orn);
      refs.ornament = orn;
    }

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
