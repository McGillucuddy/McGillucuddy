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
  supercharger: { slot: 'engine', name: 'Supercharged V8', desc: '+12% top speed and acceleration, but wears 50% faster.', price: 320, dur: 90, mods: { top: 1.12, accel: 1.12, wear: 1.5 } },
  electric: { slot: 'engine', name: 'Salvaged Electric', desc: '+25% acceleration (instant torque), -8% top speed. Tough.', price: 280, dur: 140, mods: { top: 0.92, accel: 1.25 } },

  stock_tyres: { slot: 'tyres', name: 'Bald Tyres', desc: 'Round, mostly.', price: 0, dur: 100, mods: {} },
  slicks: { slot: 'tyres', name: 'Racing Slicks', desc: '+20% grip on tarmac. Terrible off-road.', price: 220, dur: 70, mods: { grip: 1.2, offroad: 1.6 } },
  all_terrain: { slot: 'tyres', name: 'All-Terrain Tyres', desc: 'Off-road slowdown -60%, but -5% grip.', price: 180, dur: 130, mods: { grip: 0.95, offroad: 0.4 } },
  studded: { slot: 'tyres', name: 'Studded Tyres', desc: '+40% grip on ice and snow. -4% top speed.', price: 180, dur: 110, mods: { iceGrip: 1.4, top: 0.96 } },
  run_flats: { slot: 'tyres', name: 'Run-Flats', desc: '-5% grip, but when they break you keep 85% grip.', price: 200, dur: 90, mods: { grip: 0.95, runFlat: true } },
  chains: { slot: 'tyres', name: 'Snow Chains', desc: '+60% grip on ice, rams deal +30% damage, -8% top speed.', price: 170, dur: 120, mods: { iceGrip: 1.6, ram: 1.3, top: 0.92 } },

  scrap_plating: { slot: 'armour', name: 'Scrap Plating', desc: 'Absorbs 20% of incoming damage.', price: 0, dur: 60, mods: { absorb: 0.2 } },
  riot_plates: { slot: 'armour', name: 'Riot Plates', desc: 'Absorbs 40% of damage. Heavy: -5% speed and acceleration.', price: 260, dur: 130, mods: { absorb: 0.4, top: 0.95, accel: 0.95, mass: 1.3 } },
  reactive: { slot: 'armour', name: 'Reactive Armour', desc: 'Absorbs 70% of explosion damage, 15% of everything else.', price: 240, dur: 80, mods: { absorb: 0.15, blastAbsorb: 0.7 } },
  spiked_cage: { slot: 'armour', name: 'Spiked Cage', desc: 'Absorbs 15%. Your rams deal double damage.', price: 220, dur: 100, mods: { absorb: 0.15, ram: 2 } },
  ablative: { slot: 'armour', name: 'Ablative Plates', desc: 'Absorbs 50% of damage, but the plates wear away twice as fast.', price: 240, dur: 90, mods: { absorb: 0.5, armourWear: 2 } },
  window_cage: { slot: 'armour', name: 'Window Cage', desc: 'Stops 60% of gunfire, but nothing against blasts or rams.', price: 200, dur: 110, mods: { absorb: 0, bulletAbsorb: 0.6 } },

  stock_nitro: { slot: 'nitro', name: 'Rusty Bottle', desc: 'A standard nitrous bottle.', price: 0, dur: 100, mods: {} },
  big_bottle: { slot: 'nitro', name: 'Big Bottle', desc: '+80% nitro capacity, -10% power.', price: 180, dur: 100, mods: { nitroCap: 1.8, nitroPower: 0.9 } },
  hot_mix: { slot: 'nitro', name: 'Hot Mix', desc: '+50% nitro power. Wears out fast.', price: 220, dur: 60, mods: { nitroPower: 1.5 } },
  recycler: { slot: 'nitro', name: 'Recycler', desc: 'Nitro refills 3x faster, -20% capacity.', price: 240, dur: 90, mods: { nitroCap: 0.8, nitroRegen: 3 } },
  twin_bottles: { slot: 'nitro', name: 'Twin Bottles', desc: '+40% capacity and +40% refill speed.', price: 260, dur: 110, mods: { nitroCap: 1.4, nitroRegen: 1.4 } },
  methanol: { slot: 'nitro', name: 'Methanol Mix', desc: '+25% nitro power and refill speed. Wears faster.', price: 200, dur: 70, mods: { nitroPower: 1.25, nitroRegen: 1.25 } },
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
  lighter: { name: 'Zippo Lighter', desc: 'Your bullets have a 12% chance to set the car they hit alight.' },
  photo: { name: 'Polaroid from Home', desc: 'Repairs in the workshop cost 30% less.' },
  smokes: { name: 'Pack of Smokes', desc: 'Prison currency: everything in the commissary costs 15% less.' },
  eightball: { name: 'Magic 8-Ball', desc: 'One extra card to choose from after every race.' },
  troll: { name: 'Troll Doll', desc: 'Wall hits do 40% less damage to your hull.' },
  sparkplug: { name: 'Lucky Spark Plug', desc: 'Nitro refills 35% faster.' },
  tooth: { name: 'Gold Tooth', desc: '+30% scrap from placings.' },
  dogtags: { name: 'Dog Tags', desc: '+20 maximum hull.' },
  shoes: { name: 'Bronzed Baby Shoes', desc: 'Once per race, when your hull drops below 30%, patch 25 of it back.' },
  compass: { name: 'Dash Compass', desc: 'Your rockets turn 40% harder towards their target.' },
  cassette: { name: 'Mixtape', desc: 'Reloads 20% faster.' },
  teddy: { name: 'Prison Teddy', desc: 'Your shield lasts 50% longer.' },
  clover: { name: 'Four-Leaf Clover', desc: 'Wrecking a rival refills the magazine of the gun in your hands.' },
  snowglobe: { name: 'Snow Globe', desc: 'Pick up a spare grenade after every race.' },
};

