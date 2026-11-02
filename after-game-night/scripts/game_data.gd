class_name GameData
extends RefCounted
## The board game collection in this house. Each game line has a base box and expansions.
## Every box has its own pieces, cards and rulebook, and the boxes in a line stack together on the shelf.
##
## parts: [piece type, how many, how it's left on the table]
##   "board"     = standing on the board's spaces
##   "formation" = ranks of miniatures, mid-battle
##   "stack"     = neat stacks (coins, tiles, tokens)
##   "heap"      = loose heaps (cubes, gems, apples)
##   "supply"    = scattered around
## cards: [card set name, how many cards]
## An edition can also set its own "color", "accent" and material "style" (used by dice, chips
## and cards), and "rules": false if the box has no rulebook.
## A part can carry its own color and name: [type, count, how, Color, "ruby"].
## cards can carry a back style: [set name, count, "holo" | "neon" | "casino", Color].

const LINES := [
	{"id": "crowns", "name": "Mossy Crowns", "color": Color("5a8d39"), "tagline": "a miniatures war game", "editions": [
		{"id": "base", "name": "", "board": true,
			"parts": [["knight", 20, "formation"], ["goblin", 26, "formation"], ["tower", 12, "supply"], ["die", 10, "supply"], ["crown", 4, "supply"], ["coin", 30, "stack"]],
			"cards": [["Orders", 40], ["Stratagems", 24]]},
		{"id": "thorn", "name": "Thornwood Host", "board": false,
			"parts": [["goblin", 30, "formation"], ["tower", 6, "supply"], ["die", 10, "supply"], ["coin", 20, "stack"]],
			"cards": [["Thorn", 30]]},
		{"id": "fen", "name": "Knights of the Fen", "board": false,
			"parts": [["knight", 24, "formation"], ["crown", 4, "supply"], ["cube", 20, "heap"]],
			"cards": [["Fen Oaths", 30]]},
	]},
	{"id": "plum", "name": "Plum Parlor", "color": Color("8c4a86"), "tagline": "a deck-building card game", "editions": [
		{"id": "base", "name": "", "board": true,
			"parts": [["hero", 4, "board"], ["coin", 60, "stack"], ["gem", 40, "heap"], ["cube", 50, "heap"], ["hex", 20, "stack"], ["teacup", 8, "supply"], ["cake", 12, "supply"], ["die", 1, "supply"]],
			"cards": [["Duchess", 80], ["Butler", 80], ["Gardener", 80], ["Chef", 80], ["Guests", 90], ["Trinkets", 40], ["Teas", 40]]},
		{"id": "midnight", "name": "Midnight Tea", "board": false,
			"parts": [["cake", 20, "supply"], ["gem", 20, "heap"], ["coin", 20, "stack"]],
			"cards": [["Midnight", 70], ["Secrets", 50]]},
	]},
	{"id": "atlas", "name": "Starfall Atlas", "color": Color("4b56b3"), "tagline": "a space exploration game", "editions": [
		{"id": "base", "name": "", "board": true,
			"parts": [["star", 60, "stack"], ["planet", 12, "board"], ["pawn", 12, "board"], ["die", 8, "supply"], ["gem", 30, "heap"]],
			"cards": [["Constellations", 90], ["Events", 30]]},
		{"id": "comet", "name": "Comet Season", "board": false,
			"parts": [["star", 30, "stack"], ["planet", 6, "board"], ["gem", 20, "heap"]],
			"cards": [["Comets", 50]]},
		{"id": "deepsky", "name": "Deep Sky", "board": false,
			"parts": [["hex", 24, "stack"], ["pawn", 8, "board"], ["cube", 20, "heap"]],
			"cards": [["Nebulae", 45]]},
	]},
	{"id": "harbor", "name": "Lantern Harbor", "color": Color("2e8c9a"), "tagline": "a trading game", "editions": [
		{"id": "base", "name": "", "board": true,
			"parts": [["boat", 12, "board"], ["lantern", 16, "supply"], ["coin", 40, "stack"], ["cube", 30, "heap"], ["die", 6, "supply"]],
			"cards": [["Harbor", 60], ["Voyages", 40]]},
		{"id": "storm", "name": "Stormwatch", "board": false,
			"parts": [["boat", 8, "board"], ["tower", 6, "supply"], ["coin", 24, "stack"], ["cube", 24, "heap"]],
			"cards": [["Storms", 45]]},
		{"id": "tides", "name": "Deep Tides", "board": false,
			"parts": [["gem", 30, "heap"], ["boat", 6, "board"], ["coin", 20, "stack"]],
			"cards": [["Tides", 40]]},
	]},
	{"id": "honey", "name": "Honeycomb Hustle", "color": Color("e09a1f"), "tagline": "a tile-laying game", "editions": [
		{"id": "base", "name": "", "board": true,
			"parts": [["hex", 60, "stack"], ["bee", 24, "board"], ["honey", 40, "heap"], ["cube", 40, "heap"]],
			"cards": [["Flowers", 50]]},
		{"id": "wild", "name": "Wildflower Fields", "board": false,
			"parts": [["hex", 30, "stack"], ["bee", 12, "board"], ["gem", 24, "heap"]],
			"cards": [["Meadows", 30]]},
	]},
	{"id": "orchard", "name": "Orchard Hollow", "color": Color("c8473b"), "tagline": "a farming game", "editions": [
		{"id": "base", "name": "", "board": true,
			"parts": [["apple", 48, "heap"], ["basket", 12, "supply"], ["meeple", 16, "board"], ["cube", 30, "heap"], ["die", 4, "supply"]],
			"cards": [["Harvest", 72], ["Seasons", 24]]},
		{"id": "cider", "name": "Cider Press", "board": false,
			"parts": [["apple", 30, "heap"], ["honey", 24, "heap"], ["meeple", 8, "board"], ["teacup", 6, "supply"]],
			"cards": [["Cider", 40]]},
	]},
	{"id": "wyrm", "name": "Wyrmlight Tales", "color": Color("9b2335"), "tagline": "a tabletop roleplaying game", "editions": [
		{"id": "base", "name": "", "board": true, "style": "bone",
			"parts": [["hero", 12, "board"], ["skeleton", 24, "formation"], ["slime", 16, "heap"], ["tile", 60, "stack"],
				["chest", 10, "supply"], ["potion", 30, "supply"],
				["d4", 6, "heap"], ["d6p", 6, "heap"], ["d8", 6, "heap"], ["d10", 6, "heap"], ["d10p", 6, "heap"], ["d12", 6, "heap"], ["d20", 6, "supply"]],
			"cards": [["Spells", 60], ["Monsters", 40], ["Treasures", 40], ["Character Sheets", 20]]},
		{"id": "vault", "name": "Monster Vault", "board": false, "style": "obsidian", "accent": Color("d6343a"),
			"parts": [["dragon", 6, "board"], ["skeleton", 30, "formation"], ["slime", 20, "heap"], ["tile", 30, "stack"],
				["d4", 6, "heap"], ["d6p", 6, "heap"], ["d8", 6, "heap"], ["d10", 6, "heap"], ["d10p", 6, "heap"], ["d12", 6, "heap"], ["d20", 6, "supply"]],
			"cards": [["Bestiary", 50]]},
	]},
	{"id": "hoard", "case": "vault", "name": "The Dice Hoard", "color": Color("c9a227"), "tagline": "a dice collection", "editions": [
		{"id": "ember", "name": "Ember", "board": false, "rules": false, "style": "ember", "color": Color("e8622a"), "accent": Color("ffd166"),
			"parts": [["d4", 14, "heap"], ["d6p", 14, "heap"], ["d8", 14, "heap"], ["d10", 14, "heap"], ["d10p", 14, "heap"], ["d12", 14, "heap"], ["d20", 14, "supply"]], "cards": []},
		{"id": "frost", "name": "Frost", "board": false, "rules": false, "style": "frost", "color": Color("8fd3f4"), "accent": Color("ffffff"),
			"parts": [["d4", 14, "heap"], ["d6p", 14, "heap"], ["d8", 14, "heap"], ["d10", 14, "heap"], ["d10p", 14, "heap"], ["d12", 14, "heap"], ["d20", 14, "supply"]], "cards": []},
		{"id": "galaxy", "name": "Galaxy", "board": false, "rules": false, "style": "galaxy", "color": Color("3a1d63"), "accent": Color("c0c8ff"),
			"parts": [["d4", 14, "heap"], ["d6p", 14, "heap"], ["d8", 14, "heap"], ["d10", 14, "heap"], ["d10p", 14, "heap"], ["d12", 14, "heap"], ["d20", 14, "supply"]], "cards": []},
		{"id": "jade", "name": "Jade", "board": false, "rules": false, "style": "jade", "color": Color("2f8f5b"), "accent": Color("e8c66a"),
			"parts": [["d4", 14, "heap"], ["d6p", 14, "heap"], ["d8", 14, "heap"], ["d10", 14, "heap"], ["d10p", 14, "heap"], ["d12", 14, "heap"], ["d20", 14, "supply"]], "cards": []},
	]},
	{"id": "casino", "case": "chipcase", "name": "Velvet Card Room", "color": Color("1f6b46"), "tagline": "a casino poker set", "editions": [
		{"id": "clay", "name": "Classic Clay", "board": false, "rules": false, "style": "classic", "color": Color("1f6b46"), "accent": Color("f4f0e6"),
			"parts": [["chip", 30, "stack", Color("f2efe6"), "white"], ["chip", 30, "stack", Color("c8323a"), "red"], ["chip", 24, "stack", Color("2a5bb5"), "blue"],
				["chip", 24, "stack", Color("2f8f4f"), "green"], ["chip", 16, "stack", Color("1d1d22"), "black"], ["dealer", 1, "supply"]],
			"cards": [["Red Deck", 52, "casino", Color("b3262e")], ["Blue Deck", 52, "casino", Color("2a4f9e")]]},
		{"id": "royale", "name": "Gilded Royale", "board": false, "rules": false, "style": "royale", "color": Color("3b1f4f"), "accent": Color("e8b84a"),
			"parts": [["chip", 24, "stack", Color("6a2c8e"), "purple"], ["chip", 16, "stack", Color("d9a520"), "gold"], ["chip", 24, "stack", Color("1d1d22"), "black"],
				["chip", 24, "stack", Color("8a1c2a"), "crimson"], ["plaque", 8, "supply", Color("d9a520"), "gold"], ["plaque", 8, "supply", Color("6a2c8e"), "purple"]],
			"cards": [["Gold Deck", 52, "casino", Color("8a6a1a")]]},
		{"id": "neon", "name": "Neon Nights", "board": false, "rules": false, "style": "neon", "color": Color("15131f"), "accent": Color("ff4fd8"),
			"parts": [["chip", 24, "stack", Color("ff4fd8"), "pink"], ["chip", 24, "stack", Color("3ee0ff"), "cyan"], ["chip", 24, "stack", Color("a6ff4d"), "lime"],
				["chip", 16, "stack", Color("9b5cff"), "violet"]],
			"cards": [["Neon Deck", 52, "neon", Color("ff4fd8")]]},
	]},
	{"id": "ccg", "case": "deckvault", "name": "Prismatic Legends", "color": Color("d64f8a"), "tagline": "a collectible card game", "editions": [
		{"id": "starter", "name": "", "board": false,
			"parts": [["counter", 20, "heap", Color("ff5a5a"), "red"], ["counter", 20, "heap", Color("4fb3ff"), "blue"], ["counter", 20, "heap", Color("6ee07a"), "green"],
				["deckbox", 6, "supply"]],
			"cards": [["Flame", 60], ["Tide", 60], ["Grove", 60], ["Shade", 60]]},
		{"id": "aurora", "name": "Aurora Holofoils", "board": false, "style": "holo", "color": Color("8fb7ff"), "accent": Color("ffffff"),
			"parts": [["toploader", 30, "stack"], ["deckbox", 4, "supply"]],
			"cards": [["Aurora Foils", 120, "holo", Color("b8c8ff")]]},
		{"id": "showcase", "name": "Neon Showcase", "board": false, "style": "neon", "color": Color("1a1424"), "accent": Color("3ee0ff"),
			"parts": [["toploader", 18, "stack"], ["counter", 24, "heap", Color("ff4fd8"), "pink"]],
			"cards": [["Showcase", 90, "neon", Color("3ee0ff")]]},
	]},
	{"id": "caverns", "name": "Crystal Caverns", "color": Color("5aa9b8"), "tagline": "a crystal mining game", "editions": [
		{"id": "base", "name": "", "board": true,
			"parts": [["shard", 24, "heap", Color("9b59d0"), "amethyst"], ["shard", 24, "heap", Color("f29bbf"), "rose quartz"], ["shard", 24, "heap", Color("f2c14e"), "citrine"],
				["cluster", 12, "supply", Color("9b59d0"), "amethyst"], ["geode", 8, "supply", Color("7fd1e8"), "blue lace"], ["meeple", 8, "board"]],
			"cards": [["Tunnels", 40]]},
		{"id": "deep", "name": "Deep Geodes", "board": false,
			"parts": [["geode", 16, "supply", Color("c16fe0"), "violet"], ["cluster", 14, "supply", Color("7fe0d6"), "aquamarine"],
				["cutgem", 20, "heap", Color("4fd07a"), "emerald"], ["cutgem", 20, "heap", Color("e04f5f"), "ruby"], ["cutgem", 20, "heap", Color("4f8fe0"), "sapphire"]],
			"cards": [["Veins", 30]]},
	]},
	{"id": "marbles", "case": "display", "name": "Marble Jar", "color": Color("8fa8b8"), "tagline": "a marble collection", "editions": [
		{"id": "cateye", "name": "Cat's Eyes", "board": false, "rules": false, "color": Color("5b86a8"), "accent": Color("e8f4ff"),
			"parts": [["cateye", 24, "heap", Color("2f7fe0"), "blue"], ["cateye", 24, "heap", Color("e0402f"), "red"], ["cateye", 24, "heap", Color("3fbf5f"), "green"],
				["cateye", 24, "heap", Color("f2c14e"), "yellow"], ["shooter", 10, "supply", Color("9b59d0"), "purple"]], "cards": []},
		{"id": "pearl", "name": "Pearls & Steelies", "board": false, "rules": false, "color": Color("c9b8d6"), "accent": Color("ffffff"),
			"parts": [["pearl", 24, "heap", Color("f4efe6"), "white"], ["pearl", 24, "heap", Color("f2b6c8"), "pink"], ["pearl", 24, "heap", Color("7fd1c8"), "teal"],
				["steelie", 24, "heap"], ["galaxymarble", 12, "supply", Color("6a3fd0"), "nebula"]], "cards": []},
	]},
	{"id": "paints", "case": "paintchest", "name": "Brushwork Hobby", "color": Color("d8d2c4"), "tagline": "miniature painting supplies", "editions": [
		{"id": "base", "name": "Base Paints", "board": false, "rules": false, "color": Color("d8d2c4"), "accent": Color("c8323a"),
			"parts": [["pot", 6, "heap", Color("c8323a"), "blood red"], ["pot", 6, "heap", Color("e8742a"), "ember orange"], ["pot", 6, "heap", Color("f2c94e"), "sun yellow"],
				["pot", 6, "heap", Color("4f9e3a"), "moss green"], ["pot", 6, "heap", Color("2a6fb5"), "ocean blue"], ["pot", 6, "heap", Color("6a3fa0"), "royal purple"],
				["pot", 6, "heap", Color("f2efe6"), "bone white"], ["pot", 6, "heap", Color("1d1d22"), "abyss black"], ["pot", 6, "heap", Color("8a5a34"), "leather brown"],
				["pot", 6, "heap", Color("e8b8a0"), "flesh tone"], ["pot", 6, "heap", Color("2fb8a8"), "teal"], ["pot", 6, "heap", Color("e05a9a"), "rose pink"]]},
		{"id": "metal", "name": "Metallics & Washes", "board": false, "rules": false, "style": "metal", "color": Color("4a4a52"), "accent": Color("e8b84a"),
			"parts": [["pot", 8, "heap", Color("e8b84a"), "gold"], ["pot", 8, "heap", Color("c9cfd6"), "silver"], ["pot", 8, "heap", Color("b06a3a"), "bronze"],
				["pot", 8, "heap", Color("c8743a"), "copper"], ["dropper", 8, "supply", Color("6a4a2a"), "sepia wash"], ["dropper", 8, "supply", Color("2a3a5a"), "blue wash"],
				["dropper", 8, "supply", Color("3a2a1a"), "dark wash"]]},
		{"id": "brushes", "name": "Brushes & Primers", "board": false, "rules": false, "color": Color("2a2a30"), "accent": Color("c9cfd6"),
			"parts": [["brush", 12, "supply", Color("c8323a"), "detail"], ["brush", 12, "supply", Color("2a6fb5"), "layer"], ["brush", 12, "supply", Color("1d1d22"), "drybrush"],
				["spray", 4, "supply", Color("2a2a2a"), "black primer"], ["spray", 4, "supply", Color("e8e4dc"), "white primer"], ["spray", 4, "supply", Color("8d9095"), "grey primer"]]},
	]},
]

