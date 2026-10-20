'use strict';
const RACK_SPAN = [-3.4, 2.4];
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

// How each gun bucks when it fires: push back (z), muzzle climb (pitch), a random sideways jitter (yaw) and roll,
// a punch to the view (cam: pitch, croll: a twist of the head), a widening of the view for a split second (fov,
// degrees: the blast filling your eyes), a jolt through the seat (shake), the size of the muzzle flash, smoke, and
// how hard the flash lights the cabin. Some of the kick lands at once (it's a punch, not a push) and the rest
// arrives on springs and settles.
const FIRE_KICK = {
  pistol: { back: 0.7, climb: 0.3, yaw: 0.05, roll: 0.09, cam: 0.02, croll: 0.01, fov: 0.6, flash: 1, smoke: 0.5, light: 1 },
  smg: { back: 0.38, climb: 0.09, yaw: 0.04, roll: 0.035, cam: 0.008, croll: 0.004, fov: 0.25, flash: 0.85, smoke: 0.25, light: 0.8 },
  nailgun: { back: 0.32, climb: 0.07, yaw: 0.03, roll: 0.02, cam: 0.004, fov: 0, flash: 0, smoke: 0.15, light: 0 },
  shotgun: { back: 1.8, climb: 0.55, yaw: 0.06, roll: 0.2, cam: 0.06, croll: 0.03, fov: 3, shake: 0.35, flash: 1.9, smoke: 1, light: 1.6 },
  rocket: { back: 1.9, climb: 0.22, yaw: 0.04, roll: 0.07, cam: 0.07, croll: 0.02, fov: 4, shake: 0.55, flash: 2.6, smoke: 2, light: 2 },
  flare: { back: 1.0, climb: 0.5, yaw: 0.05, roll: 0.12, cam: 0.03, croll: 0.012, fov: 1.2, flash: 1.3, smoke: 0.8, light: 1.2, color: '#ff6a3a' },
  harpoon: { back: 1.3, climb: 0.2, yaw: 0.03, roll: 0.06, cam: 0.03, croll: 0.01, fov: 1.5, shake: 0.15, flash: 0, smoke: 0, light: 0 },
  flamer: { back: 0.04, climb: 0.01, yaw: 0.015, roll: 0.01, cam: 0, fov: 0, flash: 0, smoke: 0, light: 0.5, color: '#ff7a2a' },
  carbine: { back: 0.5, climb: 0.13, yaw: 0.04, roll: 0.035, cam: 0.012, croll: 0.005, fov: 0.35, flash: 1, smoke: 0.3, light: 0.9 },
  liberty: { back: 1.4, climb: 0.45, yaw: 0.05, roll: 0.12, cam: 0.05, croll: 0.02, fov: 2.2, shake: 0.2, flash: 1.4, smoke: 0.7, light: 1.3 },
  typewriter: { back: 0.42, climb: 0.17, yaw: 0.06, roll: 0.05, cam: 0.01, croll: 0.006, fov: 0.3, flash: 1.1, smoke: 0.35, light: 0.9 },
  lmg: { back: 0.6, climb: 0.11, yaw: 0.06, roll: 0.05, cam: 0.016, croll: 0.006, fov: 0.45, shake: 0.06, flash: 1.3, smoke: 0.45, light: 1.1 },
  pangun: { back: 0.7, climb: 0.13, yaw: 0.055, roll: 0.05, cam: 0.02, croll: 0.007, fov: 0.55, shake: 0.08, flash: 1.3, smoke: 0.5, light: 1.1 },
};
// Recoil you have to fight: each shot throws your view up (v, radians) and kicks it sideways at random (h, which
// does move your aim); once you stop firing, most of the climb settles back (rec, the share that comes back). Aiming
// down the sights and the braced roof mount both cut it.
const RECOIL = {
  pistol: { v: 0.026, h: 0.006, rec: 0.8 }, smg: { v: 0.011, h: 0.009, rec: 0.75 }, nailgun: { v: 0.005, h: 0.004, rec: 0.9 },
  shotgun: { v: 0.09, h: 0.012, rec: 0.8 }, rocket: { v: 0.065, h: 0.006, rec: 0.85 }, flare: { v: 0.04, h: 0.008, rec: 0.85 },
  harpoon: { v: 0.05, h: 0.006, rec: 0.85 }, flamer: { v: 0.001, h: 0.002, rec: 1 }, carbine: { v: 0.014, h: 0.006, rec: 0.75 },
  liberty: { v: 0.075, h: 0.01, rec: 0.8 }, typewriter: { v: 0.016, h: 0.013, rec: 0.6 }, lmg: { v: 0.013, h: 0.01, rec: 0.7 },
  pangun: { v: 0.016, h: 0.011, rec: 0.7 },
};

// Magazine-fed guns: where the support hand holds a fresh magazine (offset from where it sits in the gun) and which
// way the empty one falls. The pan comes off the top and is tossed aside.
// dir: the way into the well, from outside (the fresh one is lined up that far out, then pushed straight in).
const MAG_RELOAD = {
  pistol: { off: [0, 0.95, -0.1], drop: [-0.4, -6, 0.9], dir: [0, -1, 0.25], depth: 1.7, spin: [1.4, 0, 0.9] },
  smg: { off: [0, 1.6, -0.1], drop: [-1.5, -7, 0], dir: [0, -1, 0.09], depth: 1.6 },
  carbine: { off: [0, 1.7, 0], drop: [-1.5, -7, 0], dir: [0, -1, -0.2], depth: 1.3 },
  typewriter: { off: [0, 1.25, 0], drop: [-0.6, -7, 0], dir: [0, -1, 0], depth: 0.9 },
  lmg: { off: [0, 0.6, 0], drop: [-1.2, -6, 0], dir: [0, -1, 0], depth: 0.9 },
  pangun: { off: [1.3, 0, 0], drop: [-3, 3, 0], dir: [0, 1, 0], depth: 1.1 },
};
// How each gun is held to reload it (on top of its hold, eased in and out): rx muzzle up (+) or down, ry turned in,
// rz canted (+ rolls the top away to the left, showing the underside), and ox/oy/oz pulled left, up and in towards
// you. The way you'd really do it: the muzzle stays out in front, and the gun is tipped so its loading point faces
// the hand doing the work: the mag well canted down towards your left hand, the shotgun's port rolled up, the
// break-open flare gun tipped muzzle-down so the breech lifts towards you, the rocket tube muzzle-up for its warhead.
const RELOAD_POSE = {
  pistol: { rx: 0.42, ry: 0.35, rz: -0.95, ox: -1.7, oy: 1.25, oz: 0.35 }, // brought in front of your chest and canted over, the butt of the grip to the other hand
  mag: { rx: 0.22, ry: 0.22, rz: -0.6, ox: -1.2, oy: 1.3, oz: 0.8 }, // SMG, carbine, Typewriter: mag or drum underneath
  pangun: { rx: 0.4, ry: 0.12, rz: 0.25, ox: -0.8, oy: 0.6, oz: 0.6 }, // the pan on top: tipped so its top faces you
  lmg: { rx: 0.15, ry: 0.15, rz: 0.4, ox: -0.6, oy: 0.4, oz: 0.5 }, // the box on its left side: rolled to face up
  shotgun: { rx: 0.18, ry: 0.15, rz: -0.95, ox: -0.6, oy: 1.0, oz: 0.6 }, // loading port, underneath, rolled up
  rocket: { rx: 0.5, ry: 0.12, rz: 0.1, ox: -0.9, oy: 0.4, oz: 1.0 }, // muzzle up: the warhead goes in the front
  flare: { rx: -0.12, ry: 0.1, rz: -0.12, ox: -0.7, oy: 0.5, oz: 0.3 }, // broken open, the breech lifting to you
  nailgun: { rx: 0.3, ry: 0.35, rz: -1.15, ox: -1.8, oy: 1.6, oz: 0.5 }, // brought up and rolled over, the magazine underneath turned to the other hand
  other: { rx: 0.15, ry: 0.18, rz: -0.4, ox: -1.0, oy: 1.0, oz: 0.6 }, // flamethrower, harpoon
};
// Down the sights, per gun: [x, y, z] nudges from dead centre. Guns with no real sight line (the rocket tube on
// your shoulder, the nail gun's motor, the flamer's tank) sit off to the right so you look past them; the long
// shoulder guns sit a touch lower so the stock doesn't fill the bottom of the view.
const ADS_POSE = {
  shotgun: [0.12, -0.3, -0.5], liberty: [0.12, -0.3, -0.5], rocket: [1.5, -0.75, 0.3], nailgun: [1.05, -0.55, 0],
  flamer: [0.9, -0.45, 0], harpoon: [0, -0.1, 0.9], flare: [0.15, -0.1, 0],
};
// A magazine reload off your vest, on the dash reload's timeline: the hand's trip down to your chest and back is
// short, so it spends far less of the reload out of sight. [vest time, dash-reload time] pairs.
const BODY_TIME = [[0, 0], [0.04, 0.12], [0.18, 0.3], [0.24, 0.45], [0.42, 0.62], [0.52, 0.72], [0.6, 0.8], [0.74, 0.92], [0.84, 0.94], [1, 1]];
const bodyTime = (t) => { for (let k = 1; k < BODY_TIME.length; k++) { const [a0, b0] = BODY_TIME[k - 1], [a1, b1] = BODY_TIME[k]; if (t <= a1) return b0 + ((t - a0) / (a1 - a0)) * (b1 - b0); } return 1; };
const reloadPose = (id) => RELOAD_POSE[id] || (MAG_RELOAD[id] ? RELOAD_POSE.mag : RELOAD_POSE.other);

// The roof gun's hold: [x, y, z, scale, yaw, roll, pitch], dead ahead and low, braced on its pintle.
const ROOF_HOLD = [0.4, -2.0, -5.2, 0.78, 0.02, 0, 0.02];
// The windshield: your own rounds go through it and leave holes (where your aim crosses the glass), rounds coming
// in crack it, and each wears it down; worn through, it shatters and falls out. hit: wear per shot or crack.
const GLASS = { hp: 100, hit: { shoot: 2.5, nail: 1.5, shotgun: 9, flare: 20, rocket: 35, harpoon: 30, flame: 0.4, crack: 10 } };
// Changing guns: the one in your hands goes down (easing into the drop), then the new one comes up (easing out of
// it). t: the whole change, seconds; down: the share of it spent lowering; drop: how far out of sight.
const SWITCH = { t: 0.42, down: 0.42, drop: 5.5 };
const FIRE_EVENTS = ['shoot', 'shotgun', 'nail', 'flame', 'harpoon', 'rocket', 'flare'];

