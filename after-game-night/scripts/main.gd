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
const PIECE_SCALE := 0.9
const CARD_SCALE := 1.0
## Which surface each game line is played on.
const PLAYED_ON := {"crowns": "rug", "plum": "dining", "atlas": "gametable", "harbor": "cardtable", "honey": "coffee", "orchard": "bench", "wyrm": "round", "hoard": "ottoman",
	"casino": "poker", "ccg": "ccgtable", "caverns": "curio", "marbles": "ring", "paints": "paintdesk"}
## Game lines that live on the second shelf, by the hobby nook.
const HOBBY_LINES := ["casino", "ccg", "caverns", "marbles", "paints"]
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
	_build_hobby_nook()

	faces_root = Node.new()
	faces_root.name = "CardFaces"
	add_child(faces_root)
	pieces = Pieces.new()
	add_child(pieces)
	pieces.clacked.connect(_on_piece_clack)
	_define_spots()
	var lines := GameData.LINES.duplicate()
	var main_lines := lines.filter(func(l): return not HOBBY_LINES.has(l.id))
	var hobby_lines := lines.filter(func(l): return HOBBY_LINES.has(l.id))
	main_lines.shuffle()
	hobby_lines.shuffle()
	_build_shelf(main_lines, Vector3(0, 0, -4.72), 0.0, 4, "Game Shelf")
	_build_shelf(hobby_lines, Vector3(5.68, 0, -3.1), -PI / 2, 3, "Hobby Shelf")
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
	_refresh_hud()
	_update_tidy()
	hud.show_title(true)
	_quiet_until = Time.get_ticks_msec() / 1000.0 + 3.0

	var args := OS.get_cmdline_user_args()
	if "--autotest" in args:
		_autotest()
	elif "--shot" in args:
		_screenshots()
	elif "--map" in args:
		_render_map(args[args.find("--map") + 1])


# ---------------------------------------------------------------- input

func _setup_input() -> void:
	var keys := {
		"move_forward": [KEY_W, KEY_UP], "move_back": [KEY_S, KEY_DOWN],
		"move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT],
		"sprint": [KEY_SHIFT], "crouch": [KEY_C, KEY_CTRL], "interact": [KEY_E],
		"throw": [KEY_Q], "hint": [KEY_H], "pause": [KEY_ESCAPE, KEY_P], "shop": [KEY_TAB, KEY_B],
	}
	for a in keys:
		if not InputMap.has_action(a):
			InputMap.add_action(a)
		for k in keys[a]:
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(a, ev)


func _unhandled_input(e: InputEvent) -> void:
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
			entries.append({"key": "cards:" + set_name, "cards": card_piles[set_name].cards})
		var lay := GameBox.plan(entries)
		depth = maxf(depth, lay.depth)
		var extra: Array[Item] = []
		if ed.get("rules", true):
			extra.append(_make_rules(ed_key, ed_name, style.body))
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
	for plan in plans:
		for g: Pieces.Group in plan.groups:
			_lay_out_group(g, plan.where[g.key], spot)
		for it: Item in plan.cards:
			var home := spot
			if rng.randf() < STRAY_CHANCE:
				home = _stray_spot(spot)
			_put_item(it, home, _free_point(home, 0.06), rng.randf_range(0, TAU))
		for it: Item in plan.extra:
			if it.kind == "rules":
				_put_item(it, spot, _free_point(spot, 0.14), rng.randf_range(0, TAU))


func _stray_spot(spot: Dictionary) -> Dictionary:
	var names := spots.keys()
	var pick: Dictionary = spots[names[rng.randi_range(0, names.size() - 1)]]
	return pick if pick != spot else spots["couch"]


func _free_point(spot: Dictionary, r: float) -> Vector3:
	var c: Vector3 = spot.center
	var ext: Vector2 = spot.ext
	var hm: HMap = spot.hmap
	var inv: Transform3D = (spot.get("board_xf", Transform3D(Basis(), Vector3(999, 0, 999))) as Transform3D).affine_inverse()
	var best := c
	var best_h := INF
	for t in 10:
		var p := c + Vector3(rng.randf_range(-ext.x + r, ext.x - r), 0, rng.randf_range(-ext.y + r, ext.y - r))
		var l := inv * p
		var on_board := absf(l.x) < 0.27 and absf(l.z) < 0.27
		var hh := hm.top(p.x, p.z, r) + (0.05 if on_board else 0.0) + rng.randf() * 0.01
		if hh < best_h:
			best_h = hh
			best = p
	return best


## Sets a piece down on top of whatever is already there. If the pile would get taller than
## max_pile, it goes somewhere less crowded instead, so heaps spread out rather than tower.
func _place_piece(p: Pieces.P, spot: Dictionary, x: float, z: float, yaw: float, max_pile := 0.07) -> void:
	var hm: HMap = spot.hmap
	var bb := p.g.aabb_table
	var r := maxf(bb.size.x, bb.size.z) * 0.42
	var y := hm.top(x, z, r)
	var tries := 0
	while y + bb.size.y - (spot.center as Vector3).y > max_pile and tries < 6:
		var q := _free_point(spot, r * 2.0)
		x = q.x + rng.randf_range(-r, r)
		z = q.z + rng.randf_range(-r, r)
		y = hm.top(x, z, r)
		tries += 1
	hm.raise(x, z, r, y + bb.size.y)
	p.xf = Transform3D(Basis(Vector3.UP, yaw), Vector3(x, y - bb.position.y + 0.0005, z))
	p.home = spot


