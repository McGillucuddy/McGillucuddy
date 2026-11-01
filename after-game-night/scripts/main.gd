extends Node3D
## Builds the cozy game room, deals out six messy board games, and runs the tidy-up.

const PENTA := [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0]
const TYPES_PER_GAME := 3
const PIECES_PER_TYPE := 3
const STRAY_CHANCE := 0.2
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


func _ready() -> void:
	rng.randomize()
	_setup_input()
	world = Node3D.new()
	world.name = "World"
	add_child(world)
	sfx = Sfx.new()
	add_child(sfx)
	_build_environment()
	_build_room()
	_build_furniture()
	_build_decor()

	var games := GameData.GAMES.duplicate()
	games.shuffle()
	_build_shelf(games.duplicate())
	_define_spots()
	games.shuffle()
	for i in games.size():
		_spawn_game(games[i], spots[i])

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
	_quiet_until = Time.get_ticks_msec() / 1000.0 + 2.5

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
	hud.toast("Start anywhere. Every piece has a home.", 3.5)


func _set_paused(on: bool) -> void:
	paused = on
	get_tree().paused = on
	hud.show_pause(on)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if on else Input.MOUSE_MODE_CAPTURED


func _restart() -> void:
	get_tree().paused = false
	get_tree().reload_current_scene()


# ---------------------------------------------------------------- game flow

func _spawn_game(g: Dictionary, spot: Dictionary) -> void:
	var box := GameBox.new()
	box.setup(g)
	world.add_child(box)
	box.global_position = spot.box
	box.rotation.y = spot.box_rot
	boxes.append(box)
	box.progress_changed.connect(_on_box_progress)
	box.packed.connect(_on_box_packed)
	box.bounced.connect(_on_box_bounced)

	var made: Array[Item] = [_make_board(g)]
	var types := GameData.TYPES.duplicate()
	types.shuffle()
	for t in types.slice(0, TYPES_PER_GAME):
		for i in PIECES_PER_TYPE:
			made.append(_make_piece(g, t))
	box.needed = made.size()

	for it in made:
		var where: Dictionary = spot
		if it.kind == "piece" and rng.randf() < STRAY_CHANCE:
			where = spots[rng.randi_range(0, spots.size() - 1)] if rng.randf() < 0.75 else _couch_spot()
		it.home = where
		world.add_child(it)
		_drop_at(it, where, it.kind == "board")
		it.clacked.connect(_on_clack)
		items.append(it)


func _make_piece(g: Dictionary, type: String) -> Item:
	var it := Item.new()
	it.game_id = g.id
	it.kind = "piece"
	it.piece_type = type
	it.label = "%s %s" % [g.name, GameData.TYPE_NAMES[type]]
	var parts := MeshKit.piece(type, g.color)
	it.visual = parts[0]
	it.visual.scale = Vector3.ONE * PIECE_SCALE
	it.base_scale = PIECE_SCALE
	it.add_child(it.visual)
	var cs := CollisionShape3D.new()
	cs.shape = MeshKit.scaled_shape(parts[1], PIECE_SCALE)
	cs.position = parts[2] * PIECE_SCALE
	it.add_child(cs)
	it.rest_rotation = parts[3]
	it.mass = 0.05
	return it


func _make_board(g: Dictionary) -> Item:
	var it := Item.new()
	it.game_id = g.id
	it.kind = "board"
	it.label = "%s board" % g.name
	it.visual = Node3D.new()
	it.add_child(it.visual)
	var s := 0.5
	it.visual.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(s, 0.012, s)), MeshKit.mat(g.color.darkened(0.25), 0.7)))
	var top := StandardMaterial3D.new()
	top.albedo_texture = MeshKit.board_texture(g.color, rng.randi())
	top.roughness = 0.75
	top.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	var plane := PlaneMesh.new()
	plane.size = Vector2(s - 0.012, s - 0.012)
	it.visual.add_child(MeshKit.mesh_node(plane, top, Vector3(0, 0.0065, 0)))
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(s, 0.012, s)
	cs.shape = bs
	it.add_child(cs)
	it.mass = 0.3
	return it


func _drop_at(it: Item, spot: Dictionary, centered: bool) -> void:
	var c: Vector3 = spot.center
	var ext: Vector2 = spot.ext
	if centered:
		it.global_position = c + Vector3(0, 0.012, 0)
		it.rotation.y = spot.get("rot", 0.0) + rng.randf_range(-0.25, 0.25)
		return
	it.global_position = c + Vector3(rng.randf_range(-ext.x, ext.x), rng.randf_range(0.06, 0.3), rng.randf_range(-ext.y, ext.y))
	it.rotation = Vector3(rng.randf_range(-0.6, 0.6), rng.randf_range(0, TAU), rng.randf_range(-0.6, 0.6))