// Small canvas textures for the muzzle flash (a spiky star) and smoke puffs (a soft blob).
const Cockpit3DTex = {
  make(draw) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; draw(cv.getContext('2d')); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; },
  // A few ragged flashes to pick from at random: a white-hot core, then a fringe of short, uneven flame tongues
  // fading through yellow to a dull orange. No regular star points, which read as a cartoon.
  flash() {
    if (!this._f) this._f = [0, 1, 2, 3].map(() => this.make((g) => {
      const c = 32, blob = (x, y, r, a, inner) => {
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, inner); rg.addColorStop(1, `rgba(255,120,30,0)`);
        g.globalAlpha = a; g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      };
      g.globalCompositeOperation = 'lighter';
      const tongues = 5 + Math.floor(Math.random() * 4);
      for (let k = 0; k < tongues; k++) { // uneven flame tongues out from the core
        const a = Math.random() * Math.PI * 2, len = 8 + Math.random() * 18;
        for (let s2 = 0; s2 < 5; s2++) { const f = s2 / 5, wob = (Math.random() - 0.5) * 0.35; blob(c + Math.cos(a + wob) * len * f, c + Math.sin(a + wob) * len * f, (1 - f) * 7 + 2, 0.35, 'rgba(255,190,90,0.9)'); }
      }
      blob(c, c, 16, 0.8, 'rgba(255,230,170,1)');
      blob(c, c, 7, 1, 'rgba(255,255,245,1)'); // white-hot core
    }));
    return this._f;
  },
  // The plume blown forward out of the barrel: brightest at the muzzle, ragged and orange towards its tip.
  plume() {
    return this._pl || (this._pl = this.make((g) => {
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 40; k++) {
        const f = Math.random(), x = 32 + (Math.random() - 0.5) * 18 * f, y = 60 - f * 56, r = (1 - f) * 10 + 3;
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, f < 0.3 ? 'rgba(255,240,200,0.8)' : 'rgba(255,170,70,0.5)'); rg.addColorStop(1, 'rgba(255,110,30,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }));
  },
  puff() {
    return this._p || (this._p = this.make((g) => {
      for (let k = 0; k < 6; k++) {
        const x = 22 + Math.random() * 20, y = 22 + Math.random() * 20, r = 12 + Math.random() * 8, rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
      }
    }));
  },
};

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
    this.wx = Weather3D.build(this, race.weather);
    this.resize(this.canvas.clientWidth || window.innerWidth, this.canvas.clientHeight || window.innerHeight);
  }

  // ---------- World ----------

  // Ramps and obstacles from the track. Obstacles that get destroyed (barrels, scattered tyres) vanish in a
  // shower of debris.
  buildFeatures() {
    const tr = this.race.track;
    this.featureMeshes = [];
    for (const r of tr.ramps || []) {
      const m = Models.ramp(r.len, r.w, r.h);
      m.position.set(r.x, 0, r.y);
      m.rotation.y = -r.ang;
      this.scene.add(m);
    }
    for (const o of tr.obstacles || []) {
      const m = Models.obstacle(o.kind);
      m.position.set(o.x, 0, o.y);
      m.rotation.y = -o.ang + (o.kind === 'barrier' ? 0 : o.spin);
      this.scene.add(m);
      this.featureMeshes.push({ o, m, alive: true });
    }
  }

  updateFeatures() {
    for (const f of this.featureMeshes || []) {
      if (f.alive && !f.o.alive) {
        f.alive = false;
        f.m.visible = false;
        this.burst(f.o.x, f.o.y, f.o.kind === 'barrels', true); // barrels go up in flames; tyres just scatter
      }
    }
  }

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
      this.buildFeatures();
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
    this.buildGantry({ text: 'DEATH ROW DERBY', bg: '#111', fg: '#ffd23f', edge: '#ffffff' }, bio.night ? '#2ff3ff' : '#333', bio.night);
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
    this.rivalSeed = 1 + Math.floor(Math.random() * 1e6); // a different field of heaps every race
    for (const car of this.race.cars) {
      if (car === this.race.player) {
        // Your own car is just a shell (hood, rear deck, wheels); the cockpit interior fills the middle.
        this.playerGroup = new THREE.Group();
        this.playerGroup.add(Models.car(Object.assign({ color: car.color, accent: car.accent }, this.look3d, { shell: true })));
        this.scene.add(this.playerGroup);
        continue;
      }
      const g = new THREE.Group();
      // Rivals: every one a different heap. Bosses drive their own signature car.
      const k = this.carMeshes.size;
      // Rivals keep their look for the race (a vendetta car comes back looking the same).
      if (!car.bossLook) car.look3d = car.vendLook ? Object.assign({}, car.vendLook, { color: car.color, accent: car.accent, weapon: car.weapon, tyreArmor: !!car.armorTyres }) : this.rivalLook(car, k);
      const model = car.bossLook
        ? Models.car(Object.assign({ color: car.color, accent: car.accent, weapon: car.weapon, number: 1, crew: { gunner: !!car.weapon, seed: k * 13 + 5, helmet: true } }, car.bossLook, { tyreArmor: !!car.armorTyres }))
        : Models.car(car.look3d);
      if (car.bossLook) model.scale.setScalar(1.08);
      g.add(model);
      const box = new THREE.Box3().setFromObject(model);
      const tag = canvasTex(256, 64);
      // Constant on-screen size so tags stay readable without filling the view up close.
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tag.tex, depthTest: false, transparent: true, sizeAttenuation: false }));
      sprite.scale.set(0.15, 0.0375, 1);
      sprite.position.set(0, 19, 0);
      g.add(sprite);
      this.scene.add(g);
      this.carMeshes.set(car, { g, model, bodyMat: model.userData.bodyMat, wheels: model.userData.wheels, tag, sprite, lastTag: '',
        mo: { pvx: car.vx, pvy: car.vy, roll: 0, vroll: 0, pitch: 0, vpitch: 0, hp: car.hp, hop: 0, spin: 0, seed: Math.random() * 10 },
        dmg: { box, t: 0, queue: [], glass: 0, shed: false } });
      car.hits = [];
    }
  }

  // A rival's car: a body style, a bolt-on kit, paint scheme, finish, dirt, wheels and number, all mixed per car.
  rivalLook(car, k) {
    const rng = mulberry32(((this.rivalSeed || 7) * 131 + k * 977) >>> 0), pick = (a) => a[Math.floor(rng() * a.length)];
    const styles = ['comet', 'brick', 'wasp', 'phantom', 'sedan', 'pickup', 'van'];
    const style = styles[(k + Math.floor(rng() * styles.length)) % styles.length];
    const roof = car.weapon === 'rocket' ? 'none' : pick(['stock', 'stock', 'none', 'rails', 'rack', 'lightbar', 'cage']);
    return {
      style, color: car.color, accent: car.accent, weapon: car.weapon, number: 10 + ((k * 37) % 89), crew: { gunner: !!car.weapon, seed: (this.rivalSeed || 7) + k * 13 },
      bumper: pick(['stock', 'stock', 'pushbar', 'bullbar', 'plow']), roof,
      twoTone: pick(['none', 'none', 'roof', 'hood', 'lower']), paint2: pick(['#2a2a2e', '#d8cfb0', '#6f6f68', '#c9a443', '#5a6b3a']),
      finish: pick(['gloss', 'matte', 'rusty', 'patched', 'gloss']), grime: pick(['clean', 'dirty', 'dirty', 'filthy']),
      livery: pick(['stencil', 'roundel', 'none', 'stripes', 'flames', 'skull']), rims: pick(['spoke5', 'steel', 'black', 'slotted', 'wire']),
      exhaust: pick(['single', 'twin', 'side']), tyreArmor: !!car.armorTyres,
      roofHatch: car.weapon === 'rocket', roofHatchOpen: car.weapon === 'rocket', // the rocket gunner works through a hatch in the roof: a way in for a grenade
    };
  }

  // ---------- Damage you can see ----------

  // Hits pile up on a rival and are applied in batches: the bodywork dents in where it was struck (pushed in and
  // scuffed black), the glass cracks as the car weakens, and bolt-ons are shed when it is nearly done for.
  updateDamage(car, m, dt) {
    const D = m.dmg;
    if (car.hits && car.hits.length) { D.queue.push(...car.hits); car.hits.length = 0; }
    D.t -= dt;
    if (D.queue.length && D.t <= 0) {
      D.t = 0.15;
      this.applyHits(m, car, D.queue.splice(0, 6));
    }
    const frac = car.hp / (car.stats.maxHp || 100), glass = m.model.userData.glassMat;
    const stage = frac <= 0.25 ? 2 : frac <= 0.6 ? 1 : 0;
    // The paint dulls and blackens as the car is knocked about.
    if (m.bodyMat && D.paint == null) D.paint = m.bodyMat.color.clone();
    const wear = 1 - clamp(frac, 0, 1);
    if (m.bodyMat && Math.abs((D.wear || 0) - wear) > 0.02) { D.wear = wear; m.bodyMat.color.copy(D.paint).lerp(new THREE.Color('#2a2018'), wear * 0.45); }
    if (glass && stage > D.glass) {
      D.glass = stage;
      glass.map = DECALS.get(stage === 2 ? 'glassshot' : 'glasscrack');
      glass.needsUpdate = true;
    }
    // The glass goes altogether when the driver's shot through it, or the car's all but finished: a spray of
    // bright shards and the cabin open to the air.
    if (glass && !D.shattered && ((car.downed && car.downed.how === 'driver') || frac <= 0.08 || car.ejectBlast)) {
      D.shattered = true;
      glass.transparent = true; glass.opacity = 0.1; glass.depthWrite = false; glass.needsUpdate = true;
      for (let k = 0; k < 14 && this.sparks.length < this.sparkPool.length; k++) {
        const a = car.heading + (Math.random() - 0.5) * 3, sp = 30 + Math.random() * 70;
        this.sparks.push({ x: car.x + (Math.random() - 0.5) * 12, y: car.y + (Math.random() - 0.5) * 12, z: 8 + Math.random() * 3, vx: car.vx + Math.cos(a) * sp, vy: car.vy + Math.sin(a) * sp, vz: 20 + Math.random() * 50, t: 0, life: 0.5 + Math.random() * 0.4, col: '#d8f0ff' });
      }
      const d = Math.hypot(car.x - this.race.player.x, car.y - this.race.player.y);
      Sound.play({ type: 'shatter', vol: clamp(1 - d / 700, 0.15, 1) });
    }
    if (!D.shed && frac <= 0.3) { // nearly done: the bolt-ons tear off
      D.shed = true;
      const loose = [];
      m.model.traverse((o) => { if (o.userData.kit && !o.userData.loose) loose.push(o); });
      for (const o of loose) this.shedPart(o, car);
    }
  }

  // Each hit is traced onto the real bodywork: a ray from the side it came from finds the panel it struck.
  // Gunfire leaves a bullet hole; blasts, rams and walls stave the panel in and scorch it black around the dent.
  applyHits(m, car, hits) {
    const D = m.dmg, model = m.model;
    const meshes = [];
    model.traverse((o) => { if (o.isMesh && o.userData.sculpted && !o.userData.loose) meshes.push(o); });
    if (!meshes.length) return;
    model.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(), box = D.box, size = box.getSize(new THREE.Vector3());
    const dirty = new Set();
    for (const h of hits) {
      const big = h.kind === 'blast' || h.kind === 'ram' || h.kind === 'wall';
      // From outside the car on the side the hit came from, aimed at a point inside the body.
      const la = h.ang - car.heading, out = new THREE.Vector3(Math.cos(la), 0, Math.sin(la));
      const aim = new THREE.Vector3((Math.random() - 0.5) * size.x * 0.5, size.y * (0.25 + Math.random() * 0.3), (Math.random() - 0.5) * size.z * 0.3);
      const from = aim.clone().addScaledVector(out, 40).add(new THREE.Vector3(0, 4, 0));
      ray.set(model.localToWorld(from.clone()), model.localToWorld(aim.clone()).sub(model.localToWorld(from.clone())).normalize());
      const hit = ray.intersectObjects(meshes, false)[0];
      if (!hit || !hit.face) continue;
      const P = model.worldToLocal(hit.point.clone()), N = hit.face.normal.clone(); // meshes sit at the model origin, so face normals are model-local
      // Dent: push the surface in along the panel normal, falling off with distance.
      const r = big ? Math.min(5, 2.8 + h.amt * 0.04) : 1.2, depth = big ? Math.min(1.5, 0.6 + h.amt * 0.025) : 0.12;
      for (const mesh of meshes) {
        const geo = mesh.geometry, pos = geo.attributes.position, col = geo.attributes.color;
        if (!geo.userData.orig) geo.userData.orig = Float32Array.from(pos.array);
        const O = geo.userData.orig, R2 = (r * 1.6) ** 2;
        let touched = false;
        for (let i = 0; i < pos.count; i++) {
          const dx = pos.getX(i) - P.x, dy = pos.getY(i) - P.y, dz = pos.getZ(i) - P.z, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= R2) continue;
          const dd = Math.sqrt(d2), f = dd < r ? (1 - dd / r) ** 2 : 0, soot = 1 - dd / (r * 1.6);
          let nx = pos.getX(i) - N.x * depth * f, ny = pos.getY(i) - N.y * depth * f, nz = pos.getZ(i) - N.z * depth * f;
          const ox = nx - O[i * 3], oy = ny - O[i * 3 + 1], oz = nz - O[i * 3 + 2], ol = Math.hypot(ox, oy, oz);
          if (ol > 1.8) { nx = O[i * 3] + (ox / ol) * 1.8; ny = O[i * 3 + 1] + (oy / ol) * 1.8; nz = O[i * 3 + 2] + (oz / ol) * 1.8; } // never crushed right through
          pos.setXYZ(i, nx, ny, nz);
          if (col && big) { const k = Math.max(0.15, 1 - 0.7 * soot * soot); col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k); }
          touched = true;
        }
        if (touched) dirty.add(mesh);
      }
      // A mark on the surface: bullet hole or scorch.
      const mark = this.damageDecal(big);
      mark.position.copy(P).addScaledVector(N, 0.06 - depth * 0.8);
      mark.lookAt(mark.position.clone().add(N));
      mark.rotateZ(Math.random() * TAU);
      if (big) mark.scale.setScalar(r * 0.55);
      model.add(mark);
      (D.marks = D.marks || []).push(mark);
      if (D.marks.length > 36) model.remove(D.marks.shift());
    }
    for (const mesh of dirty) {
      const geo = mesh.geometry;
      geo.attributes.position.needsUpdate = true;
      if (geo.attributes.color) geo.attributes.color.needsUpdate = true;
      geo.computeVertexNormals();
    }
  }

  // Shared decal materials: a ragged bullet hole and a soft soot scorch.
  damageDecal(big) {
    if (!this.decalMats) {
      const tex = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
      const hole = tex((g) => {
        g.fillStyle = 'rgba(160,150,140,0.9)'; g.beginPath(); g.arc(32, 32, 14, 0, TAU); g.fill(); // bare metal rim
        g.fillStyle = '#050505'; g.beginPath();
        for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU, r = 7 + Math.random() * 4; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
        g.fill();
      });
      const scorch = tex((g) => {
        const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
        gr.addColorStop(0, 'rgba(8,6,4,0.95)'); gr.addColorStop(0.5, 'rgba(20,14,10,0.7)'); gr.addColorStop(1, 'rgba(20,14,10,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      });
      const mk = (map) => new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
      this.decalMats = { hole: mk(hole), scorch: mk(scorch), geo: new THREE.PlaneGeometry(1, 1) };
    }
    const m = new THREE.Mesh(this.decalMats.geo, big ? this.decalMats.scorch : this.decalMats.hole);
    if (!big) m.scale.setScalar(0.95);
    m.userData.noGrime = true;
    return m;
  }

  // A bolt-on tears off: it tumbles away from the car and lies in the road for a while.
  shedPart(o, car) {
    o.userData.loose = true;
    o.updateMatrixWorld(true);
    const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
    o.matrixWorld.decompose(wp, wq, ws);
    o.removeFromParent();
    const holder = new THREE.Group();
    holder.position.copy(wp); holder.quaternion.copy(wq); holder.scale.copy(ws);
    o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
    holder.add(o);
    this.scene.add(holder);
    const a = Math.random() * TAU;
    (this.looseParts = this.looseParts || []).push({ obj: holder, vx: car.vx * 0.6 + Math.cos(a) * 40, vz: car.vy * 0.6 + Math.sin(a) * 40, vy: 30 + Math.random() * 30,
      sx: (Math.random() - 0.5) * 6, sy: (Math.random() - 0.5) * 6, t: 0 });
    this.sparkAt(car.x, car.y, 8);
  }

  updateLooseParts(dt) {
    if (!this.looseParts) return;
    for (const p of this.looseParts) {
      p.t += dt;
      const o = p.obj;
      if (o.position.y > 0.5 || p.vy > 0) {
        p.vy -= 160 * dt;
        o.position.x += p.vx * dt; o.position.z += p.vz * dt; o.position.y = Math.max(0.5, o.position.y + p.vy * dt);
        o.rotation.x += p.sx * dt; o.rotation.z += p.sy * dt;
        if (o.position.y <= 0.5 && p.vy < 0) { p.vy = -p.vy * 0.3; p.vx *= 0.5; p.vz *= 0.5; p.sx *= 0.5; p.sy *= 0.5; if (Math.abs(p.vy) < 8) p.vy = 0; }
      }
    }
    this.looseParts = this.looseParts.filter((p) => {
      if (p.t < 12) return true;
      this.scene.remove(p.obj);
      return false;
    });
  }

  // ---------- Interior ----------

  // People in your car: your driver at the wheel (a recruited inmate, js/crew.js; arms re-posed every frame so the
  // hands stay on the rim as it turns, and the warden's collar round their neck, its light blinking), and your own
  // body in the passenger seat (no head: the camera is your head) for when you look down.
  buildCrew(I) {
    const cab = this.look3d.cabin || {}, inmate = String(cab.inmate || '4471'), seed = (parseInt(inmate, 10) || 4471) * 3 + 11;
    const who = this.combat.crew || Crew.current(this.combat.build);
    // Legs posed for this car: the driver's feet out on the floor under the dash with the knees low enough to clear
    // the wheel's rim; yours back in the ankle cuff of the shackle bolted to your footwell.
    const drv = People.figure({ seed: who.seed, role: 'driver', arms: 'none', cell: 0.08, number: who.number, leg: { knee: [3.6, 0.35], ankle: [6.84, -2.0] } });
    drv.position.set(-1.9, 4.45, -4.5);
    I.add(drv);
    const me = People.figure({ seed: seed + 1, role: 'passenger', head: false, arms: 'none', cell: 0.08, number: inmate, looks: { suit: '#a8521e' }, leg: { knee: [3.79, 1.43], ankle: [4.45, -2.0] } });
    me.position.set(EYE.x - 0.95, 4.45, EYE.z);
    I.add(me);
    // The collar: a steel band round the neck with a box on the side and a red light.
    const d = drv.userData, steel = LP.mat('#6a6e72', { metalness: 0.7, roughness: 0.4 });
    const collar = LP.mesh(new THREE.TorusGeometry(0.5, 0.13, 6, 16).rotateX(Math.PI / 2), steel, 0.12, 5.0, 0);
    d.torso.add(collar);
    d.torso.add(LP.box(0.36, 0.32, 0.3, LP.mat('#1c1c1e', { metalness: 0.4 }), 0.1, 5.0, -0.58));
    const led = LP.mesh(new THREE.SphereGeometry(0.07, 6, 5), LP.glow('#ff2a1a', 2.5), 0.1, 5.05, -0.75);
    d.torso.add(led);
    // Yours too, under your chin: you can't see it, but its light blinks red on your hands and the dash, out of step
    // with theirs.
    const mt = me.userData.torso || me;
    this.meTorso = mt;
    if (me.userData.patch) me.userData.patch.visible = false; // (your vest carries your number)
    this.meBuild = People.BUILD[(me.userData.looks || {}).build] || 1;
    mt.add(LP.mesh(new THREE.TorusGeometry(0.5, 0.13, 6, 16).rotateX(Math.PI / 2), steel, 0.12, 5.0, 0));
    mt.add(LP.box(0.36, 0.32, 0.3, LP.mat('#1c1c1e', { metalness: 0.4 }), 0.55, 4.95, 0));
    const myLed = LP.mesh(new THREE.SphereGeometry(0.08, 6, 5), LP.glow('#ff2a1a', 2.5), 0.74, 5.0, 0);
    mt.add(myLed);
    const glow = new THREE.PointLight('#ff2a1a', 0, 9, 2);
    glow.position.set(1.4, 4.7, 0);
    mt.add(glow);
    myLed.userData.glow = glow;
    // Fists on the rim at ten to two (in the wheel's own frame its +x is the driver's left), riding the wheel.
    const M = d.M, fists = [];
    for (const [a, side] of [[0.55, -1], [Math.PI - 0.55, 1]]) {
      const f = new THREE.Group(), sc = new Sculpt('person:fist:' + side, 0.05);
      People.fist(sc, M, [0, 0, -0.15], [0, 0, 1], side);
      sc.build(f);
      f.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0);
      this.wheel.add(f);
      fists.push(f);
    }
    this.myCrew = { drv, me, I, fists, led, myLed, arms: People.liveArms(I, d.armMat || M.suit, 2), glance: 0, glanceT: 3 };
    // Friendly fire (js/crew.js): is the crosshair on your driver right now? Head or body, and how squarely (the
    // share of a shot's pellets that go into them).
    const ray = new THREE.Ray(), v = new THREE.Vector3(), dir = new THREE.Vector3();
    this.combat.friendlyFire = () => {
      if (!this.camera) return null;
      this.camera.getWorldPosition(ray.origin); this.camera.getWorldDirection(dir); ray.direction.copy(dir);
      const parts = [['head', d.head.localToWorld(v.set(0.3, 0.95, 0)).clone(), 1.05], ['body', d.torso.localToWorld(v.set(0.05, 3.45, 0)).clone(), 1.7], ['body', d.torso.localToWorld(v.set(0.12, 2.0, 0)).clone(), 1.5]];
      for (const [part, c, r] of parts) {
        if (c.clone().sub(ray.origin).dot(dir) < 0) continue;
        const miss = ray.distanceToPoint(c);
        if (miss < r) return { part, cover: clamp(1.15 - miss / r, 0.35, 1) };
      }
      return null;
    };
  }

  animateMyCrew(dt, t) {
    const C = this.myCrew;
    if (!C) return;
    const d = C.drv.userData, I = C.I, p = this.race.player;
    C.led.visible = Math.floor(t * 1.5) % 2 === 0; // the collar's light
    if (C.myLed) { C.myLed.visible = !C.led.visible; C.myLed.userData.glow.intensity = C.myLed.visible ? 6 : 0; }
    // Head: watching the road, a glance at the mirror now and then, a look over at you when you open fire or give
    // an order.
    C.glanceT -= dt;
    if (C.glanceT <= 0) { C.glanceT = 2.5 + Math.random() * 5; C.glance = Math.random() < 0.5 ? 0.55 : -0.3; C.glanceDur = 0.6 + Math.random() * 0.6; }
    if (this.combat.lastFire < 0.05 && Math.random() < 0.02) { C.glance = 0.7; C.glanceDur = 0.5; }
    const O = this.combat.driver && this.combat.driver.order;
    if (O && O !== C.lastOrder) { C.lastOrder = O; C.glance = 0.75; C.glanceDur = 0.45; }
    C.glanceDur = (C.glanceDur || 0) - dt;
    const want = C.glanceDur > 0 ? C.glance : 0;
    C.yaw = Motion.spring(C.yawS || (C.yawS = { x: 0, v: 0 }), want, dt, 11); // a glance: quick, but it starts and settles
    const hurt = this.combat.driverHurtT || 0, dead = this.combat.ownDriverDead;
    C.slump = dead ? Math.min(1, (C.slump || 0) + dt * 2.5) : 0;
    const k = C.slump * C.slump, jolt = hurt > 0 ? Math.sin(hurt * 40) * 0.25 * hurt : 0;
    // The body rides the car on springs: it's pushed to the outside of a corner and thrown forward under braking
    // (back under power), lagging a touch behind the car and settling, and breathes.
    const acc = this.acc || { lat: 0, fwd: 0 };
    const side = Motion.spring(C.sideS || (C.sideS = { x: 0, v: 0 }), clamp(-acc.lat * 0.00008, -0.12, 0.12), dt, 7);
    const pitch = Motion.spring(C.pitchS || (C.pitchS = { x: 0, v: 0 }), clamp(acc.fwd * 0.00005, -0.08, 0.08), dt, 6);
    const breathe = Math.sin(t * 1.4) * 0.012;
    d.head.rotation.set(Math.sin(t * 7) * 0.02 * Math.min(1, p.speed / 300) + jolt - side * 0.4, C.yaw * (1 - k), Math.sin(t * 0.7) * 0.03 - k * 0.7 - pitch * 0.5); // (the head keeps level against the lean)
    d.torso.rotation.x = side + jolt * 0.5; // pushed out by the corner (and flinching)
    d.torso.rotation.z = -k * 0.55 + pitch + breathe; // slumped over the wheel; or pitched by the brakes, and breathing
    // Arms: shoulder to the fist on the rim, elbows down and out.
    C.drv.updateMatrixWorld(true);
    this.wheel.updateMatrixWorld(true);
    d.shoulders.forEach((sh, k) => {
      const S = I.worldToLocal(d.torso.localToWorld(new THREE.Vector3(...sh)));
      const W = I.worldToLocal(C.fists[k].localToWorld(new THREE.Vector3(-0.15, -0.1, -0.45)));
      People.poseArm(C.arms[k], S, W, new THREE.Vector3(-0.2, -1, (k === 0 ? -1 : 1) * 0.6));
    });
  }

  buildInterior() {
    const { group: I, refs } = Models.interior(this.race.player.color, { cabin: this.look3d.cabin });
    this.ornament = refs.ornament ? refs.ornament.userData.sway : null;
    this.roofHatch = refs.roofHatch;
    this.wheel = refs.wheel;
    this.nadeMeshes = refs.nades;
    this.buildLoadout(I);
    this.buildCrew(I);
    this.buildBodyAmmo(this.combat.build); // (on your torso, so after the crew)
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
    this.windshield = refs.windshield;
    this.glass = { hp: GLASS.hp, gone: false }; // a new windshield every race
    this.buildHatch(I);

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
  // (RACK_SPAN: the length of door the rack guns can use, between the seat's bolster and the steering wheel.)
  buildLoadout(I) {
    const b = this.combat.build;
    const hooks = [7.3, 6.1, 4.9];
    this.rackGuns = b.rack.map((w, i) => {
      const m = Models.gunKit(Models.gunFinish(Models.modVisuals(Models.weapon(w.id), w.id, w.mods, false), (this.look3d.gunFinish || {})[w.id]), w.id, (this.look3d.gunKit || {})[w.id], (this.look3d.patchSeed || {})[w.id]);
      if (w.id === 'rocket') m.scale.setScalar(0.8);
      else if (w.id === 'flamer' || w.id === 'harpoon') m.scale.setScalar(0.85);
      else if (['carbine', 'liberty', 'lmg', 'pangun'].includes(w.id)) m.scale.setScalar(0.7);
      else if (w.id === 'typewriter') m.scale.setScalar(0.82);
      m.position.set(-0.9, hooks[i] || 4.9, -7.15); // resting on the J hooks, clear of the door bars and the seat's bolster
      m.rotation.y = -Math.PI / 2;
      I.add(m);
      // Fit it between the driver's seat back and the wheel's rim: long guns shrink a little, and sit centred.
      const fit = () => { I.updateMatrixWorld(true); return new THREE.Box3().setFromObject(m).applyMatrix4(new THREE.Matrix4().copy(I.matrixWorld).invert()); };
      let bb = fit();
      const room = RACK_SPAN[1] - RACK_SPAN[0], len = bb.max.x - bb.min.x;
      if (len > room) { m.scale.multiplyScalar(room / len); bb = fit(); }
      m.position.x += (RACK_SPAN[0] + RACK_SPAN[1]) / 2 - (bb.min.x + bb.max.x) / 2;
      return m;
    });
    this.buildAmmoRack(I, b);
    this.hangers = [];
    this.bobNecks = [];
    // Hanging trinkets: their cords start out of sight behind the rear-view mirror, then along the bottom edge
    // of the driver's sun visor, each turned to face you. Dash trinkets are packed along rows on the dash top,
    // clear of the screens, the ornament, the steering column and the sills, and kept under the windshield.
    const vb = VISOR.driver.bottom, hang = [[3.3, 11.3, 0.9], [3.3, 11.3, 0.25], [3.3, 11.3, -0.45], [3.3, 11.3, -1.1], [3.3, 11.3, 1.55],
      [vb[0] + 0.05, vb[1] + 0.1, -3.0], [vb[0] + 0.05, vb[1] + 0.1, -3.9], [vb[0] + 0.05, vb[1] + 0.1, -4.8], [vb[0] + 0.05, vb[1] + 0.1, -5.7]];
    // Rows: x, then z from start to end. Your side has a back row, a front row and the cowl under the glass; the
    // driver's side has one row beyond the gauge-cluster hood. Rows are shared, so the packing never overlaps.
    const rows = {
      stand: [[6.1, 7.3, 3.6], [4.7, 7.0, 2.3], [6.6, -4.3, -7.3]],
      flat: [[7.4, 7.3, 3.6], [6.6, -4.3, -7.3], [4.7, 7.0, 2.3], [6.1, 7.3, 3.6]],
    };
    const cursor = new Map(); // row -> next free z
    const surfaces = [];
    I.updateMatrixWorld(true);
    I.traverse((o) => { if (o.isMesh && !(o.material && o.material.transparent)) surfaces.push(o); });
    const ray = new THREE.Raycaster(), bb = new THREE.Box3(), v3 = new THREE.Vector3();
    const groundAt = (x, z) => { // height of whatever the cabin has under (x, z), in the cabin's own space
      const from = I.localToWorld(new THREE.Vector3(x, 14, z)), to = I.localToWorld(new THREE.Vector3(x, 0, z));
      ray.set(from, to.sub(from).normalize());
      const hit = ray.intersectObjects(surfaces, false)[0];
      return hit ? I.worldToLocal(hit.point.clone()).y : 6.8;
    };
    const local = (m) => { I.updateMatrixWorld(true); bb.setFromObject(m); return bb.applyMatrix4(new THREE.Matrix4().copy(I.matrixWorld).invert()); };
    let hi = 0;
    for (const id of b.trinkets) {
      const m = Models.trinket(id), mount = m.userData.mount;
      if (mount === 'hang') {
        const at = hang[hi++ % hang.length], pivot = new THREE.Group();
        pivot.position.set(...at);
        m.rotation.y = Math.atan2(EYE.x - at[0], EYE.z - at[2]); // its face (+Z) towards you
        m.scale.setScalar(id === 'dice' ? 0.65 : 0.8);
        pivot.add(m);
        pivot.userData.swing = 0.8 + 0.4 * ((hi * 37) % 10) / 10;
        this.hangers.push(pivot);
        I.add(pivot);
        continue;
      }
      I.add(m);
      m.scale.setScalar(1);
      m.position.set(0, 0, 0);
      const h = local(m).getSize(v3).y;
      let sc = Math.min(0.55, (mount === 'stand' ? 1.6 : 1.9) / Math.max(h, 0.01));
      m.scale.setScalar(sc);
      // Find a row with room, packing along it with a small gap.
      let placed = false;
      for (const r of rows[mount]) {
        const [x, z0, z1] = r, dir = Math.sign(z1 - z0), key = r.join();
        const zc = cursor.has(key) ? cursor.get(key) : z0;
        m.position.set(x, 0, 0);
        m.rotation.y = Math.atan2(-(EYE.z - zc), EYE.x - x) + ((id.length * 0.37) % 0.5) - 0.25; // turned to face you, give or take
        const box = local(m), half = (box.max.z - box.min.z) / 2, mid = (box.max.z + box.min.z) / 2;
        const z = zc + dir * half;
        if ((z1 - (z + dir * half)) * dir < 0) continue; // no room left on this row
        m.position.set(x, 0, z - mid);
        cursor.set(key, z + dir * (half + 0.12));
        placed = true;
        break;
      }
      if (!placed) m.position.set(4.7, 0, 5);
      m.position.y = groundAt(m.position.x, m.position.z);
      // Keep it under the glass: nudge it back from the windshield, then shrink it if it still touches.
      for (let k = 0; k < 30; k++) {
        const box = local(m);
        if (box.max.y < WINDSHIELD.yAt(box.max.x) - 0.12) break;
        if (k < 10) m.position.x -= 0.06;
        else { sc *= 0.95; m.scale.setScalar(sc); }
        m.position.y = groundAt(m.position.x, m.position.z);
      }
      if (m.userData.neck) this.bobNecks.push(m.userData.neck);
    }
  }

  // The ammo board on the dash (over the glovebox): your spare ammo as real objects, one row per rack weapon.
  // Items vanish as the reserve drops and come back when you buy more.
  buildAmmoRack(I, b) {
    // A board on the dash in front of you (see the end of this function).
    const R = new THREE.Group(), rows = b.rack.length, W = 1.95, rowH = 1.1;
    const webbing = LP.mat('#3a3a2a', { roughness: 1 }), board = LP.mat('#6a6448', { roughness: 0.95 }), steel = LP.mat('#8a8f94', { metalness: 0.8 }); // olive canvas so dark mags stand out
    const H = rows * rowH + 0.3;
    // Per weapon: how many items, items per line, spacing, scale. Shells and flares sit in two lines.
    const PER = { pistol: [6, 6, 0.3, 0.75], smg: [5, 5, 0.38, 0.68], shotgun: [10, 5, 0.38, 0.85], rocket: [4, 4, 0.46, 0.4], flare: [8, 4, 0.46, 0.8], nailgun: [6, 6, 0.32, 0.7], flamer: [3, 3, 0.6, 0.6], harpoon: [4, 4, 0.46, 0.55],
      carbine: [5, 5, 0.38, 0.62], liberty: [6, 6, 0.3, 0.75], typewriter: [3, 3, 0.62, 0.36], lmg: [2, 2, 0.9, 0.42], pangun: [2, 2, 0.95, 0.36] };
    // The board, its screws, brackets and the elastic loops, as one rounded sculpt per layout.
    const lineCounts = b.rack.map((w) => Math.ceil(PER[w.id][0] / PER[w.id][1]));
    const bs = new Sculpt('ammoboard:' + lineCounts.join(''), 0.03);
    bs.add(board, SDF.box([W + 0.2, H, 0.12], 0.05, [0, 0, -0.05]), 0.02);
    for (const x of [-W / 2, W / 2]) for (const y of [H / 2 - 0.12, -H / 2 + 0.12]) bs.add(steel, SDF.ellipsoid([0.07, 0.07, 0.035], [x, y, 0.02]), 0.01); // screw heads
    for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) bs.add(steel, SDF.box([0.18, 0.16, 0.24], 0.06, [x, H / 2 - 0.1, -0.2]), 0.04); // brackets to the door
    lineCounts.forEach((lines, r) => {
      const yc = H / 2 - 0.15 - rowH / 2 - r * rowH;
      bs.add(webbing, SDF.box([W, 0.12, 0.08], 0.035, [0, yc - (lines > 1 ? 0.5 : 0.2), 0.3]), 0.01); // elastic loop
      for (const x of [-W / 2 + 0.02, W / 2 - 0.02]) bs.add(webbing, SDF.box([0.06, 0.12, 0.36], 0.025, [x, yc - (lines > 1 ? 0.5 : 0.2), 0.13]), 0.02); // stitched to the board
    });
    bs.build(R);
    this.ammoRack = b.rack.map((w, r) => {
      const [n, per, gap, sc] = PER[w.id], yc = H / 2 - 0.15 - rowH / 2 - r * rowH, lines = Math.ceil(n / per);
      const items = [];
      for (let k = 0; k < n; k++) {
        const col = k % per, line = Math.floor(k / per);
        const it = Models.ammoItem(w.id, k);
        it.position.set(-((per - 1) * gap) / 2 + col * gap, yc + (lines > 1 ? (0.5 - line) * 0.52 : 0), 0.16);
        it.scale.setScalar(sc * (lines > 1 ? 0.8 : 1));
        R.add(it);
        items.push(it);
      }
      return { items, wi: r, per: ['pistol', 'smg', 'nailgun', 'flamer', 'carbine', 'liberty', 'typewriter', 'lmg', 'pangun'].includes(w.id) ? weaponStats(w).mag : 1, shown: -1, hide: 0 };
    });
    // Strapped over the glovebox lid, right in front of your seat and facing you: a glance down shows what's left,
    // and your hand goes forward to it for each reload. A tall board (three guns) is scaled to fit the lid.
    const fit = Math.min(1, 2.6 / H);
    R.scale.setScalar(fit);
    R.rotation.order = 'YXZ';
    R.rotation.set(-0.12, -Math.PI / 2, 0); // its face towards you, the top leaning back against the dash a touch
    R.position.set(3.76, 4.95, 4.6);
    I.add(R);
    this.ammoRackGroup = R;
  }

  // The ammo you wear (WORN in js/combat.js): your vest (a cosmetic, js/vest.js) over the jumpsuit, one strap of
  // loops per rack gun across its front. Look down and you see what's left on you.
  buildBodyAmmo(b) {
    this.bodyAmmo = [];
    if (!this.meTorso) return;
    const cab = this.look3d.cabin || {};
    const V = Vest.build(cab.vest, b.rack, String(cab.inmate || '4471'), this.meBuild || 1);
    V.traverse((o) => { if (o.userData.collar) o.visible = false; }); // (under your chin: it would fill the view looking down)
    this.meTorso.add(V);
    this.vestGroup = V;
    this.bodyAmmo = V.userData.rows.map((items, r) => ({ items, wi: r, per: wornPer(b.rack[r]), shown: -1, hide: 0 }));
  }

  // Where the next round is, in the held gun's own coordinates (for the reloading hand): on the board on the dash, or
  // (body) on your chest rig.
  rackPoint(g, wi, body) {
    if (wi === this.combat.roofIdx) return new THREE.Vector3(-3.4, -2.6, 1.4); // up top: the ammo cans strapped to the roof beside the hatch
    if (body) { // your chest rig is right under your chin: the hand just drops below the view to it and comes back
      g.updateMatrixWorld(true);
      return g.worldToLocal(this.vmCamera.localToWorld(new THREE.Vector3(0.5, -4.4, -2.9)));
    }
    const rows = this.ammoRack, row = rows && rows.find((r) => r.wi === wi);
    if (!row) return null;
    const it = row.items[clamp((row.shown > 0 ? row.shown : 1) - 1, 0, row.items.length - 1)];
    // Measured in the car's own frame, both of them: the round on the board this frame, and the camera where it sat
    // in the car last frame. (Mixing this frame's world position with last frame's camera put the target metres
    // down the road at speed, and the arm stretched after it.)
    const pg = this.playerGroup;
    pg.updateWorldMatrix(true, true);
    const inCar = it.getWorldPosition(new THREE.Vector3()).applyMatrix4(pg.matrixWorld.clone().invert());
    const v = this.camInCar ? inCar.applyMatrix4(this.camInCar.clone().invert()) : it.getWorldPosition(new THREE.Vector3()).applyMatrix4(this.camera.matrixWorldInverse);
    v.z = Math.min(v.z, -2.5); // never behind you (the board is on the dash ahead of you: the hand goes right to it)
    g.updateMatrixWorld(true);
    return g.worldToLocal(this.vmCamera.localToWorld(v));
  }

  buildViewmodels() {
    const vm = new THREE.Group();
    this.vmCamera.add(vm);
    // One held model per weapon on your rack; the active one is shown.
    // [x, y, z, scale, yaw, roll, pitch]: low on the right, turned in towards the crosshair and canted a touch, so you
    // see the gun's left side and both hands round the grips.
    const HOLD = {
      pistol: [2.3, -1.3, -5.0, 1.1, 0.24, 0.05, 0.03], smg: [2.6, -1.6, -5.6, 1, 0.28, 0.05, 0.03], shotgun: [2.4, -1.5, -4.9, 0.85, 0.24, 0.06, 0.03],
      rocket: [3.0, -1.9, -5.6, 0.7, 0.18, 0.04, 0.02], flare: [2.4, -1.3, -5.1, 1, 0.26, 0.06, 0.02],
      nailgun: [2.4, -1.25, -5.0, 1, 0.26, 0.05, 0.03], flamer: [2.3, -1.45, -4.2, 0.95, 0.15, 0.04, 0.02], harpoon: [2.3, -1.4, -4.0, 0.95, 0.15, 0.04, 0.02],
      carbine: [2.4, -1.5, -5.0, 0.85, 0.24, 0.06, 0.03], liberty: [2.4, -1.45, -4.9, 0.8, 0.22, 0.06, 0.03], typewriter: [2.5, -1.5, -5.2, 0.9, 0.26, 0.05, 0.03],
      lmg: [2.6, -1.7, -5.2, 0.75, 0.22, 0.05, 0.03], pangun: [2.5, -1.75, -5.0, 0.78, 0.22, 0.05, 0.03],
    };
    const guns = this.combat.build.rack.map((w) => {
      const m = Models.hands(Models.gunKit(Models.gunFinish(Models.modVisuals(Models.weapon(w.id), w.id, w.mods, true), (this.look3d.gunFinish || {})[w.id]), w.id, (this.look3d.gunKit || {})[w.id], (this.look3d.patchSeed || {})[w.id]), w.id);
      const [x, y, z, sc, yaw, roll, pitch] = HOLD[w.id];
      m.position.set(x, y, z);
      m.scale.setScalar(sc);
      m.rotation.set(pitch, yaw, roll);
      m.userData.hold = [x, y, z];
      m.userData.holdRot = [pitch, yaw, roll];
      vm.add(m);
      return m;
    });
    // The roof gun, if one's mounted: held on its pintle low and dead ahead (you're stood behind it in the hatch),
    // with its shielding round it. It takes the slot after the rack, like Combat.roofIdx.
    const R = this.combat.build.roof;
    if (R && R.gun) {
      const w = R.gun, m = Models.hands(Models.gunKit(Models.gunFinish(Models.modVisuals(Models.weapon(w.id), w.id, w.mods, true), (this.look3d.gunFinish || {})[w.id]), w.id, (this.look3d.gunKit || {})[w.id], (this.look3d.patchSeed || {})[w.id]), w.id);
      const [x, y, z, sc, yaw, roll, pitch] = ROOF_HOLD;
      m.position.set(x, y, z); m.scale.setScalar(sc); m.rotation.set(pitch, yaw, roll);
      m.userData.hold = [x, y, z];
      m.userData.holdRot = [pitch, yaw, roll];
      m.userData.roof = true;
      m.add(Models.roofKit('none')); // the pintle and yoke
      const kit = Models.roofKit(R.shield, { noPost: true });
      m.add(kit);
      m.userData.shieldKit = kit; // hidden once it's shot to pieces
      vm.add(m);
      guns.push(m);
    }
    // Props the hands use while reloading: a shotgun shell carried to the loading port.
    guns.forEach((g, i) => {
      const rw = this.combat.build.rack[i];
      if (rw && rw.id === 'shotgun') {
        const shell = LP.cyl(0.24, 0.24, 0.8, 14, LP.mat('#a8221a', { roughness: 0.6 }));
        shell.add(LP.cyl(0.25, 0.25, 0.18, 14, LP.mat('#c9a443', { metalness: 0.7 }), 0, -0.35, 0));
        shell.rotation.x = Math.PI / 2;
        shell.visible = false;
        g.add(shell);
        g.userData.shell = shell;
      }
    });
    // Muzzle flash: a starburst (a spiky core facing you, two fins along the barrel), plus a light that flares on the
    // gun and hands and another that lights up the cabin for a frame or two.
    const fm = new THREE.MeshBasicMaterial({ map: Cockpit3DTex.flash()[0], color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const pm = new THREE.MeshBasicMaterial({ map: Cockpit3DTex.plume(), color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const flash = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), fm);
    // Two crossed planes carry the plume forward from the muzzle (its base at the muzzle, its tip ahead).
    const plA = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), pm); plA.rotation.x = -Math.PI / 2; plA.position.z = -1.0;
    const plB = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), pm); plB.rotation.set(-Math.PI / 2, 0, Math.PI / 2); plB.rotation.order = 'ZXY'; plB.position.z = -1.0;
    flash.add(face, plA, plB);
    flash.userData.mat = fm; flash.userData.plume = pm;
    this.vmCamera.add(flash);
    this.muzzleLight = new THREE.PointLight('#ffc070', 0, 14, 2);
    this.vmScene.add(this.muzzleLight);
    this.cabinFlash = new THREE.PointLight('#ffc070', 0, 30, 2);
    this.camera.add(this.cabinFlash);
    this.cabinFlash.position.set(6, -2, -8);
    // Smoke that curls off the muzzle after a shot.
    this.gunSmoke = [];
    for (let k = 0; k < 14; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: Cockpit3DTex.puff(), color: '#a09a90', transparent: true, depthWrite: false, opacity: 0 }));
      m.visible = false; this.vmCamera.add(m); this.gunSmoke.push({ m, t: 9, life: 1 });
    }
    this.kick = { z: 0, vz: 0, p: 0, vp: 0, y: 0, vy: 0, r: 0, vr: 0, cp: 0, vcp: 0, cr: 0, vcr: 0, f: 0, vf: 0 };
    this.vm = { root: vm, guns, flash };
    // Your free left hand, for emotes: one sculpted gesture each (the beckon has two, curling between them).
    this.emoteHands = {};
    for (const id of EMOTE_ORDER) {
      const frames = (id === 'beckon' ? [0, 1] : [0]).map((f) => { const h = Emotes.hand(id, f); h.visible = false; vm.add(h); return h; });
      this.emoteHands[id] = frames;
    }
    this.emoteAnim = null;
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
      nade: pool(10, () => {
        const g = Models.grenade(); g.scale.setScalar(2.4);
        // The fuse fizzing out of the top: a hot spark that flickers (you can see a live one in flight).
        const fz = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffd27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        fz.scale.setScalar(0.9); fz.position.y = 1.4; g.add(fz); g.userData.fuse = fz;
        return g;
      }),
      flare: pool(8, () => new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), new THREE.MeshBasicMaterial({ color: '#ff7a2a' }))),
      flame: pool(110, () => new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff9a2a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))),
      harpoon: pool(6, () => Models.harpoonBolt()),
      cloud: pool(48, () => new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: '#8f8f8a', transparent: true, opacity: 0.8, depthWrite: false }))),
      boom: pool(24, () => new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffb13b', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))),
      puff: pool(260, () => new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), new THREE.MeshBasicMaterial({ color: '#cccccc', transparent: true, opacity: 0.5, depthWrite: false }))),
    };
    this.puffs = [];
    this.sparkPool = pool(90, () => new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.4), new THREE.MeshBasicMaterial({ color: '#ffd27a' })));
    this.debrisPool = pool(60, () => new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.6), LP.mat('#2a2826', { roughness: 0.9 })));
    this.ringPool = pool(8, () => new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
    this.sparks = [];
    this.debris = [];
    this.ragdolls = new Ragdolls(scene); // crews thrown out of wrecked cars (js/ragdoll.js)
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
  }

  // ---------- Per-frame ----------

  // ---------- The blast hatch ----------
  // A welded steel plate hinged on the roof header, outside the windscreen. Open, it lies back on the roof; slammed,
  // it covers the glass with a barred vision slit at eye height. Hits dent it inwards and spray sparks through the
  // slit; dented through, it jams and hangs crooked off its hinge.
  buildHatch(I) {
    const v = new THREE.Vector2(-5.9, 6).normalize(), o = new THREE.Vector2(-v.y, v.x).negate(); // up the glass; out through it
    const top = new THREE.Vector2(5.45, 9.6).addScaledVector(v, 4.2), hinge = top.clone().addScaledVector(o, 0.75);
    const pivot = new THREE.Group();
    pivot.position.set(hinge.x, hinge.y, 0);
    const L = 8.9, Wd = 17.8, T = 0.32, s0 = 3.45, s1 = 4.35; // length down the glass, width, thickness, the slit
    const plate = new THREE.Group();
    // Low metalness: there's no environment to reflect in the cabin, and full metal would read as black.
    const steel = LP.mat('#a8acb0', { metalness: 0.25, roughness: 0.6 }), rust = LP.mat('#9a8670', { metalness: 0.15, roughness: 0.85 }); // solid: the decal rust is see-through; PSX.apply grimes it
    const dark = LP.mat('#3a3a3a', { metalness: 0.3, roughness: 0.6 }), weld = LP.mat('#4a4038', { metalness: 0.2, roughness: 0.8 });
    plate.add(LP.box(s0 - 0.15, T, Wd, rust, (0.15 + s0) / 2, 0, 0)); // the panel above the slit
    plate.add(LP.box(L - s1, T, Wd, rust, (s1 + L) / 2, 0, 0)); // and below it
    for (let k = 0; k < 9; k++) plate.add(LP.box(s1 - s0 + 0.3, 0.2, 0.2, dark, (s0 + s1) / 2, -0.05, -7.2 + k * 1.8)); // bars across the slit
    // Inside face: angle-iron braces, a cross member, weld beads, rivets, a grab handle, a hazard strip.
    const inner = -T / 2;
    for (const z of [-5.2, 0, 5.2]) {
      plate.add(LP.box(L - 0.8, 0.36, 0.42, steel, L / 2 + 0.2, inner - 0.18, z));
      plate.add(LP.box(L - 0.8, 0.08, 0.12, weld, L / 2 + 0.2, inner - 0.03, z + 0.27));
    }
    plate.add(LP.box(0.5, 0.36, Wd - 1.2, steel, L - 0.7, inner - 0.18, 0));
    plate.add(LP.box(0.5, 0.36, Wd - 1.2, steel, 0.8, inner - 0.18, 0));
    for (const x of [0.45, s0 - 0.3, s1 + 0.3, L - 0.3]) for (let k = 0; k < 10; k++) plate.add(LP.mesh(new THREE.SphereGeometry(0.13, 6, 4), steel, x, inner - 0.02, -8.1 + k * 1.8));
    const hy = inner - 0.95, hx = L - 1.7;
    plate.add(LP.tube([hx, inner, -1.6], [hx, hy, -1.6], 0.14, dark), LP.tube([hx, inner, 1.6], [hx, hy, 1.6], 0.14, dark), LP.tube([hx, hy, -1.7], [hx, hy, 1.7], 0.16, dark));
    const hz = canvasTex(64, 8);
    for (let x = -8; x < 64; x += 8) { hz.ctx.fillStyle = '#d8a920'; hz.ctx.beginPath(); hz.ctx.moveTo(x, 8); hz.ctx.lineTo(x + 4, 8); hz.ctx.lineTo(x + 8, 0); hz.ctx.lineTo(x + 4, 0); hz.ctx.fill(); }
    hz.ctx.globalCompositeOperation = 'destination-over'; hz.ctx.fillStyle = '#141414'; hz.ctx.fillRect(0, 0, 64, 8);
    hz.tex.wrapS = THREE.RepeatWrapping; hz.tex.repeat.set(4, 1); hz.tex.needsUpdate = true;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.55, Wd - 0.6), new THREE.MeshStandardMaterial({ map: hz.tex, roughness: 0.9 }));
    strip.geometry.rotateZ(Math.PI / 2); strip.geometry.rotateX(Math.PI / 2); strip.rotation.z = 0;
    strip.lookAt(0, -1, 0); strip.position.set(L - 0.32, inner - 0.01, 0);
    plate.add(strip);
    // The hinge: a barrel across the top and three knuckles welded to the roof.
    const barrel = LP.cyl(0.34, 0.34, Wd, 12, steel); barrel.rotation.x = Math.PI / 2; plate.add(barrel);
    for (const z of [-6.5, 0, 6.5]) { const k = LP.cyl(0.5, 0.5, 1.2, 12, dark, hinge.x, hinge.y, z); k.rotation.x = Math.PI / 2; I.add(k); }
    pivot.add(plate);
    I.add(pivot);
    PSX.apply(pivot);
    // Sparks through the slit and a flash of light when something hits.
    const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const sparks = [];
    for (let k = 0; k < 28; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.32), sparkMat); m.visible = false; I.add(m); sparks.push({ m, t: 9, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }); }
    const fill = new THREE.PointLight('#d8c8a8', 0, 16, 2); // the cabin bulb's spill on the plate, only while it's down
    fill.position.set(2.5, 10.2, 1.5); I.add(fill);
    const light = new THREE.PointLight('#ffc070', 0, 26, 2);
    I.add(light);
    this.hatchFx = { pivot, plate, L, Wd, T, s0, s1, open: Math.atan2(0.24, -1), shut: Math.atan2(-v.y, -v.x), dents: 0, dentMat: rust, sparks, light, fill, bounce: 0, shudder: 0, jamT: 0, o, hinge, v }; // open lies back over the roof, resting on the roof hatch's frame; shut runs straight down the glass
    this.syncDents(true);
  }

  // Dents grow with the wear on the plate (kept between races in your build).
  syncDents(seeded) {
    const F = this.hatchFx, hp = ensureHatch(this.combat.build).hp, want = Math.min(40, Math.floor((1 - hp / HATCH.max) * 40));
    const rng = seeded ? mulberry32(97) : Math.random;
    while (F.dents < want) {
      const r = 0.22 + rng() * 0.3;
      let x = 0.5 + rng() * (F.L - 1);
      if (x > F.s0 - 0.25 && x < F.s1 + 0.25) x = F.s1 + 0.4;
      const d = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), F.dentMat);
      d.scale.y = 0.35;
      d.position.set(x, -F.T / 2, (rng() - 0.5) * (F.Wd - 1.5)); // pushed in towards you
      F.plate.add(d);
      PSX.apply(d);
      F.dents++;
    }
  }

  hatchHit(ev) {
    const F = this.hatchFx;
    if (!F) return;
    F.shudder = Math.min(1.5, F.shudder + (ev.kind === 'blast' ? 1.2 : 0.35));
    if (ev.kind === 'blast') this.shake = Math.max(this.shake, 0.6);
    if (ev.kind === 'flame') return;
    // Sparks come through the slit at you.
    const n = ev.kind === 'blast' ? 14 : 5, cos = Math.cos(F.pivot.rotation.z), sin = Math.sin(F.pivot.rotation.z);
    for (let k = 0; k < n; k++) {
      const s = F.sparks.find((q) => q.t >= q.life);
      if (!s) break;
      const along = (F.s0 + F.s1) / 2;
      s.p.set(F.hinge.x + cos * along, F.hinge.y + sin * along, (Math.random() - 0.5) * 14);
      const sp = 14 + Math.random() * 22;
      s.v.set(-F.o.x * sp + (Math.random() - 0.5) * 6, -F.o.y * sp + Math.random() * 4, (Math.random() - 0.5) * 10);
      s.t = 0; s.life = 0.18 + Math.random() * 0.25;
      s.m.visible = true;
    }
    F.light.position.set(F.hinge.x + cos * 4, F.hinge.y + sin * 4 - 0.5, 0);
    F.light.intensity = ev.kind === 'blast' ? 5 : 2;
  }

  animateHatch(dt, t) {
    const F = this.hatchFx, H = this.combat.hatch;
    if (!F) return;
    // Gravity on the way down, a haul on the way up; a bounce off the stop, a shudder when it's hit.
    const f = Math.pow(H.pos, 1.7);
    let ang = F.open + (F.shut - F.open) * f;
    F.bounce = Math.max(0, F.bounce - dt * 3.5);
    ang += Math.sin(F.bounce * 22) * 0.06 * F.bounce;
    F.shudder = Math.max(0, F.shudder - dt * 5);
    ang += (Math.random() - 0.5) * 0.02 * F.shudder;
    F.plate.rotation.x = 0;
    if (H.jammed) { // hanging crooked off a sprung hinge, rattling
      ang = F.open + (F.shut - F.open) * 0.86 + Math.sin(t * 13) * 0.012 * Math.min(1, this.race.player.speed / 300);
      F.plate.rotation.x = 0.09;
    }
    // Open, the plate lies over your roof hatch: climbing up to the roof gun, you shove it down over the glass first
    // (it stays down while you're up there, and lifts back once you're in and the lid's shut).
    const roof = clamp((this.combat.up || 0) * 4, 0, 1);
    if (roof > 0 && !H.jammed) ang += (F.shut - ang) * roof * roof * (3 - 2 * roof);
    F.pivot.rotation.z = ang;
    for (const s of F.sparks) {
      if (s.t >= s.life) { s.m.visible = false; continue; }
      s.t += dt;
      s.v.y -= 30 * dt;
      s.p.addScaledVector(s.v, dt);
      s.m.position.copy(s.p);
      s.m.lookAt(s.p.x + s.v.x, s.p.y + s.v.y, s.p.z + s.v.z);
    }
    F.light.intensity = Math.max(0, F.light.intensity - dt * 25);
    F.fill.intensity = 4 * Math.max(H.pos, H.jammed ? 0.5 : 0);
  }

  // The hand comes up from the bottom left, makes its point (with a couple of pumps), and drops away.
  animateEmote(dt, t) {
    const A = this.emoteAnim;
    for (const id in this.emoteHands) for (const h of this.emoteHands[id]) h.visible = false;
    if (!A) return;
    A.t += dt;
    const L = 1.6;
    if (A.t >= L) { this.emoteAnim = null; return; }
    const up = A.t < 0.24 ? 1 - Math.pow(1 - A.t / 0.24, 3) * Math.cos(A.t / 0.24 * 1.2) : A.t > L - 0.26 ? Math.max(0, (L - A.t) / 0.26) : 1;
    const hold = clamp((A.t - 0.24) / (L - 0.5), 0, 1);
    const frames = this.emoteHands[A.id], frame = A.id === 'beckon' ? frames[Math.floor(A.t / 0.2) % 2] : frames[0];
    frame.visible = true;
    let x = -1.9, y = -7.6 + up * 6.9, z = -4.6, rx = 0.12, ry = 0.3, rz = -0.18;
    if (A.id === 'flip' || A.id === 'thumbs') { const pump = Math.max(0, Math.sin(hold * Math.PI * 4)); z -= pump * 0.55; y += (A.id === 'thumbs' ? -pump * 0.3 : pump * 0.15); rx -= pump * 0.15; }
    if (A.id === 'horns') rz += Math.sin(A.t * 14) * 0.12 * (hold > 0 ? 1 : 0);
    if (A.id === 'thumbs') { rx -= 1.0; ry -= 1.1; y += 0.3; z -= 2.4; x -= 1.4; rz -= 0.1; } // the forearm pointed out at them, fist leading
    frame.position.set(x, y, z);
    frame.rotation.set(rx, ry, rz);
    frame.scale.setScalar(1.45);
  }

  onEvent(ev) {
    if (ev.type === 'eject') this.eject(ev);
    if (ev.type === 'emote') this.emoteAnim = { id: ev.id, t: 0 };
    if (ev.type === 'deflect') this.sparkAt(ev.x, ev.y, 5);
    if (ev.type === 'impact') this.impact(ev);
    if (ev.type === 'gunnerHit') { this.shake = Math.max(this.shake, 1.0); this.hitRed = 0.5; }
    if (ev.type === 'thrown') { this.shake = Math.max(this.shake, 0.6 + ev.f); if (this.cabinMo) { this.cabinMo.vroll += (Math.random() - 0.5) * 3 * ev.f; this.cabinMo.vpitch -= 1.5 * ev.f; } }
    if (ev.type === 'ownDriverHit') { this.shake = Math.max(this.shake, 0.5); this.hitRed = Math.max(this.hitRed || 0, 0.3); }
    if (ev.type === 'roofUp' || ev.type === 'roofDown') this.shake = Math.max(this.shake, ev.knocked ? 0.9 : 0.25);
    if (ev.type === 'tyrePop') { this.sparkAt(ev.x, ev.y, 10); if (ev.mine) { this.shake = Math.max(this.shake, 0.6); if (this.cabinMo) this.cabinMo.vroll += ev.side * 0.6; } }
    if (ev.type === 'hatchShut') { if (this.hatchFx) this.hatchFx.bounce = 1; this.shake = Math.max(this.shake, 0.35); }
    if (ev.type === 'block' || ev.type === 'parry') this.hatchHit(ev);
    if (ev.type === 'dent') this.syncDents(false);
    if (ev.type === 'jam') { this.shake = Math.max(this.shake, 0.5); if (this.hatchFx) this.hatchFx.shudder = 1.5; }
    if (ev.type === 'shoot' || ev.type === 'shotgun') this.ejectCasing(ev.type === 'shotgun');
    if (FIRE_EVENTS.includes(ev.type) && !this.combat.exposed && !this.combat.leanOut) this.shootGlass(ev.type); // (out of the window or the roof, the glass isn't in the way)
    if (FIRE_EVENTS.includes(ev.type)) {
      const k = FIRE_KICK[this.combat.weapon.id] || FIRE_KICK.smg, soft = this.combat.buffs && this.combat.buffs.kick; // whiskey: a steadier hand
      const ads = 1 - (1 - ADS.recoil) * (this.adsK || 0); // down the sights, the gun kicks less in your hands too
      this.fireKick(Object.assign({}, k, { back: k.back * (soft || 1) * ads, climb: k.climb * (soft || 1) * ads, yaw: k.yaw * (soft || 1) * ads, roll: k.roll * (soft || 1) * ads, cam: k.cam * (soft || 1) * ads, croll: (k.croll || 0) * (soft || 1) * ads, fov: (k.fov || 0) * (soft || 1), shake: (k.shake || 0) * (soft || 1) * (this.combat.exposed ? 0.6 : 1) }));
      this.recoil2(this.combat.weapon.id, soft || 1);
    }
    if (ev.type === 'explode') this.burst(ev.x, ev.y, ev.big);
    else if (ev.type === 'empty') this.anim.dry = 0.14;
    if (ev.type === 'shotgun') this.anim.pumpT = 0.55;
    if (ev.type === 'ping') this.anim.pingT = 0.6;
    if (ev.type === 'shoot') { this.recoil = Math.min(1, this.recoil + 0.35); this.flash = 0.05; }
    else if (ev.type === 'nail') { this.recoil = Math.min(0.8, this.recoil + 0.25); }
    else if (ev.type === 'flame') { this.recoil = Math.max(this.recoil, 0.12); }
    else if (ev.type === 'harpoon') { this.recoil = 1.1; this.shake = Math.max(this.shake, 0.2); }
    else if (ev.type === 'rocket') { this.recoil = 1.4; this.flash = 0.08; this.shake = Math.max(this.shake, 0.4); }
    else if (ev.type === 'shotgun') { this.recoil = 1.5; this.flash = 0.07; this.shake = Math.max(this.shake, 0.3); }
    else if (ev.type === 'flare') { this.recoil = 0.9; this.flash = 0.06; }
    else if (ev.type === 'partBreak') this.shake = Math.max(this.shake, 0.7);
    else if (ev.type === 'land') { this.shake = Math.max(this.shake, Math.min(1.2, ev.power / 500)); if (this.cabinMo) this.cabinMo.vpitch -= ev.power * 0.0012; }
    else if (ev.type === 'hurt') {
      this.shake = Math.max(this.shake, Math.min(1.5, ev.dmg / 12));
      const p = this.race.player;
      const rel = wrapAngle(ev.ang - p.heading);
      if (Math.abs(rel) < 1.1 && !this.combat.exposed && !this.glass.gone) { this.crack(rel); this.wearGlass(GLASS.hit.crack); } // (no windscreen to crack with your head out of the roof)
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

  // Your own shot through the windshield: a hole where your line of fire crosses the glass (none if you're
  // shooting out of the side window).
  shootGlass(type) {
    if (!this.glass || this.glass.gone || !this.windshield) return;
    const ray = new THREE.Raycaster(), dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    ray.set(this.camera.getWorldPosition(new THREE.Vector3()), dir);
    const hit = ray.intersectObject(this.windshield, false)[0];
    if (!hit || !hit.uv) return;
    const c = this.cracks.ctx, x = hit.uv.x * 512, y = (1 - hit.uv.y) * 256, rnd = Math.random;
    const spokes = (cx, cy, n, len) => {
      c.strokeStyle = 'rgba(235,245,255,0.7)'; c.lineWidth = 1;
      for (let k = 0; k < n; k++) {
        let a = (k / n) * TAU + rnd() * 0.6, px = cx, py = cy;
        c.beginPath(); c.moveTo(px, py);
        for (let s = 0; s < 3; s++) { a += (rnd() - 0.5) * 0.5; px += Math.cos(a) * len * (0.3 + rnd() * 0.5); py += Math.sin(a) * len * (0.3 + rnd() * 0.5); c.lineTo(px, py); }
        c.stroke();
      }
    };
    const hole = (cx, cy, r) => { // a clean round hole, a frosted ring round it, short cracks running off
      c.fillStyle = 'rgba(225,235,245,0.45)'; c.beginPath(); c.arc(cx, cy, r * 2.2, 0, TAU); c.fill();
      c.fillStyle = 'rgba(15,15,18,0.9)'; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
      spokes(cx, cy, 4 + Math.floor(rnd() * 3), r * 7);
    };
    if (type === 'shotgun') for (let k = 0; k < 7; k++) hole(x + (rnd() - 0.5) * 34, y + (rnd() - 0.5) * 24, 1.6);
    else if (type === 'shoot' || type === 'nail') hole(x + (rnd() - 0.5) * 3, y + (rnd() - 0.5) * 3, type === 'nail' ? 1.6 : 2.3);
    else if (type === 'flame') { // soot, and the glass blistering
      const g = c.createRadialGradient(x, y, 2, x, y, 40); g.addColorStop(0, 'rgba(25,18,10,0.12)'); g.addColorStop(1, 'rgba(25,18,10,0)');
      c.fillStyle = g; c.fillRect(x - 40, y - 40, 80, 80);
    } else { // rocket, harpoon, flare: a big starburst, punched clean through in the middle
      c.strokeStyle = 'rgba(235,245,255,0.6)'; c.lineWidth = 1;
      for (const rr of [14, 24, 34]) { c.beginPath(); for (let a = 0; a <= TAU + 0.01; a += 0.5) c.lineTo(x + Math.cos(a) * rr * (0.85 + rnd() * 0.3), y + Math.sin(a) * rr * (0.85 + rnd() * 0.3)); c.stroke(); }
      spokes(x, y, 12, 30);
      c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath();
      for (let a = 0; a < TAU; a += 0.45) c.lineTo(x + Math.cos(a) * (6 + rnd() * 6), y + Math.sin(a) * (6 + rnd() * 6));
      c.fill(); c.restore();
    }
    this.cracks.tex.needsUpdate = true;
    this.wearGlass(GLASS.hit[type] || 2);
  }

  // Wear on the windshield; worn through, it's gone.
  wearGlass(n) {
    const G = this.glass;
    if (!G || G.gone) return;
    G.hp -= n;
    if (G.hp <= 0) this.glassOut(false);
  }

  // The windshield goes: shot out, it just falls away to nothing; kicked out, the whole laminated sheet pops out of
  // its frame in one piece and the wind takes it (at a standstill it flops onto the bonnet).
  glassOut(kicked) {
    const G = this.glass, ws = this.windshield;
    if (!G || G.gone || !ws) return;
    G.gone = true;
    this.combat.glassOut = true; // (the trade-off: see GLASS_FX in js/combat.js)
    this.shake = Math.max(this.shake, kicked ? 0.5 : 0.6);
    Sound.play({ type: 'shatter', vol: 1 });
    if (!kicked) { ws.visible = false; return; }
    this.glassFly = { t: 0, vx: 26, vy: 22, spin: -2.2 - Math.random() };
  }

  // K: your boot through the windshield. Two kicks: the first stars it, the second pops the sheet out.
  kickGlass() {
    const G = this.glass;
    if (!G || G.gone || this.bootT != null || this.combat.exposed || this.combat.hatch.pos > 0.3) return;
    this.bootT = 0;
    if (!this.boot) {
      const B = new THREE.Group(), s = new Sculpt('kickboot', 0.05), suit = LP.mat('#a8521e', { roughness: 0.95 }), leather = LP.mat('#1a1410', { roughness: 0.8 }), sole = LP.mat('#0c0b0a', { roughness: 0.9 });
      s.add(leather, SDF.ellipsoid([0.55, 0.62, 0.95], [0, 0, 0]), 0.2); // the boot, toe forward (-z)
      s.add(leather, SDF.cyl(0.5, 1.0, 'y', 0.15, [0, -0.55, 0.35]), 0.25); // its ankle
      s.add(sole, SDF.box([1.1, 0.5, 0.22], 0.08, [0, -0.05, -0.92]), 0.05); // the sole, square to the glass
      s.add(suit, SDF.cone([0, -0.9, 0.5], [0, -4.5, 3.4], 0.6, 0.75), 0.3); // your shin, back down to the knee
      s.build(B);
      B.scale.setScalar(1.6);
      PSX.apply(B);
      this.vmScene.add(B);
      this.boot = B;
    }
    this.boot.visible = true;
  }

  // The kick and the flying windshield, each frame.
  updateBootKick(dt) {
    if (this.bootT != null) {
      const t = (this.bootT += dt), B = this.boot;
      // Camera-space path: up from under the view, stamp, draw back, stamp again, back down.
      const rest = new THREE.Vector3(0.8, -8, -2), cock = new THREE.Vector3(0.7, -3.6, -3.2), hit = new THREE.Vector3(0.5, -1.4, -6.2);
      Motion.path([[0, rest], [0.18, cock], [0.3, hit], [0.33, hit], [0.46, cock], [0.58, hit], [0.62, hit], [0.95, rest]], t, B.position); // (the boot stops dead on the glass, twice)
      B.rotation.set(-0.15 + 0.25 * Math.sin(t * 9), 0.1, 0.05);
      if (t >= 0.3 && !this.bootHit1) { this.bootHit1 = true; this.combat.events.push({ type: 'kickGlass' }); // (you grunt with it: js/voice.js)
       this.crack(0.15); this.crack(0.05); this.shake = Math.max(this.shake, 0.35); Sound.play({ type: 'crash', vol: 0.5, power: 120 }); }
      if (t >= 0.58 && !this.bootHit2) { this.bootHit2 = true; this.glassOut(true); }
      if (t > 1) { this.bootT = null; this.bootHit1 = this.bootHit2 = false; B.visible = false; }
    }
    const F = this.glassFly, ws = this.windshield;
    if (F && ws) { // in the car's frame: it pops forward and up, the wind throws it back over the roof
      F.t += dt;
      const wind = Math.min(1, this.race.player.speed / 300);
      F.vx -= (25 + 260 * wind) * dt;
      F.vy -= (60 - 45 * wind) * dt;
      ws.position.x += F.vx * dt; ws.position.y += F.vy * dt;
      ws.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), F.spin * dt));
      if (wind < 0.1 && ws.position.y < 8) { F.vx *= 0.9; F.vy = Math.max(F.vy, 0); F.spin *= 0.9; } // landed on the bonnet
      if (F.t > 1.6) { ws.visible = wind < 0.1; this.glassFly = null; }
    }
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
      out.push({ x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, label: `${shortName(car)}${car.hp <= 0 ? ' ✖' : ''}${car.markT > 0 ? ' ◎' : ''}`, bounty: car.hp > 0 ? car.bounty : 0, armed: !!car.weapon, d, target: !!(this.combat.driver && this.combat.driver.order && this.combat.driver.order.target === car) });
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
    Weather3D.update(this, this.wx, dt, t);
    this.updateFeatures();

    // Cars
    // Your own car's body motion, scaled by the cabin-sway setting (rolls the whole cabin and your view).
    const sway = Settings.sway, cm = this.cabinMo || (this.cabinMo = { roll: 0, vroll: 0, pitch: 0, vpitch: 0 });
    if (dt > 0) {
      const k = 120, d = 12;
      cm.vroll += ((clamp(-this.acc.lat * 0.0001, -0.09, 0.09) - cm.roll) * k - cm.vroll * d) * dt; cm.roll += cm.vroll * dt;
      cm.vpitch += ((clamp(this.acc.fwd * 0.00006, -0.05, 0.05) - cm.pitch) * k - cm.vpitch * d) * dt; cm.pitch += cm.vpitch * dt;
    }
    this.playerGroup.position.set(p.x, (p.z || 0) + (p.sq || 0) + Math.sin(t * 13) * 0.05 * Math.min(1, p.speed / 300) * sway, p.y);
    this.playerGroup.rotation.order = 'YXZ';
    // Off a ramp the nose lifts and drops with the jump (always shown: it's the jump, not cabin sway).
    this.playerGroup.rotation.set(cm.roll * sway + (p.jr || 0), -p.heading, cm.pitch * sway - (p.jp || 0));
    this.playerGroup.updateMatrixWorld(true); // localToWorld below needs this frame's transform
    for (const [car, m] of this.carMeshes) {
      m.g.position.set(car.x, (car.z || 0) + (car.sq || 0), car.y);
      m.g.rotation.order = 'YXZ';
      m.g.rotation.set(car.jr || 0, -car.heading, -(car.jp || 0)); // up the ramp nose first, tipping over in the air, rocking on landing
      m.wheels.forEach((w, i) => {
        w.rotation.z -= (car.forwardSpeed * dt) / 3.8;
        if (w.position.x > 0) w.rotation.y = -(car.input ? car.input.steer : 0) * 0.5; // front wheels steer
        // A flat sits on its rim: shrunk, dropped, and shedding sparks at speed.
        const flat = car.tyres && car.tyres[i] <= 0;
        if (flat !== !!w.userData.flat) {
          if (w.userData.y0 == null) w.userData.y0 = w.position.y;
          w.userData.flat = flat;
          w.scale.set(flat ? 0.8 : 1, flat ? 0.8 : 1, 1);
          w.position.y = w.userData.y0 * (flat ? 0.8 : 1);
        }
        if (flat && Math.abs(car.forwardSpeed) > 120 && Math.random() < 0.25) {
          const v = w.getWorldPosition(this.tmpV || (this.tmpV = new THREE.Vector3()));
          this.sparkAt(v.x, v.z, 1);
        }
      });
      if (car.tyres) { // the body slumps towards its flats
        const f = (i) => (car.tyres[i] <= 0 ? 1 : 0), lean = f(1) + f(3) - f(0) - f(2), nose = f(0) + f(1) - f(2) - f(3);
        m.model.rotation.x = lean * 0.035;
        m.model.rotation.z = -nose * 0.025;
      }
      this.carMotion(car, m, dt, t);
      this.updateDamage(car, m, dt);
      this.animateCrew(car, m, dt, t);
      if (car.burnT > 0 && this.puffs.length < this.pools.puff.length && Math.random() < 0.5) this.puffs.push({ x: car.x + (Math.random() - 0.5) * 20, y: car.y + (Math.random() - 0.5) * 12, t: 0, fire: true });
      // (No white flash on a hit: the dents, sparks and hit markers say you landed it.)
      m.bodyMat.emissive.set(car.burnT > 0 && Math.random() < 0.6 ? '#ff4a0a' : car.blindT > 0 ? '#ff5a1a' : car.empT > 0 && Math.floor(t * 8) % 2 ? '#3fa9ff' : car.hp <= 0 ? '#331100' : '#000000');
      m.bodyMat.emissiveIntensity = 1;
      m.sprite.visible = !PSX.enabled;
      const label = `${car.place}. ${car.vendetta ? '☠ ' : ''}${shortName(car)}${car.hp <= 0 ? ' ✖' : ''}${car.bounty && car.hp > 0 ? ' $' + car.bounty : ''}`;
      if (label !== m.lastTag) {
        const c = m.tag.ctx;
        c.clearRect(0, 0, 256, 64);
        c.font = 'bold 34px system-ui';
        c.textAlign = 'center';
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(128 - c.measureText(label).width / 2 - 10, 8, c.measureText(label).width + 20, 46);
        c.fillStyle = car.vendetta ? '#ff2a2a' : car.weapon ? '#ff8a6a' : '#ffffff';
        c.fillText(label, 128, 43);
        m.tag.tex.needsUpdate = true;
        m.lastTag = label;
      }
    }

    this.wheel.rotation.z = (p.input ? p.input.steer : 0) * 2.2; // + steer turns the car right: the wheel goes clockwise as the driver sees it (its axis points up the column, away from them)
    this.animateMyCrew(dt, t);

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
    for (const row of this.ammoRack) { // the board shows what's left once your pockets are full
      const w = b.rack[row.wi], n = Math.max(0, Math.min(row.items.length, Math.ceil(Math.max(0, w.reserve - (w.worn || 0)) / row.per)) - (row.hide || 0));
      if (n !== row.shown) { row.items.forEach((it, k) => { it.visible = k < n; }); row.shown = n; }
    }
    for (const row of this.bodyAmmo || []) {
      const w = b.rack[row.wi], n = Math.max(0, Math.min(row.items.length, Math.ceil(Math.min(w.worn || 0, w.reserve) / row.per)) - (row.hide || 0));
      if (n !== row.shown) { row.items.forEach((it, k) => { it.visible = k < n; }); row.shown = n; }
    }
    this.rackGuns.forEach((m, i) => {
      m.visible = i !== combat.wi;
      if (m.userData.tip) m.userData.tip.visible = b.rack[i].mag > 0;
    });

    this.animateViewmodel(dt, t);
    this.animateHatch(dt, t);
    this.animateEmote(dt, t);
    this.updateFx(dt, t);
    this.updateLooseParts(dt);
    this.drawRadar(t);
    this.drawStatus(t);

    // Camera: eye in the passenger seat, free look, roll + shake.
    this.shake = Math.max(0, this.shake - dt * 3);
    // Up in the roof hatch: the eye rises out through the roof (a little forward, over the gun), and the shielding
    // limits how far round you can swing it.
    const upK = this.combat.up * this.combat.up * (3 - 2 * this.combat.up);
    if (this.combat.exposed) { const arc = this.combat.shield.arc; this.look.yaw = clamp(this.look.yaw, -arc, arc); }
    // Out of the window (js/lean.js): the head goes out through your window (on the right), a little up, tilted out, buffeted
    // by the wind at speed; you can look from just past dead ahead round to behind you.
    const lk = Motion.ease(this.combat.leanK || 0);
    if (this.combat.leanOut) this.look.yaw = clamp(this.look.yaw, LEAN.arc[0], LEAN.arc[1]);
    // Your head turns on your neck: the eyes sit in front of it and swing round with the look, so turning to look
    // behind you puts your eyes over your shoulder instead of inside your own neck.
    const NECK = 0.85, hy = this.look.yaw;
    // Reaching for the ammo board on the dash: you lean in towards it and glance down, so it's within arm's length.
    this.lean = lerp(this.lean || 0, this.combat.exposed || this.combat.leanOut ? 0 : (this.reachNow || 0), Math.min(1, dt * 7));
    this.reachNow = 0;
    const ln = this.lean;
    const eye = this.playerGroup.localToWorld(new THREE.Vector3(EYE.x - NECK + NECK * Math.cos(hy) + 0.4 * upK + 1.3 * ln - 0.4 * lk, EYE.y + 5.4 * upK - 0.8 * ln + 1.4 * lk, EYE.z + NECK * Math.sin(hy) + 5.6 * lk));
    if (lk > 0) { const wind = lk * Math.min(1, this.race.player.speed / 450) * 0.07; eye.x += (Math.random() - 0.5) * wind; eye.y += (Math.random() - 0.5) * wind; }
    if (this.roofHatch) this.roofHatch.rotation.z = 1.95 * clamp(this.combat.up * 2.5, 0, 1); // the lid flips up and over as you climb
    const sh = this.shake;
    eye.x += (Math.random() - 0.5) * sh * 1.2;
    eye.y += (Math.random() - 0.5) * sh * 1.2;
    eye.z += (Math.random() - 0.5) * sh * 1.2;
    const wy = this.aimAngle(), pt = this.look.pitch - 0.15 * (this.lean || 0); // (the glance down while reaching)
    // Look direction in the car's frame, so the view rolls and pitches with the cabin.
    const yw = this.look.yaw;
    const dir = new THREE.Vector3(Math.cos(yw) * Math.cos(pt), Math.sin(pt), Math.sin(yw) * Math.cos(pt)).applyQuaternion(this.playerGroup.quaternion);
    // Down the sights the view narrows a little (and the held gun's with it, less).
    const ak = this.adsK || 0, fov = 74 * (1 - (1 - ADS.fov) * ak) + (this.kick ? clamp(this.kick.f, -1, 6) : 0), vfov = 74 * (1 - 0.12 * ak);
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    if (Math.abs(this.vmCamera.fov - vfov) > 0.01) { this.vmCamera.fov = vfov; this.vmCamera.updateProjectionMatrix(); }
    this.camera.position.copy(eye);
    this.camera.up.set(0, 1, 0).applyQuaternion(this.playerGroup.quaternion);
    this.camera.lookAt(eye.clone().add(dir));
    // Where the camera sits in the car (for reaching to things in the cabin next frame; see rackPoint).
    this.camera.updateMatrixWorld(); this.playerGroup.updateWorldMatrix(true, false);
    this.camInCar = this.playerGroup.matrixWorld.clone().invert().multiply(this.camera.matrixWorld);
    if (this.kick) { this.camera.rotateX(this.kick.cp); this.camera.rotateZ(this.kick.cr); } // the punch of a big gun going off
    if (lk > 0) this.camera.rotateZ(0.09 * lk * Math.cos(this.look.yaw)); // the head tipped out against the frame
    this.camera.rotateZ(clamp(this.acc.lat * 0.00012, -0.08, 0.08) * Math.cos(yw) * sway);
    // Drunk (pruno, whiskey): the cabin swims. Only the view moves, not where the gun points, so your aim drifts off
    // the crosshair's idea of the world a little: that's the cost of the courage.
    const drunk = combat.buffs && combat.buffs.drunk;
    if (drunk) {
      const tt = this.race.time;
      this.camera.rotateZ(Math.sin(tt * 0.83) * 0.05 * drunk);
      this.camera.rotateY(Math.sin(tt * 0.51 + 1) * 0.035 * drunk);
      this.camera.rotateX(Math.sin(tt * 0.67 + 2) * 0.02 * drunk);
    }
    // Sal's smog: the world closes in while you're in it.
    const smog = combat.smogOn ? combat.smogOn() : 0, F = this.scene.fog;
    if (!this.fogBase) this.fogBase = { near: F.near, far: F.far };
    this.smogK = lerp(this.smogK || 0, smog, Math.min(1, dt * 3));
    F.near = this.fogBase.near * (1 - 0.9 * this.smogK);
    F.far = this.fogBase.far * (1 - 0.82 * this.smogK);
  }

  // Body roll in corners, nose dive under braking, squat on launch, suspension jiggle, a jolt when hit,
  // and a hop-and-spin the moment a car is wrecked. Damaged cars smoke; exhausts puff under hard throttle.
  // The crew through the glass: glancing about, jolting when hit, slumped over once they're dead.
  animateCrew(car, m, dt, t) {
    const crew = m.model.userData.crew;
    if (!crew) return;
    for (const role of ['driver', 'gunner']) {
      const f = crew[role];
      if (!f) continue;
      const u = f.userData, dead = role === 'driver' ? car.driverDead : car.gunnerDead, fl = (role === 'driver' ? car.flinchT : car.gFlinchT) || 0;
      u.slump = dead ? Math.min(1, (u.slump || 0) + dt * 2.5) : 0;
      const k = u.slump * u.slump, side = role === 'driver' ? 1 : -1;
      u.torso.rotation.set(k * 0.35 * side, 0, -k * 0.75 + (fl > 0 ? Math.sin(fl * 38) * 0.12 : 0)); // over the wheel / against the door
      u.head.rotation.set((fl > 0 ? Math.sin(fl * 29) * 0.3 : Math.sin(t * 0.9 + m.mo.seed + (role === 'gunner' ? 2 : 0)) * 0.12) + k * 0.5 * side, 0, -k * 0.6);
    }
  }

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
    if (car.flipped) { // thrown onto its roof by a blast
      mo.flipK = Math.min(1, (mo.flipK || 0) + dt * 2.2);
      const e = 1 - Math.pow(1 - mo.flipK, 3);
      extraRoll += e * Math.PI;
      y += Math.sin(e * Math.PI) * 9 + e * 10.5; // up and over, coming to rest on the roof
    }
    m.model.position.y = y;
    m.model.rotation.set(mo.roll + extraRoll, spinY * (mo.hop > 0 ? 1 : 0), mo.pitch);
    // Smoke from damaged engines, black when wrecked; exhaust puffs under hard throttle.
    const frac = car.hp / (car.stats.maxHp || 100), room = this.puffs.length < this.pools.puff.length;
    if (car.wrecked && room) { // a burning wreck: flames in the shell and a column of black smoke you can see down the track
      if (Math.random() < 0.35) this.puffs.push({ x: car.x + (Math.random() - 0.5) * 22, y: car.y + (Math.random() - 0.5) * 12, t: 0, fire: true });
      if (Math.random() < 0.12) this.puffs.push({ x: car.x + (Math.random() - 0.5) * 8, y: car.y + (Math.random() - 0.5) * 8, t: 0, column: true, life: 3.2 });
    }
    if (room && frac < 0.5 && Math.random() < (frac <= 0 ? 0.6 : frac < 0.25 ? 0.35 : 0.15)) {
      const c = Math.cos(car.heading), s = Math.sin(car.heading);
      this.puffs.push({ x: car.x + c * 14, y: car.y + s * 14, t: 0, smoke: frac <= 0 ? 'black' : frac < 0.25 ? 'dark' : 'grey' });
    }
    if (room && car.input && car.input.throttle > 0.8 && car.forwardSpeed < 200 && Math.random() < 0.25) {
      const c = Math.cos(car.heading), s = Math.sin(car.heading);
      this.puffs.push({ x: car.x - c * 19, y: car.y - s * 19, t: 0, exh: true });
    }
  }

  // One of your rounds landing on a rival: a spray of sparks off the panel where it hit, thrown back the way it
  // came and carried along with the car, and the body knocked over by it (more the heavier the round: a pistol
  // round flicks it, a rifle round or a load of buckshot rocks it on its springs).
  impact(ev) {
    const c = ev.car, m = this.carMeshes && this.carMeshes.get(c), k = Math.min(1, ev.dmg / 11);
    for (let i = 0, n = 2 + Math.round(k * 7); i < n && this.sparks.length < this.sparkPool.length; i++) {
      const a = ev.ang + Math.PI + (Math.random() - 0.5) * 2.2, sp = 80 + Math.random() * 160 * (0.5 + k);
      this.sparks.push({ x: ev.x, y: ev.y, z: 4 + Math.random() * 6, vx: c.vx + Math.cos(a) * sp, vy: c.vy + Math.sin(a) * sp, vz: 20 + Math.random() * 70 * (0.5 + k), t: 0, life: 0.18 + Math.random() * 0.25 * (0.6 + k) });
    }
    if (!m || !m.mo) return;
    const h = c.heading, side = -Math.cos(ev.ang) * Math.sin(h) + Math.sin(ev.ang) * Math.cos(h), fwd = Math.cos(ev.ang - h);
    m.mo.vroll = clamp(m.mo.vroll + side * (0.3 + k * 2.2) * (0.8 + Math.random() * 0.4), -3, 3); // shoved away from the shot (a load of buckshot: up to about 15 degrees)
    m.mo.vpitch = clamp(m.mo.vpitch + fwd * (0.2 + k * 1.4), -2, 2);
  }

  sparkAt(x, y, n) {
    for (let k = 0; k < n && this.sparks.length < this.sparkPool.length; k++) {
      const a = Math.random() * TAU, sp = 60 + Math.random() * 120;
      this.sparks.push({ x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 8, z: 5 + Math.random() * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 30 + Math.random() * 60, t: 0, life: 0.25 + Math.random() * 0.25 });
    }
  }

  // A hard crash: sparks off the scrape, and on the worst of them a torn panel or two cartwheeling away.
  crash(ev) {
    this.sparkAt(ev.x, ev.y, Math.min(16, 4 + ev.power / 35));
    const n = ev.power > 380 ? 3 : ev.power > 240 ? 1 : 0;
    for (let k = 0; k < n && this.debris.length < this.debrisPool.length; k++) {
      const c = ev.car, a = Math.atan2(ev.y - c.y, ev.x - c.x) + (Math.random() - 0.5) * 1.4, sp = 40 + Math.random() * 60;
      this.debris.push({ x: ev.x, y: ev.y, z: 4, vx: c.vx * 0.6 + Math.cos(a) * sp, vy: c.vy * 0.6 + Math.sin(a) * sp, vz: 50 + Math.random() * 70, rx: 0, ry: 0, sx: (Math.random() - 0.5) * 18, sy: (Math.random() - 0.5) * 18, t: 0, s: 0.8 + Math.random() * 0.8 });
    }
    if (ev.car === this.race.player) this.shake = Math.max(this.shake, Math.min(1.4, ev.power / 300));
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

  // A wrecked car throws its crew: each figure seen through the glass is swapped for a ragdoll at the same spot.
  eject(ev) {
    const m = this.carMeshes && this.carMeshes.get(ev.car), crew = m && m.model && m.model.userData.crew;
    if (!crew) return;
    m.g.updateMatrixWorld(true);
    for (const role of ev.roles) {
      const f = crew[role];
      if (!f || !f.visible) continue;
      this.ragdolls.spawn(f, { x: ev.car.vx, y: ev.car.vy }, ev.car.heading, { power: ev.power * (role === 'gunner' ? 1.1 : 1), kind: ev.kind, role });
      f.visible = false;
    }
  }

  updateParticles(dt) {
    if (this.ragdolls) this.ragdolls.update(dt, this.race.cars);
    const g = 160;
    for (const s of this.sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vz -= g * dt; s.z = Math.max(0.3, s.z + s.vz * dt); }
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    this.sparkPool.forEach((o, i) => {
      const s = this.sparks[i];
      o.visible = !!s;
      if (!s) return;
      o.position.set(s.x, s.z, s.y);
      o.lookAt(s.x + s.vx, s.z + s.vz, s.y + s.vy);
      o.material.color.set(s.col || (s.t < s.life * 0.4 ? '#fff2b0' : '#ff9a3a'));
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
    const ss = (a, c, x) => { const k = clamp((x - a) / (c - a), 0, 1); return k * k * (3 - 2 * k); }; // smoothstep a..c
    const bump = (a, c, x) => Math.sin(Math.PI * clamp((x - a) / (c - a), 0, 1)); // 0 -> 1 -> 0 over a..c
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.flash -= dt;
    // Recoil settling: a beat after you stop shooting, your view eases back down most of the way.
    if (this.recDebt > 0 && combat.lastFire > 0.1) { const back = Math.min(this.recDebt, this.recDebt * Math.min(1, dt * 7) + dt * 0.01); this.look.pitch -= back; this.recDebt -= back; }
    // Aiming down the sights, eased in and out.
    this.adsK = clamp((this.adsK || 0) + (combat.ads ? 1 : -1) * dt / ADS.time, 0, 1);
    this.updateKick(dt);
    this.updateBootKick(dt);
    A.switchT = Math.max(0, A.switchT - dt);
    A.pumpT = Math.max(0, A.pumpT - dt);
    A.dry = Math.max(0, A.dry - dt);
    A.pingT = Math.max(0, (A.pingT || 0) - dt);
    // Switching guns: the one in your hands goes down out of sight just as it is (mid-reload or not, so nothing
    // snaps), then the new one comes up. Each gun keeps its own reload: come back to it and it carries on.
    if (A.heldWi == null) A.heldWi = combat.wi;
    if (combat.wi !== A.heldWi) { A.prevWi = A.switchT > 0 && A.prevWi != null && (1 - A.switchT / SWITCH.t) < SWITCH.down ? A.prevWi : A.heldWi; A.heldWi = combat.wi; A.switchT = SWITCH.t; }
    const swf = A.switchT > 0 ? 1 - A.switchT / SWITCH.t : 1, lowering = swf < SWITCH.down && A.prevWi != null && A.prevWi !== combat.wi && vm.guns[A.prevWi];
    const show = lowering ? A.prevWi : combat.wi;
    const raise = SWITCH.drop * (lowering ? Motion.easeIn(swf / SWITCH.down) : swf < 1 ? 1 - Motion.easeOut((swf - SWITCH.down) / (1 - SWITCH.down)) : 0);
    const st = combat.wstate[show], id = (show === combat.roofIdx ? b.roof.gun : b.rack[show]).id;
    // Reload progress 0..1 for the gun in your hands (each gun's own).
    A.rlDur = A.rlDur || {};
    let rp = -1;
    if (st.reloadT > 0) {
      if (!(A.rlDur[show] >= st.reloadT)) A.rlDur[show] = st.reloadT;
      rp = 1 - st.reloadT / A.rlDur[show];
    } else { delete A.rlDur[show]; for (const r of (this.ammoRack || []).concat(this.bodyAmmo || [])) r.hide = 0; }
    // Off your chest rig: a short dip of the hand, and the gun barely tipped. Off the dash: the full reach.
    const fromBody = rp >= 0 && st.src === 'body' && show !== combat.roofIdx;
    this.bodyReach = fromBody;
    const stash = fromBody ? this.bodyAmmo || [] : this.ammoRack || [];
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
    const busyDip = (combat.busy ? 4 : 0) + (this.bootT != null ? 5 : 0) + combat.hatch.pos * 7.5 + clamp((-this.look.pitch - 0.35) / 0.25, 0, 1) * 4.5; // looking down at your gear lowers the gun
    this.dip = lerp(this.dip || 0, busyDip, Math.min(1, dt * 10));
    vm.guns.forEach((g, i) => {
      g.visible = i === show;
      if (!g.visible) return;
      if (g.userData.shieldKit) g.userData.shieldKit.visible = (b.roof.shieldHp || 0) > 0;
      const [x, y, z] = g.userData.hold, u = g.userData, hands = u.hands || [];
      // Reset moving parts to rest.
      for (const h of hands) { h.position.copy(h.userData.rest.pos); h.rotation.set(h.userData.rest.rot, 0, 0); h.visible = !h.userData.spare; } // a spare (reloading) hand waits out of sight
      if (u.mag) { u.mag.position.set(...(u.magRest || [0, -2.7, 0.2])); u.mag.rotation.set(0, 0, 0); u.mag.visible = true; }
      if (u.cover) u.cover.rotation.x = 0;
      if (u.belt) { u.belt.position.set(...u.beltRest); u.belt.rotation.set(0, 0, 0); u.belt.visible = true; }
      if (u.slide) u.slide.position.set(0, 0.36, Math.min(0.45, this.recoil * 0.5)); // the pistol's slide kicks back on each shot
      if (u.pump) u.pump.position.set(0, 0, 0);
      if (u.barrelGrp) u.barrelGrp.rotation.x = 0;
      if (u.shell) u.shell.visible = false;
      if (u.strip) u.strip.visible = false; // the nail gun's fresh strip, only out while it's being loaded
      const gw = i === combat.roofIdx ? b.roof.gun : b.rack[i]; // the gun this model is (the roof gun sits after the rack)
      if (u.tip) { u.tip.position.z = -6.3; u.tip.visible = gw.mag > 0; }
      if (u.bolt) u.bolt.visible = gw.mag > 0; // the harpoon's gone until you load another
      if (u.pan) u.pan.rotation.y = (gw.mag * TAU) / 47; // the pan turns a notch with every round
      if (u.clip) { // the Liberty's clip: in the gun while there are rounds, flying out with a ping on the last
        u.clip.position.set(0, 0.42, -0.1); u.clip.rotation.set(0, 0, 0);
        u.clip.visible = gw.mag > 0;
        if (A.pingT > 0) {
          const f = 1 - A.pingT / 0.6;
          u.clip.visible = true;
          u.clip.position.set(0.4 * f, 0.42 + 7 * f - 10 * f * f, -0.1 + 1.6 * f);
          u.clip.rotation.set(f * 9, 0, f * 4);
        }
      }
      if (u.jet) { u.jet.visible = combat.lastFire < 0.09 && st.reloadT <= 0; u.jet.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.4); } // the flamethrower's jet
      let ox = 0, oy = 0, oz = 0, rx = 0, ry = 0, rz = 0;
      if (rp >= 0) {
        const tilt = ss(0, 0.15, rp) * (1 - ss(0.9, 1, rp));
        const scaled = (P, k) => ({ rx: P.rx * k, ry: P.ry * k, rz: P.rz * k, ox: P.ox * k, oy: P.oy * k, oz: P.oz * k });
        if (MAG_RELOAD[id] && u.mag) {
          const q = fromBody ? bodyTime(rp) : rp; // (off your vest, the trip out of sight is short)
          // Side-on: the empty mag (drum, box, pan) drops out tumbling, the support hand (on a one-handed pistol, the
          // spare one) drops down to the rack, comes back up with a fresh one, lines it up under the well, pushes it
          // home and the bolt (or the pistol's slide) goes forward.
          ({ rx, ry, rz, ox, oy, oz } = scaled(reloadPose(id), tilt));
          if (u.slide && id === 'pistol') u.slide.position.z = 0.45 * (1 - ss(0.82, 0.86, q)); // locked back until the new mag is in
          const MR = MAG_RELOAD[id], off = new THREE.Vector3(...MR.off), rest0 = new THREE.Vector3(...(u.magRest || [0, -2.7, 0.2]));
          const hand = hands[1], R = this.rackPoint(g, i, fromBody), well = rest0.clone().sub(off);
          const belted = !!(u.cover && u.belt); // a belt-fed gun: after the box, the belt goes into the tray
          const below = well.clone().addScaledVector(new THREE.Vector3(...(MR.dir || [0, -1, 0])).normalize(), MR.depth || 1.2); // lined up outside the well
          const drop = ss(0.15, 0.32, q);
          if (hand && R) {
            const rest = hand.userData.rest.pos;
            hand.visible = true;
            // Out to the mags, a beat to take one, then in one flowing move under the well, up into it, a push to
            // seat it, and back to the grip (Motion.path: it flows through the waypoints, stopping only on holds).
            const seat = well.clone().add(new THREE.Vector3(0, 0.3, 0));
            if (belted && q >= 0.72) this.loadBelt(u, hand, well, rest, q);
            else Motion.path([[0.12, rest], [0.3, R], [0.42, R], [0.6, below], [0.7, well], [0.75, seat], [0.8, well], [0.93, rest]], q, hand.position);
            hand.rotation.x = hand.userData.rest.rot + 0.6 * bump(0.12, 0.8, q);
            stash[i] && (stash[i].hide = q > 0.38 && q < 0.8 ? 1 : 0);
          }
          if (q < 0.32) { // the empty one falls away, turning over as it goes
            u.mag.position.addScaledVector(new THREE.Vector3(...MR.drop), drop * drop);
            const sp = MR.spin || [0.9, 0, 0.6];
            u.mag.rotation.set(sp[0] * drop, sp[1] * drop, sp[2] * drop);
            u.mag.visible = drop < 0.98;
          }
          else if (q < 0.4) u.mag.visible = false;
          else if (q < (belted ? 0.72 : 0.78) && hand) { u.mag.visible = true; u.mag.position.copy(hand.position).add(off); }
          if (belted && q < 0.32) { u.belt.position.addScaledVector(new THREE.Vector3(...MR.drop), drop); u.belt.visible = drop < 0.98; } // the old belt goes with the old box
          else if (belted && q < 0.72) u.belt.visible = false;
          oz += bump(0.72, 0.8, q) * (id === 'pistol' ? 0.3 : 0.4); // pushed home
          oy += bump(0.72, 0.8, q) * 0.25; // the gun gives a little under the push
          rx -= bump(0.86, 0.94, q) * 0.12; // bolt (or slide) forward
        } else if (id === 'shotgun') {
          // Roll it over; four trips to the rack, each shell thumbed into the loading port; rack the pump.
          ({ rx, ry, rz, ox, oy, oz } = scaled(reloadPose(id), tilt));
          const hand = hands[1], port = new THREE.Vector3(0, -0.9, -0.3), R0 = this.rackPoint(g, i, fromBody);
          const R = R0 && fromBody ? port.clone().lerp(R0, 0.55) : R0; // off the vest: a short dip to the loops on your chest, just below the port
          const load = ss(0.12, 0.2, rp) * (1 - ss(0.78, 0.85, rp));
          if (hand) {
            hand.position.lerp(port, load);
            hand.rotation.x = hand.userData.rest.rot + load * 0.5;
            const inLoad = rp > 0.2 && rp < 0.78, f = (clamp((rp - 0.2) / 0.58, 0, 0.999) * 4) % 1;
            if (inLoad && R) {
              // 0-.4 out to the rack, .4-.5 grab, .5-.9 back to the port, .9-1 push the shell in.
              if (f < 0.4) hand.position.lerpVectors(port, R, ss(0, 0.4, f));
              else if (f < 0.5) hand.position.copy(R);
              else if (f < 0.9) hand.position.lerpVectors(R, port, ss(0.5, 0.9, f));
              else hand.position.copy(port).add(new THREE.Vector3(0, 0.25 * bump(0.9, 1, f), 0));
              if (u.shell && f > 0.45) { u.shell.visible = true; u.shell.position.copy(hand.position).add(new THREE.Vector3(0, 0.55, 0)); }
              if (stash[i]) stash[i].hide = f > 0.45 ? 1 : 0;
            } else if (stash[i]) stash[i].hide = 0;
          }
          const rack = bump(0.86, 0.98, rp);
          u.pump.position.z = rack * 1.2;
          if (hand && rp > 0.85) hand.position.z += rack * 1.2;
        } else if (id === 'rocket') {
          // The front hand reaches to the rack, lifts a warhead off it and slides it into the muzzle.
          ({ rx, ry, rz, ox, oy, oz } = scaled(reloadPose(id), tilt));
          const hand = hands[1], R = this.rackPoint(g, i, fromBody), front = new THREE.Vector3(0, -0.6, -6.5);
          if (hand && R) {
            const rest = hand.userData.rest.pos;
            const home = new THREE.Vector3(0, -0.6, -5.3); // the warhead slid down into the tube
            Motion.path([[0.12, rest], [0.32, R], [0.4, R], [0.6, front], [0.82, home], [0.95, rest]], rp, hand.position);
            if (stash[i]) stash[i].hide = rp > 0.36 && rp < 0.82 ? 1 : 0;
            if (u.tip) {
              u.tip.visible = rp > 0.36;
              if (rp < 0.6) u.tip.position.copy(hand.position).add(new THREE.Vector3(0, 0.9, -1.0));
              else u.tip.position.lerpVectors(new THREE.Vector3(0, 0.3, -7.5), new THREE.Vector3(0, 0, -6.3), ss(0.6, 0.82, rp));
            }
          }
        } else if (id === 'flare') {
          // Break the barrel open, the spent case flips out, a fresh one goes in, snap it shut.
          ({ rx, ry, rz, ox, oy, oz } = scaled(reloadPose(id), tilt));
          const open = ss(0.08, 0.25, rp) * (1 - ss(0.78, 0.9, rp));
          u.barrelGrp.rotation.x = -0.75 * open;
          if (u.shell) {
            if (rp > 0.25 && rp < 0.45) { const f = (rp - 0.25) / 0.2, B = u.breech || [0, 0.4, 0.6]; u.shell.visible = true; u.shell.position.set(B[0] + 0.3 * f, B[1] + 2.5 * f, B[2] + 2.5 * f); u.shell.rotation.set(Math.PI / 2 + f * 3, 0, f * 2); }
            else if (rp > 0.5 && rp < 0.75) {
              const f = ss(0.5, 0.72, rp), R = this.rackPoint(g, i, fromBody) || new THREE.Vector3(0, -2.5, 1.5);
              u.shell.visible = true;
              u.shell.position.lerpVectors(R, new THREE.Vector3(...(u.breech || [0, 0.3, 0.2])), f);
              u.shell.rotation.set(Math.PI / 2, 0, 0);
            }
            // The other hand fetches it: down to the rack, back up with the shell, thumbs it in, away again.
            const hand = hands[1], R = this.rackPoint(g, i, fromBody);
            if (hand && hand.userData.spare && R) {
              const rest = hand.userData.rest.pos, grip = new THREE.Vector3(0, -0.5, 0.35);
              hand.visible = true;
              if (rp < 0.5) hand.position.lerpVectors(rest, R.clone().sub(grip), ss(0.25, 0.5, rp));
              else if (rp < 0.75) hand.position.copy(u.shell.position).sub(grip);
              else hand.position.lerpVectors(new THREE.Vector3(...(u.breech || [0, 0.3, 0.2])).sub(grip), rest, ss(0.76, 0.92, rp));
            }
            if (stash[i]) stash[i].hide = rp > 0.5 && rp < 0.75 ? 1 : 0;
          }
          oz += bump(0.85, 0.95, rp) * 0.3; // snap shut
        } else {
          // Nail gun, flamethrower, harpoon: tip it over, the other hand fetches a strip, a can or a bolt from the
          // rack and feeds it in; the one-handed nail gun just gets turned over and slapped.
          ({ rx, ry, rz, ox, oy, oz } = scaled(reloadPose(id), tilt));
          const hand = hands[1], R = this.rackPoint(g, i, fromBody);
          if (hand && R) {
            const rest = hand.userData.rest.pos;
            Motion.path([[0.12, rest], [0.35, R], [0.45, R], [0.78, rest]], rp, hand.position);
            hand.rotation.x = hand.userData.rest.rot + 0.5 * bump(0.12, 0.78, rp);
          }
          if (stash[i]) stash[i].hide = rp > 0.38 && rp < 0.72 ? 1 : 0;
          if (hand) hand.visible = true;
          if (id === 'nailgun' && hand && R) { // a fresh strip up from the vest, lined up behind the raked magazine and slid in from the back
            if (!u.strip) { u.strip = Models.ammoItem('nailgun', 0); u.strip.scale.setScalar(1.8); u.strip.rotation.x = Math.PI / 2 + 0.341; g.add(u.strip); }
            const mz = new THREE.Vector3(0, -1.0, -0.3), d = new THREE.Vector3(0, -Math.sin(0.341), Math.cos(0.341)), at = (sv) => mz.clone().addScaledVector(d, sv);
            const grip = (c) => c.clone().addScaledVector(d, 1.15).add(new THREE.Vector3(0, -0.35, 0)); // the hand holds the strip's back end
            const ready = at(2.9), home = at(0.4), rest = hand.userData.rest.pos, held = grip(new THREE.Vector3()); // (held: from the strip's middle to the hand)
            // Down to the vest, a beat to take a strip, up behind the magazine, a straight slide home along the track,
            // a moment holding it in, and back. The strip rides in the hand.
            Motion.path([[0.1, rest], [0.3, R], [0.36, R], [0.58, grip(ready)], [0.72, grip(home)], [0.75, grip(home)], [0.9, rest]], rp, hand.position);
            const c = rp > 0.36 && rp < 0.75 ? hand.position.clone().sub(held) : null;
            hand.rotation.x = hand.userData.rest.rot + 0.4 * bump(0.1, 0.85, rp);
            u.strip.visible = !!c;
            if (c) u.strip.position.copy(c);
            oz += bump(0.7, 0.78, rp) * 0.25; // the pusher snaps shut
          } else if (u.strip) u.strip.visible = false;
          if (u.bolt) { // the harpoon: the new bolt rides in the hand from the rack, then slides home down the rail
            u.bolt.visible = rp > 0.4;
            const home = new THREE.Vector3(0, 0.36, -2.65), front = home.clone().add(new THREE.Vector3(0, 0.1, -3.2));
            // One flowing move: the hand brings the bolt up to the front of the rail, slides it home, lets go, and goes
            // back to the grip; the bolt rides in the hand until it's home.
            if (hand && R) {
              const atFront = front.clone().add(new THREE.Vector3(0, -0.55, 0.6)), atHome = home.clone().add(new THREE.Vector3(0, -0.55, 0.8));
              Motion.path([[0.12, hand.userData.rest.pos], [0.35, R], [0.45, R], [0.6, atFront], [0.63, atFront], [0.76, atHome], [0.8, atHome], [0.95, hand.userData.rest.pos]], rp, hand.position);
              if (rp > 0.4 && rp < 0.78) u.bolt.position.copy(hand.position).add(new THREE.Vector3(0, 0.55, -0.6 - 0.2 * ss(0.63, 0.76, rp)));
              else if (rp >= 0.78) u.bolt.position.copy(home);
            }
          }
          if (u.clip) u.clip.visible = rp > 0.62; // a fresh clip pressed in from the top
          oz += bump(0.74, 0.82, rp) * 0.35; // seated
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
      const K = this.kick; // the firing kick, on springs
      const [hp, hy, hr] = u.holdRot || [0, 0, 0];
      // Down the sights: brought up to the middle with its top sight line under your eye, square to the view; the
      // sway and bob calm right down.
      const a = this.adsK * this.adsK * (3 - 2 * this.adsK), calm = 1 - 0.7 * a;
      if (u.sightY == null) u.sightY = this.sightHeight(g);
      const [ax, ay, az] = ADS_POSE[id] || [0, 0, 0];
      const bx = lerp(x, ax, a), by = lerp(y, -u.sightY * g.scale.y - 0.12 + ay, a), bz = lerp(z, z * 0.92 + az, a);
      g.position.set(bx + (sw.x * 0.5) * calm + ox + K.y * 2, by + (bob + sw.y * 0.4) * calm - this.dip - raise + oy + K.p * 1.6, bz + K.z + oz);
      g.rotation.set(lerp(hp, 0, a) + K.p - this.dip * 0.15 + sw.y * 0.06 * calm + rx + dry, lerp(hy, 0, a) + sw.r * 0.3 * calm + ry + K.y, lerp(hr, 0, a) - sw.x * 0.1 * calm + rz + K.r);
      this.aimArms(g, hands);
    });
    const held = vm.guns[combat.wi];
    vm.flash.visible = this.flash > 0;
    vm.flash.scale.setScalar((this.flashK || 1) * 0.75);
    vm.flash.userData.mat.opacity = vm.flash.userData.plume.opacity = clamp(this.flash / 0.02, 0, 1);
    // A flicker of light on the hands and round the cabin, not a floodlight.
    this.muzzleLight.intensity = Math.min(1.6, Math.max(0, this.flash) * 30 * (this.lightK || 0));
    this.cabinFlash.intensity = Math.min(0.6, Math.max(0, this.flash) * 9 * (this.lightK || 0));
    // Flash at the gun's actual muzzle (the held gun is turned in, so a fixed offset would miss it).
    if (held.userData.barrel) {
      held.updateMatrix();
      vm.flash.position.copy(held.userData.barrel.position).applyMatrix4(held.matrix).add(new THREE.Vector3(0, 0, -0.6).applyEuler(held.rotation));
    } else vm.flash.position.set(held.userData.hold[0] + 0.2, held.userData.hold[1] + 0.3, held.userData.hold[2] - 6.5);
    vm.flash.quaternion.copy(held.quaternion); // the plume runs along the barrel
    vm.flash.children[0].quaternion.copy(held.quaternion).invert(); // the core faces the camera
    vm.flash.children[0].rotation.z = Math.random() * TAU;
    this.muzzleLight.position.copy(vm.flash.position);
    this.updatePuffs(dt);
  }

  // A shot: kick the gun on its springs, punch the view, light the flash, start a smoke puff.
  // The height of a gun's sight line in its own space: the top of the gun along its middle (the shield and mount
  // on a roof gun, the hands and arms don't count).
  sightHeight(g) {
    const skip = new Set();
    for (const h of g.userData.hands || []) h.traverse((o) => skip.add(o));
    for (const k of ['shieldKit']) if (g.userData[k]) g.userData[k].traverse((o) => skip.add(o));
    g.updateMatrixWorld(true);
    const inv = g.matrixWorld.clone().invert(), bb = new THREE.Box3(), top = { y: -Infinity };
    g.traverse((o) => {
      if (!o.isMesh || skip.has(o) || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      bb.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (bb.max.x - bb.min.x > 2.4 || Math.abs((bb.max.x + bb.min.x) / 2) > 0.6) return; // off to the side, or a wide plate
      top.y = Math.max(top.y, bb.max.y);
    });
    return isFinite(top.y) ? top.y : 0.6;
  }

  // Your arms, shoulder to elbow to wrist. The shoulders stay put by the camera (where they sit with the gun at
  // rest) while the gun tips about and the hands move; each arm bends at an elbow solved between the two, pointing
  // down and out, as arms do. The forearm (the glove's sleeve) runs from the wrist to the elbow and an upper arm
  // from the elbow to the shoulder. A hand that's left its grip (reloading, pumping) also turns to follow its arm.
  aimArms(g, hands) {
    if (!hands.length) return;
    if (!g.userData.shoulderCam) { // once: each hand's shoulder in camera space, from the gun's hold pose
      const [x, y, z] = g.userData.hold, [hp, hy, hr] = g.userData.holdRot || [0, 0, 0];
      const M = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(hp, hy, hr)), g.scale.clone());
      g.userData.shoulderCam = hands.map((h) => (h.userData.shoulder ? h.userData.shoulder.clone().applyMatrix4(M) : null));
    }
    g.updateMatrix();
    const inv = g.matrix.clone().invert(), toGun = g.quaternion.clone().invert();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    hands.forEach((h, k) => {
      const S0 = g.userData.shoulderCam[k], R = h.userData.rest, SL = h.userData.sleeve, U = h.userData;
      if (!S0 || !U.armDir || !SL) return;
      if (!U.upper) { // the upper arm and an elbow joint, made once, in the gun's space
        U.upper = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.78, 1, 12, 1, true).translate(0, 0.5, 0), SL.mat);
        U.elbow = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 8), SL.mat);
        g.add(U.upper, U.elbow);
        if (typeof PSX !== 'undefined') { PSX.apply(U.upper); PSX.apply(U.elbow); }
        // Arm lengths from the reach at rest (a spare hand rests out of sight, so it gets a typical reach): a little
        // longer than that reach, so the elbow is bent when you hold the gun.
        const rest = new THREE.Matrix4().compose(R.pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(R.rot, 0, 0)), h.scale.clone());
        const reach = U.spare ? 8.0 : U.shoulder.distanceTo(SL.wrist.clone().applyMatrix4(rest));
        U.armLen = reach * 1.14 / 2; // upper arm and forearm the same length
      }
      U.upper.visible = U.elbow.visible = h.visible;
      if (!h.visible) return;
      const S = S0.clone().applyMatrix4(inv);
      // A hand off its grip turns to follow its arm (towards the shoulder, which is near enough for the wrist).
      const off = h.position.distanceTo(R.pos);
      if (off >= 0.05 || U.spare) {
        const cur = h.quaternion.clone(), d0 = U.armDir.clone();
        d0.x *= h.scale.x;
        d0.applyQuaternion(cur);
        const q = new THREE.Quaternion().setFromUnitVectors(d0.normalize(), S.clone().sub(h.position).normalize()).multiply(cur);
        h.quaternion.slerpQuaternions(cur, q, U.spare ? 1 : clamp(off / 1.2, 0, 1));
      }
      h.updateMatrix();
      // The elbow: two equal bones from the shoulder to the wrist, bent towards a pole down and out to that side.
      const W = SL.wrist.clone().applyMatrix4(h.matrix), L = U.armLen, sw = W.clone().sub(S), d = sw.length(), dir = sw.clone().divideScalar(d || 1);
      const side = h.scale.x < 0 ? -1 : 1; // the left hand's elbow goes out to the left
      const pole = V(side * 0.6, -1, 0.35).applyQuaternion(toGun);
      pole.addScaledVector(dir, -pole.dot(dir)).normalize();
      let E;
      if (d >= 2 * L - 0.01) E = S.clone().addScaledVector(dir, d / 2); // at full stretch: straight
      else { const a = d / 2, hh = Math.sqrt(Math.max(0, L * L - a * a)); E = S.clone().addScaledVector(dir, a).addScaledVector(pole, hh); }
      // Forearm: the sleeve turned about the wrist to point at the elbow and sized to reach it (the cuff turns with it).
      const Ml = E.clone().applyMatrix4(h.matrix.clone().invert()).sub(SL.wrist), len = Ml.length();
      const q = new THREE.Quaternion().setFromUnitVectors(SL.dir, Ml.divideScalar(len || 1));
      // Sized to reach the elbow, and filled out round (a forearm is thicker than the glove's cuff suggests).
      const k2 = clamp(len / SL.L, 0.3, 1.4), D = SL.dir, r = 1.3, e = k2 - r, Wl = SL.wrist;
      const stretch = new THREE.Matrix4().set(
        r + e * D.x * D.x, e * D.x * D.y, e * D.x * D.z, 0,
        e * D.y * D.x, r + e * D.y * D.y, e * D.y * D.z, 0,
        e * D.z * D.x, e * D.z * D.y, r + e * D.z * D.z, 0,
        0, 0, 0, 1);
      const turn = new THREE.Matrix4().makeTranslation(Wl.x, Wl.y, Wl.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q));
      SL.mesh.matrixAutoUpdate = false;
      SL.mesh.matrix.copy(turn).multiply(stretch).multiply(new THREE.Matrix4().makeTranslation(-Wl.x, -Wl.y, -Wl.z));
      if (SL.cuff) { SL.cuff.matrixAutoUpdate = false; SL.cuff.matrix.copy(turn).multiply(new THREE.Matrix4().makeTranslation(-Wl.x, -Wl.y, -Wl.z)); }
      // Upper arm: from the elbow to the shoulder.
      const up = S.clone().sub(E), ul = up.length();
      U.upper.position.copy(E);
      // How far this hand has gone for the board (it drops well below its grip): the body leans in to match. (Not
      // for your own chest rig: that's right there.)
      if (!this.bodyReach && h.visible && (off > 0.3 || U.spare)) { const yc = W.clone().applyMatrix4(g.matrix).y, y0 = SL.wrist.clone().applyMatrix4(new THREE.Matrix4().compose(R.pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(R.rot, 0, 0)), h.scale)).applyMatrix4(g.matrix).y; this.reachNow = Math.max(this.reachNow || 0, clamp(((U.spare ? -2.5 : y0) - yc) / 3, 0, 1)); }
      U.upper.quaternion.setFromUnitVectors(V(0, 1, 0), up.divideScalar(ul || 1));
      U.upper.scale.set(1, ul, 1);
      U.elbow.position.copy(E);
    });
  }

  // A belt-fed reload, once the new box is on: flip up the feed cover, take the belt's free end (hanging off the
  // box), lay it across the feed tray, slam the cover down. rp runs 0.72 to 1 here.
  loadBelt(u, hand, well, rest, rp) {
    const ss = (a, c, x) => { const k = clamp((x - a) / (c - a), 0, 1); return k * k * (3 - 2 * k); };
    const V = (x, y, z) => new THREE.Vector3(x, y, z), B = V(...u.beltRest);
    const coverRear = V(0.1, 1.15, 0.7), coverUp = V(0.1, 2.3, -0.1), hang = B.clone().add(V(-0.4, -0.55, 0.15)), press = V(0.05, 1.05, -0.9);
    const open = ss(0.75, 0.8, rp) * (1 - ss(0.9, 0.93, rp));
    u.cover.rotation.x = -1.15 * open;
    const lay = ss(0.84, 0.89, rp); // the free end: hanging off the box, then lifted into the tray
    u.belt.visible = true;
    u.belt.position.lerpVectors(hang, B, lay);
    u.belt.rotation.set(0, 0, 0.9 * (1 - lay));
    if (rp < 0.75) hand.position.lerpVectors(well, coverRear, ss(0.72, 0.75, rp));
    else if (rp < 0.8) hand.position.lerpVectors(coverRear, coverUp, ss(0.75, 0.8, rp)); // lifting the cover
    else if (rp < 0.84) hand.position.lerpVectors(coverUp, hang, ss(0.8, 0.84, rp));
    else if (rp < 0.89) hand.position.copy(u.belt.position).add(V(0.1, 0.25, 0)); // carrying the belt in
    else if (rp < 0.93) hand.position.lerpVectors(B.clone().add(V(0.1, 0.25, 0)), press, ss(0.89, 0.93, rp)); // and slamming the cover
    else hand.position.lerpVectors(press, rest, ss(0.93, 1, rp));
  }

  fireKick(k) {
    const K = this.kick, j = () => Math.random() * 2 - 1;
    K.vz += k.back * 14;
    K.vp += k.climb * (9 + Math.random() * 3);
    K.vy += k.yaw * j() * 12;
    K.vr += k.roll * j() * 12;
    K.vcp += k.cam * 30;
    // The punch lands at once: part of the shove and the climb are there on the frame it goes off.
    K.z += k.back * 0.35; K.p += k.climb * 0.3; K.cp += k.cam * 0.35;
    K.vcr += (k.croll || 0) * (Math.random() < 0.5 ? -1 : 1) * (24 + Math.random() * 10);
    K.f += (k.fov || 0) * 0.6; K.vf += (k.fov || 0) * 30;
    if (k.shake) this.shake = Math.max(this.shake, k.shake);
    if (k.flash) { // about two frames: a real flash is gone almost as soon as you see it
      this.flash = 0.032 + k.flash * 0.006; this.flashK = k.flash;
      const fl = this.vm.flash.userData, tint = k.color || '#ffffff', vars = Cockpit3DTex.flash();
      fl.mat.map = vars[Math.floor(Math.random() * vars.length)]; fl.mat.color.set(tint); fl.plume.color.set(tint);
      this.vm.flash.children[1].scale.set(0.8 + Math.random() * 0.4, 0.7 + Math.random() * 0.6, 1); this.vm.flash.children[2].scale.copy(this.vm.flash.children[1].scale);
    }
    this.lightK = k.light;
    this.muzzleLight.color.set(k.color || '#ffc070');
    this.cabinFlash.color.set(k.color || '#ffc070');
    if (k.smoke) this.puff(k.smoke);
  }

  // The recoil that moves your view: up (and kept up while you hold the trigger) and a random kick sideways.
  recoil2(id, soft) {
    const R = RECOIL[id] || RECOIL.smg, c = this.combat, L = this.look;
    const k = soft * (1 - (1 - ADS.recoil) * (this.adsK || 0)) * (c.exposed ? ROOF.steady : 1);
    const up = R.v * k * (0.85 + Math.random() * 0.3);
    L.pitch = clamp(L.pitch + up, -0.75, 0.6);
    L.yaw += (Math.random() * 2 - 1) * R.h * k;
    this.recDebt = (this.recDebt || 0) + up * R.rec; // what settles back once you let go
  }

  // Springs back to rest with a little overshoot (two substeps keep it stable at low frame rates).
  updateKick(dt) {
    const K = this.kick;
    for (let s = 0; s < 2; s++) {
      const h = dt / 2;
      for (const [x, v, kk, cc] of [['z', 'vz', 210, 19], ['p', 'vp', 210, 19], ['y', 'vy', 170, 19], ['r', 'vr', 190, 19], ['cp', 'vcp', 260, 26], ['cr', 'vcr', 240, 24], ['f', 'vf', 320, 34]]) {
        K[v] += (-kk * K[x] - cc * K[v]) * h;
        K[x] += K[v] * h;
      }
    }
  }

  puff(size) {
    const p = this.gunSmoke.find((q) => q.t >= q.life);
    if (!p) return;
    p.t = 0; p.life = 0.6 + size * 0.5; p.size = size;
    p.pos = this.vm.flash.position.clone();
    p.vel = new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.2 + Math.random(), -1.5 - Math.random() * 2);
    p.m.visible = true;
  }

  updatePuffs(dt) {
    for (const p of this.gunSmoke) {
      if (!p.pos || !(p.t < p.life)) { p.m.visible = false; continue; }
      p.t += dt;
      const f = p.t / p.life;
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.max(0, 1 - dt * 1.5));
      p.m.position.copy(p.pos);
      p.m.scale.setScalar(p.size * (0.6 + f * 2.2));
      p.m.material.opacity = 0.35 * (1 - f) * Math.min(1, f * 6);
      p.m.rotation.z += dt * 0.8;
    }
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
    show(this.pools.nade, c.grenades, (o, g) => {
      o.position.set(g.x, Math.max(2, g.z + 1), g.y);
      // Tumbling in the air, rolling along the road.
      const sp = Math.hypot(g.vx || 0, g.vy || 0);
      if (g.rolling) { o.rotation.set(Math.PI / 2, -Math.atan2(g.vy, g.vx), (o.rotation.z || 0) - sp * 0.02); } else o.rotation.set(g.t * (g.spin || 8), g.t * 3, 0);
      const f = o.userData.fuse;
      if (f) { const left = g.fuse - g.t; f.visible = !g.inCar; f.material.color.set(left < 0.5 && Math.floor(t * 20) % 2 ? '#ff5a2a' : '#ffd27a'); f.scale.setScalar(0.6 + Math.random() * 0.7); }
    });
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
    show(this.pools.flame, c.projectiles.filter((q) => q.type === 'flame'), (o, q) => {
      const k = q.t / q.life;
      o.position.set(q.x, 9.5 + k * 3, q.y); // above the bonnet, rising as it burns
      o.scale.setScalar(1.5 + 9 * k);
      o.material.color.setHSL(0.12 - 0.1 * k, 1, 0.55 - 0.15 * k);
      o.material.opacity = 0.85 * (1 - k);
    });
    show(this.pools.harpoon, c.projectiles.filter((q) => q.type === 'harpoon'), (o, q) => {
      o.position.set(q.x, 8, q.y);
      o.rotation.set(0, -Math.atan2(q.vy, q.vx), 0);
    });
    { // the harpoon line: from your car to the bolt in flight, or to whoever's hooked
      const pts = [];
      for (const q of c.projectiles) if (q.type === 'harpoon') pts.push([q.owner, q]);
      for (const car of this.race.cars) if (car.hookT > 0 && car.hookBy) pts.push([car.hookBy, car]);
      if (!this.hookLines) { this.hookLines = []; for (let k = 0; k < 4; k++) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#d8cfb8' })); l.frustumCulled = false; this.scene.add(l); this.hookLines.push(l); } }
      this.hookLines.forEach((l, k) => {
        l.visible = k < pts.length;
        if (!l.visible) return;
        const [a, b2] = pts[k], P = l.geometry.attributes.position;
        P.setXYZ(0, a.x, 7, a.y); P.setXYZ(1, b2.x, 8, b2.y); P.needsUpdate = true;
      });
    }
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
    this.puffs = this.puffs.filter((pf) => pf.t < (pf.life || 0.8));
    show(this.pools.puff, this.puffs, (o, pf) => {
      if (pf.column) { // wreck smoke: rises high, spreads, drifts
        const k = pf.t / pf.life;
        o.position.set(pf.x + pf.t * 6, 10 + pf.t * 34, pf.y + pf.t * 3);
        o.scale.setScalar(3 + pf.t * 9);
        o.material.color.set(k < 0.15 ? '#3a2a1a' : '#121010');
        o.material.opacity = 0.6 * (1 - k);
        return;
      }
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
      if (car.vendetta && car.hp > 0) { ctx.strokeStyle = '#ff2020'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.stroke(); } // a vendetta: ringed in red
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
    if (c.roofIdx >= 0) { // the roof gun: press V; up top, how much shield is left
      const S = c.shield, R = b.roof;
      ctx.textAlign = 'right';
      ctx.fillStyle = c.exposed ? '#ff9f1c' : '#ffb000';
      ctx.fillText(c.exposed ? (S.hp ? (R.shieldHp > 0 ? `UP · SHIELD ${Math.round((100 * R.shieldHp) / S.hp)}%` : 'UP · NO SHIELD') : 'UP · EXPOSED') : 'V: ROOF GUN', 246, 122);
      ctx.textAlign = 'left';
    }
    // Your four tyres, nose up: amber and full, darkening as they're shot, flashing red when flat.
    if (p.tyres) {
      const max = Math.max(...p.tyres, 40);
      [[1, 0], [0, 0], [1, 1], [0, 1]].forEach(([right, rear], i) => {
        const x = 214 + right * 22, y = 72 + rear * 22, h = clamp(p.tyres[i] / (p.tyreMax || max), 0, 1);
        ctx.fillStyle = p.tyres[i] <= 0 ? (Math.floor(t * 4) % 2 ? '#ff3b1f' : '#5a1408') : h < 0.5 ? '#ff7a1f' : '#ffb000';
        ctx.fillRect(x, y, 10, 16);
      });
      ctx.fillStyle = 'rgba(255,176,0,0.35)';
      ctx.fillRect(226, 76, 8, 30); // the body between them
    }
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
