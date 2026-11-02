class_name Player
extends CharacterBody3D
## First-person tidier.
## Click a piece to scoop a handful; hold and drag across a pile to sweep it all up.
## A handful can be mixed: pour it into a box and the box takes only its own pieces.
## Card piles can be carried several at a time the same way.

signal prompt_changed(text: String)
signal acted(kind: String, data: Variant)
signal tool_changed(i: int)

enum { HANDS, LANTERN, DUSTPAN, MAGNET }

const WALK := 2.6
const RUN := 4.4
const REACH := 2.8
const SWEEP_EVERY := 0.045

var cam: Camera3D
var ray: RayCast3D
var pieces: Pieces
var held: Item = null           # one big thing: a box, board or rulebook (or the first card pile)
var extra_cards: Array = []     # more card piles carried on top of the first
var hand: Array = []            # pieces in a handful
var _hand_nodes: Array = []
var _hand_root: Node3D
var hovered: Variant = null
var enabled := false
var sensitivity := 0.0025

var _yaw := 0.0
var _pitch := 0.0
var _last_prompt := "-"
var _bob := 0.0
var _cam_height := 1.55
var _preview: Array = []
var _sweeping := false
var _sweep_t := 0.0
var tool := HANDS
var unlocked := [true, false, false, false]

# Tuned by upgrades from the Tool Chest.
var hand_max := 80
var hand_mult := 1.0
var pan_max := 150
var pan_radius := 0.2
var magnet_radius := 2.0
var card_stack_max := 8
var chute_range := 0.0
var boxes_ref: Array = []
var caddy_model: Node3D
var _tool_models: Array[Node3D] = []
var _preview_t := 0.0


func _ready() -> void:
	collision_layer = 8
	collision_mask = Item.LAYER_WORLD
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.28
	cap.height = 1.7
	col.shape = cap
	col.position.y = 0.85
	add_child(col)

	cam = Camera3D.new()
	cam.position.y = _cam_height
	cam.fov = 70
	cam.near = 0.03
	cam.current = true
	add_child(cam)

	ray = RayCast3D.new()
	ray.target_position = Vector3(0, 0, -REACH)
	ray.collision_mask = Item.LAYER_WORLD | Item.LAYER_ITEMS | Item.LAYER_SLOTS
	cam.add_child(ray)

	_build_tools()
	_hand_root = Node3D.new()
	_hand_root.position = Vector3(0.1, -0.23, -0.5)
	cam.add_child(_hand_root)


func look_at_yaw(yaw: float, pitch := -0.15) -> void:
	_yaw = yaw
	_pitch = pitch
	rotation.y = _yaw
	cam.rotation.x = _pitch


func holding_anything() -> bool:
	return held != null or not hand.is_empty()


func _unhandled_input(e: InputEvent) -> void:
	if not enabled:
		return
	if e is InputEventMouseButton and e.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		return
	if e is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_yaw -= e.relative.x * sensitivity
		_pitch = clampf(_pitch - e.relative.y * sensitivity, -1.5, 1.45)
		rotation.y = _yaw
		cam.rotation.x = _pitch
	elif e is InputEventKey and e.pressed and not e.echo and e.physical_keycode >= KEY_1 and e.physical_keycode <= KEY_4:
		set_tool(e.physical_keycode - KEY_1)
	elif e is InputEventMouseButton and e.pressed and (e.button_index == MOUSE_BUTTON_WHEEL_UP or e.button_index == MOUSE_BUTTON_WHEEL_DOWN):
		var step := 1 if e.button_index == MOUSE_BUTTON_WHEEL_DOWN else -1
		var i := tool
		for k in 4:
			i = posmod(i + step, 4)
			if unlocked[i]:
				break
		set_tool(i)
	elif e is InputEventMouseButton:
		if e.button_index == MOUSE_BUTTON_LEFT:
			if e.pressed:
				primary()
			else:
				_sweeping = false
		elif e.button_index == MOUSE_BUTTON_RIGHT and e.pressed:
			throw()
	elif e.is_action_pressed("interact"):
		primary()
	elif e.is_action_released("interact"):
		_sweeping = false
	elif e.is_action_pressed("throw"):
		throw()


