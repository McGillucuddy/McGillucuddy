// ============================================================
//  ELDRITCH DESCENT — game data
// ============================================================
'use strict';

// ---------------- classes ----------------
const CLASSES = {
  warden: {
    name: 'Warden', role: 'Tank', roleColor: '#4a8ad0', size: 9,
    hp: 270, speed: 56, armor: 0.2, threat: 3.2,
    blurb: 'A dockside bruiser behind a church-door shield. Holds the horrors\' attention so the others can live.',
    basic: { name: 'Nailed Club', kind: 'melee', dmg: 15, cd: 0.7, range: 24, arc: 1.7, desc: 'Cleave every horror in front of you.' },
    abilities: [
      { id: 'taunt', name: 'Challenging Roar', cd: 8, desc: 'Every horror nearby must attack you for 4s.' },
      { id: 'wall', name: 'Shield Wall', cd: 16, desc: 'Take 60% less damage for 5s.' },
      { id: 'charge', name: 'Charge', cd: 9, desc: 'Rush toward the cursor, stunning horrors where you land.' },
    ],
  },
  occultist: {
    name: 'Occultist', role: 'Damage', roleColor: '#c8a0e8', size: 9,
    hp: 140, speed: 60, armor: 0, threat: 1,
    blurb: 'Reads aloud from books that should have burned. Devastating, fragile, and slowly going mad.',
    basic: { name: 'Eldritch Bolt', kind: 'bolt', dmg: 15, cd: 0.55, range: 170, speed: 190, color: '#c8a0e8', desc: 'A bolt of violet nothing.' },
    abilities: [
      { id: 'rift', name: 'Void Rift', cd: 9, desc: 'Tear open a rift that burns and slows horrors inside it.' },
      { id: 'blast', name: 'Mind Blast', cd: 6, desc: 'A cone of psychic force that hurls horrors back.' },
      { id: 'word', name: 'Unspeakable Word', cd: 24, desc: 'Speak a word that wounds and stuns everything near the cursor.' },
    ],
  },
  physician: {
    name: 'Physician', role: 'Healer', roleColor: '#6aa77f', size: 9,
    hp: 165, speed: 60, armor: 0.05, threat: 1,
    blurb: 'A plague doctor with a satchel of tinctures. Keeps the party breathing, and brings back the fallen.',
    basic: { name: 'Laudanum Dart', kind: 'bolt', dmg: 9, cd: 0.6, range: 160, speed: 200, color: '#a8d08a', desc: 'A weak, poisoned dart.' },
    abilities: [
      { id: 'mend', name: 'Mend', cd: 2.8, desc: 'Heal the ally nearest the cursor (or the most wounded).' },
      { id: 'sanct', name: 'Sanctuary', cd: 13, desc: 'Consecrate the ground: allies standing in it heal steadily.' },
      { id: 'salts', name: 'Smelling Salts', cd: 22, desc: 'Revive every fallen ally nearby, or heal the whole party.' },
    ],
  },
  hunter: {
    name: 'Hunter', role: 'Damage', roleColor: '#d0503a', size: 9,
    hp: 150, speed: 66, armor: 0.05, threat: 1,
    blurb: 'Has tracked things through the Pine Barrens no one else came back from. Long rifle, longer memory.',
    basic: { name: 'Rifle Shot', kind: 'bolt', dmg: 22, cd: 0.8, range: 230, speed: 330, color: '#f0d870', desc: 'A heavy, accurate round.' },
    abilities: [
      { id: 'volley', name: 'Volley', cd: 7, desc: 'Fan of five shots.' },
      { id: 'trap', name: 'Bear Trap', cd: 9, desc: 'Set a trap that clamps and roots the first horror to touch it.' },
      { id: 'silver', name: 'Silver Round', cd: 11, desc: 'A piercing shot that tears through every horror in a line.' },
    ],
  },
};
const CLASS_ORDER = ['warden', 'occultist', 'physician', 'hunter'];
const NAMES = {
  warden: ['Silas Cole', 'Abner Marsh', 'Sgt. Brannigan', 'Obed Hale', 'Joe Slater'],
  occultist: ['Asenath W.', 'Prof. Armitage', 'Keziah M.', 'Ward Phillips', 'Lavinia W.'],
  physician: ['Dr. Hartwell', 'Dr. Halsey', 'Dr. Muñoz', 'Dr. West', 'Dr. Willett'],
  hunter: ['Ruth Bishop', 'Zadok Allen', 'Eliot Dane', 'Ammi Pierce', 'Kate Danforth'],
};
const CHATTER = {
  start: { warden: ['On me! Stay behind the shield.', 'I\'ll hold them. Go!', 'Here they come.'], occultist: ['The words are already in my mouth.', 'I can hear them breathing.'], physician: ['Try not to bleed on my coat.', 'I\'ll keep you standing.'], hunter: ['Got a bead on them.', 'Eyes up. Something\'s moving.'] },
  taunt: { warden: ['Look at ME!', 'Over here, you filth!', 'Come and try me!'] },
  lowhp: { any: ['I\'m hurt bad!', 'Need a medic!', 'Can\'t take much more...'] },
  heal: { physician: ['Patching you up.', 'Hold still.', 'Breathe.'] },
  downed: { any: ['...I can\'t... see...', 'It has me—', 'Tell my mother...'] },
  revive: { any: ['Back on your feet!', 'Not yet. Get up.', 'You\'re not done.'] },
  boss: { warden: ['That\'s the big one. Hold the line!'], occultist: ['I know its name. Gods, I know its name.'], physician: ['Stay together and stay alive.'], hunter: ['Never seen one that size.'] },
  clear: { any: ['Clear.', 'That\'s the last of them.', 'Keep moving.', 'Is everyone still... themselves?'] },
};

