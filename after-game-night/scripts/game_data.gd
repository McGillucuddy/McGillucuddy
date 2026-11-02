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
## An edition can also set its own "color", "accent" and material "style" (used by dice),
## and "rules": false if the box has no rulebook.

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
	{"id": "hoard", "name": "The Dice Hoard", "color": Color("c9a227"), "tagline": "a dice collection", "editions": [
		{"id": "ember", "name": "Ember", "board": false, "rules": false, "style": "ember", "color": Color("e8622a"), "accent": Color("ffd166"),
			"parts": [["d4", 14, "heap"], ["d6p", 14, "heap"], ["d8", 14, "heap"], ["d10", 14, "heap"], ["d10p", 14, "heap"], ["d12", 14, "heap"], ["d20", 14, "supply"]], "cards": []},
		{"id": "frost", "name": "Frost", "board": false, "rules": false, "style": "frost", "color": Color("8fd3f4"), "accent": Color("ffffff"),
			"parts": [["d4", 14, "heap"], ["d6p", 14, "heap"], ["d8", 14, "heap"], ["d10", 14, "heap"], ["d10p", 14, "heap"], ["d12", 14, "heap"], ["d20", 14, "supply"]], "cards": []},
		{"id": "galaxy", "name": "Galaxy", "board": false, "rules": false, "style": "galaxy", "color": Color("3a1d63"), "accent": Color("c0c8ff"),
			"parts": [["d4", 14, "heap"], ["d6p", 14, "heap"], ["d8", 14, "heap"], ["d10", 14, "heap"], ["d10p", 14, "heap"], ["d12", 14, "heap"], ["d20", 14, "supply"]], "cards": []},
		{"id": "jade", "name": "Jade", "board": false, "rules": false, "style": "jade", "color": Color("2f8f5b"), "accent": Color("e8c66a"),
			"parts": [["d4", 14, "heap"], ["d6p", 14, "heap"], ["d8", 14, "heap"], ["d10", 14, "heap"], ["d10p", 14, "heap"], ["d12", 14, "heap"], ["d20", 14, "supply"]], "cards": []},
	]},
]

## How many of each piece a single click scoops up.
const HANDFUL := {
	"knight": 6, "goblin": 6, "hero": 1, "tower": 3, "die": 8, "crown": 4, "coin": 12, "gem": 12,
	"cube": 14, "hex": 10, "teacup": 3, "cake": 4, "star": 12, "planet": 4, "pawn": 6, "boat": 4,
	"lantern": 5, "bee": 6, "honey": 12, "apple": 8, "basket": 3, "meeple": 8,
	"skeleton": 6, "slime": 6, "tile": 10, "chest": 2, "potion": 4, "dragon": 1,
	"d4": 10, "d6p": 10, "d8": 10, "d10": 10, "d10p": 10, "d12": 10, "d20": 8,
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