func _lay_out_group(g: Pieces.Group, how: String, spot: Dictionary) -> void:
	var list := g.members.duplicate()
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


func _make_rules(ed_key: String, ed_name: String, c: Color) -> Item:
	var it := Item.new()
	it.game_id = ed_key
	it.kind = "rules"
	it.label = "%s rulebook" % ed_name
	_attach(it, MeshKit.rulebook(c, ed_name), 1.0)
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
	match kind:
		"pick":
			var it := data as Item
			sfx.at("tick", it.global_position, -4.0, 1.2)
			_clear_hint(it)
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
	env.glow_hdr_threshold = 0.95
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.ssao_enabled = true
	env.ssao_radius = 0.7
	env.ssao_intensity = 2.0
	env.ssil_enabled = true
	env.ssil_intensity = 1.2
	# A faint warm haze so lamplight hangs in the air.
	env.volumetric_fog_enabled = true
	env.volumetric_fog_density = 0.018
	env.volumetric_fog_albedo = Color(1.0, 0.86, 0.72)
	env.volumetric_fog_anisotropy = 0.5
	env.volumetric_fog_length = 16.0
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.06
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
	node.add_child(MeshKit.mesh_node(MeshKit.box(size), m))
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
	var floor_m := MeshKit.tex_mat(MeshKit.plank_texture(Color("8a5532")), 0.45, 0.55)
	var wall_m := MeshKit.tex_mat(MeshKit.stripe_texture(Color("a4785a"), Color("94694d")), 0.9, 0.95)
	var ceil_m := MeshKit.tex_mat(MeshKit.plank_texture(Color("6e4a33"), 9), 0.35, 0.8)
	var trim := MeshKit.mat(Color("4a2a18"), 0.6)
	var wainscot := MeshKit.mat(Color("2e4637"), 0.75)
	# The room runs from the game shelf (z -5) to the hobby nook at the front (z 7.6).
	_solid(Vector3(12.4, 0.2, 13.2), Vector3(0, -0.1, 1.3), floor_m)
	_solid(Vector3(12.4, 0.2, 13.2), Vector3(0, 3.1, 1.3), ceil_m)
	_solid(Vector3(12.4, 3.2, 0.2), Vector3(0, 1.5, -5.1), wall_m)
	_solid(Vector3(12.4, 3.2, 0.2), Vector3(0, 1.5, 7.7), wall_m)
	_solid(Vector3(0.2, 3.2, 13.2), Vector3(-6.1, 1.5, 1.3), wall_m)
	_solid(Vector3(0.2, 3.2, 13.2), Vector3(6.1, 1.5, 1.3), wall_m)
	# Painted wainscoting with a wooden rail, all the way round.
	for z in [-4.985, 7.585]:
		_solid(Vector3(12.0, 0.95, 0.03), Vector3(0, 0.475, z), wainscot, false)
		_solid(Vector3(12.0, 0.05, 0.06), Vector3(0, 0.95, z), trim, false)
		_solid(Vector3(12.0, 0.14, 0.05), Vector3(0, 0.07, z), trim, false)
	for x in [-5.985, 5.985]:
		_solid(Vector3(0.03, 0.95, 12.6), Vector3(x, 0.475, 1.3), wainscot, false)
		_solid(Vector3(0.06, 0.05, 12.6), Vector3(x, 0.95, 1.3), trim, false)
		_solid(Vector3(0.05, 0.14, 12.6), Vector3(x, 0.07, 1.3), trim, false)
	for x in [-4.0, -1.3, 1.3, 4.0]:
		_solid(Vector3(0.22, 0.2, 12.6), Vector3(x, 2.9, 1.3), trim, false)

	# Night window on the left wall: cool moonlight against all the warm lamps.
	var glass := MeshKit.mat(Color("16224a"), 0.2, 0.7)
	_solid(Vector3(0.04, 1.3, 1.7), Vector3(-5.99, 1.65, 0.5), glass, false)
	var frame := MeshKit.mat(Color("e8d8c0"), 0.6)
	for y in [1.0, 1.65, 2.3]:
		_solid(Vector3(0.08, 0.07, 1.8), Vector3(-5.96, y, 0.5), frame, false)
	for z in [-0.37, 0.5, 1.37]:
		_solid(Vector3(0.08, 1.37, 0.07), Vector3(-5.96, 1.65, z), frame, false)
	var curtain := MeshKit.mat(Color("7b3b5c"), 0.95)
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
	var brick := MeshKit.tex_mat(MeshKit.brick_texture(), 1.6, 0.9)
	var stone := MeshKit.mat(Color("5d544c"), 0.9)
	var soot := MeshKit.mat(Color("1a1210"), 1.0)
	var wood := MeshKit.mat(Color("4a2a18"), 0.6)
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
	# A painting above the mantel.
	_solid(Vector3(0.04, 0.7, 1.0), Vector3(5.72, 2.15, z), MeshKit.mat(Color("5c3520"), 0.6), false)
	_solid(Vector3(0.045, 0.58, 0.88), Vector3(5.715, 2.15, z), MeshKit.mat(Color("2c3d5a"), 0.9), false)
	_solid(Vector3(0.05, 0.18, 0.5), Vector3(5.71, 2.0, z + 0.1), MeshKit.mat(Color("3f6b4a"), 0.9), false)
	_solid(Vector3(0.05, 0.08, 0.08), Vector3(5.71, 2.3, z - 0.25), MeshKit.mat(Color("f3e2a8"), 0.5, 0.6), false)


