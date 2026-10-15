'use strict';
// Infamy: the second currency. Scrap is what the warden pays you for placing and killing; Infamy is what the city
// gives you for putting on a show: clean kills, a grenade through a window, a parry, flipping someone off and then
// passing them. It's spent at the Fan Club (the mail shoved under the track door) on things only fans send in.
// The run also keeps a record of what you did (run.flags.rec), and the inmates write it on the garage walls.

const INFAMY = {
  wreck: 4, clean: 8, roofWreck: 2, grenadeIn: 12, parry: 4, shotDown: 1, tyre: 2,
  flip: 1, flipCap: 3, humiliatePass: 5, humiliateWreck: 8,
  win: 10, podium: 4, boss: 20,
};

// The Fan Club's goods, priced in Infamy. `once`: one per visit. `act`: once per act.
const FAN_CLUB = {
  care: { name: 'Care Package', price: 20, once: true, desc: 'A crate thrown over the fence: patch 40 hull and a grenade, wrapped in a fan\'s old sweater.' },
  ammo: { name: 'Bootleg Ammo', price: 15, once: true, desc: 'Boxes of reloads from a fan\'s garage bench: two boxes of ammo for every gun you carry.' },
  donations: { name: 'Fan Donations', price: 25, once: true, desc: 'Scrap taped inside fan letters. Worth {scrap} scrap.' },
  crowd: { name: 'The Crowd Turns', price: 30, once: true, desc: 'Next race the stands pelt whoever is leading (if it isn\'t you): bottles, batteries, a shoe. A few hits of damage every few seconds.' },
  encore: { name: 'Encore', price: 90, act: true, needsStrike: true, desc: 'The fans write in to the warden by the sackful. One strike is wiped. Once per act.' },
};
const FAN_DONATION = (act) => 50 + act * 20;
const CROWD = { every: 4, dmg: 6, slow: 0.85 };
const FAN_TRINKET_PRICE = [55, 75];

// What it costs to get the fans' attention: the Fan Club only opens to you once you've earned this much in the run.
const FAN_CLUB_OPEN = 10;

// Big moments (Combat.bigMoment): seconds between captions, how long one holds, the slow motion, two wrecks this close.
const BIG = { gap: 6, hold: 2.4, slowT: 0.3, slow: 0.35, double: 4 };

