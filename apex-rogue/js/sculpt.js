'use strict';
// Sculpted models: solids described as signed distance fields (negative inside), blended together and meshed
// into seamless surfaces. Parts of the same material melt into each other with a fillet instead of meeting
// at a hard seam; cuts carve ports and grooves; every material comes out as one smooth mesh.

const SDF = {
  // A rigid transform: returns a function mapping a world point into the part's local frame, plus the forward matrix.
  frame(pos, rot) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...(pos || [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]))), new THREE.Vector3(1, 1, 1));
    const e = new THREE.Matrix4().copy(m).invert().elements, o = [0, 0, 0];
    const plain = !rot || (!rot[0] && !rot[1] && !rot[2]);
    return { // local() reuses one array per part: read it straight away
      m,
      local: plain ? (x, y, z) => { o[0] = x + e[12]; o[1] = y + e[13]; o[2] = z + e[14]; return o; }
        : (x, y, z) => {
          o[0] = e[0] * x + e[4] * y + e[8] * z + e[12]; o[1] = e[1] * x + e[5] * y + e[9] * z + e[13]; o[2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          return o;
        },
    };
  },
  // World-space bounds of a local box [x0,y0,z0,x1,y1,z1] under a transform.
  boxOf(lb, m) {
    const out = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9], v = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? lb[3] : lb[0], i & 2 ? lb[4] : lb[1], i & 4 ? lb[5] : lb[2]).applyMatrix4(m);
      out[0] = Math.min(out[0], v.x); out[1] = Math.min(out[1], v.y); out[2] = Math.min(out[2], v.z);
      out[3] = Math.max(out[3], v.x); out[4] = Math.max(out[4], v.y); out[5] = Math.max(out[5], v.z);
    }
    return out;
  },
  // Signed distance to a closed 2D polygon [[u, v], ...].
  poly2(pts, u, v) {
    let d = (u - pts[0][0]) ** 2 + (v - pts[0][1]) ** 2, s = 1;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const ex = pts[j][0] - pts[i][0], ey = pts[j][1] - pts[i][1], wx = u - pts[i][0], wy = v - pts[i][1];
      const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
      const bx = wx - ex * t, by = wy - ey * t;
      d = Math.min(d, bx * bx + by * by);
      const c1 = v >= pts[i][1], c2 = v < pts[j][1], c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  },
  // Polygon distance as a function of (u, v). Big outlines (car bodies) are sampled once into a fine 2D grid and
  // read back bilinearly, which is far cheaper than walking 60+ edges for every sample.
  poly2fn(pts, res) {
    if (pts.length <= 16) return (u, v) => SDF.poly2(pts, u, v);
    const us = pts.map((p) => p[0]), vs = pts.map((p) => p[1]), m = 1.5;
    const u0 = Math.min(...us) - m, v0 = Math.min(...vs) - m, h = res || 0.05;
    const nu = Math.ceil((Math.max(...us) + m - u0) / h) + 1, nv = Math.ceil((Math.max(...vs) + m - v0) / h) + 1;
    let grid = null; // filled on first use, so parts built for a model that is already cached cost nothing
    return (u, v) => {
      if (!grid) {
        grid = new Float32Array(nu * nv);
        for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) grid[i + nu * j] = SDF.poly2(pts, u0 + i * h, v0 + j * h);
      }
      const fu = (u - u0) / h, fv = (v - v0) / h;
      if (fu < 0 || fv < 0 || fu >= nu - 1 || fv >= nv - 1) return SDF.poly2(pts, u, v);
      const i = fu | 0, j = fv | 0, a = fu - i, b = fv - j, k = i + nu * j;
      return (grid[k] * (1 - a) + grid[k + 1] * a) * (1 - b) + (grid[k + nu] * (1 - a) + grid[k + nu + 1] * a) * b;
    };
  },
  // Extrude a 2D distance d2 through a slab |w| <= hw, with edges rounded by r.
  slab(d2, w, hw, r) {
    const a = d2 + r, b = Math.abs(w) - hw + r;
    return Math.min(Math.max(a, b), 0) + Math.hypot(Math.max(a, 0), Math.max(b, 0)) - r;
  },

  // ---------- Parts: each is { d(x, y, z), box } ----------

  // Rounded box of size [w, h, d] with edge radius r.
  box(size, r, pos, rot) {
    const f = SDF.frame(pos, rot), hx = size[0] / 2 - r, hy = size[1] / 2 - r, hz = size[2] / 2 - r;
    return {
      d: (x, y, z) => {
        const p = f.local(x, y, z), qx = Math.abs(p[0]) - hx, qy = Math.abs(p[1]) - hy, qz = Math.abs(p[2]) - hz;
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
        return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
      },
      box: SDF.boxOf([-size[0] / 2, -size[1] / 2, -size[2] / 2, size[0] / 2, size[1] / 2, size[2] / 2], f.m),
    };
  },
  // Cylinder of radius rad and length len along the local axis ('x', 'y' or 'z'), rims rounded by r.
  cyl(rad, len, axis, r, pos, rot) {
    const f = SDF.frame(pos, rot), ax = 'xyz'.indexOf(axis || 'y');
    return {
      d: (x, y, z) => {
        const p = f.local(x, y, z), h = p[ax], ra = Math.hypot(p[(ax + 1) % 3], p[(ax + 2) % 3]);
        return SDF.slab(ra - rad, h, len / 2, r);
      },
      box: SDF.boxOf(ax === 0 ? [-len / 2, -rad, -rad, len / 2, rad, rad] : ax === 1 ? [-rad, -len / 2, -rad, rad, len / 2, rad] : [-rad, -rad, -len / 2, rad, rad, len / 2], f.m),
    };
  },
  // Cone between spheres: a at radius ra, b at radius rb (world space).
  cone(a, b, ra, rb) {
    return {
      d: (x, y, z) => LP.roundCone(x, y, z, a, b, ra, rb),
      box: [Math.min(a[0] - ra, b[0] - rb), Math.min(a[1] - ra, b[1] - rb), Math.min(a[2] - ra, b[2] - rb),
        Math.max(a[0] + ra, b[0] + rb), Math.max(a[1] + ra, b[1] + rb), Math.max(a[2] + ra, b[2] + rb)],
    };
  },
  // A rod of radius r along a smooth curve through points (trigger guards, hoses, bent wire).
  path(points, r, closed) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), !!closed, 'centripetal');
    const pts = curve.getPoints(points.length * 6).map((v) => v.toArray());
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) segs.push(SDF.cone(pts[i], pts[i + 1], r, r));
    return SDF.union(segs);
  },
  // Turned on a lathe about the local Z axis: profile [[radius, z], ...], closed down to the axis at both ends.
  lathe(profile, pos, rot) {
    const f = SDF.frame(pos, rot);
    const poly = [[0, profile[0][1]], ...profile, [0, profile[profile.length - 1][1]]];
    const R = Math.max(...profile.map((p) => p[0])), z0 = Math.min(...profile.map((p) => p[1])), z1 = Math.max(...profile.map((p) => p[1]));
    return {
      d: (x, y, z) => { const p = f.local(x, y, z); return SDF.poly2(poly, Math.hypot(p[0], p[1]), p[2]); },
      box: SDF.boxOf([-R, -R, z0, R, R, z1], f.m),
    };
  },
  // A side outline extruded across the gun, like LP.sideZ: points [[u = forward, v = up], ...], width along X.
  side(points, width, r, pos, rot) {
    const f = SDF.frame(pos, rot), hw = width / 2, d2 = SDF.poly2fn(points);
    const us = points.map((p) => p[0]), vs = points.map((p) => p[1]);
    return {
      d: (x, y, z) => { const p = f.local(x, y, z); return SDF.slab(d2(-p[2], p[1]), p[0], hw, r); },
      box: SDF.boxOf([-hw, Math.min(...vs), -Math.max(...us), hw, Math.max(...vs), -Math.min(...us)], f.m),
    };
  },
  // A car-style profile extruded sideways: points [[x, y], ...] in the X-Y plane, width along Z.
  sideX(points, width, r, pos, rot) {
    const f = SDF.frame(pos, rot), hw = width / 2, d2 = SDF.poly2fn(points);
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    return {
      d: (x, y, z) => { const p = f.local(x, y, z); return SDF.slab(d2(p[0], p[1]), p[2], hw, r); },
      box: SDF.boxOf([Math.min(...xs), Math.min(...ys), -hw, Math.max(...xs), Math.max(...ys), hw], f.m),
    };
  },
  // A plan-view outline [[x, z], ...] extruded up from y0 to y1 (bumpers, valances).
  plan(points, y0, y1, r, pos, rot) {
    const f = SDF.frame(pos, rot), hh = (y1 - y0) / 2, yc = (y0 + y1) / 2, d2 = SDF.poly2fn(points);
    const xs = points.map((p) => p[0]), zs = points.map((p) => p[1]);
    return {
      d: (x, y, z) => { const p = f.local(x, y, z); return SDF.slab(d2(p[0], p[2]), p[1] - yc, hh, r); },
      box: SDF.boxOf([Math.min(...xs), y0, Math.min(...zs), Math.max(...xs), y1, Math.max(...zs)], f.m),
    };
  },
  // Grow a part outward by r with a rounded edge (like an extrusion bevel).
  inflate(part, r) {
    return { d: (x, y, z) => part.d(x, y, z) - r, box: part.box.map((v, i) => v + (i < 3 ? -r : r)) };
  },
  ellipsoid(radii, pos, rot) {
    const f = SDF.frame(pos, rot), [a, b, c] = radii;
    return {
      d: (x, y, z) => {
        const p = f.local(x, y, z), k0 = Math.hypot(p[0] / a, p[1] / b, p[2] / c), k1 = Math.hypot(p[0] / (a * a), p[1] / (b * b), p[2] / (c * c));
        return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(a, b, c);
      },
      box: SDF.boxOf([-a, -b, -c, a, b, c], f.m),
    };
  },
  torus(R, r, pos, rot) { // ring in the local XY plane
    const f = SDF.frame(pos, rot);
    return {
      d: (x, y, z) => { const p = f.local(x, y, z); return Math.hypot(Math.hypot(p[0], p[1]) - R, p[2]) - r; },
      box: SDF.boxOf([-R - r, -R - r, -r, R + r, R + r, r], f.m),
    };
  },
  // Several parts as one (hard union).
  union(parts) {
    const box = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const p of parts) for (let i = 0; i < 3; i++) { box[i] = Math.min(box[i], p.box[i]); box[i + 3] = Math.max(box[i + 3], p.box[i + 3]); }
    const sph = parts.map((p) => { // bounding spheres: skip members that can't be the nearest
      const c = [(p.box[0] + p.box[3]) / 2, (p.box[1] + p.box[4]) / 2, (p.box[2] + p.box[5]) / 2];
      return [c[0], c[1], c[2], Math.hypot(p.box[3] - c[0], p.box[4] - c[1], p.box[5] - c[2])];
    });
    return {
      d: (x, y, z) => {
        let d = 1e9;
        for (let i = 0; i < parts.length; i++) {
          const q = sph[i], dx = x - q[0], dy = y - q[1], dz = z - q[2];
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) - q[3] < d) d = Math.min(d, parts[i].d(x, y, z));
        }
        return d;
      },
      box,
    };
  },
  // Bend space before measuring a part: fn maps a world point to where it would be in the unbent part.
  // grow pads the bounds when the bend can move the surface outward.
  warp(part, fn, grow) {
    const g = grow || 0;
    return { d: (x, y, z) => { const p = fn(x, y, z); return part.d(p[0], p[1], p[2]); }, box: part.box.map((v, i) => v + (i < 3 ? -g : g)) };
  },
};

