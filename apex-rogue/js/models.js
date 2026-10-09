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
  // Gather meshes into a group that pivots about `pivot` (for parts that move: mags, pumps, hinged barrels).
  pivot(parent, meshes, pivot) {
    const grp = new THREE.Group();
    grp.position.set(...pivot);
    for (const m of meshes) { parent.remove(m); m.position.sub(grp.position); grp.add(m); }
    parent.add(grp);
    return grp;
  },
  // Smooth round rod along a curve through points (trigger guards, hoses, bent wire).
  path(points, r, mat, closed) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), !!closed, 'centripetal');
    return new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 8, r, 10, !!closed), mat);
  },
  // Tapered round limb along a smooth curve with rounded ends (fingers, thumbs, forearms, sleeves).
  // radii: one per point, eased between; wob(t, a) optionally scales the radius (cloth folds, creases).
  limb(points, radii, mat, wob) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    const seg = Math.max(10, (points.length - 1) * 10), sides = 16, cap = 5;
    const fr = curve.computeFrenetFrames(seg, false);
    const rAt = (t) => {
      const f = t * (radii.length - 1), i = Math.min(radii.length - 2, Math.floor(f)), u = f - i, s = u * u * (3 - 2 * u);
      return radii[i] + (radii[i + 1] - radii[i]) * s;
    };
    // Rings: [centre, normal, binormal, radius]; the ends close over as half-domes.
    const rings = [], c = new THREE.Vector3();
    const tan0 = fr.tangents[0], tan1 = fr.tangents[seg];
    for (let k = cap; k >= 1; k--) {
      const ph = (k / cap) * Math.PI / 2, r = rAt(0);
      rings.push([curve.getPointAt(0).addScaledVector(tan0, -Math.sin(ph) * r), fr.normals[0], fr.binormals[0], Math.cos(ph) * r, 0]);
    }
    for (let i = 0; i <= seg; i++) rings.push([curve.getPointAt(i / seg), fr.normals[i], fr.binormals[i], rAt(i / seg), i / seg]);
    for (let k = 1; k <= cap; k++) {
      const ph = (k / cap) * Math.PI / 2, r = rAt(1);
      rings.push([curve.getPointAt(1).addScaledVector(tan1, Math.sin(ph) * r), fr.normals[seg], fr.binormals[seg], Math.cos(ph) * r, 1]);
    }
    const pos = [], idx = [];
    for (const [p, n, b, r, t] of rings) {
      for (let j = 0; j < sides; j++) {
        const a = (j / sides) * Math.PI * 2, rr = Math.max(0.002, r * (wob ? wob(t, a) : 1));
        c.copy(p).addScaledVector(n, Math.cos(a) * rr).addScaledVector(b, Math.sin(a) * rr);
        pos.push(c.x, c.y, c.z);
      }
    }
    for (let i = 0; i < rings.length - 1; i++) {
      for (let j = 0; j < sides; j++) {
        const a = i * sides + j, b2 = i * sides + (j + 1) % sides, d = a + sides, e = b2 + sides;
        idx.push(a, d, b2, b2, d, e);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  },
  // Signed distance to a cone between spheres (a at radius ra, b at radius rb): one bone of a hand.
  roundCone(px, py, pz, a, b, ra, rb) {
    const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], l2 = bx * bx + by * by + bz * bz;
    const rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / l2;
    const qx = px - a[0], qy = py - a[1], qz = pz - a[2], y = qx * bx + qy * by + qz * bz, z = y - l2;
    const xx = qx * l2 - bx * y, xy = qy * l2 - by * y, xz = qz * l2 - bz * y, x2 = xx * xx + xy * xy + xz * xz;
    const y2 = y * y * l2, z2 = z * z * l2, k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
    return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - ra;
  },
  // Smooth union: blends two shapes with a fillet of size k instead of a hard crease.
  smin(a, b, k) {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
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
    } else if (kind === 'glasscrack' || kind === 'glassshot') {
      // The glass, cracked: a star of cracks (and bullet holes when it's shot through).
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#6f7d86'); gr.addColorStop(0.45, '#262f38'); gr.addColorStop(1, '#0e1318');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const rng = mulberry32(kind.length * 7);
      g.strokeStyle = 'rgba(230,240,245,0.7)'; g.lineWidth = 1;
      for (const [cx, cy] of [[W * 0.35, H * 0.4], [W * 0.75, H * 0.65]]) {
        for (let k = 0; k < 9; k++) {
          let x = cx, y = cy, a = rng() * TAU;
          g.beginPath(); g.moveTo(x, y);
          for (let n = 0; n < 5; n++) { a += (rng() - 0.5) * 0.8; x += Math.cos(a) * 3.5; y += Math.sin(a) * 3.5; g.lineTo(x, y); }
          g.stroke();
        }
        if (kind === 'glassshot') { g.fillStyle = '#05070a'; g.beginPath(); g.arc(cx, cy, 2.2, 0, TAU); g.fill(); }
      }
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
    extras(sc, m) {
      sc.add(m.dark, SDF.box([1.4, 0.4, 13], 0.18, [17.6, 1.6, 0]), 0.3); // front lip
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
    extras(sc, m) {
      sc.add(m.body, SDF.inflate(SDF.sideX([[13, 6.3], [7.5, 6.8], [7.2, 7.8], [10.5, 7.8]], 4, 0), 0.15), 0.5); // hood scoop, moulded into the hood
      sc.cut(SDF.box([1.2, 0.7, 3.2], 0.15, [7.4, 7.55, 0]), 0.1); // its intake
    },
  },
  // Sedan: a square-rigged 80s four-door, the kind every prison motor pool runs into the ground.
  sedan: {
    top: [[18.6, 1.9], [18.8, 4.8], [17.8, 6.0], [8.4, 6.9], [-12.5, 7.1], [-17.6, 6.7], [-18.2, 5.4], [-18.3, 2.0]],
    cabin: [[8.2, 7.0], [3.6, 11.2], [-8.4, 11.2], [-12.8, 7.2]], cabinW: 14.6, bodyW: 16,
    wheels: [11.6, -11.2], wheelR: 2.8, wheelZ: 7.3,
    lightY: 4.6, tailY: 5.8, frontPlateY: 2.6, rearPlateY: 4.4, mirrorX: 7.4, mirrorY: 7.9,
    bPillar: -2.2, seams: [6.6, -2.4, -10.2], cPillar: [[-7.2, 7.2], [-8.4, 11.2], [-12.8, 7.2]],
    kit: { bumper: 'none', roof: 'none', spoiler: 'none' },
    extras(sc, m) {
      sc.add(m.body, SDF.box([0.8, 0.8, 13.4], 0.3, [-1.6, 11.6, 0]), 0.6); // roof drip ridge
    },
  },
  // Pickup: a short cab and an open load bed.
  pickup: {
    top: [[18.8, 2.0], [19.0, 5.4], [18.0, 6.8], [9.0, 7.6], [-2.0, 7.9], [-18.4, 8.1], [-18.8, 7.4], [-18.9, 2.0]],
    cabin: [[8.8, 7.7], [5.0, 12.2], [-1.0, 12.2], [-1.8, 7.9]], cabinW: 15.2, bodyW: 16.8,
    wheels: [12.0, -11.6], wheelR: 3.2, wheelZ: 7.6,
    lightY: 5.0, tailY: 6.4, frontPlateY: 2.8, rearPlateY: 4.6, mirrorX: 8.0, mirrorY: 8.6,
    bPillar: -0.4, seams: [7.4, -1.6], cPillar: [[-0.4, 7.9], [-0.6, 12.2], [-1.0, 12.2], [-1.8, 7.9]],
    kit: { bumper: 'pushbar', roof: 'lightbar', spoiler: 'none' },
    extras(sc, m) {
      sc.cut(SDF.box([16.2, 8, 14.6], 0.6, [-10.4, 8.6, 0]), 0.4); // the open load bed
      for (const sd of [-1, 1]) sc.add(m.dark, SDF.box([15.2, 0.5, 0.7], 0.2, [-10.4, 8.3, sd * 7.6]), 0.3); // bed rail caps
      for (const sd of [-1, 1]) sc.add(m.body, SDF.box([8.2, 3.6, 3.2], 1.2, [-11.6, 6.2, sd * 5.4]), 0.4); // wheel tubs in the bed
    },
  },
  // Van: a tall panel van, blind at the back.
  van: {
    top: [[18.2, 2.0], [18.4, 6.2], [17.4, 7.6], [10.6, 8.4], [-17.6, 8.6], [-18.2, 7.6], [-18.4, 2.0]],
    cabin: [[10.4, 8.5], [6.0, 14.6], [-17.4, 14.6], [-18.0, 8.7]], cabinW: 15.6, bodyW: 16.6,
    wheels: [12.0, -11.6], wheelR: 3.0, wheelZ: 7.6,
    lightY: 5.2, tailY: 7.0, frontPlateY: 2.8, rearPlateY: 4.8, mirrorX: 9.2, mirrorY: 9.2,
    bPillar: 3.6, seams: [9.6, 3.2, -6.0], cPillar: [[-3.4, 8.7], [-3.4, 14.6], [-17.4, 14.6], [-18.0, 8.7]],
    kit: { bumper: 'none', roof: 'rack', spoiler: 'none' },
    extras(sc, m) {
      for (const sd of [-1, 1]) sc.add(m.dark, SDF.box([13, 0.3, 0.3], 0.1, [-8.6, 9.8, sd * 8.0]), 0.1); // sliding door rail
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

    const fx = st.top[0][0] + bev, rx = st.top[st.top.length - 1][0] - bev;
    Models.carBody(g, st, opts, { body, body2, roofMat, dark, chrome }, W, bev, fx, rx);
    if (!opts.shell) {
      // Tinted glass sits inside the pillars; it leans in as it rises (tumblehome), like the roof around it.
      const cab = st.cabin, cw = st.cabinW, belt = cab[0][1], roofY = cab[1][1];
      const house = [LP.side(cab, cw, glass, 0.25)];
      g.userData.glassMat = glass;
      for (const s of [-1, 1]) {
        house.push(LP.beam([cab[0][0] - 0.4, belt + 0.12, (cw / 2 + 0.12) * s], [cab[cab.length - 1][0] + 0.4, belt + 0.12, (cw / 2 + 0.12) * s], 0.22, chrome)); // belt trim
        house.push(LP.beam([cab[1][0] - 0.2, roofY - 0.05, (cw / 2 + 0.16) * s], [cab[2][0] + 0.3, roofY - 0.05, (cw / 2 + 0.16) * s], 0.2, dark)); // drip rail
      }
      LP.warp(house, (v) => { v.z *= 1 - 0.15 * clamp((v.y - belt) / (roofY - belt), 0, 1); });
      // Glass UVs: each pane mapped once across its own extent (side windows from the side, screens from the front),
      // so the reflection and any cracks land on the glass the right way up.
      {
        const gg = house[0].geometry, pos = gg.attributes.position, nrm = gg.attributes.normal;
        gg.computeBoundingBox();
        const bb = gg.boundingBox, uv = new Float32Array(pos.count * 2);
        const nx = (v, a, b) => (v - a) / (b - a || 1);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
          const [u, v] = az >= ax && az >= ay ? [nx(x, bb.min.x, bb.max.x), nx(y, bb.min.y, bb.max.y)] : ax >= ay ? [nx(z, bb.min.z, bb.max.z), nx(y, bb.min.y, bb.max.y)] : [nx(x, bb.min.x, bb.max.x), nx(z, bb.min.z, bb.max.z)];
          uv[i * 2] = u; uv[i * 2 + 1] = 1 - v;
        }
        gg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      }
      g.add(...house);
      // Wipers at the base of the windscreen.
      for (const z of [-3.2, 1.6]) g.add(LP.beam([cab[0][0] - 0.2, belt + 0.25, z], [cab[0][0] - 1.6, belt + 1.1, z + 3.4], 0.15, dark));
    }

    // Front: grille, headlights, plate. Rear: tail lights, plate, exhaust.
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
    const plate = opts.plate || 'APX ' + (100 + Math.floor(paint.r * 899));
    g.add(LP.box(0.12, 1.0, 2.6, DECALS.mat('plate', {}, plate), fx + 0.85, st.frontPlateY, 0));
    g.add(LP.box(0.12, 1.0, 2.6, DECALS.mat('plate', {}, plate), rx - 0.85, st.rearPlateY, 0));

    // Sides: door seams and handles, mirrors.
    if (!opts.shell) {
      for (const s of [-1, 1]) {
        const z = (hw + bev + 0.02) * s;
        for (const x of st.seams) g.add(LP.box(0.12, 5, 0.06, dark, x, 4.1, z));
        g.add(LP.box(0.9, 0.25, 0.12, chrome, st.seams[st.seams.length - 1] + 1.2, 6.0, z));
        if (s > 0) g.add(LP.mesh(new THREE.CircleGeometry(0.55, 8), chrome, st.wheels[1] + st.wheelR + 2.35, 5.4, z + 0.02)); // fuel cap
        g.add(LP.box(0.12, 0.65, 0.95, LP.mat('#3a4a5a', { metalness: 0.8, roughness: 0.15 }), st.mirrorX - 0.42, st.mirrorY, (hw + 1.05) * s)); // mirror glass
      }
      g.add(LP.cyl(0.06, 0.06, 4.5, 4, dark, rx + 3.5, st.top[st.top.length - 2][1] + 2.4, -hw + 2.5)); // antenna
    }

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
    Models.livery(g, st, opts, W, bev);

    if (opts.weapon === 'rocket') {
      const pod = Models.rocketPod();
      pod.position.set(st.cabin[1][0] - 4.2, st.cabin[1][1] + 0.35, 0);
      g.add(pod);
    } else if (opts.weapon === 'gun') {
      // Gunner: a passenger leaning out of the window with a rifle.
      const gn = Models.gunner();
      gn.position.set(st.cabin[1][0] - 2, st.cabin[1][1] - 1.6, W / 2 + 0.2);
      g.add(gn);
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

  // The body as seamless sculpted panels: the shell with its rounded corners, flared arches, roof and pillars and
  // mirrors all blend into one painted surface; the bumpers, valance, skirts and floor are one dark trim moulding.
  carBody(g, st, opts, m, W, bev, fx, rx) {
    const style = opts.style && CAR_STYLES[opts.style] ? opts.style : 'comet';
    const spoiler = opts.spoiler && opts.spoiler !== 'stock' ? opts.spoiler : st.kit.spoiler; // moulded into the body
    const sc = new Sculpt(['car', style, opts.shell ? 'shell' : 'full', m.roofMat !== m.body ? 'tt' : '', spoiler].join(':'), 0.2);
    sc.maxEdge = 1.4; // an even mesh, so hits can dent the panels
    const hw = W / 2, [wf, wr] = st.wheels, ar = st.wheelR + 0.75, cy = st.wheelR - 0.2;
    const fX = st.top[0][0], rX = st.top[st.top.length - 1][0], cab = st.cabin, cw = st.cabinW, belt = cab[0][1], roofY = cab[1][1];
    if (opts.shell) {
      const [front, rear] = shellProfiles(st, 8.5, -12.5);
      for (const prof of [front, rear]) sc.add(m.body, SDF.inflate(SDF.sideX(prof, W, 0), bev), 0.1);
    } else {
      // Shell: the side profile extruded, then rounded off (undoing the same bend the old mesh used): corners
      // pulled in towards the nose and tail, a softened shoulder, sills tucked under, plan-view corners swept back.
      const shell = SDF.inflate(SDF.sideX(bodyOutline(st), W, 0), bev);
      sc.add(m.body, SDF.warp(shell, (x, y, z) => {
        const e = Math.pow(Math.min(1, Math.abs(z) / (hw + bev)), 3);
        x += 1.8 * e * clamp((x - (fX - 4)) / 4, 0, 1) - 1.4 * e * clamp((rX + 4 - x) / 4, 0, 1);
        const tf = clamp((x - (wf + ar * 0.4)) / (fX - wf - ar * 0.4), 0, 1), tr = clamp((wr - ar * 0.4 - x) / (wr - ar * 0.4 - rX), 0, 1);
        let k = 1 - 0.11 * tf * tf - 0.08 * tr * tr;
        k -= 0.035 * clamp((y - (belt - 0.6)) / 0.8, 0, 1);
        k -= 0.03 * clamp((2.2 - y) / 1.0, 0, 1);
        return [x, y, z / k];
      }, 0.3), 0.1);
      // Flared arches swelling out of the sides.
      for (const s of [-1, 1]) for (const wc of st.wheels) {
        const band = [...archPts(wc, cy, ar + 0.55, 16), ...archPts(wc, cy, ar - 0.05, 16).reverse()];
        sc.add(m.body, SDF.sideX(band, 0.7, 0.3, [0, 0, (hw * (wc > 0 ? 0.985 : 0.99) + bev - 0.2) * s]), 0.6);
      }
      // Glasshouse frame: roof skin and pillars, leaning in as they rise, blended into the body and each other.
      const lean = (y) => 1 - 0.15 * clamp((y - belt) / (roofY - belt), 0, 1);
      const house = [SDF.inflate(SDF.sideX([[cab[1][0] - 0.2, roofY - 0.2], [cab[2][0] + 0.2, roofY - 0.2], [cab[2][0], roofY + 0.35], [cab[1][0] - 0.3, roofY + 0.35]], cw + 0.3, 0), 0.12)];
      for (const s of [-1, 1]) {
        const z = (cw / 2 + 0.1) * s;
        house.push(SDF.cone([cab[0][0], cab[0][1], z], [cab[1][0], cab[1][1], z], 0.32, 0.28)); // A-pillar
        house.push(SDF.box([0.9, roofY - cab[0][1] + 0.1, 0.45], 0.18, [st.bPillar, (roofY + cab[0][1]) / 2, z])); // B-pillar
        house.push(SDF.inflate(SDF.sideX(st.cPillar, 0.3, 0, [0, 0, z]), 0.1)); // C-pillar
      }
      for (const h of house) sc.add(m.roofMat, SDF.warp(h, (x, y, z) => [x, y, z / lean(y)], 0.2), 0.35);
      // Mirrors: a rounded housing on a stalk growing out of the door.
      for (const s of [-1, 1]) {
        sc.add(m.body, SDF.ellipsoid([0.5, 0.45, 0.7], [st.mirrorX, st.mirrorY, (hw + 0.95) * s]), 0.15);
        sc.add(m.body, SDF.cone([st.mirrorX + 0.4, st.mirrorY - 0.55, (hw - 0.1) * s], [st.mirrorX + 0.1, st.mirrorY - 0.1, (hw + 0.7) * s], 0.22, 0.16), 0.25);
      }
    }
    // Dark trim: bumpers that follow the rounded corners, the rear valance, skirts and the floor.
    const bumper = (x0, x1, y, h, half) => {
      const dir = Math.sign(x1 - x0), cut = 1.3;
      const pts = [[x0, -half], [x1 - dir * 0.3, -(half - cut)], [x1, -(half - cut - 0.4)], [x1, half - cut - 0.4], [x1 - dir * 0.3, half - cut], [x0, half]];
      return SDF.inflate(SDF.plan(dir > 0 ? pts : pts.slice().reverse(), y, y + h, 0), 0.28);
    };
    sc.add(m.dark, bumper(fx - 0.6, fx + 0.85, 1.65, 1.3, (W / 2 - 0.3) * 0.9), 0.3);
    sc.add(m.dark, bumper(rx + 0.6, rx - 0.85, 1.75, 1.3, (W / 2 - 0.3) * 0.93), 0.3);
    sc.add(m.dark, SDF.box([0.5, 0.5, W - 2.4], 0.2, [rx - 0.5, 1.4, 0]), 0.3);
    sc.add(m.dark, SDF.box([Math.abs(fx - rx) - 4, 0.6, W - 2], 0.25, [(fx + rx) / 2, 1.5, 0]), 0.3);
    if (!opts.shell) {
      const sx0 = wr + ar + 0.4, sx1 = wf - ar - 0.4;
      for (const s of [-1, 1]) sc.add(m.dark, SDF.box([sx1 - sx0, 0.7, 0.6], 0.25, [(sx0 + sx1) / 2, 1.75, (hw * 0.97 + bev - 0.1) * s]), 0.3);
      st.extras(sc, m);
    }
    Models.bodyKit(g, st, opts, m, W, bev, fx, rx, sc, style);
    sc.build(g);
  },

  // Bolt-ons: bumpers, roof gear, spoilers, exhausts, two-tone panels, mud. Bars, frames and spoilers are sculpted
  // into sc (welded tubes, spoilers moulded into the bodywork); cargo, lamps and pipes are separate parts.
  bodyKit(g, st, opts, m, W, bev, fx, rx, body, style) {
    const hw = W / 2;
    const steel = LP.mat('#8a8f94', { metalness: 0.7, roughness: 0.4 });
    const rusty = LP.mat('#6b4a32', { metalness: 0.6, roughness: 0.75 });
    const rubber = LP.mat('#111', { roughness: 1 });
    const pickKit = (k) => (opts[k] && opts[k] !== 'stock' ? opts[k] : st.kit[k]);
    const [xd, yd] = st.top[st.top.length - 3]; // rear deck
    const cab = st.cabin, cw = st.cabinW, roofTop = cab[1][1] + 0.35;
    let sc;
    const rod = (mat, a, b, r, k) => sc.add(mat, SDF.cone(a, b, r, r), k == null ? 0.25 : k);
    // Bolt-on kit pieces are their own sculpts (one per style and kind), so any mix of them costs no new body.
    const kitPiece = (kind, id, fill) => {
      if (!id || id === 'none') return;
      sc = new Sculpt(['kit', style, opts.shell ? 'shell' : 'full', kind, id].join(':'), 0.2);
      const before = g.children.length;
      fill();
      sc.build(g);
      for (const o of g.children.slice(before)) o.userData.kit = kind; // tagged so damage can knock it off
    };

    // Bumper
    const bumper = pickKit('bumper');
    kitPiece('bumper', bumper, () => {
    if (bumper === 'bullbar') {
      for (const s of [-1, 1]) rod(steel, [fx + 1.3, 1.3, 5 * s], [fx + 1.3, 6.3, 5 * s], 0.36);
      rod(steel, [fx + 1.3, st.lightY + 1.4, -6], [fx + 1.3, st.lightY + 1.4, 6], 0.36);
      rod(steel, [fx + 1.3, 3.6, -6], [fx + 1.3, 3.6, 6], 0.36);
      for (const s of [-1, 1]) rod(steel, [fx + 1.3, 2.4, 3.5 * s], [fx - 0.2, 2.4, 3.5 * s], 0.28); // mounts into the bumper
    } else if (bumper === 'pushbar') {
      for (const s of [-1, 1]) sc.add(m.dark, SDF.box([0.6, 4.6, 0.6], 0.22, [fx + 1.1, 3.4, 2.4 * s]), 0.25);
      sc.add(m.dark, SDF.box([0.6, 0.6, 6.4], 0.22, [fx + 1.1, 5.4, 0]), 0.25);
      sc.add(rubber, SDF.box([0.9, 3, 6.2], 0.35, [fx + 1.5, 3.4, 0]), 0.2);
    } else if (bumper === 'plow') {
      sc.add(rusty, SDF.inflate(SDF.sideX([[fx + 0.3, 0.6], [fx + 4.4, 0.6], [fx + 1.0, st.lightY + 0.6], [fx + 0.3, st.lightY + 0.6]], W + 0.8, 0), 0.1), 0.2);
      for (const z of [-4, 0, 4]) sc.add(rusty, SDF.sideX([[fx + 0.5, 0.7], [fx + 4.6, 0.7], [fx + 1.2, st.lightY + 0.5]], 0.3, 0.08, [0, 0, z]), 0.25);
    }

    });

    // Roof
    const roof = opts.shell ? 'none' : pickKit('roof');
    const rx0 = cab[2][0] + 0.6, rx1 = cab[1][0] - 0.6, rlen = rx1 - rx0, rmid = (rx0 + rx1) / 2;
    kitPiece('roof', roof, () => {
    if (roof === 'rails' || roof === 'rack') {
      for (const s of [-1, 1]) {
        sc.add(m.dark, SDF.box([rlen, 0.4, 0.5], 0.18, [rmid, roofTop + 0.55, (cw / 2 - 0.7) * s]), 0.2);
        for (const x of [rx0 + 0.4, rx1 - 0.4]) sc.add(m.dark, SDF.box([0.6, 0.7, 0.6], 0.2, [x, roofTop + 0.2, (cw / 2 - 0.7) * s]), 0.25);
      }
    }
    if (roof === 'rack') {
      for (const x of [rx0 + 1.5, rmid, rx1 - 1.5]) sc.add(m.dark, SDF.box([0.4, 0.35, cw - 1.2], 0.15, [x, roofTop + 0.8, 0]), 0.2);
      g.add(LP.cyl(2.3, 2.3, 1.2, 12, LP.mat('#151515', { roughness: 1 }), rmid - 2, roofTop + 1.6, -1.6)); // spare
      g.add(LP.rbox(2.2, 1.4, 1.2, 0.2, LP.mat('#4b5a2e'), rmid + 2.6, roofTop + 1.7, 2.4)); // jerrycan
      g.add(LP.rbox(2.6, 1.1, 2.4, 0.45, LP.mat('#5a4a32', { roughness: 1 }), rmid + 2.2, roofTop + 1.5, -0.6)); // tarp bundle
    } else if (roof === 'lightbar') {
      sc.add(m.dark, SDF.box([1.0, 0.7, cw - 1.5], 0.25, [rx1 - 0.8, roofTop + 0.6, 0]), 0.2);
      for (const s of [-1, 1]) sc.add(m.dark, SDF.box([0.5, 0.6, 0.5], 0.18, [rx1 - 0.8, roofTop + 0.15, (cw / 2 - 1.5) * s]), 0.25);
      [-4.2, -1.4, 1.4, 4.2].forEach((z, i) => g.add(LP.box(0.35, 0.55, 1.6, LP.glow(i % 3 === 0 ? '#ffb000' : '#fff6d8', 0.9), rx1 - 0.25, roofTop + 0.62, z)));
    } else if (roof === 'cage') {
      const r = 0.32, top = roofTop + 1.1;
      for (const x of [rx1, rx0]) {
        for (const s of [-1, 1]) rod(rusty, [x, 6.6, (hw + 0.5) * s], [x, top, (cw / 2 + 0.2) * s], r);
        rod(rusty, [x, top, -cw / 2 - 0.2], [x, top, cw / 2 + 0.2], r);
      }
      for (const s of [-1, 1]) {
        rod(rusty, [rx0, top, (cw / 2 + 0.2) * s], [rx1, top, (cw / 2 + 0.2) * s], r);
        rod(rusty, [rx1, top, (cw / 2 + 0.2) * s], [fx - 1.5, st.lightY + 1.2, (hw - 1.2) * s], r); // down to the front
      }
    }

    });

    // Spoiler: moulded spoilers blend into the bodywork; wings stand on posts.
    sc = body;
    const spoiler = pickKit('spoiler');
    if (spoiler === 'lip') {
      sc.add(m.body, SDF.inflate(SDF.sideX([[xd + 0.8, yd + 0.3], [xd + 3.7, yd + 0.6], [xd + 3.7, yd + 1.0], [xd + 0.4, yd + 0.9]], W - 2.4, 0), 0.12), 0.5);
    } else if (spoiler === 'roofspoiler' && !opts.shell) {
      const [x2, y2] = cab[2];
      sc.add(m.body, SDF.inflate(SDF.sideX([[x2 + 1.2, y2 + 0.3], [x2 - 3.6, y2 - 0.1], [x2 - 3.8, y2 - 0.7], [x2 + 0.4, y2 - 0.1]], cw - 0.8, 0), 0.12), 0.45);
    } else if (spoiler === 'ducktail') {
      sc.add(m.body, SDF.inflate(SDF.sideX([[xd + 1.9, yd + 0.2], [xd - 0.2, yd + 0.4], [xd - 0.4, yd + 1.2], [xd + 1.4, yd + 1.0]], W - 1.8, 0), 0.12), 0.6);
    } else if (spoiler === 'wing') {
      sc.add(m.body, SDF.box([3.2, 0.5, W + 0.8], 0.22, [xd + 1.4, yd + 3.0, 0]), 0.2);
      for (const s of [-1, 1]) sc.add(m.dark, SDF.box([1, 2.8, 0.6], 0.25, [xd + 1.8, yd + 1.5, (hw - 3) * s]), 0.3);
    } else if (spoiler === 'bigwing') {
      sc.add(m.dark, SDF.inflate(SDF.sideX([[xd + 0.4, yd + 5.3], [xd + 5.4, yd + 5.7], [xd + 5.4, yd + 6.5], [xd + 0.4, yd + 6.3]], W + 2.5, 0), 0.15), 0.25);
      for (const s of [-1, 1]) {
        sc.add(m.dark, SDF.box([1, 5.6, 0.7], 0.3, [xd + 3, yd + 2.8, (hw - 2.5) * s]), 0.35);
        sc.add(m.body, SDF.box([4.6, 2.2, 0.2], 0.08, [xd + 3, yd + 6.2, (hw + 1.3) * s]), 0.1); // end plates
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

  // Improvised roof-mounted rocket pod on welded brackets: one welded frame, a moulded pod with four open tubes.
  rocketPod() {
    const g = new THREE.Group();
    g.name = 'rocket pod';
    const steel = LP.mat('#5a5d52', { metalness: 0.6, roughness: 0.6 }), olive = LP.mat('#4b5a2e', { metalness: 0.3 });
    const sc = new Sculpt('rocketPod', 0.1);
    for (const s of [-1, 1]) sc.add(steel, SDF.box([6, 0.5, 0.6], 0.2, [0, 0.3, 4.5 * s]), 0.2);
    for (const x of [-2, 2]) sc.add(steel, SDF.box([0.6, 1.4, 9.6], 0.22, [x, 0.9, 0]), 0.3);
    sc.add(olive, SDF.inflate(SDF.sideX([[-4.2, 1.75], [3.6, 1.75], [4.2, 2.6], [3.6, 4.25], [-4.2, 4.25]], 4.9, 0), 0.15), 0.1);
    for (const y of [2.4, 3.6]) for (const z of [-1.3, 1.3]) sc.cut(SDF.cyl(0.5, 3, 'x', 0.06, [4.6, y, z]), 0.06, [olive]); // launch tubes
    sc.build(g);
    g.add(LP.box(0.2, 0.6, 5.2, DECALS.mat('hazard'), -1, 4.5, 0));
    for (const y of [2.4, 3.6]) for (const z of [-1.3, 1.3]) g.add(LP.mesh(new THREE.CircleGeometry(0.48, 14), LP.mat('#0b0b0b'), 3.4, y, z).rotateY(Math.PI / 2)); // tube depths
    return g;
  },

  // Welded steel crate hanging off the rear bumper; drops mines through a chute.
  mineDropper() {
    const g = new THREE.Group();
    g.name = 'mine dropper';
    const steel = LP.mat('#4a4c48', { metalness: 0.6, roughness: 0.7 }), black = LP.mat('#1a1a1a');
    const sc = new Sculpt('mineDropper', 0.1);
    sc.add(steel, SDF.inflate(SDF.sideX([[-3.85, 2.35], [-0.15, 2.35], [-0.15, 6.45], [-3.25, 6.45]], 7.7, 0), 0.15), 0.1);
    for (const s of [-1, 1]) sc.add(steel, SDF.box([1.6, 0.5, 0.5], 0.18, [0.4, 3.2, 3 * s]), 0.3); // brackets welded to the crate
    sc.add(black, SDF.box([2, 1.0, 3], 0.3, [-3.2, 1.8, 0]), 0.1); // chute
    sc.cut(SDF.box([1.4, 1.2, 2.4], 0.2, [-3.2, 1.2, 0]), 0.08, [black]);
    sc.build(g);
    g.add(LP.box(0.15, 1.2, 7.6, DECALS.mat('hazard'), -4.1, 5.4, 0));
    return g;
  },

  // A gunner leaning out of a rival's window: orange sleeve, gloved hand and a rifle, each one seamless piece.
  gunner() {
    const g = new THREE.Group();
    g.name = 'gunner';
    const suit = LP.mat('#d96a1e', { roughness: 0.95 }), gun = LP.mat('#1a1b1d', { metalness: 0.6, roughness: 0.45 }), wood = LP.mat('#3a2a1a', { roughness: 0.7 });
    const glove = LP.mat('#2c241f', { roughness: 0.6 });
    const sc = new Sculpt('gunner', 0.06);
    sc.add(suit, SDF.cone([-0.5, -0.8, -0.5], [0.4, 0.15, 0.2], 0.5, 0.38), 0.15); // shoulder and upper arm out of the window
    sc.add(suit, SDF.cone([0.4, 0.15, 0.2], [1.2, 0.5, 0.45], 0.36, 0.3), 0.15); // forearm
    sc.add(glove, SDF.ellipsoid([0.36, 0.28, 0.3], [1.45, 0.6, 0.5]), 0.1);
    sc.add(gun, SDF.lathe([[0.2, 0.6], [0.2, 4.6], [0.24, 4.7], [0.24, 5.1]], [0, 0.6, 0.5], [0, Math.PI / 2, 0]), 0.1); // barrel forward along +X
    sc.add(gun, SDF.box([1.8, 0.55, 0.45], 0.15, [0.9, 0.55, 0.5]), 0.2); // receiver
    sc.add(gun, SDF.box([0.35, 0.8, 0.3], 0.12, [1.2, 0.05, 0.5], [0, 0, -0.3]), 0.12); // magazine
    sc.add(wood, SDF.inflate(SDF.sideX([[0.2, 0.35], [-1.6, 0.25], [-1.7, -0.25], [-0.8, -0.05], [0.2, 0.05]], 0.3, 0, [0, 0.35, 0.5]), 0.1), 0.1); // stock
    sc.build(g);
    return g;
  },

  // ---------- Hand-held weapons (point down -Z) ----------

  // Compact SMG: stamped-steel receiver, perforated barrel shroud, magazine through the grip, folding wire stock.
  smg() {
    const g = new THREE.Group();
    g.name = 'smg';
    const { steel, worn, poly } = GUNTEX.mats();
    const sc = new Sculpt('smg', 0.04);
    // Stamped receiver with the top cover, sights, barrel shroud and trigger guard all welded into one shell.
    sc.add(steel, SDF.side([[-2.6, -0.55], [2.3, -0.55], [2.5, -0.3], [2.5, 0.55], [2.2, 0.75], [-2.4, 0.75], [-2.6, 0.5]], 1.05, 0.1), 0.06);
    sc.add(worn, SDF.side([[-2.2, 0.7], [1.8, 0.7], [1.7, 0.95], [-2.1, 0.95]], 0.62, 0.06), 0.05);
    for (const x of [-0.24, 0.24]) sc.add(steel, SDF.box([0.1, 0.45, 0.35], 0.04, [x, 1.05, -2.0]), 0.08); // front sight ears
    sc.add(worn, SDF.box([0.1, 0.32, 0.12], 0.04, [0, 1.0, -2.0]), 0.04); // front post
    sc.add(steel, SDF.box([0.55, 0.38, 0.3], 0.08, [0, 1.08, 1.6]), 0.1); // rear sight
    sc.cut(SDF.cyl(0.07, 0.6, 'z', 0.02, [0, 1.14, 1.6]), 0.02, [steel]); // peep hole
    sc.add(steel, SDF.lathe([[0.36, -2.4], [0.36, -3.6], [0.3, -3.68]], [0, 0.1, 0]), 0.12); // barrel shroud
    for (const z of [-2.75, -3.05, -3.35]) sc.cut(SDF.cyl(0.08, 1.0, 'x', 0.02, [0, 0.1, z]), 0.02, [steel]); // cooling holes
    sc.add(worn, SDF.lathe([[0.19, -3.55], [0.19, -4.0], [0.27, -4.02], [0.29, -4.07], [0.27, -4.12], [0.29, -4.17], [0.27, -4.22], [0.29, -4.27], [0.27, -4.32], [0.15, -4.34]], [0, 0.1, 0]), 0.03);
    sc.cut(SDF.cyl(0.11, 0.6, 'z', 0.02, [0, 0.1, -4.35]), 0.02, [worn]); // bore
    sc.add(steel, SDF.side([[0.6, -0.5], [1.55, -0.5], [1.5, -1.3], [0.55, -1.38], [0.55, -1.25], [1.36, -1.18], [1.42, -0.62], [0.6, -0.62]], 0.2, 0.05), 0.1); // trigger guard
    sc.cut(SDF.box([0.1, 0.42, 1.3], 0.04, [0.56, 0.18, -0.4]), 0.03, [steel]); // ejection port
    sc.cut(SDF.box([0.06, 0.08, 2.6], 0.02, [-0.54, 0.0, 0.2]), 0.02, [steel]); // stamped seam
    sc.cut(SDF.box([0.12, 0.1, 2.4], 0.03, [0, 0.96, -0.2]), 0.02, [worn]); // knob slot
    for (const z of [-0.9, -0.3, 0.3, 0.9]) sc.cut(SDF.box([0.5, 0.06, 0.07], 0.02, [0, 0.96, z]), 0.015, [worn]); // cover ribs
    // Grip and handguard lip in one polymer moulding, grip grooves pressed into both sides.
    sc.add(poly, SDF.side([[-0.55, -0.45], [0.45, -0.45], [0.25, -2.7], [-0.85, -2.7]], 0.9, 0.14), 0.08);
    sc.add(poly, SDF.side([[1.5, -0.45], [2.4, -0.45], [2.25, -1.0], [1.55, -1.0]], 0.8, 0.12), 0.08);
    for (const y of [-1.2, -1.6, -2.0]) sc.cut(SDF.box([1.2, 0.07, 0.85], 0.03, [0, y, 0.15 + (y + 1.2) * -0.1]), 0.02, [poly]);
    // Controls: mag release, selector, cocking knob, trigger.
    sc.add(worn, SDF.cyl(0.13, 0.12, 'x', 0.03, [-0.5, -1.0, 0.0]), 0.02);
    sc.add(worn, SDF.box([0.08, 0.16, 0.55], 0.035, [0.58, 0.35, 1.05], [0.4, 0, 0]), 0.03);
    sc.add(worn, SDF.cyl(0.12, 0.08, 'x', 0.03, [0.57, 0.35, 1.25]), 0.03);
    sc.add(worn, SDF.cyl(0.16, 0.45, 'y', 0.05, [0, 1.15, -0.9]), 0.03);
    sc.add(worn, SDF.box([0.14, 0.55, 0.16], 0.06, [0, -0.85, -0.95], [0.35, 0, 0]), 0.03);
    // Folding wire stock bent from one rod, butt plate with a rubber pad, sling loop.
    for (const sd of [-1, 1]) sc.add(worn, SDF.path([[0.4 * sd, 0.25, 2.45], [0.37 * sd, 0.05, 4.0], [0.35 * sd, -0.1, 5.2], [0.3 * sd, -0.9, 5.35]], 0.075), 0.06);
    sc.add(steel, SDF.box([0.85, 1.35, 0.2], 0.07, [0, -0.45, 5.45]), 0.08);
    sc.add(poly, SDF.box([0.9, 1.4, 0.14], 0.06, [0, -0.45, 5.58]), 0.03);
    sc.add(worn, SDF.torus(0.22, 0.055, [0, -0.25, 2.75], [0, Math.PI / 2, 0]), 0.04);
    // Magazine: its own piece, so it can drop out on a reload.
    sc.add(steel, SDF.side([[-0.42, -2.6], [0.18, -2.6], [0.02, -4.5], [-0.6, -4.5]], 0.62, 0.06), 0.04, 'mag');
    sc.add(worn, SDF.side([[-0.5, -4.48], [0.12, -4.48], [0.1, -4.75], [-0.66, -4.75]], 0.78, 0.06), 0.03, 'mag');
    sc.uv(steel, 0.35).uv(worn, 0.35).uv(poly, 0.4);
    const sets = sc.build(g);
    g.userData.mag = LP.pivot(g, sets.mag, [0, -2.7, 0.2]);
    for (const x of [-0.54, 0.54]) for (const [y, z] of [[-0.3, 2.0], [-0.3, -1.6], [0.45, 2.1], [0.45, -1.9]]) g.add(GUNTEX.screw(worn, x, y, z, 0.08));
    const barrel = new THREE.Object3D(); // muzzle marker
    barrel.position.set(0, 0.1, -4.3);
    g.add(barrel);
    g.userData.barrel = barrel;
    return g;
  },

  // RPG-style launcher: steel tube, wooden heat shields with steel bands, flared venturi, optic, finned warhead.
  launcher() {
    const g = new THREE.Group();
    g.name = 'launcher';
    const M = GUNTEX.mats({ steel: '#3a3d3a', wood: '#7a4e2a', poly: '#1c1d1c' });
    const steel = M.steel, dark = M.poly, wood = M.wood;
    const olive = LP.mat('#4b5a2e', { metalness: 0.3, roughness: 0.6 }), gold = LP.mat('#c9a227');
    const sc = new Sculpt('launcher', 0.05);
    // Tube with the sights, optic bracket and trigger guard welded on; open muzzle.
    sc.add(steel, SDF.lathe([[0.62, -5.05], [0.55, -4.9], [0.52, -4.6], [0.52, 4.4], [0.6, 4.65]], [0, 0, 0]), 0.06);
    sc.cut(SDF.cyl(0.42, 1.2, 'z', 0.04, [0, 0, -5.4]), 0.04, [steel]);
    sc.add(steel, SDF.box([0.12, 0.7, 0.12], 0.05, [0, 0.85, -4.4]), 0.12);
    sc.add(steel, SDF.box([0.4, 0.5, 0.15], 0.06, [0, 0.75, -0.9]), 0.12);
    sc.add(steel, SDF.box([0.15, 0.6, 1.8], 0.06, [-0.62, 0.3, -1.2]), 0.12);
    sc.add(steel, SDF.side([[-0.3, -0.45], [0.75, -0.45], [0.7, -1.35], [-0.25, -1.4], [-0.25, -1.28], [0.6, -1.24], [0.62, -0.6], [-0.3, -0.6]], 0.2, 0.06), 0.12);
    for (const z of [-0.45, 0.8, 2.05]) sc.add(steel, SDF.lathe([[0.94, z - 0.1], [0.96, z - 0.05], [0.96, z + 0.05], [0.94, z + 0.1]], [0, 0, 0]), 0.02);
    sc.add(steel, SDF.box([0.08, 0.2, 0.5], 0.035, [0.4, -0.75, 0.35], [-0.3, 0, 0]), 0.04); // safety
    sc.add(steel, SDF.box([0.14, 0.55, 0.16], 0.06, [0, -0.9, -0.15], [0.35, 0, 0]), 0.03); // trigger
    // Venturi bell flaring open at the back, the optic body and the front grip.
    sc.add(dark, SDF.lathe([[0.6, 4.55], [0.72, 5.0], [1.05, 5.9], [1.12, 6.2], [0.0, 6.2]], [0, 0, 0]), 0.05);
    sc.cut(SDF.lathe([[0.45, 4.7], [0.92, 5.95], [1.0, 6.4], [0, 6.4]], [0, 0, 0]), 0.04, [dark]);
    sc.add(dark, SDF.lathe([[0.32, -2.2], [0.36, -2.0], [0.32, -0.6], [0.4, -0.3], [0.28, 0.0]], [-0.95, 0.85, 0]), 0.05);
    sc.add(dark, SDF.side([[1.8, -0.45], [2.6, -0.45], [2.35, -2.25], [1.55, -2.25]], 0.7, 0.13), 0.08);
    // Wood: heat-shield sleeve and the pistol grip.
    sc.add(wood, SDF.lathe([[0.82, -0.6], [0.9, -0.4], [0.9, 2.0], [0.82, 2.2]], [0, 0, 0]), 0.05);
    sc.add(wood, SDF.side([[-1.25, -0.45], [-0.35, -0.45], [-0.6, -2.5], [-1.55, -2.5]], 0.72, 0.14), 0.05);
    // Warhead: bulbous olive body with a fuse nose, a painted band and stabiliser fins, sitting in the muzzle.
    sc.add(olive, SDF.lathe([[0.02, -2.75], [0.12, -2.7], [0.16, -2.4], [0.5, -2.1], [0.98, -1.35], [1.08, -0.9], [0.95, -0.4], [0.5, -0.05], [0.42, 0.5], [0.36, 1.0]], [0, 0, -6.3]), 0.05, 'tip');
    sc.add(gold, SDF.lathe([[1.0, -1.25], [1.1, -1.05], [1.08, -0.85]], [0, 0, -6.3]), 0.02, 'tip');
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + Math.PI / 4;
      sc.add(steel, SDF.box([0.07, 0.55, 0.7], 0.03, [-Math.sin(a) * 0.6, Math.cos(a) * 0.6, -6.3 + 0.75], [0, 0, a]), 0.06, 'tip');
    }
    sc.uv(steel, 0.3).uv(dark, 0.4).uv(wood, 0.25);
    const sets = sc.build(g);
    const tip = new THREE.Group();
    tip.position.z = -6.3;
    for (const m of sets.tip) { g.remove(m); m.position.z = 6.3; tip.add(m); }
    g.add(tip);
    g.userData.tip = tip;
    const barrel = new THREE.Object3D(); // muzzle marker
    barrel.position.set(0, 0, -5.1);
    g.add(barrel);
    g.userData.barrel = barrel;
    for (const z of [-0.45, 0.8, 2.05]) for (const a of [0, Math.PI]) g.add(GUNTEX.screw(M.worn, Math.cos(a) * 0.97, 0, z, 0.07)); // band screws
    g.add(LP.mesh(new THREE.CircleGeometry(0.27, 16), LP.glow('#5ad87a', 0.6), -0.95, 0.85, -2.21).rotateY(Math.PI));
    return g;
  },

  // Classic round fragmentation grenade: a segmented body that the fuse grows out of, a spoon and a pull ring.
  grenade() {
    const g = new THREE.Group();
    g.name = 'grenade';
    const olive = LP.mat('#3f4a2a', { roughness: 0.7 }), metal = LP.mat('#8a8f94', { metalness: 0.7, roughness: 0.35 });
    const sc = new Sculpt('grenade', 0.035);
    sc.add(olive, SDF.ellipsoid([0.95, 1.05, 0.95], [0, 0, 0]), 0.1);
    for (let k = 0; k < 3; k++) sc.cut(SDF.torus(0.95, 0.05, [0, -0.5 + k * 0.5, 0], [Math.PI / 2, 0, 0]), 0.03, [olive]); // segment grooves
    for (let k = 0; k < 3; k++) sc.cut(SDF.torus(0.98, 0.05, [0, 0, 0], [0, (k / 3) * Math.PI, 0]), 0.03, [olive]); // and down the sides
    sc.add(metal, SDF.cyl(0.42, 0.55, 'y', 0.1, [0, 1.12, 0]), 0.15); // fuse
    sc.add(metal, SDF.box([0.22, 1.7, 0.4], 0.08, [0.5, 0.5, 0], [0, 0, -0.25]), 0.12); // spoon
    sc.add(metal, SDF.torus(0.35, 0.06, [-0.4, 1.3, 0], [0, Math.PI / 2, 0]), 0.03); // pull ring
    sc.build(g);
    return g;
  },

  // Pump shotgun (classic 870-style): rounded receiver, vent-rib barrel over the magazine tube, a fat grooved
  // forend on action bars, and a straight wooden stock that narrows at the wrist and flares to the butt.
  shotgun() {
    const g = new THREE.Group();
    g.name = 'shotgun';
    const M = GUNTEX.mats({ steel: '#2a2c2e' });
    const steel = M.steel, worn = M.worn, wood = M.wood;
    const sc = new Sculpt('shotgun', 0.045);
    // Receiver: flat sides, the top rolling in, ports cut in; barrel, magazine tube and clamp all one steel piece.
    const roll = (y) => 1 - 0.22 * clamp((y - 0.15) / 0.5, 0, 1);
    sc.add(steel, SDF.warp(SDF.side([[-2.3, -0.48], [1.55, -0.48], [1.6, 0.25], [1.4, 0.5], [0.9, 0.62], [-1.6, 0.62], [-2.1, 0.5], [-2.35, 0.2]], 0.92, 0.12),
      (x, y, z) => [x / roll(y), y, z]), 0.06);
    sc.cut(SDF.box([0.14, 0.42, 1.5], 0.05, [0.47, 0.12, -0.25]), 0.03, [steel]); // ejection port
    sc.cut(SDF.box([0.55, 0.14, 1.7], 0.05, [0, -0.5, -0.2]), 0.03, [steel]); // loading port
    sc.add(steel, SDF.lathe([[0.3, -1.5], [0.28, -1.75], [0.27, -7.75], [0.29, -7.8], [0.29, -7.88], [0.2, -7.9]], [0, 0.3, 0]), 0.1);
    sc.cut(SDF.cyl(0.18, 0.8, 'z', 0.02, [0, 0.3, -7.95]), 0.02, [steel]); // bore
    sc.add(steel, SDF.lathe([[0.24, -1.5], [0.24, -6.35], [0.32, -6.4], [0.3, -6.45], [0.32, -6.5], [0.3, -6.55], [0.32, -6.6], [0.3, -6.65], [0.22, -6.7]], [0, -0.27, 0]), 0.1);
    for (let z = -2.0; z > -7.6; z -= 0.6) sc.add(steel, SDF.box([0.07, 0.14, 0.1], 0.03, [0, 0.58, z]), 0.04); // rib posts
    sc.add(worn, SDF.box([0.16, 0.06, 6.0], 0.025, [0, 0.66, -4.75]), 0.03); // vent rib
    sc.add(worn, SDF.box([0.36, 0.7, 0.3], 0.1, [0, 0.02, -5.95]), 0.04); // barrel clamp
    sc.add(worn, SDF.box([0.07, 0.22, 0.4], 0.03, [-0.47, -0.36, 1.35]), 0.02); // slide release
    sc.add(worn, SDF.path([[0, -0.72, 1.9], [0, -0.92, 1.83], [0, -1.08, 1.93]], 0.06), 0.03); // trigger
    sc.add(worn, SDF.cyl(0.09, 0.72, 'x', 0.03, [0, -0.62, 1.25]), 0.02); // cross-bolt safety
    sc.add(worn, SDF.torus(0.17, 0.045, [0, -0.62, -6.5], [0, Math.PI / 2, 0]), 0.03);
    sc.add(worn, SDF.torus(0.17, 0.045, [0, -1.6, 5.6], [0, Math.PI / 2, 0]), 0.03);
    // Trigger plate and guard moulded together at the back of the receiver, by the wrist of the stock; recoil pad.
    sc.add(M.poly, SDF.side([[-2.3, -0.45], [-1.0, -0.45], [-1.15, -0.72], [-2.2, -0.72]], 0.7, 0.08), 0.06);
    sc.add(M.poly, SDF.path([[0, -0.66, 1.35], [0, -1.12, 1.48], [0, -1.24, 1.95], [0, -1.08, 2.3], [0, -0.8, 2.45]], 0.075), 0.1);
    sc.add(M.poly, SDF.side([[-6.9, 0.22], [-7.2, 0.24], [-7.22, -2.0], [-6.9, -1.98]], 0.9, 0.08), 0.04);
    // Stock: smooth straight stock with a comb, narrowing at the wrist.
    const stockPts = chaikin([[-2.25, 0.5], [-3.2, 0.32], [-5.4, 0.22], [-6.95, 0.18], [-6.98, -0.6], [-6.95, -1.95], [-5.6, -1.62], [-3.6, -0.9], [-2.7, -0.62], [-2.3, -0.5]], 2, 0.2);
    const fat = (y, z) => { const t = clamp((z - 2.4) / 3.6, 0, 1); return (0.68 + 0.32 * t) * (1 - 0.25 * clamp(y / 0.3, 0, 1) * t); };
    sc.add(wood, SDF.warp(SDF.side(stockPts, 0.86, 0.16), (x, y, z) => [x / fat(y, z), y, z]), 0.04);
    // Pistol grip dropping from the wrist, raked back, growing out of the stock (a modern pump gun's stock).
    sc.add(wood, SDF.side(chaikin([[-2.32, -0.35], [-3.35, -0.55], [-3.5, -1.9], [-3.35, -2.08], [-2.78, -2.1], [-2.62, -1.95]], 1, 0.25).concat([[-2.32, -0.35]]), 0.7, 0.2), 0.35);
    // Forend: fat, grooved, slightly oval, riding on two action bars back into the receiver.
    const pump = [[0.36, -2.15]];
    for (let k = 0; k <= 12; k++) pump.push([k % 2 ? 0.5 : 0.56, -2.3 - k * 0.2]);
    pump.push([0.4, -4.85]);
    sc.add(M.checker, SDF.warp(SDF.lathe(pump, [0, -0.24, 0]), (x, y, z) => [x / 0.86, y, z]), 0.04, 'pump');
    for (const x of [-0.3, 0.3]) sc.add(worn, SDF.box([0.06, 0.12, 2.3], 0.025, [x, -0.12, -1.1]), 0.02, 'pump');
    sc.uv(steel, 0.3).uv(worn, 0.3).uv(M.poly, 0.4).uv(wood, 0.22).uv(M.checker, 0.8);
    const sets = sc.build(g);
    g.userData.pump = LP.pivot(g, sets.pump, [0, 0, 0]);
    for (const x of [-0.47, 0.47]) for (const z of [1.0, -1.0]) g.add(GUNTEX.screw(worn, x, -0.25, z, 0.07));
    g.add(LP.mesh(new THREE.SphereGeometry(0.08, 10, 6), LP.mat('#c9a443', { metalness: 0.9, roughness: 0.25 }), 0, 0.73, -7.6));
    const barrel = new THREE.Object3D(); // muzzle marker
    barrel.position.set(0, 0.3, -7.9);
    g.add(barrel);
    g.userData.barrel = barrel;
    return g;
  },

  // 12-gauge flare pistol (Orion style): a long thick barrel that hinges down to load, sitting on a moulded frame
  // whose breech block humps up behind it; the raked grip with a beavertail and finger swell, inset checkered
  // panels and a flared butt; a big moulded trigger guard; a small spur hammer at the back.
  flareGun() {
    const g = new THREE.Group();
    g.name = 'flare gun';
    const orange = LP.mat('#e0661f', { roughness: 0.4 });
    const frameMat = LP.mat('#d55e1c', { roughness: 0.5 });
    const grip = LP.mat('#1c1c1c', { map: GUNTEX.get('checker'), roughness: 0.8 });
    const black = LP.mat('#161616', { roughness: 0.5 });
    const steel = LP.mat('#7a7c7e', { map: GUNTEX.get('steel'), metalness: 0.7, roughness: 0.35 });
    const sc = new Sculpt('flare', 0.035);
    const R = (pts) => chaikin(pts.concat([pts[0]]), 2, 0.22); // round every corner of a side outline
    // Barrel: plain thick tube from the breech face, a raised ring at the muzzle, a sight rib on top, open bore.
    sc.add(orange, SDF.lathe([[0.36, 0.3], [0.42, 0.24], [0.42, -3.1], [0.47, -3.18], [0.47, -3.5], [0.4, -3.58]], [0, 0.3, 0]), 0.05, 'barrel');
    sc.add(orange, SDF.box([0.12, 0.1, 3.0], 0.04, [0, 0.74, -1.55]), 0.12, 'barrel');
    sc.add(orange, SDF.box([0.1, 0.2, 0.3], 0.04, [0, 0.8, -3.25]), 0.08, 'barrel'); // front sight blade
    sc.add(orange, SDF.box([0.3, 0.26, 0.5], 0.1, [0, -0.08, -0.05]), 0.15, 'barrel'); // hinge lug under the breech
    sc.cut(SDF.cyl(0.32, 1.4, 'z', 0.03, [0, 0.3, -3.6]), 0.03, [orange]);
    // Frame: breech block (wide) and grip (narrower) blended into one moulding.
    const breech = R([[-1.05, 0.84], [-0.3, 0.8], [-0.3, -0.14], [0.45, -0.14], [0.5, -0.36], [-0.3, -0.46], [-1.42, -0.2], [-1.42, 0.58]]);
    sc.add(frameMat, SDF.side(breech, 1.04, 0.24), 0.1);
    const gripPts = R([[-0.3, -0.3], [-0.46, -0.72], [-0.52, -1.0], [-0.47, -1.18], [-0.6, -1.5], [-0.75, -2.28], [-0.7, -2.5], [-1.76, -2.5],
      [-1.74, -2.3], [-1.5, -1.0], [-1.44, -0.1], [-1.5, 0.3], [-1.56, 0.45], [-1.2, 0.3]]);
    sc.add(frameMat, SDF.side(gripPts, 0.88, 0.3), 0.3);
    sc.add(frameMat, SDF.box([0.98, 0.2, 1.16], 0.09, [0, -2.47, 1.23], [-0.19, 0, 0]), 0.15); // flared butt
    // Trigger guard: a thick moulded loop from under the frame round to the front strap.
    sc.add(frameMat, SDF.path([[0, -0.3, -0.35], [0, -0.68, -0.5], [0, -1.02, -0.3], [0, -1.12, 0.12], [0, -1.02, 0.52]], 0.1), 0.18);
    sc.cut(SDF.cyl(0.5, 0.06, 'z', 0.01, [0, 0.3, 0.27]), 0.01, [frameMat]); // seam round the breech face
    // Checkered panels set into pockets either side of the grip.
    for (const sd of [-1, 1]) {
      sc.cut(SDF.box([0.2, 1.55, 0.72], 0.1, [0.44 * sd, -1.38, 1.08], [-0.19, 0, 0]), 0.03, [frameMat]);
      sc.add(grip, SDF.box([0.1, 1.5, 0.68], 0.06, [0.39 * sd, -1.38, 1.08], [-0.19, 0, 0]), 0.02);
    }
    sc.uv(grip, 1.2);
    // Spur hammer at the back of the breech, trigger, barrel release lever.
    sc.add(black, SDF.box([0.2, 0.36, 0.3], 0.09, [0, 0.74, 1.3]), 0.06);
    sc.add(black, SDF.path([[0, 0.8, 1.36], [0, 0.88, 1.52], [0, 0.88, 1.68]], 0.075), 0.08); // spur, grooved by the thumb
    sc.add(black, SDF.path([[0, -0.42, 0.02], [0, -0.64, -0.06], [0, -0.86, 0.06]], 0.08), 0.03);
    sc.add(black, SDF.box([0.1, 0.16, 0.55], 0.05, [-0.55, 0.55, 0.75], [0.15, 0, 0]), 0.03);
    const sets = sc.build(g);
    const bore = LP.mesh(new THREE.CircleGeometry(0.31, 20), LP.mat('#050505'), 0, 0.3, -2.9).rotateY(Math.PI);
    g.add(bore);
    g.userData.barrelGrp = LP.pivot(g, [...sets.barrel, bore], [0, -0.1, -0.25]); // tips down about the hinge pin
    // A spent cartridge, shown while reloading.
    const shell = LP.cyl(0.33, 0.33, 1.1, 16, LP.mat('#c9a443', { metalness: 0.7, roughness: 0.3 }));
    shell.rotation.x = Math.PI / 2;
    shell.visible = false;
    g.add(shell);
    g.userData.shell = shell;
    for (const sd of [-1, 1]) g.add(GUNTEX.screw(steel, 0.45 * sd, -1.38, 1.08, 0.07));
    // Hinge pin and lanyard ring.
    g.add(LP.cyl(0.1, 0.1, 1.08, 16, steel, 0, -0.1, -0.25).rotateZ(Math.PI / 2));
    g.add(LP.mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 16), steel, 0, -2.66, 1.5).rotateY(Math.PI / 2));
    const barrel = new THREE.Object3D(); // muzzle marker
    barrel.position.set(0, 0.3, -3.6);
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
      flare: { mag: [0, -2.2, 0.0], side: [0.6, 0.25, -1.0], muzzle: [0, 0.3, -3.6], under: [0, -0.3, -2.4] },
    }[weaponId];
    const steel = LP.mat('#2b2d30', { metalness: 0.6, roughness: 0.45 });
    const add = (m) => { m.userData.modVis = true; gun.add(m); return m; };
    // Each attachment is a small sculpt (cached per gun and mod); glowing strips and the beam stay plain.
    const part = (id, fill) => {
      const sc = new Sculpt('mod:' + weaponId + ':' + id, 0.03), g = new THREE.Group();
      fill(sc);
      sc.build(g);
      g.traverse((o) => { if (o.isMesh) o.userData.modVis = true; });
      gun.add(g);
      return g;
    };
    const v = (p, d) => [p[0] + (d[0] || 0), p[1] + (d[1] || 0), p[2] + (d[2] || 0)];
    for (const id of mods.filter(Boolean)) {
      if (id === 'ext_mag') {
        if (weaponId === 'smg') part(id, (sc) => { // a longer magazine with a bumper pad
          sc.add(steel, SDF.box([0.6, 2.4, 0.92], 0.1, A.mag), 0.05);
          sc.add(LP.mat('#1a1a1a', { roughness: 0.9 }), SDF.box([0.72, 0.3, 1.05], 0.12, v(A.mag, [0, -1.25, 0])), 0.05);
          for (let k = 0; k < 4; k++) sc.cut(SDF.box([0.7, 0.06, 0.6], 0.02, v(A.mag, [0, 0.8 - k * 0.45, 0])), 0.01);
        });
        else part(id, (sc) => { // canvas shell pouch with a flap
          const canvas = LP.mat('#4a3a24', { roughness: 1 });
          sc.add(canvas, SDF.box([0.9, 1.6, 2.2], 0.25, A.mag), 0.05);
          sc.add(canvas, SDF.box([1.0, 0.5, 2.3], 0.2, v(A.mag, [0, 0.7, 0])), 0.1);
          sc.add(LP.mat('#8a8f94', { metalness: 0.7 }), SDF.cyl(0.12, 0.1, 'x', 0.03, v(A.mag, [0.5, 0.4, 0])), 0.02); // snap
        });
      } else if (id === 'quick_mag') {
        part(id, (sc) => { // a spare mag taped alongside
          sc.add(steel, SDF.box([0.5, 1.2, 0.8], 0.08, v(A.side, [0.25, -0.8, 0])), 0.04);
          sc.add(LP.mat('#d9b52c', { roughness: 0.9 }), SDF.box([0.6, 0.25, 0.9], 0.06, v(A.side, [0.25, -0.8, 0])), 0.02);
        });
      } else if (id === 'incendiary') {
        add(LP.rbox(0.06, 0.35, 2.2, 0.025, LP.glow('#ff6a1a', 0.6), A.side[0] - 0.02, A.side[1], A.side[2]));
      } else if (id === 'ap_rounds') {
        add(LP.rbox(0.06, 0.35, 1.4, 0.025, LP.mat('#3fc8c0', { metalness: 0.6 }), A.side[0] - 0.02, A.side[1] - 0.4, A.side[2]));
      } else if (id === 'laser') {
        part(id, (sc) => { // laser module on a rail clamp, lens at the front
          sc.add(steel, SDF.box([0.35, 0.32, 0.9], 0.1, A.under), 0.04);
          sc.add(steel, SDF.box([0.22, 0.2, 0.5], 0.06, v(A.under, [0, 0.2, 0.1])), 0.08);
          sc.add(LP.mat('#3a3d40', { metalness: 0.7 }), SDF.cyl(0.13, 0.12, 'z', 0.03, v(A.under, [0, 0, -0.48])), 0.03);
        });
        add(LP.mesh(new THREE.CircleGeometry(0.09, 16), LP.glow('#ff2020', 1.5), A.under[0], A.under[1], A.under[2] - 0.55).rotateY(Math.PI));
        if (beam) {
          const b = LP.mesh(new THREE.BoxGeometry(0.03, 0.03, 80), new THREE.MeshBasicMaterial({ color: '#ff2020', transparent: true, opacity: 0.35, depthWrite: false }), A.under[0], A.under[1], A.under[2] - 40.5);
          add(b);
        }
      } else if (id === 'choke') {
        part(id, (sc) => { // knurled choke tube with flats
          sc.add(steel, SDF.lathe([[0.38, -0.3], [0.42, -0.25], [0.42, 0.25], [0.38, 0.3]], A.muzzle), 0.02);
          for (let k = 0; k < 6; k++) sc.cut(SDF.box([0.9, 0.06, 0.5], 0.01, A.muzzle, [0, 0, (k / 6) * Math.PI]), 0.01);
          sc.cut(SDF.cyl(0.24, 0.8, 'z', 0.01, A.muzzle), 0.02);
        });
      } else if (id === 'homing') {
        part(id, (sc) => { // seeker box with a whip antenna
          sc.add(steel, SDF.box([0.4, 0.5, 0.8], 0.12, A.side), 0.04);
          sc.add(steel, SDF.path([v(A.side, [0, 0.2, 0.2]), v(A.side, [0.02, 0.7, 0.25]), v(A.side, [0.05, 1.25, 0.32])], 0.03), 0.06);
        });
        add(LP.mesh(new THREE.CircleGeometry(0.08, 12), LP.glow('#ff2020', 1.2), A.side[0], A.side[1] + 0.2, A.side[2] - 0.41).rotateY(Math.PI));
      } else if (id === 'suppressor') {
        part(id, (sc) => { // can with end caps and a bore
          sc.add(steel, SDF.lathe([[0.32, 0.05], [0.42, -0.05], [0.42, -2.45], [0.36, -2.55], [0.2, -2.6]], A.muzzle), 0.04);
          for (let k = 0; k < 3; k++) sc.cut(SDF.torus(0.43, 0.025, v(A.muzzle, [0, 0, -0.6 - k * 0.6])), 0.01);
          sc.cut(SDF.cyl(0.11, 0.5, 'z', 0.01, v(A.muzzle, [0, 0, -2.6])), 0.02);
        });
      } else if (id === 'tracer') {
        add(LP.rbox(0.06, 0.3, 1.8, 0.025, LP.glow('#7aff5a', 0.8), A.side[0] - 0.02, A.side[1] + 0.35, A.side[2]));
      } else if (id === 'hair_trigger') {
        part(id, (sc) => sc.add(LP.mat('#c22a1a', { metalness: 0.4 }), SDF.box([0.2, 0.5, 0.3], 0.08, v(A.under, [0, -0.2, 2.0])), 0.04));
      } else if (id === 'sawn_off') {
        const tape = DECALS.mat('tape', { roughness: 1 });
        part(id, (sc) => {
          sc.add(tape, SDF.box([1.0, 1.0, 0.5], 0.3, v(A.muzzle, [0, -0.2, 1.2])), 0.05);
          sc.add(steel, SDF.warp(SDF.box([0.9, 0.35, 0.3], 0.08, v(A.muzzle, [0, 0.2, 0.2])), (x, y, z) => [x, y - 0.08 * Math.sin(x * 9), z], 0.1), 0.04); // ragged hacksaw edge
        });
      } else if (id === 'slugs') {
        part(id, (sc) => {
          for (let k = 0; k < 4; k++) {
            const p = v(A.side, [0.1, -0.2, -0.6 + k * 0.4]);
            sc.add(LP.mat(k % 2 ? '#b8862a' : '#7a2a1a', { metalness: 0.5 }), SDF.cyl(0.16, 0.7, 'y', 0.05, p), 0.02);
          }
        });
      } else if (id === 'bunker_buster') {
        part(id, (sc) => sc.add(LP.mat('#5a5e62', { metalness: 0.7 }), SDF.lathe([[0.02, -1.5], [0.25, -1.1], [0.5, -0.4], [0.55, 0.0], [0.4, 0.1]], A.muzzle), 0.03));
      } else if (id === 'twin_tube') {
        part(id, (sc) => {
          sc.add(LP.mat('#3a4a2a'), SDF.lathe([[0.75, 2.2], [0.68, 2.0], [0.68, -5.2], [0.75, -5.4]], [A.side[0] + 0.8, A.side[1] + 0.2, 0]), 0.03);
          sc.cut(SDF.cyl(0.55, 0.6, 'z', 0.04, [A.side[0] + 0.8, A.side[1] + 0.2, -5.4]), 0.04);
          for (const z of [-4.2, 1.2]) sc.add(steel, SDF.box([0.9, 0.4, 0.4], 0.12, [A.side[0] + 0.35, A.side[1] + 0.2, z]), 0.15); // clamps welded to both tubes
        });
      } else if (id === 'remote_det') {
        part(id, (sc) => {
          sc.add(LP.mat('#d9b52c'), SDF.box([0.5, 0.6, 0.9], 0.15, v(A.side, [0, -0.4, 1.0])), 0.04);
          sc.add(steel, SDF.path([v(A.side, [0, -0.1, 1.2]), v(A.side, [0, 1.2, 1.2])], 0.03), 0.06);
        });
        add(LP.mesh(new THREE.SphereGeometry(0.08, 10, 8), LP.glow('#ffcf3a', 1.4), A.side[0], A.side[1] + 1.25, A.side[2] + 1.2));
      } else if (id === 'long_burn') {
        part(id, (sc) => {
          sc.add(LP.mat('#d9601e'), SDF.cyl(0.35, 1.4, 'z', 0.08, v(A.under, [0, -0.2, 0])), 0.03);
          sc.add(LP.mat('#c9a443', { metalness: 0.7 }), SDF.cyl(0.37, 0.2, 'z', 0.04, v(A.under, [0, -0.2, 0.7])), 0.02);
        });
      } else if (id === 'phosphor') {
        add(LP.rbox(0.06, 0.4, 1.6, 0.025, LP.glow('#f4f8ff', 1.0), A.side[0] - 0.02, A.side[1], A.side[2]));
      } else if (id === 'cluster') {
        part(id, (sc) => {
          for (let k = 0; k < 3; k++) sc.add(LP.mat('#d9601e'), SDF.cyl(0.18, 0.9, 'z', 0.06, v(A.side, [0.1, -0.3 - k * 0.4, 0.8])), 0.02);
          sc.add(LP.mat('#2a2a2a'), SDF.box([0.15, 1.2, 0.3], 0.05, v(A.side, [0.0, -0.7, 0.8])), 0.06); // their bandolier strap
        });
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
    const sc = new Sculpt('orn:' + id, 0.035);
    let pivot = [0, 0, 0], axis = 'z', stiff = false;
    if (id === 'hula') {
      const skin = m3('#c98a5a'), grass = m3('#6a8a2a', { roughness: 1 }), lei = m3('#ff5a8a'), hair = m3('#1a120a');
      sc.add(m3('#3a2a1a'), SDF.lathe([[0.95, 0], [1.0, 0.2], [0.9, 0.3], [0, 0.3]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.05);
      // Grass skirt: a flared cone ruffled into strands.
      sc.add(grass, SDF.warp(SDF.cone([0, 0.3, 0], [0, 1.6, 0], 0.75, 0.3), (x, y, z) => { const a = Math.atan2(z, x), k = 1 + 0.08 * Math.sin(a * 14); return [x / k, y, z / k]; }, 0.1), 0.05);
      pivot = [0, 1.6, 0];
      sc.add(skin, SDF.cone([0, 1.6, 0], [0, 2.4, 0], 0.3, 0.26), 0.12, 'sway'); // torso
      sc.add(m3('#d84a6a'), SDF.ellipsoid([0.28, 0.16, 0.36], [0.06, 2.35, 0]), 0.08, 'sway'); // top
      sc.add(skin, SDF.ellipsoid([0.38, 0.42, 0.38], [0, 3.0, 0]), 0.14, 'sway'); // head
      sc.add(hair, SDF.ellipsoid([0.42, 0.46, 0.42], [-0.1, 3.1, 0]), 0.06, 'sway');
      sc.add(hair, SDF.cone([-0.2, 3.0, 0], [-0.3, 2.3, 0], 0.28, 0.14), 0.15, 'sway'); // long hair down her back
      sc.add(lei, SDF.torus(0.33, 0.09, [0, 2.6, 0], [Math.PI / 2, 0, 0]), 0.02, 'sway');
      for (const sd of [-1, 1]) sc.add(skin, SDF.path([[0, 2.45, 0.28 * sd], [0.05, 2.75, 0.55 * sd], [0.12, 3.05, 0.72 * sd]], 0.09), 0.1, 'sway'); // arms up, swaying
    } else if (id === 'dog') {
      const fur = m3('#7a5a3a'), pale = m3('#e8e0c8'), ear = m3('#4a3420'), black = m3('#111111');
      sc.add(fur, SDF.box([2.2, 1.15, 1.05], 0.45, [0, 0.6, 0]), 0.1);
      sc.add(pale, SDF.ellipsoid([0.3, 0.26, 0.06], [0.6, 0.55, 0.52]), 0.04); // spot
      for (const [x, z] of [[0.8, 0.35], [0.8, -0.35], [-0.8, 0.35], [-0.8, -0.35]]) sc.add(fur, SDF.cone([x, 0.4, z], [x + 0.1, 0.05, z], 0.18, 0.16), 0.15); // legs tucked
      pivot = [0.9, 1.25, 0];
      axis = 'nod';
      sc.add(fur, SDF.ellipsoid([0.55, 0.48, 0.46], [1.3, 1.55, 0]), 0.1, 'sway'); // head
      sc.add(pale, SDF.ellipsoid([0.32, 0.25, 0.28], [1.8, 1.42, 0]), 0.14, 'sway'); // snout
      sc.add(black, SDF.ellipsoid([0.1, 0.08, 0.1], [2.1, 1.5, 0]), 0.03, 'sway'); // nose
      for (const z of [-0.5, 0.5]) sc.add(ear, SDF.ellipsoid([0.2, 0.42, 0.08], [1.15, 1.35, z], [z * 0.6, 0, 0]), 0.08, 'sway'); // floppy ears
      for (const z of [-0.2, 0.2]) sc.add(black, SDF.ellipsoid([0.06, 0.07, 0.06], [1.75, 1.7, z]), 0.02, 'sway');
    } else if (id === 'saint') {
      const robe = m3('#3a5a9a'), skin = m3('#e8c8a0'), plinth = m3('#d8d0b8');
      sc.add(plinth, SDF.lathe([[0.65, 0], [0.7, 0.25], [0.6, 0.3], [0, 0.3]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.05);
      pivot = [0, 0.3, 0];
      stiff = true;
      sc.add(robe, SDF.warp(SDF.cone([0, 0.3, 0], [0, 2.2, 0], 0.6, 0.26), (x, y, z) => { const a = Math.atan2(z, x), k = 1 + 0.05 * Math.sin(a * 7 + y * 2); return [x / k, y, z / k]; }, 0.05), 0.05, 'sway'); // folded robe
      sc.add(robe, SDF.ellipsoid([0.36, 0.32, 0.34], [-0.02, 2.4, 0]), 0.12, 'sway'); // hood
      sc.add(skin, SDF.ellipsoid([0.22, 0.26, 0.22], [0.2, 2.36, 0]), 0.05, 'sway');
      sc.add(skin, SDF.path([[0.25, 1.5, -0.18], [0.42, 1.55, 0], [0.25, 1.5, 0.18]], 0.08), 0.12, 'sway'); // praying hands
    } else {
      const bone = m3('#e0d8c0'), black = m3('#0a0a0a');
      sc.add(m3('#2a2a2a'), SDF.lathe([[0.75, 0], [0.8, 0.18], [0.7, 0.25], [0, 0.25]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.05);
      pivot = [0, 0.25, 0];
      stiff = true;
      sc.add(bone, SDF.ellipsoid([0.85, 0.78, 0.7], [-0.05, 1.05, 0]), 0.1, 'sway'); // cranium
      sc.add(bone, SDF.box([0.75, 0.42, 0.95], 0.2, [0.32, 0.55, 0]), 0.3, 'sway'); // cheekbones and upper jaw
      sc.add(bone, SDF.box([0.6, 0.3, 0.7], 0.14, [0.35, 0.25, 0]), 0.12, 'sway'); // jaw
      for (const z of [-0.3, 0.3]) sc.cut(SDF.ellipsoid([0.2, 0.2, 0.17], [0.72, 0.98, z]), 0.06, [bone]); // eye sockets
      sc.cut(SDF.ellipsoid([0.1, 0.16, 0.08], [0.8, 0.68, 0]), 0.04, [bone]); // nose hole
      for (const z of [-0.3, 0.3]) sc.add(black, SDF.ellipsoid([0.08, 0.15, 0.12], [0.6, 0.98, z]), 0.02, 'sway');
      for (let k = 0; k < 5; k++) sc.cut(SDF.box([0.2, 0.18, 0.03], 0.01, [0.64, 0.4, -0.24 + k * 0.12]), 0.01, [bone]); // teeth gaps
    }
    const sets = sc.build(g);
    const sway = LP.pivot(g, sets.sway || [], pivot);
    if (id === 'saint') sway.add(LP.mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 20), LP.glow('#ffd86a', 0.8), -0.2, 2.25, 0).rotateY(Math.PI / 2)); // halo
    sway.userData.axis = axis;
    if (stiff) sway.userData.stiff = true;
    g.userData.sway = sway;
    return g;
  },

  // First-person hands: leather tactical gloves and orange prison-jumpsuit sleeves, posed on each gun's grips.
  // 'pistol' wraps a grip (axis = local Y, right hand); 'support' cradles a tube or handguard from below (axis = Z,
  // left hand, palm up). Mirrored by scale.x = -1. pose = { grip: [half width, half depth], tube: radius,
  // trigger: fingertip target (hand-local) }: the fingers are laid round that gun's real grip.
  hand(kind, arm, pose) {
    const g = new THREE.Group();
    const leather = LP.mat('#ffffff', { vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
    leather.userData.psxKind = 'vinyl'; // retro mode: a leathery grain, not stone
    const glove = Models.gloveGeo(kind, leather, arm, pose || {}); // meshed once per grip, shared after that
    glove.sc.build(g);
    const opts = { side: THREE.DoubleSide };
    const buckle = LP.mat('#8a8a86', { metalness: 0.8, roughness: 0.35 });
    const suit = LP.mat('#d6631d', Object.assign({ roughness: 0.95 }, opts)), cuff = LP.mat('#b4521a', Object.assign({ roughness: 0.95 }, opts));
    const dir = new THREE.Vector3(...arm).normalize(), L = new THREE.Vector3(...arm).length();
    const along = (d) => glove.wrist.clone().addScaledVector(dir, d).toArray();
    // Buckle on top of the wrist strap (top = away from the palm, across the arm).
    const up = new THREE.Vector3(...glove.top).projectOnPlane(dir).normalize();
    const bk = LP.rbox(0.2, 0.06, 0.26, 0.03, buckle, 0, 0, 0);
    bk.position.set(...along(0.11)).addScaledVector(up, 0.47);
    bk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    g.add(bk);
    g.add(LP.limb([along(0.6), along(0.85), along(1.1)], [0.58, 0.64, 0.6], cuff, (t, a) => 1 + 0.05 * Math.sin(a * 5 + 1))); // rolled cuff
    g.add(LP.limb([along(0.95), along(L * 0.45), along(L)], [0.6, 0.7, 0.78], suit,
      (t, a) => 1 + 0.045 * Math.sin(a * 3 + t * 9) + 0.03 * Math.sin(a * 7 - t * 14))); // sleeve with cloth folds
    g.traverse((o) => { if (o.isMesh) o.userData.modVis = true; });
    return g;
  },

  // The glove as a single blended surface: every bone (phalanges, metacarpals, thumb, wrist) is a tapered round cone;
  // each finger blends into the palm with a soft web but stays creased against its neighbours. A moulded knuckle
  // guard and the wrist strap are blended in, and the panels, seams and stitching are painted into the vertex colours.
  // The skeleton is fitted to the grip: fingers are laid round its real cross-section by bone length.
  gloveGeo(kind, leather, arm, pose) {
    const V = (a) => new THREE.Vector3(...a), lerp = (a, b, t) => V(a).lerp(V(b), t).toArray();
    const r2 = (a) => (a ? a.map((v) => Math.round(v * 100) / 100) : null);
    const key = 'glove:' + kind + ':' + JSON.stringify([r2(arm), r2(pose.grip), pose.tube, r2(pose.trigger)]);
    const palm = [], fingers = [], guard = [];
    const bone = (list, a, b, ra, rb) => list.push({ a, b, ra, rb });
    const chain = (j, rs) => { const f = []; for (let i = 0; i < j.length - 1; i++) bone(f, j[i], j[i + 1], rs[i], rs[i + 1]); fingers.push(f); return f; };
    // Walk a finger round an ellipse (half axes ex, ez, in the plane of axes u/v) by bone lengths from angle a0.
    const wrap = (pt, ex, ez, a0, k0, lens, aMax) => {
      const out = [pt(a0, k0)];
      let a = a0, prev = pt(a0, 1);
      for (const L of lens) {
        let d = 0;
        while (d < L && a < aMax) { a += 0.01; const q = pt(a, 1); d += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]); prev = q; }
        out.push(pt(a, 1));
      }
      return out;
    };
    const LENS = [0.5, 0.38, 0.28];
    let w, radial, knuckles = [], top;
    if (kind === 'pistol') {
      // Grip axis is local Y; angle 0 = right side (back of the hand), PI/2 = front strap, PI = left side.
      const [rx, rz] = pose.grip || [0.4, 0.48];
      const ex = rx + 0.16, ez = rz + 0.16, sx = (rx + 0.2) / 0.6, sz = (rz + 0.2) / 0.68;
      const S = (p) => [p[0] * sx, p[1], p[2] * sz]; // the base skeleton, stretched to this grip
      radial = (x, y, z) => [x / ex, 0, z / ez];
      const F = [[0.1, 0.15], [-0.25, 0.14], [-0.58, 0.12]]; // [height, radius]
      const bases = [[0.64, -0.1, 0.64], [0.62, -0.32, 0.64], [0.57, -0.5, 0.6]];
      F.forEach(([y, r], i) => {
        const sc = i === 2 ? 0.82 : i === 1 ? 0.95 : 1; // the pinky is shorter
        const j = wrap((a, k) => [ex * k * Math.cos(a), y - (a - 0.18) * 0.03, -ez * k * Math.sin(a)], ex, ez, 0.18, 1.12, LENS.map((l) => l * sc), 2.9);
        chain(j, [r * 1.18, r * 1.12, r * 1.06, r * 0.98]);
        bone(palm, S(bases[i]), j[0], 0.17, r * 1.18);
        knuckles.push(j[0]);
      });
      // Trigger finger: from its knuckle forward along the frame, then curled in onto the trigger.
      const M = S([0.6, 0.36, -0.2]);
      let ix;
      if (pose.trigger) {
        let T = V(pose.trigger);
        const reach = 1.22;
        if (T.distanceTo(V(M)) > reach) T = V(M).add(T.clone().sub(V(M)).setLength(reach));
        const C = [(M[0] + T.x) / 2 + 0.12, (M[1] + T.y) / 2 + 0.08, T.z + 0.18];
        const bez = (t) => [0, 1, 2].map((i) => (1 - t) * (1 - t) * M[i] + 2 * (1 - t) * t * C[i] + t * t * T.getComponent(i));
        ix = [M, bez(0.48), bez(0.8), bez(1)];
      } else {
        ix = wrap((a, k) => [ex * k * Math.cos(a), 0.42 - (a - 0.18) * 0.03, -ez * k * Math.sin(a)], ex, ez, 0.18, 1.12, LENS, 2.9);
      }
      chain(ix, [0.165, 0.158, 0.15, 0.14]);
      bone(palm, S([0.62, 0.12, 0.62]), ix[0], 0.17, 0.155);
      knuckles.unshift(ix[0]);
      bone(palm, S([0.55, -0.5, 0.62]), S([0.22, -0.42, 0.66]), 0.2, 0.17); // heel of the palm round the back strap
      bone(palm, S([0.62, -0.3, 0.62]), S([0.6, -0.5, 1.0]), 0.3, 0.36); // wrist
      // Thumb: its metacarpal and muscle run over the top of the grip, then two bones down the left side.
      const T = [[0.5, 0.0, 0.72], [-0.2, 0.44, 0.46], [-0.55, 0.36, -0.02], [-0.58, 0.27, -0.34]].map(S);
      bone(palm, T[0], T[1], 0.22, 0.18);
      chain(T.slice(1), [0.185, 0.175, 0.16]);
      w = S([0.6, -0.55, 1.08]);
      top = [1, 0, 0];
    } else {
      // Tube axis is local Z; angle 0 = straight below, PI/2 = right side.
      const R = pose.tube || 0.43, er = R + 0.14, s2 = (R + 0.25) / 0.68;
      const S = (p) => [p[0] * s2, p[1] * s2, p[2]];
      radial = (x, y) => [x, y, 0];
      const F = [[-0.55, 0.14], [-0.19, 0.145], [0.17, 0.14], [0.5, 0.12]]; // [z, radius]
      const bases = [-0.18, 0.04, 0.26, 0.46];
      F.forEach(([z, r], i) => {
        const sc = i === 3 ? 0.82 : i === 0 ? 0.95 : 1;
        const j = wrap((a, k) => [er * k * Math.sin(a), -er * k * Math.cos(a), z + 0.04 - (a - 0.72) * 0.03], er, er, 0.72, 1.15, LENS.map((l) => l * sc), 2.75);
        chain(j, [r * 1.18, r * 1.12, r * 1.06, r * 0.98]);
        bone(palm, S([-0.18, -0.68, bases[i]]), j[0], 0.17, r * 1.18);
        knuckles.push(j[0]);
      });
      bone(palm, S([-0.18, -0.7, 0.46]), S([-0.12, -0.8, 0.85]), 0.19, 0.2); // heel
      bone(palm, S([-0.15, -0.72, 0.3]), S([-0.08, -0.9, 1.0]), 0.26, 0.34); // wrist
      // Thumb along the left side of the tube, pointing forward.
      const T = [[-0.12, -0.78, 0.62], [-0.53, -0.5, 0.2], [-0.6, -0.18, -0.2], [-0.57, -0.04, -0.52]].map(S);
      bone(palm, T[0], T[1], 0.2, 0.17);
      chain(T.slice(1), [0.18, 0.17, 0.155]);
      w = S([-0.08, -0.92, 1.08]);
      top = [0, -1, 0];
    }
    // Gauntlet up the wrist with a raised strap.
    const dir = V(arm).normalize(), along = (d) => V(w).addScaledVector(dir, d).toArray();
    bone(palm, along(-0.3), along(0.72), 0.42, 0.47);
    const strap = { a: along(0.02), b: along(0.2), ra: 0.465, rb: 0.465 };
    // Knuckle guard: a moulded ridge with a boss over each knuckle, standing just proud of the leather.
    const gp = knuckles.map((k) => { const r = V(radial(...k)).normalize(); return V(k).addScaledVector(r, 0.11).toArray(); });
    for (let i = 0; i < gp.length - 1; i++) bone(guard, gp[i], gp[i + 1], 0.075, 0.075);
    for (const p of gp) bone(guard, p, lerp(p, along(0), 0.22), 0.085, 0.06); // each boss tails back over the hand
    const S = LP.smin, RC = LP.roundCone, d1 = (b, x, y, z) => RC(x, y, z, b.a, b.b, b.ra, b.rb);
    // Bounding spheres let far-away bones be skipped: a bone can't matter if even its nearest point is too far.
    const bound = (list) => {
      for (const b of list) {
        b.c = lerp(b.a, b.b, 0.5);
        b.R = V(b.a).distanceTo(V(b.b)) / 2 + Math.max(b.ra, b.rb);
      }
      const c = list.reduce((m, b) => m.add(V(b.c)), new THREE.Vector3()).multiplyScalar(1 / list.length);
      list.c = c.toArray(); list.R = Math.max(...list.map((b) => V(b.c).distanceTo(c) + b.R));
    };
    [palm, guard, ...fingers].forEach(bound);
    const lb = (o, x, y, z) => { const dx = x - o.c[0], dy = y - o.c[1], dz = z - o.c[2]; return Math.sqrt(dx * dx + dy * dy + dz * dz) - o.R; };
    const sdf = (x, y, z) => {
      let p = 1e9;
      for (const b of palm) if (lb(b, x, y, z) < p + 0.14) p = S(p, d1(b, x, y, z), 0.14);
      let best = p;
      for (const f of fingers) {
        if (lb(f, x, y, z) > Math.min(best + 0.03, p + 0.1)) continue;
        let d = 1e9;
        for (const b of f) if (lb(b, x, y, z) < d) d = Math.min(d, d1(b, x, y, z)); // bones share a sphere at each joint: no knuckle bulge
        best = Math.min(best, S(p, d, 0.1)); // web into the palm, crease against the next finger
      }
      if (lb(guard, x, y, z) < best + 0.06) {
        let gd = 1e9;
        for (const b of guard) if (lb(b, x, y, z) < gd + 0.08) gd = S(gd, d1(b, x, y, z), 0.08);
        best = S(best, gd, 0.05);
      }
      return S(best, d1(strap, x, y, z), 0.02);
    };
    // Colours: back leather, lighter suede palm, dark side seams with a stitched thread line, black guard, strap.
    const C = (h) => new THREE.Color(h);
    const back = C('#3a2f28'), palmC = C('#5e5750'), seam = C('#17130f'), thread = C('#9a8f7e'), guardC = C('#161515'), strapC = C('#463c34');
    const near = (b, x, y, z) => { // closest point on the bone's axis: [t, distance along, offset vector]
      const ab = V(b.b).sub(V(b.a)), len = ab.length(), q = new THREE.Vector3(x, y, z).sub(V(b.a));
      const t = Math.max(0, Math.min(1, q.dot(ab) / (len * len)));
      return [t, t * len, q.sub(ab.multiplyScalar(t)).normalize()];
    };
    const color = (x, y, z) => {
      let gd = 1e9;
      for (const b of guard) gd = Math.min(gd, d1(b, x, y, z));
      if (gd < 0.008) return guardC;
      if (d1(strap, x, y, z) < 0.012) return strapC;
      let bb = null, bd = 1e9, bf = null;
      for (const b of palm) { const d = d1(b, x, y, z); if (d < bd) { bd = d; bb = b; bf = null; } }
      for (const f of fingers) for (const b of f) { const d = d1(b, x, y, z); if (d < bd) { bd = d; bb = b; bf = f; } }
      const [t, s0, q] = near(bb, x, y, z);
      if (bb === palm[palm.length - 1]) { // gauntlet: a stitched hem near the cuff end
        const l = t * V(bb.b).distanceTo(V(bb.a));
        return Math.abs(l - 0.88) < 0.03 ? seam : Math.abs(l - 0.82) < 0.025 && Math.sin(l * 0 + Math.atan2(q.y, q.x) * 18) > 0 ? thread : back;
      }
      const dor = V(radial(x, y, z)).normalize(), s = q.dot(dor);
      if (Math.abs(s) < 0.1) return seam;
      if (s > 0 && s < 0.2 && Math.sin(s0 * 70) > 0) return thread;
      if (s < 0) return palmC;
      return back;
    };
    const all = palm.concat(guard, [strap], ...fingers);
    const box = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const b of all) for (const p of [b.a, b.b]) for (let i = 0; i < 3; i++) {
      const m = Math.max(b.ra, b.rb) + 0.1;
      box[i] = Math.min(box[i], p[i] - m); box[i + 3] = Math.max(box[i + 3], p[i] + m);
    }
    // Full density: the seams and stitching live in the vertex colours.
    const sc = new Sculpt(key, 0.028);
    sc.add(leather, { d: sdf, box }, 0.0001).opt(leather, { decimate: false, color, uv: 0.4 });
    return { sc, wrist: V(w), top };
  },

  // One round of spare ammo for the door rack, standing upright (y up): an SMG mag, a 12-gauge shell,
  // a rocket warhead or a flare cartridge.
  ammoItem(id) {
    const g = new THREE.Group();
    const brass = LP.mat('#c9a443', { metalness: 0.8, roughness: 0.3 });
    const sc = new Sculpt('ammo:' + id, 0.02);
    if (id === 'smg') { // stamped magazine with ribs, a base plate and the top round showing
      const steel = LP.mat('#2b2d30', { map: GUNTEX.get('steel'), metalness: 0.65, roughness: 0.4 });
      sc.add(steel, SDF.box([0.3, 1.05, 0.2], 0.04, [0, 0, 0]), 0.02);
      for (const y of [-0.25, 0.1]) sc.cut(SDF.box([0.4, 0.04, 0.1], 0.01, [0, y, 0]), 0.01, [steel]);
      sc.add(LP.mat('#4a4d52', { metalness: 0.8, roughness: 0.3 }), SDF.box([0.36, 0.13, 0.25], 0.05, [0, -0.55, 0]), 0.03);
      sc.add(brass, SDF.lathe([[0.05, -0.06], [0.05, 0.02], [0.03, 0.08]], [0, 0.55, 0], [-Math.PI / 2, 0, 0]), 0.02);
    } else if (id === 'shotgun') { // red hull, crimped top, brass head with a rim
      const hull = LP.mat('#a8221a', { roughness: 0.6 });
      sc.add(hull, SDF.lathe([[0.12, -0.2], [0.13, -0.18], [0.13, 0.28], [0.1, 0.32], [0.03, 0.33]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.02);
      for (let k = 0; k < 6; k++) sc.cut(SDF.box([0.02, 0.06, 0.3], 0.005, [0, 0.32, 0], [0, (k / 6) * Math.PI, 0]), 0.005, [hull]); // crimp folds
      sc.add(brass, SDF.lathe([[0.14, -0.35], [0.15, -0.33], [0.15, -0.3], [0.135, -0.29], [0.135, -0.15]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.01);
    } else if (id === 'rocket') { // warhead with fuse nose and a painted band
      sc.add(LP.mat('#4b5a2e', { metalness: 0.3, roughness: 0.6 }), SDF.lathe([[0.02, -0.75], [0.08, -0.7], [0.3, -0.35], [0.34, -0.1], [0.24, 0.12], [0.13, 0.25], [0.13, 0.6]], [0, 0, 0], [Math.PI / 2, 0, 0]), 0.03);
      sc.add(LP.mat('#c9a227'), SDF.lathe([[0.33, -0.24], [0.35, -0.2], [0.34, -0.16]], [0, 0, 0], [Math.PI / 2, 0, 0]), 0.01);
    } else { // flare cartridge
      sc.add(LP.mat('#d9601e', { roughness: 0.5 }), SDF.lathe([[0.16, -0.24], [0.17, -0.22], [0.17, 0.33], [0.14, 0.36], [0.0, 0.37]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.02);
      sc.add(brass, SDF.lathe([[0.19, -0.38], [0.2, -0.35], [0.18, -0.33], [0.175, -0.2]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.01);
    }
    sc.build(g);
    return g;
  },

  // Where the hands go on each gun (gun space): kind, position, x tilt of the grip axis, the grip's half width and
  // depth (or a tube radius for a cradling hand), the trigger the index finger rests on, the forearm towards the
  // shoulder, and whether it is a mirrored (left) pistol hand.
  GRIPS: {
    smg: [
      { kind: 'pistol', pos: [0, -1.45, 0.15], tilt: -0.12, grip: [0.45, 0.52], trigger: [0, -0.82, -1.1], arm: [-0.6, -2.6, 5.6] },
      { kind: 'support', pos: [0, -0.74, -1.95], tilt: 0, tube: 0.53, arm: [-6.8, -3.2, 5.0] },
    ],
    shotgun: [
      { kind: 'pistol', pos: [0, -1.25, 2.98], tilt: -0.2, grip: [0.35, 0.46], trigger: [0, -0.92, 1.74], arm: [-0.6, -3.6, 4.0] },
      { kind: 'support', pos: [0, -0.24, -3.5], tilt: 0, tube: 0.5, arm: [-7.2, -3.4, 5.4] },
    ],
    rocket: [
      { kind: 'pistol', pos: [0, -1.45, 0.95], tilt: -0.15, grip: [0.36, 0.46], trigger: [0, -0.9, -0.3], arm: [-0.6, -2.8, 6.0] },
      { kind: 'pistol', pos: [0, -1.35, -1.95], tilt: -0.15, grip: [0.35, 0.42], arm: [-7.4, -3.0, 5.6], mirror: true },
    ],
    flare: [
      { kind: 'pistol', pos: [0, -1.3, 1.04], tilt: -0.19, grip: [0.45, 0.5], trigger: [0, -0.64, -0.14], arm: [-0.5, -3.0, 5.0] },
    ],
  },

  hands(gun, weaponId) {
    const X = new THREE.Vector3(1, 0, 0);
    for (const G of Models.GRIPS[weaponId] || []) {
      const s = G.mirror ? -1 : 1;
      const local = (p, isDir) => { // gun space -> the hand's own (unmirrored) frame
        const v = new THREE.Vector3(...p);
        if (!isDir) v.sub(new THREE.Vector3(...G.pos));
        v.applyAxisAngle(X, -G.tilt);
        v.x *= s;
        return v.toArray();
      };
      const h = Models.hand(G.kind, local(G.arm, true), { grip: G.grip, tube: G.tube, trigger: G.trigger && local(G.trigger) });
      if (G.mirror) h.scale.x = -1;
      h.position.set(...G.pos);
      h.rotation.x = G.tilt;
      h.userData.rest = { pos: h.position.clone(), rot: G.tilt };
      (gun.userData.hands = gun.userData.hands || []).push(h);
      gun.add(h);
    }
    return gun;
  },

  weapon(id) {
    return id === 'shotgun' ? Models.shotgun() : id === 'rocket' ? Models.launcher() : id === 'flare' ? Models.flareGun() : Models.smg();
  },

  // ---------- Trinkets (each hangs or sits somewhere in the cabin) ----------

  rocket(color) {
    const g = new THREE.Group();
    g.name = 'rocket';
    const body = LP.mat(color || '#dddddd', { metalness: 0.3 }), red = LP.mat('#ff5a3c'), fin = LP.mat('#333333');
    const sc = new Sculpt('rocket', 0.08);
    // Along +X: body, a red ogive nose, four swept fins blended onto the tail, a nozzle.
    sc.add(body, SDF.lathe([[1.0, -3.6], [1.1, -3.3], [1.1, 3.4]], [0, 0, 0], [0, Math.PI / 2, 0]), 0.1);
    sc.add(red, SDF.lathe([[1.1, 3.35], [1.0, 4.2], [0.7, 5.2], [0.3, 5.9], [0.02, 6.1]], [0, 0, 0], [0, Math.PI / 2, 0]), 0.05);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU;
      sc.add(fin, SDF.sideX([[-3.8, 0], [-1.6, 0], [-2.6, 1.9], [-3.9, 2.1]], 0.2, 0.06, [0, 0, 0], [a, 0, 0]), 0.3);
    }
    sc.add(fin, SDF.lathe([[0.6, -4.2], [0.85, -3.7], [0.95, -3.5]], [0, 0, 0], [0, Math.PI / 2, 0]), 0.1);
    const sets = sc.build(g);
    const flame = LP.mesh(new THREE.OctahedronGeometry(1.6, 0), new THREE.MeshBasicMaterial({ color: '#ffb13b' }), -4.9, 0, 0);
    flame.scale.set(1.6, 0.8, 0.8);
    g.add(flame);
    g.userData.body = sets.main[0];
    return g;
  },

  mine() {
    const g = new THREE.Group();
    g.name = 'mine';
    const metal = LP.mat('#2a2a2a', { metalness: 0.6, roughness: 0.5 }), steel = LP.mat('#9aa0a6', { metalness: 0.7 });
    const sc = new Sculpt('mine', 0.18);
    sc.add(metal, SDF.lathe([[7.5, 0], [7.4, 1.6], [6.6, 2.4], [4.2, 2.6], [3.8, 3.4], [0, 3.4]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.3);
    for (let k = 0; k < 8; k++) sc.cut(SDF.box([0.3, 1.2, 1.4], 0.1, [Math.cos((k / 8) * TAU) * 7.4, 1.0, Math.sin((k / 8) * TAU) * 7.4], [0, -(k / 8) * TAU, 0]), 0.1, [metal]); // grip slots
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + Math.PI / 4;
      sc.add(steel, SDF.cone([Math.cos(a) * 5, 2.3, Math.sin(a) * 5], [Math.cos(a) * 5, 3.9, Math.sin(a) * 5], 0.45, 0.06), 0.25); // trip spikes
    }
    sc.build(g);
    const led = LP.mesh(new THREE.SphereGeometry(0.8, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff2a2a' }), 0, 3.6, 0);
    g.add(led);
    g.userData.led = led;
    return g;
  },

  // ---------- Trinkets & cabin props ----------

  grenadeCrate() {
    const g = new THREE.Group();
    g.name = 'grenade crate';
    const wood = LP.mat('#4a5a2a'), slat = LP.mat('#3b4822');
    const sc = new Sculpt('crate', 0.06);
    sc.add(wood, SDF.box([4.2, 1.4, 3.6], 0.15, [0, 0, 0]), 0.05);
    sc.cut(SDF.box([3.8, 1.0, 3.2], 0.1, [0, 0.5, 0]), 0.05, [wood]); // open top
    for (const x of [-1.6, 0, 1.6]) sc.add(slat, SDF.box([0.3, 1.5, 3.7], 0.08, [x, 0, 0]), 0.05);
    for (let k = 0; k < 3; k++) sc.cut(SDF.box([4.4, 0.04, 3.8], 0.01, [0, -0.45 + k * 0.45, 0]), 0.01, [wood]); // plank seams
    sc.add(LP.mat('#d8c27a'), SDF.box([1.2, 0.5, 0.12], 0.04, [0, 0, 1.83]), 0.02); // stencil plate
    sc.build(g);
    g.userData.nades = [];
    for (let k = 0; k < 3; k++) {
      const n = Models.grenade();
      n.scale.setScalar(0.5);
      n.position.set(-1.1 + k * 1.1, 0.6, 0);
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
    // The cabin as sculpted pieces: the painted shell (pillars, roof, rear deck, cowl) is one surface; the dash with
    // its lip, the sills, console and steering column are one moulding; each seat is one upholstered piece.
    const sc = new Sculpt('interior' + (noRoof ? ':open' : ''), 0.15);
    const floorM = m3('#15161a'), head = m3('#4a4740');
    sc.add(floorM, SDF.box([34, 1, 17], 0.3, [-1, 1, 0]), 0.1);
    sc.add(dark, SDF.box([5, 2.6, 17.2], 0.6, [6.5, 5, 0]), 0.3); // dashboard
    sc.add(dark, SDF.box([3.5, 0.7, 17.2], 0.3, [5.6, 6.45, 0]), 0.5); // dash top lip, rolled into the dash
    sc.add(dark, SDF.box([10, 3.6, 3], 0.6, [0.5, 3.7, 0]), 0.3); // centre console
    sc.add(dark, SDF.cone([6, 5.6, -4.5], [3.6, 7.5, -4.5], 0.45, 0.38), 0.4); // steering column out of the dash
    for (const s of [-1, 1]) {
      sc.add(body, SDF.cone([8.4, 6.6, 8.6 * s], [2.5, 12.6, 8.2 * s], 0.6, 0.55), 0.6); // A-pillars
      sc.add(body, SDF.box([1.4, 7.4, 1.4], 0.5, [-4, 9.05, 8.6 * s]), 0.6); // B-pillars
      sc.add(body, SDF.cone([-12, 12.6, 8.4 * s], [-16.5, 7, 8.6 * s], 0.7, 0.7), 0.6); // C-pillars
      sc.add(trim, SDF.box([22, 5.5, 0.8], 0.3, [-3.5, 3.6, 8.9 * s]), 0.2); // door cards
      sc.add(dark, SDF.box([22, 0.8, 1.6], 0.35, [-3.5, 6.4, 8.4 * s]), 0.4); // window sills
    }
    if (!noRoof) {
      sc.add(body, SDF.box([14.6, 0.8, 17.4], 0.35, [-4.75, 12.95, 0]), 0.6); // roof
      sc.add(head, SDF.box([14.6, 0.3, 16], 0.12, [-4.75, 12.5, 0]), 0.1); // headliner
    }
    sc.add(body, SDF.box([2, 2, 17.2], 0.7, [-17.2, 6.5, 0]), 0.6); // rear deck
    sc.add(body, SDF.box([4.5, 0.6, 17], 0.25, [8.8, 6.6, 0]), 0.6); // cowl under the windshield
    // Seats: rear bench, the empty driver's seat, your cushion (its back would fill the view when you turn round).
    sc.add(seat, SDF.box([5, 4, 16], 1.0, [-9.5, 4, 0]), 0.5);
    sc.add(seat, SDF.box([1.5, 4.5, 16], 0.6, [-12, 6.8, 0]), 0.6);
    for (const z of [-4.5, 4.5]) {
      sc.add(seat, SDF.box([6, 1.6, 6], 0.7, [-1.5, 3.6, z]), 0.4);
      if (z > 0) continue;
      sc.add(seat, SDF.box([1.6, 8, 6], 0.7, [-4.6, 8, z], [0, 0, 0.12]), 0.8);
      sc.add(seat, SDF.box([1.4, 2.2, 4], 0.6, [-5.2, 11.2, z]), 0.3); // headrest
    }
    // Welded roll cage: A-pillar tubes, main hoop behind the seats, diagonal brace, door X-bars; welds are fillets.
    const rusty = LP.mat('#6b4a32', { metalness: 0.6, roughness: 0.7 });
    const tube = (a, b) => sc.add(rusty, SDF.cone(a, b, 0.32, 0.32), 0.35);
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
    // Steering wheel: rim and spokes as one piece (it turns on its own).
    const wheelM = m3('#141414', { roughness: 0.6 });
    sc.add(wheelM, SDF.torus(2.6, 0.32, [0, 0, 0]), 0.2, 'wheel');
    sc.add(wheelM, SDF.cone([-2.4, 0, 0], [2.4, 0, 0], 0.26, 0.26), 0.35, 'wheel');
    sc.add(wheelM, SDF.cone([0, 0, 0], [0, -2.4, 0], 0.26, 0.26), 0.35, 'wheel');
    sc.add(wheelM, SDF.cyl(0.7, 0.5, 'z', 0.2, [0, 0, 0]), 0.3, 'wheel'); // hub
    const parts = sc.build(I);
    const wheelTilt = new THREE.Group();
    wheelTilt.position.set(3.4, 7.7, -4.5);
    wheelTilt.rotation.z = 0.45;
    const wheelFace = new THREE.Group();
    wheelFace.rotation.y = Math.PI / 2;
    const wheel = new THREE.Group();
    for (const m of parts.wheel) { I.remove(m); wheel.add(m); }
    wheelFace.add(wheel);
    wheelTilt.add(wheelFace);
    I.add(wheelTilt);
    refs.wheel = wheel;

    // A bare bulb hanging from the headliner on a cable.
    const bulb = new THREE.Group();
    bulb.position.set(-7.5, 12.3, -1.5);
    bulb.add(beam([0, 0, 0], [0, -1.6, 0], 0.08, m3('#111')));
    bulb.add(LP.cyl(0.25, 0.25, 0.4, 6, m3('#8a8f94', { metalness: 0.7 }), 0, -1.7, 0));
    const glass = LP.lathe([[0.02, -2.75], [0.3, -2.62], [0.46, -2.35], [0.42, -2.05], [0.22, -1.86], [0.2, -1.8]], 20, LP.glow(cab.bulb, 1.4)).rotateX(Math.PI / 2); // pear-shaped bulb
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
    const tapeMat = DECALS.mat('tape', { roughness: 1 });
    // Bolted steel plate over the passenger door card, with rivets.
    I.add(box(9, 2.8, 0.3, DECALS.mat('rust', { metalness: 0.5, roughness: 0.8 }), -0.6, 3.2, 8.25));
    for (const x of [-4.6, -1.8, 1, 3.6]) for (const y of [2.2, 4.2]) I.add(LP.mesh(new THREE.IcosahedronGeometry(0.16, 0), rusty, x, y, 8.05));

    // Wire mesh over the rear side windows.
    for (const s of [-1, 1]) {
      const mesh = LP.mesh(new THREE.PlaneGeometry(6.5, 4.6), LP.mat('#ffffff', { map: DECALS.get('mesh'), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.5 }), -9.6, 9.4, 8.35 * s);
      I.add(mesh);
    }

    // Shackle bolted to the floor by your feet: plate, a chain of interlocking links, an ankle cuff with a hinge.
    const iron = LP.mat('#3a3b3c', { metalness: 0.7, roughness: 0.5 });
    const shk = new Sculpt('shackle', 0.03);
    shk.add(iron, SDF.lathe([[0.7, 0], [0.7, 0.18], [0.55, 0.3], [0, 0.3]], [2.8, 1.7, 6.4], [-Math.PI / 2, 0, 0]), 0.05);
    shk.add(iron, SDF.torus(0.22, 0.07, [2.8, 2.08, 6.4], [0, 0.6, 0]), 0.05); // eye on the plate
    const links = 9;
    for (let k = 0; k < links; k++) {
      const t = k / (links - 1), p = [lerp(2.8, 1.2, t), 2.0 + Math.sin(t * Math.PI) * 0.25, lerp(6.4, 4.5, t)];
      shk.add(iron, SDF.torus(0.2, 0.06, p, [k % 2 ? Math.PI / 2 : 0, 0.6, 0]), 0.005);
    }
    shk.add(iron, SDF.torus(0.7, 0.16, [0.9, 2.2, 4.2], [Math.PI / 2, 0, 0.3]), 0.02); // cuff
    shk.add(iron, SDF.cyl(0.24, 0.5, 'y', 0.08, [1.55, 2.2, 4.5]), 0.08); // its hinge
    shk.build(I);

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
    const cans = new Sculpt('cans', 0.045);
    for (const [x, z, r] of [[2.4, -6.4, 0.4], [-6.2, 5.6, 1.6], [-6.4, -2.0, 2.4]]) { // crushed flat underfoot
      cans.add(can, SDF.warp(SDF.lathe([[0.36, -0.6], [0.42, -0.5], [0.42, 0.5], [0.34, 0.6], [0, 0.6]], [x, 2.05, z], [0, r, 0.3]), (px, py, pz) => [px, 2.05 + (py - 2.05) / 0.55, pz], 0.3), 0.02);
    }
    cans.build(I);
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
    // Sun visors, gear stick in its gaiter, handbrake, door cards (armrest, pull handle, window crank, speaker).
    const chromeI = m3('#8a8f94', { metalness: 0.7 }), blackI = m3('#111111'), headM = m3('#4a4740');
    const det = new Sculpt('cabin-details', 0.065);
    for (const z of [-4.4, 4.4]) det.add(headM, SDF.box([2.6, 0.3, 5.4], 0.14, [1.6, 12.1, z], [0, 0, 0.25]), 0.1);
    det.add(blackI, SDF.warp(SDF.cone([4.6, 5.4, 0], [4.55, 6.3, 0], 0.85, 0.3), (x, y, z) => { const k = 1 + 0.08 * Math.sin(y * 18); return [4.6 + (x - 4.6) / k, y, z / k]; }, 0.1), 0.2); // pleated gaiter
    det.add(chromeI, SDF.cone([4.58, 5.9, 0], [4.2, 7.3, 0], 0.13, 0.11), 0.1);
    det.add(blackI, SDF.ellipsoid([0.42, 0.38, 0.42], [4.18, 7.55, 0]), 0.12); // knob
    det.add(plastic, SDF.box([2.6, 0.45, 0.6], 0.2, [2.0, 5.85, 0.9], [0, 0, 0.25]), 0.15); // handbrake
    det.add(plastic, SDF.cyl(0.18, 0.5, 'z', 0.06, [3.1, 6.2, 0.9]), 0.1); // its button
    for (const sd of [-1, 1]) {
      const z = 8.45 * sd;
      det.add(fabric, SDF.box([7, 0.6, 0.9], 0.25, [-2.5, 5.0, z - 0.3 * sd]), 0.15); // armrest
      det.add(chromeI, SDF.path([[1.7, 5.6, z - 0.05 * sd], [2.2, 5.65, z - 0.3 * sd], [2.7, 5.6, z - 0.05 * sd]], 0.08), 0.05); // pull handle
      det.add(plastic, SDF.cyl(0.25, 0.3, 'z', 0.08, [-1, 4.1, z - 0.25 * sd]), 0.05); // crank boss
      det.add(chromeI, SDF.path([[-1, 4.1, z - 0.4 * sd], [-1, 3.55, z - 0.42 * sd], [-1, 3.0, z - 0.4 * sd]], 0.06), 0.08); // crank arm
      det.add(plastic, SDF.cyl(0.14, 0.4, 'z', 0.06, [-1, 3.0, z - 0.6 * sd]), 0.06); // knob
    }
    det.build(I);
    for (const sd of [-1, 1]) I.add(LP.mesh(new THREE.CircleGeometry(0.9, 20), m3('#0e0f10'), 3.8, 2.6, 8.45 * sd - 0.42 * sd).rotateY(-Math.PI / 2 * sd)); // speaker grille

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
    const bark = LP.mat('#4e3a28'), leaves = ['#2f5a26', '#36652c', '#2a4f22'].map((c) => LP.mat(c, { roughness: 1 }));
    const sc = new Sculpt('tree' + (seed || 3), 0.5);
    // Trunk flaring into roots, two boughs, and a lumpy canopy of overlapping leaf masses.
    sc.add(bark, SDF.cone([0, 0, 0], [0, 30, 0], 2.8, 1.5), 0.2);
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.3; sc.add(bark, SDF.cone([0, 0.5, 0], [Math.cos(a) * 4.5, 0, Math.sin(a) * 4.5], 1.4, 0.5), 1.5); }
    sc.add(bark, SDF.cone([0, 18, 0], [6, 26, 2], 1.0, 0.6), 1.0);
    sc.add(bark, SDF.cone([0, 22, 0], [-5, 29, -2], 0.9, 0.5), 1.0);
    [[0, 36, 0, 12], [6, 30, 3, 9], [-5, 32, -3, 9], [2, 42, -2, 8], [-2, 27, 4, 7]].forEach(([x, y, z, r]) => {
      const m = leaves[Math.floor(rng() * 3)];
      sc.add(m, SDF.warp(SDF.ellipsoid([r, r * 0.85, r], [x, y, z]), (px, py, pz) => { const n = 1 + 0.12 * Math.sin(px * 0.7 + seed) * Math.sin(py * 0.6) * Math.sin(pz * 0.8); return [x + (px - x) / n, y + (py - y) / n, z + (pz - z) / n]; }, r * 0.15), 3);
    });
    sc.build(g);
    return g;
  },

  pine() {
    const g = new THREE.Group();
    g.name = 'pine';
    const sc = new Sculpt('pine', 0.45);
    const leaf = LP.mat('#24463a', { roughness: 1 }), snow = LP.mat('#e9eef2');
    sc.add(LP.mat('#3e2c1e'), SDF.cone([0, 0, 0], [0, 16, 0], 2.0, 1.2), 0.2);
    [[14, 12, 10], [12, 11, 18], [10, 10, 25], [7.5, 9, 31], [5, 8, 37]].forEach(([r, h, y], i) => {
      // Each tier droops at the edge and is ragged with boughs.
      sc.add(leaf, SDF.warp(SDF.cone([0, y - h / 2, 0], [0, y + h / 2, 0], r, 0.3), (x, yy, z) => { const a = Math.atan2(z, x), k = 1 + 0.12 * Math.sin(a * 9 + i); return [x / k, yy, z / k]; }, 1), 0.3);
      sc.add(snow, SDF.cone([0, y + h * 0.05, 0], [0, y + h * 0.52, 0], r * 0.5, 0.25), 0.4);
    });
    sc.build(g);
    return g;
  },

  cactus() {
    const g = new THREE.Group();
    g.name = 'cactus';
    const green = LP.mat('#4f8a3c');
    const sc = new Sculpt('cactus', 0.4);
    // Ribbed column with two arms that elbow up; all one fleshy piece.
    const ribs = (part) => SDF.warp(part, (x, y, z) => { const a = Math.atan2(z, x), k = 1 + 0.06 * Math.cos(a * 10); return [x / k, y, z / k]; }, 0.3);
    sc.add(green, ribs(SDF.cone([0, 0, 0], [0, 34, 0], 4.0, 3.4)), 0.3);
    for (const [sd, y, h] of [[1, 14, 12], [-1, 20, 10]]) {
      sc.add(green, SDF.path([[sd * 2, y, 0], [sd * 7, y + 0.5, 0], [sd * 9, y + 3, 0], [sd * 9, y + h, 0]], 2.3), 1.5);
    }
    sc.build(g);
    return g;
  },

  rock(seed) {
    const g = new THREE.Group();
    g.name = 'rock';
    const sc = new Sculpt('rock' + (seed || 11), 0.5);
    const rng = mulberry32(seed || 11), stone = LP.mat('#a07a4d', { roughness: 1 });
    // A weathered boulder: a few overlapping masses with cracks.
    for (let k = 0; k < 4; k++) sc.add(stone, SDF.box([14 + rng() * 8, 7 + rng() * 4, 10 + rng() * 6], 3, [(rng() - 0.5) * 8, 3.5 + rng() * 2, (rng() - 0.5) * 6], [rng() * 0.3, rng() * 3, rng() * 0.3]), 2.5);
    sc.cut(SDF.box([0.6, 12, 20], 0.2, [2, 6, 0], [0.2, 0.5, 0.1]), 0.4);
    sc.build(g);
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
