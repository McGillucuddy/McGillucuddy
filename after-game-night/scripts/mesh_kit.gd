class_name MeshKit
extends RefCounted
## Builds every model in the game from code: pieces, cards, boards, rulebooks, textures and materials.

const BOARD_SIZE := 0.5
const CARD := Vector3(0.075, 0.0006, 0.105)

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


static func torus(inner: float, outer: float) -> TorusMesh:
	var t := TorusMesh.new()
	t.inner_radius = inner
	t.outer_radius = outer
	t.rings = 16
	t.ring_segments = 8
	return t


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


static func star_outline(r_out: float, r_in: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 10:
		var a := -PI / 2 + i * PI / 5
		pts.append(Vector2(cos(a), sin(a)) * (r_out if i % 2 == 0 else r_in))
	return pts


static func _cyl_shape(r: float, h: float) -> CylinderShape3D:
	var cs := CylinderShape3D.new()
	cs.radius = r
	cs.height = h
	return cs


static func _box_shape(s: Vector3) -> BoxShape3D:
	var bs := BoxShape3D.new()
	bs.size = s
	return bs


static func _sphere_shape(r: float) -> SphereShape3D:
	var ss := SphereShape3D.new()
	ss.radius = r
	return ss


## Returns [visual: Node3D, shape: Shape3D, shape_offset: Vector3, rest_rotation: Vector3].
## rest_rotation is how the piece lies in its box compartment.
static func piece(type: String, c: Color, accent := Color(0, 0, 0, 0), style := "") -> Array:
	if accent.a == 0.0:
		accent = c.lightened(0.45)
	if DICE.has(type):
		return die(type, c, accent, style)
	if FIGURES.has(type):
		return figurine(type, c, accent)
	var v := Node3D.new()
	var body := mat(c, 0.42)
	var light := mat(accent, 0.5)
	var dark_base := mat(Color("2a2420"), 0.7)
	var skin := mat(Color("e8c39e"), 0.6)
	var white := mat(Color("fff6ea"), 0.4)
	var wood := mat(Color("8a5a34"), 0.7)
	var gold := mat(Color("e8b84a"), 0.3)
	var shape: Shape3D
	var offset := Vector3.ZERO
	var rest := Vector3.ZERO
	match type:
		"meeple":
			var m := extrude(meeple_outline(0.095), 0.032)
			v.add_child(mesh_node(m, body))
			shape = m.create_convex_shape()
			rest = Vector3(-PI / 2, 0, 0)
		"pawn":
			var prof := [Vector2(0, -0.05), Vector2(0.036, -0.05), Vector2(0.036, -0.038),
				Vector2(0.025, -0.03), Vector2(0.014, 0.01), Vector2(0.024, 0.016),
				Vector2(0.024, 0.021), Vector2(0.0, 0.021)]
			v.add_child(mesh_node(lathe(prof), body))
			v.add_child(mesh_node(sphere(0.021), body, Vector3(0, 0.04, 0)))
			shape = _cyl_shape(0.034, 0.11)
			offset = Vector3(0, 0.006, 0)
			rest = Vector3(0, 0, PI / 2)
		"die":
			var s := 0.056
			v.add_child(mesh_node(rounded_cube(s, s * 0.14), body))
			var faces := {
				Vector3.UP: 1, Vector3.DOWN: 6, Vector3.RIGHT: 3,
				Vector3.LEFT: 4, Vector3.BACK: 2, Vector3.FORWARD: 5,
			}
			var quads := []
			for n: Vector3 in faces:
				var u := Vector3.RIGHT if absf(n.x) < 0.5 else Vector3.BACK
				var w := n.cross(u)
				for p: Vector2 in _pips(faces[n]):
					quads.append([n * (s * 0.5 + 0.0002) + u * p.x * s * 0.27 + w * p.y * s * 0.27, n, w, s * 0.2, Rect2(0, 0, 1, 1)])
			var pip_ink := Color("fbf3e4") if c.get_luminance() < 0.6 else Color("2a1d17")
			v.add_child(mesh_node(_glyph_quads(quads), _pip_mat(pip_ink)))
			shape = _box_shape(Vector3.ONE * s)
		"coin":
			v.add_child(mesh_node(cyl(0.034, 0.034, 0.011, 28), body))
			v.add_child(mesh_node(cyl(0.024, 0.024, 0.0122, 28), light))
			v.add_child(mesh_node(cyl(0.008, 0.008, 0.0126, 6), gold))
			shape = _cyl_shape(0.034, 0.011)
		"hex":
			v.add_child(mesh_node(extrude(hex_outline(0.046), 0.014), body, Vector3.ZERO, Vector3(-PI / 2, 0, 0)))
			v.add_child(mesh_node(extrude(hex_outline(0.03), 0.0152), light, Vector3.ZERO, Vector3(-PI / 2, 0, 0)))
			v.add_child(mesh_node(extrude(hex_outline(0.012), 0.016), gold, Vector3.ZERO, Vector3(-PI / 2, 0, 0)))
			shape = _cyl_shape(0.043, 0.014)
		"cube":
			v.add_child(mesh_node(box(Vector3.ONE * 0.048), body))
			shape = _box_shape(Vector3.ONE * 0.048)
		"gem":
			v.add_child(mesh_node(cyl(0.02, 0.034, 0.016, 6), mat(c.lightened(0.15), 0.15), Vector3(0, 0.012, 0)))
			v.add_child(mesh_node(cyl(0.034, 0.0, 0.042, 6), mat(c, 0.15), Vector3(0, -0.017, 0)))
			shape = _cyl_shape(0.03, 0.058)
			offset = Vector3(0, -0.009, 0)
			rest = Vector3(0, 0, PI / 2)
		"boat":
			var hull := PackedVector2Array([Vector2(-0.048, 0.012), Vector2(0.048, 0.012), Vector2(0.034, -0.012), Vector2(-0.032, -0.012)])
			v.add_child(mesh_node(extrude(hull, 0.03), body))
			v.add_child(mesh_node(box(Vector3(0.088, 0.003, 0.026)), wood, Vector3(0, 0.0125, 0)))
			v.add_child(mesh_node(cyl(0.003, 0.003, 0.075), wood, Vector3(0, 0.048, 0)))
			var sail := PackedVector2Array([Vector2(0.004, 0.02), Vector2(0.004, 0.083), Vector2(0.04, 0.026)])
			v.add_child(mesh_node(extrude(sail, 0.003), mat(Color("fbf1e1"), 0.8)))
			v.add_child(mesh_node(box(Vector3(0.018, 0.01, 0.002)), light, Vector3(-0.002, 0.083, 0)))
			shape = _box_shape(Vector3(0.096, 0.095, 0.03))
			offset = Vector3(0, 0.035, 0)
			rest = Vector3(-PI / 2, 0, 0)
		"lantern":
			var prof := [Vector2(0, -0.03), Vector2(0.019, -0.03), Vector2(0.019, -0.025), Vector2(0.014, -0.022),
				Vector2(0.014, 0.016), Vector2(0.021, 0.019), Vector2(0.009, 0.03), Vector2(0, 0.03)]
			v.add_child(mesh_node(lathe(prof, 8), body))
			v.add_child(mesh_node(sphere(0.0115, 10), mat(Color("ffcf7a"), 0.3, 3.5), Vector3(0, -0.003, 0)))
			v.add_child(mesh_node(torus(0.006, 0.009), gold, Vector3(0, 0.036, 0), Vector3(PI / 2, 0, 0)))
			shape = _cyl_shape(0.021, 0.066)
			offset = Vector3(0, 0.003, 0)
			rest = Vector3(0, 0, PI / 2)
		"apple":
			var a := mesh_node(sphere(0.029, 16), mat(c.lightened(0.08), 0.35))
			a.scale = Vector3(1, 0.88, 1)
			v.add_child(a)
			v.add_child(mesh_node(cyl(0.0025, 0.003, 0.016), wood, Vector3(0, 0.03, 0)))
			var leaf := mesh_node(sphere(0.011, 8), mat(Color("5a8d39"), 0.6), Vector3(0.009, 0.031, 0), Vector3(0, 0, -0.5))
			leaf.scale = Vector3(1, 0.25, 0.55)
			v.add_child(leaf)
			shape = _sphere_shape(0.028)
		"basket":
			var prof := [Vector2(0, -0.02), Vector2(0.026, -0.02), Vector2(0.036, 0.016), Vector2(0.032, 0.016),
				Vector2(0.023, -0.016), Vector2(0, -0.016)]
			v.add_child(mesh_node(lathe(prof, 14), mat(Color("c8975a"), 0.85)))
			v.add_child(mesh_node(cyl(0.0345, 0.0335, 0.008, 14), body, Vector3(0, 0.008, 0)))
			v.add_child(mesh_node(torus(0.031, 0.035), mat(Color("a8763f"), 0.85), Vector3(0, 0.016, 0), Vector3(PI / 2, 0, 0)))
			shape = _cyl_shape(0.036, 0.04)
		"star":
			v.add_child(mesh_node(extrude(star_outline(0.04, 0.017), 0.012), mat(c.lightened(0.2), 0.35), Vector3.ZERO, Vector3(-PI / 2, 0, 0)))
			v.add_child(mesh_node(extrude(star_outline(0.018, 0.008), 0.0135), gold, Vector3.ZERO, Vector3(-PI / 2, 0, 0)))
			shape = _cyl_shape(0.036, 0.012)
		"planet":
			v.add_child(mesh_node(sphere(0.027, 18), body))
			v.add_child(mesh_node(cyl(0.01, 0.01, 0.0005), light, Vector3(0, 0.0, 0)))
			var ring := mesh_node(torus(0.034, 0.046), mat(Color("f0d9a8"), 0.4), Vector3.ZERO, Vector3(0.35, 0, 0.2))
			ring.scale = Vector3(1, 0.15, 1)
			v.add_child(ring)
			shape = _sphere_shape(0.03)
		"crown":
			v.add_child(mesh_node(cyl(0.028, 0.03, 0.022, 20), mat(c.lightened(0.1), 0.3)))
			v.add_child(mesh_node(cyl(0.0305, 0.0305, 0.006, 20), gold, Vector3(0, -0.008, 0)))
			for i in 5:
				var a := TAU * i / 5.0
				v.add_child(mesh_node(cyl(0.0, 0.009, 0.022, 6), mat(c.lightened(0.1), 0.3), Vector3(cos(a) * 0.022, 0.022, sin(a) * 0.022)))
				v.add_child(mesh_node(sphere(0.0045, 8), gold, Vector3(cos(a) * 0.022, 0.034, sin(a) * 0.022)))
			shape = _cyl_shape(0.031, 0.05)
			offset = Vector3(0, 0.012, 0)
		"tower":
			v.add_child(mesh_node(cyl(0.021, 0.024, 0.06, 14), mat(Color("b9b2a2"), 0.85)))
			v.add_child(mesh_node(cyl(0.026, 0.026, 0.012, 14), body, Vector3(0, 0.034, 0)))
			for i in 6:
				var a := TAU * i / 6.0
				v.add_child(mesh_node(box(Vector3(0.012, 0.012, 0.012)), body, Vector3(cos(a) * 0.02, 0.046, sin(a) * 0.02), Vector3(0, -a, 0)))
			v.add_child(mesh_node(box(Vector3(0.012, 0.018, 0.003)), mat(Color("3a2a20"), 0.9), Vector3(0, -0.02, 0.023)))
			shape = _cyl_shape(0.026, 0.104)
			offset = Vector3(0, 0.0, 0)
			rest = Vector3(0, 0, PI / 2)
		"bee":
			var b := mesh_node(sphere(0.02, 14), mat(c.lightened(0.05), 0.4))
			b.scale = Vector3(1.35, 1, 1)
			v.add_child(b)
			for x in [-0.008, 0.006]:
				v.add_child(mesh_node(cyl(0.0202, 0.0202, 0.006, 14), mat(Color("3a2414"), 0.6), Vector3(x, 0, 0), Vector3(0, 0, PI / 2)))
			v.add_child(mesh_node(sphere(0.012, 10), mat(Color("3a2414"), 0.6), Vector3(0.027, 0.004, 0)))
			for s in [-1.0, 1.0]:
				var wing := mesh_node(sphere(0.015, 10), mat(Color("f4f2ff"), 0.3), Vector3(-0.002, 0.02, s * 0.012), Vector3(0, 0, 0.3))
				wing.scale = Vector3(1, 0.2, 0.6)
				v.add_child(wing)
			shape = _sphere_shape(0.024)
		"honey":
			var drop := mat(c.lightened(0.1), 0.08, 0.35)
			v.add_child(mesh_node(sphere(0.02, 14), drop, Vector3(0, -0.006, 0)))
			v.add_child(mesh_node(cyl(0.0, 0.0185, 0.026, 14), drop, Vector3(0, 0.014, 0)))
			shape = _sphere_shape(0.021)
			offset = Vector3(0, -0.004, 0)
		"teacup":
			var prof := [Vector2(0, -0.016), Vector2(0.016, -0.016), Vector2(0.025, 0.017), Vector2(0.022, 0.017),
				Vector2(0.014, -0.012), Vector2(0, -0.012)]
			v.add_child(mesh_node(lathe(prof, 16), body))
			v.add_child(mesh_node(cyl(0.021, 0.021, 0.001, 16), mat(Color("6b3a1e"), 0.15), Vector3(0, 0.012, 0)))
			v.add_child(mesh_node(cyl(0.033, 0.03, 0.004, 20), white, Vector3(0, -0.019, 0)))
			v.add_child(mesh_node(torus(0.006, 0.0095), body, Vector3(0.026, 0.002, 0), Vector3(PI / 2, 0, 0)))
			shape = _cyl_shape(0.033, 0.04)
			offset = Vector3(0, -0.001, 0)
		"slime":
			var goo := StandardMaterial3D.new()
			goo.albedo_color = c.lightened(0.15)
			goo.roughness = 0.05
			goo.emission_enabled = true
			goo.emission = c.lightened(0.2)
			goo.emission_energy_multiplier = 0.6
			goo.rim_enabled = true
			goo.rim = 0.7
			goo.cull_mode = BaseMaterial3D.CULL_DISABLED
			var blob := mesh_node(sphere(0.017, 12), goo)
			blob.scale = Vector3(1.25, 0.8, 1.25)
			v.add_child(blob)
			var top := mesh_node(sphere(0.008, 8), goo, Vector3(0.002, 0.011, 0))
			v.add_child(top)
			for sx in [-1.0, 1.0]:
				v.add_child(mesh_node(sphere(0.0032, 6), mat(Color("ffffff"), 0.3), Vector3(sx * 0.0055, 0.006, 0.013)))
				v.add_child(mesh_node(sphere(0.0017, 6), mat(Color("120a10"), 0.3), Vector3(sx * 0.0055, 0.006, 0.0158)))
			shape = _sphere_shape(0.018)
			offset = Vector3(0, -0.002, 0)
		"tile":
			var stone := mat(Color("8d8678").lerp(c, 0.12), 0.9)
			v.add_child(mesh_node(box(Vector3(0.052, 0.006, 0.052)), stone))
			var grout := mat(Color("4a443c"), 0.95)
			for k in [-1.0, 1.0]:
				v.add_child(mesh_node(box(Vector3(0.052, 0.0062, 0.0015)), grout, Vector3(0, 0, k * 0.009)))
			v.add_child(mesh_node(box(Vector3(0.0015, 0.0062, 0.052)), grout, Vector3(0.0, 0, 0)))
			v.add_child(mesh_node(cyl(0.004, 0.004, 0.0066, 8), mat(accent, 0.4, 0.4), Vector3(0.016, 0, 0.018)))
			shape = _box_shape(Vector3(0.052, 0.006, 0.052))
		"chest":
			var oak := mat(Color("7a4a26"), 0.75)
			v.add_child(mesh_node(box(Vector3(0.034, 0.018, 0.024)), oak))
			var lid := mesh_node(cyl(0.012, 0.012, 0.034, 10), oak, Vector3(0, 0.009, 0), Vector3(0, 0, PI / 2))
			lid.scale = Vector3(1, 1, 1)
			v.add_child(lid)
			for x in [-0.011, 0.011]:
				v.add_child(mesh_node(box(Vector3(0.004, 0.032, 0.0255)), gold, Vector3(x, 0.004, 0)))
			v.add_child(mesh_node(box(Vector3(0.006, 0.007, 0.002)), gold, Vector3(0, 0.006, 0.0125)))
			v.add_child(mesh_node(box(Vector3(0.03, 0.003, 0.02)), body, Vector3(0, -0.0105, 0)))
			shape = _box_shape(Vector3(0.035, 0.034, 0.026))
			offset = Vector3(0, 0.004, 0)
		"potion":
			var glass := StandardMaterial3D.new()
			glass.albedo_color = Color(0.92, 0.95, 1.0, 0.35)
			glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			glass.roughness = 0.04
			glass.rim_enabled = true
			glass.cull_mode = BaseMaterial3D.CULL_DISABLED
			var prof := [Vector2(0, -0.02), Vector2(0.012, -0.02), Vector2(0.014, -0.01), Vector2(0.012, 0.002),
				Vector2(0.0045, 0.008), Vector2(0.0045, 0.016), Vector2(0.0, 0.016)]
			v.add_child(mesh_node(sphere(0.0105, 10), mat(accent, 0.2, 1.2), Vector3(0, -0.009, 0)))
			v.add_child(mesh_node(lathe(prof, 12), glass))
			v.add_child(mesh_node(cyl(0.0045, 0.004, 0.006, 8), wood, Vector3(0, 0.019, 0)))
			v.add_child(mesh_node(cyl(0.0125, 0.0125, 0.004, 12), body, Vector3(0, -0.006, 0)))
			shape = _cyl_shape(0.014, 0.044)
			offset = Vector3(0, -0.001, 0)
			rest = Vector3(0, 0, PI / 2)
		"chip", "plaque", "dealer":
			return casino_piece(type, c, accent, style)
		"toploader", "deckbox", "counter":
			return ccg_piece(type, c, accent, style)
		"shard", "cluster", "geode", "cutgem":
			return crystal_piece(type, c)
		"cateye", "shooter", "pearl", "steelie", "galaxymarble":
			return marble_piece(type, c)
		"pot", "dropper", "brush", "spray":
			return paint_piece(type, c, style)
		"cake":
			var wedge := PackedVector2Array([Vector2(-0.03, 0.0), Vector2(0.03, -0.024), Vector2(0.03, 0.024)])
			v.add_child(mesh_node(extrude(wedge, 0.028), mat(Color("e9c48f"), 0.8), Vector3.ZERO, Vector3(-PI / 2, 0, 0)))
			v.add_child(mesh_node(extrude(wedge, 0.008), mat(c.lightened(0.2), 0.5), Vector3(0, 0.017, 0), Vector3(-PI / 2, 0, 0)))
			v.add_child(mesh_node(extrude(wedge, 0.004), mat(c, 0.5), Vector3(0, 0.001, 0), Vector3(-PI / 2, 0, 0)))
			v.add_child(mesh_node(sphere(0.007, 10), mat(Color("c8202e"), 0.3), Vector3(0.018, 0.026, 0)))
			shape = _box_shape(Vector3(0.062, 0.042, 0.05))
			offset = Vector3(0, 0.006, 0)
	return [v, shape, offset, rest]


static func _pips(n: int) -> Array:
	match n:
		1: return [Vector2.ZERO]
		2: return [Vector2(-1, -1), Vector2(1, 1)]
		3: return [Vector2(-1, -1), Vector2.ZERO, Vector2(1, 1)]
		4: return [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]
		5: return [Vector2(-1, -1), Vector2(1, -1), Vector2.ZERO, Vector2(-1, 1), Vector2(1, 1)]
	return [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 0), Vector2(1, 0), Vector2(-1, 1), Vector2(1, 1)]


