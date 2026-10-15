'use strict';
// Your car remembers the run. It has a name (painted across the bonnet, and the broadcast uses it), a kill mark
// stencilled under your window for every rival you put out, a trophy bolted on for every boss you beat, and the
// scars of every hit: bullet holes, dents, scorch, right where they landed. Scars stay until the hull is repaired;
// kill marks and trophies stay for the run. All of it lives on the build (b.car), so it ends with the run.

const CAR_NAMES = ['Sister Mercy', 'The Widowmaker', 'Old Faithful', 'Bad Penny', 'Last Rites', 'Parole Board',
  'Cell Block Betty', 'Gravedigger', 'Lady Luck', 'Hellcat', 'Second Chance', 'The Undertaker', 'Big Mama',
  'Iron Maiden', 'Dead Man Walking', 'Black Maria', 'Jailbird', 'Death Row Dolly', 'Hard Time', 'The Hearse',
  'Lockdown Lucy', 'Solitary', 'Good Behaviour', 'The Chaplain', 'Mother Superior', 'Rust Bucket', 'Visiting Hours',
  'Sweet Release', 'Shank Sinatra', 'The Appeal'];
const HISTORY = { scars: 40, kills: 40, nameLen: 16 };

const CarHistory = {
  // The car's record, made the first time it's asked for (the name is rolled from the run's seed).
  of(b) {
    if (!b) return null;
    if (!b.car) b.car = { name: CAR_NAMES[TV.hash((Crew.runSeed >>> 0) % 1000003, 4219) % CAR_NAMES.length], kills: [], trophies: [], scars: [] };
    return b.car;
  },
  name(b) { const h = CarHistory.of(b); return h ? h.name : 'The Car'; },
  rename(b, name) {
    const h = CarHistory.of(b), n = String(name || '').replace(/[<>"&]/g, '').trim().slice(0, HISTORY.nameLen);
    if (n) h.name = n;
  },
  reroll(b) {
    const h = CarHistory.of(b);
    let n = h.name;
    for (let i = 0; i < 8 && n === h.name; i++) n = CAR_NAMES[Math.floor(Math.random() * CAR_NAMES.length)];
    h.name = n;
  },
  // How many scars show: as many as the damage the hull still carries (a full repair takes them all off).
  shown(b) {
    const h = CarHistory.of(b), def = 1 - b.hull / b.maxHull;
    return def <= 0.01 ? [] : h.scars.slice(-Math.ceil(HISTORY.scars * Math.min(1, def * 1.6)));
  },
  repaired(b) { if (b.hull >= b.maxHull) CarHistory.of(b).scars = []; },

  // After a race: the hits it took become scars, the rivals you put out become kill marks, a beaten boss a trophy.
  afterRace(b, race, rng, bossBeaten, act) {
    const h = CarHistory.of(b), p = race.player;
    for (const s of p.scarLog || []) h.scars.push({ rel: +s.rel.toFixed(2), kind: s.kind, r: +rng().toFixed(3), r2: +rng().toFixed(3) });
    p.scarLog = [];
    h.scars = h.scars.slice(-HISTORY.scars);
    for (const c of race.cars) if (c !== p && c.downed && c.downed.how !== 'crowd') h.kills.push({ nick: c.nick || shortName(c), clean: c.downed.how === 'driver', boss: !!c.isBoss });
    h.kills = h.kills.slice(0, HISTORY.kills);
    if (bossBeaten && !h.trophies.includes(act)) h.trophies.push(act);
  },
  // What Models.car draws (part of carLook).
  look(b) {
    const h = CarHistory.of(b);
    if (!h) return null;
    return { name: h.name, kills: h.kills.map((k) => (k.boss ? 'b' : k.clean ? 'c' : 'w')).join(''), trophies: h.trophies.slice(), scars: CarHistory.shown(b) };
  },
  key(b) { const l = CarHistory.look(b); return l ? `${l.name}|${l.kills}|${l.trophies}|${l.scars.length}` : ''; },
};

// Decals for the history: the name, the kill marks, the scars.
DECALS.history = function (kind, arg) {
  const key = 'hist:' + kind + ':' + arg;
  if (this.cache[key]) return this.cache[key];
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  // A fixed scribble per decal (Math.random would make each car's scars flicker between rebuilds).
  const rnd = mulberry32(TV.hash([...key].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % 1000003, 3));
  if (kind === 'name') {
    // Hand-painted with a brush and a stencil that wasn't quite straight: drips, a few flakes off.
    c.width = 160; c.height = 32;
    g.font = 'bold 22px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const text = arg.toUpperCase();
    const w = g.measureText(text).width, sx = Math.min(1, 150 / w);
    g.save(); g.translate(80, 16); g.scale(sx, 1); g.rotate(-0.02);
    g.fillStyle = 'rgba(10,10,10,0.55)'; g.fillText(text, 1.5, 1.5);
    g.fillStyle = 'rgba(232,224,200,0.95)'; g.fillText(text, 0, 0);
    g.restore();
    g.fillStyle = 'rgba(232,224,200,0.85)';
    for (let k = 0; k < 7; k++) g.fillRect(80 - (w * sx) / 2 + rnd() * w * sx, 24, 1, 2 + rnd() * 6);
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 40; k++) g.fillRect(rnd() * 160, rnd() * 32, 1 + rnd() * 2, 1);
  } else if (kind === 'kills') {
    // Stencilled marks in rows of five, like a fighter's canopy: a skull for a clean kill (the driver), a car with
    // a cross through it for a wreck, a crowned skull in gold for a boss.
    c.width = 64; c.height = 32;
    g.fillStyle = 'rgba(18,18,16,0.85)'; g.fillRect(1, 1, 62, 30); // a black panel brushed on first, so the marks read on any paint
    const marks = [...arg], per = 8, s = 8;
    marks.forEach((m, i) => {
      const x = 4 + (i % per) * s + 0.5 * s, y = 5 + Math.floor(i / per) * s + 0.5 * s;
      if (y > 30) return;
      g.fillStyle = m === 'b' ? '#e0b43c' : 'rgba(236,230,214,0.92)';
      if (m === 'w') { // a car, crossed out
        g.fillRect(x - 3, y - 1, 6, 3); g.fillRect(x - 2, y - 3, 4, 2);
        g.fillStyle = '#b8231a'; g.save(); g.translate(x, y); g.rotate(0.7); g.fillRect(-4, -0.5, 8, 1); g.rotate(-1.4); g.fillRect(-4, -0.5, 8, 1); g.restore();
      } else { // a skull
        g.beginPath(); g.arc(x, y - 0.5, 2.8, 0, TAU); g.fill(); g.fillRect(x - 1.8, y + 1, 3.6, 2);
        g.fillStyle = '#141414'; g.fillRect(x - 1.8, y - 1, 1.3, 1.3); g.fillRect(x + 0.5, y - 1, 1.3, 1.3);
        if (m === 'b') { g.fillStyle = '#e0b43c'; g.fillRect(x - 2.5, y - 5, 5, 1.4); g.fillRect(x - 2.5, y - 6, 1, 1); g.fillRect(x - 0.5, y - 6.5, 1, 1.5); g.fillRect(x + 1.5, y - 6, 1, 1); }
      }
    });
    if (marks.length > per * 3) { g.fillStyle = '#ece6d6'; g.font = 'bold 7px monospace'; g.fillText('+' + (marks.length - per * 3), 50, 30); }
  } else { // scars: 'hole' (a round through the panel), 'dent' (scraped to primer), 'scorch' (a blast or the fire)
    c.width = c.height = 32;
    if (arg === 'hole') {
      g.fillStyle = 'rgba(150,150,145,0.9)'; g.beginPath(); g.arc(16, 16, 5.5, 0, TAU); g.fill(); // bare metal, the paint blown off
      g.fillStyle = '#060606'; g.beginPath(); g.arc(16, 16, 3.2, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(60,40,30,0.7)'; g.lineWidth = 1;
      for (let k = 0; k < 6; k++) { const a = rnd() * TAU, r = 6 + rnd() * 5; g.beginPath(); g.moveTo(16 + Math.cos(a) * 5, 16 + Math.sin(a) * 5); g.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r); g.stroke(); } // paint cracks
    } else if (arg === 'dent') {
      g.fillStyle = 'rgba(30,28,26,0.45)'; g.beginPath(); g.ellipse(16, 16, 13, 8, rnd() - 0.5, 0, TAU); g.fill(); // the shadow of the dent
      g.strokeStyle = 'rgba(170,165,150,0.85)'; g.lineWidth = 1;
      for (let k = 0; k < 9; k++) { const y = 10 + rnd() * 12, x = 4 + rnd() * 8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10 + rnd() * 12, y + (rnd() - 0.5) * 4); g.stroke(); } // scrapes
      g.fillStyle = 'rgba(120,118,108,0.7)'; g.fillRect(9, 13, 9 + rnd() * 6, 4); // primer showing
    } else {
      const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
      gr.addColorStop(0, 'rgba(8,6,5,0.95)'); gr.addColorStop(0.5, 'rgba(20,16,12,0.7)'); gr.addColorStop(1, 'rgba(30,20,10,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
      g.fillStyle = 'rgba(110,60,30,0.6)'; for (let k = 0; k < 8; k++) g.fillRect(8 + rnd() * 16, 8 + rnd() * 16, 2, 2); // blistered paint
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  this.cache[key] = tex;
  return tex;
};

// The history on the car model (called from Models.car after the livery).
Models.carHistory = function (g, st, opts, W, bev) {
  const H = opts.history, hw = W / 2, side = hw + bev + 0.07;
  const decal = (tex, w, h) => {
    const m = LP.mesh(new THREE.PlaneGeometry(w, h), LP.mat('#ffffff', { map: tex, transparent: true, alphaTest: 0.25, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.userData.noGrime = true;
    return m;
  };
  const [hx1, hy1] = st.top[2], [hx2, hy2] = st.top[3], fx = st.top[0][0] + bev;
  const hEnd = Math.max(hx2, opts.shell ? 9 : hx2);
  // Something flat on the bonnet at t (0: the nose, 1: the windscreen), z across, reading from the seats.
  const onHood = (m, t, z) => {
    const x = lerp(hx1, hEnd, t), y = lerp(hy1, hy2, (hx1 - x) / (hx1 - hx2)) + bev + 0.08;
    const tilt = new THREE.Group();
    tilt.position.set(x, y, z || 0);
    tilt.rotation.z = -Math.atan2(hy2 - hy1, hx1 - hx2);
    m.geometry.rotateX(-Math.PI / 2);
    m.rotation.y = -Math.PI / 2;
    tilt.add(m);
    g.add(tilt);
    return tilt;
  };
  const onSide = (m, x, y, s) => { m.position.set(x, y, side * s); if (s < 0) m.rotation.y = Math.PI; g.add(m); return m; };

  if (H.name) {
    onHood(decal(DECALS.history('name', H.name), Math.min(W - 3, 13), 2.6), 0.26, 0);
    if (!opts.shell) for (const s of [-1, 1]) onSide(decal(DECALS.history('name', H.name), 7, 1.4), st.seams[0] + 4.5, 2.4, s); // small along the sills
  }
  if (H.kills) {
    // Under your window (the left), and on the bonnet in front of you, so you see the tally from the seat.
    const tex = DECALS.history('kills', H.kills);
    onHood(decal(tex, 5.6, 2.8), 0.85, hw * 0.45);
    if (!opts.shell) onSide(decal(tex, 5.6, 2.8), st.cabin[1][0] - 3, st.cabin[0][1] - 1.6, 1);
  }
  // Scars where the hits landed: from ahead onto the bonnet, from the sides onto the doors, from behind on the tail.
  const L = Math.abs(st.top[0][0] - st.top[st.top.length - 1][0]);
  for (const s of H.scars || []) {
    const kind = s.kind === 'bullet' || s.kind === 'harpoon' || s.kind === 'nail' ? 'hole' : s.kind === 'blast' || s.kind === 'fire' || s.kind === 'flame' ? 'scorch' : 'dent';
    const size = { hole: 0.9, dent: 2.6, scorch: 3.4 }[kind] * (0.8 + 0.4 * s.r2);
    const m = decal(DECALS.history('scar', kind), size, size);
    const c = Math.cos(s.rel), sn = Math.sin(s.rel);
    if (c > 0.75) {
      onHood(m, 0.1 + 0.6 * s.r, (s.r2 - 0.5) * (W - 4));
      m.rotation.set(0, s.r * TAU, 0); // spun in the plane of the bonnet
    } else if (c < -0.8) {
      if (opts.shell) continue;
      m.position.set(st.top[st.top.length - 1][0] - 0.25, 3 + 2.5 * s.r2, (s.r - 0.5) * (W - 4));
      m.rotation.set(0, -Math.PI / 2, s.r * TAU);
      g.add(m);
    } else {
      m.rotation.z = s.r * TAU;
      if (opts.shell) continue;
      const x = clamp(c * L * 0.42 + (s.r - 0.5) * 6, st.top[st.top.length - 1][0] + 2, st.top[0][0] - 2);
      onSide(m, x, 2.2 + 3.4 * s.r2, sn > 0 ? 1 : -1);
    }
  }
  // Trophies: something off each boss you beat, bolted on.
  for (const act of H.trophies || []) {
    if (act === 0) { // The Turnkey: his padlock and a length of chain, hung off your front bumper
      const steel = LP.mat('#5d6064', { metalness: 0.8, roughness: 0.45 });
      for (let k = 0; k < 7; k++) {
        const link = LP.mesh(new THREE.TorusGeometry(0.42, 0.11, 4, 8), steel, fx + 1.1, st.lightY - 0.9 - 0.8 * Math.sin((k / 6) * Math.PI), -3 + k * 0.85);
        link.rotation.y = k % 2 ? Math.PI / 2 : 0;
        g.add(link);
      }
      const lock = LP.box(0.5, 1.3, 1.1, LP.mat('#8a7a3a', { metalness: 0.7, roughness: 0.4 }), fx + 1.2, st.lightY - 2.6, 0);
      const shackle = LP.mesh(new THREE.TorusGeometry(0.38, 0.1, 4, 8, Math.PI), steel, fx + 1.2, st.lightY - 1.95, 0);
      shackle.rotation.y = Math.PI / 2;
      g.add(lock, shackle);
    } else if (act === 1) { // Smokestack Sal: one of her stacks, welded upright behind the cabin
      if (opts.shell) continue;
      const rust = LP.mat('#6b3a1e', { roughness: 0.9 });
      const x = st.cabin[2][0] - 2.2, y = st.cabin[2][1];
      g.add(LP.cyl(0.5, 0.6, 4.2, 8, rust, x, y + 1.8, -hw + 2.2));
      g.add(LP.cyl(0.85, 0.65, 0.5, 8, LP.mat('#2a2522', { roughness: 0.8 }), x, y + 4.1, -hw + 2.2)); // the cap
    } else if (act === 2) { // Augustin Vale: his gold mascot, bolted to the nose where you can see it
      const gold = LP.mat('#d2a83e', { metalness: 0.9, roughness: 0.25 });
      const x = lerp(hx1, hEnd, -0.04), y = hy1 + bev + 0.2;
      g.add(LP.box(0.7, 0.35, 0.5, gold, x, y, 0));
      g.add(LP.cyl(0.04, 0.25, 0.9, 6, gold, x - 0.1, y + 0.6, 0));
      for (const s of [-1, 1]) {
        const wing = LP.box(0.6, 0.1, 0.9, gold, x + 0.15, y + 0.8, 0.5 * s);
        wing.rotation.x = 0.5 * s; wing.rotation.z = -0.35;
        g.add(wing);
      }
    } else { // later bosses: a crown, welded to the roof
      if (opts.shell) continue;
      const gold = LP.mat('#d2a83e', { metalness: 0.9, roughness: 0.25 });
      const x = (st.cabin[1][0] + st.cabin[2][0]) / 2, y = st.cabin[1][1] + 0.4;
      g.add(LP.cyl(1.3, 1.2, 0.8, 10, gold, x, y + 0.4, 0));
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; g.add(LP.cyl(0.02, 0.28, 0.9, 4, gold, x + Math.cos(a) * 1.2, y + 1.2, Math.sin(a) * 1.2)); }
    }
  }
};

// The broadcast knows the car: its name and its count go up in the captions.
Object.assign(Combat.prototype, {
  carTag() {
    const h = CarHistory.of(this.build);
    return h ? `${h.name.toUpperCase()} · KILL No. ${h.kills.length + this.stats.wrecked}` : '';
  },
});
