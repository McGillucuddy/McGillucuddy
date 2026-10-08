'use strict';
// Build system: parts (with durability, plus one spare), ammo-based weapons, abilities,
// trinkets (rule-changers that hang in the cabin) and driver chips (change how the AI drives).

const PART_SLOTS = ['engine', 'tyres', 'armour', 'nitro'];
const SLOT_NAMES = { engine: 'Engine', tyres: 'Tyres', armour: 'Armour', nitro: 'Nitro' };

const PARTS = {
  stock_engine: { slot: 'engine', name: 'Stock Engine', desc: 'Tired but honest.', price: 0, dur: 100, mods: {} },
  turbo_v6: { slot: 'engine', name: 'Turbo V6', desc: '+8% top speed, +15% acceleration. Fragile.', price: 260, dur: 70, mods: { top: 1.08, accel: 1.15 } },
  diesel: { slot: 'engine', name: 'Diesel Block', desc: '+12% acceleration and very tough, but -4% top speed.', price: 200, dur: 170, mods: { top: 0.96, accel: 1.12 } },
  racing_v8: { slot: 'engine', name: 'Racing V8', desc: '+15% top speed. Breaks easily.', price: 340, dur: 55, mods: { top: 1.15, accel: 1.05 } },

  stock_tyres: { slot: 'tyres', name: 'Bald Tyres', desc: 'Round, mostly.', price: 0, dur: 100, mods: {} },
  slicks: { slot: 'tyres', name: 'Racing Slicks', desc: '+20% grip on tarmac. Terrible off-road.', price: 220, dur: 70, mods: { grip: 1.2, offroad: 1.6 } },
  all_terrain: { slot: 'tyres', name: 'All-Terrain Tyres', desc: 'Off-road slowdown -60%, but -5% grip.', price: 180, dur: 130, mods: { grip: 0.95, offroad: 0.4 } },
  studded: { slot: 'tyres', name: 'Studded Tyres', desc: '+40% grip on ice and snow. -4% top speed.', price: 180, dur: 110, mods: { iceGrip: 1.4, top: 0.96 } },

  scrap_plating: { slot: 'armour', name: 'Scrap Plating', desc: 'Absorbs 20% of incoming damage.', price: 0, dur: 60, mods: { absorb: 0.2 } },
  riot_plates: { slot: 'armour', name: 'Riot Plates', desc: 'Absorbs 40% of damage. Heavy: -5% speed and acceleration.', price: 260, dur: 130, mods: { absorb: 0.4, top: 0.95, accel: 0.95, mass: 1.3 } },
  reactive: { slot: 'armour', name: 'Reactive Armour', desc: 'Absorbs 70% of explosion damage, 15% of everything else.', price: 240, dur: 80, mods: { absorb: 0.15, blastAbsorb: 0.7 } },
  spiked_cage: { slot: 'armour', name: 'Spiked Cage', desc: 'Absorbs 15%. Your rams deal double damage.', price: 220, dur: 100, mods: { absorb: 0.15, ram: 2 } },

  stock_nitro: { slot: 'nitro', name: 'Rusty Bottle', desc: 'A standard nitrous bottle.', price: 0, dur: 100, mods: {} },
  big_bottle: { slot: 'nitro', name: 'Big Bottle', desc: '+80% nitro capacity, -10% power.', price: 180, dur: 100, mods: { nitroCap: 1.8, nitroPower: 0.9 } },
  hot_mix: { slot: 'nitro', name: 'Hot Mix', desc: '+50% nitro power. Wears out fast.', price: 220, dur: 60, mods: { nitroPower: 1.5 } },
  recycler: { slot: 'nitro', name: 'Recycler', desc: 'Nitro refills 3x faster, -20% capacity.', price: 240, dur: 90, mods: { nitroCap: 0.8, nitroRegen: 3 } },
};
const BROKEN_TEXT = {
  engine: 'Engine broken: top speed and acceleration crippled',
  tyres: 'Tyres shredded: grip halved',
  armour: 'Armour torn off: no damage absorption',
  nitro: 'Nitro bottle cracked: no nitro',
};

