'use strict';
// Motion: the small set of tools every moving body part uses, so they all move the same way.
//
// - Motion.path(keys, t): a hand (or a boot, or a shell) moving through timed waypoints. It flows through each one
//   on a smooth curve instead of easing to a stop at every key (which reads as robotic), and only comes to rest
//   where it should: at the first and last key, and on a hold (the same point twice in a row: a grab, a push).
// - Motion.spring(s, target, dt, w): a critically damped spring, for anything that should catch up with where it
//   ought to be without overshooting or snapping (a lean, a glance, a hand let go).
// - Motion.ease / easeIn / easeOut: the curves for starting and stopping.

const Motion = {
  ease: (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); },
  easeIn: (k) => { k = Math.max(0, Math.min(1, k)); return k * k; },
  easeOut: (k) => { k = Math.max(0, Math.min(1, k)); return 1 - (1 - k) * (1 - k); },

  // keys: [[t, Vector3], ...] with t rising. Cubic Hermite through the keys with Catmull-Rom tangents (the slope
  // between the neighbours), zero at the ends and at holds, so velocity is continuous everywhere. Writes to out.
  path(keys, t, out) {
    out = out || new THREE.Vector3();
    const n = keys.length;
    if (t <= keys[0][0]) return out.copy(keys[0][1]);
    if (t >= keys[n - 1][0]) return out.copy(keys[n - 1][1]);
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const [t0, p0] = keys[i], [t1, p1] = keys[i + 1], h = t1 - t0, s = (t - t0) / h;
    const tan = (k) => {
      if (k === 0 || k === n - 1) return null;
      const [ta, pa] = keys[k - 1], [tb, pb] = keys[k + 1], pk = keys[k][1];
      if (pk.distanceToSquared(pa) < 1e-8 || pk.distanceToSquared(pb) < 1e-8) return null; // a hold: arrive and leave at rest
      return pb.clone().sub(pa).divideScalar(tb - ta);
    };
    const m0 = tan(i), m1 = tan(i + 1), s2 = s * s, s3 = s2 * s;
    out.copy(p0).multiplyScalar(2 * s3 - 3 * s2 + 1).addScaledVector(p1, -2 * s3 + 3 * s2);
    if (m0) out.addScaledVector(m0, (s3 - 2 * s2 + s) * h);
    if (m1) out.addScaledVector(m1, (s3 - s2) * h);
    return out;
  },

  // A critically damped spring on a number or a Vector3. s: { x, v } (numbers) or { x: Vector3, v: Vector3 }.
  // w: how quickly it catches up (rad/s; ~1/w seconds to close most of the gap).
  spring(s, target, dt, w) {
    const k = Math.exp(-w * dt);
    if (typeof s.x === 'number') {
      const d = s.x - target, j = (s.v + w * d) * dt;
      s.x = target + (d + j) * k; s.v = (s.v - w * j) * k;
      return s.x;
    }
    const d = s.x.clone().sub(target), j = s.v.clone().addScaledVector(d, w).multiplyScalar(dt);
    s.x.copy(target).addScaledVector(d.add(j), k);
    s.v.addScaledVector(j, -w).multiplyScalar(k);
    return s.x;
  },
};
