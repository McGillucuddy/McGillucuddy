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
//  ENEMIES
// ------------------------------------------------------------
const ENEMIES = {
  cultist:   { name: 'Cultist', hp: 38, speed: 1.0, armor: 0, gold: 4, threat: 1, size: 9, leak: 1,
               desc: 'Chanting fanatics of the Esoteric Order. Weak, numerous, devoted.' },
  ghoul:     { name: 'Ghoul', hp: 30, speed: 1.9, armor: 0, gold: 5, threat: 1.2, size: 8, leak: 1,
               desc: 'Rubbery graveyard scavengers. Fast and hungry.' },
  deepone:   { name: 'Deep One', hp: 105, speed: 0.8, armor: 3, gold: 8, threat: 2.2, size: 11, leak: 2,
               desc: 'Immortal fish-men of Y\'ha-nthlei. Scaled hide shrugs off light weapons.' },
  nightgaunt:{ name: 'Nightgaunt', hp: 55, speed: 1.5, armor: 0, gold: 7, threat: 2, size: 10, leak: 1, flying: true,
               desc: 'Faceless winged things. FLYING: ignores the road and flies straight for the city.' },
  migo:      { name: 'Mi-Go', hp: 85, speed: 1.15, armor: 8, gold: 10, threat: 3, size: 10, leak: 2,
               desc: 'Fungi from Yuggoth in crustacean shells. HEAVY ARMOR: use arcane bolts or big guns.' },
  byakhee:   { name: 'Byakhee', hp: 75, speed: 2.1, armor: 1, gold: 10, threat: 3, size: 11, leak: 2, flying: true,
               desc: 'Interstellar steeds of Hastur. FLYING and very fast.' },
  shambler:  { name: 'Dimensional Shambler', hp: 150, speed: 1.0, armor: 2, gold: 12, threat: 4, size: 11, leak: 2, phase: true,
               desc: 'Steps between planes. PHASES: untargetable unless revealed by a Ward or Scholar.' },
  hound:     { name: 'Hound of Tindalos', hp: 120, speed: 1.2, armor: 2, gold: 12, threat: 4, size: 11, leak: 2, blink: true,
               desc: 'Emerges from angles of time. BLINKS forward along the road.' },
  shoggoth:  { name: 'Shoggoth', hp: 650, speed: 0.5, armor: 4, gold: 30, threat: 14, size: 17, leak: 4, split: { type: 'proto', n: 3 },
               desc: 'Protoplasmic slave-beast. SPLITS into smaller masses when destroyed. Tekeli-li!' },
  proto:     { name: 'Proto-Shoggoth', hp: 110, speed: 0.9, armor: 1, gold: 3, threat: 0, size: 9, leak: 1,
               desc: 'A fragment of a Shoggoth, still crawling.' },
  starspawn: { name: 'Star-Spawn', hp: 2400, speed: 0.42, armor: 6, gold: 100, threat: 35, size: 20, leak: 8, aura: 2.2,
               desc: 'Kin of Cthulhu. MADNESS AURA: nearby towers fire at half speed.' },
  // ---- bosses ----
  dagon:     { name: 'Father Dagon', hp: 3200, speed: 0.36, armor: 4, gold: 300, size: 24, leak: 15, boss: true, regen: 25,
               desc: 'Ancient lord of the Deep Ones. REGENERATES constantly.' },
  haunter:   { name: 'The Haunter of the Dark', hp: 4200, speed: 0.5, armor: 3, gold: 350, size: 22, leak: 15, boss: true, flying: true,
               summon: { type: 'nightgaunt', every: 4.5 },
               desc: 'An avatar that fears only light. FLYING, SUMMONS nightgaunts.' },
  dunwich:   { name: 'The Dunwich Horror', hp: 8500, speed: 0.4, armor: 5, gold: 400, size: 24, leak: 15, boss: true, phase: true,
               desc: 'Wilbur Whateley\'s invisible twin. PHASES out of sight. Bring Wards.' },
  nyarlathotep:{ name: 'Nyarlathotep', hp: 13000, speed: 0.5, armor: 5, gold: 500, size: 22, leak: 15, boss: true, blink: true,
               summon: { type: 'ghoul', every: 2.5 }, aura: 2.0,
               desc: 'The Crawling Chaos in the guise of a Black Pharaoh. BLINKS, SUMMONS, MADDENS.' },
  cthulhu:   { name: 'Great Cthulhu', hp: 32000, speed: 0.26, armor: 7, gold: 0, size: 32, leak: 99, boss: true, regen: 40,
               summon: { type: 'deepone', every: 3.5 }, aura: 3.0,
               desc: 'Ph\'nglui mglw\'nafh Cthulhu R\'lyeh wgah\'nagl fhtagn. He is awake.' },
};
const ENEMY_ORDER = ['cultist', 'ghoul', 'deepone', 'nightgaunt', 'migo', 'byakhee', 'shambler', 'hound', 'shoggoth',
  'proto', 'starspawn', 'dagon', 'haunter', 'dunwich', 'nyarlathotep', 'cthulhu'];

