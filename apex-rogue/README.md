# Apex Rogue

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
One race, with a switchable first-person cockpit view and top-down view (press `V`).

- The car's AI drives. You aim with the mouse and fire the **SMG** (overheats) or **rocket launcher**,
  throw **grenades** (look higher to throw further), raise a **shield**, and order the driver to **swerve**.
- Some rivals are armed: **rocket gunners** paint you with a red laser before firing homing rockets,
  and a **mine layer** drops mines when you're behind it. Shoot rockets and mines out of the air, or
  raise the shield just as a rocket hits to **parry** it back at the shooter.
- The cockpit is your space: the dashboard radar and status screen, a working rear-view mirror, the
  empty driver's seat with the steering wheel turning by itself, a gun rack on the driver's door, a
  grenade crate you can count, fuzzy dice and a bobblehead (trinkets) reacting to the car's movement,
  and a windshield that cracks when you take hits from the front.
- A briefing screen before the race shows the track layout, hazards and which rivals are armed.
- The cabin is a prisoner's death-race car: a rusty welded roll cage, a shackle and chain bolted to
  the floor, "INMATE 4471" stencilled on the glovebox, tally marks scratched into the dash, a taped
  polaroid on the visor, torn and duct-taped seats, a taped-over dash crack, exposed wiring, riveted
  steel plate on the door, wire mesh over the rear windows, junk on the floor, a grimy windshield
  with wiper arcs, and dust drifting in the light of a flickering bulb.
- **Retro look** (on by default, toggle with `F`): a PS1-era style in the spirit of *Fears to Fathom*.
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
| Switch view | `V` |

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

Trinkets sit on a shelf. A chalkboard shows the act, race, scrap, strikes and a tally of races
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
- **Weapons use ammo** (magazines, `R` to reload, ammo bought with scrap): SMG, pump shotgun, rocket
  launcher, flare gun (blinds the driver it hits). Two rack slots, three with the Warden's Keys.
  Grenades are a separate consumable.
- **Abilities** on `Space` and `E`: shield/parry, nitro burst, smoke screen, EMP pulse.
- **Trinkets** change the rules and physically appear in your cabin (hanging from the mirror or on the
  dash): fuzzy dice, rabbit's foot, rusty horseshoe, warden's keys, burnt rosary, bobblehead, pine air
  freshener, St. Christopher medal.
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
  - **Guns:** a finish per weapon (rusted, duct-taped, camo, chrome, gold).
  - **Presets:** save three complete looks and swap between them.

All the data lives in `js/build.js` (gameplay) and `js/cosmetics.js` (looks).

## Models (`models.html`, `models/`)

All 3D models are low poly (flat-shaded, chamfered, mostly a few hundred triangles each) and built in
code in `js/models.js`, so the game, the cockpit and the viewer share them. Open `models.html` to orbit
around each one and download it as a `.glb`. Pre-exported copies live in `models/`
(see `models/contact_sheet.png`); `.glb` files open in Blender, Windows 3D Viewer, or any glTF viewer.

- **Cars:** real-world proportions and details (wheel arches, grille, lenses, plates, mirrors, door seams, rims, road grime). Comet is a 90s coupe, Brick a boxy estate, Wasp a hot hatch, Phantom a 70s fastback; rivals add a welded rocket pod or
  a mine dropper. Your own car is an open shell with the cockpit interior inside.
- **Weapons:** SMG, rocket launcher, grenade, rocket, mine.
- **Cabin and trinkets:** cockpit interior, fuzzy dice, bobblehead, grenade crate.
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
| `js/input.js`, `js/audio.js` | Keyboard/gamepad/touch input, synthesized WebAudio sound |
| `js/build.js` | Build system data: parts, weapons, abilities, trinkets, driver chips, shop and rewards |
| `js/combat.js` | Gunner prototype: ammo weapons, abilities, damage pipeline, armed rivals, projectiles |
| `js/cockpit3d.js` | Gunner prototype: first-person Three.js cockpit view of the same simulation |
| `js/proto.js`, `prototype.html` | Gunner prototype page: briefing, race loop, HUD, results |
| `js/psx.js` | Retro PS1-style rendering: low-res dithered post pass, vertex snapping, grimy pixel textures |
| `js/models.js`, `js/modelviewer.js` | Low-poly model library and the model viewer / `.glb` exporter |
| `js/hud.js` | Race HUD shared by both pages |
| `tools/sim.js` | Headless balance simulator: `node tools/sim.js [races] [botSkill]` |
