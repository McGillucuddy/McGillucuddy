extends SceneTree
## Close-up of every die: the board-game d6 and each polyhedral set.
##   godot --path . --rendering-driver opengl3 --resolution 1600x900 --script res://tools/dice.gd -- <out_dir>

func _init() -> void:
	var out_dir: String = OS.get_cmdline_user_args()[0]
	await process_frame
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("2a211c")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(1.0, 0.9, 0.8)
	env.ambient_light_energy = 0.4
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.9, 0.5, 0)
	sun.shadow_enabled = true
	root.add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.rotation = Vector3(-0.4, -2.4, 0)
	fill.light_energy = 0.45
	root.add_child(fill)
	var types := ["d4", "d6p", "d8", "d10", "d10p", "d12", "d20"]
	var z := 0.0
	for c in [Color("c8283c"), Color("6a9a3a"), Color("f3ead8")]:
		var d: Node3D = MeshKit.piece("die", c, Color.WHITE, "")[0]
		d.position = Vector3(-0.1 + 0.075 * [Color("c8283c"), Color("6a9a3a"), Color("f3ead8")].find(c), 0.028, -0.1)
		d.rotation = Vector3(0.0, 0.6, 0.0)
		root.add_child(d)
	var tilt := Node3D.new()
	tilt.position = Vector3(0.3, 0.03, -0.1)
	tilt.rotation = Vector3(0.5, 0.4, 0.3)
	tilt.add_child(MeshKit.piece("die", Color("2f5fa8"), Color.WHITE, "")[0])
	root.add_child(tilt)
	for line in GameData.LINES:
		if line.id != "hoard" and line.id != "wyrm":
			continue
		for ei in line.editions.size():
			var ed: Dictionary = line.editions[ei]
			var style := GameData.edition_style(line.color, ei, ed)
			var x := -0.1
			for t in types:
				if not ed.parts.any(func(p: Array): return p[0] == t):
					continue
				var v: Node3D = MeshKit.piece(t, style.body, style.accent, style.get("style", ""))[0]
				v.position = Vector3(x, 0.03, z)
				v.rotation.y = 0.5
				root.add_child(v)
				x += 0.065
			z += 0.065
	await process_frame
	await process_frame
	var cam := Camera3D.new()
	cam.fov = 30
	root.add_child(cam)
	cam.position = Vector3(0.1, 0.42, z + 0.25)
	cam.look_at(Vector3(0.1, 0.0, z * 0.4 - 0.05))
	cam.current = true
	for i in 10:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("%s/dice.png" % out_dir)
	quit()