## How many of each piece a single click scoops up.
const HANDFUL := {
	"knight": 6, "goblin": 6, "hero": 1, "tower": 3, "die": 8, "crown": 4, "coin": 12, "gem": 12,
	"cube": 14, "hex": 10, "teacup": 3, "cake": 4, "star": 12, "planet": 4, "pawn": 6, "boat": 4,
	"lantern": 5, "bee": 6, "honey": 12, "apple": 8, "basket": 3, "meeple": 8,
	"skeleton": 6, "slime": 6, "tile": 10, "chest": 2, "potion": 4, "dragon": 1,
	"d4": 10, "d6p": 10, "d8": 10, "d10": 10, "d10p": 10, "d12": 10, "d20": 8,
	"chip": 14, "plaque": 3, "dealer": 1, "toploader": 6, "deckbox": 2, "counter": 12,
	"shard": 8, "cluster": 3, "geode": 3, "cutgem": 10, "cateye": 14, "shooter": 4, "pearl": 14,
	"steelie": 14, "galaxymarble": 4, "pot": 6, "dropper": 4, "brush": 6, "spray": 2,
}

const TYPE_NAMES := {
	"meeple": ["meeple", "meeples"], "pawn": ["pawn", "pawns"], "die": ["die", "dice"],
	"coin": ["coin", "coins"], "hex": ["hex tile", "hex tiles"], "cube": ["cube", "cubes"],
	"gem": ["gem", "gems"], "boat": ["boat", "boats"], "lantern": ["lantern", "lanterns"],
	"apple": ["apple", "apples"], "basket": ["basket", "baskets"], "star": ["star token", "star tokens"],
	"planet": ["planet", "planets"], "crown": ["crown", "crowns"], "tower": ["tower", "towers"],
	"bee": ["bee", "bees"], "honey": ["honey drop", "honey drops"], "teacup": ["teacup", "teacups"],
	"cake": ["cake slice", "cake slices"], "knight": ["knight", "knights"], "goblin": ["goblin", "goblins"],
	"hero": ["hero", "heroes"], "skeleton": ["skeleton", "skeletons"], "slime": ["slime", "slimes"],
	"tile": ["dungeon tile", "dungeon tiles"], "chest": ["treasure chest", "treasure chests"],
	"potion": ["potion", "potions"], "dragon": ["dragon", "dragons"],
	"d4": ["d4", "d4s"], "d6p": ["d6", "d6s"], "d8": ["d8", "d8s"], "d10": ["d10", "d10s"],
	"d10p": ["percentile die", "percentile dice"], "d12": ["d12", "d12s"], "d20": ["d20", "d20s"],
	"chip": ["chip", "chips"], "plaque": ["plaque", "plaques"], "dealer": ["dealer button", "dealer buttons"],
	"toploader": ["foil card in a case", "foil cards in cases"], "deckbox": ["deck box", "deck boxes"],
	"counter": ["glass counter", "glass counters"], "shard": ["crystal shard", "crystal shards"],
	"cluster": ["crystal cluster", "crystal clusters"], "geode": ["geode", "geodes"], "cutgem": ["cut gem", "cut gems"],
	"cateye": ["cat's-eye marble", "cat's-eye marbles"], "shooter": ["shooter marble", "shooter marbles"],
	"pearl": ["pearl marble", "pearl marbles"], "steelie": ["steelie", "steelies"], "galaxymarble": ["galaxy marble", "galaxy marbles"],
	"pot": ["paint pot", "paint pots"], "dropper": ["wash bottle", "wash bottles"], "brush": ["brush", "brushes"],
	"spray": ["spray can", "spray cans"],
}