// Ammo-based weapons. mag = rounds per magazine, reserve = spare rounds carried.
const WEAPONS = {
  smg: { name: 'SMG', desc: 'Fast, accurate, low damage. Shoots rockets and mines out of the air.', kind: 'bullet', auto: true, mag: 30, reload: 1.6, rate: 0.085, pellets: 1, spread: 0.035, speed: 1500, dmg: 3.2, life: 0.6, pack: 60, packPrice: 40, start: 90, price: 0 },
  shotgun: { name: 'Pump Shotgun', desc: 'Close range. Big knockback; one blast clears incoming rockets.', kind: 'bullet', auto: false, mag: 6, reload: 2.2, rate: 0.7, pellets: 7, spread: 0.2, speed: 1250, dmg: 3.4, life: 0.3, knock: 70, pack: 12, packPrice: 40, start: 18, price: 220 },
  rocket: { name: 'Rocket Launcher', desc: 'Slow, explosive and devastating.', kind: 'rocket', auto: false, mag: 1, reload: 1.8, rate: 0.6, speed: 950, dmg: 26, radius: 62, life: 2.2, pack: 3, packPrice: 90, start: 3, price: 300 },
  flare: { name: 'Flare Gun', desc: 'Blinds the driver you hit: they swerve and brake for 3 seconds.', kind: 'flare', auto: false, mag: 1, reload: 1.4, rate: 0.5, speed: 1100, dmg: 4, life: 1.2, blind: 3, pack: 4, packPrice: 50, start: 4, price: 180 },
};
const GRENADE_PRICE = 30;
const MAX_GRENADES = 5;

const ABILITIES = {
  shield: { name: 'Shield', desc: 'Blocks everything for 1.1s. Raise it just as a rocket hits to parry it back.', cooldown: 7, price: 0 },
  nitro_burst: { name: 'Nitro Burst', desc: 'Two seconds of free, double-strength boost.', cooldown: 10, price: 160 },
  smoke: { name: 'Smoke Screen', desc: 'Drops a smoke cloud. Rivals inside lose their lock and slow down.', cooldown: 12, price: 180 },
  emp: { name: 'EMP Pulse', desc: 'Destroys nearby rockets and mines and jams rival weapons for 4s.', cooldown: 15, price: 240 },
};

const TRINKETS = {
  dice: { name: 'Fuzzy Dice', desc: 'A parry instantly reloads the weapon in your hands.' },
  rabbit_foot: { name: "Rabbit's Foot", desc: 'Once per race, a hit that would wreck your hull leaves it at 1.' },
  horseshoe: { name: 'Rusty Horseshoe', desc: 'Your rams deal triple damage, but you take +50% ram damage.' },
  keys: { name: "Warden's Keys", desc: '+1 weapon on the rack. Rival gunners lock on 25% faster.' },
  rosary: { name: 'Burnt Rosary', desc: 'Explosions near you knock 2s off your ability cooldowns.' },
  bobblehead: { name: 'Bobblehead', desc: '+40 scrap for every rival you wreck.' },
  freshener: { name: 'Pine Air Freshener', desc: 'Your parts are 25% more durable.' },
  medal: { name: 'St. Christopher Medal', desc: 'Swerve cooldown halved; swerving makes you untouchable for 0.4s.' },
};

const CHIPS = {
  hothead: { name: 'Hothead Chip', desc: 'Your driver rams anything nearby (+50% ram damage) but clips more walls.' },
  cautious: { name: 'Cautious Chip', desc: 'Your driver barely scratches the walls (-70% wall damage) but brakes far too early.' },
  daredevil: { name: 'Daredevil Chip', desc: 'Your driver cuts corners through the dirt (off-road -50%) but spins out on oil.' },
  gun_nut: { name: 'Gun Nut Chip', desc: 'Weapons reload 40% faster, but your driver wobbles while you shoot.' },
};

const PLACE_SCRAP = [220, 160, 120, 80, 50, 30, 20];
const WRECK_SCRAP = 30;
const STRIKES_TO_LOSE = 3;

function newBuild() {
  const b = {
    scrap: 150, hull: 100, maxHull: 100, race: 0, strikes: 0, wins: 0,
    parts: {}, spare: null,
    rack: [], rackBase: 2,
    grenades: 3,
    abilities: ['shield', null],
    trinkets: [],
    chip: null,
  };
  for (const id of ['stock_engine', 'stock_tyres', 'scrap_plating', 'stock_nitro']) installPart(b, id);
  addWeapon(b, 'smg');
  addWeapon(b, 'rocket');
  return b;
}

const has = (b, trinket) => b.trinkets.includes(trinket);
const rackSlots = (b) => b.rackBase + (has(b, 'keys') ? 1 : 0);
const partMaxDur = (b, id) => Math.round(PARTS[id].dur * (has(b, 'freshener') ? 1.25 : 1));

function installPart(b, id) {
  b.parts[PARTS[id].slot] = { id, dur: partMaxDur(b, id) };
}

function addWeapon(b, id, replaceIndex) {
  const w = WEAPONS[id];
  const entry = { id, mag: w.mag, reserve: Math.max(0, w.start - w.mag) };
  if (replaceIndex != null) b.rack[replaceIndex] = entry;
  else b.rack.push(entry);
}

const partBroken = (b, slot) => b.parts[slot].dur <= 0;