const CHIPS = {
  hothead: { name: 'Hothead Chip', desc: 'Your driver rams anything nearby (+50% ram damage) but clips more walls.' },
  cautious: { name: 'Cautious Chip', desc: 'Your driver barely scratches the walls (-70% wall damage) but brakes far too early.' },
  daredevil: { name: 'Daredevil Chip', desc: 'Your driver cuts corners through the dirt (off-road -50%) but spins out on oil.' },
  gun_nut: { name: 'Gun Nut Chip', desc: 'Weapons reload 40% faster, but your driver wobbles while you shoot.' },
  // Driver traits won from bosses.
  veteran: { name: 'Getaway Veteran', desc: 'Your driver takes corners 6% faster, but your car takes 25% more damage from rams.' },
  ghost: { name: 'Ghost Chip', desc: 'Swerves recharge twice as fast, but nitro is 30% weaker.' },
  showboat: { name: 'Showboat Chip', desc: '+50% scrap from placings and wrecks, but rival gunners lock on 25% faster.' },
};

// Weapon mods: two slots per weapon, swappable in the garage.
const MODS = {
  // Common
  ext_mag: { name: 'Extended Mag', rarity: 'common', desc: '+50% magazine size, but reloads 25% slower.', fits: ['smg', 'shotgun', 'rocket', 'flare'], price: 120 },
  quick_mag: { name: 'Speed Loader', rarity: 'common', desc: 'Reloads 40% faster, but -25% magazine size.', fits: ['smg', 'shotgun', 'rocket', 'flare'], price: 120 },
  laser: { name: 'Laser Sight', rarity: 'common', desc: '-60% spread. Paints a red line to your target.', fits: ['smg', 'shotgun'], price: 100 },
  choke: { name: 'Full Choke', rarity: 'common', desc: 'Shotgun spread halved and range +50%.', fits: ['shotgun'], price: 110 },
  hair_trigger: { name: 'Hair Trigger', rarity: 'common', desc: '+30% fire rate, but +40% spread.', fits: ['smg', 'shotgun', 'flare'], price: 110 },
  sawn_off: { name: 'Sawn-Off Barrel', rarity: 'common', desc: '+3 pellets and 30% faster reload, but much wider spread and shorter range.', fits: ['shotgun'], price: 100 },
  // Rare
  incendiary: { name: 'Incendiary Rounds', rarity: 'rare', desc: 'Hits set rivals on fire (3 dmg/s for 3s). Ammo costs 50% more.', fits: ['smg', 'shotgun'], price: 160 },
  ap_rounds: { name: 'Armour-Piercing Rounds', rarity: 'rare', desc: '+35% damage, but -15% fire rate.', fits: ['smg', 'shotgun'], price: 150 },
  suppressor: { name: 'Suppressor', rarity: 'rare', desc: '-15% damage, but rival gunners take 40% longer to lock on to you.', fits: ['smg', 'shotgun'], price: 150 },
  tracer: { name: 'Tracer Rounds', rarity: 'rare', desc: 'Hits mark a rival for 3s: they take +20% damage from everything.', fits: ['smg'], price: 160 },
  slugs: { name: 'Slug Rounds', rarity: 'rare', desc: 'One heavy, accurate slug instead of buckshot. Long range, big knockback.', fits: ['shotgun'], price: 150 },
  bunker_buster: { name: 'Bunker Buster', rarity: 'rare', desc: '+60% blast radius and +20% damage, but slower rockets.', fits: ['rocket'], price: 190 },
  long_burn: { name: 'Long-Burn Flares', rarity: 'rare', desc: 'Blinded drivers stay blind 70% longer.', fits: ['flare'], price: 140 },
  // Epic
  homing: { name: 'Homing Fins', rarity: 'epic', desc: 'Rockets curve toward the rival nearest your aim.', fits: ['rocket'], price: 200 },
  twin_tube: { name: 'Twin Tube', rarity: 'epic', desc: 'Fires two rockets per shot (uses two rounds). Double magazine.', fits: ['rocket'], price: 240 },
  remote_det: { name: 'Remote Detonator', rarity: 'epic', desc: 'Fire again while your rocket is in the air to detonate it.', fits: ['rocket'], price: 220 },
  cluster: { name: 'Cluster Flare', rarity: 'epic', desc: 'Flares burst on impact, blinding every driver within 120.', fits: ['flare'], price: 170 },
  phosphor: { name: 'White Phosphor', rarity: 'epic', desc: 'Flares also set the driver on fire (4 dmg/s).', fits: ['flare'], price: 190 },
};
const modFits = (modId, weaponId) => MODS[modId].fits.includes(weaponId);

