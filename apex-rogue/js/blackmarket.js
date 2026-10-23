'use strict';
// The black market. Some garage visits, there's a tap on the back wall under the chalkboard and a brick slides out:
// a dealer you never see properly (two eyes and a lit cigarette in the dark) selling what the commissary won't.
// Nobody searches you for it. Why would they? You're racing to your death on television.
//
//   Drugs and booze (named for what they are): taken from your pocket at the race briefing. A big edge for that race; most have a comedown
//     the race after.
//   Hot ammo: loaded at the briefing, for every bullet gun in that race.
//   Shady trinkets: permanent, like any trinket, with a real downside. Only he sells them.
// Tolerance: every time you take the same drug or drink in a run it hits a quarter weaker (never below 40%), while
// the comedown stays just as bad. Hot ammo is ammo: it always works.

const CONTRABAND = {
  meth: {
    kind: 'drug', name: 'Methamphetamine', street: 'crank', price: [50, 75],
    flavor: 'Cooked in the prison laundry and cut with God knows what.',
    buff: { reload: 0.7, rate: 0.92, spread: 0.75 }, comedown: { spread: 1.3, reload: 1.15 },
  },
  oxy: {
    kind: 'drug', name: 'Oxycodone', street: 'blues', price: [45, 70],
    flavor: 'Little blue 30s, walked out of the infirmary in a sock.',
    buff: { taken: 0.75 }, comedown: { hull: 15 },
  },
  adrenaline: {
    kind: 'drug', name: 'Adrenaline', street: 'the jolt', price: [40, 65],
    flavor: 'An auto-injector off the infirmary crash cart. Straight into the thigh.',
    buff: { hatch: 2 }, comedown: { hatch: 0.7 },
  },
  cocaine: {
    kind: 'drug', name: 'Cocaine', street: 'snow', price: [55, 85],
    flavor: 'Wrapped in a page torn out of a Bible.',
    buff: { rate: 0.85, cdRate: 1.3 }, comedown: { dmg: 0.9 },
  },
  diazepam: {
    kind: 'drug', name: 'Diazepam', street: 'Valium', price: [35, 55],
    flavor: "A strip from a guard's own prescription. Calm hands, slow hands.",
    buff: { spread: 0.6, reload: 1.2 },
  },
  pruno: {
    kind: 'booze', name: 'Pruno', street: 'prison wine', price: [25, 40],
    flavor: 'Fruit, sugar and ketchup, fermented in a bin bag under a bunk.',
    buff: { dmg: 1.15, drunk: 0.5 },
  },
  whiskey: {
    kind: 'booze', name: 'Spire Whiskey', price: [60, 90],
    flavor: 'The real stuff, smuggled down from the Spire in a laundry cart.',
    buff: { dmg: 1.25, kick: 0.5, drunk: 1 }, comedown: { reload: 1.12 },
  },
  shredder: {
    kind: 'ammo', name: 'Shredder Rounds', price: [55, 85],
    flavor: 'Hollow points packed with razor wire.',
    buff: { tyre: 4, tyreMin: 1.5 },
  },
  hotloads: {
    kind: 'ammo', name: 'Hot Loads', price: [60, 90],
    flavor: "Incendiary rounds out of a guard's locker, red paint on the tips.",
    buff: { burn: 3 },
  },
  blacktips: {
    kind: 'ammo', name: 'Black Tips', price: [65, 95],
    flavor: 'Pre-war armour-piercing, black paint on the tips.',
    buff: { bulletDmg: 1.35 },
  },
};
const CONTRA_RENAMED = { crank: 'meth', bluebirds: 'oxy', jolt: 'adrenaline' }; // older saves

