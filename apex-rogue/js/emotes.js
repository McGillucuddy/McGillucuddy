'use strict';
// Emotes: your free (left) hand comes up into view and tells a rival what you think of them. Tap T for your last
// one (the finger, to start with); hold T for the wheel and flick the mouse to pick. Whoever is under your
// crosshair gets TILTED: they drive sloppier and come straight for you. Pass them or wreck them while they're
// tilted and the crowd pays out. Taunt a boss and they answer.

const EMOTES = {
  flip: { name: 'Flip off', icon: '🖕', line: 'flips off' },
  thumbs: { name: 'Thumbs down', icon: '👎', line: 'gives a thumbs down to' },
  beckon: { name: 'Come at me', icon: '🫴', line: 'waves on' },
  horns: { name: 'Devil horns', icon: '🤘', line: 'throws the horns at' },
};
const EMOTE_ORDER = ['flip', 'thumbs', 'beckon', 'horns']; // wheel: up, right, down, left
const EMOTE_CD = 2.5;
const TILT_TIME = 8;
const HUMILIATE_PASS = 15, HUMILIATE_WRECK = 30;

// What the bosses say back when you taunt them.
const BOSS_COMEBACKS = {
  'The Turnkey': ['"That\'s solitary for you, inmate."', '"I\'m writing that down."', '"Keep waving. I\'ll take the hand."'],
  'Smokestack Sal': ['"Ha! Breathe deep, kid."', '"Seen ruder in the boiler room."', '"I\'ll bury that finger with the rest of you."'],
  'Augustin Vale': ['"How dare you. Do you know who sponsors me?"', '"Security will hear about this."', '"Charming. Truly. Prison manners."'],
  'Vex "The Apex" Marlowe': ['"Cute. They all do that before the end."', '"Enjoy it. It\'s the last thing you\'ll do free."', '"I\'ll frame that."'],
};

const Emotes = {
  // The gloved left hand making a gesture, with the orange sleeve. Hand frame: wrist at the origin, fingers up (+Y),
  // palm towards you (+Z), thumb to the right (+X). frame: 0 or 1 (the beckon curls between them).
  hand(id, frame) {
    const key = 'emote:' + id + ':' + (frame || 0);
    const g = new THREE.Group();
    const glove = LP.mat('#2c2622', { roughness: 0.6 }), seam = LP.mat('#16120f', { roughness: 0.7 });
    const sc = new Sculpt(key, 0.03);
    // Palm and the back of the hand, the knuckle guard across the back.
    sc.add(glove, SDF.box([0.86, 0.95, 0.32], 0.14, [0, 0.52, 0]), 0.1);
    sc.add(glove, SDF.ellipsoid([0.36, 0.3, 0.2], [0.26, 0.28, 0.06]), 0.12); // thenar pad
    sc.add(seam, SDF.box([0.84, 0.16, 0.12], 0.05, [0, 0.9, -0.15]), 0.04); // knuckle guard
    sc.add(glove, SDF.cyl(0.4, 0.3, 'y', 0.1, [0, 0.0, 0]), 0.12); // wrist
    sc.add(seam, SDF.cyl(0.43, 0.12, 'y', 0.04, [0, -0.05, 0]), 0.03); // strap
    // Fingers: [x at the knuckle, bone lengths, radius]. curl: radians at each joint, folding towards the palm (+Z).
    const F = { index: [0.3, [0.42, 0.26, 0.2], 0.12], middle: [0.1, [0.46, 0.3, 0.22], 0.125], ring: [-0.1, [0.42, 0.27, 0.2], 0.12], pinky: [-0.3, [0.32, 0.2, 0.17], 0.105] };
    const OUT = [0.02, 0.05, 0.04], FIST = [1.55, 1.7, 1.2];
    const pose = {
      flip: { index: FIST, middle: OUT, ring: FIST, pinky: FIST, thumb: 'across' },
      thumbs: { index: FIST, middle: FIST, ring: FIST, pinky: FIST, thumb: 'out' },
      beckon: frame ? { index: [1.2, 1.3, 0.9], middle: [1.2, 1.3, 0.9], ring: [1.25, 1.3, 0.9], pinky: [1.3, 1.3, 0.9], thumb: 'side' } : { index: OUT, middle: OUT, ring: [0.05, 0.08, 0.05], pinky: [0.08, 0.1, 0.05], thumb: 'side' },
      horns: { index: OUT, middle: FIST, ring: FIST, pinky: OUT, thumb: 'across' },
    }[id];
    for (const [name, [x, lens, r]] of Object.entries(F)) {
      const curl = pose[name];
      let p = [x, 0.98, 0.0], a = 0;
      lens.forEach((L, j) => {
        a += curl[j];
        const q = [p[0] - x * 0.03 * j, p[1] + Math.cos(a) * L, p[2] + Math.sin(a) * L];
        sc.add(glove, SDF.cone(p, q, r * (1 - j * 0.08), r * (1 - (j + 1) * 0.08)), 0.06);
        p = q;
      });
    }
    // Thumb: across the folded fingers, straight out to the side, or resting along the palm.
    const T0 = [0.42, 0.35, 0.12];
    const tp = pose.thumb === 'across' ? [[0.42, 0.62, 0.38], [0.12, 0.78, 0.5]] : pose.thumb === 'out' ? [[0.78, 0.55, 0.1], [1.12, 0.66, 0.08]] : [[0.62, 0.62, 0.22], [0.74, 0.88, 0.25]];
    sc.add(glove, SDF.cone(T0, tp[0], 0.15, 0.13), 0.08);
    sc.add(glove, SDF.cone(tp[0], tp[1], 0.13, 0.11), 0.05);
    const hand = new THREE.Group();
    sc.build(hand);
    g.add(hand);
    // Thumbs down: just the fist turns over (about the wrist) so the thumb points at the floor.
    if (id === 'thumbs') { hand.rotation.set(0, 0.35, -Math.PI / 2); hand.position.set(-0.2, 0.25, 0); }
    // Forearm in the sleeve, angled down and back towards your shoulder.
    const suit = LP.mat('#d6631d', { roughness: 0.95 }), cuff = LP.mat('#b4521a', { roughness: 0.95 });
    g.add(LP.limb([[0, -0.15, 0.02], [0, -0.45, 0.1], [0, -0.75, 0.2]], [0.45, 0.5, 0.48], cuff, (t, a) => 1 + 0.05 * Math.sin(a * 5 + 1)));
    g.add(LP.limb([[0, -0.6, 0.15], [-0.45, -2.6, 0.95], [-1.1, -5.2, 2.0]], [0.44, 0.5, 0.56], suit, (t, a) => 1 + 0.045 * Math.sin(a * 3 + t * 9)));
    return g;
  },

  // The rival nearest your crosshair, in front of you and close enough to see the gesture.
  target(combat, aim) {
    const p = combat.player;
    let best = null, bestScore = 0.42;
    for (const c of combat.race.cars) {
      if (c === p || c.hp <= 0 || c.finished) continue;
      const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy);
      if (d > 800) continue;
      const off = Math.abs(wrapAngle(Math.atan2(dy, dx) - aim));
      const score = off + d / 4000;
      if (off < 0.42 && score < bestScore) { bestScore = score; best = c; }
    }
    return best;
  },
};

