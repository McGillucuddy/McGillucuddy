class_name Hud
extends CanvasLayer
## On-screen text: crosshair, prompts, the checklist of games, and the title, pause and end screens.

signal start_pressed
signal resume_pressed
signal restart_pressed
signal quit_pressed
signal tool_changed(i: int)
signal buy_pressed(id: String)
signal shop_closed
signal tour_pressed
signal tour_step(dir: int)
signal tour_done

const HONEY := Color("f3b648")
const CREAM := Color("fff1de")
const DIM := Color("cbb09c")
const PANEL := Color(0.16, 0.1, 0.13, 0.82)

var _prompt_panel: PanelContainer
var _prompt: Label
var _list: VBoxContainer
var _toast_panel: PanelContainer
var _toast: Label
var _toast_tw: Tween
var _title: Control
var _pause: Control
var _end: Control
var _end_stats: Label
var _crosshair: Control
var _tidy_fill: ColorRect
var _tidy_label: Label
var _tidy_track: Control
var _streak: Label
var _streak_tw: Tween
var _tidy_shown := 0.0
var _toolbar: HBoxContainer
var _tokens_panel: PanelContainer
var _tokens: Label
var _shop: Control
var _shop_rows: VBoxContainer
var _shop_tokens: Label
var _banner: Control
var _banner_title: Label
var _banner_sub: Label
var _banner_tw: Tween
var _tour: Control
var _tour_name: Label
var _tour_sub: Label
var _tour_count: Label


class Crosshair extends Control:
	var active := false
	func _draw() -> void:
		var c := size / 2
		draw_circle(c, 4.5 if active else 3.0, Color(1, 0.95, 0.85, 0.95))
		draw_arc(c, 9.0 if active else 6.0, 0, TAU, 32, Color(0, 0, 0, 0.35), 1.5, true)


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	layer = 5
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var th := Theme.new()
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Nunito", "Quicksand", "Varela Round", "Comfortaa", "Ubuntu", "Segoe UI", "Helvetica Neue", "Arial"])
	font.font_weight = 700
	th.default_font = font
	th.default_font_size = 20
	th.set_color("font_color", "Label", CREAM)
	th.set_color("font_outline_color", "Label", Color(0.1, 0.05, 0.08))
	_style_buttons(th)
	root.theme = th
	add_child(root)

	# Soft dark edges, like lamplight falling off.
	var vig := TextureRect.new()
	var gt := GradientTexture2D.new()
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.55, 1.0])
	grad.colors = PackedColorArray([Color(0.05, 0.02, 0.02, 0.0), Color(0.05, 0.02, 0.02, 0.08), Color(0.05, 0.02, 0.02, 0.6)])
	gt.gradient = grad
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.08, 1.08)
	gt.width = 256
	gt.height = 256
	vig.texture = gt
	vig.stretch_mode = TextureRect.STRETCH_SCALE
	vig.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	vig.set_anchors_preset(Control.PRESET_FULL_RECT)
	vig.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(vig)

	_crosshair = Crosshair.new()
	_crosshair.set_anchors_preset(Control.PRESET_CENTER)
	_crosshair.custom_minimum_size = Vector2(30, 30)
	_crosshair.position = Vector2(-15, -15)
	_crosshair.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_crosshair)

	# Prompt along the bottom.
	var bottom := CenterContainer.new()
	bottom.anchor_left = 0; bottom.anchor_right = 1; bottom.anchor_top = 1; bottom.anchor_bottom = 1
	bottom.offset_top = -120; bottom.offset_bottom = -40
	bottom.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(bottom)
	_prompt_panel = _panel(PANEL)
	_prompt = Label.new()
	_prompt.add_theme_font_size_override("font_size", 22)
	_prompt_panel.add_child(_prompt)
	bottom.add_child(_prompt_panel)
	_prompt_panel.hide()

	# Toast near the top.
	var top := CenterContainer.new()
	top.anchor_left = 0; top.anchor_right = 1
	top.offset_top = 26; top.offset_bottom = 90
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(top)
	_toast_panel = _panel(Color(0.99, 0.94, 0.86, 0.95))
	_toast = Label.new()
	_toast.add_theme_color_override("font_color", Color("3b2630"))
	_toast.add_theme_font_size_override("font_size", 22)
	_toast_panel.add_child(_toast)
	top.add_child(_toast_panel)
	_toast_panel.modulate.a = 0.0

	# Checklist, top left.
	var list_panel := _panel(PANEL)
	list_panel.position = Vector2(22, 22)
	root.add_child(list_panel)
	var lv := VBoxContainer.new()
	lv.add_theme_constant_override("separation", 6)
	list_panel.add_child(lv)
	var head := Label.new()
	head.text = "TONIGHT'S GAMES"
	head.add_theme_font_size_override("font_size", 14)
	head.add_theme_color_override("font_color", HONEY)
	lv.add_child(head)
	_list = VBoxContainer.new()
	_list.add_theme_constant_override("separation", 4)
	lv.add_child(_list)

	_build_meters(root)
	_toolbar = HBoxContainer.new()
	_toolbar.anchor_top = 1; _toolbar.anchor_bottom = 1
	_toolbar.offset_left = 22; _toolbar.offset_top = -78; _toolbar.offset_bottom = -22
	_toolbar.add_theme_constant_override("separation", 8)
	_toolbar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_toolbar)
	_build_tokens(root)
	_build_shop(root)

	_title = _overlay(root, "After Game Night",
		"Everyone's gone home and the games are everywhere.\nPut every piece back in its own box, then shelve the boxes.",
		"WASD  walk     Shift  hurry     C  crouch\nClick  pick up / put in     Right-click  toss\nH  hint     Esc  pause",
		[["Start tidying", start_pressed]])
	_pause = _overlay(root, "Paused", "Take a sip of tea.", "",
		[["Keep tidying", resume_pressed], ["Start over", restart_pressed], ["Quit", quit_pressed]])
	_pause.hide()
	_end = _overlay(root, "Everything's put away", "The shelf is full and the table is clear.", "",
		[["See your collection", tour_pressed], ["Play again", restart_pressed], ["Quit", quit_pressed]])
	_end_stats = _end.get_meta("extra")
	_end.hide()
	_build_banner(root)
	_build_tour(root)