func _on_prompt(text: String) -> void:
	hud.set_prompt(text)


func _on_player_acted(kind: String, data: Object) -> void:
	match kind:
		"pick":
			var it := data as Item
			sfx.at("tick", it.global_position, -4.0, 1.2)
			_clear_hint(it)
		"drop":
			pass
		"wrong_box":
			var b := data as GameBox
			mixups += 1
			combo = 0
			sfx.at("low", b.global_position, -2.0)
			hud.toast("That doesn't belong to %s." % b.game_name, 2.2)
		"wrong_slot":
			var s := data as ShelfSlot
			sfx.ui("low", -4.0)
			hud.toast("This spot is saved for %s." % s.game_name, 2.2)


func _on_box_progress(box: GameBox, item: Item) -> void:
	sfx.at("clack", box.global_position + Vector3.UP * 0.1, -2.0, 0.9)
	sfx.note(PENTA[mini(combo, PENTA.size() - 1)], -10.0, 0.08)
	combo += 1
	_clear_hint(item)
	_refresh_hud()


func _on_box_packed(box: GameBox) -> void:
	sfx.at("thunk", box.global_position, 2.0)
	sfx.chord([PENTA[0], PENTA[2], PENTA[4], PENTA[5]], 0.08, -9.0, 0.05)
	hud.toast("%s is packed. Take it to the shelf." % box.game_name, 3.0)
	_refresh_hud()


func _on_box_bounced(box: GameBox, _item: Item) -> void:
	mixups += 1
	combo = 0
	sfx.at("low", box.global_position, -4.0)
	hud.toast("That doesn't belong to %s." % box.game_name, 2.2)


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
	hud.show_end("%d pieces sorted   ·   %d:%02d   ·   %d mix-ups" % [items.size(), secs / 60, secs % 60, mixups])


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
	var target: Node3D = null
	var msg := ""
	if loose.is_empty():
		var packed := boxes.filter(func(b: GameBox): return b.can_pick())
		if packed.is_empty():
			return
		target = packed[0]
		msg = "The %s box is ready for the shelf." % (packed[0] as GameBox).game_name
	else:
		var it: Item = loose[rng.randi_range(0, loose.size() - 1)]
		target = it
		msg = "Look for the arrow over a %s." % it.label
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
	if _hint_marker and _hint_marker.visible:
		var t: Node3D = _hint_marker.get_meta("target")
		if not is_instance_valid(t) or (t is Item and (t as Item).stored) or (t is GameBox and (t as GameBox).shelved):
			_hint_marker.hide()
		else:
			var bob := sin(Time.get_ticks_msec() / 160.0) * 0.03
			_hint_marker.global_position = t.global_position + Vector3(0, 0.22 + bob, 0)


func _physics_process(_dt: float) -> void:
	# Anything that escapes the room comes back to where it started.
	for it in items:
		if not it.stored and not it.held and it.global_position.y < -1.0:
			it.linear_velocity = Vector3.ZERO
			_drop_at(it, it.home, false)
	for b in boxes:
		if not b.shelved and not b.held and b.global_position.y < -1.0:
			b.linear_velocity = Vector3.ZERO
			b.global_position = Vector3(0, 0.5, 1.5)


# ---------------------------------------------------------------- world building

func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.04, 0.03, 0.05)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(1.0, 0.78, 0.62)
	env.ambient_light_energy = 0.22
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 0.9
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.06
	env.glow_hdr_threshold = 1.1
	env.ssao_enabled = true
	env.ssao_radius = 0.6
	env.ssao_intensity = 1.6
	env.adjustment_enabled = true
	env.adjustment_saturation = 0.95
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


func _omni(pos: Vector3, color: Color, energy: float, rng_m: float, shadow := false) -> OmniLight3D:
	var l := OmniLight3D.new()
	l.position = pos
	l.light_color = color
	l.light_energy = energy
	l.omni_range = rng_m
	l.omni_attenuation = 1.2
	l.shadow_enabled = shadow
	l.shadow_bias = 0.03
	world.add_child(l)
	return l


