# Eldritch Descent

A turn-based Lovecraftian roguelite in pixel art, in the vein of Slay the Spire, Darkest Dungeon and Monster Train. It's a sibling of [Eldritch Bastion](../eldritch-bastion) and shares its monster art.

**To play:** open `index.html` in a browser. There's no build step. Progress is saved in your browser.

## The game
- **Pick a calling:** Warden (tank), Hunter (damage), Occultist (caster) or Physician (healer). You play that calling's **card deck**, and the other three fight beside you as **AI companions**.
- **Static side-view arena:** your party stands in four ranks facing the horrors. Melee attacks can only reach the front two ranks on either side.
- **Your turn:** you have 3 energy and draw 5 cards. Every horror shows its **intent**: what it will do, how hard, and to whom. Hover a horror to see its aim. Each hero shows the damage coming at them after Block.
- **Companions** act after you, and their intents are shown too. The Warden taunts horrors onto himself, the Physician heals, shields and revives, and the Hunter and Occultist strike. A taunt instantly redirects enemy intents, so you can plan around it.
- **Statuses:** Block, Vulnerable, Weak, Strength, Bleed, Stun, Taunt and Phased, plus a set of powers per class.
- **The run:** three floors (Innsmouth Docks, the Catacombs and R'lyeh), each a branching node map:
  - Node types: Combat, Elite, Unknown events, Rest, the Antiquarian's shop, Treasure, and a Boss at the top.
  - Card rewards after every fight, card upgrades at rest sites, relics (including powerful boss relics with drawbacks) and draughts.
- **Bosses:**
  - **Father Dagon:** party-wide sweeps, the crushing tide, and he summons his children.
  - **Nyarlathotep:** hides behind Masks that shield him and whispers madness.
  - **Great Cthulhu:** counts down to the Dreaming, which strikes everyone at once, so stack Block.
- **Between runs:** Forbidden Knowledge buys permanent Rites.

## Controls
Click a card, then click a target if it needs one. `1`–`9` select cards, `E` ends your turn, and `Esc` or right-click cancels. Click the draw or discard pile to inspect it.

## How the art works
Every creature is drawn with vector shapes, rendered into a tiny canvas, matched to one shared 38-colour palette, and given a 1px outline (`js/pixel.js`). The game renders at 480×272 and is scaled up with nearest-neighbour filtering.
