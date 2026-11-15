// ============================================================
//  ELDRITCH BASTION — static game data
// ============================================================
'use strict';

const TILE = 40, COLS = 24, ROWS = 15, W = COLS * TILE, H = ROWS * TILE;

// ------------------------------------------------------------
//  TOWERS
//  Each level entry overrides/extends the previous one.
// ------------------------------------------------------------
const TOWERS = {
  rifle: {
    name: 'Militia Marksman', cost: 70, kind: 'bullet', air: true, ground: true, color: '#b08a4a',
    desc: 'Townsfolk with rifles and nerves of iron. Cheap, reliable, hits flyers.',
    levels: [
      { title: 'Militia Marksman', dmg: 12, rate: 1.5, range: 3.0 },
      { title: 'Veteran Sharpshooter', cost: 60, dmg: 20, rate: 1.7, range: 3.3 },
      { title: 'Elephant Gun', cost: 120, dmg: 36, rate: 1.9, range: 3.6 },
      { title: 'Silver-Bullet Hunter', cost: 240, dmg: 62, rate: 2.3, range: 4.0, crit: 0.2 },
    ],
  },
  mortar: {
    name: 'Dynamite Mortar', cost: 110, kind: 'mortar', air: false, ground: true, color: '#8a5a3a',
    desc: 'Lobs bundles of mining dynamite. Splash damage, cannot hit flyers.',
    levels: [
      { title: 'Dynamite Mortar', dmg: 28, rate: 0.45, range: 4.2, splash: 1.0 },
      { title: 'Quarry Charges', cost: 90, dmg: 46, splash: 1.15 },
      { title: 'Nitro Barrage', cost: 170, dmg: 78, splash: 1.3, range: 4.6 },
      { title: 'Purifying Inferno', cost: 320, dmg: 135, splash: 1.5, rate: 0.55 },
    ],
  },
  ward: {
    name: 'Elder Sign Ward', cost: 90, kind: 'aura', air: true, ground: true, color: '#4a8a6a', reveal: true,
    desc: 'A carved star-stone the Old Ones abhor. Slows everything nearby and reveals phased horrors.',
    levels: [
      { title: 'Elder Sign Ward', slow: 0.3, range: 2.2, pulse: 0 },
      { title: 'Graven Pentacle', cost: 80, slow: 0.4, range: 2.5 },
      { title: 'Star-Stone of Mnar', cost: 150, slow: 0.48, range: 2.8, pulse: 10 },
      { title: 'Seal of the Elder Gods', cost: 280, slow: 0.56, range: 3.1, pulse: 28 },
    ],
  },
  tesla: {
    name: 'Tesla Coil', cost: 140, kind: 'chain', air: true, ground: true, color: '#4a6a9a',
    unlock: { map: 0, text: 'Clear Innsmouth Harbor' },
    desc: 'Miskatonic physics department\'s finest. Lightning arcs between several targets.',
    levels: [
      { title: 'Tesla Coil', dmg: 16, rate: 0.9, range: 2.8, chains: 3 },
      { title: 'Galvanic Array', cost: 110, dmg: 25, chains: 4 },
      { title: 'Aetheric Dynamo', cost: 200, dmg: 38, chains: 5, range: 3.1 },
      { title: 'Storm of Ithaqua', cost: 360, dmg: 58, chains: 7, stun: 0.15, rate: 1.0 },
    ],
  },
  scholar: {
    name: 'Occult Scholar', cost: 160, kind: 'arcane', air: true, ground: true, color: '#7a4a9a', reveal: true,
    unlock: { map: 1, text: 'Clear Miskatonic University' },
    desc: 'Reads forbidden words aloud. Arcane bolts ignore armor. Reveals phased horrors.',
    levels: [
      { title: 'Occult Scholar', dmg: 40, rate: 0.7, range: 3.6 },
      { title: 'Professor of Antiquities', cost: 130, dmg: 66 },
      { title: 'Reader of the Necronomicon', cost: 240, dmg: 108, range: 4.0 },
      { title: 'Voice of the Silver Key', cost: 420, dmg: 175, rate: 0.9, range: 4.4 },
    ],
  },
  lighthouse: {
    name: 'Lighthouse Beam', cost: 220, kind: 'beam', air: true, ground: true, color: '#c9c06a',
    unlock: { map: 2, text: 'Clear Dunwich Hills' },
    desc: 'A blinding lens. Sustained burning beam that intensifies the longer it holds a target.',
    levels: [
      { title: 'Lighthouse Beam', dps: 38, range: 3.8, ramp: 2.5 },
      { title: 'Fresnel Lantern', cost: 180, dps: 62 },
      { title: 'Searing Lamp', cost: 320, dps: 100, range: 4.2 },
      { title: 'Light Beyond the Stars', cost: 520, dps: 165, ramp: 3.5 },
    ],
  },
  shop: {
    name: 'Curio Shop', cost: 150, kind: 'income', air: false, ground: false, color: '#c9a03a',
    unlock: { research: 'antiquarian', text: 'Research: Antiquarian Network' },
    desc: 'Sells cursed trinkets to the desperate. Earns gold at the start of every wave.',
    levels: [
      { title: 'Curio Shop', income: 30, range: 0 },
      { title: 'Antiquarian Emporium', cost: 120, income: 55 },
      { title: 'Black-Market Auction', cost: 190, income: 90 },
      { title: 'Treasury of Lost Atlantis', cost: 280, income: 140 },
    ],
  },
};
const TOWER_ORDER = ['rifle', 'mortar', 'ward', 'tesla', 'scholar', 'lighthouse', 'shop'];

