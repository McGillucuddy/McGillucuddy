class_name MeshKit
extends RefCounted
## Builds every model in the game from code: pieces, cards, boards, rulebooks, textures and materials.

const BOARD_SIZE := 0.5
const CARD := Vector3(0.075, 0.0012, 0.105)

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
static func piece(type: String, c: Color, accent := Color(0, 0, 0, 0)) -> Array:
	if accent.a == 0.0:
		accent = c.lightened(0.45)
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
		"knight":
			v.add_child(mesh_node(cyl(0.017, 0.018, 0.005, 16), dark_base, Vector3(0, -0.028, 0)))
			var prof := [Vector2(0, -0.0255), Vector2(0.011, -0.0255), Vector2(0.012, -0.006), Vector2(0.009, 0.011),
				Vector2(0.012, 0.015), Vector2(0.0, 0.017)]
			v.add_child(mesh_node(lathe(prof, 10), body))
			v.add_child(mesh_node(sphere(0.0075, 8), skin, Vector3(0, 0.024, 0)))
			v.add_child(mesh_node(cyl(0.0055, 0.0085, 0.008, 10), body, Vector3(0, 0.029, 0)))
			v.add_child(mesh_node(box(Vector3(0.003, 0.019, 0.014)), light, Vector3(0.013, 0.001, 0.0)))
			v.add_child(mesh_node(cyl(0.0012, 0.0012, 0.062, 6), wood, Vector3(-0.012, 0.004, 0.0)))
			v.add_child(mesh_node(cyl(0.0, 0.003, 0.008, 6), light, Vector3(-0.012, 0.039, 0.0)))
			shape = _cyl_shape(0.018, 0.064)
			offset = Vector3(0, 0.002, 0)
			rest = Vector3(0, 0, PI / 2)
		"goblin":
			v.add_child(mesh_node(cyl(0.017, 0.018, 0.005, 16), dark_base, Vector3(0, -0.02, 0)))
			var bod := mesh_node(sphere(0.011, 8), body, Vector3(0, -0.008, 0))
			bod.scale = Vector3(1, 1.15, 1)
			v.add_child(bod)
			v.add_child(mesh_node(sphere(0.0095, 8), mat(c.lightened(0.25), 0.6), Vector3(0, 0.01, 0)))
			for sx in [-1.0, 1.0]:
				v.add_child(mesh_node(cyl(0.0, 0.004, 0.012, 6), mat(c.lightened(0.25), 0.6), Vector3(sx * 0.011, 0.013, 0), Vector3(0, 0, -sx * 1.25)))
			v.add_child(mesh_node(cyl(0.002, 0.0045, 0.03, 6), wood, Vector3(0.013, -0.003, 0), Vector3(0, 0, -0.4)))
			v.add_child(mesh_node(box(Vector3(0.012, 0.004, 0.008)), light, Vector3(0, -0.006, 0.009)))
			shape = _cyl_shape(0.018, 0.046)
			offset = Vector3(0, -0.002, 0)
		"hero":
			v.add_child(mesh_node(cyl(0.023, 0.024, 0.006, 18), dark_base, Vector3(0, -0.034, 0)))
			var prof := [Vector2(0, -0.031), Vector2(0.016, -0.031), Vector2(0.014, -0.004), Vector2(0.01, 0.017), Vector2(0.0, 0.019)]
			v.add_child(mesh_node(lathe(prof, 12), body))
			v.add_child(mesh_node(box(Vector3(0.026, 0.042, 0.003)), light, Vector3(0, -0.006, -0.012), Vector3(0.12, 0, 0)))
			v.add_child(mesh_node(sphere(0.009, 10), skin, Vector3(0, 0.027, 0)))
			v.add_child(mesh_node(cyl(0.004, 0.013, 0.009, 12), mat(Color("2a1e24"), 0.6), Vector3(0, 0.037, 0)))
			v.add_child(mesh_node(cyl(0.006, 0.006, 0.006, 10), mat(Color("2a1e24"), 0.6), Vector3(0, 0.044, 0)))
			shape = _cyl_shape(0.024, 0.08)
			offset = Vector3(0, 0.005, 0)
			rest = Vector3(0, 0, PI / 2)
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

static func _card(c: Color, stripe: Color) -> Node3D:
	var n := Node3D.new()
	n.add_child(mesh_node(box(CARD), mat(Color("fbf1e1"), 0.6)))
	n.add_child(mesh_node(box(Vector3(0.069, 0.0005, 0.099)), mat(c, 0.5), Vector3(0, 0.0008, 0)))
	n.add_child(mesh_node(box(Vector3(0.048, 0.0005, 0.076)), mat(c.lightened(0.3), 0.5), Vector3(0, 0.0009, 0)))
	n.add_child(mesh_node(box(Vector3(0.069, 0.0006, 0.014)), mat(stripe, 0.4), Vector3(0, 0.001, -0.036)))
	n.add_child(mesh_node(cyl(0.011, 0.011, 0.0005, 12), mat(stripe, 0.3), Vector3(0, 0.0011, 0)))
	return n