func _build_room() -> void:
	var floor_m := MeshKit.tex_mat(MeshKit.plank_texture(Color("9a6038")), 0.45, 0.62)
	var wall_m := MeshKit.tex_mat(MeshKit.stripe_texture(Color("b89a80"), Color("a9876c")), 0.9, 0.95)
	var ceil_m := MeshKit.mat(Color("e9d7bf"), 0.95)
	var trim := MeshKit.mat(Color("5c3520"), 0.6)
	_solid(Vector3(12.4, 0.2, 10.4), Vector3(0, -0.1, 0), floor_m)
	_solid(Vector3(12.4, 0.2, 10.4), Vector3(0, 3.1, 0), ceil_m)
	_solid(Vector3(12.4, 3.2, 0.2), Vector3(0, 1.5, -5.1), wall_m)
	_solid(Vector3(12.4, 3.2, 0.2), Vector3(0, 1.5, 5.1), wall_m)
	_solid(Vector3(0.2, 3.2, 10.4), Vector3(-6.1, 1.5, 0), wall_m)
	_solid(Vector3(0.2, 3.2, 10.4), Vector3(6.1, 1.5, 0), wall_m)
	# Baseboards and ceiling beams.
	for z in [-4.99, 4.99]:
		_solid(Vector3(12.0, 0.14, 0.03), Vector3(0, 0.07, z), trim, false)
	for x in [-5.99, 5.99]:
		_solid(Vector3(0.03, 0.14, 10.0), Vector3(x, 0.07, 0), trim, false)
	for x in [-4.0, -1.3, 1.3, 4.0]:
		_solid(Vector3(0.22, 0.2, 10.0), Vector3(x, 2.9, 0), trim, false)

	# Night window on the left wall with a soft moonbeam.
	var glass := MeshKit.mat(Color("1d2b52"), 0.2, 0.9)
	_solid(Vector3(0.04, 1.3, 1.7), Vector3(-5.99, 1.65, 0.5), glass, false)
	var frame := MeshKit.mat(Color("f0e2cc"), 0.6)
	for y in [1.0, 1.65, 2.3]:
		_solid(Vector3(0.08, 0.07, 1.8), Vector3(-5.96, y, 0.5), frame, false)
	for z in [-0.37, 0.5, 1.37]:
		_solid(Vector3(0.08, 1.37, 0.07), Vector3(-5.96, 1.65, z), frame, false)
	var star := MeshKit.mat(Color("fff6d8"), 0.5, 3.0)
	for i in 14:
		var s := MeshKit.mesh_node(MeshKit.sphere(0.006 + rng.randf() * 0.006, 6), star,
			Vector3(-5.965, rng.randf_range(1.05, 2.25), rng.randf_range(-0.3, 1.3)))
		world.add_child(s)
	var moon := MeshKit.mesh_node(MeshKit.sphere(0.09, 16), MeshKit.mat(Color("fdf3d6"), 0.5, 2.2), Vector3(-5.97, 2.05, 1.05))
	moon.scale = Vector3(0.2, 1, 1)
	world.add_child(moon)
	var beam := SpotLight3D.new()
	beam.light_color = Color(0.6, 0.7, 1.0)
	beam.light_energy = 1.4
	beam.spot_range = 7.0
	beam.spot_angle = 35.0
	beam.position = Vector3(-5.8, 2.4, 0.5)
	beam.rotation = Vector3(deg_to_rad(-38), deg_to_rad(-90), 0)
	beam.shadow_enabled = true
	world.add_child(beam)

	# Main warm lights.
	_omni(Vector3(-3.0, 2.25, -1.5), Color(1.0, 0.72, 0.45), 2.4, 6.5, true)
	_omni(Vector3(1.2, 2.6, 0.8), Color(1.0, 0.78, 0.55), 0.7, 9.0)


func _table(center: Vector3, size: Vector3, wood: Material) -> void:
	# size.y is the top surface height.
	var top_t := 0.05
	_solid(Vector3(size.x, top_t, size.z), center + Vector3(0, size.y - top_t / 2, 0), wood)
	var lx := size.x / 2 - 0.08
	var lz := size.z / 2 - 0.08
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			_solid(Vector3(0.06, size.y - top_t, 0.06), center + Vector3(sx * lx, (size.y - top_t) / 2, sz * lz), wood)