func _style_buttons(th: Theme) -> void:
	var off := StyleBoxFlat.new()
	off.bg_color = Color(0.35, 0.28, 0.24, 0.8)
	off.set_corner_radius_all(14)
	off.content_margin_left = 26; off.content_margin_right = 26
	off.content_margin_top = 12; off.content_margin_bottom = 12
	th.set_stylebox("disabled", "Button", off)
	th.set_color("font_disabled_color", "Button", Color("a89484"))
	for state in ["normal", "hover", "pressed", "focus"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = HONEY if state != "hover" else HONEY.lightened(0.15)
		if state == "pressed":
			sb.bg_color = HONEY.darkened(0.15)
		if state == "focus":
			sb.bg_color = Color(0, 0, 0, 0)
			sb.border_color = CREAM
			sb.set_border_width_all(3)
		sb.set_corner_radius_all(14)
		sb.content_margin_left = 26; sb.content_margin_right = 26
		sb.content_margin_top = 12; sb.content_margin_bottom = 12
		sb.shadow_color = Color(0, 0, 0, 0.3)
		sb.shadow_size = 0 if state == "focus" else 4
		th.set_stylebox(state, "Button", sb)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		th.set_color(c, "Button", Color("3b2630"))
	th.set_font_size("font_size", "Button", 22)


func _panel(bg: Color) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.set_corner_radius_all(14)
	sb.content_margin_left = 18; sb.content_margin_right = 18
	sb.content_margin_top = 10; sb.content_margin_bottom = 10
	p.add_theme_stylebox_override("panel", sb)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return p


func _overlay(root: Control, title: String, sub: String, small: String, buttons: Array) -> Control:
	var o := ColorRect.new()
	o.color = Color(0.09, 0.05, 0.08, 0.78)
	o.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(o)
	var cc := CenterContainer.new()
	cc.set_anchors_preset(Control.PRESET_FULL_RECT)
	o.add_child(cc)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 16)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	cc.add_child(v)
	var t := Label.new()
	t.text = title
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_font_size_override("font_size", 72)
	t.add_theme_color_override("font_color", HONEY)
	t.add_theme_constant_override("outline_size", 14)
	t.add_theme_color_override("font_outline_color", Color("5a2f10"))
	v.add_child(t)
	var s := Label.new()
	s.text = sub
	s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	s.add_theme_font_size_override("font_size", 24)
	v.add_child(s)
	var extra := Label.new()
	extra.text = small
	extra.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	extra.add_theme_font_size_override("font_size", 18)
	extra.add_theme_color_override("font_color", DIM)
	v.add_child(extra)
	o.set_meta("extra", extra)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 14)
	v.add_child(row)
	for b in buttons:
		var btn := Button.new()
		btn.text = b[0]
		var sig: Signal = b[1]
		btn.pressed.connect(func(): sig.emit())
		row.add_child(btn)
	o.set_meta("first_button", row.get_child(0))
	return o


