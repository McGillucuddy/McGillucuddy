# Apex Rogue

A top-down **roguelite racing game** that runs in the browser. Pick a car, race AI rivals across
procedurally generated tracks, upgrade between races, and try to survive all 8 races to beat the
champion in the Grand Final.

No build step or dependencies: open `index.html` in a browser.

```bash
# or serve it locally
npx serve apex-rogue     # then open the printed URL
```

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
| `tools/sim.js` | Headless balance simulator: `node tools/sim.js [races] [botSkill]` |