// ---------------- foes ----------------
// size = art scale (matches the monster art); ai = behaviour
const FOES = {
  cultist:   { name: 'Cultist', size: 10, hp: 42, dmg: 9, speed: 32, range: 110, atkCd: 1.9, ai: 'caster', proj: { speed: 110, color: '#d0503a' }, xp: 4, gold: 2,
               desc: 'Chants as it walks. Hurls bolts of boiling blood from range.' },
  ghoul:     { name: 'Ghoul', size: 9, hp: 46, dmg: 7, speed: 60, range: 14, atkCd: 0.75, ai: 'melee', xp: 4, gold: 2,
               desc: 'Fast, hungry and stupid. Comes in packs.' },
  deepone:   { name: 'Deep One', size: 12, hp: 115, dmg: 15, speed: 30, range: 16, atkCd: 1.3, ai: 'melee', armor: 0.2, xp: 8, gold: 4,
               desc: 'Slow, tough and patient. Hits like an anchor.' },
  nightgaunt:{ name: 'Nightgaunt', size: 11, hp: 62, dmg: 16, speed: 48, range: 14, atkCd: 1.3, ai: 'swooper', flying: true, xp: 7, gold: 3,
               desc: 'Circles silently, then dives along a straight line. Watch for the warning streak.' },
  migo:      { name: 'Mi-Go', size: 11, hp: 88, dmg: 8, speed: 38, range: 120, atkCd: 2.3, ai: 'gunner', armor: 0.3, proj: { speed: 150, color: '#9ad0ff', n: 3, spread: 0.35 }, xp: 9, gold: 4,
               desc: 'Armoured. Fires three-bolt bursts from an alien gun.' },
  byakhee:   { name: 'Byakhee', size: 12, hp: 72, dmg: 11, speed: 68, range: 14, atkCd: 0.9, ai: 'melee', flying: true, xp: 8, gold: 3,
               desc: 'Fast rotting flyer. Gets to the back line quickly.' },
  shambler:  { name: 'Dimensional Shambler', size: 12, hp: 140, dmg: 24, speed: 34, range: 16, atkCd: 1.6, ai: 'phaser', xp: 12, gold: 5,
               desc: 'Steps out of the world, then reappears behind its prey.' },
  hound:     { name: 'Hound of Tindalos', size: 12, hp: 110, dmg: 16, speed: 54, range: 14, atkCd: 1.0, ai: 'assassin', xp: 12, gold: 5,
               desc: 'Ignores the tank and blinks straight for the weakest. Taunt it off them.' },
  proto:     { name: 'Proto-Shoggoth', size: 10, hp: 72, dmg: 9, speed: 38, range: 14, atkCd: 1.0, ai: 'melee', xp: 3, gold: 1,
               desc: 'A fragment of a shoggoth. Still hungry.' },
  shoggoth:  { name: 'Shoggoth', size: 19, hp: 620, dmg: 20, speed: 22, range: 22, atkCd: 1.5, ai: 'slammer', elite: true, xp: 40, gold: 22, split: 3,
               desc: 'ELITE. Slams the ground around itself. Splits apart when it dies.' },
  starspawn: { name: 'Star-Spawn', size: 22, hp: 880, dmg: 24, speed: 24, range: 24, atkCd: 1.6, ai: 'brute', elite: true, aura: 46, xp: 60, gold: 32,
               desc: 'ELITE. Its presence burns the mind. Sweeps a cone of claws in front of it.' },
  mask:      { name: 'Mask of Nyarlathotep', size: 14, hp: 160, dmg: 10, speed: 40, range: 120, atkCd: 1.6, ai: 'caster', proj: { speed: 130, color: '#8d63b0' }, xp: 6, gold: 2, art: 'nyarlathotep',
               desc: 'One of a thousand faces. Hollow.' },
  // ---- bosses ----
  dagon:       { name: 'Father Dagon', size: 27, hp: 2600, dmg: 22, speed: 24, range: 30, atkCd: 1.7, ai: 'boss', boss: true, xp: 120, gold: 80,
                 desc: 'Lord of the Deep Ones. Sweeps his claws and calls the tide down on you.' },
  nyarlathotep:{ name: 'Nyarlathotep', size: 25, hp: 3600, dmg: 20, speed: 30, range: 26, atkCd: 1.6, ai: 'boss', boss: true, xp: 180, gold: 120,
                 desc: 'The Crawling Chaos. Blinks across the room, splits into masks, fans shadow at you.' },
  cthulhu:     { name: 'Great Cthulhu', size: 36, hp: 6400, dmg: 28, speed: 16, range: 40, atkCd: 2.0, ai: 'boss', boss: true, xp: 0, gold: 0,
                 desc: 'He dreams no longer. When the Dreaming comes, stand inside an Elder Sign or lose your mind.' },
};

