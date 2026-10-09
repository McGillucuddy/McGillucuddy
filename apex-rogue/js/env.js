'use strict';
// Race environments, one per act. Acts 1-2 are the dystopian undercity: smog, megastructures looming in
// the distance, dirty tracks and slums. Acts 3-4 are the rich upper city where prisoners race for the
// elite's entertainment: clean, bright and gilded, with the smog sea far below.
//
// Pieces: a sky dome and a ring of distant megastructures that follow the camera (always on the horizon),
// themed walls and fences, light masts, set pieces by the start line and scenery from track.decos.

const ENV_THEMES = {
  undercity: {
    luxury: false,
    // Sky texture rows top→bottom (0 = zenith, 0.5 = horizon). The underside of the upper city's plate
    // hangs overhead; the only daylight leaks in round its edge.
    sky: [[0, '#0b0a09'], [0.36, '#16130f'], [0.43, '#2a2016'], [0.47, '#8a5a2a'], [0.5, '#4a3826'], [1, '#231d16']],
    fog: '#2e261c', near: 160, far: 1700, retroNear: 80, retroFar: 900,
    hemiSky: '#9a9080', hemiGround: '#2a241c', hemi: 0.8, retroHemi: 0.75, sunColor: '#ffae66', sun: 0.6, retroSun: 0.5, sunPos: [-500, 260, 900],
    facade: '#1d1b18', glass: false, windows: ['#ffb45a', '#ff9440', '#e8e0c8'], lit: 0.22,
    haze: [0.18, 0.55, 0.55], // base, by distance, low-down smog
    banner: { text: 'WIN YOUR FREEDOM', bg: '#141210', fg: '#e8e0c8', edge: '#d9b52c' },
    plate: true,
  },
  stacks: {
    luxury: false,
    sky: [[0, '#2a1e18'], [0.3, '#4a3022'], [0.42, '#8a4a26'], [0.48, '#c9783a'], [0.5, '#8a5a3a'], [1, '#3a2a1e']],
    fog: '#6a4a32', near: 220, far: 2000, retroNear: 100, retroFar: 1000,
    hemiSky: '#e0b090', hemiGround: '#3a2a1e', hemi: 0.95, retroHemi: 0.85, sunColor: '#ff9a50', sun: 1.0, retroSun: 0.85, sunPos: [900, 220, -300],
    facade: '#2a221c', glass: false, windows: ['#ffb45a', '#ffd88a', '#ff7a3a'], lit: 0.16,
    haze: [0.22, 0.5, 0.6],
    banner: { text: 'THE STACKS · LAP OR DIE', bg: '#2a1a12', fg: '#f0d8b0', edge: '#b5452a' },
    smog: true,
  },
  terraces: {
    luxury: true,
    sky: [[0, '#3a78c0'], [0.3, '#7ab0e0'], [0.46, '#cfe4f4'], [0.5, '#e8eef0'], [0.53, '#9a8a70'], [1, '#6a5a44']],
    fog: '#d4e4ee', near: 600, far: 3300, retroNear: 160, retroFar: 1300,
    hemiSky: '#ffffff', hemiGround: '#6a8a5a', hemi: 1.15, retroHemi: 1.0, sunColor: '#fff6e8', sun: 1.3, retroSun: 1.0, sunPos: [400, 900, 250],
    facade: '#d8e6f0', glass: true, windows: ['#ffffff', '#ffe8b0'], lit: 0.1,
    haze: [0.12, 0.45, 0.25],
    banner: { text: 'AUREUM TERRACE CUP', bg: '#f6f4ee', fg: '#b8902a', edge: '#b8902a' },
    clouds: true, smogSea: true,
  },
  crown: {
    luxury: true,
    sky: [[0, '#1e2a5a'], [0.25, '#4a4a8a'], [0.4, '#c97a6a'], [0.47, '#ffb46a'], [0.5, '#ffd8a0'], [0.53, '#a07050'], [1, '#5a3e2e']],
    fog: '#e8b88a', near: 600, far: 3300, retroNear: 160, retroFar: 1300,
    hemiSky: '#ffe0c0', hemiGround: '#7a6a50', hemi: 1.05, retroHemi: 0.95, sunColor: '#ffc880', sun: 1.35, retroSun: 1.05, sunPos: [-900, 300, 400],
    facade: '#f0e6d8', glass: true, windows: ['#ffe0a0', '#ffffff'], lit: 0.18,
    haze: [0.14, 0.45, 0.25],
    banner: { text: 'THE CROWN GRAND PRIX', bg: '#141210', fg: '#e8c25a', edge: '#e8c25a' },
    clouds: true, smogSea: true, fireworks: true,
  },
};

const ENV_TILE = 160; // world units per facade texture tile

