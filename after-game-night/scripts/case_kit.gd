class_name CaseKit
extends RefCounted
## The look of every box. Board games come in traditional printed boxes with deep lids and lid art;
## collections come in proper cases: a brass-cornered dice vault, an aluminum chip case,
## a glossy deck vault, a glass-topped display case and a wooden paint chest.

const BOARDGAME := "boardgame"


static func _m(c: Color, rough := 0.6, metal := 0.0, emissive := 0.0) -> StandardMaterial3D:
	var m := MeshKit.mat(c, rough, emissive)
	if metal > 0.0:
		m = MeshKit.metal_mat(c, rough)
	return m


static func _node(parent: Node3D, size: Vector3, m: Material, pos: Vector3, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshKit.mesh_node(MeshKit.box(size), m, pos, rot)
	parent.add_child(mi)
	return mi


static func _label(text: String, size: int, fg: Color, outline: Color, outline_px := 10) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.0009
	l.outline_size = outline_px
	l.modulate = fg
	l.outline_modulate = outline
	l.double_sided = false
	return l


## Materials for the box shell: {outer, trim}.
static func shell_mats(case: String, c: Color, trim: Color) -> Dictionary:
	match case:
		"vault":
			return {"outer": _m(Color("3a2416"), 0.45), "trim": MeshKit.metal_mat(Color("c9a24a"), 0.3)}
		"chipcase":
			# Satin aluminum: only partly metallic, since a fully metal finish has nothing to reflect indoors.
			var al := StandardMaterial3D.new()
			al.albedo_color = Color("c9ced4")
			al.metallic = 0.35
			al.roughness = 0.3
			al.cull_mode = BaseMaterial3D.CULL_DISABLED
			return {"outer": al, "trim": _m(Color("1c1c20"), 0.5)}
		"deckvault":
			var g := StandardMaterial3D.new()
			g.albedo_color = c
			g.roughness = 0.12
			g.clearcoat_enabled = true
			g.clearcoat = 1.0
			g.cull_mode = BaseMaterial3D.CULL_DISABLED
			return {"outer": g, "trim": _m(trim, 0.3)}
		"display":
			return {"outer": _m(Color("6a4428"), 0.4), "trim": MeshKit.metal_mat(Color("c9a24a"), 0.3)}
		"paintchest":
			return {"outer": _m(Color("9a6a3c"), 0.7), "trim": _m(Color("3a2a22"), 0.6)}
	return {"outer": _m(c, 0.75), "trim": _m(trim, 0.6)}


## Materials for the insert: {tray, floor, wall}.
static func insert_mats(case: String, c: Color) -> Dictionary:
	match case:
		"vault":
			return {"tray": _m(c.darkened(0.45), 1.0), "floor": _m(c.darkened(0.6), 1.0), "wall": _m(c.darkened(0.3), 1.0)}
		"chipcase":
			return {"tray": _m(Color("1a1a1c"), 1.0), "floor": _m(Color("111113"), 1.0), "wall": _m(Color("26262a"), 1.0)}
		"deckvault":
			return {"tray": _m(Color("1e1a26"), 1.0), "floor": _m(Color("15121c"), 1.0), "wall": _m(c.darkened(0.5), 0.6)}
		"display":
			return {"tray": _m(Color("1a1418"), 1.0), "floor": _m(Color("120e12"), 1.0), "wall": _m(Color("6a4428"), 0.45)}
		"paintchest":
			return {"tray": _m(Color("c8a070"), 0.8), "floor": _m(Color("b08858"), 0.8), "wall": _m(Color("d8b27c"), 0.75)}
	return {"tray": _m(c.darkened(0.42), 0.9), "floor": _m(c.darkened(0.62), 0.95), "wall": _m(c.darkened(0.3), 0.85)}


## How far the lid's sides reach down over the box.
static func skirt(case: String, h: float) -> float:
	match case:
		BOARDGAME:
			return h * 0.82
		"chipcase", "deckvault":
			return h * 0.45
		"vault", "paintchest":
			return 0.035
		"display":
			return 0.022
	return minf(0.05, h * 0.45)


## Everything on the outside of the box itself: printing, corners, handles, latches.
static func dress_base(case: String, v: Node3D, w: float, h: float, d: float, t: float, c: Color, trim: Material, name: String, ed_idx: int) -> void:
	match case:
		BOARDGAME:
			# A printed band and a little row of "players / age / time" icons, like a real box side.
			_node(v, Vector3(w + 0.002, 0.016, t + 0.002), trim, Vector3(0, h * 0.25, d / 2 - t / 2))
			for i in 3:
				var dot := MeshKit.mesh_node(MeshKit.cyl(0.008, 0.008, 0.002, 12), _m(Color("f4ede0"), 0.5), Vector3(w / 2 - 0.05 - i * 0.025, h * 0.25, d / 2 + 0.002), Vector3(PI / 2, 0, 0))
				v.add_child(dot)
		"vault":
			# Brass corner guards and a clasp plate.
			for sx in [-1.0, 1.0]:
				for sz in [-1.0, 1.0]:
					_node(v, Vector3(0.022, h, 0.022), trim, Vector3(sx * (w / 2 - 0.009), h / 2, sz * (d / 2 - 0.009)))
			_node(v, Vector3(0.05, 0.03, 0.006), trim, Vector3(0, h - 0.02, d / 2 + 0.002))
			_node(v, Vector3(w + 0.004, 0.01, d + 0.004), trim, Vector3(0, 0.005, 0))
		"chipcase":
			# Aluminum edge rails, a carry handle and two latches.
			for y in [0.006, h - 0.006]:
				_node(v, Vector3(w + 0.006, 0.012, 0.012), trim, Vector3(0, y, d / 2))
				_node(v, Vector3(w + 0.006, 0.012, 0.012), trim, Vector3(0, y, -d / 2))
				_node(v, Vector3(0.012, 0.012, d + 0.006), trim, Vector3(w / 2, y, 0))
				_node(v, Vector3(0.012, 0.012, d + 0.006), trim, Vector3(-w / 2, y, 0))
			var handle := MeshKit.mesh_node(MeshKit.torus(0.028, 0.038), _m(Color("1c1c20"), 0.5), Vector3(0, h * 0.45, d / 2 + 0.018), Vector3(PI / 2, 0, 0))
			handle.scale = Vector3(1.6, 1, 1)
			v.add_child(handle)
			for sx in [-1.0, 1.0]:
				_node(v, Vector3(0.04, 0.03, 0.01), MeshKit.metal_mat(Color("e4e8ec"), 0.15), Vector3(sx * w * 0.32, h - 0.018, d / 2 + 0.006))
		"deckvault":
			_node(v, Vector3(w + 0.002, 0.012, d + 0.002), trim, Vector3(0, 0.006, 0))
			var lbl := _label(name, 40, Color("ffffff"), c.darkened(0.6))
			lbl.position = Vector3(0, h * 0.25, d / 2 + 0.0016)
			v.add_child(lbl)
		"display":
			# A brass name plaque on a wooden case.
			_node(v, Vector3(0.24, 0.035, 0.004), trim, Vector3(0, h * 0.45, d / 2 + 0.002))
			var lbl := _label(name, 30, Color("2a1a0e"), Color(0, 0, 0, 0), 0)
			lbl.position = Vector3(0, h * 0.45, d / 2 + 0.0045)
			v.add_child(lbl)
			_node(v, Vector3(w + 0.012, 0.014, d + 0.012), _m(Color("4a2c18"), 0.4), Vector3(0, 0.007, 0))
		"paintchest":
			# Iron corner straps and two leather straps down the front.
			for sx in [-1.0, 1.0]:
				for sz in [-1.0, 1.0]:
					_node(v, Vector3(0.016, h, 0.016), trim, Vector3(sx * (w / 2 - 0.006), h / 2, sz * (d / 2 - 0.006)))
			for sx in [-1.0, 1.0]:
				_node(v, Vector3(0.04, h, 0.006), _m(Color("6a3a1e"), 0.7), Vector3(sx * w * 0.28, h / 2, d / 2 + 0.003))
			var lbl := _label(name, 34, Color("f4e6cc"), Color("2a1a0e"), 6)
			lbl.position = Vector3(0, h * 0.5, d / 2 + 0.002)
			v.add_child(lbl)


## The lid: built at the hinge, extending toward +z, top face up when closed.
static func build_lid(case: String, lid: Node3D, lw: float, ld: float, t: float, sk: float, c: Color, accent: Color, outer: Material, trim: Material,
		name: String, line_id: String, ed_idx: int, seed_val: int) -> void:
	var z0 := ld / 2 - 0.006
	if case == "display":
		# A wooden frame around a glass panel, so the collection stays on show.
		for sx in [-1.0, 1.0]:
			_node(lid, Vector3(0.03, t + 0.004, ld), outer, Vector3(sx * (lw / 2 - 0.015), t / 2, z0))
		for z in [0.015, ld - 0.027]:
			_node(lid, Vector3(lw, t + 0.004, 0.03), outer, Vector3(0, t / 2, z))
		_node(lid, Vector3(lw - 0.05, 0.003, ld - 0.05), MeshKit.glass_mat(Color(0.85, 0.92, 1.0)), Vector3(0, t / 2, z0))
	else:
		_node(lid, Vector3(lw, t, ld), outer, Vector3(0, t / 2, z0))
	# Lid sides.
	for sx in [-1.0, 1.0]:
		_node(lid, Vector3(t, sk, ld), outer, Vector3(sx * (lw / 2 - t / 2), -sk / 2 + t, z0))
	_node(lid, Vector3(lw, sk, t), outer, Vector3(0, -sk / 2 + t, ld - 0.012))
	_node(lid, Vector3(lw, sk, t), outer, Vector3(0, -sk / 2 + t, 0.0))

	match case:
		BOARDGAME:
			# Full-colour lid art, printed edge to edge.
			var art := StandardMaterial3D.new()
			art.albedo_texture = lid_art(line_id, c, accent, ed_idx, seed_val)
			art.roughness = 0.55
			art.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
			var plane := PlaneMesh.new()
			plane.size = Vector2(lw - 0.004, ld - 0.004)
			lid.add_child(MeshKit.mesh_node(plane, art, Vector3(0, t + 0.0012, z0)))
			var title := _label(name, 76 if name.length() < 24 else 58, Color("fff4e4"), c.darkened(0.7), 18)
			title.position = Vector3(0, t + 0.002, z0 + ld * 0.31)
			title.rotation.x = -PI / 2
			lid.add_child(title)
			# The front of the lid is printed too, since that's what faces you on the shelf.
			var front := _label(name, 44, Color("fff4e4"), c.darkened(0.7), 10)
			front.position = Vector3(0, -sk / 2 + t, ld - 0.012 + t / 2 + 0.0015)
			lid.add_child(front)
			_node(lid, Vector3(lw + 0.002, 0.014, t + 0.002), trim, Vector3(0, -sk + t + 0.012, ld - 0.012))
		"vault":
			_node(lid, Vector3(lw - 0.04, 0.004, ld - 0.04), _m(Color("4a2e1c"), 0.4), Vector3(0, t + 0.002, z0))
			for sx in [-1.0, 1.0]:
				for z in [0.012, ld - 0.024]:
					_node(lid, Vector3(0.04, t + 0.004, 0.04), trim, Vector3(sx * (lw / 2 - 0.02), t / 2, z))
			_node(lid, Vector3(0.2, 0.004, 0.06), trim, Vector3(0, t + 0.003, z0 + ld * 0.18))
			var plate := _label(name, 44, Color("2a1a0e"), Color(0, 0, 0, 0), 0)
			plate.position = Vector3(0, t + 0.0055, z0 + ld * 0.18)
			plate.rotation.x = -PI / 2
			lid.add_child(plate)
			# A die-shaped emblem in the middle.
			var gem := MeshKit.mesh_node(MeshKit.cyl(0.035, 0.035, 0.006, 6), _m(c, 0.15, 0.0, 0.6), Vector3(0, t + 0.004, z0 - ld * 0.08))
			lid.add_child(gem)
			_node(lid, Vector3(0.05, 0.03, 0.008), trim, Vector3(0, -0.01, ld - 0.006))
		"chipcase":
			_node(lid, Vector3(lw - 0.03, 0.002, 0.03), _m(accent, 0.3, 0.0, 0.4 if accent.get_luminance() > 0.6 else 0.0), Vector3(0, t + 0.001, z0 + ld * 0.3))
			var plate := _label(name, 50, Color("1c1c20"), Color(0, 0, 0, 0), 0)
			plate.position = Vector3(0, t + 0.0022, z0 - ld * 0.05)
			plate.rotation.x = -PI / 2
			lid.add_child(plate)
			for x in range(-3, 4):
				_node(lid, Vector3(0.01, 0.003, ld - 0.08), _m(Color("b4b9bf"), 0.4, 1.0), Vector3(x * 0.1, t + 0.0005, z0 - ld * 0.05))
		"deckvault":
			# A clear window shows the cards inside; a holographic stripe runs across the lid.
			_node(lid, Vector3(lw * 0.55, 0.003, ld * 0.45), MeshKit.glass_mat(Color(0.9, 0.95, 1.0)), Vector3(0, t + 0.001, z0 - ld * 0.08))
			_node(lid, Vector3(lw, 0.003, 0.05), MeshKit.holo_mat(accent), Vector3(0, t + 0.0012, z0 + ld * 0.32))
			var title := _label(name, 60, Color("ffffff"), c.darkened(0.6), 12)
			title.position = Vector3(0, t + 0.003, z0 + ld * 0.32)
			title.rotation.x = -PI / 2
			lid.add_child(title)
		"display":
			_node(lid, Vector3(0.05, 0.02, 0.012), trim, Vector3(0, -0.006, ld - 0.006))
		"paintchest":
			# A carry handle on top and the leather straps running over the lid.
			var handle := MeshKit.mesh_node(MeshKit.torus(0.035, 0.045), _m(Color("2a1a12"), 0.5), Vector3(0, t + 0.02, z0), Vector3(0, 0, 0))
			handle.rotation = Vector3(0, 0, PI / 2)
			handle.scale = Vector3(1, 1, 1.6)
			lid.add_child(handle)
			for sx in [-1.0, 1.0]:
				_node(lid, Vector3(0.04, 0.004, ld), _m(Color("6a3a1e"), 0.7), Vector3(sx * lw * 0.28, t + 0.002, z0))
				_node(lid, Vector3(0.045, 0.012, 0.01), MeshKit.metal_mat(Color("c9cfd6"), 0.3), Vector3(sx * lw * 0.28, -0.012, ld - 0.004))
			var stencil := _label(name, 56, Color("2a1a0e"), Color(0, 0, 0, 0), 0)
			stencil.position = Vector3(0, t + 0.0012, z0 + ld * 0.25)
			stencil.rotation.x = -PI / 2
			lid.add_child(stencil)
			# A painted swatch row, like a hobbyist's chest.
			var sw := [Color("c8323a"), Color("e8742a"), Color("f2c94e"), Color("4f9e3a"), Color("2a6fb5"), Color("6a3fa0")]
			for i in sw.size():
				lid.add_child(MeshKit.mesh_node(MeshKit.cyl(0.012, 0.012, 0.002, 12), _m(sw[i], 0.4), Vector3(-0.15 + i * 0.06, t + 0.001, z0 - ld * 0.22)))
	if ed_idx > 0 and case == BOARDGAME:
		# Expansions get a corner ribbon so they read differently from the base game.
		_node(lid, Vector3(0.18, 0.003, 0.05), _m(accent, 0.4), Vector3(lw / 2 - 0.06, t + 0.0018, 0.07), Vector3(0, PI / 4, 0))


# ---------------------------------------------------------------- lid art

static func _circle(img: Image, cx: int, cy: int, r: int, col: Color) -> void:
	for y in range(maxi(0, cy - r), mini(img.get_height(), cy + r + 1)):
		var dx := int(sqrt(maxf(0.0, float(r * r - (y - cy) * (y - cy)))))
		img.fill_rect(Rect2i(cx - dx, y, dx * 2 + 1, 1).intersection(Rect2i(0, 0, img.get_width(), img.get_height())), col)


static func _tri(img: Image, ax: int, ay: int, bx: int, by: int, cx: int, cy: int, col: Color) -> void:
	var y0 := mini(ay, mini(by, cy))
	var y1 := maxi(ay, maxi(by, cy))
	var pts := [Vector2(ax, ay), Vector2(bx, by), Vector2(cx, cy)]
	for y in range(maxi(0, y0), mini(img.get_height(), y1 + 1)):
		var xs := []
		for i in 3:
			var p: Vector2 = pts[i]
			var q: Vector2 = pts[(i + 1) % 3]
			if (p.y <= y and q.y > y) or (q.y <= y and p.y > y):
				xs.append(p.x + (y - p.y) * (q.x - p.x) / (q.y - p.y))
		if xs.size() == 2:
			var a := int(minf(xs[0], xs[1]))
			var b := int(maxf(xs[0], xs[1]))
			img.fill_rect(Rect2i(a, y, b - a + 1, 1).intersection(Rect2i(0, 0, img.get_width(), img.get_height())), col)


static func _hex(img: Image, cx: int, cy: int, r: int, col: Color) -> void:
	for i in 6:
		var a0 := TAU * i / 6.0
		var a1 := TAU * (i + 1) / 6.0
		_tri(img, cx, cy, cx + int(cos(a0) * r), cy + int(sin(a0) * r), cx + int(cos(a1) * r), cy + int(sin(a1) * r), col)


static func _star(img: Image, cx: int, cy: int, r: int, col: Color) -> void:
	img.fill_rect(Rect2i(cx - r, cy, r * 2 + 1, 1).intersection(Rect2i(0, 0, img.get_width(), img.get_height())), col)
	img.fill_rect(Rect2i(cx, cy - r, 1, r * 2 + 1).intersection(Rect2i(0, 0, img.get_width(), img.get_height())), col)
	_circle(img, cx, cy, maxi(1, r / 4), col)


## Box-lid illustration: a little scene for each game, a frame and a title banner.
static func lid_art(line_id: String, c: Color, accent: Color, ed_idx: int, seed_val: int) -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_val
	var w := 512
	var h := 320
	var img := Image.create(w, h, false, Image.FORMAT_RGB8)
	var sky_top := c.darkened(0.55)
	var sky_bot := c.lightened(0.12)
	for y in h:
		img.fill_rect(Rect2i(0, y, w, 1), sky_top.lerp(sky_bot, float(y) / h))
	var light := c.lightened(0.45)
	var dark := c.darkened(0.35)
	var gold := Color("f3c860")
	match line_id:
		"crowns":
			for i in 3:
				_circle(img, 80 + i * 180, h + 40, 150, c.darkened(0.15 + i * 0.08))
			var cx := 256
			img.fill_rect(Rect2i(cx - 70, 80, 140, 130), dark)
			for k in 5:
				img.fill_rect(Rect2i(cx - 70 + k * 30, 64, 18, 18), dark)
			img.fill_rect(Rect2i(cx - 110, 50, 40, 160), dark)
			img.fill_rect(Rect2i(cx + 70, 50, 40, 160), dark)
			_tri(img, cx - 115, 50, cx - 65, 50, cx - 90, 10, c.darkened(0.6))
			_tri(img, cx + 65, 50, cx + 115, 50, cx + 90, 10, c.darkened(0.6))
			img.fill_rect(Rect2i(cx - 14, 150, 28, 60), c.darkened(0.7))
			_tri(img, cx - 30, 130, cx + 30, 130, cx, 100, gold)
		"plum":
			_circle(img, 256, 150, 90, light)
			_circle(img, 256, 150, 70, c.darkened(0.2))
			img.fill_rect(Rect2i(150, 230, 212, 16), light)
			_circle(img, 362, 150, 30, light)
			_circle(img, 362, 150, 16, sky_bot)
			for k in 3:
				_circle(img, 230 + k * 25, 60 - k * 12, 6, Color(1, 1, 1, 1).darkened(0.3))
		"atlas":
			for i in 70:
				_star(img, rng.randi_range(0, w), rng.randi_range(0, h), rng.randi_range(1, 4), Color("fff4d8"))
			_circle(img, 330, 130, 70, light)
			_circle(img, 330, 130, 52, c.lightened(0.2))
			img.fill_rect(Rect2i(220, 125, 220, 10), gold)
			_circle(img, 140, 80, 26, gold)
		"harbor":
			_circle(img, 380, 70, 34, Color("fff0c8"))
			for k in 5:
				img.fill_rect(Rect2i(0, 200 + k * 22, w, 12), c.darkened(0.1 + k * 0.08))
			img.fill_rect(Rect2i(180, 180, 150, 22), dark)
			_tri(img, 250, 175, 250, 70, 320, 165, Color("f4ede0"))
			img.fill_rect(Rect2i(248, 70, 4, 110), dark)
			_circle(img, 120, 150, 14, gold)
		"honey":
			for y in range(0, h + 40, 52):
				for x in range(0, w + 60, 60):
					_hex(img, x + (30 if (y / 52) % 2 == 1 else 0), y, 28, c.lightened(0.1) if rng.randf() < 0.7 else gold)
					_hex(img, x + (30 if (y / 52) % 2 == 1 else 0), y, 22, c.darkened(0.15))
		"orchard":
			_circle(img, 420, 60, 30, Color("fff0c8"))
			_circle(img, 256, h + 120, 240, Color("5a8d39"))
			for k in 4:
				var x := 90 + k * 110
				img.fill_rect(Rect2i(x - 6, 150, 12, 60), Color("6a3f1e"))
				_circle(img, x, 130, 46, Color("4f7a32"))
				for a in 5:
					_circle(img, x + rng.randi_range(-30, 30), 120 + rng.randi_range(-25, 25), 6, Color("e0402f"))
		"wyrm":
			_circle(img, 400, 70, 36, Color("ffe0a0"))
			_tri(img, 0, h, 200, 90, 380, h, c.darkened(0.45))
			_tri(img, 180, h, 380, 120, w, h, c.darkened(0.3))
			_tri(img, 260, 150, 340, 120, 300, 90, Color("1a1014"))
			_tri(img, 300, 120, 380, 80, 360, 140, Color("1a1014"))
			_circle(img, 330, 128, 14, Color("1a1014"))
		"caverns":
			img.fill_rect(Rect2i(0, 0, w, h), Color("1c1620"))
			for k in 9:
				var x := 40 + k * 55
				var hh := rng.randi_range(60, 140)
				var col: Color = [Color("9b59d0"), Color("f29bbf"), Color("f2c14e"), Color("7fd1e8")][k % 4]
				_tri(img, x - 20, h, x + 20, h, x, h - hh, col)
				_tri(img, x - 8, h, x + 4, h, x - 2, h - hh + 30, col.lightened(0.4))
		_:
			for i in 12:
				_circle(img, rng.randi_range(0, w), rng.randi_range(0, h), rng.randi_range(10, 50), light if i % 2 == 0 else dark)
	# Title banner and frame.
	img.fill_rect(Rect2i(0, h - 92, w, 70), c.darkened(0.55))
	img.fill_rect(Rect2i(0, h - 96, w, 4), accent)
	img.fill_rect(Rect2i(0, h - 22, w, 4), accent)
	for b in [Rect2i(0, 0, w, 8), Rect2i(0, h - 8, w, 8), Rect2i(0, 0, 8, h), Rect2i(w - 8, 0, 8, h)]:
		img.fill_rect(b, accent)
	if ed_idx > 0:
		_tri(img, w - 120, 0, w, 0, w, 120, accent)
		_tri(img, w - 96, 0, w, 0, w, 96, c.darkened(0.5))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)
