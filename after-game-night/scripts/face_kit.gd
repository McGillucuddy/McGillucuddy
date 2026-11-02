class_name FaceKit
extends RefCounted
## Card fronts. Every card set gets a sheet of eight distinct faces, drawn once in an offscreen
## viewport: a frame in the set's colours, a named title bar, an illustrated art window, a type line,
## rules text and a cost gem. Casino decks get real playing-card faces with ranks and suits.
## Each face is a material that shows one cell of the sheet; holofoils and neon cards get their own finish.

const CW := 240
const CH := 335
## Faces are laid out on a 192 x 268 design grid and scaled up to the sheet resolution.
const DW := 192
const DH := 268
const K := float(CW) / DW
const COLS := 4
const ROWS := 2

static var _cache := {}
static var _holo_face: Shader

## Words for the generated card names, per game line.
const NAMES := {
	"crowns": [["Iron", "Mossy", "Thorn", "Fen", "Royal", "Wild", "Oaken", "Grim"], ["Charge", "Vanguard", "Shield Wall", "Ambush", "Banner", "Oath", "Siege", "Rally"]],
	"plum": [["Velvet", "Midnight", "Honeyed", "Silver", "Gilded", "Secret", "Fragrant", "Polite"], ["Tea", "Butler", "Waltz", "Toast", "Rumor", "Scone", "Soiree", "Duchess"]],
	"atlas": [["Comet", "Nebula", "Solar", "Lunar", "Distant", "Shimmering", "Silent", "Bright"], ["Passage", "Beacon", "Drift", "Orbit", "Chart", "Flare", "Eclipse", "Voyage"]],
	"harbor": [["Lantern", "Salt", "Storm", "Harbor", "Tide", "Brass", "Foggy", "Lucky"], ["Run", "Cargo", "Gale", "Market", "Ferry", "Light", "Anchor", "Trade"]],
	"honey": [["Golden", "Clover", "Busy", "Sweet", "Wild", "Amber", "Sunlit", "Buzzing"], ["Hive", "Bloom", "Drone", "Nectar", "Comb", "Meadow", "Queen", "Pollen"]],
	"orchard": [["Russet", "Early", "Harvest", "Cider", "Orchard", "Sunny", "Crisp", "Bountiful"], ["Apple", "Basket", "Press", "Frost", "Fair", "Grove", "Ladder", "Bushel"]],
	"wyrm": [["Arcane", "Shadow", "Flame", "Frost", "Ancient", "Cursed", "Holy", "Hidden"], ["Bolt", "Ward", "Wyrm", "Blade", "Ritual", "Hoard", "Familiar", "Rune"]],
	"ccg": [["Prismatic", "Ember", "Tidal", "Verdant", "Umbral", "Aurora", "Radiant", "Feral"], ["Dragon", "Sprite", "Golem", "Phoenix", "Djinn", "Sentinel", "Wisp", "Titan"]],
	"caverns": [["Deep", "Glittering", "Hollow", "Crystal", "Echoing", "Hidden", "Twisting", "Lost"], ["Vein", "Shaft", "Geode", "Lode", "Tunnel", "Seam", "Grotto", "Cavern"]],
}

const FONTS := {
	"casino": "res://fonts/alfa-slab-one-latin-400-normal.woff2",
	"ccg": "res://fonts/righteous-latin-400-normal.woff2",
}


