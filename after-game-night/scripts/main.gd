extends Node3D
## Builds the cozy game room, sets out a whole collection of board games mid-play
## (base games and expansions, about 1,400 pieces and 1,400 cards), and runs the tidy-up.

const PENTA := [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0]
const STRAY_CHANCE := 0.08
## Multiplies every piece and card count in GameData. 3.0 gives about 4,000 pieces and 4,100 cards.
const VOLUME := 3.0
## Share of each game that has spilled onto the floor beside its table.
const SPILL := 0.22
## Share of card piles left face up (hands are always face up).
const FACE_UP := 0.7
const PIECE_SCALE := 1.1
const CARD_SCALE := 1.65
## Which surface each game line is played on.
const PLAYED_ON := {"plum": "dining", "atlas": "gametable", "harbor": "cardtable", "honey": "coffee", "orchard": "bench",
	"casino": "poker", "ccg": "ccgtable",
	"wyrm": "round", "hoard": "dicetable", "caverns": "curio", "crowns": "war",
	"paints": "paintdesk", "marbles": "ring"}
## Every room has its own shelf for the games played in it: [line ids, position, turn, columns, sign].
const ROOM_SHELVES := [
	[["plum", "atlas", "harbor", "honey", "orchard"], Vector3(0, 0, -4.69), 0.0, 3, "Game Shelf"],
	[["casino", "ccg"], Vector3(-12.89, 0, 4.8), PI / 2, 1, "Card Room"],
	[["wyrm", "hoard", "caverns", "crowns"], Vector3(7.6, 0, 0.11), 0.0, 2, "Dragon's Den"],
	[["paints", "marbles"], Vector3(1.6, 0, 13.09), PI, 1, "Hobby Studio"],
]
## Height of each shelf cubby; every game's stack of boxes has to fit with room to spare.
const CUBBY_H := 1.0
const DOOR_W := 1.4
const DOOR_H := 2.3
const TOOL_NAMES := [["Hands"], ["Seeker Lantern"], ["Dustpan"], ["Magnet"]]

var player: Player
var hud: Hud
var sfx: Sfx
var world: Node3D
var pieces: Pieces
var boxes: Array[GameBox] = []
var items: Array[Item] = []
var slots: Array[ShelfSlot] = []
var spots := {}
var rng := RandomNumberGenerator.new()

var started := false
var finished := false
var paused := false
var mixups := 0
var combo := 0
var start_ms := 0
var _quiet_until := 0.0
var _hint_marker: Label3D
var _hint_target: Variant = null
var _flicker: Array = []
var _flames: Array = []
var _noise := FastNoiseLite.new()
var _last_note_ms := 0
var streak := 0
var _last_sort_ms := 0
var _tidy_step := 0
var tokens := 0
var faces_root: Node
var levels := {}
var _beacons := {}
var _beacon_t := 0.0
var _fireflies: MultiMeshInstance3D
var _firefly_targets: Array = []
var _firefly_until := 0.0
var _beams: Array = []
var _spark_mat: StandardMaterial3D
var _spark_mesh: SphereMesh
var showcases := true          # fly the camera over each box as it's sorted
var sorted_count := 0
var _showcase_queue: Array = []
var _showcasing := false
var _skip_showcase := false
var _show_cam: Camera3D
var _touring := false
var _tour_i := 0
var _tour_home := {}           # box -> [parent, global transform, lid rotation]
var _tour_stand: Node3D
var _tour_yaw := 0.0
var _tour_drag := false
var _staged := {}
var _box_zones: Array = []     # where each open box waits on the floor
## Floor spills: how tall a heap may get before the spill spreads wider instead, and how far it may spread.
const FLOOR_PILE := 0.2
const FLOOR_GROW_MAX := 2.6
## The floor of each room, for keeping spills indoors.
const ROOM_FLOORS := {"living": Rect2(-5.85, -4.85, 11.7, 12.3), "card": Rect2(-13.05, 2.15, 6.8, 5.3),
	"den": Rect2(6.35, -0.05, 7.7, 7.5), "studio": Rect2(-3.25, 7.95, 6.5, 5.3)}
var settled := false           # everything has been set down onto what's really under it
var ground_report := {}              # pieces and card piles already placed by a game's mid-game scene


## A height map over a play surface, so pieces pile on top of each other instead of overlapping.
class HMap:
	extends RefCounted
	var x0 := 0.0
	var z0 := 0.0
	var y0 := 0.0
	var nx := 1
	var nz := 1
	var cell := 0.012
	var h := PackedFloat32Array()

	func _init(center: Vector3, ext: Vector2) -> void:
		x0 = center.x - ext.x
		z0 = center.z - ext.y
		y0 = center.y
		nx = int(ext.x * 2.0 / cell) + 1
		nz = int(ext.y * 2.0 / cell) + 1
		h.resize(nx * nz)

	func _span(x: float, z: float, r: float) -> Array:
		return [clampi(int((x - r - x0) / cell), 0, nx - 1), clampi(int((x + r - x0) / cell), 0, nx - 1),
			clampi(int((z - r - z0) / cell), 0, nz - 1), clampi(int((z + r - z0) / cell), 0, nz - 1)]

	func top(x: float, z: float, r: float) -> float:
		var s := _span(x, z, r)
		var m := 0.0
		for j in range(s[2], s[3] + 1):
			for i in range(s[0], s[1] + 1):
				m = maxf(m, h[j * nx + i])
		return y0 + m

	func raise(x: float, z: float, r: float, to: float) -> void:
		var s := _span(x, z, r)
		for j in range(s[2], s[3] + 1):
			for i in range(s[0], s[1] + 1):
				h[j * nx + i] = maxf(h[j * nx + i], to - y0)


func _ready() -> void:
	rng.randomize()
	_noise.frequency = 1.0
	_setup_input()
	world = Node3D.new()
	world.name = "World"
	add_child(world)
	sfx = Sfx.new()
	add_child(sfx)
	_build_environment()
	_build_room()
	_build_fireplace()
	_build_furniture()
	_build_decor()
	_build_extra_lights()
	_build_card_room()
	_build_den()
	_build_studio()

	faces_root = Node.new()
	faces_root.name = "CardFaces"
	add_child(faces_root)
	pieces = Pieces.new()
	add_child(pieces)
	pieces.clacked.connect(_on_piece_clack)
	_define_spots()
	var lines := GameData.LINES.duplicate()
	for sh in ROOM_SHELVES:
		var ids: Array = sh[0]
		var mine := lines.filter(func(l): return ids.has(l.id))
		mine.shuffle()
		_build_shelf(mine, sh[1], sh[2], sh[3], sh[4])
	for line in lines:
		_deal_line(line, spots[PLAYED_ON[line.id]])
	pieces.build()
	_fit_shelf_ghosts()

	player = Player.new()
	add_child(player)
	player.pieces = pieces
	player.boxes_ref = boxes
	player.global_position = Vector3(0.6, 0.05, 3.9)
	player.look_at_yaw(0.05, -0.12)
	player.prompt_changed.connect(_on_prompt)
	player.acted.connect(_on_player_acted)

	hud = Hud.new()
	add_child(hud)
	hud.start_pressed.connect(_start)
	hud.resume_pressed.connect(func(): _set_paused(false))
	hud.restart_pressed.connect(_restart)
	hud.quit_pressed.connect(func(): get_tree().quit())
	hud.tool_changed.connect(func(i): player.set_tool(i))
	player.tool_changed.connect(func(i): hud.set_tools(TOOL_NAMES, player.unlocked, i))
	hud.set_tools(TOOL_NAMES, player.unlocked, 0)
	hud.buy_pressed.connect(_buy)
	_apply_upgrades()
	hud.shop_closed.connect(func(): _toggle_shop(false))
	hud.tour_pressed.connect(_tour_start)
	hud.tour_step.connect(_tour_show_step)
	hud.tour_done.connect(_tour_end)
	_refresh_hud()
	_update_tidy()
	hud.show_title(true)
	_quiet_until = Time.get_ticks_msec() / 1000.0 + 3.0
	_settle_everything()

	var args := OS.get_cmdline_user_args()
	if "--autotest" in args:
		_autotest()
	elif "--shot" in args:
		_screenshots()
	elif "--map" in args:
		_render_map(args[args.find("--map") + 1])
	elif "--rooms" in args:
		_room_shots(args[args.find("--rooms") + 1])
	elif "--sets" in args:
		_set_shots(args[args.find("--sets") + 1])
	elif "--tables" in args:
		_table_shots(args[args.find("--tables") + 1])


# ---------------------------------------------------------------- input

func _setup_input() -> void:
	var keys := {
		"move_forward": [KEY_W, KEY_UP], "move_back": [KEY_S, KEY_DOWN],
		"move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT],
		"sprint": [KEY_SHIFT], "crouch": [KEY_C, KEY_CTRL], "interact": [KEY_E],
		"throw": [KEY_Q], "hint": [KEY_H], "pause": [KEY_ESCAPE, KEY_P], "shop": [KEY_TAB, KEY_B],
		"peek": [KEY_F],
	}
	for a in keys:
		if not InputMap.has_action(a):
			InputMap.add_action(a)
		for k in keys[a]:
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(a, ev)


func _unhandled_input(e: InputEvent) -> void:
	if _touring:
		_tour_input(e)
		return
	if _showcasing:
		if (e is InputEventMouseButton and e.pressed) or e.is_action_pressed("interact") or e.is_action_pressed("pause"):
			_skip_showcase = true
			get_viewport().set_input_as_handled()
		return
	if not started or finished:
		return
	if e.is_action_pressed("shop") and not paused:
		_toggle_shop(not hud.shop_open())
		return
	if hud.shop_open():
		if e.is_action_pressed("pause"):
			_toggle_shop(false)
		return
	if e.is_action_pressed("pause"):
		_set_paused(not paused)
	elif e.is_action_pressed("hint") and not paused:
		_hint()


func _start() -> void:
	if started:
		return
	started = true
	hud.show_title(false)
	player.enabled = true
	start_ms = Time.get_ticks_msec()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	sfx.chord([PENTA[0], PENTA[2], PENTA[4]], 0.1, -12.0)
	hud.toast("Base games and expansions got mixed together. Every piece has its own box.", 4.0)


func _set_paused(on: bool) -> void:
	paused = on
	get_tree().paused = on
	hud.show_pause(on)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if on else Input.MOUSE_MODE_CAPTURED


func _restart() -> void:
	get_tree().paused = false
	get_tree().reload_current_scene()


# ---------------------------------------------------------------- dealing out a game line

func _deal_line(line: Dictionary, spot: Dictionary) -> void:
	var plans := []
	var depth := 0.3
	for ei in line.editions.size():
		var ed: Dictionary = line.editions[ei]
		var style := GameData.edition_style(line.color, ei, ed)
		var ed_key := "%s/%s" % [line.id, ed.id]
		var ed_name := GameData.full_name(line, ed)
		var groups := []
		var where := {}
		for part in ed.parts:
			var body: Color = part[3] if part.size() > 3 else style.body
			var tint: String = part[4] if part.size() > 4 else ""
			var g := pieces.make_group(line.id, ed_key, ed_name, part[0], body, style.accent, PIECE_SCALE, style.get("style", ""), tint)
			groups.append(g)
			where[g.key] = part[2]
			for n in int(round(part[1] * VOLUME)):
				pieces.add(g, Transform3D(), spot)
		var card_piles := {}
		var card_items: Array[Item] = []
		for si in ed.get("cards", []).size():
			var set_name: String = ed.cards[si][0]
			var total: int = int(round(ed.cards[si][1] * VOLUME))
			var stripe: Color = GameData.SET_COLORS[si % GameData.SET_COLORS.size()]
			var back_style: String = ed.cards[si][2] if ed.cards[si].size() > 2 else ""
			var back: Color = ed.cards[si][3] if ed.cards[si].size() > 3 else style.body
			var left := total
			var piles := 0
			while left > 0:
				# A mix of fanned hands, face-up spreads and draw piles.
				var roll := rng.randf()
				var mode := "fan" if roll < 0.3 else ("spread" if roll < 0.55 else "stack")
				var n := mini(left, {"fan": rng.randi_range(4, 6), "spread": rng.randi_range(6, 10), "stack": rng.randi_range(12, 48)}[mode])
				if left - n < 4:
					n = left
					mode = "stack" if n > 10 else mode
				card_items.append(_make_cards(ed_key, ed_name, back, stripe, set_name, n, mode, back_style, line.id))
				left -= n
				piles += 1
			card_piles[set_name] = {"cards": total, "piles": piles, "stripe": stripe}
		var entries := []
		for g in groups:
			entries.append({"key": g.key, "aabb": g.aabb_rest, "n": g.members.size()})
		for set_name in card_piles:
			entries.append({"key": "cards:" + set_name, "cards": card_piles[set_name].cards, "base": CARD_SCALE})
		var lay := GameBox.plan(entries)
		depth = maxf(depth, lay.depth)
		var extra: Array[Item] = []
		if ed.get("rules", true):
			extra.append(_make_rules(ed_key, ed_name, style.body, line, ed))
		if ed.board:
			extra.append(_make_board(ed_key, ed_name, style.body))
		plans.append({"ed": ed, "ei": ei, "groups": groups, "where": where, "card_piles": card_piles,
			"cards": card_items, "extra": extra, "lay": lay})

	# The open boxes wait in a row beside the table; all boxes in a line share a footprint.
	var dir := Basis(Vector3.UP, spot.rot) * Vector3.RIGHT
	for plan in plans:
		var box := GameBox.new()
		box.pieces_ref = pieces
		box.setup(line, plan.ed, plan.ei, plan.groups, plan.card_piles, plan.lay, depth)
		world.add_child(box)
		box.global_position = spot.row_start + dir * plan.ei * (box.W + 0.08)
		box.rotation.y = spot.rot
		boxes.append(box)
		box.progress_changed.connect(_on_box_progress)
		box.piece_landed.connect(_on_piece_landed)
		box.compartment_filled.connect(_on_compartment_filled)
		box.packed.connect(_on_box_packed)
		box.sorted.connect(_on_box_sorted)
		box.bounced.connect(_on_box_bounced)

	# Lay the game out on its surface: boards first, then everything else on top and around.
	for plan in plans:
		for it: Item in plan.extra:
			if it.kind == "board":
				_put_item(it, spot, spot.center, rng.randf_range(-0.15, 0.15))
				spot["board_xf"] = it.global_transform
				var hm: HMap = spot.hmap
				hm.raise(spot.center.x, spot.center.z, MeshKit.BOARD_SIZE / 2 - 0.01, spot.center.y + 0.013)
				spot["spaces"] = MeshKit.board_spaces()
				spot.spaces.shuffle()
	# First the game as it was being played; then everything else around it as supply and mess.
	_stage_line(line.id, plans, spot)
	for plan in plans:
		for g: Pieces.Group in plan.groups:
			_lay_out_group(g, plan.where[g.key], spot)
		for it: Item in plan.cards:
			if _staged.has(it):
				continue
			var home := spot
			if rng.randf() < STRAY_CHANCE:
				home = _stray_spot(spot)
			var at := _free_point(home, 0.06)
			if home.has("spill") and (_in_play(home, at) or (home.hmap as HMap).top(at.x, at.z, 0.06) > (home.center as Vector3).y + 0.09):
				home = spots[home.spill]
				at = _free_point(home, 0.06)
			_put_item(it, home, at, rng.randf_range(0, TAU))
		for it: Item in plan.extra:
			if it.kind == "rules":
				# Set aside off the play area: at the table's edge, or on the floor beside it.
				var home := spot
				var at := _free_point(spot, 0.14)
				if spot.has("spill") and (_in_play(spot, at) or (spot.hmap as HMap).top(at.x, at.z, 0.14) > (spot.center as Vector3).y + 0.09):
					home = spots[spot.spill]
					at = _free_point(home, 0.14)
				_put_item(it, home, at, rng.randf_range(0, TAU))


## Somewhere else in the same room, for the odd card pile that wandered off.
func _stray_spot(spot: Dictionary) -> Dictionary:
	var others := spots.values().filter(func(o: Dictionary): return o != spot and o.room == spot.room)
	if others.is_empty():
		return spot
	return others[rng.randi_range(0, others.size() - 1)]


func _free_point(spot: Dictionary, r: float) -> Vector3:
	var c: Vector3 = spot.center
	var ext: Vector2 = (spot.ext as Vector2) * float(spot.get("grow", 1.0))
	var hm: HMap = spot.hmap
	var inv: Transform3D = (spot.get("board_xf", Transform3D(Basis(), Vector3(999, 0, 999))) as Transform3D).affine_inverse()
	var best := c
	var best_h := INF
	for t in 10:
		var p := c + Vector3(rng.randf_range(-ext.x + r, ext.x - r), 0, rng.randf_range(-ext.y + r, ext.y - r))
		var l := inv * p
		var on_board := absf(l.x) < 0.27 and absf(l.z) < 0.27
		var hh := hm.top(p.x, p.z, r) + (0.05 if on_board else 0.0) + rng.randf() * 0.01
		if _in_play(spot, p):
			hh += 10.0
		if spot.get("floor", false) and _off_floor(spot, p):
			hh += 10.0
		if hh < best_h:
			best_h = hh
			best = p
	return best


## For spills on the floor: whether a point is outside the room or where an open box waits.
func _off_floor(spot: Dictionary, p: Vector3) -> bool:
	var room: Rect2 = ROOM_FLOORS.get(spot.get("room", ""), Rect2(-100, -100, 200, 200))
	if not room.has_point(Vector2(p.x, p.z)):
		return true
	for b: Vector3 in _box_zones:
		if absf(p.x - b.x) < 0.55 and absf(p.z - b.z) < 0.55:
			return true
	return false


## Whether a point is in the part of the table where the game is being played.
func _in_play(spot: Dictionary, p: Vector3) -> bool:
	if not spot.has("play"):
		return false
	var c: Vector3 = spot.center
	var pl: Vector2 = spot.play
	return absf(p.x - c.x) < pl.x and absf(p.z - c.z) < pl.y


## Sets a piece down on top of whatever is already there. If the pile would get taller than
## max_pile, it goes somewhere less crowded instead, so heaps spread out rather than tower.
func _place_piece(p: Pieces.P, spot: Dictionary, x: float, z: float, yaw: float, max_pile := 0.07) -> void:
	var hm: HMap = spot.hmap
	var bb := p.g.aabb_table
	var r := maxf(bb.size.x, bb.size.z) * 0.42
	if spot.get("floor", false):
		# A spill: if this spot's heap is already knee-high, find room further out, and let the
		# whole spill spread a little wider when it runs out of room.
		var tries := 0
		while (hm.top(x, z, r) + bb.size.y > FLOOR_PILE or _off_floor(spot, Vector3(x, 0, z))) and tries < 40:
			if tries % 4 == 3:
				spot.grow = minf(float(spot.grow) * 1.12, FLOOR_GROW_MAX)
			var q := _free_point(spot, r * 2.0)
			x = q.x
			z = q.z
			tries += 1
		var y := hm.top(x, z, r)
		hm.raise(x, z, r, y + bb.size.y)
		p.xf = Transform3D(Basis(Vector3.UP, yaw), Vector3(x, y - bb.position.y + 0.0005, z))
		p.home = spot
		return
	var y := hm.top(x, z, r)
	var tries := 0
	while y + bb.size.y - (spot.center as Vector3).y > max_pile and tries < 6:
		var q := _free_point(spot, r * 2.0)
		x = q.x + rng.randf_range(-r, r)
		z = q.z + rng.randf_range(-r, r)
		y = hm.top(x, z, r)
		tries += 1
	if max_pile < 0.5 and spot.has("spill") and (_in_play(spot, Vector3(x, 0, z)) or y + bb.size.y - (spot.center as Vector3).y > max_pile):
		# No room round the game: it has ended up on the floor beside the table.
		var fl: Dictionary = spots[spot.spill]
		var q := _free_point(fl, r * 2.0)
		_place_piece(p, fl, q.x, q.z, yaw)
		return
	hm.raise(x, z, r, y + bb.size.y)
	p.xf = Transform3D(Basis(Vector3.UP, yaw), Vector3(x, y - bb.position.y + 0.0005, z))
	p.home = spot


func _lay_out_group(g: Pieces.Group, how: String, spot: Dictionary) -> void:
	var list := g.members.filter(func(p: Pieces.P): return not _staged.has(p))
	var bb := g.aabb_table
	var step := maxf(bb.size.x, bb.size.z) + 0.006
	# Some of every game has spilled off the table onto the floor beside it.
	if spot.has("spill") and how != "board":
		var spill: Dictionary = spots[spot.spill]
		var n := int(list.size() * SPILL)
		if n > 0:
			var fell := list.slice(0, n)
			list = list.slice(n)
			var c := _free_point(spill, step * 2.0)
			for k in fell.size():
				var a := k * 2.4
				var rr := step * 0.5 * sqrt(float(k))
				var q := c + Vector3(cos(a) * rr, 0, sin(a) * rr) if rng.randf() < 0.7 else _free_point(spill, step)
				_place_piece(fell[k], spill, q.x, q.z, rng.randf_range(0, TAU))
	# A few strays wander off to other tables or the couch.
	for p: Pieces.P in list.duplicate():
		if rng.randf() < STRAY_CHANCE:
			var s := _stray_spot(spot)
			var q := _free_point(s, step)
			_place_piece(p, s, q.x, q.z, rng.randf_range(0, TAU))
			list.erase(p)
	match how:
		"board":
			for p: Pieces.P in list:
				if spot.has("spaces") and not spot.spaces.is_empty():
					var sp: Vector2 = spot.spaces.pop_back()
					var w: Vector3 = (spot.board_xf as Transform3D) * Vector3(sp.x, 0, sp.y)
					_place_piece(p, spot, w.x, w.z, rng.randf_range(0, TAU))
				else:
					var q := _free_point(spot, step)
					_place_piece(p, spot, q.x, q.z, rng.randf_range(0, TAU))
		"formation":
			# Ranks of miniatures, mid-battle.
			var per_unit := 10
			var i := 0
			while i < list.size():
				var c := _free_point(spot, step * 3.0)
				var facing := rng.randf_range(0, TAU)
				var basis := Basis(Vector3.UP, facing)
				for k in mini(per_unit, list.size() - i):
					var off := basis * Vector3((k % 5 - 2) * step, 0, (k / 5) * step)
					_place_piece(list[i], spot, c.x + off.x, c.z + off.z, facing + PI + rng.randf_range(-0.15, 0.15))
					i += 1
		"stack":
			var i := 0
			while i < list.size():
				var c := _free_point(spot, step)
				for k in mini(rng.randi_range(5, 10), list.size() - i):
					_place_piece(list[i], spot, c.x + rng.randf_range(-0.002, 0.002), c.z + rng.randf_range(-0.002, 0.002), rng.randf_range(0, TAU), 0.1)
					i += 1
		"heap":
			var i := 0
			while i < list.size():
				var c := _free_point(spot, step * 2.0)
				for k in mini(rng.randi_range(10, 22), list.size() - i):
					var a := k * 2.4
					var rr := step * 0.7 * sqrt(float(k))
					_place_piece(list[i], spot, c.x + cos(a) * rr, c.z + sin(a) * rr, rng.randf_range(0, TAU))
					i += 1
		_:
			for p: Pieces.P in list:
				var q := _free_point(spot, step)
				_place_piece(p, spot, q.x, q.z, rng.randf_range(0, TAU))