// ---------------- floors ----------------
const FLOORS = [
  { name: 'Innsmouth Docks', sub: 'The tide has gone out. Something walked in with it.', theme: 'docks', rooms: 6,
    pool: [['cultist', 3, 0], ['ghoul', 3, 0], ['deepone', 2, 1], ['nightgaunt', 1.2, 2]], elites: ['shoggoth'], boss: 'dagon' },
  { name: 'The Catacombs', sub: 'Beneath Miskatonic, the old tunnels breathe.', theme: 'crypt', rooms: 6,
    pool: [['ghoul', 2, 0], ['cultist', 2, 0], ['migo', 2, 0], ['nightgaunt', 1.2, 0], ['shambler', 1.6, 1], ['byakhee', 1, 2]], elites: ['shoggoth', 'starspawn'], boss: 'nyarlathotep' },
  { name: 'R\'lyeh', sub: 'The angles are wrong. The stars are right.', theme: 'rlyeh', rooms: 6,
    pool: [['deepone', 2, 0], ['hound', 2, 0], ['migo', 1.2, 0], ['byakhee', 1.2, 0], ['shambler', 1.2, 0], ['proto', 1, 0]], elites: ['starspawn', 'shoggoth'], boss: 'cthulhu' },
];
const ROOM_TYPES = {
  combat:   { name: 'Combat', icon: 'skull', color: '#c3c7cb', desc: 'Horrors. Gold and experience.' },
  elite:    { name: 'Elite', icon: 'eye', color: '#d0503a', desc: 'A dangerous horror. Rewards a relic.' },
  shrine:   { name: 'Shrine', icon: 'sign', color: '#6aa77f', desc: 'An Elder Sign altar. Choose a boon.' },
  rest:     { name: 'Rest', icon: 'fire', color: '#f0d870', desc: 'A campfire. Heal and revive, or meditate.' },
  merchant: { name: 'Merchant', icon: 'coin', color: '#ffe9a8', desc: 'The Antiquarian sells what he finds.' },
  treasure: { name: 'Treasure', icon: 'chest', color: '#a0703c', desc: 'A chest. Contains a relic.' },
  boss:     { name: 'Boss', icon: 'crown', color: '#9a2a24', desc: 'The master of this floor.' },
};