// ------------------------------------------------------------
//  MAPS  — paths are lists of [col,row] waypoints (axis-aligned).
//  Off-grid coords (-1 / 24 / 15) are entry/exit points.
// ------------------------------------------------------------
const MAPS = [
  {
    id: 'innsmouth', name: 'Innsmouth Harbor', sub: 'The tide brings the Deep Ones',
    desc: 'Fog rolls off Devil Reef. The Esoteric Order of Dagon marches up from the docks.',
    waves: 12, hpScale: 1.0, seed: 11, startGold: 0,
    theme: { ground: '#1f2a26', ground2: '#26332d', path: '#3b3a33', edge: '#2a2924', deco: 'dock', water: '#0e2a33', rain: true },
    paths: [[[-1, 2], [5, 2], [5, 9], [11, 9], [11, 4], [17, 4], [17, 8], [24, 8]]],
    water: [[0, 12, 24, 3], [20, 0, 4, 3]],
    pool: [{ t: 'cultist', from: 1, w: 3 }, { t: 'ghoul', from: 2, w: 2 }, { t: 'deepone', from: 3, w: 3 }, { t: 'nightgaunt', from: 6, w: 1.5 }],
    mid: { every: 6, type: 'shoggoth' }, boss: 'dagon',
  },
  {
    id: 'miskatonic', name: 'Miskatonic University', sub: 'The library must not fall',
    desc: 'Things have crawled out of the restricted stacks. Defend the quad.',
    waves: 15, hpScale: 1.0, seed: 23, startGold: 20,
    theme: { ground: '#232722', ground2: '#2b3029', path: '#45403a', edge: '#2f2b26', deco: 'campus', water: '#13262e' },
    paths: [[[-1, 7], [3, 7], [3, 2], [9, 2], [9, 12], [15, 12], [15, 2], [20, 2], [20, 7], [24, 7]]],
    water: [[11, 5, 2, 4]],
    pool: [{ t: 'cultist', from: 1, w: 2 }, { t: 'ghoul', from: 1, w: 2 }, { t: 'deepone', from: 3, w: 2 },
           { t: 'nightgaunt', from: 4, w: 1.5 }, { t: 'migo', from: 6, w: 2.5 }],
    mid: { every: 5, type: 'shoggoth' }, boss: 'haunter',
  },
  {
    id: 'dunwich', name: 'Dunwich Hills', sub: 'Whippoorwills sing for the dying',
    desc: 'Two roads wind past the standing stones of Sentinel Hill. Something unseen walks them.',
    waves: 18, hpScale: 1.18, seed: 37, startGold: 60,
    theme: { ground: '#232a1d', ground2: '#2c3424', path: '#4a4232', edge: '#302a20', deco: 'hills', water: '#16282a' },
    paths: [
      [[-1, 3], [8, 3], [8, 7], [14, 7], [14, 2], [19, 2], [19, 11], [24, 11]],
      [[-1, 12], [8, 12], [8, 7], [14, 7], [14, 2], [19, 2], [19, 11], [24, 11]],
    ],
    water: [[21, 0, 3, 3]],
    pool: [{ t: 'cultist', from: 1, w: 2 }, { t: 'ghoul', from: 1, w: 2 }, { t: 'deepone', from: 2, w: 2 },
           { t: 'nightgaunt', from: 3, w: 1.5 }, { t: 'migo', from: 4, w: 2 }, { t: 'shambler', from: 6, w: 3 }],
    mid: { every: 6, type: 'shoggoth' }, boss: 'dunwich',
  },
  {
    id: 'arkham', name: 'Arkham Crossroads', sub: 'The witch-haunted town',
    desc: 'Horrors pour in from the north woods and the south marsh. The town square is all that remains.',
    waves: 20, hpScale: 1.12, seed: 41, startGold: 100,
    theme: { ground: '#24212a', ground2: '#2c2833', path: '#4a4448', edge: '#302c30', deco: 'city', water: '#161f2c' },
    paths: [
      [[4, -1], [4, 5], [10, 5], [10, 1], [16, 1], [16, 7], [24, 7]],
      [[4, 15], [4, 10], [12, 10], [12, 13], [19, 13], [19, 7], [24, 7]],
    ],
    water: [[0, 12, 3, 3], [21, 11, 3, 4]],
    pool: [{ t: 'cultist', from: 1, w: 1.5 }, { t: 'ghoul', from: 1, w: 2 }, { t: 'deepone', from: 2, w: 2 },
           { t: 'nightgaunt', from: 4, w: 1.5 }, { t: 'migo', from: 5, w: 2 }, { t: 'byakhee', from: 8, w: 2 },
           { t: 'shambler', from: 7, w: 2 }, { t: 'hound', from: 9, w: 3 }],
    mid: { every: 5, type: 'shoggoth', late: 'starspawn', lateFrom: 15 }, boss: 'nyarlathotep',
  },
  {
    id: 'rlyeh', name: 'R\'lyeh Ascendant', sub: 'The stars are right',
    desc: 'The drowned city has risen. Non-Euclidean causeways converge on the last lighthouse of mankind.',
    waves: 25, hpScale: 1.15, seed: 59, startGold: 150,
    theme: { ground: '#1b2624', ground2: '#22302c', path: '#3a4a40', edge: '#26322b', deco: 'ruins', water: '#0b2026', rain: true },
    paths: [
      [[-1, 7], [6, 7], [6, 3], [12, 3], [12, 7], [17, 7], [17, 11], [21, 11], [21, 7], [24, 7]],
      [[12, -1], [12, 3], [12, 7], [17, 7], [17, 11], [21, 11], [21, 7], [24, 7]],
      [[12, 15], [12, 11], [17, 11], [21, 11], [21, 7], [24, 7]],
    ],
    water: [[0, 0, 4, 4], [0, 11, 5, 4], [22, 0, 2, 4], [14, 13, 4, 2], [7, 9, 3, 3]],
    pool: [{ t: 'cultist', from: 1, w: 1.5 }, { t: 'ghoul', from: 1, w: 1.5 }, { t: 'deepone', from: 2, w: 2.5 },
           { t: 'nightgaunt', from: 4, w: 1.5 }, { t: 'migo', from: 5, w: 2 }, { t: 'byakhee', from: 9, w: 1.5 },
           { t: 'shambler', from: 7, w: 2 }, { t: 'hound', from: 8, w: 2 }],
    mid: { every: 5, type: 'shoggoth', late: 'starspawn', lateFrom: 15 }, boss: 'cthulhu',
  },
];

// ------------------------------------------------------------
//  RESEARCH (meta-progression, bought with Elder Signs ★)
// ------------------------------------------------------------
const RESEARCH = [
  { id: 'gold', name: 'Hoarded Gold', desc: '+40 starting gold per rank.', cost: [1, 2, 3] },
  { id: 'sanity', name: 'Fortified Minds', desc: '+5 maximum city sanity per rank.', cost: [1, 1, 2] },
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