# ---------------------------------------------------------------- mid-game scenes

## Up to n pieces of a type (and colour, if given) from this game line that haven't been placed
## yet, base game first.
func _pick(plans: Array, type: String, n: int, tint := "") -> Array:
	var out := []
	for plan in plans:
		for g: Pieces.Group in plan.groups:
			if g.type != type or (tint != "" and g.tint_name != tint):
				continue
			for p: Pieces.P in g.members:
				if out.size() >= n:
					return out
				if not _staged.has(p):
					out.append(p)
	return out


## Places a piece at a spot relative to the table's centre, exactly there (no wandering off).
func _put(p: Pieces.P, spot: Dictionary, lx: float, lz: float, yaw: float) -> void:
	var c: Vector3 = spot.center
	_staged[p] = true
	_place_piece(p, spot, c.x + lx, c.z + lz, yaw, 1.0)


## Places a list of pieces along a path given by f(i) -> Vector3(lx, lz, yaw).
func _put_all(list: Array, spot: Dictionary, f: Callable) -> void:
	for i in list.size():
		var v: Vector3 = f.call(i)
		_put(list[i], spot, v.x, v.y, v.z)


## Board-local coordinates (metres from the board's centre) to table-local ones.
func _bpos(spot: Dictionary, bx: float, bz: float) -> Vector2:
	var w: Vector3 = (spot.get("board_xf", Transform3D(Basis(), spot.center)) as Transform3D) * Vector3(bx, 0, bz)
	return Vector2(w.x - (spot.center as Vector3).x, w.z - (spot.center as Vector3).z)


## Tessellates hex tiles (pointy along x) into a honeycomb of the given columns and rows.
func _honeycomb(list: Array, spot: Dictionary, lx: float, lz: float, cols: int) -> Array:
	if list.is_empty():
		return []
	var r: float = (list[0] as Pieces.P).g.aabb_table.size.x / 2.0 + 0.001
	var cells := []
	for i in list.size():
		var c := i % cols
		var row := i / cols
		var x := lx + (c - (cols - 1) / 2.0) * r * 1.5
		var z := lz + row * r * sqrt(3.0) + (r * sqrt(3.0) / 2.0 if c % 2 == 1 else 0.0)
		_put(list[i], spot, x, z, 0.0)
		cells.append(Vector2(x, z))
	return cells


## Lays card piles out like a game in progress: a hand and a draw pile at each seat, and the
## face-up rows (a market, a battlefield) along the middle. seats: [lx, lz, facing yaw].
func _stage_cards(plans: Array, spot: Dictionary, seats: Array, rows: Array) -> void:
	var by_mode := {"fan": [], "stack": [], "spread": []}
	for plan in plans:
		for it: Item in plan.cards:
			by_mode[it.get_meta("mode", "stack")].append(it)
	var c: Vector3 = spot.center
	for s in seats:
		var out := Vector2(s[0], s[1]).normalized()
		var side := Vector2(-out.y, out.x)
		if not by_mode.fan.is_empty():
			var h: Item = by_mode.fan.pop_front()
			_staged[h] = true
			_put_item(h, spot, c + Vector3(s[0], 0, s[1]), s[2])
		if not by_mode.stack.is_empty():
			var d: Item = by_mode.stack.pop_front()
			_staged[d] = true
			var at := Vector2(s[0], s[1]) - out * 0.12 + side * 0.16
			_put_item(d, spot, c + Vector3(at.x, 0, at.y), s[2] + 0.05)
	for r in rows:
		if by_mode.spread.is_empty():
			break
		var it: Item = by_mode.spread.pop_front()
		_staged[it] = true
		_put_item(it, spot, c + Vector3(r[0], 0, r[1]), r[2])


## Sets each game up as if the players had just stood up from the table mid-game.
func _stage_line(id: String, plans: Array, spot: Dictionary) -> void:
	var j := func(a: float) -> float: return rng.randf_range(-a, a)
	match id:
		"crowns":
			# Two armies facing off across the battlefield: knights in ranks, a goblin horde.
			var knights := _pick(plans, "knight", 24)
			_put_all(knights, spot, func(i: int): return Vector3(-0.36 - (i / 8) * 0.065, -0.23 + (i % 8) * 0.065, PI / 2 + j.call(0.06)))
			var gob := _pick(plans, "goblin", 30)
			_put_all(gob, spot, func(i: int):
				var a := i * 2.4
				var rr := 0.035 * sqrt(float(i))
				return Vector3(0.5 + cos(a) * rr * 0.8, sin(a) * rr * 1.3, -PI / 2 + j.call(0.5)))
			var towers := _pick(plans, "tower", 4)
			var tp := [Vector3(-0.8, -0.3, 0.0), Vector3(0.8, 0.3, 0.0), Vector3(-0.1, -0.12, 0.3), Vector3(0.12, 0.14, 0.0)]
			_put_all(towers, spot, func(i: int): return tp[i])
			_put_all(_pick(plans, "crown", 2), spot, func(i: int): return [Vector3(-0.8, -0.3, 0.0), Vector3(0.8, 0.3, 0.0)][i])
			_put_all(_pick(plans, "die", 6), spot, func(i: int): return Vector3(-0.05 + i * 0.07 + j.call(0.02), 0.38 + j.call(0.03), randf() * TAU))
			_put_all(_pick(plans, "coin", 12), spot, func(i: int): return Vector3(-0.82 if i < 6 else 0.82, 0.38 if i < 6 else -0.38, randf() * TAU))
			_put_all(_pick(plans, "cube", 8), spot, func(i: int): return Vector3(0.28 + j.call(0.04), -0.15 + i * 0.04, randf() * TAU))
			_stage_cards(plans, spot, [[-0.6, 0.42, 0.0], [0.6, -0.42, PI]], [[-0.3, 0.3, 0.0], [0.3, -0.3, 0.0]])
		"plum":
			# Four players round the table, each with a hero, coins, gems, a cup of tea and cake;
			# the card market runs along the middle.
			var seats := [[-0.5, 0.36, 0.0], [0.5, 0.36, 0.0], [-0.5, -0.36, PI], [0.5, -0.36, PI]]
			var heroes := _pick(plans, "hero", 4)
			for k in seats.size():
				var sx: float = seats[k][0]
				var sz: float = seats[k][1]
				var inward := -signf(sz)
				if k < heroes.size():
					_put(heroes[k], spot, sx, sz + inward * 0.12, 0.0 if sz > 0 else PI)
				for coin in _pick(plans, "coin", 7):
					_put(coin, spot, sx - 0.17, sz + inward * 0.08, randf() * TAU)
				_put_all(_pick(plans, "gem", 4), spot, func(i: int): return Vector3(sx + 0.15 + j.call(0.03), sz + inward * 0.08 + j.call(0.03), randf() * TAU))
				_put_all(_pick(plans, "cube", 4), spot, func(i: int): return Vector3(sx + 0.24 + j.call(0.02), sz + inward * 0.02 + j.call(0.03), randf() * TAU))
				_put_all(_pick(plans, "teacup", 1), spot, func(_i: int): return Vector3(sx + 0.3, sz + inward * 0.1, randf() * TAU))
				_put_all(_pick(plans, "cake", 1), spot, func(_i: int): return Vector3(sx + 0.36, sz + inward * 0.02, randf() * TAU))
			_put_all(_pick(plans, "hex", 8), spot, func(i: int): return Vector3(0.0, -0.32 + j.call(0.002), 0.0))
			_put_all(_pick(plans, "die", 1), spot, func(_i: int): return Vector3(0.18, 0.05, randf() * TAU))
			_stage_cards(plans, spot, seats, [[-0.62, 0.0, PI / 2], [0.62, 0.0, PI / 2], [-0.38, 0.0, PI / 2], [0.38, 0.0, PI / 2]])
		"atlas":
			# Stars charted across the board, a hex map of explored space beside it.
			_put_all(_pick(plans, "star", 14), spot, func(i: int):
				var b := _bpos(spot, rng.randf_range(-0.16, 0.16), rng.randf_range(-0.16, 0.16))
				return Vector3(b.x, b.y, randf() * TAU))
			_honeycomb(_pick(plans, "hex", 16), spot, 0.5, -0.32, 4)
			_put_all(_pick(plans, "die", 4), spot, func(i: int): return Vector3(-0.42 + j.call(0.05), 0.3 + i * 0.05, randf() * TAU))
			_put_all(_pick(plans, "gem", 10), spot, func(i: int): return Vector3(-0.5 + (i % 5) * 0.035, -0.32 + (i / 5) * 0.04, randf() * TAU))
		"harbor":
			# Coins and lanterns by each captain; cubes of cargo loaded at the docks.
			for k in 4:
				var a := k * PI / 2 + PI / 4
				var sp := Vector2(cos(a), sin(a)) * 0.38
				for coin in _pick(plans, "coin", 6):
					_put(coin, spot, sp.x, sp.y, randf() * TAU)
				_put_all(_pick(plans, "lantern", 2), spot, func(i: int): return Vector3(sp.x * 0.75 + (i - 0.5) * 0.06, sp.y * 0.75, randf() * TAU))
			_put_all(_pick(plans, "cube", 12), spot, func(i: int):
				var b := _bpos(spot, -0.2 + (i % 4) * 0.035, -0.2 + (i / 4) * 0.035)
				return Vector3(b.x, b.y, 0.0))
		"honey":
			# Tiles laid in a honeycomb across the board, with bees and honey on them.
			var cells := _honeycomb(_pick(plans, "hex", 18), spot, 0.0, -0.17, 6)
			var bees := _pick(plans, "bee", 8)
			for k in mini(bees.size(), cells.size()):
				var cl: Vector2 = cells[(k * 5) % cells.size()]
				_put(bees[k], spot, cl.x, cl.y, randf() * TAU)
			var honey := _pick(plans, "honey", 6)
			for k in mini(honey.size(), cells.size()):
				var cl: Vector2 = cells[(k * 7 + 3) % cells.size()]
				_put(honey[k], spot, cl.x, cl.y, randf() * TAU)
		"orchard":
			# Baskets down the bench, each with apples in it; farmers at work in between.
			var baskets := _pick(plans, "basket", 6)
			for k in baskets.size():
				var z := (-0.85 + k * 0.12) if k < 3 else (0.55 + (k - 3) * 0.12)
				_put(baskets[k], spot, 0.0, z, j.call(0.3))
				for apple in _pick(plans, "apple", 3):
					_put(apple, spot, j.call(0.012), z + j.call(0.012), randf() * TAU)
			_put_all(_pick(plans, "teacup", 1), spot, func(_i: int): return Vector3(0.18, 0.95, 0.0))
		"wyrm":
			# A dungeon mapped out in tiles on the board: the party at the door, skeletons in the
			# next room, a dragon guarding the treasure at the far end.
			var tiles := _pick(plans, "tile", 20)
			var ts: float = 0.0
			if not tiles.is_empty():
				ts = (tiles[0] as Pieces.P).g.aabb_table.size.x + 0.002
			_put_all(tiles, spot, func(i: int):
				var b := _bpos(spot, (i % 5 - 2) * ts, (i / 5 - 1.5) * ts)
				return Vector3(b.x, b.y, 0.0))
			var cell := func(cx: int, cz: int) -> Vector2: return _bpos(spot, (cx - 2) * ts, (cz - 1.5) * ts)
			var heroes := _pick(plans, "hero", 4)
			for k in heroes.size():
				var cc: Vector2 = cell.call(0, k)
				_put(heroes[k], spot, cc.x, cc.y, PI / 2)
			var skel := _pick(plans, "skeleton", 5)
			for k in skel.size():
				var cc: Vector2 = cell.call(2 + k % 2, k / 2 + 1)
				_put(skel[k], spot, cc.x, cc.y, -PI / 2)
			var sl := _pick(plans, "slime", 2)
			for k in sl.size():
				var cc: Vector2 = cell.call(2, k * 3)
				_put(sl[k], spot, cc.x, cc.y, randf() * TAU)
			for d in _pick(plans, "dragon", 1):
				var cc: Vector2 = cell.call(4, 1)
				_put(d, spot, cc.x, cc.y, -PI / 2)
			for ch in _pick(plans, "chest", 1):
				var cc: Vector2 = cell.call(4, 3)
				_put(ch, spot, cc.x, cc.y, -PI / 2)
			var seats := [[-0.5, 0.0, -PI / 2], [0.5, 0.0, PI / 2], [0.0, -0.5, PI], [0.0, 0.5, 0.0]]
			for s in seats:
				var sp := Vector2(s[0], s[1]) * 0.8
				_put_all(_pick(plans, "potion", 1), spot, func(_i: int): return Vector3(sp.x + 0.08, sp.y + 0.08, 0.0))
				for t in ["d20", "d12", "d8", "d6p", "d4"]:
					_put_all(_pick(plans, t, 1), spot, func(_i: int): return Vector3(sp.x + j.call(0.06), sp.y + j.call(0.06), randf() * TAU))
			_stage_cards(plans, spot, seats, [])
		"hoard":
			# Four sets rolled out in the tray, one of each die, and a neat line of d20s.
			var types := ["d4", "d6p", "d8", "d10", "d10p", "d12", "d20"]
			for q in 4:
				var a := q * PI / 2 + PI / 4
				var cpos := Vector2(cos(a), sin(a)) * 0.17
				for t in types:
					for d in _pick(plans, t, 1):
						_put(d, spot, cpos.x + j.call(0.06), cpos.y + j.call(0.06), randf() * TAU)
			_put_all(_pick(plans, "d20", 7), spot, func(i: int): return Vector3(-0.18 + i * 0.06, 0.0, 0.0))
		"casino":
			# A hand of poker interrupted: chip stacks at six seats, the pot in the middle, the
			# dealer button at one seat and the flop face up.
			var colors := ["white", "red", "blue", "green", "black", "purple", "gold", "pink", "cyan", "lime"]
			for k in 6:
				var a := k * TAU / 6.0
				var sp := Vector2(cos(a) * 0.52, sin(a) * 0.3)
				for st in 3:
					var col: String = colors[(k + st * 3) % colors.size()]
					var off := Vector2(-sin(a), cos(a)) * ((st - 1) * 0.045)
					for chip in _pick(plans, "chip", 6 - st, col):
						_put(chip, spot, sp.x + off.x + j.call(0.0015), sp.y + off.y + j.call(0.0015), randf() * TAU)
			for k in 18:
				for chip in _pick(plans, "chip", 1, colors[k % 6]):
					var a := k * 2.4
					var rr := 0.012 * sqrt(float(k))
					_put(chip, spot, 0.12 + cos(a) * rr, sin(a) * rr, randf() * TAU)
			_put_all(_pick(plans, "dealer", 1), spot, func(_i: int): return Vector3(0.36, 0.18, 0.0))
			_put_all(_pick(plans, "plaque", 3), spot, func(i: int): return Vector3(-0.42, -0.1 + i * 0.002, 0.2))
			var seats := []
			for k in 6:
				var a := k * TAU / 6.0
				seats.append([cos(a) * 0.4, sin(a) * 0.22, -a + PI / 2])
			_stage_cards(plans, spot, seats, [[-0.1, 0.0, PI / 2]])
		"ccg":
			# A duel: each player's battlefield of face-up cards with counters on them, a deck,
			# a hand, deck boxes and toploaders to the side.
			_stage_cards(plans, spot, [[0.0, 0.42, 0.0], [0.0, -0.42, PI]], [[-0.2, 0.15, 0.0], [0.2, 0.15, 0.0], [-0.2, -0.15, PI], [0.2, -0.15, PI]])
			for side in [1.0, -1.0]:
				_put_all(_pick(plans, "counter", 5), spot, func(i: int): return Vector3(-0.28 + i * 0.12 + j.call(0.02), side * 0.15 + j.call(0.03), 0.0))
				_put_all(_pick(plans, "deckbox", 1), spot, func(_i: int): return Vector3(-0.52, side * 0.36, 0.0))
				_put_all(_pick(plans, "toploader", 3), spot, func(i: int): return Vector3(0.52, side * 0.36, 0.1 * i))
		"caverns":
			# The collection set out in rings by kind: shards outside, clusters, then cut gems
			# round a geode in the middle.
			_put_all(_pick(plans, "shard", 14), spot, func(i: int): return Vector3(cos(i * TAU / 14) * 0.27, sin(i * TAU / 14) * 0.27, i * TAU / 14))
			_put_all(_pick(plans, "cluster", 7), spot, func(i: int): return Vector3(cos(i * TAU / 7) * 0.17, sin(i * TAU / 7) * 0.17, randf() * TAU))
			_put_all(_pick(plans, "cutgem", 6), spot, func(i: int): return Vector3(cos(i * TAU / 6) * 0.09, sin(i * TAU / 6) * 0.09, randf() * TAU))
			_put_all(_pick(plans, "geode", 1), spot, func(_i: int): return Vector3(0, 0, 0.4))
		"marbles":
			# A game of ringer: thirteen marbles in a cross in the middle, shooters at the edge,
			# and a few already knocked loose.
			var cross := []
			for k in range(-3, 4):
				cross.append(Vector2(k * 0.03, 0))
				if k != 0:
					cross.append(Vector2(0, k * 0.03))
			_put_all(_pick(plans, "cateye", cross.size()), spot, func(i: int): return Vector3(cross[i].x, cross[i].y, randf() * TAU))
			_put_all(_pick(plans, "shooter", 4), spot, func(i: int): return Vector3(cos(i * PI / 2 + 0.3) * 0.36, sin(i * PI / 2 + 0.3) * 0.36, 0.0))
			_put_all(_pick(plans, "pearl", 8), spot, func(i: int): return Vector3(cos(i * 1.3) * 0.2 + j.call(0.03), sin(i * 1.3) * 0.2 + j.call(0.03), 0.0))
		"paints":
			# Pots lined up in rows along the back of the desk, washes in front, brushes laid
			# side by side and the primers standing at the end.
			var pots := _pick(plans, "pot", 36)
			_put_all(pots, spot, func(i: int): return Vector3(-0.62 + (i % 18) * 0.045, -0.15 + (i / 18) * 0.05, 0.0))
			_put_all(_pick(plans, "dropper", 9), spot, func(i: int): return Vector3(-0.6 + i * 0.04, -0.04, 0.0))
			_put_all(_pick(plans, "brush", 8), spot, func(i: int): return Vector3(0.3 + i * 0.03, 0.08, 0.0))
			_put_all(_pick(plans, "spray", 3), spot, func(i: int): return Vector3(0.6, -0.12 + i * 0.07, 0.0))


# ---------------------------------------------------------------- setting things down

## Sets every piece, card pile, board and rulebook down onto whatever is really beneath it. The
## layout plans heights with a coarse height map, which can leave a piece hovering over the edge
## of its neighbour or nudged into it; here rays at the centre and corners of each footprint
## find the real surface. Lowest things go first so what rests on them follows, and it runs a
## few passes so whole piles settle.
func _settle_everything() -> void:
	var worst_first := 0.0
	var moved := {}
	# Each pass settles a pile one more layer down (the physics world only sees where things
	# moved to after a frame), so keep going until nothing is left to move.
	var passes := 0
	for pass_i in 20:
		await get_tree().physics_frame
		await get_tree().physics_frame
		# Only the first pass may lift something out of an overlap; after that things only come
		# down, or two overlapping pieces would keep climbing onto each other into a tower.
		var r := _settle_pass(true, pass_i == 0)
		passes += 1
		if pass_i == 0:
			worst_first = r.worst
		for o in r.moved:
			moved[o] = true
		if r.floating == 0 and pass_i >= 1:
			break
	await get_tree().physics_frame
	await get_tree().physics_frame
	var after := _settle_pass(false)
	ground_report = {"moved": moved.size(), "passes": passes, "worst_before_mm": worst_first * 1000.0, "floating_after": after.floating, "worst_after_mm": after.worst * 1000.0}
	settled = true


## One pass: returns {worst: biggest gap found, floating: how many hover over 2 mm, moved: [...]}.
func _settle_pass(apply: bool, allow_raise := true) -> Dictionary:
	var space := get_world_3d().direct_space_state
	var mask := Item.LAYER_WORLD | Item.LAYER_ITEMS
	var todo := []
	for p: Pieces.P in pieces.all:
		if p.state != Pieces.LOOSE:
			continue
		var bb: AABB = Transform3D(p.xf.basis) * p.g.aabb_table
		todo.append([p.xf.origin.y + bb.position.y, p, bb])
	for it: Item in items:
		if it.stored or it.held or not it.is_inside_tree() or not it.freeze:
			continue
		var ib := MeshKit.scaled_aabb(MeshKit.visual_aabb(it.visual, Vector3.ZERO), it.base_scale)
		ib = Transform3D(Basis(Vector3.UP, it.rotation.y)) * ib
		todo.append([it.global_position.y + ib.position.y, it, ib])
	todo.sort_custom(func(a, b): return a[0] < b[0])
	var worst := 0.0
	var floating := 0
	var moved := []
	for e in todo:
		var bottom: float = e[0]
		var obj: Variant = e[1]
		var bb: AABB = e[2]
		var origin: Vector3 = (obj as Pieces.P).xf.origin if obj is Pieces.P else (obj as Item).global_position
		var rid: RID = (obj as Pieces.P).body if obj is Pieces.P else (obj as Item).get_rid()
		var c := Vector3(origin.x + bb.get_center().x, 0, origin.z + bb.get_center().z)
		var support := -INF
		for off in [Vector2.ZERO, Vector2(0.3, 0.3), Vector2(-0.3, 0.3), Vector2(0.3, -0.3), Vector2(-0.3, -0.3)]:
			var at := c + Vector3(off.x * bb.size.x, 0, off.y * bb.size.z)
			var q := PhysicsRayQueryParameters3D.create(Vector3(at.x, bottom + bb.size.y + 0.002, at.z), Vector3(at.x, bottom - 1.2, at.z), mask)
			q.exclude = [rid]
			var hit := space.intersect_ray(q)
			if not hit.is_empty():
				support = maxf(support, (hit.position as Vector3).y)
		if support == -INF:
			continue
		var gap := bottom - support
		if gap > 0.002:
			floating += 1
		worst = maxf(worst, gap)
		if not apply or absf(gap) < 0.0005:
			continue
		var dy := support + 0.0004 - bottom
		if dy > 0.0 and not allow_raise:
			continue
		if obj is Pieces.P:
			var p := obj as Pieces.P
			var xf := p.xf
			xf.origin.y += dy
			pieces.set_loose(p, xf)
		else:
			(obj as Item).global_position.y += dy
		moved.append(obj)
	return {"worst": worst, "floating": floating, "moved": moved}