// Gameplay side, mixed into Combat.
Object.assign(Combat.prototype, {
  emote(id, aim) {
    const p = this.player;
    if ((this.emoteCd || 0) > 0 || p.finished || this.race.state !== 'racing' || this.hatchDown) return false;
    this.emoteCd = EMOTE_CD;
    const c = Emotes.target(this, aim);
    this.events.push({ type: 'emote', id, target: c });
    if (!c) return true; // to nobody in particular
    const first = !(c.tiltT > 0);
    c.tiltT = c.isBoss ? TILT_TIME * 0.6 : TILT_TIME;
    if (first) {
      c.wasAhead = c.place < p.place; // were they ahead of you when you got under their skin?
      if (c.ai) { c.ai.skillBase = c.ai.skillBase ?? c.ai.skill; c.ai.skill = c.ai.skillBase - 0.12; c.ai.rammer = true; c.ai.grudge = p; }
      if (c.wpn) c.wpn.cd = Math.min(c.wpn.cd, 0.6); // and they come for you
    }
    if (c.isBoss) {
      const lines = BOSS_COMEBACKS[c.name] || ['"..."'];
      this.race.message(`${c.name}: ${lines[Math.floor(this.rng() * lines.length)]}`, '#ffd23f');
    } else this.race.message(`${shortName(c)} is TILTED`, '#ff7a1f');
    return true;
  },

  updateTilt(dt) {
    const p = this.player;
    this.emoteCd = (this.emoteCd || 0) - dt;
    for (const c of this.race.cars) {
      if (!(c.tiltT > 0)) continue;
      c.tiltT -= dt;
      // Humiliation: you go past someone who was ahead when you taunted them, or they get wrecked while seething.
      if (c.wasAhead && p.place < c.place && !c.humiliated) {
        c.humiliated = true;
        this.stats.scrapBonus += HUMILIATE_PASS;
        this.race.message(`Humiliated ${shortName(c)}: +${HUMILIATE_PASS} scrap`, '#7CFC00');
        this.events.push({ type: 'crowd' });
      }
      if (c.hp <= 0 && !c.humiliatedWreck) {
        c.humiliatedWreck = true;
        this.stats.scrapBonus += HUMILIATE_WRECK;
        this.race.message(`The crowd loves it: +${HUMILIATE_WRECK} scrap`, '#7CFC00', true);
        this.events.push({ type: 'crowd' });
      }
      if (c.tiltT <= 0 && c.ai && c.ai.skillBase != null) { c.ai.skill = c.ai.skillBase; c.ai.rammer = false; c.ai.grudge = null; c.wasAhead = false; }
    }
  },
});
