'use strict';
// Model viewer: browse, orbit and export the low-poly models as .glb files.

const CATALOG = [
  { group: 'Cars', name: 'Comet', file: 'car_comet', desc: 'Balanced starter car. Sleek coupe with a rear wing.', make: () => Models.car({ style: 'comet', color: CARS.comet.color, accent: CARS.comet.accent }) },
  { group: 'Cars', name: 'Brick', file: 'car_brick', desc: 'Armoured bruiser. Tall boxy body, bull bar, roof rack.', make: () => Models.car({ style: 'brick', color: CARS.brick.color, accent: CARS.brick.accent }) },
  { group: 'Cars', name: 'Wasp', file: 'car_wasp', desc: 'Featherweight. Low bubble cab and a huge wing.', make: () => Models.car({ style: 'wasp', color: CARS.wasp.color, accent: CARS.wasp.accent }) },
  { group: 'Cars', name: 'Phantom', file: 'car_phantom', desc: 'Straight-line demon. Long nose, fastback, tail fins.', make: () => Models.car({ style: 'phantom', color: CARS.phantom.color, accent: CARS.phantom.accent }) },
  { group: 'Cars', name: 'Rocket gunner', file: 'car_rocket_gunner', desc: 'Rival with a roof-mounted rocket pod.', make: () => Models.car({ style: 'brick', color: '#2ec4b6', accent: '#1d1d1d', weapon: 'rocket' }) },
  { group: 'Cars', name: 'Mine layer', file: 'car_mine_layer', desc: 'Rival with a rear mine dropper.', make: () => Models.car({ style: 'wasp', color: '#8ac926', accent: '#1d1d1d', weapon: 'mine' }) },
  { group: 'Cockpit', name: 'Your car (cutaway)', file: 'player_car_cutaway', desc: 'Your car shell with the cockpit inside. In game you sit in the passenger seat.', make: () => {
    const g = Models.car({ color: CARS.comet.color, accent: CARS.comet.accent, shell: true });
    g.add(Models.interior(CARS.comet.color, { noRoof: true }).group);
    return g;
  } },
  { group: 'Cockpit', name: 'Cockpit interior', file: 'cockpit_interior', desc: 'Dash radar and status screen, mirror, self-turning wheel, gun rack, grenade crate, trinkets.', make: () => Models.interior(CARS.comet.color, { noRoof: true }).group },
  { group: 'Weapons', name: 'SMG', file: 'weapon_smg', desc: 'Hold to fire. Overheats.', make: () => Models.smg() },
  { group: 'Weapons', name: 'Rocket launcher', file: 'weapon_rocket_launcher', desc: 'Dumb-fire rockets, 3 shots.', make: () => Models.launcher() },
  { group: 'Weapons', name: 'Pump shotgun', file: 'weapon_shotgun', desc: 'Close range, big knockback.', make: () => Models.shotgun() },
  { group: 'Weapons', name: 'Flare gun', file: 'weapon_flare_gun', desc: 'Blinds the driver it hits.', make: () => Models.flareGun() },
  { group: 'Weapons', name: 'Grenade', file: 'weapon_grenade', desc: 'Thrown; look higher to throw further.', make: () => Models.grenade() },
  { group: 'Weapons', name: 'Rocket', file: 'projectile_rocket', desc: 'Projectile.', make: () => Models.rocket() },
  { group: 'Weapons', name: 'Mine', file: 'projectile_mine', desc: 'Dropped by mine layers.', make: () => Models.mine() },
  { group: 'Trinkets', name: 'Fuzzy dice', file: 'trinket_fuzzy_dice', desc: 'A parry instantly reloads your weapon.', make: () => Models.fuzzyDice() },
  { group: 'Trinkets', name: 'Bobblehead', file: 'trinket_bobblehead', desc: '+40 scrap for every rival you wreck.', make: () => Models.bobblehead() },
  { group: 'Trinkets', name: "Rabbit's foot", file: 'trinket_rabbit_foot', desc: 'Once per race, survive a wrecking hit.', make: () => Models.rabbitFoot() },
  { group: 'Trinkets', name: 'Rusty horseshoe', file: 'trinket_horseshoe', desc: 'Triple ram damage, but rams hurt you more.', make: () => Models.horseshoe() },
  { group: 'Trinkets', name: "Warden's keys", file: 'trinket_keys', desc: '+1 rack slot; gunners lock on faster.', make: () => Models.keyRing() },
  { group: 'Trinkets', name: 'Burnt rosary', file: 'trinket_rosary', desc: 'Nearby explosions cut ability cooldowns.', make: () => Models.rosary() },
  { group: 'Trinkets', name: 'Pine air freshener', file: 'trinket_air_freshener', desc: 'Parts are 25% more durable.', make: () => Models.airFreshener() },
  { group: 'Trinkets', name: 'St. Christopher medal', file: 'trinket_medal', desc: 'Faster swerves that make you untouchable.', make: () => Models.medal() },
  { group: 'Trinkets', name: 'Grenade crate', file: 'prop_grenade_crate', desc: 'Shows how many grenades you have left.', make: () => Models.grenadeCrate() },
  { group: 'Scenery', name: 'Tree', file: 'scenery_tree', desc: 'Meadow Ring.', make: () => Models.tree(3) },
  { group: 'Scenery', name: 'Pine', file: 'scenery_pine', desc: 'Frostbite Pass.', make: () => Models.pine() },
  { group: 'Scenery', name: 'Cactus', file: 'scenery_cactus', desc: 'Dust Bowl.', make: () => Models.cactus() },
  { group: 'Scenery', name: 'Rock', file: 'scenery_rock', desc: 'Dust Bowl.', make: () => Models.rock(11) },
  { group: 'Scenery', name: 'Neon building', file: 'scenery_neon_building', desc: 'Neon Sprawl.', make: () => Models.building(5) },
];