# ---------------------------------------------------------------- cards and books

## A single card face up: plain white card stock with a printed face on top.
static func _face_card(face: Material) -> Node3D:
	var n := Node3D.new()
	n.add_child(mesh_node(box(CARD), mat(Color("fbf1e1"), 0.6)))
	var plane := PlaneMesh.new()
	plane.size = Vector2(CARD.x - 0.002, CARD.z - 0.002)
	n.add_child(mesh_node(plane, face, Vector3(0, CARD.y / 2 + 0.0002, 0)))
	return n


static func _card(c: Color, stripe: Color, style := "") -> Node3D:
	var n := Node3D.new()
	if style == "neon":
		n.add_child(mesh_node(box(CARD), mat(Color("121018"), 0.4)))
		n.add_child(mesh_node(box(Vector3(0.071, 0.0005, 0.101)), mat(stripe, 0.3, 2.2), Vector3(0, 0.0008, 0)))
		n.add_child(mesh_node(box(Vector3(0.066, 0.0005, 0.096)), mat(Color("17131f"), 0.3), Vector3(0, 0.0009, 0)))
		n.add_child(mesh_node(cyl(0.016, 0.016, 0.0005, 6), mat(c, 0.3, 2.5), Vector3(0, 0.0011, 0)))
		n.add_child(mesh_node(box(Vector3(0.05, 0.0006, 0.003)), mat(stripe, 0.3, 2.5), Vector3(0, 0.0011, 0.03)))
		return n
	n.add_child(mesh_node(box(CARD), mat(Color("fbf1e1"), 0.6)))
	n.add_child(mesh_node(box(Vector3(0.069, 0.0005, 0.099)), mat(c, 0.5), Vector3(0, 0.0008, 0)))
	if style == "holo":
		n.add_child(mesh_node(box(Vector3(0.06, 0.0005, 0.09)), holo_mat(c), Vector3(0, 0.0009, 0)))
		n.add_child(mesh_node(cyl(0.012, 0.012, 0.0005, 8), mat(stripe, 0.3, 0.6), Vector3(0, 0.0011, 0)))
		return n
	if style == "casino":
		n.add_child(mesh_node(box(Vector3(0.062, 0.0005, 0.092)), mat(Color("fbf1e1"), 0.5), Vector3(0, 0.0009, 0)))
		for k in 5:
			n.add_child(mesh_node(box(Vector3(0.058, 0.0006, 0.004)), mat(c, 0.5), Vector3(0, 0.001, -0.036 + k * 0.018), Vector3(0, 0.6, 0)))
		return n
	n.add_child(mesh_node(box(Vector3(0.048, 0.0005, 0.076)), mat(c.lightened(0.3), 0.5), Vector3(0, 0.0009, 0)))
	n.add_child(mesh_node(box(Vector3(0.069, 0.0006, 0.014)), mat(stripe, 0.4), Vector3(0, 0.001, -0.036)))
	n.add_child(mesh_node(cyl(0.011, 0.011, 0.0005, 12), mat(stripe, 0.3), Vector3(0, 0.0011, 0)))
	return n


