'use strict';
// Seeing what you buy. Every card in the commissary, the hole in the wall and the reward picks carries a picture of
// the actual thing: the gun, the attachment fitted on a gun, the part on a car, the trinket, the bag of pills. They're
// rendered once each by a small offscreen renderer, cached, and filled in a frame at a time so a screen of cards never
// stalls. Also here: the models of the black market's goods (Models.contra).

// ---------- Contraband models ----------
const CONTRA_BUILD = {
  // A zip bag of pale blue crystal.
  meth() {
    return Thumbs.sculpt('contra:meth', 0.06, (sc) => {
      const bag = LP.mat('#f4f7f9', { transparent: true, opacity: 0.35, roughness: 0.2 }), zip = LP.mat('#c22a2a'), shard = LP.mat('#bfe4f2', { roughness: 0.15, metalness: 0.1 });
      sc.add(bag, SDF.box([3.2, 0.5, 4.2], 0.2, [0, 0.25, 0]), 0.1);
      sc.add(zip, SDF.box([3.2, 0.2, 0.3], 0.08, [0, 0.3, -1.9]), 0.05);
      for (let k = 0; k < 14; k++) {
        const a = k * 2.4, r = 0.3 + (k % 5) * 0.22;
        sc.add(shard, SDF.box([0.35 + (k % 3) * 0.1, 0.22, 0.25], 0.03, [Math.cos(a) * r, 0.55 + (k % 2) * 0.12, 0.5 + Math.sin(a) * r * 1.2], [k, k * 0.7, 0]), 0.02);
      }
    });
  },
  // An orange pharmacy bottle with a white cap and label, and a few blue pills spilt beside it.
  oxy() {
    return Thumbs.sculpt('contra:oxy', 0.05, (sc) => {
      const amber = LP.mat('#e07a1a', { transparent: true, opacity: 0.8, roughness: 0.25 }), white = LP.mat('#f2f0ea', { roughness: 0.5 }), blue = LP.mat('#3a7ad8', { roughness: 0.4 });
      sc.add(amber, SDF.cyl(1.1, 2.6, 'y', 0.12, [0, 1.3, 0]), 0.05);
      sc.add(white, SDF.cyl(1.2, 0.8, 'y', 0.1, [0, 2.9, 0]), 0.05);
      sc.add(white, SDF.cyl(1.13, 1.3, 'y', 0.02, [0, 1.3, 0]), 0.01); // the label
      for (const [x, z] of [[1.9, 0.6], [2.3, -0.2], [1.6, -0.9]]) sc.add(blue, SDF.ellipsoid([0.32, 0.14, 0.32], [x, 0.14, z]), 0.03);
    });
  },
  // A yellow auto-injector with a blue safety cap and an orange tip.
  adrenaline() {
    return Thumbs.sculpt('contra:adrenaline', 0.05, (sc) => {
      const body = LP.mat('#e8c838', { roughness: 0.4 }), cap = LP.mat('#2a5ac8', { roughness: 0.5 }), tip = LP.mat('#ff7a1a', { roughness: 0.5 }), win = LP.mat('#c8e8f0', { transparent: true, opacity: 0.6 });
      sc.add(body, SDF.cyl(0.5, 4.4, 'x', 0.2, [0, 0.5, 0]), 0.05);
      sc.add(cap, SDF.cyl(0.52, 1.0, 'x', 0.15, [-2.5, 0.5, 0]), 0.05);
      sc.add(tip, SDF.cyl(0.46, 0.7, 'x', 0.15, [2.45, 0.5, 0]), 0.05);
      sc.add(win, SDF.box([0.9, 0.3, 0.2], 0.08, [0.6, 0.6, 0.45]), 0.02); // the window on the side
    });
  },
  // A small bag of white powder, a cut line beside it and a razor blade.
  cocaine() {
    return Thumbs.sculpt('contra:cocaine', 0.05, (sc) => {
      const bag = LP.mat('#f0f0f0', { transparent: true, opacity: 0.55, roughness: 0.2 }), snow = LP.mat('#fbfbfb', { roughness: 0.9 }), steel = LP.mat('#b8bcc0', { metalness: 0.9, roughness: 0.25 });
      sc.add(bag, SDF.box([2.0, 0.6, 2.6], 0.25, [-1.2, 0.3, 0]), 0.1);
      sc.add(snow, SDF.ellipsoid([0.75, 0.35, 0.95], [-1.2, 0.35, 0.2]), 0.1);
      sc.add(snow, SDF.box([0.18, 0.06, 2.4], 0.03, [1.0, 0.04, 0]), 0.02); // a line
      sc.add(steel, SDF.box([1.4, 0.05, 0.7], 0.02, [2.1, 0.05, 0.4], [0, 0.4, 0]), 0.01); // the blade
    });
  },
  // A foil blister strip of yellow pills.
  diazepam() {
    return Thumbs.sculpt('contra:diazepam', 0.05, (sc) => {
      const foil = LP.mat('#c8ccd0', { metalness: 0.8, roughness: 0.35 }), bubble = LP.mat('#e8f0f4', { transparent: true, opacity: 0.5 }), pill = LP.mat('#f2d23a', { roughness: 0.5 });
      sc.add(foil, SDF.box([4.4, 0.12, 2.0], 0.05, [0, 0.06, 0]), 0.02);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
        const p = [-1.7 + i * 0.85, 0.2, -0.45 + j * 0.9];
        if (i === 4 && j === 1) continue; // one already popped
        sc.add(bubble, SDF.ellipsoid([0.36, 0.2, 0.36], p), 0.03);
        sc.add(pill, SDF.ellipsoid([0.26, 0.1, 0.26], [p[0], 0.18, p[2]]), 0.02);
      }
    });
  },
  // Pruno: a cut-down plastic bottle of murky orange slop with a knotted bin bag lid.
  pruno() {
    return Thumbs.sculpt('contra:pruno', 0.05, (sc) => {
      const plastic = LP.mat('#dfe6e8', { transparent: true, opacity: 0.4, roughness: 0.3 }), slop = LP.mat('#b8701e', { roughness: 0.8 }), bag = LP.mat('#1a1a1c', { roughness: 0.35 });
      sc.add(plastic, SDF.cyl(1.1, 3.0, 'y', 0.2, [0, 1.5, 0]), 0.05);
      sc.add(slop, SDF.cyl(1.0, 2.0, 'y', 0.2, [0, 1.05, 0]), 0.05);
      sc.add(bag, SDF.ellipsoid([1.25, 0.35, 1.25], [0, 3.05, 0]), 0.1);
      sc.add(bag, SDF.ellipsoid([0.35, 0.5, 0.35], [0.2, 3.5, 0.1]), 0.1); // the knot
    });
  },
  // An amber whiskey bottle, cork and label.
  whiskey() {
    return Thumbs.sculpt('contra:whiskey', 0.05, (sc) => {
      const glass = LP.mat('#b8661a', { transparent: true, opacity: 0.75, roughness: 0.15 }), cork = LP.mat('#a8804a', { roughness: 0.9 }), label = LP.mat('#efe4c4', { roughness: 0.7 });
      sc.add(glass, SDF.box([2.0, 3.2, 1.2], 0.35, [0, 1.6, 0]), 0.1);
      sc.add(glass, SDF.cyl(0.35, 1.6, 'y', 0.1, [0, 3.8, 0]), 0.3); // the neck
      sc.add(cork, SDF.cyl(0.32, 0.6, 'y', 0.08, [0, 4.75, 0]), 0.05);
      sc.add(label, SDF.box([1.6, 1.4, 0.06], 0.04, [0, 1.6, 0.6]), 0.01);
    });
  },
  // A box of rounds, lid open, four standing on it with their tips painted.
  ammo(id, tipCol) {
    return Thumbs.sculpt('contra:' + id, 0.05, (sc) => {
      const card = LP.mat('#6a5a3a', { roughness: 0.95 }), brass = LP.mat('#d8b050', { metalness: 0.35, roughness: 0.35 }), tip = LP.mat(tipCol, { metalness: 0.4, roughness: 0.5 });
      sc.add(card, SDF.box([3.6, 1.4, 2.4], 0.08, [0, 0.7, 0]), 0.03);
      sc.cut(SDF.box([3.3, 1.4, 2.1], 0.05, [0, 1.2, 0]), 0.03, [card]);
      sc.add(card, SDF.box([3.6, 1.6, 0.1], 0.05, [0, 2.2, -1.25], [-0.3, 0, 0]), 0.02); // the lid, open
      for (let k = 0; k < 4; k++) {
        const x = -1.2 + k * 0.8;
        sc.add(brass, SDF.cyl(0.24, 1.6, 'y', 0.05, [x, 1.3, 0.2]), 0.02);
        sc.add(tip, SDF.cone([x, 2.05, 0.2], [x, 2.75, 0.2], 0.23, 0.04), 0.03);
      }
    });
  },
};
// Abilities: each its own device. Driver chips: a circuit board with its own colour, a printed label and a part
// that says what it does (a flame for the hothead, a brake disc for the cautious one...).
const KIT_BUILD = {
  nitro_burst() {
    return Thumbs.sculpt('kit:nitro_burst', 0.06, (sc) => {
      const blue = LP.mat('#2a5ad8', { metalness: 0.4, roughness: 0.35 }), steel = LP.mat('#9aa0a6', { metalness: 0.8, roughness: 0.3 }), flame = LP.mat('#ff7a1a', { roughness: 0.6 });
      sc.add(blue, SDF.cyl(0.9, 3.4, 'y', 0.4, [0, 1.7, 0]), 0.1);
      sc.add(steel, SDF.cyl(0.35, 0.7, 'y', 0.1, [0, 3.7, 0]), 0.05);
      sc.add(steel, SDF.box([1.0, 0.25, 0.25], 0.08, [0.5, 4.0, 0]), 0.05); // the valve handle
      sc.add(flame, SDF.ellipsoid([0.5, 0.75, 0.08], [0, 1.6, 0.88]), 0.05); // a flame decal
    });
  },
  smoke() {
    return Thumbs.sculpt('kit:smoke', 0.06, (sc) => {
      const can = LP.mat('#6a7068', { metalness: 0.3, roughness: 0.6 }), band = LP.mat('#e8e2d0'), steel = LP.mat('#a8acb0', { metalness: 0.8, roughness: 0.3 });
      sc.add(can, SDF.cyl(0.8, 2.6, 'y', 0.15, [0, 1.3, 0]), 0.05);
      sc.add(band, SDF.cyl(0.82, 0.4, 'y', 0.02, [0, 1.9, 0]), 0.01);
      sc.add(steel, SDF.cyl(0.35, 0.5, 'y', 0.05, [0, 2.8, 0]), 0.03);
      sc.add(steel, SDF.box([0.2, 0.15, 1.5], 0.05, [0.35, 2.7, 0.3], [0, 0, -0.4]), 0.03); // the spoon
      sc.add(steel, SDF.torus(0.3, 0.05, [-0.4, 3.0, 0], [0, Math.PI / 2, 0]), 0.02); // the pull ring
      for (let k = 0; k < 3; k++) sc.add(LP.mat('#9aa098', { transparent: true, opacity: 0.5 }), SDF.ellipsoid([0.6 + k * 0.2, 0.5, 0.6], [0.5 + k * 0.4, 3.4 + k * 0.5, 0]), 0.2); // a wisp
    });
  },
  emp() {
    return Thumbs.sculpt('kit:emp', 0.06, (sc) => {
      const box = LP.mat('#2a2c2e', { metalness: 0.4, roughness: 0.5 }), copper = LP.mat('#c87a3a', { metalness: 0.8, roughness: 0.35 }), glow = LP.glow('#5ad8ff', 1.2);
      sc.add(box, SDF.box([2.4, 1.0, 1.8], 0.15, [0, 0.5, 0]), 0.05);
      for (let k = 0; k < 7; k++) sc.add(copper, SDF.torus(0.55, 0.09, [0, 1.25 + k * 0.2, 0], [Math.PI / 2, 0, 0]), 0.02); // the coil
      sc.add(glow, SDF.ellipsoid([0.3, 0.3, 0.3], [0, 2.8, 0]), 0.05);
      sc.add(glow, SDF.box([0.3, 0.15, 0.05], 0.03, [-0.7, 0.6, 0.92]), 0.01); // a status light
    });
  },
  chip(id) {
    const col = { hothead: '#c82a1a', cautious: '#3a8a3a', daredevil: '#e8a01a', gun_nut: '#5a5a5a', veteran: '#2a4ab8', ghost: '#d8d8e8', showboat: '#d81c8a' }[id] || '#888';
    return Thumbs.sculpt('kit:chip:' + id, 0.05, (sc) => {
      const pcb = LP.mat('#1f5a2e', { roughness: 0.6 }), ic = LP.mat('#151515', { roughness: 0.4 }), pin = LP.mat('#c9a443', { metalness: 0.8, roughness: 0.3 }), mark = LP.mat(col, { roughness: 0.5 });
      sc.add(pcb, SDF.box([4.0, 0.2, 2.6], 0.06, [0, 0.1, 0]), 0.02);
      for (let k = 0; k < 8; k++) sc.add(pin, SDF.box([0.18, 0.05, 0.4], 0.02, [-1.6 + k * 0.32, 0.2, 1.2]), 0.01); // the edge connector
      sc.add(ic, SDF.box([1.4, 0.3, 1.2], 0.05, [-0.6, 0.35, -0.2]), 0.02);
      sc.add(mark, SDF.box([1.2, 0.05, 1.0], 0.02, [-0.6, 0.52, -0.2]), 0.01); // its coloured label
      // What it does, as a part on the board.
      if (id === 'hothead') sc.add(mark, SDF.cone([1.1, 0.3, -0.2], [1.1, 1.4, -0.2], 0.5, 0.05), 0.1); // a flame
      else if (id === 'cautious') { sc.add(mark, SDF.cyl(0.7, 0.15, 'y', 0.03, [1.1, 0.35, -0.2]), 0.02); sc.cut(SDF.cyl(0.25, 0.4, 'y', 0.02, [1.1, 0.35, -0.2]), 0.02); } // a brake disc
      else if (id === 'daredevil') for (let k = 0; k < 3; k++) sc.add(mark, SDF.box([0.25, 0.6, 0.25], 0.05, [0.7 + k * 0.4, 0.5 + k * 0.15, -0.2], [0, 0, -0.5]), 0.03); // a zigzag
      else if (id === 'gun_nut') sc.add(pin, SDF.cyl(0.18, 1.2, 'x', 0.05, [1.1, 0.45, -0.2]), 0.02); // a round
      else if (id === 'veteran') sc.add(mark, SDF.box([0.9, 0.3, 0.6], 0.1, [1.1, 0.4, -0.2]), 0.05); // a getaway bag
      else if (id === 'ghost') sc.add(LP.mat(col, { transparent: true, opacity: 0.55 }), SDF.ellipsoid([0.5, 0.7, 0.4], [1.1, 0.8, -0.2]), 0.05); // a ghost
      else if (id === 'showboat') sc.add(LP.mat('#e8c838', { metalness: 0.7, roughness: 0.3 }), SDF.cone([1.1, 0.3, -0.2], [1.1, 1.3, -0.2], 0.12, 0.5), 0.05); // a trophy
    });
  },
};

