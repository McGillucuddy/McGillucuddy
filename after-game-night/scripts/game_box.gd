class_name GameBox
extends Item
## An open game box with a fitted insert. Every piece has its own spot in a compartment,
## cards stack in their tray, the board folds in on top, and the rulebook goes in last.

signal progress_changed(box: GameBox, item: Item, group_done: bool)
signal packed(box: GameBox)
signal bounced(box: GameBox, item: Item, reason: String)

const T := 0.012           # cardboard thickness
const WELL_H := 0.05       # depth of the insert compartments
const H := 0.125           # box height
const IW := 0.64           # inside width
const MAX_ID := 0.42       # most inside depth the shelf allows
const GAP := 0.01

var W := IW + 2 * T
var D := 0.4
var game_name := ""
var color := Color.WHITE
var needed := 0
var count := 0
var complete := false
var lid_closed := false
var shelved := false
var board_in := false
var contents: Node3D
var lid_pivot: Node3D

## One entry per piece spot: {type, pos, rot, scale, item, ghost}
var spots: Array = []
var _cards := {"pos": Vector3.ZERO, "scale": 1.0, "need": 0, "have": 0, "y": 0.0, "ghost": null}
var _has_board := false
var _has_rules := false
var _group_left := {}


## Builds the box around the exact set of items it has to hold.
func setup(g: Dictionary, items: Array) -> void:
	game_id = g.id
	game_name = g.name
	color = g.color
	kind = "box"
	label = "%s box" % game_name
	mass = 0.7

	var groups := {}
	var order: Array = []
	for it: Item in items:
		match it.kind:
			"board":
				_has_board = true
			"rules":
				_has_rules = true
			"cards":
				_cards.need += 1
				if not groups.has("cards"):
					groups["cards"] = {"type": "cards", "n": 1, "sample": it}
					order.append("cards")
			_:
				if not groups.has(it.piece_type):
					groups[it.piece_type] = {"type": it.piece_type, "n": 0, "sample": it}
					order.append(it.piece_type)
				groups[it.piece_type].n += 1
	for t in order:
		var gr: Dictionary = groups[t]
		var s: Item = gr.sample
		gr["aabb"] = MeshKit.visual_aabb(s.visual, s.rest_rotation) if t != "cards" else AABB(Vector3(-MeshKit.CARD.x / 2, 0, -MeshKit.CARD.z / 2), Vector3(MeshKit.CARD.x, WELL_H * 0.8, MeshKit.CARD.z))
		gr["base"] = s.base_scale
		gr["rest"] = s.rest_rotation
		_group_left[t] = gr.n

	# Shrink everything a little at a time until the insert fits the shelf.
	var layout := {}
	var f := 0.85
	for attempt in 12:
		layout = _layout(order.map(func(t): return groups[t]), f)
		if layout.depth <= MAX_ID:
			break
		f *= 0.92
	var id: float = maxf(layout.depth, 0.3)
	D = id + 2 * T

	_build_shell()
	_build_insert(layout, id)


func _layout(groups: Array, f: float) -> Dictionary:
	var wells := []
	for gr: Dictionary in groups:
		var bb: AABB = gr.aabb
		var sv: float = minf(f * gr.base, WELL_H * 0.92 / maxf(bb.size.y, 0.001))
		if gr.type == "cards":
			sv = minf(f * gr.base, 1.0)
		var fx := bb.size.x * sv
		var fz := bb.size.z * sv
		var h := bb.size.y * sv
		var stack := 1
		if gr.type != "cards":
			stack = clampi(int(floor(WELL_H * 0.95 / h)), 1, 3)
		var cells := 1 if gr.type == "cards" else ceili(float(gr.n) / stack)
		var cols := clampi(ceili(sqrt(cells * fz / maxf(fx, 0.001))), 1, cells)
		var max_cols := maxi(1, int(floor((IW - GAP) / (fx + GAP))))
		cols = mini(cols, max_cols)
		var rows := ceili(float(cells) / cols)
		wells.append({"gr": gr, "sv": sv, "fx": fx, "fz": fz, "h": h, "cells": cells, "cols": cols, "rows": rows,
			"w": cols * (fx + GAP) + GAP, "d": rows * (fz + GAP) + GAP})
	wells.sort_custom(func(a, b): return a.d > b.d)
	# Shelf packing: fill rows left to right.
	var rows_out := []
	var cur := {"items": [], "w": 0.0, "d": 0.0}
	for wl in wells:
		if cur.w + wl.w > IW + 0.0001 and not cur.items.is_empty():
			rows_out.append(cur)
			cur = {"items": [], "w": 0.0, "d": 0.0}
		wl["x"] = cur.w
		cur.items.append(wl)
		cur.w += wl.w
		cur.d = maxf(cur.d, wl.d)
	rows_out.append(cur)
	var depth := 0.0
	for r in rows_out:
		r["z"] = depth
		depth += r.d
	return {"rows": rows_out, "depth": depth}


