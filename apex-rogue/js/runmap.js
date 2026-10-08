'use strict';
// The run map: each act is a route sheet of branching nodes ending in a boss qualifier.
// Race: finish top 3 or take a strike. Elite: tougher, armed field; a trinket is guaranteed among the rewards.
// Commissary: the only place the black market is open. Event: a choice with a trade-off. Mechanic: free repairs.
// Boss: beat the named rival to move up to the next act (fail = strike, and you face them again).

const MAP_ROWS = 4; // rows of choices before the boss
const MAP_COLS = 3;

const NODE_TYPES_RUN = {
  race: { label: 'Race', icon: '🏁', desc: 'A regular race. Finish top 3 or take a strike.' },
  elite: { label: 'Elite race', icon: '☠', desc: 'Sharper drivers, more guns. A trinket is guaranteed among the rewards.' },
  shop: { label: 'Commissary', icon: '🛒', desc: 'The black market opens its hatch. Buy parts, guns, mods.' },
  event: { label: 'Event', icon: '?', desc: 'Something happens in the cell block. Choose how to handle it.' },
  repair: { label: 'Mechanic', icon: '🔧', desc: 'An old lifer patches your car up for free.' },
  boss: { label: 'Qualifier', icon: '👑', desc: 'Beat the boss to move up.' },
};

const BOSSES = [
  {
    name: 'The Turnkey', title: "The warden's enforcer",
    desc: 'An armoured prison van with a gunner in the back. Slow off the line, impossible to push around.',
    color: '#1e1f22', look: { style: 'brick', bumper: 'plow', roof: 'cage', livery: 'none', finish: 'matte', grime: 'filthy' },
    weapon: 'gun', hp: 230, skill: 0.03, mass: 1.6,
  },
  {
    name: 'Smokestack Sal', title: 'King of the Stacks',
    desc: 'Lays mines all race long and knows every shortcut through the smog.',
    color: '#6a3a22', look: { style: 'phantom', roof: 'rack', exhaust: 'side', livery: 'stencil', finish: 'rusty', grime: 'dirty' },
    weapon: 'mine', hp: 170, skill: 0.06, mass: 1.1,
  },
  {
    name: 'Augustin Vale', title: "The sponsors' golden boy",
    desc: 'A gold supercar, rocket pods and the best engine money can buy. He has never lost to a prisoner.',
    color: '#c9a443', look: { style: 'wasp', spoiler: 'bigwing', livery: 'stripes', finish: 'gloss', grime: 'clean', underglow: '#ffd86a' },
    weapon: 'rocket', hp: 150, skill: 0.09, mass: 0.9,
  },
  {
    name: 'Vex "The Apex" Marlowe', title: 'Champion of the Crown',
    desc: 'Undefeated. Only an outright win sets you free.',
    color: '#141414', look: { style: 'phantom', spoiler: 'wing', livery: 'flames', finish: 'gloss', grime: 'clean', rims: 'black' },
    weapon: 'rocket', hp: 210, skill: 0.11, mass: 1.2, mustWin: true,
  },
];

// Events: a short scene and two or three choices. apply(build, run) returns the outcome text.
const EVENTS = [
  {
    id: 'guard', title: "The guard's offer",
    text: 'A guard leans on your car and slips you a note: "Scrap talks. I can lose a report."',
    options: [
      { label: 'Pay 120 scrap', desc: 'Remove a strike.', ok: (b) => b.scrap >= 120 && b.strikes > 0, apply: (b) => { b.scrap -= 120; b.strikes--; return 'The report goes missing. One strike wiped.'; } },
      { label: 'Walk away', desc: 'Nothing happens.', apply: () => 'You pocket the note and say nothing.' },
    ],
  },
  {
    id: 'contraband', title: 'Contraband run',
    text: 'The trustees need a package moved across the yard in your car. Nobody asks what is in it.',
    options: [
      { label: 'Carry it', desc: '+180 scrap, but it is heavy: start your next race with 30 less hull.', apply: (b, r) => { b.scrap += 180; r.flags.hullHit = 30; return 'The package rattles. 180 scrap richer.'; } },
      { label: 'Refuse', desc: 'Nothing happens.', apply: () => 'The trustees remember faces.' },
    ],
  },
  {
    id: 'bet', title: 'Betting ring',
    text: 'The block is running a book on the next race. You could bet on yourself.',
    options: [
      { label: 'Bet 100 scrap', desc: 'Finish top 2 next race to win 300.', ok: (b) => b.scrap >= 100, apply: (b, r) => { b.scrap -= 100; r.flags.bet = 300; return 'Your name goes in the book.'; } },
      { label: 'Stay out', desc: 'Nothing happens.', apply: () => 'You keep your scrap.' },
    ],
  },
  {
    id: 'scrapyard', title: 'The scrapyard',
    text: 'A gap in the fence behind the scrapyard. Wrecks of drivers who did not make it.',
    options: [
      { label: 'Dig through the wrecks', desc: 'Find a random mod... or cut yourself on the metal (-25 hull).', apply: (b, r, rng) => {
        if (rng() < 0.6) { const ids = Object.keys(MODS); const id = ids[Math.floor(rng() * ids.length)]; applyItem(b, itemCard('mod', id)); return `You pull a ${MODS[id].name} out of a burnt-out boot.`; }
        b.hull = Math.max(1, b.hull - 25); return 'A loose panel slices your arm. Your car takes the knocks too (-25 hull).';
      } },
      { label: 'Leave it', desc: 'Nothing happens.', apply: () => 'Some things are better left buried.' },
    ],
  },
  {
    id: 'snitch', title: 'The snitch',
    text: 'You overheard the gunners planning an ambush. The warden pays for information.',
    options: [
      { label: 'Tell the warden', desc: 'Rival gunners start your next race unarmed. You lose 30 reputation.', apply: (b, r) => { r.flags.disarm = true; r.flags.repLoss = 30; return 'Their guns are confiscated. Nobody looks you in the eye.'; } },
      { label: 'Warn the drivers', desc: '+40 reputation.', apply: (b, r) => { r.flags.repGain = 40; return 'Word gets round that you are solid.'; } },
    ],
  },
  {
    id: 'chapel', title: 'The prison chapel',
    text: 'The chaplain offers to bless your car. He also knows a man who sells parts.',
    options: [
      { label: 'Take the blessing', desc: 'Repair 50 hull.', apply: (b) => { b.hull = Math.min(b.maxHull, b.hull + 50); return 'Holy water on the bonnet. The dents seem smaller.'; } },
      { label: 'Ask about parts (80 scrap)', desc: 'Get a random part.', ok: (b) => b.scrap >= 80, apply: (b, r, rng) => {
        b.scrap -= 80; const ids = Object.keys(PARTS).filter((id) => PARTS[id].price > 0 && !ownsPart(b, id));
        const id = ids[Math.floor(rng() * ids.length)]; applyItem(b, itemCard('part', id)); return `A ${PARTS[id].name} turns up behind the altar.`;
      } },
    ],
  },
];

