class_name GameBox
extends Item
## One box of a game line (the base game or an expansion), with a fitted insert.
## Every piece has its own spot in a compartment, each card set has its own tray,
## the board folds in on top and the rulebook goes in last.

signal progress_changed(box: GameBox, n: int, group_done: bool)
signal piece_landed(box: GameBox, k: int, at: Vector3)
signal compartment_filled(box: GameBox, at: Vector3)
signal packed(box: GameBox)
signal bounced(box: GameBox, reason: String)

const T := 0.012
const IW := 0.76
const MAX_ID := 0.48
const GAP := 0.007
const TOP_SPACE := 0.05   # room above the insert for the folded board and rulebook

var W := IW + 2 * T
var D := 0.4
var H := 0.15
var well_h := 0.08
var line_id := ""
var ed_id := ""
var game_name := ""
var color := Color.WHITE
var trim_color := Color.WHITE
var accent := Color.WHITE
var case_style := CaseKit.BOARDGAME
var line_id_seed := 0
var _line_short := ""
var units_needed := 0    # pieces + cards + board + rulebook, for the progress readout
var units := 0
var items_needed := 0    # things that have to go in: pieces, card piles, board, rulebook
var items_in := 0
var complete := false
var lid_closed := false
var shelved := false
var board_in := false
var has_board := false
var has_rules := true
var contents: Node3D
var lid_pivot: Node3D

var _spots := {}        # group key -> Array of {xf, ghost, idx, filled}
var _stored := {}       # group key -> MultiMesh of pieces packed away
var _ghost_mm := {}     # group key -> MultiMesh of outlines
var _left := {}         # group key -> pieces still out
var _card_sets := {}    # set name -> {stacks: [{pos, cards}], cap, scale, left, ghost}
var _card_piles_left := 0
var _hidden := Transform3D(Basis.from_scale(Vector3.ZERO), Vector3(0, -50, 0))


# ---------------------------------------------------------------- planning

## entries: [{key, aabb, n}] for piece groups and [{key: "cards:<set>", cards}] for card sets.
static func layout(entries: Array, f: float, wh: float) -> Dictionary:
	var wells := []
	for e: Dictionary in entries:
		var w := {"e": e}
		if e.has("cards"):
			var sv := minf(f, 1.0)
			var cap := maxi(10, int(floor(wh * 0.95 / (MeshKit.CARD.y * sv))))
			var stacks := ceili(float(e.cards) / cap) + (1 if e.cards > cap else 0)
			w.merge({"sv": sv, "fx": MeshKit.CARD.x * sv, "fz": MeshKit.CARD.z * sv, "h": 0.0, "cells": stacks, "cap": cap})
		else:
			var bb: AABB = e.aabb
			var sv := minf(f, wh * 0.92 / maxf(bb.size.y, 0.001))
			var h := bb.size.y * sv
			var per := clampi(int(floor(wh * 0.95 / maxf(h, 0.001))), 1, 12)
			w.merge({"sv": sv, "fx": bb.size.x * sv, "fz": bb.size.z * sv, "h": h, "cells": ceili(float(e.n) / per)})
		var cells: int = w.cells
		var cols := clampi(ceili(sqrt(cells * w.fz / maxf(w.fx, 0.001))), 1, cells)
		cols = mini(cols, maxi(1, int(floor((IW - GAP) / (w.fx + GAP)))))
		var rows := ceili(float(cells) / cols)
		w.merge({"cols": cols, "rows": rows, "w": cols * (w.fx + GAP) + GAP, "d": rows * (w.fz + GAP) + GAP})
		wells.append(w)
	wells.sort_custom(func(a, b): return a.d > b.d)
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
	return {"rows": rows_out, "depth": depth, "f": f, "wh": wh}


## Finds the shallowest insert that fits the contents within the shelf depth.
static func plan(entries: Array) -> Dictionary:
	var f := 0.8
	for attempt in 8:
		var wh := 0.04
		while wh <= 0.2601:
			var l := layout(entries, f, wh)
			if l.depth <= MAX_ID:
				return l
			wh += 0.01
		f *= 0.9
	return layout(entries, f, 0.26)


