'use strict';
// First-person cockpit view (Three.js) of the same 2D race simulation.
// Sim (x, y) maps to three (x, height, y). Car-local axes: +X forward, +Y up, +Z right.

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
    this.post = new PSXPost(this.renderer);
    this.frameNo = 0;
  }

  // Retro (PS1-style) look: low-res dithered render, vertex wobble, grimy textures, thick fog.
  setRetro(on) {
    PSX.enabled = on;
    PSX.snapOn.value = on ? 1 : 0;
    const filt = on ? THREE.NearestFilter : THREE.LinearFilter;
    this.mirrorRT.setSize(on ? 128 : 512, on ? 40 : 156);
    this.mirrorRT.texture.magFilter = this.mirrorRT.texture.minFilter = filt;
    if (!this.scene) return;
    PSX.setTextures(this.scene, on);
    PSX.setTextures(this.vmScene, on);
    this.ground.material.map = on ? this.groundTex.retro : this.groundTex.clean;
    this.ground.material.needsUpdate = true;
    const a = this.atmos[on ? 'retro' : 'clean'];
    this.scene.background.set(a.sky);
    this.scene.fog.color.set(a.sky);
    this.scene.fog.near = a.near;
    this.scene.fog.far = a.far;
    this.hemi.intensity = a.hemi;
    this.sun.intensity = a.sun;
  }

  resize(W, H) {
    this.renderer.setSize(W, H, false);
    this.post.setSize(W, H);
    for (const cam of [this.camera, this.vmCamera]) {
      if (!cam) continue;
      cam.aspect = W / H;
      cam.updateProjectionMatrix();
    }
  }

  dispose() {
    if (!this.scene) return;
    const all = [];
    this.scene.traverse((o) => all.push(o));
    this.vmScene.traverse((o) => all.push(o));
    all.forEach((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (m.map && m.map !== this.mirrorRT.texture && !m.map.name.startsWith('psx_')) m.map.dispose();
        m.dispose();
      }
    });
  }

  // look: the player's cosmetics (body style, paint, finish, livery, number, plate).
  load(race, combat, look) {
    this.dispose();
    this.race = race;
    this.combat = combat;
    this.look3d = look || {};
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.3, 6000);
    this.rearCam = new THREE.PerspectiveCamera(50, 512 / 156, 1, 3000);
    this.scene.add(this.camera);
    // Held weapons live in their own scene, drawn after clearing depth so they never clip into the cabin.
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(74, 1, 0.1, 100);
    this.vmScene.add(this.vmCamera, new THREE.HemisphereLight(0xffffff, 0x444455, 1.2));
    const vmSun = new THREE.DirectionalLight(0xffffff, 0.9);
    vmSun.position.set(2, 4, 3);
    this.vmScene.add(vmSun);
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
    PSX.apply(this.scene);
    PSX.apply(this.vmScene);
    this.setRetro(PSX.enabled);
    this.resize(this.canvas.clientWidth || window.innerWidth, this.canvas.clientHeight || window.innerHeight);
  }

  // ---------- World ----------

  buildWorld() {
    const tr = this.race.track, bio = tr.biome, b = tr.bounds, scene = this.scene;
    this.env = null;
    if (bio.env) {
      // Gunner-campaign act: sky, megastructures, themed walls and scenery come from js/env.js.
      this.env = Env.build(scene, tr, bio.env);
      this.atmos = this.env.atmos;
      this.hemi = this.env.hemi;
      this.sun = this.env.sun;
      this.buildGround();
      this.buildHazards();
      this.buildGantry(this.env.th.banner, this.env.th.luxury ? '#d9b24a' : '#4a4038');
      return;
    }
    const sky = bio.night ? '#07060f' : bio === BIOMES.tundra ? '#cfdbe6' : bio === BIOMES.desert ? '#f2d9a8' : '#a9d3f0';
    // Retro: murky, close fog that swallows the track a few hundred metres out.
    const murk = bio.night ? '#05040a' : new THREE.Color(sky).lerp(new THREE.Color('#5a5648'), 0.55).getStyle();
    this.atmos = {
      clean: { sky, near: bio.night ? 250 : 500, far: bio.night ? 1600 : 2800, hemi: bio.night ? 0.5 : 1.1, sun: bio.night ? 0.35 : 1.2 },
      retro: { sky: murk, near: bio.night ? 60 : 120, far: bio.night ? 650 : 1150, hemi: bio.night ? 0.55 : 1.0, sun: bio.night ? 0.3 : 0.95 },
    };
    scene.background = new THREE.Color(sky);
    scene.fog = new THREE.Fog(sky, this.atmos.clean.near, this.atmos.clean.far);
    this.hemi = new THREE.HemisphereLight(0xffffff, new THREE.Color(bio.bg), this.atmos.clean.hemi);
    scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(bio.night ? 0x8a7cff : 0xfff2dd, this.atmos.clean.sun));
    sun.position.set(400, 900, 250);
    scene.add(sun);

    this.buildGround();
    this.buildWalls();
    this.buildDecos();
    this.buildHazards();
    this.buildGantry({ text: 'APEX ROGUE', bg: '#111', fg: '#ffd23f', edge: '#ffffff' }, bio.night ? '#2ff3ff' : '#333', bio.night);
  }

  // Ground: reuse the pre-rendered 2D track canvas as one big texture.
  buildGround() {
    const tr = this.race.track, bio = tr.biome, b = tr.bounds, scene = this.scene;
    const W = b.maxX - b.minX, H = b.maxY - b.minY;
    const tex = new THREE.CanvasTexture(tr.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const retroTex = new THREE.CanvasTexture(PSX.groundCanvas(tr.canvas, tr.seed));
    retroTex.colorSpace = THREE.SRGBColorSpace;
    retroTex.magFilter = THREE.NearestFilter;
    retroTex.minFilter = THREE.LinearMipmapLinearFilter;
    this.groundTex = { clean: tex, retro: retroTex };
    const ground = (this.ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex })));
    ground.position.set(b.minX + W / 2, 0, b.minY + H / 2);
    scene.add(ground);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: bio.bg }));
    far.position.y = -1.5;
    // No PS1 vertex snapping on these two giant flat planes: snapping their far-off corners tilts the
    // interpolated depth enough for the backdrop to poke through the track at low angles.
    ground.material.userData.psxSnap = true;
    far.material.userData.psxSnap = true;
    scene.add(far);
  }

  // Start/finish gantry with a banner across the track.
  buildGantry(bn, postColor, glow) {
    const tr = this.race.track, scene = this.scene;
    const i0 = 0, p0 = tr.pts[i0], n0x = tr.nx[i0], n0y = tr.ny[i0];
    const span = tr.hw + tr.runoff;
    const gm = m3(postColor, glow ? { emissive: postColor, emissiveIntensity: 0.6 } : {});
    for (const s of [-1, 1]) {
      const post = box(3, 40, 3, gm, p0.x + n0x * span * s, 20, p0.y + n0y * span * s);
      scene.add(post);
    }
    const bannerTex = canvasTex(512, 64);
    const bc = bannerTex.ctx;
    bc.fillStyle = bn.bg; bc.fillRect(0, 0, 512, 64);
    for (let k = 0; k < 32; k++) { bc.fillStyle = k % 2 ? bn.edge : bn.bg; bc.fillRect(k * 16, 0, 16, 8); bc.fillRect(k * 16 + (k % 2 ? -16 : 16), 56, 16, 8); }
    bc.fillStyle = bn.fg; bc.font = 'bold 34px Impact, system-ui'; bc.textAlign = 'center'; bc.fillText(bn.text, 256, 46, 490);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(span * 2, 9, 1.5), new THREE.MeshBasicMaterial({ map: bannerTex.tex }));
    banner.position.set(p0.x, 38, p0.y);
    banner.rotation.y = -tr.ang[i0] + Math.PI / 2;
    scene.add(banner);
  }

  buildWalls() {
    const tr = this.race.track, bio = tr.biome, N = tr.N;
    const inner = tr.hw + tr.runoff;
    const pos = [], col = [], idx = [];
    // Weathered concrete barriers with faded paint, rather than cartoon stripes.
    const concrete = new THREE.Color('#8c887d');
    const cA = new THREE.Color(bio.wall).lerp(concrete, bio.night ? 0.2 : 0.6), cB = new THREE.Color(bio.wallStripe).lerp(concrete, bio.night ? 0.2 : 0.6);
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
    const add = (tpl, list) => { if (list.length) for (const m of instanceTemplate(tpl, list)) this.scene.add(m); };
    const T = (d) => ({ x: d.x, z: d.y, ry: d.r * 6, s: d.s });
    if (kind === 'tree') {
      add(Models.tree(3), decos.filter((d) => d.r < 0.5).map(T));
      add(Models.tree(8), decos.filter((d) => d.r >= 0.5).map(T));
    } else if (kind === 'pine') {
      add(Models.pine(), decos.map(T));
    } else if (kind === 'cactus') {
      add(Models.cactus(), decos.filter((d) => d.r < 0.55).map(T));
      add(Models.rock(11), decos.filter((d) => d.r >= 0.55 && d.r < 0.8).map(T));
      add(Models.rock(23), decos.filter((d) => d.r >= 0.8).map(T));
    } else {
      for (let v = 0; v < 3; v++) {
        add(Models.building(v * 17 + 5), decos.filter((d) => Math.min(2, Math.floor(d.r * 3)) === v)
          .map((d) => ({ x: d.x, z: d.y, ry: Math.round(d.r * 4) * (Math.PI / 2), s: 1 })));
      }
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
      if (car === this.race.player) {
        // Your own car is just a shell (hood, rear deck, wheels); the cockpit interior fills the middle.
        this.playerGroup = new THREE.Group();
        this.playerGroup.add(Models.car(Object.assign({ color: car.color, accent: car.accent }, this.look3d, { shell: true })));
        this.scene.add(this.playerGroup);
        continue;
      }
      const g = new THREE.Group();
      // Rivals get a mix of body styles and paint jobs.
      const k = this.carMeshes.size;
      const style = ['comet', 'brick', 'wasp', 'phantom'][k % 4];
      const livery = ['stencil', 'roundel', 'none', 'stripes', 'stencil', 'flames'][k % 6];
      const finish = ['gloss', 'matte', 'rusty', 'patched'][(k * 3) % 4];
      // Bosses drive their own signature car.
      const model = car.bossLook
        ? Models.car(Object.assign({ color: car.color, accent: car.accent, weapon: car.weapon, number: 1 }, car.bossLook))
        : Models.car({ style, color: car.color, accent: car.accent, weapon: car.weapon, livery, finish, number: 10 + ((k * 37) % 89) });
      if (car.bossLook) model.scale.setScalar(1.08);
      g.add(model);
      const tag = canvasTex(256, 64);
      // Constant on-screen size so tags stay readable without filling the view up close.
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tag.tex, depthTest: false, transparent: true, sizeAttenuation: false }));
      sprite.scale.set(0.15, 0.0375, 1);
      sprite.position.set(0, 19, 0);
      g.add(sprite);
      this.scene.add(g);
      this.carMeshes.set(car, { g, model, bodyMat: model.userData.bodyMat, wheels: model.userData.wheels, tag, sprite, lastTag: '',
        mo: { pvx: car.vx, pvy: car.vy, roll: 0, vroll: 0, pitch: 0, vpitch: 0, hp: car.hp, hop: 0, spin: 0, seed: Math.random() * 10 } });
    }
  }

  // ---------- Interior ----------

  buildInterior() {
    const { group: I, refs } = Models.interior(this.race.player.color, { cabin: this.look3d.cabin });
    this.ornament = refs.ornament ? refs.ornament.userData.sway : null;
    this.wheel = refs.wheel;
    this.nadeMeshes = refs.nades;
    this.buildLoadout(I);
    // Live textures: mirror feed, dashboard screens, windshield cracks.
    const mirTex = this.mirrorRT.texture;
    mirTex.wrapS = THREE.RepeatWrapping;
    mirTex.repeat.x = -1;
    mirTex.offset.x = 1;
    const live = (mesh, tex, extra) => {
      mesh.material.map = tex;
      mesh.material.color.set('#ffffff');
      Object.assign(mesh.material, extra || {});
      mesh.material.needsUpdate = true;
    };
    live(refs.mirror, mirTex);
    this.radar = canvasTex(256, 256);
    live(refs.radar, this.radar.tex);
    this.status = canvasTex(256, 128);
    live(refs.status, this.status.tex);
    this.cracks = canvasTex(512, 256);
    this.grimeWindshield();
    live(refs.windshield, this.cracks.tex, { opacity: 1 });

    // Dust drifting in the bulb light.
    const N = 40, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = randRange(Math.random, -12, 4); pos[i * 3 + 1] = randRange(Math.random, 4, 12); pos[i * 3 + 2] = randRange(Math.random, -7, 7); }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#d8c8a0', size: 0.045, transparent: true, opacity: 0.4, depthWrite: false }));
    I.add(this.dust);

    // The dangling cabin bulb flickers (see update()).
    const cabinLight = (this.cabinLight = new THREE.PointLight((this.look3d.cabin && this.look3d.cabin.bulb) || 0xffd9a0, 0.7, 60, 1.2));
    cabinLight.position.copy(refs.bulb.position);
    I.add(cabinLight);
    this.bulb = refs.bulb;
    this.flicker = 1;
    this.interior = I;
    this.playerGroup.add(I);
  }

  // Your build, made physical: weapons on the door rack, trinkets hanging from the mirror or on the dash.
  buildLoadout(I) {
    const b = this.combat.build;
    const hooks = [7.3, 6.1, 4.9];
    this.rackGuns = b.rack.map((w, i) => {
      const m = Models.gunFinish(Models.modVisuals(Models.weapon(w.id), w.id, w.mods, false), (this.look3d.gunFinish || {})[w.id]);
      if (w.id === 'rocket') m.scale.setScalar(0.8);
      m.position.set(-1.2, hooks[i] || 4.9, -7.4);
      m.rotation.y = -Math.PI / 2;
      I.add(m);
      return m;
    });
    this.hangers = [];
    this.bobNecks = [];
    const hang = [[3.2, 10.8, 0.9], [3.2, 10.8, 0.25], [3.2, 10.8, -0.45], [3.2, 10.8, -1.1], [3.2, 10.8, 1.55]];
    const dash = { bobblehead: [[6.2, 6.8, 7.2], Math.PI, 0.55], horseshoe: [[5.9, 6.95, 5.0], 0, 1], medal: [[5.5, 6.9, -1.4], 0, 1] };
    let hi = 0;
    for (const id of b.trinkets) {
      const m = Models.trinket(id);
      if (dash[id]) {
        const [pos, ry, sc] = dash[id];
        m.position.set(...pos);
        m.rotation.y = ry;
        m.scale.setScalar(sc);
        if (id === 'horseshoe' || id === 'medal') { m.rotation.x = -Math.PI / 2 + 0.35; m.rotation.z = Math.PI / 2; }
        if (id === 'bobblehead') this.bobNecks.push(m.userData.neck);
      } else {
        m.position.set(...hang[hi++ % hang.length]);
        m.scale.setScalar(id === 'dice' ? 0.65 : 0.8);
        m.userData.swing = 0.8 + 0.4 * ((hi * 37) % 10) / 10;
        this.hangers.push(m);
      }
      I.add(m);
    }
  }

  buildViewmodels() {
    const vm = new THREE.Group();
    this.vmCamera.add(vm);
    // One held model per weapon on your rack; the active one is shown.
    const HOLD = { smg: [1.9, -1.7, -5.6, 1], shotgun: [1.8, -1.55, -4.6, 0.85], rocket: [2.7, -1.9, -5.4, 0.7], flare: [1.9, -1.55, -5.0, 1] };
    const guns = this.combat.build.rack.map((w) => {
      const m = Models.hands(Models.gunFinish(Models.modVisuals(Models.weapon(w.id), w.id, w.mods, true), (this.look3d.gunFinish || {})[w.id]), w.id);
      const [x, y, z, sc] = HOLD[w.id];
      m.position.set(x, y, z);
      m.scale.setScalar(sc);
      m.userData.hold = [x, y, z];
      vm.add(m);
      return m;
    });
    // Props the hands use while reloading: a shotgun shell carried to the loading port.
    guns.forEach((g, i) => {
      if (this.combat.build.rack[i].id === 'shotgun') {
        const shell = LP.cyl(0.24, 0.24, 0.8, 14, LP.mat('#a8221a', { roughness: 0.6 }));
        shell.add(LP.cyl(0.25, 0.25, 0.18, 14, LP.mat('#c9a443', { metalness: 0.7 }), 0, -0.35, 0));
        shell.rotation.x = Math.PI / 2;
        shell.visible = false;
        g.add(shell);
        g.userData.shell = shell;
      }
    });
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.vmCamera.add(flash);
    this.vm = { root: vm, guns, flash };
    // Spent casings flicked out of the ejection port, in the hand-held layer.
    this.casings = [];
    this.casingPool = [];
    for (let k = 0; k < 16; k++) {
      const c = LP.cyl(0.09, 0.09, 0.42, 10, LP.mat('#c9a443', { metalness: 0.8, roughness: 0.3 }));
      c.visible = false;
      this.vmCamera.add(c);
      this.casingPool.push(c);
    }
    this.anim = { switchT: 0, pumpT: 0, dry: 0, sway: { x: 0, vx: 0, y: 0, vy: 0, r: 0, vr: 0 }, lastYaw: 0, lastPitch: 0, rl: null };
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
      rocket: pool(24, () => Models.rocket()),
      mine: pool(40, () => Models.mine()),
      nade: pool(10, () => { const g = Models.grenade(); g.scale.setScalar(2.4); return g; }),
      flare: pool(8, () => new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), new THREE.MeshBasicMaterial({ color: '#ff7a2a' }))),
      cloud: pool(48, () => new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: '#8f8f8a', transparent: true, opacity: 0.8, depthWrite: false }))),
      boom: pool(24, () => new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffb13b', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))),
      puff: pool(160, () => new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), new THREE.MeshBasicMaterial({ color: '#cccccc', transparent: true, opacity: 0.5, depthWrite: false }))),
    };
    this.puffs = [];
    this.sparkPool = pool(90, () => new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.4), new THREE.MeshBasicMaterial({ color: '#ffd27a' })));
    this.debrisPool = pool(60, () => new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.6), LP.mat('#2a2826', { roughness: 0.9 })));
    this.ringPool = pool(8, () => new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
    this.sparks = [];
    this.debris = [];
    this.rings = [];
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
    if (ev.type === 'shoot' || ev.type === 'shotgun') this.ejectCasing(ev.type === 'shotgun');
    if (ev.type === 'explode') this.burst(ev.x, ev.y, ev.big);
    if (ev.type === 'switch') this.anim.switchT = 0.38;
    else if (ev.type === 'empty') this.anim.dry = 0.14;
    if (ev.type === 'shotgun') this.anim.pumpT = 0.55;
    if (ev.type === 'shoot') { this.recoil = Math.min(1, this.recoil + 0.35); this.flash = 0.05; }
    else if (ev.type === 'rocket') { this.recoil = 1.4; this.flash = 0.08; this.shake = Math.max(this.shake, 0.4); }
    else if (ev.type === 'shotgun') { this.recoil = 1.5; this.flash = 0.07; this.shake = Math.max(this.shake, 0.3); }
    else if (ev.type === 'flare') { this.recoil = 0.9; this.flash = 0.06; }
    else if (ev.type === 'partBreak') this.shake = Math.max(this.shake, 0.7);
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

  // Permanent grime: dirt packed into the corners and along the bottom, two wiper arcs wiped clean.
  grimeWindshield() {
    const c = this.cracks.ctx, W = 512, H = 256;
    c.clearRect(0, 0, W, H);
    const grad = c.createLinearGradient(0, H, 0, H * 0.45);
    grad.addColorStop(0, 'rgba(70,58,40,0.55)');
    grad.addColorStop(1, 'rgba(70,58,40,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);
    for (const cx of [0, W]) {
      const rg = c.createRadialGradient(cx, 0, 10, cx, 0, 200);
      rg.addColorStop(0, 'rgba(60,50,35,0.6)');
      rg.addColorStop(1, 'rgba(60,50,35,0)');
      c.fillStyle = rg;
      c.fillRect(0, 0, W, H);
    }
    for (let k = 0; k < 260; k++) {
      c.fillStyle = `rgba(${80 + Math.random() * 40},${65 + Math.random() * 30},45,${0.15 + Math.random() * 0.3})`;
      c.fillRect(Math.random() * W, H * 0.4 + Math.random() * H * 0.6, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    // Wipers cleaned two fans; erase the grime there.
    c.save();
    c.globalCompositeOperation = 'destination-out';
    for (const px of [150, 360]) {
      c.fillStyle = 'rgba(0,0,0,0.75)';
      c.beginPath();
      c.moveTo(px, H);
      c.arc(px, H, 190, Math.PI * 1.08, Math.PI * 1.92);
      c.closePath();
      c.fill();
    }
    c.restore();
    // Bug splats.
    for (let k = 0; k < 7; k++) {
      c.fillStyle = 'rgba(40,35,20,0.6)';
      c.beginPath(); c.arc(Math.random() * W, Math.random() * H * 0.6, 1.5 + Math.random() * 2, 0, TAU); c.fill();
    }
    this.cracks.tex.needsUpdate = true;
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

  // Screen positions of rival name tags (the retro view draws them crisp on the HUD instead of in 3D).
  tags(W, H) {
    const out = [], v = new THREE.Vector3();
    for (const [car, m] of this.carMeshes) {
      v.set(car.x, 19, car.y).project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      const d = Math.hypot(car.x - this.race.player.x, car.y - this.race.player.y);
      if (d > 1100) continue;
      out.push({ x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, label: `${car.place}. ${shortName(car)}${car.hp <= 0 ? ' ✖' : ''}${car.markT > 0 ? ' ◎' : ''}${car.bounty ? ' $' : ''}`, armed: !!car.weapon, d });
    }
    return out;
  }

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
    for (const h of this.hangers) h.rotation.set(clamp(this.dice.a * h.userData.swing, -1, 1), 0, clamp(this.dice.b * h.userData.swing, -1, 1));
    for (const n of this.bobNecks) n.rotation.set(clamp(this.bob.a, -0.8, 0.8), 0, clamp(this.bob.b, -0.8, 0.8));
    if (this.ornament) {
      const o = this.ornament, k = o.userData.stiff ? 0.25 : 0.8;
      if (o.userData.axis === 'nod') o.rotation.set(0, 0, clamp(-this.bob.b * 1.2 + Math.sin(performance.now() * 0.009) * 0.04, -0.7, 0.7));
      else o.rotation.set(clamp(this.bob.a * k, -0.6, 0.6), 0, clamp(this.bob.b * k, -0.6, 0.6));
    }

    if (this.env) Env.update(this.env, dt, t, p.x, p.y, this.scene);

    // Cars
    this.playerGroup.position.set(p.x, 0, p.y);
    this.playerGroup.rotation.y = -p.heading;
    this.playerGroup.updateMatrixWorld(true); // localToWorld below needs this frame's transform
    for (const [car, m] of this.carMeshes) {
      m.g.position.set(car.x, 0, car.y);
      m.g.rotation.y = -car.heading;
      for (const w of m.wheels) {
        w.rotation.z -= (car.forwardSpeed * dt) / 3.8;
        if (w.position.x > 0) w.rotation.y = -(car.input ? car.input.steer : 0) * 0.5; // front wheels steer
      }
      this.carMotion(car, m, dt, t);
      const flash = car.hitFlash > 0;
      if (car.burnT > 0 && this.puffs.length < this.pools.puff.length && Math.random() < 0.5) this.puffs.push({ x: car.x + (Math.random() - 0.5) * 20, y: car.y + (Math.random() - 0.5) * 12, t: 0, fire: true });
      m.bodyMat.emissive.set(flash ? '#ffffff' : car.burnT > 0 && Math.random() < 0.6 ? '#ff4a0a' : car.blindT > 0 ? '#ff5a1a' : car.empT > 0 && Math.floor(t * 8) % 2 ? '#3fa9ff' : car.hp <= 0 ? '#331100' : '#000000');
      m.bodyMat.emissiveIntensity = flash ? 0.8 : 1;
      m.sprite.visible = !PSX.enabled;
      const label = `${car.place}. ${shortName(car)}${car.hp <= 0 ? ' ✖' : ''}${car.bounty ? ' $' : ''}`;
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

    // Bad wiring: the bulb mostly glows, sometimes stutters or drops out.
    if (Math.random() < dt * 1.5) this.flickerT = 0.05 + Math.random() * 0.35;
    this.flickerT = (this.flickerT || 0) - dt;
    this.flicker = this.flickerT > 0 ? (Math.random() < 0.5 ? 0.1 : 0.6) : lerp(this.flicker, 1, Math.min(1, dt * 10));
    this.cabinLight.intensity = (PSX.enabled ? 1.6 : 0.8) * this.flicker;
    this.bulb.userData.glass.material.emissiveIntensity = 1.4 * this.flicker;
    this.bulb.rotation.z = clamp(this.dice.a, -1, 1) * 0.6;
    const dp = this.dust.geometry.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      let y = dp.getY(i) + Math.sin(t * 0.7 + i) * dt * 0.3 - dt * 0.08;
      if (y < 3.5) y = 12;
      dp.setY(i, y);
      dp.setX(i, dp.getX(i) + Math.cos(t * 0.5 + i * 1.3) * dt * 0.2);
    }
    dp.needsUpdate = true;
    this.dust.material.opacity = 0.4 * this.flicker;
    this.bulb.rotation.x = clamp(this.dice.b, -1, 1) * 0.6;

    // Interior props reflect combat state.
    const b = combat.build;
    for (let k = 0; k < 3; k++) this.nadeMeshes[k].visible = k < b.grenades;
    this.rackGuns.forEach((m, i) => {
      m.visible = i !== combat.wi;
      if (m.userData.tip) m.userData.tip.visible = b.rack[i].mag > 0;
    });

    this.animateViewmodel(dt, t);
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

  // Body roll in corners, nose dive under braking, squat on launch, suspension jiggle, a jolt when hit,
  // and a hop-and-spin the moment a car is wrecked. Damaged cars smoke; exhausts puff under hard throttle.
  carMotion(car, m, dt, t) {
    const mo = m.mo;
    if (dt > 0) {
      const ax = (car.vx - mo.pvx) / dt, ay = (car.vy - mo.pvy) / dt;
      const c = Math.cos(car.heading), s = Math.sin(car.heading);
      const fwd = ax * c + ay * s, lat = -ax * s + ay * c;
      const k = 140, d = 11;
      mo.vroll += ((clamp(-lat * 0.00011, -0.11, 0.11) - mo.roll) * k - mo.vroll * d) * dt; mo.roll += mo.vroll * dt;
      mo.vpitch += ((clamp(fwd * 0.00007, -0.07, 0.07) - mo.pitch) * k - mo.vpitch * d) * dt; mo.pitch += mo.vpitch * dt;
    }
    mo.pvx = car.vx; mo.pvy = car.vy;
    // Took a hit: jolt the body.
    if (car.hp < mo.hp - 1.5) { mo.vroll += (Math.random() - 0.5) * 4; mo.vpitch += (Math.random() - 0.5) * 2.5; this.sparkAt(car.x, car.y, 6); }
    // Wrecked just now: hop and spin.
    if (mo.hp > 0 && car.hp <= 0) { mo.hop = 1; mo.spin = (Math.random() < 0.5 ? -1 : 1) * TAU; this.burst(car.x, car.y, false, true); }
    mo.hp = car.hp;
    let y = Math.sin(t * 13 + mo.seed) * 0.05 * Math.min(1, Math.abs(car.forwardSpeed) / 300);
    let spinY = 0, extraRoll = 0;
    if (mo.hop > 0) {
      mo.hop = Math.max(0, mo.hop - dt * 1.4);
      const f = 1 - mo.hop;
      y += Math.sin(Math.PI * f) * 10;
      spinY = mo.spin * (1 - (1 - f) * (1 - f)) % TAU;
      extraRoll = Math.sin(Math.PI * f) * 0.6;
    }
    if (car.hp <= 0) extraRoll += 0.05; // sagging on a broken spring
    m.model.position.y = y;
    m.model.rotation.set(mo.roll + extraRoll, spinY * (mo.hop > 0 ? 1 : 0), mo.pitch);
    // Smoke from damaged engines, black when wrecked; exhaust puffs under hard throttle.
    const frac = car.hp / (car.stats.maxHp || 100), room = this.puffs.length < this.pools.puff.length;
    if (room && frac < 0.5 && Math.random() < (frac <= 0 ? 0.6 : frac < 0.25 ? 0.35 : 0.15)) {
      const c = Math.cos(car.heading), s = Math.sin(car.heading);
      this.puffs.push({ x: car.x + c * 14, y: car.y + s * 14, t: 0, smoke: frac <= 0 ? 'black' : frac < 0.25 ? 'dark' : 'grey' });
    }
    if (room && car.input && car.input.throttle > 0.8 && car.forwardSpeed < 200 && Math.random() < 0.25) {
      const c = Math.cos(car.heading), s = Math.sin(car.heading);
      this.puffs.push({ x: car.x - c * 19, y: car.y - s * 19, t: 0, exh: true });
    }
  }

  sparkAt(x, y, n) {
    for (let k = 0; k < n && this.sparks.length < this.sparkPool.length; k++) {
      const a = Math.random() * TAU, sp = 60 + Math.random() * 120;
      this.sparks.push({ x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 8, z: 5 + Math.random() * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 30 + Math.random() * 60, t: 0, life: 0.25 + Math.random() * 0.25 });
    }
  }

  // Explosion: flying debris, sparks and a shockwave ring on the ground.
  burst(x, y, big, wreck) {
    const n = big ? 12 : wreck ? 10 : 6;
    for (let k = 0; k < n && this.debris.length < this.debrisPool.length; k++) {
      const a = Math.random() * TAU, sp = 40 + Math.random() * (big ? 160 : 100);
      this.debris.push({ x, y, z: 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 40 + Math.random() * 90, rx: Math.random() * 6, ry: Math.random() * 6, sx: (Math.random() - 0.5) * 14, sy: (Math.random() - 0.5) * 14, t: 0, s: 0.6 + Math.random() * (big ? 1.4 : 0.9) });
    }
    this.sparkAt(x, y, big ? 18 : 10);
    if (this.rings.length < this.ringPool.length) this.rings.push({ x, y, t: 0, r: big ? 90 : wreck ? 55 : 60 });
  }

  ejectCasing(shell) {
    const held = this.vm.guns[this.combat.wi];
    if (!held || this.casings.length >= this.casingPool.length) return;
    const [x, y, z] = held.userData.hold;
    this.casings.push({ x: x + 0.6, y: y + 0.4, z: z + 0.3, vx: 3 + Math.random() * 2, vy: 4 + Math.random() * 2, vz: 1 + Math.random(), r: 0, vr: 10 + Math.random() * 10, t: 0, shell });
  }

  updateParticles(dt) {
    const g = 160;
    for (const s of this.sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vz -= g * dt; s.z = Math.max(0.3, s.z + s.vz * dt); }
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    this.sparkPool.forEach((o, i) => {
      const s = this.sparks[i];
      o.visible = !!s;
      if (!s) return;
      o.position.set(s.x, s.z, s.y);
      o.lookAt(s.x + s.vx, s.z + s.vz, s.y + s.vy);
      o.material.color.set(s.t < s.life * 0.4 ? '#fff2b0' : '#ff9a3a');
    });
    for (const d of this.debris) {
      d.t += dt;
      if (d.z > 0.5 || d.vz > 0) { d.x += d.vx * dt; d.y += d.vy * dt; d.vz -= g * dt; d.z += d.vz * dt; d.rx += d.sx * dt; d.ry += d.sy * dt; }
      if (d.z <= 0.5 && d.vz < 0) { d.z = 0.5; d.vz = Math.abs(d.vz) > 30 ? -d.vz * 0.35 : 0; d.vx *= 0.5; d.vy *= 0.5; }
    }
    this.debris = this.debris.filter((d) => d.t < 6);
    this.debrisPool.forEach((o, i) => {
      const d = this.debris[i];
      o.visible = !!d;
      if (!d) return;
      o.position.set(d.x, d.z, d.y);
      o.rotation.set(d.rx, d.ry, 0);
      o.scale.setScalar(d.s * (d.t > 5 ? 6 - d.t : 1));
    });
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0.45);
    this.ringPool.forEach((o, i) => {
      const r = this.rings[i];
      o.visible = !!r;
      if (!r) return;
      const k = r.t / 0.45;
      o.position.set(r.x, 0.6, r.y);
      o.scale.setScalar(r.r * (0.2 + k));
      o.material.opacity = 0.7 * (1 - k);
    });
    for (const c of this.casings) { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.vy -= 30 * dt; c.r += c.vr * dt; }
    this.casings = this.casings.filter((c) => c.t < 0.7);
    this.casingPool.forEach((o, i) => {
      const c = this.casings[i];
      o.visible = !!c;
      if (!c) return;
      o.position.set(c.x, c.y, c.z);
      o.rotation.set(c.r, c.r * 0.7, Math.PI / 2);
      o.scale.set(c.shell ? 2.2 : 1, c.shell ? 1.6 : 1, c.shell ? 2.2 : 1);
      o.material.color.set(c.shell ? '#a8221a' : '#c9a443');
    });
  }

  // Held-weapon animation: reloads (per weapon), shotgun pump after each shot, switch raise, inertia sway
  // from the car and your look, breathing, recoil and a dry-fire twitch.
  animateViewmodel(dt, t) {
    const combat = this.combat, p = this.race.player, b = combat.build, vm = this.vm, A = this.anim;
    const st = combat.wstate[combat.wi], id = b.rack[combat.wi].id;
    const ss = (a, c, x) => { const k = clamp((x - a) / (c - a), 0, 1); return k * k * (3 - 2 * k); }; // smoothstep a..c
    const bump = (a, c, x) => Math.sin(Math.PI * clamp((x - a) / (c - a), 0, 1)); // 0 -> 1 -> 0 over a..c
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.flash -= dt;
    A.switchT = Math.max(0, A.switchT - dt);
    A.pumpT = Math.max(0, A.pumpT - dt);
    A.dry = Math.max(0, A.dry - dt);
    // Reload progress 0..1 for the held weapon.
    let rp = -1;
    if (st.reloadT > 0) {
      if (!A.rl || A.rl.wi !== combat.wi) A.rl = { wi: combat.wi, dur: st.reloadT };
      rp = 1 - st.reloadT / A.rl.dur;
    } else A.rl = null;
    // Inertia: the gun lags behind the car's lurches and your mouse movements, on springs.
    const dyaw = wrapAngle(this.look.yaw - A.lastYaw), dpitch = this.look.pitch - A.lastPitch;
    A.lastYaw = this.look.yaw; A.lastPitch = this.look.pitch;
    const sw = A.sway, k = 120, d = 14;
    const tx = clamp(-this.acc.lat * 0.0009 - dyaw * 6, -1.2, 1.2), ty = clamp(-this.acc.fwd * 0.0005 - dpitch * 6, -0.8, 0.8);
    sw.vx += ((tx - sw.x) * k - sw.vx * d) * dt; sw.x += sw.vx * dt;
    sw.vy += ((ty - sw.y) * k - sw.vy * d) * dt; sw.y += sw.vy * dt;
    sw.vr += ((-dyaw * 4 - sw.r) * k - sw.vr * d) * dt; sw.r += sw.vr * dt;
    const spd = Math.min(1, p.speed / 500);
    const bob = Math.sin(t * 9) * spd * 0.05 + Math.sin(t * 1.7) * 0.03; // road vibration + breathing
    const busyDip = combat.busy ? 4 : 0;
    this.dip = lerp(this.dip || 0, busyDip, Math.min(1, dt * 10));
    const sw01 = A.switchT / 0.38, raise = sw01 * sw01 * 5;
    vm.guns.forEach((g, i) => {
      g.visible = i === combat.wi;
      if (!g.visible) return;
      const [x, y, z] = g.userData.hold, u = g.userData, hands = u.hands || [];
      // Reset moving parts to rest.
      for (const h of hands) { h.position.copy(h.userData.rest.pos); h.rotation.set(h.userData.rest.rot, 0, 0); h.visible = true; }
      if (u.mag) u.mag.position.set(0, -2.7, 0.2), (u.mag.visible = true);
      if (u.pump) u.pump.position.set(0, 0, 0);
      if (u.barrelGrp) u.barrelGrp.rotation.x = 0;
      if (u.shell) u.shell.visible = false;
      if (u.tip) { u.tip.position.z = -6.3; u.tip.visible = b.rack[i].mag > 0; }
      let ox = 0, oy = 0, oz = 0, rx = 0, ry = 0, rz = 0;
      if (rp >= 0) {
        const tilt = ss(0, 0.15, rp) * (1 - ss(0.9, 1, rp));
        if (id === 'smg') {
          // Tilt, drop the mag, the support hand fetches a fresh one, slaps it in, racks the bolt.
          ry = 0.95 * tilt; rz = 0.25 * tilt; rx = 0.1 * tilt; ox = -1.4 * tilt; oy = 2.6 * tilt; oz = 0.2 * tilt; // turned side-on so you see the mag well
          const out = ss(0.15, 0.32, rp), back = ss(0.55, 0.8, rp);
          const drop = out * (1 - back);
          u.mag.position.y -= drop * 7;
          u.mag.position.x -= drop * 1.5;
          const hand = hands[1];
          if (hand) {
            const away = ss(0.12, 0.3, rp) * (1 - ss(0.8, 0.92, rp));
            // Down and away to the mag pouch, then cupping the mag base on the way back up.
            const toMag = ss(0.55, 0.8, rp);
            hand.position.lerp(new THREE.Vector3(-0.4, -5.2, 0.4), away * (1 - toMag) + 0);
            if (toMag > 0 && rp < 0.92) hand.position.lerp(new THREE.Vector3(-0.2, -5.0 + 2.3 * toMag - drop * 7, 0.3), Math.min(1, toMag * 1.5) * (1 - ss(0.8, 0.92, rp)));
          }
          oz += bump(0.78, 0.84, rp) * 0.4; // slap
          rx -= bump(0.86, 0.94, rp) * 0.12; // bolt rack kick
        } else if (id === 'shotgun') {
          // Roll it over, thumb four shells into the loading port, rack the pump.
          rz = -0.7 * tilt; ry = 0.25 * tilt; oy = 0.9 * tilt; ox = -0.5 * tilt;
          const hand = hands[1], port = new THREE.Vector3(0, -0.9, -0.3);
          const load = ss(0.12, 0.2, rp) * (1 - ss(0.78, 0.85, rp));
          if (hand) {
            const cyc = clamp((rp - 0.2) / 0.58, 0, 1) * 4, f = cyc % 1, inLoad = rp > 0.2 && rp < 0.78;
            const reach = inLoad ? Math.sin(Math.PI * f) : 0; // down to the shell carrier and back
            hand.position.lerp(port, load);
            hand.position.y -= reach * 2.4;
            hand.rotation.x = hand.userData.rest.rot + load * 0.5;
            if (u.shell && inLoad && f > 0.15 && f < 0.85) {
              u.shell.visible = true;
              u.shell.position.set(hand.position.x, hand.position.y + 0.55, hand.position.z + (f > 0.5 ? (0.85 - f) * 1.2 : 0));
            }
          }
          const rack = bump(0.86, 0.98, rp);
          u.pump.position.z = rack * 1.2;
          if (hand && rp > 0.85) hand.position.z += rack * 1.2;
        } else if (id === 'rocket') {
          // Lower the launcher, the front hand fetches a warhead and slides it into the muzzle.
          ry = 0.55 * tilt; rx = -0.1 * tilt; ox = -1.2 * tilt; oy = 0.3 * tilt; oz = 1.5 * tilt; rz = 0.15 * tilt;
          const hand = hands[1];
          const fetch = ss(0.12, 0.35, rp) * (1 - ss(0.45, 0.6, rp));
          const slide = ss(0.45, 0.82, rp);
          if (u.tip) { u.tip.visible = rp > 0.45; u.tip.position.z = -6.3 - (1 - slide) * 6; }
          if (hand) {
            hand.position.lerp(new THREE.Vector3(-0.8, -4.5, -3), fetch);
            if (rp > 0.45 && rp < 0.9) hand.position.lerp(new THREE.Vector3(0, -0.9, u.tip.position.z + 1.2), 1 - ss(0.82, 0.9, rp));
          }
        } else if (id === 'flare') {
          // Break the barrel open, the spent case flips out, a fresh one goes in, snap it shut.
          ry = 1.0 * tilt; rx = 0.1 * tilt; rz = 0.15 * tilt; ox = -1.0 * tilt; oy = 1.2 * tilt; oz = 1.3 * tilt;
          const open = ss(0.08, 0.25, rp) * (1 - ss(0.78, 0.9, rp));
          u.barrelGrp.rotation.x = -0.75 * open;
          if (u.shell) {
            if (rp > 0.25 && rp < 0.45) { const f = (rp - 0.25) / 0.2; u.shell.visible = true; u.shell.position.set(0.3 * f, 0.4 + 2.5 * f, 0.6 + 2 * f); u.shell.rotation.set(Math.PI / 2 + f * 3, 0, f * 2); }
            else if (rp > 0.5 && rp < 0.75) { const f = ss(0.5, 0.72, rp); u.shell.visible = true; u.shell.position.set(0, 0.3 - (1 - f) * 2.5, 0.2 + (1 - f) * 1.5); u.shell.rotation.set(Math.PI / 2, 0, 0); }
          }
          oz += bump(0.86, 0.92, rp) * 0.3; // snap shut
        }
      }
      // Pump-action after every shotgun blast.
      if (id === 'shotgun' && A.pumpT > 0 && u.pump) {
        const f = 1 - A.pumpT / 0.55, rack = bump(0.25, 0.95, f);
        u.pump.position.z = rack * 1.2;
        if (hands[1]) hands[1].position.z += rack * 1.2;
        rx += rack * 0.05;
      }
      const dry = A.dry > 0 ? Math.sin((A.dry / 0.14) * Math.PI) * 0.05 : 0;
      g.position.set(x + sw.x * 0.5 + ox, y + bob + sw.y * 0.4 - this.dip - raise + oy, z + this.recoil * 0.8 + oz);
      g.rotation.set(this.recoil * 0.12 - this.dip * 0.15 + sw.y * 0.06 + rx + dry, sw.r * 0.3 + ry, -sw.x * 0.1 + rz);
    });
    const held = vm.guns[combat.wi];
    vm.flash.visible = this.flash > 0;
    vm.flash.position.set(held.userData.hold[0] + 0.2, held.userData.hold[1] + 0.3, held.userData.hold[2] - 6.5);
    vm.flash.rotation.z = Math.random() * TAU;
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
      if (e.kind === 'emp' || e.kind === 'flare') {
        o.scale.set(e.r * k, 6, e.r * k);
        o.material.opacity = 0.6 * (1 - k);
        o.material.color.set(e.kind === 'flare' ? '#ff7a2a' : '#7fd8ff');
        return;
      }
      o.scale.setScalar(e.r * (0.4 + 0.7 * k));
      o.material.opacity = 0.85 * (1 - k);
      o.material.color.setHSL(0.08 - 0.06 * k, 1, 0.55);
    });
    show(this.pools.flare, c.projectiles.filter((q) => q.type === 'flare'), (o, q) => {
      o.position.set(q.x, 8, q.y);
      o.rotation.y += dt * 10;
      if (this.puffs.length < this.pools.puff.length) this.puffs.push({ x: q.x, y: q.y, t: 0 });
    });
    const blobs = [];
    for (const cl of c.clouds) {
      const fade = Math.min(1, (cl.life - cl.t) / 1.5);
      for (let k = 0; k < 8; k++) {
        const a = k * 0.785 + cl.t * 0.2;
        blobs.push({ x: cl.x + Math.cos(a) * cl.cur * 0.45, y: cl.y + Math.sin(a) * cl.cur * 0.45, h: 6 + (k % 3) * 5, r: cl.cur * 0.5, fade });
      }
    }
    show(this.pools.cloud, blobs, (o, bl) => {
      o.position.set(bl.x, bl.h, bl.y);
      o.scale.setScalar(Math.max(1, bl.r));
      o.material.opacity = 0.85 * bl.fade;
    });
    for (const pf of this.puffs) pf.t += dt;
    this.puffs = this.puffs.filter((pf) => pf.t < 0.8);
    show(this.pools.puff, this.puffs, (o, pf) => {
      if (pf.smoke) {
        o.position.set(pf.x, 8 + pf.t * 22, pf.y);
        o.scale.setScalar(2 + pf.t * 9);
        o.material.color.set(pf.smoke === 'black' ? '#141210' : pf.smoke === 'dark' ? '#3a3632' : '#8a8680');
        o.material.opacity = 0.55 * (1 - pf.t / 0.8);
        return;
      }
      if (pf.exh) {
        o.position.set(pf.x, 2 + pf.t * 3, pf.y);
        o.scale.setScalar(0.8 + pf.t * 4);
        o.material.color.set('#9a968c');
        o.material.opacity = 0.4 * (1 - pf.t / 0.8);
        return;
      }
      o.position.set(pf.x, 9 + pf.t * 6, pf.y);
      o.scale.setScalar(pf.fire ? 2.5 - pf.t * 2 : 2 + pf.t * 7);
      o.material.color.set(pf.fire ? (pf.t < 0.3 ? '#ffc23a' : '#ff5a1a') : '#cccccc');
      o.material.opacity = (pf.fire ? 0.9 : 0.45) * (1 - pf.t / 0.8);
    });
    this.updateParticles(dt);
    for (const [car, line] of this.lockLines) {
      const lock = car.wpn && car.wpn.lock > 0;
      line.visible = lock;
      if (!lock) continue;
      const k = car.wpn.lock / this.combat.lockTime;
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
    // Part wear: four little bars, blinking when broken.
    const b = c.build;
    ctx.font = 'bold 13px monospace';
    PART_SLOTS.forEach((slot, i) => {
      const part = b.parts[slot], f = clamp(part.dur / partMaxDur(b, part.id), 0, 1);
      const x = 12 + i * 60;
      const broken = part.dur <= 0;
      ctx.fillStyle = broken ? (Math.floor(t * 4) % 2 ? '#ff3b1f' : '#5a1408') : '#ffb000';
      ctx.fillText(['ENG', 'TYR', 'ARM', 'NOS'][i], x, 92);
      ctx.fillStyle = 'rgba(255,176,0,0.2)';
      ctx.fillRect(x, 98, 48, 9);
      ctx.fillStyle = broken ? '#ff3b1f' : f < 0.3 ? '#ff7a1f' : '#ffb000';
      ctx.fillRect(x, 98, 48 * (broken ? 1 : f), 9);
    });
    ctx.fillStyle = '#ffb000';
    ctx.font = '12px monospace';
    ctx.fillText(b.spare ? `SPARE: ${PARTS[b.spare.id].name.toUpperCase()}` : 'NO SPARE', 12, 122);
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
    if (PSX.enabled) this.post.begin();
    r.render(this.scene, this.camera);
    r.autoClear = false;
    r.clearDepth();
    r.render(this.vmScene, this.vmCamera);
    r.autoClear = true;
    if (PSX.enabled) this.post.end(t);
  }
}