func _physics_process(dt: float) -> void:
	if not is_on_floor():
		velocity.y -= 9.8 * dt
	var input := Vector2.ZERO
	if enabled:
		input = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var dir := (transform.basis * Vector3(input.x, 0, input.y)).normalized()
	var crouch := enabled and Input.is_action_pressed("crouch")
	var speed := RUN if (enabled and Input.is_action_pressed("sprint")) else WALK
	if crouch:
		speed = 1.4
	velocity.x = lerpf(velocity.x, dir.x * speed, minf(1.0, 12.0 * dt))
	velocity.z = lerpf(velocity.z, dir.z * speed, minf(1.0, 12.0 * dt))
	move_and_slide()

	var target_h := 0.95 if crouch else 1.55
	_cam_height = lerpf(_cam_height, target_h, minf(1.0, 10.0 * dt))
	var moving := Vector2(velocity.x, velocity.z).length()
	_bob += dt * moving * 3.2
	cam.position.y = _cam_height + sin(_bob) * 0.018 * minf(1.0, moving)

	_update_hover()
	_update_sweep(dt)
	_update_held(dt)


# ---------------------------------------------------------------- aiming

func _target() -> Variant:
	if not ray.is_colliding():
		return null
	var c := ray.get_collider()
	if c != null:
		return c
	return pieces.piece_at(ray.get_collider_rid()) if pieces else null


func _hand_label() -> String:
	var kinds := {}
	for p: Pieces.P in hand:
		kinds[p.g.key] = true
	if kinds.size() == 1:
		var p: Pieces.P = hand[0]
		return "%d %s %s" % [hand.size(), p.g.ed_name, p.g.nice(hand.size())]
	return "%d pieces (%d kinds)" % [hand.size(), kinds.size()]


func _cap() -> int:
	return pan_max if tool == DUSTPAN else hand_max


func _card_count() -> int:
	return 1 + extra_cards.size() if held and held.kind == "cards" else 0


