'use strict';
// Your driver: another inmate at the wheel, collared like you (step off the course and the warden's collar goes
// off, which is why nobody just drives away). You start a run with whoever the block sends; better drivers are
// recruited along the way. Each has a habit that changes how they drive (internally these are still the "chips":
// build.chip is the trait of the driver in the seat, build.stash.chips the ones waiting on the bench).
// Names are a prison nickname and a surname, rolled fresh every run but fixed within it, so the same recruit keeps
// their name from the reward card to the radio to the release papers.

const CREW_NICKS = {
  stock: ['Lucky', 'Junior', 'Tiny', 'Biscuit', 'Moose', 'Pockets', 'Rabbit', 'Kid'],
  hothead: ['Mad Dog', 'Knuckles', 'Torch', 'Razor', 'Bulldog', 'Hammer', 'Pitbull'],
  cautious: ['Granny', 'Preacher', 'Doc', 'Sunday', 'Mumbles', 'Professor', 'Deacon'],
  daredevil: ['Crash', 'Sparky', 'Jackknife', 'Rocket', 'Wildcard', 'Kamikaze', 'Stunt'],
  gun_nut: ['Trigger', 'Shells', 'Ratchet', 'Snake Eyes', 'Boom Boom', 'Lead', 'Pistol'],
  veteran: ['Old Man', 'Getaway', 'Bishop', 'Wheels', 'Pops', 'Smokey', 'Chauffeur'],
  ghost: ['Ghost', 'Smoke', 'Whisper', 'Spider', 'Shadow', 'Phantom', 'Slim'],
  showboat: ['Hollywood', 'Flash', 'Sugar', 'Prince', 'Diamond', 'Glitter', 'Showtime'],
};
const CREW_LAST = ['Reyes', 'Okafor', 'Kowalski', 'Delacroix', 'Brannigan', 'Haddad', 'Lindqvist', 'Moreno', 'Sullivan',
  'Novak', 'Abara', 'Castellano', 'Duffy', 'Ibarra', 'Jankowski', 'Kerrigan', 'Malone', 'Nakata', 'Petrakis', 'Quinlan',
  'Rourke', 'Szabo', 'Tolliver', 'Vasquez', 'Whitlock', 'Yilmaz', 'Zelenko', 'Fitch', 'Gallo', 'Hargrove'];
// The trait a driver brings, in plain words (CHIPS holds the full effect text).
const CREW_TRAIT = { stock: 'No particular habits', hothead: 'Hothead', cautious: 'Cautious', daredevil: 'Daredevil', gun_nut: 'Gun nut', veteran: 'Getaway veteran', ghost: 'Ghost', showboat: 'Showboat' };

const Crew = {
  runSeed: 7, // set when a run starts or loads (Proto)

  // Who a given trait's driver is, this run.
  id(trait) {
    trait = trait || 'stock';
    const h = (TV.hash((Crew.runSeed >>> 0) % 100000, [...trait].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0));
    const nicks = CREW_NICKS[trait] || CREW_NICKS.stock;
    const nick = nicks[h % nicks.length], last = CREW_LAST[TV.hash(h % 1000003, 991) % CREW_LAST.length];
    return { trait, nick, last, name: `"${nick}" ${last}`, short: nick, number: String(1000 + ((h >>> 3) % 9000)), seed: (h % 100000) + 17, label: CREW_TRAIT[trait] || trait };
  },
  // The driver in your seat.
  current(b) { return Crew.id(b && b.chip); },
};
