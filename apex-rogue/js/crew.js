'use strict';
// Your driver: another inmate at the wheel, collared like you (step off the course and the warden's collar goes
// off, which is why nobody just drives away). You start a run with whoever the block sends; better drivers are
// recruited along the way. Each has a habit that changes how they drive (internally these are still the "chips":
// build.chip is the trait of the driver in the seat, build.stash.chips the ones waiting on the bench).
// Names are a prison nickname (from one pool shared with the rivals) and a surname, rolled fresh every run but fixed
// within it, so the same recruit keeps their name from the reward card to the radio to the release papers.

// One big pool of prison nicknames, for everyone: your drivers and every rival on the grid. Nothing about a name
// says how someone drives; a "Granny" can be a hothead.
const CREW_NICKS = ['Lucky', 'Junior', 'Tiny', 'Biscuit', 'Moose', 'Pockets', 'Rabbit', 'Kid', 'Mad Dog', 'Knuckles',
  'Torch', 'Razor', 'Bulldog', 'Hammer', 'Pitbull', 'Granny', 'Preacher', 'Doc', 'Sunday', 'Mumbles', 'Professor',
  'Deacon', 'Crash', 'Sparky', 'Jackknife', 'Rocket', 'Wildcard', 'Kamikaze', 'Stunt', 'Trigger', 'Shells', 'Ratchet',
  'Snake Eyes', 'Boom Boom', 'Lead', 'Pistol', 'Old Man', 'Getaway', 'Bishop', 'Wheels', 'Pops', 'Smokey', 'Chauffeur',
  'Ghost', 'Smoke', 'Whisper', 'Spider', 'Shadow', 'Phantom', 'Slim', 'Hollywood', 'Flash', 'Sugar', 'Prince',
  'Diamond', 'Glitter', 'Showtime', 'Gravel', 'Two-Tone', 'Shiv', 'Hacksaw', 'Cupcake', 'Teeth', 'Lefty', 'Stitches',
  'Mouse', 'Bones', 'Chalk', 'Tin Can', 'Pretty Boy', 'Sarge', 'Nails', 'Halfpint', 'Brick', 'Tadpole', 'Fingers',
  'Dutch', 'Bingo', 'Weasel', 'Cookie', 'Saint', 'Juice', 'Patches', 'Crow', 'Mama', 'Turbo', 'Gator', 'Sleepy'];
const CREW_LAST = ['Reyes', 'Okafor', 'Kowalski', 'Delacroix', 'Brannigan', 'Haddad', 'Lindqvist', 'Moreno', 'Sullivan',
  'Novak', 'Abara', 'Castellano', 'Duffy', 'Ibarra', 'Jankowski', 'Kerrigan', 'Malone', 'Nakata', 'Petrakis', 'Quinlan',
  'Rourke', 'Szabo', 'Tolliver', 'Vasquez', 'Whitlock', 'Yilmaz', 'Zelenko', 'Fitch', 'Gallo', 'Hargrove'];
// The trait a driver brings, in plain words (CHIPS holds the full effect text).
const CREW_TRAIT = { stock: 'No particular habits', hothead: 'Hothead', cautious: 'Cautious', daredevil: 'Daredevil', gun_nut: 'Gun nut', veteran: 'Getaway veteran', ghost: 'Ghost', showboat: 'Showboat' };

// Your driver can be hurt, and the commonest way is you: swing round with your finger on the trigger and the
// shots go into them, not out of the window (Settings: Friendly fire). Head shots count double. A wounded driver
// drives worse; a dead one crashes the car, and the block sends someone new.
const DRIVER = { hp: 40, head: 2, heal: 0.3, patchCost: 2, yellCd: 1.2, wobble: 0.25 };
const DRIVER_YELLS = ['"WATCH IT!"', '"ARE YOU SHOOTING ME?!"', '"I\'M HIT! I\'M HIT!"', '"WRONG WAY, GENIUS!"', '"Whose side are you on?!"', '"Not the DRIVER!"', '"Point it OUT the window!"'];