func _update_hover() -> void:
	var c: Variant = _target()
	if not is_same(c, hovered):
		if hovered is Item and is_instance_valid(hovered):
			(hovered as Item).set_highlight(false)
		hovered = c
	var text := ""
	var preview: Array = []
	var loose_piece: bool = c is Pieces.P and (c as Pieces.P).state == Pieces.LOOSE
	var hit_ok := ray.is_colliding()
	if not enabled:
		text = ""
	elif tool == LANTERN and hand.is_empty() and held == null:
		if c is GameBox and not (c as GameBox).complete:
			text = "Hold up the lantern  ·  show everything that belongs in %s" % (c as GameBox).game_name
			(c as GameBox).set_highlight(true)
		elif loose_piece:
			var p := c as Pieces.P
			text = "Where does this %s go?" % p.g.nice(1)
		elif c is Item and (c as Item).kind != "box" and (c as Item).can_pick():
			text = "Where does this go?  ·  %s" % (c as Item).label
		else:
			text = "Seeker Lantern  ·  aim at a box or a piece"
	elif tool == DUSTPAN and held == null and hit_ok and not (c is GameBox) and hand.size() < pan_max:
		# Refresh the preview ten times a second; it's a scan over every piece in the room.
		_preview_t -= get_physics_process_delta_time()
		if _preview_t <= 0.0:
			_preview_t = 0.1
			preview = pieces.in_radius(ray.get_collision_point(), pan_radius, mini(30, pan_max - hand.size()))
		else:
			preview = _preview
		var shown := ("%d+" % preview.size()) if preview.size() >= 30 else str(preview.size())
		text = ("Sweep up %s pieces  ·  hold to keep sweeping" % shown) if not preview.is_empty() else "Dustpan  ·  aim at a pile"
		if not hand.is_empty():
			text += "  ·  pan holds %d" % hand.size()
	elif tool == MAGNET and held == null and loose_piece and hand.size() < hand_max:
		var p := c as Pieces.P
		preview = pieces.handful(p, magnet_radius, mini(30, hand_max - hand.size()))
		var n := pieces.handful(p, magnet_radius, hand_max - hand.size()).size()
		text = "Magnet: pull in %d %s %s from nearby" % [n, p.g.ed_name, p.g.nice(n)]
	elif tool == MAGNET and held == null and hand.is_empty():
		text = "Magnet  ·  aim at a piece to pull in every match nearby"
	elif held == null and loose_piece and hand.size() < hand_max:
		preview = pieces.handful(c, 0.32, int(ceil((c as Pieces.P).g.handful * hand_mult)))
		var p := c as Pieces.P
		var n := mini(preview.size(), hand_max - hand.size())
		if hand.is_empty():
			text = "Scoop %d %s %s  ·  hold to sweep" % [n, p.g.ed_name, p.g.nice(n)]
		else:
			text = "Scoop %d more %s  ·  holding %d" % [n, p.g.nice(n), hand.size()]
	elif not hand.is_empty() and c is Object and c.has_meta("paint_desk"):
		var raw := hand.filter(func(p: Pieces.P): return p.unpainted).size()
		text = ("Paint %d miniatures" % raw) if raw > 0 else "Painting desk  ·  nothing in your hand needs paint"
	elif not hand.is_empty():
		if c is GameBox and not (c as GameBox).complete:
			var box := c as GameBox
			var fits := hand.filter(func(p: Pieces.P): return p.g.ed == box.ed_id and not p.unpainted).size()
			var raw := hand.filter(func(p: Pieces.P): return p.g.ed == box.ed_id and p.unpainted).size()
			if raw > 0 and fits == 0:
				text = "%d of these need painting first  ·  take them to the painting desk" % raw
			elif fits > 0:
				text = "Pour into %s  ·  %d of your %d belong here" % [box.game_name, fits, hand.size()]
			else:
				text = "Pour into %s" % box.game_name
			box.set_highlight(true)
		else:
			text = "Holding %s  ·  Click to set down  ·  Right-click to toss" % _hand_label()
	elif held == null:
		if c is GameBox:
			var b := c as GameBox
			if b.can_pick():
				text = "Pick up the %s box" % b.game_name
				b.set_highlight(true)
			elif not b.shelved:
				text = "%s  ·  %d of %d put away" % [b.game_name, b.units, b.units_needed]
		elif c is Item and (c as Item).can_pick():
			text = "Pick up  ·  %s" % (c as Item).label
			(c as Item).set_highlight(true)
		elif c is ShelfSlot and not (c as ShelfSlot).filled():
			text = "Shelf cubby for %s" % (c as ShelfSlot).game_name
	else:
		if held.kind == "cards" and c is Item and (c as Item).kind == "cards" and (c as Item).can_pick() and extra_cards.size() < card_stack_max - 1:
			text = "Add %s to your stack  ·  carrying %d piles" % [(c as Item).label, _card_count()]
			(c as Item).set_highlight(true)
		elif held.kind != "box" and c is GameBox and not (c as GameBox).complete:
			var gb := c as GameBox
			if held.kind == "cards" and _card_count() > 1:
				var fits := ([held] + extra_cards).filter(func(i: Item): return i.game_id == gb.ed_id).size()
				text = "Put card piles in %s  ·  %d of %d belong here" % [gb.game_name, fits, _card_count()]
			elif held.game_id == gb.ed_id and held.kind == "board" and not gb.insert_full():
				text = "The board goes on top, after every piece and card"
			elif held.game_id == gb.ed_id and held.kind == "rules" and gb.check(held) != "":
				text = "The rulebook goes in last"
			else:
				text = "Put in %s" % gb.game_name
			gb.set_highlight(true)
		elif held.kind == "box" and c is ShelfSlot and not (c as ShelfSlot).filled():
			text = "Shelve it in the %s cubby" % (c as ShelfSlot).game_name
		else:
			var what := held.label if _card_count() <= 1 else "%d card piles" % _card_count()
			text = "Holding %s  ·  Click to set down  ·  Right-click to toss" % what
	if pieces and preview != _preview:
		_preview = preview
		pieces.show_outline(preview)
	if text != _last_prompt:
		_last_prompt = text
		prompt_changed.emit(text)


# ---------------------------------------------------------------- actions

