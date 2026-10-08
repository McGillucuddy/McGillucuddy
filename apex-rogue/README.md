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
| SMG / rockets | `1` / `2`, `Q` or mouse wheel to switch |
| Grenade | Right click or `G` |
| Shield / parry | `Space` |
| Swerve left / right | `A` / `D` |
| Switch view | `V` |

The cockpit uses [Three.js](https://threejs.org) r158 (MIT), vendored in `vendor/` so it works offline.

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
| `js/combat.js` | Gunner prototype: weapons, armed rivals, projectiles, shield/parry, swerve |
| `js/cockpit3d.js` | Gunner prototype: first-person Three.js cockpit view of the same simulation |
| `js/proto.js`, `prototype.html` | Gunner prototype page: briefing, race loop, HUD, results |
| `js/psx.js` | Retro PS1-style rendering: low-res dithered post pass, vertex snapping, grimy pixel textures |
| `js/models.js`, `js/modelviewer.js` | Low-poly model library and the model viewer / `.glb` exporter |
| `js/hud.js` | Race HUD shared by both pages |
| `tools/sim.js` | Headless balance simulator: `node tools/sim.js [races] [botSkill]` |
