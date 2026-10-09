# Death Row Derby: art kit

This is the brief for a 3D artist remodelling the game's pieces. Every model in the game today is generated in code.
They are good **blockouts**: the proportions, scale, attachment points and moving parts are right. A modeller's job is
to keep those and make them look hand-made.

The kit has four parts:

| Folder / file | What it is |
| --- | --- |
| `glb/` | Every current model as a `.glb` file. Open them in Blender (File → Import → glTF 2.0) and model over them. |
| `sheets/` | A reference sheet per model: front, side and top (orthographic, with a scale bar) and a 3/4 view, plus its size and triangle count. |
| `manifest.json` | Each model's size (game units and metres), triangle count, which way is forward, and its named attachment points. |
| `README.md` | This brief: scale, axes, budgets, style, what to deliver, and how to hire someone. |

The `glb/`, `sheets/` and `manifest.json` files are exported from the game's code and handed over as a zip; they are
not kept in this repository because they are large.

## Scale and axes

- **1 game unit = 12.5 cm** (8 units = 1 m). A Comet is about 36 units long, which is 4.5 m.
- **Y is up** in the game and in glTF. Blender is Z-up; its glTF exporter converts automatically, so keep **+Y Up** ticked.
- **Cars, people, track pieces and shop props face +X** (forward). Their left side is −Z and right side is +Z.
- **Weapons and hand-held things face −Z** (the barrel points down −Z, the grip is at +Z). This is the first-person camera's forward.
- Keep each model's **origin** where the kit file has it. Cars sit with their wheels on Y = 0, centred on X and Z.
  Guns pivot at the grip. Code places things by the origin, so a moved origin means a misplaced model.
- Apply all transforms before exporting (scale 1, no rotation on the root).

## Attachment points and moving parts

The code moves or attaches things at named points. Each one must be its **own object** (an empty or a separate
mesh) with **exactly this name**, parented the same way as in the kit file. `manifest.json` lists each model's points
with their positions.

| Model | Named parts | Used for |
| --- | --- | --- |
| Every gun | `barrel` | Muzzle flash, smoke and tracers start here. Put the empty at the muzzle tip, pointing −Z. |
| SMG, pistol | `mag` | Drops out and slides back in on reload. The mag must be a separate mesh. |
| Pistol | `slide` | Kicks back when you fire. |
| Shotgun | `pump` | Racks back and forward. |
| Flare gun | `breech` | Breaks open on reload. |
| Nail gun, harpoon | `bolt`, `tip` | The loaded nail or harpoon. |
| Guns with attachments | `barrelGrp` | Scopes, suppressors and the like snap onto this group. |
| Hands | `hands` | The two gloved hands and forearms. The fingers wrap the grips at the positions in `Models.GRIPS` (js/models.js). |
| Cars | `wheels` | Each wheel spins and steers about its own centre. Model each wheel separately, centred on its hub. |
| Cars | `body`, `glass` | The painted shell (re-coloured per car) and the windows (tinted, see-through on rivals). |
| Cars with crew | `crew` | Driver seat at Z −4.2, gunner seat at Z +4.2. Bullets that pass near a seat hit that person. |
| Cockpit | `led`, `nades`, `gear` | The autopilot's blinking light, the grenade crate (shows how many you have left) and the bolt-on parts. |
| Trinkets | `sway`, `stiff` | Hanging trinkets swing from the top of `sway`. |

If something is **painted per car** (body colour, accent stripes, camo), give it its own material named `body`,
`accent` or `trim` so the code can recolour it. Don't bake the body colour into a texture.

## Budgets

The code's blockouts are far too dense (they come out of a sculpting tool). Hand-made models should be **much** lighter:

| Asset | Triangles | Texture |
| --- | --- | --- |
| Car (each style) | 1,500 to 3,000 | One 128×128 atlas, or 2 to 3 at 64×64 |
| Bolt-on part (armour, engine, tyres, nitro) | 150 to 600 | Shares the car atlas or 64×64 |
| Gun with hands (first person) | 1,500 to 2,500 for the gun, 800 for both hands | 128×128 gun, 64×64 gloves |
| Person (driver, gunner, trader) | 800 to 1,500 | 64×64 |
| Cockpit interior | 3,000 to 5,000 | 128×128 atlas |
| Trinket, ammo, grenade, shop prop | 100 to 400 | 32×32 or 64×64 |
| Ramp, obstacle | 100 to 400 | 64×64 |
| Scenery building | 200 to 800 | 64×64, tiling |

