class_name GameBox
extends Item
## An open game box. Fill it with its own board and pieces, the lid closes, then carry it to the shelf.

signal progress_changed(box: GameBox, item: Item)
signal packed(box: GameBox)
signal bounced(box: GameBox, item: Item)

const W := 0.46
const H := 0.15
const T := 0.012

var game_name := ""
var color := Color.WHITE
var needed := 0
var count := 0
var complete := false
var lid_closed := false
var shelved := false
var contents: Node3D
var lid_pivot: Node3D

var _grid_i := 0


func setup(g: Dictionary) -> void:
	game_id = g.id
	game_name = g.name
	color = g.color
	kind = "box"
	label = "%s box" % game_name
	mass = 0.6

	visual = Node3D.new()
	add_child(visual)
	var outer := MeshKit.mat(color, 0.75)
	var inner := MeshKit.mat(color.darkened(0.55), 0.9)
	var trim := MeshKit.mat(color.lightened(0.35), 0.7)

	var parts := [
		[Vector3(W, T, W), Vector3(0, T / 2, 0)],
		[Vector3(W, H, T), Vector3(0, H / 2, W / 2 - T / 2)],
		[Vector3(W, H, T), Vector3(0, H / 2, -W / 2 + T / 2)],
		[Vector3(T, H, W - 2 * T), Vector3(W / 2 - T / 2, H / 2, 0)],
		[Vector3(T, H, W - 2 * T), Vector3(-W / 2 + T / 2, H / 2, 0)],
	]
	for p in parts:
		visual.add_child(MeshKit.mesh_node(MeshKit.box(p[0]), outer, p[1]))
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = p[0]
		cs.shape = bs
		cs.position = p[1]
		add_child(cs)
	# Darker insert so the inside reads as a tray.
	visual.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(W - 2 * T - 0.002, 0.002, W - 2 * T - 0.002)), inner, Vector3(0, T + 0.001, 0)))
	visual.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(W + 0.002, 0.018, T + 0.002)), trim, Vector3(0, H - 0.02, W / 2 - T / 2)))

	var front := _label(game_name, 50)
	front.position = Vector3(0, H * 0.48, W / 2 + 0.0015)
	visual.add_child(front)

	# Hinged lid along the back edge, standing open.
	lid_pivot = Node3D.new()
	lid_pivot.position = Vector3(0, H, -W / 2)
	lid_pivot.rotation.x = deg_to_rad(-105)
	visual.add_child(lid_pivot)
	var lid_w := W + 0.012
	lid_pivot.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(lid_w, T, lid_w)), outer, Vector3(0, T / 2, lid_w / 2 - 0.006)))
	lid_pivot.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(lid_w + 0.002, T + 0.002, 0.07)), trim, Vector3(0, T / 2, lid_w * 0.62)))
	for s in [-1.0, 1.0]:
		lid_pivot.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(T, 0.04, lid_w)), outer, Vector3(s * (lid_w / 2 - T / 2), -0.02 + T, lid_w / 2 - 0.006)))
	var top := _label(game_name, 64)
	top.position = Vector3(0, T + 0.0015, lid_w * 0.36)
	top.rotation.x = -PI / 2
	lid_pivot.add_child(top)

	contents = Node3D.new()
	contents.name = "Contents"
	add_child(contents)

	var intake := Area3D.new()
	intake.collision_layer = 0
	intake.collision_mask = LAYER_ITEMS
	var ics := CollisionShape3D.new()
	var ib := BoxShape3D.new()
	ib.size = Vector3(W - 2 * T, H, W - 2 * T)
	ics.shape = ib
	ics.position = Vector3(0, H / 2 + 0.01, 0)
	intake.add_child(ics)
	add_child(intake)
	intake.body_entered.connect(_on_intake)


func _label(text: String, size: int) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.0009
	l.outline_size = 10
	l.modulate = Color("fff4e4")
	l.outline_modulate = color.darkened(0.6)
	l.double_sided = false
	return l


func _ready() -> void:
	super._ready()
	freeze_mode = RigidBody3D.FREEZE_MODE_STATIC
	freeze = true


func can_pick() -> bool:
	return lid_closed and not shelved and not held


func try_accept(item: Item) -> bool:
	if complete or item == self or item.kind == "box" or item.stored or item.game_id != game_id:
		return false
	item.make_passenger()
	item.reparent(contents)
	var target_pos: Vector3
	var target_rot: Vector3
	var s := 0.75
	if item.kind == "board":
		target_pos = Vector3(0, T + 0.008, 0)
		target_rot = Vector3.ZERO
		s = 0.8
	else:
		var i := _grid_i
		_grid_i += 1
		var col := i % 3
		var row := (i / 3) % 3
		var layer := i / 9
		target_pos = Vector3(-0.13 + col * 0.13, T + 0.06 + layer * 0.06, -0.13 + row * 0.13)
		target_rot = item.rest_rotation + Vector3(0, randf_range(-0.4, 0.4), 0)
	var tw := create_tween().set_parallel(true).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	# Arc up over the rim, then settle into place.
	var mid := item.position.lerp(target_pos, 0.5) + Vector3(0, 0.18, 0)
	var arc := create_tween().set_trans(Tween.TRANS_SINE)
	arc.tween_property(item, "position", mid, 0.18).set_ease(Tween.EASE_OUT)
	arc.tween_property(item, "position", target_pos, 0.26).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(item, "rotation", target_rot, 0.44)
	if item.visual:
		tw.tween_property(item.visual, "scale", Vector3.ONE * s * item.base_scale, 0.44)
	count += 1
	progress_changed.emit(self, item)
	if count >= needed:
		complete = true
		_close_lid()
	return true


func _close_lid() -> void:
	var tw := create_tween()
	tw.tween_interval(0.5)
	tw.tween_property(lid_pivot, "rotation:x", 0.0, 0.55).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func():
		lid_closed = true
		packed.emit(self))
	var hop := create_tween()
	hop.tween_interval(1.0)
	hop.tween_property(visual, "scale", Vector3(1.08, 0.9, 1.08), 0.08)
	hop.tween_property(visual, "scale", Vector3.ONE, 0.25).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)


func shake() -> void:
	var tw := create_tween()
	var base := visual.rotation.y
	for a in [0.12, -0.1, 0.07, -0.04, 0.0]:
		tw.tween_property(visual, "rotation:y", base + a, 0.05)


func _on_intake(body: Node3D) -> void:
	if complete or not (body is Item):
		return
	var it := body as Item
	if it == self or it.held or it.stored or it.kind == "box":
		return
	if not try_accept(it):
		it.linear_velocity = Vector3(randf_range(-1.0, 1.0), 2.4, randf_range(-1.0, 1.0))
		shake()
		bounced.emit(self, it)
