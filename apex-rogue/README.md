# Death Row Derby

*(Formerly Apex Rogue. The folder and save keys keep the old name, so existing saves still load.)*

A top-down **roguelite racing game** that runs in the browser. Pick a car, race AI rivals across
procedurally generated tracks, upgrade between races, and try to survive all 8 races to beat the
champion in the Grand Final.

No build step or dependencies: open `index.html` in a browser.

```bash
# or serve it locally
npx serve apex-rogue     # then open the printed URL
```

## Gunner prototype (`prototype.html`)

An experiment in the next direction for the game: **the car drives itself and you are the gunner.**
A new run starts in the garage, where you can drag to spin the car a full 360° and scroll to zoom. **🗺 Pick your race** (on the clipboard and at the bottom of the screen) opens the route sheet when you're ready.

Played from the cockpit: you ride shotgun with a gun in your hands. A top-down view is kept only as a fallback
for machines without WebGL, and the PS1-style retro look is always on.

**Progression.** Every run starts with a **service pistol**, two grenades, a blast hatch and a clapped-out car.
Everything else unlocks for good with reputation, the same rep that unlocks paint:
- **What unlocks:** 13 weapons, 20 car parts, 4 abilities, 30 attachments, 22 trinkets and 7 driver chips. Each item has its own rep threshold.
- **Where it turns up:** gear only appears in shops and rewards once it's unlocked.
- **Earning rep:** finish races, win, wreck rivals, beat bosses (+40) and walk free (+150).
- **Seeing progress:** the results and end screens name new unlocks and the next one to aim for. **Unlocks** on the menu lists everything, locked and unlocked.

**Race music.** Every race gets its own synthesized track. The act sets the mood, the race type and seed set the key, tempo, chord progression and arp:
- **Act I, Undercity:** dark synthwave with a dirty bass.
- **Act II, Stacks:** harder, faster and Phrygian, with a galloping 16th-note bass and tom fills.
- **Act III, Terraces:** cinematic harmonic minor, with bells, string pads and a first breath of choir.
- **Act IV, Crown:** half-time and ethereal, with a formant-synthesized choir, celesta bells, a sub drone and a great sour bell tolling each phrase.

Bosses push the tempo and add pounding toms. The final race lets the kick loose under the full choir.
The music plays from the briefing, ducks while paused and fades at the flag. **Settings → Race music** sets its volume.