const Crew = {
  runSeed: 7, // set when a run starts or loads (Proto)
  gens: {}, // per trait: how many of that kind of driver have died this run (the next one gets a new name)

  // Who a given trait's driver is, this run.
  id(trait) {
    trait = trait || 'stock';
    const gen = Crew.gens[trait] || 0;
    const h = (TV.hash((Crew.runSeed >>> 0) % 100000 + gen * 7919, [...trait].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0));
    const nick = CREW_NICKS[h % CREW_NICKS.length], last = CREW_LAST[TV.hash(h % 1000003, 991) % CREW_LAST.length];
    return { trait, nick, last, name: `"${nick}" ${last}`, short: nick, number: String(1000 + ((h >>> 3) % 9000)), seed: (h % 100000) + 17, label: CREW_TRAIT[trait] || trait };
  },
  // A rival driver on tonight's grid: random for every race, but the same if the race is replayed from a save.
  // taken: nicknames already on the grid (and your own driver's), so no two match.
  rival(seed, k, taken) {
    let h = TV.hash((seed >>> 0) % 1000003, k * 131 + 7);
    let nick = CREW_NICKS[h % CREW_NICKS.length];
    for (let i = 1; taken.has(nick) && i < CREW_NICKS.length; i++) nick = CREW_NICKS[(h + i * 7) % CREW_NICKS.length];
    taken.add(nick);
    const last = CREW_LAST[TV.hash(h % 1000003, 577) % CREW_LAST.length];
    return { nick, last, name: `"${nick}" ${last}` };
  },
  // A name without its quotes, for the walls and the record.
  plain(name) { return String(name).replace(/"/g, ''); },
  // The driver in your seat.
  current(b) { return Crew.id(b && b.chip); },
  hp(b) { return b.driverHp == null ? DRIVER.hp : b.driverHp; },

  // After a race: a dead driver is replaced from the block; a living one heals a little.
  afterRace(b, run, dead) {
    if (dead) {
      const was = Crew.current(b), trait = b.chip || 'stock';
      b.crewGen = b.crewGen || {};
      b.crewGen[trait] = (b.crewGen[trait] || 0) + 1;
      Crew.gens = b.crewGen;
      if (b.chip) b.chip = null; // that habit died with them
      b.driverHp = DRIVER.hp;
      (run.flags.lostDrivers = run.flags.lostDrivers || []).push(was.nick.toUpperCase() + ' ' + was.last.toUpperCase());
      return { was, now: Crew.current(b) };
    }
    b.driverHp = Math.min(DRIVER.hp, Crew.hp(b) + DRIVER.hp * DRIVER.heal);
    return null;
  },
  patchCost(b) { return Math.round((DRIVER.hp - Crew.hp(b)) * DRIVER.patchCost); },
};

// Gameplay side, mixed into Combat: your own driver taking your rounds.
Object.assign(Combat.prototype, {
  // n of the shot's pellets went into the driver (part: 'head' or 'body'), each doing dmg.
  hitOwnDriver(dmg, part, n) {
    const b = this.build, p = this.player;
    if (this.tutorial || this.ownDriverDead || Settings.data.friendlyFire === false) return;
    const hurt = dmg * (n || 1) * (part === 'head' ? DRIVER.head : 1);
    b.driverHp = Math.max(0, Crew.hp(b) - hurt);
    this.events.push({ type: 'ownDriverHit', part });
    this.driverHurtT = 0.6;
    if (this.driver) {
      this.driver.swerve(this.rng() < 0.5 ? -1 : 1, 0.35); // they flinch, and the car with them
      this.driver.skill = 0.95 - DRIVER.wobble * (1 - b.driverHp / DRIVER.hp); // and drive worse for it
    }
    if (b.driverHp <= 0) {
      this.ownDriverDead = true;
      const c = this.crew || Crew.current(b);
      this.race.message(`You shot ${c.name}.`, '#ff3b1f', true, true);
      if (this.bigMoment) this.bigMoment('FRIENDLY FIRE', `${this.inmate || '4471'} SHOOTS THEIR OWN DRIVER · ${c.name.toUpperCase()}`, true);
      this.race.damage(p, p.hp + 1, { kind: 'crash' }); p.hp = 0; // nobody at the wheel: into the wall
      return;
    }
    if ((this.yellCd || 0) <= 0) { this.radio(DRIVER_YELLS); this.yellCd = DRIVER.yellCd; }
  },
});
