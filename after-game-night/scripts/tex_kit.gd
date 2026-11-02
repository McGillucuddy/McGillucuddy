class_name TexKit
## Procedural surface materials for the house: each one is an albedo texture with natural
## variation plus a normal map made from a matching height map, so lamplight picks out
## wood grain, plank seams, mortar, paper fibre and the weave of fabric.
## Everything is mapped in world space (triplanar), so no UVs are needed.

const N := 512

static var _cache := {}


## Builds a world-space material from an albedo image and a height image.
static func _material(albedo: Image, height: Image, scale: float, rough: float, bump: float, normal_scale: float) -> StandardMaterial3D:
	albedo.generate_mipmaps()
	var m := StandardMaterial3D.new()
	m.albedo_texture = ImageTexture.create_from_image(albedo)
	height.bump_map_to_normal_map(bump)
	height.generate_mipmaps()
	m.normal_enabled = true
	m.normal_texture = ImageTexture.create_from_image(height)
	m.normal_scale = normal_scale
	m.roughness = rough
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3.ONE * scale
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return m


## Tileable noise, 0..1, as raw bytes (one per pixel).
static func _noise(n: int, seed_val: int, freq: float, octaves := 4, cellular := false) -> PackedByteArray:
	var fn := FastNoiseLite.new()
	fn.seed = seed_val
	fn.frequency = freq
	fn.fractal_octaves = octaves
	fn.noise_type = FastNoiseLite.TYPE_CELLULAR if cellular else FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	var img := fn.get_seamless_image(n, n)
	img.convert(Image.FORMAT_L8)
	return img.get_data()


static func _put(rgb: PackedByteArray, i: int, c: Color) -> void:
	rgb[i * 3] = int(clampf(c.r, 0.0, 1.0) * 255.0)
	rgb[i * 3 + 1] = int(clampf(c.g, 0.0, 1.0) * 255.0)
	rgb[i * 3 + 2] = int(clampf(c.b, 0.0, 1.0) * 255.0)


static func _images(n: int, rgb: PackedByteArray, h: PackedByteArray) -> Array:
	return [Image.create_from_data(n, n, false, Image.FORMAT_RGB8, rgb), Image.create_from_data(n, n, false, Image.FORMAT_L8, h)]


static func _shade(c: Color, k: float) -> Color:
	return Color(c.r * k, c.g * k, c.b * k)


# ---------------------------------------------------------------- photo-scanned materials

## A Poly Haven material (CC0) from assets/textures: colour, normal and roughness maps,
## mapped in world space. tint multiplies the colour, so one plaster can be any paint colour.
static func pbr(id: String, scale := 0.5, tint := Color.WHITE, rough := 1.0) -> StandardMaterial3D:
	var key := "pbr%s%.2f%s%.2f" % [id, scale, tint.to_html(), rough]
	if _cache.has(key):
		return _cache[key]
	var base := "res://assets/textures/%s/%s_%s_1k.jpg"
	var m := StandardMaterial3D.new()
	m.albedo_texture = load(base % [id, id, "diff"])
	m.albedo_color = tint
	m.normal_enabled = true
	m.normal_texture = load(base % [id, id, "nor_gl"])
	m.roughness_texture = load(base % [id, id, "rough"])
	m.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
	m.roughness = rough
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3.ONE * scale
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	_cache[key] = m
	return m


# ---------------------------------------------------------------- wood

