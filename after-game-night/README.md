# After Game Night

A cozy first-person tidying game made in Godot 4. Game night is over. Six board games are still set out mid-play around a living room lit by a crackling fire, candles and lamps. Pack each game away properly, then carry each box to its spot on the game shelf.

## The collection

There are six game lines. Each has a base game and one or two expansions, and every one comes in its own box. That makes 15 boxes, about 1,330 pieces and 1,370 cards. The volume is modeled on real big-box games: *Slay the Spire: The Board Game* ships with 650+ cards and 113 tokens, and a Warhammer 40,000 starter set has about 40 miniatures.

| Game line | Boxes | What's in them |
| --- | --- | --- |
| Mossy Crowns (miniatures war game) | base, Thornwood Host, Knights of the Fen | about 100 knight and goblin miniatures, castle towers, crowns, 20 dice, coins, order cards |
| Plum Parlor (deck-building card game) | base, Midnight Tea | about 610 cards in 9 sets, hero miniatures, coins, gems, cubes, teacups, cake slices |
| Starfall Atlas (space exploration) | base, Comet Season, Deep Sky | star tokens, ringed planets, explorer pawns, gems, hex tiles, 260 cards |
| Lantern Harbor (trading game) | base, Stormwatch, Deep Tides | boats, glowing lanterns, lighthouse towers, coins, cargo cubes, pearls |
| Honeycomb Hustle (tile laying) | base, Wildflower Fields | 90 hex tiles, bees, honey drops, cubes, flower gems |
| Orchard Hollow (farming) | base, Cider Press | 78 apples, baskets, farmers, cider drops, teacups |

Each line was played with its expansions mixed in, so the pieces from every box in a line are jumbled together on one table. You can tell them apart by color: base game pieces are the line's own color, the first expansion's are darker with gold accents, and the second expansion's are lighter with cream accents. Card sets have their own colored stripe on the back.

## Packing a box

Click a piece to scoop up a handful of matching pieces nearby. Click more of the same kind to add to your handful (up to 40), then click the right box. They click into their spots one after another.

Every box has a fitted insert with a compartment for each piece type. Flat things like coins and tiles stack in their compartments. Faint outlines show where everything goes. Packing order works like the real thing:

1. Pieces and cards first. Card piles go in the tray for their set.
2. Then the board (base games only), folded in half over the insert.
3. The rulebook goes in last. Then the lid closes.

All the boxes in a line share a footprint, so they stack together in that line's cubby on the shelf. Putting something in the wrong box counts as a mix-up. Getting the order wrong doesn't; you just get a reminder.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk |
| Mouse | Look |
| Shift | Hurry |
| C / Ctrl | Crouch (for pieces on the floor) |
| Left click / E | Scoop up pieces or pick something up, put in a box, shelve a box, set down |
| Right click / Q | Toss what you're holding (pieces scatter) |
| H | Hint: an arrow points at something that can go in next |
| Esc / P | Pause |

## How it works

Everything is made in code. Models, textures and sounds are all generated when the game starts, so there are no asset files.

- `scripts/main.gd` builds the room, deals out the games and runs the game flow.
- `scripts/player.gd` handles first-person movement, picking up, carrying and placing.
- `scripts/pieces.gd` manages all the small pieces. Resting pieces are drawn in batches with lightweight colliders for aiming; only pieces in flight get full physics. This keeps 1,300+ pieces running smoothly.
- `scripts/item.gd` is for the bigger things you carry one at a time: card piles, boards, rulebooks and boxes.
- `scripts/game_box.gd` is a box with a fitted insert. It sizes its compartments, stacking depth and height to fit its own contents, accepts things in packing order, then closes its lid.
- `scripts/shelf_slot.gd` is a shelf cubby where all of one line's boxes stack.
- `scripts/mesh_kit.gd` builds all the pieces, plus the cards, boards, rulebooks and textures.
- `scripts/game_data.gd` lists every game line, its boxes, their pieces and cards, and how they're left on the table.
- `scripts/sfx.gd` synthesizes the sounds: wooden clacks, notes and a cardboard thunk.
- `scripts/hud.gd` draws the on-screen text and the title, pause and end screens.

Each new game shuffles where pieces sit, how they're piled, and the order of the shelf. About one piece in twelve ends up on another table or the couch.

### Tweaking

`STRAY_CHANCE` and `PIECE_SCALE` at the top of `scripts/main.gd` control how messy the room is and how big the pieces are. Edit `LINES` in `scripts/game_data.gd` to change what's in each box; the inserts and boxes resize themselves. `HANDFUL` sets how many of each piece one click scoops up.

The lighting is designed for Godot's default Forward+ renderer, which adds the warm haze and soft bounce light.

### Testing without the editor

```
godot --headless --path . -- --autotest
```

This checks that handfuls only scoop matching pieces, that expansion pieces, an early board and wrong shelf cubbies are refused, then packs and shelves all 15 boxes and confirms the game ends.
