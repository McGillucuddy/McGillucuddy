extends Node3D
## Builds the cozy game room, sets out six board games mid-play, and runs the tidy-up.

const PENTA := [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0]
const STRAY_CHANCE := 0.15
const PIECE_SCALE := 1.45

var player: Player
var hud: Hud
var sfx: Sfx
var world: Node3D
var boxes: Array[GameBox] = []
var items: Array[Item] = []
var slots: Array[ShelfSlot] = []
var spots: Array = []
var rng := RandomNumberGenerator.new()

var started := false
var finished := false
var paused := false
var mixups := 0
var combo := 0
var start_ms := 0
var _quiet_until := 0.0
var _hint_marker: Label3D
var _flicker: Array = []   # {light, base, speed, seed}
var _flames: Array = []    # {node, base, seed}
var _noise := FastNoiseLite.new()


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

	var games := GameData.GAMES.duplicate()
	games.shuffle()
	_build_shelf(games.duplicate())
	_define_spots()
	games.shuffle()
	_deal_games(games)
	_fit_shelf_ghosts()

	player = Player.new()
	add_child(player)
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
	_refresh_hud()
	hud.show_title(true)
	_quiet_until = Time.get_ticks_msec() / 1000.0 + 3.0

	var args := OS.get_cmdline_user_args()
	if "--autotest" in args:
		_autotest()
	elif "--shot" in args:
		_screenshots()


# ---------------------------------------------------------------- input

