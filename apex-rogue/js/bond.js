'use strict';
// The bond between you and your driver. Every second you race together counts, and so does every rival you put
// out, every order that lands, every finish. Shoot them and it costs you. As the bond grows they act on your
// orders faster and hold them longer, drive tighter, stop flinching when they're hit, and in the end they watch
// your back. On the radio they remember what you've been through together.
// Kept per driver on the build (b.bond[key]): a bench driver keeps theirs, and a new driver starts from nothing.

const BOND = {
  perSec: 0.45, // racing together, per second (a three-lap race is worth about 50)
  kill: 6, clean: 10, order: 4, finish: 10, podium: 12, win: 25, boss: 40,
  ff: -18, // each time you put a round into them
  warnCd: 7, // Family: seconds between threat calls
};
// The levels, what each is called, and what it adds (all cumulative).
const BOND_LEVELS = [
  { name: 'Stranger', xp: 0, perk: 'Does what they\'re told, slowly.' },
  { name: 'Cellmate', xp: 60, perk: 'Acts on your orders faster.' },
  { name: 'Partner', xp: 170, perk: 'Drives tighter: better lines, more grip in the corners.' },
  { name: 'Ride or Die', xp: 330, perk: 'Holds your orders longer, and doesn\'t flinch when hit.' },
  { name: 'Family', xp: 540, perk: 'Watches your back: calls out rockets and locks before they land.' },
];
const BOND_UP = [null,
  ['"Alright. You\'re alright, %N."', '"Maybe you\'re not so bad, %N."'],
  ['"I trust you back there. Don\'t make me regret it."', '"We\'re a team now, %N."'],
  ['"Whatever happens out here, we go together."', '"Ride or die, %N. Ride or die."'],
  ['"When we walk out, you\'re eating at my mother\'s table."', '"You\'re family, %N. Nobody touches family."'],
];
const BOND_WARN = { rocket: ['"ROCKET! Behind us!"', '"Incoming! Hold on!"'], lock: ['"Someone\'s got a lock on us!"', '"They\'re painting us! Watch it!"'] };

const Bond = {
  // The driver in your seat's record (made on first ask).
  key(b) { const t = b.chip || 'stock'; return t + ':' + ((b.crewGen && b.crewGen[t]) || 0); },
  rec(b, key) {
    b.bond = b.bond || {};
    key = key || Bond.key(b);
    return b.bond[key] || (b.bond[key] = { xp: 0, races: 0, kills: 0, wins: 0, ff: 0, bosses: [], last: 0 });
  },
  level(xp) { let l = 0; for (let i = 0; i < BOND_LEVELS.length; i++) if (xp >= BOND_LEVELS[i].xp) l = i; return l; },
  // What the bond does at a level.
  perks(lv) {
    return { delay: lv >= 1 ? 0.55 : 1, grip: lv >= 2 ? 1.04 : 1, skill: lv >= 2 ? 0.03 : 0, hold: lv >= 3 ? 1.5 : 1, steady: lv >= 3, warn: lv >= 4 };
  },
  // For the garage: level name, progress to the next, the record in words.
  info(b, key) {
    const r = Bond.rec(b, key), lv = Bond.level(r.xp), L = BOND_LEVELS[lv], next = BOND_LEVELS[lv + 1];
    return { r, lv, name: L.name, f: next ? (r.xp - L.xp) / (next.xp - L.xp) : 1, next: next ? next.xp - r.xp : 0, nextName: next ? next.name : null };
  },
  // What they say on the radio before the start: something you've been through together.
  opener(r, rng, N) {
    const opts = [];
    if (!r.races) opts.push('"First race together. Keep your head down and shoot straight."', '"Never had a gunner who lasted. Prove me wrong."');
    if (r.ff) opts.push(r.ff > 2 ? '"And this time, point it OUT the window. I\'m begging you."' : '"Mind where you point that thing tonight."');
    if (r.kills >= 3) opts.push(`"${r.kills} we've put down together. Let's make it ${r.kills + 3}."`);
    if (r.wins) opts.push(r.wins === 1 ? '"We won one. We can win another."' : `"${r.wins} wins together. Let's go again."`);
    if (r.bosses.length) opts.push(`"We beat ${r.bosses[r.bosses.length - 1]}. These clowns are nothing."`);
    if (r.races >= 3) opts.push(`"${r.races} races and we're still breathing, ${N}."`);
    if (r.last > 3) opts.push('"Forget last time. Tonight\'s ours."');
    return opts.length ? opts[Math.floor(rng() * opts.length)] : null;
  },
};