**Weather.** Every race stop on the route sheet has a forecast, shown as an icon on the stop and in the briefing, so it can steer your route.
- **Classics:** rain, thunderstorm, smog and cloud bank.
- **Undercity:** Acid Drip (corrodes parts) and Blackout.
- **Stacks:** Ash Fall and Furnace Day (engines run hot).
- **Terraces:** Golden Hour (+25% scrap, but you're lit up for gunners) and Sprinkler Mist.
- **Crown:** Firework Gala (+50% rep), Ion Storm (abilities recharge faster) and Smog Tide.

Weather changes fog, light and sky tint. It adds particles kept out of the cabin, drops on the windshield, lightning and thunder, an ambience bed and race-music tweaks.
In play it can change grip, rival lock-on time, part wear, payouts and ability recharge.

**Saving.** The run in progress is saved at the route sheet, garage and reward pick, and **Continue** resumes it after a reload.
A stop that was underway replays from the same random state, so it's the identical race. The run's save clears when it ends.

**Firing.** Each gun kicks on springs: push back, muzzle climb, a little jitter and roll, settling with an overshoot.
Big guns punch the view. A brief ragged muzzle flame flickers light over your hands and the cabin, and smoke curls off the barrel.

**Ramps, obstacles and car physics.** Every gunner race now has steel ramps and obstacles, and there are more of each act by act.
- **Ramps:** ride up the wedge, leave the lip at speed and you're airborne. You get no grip and only a touch of steering in the air.
  You land with a nose-slam bounce, and a hard landing costs speed and hull.
- **Obstacles:** concrete jersey barriers, tyre stacks (they scatter if you hit them hard), burnt-out wrecks, and red barrel clusters.
  Barrels explode when shot or rammed, set off any barrels nearby, and hurt any car in the blast. Clear an obstacle in the air and you sail over it.
- **AI:** drivers steer round obstacles, and some go out of their way to hit the ramps.
- **Rival crews:** every rival car has a driver at the wheel, and armed cars carry a gunner beside them. You can see them through the glass.
  - **Driver:** a shot whose path passes their seat hits them. A hit makes the car flinch into a swerve. Kill the driver and the car coasts on, steering itself into a wall: it's out of the race and counts as your wreck.
  - **Gunner:** hits break their lock, and killing them silences the car's weapon.
  - **Bosses:** they wear helmets, so their crews take several times the punishment.
  - **Feedback:** a red X on the crosshair marks a crew hit, and a gold one a kill.
- **People** (`js/people.js`): one sculpted body for everyone. Each has a head with a jaw, brow, nose, eyes and ears, under a beanie, bandana, cap, helmet or a shaved scalp, with an optional beard and shades.
  The jumpsuit has a collar, pockets, a number patch and creased legs, and the limbs are posed from joint positions.
  - **Your car drives itself:** there's no one at the wheel, just the autopilot rig. It's a box strapped to the driver's seat with a blinking light, cabled to a motor on the column, with a clamp on the hub that turns with the wheel.
  - **You:** look down and you see your own chest, lap and legs.
- **Commissary:** a planked counter with a barred hatch, a cash box, ledger and ashtray, and shelves of contraband (smokes, tins, bottles, ammo, oil).
  It has crates, hand-lettered notices, a lit sign and a string of bulbs, all under a warm lamp. The trader is built from the same body, arms folded, cigarette going.
  Goods on the counter are props: an engine block, a tyre, a plate, a bottle, a taped box for attachments, a canister, a chip board.
- **Physics:** cars have a height and a body on springs. The nose dips under braking and lifts under power, and the body leans out of turns.
  Braking loads the front tyres for a sharper turn-in.

**Intro.** A game by **Category 2 Games**. The game opens on a "click or press any key" gate (browsers keep sound off until then), then:
- **The studio sting** (6 s, every launch): a storm cell builds on a green weather radar, lightning strikes, and the Category 2 Games logo lands. The logo is the hurricane symbol with two arms, for category 2.
- **The cold open** (30 s, the first launch only; **Watch intro** under the title menu replays it). It's rendered in engine with the PS1 look, letterboxed and subtitled:
  - your cell door rolls open in the guard's torch;
  - the walk down death row past inmates watching from their bars;
  - your own car (your paint) under the garage lamp, headlights stuttering on, engine catching;
  - the shutter rises, the car launches into the floodlights and the title slams in.
- **The score:** eight bars at 72 BPM, cut to the shots. A drone and dripping bells in the cell, a heartbeat and low choir on the walk, a pulsing bass in the garage, a snare roll and riser into the title hit.

Any key or click skips ahead. `?nointro` skips the intro, `?intro` forces the cold open, and `?run` skips straight into a run. The code is in `js/intro.js`.

It opens on a **start menu** over the garage, with your car swinging slowly on the lift. The menu has:
- **Continue**, shown while a run is in progress, with its act, scrap and strikes;
- **New run**, which asks before throwing away a run in progress;
- **Settings** and **How to play**;
- **Exit**. Browsers only let a page close a tab it opened itself, so otherwise Exit shows a "lights out" screen.

The menu has its own theme, synthesized live in `js/music.js` like the rest of the sound (there are no audio files). It's straight synthwave in D minor at 104 BPM, over Dm–B♭–F–C:
- four-on-the-floor kick and a big reverb-drenched snare;
- a pumping saw bass with a deep sub;
- supersaw pads and a 16th-note arpeggio with a dotted echo.

Everything but the drums ducks under the kick. Browsers hold sound back until your first click or key press. The music fades out when you leave the menu.
**Settings → Menu music** sets its volume; the main volume and mute apply too.

**Tutorial** (on the menu) is a practice race with a coach card that ticks off each skill as you use it:
1. Look around.
2. Fire, and land hits on a rival.
3. Reload.
4. Swap guns and fire a rocket.
5. Swerve.
6. Throw a grenade.
7. Slam the blast hatch.
8. Bat a rocket back.
9. Learn the threats.
10. Finish.

`Enter` skips a step. Rivals are unarmed and slower, and your hull is reinforced. There are no strikes, scrap or rep. Any run in progress is set aside and handed back afterwards.
The end screen explains the route sheet, garage, strikes and rep.

You can reach the menu from the route sheet and garage (`☰ Menu`), the pause screen, the race briefing, and the end screens.
`Esc` backs out of a menu panel, or returns to your run. `prototype.html?run` skips the menu and starts a run straight away.

- The car's AI drives. You aim with the mouse and fire whatever's on your rack, starting with the **pistol**,
  throw **grenades** (look higher to throw further), slam the **blast hatch**, and order the driver to **swerve**.
- Some rivals are armed: **rocket gunners** paint you with a red laser before firing homing rockets,
  and a **mine layer** drops mines when you're behind it. Shoot rockets and mines out of the air, or
  slam the hatch just as a rocket hits to **parry** it back at the shooter.
- The cockpit is your space: the dashboard radar and status screen, a working rear-view mirror, the
  empty driver's seat with the steering wheel turning by itself, a gun rack on the driver's door, a
  grenade crate you can count, fuzzy dice and a bobblehead (trinkets) reacting to the car's movement,
  and a windshield that cracks when you take hits from the front.
- A briefing screen before the race shows the track layout, hazards and which rivals are armed.
- The cabin is a prisoner's death-race car, every piece sculpted round and blended (cage tubes welded on foot
  plates, a moulded gauge binnacle, screens in their own housings, padded and bolstered seats): a rusty welded roll cage, a shackle and chain bolted to
  the floor, "INMATE 4471" stencilled on the glovebox, tally marks scratched into the dash, a taped
  polaroid on the visor, torn and duct-taped seats, a taped-over dash crack, exposed wiring, riveted
  steel plate on the door, wire mesh over the rear windows, junk on the floor, a grimy windshield
  with wiper arcs, and dust drifting in the light of a flickering bulb.