func _setup_input() -> void:
	var keys := {
		"move_forward": [KEY_W, KEY_UP], "move_back": [KEY_S, KEY_DOWN],
		"move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT],
		"sprint": [KEY_SHIFT], "crouch": [KEY_C, KEY_CTRL], "interact": [KEY_E],
		"throw": [KEY_Q], "hint": [KEY_H], "pause": [KEY_ESCAPE, KEY_P],
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
	hud.toast("Every piece has its own spot in its box.", 3.5)


func _set_paused(on: bool) -> void:
	paused = on
	get_tree().paused = on
	hud.show_pause(on)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if on else Input.MOUSE_MODE_CAPTURED


func _restart() -> void:
	get_tree().paused = false
	get_tree().reload_current_scene()


# ---------------------------------------------------------------- dealing out the games

func _deal_games(games: Array) -> void:
	var plans := []
	for i in games.size():
		var g: Dictionary = games[i]
		var spot: Dictionary = spots[i]
		var board := _make_board(g)
		var made: Array[Item] = [board, _make_rules(g), _make_cards(g, GameData.DECK_SIZE, false)]
		for h in GameData.HANDS:
			made.append(_make_cards(g, GameData.HAND_SIZE, true))
		var where := {}
		for p in g.parts:
			for n in p[1]:
				var it := _make_piece(g, p[0])
				made.append(it)
				where[it] = p[2]

		var box := GameBox.new()
		box.setup(g, made)
		box.needed = made.size()
		world.add_child(box)
		box.global_position = spot.box
		box.rotation.y = spot.box_rot
		boxes.append(box)
		box.progress_changed.connect(_on_box_progress)
		box.packed.connect(_on_box_packed)
		box.bounced.connect(_on_box_bounced)

		# The board goes down first so everything else can be laid out around it.
		world.add_child(board)
		board.global_position = spot.center + Vector3(0, 0.008, 0)
		board.rotation.y = spot.get("rot", 0.0) + rng.randf_range(-0.2, 0.2)
		board.home = spot
		spot["board_xf"] = board.global_transform
		spot["spaces"] = MeshKit.board_spaces()
		spot.spaces.shuffle()
		items.append(board)
		board.clacked.connect(_on_clack)
		plans.append([spot, made, where])

	for plan in plans:
		var spot: Dictionary = plan[0]
		var where: Dictionary = plan[2]
		var stack_at := {}
		for it: Item in plan[1]:
			if it.kind == "board":
				continue
			world.add_child(it)
			items.append(it)
			it.clacked.connect(_on_clack)
			var home: Dictionary = spot
			var stray := (it.kind == "piece" or (it.kind == "cards" and it.card_count < GameData.DECK_SIZE)) and rng.randf() < STRAY_CHANCE
			if stray:
				home = spots[rng.randi_range(0, spots.size() - 1)] if rng.randf() < 0.7 else _couch_spot()
			it.home = home
			var w: String = where.get(it, "supply")
			if stray:
				w = "supply"
			_set_out(it, home, w, stack_at)


## Puts an item where it would be mid-game: on a board space, in the supply, or in a pile.
func _set_out(it: Item, spot: Dictionary, w: String, stack_at: Dictionary) -> void:
	var board_xf: Transform3D = spot.get("board_xf", Transform3D(Basis(), Vector3(999, 0, 999)))
	match it.kind:
		"cards", "rules":
			var p := _free_point(spot, board_xf)
			it.global_position = p + Vector3(0, 0.02, 0)
			var to_center: Vector3 = spot.center - p
			it.rotation = Vector3(0, atan2(to_center.x, to_center.z) + rng.randf_range(-0.3, 0.3), 0)
			return
	if w == "board" and spot.has("spaces") and not spot.spaces.is_empty():
		var sp: Vector2 = spot.spaces.pop_back()
		it.global_position = board_xf * Vector3(sp.x, 0.07, sp.y)
		it.rotation = Vector3(0, rng.randf_range(0, TAU), 0)
		return
	if w == "stack":
		var key: String = it.piece_type + str(spot.center)
		var pile: Array = stack_at.get(key, [])
		if pile.is_empty() or pile[1] >= 3:
			pile = [_free_point(spot, board_xf), 0]
		it.global_position = pile[0] + Vector3(0, 0.03 + pile[1] * 0.025, 0)
		it.rotation = Vector3(rng.randf_range(-0.05, 0.05), rng.randf_range(0, TAU), rng.randf_range(-0.05, 0.05))
		pile[1] += 1
		stack_at[key] = pile
		return
	it.global_position = _free_point(spot, board_xf) + Vector3(0, rng.randf_range(0.05, 0.12), 0)
	it.rotation = Vector3(rng.randf_range(-0.4, 0.4), rng.randf_range(0, TAU), rng.randf_range(-0.4, 0.4))


func _free_point(spot: Dictionary, board_xf: Transform3D) -> Vector3:
	var c: Vector3 = spot.center
	var ext: Vector2 = spot.ext
	var inv := board_xf.affine_inverse()
	var p := c
	for t in 40:
		p = c + Vector3(rng.randf_range(-ext.x, ext.x), 0, rng.randf_range(-ext.y, ext.y))
		var l := inv * p
		if absf(l.x) > 0.29 or absf(l.z) > 0.29:
			return p
	return p


func _make_piece(g: Dictionary, type: String) -> Item:
	var it := Item.new()
	it.game_id = g.id
	it.kind = "piece"
	it.piece_type = type
	it.label = "%s %s" % [g.name, GameData.TYPE_NAMES[type]]
	_attach(it, MeshKit.piece(type, g.color), PIECE_SCALE)
	it.mass = 0.05
	return it


func _make_cards(g: Dictionary, n: int, fanned: bool) -> Item:
	var it := Item.new()
	it.game_id = g.id
	it.kind = "cards"
	it.card_count = n
	it.label = "%s %s" % [g.name, "hand of cards" if fanned else "card deck"]
	_attach(it, MeshKit.card_hand(g.color, n) if fanned else MeshKit.card_stack(g.color, n), PIECE_SCALE)
	it.mass = 0.04
	return it


func _make_rules(g: Dictionary) -> Item:
	var it := Item.new()
	it.game_id = g.id
	it.kind = "rules"
	it.label = "%s rulebook" % g.name
	_attach(it, MeshKit.rulebook(g.color, g.name), 1.0)
	it.mass = 0.15
	return it


func _make_board(g: Dictionary) -> Item:
	var it := Item.new()
	it.game_id = g.id
	it.kind = "board"
	it.label = "%s board" % g.name
	_attach(it, MeshKit.board(g.color, rng.randi()), 1.0)
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


func _on_player_acted(kind: String, data: Object) -> void:
	match kind:
		"pick":
			var it := data as Item
			sfx.at("tick", it.global_position, -4.0, 1.2)
			_clear_hint(it)
		"wrong_box":
			var b := data as GameBox
			mixups += 1
			combo = 0
			sfx.at("low", b.global_position, -2.0)
			hud.toast("That doesn't belong to %s." % b.game_name, 2.2)
		"pieces_first":
			sfx.ui("tick", -6.0, 0.8)
			hud.toast("Pieces and cards go in first. The board folds in on top.", 2.6)
		"board_first":
			sfx.ui("tick", -6.0, 0.8)
			hud.toast("The rulebook goes in last, on top of the board.", 2.6)
		"wrong_slot":
			var s := data as ShelfSlot
			sfx.ui("low", -4.0)
			hud.toast("This spot is saved for %s." % s.game_name, 2.2)


func _on_box_progress(box: GameBox, item: Item, group_done: bool) -> void:
	sfx.at("clack", box.global_position + Vector3.UP * 0.1, -2.0, 0.9)
	sfx.note(PENTA[mini(combo, PENTA.size() - 1)], -10.0, 0.1)
	combo += 1
	if group_done and box.count < box.needed:
		sfx.chord([PENTA[4], PENTA[7]], 0.07, -12.0, 0.3)
	_clear_hint(item)
	_refresh_hud()


func _on_box_packed(box: GameBox) -> void:
	sfx.at("thunk", box.global_position, 2.0)
	sfx.chord([PENTA[0], PENTA[2], PENTA[4], PENTA[5]], 0.08, -9.0, 0.05)
	hud.toast("%s is packed. Take it to the shelf." % box.game_name, 3.0)
	_refresh_hud()


func _on_box_bounced(box: GameBox, _item: Item, reason: String) -> void:
	if reason == "wrong_game":
		_on_player_acted("wrong_box", box)
	else:
		_on_player_acted(reason, box)


func _on_shelved(slot: ShelfSlot, box: GameBox) -> void:
	sfx.at("thunk", slot.anchor, 0.0, 1.25)
	sfx.chord([PENTA[2], PENTA[4], PENTA[5], PENTA[7]], 0.07, -9.0, 0.25)
	_refresh_hud()
	if boxes.all(func(b: GameBox): return b.shelved):
		get_tree().create_timer(1.4).timeout.connect(_finish)
	else:
		var left := boxes.filter(func(b: GameBox): return not b.shelved).size()
		hud.toast("%s is home. %d to go." % [box.game_name, left], 2.5)


func _finish() -> void:
	if finished:
		return
	finished = true
	player.enabled = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	sfx.chord([PENTA[0], PENTA[2], PENTA[4], PENTA[5], PENTA[7], PENTA[9]], 0.11, -8.0)
	var secs := (Time.get_ticks_msec() - start_ms) / 1000
	hud.show_end("%d things put away   ·   %d:%02d   ·   %d mix-ups" % [items.size(), secs / 60, secs % 60, mixups])


func _on_clack(it: Item, strength: float) -> void:
	if Time.get_ticks_msec() / 1000.0 < _quiet_until:
		return
	sfx.at("clack", it.global_position, linear_to_db(strength) - 2.0, 1.0 + (1.0 - strength) * 0.4)


func _refresh_hud() -> void:
	var rows := []
	for b in boxes:
		var status := "%d / %d" % [b.count, b.needed]
		if b.shelved:
			status = "on the shelf"
		elif b.complete:
			status = "packed · to the shelf"
		rows.append({"name": b.game_name, "color": b.color, "status": status, "done": b.shelved})
	hud.set_games(rows)


func _hint() -> void:
	var loose := items.filter(func(i: Item): return not i.stored and not i.held)
	# Point at something that can actually go in next.
	var ready := loose.filter(func(i: Item):
		for b in boxes:
			if b.game_id == i.game_id:
				return b.check(i) == ""
		return false)
	var target: Node3D = null
	var msg := ""
	if not ready.is_empty():
		var it: Item = ready[rng.randi_range(0, ready.size() - 1)]
		target = it
		msg = "Look for the arrow over the %s." % it.label
	else:
		var packed := boxes.filter(func(b: GameBox): return b.can_pick())
		if packed.is_empty():
			return
		target = packed[0]
		msg = "The %s box is ready for the shelf." % (packed[0] as GameBox).game_name
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
	_hint_marker.set_meta("target", target)
	_hint_marker.show()
	sfx.chord([PENTA[4], PENTA[6]], 0.1, -12.0)
	hud.toast(msg, 3.0)


func _clear_hint(it: Object) -> void:
	if _hint_marker and _hint_marker.get_meta("target", null) == it:
		_hint_marker.hide()


func _process(_dt: float) -> void:
	var t := Time.get_ticks_msec() / 1000.0
	for f in _flicker:
		var n := _noise.get_noise_1d(t * f.speed + f.seed)
		f.light.light_energy = f.base * (0.86 + 0.22 * n + 0.04 * sin(t * 17.0 + f.seed))
	for f in _flames:
		var n := _noise.get_noise_1d(t * 3.0 + f.seed)
		f.node.scale = Vector3(1.0 - n * 0.15, f.base * (1.0 + n * 0.35), 1.0 - n * 0.15)
	if _hint_marker and _hint_marker.visible:
		var tg: Node3D = _hint_marker.get_meta("target")
		if not is_instance_valid(tg) or (tg is Item and (tg as Item).stored) or (tg is GameBox and (tg as GameBox).shelved):
			_hint_marker.hide()
		else:
			var bob := sin(t * 6.0) * 0.03
			_hint_marker.global_position = tg.global_position + Vector3(0, 0.22 + bob, 0)


func _physics_process(_dt: float) -> void:
	# Anything that escapes the room comes back to where it started.
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


func _solid(size: Vector3, pos: Vector3, m: Material, collide := true, rot_y := 0.0) -> Node3D:
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
	world.add_child(node)
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
	_solid(Vector3(12.4, 0.2, 10.4), Vector3(0, -0.1, 0), floor_m)
	_solid(Vector3(12.4, 0.2, 10.4), Vector3(0, 3.1, 0), ceil_m)
	_solid(Vector3(12.4, 3.2, 0.2), Vector3(0, 1.5, -5.1), wall_m)
	_solid(Vector3(12.4, 3.2, 0.2), Vector3(0, 1.5, 5.1), wall_m)
	_solid(Vector3(0.2, 3.2, 10.4), Vector3(-6.1, 1.5, 0), wall_m)
	_solid(Vector3(0.2, 3.2, 10.4), Vector3(6.1, 1.5, 0), wall_m)
	# Painted wainscoting with a wooden rail, all the way round.
	for z in [-4.985, 4.985]:
		_solid(Vector3(12.0, 0.95, 0.03), Vector3(0, 0.475, z), wainscot, false)
		_solid(Vector3(12.0, 0.05, 0.06), Vector3(0, 0.95, z), trim, false)
		_solid(Vector3(12.0, 0.14, 0.05), Vector3(0, 0.07, z), trim, false)
	for x in [-5.985, 5.985]:
		_solid(Vector3(0.03, 0.95, 10.0), Vector3(x, 0.475, 0), wainscot, false)
		_solid(Vector3(0.06, 0.05, 10.0), Vector3(x, 0.95, 0), trim, false)
		_solid(Vector3(0.05, 0.14, 10.0), Vector3(x, 0.07, 0), trim, false)
	for x in [-4.0, -1.3, 1.3, 4.0]:
		_solid(Vector3(0.22, 0.2, 10.0), Vector3(x, 2.9, 0), trim, false)

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
	_floor_lamp(Vector3(4.55, 0, 3.6), Color("ffd9a0"), 1.5, true)
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

	for p in [Vector3(-5.4, 0, -4.5), Vector3(5.4, 0, -4.4), Vector3(5.5, 0, 4.5)]:
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


func _build_shelf(order: Array) -> void:
	var wood := MeshKit.mat(Color("5e3620"), 0.6)
	var back := MeshKit.mat(Color("3a2216"), 0.8)
	var cols := 3
	var cw := 0.9
	var ch := 0.62
	var bt := 0.05
	var depth := 0.5
	var z := -4.75
	var width := cols * cw + (cols + 1) * bt
	var floors := [0.12]
	floors.append(floors[0] + ch + bt)
	var top_y: float = floors[1] + ch + bt
	_solid(Vector3(width, top_y + 0.05, 0.03), Vector3(0, (top_y + 0.05) / 2, z - depth / 2 + 0.015), back)
	for i in cols + 1:
		var x := -width / 2 + bt / 2 + i * (cw + bt)
		_solid(Vector3(bt, top_y + 0.05, depth), Vector3(x, (top_y + 0.05) / 2, z), wood)
	for y in [floors[0] - bt / 2, floors[1] - bt / 2, top_y - bt / 2 + 0.05]:
		_solid(Vector3(width, bt, depth), Vector3(0, y, z), wood)
	_solid(Vector3(width, 0.1, 0.03), Vector3(0, 0.05, z + depth / 2 - 0.015), wood, false)

	for r in 2:
		for c in cols:
			var g: Dictionary = order[r * cols + c]
			var cx := -width / 2 + bt + cw / 2 + c * (cw + bt)
			var fy: float = floors[r]
			var slot := ShelfSlot.new()
			slot.game_id = g.id
			slot.game_name = g.name
			slot.collision_layer = Item.LAYER_SLOTS
			slot.collision_mask = 0
			var cs := CollisionShape3D.new()
			var bs := BoxShape3D.new()
			bs.size = Vector3(cw - 0.02, ch - 0.02, depth - 0.05)
			cs.shape = bs
			slot.add_child(cs)
			slot.position = Vector3(cx, fy + ch / 2, z + 0.02)
			world.add_child(slot)
			slot.anchor = Vector3(cx, fy + 0.001, z + 0.02)
			slot.shelved.connect(_on_shelved)
			slots.append(slot)
			var gm := StandardMaterial3D.new()
			gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			gm.albedo_color = Color(g.color, 0.2)
			var ghost := MeshKit.mesh_node(MeshKit.box(Vector3(0.6, 0.12, 0.4)), gm, Vector3(cx, fy + 0.06, z + 0.02))
			world.add_child(ghost)
			slot.ghost = ghost
			var plate := MeshKit.mesh_node(MeshKit.box(Vector3(0.62, 0.046, 0.006)), MeshKit.mat(g.color, 0.6), Vector3(cx, fy - bt / 2, z + depth / 2 + 0.004))
			world.add_child(plate)
			var lbl := Label3D.new()
			lbl.text = g.name
			lbl.font_size = 40
			lbl.pixel_size = 0.0009
			lbl.outline_size = 6
			lbl.outline_modulate = Color(g.color).darkened(0.6)
			lbl.position = Vector3(cx, fy - bt / 2, z + depth / 2 + 0.009)
			world.add_child(lbl)

	var bx := -width / 2 + 0.15
	for i in 7:
		var h := rng.randf_range(0.2, 0.3)
		var c: Color = [Color("c8473b"), Color("2e8c9a"), Color("e09a1f"), Color("5a8d39"), Color("8c4a86")][i % 5]
		world.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.05, h, 0.2)), MeshKit.mat(c.darkened(0.2), 0.8), Vector3(bx, top_y + 0.05 + h / 2, z)))
		bx += 0.06
	_plant(Vector3(width / 2 - 0.25, top_y + 0.05, z))
	var title := Label3D.new()
	title.text = "Game Shelf"
	title.font_size = 64
	title.pixel_size = 0.0018
	title.modulate = Color("f3b648")
	title.outline_size = 12
	title.outline_modulate = Color("3a1f0f")
	title.position = Vector3(0.1, top_y + 0.24, z + 0.05)
	world.add_child(title)