const Infamy = {
  // The record the walls are written from. Kept in run.flags so it saves with the run.
  rec(run) {
    return (run.flags.rec = run.flags.rec || { races: 0, wrecks: 0, clean: [], flipped: [], humiliated: 0, wins: 0, podiums: 0, bosses: [], grenadeIn: 0, tyres: 0, parries: 0, wrecked: 0, total: 0 });
  },

  // After a race: bank it all.
  afterRace(run, race, s, ok, claimed) {
    const R = Infamy.rec(run), p = race.player;
    R.races++;
    R.wrecks += s.wrecked;
    for (const x of claimed) { const n = Crew.plain(x.c.name); if (x.clean && !R.clean.includes(n)) R.clean.push(n); }
    for (const n of s.flipped || []) if (!R.flipped.includes(n)) R.flipped.push(n);
    R.humiliated += s.humiliated || 0;
    R.grenadeIn += s.grenadeIn || 0;
    R.tyres += s.tyres || 0;
    R.parries += s.parries;
    if (p.dnf) R.wrecked++;
    if (!p.dnf && p.place === 1) R.wins++;
    else if (!p.dnf && p.place <= 3) R.podiums++;
    if (race.boss && ok && !R.bosses.includes(race.boss.name)) R.bosses.push(race.boss.name);
  },

  // The end-of-race payout on top of what you earned live: a win, a podium, a boss.
  finish(race, ok) {
    const p = race.player, out = [];
    if (!p.dnf && p.place === 1) out.push(['Won', INFAMY.win]);
    else if (!p.dnf && p.place <= 3) out.push(['Podium', INFAMY.podium]);
    if (race.boss && ok) out.push([race.boss.name + ' beaten', INFAMY.boss]);
    return out;
  },

  // A visit's stock: the services, and one fan-made trinket you don't have yet.
  roll(b, run, rng) {
    const stock = Object.keys(FAN_CLUB).map((id) => ({ type: 'fan', id, price: FAN_CLUB[id].price }));
    const left = Object.keys(TRINKETS).filter((id) => TRINKETS[id].fan && !has(b, id));
    if (left.length) stock.push({ type: 'trinket', id: left[Math.floor(rng() * left.length)], price: Math.round((FAN_TRINKET_PRICE[0] + (FAN_TRINKET_PRICE[1] - FAN_TRINKET_PRICE[0]) * rng()) / 5) * 5 });
    return stock;
  },

  // Why you can't buy this one right now (or null).
  blocked(c, b, run) {
    if (c.sold) return 'Sold';
    if ((b.infamy || 0) < c.price) return null; // just too poor: the button shows the price, greyed
    const f = FAN_CLUB[c.id];
    if (!f) return null;
    if (f.needsStrike && !b.strikes) return 'No strikes';
    if (f.act && run.flags.encoreAct === run.act) return 'Used this act';
    return null;
  },

  // ---------- The walls ----------
  // What the inmates have written about you, from the record: a headline over the door, a few lines and replies,
  // a tally of your wrecks, and the drivers you killed on the memorial. Empty until you've done something.
  wall(run, cos, b) {
    const R = run && run.flags.rec;
    const N = String((cos && cos.inmate) || '4471');
    const out = { n: N, headline: null, lines: [], tally: 0, memorial: [], next: null };
    if (!R || !R.races) return out;
    const BOSS_LINES = {
      'The Turnkey': [`${N} TURNED THE TURNKEY`, `${N} HAS THE KEYS NOW`],
      'Smokestack Sal': [`${N} PUT OUT SALS FIRE`, `SAL CHOKED ON ${N}`],
      'Augustin Vale': [`${N} MADE VALE CRY`, `GOLD BLEEDS - ASK ${N}`],
    };
    // The headline: the biggest thing you've done.
    const lastBoss = R.bosses[R.bosses.length - 1];
    if (lastBoss && BOSS_LINES[lastBoss]) out.headline = BOSS_LINES[lastBoss][R.bosses.length % 2];
    else if (R.wins >= 2) out.headline = `${N} FOR THE CROWN`;
    else if (R.clean.length >= 2) out.headline = `DONT RACE ${N}`;
    else if (R.wrecks >= 4) out.headline = `${N} WRECKS EVERYTHING`;
    // Conversations: a line and sometimes a reply. Fans, haters, people who sold you things.
    const L = out.lines, flags = run.flags, tol = flags.tolerance || {};
    if (R.clean.length) L.push([`${N} SHOOTS THE DRIVER`, R.clean.length > 1 ? 'EVERY TIME' : 'GOOD']);
    if (R.grenadeIn) L.push([`${N} DELIVERS`, 'THROUGH THE WINDOW']);
    if (R.flipped.length) L.push([`${N} FLIPPED OFF ${Crew.plain(R.flipped[R.flipped.length - 1]).toUpperCase()}`, R.flipped.length > 2 ? 'AND EVERYONE ELSE' : null]);
    if (R.humiliated >= 2) L.push([`${N} HAS NO MANNERS`, '<3']);
    if (R.parries >= 3) L.push([`${N} SENDS ROCKETS BACK`]);
    if (R.tyres >= 4) L.push([`${N} POPS TYRES FOR FUN`]);
    if (tol.oxy) L.push([`${N} OWES ME FOR THE BLUES`]);
    if (tol.pruno || tol.whiskey) L.push([`${N} CANT HOLD THEIR ${tol.whiskey ? 'WHISKEY' : 'PRUNO'}`, 'WHO CAN']);
    if (tol.meth || tol.cocaine) L.push([`ASK ${N} WHERE THE ${tol.meth ? 'CRANK' : 'SNOW'} WENT`]);
    if (R.wrecked >= 2) L.push([`${N} DRIVES LIKE MY NAN`, 'YOUR NAN WOULDNT SURVIVE IT']);
    if (R.wins >= 1 && !out.headline) L.push([`${N} CAN WIN`, 'ONCE']);
    if (!L.length && R.races >= 2) L.push([`${N} IS STILL HERE`, 'FOR NOW']);
    if (R.races >= 3 && (R.wins + R.podiums) >= 2) L.push(['WE <3 ' + N]);
    if (b && R.races >= 2 && typeof Crew !== 'undefined') { const c = Crew.current(b); L.push([`${N} AND ${c.nick.toUpperCase()}`, R.wins ? 'RIDE OR DIE' : 'DEAD MEN DRIVING']); }
    out.tally = Math.min(R.wrecks, 30);
    out.memorial = R.clean.map((n) => n.toUpperCase() + ' XLI').concat((run.flags.lostDrivers || []).map((n) => n + ' XLI'));
    if ((run.flags.lostDrivers || []).length) L.unshift([`${N} SHOT THEIR OWN DRIVER`, 'ON PURPOSE?']);
    // The old "4471 IS NEXT" (in your number) gets answered once you've lasted.
    if (R.races >= 2) out.next = [`${N} IS NEXT`, R.bosses.length ? 'NEXT TO WALK' : 'NOT YET'];
    return out;
  },
  // A short key for the walls: they're repainted when it changes.
  wallKey(w) { return [w.headline, w.lines.map((l) => l.join('/')).join('|'), w.tally, w.memorial.join(','), w.next && w.next[1]].join('#'); },
};

