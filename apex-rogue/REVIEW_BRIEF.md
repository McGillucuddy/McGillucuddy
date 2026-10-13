# Death Row Derby: review brief

A briefing for an outside reviewer. It describes the game as built, what changed most recently, what we know is
weak, and where we most want a second opinion. Build: `death-row-derby-<date>-<sha>.zip` (open `index.html` in a
desktop browser; mouse and keyboard). Studio: Category 2 Games.

## The game in one paragraph

A first-person roguelite. You are a death-row inmate in a dystopian city's televised derby: you sit in the
passenger seat as the **gunner** while an AI drives your car. A run is four acts (the Undercity, the Stacks, the
Gilded Terraces, the Crown), each a branching route sheet of races and stops, ending in a boss race (The Turnkey,
Smokestack Sal, Augustin Vale, Vex "The Apex" Marlowe). Finish outside the top 3 three times and the run is over;
beat Marlowe and you walk free. Between races you're in a garage: repair, rearm, refit, buy. Retro PS1-style 3D
(Three.js), everything modelled procedurally (signed-distance sculpts), synthesized audio.

## Controls

Mouse aims and looks around; left click fires; `1`/`2`/`3` or wheel switch guns; `R` reloads; right click or `G`
throws a grenade; hold `Space` to slam the **blast hatch** (a steel plate over the windscreen: blocks fire, and timed
right it bats a rocket back); `E`/`F` abilities; `A`/`D` order the driver to swerve; `T` flips off a rival (tilts
them: they drive worse and come for you); `B` fits a spare part; `Esc` pauses.

## Core systems

- **Guns (13):** service pistol (starter), SMG, pump shotgun, rocket launcher, flare gun, nail gun, flamethrower,
  harpoon, WC-9 Carbine, Liberty Rifle (pre-war, pinging clip), Typewriter (pre-war drum gun), Grinder LMG
  (belt-fed), Widow MG (pan magazine). Ammo is bought; mags reload with full hand animations; two attachment slots
  per gun (scopes, suppressors, mags, chokes...), visible on the model.
- **Car:** four part slots (engine, tyres, armour, nitro) with trade-offs, durability and tuning; parts wear by
  which side is hit. Driver chips change how the AI drives.
- **Trinkets:** permanent run modifiers that hang or sit in the cabin (fuzzy dice, rosary, bobblehead...).
- **Rivals:** six per race; some armed (gunners lock on with a visible laser, rocket gunners, mine layers). Their
  drivers and gunners can be shot through the glass.
- **Economy (deliberately scarce):** purses are ranges, rolled half on luck and half on how you raced (wrecks,
  parries, damage avoided): a win pays 100-160 scrap, 3rd 50-85, last 5-15; each wreck 10-20; a boss 120-180.
  Starting scrap 120. The commissary (legal shop) appears at shop stops, stocked at random in three sections:
  weapons and attachments, trinkets, vehicle parts and abilities.
- **Wrecked means out:** at zero hull you're out of the race (no purse, a strike). The crew patches you to 40% hull
  and bodges broken parts to a quarter for free. Rival damage is softened early: 60% in Act I, 80% in Act II, 95% in
  Act III.
- **Shootable tyres:** four per car; a shot whose path passes a wheel hits the tyre. Each gun has a tyre rating
  (pistol ~31 hits to pop one, Liberty 4, Nail Gun 7). Flats cost speed and grip and pull to one side. From Act II
  more rivals have armoured tyres (a quarter of the damage). Some rival gunners are **tyre hunters** (Act II on): only
  after 25 seconds, only from beside or behind you, one attempt at a time across the field, with a warning.
- **Vendettas (within a run):** wreck a rival or pop their tyres and they may come back in a later race, same car
  and paint, armed, hunting you, adapted to how you beat them (plating, fireproofing, armoured tyres). Revealed a
  few seconds after the start, ringed red on the radar. Wreck them again to settle it (45-80 scrap). A driver you
  shot dead never returns.