# ---------------------------------------------------------------- building

func setup(line: Dictionary, ed: Dictionary, ed_idx: int, groups: Array, card_piles: Dictionary, lay: Dictionary, depth: float) -> void:
	line_id = line.id
	ed_id = "%s/%s" % [line.id, ed.id]
	game_name = GameData.full_name(line, ed)
	var style := GameData.edition_style(line.color, ed_idx, ed)
	color = style.body
	trim_color = style.trim
	accent = style.accent
	case_style = line.get("case", CaseKit.BOARDGAME)
	_line_short = line.id
	line_id_seed = ed_id.hash()
	kind = "box"
	label = "%s box" % game_name
	game_id = ed_id
	mass = 0.9
	has_board = ed.board
	has_rules = ed.get("rules", true)
	well_h = lay.wh
	H = T + well_h + TOP_SPACE
	D = depth + 2 * T

	for g in groups:
		var n: int = g.members.size()
		units_needed += n
		items_needed += n
		_left[g.key] = n
	for set_name in card_piles:
		var info: Dictionary = card_piles[set_name]
		units_needed += info.cards
		items_needed += info.piles
		_card_piles_left += info.piles
	units_needed += (1 if has_rules else 0) + (1 if has_board else 0)
	items_needed += (1 if has_rules else 0) + (1 if has_board else 0)

	_build_shell(ed_idx)
	_build_insert(lay, depth, groups, card_piles)


func _build_shell(ed_idx: int) -> void:
	visual = Node3D.new()
	add_child(visual)
	var mats := CaseKit.shell_mats(case_style, color, trim_color)
	var outer: Material = mats.outer
	var trim: Material = mats.trim
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
	CaseKit.dress_base(case_style, visual, W, H, D, T, color, trim, game_name, ed_idx)

	lid_pivot = Node3D.new()
	lid_pivot.position = Vector3(0, H, -D / 2)
	lid_pivot.rotation.x = deg_to_rad(-105)
	visual.add_child(lid_pivot)
	var lw := W + 0.012
	var ld := D + 0.012
	CaseKit.build_lid(case_style, lid_pivot, lw, ld, T, CaseKit.skirt(case_style, H), color, accent, outer, trim,
		game_name, _line_short, ed_idx, line_id_seed)

	contents = Node3D.new()
	contents.name = "Contents"
	add_child(contents)

	var intake := Area3D.new()
	intake.collision_layer = 0
	intake.collision_mask = LAYER_ITEMS | Pieces.LAYER_PHYS
	var ics := CollisionShape3D.new()
	var ib := BoxShape3D.new()
	ib.size = Vector3(W - 2 * T, H, D - 2 * T)
	ics.shape = ib
	ics.position = Vector3(0, H / 2 + 0.01, 0)
	intake.add_child(ics)
	add_child(intake)
	intake.body_entered.connect(_on_intake)


