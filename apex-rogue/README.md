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
Played from the cockpit: you ride shotgun with a gun in your hands. A top-down view is kept only as a fallback
for machines without WebGL, and the PS1-style retro look is always on.

**Progression.** Every run starts with a **service pistol**, two grenades, a shield and a clapped-out car.
Everything else unlocks for good with reputation, the same rep that unlocks paint:
- **What unlocks:** 8 weapons, 20 car parts, 4 abilities, 30 attachments, 22 trinkets and 7 driver chips. Each item has its own rep threshold.
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
- **Physics:** cars have a height and a body on springs. The nose dips under braking and lifts under power, and the body leans out of turns.
  Braking loads the front tyres for a sharper turn-in.

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
7. Raise the shield.
8. Learn the threats.
9. Finish.

`Enter` skips a step. Rivals are unarmed and slower, and your hull is reinforced. There are no strikes, scrap or rep. Any run in progress is set aside and handed back afterwards.
The end screen explains the route sheet, garage, strikes and rep.

You can reach the menu from the route sheet and garage (`☰ Menu`), the pause screen, the race briefing, and the end screens.
`Esc` backs out of a menu panel, or returns to your run. `prototype.html?run` skips the menu and starts a run straight away.

- The car's AI drives. You aim with the mouse and fire whatever's on your rack, starting with the **pistol**,
  throw **grenades** (look higher to throw further), raise a **shield**, and order the driver to **swerve**.
- Some rivals are armed: **rocket gunners** paint you with a red laser before firing homing rockets,
  and a **mine layer** drops mines when you're behind it. Shoot rockets and mines out of the air, or
  raise the shield just as a rocket hits to **parry** it back at the shooter.
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
| 🛒 Commissary | The only place the black market is open. Repairs, ammo and spares are always available in the garage. |
| ? Event | A cell-block scene with a choice: bribe a guard to wipe a strike, run contraband, bet on yourself, dig through the scrapyard, snitch on the gunners, visit the chapel, a yard fight, a cell-block trade, a sponsor deal, raid the armoury. |
| 🔧 Mechanic | A free full repair. |
| 💰 Bounty race | A regular race with a price on one rival's head: wreck them for 150+ scrap. |
| 📦 Stash | Pick one of two items, no race. |
| 👑 Qualifier | A named boss in a signature car. Finish ahead of them to move up an act (+250 scrap and a **driver trait**: Getaway Veteran, Ghost or Showboat, each with a downside). Lose, and you take a strike and must face them again. |

The bosses are The Turnkey (an armoured prison van with a gunner), Smokestack Sal (a mine layer), Augustin Vale (a gold
rocket supercar) and Vex "The Apex" Marlowe at the Crown. Against Marlowe, only an outright win sets you free.
Three strikes and the run is over.

- **Act I, The Undercity:** racing under the plate the upper city is built on. Its underside hangs
  overhead, and the only daylight leaks in round its edge. You race on oily, cracked tarmac between
  shacks, fire barrels, wrecks and support pillars, with guard towers sweeping searchlights over the track.
- **Act II, The Stacks:** smog sunset over tenements, smokestacks and cooling towers.
- **Act III, The Gilded Terraces:** above the smog, racing for the rich: glass towers, palms, villas,
  fountains, grandstands full of spectators and sponsor boards on the walls.
- **Act IV, The Crown:** golden hour at the top of the Spire, with marble colonnades and fireworks.

The distant megastructures follow the camera, so they always sit on the horizon. They are one merged mesh
with a haze shader. All of it lives in `js/env.js`.

### The garage (prototype)

Between races you're in a 3D garage. The camera moves between stations, and your options sit on a
clipboard beside it. You can click things in the room as well:

- **Workshop:** your car on a lift (parts, tuning, repairs).
- **Armory:** your rack and stash guns on a pegboard, with loose mods, ammo cans and the grenade crate on the bench.
- **Commissary:** a caged hatch with a trader. The goods sit on the counter with price tags; click one to buy it.
- **Paint booth:** orbits the car. The cabin tab puts you in your seat, and the guns tab goes to the pegboard.
- **The roll-up door:** takes you out to the next race.

Trinkets sit on the shelves: hanging ones on nails, flat ones leaned against the wall, standing ones
below. A chalkboard shows the act, race, scrap, strikes and a tally of races
survived. In the upper-city acts the sponsors have smartened the garage up, and the commissary becomes a
concierge. See `js/garage3d.js`.

### Build system (prototype)

A run is a string of races with **the garage** in between. Finish outside the top 3 and you get a
strike; three strikes ends the run. Places and wreck bounties pay **scrap**.

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
  Grenades are a separate consumable.
- **Abilities** on `Space` and `E`: shield/parry, nitro burst, smoke screen, EMP pulse.
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
- **Part tuning:** one trade-off slider per part (engine reliable↔boosted, tyres hard↔soft, armour
  light↔heavy, nitro capacity↔power), free to change in the garage.
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
| `js/weather.js` | Weather: per-stop forecasts, effects, cockpit particles and lightning, windshield drops, ambience |
| `js/build.js` | Build system data: parts, weapons, abilities, trinkets, driver chips, shop and rewards |
| `js/combat.js` | Gunner prototype: ammo weapons, abilities, damage pipeline, armed rivals, projectiles |
| `js/cockpit3d.js` | Gunner prototype: first-person Three.js cockpit view of the same simulation |
| `js/proto.js`, `prototype.html` | Gunner prototype page: briefing, race loop, HUD, results |
| `js/psx.js` | Retro PS1-style rendering: low-res dithered post pass, vertex snapping, grimy pixel textures |
| `js/models.js`, `js/modelviewer.js` | Model library and the model viewer / `.glb` exporter |
| `js/trinkets.js` | Sculpted trinket models and where each one mounts in the cabin |
| `js/sculpt.js` | Sculpted models: signed distance parts blended per material and meshed into seamless surfaces |
| `js/hud.js` | Race HUD shared by both pages |
| `tools/sim.js` | Headless balance simulator: `node tools/sim.js [races] [botSkill]` |
