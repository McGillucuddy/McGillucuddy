'use strict';
// Bosses: an intro card when the qualifier starts (the camera swoops onto the boss's car on the grid, the frame
// freezes, the name slams in over a splash of ink with a one-line put-down), a health bar while you race them,
// and a signature move each, telegraphed before it lands. At half health every boss loses their temper.

const BOSS_KIT = {
  'The Turnkey': {
    card: ['The', 'Turnkey'], quip: 'Has never once read anyone their rights.', ink: '#c9a43a',
    move: 'ram', tell: 'RIOT RAM!', every: 14, rage: 9,
    rageLine: 'THE TURNKEY IS PISSED',
    help: 'Armoured nose: bullets from in front do a third. Hit him from the side or behind. Rams you when you get close.',
  },
  'Smokestack Sal': {
    card: ['Smokestack', 'Sal'], quip: 'Lungs: zero. Mines: plenty.', ink: '#8a5a32',
    move: 'smog', tell: 'SMOKESTACK!', every: 8, rage: 5,
    rageLine: 'SAL IS BURNING EVERYTHING',
    help: 'Belches smog clouds you can\'t see through, and lays mines. Angry, he lays them two at a time.',
  },
  'Augustin Vale': {
    card: ['Augustin', 'Vale'], quip: 'Brought to you by the people who own you.', ink: '#e8c050',
    move: 'barrage', tell: 'SPONSOR BARRAGE!', every: 12, rage: 8, salvo: 3, rageSalvo: 5,
    rageLine: 'VALE HAS LOST HIS TEMPER',
    help: 'Fires a fan of rockets at once after a warning. Slam the hatch on the first one to bat it back.',
  },
  'Vex "The Apex" Marlowe': {
    card: ['Vex "The Apex"', 'Marlowe'], quip: 'Nobody walks free. Nobody.', ink: '#d8342a',
    move: 'apex', tell: 'APEX BARRAGE!', every: 13, rage: 8, salvo: 3, rageSalvo: 4,
    rageLine: 'THE APEX IS ANGRY',
    help: 'Rockets, then once angry: nitro bursts and rocket salvos. Only a win sets you free.',
  },
};
const bossKit = (boss) => (boss && BOSS_KIT[boss.name]) || null;