func _build_insert(lay: Dictionary, id: float, groups: Array, card_piles: Dictionary) -> void:
	var im := CaseKit.insert_mats(case_style, color)
	var tray: Material = im.tray
	var floor_m: Material = im.floor
	var wall_m: Material = im.wall
	var ghost_m := StandardMaterial3D.new()
	ghost_m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ghost_m.albedo_color = Color(color.lightened(0.55), 0.18)
	ghost_m.roughness = 1.0
	ghost_m.cull_mode = BaseMaterial3D.CULL_DISABLED
	ghost_m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var by_key := {}
	for g in groups:
		by_key[g.key] = g

	var x0 := -IW / 2
	var z0 := -id / 2
	visual.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(IW - 0.002, 0.002, id - 0.002)), floor_m, Vector3(0, T + 0.001, 0)))
	for r: Dictionary in lay.rows:
		for wl: Dictionary in r.items:
			var wx: float = x0 + wl.x
			var wz: float = z0 + r.z
			var ww: float = wl.w
			var wd: float = r.d
			var wt := 0.005
			for e in [[Vector3(ww, well_h, wt), Vector3(wx + ww / 2, T + well_h / 2, wz + wt / 2)],
					[Vector3(ww, well_h, wt), Vector3(wx + ww / 2, T + well_h / 2, wz + wd - wt / 2)],
					[Vector3(wt, well_h, wd), Vector3(wx + wt / 2, T + well_h / 2, wz + wd / 2)],
					[Vector3(wt, well_h, wd), Vector3(wx + ww - wt / 2, T + well_h / 2, wz + wd / 2)]]:
				visual.add_child(MeshKit.mesh_node(MeshKit.box(e[0]), wall_m, e[1]))
			var key: String = wl.e.key
			if key.begins_with("cards:"):
				_make_card_tray(key.substr(6), wl, wx, wz, card_piles, ghost_m)
			else:
				_make_spots(by_key[key], wl, wx, wz, ghost_m)
		var used: float = r.w
		if used < IW - 0.005:
			visual.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(IW - used, well_h, r.d)), tray,
				Vector3(x0 + used + (IW - used) / 2, T + well_h / 2, z0 + r.z + r.d / 2)))
	if lay.depth < id - 0.005:
		var rest_d: float = id - lay.depth
		visual.add_child(MeshKit.mesh_node(MeshKit.box(Vector3(IW, well_h, rest_d)), tray,
			Vector3(0, T + well_h / 2, z0 + lay.depth + rest_d / 2)))


func _make_spots(g: Pieces.Group, wl: Dictionary, wx: float, wz: float, ghost_m: Material) -> void:
	var bb := g.aabb_rest
	var sv: float = wl.sv
	var fx: float = wl.fx
	var fz: float = wl.fz
	var cells: int = wl.cells
	var cols: int = wl.cols
	var center_off := Vector3(bb.get_center().x, 0, bb.get_center().z) * sv
	var bottom := -bb.position.y * sv
	var basis := Basis.from_euler(g.rest).scaled(Vector3.ONE * sv)
	var n := g.members.size()
	var stored := MultiMesh.new()
	stored.transform_format = MultiMesh.TRANSFORM_3D
	stored.mesh = g.mesh
	stored.instance_count = n
	var ghosts := MultiMesh.new()
	ghosts.transform_format = MultiMesh.TRANSFORM_3D
	ghosts.mesh = g.mesh
	ghosts.instance_count = mini(n, cells)
	var arr := []
	for i in n:
		var cell: int = i % cells
		var level: int = i / cells
		var c: int = cell % cols
		var r: int = cell / cols
		var pos := Vector3(wx + GAP + fx / 2 + c * (fx + GAP), T + bottom + level * float(wl.h), wz + GAP + fz / 2 + r * (fz + GAP)) - center_off
		var xf := Transform3D(basis.rotated(Vector3.UP, randf_range(-0.05, 0.05)), pos)
		stored.set_instance_transform(i, _hidden)
		var gi := -1
		if level == 0:
			gi = cell
			ghosts.set_instance_transform(gi, xf)
		arr.append({"xf": xf, "ghost": gi, "idx": i, "filled": false})
	_spots[g.key] = arr
	_stored[g.key] = stored
	_ghost_mm[g.key] = ghosts
	var smi := MultiMeshInstance3D.new()
	smi.multimesh = stored
	visual.add_child(smi)
	var gmi := MultiMeshInstance3D.new()
	gmi.multimesh = ghosts
	gmi.material_override = ghost_m
	gmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	visual.add_child(gmi)


func _make_card_tray(set_name: String, wl: Dictionary, wx: float, wz: float, card_piles: Dictionary, ghost_m: Material) -> void:
	var info: Dictionary = card_piles[set_name]
	var sv: float = wl.sv
	var fx: float = wl.fx
	var fz: float = wl.fz
	var stacks := []
	var cols: int = wl.cols
	for i in int(wl.cells):
		var c: int = i % cols
		var r: int = i / cols
		stacks.append({"pos": Vector3(wx + GAP + fx / 2 + c * (fx + GAP), T, wz + GAP + fz / 2 + r * (fz + GAP)), "cards": 0})
	var g: Node3D = MeshKit.card_stack(color, 1, info.stripe)[0]
	MeshKit.ghostify(g, ghost_m)
	g.position = stacks[0].pos
	g.scale = Vector3.ONE * sv
	visual.add_child(g)
	_card_sets[set_name] = {"stacks": stacks, "cap": wl.cap, "scale": sv, "left": info.piles, "ghost": g}


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
	return _card_piles_left == 0 and _left.values().all(func(v): return v == 0)