## When something is lifted off a pile, whatever was resting on it settles down naturally.
func _release_above(at: Vector3) -> void:
	for other: Item in items:
		if other.freeze and not other.held and not other.stored and other.kind != "box" \
				and other.global_position.y > at.y - 0.01 \
				and Vector2(other.global_position.x - at.x, other.global_position.z - at.z).length() < 0.35:
			other.freeze = false
			other.sleeping = false


func _put_item(it: Item, spot: Dictionary, at: Vector3, yaw: float) -> void:
	var hm: HMap = spot.hmap
	var bb := MeshKit.scaled_aabb(MeshKit.visual_aabb(it.visual, Vector3.ZERO), it.base_scale)
	var r := maxf(bb.size.x, bb.size.z) * 0.45
	var y := hm.top(at.x, at.z, r)
	hm.raise(at.x, at.z, r, y + bb.size.y)
	it.home = spot
	world.add_child(it)
	it.global_position = Vector3(at.x, y - bb.position.y + 0.002, at.z)
	it.rotation.y = yaw
	# Like the pieces, anything laid out on a table stays exactly where it was left until
	# the player picks it up, so nothing slides off into a box by itself.
	it.freeze_mode = RigidBody3D.FREEZE_MODE_STATIC
	it.freeze = true
	if not items.has(it):
		items.append(it)
		it.clacked.connect(_on_clack)


func _make_cards(ed_key: String, ed_name: String, c: Color, stripe: Color, set_name: String, n: int, mode: String, back_style := "", line_id := "") -> Item:
	var it := Item.new()
	it.game_id = ed_key
	it.kind = "cards"
	it.card_count = n
	it.card_set = set_name
	it.card_stripe = stripe
	it.card_style = back_style
	it.card_back = c
	it.label = "%d %s cards (%s)" % [n, set_name, ed_name]
	# Card fronts: hands lie face up, and most piles show their top card, so you can see the cards
	# just by looking around the room.
	it.set_meta("mode", mode)
	it.card_faces = FaceKit.faces(faces_root, line_id, set_name, c, stripe, back_style)
	if mode != "stack" or rng.randf() < FACE_UP:
		it.card_top_face = it.card_faces[rng.randi_range(0, it.card_faces.size() - 1)]
	var parts: Array
	match mode:
		"fan":
			parts = MeshKit.card_hand(c, n, stripe, back_style, it.card_faces)
		"spread":
			parts = MeshKit.card_spread(n, it.card_faces)
		_:
			parts = MeshKit.card_stack(c, n, stripe, back_style, it.card_top_face)
	_attach(it, parts, CARD_SCALE)
	it.mass = 0.02 + n * 0.002
	return it


func _make_rules(ed_key: String, ed_name: String, c: Color, line: Dictionary, ed: Dictionary) -> Item:
	var it := Item.new()
	it.game_id = ed_key
	it.kind = "rules"
	it.label = "%s rulebook" % ed_name
	# A printed cover: the game's logo on the cover colour, and a RULEBOOK band near the bottom.
	var cover := LogoKit.print_surface(faces_root, line.id, line.name, ed.name, Vector2i(512, 694), null, c.darkened(0.15),
		Rect2(16, 70, 480, 300), c.lightened(0.35))
	var band := LogoKit.plaque(faces_root, "RULEBOOK", Vector2i(512, 82), c.lightened(0.35), c.darkened(0.6), c.darkened(0.35))
	_attach(it, MeshKit.rulebook(c, ed_name, cover, band), 1.0)
	it.mass = 0.15
	return it


func _make_board(ed_key: String, ed_name: String, c: Color) -> Item:
	var it := Item.new()
	it.game_id = ed_key
	it.kind = "board"
	it.label = "%s board" % ed_name
	_attach(it, MeshKit.board(c, rng.randi()), 1.0)
	it.mass = 0.3
	return it


func _attach(it: Item, parts: Array, k: float) -> void:
	it.visual = parts[0]
	it.visual.scale = Vector3.ONE * k
	it.base_scale = k
	it.add_child(it.visual)
	var cs := CollisionShape3D.new()
	cs.shape = MeshKit.scaled_shape(parts[1], k)
	cs.position = parts[2] * k
	it.add_child(cs)
	it.rest_rotation = parts[3]


# ---------------------------------------------------------------- game flow

func _on_prompt(text: String) -> void:
	hud.set_prompt(text)


func _on_player_acted(kind: String, data: Variant) -> void:
	if kind == "peek":
		var pb := data as GameBox
		pb.peek(not pb.peeking)
		sfx.at("thunk", pb.global_position, -8.0, 1.6)
		if pb.peeking:
			_sparkle(pb.insert_top(), 16, 0.6, Color("ffe7a8"))
		return
	match kind:
		"pick":
			var it := data as Item
			sfx.at("tick", it.global_position, -4.0, 1.2)
			_clear_hint(it)
			_release_above(it.global_position)
		"scoop":
			var n: int = data
			for i in mini(n, 5):
				sfx.ui("tick", -10.0, 1.15 + i * 0.08 + randf() * 0.05, i * 0.022)
			_clear_hint(null)
		"poured", "placed":
			var d: Dictionary = data
			var box: GameBox = d.box
			_float_text(box.global_position + Vector3(0, box.H + 0.15, 0), "+%d" % d.n if kind == "poured" else "+%d" % d.n)
			if d.left > 0:
				hud.toast("%d left in your hand belong somewhere else." % d.left, 1.6)
		"seek_box":
			_seek_box(data as GameBox)
		"seek_for":
			_seek_home(data)
		"magnet":
			var n: int = data
			for i in mini(n, 10):
				sfx.ui("tick", -11.0, 1.4 + i * 0.05, i * 0.03)
			sfx.ui("note", -16.0, 2.0, 0.0)
		"wrong_box":
			var b := data as GameBox
			mixups += 1
			combo = 0
			_set_streak(0)
			sfx.at("low", b.global_position, -2.0)
			hud.toast("Nothing you're holding belongs in %s." % b.game_name, 2.4)
		"pieces_first":
			sfx.ui("tick", -6.0, 0.8)
			hud.toast("Every piece and card goes in first. The board folds in on top.", 2.6)
		"board_first":
			sfx.ui("tick", -6.0, 0.8)
			hud.toast("The rulebook goes in last, on top of the board.", 2.6)
		"wrong_slot":
			var s := data as ShelfSlot
			sfx.ui("low", -4.0)
			hud.toast("This cubby is for %s boxes." % s.game_name, 2.2)


func _on_box_progress(_box: GameBox, n: int, _group_done: bool) -> void:
	var now := Time.get_ticks_msec()
	if now - _last_sort_ms > 9000:
		streak = 0
	_last_sort_ms = now
	_set_streak(streak + n)
	_refresh_hud()
	_update_tidy()


func _on_piece_landed(box: GameBox, k: int, at: Vector3) -> void:
	# A soft cascade of woody clicks that climbs the scale as a handful pours in.
	var now := Time.get_ticks_msec()
	if now - _last_note_ms > 1200:
		combo = 0
	_last_note_ms = now
	sfx.at("clack", at, -7.0, 0.92 + randf() * 0.12 + k * 0.012)
	if k % 3 == 0:
		sfx.note(PENTA[combo % PENTA.size()] * (2.0 if combo >= PENTA.size() else 1.0), -14.0)
		combo = mini(combo + 1, PENTA.size() * 2 - 1)
	if k % 4 == 0:
		_sparkle(at, 5, 0.35, Color("ffd98a"))


func _on_compartment_filled(box: GameBox, at: Vector3) -> void:
	sfx.chord([PENTA[4], PENTA[7], PENTA[9]], 0.06, -11.0)
	_sparkle(at + Vector3(0, 0.03, 0), 22, 0.8, Color("ffe7a8"))
	_float_text(at + Vector3(0, 0.12, 0), "Full!  +1 ✦")
	_earn(1)


func _on_box_packed(box: GameBox) -> void:
	sfx.at("thunk", box.global_position, 2.0)
	sfx.chord([PENTA[0], PENTA[2], PENTA[4], PENTA[5], PENTA[7]], 0.08, -9.0, 0.05)
	_sparkle(box.global_position + Vector3(0, box.H, 0), 40, 1.2, Color("fff1d0"))
	var reward := 3 + box.units_needed / 150
	_float_text(box.global_position + Vector3(0, box.H + 0.2, 0), "Packed!  +%d ✦" % reward)
	_earn(reward)
	hud.toast("%s is packed. Take it to the shelf." % box.game_name, 3.0)
	_refresh_hud()
	_update_tidy()


# ---------------------------------------------------------------- sorted! showcase

func _on_box_sorted(box: GameBox) -> void:
	sorted_count += 1
	var reward := 2 + box.compartment_count() / 3
	_earn(reward)
	_light_up(box)
	var bits := []
	if box.piece_count() > 0:
		bits.append("%d pieces" % box.piece_count())
	if box.cards_in() > 0:
		bits.append("%d cards" % box.cards_in())
	var next := ""
	if not box.complete:
		next = "   ·   the board and rulebook go on top" if box.has_board else "   ·   the rulebook goes on top"
	hud.banner("Sorted!", "%s   ·   %s, every one in its place   ·   +%d ✦%s" % [box.game_name, " and ".join(bits), reward, next], 3.0)
	if not showcases:
		return
	_showcase_queue.append(box)
	if not _showcasing:
		_run_showcases()


## Every tray lights up in a wave across the insert, with a rising run of notes and a warm glow.
func _light_up(box: GameBox) -> void:
	var pts := box.tray_points()
	var right := box.global_basis.x
	pts.sort_custom(func(a: Vector3, b: Vector3): return a.dot(right) < b.dot(right))
	var glow := OmniLight3D.new()
	glow.light_color = Color("ffd9a0")
	glow.light_energy = 0.0
	glow.omni_range = 1.1
	glow.shadow_enabled = false
	world.add_child(glow)
	glow.global_position = box.insert_top() + Vector3(0, 0.35, 0)
	var gt := glow.create_tween()
	gt.tween_property(glow, "light_energy", 1.6, 0.5)
	gt.tween_interval(2.2)
	gt.tween_property(glow, "light_energy", 0.0, 1.0)
	gt.tween_callback(glow.queue_free)
	for i in pts.size():
		var t := get_tree().create_timer(0.25 + i * 0.09)
		var at: Vector3 = pts[i]
		var k := i
		t.timeout.connect(func():
			_sparkle(at, 10, 0.45, Color("fff1c8"))
			sfx.note(PENTA[mini(k, PENTA.size() - 1)], -14.0))
	get_tree().create_timer(0.35 + pts.size() * 0.09).timeout.connect(func():
		sfx.chord([PENTA[0], PENTA[4], PENTA[7], PENTA[9]], 0.07, -9.0))


func _run_showcases() -> void:
	_showcasing = true
	while not _showcase_queue.is_empty():
		var box: GameBox = _showcase_queue.pop_front()
		if is_instance_valid(box) and not box.shelved:
			await _showcase(box)
	_showcasing = false


## The camera floats up over the box and slowly drifts around it, so you can take in the sorted insert.
## Click (or E, or Esc) to skip.
func _showcase(box: GameBox) -> void:
	_skip_showcase = false
	var was_enabled := player.enabled
	player.enabled = false
	if _show_cam == null:
		_show_cam = Camera3D.new()
		_show_cam.fov = 50
		_show_cam.near = 0.02
		add_child(_show_cam)
	var from := player.cam.global_transform
	_show_cam.global_transform = from
	_show_cam.current = true
	var target := box.insert_top()
	var side := player.global_position - box.global_position
	side.y = 0
	side = side.normalized() if side.length() > 0.1 else box.global_basis.z
	var orbit := func(a: float) -> Transform3D:
		var d := side.rotated(Vector3.UP, a)
		var eye := target + d * 0.48 + Vector3(0, 0.66, 0)
		return Transform3D(Basis.looking_at(target - eye, Vector3.UP), eye)
	var t := 0.0
	var fly_in := 0.8
	var hold := 3.4
	while t < fly_in + hold and not _skip_showcase:
		await get_tree().process_frame
		t += get_process_delta_time()
		var a := lerpf(-0.22, 0.22, clampf((t - fly_in) / hold, 0.0, 1.0))
		var goal: Transform3D = orbit.call(a)
		var k := smoothstep(0.0, 1.0, clampf(t / fly_in, 0.0, 1.0))
		_show_cam.global_transform = from.interpolate_with(goal, k)
	# Glide back to the player's eyes.
	var at := _show_cam.global_transform
	t = 0.0
	while t < 0.5:
		await get_tree().process_frame
		t += get_process_delta_time()
		_show_cam.global_transform = at.interpolate_with(player.cam.global_transform, smoothstep(0.0, 1.0, t / 0.5))
	player.cam.current = true
	player.enabled = was_enabled and not finished


# ---------------------------------------------------------------- collection tour

## After everything's shelved: bring each box down to a lit stand, opened up, one at a time.
func _tour_start() -> void:
	if _touring:
		return
	_touring = true
	hud.hide_end()
	hud.show_tour(true)
	if _tour_stand == null:
		_tour_stand = Node3D.new()
		world.add_child(_tour_stand)
		_tour_stand.global_position = Vector3(0.6, 0.0, 3.3)
		var wood := TexKit.wood(Color("6b4026"), 0.5)
		_tour_stand.add_child(MeshKit.mesh_node(MeshKit.cyl(0.62, 0.68, 0.05, 40), wood, Vector3(0, 0.025, 0)))
		_tour_stand.add_child(MeshKit.mesh_node(MeshKit.cyl(0.12, 0.16, 0.6, 24), wood, Vector3(0, 0.35, 0)))
		_tour_stand.add_child(MeshKit.mesh_node(MeshKit.cyl(0.58, 0.58, 0.04, 40), MeshKit.mat(Color("2c4a3a"), 0.9), Vector3(0, 0.67, 0)))
		var spot := SpotLight3D.new()
		spot.light_color = Color("ffe2b8")
		spot.light_energy = 3.0
		spot.spot_range = 3.0
		spot.spot_angle = 28.0
		spot.shadow_enabled = true
		spot.position = Vector3(0.0, 2.1, 0.5)
		_tour_stand.add_child(spot)
		spot.look_at(_tour_stand.global_position + Vector3(0, 0.7, 0))
	_tour_stand.show()
	if _show_cam == null:
		_show_cam = Camera3D.new()
		_show_cam.fov = 50
		_show_cam.near = 0.02
		add_child(_show_cam)
	_show_cam.current = true
	_tour_i = 0
	_tour_show(0)


func _tour_order() -> Array:
	var order := []
	for slot in slots:
		for b in slot.placed:
			order.append(b)
	for b in boxes:
		if not order.has(b):
			order.append(b)
	return order


func _tour_show_step(d: int) -> void:
	_tour_show(d)


func _tour_show(step: int) -> void:
	var order := _tour_order()
	var prev: GameBox = order[_tour_i] if _tour_home.has(order[_tour_i]) else null
	if prev:
		_tour_put_back(prev)
	_tour_i = posmod(_tour_i + step, order.size())
	var box: GameBox = order[_tour_i]
	_tour_home[box] = [box.global_transform, box.freeze, box.freeze_mode]
	_tour_yaw = 0.0
	# Held still on the stand, whatever it was doing before.
	box.freeze_mode = RigidBody3D.FREEZE_MODE_STATIC
	box.freeze = true
	box.global_transform = Transform3D(Basis(), _tour_stand.global_position + Vector3(0, 0.69, 0))
	box._snap_contents()
	box.peek(true)
	_sparkle(box.insert_top(), 24, 0.7, Color("ffe7a8"))
	sfx.chord([PENTA[2], PENTA[4], PENTA[7]], 0.06, -12.0)
	var bits := []
	if box.piece_count() > 0:
		bits.append("%d pieces" % box.piece_count())
	if box.cards_in() > 0:
		bits.append("%d cards" % box.cards_in())
	bits.append("%d compartments" % box.compartment_count())
	hud.set_tour(_tour_i, order.size(), box.game_name, "   ·   ".join(bits))
	_tour_frame()


func _tour_frame() -> void:
	var box: GameBox = _tour_order()[_tour_i]
	var target := box.insert_top()
	var eye := target + Vector3(0, 0.72, 0.62).rotated(Vector3.UP, _tour_yaw)
	_show_cam.global_transform = Transform3D(Basis.looking_at(target - eye + Vector3(0, 0.0, 0), Vector3.UP), eye)


func _tour_put_back(box: GameBox) -> void:
	box.peek(false, true)
	for tw in box._peek_tweens:
		if tw and tw.is_valid():
			tw.kill()
	var home: Array = _tour_home[box]
	box.global_transform = home[0]
	box.freeze_mode = home[2]
	box.freeze = home[1]
	box._snap_contents()
	_tour_home.erase(box)


func _tour_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo:
		if e.physical_keycode == KEY_RIGHT or e.physical_keycode == KEY_D:
			_tour_show(1)
		elif e.physical_keycode == KEY_LEFT or e.physical_keycode == KEY_A:
			_tour_show(-1)
		elif e.is_action_pressed("pause"):
			_tour_end()
	elif e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
		_tour_drag = e.pressed
	elif e is InputEventMouseMotion and _tour_drag:
		_tour_yaw -= e.relative.x * 0.006
		_tour_frame()


func _tour_end() -> void:
	if not _touring:
		return
	for b in _tour_home.keys():
		_tour_put_back(b)
	_touring = false
	_tour_stand.hide()
	hud.show_tour(false)
	player.cam.current = true
	hud.show_end(hud._end_stats.text)


func _set_streak(n: int) -> void:
	var before := streak
	streak = n
	hud.set_streak(n)
	# Every 50 in a row gets its own little fanfare.
	if n / 50 > before / 50 and n >= 50:
		sfx.chord([PENTA[5], PENTA[7], PENTA[9]], 0.05, -10.0, 0.2)


func _update_tidy() -> void:
	var u := 0
	var un := 0
	for b in boxes:
		u += b.units
		un += b.units_needed
	var frac := float(u) / maxf(1.0, un)
	hud.set_tidy(frac)

	var step := int(frac * 10.0)
	if step > _tidy_step:
		_tidy_step = step
		if step < 10:
			sfx.chord([PENTA[2], PENTA[4], PENTA[7]], 0.09, -9.0, 0.5)
			hud.toast("The room is %d%% tidy." % (step * 10), 2.4)


## A puff of warm glints: used when pieces land, compartments fill and lids close.
func _sparkle(at: Vector3, amount: int, strength: float, color: Color) -> void:
	if _spark_mat == null:
		_spark_mat = StandardMaterial3D.new()
		_spark_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_spark_mat.vertex_color_use_as_albedo = true
		_spark_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_spark_mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		_spark_mesh = SphereMesh.new()
		_spark_mesh.radius = 0.005
		_spark_mesh.height = 0.01
		_spark_mesh.radial_segments = 6
		_spark_mesh.rings = 3
		_spark_mesh.material = _spark_mat
	var p := CPUParticles3D.new()
	p.mesh = _spark_mesh
	p.amount = amount
	p.lifetime = 0.7
	p.one_shot = true
	p.explosiveness = 0.95
	p.direction = Vector3.UP
	p.spread = 70.0
	p.initial_velocity_min = 0.4 * strength
	p.initial_velocity_max = 1.1 * strength
	p.gravity = Vector3(0, -2.2, 0)
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.6
	var grad := Gradient.new()
	grad.set_color(0, Color(color, 1.0))
	grad.set_color(1, Color(color, 0.0))
	p.color_ramp = grad
	world.add_child(p)
	p.global_position = at
	p.emitting = true
	get_tree().create_timer(1.2).timeout.connect(p.queue_free)


func _float_text(at: Vector3, text: String) -> void:
	var l := Label3D.new()
	l.text = text
	l.font_size = 64
	l.pixel_size = 0.0012
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.modulate = Hud.HONEY
	l.outline_size = 14
	l.outline_modulate = Color("3a1f0f")
	world.add_child(l)
	l.global_position = at
	var tw := l.create_tween().set_parallel(true)
	tw.tween_property(l, "global_position", at + Vector3(0, 0.22, 0), 1.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 0.0, 1.0).set_delay(0.35)
	tw.chain().tween_callback(l.queue_free)


func _on_box_bounced(box: GameBox, reason: String) -> void:
	if not started or Time.get_ticks_msec() / 1000.0 < _quiet_until:
		return
	_on_player_acted("wrong_box" if reason == "wrong_game" else reason, box)


func _on_shelved(slot: ShelfSlot, box: GameBox) -> void:
	sfx.at("thunk", slot.anchor, 0.0, 1.25)
	sfx.chord([PENTA[2], PENTA[4], PENTA[5], PENTA[7]], 0.07, -9.0, 0.25)
	_refresh_hud()
	_sparkle(slot.anchor + Vector3(0, 0.3, 0.2), 18, 0.7, Color("ffe7a8"))
	if boxes.all(func(b: GameBox): return b.shelved):
		get_tree().create_timer(1.4).timeout.connect(_finish)
	elif slot.filled():
		sfx.chord([PENTA[0], PENTA[4], PENTA[7], PENTA[9]], 0.12, -8.0, 0.6)
		hud.toast("All of %s is home.  +8 ✦" % slot.game_name, 2.5)
		_earn(8)


func _finish() -> void:
	if finished:
		return
	finished = true
	player.enabled = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	sfx.chord([PENTA[0], PENTA[2], PENTA[4], PENTA[5], PENTA[7], PENTA[9]], 0.11, -8.0)
	var secs := (Time.get_ticks_msec() - start_ms) / 1000
	var total := 0
	for b in boxes:
		total += b.units_needed
	hud.show_end("%d boxes   ·   %d pieces and cards   ·   %d:%02d   ·   %d mix-ups" % [boxes.size(), total, secs / 60, secs % 60, mixups])


