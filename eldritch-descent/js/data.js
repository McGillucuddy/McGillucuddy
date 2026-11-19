// ============================================================
//  ELDRITCH DESCENT — content
//  Turn-based: your hero plays a deck; companions act on their own.
// ============================================================
'use strict';

// ---------------- classes ----------------
// rank = where they stand (1 = front). Party order is fixed by class.
const CLASSES = {
  warden:    { name: 'Warden', role: 'Tank', color: '#4a8ad0', rank: 1, hp: 94, compHp: 78,
               blurb: 'A dockside bruiser behind a church-door shield. Soaks blows and drags the horrors\' attention onto himself.' },
  hunter:    { name: 'Hunter', role: 'Damage', color: '#d0503a', rank: 2, hp: 70, compHp: 62,
               blurb: 'Has tracked things through the Pine Barrens no one else came back from. Precise, punishing, can hit any rank.' },
  occultist: { name: 'Occultist', role: 'Caster', color: '#c8a0e8', rank: 3, hp: 62, compHp: 52,
               blurb: 'Reads aloud from books that should have burned. Curses, rifts and words that wound everything at once.' },
  physician: { name: 'Physician', role: 'Healer', color: '#6aa77f', rank: 4, hp: 66, compHp: 56,
               blurb: 'A plague doctor with a satchel of tinctures. Heals, shields, bleeds the enemy dry, and brings back the fallen.' },
};
const CLASS_ORDER = ['warden', 'hunter', 'occultist', 'physician'];
const NAMES = {
  warden: ['Bram Holloway', 'Torvald Kesh', 'Sgt. Merrow', 'Gideon Vale', 'Hester Crane'],
  occultist: ['Isolde Marrow', 'Prof. Quillon', 'Sable Wren', 'Ottilie Vane', 'Lucan Hargrave'],
  physician: ['Dr. Penhallow', 'Dr. Aldous Finch', 'Dr. Ines Corvo', 'Dr. Thackery', 'Dr. Maud Lisle'],
  hunter: ['Wren Ashdown', 'Silas Thorne', 'Edda Quarry', 'Rook Mallory', 'Jessamy Pike'],
};

// ---------------- statuses ----------------
const STATUS = {
  block:  { name: 'Block', icon: 'shield', color: '#9ad0ff', desc: 'Absorbs damage. Lost at the start of its owner\'s turn.' },
  vuln:   { name: 'Vulnerable', icon: 'crack', color: '#d0503a', desc: 'Takes 50% more damage from attacks.', decays: true },
  weak:   { name: 'Weak', icon: 'down', color: '#8d63b0', desc: 'Deals 25% less attack damage.', decays: true },
  str:    { name: 'Strength', icon: 'up', color: '#f0d870', desc: 'Adds to all attack damage.' },
  bleed:  { name: 'Bleed', icon: 'drop', color: '#9a2a24', desc: 'Loses that much health at the start of its turn, then Bleed drops by 1.' },
  stun:   { name: 'Stunned', icon: 'star', color: '#f0d870', desc: 'Skips its next action.' },
  taunt:  { name: 'Taunting', icon: 'roar', color: '#4a8ad0', desc: 'Horrors must aim single-target attacks at this hero.', decays: true },
  thorns: { name: 'Retribution', icon: 'spike', color: '#c3c7cb', desc: 'Deals this much damage back to anything that attacks it.' },
  intangible: { name: 'Phased', icon: 'ghost', color: '#8d63b0', desc: 'Takes at most 1 damage from each hit.', decays: true },
  aim:    { name: 'Steady Aim', icon: 'eye', color: '#f0d870', desc: 'The next attack deals double damage.' },
  // powers (player)
  unbreakable: { name: 'Unbreakable', icon: 'shield', color: '#4a8ad0', desc: 'At the end of your turn, gain this much Block.' },
  juggernaut:  { name: 'Juggernaut', icon: 'spike', color: '#4a8ad0', desc: 'Whenever you gain Block, deal this much damage to a random horror.' },
  insight:     { name: 'Forbidden Knowledge', icon: 'eye', color: '#c8a0e8', desc: 'Draw this many extra cards each turn.' },
  feedrift:    { name: 'Feeding the Rift', icon: 'swirl', color: '#c8a0e8', desc: 'Whenever you play an attack, deal this much damage to every horror.' },
  migo:        { name: 'Flesh Graft', icon: 'up', color: '#c8a0e8', desc: 'Gain this much Strength at the start of each turn.' },
  hospital:    { name: 'Field Hospital', icon: 'cross', color: '#6aa77f', desc: 'At the end of your turn, heal every ally this much.' },
  plague:      { name: 'Plague Doctor', icon: 'drop', color: '#6aa77f', desc: 'Whenever a horror takes Bleed damage, heal the most wounded ally this much.' },
  predator:    { name: 'Predator', icon: 'eye', color: '#d0503a', desc: 'Your attacks deal this much more to Vulnerable horrors.' },
  deadeye:     { name: 'Deadeye', icon: 'eye', color: '#d0503a', desc: 'Your first attack each turn deals double damage.' },
};