- **The black market:** on ~40% of garage visits a brick comes out of the back wall: a dealer (two eyes and a
  cigarette) sells three things. Real drugs with spelled-out effects and comedowns (methamphetamine, oxycodone,
  adrenaline, cocaine, diazepam), booze (pruno, whiskey: the cabin view sways so your aim drifts), hot ammo
  (shredder, incendiary, armour-piercing) and shady trinkets with real costs (Dead Man's Rosary, Loaded Dice, Spiked
  Hubcap). No shakedowns, no duds. **Tolerance:** each use of the same drug or drink in a run hits 25% weaker
  (floor 40%) while the comedown stays full.
- **You see what you buy:** every shop and reward card shows a rendered picture of the actual item (guns from the
  side, attachments on a gun, parts on a car, the contraband itself).
- **The roof gun:** both machine guns are roof-mounted, not held. `V` climbs up through a hatch over your seat:
  steadier, swings all the way round, but exposed (rounds past your shielding hit you; three quick hits knock you
  down; no blast hatch). Shielding tiers bought in the Armory: Gun Shield (front), Wraparound (three sides, heavy,
  limited swing), Cage Turret (enclosed, heaviest, slit view).
- **Also:** per-act weather (rain, smog, blackout, acid drip...), boss signature moves and intro cards, run saving,
  a tutorial, rep-based unlocks between runs, graffiti and lore on the garage walls, a playtest report generator
  (Send feedback in the pause menu).

## What changed most recently

Scrap ranges; wreck-out rule; shootable and armoured tyres; tyre-hunter AI; vendettas; the black market with
tolerance; item pictures on all cards; the Typewriter's drum turned square to the barrel; magazine wells on every
mag-fed gun with straight-in reloads; the Grinder LMG's belt reload (feed cover up, belt laid in the tray, cover
slammed); the roof-mounted machine guns with shielding tiers; a shorter race briefing.

## What we know is weak (from bot playthroughs)

- **Act I is a wall.** A scripted bot (reasonable aim, rarely uses the hatch) usually reaches the Act I boss but loses
  to The Turnkey; about one run in four gets into Act II. Rams were the biggest damage source before the last tuning
  pass. A human who uses the hatch should do better, but we don't know by how much.
- **Act II to Act III** felt like a difficulty cliff in older builds; not re-measured since the damage changes.
- **Economy:** winning runs bank 300-900 scrap; losing runs spiral (little scrap, can't repair). The free crew patch
  is the safety net. Is scarcity fun or just punishing?
- **Readability:** vendetta name tags are hidden under the retro filter; you rely on the start callout and radar.

## Where we want your opinion most

1. **Difficulty curve:** is Act I fair for a first run with a pistol? What should change first: rival damage, rams,
   the Turnkey, or the economy?
2. **The wreck-out rule:** a wreck ends your race and costs a strike. Too harsh alongside scarce scrap?
3. **The black market:** are the drugs and comedowns interesting choices or noise? Is tolerance (25% per use, 40%
   floor) the right curve? Is 40% of visits too often?
4. **The roof gun:** is climbing up worth the exposure? Are the shield tiers real choices or is one obviously best?
5. **Tyres:** worth the complexity? Are tyre hunters fair ("difficult but not impossible")?
6. **Vendettas:** do they create memorable moments, or just a tougher rival?
7. **The pitch and tone:** "a nobody inmate fighting up a city that's watching you die on TV." Does the game sell it?
   What would make the broadcast feel more present?
8. **Anything that confused you** in the first ten minutes.

## Planned next (see DESIGN.md)

- **The deal and champions:** beating Marlowe ends in a choice (walk free, or take the deal and become the champion
  your later runs must beat); dethroned champions become rivals and die for good.
- **Ratings:** a live broadcast meter that pays out as sponsor favour; **identity:** a crime with a perk, a mugshot.

## Where things are

`README.md` (the game as built, every system), `DESIGN.md` (plans and decisions), `LORE.md` (the world).
Code: `js/proto.js` (game flow, screens), `js/combat.js` (guns, damage, tyres, rival guns), `js/cockpit3d.js` (the
first-person view and animations), `js/build.js` (items, shop, economy), `js/blackmarket.js`, `js/vendetta.js`,
`js/thumbs.js`, `js/models.js` / `js/rifles.js` (models), `js/race.js` / `js/car.js` / `js/ai.js` (racing).
About 20,000 lines of plain JavaScript, no build step.