func _build_furniture() -> void:
	var wood := MeshKit.mat(Color("7a4a2a"), 0.55)
	var light_wood := MeshKit.mat(Color("b07a4c"), 0.6)
	_table(Vector3(-3.0, 0, -1.5), Vector3(1.9, 0.76, 1.0), wood)
	_table(Vector3(3.0, 0, 1.0), Vector3(1.2, 0.44, 0.66), light_wood)
	_table(Vector3(3.6, 0, -2.6), Vector3(1.0, 0.74, 1.0), MeshKit.mat(Color("2f5a46"), 0.8))
	# Card table felt edge.
	_solid(Vector3(1.04, 0.03, 1.04), Vector3(3.6, 0.725, -2.6), wood, false)

	# Chairs around the dining table.
	for p in [[Vector3(-3.5, 0, -2.3), 0.0], [Vector3(-2.5, 0, -2.3), 0.0], [Vector3(-4.25, 0, -1.5), PI / 2]]:
		_chair(p[0], p[1], wood)

	# Window seat with cushion.
	_solid(Vector3(0.7, 0.42, 2.2), Vector3(-5.65, 0.21, 0.5), MeshKit.mat(Color("eadbc4"), 0.8))
	_solid(Vector3(0.66, 0.08, 2.14), Vector3(-5.65, 0.46, 0.5), MeshKit.mat(Color("6f8f86"), 0.95))

	# Couch.
	var fabric := MeshKit.mat(Color("a5543f"), 0.95)
	var fabric2 := MeshKit.mat(Color("b86650"), 0.95)
	_solid(Vector3(2.3, 0.3, 0.95), Vector3(3.0, 0.15, 3.0), fabric)
	_solid(Vector3(2.3, 0.65, 0.25), Vector3(3.0, 0.62, 3.42), fabric)
	for sx in [-1, 1]:
		_solid(Vector3(0.22, 0.55, 0.95), Vector3(3.0 + sx * 1.15, 0.37, 3.0), fabric)
	for sx in [-0.5, 0.5]:
		_solid(Vector3(1.0, 0.14, 0.78), Vector3(3.0 + sx * 1.02, 0.37, 2.95), fabric2)
	var pillow := MeshKit.mesh_node(MeshKit.box(Vector3(0.4, 0.38, 0.14)), MeshKit.mat(Color("e8b04a"), 0.95), Vector3(2.2, 0.66, 3.22), Vector3(-0.25, 0.3, 0.1))
	world.add_child(pillow)

	# Round rug under the floor game.
	var rug := StaticBody3D.new()
	rug.collision_layer = Item.LAYER_WORLD
	var rcs := CollisionShape3D.new()
	var rshape := CylinderShape3D.new()
	rshape.radius = 1.45
	rshape.height = 0.02
	rcs.shape = rshape
	rug.add_child(rcs)
	rug.add_child(MeshKit.mesh_node(MeshKit.cyl(1.45, 1.45, 0.02, 48), MeshKit.mat(Color("7b3b5c"), 1.0)))
	rug.add_child(MeshKit.mesh_node(MeshKit.cyl(1.25, 1.25, 0.022, 48), MeshKit.mat(Color("d9a441"), 1.0)))
	rug.add_child(MeshKit.mesh_node(MeshKit.cyl(1.17, 1.17, 0.024, 48), MeshKit.mat(Color("8a4467"), 1.0)))
	rug.position = Vector3(-2.4, 0.01, 2.5)
	world.add_child(rug)
	# Rectangular rug under the couch area.
	_solid(Vector3(3.2, 0.012, 2.4), Vector3(3.0, 0.006, 1.9), MeshKit.mat(Color("3f5d6e"), 1.0), false)


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
	root.add_child(seat)