// ---------------- cards ----------------
// vals: {k: [base, upgraded]}. text uses {k}. target: enemy | front | all | ally | fallen | self | none
const CARDS = {
  // ===== WARDEN =====
  w_strike:   { cls: 'warden', name: 'Club', type: 'attack', cost: 1, rarity: 'starter', target: 'front', vals: { d: [6, 9] }, text: 'Deal {d} damage to a front horror.', play: (g, V, t) => g.attack(g.player, t, V.d) },
  w_defend:   { cls: 'warden', name: 'Brace', type: 'skill', cost: 1, rarity: 'starter', target: 'self', vals: { b: [6, 9] }, text: 'Gain {b} Block.', play: (g, V) => g.addBlock(g.player, V.b) },
  w_guard:    { cls: 'warden', name: 'Guard', type: 'skill', cost: 1, rarity: 'starter', target: 'ally', vals: { b: [6, 9] }, text: 'Give an ally {b} Block.', play: (g, V, t) => g.addBlock(t, V.b) },
  w_roar:     { cls: 'warden', name: 'Challenging Roar', type: 'skill', cost: 1, rarity: 'starter', target: 'self', vals: { b: [4, 7] }, text: 'Taunt this round. Gain {b} Block.', play: (g, V) => { g.taunt(g.player); g.addBlock(g.player, V.b); } },
  w_cleave:   { cls: 'warden', name: 'Cleave', type: 'attack', cost: 1, rarity: 'common', target: 'none', vals: { d: [8, 11] }, text: 'Deal {d} damage to both front horrors.', play: (g, V) => g.front().forEach(f => g.attack(g.player, f, V.d)) },
  w_bash:     { cls: 'warden', name: 'Shield Bash', type: 'attack', cost: [1, 0], rarity: 'common', target: 'front', vals: {}, text: 'Deal damage equal to your Block to a front horror.', play: (g, V, t) => g.attack(g.player, t, g.player.st.block || 0, { noStr: true }) },
  w_bulwark:  { cls: 'warden', name: 'Bulwark', type: 'skill', cost: 2, rarity: 'common', target: 'none', vals: { b: [12, 15], a: [4, 6] }, text: 'Gain {b} Block. Every ally gains {a} Block.', play: (g, V) => { g.addBlock(g.player, V.b); g.allies().forEach(h => h !== g.player && g.addBlock(h, V.a)); } },
  w_lesson:   { cls: 'warden', name: 'Iron Lesson', type: 'attack', cost: 1, rarity: 'common', target: 'front', vals: { d: [7, 9], w: [1, 2] }, text: 'Deal {d} damage. Apply {w} Weak.', play: (g, V, t) => { g.attack(g.player, t, V.d); g.apply(t, 'weak', V.w); } },
  w_rally:    { cls: 'warden', name: 'Rally', type: 'skill', cost: 0, rarity: 'common', target: 'none', vals: { b: [3, 5] }, text: 'Every hero gains {b} Block.', play: (g, V) => g.allies().forEach(h => g.addBlock(h, V.b)) },
  w_hold:     { cls: 'warden', name: 'Hold the Line', type: 'skill', cost: 1, rarity: 'common', target: 'self', vals: { b: [7, 10] }, text: 'Gain {b} Block. Taunt this round.', play: (g, V) => { g.addBlock(g.player, V.b); g.taunt(g.player); } },
  w_unbreak:  { cls: 'warden', name: 'Unbreakable', type: 'power', cost: [2, 1], rarity: 'uncommon', target: 'self', vals: { b: [3, 3] }, text: 'At the end of each turn, gain {b} Block.', play: (g, V) => g.apply(g.player, 'unbreakable', V.b) },
  w_retrib:   { cls: 'warden', name: 'Retribution', type: 'power', cost: 1, rarity: 'uncommon', target: 'self', vals: { t: [3, 5] }, text: 'Whenever a horror attacks you, deal {t} damage back.', play: (g, V) => g.apply(g.player, 'thorns', V.t) },
  w_charge:   { cls: 'warden', name: 'Charge', type: 'attack', cost: 1, rarity: 'uncommon', target: 'enemy', vals: { d: [9, 13] }, exhaust: true, text: 'Deal {d} damage to any horror and Stun it. Exhaust.', play: (g, V, t) => { g.attack(g.player, t, V.d); g.apply(t, 'stun', 1); } },
  w_wind:     { cls: 'warden', name: 'Second Wind', type: 'skill', cost: 1, rarity: 'uncommon', target: 'self', vals: { h: [6, 9], b: [6, 9] }, text: 'Heal {h}. Gain {b} Block.', play: (g, V) => { g.heal(g.player, V.h); g.addBlock(g.player, V.b); } },
  w_bodyblock:{ cls: 'warden', name: 'Body Block', type: 'skill', cost: 1, rarity: 'uncommon', target: 'ally', vals: { b: [5, 9] }, text: 'Taunt this round. You and an ally each gain {b} Block.', play: (g, V, t) => { g.taunt(g.player); g.addBlock(g.player, V.b); if (t !== g.player) g.addBlock(t, V.b); } },
  w_jugg:     { cls: 'warden', name: 'Juggernaut', type: 'power', cost: [3, 2], rarity: 'rare', target: 'self', vals: { d: [3, 3] }, text: 'Whenever you gain Block, deal {d} damage to a random horror.', play: (g, V) => g.apply(g.player, 'juggernaut', V.d) },
  w_last:     { cls: 'warden', name: 'Last Stand', type: 'skill', cost: [2, 1], rarity: 'rare', target: 'self', vals: {}, exhaust: true, text: 'Gain Block equal to your missing health. Exhaust.', play: (g) => g.addBlock(g.player, g.player.maxHp - g.player.hp) },
  w_venge:    { cls: 'warden', name: 'Vengeance', type: 'attack', cost: 1, rarity: 'rare', target: 'front', vals: { d: [5, 7] }, text: 'Deal {d} damage for each horror intending to attack you.', play: (g, V, t) => { const n = g.foes.filter(f => g.intentHits(f, g.player)).length; g.attack(g.player, t, V.d * Math.max(1, n)); } },

  // ===== HUNTER =====
  h_strike:   { cls: 'hunter', name: 'Rifle Shot', type: 'attack', cost: 1, rarity: 'starter', target: 'enemy', vals: { d: [6, 9] }, text: 'Deal {d} damage to any horror.', play: (g, V, t) => g.attack(g.player, t, V.d) },
  h_defend:   { cls: 'hunter', name: 'Take Cover', type: 'skill', cost: 1, rarity: 'starter', target: 'self', vals: { b: [5, 8] }, text: 'Gain {b} Block.', play: (g, V) => g.addBlock(g.player, V.b) },
  h_volley:   { cls: 'hunter', name: 'Volley', type: 'attack', cost: 1, rarity: 'starter', target: 'none', vals: { d: [3, 4] }, text: 'Deal {d} damage to a random horror 3 times.', play: (g, V) => { for (let i = 0; i < 3; i++) g.attack(g.player, g.randomFoe(), V.d); } },
  h_mark:     { cls: 'hunter', name: 'Mark Prey', type: 'skill', cost: 0, rarity: 'starter', target: 'enemy', vals: { v: [2, 3] }, text: 'Apply {v} Vulnerable. Draw 1 card.', play: (g, V, t) => { g.apply(t, 'vuln', V.v); g.draw(1); } },
  h_double:   { cls: 'hunter', name: 'Double Tap', type: 'attack', cost: 1, rarity: 'common', target: 'enemy', vals: { d: [5, 7] }, text: 'Deal {d} damage twice.', play: (g, V, t) => { g.attack(g.player, t, V.d); g.attack(g.player, t, V.d); } },
  h_trap:     { cls: 'hunter', name: 'Bear Trap', type: 'attack', cost: 2, rarity: 'common', target: 'front', vals: { d: [6, 9] }, text: 'Deal {d} damage to a front horror and Stun it.', play: (g, V, t) => { g.attack(g.player, t, V.d); g.apply(t, 'stun', 1); } },
  h_aim:      { cls: 'hunter', name: 'Steady Aim', type: 'skill', cost: [1, 0], rarity: 'common', target: 'self', vals: {}, text: 'Your next attack deals double damage.', play: (g) => g.apply(g.player, 'aim', 1) },
  h_instinct: { cls: 'hunter', name: 'Hunter\'s Instinct', type: 'attack', cost: 1, rarity: 'common', target: 'enemy', vals: { d: [6, 9] }, text: 'Deal {d} damage. If it is Vulnerable, draw 2.', play: (g, V, t) => { const v = t.st.vuln > 0; g.attack(g.player, t, V.d); if (v) g.draw(2); } },
  h_scatter:  { cls: 'hunter', name: 'Scatter Shot', type: 'attack', cost: 2, rarity: 'common', target: 'none', vals: { d: [7, 10] }, text: 'Deal {d} damage to every horror.', play: (g, V) => g.foes.slice().forEach(f => g.attack(g.player, f, V.d)) },
  h_roll:     { cls: 'hunter', name: 'Dodge Roll', type: 'skill', cost: 1, rarity: 'common', target: 'self', vals: { b: [8, 11] }, text: 'Gain {b} Block. Draw 1 card.', play: (g, V) => { g.addBlock(g.player, V.b); g.draw(1); } },
  h_silver:   { cls: 'hunter', name: 'Silver Round', type: 'attack', cost: 2, rarity: 'uncommon', target: 'enemy', vals: { d: [20, 28] }, text: 'Deal {d} damage. Ignores Block.', play: (g, V, t) => g.attack(g.player, t, V.d, { pierce: true }) },
  h_predator: { cls: 'hunter', name: 'Predator', type: 'power', cost: 1, rarity: 'uncommon', target: 'self', vals: { p: [3, 5] }, text: 'Your attacks deal {p} more damage to Vulnerable horrors.', play: (g, V) => g.apply(g.player, 'predator', V.p) },
  h_reload:   { cls: 'hunter', name: 'Reload', type: 'skill', cost: 0, rarity: 'uncommon', target: 'none', vals: { c: [2, 3] }, text: 'Draw {c} cards.', play: (g, V) => g.draw(V.c) },
  h_hamstring:{ cls: 'hunter', name: 'Hamstring', type: 'attack', cost: 1, rarity: 'uncommon', target: 'enemy', vals: { d: [8, 11], w: [2, 3] }, text: 'Deal {d} damage. Apply {w} Weak.', play: (g, V, t) => { g.attack(g.player, t, V.d); g.apply(t, 'weak', V.w); } },
  h_cover:    { cls: 'hunter', name: 'Covering Fire', type: 'attack', cost: 1, rarity: 'uncommon', target: 'enemy', vals: { d: [5, 7], b: [6, 8] }, text: 'Deal {d} damage. The most threatened ally gains {b} Block.', play: (g, V, t) => { g.attack(g.player, t, V.d); g.addBlock(g.mostThreatened(), V.b); } },
  h_deadeye:  { cls: 'hunter', name: 'Deadeye', type: 'power', cost: [2, 1], rarity: 'rare', target: 'self', vals: {}, text: 'Your first attack each turn deals double damage.', play: (g) => g.apply(g.player, 'deadeye', 1) },
  h_hunt:     { cls: 'hunter', name: 'Hunt the Hunters', type: 'attack', cost: 2, rarity: 'rare', target: 'none', vals: { d: [6, 8] }, text: 'Deal {d} damage to every horror, twice.', play: (g, V) => { for (let i = 0; i < 2; i++) g.foes.slice().forEach(f => g.attack(g.player, f, V.d)); } },
  h_final:    { cls: 'hunter', name: 'The Last Bullet', type: 'attack', cost: 1, rarity: 'rare', target: 'enemy', vals: { d: [36, 50] }, exhaust: true, text: 'Deal {d} damage. Exhaust.', play: (g, V, t) => g.attack(g.player, t, V.d) },

  // ===== OCCULTIST =====
  o_strike:   { cls: 'occultist', name: 'Eldritch Bolt', type: 'attack', cost: 1, rarity: 'starter', target: 'enemy', vals: { d: [6, 9] }, text: 'Deal {d} damage to any horror.', play: (g, V, t) => g.attack(g.player, t, V.d) },
  o_defend:   { cls: 'occultist', name: 'Ward', type: 'skill', cost: 1, rarity: 'starter', target: 'self', vals: { b: [5, 8] }, text: 'Gain {b} Block.', play: (g, V) => g.addBlock(g.player, V.b) },
  o_blast:    { cls: 'occultist', name: 'Mind Blast', type: 'attack', cost: 2, rarity: 'starter', target: 'enemy', vals: { d: [9, 12], v: [2, 3] }, text: 'Deal {d} damage. Apply {v} Vulnerable.', play: (g, V, t) => { g.attack(g.player, t, V.d); g.apply(t, 'vuln', V.v); } },
  o_whisper:  { cls: 'occultist', name: 'Whisper', type: 'skill', cost: 1, rarity: 'starter', target: 'none', vals: { w: [1, 2] }, text: 'Apply {w} Weak to every horror.', play: (g, V) => g.foes.forEach(f => g.apply(f, 'weak', V.w)) },
  o_rift:     { cls: 'occultist', name: 'Void Rift', type: 'attack', cost: 1, rarity: 'common', target: 'none', vals: { d: [4, 6] }, text: 'Deal {d} damage to every horror.', play: (g, V) => g.foes.slice().forEach(f => g.attack(g.player, f, V.d)) },
  o_glimpse:  { cls: 'occultist', name: 'Glimpse Beyond', type: 'skill', cost: 0, rarity: 'common', target: 'none', vals: { c: [2, 3] }, text: 'Lose 2 health. Draw {c} cards.', play: (g, V) => { g.loseHp(g.player, 2); g.draw(V.c); } },
  o_hex:      { cls: 'occultist', name: 'Hex', type: 'skill', cost: 1, rarity: 'common', target: 'enemy', vals: { v: [2, 3] }, text: 'Apply {v} Vulnerable and {v} Weak.', play: (g, V, t) => { g.apply(t, 'vuln', V.v); g.apply(t, 'weak', V.v); } },
  o_lash:     { cls: 'occultist', name: 'Shadow Lash', type: 'attack', cost: 1, rarity: 'common', target: 'enemy', vals: { d: [5, 7] }, text: 'Deal {d} damage twice.', play: (g, V, t) => { g.attack(g.player, t, V.d); g.attack(g.player, t, V.d); } },
  o_barrier:  { cls: 'occultist', name: 'Dark Barrier', type: 'skill', cost: 1, rarity: 'common', target: 'self', vals: { b: [8, 11] }, text: 'Gain {b} Block. Apply 1 Weak to a random horror.', play: (g, V) => { g.addBlock(g.player, V.b); const f = g.randomFoe(); if (f) g.apply(f, 'weak', 1); } },
  o_pact:     { cls: 'occultist', name: 'Blood Pact', type: 'skill', cost: 0, rarity: 'common', target: 'none', vals: { l: [4, 3] }, text: 'Lose {l} health. Gain 2 energy.', play: (g, V) => { g.loseHp(g.player, V.l); g.energy += 2; } },
  o_word:     { cls: 'occultist', name: 'Unspeakable Word', type: 'attack', cost: 2, rarity: 'uncommon', target: 'none', vals: { d: [13, 18] }, exhaust: true, text: 'Deal {d} damage to every horror. Exhaust.', play: (g, V) => g.foes.slice().forEach(f => g.attack(g.player, f, V.d)) },
  o_insight:  { cls: 'occultist', name: 'Forbidden Knowledge', type: 'power', cost: [1, 0], rarity: 'uncommon', target: 'self', vals: {}, text: 'Draw 1 extra card each turn.', play: (g) => g.apply(g.player, 'insight', 1) },
  o_madness:  { cls: 'occultist', name: 'Madness', type: 'skill', cost: [1, 0], rarity: 'uncommon', target: 'enemy', vals: {}, exhaust: true, text: 'Stun a horror. Exhaust.', play: (g, V, t) => g.apply(t, 'stun', 1) },
  o_siphon:   { cls: 'occultist', name: 'Siphon', type: 'attack', cost: 1, rarity: 'uncommon', target: 'enemy', vals: { d: [7, 10], h: [4, 6] }, text: 'Deal {d} damage. Heal the most wounded ally {h}.', play: (g, V, t) => { g.attack(g.player, t, V.d); g.heal(g.mostWounded(), V.h); } },
  o_feed:     { cls: 'occultist', name: 'Feeding the Rift', type: 'power', cost: 2, rarity: 'uncommon', target: 'self', vals: { d: [2, 3] }, text: 'Whenever you play an attack, deal {d} damage to every horror.', play: (g, V) => g.apply(g.player, 'feedrift', V.d) },
  o_call:     { cls: 'occultist', name: 'Call the Outer Dark', type: 'attack', cost: 3, rarity: 'rare', target: 'enemy', vals: { d: [30, 40] }, text: 'Deal {d} damage.', play: (g, V, t) => g.attack(g.player, t, V.d) },
  o_migo:     { cls: 'occultist', name: 'Flesh Graft', type: 'power', cost: [2, 1], rarity: 'rare', target: 'self', vals: {}, text: 'Gain 1 Strength at the start of each turn.', play: (g) => g.apply(g.player, 'migo', 1) },
  o_dream:    { cls: 'occultist', name: 'Drowning Dream', type: 'skill', cost: [2, 1], rarity: 'rare', target: 'none', vals: {}, exhaust: true, text: 'Apply 3 Vulnerable and 3 Weak to every horror. Exhaust.', play: (g) => g.foes.forEach(f => { g.apply(f, 'vuln', 3); g.apply(f, 'weak', 3); }) },

  // ===== PHYSICIAN =====
  p_strike:   { cls: 'physician', name: 'Laudanum Dart', type: 'attack', cost: 1, rarity: 'starter', target: 'enemy', vals: { d: [4, 6], b: [2, 3] }, text: 'Deal {d} damage. Apply {b} Bleed.', play: (g, V, t) => { g.attack(g.player, t, V.d); g.apply(t, 'bleed', V.b); } },
  p_splint:   { cls: 'physician', name: 'Splint', type: 'skill', cost: 1, rarity: 'starter', target: 'ally', vals: { b: [5, 8] }, text: 'Give an ally {b} Block.', play: (g, V, t) => g.addBlock(t, V.b) },
  p_tonic:    { cls: 'physician', name: 'Tonic', type: 'skill', cost: 1, rarity: 'starter', target: 'ally', vals: { h: [6, 9] }, text: 'Heal an ally {h}.', play: (g, V, t) => g.heal(t, V.h) },
  p_salts:    { cls: 'physician', name: 'Smelling Salts', type: 'skill', cost: 1, rarity: 'starter', target: 'none', vals: { h: [8, 12] }, exhaust: true, text: 'Revive every fallen ally at 30% health. If none fell, heal everyone {h}. Exhaust.', play: (g, V) => { const f = g.heroes.filter(h => h.dead); if (f.length) f.forEach(h => g.revive(h, 0.3)); else g.allies().forEach(h => g.heal(h, V.h)); } },
  p_leech:    { cls: 'physician', name: 'Leeches', type: 'skill', cost: 1, rarity: 'common', target: 'enemy', vals: { b: [6, 9] }, text: 'Apply {b} Bleed.', play: (g, V, t) => g.apply(t, 'bleed', V.b) },
  p_triage:   { cls: 'physician', name: 'Triage', type: 'skill', cost: 1, rarity: 'common', target: 'none', vals: { h: [9, 13] }, text: 'Heal the most wounded ally {h}.', play: (g, V) => g.heal(g.mostWounded(), V.h) },
  p_sanct:    { cls: 'physician', name: 'Sanctuary', type: 'skill', cost: 2, rarity: 'common', target: 'none', vals: { b: [6, 8], h: [2, 3] }, text: 'Every ally gains {b} Block and heals {h}.', play: (g, V) => g.allies().forEach(h => { g.addBlock(h, V.b); g.heal(h, V.h); }) },
  p_scalpel:  { cls: 'physician', name: 'Scalpel', type: 'attack', cost: 0, rarity: 'common', target: 'front', vals: { d: [4, 6] }, text: 'Deal {d} damage to a front horror.', play: (g, V, t) => g.attack(g.player, t, V.d) },
  p_laud:     { cls: 'physician', name: 'Laudanum', type: 'skill', cost: 1, rarity: 'common', target: 'ally', vals: { b: [6, 9] }, text: 'An ally loses Weak and Vulnerable and gains {b} Block.', play: (g, V, t) => { t.st.weak = 0; t.st.vuln = 0; g.addBlock(t, V.b); } },
  p_hemlock:  { cls: 'physician', name: 'Hemlock', type: 'skill', cost: 1, rarity: 'common', target: 'none', vals: { b: [3, 5] }, text: 'Apply {b} Bleed to every horror.', play: (g, V) => g.foes.forEach(f => g.apply(f, 'bleed', V.b)) },
  p_transf:   { cls: 'physician', name: 'Transfusion', type: 'skill', cost: 1, rarity: 'uncommon', target: 'ally', vals: { h: [12, 16] }, text: 'Lose 5 health. Heal an ally {h}.', play: (g, V, t) => { g.loseHp(g.player, 5); g.heal(t, V.h); } },
  p_hospital: { cls: 'physician', name: 'Field Hospital', type: 'power', cost: 2, rarity: 'uncommon', target: 'self', vals: { h: [2, 3] }, text: 'At the end of each turn, heal every ally {h}.', play: (g, V) => g.apply(g.player, 'hospital', V.h) },
  p_contagion:{ cls: 'physician', name: 'Contagion', type: 'skill', cost: [1, 0], rarity: 'uncommon', target: 'enemy', vals: {}, text: 'Double a horror\'s Bleed.', play: (g, V, t) => g.apply(t, 'bleed', t.st.bleed || 0) },
  p_adren:    { cls: 'physician', name: 'Adrenaline', type: 'skill', cost: 0, rarity: 'uncommon', target: 'none', vals: { e: [1, 2] }, exhaust: true, text: 'Gain {e} energy. Draw 2 cards. Exhaust.', play: (g, V) => { g.energy += V.e; g.draw(2); } },
  p_anatomy:  { cls: 'physician', name: 'Anatomy Lesson', type: 'skill', cost: 1, rarity: 'uncommon', target: 'enemy', vals: { v: [3, 4] }, text: 'Apply {v} Vulnerable. Draw 1 card.', play: (g, V, t) => { g.apply(t, 'vuln', V.v); g.draw(1); } },
  p_lazarus:  { cls: 'physician', name: 'Lazarus Draught', type: 'skill', cost: [2, 1], rarity: 'rare', target: 'none', vals: {}, exhaust: true, text: 'Revive every fallen ally at 50% health. Heal everyone 6. Exhaust.', play: (g) => { g.heroes.filter(h => h.dead).forEach(h => g.revive(h, 0.5)); g.allies().forEach(h => g.heal(h, 6)); } },
  p_plague:   { cls: 'physician', name: 'Plague Doctor', type: 'power', cost: [2, 1], rarity: 'rare', target: 'self', vals: {}, text: 'Whenever a horror takes Bleed damage, heal the most wounded ally 1.', play: (g) => g.apply(g.player, 'plague', 1) },
  p_bloodlet: { cls: 'physician', name: 'Bloodletting', type: 'attack', cost: 1, rarity: 'rare', target: 'enemy', vals: { m: [2, 3] }, text: 'Deal damage equal to the horror\'s Bleed × {m}.', play: (g, V, t) => g.attack(g.player, t, (t.st.bleed || 0) * V.m, { noStr: true }) },

  // ===== neutral (events & shrines) =====
  n_elder:    { cls: 'neutral', name: 'Warding Sigil', type: 'skill', cost: 1, rarity: 'rare', target: 'none', vals: { b: [10, 14] }, exhaust: true, text: 'Every ally gains {b} Block. Exhaust.', play: (g, V) => g.allies().forEach(h => g.addBlock(h, V.b)) },
  n_silver:   { cls: 'neutral', name: 'Skeleton Key', type: 'skill', cost: 0, rarity: 'rare', target: 'none', vals: { c: [2, 3] }, exhaust: true, text: 'Gain 1 energy. Draw {c} cards. Exhaust.', play: (g, V) => { g.energy++; g.draw(V.c); } },
  n_dread:    { cls: 'curse', name: 'Dread', type: 'curse', cost: -1, rarity: 'curse', target: 'none', vals: {}, text: 'Unplayable. A thought you cannot stop thinking.', play: () => {} },
};
for (const [id, c] of Object.entries(CARDS)) c.id = id;
const STARTER = {
  warden: ['w_strike', 'w_strike', 'w_strike', 'w_strike', 'w_defend', 'w_defend', 'w_defend', 'w_defend', 'w_wind', 'w_roar'],
  hunter: ['h_strike', 'h_strike', 'h_strike', 'h_strike', 'h_defend', 'h_defend', 'h_defend', 'h_defend', 'h_volley', 'h_mark'],
  occultist: ['o_strike', 'o_strike', 'o_strike', 'o_strike', 'o_defend', 'o_defend', 'o_defend', 'o_defend', 'o_blast', 'o_whisper'],
  physician: ['p_strike', 'p_strike', 'p_strike', 'p_strike', 'p_splint', 'p_splint', 'p_splint', 'p_tonic', 'p_tonic', 'p_salts'],
};

