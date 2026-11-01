class_name MeshKit
extends RefCounted
## Builds every model in the game from code: pieces, boards, textures and materials.

static var _mats := {}


static func mat(c: Color, rough := 0.55, emissive := 0.0) -> StandardMaterial3D:
	var key := "%s|%.2f|%.2f" % [c.to_html(), rough, emissive]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	if emissive > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emissive
	_mats[key] = m
	return m


static func tex_mat(tex: Texture2D, scale := 1.0, rough := 0.7) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = tex
	m.roughness = rough
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3.ONE * scale
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return m


static func mesh_node(mesh: Mesh, m: Material, pos := Vector3.ZERO, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	mi.position = pos
	mi.rotation = rot
	return mi


static func box(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b


static func cyl(r_top: float, r_bottom: float, h: float, seg := 24) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = r_top
	c.bottom_radius = r_bottom
	c.height = h
	c.radial_segments = seg
	c.rings = 1
	return c


static func sphere(r: float, seg := 16) -> SphereMesh:
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0
	s.radial_segments = seg
	s.rings = seg / 2
	return s


## Extrudes a 2D outline (XY plane) along Z, centered on Z = 0.
static func extrude(poly: PackedVector2Array, depth: float) -> ArrayMesh:
	var area := 0.0
	for i in poly.size():
		var a := poly[i]
		var b := poly[(i + 1) % poly.size()]
		area += a.x * b.y - b.x * a.y
	if area < 0.0:
		poly.reverse()
	var tris := Geometry2D.triangulate_polygon(poly)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var h := depth * 0.5
	for z_sign in [1.0, -1.0]:
		for i in tris.size():
			var p := poly[tris[i]]
			st.set_normal(Vector3(0, 0, z_sign))
			st.add_vertex(Vector3(p.x, p.y, h * z_sign))
	for i in poly.size():
		var a := poly[i]
		var b := poly[(i + 1) % poly.size()]
		var e := (b - a).normalized()
		var n := Vector3(e.y, -e.x, 0.0)
		for v in [Vector3(a.x, a.y, h), Vector3(b.x, b.y, h), Vector3(b.x, b.y, -h),
				Vector3(a.x, a.y, h), Vector3(b.x, b.y, -h), Vector3(a.x, a.y, -h)]:
			st.set_normal(n)
			st.add_vertex(v)
	return st.commit()


## Spins a profile of (radius, height) points around the Y axis.
static func lathe(profile: Array, seg := 18) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in profile.size() - 1:
		var p0: Vector2 = profile[i]
		var p1: Vector2 = profile[i + 1]
		var t := p1 - p0
		var n2 := Vector2(t.y, -t.x).normalized()
		for j in seg:
			var a0 := TAU * j / seg
			var a1 := TAU * (j + 1) / seg
			var am := (a0 + a1) * 0.5
			var v00 := Vector3(cos(a0) * p0.x, p0.y, sin(a0) * p0.x)
			var v01 := Vector3(cos(a1) * p0.x, p0.y, sin(a1) * p0.x)
			var v10 := Vector3(cos(a0) * p1.x, p1.y, sin(a0) * p1.x)
			var v11 := Vector3(cos(a1) * p1.x, p1.y, sin(a1) * p1.x)
			for v in [v00, v10, v11, v00, v11, v01]:
				st.set_normal(Vector3(cos(am) * n2.x, n2.y, sin(am) * n2.x))
				st.add_vertex(v)
	return st.commit()


static func meeple_outline(s: float) -> PackedVector2Array:
	var pts := PackedVector2Array([
		Vector2(0.38, 0.0), Vector2(0.18, 0.0), Vector2(0.0, 0.24), Vector2(-0.18, 0.0),
		Vector2(-0.38, 0.0), Vector2(-0.21, 0.42), Vector2(-0.47, 0.47), Vector2(-0.53, 0.56),
		Vector2(-0.43, 0.63), Vector2(-0.14, 0.63),
	])
	for i in 13:
		var a := deg_to_rad(235.0 - i * (290.0 / 12.0))
		pts.append(Vector2(cos(a), sin(a)) * 0.18 + Vector2(0, 0.79))
	pts.append_array(PackedVector2Array([
		Vector2(0.14, 0.63), Vector2(0.43, 0.63), Vector2(0.53, 0.56),
		Vector2(0.47, 0.47), Vector2(0.21, 0.42),
	]))
	for i in pts.size():
		pts[i] = (pts[i] - Vector2(0, 0.48)) * s
	return pts


static func hex_outline(r: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 6:
		var a := TAU * i / 6.0
		pts.append(Vector2(cos(a), sin(a)) * r)
	return pts


## Returns [visual: Node3D, shape: Shape3D, shape_offset: Vector3, rest_rotation: Vector3].
static func piece(type: String, c: Color) -> Array:
	var v := Node3D.new()
	var body := mat(c, 0.42)
	var light := mat(c.lightened(0.45), 0.5)
	var white := mat(Color("fff6ea"), 0.4)
	var shape: Shape3D
	var offset := Vector3.ZERO
	var rest := Vector3.ZERO
	match type:
		"meeple":
			var m := extrude(meeple_outline(0.13), 0.04)
			v.add_child(mesh_node(m, body))
			shape = m.create_convex_shape()
			rest = Vector3(-PI / 2, 0, 0)
		"pawn":
			var prof := [Vector2(0, -0.05), Vector2(0.036, -0.05), Vector2(0.036, -0.038),
				Vector2(0.025, -0.03), Vector2(0.014, 0.01), Vector2(0.024, 0.016),
				Vector2(0.024, 0.021), Vector2(0.0, 0.021)]
			v.add_child(mesh_node(lathe(prof), body))
			v.add_child(mesh_node(sphere(0.021), body, Vector3(0, 0.04, 0)))
			var cs := CylinderShape3D.new()
			cs.radius = 0.034
			cs.height = 0.11
			shape = cs
			offset = Vector3(0, 0.006, 0)
			rest = Vector3(0, 0, PI / 2)
		"die":
			var s := 0.07
			v.add_child(mesh_node(box(Vector3.ONE * s), body))
			var pip := sphere(0.0075, 8)
			var faces := {
				Vector3.UP: 1, Vector3.DOWN: 6, Vector3.RIGHT: 3,
				Vector3.LEFT: 4, Vector3.BACK: 2, Vector3.FORWARD: 5,
			}
			for n: Vector3 in faces:
				var u := Vector3.RIGHT if absf(n.x) < 0.5 else Vector3.BACK
				var w := n.cross(u)
				for p: Vector2 in _pips(faces[n]):
					v.add_child(mesh_node(pip, white, n * (s * 0.5 - 0.001) + u * p.x * 0.019 + w * p.y * 0.019))
			var bs := BoxShape3D.new()
			bs.size = Vector3.ONE * s
			shape = bs
		"card":
			v.add_child(mesh_node(box(Vector3(0.075, 0.005, 0.105)), body))
			v.add_child(mesh_node(box(Vector3(0.06, 0.0012, 0.09)), light, Vector3(0, 0.0028, 0)))
			v.add_child(mesh_node(sphere(0.011, 10), white, Vector3(0, 0.0025, 0), Vector3.ZERO))
			v.get_child(2).scale = Vector3(1, 0.12, 1)
			var bs := BoxShape3D.new()
			bs.size = Vector3(0.075, 0.007, 0.105)
			shape = bs
		"coin":
			v.add_child(mesh_node(cyl(0.034, 0.034, 0.011, 28), body))
			v.add_child(mesh_node(cyl(0.024, 0.024, 0.0122, 28), light))
			var cs := CylinderShape3D.new()
			cs.radius = 0.034
			cs.height = 0.011
			shape = cs
		"hex":
			v.add_child(mesh_node(extrude(hex_outline(0.046), 0.014), body, Vector3.ZERO, Vector3(-PI / 2, 0, 0)))
			v.add_child(mesh_node(extrude(hex_outline(0.03), 0.0152), light, Vector3.ZERO, Vector3(-PI / 2, 0, 0)))
			var cs := CylinderShape3D.new()
			cs.radius = 0.043
			cs.height = 0.014
			shape = cs
		"cube":
			v.add_child(mesh_node(box(Vector3.ONE * 0.048), body))
			var bs := BoxShape3D.new()
			bs.size = Vector3.ONE * 0.048
			shape = bs
		"gem":
			v.add_child(mesh_node(cyl(0.02, 0.034, 0.016, 6), mat(c.lightened(0.15), 0.15), Vector3(0, 0.012, 0)))
			v.add_child(mesh_node(cyl(0.034, 0.0, 0.042, 6), mat(c, 0.15), Vector3(0, -0.017, 0)))
			var cs := CylinderShape3D.new()
			cs.radius = 0.03
			cs.height = 0.058
			shape = cs
			offset = Vector3(0, -0.009, 0)
			rest = Vector3(0, 0, PI / 2)
	return [v, shape, offset, rest]


static func scaled_shape(s: Shape3D, k: float) -> Shape3D:
	if s is BoxShape3D:
		(s as BoxShape3D).size *= k
	elif s is CylinderShape3D:
		(s as CylinderShape3D).radius *= k
		(s as CylinderShape3D).height *= k
	elif s is ConvexPolygonShape3D:
		var pts := (s as ConvexPolygonShape3D).points
		for i in pts.size():
			pts[i] *= k
		(s as ConvexPolygonShape3D).points = pts
	return s


static func _pips(n: int) -> Array:
	match n:
		1: return [Vector2.ZERO]
		2: return [Vector2(-1, -1), Vector2(1, 1)]
		3: return [Vector2(-1, -1), Vector2.ZERO, Vector2(1, 1)]
		4: return [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]
		5: return [Vector2(-1, -1), Vector2(1, -1), Vector2.ZERO, Vector2(-1, 1), Vector2(1, 1)]
	return [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 0), Vector2(1, 0), Vector2(-1, 1), Vector2(1, 1)]


static func board_texture(c: Color, seed_val: int) -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_val
	var n := 256
	var img := Image.create(n, n, false, Image.FORMAT_RGB8)
	var paper := c.lerp(Color("fbf1e1"), 0.84)
	img.fill(paper)
	img.fill_rect(Rect2i(0, 0, n, 14), c)
	img.fill_rect(Rect2i(0, n - 14, n, 14), c)
	img.fill_rect(Rect2i(0, 0, 14, n), c)
	img.fill_rect(Rect2i(n - 14, 0, 14, n), c)
	# A loop of spaces around the edge, like a track.
	var sq := 22
	var gap := 4
	var i := 0
	for k in range(24, n - 24 - sq + 1, sq + gap):
		for p in [Vector2i(k, 24), Vector2i(k, n - 24 - sq), Vector2i(24, k), Vector2i(n - 24 - sq, k)]:
			var col := c if (i % 3) != 0 else c.lightened(0.45)
			if rng.randf() < 0.12:
				col = Color("f3b648")
			img.fill_rect(Rect2i(p.x, p.y, sq, sq), col)
			i += 1
	# A few landmarks in the middle.
	for j in 5:
		var w := rng.randi_range(22, 46)
		var x := rng.randi_range(64, n - 64 - w)
		var y := rng.randi_range(64, n - 64 - w)
		img.fill_rect(Rect2i(x, y, w, w), c.lightened(0.25))
		img.fill_rect(Rect2i(x + 5, y + 5, w - 10, w - 10), c.darkened(0.1))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


static func plank_texture(base: Color, seed_val := 3) -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_val
	var n := 512
	var pw := 64
	var img := Image.create(n, n, false, Image.FORMAT_RGB8)
	for x0 in range(0, n, pw):
		var k := rng.randf_range(0.82, 1.1)
		var tint := Color(base.r * k, base.g * k, base.b * k)
		img.fill_rect(Rect2i(x0, 0, pw, n), tint)
		for g in 9:
			var gx := x0 + rng.randi_range(3, pw - 4)
			img.fill_rect(Rect2i(gx, 0, 1, n), tint.darkened(rng.randf_range(0.04, 0.1)))
		img.fill_rect(Rect2i(x0, 0, 2, n), base.darkened(0.5))
		var cut := rng.randi_range(0, n - 1)
		img.fill_rect(Rect2i(x0, cut, pw, 2), base.darkened(0.5))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


static func stripe_texture(a: Color, b: Color) -> ImageTexture:
	var n := 128
	var img := Image.create(n, n, false, Image.FORMAT_RGB8)
	img.fill(a)
	for x in range(0, n, 32):
		img.fill_rect(Rect2i(x + 12, 0, 8, n), b)
		for y in range(8, n, 32):
			img.fill_rect(Rect2i(x + 28, y, 3, 3), b.darkened(0.15))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)