// Gameplay side, mixed into Combat.
Object.assign(Combat.prototype, {
  bondRec() { return this.tutorial || this.ownDriverDead ? null : Bond.rec(this.build); },
  // XP in (or out), with a radio line when a level comes up.
  bondXp(n) {
    const r = this.bondRec();
    if (!r) return;
    const before = Bond.level(r.xp);
    r.xp = Math.max(0, r.xp + n);
    this.bondGot = (this.bondGot || 0) + n;
    const now = Bond.level(r.xp);
    if (now < before) this.bondPerks = Bond.perks(now); // shot them back down a level
    if (now > before) {
      const lines = BOND_UP[now].map((l) => l.replace('%N', this.inmate || '4471'));
      this.radio(lines);
      this.race.message(`Bond: ${BOND_LEVELS[now].name}. ${BOND_LEVELS[now].perk}`, '#9fd0ff');
      this.events.push({ type: 'order' });
      this.bondPerks = Bond.perks(now);
    }
  },
  bondEvent(kind) {
    const r = this.bondRec();
    if (!r) return;
    if (kind === 'kill' || kind === 'clean') {
      r.kills++;
      // Now and then they count it out loud.
      if ((r.kills % 5 === 0 || this.rng() < 0.2) && (this.yellCd || 0) <= 0) { this.radio([`"That's ${r.kills} together!"`, `"${r.kills}! Keep 'em coming!"`]); this.yellCd = 2; }
    }
    if (kind === 'ff') {
      r.ff++;
      if (Bond.level(r.xp) >= 2 && (this.yellCd || 0) <= 0) { this.radio(['"After everything we\'ve been through?!"', '"I thought we were PARTNERS!"']); this.yellCd = DRIVER.yellCd; }
    }
    this.bondXp(BOND[kind] || 0);
  },
  // Each frame of the race: time together, and (at Family) the threat calls.
  updateBond(dt) {
    if (this.tutorial || this.race.state !== 'racing' || this.player.finished || this.ownDriverDead) return;
    this.bondXp(BOND.perSec * dt);
    if (!this.bondPerks || !this.bondPerks.warn) return;
    this.bondWarnT = Math.max(0, (this.bondWarnT || 0) - dt);
    if (this.bondWarnT > 0) return;
    const t = this.threats().find((x) => (x.kind === 'rocket' && x.k > 0.35) || (x.kind === 'lock' && x.k > 0.5));
    if (t) { this.radio(BOND_WARN[t.kind]); this.events.push({ type: 'order' }); this.bondWarnT = BOND.warnCd; }
  },
  // After the race: the finish, the place, the boss; and what they'll remember about it.
  bondAfterRace(place, ok, bossName) {
    const r = this.bondRec();
    if (!r) return null;
    const lvBefore = Bond.level(r.xp - (this.bondGot || 0));
    r.races++;
    if (!this.player.dnf) this.bondXp(BOND.finish);
    if (place <= 3 && !this.player.dnf) this.bondXp(BOND.podium);
    if (place === 1 && !this.player.dnf) { r.wins++; this.bondXp(BOND.win); }
    if (bossName && ok) { r.bosses.push(bossName); this.bondXp(BOND.boss); }
    r.last = this.player.dnf ? 9 : place;
    return { got: Math.round(this.bondGot || 0), up: Bond.level(r.xp) > lvBefore, info: Bond.info(this.build) };
  },
});