// ---------------- companions: what each class does when the AI runs it ----------------
// Each skill: pick(g, h) → target or null if not useful; act(g, h, t). Scaled by floor.
const COMPANION = {
  warden: [
    { id: 'roar', name: 'Challenging Roar', icon: 'roar', cd: 2, pick: (g, h) => g.foes.some(f => g.intentHits(f) && !g.intentHits(f, h)) ? h : null, act: (g, h) => { g.taunt(h); g.addBlock(h, g.cs(6)); }, show: (g) => `Taunt, +${g.cs(6)} Block` },
    { id: 'guard', name: 'Shield Ally', icon: 'shield', cd: 1, pick: (g, h) => { const t = g.mostThreatened(h); return t && t !== h && g.incoming(t) >= 6 ? t : null; }, act: (g, h, t) => g.addBlock(t, g.cs(8)), show: (g) => `+${g.cs(8)} Block` },
    { id: 'club', name: 'Club', icon: 'sword', cd: 0, pick: (g) => g.front()[0] || null, act: (g, h, t) => g.attack(h, t, g.cs(7)), show: (g) => `${g.cs(7)}` },
  ],
  hunter: [
    { id: 'mark', name: 'Mark Prey', icon: 'eye', cd: 3, pick: (g) => g.foes.find(f => f.boss || f.elite) || (g.foes.length >= 2 ? g.toughestFoe() : null), act: (g, h, t) => { g.apply(t, 'vuln', 2); g.attack(h, t, g.cs(4)); }, show: (g) => `${g.cs(4)} + Vulnerable` },
    { id: 'volley', name: 'Volley', icon: 'sword', cd: 2, pick: (g) => g.foes.length >= 2 ? g.foes[0] : null, act: (g, h) => { for (let i = 0; i < 3; i++) g.attack(h, g.randomFoe(), g.cs(4)); }, show: (g) => `${g.cs(4)}×3 random` },
    { id: 'shot', name: 'Rifle Shot', icon: 'sword', cd: 0, pick: (g) => g.weakestFoe(), act: (g, h, t) => g.attack(h, t, g.cs(9)), show: (g) => `${g.cs(9)}` },
  ],
  occultist: [
    { id: 'rift', name: 'Void Rift', icon: 'swirl', cd: 2, pick: (g) => g.foes.length >= 2 ? g.foes[0] : null, act: (g, h) => g.foes.slice().forEach(f => { g.attack(h, f, g.cs(5)); g.apply(f, 'weak', 1); }), show: (g) => `${g.cs(5)} to all + Weak` },
    { id: 'blast', name: 'Mind Blast', icon: 'sword', cd: 2, pick: (g) => g.toughestFoe(), act: (g, h, t) => { g.attack(h, t, g.cs(11)); g.apply(t, 'vuln', 2); }, show: (g) => `${g.cs(11)} + Vulnerable` },
    { id: 'bolt', name: 'Eldritch Bolt', icon: 'sword', cd: 0, pick: (g) => g.weakestFoe(), act: (g, h, t) => g.attack(h, t, g.cs(8)), show: (g) => `${g.cs(8)}` },
  ],
  physician: [
    { id: 'revive', name: 'Smelling Salts', icon: 'cross', cd: 3, pick: (g) => g.heroes.find(x => x.dead && !x.player) || null, act: (g, h, t) => g.revive(t, 0.35), show: () => 'Revive' },
    { id: 'sanct', name: 'Sanctuary', icon: 'shield', cd: 2, pick: (g, h) => g.allies().filter(x => g.incoming(x) >= 5).length >= 2 || g.foes.some(f => f.intent && f.intent.all) ? h : null, act: (g, h) => g.allies().forEach(x => { g.addBlock(x, g.cs(5)); g.heal(x, g.cs(2)); }), show: (g) => `All +${g.cs(5)} Block` },
    { id: 'mend', name: 'Mend', icon: 'cross', cd: 0, pick: (g) => { const t = g.mostWounded(); return t && t.hp < t.maxHp * 0.75 ? t : null; }, act: (g, h, t) => g.heal(t, g.cs(10)), show: (g) => `Heal ${g.cs(10)}` },
    { id: 'dart', name: 'Laudanum Dart', icon: 'sword', cd: 0, pick: (g) => g.weakestFoe(), act: (g, h, t) => { g.attack(h, t, g.cs(4)); g.apply(t, 'bleed', 2); }, show: (g) => `${g.cs(4)} + Bleed` },
  ],
};