// ------------------------------------------------------------
//  ENEMIES  — `siege` is sanity drained per second while clawing at the walls
// ------------------------------------------------------------
const ENEMIES = {
  cultist:   { name: 'Cultist', hp: 38, speed: 0.75, armor: 0, gold: 4, threat: 1, size: 10, siege: 0.5,
               desc: 'Hollow-eyed townsfolk who heard the call. They do not scream. They chant.' },
  ghoul:     { name: 'Ghoul', hp: 30, speed: 1.35, armor: 0, gold: 5, threat: 1.2, size: 9, siege: 0.5,
               desc: 'Things that crawl up from beneath old graveyards, hungry for what lies inside the walls.' },
  deepone:   { name: 'Deep One', hp: 105, speed: 0.6, armor: 3, gold: 8, threat: 2.2, size: 12, siege: 1,
               desc: 'Immortal fish-men of Y\'ha-nthlei. Some of them still wear the faces of your neighbours.' },
  nightgaunt:{ name: 'Nightgaunt', hp: 55, speed: 1.1, armor: 0, gold: 7, threat: 2, size: 11, siege: 0.6, flying: true,
               desc: 'Faceless, silent, rubbery. FLYING: passes over everything, straight for the city.' },
  migo:      { name: 'Mi-Go', hp: 85, speed: 0.85, armor: 8, gold: 10, threat: 3, size: 11, siege: 1.2,
               desc: 'Fungi from Yuggoth. They carry brains away in metal cylinders. HEAVY ARMOR.' },
  byakhee:   { name: 'Byakhee', hp: 75, speed: 1.55, armor: 1, gold: 10, threat: 3, size: 12, siege: 1, flying: true,
               desc: 'Rotting interstellar steeds of Hastur. FLYING and very fast.' },
  shambler:  { name: 'Dimensional Shambler', hp: 150, speed: 0.75, armor: 2, gold: 12, threat: 4, size: 12, siege: 1.4, phase: true,
               desc: 'It steps out of nowhere and back again. PHASES: unseen unless revealed by a Ward or Scholar.' },
  hound:     { name: 'Hound of Tindalos', hp: 120, speed: 0.9, armor: 2, gold: 12, threat: 4, size: 12, siege: 1.4, blink: true,
               desc: 'It has your scent from the angles of time. BLINKS forward without warning.' },
  shoggoth:  { name: 'Shoggoth', hp: 650, speed: 0.38, armor: 4, gold: 30, threat: 14, size: 19, siege: 3, split: { type: 'proto', n: 3 },
               desc: 'A heaving mass of eyes and mouths that form and dissolve. SPLITS when destroyed. Tekeli-li.' },
  proto:     { name: 'Proto-Shoggoth', hp: 110, speed: 0.7, armor: 1, gold: 3, threat: 0, size: 10, siege: 0.8,
               desc: 'A torn-off fragment. It still has eyes. It still wants in.' },
  starspawn: { name: 'Star-Spawn', hp: 1800, speed: 0.32, armor: 6, gold: 100, threat: 35, size: 22, siege: 5, aura: 2.2,
               desc: 'Kin of Cthulhu. MADNESS AURA: towers near it fire at half speed.' },
  // ---- bosses ----
  dagon:     { name: 'Father Dagon', hp: 3200, speed: 0.28, armor: 4, gold: 300, size: 27, siege: 10, boss: true, regen: 25,
               desc: 'Ancient lord of the Deep Ones, crowned in coral and bone. REGENERATES.' },
  haunter:   { name: 'The Haunter of the Dark', hp: 4200, speed: 0.38, armor: 3, gold: 350, size: 24, siege: 10, boss: true, flying: true,
               summon: { type: 'nightgaunt', every: 4.5 },
               desc: 'It cannot abide the light, yet it comes. FLYING, SUMMONS nightgaunts.' },
  dunwich:   { name: 'The Dunwich Horror', hp: 8500, speed: 0.3, armor: 5, gold: 400, size: 27, siege: 12, boss: true, phase: true,
               desc: 'Wilbur Whateley\'s twin. It has his face, somewhere near the top. PHASES out of sight.' },
  nyarlathotep:{ name: 'Nyarlathotep', hp: 11000, speed: 0.38, armor: 5, gold: 500, size: 25, siege: 14, boss: true, blink: true,
               summon: { type: 'ghoul', every: 2.5 }, aura: 2.0,
               desc: 'The Crawling Chaos, wearing the shape of a faceless Black Pharaoh. BLINKS, SUMMONS, MADDENS.' },
  cthulhu:   { name: 'Great Cthulhu', hp: 20000, speed: 0.2, armor: 7, gold: 0, size: 36, siege: 40, boss: true, regen: 40,
               summon: { type: 'deepone', every: 3.5 }, aura: 3.0,
               desc: 'Ph\'nglui mglw\'nafh Cthulhu R\'lyeh wgah\'nagl fhtagn. If he reaches the walls, it is over.' },
};
const ENEMY_ORDER = ['cultist', 'ghoul', 'deepone', 'nightgaunt', 'migo', 'byakhee', 'shambler', 'hound', 'shoggoth',
  'proto', 'starspawn', 'dagon', 'haunter', 'dunwich', 'nyarlathotep', 'cthulhu'];