Up to 4 materials per model; fewer is better.

## Style guide

The look is **late-90s PlayStation**: Twisted Metal 2, Vigilante 8 and Driver, filtered through a dystopian prison.
The game adds the rest on top: a 480-line render, 15-bit colour with dithering, vertex wobble and fog. Don't fake those in the textures.

- **Shapes first.** Read the silhouette at 100 px tall. Chunky bevels, big panels, exaggerated wheel arches and bumpers.
- **Low-res textures, nearest filtering.** 64–128 px, hand-painted or photo-sourced then crushed. Paint the detail in:
  panel lines, rivets, rust streaks, chipped paint, grime gathering low down. No normal maps, no PBR maps; a little
  vertex colour for dirt is welcome.
- **Faceted, not smooth.** Hard edges and flat shading on hard surfaces. Smooth shading only on tyres, people and organic bits.
- **Grimy, improvised, prison-made.** Welded scrap plates, zip ties, duct tape, mismatched panels, stencilled inmate
  numbers. The guns are real-world shapes, worn hard (pistol and SMG blued steel, pump shotgun with wood furniture).
  The flamer, nail gun and harpoon are jury-rigged.
- **Acts get richer as you climb.** The Undercity is rust and sodium-orange light, the Stacks are industrial soot,
  the Terraces are clean concrete and gold, and the Crown is white marble and neon.
- **People:** the inmates wear orange jumpsuits (`#a8521e`), black gloves and work boots, with stencilled numbers.
  Faces are simple: a few planes, painted eyes, no blendshapes needed.
- **Colour:** keep the base colours in the kit models (they are the palette). Body paint is set by the code.

## What to deliver

For each model:

1. **The `.blend` source file**, with modifiers applied or kept non-destructive (say which).
2. **A `.glb` export** with the same filename as the kit file (for example `weapon_pistol.glb`), +Y up, transforms
   applied, textures embedded.
3. **The textures as PNGs**, so they can be repainted later.
4. A screenshot next to the kit's reference sheet, so the scale can be checked at a glance.

Hand them over one at a time. A model is accepted when it drops into the game in place of the kit file and nothing
moves: the hands still hold the grip, the muzzle flash comes out of the barrel, the wheels spin in the arches.

## Finding and hiring a modeller

**Where to look**
- **r/gameDevClassifieds** and **r/HungryArtists**: post a `[PAID]` job with two sheets and your budget.
- **ArtStation**, searching "PS1", "low poly" or "PSX". Message artists whose portfolios already look like this.
- **Polycount** forum (Freelance / Job Postings) and the **Haunted PS1** and **PSX dev** communities (Discord, itch.io),
  where retro low-poly is the speciality.
- **Fiverr / Upwork** for cheaper single props. Judge on portfolio, not reviews.

**Rough prices** (2025–26, freelance, low-poly with hand-painted textures)
- Small prop (trinket, ammo, grenade, obstacle): $20–60 each.
- Gun with first-person hands: $100–300 each.
- Car: $150–400 each. The bolt-on parts are about $30–80 each on top.
- Person: $100–250.
- Cockpit interior: $200–500.
- The whole current set (7 cars, 8 guns, about 25 props, 4 people, cockpit) is roughly **$3,000–8,000**, depending on the artist.

**How to run it**
1. **Paid test first.** Send one sheet and its `.glb` (the pistol with hands is a good test: small, but it has every
   rule in it). Pay for the test whether you continue or not.
2. **Agree the scope in writing:** the list of models, the budgets above, the deliverables, the number of revision rounds
   (two is normal), the deadline and the payment schedule. Pay per model or in milestones, never 100% up front.
3. **Get a work-for-hire / IP assignment clause**, so you own the models outright and can sell the game. The artist can
   usually keep portfolio rights.
4. **Review in game.** Drop each `.glb` in and look at it in motion before you accept it.
