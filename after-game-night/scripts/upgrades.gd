class_name Upgrades
extends RefCounted
## Everything in the Tool Chest. Each upgrade has a price per level.
## Tidy Tokens are earned by filling compartments, packing boxes and shelving whole game lines.

const LIST := [
	{"id": "lantern", "name": "Seeker Lantern",
		"levels": ["Aim at a box: fireflies mark everything of it still out. Aim at a piece: a beam shows its box.",
			"Fireflies linger for 25 seconds.",
			"Fireflies stay until every marked piece is put away."],
		"costs": [3, 8, 16]},
	{"id": "caddy", "name": "Sorting Caddy",
		"levels": ["A wooden caddy: carry 140 pieces and scoop 50% more per click.",
			"Carry 220 pieces; scoops twice as big.",
			"Carry 320 pieces; scoops three times as big."],
		"costs": [5, 12, 22]},
	{"id": "beacons", "name": "Box Beacons",
		"levels": ["While you're holding pieces, every box that wants some of them glows, with a count.",
			"Beacons also show through walls and furniture."],
		"costs": [8, 14]},
	{"id": "dustpan", "name": "Dustpan",
		"levels": ["Sweep up any loose pieces in a circle, up to 150. Pour to sift.",
			"Wider sweep; holds 250.",
			"Widest sweep; holds 400."],
		"costs": [10, 18, 30]},
	{"id": "magnet", "name": "Magnet",
		"levels": ["Pull every matching piece within 2 meters into your hand.",
			"Reaches 4 meters.",
			"Reaches across the whole room."],
		"costs": [14, 22, 34]},
	{"id": "pour", "name": "Quick Pour",
		"levels": ["Pieces pour into boxes 50% faster.", "Twice as fast.", "A rushing cascade, three times as fast."],
		"costs": [4, 9, 16]},
	{"id": "satchel", "name": "Card Satchel",
		"levels": ["Carry 16 card piles at once.", "Carry 30 card piles at once."],
		"costs": [6, 14]},
	{"id": "airbrush", "name": "Airbrush",
		"levels": ["Paint miniatures at the desk twice as fast.", "Faster still.", "A whole handful painted in a blink."],
		"costs": [5, 10, 18]},
	{"id": "chute", "name": "Sorting Chute",
		"levels": ["When you pour, leftovers fly to their own open boxes within 4 meters.",
			"The chute reaches every open box in the room."],
		"costs": [40, 60]},
]


static func find(id: String) -> Dictionary:
	for u in LIST:
		if u.id == id:
			return u
	return {}
