'use strict';
// Cosmetic customization: kept between runs in localStorage and unlocked with reputation.
// Every option is { id, name, rep } (rep = reputation needed to unlock).

const COSMETICS = {
  style: [
    { id: 'comet', name: 'Coupe', rep: 0 }, { id: 'brick', name: 'Estate', rep: 20 },
    { id: 'wasp', name: 'Hot Hatch', rep: 60 }, { id: 'phantom', name: 'Fastback', rep: 120 },
    { id: 'sedan', name: 'Sedan', rep: 30 }, { id: 'pickup', name: 'Pickup', rep: 90 }, { id: 'van', name: 'Panel Van', rep: 160 },
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
    { id: 'camo', name: 'Woodland Camo', rep: 50, color: '#5a6040' }, { id: 'camo_desert', name: 'Desert Camo', rep: 60, color: '#c8b088' },
    { id: 'camo_jungle', name: 'Jungle Camo', rep: 65, color: '#3e5a2a' }, { id: 'camo_urban', name: 'Urban Camo', rep: 75, color: '#8a8c8e' },
    { id: 'camo_fleck', name: 'Flecktarn', rep: 80, color: '#6a7046' }, { id: 'camo_tiger', name: 'Tiger Stripe', rep: 90, color: '#6a7448' },
    { id: 'camo_splinter', name: 'Splinter', rep: 100, color: '#8a8a62' }, { id: 'camo_digital', name: 'Digital Camo', rep: 110, color: '#5a6240' },
    { id: 'camo_navy', name: 'Navy Digital', rep: 120, color: '#2a3a5a' }, { id: 'camo_arctic', name: 'Arctic Camo', rep: 130, color: '#e6eaee' },
    { id: 'camo_midnight', name: 'Midnight', rep: 140, color: '#2a2c30' }, { id: 'camo_hex', name: 'Hex', rep: 150, color: '#3a3e42' },
    { id: 'camo_crimson', name: 'Crimson Tiger', rep: 160, color: '#8a1a14' }, { id: 'camo_zebra', name: 'Zebra', rep: 170, color: 'repeating-linear-gradient(60deg,#f0f0ea 0 4px,#141414 4px 8px)' },
    { id: 'camo_candy', name: 'Candy Camo', rep: 190, color: '#f2a6c8' },
    // Colourful scrap-yard paint jobs.
    { id: 'camo_hazard', name: 'Hazard Stripes', rep: 40, color: 'repeating-linear-gradient(45deg,#f2c21a 0 4px,#141414 4px 8px)' },
    { id: 'camo_chipped', name: 'Chipped Teal', rep: 70, color: 'linear-gradient(135deg,#2a9a9a 60%,#8a4a22 60%)' },
    { id: 'camo_sheetrust', name: 'Rusted Sheet', rep: 95, color: 'conic-gradient(#8a4a22 0 25%,#4a2a16 0 50%,#a86030 0 75%,#7a7672 0)' },
    { id: 'camo_roadsign', name: 'Road Sign Scraps', rep: 135, color: 'conic-gradient(#b8201a 0 25%,#e8c21a 0 50%,#1e6a3a 0 75%,#f2f2ee 0)' },
    { id: 'camo_tincan', name: 'Tin Can Patches', rep: 155, color: 'linear-gradient(180deg,#c8ccd0 30%,#c8201a 30% 70%,#9aa0a6 70%)' },
    { id: 'camo_patchwork', name: 'Scrap Patchwork', rep: 115, color: 'conic-gradient(#2a8a8a 0 25%,#d86a2a 0 50%,#c8a02a 0 75%,#b0281e 0)' },
    { id: 'camo_graffiti', name: 'Graffiti', rep: 145, color: 'linear-gradient(135deg,#141416 30%,#ff3aa8 30% 45%,#3af0ff 45% 60%,#ffe23a 60% 75%,#141416 75%)' },
    { id: 'camo_splatter', name: 'Riot Splatter', rep: 175, color: 'radial-gradient(circle at 30% 30%,#ff2a7a 20%,transparent 21%),radial-gradient(circle at 70% 60%,#2ad8ff 18%,#d8d4cc 19%)' },
    { id: 'chrome', name: 'Chrome', rep: 100, color: '#dfe4ea' }, { id: 'gold', name: 'Gold', rep: 220, color: '#e0b44a' },
    // Animated: they glow and move.
    { id: 'anim_toxic', name: 'Toxic Ooze ✦', rep: 250, color: 'radial-gradient(#5aff3a,#16240c)' },
    { id: 'anim_lava', name: 'Molten ✦', rep: 280, color: 'linear-gradient(135deg,#1a0d08,#ff7a1a,#1a0d08)' },
    { id: 'anim_static', name: 'Static ✦', rep: 300, color: 'repeating-linear-gradient(0deg,#ddd 0 2px,#333 2px 4px)' },
    { id: 'anim_jury', name: 'Jury-Rigged ✦', rep: 340, color: 'repeating-linear-gradient(0deg,#26282a 0 3px,#3af0ff 3px 4px,#26282a 4px 7px,#ff3ad8 7px 8px)' },
    { id: 'anim_oil', name: 'Oil Slick ✦', rep: 380, color: 'radial-gradient(circle,#c5f 0,#5af 25%,#5f8 45%,#fd5 60%,#24221e 75%)' },
    { id: 'anim_chem', name: 'Chem Burn ✦', rep: 450, color: 'radial-gradient(circle at 35% 40%,#8a3ad8 20%,transparent 22%),radial-gradient(circle at 70% 65%,#5aff3a 18%,#7a7c7a 20%)' },
  ],
};