// Part tuning: one trade-off slider per part, -1..1 in steps of 0.5. Free to change in the garage.
const TUNING = {
  engine: { left: 'Reliable', right: 'Boosted', desc: 'More power, but the engine wears faster.' },
  tyres: { left: 'Hard', right: 'Soft', desc: 'More grip, but the tyres wear faster.' },
  armour: { left: 'Light', right: 'Heavy', desc: 'Absorbs more, but adds weight (slower).' },
  nitro: { left: 'Capacity', right: 'Power', desc: 'Stronger boost from a smaller bottle.' },
};
const TUNE_STEPS = [-1, -0.5, 0, 0.5, 1];

const PLACE_SCRAP = [220, 160, 120, 80, 50, 30, 20];
const WRECK_SCRAP = 30;
const STRIKES_TO_LOSE = 3;

function newBuild() {
  const b = {
    scrap: 150, hull: 100, maxHull: 100, race: 0, strikes: 0, wins: 0, wrecks: 0,
    parts: {}, spare: null,
    rack: [], rackBase: 2,
    grenades: 3,
    abilities: ['shield', null],
    trinkets: [], // the only permanent things in a run
    chip: null,
    stash: { parts: [], weapons: [], abilities: [], mods: [], chips: [] },
  };
  for (const id of ['stock_engine', 'stock_tyres', 'scrap_plating', 'stock_nitro']) installPart(b, id);
  addWeapon(b, 'smg');
  addWeapon(b, 'rocket');
  b.stash.mods.push('ext_mag'); // a taste of modding from the start
  return b;
}

const has = (b, trinket) => b.trinkets.includes(trinket);
const rackSlots = (b) => b.rackBase + (has(b, 'keys') ? 1 : 0);
const partMaxDur = (b, id) => Math.round(PARTS[id].dur * (has(b, 'freshener') ? 1.25 : 1));
const newPart = (b, id) => ({ id, dur: partMaxDur(b, id), tune: 0 });

function installPart(b, id) {
  b.parts[PARTS[id].slot] = newPart(b, id);
}

const newWeapon = (id) => ({ id, mag: WEAPONS[id].mag, reserve: Math.max(0, WEAPONS[id].start - WEAPONS[id].mag), mods: [null, null] });

function addWeapon(b, id, replaceIndex) {
  if (replaceIndex != null) b.rack[replaceIndex] = newWeapon(id);
  else b.rack.push(newWeapon(id));
}

const partBroken = (b, slot) => b.parts[slot].dur <= 0;

