#!/usr/bin/env python3
"""Puts your own recordings in the game, in place of the synthetic voices.

  python3 tools/import_voices.py path/to/recordings

The folder holds `driver/` and `gunner/` with one file per line, named as in the recording script (built from
tools/voice_lines.json): driver/<situation>_<tier>_<n>.wav (crash_g_2.wav) and gunner/<kind>_<n>.wav (hurt_1.wav).
WAV is best; anything ffmpeg reads will do. Each take is trimmed, evened out and stored as a small MP3 in
js/voices/rec.js (driver) and js/voices/rec_gunner.js (you), and prototype.html loads them. The game then uses your
takes for every driver, and the synthetic voice for any line you haven't recorded. The subtitles are the lines in
tools/voice_lines.json: if you ad-libbed, change the line there to match before importing.
"""
import base64, json, os, re, subprocess, sys
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LINES = json.load(open(os.path.join(ROOT, 'tools', 'voice_lines.json')))


def take(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-af', 'highpass=f=70', '-ar', '22050', '-ac', '1', '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    x = np.nan_to_num(np.frombuffer(raw, dtype='<i2').astype(np.float64))
    env = np.convolve(np.abs(x), np.ones(110) / 110, 'same')
    loud = np.nonzero(env > max(200.0, env.max() * 0.04))[0]
    if len(loud): x = x[max(0, loud[0] - 330):min(len(x), loud[-1] + 880)]  # (trim the silence off the ends only)
    rms = np.sqrt(np.mean(x ** 2)) or 1.0
    x = x * min(5500.0 / rms, 31000.0 / (np.abs(x).max() or 1.0))  # the same loudness as the rest, never clipping
    mp3 = subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 's16le', '-ar', '22050', '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '40k', '-f', 'mp3', '-'],
                         input=np.clip(x, -32767, 32767).astype('<i2').tobytes(), capture_output=True, check=True).stdout
    return base64.b64encode(mp3).decode()


def find(folder, stem):
    if not os.path.isdir(folder): return None
    for f in os.listdir(folder):
        if os.path.splitext(f)[0].lower() == stem: return os.path.join(folder, f)
    return None


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'recordings'
    got, missing, extra = 0, [], set()
    for d in ('driver', 'gunner'):
        p = os.path.join(src, d)
        if os.path.isdir(p): extra |= {f'{d}/{os.path.splitext(f)[0].lower()}' for f in os.listdir(p) if not f.startswith('.')}
    drv = {}
    for cat, tiers in LINES['driver'].items():
        drv[cat] = {}
        for t, items in tiers.items():
            drv[cat][t] = []
            for i, it in enumerate(items):
                text, stem = (it if isinstance(it, str) else it[0]), f'{cat}_{t}_{i + 1}'
                f = find(os.path.join(src, 'driver'), stem)
                extra.discard('driver/' + stem)
                if f: drv[cat][t].append([text, take(f)]); got += 1
                else: drv[cat][t].append([text, None]); missing.append('driver/' + stem)
    gun = {}
    for cat, items in LINES['gunner'].items():
        gun[cat] = []
        for i, text in enumerate(items):
            stem = f'{cat}_{i + 1}'
            f = find(os.path.join(src, 'gunner'), stem)
            extra.discard('gunner/' + stem)
            if f: gun[cat].append([text, take(f)]); got += 1
            else: gun[cat].append([text, None]); missing.append('gunner/' + stem)
    head = "'use strict';\n// Your own recordings, imported by tools/import_voices.py. Lines with no take (null) fall back to the synthetic voice.\n"
    out = os.path.join(ROOT, 'js', 'voices')
    os.makedirs(out, exist_ok=True)
    for vid, who, lines in (('rec', 'driver', drv), ('rec_gunner', 'gunner', gun)):
        open(os.path.join(out, vid + '.js'), 'w').write(head + f"VoiceBank.add({json.dumps({'id': vid, 'who': who, 'recorded': True, 'lines': lines}, separators=(',', ':'))});\n")
    page = os.path.join(ROOT, 'prototype.html')
    html = open(page).read()
    for vid in ('rec', 'rec_gunner'):
        tag = f'  <script src="js/voices/{vid}.js"></script>'
        if tag not in html: html = html.replace('  <script src="js/voices/gunner.js"></script>', f'  <script src="js/voices/gunner.js"></script>\n{tag}')
    open(page, 'w').write(html)
    print(f'{got} takes imported, {len(missing)} lines still synthetic.')
    if missing: print('Not recorded: ' + ', '.join(missing[:20]) + (' ...' if len(missing) > 20 else ''))
    if extra: print('Files not in the script (check their names): ' + ', '.join(sorted(extra)))


if __name__ == '__main__':
    main()