// ---------------- foes ----------------
// moves: kind attack|block|buff|debuff|summon|charge ; tgt melee|ranged|all|lowest|back|random|front2|self
const FOES = {
  cultist:    { name: 'Chanter', size: 10, hp: [18, 22], desc: 'Robed townsfolk who sing to the water. Their chanting makes every horror stronger.',
                moves: { chant: { kind: 'buff', name: 'Dark Chant', str: 1, allFoes: true }, bolt: { kind: 'attack', name: 'Blood Bolt', dmg: 6, tgt: 'ranged' } },
                pattern: ['chant', 'bolt', 'bolt', '*'] },
  ghoul:      { name: 'Gravegnawer', size: 9, hp: [14, 17], desc: 'Gaunt, fast and hungry. Gnaws twice.',
                moves: { gnaw: { kind: 'attack', name: 'Gnaw', dmg: 3, hits: 2, tgt: 'melee' }, feast: { kind: 'attack', name: 'Feast', dmg: 4, tgt: 'melee', bleed: 2 } }, pattern: ['*'] },
  deepone:    { name: 'Fathomkin', size: 12, hp: [34, 39], desc: 'Scaled things that walked up out of the harbor. Heavy claws; braces behind its hide.',
                moves: { claw: { kind: 'attack', name: 'Webbed Claw', dmg: 10, tgt: 'melee' }, brace: { kind: 'block', name: 'Scaled Brace', block: 9 } }, pattern: ['claw', 'claw', 'brace'] },
  nightgaunt: { name: 'Hushwing', size: 11, hp: [22, 26], desc: 'A faceless, silent flyer. Swoops on anyone, wherever they stand, and its silence saps the will.',
                moves: { swoop: { kind: 'attack', name: 'Swoop', dmg: 7, tgt: 'random' }, terrify: { kind: 'attack', name: 'Faceless Terror', dmg: 3, tgt: 'random', weak: 2 } }, pattern: ['*'] },
  migo:       { name: 'Sporeshell', size: 11, hp: [28, 32], desc: 'A fungal crustacean that fires a ray leaving you exposed, then hides in its shell.',
                moves: { ray: { kind: 'attack', name: 'Brain Ray', dmg: 6, tgt: 'ranged', vuln: 1 }, shell: { kind: 'block', name: 'Carapace', block: 10 } }, pattern: ['ray', 'shell', 'ray', '*'] },
  byakhee:    { name: 'Rotwing', size: 12, hp: [24, 28], desc: 'A rotting glider that dives at the back line. Its shriek hits everyone.',
                moves: { dive: { kind: 'attack', name: 'Dive', dmg: 4, hits: 2, tgt: 'back' }, shriek: { kind: 'attack', name: 'Shriek', dmg: 3, tgt: 'all' } }, pattern: ['dive', 'shriek', '*'] },
  shambler:   { name: 'Slipstalker', size: 12, hp: [40, 45], desc: 'Steps out of the world, then reappears behind your back rank.',
                moves: { phase: { kind: 'buff', name: 'Step Between', intangible: 1 }, ambush: { kind: 'attack', name: 'Ambush', dmg: 14, tgt: 'back' } }, pattern: ['phase', 'ambush'] },
  hound:      { name: 'Rift Hound', size: 12, hp: [34, 38], desc: 'Ignores rank and hunts the weakest. Taunt it off them.',
                moves: { lunge: { kind: 'attack', name: 'Angled Lunge', dmg: 10, tgt: 'lowest', bleed: 2 }, stalk: { kind: 'buff', name: 'Stalk', str: 2, block: 6 } }, pattern: ['lunge', 'lunge', 'stalk'] },
  proto:      { name: 'Mawling', size: 10, hp: [12, 15], desc: 'A torn-off scrap of a Mawmass, still hungry.', moves: { engulf: { kind: 'attack', name: 'Engulf', dmg: 5, tgt: 'melee' } }, pattern: ['engulf'] },
  mask:       { name: 'Hollow Mask', art: 'mask', size: 14, hp: [20, 24], desc: 'One of the King\'s hundred faces. Shields its master.',
                moves: { mock: { kind: 'attack', name: 'Mock', dmg: 4, tgt: 'random' }, veil: { kind: 'block', name: 'Veil the Master', block: 8, toBoss: true } }, pattern: ['veil', 'mock'] },
  // ---- elites ----
  shoggoth:   { name: 'Mawmass', size: 19, hp: [120, 130], elite: true, desc: 'ELITE. A heaving mass of eyes and mouths. Crushes the front rank, reforms its flesh, and splits apart when it dies.',
                moves: { crush: { kind: 'attack', name: 'Crush', dmg: 9, tgt: 'front2' }, reform: { kind: 'block', name: 'Reform', block: 10, heal: 12 }, tekeli: { kind: 'attack', name: 'Gurgling Lunge', dmg: 17, tgt: 'melee' } },
                pattern: ['crush', 'tekeli', 'reform'], split: 2 },
  starspawn:  { name: 'Tidebrute', size: 22, hp: [140, 150], elite: true, desc: 'ELITE. A hulking spawn of the deep whose presence weakens everyone. Crushes, then sweeps the whole party.',
                moves: { presence: { kind: 'debuff', name: 'Dread Presence', dmg: 4, tgt: 'all', weak: 1 }, crush: { kind: 'attack', name: 'Crush', dmg: 20, tgt: 'melee' }, sweep: { kind: 'attack', name: 'Sweep', dmg: 8, tgt: 'all' } },
                pattern: ['presence', 'crush', 'sweep'] },
  // ---- bosses ----
  dagon:      { name: 'The Tide Patriarch', size: 27, hp: [280, 280], boss: true, desc: 'Crowned lord of the Fathomkin. Sweeps the whole party, crushes one of you with the tide, and calls his children.' },
  nyarlathotep:{ name: 'The Hollow King', size: 25, hp: [360, 360], boss: true, desc: 'An empty robe behind a hundred porcelain faces. Hides behind them, whispers madness, and strikes from anywhere.' },
  cthulhu:    { name: 'The Drowned God', size: 36, hp: [520, 520], boss: true, desc: 'When he begins to dream, count the turns. When the Dreaming breaks, only Block will save you.' },
};