- **Retro look** (always on): a PS1-era style in the spirit of *Fears to Fathom*.
  The world renders at 240p with hard pixels, 15-bit colour and ordered dithering, film grain and a
  vignette; vertices snap to the low-res grid so geometry wobbles; every model gets grimy 64×64 pixel
  textures (scratched paint, rust, cracked vinyl, scuffed plastic); fog is thick and murky; the mirror
  is grainy; and a bare bulb flickers in the cabin. Code: `js/psx.js`.

| Action | Control |
| --- | --- |
| Aim / look around | Mouse (click to capture it) |
| Fire | Left click |
| Weapons | `1` / `2` / `3`, `Q` or mouse wheel to switch |
| Reload | `R` |
| Grenade | Right click or `G` |
| Abilities | `Space` / `E` |
| Fit spare part | `B` |
| Swerve left / right | `A` / `D` |

The cockpit uses [Three.js](https://threejs.org) r158 (MIT), vendored in `vendor/` so it works offline.

### Acts and environments (prototype)

A run is four acts. Each act is a **route sheet**: seven rows of 2-4 branching stops (the last row before the boss leans towards repairs and shopping) and then a boss qualifier.
You pick your path through it (`js/runmap.js`):

| Stop | What happens |
|---|---|
| 🏁 Race | Finish top 3 or take a strike. Make the cut to pick a reward. |
| ☠ Elite race | Sharper drivers, an extra rocket gunner and gunner, 1.4x placing pay. A trinket is guaranteed among the rewards. |
| 🛒 Commissary | Legal goods: three sections stocked at random each visit from everything you've unlocked. **Weapons** (two guns, two attachments), **Trinkets** (two) and **Vehicle** (two car parts, an ability or driver chip). Scrap is scarce, so you choose. Repairs, ammo and spares are always available in the garage. |
| ? Event | A cell-block scene with a choice: bribe a guard to wipe a strike, run contraband, bet on yourself, dig through the scrapyard, snitch on the gunners, visit the chapel, a yard fight, a cell-block trade, a sponsor deal, raid the armoury. |
| 🔧 Mechanic | A free full repair. |
| 💰 Bounty race | A regular race with a price on one rival's head: wreck them for 150+ scrap. |
| 📦 Stash | Pick one of two items, no race. |
| 👑 Qualifier | A named boss in a signature car. Finish ahead of them to move up an act (+150 scrap and a **driver trait**: Getaway Veteran, Ghost or Showboat, each with a downside). Lose, and you take a strike and must face them again. |

The bosses are The Turnkey (an armoured prison van with a gunner), Smokestack Sal (a mine layer), Augustin Vale (a gold
rocket supercar) and Vex "The Apex" Marlowe at the Crown. Against Marlowe, only an outright win sets you free.
Three strikes and the run is over.

**Boss fights** (`js/bosses.js`; the graffiti is painted in `js/garage3d.js`):
- **The garage is tagged with the act's boss** (`js/graffiti.js`). The boss's name is the biggest piece on the walls: blocky letters with a 3D drop, a two-tone fill and a keyline, the boss's mark behind (the Turnkey's key ring, Sal's smokestacks, Vale's dollar star, Marlowe's crown with a slash through it), and somebody's tag already going over a corner. Every other wall carries years of other inmates' paint: buffed patches, bubble throw-ups, handstyle tags, stencils, smileys, crew names, a memorial wall, and the inmates talking about their world, sometimes arguing in two hands ("NOBODY WALKS FREE" ← "DEZ DID"). The lore is in [LORE.md](LORE.md).
  - **No fonts:** every letter is a hand-drawn skeleton sprayed with a wobbly hand.
  - **The spray:** each mark gets a soft edge, speckled overspray, thin patches where the can ran dry, and drips that run down from where the paint pooled.
  - **The ageing:** the paint skips the mortar between the cinderblocks, rain streaks it, grime settles low, it fades, flakes and gets scratched.
  - **Per act:** the walls change each act, with lore about that act's boss.
- **Health bar.** It sits at the top of the screen with the boss's name, and shows a line at half health.
- **Signature moves.** Each boss has one, announced a beat before it lands (a klaxon and a red banner):
  - **The Turnkey:** an armoured nose, so rounds from in front do a third of their damage (hit him from the side or behind). **Riot Ram:** he floors it and steers into you when you're close.
  - **Smokestack Sal:** **Smokestack.** He belches clouds of smog that break locks and close the world in round you (the fog thickens in the cockpit), and keeps laying mines.
  - **Augustin Vale:** **Sponsor Barrage.** A fan of three rockets after a laser warning. Slam the hatch on the first to bat it back.
  - **Vex Marlowe:** rockets, then **Apex Barrage** salvos.
- **Rage at half health.** Every boss loses their temper: the Turnkey rams more often, Sal fills the air and lays mines in pairs, Vale fires five-rocket fans, and Marlowe adds nitro bursts.
- **Briefing.** The race briefing explains each boss's move.

- **Act I, The Undercity:** racing under the plate the upper city is built on. Its underside hangs
  overhead, and the only daylight leaks in round its edge. You race on oily, cracked tarmac between
  shacks, fire barrels, wrecks and support pillars, with guard towers sweeping searchlights over the track.
- **Act II, The Stacks:** smog sunset over tenements, smokestacks and cooling towers.
- **Act III, The Gilded Terraces:** above the smog, racing for the rich: glass towers, palms, villas,
  fountains, grandstands full of spectators and sponsor boards on the walls.
- **Act IV, The Crown:** golden hour at the top of the Spire, with marble colonnades and fireworks.

**The city** (`js/skyline.js`) has two layers.
- **The horizon ring** follows the camera, so it always sits on the horizon.
- **The district** is real buildings in the world between the track and the horizon, so there's depth and parallax instead of empty ground.

Both are built from a kit of shaded parts merged into one mesh each. Faces catch the act's sun, lit windows glow at night, and distance haze sinks everything into the smog or the clean blue.
- **Undercity and Stacks:** brutalist megablocks with cantilevered tiers, floor ledges, service cores, pipes, rooftop tanks, antenna masts with red beacons, and billboards bolted to their sides.
  - **The Undercity** adds overpasses and the lit pillars holding up the Plate.
  - **The Stacks** add refineries (chimney clusters, gas holders, flare stacks burning, cooling towers) and factories with sawtooth roofs.
- **Terraces and Crown:** glass towers in four shapes (setbacks with gardens on each step, twisted, octagonal with sky-garden bands, white stone with a gold-glass top) under gold rings, domes, lanterns and needle spires; hanging garden terraces.
  - **The Crown** adds domed palaces ringed with columns, and obelisks.
- **Facades:** come from an atlas of four styles per act (concrete, balconies with laundry, corrugated, neon; blue glass, gold glass, white stone, sky gardens).
- **Billboards and blimps:** carry the sponsors and the broadcast (see [LORE.md](LORE.md)). Blimps circle overhead.

The guard towers' searchlights are soft beams that fade along their length. Trackside scenery is sculpted coarser than hand-held models: it's copied dozens of times, and this takes about 40% off the scene's triangles. The rest lives in `js/env.js`.

### The garage (prototype)

Between races you're in a 3D garage. The camera moves between stations, and your options sit on a
clipboard beside it. You can click things in the room as well:

- **Workshop:** your car on a lift (parts, tuning, repairs).
- **Armory:** your rack and stash guns on a pegboard, with loose mods, ammo cans and the grenade crate on the bench.
- **Commissary:** a caged hatch with a trader. The goods sit on the counter with price tags; click one to buy it.
- **The wall** (some visits only): a knocked-through hole under the chalkboard, the black market (below).
- **Paint booth:** orbits the car. The cabin tab puts you in your seat, and the guns tab goes to the pegboard.
- **The roll-up door:** takes you out to the next race.

Trinkets sit on the shelves: hanging ones on nails, flat ones leaned against the wall, standing ones
below. A chalkboard shows the act, race, scrap, strikes and a tally of races
survived. In the upper-city acts the sponsors have smartened the garage up, and the commissary becomes a
concierge. See `js/garage3d.js`.

### Build system (prototype)

A run is a string of races with **the garage** in between. Finish outside the top 3 and you get a
strike; three strikes ends the run. Places and wreck bounties pay **scrap**.

- **Purses come in a range** (the briefing shows them): a win pays 100-160, 2nd 70-115, 3rd 50-85, down to 5-15 for
  last; each wreck 10-20; beating a boss 120-180. Where you land in the range is half luck and half how you raced
  (wrecks, parries, how little damage you took). Elite races pay 40% more. Scrap is scarce on purpose.
- **Wrecked means out.** If your hull hits zero you're out of the race: no placing purse, and a strike. The crew
  patches the car back to 40% hull for free and bodges any broken parts back to a quarter; the rest of the repair is
  yours to pay for. Rival guns and rams hit softer in Act I (60%), Act II (80%) and Act III (95%), so the early acts are survivable
  with a pistol.
- **Shootable tyres.** Every car has four. A shot that lands by a wheel goes into the tyre (and only half into the
  body). A flat costs the car speed and grip and pulls it towards the flat side; you see it sit down on its rim and
  throw sparks. Each gun has its own knack for tyres: the starter pistol, SMG and flamethrower are poor at it (about
  thirty pistol hits to pop one), rifles and machine guns are good, and the **Nail Gun** is made for it. From Act II
  more and more rivals run **armoured tyres** (a riveted steel plate over the rim: a quarter of the damage), and
  bosses past Act I always do. A shot hits a tyre when its path passes close to that wheel, so aim at the wheel.
  **Tyre hunters:** from Act II some rival gunners (30%, then 50%, 70%) will go for yours, but never straight away:
  only after the first 25 seconds, only from beside or behind you, one attempt at a time across the field (at least
  12 seconds apart), and with a warning ("X is going for your tyres!") and a longer lock you can see coming. Sit in
  front of a hunter for 20 seconds and you'll probably lose a tyre; swerve, shoot their gunner or get ahead and you
  won't. Stray rounds can still pop one now and then. The dash shows all four. **Run-Flats** take 50% more to pop,
  and you barely feel a flat.
- **Vendettas** (`js/vendetta.js`), within a run. Wreck a rival or shoot their tyres out and they may not be done
  with you: a wrecked driver lives half the time, a tyre job always. In a later race they can come back in the same
  car and paint, armed, a bit sharper and tougher, hunting you rather than racing, and fitted out against whatever
  beat them (blast or bullet plating, fire-retardant paint; shoot their tyres out and they come back on armoured
  tyres with a gunner who goes for yours). The briefing doesn't warn you: they're
  revealed a few seconds after the green light, and ringed in red on the radar. Wreck them to settle it (45-80 scrap); after three races of
  chasing you they give up. A driver you shot dead never comes back. At most three are out for you at once.

- **You see what you buy** (`js/thumbs.js`): every card in the commissary, the hole in the wall and the reward picks
  has a rendered picture of the actual item: guns from the side, attachments fitted on a gun, car parts on a car
  (tyres on the wheel, engines on the hood), trinkets, abilities, driver chips (each its own board) and the
  contraband itself (the pill bottle, the bag, the injector, the bottle, the box of rounds).
- **The black market** (`js/blackmarket.js`). On about 40% of garage visits after a race there's a tap on the back
  wall and a brick slides out: a dealer you only see as two eyes and a cigarette, selling three things the
  commissary won't. Nobody searches you for any of it. Prices are high and wander. Everything he sells works, but
  you build a **tolerance**: each time you take the same drug or drink in a run it hits 25% weaker (never below
  40%), while its comedown stays just as bad. The cards and the briefing show the strength it will hit you at. Hot
  ammo always works.
  - **Drugs**, named for what they are, kept in your pocket (five slots) and taken at the race briefing, one of each
    kind a race. Every card spells out the effect and the comedown with numbers:
    *Methamphetamine* (reloads 30% faster, fires 8% faster, 25% tighter aim; next race 30% shakier aim, slower
    reloads), *Oxycodone* (25% less damage taken; next race you start 15 hull down), *Adrenaline* (the hatch twice
    as fast; sluggish next race), *Cocaine* (fires 15% faster, abilities recharge 30% faster; -10% damage next race)
    and *Diazepam* (40% tighter aim but slower reloads, no comedown).
  - **Booze:** *Pruno* prison wine (+15% damage) and *Spire Whiskey* (+25% damage, half the recoil, a hangover). Both
    make the cabin swim, and only the view sways, not the gun, so your aim drifts.
  - **Hot ammo**, loaded at the briefing for every bullet gun that race: *Shredder Rounds* (bullets chew tyres: even
    the pistol pops one in a handful of hits), *Hot Loads* (incendiary) and *Black Tips* (armour-piercing, +35%).
  - **Shady trinkets**, only from him, each with a cost: *Dead Man's Rosary* (once a run a wreck doesn't put you
    out, but gunners lock on faster), *Loaded Dice* (purses always pay the top of their range, -20 max hull) and the
    *Spiked Hubcap* (side by side, your hubs shred a rival's tyres; you take more ram damage).
- **Parts** (engine, tyres, armour, nitro) set your stats and each has trade-offs. Every hit is absorbed partly by armour, then hits
  the hull, and also **wears the part facing the hit** (front: engine, sides: tyres, rear: nitro).
  Broken parts cripple the car until repaired in the garage.
- **One spare part:** carry a spare of one fitted part; if that part breaks mid-race press `B` to fit
  it (your hands are busy for 2.5s, so no shooting).
- **Weapons use ammo** (magazines, `R` to reload, ammo bought with scrap): service pistol (the starter; its slide kicks
  back on each shot and the mag drops out on reloads), SMG, pump shotgun, rocket
  launcher, flare gun (an orange Orion-style 12-gauge flare pistol firing red and green cartridges; blinds
  the driver it hits). Two rack slots, three with the Warden's Keys.
  Scrap-built guns too: a pneumatic Nail Gun (nails puncture tyres and drag rivals back), a Flamethrower
  built from a propane tank (short range, sets everything alight) and a Harpoon Gun (hooks a rival on a
  line and drags them back hard).
  Rifles and machine guns (`js/rifles.js`): the **WC-9 Carbine** (Warden Corp guard issue: accurate full-auto at range)
  and the belt-fed **Grinder LMG** (a hundred rounds, a brass belt climbing out of its ammo box; a slow reload: box on, feed cover up, belt laid in the tray, cover slammed), plus
  three **pre-war** guns from the arsenals sealed when the Plate went up: the **Liberty Rifle** (semi-auto, eight heavy
  rounds, and the empty clip pings out), the **Typewriter** drum gun (fifty rounds, walnut foregrip) and the **Widow
  MG** (cooling jacket, a pan magazine on top that turns as it fires). The drum gun and machine guns *bloom*: hold the
  trigger and the spread opens up (the crosshair brackets show it); let go and it settles.
  Grenades are a separate consumable.
- **Emotes** (`T`, `js/emotes.js`). Your free left hand comes up into view and tells a rival what you think of them:
  - **The gestures:** the finger, a thumbs down, a "come at me" beckon, or devil horns.
  - **Controls:** tap `T` for your last emote; hold it for a wheel, flick the mouse to pick and let go.
  - **Tilt:** whoever is under your crosshair gets **tilted** for 8 seconds. They drive sloppier and come straight for you, rams and guns first.
  - **The payout:** pass someone who was ahead of you while they're tilted (+15 scrap), or see them wrecked while they're seething (+30) — the crowd roars.
  - **Bosses:** taunt one and they answer back.
- **The blast hatch** (hold `Space`): a welded steel plate hinged on the roof that slams down over the windscreen.
  - **What it stops:** gunfire, and 70% of a blast. A mine under the car still gets through.
  - **The cost:** you can't shoot or throw while it's down, and you see out through a barred slit. You can still reload behind it.
  - **Parry:** slam it just as a rocket arrives and the plate bats it back at the shooter.
  - **Wear:** every hit dents it (the dents show inside the cabin). Dented through, it jams and hangs crooked off its hinge until you **beat it out** in the garage (Workshop) or the mechanic fixes it.
  - **The animation:** it drops with a clang and a bounce off its stop, shudders when hit, sprays sparks through the slit, and the gun lowers while it's down.
- **Abilities** on `E` and `F`: nitro burst, smoke screen, EMP pulse. All three are unlocked with rep and found in rewards and shops.
- **Your parts show on your car.** Armour bolts on as plates, reactive bricks, a spiked cage, ceramic tiles or
  window bars; tuning it heavier adds a hood plate, then a ram and arch guards, lighter thins it out. The
  nitro bottle is strapped on the boot or roof (bigger for capacity, smaller with a purge valve for power;
  twin bottles are two). Engines show through the hood (turbo, blower, velocity stacks, a diesel stack,
  salvaged batteries) and grow when boosted. Tyres show too: wide slicks, chunky all-terrains, studs,
  run-flat bands, snow chains; soft tuning widens them.
- **Trinkets** (22 to earn) change the rules and physically appear in your cabin, hanging from the mirror
  or the driver's visor, or standing and lying on the dash: fuzzy dice, rabbit's foot, warden's keys,
  burnt rosary, pine air freshener, dog tags, bronzed baby shoes, four-leaf clover, bobblehead, troll
  doll, prison teddy, snow globe, magic 8-ball, dash compass, Zippo lighter, rusty horseshoe,
  St. Christopher medal, polaroid from home, pack of smokes, gold tooth, lucky spark plug and a mixtape.
- **Driver chips** change how the AI drives your car, each with a downside: Hothead, Cautious,
  Daredevil, Gun Nut.

- **Loadout is swappable in the garage; only trinkets are permanent.** Everything you buy or win goes
  into your **stash** (or straight into a free slot), and in the garage you can refit parts, swap rack
  weapons, change abilities and driver chips. Mid-race your only option is the spare part.
- **Weapon mods** (2 slots per weapon, swappable, common/rare/epic):
  - SMG / shotgun: Extended Mag, Speed Loader, Laser Sight (with a visible beam), Full Choke, Hair
    Trigger, Sawn-Off, Incendiary Rounds (sets rivals on fire), Armour-Piercing Rounds, Suppressor
    (rivals take 40% longer to lock on to you), Tracer Rounds (marked rivals take +20% damage, shown as
    ◎), Slugs.
  - Launcher: Homing Fins, Bunker Buster, Twin Tube (two rockets per shot), Remote Detonator (fire again
    to blow your rocket mid-air).
  - Flare gun: Cluster Flare, Long Burn, White Phosphor.
  - Bolt-on attachments: Red Dot Sight, Flashlight (rivals in its beam lose their lock), Muzzle Brake,
    Drum Mag, Rebar Bayonet (shotgun and harpoon: +35% ram damage while held).
  - Scrapyard specials: Scrap Scope (pipe and a bottle-bottom lens), Shock Coil (a car battery wired to a
    coil round the barrel; hits can short a rival out), Hubcap Shield (-20% gunfire damage while held),
    Pressure Tank, Napalm Mix, Framing Nails, Barbed Head.
  Every mod is visible on the gun in your hands and on the rack.
- **Parts:** six per slot, e.g. Supercharger, Electric Motor, Run-Flats, Snow Chains, Ablative Plates,
  Window Cage (stops gunfire), Twin Bottles, Methanol.
- **Rivals** come armed: rocket gunners, a mine layer and a **gunner** who leans out of the window and
  rakes you with bursts (the lock warning shows before each burst).
- **Part tuning (builds):** one trade-off slider per part: engine reliable↔boosted, tyres hard↔soft, armour light↔heavy, nitro capacity↔power.
  - **Start of a run:** every car can tune one notch either way.
  - **Welding:** a second notch in each direction is welded on in the workshop for 90 scrap. Each direction is bought on its own, and the welds belong to the car, so they stay when you swap parts.
  - **Extreme notch:** a third notch per part (160 scrap) unlocks for good with rep: engine 140, tyres 180, armour 220, nitro 260.
  - **The look:** the car shows its tune, getting bulkier armour, bigger bottles and so on.
- **Paint shop** (cosmetic, kept between runs; races earn **reputation**, which unlocks options). The
  3D preview switches between exterior, interior and gun-rack views.
  - **Body:** style, paint, two-tone (roof / lower / hood) with a second colour, finish, grime (washed
    to caked in mud), livery, race number, number plate.
  - **Kit:** rims, front bumper (push bar, bull bar, ram plow), roof (rack, light bar, outer cage),
    spoiler, exhaust (single, twin, side pipes), underglow.
  - **Cabin:** seat covers (vinyl, leather, tartan, bead covers, leopard), steering wheel wrap (tape,
    leather, fuzzy, chain), dash colour, cabin bulb colour (lights the whole cockpit), dash ornament
    (hula girl, nodding dog, saint, skull; they sway with the car), and your inmate number stencilled on
    the glovebox.
  - **Guns:** a finish per weapon and junk welded onto it.
    - Finishes: rusted, duct-taped, chrome, gold; 15 camos (woodland, desert, jungle, urban, flecktarn, tiger
      stripe, splinter, digital, navy digital, arctic, midnight, hex, crimson tiger, zebra, candy); scrap-yard
      paint jobs (hazard stripes, chipped teal, scrap patchwork, graffiti, riot splatter, rusted sheet, road sign scraps, tin can patches); and animated ones
      that glow and move (toxic ooze, molten, static, jury-rigged LED strips and neon, oil slick, chem burn).
    - Welded-on junk: hanging chains, barbed wire, scrap plating, spikes and a rebar bayonet, a skull charm,
      Patched Up (random scrap welded over both sides; re-weld for a new layout), or Death Row (all of it). Kept clear of your hands; on the flare gun it tips open with the barrel.
  - **Presets:** save three complete looks and swap between them.

All the data lives in `js/build.js` (gameplay) and `js/cosmetics.js` (looks).

## Models (`models.html`, `models/`)

All 3D models are built in code in `js/models.js`, so the game, the cockpit and the viewer share them.
The main bodies are **sculpted** (`js/sculpt.js`): each part is a signed distance field (rounded boxes,
cylinders, lathes, side outlines, rods), parts of one material melt together with a fillet, ports and grooves
are carved out, and each material is meshed into one seamless smooth surface. That covers the guns, car
bodies and their bolt-ons, the cockpit cabin and roll cage, the car-mounted weapons, grenades and the gloved
first-person hands (one blended surface per hand with seams, stitching and a knuckle guard). Sculpted meshes
are cached and built while the menus idle. Small hardware (screws, lenses, decals, plates) stays separate. Open `models.html` to orbit
around each one and download it as a `.glb`. Pre-exported copies live in `models/`
(see `models/contact_sheet.png`); `.glb` files open in Blender, Windows 3D Viewer, or any glTF viewer.

- **Cars:** real-world proportions and details (wheel arches, grille, lenses, plates, mirrors, door seams, rims, road grime). Comet is a 90s coupe, Brick a boxy estate, Wasp a hot hatch, Phantom a 70s fastback; rivals add a welded rocket pod or
  a mine dropper. Your own car is an open shell with the cockpit interior inside.
- **Weapons:** SMG, rocket launcher, grenade, rocket, mine.
- **Cabin and trinkets:** cockpit interior, grenade crate and all 22 trinkets.
- **Scenery:** tree, pine, cactus, rock, neon building.

The exported `.glb` files include the retro pixel textures (nearest-neighbour filtered). Untick
"Retro look" in the viewer to see or export them untextured.

Scale: a car is 36 units long, so 1 unit is about 12.5 cm.

## How a run works

1. **Garage**: spend cash on stat upgrades (Engine, Gearbox, Steering, Tyres, Nitro), repair
   damage, buy a Spare Engine (extra life) or a Mystery Crate (rare+ upgrade cards).
2. **Choose a route**: each race offers two options: Grand Prix, Elite Cup (harder, better pay and
   cards), Sprint, Endurance or Chaos Run, each on a different biome.
3. **Race**: 6 AI rivals. You must finish within the qualifying position (top 4 early on, top 2
   late, and 1st in the Grand Final) or the run ends, unless you have a spare engine.
4. **Reward**: pick 1 of 3 upgrade cards: stat boosts or perks like *Slipstream*, *Drift King*,
   *Ram Plates*, *Ghost Chassis*, *Glass Cannon*…

Damage carries over between races. At 0 HP your car limps along at 60% power.

Progress between runs is saved in `localStorage`: reaching race 4 and race 6 unlocks the
**Brick** and **Wasp**, and winning a Championship unlocks the **Phantom**.

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Accelerate | W / ↑ | RT or A |
| Brake / reverse | S / ↓ | LT |
| Steer | A D / ← → | Left stick |
| Nitro | Shift (or N) | B / RB |
| Handbrake drift | Space | X / LB |
| Reset car | R | |
| Pause | Esc / P | Start |
| Mute | M | |

Touch controls appear automatically on touch devices.

**Perfect launch:** press accelerate right as the countdown hits GO. Holding it too early causes
wheelspin.

## Biomes

- **Meadow Ring**: grippy tarmac, grass slows you a lot.
- **Dust Bowl**: wide track, sand is forgiving.
- **Frostbite Pass**: low grip ice.
- **Neon Sprawl**: night race with headlights, tight walls.

Tracks also have boost pads and oil slicks (more of them later in a run and on Chaos Runs).

## Code layout

| File | Purpose |
| --- | --- |
| `js/track.js` | Procedural track generation (centripetal Catmull-Rom spline, validated so walls never overlap), queries, pre-rendering, minimap |
| `js/car.js` | Arcade car physics (grip/drift model, nitro, boosts) and drawing |
| `js/ai.js` | AI drivers: racing line, corner-speed braking, traffic avoidance, nitro use |
| `js/race.js` | Race simulation: laps, positions, collisions, damage, hazards, perks, effects |
| `js/upgrades.js` | Cars, upgrade cards, perks, shop pricing |
| `js/campaign.js` | Run structure, route choices, opponents, prize money |
| `js/main.js` | Game state machine, UI screens, HUD, camera |
| `js/input.js`, `js/audio.js`, `js/music.js` | Keyboard/gamepad/touch input, synthesized WebAudio sound, the menu theme |
| `js/tutorial.js` | Tutorial steps and the in-race coach card |
| `js/bosses.js` | Boss health bar, signature moves, and each boss's colours and put-down for the garage graffiti |
| `js/emotes.js` | Emote gestures (the hand models), the wheel, tilted rivals and the humiliation bonus |
| `js/intro.js` | The studio sting and the cold open: gate, radar logo, in-engine cinematic, captions, sound cues |
| `js/people.js` | People: the sculpted body used for drivers, crews, your own body and the trader; live two-bone arms |
| `js/weather.js` | Weather: per-stop forecasts, effects, cockpit particles and lightning, windshield drops, ambience |
| `js/build.js` | Build system data: parts, weapons, abilities, trinkets, driver chips, shop and rewards |
| `js/combat.js` | Gunner prototype: ammo weapons, abilities, damage pipeline, armed rivals, projectiles |
| `js/blackmarket.js` | The dealer behind the garage wall: contraband, its effects and comedowns, shady trinkets |
| `js/thumbs.js` | Item pictures for every shop and reward card; models of the black market's goods, abilities and chips |
| `js/vendetta.js` | Vendettas: rivals you put out who come back later in the run, adapted to how you beat them |
| `js/cockpit3d.js` | Gunner prototype: first-person Three.js cockpit view of the same simulation |
| `js/proto.js`, `prototype.html` | Gunner prototype page: briefing, race loop, HUD, results |
| `js/psx.js` | Retro PS1-style rendering: low-res dithered post pass, vertex snapping, grimy pixel textures |
| `js/models.js`, `js/modelviewer.js` | Model library and the model viewer / `.glb` exporter; `Models.gripFit` measures each gun's grips for the gloves |
| `js/rifles.js` | The rifles and machine guns: WC-9 Carbine, Grinder LMG, and the pre-war Liberty Rifle, Typewriter and Widow MG |
| `js/trinkets.js` | Sculpted trinket models and where each one mounts in the cabin |
| `js/sculpt.js` | Sculpted models: signed distance parts blended per material and meshed into seamless surfaces |
| `js/hud.js` | Race HUD shared by both pages |
| `tools/sim.js` | Headless balance simulator: `node tools/sim.js [races] [botSkill]` |

## Playtest builds

`tools/release.sh` packages the game for testers: the first-person game as `index.html`, only the files it loads, and
the build (date and commit) shown on the title screen. It writes `dist/death-row-derby-<date>-<commit>.zip`. Upload
that to itch.io (Kind of project: HTML, "This file will be played in the browser", visibility Restricted) or unzip it
onto Netlify Drop.

**Feedback from testers** (`js/playtest.js`): the game keeps a local record of runs (how far each got, every race's
place and time, what did the most damage, the frame rate, which guns were fired, hatch slams, parries and emotes) plus
the computer's GPU, screen and browser. **Send feedback** (title screen, garage, pause menu, end screens) adds the
tester's comments and copies the report or saves it as a text file. Nothing is uploaded. **Settings → Graphics** has
Low / Medium / High (render resolution, buildings round the track, weather particles) and an FPS readout; a race that
averages under 30 fps suggests Low on the results screen.
