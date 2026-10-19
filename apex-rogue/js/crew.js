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

const DRIVER_HIT = ['"I\'m hit!"', '"Ah! They got me!"', '"Glass in my eye! Keep shooting!"', '"I\'m bleeding here!"', '"Still driving. Still driving."'];
// You can be hit too (rival rounds through the glass): wounds shake your aim until you're patched up.
const GUNNER = { hp: 40, shake: 0.6, patchCost: 2, heal: 0.3 };
// The chance a rival round that hits your car comes through the glass into someone (the blast hatch, shut, stops it).
const CABIN = { front: 0.2, side: 0.16, back: 0.08 };

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
  // The crew: one old lifer who keeps your car running between races (patches a wreck back to running, works the
  // free repair nights). Same man all run; you can see him in the garage, by the lift.
  mechanic() {
    const h = TV.hash((Crew.runSeed >>> 0) % 1000003, 6151);
    const nick = ['Pops', 'Grease', 'Old Man', 'Wrench', 'Uncle', 'Spanners', 'Doc', 'Lifer'][h % 8], last = CREW_LAST[TV.hash(h % 1000003, 313) % CREW_LAST.length];
    return { nick, last, name: `"${nick}" ${last}`, seed: (h % 100000) + 5, years: 22 + (h % 19) };
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
  // You heal a little between races too (a gunner who blacked out wakes up on 40%).
  gunnerAfterRace(b, out) {
    b.gunnerHp = out ? GUNNER.hp * 0.4 : Math.min(GUNNER.hp, Crew.gunnerHp(b) + GUNNER.hp * GUNNER.heal);
  },
  patchCost(b) { return Math.round((DRIVER.hp - Crew.hp(b)) * DRIVER.patchCost); },
  gunnerHp(b) { return b.gunnerHp == null ? GUNNER.hp : b.gunnerHp; },
  gunnerPatchCost(b) { return Math.round((GUNNER.hp - Crew.gunnerHp(b)) * GUNNER.patchCost); },
};

// Gameplay side, mixed into Combat: your own driver taking your rounds.
Object.assign(Combat.prototype, {
  // n of the shot's pellets went into the driver (part: 'head' or 'body'), each doing dmg.
  hitOwnDriver(dmg, part, n) {
    if (this.tutorial || this.ownDriverDead || Settings.data.friendlyFire === false) return;
    this.hurtDriver(dmg * (n || 1) * (part === 'head' ? DRIVER.head : 1), 'you', part);
    if (this.bondEvent) this.bondEvent('ff'); // it costs you with them (js/bond.js)
  },

  // Your driver takes a wound: from you (friendly fire) or from a rival's round through the glass.
  hurtDriver(hurt, by, part) {
    const b = this.build, p = this.player;
    if (this.tutorial || this.ownDriverDead) return;
    b.driverHp = Math.max(0, Crew.hp(b) - hurt);
    this.events.push({ type: 'ownDriverHit', part });
    this.driverHurtT = 0.6;
    if (this.driver) {
      if (!(this.bondPerks && this.bondPerks.steady)) this.driver.swerve(this.rng() < 0.5 ? -1 : 1, 0.35); // they flinch, and the car with them (unless the bond's that strong)
      this.driver.skill = 0.95 - DRIVER.wobble * (1 - b.driverHp / DRIVER.hp); // and drive worse for it
    }
    const c = this.crew || Crew.current(b);
    if (b.driverHp <= 0) {
      this.ownDriverDead = true;
      this.driverKilledBy = by;
      if (by === 'you') {
        this.race.message(`You shot ${c.name}.`, '#ff3b1f', true, true);
        if (this.bigMoment) this.bigMoment('FRIENDLY FIRE', `${this.inmate || '4471'} SHOOTS THEIR OWN DRIVER · ${c.name.toUpperCase()}`, true);
      } else {
        this.race.message(`They got ${c.name}.`, '#ff3b1f', true, true);
        if (this.bigMoment) this.bigMoment('DRIVER DOWN', `${c.name.toUpperCase()} SHOT THROUGH THE GLASS`, true);
      }
      this.race.damage(p, p.hp + 1, { kind: 'crash' }); p.hp = 0; // nobody at the wheel: into the wall
      return;
    }
    if ((this.yellCd || 0) <= 0) { this.radio(by === 'you' ? DRIVER_YELLS : DRIVER_HIT); this.yellCd = DRIVER.yellCd; }
  },

  // You, the gunner, take a round through the glass: a jolt, worse aim until you're patched up, and if it's too
  // much you black out and the race is over for your car.
  woundGunner(dmg) {
    const b = this.build, p = this.player;
    if (this.tutorial || this.gunnerOut) return;
    b.gunnerHp = Math.max(0, (b.gunnerHp ?? GUNNER.hp) - dmg);
    this.flinchT = 0.7;
    this.events.push({ type: 'gunnerHit' });
    if (b.gunnerHp <= 0) {
      this.gunnerOut = true;
      this.race.message('You black out.', '#ff3b1f', true, true);
      if (this.bigMoment) this.bigMoment('GUNNER DOWN', `${this.inmate || '4471'} TAKES ONE THROUGH THE GLASS`, true);
      this.race.damage(p, p.hp + 1, { kind: 'crash' }); p.hp = 0; // your driver pulls off: your night is over
      return;
    }
    this.race.message(`You're hit! (${Math.round((100 * b.gunnerHp) / GUNNER.hp)}%)`, '#ff6a4a');
  },

  // Did that round come through your glass into someone? Windscreen: either of you; a side window: whoever sits
  // on that side (you on the left, your driver on the right); the back window, now and then.
  cabinHit(pr) {
    const p = this.player, rel = wrapAngle(Math.atan2(-pr.vy, -pr.vx) - p.heading); // 0: from dead ahead, +: from the right (your side)
    const a = Math.abs(rel);
    if (this.leanOut) return this.leanHit(rel); // hanging out of the window (js/lean.js)
    if (a < 0.9) return this.rng() < (this.glassOut ? GLASS_FX.front : CABIN.front) ? (this.rng() < 0.5 ? 'driver' : 'you') : null; // (no windshield: far more gets in)
    if (a < 2.2) return this.rng() < CABIN.side ? (rel > 0 ? 'you' : 'driver') : null;
    return this.rng() < CABIN.back ? (this.rng() < 0.5 ? 'driver' : 'you') : null;
  },
});