// A weapon's stats with its mods applied.
function weaponStats(w) {
  const d = Object.assign({}, WEAPONS[w.id]);
  const m = new Set(w.mods.filter(Boolean));
  if (m.has('ext_mag')) { d.mag = Math.ceil(d.mag * 1.5); d.reload *= 1.25; }
  if (m.has('quick_mag')) { d.mag = Math.max(1, Math.floor(d.mag * 0.75)); d.reload *= 0.6; }
  if (m.has('incendiary')) { d.burn = 3; d.packPrice = Math.round(d.packPrice * 1.5); }
  if (m.has('ap_rounds')) { d.dmg *= 1.35; d.rate *= 1.15; }
  if (m.has('laser')) { d.spread *= 0.4; d.laser = true; }
  if (m.has('choke')) { d.spread *= 0.5; d.life *= 1.5; }
  if (m.has('hair_trigger')) { d.rate *= 0.77; d.spread *= 1.4; }
  if (m.has('sawn_off')) { d.pellets += 3; d.spread *= 1.6; d.reload *= 0.7; d.life *= 0.6; }
  if (m.has('slugs')) { d.pellets = 1; d.dmg *= 4.5; d.spread = 0.012; d.life *= 2.2; d.knock = (d.knock || 0) * 1.5; }
  if (m.has('suppressor')) { d.dmg *= 0.85; d.quiet = true; }
  if (m.has('tracer')) d.tracer = true;
  if (m.has('bunker_buster')) { d.radius *= 1.6; d.dmg *= 1.2; d.speed *= 0.75; }
  if (m.has('twin_tube')) { d.mag *= 2; d.twin = true; }
  if (m.has('remote_det')) d.remote = true;
  if (m.has('long_burn')) d.blind *= 1.7;
  if (m.has('phosphor')) d.burn = 4;
  if (m.has('homing')) d.homing = true;
  if (m.has('cluster')) d.cluster = true;
  return d;
}

// Keep the loaded magazine within capacity after mods change.
function fitMag(w) {
  const cap = weaponStats(w).mag;
  if (w.mag > cap) { w.reserve += w.mag - cap; w.mag = cap; }
}

// How fast each fitted part wears, from its tuning.
function wearMul(b, slot) {
  const t = b.parts[slot].tune || 0, m = PARTS[b.parts[slot].id].mods;
  return ({ engine: 1 + 0.6 * t, tyres: 1 + 0.7 * t, armour: 1, nitro: 1 }[slot]) * (m.wear || 1);
}

// Car stats from the base car + installed parts and their tuning (broken parts cripple their stat).
function buildStats(b) {
  const s = computeStats(newRun('comet', 1));
  s.maxHp = b.maxHull;
  s.absorb = 0; s.blastAbsorb = 0; s.bulletAbsorb = 0; s.armourWear = 1; s.ram = 1; s.iceGrip = 1;
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
    if (m.bulletAbsorb) s.bulletAbsorb = m.bulletAbsorb;
    if (m.armourWear) s.armourWear = m.armourWear;
    if (m.ram) s.ram *= m.ram;
    if (m.nitroCap) s.nitroCap *= m.nitroCap;
    if (m.nitroPower) s.nitroPower *= m.nitroPower;
    if (m.nitroRegen) s.nitroRegen *= m.nitroRegen;
    const t = part.tune || 0;
    if (slot === 'engine') { s.top *= 1 + 0.05 * t; s.accel *= 1 + 0.08 * t; }
    if (slot === 'tyres') s.grip *= 1 + 0.12 * t;
    if (slot === 'armour') { s.absorb *= 1 + 0.4 * t; s.blastAbsorb *= 1 + 0.4 * t; s.top *= 1 - 0.03 * t; s.accel *= 1 - 0.04 * t; }
    if (slot === 'nitro') { s.nitroPower *= 1 + 0.3 * t; s.nitroCap *= 1 - 0.25 * t; }
  }
  s.absorb = Math.min(0.75, s.absorb);
  if (b.chip === 'ghost') s.nitroPower *= 0.7;
  if (partBroken(b, 'engine')) { s.top *= 0.55; s.accel *= 0.5; }
  if (partBroken(b, 'tyres')) {
    const runFlat = PARTS[b.parts.tyres.id].mods.runFlat;
    s.grip *= runFlat ? 0.85 : 0.5;
    s.handling *= runFlat ? 0.95 : 0.8;
  }
  if (partBroken(b, 'nitro')) { s.nitroCap = 0.001; s.nitroRegen = 0; }
  if (b.chip === 'daredevil') s.offroadMul *= 0.5;
  if (has(b, 'sparkplug')) s.nitroRegen *= 1.35;
  return s;
}

// ---------- Garage loadout (everything except trinkets can be swapped here) ----------

function equipPart(b, stashIndex) {
  if (!(stashIndex >= 0 && stashIndex < b.stash.parts.length)) return;
  const inst = b.stash.parts[stashIndex], slot = PARTS[inst.id].slot;
  b.stash.parts[stashIndex] = b.parts[slot];
  b.parts[slot] = inst;
}