// Car stats from the base car + installed parts (broken parts cripple their stat).
function buildStats(b) {
  const s = computeStats(newRun('comet', 1));
  s.maxHp = b.maxHull;
  s.absorb = 0; s.blastAbsorb = 0; s.ram = 1; s.iceGrip = 1;
  for (const slot of PART_SLOTS) {
    const part = b.parts[slot], m = PARTS[part.id].mods;
    if (part.dur <= 0) continue;
    if (m.top) s.top *= m.top;
    if (m.accel) s.accel *= m.accel;
    if (m.grip) s.grip *= m.grip;
    if (m.offroad) s.offroadMul *= m.offroad;
    if (m.iceGrip) s.iceGrip *= m.iceGrip;
    if (m.mass) s.mass *= m.mass;
    if (m.absorb) s.absorb = m.absorb;
    if (m.blastAbsorb) s.blastAbsorb = m.blastAbsorb;
    if (m.ram) s.ram *= m.ram;
    if (m.nitroCap) s.nitroCap *= m.nitroCap;
    if (m.nitroPower) s.nitroPower *= m.nitroPower;
    if (m.nitroRegen) s.nitroRegen *= m.nitroRegen;
  }
  if (partBroken(b, 'engine')) { s.top *= 0.55; s.accel *= 0.5; }
  if (partBroken(b, 'tyres')) { s.grip *= 0.5; s.handling *= 0.8; }
  if (partBroken(b, 'nitro')) { s.nitroCap = 0.001; s.nitroRegen = 0; }
  if (b.chip === 'daredevil') s.offroadMul *= 0.5;
  return s;
}

// ---------- Rewards & shop ----------

function itemCard(type, id) {
  const src = { part: PARTS, weapon: WEAPONS, ability: ABILITIES, trinket: TRINKETS, chip: CHIPS }[type][id];
  return { type, id, name: src.name, desc: src.desc, price: src.price || 0 };
}

function rollRewards(b, rng, count) {
  const pool = [];
  for (const id in PARTS) if (PARTS[id].price > 0 && b.parts[PARTS[id].slot].id !== id) pool.push(['part', id, 3]);
  for (const id in WEAPONS) if (!b.rack.some((w) => w.id === id)) pool.push(['weapon', id, 3]);
  for (const id in ABILITIES) if (!b.abilities.includes(id)) pool.push(['ability', id, 2]);
  for (const id in TRINKETS) if (!has(b, id)) pool.push(['trinket', id, 2]);
  for (const id in CHIPS) if (b.chip !== id) pool.push(['chip', id, 1]);
  const out = [];
  while (out.length < count && pool.length) {
    const pickd = weightedPick(rng, pool, (p) => p[2]);
    pool.splice(pool.indexOf(pickd), 1);
    out.push(itemCard(pickd[0], pickd[1]));
  }
  return out;
}

function rollShop(b, rng) {
  const parts = shuffle(rng, Object.keys(PARTS).filter((id) => PARTS[id].price > 0 && b.parts[PARTS[id].slot].id !== id)).slice(0, 2);
  const weapons = shuffle(rng, Object.keys(WEAPONS).filter((id) => WEAPONS[id].price > 0 && !b.rack.some((w) => w.id === id))).slice(0, 1);
  const abil = shuffle(rng, Object.keys(ABILITIES).filter((id) => ABILITIES[id].price > 0 && !b.abilities.includes(id))).slice(0, 1);
  return [...parts.map((id) => itemCard('part', id)), ...weapons.map((id) => itemCard('weapon', id)), ...abil.map((id) => itemCard('ability', id))];
}

const repairHullCost = (b) => Math.ceil((b.maxHull - b.hull) * 1.2);
const repairPartCost = (b, slot) => Math.ceil((partMaxDur(b, b.parts[slot].id) - Math.max(0, b.parts[slot].dur)) * 0.8) + (partBroken(b, slot) ? 30 : 0);
const spareCost = (b, slot) => Math.max(60, Math.round(PARTS[b.parts[slot].id].price * 0.6));

// Install an item; returns false if a choice (which weapon/ability to replace) is needed.
function applyItem(b, card, replaceIndex) {
  if (card.type === 'part') installPart(b, card.id);
  else if (card.type === 'weapon') {
    const owned = b.rack.find((w) => w.id === card.id);
    if (owned) { owned.reserve += WEAPONS[card.id].pack * 2; return true; } // a duplicate becomes ammo
    if (b.rack.length >= rackSlots(b) && replaceIndex == null) return false;
    addWeapon(b, card.id, replaceIndex);
  } else if (card.type === 'ability') {
    const free = b.abilities.indexOf(null);
    if (free >= 0 && replaceIndex == null) b.abilities[free] = card.id;
    else if (replaceIndex == null) return false;
    else b.abilities[replaceIndex] = card.id;
  } else if (card.type === 'trinket') {
    b.trinkets.push(card.id);
    if (card.id === 'freshener') for (const slot of PART_SLOTS) b.parts[slot].dur = Math.round(b.parts[slot].dur * 1.25);
  } else if (card.type === 'chip') b.chip = card.id;
  return true;
}