const Env = {
  // ---------- Textures ----------

  canvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  },

  skyTexture(th, seed) {
    return Env.canvas(512, 256, (g, W, H) => {
      const rng = mulberry32(seed);
      const grad = g.createLinearGradient(0, 0, 0, H);
      for (const [t, c] of th.sky) grad.addColorStop(t, c);
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      if (th.plate) {
        // Underside of the plate: girders and a grid of sodium lights.
        g.fillStyle = 'rgba(0,0,0,0.35)';
        for (let x = 0; x < W; x += 32) g.fillRect(x, 0, 4, H * 0.42);
        for (let y = 8; y < H * 0.42; y += 18) g.fillRect(0, y, W, 2);
        for (let k = 0; k < 220; k++) {
          const y = rng() * H * 0.41;
          g.fillStyle = rng() < 0.8 ? 'rgba(255,170,80,0.8)' : 'rgba(200,220,255,0.7)';
          g.fillRect(rng() * W, y, 2, 1);
        }
        // Ragged plate edge with light leaking under it.
        g.fillStyle = '#0d0b09';
        g.beginPath();
        g.moveTo(0, 0);
        for (let x = 0; x <= W; x += 8) g.lineTo(x, H * (0.42 + rng() * 0.025));
        g.lineTo(W, 0);
        g.fill();
      }
      if (th.smog) {
        // A swollen sun drowning in smog, and smoke streaks.
        const sx = W * 0.25, sy = H * 0.44;
        const sg = g.createRadialGradient(sx, sy, 2, sx, sy, 60);
        sg.addColorStop(0, 'rgba(255,200,140,0.9)'); sg.addColorStop(0.2, 'rgba(255,140,60,0.5)'); sg.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = sg; g.fillRect(sx - 60, sy - 60, 120, 120);
        for (let k = 0; k < 40; k++) {
          g.fillStyle = `rgba(30,20,14,${0.1 + rng() * 0.15})`;
          g.beginPath(); g.ellipse(rng() * W, H * (0.15 + rng() * 0.3), 30 + rng() * 60, 3 + rng() * 5, 0, 0, TAU); g.fill();
        }
      }
      if (th.clouds) {
        const warm = !!th.fireworks;
        if (!warm) {
          const sx = W * 0.7, sy = H * 0.18;
          const sg = g.createRadialGradient(sx, sy, 1, sx, sy, 30);
          sg.addColorStop(0, 'rgba(255,255,240,1)'); sg.addColorStop(1, 'rgba(255,255,240,0)');
          g.fillStyle = sg; g.fillRect(sx - 30, sy - 30, 60, 60);
        } else {
          const sx = W * 0.6, sy = H * 0.48;
          const sg = g.createRadialGradient(sx, sy, 3, sx, sy, 70);
          sg.addColorStop(0, 'rgba(255,240,200,1)'); sg.addColorStop(0.25, 'rgba(255,190,110,0.6)'); sg.addColorStop(1, 'rgba(255,160,90,0)');
          g.fillStyle = sg; g.fillRect(sx - 70, sy - 70, 140, 140);
        }
        for (let k = 0; k < 26; k++) {
          const x = rng() * W, y = H * (0.28 + rng() * 0.18), w = 20 + rng() * 50;
          g.fillStyle = warm ? `rgba(255,${170 + rng() * 50},${150 + rng() * 40},0.5)` : 'rgba(255,255,255,0.65)';
          for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(x + (j - 1.5) * w * 0.3, y - rng() * 4, w * 0.35, 4 + rng() * 3, 0, 0, TAU); g.fill(); }
        }
      }
      if (th.smogSea) {
        // Far below the upper city: the brown smog the undercity breathes.
        for (let k = 0; k < 60; k++) {
          g.fillStyle = `rgba(${80 + rng() * 30},${60 + rng() * 20},${40 + rng() * 10},0.35)`;
          g.beginPath(); g.ellipse(rng() * W, H * (0.52 + rng() * 0.06), 30 + rng() * 50, 2 + rng() * 3, 0, 0, TAU); g.fill();
        }
      }
    });
  },

  facadeTexture(th, seed) {
    const tex = Env.canvas(128, 128, (g, W, H) => {
      const rng = mulberry32(seed);
      g.fillStyle = th.facade;
      g.fillRect(0, 0, W, H);
      if (th.glass) {
        const grad = g.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, 'rgba(120,170,220,0.9)'); grad.addColorStop(0.5, 'rgba(200,230,250,0.9)'); grad.addColorStop(1, 'rgba(90,140,200,0.9)');
        g.fillStyle = grad;
        for (let y = 2; y < H; y += 16) g.fillRect(0, y, W, 11);
        g.fillStyle = 'rgba(255,255,255,0.8)';
        for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 2, H);
      } else {
        for (let y = 4; y < H; y += 16) {
          for (let x = 3; x < W; x += 16) {
            g.fillStyle = rng() < th.lit ? th.windows[Math.floor(rng() * th.windows.length)] : 'rgba(0,0,0,0.45)';
            g.fillRect(x, y, 9, 8);
          }
        }
        g.fillStyle = 'rgba(0,0,0,0.25)';
        for (let k = 0; k < 20; k++) g.fillRect(rng() * W, 0, 2, H); // grime streaks
      }
      if (th.glass) {
        for (let k = 0; k < 18; k++) {
          g.fillStyle = th.windows[Math.floor(rng() * th.windows.length)];
          g.fillRect(Math.floor(rng() * 8) * 16 + 3, Math.floor(rng() * 8) * 16 + 4, 10, 8);
        }
      }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  },

  // Concrete with graffiti and hazard stripes, or clean white panels with sponsor boards.
  wallTexture(th, seed) {
    const tex = Env.canvas(512, 64, (g, W, H) => {
      const rng = mulberry32(seed);
      if (!th.luxury) {
        g.fillStyle = '#6e6a60'; g.fillRect(0, 0, W, H);
        for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '255,255,255'},${rng() * 0.08})`; g.fillRect(rng() * W, rng() * H, 2, 2); }
        for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(20,16,10,${0.1 + rng() * 0.2})`; g.fillRect(rng() * W, 8, 2 + rng() * 4, H * (0.3 + rng() * 0.6)); }
        g.fillStyle = 'rgba(40,30,20,0.45)'; g.fillRect(0, H - 12, W, 12); // road dirt
        for (let x = 0; x < W; x += 16) { g.fillStyle = (x / 16) % 2 ? '#1a1a1a' : '#c9a227'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x + 8, 8); g.lineTo(x - 8, 8); g.fill(); }
        g.fillStyle = 'rgba(0,0,0,0.6)';
        for (let x = 0; x < W; x += 128) g.fillRect(x, 0, 2, H); // panel seams
        const tags = ['FREE', '4471', 'NO GODS', 'RUN', 'X', 'WARDEN LIES', '13'];
        for (let k = 0; k < 6; k++) {
          g.save();
          g.translate(30 + rng() * (W - 60), 22 + rng() * 26);
          g.rotate((rng() - 0.5) * 0.3);
          g.font = `bold ${12 + Math.floor(rng() * 10)}px Impact, sans-serif`;
          g.fillStyle = ['#d23a2a', '#e8e0c8', '#3ac87a', '#3a8ad8', '#d8b52c'][Math.floor(rng() * 5)];
          g.globalAlpha = 0.7 + rng() * 0.3;
          g.fillText(tags[Math.floor(rng() * tags.length)], 0, 0);
          g.restore();
        }
      } else {
        g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, W, H);
        g.fillStyle = th.fireworks ? '#d9b24a' : '#c9a443'; g.fillRect(0, 0, W, 6);
        g.fillStyle = '#1a1a1a'; g.fillRect(0, H - 6, W, 6);
        const logos = [['AUREUM', '#b8902a'], ['HELIX', '#1a1a1a'], ['WARDEN CORP', '#a8322a'], ['CROWN BANK', '#1e3a6a']];
        logos.forEach(([t, c], i) => {
          g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(i * 128, 6, 1, H - 12);
          g.font = 'bold 22px Georgia, serif';
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = c;
          g.fillText(t, i * 128 + 64, H / 2 + 1, 116);
        });
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  },

  // ---------- Distant megastructures ----------

  // One mesh for the whole skyline: per-vertex colour, an optional facade texture, and height/distance haze
  // mixed in a tiny shader so the towers sink into the smog (or the clean blue) without the fog swallowing them.
  skylineMaterial(th, map) {
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, haze: { value: new THREE.Color(th.fog) }, hz: { value: new THREE.Vector3(...th.haze) } },
      vertexShader: `
        attribute vec3 aCol; attribute vec2 aUv; attribute float aWin; attribute float aFar;
        varying vec3 vCol; varying vec2 vUv; varying float vWin; varying float vHaze;
        uniform vec3 hz;
        void main() {
          vCol = aCol; vUv = aUv; vWin = aWin;
          float low = 1.0 - clamp(position.y / 900.0, 0.0, 1.0);
          vHaze = clamp(hz.x + aFar * hz.y + low * low * hz.z, 0.0, 0.95);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D map; uniform vec3 haze;
        varying vec3 vCol; varying vec2 vUv; varying float vWin; varying float vHaze;
        void main() {
          vec3 c = vCol;
          if (vWin > 0.5) c *= texture2D(map, vUv).rgb;
          gl_FragColor = vec4(mix(c, haze, vHaze), 1.0);
          #include <colorspace_fragment>
        }`,
      fog: false,
    });
  },

  skyline(th, seed) {
    const rng = mulberry32(seed);
    const parts = [];
    const col = (c) => new THREE.Color(c);
    const add = (geo, x, y, z, ry, color, win, far) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
      parts.push({ geo, m, color: col(color), win: win ? 1 : 0, far });
    };
    // Box with UVs scaled so the facade texture tiles at a constant size.
    const boxGeo = (w, h, d) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const uv = g.attributes.uv;
      const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, uv.getX(i) * dims[f][0] / ENV_TILE, uv.getY(i) * dims[f][1] / ENV_TILE);
      }
      return g;
    };
    const cylGeo = (rt, rb, h, seg) => {
      const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, false);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (TAU * rb) / ENV_TILE, uv.getY(i) * h / ENV_TILE);
      return g;
    };
    const beacon = th.luxury ? '#ffd86a' : '#ff3a2a';
    const body = th.luxury ? '#ffffff' : '#ffffff';
    const solid = th.luxury ? '#e8e2d6' : '#2a2620';

    if (!th.luxury) {
      // Megablocks: brutalist slabs kilometres high, linked by skybridges.
      const n = th.plate ? 30 : 38;
      let prev = null;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + rng() * 0.12, R = 2500 + rng() * 2000, far = (R - 2500) / 2000;
        const w = 160 + rng() * 360, d = 140 + rng() * 300, h = (th.plate ? 900 : 700) + rng() * 2100;
        const x = Math.cos(a) * R, z = Math.sin(a) * R, ry = rng() * TAU;
        add(boxGeo(w, h, d), x, h / 2, z, ry, body, true, far);
        if (rng() < 0.6) { const h2 = h * (0.2 + rng() * 0.3); add(boxGeo(w * 0.6, h2, d * 0.6), x, h + h2 / 2, z, ry, body, true, far); }
        if (rng() < 0.5) {
          add(new THREE.BoxGeometry(6, 300, 6), x, h + 150, z, 0, solid, false, far);
          add(new THREE.BoxGeometry(14, 14, 14), x, h + 300, z, 0, beacon, false, 0);
        }
        if (prev && rng() < 0.45) {
          // Skybridge to the previous block.
          const mx = (x + prev.x) / 2, mz = (z + prev.z) / 2, len = Math.hypot(x - prev.x, z - prev.z);
          const by = Math.min(h, prev.h) * (0.4 + rng() * 0.4);
          add(boxGeo(len, 30, 40), mx, by, mz, -Math.atan2(z - prev.z, x - prev.x), body, true, far);
        }
        prev = { x, z, h };
      }
      if (th.plate) {
        // Support pillars holding the upper city up, vanishing into the plate overhead.
        for (let k = 0; k < 9; k++) {
          const a = rng() * TAU, R = 1800 + rng() * 2400, r = 90 + rng() * 80;
          const x = Math.cos(a) * R, z = Math.sin(a) * R;
          add(cylGeo(r, r * 1.15, 4400, 8), x, 2200, z, 0, solid, false, (R - 1800) / 2400);
          for (let y = 300; y < 2600; y += 520) add(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 12, 8), x, y, z, 0, '#ff9a3a', false, 0);
        }
      } else {
        // Smokestacks and cooling towers on the horizon.
        for (let k = 0; k < 12; k++) {
          const a = rng() * TAU, R = 2300 + rng() * 1600, x = Math.cos(a) * R, z = Math.sin(a) * R, h = 500 + rng() * 700;
          add(cylGeo(28, 44, h, 8), x, h / 2, z, 0, '#5a3a2a', false, (R - 2300) / 1600);
          add(new THREE.CylinderGeometry(30, 30, 10, 8), x, h - 30, z, 0, beacon, false, 0);
        }
      }
      // The Spire: the upper city's tower, out of reach for now. Its crown is the only clean light in the sky.
      const a = 0.6, R = 4300, x = Math.cos(a) * R, z = Math.sin(a) * R;
      add(boxGeo(700, 2600, 700), x, 1300, z, 0.4, body, true, 1);
      add(boxGeo(460, 1400, 460), x, 3300, z, 0.4, body, true, 1);
      add(cylGeo(60, 200, 900, 6), x, 4450, z, 0, solid, false, 1);
      for (const y of [2620, 4020]) add(new THREE.CylinderGeometry(560, 560, 24, 12), x, y, z, 0, '#ffe2a0', false, 0.2);
    } else {
      // Glass towers with gold crowns and roof gardens.
      const n = 34;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + rng() * 0.15, R = 2400 + rng() * 2100, far = (R - 2400) / 2100;
        const x = Math.cos(a) * R, z = Math.sin(a) * R, ry = rng() * TAU;
        const h = 500 + rng() * 1600, round = rng() < 0.35;
        if (round) {
          const r = 70 + rng() * 90;
          add(cylGeo(r * 0.8, r, h, 10), x, h / 2, z, ry, body, true, far);
          add(new THREE.SphereGeometry(r * 0.8, 10, 5, 0, TAU, 0, Math.PI / 2), x, h, z, 0, '#d9b24a', false, far);
        } else {
          const w = 120 + rng() * 200, d = 120 + rng() * 200;
          add(boxGeo(w, h, d), x, h / 2, z, ry, body, true, far);
          add(new THREE.BoxGeometry(w * 1.04, 16, d * 1.04), x, h + 8, z, ry, '#d9b24a', false, far);
          if (rng() < 0.5) add(new THREE.BoxGeometry(w * 0.8, 30, d * 0.8), x, h + 31, z, ry, '#5a9a4a', false, far);
          else { const h2 = h * 0.25; add(boxGeo(w * 0.55, h2, d * 0.55), x, h + h2 / 2, z, ry, body, true, far); }
        }
        if (rng() < 0.3) add(new THREE.BoxGeometry(5, 200, 5), x, h + 100, z, 0, '#f0e8d8', false, far);
      }
      // The Spire up close: white stone and gold rings.
      const a = 0.6, R = th.fireworks ? 2400 : 3200, x = Math.cos(a) * R, z = Math.sin(a) * R;
      add(cylGeo(260, 420, 2400, 8), x, 1200, z, 0, '#f6f0e4', false, 0.3);
      add(cylGeo(120, 260, 1400, 8), x, 3100, z, 0, '#f6f0e4', false, 0.3);
      add(new THREE.ConeGeometry(120, 600, 8), x, 4100, z, 0, '#e8c25a', false, 0.3);
      for (const y of [800, 1600, 2400, 3000, 3600]) add(new THREE.CylinderGeometry(y < 2400 ? 440 : 280, y < 2400 ? 440 : 280, 30, 16), x, y, z, 0, '#e8c25a', false, 0.25);
    }

    // Merge everything into one geometry: position, colour, uv, facade flag and distance.
    const P = [], C = [], U = [], Wn = [], F = [];
    for (const p of parts) {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      g.applyMatrix4(p.m);
      const pos = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        P.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        C.push(p.color.r, p.color.g, p.color.b);
        U.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
        Wn.push(p.win);
        F.push(p.far);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('aCol', new THREE.Float32BufferAttribute(C, 3));
    geo.setAttribute('aUv', new THREE.Float32BufferAttribute(U, 2));
    geo.setAttribute('aWin', new THREE.Float32BufferAttribute(Wn, 1));
    geo.setAttribute('aFar', new THREE.Float32BufferAttribute(F, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, Env.skylineMaterial(th, Env.facadeTexture(th, seed + 7)));
    mesh.frustumCulled = false;
    mesh.name = 'skyline';
    return mesh;
  },

  // ---------- Near-field scenery (lit, fogged, PSX-textured) ----------

  models: {
    shacks(seed) {
      const g = new THREE.Group(), rng = mulberry32(seed);
      const cols = ['#7a3a22', '#2f5a6a', '#5a6a3a', '#8a7a5a', '#3a3a4a'];
      let y = 0;
      for (let k = 0; k < 2 + Math.floor(rng() * 2); k++) {
        const c = LP.box(48, 20, 20, LP.mat(cols[Math.floor(rng() * cols.length)], { roughness: 0.9 }), (rng() - 0.5) * 16, y + 10, (rng() - 0.5) * 10);
        c.rotation.y = (rng() - 0.5) * 0.4;
        g.add(c);
        if (rng() < 0.7) g.add(LP.box(6, 8, 0.5, LP.glow(rng() < 0.5 ? '#ffb45a' : '#d8e0ff', 0.9), c.position.x + 8, y + 9, c.position.z + 10.2));
        y += 20;
      }
      const tarp = LP.box(40, 1, 26, LP.mat('#2a5a9a'), 0, y + 2, 0);
      tarp.rotation.z = 0.12;
      g.add(tarp);
      g.add(LP.beam([20, 0, 12], [20, y + 2, 12], 0.6, LP.mat('#3a3028')));
      return g;
    },
    fireBarrel() {
      const g = new THREE.Group();
      Env.sculpt(g, 'fireBarrel', 0.2, (sc) => {
        const rust = LP.mat('#5a3a22', { roughness: 1 }), coat = LP.mat('#1e1c1a', { roughness: 1 }), hood = LP.mat('#2a2622', { roughness: 1 });
        sc.add(rust, SDF.lathe([[2.9, 0], [3.05, 0.4], [3.0, 2.6], [3.15, 2.9], [3.0, 3.2], [3.0, 5.4], [3.15, 5.7], [3.0, 6.0], [3.0, 7.8], [2.8, 8], [0, 8]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.1);
        sc.cut(SDF.cyl(2.6, 2, 'y', 0.2, [0, 8, 0]), 0.2, [rust]); // open top
        for (let k = 0; k < 5; k++) sc.cut(SDF.ellipsoid([0.6, 0.45, 0.6], [Math.cos(k * 1.3) * 3, 1.4 + (k % 2) * 3, Math.sin(k * 1.3) * 3]), 0.1, [rust]); // air holes
        // Two hooded figures hunched towards the fire, hands held out.
        for (const [x, z] of [[6, 2], [-5, 4]]) {
          const dir = Math.atan2(-z, -x), fx = Math.cos(dir), fz = Math.sin(dir);
          sc.add(coat, SDF.cone([x, 0.5, z], [x + fx * 0.6, 8.5, z + fz * 0.6], 1.9, 1.5), 0.4);
          sc.add(hood, SDF.ellipsoid([1.5, 1.7, 1.5], [x + fx * 1.0, 10.4, z + fz * 1.0]), 0.6);
          for (const sd of [-1, 1]) {
            const sx = -fz * sd, sz = fx * sd;
            sc.add(coat, SDF.path([[x + sx * 1.4 + fx * 0.4, 8, z + sz * 1.4 + fz * 0.4], [x + sx * 1.0 + fx * 2.2, 7.2, z + sz * 1.0 + fz * 2.2], [x + sx * 0.5 + fx * 3.6, 7.6, z + sz * 0.5 + fz * 3.6]], 0.55), 0.4);
          }
        }
      });
      g.add(LP.mesh(new THREE.ConeGeometry(2.6, 7, 7), LP.glow('#ff7a1a', 2.2), 0, 11, 0));
      g.add(LP.mesh(new THREE.ConeGeometry(1.4, 5, 7), LP.glow('#ffd06a', 2.5), 0.4, 10, 0.3));
      return g;
    },
    wreck(seed) {
      const g = new THREE.Group(), rng = mulberry32(seed);
      const paint = LP.mat(['#6a2a1e', '#3a4a5a', '#5a5a4a'][Math.floor(rng() * 3)], { roughness: 1 });
      Env.sculpt(g, 'wreck' + seed, 0.35, (sc) => {
        // A crushed car: body and caved-in cabin as one dented shell, gutted windows, the wheels it has left.
        const dent = (x, y, z) => [x, y + 0.6 * Math.sin(x * 0.35 + seed) * Math.cos(z * 0.4), z];
        sc.add(paint, SDF.warp(SDF.box([40, 8, 17], 2.4, [0, 5, 0], [0, 0, 0.08]), dent, 1), 0.2);
        sc.add(paint, SDF.warp(SDF.box([18, 6, 15], 2.2, [-3, 11, 0], [0.1, 0, -0.15]), dent, 1), 1.5);
        sc.cut(SDF.box([16, 4.2, 18], 1.0, [-3, 11.2, 0], [0.1, 0, -0.15]), 0.6, [paint]); // gutted glass
        sc.cut(SDF.ellipsoid([6, 3, 5], [12, 9, 6]), 1.0, [paint]); // a big dent in the bonnet
        const tyre = LP.mat('#151515');
        for (const [x, z] of [[13, 9], [-13, -9], [-13, 9]]) sc.add(tyre, SDF.torus(2.8, 1.3, [x, 3, z]), 0.1);
      });
      g.rotation.z = rng() < 0.3 ? Math.PI * 0.95 : 0; // some on their roofs
      return g;
    },
    junk(seed) {
      const g = new THREE.Group(), rng = mulberry32(seed);
      Env.sculpt(g, 'junk' + seed, 0.45, (sc) => {
        const mats = ['#4a4238', '#5a4a3a', '#3a3632'].map((c) => LP.mat(c, { roughness: 1 }));
        for (let k = 0; k < 6; k++) {
          const r = 4 + rng() * 6;
          sc.add(mats[k % 3], SDF.box([r * 1.6, r * 0.9, r * 1.3], r * 0.3, [(rng() - 0.5) * 24, r * 0.4, (rng() - 0.5) * 24], [rng(), rng() * 3, rng() * 0.5]), 1.5); // slumped scrap
        }
        const tyre = LP.mat('#141414');
        for (let k = 0; k < 4; k++) sc.add(tyre, SDF.torus(4, 1.6, [12 + (k % 2) * 0.8, 1.6 + k * 3.2, 8], [Math.PI / 2, 0, 0]), 0.1);
      });
      return g;
    },
    pillar() {
      const g = new THREE.Group();
      const conc = LP.mat('#4a463e', { roughness: 1 });
      g.add(LP.cyl(34, 40, 700, 6, conc, 0, 350, 0));
      g.add(LP.cyl(41, 41, 12, 6, LP.mat('#c9a227'), 0, 20, 0));
      for (const y of [120, 260, 400]) g.add(LP.cyl(36, 36, 4, 6, LP.glow('#ffae5a', 1.2), 0, y, 0));
      return g;
    },
    tank() {
      const g = new THREE.Group();
      g.add(LP.cyl(20, 20, 32, 10, LP.mat('#b8b0a0', { metalness: 0.4 }), 0, 16, 0));
      g.add(LP.cyl(20, 20, 3, 10, LP.mat('#8a3a22'), 0, 33, 0));
      g.add(LP.box(1.5, 34, 3, LP.mat('#3a3632'), 20.5, 17, 0)); // ladder
      return g;
    },
    smokestack() {
      const g = new THREE.Group();
      g.add(LP.cyl(6, 9, 220, 8, LP.mat('#7a3a2a', { roughness: 1 }), 0, 110, 0));
      for (const y of [150, 200]) g.add(LP.cyl(6.6, 6.6, 6, 8, LP.mat('#e8e0d0'), 0, y, 0));
      g.add(LP.cyl(7, 7, 3, 8, LP.glow('#ff2a1a', 1.5), 0, 216, 0));
      const smoke = LP.mat('#3a3430', { transparent: true, opacity: 0.55, roughness: 1 });
      [[0, 236, 0, 12], [6, 256, 3, 16], [14, 280, 4, 20]].forEach(([x, y, z, r], i) => g.add(LP.mesh(LP.jitter(new THREE.IcosahedronGeometry(r, 0), r * 0.3, 70 + i), smoke, x, y, z)));
      return g;
    },
    coolingTower() {
      const g = new THREE.Group();
      const pts = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new THREE.Vector2(70 - 34 * Math.sin(t * Math.PI * 0.8), t * 170)); }
      g.add(LP.mesh(new THREE.LatheGeometry(pts, 12), LP.mat('#9a948a', { roughness: 1, side: THREE.DoubleSide })));
      const steam = LP.mat('#d8d4cc', { transparent: true, opacity: 0.5, roughness: 1 });
      [[0, 190, 0, 34], [10, 220, 6, 40]].forEach(([x, y, z, r], i) => g.add(LP.mesh(LP.jitter(new THREE.IcosahedronGeometry(r, 0), r * 0.3, 80 + i), steam, x, y, z)));
      return g;
    },
    pipes() {
      const g = new THREE.Group(), steel = LP.mat('#4a4a48', { metalness: 0.5 });
      for (const x of [-30, 0, 30]) { g.add(LP.box(2, 26, 2, steel, x, 13, -8)); g.add(LP.box(2, 26, 2, steel, x, 13, 8)); g.add(LP.box(2, 2, 18, steel, x, 26, 0)); }
      [['#8a6a3a', -4, 28], ['#6a7a5a', 4, 28], ['#7a3a2a', 0, 22]].forEach(([c, z, y]) => g.add(LP.cyl(2.4, 2.4, 70, 8, LP.mat(c, { metalness: 0.3 }), 0, y, z).rotateZ(Math.PI / 2)));
      return g;
    },
    tenement(seed) {
      const g = new THREE.Group(), rng = mulberry32(seed);
      const h = 90 + rng() * 120;
      g.add(LP.box(60, h, 46, LP.mat('#4a4038', { roughness: 1 }), 0, h / 2, 0));
      const lit = LP.glow('#ffb45a', 0.9), dark = LP.mat('#141210');
      for (let y = 10; y < h - 6; y += 14) for (let x = -22; x <= 22; x += 11) {
        g.add(LP.box(6, 7, 0.5, rng() < 0.25 ? lit : dark, x, y, 23.3));
        if (rng() < 0.15) g.add(LP.box(8, 1, 4, LP.mat('#3a3632'), x, y - 4.5, 25)); // balcony junk
      }
      g.add(LP.box(1, 30, 1, LP.mat('#222'), 18, h + 15, 10)); // antenna
      g.add(LP.box(30, 10, 0.6, LP.glow(['#ff3a6a', '#3ad8ff', '#ffd23f'][Math.floor(rng() * 3)], 1.1), 0, h - 14, 23.6)); // flickering advert
      return g;
    },
    palm(seed) {
      const g = new THREE.Group(), rng = mulberry32(seed);
      const lean = 0.15 + rng() * 0.2;
      Env.sculpt(g, 'palm' + seed, 0.55, (sc) => {
        const bark = LP.mat('#8a7050', { roughness: 1 }), leaf = LP.mat('#3a7a32', { side: THREE.DoubleSide }), nut = LP.mat('#5a4020');
        const pts = [];
        for (let k = 0; k <= 6; k++) pts.push([Math.sin((k / 6) * 1.3) * 14 * lean * 4, k * 9, 0]);
        for (let k = 0; k < 6; k++) sc.add(bark, SDF.cone(pts[k], pts[k + 1], 1.9 - k * 0.12, 1.75 - k * 0.12), 0.25); // ringed trunk, tapering
        const top = pts[6];
        for (let k = 0; k < 9; k++) { // arching fronds: a flattened blade along a drooping curve
          const a = (k / 9) * TAU + rng() * 0.3, c = Math.cos(a), sn = Math.sin(a), L = 20 + rng() * 4;
          const p = (t) => [top[0] + c * L * t, top[1] + 4 * t - 10 * t * t, top[2] + sn * L * t];
          sc.add(leaf, SDF.warp(SDF.path([p(0), p(0.35), p(0.7), p(1)], 1.0), (x, y, z) => {
            const dx = x - top[0], dz = z - top[2], along = dx * c + dz * sn, side = -dx * sn + dz * c;
            return [top[0] + along * c - side * sn / 3.2, y, top[2] + along * sn + side * c / 3.2];
          }, 2), 0.6);
        }
        for (const [dx, dz] of [[1.2, 0.6], [-0.8, 1.1], [0.2, -1.3]]) sc.add(nut, SDF.ellipsoid([1.2, 1.4, 1.2], [top[0] + dx, top[1] - 1.6, top[2] + dz]), 0.3);
      });
      return g;
    },
    topiary(seed) {
      const g = new THREE.Group(), rng = mulberry32(seed);
      const ry = 12 + rng() * 2;
      Env.sculpt(g, 'topiary' + seed, 0.35, (sc) => {
        const hedge = LP.mat('#2f6a2a', { roughness: 1 }), pot = LP.mat('#f2efe6');
        for (let k = 0; k < 3; k++) {
          const x = (k - 1) * 16;
          sc.add(pot, SDF.lathe([[3.2, 0], [3.0, 0.6], [4.0, 4.4], [4.4, 5.0], [0, 5.0]], [x, 0, 0], [-Math.PI / 2, 0, 0]), 0.3);
          if ((k + seed) % 2) sc.add(hedge, SDF.ellipsoid([5.5, 5.5, 5.5], [x, 10.5, 0]), 0.4);
          else sc.add(hedge, SDF.cone([x, 6, 0], [x, 20, 0], 4.6, 0.6), 0.4);
          sc.add(hedge, SDF.cyl(0.6, 2.4, 'y', 0.2, [x, 5.5, 0]), 0.6); // stem into the pot
        }
        sc.add(hedge, SDF.box([56, 6, 5], 2.2, [0, 3, ry]), 0.5); // clipped hedge row
      });
      return g;
    },
    villa(seed) {
      const g = new THREE.Group(), rng = mulberry32(seed);
      const white = LP.mat('#f4f2ec'), glass = LP.mat('#9ac8e8', { metalness: 0.6, roughness: 0.15, emissive: '#2a4a6a', emissiveIntensity: 0.3 }), gold = LP.mat('#d9b24a', { metalness: 0.7, roughness: 0.3 });
      g.add(LP.box(70, 18, 44, white, 0, 9, 0));
      g.add(LP.box(66, 10, 44.4, glass, 0, 9, 0));
      g.add(LP.box(50, 16, 36, white, 8 + rng() * 6, 26, -2));
      g.add(LP.box(46, 9, 36.4, glass, 8 + rng() * 6, 26, -2));
      g.add(LP.box(72, 1.2, 46, gold, 0, 18.4, 0));
      g.add(LP.box(52, 1.2, 38, gold, 10, 34.4, -2));
      g.add(LP.box(40, 0.6, 18, LP.glow('#4ac8e8', 0.7), -6, 0.4, 34)); // pool
      g.add(LP.box(44, 1, 22, white, -6, 0.2, 34));
      return g;
    },
    fountain() {
      const g = new THREE.Group();
      Env.sculpt(g, 'fountain', 0.45, (sc) => {
        const marble = LP.mat('#ece8de');
        sc.add(marble, SDF.lathe([[22, 0], [24, 0.6], [24, 3.6], [22.6, 4.2], [21.5, 4.2], [21.5, 1.4], [0, 1.4]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.3); // basin with a lip
        sc.add(marble, SDF.lathe([[5, 1.4], [4, 3], [2.6, 6], [3, 12], [2.4, 15], [9, 17.6], [9.4, 18.6], [0, 18.6]], [0, 0, 0], [-Math.PI / 2, 0, 0]), 0.3); // pedestal and upper bowl
        sc.cut(SDF.cyl(8, 2, 'y', 0.4, [0, 18.8, 0]), 0.4, [marble]);
      });
      g.add(LP.cyl(21.4, 21.4, 0.6, 24, LP.glow('#5ac8f0', 0.6), 0, 3.4, 0));
      g.add(LP.mesh(new THREE.ConeGeometry(4, 12, 12), LP.mat('#e8f6ff', { transparent: true, opacity: 0.55 }), 0, 25, 0));
      return g;
    },
    statue() {
      const g = new THREE.Group();
      Env.sculpt(g, 'statue', 0.3, (sc) => {
        const marble = LP.mat('#ece8de'), gold = LP.mat('#e0b44a', { metalness: 0.6, roughness: 0.3 });
        sc.add(marble, SDF.box([14, 14, 14], 1.0, [0, 7, 0]), 0.5);
        sc.add(gold, SDF.box([16, 2, 16], 0.8, [0, 14.5, 0]), 0.5);
        // A robed champion holding a torch aloft.
        sc.add(gold, SDF.warp(SDF.cone([0, 15, 0], [0, 29, 0], 3.6, 2.2), (x, y, z) => { const a = Math.atan2(z, x), k = 1 + 0.06 * Math.sin(a * 9); return [x / k, y, z / k]; }, 0.4), 0.8);
        sc.add(gold, SDF.ellipsoid([3.4, 1.8, 2.4], [0, 29.5, 0]), 1.2); // shoulders
        sc.add(gold, SDF.ellipsoid([1.9, 2.3, 2.0], [0, 33.2, 0]), 0.8); // head
        sc.add(gold, SDF.path([[2.6, 29.5, 0], [3.6, 34, 0.4], [4.1, 39, 0]], 0.75), 0.8); // raised arm
        sc.add(gold, SDF.path([[-2.6, 29.5, 0], [-3.0, 25.5, 1.2], [-2.0, 22.5, 2.0]], 0.7), 0.8);
        sc.add(gold, SDF.cone([4.1, 38.8, 0], [4.2, 41, 0], 0.6, 1.1), 0.4); // torch cup
      });
      g.add(LP.mesh(new THREE.SphereGeometry(1.4, 12, 8), LP.glow('#ffd86a', 2), 4.2, 41.8, 0)); // flame
      return g;
    },
    colonnade() {
      const g = new THREE.Group();
      Env.sculpt(g, 'colonnade', 0.5, (sc) => {
        const marble = LP.mat('#f0ece2'), gold = LP.mat('#d9b24a', { metalness: 0.6, roughness: 0.3 });
        for (let k = 0; k < 5; k++) {
          const x = (k - 2) * 14;
          sc.add(marble, SDF.lathe([[3.8, 3], [3.8, 4], [3.1, 4.8], [2.9, 6], [2.6, 32], [3.3, 32.8], [3.9, 34]], [x, 0, 0], [-Math.PI / 2, 0, 0]), 0.2); // base, tapering shaft, capital
          for (let f = 0; f < 12; f++) { const a = (f / 12) * TAU; sc.cut(SDF.cone([x + Math.cos(a) * 2.95, 6.5, Math.sin(a) * 2.95], [x + Math.cos(a) * 2.65, 31.5, Math.sin(a) * 2.65], 0.32, 0.28), 0.1, [marble]); } // fluting
        }
        sc.add(marble, SDF.box([66, 5, 8], 0.6, [0, 36.5, 0]), 0.4);
        sc.add(marble, SDF.box([66, 3, 10], 0.6, [0, 1.5, 0]), 0.4);
        sc.add(gold, SDF.box([66, 1.2, 8.4], 0.3, [0, 34.4, 0]), 0.2);
      });
      return g;
    },
    flags(seed) {
      const g = new THREE.Group();
      const cols = ['#d9b24a', '#a8322a', '#f4f2ec', '#1e3a6a'];
      Env.sculpt(g, 'flags' + seed, 0.3, (sc) => {
        const pole = LP.mat('#e8e2d0', { metalness: 0.5 }), gold = LP.mat('#d9b24a', { metalness: 0.7 });
        for (let k = 0; k < 3; k++) {
          const x = (k - 1) * 14;
          sc.add(pole, SDF.cone([x, 0, 0], [x, 50, 0], 0.8, 0.55), 0.1);
          sc.add(gold, SDF.ellipsoid([1, 1.2, 1], [x, 50.8, 0]), 0.3);
          // Cloth rippling in the wind.
          sc.add(LP.mat(cols[(k + seed) % 4], { side: THREE.DoubleSide }), SDF.warp(SDF.box([12, 7, 0.3], 0.12, [x + 6.4, 45, 0]), (px, py, pz) => [px, py, pz - 0.9 * Math.sin((px - x) * 0.6 + seed) * ((px - x) / 12)], 1), 0.05);
        }
      });
      return g;
    },
    // Trackside light masts: sodium floodlights in the undercity, white lamps up top.
    mast(th, broken) {
      const g = new THREE.Group();
      if (!th.luxury) {
        const steel = LP.mat('#4a4844', { metalness: 0.5, roughness: 0.6 });
        g.add(LP.box(3, 110, 3, steel, 0, 55, 0));
        g.add(LP.box(3, 3, 26, steel, 0, 108, 0));
        for (const z of [-10, 0, 10]) {
          g.add(LP.box(5, 4, 6, broken && z !== 0 ? LP.mat('#222') : LP.glow('#ffb45a', 1.6), -2, 104, z));
        }
        g.add(LP.beam([0, 20, 0], [0, 70, 6], 0.4, LP.mat('#222'))); // cable
      } else {
        const white = LP.mat('#f4f2ec', { metalness: 0.3 });
        g.add(LP.cyl(0.9, 1.4, 60, 8, white, 0, 30, 0));
        g.add(LP.beam([0, 58, 0], [-10, 62, 0], 0.6, white));
        g.add(LP.box(5, 1.6, 3, LP.glow('#fff4e0', 1.8), -10, 61, 0));
        g.add(LP.box(1.2, 14, 6, LP.mat(th.fireworks ? '#d9b24a' : '#a8322a', { side: THREE.DoubleSide }), 1.4, 46, 0)); // banner
      }
      return g;
    },
    grandstand(th) {
      const g = new THREE.Group();
      const crowdTex = Env.canvas(128, 16, (c, W, H) => {
        const rng = mulberry32(5);
        c.fillStyle = '#1a1814'; c.fillRect(0, 0, W, H);
        const pal = ['#f4f2ec', '#d9b24a', '#a8322a', '#1e3a6a', '#e8c0a0', '#2a2a2a', '#c87aa8'];
        for (let x = 1; x < W; x += 3) for (let y = 2; y < H; y += 7) { c.fillStyle = pal[Math.floor(rng() * pal.length)]; c.fillRect(x, y + (rng() < 0.3 ? -1 : 0), 2, 3); }
      });
      crowdTex.magFilter = THREE.NearestFilter;
      const crowd = LP.mat('#ffffff', { map: crowdTex }), marble = LP.mat('#f0ece2'), gold = LP.mat('#d9b24a', { metalness: 0.6, roughness: 0.35 });
      for (let k = 0; k < 6; k++) {
        g.add(LP.box(130, 6, 8, marble, 0, 3 + k * 6, -k * 8));
        const row = LP.box(128, 4, 0.5, crowd, 0, 8 + k * 6, -k * 8 + 4.3);
        g.add(row);
      }
      g.add(LP.box(136, 2, 60, LP.mat('#f6f4ee'), 0, 58, -22)); // canopy
      g.add(LP.box(136, 1.5, 1.5, gold, 0, 57, 8));
      for (const x of [-64, 0, 64]) g.add(LP.cyl(1.4, 1.4, 58, 6, gold, x, 29, -48));
      g.add(LP.box(60, 10, 1, LP.mat('#ffffff', { map: Env.canvas(256, 32, (c, W, H) => { c.fillStyle = th.fireworks ? '#141210' : '#f6f4ee'; c.fillRect(0, 0, W, H); c.font = 'bold 22px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#c9a443'; c.fillText(th.fireworks ? 'THE CROWN' : 'AUREUM', W / 2, H / 2 + 1); }) }), 0, 65, 8));
      return g;
    },
  },

  // A sculpted scenery model (see js/sculpt.js), meshed once and shared by every copy.
  sculpt(g, key, cell, fill) {
    const sc = new Sculpt('env:' + key, cell);
    fill(sc);
    return sc.build(g);
  },

  // Guard towers with sweeping searchlights (dystopian acts' answer to grandstands).
  guardTower() {
    const g = new THREE.Group();
    const steel = LP.mat('#3a3834', { metalness: 0.4 }), conc = LP.mat('#5a564e', { roughness: 1 });
    Env.sculpt(g, 'guardTower', 0.4, (sc) => {
      // Splayed legs with welded cross braces, a concrete cab with a window slot, an overhanging roof.
      const legs = [[-8, -8], [8, -8], [8, 8], [-8, 8]];
      for (const [x, z] of legs) sc.add(steel, SDF.cone([x, 0, z], [x * 0.7, 64, z * 0.7], 0.9, 0.7), 0.6);
      for (let i = 0; i < 4; i++) {
        const [x1, z1] = legs[i], [x2, z2] = legs[(i + 1) % 4];
        for (const [ya, yb] of [[8, 30], [30, 52]]) {
          const fa = 1 - 0.3 * ya / 64, fb = 1 - 0.3 * yb / 64;
          sc.add(steel, SDF.cone([x1 * fa, ya, z1 * fa], [x2 * fb, yb, z2 * fb], 0.4, 0.4), 0.5);
          sc.add(steel, SDF.cone([x2 * fa, ya, z2 * fa], [x1 * fb, yb, z1 * fb], 0.4, 0.4), 0.5);
        }
      }
      sc.add(conc, SDF.box([20, 14, 20], 1.2, [0, 71, 0]), 0.6);
      sc.cut(SDF.box([22, 4.4, 17], 0.6, [0, 73, 0]), 0.3, [conc]);
      sc.cut(SDF.box([17, 4.4, 22], 0.6, [0, 73, 0]), 0.3, [conc]);
      sc.add(steel, SDF.box([24, 2, 24], 0.8, [0, 79, 0]), 0.4);
    });
    g.add(LP.box(18.6, 4.2, 18.6, LP.glow('#ffd8a0', 0.6), 0, 73, 0)); // lit inside, seen through the window slots
    const head = new THREE.Group();
    head.position.set(0, 82, 0);
    head.add(LP.cyl(2.2, 2.2, 4, 8, LP.mat('#222'), 0, 0, 0).rotateZ(Math.PI / 2));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(22, 160, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#fff2c8', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    cone.rotation.z = Math.PI / 2;
    cone.position.x = 80;
    const tilt = new THREE.Group();
    tilt.rotation.z = -0.45;
    tilt.add(cone);
    head.add(tilt);
    g.add(head);
    g.userData.head = head;
    return g;
  },

  // ---------- Assembly ----------

  build(scene, track, themeKey) {
    const th = ENV_THEMES[themeKey];
    const env = { th, follow: new THREE.Group(), lamps: [], towers: [], fireworks: [], fwT: 1 };
    scene.background = new THREE.Color(th.fog);
    scene.fog = new THREE.Fog(th.fog, th.near, th.far);
    env.hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemi);
    env.sun = new THREE.DirectionalLight(th.sunColor, th.sun);
    env.sun.position.set(...th.sunPos);
    scene.add(env.hemi, env.sun);
    env.atmos = {
      clean: { sky: th.fog, near: th.near, far: th.far, hemi: th.hemi, sun: th.sun },
      retro: { sky: th.fog, near: th.retroNear, far: th.retroFar, hemi: th.retroHemi, sun: th.retroSun },
    };

    // Sky dome + megastructures ride along with the camera so they always sit on the horizon.
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5200, 32, 16), new THREE.MeshBasicMaterial({ map: Env.skyTexture(th, track.seed), side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -10;
    dome.name = 'sky';
    env.follow.add(dome, Env.skyline(th, track.seed ^ 0x51ab));
    scene.add(env.follow);

    Env.walls(scene, track, th);
    Env.trackside(scene, track, th, env);
    Env.scenery(scene, track, th, themeKey);
    return env;
  },

  // Walls with UVs (texture runs along the track), plus a fence or glass catch panel on top.
  walls(scene, tr, th) {
    const N = tr.N, inner = tr.hw + tr.runoff;
    const pos = [], uv = [], idx = [];
    const fence = [];
    for (const s of [-1, 1]) {
      const verts = [];
      let dist = 0;
      for (let i = 0; i <= N; i++) {
        const k = i % N;
        const x = tr.pts[k].x + tr.nx[k] * inner * s, y = tr.pts[k].y + tr.ny[k] * inner * s;
        const x2 = tr.pts[k].x + tr.nx[k] * (inner + WALL_T) * s, y2 = tr.pts[k].y + tr.ny[k] * (inner + WALL_T) * s;
        if (i > 0) dist += Math.hypot(x - verts[i - 1].x, y - verts[i - 1].y);
        const q = trackQuery(tr, x, y, k, 45);
        verts.push({ x, y, x2, y2, u: dist / 256, ok: q.dist >= inner - 3 });
      }
      for (let i = 0; i < N; i++) {
        const a = verts[i], b = verts[i + 1];
        if (!a.ok || !b.ok) continue;
        const base = pos.length / 3;
        pos.push(a.x, 0, a.y, b.x, 0, b.y, b.x, WALL_H, b.y, a.x, WALL_H, a.y);
        uv.push(a.u, 0, b.u, 0, b.u, 1, a.u, 1);
        pos.push(a.x, WALL_H, a.y, b.x, WALL_H, b.y, b.x2, WALL_H, b.y2, a.x2, WALL_H, a.y2);
        uv.push(a.u, 0.97, b.u, 0.97, b.u, 0.99, a.u, 0.99);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3, base + 4, base + 5, base + 6, base + 4, base + 6, base + 7);
        fence.push([(a.x + a.x2) / 2, (a.y + a.y2) / 2, (b.x + b.x2) / 2, (b.y + b.y2) / 2, a.u, b.u, i]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const wallTex = Env.wallTexture(th, tr.seed);
    const wall = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.DoubleSide }));
    wall.material.userData.psxTex = null;
    scene.add(wall);

    // Ribbon on top of the wall: chain-link (undercity) or a glass catch panel with a gold rail (upper city).
    const ribbon = (y0, y1, uScale) => {
      const P = [], U = [], I = [];
      for (const [ax, ay, bx, by, ua, ub] of fence) {
        const base = P.length / 3;
        P.push(ax, y0, ay, bx, y0, by, bx, y1, by, ax, y1, ay);
        U.push(ua * uScale, 0, ub * uScale, 0, ub * uScale, 1, ua * uScale, 1);
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      rg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      rg.setIndex(I);
      rg.computeVertexNormals();
      return rg;
    };
    if (!th.luxury) {
      const link = DECALS.get('mesh').clone();
      link.wrapS = link.wrapT = THREE.RepeatWrapping;
      link.repeat.set(1, 2);
      link.needsUpdate = true;
      const fm = new THREE.MeshLambertMaterial({ color: '#9a968c', map: link, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
      scene.add(new THREE.Mesh(ribbon(WALL_H, WALL_H + 18, 22), fm));
      scene.add(new THREE.Mesh(ribbon(WALL_H + 18, WALL_H + 19.5, 1), new THREE.MeshLambertMaterial({ color: '#2a2826', side: THREE.DoubleSide }))); // top rail / wire
      const posts = fence.filter((f) => f[6] % 6 === 0).map((f) => ({ x: f[0], z: f[1], ry: 0, s: 1 }));
      const post = new THREE.Group();
      post.add(LP.box(1.4, 21, 1.4, LP.mat('#3a3834', { metalness: 0.4 }), 0, WALL_H + 10, 0));
      post.add(LP.box(1, 1, 8, LP.mat('#3a3834'), 0, WALL_H + 21, 0).rotateX(0.5)); // barbed-wire arm
      for (const m of instanceTemplate(post, posts)) scene.add(m);
    } else {
      scene.add(new THREE.Mesh(ribbon(WALL_H, WALL_H + 10, 1), new THREE.MeshLambertMaterial({ color: '#cfe8f8', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })));
      scene.add(new THREE.Mesh(ribbon(WALL_H + 10, WALL_H + 11.2, 1), new THREE.MeshLambertMaterial({ color: '#d9b24a', emissive: '#4a3a10', side: THREE.DoubleSide })));
    }
  },

  // Light masts all round the lap, and set pieces near the start: guard towers or grandstands.
  trackside(scene, tr, th, env) {
    const N = tr.N, inner = tr.hw + tr.runoff + WALL_T;
    const clear = (x, y, r) => {
      for (let i = 0; i < N; i += 2) if ((tr.pts[i].x - x) ** 2 + (tr.pts[i].y - y) ** 2 < (inner + r) ** 2) return false;
      return true;
    };
    const masts = [[], []];
    for (let i = 0; i < N; i += 28) {
      const s = (i / 28) % 2 ? 1 : -1, off = inner + 10;
      const x = tr.pts[i].x + tr.nx[i] * off * s, y = tr.pts[i].y + tr.ny[i] * off * s;
      if (!clear(x, y, 6)) continue;
      masts[!th.luxury && (i * 7) % 5 === 0 ? 1 : 0].push({ x, z: y, ry: Math.atan2(tr.nx[i] * s, tr.ny[i] * s) + Math.PI / 2, s: 1 });
    }
    for (const [k, list] of masts.entries()) if (list.length) for (const m of instanceTemplate(Env.models.mast(th, k === 1), list)) scene.add(m);

    // Set pieces facing the start straight.
    for (const [di, s] of [[-26, 1], [-8, -1], [12, 1], [30, -1], [-44, -1], [48, 1]]) {
      const i = (di + N) % N, off = inner + (th.luxury ? 50 : 30);
      const x = tr.pts[i].x + tr.nx[i] * off * s, y = tr.pts[i].y + tr.ny[i] * off * s;
      if (!clear(x, y, th.luxury ? 46 : 20)) continue;
      const ry = Math.atan2(-tr.nx[i] * s, -tr.ny[i] * s);
      if (th.luxury) {
        const gs = Env.models.grandstand(th);
        gs.position.set(x, 0, y);
        gs.rotation.y = ry;
        scene.add(gs);
      } else {
        const t = Env.guardTower();
        t.position.set(x, 0, y);
        t.rotation.y = ry - Math.PI / 2;
        t.userData.phase = di * 0.37;
        scene.add(t);
        env.towers.push(t);
      }
    }
  },

  scenery(scene, tr, th, key) {
    const decos = tr.decos;
    if (!decos.length) return;
    const add = (tpl, list) => { if (list.length) for (const m of instanceTemplate(tpl, list)) scene.add(m); };
    const T = (d) => ({ x: d.x, z: d.y, ry: d.r * 37, s: 0.8 + (d.s - 0.7) * 0.5 });
    const band = (lo, hi) => decos.filter((d) => d.r >= lo && d.r < hi).map(T);
    const M = Env.models;
    if (key === 'undercity') {
      add(M.shacks(3), band(0, 0.18)); add(M.shacks(9), band(0.18, 0.34));
      add(M.fireBarrel(), band(0.34, 0.46));
      add(M.wreck(4), band(0.46, 0.56)); add(M.wreck(8), band(0.56, 0.64));
      add(M.junk(5), band(0.64, 0.82));
      add(M.tenement(11), band(0.82, 0.93));
      add(M.pillar(), band(0.93, 1).map((t) => Object.assign(t, { s: 1 })));
    } else if (key === 'stacks') {
      add(M.shacks(21), band(0, 0.16));
      add(M.tank(), band(0.16, 0.3));
      add(M.smokestack(), band(0.3, 0.4).map((t) => Object.assign(t, { s: 1 })));
      add(M.coolingTower(), band(0.4, 0.48).map((t) => Object.assign(t, { s: 1 })));
      add(M.pipes(), band(0.48, 0.62));
      add(M.tenement(17), band(0.62, 0.8)); add(M.tenement(29), band(0.8, 0.9));
      add(M.fireBarrel(), band(0.9, 1));
    } else if (key === 'terraces') {
      add(M.palm(3), band(0, 0.22)); add(M.palm(8), band(0.22, 0.4));
      add(M.topiary(1), band(0.4, 0.58)); add(M.topiary(2), band(0.58, 0.68));
      add(M.villa(4), band(0.68, 0.84));
      add(M.fountain(), band(0.84, 0.93));
      add(M.statue(), band(0.93, 1));
    } else {
      add(M.palm(5), band(0, 0.2)); add(M.palm(13), band(0.2, 0.32));
      add(M.colonnade(), band(0.32, 0.5));
      add(M.statue(), band(0.5, 0.62));
      add(M.villa(9), band(0.62, 0.76));
      add(M.flags(1), band(0.76, 0.88)); add(M.flags(2), band(0.88, 0.94));
      add(M.fountain(), band(0.94, 1));
    }
  },

  // Per-frame: keep the horizon centred on the player, sweep searchlights, launch fireworks.
  update(env, dt, t, x, z, scene) {
    env.follow.position.set(x, 0, z);
    for (const tw of env.towers) tw.userData.head.rotation.y = Math.sin(t * 0.5 + tw.userData.phase) * 1.0;
    if (!env.th.fireworks) return;
    env.fwT -= dt;
    if (env.fwT <= 0) {
      env.fwT = 0.8 + Math.random() * 1.6;
      const n = 48, pos = new Float32Array(n * 3), vel = [];
      const a = Math.random() * TAU, R = 500 + Math.random() * 700;
      const cx = x + Math.cos(a) * R, cy = 260 + Math.random() * 220, cz = z + Math.sin(a) * R;
      for (let k = 0; k < n; k++) {
        pos.set([cx, cy, cz], k * 3);
        const u = Math.random() * 2 - 1, ph = Math.random() * TAU, r = Math.sqrt(1 - u * u);
        vel.push([r * Math.cos(ph), u, r * Math.sin(ph)]);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const color = ['#ffd86a', '#ff6a4a', '#ffffff', '#6ad8ff', '#ff8ad8'][Math.floor(Math.random() * 5)];
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      pts.userData = { t: 0, vel, c: [cx, cy, cz] };
      scene.add(pts);
      env.fireworks.push(pts);
    }
    for (const fw of env.fireworks) {
      const u = fw.userData;
      u.t += dt;
      const r = 140 * (1 - Math.exp(-u.t * 2.2)), drop = u.t * u.t * 18;
      const p = fw.geometry.attributes.position;
      u.vel.forEach((v, k) => p.setXYZ(k, u.c[0] + v[0] * r, u.c[1] + v[1] * r - drop, u.c[2] + v[2] * r));
      p.needsUpdate = true;
      fw.material.opacity = Math.max(0, 1 - u.t / 2.2);
    }
    env.fireworks = env.fireworks.filter((fw) => {
      if (fw.userData.t < 2.2) return true;
      scene.remove(fw);
      fw.geometry.dispose();
      fw.material.dispose();
      return false;
    });
  },
};