func _build_decor() -> void:
	# Floor lamp by the couch.
	var brass := MeshKit.mat(Color("b08d4a"), 0.35)
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.16, 0.18, 0.03), brass, Vector3(4.55, 0.015, 3.5)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.015, 0.015, 1.5), brass, Vector3(4.55, 0.78, 3.5)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.17, 0.27, 0.3, 24), MeshKit.mat(Color("ffd9a0"), 0.9, 1.6), Vector3(4.55, 1.62, 3.5)))
	_omni(Vector3(4.55, 1.55, 3.5), Color(1.0, 0.7, 0.42), 1.6, 5.0, true)

	# Pendant over the dining table.
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.006, 0.006, 0.55), MeshKit.mat(Color("222222")), Vector3(-3.0, 2.75, -1.5)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.08, 0.32, 0.22, 28), MeshKit.mat(Color("2f5a46"), 0.5), Vector3(-3.0, 2.38, -1.5)))
	world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.07), MeshKit.mat(Color("ffe2b0"), 0.5, 4.0), Vector3(-3.0, 2.28, -1.5)))

	# Little lamp on the card table corner? Keep it clear; put a lamp on the window seat end instead.
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.07, 0.09, 0.22), MeshKit.mat(Color("6f8f86"), 0.5), Vector3(-5.65, 0.61, -0.45)))
	world.add_child(MeshKit.mesh_node(MeshKit.cyl(0.1, 0.16, 0.18), MeshKit.mat(Color("fff0d0"), 0.9, 1.4), Vector3(-5.65, 0.8, -0.45)))
	_omni(Vector3(-5.6, 0.85, -0.45), Color(1.0, 0.72, 0.45), 0.9, 3.0)

	# String lights along the shelf wall.
	var bulb_colors := [Color("ffcf7a"), Color("ff9f6e"), Color("ffe6a8")]
	for i in 26:
		var t := i / 25.0
		var x := lerpf(-5.6, 5.6, t)
		var y := 2.72 - sin(t * PI * 3.0) * 0.0 - (0.18 * (1.0 - pow(2.0 * fmod(t * 3.0, 1.0) - 1.0, 2.0)))
		world.add_child(MeshKit.mesh_node(MeshKit.sphere(0.03, 8), MeshKit.mat(bulb_colors[i % 3], 0.5, 5.0), Vector3(x, y, -4.92)))
	_omni(Vector3(-3, 2.5, -4.6), Color(1.0, 0.75, 0.45), 0.7, 3.5)
	_omni(Vector3(3, 2.5, -4.6), Color(1.0, 0.75, 0.45), 0.7, 3.5)

	# Plants.
	for p in [Vector3(-5.4, 0, -4.5), Vector3(5.4, 0, -4.4), Vector3(5.5, 0, 4.5)]:
		_plant(p)

	# Mug and crumbs on the coffee table corner, framed picture on the right wall.
	var mug := Node3D.new()
	mug.position = Vector3(3.48, 0.44, 0.78)
	mug.add_child(MeshKit.mesh_node(MeshKit.cyl(0.04, 0.036, 0.09), MeshKit.mat(Color("8c4a86"), 0.4), Vector3(0, 0.045, 0)))
	mug.add_child(MeshKit.mesh_node(MeshKit.cyl(0.034, 0.034, 0.002), MeshKit.mat(Color("5a2a14"), 0.2), Vector3(0, 0.085, 0)))
	world.add_child(mug)
	_solid(Vector3(0.04, 0.8, 1.1), Vector3(5.98, 1.7, 1.0), MeshKit.mat(Color("5c3520"), 0.6), false)
	_solid(Vector3(0.045, 0.66, 0.96), Vector3(5.97, 1.7, 1.0), MeshKit.mat(Color("d7b27a"), 0.9), false)
	_solid(Vector3(0.05, 0.3, 0.3), Vector3(5.96, 1.75, 0.85), MeshKit.mat(Color("2e8c9a"), 0.9), false)
	_solid(Vector3(0.05, 0.2, 0.2), Vector3(5.96, 1.6, 1.2), MeshKit.mat(Color("c8473b"), 0.9), false)


func _plant(pos: Vector3) -> void:
	var p := Node3D.new()
	p.position = pos
	p.add_child(MeshKit.mesh_node(MeshKit.cyl(0.2, 0.15, 0.36), MeshKit.mat(Color("b5623f"), 0.8), Vector3(0, 0.18, 0)))
	var leaf := MeshKit.mat(Color("4f7a3a"), 0.8)
	var leaf2 := MeshKit.mat(Color("6a9a48"), 0.8)
	for i in 7:
		var a := TAU * i / 7.0
		var b := MeshKit.mesh_node(MeshKit.sphere(0.17 + rng.randf() * 0.08, 10), leaf if i % 2 == 0 else leaf2,
			Vector3(cos(a) * 0.12, 0.55 + rng.randf() * 0.35, sin(a) * 0.12))
		b.scale = Vector3(1, 1.3, 1)
		p.add_child(b)
	world.add_child(p)


func _build_shelf(order: Array) -> void:
	var wood := MeshKit.mat(Color("6e4128"), 0.6)
	var back := MeshKit.mat(Color("4a2c1b"), 0.8)
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
	# Back panel, sides, dividers and boards.
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
			slot.anchor = Vector3(cx, fy + 0.001, z + 0.03)
			slot.shelved.connect(_on_shelved)
			slots.append(slot)
			# Ghost outline showing where this game lives.
			var gm := StandardMaterial3D.new()
			gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			gm.albedo_color = Color(g.color, 0.22)
			var ghost := MeshKit.mesh_node(MeshKit.box(Vector3(GameBox.W, GameBox.H, GameBox.W)), gm, Vector3(cx, fy + GameBox.H / 2 + 0.002, z + 0.03))
			world.add_child(ghost)
			slot.ghost = ghost
			# Name plate on the board edge below the cubby.
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

	# A few books and a plant on top so it feels lived in.
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


