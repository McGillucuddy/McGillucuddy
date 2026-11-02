class_name Props
## Furniture and decor from Poly Haven (CC0), in assets/models. Each model is wrapped so its
## footprint is centred on the wrapper's origin with its base at y = 0, then sized to fit.

const PATH := "res://assets/models/%s/%s_1k.gltf"

static var _scenes := {}


## The model, wrapped: base centred on the origin.
static func make(id: String) -> Node3D:
	if not _scenes.has(id):
		_scenes[id] = load(PATH % [id, id])
	var ps: PackedScene = _scenes[id]
	var wrap := Node3D.new()
	wrap.name = id
	if ps == null:
		push_warning("missing model " + id)
		return wrap
	var model: Node3D = ps.instantiate()
	wrap.add_child(model)
	var bb := bounds(wrap)
	model.position = -Vector3(bb.get_center().x, bb.position.y, bb.get_center().z)
	return wrap


## The model sized to fit: size components of 0 are left free. With stretch, each given axis is
## scaled to match exactly (for tables, whose tops must sit at a set height); otherwise the
## model keeps its proportions and fits inside the given size.
static func fit(id: String, size: Vector3, stretch := false) -> Node3D:
	var w := make(id)
	var bb := bounds(w)
	var k := Vector3.ONE
	if stretch:
		for a in 3:
			if size[a] > 0.0 and bb.size[a] > 0.0001:
				k[a] = size[a] / bb.size[a]
		var free := []
		var given := []
		for a in 3:
			if size[a] > 0.0:
				given.append(k[a])
		var avg := 1.0
		for g: float in given:
			avg += g
		avg = (avg - 1.0) / maxf(1.0, given.size())
		for a in 3:
			if size[a] <= 0.0:
				k[a] = avg
	else:
		var s := INF
		for a in 3:
			if size[a] > 0.0 and bb.size[a] > 0.0001:
				s = minf(s, size[a] / bb.size[a])
		k = Vector3.ONE * (s if s < INF else 1.0)
	w.scale = k
	return w


## Bounding box of every mesh under node, in node's own space.
static func bounds(node: Node3D) -> AABB:
	var bb := AABB()
	var first := true
	var stack := [[node, Transform3D()]]
	while not stack.is_empty():
		var e: Array = stack.pop_back()
		var n: Node = e[0]
		var xf: Transform3D = e[1]
		for c in n.get_children():
			if c is Node3D:
				var cx: Transform3D = xf * (c as Node3D).transform
				if c is MeshInstance3D and (c as MeshInstance3D).mesh:
					var b := cx * (c as MeshInstance3D).mesh.get_aabb()
					bb = b if first else bb.merge(b)
					first = false
				stack.append([c, cx])
	return bb