func primary() -> void:
	var c: Variant = hovered
	if c is Object and not is_instance_valid(c):
		c = null
	var aiming_box: bool = c is GameBox and not (c as GameBox).complete
	if tool == LANTERN and hand.is_empty() and held == null:
		if c is GameBox:
			acted.emit("seek_box", c)
		elif (c is Pieces.P and (c as Pieces.P).state == Pieces.LOOSE) or (c is Item and (c as Item).kind != "box"):
			acted.emit("seek_for", c)
		return
	if tool == DUSTPAN and held == null and not aiming_box and ray.is_colliding():
		if hand.size() < pan_max:
			var got := pieces.in_radius(ray.get_collision_point(), pan_radius, pan_max - hand.size())
			if not got.is_empty():
				_scoop(got)
		_sweeping = true
		_sweep_t = SWEEP_EVERY * 3.0
		return
	if tool == MAGNET and held == null and c is Pieces.P and (c as Pieces.P).state == Pieces.LOOSE and hand.size() < hand_max:
		var got := pieces.handful(c, magnet_radius, hand_max - hand.size())
		_scoop(got, true)
		acted.emit("magnet", got.size())
		return
	# Scooping: any loose piece, even into a mixed handful.
	if held == null and c is Pieces.P and (c as Pieces.P).state == Pieces.LOOSE and hand.size() < hand_max:
		_scoop(pieces.handful(c, 0.32, int(ceil((c as Pieces.P).g.handful * hand_mult))).slice(0, hand_max - hand.size()))
		_sweeping = true
		_sweep_t = SWEEP_EVERY * 3.0
		return
	if not hand.is_empty():
		if c is Object and c.has_meta("paint_desk"):
			acted.emit("paint", c)
			return
		if c is GameBox and not (c as GameBox).complete:
			_pour_into(c as GameBox)
			return
		_drop_hand(-cam.global_basis.z * 0.4)
		return
	if held == null:
		if c is Item and (c as Item).can_pick():
			held = c as Item
			held.on_pick()
			acted.emit("pick", held)
		return
	# Carrying card piles: grab more of them.
	if held.kind == "cards" and c is Item and (c as Item).kind == "cards" and (c as Item).can_pick() and extra_cards.size() < card_stack_max - 1:
		var it := c as Item
		it.on_pick()
		extra_cards.append(it)
		acted.emit("pick", it)
		return
	if held.kind != "box" and c is GameBox and not (c as GameBox).complete:
		_put_items_in(c as GameBox)
		return
	if held.kind == "box" and c is ShelfSlot:
		var slot := c as ShelfSlot
		if slot.place(held as GameBox):
			held = null
		else:
			acted.emit("wrong_slot", slot)
		return
	_release_all(-cam.global_basis.z * 0.4)


func _pour_into(box: GameBox) -> void:
	var took := box.sift(hand, _hand_nodes)
	if took.is_empty() and chute_range <= 0.0:
		box.shake()
		acted.emit("wrong_box", box)
		return
	var keep: Array = []
	var keep_nodes: Array = []
	for i in hand.size():
		if not took.has(i):
			keep.append(hand[i])
			keep_nodes.append(_hand_nodes[i])
	hand = keep
	_hand_nodes = keep_nodes
	if not took.is_empty():
		acted.emit("poured", {"box": box, "n": took.size(), "left": hand.size()})
	# The Sorting Chute sends what's left to every other open box that wants it.
	var chuted := 0
	if chute_range > 0.0:
		for other: GameBox in boxes_ref:
			if hand.is_empty():
				break
			if other == box or other.complete or other.held or other.global_position.distance_to(box.global_position) > chute_range:
				continue
			var t2 := other.sift(hand, _hand_nodes)
			if t2.is_empty():
				continue
			var k2: Array = []
			var kn2: Array = []
			for i in hand.size():
				if not t2.has(i):
					k2.append(hand[i])
					kn2.append(_hand_nodes[i])
			hand = k2
			_hand_nodes = kn2
			chuted += t2.size()
			acted.emit("poured", {"box": other, "n": t2.size(), "left": hand.size()})
	if took.is_empty() and chuted == 0:
		var raw := hand.filter(func(p: Pieces.P): return p.g.ed == box.ed_id and p.unpainted).size()
		if raw > 0:
			acted.emit("needs_paint", raw)
			return
		box.shake()
		acted.emit("wrong_box", box)
		return
	_arrange_hand()