func _on_clack(it: Item, strength: float) -> void:
	_on_piece_clack(it.global_position, strength)


func _on_piece_clack(pos: Vector3, strength: float) -> void:
	if Time.get_ticks_msec() / 1000.0 < _quiet_until:
		return
	sfx.at("clack", pos, linear_to_db(strength) - 3.0, 1.0 + (1.0 - strength) * 0.4)


func _refresh_hud() -> void:
	var rows := []
	for line in GameData.LINES:
		var mine := boxes.filter(func(b: GameBox): return b.line_id == line.id)
		var u := 0
		var un := 0
		var packed := 0
		var shelved := 0
		for b: GameBox in mine:
			u += b.units
			un += b.units_needed
			packed += 1 if b.complete else 0
			shelved += 1 if b.shelved else 0
		var status := "%d / %d" % [u, un]
		if shelved == mine.size():
			status = "on the shelf"
		elif packed > 0:
			status += "  ·  %d of %d boxes packed" % [packed, mine.size()]
		rows.append({"name": "%s  (%d boxes)" % [line.name, mine.size()], "color": line.color, "status": status, "done": shelved == mine.size()})
	hud.set_games(rows)


func _hint() -> void:
	var loose := pieces.all.filter(func(p: Pieces.P): return p.state == Pieces.LOOSE)
	var msg := ""
	_hint_target = null
	if not loose.is_empty():
		var p: Pieces.P = loose[rng.randi_range(0, loose.size() - 1)]
		_hint_target = p
		msg = "Look for the arrow over some %s %s." % [p.g.ed_name, p.g.nice(2)]
	else:
		var left := items.filter(func(i: Item): return not i.stored and not i.held and _box_for(i) and _box_for(i).check(i) == "")
		if not left.is_empty():
			_hint_target = left[0]
			msg = "Look for the arrow over the %s." % (left[0] as Item).label
		else:
			var ready := boxes.filter(func(b: GameBox): return b.can_pick())
			if ready.is_empty():
				return
			_hint_target = ready[0]
			msg = "The %s box is ready for the shelf." % (ready[0] as GameBox).game_name
	if _hint_marker == null:
		_hint_marker = Label3D.new()
		_hint_marker.text = "▼"
		_hint_marker.font_size = 96
		_hint_marker.pixel_size = 0.0015
		_hint_marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_hint_marker.no_depth_test = true
		_hint_marker.modulate = Hud.HONEY
		_hint_marker.outline_size = 16
		_hint_marker.outline_modulate = Color("5a2f10")
		world.add_child(_hint_marker)
	_hint_marker.show()
	sfx.chord([PENTA[4], PENTA[6]], 0.1, -12.0)
	hud.toast(msg, 3.0)


func _box_for(it: Item) -> GameBox:
	for b in boxes:
		if b.ed_id == it.game_id:
			return b
	return null


func _clear_hint(it: Variant) -> void:
	if _hint_marker and (it == null or is_same(_hint_target, it)):
		_hint_marker.hide()


func _process(_dt: float) -> void:
	var t := Time.get_ticks_msec() / 1000.0
	for f in _flicker:
		var n := _noise.get_noise_1d(t * f.speed + f.seed)
		f.light.light_energy = f.base * (0.86 + 0.22 * n + 0.04 * sin(t * 17.0 + f.seed))
	for f in _flames:
		var n := _noise.get_noise_1d(t * 3.0 + f.seed)
		f.node.scale = Vector3(1.0 - n * 0.15, f.base * (1.0 + n * 0.35), 1.0 - n * 0.15)
	_update_fireflies(t)
	_update_beacons(_dt)
	if _hint_marker and _hint_marker.visible:
		var pos := Vector3.ZERO
		var tg: Variant = _hint_target
		if tg is Pieces.P:
			if (tg as Pieces.P).state != Pieces.LOOSE:
				_hint_marker.hide()
				return
			pos = (tg as Pieces.P).xf.origin
		elif tg is Node3D and is_instance_valid(tg) and not (tg is Item and ((tg as Item).stored or (tg as Item).held)) and not (tg is GameBox and (tg as GameBox).shelved):
			pos = (tg as Node3D).global_position
		else:
			_hint_marker.hide()
			return
		_hint_marker.global_position = pos + Vector3(0, 0.2 + sin(t * 6.0) * 0.03, 0)


func _physics_process(_dt: float) -> void:
	for it in items:
		if not it.stored and not it.held and it.global_position.y < -1.0:
			it.linear_velocity = Vector3.ZERO
			it.global_position = (it.home.center as Vector3) + Vector3(0, 0.3, 0)
	for b in boxes:
		if not b.shelved and not b.held and b.global_position.y < -1.0:
			b.linear_velocity = Vector3.ZERO
			b.global_position = Vector3(0, 0.5, 1.5)


# ---------------------------------------------------------------- lighting and room
func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.02, 0.015, 0.025)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.85, 0.55, 0.42)
	env.ambient_light_energy = 0.14
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.05
	env.glow_enabled = true
	env.glow_intensity = 0.9
	env.glow_strength = 1.1
	env.glow_bloom = 0.06
	env.glow_hdr_threshold = 1.25
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.ssao_enabled = true
	env.ssao_radius = 0.7
	env.ssao_intensity = 2.6
	env.ssil_enabled = true
	env.ssil_intensity = 1.2
	# A faint warm haze so lamplight hangs in the air.
	env.volumetric_fog_enabled = true
	env.volumetric_fog_density = 0.018
	env.volumetric_fog_albedo = Color(1.0, 0.86, 0.72)
	env.volumetric_fog_anisotropy = 0.5
	env.volumetric_fog_length = 16.0
	env.adjustment_enabled = true
	env.adjustment_saturation = 0.94
	env.adjustment_contrast = 1.05
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)


func _solid(size: Vector3, pos: Vector3, m: Material, collide := true, rot_y := 0.0, parent: Node = null) -> Node3D:
	var node: Node3D
	if collide:
		var sb := StaticBody3D.new()
		sb.collision_layer = Item.LAYER_WORLD
		sb.collision_mask = 0
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		cs.shape = bs
		sb.add_child(cs)
		node = sb
	else:
		node = Node3D.new()
	# Anything thicker than a rug gets softly bevelled edges.
	var thin := minf(size.x, minf(size.y, size.z))
	var mesh: Mesh = MeshKit.box(size) if thin < 0.02 else MeshKit.rounded_box(size, clampf(thin * 0.18, 0.003, 0.014))
	node.add_child(MeshKit.mesh_node(mesh, m))
	node.position = pos
	node.rotation.y = rot_y
	(parent if parent else world).add_child(node)
	return node


func _omni(pos: Vector3, color: Color, energy: float, rng_m: float, shadow := false, flicker := 0.0) -> OmniLight3D:
	var l := OmniLight3D.new()
	l.position = pos
	l.light_color = color
	l.light_energy = energy
	l.omni_range = rng_m
	l.omni_attenuation = 1.6
	l.shadow_enabled = shadow
	l.shadow_bias = 0.03
	l.shadow_blur = 1.5
	if RenderingServer.get_rendering_device() != null:
		# Cheaper shadows on the full renderer; the compatibility renderer only supports cube maps.
		l.omni_shadow_mode = OmniLight3D.SHADOW_DUAL_PARABOLOID
	l.light_volumetric_fog_energy = 1.4
	world.add_child(l)
	if flicker > 0.0:
		_flicker.append({"light": l, "base": energy, "speed": flicker, "seed": rng.randf() * 100.0})
	return l


func _flame(pos: Vector3, h: float, r: float, hot := false) -> void:
	var m := MeshKit.mat(Color("ffd27a") if hot else Color("ff8a3a"), 0.5, 7.0 if hot else 5.0)
	var f := MeshKit.mesh_node(MeshKit.cyl(0.0, r, h, 10), m, pos)
	world.add_child(f)
	_flames.append({"node": f, "base": 1.0, "seed": rng.randf() * 100.0})


func _build_room() -> void:
	var floor_m := TexKit.pbr("wood_floor", 0.45, Color("d8b89a"))
	var wall_m := TexKit.pbr("plastered_wall_04", 0.35, Color("e2b48c"))
	var ceil_m := TexKit.pbr("roof_planks", 0.4, Color("8a6a52"))
	var trim := TexKit.pbr("dark_wood", 1.2, Color("9a7258"))
	var wainscot := TexKit.panels(Color("2e4637"), 0.65)
	# The living room runs from the game shelf (z -5) to the front wall (z 7.7), with doorways
	# to the card room (west), the dragon's den (east) and the hobby studio (front).
	_room(-6.1, 6.1, -5.1, 7.7, floor_m, wall_m, ceil_m, wainscot, trim, [["w", 4.9], ["e", 4.9], ["s", 0.0]])
	for x in [-4.0, -1.3, 1.3, 4.0]:
		_solid(Vector3(0.22, 0.2, 12.6), Vector3(x, 2.9, 1.3), trim, false)
	_door_sign("The Card Room", Vector3(-5.985, 2.64, 4.9), PI / 2)
	_door_sign("The Dragon's Den", Vector3(5.985, 2.64, 4.9), -PI / 2)
	_door_sign("Hobby Studio", Vector3(0, 2.64, 7.585), PI)
	# A reading corner where the old hobby nook was.
	_armchair(Vector3(-4.6, 0, 6.9), PI, TexKit.fabric(Color("5f7f76")))
	_armchair(Vector3(4.4, 0, 6.9), PI, TexKit.fabric(Color("8f4636")))
	_bookcase(Vector3(-2.6, 0, 7.38), PI, 1.5, 2.1, TexKit.pbr("dark_wood", 1.2, Color("c8a080")))
	_bookcase(Vector3(2.6, 0, 7.38), PI, 1.5, 2.1, TexKit.pbr("dark_wood", 1.2, Color("c8a080")))
	_floor_lamp(Vector3(-5.5, 0, 7.15), Color("ffd2a0"), 1.2, false)

	# Night window on the left wall: cool moonlight against all the warm lamps.
	var glass := MeshKit.mat(Color("16224a"), 0.2, 0.7)
	_solid(Vector3(0.04, 1.3, 1.7), Vector3(-5.99, 1.65, 0.5), glass, false)
	var frame := MeshKit.mat(Color("e8d8c0"), 0.6)
	for y in [1.0, 1.65, 2.3]:
		_solid(Vector3(0.08, 0.07, 1.8), Vector3(-5.96, y, 0.5), frame, false)
	for z in [-0.37, 0.5, 1.37]:
		_solid(Vector3(0.08, 1.37, 0.07), Vector3(-5.96, 1.65, z), frame, false)
	var curtain := TexKit.fabric(Color("7b3b5c"))
	for z in [-0.62, 1.62]:
		_solid(Vector3(0.1, 1.75, 0.34), Vector3(-5.9, 1.55, z), curtain, false)
	_solid(Vector3(0.05, 0.05, 2.6), Vector3(-5.9, 2.48, 0.5), MeshKit.mat(Color("b08d4a"), 0.35), false)
	var star := MeshKit.mat(Color("fff6d8"), 0.5, 3.0)
	for i in 14:
		world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.006 + rng.randf() * 0.006, 6), star,
			Vector3(-5.965, rng.randf_range(1.05, 2.25), rng.randf_range(-0.3, 1.3))))
	var moon := MeshKit.mesh_node(MeshKit.sphere(0.09, 16), MeshKit.mat(Color("fdf3d6"), 0.5, 2.2), Vector3(-5.97, 2.05, 1.05))
	moon.scale = Vector3(0.2, 1, 1)
	world.add_child(moon)
	var beam := SpotLight3D.new()
	beam.light_color = Color(0.55, 0.65, 1.0)
	beam.light_energy = 0.9
	beam.spot_range = 6.0
	beam.spot_angle = 32.0
	beam.position = Vector3(-5.8, 2.4, 0.5)
	beam.rotation = Vector3(deg_to_rad(-38), deg_to_rad(-90), 0)
	beam.shadow_enabled = true
	beam.light_volumetric_fog_energy = 2.0
	world.add_child(beam)


func _build_fireplace() -> void:
	var brick := TexKit.pbr("large_red_bricks", 0.9)
	var stone := MeshKit.mat(Color("5d544c"), 0.9)
	var soot := TexKit.fabric(Color("1a1210"), 5.0)
	var wood := TexKit.pbr("wood_table_001", 1.0, Color("8a6248"))
	var z := 0.2
	_solid(Vector3(0.7, 0.06, 2.0), Vector3(5.65, 0.03, z), stone)
	_solid(Vector3(0.4, 1.25, 0.35), Vector3(5.82, 0.625, z - 0.65), brick)
	_solid(Vector3(0.4, 1.25, 0.35), Vector3(5.82, 0.625, z + 0.65), brick)
	_solid(Vector3(0.4, 0.32, 0.95), Vector3(5.82, 1.09, z), brick)
	_solid(Vector3(0.05, 0.95, 0.95), Vector3(5.99, 0.475, z), soot)
	_solid(Vector3(0.3, 1.7, 1.6), Vector3(5.88, 2.1, z), brick, true)
	# Keeps the player (and thrown pieces) out of the fire.
	var guard := StaticBody3D.new()
	guard.collision_layer = Item.LAYER_WORLD
	var gcs := CollisionShape3D.new()
	var gb := BoxShape3D.new()
	gb.size = Vector3(0.1, 0.9, 0.95)
	gcs.shape = gb
	guard.add_child(gcs)
	guard.position = Vector3(5.6, 0.5, z)
	world.add_child(guard)
	# Brass fire screen bars.
	var brass := MeshKit.mat(Color("b08d4a"), 0.35)
	for i in 9:
		world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.004, 0.004, 0.55), brass, Vector3(5.6, 0.33, z - 0.4 + i * 0.1)))
	world.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.01, 0.015, 0.85)), brass, Vector3(5.6, 0.6, z)))
	# Mantel.
	_solid(Vector3(0.5, 0.07, 1.95), Vector3(5.76, 1.285, z), wood)
	# Logs and embers.
	var log_m := MeshKit.mat(Color("3d2416"), 0.9)
	for p in [[Vector3(5.82, 0.1, z - 0.12), 0.25], [Vector3(5.8, 0.1, z + 0.14), -0.2], [Vector3(5.84, 0.19, z), 0.05]]:
		world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.05, 0.055, 0.55, 10), log_m, p[0], Vector3(PI / 2, p[1], 0)))
	var ember := MeshKit.mesh_node(MeshKit.sphere(0.25, 14), MeshKit.mat(Color("ff4a1a"), 0.6, 3.5), Vector3(5.84, 0.07, z))
	ember.scale = Vector3(0.5, 0.12, 1.2)
	world.add_child(ember)
	for i in 7:
		var zz := z + rng.randf_range(-0.25, 0.25)
		_flame(Vector3(5.83 + rng.randf_range(-0.04, 0.04), 0.3 + rng.randf() * 0.05, zz), rng.randf_range(0.18, 0.32), rng.randf_range(0.045, 0.07), i % 3 == 0)
	_omni(Vector3(5.5, 0.5, z), Color(1.0, 0.52, 0.22), 3.2, 7.5, true, 2.2)
	_omni(Vector3(5.75, 0.35, z), Color(1.0, 0.45, 0.15), 1.5, 2.0, false, 3.5)

	# Candles on the mantel.
	var wax := MeshKit.mat(Color("f4e6cc"), 0.6)
	for c in [[z - 0.75, 0.22], [z - 0.62, 0.15], [z + 0.7, 0.18]]:
		var h: float = c[1]
		world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.025, 0.025, h, 12), wax, Vector3(5.75, 1.32 + h / 2, c[0])))
		_flame(Vector3(5.75, 1.335 + h, c[0]), 0.035, 0.009, true)
	_omni(Vector3(5.55, 1.6, z - 0.68), Color(1.0, 0.68, 0.35), 0.6, 2.2, false, 4.0)
	_omni(Vector3(5.55, 1.6, z + 0.7), Color(1.0, 0.68, 0.35), 0.45, 2.0, false, 4.0)
	# A clock on the mantel and a painting above it.
	_prop("mantel_clock_01", Vector3(5.74, 1.32, z), -PI / 2, Vector3(0.36, 0, 0))
	var art := _prop("fancy_picture_frame_01", Vector3(5.7, 1.85, z), -PI / 2, Vector3(1.0, 0, 0))
	art.position.x = 5.7


func _table(center: Vector3, size: Vector3, wood: Material, model := "WoodenTable_01") -> void:
	var top_t := 0.05
	if model != "":
		# A real table, stretched so its top lands exactly where the game is laid out.
		_prop(model, center, 0.0, size, true)
		_collider(Vector3(size.x, top_t, size.z), center + Vector3(0, size.y - top_t / 2, 0))
		for sx in [-1, 1]:
			for sz in [-1, 1]:
				_collider(Vector3(0.06, size.y - top_t, 0.06), center + Vector3(sx * (size.x / 2 - 0.08), (size.y - top_t) / 2, sz * (size.z / 2 - 0.08)))
		return
	_solid(Vector3(size.x, top_t, size.z), center + Vector3(0, size.y - top_t / 2, 0), wood)
	var lx := size.x / 2 - 0.08
	var lz := size.z / 2 - 0.08
	# An apron under the top ties the legs together.
	var ay := size.y - top_t - 0.045
	for sz in [-1.0, 1.0]:
		_solid(Vector3(size.x - 0.14, 0.08, 0.025), center + Vector3(0, ay, sz * (lz + 0.005)), wood, false)
	for sx in [-1.0, 1.0]:
		_solid(Vector3(0.025, 0.08, size.z - 0.14), center + Vector3(sx * (lx + 0.005), ay, 0), wood, false)
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			var at := center + Vector3(sx * lx, 0, sz * lz)
			_collider(Vector3(0.06, size.y - top_t, 0.06), at + Vector3(0, (size.y - top_t) / 2, 0))
			world.add_child(MeshKit.mesh_node(_turned_leg(size.y - top_t, 0.035), wood, at))


## A lathe-turned leg: a little foot, a long taper, a bead, and a square-ish block at the top.
func _turned_leg(h: float, r: float) -> ArrayMesh:
	return MeshKit.lathe([Vector2(0, 0), Vector2(r * 0.62, 0), Vector2(r * 0.72, h * 0.03), Vector2(r * 0.5, h * 0.09),
		Vector2(r * 0.45, h * 0.5), Vector2(r * 0.7, h * 0.56), Vector2(r * 0.45, h * 0.62), Vector2(r * 0.6, h * 0.76),
		Vector2(r * 0.95, h * 0.8), Vector2(r * 0.95, h), Vector2(0, h)], 14)


## Places a Poly Haven model, its base centred on pos, turned by rot (models face +z).
## size components of 0 are free; stretch matches each given axis exactly.
func _prop(id: String, pos: Vector3, rot: float, size: Vector3, stretch := false, parent: Node = null) -> Node3D:
	var p := Props.fit(id, size, stretch)
	p.position = pos
	p.rotation.y = rot
	(parent if parent else world).add_child(p)
	return p


## Collision only, for things whose visible shape is more detailed than a box.
func _collider(size: Vector3, pos: Vector3, parent: Node = null) -> void:
	var sb := StaticBody3D.new()
	sb.collision_layer = Item.LAYER_WORLD
	sb.collision_mask = 0
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	sb.add_child(cs)
	sb.position = pos
	(parent if parent else world).add_child(sb)


func _floor_lamp(pos: Vector3, shade: Color, energy: float, shadow := false) -> void:
	var brass := MeshKit.mat(Color("b08d4a"), 0.35)
	world.add_child(MeshKit.mesh_node(MeshKit.lathe([Vector2(0, 0), Vector2(0.17, 0), Vector2(0.17, 0.012), Vector2(0.12, 0.04),
		Vector2(0.05, 0.06), Vector2(0.03, 0.09), Vector2(0, 0.09)], 28), brass, pos))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.012, 0.014, 1.38), brass, pos + Vector3(0, 0.78, 0)))
	for y in [0.5, 1.1]:
		world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.022, 12), brass, pos + Vector3(0, y, 0)))
	_lamp_shade(pos + Vector3(0, 1.43, 0), 0.15, 0.25, 0.3, shade)
	world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.05, 10), MeshKit.mat(Color("fff0d0"), 0.5, 5.0), pos + Vector3(0, 1.5, 0)))
	var col := StaticBody3D.new()
	col.collision_layer = Item.LAYER_WORLD
	var cs := CollisionShape3D.new()
	cs.shape = MeshKit._cyl_shape(0.17, 1.7)
	cs.position.y = 0.85
	col.add_child(cs)
	col.position = pos
	world.add_child(col)
	_omni(pos + Vector3(0, 1.45, 0), Color(1.0, 0.66, 0.38), energy, 4.8, shadow)


## A fabric drum shade, slightly flared, with a piped trim at top and bottom. It glows a little.
func _lamp_shade(bottom: Vector3, r_top: float, r_bottom: float, h: float, c: Color) -> void:
	var cloth := MeshKit.mat(c, 0.95, 1.2)
	cloth.cull_mode = BaseMaterial3D.CULL_DISABLED
	world.add_child(MeshKit.mesh_node(MeshKit.lathe([Vector2(r_bottom, 0), Vector2(r_bottom * 0.97, h * 0.35), Vector2(r_top * 1.03, h * 0.8), Vector2(r_top, h)], 32), cloth, bottom))
	var piping := MeshKit.mat(c.darkened(0.35), 0.8)
	for e in [[r_bottom, 0.0], [r_top, h]]:
		var ring := MeshKit.mesh_node(MeshKit.torus(e[0] - 0.006, e[0] + 0.006), piping, bottom + Vector3(0, e[1], 0))
		ring.scale = Vector3(1, 0.6, 1)
		world.add_child(ring)