// ---------------- boons (picked on level up and at shrines) ----------------
const BOONS = [
  { id: 'dmg', name: 'Ichor-Tempered Edge', desc: '+15% damage.', max: 5, apply: (h) => h.mods.dmg += 0.15 },
  { id: 'hp', name: 'Thick Hide', desc: '+20% max health.', max: 5, apply: (h) => h.mods.hp += 0.2 },
  { id: 'cd', name: 'Quickened Pulse', desc: 'Abilities recharge 12% faster.', max: 3, apply: (h) => h.mods.cd *= 0.88 },
  { id: 'crit', name: 'Cruel Stars', desc: '+10% critical chance. Crits deal double.', max: 4, apply: (h) => h.mods.crit += 0.1 },
  { id: 'leech', name: 'Leech-Blood', desc: 'Heal for 6% of the damage you deal.', max: 3, apply: (h) => h.mods.leech += 0.06 },
  { id: 'speed', name: 'Fleet of Foot', desc: '+12% move speed. Dodge recharges faster.', max: 3, apply: (h) => { h.mods.speed += 0.12; h.mods.dodgeCd *= 0.8; } },
  { id: 'armor', name: 'Iron Nerves', desc: 'Take 8% less damage.', max: 3, apply: (h) => h.mods.dr += 0.08 },
  { id: 'fellow', name: 'Fellowship', desc: 'Your companions deal +20% damage.', max: 4, apply: (h, g) => g.partyMods.compDmg += 0.2 },
  { id: 'bandage', name: 'Field Dressings', desc: 'Your companions gain +25% max health.', max: 4, apply: (h, g) => { g.partyMods.compHp += 0.25; g.refreshStats(); } },
  { id: 'regen', name: 'Grim Resolve', desc: 'The whole party regenerates 1% health per second.', max: 3, apply: (h, g) => g.partyMods.regen += 0.01 },
  { id: 'potion', name: 'Hidden Flask', desc: 'Gain a Healing Draught.', max: 9, apply: (h, g) => g.draughts++ },
  // class-specific
  { id: 'retribution', cls: 'warden', name: 'Retribution', desc: 'Challenging Roar also deals heavy damage.', max: 1, flag: 'roarDmg' },
  { id: 'unbreakable', cls: 'warden', name: 'Unbreakable', desc: 'Shield Wall also heals you for 25% of your health.', max: 1, flag: 'wallHeal' },
  { id: 'juggernaut', cls: 'warden', name: 'Juggernaut', desc: 'Charge recharges 40% faster and stuns longer.', max: 1, flag: 'juggernaut' },
  { id: 'vengeance', cls: 'warden', name: 'Vengeance', desc: 'Your club strikes 25% harder for each horror attacking you.', max: 1, flag: 'vengeance' },
  { id: 'widerift', cls: 'occultist', name: 'Yawning Rift', desc: 'Void Rift is 50% larger and lasts longer.', max: 1, flag: 'bigRift' },
  { id: 'echo', cls: 'occultist', name: 'Echoing Blast', desc: 'Mind Blast fires a second time.', max: 1, flag: 'echo' },
  { id: 'pierce', cls: 'occultist', name: 'Pierce the Veil', desc: 'Eldritch Bolts pass through one more horror.', max: 2, apply: (h) => h.mods.pierce++ },
  { id: 'madness', cls: 'occultist', name: 'Shared Madness', desc: 'Bolts that kill burst, damaging nearby horrors.', max: 1, flag: 'burst' },
  { id: 'overflow', cls: 'physician', name: 'Overflowing Tonic', desc: 'Excess healing from Mend becomes a shield.', max: 1, flag: 'overflow' },
  { id: 'chain', cls: 'physician', name: 'Chain Mend', desc: 'Mend jumps to a second ally for 60%.', max: 1, flag: 'chainMend' },
  { id: 'field', cls: 'physician', name: 'Field Surgery', desc: 'Sanctuary is 50% larger and heals faster.', max: 1, flag: 'bigSanct' },
  { id: 'toxin', cls: 'physician', name: 'Hemlock Darts', desc: 'Darts poison, and Mend recharges 20% faster.', max: 1, flag: 'toxin' },
  { id: 'twin', cls: 'hunter', name: 'Twin Barrels', desc: 'Rifle Shot fires two bullets.', max: 1, flag: 'twin' },
  { id: 'serrated', cls: 'hunter', name: 'Serrated Jaws', desc: 'Traps also make horrors bleed heavily.', max: 1, flag: 'bleedTrap' },
  { id: 'spray', cls: 'hunter', name: 'Silver Spray', desc: 'Volley fires 3 more shots.', max: 2, apply: (h) => h.mods.volley += 3 },
  { id: 'deadeye', cls: 'hunter', name: 'Deadeye', desc: '+25% critical chance against horrors at long range.', max: 1, flag: 'deadeye' },
];

