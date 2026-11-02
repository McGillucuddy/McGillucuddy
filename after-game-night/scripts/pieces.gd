class_name Pieces
extends Node3D
## Every small piece in the house lives here, about 1,400 of them.
## Resting pieces are drawn in batches (one MultiMesh per edition and piece type) and get a
## bare static collider so the player can aim at them. Only pieces in flight get real physics,
## and they turn back into resting pieces as soon as they settle.

signal clacked(pos: Vector3, strength: float)

enum { LOOSE, HELD, PHYS, STORED }

const LAYER_PHYS := 16


class Group:
	extends RefCounted
	var key := ""
	var line := ""
	var ed := ""          # "<line>/<edition>"
	var ed_name := ""     # full printed name, like "Mossy Crowns: Thornwood Host"
	var type := ""
	var mesh: ArrayMesh
	var shape: Shape3D
	var shape_off := Vector3.ZERO
	var rest := Vector3.ZERO
	var aabb_table := AABB()
	var aabb_rest := AABB()
	var handful := 10
	var mm: MultiMesh
	var members: Array = []


class P:
	extends RefCounted
	var g: Group
	var gi := 0
	var xf := Transform3D()
	var state := 0
	var body := RID()
	var home: Dictionary = {}


var groups := {}
var all: Array = []
var by_rid := {}
var _phys: Array = []
var _outlines: Array[MeshInstance3D] = []
var _outline_mat: StandardMaterial3D
var _hidden := Transform3D(Basis.from_scale(Vector3.ZERO), Vector3(0, -50, 0))


func make_group(line: String, ed: String, ed_name: String, type: String, body: Color, accent: Color, scale: float, style := "") -> Group:
	var key := ed + "/" + type
	if groups.has(key):
		return groups[key]
	var g := Group.new()
	g.key = key
	g.line = line
	g.ed = ed
	g.ed_name = ed_name
	g.type = type
	var parts := MeshKit.piece(type, body, accent, style)
	var v: Node3D = parts[0]
	g.mesh = MeshKit.bake(v, scale)
	g.shape = MeshKit.scaled_shape(parts[1], scale)
	g.shape_off = parts[2] * scale
	g.rest = parts[3]
	g.aabb_table = MeshKit.scaled_aabb(MeshKit.visual_aabb(v, Vector3.ZERO), scale)
	g.aabb_rest = MeshKit.scaled_aabb(MeshKit.visual_aabb(v, g.rest), scale)
	g.handful = int(GameData.HANDFUL.get(type, 10) * 1.5)
	v.free()
	groups[key] = g
	return g


func add(g: Group, xf: Transform3D, home: Dictionary) -> P:
	var p := P.new()
	p.g = g
	p.gi = g.members.size()
	p.xf = xf
	p.home = home
	g.members.append(p)
	all.append(p)
	return p


## Call once every piece has been added: creates the batches and colliders.
func build() -> void:
	var space := get_world_3d().space
	for key in groups:
		var g: Group = groups[key]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = g.mesh
		mm.instance_count = g.members.size()
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		add_child(mmi)
		g.mm = mm
		for p: P in g.members:
			var b := PhysicsServer3D.body_create()
			PhysicsServer3D.body_set_mode(b, PhysicsServer3D.BODY_MODE_STATIC)
			PhysicsServer3D.body_add_shape(b, g.shape.get_rid(), Transform3D(Basis(), g.shape_off))
			PhysicsServer3D.body_set_collision_mask(b, 0)
			PhysicsServer3D.body_set_space(b, space)
			p.body = b
			by_rid[b] = p
			set_loose(p, p.xf)
	_outline_mat = StandardMaterial3D.new()
	_outline_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_outline_mat.cull_mode = BaseMaterial3D.CULL_FRONT
	_outline_mat.grow = true
	_outline_mat.grow_amount = 0.0035
	_outline_mat.albedo_color = Color(1.0, 0.86, 0.5)
	for i in 30:
		var mi := MeshInstance3D.new()
		mi.material_override = _outline_mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.hide()
		add_child(mi)
		_outlines.append(mi)


func _exit_tree() -> void:
	for p: P in all:
		if p.body.is_valid():
			PhysicsServer3D.free_rid(p.body)
		p.g = null
	# Pieces and their groups point at each other; break the loop so a restart frees them.
	for g: Group in groups.values():
		g.members.clear()
	all.clear()
	by_rid.clear()


func set_loose(p: P, xf: Transform3D) -> void:
	p.state = LOOSE
	p.xf = xf
	p.g.mm.set_instance_transform(p.gi, xf)
	PhysicsServer3D.body_set_state(p.body, PhysicsServer3D.BODY_STATE_TRANSFORM, xf)
	PhysicsServer3D.body_set_collision_layer(p.body, Item.LAYER_ITEMS)


