# Eldritch Descent

A Lovecraftian action roguelite with MMO-style party combat, drawn in pixel art. It's a sibling of [Eldritch Bastion](../eldritch-bastion) and shares its monster art.

**To play:** open `index.html` in a browser. There's no build step. Progress is saved in your browser.

## The game
- **Pick a class:** Warden (tank), Occultist (spell damage), Physician (healer) or Hunter (ranged damage). The other three join you as **AI companions**.
- **MMO combat:** horrors attack whoever has built the most threat. The Warden taunts and peels enemies off the others, the Physician heals the most wounded and revives the fallen, and the damage dealers focus targets and stay behind the tank. Everyone steps out of red danger zones.
- **Roguelite run:** three floors (Innsmouth Docks, the Catacombs and R'lyeh), with 6 rooms each.
  - After every room you choose the next door: Combat, Elite, Shrine, Rest, Merchant or Treasure.
  - Level-ups grant boons, including class-specific ability changes. Elites and chests grant relics.
- **Bosses with raid mechanics:**
  - **Father Dagon:** sweeping cones, tidal circles under each hero, and adds.
  - **Nyarlathotep:** teleports, fans of shadow bolts, and decoy Masks.
  - **Great Cthulhu:** the Dreaming, a party-wide pulse you survive only by standing inside an Elder Sign.
- **Between runs:** Forbidden Knowledge buys permanent Rites.

## Controls
`WASD` move · mouse aim · hold left click to attack · `1` `2` `3` abilities · `Space` dodge roll · `F` Healing Draught · `E` interact, or hold `E` to revive a fallen ally · `Esc` pause.
On a phone, a joystick and ability buttons appear, and you aim and attack automatically.

## How the art works
Every creature is drawn with vector shapes, rendered into a tiny canvas, matched to one shared 38-colour palette, and given a 1px outline (`js/pixel.js`). The whole game runs at 480×272 and is scaled up with nearest-neighbour filtering.