func set_prompt(text: String) -> void:
	_prompt_panel.visible = text != ""
	_prompt.text = text
	(_crosshair as Crosshair).active = text != "" and not text.begins_with("Holding")
	_crosshair.queue_redraw()


func toast(text: String, secs := 3.0) -> void:
	_toast.text = text
	if _toast_tw:
		_toast_tw.kill()
	_toast_tw = create_tween()
	_toast_tw.tween_property(_toast_panel, "modulate:a", 1.0, 0.2)
	_toast_tw.tween_interval(secs)
	_toast_tw.tween_property(_toast_panel, "modulate:a", 0.0, 0.5)


func set_games(rows: Array) -> void:
	for c in _list.get_children():
		c.queue_free()
	for r in rows:
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 10)
		var sw := ColorRect.new()
		sw.color = r.color
		sw.custom_minimum_size = Vector2(14, 14)
		sw.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		h.add_child(sw)
		var n := Label.new()
		n.text = r.name
		n.custom_minimum_size.x = 190
		n.add_theme_font_size_override("font_size", 18)
		h.add_child(n)
		var st := Label.new()
		st.text = r.status
		st.add_theme_font_size_override("font_size", 16)
		st.add_theme_color_override("font_color", HONEY if r.done else DIM)
		h.add_child(st)
		if r.done:
			n.add_theme_color_override("font_color", DIM)
		_list.add_child(h)


func show_title(on: bool) -> void:
	_title.visible = on
	if on:
		(_title.get_meta("first_button") as Button).grab_focus()


func show_pause(on: bool) -> void:
	_pause.visible = on
	if on:
		(_pause.get_meta("first_button") as Button).grab_focus()


func show_end(stats: String) -> void:
	_end_stats.text = stats
	_end.show()
	(_end.get_meta("first_button") as Button).grab_focus()


func hide_end() -> void:
	_end.hide()


# ---------------------------------------------------------------- "sorted!" banner and collection tour

func _build_banner(root: Control) -> void:
	_banner = CenterContainer.new()
	_banner.anchor_left = 0; _banner.anchor_right = 1
	_banner.anchor_top = 0.08; _banner.anchor_bottom = 0.08
	_banner.offset_bottom = 150
	_banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner.modulate.a = 0.0
	root.add_child(_banner)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner.add_child(v)
	_banner_title = Label.new()
	_banner_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner_title.add_theme_font_size_override("font_size", 64)
	_banner_title.add_theme_color_override("font_color", HONEY)
	_banner_title.add_theme_constant_override("outline_size", 14)
	_banner_title.add_theme_color_override("font_outline_color", Color("5a2f10"))
	v.add_child(_banner_title)
	_banner_sub = Label.new()
	_banner_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner_sub.add_theme_font_size_override("font_size", 22)
	_banner_sub.add_theme_color_override("font_color", CREAM)
	_banner_sub.add_theme_constant_override("outline_size", 8)
	_banner_sub.add_theme_color_override("font_outline_color", Color(0.1, 0.05, 0.05, 0.9))
	v.add_child(_banner_sub)