func _fit_shelf_ghosts() -> void:
	for s in slots:
		for b in boxes:
			if b.game_id == s.game_id:
				(s.ghost as MeshInstance3D).mesh = MeshKit.box(Vector3(b.W, GameBox.H, b.D))
				s.ghost.position.y = s.anchor.y + GameBox.H / 2


func _define_spots() -> void:
	# center = point on the surface, ext = how far the game spreads, box = where its open box waits.
	spots = [
		{"center": Vector3(-3.47, 0.76, -1.5), "ext": Vector2(0.42, 0.45), "box": Vector3(-3.65, 0.0, -0.42), "box_rot": 0.12},
		{"center": Vector3(-2.53, 0.76, -1.5), "ext": Vector2(0.42, 0.45), "box": Vector3(-2.3, 0.0, -0.42), "box_rot": -0.1},
		{"center": Vector3(3.0, 0.44, 1.0), "ext": Vector2(0.56, 0.3), "box": Vector3(1.8, 0.0, 1.2), "box_rot": 1.45},
		{"center": Vector3(-2.4, 0.022, 2.5), "ext": Vector2(0.95, 0.9), "box": Vector3(-0.75, 0.0, 1.45), "box_rot": 0.6},
		{"center": Vector3(3.6, 0.74, -2.6), "ext": Vector2(0.45, 0.45), "box": Vector3(2.4, 0.0, -2.0), "box_rot": 1.25},
		{"center": Vector3(-5.65, 0.5, 0.5), "ext": Vector2(0.26, 0.95), "box": Vector3(-4.65, 0.0, 1.75), "box_rot": -1.3, "rot": 0.0},
	]


