'use strict';
// The garage between races, as a place: your car up on a lift, your guns on a pegboard, a caged commissary
// with a trader and goods on the counter, a paint booth and a roll-up door out to the track.
// The camera moves between stations; the UI is a clipboard beside it. Everything in the room reflects your
// run: the guns you own, the mods and grenades on the bench, trinkets on the shelf, strikes on the chalkboard.
// In the upper-city acts the sponsors have smartened the place up.

const GARAGE_LIFT = { x: 0, y: 6, z: 10 };

// Camera poses per station: [position, look-at].
const GARAGE_POSES = {
  car: [[54, 21, 40], [0, 11, 8]],
  weapons: [[-60, 36, -24], [-60, 36, -100]],
  market: [[108, 32, -12], [109, 24, -66]],
  overview: [[96, 52, 86], [-16, 12, -22]],
};

class Garage3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.3, 900);
    this.post = new PSXPost(this.renderer);
    this.raycaster = new THREE.Raycaster();
    this.size = [0, 0, 0];
    this.station = 'car';
    this.mode = 'car';
    this.orbit = 0.6;
    this.orbitPitch = 30;
    this.orbitR = 74;
    this.userOrbit = false; // the turntable idles until you grab it
    this.cabinLook = { yaw: -0.35, pitch: -0.22 };
    this.mouse = { x: 0, y: 0 };
    this.cam = { pos: new THREE.Vector3(...GARAGE_POSES.overview[0]), look: new THREE.Vector3(...GARAGE_POSES.overview[1]) };
    this.luxury = null;
    this.hover = null;
    this.setTheme(false);
  }

  // ---------- Room ----------

  setTheme(luxury) {
    if (luxury === this.luxury) return;
    this.luxury = luxury;
    if (this.room) this.scene.remove(this.room);
    const S = this.scene;
    S.background = new THREE.Color(luxury ? '#1c1a16' : '#0c0b0a');
    S.fog = new THREE.Fog(S.background, 160, 420);
    const R = (this.room = new THREE.Group());
    this.hotRoot = new THREE.Group();
    R.add(this.hotRoot);
    R.add(new THREE.HemisphereLight(luxury ? '#fff4e0' : '#d8dce0', '#4a4238', luxury ? 1.3 : 1.05));
    // Fluorescent tubes (one flickers) and the commissary's bare bulb.
    this.lights = [];
    for (const [x, z, c, i] of [[0, 10, '#e8f0ff', 2.6], [-62, -64, '#e8f0ff', 2.2], [-96, 70, '#f4f8ff', 1.6], [110, -72, '#ffc878', 2.4]]) {
      const l = new THREE.PointLight(luxury && c !== '#ffc878' ? '#fff2dc' : c, i, 320, 0.8);
      l.position.set(x, z === -72 ? 48 : 64, z);
      R.add(l);
      this.lights.push(l);
      if (z !== -72) {
        R.add(LP.box(30, 1.2, 4, LP.mat('#3a3a3a'), x, 69, z));
        R.add(LP.box(28, 0.8, 1.6, LP.glow('#f4f8ff', 1.4), x, 68.2, z - 0.8));
        R.add(LP.box(28, 0.8, 1.6, LP.glow('#f4f8ff', 1.4), x, 68.2, z + 0.8));
      }
    }
    this.buildShell(R, luxury);
    this.buildLift(R);
    this.buildArmory(R, luxury);
    this.buildCommissary(R, luxury);
    this.buildBooth(R, luxury);
    this.buildDoor(R, luxury);
    this.buildClutter(R, luxury);
    if (!this.dyn) { this.dyn = new THREE.Group(); }
    R.add(this.dyn);
    if (this.carGroup) R.add(this.carGroup);
    PSX.apply(R);
    PSX.setTextures(R, PSX.enabled);
    S.add(R);
  }

  tex(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
    return t;
  }

  // A sculpted prop (see js/sculpt.js): fill(sc) adds the parts; meshed once and shared.
  sculpt(R, key, cell, fill) {
    const sc = new Sculpt('garage:' + key, cell);
    fill(sc);
    return sc.build(R);
  }

  plane(w, h, map, x, y, z, ry, extra) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), LP.mat('#ffffff', Object.assign({ map }, extra || {})));
    m.position.set(x, y, z);
    m.rotation.y = ry || 0;
    return m;
  }

  hot(obj, action, arg, label) {
    obj.userData.hot = { action, arg, label };
    this.hotRoot.add(obj);
    return obj;
  }

  buildShell(R, luxury) {
    const rng = mulberry32(17);
    // Floor: concrete with oil stains, cracks and yellow lines round the lift (polished epoxy uptown).
    const floor = this.tex(512, 400, (g, W, H) => {
      g.fillStyle = luxury ? '#5a5a58' : '#4a4740'; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 4000; k++) { g.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '255,255,255'},${rng() * (luxury ? 0.03 : 0.06)})`; g.fillRect(rng() * W, rng() * H, 2, 2); }
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
      for (let x = 0; x < W; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = 0; y < H; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      const stains = luxury ? 4 : 26;
      for (let k = 0; k < stains; k++) { g.fillStyle = `rgba(10,8,6,${0.2 + rng() * 0.35})`; g.beginPath(); g.ellipse(rng() * W, rng() * H, 6 + rng() * 26, 4 + rng() * 16, rng() * 3, 0, TAU); g.fill(); }
      if (!luxury) for (let k = 0; k < 12; k++) {
        let x = rng() * W, y = rng() * H;
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < 6; j++) { x += (rng() - 0.5) * 30; y += (rng() - 0.5) * 30; g.lineTo(x, y); }
        g.stroke();
      }
      // Lift bay box (room is 260 x 200 → 512 x 400 px).
      const px = (x) => (x + 130) * (W / 260), pz = (z) => (z + 100) * (H / 200);
      g.strokeStyle = luxury ? '#d9b24a' : '#d9b52c'; g.lineWidth = 4;
      g.strokeRect(px(-40), pz(-14), px(40) - px(-40), pz(34) - pz(-14));
      g.fillStyle = '#1a1a1a'; g.fillRect(px(-6), pz(60), 24, 12); // drain
      g.fillStyle = luxury ? '#d9b24a' : '#d9b52c';
      for (let k = 0; k < 6; k++) g.fillRect(px(-128) + 4, pz(-30) + k * 22, 6, 12); // door line
    });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(260, 200).rotateX(-Math.PI / 2), LP.mat('#ffffff', { map: floor, roughness: luxury ? 0.35 : 0.95 }));
    fl.material.userData.psxSnap = true;
    R.add(fl);
    // Walls: cinderblock, or painted cream with a gold stripe.
    const wallTex = (len) => this.tex(256, 128, (g, W, H) => {
      if (luxury) {
        g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#2a2826'; g.fillRect(0, H * 0.62, W, H * 0.38);
        g.fillStyle = '#d9b24a'; g.fillRect(0, H * 0.6, W, 4);
        g.fillStyle = 'rgba(0,0,0,0.05)'; for (let x = 0; x < W; x += 64) g.fillRect(x, 0, 1, H);
      } else {
        g.fillStyle = '#6a665e'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#4a4740';
        for (let y = 0; y < H; y += 16) { g.fillRect(0, y, W, 2); for (let x = (y / 16) % 2 ? 0 : 16; x < W; x += 32) g.fillRect(x, y, 2, 16); }
        for (let k = 0; k < 600; k++) { g.fillStyle = `rgba(0,0,0,${rng() * 0.08})`; g.fillRect(rng() * W, rng() * H, 3, 3); }
        for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(20,16,10,${0.08 + rng() * 0.12})`; g.fillRect(rng() * W, 0, 2 + rng() * 5, H * (0.2 + rng() * 0.7)); }
        g.fillStyle = 'rgba(30,24,16,0.3)'; g.fillRect(0, H - 14, W, 14);
      }
    }, [len / 64, 72 / 32 / 2]);
    for (const [w, x, z, ry] of [[260, 0, -100, 0], [260, 0, 100, Math.PI], [200, -130, 0, Math.PI / 2], [200, 130, 0, -Math.PI / 2]]) {
      const m = this.plane(w, 72, wallTex(w), x, 36, z, ry, { roughness: 1 });
      m.material.userData.psxSnap = true;
      R.add(m);
    }
    R.add(LP.box(260, 2, 200, LP.mat(luxury ? '#3a3834' : '#1e1d1b'), 0, 73, 0)); // ceiling
    for (let x = -110; x <= 110; x += 44) R.add(LP.box(3, 4, 200, LP.mat('#2a2a2a', { metalness: 0.4 }), x, 70, 0)); // roof beams
    // High barred window with a shaft of light.
    R.add(LP.box(40, 12, 1, LP.glow(luxury ? '#ffe8c0' : '#c8d4e0', 1.2), 50, 60, -99.6));
    for (let x = 32; x <= 68; x += 6) R.add(LP.box(1, 12, 1.4, LP.mat('#1a1a1a'), x, 60, -99));
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(40, 90), new THREE.MeshBasicMaterial({ color: luxury ? '#ffe8c0' : '#b8c8d8', transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    shaft.position.set(50, 30, -70);
    shaft.rotation.x = -0.65;
    R.add(shaft);
    // Posters.
    const posters = luxury
      ? [['THE CROWN AWAITS', 'AUREUM GRAND PRIX', '#141210', '#e8c25a'], ['SMILE', 'FOR THE CAMERAS', '#f4f2ec', '#a8322a']]
      : [['WIN YOUR', 'FREEDOM', '#c9a227', '#141210'], ['THE WARDEN', 'IS WATCHING', '#a8322a', '#f0e8d8']];
    posters.forEach(([a, b, bg, fg], i) => {
      const t = this.tex(64, 96, (g, W, H) => {
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.fillStyle = fg; g.textAlign = 'center';
        g.font = 'bold 11px Impact, sans-serif'; g.fillText(a, W / 2, 20, W - 6);
        g.beginPath(); g.arc(W / 2, 48, 14, 0, TAU); g.fill();
        g.fillStyle = bg; g.fillRect(W / 2 - 3, 38, 6, 20);
        g.fillStyle = fg; g.font = 'bold 10px Impact, sans-serif'; g.fillText(b, W / 2, 84, W - 6);
        g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 0, W, 3);
      });
      R.add(this.plane(16, 24, t, 129.4, 40, 40 - i * 26, -Math.PI / 2));
    });
    // CCTV camera in the corner.
    R.add(LP.box(6, 3, 3, LP.mat('#d8d4cc'), 124, 62, 94));
    this.cctv = LP.box(0.6, 0.6, 0.6, LP.glow('#ff2a1a', 2), 121, 62.5, 92.4);
    R.add(this.cctv);
  }

  // Two-post lift: slim columns either side of the car, arms under the sills.
  buildLift(R) {
    const steel = LP.mat(this.luxury ? '#d8d4cc' : '#c9a227', { metalness: 0.4, roughness: 0.5 });
    const dark = LP.mat('#2a2a2a', { metalness: 0.5 });
    const { x, z } = GARAGE_LIFT;
    this.sculpt(R, 'lift', 0.25, (sc) => {
      for (const sz of [-1, 1]) {
        const c = z + sz * 21;
        sc.add(steel, SDF.box([3.4, 40, 3.4], 0.5, [x, 20, c]), 0.6); // post
        sc.add(steel, SDF.box([5.4, 1.2, 5.4], 0.4, [x, 0.6, c]), 0.8); // base plate
        sc.add(dark, SDF.box([4.2, 5, 4.2], 0.5, [x, 6, c]), 0.3); // carriage
        for (const sx of [-1, 1]) {
          const a = sx * sz * 0.35, cx = x + sx * 6, cz = z + sz * 13, dx = Math.sin(a) * 8, dz = Math.cos(a) * 8;
          const outer = [cx + dx * sz, 5, cz + dz * sz], inner = [cx - dx * sz, 5, cz - dz * sz]; // outer end at the post
          sc.add(dark, SDF.cone(outer, inner, 0.8, 0.65), 0.4); // swing arm
          sc.add(dark, SDF.cyl(1.0, 1.6, 'y', 0.3, [inner[0], 5.8, inner[2]]), 0.3); // lifting pad under the sill
        }
      }
      sc.add(dark, SDF.path([[x, 40, z - 21], [x, 41.5, z], [x, 40, z + 21]], 0.4), 0.3); // overhead hose
    });
  }

  buildArmory(R, luxury) {
    // Pegboard shadowboard on the back wall, workbench in front.
    const peg = this.tex(512, 256, (g, W, H) => {
      g.fillStyle = luxury ? '#3a3632' : '#8a6a44'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.4)';
      for (let y = 5; y < H; y += 10) for (let x = 5; x < W; x += 10) g.fillRect(x, y, 2, 2);
      g.fillStyle = luxury ? '#d9b24a' : '#e8e0c8';
      g.font = 'bold 16px monospace';
      ['RACK 1', 'RACK 2', 'RACK 3'].forEach((t, i) => g.fillText(t, 14 + i * 166, 22));
      g.fillText('STASH', 14, 150);
    });
    R.add(this.hot(this.plane(86, 43, peg, -62, 40, -99.5, 0), 'tab', 'weapons', 'Armory: weapons, mods and ammo'));
    R.add(LP.box(40, 1.2, 3, LP.mat('#3a3a3a'), -62, 63, -88));
    R.add(LP.box(38, 0.6, 1.6, LP.glow('#f4f8ff', 1.4), -62, 62.3, -88));
    const wood = LP.mat(luxury ? '#2a2826' : '#5a4630', { roughness: 0.9 });
    R.add(LP.box(84, 2, 16, wood, -62, 18, -91));
    for (const x of [-100, -24]) for (const zz of [-97, -85]) R.add(LP.box(2, 18, 2, LP.mat('#2a2a2a'), x, 9, zz));
    R.add(LP.box(80, 1, 12, wood, -62, 6, -91)); // lower shelf
    this.sculpt(R, 'vice', 0.1, (sc) => { // bench vice: body, jaws, screw and tommy bar
      const iron = LP.mat('#2f4a5a', { metalness: 0.5, roughness: 0.6 }), steelV = LP.mat('#8a8f94', { metalness: 0.8 });
      sc.add(iron, SDF.box([3.4, 1.2, 3.6], 0.4, [-28, 19.6, -95]), 0.3);
      sc.add(iron, SDF.box([2.6, 2.4, 1.4], 0.4, [-28, 21.6, -96.2]), 0.4);
      sc.add(iron, SDF.box([2.6, 2.4, 1.4], 0.4, [-28, 21.6, -93.6]), 0.4);
      sc.add(steelV, SDF.cyl(0.25, 3.6, 'z', 0.05, [-28, 21.2, -92.6]), 0.1);
      sc.add(steelV, SDF.cyl(0.15, 3.2, 'x', 0.05, [-28, 21.2, -91.0]), 0.1);
    });
    // Trinket shelf and the chalkboard (act, race, strikes, scrap).
    R.add(LP.box(30, 1.2, 6, wood, 0, 34, -97));
    R.add(LP.box(30, 1.2, 6, wood, 0, 22, -97));
    this.chalk = { canvas: document.createElement('canvas') };
    this.chalk.canvas.width = 256; this.chalk.canvas.height = 160;
    this.chalk.tex = new THREE.CanvasTexture(this.chalk.canvas);
    this.chalk.tex.colorSpace = THREE.SRGBColorSpace;
    R.add(LP.box(48, 32, 1, LP.mat('#3a2a1a'), 40, 34, -99.6));
    R.add(this.plane(45, 29, this.chalk.tex, 40, 34, -99, 0));
  }

  drawChalk(info) {
    const g = this.chalk.canvas.getContext('2d'), W = 256, H = 160;
    g.fillStyle = '#1e2620'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < 40; k++) g.fillRect(Math.random() * W, Math.random() * H, 30, 3);
    g.fillStyle = '#e8e8e0'; g.font = 'bold 18px "Comic Sans MS", cursive';
    g.fillText(info.act, 12, 28, W - 24);
    g.font = '15px "Comic Sans MS", cursive';
    g.fillText(info.of || `Races run: ${info.race - 1}`, 12, 54, 230);
    g.fillText(`Scrap: ${info.scrap}`, 12, 78);
    g.fillText('Strikes:', 12, 106);
    for (let k = 0; k < info.maxStrikes; k++) {
      g.strokeStyle = '#e8e8e0'; g.lineWidth = 2; g.strokeRect(90 + k * 30, 90, 22, 22);
      if (k < info.strikes) { g.strokeStyle = '#ff6a5a'; g.beginPath(); g.moveTo(92 + k * 30, 92); g.lineTo(110 + k * 30, 110); g.moveTo(110 + k * 30, 92); g.lineTo(92 + k * 30, 110); g.stroke(); }
    }
    g.fillStyle = '#e8e8e0';
    g.fillText(`Rep: ${info.rep}`, 12, 140);
    // Tally of races survived.
    for (let k = 0; k < info.race - 1; k++) { const x = 170 + (k % 5) * 8 + Math.floor(k / 5) * 46; g.fillRect(x, 124, 2, 20); if (k % 5 === 4) { g.save(); g.translate(x - 32, 132); g.rotate(-0.4); g.fillRect(0, 0, 40, 2); g.restore(); } }
    this.chalk.tex.needsUpdate = true;
  }

  buildCommissary(R, luxury) {
    // Caged booth in the corner: chain-link walls, a hatch and counter, a trader and his shelves.
    const link = DECALS.get('mesh').clone();
    link.wrapS = link.wrapT = THREE.RepeatWrapping;
    link.needsUpdate = true;
    const cage = (w, h, x, y, z, ry) => {
      const t = link.clone();
      t.repeat.set(w / 3, h / 3);
      t.needsUpdate = true;
      const m = this.plane(w, h, t, x, y, z, ry, { transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: luxury ? '#d9b24a' : '#9a968c', metalness: 0.5 });
      R.add(m);
    };
    cage(44, 60, 88, 30, -78, Math.PI / 2);
    cage(14, 60, 95, 30, -56, 0);
    cage(14, 60, 123, 30, -56, 0);
    cage(14, 26, 109, 47, -56, 0);
    const frame = LP.mat('#2a2a2a', { metalness: 0.5 });
    for (const [x, z] of [[88, -56], [88, -100], [130, -56]]) R.add(LP.box(1.6, 60, 1.6, frame, x, 30, z));
    R.add(LP.box(44, 1.6, 1.6, frame, 109, 60, -56));
    // Counter through the hatch.
    const counter = LP.mat(luxury ? '#2a2826' : '#4a3a2a');
    R.add(LP.box(16, 20, 10, counter, 109, 10, -60));
    R.add(this.hot(LP.box(30, 1.6, 16, LP.mat(luxury ? '#e8e2d4' : '#6a5a44'), 109, 20.8, -56), 'tab', 'market', 'Commissary: buy from the black market'));
    // Sign.
    const sign = this.tex(128, 24, (g, W, H) => {
      g.fillStyle = luxury ? '#141210' : '#c9a227'; g.fillRect(0, 0, W, H);
      g.fillStyle = luxury ? '#e8c25a' : '#141210'; g.font = 'bold 16px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(luxury ? 'CONCIERGE' : 'COMMISSARY', W / 2, H / 2 + 1);
    });
    R.add(this.plane(30, 6, sign, 109, 63, -55.2, 0));
    // The trader: hunched, cap, cigarette glowing.
    const t = new THREE.Group();
    const coat = LP.mat(luxury ? '#1a1a1e' : '#3a3a2a'), skin = LP.mat('#c89a74'), capM = LP.mat(luxury ? '#141210' : '#5a2a1e');
    this.sculpt(t, 'trader' + (luxury ? ':lux' : ''), 0.15, (sc) => {
      // Hunched over the counter: coat with shoulders rolled forward, arms folded on the counter, cap pulled down.
      sc.add(coat, SDF.cone([0, 15, -0.5], [0, 29, 1.2], 4.6, 5.2), 0.4);
      sc.add(coat, SDF.ellipsoid([5.6, 2.6, 3.4], [0, 29.5, 1.6]), 1.2); // shoulders
      for (const sd of [-1, 1]) {
        sc.add(coat, SDF.cone([sd * 5, 29.5, 1.5], [sd * 4.6, 22.5, 6.5], 1.5, 1.3), 0.8); // upper arms
        sc.add(coat, SDF.cone([sd * 4.6, 22.5, 6.5], [sd * -0.5, 22.2, 8.4], 1.3, 1.1), 0.5); // forearms folded
        sc.add(skin, SDF.ellipsoid([1.1, 0.8, 1.2], [sd * -1.2, 22.4, 8.6]), 0.2); // hands
        sc.add(LP.mat('#222222'), SDF.cone([sd * 2.4, 15, 0], [sd * 2.6, 1.5, 0.4], 2.1, 1.8), 0.6); // legs
        sc.add(LP.mat('#1a1410'), SDF.box([3, 2, 5.5], 0.8, [sd * 2.6, 1, 1.4]), 0.3); // boots
      }
      sc.add(skin, SDF.cone([0, 30.5, 2], [0, 32.5, 2.6], 1.4, 1.3), 0.6); // neck, jutting forward
      sc.add(skin, SDF.ellipsoid([3.0, 3.5, 3.1], [0, 35, 3]), 0.4); // head
      sc.add(skin, SDF.ellipsoid([0.6, 1.0, 0.8], [0, 34.6, 6.1]), 0.4); // nose
      for (const sd of [-1, 1]) sc.add(skin, SDF.ellipsoid([0.4, 0.9, 0.6], [sd * 3, 35, 2.8]), 0.3); // ears
      sc.add(capM, SDF.ellipsoid([3.3, 1.8, 3.4], [0, 37.4, 2.8]), 0.3); // cap
      sc.add(capM, SDF.box([5.6, 0.4, 3.4], 0.2, [0, 36.6, 6.2], [0.2, 0, 0]), 0.5); // brim
      if (luxury) sc.add(LP.mat('#a8322a'), SDF.box([1.4, 3.6, 0.6], 0.25, [0, 27.5, 4.5]), 0.3); // tie
      sc.add(LP.mat('#f0e8d8'), SDF.cyl(0.25, 1.8, 'x', 0.05, [1.4, 33.6, 6.3]), 0.05); // cigarette
    });
    this.ember = LP.mesh(new THREE.SphereGeometry(0.3, 8, 6), LP.glow('#ff6a1a', 2), 2.35, 33.6, 6.3);
    t.add(this.ember);
    t.position.set(109, 0, -72);
    this.trader = t;
    R.add(t);
    // Shelves of contraband behind him.
    for (const y of [16, 30, 44]) {
      R.add(LP.box(4, 1.2, 40, counter, 127, y, -78));
      for (let k = 0; k < 6; k++) R.add(LP.box(3, 4 + (k % 3) * 2, 4, LP.mat(['#6a5a3a', '#3a4a5a', '#7a3a2a', '#4a5a3a'][(k + y) % 4]), 127, y + 2.6 + (k % 3), -94 + k * 6.4));
    }
    R.add(LP.beam([109, 72, -66], [109, 54, -66], 0.15, LP.mat('#111')));
    R.add(LP.mesh(new THREE.IcosahedronGeometry(1.2, 0), LP.glow('#ffc878', 2), 109, 53, -66));
  }

  buildBooth(R, luxury) {
    // Paint booth: a frame hung with plastic strips, cans and a spray gun.
    const frame = LP.mat(luxury ? '#f4f2ec' : '#3a3a3a', { metalness: 0.4 });
    for (const [x, z] of [[-78, 44], [-78, 100], [-130, 44]]) R.add(LP.box(2, 64, 2, frame, x, 32, z));
    R.add(LP.box(2, 2, 56, frame, -78, 64, 72));
    R.add(LP.box(52, 2, 2, frame, -104, 64, 44));
    const strip = LP.mat('#e8f0f0', { transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    for (let z = 48; z < 100; z += 7) if (z < 60 || z > 84) R.add(LP.box(0.2, 60, 6, strip, -78, 33, z));
    for (let x = -126; x < -80; x += 7) if (x < -116 || x > -90) R.add(LP.box(6, 60, 0.2, strip, x, 33, 44));
    const curtain = new THREE.Group();
    curtain.add(LP.box(0.2, 60, 22, LP.mat('#e8f0f0', { transparent: true, opacity: 0.2 }), -78, 33, 72));
    this.hot(curtain, 'tab', 'paint', 'Paint booth: paint, body kit, cabin and gun finishes');
    // Paint cans in every colour you've unlocked (all of them, stacked).
    COSMETICS.paint.forEach((p, i) => {
      const x = -122 + (i % 6) * 5.5, y = 2.5 + Math.floor(i / 6) * 5.2;
      R.add(LP.cyl(2.2, 2.2, 5, 8, LP.mat(p.color, { metalness: 0.3 }), x, y, 94));
    });
    this.sculpt(R, 'compressor', 0.15, (sc) => { // tank on wheels, motor and pump on top, gauge, hose, spray gun
      const red = LP.mat('#a8322a', { metalness: 0.3, roughness: 0.5 }), black = LP.mat('#1a1a1a'), metal = LP.mat('#8a8f94', { metalness: 0.7 });
      sc.add(red, SDF.lathe([[0.1, -6], [3.2, -5.6], [3.6, -4.6], [3.6, 4.6], [3.2, 5.6], [0.1, 6]], [-120, 4.6, 60], [0, Math.PI / 2, 0]), 0.3);
      sc.add(black, SDF.box([5, 3.6, 4.2], 0.8, [-121, 10, 60]), 0.5); // motor
      sc.add(red, SDF.cyl(1.3, 3.4, 'y', 0.4, [-117, 10.5, 60]), 0.5); // pump head
      sc.add(metal, SDF.cyl(0.9, 0.4, 'z', 0.15, [-116, 8.5, 63.6]), 0.2); // gauge
      for (const sd of [-1, 1]) sc.add(black, SDF.cyl(1.3, 0.8, 'z', 0.3, [-124, 1.3, 60 + sd * 3.5]), 0.1);
      sc.add(black, SDF.path([[-115, 8, 63], [-110, 2, 67], [-104, 0.6, 70], [-100.5, 1.4, 72]], 0.35), 0.2);
      sc.add(metal, SDF.box([4.4, 1.0, 1.4], 0.4, [-99, 1.6, 72]), 0.3); // spray gun body
      sc.add(metal, SDF.cone([-97, 1.8, 72], [-95.8, 1.9, 72], 0.4, 0.2), 0.2);
      sc.add(metal, SDF.cyl(1.0, 1.6, 'y', 0.3, [-99.5, 3.2, 72]), 0.3); // paint cup
    });
    const sign = this.tex(64, 16, (g, W, H) => { g.fillStyle = '#141210'; g.fillRect(0, 0, W, H); g.fillStyle = luxury ? '#e8c25a' : '#e8e0c8'; g.font = 'bold 12px Impact'; g.textAlign = 'center'; g.fillText('PAINT', W / 2, 13); });
    R.add(this.plane(16, 4, sign, -104, 60, 43, Math.PI));
  }

  buildDoor(R, luxury) {
    // Roll-up door out to the track: light leaks under it.
    const door = this.tex(128, 112, (g, W, H) => {
      g.fillStyle = luxury ? '#cfcac0' : '#7a7468'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
      for (let x = 0; x < W; x += 16) { g.fillStyle = (x / 16) % 2 ? '#141210' : (luxury ? '#d9b24a' : '#c9a227'); g.fillRect(x, H - 10, 16, 10); }
      g.fillStyle = luxury ? '#141210' : '#e8e0c8'; g.font = 'bold 14px Impact'; g.textAlign = 'center';
      g.fillText('TRACK  ▶', W / 2, H / 2);
      if (!luxury) { g.fillStyle = '#a8322a'; g.font = 'bold 9px Impact'; g.fillText('NO RETURN WITHOUT A FINISH', W / 2, H / 2 + 16); }
    });
    const d = this.plane(60, 52, door, -129.4, 26, -8, Math.PI / 2, { roughness: 0.6, metalness: 0.3 });
    this.hot(d, 'to-briefing', null, 'Roll out: to the next race');
    R.add(LP.box(1, 1.4, 60, LP.glow(luxury ? '#fff0d0' : '#ffd8a0', 2), -129.6, 0.6, -8));
    R.add(LP.box(2, 6, 64, LP.mat('#2a2a2a'), -129, 55, -8));
  }

  buildClutter(R, luxury) {
    // Tool cart, tyre stack, oil drums.
    const red = LP.mat(luxury ? '#1a1a1e' : '#a8322a', { metalness: 0.4 });
    const metal = LP.mat('#8a8f94', { metalness: 0.8, roughness: 0.3 }), black = LP.mat('#1a1a1a');
    this.sculpt(R, 'cart', 0.15, (sc) => { // tool cart: drawers with pull handles, castors, a wrench on top
      sc.add(red, SDF.box([16, 18, 9], 0.8, [40, 11, -20]), 0.3);
      for (let k = 0; k < 4; k++) {
        sc.cut(SDF.box([15, 0.35, 10], 0.1, [40, 4.4 + k * 4.4, -20]), 0.1, [red]); // drawer gaps
        sc.add(metal, SDF.cone([35, 6.4 + k * 4.4, -15.2], [45, 6.4 + k * 4.4, -15.2], 0.3, 0.3), 0.3); // handles
      }
      for (const [dx, dz] of [[-6.5, -3], [6.5, -3], [-6.5, 3], [6.5, 3]]) sc.add(black, SDF.cyl(1, 0.8, 'z', 0.3, [40 + dx, 1, -20 + dz]), 0.2);
      sc.add(metal, SDF.box([7, 0.4, 0.9], 0.15, [38, 20.3, -20]), 0.1); // wrench shaft
      for (const dx of [-3.6, 3.6]) sc.add(metal, SDF.torus(0.8, 0.3, [38 + dx, 20.3, -20], [Math.PI / 2, 0, 0]), 0.2);
    });
    this.sculpt(R, 'tyres', 0.2, (sc) => { // a stack of worn tyres, tread grooves cut round them
      const tyre = LP.mat('#151515', { roughness: 0.95 });
      for (let k = 0; k < 4; k++) {
        const c = [-44 + (k > 2 ? 3 : 0), 2 + k * 4.2, 34];
        sc.add(tyre, SDF.torus(4.6, 1.9, c, [Math.PI / 2, 0, 0]), 0.05);
        for (let n = 0; n < 16; n++) { const a = (n / 16) * TAU; sc.cut(SDF.box([0.4, 2.2, 1.0], 0.1, [c[0] + Math.cos(a) * 6.5, c[1], c[2] + Math.sin(a) * 6.5], [0, -a, 0]), 0.1, [tyre]); }
      }
    });
    this.sculpt(R, 'drums' + (luxury ? ':lux' : ''), 0.15, (sc) => { // oil drums with rolling hoops and a bung
      for (const [x, z, c] of [[64, 64, '#2f5a6a'], [72, 56, '#7a3a22'], [58, 52, '#2f5a6a']]) {
        const m = LP.mat(luxury ? '#d8d4cc' : c, { metalness: 0.3 });
        sc.add(m, SDF.lathe([[4.8, 0], [5.0, 0.4], [5.0, 5.0], [5.25, 5.3], [5.0, 5.6], [5.0, 10.4], [5.25, 10.7], [5.0, 11.0], [5.0, 15.6], [4.8, 16], [0, 16]], [x, 0, z], [-Math.PI / 2, 0, 0]), 0.05);
        sc.cut(SDF.cyl(4.3, 0.6, 'y', 0.2, [x, 16, z]), 0.2, [m]); // dished lid
        sc.add(m, SDF.cyl(0.8, 0.8, 'y', 0.2, [x + 2.4, 15.8, z]), 0.2); // bung
      }
    });
    if (luxury) {
      // Sponsors' touches: a velvet rope and a champagne bucket.
      this.sculpt(R, 'rope', 0.15, (sc) => {
        const brass = LP.mat('#d9b24a', { metalness: 0.7 });
        for (const x of [20, 50]) {
          sc.add(brass, SDF.lathe([[2.2, 0], [2.2, 0.5], [0.6, 1.2], [0.5, 9.4], [0.9, 10.2], [0, 10.6]], [x, 0, 40], [-Math.PI / 2, 0, 0]), 0.3);
        }
        sc.add(LP.mat('#8a1a2a'), SDF.path([[20.4, 9.4, 40], [35, 6.6, 40], [49.6, 9.4, 40]], 0.5), 0.2);
      });
      this.sculpt(R, 'champagne', 0.08, (sc) => {
        sc.add(LP.mat('#d8dce0', { metalness: 0.8 }), SDF.lathe([[2.0, 0], [2.6, 4.6], [2.8, 5.0], [0, 5.0]], [40, 18.5, -20], [-Math.PI / 2, 0, 0]), 0.1);
        sc.cut(SDF.cyl(2.3, 2, 'y', 0.2, [40, 23.4, -20]), 0.2);
        sc.add(LP.mat('#1a4a2a', { metalness: 0.4, roughness: 0.2 }), SDF.lathe([[0.85, 0], [0.85, 3.6], [0.35, 5.0], [0.35, 6.2], [0.4, 6.4], [0, 6.4]], [40.5, 19.5, -20], [-Math.PI / 2 + 0.15, 0, 0]), 0.1);
      });
    }
  }

  // ---------- Things that reflect your run ----------

  sync(info) {
    const { build: b, shop, cos, act } = info;
    this.setTheme(!!act.luxury);
    this.dyn.clear();
    this.hotRoot.children.filter((o) => o.userData.dynamic).forEach((o) => this.hotRoot.remove(o));
    const D = this.dyn;
    // Pegboard: rack guns on the top row, stash weapons below.
    const hang = (w, x, y) => {
      const gun = Models.gunFinish(Models.modVisuals(Models.weapon(w.id), w.id, w.mods, false), (cos.gunFinish || {})[w.id]);
      const holder = new THREE.Group();
      holder.add(gun);
      gun.rotation.y = Math.PI / 2;
      // Centre the gun on its hook (models are built around the grip).
      const bb = new THREE.Box3().setFromObject(holder), c = bb.getCenter(new THREE.Vector3());
      gun.position.sub(c);
      holder.scale.setScalar(w.id === 'rocket' ? 1.6 : 2.2);
      holder.position.set(x, y, -97);
      D.add(holder);
    };
    b.rack.forEach((w, i) => hang(w, -82 + i * 22, 50));
    b.stash.weapons.forEach((w, i) => hang(w, -82 + i * 22, 30));
    // Bench: loose mods in little boxes, ammo cans and your grenade crate.
    const rarity = { common: '#8a8f94', rare: '#3a8ad8', epic: '#a64dff' };
    b.stash.mods.forEach((id, i) => {
      const box = LP.box(3.4, 2.4, 3.4, LP.mat('#3a3632'), -96 + (i % 10) * 4.4, 20.2, -86 + Math.floor(i / 10) * 4.4);
      box.add(LP.box(3.5, 0.6, 3.5, LP.mat(rarity[MODS[id].rarity] || '#888'), 0, 0.6, 0));
      D.add(box);
    });
    b.rack.forEach((w, i) => { for (let k = 0; k < Math.min(4, Math.ceil(w.reserve / 30)); k++) D.add(LP.box(5, 3.4, 3, LP.mat('#4a5a2a'), -50 + i * 7, 8.6 + k * 3.5, -91)); });
    const crate = Models.grenadeCrate();
    crate.position.set(-34, 20.8, -90);
    crate.scale.setScalar(1.4);
    crate.userData.nades.forEach((n, k) => { n.visible = k < b.grenades; });
    D.add(crate);
    // Spare part on the floor by the lift.
    if (b.spare) D.add(LP.box(10, 6, 8, LP.mat('#5a6a3a'), 28, 3, 30));
    // Trinkets on their shelf: the only things that stay with you the whole run.
    // Hanging ones on nails above, flat ones leaned against the wall on the top shelf, standing ones below.
    const slot = { hang: 0, flat: 0, stand: 0 };
    b.trinkets.forEach((id) => {
      const m = Models.trinket(id), mount = m.userData.mount, i = slot[mount]++;
      if (mount === 'hang') { m.scale.setScalar(1.3); m.position.set(-13 + (i % 9) * 3.2, 47, -98); }
      else if (mount === 'flat') { m.scale.setScalar(1.4); m.rotation.x = Math.PI / 2 - 0.3; m.position.set(-12.5 + (i % 8) * 3.6, 35.6, -98.6); }
      else { m.scale.setScalar(Math.min(1.4, 5 / new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).y)); m.rotation.y = -Math.PI / 2; m.position.set(-12.5 + (i % 8) * 3.6, 22.6, -97); }
      D.add(m);
    });
    // Goods on the commissary counter, with price tags. Click one to buy it.
    (shop || []).forEach((c, i) => {
      if (c.sold) return;
      const x = 97 + i * 4.2, y = 21.6, z = -54;
      let m;
      if (c.type === 'weapon') { m = Models.weapon(c.id); m.rotation.set(-Math.PI / 2, 0, Math.PI / 2); m.scale.setScalar(0.5); }
      else if (c.type === 'trinket') { m = Models.trinket(c.id); m.scale.setScalar(0.9); }
      else if (c.type === 'mod') { m = LP.box(3, 2.2, 3, LP.mat('#3a3632')); m.add(LP.box(3.1, 0.6, 3.1, LP.mat(rarity[c.rarity] || '#888'), 0, 0.5, 0)); }
      else if (c.type === 'ability') m = LP.cyl(1.4, 1.4, 4, 8, LP.mat('#d9b52c'));
      else if (c.type === 'chip') m = LP.box(3.4, 0.6, 2.4, LP.mat('#2a6a3a'));
      else m = LP.box(4.6, 3.4, 3.6, LP.mat('#5a6a3a'));
      const g = new THREE.Group();
      g.add(m);
      if (c.type === 'ability' || c.type === 'mod' || c.type === 'part') m.position.y = 1.4;
      const tag = this.tex(32, 16, (t, W, H) => { t.fillStyle = '#f0e8d0'; t.fillRect(0, 0, W, H); t.fillStyle = '#1a1a1a'; t.font = 'bold 11px monospace'; t.textAlign = 'center'; t.fillText(String(c.price), W / 2, 12); });
      const tg = this.plane(2.4, 1.2, tag, 0, 4 + (i % 2) * 1.5, 1.6, 0);
      g.add(tg);
      g.position.set(x, y, z);
      g.userData.dynamic = true;
      g.userData.baseY = y;
      this.hot(g, 'buy-item', String(i), `${c.name}: ${c.price} scrap (${c.type})`);
    });
    PSX.apply(D);
    PSX.apply(this.hotRoot);
    PSX.setTextures(this.room, PSX.enabled);
    this.drawChalk({ act: act.label, race: b.race + 1, of: act.progress, scrap: b.scrap, strikes: b.strikes, maxStrikes: act.maxStrikes, rep: cos.rep });
  }

  setLook(look) {
    this.look = look;
    if (this.carGroup) this.room.remove(this.carGroup);
    const g = (this.carGroup = new THREE.Group());
    g.position.set(GARAGE_LIFT.x, GARAGE_LIFT.y, GARAGE_LIFT.z);
    if (this.mode === 'interior') {
      g.add(Models.car(Object.assign({}, look, { shell: true })));
      g.add(Models.interior(look.color, { cabin: look.cabin }).group);
      this.cabinLight = new THREE.PointLight(look.cabin.bulb, 1.6, 40, 1.2);
      this.cabinLight.position.set(-7.5, 10, -1.5);
      g.add(this.cabinLight);
    } else {
      g.add(Models.car(Object.assign({}, look)));
    }
    g.userData.hot = { action: 'tab', arg: 'car', label: 'Your car: parts, tuning and repairs' };
    PSX.apply(g);
    PSX.setTextures(g, PSX.enabled);
    this.room.add(g);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.look) this.setLook(this.look);
  }

  setStation(st) { this.station = st; }

  // Drag to look: around the cabin from your seat, or round the car in the paint booth.
  drag(dx, dy) {
    if (this.station !== 'paint') return;
    if (this.mode === 'interior') {
      const l = this.cabinLook;
      l.yaw = clamp(l.yaw + dx * 0.006, -2.6, 1.4);
      l.pitch = clamp(l.pitch - dy * 0.005, -0.9, 0.5);
    } else if (this.mode === 'car') {
      this.userOrbit = true;
      this.orbit += dx * 0.008;
      this.orbitPitch = clamp(this.orbitPitch + dy * 0.15, 8, 70);
    }
  }

  zoom(delta) {
    if (this.station === 'paint' && this.mode === 'car') this.orbitR = clamp(this.orbitR + delta * 0.05, 48, 120);
  }

  // ---------- Interaction ----------

  pick(nx, ny) {
    this.mouse.x = nx; this.mouse.y = ny;
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const targets = [this.hotRoot];
    if (this.carGroup) targets.push(this.carGroup);
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.hot) o = o.parent;
      if (o) { this.hover = o; return o.userData.hot; }
    }
    this.hover = null;
    return null;
  }

  // ---------- Frame ----------

  pose() {
    const st = this.station;
    if (st === 'paint' && this.mode === 'interior') return null;
    if (st === 'paint' && this.mode === 'guns') return GARAGE_POSES.weapons;
    if (st === 'paint') {
      const r = this.orbitR, a = this.orbit;
      return [[GARAGE_LIFT.x + Math.cos(a) * r, this.orbitPitch, GARAGE_LIFT.z + Math.sin(a) * r], [GARAGE_LIFT.x, 12, GARAGE_LIFT.z]];
    }
    return GARAGE_POSES[st] || GARAGE_POSES.overview;
  }

  render(W, H, dt, t, panelW) {
    W = Math.max(1, Math.round(W)); H = Math.max(1, Math.round(H));
    if (W !== this.size[0] || H !== this.size[1] || panelW !== this.size[2]) {
      this.size = [W, H, panelW];
      this.renderer.setSize(W, H, false);
      this.post.setSize(W, H);
    }
    // Keep the subject centred in the space left of the clipboard.
    this.camera.aspect = (W + panelW) / H;
    if (panelW > 0) this.camera.setViewOffset(W + panelW, H, panelW, 0, W, H);
    else this.camera.clearViewOffset();
    if (!this.userOrbit) this.orbit += dt * 0.15;
    const k = Math.min(1, dt * 3.5);
    const pose = this.pose();
    if (pose) {
      const still = this.station === 'paint' || this.station === 'market'; // no parallax where you aim at small things
      const px = still ? 0 : this.mouse.x * 3, py = still ? 0 : this.mouse.y * 2;
      this.cam.pos.lerp(new THREE.Vector3(pose[0][0] + px, pose[0][1] + py, pose[0][2]), k);
      this.cam.look.lerp(new THREE.Vector3(...pose[1]), k);
      this.camera.fov = 50;
      this.camera.position.copy(this.cam.pos);
      this.camera.lookAt(this.cam.look);
    } else {
      // Sitting in your seat; drag to look round the cabin.
      const a = this.cabinLook.yaw, pt = this.cabinLook.pitch;
      const eye = new THREE.Vector3(EYE.x + GARAGE_LIFT.x, EYE.y + GARAGE_LIFT.y, EYE.z + GARAGE_LIFT.z);
      this.cam.pos.copy(eye);
      this.camera.fov = 70;
      this.camera.position.copy(eye);
      this.camera.lookAt(eye.x + Math.cos(a) * Math.cos(pt) * 10, eye.y + Math.sin(pt) * 10, eye.z + Math.sin(a) * Math.cos(pt) * 10);
    }
    this.camera.updateProjectionMatrix();
    // Life: a flickering tube, the trader's cigarette, the CCTV light, hovered goods lifting.
    this.lights[1].intensity = Math.sin(t * 23) > 0.94 ? 0.2 : 1.2;
    this.ember.material.emissiveIntensity = 1.4 + Math.sin(t * 3) * 0.8;
    this.cctv.visible = Math.floor(t * 1.2) % 2 === 0;
    this.trader.rotation.y = Math.sin(t * 0.4) * 0.15;
    // Hovered goods glow warm (no movement, so the click always lands on what you hovered).
    if (this.glowing !== this.hover) {
      const set = (o, on) => o && o.userData.baseY != null && o.traverse((m) => {
        if (!m.isMesh || !m.material.emissive) return;
        if (on) { m.userData.em = m.material.emissive.getHex(); m.material.emissive.setHex(0x553311); } else if (m.userData.em != null) m.material.emissive.setHex(m.userData.em);
      });
      set(this.glowing, false);
      set(this.hover, true);
      this.glowing = this.hover;
    }
    if (PSX.enabled) { this.post.begin(); this.renderer.render(this.scene, this.camera); this.post.end(t); }
    else this.renderer.render(this.scene, this.camera);
  }
}