func _put_items_in(box: GameBox) -> void:
	var carried: Array = [held] + extra_cards
	var left: Array = []
	var took := 0
	var last_reason := ""
	for it: Item in carried:
		var why := box.try_accept(it)
		if why == "":
			took += 1
		else:
			left.append(it)
			last_reason = why
	if took == 0:
		box.shake()
		acted.emit("wrong_box" if last_reason == "wrong_game" else last_reason, box)
		return
	held = left[0] if not left.is_empty() else null
	extra_cards = left.slice(1)
	acted.emit("placed", {"box": box, "n": took, "left": left.size()})


func _update_sweep(dt: float) -> void:
	if not _sweeping or not enabled:
		return
	if not (Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) or Input.is_action_pressed("interact")):
		_sweeping = false
		return
	_sweep_t -= dt
	if _sweep_t > 0.0 or hand.size() >= _cap():
		return
	if tool == DUSTPAN:
		if ray.is_colliding() and not (hovered is GameBox):
			var got := pieces.in_radius(ray.get_collision_point(), pan_radius, mini(20, pan_max - hand.size()))
			if not got.is_empty():
				_scoop(got)
		_sweep_t = SWEEP_EVERY * 1.5
		return
	if tool != HANDS:
		return
	var c: Variant = hovered
	if c is Pieces.P and (c as Pieces.P).state == Pieces.LOOSE:
		var got: Array = pieces.handful(c).slice(0, mini(6, hand_max - hand.size()))
		if not got.is_empty():
			_scoop(got)
			_sweep_t = SWEEP_EVERY


func _hand_slot(k: int) -> Transform3D:
	var layer := k / 25
	var i := k % 25
	var x := (i % 5 - 2) * 0.024 + (layer % 2) * 0.012
	var z := (i / 5 - 2) * 0.02
	return Transform3D(Basis(Vector3.UP, k * 0.7), Vector3(x, layer * 0.013, z))


func _scoop(list: Array, stream := false) -> void:
	var start := hand.size()
	for i in list.size():
		var p: Pieces.P = list[i]
		var mi := pieces.proxy(p)
		pieces.take(p)
		mi.reparent(_hand_root)
		var tw := mi.create_tween()
		tw.tween_interval(i * (0.025 if stream else 0.012))
		tw.tween_property(mi, "transform", _hand_slot(start + i), 0.45 if stream else 0.2).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		hand.append(p)
		_hand_nodes.append(mi)
	pieces.show_outline([])
	_preview = []
	acted.emit("scoop", list.size())


func _arrange_hand() -> void:
	for k in _hand_nodes.size():
		var mi: Node3D = _hand_nodes[k]
		mi.create_tween().tween_property(mi, "transform", _hand_slot(k), 0.2).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


func _drop_hand(vel: Vector3) -> void:
	for i in hand.size():
		var p: Pieces.P = hand[i]
		var mi: Node3D = _hand_nodes[i]
		var xf := mi.global_transform
		mi.queue_free()
		pieces.drop(p, xf, vel + Vector3(randf_range(-0.3, 0.3), randf_range(0, 0.3), randf_range(-0.3, 0.3)))
	hand.clear()
	_hand_nodes.clear()
	acted.emit("drop", null)


func throw() -> void:
	if not hand.is_empty():
		_drop_hand(-cam.global_basis.z * 2.6 + Vector3.UP * 1.0)
		return
	if held == null:
		return
	_release_all(-cam.global_basis.z * 2.0 + Vector3.UP * 1.2)


func _release_all(vel: Vector3) -> void:
	var all: Array = [held] + extra_cards
	held = null
	extra_cards.clear()
	for it: Item in all:
		it.on_release(vel + Vector3(velocity.x, 0, velocity.z) + Vector3(randf_range(-0.2, 0.2), 0, randf_range(-0.2, 0.2)))
	acted.emit("drop", all[0])


func _update_held(dt: float) -> void:
	if held == null:
		return
	var offset := Vector3(0.0, -0.17, -0.6)
	if held.kind == "box":
		offset = Vector3(0.0, -0.42, -0.8)
	elif held.kind == "board" or held.kind == "rules":
		offset = Vector3(0.0, -0.28, -0.62)
	var want := Quaternion(Basis(Vector3.UP, _yaw))
	var lift := 0.0
	for it: Item in [held] + extra_cards:
		var target := cam.global_transform * (offset + Vector3(0, lift, 0))
		var t := it.global_transform
		t.origin = t.origin.lerp(target, minf(1.0, 16.0 * dt))
		var q := Quaternion(t.basis.orthonormalized()).slerp(want, minf(1.0, 10.0 * dt))
		t.basis = Basis(q)
		it.global_transform = t
		lift += 0.012 + it.card_count * MeshKit.CARD.y * it.base_scale