func _build_shell() -> void:
	visual = Node3D.new()
	add_child(visual)
	var outer := MeshKit.mat(color, 0.75)
	var trim := MeshKit.mat(color.lightened(0.35), 0.7)
	var parts := [
		[Vector3(W, T, D), Vector3(0, T / 2, 0)],
		[Vector3(W, H, T), Vector3(0, H / 2, D / 2 - T / 2)],
		[Vector3(W, H, T), Vector3(0, H / 2, -D / 2 + T / 2)],
		[Vector3(T, H, D - 2 * T), Vector3(W / 2 - T / 2, H / 2, 0)],
		[Vector3(T, H, D - 2 * T), Vector3(-W / 2 + T / 2, H / 2, 0)],
	]
	for p in parts:
		visual.add_child(MeshKit.mesh_node(MeshKit.box(p[0]), outer, p[1]))
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = p[0]
		cs.shape = bs
		cs.position = p[1]
		add_child(cs)
	visual.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(W + 0.002, 0.02, T + 0.002)), trim, Vector3(0, H - 0.022, D / 2 - T / 2)))
	var front := _label(game_name, 54)
	front.position = Vector3(0, H * 0.45, D / 2 + 0.0015)
	visual.add_child(front)

	lid_pivot = Node3D.new()
	lid_pivot.position = Vector3(0, H, -D / 2)
	lid_pivot.rotation.x = deg_to_rad(-105)
	visual.add_child(lid_pivot)
	var lw := W + 0.012
	var ld := D + 0.012
	lid_pivot.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(lw, T, ld)), outer, Vector3(0, T / 2, ld / 2 - 0.006)))
	lid_pivot.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(lw + 0.002, T + 0.002, 0.07)), trim, Vector3(0, T / 2, ld * 0.66)))
	for s in [-1.0, 1.0]:
		lid_pivot.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(T, 0.04, ld)), outer, Vector3(s * (lw / 2 - T / 2), -0.02 + T, ld / 2 - 0.006)))
	lid_pivot.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(lw, 0.04, T)), outer, Vector3(0, -0.02 + T, ld - 0.012)))
	var top := _label(game_name, 80)
	top.position = Vector3(0, T + 0.0015, ld * 0.38)
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
	ib.size = Vector3(W - 2 * T, H, D - 2 * T)
	ics.shape = ib
	ics.position = Vector3(0, H / 2 + 0.01, 0)
	intake.add_child(ics)
	add_child(intake)
	intake.body_entered.connect(_on_intake)