// ---------- Signature moves (mixed into Combat) ----------
Object.assign(Combat.prototype, {
  updateBoss(dt) {
    const bc = this.race.bossCar, B = this.race.boss, K = bossKit(B), p = this.player;
    if (!bc || !K || this.race.state !== 'racing') return;
    const S = this.bossState || (this.bossState = { t: 0, next: K.every * 0.7, tell: 0, rage: false, salvo: 0, salvoT: 0, mineT: 0, boostT: 0 });
    S.t += dt;
    const down = bc.hp <= 0 || bc.finished || p.finished;
    if (!S.rage && bc.hp < bc.stats.maxHp * 0.5 && !down) {
      S.rage = true;
      this.race.message(K.rageLine, '#ff3b1f', true);
      this.events.push({ type: 'bossRage' });
      if (bc.wpn) bc.wpn.cd = 0;
    }
    const dx = p.x - bc.x, dy = p.y - bc.y, d = Math.hypot(dx, dy);
    // A salvo in progress: the rockets go out one after another.
    if (S.salvo > 0) {
      S.salvoT -= dt;
      if (S.salvoT <= 0 && !down) {
        const n = S.salvoN, k = n - S.salvo, a = Math.atan2(dy + p.vy * 0.35, dx + p.vx * 0.35) + (k - (n - 1) / 2) * 0.16;
        this.spawn('rocket', bc, a, ROCKET_SPEED, 0.3, { dmg: 14, radius: 46, life: 3, target: p, turn: 1.1 });
        this.events.push({ type: 'enemyRocket', x: bc.x, y: bc.y });
        S.salvo--; S.salvoT = 0.22;
      }
    }
    // The tell: a warning, then the move goes off.
    if (S.tell > 0) {
      S.tell -= dt;
      if (bc.wpn && K.move !== 'ram' && K.move !== 'smog') bc.wpn.lock = Math.max(bc.wpn.lock, 1e-3); // the laser's on you
      if (S.tell <= 0 && !down) this.bossMove(bc, K, S, d);
    } else if (!down && S.t >= S.next) {
      S.next = S.t + (S.rage ? K.rage : K.every) * randRange(this.rng, 0.85, 1.15);
      const inRange = K.move === 'ram' ? d < 300 : K.move === 'smog' ? true : d < 760;
      if (inRange) {
        S.tell = K.move === 'smog' ? 0.6 : 1.1;
        this.race.message(`${shortName(bc)}: ${K.tell}`, '#ff3b1f', true);
        this.events.push({ type: 'bossTell' });
      }
    }
    // Rage extras: Sal's second mine, the Apex's nitro bursts.
    if (S.rage && !down) {
      if (K.move === 'smog') {
        S.mineT -= dt;
        const fwd = dx * Math.cos(bc.heading) + dy * Math.sin(bc.heading);
        if (S.mineT <= 0 && fwd < -40 && d < 600) {
          S.mineT = 2.6;
          for (const side of [-1, 1]) this.mines.push({ x: bc.x - Math.cos(bc.heading) * 24 - Math.sin(bc.heading) * side * 9, y: bc.y - Math.sin(bc.heading) * 24 + Math.cos(bc.heading) * side * 9, owner: bc, t: 0, arm: 0.6, hp: 2 });
          this.events.push({ type: 'mine' });
        }
      }
      if (K.move === 'apex') {
        S.boostT -= dt;
        if (S.boostT <= 0) { S.boostT = 7; bc.boostT = Math.max(bc.boostT, 1.4); }
      }
    }
    if (S.grudgeT > 0 && (S.grudgeT -= dt) <= 0 && bc.ai && !(bc.tiltT > 0)) { bc.ai.grudge = null; bc.ai.rammer = false; }
  },

  bossMove(bc, K, S, d) {
    const p = this.player;
    if (K.move === 'ram') { // floor it and steer into you
      bc.boostT = Math.max(bc.boostT, 1.8);
      if (bc.ai) { bc.ai.grudge = p; bc.ai.rammer = true; }
      S.grudgeT = 3.2;
    } else if (K.move === 'smog') { // a choking cloud out of the stacks behind him
      const c = Math.cos(bc.heading), s = Math.sin(bc.heading);
      this.clouds.push({ x: bc.x - c * 50, y: bc.y - s * 50, r: 150, t: 0, life: 8, smog: true });
      if (S.rage) this.clouds.push({ x: bc.x - c * 130, y: bc.y - s * 130, r: 130, t: 0, life: 7, smog: true });
      this.events.push({ type: 'smog' });
    } else { // barrage
      S.salvoN = S.rage ? K.rageSalvo : K.salvo;
      S.salvo = S.salvoN;
      S.salvoT = 0;
      if (bc.wpn) bc.wpn.lock = 0;
    }
    void d;
  },

  // The Turnkey's armoured nose: rounds from in front glance off.
  bossArmour(c, dmg, ang, kind) {
    if (!c.isBoss || kind !== 'bullet') return dmg;
    const K = bossKit(this.race.boss);
    if (!K || K.move !== 'ram') return dmg;
    if (Math.abs(wrapAngle(ang - c.heading)) > 0.8) return dmg;
    this.events.push({ type: 'deflect', x: c.x, y: c.y });
    return dmg * 0.33;
  },

  // Are you sitting in Sal's smog? (0..1, for the fog in the cockpit)
  smogOn() {
    const p = this.player;
    let k = 0;
    for (const cl of this.clouds) {
      if (!cl.smog || !cl.cur) continue;
      const d = Math.hypot(p.x - cl.x, p.y - cl.y);
      k = Math.max(k, clamp(1.3 - d / cl.cur, 0, 1));
    }
    return k;
  },
});