## A big title across the top of the screen that pops in, holds, and fades.
func banner(title: String, sub: String, secs := 3.0) -> void:
	_banner_title.text = title
	_banner_sub.text = sub
	if _banner_tw:
		_banner_tw.kill()
	_banner.pivot_offset = _banner.size / 2
	_banner.scale = Vector2(0.85, 0.85)
	_banner_tw = create_tween().set_parallel(true)
	_banner_tw.tween_property(_banner, "modulate:a", 1.0, 0.25)
	_banner_tw.tween_property(_banner, "scale", Vector2.ONE, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_banner_tw.chain().tween_interval(secs)
	_banner_tw.chain().tween_property(_banner, "modulate:a", 0.0, 0.5)


func _build_tour(root: Control) -> void:
	_tour = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = PANEL
	sb.set_corner_radius_all(18)
	sb.content_margin_left = 28; sb.content_margin_right = 28
	sb.content_margin_top = 14; sb.content_margin_bottom = 16
	_tour.add_theme_stylebox_override("panel", sb)
	_tour.anchor_left = 0.5; _tour.anchor_right = 0.5
	_tour.anchor_top = 1; _tour.anchor_bottom = 1
	_tour.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_tour.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_tour.offset_bottom = -26
	root.add_child(_tour)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	_tour.add_child(v)
	_tour_count = Label.new()
	_tour_count.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_tour_count.add_theme_font_size_override("font_size", 15)
	_tour_count.add_theme_color_override("font_color", DIM)
	v.add_child(_tour_count)
	_tour_name = Label.new()
	_tour_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_tour_name.add_theme_font_size_override("font_size", 34)
	_tour_name.add_theme_color_override("font_color", HONEY)
	v.add_child(_tour_name)
	_tour_sub = Label.new()
	_tour_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_tour_sub.add_theme_font_size_override("font_size", 18)
	v.add_child(_tour_sub)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 12)
	v.add_child(row)
	for b in [["◀  Previous", -1], ["Next  ▶", 1]]:
		var btn := Button.new()
		btn.text = b[0]
		var d: int = b[1]
		btn.pressed.connect(func(): tour_step.emit(d))
		row.add_child(btn)
	var done := Button.new()
	done.text = "Done"
	done.pressed.connect(func(): tour_done.emit())
	row.add_child(done)
	var keys := Label.new()
	keys.text = "← →  browse     drag  turn it     Esc  done"
	keys.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	keys.add_theme_font_size_override("font_size", 13)
	keys.add_theme_color_override("font_color", DIM)
	v.add_child(keys)
	_tour.hide()


func show_tour(on: bool) -> void:
	_tour.visible = on
	_crosshair.visible = not on


func set_tour(i: int, n: int, name: String, sub: String) -> void:
	_tour_count.text = "%d of %d" % [i + 1, n]
	_tour_name.text = name
	_tour_sub.text = sub


# ---------------------------------------------------------------- tidiness and streak

