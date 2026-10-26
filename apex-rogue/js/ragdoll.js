'use strict';
// Ragdolls: when a car goes up (a grenade in the cabin, a rocket, a big crash), its crew can be thrown out. Each body
// is a little verlet skeleton (16 points: head, neck, chest, pelvis, shoulders, elbows, hands, hips, knees, feet)
// held together by distance constraints, the torso stiff and the limbs loose, falling under gravity, tumbling,
// skidding along the road and getting knocked about by any car that runs into it. Drawn from the same materials as
// the figure it replaces (js/people.js), so the jumpsuit, skin and hat match the one you saw through the glass.
//
// Coordinates: the 3D view's world space (x, up, z) = the sim's (x, height, y). Sim units: a car is about 40 long.

const RAG = { g: 160, step: 1 / 60, iters: 7, max: 8, life: 18, sink: 1.2, airDamp: 0.996, friction: 0.93, bounce: 0.3 };

// When a wrecked car throws its crew, by what finished it: [chance, power]. Speed raises a crash's chance.
const EJECT = { cabin: [1, 1.1], blast: [0.75, 1], fire: [0.2, 0.5], ram: [0.25, 0.7], bullet: [0.12, 0.6], crowd: [0.3, 0.6], fast: 260 };

// Gameplay side, mixed into Combat: decide who gets thrown out when a rival dies.
Object.assign(Combat.prototype, {
  checkEjections() {
    const p = this.player, now = this.race.time;
    for (const c of this.race.cars) {
      if (c === p || c.hp > 0 || c.ejectChecked) continue;
      c.ejectChecked = true;
      const kind = c.ejectBlast ? 'cabin' : c.lastHit && now - c.lastHit.t < 0.5 ? c.lastHit.kind : 'ram';
      const speed = Math.hypot(c.vx, c.vy), [chance, power] = EJECT[kind] || EJECT.ram;
      const odds = Math.min(1, chance + (speed > EJECT.fast ? 0.35 : 0));
      if (this.rng() > odds) continue;
      const roles = c.weapon ? ['driver', 'gunner'] : ['driver'];
      this.events.push({ type: 'eject', car: c, roles, kind, power: power + (speed > EJECT.fast ? 0.2 : 0) });
      if (Math.hypot(c.x - p.x, c.y - p.y) < 900) this.race.message(`${shortName(c)} goes through the windscreen!`, '#ffb070');
    }
  },
});

// Joints in figure space (js/people.js: hips at the origin, +x forward, +y up, +z right), seated.
const RAG_JOINTS = (role) => {
  const A = People.ARM_POSES[role] || People.ARM_POSES.driver;
  return [
    [0.35, 6.3, 0], [0.12, 5.0, 0], [0.05, 3.4, 0], [0.1, 0.8, 0], // 0 head, 1 neck, 2 chest, 3 pelvis
    [0.05, 4.3, -1.75], [0.05, 4.3, 1.75], A[0][0], A[1][0], A[0][1], A[1][1], // 4,5 shoulders; 6,7 elbows; 8,9 hands
    [0.3, 0.55, -0.85], [0.3, 0.55, 0.85], [4.1, 0.9, -1.0], [4.1, 0.9, 1.0], [4.7, -3.3, -1.05], [4.7, -3.3, 1.05], // hips, knees, feet
  ];
};
const RAG_TORSO = [1, 2, 3, 4, 5, 10, 11];
const RAG_BONES = [[0, 1], [0, 2], [4, 6], [6, 8], [5, 7], [7, 9], [10, 12], [12, 14], [11, 13], [13, 15]];
const RAG_REACH = [[4, 8, 0.45], [5, 9, 0.45], [10, 14, 0.5], [11, 15, 0.5], [0, 3, 0.85]]; // limbs can't fold flat; the neck can't fold into the chest