func _table(center: Vector3, size: Vector3, wood: Material) -> void:
	var top_t := 0.05
	_solid(Vector3(size.x, top_t, size.z), center + Vector3(0, size.y - top_t / 2, 0), wood)
	var lx := size.x / 2 - 0.08
	var lz := size.z / 2 - 0.08
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			_solid(Vector3(0.06, size.y - top_t, 0.06), center + Vector3(sx * lx, (size.y - top_t) / 2, sz * lz), wood)


func _floor_lamp(pos: Vector3, shade: Color, energy: float, shadow := false) -> void:
	var brass := MeshKit.mat(Color("b08d4a"), 0.35)
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.15, 0.17, 0.03), brass, pos + Vector3(0, 0.015, 0)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.014, 0.014, 1.45), brass, pos + Vector3(0, 0.75, 0)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.16, 0.26, 0.3, 24), MeshKit.mat(shade, 0.9, 1.4), pos + Vector3(0, 1.58, 0)))
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


func _build_furniture() -> void:
	var wood := MeshKit.mat(Color("6a3f24"), 0.55)
	var light_wood := MeshKit.mat(Color("9c6a40"), 0.6)
	_table(Vector3(-3.0, 0, -1.5), Vector3(1.9, 0.76, 1.0), wood)
	_table(Vector3(3.0, 0, 1.0), Vector3(1.2, 0.44, 0.66), light_wood)
	_table(Vector3(3.6, 0, -2.6), Vector3(1.0, 0.74, 1.0), MeshKit.mat(Color("2f5a46"), 0.85))
	# The big game table in the middle of the room.
	_table(Vector3(0.4, 0, -2.3), Vector3(1.5, 0.74, 1.05), wood)
	_solid(Vector3(1.3, 0.003, 0.85), Vector3(0.4, 0.7415, -2.3), MeshKit.mat(Color("2e4a3a"), 1.0), false)
	_solid(Vector3(1.04, 0.03, 1.04), Vector3(3.6, 0.725, -2.6), wood, false)

	for p in [[Vector3(-3.5, 0, -2.3), 0.0], [Vector3(-2.5, 0, -2.3), 0.0], [Vector3(-4.25, 0, -1.5), PI / 2]]:
		_chair(p[0], p[1], wood)

	# Window seat with cushion and pillows.
	_solid(Vector3(0.7, 0.42, 2.2), Vector3(-5.65, 0.21, 0.5), MeshKit.mat(Color("d9c8ae"), 0.8))
	_solid(Vector3(0.66, 0.08, 2.14), Vector3(-5.65, 0.46, 0.5), MeshKit.mat(Color("5f7f76"), 0.95))
	world.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.14, 0.36, 0.42)), MeshKit.mat(Color("e8b04a"), 0.95), Vector3(-5.85, 0.66, 1.4), Vector3(0, 0, 0.25)))

	# Couch with a knitted throw.
	var fabric := MeshKit.mat(Color("8f4636"), 0.95)
	var fabric2 := MeshKit.mat(Color("a2563f"), 0.95)
	_solid(Vector3(2.3, 0.3, 0.95), Vector3(3.0, 0.15, 3.0), fabric)
	_solid(Vector3(2.3, 0.65, 0.25), Vector3(3.0, 0.62, 3.42), fabric)
	for sx in [-1, 1]:
		_solid(Vector3(0.22, 0.55, 0.95), Vector3(3.0 + sx * 1.15, 0.37, 3.0), fabric)
	for sx in [-0.5, 0.5]:
		_solid(Vector3(1.0, 0.14, 0.78), Vector3(3.0 + sx * 1.02, 0.37, 2.95), fabric2)
	world.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.4, 0.38, 0.14)), MeshKit.mat(Color("e8b04a"), 0.95), Vector3(2.2, 0.66, 3.22), Vector3(-0.25, 0.3, 0.1)))
	world.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.6, 0.03, 0.9)), MeshKit.mat(Color("d9c8ae"), 1.0), Vector3(3.75, 0.95, 3.25), Vector3(0.9, 0, 0)))

	# Round rug under the floor game, a rectangular one by the fire.
	var rug := StaticBody3D.new()
	rug.collision_layer = Item.LAYER_WORLD
	var rcs := CollisionShape3D.new()
	rcs.shape = MeshKit._cyl_shape(1.45, 0.02)
	rug.add_child(rcs)
	rug.add_child(MeshKit.mesh_node(MeshKit.cyl(1.45, 1.45, 0.02, 48), MeshKit.mat(Color("6b3350"), 1.0)))
	rug.add_child(MeshKit.mesh_node(MeshKit.cyl(1.25, 1.25, 0.022, 48), MeshKit.mat(Color("c8913a"), 1.0)))
	rug.add_child(MeshKit.mesh_node(MeshKit.cyl(1.17, 1.17, 0.024, 48), MeshKit.mat(Color("7a3c5c"), 1.0)))
	rug.position = Vector3(-2.4, 0.01, 2.5)
	world.add_child(rug)
	_solid(Vector3(3.2, 0.012, 2.4), Vector3(3.0, 0.006, 1.6), MeshKit.mat(Color("34505e"), 1.0), false)
	# Floor cushions around the rug game.
	for p in [Vector3(-3.7, 0.08, 3.3), Vector3(-1.2, 0.08, 3.4)]:
		var cush := MeshKit.mesh_node(MeshKit.cyl(0.32, 0.34, 0.16, 20), MeshKit.mat(Color("5f7f76"), 0.95), p)
		world.add_child(cush)