## Lifts a piece out of the world (into a hand, a flight or a box).
func take(p: P, new_state := HELD) -> void:
	p.state = new_state
	p.g.mm.set_instance_transform(p.gi, _hidden)
	PhysicsServer3D.body_set_collision_layer(p.body, 0)


func piece_at(rid: RID) -> P:
	return by_rid.get(rid, null)


## The clicked piece plus nearby loose pieces of the exact same kind, closest first.
func handful(p: P, radius := 0.32, cap := -1) -> Array:
	var near := []
	var o := p.xf.origin
	for q: P in p.g.members:
		if q.state == LOOSE and q.xf.origin.distance_to(o) < radius:
			near.append(q)
	near.sort_custom(func(a: P, b: P): return a.xf.origin.distance_squared_to(o) < b.xf.origin.distance_squared_to(o))
	if not near.has(p):
		near.push_front(p)
	return near.slice(0, p.g.handful if cap < 0 else cap)


## Every loose piece of any kind within a radius of a point, closest first (for the dustpan).
func in_radius(point: Vector3, radius: float, cap: int) -> Array:
	var near := []
	var r2 := radius * radius
	for q: P in all:
		if q.state == LOOSE and q.xf.origin.distance_squared_to(point) < r2:
			near.append(q)
	near.sort_custom(func(a: P, b: P): return a.xf.origin.distance_squared_to(point) < b.xf.origin.distance_squared_to(point))
	return near.slice(0, cap)


## Loose pieces that belong in a given edition's box.
func loose_for(ed: String) -> Array:
	return all.filter(func(q: P): return q.g.ed == ed and (q.state == LOOSE or q.state == PHYS))


func loose_count(g: Group) -> int:
	return g.members.filter(func(q: P): return q.state == LOOSE or q.state == PHYS).size()


func proxy(p: P) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = p.g.mesh
	add_child(mi)
	mi.global_transform = p.xf
	return mi


func show_outline(list: Array) -> void:
	for i in _outlines.size():
		var mi := _outlines[i]
		if i < list.size():
			var p: P = list[i]
			mi.mesh = p.g.mesh
			mi.transform = p.xf
			mi.show()
		else:
			mi.hide()


## Gives a piece real physics, for when it's dropped or tossed.
func drop(p: P, xf: Transform3D, vel: Vector3) -> RigidBody3D:
	p.state = PHYS
	var rb := RigidBody3D.new()
	rb.collision_layer = LAYER_PHYS
	rb.collision_mask = Item.LAYER_WORLD | Item.LAYER_ITEMS | LAYER_PHYS
	rb.mass = 0.03
	rb.continuous_cd = true
	rb.contact_monitor = true
	rb.max_contacts_reported = 1
	var pm := PhysicsMaterial.new()
	pm.friction = 0.85
	pm.bounce = 0.15
	rb.physics_material_override = pm
	var mi := MeshInstance3D.new()
	mi.mesh = p.g.mesh
	rb.add_child(mi)
	var cs := CollisionShape3D.new()
	cs.shape = p.g.shape
	cs.position = p.g.shape_off
	rb.add_child(cs)
	rb.set_meta("piece", p)
	add_child(rb)
	rb.global_transform = xf
	rb.linear_velocity = vel
	rb.angular_velocity = Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5) * 6.0
	var born := Time.get_ticks_msec()
	rb.body_entered.connect(func(_b):
		if Time.get_ticks_msec() - born > 60 and rb.linear_velocity.length() > 0.35:
			clacked.emit(rb.global_position, clampf(rb.linear_velocity.length() / 3.0, 0.1, 1.0)))
	_phys.append({"rb": rb, "p": p, "t": 0.0})
	return rb


## A box grabbed a flying piece: hand back the piece and a stand-in to animate.
func claim(rb: RigidBody3D) -> Array:
	for i in _phys.size():
		if _phys[i].rb == rb:
			var p: P = _phys[i].p
			_phys.remove_at(i)
			var mi := proxy(p)
			mi.global_transform = rb.global_transform
			rb.queue_free()
			return [p, mi]
	return []


func _physics_process(dt: float) -> void:
	for i in range(_phys.size() - 1, -1, -1):
		var e: Dictionary = _phys[i]
		var rb: RigidBody3D = e.rb
		e.t += dt
		var p: P = e.p
		if rb.global_position.y < -1.0:
			_phys.remove_at(i)
			rb.queue_free()
			var home: Vector3 = p.home.center
			set_loose(p, Transform3D(Basis(Vector3.UP, randf() * TAU), home + Vector3(0, p.g.aabb_table.size.y * 0.5 + 0.02, 0)))
			continue
		if e.t > 0.5 and (rb.sleeping or (rb.linear_velocity.length() < 0.02 and rb.angular_velocity.length() < 0.2) or e.t > 6.0):
			_phys.remove_at(i)
			set_loose(p, rb.global_transform)
			rb.queue_free()
