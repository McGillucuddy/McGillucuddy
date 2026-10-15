# Death Row Derby: design notes

The plan for the next layer of the game: what it's for, and the systems that make a run matter. This is a plan, not a
description of the game as built (that's README.md). The world it draws on is LORE.md. Mark decisions as **decided**
or **open**, and move things into the README once they're built.

## The pitch

**You're a nobody inmate fighting your way up a city that's watching you die on TV.**

Every system should serve one of three things in that sentence: *a nobody* (identity, starting from nothing), *fighting
your way up* (the run: four acts, bosses, the Crown), *watching you die on TV* (the broadcast: crowd, sponsors,
ratings). The broadcast is the most under-used of the three today, and the endings are the least developed.

## 1. The run is a broadcast season (replaces the route sheet and the old ratings idea)

**Decided.** A run is one season of C9TV. You start on the dead channels at the bottom of the dial nobody watches,
and you climb towards Prime Time. There's no separate map: between shows you flip through the **TV guide**.

### The dial: four blocks of channels

| Block | Channels | Who's watching | What's there |
| --- | --- | --- | --- |
| Public Access (the Undercity) | 2-9 | pirate feeds, a few hundred | scrap purses, junk gear, pistols |
| Cable (the Stacks) | 10-29 | factory crowds | real guns, the first sponsors |
| Premium (the Terraces) | 30-59 | paying subscribers | rifles, better sponsors, the black market |
| Prime Time (the Crown) | 60-99 | the whole city | machine guns, champions, the warden |

Higher channels pay bigger purses, stock better gear in their rewards and shopping slots, and book tougher rivals.
Your car, guns and trinkets carry over, so you feel yourself outgrowing the low channels.

### Viewers: the currency you climb with

**Decided.** You start with almost nobody watching. **Viewers** are earned by putting on a show, and they're what
gets you booked on higher channels.
- **What earns viewers:** wrecking drivers, winning, taunts and humiliations (flip someone off, then pass or wreck
  them), parries with the hatch, popped tyres, a grenade through a window, roof-gun time, jumps, near misses,
  claiming a bounty (a clean kill counts double). Bigger and riskier moves earn more.
- **What loses them:** hiding behind the hatch, finishing at the back, long dull stretches, getting wrecked.
- **In the race:** a LIVE bug in the corner with a viewer count that ticks up, with little pop-ups ("+1.2k: flipped
  off Rex Torque").
- **Channel gates:** each channel needs a number of viewers to book you. The guide shows the channels you can't get
  on yet, greyed out with their price in viewers, so you always see what you're climbing towards.

### Driver orders

**Built** (`js/orders.js`). You stay the gunner; the driver takes orders. Middle mouse rams the car under your
crosshair; a C wheel gives get alongside, tail them, floor it and ease off (which steadies your aim). Orders take a
moment, run 6-8 seconds and the driver reports back on the radio; chips change how keen they are. Swerves (A/D)
stay instant. **Open:** whether orders should cost something (a cooldown is all for now), and whether sponsors'
goals should ask for them ("ram three cars tonight").

### Your driver

**Built** (`js/crew.js`). A recruited inmate drives, not an autopilot: chips became drivers with randomized prison
names, a mugshot and a habit. Collared like you (the leash that keeps the car on course). Win the Crown and you both
walk free; **planned:** take the deal and your driver stays on as the champion's driver. **Built:** friendly fire (you can shoot your own driver: wounds, death, replacement). **Next:** rival fire
through your windscreen can wound your driver (worse driving until patched), the blast hatch protecting them;
drivers who die are replaced from the block; the walls and the fan mail talk about your driver too.

### Infamy: the currency you spend

**Built** (`js/infamy.js`). Viewers are what you climb with; **Infamy** is what you spend. Both come from the same
showmanship: every live Infamy pop-up is a moment the broadcast would cut to. Spent at the **Fan Club** (the mail
under the track door) on things only fans send: care packages, bootleg ammo, donations, The Crowd Turns, an Encore
(wipe a strike) and fan-made trinkets. Humiliations pay Infamy now instead of scrap: scrap is for killing and
placing, Infamy for style.
- **The world reacts:** the run's record is written on the garage walls in your inmate number (see README).
- **Open:** when viewers arrive, lifetime Infamy in a run is the natural viewer count (spending it doesn't lose you
  viewers). Whether billboards and commentators should also pick up the record.

### Sponsors

**Decided.** As your viewers cross thresholds, sponsors start calling. Each time, you choose one of two offers.
Each sponsor has a taste, a weekly stipend and a perk, and sets you a goal each show:
- **Helix** (pharma) loves wrecks: "3 wrecks tonight: +60 scrap". Perk: a free patch-up after each show.
- **Aureum** (luxury) loves style: taunts, near misses, jumps. Perk: better reward picks.
- **Crown Bank** loves winners: podiums only. Perk: bigger purses.
- **Warden Corp** loves control: clean racing, no hatch-hiding. Perk: free ammo every show.

You hold a few sponsors at once. Disappoint one show after show and they drop you, live on air.

**Decided: sponsors put their colours on you.** Signing with a sponsor means racing in their livery and carrying
their guns:
- **Car liveries:** each sponsor has its own paint scheme, decals and bolt-on kit.
  - Helix: hospital white and green crosses.
  - Aureum: black and gold, polished trim.
  - Crown Bank: navy and banknote patterns.
  - Warden Corp: prison orange and hazard stripes.
- **Gun finishes:** each sponsor also has a finish for your guns: Helix's lab-white polymer, Aureum's gold leaf,
  Crown Bank's engraved steel, Warden Corp's riot-orange.
- **Several sponsors:** the main sponsor (the first you signed) owns the paint; the others get their decals on the
  doors and bonnet.
- **Dropped:** the livery comes off. The car shows up with patches of bare primer where their logos were.
- **Keeping it:** a sponsor's livery lasts the run (runs are self-contained).

**Decided: the colours are part of every contract.** You can't sign and refuse to wear them: you're a walking
billboard.

### Urgency: the schedule doesn't wait

**Decided.** Each block runs for a fixed number of nights, then its **special** airs whether you're ready or not:
The Turnkey's special, Sal's, Vale's, and Marlowe's season finale. So every night is a choice between climbing (a
harder channel, more viewers and pay) and preparing (an easier slot, the shopping channel, the repair show), with
the clock running. Beat the special to move to the next block. Lose it and it's a strike, and you face it again the
next night.

The network's patience is still three strikes: cancelled means the run is over.

### Shows: what's on each night

Each night, the guide offers three or four shows on channels you can book. A listing gives the show's name, its
channel and pay, its format, who's on (named rivals and their bounties, sometimes a boss) and the sponsor's ask.
- **Race formats** (each plays differently):
  - *The Derby*: today's race.
  - *Demolition Hour*: an arena, no laps, last car running.
  - *The Convoy*: chase and wreck an armoured guard truck.
  - *Manhunt*: you're the bounty and everyone hunts you.
  - *Against the Clock*: hazards and the clock, no rivals.
  - *Escort*: keep a sponsor's car alive.
- **Other shows:**
  - *The Shopping Channel*: the commissary.
  - *Late Night Garage*: repairs.
  - *Phone-ins and talk shows*: the events.
  - *Pirate broadcasts*: the black market, sometimes.

### Venues: each format has its own kind of place

**Decided.** Not every show is on a race track; the venue fits the format:

| Format | Venue | What it's like |
| --- | --- | --- |
| The Derby | a **circuit** (the tracks we have now) | laps, positions, the classic |
| Demolition Hour | an **arena**: a walled bowl, a stadium floor, a scrapyard pit | no laps; circle, ram and shoot; ramps, pillars and the crowd right there; last car running |
| The Convoy | a **highway**, point to point | a long run with traffic lanes, overpasses and tunnels; the guard truck and its outriders ahead |
| Manhunt | **city streets**, an open grid | blocks, alleys and crossroads; rivals come at you from side streets; survive the clock or get to the exit |
| Against the Clock | a **gauntlet** course | jumps, crushers, fire jets, collapsing floors; no rivals |
| Escort | a **route through the district**, point to point | narrow sections and ambush points; protect the car in front |

Each venue is generated in the district's style (Undercity concrete, Stacks factories, Terraces marble, Crown
neon), so a Demolition Hour in the Stacks is a different place from one in the Crown.

### Length

About 40 minutes a run. Four blocks of three nights plus a special each is 16 shows at about 2.5 minutes each,
briefing and garage included.

**Open:**
- the exact viewer gates per channel, and how fast viewers come in;
- whether a wreck also costs viewers ("ratings crash");
- how many sponsors you can hold at once (proposal: two, three in Prime Time).

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

**Decided: what each ending leaves behind.**
- **Walking free** is the end of that inmate's story. (Superseded: cross-run cosmetics and a "they got out" wall; runs
  are self-contained.)