func _build_furniture() -> void:
	var wood := TexKit.wood(Color("6a3f24"), 0.55)
	var light_wood := TexKit.wood(Color("9c6a40"), 0.6)
	_table(Vector3(-3.0, 0, -1.5), Vector3(1.9, 0.76, 1.0), wood)
	_table(Vector3(3.0, 0, 1.0), Vector3(1.2, 0.44, 0.66), light_wood, "CoffeeTable_01")
	_table(Vector3(3.6, 0, -2.6), Vector3(1.0, 0.74, 1.0), MeshKit.mat(Color("2f5a46"), 0.85))
	# The big game table in the middle of the room.
	_table(Vector3(0.4, 0, -2.3), Vector3(1.5, 0.74, 1.05), wood)
	_solid(Vector3(1.3, 0.003, 0.85), Vector3(0.4, 0.7415, -2.3), TexKit.felt(Color("2e4a3a")), false)
	_solid(Vector3(1.04, 0.03, 1.04), Vector3(3.6, 0.725, -2.6), wood, false)

	for p in [[Vector3(-3.5, 0, -2.3), 0.0], [Vector3(-2.5, 0, -2.3), 0.0], [Vector3(-4.25, 0, -1.5), PI / 2]]:
		_chair(p[0], p[1], wood)

	# Window seat with cushion and pillows.
	_solid(Vector3(0.7, 0.42, 2.2), Vector3(-5.65, 0.21, 0.5), MeshKit.mat(Color("d9c8ae"), 0.8))
	_solid(Vector3(0.66, 0.08, 2.14), Vector3(-5.65, 0.46, 0.5), TexKit.fabric(Color("5f7f76")))
	world.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.14, 0.36, 0.42)), TexKit.fabric(Color("e8b04a")), Vector3(-5.85, 0.66, 1.4), Vector3(0, 0, 0.25)))

	# Couch with a knitted throw.
	var fabric := TexKit.fabric(Color("8f4636"))
	var fabric2 := TexKit.fabric(Color("a2563f"))
	_seat("Sofa_01", Vector3(3.0, 0, 3.0), PI, 2.2)
	_prop("throw_pillows_01", Vector3(3.0, 0.42, 3.2), PI, Vector3(1.1, 0, 0))
	_prop("Ottoman_01", Vector3(1.85, 0, 2.15), 0.4, Vector3(0.6, 0, 0))

	# Round rug under the floor game, a rectangular one by the fire.
	var rug := StaticBody3D.new()
	rug.collision_layer = Item.LAYER_WORLD
	var rcs := CollisionShape3D.new()
	rcs.shape = MeshKit._cyl_shape(1.45, 0.02)
	rug.add_child(rcs)
	rug.add_child(MeshKit.mesh_node(MeshKit.cyl(1.45, 1.45, 0.02, 48), TexKit.pbr("velour_velvet", 2.0, Color("8a3a5a"))))
	rug.add_child(MeshKit.mesh_node(MeshKit.cyl(1.25, 1.25, 0.022, 48), TexKit.pbr("velour_velvet", 2.0, Color("d8a050"))))
	rug.add_child(MeshKit.mesh_node(MeshKit.cyl(1.17, 1.17, 0.024, 48), TexKit.pbr("fabric_pattern_05", 1.4, Color("e0a8b8"))))
	rug.position = Vector3(-2.4, 0.01, 2.5)
	world.add_child(rug)
	_solid(Vector3(3.2, 0.012, 2.4), Vector3(3.0, 0.006, 1.6), TexKit.fabric(Color("34505e"), 5.0), false)
	# Floor cushions around the rug game.
	for p in [Vector3(-3.7, 0.08, 3.3), Vector3(-1.2, 0.08, 3.4)]:
		var cush := MeshKit.mesh_node(MeshKit.cyl(0.32, 0.34, 0.16, 20), TexKit.fabric(Color("5f7f76")), p)
		world.add_child(cush)


func _chair(pos: Vector3, rot: float, _m: Material, model := "dining_chair_02", height := 0.97) -> void:
	var root := Node3D.new()
	root.position = pos
	root.rotation.y = rot
	world.add_child(root)
	_collider(Vector3(0.44, 0.46, 0.44), Vector3(0, 0.23, 0), root)
	_prop(model, Vector3.ZERO, 0.0, Vector3(0, height, 0), false, root)


func _build_decor() -> void:
	# Pendant over the dining table: the main pool of light for two of the games.
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.006, 0.006, 0.55), MeshKit.mat(Color("222222")), Vector3(-3.0, 2.75, -1.5)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.08, 0.34, 0.24, 28), MeshKit.mat(Color("2f5a46"), 0.5), Vector3(-3.0, 2.38, -1.5)))
	world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.07), MeshKit.mat(Color("ffe2b0"), 0.5, 6.0), Vector3(-3.0, 2.27, -1.5)))
	var pend := SpotLight3D.new()
	pend.position = Vector3(-3.0, 2.25, -1.5)
	pend.rotation.x = -PI / 2
	pend.light_color = Color(1.0, 0.72, 0.45)
	pend.light_energy = 2.7
	pend.spot_range = 4.0
	pend.spot_angle = 52.0
	pend.spot_attenuation = 0.8
	pend.shadow_enabled = true
	pend.light_volumetric_fog_energy = 1.6
	world.add_child(pend)
	_omni(Vector3(-3.0, 2.0, -1.5), Color(1.0, 0.7, 0.45), 0.6, 4.0)

	# Floor lamps by the couch, the card table and the rug.
	_floor_lamp(Vector3(4.55, 0, 3.6), Color("ffd9a0"), 1.5, false)
	_floor_lamp(Vector3(4.75, 0, -3.65), Color("f6c98e"), 1.6, true)
	_floor_lamp(Vector3(-3.95, 0, 3.75), Color("ffd2a0"), 1.5, true)

	# Table lamp at the end of the window seat.
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.07, 0.09, 0.22), MeshKit.mat(Color("5f7f76"), 0.5), Vector3(-5.65, 0.61, -0.48)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.1, 0.16, 0.18), MeshKit.mat(Color("fff0d0"), 0.9, 1.6), Vector3(-5.65, 0.8, -0.48)))
	_omni(Vector3(-5.55, 0.82, -0.48), Color(1.0, 0.68, 0.42), 1.1, 3.0)

	# String lights along the shelf wall.
	var bulb_colors := [Color("ffcf7a"), Color("ff9f6e"), Color("ffe6a8")]
	for i in 30:
		var t := i / 29.0
		var x := lerpf(-5.6, 5.6, t)
		var y := 2.72 - 0.2 * (1.0 - pow(2.0 * fmod(t * 3.0, 1.0) - 1.0, 2.0))
		world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.03, 8), MeshKit.mat(bulb_colors[i % 3], 0.5, 6.0), Vector3(x, y, -4.92)))
	for x in [-4.0, -1.5, 1.5, 4.0]:
		_omni(Vector3(x, 2.5, -4.6), Color(1.0, 0.72, 0.42), 0.55, 2.8)
	# A warm light tucked inside the top of the game shelf.
	_omni(Vector3(0, 1.75, -4.4), Color(1.0, 0.75, 0.48), 0.9, 2.6)

	for p in [Vector3(5.45, 0, -1.3), Vector3(5.5, 0, 6.4)]:
		_plant(p)
	_prop("vintage_grandfather_clock_01", Vector3(-5.6, 0, -4.6), PI / 4, Vector3(0, 2.0, 0))

	# A cup of tea left on the coffee table.
	var mug := Node3D.new()
	mug.position = Vector3(3.52, 0.44, 0.75)
	mug.add_child(MeshKit.mesh_node(MeshKit.cyl(0.04, 0.036, 0.09), MeshKit.mat(Color("8c4a86"), 0.4), Vector3(0, 0.045, 0)))
	mug.add_child(MeshKit.mesh_node(MeshKit.cyl(0.034, 0.034, 0.002), MeshKit.mat(Color("5a2a14"), 0.2), Vector3(0, 0.085, 0)))
	world.add_child(mug)


func _plant(pos: Vector3, small := false) -> void:
	if small:
		_prop("potted_plant_04", pos, rng.randf_range(0, TAU), Vector3(0, 0.32, 0))
	else:
		_prop("potted_plant_02", pos, rng.randf_range(0, TAU), Vector3(0, 0.95, 0))


func _build_extra_lights() -> void:
	# A low pendant over the big game table in the middle of the room.
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.006, 0.006, 0.75), MeshKit.mat(Color("222222")), Vector3(0.4, 2.65, -2.3)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.07, 0.3, 0.22, 28), MeshKit.mat(Color("8a4a2a"), 0.5), Vector3(0.4, 2.18, -2.3)))
	world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.06), MeshKit.mat(Color("ffe2b0"), 0.5, 6.0), Vector3(0.4, 2.08, -2.3)))
	var spot := SpotLight3D.new()
	spot.position = Vector3(0.4, 2.06, -2.3)
	spot.rotation.x = -PI / 2
	spot.light_color = Color(1.0, 0.72, 0.45)
	spot.light_energy = 3.3
	spot.spot_range = 3.5
	spot.spot_angle = 50.0
	spot.shadow_enabled = true
	spot.light_volumetric_fog_energy = 1.4
	world.add_child(spot)
	# The coffee table sits in the fire's glow; a little extra so its pieces read.
	_omni(Vector3(3.0, 1.3, 1.0), Color(1.0, 0.66, 0.4), 0.7, 2.4)


## A bookcase of cubbies, one per game line. Built facing +z, then turned and placed.
func _build_shelf(order: Array, at: Vector3, rot: float, cols: int, title_text: String) -> void:
	var rack := Node3D.new()
	world.add_child(rack)
	rack.position = at
	rack.rotation.y = rot
	var wood := TexKit.pbr("dark_wood", 0.6, Color("c8a080"))
	var back := TexKit.pbr("dark_wood", 0.6, Color("7a5a44"))
	var cw := 1.0
	var ch := CUBBY_H
	var bt := 0.05
	var depth := 0.6
	var width := cols * cw + (cols + 1) * bt
	var floors := [0.12]
	floors.append(floors[0] + ch + bt)
	var top_y: float = floors[1] + ch + bt
	_solid(Vector3(width, top_y + 0.05, 0.03), Vector3(0, (top_y + 0.05) / 2, -depth / 2 + 0.015), back, true, 0.0, rack)
	for i in cols + 1:
		var x := -width / 2 + bt / 2 + i * (cw + bt)
		_solid(Vector3(bt, top_y + 0.05, depth), Vector3(x, (top_y + 0.05) / 2, 0), wood, true, 0.0, rack)
	for y in [floors[0] - bt / 2, floors[1] - bt / 2, top_y - bt / 2 + 0.05]:
		_solid(Vector3(width, bt, depth), Vector3(0, y, 0), wood, true, 0.0, rack)
	_solid(Vector3(width + 0.04, 0.12, 0.04), Vector3(0, 0.06, depth / 2 + 0.005), wood, false, 0.0, rack)
	# A face frame: stiles over the dividers and rails along each shelf front, slightly proud.
	for i in cols + 1:
		var x := -width / 2 + bt / 2 + i * (cw + bt)
		_solid(Vector3(bt + 0.03, top_y + 0.05, 0.022), Vector3(x, (top_y + 0.05) / 2, depth / 2 + 0.011), wood, false, 0.0, rack)
	for fy: float in floors:
		_solid(Vector3(width, 0.062, 0.022), Vector3(0, fy - bt / 2, depth / 2 + 0.011), wood, false, 0.0, rack)
	# Crown moulding: a cove and a capping board that overhang the top.
	_solid(Vector3(width + 0.06, 0.05, depth + 0.05), Vector3(0, top_y + 0.075, 0.025), wood, false, 0.0, rack)
	_solid(Vector3(width + 0.12, 0.035, depth + 0.1), Vector3(0, top_y + 0.115, 0.04), wood, false, 0.0, rack)

	for r in 2:
		for c in cols:
			if r * cols + c >= order.size():
				continue
			var line: Dictionary = order[r * cols + c]
			var cx := -width / 2 + bt + cw / 2 + c * (cw + bt)
			var fy: float = floors[r]
			var slot := ShelfSlot.new()
			slot.line_id = line.id
			slot.game_name = line.name
			slot.boxes_needed = line.editions.size()
			slot.collision_layer = Item.LAYER_SLOTS
			slot.collision_mask = 0
			var cs := CollisionShape3D.new()
			var bs := BoxShape3D.new()
			bs.size = Vector3(cw - 0.02, ch - 0.02, depth - 0.05)
			cs.shape = bs
			slot.add_child(cs)
			slot.position = Vector3(cx, fy + ch / 2, 0.02)
			rack.add_child(slot)
			slot.anchor = rack.to_global(Vector3(cx, fy + 0.001, 0.02))
			slot.shelved.connect(_on_shelved)
			slots.append(slot)
			var gm := StandardMaterial3D.new()
			gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			gm.albedo_color = Color(line.color, 0.18)
			var ghost := MeshKit.mesh_node(MeshKit.box(Vector3(0.6, 0.2, 0.4)), gm, Vector3(cx, fy + 0.1, 0.02))
			rack.add_child(ghost)
			slot.ghost = ghost
			rack.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.66, 0.046, 0.006)), MeshKit.mat(line.color, 0.6), Vector3(cx, fy - bt / 2, depth / 2 + 0.0235)))
			# The name is printed on the shelf's colour-coded label strip.
			var ink := Color("1c1410") if (line.color as Color).get_luminance() > 0.55 else Color("fff4e4")
			var plate_tex := LogoKit.plaque(self, line.name, Vector2i(768, 54), line.color, ink, (line.color as Color).darkened(0.4))
			CaseKit._print(rack, Vector2(0.66, 0.046), plate_tex, Vector3(cx, fy - bt / 2, depth / 2 + 0.0271), false, 0.5)

	_prop("book_encyclopedia_set_01", Vector3(-width / 2 + 0.3, top_y + 0.1325, 0), 0.0, Vector3(0.45, 0, 0), false, rack)
	_plant(rack.to_global(Vector3(width / 2 - 0.2, top_y + 0.1325, 0)), true)
	# A carved and gilded wooden sign on top of the shelf.
	_sign(rack, title_text, Vector3(0.1, top_y + 0.27, 0.06), Vector2(1.1, 0.2))


func _fit_shelf_ghosts() -> void:
	for s in slots:
		var mine := boxes.filter(func(b: GameBox): return b.line_id == s.line_id)
		var h := 0.0
		for b: GameBox in mine:
			h += b.H + 0.004
		var b0: GameBox = mine[0]
		(s.ghost as MeshInstance3D).mesh = MeshKit.box(Vector3(b0.W, h, b0.D))
		s.ghost.position.y = s.anchor.y + h / 2


func _define_spots() -> void:
	# center = point on the play surface, ext = how far a game spreads,
	# row_start / rot = where its open boxes wait (in a row, fronts facing the room).
	var defs := {
		# The living room.
		"dining": {"room": "living", "center": Vector3(-3.0, 0.76, -1.5), "ext": Vector2(0.9, 0.46), "row_start": Vector3(-3.55, 0.0, -0.4), "rot": 0.0, "spill": "floor_dining"},
		"gametable": {"room": "living", "center": Vector3(0.4, 0.743, -2.3), "ext": Vector2(0.7, 0.48), "row_start": Vector3(-0.45, 0.0, -1.15), "rot": 0.0, "spill": "floor_game"},
		"cardtable": {"room": "living", "center": Vector3(3.6, 0.74, -2.6), "ext": Vector2(0.47, 0.47), "row_start": Vector3(2.45, 0.0, -3.5), "rot": -PI / 2, "spill": "floor_card"},
		"coffee": {"room": "living", "center": Vector3(3.0, 0.44, 1.0), "ext": Vector2(0.57, 0.3), "row_start": Vector3(1.75, 0.0, 0.55), "rot": -PI / 2, "spill": "floor_coffee"},
		"bench": {"room": "living", "center": Vector3(-5.65, 0.5, 0.5), "ext": Vector2(0.29, 1.02), "row_start": Vector3(-4.8, 0.0, 1.45), "rot": PI / 2, "spill": "floor_bench"},
		"couch": {"room": "living", "center": Vector3(3.0, 0.44, 2.92), "ext": Vector2(0.95, 0.3), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_dining": {"room": "living", "center": Vector3(-4.55, 0.0, -0.7), "ext": Vector2(0.4, 0.5), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_game": {"room": "living", "center": Vector3(1.75, 0.0, -2.6), "ext": Vector2(0.4, 0.45), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_card": {"room": "living", "center": Vector3(3.95, 0.0, -1.45), "ext": Vector2(0.45, 0.3), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_coffee": {"room": "living", "center": Vector3(3.0, 0.0, 1.95), "ext": Vector2(0.85, 0.3), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_bench": {"room": "living", "center": Vector3(-5.25, 0.0, -1.35), "ext": Vector2(0.4, 0.4), "row_start": Vector3.ZERO, "rot": 0.0},
		# The card room, through the west doorway.
		"poker": {"room": "card", "center": Vector3(-10.6, 0.763, 4.0), "ext": Vector2(0.5, 0.27), "row_start": Vector3(-12.0, 0.0, 2.5), "rot": 0.0, "spill": "floor_poker"},
		"ccgtable": {"room": "card", "center": Vector3(-8.3, 0.746, 6.0), "ext": Vector2(0.62, 0.48), "row_start": Vector3(-10.3, 0.0, 7.15), "rot": PI, "spill": "floor_ccg"},
		"floor_poker": {"room": "card", "center": Vector3(-10.6, 0.0, 5.35), "ext": Vector2(0.6, 0.3), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_ccg": {"room": "card", "center": Vector3(-7.6, 0.0, 3.6), "ext": Vector2(0.5, 0.4), "row_start": Vector3.ZERO, "rot": 0.0},
		# The dragon's den, through the east doorway.
		"round": {"room": "den", "center": Vector3(9.6, 0.743, 3.6), "ext": Vector2(0.56, 0.56), "row_start": Vector3(10.3, 0.0, 0.35), "rot": 0.0, "spill": "floor_round"},
		"curio": {"room": "den", "center": Vector3(12.3, 0.706, 2.0), "ext": Vector2(0.33, 0.33), "row_start": Vector3(12.2, 0.0, 0.35), "rot": 0.0, "spill": "floor_curio"},
		"dicetable": {"room": "den", "center": Vector3(12.4, 0.624, 4.1), "ext": Vector2(0.34, 0.34), "row_start": Vector3(13.75, 0.0, 1.1), "rot": -PI / 2, "spill": "floor_dice"},
		"war": {"room": "den", "center": Vector3(10.9, 0.763, 6.45), "ext": Vector2(0.9, 0.48), "row_start": Vector3(13.75, 0.0, 4.9), "rot": -PI / 2, "spill": "floor_war"},
		"floor_round": {"room": "den", "center": Vector3(7.9, 0.0, 2.1), "ext": Vector2(0.45, 0.4), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_dice": {"room": "den", "center": Vector3(11.3, 0.0, 5.0), "ext": Vector2(0.35, 0.28), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_curio": {"room": "den", "center": Vector3(11.0, 0.0, 1.55), "ext": Vector2(0.35, 0.3), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_war": {"room": "den", "center": Vector3(8.75, 0.0, 6.75), "ext": Vector2(0.5, 0.45), "row_start": Vector3.ZERO, "rot": 0.0},
		# The hobby studio, through the front doorway.
		"paintdesk": {"room": "studio", "center": Vector3(-1.6, 0.763, 12.77), "ext": Vector2(0.7, 0.22), "row_start": Vector3(-2.95, 0.0, 11.6), "rot": PI / 2, "spill": "floor_paint"},
		"floor_paint": {"room": "studio", "center": Vector3(-0.75, 0.0, 12.35), "ext": Vector2(0.3, 0.2), "row_start": Vector3.ZERO, "rot": 0.0},
		"ring": {"room": "studio", "center": Vector3(1.0, 0.014, 10.4), "ext": Vector2(0.38, 0.38), "row_start": Vector3(2.95, 0.0, 8.6), "rot": -PI / 2, "spill": "floor_ring"},
		"floor_ring": {"room": "studio", "center": Vector3(1.05, 0.0, 11.45), "ext": Vector2(0.45, 0.25), "row_start": Vector3.ZERO, "rot": 0.0},
	}
	# The part of each table where the game is being played; supply goes round it, not on it.
	var play := {"war": Vector2(0.62, 0.43), "dining": Vector2(0.72, 0.46), "gametable": Vector2(0.62, 0.48),
		"cardtable": Vector2(0.3, 0.3), "coffee": Vector2(0.3, 0.3), "bench": Vector2(0.29, 1.02), "round": Vector2(0.42, 0.42),
		"dicetable": Vector2(0.26, 0.26), "curio": Vector2(0.33, 0.33), "poker": Vector2(0.5, 0.27),
		"ccgtable": Vector2(0.62, 0.48), "paintdesk": Vector2(0.7, 0.22), "ring": Vector2(0.38, 0.38)}
	for k in play:
		defs[k]["play"] = play[k]
	for k in defs:
		var s: Dictionary = defs[k]
		s["name"] = k
		if k.begins_with("floor_"):
			# A spill on the floor spreads outwards as it grows, so its height map covers more.
			s["floor"] = true
			s["grow"] = 1.0
			s["hmap"] = HMap.new(s.center, s.ext * FLOOR_GROW_MAX)
		else:
			s["hmap"] = HMap.new(s.center, s.ext)
		spots[k] = s
	# Where the open boxes will wait, so spills on the floor keep clear of them.
	for line in GameData.LINES:
		var sp: Dictionary = spots[PLAYED_ON[line.id]]
		var dir := Basis(Vector3.UP, sp.rot) * Vector3.RIGHT
		for ei in line.editions.size():
			var at: Vector3 = (sp.row_start as Vector3) + dir * ei * (GameBox.IW + 2 * GameBox.T + 0.08)
			_box_zones.append(at)


# ---------------------------------------------------------------- rooms

## A room's floor, ceiling and four walls. Each wall is 0.1 thick and sits just inside the room's
## rectangle, so two rooms can share a wall line, each with its own wallpaper. A doorway is
## [side, centre along that wall]; side is "n" (min z), "s" (max z), "w" (min x) or "e" (max x).
## Doorways get a lintel above and a painted casing round them.
func _room(x0: float, x1: float, z0: float, z1: float, floor_m: Material, wall_m: Material, ceil_m: Material,
		wainscot: Material, trim: Material, doors: Array, panel_h := 0.95) -> void:
	var cx := (x0 + x1) / 2.0
	var cz := (z0 + z1) / 2.0
	_solid(Vector3(x1 - x0, 0.2, z1 - z0), Vector3(cx, -0.1, cz), floor_m)
	_solid(Vector3(x1 - x0, 0.2, z1 - z0), Vector3(cx, 3.1, cz), ceil_m)
	for side in ["n", "s", "w", "e"]:
		var along_x: bool = side == "n" or side == "s"
		var a0 := x0 if along_x else z0
		var a1 := x1 if along_x else z1
		var fixed: float = {"n": z0, "s": z1, "w": x0, "e": x1}[side]
		var inward: float = 1.0 if (side == "n" or side == "w") else -1.0
		var place := func(length: float, along: float, h: float, y: float, depth: float, off: float, m: Material, collide: bool) -> void:
			if along_x:
				_solid(Vector3(length, h, depth), Vector3(along, y, fixed + inward * off), m, collide)
			else:
				_solid(Vector3(depth, h, length), Vector3(fixed + inward * off, y, along), m, collide)
		var gaps := []
		for d in doors:
			if d[0] == side:
				gaps.append(float(d[1]))
		gaps.sort()
		var cur := a0
		var segs := []
		for g: float in gaps:
			segs.append(Vector2(cur, g - DOOR_W / 2.0))
			cur = g + DOOR_W / 2.0
		segs.append(Vector2(cur, a1))
		for sg: Vector2 in segs:
			if sg.y - sg.x < 0.01:
				continue
			place.call(sg.y - sg.x, (sg.x + sg.y) / 2.0, 3.2, 1.5, 0.1, 0.05, wall_m, true)
			# Panelling, a rail and a skirting board, stopping short of the walls at the corners.
			var s0 := sg.x + (0.1 if absf(sg.x - a0) < 0.001 else 0.0)
			var s1 := sg.y - (0.1 if absf(sg.y - a1) < 0.001 else 0.0)
			if panel_h > 0.0:
				place.call(s1 - s0, (s0 + s1) / 2.0, panel_h, panel_h / 2.0, 0.03, 0.115, wainscot, false)
				place.call(s1 - s0, (s0 + s1) / 2.0, 0.05, panel_h, 0.06, 0.13, trim, false)
			place.call(s1 - s0, (s0 + s1) / 2.0, 0.14, 0.07, 0.05, 0.125, trim, false)
		for g: float in gaps:
			place.call(DOOR_W, g, 3.1 - DOOR_H, (DOOR_H + 3.1) / 2.0, 0.1, 0.05, wall_m, true)
			for sd in [-1.0, 1.0]:
				place.call(0.09, g + sd * (DOOR_W / 2.0 + 0.045), DOOR_H + 0.09, (DOOR_H + 0.09) / 2.0, 0.035, 0.117, trim, false)
			place.call(DOOR_W + 0.18, g, 0.09, DOOR_H + 0.045, 0.035, 0.117, trim, false)


## A gilded sign over a doorway, facing into the room it's in.
func _door_sign(text: String, at: Vector3, rot: float) -> void:
	var root := Node3D.new()
	root.position = at
	root.rotation.y = rot
	world.add_child(root)
	_sign(root, text, Vector3.ZERO, Vector2(1.1, 0.22))


func _armchair(pos: Vector3, rot: float, _fabric: Material, model := "ArmChair_01") -> void:
	_seat(model, pos, rot, 0.9)


## A sofa or armchair model with a simple seat-and-back collider.
func _seat(model: String, pos: Vector3, rot: float, width: float) -> void:
	var root := Node3D.new()
	root.position = pos
	root.rotation.y = rot
	world.add_child(root)
	var p := _prop(model, Vector3.ZERO, 0.0, Vector3(width, 0, 0), false, root)
	var bb := Props.bounds(p)
	var sz := bb.size * p.scale
	_collider(Vector3(sz.x, 0.44, sz.z), Vector3(0, 0.22, 0), root)
	_collider(Vector3(sz.x, sz.y, 0.2), Vector3(0, sz.y / 2, -sz.z / 2 + 0.1), root)


## An upholstered seat, built facing +z: a frame on short tapered legs, plump seat and back
## cushions, and rolled arms. width 0.95 is an armchair; wider makes a sofa with more cushions.
## The seat cushions top out at 0.44 m.
func _sofa(pos: Vector3, rot: float, width: float, frame: Material, cushion: Material) -> void:
	var root := Node3D.new()
	root.position = pos
	root.rotation.y = rot
	world.add_child(root)
	var depth := 0.92
	var wood := TexKit.wood(Color("3a2216"), 0.5)
	_collider(Vector3(width, 0.44, depth), Vector3(0, 0.22, 0), root)
	_collider(Vector3(width, 0.85, 0.24), Vector3(0, 0.425, -depth / 2 + 0.12), root)
	root.add_child(MeshKit.mesh_node(MeshKit.rounded_box(Vector3(width, 0.2, depth), 0.04), frame, Vector3(0, 0.18, 0)))
	root.add_child(MeshKit.mesh_node(MeshKit.rounded_box(Vector3(width, 0.55, 0.2), 0.06), frame, Vector3(0, 0.5, -depth / 2 + 0.1)))
	for sx in [-1.0, 1.0]:
		var ax: float = sx * (width / 2 - 0.1)
		root.add_child(MeshKit.mesh_node(MeshKit.rounded_box(Vector3(0.2, 0.3, depth), 0.05), frame, Vector3(ax, 0.38, 0)))
		# A rolled arm along the top.
		root.add_child(MeshKit.mesh_node(MeshKit.cyl(0.12, 0.12, depth - 0.02, 20), frame, Vector3(sx * (width / 2 - 0.09), 0.55, 0), Vector3(PI / 2, 0, 0)))
		for sz in [-1.0, 1.0]:
			root.add_child(MeshKit.mesh_node(MeshKit.cyl(0.025, 0.018, 0.08, 10), wood, Vector3(sx * (width / 2 - 0.08), 0.04, sz * (depth / 2 - 0.08))))
	var inner := width - 0.42
	var n := maxi(1, int(round(inner / 0.95)))
	var cw := inner / n
	for i in n:
		var cx := -inner / 2 + cw * (i + 0.5)
		root.add_child(MeshKit.mesh_node(MeshKit.rounded_box(Vector3(cw - 0.02, 0.16, depth - 0.24), 0.06), cushion, Vector3(cx, 0.36, 0.08)))
		var back := MeshKit.mesh_node(MeshKit.rounded_box(Vector3(cw - 0.03, 0.42, 0.18), 0.07), cushion, Vector3(cx, 0.62, -depth / 2 + 0.26))
		back.rotation.x = -0.18
		root.add_child(back)


## A tall bookcase full of books, built facing +z, then turned and placed against a wall.
func _bookcase(pos: Vector3, rot: float, width: float, height: float, wood: Material) -> void:
	var root := Node3D.new()
	root.position = pos
	root.rotation.y = rot
	world.add_child(root)
	var depth := 0.34
	_solid(Vector3(width, height, 0.03), Vector3(0, height / 2, -depth / 2 + 0.015), MeshKit.mat(Color("2e1a10"), 0.8), true, 0.0, root)
	for sx in [-1.0, 1.0]:
		_solid(Vector3(0.04, height, depth), Vector3(sx * (width / 2 - 0.02), height / 2, 0), wood, true, 0.0, root)
	var shelves := int(height / 0.42)
	var spines := [Color("8e3b2c"), Color("2e5a4a"), Color("c49a3a"), Color("3a4a7a"), Color("6b3a5a"), Color("d9c8ae"), Color("4a6a2a")]
	for i in shelves + 1:
		var y := 0.04 + i * (height - 0.06) / shelves
		_solid(Vector3(width - 0.06, 0.03, depth - 0.02), Vector3(0, y, 0), wood, true, 0.0, root)
		if i == shelves:
			break
		var x := -width / 2 + 0.07
		while x < width / 2 - 0.1:
			var bw := rng.randf_range(0.025, 0.05)
			var bh := rng.randf_range(0.22, 0.32)
			var lean := 0.0 if rng.randf() < 0.85 else rng.randf_range(0.1, 0.25)
			root.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(bw, bh, rng.randf_range(0.18, 0.24))), MeshKit.mat(spines[rng.randi_range(0, spines.size() - 1)], 0.8),
				Vector3(x + bw / 2, y + 0.015 + bh / 2, 0.02), Vector3(0, 0, lean)))
			x += bw + 0.004 + (0.06 if rng.randf() < 0.08 else 0.0)


## A wall sconce: a brass back plate, an arm and a little glowing shade.
func _sconce(pos: Vector3, facing: Vector3, shade: Color, energy := 0.7) -> void:
	var brass := MeshKit.mat(Color("b08d4a"), 0.35)
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.05, 0.05, 0.015, 16), brass, pos, Vector3(PI / 2, 0, 0) if absf(facing.z) > 0.5 else Vector3(0, 0, PI / 2)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.07, 0.11, 0.14, 18), MeshKit.mat(shade, 0.9, 1.6), pos + facing * 0.12 + Vector3(0, 0.08, 0)))
	_omni(pos + facing * 0.2 + Vector3(0, 0.05, 0), Color(1.0, 0.7, 0.42), energy, 3.2)