## The eight face materials for a card set (cached, so every pile of the set shares them).
static func faces(owner: Node, line_id: String, set_name: String, back: Color, stripe: Color, style: String) -> Array:
	var key := "%s/%s/%s" % [line_id, set_name, style]
	if _cache.has(key):
		return _cache[key]
	var playing := style == "casino" or line_id == "casino"
	var vp := SubViewport.new()
	vp.size = Vector2i(CW * COLS, CH * ROWS)
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	var font: Font = load(FONTS.get(line_id, (LogoKit.SPECS.get(line_id, LogoKit.SPECS["crowns"]) as Dictionary).font))
	var rng := RandomNumberGenerator.new()
	rng.seed = key.hash()
	var art := FaceArt.new()
	art.size = Vector2(vp.size)
	art.back = back
	art.stripe = stripe
	art.style = style
	art.playing = playing
	art.line_id = line_id
	art.seed_val = key.hash()
	vp.add_child(art)
	# Card text as Labels (they render reliably; custom-drawn glyphs did not).
	for i in COLS * ROWS:
		var origin := Vector2((i % COLS) * CW, (i / COLS) * CH)
		if playing:
			var rank: String = ["A", "K", "Q", "J", "10", "7", "5", "2"][i]
			var red := i % 2 == 0
			var ink := Color("c8202e") if red else Color("1a1a1a")
			for corner in [Vector2(10, 6), Vector2(DW - 38, DH - 44)]:
				_text(vp, rank, font, int(26 * K), ink, Color(0, 0, 0, 0), 0, origin + corner * K, 28 * K)
		else:
			var words: Array = NAMES.get(line_id, NAMES["ccg"])
			var name := "%s %s" % [words[0][rng.randi_range(0, 7)], words[1][rng.randi_range(0, 7)]]
			var ink := Color("fff8ec") if style != "neon" else stripe.lightened(0.4)
			_text(vp, name, font, int(15 * K), ink, Color(0, 0, 0, 0.8), 4, origin + Vector2(14, 13) * K, (DW - 52) * K)
			_text(vp, set_name, font, int(11 * K), Color("2a1e18"), Color(0, 0, 0, 0), 0, origin + Vector2(16, 154) * K, (DW - 32) * K)
			_text(vp, str(rng.randi_range(0, 7)), font, int(17 * K), Color("ffffff"), Color(0, 0, 0, 0.8), 4, origin + Vector2(DW - 33, 11) * K, 22 * K)
	owner.add_child(vp)
	var tex := vp.get_texture()
	var mats := []
	for i in COLS * ROWS:
		var off := Vector2(float(i % COLS) / COLS, float(i / COLS) / ROWS)
		var sc := Vector2(1.0 / COLS, 1.0 / ROWS)
		mats.append(_material(tex, off, sc, style, stripe))
	_cache[key] = mats
	return mats


static func _text(vp: Node, text: String, font: Font, size: int, col: Color, outline: Color, outline_px: int, pos: Vector2, width: float) -> void:
	var ls := LabelSettings.new()
	ls.font = font
	ls.font_size = size
	ls.font_color = col
	ls.outline_size = outline_px
	ls.outline_color = outline
	var l := Label.new()
	l.text = text
	l.label_settings = ls
	l.position = pos
	l.size = Vector2(width, size * 1.4)
	l.clip_text = true
	vp.add_child(l)


static func _material(tex: Texture2D, off: Vector2, sc: Vector2, style: String, stripe: Color) -> Material:
	if style == "holo":
		if _holo_face == null:
			_holo_face = Shader.new()
			_holo_face.code = """
shader_type spatial;
render_mode cull_disabled;
uniform sampler2D face : source_color, filter_linear;
uniform vec2 uv_off;
uniform vec2 uv_scale;
void fragment() {
	vec3 f = texture(face, UV * uv_scale + uv_off).rgb;
	vec3 wv = (INV_VIEW_MATRIX * vec4(VIEW, 0.0)).xyz;
	vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float band = fract(dot(wv, vec3(1.3, 0.7, 1.1)) * 1.4 + (wp.x + wp.z) * 9.0);
	vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (band + vec3(0.0, 0.33, 0.67)));
	ALBEDO = mix(f, f * 0.6 + rainbow * 0.6, 0.45);
	METALLIC = 0.5;
	ROUGHNESS = 0.2;
	EMISSION = rainbow * 0.18 + f * 0.05;
}
"""
		var sm := ShaderMaterial.new()
		sm.shader = _holo_face
		sm.set_shader_parameter("face", tex)
		sm.set_shader_parameter("uv_off", off)
		sm.set_shader_parameter("uv_scale", sc)
		return sm
	var m := StandardMaterial3D.new()
	m.albedo_texture = tex
	m.uv1_offset = Vector3(off.x, off.y, 0)
	m.uv1_scale = Vector3(sc.x, sc.y, 1)
	# Matte card stock, so a lamp overhead doesn't wash the printing out.
	m.roughness = 0.85
	m.metallic_specular = 0.2
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	if style == "neon":
		m.emission_enabled = true
		m.emission_texture = tex
		m.emission_energy_multiplier = 1.1
	return m