- **Taking the deal leaves a champion** (section 3).
- **Runs are self-contained (decided).** No reputation, no unlocks, nothing carried between runs but your paint job;
  scrap and Infamy are the only currencies, and both die with the run. The ending choice is about the story, never
  about what pays better.

**Decided: the deal is that you never stop racing.** Halloran doesn't let champions retire. That's why Marlowe is
still out there every season, and the cost of the deal you only see later: your champion fights every inmate after
you, for good. (Marlowe's walls already say he "took the deal"; this is what it was.)

## 3. Champions: your old inmates as bosses

**Decided:** if you take the deal, that inmate becomes the reigning champion in your later runs. One reigning
champion at a time: the last one to take the deal.

**Decided: the core bosses always come back.** The Turnkey, Sal, Vale and Marlowe are in every run; a champion is
added, never a replacement.
- No player champion yet: Marlowe is the champion and the final boss (as now).
- Once there is one: beating Marlowe in Act IV earns a **title race** against the reigning champion, your old
  inmate. Win it, and then Halloran makes his offer.

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
- Beat a champion and they're dethroned: "DETHRONED" over their piece.

**Decided: champions die for good, so they never pile up.**
- **One reigning champion** holds the title race until someone beats them.
- **Dethroned** champions join the ordinary rival pool: they can turn up in any normal race, in their own car with
  their own guns, marked on the start grid and the radar so you know who it is.
- **Blown up is final.** If a dethroned champion's car is destroyed in a race (by you, another rival or a crash), they
  are dead: they never appear again, and their name goes on the memorial wall with the season. A champion destroyed
  in the title race itself is dead too; one beaten across the line but not destroyed is only dethroned.
- **At most three dethroned champions alive at once.** A fourth retires the oldest ("found dead in his cell").

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

## 5. The roof gun (built; see the README)

**Decided:** machine guns can be mounted on the roof. Using one means opening a hatch and standing up into it.
- **The trade:** the mounted gun is steadier, fires on a wider arc (behind you too) and doesn't climb like the
  hand-held version, but while you're up in the hatch you're exposed: rivals' shots can hit *you* (a crew hit, not the
  hull), you can't slam the blast hatch, and climbing up or down takes a moment.