// What a set of effects does, in plain words with the numbers.
function contraFx(fx) {
  const pct = (m) => Math.round(Math.abs(1 - m) * 100) + '%', out = [];
  for (const [k, v] of Object.entries(fx || {})) {
    if (k === 'reload') out.push(v < 1 ? `reloads ${pct(v)} faster` : `reloads ${pct(v)} slower`);
    else if (k === 'rate') out.push(v < 1 ? `fires ${pct(v)} faster` : `fires ${pct(v)} slower`);
    else if (k === 'spread') out.push(v < 1 ? `${pct(v)} tighter aim` : `${pct(v)} shakier aim`);
    else if (k === 'taken') out.push(`${pct(v)} less damage taken`);
    else if (k === 'hatch') out.push(v > 1 ? `hatch ${pct(v)} faster` : `hatch ${pct(v)} slower`);
    else if (k === 'dmg') out.push(v > 1 ? `+${pct(v)} damage` : `-${pct(v)} damage`);
    else if (k === 'bulletDmg') out.push(`bullets +${pct(v)} damage`);
    else if (k === 'kick') out.push(`${pct(v)} less recoil`);
    else if (k === 'drunk') out.push(v >= 1 ? 'the cabin really swims (your aim drifts)' : 'the cabin swims a little');
    else if (k === 'tyre') out.push(`bullets shred tyres (${v}x, even the pistol)`);
    else if (k === 'burn') out.push('bullets set what they hit alight');
    else if (k === 'hull') out.push(`start ${v} hull down`);
    else if (k === 'cdRate') out.push(`abilities recharge ${pct(v)} faster`);
  }
  return out.join(', ');
}
const TOLERANCE = { step: 0.25, floor: 0.4 };
// A card's text: the flavour, then the effect at the strength it would hit you now, and the comedown.
const contraDesc = (c, p = 1) => `${c.flavor} <b>This race:</b> ${contraFx(BlackMarket.scale(c.buff, p))}${p < 1 ? ` <i>(${Math.round(p * 100)}% strength: your tolerance)</i>` : ''}.${c.comedown ? ` <b>Next race:</b> ${contraFx(c.comedown)}.` : ''}`;
const CONTRA_KIND = { drug: 'DRUG', booze: 'BOOZE', ammo: 'HOT AMMO' };
const POCKET_MAX = 5;

const DEALER = {
  chance: 0.4, // per garage visit after a race
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
    const contra = (id) => ({ type: 'contra', id, price: price(CONTRABAND[id].price) });
    stock.push(contra(ids[0]), contra(ids[1]));
    const shady = Object.keys(TRINKETS).filter((id) => TRINKETS[id].shady && !has(b, id));
    if (shady.length && rng() < 0.5) stock.push({ type: 'trinket', id: shady[Math.floor(rng() * shady.length)], price: price(DEALER.trinketPrice) });
    else stock.push(contra(ids[2]));
    return { stock, hello: DEALER.hello[Math.floor(rng() * DEALER.hello.length)] };
  },

  // Everything in effect for this race: what you took, and last race's comedowns. Multipliers multiply; burn and
  // drunkenness take the strongest.
  // How strong a drug or drink still hits you this run, after the times you've already taken it.
  potency(run, id) {
    if (CONTRABAND[id].kind === 'ammo') return 1;
    const n = ((run && run.flags.tolerance) || {})[id] || 0;
    return Math.max(TOLERANCE.floor, 1 - TOLERANCE.step * n);
  },
  // An effect at a given strength: the boosts shrink towards nothing; being drunk and the like stay as they are.
  scale(fx, p) {
    if (p >= 1) return fx;
    const out = {};
    for (const k in fx) out[k] = ['drunk', 'burn', 'tyreMin', 'hull'].includes(k) ? fx[k] : +(1 + (fx[k] - 1) * p).toFixed(3);
    return out;
  },

  // used: contraband ids, or { id, p } with the strength each one hit at.
  buffs(used, comedowns) {
    const B = {};
    const add = (fx) => {
      for (const k in fx) {
        if (k === 'burn' || k === 'drunk' || k === 'tyreMin') B[k] = Math.max(B[k] || 0, fx[k]);
        else if (k === 'hull') B.hull = (B.hull || 0) + fx[k];
        else B[k] = (B[k] || 1) * fx[k];
      }
    };
    for (const u of used) { const id = u.id || u; add(BlackMarket.scale(CONTRABAND[id].buff, u.p == null ? 1 : u.p)); }
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