func _chair(pos: Vector3, rot: float, m: Material) -> void:
	var root := Node3D.new()
	root.position = pos
	root.rotation.y = rot
	world.add_child(root)
	var seat := StaticBody3D.new()
	seat.collision_layer = Item.LAYER_WORLD
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(0.44, 0.46, 0.44)
	cs.shape = bs
	cs.position.y = 0.23
	seat.add_child(cs)
	seat.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.44, 0.04, 0.44)), m, Vector3(0, 0.45, 0)))
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			seat.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.04, 0.45, 0.04)), m, Vector3(sx * 0.19, 0.225, sz * 0.19)))
	seat.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.44, 0.5, 0.04)), m, Vector3(0, 0.72, -0.2)))
	seat.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.38, 0.04, 0.38)), MeshKit.mat(Color("8f4636"), 0.95), Vector3(0, 0.49, 0)))
	root.add_child(seat)


func _build_decor() -> void:
	# Pendant over the dining table: the main pool of light for two of the games.
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.006, 0.006, 0.55), MeshKit.mat(Color("222222")), Vector3(-3.0, 2.75, -1.5)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.08, 0.34, 0.24, 28), MeshKit.mat(Color("2f5a46"), 0.5), Vector3(-3.0, 2.38, -1.5)))
	world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.07), MeshKit.mat(Color("ffe2b0"), 0.5, 6.0), Vector3(-3.0, 2.27, -1.5)))
	var pend := SpotLight3D.new()
	pend.position = Vector3(-3.0, 2.25, -1.5)
	pend.rotation.x = -PI / 2
	pend.light_color = Color(1.0, 0.72, 0.45)
	pend.light_energy = 4.0
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

	for p in [Vector3(-5.4, 0, -4.5), Vector3(5.45, 0, -1.3), Vector3(5.5, 0, 4.5)]:
		_plant(p)

	# A cup of tea left on the coffee table.
	var mug := Node3D.new()
	mug.position = Vector3(3.52, 0.44, 0.75)
	mug.add_child(MeshKit.mesh_node(MeshKit.cyl(0.04, 0.036, 0.09), MeshKit.mat(Color("8c4a86"), 0.4), Vector3(0, 0.045, 0)))
	mug.add_child(MeshKit.mesh_node(MeshKit.cyl(0.034, 0.034, 0.002), MeshKit.mat(Color("5a2a14"), 0.2), Vector3(0, 0.085, 0)))
	world.add_child(mug)


func _plant(pos: Vector3) -> void:
	var p := Node3D.new()
	p.position = pos
	p.add_child(MeshKit.mesh_node(MeshKit.cyl(0.2, 0.15, 0.36), MeshKit.mat(Color("a5573a"), 0.8), Vector3(0, 0.18, 0)))
	var leaf := MeshKit.mat(Color("3f6a32"), 0.8)
	var leaf2 := MeshKit.mat(Color("5a8a40"), 0.8)
	for i in 7:
		var a := TAU * i / 7.0
		var b := MeshKit.mesh_node(MeshKit.sphere(0.17 + rng.randf() * 0.08, 10), leaf if i % 2 == 0 else leaf2,
			Vector3(cos(a) * 0.12, 0.55 + rng.randf() * 0.35, sin(a) * 0.12))
		b.scale = Vector3(1, 1.3, 1)
		p.add_child(b)
	world.add_child(p)


