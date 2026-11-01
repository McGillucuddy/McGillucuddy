class_name Player
extends CharacterBody3D
## First-person walker who can pick things up, carry them, and put them where they belong.

signal prompt_changed(text: String)
signal acted(kind: String, data: Object)

const WALK := 2.6
const RUN := 4.4
const REACH := 2.7

var cam: Camera3D
var ray: RayCast3D
var held: Item = null
var hovered: Object = null
var enabled := false
var sensitivity := 0.0025

var _yaw := 0.0
var _pitch := 0.0
var _last_prompt := "-"
var _bob := 0.0
var _cam_height := 1.55


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


func look_at_yaw(yaw: float, pitch := -0.15) -> void:
	_yaw = yaw
	_pitch = pitch
	rotation.y = _yaw
	cam.rotation.x = _pitch


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

	# Gentle head bob and crouch.
	var target_h := 0.95 if crouch else 1.55
	_cam_height = lerpf(_cam_height, target_h, minf(1.0, 10.0 * dt))
	var moving := Vector2(velocity.x, velocity.z).length()
	_bob += dt * moving * 3.2
	cam.position.y = _cam_height + sin(_bob) * 0.018 * minf(1.0, moving)

	_update_hover()
	_update_held(dt)


func _target() -> Object:
	if not ray.is_colliding():
		return null
	return ray.get_collider()


func _update_hover() -> void:
	var c := _target()
	if c != hovered:
		if hovered is Item and is_instance_valid(hovered):
			(hovered as Item).set_highlight(false)
		hovered = c
	var text := ""
	if not enabled:
		text = ""
	elif held == null:
		if c is GameBox:
			var b := c as GameBox
			if b.can_pick():
				text = "Pick up the %s box" % b.game_name
				b.set_highlight(true)
			elif not b.shelved:
				text = "%s box  ·  %d of %d inside" % [b.game_name, b.count, b.needed]
		elif c is Item and (c as Item).can_pick():
			text = "Pick up  ·  %s" % (c as Item).label
			(c as Item).set_highlight(true)
		elif c is ShelfSlot and not (c as ShelfSlot).filled:
			text = "Shelf spot for %s" % (c as ShelfSlot).game_name
	else:
		if held.kind != "box" and c is GameBox and not (c as GameBox).complete:
			text = "Put in the %s box" % (c as GameBox).game_name
			(c as GameBox).set_highlight(true)
		elif held.kind == "box" and c is ShelfSlot and not (c as ShelfSlot).filled:
			text = "Shelve it in the %s spot" % (c as ShelfSlot).game_name
		else:
			text = "Holding %s  ·  Click to set down  ·  Right-click to toss" % held.label
	if text != _last_prompt:
		_last_prompt = text
		prompt_changed.emit(text)


func primary() -> void:
	var c: Object = hovered if is_instance_valid(hovered) else null
	if held == null:
		if c is Item and (c as Item).can_pick():
			held = c as Item
			held.on_pick()
			acted.emit("pick", held)
		return
	if held.kind != "box" and c is GameBox and not (c as GameBox).complete:
		var it := held
		var box := c as GameBox
		held = null
		if box.try_accept(it):
			acted.emit("placed", it)
		else:
			it.on_release(-cam.global_basis.z * 0.6 + Vector3.UP * 0.8)
			box.shake()
			acted.emit("wrong_box", box)
		return
	if held.kind == "box" and c is ShelfSlot:
		var slot := c as ShelfSlot
		var b := held as GameBox
		if slot.place(b):
			held = null
		else:
			acted.emit("wrong_slot", slot)
		return
	_release(-cam.global_basis.z * 0.4)


func throw() -> void:
	if held == null:
		return
	_release(-cam.global_basis.z * (3.0 if held.kind == "piece" else 2.0) + Vector3.UP * 1.2)


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
		offset = Vector3(0.0, -0.36, -0.72)
	elif held.kind == "board":
		offset = Vector3(0.0, -0.28, -0.62)
	var target := cam.global_transform * offset
	var t := held.global_transform
	t.origin = t.origin.lerp(target, minf(1.0, 16.0 * dt))
	var want := Quaternion(Basis(Vector3.UP, _yaw))
	var q := Quaternion(t.basis.orthonormalized()).slerp(want, minf(1.0, 10.0 * dt))
	t.basis = Basis(q)
	held.global_transform = t
