'use strict';
// Voices. Your driver shouts, swears and, once they've a few races behind them, laughs it off; you grunt and gasp.
// The lines are real speech, made offline (tools/make_voices.py: Piper with the LibriTTS voices, CC BY 4.0) and
// carried in js/voices/*.js. Every inmate who drives for you gets a voice of their own (by their seed), and how they
// say things depends on their nerve: green, they're terrified (pitched up, hurried, shaking, swearing at everything);
// steadier with every race and as the bond grows (js/bond.js); hardened, nothing out here scares them. A getaway
// veteran starts out calm, a daredevil whoops at a jump, a cautious one stays scared longer, and a badly hurt driver
// loses their nerve again. What they say is subtitled, and everything else dips under it.

const VOICE = {
  gap: 0.5, // seconds of quiet after a line before the same mouth speaks again
  cd: { start: 0, jump: 5, land: 4, crash: 3, rocket: 2, mine: 2, lock: 5, blast: 2.5, hit: 1.8, shot: 1.4, kill: 2.5, finish: 0, order: 1.5 }, // per kind of line
  pri: { hit: 5, shot: 5, lock: 4, rocket: 4, blast: 4, mine: 3, crash: 3, kill: 2, jump: 2, land: 1, order: 2, start: 1, finish: 3 }, // a line this much more urgent cuts one off
  gunnerCd: { impact: 0.7, hurt: 0.45, effort: 0.9 },
  vol: { driver: 1.0, gunner: 0.7 },
  duck: { driver: 0.4, gunner: 0.2 }, // how far the engine and music dip under a line
};

const VoiceBank = {
  banks: {}, // id -> { id, who, lines }
  add(b) { this.banks[b.id] = b; },
  drivers() { return Object.keys(this.banks).filter((id) => this.banks[id].who === 'driver').sort(); },
};

// Nerve: 0 (their first race, terrified) to 1 (nothing scares them), from the races you've done together, the
// bond, their trait, and how badly they're hurt right now.
const Voice = {
  nerve(b) {
    const r = Bond.rec(b), lv = Bond.level(r.xp);
    const trait = { veteran: 0.45, daredevil: 0.25, hothead: 0.1, cautious: -0.12 }[b.chip || 'stock'] || 0;
    const hurt = 1 - Crew.hp(b) / DRIVER.hp;
    return clamp(r.races / 8 + lv * 0.12 + trait - (hurt > 0.5 ? 0.35 : 0), 0, 1);
  },
  tier(n) { return n < 0.34 ? 'g' : n < 0.67 ? 'm' : 'h'; },
};

class VoicePlayer {
  constructor() {
    this.buffers = {}; // bank id -> { key: AudioBuffer } once decoded
    this.cd = {}; this.mouth = { driver: { until: 0, pri: 0, src: null }, gunner: { until: 0, pri: 0, src: null } };
    this.last = {};
  }

  // A race is starting: whose voice is in the car, and get their lines (and yours) ready to play.
  begin(combat, build) {
    this.combat = combat; this.build = build; this.cd = {}; this.last = {};
    const ids = VoiceBank.drivers(), crew = combat.crew || Crew.current(build);
    this.driverId = ids.length ? ids[((crew && crew.seed) || 0) % ids.length] : null;
    if (this.driverId) this.decode(this.driverId);
    if (VoiceBank.banks.gunner) this.decode('gunner');
  }

  decode(id) {
    if (this.buffers[id] || !Sound.ctx) return;
    const out = this.buffers[id] = {}, B = VoiceBank.banks[id];
    const put = (key, b64) => {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      Sound.ctx.decodeAudioData(u.buffer).then((buf) => { out[key] = buf; }, () => {});
    };
    for (const [cat, v] of Object.entries(B.lines)) {
      if (Array.isArray(v)) v.forEach((line, i) => put(`${cat}.${i}`, line[1]));
      else for (const [t, list] of Object.entries(v)) list.forEach((line, i) => put(`${cat}.${t}.${i}`, line[1]));
    }
  }

  now() { return Sound.ctx ? Sound.ctx.currentTime : 0; }

  // Play a decoded clip from a mouth; a more urgent line cuts off a less urgent one.
  play(who, buf, pri) {
    const M = this.mouth[who], t = this.now();
    if (t < M.until && pri < M.pri + 2) return false;
    if (M.src) { try { M.src.stop(); } catch (e) { /* already done */ } }
    const c = Sound.ctx, src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf; g.gain.value = VOICE.vol[who];
    src.connect(g); g.connect(Sound.master);
    src.start();
    M.src = src; M.pri = pri; M.until = t + buf.duration + VOICE.gap;
    if (Sound.duck) Sound.duck(VOICE.duck[who]);
    return true;
  }

  // Your driver says something about what just happened. Returns the line (for the subtitle), or null.
  say(kind) {
    const C = this.combat, b = this.build;
    if (!C || !b || !this.driverId || C.ownDriverDead || C.tutorial) return null;
    const t = this.now(), bank = VoiceBank.banks[this.driverId], cat = bank && bank.lines[kind];
    if (!cat || (this.cd[kind] || 0) > t) return null;
    let tier = Voice.tier(Voice.nerve(b));
    if (kind === 'jump' && b.chip === 'daredevil') tier = 'h'; // a daredevil lives for this
    const list = cat[tier] || cat.m, bufs = this.buffers[this.driverId] || {};
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.last[kind]) i = (i + 1) % list.length; // not the same line twice running
    const buf = bufs[`${kind}.${tier}.${i}`];
    if (!buf || !this.play('driver', buf, VOICE.pri[kind] || 1)) return null;
    this.cd[kind] = t + (VOICE.cd[kind] || 1.5);
    this.last[kind] = i;
    return list[i][0];
  }

  // You: a grunt when the car slams into something, a cry when you're hit, an effort when you climb or throw.
  grunt(kind) {
    const t = this.now(), bank = VoiceBank.banks.gunner, list = bank && bank.lines[kind];
    if (!list || (this.cd['g.' + kind] || 0) > t || (this.combat && this.combat.gunnerOut)) return;
    const i = Math.floor(Math.random() * list.length), buf = (this.buffers.gunner || {})[`${kind}.${i}`];
    if (buf && this.play('gunner', buf, kind === 'hurt' ? 4 : 2)) this.cd['g.' + kind] = t + VOICE.gunnerCd[kind];
  }

  // What happened this frame (race and combat events), and who has something to say about it.
  onEvent(ev) {
    const C = this.combat;
    if (!C) return;
    switch (ev.type) {
      case 'jump': this.speak('jump'); break;
      case 'land': if (ev.power > 150) { this.speak('land'); this.grunt('impact'); } break;
      case 'hit': if (ev.power > 200) { this.speak('crash'); this.grunt('impact'); } else if (ev.power > 110) this.grunt('impact'); break;
      case 'thrown': this.speak('blast'); this.grunt('impact'); break;
      case 'gunnerHit': this.grunt('hurt'); break;
      case 'roofUp': case 'throw': case 'kickGlass': this.grunt('effort'); break;
      case 'finish': if (C.player.place <= (C.race.qualify || 3)) this.speak('finish'); break;
    }
  }

  // Say it, and put it on screen as theirs.
  speak(kind) {
    const line = this.say(kind);
    if (line && this.combat) this.combat.race.message(`${((this.combat.crew && this.combat.crew.short) || 'Driver').toUpperCase()}: "${line}"`, '#9fd0ff');
    return line;
  }
}