func _build_meters(root: Control) -> void:
	var top := CenterContainer.new()
	top.anchor_left = 0; top.anchor_right = 1
	top.offset_top = 92; top.offset_bottom = 140
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(top)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(v)
	_tidy_label = Label.new()
	_tidy_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_tidy_label.add_theme_font_size_override("font_size", 15)
	_tidy_label.add_theme_color_override("font_color", CREAM)
	_tidy_label.add_theme_constant_override("outline_size", 6)
	v.add_child(_tidy_label)
	_tidy_track = Control.new()
	_tidy_track.custom_minimum_size = Vector2(360, 10)
	_tidy_track.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(_tidy_track)
	var bg := ColorRect.new()
	bg.color = Color(0.1, 0.05, 0.07, 0.75)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_tidy_track.add_child(bg)
	_tidy_fill = ColorRect.new()
	_tidy_fill.color = HONEY
	_tidy_fill.anchor_bottom = 1.0
	_tidy_fill.anchor_right = 0.0
	_tidy_track.add_child(_tidy_fill)
	set_tidy(0.0)

	_streak = Label.new()
	_streak.anchor_left = 0.5; _streak.anchor_right = 0.5
	_streak.anchor_top = 0.5; _streak.anchor_bottom = 0.5
	_streak.offset_left = 40; _streak.offset_top = 10
	_streak.add_theme_font_size_override("font_size", 26)
	_streak.add_theme_color_override("font_color", HONEY)
	_streak.add_theme_constant_override("outline_size", 10)
	_streak.add_theme_color_override("font_outline_color", Color("3a1f0f"))
	_streak.modulate.a = 0.0
	_streak.pivot_offset = Vector2(10, 16)
	root.add_child(_streak)


func set_tidy(frac: float) -> void:
	_tidy_label.text = "ROOM  %d%% TIDY" % int(floor(frac * 100.0))
	var tw := create_tween()
	tw.tween_property(_tidy_fill, "anchor_right", clampf(frac, 0.0, 1.0), 0.35).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


func set_streak(n: int) -> void:
	if _streak_tw:
		_streak_tw.kill()
	_streak_tw = create_tween()
	if n < 5:
		_streak_tw.tween_property(_streak, "modulate:a", 0.0, 0.4)
		return
	_streak.text = "×%d" % n
	_streak.modulate.a = 1.0
	_streak.scale = Vector2(1.35, 1.35)
	_streak_tw.tween_property(_streak, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_streak_tw.tween_interval(2.5)
	_streak_tw.tween_property(_streak, "modulate:a", 0.0, 0.8)


# ---------------------------------------------------------------- tool belt

func set_tools(defs: Array, unlocked: Array, active: int) -> void:
	for c in _toolbar.get_children():
		c.queue_free()
	for i in defs.size():
		var on: bool = unlocked[i]
		var p := _panel(Color(HONEY, 0.95) if i == active else PANEL)
		var v := VBoxContainer.new()
		v.add_theme_constant_override("separation", 0)
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var k := Label.new()
		k.text = str(i + 1)
		k.add_theme_font_size_override("font_size", 12)
		k.add_theme_color_override("font_color", Color("3b2630") if i == active else DIM)
		v.add_child(k)
		var n := Label.new()
		n.text = defs[i][0] if on else "%s  (Tool Chest)" % defs[i][0]
		n.add_theme_font_size_override("font_size", 16)
		n.add_theme_color_override("font_color", Color("3b2630") if i == active else (CREAM if on else DIM))
		v.add_child(n)
		p.add_child(v)
		_toolbar.add_child(p)


# ---------------------------------------------------------------- tidy tokens and the tool chest

func _build_tokens(root: Control) -> void:
	_tokens_panel = _panel(PANEL)
	_tokens_panel.anchor_left = 1; _tokens_panel.anchor_right = 1
	_tokens_panel.offset_left = -250; _tokens_panel.offset_right = -22
	_tokens_panel.offset_top = 22
	_tokens_panel.pivot_offset = Vector2(110, 24)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	h.alignment = BoxContainer.ALIGNMENT_END
	var coin := Label.new()
	coin.text = "✦"
	coin.add_theme_font_size_override("font_size", 24)
	coin.add_theme_color_override("font_color", HONEY)
	h.add_child(coin)
	_tokens = Label.new()
	_tokens.add_theme_font_size_override("font_size", 22)
	h.add_child(_tokens)
	var hint := Label.new()
	hint.text = "Tab: Tool Chest"
	hint.add_theme_font_size_override("font_size", 13)
	hint.add_theme_color_override("font_color", DIM)
	h.add_child(hint)
	_tokens_panel.add_child(h)
	root.add_child(_tokens_panel)
	set_tokens(0, false)


func set_tokens(n: int, bump := true) -> void:
	_tokens.text = "%d" % n
	if bump:
		_tokens_panel.scale = Vector2(1.15, 1.15)
		create_tween().tween_property(_tokens_panel, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _build_shop(root: Control) -> void:
	_shop = ColorRect.new()
	(_shop as ColorRect).color = Color(0.09, 0.05, 0.08, 0.84)
	_shop.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(_shop)
	var cc := CenterContainer.new()
	cc.set_anchors_preset(Control.PRESET_FULL_RECT)
	_shop.add_child(cc)
	var card := _panel(Color(0.2, 0.12, 0.1, 0.97))
	card.mouse_filter = Control.MOUSE_FILTER_STOP
	cc.add_child(card)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	v.custom_minimum_size = Vector2(820, 0)
	card.add_child(v)
	var head := HBoxContainer.new()
	var t := Label.new()
	t.text = "Tool Chest"
	t.add_theme_font_size_override("font_size", 44)
	t.add_theme_color_override("font_color", HONEY)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(t)
	_shop_tokens = Label.new()
	_shop_tokens.add_theme_font_size_override("font_size", 26)
	head.add_child(_shop_tokens)
	v.add_child(head)
	var sub := Label.new()
	sub.text = "Earn Tidy Tokens by filling compartments, packing boxes and shelving whole games."
	sub.add_theme_color_override("font_color", DIM)
	sub.add_theme_font_size_override("font_size", 17)
	v.add_child(sub)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0, 440)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(scroll)
	_shop_rows = VBoxContainer.new()
	_shop_rows.add_theme_constant_override("separation", 8)
	_shop_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_shop_rows)
	var close := Button.new()
	close.text = "Back to tidying  (Tab)"
	close.pressed.connect(func(): shop_closed.emit())
	close.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	v.add_child(close)
	_shop.hide()


