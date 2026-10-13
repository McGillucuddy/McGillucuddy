'use strict';
// The black market. Some garage visits, there's a tap on the back wall under the chalkboard and a brick slides out:
// a dealer you never see properly (two eyes and a lit cigarette in the dark) selling what the commissary won't.
// Nobody searches you for it. Why would they? You're racing to your death on television.
//
//   Drugs and booze: taken from your pocket at the race briefing. A big edge for that race; most have a comedown
//     the race after.
//   Hot ammo: loaded at the briefing, for every bullet gun in that race.
//   Shady trinkets: permanent, like any trinket, with a real downside. Only he sells them.
// He's not always honest: now and then a drug or a box of rounds is a dud, and you only find out when you use it.

const CONTRABAND = {
  crank: {
    kind: 'drug', name: 'Crank', price: [50, 75],
    desc: 'Cooked in the laundry. For one race: reloads 30% faster, faster trigger, steadier aim.',
    buff: { reload: 0.7, rate: 0.92, spread: 0.75 }, comedown: { spread: 1.3, reload: 1.15 }, down: 'the shakes (worse aim, slower reloads)',
  },
  bluebirds: {
    kind: 'drug', name: 'Bluebirds', price: [45, 70],
    desc: 'Little blue painkillers from the infirmary. For one race: you take 25% less damage.',
    buff: { taken: 0.75 }, comedown: { hull: 15 }, down: 'you start 15 hull down',
  },
  jolt: {
    kind: 'drug', name: 'Jolt', price: [40, 65],
    desc: 'A syringe of something from the infirmary fridge. For one race: the blast hatch slams and lifts twice as fast.',
    buff: { hatch: 2 }, comedown: { hatch: 0.7 }, down: 'a sluggish hatch',
  },
  pruno: {
    kind: 'booze', name: 'Pruno', price: [25, 40],
    desc: 'Prison wine, fermented in a bin bag under a bunk. For one race: +15% damage, and the cabin swims a little.',
    buff: { dmg: 1.15, drunk: 0.5 },
  },
  whiskey: {
    kind: 'booze', name: 'Spire Whiskey', price: [60, 90],
    desc: 'The real stuff, smuggled down from the Spire. For one race: +25% damage and half the recoil, but the cabin really swims.',
    buff: { dmg: 1.25, kick: 0.5, drunk: 1 }, comedown: { reload: 1.12 }, down: 'a hangover (slower reloads)',
  },
  shredder: {
    kind: 'ammo', name: 'Shredder Rounds', price: [55, 85],
    desc: 'Hollow points packed with wire. For one race your bullets chew tyres: even the pistol pops one in a handful of hits.',
    buff: { tyre: 4, tyreMin: 1.5 },
  },
  hotloads: {
    kind: 'ammo', name: 'Hot Loads', price: [60, 90],
    desc: "Incendiary rounds out of a guard's locker. For one race your bullets set what they hit alight.",
    buff: { burn: 3 },
  },
  blacktips: {
    kind: 'ammo', name: 'Black Tips', price: [65, 95],
    desc: 'Pre-war armour-piercing, black paint on the tips. For one race your bullets hit 35% harder.',
    buff: { bulletDmg: 1.35 },
  },
};
const CONTRA_KIND = { drug: 'DRUG', booze: 'BOOZE', ammo: 'HOT AMMO' };
const POCKET_MAX = 5;

const DEALER = {
  chance: 0.4, // per garage visit after a race
  dud: 0.1, // a drug or a box of rounds that turns out to be nothing
  trinketPrice: [260, 340],
  hello: [
    '"Psst. Down here. Don\'t look at me, look at the wall."',
    '"You\'re the one they keep not killing. Good. Repeat customer."',
    '"Warden takes his cut of everything. Not this."',
    '"Cash only. Scrap, I mean. Same thing in here."',
    '"Quick, before the lights come back on."',
    '"I knew the last driver who sat in that seat. Buy something."',
  ],
};

const BlackMarket = {
  // A new visit: maybe he's there. Three things on the cloth: two pocket goods and a third that's a shady trinket
  // half the time (while there are any you don't have).
  roll(b, rng, act) {
    if (rng() > DEALER.chance) return null;
    const mul = 1 + 0.12 * act, price = (r) => Math.round((r[0] + (r[1] - r[0]) * rng()) * mul / 5) * 5;
    const ids = shuffle(rng, Object.keys(CONTRABAND)), stock = [];
    const contra = (id) => ({ type: 'contra', id, price: price(CONTRABAND[id].price), dud: rng() < DEALER.dud });
    stock.push(contra(ids[0]), contra(ids[1]));
    const shady = Object.keys(TRINKETS).filter((id) => TRINKETS[id].shady && !has(b, id));
    if (shady.length && rng() < 0.5) stock.push({ type: 'trinket', id: shady[Math.floor(rng() * shady.length)], price: price(DEALER.trinketPrice) });
    else stock.push(contra(ids[2]));
    return { stock, hello: DEALER.hello[Math.floor(rng() * DEALER.hello.length)] };
  },

  // Everything in effect for this race: what you took, and last race's comedowns. Multipliers multiply; burn and
  // drunkenness take the strongest.
  buffs(used, comedowns) {
    const B = {};
    const add = (fx) => {
      for (const k in fx) {
        if (k === 'burn' || k === 'drunk' || k === 'tyreMin') B[k] = Math.max(B[k] || 0, fx[k]);
        else if (k === 'hull') B.hull = (B.hull || 0) + fx[k];
        else B[k] = (B[k] || 1) * fx[k];
      }
    };
    for (const id of used) add(CONTRABAND[id].buff);
    for (const id of comedowns) if (CONTRABAND[id] && CONTRABAND[id].comedown) add(CONTRABAND[id].comedown);
    return B;
  },

  // A weapon's stats with this race's contraband on top (called from Combat.weaponDef).
  apply(d, B) {
    if (!B) return d;
    if (B.reload) d.reload *= B.reload;
    if (B.rate) d.rate *= B.rate;
    if (B.spread) d.spread *= B.spread;
    if (B.dmg) d.dmg *= B.dmg;
    if (d.kind === 'bullet') {
      if (B.bulletDmg) d.dmg *= B.bulletDmg;
      if (B.tyre) d.tyre = Math.max((d.tyre == null ? 0.5 : d.tyre) * B.tyre, B.tyreMin || 0);
      if (B.burn) d.burn = Math.max(d.burn || 0, B.burn);
    }
    return d;
  },
};