// ------------------------------------------------------------
//  MAPS — open fields. `city` is [col,row,w,h]. Horrors emerge from
//  `spawns` (edge segments, tiles a..b) and cross the field toward the walls.
// ------------------------------------------------------------
const MAPS = [
  {
    id: 'innsmouth', name: 'Innsmouth Harbor', sub: 'Something walks up out of the sea fog',
    desc: 'The harbor town huddles against the water. From the western marsh, figures in robes are coming.',
    waves: 12, hpScale: 1.0, seed: 11, startGold: 0,
    theme: { ground: '#131915', ground2: '#19211b', mud: '#1e1c16', deco: 'dock', water: '#071519', rain: true },
    city: [19, 5, 3, 4],
    spawns: [{ side: 'left', a: 1, b: 11 }, { side: 'top', a: 1, b: 14, from: 7 }],
    water: [[0, 12, 24, 3], [22, 0, 2, 3]], rocks: 0.05,
    pool: [{ t: 'cultist', from: 1, w: 3 }, { t: 'ghoul', from: 2, w: 2 }, { t: 'deepone', from: 3, w: 3 }, { t: 'nightgaunt', from: 6, w: 1.5 }],
    mid: { every: 6, type: 'shoggoth' }, boss: 'dagon',
  },
  {
    id: 'miskatonic', name: 'Miskatonic University', sub: 'The library must not fall',
    desc: 'Something has read the restricted stacks aloud. The campus walls are all that stand between it and the town.',
    waves: 15, hpScale: 1.0, seed: 23, startGold: 20,
    theme: { ground: '#151814', ground2: '#1b1f1a', mud: '#211e19', deco: 'campus', water: '#0a1a20' },
    city: [17, 6, 3, 3],
    spawns: [{ side: 'left', a: 1, b: 13 }, { side: 'top', a: 2, b: 15, from: 4 }, { side: 'bottom', a: 2, b: 15, from: 8 }],
    water: [[9, 6, 2, 3]], rocks: 0.06,
    pool: [{ t: 'cultist', from: 1, w: 2 }, { t: 'ghoul', from: 1, w: 2 }, { t: 'deepone', from: 3, w: 2 },
           { t: 'nightgaunt', from: 4, w: 1.5 }, { t: 'migo', from: 6, w: 2.5 }],
    mid: { every: 5, type: 'shoggoth' }, boss: 'haunter',
  },
  {
    id: 'dunwich', name: 'Dunwich Hills', sub: 'The whippoorwills are singing',
    desc: 'A cluster of farmhouses beneath Sentinel Hill. The hills on both sides have begun to move.',
    waves: 18, hpScale: 1.05, seed: 37, startGold: 60,
    theme: { ground: '#15190f', ground2: '#1b2014', mud: '#221e15', deco: 'hills', water: '#0c1a1b' },
    city: [11, 6, 3, 3],
    spawns: [{ side: 'left', a: 1, b: 13 }, { side: 'right', a: 1, b: 13, from: 3 }, { side: 'top', a: 3, b: 20, from: 9 }],
    water: [[20, 0, 4, 3]], rocks: 0.07,
    pool: [{ t: 'cultist', from: 1, w: 2 }, { t: 'ghoul', from: 1, w: 2 }, { t: 'deepone', from: 2, w: 2 },
           { t: 'nightgaunt', from: 3, w: 1.5 }, { t: 'migo', from: 4, w: 2 }, { t: 'shambler', from: 6, w: 3 }],
    mid: { every: 6, type: 'shoggoth' }, boss: 'dunwich',
  },
  {
    id: 'arkham', name: 'Arkham', sub: 'The witch-haunted town',
    desc: 'The gambrel roofs of Arkham, surrounded on every side. The woods to the north went silent an hour ago.',
    waves: 20, hpScale: 1.0, seed: 41, startGold: 100,
    theme: { ground: '#16141a', ground2: '#1c1a21', mud: '#201c1f', deco: 'city', water: '#0d131d' },
    city: [10, 6, 3, 3],
    spawns: [{ side: 'top', a: 2, b: 21 }, { side: 'bottom', a: 2, b: 21 }, { side: 'left', a: 1, b: 13, from: 5 }, { side: 'right', a: 1, b: 13, from: 10 }],
    water: [[0, 12, 3, 3], [21, 11, 3, 4]], rocks: 0.06,
    pool: [{ t: 'cultist', from: 1, w: 1.5 }, { t: 'ghoul', from: 1, w: 2 }, { t: 'deepone', from: 2, w: 2 },
           { t: 'nightgaunt', from: 4, w: 1.5 }, { t: 'migo', from: 5, w: 2 }, { t: 'byakhee', from: 8, w: 2 },
           { t: 'shambler', from: 7, w: 2 }, { t: 'hound', from: 9, w: 3 }],
    mid: { every: 5, type: 'shoggoth' }, boss: 'nyarlathotep',
  },
  {
    id: 'rlyeh', name: 'R\'lyeh Ascendant', sub: 'The stars are right',
    desc: 'The drowned city has risen around the last lighthouse town. They are coming from every direction now.',
    waves: 25, hpScale: 1.0, seed: 59, startGold: 150,
    theme: { ground: '#111a18', ground2: '#16211e', mud: '#18201b', deco: 'ruins', water: '#06171b', rain: true },
    city: [11, 6, 3, 3],
    spawns: [{ side: 'left', a: 4, b: 10 }, { side: 'top', a: 5, b: 19 }, { side: 'bottom', a: 6, b: 14 }, { side: 'right', a: 3, b: 10, from: 4 }],
    water: [[0, 0, 4, 4], [0, 11, 5, 4], [20, 0, 4, 3], [16, 12, 4, 3], [6, 2, 2, 2], [17, 3, 2, 2], [6, 11, 2, 2]], rocks: 0.06,
    pool: [{ t: 'cultist', from: 1, w: 1.5 }, { t: 'ghoul', from: 1, w: 1.5 }, { t: 'deepone', from: 2, w: 2.5 },
           { t: 'nightgaunt', from: 4, w: 1.5 }, { t: 'migo', from: 5, w: 2 }, { t: 'byakhee', from: 9, w: 1.5 },
           { t: 'shambler', from: 7, w: 2 }, { t: 'hound', from: 8, w: 2 }],
    mid: { every: 5, type: 'shoggoth', late: 'starspawn', lateFrom: 20 }, boss: 'cthulhu',
  },
];
// ------------------------------------------------------------
//  RESEARCH (meta-progression, bought with Elder Signs ★)
// ------------------------------------------------------------
const RESEARCH = [
  { id: 'gold', name: 'Hoarded Gold', desc: '+40 starting gold per rank.', cost: [1, 2, 3] },
  { id: 'sanity', name: 'Fortified Minds', desc: '+10 maximum city sanity per rank.', cost: [1, 1, 2] },
  { id: 'ballistics', name: 'Ballistics Manual', desc: 'Marksmen & Mortars deal +10% damage per rank.', cost: [1, 2, 3] },
  { id: 'lore', name: 'Forbidden Lore', desc: 'Tesla, Scholar & Lighthouse deal +10% damage per rank.', cost: [1, 2, 3] },
  { id: 'wards', name: 'Deeper Carvings', desc: 'Wards slow +5% more and gain +10% range per rank.', cost: [1, 2] },
  { id: 'rituals', name: 'Swift Rituals', desc: 'Spell cooldowns -15% per rank.', cost: [1, 2] },
  { id: 'bounty', name: 'Bounty Hunters', desc: '+10% gold from slain horrors per rank.', cost: [1, 2, 2] },
  { id: 'salvage', name: 'Salvage Rights', desc: 'Selling refunds 85% instead of 70%.', cost: [1] },
  { id: 'antiquarian', name: 'Antiquarian Network', desc: 'Unlocks the Curio Shop tower.', cost: [2] },
  { id: 'powder', name: 'Powder of Ibn-Ghazi', desc: 'Unlocks the Powder spell: reveals all & halves armor.', cost: [2] },
];

// ------------------------------------------------------------
//  SPELLS
// ------------------------------------------------------------
const SPELLS = {
  elder:   { name: 'Elder Sign', key: 'Q', cd: 50, desc: 'Stuns every horror for 3s (bosses 1s).', target: false },
  cthugha: { name: 'Flame of Cthugha', key: 'W', cd: 32, desc: 'Call living fire on an area. Ignores armor.', target: true, radius: 1.6 },
  powder:  { name: 'Powder of Ibn-Ghazi', key: 'E', cd: 45, desc: 'Reveals all horrors and halves their armor for 10s.', target: false, research: 'powder' },
};
const SPELL_ORDER = ['elder', 'cthugha', 'powder'];
