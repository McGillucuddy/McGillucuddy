class_name LogoKit
extends RefCounted
## Box logos. Each game's title is drawn like printed cover art, not typed text: its own display
## typeface, a backing plate (ribbon, cartouche, badge or sign), a drop shadow, a thick outline,
## a bevel highlight and, for some games, lettering that follows an arc.
## The result is a transparent texture used on the lid and on the front of the box.

const W := 640
const H := 262

## How each game's logo is styled.
## plate: "ribbon", "cartouche", "hex", "sign", "plaque", "none"
## arc: radius in pixels for curved lettering (0 = straight); positive bows upward.
const SPECS := {
	"crowns": {"font": "res://fonts/CinzelDecorative-Black.woff2", "fill": Color("f6d27a"), "outline": Color("1d2e14"), "edge": Color("8a6a1a"),
		"plate": "ribbon", "plate_color": Color("2f5a24"), "arc": 1500.0, "tracking": 4, "upper": false},
	"plum": {"font": "res://fonts/lobster-latin-400-normal.woff2", "fill": Color("fbe6ef"), "outline": Color("3a1436"), "edge": Color("e8b84a"),
		"plate": "cartouche", "plate_color": Color("5e2a5a"), "arc": 0.0, "tracking": 0, "upper": false, "tilt": -0.06},
	"atlas": {"font": "res://fonts/audiowide-latin-400-normal.woff2", "fill": Color("e8f0ff"), "outline": Color("141a48"), "edge": Color("7fb2ff"),
		"plate": "none", "plate_color": Color("1c2466"), "arc": 0.0, "tracking": 10, "upper": true, "glow": Color(0.5, 0.7, 1.0, 0.55)},
	"harbor": {"font": "res://fonts/alfa-slab-one-latin-400-normal.woff2", "fill": Color("fdf0d8"), "outline": Color("0f2a3a"), "edge": Color("e8b84a"),
		"plate": "plaque", "plate_color": Color("1f5f6e"), "arc": -1800.0, "tracking": 3, "upper": true},
	"honey": {"font": "res://fonts/bungee-latin-400-normal.woff2", "fill": Color("ffd23f"), "outline": Color("4a2a08"), "edge": Color("fff2b0"),
		"plate": "hex", "plate_color": Color("8a5a10"), "arc": 0.0, "tracking": 2, "upper": true},
	"orchard": {"font": "res://fonts/rye-latin-400-normal.woff2", "fill": Color("f8e8c8"), "outline": Color("3a1a0c"), "edge": Color("c8473b"),
		"plate": "sign", "plate_color": Color("7a4a26"), "arc": 0.0, "tracking": 3, "upper": false},
	"wyrm": {"font": "res://fonts/medievalsharp-latin-400-normal.woff2", "fill": Color("ffcf6a"), "outline": Color("1a0a0a"), "edge": Color("c8323a"),
		"plate": "ribbon", "plate_color": Color("6a1420"), "arc": 1600.0, "tracking": 3, "upper": false, "glow": Color(1.0, 0.45, 0.2, 0.35)},
	"caverns": {"font": "res://fonts/righteous-latin-400-normal.woff2", "fill": Color("e6fbff"), "outline": Color("2a1440"), "edge": Color("c58bff"),
		"plate": "none", "plate_color": Color("2a1440"), "arc": 0.0, "tracking": 6, "upper": true, "glow": Color(0.75, 0.55, 1.0, 0.6)},
}


## Builds the logo in an offscreen viewport parented to `owner`, and returns its texture.
static func make(owner: Node, line_id: String, title: String, subtitle: String) -> Texture2D:
	var spec: Dictionary = SPECS.get(line_id, SPECS["crowns"])
	var vp := SubViewport.new()
	vp.size = Vector2i(W, H)
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	# The plate is custom-drawn; the lettering is built from Label nodes. (Custom-drawn glyphs came
	# out as solid boxes in the compatibility renderer, while Labels render reliably.)
	var plate := LogoArt.new()
	plate.spec = spec
	plate.title = title
	plate.subtitle = subtitle
	plate.layer = "plate"
	plate.size = Vector2(W, H)
	vp.add_child(plate)
	_lettering(vp, spec, title, subtitle)
	owner.add_child(vp)
	return vp.get_texture()