func _build_rpg_corner() -> void:
	# A round table for the roleplaying game, under its own little lamp.
	var wood := MeshKit.mat(Color("5e3620"), 0.55)
	var top := StaticBody3D.new()
	top.collision_layer = Item.LAYER_WORLD
	var tcs := CollisionShape3D.new()
	tcs.shape = MeshKit._cyl_shape(0.62, 0.05)
	top.add_child(tcs)
	top.add_child(MeshKit.mesh_node(MeshKit.cyl(0.62, 0.62, 0.05, 40), wood))
	top.add_child(MeshKit.mesh_node(MeshKit.cyl(0.56, 0.56, 0.004, 40), MeshKit.mat(Color("5a1e2c"), 1.0), Vector3(0, 0.026, 0)))
	top.position = Vector3(0.55, 0.715, 0.75)
	world.add_child(top)
	_solid(Vector3(0.12, 0.69, 0.12), Vector3(0.55, 0.345, 0.75), wood)
	_solid(Vector3(0.5, 0.04, 0.5), Vector3(0.55, 0.02, 0.75), wood)
	var lamp := SpotLight3D.new()
	lamp.position = Vector3(0.55, 2.1, 0.75)
	lamp.rotation.x = -PI / 2
	lamp.light_color = Color(1.0, 0.7, 0.42)
	lamp.light_energy = 4.0
	lamp.spot_range = 3.0
	lamp.spot_angle = 40.0
	lamp.shadow_enabled = true
	world.add_child(lamp)
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.006, 0.006, 0.8), MeshKit.mat(Color("222222")), Vector3(0.55, 2.6, 0.75)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.06, 0.24, 0.2, 24), MeshKit.mat(Color("6b1e2c"), 0.5), Vector3(0.55, 2.15, 0.75)))
	world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.05), MeshKit.mat(Color("ffe2b0"), 0.5, 6.0), Vector3(0.55, 2.06, 0.75)))
	# A felt-topped dice ottoman by the fire, for the dice hoard.
	_solid(Vector3(0.82, 0.38, 1.12), Vector3(4.72, 0.19, 0.35), MeshKit.mat(Color("4a2a3a"), 0.95))
	_solid(Vector3(0.78, 0.03, 1.08), Vector3(4.72, 0.395, 0.35), MeshKit.mat(Color("2a3f5a"), 1.0))
	for z in [-0.2, 0.9]:
		_solid(Vector3(0.82, 0.03, 0.04), Vector3(4.72, 0.425, z), MeshKit.mat(Color("b08d4a"), 0.35), false)


