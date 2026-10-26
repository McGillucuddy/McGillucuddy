'use strict';
// Playtest report: the game quietly keeps a record of how runs go (how far you got, what hurt you, how often you used
// the hatch, which guns you fired, the frame rate), all on this computer. "Send feedback" turns it into a short text
// report with the tester's own comments, to copy or download and send back. Nothing is uploaded anywhere.

const PLAYTEST_KEY = 'derby_playtest_v1';
const ACT_NUM = ['I', 'II', 'III', 'IV'];

const Playtest = {
  data: { runs: [], races: 0, sessions: 0, firstSeen: null },
  cur: null, // the run in progress
  race: null, // the race in progress
  fps: { acc: 0, frames: 0, samples: [], now: 0 },

  load() {
    try { Object.assign(this.data, JSON.parse(localStorage.getItem(PLAYTEST_KEY)) || {}); } catch (e) { /* storage unavailable */ }
    this.data.sessions = (this.data.sessions || 0) + 1;
    this.data.firstSeen = this.data.firstSeen || new Date().toISOString();
    // A run left open last session (the tab was closed) carries on if the save does; otherwise it was abandoned.
    const open = this.data.runs.find((r) => r.result === 'in progress');
    if (open) open.result = 'left mid-run';
    this.save();
  },
  save() { try { localStorage.setItem(PLAYTEST_KEY, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ } },

  startRun() {
    this.cur = { started: new Date().toISOString(), races: [], result: 'in progress', weapons: {}, hatch: 0, parries: 0, emotes: 0, grenades: 0, quality: Settings.data.quality };
    this.data.runs.push(this.cur);
    if (this.data.runs.length > 12) this.data.runs.shift();
    this.save();
  },
  // A saved run picked up again after a reload: keep recording into its entry.
  resumeRun() {
    const last = this.data.runs[this.data.runs.length - 1];
    if (last && (last.result === 'left mid-run' || last.result === 'in progress')) { last.result = 'in progress'; this.cur = last; } else this.startRun();
  },
  endRun(result) {
    if (!this.cur) return;
    this.cur.result = result;
    this.save();
    this.cur = null;
  },

  raceStart(info) {
    if (!this.cur) this.startRun();
    this.race = Object.assign({ hurt: {}, t0: performance.now() }, info);
    this.fps.acc = this.fps.frames = 0; this.fps.last = 0;
    this.race.fps = [];
  },
  raceEnd(r) {
    const R = this.race;
    this.race = null;
    if (!R || !this.cur) return;
    Object.assign(R, r);
    R.secs = Math.round((performance.now() - R.t0) / 1000);
    delete R.t0;
    for (const k in R.hurt) R.hurt[k] = Math.round(R.hurt[k]);
    const f = R.fps;
    R.fps = f.length ? { avg: Math.round(f.reduce((a, b) => a + b, 0) / f.length), low: Math.round([...f].sort((a, b) => a - b)[Math.floor(f.length * 0.05)]) } : null;
    this.cur.races.push(R);
    this.data.races++;
    this.save();
    return R;
  },

  // Called every race frame (countdown included, for the readout): the real frame rate (wall clock, not the game's clamped step) in one-second windows.
  frame(record) {
    const F = this.fps, t = performance.now(), dt = F.last ? Math.min(2, (t - F.last) / 1000) : 0;
    F.last = t;
    if (!dt) return;
    F.acc += dt; F.frames++;
    if (F.acc >= 1) {
      F.now = F.frames / F.acc;
      if (this.race && record) this.race.fps.push(F.now); // only racing frames count in the report
      F.acc = 0; F.frames = 0;
    }
  },

  // Combat events, as they happen.
  event(ev, weaponId) {
    const c = this.cur;
    if (!c) return;
    if (['shoot', 'shotgun', 'nail', 'flame', 'harpoon', 'rocket', 'flare'].includes(ev.type) && weaponId) c.weapons[weaponId] = (c.weapons[weaponId] || 0) + 1;
    else if (ev.type === 'hatchShut') c.hatch++;
    else if (ev.type === 'parry') c.parries++;
    else if (ev.type === 'emote') c.emotes++;
    else if (ev.type === 'grenade') c.grenades++;
    else if (ev.type === 'hurt' && this.race) { const k = ev.kind || 'crashes and rams'; this.race.hurt[k] = (this.race.hurt[k] || 0) + (ev.dmg || 0); }
  },

  // ---------- The report ----------
  // The graphics card's name, read once from a throwaway WebGL context that is released straight away (browsers cap
  // how many contexts can be alive, and the game needs its own).
  gpuName() {
    if (this.gpu) return this.gpu;
    this.gpu = 'unknown';
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) this.gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      const lose = gl && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } catch (e) { /* no WebGL info */ }
    return this.gpu;
  },
  device() {
    return { gpu: this.gpuName(), ua: navigator.userAgent, screen: `${screen.width}x${screen.height} @${window.devicePixelRatio || 1}x`, window: `${innerWidth}x${innerHeight}`, cores: navigator.hardwareConcurrency || '?' };
  },
  raceLine(R) {
    const what = R.boss ? `boss race vs ${R.boss}` : R.type === 'elite' ? 'elite race' : 'race';
    const worst = Object.entries(R.hurt || {}).sort((a, b) => b[1] - a[1])[0];
    return `  Act ${ACT_NUM[R.act] || R.act} ${what} (${wxOf(R.weather).name.toLowerCase()}): ${R.wrecked ? 'WRECKED' : `${R.place}/${R.of}`}${R.ok ? '' : ' (missed the cut)'}, ${R.secs}s`
      + (worst ? `, most damage from ${worst[0]} (${worst[1]})` : '') + (R.fps ? `, ${R.fps.avg} fps (low ${R.fps.low})` : '');
  },
  report(note) {
    const d = this.device(), L = [];
    L.push('DEATH ROW DERBY: PLAYTEST REPORT');
    L.push(`Build: ${window.BUILD || 'dev'}    Sent: ${new Date().toLocaleString()}`);
    L.push('');
    L.push('WHAT THE TESTER SAYS');
    L.push(note && note.trim() ? note.trim() : '(nothing written)');
    L.push('');
    L.push('THIS COMPUTER');
    L.push(`GPU: ${d.gpu}`);
    L.push(`Screen ${d.screen}, window ${d.window}, ${d.cores} CPU threads`);
    L.push(`Browser: ${d.ua}`);
    L.push(`Graphics: ${Settings.data.quality}, sensitivity ${Settings.data.sens.toFixed(2)}x, cabin sway ${Settings.data.cabinSway}`);
    L.push('');
    L.push(`PLAY SO FAR: ${this.data.sessions} sessions, ${this.data.races} races, ${this.data.runs.length} runs recorded (since ${(this.data.firstSeen || '').slice(0, 10)})`);
    const runs = this.data.runs.slice(-5).reverse();
    runs.forEach((r, i) => {
      const guns = Object.entries(r.weapons).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${(WEAPONS[w] || {}).name || w} ${n}`).join(', ') || 'none';
      L.push('');
      L.push(`RUN ${this.data.runs.length - i} (${r.started.slice(0, 16).replace('T', ' ')}): ${r.result}`);
      L.push(`  Shots: ${guns}. Hatch slams ${r.hatch}, parries ${r.parries}, emotes ${r.emotes}, grenades ${r.grenades}.`);
      if (!r.races.length) L.push('  (no races finished)');
      for (const R of r.races) L.push(this.raceLine(R));
    });
    return L.join('\n');
  },

  // The feedback sheet: a note box, the report preview, copy and download.
  show() {
    let el = document.getElementById('feedback');
    if (!el) {
      el = document.createElement('div');
      el.id = 'feedback';
      document.body.appendChild(el);
      el.addEventListener('click', (e) => {
        const a = e.target.closest('[data-fb]');
        if (e.target === el || (a && a.dataset.fb === 'close')) { el.remove(); return; }
        if (!a) return;
        const text = this.report(el.querySelector('#fbNote').value);
        if (a.dataset.fb === 'copy') {
          const done = () => { a.textContent = 'Copied!'; setTimeout(() => (a.textContent = 'Copy report'), 1600); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => this.fallbackCopy(el, text, done));
          else this.fallbackCopy(el, text, done);
        } else if (a.dataset.fb === 'download') {
          const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
          const link = document.createElement('a');
          link.href = url; link.download = `derby-playtest-${new Date().toISOString().slice(0, 10)}.txt`;
          document.body.appendChild(link); link.click(); link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      });
      el.addEventListener('input', () => { const pre = el.querySelector('#fbPreview'); if (pre && pre.closest('details').open) pre.textContent = this.report(el.querySelector('#fbNote').value); });
      el.addEventListener('toggle', () => { const pre = el.querySelector('#fbPreview'); if (pre) pre.textContent = this.report(el.querySelector('#fbNote').value); }, true);
    }
    el.innerHTML = `<div class="settings-card clipboard fb-card">
      <div class="clip"></div>
      <h2 class="g-title">Send feedback</h2>
      <p class="small">Thanks for playing. Tell us what happened: what was confusing, what felt bad, what you loved, and whether
      you wanted another run. The report below is added automatically (how your runs went and how the game ran on this
      computer). Nothing is sent anywhere: copy it or download it, then send it to whoever gave you the game.</p>
      <textarea id="fbNote" rows="5" placeholder="What happened? What was confusing or frustrating? What was fun? Did you want another run?"></textarea>
      <details><summary class="small">What the report includes</summary><pre id="fbPreview" class="fb-pre"></pre></details>
      <div class="opts" style="margin-top:10px"><button class="btn primary" data-fb="copy">Copy report</button><button class="btn" data-fb="download">Download as a file</button><button class="btn ghost" data-fb="close">Close</button></div>
    </div>`;
    el.querySelector('#fbPreview').textContent = this.report('');
    el.querySelector('#fbNote').focus();
  },
  fallbackCopy(el, text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    el.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* the download button still works */ }
    ta.remove();
  },
};
