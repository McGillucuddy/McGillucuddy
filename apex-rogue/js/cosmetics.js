'use strict';
// Cosmetic customization: kept between runs in localStorage and unlocked with reputation.
// Every option is { id, name, rep } (rep = reputation needed to unlock).

const COSMETICS = {
  style: [
    { id: 'comet', name: 'Coupe', rep: 0 }, { id: 'brick', name: 'Estate', rep: 20 },
    { id: 'wasp', name: 'Hot Hatch', rep: 60 }, { id: 'phantom', name: 'Fastback', rep: 120 },
  ],
  paint: [
    { id: 'red', name: 'Rust Red', color: '#a8322a', rep: 0 }, { id: 'primer', name: 'Primer Grey', color: '#6f6f68', rep: 0 },
    { id: 'orange', name: 'Prison Orange', color: '#d96a1e', rep: 0 }, { id: 'white', name: 'Dirty White', color: '#c9c4b4', rep: 10 },
    { id: 'black', name: 'Matte Black', color: '#2a2a2e', rep: 30 }, { id: 'olive', name: 'Army Olive', color: '#5a6b3a', rep: 60 },
    { id: 'teal', name: 'Pool Teal', color: '#2f7a78', rep: 80 }, { id: 'blue', name: 'Patrol Blue', color: '#2f4f8a', rep: 100 },
    { id: 'purple', name: 'Bruise Purple', color: '#5b3a6e', rep: 130 }, { id: 'cream', name: 'Faded Cream', color: '#d8cfb0', rep: 150 },
    { id: 'lime', name: 'Toxic Lime', color: '#8fb52a', rep: 200 }, { id: 'gold', name: "Warden's Gold", color: '#c9a443', rep: 250 },
  ],
  twoTone: [
    { id: 'none', name: 'Single colour', rep: 0 }, { id: 'roof', name: 'Roof', rep: 15 },
    { id: 'lower', name: 'Lower body', rep: 40 }, { id: 'hood', name: 'Hood', rep: 70 },
  ],
  finish: [
    { id: 'gloss', name: 'Gloss', rep: 0 }, { id: 'matte', name: 'Matte', rep: 0 },
    { id: 'rusty', name: 'Rusted Out', rep: 40 }, { id: 'patched', name: 'Primer Patches', rep: 80 },
  ],
  grime: [
    { id: 'clean', name: 'Washed', rep: 0 }, { id: 'dirty', name: 'Road Dirt', rep: 0 }, { id: 'filthy', name: 'Caked in Mud', rep: 25 },
  ],
  livery: [
    { id: 'none', name: 'Plain', rep: 0 }, { id: 'stencil', name: 'Spray Stencil', rep: 0 },
    { id: 'roundel', name: 'Racing Roundel', rep: 0 }, { id: 'stripes', name: 'Twin Stripes', rep: 50 },
    { id: 'flames', name: 'Flames', rep: 120 }, { id: 'skull', name: 'Skull', rep: 200 },
  ],
  rims: [
    { id: 'spoke5', name: '5-Spoke', rep: 0 }, { id: 'steel', name: 'Steelies', rep: 0 },
    { id: 'black', name: 'Blacked Out', rep: 20 }, { id: 'slotted', name: 'Slot Mags', rep: 50 }, { id: 'wire', name: 'Wire Wheels', rep: 110 },
  ],
  bumper: [
    { id: 'stock', name: 'Stock', rep: 0 }, { id: 'pushbar', name: 'Push Bar', rep: 15 },
    { id: 'bullbar', name: 'Bull Bar', rep: 35 }, { id: 'plow', name: 'Ram Plow', rep: 90 },
  ],
  roof: [
    { id: 'stock', name: 'Stock', rep: 0 }, { id: 'none', name: 'Bare', rep: 0 }, { id: 'rack', name: 'Cargo Rack', rep: 20 },
    { id: 'lightbar', name: 'Light Bar', rep: 55 }, { id: 'cage', name: 'Outer Cage', rep: 140 },
  ],
  spoiler: [
    { id: 'stock', name: 'Stock', rep: 0 }, { id: 'none', name: 'None', rep: 0 }, { id: 'lip', name: 'Lip', rep: 10 },
    { id: 'wing', name: 'Wing', rep: 45 }, { id: 'bigwing', name: 'Big Wing', rep: 100 },
  ],
  exhaust: [
    { id: 'single', name: 'Single', rep: 0 }, { id: 'twin', name: 'Twin', rep: 15 }, { id: 'side', name: 'Side Pipes', rep: 75 },
  ],
  underglow: [
    { id: 'none', name: 'None', rep: 0 }, { id: 'red', name: 'Red', color: '#ff2a2a', rep: 60 },
    { id: 'green', name: 'Green', color: '#3cff6a', rep: 90 }, { id: 'violet', name: 'Violet', color: '#a64dff', rep: 120 },
  ],
  // Cabin
  seats: [
    { id: 'vinyl', name: 'Torn Vinyl', rep: 0 }, { id: 'leather', name: 'Black Leather', rep: 20 },
    { id: 'tartan', name: 'Tartan', rep: 45 }, { id: 'beaded', name: 'Bead Covers', rep: 70 }, { id: 'leopard', name: 'Leopard Print', rep: 130 },
  ],
  wheelWrap: [
    { id: 'tape', name: 'Duct Tape', rep: 0 }, { id: 'leather', name: 'Stitched Leather', rep: 25 },
    { id: 'fur', name: 'Fuzzy Cover', rep: 60 }, { id: 'chain', name: 'Chain Wheel', rep: 150 },
  ],
  dash: [
    { id: 'black', name: 'Black', color: '#1b1d22', rep: 0 }, { id: 'tan', name: 'Tan', color: '#6a5640', rep: 15 },
    { id: 'burgundy', name: 'Burgundy', color: '#4a1c22', rep: 40 }, { id: 'olive', name: 'Olive Drab', color: '#353a26', rep: 65 },
  ],
  bulb: [
    { id: 'warm', name: 'Warm', color: '#ffd9a0', rep: 0 }, { id: 'red', name: 'Red', color: '#ff4a3a', rep: 30 },
    { id: 'green', name: 'Sickly Green', color: '#9aff7a', rep: 60 }, { id: 'uv', name: 'Blacklight', color: '#a07aff', rep: 110 },
  ],
  ornament: [
    { id: 'none', name: 'None', rep: 0 }, { id: 'hula', name: 'Hula Girl', rep: 15 },
    { id: 'dog', name: 'Nodding Dog', rep: 40 }, { id: 'saint', name: 'Saint Figurine', rep: 80 }, { id: 'skull', name: 'Skull', rep: 160 },
  ],
  // Guns (one finish per weapon type)
  gunFinish: [
    { id: 'stock', name: 'Stock', rep: 0 }, { id: 'rust', name: 'Rusted', rep: 0 }, { id: 'tape', name: 'Duct-Taped', rep: 20 },
    { id: 'camo', name: 'Camo', rep: 50 }, { id: 'chrome', name: 'Chrome', rep: 100 }, { id: 'gold', name: 'Gold', rep: 220 },
  ],
};

