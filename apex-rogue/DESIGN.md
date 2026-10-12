# Death Row Derby: design notes

The plan for the next layer of the game: what it's for, and the systems that make a run matter. This is a plan, not a
description of the game as built (that's README.md). The world it draws on is LORE.md. Mark decisions as **decided**
or **open**, and move things into the README once they're built.

## The pitch

**You're a nobody inmate fighting your way up a city that's watching you die on TV.**

Every system should serve one of three things in that sentence: *a nobody* (identity, starting from nothing), *fighting
your way up* (the run: four acts, bosses, the Crown), *watching you die on TV* (the broadcast: crowd, sponsors,
ratings). The broadcast is the most under-used of the three today, and the endings are the least developed.

## 1. Ratings: the broadcast as a mechanic

C9TV is always on. The crowd rewards spectacle, and the sponsors pay for what the crowd loves.

**How it works**
- A **ratings meter** per race, shown as a small broadcast HUD (a "LIVE" bug, a viewer count that climbs and drops).
- Spectacle raises it: wrecks, close passes, a parried rocket (the hatch slam), a humiliation (taunt then pass or
  wreck: today's emote bonus moves into ratings), a harpoon drag, a near-miss with a mine, a jump, finishing on a
  wrecked car, flipping off a boss on camera.
- Boring lowers it: hiding behind the hatch, hanging at the back, long stretches with no action.
- **Ratings pay out at the garage** as sponsor interest: the higher your ratings, the better the sponsor offers
  (free ammo crates, a part at cost, a care package dropped mid-race next time, a paint job). Low ratings: the
  sponsors drop you, and the warden's channel mocks you on the billboards.
- Ratings are the **run currency for favour**; scrap stays the currency for buying. Rep stays the meta currency.

**Why**
- Style becomes strategy: playing safe is a real choice with a cost.
- It ties together systems that are separate today: emotes, the hatch parry, harpoon, wrecks, bosses.
- It makes the setting a system: the billboards, the C9TV screens, the sponsors and the crowd noise all react to you.

**Open**
- Whether ratings also scale rival aggression (a hot inmate attracts heat).
- How visible it is mid-race: a corner HUD bug, crowd audio swelling, or only at the end of the race.
- Sponsor identities (Aureum, Helix, Crown Bank, Warden Corp) each wanting a different kind of spectacle.

## 2. The deal and the endings

**Decided:** beating the Crown boss ends in a choice, and the run ends either way.

**The moment.** The Crown boss goes down. No results screen: Halloran finally appears (a voice on the PA, then his face
on every C9TV screen). He makes the offer that Marlowe took.
- **Walk free.** The gates open; the camera follows your car out past the wall. *"4471 walked free."*
- **Take the deal.** The gates stay shut. You're given the Crown, the champion's paint and the name "The Apex".
  C9TV announces a new champion. *"4471 took the deal."* Your inmate becomes the reigning champion (section 3).

Both should land, in different keys: freedom is earned and quiet; the deal is triumph with something rotten in it.

**The other ways a run ends**
- **Three strikes:** back to the cell. That inmate can turn up later as a rival in the Undercity, a lifer with a grudge.
- **Wrecked for good / killed** (if that becomes a fail state): their name goes on the memorial wall with the season.

**Open**
- What walking free gives you to keep. Proposal: a permanent unlock or the freed inmate's car turning up later
  ("this belonged to someone who got out"), and their name added to the Dez arguments on the walls.
- Rep: does the deal pay more rep than freedom (the bigger spectacle) to make the choice hard? Proposal: the deal pays
  more rep, freedom unlocks something the deal can't.
- What happens to Marlowe the first time a player takes the deal: retired, killed, or working for Halloran.

## 3. Champions: your old inmates as bosses

**Decided:** if you take the deal, that inmate becomes the Crown boss in your later runs. One reigning champion at a
time: the last one to take the deal. Marlowe holds the Crown until the player first takes it.

**The snapshot** (saved once, the moment you take the deal; stored with the meta save):
- Identity: inmate number, name or nickname, crime, face (see section 4), the Derby season.
- The car: body style, paint and two-tone, bodywork, bolt-ons (bumper, roof), junk kit, decals.
- The armoury: rack weapons with their attachments and finishes, grenades, the abilities.
- The cabin: trinkets, the driver chip.
- **The playstyle**, from stats tracked during the run: the most-fired gun, hatch use and parries, ram rate, nitro
  use, how often they taunted and with which emote, average race position, ratings.

**The fight**
- The champion drives your car with your guns. Their **signature move** comes from the build: a harpoon main hooks and
  drags, a rocket main fires barrages, a hatch main parries, a rammer rams (the existing boss moves become the menu
  the snapshot picks from).
- The AI is tuned by the playstyle stats (aggression, ramming, when to slam the hatch).
- Before the race the champion emotes at you with the gesture you used most.
- **Fairness:** the champion is scaled to the current run's difficulty, keeps readable tells and the boss health
  bar, and never has stats the player's build didn't have. It should feel like fighting yourself, not a wall.

**The world remembers**
- Graffiti in later garages: "4471 TOOK THE DEAL", "4471 WAS ONE OF US", "TRAITOR", in the hands the walls already use
  (js/graffiti.js), next to or replacing the Marlowe pieces.
- C9TV billboards: "4471: UNDEFEATED", with the champion's car.
- Beat a champion and they're dethroned: "DETHRONED" over their piece, their name on the memorial wall or in the lore.

**Later: other players' champions.** The same snapshot, uploaded, lets you sometimes face another player's champion
(their name, car and playstyle): asynchronous, no netcode. A backend project for after release; the snapshot format is
designed now so it's ready.

**Open**
- Do several past champions persist (a gauntlet at the Crown), or only the reigning one? Proposal: only the reigning
  one fights; the rest are lore and graffiti.
- What happens to the champion if the player keeps losing to them: do they get a reputation ("4471 has broken 12
  inmates")?

## 4. Identity: who the inmate is

A tiny amount of identity makes the stakes personal and makes champions memorable.

- **Inmate number** (exists: 4471 by default; new runs get a new number).
- **A crime**, picked or rolled at the start of a run, with a small starting perk: *armed robbery* (start with an
  extra weapon), *grand theft auto* (better handling), *arson* (incendiary rounds), *fraud* (better shop prices),
  *assault* (ram damage). The crime shows on the garage board and on the champion's billboards.
- **A face**: a mugshot generated per inmate (the people models already exist), seen on the title, the garage and
  the champion's billboards.
- **A voice in your ear**: a cellmate or crew chief on the radio during races (text barks at first), reacting to
  what happens and carrying the lore.

**Open:** picked or rolled crime; whether the face is seen in first person at all (the hands are; maybe a mirror).

## 5. Build order

Playtesting comes first: if the core loop (driving and shooting at once, the hatch, readability, performance) needs
work, that work comes before any of this.

1. **The snapshot and the champion boss.** Save the snapshot on taking the deal; build the Crown boss from it. The
   core of the feature, and testable alone.
2. **The deal moment and both endings.** Halloran's offer, the two ending sequences, the run ending.
3. **The callbacks.** Graffiti, billboards and the memorial for champions, freed inmates and lifers.
4. **Ratings.** The meter, the payout at the garage, the broadcast HUD; feeds the champion's fame.
5. **Identity.** Crime and perk, mugshot, the radio voice.

## 6. How we'll know it works

- **Ratings:** players change how they drive to chase it (some of the time), and can say what earns it.
- **The deal:** players hesitate at the choice, and testers split between the two endings rather than all taking one.
- **Champions:** players recognise their old car and say so out loud; beating a champion feels better than beating
  Marlowe did.
- **Identity:** players refer to their inmate by number or crime when talking about a run.
