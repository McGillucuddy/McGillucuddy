'use strict';
// Cars, upgrade cards, perks and stat computation.

const CARS = {
  comet: {
    name: 'Comet', desc: 'Balanced all-rounder. A safe first pick.',
    color: '#e8423f', accent: '#ffd23f',
    top: 560, accel: 330, handling: 2.7, grip: 9, hp: 100, nitro: 100, mass: 1.0,
    unlock: null,
  },
  brick: {
    name: 'Brick', desc: 'Armoured bruiser. Slow to turn, shrugs off hits.',
    color: '#3f7be8', accent: '#cfd8e3',
    top: 545, accel: 290, handling: 2.4, grip: 9.5, hp: 160, nitro: 100, mass: 1.5,
    unlock: { bestRace: 3, text: 'Reach race 4 in any run' },
  },
  wasp: {
    name: 'Wasp', desc: 'Featherweight. Darts through corners, breaks easily.',
    color: '#f2c230', accent: '#1d1d1d',
    top: 545, accel: 385, handling: 3.1, grip: 10.5, hp: 70, nitro: 120, mass: 0.75,
    unlock: { bestRace: 5, text: 'Reach race 6 in any run' },
  },
  phantom: {
    name: 'Phantom', desc: 'Straight-line demon with a twitchy rear end.',
    color: '#9b5de5', accent: '#00f5d4',
    top: 615, accel: 320, handling: 2.6, grip: 7.8, hp: 90, nitro: 130, mass: 0.95,
    unlock: { wins: 1, text: 'Win a Championship' },
  },
};

const STAT_DEFS = {
  top: { name: 'Engine', label: 'Top speed', per: 0.05 },
  accel: { name: 'Gearbox', label: 'Acceleration', per: 0.1 },
  handling: { name: 'Steering', label: 'Handling', per: 0.07 },
  grip: { name: 'Tyres', label: 'Grip', per: 0.09 },
  nitro: { name: 'Nitro Tank', label: 'Nitro capacity', per: 0.25 },
};
const MAX_SHOP_LEVEL = 6;

const RARITY_WEIGHT = { common: 60, rare: 30, epic: 10 };

const CARDS = [
  // Stat cards (stackable)
  { id: 'turbo', name: 'Turbocharger', rarity: 'common', kind: 'stat', stat: 'top', icon: '🔥', desc: '+1 Engine level (+5% top speed).' },
  { id: 'gearbox', name: 'Close-Ratio Gearbox', rarity: 'common', kind: 'stat', stat: 'accel', icon: '⚙️', desc: '+1 Gearbox level (+10% acceleration).' },
  { id: 'tyres', name: 'Sticky Tyres', rarity: 'common', kind: 'stat', stat: 'grip', icon: '🛞', desc: '+1 Tyres level (+9% grip).' },
  { id: 'rack', name: 'Quick Rack', rarity: 'common', kind: 'stat', stat: 'handling', icon: '🎯', desc: '+1 Steering level (+7% handling).' },
  { id: 'tank', name: 'Bigger Bottle', rarity: 'common', kind: 'stat', stat: 'nitro', icon: '🧪', desc: '+1 Nitro Tank level (+25% capacity).' },
  { id: 'cage', name: 'Roll Cage', rarity: 'common', kind: 'instant', icon: '🛡️', desc: '+25 max HP and repair 25 HP.',
    apply: (run) => { run.bonusHp += 25; run.hp += 25; } },
  { id: 'sponsor', name: 'Sponsor Deal', rarity: 'common', kind: 'instant', icon: '💰', desc: 'Gain $250 cash now.',
    apply: (run) => { run.cash += 250; } },
  { id: 'fieldrepair', name: 'Field Repair', rarity: 'common', kind: 'instant', icon: '🔧', desc: 'Restore 60 HP.',
    apply: (run) => { run.hp += 60; }, cond: (run) => run.hp < computeStats(run).maxHp - 25 },
  { id: 'twinturbo', name: 'Twin Turbo', rarity: 'rare', kind: 'instant', icon: '🚀', desc: '+2 Engine levels.',
    apply: (run) => { run.statLevels.top += 2; } },

  // Perks (unique)
  { id: 'slipstream', name: 'Slipstream', rarity: 'rare', kind: 'perk', icon: '🌬️', desc: 'Tailing a rival gives +8% top speed and refills nitro.' },
  { id: 'ramplates', name: 'Ram Plates', rarity: 'rare', kind: 'perk', icon: '🐏', desc: 'Rivals you hit take 3x damage and get shoved. You take half car-hit damage.' },
  { id: 'allterrain', name: 'All-Terrain Kit', rarity: 'rare', kind: 'perk', icon: '🏜️', desc: 'Off-track slowdown reduced by 60%.' },
  { id: 'bumpers', name: 'Rubber Bumpers', rarity: 'rare', kind: 'perk', icon: '🧽', desc: 'Walls deal no damage and you keep more speed on impact.' },
  { id: 'driftking', name: 'Drift King', rarity: 'rare', kind: 'perk', icon: '🌀', desc: 'Drifting refills nitro quickly.' },
  { id: 'overtaker', name: 'Overtaker', rarity: 'rare', kind: 'perk', icon: '⏩', desc: 'Each overtake pays $20 and grants 15 nitro.' },
  { id: 'lucky', name: 'Lucky Charm', rarity: 'rare', kind: 'perk', icon: '🍀', desc: '+30% race winnings.' },
  { id: 'pitcrew', name: 'Pit Crew', rarity: 'rare', kind: 'perk', icon: '🧰', desc: 'Repair 15 HP every lap you complete.' },
  { id: 'rocketstart', name: 'Rocket Start', rarity: 'rare', kind: 'perk', icon: '🏁', desc: 'Wider perfect-launch window, bigger launch boost and a full nitro tank.' },
  { id: 'boostjunkie', name: 'Boost Junkie', rarity: 'rare', kind: 'perk', icon: '➡️', desc: 'Boost pads last twice as long and refill 30 nitro.' },
  { id: 'injectors', name: 'Nitro Injectors', rarity: 'rare', kind: 'perk', icon: '💉', desc: 'Nitro is 40% more powerful.' },
  { id: 'slingshot', name: 'Slingshot', rarity: 'rare', kind: 'perk', icon: '🏹', desc: 'Getting overtaken triggers a short speed boost.' },
  { id: 'recycler', name: 'Nitro Recycler', rarity: 'epic', kind: 'perk', icon: '♻️', desc: 'Nitro regenerates 3x faster.' },
  { id: 'glasscannon', name: 'Glass Cannon', rarity: 'epic', kind: 'perk', icon: '💎', desc: '+15% top speed and acceleration, but -40% max HP.' },
  { id: 'ghost', name: 'Ghost Chassis', rarity: 'epic', kind: 'perk', icon: '👻', desc: 'Drive straight through rival cars.' },
  { id: 'bounty', name: 'Bounty Hunter', rarity: 'epic', kind: 'perk', icon: '🎯', desc: 'Winning a race pays an extra $400.' },
  { id: 'spareengine', name: 'Spare Engine', rarity: 'epic', kind: 'instant', icon: '❤️', desc: '+1 life: retry a race you fail to qualify in.',
    apply: (run) => { run.lives += 1; } },
];
const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