// ---------------- floors & encounters ----------------
const FLOORS = [
  { name: 'Brinehollow Docks', sub: 'The tide has gone out. Something walked in with it.', theme: 'docks', boss: 'dagon', scale: 1, dmg: 1,
    easy: [['cultist', 'ghoul'], ['ghoul', 'ghoul'], ['deepone']],
    normal: [['cultist', 'cultist', 'ghoul'], ['ghoul', 'ghoul', 'ghoul'], ['deepone', 'cultist'], ['deepone', 'ghoul', 'ghoul'], ['nightgaunt', 'cultist'], ['nightgaunt', 'ghoul', 'ghoul']],
    elite: [['shoggoth'], ['deepone', 'deepone', 'cultist']] },
  { name: 'The Hollow Ossuary', sub: 'Beneath the drowned city, the old bones are listening.', theme: 'crypt', boss: 'nyarlathotep', scale: 1.95, dmg: 1.45,
    easy: [['migo', 'ghoul'], ['nightgaunt', 'nightgaunt']],
    normal: [['shambler', 'cultist'], ['migo', 'migo'], ['byakhee', 'migo'], ['ghoul', 'ghoul', 'cultist', 'cultist'], ['shambler', 'nightgaunt'], ['byakhee', 'byakhee', 'cultist']],
    elite: [['starspawn'], ['shoggoth', 'migo']] },
  { name: 'The Drowned Spire', sub: 'The angles are wrong. The tide is rising.', theme: 'rlyeh', boss: 'cthulhu', scale: 2.15, dmg: 1.5,
    easy: [['hound', 'proto'], ['deepone', 'deepone']],
    normal: [['hound', 'deepone'], ['deepone', 'deepone', 'byakhee'], ['shambler', 'hound'], ['migo', 'migo', 'proto'], ['hound', 'hound'], ['byakhee', 'shambler', 'proto']],
    elite: [['starspawn', 'hound'], ['shoggoth', 'shoggoth']] },
];
const NODE_TYPES = {
  start:    { name: 'Entrance', icon: 'door', color: '#8a9097', desc: 'Where you came in. Nothing waits here.' },
  combat:   { name: 'Skirmish', icon: 'skull', color: '#c3c7cb', desc: 'Horrors. Gold and a new card.' },
  elite:    { name: 'Champion', icon: 'eye', color: '#d0503a', desc: 'A dangerous horror. Rewards a relic.' },
  event:    { name: 'Mystery', icon: 'quest', color: '#c8a0e8', desc: 'Something strange is in this room.' },
  rest:     { name: 'Campfire', icon: 'fire', color: '#f0d870', desc: 'Heal and revive, or study a card.' },
  shop:     { name: 'Peddler', icon: 'coin', color: '#ffe9a8', desc: 'Buy cards, relics and draughts, or forget a card.' },
  treasure: { name: 'Cache', icon: 'chest', color: '#a0703c', desc: 'Something left behind. A relic and some gold.' },
  shrine:   { name: 'Wayshrine', icon: 'sign', color: '#6aa77f', desc: 'A small shrine. Pray for strength, forgetting or insight.' },
  boss:     { name: 'Lair', icon: 'crown', color: '#9a2a24', desc: 'The master of this floor.' },
};
const WAYSHRINE = { id: 'wayshrine', title: 'A Wayshrine', text: 'A niche in the wall holds a soot-blackened saint with no face. Pilgrims have left candles. A few are still lit.',
  options: [
    { label: 'Pray for strength', desc: 'Every hero gains 5 max health.', act: g => { g.heroes.forEach(h => { h.maxHp += 5; if (!h.dead) h.hp += 5; }); return 'The candles gutter, then burn brighter. You all stand a little straighter.'; } },
    { label: 'Pray for forgetting', desc: 'Remove a card from your deck.', act: g => { g.pendingRemove = true; return 'Choose what to forget.'; } },
    { label: 'Pray for insight', desc: 'Upgrade a card.', act: g => { g.pendingUpgrade = true; return 'A thought arrives, fully formed, as if it had always been yours.'; } },
  ] };