## A wall torch: an iron bracket, a wooden haft and a flickering flame.
func _torch(pos: Vector3, facing: Vector3) -> void:
	var iron := MeshKit.mat(Color("2a2522"), 0.5)
	world.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.08, 0.16, 0.08)), iron, pos))
	var haft := MeshKit.mesh_node(MeshKit.cyl(0.02, 0.014, 0.32, 8), MeshKit.mat(Color("4a2e1a"), 0.9), pos + facing * 0.09 + Vector3(0, 0.12, 0))
	haft.rotation = Vector3(facing.z * 0.35, 0, -facing.x * 0.35)
	world.add_child(haft)
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.04, 0.03, 0.06, 10), iron, pos + facing * 0.14 + Vector3(0, 0.26, 0)))
	_flame(pos + facing * 0.15 + Vector3(0, 0.36, 0), 0.16, 0.035, false)
	_flame(pos + facing * 0.15 + Vector3(0, 0.33, 0), 0.08, 0.022, true)
	_omni(pos + facing * 0.3 + Vector3(0, 0.4, 0), Color(1.0, 0.55, 0.25), 1.1, 4.2, false, 2.6)


## A framed picture on a wall: art is a material for the canvas.
func _frame(pos: Vector3, facing: Vector3, size: Vector2, art: Material, frame_c := Color("b08d4a")) -> void:
	var rot := Vector3(0, atan2(facing.x, facing.z), 0)
	world.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(size.x + 0.08, size.y + 0.08, 0.03)), MeshKit.mat(frame_c, 0.35), pos, rot))
	var canvas := MeshKit.mesh_node(MeshKit.box(Vector3(size.x, size.y, 0.01)), art, pos + facing * 0.012, rot)
	world.add_child(canvas)


# ---- the card room: a velvet lounge for the casino set and the trading card game

func _build_card_room() -> void:
	var floor_m := TexKit.pbr("herringbone_parquet", 0.5, Color("b8906e"))
	var wall_m := TexKit.damask(Color("1d4434"), Color("2b5a45"), Color("9c7a3a"), 0.6)
	var ceil_m := TexKit.pbr("roof_planks", 0.4, Color("5a4436"))
	var panel := TexKit.panels(Color("3a1c12"), 0.4)
	var gilt := MeshKit.mat(Color("b08d4a"), 0.3)
	_room(-13.3, -6.1, 1.9, 7.7, floor_m, wall_m, ceil_m, panel, gilt, [["e", 4.9]], 1.1)
	# A deep red carpet with a gold border.
	_solid(Vector3(5.0, 0.004, 3.8), Vector3(-9.7, 0.002, 4.8), TexKit.fabric(Color("8a6a2a"), 5.0), false)
	_solid(Vector3(4.84, 0.005, 3.64), Vector3(-9.7, 0.0025, 4.8), TexKit.pbr("velour_velvet", 2.0, Color("6a2028")), false)
	var wood := TexKit.wood(Color("3a1f12"), 0.45)
	var leather := TexKit.felt(Color("7a2a22"), 6.0)
	# The oval felt poker table under a green banker's lamp.
	var poker := StaticBody3D.new()
	poker.collision_layer = Item.LAYER_WORLD
	var pcs := CollisionShape3D.new()
	pcs.shape = MeshKit._box_shape(Vector3(1.4, 0.05, 0.92))
	poker.add_child(pcs)
	var felt := MeshKit.mesh_node(MeshKit.cyl(0.7, 0.7, 0.05, 40), TexKit.felt(Color("1f6b46")))
	felt.scale = Vector3(1, 1, 0.68)
	poker.add_child(felt)
	var rail := MeshKit.mesh_node(MeshKit.torus(0.66, 0.76), MeshKit.mat(Color("3a1f12"), 0.4), Vector3(0, 0.02, 0))
	rail.scale = Vector3(1, 0.6, 0.68)
	poker.add_child(rail)
	poker.position = Vector3(-10.6, 0.735, 4.0)
	world.add_child(poker)
	_solid(Vector3(0.14, 0.71, 0.14), Vector3(-10.6, 0.355, 4.0), wood)
	_solid(Vector3(0.6, 0.04, 0.4), Vector3(-10.6, 0.02, 4.0), wood)
	_pendant(Vector3(-10.6, 0, 4.0), Color("1f6b46"), 3.0)
	_chair(Vector3(-11.6, 0, 4.0), PI / 2, leather)
	_chair(Vector3(-9.6, 0, 4.0), -PI / 2, leather)
	# A square card table with a playmat for the trading card game.
	_table(Vector3(-8.3, 0, 6.0), Vector3(1.4, 0.72, 1.1), wood)
	_solid(Vector3(1.3, 0.003, 1.0), Vector3(-8.3, 0.7215, 6.0), TexKit.felt(Color("1d2a4a")), false)
	_pendant(Vector3(-8.3, 0, 6.0), Color("6b1e4a"), 2.6)
	_chair(Vector3(-8.3, 0, 4.85), 0.0, leather)
	# A gothic commode as the bar, with bottles on top.
	_prop("GothicCommode_01", Vector3(-7.0, 0, 2.35), 0.0, Vector3(1.0, 0, 0))
	_collider(Vector3(1.0, 1.0, 0.5), Vector3(-7.0, 0.5, 2.35))
	_prop("wine_bottles_01", Vector3(-7.05, 1.0, 2.3), 0.0, Vector3(0.55, 0, 0))
	_prop("vintage_grandfather_clock_01", Vector3(-12.85, 0, 2.35), PI / 4, Vector3(0, 2.0, 0))
	# A leather armchair and a lamp in the corner.
	_armchair(Vector3(-7.0, 0, 7.0), PI, leather, "GreenChair_01")
	_floor_lamp(Vector3(-6.62, 0, 6.35), Color("e8c48a"), 1.0, false)
	# Sconces and framed playing cards on the walls.
	for sc in [[Vector3(-8.4, 1.75, 2.0), 0.0], [Vector3(-12.2, 1.75, 2.0), 0.0], [Vector3(-11.0, 1.75, 7.6), PI]]:
		_prop("industrial_wall_sconce", sc[0], sc[1], Vector3(0, 0.38, 0))
		_omni(sc[0] + Vector3(0, 0.25, 0) + Vector3(0, 0, 0.22).rotated(Vector3.UP, sc[1]), Color(1.0, 0.7, 0.42), 0.7, 3.2)
	var faces := FaceKit.faces(self, "casino", "Royal Flush", Color("7a1420"), Color("c49a3a"), "casino")
	for i in 4:
		var art: Material = faces[(i * 2) % faces.size()]
		_frame(Vector3(-10.4 + i * 0.42, 1.75, 2.0), Vector3(0, 0, 1), Vector2(0.26, 0.36), art)
	# Velvet drapes framing the shelf.
	for z in [3.9, 5.7]:
		_solid(Vector3(0.12, 2.6, 0.34), Vector3(-13.12, 1.4, z), TexKit.pbr("velour_velvet", 2.0, Color("b02a36")), false)
	_solid(Vector3(0.05, 0.05, 2.4), Vector3(-13.1, 2.72, 4.8), gilt, false)
	_omni(Vector3(-9.7, 2.5, 4.8), Color(1.0, 0.7, 0.45), 0.45, 5.0)


# ---- the dragon's den: stone walls, torches and banners for the roleplaying games

func _build_den() -> void:
	var floor_m := TexKit.pbr("wood_floor_worn", 0.4, Color("a88a72"))
	var wall_m := TexKit.pbr("medieval_blocks_02", 0.3)
	var ceil_m := TexKit.pbr("roof_planks", 0.4, Color("4a382c"))
	var timber := TexKit.pbr("dark_wood", 0.8, Color("6a5040"))
	_room(6.1, 14.3, -0.3, 7.7, floor_m, wall_m, ceil_m, timber, timber, [["w", 4.9]], 0.0)
	for x in [7.6, 9.6, 11.6, 13.4]:
		_solid(Vector3(0.24, 0.24, 7.8), Vector3(x, 2.88, 3.7), timber, false)
	var wood := TexKit.wood(Color("5e3620"), 0.55)
	var iron := MeshKit.mat(Color("2a2522"), 0.5)
	# A round rug in deep red under the round table.
	_solid(Vector3(0.1, 0.1, 0.1), Vector3(9.6, -1.0, 3.6), wood, false)
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(1.55, 1.55, 0.004, 48), TexKit.fabric(Color("c49a3a"), 5.0), Vector3(9.6, 0.002, 3.6)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(1.45, 1.45, 0.005, 48), TexKit.pbr("velour_velvet", 2.0, Color("9a2430")), Vector3(9.6, 0.0025, 3.6)))
	# The round table for Wyrmlight Tales, under an iron candle chandelier.
	var top := StaticBody3D.new()
	top.collision_layer = Item.LAYER_WORLD
	var tcs := CollisionShape3D.new()
	tcs.shape = MeshKit._cyl_shape(0.85, 0.05)
	top.add_child(tcs)
	top.add_child(MeshKit.mesh_node(MeshKit.cyl(0.8, 0.8, 0.004, 48), TexKit.pbr("velour_velvet", 2.0, Color("8a1e2c")), Vector3(0, 0.0255, 0)))
	top.position = Vector3(9.6, 0.715, 3.6)
	world.add_child(top)
	_prop("round_wooden_table_01", Vector3(9.6, 0, 3.6), 0.0, Vector3(1.7, 0.74, 1.7), true)
	_collider(Vector3(0.14, 0.69, 0.14), Vector3(9.6, 0.345, 3.6))
	for c in [[Vector3(8.35, 0, 3.6), PI / 2], [Vector3(10.85, 0, 3.6), -PI / 2], [Vector3(9.6, 0, 2.35), 0.0]]:
		_chair(c[0], c[1], timber, "WoodenChair_01", 1.45)
	var wax := MeshKit.mat(Color("efe0c4"), 0.6)
	_prop("lantern_chandelier_01", Vector3(9.6, 1.95, 3.6), 0.0, Vector3(0, 0.95, 0))
	_omni(Vector3(9.6, 2.2, 3.6), Color(1.0, 0.62, 0.32), 1.6, 4.5, true, 3.0)
	var down := SpotLight3D.new()
	down.position = Vector3(9.6, 2.15, 3.6)
	down.rotation.x = -PI / 2
	down.light_color = Color(1.0, 0.7, 0.42)
	down.light_energy = 2.4
	down.spot_range = 3.0
	down.spot_angle = 40.0
	down.shadow_enabled = true
	world.add_child(down)
	# The war table for Mossy Crowns: a long table with a green battlefield mat.
	_table(Vector3(10.9, 0, 6.45), Vector3(2.0, 0.76, 1.1), wood)
	_prop("Lantern_01", Vector3(11.7, 0.763, 6.9), 0.3, Vector3(0, 0.3, 0))
	_solid(Vector3(1.9, 0.003, 1.0), Vector3(10.9, 0.7615, 6.45), TexKit.felt(Color("3a5a2a")), false)
	for p in [[Vector3(10.4, 0.763, 6.2), 0.25], [Vector3(11.5, 0.763, 6.75), 0.18]]:
		var patch := MeshKit.mesh_node(MeshKit.cyl(p[1], p[1], 0.001, 20), TexKit.felt(Color("4a6a32")), p[0])
		patch.scale = Vector3(1.4, 1, 0.8)
		world.add_child(patch)
	_pendant(Vector3(10.9, 0, 6.45), Color("3a2a1a"), 2.8)
	# A velvet-lined curio table for the crystals, glowing faintly purple.
	var curio := StaticBody3D.new()
	curio.collision_layer = Item.LAYER_WORLD
	var ccs := CollisionShape3D.new()
	ccs.shape = MeshKit._cyl_shape(0.5, 0.04)
	curio.add_child(ccs)
	curio.add_child(MeshKit.mesh_node(MeshKit.cyl(0.46, 0.46, 0.004, 36), TexKit.pbr("velour_velvet", 2.0, Color("2a2034")), Vector3(0, 0.0215, 0)))
	curio.position = Vector3(12.3, 0.68, 2.0)
	world.add_child(curio)
	_prop("round_wooden_table_02", Vector3(12.3, 0, 2.0), 0.0, Vector3(1.0, 0.7, 1.0), true)
	_collider(Vector3(0.12, 0.66, 0.12), Vector3(12.3, 0.33, 2.0))
	_pendant(Vector3(12.3, 0, 2.0), Color("3a2a5a"), 2.4)
	_omni(Vector3(12.3, 1.1, 2.0), Color(0.7, 0.5, 1.0), 0.5, 1.6)
	# A felt-lined dice tray table for the dice hoard.
	var dt := StaticBody3D.new()
	dt.collision_layer = Item.LAYER_WORLD
	var dcs := CollisionShape3D.new()
	dcs.shape = MeshKit._cyl_shape(0.45, 0.04)
	dt.add_child(dcs)
	dt.add_child(MeshKit.mesh_node(MeshKit.cyl(0.45, 0.45, 0.04, 36), TexKit.wood(Color("5e3620"), 0.5)))
	dt.add_child(MeshKit.mesh_node(MeshKit.cyl(0.42, 0.42, 0.004, 36), TexKit.felt(Color("2a3f5a")), Vector3(0, 0.022, 0)))
	var rim := MeshKit.mesh_node(MeshKit.torus(0.42, 0.46), MeshKit.mat(Color("b08d4a"), 0.35), Vector3(0, 0.03, 0))
	rim.scale = Vector3(1, 0.5, 1)
	dt.add_child(rim)
	dt.position = Vector3(12.4, 0.6, 4.1)
	world.add_child(dt)
	_prop("round_wooden_table_01", Vector3(12.4, 0, 4.1), 0.0, Vector3(0.8, 0.58, 0.8), true)
	_collider(Vector3(0.12, 0.58, 0.12), Vector3(12.4, 0.29, 4.1))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.03, 0.03, 0.12, 10), wax, Vector3(12.85, 0.68, 3.75)))
	_flame(Vector3(12.85, 0.765, 3.75), 0.04, 0.01, true)
	_omni(Vector3(12.8, 0.95, 3.8), Color(1.0, 0.64, 0.34), 0.6, 1.8, false, 4.0)
	# Torches on the walls.
	for t in [[Vector3(6.25, 1.75, 2.2), Vector3(1, 0, 0)], [Vector3(6.25, 1.75, 7.0), Vector3(1, 0, 0)],
			[Vector3(14.15, 1.75, 0.6), Vector3(-1, 0, 0)], [Vector3(14.15, 1.75, 4.3), Vector3(-1, 0, 0)],
			[Vector3(12.4, 1.75, 7.55), Vector3(0, 0, -1)]]:
		_torch(t[0], t[1])
	# Banners hanging on the north wall.
	for b in [[9.95, Color("7a1e22")], [13.5, Color("1e3a6a")]]:
		var bx: float = b[0]
		_solid(Vector3(0.62, 1.25, 0.02), Vector3(bx, 2.05, -0.17), MeshKit.mat(b[1], 0.95), false)
		_solid(Vector3(0.62, 0.05, 0.03), Vector3(bx, 1.45, -0.165), MeshKit.mat(Color("c49a3a"), 0.4), false)
		_solid(Vector3(0.7, 0.03, 0.03), Vector3(bx, 2.7, -0.16), iron, false)
		world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.12, 0.12, 0.01, 6), MeshKit.mat(Color("e8b84a"), 0.35), Vector3(bx, 2.15, -0.155), Vector3(PI / 2, 0, 0)))
	# A shelf of spellbooks, a treasure chest and a shield on the wall.
	_prop("GothicCabinet_01", Vector3(7.3, 0, 7.15), PI, Vector3(1.5, 0, 0))
	_collider(Vector3(1.5, 2.1, 0.6), Vector3(7.3, 1.05, 7.2))
	_prop("treasure_chest", Vector3(6.6, 0, 3.0), PI / 2, Vector3(0.75, 0, 0))
	_collider(Vector3(0.45, 0.5, 0.75), Vector3(6.6, 0.25, 3.0))
	for b in [Vector3(13.85, 0, 7.25), Vector3(6.6, 0, 6.6)]:
		_prop("wine_barrel_01", b, rng.randf_range(0, TAU), Vector3(0.6, 0, 0))
		_collider(Vector3(0.55, 0.7, 0.55), b + Vector3(0, 0.35, 0))
	var sh := _prop("kite_shield", Vector3(8.7, 1.25, 7.55), PI, Vector3(0, 0.95, 0))
	sh.rotation.x = 0.05
	_prop("ornate_war_hammer", Vector3(9.35, 1.45, 7.57), PI, Vector3(0, 0.75, 0)).rotation.z = 0.5
	_omni(Vector3(10.2, 2.5, 3.7), Color(1.0, 0.6, 0.35), 0.35, 6.0)


