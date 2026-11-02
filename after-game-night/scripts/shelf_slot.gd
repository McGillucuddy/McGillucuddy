class_name ShelfSlot
extends StaticBody3D
## One cubby on the game shelf. All the boxes of one game line stack up in it.

signal shelved(slot: ShelfSlot, box: GameBox)

var line_id := ""
var game_name := ""
var boxes_needed := 0
var placed: Array = []
var anchor := Vector3.ZERO
var ghost: Node3D
var _stack_h := 0.0


func filled() -> bool:
	return placed.size() >= boxes_needed


func place(box: GameBox) -> bool:
	if filled() or box.line_id != line_id or placed.has(box):
		return false
	placed.append(box)
	box.peek(false, true)
	box.held = false
	box.shelved = true
	box.freeze_mode = RigidBody3D.FREEZE_MODE_STATIC
	box.freeze = true
	box.collision_layer = Item.LAYER_WORLD
	box.collision_mask = 0
	box.set_highlight(false)
	var target := anchor + Vector3(0, _stack_h, 0)
	_stack_h += box.H + 0.004
	var tw := box.create_tween().set_parallel(true).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(box, "global_position", target, 0.55)
	tw.tween_property(box, "global_rotation", Vector3(0, global_rotation.y + randf_range(-0.03, 0.03), 0), 0.55)
	if ghost and filled():
		var g := ghost.create_tween()
		g.tween_property(ghost, "scale", Vector3(1.05, 1.05, 1.05), 0.15)
		g.tween_property(ghost, "scale", Vector3.ZERO, 0.2)
		g.tween_callback(ghost.hide)
	shelved.emit(self, box)
	return true