// Builder: add parts per material (they blend with fillet k), carve cuts, then build() returns the meshes.
class Sculpt {
  constructor(key, cell) {
    this.key = key;
    this.cell = cell || 0.04;
    this.groups = []; // { set, mat, parts: [] }
    this.cuts = [];
  }
  group(mat, set) {
    let g = this.groups.find((q) => q.mat === mat && q.set === set);
    if (!g) this.groups.push((g = { mat, set, parts: [], opts: { uv: 0.4 } })); // every part gets UVs (finishes like camo add a map)
    return g;
  }
  // Add a solid part in material mat (blend k with the others of that material). set groups moving parts.
  add(mat, part, k, set) {
    part.k = k == null ? 0.06 : k;
    this.group(mat, set || 'main').parts.push(part);
    return this;
  }
  // Carve a part out of every material (or only those listed), with a small fillet k.
  cut(part, k, mats) {
    part.k = k == null ? 0.015 : k;
    part.mats = mats;
    this.cuts.push(part);
    return this;
  }
  // Texture coordinates projected along each vertex's main axis, scaled for a material's detail map.
  uv(mat, scale) { this.groups.filter((g) => g.mat === mat).forEach((g) => (g.opts.uv = scale)); return this; }
  // Other per-material options: { decimate: false } keeps full density, { color: fn(x, y, z) } paints vertex colours.
  opt(mat, o) { this.groups.filter((g) => g.mat === mat).forEach((g) => Object.assign(g.opts, o)); return this; }
  // Builds (or reuses, per key) the geometry; returns { set: [meshes] } and adds every mesh to parent.
  build(parent) {
    const cached = Sculpt.cache[this.key];
    const sets = {};
    for (const g of this.groups) sets[g.set] = sets[g.set] || [];
    if (!cached && Sculpt.collect) { // warm-up pass: queue the meshing to run in slices later
      if (!Sculpt.jobs.some((j) => j.key === this.key)) Sculpt.jobs.push({ key: this.key, gens: this.groups.map((g) => this.gen(g)), geos: [] });
      return sets;
    }
    const geos = cached || this.groups.map((g) => Sculpt.run(this.gen(g)));
    if (!cached) { geos.forEach((geo) => (geo.userData.shared = true)); Sculpt.cache[this.key] = geos; }
    this.groups.forEach((g, i) => {
      const m = new THREE.Mesh(geos[i], g.mat);
      m.userData.sculpted = true;
      parent.add(m);
      sets[g.set].push(m);
    });
    return sets;
  }
  gen(g) {
    const opts = this.maxEdge ? Object.assign({ maxEdge: this.maxEdge }, g.opts) : g.opts;
    return Sculpt.meshGen(g.parts, this.cuts.filter((c) => !c.mats || c.mats.includes(g.mat)), this.cell, opts);
  }
  // Drive a mesher to completion right now.
  static run(it) {
    for (;;) { const r = it.next(); if (r.done) return r.value; }
  }
  // Work through queued meshing for up to budget ms; returns true while there is more to do.
  static runJobs(budget) {
    const t0 = performance.now();
    while (Sculpt.jobs.length && performance.now() - t0 < budget) {
      const job = Sculpt.jobs[0];
      if (Sculpt.cache[job.key]) { Sculpt.jobs.shift(); continue; } // already built on demand
      const i = job.geos.length, r = job.gens[i].next();
      if (!r.done) continue;
      job.geos.push(r.value);
      if (job.geos.length === job.gens.length) {
        job.geos.forEach((geo) => (geo.userData.shared = true));
        Sculpt.cache[job.key] = job.geos;
        Sculpt.jobs.shift();
      }
    }
    return Sculpt.jobs.length > 0;
  }