func _couch_spot() -> Dictionary:
	return {"center": Vector3(3.0, 0.46, 2.9), "ext": Vector2(0.8, 0.22)}


# ---------------------------------------------------------------- testing hooks

func _pack_order(b: GameBox) -> Array:
	var mine := items.filter(func(i: Item): return i.game_id == b.game_id and not i.stored)
	var rank := {"piece": 0, "cards": 0, "board": 1, "rules": 2}
	mine.sort_custom(func(a: Item, c: Item): return rank[a.kind] < rank[c.kind])
	return mine


func _autotest() -> void:
	_start()
	await get_tree().create_timer(3.0).timeout
	print("items=", items.size(), " boxes=", boxes.size(), " slots=", slots.size())
	print("items below floor after settle: ", items.filter(func(i: Item): return i.global_position.y < -0.5).size())
	for b in boxes:
		print("  %s: %d things, box %.2f x %.2f m, %d piece spots" % [b.game_name, b.needed, b.W, b.D, b.spots.size()])
	var b0 := boxes[0]
	var wrong: Item = items.filter(func(i: Item): return i.game_id != b0.game_id)[0]
	var board0: Item = items.filter(func(i: Item): return i.game_id == b0.game_id and i.kind == "board")[0]
	var rules0: Item = items.filter(func(i: Item): return i.game_id == b0.game_id and i.kind == "rules")[0]
	print("wrong game -> ", b0.try_accept(wrong), " | board too early -> ", b0.try_accept(board0), " | rules too early -> ", b0.try_accept(rules0))
	for b in boxes:
		for it in _pack_order(b):
			var why := b.try_accept(it)
			if why != "":
				print("  REFUSED ", it.label, ": ", why)
	await get_tree().create_timer(2.2).timeout
	for b in boxes:
		var wrong_slot: ShelfSlot = slots.filter(func(s: ShelfSlot): return s.game_id != b.game_id)[0]
		var right_slot: ShelfSlot = slots.filter(func(s: ShelfSlot): return s.game_id == b.game_id)[0]
		print("%s %d/%d packed=%s wrong_slot=%s right_slot=%s" % [b.game_name, b.count, b.needed, b.lid_closed, wrong_slot.place(b), right_slot.place(b)])
	await get_tree().create_timer(2.5).timeout
	print("finished=", finished, " mixups=", mixups)
	get_tree().quit()