func _build_extra_lights() -> void:
	_build_rpg_corner()
	# A low pendant over the big game table in the middle of the room.
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.006, 0.006, 0.75), MeshKit.mat(Color("222222")), Vector3(0.4, 2.65, -2.3)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.07, 0.3, 0.22, 28), MeshKit.mat(Color("8a4a2a"), 0.5), Vector3(0.4, 2.18, -2.3)))
	world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.06), MeshKit.mat(Color("ffe2b0"), 0.5, 6.0), Vector3(0.4, 2.08, -2.3)))
	var spot := SpotLight3D.new()
	spot.position = Vector3(0.4, 2.06, -2.3)
	spot.rotation.x = -PI / 2
	spot.light_color = Color(1.0, 0.72, 0.45)
	spot.light_energy = 5.0
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
	var wood := MeshKit.mat(Color("5e3620"), 0.6)
	var back := MeshKit.mat(Color("3a2216"), 0.8)
	var cw := 0.9
	var ch := 0.82
	var bt := 0.05
	var depth := 0.55
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
	_solid(Vector3(width, 0.1, 0.03), Vector3(0, 0.05, depth / 2 - 0.015), wood, false, 0.0, rack)

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
			rack.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.66, 0.046, 0.006)), MeshKit.mat(line.color, 0.6), Vector3(cx, fy - bt / 2, depth / 2 + 0.004)))
			var lbl := Label3D.new()
			lbl.text = line.name
			lbl.font_size = 40
			lbl.pixel_size = 0.0009
			lbl.outline_size = 6
			lbl.outline_modulate = Color(line.color).darkened(0.6)
			lbl.position = Vector3(cx, fy - bt / 2, depth / 2 + 0.009)
			rack.add_child(lbl)

	var bx := -width / 2 + 0.15
	for i in 7:
		var h := rng.randf_range(0.2, 0.3)
		var col: Color = [Color("c8473b"), Color("2e8c9a"), Color("e09a1f"), Color("5a8d39"), Color("8c4a86")][i % 5]
		rack.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.05, h, 0.2)), MeshKit.mat(col.darkened(0.2), 0.8), Vector3(bx, top_y + 0.05 + h / 2, 0)))
		bx += 0.06
	_plant(rack.to_global(Vector3(width / 2 - 0.25, top_y + 0.05, 0)))
	var title := Label3D.new()
	title.text = title_text
	title.font_size = 64
	title.pixel_size = 0.0018
	title.modulate = Color("f3b648")
	title.outline_size = 12
	title.outline_modulate = Color("3a1f0f")
	title.position = Vector3(0.1, top_y + 0.24, 0.05)
	rack.add_child(title)


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
		"dining": {"center": Vector3(-3.0, 0.76, -1.5), "ext": Vector2(0.9, 0.46), "row_start": Vector3(-3.55, 0.0, -0.4), "rot": 0.0, "spill": "floor_dining"},
		"rug": {"center": Vector3(-2.4, 0.022, 2.5), "ext": Vector2(0.98, 0.98), "row_start": Vector3(-0.55, 0.0, 3.25), "rot": PI / 2},
		"gametable": {"center": Vector3(0.4, 0.743, -2.3), "ext": Vector2(0.7, 0.48), "row_start": Vector3(-0.45, 0.0, -1.15), "rot": 0.0, "spill": "floor_game"},
		"cardtable": {"center": Vector3(3.6, 0.74, -2.6), "ext": Vector2(0.47, 0.47), "row_start": Vector3(2.45, 0.0, -3.5), "rot": -PI / 2, "spill": "floor_card"},
		"coffee": {"center": Vector3(3.0, 0.44, 1.0), "ext": Vector2(0.57, 0.3), "row_start": Vector3(1.75, 0.0, 0.55), "rot": -PI / 2, "spill": "floor_coffee"},
		"bench": {"center": Vector3(-5.65, 0.5, 0.5), "ext": Vector2(0.29, 1.02), "row_start": Vector3(-4.8, 0.0, 1.45), "rot": PI / 2, "spill": "floor_bench"},
		"round": {"center": Vector3(0.55, 0.743, 0.75), "ext": Vector2(0.4, 0.4), "row_start": Vector3(-0.3, 0.0, -0.45), "rot": 0.0, "spill": "floor_round"},
		"ottoman": {"center": Vector3(4.72, 0.41, 0.35), "ext": Vector2(0.36, 0.5), "row_start": Vector3(4.0, 0.0, 4.45), "rot": PI, "spill": "floor_ottoman"},
		"floor_round": {"center": Vector3(0.55, 0.0, 1.75), "ext": Vector2(0.35, 0.2), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_ottoman": {"center": Vector3(4.75, 0.0, 1.45), "ext": Vector2(0.35, 0.22), "row_start": Vector3.ZERO, "rot": 0.0},
		# The hobby nook at the front of the room; its boxes line the front wall.
		"paintdesk": {"center": Vector3(-4.6, 0.763, 5.62), "ext": Vector2(0.7, 0.22), "row_start": Vector3(-3.75, 0.0, 7.12), "rot": PI},
		"poker": {"center": Vector3(-1.6, 0.763, 5.75), "ext": Vector2(0.5, 0.27), "row_start": Vector3(-0.6, 0.0, 7.12), "rot": PI},
		"ccgtable": {"center": Vector3(0.9, 0.746, 5.75), "ext": Vector2(0.4, 0.38), "row_start": Vector3(2.0, 0.0, 7.12), "rot": PI},
		"curio": {"center": Vector3(3.3, 0.706, 5.75), "ext": Vector2(0.33, 0.33), "row_start": Vector3(3.73, 0.0, 7.12), "rot": PI},
		"ring": {"center": Vector3(5.0, 0.014, 5.75), "ext": Vector2(0.38, 0.38), "row_start": Vector3(5.45, 0.0, 7.12), "rot": PI},
		"couch": {"center": Vector3(3.0, 0.44, 2.92), "ext": Vector2(0.95, 0.3), "row_start": Vector3.ZERO, "rot": 0.0},
		# Floor patches where each game has spilled over.
		"floor_dining": {"center": Vector3(-4.55, 0.0, -0.75), "ext": Vector2(0.4, 0.4), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_game": {"center": Vector3(1.65, 0.0, -2.55), "ext": Vector2(0.3, 0.35), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_card": {"center": Vector3(3.95, 0.0, -1.45), "ext": Vector2(0.45, 0.3), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_coffee": {"center": Vector3(3.0, 0.0, 1.95), "ext": Vector2(0.85, 0.3), "row_start": Vector3.ZERO, "rot": 0.0},
		"floor_bench": {"center": Vector3(-5.25, 0.0, -1.35), "ext": Vector2(0.4, 0.4), "row_start": Vector3.ZERO, "rot": 0.0},
	}
	for k in defs:
		var s: Dictionary = defs[k]
		s["name"] = k
		s["hmap"] = HMap.new(s.center, s.ext)
		spots[k] = s


# ---------------------------------------------------------------- the hobby nook

func _build_hobby_nook() -> void:
	var wood := MeshKit.mat(Color("5e3620"), 0.55)
	var dark := MeshKit.mat(Color("2a1a12"), 0.6)
	# The painting desk, with a cutting mat, a rack of paints and a bright task lamp.
	var desk := _solid(Vector3(1.6, 0.05, 0.75), Vector3(-4.6, 0.735, 5.8), wood)
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			_solid(Vector3(0.06, 0.71, 0.06), Vector3(-4.6 + sx * 0.72, 0.355, 5.8 + sz * 0.3), wood)
	_solid(Vector3(1.0, 0.004, 0.45), Vector3(-4.75, 0.762, 5.66), MeshKit.mat(Color("2f5a46"), 0.9), false)
	_solid(Vector3(1.5, 0.22, 0.12), Vector3(-4.6, 0.87, 6.1), dark)
	var pot_colors := [Color("c8323a"), Color("e8742a"), Color("f2c94e"), Color("4f9e3a"), Color("2a6fb5"), Color("6a3fa0"), Color("f2efe6"), Color("1d1d22"), Color("8a5a34"), Color("e05a9a"), Color("2fb8a8"), Color("e8b84a")]
	for row in 2:
		for i in 12:
			var x := -5.28 + i * 0.12
			world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.016, 0.016, 0.03, 10), MeshKit.mat(pot_colors[(i + row * 5) % pot_colors.size()], 0.4), Vector3(x, 0.996 - row * 0.1 + 0.015, 6.06 - row * 0.05)))
	var lamp := SpotLight3D.new()
	lamp.position = Vector3(-4.3, 1.45, 5.75)
	lamp.rotation = Vector3(-PI / 2 + 0.25, 0, 0)
	lamp.light_color = Color(1.0, 0.92, 0.8)
	lamp.light_energy = 4.5
	lamp.spot_range = 2.0
	lamp.spot_angle = 45.0
	lamp.shadow_enabled = true
	world.add_child(lamp)
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.012, 0.012, 0.6), MeshKit.mat(Color("2a2a2a"), 0.4), Vector3(-3.95, 1.07, 6.05)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.04, 0.08, 0.1, 16), MeshKit.mat(Color("2f5a46"), 0.4), Vector3(-4.2, 1.47, 5.85), Vector3(0.6, 0, 0.5)))
	var sign := Label3D.new()
	sign.text = "Hobby Desk"
	sign.font_size = 48
	sign.pixel_size = 0.0014
	sign.modulate = Color("f3b648")
	sign.outline_size = 10
	sign.outline_modulate = Color("3a1f0f")
	sign.position = Vector3(-4.6, 1.15, 6.17)
	sign.rotation.y = PI
	world.add_child(sign)
	# An oval felt poker table under a green banker's lamp.
	var poker := StaticBody3D.new()
	poker.collision_layer = Item.LAYER_WORLD
	var pcs := CollisionShape3D.new()
	pcs.shape = MeshKit._box_shape(Vector3(1.4, 0.05, 0.92))
	poker.add_child(pcs)
	var felt := MeshKit.mesh_node(MeshKit.cyl(0.7, 0.7, 0.05, 40), MeshKit.mat(Color("1f6b46"), 1.0))
	felt.scale = Vector3(1, 1, 0.68)
	poker.add_child(felt)
	var rail := MeshKit.mesh_node(MeshKit.torus(0.66, 0.76), MeshKit.mat(Color("3a1f12"), 0.4), Vector3(0, 0.02, 0))
	rail.scale = Vector3(1, 0.6, 0.68)
	poker.add_child(rail)
	poker.position = Vector3(-1.6, 0.735, 5.75)
	world.add_child(poker)
	_solid(Vector3(0.14, 0.71, 0.14), Vector3(-1.6, 0.355, 5.75), wood)
	_solid(Vector3(0.6, 0.04, 0.4), Vector3(-1.6, 0.02, 5.75), wood)
	_pendant(Vector3(-1.6, 0, 5.75), Color("2f6b4a"), 4.0)
	# A square card table with a playmat, for the card game.
	_table(Vector3(0.9, 0, 5.75), Vector3(0.95, 0.72, 0.9), wood)
	_solid(Vector3(0.85, 0.003, 0.8), Vector3(0.9, 0.7215, 5.75), MeshKit.mat(Color("1d2a4a"), 1.0), false)
	_pendant(Vector3(0.9, 0, 5.75), Color("6b1e4a"), 3.6)
	# A round curio table in black velvet for the crystals.
	var curio := StaticBody3D.new()
	curio.collision_layer = Item.LAYER_WORLD
	var ccs := CollisionShape3D.new()
	ccs.shape = MeshKit._cyl_shape(0.5, 0.04)
	curio.add_child(ccs)
	curio.add_child(MeshKit.mesh_node(MeshKit.cyl(0.5, 0.5, 0.04, 36), wood))
	curio.add_child(MeshKit.mesh_node(MeshKit.cyl(0.46, 0.46, 0.004, 36), MeshKit.mat(Color("16121c"), 1.0), Vector3(0, 0.021, 0)))
	curio.position = Vector3(3.3, 0.68, 5.75)
	world.add_child(curio)
	_solid(Vector3(0.1, 0.66, 0.1), Vector3(3.3, 0.33, 5.75), wood)
	_pendant(Vector3(3.3, 0, 5.75), Color("3a2a5a"), 3.0)
	# A chalk marble ring on a round mat, right on the floor.
	var mat_body := StaticBody3D.new()
	mat_body.collision_layer = Item.LAYER_WORLD
	var mcs := CollisionShape3D.new()
	mcs.shape = MeshKit._cyl_shape(0.62, 0.012)
	mat_body.add_child(mcs)
	mat_body.add_child(MeshKit.mesh_node(MeshKit.cyl(0.62, 0.62, 0.012, 40), MeshKit.mat(Color("3a3f4a"), 1.0)))
	var chalk := MeshKit.mesh_node(MeshKit.torus(0.5, 0.52), MeshKit.mat(Color("f2efe6"), 1.0), Vector3(0, 0.007, 0))
	chalk.scale = Vector3(1, 0.05, 1)
	mat_body.add_child(chalk)
	mat_body.position = Vector3(5.0, 0.006, 5.75)
	world.add_child(mat_body)
	_pendant(Vector3(5.0, 0, 5.75), Color("8a4a2a"), 2.6)
	# A little warm fill so the nook isn't a dark corner.
	for x in [-3.5, 0.0, 3.5]:
		_omni(Vector3(x, 2.4, 6.4), Color(1.0, 0.72, 0.45), 0.55, 4.0)


