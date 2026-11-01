class_name Player
extends CharacterBody3D
## First-person tidier.
## Click a piece to scoop a handful; hold and drag across a pile to sweep it all up.
## A handful can be mixed: pour it into a box and the box takes only its own pieces.
## Card piles can be carried several at a time the same way.

signal prompt_changed(text: String)
signal acted(kind: String, data: Variant)

const WALK := 2.6
const RUN := 4.4
const REACH := 2.8
const HAND_MAX := 80
const CARD_STACK_MAX := 8
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
		return "%d %s %s" % [hand.size(), p.g.ed_name, GameData.type_name(p.g.type, hand.size())]
	return "%d pieces (%d kinds)" % [hand.size(), kinds.size()]


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
	if not enabled:
		text = ""
	elif held == null and loose_piece and hand.size() < HAND_MAX:
		preview = pieces.handful(c)
		var p := c as Pieces.P
		var n := mini(preview.size(), HAND_MAX - hand.size())
		if hand.is_empty():
			text = "Scoop %d %s %s  ·  hold to sweep" % [n, p.g.ed_name, GameData.type_name(p.g.type, n)]
		else:
			text = "Scoop %d more %s  ·  holding %d" % [n, GameData.type_name(p.g.type, n), hand.size()]
	elif not hand.is_empty():
		if c is GameBox and not (c as GameBox).complete:
			var box := c as GameBox
			var fits := hand.filter(func(p: Pieces.P): return p.g.ed == box.ed_id).size()
			if fits > 0:
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
		if held.kind == "cards" and c is Item and (c as Item).kind == "cards" and (c as Item).can_pick() and extra_cards.size() < CARD_STACK_MAX - 1:
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
	# Scooping: any loose piece, even into a mixed handful.
	if held == null and c is Pieces.P and (c as Pieces.P).state == Pieces.LOOSE and hand.size() < HAND_MAX:
		_scoop(pieces.handful(c).slice(0, HAND_MAX - hand.size()))
		_sweeping = true
		_sweep_t = SWEEP_EVERY * 3.0
		return
	if not hand.is_empty():
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
	if held.kind == "cards" and c is Item and (c as Item).kind == "cards" and (c as Item).can_pick() and extra_cards.size() < CARD_STACK_MAX - 1:
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
	if took.is_empty():
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
	_arrange_hand()
	acted.emit("poured", {"box": box, "n": took.size(), "left": hand.size()})


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
	if _sweep_t > 0.0 or hand.size() >= HAND_MAX:
		return
	var c: Variant = hovered
	if c is Pieces.P and (c as Pieces.P).state == Pieces.LOOSE:
		var got: Array = pieces.handful(c).slice(0, mini(6, HAND_MAX - hand.size()))
		if not got.is_empty():
			_scoop(got)
			_sweep_t = SWEEP_EVERY


func _hand_slot(k: int) -> Transform3D:
	var ring := k / 10
	var a := (k % 10) * TAU / 10.0 + ring * 0.3
	var r := 0.02 + ring * 0.012
	return Transform3D(Basis(Vector3.UP, k * 0.7), Vector3(cos(a) * r * 1.6, ring * 0.012, sin(a) * r))


func _scoop(list: Array) -> void:
	var start := hand.size()
	for i in list.size():
		var p: Pieces.P = list[i]
		var mi := pieces.proxy(p)
		pieces.take(p)
		mi.reparent(_hand_root)
		var tw := mi.create_tween()
		tw.tween_interval(i * 0.015)
		tw.tween_property(mi, "transform", _hand_slot(start + i), 0.2).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
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