# ---------------------------------------------------------------- tools

func set_tool(i: int) -> void:
	if i < 0 or i >= unlocked.size() or not unlocked[i]:
		return
	tool = i
	_sweeping = false
	for k in _tool_models.size():
		_tool_models[k].visible = k == i
	pieces.show_outline([]) if pieces else null
	_preview = []
	tool_changed.emit(i)


func _build_tools() -> void:
	var brass := MeshKit.mat(Color("b08d4a"), 0.35)
	var wood := MeshKit.mat(Color("7a4a26"), 0.7)
	# 0: hands (nothing to show)
	var hands := Node3D.new()
	cam.add_child(hands)
	_tool_models.append(hands)
	# 1: the seeker lantern, with its own warm light.
	var lantern := Node3D.new()
	lantern.position = Vector3(0.24, -0.22, -0.42)
	lantern.add_child(MeshKit.mesh_node(MeshKit.cyl(0.035, 0.04, 0.012, 12), brass, Vector3(0, -0.05, 0)))
	lantern.add_child(MeshKit.mesh_node(MeshKit.cyl(0.03, 0.03, 0.08, 12), MeshKit.mat(Color(1.0, 0.85, 0.6), 0.2, 2.5), Vector3(0, 0.0, 0)))
	for a in 4:
		var ang := a * PI / 2 + PI / 4
		lantern.add_child(MeshKit.mesh_node(MeshKit.cyl(0.003, 0.003, 0.09, 4), brass, Vector3(cos(ang) * 0.033, 0, sin(ang) * 0.033)))
	lantern.add_child(MeshKit.mesh_node(MeshKit.cyl(0.012, 0.04, 0.025, 12), brass, Vector3(0, 0.052, 0)))
	lantern.add_child(MeshKit.mesh_node(MeshKit.torus(0.012, 0.017), brass, Vector3(0, 0.075, 0), Vector3(PI / 2, 0, 0)))
	var glow := OmniLight3D.new()
	glow.light_color = Color(1.0, 0.75, 0.45)
	glow.light_energy = 0.9
	glow.omni_range = 2.2
	lantern.add_child(glow)
	cam.add_child(lantern)
	_tool_models.append(lantern)
	# 2: the dustpan.
	var pan := Node3D.new()
	pan.position = Vector3(0.1, -0.25, -0.5)
	pan.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.17, 0.004, 0.13)), MeshKit.mat(Color("6f8f86"), 0.5), Vector3(0, -0.004, 0)))
	for sx in [-1.0, 1.0]:
		pan.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.004, 0.03, 0.13)), MeshKit.mat(Color("6f8f86"), 0.5), Vector3(sx * 0.085, 0.01, 0)))
	pan.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.17, 0.04, 0.004)), MeshKit.mat(Color("6f8f86"), 0.5), Vector3(0, 0.015, 0.065)))
	pan.add_child(MeshKit.mesh_node(MeshKit.cyl(0.008, 0.008, 0.14, 8), wood, Vector3(0, 0.02, 0.13), Vector3(PI / 2 - 0.3, 0, 0)))
	cam.add_child(pan)
	_tool_models.append(pan)
	# 3: the magnet.
	var mag := Node3D.new()
	mag.position = Vector3(0.22, -0.2, -0.42)
	mag.rotation = Vector3(-0.4, 0.3, 0)
	var horseshoe := MeshKit.mesh_node(MeshKit.torus(0.022, 0.04), MeshKit.mat(Color("c8323a"), 0.35), Vector3.ZERO, Vector3(PI / 2, 0, 0))
	horseshoe.scale = Vector3(1, 1, 1)
	mag.add_child(horseshoe)
	for sx in [-1.0, 1.0]:
		mag.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(0.018, 0.02, 0.018)), MeshKit.mat(Color("d8dde2"), 0.2), Vector3(sx * 0.031, -0.03, 0)))
	cam.add_child(mag)
	_tool_models.append(mag)
	for k in _tool_models.size():
		_tool_models[k].visible = k == tool