# ---------------------------------------------------------------- packing

## "" if this item may go in now, otherwise why not: "wrong_game", "pieces_first", "board_first" or "done".
func check(item: Item) -> String:
	if complete or item.stored or item == self or item.kind == "box":
		return "done"
	if item.game_id != ed_id:
		return "wrong_game"
	if item.kind == "board" and not insert_full():
		return "pieces_first"
	if item.kind == "rules" and has_board and not board_in:
		return "board_first"
	if item.kind == "rules" and not has_board and not insert_full():
		return "pieces_first"
	return ""


func check_pieces(list: Array) -> String:
	if complete:
		return "done"
	for p: Pieces.P in list:
		if p.g.ed != ed_id:
			return "wrong_game"
	return ""


## Packs a handful of pieces; each flies from its stand-in to its own spot, one after another.
## Takes whatever in a mixed handful belongs in this box; returns the indices it took.
## Everything else stays in the player's hand for the next box.
func sift(list: Array, proxies: Array) -> Array:
	var took := []
	if complete:
		return took
	var mine := []
	var nodes := []
	var room := _left.duplicate()
	for k in list.size():
		var p: Pieces.P = list[k]
		if p.g.ed == ed_id and room.get(p.g.key, 0) > 0:
			room[p.g.key] -= 1
			took.append(k)
			mine.append(p)
			nodes.append(proxies[k])
	if not mine.is_empty():
		accept_pieces(mine, nodes)
	return took


## Packs pieces; each one flies from its stand-in to its own spot, one after another, like pouring.
func accept_pieces(list: Array, proxies: Array) -> String:
	var why := check_pieces(list)
	if why != "":
		return why
	var group_done := false
	var done_keys := []
	var gap := clampf(1.6 / maxf(list.size(), 1), 0.022, 0.05) / pour_speed
	for k in list.size():
		var p: Pieces.P = list[k]
		var proxy: Node3D = proxies[k]
		var spot: Dictionary = {}
		for s in _spots[p.g.key]:
			if not s.filled:
				spot = s
				break
		if spot.is_empty():
			proxy.queue_free()
			continue
		spot.filled = true
		p.state = Pieces.STORED
		_left[p.g.key] -= 1
		if _left[p.g.key] == 0:
			group_done = true
			done_keys.append(p.g.key)
		proxy.reparent(contents)
		# Hop up over the rim, then drop into the spot with a little bounce.
		var above := Transform3D(spot.xf.basis, spot.xf.origin + Vector3(0, H + 0.06, 0))
		var tw := create_tween()
		tw.tween_interval(k * gap)
		tw.tween_property(proxy, "transform", above, 0.16).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		tw.tween_property(proxy, "transform", spot.xf, 0.17).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tw.tween_callback(_land.bind(p.g.key, spot, proxy, k))
	units += list.size()
	items_in += list.size()
	progress_changed.emit(self, list.size(), group_done)
	var end := list.size() * gap + 0.35
	for key in done_keys:
		var c := Vector3.ZERO
		for s in _spots[key]:
			c += s.xf.origin
		c /= maxf(1.0, _spots[key].size())
		var t := create_tween()
		t.tween_interval(end)
		t.tween_callback(func(): compartment_filled.emit(self, contents.to_global(c)))
	_check_done(end)
	return ""


func _land(key: String, spot: Dictionary, proxy: Node3D, k: int) -> void:
	(_stored[key] as MultiMesh).set_instance_transform(spot.idx, spot.xf)
	if spot.ghost >= 0:
		(_ghost_mm[key] as MultiMesh).set_instance_transform(spot.ghost, _hidden)
	var at := proxy.global_position
	proxy.queue_free()
	piece_landed.emit(self, k, at)