// ---------------- relics (elites, chests, merchant) ----------------
const RELICS = [
  { id: 'eldersign', name: 'Elder Sign Amulet', desc: 'Your whole party takes 12% less damage.', apply: g => g.partyMods.dr += 0.12 },
  { id: 'necro', name: 'Necronomicon Page', desc: 'Your abilities deal 30% more damage.', apply: g => g.player.mods.abil += 0.3 },
  { id: 'silverkey', name: 'The Silver Key', desc: 'See one extra option whenever you choose a boon.', apply: g => g.extraChoice++ },
  { id: 'trapezo', name: 'Shining Trapezohedron', desc: 'Kills have a 15% chance to heal the party for 8%.', flag: 'trapezo' },
  { id: 'eibon', name: 'Ring of Eibon', desc: 'After you dodge, your next attack deals triple damage.', flag: 'eibon' },
  { id: 'lamp', name: 'Lamp of Alhazred', desc: 'Your light reaches 40% further. +10% critical chance.', apply: g => { g.lightMul += 0.4; g.player.mods.crit += 0.1; } },
  { id: 'cylinder', name: 'Mi-Go Brain Cylinder', desc: 'Your companions\' abilities recharge 30% faster.', apply: g => g.partyMods.compCd *= 0.7 },
  { id: 'scale', name: 'Dagon\'s Scale', desc: 'Every party member gains +50 max health.', apply: g => { g.partyMods.flatHp += 50; g.refreshStats(); } },
  { id: 'yithian', name: 'Yithian Lightning Gun', desc: 'Every 4th basic attack also chains lightning to 3 horrors.', flag: 'yithian' },
  { id: 'pnakotic', name: 'Pnakotic Manuscripts', desc: 'Gain 30% more experience.', apply: g => g.xpMul += 0.3 },
  { id: 'fang', name: 'Fang of Tindalos', desc: 'Critical hits make horrors bleed.', flag: 'fang' },
  { id: 'idol', name: 'Idol of Ghatanothoa', desc: 'Horrors that strike you are turned briefly to stone. 6s cooldown.', flag: 'idol' },
  { id: 'gold', name: 'Esoteric Order Tithe', desc: '+50% gold from every source.', apply: g => g.goldMul += 0.5 },
  { id: 'zeal', name: 'Unaussprechlichen Kulten', desc: 'Your companions use abilities and attack 20% faster, and deal +15% damage.', apply: g => { g.partyMods.compCd *= 0.8; g.partyMods.compDmg += 0.15; } },
];

// ---------------- meta progression ----------------
const RITES = [
  { id: 'vet', name: 'Veteran Investigators', desc: '+10% health for the whole party.', cost: [3, 6, 10] },
  { id: 'gold', name: 'Family Inheritance', desc: 'Start each run with +40 gold.', cost: [2, 4, 7] },
  { id: 'reroll', name: 'Arcane Familiarity', desc: '+1 reroll per run when choosing boons.', cost: [4, 8] },
  { id: 'xp', name: 'Hard-Won Lessons', desc: '+10% experience.', cost: [3, 6, 9] },
  { id: 'potion', name: 'Smuggled Laudanum', desc: 'Start each run with an extra Healing Draught.', cost: [3, 7] },
  { id: 'relic', name: 'Elder Sign Tattoo', desc: 'Start each run with a random relic.', cost: [12] },
];
