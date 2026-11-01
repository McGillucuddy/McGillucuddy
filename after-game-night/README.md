# After Game Night

A cozy first-person tidying game made in Godot 4. Game night is over. Six board games are still set out mid-play around a living room lit by a crackling fire, candles and lamps. Pack each game away properly, then carry each box to its spot on the game shelf.

## The games

Each game has its own pieces, a deck of cards, two hands of cards left fanned on the table, a board and a rulebook.

| Game | Pieces |
| --- | --- |
| Lantern Harbor | sailboats, glowing lanterns, coins, dice |
| Orchard Hollow | apples, wicker baskets, farmer meeples, a die |
| Starfall Atlas | star tokens, ringed planets, explorer pawns, dice |
| Mossy Crowns | crowns, castle towers, knight meeples, coins |
| Honeycomb Hustle | hex tiles, bees, honey drops, cubes |
| Plum Parlor | teacups on saucers, cake slices, gems, dice |

## Packing a box

Every box has a fitted insert with one compartment per piece type. A faint outline in each compartment shows where every piece goes. Packing works like the real thing:

1. Pieces and cards first. Each piece snaps into its own spot, and every hand of cards joins one neat stack in the card tray.
2. Then the board, which folds in half and lies over the insert.
3. The rulebook goes in last, on top. Then the lid closes.

Putting something in the wrong game's box counts as a mix-up. Getting the order wrong doesn't; you just get a reminder.

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
| H | Hint: an arrow points at something that can go in next |
| Esc / P | Pause |

## How it works

Everything is made in code. Models, textures and sounds are all generated when the game starts, so there are no asset files.

- `scripts/main.gd` builds the room, deals out the games and runs the game flow.
- `scripts/player.gd` handles first-person movement, picking up, carrying and placing.
- `scripts/item.gd` is the base class for anything you can pick up.
- `scripts/game_box.gd` is a box with a fitted insert. It lays out its compartments to fit its own pieces, accepts them in packing order, then closes its lid.
- `scripts/shelf_slot.gd` is a shelf cubby reserved for one game.
- `scripts/mesh_kit.gd` builds all the pieces, plus the cards, boards, rulebooks and textures.
- `scripts/game_data.gd` lists each game's pieces and where they sit during play.
- `scripts/sfx.gd` synthesizes the sounds: wooden clacks, notes and a cardboard thunk.
- `scripts/hud.gd` draws the on-screen text and the title, pause and end screens.

Each new game shuffles where each game is set up, where pieces sit on the boards, and the order of the shelf. About one piece in seven ends up on the wrong table or the couch.

### Tweaking

`STRAY_CHANCE` and `PIECE_SCALE` at the top of `scripts/main.gd` control how messy the room is and how big the pieces are. Edit `GAMES` in `scripts/game_data.gd` to change what's in each box; the inserts resize themselves. To add a seventh game, also add a table spot in `_define_spots()` and a cubby to the shelf.

The lighting is designed for Godot's default Forward+ renderer, which adds the warm haze and soft bounce light.

### Testing without the editor

```
godot --headless --path . -- --autotest
```

This packs every box, checks that wrong pieces, an early board or rulebook, and wrong shelf spots are all refused, then shelves everything and confirms the game ends.
