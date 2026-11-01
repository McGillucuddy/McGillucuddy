class_name ShelfSlot
extends StaticBody3D
## One cubby on the game shelf, reserved for a single game's box.

signal shelved(slot: ShelfSlot, box: GameBox)

var game_id := ""
var game_name := ""
var filled := false
var anchor := Vector3.ZERO
var ghost: Node3D


func place(box: GameBox) -> bool:
	if filled or box.game_id != game_id:
		return false
	filled = true
	box.held = false
	box.shelved = true
	box.freeze_mode = RigidBody3D.FREEZE_MODE_STATIC
	box.freeze = true
	box.collision_layer = Item.LAYER_WORLD
	box.collision_mask = 0
	box.set_highlight(false)
	var tw := box.create_tween().set_parallel(true).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(box, "global_position", anchor, 0.55)
	tw.tween_property(box, "global_rotation", Vector3(0, global_rotation.y + randf_range(-0.04, 0.04), 0), 0.55)
	if ghost:
		var g := ghost.create_tween()
		g.tween_property(ghost, "scale", Vector3(1.1, 1.1, 1.1), 0.15)
		g.tween_property(ghost, "scale", Vector3.ZERO, 0.2)
		g.tween_callback(ghost.hide)
	shelved.emit(self, box)
	return true