function newRun(carKey, seed) {
  const car = CARS[carKey];
  return {
    carKey, seed, raceIndex: 0, cash: 150, hp: car.hp, bonusHp: 0, lives: 0,
    statLevels: { top: 0, accel: 0, handling: 0, grip: 0, nitro: 0 },
    shopLevels: { top: 0, accel: 0, handling: 0, grip: 0, nitro: 0 },
    perks: [], history: [], totalEarned: 0, spareBought: 0,
  };
}

function computeStats(run) {
  const base = CARS[run.carKey];
  const L = run.statLevels;
  const s = {
    top: base.top * (1 + STAT_DEFS.top.per * L.top),
    accel: base.accel * (1 + STAT_DEFS.accel.per * L.accel),
    handling: base.handling * (1 + STAT_DEFS.handling.per * L.handling),
    grip: base.grip * (1 + STAT_DEFS.grip.per * L.grip),
    nitroCap: base.nitro * (1 + STAT_DEFS.nitro.per * L.nitro),
    nitroPower: 1,
    nitroRegen: 4,
    maxHp: base.hp + run.bonusHp,
    mass: base.mass,
    offroadMul: 1,
  };
  const P = new Set(run.perks);
  if (P.has('glasscannon')) { s.top *= 1.15; s.accel *= 1.15; s.maxHp = Math.round(s.maxHp * 0.6); }
  if (P.has('injectors')) s.nitroPower = 1.4;
  if (P.has('recycler')) s.nitroRegen *= 3;
  if (P.has('allterrain')) s.offroadMul = 0.4;
  return s;
}

function rollCards(run, rng, count, rarityBoost) {
  const owned = new Set(run.perks);
  const pool = CARDS.filter((c) => {
    if (c.kind === 'perk' && owned.has(c.id)) return false;
    if (c.cond && !c.cond(run)) return false;
    return true;
  });
  const out = [];
  while (out.length < count && pool.length) {
    const c = weightedPick(rng, pool, (k) => {
      let w = RARITY_WEIGHT[k.rarity];
      if (rarityBoost && k.rarity !== 'common') w *= 1 + rarityBoost;
      if (rarityBoost >= 2 && k.rarity === 'common') w *= 0.15;
      return w;
    });
    out.push(c);
    pool.splice(pool.indexOf(c), 1);
  }
  return out;
}

function applyCard(run, card) {
  if (card.kind === 'stat') run.statLevels[card.stat] += 1;
  else if (card.kind === 'perk') run.perks.push(card.id);
  else if (card.apply) card.apply(run);
  run.hp = clamp(run.hp, 0, computeStats(run).maxHp);
}

function shopStatCost(run, stat) {
  return 140 + 120 * run.shopLevels[stat] + 25 * run.statLevels[stat];
}

function repairCost(run) {
  const missing = computeStats(run).maxHp - run.hp;
  return Math.ceil(missing * 2);
}

const spareEngineCost = (run) => 650 + 350 * run.spareBought;
const CRATE_COST = 300;