## Floorboards: staggered planks with their own tint, flowing grain, the odd knot, and
## bevelled seams between boards.
static func planks(base: Color, seed_val := 3, scale := 0.45, rough := 0.55, boards := 6) -> StandardMaterial3D:
	var key := "planks%s%d%.2f%d" % [base.to_html(), seed_val, scale, boards]
	if _cache.has(key):
		return _cache[key]
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_val
	var bw := N / boards
	var wave := _noise(N, seed_val, 0.012, 3)
	var fine := _noise(N, seed_val + 1, 0.06, 2)
	# Each board is cut into two or three lengths at random heights.
	var cuts := []
	var tints := []
	for b in boards + 1:
		var c := [rng.randi_range(0, N - 1)]
		if rng.randf() < 0.6:
			c.append((c[0] + rng.randi_range(N / 3, N * 2 / 3)) % N)
		c.sort()
		cuts.append(c)
		var t := []
		for k in 4:
			t.append(rng.randf_range(0.8, 1.12))
		tints.append(t)
	var knots := []
	for k in 5:
		knots.append(Vector2(rng.randi_range(0, N - 1), rng.randi_range(0, N - 1)))
	var rgb := PackedByteArray()
	rgb.resize(N * N * 3)
	var h := PackedByteArray()
	h.resize(N * N)
	for y in N:
		for x in N:
			var i := y * N + x
			var b := x / bw
			var u := x - b * bw
			var c: Array = cuts[b]
			var seg := 0
			var to_cut := N
			for cy: int in c:
				if y >= cy:
					seg += 1
				to_cut = mini(to_cut, absi(y - cy))
			var w := wave[(y / 5) * N + x] / 255.0
			var f := fine[(y / 8 * N + x) % (N * N)] / 255.0
			var ring := 0.5 + 0.5 * sin((u + w * 16.0 + seg * 13.0) * 0.7)
			var k: float = tints[b][seg % 4]
			var col := _shade(base, k * (0.86 + 0.12 * ring + 0.1 * (f - 0.5)))
			var height := 0.62 + 0.06 * ring + 0.05 * f
			for kn: Vector2 in knots:
				var d := Vector2(x, y).distance_to(kn)
				if d < 14.0:
					col = _shade(col, lerpf(0.7, 1.0, d / 14.0))
					height -= 0.08 * (1.0 - d / 14.0)
			# Seams: a dark gap and a soft bevel either side of it.
			var edge := mini(mini(u, bw - 1 - u), to_cut)
			if edge < 2:
				col = _shade(base, 0.38)
				height = 0.15
			elif edge < 6:
				var t := (edge - 2) / 4.0
				col = _shade(col, lerpf(0.78, 1.0, t))
				height *= lerpf(0.55, 1.0, t)
			_put(rgb, i, col)
			h[i] = int(clampf(height, 0.0, 1.0) * 255.0)
	var imgs := _images(N, rgb, h)
	var m := _material(imgs[0], imgs[1], scale, rough, 3.0, 1.0)
	_cache[key] = m
	return m


## Solid wood for furniture: fine grain without seams.
static func wood(base: Color, rough := 0.5, scale := 1.4) -> StandardMaterial3D:
	var key := "wood%s%.2f%.2f" % [base.to_html(), rough, scale]
	if _cache.has(key):
		return _cache[key]
	var n := 256
	var wave := _noise(n, 41, 0.02, 3)
	var fine := _noise(n, 42, 0.09, 2)
	var rgb := PackedByteArray()
	rgb.resize(n * n * 3)
	var h := PackedByteArray()
	h.resize(n * n)
	for y in n:
		for x in n:
			var i := y * n + x
			var w := wave[(y / 5) * n + x] / 255.0
			var f := fine[(y / 6 * n + x) % (n * n)] / 255.0
			var ring := 0.5 + 0.5 * sin((x + w * 14.0) * 0.6)
			_put(rgb, i, _shade(base, 0.84 + 0.14 * ring + 0.1 * (f - 0.5)))
			h[i] = int((0.5 + 0.12 * ring + 0.08 * f) * 255.0)
	var imgs := _images(n, rgb, h)
	var m := _material(imgs[0], imgs[1], scale, rough, 2.0, 0.6)
	_cache[key] = m
	return m


# ---------------------------------------------------------------- masonry