## A fanned hand of cards. With faces, it's laid down face up so you can see every card.
static func card_hand(c: Color, count: int, stripe: Color, style := "", faces: Array = []) -> Array:
	var v := Node3D.new()
	for i in count:
		var pivot := Node3D.new()
		pivot.position = Vector3(0, i * 0.0022, 0.035)
		pivot.rotation.y = (i - (count - 1) / 2.0) * 0.26
		var card := _face_card(faces[(i * 3) % faces.size()]) if not faces.is_empty() else _card(c, stripe, style)
		card.position = Vector3(0, 0, -0.04)
		pivot.add_child(card)
		v.add_child(pivot)
	return [v, _box_shape(Vector3(0.12, 0.004 + count * 0.0022, 0.11)), Vector3(0, count * 0.001, -0.005), Vector3.ZERO]


## Cards dealt out in an overlapping row, face up, like a tableau mid-game.
static func card_spread(count: int, faces: Array) -> Array:
	var v := Node3D.new()
	var step := 0.034
	var w := step * (count - 1) + CARD.x
	for i in count:
		var card := _face_card(faces[(i * 5) % faces.size()])
		card.position = Vector3(-w / 2 + CARD.x / 2 + i * step, i * 0.0009, 0)
		card.rotation.y = (i % 2) * 0.03 - 0.015
		v.add_child(card)
	return [v, _box_shape(Vector3(w, 0.004 + count * 0.0009, CARD.z)), Vector3(0, count * 0.00045, 0), Vector3.ZERO]


## A neat stack of cards: a draw pile, or how cards sit once they're put away.
## Given a face, the top card is turned face up.
static func card_stack(c: Color, count: int, stripe: Color, style := "", face: Material = null) -> Array:
	var v := Node3D.new()
	var h := count * CARD.y
	v.add_child(mesh_node(box(Vector3(CARD.x, h, CARD.z)), mat(Color("f4ead8"), 0.7), Vector3(0, h / 2, 0)))
	# Stripes down the side of the stack so you can tell sets apart from any angle.
	v.add_child(mesh_node(box(Vector3(CARD.x + 0.001, h * 0.9, 0.012)), mat(stripe.darkened(0.15), 0.6), Vector3(0, h / 2, -0.036)))
	var top := _face_card(face) if face else _card(c, stripe, style)
	top.position = Vector3(0, h, 0)
	v.add_child(top)
	return [v, _box_shape(Vector3(CARD.x, h + 0.002, CARD.z)), Vector3(0, h / 2, 0), Vector3.ZERO]


## A rulebook with a printed cover (logo and a RULEBOOK band) when cover art is given.
static func rulebook(c: Color, game_name: String, cover: Texture2D = null, band: Texture2D = null) -> Array:
	var v := Node3D.new()
	v.add_child(mesh_node(box(Vector3(0.19, 0.008, 0.26)), mat(Color("f4ead8"), 0.85), Vector3(0.004, 0.0, 0)))
	v.add_child(mesh_node(box(Vector3(0.2, 0.003, 0.27)), mat(c.darkened(0.15), 0.6), Vector3(0, 0.0055, 0)))
	v.add_child(mesh_node(box(Vector3(0.2, 0.003, 0.27)), mat(c.darkened(0.15), 0.6), Vector3(0, -0.0055, 0)))
	if cover:
		for t in [[cover, Vector2(0.196, 0.266), Vector3(0, 0.0073, 0)], [band, Vector2(0.17, 0.027), Vector3(0, 0.0076, 0.105)]]:
			if t[0] == null:
				continue
			var m := StandardMaterial3D.new()
			m.albedo_texture = t[0]
			m.roughness = 0.55
			var pm := PlaneMesh.new()
			pm.size = t[1]
			var mi := mesh_node(pm, m, t[2])
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			v.add_child(mi)
	return [v, _box_shape(Vector3(0.2, 0.014, 0.27)), Vector3.ZERO, Vector3.ZERO]


static func board(c: Color, seed_val: int) -> Array:
	var v := Node3D.new()
	var s := BOARD_SIZE
	v.add_child(mesh_node(box(Vector3(s, 0.012, s)), mat(c.darkened(0.25), 0.7)))
	# The fold line down the middle, like a real board.
	v.add_child(mesh_node(box(Vector3(0.002, 0.0125, s)), mat(c.darkened(0.5), 0.7)))
	var top := StandardMaterial3D.new()
	top.albedo_texture = board_texture(c, seed_val)
	top.roughness = 0.75
	top.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	var plane := PlaneMesh.new()
	plane.size = Vector2(s - 0.012, s - 0.012)
	v.add_child(mesh_node(plane, top, Vector3(0, 0.0065, 0)))
	return [v, _box_shape(Vector3(s, 0.012, s)), Vector3.ZERO, Vector3.ZERO]


## Merges a model into one mesh with one surface per material, so it can be drawn in batches.
static func bake(v: Node3D, s: float, only: Material = null) -> ArrayMesh:
	var tools := {}
	var order: Array = []
	var todo := [[v, Transform3D(Basis.from_scale(Vector3.ONE * s))]]
	while not todo.is_empty():
		var e: Array = todo.pop_back()
		var node: Node = e[0]
		var xf: Transform3D = e[1]
		for c in node.get_children():
			if not (c is Node3D):
				continue
			var cx: Transform3D = xf * (c as Node3D).transform
			if c is MeshInstance3D and (c as MeshInstance3D).mesh:
				var m: Material = only if only else (c as MeshInstance3D).material_override
				if not tools.has(m):
					var st := SurfaceTool.new()
					st.begin(Mesh.PRIMITIVE_TRIANGLES)
					tools[m] = st
					order.append(m)
				_append(tools[m], (c as MeshInstance3D).mesh, cx, m is BaseMaterial3D and (m as BaseMaterial3D).albedo_texture != null)
			todo.append([c, cx])
	var out := ArrayMesh.new()
	for m in order:
		(tools[m] as SurfaceTool).commit(out)
		out.surface_set_material(out.get_surface_count() - 1, m)
	return out


static func _append(st: SurfaceTool, mesh: Mesh, xf: Transform3D, uvs := false) -> void:
	var nb := xf.basis.inverse().transposed()
	for si in mesh.get_surface_count():
		var arr := mesh.surface_get_arrays(si)
		var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var norms: PackedVector3Array = arr[Mesh.ARRAY_NORMAL] if arr[Mesh.ARRAY_NORMAL] != null else PackedVector3Array()
		var uv: PackedVector2Array = arr[Mesh.ARRAY_TEX_UV] if arr[Mesh.ARRAY_TEX_UV] != null else PackedVector2Array()
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array()
		var has_n := norms.size() == verts.size()
		var has_uv := uvs and uv.size() == verts.size()
		var order := idx if not idx.is_empty() else PackedInt32Array(range(verts.size()))
		for i in order:
			st.set_normal((nb * norms[i]).normalized() if has_n else Vector3.UP)
			if uvs:
				st.set_uv(uv[i] if has_uv else Vector2.ZERO)
			st.add_vertex(xf * verts[i])


static func scaled_aabb(bb: AABB, s: float) -> AABB:
	return AABB(bb.position * s, bb.size * s)


