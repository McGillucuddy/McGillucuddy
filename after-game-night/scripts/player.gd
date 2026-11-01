class_name Player
extends CharacterBody3D
## First-person walker. Picks up big things one at a time and small pieces by the handful,
## carries them, and puts them where they belong.

signal prompt_changed(text: String)
signal acted(kind: String, data: Variant)

const WALK := 2.6
const RUN := 4.4
const REACH := 2.7
const HAND_MAX := 40

var cam: Camera3D
var ray: RayCast3D
var pieces: Pieces
var held: Item = null
var hand: Array = []          # pieces held in a handful
var _hand_nodes: Array = []   # their stand-ins, floating in front of the camera
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

	_hand_root = Node3D.new()
	_hand_root.position = Vector3(0.0, -0.2, -0.5)
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
	elif e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_LEFT:
			primary()
		elif e.button_index == MOUSE_BUTTON_RIGHT:
			throw()
	elif e.is_action_pressed("interact"):
		primary()
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
	_update_held(dt)


func _target() -> Variant:
	if not ray.is_colliding():
		return null
	var c := ray.get_collider()
	if c != null:
		return c
	return pieces.piece_at(ray.get_collider_rid()) if pieces else null


func _hand_label() -> String:
	var p: Pieces.P = hand[0]
	return "%d %s %s" % [hand.size(), p.g.ed_name, GameData.type_name(p.g.type, hand.size())]


func _update_hover() -> void:
	var c: Variant = _target()
	if not is_same(c, hovered):
		if hovered is Item and is_instance_valid(hovered):
			(hovered as Item).set_highlight(false)
		hovered = c
	var text := ""
	var preview: Array = []
	if not enabled:
		text = ""
	elif not holding_anything():
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
		elif c is Pieces.P and (c as Pieces.P).state == Pieces.LOOSE:
			preview = pieces.handful(c)
			var p := c as Pieces.P
			text = "Scoop up %d %s %s" % [preview.size(), p.g.ed_name, GameData.type_name(p.g.type, preview.size())]
		elif c is ShelfSlot and not (c as ShelfSlot).filled():
			text = "Shelf spot for %s" % (c as ShelfSlot).game_name
	elif not hand.is_empty():
		var p0: Pieces.P = hand[0]
		if c is GameBox and not (c as GameBox).complete:
			text = "Put %d %s in the %s box" % [hand.size(), GameData.type_name(p0.g.type, hand.size()), (c as GameBox).game_name]
			(c as GameBox).set_highlight(true)
		elif c is Pieces.P and (c as Pieces.P).state == Pieces.LOOSE and (c as Pieces.P).g == p0.g and hand.size() < HAND_MAX:
			preview = pieces.handful(c)
			text = "Scoop up %d more (holding %d)" % [mini(preview.size(), HAND_MAX - hand.size()), hand.size()]
		else:
			text = "Holding %s  ·  Click to set down  ·  Right-click to toss" % _hand_label()
	else:
		if held.kind != "box" and c is GameBox and not (c as GameBox).complete:
			var gb := c as GameBox
			if held.game_id == gb.ed_id and held.kind == "board" and not gb.insert_full():
				text = "The board goes on top, after every piece and card"
			elif held.game_id == gb.ed_id and held.kind == "rules" and gb.check(held) != "":
				text = "The rulebook goes in last"
			else:
				text = "Put in the %s box" % gb.game_name
			gb.set_highlight(true)
		elif held.kind == "box" and c is ShelfSlot and not (c as ShelfSlot).filled():
			text = "Shelve it in the %s cubby" % (c as ShelfSlot).game_name
		else:
			text = "Holding %s  ·  Click to set down  ·  Right-click to toss" % held.label
	if pieces and preview != _preview:
		_preview = preview
		pieces.show_outline(preview)
	if text != _last_prompt:
		_last_prompt = text
		prompt_changed.emit(text)


func primary() -> void:
	var c: Variant = hovered
	if c is Object and not is_instance_valid(c):
		c = null
	# Scooping pieces (also adds to a handful of the same kind).
	if held == null and c is Pieces.P and (c as Pieces.P).state == Pieces.LOOSE:
		var p := c as Pieces.P
		if hand.is_empty() or (hand[0] as Pieces.P).g == p.g:
			var got: Array = pieces.handful(p).slice(0, HAND_MAX - hand.size())
			_scoop(got)
			return
	if not holding_anything():
		if c is Item and (c as Item).can_pick():
			held = c as Item
			held.on_pick()
			acted.emit("pick", held)
		return
	if not hand.is_empty():
		if c is GameBox and not (c as GameBox).complete:
			var box := c as GameBox
			var why := box.check_pieces(hand)
			if why == "":
				var list := hand.duplicate()
				var nodes := _hand_nodes.duplicate()
				hand.clear()
				_hand_nodes.clear()
				box.accept_pieces(list, nodes)
				acted.emit("placed_pieces", box)
			else:
				box.shake()
				acted.emit("wrong_box", box)
				_drop_hand(-cam.global_basis.z * 0.5 + Vector3.UP * 0.6)
			return
		_drop_hand(-cam.global_basis.z * 0.4)
		return
	if held.kind != "box" and c is GameBox and not (c as GameBox).complete:
		var it := held
		var box := c as GameBox
		held = null
		var why := box.try_accept(it)
		if why == "":
			acted.emit("placed", it)
		else:
			it.on_release(-cam.global_basis.z * 0.6 + Vector3.UP * 0.8)
			box.shake()
			acted.emit("wrong_box" if why == "wrong_game" else why, box)
		return
	if held.kind == "box" and c is ShelfSlot:
		var slot := c as ShelfSlot
		if slot.place(held as GameBox):
			held = null
		else:
			acted.emit("wrong_slot", slot)
		return
	_release(-cam.global_basis.z * 0.4)


func _scoop(list: Array) -> void:
	var start := hand.size()
	for i in list.size():
		var p: Pieces.P = list[i]
		var mi := pieces.proxy(p)
		pieces.take(p)
		mi.reparent(_hand_root)
		var k := start + i
		var target := Transform3D(Basis(Vector3.UP, k * 0.7), Vector3(((k % 6) - 2.5) * 0.028, (k / 6) * 0.014, -((k / 3) % 2) * 0.03))
		var tw := mi.create_tween()
		tw.tween_interval(i * 0.02)
		tw.tween_property(mi, "transform", target, 0.22).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		hand.append(p)
		_hand_nodes.append(mi)
	pieces.show_outline([])
	_preview = []
	acted.emit("scoop", list.size())


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
	_release(-cam.global_basis.z * 2.0 + Vector3.UP * 1.2)


func _release(vel: Vector3) -> void:
	var it := held
	held = null
	it.on_release(vel + Vector3(velocity.x, 0, velocity.z))
	acted.emit("drop", it)


func _update_held(dt: float) -> void:
	if held == null:
		return
	var offset := Vector3(0.0, -0.17, -0.6)
	if held.kind == "box":
		offset = Vector3(0.0, -0.4, -0.78)
	elif held.kind == "board" or held.kind == "rules":
		offset = Vector3(0.0, -0.28, -0.62)
	var target := cam.global_transform * offset
	var t := held.global_transform
	t.origin = t.origin.lerp(target, minf(1.0, 16.0 * dt))
	var want := Quaternion(Basis(Vector3.UP, _yaw))
	var q := Quaternion(t.basis.orthonormalized()).slerp(want, minf(1.0, 10.0 * dt))
	t.basis = Basis(q)
	held.global_transform = t
