extends SceneTree
## Renders a catalogue sheet for every game line: each piece model (one of every kind and colour)
## in a row per box, plus a face-up hand from each card set.
##   godot --path . --rendering-driver opengl3 --resolution 1600x900 --script res://tools/gallery.gd -- <out_dir>

const SCALE := 2.4


func _init() -> void:
	var out_dir: String = OS.get_cmdline_user_args()[0]
	await process_frame
	_scene()
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.rotation = Vector3(-0.95, 0, 0)
	root.add_child(cam)
	cam.current = true
	for line in GameData.LINES:
		var stage := Node3D.new()
		root.add_child(stage)
		var extent := _lay_out(stage, line)
		var w: float = extent.x
		var d: float = extent.y
		cam.size = maxf(d * 0.95 + 0.25, w / 1.7 + 0.2)
		cam.position = Vector3(w / 2.0 - 0.1, 3.0, d / 2.0 + 2.3)
		for i in 8:
			await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("%s/models_%s.png" % [out_dir, line.id])
		stage.free()
	quit()


func _scene() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("1e1714")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(1.0, 0.9, 0.8)
	env.ambient_light_energy = 0.3
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.glow_enabled = true
	env.glow_intensity = 0.5
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-1.0, 0.5, 0)
	sun.light_energy = 0.95
	sun.light_color = Color(1.0, 0.92, 0.82)
	sun.shadow_enabled = true
	root.add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.rotation = Vector3(-0.6, -2.4, 0)
	fill.light_energy = 0.45
	fill.light_color = Color(0.75, 0.82, 1.0)
	root.add_child(fill)
	var floor_m := StandardMaterial3D.new()
	floor_m.albedo_color = Color("1f2a24")
	floor_m.roughness = 1.0
	var floor := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(40, 40)
	floor.mesh = pm
	floor.material_override = floor_m
	floor.position = Vector3(5, -0.001, 5)
	root.add_child(floor)


func _label(text: String, size: int, col: Color) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.0011
	l.modulate = col
	l.outline_size = 10
	l.outline_modulate = Color("120c0a")
	l.rotation.x = -PI / 2
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	return l


## Returns the (width, depth) of what it laid out.
func _lay_out(stage: Node3D, line: Dictionary) -> Vector2:
	var title := _label("%s  ·  %s" % [line.name, line.tagline], 96, Color("f3c860"))
	title.position = Vector3(0, 0.001, -0.05)
	stage.add_child(title)
	var z := 0.18
	var max_x := 1.0
	for ei in line.editions.size():
		var ed: Dictionary = line.editions[ei]
		var style := GameData.edition_style(line.color, ei, ed)
		var row := _label(GameData.full_name(line, ed), 48, Color("fff1de"))
		row.position = Vector3(0, 0.001, z)
		stage.add_child(row)
		z += 0.09
		var x := 0.0
		var row_depth := 0.0
		for part in ed.parts:
			var body: Color = part[3] if part.size() > 3 else style.body
			var tint: String = part[4] if part.size() > 4 else ""
			var parts := MeshKit.piece(part[0], body, style.accent, style.get("style", ""))
			var v: Node3D = parts[0]
			var bb := MeshKit.visual_aabb(v, Vector3.ZERO)
			var s := SCALE
			var wdt := maxf(bb.size.x, bb.size.z) * s
			v.scale = Vector3.ONE * s
			v.position = Vector3(x + wdt / 2.0, -bb.position.y * s, z + wdt / 2.0)
			v.rotation.y = 0.5
			stage.add_child(v)
			var name := GameData.type_name(part[0], 1)
			var slot := maxf(wdt, 0.17)
			var cap := _label(("%s %s" % [tint, name]) if tint != "" else name, 24, Color("e8d8c4"))
			cap.position = Vector3(x, 0.001, z + wdt + 0.045)
			cap.width = slot / cap.pixel_size
			cap.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			cap.vertical_alignment = VERTICAL_ALIGNMENT_TOP
			stage.add_child(cap)
			x += maxf(wdt, 0.17) + 0.07
			row_depth = maxf(row_depth, wdt)
		max_x = maxf(max_x, x)
		z += row_depth + 0.16
	# A face-up hand from every card set.
	var hands := []
	for ei in line.editions.size():
		var ed: Dictionary = line.editions[ei]
		var style := GameData.edition_style(line.color, ei, ed)
		for si in ed.get("cards", []).size():
			var c: Array = ed.cards[si]
			var stripe: Color = GameData.SET_COLORS[si % GameData.SET_COLORS.size()]
			var back_style: String = c[2] if c.size() > 2 else ""
			var back: Color = c[3] if c.size() > 3 else style.body
			hands.append([c[0], FaceKit.faces(root, line.id, c[0], back, stripe, back_style)])
	if not hands.is_empty():
		var row := _label("Card sets", 48, Color("fff1de"))
		row.position = Vector3(0, 0.001, z)
		stage.add_child(row)
		z += 0.1
		var x := 0.0
		for h in hands:
			var hand: Node3D = MeshKit.card_hand(Color.WHITE, 5, Color.WHITE, "", h[1])[0]
			hand.scale = Vector3.ONE * 2.0
			hand.position = Vector3(x + 0.13, 0.002, z + 0.12)
			stage.add_child(hand)
			var cap := _label(h[0], 28, Color("e8d8c4"))
			cap.position = Vector3(x, 0.001, z + 0.27)
			stage.add_child(cap)
			x += 0.36
			if x > maxf(max_x, 2.2):
				x = 0.0
				z += 0.36
		max_x = maxf(max_x, minf(x, 2.6))
		z += 0.36
	return Vector2(maxf(max_x, 2.7), z)