// glTF has no flat-shading flag: split vertices so every face keeps its own normal.
function flattenForExport(obj) {
  const copy = obj.clone(true);
  copy.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.deleteAttribute('normal');
    g.computeVertexNormals();
    o.geometry = g;
  });
  return copy;
}

const Viewer = {
  idx: 0,
  orbit: { yaw: 0.8, pitch: 0.35, dist: 60 },
  auto: true,
  wire: false,
  retro: true,

  init() {
    this.canvas = document.getElementById('view');
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.post = new PSXPost(r);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#141310');
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a2f4a, 1.1));
    const sun = (this.sun = new THREE.DirectionalLight(0xfff2dd, 1.6));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun, sun.target);
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#24221c', roughness: 1 }));
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.buildList();
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.show(0);
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  },

  buildList() {
    const list = document.getElementById('list');
    let html = '', group = '';
    CATALOG.forEach((m, i) => {
      if (m.group !== group) { group = m.group; html += `<h3>${group}</h3>`; }
      html += `<button class="mv-item" data-i="${i}">${m.name}</button>`;
    });
    list.innerHTML = html;
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) this.show(+b.dataset.i);
    });
    document.getElementById('dl').addEventListener('click', () => this.download(this.idx));
    document.getElementById('dl-all').addEventListener('click', async () => {
      for (let i = 0; i < CATALOG.length; i++) { await this.download(i); await new Promise((r) => setTimeout(r, 250)); }
    });
    document.getElementById('auto').addEventListener('change', (e) => { this.auto = e.target.checked; });
    document.getElementById('wire').addEventListener('change', (e) => { this.wire = e.target.checked; this.applyWire(); });
    document.getElementById('retro').addEventListener('change', (e) => {
      this.retro = e.target.checked;
      PSX.snapOn.value = this.retro ? 1 : 0;
      PSX.setTextures(this.model, this.retro);
      this.ground.material.color.set(this.retro ? '#24221c' : '#2a2540');
      this.scene.background.set(this.retro ? '#141310' : '#1a1726');
    });
  },

  bindInput() {
    let drag = null;
    this.canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.orbit.yaw -= (e.clientX - drag.x) * 0.008;
      this.orbit.pitch = clamp(this.orbit.pitch + (e.clientY - drag.y) * 0.006, -0.2, 1.45);
      drag = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('pointerup', () => { drag = null; });
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.orbit.dist = clamp(this.orbit.dist * (1 + Math.sign(e.deltaY) * 0.1), this.radius * 0.6, this.radius * 8);
    }, { passive: false });
  },

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  },

  show(i) {
    this.idx = i;
    if (this.model) {
      this.scene.remove(this.model);
      this.model.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    const entry = CATALOG[i];
    const m = (this.model = entry.make());
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    PSX.apply(m);
    PSX.setTextures(m, this.retro);
    this.scene.add(m);
    const box = new THREE.Box3().setFromObject(m);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.center = sphere.center;
    this.radius = Math.max(0.5, sphere.radius);
    this.orbit.dist = this.radius * 2.6;
    this.ground.position.set(sphere.center.x, box.min.y - 0.01, sphere.center.z);
    this.ground.scale.setScalar(this.radius * 1.6);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -this.radius * 1.5;
    sc.right = sc.top = this.radius * 1.5;
    sc.near = 0.1;
    sc.far = this.radius * 10;
    sc.updateProjectionMatrix();
    this.sun.position.copy(this.center).add(new THREE.Vector3(this.radius * 2, this.radius * 3.5, this.radius * 1.5));
    this.sun.target.position.copy(this.center);
    let tris = 0;
    m.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    document.getElementById('name').textContent = entry.name;
    document.getElementById('desc').textContent = entry.desc;
    document.getElementById('tris').textContent = `${Math.round(tris).toLocaleString()} triangles`;
    document.querySelectorAll('.mv-item').forEach((b) => b.classList.toggle('active', +b.dataset.i === i));
    this.applyWire();
  },

  applyWire() {
    if (!this.model) return;
    this.model.traverse((o) => { if (o.material && 'wireframe' in o.material) o.material.wireframe = this.wire; });
  },

  async exportGLB(i) {
    const src = CATALOG[i].make();
    if (this.retro) PSX.apply(src); // include the grimy pixel textures
    const obj = flattenForExport(src);
    return new GLTFExporter().parseAsync(obj, { binary: true });
  },

  async download(i) {
    const buf = await this.exportGLB(i);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
    a.download = CATALOG[i].file + '.glb';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.auto) this.orbit.yaw += dt * 0.4;
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  },

  render() {
    const o = this.orbit, c = this.center;
    this.camera.position.set(
      c.x + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist,
      c.y + Math.sin(o.pitch) * o.dist,
      c.z + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist,
    );
    this.camera.lookAt(c);
    if (this.retro) this.post.begin();
    this.renderer.render(this.scene, this.camera);
    if (this.retro) this.post.end(performance.now() / 1000);
  },
};

window.addEventListener('load', () => Viewer.init());