## Blocks in running bond, chipped at the edges, mottled, set in recessed mortar.
static func masonry(palette: Array, mortar: Color, cols: int, rows: int, chip: float, seed_val: int, scale: float, rough := 0.92) -> StandardMaterial3D:
	var key := "masonry%s%d%d%d" % [mortar.to_html(), cols, rows, seed_val]
	if _cache.has(key):
		return _cache[key]
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_val
	var bw := N / cols
	var bh := N / rows
	var blotch := _noise(N, seed_val, 0.02, 4)
	var grit := _noise(N, seed_val + 3, 0.14, 2)
	var ragged := _noise(N, seed_val + 7, 0.05, 3)
	var tint := {}
	for r in rows:
		for c in cols + 1:
			tint[Vector2i(c, r)] = [palette[rng.randi_range(0, palette.size() - 1)], rng.randf_range(0.9, 1.08)]
	var rgb := PackedByteArray()
	rgb.resize(N * N * 3)
	var h := PackedByteArray()
	h.resize(N * N)
	for y in N:
		var r := y / bh
		var off := 0 if r % 2 == 0 else bw / 2
		for x in N:
			var i := y * N + x
			var xs := (x + off) % N
			var c := xs / bw
			var dx := mini(xs - c * bw, bw - 1 - (xs - c * bw))
			var dy := mini(y - r * bh, bh - 1 - (y - r * bh))
			var d := float(mini(dx, dy)) - chip * (ragged[i] / 255.0)
			var g := grit[i] / 255.0
			var bl := blotch[i] / 255.0
			var t: Array = tint[Vector2i(c % (cols + 1), r)]
			var col: Color
			var height: float
			if d < 2.5:
				col = _shade(mortar, 0.85 + 0.3 * g)
				height = 0.12 + 0.1 * g
			else:
				var bevel := smoothstep(2.5, 9.0, d)
				col = _shade(t[0] as Color, float(t[1]) * (0.8 + 0.28 * bl + 0.12 * (g - 0.5)) * lerpf(0.8, 1.0, bevel))
				height = 0.35 + 0.45 * bevel + 0.12 * bl + 0.06 * g
			_put(rgb, i, col)
			h[i] = int(clampf(height, 0.0, 1.0) * 255.0)
	var imgs := _images(N, rgb, h)
	var m := _material(imgs[0], imgs[1], scale, rough, 5.0, 1.2)
	_cache[key] = m
	return m


static func stone(scale := 0.55) -> StandardMaterial3D:
	return masonry([Color("6d6a66"), Color("5d5a57"), Color("7a7570"), Color("54504c"), Color("847e76"), Color("6a6258")], Color("2e2a27"), 4, 8, 10.0, 23, scale)


static func brick(scale := 1.6) -> StandardMaterial3D:
	return masonry([Color("8e4632"), Color("7a3b2b"), Color("9c5539"), Color("6e3527"), Color("a0624a")], Color("4a3b34"), 4, 8, 3.0, 11, scale, 0.9)


# ---------------------------------------------------------------- walls

## Striped wallpaper on fibrous paper, with a little dot motif between the stripes.
static func wallpaper(a: Color, b: Color, scale := 0.9) -> StandardMaterial3D:
	var key := "paper%s%s" % [a.to_html(), b.to_html()]
	if _cache.has(key):
		return _cache[key]
	var fibre := _noise(N, 5, 0.25, 2)
	var cloud := _noise(N, 6, 0.01, 3)
	var rgb := PackedByteArray()
	rgb.resize(N * N * 3)
	var h := PackedByteArray()
	h.resize(N * N)
	var period := 128.0
	for y in N:
		for x in N:
			var i := y * N + x
			var p := fmod(float(x), period)
			# A soft-edged stripe flanked by two hairlines.
			var s := smoothstep(44.0, 47.0, p) * (1.0 - smoothstep(77.0, 80.0, p))
			s = maxf(s, 1.0 - smoothstep(0.0, 1.5, absf(p - 38.0)))
			s = maxf(s, 1.0 - smoothstep(0.0, 1.5, absf(p - 86.0)))
			var dot_c := Vector2(fmod(float(x) + 64.0, period) - 64.0, fmod(float(y), 64.0) - 32.0)
			var dot := 1.0 - smoothstep(4.0, 6.0, dot_c.length())
			var f := fibre[i] / 255.0
			var cl := cloud[i] / 255.0
			var col := a.lerp(b, s).lerp(b.darkened(0.15), dot)
			col = _shade(col, 0.95 + 0.06 * (f - 0.5) + 0.06 * (cl - 0.5))
			_put(rgb, i, col)
			h[i] = int(clampf(0.5 + 0.12 * f + 0.1 * dot + 0.04 * s, 0.0, 1.0) * 255.0)
	var imgs := _images(N, rgb, h)
	var m := _material(imgs[0], imgs[1], scale, 0.9, 1.5, 0.5)
	_cache[key] = m
	return m


