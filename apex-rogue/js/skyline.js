'use strict';
// The city around the track: the skyline ring on the horizon (it rides with the camera) and a district of nearer
// buildings in the world between the track and the horizon. Both are built from a kit of shaded boxes, cylinders
// and spheres merged into one mesh each, with facades from an atlas of four styles per act (lit windows glow),
// billboards from an atlas of ads, and beacons. Acts I-II are the dystopian undercity (brutalist megablocks,
// refineries, the plate overhead); acts III-IV the upper city (glass towers with setbacks, twists, sky gardens
// and gold crowns, domed palaces). Blimps drift past with the sponsors' ads.

const SKY_TILE = 120; // world units per facade tile

// ---------- The kit: parts merged into one geometry ----------
class CityKit {
  constructor(rng) { this.rng = rng; this.parts = []; }
  // style: facade (0-3) or -1 for none; ad: billboard cell (0-7) or -1; glow: 1 for self-lit; far: 0-1 haze.
  add(geo, x, y, z, ry, color, o) {
    o = o || {};
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, ry || 0, o.rz || 0)), new THREE.Vector3(1, 1, 1));
    this.parts.push({ geo, m, color: new THREE.Color(color), style: o.style ?? -1, ad: o.ad ?? -1, glow: o.glow ? 1 : 0, far: o.far || 0 });
  }
  // A box whose facade tiles at a constant size on every face.
  box(w, h, d, x, y, z, ry, color, o) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / SKY_TILE, uv.getY(i) * dims[f][1] / SKY_TILE); }
    this.add(g, x, y, z, ry, color, o);
  }
  cyl(rt, rb, h, seg, x, y, z, ry, color, o) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, false), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (TAU * rb) / SKY_TILE, uv.getY(i) * h / SKY_TILE);
    this.add(g, x, y, z, ry, color, o);
  }
  sphere(r, x, y, z, color, o, half) { this.add(new THREE.SphereGeometry(r, 12, half ? 5 : 8, 0, TAU, 0, half ? Math.PI / 2 : Math.PI), x, y, z, 0, color, o); }
  cone(r, h, seg, x, y, z, color, o) { this.add(new THREE.ConeGeometry(r, h, seg), x, y, z, 0, color, o); }
  lathe(pts, seg, x, y, z, color, o) { this.add(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg), x, y, z, 0, color, o); }
  // A flat billboard facing direction ry (its front is +Z before rotation).
  board(w, h, x, y, z, ry, ad, o) { this.add(new THREE.PlaneGeometry(w, h), x, y, z, ry, '#ffffff', Object.assign({ ad, glow: 1 }, o)); }

  mesh(material) {
    const P = [], N = [], C = [], U = [], S = [], A = [], G = [], F = [];
    for (const p of this.parts) {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      g.applyMatrix4(p.m);
      if (!g.attributes.normal) g.computeVertexNormals();
      const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        P.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        N.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        C.push(p.color.r, p.color.g, p.color.b);
        U.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
        S.push(p.style); A.push(p.ad); G.push(p.glow); F.push(p.far);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('aCol', new THREE.Float32BufferAttribute(C, 3));
    geo.setAttribute('aUv', new THREE.Float32BufferAttribute(U, 2));
    geo.setAttribute('aStyle', new THREE.Float32BufferAttribute(S, 1));
    geo.setAttribute('aAd', new THREE.Float32BufferAttribute(A, 1));
    geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(G, 1));
    geo.setAttribute('aFar', new THREE.Float32BufferAttribute(F, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    return mesh;
  }
}

const City = {
  // ---------- Textures ----------

  // Four facade styles in a 2 x 2 atlas (256 px each), and a matching emission map for the lit windows.
  atlas(th, seed) {
    const S = 256, rng = mulberry32(seed);
    const col = document.createElement('canvas'), emi = document.createElement('canvas');
    col.width = emi.width = col.height = emi.height = S * 2;
    const g = col.getContext('2d'), e = emi.getContext('2d');
    e.fillStyle = '#000'; e.fillRect(0, 0, S * 2, S * 2);
    const cell = (k, fn) => { const ox = (k % 2) * S, oy = Math.floor(k / 2) * S; g.save(); e.save(); g.translate(ox, oy); e.translate(ox, oy); g.beginPath(); g.rect(0, 0, S, S); g.clip(); e.beginPath(); e.rect(0, 0, S, S); e.clip(); fn(); g.restore(); e.restore(); };
    const lit = (x, y, w, h, c, k) => { g.fillStyle = c; g.fillRect(x, y, w, h); e.fillStyle = `rgba(255,255,255,${k ?? 1})`; e.fillRect(x, y, w, h); };
    const grime = (n, a) => { for (let k = 0; k < n; k++) { g.fillStyle = `rgba(20,16,10,${rng() * a})`; g.fillRect(rng() * S, rng() * S * 0.3, 1 + rng() * 3, S * (0.2 + rng() * 0.8)); } };
    const noise = (n, a) => { for (let k = 0; k < n; k++) { g.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '255,255,255'},${rng() * a})`; g.fillRect(rng() * S, rng() * S, 2, 2); } };
    const warm = th.windows;
    if (!th.luxury) {
      cell(0, () => { // brutalist concrete: deep floor slabs, recessed windows, fins
        g.fillStyle = '#6a655c'; g.fillRect(0, 0, S, S); noise(1600, 0.08);
        for (let y = 0; y < S; y += 32) {
          g.fillStyle = '#2a2622'; g.fillRect(0, y + 8, S, 18); // the recessed band
          for (let x = 4; x < S; x += 16) if (rng() < th.lit) lit(x, y + 11, 10, 12, warm[Math.floor(rng() * warm.length)], 0.6 + rng() * 0.4);
          g.fillStyle = '#7a756a'; g.fillRect(0, y + 26, S, 3); // slab edge catching the light
        }
        g.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = 0; x < S; x += 64) g.fillRect(x, 0, 6, S); // fins
        grime(40, 0.3);
      });
      cell(1, () => { // megablock housing: balconies, laundry, satellite dishes, people home
        g.fillStyle = '#585048'; g.fillRect(0, 0, S, S); noise(1200, 0.08);
        for (let y = 0; y < S; y += 21) for (let x = 0; x < S; x += 21) {
          const on = rng() < th.lit * 1.6;
          if (on) lit(x + 3, y + 3, 14, 11, warm[Math.floor(rng() * warm.length)], 0.5 + rng() * 0.5); else { g.fillStyle = '#1a1714'; g.fillRect(x + 3, y + 3, 14, 11); }
          g.fillStyle = '#3a3430'; g.fillRect(x, y + 14, 21, 4); // balcony slab
          g.fillStyle = '#8a8478'; g.fillRect(x, y + 13, 21, 1); // rail
          if (rng() < 0.2) { g.fillStyle = ['#a83a2a', '#d8d0b8', '#3a6a9a', '#d8b83a'][Math.floor(rng() * 4)]; g.fillRect(x + 4 + rng() * 8, y + 14, 4, 4); } // laundry
          if (rng() < 0.06) { g.fillStyle = '#c8c4b8'; g.beginPath(); g.arc(x + 15, y + 8, 4, 0, TAU); g.fill(); } // a dish
        }
        grime(30, 0.35);
      });
      cell(2, () => { // industrial: corrugated sheet, rust, a few high windows
        g.fillStyle = '#5a5850'; g.fillRect(0, 0, S, S);
        for (let x = 0; x < S; x += 4) { g.fillStyle = x % 8 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.06)'; g.fillRect(x, 0, 2, S); }
        for (let k = 0; k < 14; k++) { const x = rng() * S, w = 10 + rng() * 40; const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(140,70,30,0.5)'); gr.addColorStop(1, 'rgba(140,70,30,0)'); g.fillStyle = gr; g.fillRect(x, rng() * S * 0.5, w, S); }
        for (let y = 24; y < S; y += 64) for (let x = 8; x < S; x += 40) if (rng() < th.lit * 1.4) lit(x, y, 24, 6, warm[Math.floor(rng() * warm.length)], 0.8);
        grime(30, 0.4);
      });
      cell(3, () => { // commercial: dark glass, neon strips and shop signs
        g.fillStyle = '#1e1c1c'; g.fillRect(0, 0, S, S); noise(800, 0.06);
        for (let y = 0; y < S; y += 32) { g.fillStyle = '#2e2a28'; g.fillRect(0, y, S, 4); for (let x = 6; x < S; x += 12) if (rng() < th.lit) lit(x, y + 9, 8, 14, warm[Math.floor(rng() * warm.length)], 0.5); }
        const neon = ['#ff3a8a', '#3ad8ff', '#ffd23f', '#7aff6a', '#ff6a2a'];
        for (let k = 0; k < 7; k++) { const c = neon[Math.floor(rng() * neon.length)], y = Math.floor(rng() * 8) * 32 + 4; lit(0, y, S, 2, c, 1); if (rng() < 0.6) lit(rng() * S * 0.7, y + 6, 30 + rng() * 50, 12, c, 0.9); }
      });
    } else {
      const glass = (base, hi, lo, mull) => {
        const gr = g.createLinearGradient(0, 0, S, S);
        gr.addColorStop(0, lo); gr.addColorStop(0.45, hi); gr.addColorStop(0.55, base); gr.addColorStop(1, lo);
        g.fillStyle = gr; g.fillRect(0, 0, S, S);
        for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); const x = rng() * S; g.moveTo(x, 0); g.lineTo(x + 30, 0); g.lineTo(x - 40, S); g.lineTo(x - 70, S); g.fill(); } // sky reflections
        g.fillStyle = mull; for (let y = 0; y < S; y += 21) g.fillRect(0, y, S, 3); for (let x = 0; x < S; x += 16) g.fillRect(x, 0, 1, S);
        for (let k = 0; k < 40; k++) if (rng() < th.lit * 3) lit(Math.floor(rng() * 16) * 16 + 2, Math.floor(rng() * 12) * 21 + 4, 12, 15, warm[Math.floor(rng() * warm.length)], 0.5);
      };
      cell(0, () => glass('#6a9ac8', '#cfe6f6', '#3a6a9a', 'rgba(230,240,250,0.85)'));
      cell(1, () => glass('#c8a050', '#f6e2a8', '#8a6a2a', 'rgba(60,40,20,0.7)'));
      cell(2, () => { // white stone: pilasters, tall windows, a cornice every few floors
        g.fillStyle = '#ece6da'; g.fillRect(0, 0, S, S); noise(900, 0.05);
        for (let y = 0; y < S; y += 42) {
          g.fillStyle = '#d8d0c0'; g.fillRect(0, y, S, 5);
          for (let x = 6; x < S; x += 21) { g.fillStyle = '#2a3a52'; g.fillRect(x, y + 10, 9, 26); g.beginPath(); g.arc(x + 4.5, y + 10, 4.5, Math.PI, 0); g.fill(); if (rng() < th.lit * 2) lit(x + 1, y + 14, 7, 20, warm[0], 0.6); }
        }
        g.fillStyle = 'rgba(0,0,0,0.06)'; for (let x = 0; x < S; x += 63) g.fillRect(x, 0, 4, S);
      });
      cell(3, () => { // sky garden: planted terraces behind glass
        g.fillStyle = '#9ac0d8'; g.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 32) {
          g.fillStyle = '#e8e4d8'; g.fillRect(0, y + 26, S, 6);
          for (let x = 0; x < S; x += 6) { g.fillStyle = ['#3a7a32', '#4a8a3a', '#2f6a2a', '#5a9a42'][Math.floor(rng() * 4)]; g.beginPath(); g.arc(x + rng() * 4, y + 24 - rng() * 6, 3 + rng() * 4, 0, TAU); g.fill(); }
          if (rng() < 0.5) { g.fillStyle = '#d84a7a'; for (let k = 0; k < 8; k++) g.fillRect(rng() * S, y + 18 + rng() * 6, 2, 2); }
        }
      });
    }
    const t = new THREE.CanvasTexture(col), te = new THREE.CanvasTexture(emi);
    for (const x of [t, te]) { x.colorSpace = THREE.SRGBColorSpace; x.wrapS = x.wrapT = THREE.ClampToEdgeWrapping; x.minFilter = THREE.LinearMipmapLinearFilter; x.magFilter = THREE.NearestFilter; }
    te.colorSpace = THREE.NoColorSpace;
    return { map: t, emap: te };
  },

  // Eight ads in a 4 x 2 atlas: the sponsors, the broadcast, the warden's messages.
  ads(th) {
    const W = 256, H = 128, c = document.createElement('canvas');
    c.width = W * 4; c.height = H * 2;
    const g = c.getContext('2d');
    const list = th.luxury
      ? [['AUREUM', 'OWN TOMORROW', '#141210', '#e8c25a'], ['THE CROWN', 'GRAND PRIX', '#1e2a5a', '#ffd86a'], ['HELIX', 'LIVE FOREVER', '#f4f2ec', '#1a1a1a'], ['CROWN BANK', 'TRUST IS GOLD', '#0e1e3a', '#e8e0c8'],
        ['DERBY XLI', 'LIVE ON C9TV', '#a8322a', '#ffffff'], ['VALE', 'DRIVES AUREUM', '#141210', '#e8c25a'], ['MARLOWE', 'UNDEFEATED', '#1a1a1a', '#ff4a3a'], ['SMILE', 'YOU ARE SAFE', '#f6f4ee', '#3a6aa8']]
      : [['WIN YOUR', 'FREEDOM', '#141210', '#e8c25a'], ['DERBY XLI', 'LIVE ON C9TV', '#a8322a', '#ffffff'], ['AUREUM', 'OWN TOMORROW', '#141210', '#e8c25a'], ['HELIX', 'BREATHE EASY', '#1a3a2a', '#9aff8a'],
        ['WORK', 'OBEY  RACE', '#2a2a2a', '#ff7a3a'], ['NOODLE KING', '24 HRS', '#3a0a1a', '#ff5ab0'], ['THE WARDEN', 'KEEPS YOU SAFE', '#1a1a1a', '#e8e0c8'], ['C9TV', 'WATCH THEM DIE', '#0a1a3a', '#3ad8ff']];
    list.forEach(([a, b, bg, fg], k) => {
      const ox = (k % 4) * W, oy = Math.floor(k / 4) * H;
      g.fillStyle = bg; g.fillRect(ox, oy, W, H);
      g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(ox + 6, oy + 6, W - 12, H - 12);
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `bold 40px Impact, 'Arial Black', sans-serif`; g.fillText(a, ox + W / 2, oy + H * 0.42, W - 24);
      g.font = `bold 18px 'Courier New', monospace`; g.fillText(b, ox + W / 2, oy + H * 0.76, W - 24);
      if (!th.luxury) for (let n = 0; n < 300; n++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.35})`; g.fillRect(ox + Math.random() * W, oy + Math.random() * H, 2, 2); } // dead pixels, grime
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  },

  // Shaded, hazed, self-lit where it should be. world: the district (haze by camera distance) rather than the ring.
  material(th, tex, ads, world) {
    const sun = new THREE.Vector3(...th.sunPos).normalize();
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: tex.map }, emap: { value: tex.emap }, ads: { value: ads }, haze: { value: new THREE.Color(th.fog) }, hz: { value: new THREE.Vector3(...th.haze) },
        sun: { value: sun }, amb: { value: th.luxury ? 0.62 : 0.42 }, world: { value: world ? 1 : 0 }, fogNear: { value: th.near * 0.6 }, fogFar: { value: th.far * 1.25 }, glowBoost: { value: th.luxury ? 0.9 : 1.6 },
      },
      vertexShader: `
        attribute vec3 aCol; attribute vec2 aUv; attribute float aStyle; attribute float aAd; attribute float aGlow; attribute float aFar;
        varying vec3 vCol; varying vec2 vUv; varying float vStyle; varying float vAd; varying float vGlow; varying float vHaze; varying vec3 vN;
        uniform vec3 hz; uniform float world; uniform float fogNear; uniform float fogFar;
        void main() {
          vCol = aCol; vUv = aUv; vStyle = aStyle; vAd = aAd; vGlow = aGlow;
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float low = 1.0 - clamp(position.y / 900.0, 0.0, 1.0);
          if (world > 0.5) {
            float d = distance(wp.xz, cameraPosition.xz);
            vHaze = clamp(smoothstep(fogNear, fogFar, d) * 0.9 + low * low * hz.z * 0.35, 0.0, 0.92);
          } else vHaze = clamp(hz.x + aFar * hz.y + low * low * hz.z, 0.0, 0.95);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform sampler2D map; uniform sampler2D emap; uniform sampler2D ads; uniform vec3 haze; uniform vec3 sun; uniform float amb; uniform float glowBoost;
        varying vec3 vCol; varying vec2 vUv; varying float vStyle; varying float vAd; varying float vGlow; varying float vHaze; varying vec3 vN;
        void main() {
          vec3 n = normalize(vN);
          float shade = amb + (1.0 - amb) * max(dot(n, sun), 0.0) + 0.12 * n.y;
          vec3 c = vCol, glow = vec3(0.0);
          if (vAd > -0.5) {
            vec2 cellUv = vec2((mod(vAd, 4.0) + clamp(vUv.x, 0.01, 0.99)) / 4.0, (1.0 - floor(vAd / 4.0) - 1.0 + clamp(vUv.y, 0.01, 0.99)) / 2.0);
            glow = texture2D(ads, cellUv).rgb * glowBoost;
            c = vec3(0.0);
          } else if (vStyle > -0.5) {
            vec2 off = vec2(mod(vStyle, 2.0), 1.0 - floor(vStyle / 2.0)) * 0.5;
            vec2 uv = fract(vUv) * 0.49 + 0.005 + off;
            vec3 t = texture2D(map, uv).rgb;
            float e = texture2D(emap, uv).r;
            c *= t;
            glow = t * e * glowBoost;
          }
          vec3 col = vGlow > 0.5 ? c + vCol * glowBoost : c * shade + glow;
          if (vAd > -0.5) col = glow;
          float hz = (vGlow > 0.5 || vAd > -0.5) ? vHaze * 0.45 : vHaze;
          gl_FragColor = vec4(mix(col, haze, hz), 1.0);
          #include <colorspace_fragment>
        }`,
      fog: false,
    });
  },

  // ---------- Buildings ----------

  // Dystopian megablock: a slab with cantilevered tiers, floor ledges, a service core, pipes, rooftop clutter,
  // maybe a billboard hanging off it. s = scale (1 for the horizon, smaller for the district).
  megablock(K, x, z, ry, h, w, d, far, s, beacon) {
    const r = K.rng, styles = [0, 1, 1, 0, 2, 3];
    let y = 0, cw = w, cd = d, ox = 0, oz = 0;
    const tiers = 1 + Math.floor(r() * 3);
    for (let t = 0; t < tiers; t++) {
      const th = (t === 0 ? 0.55 + r() * 0.2 : 0.2 + r() * 0.25) * h;
      const st = styles[Math.floor(r() * styles.length)];
      const cx = x + Math.cos(ry) * ox - Math.sin(ry) * oz, cz = z + Math.sin(ry) * ox + Math.cos(ry) * oz;
      K.box(cw, th, cd, cx, y + th / 2, cz, -ry, '#ffffff', { style: st, far });
      for (let ly = y + 60 * s; ly < y + th - 30 * s; ly += (90 + r() * 80) * s) K.box(cw * 1.02, 6 * s, cd * 1.02, cx, ly, cz, -ry, '#3a3630', { far }); // ledges
      if (r() < 0.6) K.box(cw * 0.18, th * 1.02, cd * 0.18, cx + (r() - 0.5) * cw * 0.6, y + th / 2, cz + cd * 0.5, -ry, '#4a463e', { style: 2, far }); // service core
      if (r() < 0.5) for (let k = 0; k < 3; k++) K.cyl(3 * s, 3 * s, th, 6, cx - cw * 0.5 - 4 * s, y + th / 2, cz + (k - 1) * 8 * s, 0, ['#6a4a2a', '#4a5a4a', '#5a3a2a'][k], { far }); // pipes down the side
      if (t < tiers - 1) { cw *= 0.55 + r() * 0.3; cd *= 0.55 + r() * 0.3; ox = (r() - 0.5) * w * 0.4; oz = (r() - 0.5) * d * 0.4; } // the next tier, offset: cantilevered
      y += th;
    }
    // Roof: water tanks, plant, an antenna mast with a blinking beacon.
    const rx = x + Math.cos(ry) * ox - Math.sin(ry) * oz, rz = z + Math.sin(ry) * ox + Math.cos(ry) * oz;
    for (let k = 0; k < 2 + Math.floor(r() * 3); k++) K.cyl(8 * s, 8 * s, 14 * s, 8, rx + (r() - 0.5) * cw * 0.6, y + 7 * s, rz + (r() - 0.5) * cd * 0.6, 0, '#5a524a', { far });
    K.box(cw * 0.3, 12 * s, cd * 0.3, rx, y + 6 * s, rz, -ry, '#3a3632', { far });
    if (r() < 0.7) {
      const mh = (60 + r() * 140) * s;
      K.box(3 * s, mh, 3 * s, rx + cw * 0.2, y + mh / 2, rz, 0, '#2a2622', { far });
      K.box(8 * s, 8 * s, 8 * s, rx + cw * 0.2, y + mh, rz, 0, beacon, { glow: 1, far: 0 });
    }
    if (r() < 0.45) { // a billboard bolted to the side
      const bw = Math.min(cw * 0.8, 160 * s), bh = bw * 0.5, by = y * (0.4 + r() * 0.4);
      const fx = Math.sin(ry), fz = Math.cos(ry); // the face pointing along the box's local +Z
      K.board(bw, bh, x + fx * (d / 2 + 2 * s), by, z + fz * (d / 2 + 2 * s), -ry, Math.floor(r() * 8), { far });
    }
    return y;
  },

  // Refinery: a cluster of chimneys, a gas holder, a flare stack with its flame, pipe racks.
  refinery(K, x, z, s, far) {
    const r = K.rng;
    for (let k = 0; k < 3 + Math.floor(r() * 3); k++) {
      const h = (300 + r() * 500) * s, px = x + (r() - 0.5) * 220 * s, pz = z + (r() - 0.5) * 220 * s;
      K.cyl(18 * s, 30 * s, h, 10, px, h / 2, pz, 0, '#6a3a2a', { far });
      K.cyl(19 * s, 19 * s, 12 * s, 10, px, h * 0.8, pz, 0, '#d8d0c0', { far });
      K.cyl(19 * s, 19 * s, 8 * s, 10, px, h - 6 * s, pz, 0, '#ff3a2a', { glow: 1, far: 0 });
    }
    K.sphere(70 * s, x + 150 * s, 70 * s, z - 60 * s, '#9a948a', { far });
    const fh = (420 + r() * 200) * s, fx = x - 160 * s, fz = z + 40 * s;
    K.cyl(6 * s, 10 * s, fh, 8, fx, fh / 2, fz, 0, '#3a3632', { far });
    K.cone(18 * s, 70 * s, 8, fx, fh + 30 * s, fz, '#ff8a2a', { glow: 1, far: 0 }); // the flare
    K.cone(9 * s, 50 * s, 8, fx, fh + 26 * s, fz, '#ffe08a', { glow: 1, far: 0 });
    K.box(300 * s, 8 * s, 14 * s, x, 60 * s, z + 120 * s, 0.3, '#4a463e', { far }); // pipe rack
    K.lathe([[90, 0], [62, 120], [56, 190], [64, 240]].map(([a, b]) => [a * s, b * s]), 14, x + 40 * s, 0, z - 200 * s, '#9a948a', { far }); // cooling tower
  },

  // Upper-city tower: setbacks, chamfers, a twist, sky gardens, a gold crown and maybe a spire.
  glassTower(K, x, z, ry, h, w, far, s) {
    const r = K.rng, kind = Math.floor(r() * 4), gold = '#e0b44a', stone = '#f2ece0';
    const glassStyle = r() < 0.6 ? 0 : 1;
    let y = 0;
    if (kind === 0) { // setbacks: three tiers stepping in, a garden on each step
      let cw = w;
      for (let t = 0; t < 3; t++) {
        const th = h * [0.5, 0.3, 0.2][t];
        K.box(cw, th, cw, x, y + th / 2, z, -ry, '#ffffff', { style: glassStyle, far });
        K.box(cw * 1.03, 4 * s, cw * 1.03, x, y + th, z, -ry, gold, { far });
        if (t < 2) K.box(cw * 0.95, 6 * s, cw * 0.95, x, y + th + 3 * s, z, -ry, '#4a8a3a', { far });
        y += th; cw *= 0.72;
      }
    } else if (kind === 1) { // twisted: slabs turning as they rise
      const n = 14, th = h / n;
      for (let k = 0; k < n; k++) K.box(w * (1 - k * 0.02), th * 1.01, w * 0.7 * (1 - k * 0.02), x, y + th / 2 + k * th, z, -ry - k * 0.07, '#ffffff', { style: glassStyle, far });
      y = h;
    } else if (kind === 2) { // octagonal shaft with sky-garden bands
      const r0 = w * 0.55;
      for (let t = 0; t < 3; t++) {
        const th = h / 3;
        K.cyl(r0 * (1 - t * 0.08), r0 * (1 - t * 0.06), th * 0.82, 8, x, y + th * 0.41, z, ry, '#ffffff', { style: glassStyle, far });
        K.cyl(r0 * (1 - t * 0.08), r0 * (1 - t * 0.08), th * 0.18, 8, x, y + th * 0.91, z, ry, '#ffffff', { style: 3, far });
        y += th;
      }
    } else { // white stone tower with a gold-glass top
      K.box(w, h * 0.7, w, x, h * 0.35, z, -ry, stone, { style: 2, far });
      K.box(w * 0.8, h * 0.3, w * 0.8, x, h * 0.85, z, -ry, '#ffffff', { style: 1, far });
      y = h;
    }
    // Crown: a gold ring, a dome or a lantern, and maybe a needle with a light.
    const c = Math.floor(r() * 3);
    if (c === 0) K.cyl(w * 0.42, w * 0.5, 30 * s, 8, x, y + 15 * s, z, ry, gold, { far });
    else if (c === 1) K.sphere(w * 0.35, x, y, z, gold, { far }, true);
    else { K.box(w * 0.4, 50 * s, w * 0.4, x, y + 25 * s, z, -ry, '#fff4d8', { glow: 1, far }); K.box(w * 0.46, 6 * s, w * 0.46, x, y + 52 * s, z, -ry, gold, { far }); }
    if (r() < 0.5) { const nh = (120 + r() * 220) * s; K.cone(5 * s, nh, 6, x, y + 40 * s + nh / 2, z, '#f0e8d8', { far }); K.box(6 * s, 6 * s, 6 * s, x, y + 40 * s + nh, z, 0, '#ffd86a', { glow: 1, far: 0 }); }
    if (r() < 0.25) { const bw = w * 0.9; K.board(bw, bw * 0.5, x + Math.sin(ry) * (w / 2 + 2), h * 0.55, z + Math.cos(ry) * (w / 2 + 2), -ry, Math.floor(r() * 8), { far }); }
  },

  // A domed palace: a drum of columns round a white hall under a gold dome (the Crown's civic buildings).
  palace(K, x, z, s, far) {
    const r = K.rng, R = (60 + r() * 50) * s, h = (60 + r() * 50) * s;
    K.box(R * 3, 14 * s, R * 3, x, 7 * s, z, 0, '#ece6da', { style: 2, far });
    K.cyl(R, R, h, 16, x, 14 * s + h / 2, z, 0, '#f2ece0', { style: 2, far });
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; K.cyl(3 * s, 3 * s, h, 6, x + Math.cos(a) * R * 1.15, 14 * s + h / 2, z + Math.sin(a) * R * 1.15, 0, '#ffffff', { far }); }
    K.cyl(R * 1.2, R * 1.2, 6 * s, 16, x, 14 * s + h + 3 * s, z, 0, '#e0b44a', { far });
    K.sphere(R * 0.95, x, 14 * s + h + 6 * s, z, '#e0b44a', { far }, true);
    K.cone(6 * s, 40 * s, 6, x, 14 * s + h + R + 20 * s, z, '#e0b44a', { far });
  },

  // ---------- The horizon ring (follows the camera) ----------

  ring(th, seed, ads) {
    const K = new CityKit(mulberry32(seed));
    const r = K.rng, beacon = th.luxury ? '#ffd86a' : '#ff3a2a';
    if (!th.luxury) {
      const n = Math.round((th.plate ? 34 : 30) * Math.max(0.6, Settings.q.towers)); // a thinner skyline on Low graphics
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + r() * 0.1, R = 2500 + r() * 2000, far = (R - 2500) / 2000;
        const w = 180 + r() * 320, d = 150 + r() * 260, h = (th.plate ? 1100 : 800) + r() * 1900;
        City.megablock(K, Math.cos(a) * R, Math.sin(a) * R, -a + Math.PI / 2 + (r() - 0.5) * 0.6, h, w, d, far, 2.2, beacon);
      }
      if (th.plate) {
        // Support pillars holding up the upper city, ringed with sodium lights, vanishing into the plate overhead.
        for (let k = 0; k < 9; k++) {
          const a = r() * TAU, R = 1800 + r() * 2400, rad = 90 + r() * 80, x = Math.cos(a) * R, z = Math.sin(a) * R, far = (R - 1800) / 2400;
          K.cyl(rad, rad * 1.15, 4400, 10, x, 2200, z, 0, '#ffffff', { style: 0, far });
          for (let y = 300; y < 2600; y += 520) K.cyl(rad * 1.04, rad * 1.04, 12, 10, x, y, z, 0, '#ff9a3a', { glow: 1, far: 0 });
          for (let y = 700; y < 2600; y += 520) K.box(rad * 2.6, 20, 24, x, y, z, r() * TAU, '#3a3632', { far }); // catwalks
        }
      } else {
        for (let k = 0; k < 5; k++) { const a = r() * TAU, R = 2400 + r() * 1500; City.refinery(K, Math.cos(a) * R, Math.sin(a) * R, 2.2, (R - 2400) / 1500); }
      }
      // The Spire: the upper city's tower, out of reach for now. Its crown is the only clean light in the sky.
      const a = 0.6, R = 4300, x = Math.cos(a) * R, z = Math.sin(a) * R;
      K.cyl(320, 460, 2600, 8, x, 1300, z, 0.2, '#ffffff', { style: 3, far: 1 });
      K.cyl(200, 300, 1400, 8, x, 3300, z, 0.2, '#ffffff', { style: 3, far: 1 });
      K.cone(120, 900, 8, x, 4450, z, '#2a2620', { far: 1 });
      for (const y of [2620, 4020]) K.cyl(560, 560, 24, 16, x, y, z, 0, '#ffe2a0', { glow: 1, far: 0.2 });
    } else {
      const n = 38;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + r() * 0.12, R = 2300 + r() * 2200, far = (R - 2300) / 2200;
        const h = 500 + r() * 1700, w = 120 + r() * 170;
        City.glassTower(K, Math.cos(a) * R, Math.sin(a) * R, r() * TAU, h, w, far, 2.2);
      }
      // The Spire up close: white stone, gold rings, a lit crown.
      const a = 0.6, R = th.fireworks ? 2400 : 3200, x = Math.cos(a) * R, z = Math.sin(a) * R;
      K.cyl(260, 420, 2400, 8, x, 1200, z, 0, '#f6f0e4', { style: 2, far: 0.3 });
      K.cyl(120, 260, 1400, 8, x, 3100, z, 0, '#ffffff', { style: 3, far: 0.3 });
      K.cone(120, 600, 8, x, 4100, z, '#e8c25a', { far: 0.3 });
      for (const y of [800, 1600, 2400, 3000, 3600]) K.cyl(y < 2400 ? 440 : 280, y < 2400 ? 440 : 280, 30, 16, x, y, z, 0, '#e8c25a', { far: 0.25 });
      K.cyl(130, 130, 60, 16, x, 3820, z, 0, '#fff0c0', { glow: 1, far: 0.2 });
    }
    const mesh = K.mesh(City.material(th, City.atlas(th, seed + 7), ads, false));
    mesh.name = 'skyline';
    return mesh;
  },

  // ---------- The district (world space, between the track and the horizon) ----------

  district(scene, tr, th, themeKey, ads) {
    const K = new CityKit(mulberry32(tr.seed ^ 0xc17));
    const r = K.rng, inner = tr.hw + tr.runoff + 40;
    let cx = 0, cz = 0;
    for (const p of tr.pts) { cx += p.x; cz += p.y; }
    cx /= tr.pts.length; cz /= tr.pts.length;
    let R0 = 0;
    for (const p of tr.pts) R0 = Math.max(R0, Math.hypot(p.x - cx, p.y - cz));
    const clear = (x, z, rad) => { for (let i = 0; i < tr.N; i += 3) if ((tr.pts[i].x - x) ** 2 + (tr.pts[i].y - z) ** 2 < (inner + rad) ** 2) return false; return true; };
    const placed = [];
    const spot = (minR, maxR, rad) => {
      for (let t = 0; t < 30; t++) {
        const a = r() * TAU, R = R0 + minR + r() * (maxR - minR), x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
        if (!clear(x, z, rad)) continue;
        if (placed.some((q) => Math.hypot(q[0] - x, q[1] - z) < q[2] + rad + 20)) continue;
        placed.push([x, z, rad]);
        return [x, z, Math.atan2(cz - z, cx - x)];
      }
      return null;
    };
    const beacon = th.luxury ? '#ffd86a' : '#ff3a2a';
    const count = Math.round(46 * Settings.q.towers); // fewer towers round the track on Low graphics
    for (let k = 0; k < count; k++) {
      const near = k < count * 0.45, sz = near ? 50 + r() * 50 : 80 + r() * 90;
      const p = spot(near ? 150 : 500, near ? 600 : 1500, sz);
      if (!p) continue;
      const [x, z, face] = p;
      if (themeKey === 'undercity') {
        if (r() < 0.75) City.megablock(K, x, z, face + (r() - 0.5) * 0.4, (near ? 120 : 220) + r() * 300, sz * 1.4, sz, 0, 0.6, beacon);
        else { // an overpass on concrete legs
          const L = 300 + r() * 300, ang = r() * TAU;
          K.box(L, 10, 40, x, 70, z, ang, '#5a564e', { style: 0 });
          for (let q = -1; q <= 1; q++) K.box(16, 70, 16, x + Math.cos(-ang) * q * L * 0.4, 35, z + Math.sin(-ang) * q * L * 0.4, ang, '#4a463e');
          K.board(60, 30, x, 100, z, ang, Math.floor(r() * 8));
        }
      } else if (themeKey === 'stacks') {
        const u = r();
        if (u < 0.35) City.refinery(K, x, z, 0.5, 0);
        else if (u < 0.7) { // a factory: long shed, sawtooth roof, chimneys
          const w = sz * 2.4, d = sz * 1.3, h = 40 + r() * 40;
          K.box(w, h, d, x, h / 2, z, face, '#ffffff', { style: 2 });
          for (let q = 0; q < 5; q++) K.box(w / 5, 14, d, x + Math.cos(-face) * (q - 2) * w / 5, h + 7, z + Math.sin(-face) * (q - 2) * w / 5, face, '#4a463e', { rz: 0.5 });
          for (let q = 0; q < 2; q++) { const ch = 120 + r() * 120; K.cyl(6, 9, ch, 8, x + (r() - 0.5) * w * 0.6, ch / 2, z + (r() - 0.5) * d * 0.6, 0, '#6a3a2a'); K.cyl(7, 7, 4, 8, x, ch, z, 0, '#ff3a2a', { glow: 1 }); }
        } else City.megablock(K, x, z, face, 140 + r() * 260, sz * 1.3, sz, 0, 0.6, beacon);
      } else if (themeKey === 'terraces') {
        const u = r();
        if (u < 0.6) City.glassTower(K, x, z, r() * TAU, (near ? 160 : 300) + r() * 400, sz * 0.9, 0, 0.6);
        else { // hanging terraces: stacked plates stepping back, gardens on each
          let y = 0, w = sz * 2;
          for (let q = 0; q < 4; q++) { K.box(w, 30, w * 0.8, x, y + 15, z - q * 12, face, '#ffffff', { style: q % 2 ? 3 : 2 }); K.box(w * 0.98, 5, w * 0.78, x, y + 32, z - q * 12, face, '#4a8a3a'); y += 34; w *= 0.8; }
        }
      } else {
        const u = r();
        if (u < 0.45) City.glassTower(K, x, z, r() * TAU, (near ? 180 : 320) + r() * 500, sz * 0.9, 0, 0.6);
        else if (u < 0.8) City.palace(K, x, z, near ? 0.6 : 0.9, 0);
        else { K.box(12, 200, 12, x, 100, z, 0, '#f2ece0', { style: 2 }); K.cone(9, 30, 4, x, 215, z, '#e0b44a'); } // an obelisk
      }
    }
    const mesh = K.mesh(City.material(th, City.atlas(th, tr.seed + 11), ads, true));
    mesh.name = 'district';
    scene.add(mesh);
    return mesh;
  },

  // Blimps with the sponsors' ads, circling slowly (part of the camera-following group).
  blimps(th, ads) {
    const out = [];
    const n = th.luxury ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshLambertMaterial({ color: th.luxury ? '#f2ece0' : '#5a564e', fog: false }));
      hull.scale.set(160, 42, 42);
      g.add(hull);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(50, 14, 16), new THREE.MeshLambertMaterial({ color: '#2a2622', fog: false })).translateY(-46));
      for (const s of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(40, 2, 46), new THREE.MeshLambertMaterial({ color: th.luxury ? '#e0b44a' : '#a8322a', fog: false }));
        fin.position.set(-140, 0, 0); fin.rotation.x = s > 0 ? 0 : Math.PI / 2; g.add(fin);
      }
      // The ad along the side: one atlas cell on a plane each side.
      const cell = k * 3 % 8, tex = ads.clone();
      tex.needsUpdate = true;
      tex.repeat.set(0.25, 0.5); tex.offset.set((cell % 4) * 0.25, 0.5 - Math.floor(cell / 4) * 0.5);
      for (const s of [-1, 1]) {
        const ad = new THREE.Mesh(new THREE.PlaneGeometry(150, 56), new THREE.MeshBasicMaterial({ map: tex, fog: false, side: THREE.DoubleSide }));
        ad.position.set(0, 0, s * 43);
        g.add(ad);
      }
      for (const z of [-30, 30]) { const l = new THREE.Mesh(new THREE.SphereGeometry(3, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff3a2a', fog: false })); l.position.set(0, -50, z); g.add(l); }
      g.userData = { a: k * 2.3, R: 1300 + k * 450, y: 600 + k * 180, speed: 0.012 + k * 0.004 };
      out.push(g);
    }
    return out;
  },
};
