class_name Sfx
extends Node
## Synthesizes all sound effects at startup: wooden clacks, soft notes and a cardboard thunk.

const RATE := 22050
const NOTE_BASE := 523.25

var streams := {}
var _p3: Array[AudioStreamPlayer3D] = []
var _p2: Array[AudioStreamPlayer] = []
var _i3 := 0
var _i2 := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	streams["clack"] = _knock(0.08, 1100.0, 50.0)
	streams["tick"] = _knock(0.05, 2200.0, 70.0)
	streams["thunk"] = _knock(0.3, 180.0, 14.0)
	streams["note"] = _tone(NOTE_BASE, 0.7, 1.0, 5.0)
	streams["low"] = _tone(196.0, 0.35, 0.72, 9.0)
	for i in 12:
		var p := AudioStreamPlayer3D.new()
		p.unit_size = 2.5
		p.max_db = 3.0
		add_child(p)
		_p3.append(p)
	for i in 8:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_p2.append(p)


func at(name: String, pos: Vector3, db := 0.0, pitch := 1.0) -> void:
	var p := _p3[_i3]
	_i3 = (_i3 + 1) % _p3.size()
	p.stream = streams[name]
	p.global_position = pos
	p.volume_db = db
	p.pitch_scale = pitch * randf_range(0.95, 1.05)
	p.play()


func ui(name: String, db := 0.0, pitch := 1.0, delay := 0.0) -> void:
	if delay > 0.0:
		get_tree().create_timer(delay, true).timeout.connect(ui.bind(name, db, pitch, 0.0))
		return
	var p := _p2[_i2]
	_i2 = (_i2 + 1) % _p2.size()
	p.stream = streams[name]
	p.volume_db = db
	p.pitch_scale = pitch
	p.play()


func note(freq: float, db := -8.0, delay := 0.0) -> void:
	ui("note", db, freq / NOTE_BASE, delay)


func chord(freqs: Array, gap := 0.09, db := -9.0, delay := 0.0) -> void:
	for i in freqs.size():
		note(freqs[i], db, delay + i * gap)


func _wav(buf: PackedFloat32Array) -> AudioStreamWAV:
	var data := PackedByteArray()
	data.resize(buf.size() * 2)
	for i in buf.size():
		data.encode_s16(i * 2, int(clampf(buf[i], -1.0, 1.0) * 32000.0))
	var s := AudioStreamWAV.new()
	s.format = AudioStreamWAV.FORMAT_16_BITS
	s.mix_rate = RATE
	s.stereo = false
	s.data = data
	return s


func _tone(f: float, dur: float, slide: float, decay: float) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var ph := 0.0
	for i in n:
		var t := float(i) / RATE
		ph += TAU * f * lerpf(1.0, slide, t / dur) / RATE
		var env := minf(1.0, t * 300.0) * exp(-t * decay)
		buf[i] = (sin(ph) * 0.62 + sin(ph * 2.0) * 0.18 + sin(ph * 3.0) * 0.06) * env * 0.7
	return _wav(buf)


func _knock(dur: float, f: float, decay: float) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var y := 0.0
	var a := clampf(f / RATE * 5.0, 0.03, 0.9)
	for i in n:
		var t := float(i) / RATE
		y += a * ((randf() * 2.0 - 1.0) - y)
		var body := sin(TAU * f * 0.33 * t) * exp(-t * decay * 1.3)
		buf[i] = (y * 1.6 * exp(-t * decay) + body * 0.55) * 0.8
	return _wav(buf)
