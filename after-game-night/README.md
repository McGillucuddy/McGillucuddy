# After Game Night

A cozy first-person tidying game made in Godot 4. Game night is over, and six board games are scattered around a lamp-lit living room. Put every board and piece back in its own box. When a box is full, its lid closes. Then carry it to its spot on the game shelf.

## How to play

1. Install [Godot 4.3 or newer](https://godotengine.org/download) (the standard version, not .NET).
2. In Godot, choose **Import** and pick `project.godot` from this folder.
3. Press **F5** to play.

To make a standalone game, use **Project → Export** in Godot and add a Windows, macOS or Linux preset.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk |
| Mouse | Look |
| Shift | Hurry |
| C / Ctrl | Crouch (for pieces on the floor) |
| Left click / E | Pick up, put in a box, shelve a box, set down |
| Right click / Q | Toss what you're holding |
| H | Hint: an arrow points at something still loose |
| Esc / P | Pause |

## How it works

Everything is made in code. Models, textures and sounds are all generated when the game starts, so there are no asset files.

- `scripts/main.gd` builds the room, deals out the games and runs the game flow.
- `scripts/player.gd` handles first-person movement, picking up, carrying and placing.
- `scripts/item.gd` is the base class for anything you can pick up.
- `scripts/game_box.gd` is an open box that takes only its own game's pieces, then closes its lid.
- `scripts/shelf_slot.gd` is a shelf cubby reserved for one game.
- `scripts/mesh_kit.gd` builds the meeples, pawns, dice, cards, coins, hex tiles, cubes, gems, boards and textures.
- `scripts/sfx.gd` synthesizes the sounds: wooden clacks, notes and a cardboard thunk.
- `scripts/hud.gd` draws the on-screen text and the title, pause and end screens.

Each new game shuffles which pieces each board game uses, where each game is set up, and the order of the shelf. About one piece in five ends up on the wrong table or the couch.

### Tweaking

The constants at the top of `scripts/main.gd` control difficulty: `TYPES_PER_GAME`, `PIECES_PER_TYPE`, `STRAY_CHANCE` and `PIECE_SCALE`. To add a board game, add an entry to `GAMES` in `scripts/game_data.gd` and a matching table spot in `_define_spots()`.

### Testing without the editor

```
godot --headless --path . -- --autotest
```

This packs every box, checks that wrong pieces and wrong shelf spots are refused, shelves everything and confirms the game ends.