// Junk welded onto each gun.
COSMETICS.gunKit = [
  { id: 'none', name: 'Clean', rep: 0 }, { id: 'chains', name: 'Hanging Chains', rep: 25 }, { id: 'barbed', name: 'Barbed Wire', rep: 55 },
  { id: 'plates', name: 'Scrap Plating', rep: 85 }, { id: 'spikes', name: 'Spikes & Bayonet', rep: 120 }, { id: 'skull', name: 'Skull Charm', rep: 150 },
  { id: 'patched', name: 'Patched Up', rep: 70 }, { id: 'deathrow', name: 'Death Row (all of it)', rep: 260 },
];

const COSMETIC_KEY = 'apexrogue_cosmetics_v1';
const LOOK_KEYS = ['style', 'paint', 'paint2', 'twoTone', 'finish', 'grime', 'livery', 'number', 'rims', 'bumper', 'roof', 'spoiler', 'exhaust', 'underglow', 'seats', 'wheelWrap', 'dash', 'bulb', 'ornament', 'gunFinish', 'gunKit', 'patchSeed', 'inmate', 'plate'];

function loadCosmetics() {
  const def = {
    style: 'comet', paint: 'red', paint2: 'black', twoTone: 'none', finish: 'gloss', grime: 'dirty', livery: 'stencil', number: 47,
    rims: 'spoke5', bumper: 'stock', roof: 'stock', spoiler: 'stock', exhaust: 'single', underglow: 'none',
    seats: 'vinyl', wheelWrap: 'tape', dash: 'black', bulb: 'warm', ornament: 'none',
    gunFinish: { smg: 'stock', shotgun: 'stock', rocket: 'stock', flare: 'stock' },
    gunKit: { smg: 'none', shotgun: 'none', rocket: 'none', flare: 'none' },
    patchSeed: { smg: 0, shotgun: 0, rocket: 0, flare: 0 },
    inmate: '4471', plate: 'INM 4471', rep: 0, presets: [null, null, null],
  };
  let c;
  try { c = Object.assign(def, JSON.parse(localStorage.getItem(COSMETIC_KEY)) || {}); } catch (e) { c = def; }
  c.gunFinish = Object.assign({ smg: 'stock', shotgun: 'stock', rocket: 'stock', flare: 'stock' }, c.gunFinish);
  c.gunKit = Object.assign({ smg: 'none', shotgun: 'none', rocket: 'none', flare: 'none' }, c.gunKit);
  c.patchSeed = Object.assign({ smg: 0, shotgun: 0, rocket: 0, flare: 0 }, c.patchSeed);
  const renamed = { anim_neon: 'anim_jury', anim_galaxy: 'anim_oil', anim_prism: 'anim_chem' }; // finishes that were reworked
  for (const w of Object.keys(c.gunFinish)) if (renamed[c.gunFinish[w]]) c.gunFinish[w] = renamed[c.gunFinish[w]];
  if (Array.isArray(c.presets)) for (const pr of c.presets) if (pr && pr.gunFinish) for (const w of Object.keys(pr.gunFinish)) if (renamed[pr.gunFinish[w]]) pr.gunFinish[w] = renamed[pr.gunFinish[w]];
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
    gunFinish: c.gunFinish, gunKit: c.gunKit, patchSeed: c.patchSeed,
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