// ---------- Boss health bar (cockpit HUD) ----------
function drawBossBar(ctx, P, W, H, t) {
  const race = P.race, bc = race.bossCar, B = race.boss;
  if (!bc || !B) return;
  const w = Math.min(520, W * 0.5), x = W / 2 - w / 2, y = 54, f = clamp(bc.hp / bc.stats.maxHp, 0, 1);
  const rage = P.combat.bossState && P.combat.bossState.rage;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `bold 15px ${hudFont()}`;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(`☠ ${B.name.toUpperCase()}`, W / 2 + 1, y - 7);
  ctx.fillStyle = rage && Math.floor(t * 4) % 2 ? '#ff3b1f' : '#ffd23f';
  ctx.fillText(`☠ ${B.name.toUpperCase()}`, W / 2, y - 8);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - 3, y - 3, w + 6, 14);
  ctx.fillStyle = '#3a0c08';
  ctx.fillRect(x, y, w, 8);
  ctx.fillStyle = bc.hp <= 0 ? '#555' : rage ? '#ff3b1f' : '#d8342a';
  ctx.fillRect(x, y, w * f, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, w * f, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x + w * 0.5 - 1, y - 2, 2, 12); // the rage line
  ctx.restore();
}

// ---------- Sound ----------
const BossSfx = {
  // A distorted power-chord stab with a record scratch in front of it: the card's sting.
  sting() {
    const c = Sound.ctx;
    if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource(), bf = c.createBiquadFilter(), sg = c.createGain(); // the scratch
    src.buffer = Sound.noise; src.loop = true; bf.type = 'bandpass'; bf.Q.value = 3;
    bf.frequency.setValueAtTime(400, t); bf.frequency.exponentialRampToValueAtTime(2800, t + 0.09); bf.frequency.exponentialRampToValueAtTime(600, t + 0.16);
    sg.gain.value = 0; sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.35, t + 0.01); sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(bf); bf.connect(sg); sg.connect(Sound.master); src.start(t); src.stop(t + 0.2);
    const t1 = t + 0.18, sh = c.createWaveShaper(), lp = c.createBiquadFilter(), g = c.createGain();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 6); }
    sh.curve = curve; lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t1); lp.frequency.exponentialRampToValueAtTime(700, t1 + 1.6);
    g.gain.value = 0; g.gain.setValueAtTime(0.0001, t1); g.gain.exponentialRampToValueAtTime(0.16, t1 + 0.01); g.gain.setValueAtTime(0.16, t1 + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t1 + 1.9);
    sh.connect(lp); lp.connect(g); g.connect(Sound.master);
    for (const [hz, det] of [[82.4, -8], [82.4, 8], [123.5, 0], [164.8, 5]]) { // E power chord
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = det;
      o.connect(sh); o.start(t1); o.stop(t1 + 2);
    }
    const k = c.createOscillator(), kg = c.createGain(); // a kick under it
    k.frequency.setValueAtTime(140, t1); k.frequency.exponentialRampToValueAtTime(40, t1 + 0.15);
    kg.gain.value = 0; kg.gain.setValueAtTime(0.0001, t1); kg.gain.exponentialRampToValueAtTime(0.9, t1 + 0.004); kg.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.4);
    k.connect(kg); kg.connect(Sound.master); k.start(t1); k.stop(t1 + 0.45);
    Sound.noiseBurst(1.4, 6000, 0.12, 3000); // and a crash
  },
  whoosh() { Sound.noiseBurst(0.5, 300, 0.2, 2400); },
};

// ---------- The intro card ----------
const CARD_SWOOP = 0.6, CARD_LEN = 4.2;

class BossCard {
  constructor(game) {
    this.g = game;
    this.t = 0;
    this.race = game.race;
    this.boss = this.race.boss;
    this.kit = bossKit(this.boss) || { quip: '', ink: '#d8342a' };
    this.car = this.race.bossCar;
    this.frozen = false;
    const act = ['I', 'II', 'III', 'IV'][BOSSES.indexOf(this.boss)] || '';
    this.el = document.createElement('div');
    this.el.id = 'bosscard';
    const [small, big] = this.kit.card || ['', this.boss.name]; // a small line over the big name
    this.el.innerHTML = `<canvas class="bc-ink"></canvas>
      <div class="bc-text" style="--ink:${this.kit.ink}">
        <div class="bc-act">ACT ${act} QUALIFIER</div>
        ${small ? `<div class="bc-pre">${small}</div>` : ''}
        <div class="bc-name">${big.toUpperCase()}</div>
        <div class="bc-title">${this.boss.title}</div>
        <div class="bc-quip">${this.kit.quip}</div>
      </div>
      <div class="bc-flash"></div>
      <div class="bc-skip">Any key to skip</div>`;
    document.body.appendChild(this.el);
    this.drawInk(this.el.querySelector('.bc-ink'));
    this.onInput = (e) => { if (this.t > 0.7) { if (e.preventDefault) e.preventDefault(); this.t = Math.max(this.t, CARD_LEN - 0.35); } };
    window.addEventListener('keydown', this.onInput, true);
    window.addEventListener('mousedown', this.onInput, true);
    const cv = game.cockpit;
    this.cam = { from: null };
    if (cv) {
      cv.cameraOverride = (cam) => this.aim(cam);
      cv.vm.root.visible = false;
      this.key = new THREE.PointLight('#fff0d8', 0, 160, 1); // a key light on the boss for the shot
      cv.scene.add(this.key);
    }
    BossSfx.whoosh();
  }