// ---------------- relics ----------------
const RELICS = [
  { id: 'eldersign', name: 'Warding Amulet', desc: 'Every hero takes 1 less damage from each hit.' },
  { id: 'necro', name: 'Black Psalter Page', desc: 'The first card costing 2 or more each turn is played twice.' },
  { id: 'silverkey', name: 'Skeleton Key', desc: 'Card rewards offer one extra choice.' },
  { id: 'trapezo', name: 'Shard of the Bright Star', desc: 'Gain 1 extra energy every turn. Every hero starts each combat with 1 Weak.', boss: true },
  { id: 'lamp', name: 'Pilgrim\'s Lamp', desc: 'Your lantern lights rooms one step further. Draw 1 extra card on the first turn of each combat.' },
  { id: 'cylinder', name: 'Clockwork Familiar', desc: 'Your companions act twice on the first turn of each combat.' },
  { id: 'scale', name: 'Leviathan Scale', desc: 'Every hero gains 8 max health.' },
  { id: 'yithian', name: 'Storm Coil', desc: 'Every 4th card you play deals 4 damage to every horror.' },
  { id: 'pnakotic', name: 'Annotated Field Journal', desc: 'Rest sites let you upgrade 2 cards instead of 1.' },
  { id: 'fang', name: 'Hound\'s Tooth', desc: 'Your attacks that deal unblocked damage apply 1 Bleed.' },
  { id: 'idol', name: 'Gorgon Idol', desc: 'The first horror to attack you each combat is turned to stone (Stunned).' },
  { id: 'tithe', name: 'Collection Plate', desc: 'Gain 50% more gold.' },
  { id: 'kulten', name: 'Company Banner', desc: 'Your companions deal 2 more damage with every attack.' },
  { id: 'bandages', name: 'Blood-Soaked Bandages', desc: 'After each combat, every hero heals 5.' },
  { id: 'journal', name: 'Grandmother\'s Prayerbook', desc: 'Every hero starts each combat with 6 Block.' },
  { id: 'eibon', name: 'Ring of Small Mercies', desc: 'At the start of your turn, if you have no Block, gain 4.' },
  { id: 'crown', name: 'Crown of the Deep', desc: 'Gain 1 extra energy every turn. You draw 1 fewer card.', boss: true },
  { id: 'lens', name: 'Lens of the Unseen', desc: 'Gain 1 extra energy every turn. Companions deal 25% less damage.', boss: true },
];