const COSMETIC_KEY = 'apexrogue_cosmetics_v1';
const LOOK_KEYS = ['style', 'paint', 'paint2', 'twoTone', 'finish', 'grime', 'livery', 'number', 'rims', 'bumper', 'roof', 'spoiler', 'exhaust', 'underglow', 'seats', 'wheelWrap', 'dash', 'bulb', 'ornament', 'gunFinish', 'inmate', 'plate'];

function loadCosmetics() {
  const def = {
    style: 'comet', paint: 'red', paint2: 'black', twoTone: 'none', finish: 'gloss', grime: 'dirty', livery: 'stencil', number: 47,
    rims: 'spoke5', bumper: 'stock', roof: 'stock', spoiler: 'stock', exhaust: 'single', underglow: 'none',
    seats: 'vinyl', wheelWrap: 'tape', dash: 'black', bulb: 'warm', ornament: 'none',
    gunFinish: { smg: 'stock', shotgun: 'stock', rocket: 'stock', flare: 'stock' },
    inmate: '4471', plate: 'INM 4471', rep: 0, presets: [null, null, null],
  };
  let c;
  try { c = Object.assign(def, JSON.parse(localStorage.getItem(COSMETIC_KEY)) || {}); } catch (e) { c = def; }
  c.gunFinish = Object.assign({ smg: 'stock', shotgun: 'stock', rocket: 'stock', flare: 'stock' }, c.gunFinish);
  if (!Array.isArray(c.presets)) c.presets = [null, null, null];
  return c;
}

function saveCosmetics(c) {
  try { localStorage.setItem(COSMETIC_KEY, JSON.stringify(c)); } catch (e) { /* storage unavailable */ }
}

const cosOption = (key, id) => (COSMETICS[key] || []).find((o) => o.id === id);
const paintColor = (c) => (cosOption('paint', c.paint) || COSMETICS.paint[0]).color;

// Everything the 3D models need to dress your car, cabin and guns.
function carLook(c) {
  return {
    style: c.style, color: paintColor(c), accent: '#1d1d1d', finish: c.finish, livery: c.livery, number: c.number, plate: c.plate,
    paint2: (cosOption('paint', c.paint2) || COSMETICS.paint[4]).color, twoTone: c.twoTone, grime: c.grime,
    rims: c.rims, bumper: c.bumper, roof: c.roof, spoiler: c.spoiler, exhaust: c.exhaust,
    underglow: (cosOption('underglow', c.underglow) || {}).color || null,
    cabin: {
      seats: c.seats, wheelWrap: c.wheelWrap, dash: (cosOption('dash', c.dash) || COSMETICS.dash[0]).color,
      bulb: (cosOption('bulb', c.bulb) || COSMETICS.bulb[0]).color, ornament: c.ornament, inmate: c.inmate,
    },
    gunFinish: c.gunFinish,
  };
}

// Presets: save / load a whole look.
function savePreset(c, i) {
  const snap = {};
  for (const k of LOOK_KEYS) snap[k] = JSON.parse(JSON.stringify(c[k]));
  c.presets[i] = snap;
}

function loadPreset(c, i) {
  const snap = c.presets[i];
  if (!snap) return;
  for (const k of LOOK_KEYS) if (snap[k] !== undefined) {
    // Skip anything no longer unlocked (shouldn't happen, but presets outlive balance changes).
    const opt = cosOption(k, snap[k]);
    if (opt && opt.rep > c.rep) continue;
    c[k] = JSON.parse(JSON.stringify(snap[k]));
  }
}

const allCosmeticOptions = () => Object.entries(COSMETICS).flatMap(([k, list]) => list.map((o) => Object.assign({ key: k }, o)));
// Reputation from a race: finishing, winning and wrecking rivals all build your name.
const raceRep = (place, wrecks) => 10 + (place === 1 ? 25 : place <= 3 ? 10 : 0) + wrecks * 5;