## Colors that set each box in a line apart: base, first expansion, second expansion.
static func edition_style(c: Color, idx: int, ed: Dictionary = {}) -> Dictionary:
	if ed.has("color"):
		var a: Color = ed.get("accent", ed.color.lightened(0.45))
		return {"body": ed.color, "accent": a, "trim": a, "style": ed.get("style", "")}
	if ed.has("style"):
		var base := _base_style(c, idx)
		base["style"] = ed.style
		if ed.has("accent"):
			base["accent"] = ed.accent
		return base
	return _base_style(c, idx)


static func _base_style(c: Color, idx: int) -> Dictionary:
	match idx:
		1:
			return {"body": c.darkened(0.34), "accent": Color("e8b84a"), "trim": Color("e8b84a")}
		2:
			return {"body": c.lightened(0.24), "accent": Color("fbf3e6"), "trim": Color("fbf3e6")}
	return {"body": c, "accent": c.lightened(0.45), "trim": c.lightened(0.35)}


## Card backs within one box: each set gets its own stripe color.
const SET_COLORS := [Color("e8b84a"), Color("f2efe6"), Color("d9634a"), Color("6fb3c9"), Color("9bc46a"), Color("c78bd6"), Color("f0a35e")]


static func type_name(type: String, n: int) -> String:
	var names: Array = TYPE_NAMES.get(type, [type, type + "s"])
	return names[0] if n == 1 else names[1]


static func full_name(line: Dictionary, ed: Dictionary) -> String:
	return line.name if ed.name == "" else "%s: %s" % [line.name, ed.name]
