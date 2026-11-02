extends SceneTree
## Close-up turnaround of every figurine model (front and three-quarter view).
##   godot --path . --rendering-driver opengl3 --resolution 1600x900 --script res://tools/figures.gd -- <out_dir>

func _init() -> void:
	var out_dir: String = OS.get_cmdline_user_args()[0]
	await process_frame
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("2a211c")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(1.0, 0.9, 0.8)
	env.ambient_light_energy = 0.35
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.8, 0.6, 0)
	sun.light_energy = 1.0
	sun.shadow_enabled = true
	root.add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.rotation = Vector3(-0.4, -2.4, 0)
	fill.light_energy = 0.5
	fill.light_color = Color(0.75, 0.82, 1.0)
	root.add_child(fill)
	var cols := [Color("6a9a3a"), Color("6a9a3a"), Color("b0302c"), Color("e8e0cc"), Color("b0302c")]
	var x := 0.0
	for i in MeshKit.FIGURES.size():
		var t: String = MeshKit.FIGURES[i]
		for yaw in [0.0, 0.8]:
			var v: Node3D = MeshKit.piece(t, cols[i], Color("d8b45a"), "")[0]
			v.position = Vector3(x, 0.05, 0)
			v.rotation.y = yaw
			root.add_child(v)
			x += 0.085
		x += 0.04
	var cam := Camera3D.new()
	cam.fov = 22
	root.add_child(cam)
	cam.position = Vector3(x / 2.0 - 0.05, 0.2, 1.45)
	cam.look_at(Vector3(x / 2.0 - 0.05, 0.075, 0))
	cam.current = true
	for i in 8:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("%s/figures.png" % out_dir)
	quit()
