class_name Hud
extends CanvasLayer
## On-screen text: crosshair, prompts, the checklist of games, and the title, pause and end screens.

signal start_pressed
signal resume_pressed
signal restart_pressed
signal quit_pressed

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

	_title = _overlay(root, "After Game Night",
		"Everyone's gone home and the games are everywhere.\nPut every piece back in its own box, then shelve the boxes.",
		"WASD  walk     Shift  hurry     C  crouch\nClick  pick up / put in     Right-click  toss\nH  hint     Esc  pause",
		[["Start tidying", start_pressed]])
	_pause = _overlay(root, "Paused", "Take a sip of tea.", "",
		[["Keep tidying", resume_pressed], ["Start over", restart_pressed], ["Quit", quit_pressed]])
	_pause.hide()
	_end = _overlay(root, "Everything's put away", "The shelf is full and the table is clear.", "",
		[["Play again", restart_pressed], ["Quit", quit_pressed]])
	_end_stats = _end.get_meta("extra")
	_end.hide()


func _style_buttons(th: Theme) -> void:
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