func _define_spots() -> void:
	# center = point on the surface, ext = scatter half-size, box = where the open box waits.
	spots = [
		{"center": Vector3(-3.45, 0.76, -1.5), "ext": Vector2(0.4, 0.38), "box": Vector3(-3.55, 0.0, -0.5), "box_rot": 0.2},
		{"center": Vector3(-2.52, 0.76, -1.5), "ext": Vector2(0.38, 0.38), "box": Vector3(-2.45, 0.0, -0.5), "box_rot": -0.15},
		{"center": Vector3(3.0, 0.44, 1.0), "ext": Vector2(0.5, 0.25), "box": Vector3(1.95, 0.0, 1.0), "box_rot": 1.4},
		{"center": Vector3(-2.4, 0.02, 2.5), "ext": Vector2(0.75, 0.75), "box": Vector3(-1.0, 0.0, 1.6), "box_rot": 0.6},
		{"center": Vector3(3.6, 0.74, -2.6), "ext": Vector2(0.38, 0.38), "box": Vector3(2.55, 0.0, -2.2), "box_rot": 1.2},
		{"center": Vector3(-5.65, 0.5, 0.65), "ext": Vector2(0.2, 0.7), "box": Vector3(-4.85, 0.0, 1.5), "box_rot": -1.3, "rot": 0.0},
	]


func _couch_spot() -> Dictionary:
	return {"center": Vector3(3.0, 0.46, 2.9), "ext": Vector2(0.8, 0.22)}


# ---------------------------------------------------------------- testing hooks

func _autotest() -> void:
	_start()
	await get_tree().create_timer(2.5).timeout
	print("items=", items.size(), " boxes=", boxes.size(), " slots=", slots.size())
	var fallen := items.filter(func(i: Item): return i.global_position.y < -0.5).size()
	print("items below floor after settle: ", fallen)
	# A wrong piece should be refused.
	var wrong: Item = items.filter(func(i: Item): return i.game_id != boxes[0].game_id)[0]
	print("wrong piece accepted? ", boxes[0].try_accept(wrong))
	for b in boxes:
		for it in items:
			if it.game_id == b.game_id and not it.stored:
				b.try_accept(it)
	await get_tree().create_timer(2.0).timeout
	for b in boxes:
		var wrong_slot: ShelfSlot = slots.filter(func(s: ShelfSlot): return s.game_id != b.game_id)[0]
		var right_slot: ShelfSlot = slots.filter(func(s: ShelfSlot): return s.game_id == b.game_id)[0]
		print("%s %d/%d packed=%s pickable=%s wrong_slot=%s right_slot=%s" % [b.game_name, b.count, b.needed, b.lid_closed, b.can_pick(), wrong_slot.place(b), right_slot.place(b)])
	await get_tree().create_timer(2.5).timeout
	print("finished=", finished, " mixups=", mixups)
	get_tree().quit()


func _screenshots() -> void:
	var dir := OS.get_cmdline_user_args()[OS.get_cmdline_user_args().find("--shot") + 1]
	await get_tree().create_timer(2.5).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(dir + "/title.png")
	_start()
	hud.toast("", 0.0)
	var views := [
		[Vector3(0.6, 0.05, 3.9), 0.05, -0.12, "room"],
		[Vector3(-3.0, 0.05, 0.2), 0.0, -0.55, "dining"],
		[Vector3(0.0, 0.05, -2.6), 0.0, -0.2, "shelf"],
	]
	for v in views:
		player.global_position = v[0]
		player.look_at_yaw(v[1], v[2])
		await get_tree().create_timer(0.6).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, v[3]])
	# Pack one game and shelve it for a progress shot.
	var b := boxes[0]
	for it in items:
		if it.game_id == b.game_id:
			b.try_accept(it)
	await get_tree().create_timer(2.0).timeout
	player.global_position = b.global_position + Vector3(0, 0, 1.1)
	player.look_at_yaw(0.0, -0.75)
	await get_tree().create_timer(0.4).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(dir + "/packed.png")
	get_tree().quit()