# ---- the hobby studio: a bright workshop for the paints and the marbles

func _build_studio() -> void:
	var floor_m := TexKit.pbr("plank_flooring_02", 0.45)
	var wall_m := TexKit.pbr("plastered_wall_04", 0.35, Color("d4dcc0"))
	var ceil_m := TexKit.pbr("roof_planks", 0.4, Color("e8dccb"))
	var panel := TexKit.panels(Color("ece4d4"), 0.6)
	var trim := MeshKit.mat(Color("f6efe2"), 0.6)
	_room(-3.5, 3.5, 7.7, 13.5, floor_m, wall_m, ceil_m, panel, trim, [["n", 0.0]], 0.9)
	var wood := TexKit.wood(Color("8a5a34"), 0.55)
	var dark := TexKit.wood(Color("2a1a12"), 0.6)
	# A woven rug.
	_solid(Vector3(3.6, 0.004, 2.6), Vector3(0.2, 0.002, 10.5), TexKit.fabric(Color("d9a441"), 5.0), false)
	_solid(Vector3(3.4, 0.005, 2.4), Vector3(0.2, 0.0025, 10.5), TexKit.pbr("fabric_pattern_05", 1.2), false)
	# The painting desk against the back wall, with a cutting mat, a rack of paints and a task lamp.
	var o := Vector3(-1.6, 0, 12.95)
	_table(o, Vector3(1.6, 0.76, 0.75), wood)
	_solid(Vector3(1.0, 0.004, 0.45), o + Vector3(-0.15, 0.762, -0.18), MeshKit.mat(Color("2f5a46"), 0.9), false)
	_solid(Vector3(1.5, 0.22, 0.12), o + Vector3(0, 0.87, 0.3), dark)
	var pot_colors := [Color("c8323a"), Color("e8742a"), Color("f2c94e"), Color("4f9e3a"), Color("2a6fb5"), Color("6a3fa0"), Color("f2efe6"), Color("1d1d22"), Color("8a5a34"), Color("e05a9a"), Color("2fb8a8"), Color("e8b84a")]
	for row in 2:
		for i in 12:
			world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.016, 0.016, 0.03, 10), MeshKit.mat(pot_colors[(i + row * 5) % pot_colors.size()], 0.4),
				o + Vector3(-0.68 + i * 0.12, 1.011 - row * 0.1, 0.26 - row * 0.05)))
	var lamp := SpotLight3D.new()
	lamp.position = o + Vector3(0.3, 1.45, -0.05)
	lamp.rotation = Vector3(-PI / 2 + 0.25, 0, 0)
	lamp.light_color = Color(1.0, 0.94, 0.84)
	lamp.light_energy = 3.5
	lamp.spot_range = 2.0
	lamp.spot_angle = 45.0
	lamp.shadow_enabled = true
	world.add_child(lamp)
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.012, 0.012, 0.6), MeshKit.mat(Color("2a2a2a"), 0.4), o + Vector3(0.65, 1.07, 0.25)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.04, 0.08, 0.1, 16), MeshKit.mat(Color("2f5a46"), 0.4), o + Vector3(0.4, 1.47, 0.05), Vector3(0.6, 0, 0.5)))
	_chair(o + Vector3(0, 0, -0.75), 0.0, wood, "wooden_stool_01", 0.5)
	_prop("desk_lamp_arm_01", o + Vector3(0.62, 0.76, 0.15), PI + 0.4, Vector3(0, 0.6, 0))
	# A pegboard of tools above the desk, and a little shelf of finished miniatures.
	_solid(Vector3(1.7, 0.9, 0.02), Vector3(-1.6, 1.85, 13.38), TexKit.pegboard(Color("c9a272"), 1.2), false)
	var tool_c := [Color("c8323a"), Color("2a6fb5"), Color("e8b84a"), Color("4f9e3a")]
	for i in 7:
		var tx := -2.25 + i * 0.2
		world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.006, 0.004, 0.2, 8), MeshKit.mat(Color("8a5a34"), 0.6), Vector3(tx, 1.9, 13.35)))
		world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.008, 0.008, 0.04, 8), MeshKit.mat(tool_c[i % 4], 0.5), Vector3(tx, 2.02, 13.35)))
	_solid(Vector3(0.5, 0.03, 0.04), Vector3(-1.05, 1.62, 13.36), MeshKit.mat(Color("d9d0c0"), 0.5), false)
	_solid(Vector3(1.0, 0.03, 0.18), Vector3(0.3, 1.45, 13.31), wood, false)
	var mini_c := [Color("6a9a3a"), Color("b0302c"), Color("e8e0cc"), Color("2a6fb5")]
	var mini_t := ["knight", "hero", "skeleton", "goblin"]
	for i in 4:
		var fig: Node3D = MeshKit.piece(mini_t[i], mini_c[i], Color("d8b45a"))[0]
		fig.position = Vector3(-0.05 + i * 0.22, 1.465 + 0.045, 13.3)
		fig.rotation.y = PI
		world.add_child(fig)
	# The chalk marble ring on its mat, with a beanbag beside it.
	var mat_body := StaticBody3D.new()
	mat_body.collision_layer = Item.LAYER_WORLD
	var mcs := CollisionShape3D.new()
	mcs.shape = MeshKit._cyl_shape(0.62, 0.012)
	mat_body.add_child(mcs)
	mat_body.add_child(MeshKit.mesh_node(MeshKit.cyl(0.62, 0.62, 0.012, 40), TexKit.felt(Color("3a3f4a"))))
	var chalk := MeshKit.mesh_node(MeshKit.torus(0.5, 0.52), TexKit.fabric(Color("f2efe6"), 5.0), Vector3(0, 0.007, 0))
	chalk.scale = Vector3(1, 0.05, 1)
	mat_body.add_child(chalk)
	mat_body.position = Vector3(1.0, 0.006, 10.4)
	world.add_child(mat_body)
	_prop("Ottoman_01", Vector3(-0.4, 0, 11.6), 0.3, Vector3(0.7, 0, 0))
	_collider(Vector3(0.6, 0.45, 0.45), Vector3(-0.4, 0.22, 11.6))
	_prop("painted_wooden_shelves", Vector3(3.2, 0, 12.9), -PI / 2, Vector3(0, 1.3, 0))
	for k in 3:
		_prop("spray_paint_bottles", Vector3(3.2, 0.42 + k * 0.33, 12.9), -PI / 2 + k * 0.4, Vector3(0, 0.18, 0))
	# A big night window on the east wall.
	var glass := MeshKit.mat(Color("16224a"), 0.2, 0.7)
	_solid(Vector3(0.04, 1.3, 1.7), Vector3(3.39, 1.65, 11.8), glass, false)
	var frame := MeshKit.mat(Color("f6efe2"), 0.6)
	for y in [1.0, 1.65, 2.3]:
		_solid(Vector3(0.08, 0.07, 1.8), Vector3(3.36, y, 11.8), frame, false)
	for z in [10.93, 11.8, 12.67]:
		_solid(Vector3(0.08, 1.37, 0.07), Vector3(3.36, 1.65, z), frame, false)
	var star := MeshKit.mat(Color("fff6d8"), 0.5, 3.0)
	for i in 12:
		world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.006 + rng.randf() * 0.006, 6), star, Vector3(3.37, rng.randf_range(1.05, 2.25), rng.randf_range(11.0, 12.6))))
	var moonbeam := SpotLight3D.new()
	moonbeam.light_color = Color(0.55, 0.65, 1.0)
	moonbeam.light_energy = 0.8
	moonbeam.spot_range = 5.0
	moonbeam.spot_angle = 30.0
	moonbeam.position = Vector3(3.2, 2.4, 11.8)
	moonbeam.rotation = Vector3(deg_to_rad(-38), deg_to_rad(90), 0)
	moonbeam.light_volumetric_fog_energy = 2.0
	world.add_child(moonbeam)
	# Pendants, a string of fairy lights and some plants.
	_pendant(Vector3(1.0, 0, 10.4), Color("d9a441"), 2.4)
	_pendant(Vector3(-1.4, 0, 10.0), Color("3f6a6a"), 1.6)
	var bulb_colors := [Color("ffcf7a"), Color("ff9f6e"), Color("ffe6a8")]
	for i in 22:
		var t := i / 21.0
		var z := lerpf(8.0, 13.2, t)
		var y := 2.72 - 0.16 * (1.0 - pow(2.0 * fmod(t * 3.0, 1.0) - 1.0, 2.0))
		world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.028, 8), MeshKit.mat(bulb_colors[i % 3], 0.5, 6.0), Vector3(-3.32, y, z)))
	for z in [9.0, 12.0]:
		_omni(Vector3(-3.0, 2.5, z), Color(1.0, 0.74, 0.45), 0.5, 3.0)
	_plant(Vector3(-3.0, 0, 8.2))
	_plant(Vector3(-0.2, 0, 13.1))
	_omni(Vector3(0.0, 2.5, 10.6), Color(1.0, 0.8, 0.6), 0.5, 5.0)


func _pendant(at: Vector3, shade: Color, energy: float) -> void:
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.006, 0.006, 0.9), MeshKit.mat(Color("222222")), at + Vector3(0, 2.6, 0)))
	var dome := MeshKit.mat(shade, 0.45)
	dome.cull_mode = BaseMaterial3D.CULL_DISABLED
	world.add_child(MeshKit.mesh_node(MeshKit.lathe([Vector2(0.24, 0.0), Vector2(0.235, 0.02), Vector2(0.17, 0.08), Vector2(0.09, 0.15),
		Vector2(0.05, 0.19), Vector2(0.025, 0.22), Vector2(0, 0.22)], 32), dome, at + Vector3(0, 2.0, 0)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.018, 0.018, 0.05, 12), MeshKit.mat(Color("b08d4a"), 0.35), at + Vector3(0, 2.24, 0)))
	world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.045), MeshKit.mat(Color("ffe2b0"), 0.5, 6.0), at + Vector3(0, 2.02, 0)))
	var l := SpotLight3D.new()
	l.position = at + Vector3(0, 2.0, 0)
	l.rotation.x = -PI / 2
	l.light_color = Color(1.0, 0.74, 0.48)
	l.light_energy = energy
	l.spot_range = 3.0
	l.spot_angle = 40.0
	world.add_child(l)


# ---------------------------------------------------------------- tidy tokens and the tool chest

func _earn(n: int) -> void:
	tokens += n
	hud.set_tokens(tokens)
	sfx.ui("note", -14.0, 2.0, 0.15)
	if hud.shop_open():
		hud.fill_shop(levels, tokens)
	# A gentle nudge the first time something becomes affordable.
	for u in Upgrades.LIST:
		var lvl: int = levels.get(u.id, 0)
		if lvl < u.costs.size() and tokens >= u.costs[lvl] and tokens - n < u.costs[lvl]:
			hud.toast("You can afford %s. Press Tab to open the Tool Chest." % u.name, 3.0)
			break


func _toggle_shop(on: bool) -> void:
	hud.show_shop(on, levels, tokens)
	player.enabled = not on
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if on else Input.MOUSE_MODE_CAPTURED
	sfx.ui("thunk", -14.0, 1.6)


func _buy(id: String) -> void:
	var u := Upgrades.find(id)
	var lvl: int = levels.get(id, 0)
	if u.is_empty() or lvl >= u.costs.size() or tokens < u.costs[lvl]:
		return
	tokens -= u.costs[lvl]
	levels[id] = lvl + 1
	_apply_upgrades()
	hud.set_tokens(tokens)
	hud.fill_shop(levels, tokens)
	sfx.chord([PENTA[2], PENTA[4], PENTA[7], PENTA[9]], 0.06, -8.0)
	hud.toast("%s %s." % [u.name, "bought" if lvl == 0 else "upgraded"], 2.0)


func _apply_upgrades() -> void:
	var lv := func(id: String) -> int: return levels.get(id, 0)
	player.unlocked = [true, lv.call("lantern") > 0, lv.call("dustpan") > 0, lv.call("magnet") > 0]
	player.hand_max = [80, 140, 220, 320][lv.call("caddy")]
	player.hand_mult = [1.0, 1.5, 2.0, 3.0][lv.call("caddy")]
	player.pan_max = [150, 150, 250, 400][lv.call("dustpan")]
	player.pan_radius = [0.2, 0.2, 0.28, 0.36][lv.call("dustpan")]
	player.magnet_radius = [2.0, 2.0, 4.0, 14.0][lv.call("magnet")]
	player.card_stack_max = [8, 16, 30][lv.call("satchel")]
	player.chute_range = [0.0, 4.0, 30.0][lv.call("chute")]
	GameBox.pour_speed = [1.0, 1.5, 2.0, 3.0][lv.call("pour")]
	hud.set_tools(TOOL_NAMES, player.unlocked, player.tool)


## Box Beacons: while you're holding pieces, every box that wants some of them glows with a count.
func _update_beacons(dt: float) -> void:
	_beacon_t -= dt
	if _beacon_t > 0.0:
		return
	_beacon_t = 0.2
	var want := {}
	if levels.get("beacons", 0) > 0 and player and not player.hand.is_empty():
		for p: Pieces.P in player.hand:
			want[p.g.ed] = want.get(p.g.ed, 0) + 1
	for b in boxes:
		var n: int = want.get(b.ed_id, 0) if not b.complete else 0
		if n == 0:
			if _beacons.has(b):
				_beacons[b].hide()
			continue
		if not _beacons.has(b):
			_beacons[b] = _make_beacon()
		var node: Node3D = _beacons[b]
		node.show()
		node.global_position = b.global_position
		(node.get_child(1) as Label3D).text = "×%d" % n
		var through: bool = levels.get("beacons", 0) >= 2
		(node.get_child(1) as Label3D).no_depth_test = through
		((node.get_child(0) as MeshInstance3D).material_override as StandardMaterial3D).no_depth_test = through


func _make_beacon() -> Node3D:
	var root := Node3D.new()
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(0.55, 0.85, 1.0, 0.16)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	var beam := MeshKit.mesh_node(MeshKit.cyl(0.12, 0.3, 1.8, 18), m, Vector3(0, 0.95, 0))
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(beam)
	var l := Label3D.new()
	l.font_size = 72
	l.pixel_size = 0.0014
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.modulate = Color(0.75, 0.92, 1.0)
	l.outline_size = 14
	l.outline_modulate = Color("10202e")
	l.position = Vector3(0, 0.55, 0)
	root.add_child(l)
	world.add_child(root)
	return root


# ---------------------------------------------------------------- the seeker lantern

## Fireflies drift over every piece and card pile of this box that's still out in the room.
func _seek_box(box: GameBox) -> void:
	var targets: Array = pieces.loose_for(box.ed_id)
	for it in items:
		if it.game_id == box.ed_id and not it.stored and not it.held:
			targets.append(it)
	_firefly_targets = targets.slice(0, 600)
	_firefly_until = Time.get_ticks_msec() / 1000.0 + [10.0, 10.0, 25.0, 1e9][levels.get("lantern", 0)]
	sfx.chord([PENTA[5], PENTA[7], PENTA[9]], 0.12, -11.0)
	if targets.is_empty():
		hud.toast("Everything for %s is already in its box." % box.game_name, 2.5)
	else:
		hud.toast("%d things still out for %s. Follow the fireflies." % [targets.size(), box.game_name], 3.5)


## A beam of light rises from the box this thing belongs in.
func _seek_home(what: Variant) -> void:
	var ed := ""
	if what is Pieces.P:
		ed = (what as Pieces.P).g.ed
	elif what is Item:
		ed = (what as Item).game_id
	for b in boxes:
		if b.ed_id == ed:
			_beam(b)
			sfx.chord([PENTA[7], PENTA[9]], 0.1, -11.0)
			hud.toast("That goes in %s%s." % [b.game_name, " (already on the shelf)" if b.shelved else ""], 2.5)
			return


func _beam(b: GameBox) -> void:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(1.0, 0.8, 0.45, 0.22)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	var mi := MeshKit.mesh_node(MeshKit.cyl(0.16, 0.32, 2.6, 20), m)
	world.add_child(mi)
	mi.global_position = b.global_position + Vector3(0, 1.3, 0)
	b.set_highlight(true)
	var tw := mi.create_tween()
	tw.tween_interval(2.8)
	tw.tween_property(m, "albedo_color:a", 0.0, 0.8)
	tw.tween_callback(func():
		mi.queue_free()
		if is_instance_valid(b) and not b.held:
			b.set_highlight(false))


func _update_fireflies(t: float) -> void:
	if _fireflies == null:
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.albedo_color = Color(1.0, 0.85, 0.45)
		m.emission_enabled = true
		m.emission = Color(1.0, 0.8, 0.4)
		m.emission_energy_multiplier = 8.0
		m.albedo_color = Color(1.0, 0.95, 0.7)
		var sm := MeshKit.sphere(0.015, 8)
		sm.material = m
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = sm
		mm.instance_count = 600
		mm.visible_instance_count = 0
		_fireflies = MultiMeshInstance3D.new()
		_fireflies.multimesh = mm
		_fireflies.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		world.add_child(_fireflies)
	var mm := _fireflies.multimesh
	if t > _firefly_until or _firefly_targets.is_empty():
		mm.visible_instance_count = 0
		return
	var n := 0
	for k in _firefly_targets.size():
		var tg: Variant = _firefly_targets[k]
		var pos: Vector3
		if tg is Pieces.P:
			if (tg as Pieces.P).state != Pieces.LOOSE:
				continue
			pos = (tg as Pieces.P).xf.origin
		elif tg is Item and is_instance_valid(tg) and not (tg as Item).stored and not (tg as Item).held:
			pos = (tg as Item).global_position
		else:
			continue
		var ph := k * 1.7
		pos += Vector3(sin(t * 1.3 + ph) * 0.03, 0.11 + sin(t * 2.1 + ph) * 0.03, cos(t * 1.1 + ph) * 0.03)
		mm.set_instance_transform(n, Transform3D(Basis.from_scale(Vector3.ONE * (0.8 + 0.4 * sin(t * 5.0 + ph))), pos))
		n += 1
	mm.visible_instance_count = n


# ---------------------------------------------------------------- testing hooks

func _pack_all(b: GameBox) -> void:
	var mine := pieces.all.filter(func(p: Pieces.P): return p.g.ed == b.ed_id and p.state == Pieces.LOOSE)
	var by_group := {}
	for p: Pieces.P in mine:
		if not by_group.has(p.g.key):
			by_group[p.g.key] = []
		by_group[p.g.key].append(p)
	for key in by_group:
		var list: Array = by_group[key]
		var nodes := []
		for p: Pieces.P in list:
			nodes.append(pieces.proxy(p))
			pieces.take(p)
		var why := b.accept_pieces(list, nodes)
		if why != "":
			print("  REFUSED pieces ", key, ": ", why)
	var rank := {"cards": 0, "board": 1, "rules": 2}
	var its := items.filter(func(i: Item): return i.game_id == b.ed_id and not i.stored)
	its.sort_custom(func(a: Item, c: Item): return rank[a.kind] < rank[c.kind])
	for it: Item in its:
		var why := b.try_accept(it)
		if why != "":
			print("  REFUSED ", it.label, ": ", why)