class Ragdolls {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.acc = 0;
    const poly = People.poly(); // the low-poly look: six-sided limbs and a block of a head
    this.cyl = new THREE.CylinderGeometry(1, 1, 1, poly ? 6 : 8, 1);
    this.ball = poly ? new THREE.BoxGeometry(1.5, 1.7, 1.4) : new THREE.SphereGeometry(1, 10, 8);
    this.cap = new THREE.SphereGeometry(1.04, 10, 6, 0, TAU, 0, Math.PI * 0.42);
    this.box = new THREE.BoxGeometry(1, 1, 1);
  }

  clear() {
    for (const R of this.list) this.scene.remove(R.g);
    this.list = [];
  }

  // Throw a figure out of its car. fig: the crew figure (hidden afterwards); vel: the car's velocity (sim x, y);
  // heading: the car's; o: { power, kind, role }.
  spawn(fig, vel, heading, o) {
    if (this.list.length >= RAG.max) { const old = this.list.shift(); this.scene.remove(old.g); }
    fig.updateMatrixWorld(true);
    const pts = RAG_JOINTS(o.role).map((j) => fig.localToWorld(new THREE.Vector3(...j)));
    const s = fig.getWorldScale(new THREE.Vector3()).x;
    // The throw: the car's own speed carried on, then up and out (sideways through the glass for a blast, forwards
    // through the windscreen for a crash), with a twist so it tumbles.
    const P = o.power || 1, fwd = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading)), side = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(Math.random() < 0.5 ? -1 : 1);
    const out = o.kind === 'cabin' || o.kind === 'blast' ? side.clone().multiplyScalar(70 * P).addScaledVector(fwd, 20) : fwd.clone().multiplyScalar(80 * P).addScaledVector(side, 25);
    const base = new THREE.Vector3(vel.x * 0.8, 45 + 45 * P + Math.random() * 20, vel.y * 0.8).add(out);
    const spin = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize().multiplyScalar(40 * P);
    const pelvis = pts[3];
    const P0 = pts.map((p) => {
      const v = base.clone().addScaledVector(spin, (p.y - pelvis.y) / (6 * s)); // the top half thrown harder than the legs: a tumble
      v.x += (Math.random() - 0.5) * 12; v.z += (Math.random() - 0.5) * 12;
      return { p: p.clone(), q: p.clone().addScaledVector(v, -RAG.step), r: (p === pts[0] ? 1.0 : 0.55) * s };
    });
    const sticks = [];
    const stick = (a, b, k, min) => sticks.push({ a, b, len: P0[a].p.distanceTo(P0[b].p) * (min || 1), k, min: !!min });
    for (let i = 0; i < RAG_TORSO.length; i++) for (let j = i + 1; j < RAG_TORSO.length; j++) stick(RAG_TORSO[i], RAG_TORSO[j], 1);
    for (const [a, b] of RAG_BONES) stick(a, b, 1);
    for (const [a, b, f] of RAG_REACH) stick(a, b, 0.5, f);
    const M = fig.userData.M, L = fig.userData.looks || {};
    const g = new THREE.Group(), mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); g.add(m); return m; };
    const parts = {
      torso: mesh(this.box, M.suit),
      head: mesh(this.ball, M.skin),
      hat: fig.userData.helmet || ['beanie', 'cap', 'bandana', 'helmet'].includes(L.gear) ? mesh(this.cap, L.gear === 'helmet' || o.helmet ? M.helmet : M.hat) : null,
      limbs: [[4, 6, 0.42, M.suit], [6, 8, 0.38, M.suit], [5, 7, 0.42, M.suit], [7, 9, 0.38, M.suit], [10, 12, 0.62, M.suit], [12, 14, 0.5, M.suit], [11, 13, 0.62, M.suit], [13, 15, 0.5, M.suit], [1, 0, 0.36, M.skin]]
        .map(([a, b, r, mat]) => ({ a, b, r: r * s, m: mesh(this.cyl, mat) })),
      hands: [8, 9].map((i) => ({ i, m: mesh(this.ball, M.glove) })),
      feet: [14, 15].map((i) => ({ i, m: mesh(this.box, M.boot) })),
    };
    g.frustumCulled = false;
    this.scene.add(g);
    const R = { pts: P0, sticks, g, parts, s, t: 0, still: 0 };
    this.list.push(R);
    this.draw(R);
    return R;
  }

  update(dt, cars) {
    if (!this.list.length) return;
    this.acc = Math.min(this.acc + dt, RAG.step * 4);
    while (this.acc >= RAG.step) {
      this.acc -= RAG.step;
      for (const R of this.list) this.stepOne(R, cars);
    }
    for (const R of this.list) { R.t += dt; this.draw(R); }
    const gone = this.list.filter((R) => R.t > RAG.life + RAG.sink);
    for (const R of gone) this.scene.remove(R.g);
    if (gone.length) this.list = this.list.filter((R) => !gone.includes(R));
  }

  stepOne(R, cars) {
    const h = RAG.step, g = RAG.g * h * h;
    let moving = 0;
    for (const P of R.pts) {
      const vx = (P.p.x - P.q.x) * RAG.airDamp, vy = (P.p.y - P.q.y) * RAG.airDamp, vz = (P.p.z - P.q.z) * RAG.airDamp;
      P.q.copy(P.p);
      P.p.x += vx; P.p.y += vy - g; P.p.z += vz;
      moving += Math.abs(vx) + Math.abs(vy) + Math.abs(vz);
    }
    // Cars shove whatever they hit (and fling it if they're moving).
    for (const c of cars || []) {
      const pel = R.pts[3].p;
      if (Math.abs(c.x - pel.x) > 30 || Math.abs(c.y - pel.z) > 30) continue;
      const sp = Math.hypot(c.vx, c.vy);
      for (const P of R.pts) {
        const dx = P.p.x - c.x, dz = P.p.z - c.y, d = Math.hypot(dx, dz), rr = CAR_RADIUS * 0.9;
        if (d >= rr || P.p.y > 12) continue;
        const k = (rr - d) / Math.max(d, 0.01);
        P.p.x += dx * k; P.p.z += dz * k;
        if (sp > 60) { P.q.x = P.p.x - c.vx * h * 0.9; P.q.z = P.p.z - c.vy * h * 0.9; P.q.y = P.p.y - (20 + sp * 0.12) * h; }
      }
    }
    for (let it = 0; it < RAG.iters; it++) {
      for (const S of R.sticks) {
        const A = R.pts[S.a].p, B = R.pts[S.b].p;
        const dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z, d = Math.hypot(dx, dy, dz) || 1e-4;
        if (S.min && d >= S.len) continue; // a reach limit only pushes apart
        const f = ((d - S.len) / d) * 0.5 * S.k;
        A.x += dx * f; A.y += dy * f; A.z += dz * f;
        B.x -= dx * f; B.y -= dy * f; B.z -= dz * f;
      }
      // The road: points stop on it, bounce a little off a hard landing and skid to a halt.
      for (const P of R.pts) {
        if (P.p.y >= P.r) continue;
        const vy = P.p.y - P.q.y;
        P.p.y = P.r;
        P.q.y = P.p.y + (vy < -0.6 ? vy * RAG.bounce : 0);
        P.ground = true;
      }
    }
    for (const P of R.pts) { // skidding along the road: friction once a step, on whatever's touching it
      if (!P.ground) continue;
      P.ground = false;
      P.q.x = P.p.x - (P.p.x - P.q.x) * RAG.friction;
      P.q.z = P.p.z - (P.p.z - P.q.z) * RAG.friction;
    }
    R.still = moving < 0.05 * R.pts.length ? R.still + h : 0;
  }

  // Lay the meshes along the skeleton.
  draw(R) {
    const P = R.pts.map((x) => x.p), s = R.s, U = this._u || (this._u = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), m: new THREE.Matrix4() });
    const sink = Math.max(0, R.t - RAG.life) / RAG.sink; // at the end it sinks into the road and is gone
    R.g.position.y = -sink * 4 * s;
    const seg = (m, a, b, r) => {
      U.a.subVectors(b, a); const len = U.a.length();
      m.position.addVectors(a, b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(U.up, U.a.normalize());
      m.scale.set(r, len, r);
    };
    // Torso: a box spanning pelvis to neck, as wide as the shoulders.
    const T = R.parts.torso;
    U.a.subVectors(P[1], P[3]); const tall = U.a.length(); U.a.normalize(); // up the spine
    U.b.subVectors(P[5], P[4]).normalize(); // across the shoulders
    U.c.crossVectors(U.a, U.b).normalize(); // forward (chest)
    U.b.crossVectors(U.c, U.a).normalize();
    U.m.makeBasis(U.c, U.a, U.b);
    T.quaternion.setFromRotationMatrix(U.m);
    T.position.addVectors(P[1], P[3]).multiplyScalar(0.5);
    T.scale.set(2.0 * s, tall * 1.08, 3.3 * s);
    // Head and hat, the hat turned the way the neck points.
    R.parts.head.position.copy(P[0]); R.parts.head.scale.setScalar(0.95 * s);
    if (R.parts.hat) {
      U.a.subVectors(P[0], P[1]).normalize();
      R.parts.hat.position.copy(P[0]); R.parts.hat.scale.setScalar(0.98 * s);
      R.parts.hat.quaternion.setFromUnitVectors(U.up, U.a);
    }
    for (const L of R.parts.limbs) seg(L.m, P[L.a], P[L.b], L.r);
    for (const H of R.parts.hands) { H.m.position.copy(P[H.i]); H.m.scale.setScalar(0.42 * s); }
    R.parts.feet.forEach((F, k) => {
      F.m.position.copy(P[F.i]);
      U.a.subVectors(P[F.i], P[12 + k]).normalize(); // along the shin
      F.m.quaternion.setFromUnitVectors(U.up, U.a);
      F.m.scale.set(1.0 * s, 0.8 * s, 1.9 * s);
    });
  }
}
