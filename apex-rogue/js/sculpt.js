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
    const f = SDF.frame(pos, rot), hw = width / 2;
    const us = points.map((p) => p[0]), vs = points.map((p) => p[1]);
    return {
      d: (x, y, z) => { const p = f.local(x, y, z); return SDF.slab(SDF.poly2(points, -p[2], p[1]), p[0], hw, r); },
      box: SDF.boxOf([-hw, Math.min(...vs), -Math.max(...us), hw, Math.max(...vs), -Math.min(...us)], f.m),
    };
  },
  // A car-style profile extruded sideways: points [[x, y], ...] in the X-Y plane, width along Z.
  sideX(points, width, r, pos, rot) {
    const f = SDF.frame(pos, rot), hw = width / 2;
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    return {
      d: (x, y, z) => { const p = f.local(x, y, z); return SDF.slab(SDF.poly2(points, p[0], p[1]), p[2], hw, r); },
      box: SDF.boxOf([Math.min(...xs), Math.min(...ys), -hw, Math.max(...xs), Math.max(...ys), hw], f.m),
    };
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
  // Repeat a cut along a line (vent holes, grooves): count copies, step [dx, dy, dz].
  repeat(make, count, step) {
    const parts = [];
    for (let i = 0; i < count; i++) parts.push(make(i, [step[0] * i, step[1] * i, step[2] * i]));
    return SDF.union(parts);
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
  // Builds (or reuses, per key) the geometry; returns { set: [meshes] } and adds every mesh to parent.
  build(parent) {
    const cached = Sculpt.cache[this.key];
    const geos = cached || this.groups.map((g) => Sculpt.mesh(g.parts, this.cuts.filter((c) => !c.mats || c.mats.includes(g.mat)), this.cell, g.opts.uv));
    if (!cached) { geos.forEach((geo) => (geo.userData.shared = true)); Sculpt.cache[this.key] = geos; }
    const sets = {};
    this.groups.forEach((g, i) => {
      const m = new THREE.Mesh(geos[i], g.mat);
      parent.add(m);
      (sets[g.set] = sets[g.set] || []).push(m);
    });
    return sets;
  }

  // Surface nets over a sparse grid: blocks far from every part are skipped, and each block only evaluates
  // the parts (and cuts) that can reach it, so big models stay quick to mesh.
  static mesh(parts, cuts, cell, uvScale) {
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
    for (let bk = 0; bk * B < nz; bk++) for (let bj = 0; bj * B < ny; bj++) for (let bi = 0; bi * B < nx; bi++) {
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
    for (let bk = 0; bk < bnz; bk++) for (let bj = 0; bj < bny; bj++) for (let bi = 0; bi < bnx; bi++) {
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
      const i = cells[c], j = cells[c + 1], k = cells[c + 2], v0 = val[gid(i, j, k)] < 0;
      if (j > 0 && k > 0 && (val[gid(i + 1, j, k)] < 0) !== v0) quad(vid[cid(i, j - 1, k - 1)], vid[cid(i, j, k - 1)], vid[cid(i, j, k)], vid[cid(i, j - 1, k)]);
      if (i > 0 && k > 0 && (val[gid(i, j + 1, k)] < 0) !== v0) quad(vid[cid(i - 1, j, k - 1)], vid[cid(i - 1, j, k)], vid[cid(i, j, k)], vid[cid(i, j, k - 1)]);
      if (i > 0 && j > 0 && (val[gid(i, j, k + 1)] < 0) !== v0) quad(vid[cid(i - 1, j - 1, k)], vid[cid(i, j - 1, k)], vid[cid(i, j, k)], vid[cid(i - 1, j, k)]);
    }
    // Snap vertices onto the surface; normals from the field so shading is smooth everywhere.
    const e = cell * 0.4, nrm = new Float32Array(pos.length), uv = uvScale ? new Float32Array((pos.length / 3) * 2) : null;
    for (let v = 0, n = 0; v < pos.length; v += 3, n++) {
      const L = vl[n], f = (x, y, z) => field(L, x, y, z);
      let x = pos[v], y = pos[v + 1], z = pos[v + 2];
      const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), dd = f(x + e, y + e, z + e);
      let gx = a - b - c + dd, gy = -a - b + c + dd, gz = -a + b - c + dd;
      const l = Math.hypot(gx, gy, gz) || 1, d = (a + b + c + dd) * 0.25; // the mean of the four is the value at the centre
      gx /= l; gy /= l; gz /= l;
      if (Math.abs(d) < cell * 1.5) { x -= gx * d; y -= gy * d; z -= gz * d; }
      nrm[v] = gx; nrm[v + 1] = gy; nrm[v + 2] = gz;
      pos[v] = x; pos[v + 1] = y; pos[v + 2] = z;
      if (uv) {
        const ax = Math.abs(nrm[v]), ay = Math.abs(nrm[v + 1]), az = Math.abs(nrm[v + 2]);
        const [u, w] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y];
        uv[n * 2] = u * uvScale; uv[n * 2 + 1] = w * uvScale;
      }
    }
    // Wind every triangle to face outward.
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const wx = pos[c] - pos[a], wy = pos[c + 1] - pos[a + 1], wz = pos[c + 2] - pos[a + 2];
      const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
      if (fx * (nrm[a] + nrm[b] + nrm[c]) + fy * (nrm[a + 1] + nrm[b + 1] + nrm[c + 1]) + fz * (nrm[a + 2] + nrm[b + 2] + nrm[c + 2]) < 0) {
        const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  }
}
Sculpt.cache = {};