function equipWeapon(b, stashIndex, rackIndex) {
  if (!(stashIndex >= 0 && stashIndex < b.stash.weapons.length)) return;
  const w = b.stash.weapons[stashIndex];
  if (rackIndex == null || rackIndex >= b.rack.length) {
    if (b.rack.length >= rackSlots(b)) return;
    b.stash.weapons.splice(stashIndex, 1);
    b.rack.push(w);
  } else {
    b.stash.weapons[stashIndex] = b.rack[rackIndex];
    b.rack[rackIndex] = w;
  }
}

function unequipWeapon(b, rackIndex) {
  if (b.rack.length <= 1) return;
  b.stash.weapons.push(b.rack.splice(rackIndex, 1)[0]);
}

function equipAbility(b, stashIndex, slot) {
  if (!(stashIndex >= 0 && stashIndex < b.stash.abilities.length)) return;
  const id = b.stash.abilities[stashIndex];
  const old = b.abilities[slot];
  b.stash.abilities.splice(stashIndex, 1);
  if (old) b.stash.abilities.push(old);
  b.abilities[slot] = id;
}

function equipChip(b, stashIndex) {
  if (!(stashIndex >= 0 && stashIndex < b.stash.chips.length)) return;
  const id = b.stash.chips[stashIndex];
  b.stash.chips.splice(stashIndex, 1);
  if (b.chip) b.stash.chips.push(b.chip);
  b.chip = id;
}

function fitMod(b, stashIndex, rackIndex, slot) {
  if (!(stashIndex >= 0 && stashIndex < b.stash.mods.length)) return;
  const w = b.rack[rackIndex], id = b.stash.mods[stashIndex];
  if (!modFits(id, w.id) || w.mods.includes(id)) return;
  b.stash.mods.splice(stashIndex, 1);
  if (w.mods[slot]) b.stash.mods.push(w.mods[slot]);
  w.mods[slot] = id;
  fitMag(w);
}

function removeMod(b, rackIndex, slot) {
  const w = b.rack[rackIndex];
  if (!w.mods[slot]) return;
  b.stash.mods.push(w.mods[slot]);
  w.mods[slot] = null;
  fitMag(w);
}

// ---------- Rewards & shop ----------

function itemCard(type, id) {
  const src = { part: PARTS, weapon: WEAPONS, ability: ABILITIES, trinket: TRINKETS, chip: CHIPS, mod: MODS }[type][id];
  const rarity = src.rarity || { trinket: 'epic', chip: 'epic', part: 'common', weapon: 'rare', ability: 'rare' }[type];
  return { type, id, name: src.name, desc: src.desc, price: src.price || 0, rarity };
}

const ownsPart = (b, id) => b.parts[PARTS[id].slot].id === id || b.stash.parts.some((p) => p.id === id);
const ownsWeapon = (b, id) => b.rack.some((w) => w.id === id) || b.stash.weapons.some((w) => w.id === id);
const ownsAbility = (b, id) => b.abilities.includes(id) || b.stash.abilities.includes(id);
const ownsChip = (b, id) => b.chip === id || b.stash.chips.includes(id);

function rollRewards(b, rng, count) {
  if (has(b, 'eightball')) count += 1; // one more card to choose from
  const pool = [];
  for (const id in PARTS) if (PARTS[id].price > 0 && !ownsPart(b, id)) pool.push(['part', id, 3]);
  for (const id in WEAPONS) if (!ownsWeapon(b, id)) pool.push(['weapon', id, 3]);
  for (const id in ABILITIES) if (!ownsAbility(b, id)) pool.push(['ability', id, 2]);
  for (const id in MODS) pool.push(['mod', id, { common: 2, rare: 1.2, epic: 0.6 }[MODS[id].rarity]]);
  for (const id in TRINKETS) if (!has(b, id)) pool.push(['trinket', id, 2]);
  for (const id in CHIPS) if (!ownsChip(b, id) && !['veteran', 'ghost', 'showboat'].includes(id)) pool.push(['chip', id, 1]);
  const out = [];
  while (out.length < count && pool.length) {
    const pickd = weightedPick(rng, pool, (p) => p[2]);
    pool.splice(pool.indexOf(pickd), 1);
    out.push(itemCard(pickd[0], pickd[1]));
  }
  return out;
}

