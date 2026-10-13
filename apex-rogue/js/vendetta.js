'use strict';
// Vendettas: a rival you wrecked, or whose tyres you shot out, may not be finished with you. If the driver lived,
// they can come back in a later race of the same run (never another run), in the same car and paint, hunting you,
// and kitted out against whatever beat them last time. Wreck them again to settle it, for a purse. A driver you
// killed (shot through the windscreen) is gone for good.

const VENDETTA = {
  max: 3, // alive at once
  survive: 0.5, // chance a wrecked driver crawled out (a tyre job always lives)
  comeback: 0.55, // chance per race that a waiting vendetta shows up
  maxReturns: 3, // after this many races of chasing you, they give up
  purse: [45, 80], // for settling one
};

// How they come back, by what put them out last time.
const VENDETTA_ADAPT = {
  tyres: { label: 'armoured tyres', apply: (c) => { c.armorTyres = true; } },
  blast: { label: 'blast plating', apply: (c) => { c.plate = { blast: 0.5 }; } },
  bullet: { label: 'bullet plating', apply: (c) => { c.plate = { bullet: 0.7 }; } },
  fire: { label: 'fire-retardant paint', apply: (c) => { c.fireproof = true; c.plate = { fire: 0.5 }; } },
  ram: { label: 'a reinforced frame', apply: (c) => { c.stats.mass *= 1.3; } },
};
const vendettaAdapt = (how) => VENDETTA_ADAPT[how] || VENDETTA_ADAPT.bullet;

const Vendetta = {
  list(run) { return (run.flags.vendettas = run.flags.vendettas || []); },
  active(run) { return this.list(run).filter((v) => !v.over); },

  // After a race: settle the ones that came back, and mark new ones.
  afterRace(run, race, rng, look) {
    const V = this.list(run), out = { settled: [], born: null, escaped: [] };
    run.flags.raceNo = (run.flags.raceNo || 0) + 1;
    const p = race.player;
    for (const c of race.cars) {
      if (!c.vendetta) continue;
      const v = V.find((x) => x.id === c.vendetta);
      if (!v) continue;
      if (c.downed) { v.over = c.downed.how === 'driver' ? 'dead' : 'settled'; out.settled.push(v); } else if (++v.returns >= VENDETTA.maxReturns) { v.over = 'gave up'; } else out.escaped.push(v);
    }
    if (this.active(run).length >= VENDETTA.max) return out;
    // New grudges: wrecks first (the driver may not have lived), then tyre jobs.
    const cands = race.cars.filter((c) => c !== p && !c.isBoss && !c.vendetta && (c.downed || c.tyredBy));
    cands.sort((a, b) => (a.downed ? 0 : 1) - (b.downed ? 0 : 1));
    for (const c of cands) {
      if (c.driverDead || (c.downed && c.downed.how === 'driver')) continue; // dead is dead
      if (c.downed && rng() > VENDETTA.survive) continue;
      if (V.some((x) => x.name === c.name)) continue;
      const how = c.downed ? (c.downed.how === 'driver' ? 'bullet' : c.downed.how) : 'tyres';
      const v = { id: 'v' + run.flags.raceNo + '_' + V.length, name: c.name, color: c.color, accent: c.accent, look: look ? look(c) : null,
        how, born: run.flags.raceNo, act: run.act, returns: 0, over: null };
      V.push(v);
      out.born = v;
      break; // one new grudge per race
    }
    return out;
  },

  // Before a race: maybe one comes back. Not in the tutorial or a boss race (the boss is the story there).
  pick(run, rng, node) {
    if (node.tutorial || node.type === 'boss') return null;
    const wait = this.active(run); // all from earlier races: pick runs before this one starts
    if (!wait.length || rng() > VENDETTA.comeback) return null;
    return wait[Math.floor(rng() * wait.length)];
  },

  // Put them on the grid in place of an ordinary rival: same name, paint and car; a bit sharper and tougher,
  // armed, out for you, and fitted out against what beat them.
  apply(car, v, player) {
    car.vendetta = v.id;
    car.name = v.name; car.color = v.color; car.accent = v.accent;
    car.vendLook = v.look;
    car.stats.maxHp = Math.round(car.stats.maxHp * 1.25);
    car.hp = car.stats.maxHp;
    vendettaAdapt(v.how).apply(car);
    if (car.ai) { car.ai.grudge = player; car.ai.skill += 0.03; }
  },

  // Words for the briefing and results.
  why(v) {
    const where = ['the Undercity', 'the Stacks', 'the Terraces', 'the Crown'][v.act] || 'an earlier race';
    return v.how === 'tyres' ? `you shot their tyres out in ${where}` : `you wrecked them in ${where}`;
  },
};