func _shot(dir: String, name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, name])


func _screenshots() -> void:
	var args := OS.get_cmdline_user_args()
	var dir := args[args.find("--shot") + 1]
	await get_tree().create_timer(3.0).timeout
	await _shot(dir, "title")
	_start()
	hud.toast("", 0.0)
	var views := [
		[Vector3(0.6, 0.05, 3.9), 0.05, -0.12, "room"],
		[Vector3(-3.0, 0.05, -0.15), 0.0, -0.62, "dining"],
		[Vector3(2.2, 0.05, 2.3), -1.1, -0.3, "fireplace"],
		[Vector3(-2.4, 0.05, 4.2), 0.0, -0.75, "rug"],
		[Vector3(0.0, 0.05, -2.6), 0.0, -0.2, "shelf"],
	]
	for v in views:
		player.global_position = v[0]
		player.look_at_yaw(v[1], v[2])
		await get_tree().create_timer(0.8).timeout
		await _shot(dir, v[3])
	# Half-fill a box to show the insert, then finish it.
	var b := boxes[0]
	var order := _pack_order(b)
	for i in order.size() / 2:
		b.try_accept(order[i])
	await get_tree().create_timer(1.2).timeout
	var fwd := b.global_transform.basis.z
	player.global_position = b.global_position + fwd * 0.55 - Vector3(0, 0, 0)
	player.look_at_yaw(atan2(fwd.x, fwd.z), -1.25)
	await get_tree().create_timer(0.5).timeout
	await _shot(dir, "insert")
	for it in _pack_order(b):
		b.try_accept(it)
	await get_tree().create_timer(0.8).timeout
	await _shot(dir, "board_in")
	await get_tree().create_timer(1.5).timeout
	await _shot(dir, "packed")
	get_tree().quit()
