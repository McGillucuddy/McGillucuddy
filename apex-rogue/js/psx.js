'use strict';
// Retro PlayStation-era look (think Fears to Fathom): low-res render with hard pixels,
// 15-bit colour + ordered dithering, vertex snapping (wobble), grimy pixel textures, fog.

const PSX = {
  enabled: true,
  height: 240, // internal render height in pixels
  snapRes: { value: new THREE.Vector2(320, 240) },
  snapOn: { value: 1 },
  texCache: {},

  // ---------- Procedural low-res textures ----------

  // All textures are greyscale-ish detail maps (multiplied with each material's own colour),
  // except where a tint is part of the grime (rust).
  texture(kind) {
    if (this.texCache[kind]) return this.texCache[kind];
    const S = 64;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const rng = mulberry32(kind.length * 977 + kind.charCodeAt(0));
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    const shade = (v) => { const k = Math.round(clamp(v, 0, 1) * 255); return `rgb(${k},${k},${k})`; };
    const blotch = (x, y, r, col) => {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r * (0.6 + rng() * 0.6)) px((x + dx + S) % S, (y + dy + S) % S, col);
      }
    };
    // Base noise
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const base = { metal: 0.86, paint: 0.9, vinyl: 0.8, plastic: 0.85, rubber: 0.75, wood: 0.8, foliage: 0.8, stone: 0.8, glass: 0.9 }[kind] || 0.85;
      px(x, y, shade(base + (rng() - 0.5) * 0.07));
    }
    if (kind === 'paint' || kind === 'metal') {
      // Scratches, dirt streaks running down, rust spots.
      for (let k = 0; k < 14; k++) {
        let x = rng() * S, y = rng() * S;
        const a = rng() * TAU, len = 4 + rng() * 14;
        for (let s = 0; s < len; s++) { px(Math.floor(x) % S, Math.floor(y) % S, shade(0.98)); x += Math.cos(a); y += Math.sin(a); }
      }
      for (let k = 0; k < 10; k++) {
        const x = Math.floor(rng() * S), y0 = Math.floor(rng() * S), len = 6 + rng() * 20;
        for (let s = 0; s < len; s++) px(x, (y0 + s) % S, `rgba(40,30,20,${0.25 * (1 - s / len)})`);
      }
      const rust = kind === 'metal' ? 9 : 4;
      for (let k = 0; k < rust; k++) blotch(Math.floor(rng() * S), Math.floor(rng() * S), 1 + Math.floor(rng() * 3), `rgba(${120 + rng() * 40},${60 + rng() * 20},25,0.85)`);
    } else if (kind === 'vinyl') {
      // Seams and cracks.
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (let y = 0; y < S; y += 16) g.fillRect(0, y, S, 1);
      for (let k = 0; k < 12; k++) {
        let x = rng() * S, y = rng() * S, a = rng() * TAU;
        for (let s = 0; s < 8; s++) { px(Math.floor(x) % S, Math.floor(y) % S, 'rgba(230,220,200,0.6)'); a += (rng() - 0.5); x += Math.cos(a); y += Math.sin(a); }
      }
      for (let k = 0; k < 5; k++) blotch(Math.floor(rng() * S), Math.floor(rng() * S), 2 + Math.floor(rng() * 3), 'rgba(0,0,0,0.18)');
    } else if (kind === 'plastic') {
      for (let k = 0; k < 6; k++) blotch(Math.floor(rng() * S), Math.floor(rng() * S), 2 + Math.floor(rng() * 4), 'rgba(0,0,0,0.12)');
      for (let k = 0; k < 15; k++) px(Math.floor(rng() * S), Math.floor(rng() * S), 'rgba(255,255,255,0.2)');
    } else if (kind === 'rubber') {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      for (let x = 0; x < S; x += 6) g.fillRect(x, 0, 2, S); // tread
    } else if (kind === 'wood') {
      for (let y = 0; y < S; y++) { const v = 0.75 + 0.15 * Math.sin(y * 0.9 + Math.sin(y * 0.2) * 3); g.fillStyle = shade(v); g.globalAlpha = 0.5; g.fillRect(0, y, S, 1); }
      g.globalAlpha = 1;
    } else if (kind === 'foliage' || kind === 'stone') {
      for (let k = 0; k < 30; k++) blotch(Math.floor(rng() * S), Math.floor(rng() * S), 1 + Math.floor(rng() * 3), `rgba(0,0,0,${0.1 + rng() * 0.15})`);
      for (let k = 0; k < 12; k++) px(Math.floor(rng() * S), Math.floor(rng() * S), 'rgba(255,255,230,0.2)');
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.name = 'psx_' + kind;
    this.texCache[kind] = tex;
    return tex;
  },

  // Pick a grime texture for a material from its look.
  kindFor(mat) {
    const col = mat.color ? mat.color.getHex() : 0;
    const known = { 0x1c2a3a: 'glass', 0x3b2a24: 'vinyl', 0x151515: 'rubber', 0x5a3d22: 'wood', 0x4a3320: 'wood', 0x6b4428: 'wood', 0x4a5a2a: 'wood', 0x3b4822: 'wood' };
    if (known[col]) return known[col];
    const hsl = {};
    mat.color.getHSL(hsl);
    if (mat.metalness >= 0.5) return 'metal';
    if (mat.metalness >= 0.2) return 'paint';
    if (hsl.h > 0.2 && hsl.h < 0.45 && hsl.s > 0.25) return 'foliage';
    if (hsl.s < 0.15 && hsl.l < 0.25) return 'plastic';
    return 'stone';
  },

  // Box-projected UVs so every model gets the same texel density (8 texels per unit).
  uvCache: new WeakMap(),
  boxUV(geo) {
    if (this.uvCache.has(geo)) return this.uvCache.get(geo);
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const pos = g.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    const sc = 1 / 8;
    for (let i = 0; i + 2 < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      n.subVectors(b, a).cross(c.clone().sub(a));
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      for (let k = 0; k < 3; k++) {
        const p = k === 0 ? a : k === 1 ? b : c;
        let u, v;
        if (ax >= ay && ax >= az) { u = p.z; v = p.y; } else if (ay >= az) { u = p.x; v = p.z; } else { u = p.x; v = p.y; }
        uv[(i + k) * 2] = u * sc;
        uv[(i + k) * 2 + 1] = v * sc;
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.deleteAttribute('normal');
    g.computeVertexNormals();
    this.uvCache.set(geo, g);
    return g;
  },

  // Vertex snapping: positions jump between low-res pixel centres, giving the PS1 wobble.
  snap(mat) {
    if (mat.userData.psxSnap) return;
    mat.userData.psxSnap = true;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.psxRes = PSX.snapRes;
      shader.uniforms.psxOn = PSX.snapOn;
      shader.vertexShader = 'uniform vec2 psxRes;\nuniform float psxOn;\n' + shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        if (psxOn > 0.5 && gl_Position.w > 0.0) {
          vec2 grid = psxRes * 0.5;
          gl_Position.xy = floor(gl_Position.xy / gl_Position.w * grid + 0.5) / grid * gl_Position.w;
        }`);
    };
    mat.customProgramCacheKey = () => 'psx';
    mat.needsUpdate = true;
  },

  // Texture + snap every mesh under root. Live-textured screens/mirror (MeshBasic with a map) are left alone.
  apply(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      // Only re-UV meshes we texture ourselves (the ground keeps its own mapping).
      const needsUV = mats.some((m) => (m.isMeshStandardMaterial || m.isMeshLambertMaterial) && (!m.map || m.userData.psxTex));
      if (needsUV && !o.userData.psxUV) {
        o.geometry = this.boxUV(o.geometry);
        o.userData.psxUV = true;
      }
      for (const m of mats) {
        if ((m.isMeshStandardMaterial || m.isMeshLambertMaterial) && !m.map && !m.userData.psxTex) {
          m.userData.psxTex = this.texture(this.kindFor(m));
          m.map = m.userData.psxTex;
          m.needsUpdate = true;
        }
        if (!m.isShaderMaterial && !m.isSpriteMaterial) this.snap(m);
      }
    });
  },

  // Toggle textures on/off for an already-processed tree.
  setTextures(root, on) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m.userData.psxTex) continue;
        m.map = on ? m.userData.psxTex : null;
        m.needsUpdate = true;
      }
    });
  },

  // Grimy, half-resolution copy of the 2D track canvas for the 3D ground.
  groundCanvas(src, seed) {
    const sc = 0.5;
    const c = document.createElement('canvas');
    c.width = Math.ceil(src.width * sc);
    c.height = Math.ceil(src.height * sc);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    const rng = mulberry32(seed || 1);
    const n = (c.width * c.height) / 220;
    for (let k = 0; k < n; k++) {
      const v = rng();
      g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.04 + rng() * 0.07})` : `rgba(255,240,200,${rng() * 0.04})`;
      g.fillRect(Math.floor(rng() * c.width), Math.floor(rng() * c.height), 1 + Math.floor(rng() * 2), 1 + Math.floor(rng() * 2));
    }
    for (let k = 0; k < n / 60; k++) {
      g.fillStyle = `rgba(20,15,10,${0.08 + rng() * 0.1})`;
      g.beginPath();
      g.arc(rng() * c.width, rng() * c.height, 2 + rng() * 10, 0, TAU);
      g.fill();
    }
    return c;
  },
};