func _build_insert(layout: Dictionary, id: float) -> void:
	var tray := MeshKit.mat(color.darkened(0.42), 0.9)
	var floor_m := MeshKit.mat(color.darkened(0.62), 0.95)
	var wall_m := MeshKit.mat(color.darkened(0.3), 0.85)
	var ghost_m := StandardMaterial3D.new()
	ghost_m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ghost_m.albedo_color = Color(color.lightened(0.5), 0.2)
	ghost_m.roughness = 1.0
	ghost_m.cull_mode = BaseMaterial3D.CULL_DISABLED

	var x0 := -IW / 2
	var z0 := -id / 2
	visual.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(IW - 0.002, 0.002, id - 0.002)), floor_m, Vector3(0, T + 0.001, 0)))
	for r: Dictionary in layout.rows:
		for wl: Dictionary in r.items:
			var wx: float = x0 + wl.x
			var wz: float = z0 + r.z
			var ww: float = wl.w
			var wd: float = r.d
			# Compartment walls.
			var wt := 0.006
			for e in [[Vector3(ww, WELL_H, wt), Vector3(wx + ww / 2, T + WELL_H / 2, wz + wt / 2)],
					[Vector3(ww, WELL_H, wt), Vector3(wx + ww / 2, T + WELL_H / 2, wz + wd - wt / 2)],
					[Vector3(wt, WELL_H, wd), Vector3(wx + wt / 2, T + WELL_H / 2, wz + wd / 2)],
					[Vector3(wt, WELL_H, wd), Vector3(wx + ww - wt / 2, T + WELL_H / 2, wz + wd / 2)]]:
				visual.add_child(MeshKit.mesh_node(MeshKit.box(e[0]), wall_m, e[1]))
			_make_spots(wl, wx, wz, ghost_m)
		# Solid filler where a row doesn't reach the far side.
		var used: float = r.w
		if used < IW - 0.005:
			visual.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(IW - used, WELL_H, r.d)), tray,
				Vector3(x0 + used + (IW - used) / 2, T + WELL_H / 2, z0 + r.z + r.d / 2)))
	if layout.depth < id - 0.005:
		var rest_d: float = id - layout.depth
		visual.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(IW, WELL_H, rest_d)), tray,
			Vector3(0, T + WELL_H / 2, z0 + layout.depth + rest_d / 2)))


func _make_spots(wl: Dictionary, wx: float, wz: float, ghost_m: Material) -> void:
	var gr: Dictionary = wl.gr
	var bb: AABB = gr.aabb
	var sv: float = wl.sv
	var fx: float = wl.fx
	var fz: float = wl.fz
	var center_off := Vector3(bb.get_center().x, 0, bb.get_center().z) * sv
	var bottom := -bb.position.y * sv
	if gr.type == "cards":
		var p := Vector3(wx + GAP + fx / 2, T, wz + GAP + fz / 2)
		_cards.pos = p
		_cards.scale = sv
		var g: Node3D = MeshKit.card_stack(color, 1)[0]
		MeshKit.ghostify(g, ghost_m)
		g.position = p
		g.scale = Vector3.ONE * sv
		visual.add_child(g)
		_cards.ghost = g
		return
	var cells: int = wl.cells
	for i in gr.n:
		var cell: int = i % cells
		var level: int = i / cells
		var c: int = cell % int(wl.cols)
		var r: int = cell / int(wl.cols)
		var pos := Vector3(wx + GAP + fx / 2 + c * (fx + GAP), T + bottom + level * wl.h, wz + GAP + fz / 2 + r * (fz + GAP)) - center_off
		var spot := {"type": gr.type, "pos": pos, "rot": gr.rest, "scale": sv, "item": null, "ghost": null}
		if level == 0:
			var g: Node3D = MeshKit.piece(gr.type, color)[0]
			MeshKit.ghostify(g, ghost_m)
			g.position = pos
			g.rotation = gr.rest
			g.scale = Vector3.ONE * sv
			visual.add_child(g)
			spot.ghost = g
		spots.append(spot)


func _label(text: String, size: int) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.0009
	l.outline_size = 12
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


func insert_full() -> bool:
	return _cards.have >= _cards.need and spots.all(func(s): return s.item != null)


## Returns "" when the item was taken, otherwise why not:
## "wrong_game", "pieces_first", "board_first" or "done".
func check(item: Item) -> String:
	if complete or item.stored or item == self or item.kind == "box":
		return "done"
	if item.game_id != game_id:
		return "wrong_game"
	if item.kind == "board" and not insert_full():
		return "pieces_first"
	if item.kind == "rules" and _has_board and not board_in:
		return "board_first"
	return ""


