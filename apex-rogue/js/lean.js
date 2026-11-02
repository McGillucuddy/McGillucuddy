'use strict';
// Leaning out of your window (L). Your seat's on the right (the driver's on the left), so you hang out of the right
// window: you can swing round from just past dead ahead, out over your side, to behind you, and nothing's in the
// way (no windshield, no pillar).
// The price: you're out in the open. Rounds from your side and from behind find you far more often, a reload
// takes longer (one hand's on the door frame), and you can't slam the blast hatch or climb to the roof from out
// there. A cage welded over the side windows (the Window Cage) shuts it off altogether.

const LEAN = {
  t: 0.32, // seconds to get out, or back in
  arc: [-0.35, 3.0], // how far you can look round from out there (radians, + to the right: out over your side)
  hit: { side: 0.42, back: 0.3, front: 0.24 }, // the chance a round that hits the car finds you, by where it came from
  reload: 1.35, // reloads take this much longer
};

Object.assign(Combat.prototype, {
  toggleLean() {
    if (this.player.finished || this.exposed || this.climbT > 0 || this.fitT > 0 || (this.leanT || 0) > 0) return;
    if (!this.leanOut && this.hatchDown) { this.race.message('The hatch is down over the glass', '#ccc'); return; }
    if (!this.leanOut && this.build.parts && Object.values(this.build.parts).some((p) => p.id === 'window_cage')) { this.race.message('The cage is welded over the window', '#ccc'); return; }
    this.leanOut = !this.leanOut;
    this.leanT = LEAN.t;
    this.events.push({ type: 'lean', out: this.leanOut });
  },
  updateLean(dt) {
    this.leanT = Math.max(0, (this.leanT || 0) - dt);
    this.leanK = clamp((this.leanK || 0) + (this.leanOut ? 1 : -1) * dt / LEAN.t, 0, 1);
    if (this.leanOut && (this.exposed || this.player.finished)) { this.leanOut = false; this.leanT = LEAN.t; }
  },
  // A round into the car while you're hanging out of the window: you, mostly, if it came from your side or behind.
  leanHit(rel) {
    const a = Math.abs(rel);
    if (a < 0.9) return this.rng() < LEAN.hit.front ? 'you' : this.rng() < CABIN.front ? 'driver' : null; // (no windshield for you to hide behind)
    if (a < 2.2) return rel > 0 ? (this.rng() < LEAN.hit.side ? 'you' : null) : (this.rng() < CABIN.side ? 'driver' : null);
    return this.rng() < LEAN.hit.back ? 'you' : this.rng() < CABIN.back ? 'driver' : null;
  },
});