func _autotest() -> void:
	showcases = false
	GameBox.hold_open = 0.0
	_start()
	await get_tree().create_timer(3.0).timeout
	while not settled:
		await get_tree().process_frame
	var cards := 0
	for b in boxes:
		cards += b.units_needed
	print("pieces=", pieces.all.size(), " card piles/boards/rules=", items.size(), " boxes=", boxes.size(), " total units=", cards)
	print("settling: %d things set down in %d passes, worst float before %.1f mm; after: %d floating over 2 mm, worst %.1f mm" % [ground_report.moved, ground_report.passes, ground_report.worst_before_mm, ground_report.floating_after, ground_report.worst_after_mm])
	var tallest := 0.0
	for p: Pieces.P in pieces.all:
		if p.state == Pieces.LOOSE and (p.home as Dictionary).get("floor", false):
			tallest = maxf(tallest, p.xf.origin.y)
	print("tallest heap on the floor: %.2f m (limit %.2f)" % [tallest, FLOOR_PILE])
	print("big items below floor: ", items.filter(func(i: Item): return i.global_position.y < -0.5).size())
	for b in boxes:
		print("  %-34s %4d things  box %.2f x %.2f x %.2f m" % [b.game_name, b.units_needed, b.W, b.D, b.H])
	for s in slots:
		var h := 0.0
		for b in boxes:
			if b.line_id == s.line_id:
				h += b.H
		print("  shelf stack %-18s %.2f m (cubby %.2f)%s" % [s.game_name, h, CUBBY_H, "  TOO TALL" if h > CUBBY_H - 0.04 else ""])
	# Pieces from an expansion must not go in the base game's box, and vice versa.
	var base := boxes[0]
	var other: Pieces.P = pieces.all.filter(func(p: Pieces.P): return p.g.line == base.line_id and p.g.ed != base.ed_id)[0]
	var board: Array = items.filter(func(i: Item): return i.game_id == base.ed_id and i.kind == "board")
	print("expansion piece in base box -> ", base.check_pieces([other]), " | board too early -> ", base.check(board[0]) if not board.is_empty() else "n/a")
	# A real scoop: the handful should only contain matching pieces.
	var p0: Pieces.P = pieces.all[100]
	var hand := pieces.handful(p0)
	print("handful of ", p0.g.key, ": ", hand.size(), " all same kind: ", hand.all(func(q: Pieces.P): return q.g == p0.g))
	# Sifting: pour a mixed handful from two boxes; the box keeps only its own.
	var line_ps := pieces.all.filter(func(p: Pieces.P): return p.g.line == base.line_id and p.state == Pieces.LOOSE)
	var mixed := line_ps.filter(func(p: Pieces.P): return p.g.ed == base.ed_id).slice(0, 7) + line_ps.filter(func(p: Pieces.P): return p.g.ed != base.ed_id).slice(0, 5)
	var mixed_nodes := []
	for p: Pieces.P in mixed:
		mixed_nodes.append(pieces.proxy(p))
		pieces.take(p)
	var took := base.sift(mixed, mixed_nodes)
	print("sift: poured ", mixed.size(), " mixed pieces, box took ", took.size(), " (expected 7)")
	for i in mixed.size():
		if not took.has(i):
			(mixed_nodes[i] as Node).queue_free()
			pieces.set_loose(mixed[i], (mixed[i] as Pieces.P).xf)
	# Dropping: pieces tossed onto the floor and onto a table should come to rest on top, not inside.
	var droppers := pieces.all.filter(func(p: Pieces.P): return p.state == Pieces.LOOSE and p.g.line == "hoard").slice(0, 20) \
		+ pieces.all.filter(func(p: Pieces.P): return p.state == Pieces.LOOSE and p.g.line == "casino").slice(0, 20)
	for i in droppers.size():
		var p: Pieces.P = droppers[i]
		pieces.take(p)
		var over := Vector3(0.6 + randf_range(-0.3, 0.3), 1.2, 3.6 + randf_range(-0.3, 0.3)) if i % 2 == 0 else Vector3(-3.0 + randf_range(-0.4, 0.4), 1.4, -1.5 + randf_range(-0.2, 0.2))
		pieces.drop(p, Transform3D(Basis.from_euler(Vector3(randf(), randf(), randf()) * TAU), over), Vector3(randf_range(-1, 1), -1.0, randf_range(-1, 1)))
	await get_tree().create_timer(7.0).timeout
	var worst := 0.0
	var fell := 0
	for p: Pieces.P in droppers:
		if p.xf.origin.y < -0.5:
			fell += 1
			continue
		var bb: AABB = Transform3D(p.xf.basis) * p.g.aabb_table
		var q := PhysicsRayQueryParameters3D.create(p.xf.origin + Vector3(0, 0.03, 0), p.xf.origin - Vector3(0, 0.4, 0), Item.LAYER_WORLD | Item.LAYER_ITEMS)
		q.exclude = [p.body]
		var hit := get_world_3d().direct_space_state.intersect_ray(q)
		# Only measure pieces resting on the floor or furniture; one leaning over the edge of a card
		# pile or another piece would read as "sinking" when it isn't.
		if not hit.is_empty() and hit.collider is StaticBody3D:
			worst = maxf(worst, (hit.position as Vector3).y - (p.xf.origin.y + bb.position.y))
	print("drop test: %d pieces, %d fell through, deepest sink into floor or furniture %.1f mm" % [droppers.size(), fell, worst * 1000.0])
	# Tools.
	var seed_p: Pieces.P = pieces.all.filter(func(p: Pieces.P): return p.g.line == "hoard" and p.state == Pieces.LOOSE)[0]
	var pan := pieces.in_radius(seed_p.xf.origin, player.pan_radius, player.pan_max)
	var kinds := {}
	for p: Pieces.P in pan:
		kinds[p.g.key] = true
	print("dustpan at the dice ottoman: ", pan.size(), " pieces of ", kinds.size(), " kinds")
	print("magnet pulls ", pieces.handful(seed_p, player.magnet_radius, player.hand_max).size(), " matching ", seed_p.g.key, " vs a hand scoop of ", pieces.handful(seed_p).size())
	var vault: GameBox = boxes.filter(func(x: GameBox): return x.ed_id == "wyrm/vault")[0]
	_seek_box(vault)
	print("lantern on Monster Vault marks ", _firefly_targets.size(), " things (", pieces.loose_for("wyrm/vault").size(), " pieces + card piles)")
	player.unlocked = [true, true, true, true]
	for i in 4:
		player.set_tool(i)
	print("tool switching ok: ", player.tool == Player.MAGNET)
	player.set_tool(0)
	# The Tool Chest: earn, buy every level, and check the effects.
	_earn(2000)
	for u in Upgrades.LIST:
		for i in u.costs.size():
			_buy(u.id)
	print("shop: all bought=", Upgrades.LIST.all(func(u): return levels.get(u.id, 0) == u.costs.size()),
		" tokens left=", tokens, " hand_max=", player.hand_max, " pan=", player.pan_max, "/", player.pan_radius,
		" magnet=", player.magnet_radius, " chute=", player.chute_range, " pour x", GameBox.pour_speed)
	# Box Beacons light every box that wants something in a mixed handful.
	var mixed_line := pieces.all.filter(func(p: Pieces.P): return p.g.line == "hoard" and p.state == Pieces.LOOSE)
	mixed_line.shuffle()
	mixed_line = mixed_line.slice(0, 60)
	player._scoop(mixed_line)
	_beacon_t = 0.0
	_update_beacons(1.0)
	var lit := _beacons.values().filter(func(n: Node3D): return n.visible).size()
	var eds := {}
	for p: Pieces.P in mixed_line:
		eds[p.g.ed] = true
	print("beacons lit: ", lit, " (boxes wanted: ", eds.size(), ")")
	# The Sorting Chute: pour a mixed handful into one dice box; every piece should find its own box.
	var ember: GameBox = boxes.filter(func(x: GameBox): return x.ed_id == "hoard/ember")[0]
	var before := 0
	for b in boxes:
		before += b.units
	player._pour_into(ember)
	var after := 0
	for b in boxes:
		after += b.units
	print("chute: poured 60 mixed dice into one box, ", after - before, " went to their boxes, ", player.hand.size(), " left in hand")
	player._drop_hand(Vector3.ZERO)
	await get_tree().create_timer(2.0).timeout
	var t0 := Time.get_ticks_msec()
	for b in boxes:
		_pack_all(b)
	print("packed everything in ", Time.get_ticks_msec() - t0, " ms")
	await get_tree().create_timer(4.0).timeout
	for b in boxes:
		if not b.lid_closed:
			print("  NOT CLOSED ", b.game_name, " ", b.items_in, "/", b.items_needed)
	var wrong_ok := 0
	for b in boxes:
		var wrong: ShelfSlot = slots.filter(func(s: ShelfSlot): return s.line_id != b.line_id)[0]
		var right: ShelfSlot = slots.filter(func(s: ShelfSlot): return s.line_id == b.line_id)[0]
		if not wrong.place(b) and right.place(b):
			wrong_ok += 1
	print("boxes shelved correctly: ", wrong_ok, "/", boxes.size())
	print("sorted moments: ", sorted_count, "/", boxes.size())
	await get_tree().create_timer(2.5).timeout
	# The collection tour brings every box down, opened, and puts each one back where it was.
	var homes := boxes.map(func(b: GameBox): return b.global_position)
	_tour_start()
	var opened := 0
	for i in boxes.size():
		var shown: GameBox = _tour_order()[_tour_i]
		await get_tree().create_timer(0.5).timeout
		opened += 1 if shown.peeking and shown.global_position.distance_to(_tour_stand.global_position) < 1.0 else 0
		_tour_show(1)
	_tour_end()
	var back := 0
	for i in boxes.size():
		back += 1 if boxes[i].global_position.distance_to(homes[i]) < 0.001 and not boxes[i].peeking else 0
	print("collection tour: %d/%d shown open on the stand, %d/%d back on the shelf and closed" % [opened, boxes.size(), back, boxes.size()])
	var strays := 0
	for b in boxes:
		for it in b.contents.get_children():
			if it is Item and ((it as Item).kind == "board" or (it as Item).kind == "rules"):
				if (it as Item).global_position.distance_to(b.global_position) > 0.6 or not (it as Item).visible:
					strays += 1
	print("boards and rulebooks back in their boxes after the tour: %d out of place" % strays)
	print("finished=", finished, " mixups=", mixups)
	get_tree().quit()


func _shot(dir: String, name: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	print("shot ", name, " at ", Time.get_ticks_msec())
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, name])


func _view(pos: Vector3, yaw: float, pitch: float) -> void:
	player.global_position = pos
	player.look_at_yaw(yaw, pitch)
	await get_tree().create_timer(0.7).timeout


func _screenshots() -> void:
	var args := OS.get_cmdline_user_args()
	var dir := args[args.find("--shot") + 1]
	await get_tree().create_timer(3.0).timeout
	while not settled:
		await get_tree().process_frame
	showcases = false
	_start()
	hud.visible = false
	var cam := Camera3D.new()
	cam.fov = 50
	add_child(cam)
	cam.current = true
	var by_id := func(id: String) -> GameBox: return boxes.filter(func(x: GameBox): return x.ed_id == id)[0]
	# The cards as you walk past the tables.
	await _cam_at(cam, Vector3(-3.0, 1.45, -0.3), Vector3(-3.0, 0.75, -1.5))
	await _shot(dir, "cards_dining")
	await _cam_at(cam, Vector3(-8.3, 1.45, 4.95), Vector3(-8.3, 0.75, 6.0))
	await _shot(dir, "cards_ccg")
	# Open boxes waiting to be filled, then half packed (pieces and cards, board still out).
	var wy: GameBox = by_id.call("wyrm/base")
	await _cam_at(cam, wy.global_position + Vector3(0, 0.75, 0.55), wy.global_position)
	await _shot(dir, "box_open_empty")
	for b: GameBox in [wy, by_id.call("ccg/starter"), by_id.call("crowns/base")]:
		_pack_pieces_and_cards(b)
		print("half packed ", b.ed_id, " at ", Time.get_ticks_msec())
	await get_tree().create_timer(0.6).timeout
	# The "sorted!" moment, from where the showcase camera hangs.
	hud.visible = true
	await _cam_at(cam, wy.insert_top() + Vector3(0, 0.66, 0.48), wy.insert_top())
	await _shot(dir, "sorted_wyrm")
	await get_tree().create_timer(3.0).timeout
	while not settled:
		await get_tree().process_frame
	hud.visible = false
	await _cam_at(cam, wy.global_position + Vector3(0, 0.6, 0.45), wy.global_position)
	await _shot(dir, "box_wyrm_cards")
	var cg: GameBox = by_id.call("ccg/starter")
	await _cam_at(cam, cg.global_position + Vector3(0, 0.6, 0.45), cg.global_position)
	await _shot(dir, "box_ccg_cards")
	# Every box packed and closed: lids and cases where they sit.
	for b in boxes:
		_pack_all(b)
	await get_tree().create_timer(4.0).timeout
	var cr: GameBox = by_id.call("crowns/base")
	await _cam_at(cam, cr.global_position + Vector3(0.1, 0.65, 0.6), cr.global_position)
	await _shot(dir, "lid_crowns")
	var at: GameBox = by_id.call("atlas/base")
	await _cam_at(cam, at.global_position + Vector3(0.1, 0.65, 0.6), at.global_position)
	await _shot(dir, "lid_atlas")
	for id in ["hoard/ember", "casino/clay", "ccg/starter", "marbles/cateye", "paints/base"]:
		var b: GameBox = by_id.call(id)
		var fwd := Vector3(0, 0, 0.6).rotated(Vector3.UP, b.global_rotation.y)
		await _cam_at(cam, b.global_position + Vector3(0, 0.5, 0) + fwd, b.global_position)
		await _shot(dir, "case_" + id.get_slice("/", 0))
	# On the shelves.
	for b in boxes:
		var right: ShelfSlot = slots.filter(func(s: ShelfSlot): return s.line_id == b.line_id)[0]
		right.place(b)
	await get_tree().create_timer(2.5).timeout
	await _cam_at(cam, Vector3(0, 1.3, -2.2), Vector3(0, 1.0, -4.5))
	await _shot(dir, "shelf_games")
	await _cam_at(cam, Vector3(9.0, 1.3, 2.2), Vector3(7.6, 1.0, 0.1))
	await _shot(dir, "shelf_den")
	# The collection tour on the end screen.
	hud.visible = true
	_tour_start()
	await get_tree().create_timer(1.0).timeout
	await _shot(dir, "tour_1")
	_tour_show(3)
	await get_tree().create_timer(1.0).timeout
	await _shot(dir, "tour_2")
	_tour_end()
	get_tree().quit()


## A look into every room from its doorway, for documentation.
func _room_shots(dir: String) -> void:
	await get_tree().create_timer(3.0).timeout
	while not settled:
		await get_tree().process_frame
	_start()
	hud.visible = false
	var cam := Camera3D.new()
	cam.fov = 70
	add_child(cam)
	cam.current = true
	for v in [["room_living", Vector3(0.6, 1.6, 4.6), Vector3(0.0, 0.7, -2.0)],
			["room_card", Vector3(-6.5, 1.65, 5.3), Vector3(-10.5, 0.6, 4.2)],
			["room_den", Vector3(6.6, 1.65, 5.2), Vector3(11.0, 0.6, 3.4)],
			["room_studio", Vector3(0.3, 1.65, 8.0), Vector3(0.0, 0.6, 12.0)],
			["close_shelf", Vector3(0.6, 1.35, -2.6), Vector3(0.0, 0.95, -4.7)],
			["close_boxes", Vector3(-2.9, 1.15, 0.75), Vector3(-3.0, 0.1, -0.4)],
			["close_vaults", Vector3(12.7, 1.15, 2.4), Vector3(13.75, 0.1, 2.4)],
			["close_chipcases", Vector3(-11.1, 1.15, 3.45), Vector3(-11.1, 0.1, 2.5)]]:
		await _cam_at(cam, v[1], v[2])
		await _shot(dir, v[0])
	get_tree().quit()


## Every game packed away, each box shown open on the collection stand.
func _set_shots(dir: String) -> void:
	showcases = false
	GameBox.hold_open = 0.0
	await get_tree().create_timer(3.0).timeout
	while not settled:
		await get_tree().process_frame
	_start()
	hud.visible = false
	for b in boxes:
		_pack_all(b)
	await get_tree().create_timer(5.0).timeout
	# As in the game: the collection tour comes once everything is on the shelves.
	for b in boxes:
		var right: ShelfSlot = slots.filter(func(s: ShelfSlot): return s.line_id == b.line_id)[0]
		right.place(b)
	await get_tree().create_timer(2.0).timeout
	_tour_start()
	var want := ["crowns/base", "plum/base", "atlas/base", "honey/base", "orchard/base", "wyrm/base", "wyrm/vault",
		"hoard/galaxy", "casino/royale", "ccg/aurora", "caverns/base", "marbles/cateye", "paints/base", "paints/brushes"]
	for id in want:
		for b in _tour_home.keys():
			_tour_put_back(b)
		var order := _tour_order()
		for i in order.size():
			if (order[i] as GameBox).ed_id == id:
				_tour_i = i
		_tour_show(0)
		# Count frames as well as time: rendering is slow here, and the lid has to finish opening.
		for f in 12:
			await get_tree().process_frame
		await get_tree().create_timer(1.2).timeout
		var strays := []
		for it: Item in items:
			if it.stored and it.game_id != id and it.visible and it.global_position.distance_to(_tour_stand.global_position) < 1.2:
				strays.append(it.label)
		print("set %s: %d stray items near the stand %s" % [id, strays.size(), str(strays.slice(0, 3))])
		await _shot(dir, "set_" + id.replace("/", "_"))
	get_tree().quit()


## A close look at every game as it was left mid-play.
func _table_shots(dir: String) -> void:
	await get_tree().create_timer(3.0).timeout
	while not settled:
		await get_tree().process_frame
	_start()
	hud.visible = false
	var cam := Camera3D.new()
	cam.fov = 55
	add_child(cam)
	cam.current = true
	for sname in ["war", "dining", "gametable", "cardtable", "coffee", "bench", "round", "dicetable", "curio", "poker", "ccgtable", "paintdesk", "ring"]:
		var sp: Dictionary = spots[sname]
		var c: Vector3 = sp.center
		var ext: Vector2 = sp.ext
		var reach := maxf(ext.x, ext.y)
		var away := Vector3((sp.row_start as Vector3).x - c.x, 0, (sp.row_start as Vector3).z - c.z)
		away = away.normalized() if away.length() > 0.1 else Vector3(0, 0, 1)
		await _cam_at(cam, c + Vector3(0, 0.55 + reach * 0.9, 0) + away * (0.45 + reach * 0.75), c)
		await _shot(dir, "table_" + sname)
	get_tree().quit()


func _cam_at(cam: Camera3D, eye: Vector3, target: Vector3) -> void:
	cam.global_position = eye
	cam.look_at(target)
	await get_tree().create_timer(0.6).timeout


## Packs a box's pieces and card piles but leaves the board and rulebook out, so it stays open.
func _pack_pieces_and_cards(b: GameBox) -> void:
	var mine := pieces.all.filter(func(p: Pieces.P): return p.g.ed == b.ed_id and p.state == Pieces.LOOSE)
	var by_group := {}
	for p: Pieces.P in mine:
		if not by_group.has(p.g.key):
			by_group[p.g.key] = []
		by_group[p.g.key].append(p)
	for key in by_group:
		var nodes := []
		for p: Pieces.P in by_group[key]:
			nodes.append(pieces.proxy(p))
			pieces.take(p)
		b.accept_pieces(by_group[key], nodes)
	for it: Item in items.filter(func(i: Item): return i.game_id == b.ed_id and not i.stored and i.kind == "cards"):
		b.try_accept(it)



## A labelled top-down plan of the room, for documentation.
func _render_map(dir: String) -> void:
	await get_tree().create_timer(3.0).timeout
	while not settled:
		await get_tree().process_frame
	hud.visible = false
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 20.4
	cam.near = 0.05
	cam.far = 6.0
	# Just below the lamps, so the ceilings, beams and pendants don't hide the rooms.
	cam.position = Vector3(0.5, 1.98, 4.2)
	cam.rotation = Vector3(-PI / 2, 0, 0)
	add_child(cam)
	cam.current = true
	var font: Font = load("res://fonts/righteous-latin-400-normal.woff2")
	var tags := [
		["LIVING ROOM", Vector3(0, 0, 3.0), 0.0], ["GAME SHELF", Vector3(0, 0, -4.25), 0.0],
		["Plum Parlor\ndining table", Vector3(-3.0, 0, -1.5), 0.0], ["Starfall Atlas\ngame table", Vector3(0.4, 0, -2.3), 0.0],
		["Lantern Harbor\ncard table", Vector3(3.6, 0, -2.6), 0.0], ["Honeycomb Hustle\ncoffee table", Vector3(3.0, 0, 1.0), 0.0],
		["Orchard Hollow\nwindow seat", Vector3(-5.2, 0, 0.5), 0.0], ["FIREPLACE", Vector3(5.6, 0, 0.2), PI / 2],
		["★ START", Vector3(0.6, 0, 3.9), 0.0],
		["THE CARD ROOM", Vector3(-9.7, 0, 2.4), 0.0], ["Velvet Card Room\npoker table", Vector3(-10.6, 0, 4.0), 0.0],
		["Prismatic Legends\ncard table", Vector3(-8.3, 0, 6.0), 0.0], ["SHELF", Vector3(-12.9, 0, 4.8), PI / 2],
		["THE DRAGON'S DEN", Vector3(10.2, 0, 1.4), 0.0], ["Wyrmlight Tales\nround table", Vector3(9.6, 0, 3.6), 0.0],
		["Mossy Crowns\nwar table", Vector3(10.9, 0, 6.45), 0.0], ["Crystal Caverns\ncurio", Vector3(12.3, 0, 2.0), 0.0],
		["Dice Hoard\ndice tray", Vector3(12.4, 0, 4.1), 0.0], ["SHELF", Vector3(7.6, 0, 0.3), 0.0],
		["HOBBY STUDIO", Vector3(0, 0, 8.6), 0.0], ["Brushwork Hobby\npainting desk", Vector3(-1.6, 0, 12.6), 0.0],
		["Marble Jar\nring", Vector3(1.0, 0, 10.4), 0.0], ["SHELF", Vector3(1.6, 0, 13.0), 0.0],
	]
	for t in tags:
		var l := Label3D.new()
		l.text = String(t[0]).replace("\\n", "\n")
		l.font = font
		l.font_size = 64
		l.pixel_size = 0.0042
		l.modulate = Color("fff1de") if not String(t[0]).begins_with("★") else Color("f3c860")
		l.outline_size = 22
		l.outline_modulate = Color("1a0f0a")
		l.no_depth_test = true
		l.rotation = Vector3(-PI / 2, t[2], 0)
		l.position = (t[1] as Vector3) + Vector3(0, 1.9, 0)
		world.add_child(l)
	for i in 2:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(dir + "/map.png")
	get_tree().quit()



## A wooden board with gilded lettering printed on its face.
func _sign(parent: Node3D, text: String, at: Vector3, size: Vector2) -> void:
	parent.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(size.x + 0.04, size.y + 0.04, 0.025)), MeshKit.mat(Color("3a2216"), 0.6), at))
	var tex := LogoKit.plaque(self, text, Vector2i(1024, int(1024.0 * size.y / size.x)), Color("4a2c1a"), Color("f3c860"), Color("8a6a1a"),
		"res://fonts/CinzelDecorative-Black.woff2")
	CaseKit._print(parent, size, tex, at + Vector3(0, 0, 0.0131), false, 0.45, 0.2)
