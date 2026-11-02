extends SceneTree
## A contact sheet of every imported model, each scaled to fit a cell, seen from the front (+z).
##   godot --path . --rendering-driver opengl3 --resolution 1600x900 --script res://tools/props_sheet.gd -- <out_dir>

func _init() -> void:
	var out_dir: String = OS.get_cmdline_user_args()[0]
	await process_frame
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("2a211c")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(1, 0.95, 0.9)
	env.ambient_light_energy = 0.5
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.7, 0.5, 0)
	sun.shadow_enabled = true
	root.add_child(sun)
	var ids := DirAccess.open("res://assets/models").get_directories()
	var cols := 9
	for i in ids.size():
		var p := Props.make(ids[i])
		var bb := Props.bounds(p)
		var s := 0.8 / maxf(bb.size.x, maxf(bb.size.y, bb.size.z))
		p.scale = Vector3.ONE * s
		p.position = Vector3((i % cols) * 1.0, -(i / cols) * 1.15, 0)
		root.add_child(p)
		var l := Label3D.new()
		l.text = ids[i]
		l.font_size = 28
		l.pixel_size = 0.004
		l.position = p.position + Vector3(0, -0.12, 0.4)
		root.add_child(l)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 4.9
	cam.position = Vector3((cols - 1) / 2.0, -1.4, 6)
	cam.rotation.x = -0.12
	root.add_child(cam)
	cam.current = true
	for i in 8:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("%s/props.png" % out_dir)
	quit()
