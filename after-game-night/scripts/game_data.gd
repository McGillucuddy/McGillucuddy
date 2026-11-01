class_name GameData
extends RefCounted
## The made-up board games that live in this house and what comes in each box.
## Each part is [piece type, how many, where it sits during play].
## "board" = on a space of the board, "supply" = loose beside the board, "stack" = stacked in little piles.

const GAMES := [
	{"id": "harbor", "name": "Lantern Harbor", "color": Color("2e8c9a"),
		"parts": [["boat", 4, "board"], ["lantern", 4, "supply"], ["coin", 6, "stack"], ["die", 2, "supply"]]},
	{"id": "orchard", "name": "Orchard Hollow", "color": Color("c8473b"),
		"parts": [["apple", 6, "supply"], ["basket", 3, "supply"], ["meeple", 4, "board"], ["die", 1, "supply"]]},
	{"id": "atlas", "name": "Starfall Atlas", "color": Color("4b56b3"),
		"parts": [["star", 6, "stack"], ["planet", 3, "board"], ["pawn", 4, "board"], ["die", 2, "supply"]]},
	{"id": "crowns", "name": "Mossy Crowns", "color": Color("5a8d39"),
		"parts": [["crown", 3, "supply"], ["tower", 4, "board"], ["meeple", 4, "board"], ["coin", 6, "stack"]]},
	{"id": "honey", "name": "Honeycomb Hustle", "color": Color("e09a1f"),
		"parts": [["hex", 6, "stack"], ["bee", 4, "board"], ["honey", 5, "supply"], ["cube", 4, "supply"]]},
	{"id": "plum", "name": "Plum Parlor", "color": Color("8c4a86"),
		"parts": [["teacup", 4, "supply"], ["cake", 4, "board"], ["gem", 5, "supply"], ["die", 2, "supply"]]},
]

const DECK_SIZE := 14
const HAND_SIZE := 4
const HANDS := 2

const TYPE_NAMES := {
	"meeple": "meeple", "pawn": "pawn", "die": "die", "coin": "coin", "hex": "hex tile",
	"cube": "cube", "gem": "gem", "boat": "boat", "lantern": "lantern", "apple": "apple",
	"basket": "basket", "star": "star token", "planet": "planet", "crown": "crown",
	"tower": "castle tower", "bee": "bee", "honey": "honey drop", "teacup": "teacup",
	"cake": "cake slice",
}