// Elite races guarantee a trinket among the cards (while there are trinkets left to find).
function rollEliteRewards(b, rng) {
  const out = rollRewards(b, rng, 3).filter((c) => c.type !== 'trinket').slice(0, 2);
  const left = Object.keys(TRINKETS).filter((id) => !has(b, id));
  if (left.length) out.push(itemCard('trinket', left[Math.floor(rng() * left.length)]));
  while (out.length < 3) { const extra = rollRewards(b, rng, 1)[0]; if (!extra || out.some((c) => c.id === extra.id)) break; out.push(extra); }
  return shuffle(rng, out);
}

// Beating a boss: choose a driver trait (the boss-only chips first), padded with epic mods.
function rollBossRewards(b, rng) {
  const traits = shuffle(rng, ['veteran', 'ghost', 'showboat'].filter((id) => !ownsChip(b, id)));
  const others = shuffle(rng, Object.keys(CHIPS).filter((id) => !ownsChip(b, id) && !traits.includes(id)));
  const out = [...traits, ...others].slice(0, 3).map((id) => itemCard('chip', id));
  const epics = shuffle(rng, Object.keys(MODS).filter((id) => MODS[id].rarity === 'epic'));
  while (out.length < 3 && epics.length) out.push(itemCard('mod', epics.pop()));
  return out;
}

function rollShop(b, rng) {
  const pickN = (ids, n) => shuffle(rng, ids).slice(0, n);
  const parts = pickN(Object.keys(PARTS).filter((id) => PARTS[id].price > 0 && !ownsPart(b, id)), 2);
  const weapons = pickN(Object.keys(WEAPONS).filter((id) => WEAPONS[id].price > 0 && !ownsWeapon(b, id)), 1);
  const abil = pickN(Object.keys(ABILITIES).filter((id) => ABILITIES[id].price > 0 && !ownsAbility(b, id)), 1);
  const mods = pickN(Object.keys(MODS), 3);
  const out = [
    ...parts.map((id) => itemCard('part', id)), ...weapons.map((id) => itemCard('weapon', id)),
    ...abil.map((id) => itemCard('ability', id)), ...mods.map((id) => itemCard('mod', id)),
  ];
  // Now and then a trinket under the counter, at a price.
  const left = Object.keys(TRINKETS).filter((id) => !has(b, id));
  if (left.length && rng() < 0.35) out.push(Object.assign(itemCard('trinket', left[Math.floor(rng() * left.length)]), { price: 260 }));
  if (has(b, 'smokes')) for (const c of out) c.price = Math.round(c.price * 0.85);
  return out;
}

const repairMul = (b) => (has(b, 'photo') ? 0.7 : 1);
const repairHullCost = (b) => Math.ceil((b.maxHull - b.hull) * 1.2 * repairMul(b));
const repairPartCost = (b, slot) => Math.ceil(((partMaxDur(b, b.parts[slot].id) - Math.max(0, b.parts[slot].dur)) * 0.8 + (partBroken(b, slot) ? 30 : 0)) * repairMul(b));
const spareCost = (b, slot) => Math.max(60, Math.round(PARTS[b.parts[slot].id].price * 0.6));

// New items go into the stash, or straight into a free slot. Only trinkets are permanent.
function applyItem(b, card) {
  if (card.type === 'part') {
    b.stash.parts.push(b.parts[PARTS[card.id].slot]); // fit the new part; the old one goes to the stash
    installPart(b, card.id);
  } else if (card.type === 'weapon') {
    const owned = b.rack.concat(b.stash.weapons).find((w) => w.id === card.id);
    if (owned) owned.reserve += WEAPONS[card.id].pack * 2; // a duplicate becomes ammo
    else if (b.rack.length < rackSlots(b)) addWeapon(b, card.id);
    else b.stash.weapons.push(newWeapon(card.id));
  } else if (card.type === 'ability') {
    const free = b.abilities.indexOf(null);
    if (free >= 0) b.abilities[free] = card.id;
    else b.stash.abilities.push(card.id);
  } else if (card.type === 'mod') {
    b.stash.mods.push(card.id);
  } else if (card.type === 'trinket') {
    b.trinkets.push(card.id);
    if (card.id === 'freshener') for (const inst of [...Object.values(b.parts), ...b.stash.parts]) inst.dur = Math.round(inst.dur * 1.25);
    if (card.id === 'dogtags') { b.maxHull += 20; b.hull += 20; }
  } else if (card.type === 'chip') {
    if (!b.chip) b.chip = card.id;
    else b.stash.chips.push(card.id);
  }
  return true;
}