const CONTRA_TIP = { shredder: '#9aa0a6', hotloads: '#d82a1a', blacktips: '#151515' };

Object.assign(Models, {
  contra(id) {
    if (CONTRA_TIP[id]) return CONTRA_BUILD.ammo(id, CONTRA_TIP[id]);
    return (CONTRA_BUILD[id] || CONTRA_BUILD.pruno)();
  },
});

// ---------- What the fans send (js/infamy.js) ----------
const FAN_BUILD = {
  // A wooden crate, lid off, an orange sweater stuffed in the top and a grenade on it.
  care() {
    return Thumbs.sculpt('fan:care', 0.06, (sc) => {
      const wood = LP.mat('#8a6a42', { roughness: 1 }), knit = LP.mat('#d6631d', { roughness: 1 }), olive = LP.mat('#4a5230', { roughness: 0.6 });
      sc.add(wood, SDF.box([3.2, 2.0, 2.4], 0.08, [0, 1.0, 0]), 0.05);
      sc.cut(SDF.box([2.9, 1.8, 2.1], 0.05, [0, 1.3, 0]), 0.05, [wood]);
      for (const y of [0.5, 1.5]) sc.cut(SDF.box([3.3, 0.06, 2.5], 0.01, [0, y, 0]), 0.02, [wood]); // plank seams
      sc.add(knit, SDF.ellipsoid([1.4, 0.5, 1.0], [0, 1.95, 0]), 0.3);
      sc.add(olive, SDF.ellipsoid([0.35, 0.45, 0.35], [0.5, 2.6, 0.2]), 0.05);
      sc.add(olive, SDF.box([0.2, 0.3, 0.12], 0.04, [0.5, 3.1, 0.2]), 0.03);
    });
  },
  // Two cardboard boxes of reloads, one open with brass showing.
  ammo() {
    return Thumbs.sculpt('fan:ammo', 0.05, (sc) => {
      const card = LP.mat('#a8865a', { roughness: 1 }), brass = LP.mat('#c9a443', { metalness: 0.8, roughness: 0.3 });
      sc.add(card, SDF.box([2.4, 1.0, 1.6], 0.04, [0, 0.5, 0]), 0.02);
      sc.add(card, SDF.box([2.2, 1.0, 1.5], 0.04, [0.2, 1.5, -0.1], [0, 0.25, 0]), 0.02);
      sc.cut(SDF.box([2.0, 0.6, 1.3], 0.03, [0.2, 1.9, -0.1], [0, 0.25, 0]), 0.03, [card]);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) sc.add(brass, SDF.cyl(0.09, 0.5, 'y', 0.02, [-0.6 + i * 0.32 + 0.2, 1.7, -0.6 + j * 0.3]), 0.01);
    });
  },
  // Envelopes, one torn open, with scrap (nuts and bolts) spilling out.
  donations() {
    return Thumbs.sculpt('fan:donations', 0.05, (sc) => {
      const paper = LP.mat('#efe8d8', { roughness: 1 }), steel = LP.mat('#8a8f94', { metalness: 0.8, roughness: 0.4 });
      sc.add(paper, SDF.box([2.6, 0.08, 1.6], 0.03, [-0.4, 0.04, 0], [0, 0.2, 0]), 0.01);
      sc.add(paper, SDF.box([2.6, 0.08, 1.6], 0.03, [0.3, 0.14, 0.3], [0, -0.3, 0]), 0.01);
      for (let k = 0; k < 7; k++) sc.add(steel, SDF.cyl(0.14, 0.12, 'y', 0.03, [1.0 + (k % 3) * 0.32, 0.25, -0.3 + Math.floor(k / 3) * 0.32]), 0.02);
      sc.add(steel, SDF.cyl(0.07, 0.9, 'x', 0.02, [1.4, 0.3, 0.6]), 0.02); // a bolt
    });
  },
  // What the crowd throws: a bottle, a shoe, a battery.
  crowd() {
    return Thumbs.sculpt('fan:crowd', 0.05, (sc) => {
      const glass = LP.mat('#3a6a3a', { roughness: 0.2, transparent: true, opacity: 0.8 }), shoe = LP.mat('#2a2420', { roughness: 0.8 }), bat = LP.mat('#c8a83a', { roughness: 0.5 });
      sc.add(glass, SDF.cyl(0.4, 1.6, 'x', 0.15, [-0.8, 0.4, 0]), 0.1);
      sc.add(glass, SDF.cyl(0.14, 0.8, 'x', 0.05, [0.3, 0.4, 0]), 0.1);
      sc.add(shoe, SDF.ellipsoid([1.1, 0.35, 0.45], [0.6, 0.35, 1.0]), 0.15);
      sc.add(shoe, SDF.ellipsoid([0.5, 0.45, 0.4], [0.2, 0.6, 1.0]), 0.15);
      sc.add(bat, SDF.cyl(0.22, 0.9, 'z', 0.04, [-0.6, 0.22, 1.2]), 0.02);
    });
  },
  // A mail sack stuffed with letters to the warden.
  encore() {
    return Thumbs.sculpt('fan:encore', 0.06, (sc) => {
      const sack = LP.mat('#8a7a5a', { roughness: 1 }), paper = LP.mat('#efe8d8', { roughness: 1 }), cord = LP.mat('#3a2a1a');
      sc.add(sack, SDF.ellipsoid([1.4, 1.6, 1.2], [0, 1.5, 0]), 0.3);
      sc.add(cord, SDF.torus(0.55, 0.06, [0, 2.9, 0], [0, 0, 0]), 0.05);
      for (let k = 0; k < 5; k++) sc.add(paper, SDF.box([0.9, 0.05, 0.6], 0.02, [-0.3 + k * 0.15, 3.1 + k * 0.05, -0.2 + (k % 2) * 0.3], [0.4 * (k % 2 ? 1 : -1), k * 0.6, 0.3]), 0.01);
    });
  },
};

