class_name GameData
extends RefCounted
## The made-up board games that live in this house, and the kinds of pieces they use.

const GAMES := [
	{"id": "harbor", "name": "Lantern Harbor", "color": Color("2e8c9a")},
	{"id": "orchard", "name": "Orchard Hollow", "color": Color("c8473b")},
	{"id": "atlas", "name": "Starfall Atlas", "color": Color("4b56b3")},
	{"id": "crowns", "name": "Mossy Crowns", "color": Color("5a8d39")},
	{"id": "honey", "name": "Honeycomb Hustle", "color": Color("e09a1f")},
	{"id": "plum", "name": "Plum Parlor", "color": Color("8c4a86")},
]

const TYPES := ["meeple", "pawn", "die", "card", "coin", "hex", "cube", "gem"]

const TYPE_NAMES := {
	"meeple": "meeple", "pawn": "pawn", "die": "die", "card": "card",
	"coin": "coin", "hex": "hex tile", "cube": "cube", "gem": "gem",
}
