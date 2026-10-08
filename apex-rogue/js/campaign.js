'use strict';
// Run structure: race plan, route choices, opponents and prize money.

const RACE_PLAN = [
  { qualify: 4, laps: 3 },
  { qualify: 4, laps: 3 },
  { qualify: 3, laps: 3 },
  { qualify: 3, laps: 3 },
  { qualify: 3, laps: 3 },
  { qualify: 2, laps: 3 },
  { qualify: 2, laps: 3 },
  { qualify: 1, laps: 4, boss: true },
];
const PRIZES = [500, 350, 250, 160, 100, 60, 30, 0];
const OPPONENTS = 6;
const BOSS = { name: 'Vex "The Apex" Marlowe', color: '#141414', accent: '#ffd23f' };

const NODE_TYPES = {
  standard: { label: 'Grand Prix', desc: 'A regular race.', cashMult: 1, aiBonus: 0, rarityBoost: 0, hazardLevel: 0, lapDelta: 0 },
  elite: { label: 'Elite Cup', desc: 'Tougher rivals. 1.6x prize money and better upgrade cards.', cashMult: 1.6, aiBonus: 0.05, rarityBoost: 1.5, hazardLevel: 0, lapDelta: 0 },
  sprint: { label: 'Sprint', desc: 'Only 2 laps, slightly slower rivals. 0.8x prize money.', cashMult: 0.8, aiBonus: -0.02, rarityBoost: 0, hazardLevel: 0, lapDelta: -1 },
  endurance: { label: 'Endurance', desc: 'One extra lap. 1.35x prize money.', cashMult: 1.35, aiBonus: 0, rarityBoost: 0.5, hazardLevel: 1, lapDelta: 1 },
  chaos: { label: 'Chaos Run', desc: 'Oil everywhere. 1.25x prize money.', cashMult: 1.25, aiBonus: -0.01, rarityBoost: 0.5, hazardLevel: 4, lapDelta: 0 },
};

const aiBaseSkill = (raceIndex) => 0.82 + 0.032 * raceIndex;

function makeNode(rng, raceIndex, type, biome) {
  const t = NODE_TYPES[type];
  const plan = RACE_PLAN[raceIndex];
  return {
    type, label: t.label, desc: t.desc, biome,
    seed: Math.floor(rng() * 2 ** 31),
    laps: Math.max(2, plan.laps + t.lapDelta),
    cashMult: t.cashMult, aiBonus: t.aiBonus, rarityBoost: t.rarityBoost,
    hazardLevel: t.hazardLevel + (raceIndex >= 4 ? 1 : 0),
    qualify: plan.qualify, boss: !!plan.boss,
  };
}

function genRouteChoices(run, rng) {
  const i = run.raceIndex;
  const biomes = shuffle(rng, Object.keys(BIOMES));
  if (RACE_PLAN[i].boss) {
    const n = makeNode(rng, i, 'standard', biomes[0]);
    n.label = 'Grand Final';
    n.desc = `Beat ${BOSS.name} to win the Championship. Only 1st place counts.`;
    n.cashMult = 2;
    n.aiBonus = 0.02;
    return [n];
  }
  const types = i === 0 ? ['standard', 'sprint'] : shuffle(rng, ['standard', 'elite', 'sprint', 'endurance', 'chaos']).slice(0, 2);
  return types.map((t, k) => makeNode(rng, i, t, biomes[k]));
}

function buildOpponents(rng, raceIndex, node, boss) {
  const names = shuffle(rng, AI_NAMES.slice());
  const colors = shuffle(rng, AI_COLORS.slice());
  const base = aiBaseSkill(raceIndex) + (node.aiBonus || 0);
  const out = [];
  for (let k = 0; k < OPPONENTS; k++) {
    out.push({ name: names[k], color: colors[k], skill: base + randRange(rng, -0.05, 0.035) });
  }
  if (boss) out[0] = { name: BOSS.name, color: BOSS.color, accent: BOSS.accent, skill: base + 0.07, isBoss: true };
  // Faster drivers start further back.
  out.sort((a, b) => a.skill - b.skill);
  return out;
}

function prizeFor(place, node, raceIndex, run) {
  let base = (PRIZES[place - 1] || 0) * node.cashMult * (1 + 0.15 * raceIndex);
  if (run.perks.includes('lucky')) base *= 1.3;
  if (place === 1 && run.perks.includes('bounty')) base += 400;
  return Math.round(base);
}