// Full-screen pass: renders into a low-res target, then upscales with hard pixels,
// a grimy grade, 15-bit colour with ordered dithering, grain and vignette.
class PSXPost {
  constructor(renderer) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(320, 240, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.rt.texture }, res: { value: new THREE.Vector2(320, 240) }, time: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform vec2 res; uniform float time; varying vec2 vUv;
        float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
        float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
        void main() {
          vec2 px = floor(vUv * res);
          vec3 c = texture2D(tDiffuse, (px + 0.5) / res).rgb;
          c = pow(max(c, 0.0), vec3(1.0 / 2.2));                 // linear -> display
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, 0.72);                              // desaturate
          c *= vec3(1.0, 0.98, 0.86);                             // grimy yellow-green cast
          c = (c - 0.5) * 1.08 + 0.53;                            // contrast, lifted shadows
          c += (bayer4(px) - 0.5) / 62.0;                         // light ordered dither
          c = floor(c * 31.0 + 0.5) / 31.0;                       // 15-bit colour
          vec2 q = vUv - 0.5;
          c *= 1.0 - dot(q, q) * 0.8;                             // vignette
          c += (fract(sin(dot(px + floor(time * 24.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012;
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
  }

  setSize(W, H) {
    const h = PSX.height, w = Math.max(1, Math.round((h * W) / H));
    this.rt.setSize(w, h);
    this.mat.uniforms.res.value.set(w, h);
    PSX.snapRes.value.set(w, h);
  }

  begin() {
    this.renderer.setRenderTarget(this.rt);
    this.renderer.clear();
  }

  end(time) {
    this.mat.uniforms.time.value = time;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