## Card piles, the board and the rulebook.
func try_accept(item: Item) -> String:
	var why := check(item)
	if why != "":
		return why
	var target_pos: Vector3
	var target_rot := Vector3.ZERO
	var target_scale := Vector3.ONE
	var group_done := false
	var n_units := 1
	match item.kind:
		"board":
			board_in = true
			target_pos = Vector3(0, T + well_h + 0.001, 0)
			target_scale = Vector3(minf(1.0, (IW - 0.02) / MeshKit.BOARD_SIZE), 2.0, minf(0.5, (D - 2 * T - 0.02) / MeshKit.BOARD_SIZE))
			group_done = true
		"rules":
			target_pos = Vector3(0.02, T + well_h + (0.034 if has_board else 0.008), 0.0)
			target_rot = Vector3(0, 0.06, 0)
			target_scale = Vector3.ONE * minf(1.0, (D - 2 * T - 0.02) / 0.27)
			group_done = true
		"cards":
			var tray: Dictionary = _card_sets[item.card_set]
			var stack: Dictionary = tray.stacks[-1]
			for s in tray.stacks:
				if s.cards + item.card_count <= tray.cap:
					stack = s
					break
			for c in item.visual.get_children():
				c.queue_free()
			item.visual.add_child(MeshKit.card_stack(item.card_back, item.card_count, item.card_stripe, item.card_style)[0])
			item.visual.scale = Vector3.ONE * item.base_scale
			target_pos = stack.pos + Vector3(0, stack.cards * MeshKit.CARD.y * tray.scale, 0)
			target_rot = Vector3(0, randf_range(-0.04, 0.04), 0)
			target_scale = Vector3.ONE * tray.scale
			stack.cards += item.card_count
			tray.left -= 1
			_card_piles_left -= 1
			group_done = tray.left == 0
			n_units = item.card_count
			if tray.ghost:
				tray.ghost.hide()

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
	units += n_units
	items_in += 1
	progress_changed.emit(self, n_units, group_done)
	piece_landed.emit(self, 0, to_global(target_pos))
	_check_done(0.5)
	return ""


func _check_done(delay: float) -> void:
	if items_in >= items_needed and not complete:
		complete = true
		var tw := create_tween()
		tw.tween_interval(delay)
		tw.tween_property(lid_pivot, "rotation:x", 0.0, 0.55).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
		tw.tween_callback(func():
			lid_closed = true
			packed.emit(self))
		var hop := create_tween()
		hop.tween_interval(delay + 0.55)
		hop.tween_property(visual, "scale", Vector3(1.05, 0.92, 1.05), 0.08)
		hop.tween_property(visual, "scale", Vector3.ONE, 0.25).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)


func shake() -> void:
	var tw := create_tween()
	var base := visual.rotation.y
	for a in [0.08, -0.06, 0.045, -0.02, 0.0]:
		tw.tween_property(visual, "rotation:y", base + a, 0.05)


var pieces_ref: Pieces
## Raised by the Quick Pour upgrade.
static var pour_speed := 1.0


func _on_intake(body: Node3D) -> void:
	if complete:
		return
	if body.has_meta("piece") and pieces_ref:
		var p: Pieces.P = body.get_meta("piece")
		if p.state != Pieces.PHYS:
			return
		if p.g.ed == ed_id:
			var got := pieces_ref.claim(body as RigidBody3D)
			if not got.is_empty():
				accept_pieces([got[0]], [got[1]])
		else:
			(body as RigidBody3D).linear_velocity = Vector3(randf_range(-1, 1), 2.2, randf_range(-1, 1))
			shake()
			bounced.emit(self, "wrong_game")
		return
	if not (body is Item):
		return
	var it := body as Item
	if it == self or it.held or it.stored or it.kind == "box":
		return
	var why := try_accept(it)
	if why != "" and why != "done":
		it.linear_velocity = Vector3(randf_range(-1.0, 1.0), 2.4, randf_range(-1.0, 1.0))
		shake()
		bounced.emit(self, why)