## Measures the title, then stacks per-letter Labels: shadow, thick outline, bevel highlight, fill.
static func _lettering(vp: Node, spec: Dictionary, title: String, subtitle: String) -> void:
	var font: Font = load(spec.font)
	var t: String = title.to_upper() if spec.upper else title
	var track: int = spec.tracking
	var fs := 92
	while fs > 30 and _measure(font, t, fs, track) > W * 0.84:
		fs -= 2
	var cy := H * (0.46 if subtitle != "" else 0.54)
	var holder := Control.new()
	holder.size = Vector2(W, H)
	holder.pivot_offset = Vector2(W / 2.0, cy)
	holder.rotation = spec.get("tilt", 0.0)
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vp.add_child(holder)
	var fill: Color = spec.fill
	var layers := []
	if spec.has("glow"):
		for r in [16, 10]:
			layers.append([Vector2.ZERO, Color(spec.glow, 0.0), r, spec.glow])
	layers.append([Vector2(4, 6), Color(0, 0, 0, 0.5), 12, Color(0, 0, 0, 0.5)])
	layers.append([Vector2.ZERO, spec.outline, 12, spec.outline])
	layers.append([Vector2.ZERO, spec.edge, 4, spec.edge])
	layers.append([Vector2(0, -2), fill.lightened(0.55), 0, fill])
	layers.append([Vector2(0, 1), fill, 0, fill])
	for L in layers:
		_letters(holder, font, t, fs, track, spec.arc, Vector2(W / 2.0, cy), L[0], L[1], L[2], L[3])
	if subtitle != "":
		var s := subtitle.to_upper()
		var sfs := 34
		while sfs > 16 and _measure(font, s, sfs, 4) > W * 0.6:
			sfs -= 1
		var sy := H * 0.83
		_letters(vp, font, s, sfs, 4, 0.0, Vector2(W / 2.0, sy), Vector2.ZERO, spec.outline, 5, spec.outline)
		_letters(vp, font, s, sfs, 4, 0.0, Vector2(W / 2.0, sy), Vector2.ZERO, spec.fill, 0, spec.fill)


static func _measure(font: Font, t: String, fs: int, track: int) -> float:
	return font.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x + track * (t.length() - 1)


