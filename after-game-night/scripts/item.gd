class_name Item
extends RigidBody3D
## Anything the player can pick up: pieces, boards and (once packed) boxes.

signal clacked(item: Item, strength: float)

const LAYER_WORLD := 1
const LAYER_ITEMS := 2
const LAYER_SLOTS := 4

var game_id := ""
var kind := "piece"  # "piece", "board" or "box"
var piece_type := ""
var label := ""
var held := false
var stored := false
var rest_rotation := Vector3.ZERO
var home: Dictionary = {}
var visual: Node3D
var base_scale := 1.0

var _meshes: Array[MeshInstance3D] = []
var _last_clack := 0.0
var _lit := false

static var _outline: StandardMaterial3D


func _ready() -> void:
	contact_monitor = true
	max_contacts_reported = 2
	continuous_cd = true
	collision_layer = LAYER_ITEMS
	collision_mask = LAYER_WORLD | LAYER_ITEMS
	var pm := PhysicsMaterial.new()
	pm.friction = 0.85
	pm.bounce = 0.12
	physics_material_override = pm
	body_entered.connect(_on_body_entered)
	_collect(self)


func _collect(n: Node) -> void:
	for c in n.get_children():
		if c is Item:
			continue
		if c is MeshInstance3D:
			_meshes.append(c)
		_collect(c)


func can_pick() -> bool:
	return not stored and not held


func set_highlight(on: bool) -> void:
	if on == _lit:
		return
	_lit = on
	if _outline == null:
		_outline = StandardMaterial3D.new()
		_outline.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_outline.cull_mode = BaseMaterial3D.CULL_FRONT
		_outline.grow = true
		_outline.grow_amount = 0.005
		_outline.albedo_color = Color(1.0, 0.86, 0.5)
	for m in _meshes:
		if is_instance_valid(m):
			m.material_overlay = _outline if on else null


func on_pick() -> void:
	held = true
	set_highlight(false)
	freeze_mode = RigidBody3D.FREEZE_MODE_KINEMATIC
	freeze = true
	collision_layer = 0
	collision_mask = 0


func on_release(vel: Vector3) -> void:
	held = false
	collision_layer = LAYER_ITEMS
	collision_mask = LAYER_WORLD | LAYER_ITEMS
	freeze = false
	linear_velocity = vel
	angular_velocity = Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5) * 3.0
	sleeping = false


## Turns the item into a passenger of a box: no physics, just a child that rides along.
func make_passenger() -> void:
	stored = true
	held = false
	set_highlight(false)
	freeze_mode = RigidBody3D.FREEZE_MODE_KINEMATIC
	freeze = true
	collision_layer = 0
	collision_mask = 0
	contact_monitor = false


func _on_body_entered(_other: Node) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	var v := linear_velocity.length()
	if v > 0.4 and now - _last_clack > 0.09:
		_last_clack = now
		clacked.emit(self, clampf(v / 3.0, 0.1, 1.0))