## A fanned hand of cards, the way a player leaves them face down on the table.
static func card_hand(c: Color, count: int, stripe: Color) -> Array:
	var v := Node3D.new()
	for i in count:
		var pivot := Node3D.new()
		pivot.position = Vector3(0, i * 0.0022, 0.035)
		pivot.rotation.y = (i - (count - 1) / 2.0) * 0.26
		var card := _card(c, stripe)
		card.position = Vector3(0, 0, -0.04)
		pivot.add_child(card)
		v.add_child(pivot)
	return [v, _box_shape(Vector3(0.12, 0.004 + count * 0.0022, 0.11)), Vector3(0, count * 0.001, -0.005), Vector3.ZERO]


## A neat stack of cards: a draw pile, or how cards sit once they're put away.
static func card_stack(c: Color, count: int, stripe: Color) -> Array:
	var v := Node3D.new()
	var h := count * CARD.y
	v.add_child(mesh_node(box(Vector3(CARD.x, h, CARD.z)), mat(Color("f4ead8"), 0.7), Vector3(0, h / 2, 0)))
	# Stripes down the side of the stack so you can tell sets apart from any angle.
	v.add_child(mesh_node(box(Vector3(CARD.x + 0.001, h * 0.9, 0.012)), mat(stripe.darkened(0.15), 0.6), Vector3(0, h / 2, -0.036)))
	var top := _card(c, stripe)
	top.position = Vector3(0, h, 0)
	v.add_child(top)
	return [v, _box_shape(Vector3(CARD.x, h + 0.002, CARD.z)), Vector3(0, h / 2, 0), Vector3.ZERO]


static func rulebook(c: Color, game_name: String) -> Array:
	var v := Node3D.new()
	v.add_child(mesh_node(box(Vector3(0.19, 0.008, 0.26)), mat(Color("f4ead8"), 0.85), Vector3(0.004, 0.0, 0)))
	v.add_child(mesh_node(box(Vector3(0.2, 0.003, 0.27)), mat(c.darkened(0.15), 0.6), Vector3(0, 0.0055, 0)))
	v.add_child(mesh_node(box(Vector3(0.2, 0.003, 0.27)), mat(c.darkened(0.15), 0.6), Vector3(0, -0.0055, 0)))
	v.add_child(mesh_node(box(Vector3(0.16, 0.0008, 0.07)), mat(c.lightened(0.4), 0.6), Vector3(0, 0.0072, -0.06)))
	var t := Label3D.new()
	t.text = "RULES"
	t.font_size = 64
	t.pixel_size = 0.0007
	t.modulate = Color("3b2630")
	t.outline_size = 0
	t.position = Vector3(0, 0.0078, -0.06)
	t.rotation.x = -PI / 2
	v.add_child(t)
	var n := Label3D.new()
	n.text = game_name
	n.font_size = 40
	n.pixel_size = 0.0007
	n.modulate = Color("fff1de")
	n.outline_size = 6
	n.outline_modulate = c.darkened(0.6)
	n.position = Vector3(0, 0.0072, 0.05)
	n.rotation.x = -PI / 2
	v.add_child(n)
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
static func bake(v: Node3D, s: float) -> ArrayMesh:
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
				var m: Material = (c as MeshInstance3D).material_override
				if not tools.has(m):
					var st := SurfaceTool.new()
					st.begin(Mesh.PRIMITIVE_TRIANGLES)
					tools[m] = st
					order.append(m)
				_append(tools[m], (c as MeshInstance3D).mesh, cx)
			todo.append([c, cx])
	var out := ArrayMesh.new()
	for m in order:
		(tools[m] as SurfaceTool).commit(out)
		out.surface_set_material(out.get_surface_count() - 1, m)
	return out


static func _append(st: SurfaceTool, mesh: Mesh, xf: Transform3D) -> void:
	var nb := xf.basis.inverse().transposed()
	for si in mesh.get_surface_count():
		var arr := mesh.surface_get_arrays(si)
		var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var norms: PackedVector3Array = arr[Mesh.ARRAY_NORMAL] if arr[Mesh.ARRAY_NORMAL] != null else PackedVector3Array()
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array()
		var has_n := norms.size() == verts.size()
		if idx.is_empty():
			for i in verts.size():
				st.set_normal((nb * norms[i]).normalized() if has_n else Vector3.UP)
				st.add_vertex(xf * verts[i])
		else:
			for i in idx:
				st.set_normal((nb * norms[i]).normalized() if has_n else Vector3.UP)
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
