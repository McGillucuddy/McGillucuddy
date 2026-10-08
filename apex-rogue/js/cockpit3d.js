'use strict';
// First-person cockpit view (Three.js) of the same 2D race simulation.
// Sim (x, y) maps to three (x, height, y). Car-local axes: +X forward, +Y up, +Z right.

const EYE = { x: -2.6, y: 9.8, z: 4.2 }; // passenger seat; the driver's seat is empty
const WALL_H = 14;

function m3(color, opts) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.05 }, opts));
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x || 0, y || 0, z || 0);
  return m;
}

// A box stretched between two points (pillars, struts).
function beam(a, b, thick, mat) {
  const va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
  const len = va.distanceTo(vb);
  const m = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, len), mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.lookAt(vb);
  return m;
}

function canvasTex(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { c, ctx: c.getContext('2d'), tex };
}

class CockpitView {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.look = { yaw: 0, pitch: -0.05 };
    this.mirrorRT = new THREE.WebGLRenderTarget(512, 156);
    this.frameNo = 0;
  }

  resize(W, H) {
    this.renderer.setSize(W, H, false);
    if (this.camera) {
      this.camera.aspect = W / H;
      this.camera.updateProjectionMatrix();
    }
  }

  dispose() {
    if (!this.scene) return;
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (m.map && m.map !== this.mirrorRT.texture) m.map.dispose();
        m.dispose();
      }
    });
  }

  load(race, combat) {
    this.dispose();
    this.race = race;
    this.combat = combat;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.3, 6000);
    this.rearCam = new THREE.PerspectiveCamera(50, 512 / 156, 1, 3000);
    this.scene.add(this.camera);
    this.look.yaw = 0;
    this.look.pitch = -0.05;
    this.shake = 0;
    this.recoil = 0;
    this.flash = 0;
    this.prevVel = null;
    this.acc = { fwd: 0, lat: 0 };
    this.dice = { a: 0, v: 0, b: 0, vb: 0 };
    this.bob = { a: 0, v: 0, b: 0, vb: 0 };
    this.buildWorld();
    this.buildCars();
    this.buildInterior();
    this.buildViewmodels();
    this.buildFx();
    this.resize(this.canvas.clientWidth || window.innerWidth, this.canvas.clientHeight || window.innerHeight);
  }

  // ---------- World ----------

  buildWorld() {
    const tr = this.race.track, bio = tr.biome, b = tr.bounds, scene = this.scene;
    const sky = bio.night ? '#07060f' : bio === BIOMES.tundra ? '#cfdbe6' : bio === BIOMES.desert ? '#f2d9a8' : '#a9d3f0';
    scene.background = new THREE.Color(sky);
    scene.fog = new THREE.Fog(sky, bio.night ? 250 : 500, bio.night ? 1600 : 2800);
    scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(bio.bg), bio.night ? 0.5 : 1.1));
    const sun = new THREE.DirectionalLight(bio.night ? 0x8a7cff : 0xfff2dd, bio.night ? 0.35 : 1.2);
    sun.position.set(400, 900, 250);
    scene.add(sun);

    // Ground: reuse the pre-rendered 2D track canvas as one big texture.
    const W = b.maxX - b.minX, H = b.maxY - b.minY;
    const tex = new THREE.CanvasTexture(tr.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
    ground.position.set(b.minX + W / 2, 0, b.minY + H / 2);
    scene.add(ground);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: bio.bg }));
    far.position.y = -0.5;
    scene.add(far);

    this.buildWalls();
    this.buildDecos();
    this.buildHazards();

    // Start/finish gantry.
    const i0 = 0, p0 = tr.pts[i0], n0x = tr.nx[i0], n0y = tr.ny[i0];
    const span = tr.hw + tr.runoff;
    const gm = m3(bio.night ? '#2ff3ff' : '#333', bio.night ? { emissive: '#2ff3ff', emissiveIntensity: 0.6 } : {});
    for (const s of [-1, 1]) {
      const post = box(3, 40, 3, gm, p0.x + n0x * span * s, 20, p0.y + n0y * span * s);
      scene.add(post);
    }
    const bannerTex = canvasTex(512, 64);
    const bc = bannerTex.ctx;
    bc.fillStyle = '#111'; bc.fillRect(0, 0, 512, 64);
    for (let k = 0; k < 32; k++) { bc.fillStyle = k % 2 ? '#fff' : '#111'; bc.fillRect(k * 16, 0, 16, 8); bc.fillRect(k * 16 + (k % 2 ? -16 : 16), 56, 16, 8); }
    bc.fillStyle = '#ffd23f'; bc.font = 'bold 36px system-ui'; bc.textAlign = 'center'; bc.fillText('APEX ROGUE', 256, 46);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(span * 2, 9, 1.5), new THREE.MeshBasicMaterial({ map: bannerTex.tex }));
    banner.position.set(p0.x, 38, p0.y);
    banner.rotation.y = -tr.ang[i0] + Math.PI / 2;
    scene.add(banner);
  }

  buildWalls() {
    const tr = this.race.track, bio = tr.biome, N = tr.N;
    const inner = tr.hw + tr.runoff;
    const pos = [], col = [], idx = [];
    const cA = new THREE.Color(bio.wall), cB = new THREE.Color(bio.wallStripe);
    for (const s of [-1, 1]) {
      // Wall vertices; drop the ones the offset curve pushes back onto the road (tight hairpins).
      const verts = [];
      for (let i = 0; i <= N; i++) {
        const k = i % N;
        const x = tr.pts[k].x + tr.nx[k] * inner * s, y = tr.pts[k].y + tr.ny[k] * inner * s;
        const x2 = tr.pts[k].x + tr.nx[k] * (inner + WALL_T) * s, y2 = tr.pts[k].y + tr.ny[k] * (inner + WALL_T) * s;
        const q = trackQuery(tr, x, y, k, 45);
        verts.push({ x, y, x2, y2, ok: q.dist >= inner - 3, c: Math.floor(i / 4) % 2 ? cB : cA });
      }
      for (let i = 0; i < N; i++) {
        const a = verts[i], b2 = verts[i + 1];
        if (!a.ok || !b2.ok) continue;
        const base = pos.length / 3;
        // inner face (4 verts) + top (4 verts)
        pos.push(a.x, 0, a.y, b2.x, 0, b2.y, b2.x, WALL_H, b2.y, a.x, WALL_H, a.y);
        pos.push(a.x, WALL_H, a.y, b2.x, WALL_H, b2.y, b2.x2, WALL_H, b2.y2, a.x2, WALL_H, a.y2);
        for (let v = 0; v < 8; v++) { const c = v < 4 ? a.c : cA; col.push(c.r, c.g, c.b); }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        idx.push(base + 4, base + 5, base + 6, base + 4, base + 6, base + 7);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    if (bio.night) { mat.emissive = new THREE.Color(bio.wall); mat.emissiveIntensity = 0.35; }
    this.scene.add(new THREE.Mesh(g, mat));
  }

  buildDecos() {
    const tr = this.race.track, kind = tr.biome.deco, decos = tr.decos;
    if (!decos.length) return;
    const dummy = new THREE.Object3D();
    const parts = [];
    if (kind === 'tree') {
      parts.push({ geo: new THREE.CylinderGeometry(2.5, 3.5, 18, 6), mat: m3('#5a3d22'), y: 9, s: [1, 1, 1] });
      parts.push({ geo: new THREE.IcosahedronGeometry(20, 0), mat: m3('#2f6b2a', { flatShading: true }), y: 32, s: [1, 1, 1] });
    } else if (kind === 'pine') {
      parts.push({ geo: new THREE.CylinderGeometry(2, 3, 12, 6), mat: m3('#4a3320'), y: 6, s: [1, 1, 1] });
      parts.push({ geo: new THREE.ConeGeometry(16, 46, 7), mat: m3('#2d5a45', { flatShading: true }), y: 34, s: [1, 1, 1] });
    } else if (kind === 'cactus') {
      parts.push({ geo: new THREE.CylinderGeometry(4, 4.5, 34, 7), mat: m3('#4f8a3c', { flatShading: true }), y: 17, s: [1, 1, 1] });
      parts.push({ geo: new THREE.DodecahedronGeometry(12, 0), mat: m3('#a07a4d', { flatShading: true }), y: 4, s: [1, 0.6, 1], alt: true });
    } else {
      parts.push({ geo: new THREE.BoxGeometry(50, 1, 50), mat: m3('#0b0a14', { emissive: '#ff2fd0', emissiveIntensity: 0.25 }), y: 0, s: [1, 1, 1], building: true });
    }
    for (const part of parts) {
      const inst = new THREE.InstancedMesh(part.geo, part.mat, decos.length);
      decos.forEach((d, i) => {
        let sc = d.s;
        let sy = part.s[1];
        if (part.building) sy = 60 + d.r * 140;
        if (kind === 'cactus') {
          // Half are cacti, half are rocks: hide the other part by scaling to zero.
          const isRock = d.r >= 0.55;
          if (!!part.alt !== isRock) sc = 0.0001;
        }
        dummy.position.set(d.x, part.building ? sy / 2 : part.y * sc, d.y);
        dummy.rotation.set(0, d.r * 6, 0);
        dummy.scale.set(sc * part.s[0], part.building ? sy : sc * sy, sc * part.s[2]);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      this.scene.add(inst);
    }
  }

  buildHazards() {
    const tr = this.race.track;
    const chev = canvasTex(128, 128);
    const c = chev.ctx;
    c.fillStyle = '#10202a'; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#5ad8ff'; c.lineWidth = 14; c.lineCap = 'round';
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(20 + k * 34, 22); c.lineTo(50 + k * 34, 64); c.lineTo(20 + k * 34, 106); c.stroke(); }
    const padMat = new THREE.MeshBasicMaterial({ map: chev.tex });
    const oilMat = new THREE.MeshBasicMaterial({ color: '#0a0a10', transparent: true, opacity: 0.85 });
    for (const h of tr.hazards) {
      const geo = h.type === 'boost' ? new THREE.PlaneGeometry(h.r * 2, h.r * 1.6) : new THREE.CircleGeometry(h.r, 20);
      const m = new THREE.Mesh(geo, h.type === 'boost' ? padMat : oilMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -h.ang;
      m.position.set(h.x, 0.4, h.y);
      if (h.type === 'oil') m.scale.set(1, 0.7, 1);
      this.scene.add(m);
    }
  }

  // ---------- Cars ----------

  buildCars() {
    this.carMeshes = new Map();
    for (const car of this.race.cars) {
      const g = new THREE.Group();
      if (car === this.race.player) {
        this.playerGroup = g;
        // Your own hood, seen through the windshield.
        g.add(box(10, 1.6, 17, m3(car.color, { metalness: 0.3, roughness: 0.4 }), 13.5, 6.2, 0));
        this.scene.add(g);
        continue;
      }
      const bodyMat = m3(car.color, { metalness: 0.3, roughness: 0.45 });
      g.add(box(36, 7, 18, bodyMat, 0, 6, 0));
      g.add(box(16, 6, 15, m3('#1c2633', { metalness: 0.5, roughness: 0.2 }), -3, 12, 0));
      g.add(box(3, 1.2, 18, m3(car.accent), -17, 10.5, 0));
      const wm = m3('#111');
      for (const [x, z] of [[11, 9], [11, -9], [-11, 9], [-11, -9]]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 3, 12), wm);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 4, z);
        g.add(w);
      }
      if (car.weapon === 'rocket') {
        g.add(box(10, 3, 6, m3('#222'), -3, 16.5, 0));
        g.add(box(12, 2.6, 2.6, m3('#ff5a3c'), 0, 18.5, 0));
      } else if (car.weapon === 'mine') {
        g.add(box(6, 4, 12, m3('#ffd23f'), -16, 9, 0));
      }
      const tag = canvasTex(256, 64);
      // Constant on-screen size so tags stay readable without filling the view up close.
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tag.tex, depthTest: false, transparent: true, sizeAttenuation: false }));
      sprite.scale.set(0.15, 0.0375, 1);
      sprite.position.set(0, 30, 0);
      g.add(sprite);
      this.scene.add(g);
      this.carMeshes.set(car, { g, bodyMat, tag, lastTag: '' });
    }
  }

  // ---------- Interior ----------

  buildInterior() {
    const I = new THREE.Group();
    const p = this.race.player;
    const dark = m3('#1b1d22'), trim = m3('#2a2d33'), seat = m3('#3b2a24'), body = m3(p.color, { metalness: 0.3, roughness: 0.5 });
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
    I.add(box(14.6, 0.8, 17.4, body, -4.75, 12.95, 0)); // roof
    I.add(box(14.6, 0.3, 16, m3('#4a4740'), -4.75, 12.5, 0)); // headliner
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
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.32, 8, 24), m3('#111')));
    wheel.add(box(5, 0.5, 0.4, m3('#222')));
    wheel.add(box(0.5, 2.6, 0.4, m3('#222'), 0, -1.3, 0));
    wheelFace.add(wheel);
    wheelTilt.add(wheelFace);
    I.add(wheelTilt);
    this.wheel = wheel;

    // Rear-view mirror with a live feed.
    const mirTex = this.mirrorRT.texture;
    mirTex.wrapS = THREE.RepeatWrapping;
    mirTex.repeat.x = -1;
    mirTex.offset.x = 1;
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.35), new THREE.MeshBasicMaterial({ map: mirTex }));
    mirror.position.set(3.1, 11.6, 0);
    mirror.lookAt(EYE.x, EYE.y + 0.6, EYE.z);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.7), new THREE.MeshBasicMaterial({ color: '#111' }));
    frame.position.copy(mirror.position);
    frame.quaternion.copy(mirror.quaternion);
    frame.translateZ(-0.08);
    I.add(frame, mirror);
    I.add(beam([3.4, 12.5, 0], [3.4, 11.6, 0], 0.4, m3('#111')));

    // Fuzzy dice hanging from the mirror (a trinket).
    const dicePivot = new THREE.Group();
    dicePivot.position.set(3.2, 10.8, 0.9);
    const string = beam([0, 0, 0], [0, -2.3, 0], 0.06, m3('#eee'));
    dicePivot.add(string);
    const dm = m3('#f2f2f2', { roughness: 1 });
    const d1 = box(0.7, 0.7, 0.7, dm, 0, -2.6, -0.35), d2 = box(0.7, 0.7, 0.7, m3('#ff3b6b', { roughness: 1 }), 0.1, -2.8, 0.4);
    d1.rotation.set(0.4, 0.3, 0.2); d2.rotation.set(-0.3, 0.6, 0.1);
    dicePivot.add(d1, d2);
    I.add(dicePivot);
    this.dicePivot = dicePivot;

    // Bobblehead on the dash (a trinket).
    const bob = new THREE.Group();
    bob.position.set(6.2, 6.8, 7.2);
    bob.scale.setScalar(0.6);
    bob.add(box(0.9, 1.2, 0.9, m3('#2a62c9'), 0, 0.6, 0));
    const neck = new THREE.Group();
    neck.position.y = 1.3;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), m3('#f1c27d'));
    head.position.y = 0.7;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.88, 12, 6, 0, TAU, 0, Math.PI / 2), m3('#e8423f'));
    cap.position.y = 0.8;
    neck.add(head, cap);
    bob.add(neck);
    I.add(bob);
    this.bobNeck = neck;

    // Dashboard screens: radar + status.
    this.radar = canvasTex(256, 256);
    const radar = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: this.radar.tex }));
    radar.geometry.dispose();
    radar.geometry = new THREE.PlaneGeometry(2.6, 2.6);
    radar.position.set(5.6, 7.75, 0.4);
    radar.lookAt(EYE.x, EYE.y, EYE.z);
    I.add(radar);
    const bezel = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), new THREE.MeshBasicMaterial({ color: '#0a0a0a' }));
    bezel.position.copy(radar.position);
    bezel.quaternion.copy(radar.quaternion);
    bezel.translateZ(-0.05);
    I.add(bezel);
    this.status = canvasTex(256, 128);
    const status = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.4), new THREE.MeshBasicMaterial({ map: this.status.tex }));
    status.position.set(5.6, 7.35, -2.6);
    status.lookAt(EYE.x, EYE.y, EYE.z);
    I.add(status);

    // Grenade crate on the console: ammo you can count.
    I.add(box(4.2, 1.4, 3.6, m3('#4a5a2a'), -1.4, 6.2, 0));
    this.nadeMeshes = [];
    for (let k = 0; k < 3; k++) {
      const n = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), m3('#3d5a22', { roughness: 0.6 }));
      n.position.set(-2.5 + k * 1.1, 7.2, 0);
      I.add(n);
      this.nadeMeshes.push(n);
    }

    // Gun rack on the empty driver's door: the weapon in your hands is missing from it.
    const steel = m3('#777', { metalness: 0.8, roughness: 0.3 });
    for (const x of [-2.5, 3]) {
      I.add(box(0.5, 0.5, 1.6, steel, x, 6.2, -7.9));
      I.add(box(0.5, 0.5, 1.6, steel, x, 4.6, -7.9));
    }
    this.rackGuns = {
      smg: this.makeSmg(),
      rocket: this.makeLauncher(),
    };
    this.rackGuns.smg.position.set(0.3, 6.9, -7.6);
    this.rackGuns.smg.rotation.y = -Math.PI / 2;
    this.rackGuns.rocket.scale.setScalar(0.8);
    this.rackGuns.rocket.position.set(0.2, 5.0, -7.6);
    this.rackGuns.rocket.rotation.y = -Math.PI / 2;
    I.add(this.rackGuns.smg, this.rackGuns.rocket);

    // Windshield crack layer.
    this.cracks = canvasTex(512, 256);
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(17, 8.4), new THREE.MeshBasicMaterial({ map: this.cracks.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const u = new THREE.Vector3(0, 0, 1), v = new THREE.Vector3(-5.9, 6, 0).normalize(), n = new THREE.Vector3().crossVectors(u, v);
    ws.matrixAutoUpdate = false;
    ws.matrix.makeBasis(u, v, n).setPosition(5.45, 9.6, 0);
    I.add(ws);

    const cabinLight = new THREE.PointLight(0xffe2c0, 0.6, 40, 1.5);
    cabinLight.position.set(-2, 11.5, 0);
    I.add(cabinLight);

    this.interior = I;
    this.playerGroup.add(I);
  }

  makeSmg() {
    const g = new THREE.Group();
    const gun = m3('#2b2b2b', { metalness: 0.6, roughness: 0.4 });
    g.add(box(1.1, 1.5, 5.5, gun, 0, 0, 0));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3, 8), gun);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.3, -4.2);
    g.add(barrel);
    g.add(box(0.8, 2.6, 1, m3('#1a1a1a'), 0, -1.6, -0.8));
    g.add(box(0.9, 1.6, 1.6, m3('#3a2a1e'), 0, -1.1, 2));
    return g;
  }

  makeLauncher() {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 10, 12, 1, true), m3('#4b5a2e', { side: THREE.DoubleSide }));
    tube.rotation.x = Math.PI / 2;
    g.add(tube);
    g.add(box(0.8, 2.2, 1, m3('#222'), 0, -1.6, 0.5));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 10), m3('#ff5a3c'));
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -5.6;
    g.add(tip);
    g.userData.tip = tip;
    return g;
  }

  buildViewmodels() {
    const vm = new THREE.Group();
    this.camera.add(vm);
    const smg = this.makeSmg();
    smg.position.set(2.1, -2.2, -6);
    const launcher = this.makeLauncher();
    launcher.scale.setScalar(0.75);
    launcher.position.set(3.0, -2.3, -5.5);
    const glove = box(1.6, 1.4, 2.4, m3('#2e231b'), 2.1, -3.6, -5.2);
    vm.add(smg, launcher, glove);
    vm.traverse((o) => {
      if (o.material) { o.material = o.material.clone(); o.material.depthTest = false; o.material.fog = false; }
      o.renderOrder = 10;
    });
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
    flash.renderOrder = 11;
    this.camera.add(flash);
    this.vm = { root: vm, smg, launcher, glove, flash };
  }

  // ---------- Effects pools ----------

  buildFx() {
    const scene = this.scene;
    const pool = (n, make) => {
      const arr = [];
      for (let i = 0; i < n; i++) { const o = make(); o.visible = false; scene.add(o); arr.push(o); }
      return arr;
    };
    this.pools = {
      bullet: pool(80, () => new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: '#ffe680' }))),
      rocket: pool(24, () => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 9, 8), m3('#ddd'));
        body.rotation.z = Math.PI / 2;
        const glow = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb13b' }));
        glow.position.x = -5.5;
        g.add(body, glow);
        g.userData.body = body;
        return g;
      }),
      mine: pool(40, () => {
        const g = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 2.5, 14), m3('#2a2a2a', { metalness: 0.6 }));
        disc.position.y = 1.3;
        const led = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2a2a' }));
        led.position.y = 3;
        g.add(disc, led);
        g.userData.led = led;
        return g;
      }),
      nade: pool(10, () => new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), m3('#3d5a22'))),
      boom: pool(24, () => new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffb13b', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))),
      puff: pool(160, () => new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), new THREE.MeshBasicMaterial({ color: '#cccccc', transparent: true, opacity: 0.5, depthWrite: false }))),
    };
    this.puffs = [];
    this.lockLines = new Map();
    for (const car of this.race.cars) {
      if (car.weapon !== 'rocket') continue;
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ff2020', transparent: true }));
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      this.lockLines.set(car, line);
    }
    this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(24, 24, 16), new THREE.MeshBasicMaterial({ color: '#5ad8ff', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    this.shieldMesh.visible = false;
    scene.add(this.shieldMesh);
  }

  // ---------- Per-frame ----------

  onEvent(ev) {
    if (ev.type === 'shoot') { this.recoil = Math.min(1, this.recoil + 0.35); this.flash = 0.05; }
    else if (ev.type === 'rocket') { this.recoil = 1.4; this.flash = 0.08; this.shake = Math.max(this.shake, 0.4); }
    else if (ev.type === 'hurt') {
      this.shake = Math.max(this.shake, Math.min(1.5, ev.dmg / 12));
      const p = this.race.player;
      const rel = wrapAngle(ev.ang - p.heading);
      if (Math.abs(rel) < 1.1) this.crack(rel);
    } else if (ev.type === 'explode') {
      const p = this.race.player;
      const d = Math.hypot(ev.x - p.x, ev.y - p.y);
      if (d < 250) this.shake = Math.max(this.shake, (1 - d / 250) * 0.8);
    }
  }

  crack(rel) {
    const c = this.cracks.ctx;
    const cx = 256 + (rel / 1.1) * 220 + (Math.random() - 0.5) * 60, cy = 80 + Math.random() * 120;
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 1.5;
    for (let k = 0; k < 9; k++) {
      let x = cx, y = cy, a = Math.random() * TAU;
      c.beginPath();
      c.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        a += (Math.random() - 0.5) * 0.8;
        x += Math.cos(a) * (8 + Math.random() * 18);
        y += Math.sin(a) * (8 + Math.random() * 18);
        c.lineTo(x, y);
      }
      c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath(); c.arc(cx, cy, 6, 0, TAU); c.fill();
    this.cracks.tex.needsUpdate = true;
  }

  aimAngle() { return this.race.player.heading + this.look.yaw; }

  update(dt, t) {
    const race = this.race, p = race.player, combat = this.combat;
    this.frameNo++;

    // Car-local acceleration drives the dice, bobblehead and camera roll.
    if (this.prevVel && dt > 0) {
      const ax = (p.vx - this.prevVel.x) / dt, ay = (p.vy - this.prevVel.y) / dt;
      const c = Math.cos(p.heading), s = Math.sin(p.heading);
      this.acc.fwd = lerp(this.acc.fwd, ax * c + ay * s, Math.min(1, dt * 8));
      this.acc.lat = lerp(this.acc.lat, -ax * s + ay * c, Math.min(1, dt * 8));
    }
    this.prevVel = { x: p.vx, y: p.vy };
    const spring = (o, tgtA, tgtB, k, d) => {
      o.v += ((tgtA - o.a) * k - o.v * d) * dt; o.a += o.v * dt;
      o.vb += ((tgtB - o.b) * k - o.vb * d) * dt; o.b += o.vb * dt;
    };
    spring(this.dice, -this.acc.lat * 0.0012, this.acc.fwd * 0.0012, 30, 2.5);
    spring(this.bob, -this.acc.lat * 0.0016, this.acc.fwd * 0.0016, 90, 3);
    this.dicePivot.rotation.set(clamp(this.dice.a, -1, 1), 0, clamp(this.dice.b, -1, 1));
    this.bobNeck.rotation.set(clamp(this.bob.a, -0.8, 0.8), 0, clamp(this.bob.b, -0.8, 0.8));

    // Cars
    this.playerGroup.position.set(p.x, 0, p.y);
    this.playerGroup.rotation.y = -p.heading;
    this.playerGroup.updateMatrixWorld(true); // localToWorld below needs this frame's transform
    for (const [car, m] of this.carMeshes) {
      m.g.position.set(car.x, 0, car.y);
      m.g.rotation.y = -car.heading;
      const flash = car.hitFlash > 0;
      m.bodyMat.emissive.set(flash ? '#ffffff' : car.hp <= 0 ? '#331100' : '#000000');
      m.bodyMat.emissiveIntensity = flash ? 0.8 : 1;
      const label = `${car.place}. ${car.name.split(' ')[0]}${car.hp <= 0 ? ' ✖' : ''}`;
      if (label !== m.lastTag) {
        const c = m.tag.ctx;
        c.clearRect(0, 0, 256, 64);
        c.font = 'bold 34px system-ui';
        c.textAlign = 'center';
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(128 - c.measureText(label).width / 2 - 10, 8, c.measureText(label).width + 20, 46);
        c.fillStyle = car.weapon ? '#ff8a6a' : '#ffffff';
        c.fillText(label, 128, 43);
        m.tag.tex.needsUpdate = true;
        m.lastTag = label;
      }
    }

    this.wheel.rotation.z = -(p.input ? p.input.steer : 0) * 2.2;

    // Interior props reflect combat state.
    for (let k = 0; k < 3; k++) this.nadeMeshes[k].visible = k < combat.nades.ammo;
    this.rackGuns.smg.visible = combat.weapon !== 'smg';
    this.rackGuns.rocket.visible = combat.weapon !== 'rocket';
    this.rackGuns.rocket.userData.tip.visible = combat.rockets.ammo > 0;

    // Viewmodel
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.flash -= dt;
    const vm = this.vm;
    vm.smg.visible = combat.weapon === 'smg';
    vm.launcher.visible = combat.weapon === 'rocket';
    vm.launcher.userData.tip.visible = combat.rockets.ammo > 0;
    const sway = Math.sin(t * 9) * Math.min(1, p.speed / 500) * 0.05;
    for (const g of [vm.smg, vm.launcher]) {
      g.rotation.x = this.recoil * 0.12;
      g.position.z = (g === vm.smg ? -6 : -5.5) + this.recoil * 0.8;
      g.position.y = (g === vm.smg ? -2.2 : -2.3) + sway;
    }
    if (combat.smg.overheated) vm.smg.children[1].material.emissive.set('#ff3300');
    else vm.smg.children[1].material.emissive.set(combat.smg.heat > 0.6 ? '#661100' : '#000000');
    vm.flash.visible = this.flash > 0;
    vm.flash.position.set(combat.weapon === 'smg' ? 2.4 : 3.0, combat.weapon === 'smg' ? -1.9 : -2.3, combat.weapon === 'smg' ? -12 : -10.5);
    vm.flash.rotation.z = Math.random() * TAU;

    this.updateFx(dt, t);
    this.drawRadar(t);
    this.drawStatus(t);

    // Camera: eye in the passenger seat, free look, roll + shake.
    this.shake = Math.max(0, this.shake - dt * 3);
    const eye = this.playerGroup.localToWorld(new THREE.Vector3(EYE.x, EYE.y, EYE.z));
    const sh = this.shake;
    eye.x += (Math.random() - 0.5) * sh * 1.2;
    eye.y += (Math.random() - 0.5) * sh * 1.2;
    eye.z += (Math.random() - 0.5) * sh * 1.2;
    const wy = this.aimAngle(), pt = this.look.pitch;
    const dir = new THREE.Vector3(Math.cos(wy) * Math.cos(pt), Math.sin(pt), Math.sin(wy) * Math.cos(pt));
    this.camera.position.copy(eye);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(eye.clone().add(dir));
    this.camera.rotateZ(clamp(this.acc.lat * 0.00012, -0.08, 0.08) * Math.cos(this.look.yaw));
  }

  updateFx(dt, t) {
    const c = this.combat, p = this.race.player;
    const show = (arr, list, fn) => {
      for (let i = 0; i < arr.length; i++) {
        const o = arr[i];
        if (i < list.length) { o.visible = true; fn(o, list[i]); } else o.visible = false;
      }
    };
    const bullets = c.projectiles.filter((q) => q.type === 'bullet');
    const rockets = c.projectiles.filter((q) => q.type === 'rocket');
    show(this.pools.bullet, bullets, (o, q) => {
      o.position.set(q.x, 7.5, q.y);
      o.rotation.set(0, -Math.atan2(q.vy, q.vx), 0);
    });
    show(this.pools.rocket, rockets, (o, q) => {
      o.position.set(q.x, 9, q.y);
      o.rotation.set(0, -Math.atan2(q.vy, q.vx), 0);
      o.userData.body.material.color.set(q.owner === p ? '#5ad8ff' : '#ff5a3c');
      if (this.puffs.length < this.pools.puff.length) this.puffs.push({ x: q.x, y: q.y, t: 0 });
    });
    show(this.pools.mine, c.mines, (o, m) => {
      o.position.set(m.x, 0, m.y);
      o.userData.led.visible = m.t < m.arm || Math.floor(t * 4) % 2 === 0;
    });
    show(this.pools.nade, c.grenades, (o, g) => o.position.set(g.x, Math.max(2, g.z), g.y));
    show(this.pools.boom, c.explosions, (o, e) => {
      const k = e.t / 0.5;
      o.position.set(e.x, 8, e.y);
      o.scale.setScalar(e.r * (0.4 + 0.7 * k));
      o.material.opacity = 0.85 * (1 - k);
      o.material.color.setHSL(0.08 - 0.06 * k, 1, 0.55);
    });
    for (const pf of this.puffs) pf.t += dt;
    this.puffs = this.puffs.filter((pf) => pf.t < 0.8);
    show(this.pools.puff, this.puffs, (o, pf) => {
      o.position.set(pf.x, 9 + pf.t * 6, pf.y);
      o.scale.setScalar(2 + pf.t * 7);
      o.material.opacity = 0.45 * (1 - pf.t / 0.8);
    });
    for (const [car, line] of this.lockLines) {
      const lock = car.wpn && car.wpn.lock > 0;
      line.visible = lock;
      if (!lock) continue;
      const k = car.wpn.lock / LOCK_TIME;
      const pos = line.geometry.attributes.position;
      pos.setXYZ(0, car.x, 18, car.y);
      pos.setXYZ(1, p.x, 8, p.y);
      pos.needsUpdate = true;
      line.material.opacity = Math.floor(t * (6 + k * 14)) % 2 ? 1 : 0.3;
    }
    const sh = c.shield;
    this.shieldMesh.visible = sh.t > 0;
    if (sh.t > 0) {
      this.shieldMesh.position.set(p.x, 8, p.y);
      this.shieldMesh.material.opacity = sh.age < PARRY_WINDOW ? 0.3 : 0.12;
    }
  }

  drawRadar(t) {
    const { ctx, tex } = this.radar;
    const race = this.race, p = race.player, c = this.combat, tr = race.track;
    const S = 256, cx = S / 2, cy = S / 2, R = 120, range = 900, k = R / range;
    const glitch = p.hp < p.stats.maxHp * 0.3 && Math.random() < 0.08;
    ctx.fillStyle = '#031208';
    ctx.fillRect(0, 0, S, S);
    if (glitch) { tex.needsUpdate = true; return; }
    const hc = Math.cos(p.heading), hs = Math.sin(p.heading);
    const toR = (x, y) => {
      const dx = x - p.x, dy = y - p.y;
      return [cx + (-dx * hs + dy * hc) * k, cy - (dx * hc + dy * hs) * k];
    };
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(60,255,120,0.25)';
    ctx.lineWidth = 1;
    for (const r of [R / 3, (2 * R) / 3, R]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(60,255,120,0.35)';
    ctx.lineWidth = tr.hw * 2 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < tr.N; i += 3) {
      const q = tr.pts[i];
      if (Math.abs(q.x - p.x) > range * 1.2 || Math.abs(q.y - p.y) > range * 1.2) { started = false; continue; }
      const [x, y] = toR(q.x, q.y);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const sweep = (t * 2.5) % TAU;
    ctx.fillStyle = 'rgba(60,255,120,0.12)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, sweep - 0.5, sweep); ctx.fill();
    for (const m of c.mines) {
      const [x, y] = toR(m.x, m.y);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
    for (const car of race.cars) {
      if (car === p) continue;
      const [x, y] = toR(car.x, car.y);
      const locking = car.wpn && car.wpn.lock > 0;
      ctx.fillStyle = locking ? (Math.floor(t * 10) % 2 ? '#ff2020' : '#ffffff') : car.weapon ? '#ff9f1c' : '#3cff78';
      ctx.beginPath(); ctx.arc(x, y, car.weapon ? 6 : 5, 0, TAU); ctx.fill();
    }
    for (const q of c.projectiles) {
      if (q.type !== 'rocket') continue;
      const [x, y] = toR(q.x, q.y);
      ctx.fillStyle = q.owner === p ? '#5ad8ff' : '#ff3030';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx - 5, cy + 6); ctx.lineTo(cx + 5, cy + 6); ctx.fill();
    ctx.strokeStyle = '#1d5a2e';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, TAU); ctx.stroke();
    tex.needsUpdate = true;
  }

  drawStatus(t) {
    const { ctx, tex } = this.status;
    const race = this.race, p = race.player, c = this.combat;
    ctx.fillStyle = '#120a02';
    ctx.fillRect(0, 0, 256, 128);
    if (p.hp < p.stats.maxHp * 0.3 && Math.random() < 0.1) { tex.needsUpdate = true; return; }
    ctx.fillStyle = '#ffb000';
    ctx.font = 'bold 26px monospace';
    const lap = clamp(Math.floor(p.progress / race.track.N) + 1, 1, race.laps);
    ctx.fillText(`P${p.place}/${race.cars.length}  L${p.finished ? race.laps : lap}/${race.laps}`, 12, 34);
    ctx.font = '18px monospace';
    const hpf = p.hp / p.stats.maxHp;
    ctx.fillText('HULL', 12, 66);
    ctx.fillStyle = 'rgba(255,176,0,0.2)';
    ctx.fillRect(70, 52, 170, 16);
    ctx.fillStyle = hpf < 0.3 ? '#ff3b1f' : '#ffb000';
    ctx.fillRect(70, 52, 170 * clamp(hpf, 0, 1), 16);
    ctx.fillStyle = '#ffb000';
    const sh = c.shield;
    ctx.fillText(sh.t > 0 ? 'SHIELD  ACTIVE' : sh.cd > 0 ? `SHIELD  ${sh.cd.toFixed(1)}s` : 'SHIELD  READY', 12, 94);
    ctx.fillText(c.swerveCd > 0 ? `SWERVE  ${c.swerveCd.toFixed(1)}s` : 'SWERVE  READY', 12, 118);
    tex.needsUpdate = true;
  }

  render(dt, t) {
    this.update(dt, t);
    const r = this.renderer;
    // Mirror: rear-facing camera, interior hidden, rendered every other frame.
    if (this.frameNo % 2 === 0) {
      const g = this.playerGroup;
      this.rearCam.position.copy(g.localToWorld(new THREE.Vector3(-19, 10.5, 0)));
      this.rearCam.lookAt(g.localToWorld(new THREE.Vector3(-80, 8, 0)));
      this.interior.visible = false;
      this.vm.root.visible = false;
      const flashVis = this.vm.flash.visible;
      this.vm.flash.visible = false;
      r.setRenderTarget(this.mirrorRT);
      r.render(this.scene, this.rearCam);
      r.setRenderTarget(null);
      this.interior.visible = true;
      this.vm.root.visible = true;
      this.vm.flash.visible = flashVis;
    }
    r.render(this.scene, this.camera);
  }
}