// Gameplay side, mixed into Combat: the live Infamy feed.
Object.assign(Combat.prototype, {
  fame(n, why) {
    const b = this.build;
    if (!n || this.tutorial) return 0;
    n = Math.max(1, Math.round(n * (has(b, 'scarf') ? 1.25 : 1)));
    this.stats.infamy = (this.stats.infamy || 0) + n;
    (this.stats.fameLog = this.stats.fameLog || []).push([why, n]);
    (this.fameFeed = this.fameFeed || []).push({ text: `+${n} INFAMY  ${why}`, t: 0 });
    if (this.fameFeed.length > 5) this.fameFeed.shift();
    return n;
  },

  // Big moments: the broadcast cuts to you. A caption over the dash, the crowd, a beat of slow motion and the screen
  // edges flickering to the TV feed (the last two can be turned off in Settings). Rare on purpose: one every few
  // seconds at most, unless forced (a grenade in the cabin, a boss).
  bigMoment(line, sub, force) {
    if (this.tutorial) return false;
    const t = this.race.time;
    if (!force && t - (this.lastBig ?? -99) < BIG.gap) return false;
    this.lastBig = t;
    this.big = { line, sub, t: 0 };
    this.events.push({ type: 'bigMoment' });
    if (Settings.data.slowmo !== false) this.slowT = BIG.slowT;
    return true;
  },
  // Which wrecks get the cut, and what the caption says.
  wreckMoment(c, how, n) {
    const N = this.inmate || '4471', name = shortName(c).toUpperCase(), now = this.race.time;
    const sub = `${name}${c.bounty ? ' · BOUNTY ' + Math.round(c.bounty * (how === 'driver' ? BOUNTY.cleanKill : 1)) : ''} · +${n} INFAMY`;
    const prev = this.lastWreckT ?? -99;
    this.lastWreckT = now;
    if (this.inCabinBlast) return;
    if (c.isBoss) return this.bigMoment(`${N} PUTS ${name} IN THE GROUND`, sub, true);
    if (this.blastSrc && this.blastSrc.parried) return this.bigMoment('RETURN TO SENDER', sub);
    if (now - prev < BIG.double) return this.bigMoment('TWO FOR ONE', sub);
    if (c.tiltT > 0) return this.bigMoment('TILTED. WRECKED. GOODNIGHT.', sub);
    if (how === 'driver') return this.bigMoment(`${N} SHOOTS THE DRIVER`, sub);
    return false;
  },

  // The Crowd Turns (bought at the Fan Club): the stands pelt the leader every few seconds.
  updateCrowd(dt) {
    for (const f of this.fameFeed || []) f.t += dt;
    if (this.fameFeed) this.fameFeed = this.fameFeed.filter((f) => f.t < 3);
    if (!this.crowdTurns || this.race.state !== 'racing') return;
    this.crowdT = (this.crowdT || 0) + dt;
    if (this.crowdT < CROWD.every) return;
    this.crowdT = 0;
    const lead = this.race.cars.find((c) => c.place === 1);
    if (!lead || lead === this.player || lead.hp <= 0 || lead.finished) return;
    const before = lead.hp;
    this.race.damage(lead, CROWD.dmg, { kind: 'bullet', ang: 0 });
    lead.vx *= CROWD.slow; lead.vy *= CROWD.slow;
    this.events.push({ type: 'crowd' });
    this.race.message(`The crowd pelts ${shortName(lead)}!`, '#ff6ad5');
    if (before > 0 && lead.hp <= 0) { this.creditWreck(lead, 'crowd'); this.race.message(`The crowd wrecked ${shortName(lead)}!`, '#ff6ad5', true); }
  },
});