static func _letters(parent: Node, font: Font, t: String, fs: int, track: int, arc: float, center: Vector2,
		off: Vector2, col: Color, outline: int, outline_col: Color) -> void:
	var ls := LabelSettings.new()
	ls.font = font
	ls.font_size = fs
	ls.font_color = col
	ls.outline_size = outline
	ls.outline_color = outline_col
	var ascent := font.get_ascent(fs)
	var total := _measure(font, t, fs, track)
	var base_y := fs * 0.36
	var x := -total / 2.0
	for i in t.length():
		var ch := t[i]
		var cw := font.get_string_size(ch, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		var pos := Vector2(x, base_y)
		var rot := 0.0
		if arc != 0.0:
			var ang := (x + cw / 2.0) / arc
			rot = ang
			pos = Vector2(sin(ang) * arc - cw / 2.0 * cos(ang), base_y + arc - cos(ang) * arc - cw / 2.0 * sin(ang))
		var l := Label.new()
		l.text = ch
		l.label_settings = ls
		l.mouse_filter = Control.MOUSE_FILTER_IGNORE
		# Rotate each letter about its baseline-left point, the same point used to place it.
		l.pivot_offset = Vector2(0, ascent)
		l.position = center + pos + off - Vector2(0, ascent)
		l.rotation = rot
		parent.add_child(l)
		x += cw + track


## Draws the plate behind the title (and the subtitle's plate). The lettering itself is Labels.
class LogoArt:
	extends Control
	var spec: Dictionary
	var title := ""
	var subtitle := ""
	var layer := "plate"

	func _draw() -> void:
		var font: Font = load(spec.font)
		var t: String = title.to_upper() if spec.upper else title
		var track: int = spec.tracking
		var fs := 92
		while fs > 30 and LogoKit._measure(font, t, fs, track) > W * 0.84:
			fs -= 2
		var cy := H * (0.46 if subtitle != "" else 0.54)
		_plate(font, fs, t, track, cy)
		if subtitle != "":
			var s := subtitle.to_upper()
			var sfs := 34
			while sfs > 16 and LogoKit._measure(font, s, sfs, 4) > W * 0.6:
				sfs -= 1
			var sw := LogoKit._measure(font, s, sfs, 4) + 44.0
			var y := H * 0.83
			var x0 := (W - sw) / 2.0
			draw_rect(Rect2(x0 - 4, y - sfs * 0.75 - 4, sw + 8, sfs * 1.5 + 8), spec.outline)
			draw_rect(Rect2(x0, y - sfs * 0.75, sw, sfs * 1.5), spec.edge)

	func _plate(font: Font, fs: int, t: String, track: int, cy: float) -> void:
		var pc: Color = spec.plate_color
		var edge: Color = spec.edge
		var dark: Color = spec.outline
		var pw := minf(LogoKit._measure(font, t, fs, track) + 140.0, W - 30.0)
		var ph := fs * 1.2
		var x0 := (W - pw) / 2.0
		var y0 := cy - ph / 2.0
		match spec.plate:
			"ribbon":
				# A banner with folded tails.
				var tail := 70.0
				for side: float in [-1.0, 1.0]:
					var ex := W / 2.0 + side * (pw / 2.0)
					var tail_pts := PackedVector2Array([Vector2(ex - side * 20, y0 + 26), Vector2(ex + side * tail, y0 + 26),
						Vector2(ex + side * (tail - 34), y0 + 26 + ph / 2), Vector2(ex + side * tail, y0 + ph + 26), Vector2(ex - side * 20, y0 + ph + 26)])
					draw_colored_polygon(tail_pts, pc.darkened(0.35))
				draw_rect(Rect2(x0 - 6, y0 - 6, pw + 12, ph + 12), dark)
				draw_rect(Rect2(x0, y0, pw, ph), pc)
				draw_rect(Rect2(x0, y0 + 8, pw, 5), edge)
				draw_rect(Rect2(x0, y0 + ph - 13, pw, 5), edge)
			"cartouche":
				_round_rect(Rect2(x0 - 10, y0 - 10, pw + 20, ph + 20), ph * 0.6, dark)
				_round_rect(Rect2(x0, y0, pw, ph), ph * 0.5, pc)
				_round_rect(Rect2(x0 + 12, y0 + 12, pw - 24, ph - 24), ph * 0.4, pc.lightened(0.08))
				for side: float in [-1.0, 1.0]:
					draw_circle(Vector2(W / 2.0 + side * (pw / 2.0 + 4), cy), 22, edge)
			"hex":
				var r := ph * 0.95
				for side: float in [-1.0, 0.0, 1.0]:
					var c := Vector2(W / 2.0 + side * pw * 0.36, cy)
					_hex(c, r * (1.0 if side == 0.0 else 0.75), dark)
					_hex(c, r * (0.9 if side == 0.0 else 0.66), pc if side == 0.0 else pc.darkened(0.2))
				draw_rect(Rect2(x0, cy - ph * 0.38, pw, ph * 0.76), pc)
				draw_rect(Rect2(x0, cy - ph * 0.38, pw, 6), edge)
				draw_rect(Rect2(x0, cy + ph * 0.38 - 6, pw, 6), edge)
			"sign":
				# A painted wooden sign hanging from two posts.
				for side: float in [-1.0, 1.0]:
					draw_rect(Rect2(W / 2.0 + side * pw * 0.38 - 6, 0, 12, y0), dark)
				draw_rect(Rect2(x0 - 8, y0 - 8, pw + 16, ph + 16), dark)
				draw_rect(Rect2(x0, y0, pw, ph), pc)
				for k in 4:
					draw_rect(Rect2(x0, y0 + ph * (0.2 + k * 0.2), pw, 3), pc.darkened(0.2))
				for p in [Vector2(x0 + 18, y0 + 18), Vector2(x0 + pw - 18, y0 + 18), Vector2(x0 + 18, y0 + ph - 18), Vector2(x0 + pw - 18, y0 + ph - 18)]:
					draw_circle(p, 7, edge)
			"plaque":
				_round_rect(Rect2(x0 - 8, y0 - 8, pw + 16, ph + 16), 26, edge)
				_round_rect(Rect2(x0, y0, pw, ph), 20, pc)
				_round_rect(Rect2(x0 + 10, y0 + 10, pw - 20, ph - 20), 14, pc.darkened(0.15))
			_:
				# No plate: a scatter of sparkles behind the title instead.
				var rng := RandomNumberGenerator.new()
				rng.seed = t.hash()
				for i in 26:
					var p := Vector2(rng.randf_range(x0, x0 + pw), rng.randf_range(y0 - 20, y0 + ph + 20))
					var s := rng.randf_range(4, 12)
					draw_line(p - Vector2(s, 0), p + Vector2(s, 0), edge, 2.0)
					draw_line(p - Vector2(0, s), p + Vector2(0, s), edge, 2.0)

	func _round_rect(r: Rect2, rad: float, col: Color) -> void:
		rad = minf(rad, minf(r.size.x, r.size.y) / 2.0)
		draw_rect(Rect2(r.position.x + rad, r.position.y, r.size.x - rad * 2, r.size.y), col)
		draw_rect(Rect2(r.position.x, r.position.y + rad, r.size.x, r.size.y - rad * 2), col)
		for c in [Vector2(r.position.x + rad, r.position.y + rad), Vector2(r.end.x - rad, r.position.y + rad),
				Vector2(r.position.x + rad, r.end.y - rad), Vector2(r.end.x - rad, r.end.y - rad)]:
			draw_circle(c, rad, col)

	func _hex(c: Vector2, r: float, col: Color) -> void:
		var pts := PackedVector2Array()
		for i in 6:
			var a := TAU * i / 6.0
			pts.append(c + Vector2(cos(a), sin(a)) * r)
		draw_colored_polygon(pts, col)