// ---------------- draughts (potions) ----------------
const POTIONS = {
  heal:     { name: 'Healing Draught', target: 'ally', desc: 'Heal an ally 20.', use: (g, t) => g.heal(t, 20) },
  salts:    { name: 'Vial of Salts', target: 'fallen', desc: 'Revive a fallen ally at 50% health.', use: (g, t) => g.revive(t, 0.5) },
  powder:   { name: 'Black Powder', target: 'none', desc: 'Deal 15 damage to every horror.', use: (g) => g.foes.slice().forEach(f => g.attack(null, f, 15)) },
  courage:  { name: 'Liquid Courage', target: 'none', desc: 'Every ally gains 10 Block.', use: (g) => g.allies().forEach(h => g.addBlock(h, 10)) },
  strength: { name: 'Strength Tonic', target: 'none', desc: 'You gain 3 Strength.', use: (g) => g.apply(g.player, 'str', 3) },
  clarity:  { name: 'Elixir of Clarity', target: 'none', desc: 'Gain 1 energy and draw 3 cards.', use: (g) => { g.energy++; g.draw(3); } },
};

// ---------------- events ----------------
// each option: label, desc, act(g) → string result (may start a fight via g.queueFight)
const EVENTS = [
  { id: 'order', title: 'The Salt Chapel', text: 'A robed figure waits under a dripping arch. "The Patriarch rewards the faithful," it says, and offers you something wrapped in wet cloth.',
    options: [
      { label: 'Accept the gift', desc: 'Gain a random rare card. Your hero loses 6 max health.', act: g => { const c = g.randomCard('rare'); g.addCard(c); g.player.maxHp -= 6; g.player.hp = Math.min(g.player.hp, g.player.maxHp); return `You take it. ${CARDS[c].name} is added to your deck. Something in your chest goes cold.`; } },
      { label: 'Refuse', desc: 'Nothing happens.', act: () => 'The figure says nothing. When you look back, the arch is empty.' },
    ] },
  { id: 'book', title: 'A Whispering Book', text: 'On a lectern sits a book bound in something that is not leather. It is open. It is reading itself, quietly, to no one.',
    options: [
      { label: 'Read on', desc: 'Upgrade 2 random cards. Your hero takes 8 damage.', act: g => { const n = g.upgradeRandom(2); g.loseHpOut(g.player, 8); return `You understand ${n} things you wish you didn't. Your nose bleeds for an hour.`; } },
      { label: 'Burn it', desc: 'Remove a card from your deck.', act: g => { g.pendingRemove = true; return 'It screams while it burns. Choose what you will forget.'; } },
      { label: 'Leave', desc: '', act: () => 'You close the door on it. It keeps reading.' },
    ] },
  { id: 'sailor', title: 'The Drowned Sailor', text: 'A sailor lies face-down in the brine, a heavy satchel still strapped across his back. His fingers twitch.',
    options: [
      { label: 'Take the satchel', desc: 'Gain 60 gold. He might not stay down.', act: g => { g.gold += 60; if (Math.random() < 0.5) { g.queueFight(['ghoul', 'ghoul']); return 'He does not stay down. Neither do his friends.'; } return 'He stays down. The satchel is heavy with old coins.'; } },
      { label: 'Say a prayer', desc: 'Every hero heals 10.', act: g => { g.heroes.forEach(h => !h.dead && (h.hp = Math.min(h.maxHp, h.hp + 10))); return 'The twitching stops. Your party feels lighter for it.'; } },
    ] },
  { id: 'mirror', title: 'The Tardy Mirror', text: 'A tall bronze mirror. Your reflection is a moment late. It mouths something, and holds out its hand.',
    options: [
      { label: 'Take its hand', desc: 'Duplicate a card in your deck. Add a Dread curse.', act: g => { g.pendingDuplicate = true; g.addCard('n_dread'); return 'Its hand is warm. Something follows you out of the glass.'; } },
      { label: 'Smash it', desc: 'Gain 25 gold. Your hero takes 5 damage.', act: g => { g.gold += 25; g.loseHpOut(g.player, 5); return 'The shards cut your hands. Behind the glass: old coins, and nothing else.'; } },
    ] },
  { id: 'shrine', title: 'The Warding Stone', text: 'A star carved into a menhir, older than the town, older than the coast. The air around it is clean.',
    options: [
      { label: 'Pray for strength', desc: 'Every hero gains 6 max health.', act: g => { g.heroes.forEach(h => { h.maxHp += 6; h.hp += 6; }); return 'You feel steadier. All of you.'; } },
      { label: 'Pray for protection', desc: 'Add a Warding Sigil card to your deck.', act: g => { g.addCard('n_elder'); return 'The sign burns into your memory.'; } },
      { label: 'Pray for forgetting', desc: 'Remove a card from your deck.', act: g => { g.pendingRemove = true; return 'Choose what to forget.'; } },
    ] },
  { id: 'lantern', title: 'A Lantern in the Fog', text: 'A green lantern sways ahead of you, carried by no one. It waits whenever you stop.',
    options: [
      { label: 'Follow it', desc: 'Find a relic, or something guarding one.', act: g => { if (Math.random() < 0.55) { g.gainRelic(g.randomRelic()); return 'It leads you to a niche in the wall. The lantern goes out. Something glints.'; } g.queueFight(['nightgaunt', 'nightgaunt'], true); return 'It leads you to them. They were waiting.'; } },
      { label: 'Ignore it', desc: '', act: () => 'It follows you for a while, then gives up.' },
    ] },
  { id: 'fallen', title: 'The Last Investigator', text: 'A man in a torn tweed coat, barely breathing, clutching a notebook full of sketches you recognize from your nightmares.',
    options: [
      { label: 'Tend his wounds', desc: 'Lose 15 gold. Gain a random uncommon card.', act: g => { g.gold = Math.max(0, g.gold - 15); const c = g.randomCard('uncommon'); g.addCard(c); return `He lives long enough to teach you something. ${CARDS[c].name} is added to your deck.`; } },
      { label: 'Take the notebook', desc: 'Upgrade a card. Gain a Dread curse.', act: g => { g.pendingUpgrade = true; g.addCard('n_dread'); return 'You read it by torchlight. You will be reading it in your sleep for years.'; } },
    ] },
];

// ---------------- meta progression ----------------
const RITES = [
  { id: 'vet', name: 'Veteran Investigators', desc: 'Every hero starts with +6 max health.', cost: [3, 6, 10] },
  { id: 'gold', name: 'Family Inheritance', desc: 'Start each run with +40 gold.', cost: [2, 4, 7] },
  { id: 'potion', name: 'Smuggled Laudanum', desc: 'Start each run with a Healing Draught.', cost: [3] },
  { id: 'upgrade', name: 'Field Notes', desc: 'Start each run with a random card upgraded.', cost: [4, 8] },
  { id: 'comp', name: 'Seasoned Companions', desc: 'Companions deal +1 damage per rank.', cost: [4, 8, 12] },
  { id: 'relic', name: 'Sigil Tattoo', desc: 'Start each run with a random relic.', cost: [12] },
];