## Turns any model into a see-through outline of where it belongs.
static func ghostify(n: Node, m: Material) -> void:
	for c in n.get_children():
		if c is MeshInstance3D:
			(c as MeshInstance3D).material_override = m
			(c as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		elif c is Label3D:
			c.queue_free()
			continue
		ghostify(c, m)


## The bounding box of a model's meshes after a rotation, ignoring the model's own scale.
static func visual_aabb(v: Node3D, rot: Vector3) -> AABB:
	var out := AABB()
	var first := true
	var todo := [[v, Transform3D(Basis.from_euler(rot))]]
	while not todo.is_empty():
		var e: Array = todo.pop_back()
		var node: Node3D = e[0]
		var xf: Transform3D = e[1]
		for c in node.get_children():
			if not (c is Node3D):
				continue
			var cx: Transform3D = xf * (c as Node3D).transform
			if c is MeshInstance3D and (c as MeshInstance3D).mesh:
				var bb: AABB = cx * (c as MeshInstance3D).mesh.get_aabb()
				out = bb if first else out.merge(bb)
				first = false
			todo.append([c, cx])
	return out


static func scaled_shape(s: Shape3D, k: float) -> Shape3D:
	if s is BoxShape3D:
		(s as BoxShape3D).size *= k
	elif s is CylinderShape3D:
		(s as CylinderShape3D).radius *= k
		(s as CylinderShape3D).height *= k
	elif s is SphereShape3D:
		(s as SphereShape3D).radius *= k
	elif s is ConvexPolygonShape3D:
		var pts := (s as ConvexPolygonShape3D).points
		for i in pts.size():
			pts[i] *= k
		(s as ConvexPolygonShape3D).points = pts
	return s


# ---------------------------------------------------------------- textures

const _BOARD_PX := 256
const _SQ := 22


## Centers of the track spaces painted on a board, in board-local meters (x, z).
static func board_spaces() -> Array:
	var out := []
	var n := _BOARD_PX
	var ps := BOARD_SIZE - 0.012
	for k in range(24, n - 24 - _SQ + 1, _SQ + 4):
		for p in [Vector2(k, 24), Vector2(k, n - 24 - _SQ), Vector2(24, k), Vector2(n - 24 - _SQ, k)]:
			var cpx: Vector2 = (p + Vector2(_SQ / 2.0, _SQ / 2.0)) / n - Vector2(0.5, 0.5)
			out.append(cpx * ps)
	return out


static func board_texture(c: Color, seed_val: int) -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_val
	var n := _BOARD_PX
	var img := Image.create(n, n, false, Image.FORMAT_RGB8)
	var paper := c.lerp(Color("fbf1e1"), 0.84)
	img.fill(paper)
	img.fill_rect(Rect2i(0, 0, n, 14), c)
	img.fill_rect(Rect2i(0, n - 14, n, 14), c)
	img.fill_rect(Rect2i(0, 0, 14, n), c)
	img.fill_rect(Rect2i(n - 14, 0, 14, n), c)
	var i := 0
	for k in range(24, n - 24 - _SQ + 1, _SQ + 4):
		for p in [Vector2i(k, 24), Vector2i(k, n - 24 - _SQ), Vector2i(24, k), Vector2i(n - 24 - _SQ, k)]:
			var col := c if (i % 3) != 0 else c.lightened(0.45)
			if rng.randf() < 0.12:
				col = Color("f3b648")
			img.fill_rect(Rect2i(p.x, p.y, _SQ, _SQ), c.darkened(0.35))
			img.fill_rect(Rect2i(p.x + 2, p.y + 2, _SQ - 4, _SQ - 4), col)
			i += 1
	# Regions in the middle: little islands, fields or rooms depending on the game.
	for j in 6:
		var w := rng.randi_range(24, 50)
		var x := rng.randi_range(62, n - 62 - w)
		var y := rng.randi_range(62, n - 62 - w)
		img.fill_rect(Rect2i(x, y, w, w), c.lightened(0.25))
		img.fill_rect(Rect2i(x + 5, y + 5, w - 10, w - 10), c.darkened(0.1))
		img.fill_rect(Rect2i(x + w / 2 - 3, y + w / 2 - 3, 6, 6), Color("f3b648"))
	# Dotted paths connecting them.
	for j in 40:
		var x := rng.randi_range(60, n - 60)
		var y := rng.randi_range(60, n - 60)
		img.fill_rect(Rect2i(x, y, 3, 3), c.darkened(0.3))
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


static func brick_texture() -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	var n := 256
	var bh := 32
	var bw := 64
	var img := Image.create(n, n, false, Image.FORMAT_RGB8)
	img.fill(Color("4a3b34"))
	var reds := [Color("8e4632"), Color("7a3b2b"), Color("9c5539"), Color("6e3527"), Color("a0624a")]
	var row := 0
	for y in range(0, n, bh):
		var off := 0 if row % 2 == 0 else bw / 2
		for x in range(-bw, n + bw, bw):
			var col: Color = reds[rng.randi_range(0, reds.size() - 1)]
			img.fill_rect(Rect2i(x + off + 2, y + 2, bw - 4, bh - 4).intersection(Rect2i(0, 0, n, n)), col)
		row += 1
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


# ---------------------------------------------------------------- polyhedral dice

const DICE := ["d4", "d6p", "d8", "d10", "d10p", "d12", "d20"]
const _PHI := 1.6180339887

static var _style_mats := {}


## Finishes for dice: each style has its own body material and ink for the numerals.
static func dice_mats(style: String, c: Color, ink: Color) -> Array:
	var key := "%s|%s|%s" % [style, c.to_html(), ink.to_html()]
	if _style_mats.has(key):
		return _style_mats[key]
	var b := StandardMaterial3D.new()
	b.albedo_color = c
	b.cull_mode = BaseMaterial3D.CULL_DISABLED
	b.roughness = 0.25
	b.clearcoat_enabled = true
	b.clearcoat = 0.8
	var i := StandardMaterial3D.new()
	i.albedo_color = ink
	i.cull_mode = BaseMaterial3D.CULL_DISABLED
	i.roughness = 0.4
	match style:
		"ember":
			b.roughness = 0.15
			b.emission_enabled = true
			b.emission = c
			b.emission_energy_multiplier = 0.45
			i.emission_enabled = true
			i.emission = ink
			i.emission_energy_multiplier = 1.2
		"frost":
			b.roughness = 0.04
			b.rim_enabled = true
			b.rim = 1.0
			b.rim_tint = 0.2
			b.metallic = 0.15
		"galaxy":
			b.roughness = 0.12
			b.metallic = 0.25
			b.emission_enabled = true
			b.emission = c.lightened(0.25)
			b.emission_energy_multiplier = 0.35
			i.emission_enabled = true
			i.emission = ink
			i.emission_energy_multiplier = 1.5
		"jade":
			b.roughness = 0.28
			i.metallic = 0.55
			i.roughness = 0.3
			i.emission_enabled = true
			i.emission = ink
			i.emission_energy_multiplier = 0.25
			i.roughness = 0.25
		"bone":
			b.roughness = 0.6
			b.clearcoat_enabled = false
		"obsidian":
			b.roughness = 0.06
			b.metallic = 0.35
			i.emission_enabled = true
			i.emission = ink
			i.emission_energy_multiplier = 1.6
	_style_mats[key] = [b, i]
	return [b, i]


static func _norm_all(pts: Array) -> Array:
	return pts.map(func(p: Vector3): return p.normalized())


static func _faces_from_normals(verts: Array, normals: Array) -> Array:
	var faces := []
	for n0: Vector3 in normals:
		var n := n0.normalized()
		var best := -INF
		for v: Vector3 in verts:
			best = maxf(best, v.dot(n))
		var f := []
		for v: Vector3 in verts:
			if v.dot(n) > best - 0.0005:
				f.append(v)
		faces.append(_sort_face(f, n))
	return faces


static func _sort_face(f: Array, n: Vector3) -> Array:
	var c := Vector3.ZERO
	for v: Vector3 in f:
		c += v
	c /= f.size()
	var u := ((f[0] as Vector3) - c).normalized()
	var w := n.cross(u)
	f.sort_custom(func(a: Vector3, b: Vector3): return atan2((a - c).dot(w), (a - c).dot(u)) < atan2((b - c).dot(w), (b - c).dot(u)))
	return f


static func _poly_faces(type: String) -> Array:
	var p := _PHI
	var ico := [Vector3(0, 1, p), Vector3(0, 1, -p), Vector3(0, -1, p), Vector3(0, -1, -p),
		Vector3(1, p, 0), Vector3(1, -p, 0), Vector3(-1, p, 0), Vector3(-1, -p, 0),
		Vector3(p, 0, 1), Vector3(p, 0, -1), Vector3(-p, 0, 1), Vector3(-p, 0, -1)]
	var dod := []
	for x in [-1.0, 1.0]:
		for y in [-1.0, 1.0]:
			for z in [-1.0, 1.0]:
				dod.append(Vector3(x, y, z))
	for a in [-1.0, 1.0]:
		for b in [-1.0, 1.0]:
			# Permuted to match the icosahedron above, so each one's faces line up with the other's corners.
			dod.append(Vector3(0, a * p, b / p))
			dod.append(Vector3(a * p, b / p, 0))
			dod.append(Vector3(a / p, 0, b * p))
	match type:
		"d4":
			var v := _norm_all([Vector3(1, 1, 1), Vector3(1, -1, -1), Vector3(-1, 1, -1), Vector3(-1, -1, 1)])
			return _faces_from_normals(v, v.map(func(x: Vector3): return -x))
		"d6p":
			return _faces_from_normals(_norm_all(dod.slice(0, 8)), [Vector3.UP, Vector3.DOWN, Vector3.LEFT, Vector3.RIGHT, Vector3.FORWARD, Vector3.BACK])
		"d8":
			return _faces_from_normals([Vector3.UP, Vector3.DOWN, Vector3.LEFT, Vector3.RIGHT, Vector3.FORWARD, Vector3.BACK], dod.slice(0, 8))
		"d12":
			return _faces_from_normals(_norm_all(dod), ico)
		"d20":
			return _faces_from_normals(_norm_all(ico), dod)
	# d10 and the percentile die: a pentagonal trapezohedron, built from its kites.
	var cs := cos(PI / 5.0)
	var h := 1.0
	var e := h * (1.0 - cs) / (1.0 + cs)
	var top := Vector3(0, h, 0)
	var bot := Vector3(0, -h, 0)
	var up := []
	var lo := []
	for i in 5:
		var a := TAU * i / 5.0
		up.append(Vector3(cos(a), e, sin(a)))
		var b := a + PI / 5.0
		lo.append(Vector3(cos(b), -e, sin(b)))
	var faces := []
	for i in 5:
		var j := (i + 1) % 5
		faces.append([top, up[i], lo[i], up[j]])
		faces.append([bot, lo[i], up[j], lo[j]])
	return faces


## A polyhedral die with inked numerals, resting on one face.
static func die(type: String, c: Color, ink: Color, style: String) -> Array:
	var r := {"d4": 0.027, "d6p": 0.021, "d8": 0.022, "d10": 0.021, "d10p": 0.021, "d12": 0.022, "d20": 0.023}[type] as float
	var faces := _poly_faces(type)
	# Turn it so the first face lies flat on the table.
	var n0 := _face_normal(faces[0])
	var turn := Basis(Quaternion(n0, Vector3.DOWN))
	var ms := dice_mats(style if style != "" else "bone", c, ink)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts := PackedVector3Array()
	var v := Node3D.new()
	var ink_bits := []
	for f: Array in faces:
		var fv := f.map(func(p: Vector3): return turn * p * r)
		var n := _face_normal(fv)
		for i in range(1, fv.size() - 1):
			for q in [fv[0], fv[i], fv[i + 1]]:
				st.set_normal(n)
				st.add_vertex(q)
		for q in fv:
			pts.append(q)
		var cen := Vector3.ZERO
		for q: Vector3 in fv:
			cen += q
		cen /= fv.size()
		var reach := INF
		for q: Vector3 in fv:
			reach = minf(reach, cen.distance_to(q))
		ink_bits.append([cen, n, reach])
	v.add_child(mesh_node(st.commit(), ms[0]))
	# Numerals printed on every face (opposite faces add up, like real dice); a d4 reads at its corners.
	v.add_child(mesh_node(_glyph_quads(_numerals(type, faces.map(func(f: Array): return f.map(func(p: Vector3): return turn * p * r)))), numeral_mat(ms[1], c)))
	if style == "galaxy":
		var speck := mat(Color("ffffff"), 0.3, 4.0)
		var rng := RandomNumberGenerator.new()
		rng.seed = type.hash()
		for i in 7:
			var p: Vector3 = pts[rng.randi_range(0, pts.size() - 1)].lerp(pts[rng.randi_range(0, pts.size() - 1)], 0.5)
			v.add_child(mesh_node(sphere(0.0011, 4), speck, p * 1.01))
	var shape := ConvexPolygonShape3D.new()
	shape.points = pts
	return [v, shape, Vector3.ZERO, Vector3.ZERO]


## A cube with softly rounded edges: the faces are inset and joined by bevels whose normals blend
## from one face to the next, so the edges catch the light like a real moulded die.
static func rounded_cube(size: float, bevel: float) -> ArrayMesh:
	var h := size * 0.5
	var k := h - bevel
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var polys := []
	for ax in 3:
		for sa in [-1.0, 1.0]:
			var f := []
			for c in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
				f.append(_rc(ax, sa, c, h, k))
			polys.append(f)
	for ax in 3:
		for bx in range(ax + 1, 3):
			var third := 3 - ax - bx
			for sa in [-1.0, 1.0]:
				for sb in [-1.0, 1.0]:
					var f := []
					for t in [-1.0, 1.0]:
						var p := Vector3.ZERO
						p[ax] = sa * h
						p[bx] = sb * k
						p[third] = t * k
						f.append(p)
					for t in [1.0, -1.0]:
						var p := Vector3.ZERO
						p[ax] = sa * k
						p[bx] = sb * h
						p[third] = t * k
						f.append(p)
					polys.append(f)
	for sx in [-1.0, 1.0]:
		for sy in [-1.0, 1.0]:
			for sz in [-1.0, 1.0]:
				polys.append([Vector3(sx * h, sy * k, sz * k), Vector3(sx * k, sy * h, sz * k), Vector3(sx * k, sy * k, sz * h)])
	for f: Array in polys:
		var n := _face_normal(f)
		var a: Vector3 = f[0]
		for i in range(1, f.size() - 1):
			var b: Vector3 = f[i]
			var c: Vector3 = f[i + 1]
			var tri := [a, b, c] if (b - a).cross(c - a).dot(n) < 0.0 else [a, c, b]
			for q: Vector3 in tri:
				# The normal of a vertex is the face it sits on, so bevels shade smoothly.
				var vn := Vector3.ZERO
				for ax in 3:
					if absf(absf(q[ax]) - h) < 1e-6:
						vn[ax] = signf(q[ax])
				st.set_normal(vn.normalized())
				st.add_vertex(q)
	return st.commit()


static func _rc(ax: int, sa: float, c: Vector2, h: float, k: float) -> Vector3:
	var p := Vector3.ZERO
	p[ax] = sa * h
	p[(ax + 1) % 3] = c.x * k
	p[(ax + 2) % 3] = c.y * k
	return p


## Flat textured squares lying on a surface: [centre, normal, up, size, uv rect] each.
static func _glyph_quads(list: Array) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for q: Array in list:
		var c: Vector3 = q[0]
		var n: Vector3 = q[1]
		var up: Vector3 = (q[2] as Vector3).normalized()
		var right := n.cross(up).normalized()
		var hs: float = q[3] * 0.5
		var r: Rect2 = q[4]
		var corners := [[-1.0, 1.0], [1.0, 1.0], [1.0, -1.0], [-1.0, -1.0]]
		for i in [0, 1, 2, 0, 2, 3]:
			var cx: float = corners[i][0]
			var cy: float = corners[i][1]
			st.set_normal(n)
			st.set_uv(r.position + Vector2((cx + 1.0) * 0.5, (1.0 + cy) * 0.5) * r.size)
			st.add_vertex(c + right * cx * hs + up * cy * hs)
	return st.commit()


static var _pip_tex: ImageTexture
static var _numeral_vp: SubViewport
static var _numeral_cells := {}
const NUMERAL_COLS := 6
const NUMERAL_CELL := 128


## A drilled, painted pip: a disc whose inside is shaded like a shallow dimple.
static func _pip_mat(ink: Color) -> StandardMaterial3D:
	var key := "pip" + ink.to_html()
	if _special.has(key):
		return _special[key]
	if _pip_tex == null:
		var n := 64
		var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
		var c := Vector2(n, n) * 0.5
		var rad := n * 0.46
		for y in n:
			for x in n:
				var d := (Vector2(x + 0.5, y + 0.5) - c) / rad
				var dist := d.length()
				var a := clampf((1.0 - dist) * rad * 0.8, 0.0, 1.0)
				# Light comes from the top left, so the dimple's top-left wall is in shadow
				# and the bottom-right wall catches the light; a dark ring marks the drilled edge.
				var shade := 0.9 + 0.12 * d.dot(Vector2(0.6, 0.8)) * dist
				shade *= lerpf(1.0, 0.7, smoothstep(0.8, 1.0, dist))
				img.set_pixel(x, y, Color(shade, shade, shade, a))
		_pip_tex = ImageTexture.create_from_image(img)
	var m := StandardMaterial3D.new()
	m.albedo_texture = _pip_tex
	m.albedo_color = ink
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	m.alpha_scissor_threshold = 0.4
	m.roughness = 0.75
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_special[key] = m
	return m


## The ink for printed numerals: the die's own ink material, with the numeral sheet as its texture.
static func numeral_mat(ink: Material, body: Color) -> Material:
	var key := "num%d%s" % [ink.get_instance_id(), body.to_html()]
	if _special.has(key):
		return _special[key]
	var m: StandardMaterial3D = (ink as StandardMaterial3D).duplicate()
	# Numerals always stand out from the die: dark ink on pale dice, light ink on dark ones.
	if absf(m.albedo_color.get_luminance() - body.get_luminance()) < 0.35:
		m.albedo_color = Color("1d2a44") if body.get_luminance() > 0.5 else Color("fbf3e4")
		if m.emission_enabled:
			m.emission = m.albedo_color
	m.albedo_texture = _numeral_sheet()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	m.alpha_scissor_threshold = 0.45
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	_special[key] = m
	return m


## One sheet with every numeral a die can show, rendered once from real font glyphs.
static func _numeral_sheet() -> Texture2D:
	if _numeral_vp:
		return _numeral_vp.get_texture()
	var keys := []
	for i in 21:
		keys.append(str(i))
	for t in ["00", "30", "40", "50", "60", "70", "80", "90"]:
		keys.append(t)
	var rows := ceili(keys.size() / float(NUMERAL_COLS))
	var vp := SubViewport.new()
	vp.size = Vector2i(NUMERAL_COLS * NUMERAL_CELL, rows * NUMERAL_CELL)
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	var font: Font = load("res://fonts/alfa-slab-one-latin-400-normal.woff2")
	for i in keys.size():
		var t: String = keys[i]
		var cell := Vector2(i % NUMERAL_COLS, i / NUMERAL_COLS) * NUMERAL_CELL
		var fs := 84
		while fs > 20 and font.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > NUMERAL_CELL * 0.86:
			fs -= 2
		var ls := LabelSettings.new()
		ls.font = font
		ls.font_size = fs
		ls.font_color = Color.WHITE
		var l := Label.new()
		l.text = t
		l.label_settings = ls
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		l.position = cell
		l.size = Vector2(NUMERAL_CELL, NUMERAL_CELL * 0.92)
		vp.add_child(l)
		if t == "6" or t == "9":
			# Underlined so a 6 and a 9 can't be mixed up, as on real dice.
			var bar := ColorRect.new()
			bar.color = Color.WHITE
			bar.size = Vector2(NUMERAL_CELL * 0.32, NUMERAL_CELL * 0.07)
			bar.position = cell + Vector2(NUMERAL_CELL * 0.34, NUMERAL_CELL * 0.82)
			vp.add_child(bar)
		_numeral_cells[t] = Rect2(cell / Vector2(vp.size), Vector2(NUMERAL_CELL, NUMERAL_CELL) / Vector2(vp.size))
	(Engine.get_main_loop() as SceneTree).root.add_child.call_deferred(vp)
	_numeral_vp = vp
	return vp.get_texture()


## Where every numeral goes on a polyhedral die. Faces are in final (posed, scaled) coordinates.
static func _numerals(type: String, faces: Array) -> Array:
	_numeral_sheet()
	var out := []
	var info := []
	for f: Array in faces:
		var cen := Vector3.ZERO
		for q: Vector3 in f:
			cen += q
		cen /= f.size()
		var reach := INF
		for i in f.size():
			var a: Vector3 = f[i]
			var b: Vector3 = f[(i + 1) % f.size()]
			var e := (b - a).normalized()
			reach = minf(reach, ((cen - a) - e * (cen - a).dot(e)).length())
		info.append([cen, _face_normal(f), reach])
	if type == "d4":
		# Each corner has one number, printed near that corner on all three faces that meet there.
		var corners := []
		for f: Array in faces:
			for q: Vector3 in f:
				if corners.all(func(o: Vector3): return o.distance_to(q) > 1e-5):
					corners.append(q)
		for fi in faces.size():
			var cen: Vector3 = info[fi][0]
			for q: Vector3 in faces[fi]:
				var val := 1
				for ci in corners.size():
					if (corners[ci] as Vector3).distance_to(q) < 1e-5:
						val = ci + 1
				out.append([cen + (q - cen) * 0.5 + info[fi][1] * 0.0002, info[fi][1], q - cen, info[fi][2] * 1.3, _numeral_cells[str(val)]])
		return out
	var n := faces.size()
	var vals := []
	vals.resize(n)
	var next := 0
	for i in n:
		if vals[i] != null:
			continue
		var opp := -1
		for j in n:
			if j != i and vals[j] == null and (info[i][1] as Vector3).dot(info[j][1]) < -0.99:
				opp = j
		vals[i] = next
		if opp >= 0:
			vals[opp] = n - 1 - next
		next += 1
	for i in n:
		var f: Array = faces[i]
		var cen: Vector3 = info[i][0]
		var nrm: Vector3 = info[i][1]
		var v: int = vals[i]
		var text := str(v + 1)
		if type == "d10":
			text = str(v)
		elif type == "d10p":
			text = "00" if v == 0 else str(v * 10)
		# Upright towards the face's far tip (kites, triangles, pentagons), or an edge for squares.
		var far: Vector3 = f[0]
		for q: Vector3 in f:
			if q.distance_to(cen) > far.distance_to(cen) + 1e-6:
				far = q
		var up := far - cen
		if f.size() == 4 and absf((f[0] as Vector3).distance_to(cen) - (f[1] as Vector3).distance_to(cen)) < 1e-6 and absf((f[0] as Vector3).distance_to(f[1]) - (f[1] as Vector3).distance_to(f[2])) < 1e-6:
			up = ((f[0] as Vector3) + (f[1] as Vector3)) * 0.5 - cen
		var at := cen
		var size: float = info[i][2] * 1.55
		if type == "d10" or type == "d10p":
			at = cen + up * 0.12
			size = info[i][2] * (1.45 if type == "d10" else 1.6)
		out.append([at + nrm * 0.0002, nrm, up, size, _numeral_cells[text]])
	return out


static func _face_normal(f: Array) -> Vector3:
	var c := Vector3.ZERO
	for p: Vector3 in f:
		c += p
	c /= f.size()
	var n := ((f[1] as Vector3) - (f[0] as Vector3)).cross((f[2] as Vector3) - (f[0] as Vector3)).normalized()
	return -n if n.dot(c) < 0.0 else n


# ---------------------------------------------------------------- holographic and special materials

static var _holo_shader: Shader
static var _special := {}


## A foil that shifts through the rainbow as you move around it.
static func holo_mat(c: Color) -> ShaderMaterial:
	var key := "holo" + c.to_html()
	if _special.has(key):
		return _special[key]
	if _holo_shader == null:
		_holo_shader = Shader.new()
		_holo_shader.code = """
shader_type spatial;
render_mode cull_disabled;
uniform vec3 base_color : source_color = vec3(0.6);
void fragment() {
	vec3 wn = (INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz;
	vec3 wv = (INV_VIEW_MATRIX * vec4(VIEW, 0.0)).xyz;
	vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float band = fract(dot(wv, vec3(1.3, 0.7, 1.1)) * 1.4 + (wp.x + wp.z) * 9.0 + dot(wn, wv) * 0.6);
	vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (band + vec3(0.0, 0.33, 0.67)));
	ALBEDO = mix(base_color, rainbow, 0.6);
	METALLIC = 0.7;
	ROUGHNESS = 0.15;
	EMISSION = rainbow * 0.35;
}
"""
	var m := ShaderMaterial.new()
	m.shader = _holo_shader
	m.set_shader_parameter("base_color", c)
	_special[key] = m
	return m


static func crystal_mat(c: Color) -> StandardMaterial3D:
	var key := "crystal" + c.to_html()
	if _special.has(key):
		return _special[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(c, 0.62)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.roughness = 0.04
	m.metallic = 0.1
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = 0.9
	m.rim_enabled = true
	m.rim = 1.0
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_special[key] = m
	return m


static func glass_mat(tint := Color(0.9, 0.95, 1.0)) -> StandardMaterial3D:
	var key := "glass" + tint.to_html()
	if _special.has(key):
		return _special[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(tint, 0.28)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.roughness = 0.02
	m.metallic = 0.2
	m.rim_enabled = true
	m.rim = 1.0
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_special[key] = m
	return m


static func metal_mat(c: Color, rough := 0.22) -> StandardMaterial3D:
	var key := "metal%s%.2f" % [c.to_html(), rough]
	if _special.has(key):
		return _special[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.metallic = 1.0
	m.roughness = rough
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_special[key] = m
	return m



# ---------------------------------------------------------------- casino

## A clay poker chip with edge spots and a printed inlay, a high-roller plaque, or the dealer button.
static func casino_piece(type: String, c: Color, accent: Color, style: String) -> Array:
	var v := Node3D.new()
	var spot_m := mat(accent, 0.4, 2.2 if style == "neon" else 0.0)
	if style == "royale":
		spot_m = metal_mat(Color("e8b84a"), 0.25)
	match type:
		"chip":
			var r := 0.024
			var h := 0.0048
			v.add_child(mesh_node(cyl(r, r, h, 28), mat(c, 0.55)))
			# Edge spots, the classic casino stripe pattern.
			for i in 6:
				var a := TAU * i / 6.0
				var spot := mesh_node(box(Vector3(0.0075, h + 0.0004, 0.006)), spot_m, Vector3(cos(a) * (r - 0.0025), 0, sin(a) * (r - 0.0025)), Vector3(0, -a, 0))
				v.add_child(spot)
			v.add_child(mesh_node(cyl(0.0135, 0.0135, h + 0.0006, 24), mat(c.lightened(0.55), 0.5)))
			v.add_child(mesh_node(torus(0.0105, 0.0118), spot_m if style != "classic" else mat(c.darkened(0.2), 0.5), Vector3(0, h / 2 + 0.0003, 0), Vector3.ZERO))
			v.get_child(v.get_child_count() - 1).scale = Vector3(1, 0.08, 1)
			v.add_child(mesh_node(cyl(0.004, 0.004, h + 0.0009, 5), mat(c, 0.5), Vector3.ZERO))
			return [v, _cyl_shape(r, h), Vector3.ZERO, Vector3.ZERO]
		"plaque":
			v.add_child(mesh_node(box(Vector3(0.06, 0.005, 0.04)), mat(c, 0.15)))
			v.add_child(mesh_node(box(Vector3(0.05, 0.0056, 0.03)), mat(c.lightened(0.5), 0.1)))
			for sx in [-1.0, 1.0]:
				v.add_child(mesh_node(box(Vector3(0.006, 0.006, 0.04)), spot_m, Vector3(sx * 0.024, 0, 0)))
			return [v, _box_shape(Vector3(0.06, 0.006, 0.04)), Vector3.ZERO, Vector3.ZERO]
	# dealer button
	v.add_child(mesh_node(cyl(0.028, 0.028, 0.009, 28), mat(Color("f4f0e6"), 0.4)))
	v.add_child(mesh_node(torus(0.019, 0.023), mat(Color("1a1a1a"), 0.4), Vector3(0, 0.0045, 0)))
	v.get_child(1).scale = Vector3(1, 0.1, 1)
	v.add_child(mesh_node(box(Vector3(0.004, 0.0095, 0.016)), mat(Color("1a1a1a"), 0.4), Vector3(-0.004, 0, 0)))
	v.add_child(mesh_node(cyl(0.007, 0.007, 0.0095, 12), mat(Color("1a1a1a"), 0.4), Vector3(0.0, 0, 0)))
	return [v, _cyl_shape(0.028, 0.009), Vector3.ZERO, Vector3.ZERO]


# ---------------------------------------------------------------- trading card game extras

static func ccg_piece(type: String, c: Color, accent: Color, style: String) -> Array:
	var v := Node3D.new()
	match type:
		"toploader":
			# A foil card sealed in a clear rigid case.
			v.add_child(mesh_node(box(Vector3(0.07, 0.0012, 0.098)), holo_mat(c) if style != "neon" else mat(c, 0.3, 2.0)))
			v.add_child(mesh_node(box(Vector3(0.05, 0.0014, 0.04)), mat(accent, 0.3, 0.4), Vector3(0, 0.0, -0.018)))
			v.add_child(mesh_node(box(Vector3(0.078, 0.004, 0.108)), glass_mat(), Vector3(0, 0, 0.002)))
			return [v, _box_shape(Vector3(0.078, 0.004, 0.108)), Vector3.ZERO, Vector3.ZERO]
		"deckbox":
			v.add_child(mesh_node(box(Vector3(0.075, 0.048, 0.09)), mat(c, 0.35)))
			v.add_child(mesh_node(box(Vector3(0.077, 0.014, 0.092)), mat(accent, 0.3, 0.3 if style == "neon" else 0.0), Vector3(0, 0.018, 0)))
			v.add_child(mesh_node(box(Vector3(0.05, 0.002, 0.05)), holo_mat(c.lightened(0.2)), Vector3(0, 0.0, 0.046), Vector3(PI / 2, 0, 0)))
			return [v, _box_shape(Vector3(0.077, 0.048, 0.092)), Vector3.ZERO, Vector3(0, 0, PI / 2)]
	# a glass counter bead
	var bead := mesh_node(sphere(0.011, 12), crystal_mat(c))
	bead.scale = Vector3(1, 0.45, 1)
	v.add_child(bead)
	return [v, _cyl_shape(0.011, 0.01), Vector3.ZERO, Vector3.ZERO]


# ---------------------------------------------------------------- crystals

static func _prism_point(r: float, h: float, tip: float, m: Material) -> MeshInstance3D:
	var prof := [Vector2(0, 0), Vector2(r, 0), Vector2(r, h), Vector2(0, h + tip)]
	var mi := mesh_node(lathe(prof, 6), m)
	return mi


static func crystal_piece(type: String, c: Color) -> Array:
	var v := Node3D.new()
	var cm := crystal_mat(c)
	var rock := mat(Color("5a5048"), 0.95)
	match type:
		"shard":
			var s := _prism_point(0.009, 0.034, 0.014, cm)
			s.position = Vector3(0, -0.024, 0)
			v.add_child(s)
			return [v, _cyl_shape(0.01, 0.048), Vector3.ZERO, Vector3(0, 0, PI / 2)]
		"cluster":
			v.add_child(mesh_node(sphere(0.02, 8), rock, Vector3(0, -0.018, 0)))
			v.get_child(0).scale = Vector3(1.2, 0.5, 1.0)
			for k in 5:
				var a := TAU * k / 5.0
				var s := _prism_point(0.006, 0.022 + (k % 3) * 0.006, 0.009, cm)
				s.position = Vector3(cos(a) * 0.008, -0.016, sin(a) * 0.008)
				s.rotation = Vector3(sin(a) * 0.45, 0, -cos(a) * 0.45)
				v.add_child(s)
			var mid := _prism_point(0.007, 0.03, 0.01, cm)
			mid.position = Vector3(0, -0.016, 0)
			v.add_child(mid)
			return [v, _cyl_shape(0.024, 0.05), Vector3(0, 0.004, 0), Vector3.ZERO]
		"geode":
			# A rough rock split open to show the crystals inside.
			var shell := mesh_node(sphere(0.022, 12), rock, Vector3.ZERO)
			shell.scale = Vector3(1, 0.55, 1)
			v.add_child(shell)
			v.add_child(mesh_node(cyl(0.0205, 0.0205, 0.0015, 16), mat(Color("e8e2d8"), 0.8), Vector3(0, 0.0005, 0)))
			v.add_child(mesh_node(cyl(0.017, 0.017, 0.002, 16), cm, Vector3(0, 0.0012, 0)))
			for k in 9:
				var a := TAU * k / 9.0
				var s := _prism_point(0.0025, 0.004, 0.004, cm)
				s.position = Vector3(cos(a) * 0.01 * (1 + k % 2 * 0.4), 0.0012, sin(a) * 0.01 * (1 + k % 2 * 0.4))
				v.add_child(s)
			return [v, _cyl_shape(0.022, 0.026), Vector3(0, -0.005, 0), Vector3.ZERO]
	# a brilliant-cut gem
	v.add_child(mesh_node(cyl(0.012, 0.018, 0.007, 8), cm, Vector3(0, 0.004, 0)))
	v.add_child(mesh_node(cyl(0.018, 0.0, 0.016, 8), cm, Vector3(0, -0.0075, 0)))
	return [v, _cyl_shape(0.018, 0.023), Vector3.ZERO, Vector3(0, 0, PI / 2)]


# ---------------------------------------------------------------- marbles

static func marble_piece(type: String, c: Color) -> Array:
	var v := Node3D.new()
	var r := 0.016
	match type:
		"cateye", "shooter":
			if type == "shooter":
				r = 0.024
			# Clear glass with a twisted colored vane inside.
			v.add_child(mesh_node(sphere(r, 16), glass_mat(c.lerp(Color.WHITE, 0.6))))
			var vane_m := mat(c, 0.3, 0.35)
			for k in 4:
				var vane := mesh_node(sphere(r * 0.82, 10), vane_m, Vector3.ZERO, Vector3(0, k * PI / 4, 0.4 * (k % 2) - 0.2))
				vane.scale = Vector3(1, 0.12, 0.28)
				v.add_child(vane)
		"pearl":
			var m := StandardMaterial3D.new()
			m.albedo_color = c
			m.metallic = 0.45
			m.roughness = 0.12
			m.rim_enabled = true
			m.rim = 0.8
			m.clearcoat_enabled = true
			v.add_child(mesh_node(sphere(r, 16), m))
		"steelie":
			v.add_child(mesh_node(sphere(r, 16), metal_mat(Color("d8dde2"), 0.08)))
		"galaxymarble":
			r = 0.019
			v.add_child(mesh_node(sphere(r, 16), glass_mat(Color(0.6, 0.6, 1.0))))
			v.add_child(mesh_node(sphere(r * 0.75, 12), mat(c, 0.2, 0.9)))
			var rng := RandomNumberGenerator.new()
			rng.seed = 7
			for k in 10:
				var d := Vector3(rng.randf_range(-1, 1), rng.randf_range(-1, 1), rng.randf_range(-1, 1)).normalized()
				v.add_child(mesh_node(sphere(0.0009, 4), mat(Color.WHITE, 0.3, 5.0), d * r * 0.85))
	return [v, _sphere_shape(r), Vector3.ZERO, Vector3.ZERO]


# ---------------------------------------------------------------- hobby paints

static func paint_piece(type: String, c: Color, style: String) -> Array:
	var v := Node3D.new()
	var paint := metal_mat(c, 0.25) if style == "metal" else mat(c, 0.35)
	var plastic := mat(Color("f2efe8"), 0.5)
	match type:
		"pot":
			# A squat hobby paint pot with a hinged flip cap in the paint's color.
			v.add_child(mesh_node(cyl(0.0125, 0.0135, 0.022, 14), plastic, Vector3(0, -0.004, 0)))
			v.add_child(mesh_node(cyl(0.0137, 0.0137, 0.008, 14), mat(Color("1d1d1f"), 0.5), Vector3(0, -0.006, 0)))
			v.add_child(mesh_node(cyl(0.0128, 0.0128, 0.008, 14), paint, Vector3(0, 0.011, 0)))
			v.add_child(mesh_node(box(Vector3(0.008, 0.004, 0.006)), paint, Vector3(0, 0.009, 0.013)))
			return [v, _cyl_shape(0.0137, 0.032), Vector3(0, 0.0, 0), Vector3.ZERO]
		"dropper":
			v.add_child(mesh_node(cyl(0.009, 0.01, 0.034, 12), plastic, Vector3(0, -0.006, 0)))
			v.add_child(mesh_node(cyl(0.0092, 0.0092, 0.016, 12), paint, Vector3(0, -0.012, 0)))
			v.add_child(mesh_node(cyl(0.003, 0.0065, 0.012, 10), mat(Color("1d1d1f"), 0.5), Vector3(0, 0.017, 0)))
			return [v, _cyl_shape(0.01, 0.046), Vector3.ZERO, Vector3(0, 0, PI / 2)]
		"brush":
			v.add_child(mesh_node(cyl(0.0022, 0.0032, 0.07, 8), mat(c, 0.3), Vector3(0, 0.0, 0)))
			v.add_child(mesh_node(cyl(0.0024, 0.0024, 0.012, 8), metal_mat(Color("c9cfd6")), Vector3(0, 0.041, 0)))
			v.add_child(mesh_node(cyl(0.0, 0.002, 0.009, 8), mat(Color("3a2414"), 0.8), Vector3(0, 0.0515, 0)))
			return [v, _cyl_shape(0.004, 0.11), Vector3(0, 0.01, 0), Vector3(0, 0, PI / 2)]
	# spray primer can
	v.add_child(mesh_node(cyl(0.017, 0.017, 0.06, 16), metal_mat(c.darkened(0.1), 0.35)))
	v.add_child(mesh_node(cyl(0.0172, 0.0172, 0.03, 16), mat(Color("f2efe8"), 0.4), Vector3(0, 0.0, 0)))
	v.add_child(mesh_node(cyl(0.012, 0.016, 0.01, 16), metal_mat(Color("c9cfd6")), Vector3(0, 0.035, 0)))
	v.add_child(mesh_node(cyl(0.006, 0.006, 0.008, 10), mat(c, 0.4), Vector3(0, 0.044, 0)))
	return [v, _cyl_shape(0.017, 0.09), Vector3(0, 0.005, 0), Vector3(0, 0, PI / 2)]


# ---------------------------------------------------------------- miniature figures

const FIGURES := ["knight", "goblin", "hero", "skeleton", "dragon"]


## A capsule-shaped limb or bone from a to b.
static func _limb(v: Node3D, a: Vector3, b: Vector3, r: float, m: Material) -> void:
	var d := b - a
	var l := d.length()
	var cap := CapsuleMesh.new()
	cap.radius = r
	cap.height = maxf(l + 2.0 * r, 2.0 * r + 0.0002)
	cap.radial_segments = 8
	cap.rings = 2
	var mi := mesh_node(cap, m, (a + b) / 2.0)
	if l > 0.00001:
		var n := d / l
		mi.basis = Basis.from_euler(Vector3(PI, 0, 0)) if n.dot(Vector3.UP) < -0.999 else Basis(Quaternion(Vector3.UP, n))
	v.add_child(mi)


## A chain of limbs through several points, tapering from r0 to r1.
static func _chain(v: Node3D, pts: Array, r0: float, r1: float, m: Material) -> void:
	for i in pts.size() - 1:
		_limb(v, pts[i], pts[i + 1], lerpf(r0, r1, float(i) / maxf(1.0, pts.size() - 2)), m)


## A bevelled slate base with flocked grass and a few tufts on top.
static func _mini_base(v: Node3D, r: float) -> void:
	var prof := [Vector2(0, 0), Vector2(r, 0), Vector2(r + 0.0006, 0.0018), Vector2(r - 0.0012, 0.0052), Vector2(0, 0.0052)]
	v.add_child(mesh_node(lathe(prof, 20), mat(Color("2a2622"), 0.7)))
	v.add_child(mesh_node(cyl(r - 0.0016, r - 0.0016, 0.0012, 20), mat(Color("4d6b2c"), 0.95), Vector3(0, 0.0056, 0)))
	var tuft := mat(Color("7f9a3a"), 0.9)
	for k in 3:
		var a := TAU * k / 3.0 + 0.6
		v.add_child(mesh_node(cyl(0.0, 0.0018, 0.004, 5), tuft, Vector3(cos(a) * r * 0.72, 0.008, sin(a) * r * 0.72)))


## Returns [visual, shape, shape_offset, rest_rotation] like piece(). Built standing on y = 0,
## then lowered so the model's middle sits at the origin.
static func figurine(type: String, c: Color, accent: Color) -> Array:
	var root := Node3D.new()
	var f := Node3D.new()
	root.add_child(f)
	var steel := mat(Color("b9bfc7"), 0.3)
	var leather := mat(Color("5a3a22"), 0.75)
	var skin := mat(Color("e8c39e"), 0.6)
	var gold := mat(Color("e0b84a"), 0.3)
	var wood := mat(Color("7a4f2c"), 0.7)
	var body := mat(c, 0.45)
	var acc := mat(accent, 0.4)
	var height := 0.06
	var radius := 0.019
	match type:
		"knight":
			_mini_base(f, 0.019)
			for sx in [-1.0, 1.0]:
				_limb(f, Vector3(sx * 0.004, 0.0075, 0.001), Vector3(sx * 0.0045, 0.022, 0.0), 0.0029, steel)
				f.add_child(mesh_node(box(Vector3(0.005, 0.003, 0.008)), leather, Vector3(sx * 0.004, 0.0072, 0.002)))
			f.add_child(mesh_node(lathe([Vector2(0, 0.019), Vector2(0.0088, 0.019), Vector2(0.0068, 0.03), Vector2(0, 0.03)], 12), body))
			f.add_child(mesh_node(lathe([Vector2(0, 0.028), Vector2(0.0068, 0.028), Vector2(0.0079, 0.036), Vector2(0.0072, 0.0425), Vector2(0.004, 0.045), Vector2(0, 0.045)], 12), steel))
			f.add_child(mesh_node(box(Vector3(0.009, 0.017, 0.0014)), body, Vector3(0, 0.035, 0.0074)))
			f.add_child(mesh_node(box(Vector3(0.0022, 0.012, 0.0016)), acc, Vector3(0, 0.0355, 0.0076)))
			f.add_child(mesh_node(torus(0.0062, 0.0074), leather, Vector3(0, 0.0292, 0)))
			for sx in [-1.0, 1.0]:
				f.add_child(mesh_node(sphere(0.0037, 10), steel, Vector3(sx * 0.0078, 0.0425, 0)))
			# Sword arm, raised.
			_chain(f, [Vector3(0.0082, 0.0418, 0.0), Vector3(0.0128, 0.0475, 0.0035), Vector3(0.0138, 0.057, 0.0062)], 0.0025, 0.0022, steel)
			f.add_child(mesh_node(box(Vector3(0.0018, 0.024, 0.0007)), mat(Color("dfe4ea"), 0.15), Vector3(0.0142, 0.0715, 0.0064)))
			f.add_child(mesh_node(box(Vector3(0.0085, 0.0013, 0.0014)), gold, Vector3(0.0142, 0.0594, 0.0064)))
			f.add_child(mesh_node(sphere(0.0012, 6), gold, Vector3(0.014, 0.0565, 0.0064)))
			# Shield arm with a kite shield.
			_chain(f, [Vector3(-0.0082, 0.0418, 0.0), Vector3(-0.0112, 0.036, 0.0042), Vector3(-0.0085, 0.031, 0.0085)], 0.0025, 0.0022, steel)
			var kite := PackedVector2Array([Vector2(-0.0078, 0.0095), Vector2(0.0078, 0.0095), Vector2(0.0072, -0.003), Vector2(0, -0.0135), Vector2(-0.0072, -0.003)])
			var sh := mesh_node(extrude(kite, 0.0016), body, Vector3(-0.0092, 0.0335, 0.0098), Vector3(0, -0.35, 0))
			f.add_child(sh)
			var emb := mesh_node(cyl(0.0032, 0.0032, 0.0006, 10), acc, Vector3(-0.0089, 0.0345, 0.0109), Vector3(PI / 2, -0.35, 0))
			f.add_child(emb)
			# Great helm with a visor slit and a plume.
			f.add_child(mesh_node(lathe([Vector2(0, 0.0462), Vector2(0.0053, 0.0462), Vector2(0.0056, 0.0535), Vector2(0.0047, 0.0582), Vector2(0, 0.0592)], 12), steel))
			f.add_child(mesh_node(box(Vector3(0.0072, 0.0008, 0.001)), mat(Color("1a1a1e"), 0.6), Vector3(0, 0.0532, 0.0055)))
			f.add_child(mesh_node(box(Vector3(0.0009, 0.007, 0.001)), mat(Color("1a1a1e"), 0.6), Vector3(0, 0.0505, 0.0055)))
			_chain(f, [Vector3(0, 0.0585, 0.0), Vector3(0, 0.0645, -0.002), Vector3(0, 0.066, -0.008)], 0.0018, 0.0011, acc)
			height = 0.084
		"goblin":
			_mini_base(f, 0.018)
			var gskin := mat(c.lightened(0.18), 0.6)
			for sx in [-1.0, 1.0]:
				_chain(f, [Vector3(sx * 0.004, 0.0065, 0.002), Vector3(sx * 0.0055, 0.012, 0.004), Vector3(sx * 0.0042, 0.0165, 0.0)], 0.0026, 0.0024, gskin)
			f.add_child(mesh_node(lathe([Vector2(0, 0.0155), Vector2(0.0068, 0.0155), Vector2(0.0058, 0.0215), Vector2(0, 0.0215)], 10), leather))
			var torso := mesh_node(sphere(0.0076, 12), gskin, Vector3(0, 0.0262, 0.0012), Vector3(0.35, 0, 0))
			torso.scale = Vector3(1, 1.15, 0.9)
			f.add_child(torso)
			f.add_child(mesh_node(torus(0.0064, 0.0076), leather, Vector3(0, 0.0215, 0.0006), Vector3(0.2, 0, 0)))
			f.add_child(mesh_node(sphere(0.0068, 12), gskin, Vector3(0, 0.0372, 0.0058)))
			for sx in [-1.0, 1.0]:
				f.add_child(mesh_node(cyl(0.0, 0.0029, 0.0125, 6), gskin, Vector3(sx * 0.0084, 0.0388, 0.0042), Vector3(0, 0, -sx * 1.3)))
				f.add_child(mesh_node(sphere(0.0011, 6), mat(Color("ffd84a"), 0.3, 2.5), Vector3(sx * 0.0026, 0.0388, 0.0118)))
			f.add_child(mesh_node(cyl(0.0, 0.0015, 0.0055, 6), gskin, Vector3(0, 0.0362, 0.0128), Vector3(PI / 2, 0, 0)))
			for sx in [-1.0, 1.0]:
				_chain(f, [Vector3(sx * 0.0072, 0.031, 0.002), Vector3(sx * 0.0112, 0.0215, 0.0072)], 0.0019, 0.0018, gskin)
			_limb(f, Vector3(0.011, 0.02, 0.0075), Vector3(0.0145, 0.04, 0.0035), 0.0024, wood)
			var club_head := mesh_node(sphere(0.0042, 8), wood, Vector3(0.0148, 0.041, 0.0033))
			club_head.scale = Vector3(1, 1.4, 1)
			f.add_child(club_head)
			for k in 4:
				var a := TAU * k / 4.0
				f.add_child(mesh_node(cyl(0.0, 0.0011, 0.004, 4), mat(Color("c9cfd6"), 0.3), Vector3(0.0148 + cos(a) * 0.004, 0.042, 0.0033 + sin(a) * 0.004), Vector3(sin(a) * 1.4, 0, -cos(a) * 1.4)))
			height = 0.048
		"hero":
			_mini_base(f, 0.023)
			radius = 0.023
			for sx in [-1.0, 1.0]:
				_limb(f, Vector3(sx * 0.004, 0.007, 0.001), Vector3(sx * 0.004, 0.02, 0.0), 0.003, leather)
			f.add_child(mesh_node(lathe([Vector2(0, 0.012), Vector2(0.0112, 0.0095), Vector2(0.0092, 0.028), Vector2(0.0066, 0.047), Vector2(0, 0.0495)], 14), body))
			f.add_child(mesh_node(box(Vector3(0.008, 0.026, 0.0015)), acc, Vector3(0, 0.03, 0.0072)))
			f.add_child(mesh_node(torus(0.0062, 0.0074), gold, Vector3(0, 0.03, 0.0005)))
			f.add_child(mesh_node(sphere(0.0054, 12), skin, Vector3(0, 0.0545, 0.0016)))
			var hood := mesh_node(sphere(0.0068, 12), mat(c.darkened(0.2), 0.5), Vector3(0, 0.0558, -0.0012))
			hood.scale = Vector3(1, 1.05, 1.1)
			f.add_child(hood)
			_chain(f, [Vector3(0.0072, 0.045, 0.0), Vector3(0.0118, 0.039, 0.0048)], 0.0024, 0.0022, body)
			_chain(f, [Vector3(-0.0072, 0.045, 0.0), Vector3(-0.0098, 0.034, 0.0042)], 0.0024, 0.0022, body)
			_limb(f, Vector3(0.0124, 0.007, 0.0052), Vector3(0.0128, 0.074, 0.0052), 0.0014, wood)
			f.add_child(mesh_node(sphere(0.0046, 12), mat(accent, 0.2, 2.0), Vector3(0.0128, 0.0785, 0.0052)))
			f.add_child(mesh_node(torus(0.004, 0.0052), gold, Vector3(0.0128, 0.0752, 0.0052)))
			height = 0.083
		"skeleton":
			_mini_base(f, 0.018)
			var bone := mat(Color("e8e0cc"), 0.65)
			for sx in [-1.0, 1.0]:
				_chain(f, [Vector3(sx * 0.0035, 0.0065, 0.0015), Vector3(sx * 0.004, 0.0155, 0.0), Vector3(sx * 0.0036, 0.0235, 0.0)], 0.0014, 0.0013, bone)
				f.add_child(mesh_node(box(Vector3(0.0035, 0.0016, 0.006)), bone, Vector3(sx * 0.0035, 0.0062, 0.0022)))
			f.add_child(mesh_node(torus(0.0034, 0.0048), bone, Vector3(0, 0.0245, 0)))
			_limb(f, Vector3(0, 0.025, -0.001), Vector3(0, 0.044, -0.0015), 0.0012, bone)
			for k in 4:
				var rib := mesh_node(torus(0.0044 - k * 0.0003, 0.0054 - k * 0.0003), bone, Vector3(0, 0.031 + k * 0.0035, 0.0002))
				rib.scale = Vector3(1, 1, 0.75)
				f.add_child(rib)
			for sx in [-1.0, 1.0]:
				f.add_child(mesh_node(sphere(0.0022, 8), bone, Vector3(sx * 0.0062, 0.0435, 0)))
			_chain(f, [Vector3(0.0064, 0.0432, 0.0), Vector3(0.0102, 0.0352, 0.0032), Vector3(0.0112, 0.0285, 0.0075)], 0.0013, 0.0012, bone)
			f.add_child(mesh_node(box(Vector3(0.0018, 0.026, 0.0007)), mat(Color("8a8070"), 0.5), Vector3(0.0114, 0.0285, 0.0172), Vector3(PI / 2 - 0.35, 0, 0)))
			_chain(f, [Vector3(-0.0064, 0.0432, 0.0), Vector3(-0.0095, 0.036, 0.0038), Vector3(-0.0082, 0.0315, 0.0078)], 0.0013, 0.0012, bone)
			f.add_child(mesh_node(cyl(0.0082, 0.0082, 0.0014, 16), body, Vector3(-0.0088, 0.0322, 0.0094), Vector3(PI / 2, 0.3, 0)))
			f.add_child(mesh_node(torus(0.0072, 0.0084), acc, Vector3(-0.0088, 0.0322, 0.0096), Vector3(PI / 2, 0.3, 0)))
			f.add_child(mesh_node(sphere(0.0057, 12), bone, Vector3(0, 0.051, 0.0006)))
			f.add_child(mesh_node(box(Vector3(0.0068, 0.0028, 0.0052)), bone, Vector3(0, 0.0462, 0.0022)))
			for sx in [-1.0, 1.0]:
				f.add_child(mesh_node(sphere(0.0016, 8), mat(Color("120c0c"), 0.8), Vector3(sx * 0.0021, 0.0518, 0.0048)))
			height = 0.058
		"dragon":
			_mini_base(f, 0.025)
			radius = 0.026
			var belly := mat(accent.lerp(Color("f2d8a0"), 0.5), 0.5)
			_limb(f, Vector3(-0.012, 0.0175, 0.0), Vector3(0.0095, 0.0205, 0.0), 0.0088, body)
			_limb(f, Vector3(-0.009, 0.0148, 0.0), Vector3(0.008, 0.0172, 0.0), 0.0066, belly)
			for sz in [-1.0, 1.0]:
				_chain(f, [Vector3(0.0068, 0.016, sz * 0.0062), Vector3(0.0105, 0.0105, sz * 0.0088), Vector3(0.0115, 0.0062, sz * 0.0092)], 0.0029, 0.0024, body)
				_chain(f, [Vector3(-0.0092, 0.0158, sz * 0.0062), Vector3(-0.0128, 0.0105, sz * 0.0092), Vector3(-0.0118, 0.0062, sz * 0.0094)], 0.0031, 0.0025, body)
			_chain(f, [Vector3(0.0108, 0.023, 0.0), Vector3(0.0162, 0.0315, 0.0), Vector3(0.0188, 0.0418, 0.0)], 0.0046, 0.0036, body)
			_limb(f, Vector3(0.0185, 0.0448, 0.0), Vector3(0.0305, 0.0438, 0.0), 0.0042, body)
			_limb(f, Vector3(0.0205, 0.0412, 0.0), Vector3(0.0298, 0.0405, 0.0), 0.0026, belly)
			for sz in [-1.0, 1.0]:
				f.add_child(mesh_node(cyl(0.0, 0.0016, 0.011, 6), acc, Vector3(0.0165, 0.0505, sz * 0.0028), Vector3(sz * 0.3, 0, 1.05)))
				f.add_child(mesh_node(sphere(0.0012, 6), mat(Color("ffd25a"), 0.3, 3.0), Vector3(0.0262, 0.0468, sz * 0.003)))
			_chain(f, [Vector3(-0.0135, 0.0168, 0.0), Vector3(-0.0245, 0.0115, 0.0055), Vector3(-0.0345, 0.0092, 0.0), Vector3(-0.0415, 0.0125, -0.0062)], 0.0052, 0.0014, body)
			f.add_child(mesh_node(extrude(PackedVector2Array([Vector2(0, 0.004), Vector2(0.006, 0), Vector2(0, -0.004), Vector2(-0.002, 0)]), 0.0012), acc, Vector3(-0.0435, 0.0132, -0.0072), Vector3(PI / 2, 0, 0.4)))
			for k in 5:
				f.add_child(mesh_node(cyl(0.0, 0.0016, 0.005, 4), acc, Vector3(-0.009 + k * 0.0045, 0.0272 + k * 0.0005, 0.0)))
			var wing_m := mat(c.darkened(0.25).lerp(accent, 0.25), 0.6)
			for sz in [-1.0, 1.0]:
				var wing := Node3D.new()
				wing.position = Vector3(0.0, 0.0245, sz * 0.0062)
				wing.rotation = Vector3(-sz * 0.95, 0, 0)
				var mem := PackedVector2Array([Vector2(0, 0), Vector2(-0.006, 0.028), Vector2(0.006, 0.036), Vector2(0.018, 0.03), Vector2(0.016, 0.016), Vector2(0.009, 0.006)])
				wing.add_child(mesh_node(extrude(mem, 0.0011), wing_m))
				_chain(wing, [Vector3(0, 0, 0), Vector3(0.006, 0.036, 0)], 0.0011, 0.0009, body)
				_chain(wing, [Vector3(0, 0, 0), Vector3(0.018, 0.03, 0)], 0.0011, 0.0008, body)
				f.add_child(wing)
			height = 0.06
	f.position.y = -height / 2.0
	return [root, _cyl_shape(radius, height), Vector3.ZERO, Vector3(0, 0, PI / 2) if type != "dragon" else Vector3.ZERO]