func try_accept(item: Item) -> String:
	var why := check(item)
	if why != "":
		return why
	var target_pos: Vector3
	var target_rot := Vector3.ZERO
	var target_scale := Vector3.ONE
	var group_done := false
	var ghost: Node3D = null
	match item.kind:
		"board":
			board_in = true
			target_pos = Vector3(0, T + WELL_H + 0.001, 0)
			target_scale = Vector3(minf(1.0, (IW - 0.02) / MeshKit.BOARD_SIZE), 2.0, minf(0.5, (D - 2 * T - 0.02) / MeshKit.BOARD_SIZE))
			group_done = true
		"rules":
			target_pos = Vector3(0.02, T + WELL_H + 0.034, 0.0)
			target_rot = Vector3(0, 0.06, 0)
			var fit := minf(1.0, (D - 2 * T - 0.02) / 0.27)
			target_scale = Vector3.ONE * fit
			group_done = true
		"cards":
			# Fans and piles all become one neat stack in the card tray.
			for c in item.visual.get_children():
				c.queue_free()
			var stack: Node3D = MeshKit.card_stack(color, item.card_count)[0]
			item.visual.add_child(stack)
			item.visual.scale = Vector3.ONE * item.base_scale
			target_pos = _cards.pos + Vector3(0, _cards.y * _cards.scale, 0)
			target_rot = Vector3(0, randf_range(-0.04, 0.04), 0)
			target_scale = Vector3.ONE * _cards.scale
			_cards.y += item.card_count * MeshKit.CARD.y + 0.0004
			_cards.have += 1
			group_done = _cards.have >= _cards.need
			ghost = _cards.ghost
		_:
			var spot: Dictionary = {}
			for s in spots:
				if s.type == item.piece_type and s.item == null:
					spot = s
					break
			if spot.is_empty():
				return "done"
			spot.item = item
			target_pos = spot.pos
			target_rot = spot.rot
			target_scale = Vector3.ONE * spot.scale
			ghost = spot.ghost
			_group_left[item.piece_type] -= 1
			group_done = _group_left[item.piece_type] == 0

	item.make_passenger()
	item.reparent(contents)
	var mid := item.position.lerp(target_pos, 0.5) + Vector3(0, 0.2, 0)
	var arc := create_tween()
	arc.tween_property(item, "position", mid, 0.18).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	arc.tween_property(item, "position", target_pos, 0.28).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	var tw := create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(item, "rotation", target_rot, 0.42)
	if item.visual:
		tw.tween_property(item.visual, "scale", target_scale, 0.42)
	if ghost:
		var gt := create_tween()
		gt.tween_interval(0.36)
		gt.tween_callback(ghost.hide)

	count += 1
	progress_changed.emit(self, item, group_done)
	if count >= needed:
		complete = true
		_close_lid()
	return ""


func _close_lid() -> void:
	var tw := create_tween()
	tw.tween_interval(0.55)
	tw.tween_property(lid_pivot, "rotation:x", 0.0, 0.55).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func():
		lid_closed = true
		packed.emit(self))
	var hop := create_tween()
	hop.tween_interval(1.1)
	hop.tween_property(visual, "scale", Vector3(1.06, 0.9, 1.06), 0.08)
	hop.tween_property(visual, "scale", Vector3.ONE, 0.25).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)


func shake() -> void:
	var tw := create_tween()
	var base := visual.rotation.y
	for a in [0.1, -0.08, 0.06, -0.03, 0.0]:
		tw.tween_property(visual, "rotation:y", base + a, 0.05)


func _on_intake(body: Node3D) -> void:
	if complete or not (body is Item):
		return
	var it := body as Item
	if it == self or it.held or it.stored or it.kind == "box":
		return
	var why := try_accept(it)
	if why != "" and why != "done":
		it.linear_velocity = Vector3(randf_range(-1.0, 1.0), 2.4, randf_range(-1.0, 1.0))
		shake()
		bounced.emit(self, it, why)