func _pendant(at: Vector3, shade: Color, energy: float) -> void:
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.006, 0.006, 0.9), MeshKit.mat(Color("222222")), at + Vector3(0, 2.6, 0)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.06, 0.24, 0.18, 24), MeshKit.mat(shade, 0.5), at + Vector3(0, 2.1, 0)))
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
	_start()
	await get_tree().create_timer(3.0).timeout
	var cards := 0
	for b in boxes:
		cards += b.units_needed
	print("pieces=", pieces.all.size(), " card piles/boards/rules=", items.size(), " boxes=", boxes.size(), " total units=", cards)
	print("big items below floor: ", items.filter(func(i: Item): return i.global_position.y < -0.5).size())
	for b in boxes:
		print("  %-34s %4d things  box %.2f x %.2f x %.2f m" % [b.game_name, b.units_needed, b.W, b.D, b.H])
	for s in slots:
		var h := 0.0
		for b in boxes:
			if b.line_id == s.line_id:
				h += b.H
		print("  shelf stack %-18s %.2f m (cubby 0.82)" % [s.game_name, h])
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
	await get_tree().create_timer(2.5).timeout
	print("finished=", finished, " mixups=", mixups)
	get_tree().quit()


func _shot(dir: String, name: String) -> void:
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
	_start()
	hud.toast("", 0.0)
	hud.get_child(0).hide()
	await _view(Vector3(-3.0, 0.05, -0.6), 0.0, -0.95)
	await _shot(dir, "cards_dining")
	await _view(Vector3(0.9, 0.05, 5.0), PI, -1.05)
	await _shot(dir, "cards_ccg")
	await _view(Vector3(-1.6, 0.05, 4.95), PI, -1.0)
	await _shot(dir, "cards_poker")
	await _view(Vector3(0.55, 0.05, 1.75), 0.0, -1.05)
	await _shot(dir, "cards_rpg")
	get_tree().quit()