  // A splash of ink behind the name: a rough blob with drips and spatter, in the boss's colour.
  drawInk(cv) {
    const W = 900, H = 420;
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d'), r = mulberry32(this.boss.name.length * 131 + 7);
    x.fillStyle = this.kit.ink;
    x.beginPath();
    const cx = W * 0.42, cy = H * 0.5, N = 40;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU, rr = (1 + (r() - 0.5) * 0.35) * (Math.abs(Math.cos(a)) * 0.55 + 0.45);
      const px = cx + Math.cos(a) * W * 0.42 * rr, py = cy + Math.sin(a) * H * 0.34 * rr;
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.fill();
    for (let k = 0; k < 9; k++) { const dx = W * (0.15 + r() * 0.6), len = 30 + r() * 90; x.fillRect(dx, cy + H * 0.2, 4 + r() * 6, len); x.beginPath(); x.arc(dx + 4, cy + H * 0.2 + len, 6, 0, TAU); x.fill(); }
    for (let k = 0; k < 60; k++) { x.beginPath(); x.arc(W * r(), H * r(), 1 + r() * 7, 0, TAU); x.fill(); }
    x.globalCompositeOperation = 'destination-out'; // worn through in places
    for (let k = 0; k < 400; k++) { x.fillStyle = `rgba(0,0,0,${r() * 0.5})`; x.fillRect(W * r(), H * r(), 2, 2); }
  }

  // The camera: a swoop from high and wide onto a low three-quarter shot of the car's nose, then a slow push in.
  aim(cam) {
    const c = this.car, h = c.heading, fx = Math.cos(h), fz = Math.sin(h), rx = -Math.sin(h), rz = Math.cos(h);
    const at = (f, r, u) => new THREE.Vector3(c.x + fx * f + rx * r, u, c.y + fz * f + rz * r);
    const k = clamp(this.t / CARD_SWOOP, 0, 1), e = 1 - Math.pow(1 - k, 3), push = Math.max(0, this.t - CARD_SWOOP) * 0.06;
    const from = at(90, 70, 40), to = at(34 - push * 30, 13 - push * 10, 6);
    cam.position.copy(from.lerp(to, e));
    cam.up.set(0, 1, 0);
    cam.lookAt(at(2, 0, 4.5));
    cam.rotateY(0.2 * e); // the car on the right third, clear of the ink
    cam.rotateZ(-0.06 * e); // a slight Dutch tilt
    if (this.key) { this.key.position.copy(cam.position).add(new THREE.Vector3(0, 12, 0)); this.key.intensity = 40 * e; }
  }

  update(dt) {
    this.t += dt;
    if (!this.frozen && this.t >= CARD_SWOOP) {
      this.frozen = true;
      this.el.classList.add('in');
      this.g.c3d.classList.add('freeze');
      BossSfx.sting();
      if (this.g.cockpit) this.g.cockpit.shake = 0.6;
    }
    if (this.t >= CARD_LEN - 0.35) this.el.classList.add('out');
    if (this.t >= CARD_LEN) this.end();
  }

  end() {
    if (this.done) return;
    this.done = true;
    window.removeEventListener('keydown', this.onInput, true);
    window.removeEventListener('mousedown', this.onInput, true);
    this.el.remove();
    this.g.c3d.classList.remove('freeze');
    const cv = this.g.cockpit;
    if (cv) { cv.cameraOverride = null; cv.vm.root.visible = true; if (this.key) cv.scene.remove(this.key); }
    this.g.bossCard = null;
  }
}