## Flocked damask: a gilded diamond lattice with a raised velvet motif in each diamond.
static func damask(a: Color, b: Color, gilt: Color, scale := 0.7) -> StandardMaterial3D:
	var key := "damask%s%s" % [a.to_html(), b.to_html()]
	if _cache.has(key):
		return _cache[key]
	var fibre := _noise(N, 8, 0.25, 2)
	var rgb := PackedByteArray()
	rgb.resize(N * N * 3)
	var h := PackedByteArray()
	h.resize(N * N)
	var cell := 128.0
	for y in N:
		for x in N:
			var i := y * N + x
			var u := absf(fmod(x + 0.5, cell) - cell / 2.0)
			var v := absf(fmod(y + 0.5, cell) - cell / 2.0)
			var d := u + v
			var line := 1.0 - smoothstep(1.5, 3.5, absf(d - cell / 2.0 + 4.0))
			# A four-petalled flock motif in the middle of each diamond.
			var pu := u / 22.0
			var pv := v / 22.0
			var petal := 1.0 - smoothstep(0.9, 1.1, pu * pu * 2.0 + pv * pv * 0.6) * smoothstep(0.9, 1.1, pv * pv * 2.0 + pu * pu * 0.6)
			var f := fibre[i] / 255.0
			var col := a.lerp(b, petal * 0.9)
			col = _shade(col, 0.94 + 0.08 * (f - 0.5) - (0.06 if d > cell / 2.0 else 0.0))
			col = col.lerp(gilt, line)
			_put(rgb, i, col)
			h[i] = int(clampf(0.45 + 0.2 * petal + 0.15 * line + 0.06 * f, 0.0, 1.0) * 255.0)
	var imgs := _images(N, rgb, h)
	var m := _material(imgs[0], imgs[1], scale, 0.85, 2.5, 0.7)
	_cache[key] = m
	return m


## Painted wainscoting: raised and bevelled panels in a frame. The texture repeats every
## 0.95 m, so with a scale of 1/0.95 one row of panels fills a 0.95 m high wainscot.
static func panels(c: Color, rough := 0.6) -> StandardMaterial3D:
	var key := "panels%s" % c.to_html()
	if _cache.has(key):
		return _cache[key]
	var n := 256
	var grain := _noise(n, 9, 0.05, 2)
	var rgb := PackedByteArray()
	rgb.resize(n * n * 3)
	var h := PackedByteArray()
	h.resize(n * n)
	var m0 := 30.0
	for y in n:
		for x in n:
			var i := y * n + x
			# Distance in from the panel's edge (one panel per tile, with a frame around it).
			var dx := minf(x - m0, n - 1 - m0 - x)
			var dy := minf(y - m0 * 1.2, n - 1 - m0 * 0.8 - y)
			var d := minf(dx, dy)
			var height: float
			var k := 1.0
			if d < 0.0:
				height = 0.6
			elif d < 3.0:
				height = 0.35
				k = 0.8
			elif d < 14.0:
				var t := (d - 3.0) / 11.0
				height = lerpf(0.4, 0.75, t)
				k = lerpf(0.88, 1.02, t)
			else:
				height = 0.75
				k = 1.02
			var g := grain[i] / 255.0
			_put(rgb, i, _shade(c, k * (0.96 + 0.06 * (g - 0.5))))
			h[i] = int(clampf(height + 0.02 * g, 0.0, 1.0) * 255.0)
	var imgs := _images(n, rgb, h)
	var m := _material(imgs[0], imgs[1], 1.0 / 0.95, rough, 4.0, 1.0)
	_cache[key] = m
	return m