  // Surface nets over a sparse grid: blocks far from every part are skipped, and each block only evaluates
  // the parts (and cuts) that can reach it, so big models stay quick to mesh.
  static *meshGen(parts, cuts, cell, opts) {
    const uvScale = opts && opts.uv, colorFn = opts && opts.color;
    const S = LP.smin, B = 4, reach = cell * (B * 0.87 + 1.5), reach2 = cell * (2 * 0.87 + 1.2);
    const box = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const p of parts) for (let i = 0; i < 3; i++) {
      box[i] = Math.min(box[i], p.box[i] - p.k - 2 * cell); box[i + 3] = Math.max(box[i + 3], p.box[i + 3] + p.k + 2 * cell);
    }
    const [x0, y0, z0] = box;
    const nx = Math.ceil((box[3] - x0) / cell), ny = Math.ceil((box[4] - y0) / cell), nz = Math.ceil((box[5] - z0) / cell);
    const NX = nx + 1, NY = ny + 1, val = new Float32Array(NX * NY * (nz + 1)).fill(NaN); // NaN = not sampled yet
    const gid = (i, j, k) => i + NX * (j + NY * k);
    const bnx = Math.ceil(nx / B), bny = Math.ceil(ny / B), bnz = Math.ceil(nz / B), lists = new Array(bnx * bny * bnz), farB = new Uint8Array(bnx * bny * bnz);
    const field = (L, x, y, z) => {
      let d = 1e9;
      for (const p of L.p) d = S(d, p.d(x, y, z), p.k);
      for (const c of L.c) d = -S(-d, c.d(x, y, z), c.k); // smooth subtract
      return d;
    };
    const near = (b, x1, y1, z1, x2, y2, z2, m) => b[0] - m < x2 && b[3] + m > x1 && b[1] - m < y2 && b[4] + m > y1 && b[2] - m < z2 && b[5] + m > z1;
    for (let bk = 0; bk * B < nz; bk++) for (let bj = 0; bj * B < ny; bj++, yield) for (let bi = 0; bi * B < nx; bi++) {
      const i0 = bi * B, j0 = bj * B, k0 = bk * B, i1 = Math.min(i0 + B, nx), j1 = Math.min(j0 + B, ny), k1 = Math.min(k0 + B, nz);
      const ax = x0 + i0 * cell, ay = y0 + j0 * cell, az = z0 + k0 * cell, bx = x0 + i1 * cell, by = y0 + j1 * cell, bz = z0 + k1 * cell;
      const L = { p: parts.filter((p) => near(p.box, ax, ay, az, bx, by, bz, p.k + reach)), c: [] };
      if (L.p.length) L.c = cuts.filter((c) => near(c.box, ax, ay, az, bx, by, bz, c.k + reach));
      lists[bi + bnx * (bj + bny * bk)] = L;
      const d = L.p.length ? field(L, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2) : 1e9, far = Math.abs(d) > reach;
      farB[bi + bnx * (bj + bny * bk)] = far ? 1 : 0;
      if (far) {
        for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const q = gid(i, j, k); if (val[q] !== val[q]) val[q] = d; }
        continue;
      }
      // Near the surface: 2-cell sub-blocks that are still clear of it take one sample each.
      for (let sk = k0; sk < k1; sk += 2) for (let sj = j0; sj < j1; sj += 2) for (let si = i0; si < i1; si += 2) {
        const ti = Math.min(si + 2, i1), tj = Math.min(sj + 2, j1), tk = Math.min(sk + 2, k1);
        const sd = field(L, x0 + (si + ti) * 0.5 * cell, y0 + (sj + tj) * 0.5 * cell, z0 + (sk + tk) * 0.5 * cell), sfar = Math.abs(sd) > reach2;
        for (let k = sk; k <= tk; k++) for (let j = sj; j <= tj; j++) for (let i = si; i <= ti; i++) {
          const q = gid(i, j, k);
          if (val[q] !== val[q]) val[q] = sfar ? sd : field(L, x0 + i * cell, y0 + j * cell, z0 + k * cell);
        }
      }
    }
    // One vertex per cell the surface passes through, at the mean of its edge crossings.
    const vid = new Int32Array(nx * ny * nz).fill(-1), cid = (i, j, k) => i + nx * (j + ny * k);
    const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const pos = [], vl = [], cells = [], cv = new Float32Array(8);
    for (let bk = 0; bk < bnz; bk++, yield) for (let bj = 0; bj < bny; bj++) for (let bi = 0; bi < bnx; bi++) {
      if (farB[bi + bnx * (bj + bny * bk)]) continue; // a block well clear of the surface has no crossings
      for (let k = bk * B; k < Math.min(nz, bk * B + B); k++) for (let j = bj * B; j < Math.min(ny, bj * B + B); j++) for (let i = bi * B; i < Math.min(nx, bi * B + B); i++) {
      let inside = 0;
      for (let c = 0; c < 8; c++) { cv[c] = val[gid(i + C[c][0], j + C[c][1], k + C[c][2])]; if (cv[c] < 0) inside++; }
      if (inside === 0 || inside === 8) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of E) {
        if ((cv[a] < 0) === (cv[b] < 0)) continue;
        const t = cv[a] / (cv[a] - cv[b]);
        sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
      }
      vid[cid(i, j, k)] = pos.length / 3;
      pos.push(x0 + (i + sx / n) * cell, y0 + (j + sy / n) * cell, z0 + (k + sz / n) * cell);
      vl.push(lists[bi + bnx * (bj + bny * bk)]);
      cells.push(i, j, k);
      }
    }
    const idx = [];
    const quad = (a, b, c, d) => { if (a >= 0 && b >= 0 && c >= 0 && d >= 0) idx.push(a, b, c, a, c, d); };
    for (let c = 0; c < cells.length; c += 3) { // every crossing edge belongs to a cell that has a vertex
      if ((c & 16383) === 0) yield;
      const i = cells[c], j = cells[c + 1], k = cells[c + 2], v0 = val[gid(i, j, k)] < 0;
      if (j > 0 && k > 0 && (val[gid(i + 1, j, k)] < 0) !== v0) quad(vid[cid(i, j - 1, k - 1)], vid[cid(i, j, k - 1)], vid[cid(i, j, k)], vid[cid(i, j - 1, k)]);
      if (i > 0 && k > 0 && (val[gid(i, j + 1, k)] < 0) !== v0) quad(vid[cid(i - 1, j, k - 1)], vid[cid(i - 1, j, k)], vid[cid(i, j, k)], vid[cid(i, j, k - 1)]);
      if (i > 0 && j > 0 && (val[gid(i, j, k + 1)] < 0) !== v0) quad(vid[cid(i - 1, j - 1, k)], vid[cid(i, j - 1, k)], vid[cid(i, j, k)], vid[cid(i - 1, j, k)]);
    }
    // Snap vertices onto the surface; normals from the field so shading is smooth everywhere.
    const e = cell * 0.4;
    const snap = (p, n, L, out, o) => { // move p onto the surface, write position and normal at out[o]
      const f = (x, y, z) => field(L, x, y, z);
      let x = p[o], y = p[o + 1], z = p[o + 2];
      const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), dd = f(x + e, y + e, z + e);
      let gx = a - b - c + dd, gy = -a - b + c + dd, gz = -a + b - c + dd;
      const l = Math.hypot(gx, gy, gz) || 1, d = (a + b + c + dd) * 0.25; // the mean of the four is the value at the centre
      gx /= l; gy /= l; gz /= l;
      if (Math.abs(d) < cell * 1.5) { x -= gx * d; y -= gy * d; z -= gz * d; }
      out[o] = x; out[o + 1] = y; out[o + 2] = z;
      n[o] = gx; n[o + 1] = gy; n[o + 2] = gz;
    };
    const P = new Float32Array(pos), N = new Float32Array(pos.length);
    for (let v = 0, n = 0; v < P.length; v += 3, n++) { snap(P, N, vl[n], P, v); if ((n & 1023) === 1023) yield; }
    // Wind every triangle to face outward.
    for (let t = 0; t < idx.length; t += 3) {
      if (t % 30000 === 0) yield;
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
      const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
      if (fx * (N[a] + N[b] + N[c]) + fy * (N[a + 1] + N[b + 1] + N[c + 1]) + fz * (N[a + 2] + N[b + 2] + N[c + 2]) < 0) {
        const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s;
      }
    }
    // Simplify: flat and gently curved areas don't need the grid's density. Survivors are snapped back onto the
    // surface and re-shaded from the field, so the silhouette and shading stay true.
    const D = opts && opts.decimate === false ? Sculpt.identity(P, idx) : yield* Sculpt.decimate(P, idx, cell, opts && opts.maxEdge);
    const nv = D.keep.length, pos2 = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = uvScale ? new Float32Array(nv * 2) : null;
    const col = colorFn ? new Float32Array(nv * 3) : null;
    for (let n = 0; n < nv; n++) {
      if ((n & 1023) === 1023) yield;
      snap(D.pos, nrm, vl[D.keep[n]], pos2, n * 3);
      if (col) { const c = colorFn(pos2[n * 3], pos2[n * 3 + 1], pos2[n * 3 + 2]); col[n * 3] = c.r; col[n * 3 + 1] = c.g; col[n * 3 + 2] = c.b; }
      if (uv) {
        const ax = Math.abs(nrm[n * 3]), ay = Math.abs(nrm[n * 3 + 1]), az = Math.abs(nrm[n * 3 + 2]);
        const x = pos2[n * 3], y = pos2[n * 3 + 1], z = pos2[n * 3 + 2];
        // Flip u by the way the face points, so text and patterns read the right way round on both sides.
        const nx = nrm[n * 3], ny = nrm[n * 3 + 1], nz = nrm[n * 3 + 2];
        const [u, w] = ax >= ay && ax >= az ? [nx > 0 ? -z : z, y] : ay >= az ? [ny > 0 ? x : -x, ny > 0 ? -z : z] : [nz > 0 ? x : -x, y];
        uv[n * 2] = u * uvScale; uv[n * 2 + 1] = w * uvScale;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(D.idx, 1) : new THREE.Uint16BufferAttribute(D.idx, 1));
    geo.computeBoundingSphere();
    return geo;
  }

  // Quadric edge-collapse simplification of a closed indexed mesh. Collapses the cheapest edges (least change to
  // the surface) until the error would pass a small fraction of a cell, refusing collapses that fold a triangle
  // over or pinch the surface. Returns compacted { pos (indexed by new vertex), idx, keep: new -> old vertex }.
  // No simplification: keep every vertex (models whose detail is painted into vertex colours).
  static identity(P, idx) {
    const keep = new Int32Array(P.length / 3);
    for (let i = 0; i < keep.length; i++) keep[i] = i;
    return { pos: P, idx: Array.from(idx), keep };
  }

  static *decimate(P, idx, cell, maxEdge) {
    const maxE2 = maxEdge ? maxEdge * maxEdge : Infinity; // keep panels meshed this finely (so they can be dented)
    const nV = P.length / 3, nF = idx.length / 3, F = Int32Array.from(idx), alive = new Uint8Array(nF).fill(1);
    const Q = new Float64Array(nV * 10), ver = new Int32Array(nV), dead = new Uint8Array(nV);
    // Vertex -> faces, as growable lists.
    const vf = new Array(nV);
    for (let v = 0; v < nV; v++) vf[v] = [];
    for (let f = 0; f < nF; f++) {
      if ((f & 8191) === 8191) yield;
      const i0 = F[f * 3], i1 = F[f * 3 + 1], i2 = F[f * 3 + 2];
      vf[i0].push(f); vf[i1].push(f); vf[i2].push(f);
      const a = i0 * 3, b = i1 * 3, c = i2 * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (!l) continue;
      nx /= l; ny /= l; nz /= l;
      const d = -(nx * P[a] + ny * P[a + 1] + nz * P[a + 2]), w = 1; // each face's plane counts once
      for (const v of [i0, i1, i2]) {
        const o = v * 10;
        Q[o] += nx * nx * w; Q[o + 1] += nx * ny * w; Q[o + 2] += nx * nz * w; Q[o + 3] += nx * d * w; Q[o + 4] += ny * ny * w;
        Q[o + 5] += ny * nz * w; Q[o + 6] += ny * d * w; Q[o + 7] += nz * nz * w; Q[o + 8] += nz * d * w; Q[o + 9] += d * d * w;
      }
    }
    const err = (a, b, x, y, z) => {
      const A = a * 10, B = b * 10;
      return (Q[A] + Q[B]) * x * x + 2 * (Q[A + 1] + Q[B + 1]) * x * y + 2 * (Q[A + 2] + Q[B + 2]) * x * z + 2 * (Q[A + 3] + Q[B + 3]) * x
        + (Q[A + 4] + Q[B + 4]) * y * y + 2 * (Q[A + 5] + Q[B + 5]) * y * z + 2 * (Q[A + 6] + Q[B + 6]) * y
        + (Q[A + 7] + Q[B + 7]) * z * z + 2 * (Q[A + 8] + Q[B + 8]) * z + (Q[A + 9] + Q[B + 9]);
    };
    const lenK = 1e-4; // tiny next to the surface error, but orders zero-error collapses by length
    // Candidate pool (typed columns) and a binary min-heap of pool slots.
    let cap = nF * 4, used = 0, hn = 0;
    let cC = new Float64Array(cap), cA = new Int32Array(cap), cB = new Int32Array(cap), cX = new Float32Array(cap * 3), cS = new Int32Array(cap * 2), heap = new Int32Array(cap);
    const grow = () => {
      cap *= 2;
      const g = (o, T, k) => { const n = new T(cap * k); n.set(o); return n; };
      cC = g(cC, Float64Array, 1); cA = g(cA, Int32Array, 1); cB = g(cB, Int32Array, 1); cX = g(cX, Float32Array, 3); cS = g(cS, Int32Array, 2); heap = g(heap, Int32Array, 1);
    };
    const push = (a, b) => { // best of the two ends and the midpoint
      if (used >= cap) grow();
      const A = a * 3, B = b * 3;
      // The midpoint wins ties (flat panels), so collapses don't pile into one hub vertex.
      let bx = (P[A] + P[B]) / 2, by = (P[A + 1] + P[B + 1]) / 2, bz = (P[A + 2] + P[B + 2]) / 2, bc = err(a, b, bx, by, bz);
      let c = err(a, b, P[A], P[A + 1], P[A + 2]);
      if (c < bc - 1e-12) { bc = c; bx = P[A]; by = P[A + 1]; bz = P[A + 2]; }
      c = err(a, b, P[B], P[B + 1], P[B + 2]);
      if (c < bc - 1e-12) { bc = c; bx = P[B]; by = P[B + 1]; bz = P[B + 2]; }
      const ex = P[A] - P[B], ey = P[A + 1] - P[B + 1], ez = P[A + 2] - P[B + 2];
      bc = Math.max(0, bc) + lenK * (ex * ex + ey * ey + ez * ez); // short edges first: even triangles
      const s = used++;
      cC[s] = bc; cA[s] = a; cB[s] = b; cX[s * 3] = bx; cX[s * 3 + 1] = by; cX[s * 3 + 2] = bz; cS[s * 2] = ver[a]; cS[s * 2 + 1] = ver[b];
      let i = hn++;
      heap[i] = s;
      while (i > 0) { const p = (i - 1) >> 1; if (cC[heap[p]] <= cC[heap[i]]) break; const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; }
    };
    const pop = () => {
      const top = heap[0];
      heap[0] = heap[--hn];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < hn && cC[heap[l]] < cC[heap[m]]) m = l;
        if (r < hn && cC[heap[r]] < cC[heap[m]]) m = r;
        if (m === i) break;
        const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
      }
      return top;
    };
    // Each edge of a consistently wound closed mesh runs a->b in one face and b->a in the other: take it once.
    for (let f = 0; f < nF; f++) {
      if ((f & 8191) === 8191) yield;
      for (let k = 0; k < 3; k++) { const a = F[f * 3 + k], b = F[f * 3 + ((k + 1) % 3)]; if (a < b) push(a, b); }
    }
    const maxErr = (cell * 0.15) ** 2, target = Math.max(200, Math.round(nF * 0.06));
    const mark = new Int32Array(nV), mark2 = new Int32Array(nV);
    let stamp = 0;
    const markN = (v, M, s) => { for (const f of vf[v]) if (alive[f]) for (let k = 0; k < 3; k++) M[F[f * 3 + k]] = s; };
    let faces = nF;
    let iter = 0;
    while (hn && faces > target) {
      if ((++iter & 2047) === 0) yield;
      const sl = pop();
      if (cC[sl] > maxErr) break;
      const a = cA[sl], b = cB[sl];
      if (dead[a] || dead[b] || ver[a] !== cS[sl * 2] || ver[b] !== cS[sl * 2 + 1]) continue;
      const x = cX[sl * 3], y = cX[sl * 3 + 1], z = cX[sl * 3 + 2];
      // Link condition: a and b share exactly the two vertices across their edge (keeps the mesh manifold).
      stamp++;
      markN(a, mark, stamp); markN(b, mark2, stamp);
      let common = 0;
      for (const f of vf[a]) if (alive[f]) for (let k = 0; k < 3; k++) { const v = F[f * 3 + k]; if (v !== a && v !== b && mark2[v] === stamp && mark[v] === stamp) { mark[v] = -stamp; common++; } }
      if (common !== 2) continue;
      let val = 0;
      for (const f of vf[a]) if (alive[f]) val++;
      for (const f of vf[b]) if (alive[f]) val++;
      if (val > 24) continue; // no hub vertices with huge fans
      if (maxE2 < Infinity) {
        let long = false;
        for (const v of [a, b]) for (const f of vf[v]) {
          if (!alive[f]) continue;
          for (let k = 0; k < 3; k++) {
            const c = F[f * 3 + k];
            if (c === a || c === b) continue;
            const ex = P[c * 3] - x, ey = P[c * 3 + 1] - y, ez = P[c * 3 + 2] - z;
            if (ex * ex + ey * ey + ez * ez > maxE2) long = true;
          }
        }
        if (long) continue;
      }
      // Refuse if any surviving triangle would fold over.
      let ok = true;
      for (let pass = 0; pass < 2 && ok; pass++) {
        const v = pass ? b : a;
        for (const f of vf[v]) {
          if (!alive[f]) continue;
          const o = f * 3, i0 = F[o], i1 = F[o + 1], i2 = F[o + 2];
          if ((i0 === a || i1 === a || i2 === a) && (i0 === b || i1 === b || i2 === b)) continue;
          const p0 = i0 * 3, p1 = i1 * 3, p2 = i2 * 3;
          const ax = P[p0], ay = P[p0 + 1], az = P[p0 + 2], bx = P[p1], by = P[p1 + 1], bz = P[p1 + 2], cx = P[p2], cy = P[p2 + 1], cz = P[p2 + 2];
          const n0x = (by - ay) * (cz - az) - (bz - az) * (cy - ay), n0y = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), n0z = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
          const qx = i0 === v ? x : ax, qy = i0 === v ? y : ay, qz = i0 === v ? z : az;
          const rx = i1 === v ? x : bx, ry = i1 === v ? y : by, rz = i1 === v ? z : bz;
          const sx = i2 === v ? x : cx, sy = i2 === v ? y : cy, sz = i2 === v ? z : cz;
          const n1x = (ry - qy) * (sz - qz) - (rz - qz) * (sy - qy), n1y = (rz - qz) * (sx - qx) - (rx - qx) * (sz - qz), n1z = (rx - qx) * (sy - qy) - (ry - qy) * (sx - qx);
          const l0 = Math.sqrt(n0x * n0x + n0y * n0y + n0z * n0z), l1 = Math.sqrt(n1x * n1x + n1y * n1y + n1z * n1z);
          if (l1 < 1e-9 || (n0x * n1x + n0y * n1y + n0z * n1z) < 0.3 * l0 * l1) { ok = false; break; }
        }
      }
      if (!ok) continue;
      // Collapse b into a.
      P[a * 3] = x; P[a * 3 + 1] = y; P[a * 3 + 2] = z;
      for (let i = 0; i < 10; i++) Q[a * 10 + i] += Q[b * 10 + i];
      for (const f of vf[b]) {
        if (!alive[f]) continue;
        const o = f * 3;
        if (F[o] === a || F[o + 1] === a || F[o + 2] === a) { alive[f] = 0; faces--; continue; }
        if (F[o] === b) F[o] = a; else if (F[o + 1] === b) F[o + 1] = a; else F[o + 2] = a;
        vf[a].push(f);
      }
      vf[a] = vf[a].filter((f) => alive[f]);
      dead[b] = 1; ver[a]++;
      stamp++;
      for (const f of vf[a]) for (let k = 0; k < 3; k++) {
        const c = F[f * 3 + k];
        if (c !== a && mark[c] !== stamp) { mark[c] = stamp; push(Math.min(a, c), Math.max(a, c)); }
      }
    }
    // Compact.
    const remap = new Int32Array(nV).fill(-1), keep = [], out = [];
    for (let f = 0; f < nF; f++) {
      if (!alive[f]) continue;
      for (let k = 0; k < 3; k++) {
        const v = F[f * 3 + k];
        if (remap[v] < 0) { remap[v] = keep.length; keep.push(v); }
        out.push(remap[v]);
      }
    }
    const pos = new Float32Array(keep.length * 3);
    keep.forEach((v, i) => { pos[i * 3] = P[v * 3]; pos[i * 3 + 1] = P[v * 3 + 1]; pos[i * 3 + 2] = P[v * 3 + 2]; });
    return { pos, idx: out, keep };
  }
}
Sculpt.cache = {};
Sculpt.jobs = [];
Sculpt.collect = false;