- **Which guns:** the Grinder LMG and the Widow MG first (the belt and pan guns), bought as a roof mount in the
  workshop.

**Decided: shielding you buy and build up.** The mount starts bare; the workshop sells protection around it, each
tier a real choice rather than a straight upgrade:
- **Bare mount:** full arc, nothing between you and the rounds.
- **Gun shield:** a welded plate in front of the gun. Stops shots from ahead; your flanks and back are open.
- **Wraparound:** plates on three sides. Stops most gunfire, but it's heavy (a little top speed) and narrows your arc.
- **Cage turret:** a full armoured cupola with a slit. Near-total protection from gunfire, the heaviest, the
  narrowest view, and a blast on the roof can still rattle you.
Shields take damage like the blast hatch does (they dent, crack and need repairs in the workshop), so protection
costs scrap to keep, and they show on the car, so rivals can see what you're running.

**Decided: being hit while exposed** costs extra hull, throws your aim off for a moment, and three hits in quick
succession knock you back down into the seat.

**Decided: the cage is slat armour.** Its plates stop bullets like the wraparound's; its tube cage defeats rockets
(set off early or fuse crushed) and softens blasts, not bullets.

**Open:** whether bosses go for the gunner when they see you up top; whether rivals with roof guns of their own
should exist.

## 6. Build order (the broadcast season first)

Playtesting comes first: if the core loop (driving and shooting at once, the hatch, readability, performance) needs
work, that work comes before any of this.

1. **Viewers.** The in-race LIVE counter and what earns or costs viewers, shown on the results screen. Playable on
   the current route sheet, so we can tune it first.
2. **The TV guide and the season.** *First step built:* the TV (`js/tv.js`) is now the face of the route: each
   reachable stop is a channel with a picture and caption, and the route sheet is the TV guide. Still to come: The four blocks, nights and specials, channel gates by viewers, pay and
   difficulty by channel. This replaces the route sheet.
3. **Sponsors.** Offers at viewer thresholds, tastes, stipends, per-show goals, getting dropped.
4. **New show formats and their venues,** one at a time: Demolition Hour (the arena), The Convoy (the highway),
   Manhunt (the city grid), then Against the Clock (the gauntlet) and Escort.
5. **Sponsor liveries and gun finishes,** after sponsors exist.
6. **The snapshot and the champion boss.** Save the snapshot on taking the deal; build the title race and the
   champion from it.
7. **The deal moment and both endings.** Halloran's offer, the two ending sequences, the run ending.
8. **The callbacks.** Graffiti, billboards and the memorial for champions, freed inmates and lifers.
9. **Identity.** Crime and perk, mugshot, the radio voice.

## 7. How we'll know it works

- **Viewers:** players change how they drive to chase them (some of the time), and can say what earns them.
- **The season:** players feel the special coming and argue with themselves about climbing versus preparing.
- **The deal:** players hesitate at the choice, and testers split between the two endings rather than all taking one.
- **Champions:** players recognise their old car and say so out loud; beating a champion feels better than beating
  Marlowe did.
- **Identity:** players refer to their inmate by number or crime when talking about a run.