## A labelled top-down plan of the room, for documentation.
func _render_map(dir: String) -> void:
	await get_tree().create_timer(3.0).timeout
	hud.visible = false
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 13.4
	cam.near = 0.05
	cam.far = 6.0
	# Just below the lamps, so the ceiling, beams and pendants don't hide the room.
	cam.position = Vector3(0, 1.98, 1.3)
	cam.rotation = Vector3(-PI / 2, 0, 0)
	add_child(cam)
	cam.current = true
	var font: Font = load("res://fonts/righteous-latin-400-normal.woff2")
	var tags := [
		["GAME SHELF", Vector3(0, 0, -4.25), 0.0], ["HOBBY SHELF", Vector3(5.2, 0, -3.1), PI / 2],
		["Plum Parlor\ndining table", Vector3(-3.0, 0, -1.5), 0.0], ["Mossy Crowns\non the rug", Vector3(-2.4, 0, 2.5), 0.0],
		["Starfall Atlas\ngame table", Vector3(0.4, 0, -2.3), 0.0], ["Lantern Harbor\ncard table", Vector3(3.6, 0, -2.6), 0.0],
		["Honeycomb Hustle\ncoffee table", Vector3(3.0, 0, 1.0), 0.0], ["Orchard Hollow\nwindow seat", Vector3(-5.2, 0, 0.5), 0.0],
		["Wyrmlight Tales\nround table", Vector3(0.55, 0, 0.75), 0.0], ["Dice Hoard\nottoman", Vector3(4.72, 0, 0.35), 0.0],
		["Velvet Card Room\npoker table", Vector3(-1.6, 0, 5.75), 0.0], ["Prismatic Legends\ncard table", Vector3(0.9, 0, 5.75), 0.0],
		["Crystal Caverns\ncurio", Vector3(3.3, 0, 5.75), 0.0], ["Marble Jar\nring", Vector3(5.0, 0, 5.75), 0.0],
		["Brushwork Hobby\nhobby desk", Vector3(-4.6, 0, 5.75), 0.0],
		["FIREPLACE", Vector3(5.75, 0, 0.2), PI / 2], ["COUCH", Vector3(3.0, 0, 3.0), 0.0], ["WINDOW", Vector3(-5.85, 0, 1.9), PI / 2],
		["★ START", Vector3(0.6, 0, 3.9), 0.0], ["HOBBY NOOK", Vector3(0.0, 0, 4.75), 0.0],
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