// Build an act's route sheet: rows of 2-3 nodes with crossing-free links to the row above, then the boss.
function genActMap(rng, act) {
  const rows = [];
  let id = 0;
  for (let r = 0; r < MAP_ROWS; r++) {
    const cols = shuffle(rng, [0, 1, 2]).slice(0, r === 0 ? 2 + (rng() < 0.5 ? 1 : 0) : 2 + (rng() < 0.6 ? 1 : 0)).sort();
    rows.push(cols.map((c) => ({ id: id++, row: r, col: c, type: 'race', next: [], done: false })));
  }
  // Links: each node goes to the nearest nodes in the next row (|dc| <= 1), every node reachable.
  for (let r = 0; r < MAP_ROWS - 1; r++) {
    const A = rows[r], B = rows[r + 1];
    for (const a of A) {
      for (const bn of B) if (Math.abs(bn.col - a.col) <= 1) a.next.push(bn.id);
      if (!a.next.length) a.next.push(B.reduce((best, n) => (Math.abs(n.col - a.col) < Math.abs(best.col - a.col) ? n : best)).id);
    }
    for (const bn of B) if (!A.some((a) => a.next.includes(bn.id))) A.reduce((best, a) => (Math.abs(a.col - bn.col) < Math.abs(best.col - bn.col) ? a : best)).next.push(bn.id);
  }
  const boss = { id: id++, row: MAP_ROWS, col: 1, type: 'boss', next: [], done: false };
  for (const n of rows[MAP_ROWS - 1]) n.next.push(boss.id);
  // Types: the first row is always racing; later rows mix in elites, the commissary, events and the mechanic.
  const pool = ['race', 'race', 'race', 'elite', 'event', 'event', 'shop', 'repair'];
  for (let r = 1; r < MAP_ROWS; r++) for (const n of rows[r]) n.type = pool[Math.floor(rng() * pool.length)];
  const all = rows.flat();
  const ensure = (type, rowsOk) => {
    if (all.some((n) => n.type === type)) return;
    const cands = all.filter((n) => rowsOk.includes(n.row) && n.type === 'race');
    if (cands.length) cands[Math.floor(rng() * cands.length)].type = type;
  };
  ensure('shop', [2, 3]);
  ensure('elite', [1, 2, 3]);
  ensure('event', [1, 2]);
  // Keep it varied but fair: at most two elites and three events per act.
  const cap = (type, max) => { const l = all.filter((n) => n.type === type); while (l.length > max) l.splice(Math.floor(rng() * l.length), 1)[0].type = 'race'; };
  cap('elite', 2);
  cap('event', 3);
  cap('repair', 1);
  cap('shop', 2);
  // Never two commissaries side by side in a row.
  for (const row of rows) { let seen = false; for (const n of row) { if (n.type === 'shop') { if (seen) n.type = 'race'; seen = true; } } }
  return { act, rows, boss, nodes: [...all, boss], seed: Math.floor(rng() * 1e9) };
}

const mapNode = (map, id) => map.nodes.find((n) => n.id === id);

// Nodes you can pick now: the first row at the start of an act, otherwise the links from where you are.
function reachableNodes(map, curId) {
  if (curId == null) return map.rows[0].map((n) => n.id);
  const cur = mapNode(map, curId);
  if (cur.type === 'boss' && !cur.done) return [cur.id];
  return cur.next;
}