## A hobby pegboard: fibreboard with a grid of drilled holes.
static func pegboard(board: Color, scale := 1.6) -> StandardMaterial3D:
	var key := "peg%s" % board.to_html()
	if _cache.has(key):
		return _cache[key]
	var n := 256
	var fibre := _noise(n, 12, 0.2, 2)
	var rgb := PackedByteArray()
	rgb.resize(n * n * 3)
	var h := PackedByteArray()
	h.resize(n * n)
	for y in n:
		for x in n:
			var i := y * n + x
			var d := Vector2(fmod(x, 32.0) - 16.0, fmod(y, 32.0) - 16.0).length()
			var hole := 1.0 - smoothstep(3.5, 5.0, d)
			var f := fibre[i] / 255.0
			_put(rgb, i, _shade(board, (0.95 + 0.08 * (f - 0.5)) * lerpf(1.0, 0.25, hole)))
			h[i] = int(clampf(0.7 - 0.6 * hole + 0.05 * f, 0.0, 1.0) * 255.0)
	var imgs := _images(n, rgb, h)
	var m := _material(imgs[0], imgs[1], scale, 0.85, 3.0, 1.0)
	_cache[key] = m
	return m


# ---------------------------------------------------------------- soft things

## Woven fabric: over-under threads with a little fuzz. For upholstery, rugs and curtains.
static func fabric(c: Color, scale := 9.0, rough := 0.95) -> StandardMaterial3D:
	var key := "fabric%s%.1f" % [c.to_html(), scale]
	if _cache.has(key):
		return _cache[key]
	var n := 128
	var fuzz := _noise(n, 14, 0.3, 2)
	var rgb := PackedByteArray()
	rgb.resize(n * n * 3)
	var h := PackedByteArray()
	h.resize(n * n)
	var t := 8
	for y in n:
		for x in n:
			var i := y * n + x
			var cx := x / t
			var cy := y / t
			var over := (cx + cy) % 2 == 0
			var along := float(x % t if over else y % t) / t
			var across := float(y % t if over else x % t) / t
			var thread := sin(across * PI) * (0.75 + 0.25 * sin(along * PI))
			var f := fuzz[i] / 255.0
			_put(rgb, i, _shade(c, 0.78 + 0.26 * thread + 0.08 * (f - 0.5)))
			h[i] = int(clampf(0.25 + 0.6 * thread + 0.08 * f, 0.0, 1.0) * 255.0)
	var imgs := _images(n, rgb, h)
	var m := _material(imgs[0], imgs[1], scale, rough, 2.0, 0.8)
	_cache[key] = m
	return m


## Felt: a soft, slightly mottled nap, for card and dice tables.
static func felt(c: Color, scale := 3.0) -> StandardMaterial3D:
	var key := "felt%s" % c.to_html()
	if _cache.has(key):
		return _cache[key]
	var n := 256
	var nap := _noise(n, 16, 0.35, 2)
	var cloud := _noise(n, 17, 0.02, 3)
	var rgb := PackedByteArray()
	rgb.resize(n * n * 3)
	var h := PackedByteArray()
	h.resize(n * n)
	for i in n * n:
		var f := nap[i] / 255.0
		var cl := cloud[i] / 255.0
		_put(rgb, i, _shade(c, 0.92 + 0.1 * (f - 0.5) + 0.1 * (cl - 0.5)))
		h[i] = int(clampf(0.5 + 0.3 * (f - 0.5), 0.0, 1.0) * 255.0)
	var imgs := _images(n, rgb, h)
	var m := _material(imgs[0], imgs[1], scale, 1.0, 1.0, 0.4)
	_cache[key] = m
	return m