// ---------- The picture renderer ----------
const Thumbs = {
  W: 200, H: 140,
  cache: {},
  queue: [],

  sculpt(key, cell, fill) {
    const g = new THREE.Group(), sc = new Sculpt(key, cell);
    fill(sc);
    sc.build(g);
    return g;
  },

  setup() {
    if (this.r) return true;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = this.W; canvas.height = this.H;
      this.r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.r.setSize(this.W, this.H, false);
      this.r.outputColorSpace = THREE.SRGBColorSpace;
    } catch (e) { this.r = null; return false; }
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a2430, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 5, 4);
    this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(30, this.W / this.H, 0.01, 1000);
    return true;
  },

  // What to show for a card, and which part of it to frame.
  subject(type, id, extra) {
    if (type === 'weapon') return { obj: Models.weapon(id), view: [-1.3, 0.18] }; // from the side
    if (type === 'trinket') return { obj: Models.trinket(id), view: [0.4, 0.2] };
    if (type === 'contra') return { obj: Models.contra(id), view: [0.55, 0.6] };
    if (type === 'fan') return { obj: (FAN_BUILD[id] || FAN_BUILD.encore)(), view: [0.55, 0.45] };
    if (type === 'mod') { // fitted on a gun it fits (one of yours if you have one), framed on the attachment
      const gun = extra || MODS[id].fits[0];
      const g = Models.modVisuals(Models.weapon(gun), gun, [id], false), focus = [];
      g.traverse((o) => { if (o.isMesh && o.userData.modVis) focus.push(o); });
      return { obj: g, near: focus.length ? focus : null, view: [-1.2, 0.25], pad: 1.1 };
    }
    if (type === 'part') { // on a car, framed on where it shows
      const slot = PARTS[id].slot, gear = { engine: { id: 'stock_engine' }, tyres: { id: 'stock_tyres' }, armour: { id: 'stock_armour' }, nitro: { id: 'stock_nitro' } };
      for (const k in gear) if (!PARTS[gear[k].id]) gear[k] = { id: Object.keys(PARTS).find((p) => PARTS[p].slot === k && !PARTS[p].price) || id };
      gear[slot] = { id, tune: 0 };
      const car = Models.car({ style: 'sedan', color: '#7a6a5a', accent: '#222', gear, rims: 'steel' });
      let focus = null;
      if (slot === 'tyres') car.traverse((o) => { if (!focus && o.userData.wheels) focus = o.userData.wheels[1]; });
      else car.traverse((o) => { if (!focus && o.userData.gear === slot) focus = o; });
      if (slot === 'armour') { focus = null; car.traverse((o) => { if (!focus && o.userData.wheels) focus = o.userData.wheels; }); } // the whole car, by its wheels
      const view = { tyres: [0.35, 0.12], nitro: [-1.2, 1.0], engine: [1.2, 1.05], armour: [0.7, 0.35] }[slot];
      return { obj: car, focus, view, pad: { tyres: 1.3, nitro: 2.2, engine: 1.9, armour: 0.85 }[slot] };
    }
    if (type === 'shield') return { obj: Models.roofMount('lmg', id), view: [-0.75, 0.3], pad: 1.0 };
    if (type === 'mount') { const [gun, sh] = id.split('-'); return { obj: Models.roofMount(gun, sh), view: [-0.75, 0.3], pad: 1.0 }; }
    if (type === 'ability') return { obj: (KIT_BUILD[id] || (() => Models.shopProp({ type, id }, '#c9a443')))(), view: [0.6, 0.3] };
    if (type === 'chip') return { obj: KIT_BUILD.chip(id), view: [0.4, 0.75] };
    return { obj: Models.shopProp({ type, id }, '#c9a443'), view: [0.6, 0.35] };
  },

  render(key) {
    if (!this.setup()) return null;
    const [type, id, extra] = key.split(':');
    let S;
    const collect = Sculpt.collect;
    Sculpt.collect = false; // build the meshes now, even while the game is still warming its models up in the background
    try { S = this.subject(type, id, extra); } catch (e) { return null; } finally { Sculpt.collect = collect; }
    const root = new THREE.Group();
    root.add(S.obj);
    this.scene.add(root);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const o of [].concat(S.focus || S.obj)) box.expandByObject(o);
    const sph = box.getBoundingSphere(new THREE.Sphere());
    if (S.near) { // an attachment: lean the view towards it and in closer, keeping enough gun round it to see where it goes
      const nb = new THREE.Box3();
      for (const o of S.near) nb.expandByObject(o);
      const ns = nb.getBoundingSphere(new THREE.Sphere());
      sph.center.lerp(ns.center, 0.6);
      sph.radius = Math.max(ns.radius * 2.2, sph.radius * 0.6);
    }
    const [yaw, pitch] = S.view, dist = (sph.radius * (S.pad || 1.15)) / Math.sin((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(sph.center.x + Math.sin(yaw) * Math.cos(pitch) * dist, sph.center.y + Math.sin(pitch) * dist, sph.center.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    this.camera.near = dist / 50; this.camera.far = dist * 10;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(sph.center);
    this.r.setClearColor(0x000000, 0);
    this.r.render(this.scene, this.camera);
    const url = this.r.domElement.toDataURL('image/png');
    this.scene.remove(root);
    return url;
  },

  key(card, b) {
    if (card.type === 'mod') {
      const mine = b && b.rack.concat(b.stash.weapons).find((w) => MODS[card.id].fits.includes(w.id));
      return `mod:${card.id}:${mine ? mine.id : MODS[card.id].fits[0]}`;
    }
    return `${card.type}:${card.id}`;
  },

  // An <img> for a card; filled in shortly if it isn't cached yet.
  img(card, b) {
    const k = this.key(card, b), src = this.cache[k];
    if (!src && !this.queue.includes(k)) this.queue.push(k);
    this.kick();
    return `<img class="thumb" data-thumb="${k}" alt="" ${src ? `src="${src}"` : ''}>`;
  },

  kick() {
    if (this.pending || !this.queue.length) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      const k = this.queue.shift();
      if (k && !this.cache[k]) this.cache[k] = this.render(k) || '';
      if (k) for (const el of document.querySelectorAll(`img[data-thumb="${k}"]`)) if (this.cache[k]) el.src = this.cache[k];
      this.kick();
    });
  },
};