## Draws the non-text parts of all eight faces.
class FaceArt:
	extends Control
	var back := Color.WHITE
	var stripe := Color.WHITE
	var style := ""
	var playing := false
	var line_id := ""
	var seed_val := 0

	func _draw() -> void:
		var rng := RandomNumberGenerator.new()
		rng.seed = seed_val
		draw_set_transform(Vector2.ZERO, 0.0, Vector2(K, K))
		for i in COLS * ROWS:
			var o := Vector2((i % COLS) * DW, (i / COLS) * DH)
			if playing:
				_playing_face(o, i)
			else:
				_game_face(o, i, rng)

	func _rr(r: Rect2, col: Color, rad := 10.0) -> void:
		rad = minf(rad, minf(r.size.x, r.size.y) / 2.0)
		draw_rect(Rect2(r.position.x + rad, r.position.y, r.size.x - rad * 2, r.size.y), col)
		draw_rect(Rect2(r.position.x, r.position.y + rad, r.size.x, r.size.y - rad * 2), col)
		for c in [r.position + Vector2(rad, rad), Vector2(r.end.x - rad, r.position.y + rad), Vector2(r.position.x + rad, r.end.y - rad), r.end - Vector2(rad, rad)]:
			draw_circle(c, rad, col)

	func _game_face(o: Vector2, i: int, rng: RandomNumberGenerator) -> void:
		var neon := style == "neon"
		# Each set's own colour drives the frame and art, so sets are easy to tell apart.
		var frame := stripe.darkened(0.5) if not neon else Color("120e18")
		var trim := stripe
		draw_rect(Rect2(o, Vector2(DW, DH)), Color("15100e"))
		_rr(Rect2(o + Vector2(3, 3), Vector2(DW - 6, DH - 6)), frame, 12)
		_rr(Rect2(o + Vector2(8, 8), Vector2(DW - 16, DH - 16)), trim if not neon else Color("1c1626"), 9)
		if neon:
			for k in 2:
				var r := Rect2(o + Vector2(8 + k * 2, 8 + k * 2), Vector2(DW - 16 - k * 4, DH - 16 - k * 4))
				draw_rect(r, stripe, false, 2.0)
		# Title bar.
		_rr(Rect2(o + Vector2(12, 12), Vector2(DW - 24, 28)), back.darkened(0.25) if not neon else Color("241a33"), 6)
		# Art window: sky, ground and a centrepiece.
		var art := Rect2(o + Vector2(14, 44), Vector2(DW - 28, 104))
		var top := stripe.lightened(0.3) if not neon else Color("2a1a4a")
		var bottom := back.darkened(0.25) if not neon else Color("0e0a18")
		for y in int(art.size.y):
			draw_rect(Rect2(art.position + Vector2(0, y), Vector2(art.size.x, 1)), top.lerp(bottom, y / art.size.y))
		var c := art.position + art.size / 2
		match i % 4:
			0:
				draw_circle(c + Vector2(30, -18), 16, Color("ffe6a0"))
				draw_colored_polygon(PackedVector2Array([art.position + Vector2(0, art.size.y), c + Vector2(-20, -10), c + Vector2(30, art.size.y / 2)]), bottom.darkened(0.3))
				draw_colored_polygon(PackedVector2Array([c + Vector2(-10, art.size.y / 2), c + Vector2(40, -4), art.end]), bottom.darkened(0.15))
			1:
				for k in 12:
					var p := art.position + Vector2(rng.randf() * art.size.x, rng.randf() * art.size.y)
					draw_circle(p, rng.randf_range(1, 3), Color("fff8e0"))
				draw_circle(c, 26, trim)
				draw_circle(c, 18, trim.lightened(0.4))
			2:
				var pts := PackedVector2Array()
				for k in 10:
					var a := -PI / 2 + k * PI / 5
					pts.append(c + Vector2(cos(a), sin(a)) * (34.0 if k % 2 == 0 else 14.0))
				draw_colored_polygon(pts, trim.lightened(0.2))
			3:
				for k in 6:
					var a := TAU * k / 6.0
					var q := PackedVector2Array()
					for j in 6:
						var b := TAU * j / 6.0
						q.append(c + Vector2(cos(a), sin(a)) * 24 + Vector2(cos(b), sin(b)) * 13)
					draw_colored_polygon(q, trim if k % 2 == 0 else trim.darkened(0.25))
		draw_rect(art, frame, false, 2.0)
		# Type line, rules text box and a cost gem.
		_rr(Rect2(o + Vector2(12, 152), Vector2(DW - 24, 18)), Color("e8dcc4") if not neon else stripe.darkened(0.3), 4)
		_rr(Rect2(o + Vector2(14, 174), Vector2(DW - 28, DH - 190)), Color("f4ead6") if not neon else Color("1a1424"), 5)
		var line_col := Color("8a7a66") if not neon else stripe.darkened(0.2)
		for k in 5:
			var w := (DW - 48) * (0.55 + rng.randf() * 0.4)
			draw_rect(Rect2(o + Vector2(22, 184 + k * 13), Vector2(w, 4)), line_col)
		draw_circle(o + Vector2(DW - 24, 26), 14, Color("1a1410"))
		draw_circle(o + Vector2(DW - 24, 26), 11, trim.darkened(0.15))

	func _playing_face(o: Vector2, i: int) -> void:
		draw_rect(Rect2(o, Vector2(DW, DH)), Color("15100e"))
		_rr(Rect2(o + Vector2(3, 3), Vector2(DW - 6, DH - 6)), Color("fbf8f0") if style != "neon" else Color("141018"), 12)
		var red := i % 2 == 0
		var ink := Color("c8202e") if red else Color("1a1a1a")
		if style == "neon":
			ink = stripe
			draw_rect(Rect2(o + Vector2(8, 8), Vector2(DW - 16, DH - 16)), stripe, false, 2.0)
		var suit := i % 4
		var c := o + Vector2(DW / 2.0, DH / 2.0)
		_suit(c, 36.0, suit, ink)
		for corner in [o + Vector2(24, 62), o + Vector2(DW - 24, DH - 62)]:
			_suit(corner, 9.0, suit, ink)
		if i < 4:
			# Court and ace cards get a framed centre panel.
			draw_rect(Rect2(o + Vector2(36, 70), Vector2(DW - 72, DH - 140)), ink, false, 3.0)

	func _suit(c: Vector2, s: float, suit: int, col: Color) -> void:
		match suit:
			0:
				draw_circle(c + Vector2(-s * 0.5, -s * 0.25), s * 0.55, col)
				draw_circle(c + Vector2(s * 0.5, -s * 0.25), s * 0.55, col)
				draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 1.0, 0), c + Vector2(s * 1.0, 0), c + Vector2(0, s * 1.1)]), col)
			1:
				draw_colored_polygon(PackedVector2Array([c + Vector2(0, -s), c + Vector2(s * 0.75, 0), c + Vector2(0, s), c + Vector2(-s * 0.75, 0)]), col)
			2:
				draw_circle(c + Vector2(0, -s * 0.45), s * 0.45, col)
				draw_circle(c + Vector2(-s * 0.5, s * 0.15), s * 0.45, col)
				draw_circle(c + Vector2(s * 0.5, s * 0.15), s * 0.45, col)
				draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 0.15, 0), c + Vector2(s * 0.15, 0), c + Vector2(s * 0.35, s * 1.0), c + Vector2(-s * 0.35, s * 1.0)]), col)
			3:
				draw_circle(c + Vector2(-s * 0.5, s * 0.2), s * 0.55, col)
				draw_circle(c + Vector2(s * 0.5, s * 0.2), s * 0.55, col)
				draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 1.0, 0), c + Vector2(s * 1.0, 0), c + Vector2(0, -s * 1.1)]), col)
				draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 0.15, s * 0.3), c + Vector2(s * 0.15, s * 0.3), c + Vector2(s * 0.35, s * 1.1), c + Vector2(-s * 0.35, s * 1.1)]), col)