func shop_open() -> bool:
	return _shop.visible


func show_shop(on: bool, levels := {}, tokens := 0) -> void:
	_shop.visible = on
	if on:
		fill_shop(levels, tokens)


func fill_shop(levels: Dictionary, tokens: int) -> void:
	_shop_tokens.text = "✦ %d" % tokens
	for c in _shop_rows.get_children():
		c.queue_free()
	for u in Upgrades.LIST:
		var lvl: int = levels.get(u.id, 0)
		var maxed: bool = lvl >= u.costs.size()
		var row := _panel(Color(1, 1, 1, 0.05))
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 16)
		var left := VBoxContainer.new()
		left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var name := Label.new()
		var pips := ""
		for i in u.costs.size():
			pips += "●" if i < lvl else "○"
		name.text = "%s   %s" % [u.name, pips]
		name.add_theme_font_size_override("font_size", 21)
		name.add_theme_color_override("font_color", HONEY if lvl > 0 else CREAM)
		left.add_child(name)
		var d := Label.new()
		d.text = "All upgrades bought." if maxed else u.levels[lvl]
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		d.custom_minimum_size.x = 560
		d.add_theme_font_size_override("font_size", 16)
		d.add_theme_color_override("font_color", DIM)
		left.add_child(d)
		h.add_child(left)
		var b := Button.new()
		b.custom_minimum_size.x = 150
		if maxed:
			b.text = "Owned"
			b.disabled = true
		else:
			var cost: int = u.costs[lvl]
			b.text = "%s  ✦ %d" % ["Buy" if lvl == 0 else "Upgrade", cost]
			b.disabled = tokens < cost
			var id: String = u.id
			b.pressed.connect(func(): buy_pressed.emit(id))
		h.add_child(b)
		row.add_child(h)
		_shop_rows.add_child(row)
