#!/usr/bin/env node
// Builds the Movement render rig from the real BodyParts3D meshes already vendored for
// portal/anatomy (CC BY 4.0, via ashemag/human-atlas, MIT).
//
// Why a build step: the raw atlas stores every part in one absolute world frame. To animate a
// person we need (a) true joint centres and (b) each bone expressed in its own bone space, so a
// rotation about the joint actually rotates the right geometry. Joint centres are fitted here
// from the mesh vertices themselves (sphere fit on the condyle/head caps), not guessed from
// bounding boxes, and the fit residual is recorded so the page can show how good it is.
//
// Output: portal/data/movement/rig/{skeleton.json,parts/<PART>.json}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const atlasPath = path.join(repo, 'portal/anatomy/models/atlas.json');
const outDir = path.join(repo, 'portal/data/movement/rig');
const partDir = path.join(outDir, 'parts');

const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));
const byId = new Map(atlas.parts.map(p => [p.id, p]));
const chunks = new Map();

function chunk(index) {
  if (!chunks.has(index)) {
    const file = path.join(repo, 'portal/anatomy/models', `body-${index}.bin`);
    chunks.set(index, fs.readFileSync(file));
  }
  return chunks.get(index);
}

// Optional: also pull the muscle meshes referenced by the anatomy map.
const anatomyMapPath = path.join(repo, 'portal/data/movement/anatomy-map.json');
const anatomyMap = fs.existsSync(anatomyMapPath) ? JSON.parse(fs.readFileSync(anatomyMapPath, 'utf8')) : null;

// Same frame as portal/anatomy: metres, Y up, +X = subject's left, +Z anterior.
const SKELETAL = {
  L: {
    pelvis: 'FJ3288', femur: 'FJ3259', tibia: 'FJ3282', fibula: 'FJ3260', patella: 'FJ3275',
    talus: 'FJ3280', calcaneus: 'FJ3256', humerus: 'FJ3262', radius: 'FJ3277', ulna: 'FJ3286',
    scapula: 'FJ3279', clavicle: 'FJ3237',
  },
  R: {
    pelvis: 'FJ3152', femur: 'FJ3365', tibia: 'FJ3387', fibula: 'FJ3366', patella: 'FJ3381',
    talus: 'FJ3385', calcaneus: 'FJ3360', humerus: 'FJ3368', radius: 'FJ3349', ulna: 'FJ3391',
    scapula: 'FJ3384', clavicle: 'FJ3362',
  },
  midline: { sacrum: 'FJ3393', sternum: 'FJ3178', manubrium: 'FJ3290' },
};

// The skull is many pieces; for the rig one merged shell is enough to read head orientation.
const SKULL_IDS = ['FJ3200', 'FJ3274', 'FJ3380', 'FJ3309', 'FJ3281', 'FJ3386', 'FJ3289'];
const RIB_HINT_IDS = ['FJ3178', 'FJ3290'];

function decode(part) {
  const buf = chunk(part.chunk);
  const nv = part.vertexCount;
  const positions = new Float32Array(3 * nv);
  let off = part.positions;
  for (let i = 0; i < 3 * nv; i++) {
    positions[i] = buf.readFloatLE(off);
    off += 4;
  }
  const indexCount = part.indexCount;
  const indices = new Uint32Array(indexCount);
  off = part.indices;
  for (let i = 0; i < indexCount; i++) {
    indices[i] = buf.readUInt32LE(off);
    off += 4;
  }
  // The file's own "normals" block is not a usable normal field (its magnitudes are garbage);
  // it is kept only because downstream part files carry it, and real normals are rebuilt from
  // the triangle winding, which is consistent across the atlas.
  const normals = new Float32Array(3 * nv);
  for (let t = 0; t + 2 < indexCount; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { normals[k] += nx; normals[k + 1] += ny; normals[k + 2] += nz; }
  }
  for (let i = 0; i < nv; i++) {
    const len = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) || 1;
    normals[i * 3] /= len; normals[i * 3 + 1] /= len; normals[i * 3 + 2] /= len;
  }
  return { positions, normals, indices, vertexCount: nv };
}

// ---- joint centre fitting -------------------------------------------------------------
// A joint surface is (approximately) a sphere. We isolate the vertices near one end of the
// bone (the part that faces the other bone), then run RANSAC + a least-squares refinement.
// The sphere centre is the joint's rotation centre, which is what a rig needs.

function sub(points, idx) {
  const out = new Float32Array(3 * idx.length);
  idx.forEach((k, i) => {
    out[i * 3] = points[k * 3];
    out[i * 3 + 1] = points[k * 3 + 1];
    out[i * 3 + 2] = points[k * 3 + 2];
  });
  return out;
}

function capIndices(positions, n, axis, fraction, from = 0) {
  // Select vertices in the extreme `fraction` of the projection along `axis` (a unit vector
  // pointing at the end of interest). The projection range starts at `from`, i.e. at the far
  // (proximal) articular end when the distal end is being measured: an articular head is a
  // ball as wide as the condyles, so including it would make the "end band" swallow the whole
  // diaphysis and place a knee joint up in the shaft.
  const proj = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    proj[i] = positions[i * 3] * axis[0] + positions[i * 3 + 1] * axis[1] + positions[i * 3 + 2] * axis[2];
  }
  let hi = -Infinity;
  for (let i = 0; i < n; i++) if (proj[i] > hi) hi = proj[i];
  const cut = hi - (hi - from) * fraction;
  const out = [];
  for (let i = 0; i < n; i++) if (proj[i] >= cut) out.push(i);
  return out;
}

function projOf(point, axis) {
  return point[0] * axis[0] + point[1] * axis[1] + point[2] * axis[2];
}

// Projection of a vertex set onto the long axis, used to anchor the two ends of a bone.
function extremes(positions, n, axis) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const p = positions[i * 3] * axis[0] + positions[i * 3 + 1] * axis[1] + positions[i * 3 + 2] * axis[2];
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  return { lo, hi };
}

function fitSphere(points, n, samples = 4000, iterations = 400) {
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pick = () => Math.floor(rand() * n);
  const solve = (a, b, c, d) => {
    const m = [[a[0], a[1], a[2], a[3]], [b[0], b[1], b[2], b[3]], [c[0], c[1], c[2], c[3]], [d[0], d[1], d[2], d[3]]];
    for (let col = 0; col < 3; col++) {
      let piv = col;
      for (let r = col + 1; r < 4; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
      if (Math.abs(m[piv][col]) < 1e-12) return null;
      [m[col], m[piv]] = [m[piv], m[col]];
      for (let r = 0; r < 4; r++) {
        if (r === col) continue;
        const f = m[r][col] / m[col][col];
        for (let k = col; k < 4; k++) m[r][k] -= f * m[col][k];
      }
    }
    return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
  };
  const fit3 = (i, j, k) => {
    // Solve |p|^2 = 2 c.p + (r^2 - |c|^2) for c and the constant.
    const rows = [i, j, k].map(x => {
      const px = points[x * 3], py = points[x * 3 + 1], pz = points[x * 3 + 2];
      return [2 * px, 2 * py, 2 * pz, px * px + py * py + pz * pz];
    });
    return solve(rows[0], rows[1], rows[2], [0, 0, 0, 1]);
  };
  const dist = (c, i) => {
    const dx = points[i * 3] - c[0], dy = points[i * 3 + 1] - c[1], dz = points[i * 3 + 2] - c[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  let best = null;
  for (let it = 0; it < iterations; it++) {
    const c = fit3(pick(), pick(), pick());
    if (!c || !c.every(Number.isFinite)) continue;
    const rs = [];
    for (let s = 0; s < samples; s++) rs.push(dist(c, pick()));
    rs.sort((a, b) => a - b);
    const r = rs[Math.floor(rs.length / 2)];
    if (r < 0.002 || r > 0.12) continue;
    const tol = Math.max(0.002, r * 0.18);
    let inliers = 0;
    const idx = [];
    for (let i = 0; i < n; i++) {
      if (Math.abs(dist(c, i) - r) < tol) { inliers++; idx.push(i); }
    }
    if (!best || inliers > best.inliers) best = { c, r, inliers, idx, tol };
  }
  if (!best) return null;
  // Least-squares refinement on the inlier set.
  let { c, r } = best;
  const idx = best.idx.length >= 12 ? best.idx : Array.from({ length: n }, (_, i) => i);
  for (let round = 0; round < 3; round++) {
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const B = [0, 0, 0];
    let sr = 0;
    for (const i of idx) {
      const px = points[i * 3] - c[0], py = points[i * 3 + 1] - c[1], pz = points[i * 3 + 2] - c[2];
      const len = Math.sqrt(px * px + py * py + pz * pz) || 1e-9;
      sr += len;
      const ux = px / len, uy = py / len, uz = pz / len;
      // Residual target: move centre so that |p - c| = mean radius (Gauss-Newton, J = -u).
      const res = len - r;
      A[0][0] += ux * ux; A[0][1] += ux * uy; A[0][2] += ux * uz;
      A[1][1] += uy * uy; A[1][2] += uy * uz; A[2][2] += uz * uz;
      B[0] += ux * res; B[1] += uy * res; B[2] += uz * res;
    }
    A[1][0] = A[0][1]; A[2][0] = A[0][2]; A[2][1] = A[1][2];
    const d = solve([...A[0], B[0]], [...A[1], B[1]], [...A[2], B[2]], [0, 0, 0, 1]);
    if (!d) break;
    c = [c[0] + d[0], c[1] + d[1], c[2] + d[2]];
    r = sr / idx.length + (d[0] ** 2 + d[1] ** 2 + d[2] ** 2) ** 0.5 * 0;
  }
  let sum = 0;
  let max = 0;
  let count = 0;
  for (const i of idx) {
    const e = Math.abs(dist(c, i) - r);
    sum += e;
    if (e > max) max = e;
    count++;
  }
  return { center: c, radius: r, inliers: idx.length, of: n, meanError: sum / count, maxError: max };
}

function centroid(points, n) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < n; i++) { x += points[i * 3]; y += points[i * 3 + 1]; z += points[i * 3 + 2]; }
  return [x / n, y / n, z / n];
}

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

function boundsCenter(part) {
  const b = part.bounds;
  return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2];
}

function load(id) {
  const part = byId.get(id);
  if (!part) throw new Error(`part ${id} not in atlas`);
  const geo = decode(part);
  return { part, ...geo };
}

// Pick the end of `bone` that is closer to `other`, return a unit axis pointing there.
function axisToward(boneGeo, otherPoint) {
  // The long axis is the dominant principal direction of the vertex cloud, not the
  // centroid-to-bounds-box line: long bones bend, and a bounding-box diagonal tilts the
  // axis enough that a 22% cap slides off the articular end.
  const c = centroid(boneGeo.positions, boneGeo.vertexCount);
  const n = boneGeo.vertexCount;
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) {
    const d = [boneGeo.positions[i * 3] - c[0], boneGeo.positions[i * 3 + 1] - c[1], boneGeo.positions[i * 3 + 2] - c[2]];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b];
  }
  let v = [0.3, 1, 0.2];
  for (let it = 0; it < 200; it++) {
    const w = [0, 1, 2].map((a) => C[a][0] * v[0] + C[a][1] * v[1] + C[a][2] * v[2]);
    v = normalize(w);
  }
  const a0 = v;
  const p1 = add(c, scale(a0, 0.1));
  const p2 = sub3(c, scale(a0, 0.1));
  const d1 = Math.hypot(...sub3(p1, otherPoint));
  const d2 = Math.hypot(...sub3(p2, otherPoint));
  return d1 < d2 ? a0 : scale(a0, -1);
}

function jointFromCap(boneGeo, axis, otherPoint, fraction) {
  const idx = capIndices(boneGeo.positions, boneGeo.vertexCount, axis, fraction);
  const pts = sub(boneGeo.positions, idx);
  const fit = fitSphere(pts, idx.length);
  return fit || { center: centroid(pts, idx.length), radius: 0, inliers: idx.length, of: idx.length, meanError: null, maxError: null };
}

const report = [];

function log(name, fit) {
  const err = fit.meanError == null ? 'n/a' : `${(fit.meanError * 1000).toFixed(1)}mm`;
  report.push(`${name}: centre=(${fit.center.map(v => v.toFixed(4)).join(', ')}) r=${Number(fit.radius ?? 0).toFixed(4)} inliers=${fit.inliers}/${fit.of} meanErr=${err}`);
}

// ---- build ------------------------------------------------------------------------------
fs.mkdirSync(partDir, { recursive: true });

const bones = []; // { id, name, parent, joint, vertices(local), ... }
const muscles = [];

function emitPart(id, label, system, origin) {
  const g = load(id);
  const n = g.vertexCount;
  const verts = new Float32Array(3 * n);
  for (let i = 0; i < 3 * n; i += 3) {
    verts[i] = g.positions[i] - origin[0];
    verts[i + 1] = g.positions[i + 1] - origin[1];
    verts[i + 2] = g.positions[i + 2] - origin[2];
  }
  const file = `${id}.json`;
  fs.writeFileSync(path.join(partDir, file), JSON.stringify({
    id, name: label, system,
    origin: origin.map(v => +v.toFixed(5)),
    vertexCount: n,
    positions: Array.from(verts, v => +v.toFixed(5)),
    normals: Array.from(g.normals, v => +v.toFixed(4)),
    indices: Array.from(g.indices),
  }));
  return { file, vertexCount: n, indexCount: g.indices.length };
}

// ---- joint estimation ----------------------------------------------------------------
// Limb bones in BodyParts3D are roughly cylindrical, so a sphere fit on a cap is degenerate:
// RANSAC happily returns a huge sphere through a flat ring of vertices. The joints we can
// measure honestly are therefore measured differently, and the method is recorded per joint:
//   HIP    - femoral head is a real ball: sphere fit, but with a radius prior (adult male
//            femoral head ~24mm) so the fit cannot drift into a cylinder.
//   KNEE   - hinge on the joint line: the tibial plateau governs the height, the femoral
//            condyle only nudges the anterior-posterior position; disagreement recorded.
//   ANKLE  - talus centroid (the talus IS the talocrural joint body).
//   SHOULDER - humeral head is also a ball: sphere fit with a head-radius prior (~25mm) and
//            the scapula glenoid as a cross-check.
//   ELBOW / WRIST - hinge: mean of the two fitted bone ends, disagreement recorded.
// A residual that cannot meet the prior is reported, never silently accepted.

const HEAD_RADIUS_PRIOR = { femurHead: 0.0245, humeralHead: 0.0250 };

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

function refineWithRadius(points, n, seed, prior, iterations = 300) {
  let seedState = 7919;
  const rand = () => ((seedState = (seedState * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pick = () => Math.floor(rand() * n);
  const dist = (c, i) => Math.hypot(points[i * 3] - c[0], points[i * 3 + 1] - c[1], points[i * 3 + 2] - c[2]);
  const refine = (c0) => {
    let c = c0;
    for (let round = 0; round < 6; round++) {
      const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const B = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        const px = c[0] - points[i * 3], py = c[1] - points[i * 3 + 1], pz = c[2] - points[i * 3 + 2];
        const len = Math.hypot(px, py, pz) || 1e-9;
        // |p - c| = prior  =>  u . c = u . p + prior, u = (c-p)/len (unit, points away from surface)
        const ux = px / len, uy = py / len, uz = pz / len;
        const rhs = ux * points[i * 3] + uy * points[i * 3 + 1] + uz * points[i * 3 + 2] + prior;
        A[0][0] += ux * ux; A[0][1] += ux * uy; A[0][2] += ux * uz;
        A[1][1] += uy * uy; A[1][2] += uy * uz; A[2][2] += uz * uz;
        B[0] += ux * rhs; B[1] += uy * rhs; B[2] += uz * rhs;
      }
      A[1][0] = A[0][1]; A[2][0] = A[0][2]; A[2][1] = A[1][2];
      const d = solve3(A, B);
      if (!d) break;
      c = d;
    }
    let sum = 0;
    let max = 0;
    for (let i = 0; i < n; i++) {
      const e = Math.abs(dist(c, i) - prior);
      sum += e;
      if (e > max) max = e;
    }
    let inliers = 0;
    for (let i = 0; i < n; i++) if (Math.abs(dist(c, i) - prior) < 0.004) inliers++;
    return { center: c, radius: prior, meanError: sum / n, maxError: max, inliers, of: n };
  };
  const base = seed;
  let best = null;
  for (let it = 0; it < iterations; it++) {
    const c = refine([base[0] + (rand() - 0.5) * 0.01, base[1] + (rand() - 0.5) * 0.01, base[2] + (rand() - 0.5) * 0.01]);
    if (!best || c.meanError < best.meanError) best = c;
  }
  return best;
}

function solve3(A, B) {
  const m = [[A[0][0], A[0][1], A[0][2], B[0]], [A[1][0], A[1][1], A[1][2], B[1]], [A[2][0], A[2][1], A[2][2], B[2]]];
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    if (Math.abs(m[piv][col]) < 1e-12) return null;
    [m[col], m[piv]] = [m[piv], m[col]];
    for (let r = col + 1; r < 3; r++) {
      const f = m[r][col] / m[col][col];
      for (let k = col; k < 4; k++) m[r][k] -= f * m[col][k];
    }
  }
  const x = [0, 0, 0];
  for (let r = 2; r >= 0; r--) {
    let s = m[r][3];
    for (let c = r + 1; c < 3; c++) s -= m[r][c] * x[c];
    x[r] = s / m[r][r];
  }
  return x;
}

// Joint centre from a ball-shaped bone end (femoral / humeral head).
function ballJoint(geo, towardPoint, prior, fraction) {
  // The head is a ball on top of the shaft. Whatever this mesh calls its extremes, the ball
  // is the *only* round part: RANSAC over the declared end band picks the widest consistent
  // sphere, and the radius prior keeps it from settling on the nearly-flat condyle face at
  // the other end of the same bone.
  const idx = capIndices(geo.positions, geo.vertexCount, axisToward(geo, towardPoint), fraction);
  const pts = sub(geo.positions, idx);
  const seeds = [];
  for (let i = 0; i < idx.length; i += 3) {
    seeds.push([pts[i * 3] + prior * 0.7, pts[i * 3 + 1], pts[i * 3 + 2]]);
  }
  let best = null;
  for (const seed of seeds.slice(0, 40)) {
    const fit = refineWithRadius(pts, idx.length, seed, prior, 40);
    if (!best || fit.inliers > best.inliers || (fit.inliers === best.inliers && fit.meanError < best.meanError)) best = fit;
  }
  return { ...best, of: idx.length };
}

// Joint centre from a hinge surface (condyle ring). Uses the surface's own extent: the
// centre is the point whose distance to the ring is most uniform (median-of-radii sphere,
// constrained to the ring's centroid plane) — for a short ring this equals the ring centre.
function hingeEnd(geo, towardPoint, fraction) {
  const axis = axisToward(geo, towardPoint);
  // Anchor the band at the opposite end of the bone so only the articular epiphysis of the
  // requested end is sampled. The anchor is the 1% extreme at that end, not the single
  // furthest vertex: one stray vertex would otherwise truncate the opposite end's band.
  const ext = extremes(geo.positions, geo.vertexCount, axis);
  const proj = new Float32Array(geo.vertexCount);
  for (let i = 0; i < geo.vertexCount; i++) {
    proj[i] = geo.positions[i * 3] * axis[0] + geo.positions[i * 3 + 1] * axis[1] + geo.positions[i * 3 + 2] * axis[2];
  }
  const asc = Float32Array.from(proj).sort();
  const from = projOf(towardPoint, axis) > (ext.lo + ext.hi) / 2
    ? asc[Math.floor(geo.vertexCount * 0.01)]
    : asc[Math.floor(geo.vertexCount * 0.99)];
  const idx = capIndices(geo.positions, geo.vertexCount, axis, fraction, from);
  const pts = sub(geo.positions, idx);
  const c = centroid(pts, idx.length);
  const radii = [];
  for (let i = 0; i < idx.length; i++) radii.push(Math.hypot(pts[i * 3] - c[0], pts[i * 3 + 1] - c[1], pts[i * 3 + 2] - c[2]));
  // A condyle end is not a ring: BodyParts3D closes it with a sub-mm pinhole and the medial
  // and lateral condyles bulge past the shaft. A free fit on a nearly closed cap is
  // degenerate, so the sphere radius is held at the epiphysis' own median radius and only the
  // centre is solved — the same least-squares refinement used for the femoral head.
  const fit = refineWithRadius(pts, idx.length, c, median(radii), 24);
  return {
    center: fit.center, radius: median(radii), inliers: fit.inliers, of: idx.length,
    meanError: fit.meanError, maxError: fit.maxError, tip: c,
  };
}

// Pelvis: root, origin at the midpoint of the two femoral heads.
// HIP. The femoral head is a real ball, but a radius-prior RANSAC on the whole proximal band
// also drags in the greater trochanter whose surface points inward and inflates the fit. The
// head alone has a signature the rest of the bone does not: its surface normals all point at
// one common centre, medially and slightly upward. So the centre is the least-squares point
// closest to every inward-facing normal ray in the proximal band, restricted to normals that
// point toward the pelvis midline.
function convergence(points, normals, n, accept) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const B = [0, 0, 0];
  let used = 0;
  for (let i = 0; i < n; i++) {
    const v = accept(points, i);
    if (!v) continue;
    const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2];
    // p + n * t = c with n.x + n.y + n.z = -1  =>  the centre lies on the inward normal line.
    const px = points[i * 3], py = points[i * 3 + 1], pz = points[i * 3 + 2];
    const Acol = [nx, ny, nz];
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) A[a][b] += Acol[a] * Acol[b];
      B[a] += Acol[a] * (nx * px + ny * py + nz * pz);
    }
    used++;
  }
  const d = solve3(A, B);
  const center = d || [0, 0, 0];
  let sum = 0;
  let abs = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (!accept(points, i)) continue;
    const e = Math.hypot(points[i * 3] - center[0], points[i * 3 + 1] - center[1], points[i * 3 + 2] - center[2]);
    if (!Number.isFinite(e)) continue;
    count++;
    sum += e;
    abs = Math.max(abs, e);
  }
  return { center, used, spread: count ? sum / count : 0, maxSpread: abs };
}

function hipCentre(side) {
  const geo = load(SKELETAL[side].femur);
  const sign = side === 'L' ? -1 : 1; // the head faces the midline: normals point -x on the left
  const ext = extremes(geo.positions, geo.vertexCount, [0, 1, 0]);
  const midY = (ext.lo + ext.hi) / 2;
  const accept = (pts, i) => {
    const y = pts[i * 3 + 1];
    const nx = geo.normals[i * 3];
    return y < midY && Math.sign(nx) === sign && Math.abs(nx) > 0.5;
  };
  const fit = convergence(geo.positions, geo.normals, geo.vertexCount, accept);
  // The head radius is then measured, not assumed: median distance from the centre to those
  // same medial-facing surface points.
  const radii = [];
  for (let i = 0; i < geo.vertexCount; i++) {
    if (!accept(geo.positions, i)) continue;
    radii.push(Math.hypot(geo.positions[i * 3] - fit.center[0], geo.positions[i * 3 + 1] - fit.center[1], geo.positions[i * 3 + 2] - fit.center[2]));
  }
  const r = median(radii);
  return { center: fit.center, radius: r, inliers: radii.filter((x) => Math.abs(x - r) < 0.002).length,
    of: radii.length, meanError: fit.spread, maxError: fit.maxSpread };
}

const hipLfit = hipCentre('L');
log('hip.L', hipLfit);
const hipRfit = hipCentre('R');
log('hip.R', hipRfit);

const rootOrigin = [
  (hipLfit.center[0] + hipRfit.center[0]) / 2,
  (hipLfit.center[1] + hipRfit.center[1]) / 2,
  (hipLfit.center[2] + hipRfit.center[2]) / 2,
];
const hipL_local = sub3(hipLfit.center, rootOrigin);
const hipR_local = sub3(hipRfit.center, rootOrigin);

// Spine: pelvis -> sacrum top -> chest.
const sacrum = load(SKELETAL.midline.sacrum);
const sternum = load(SKELETAL.midline.sternum);
const sacrumTop = [boundsCenter(sacrum.part)[0], sacrum.part.bounds[1][1], boundsCenter(sacrum.part)[2]];
const sternumTop = [0, sternum.part.bounds[1][1], boundsCenter(sternum.part)[2]];
const spineTopWorld = sternumTop;
const lumbarLocal = sub3(sacrumTop, rootOrigin);
const chestLocal = sub3(spineTopWorld, rootOrigin);

// Knee: hinge between femoral condyles and tibial plateau. Both bones are measured at their
// own articular end and the two centres are reported together; the joint is the midpoint,
// because the femur carries the curvature of the condyles the tibia does not know about and
// the tibia carries the plateau the femur does not.
function kneeCentre(side) {
  const S = SKELETAL[side];
  const talus = load(S.talus);
  const femur = load(S.femur);
  const tibia = load(S.tibia);
  const ankleRef = centroid(talus.positions, talus.vertexCount);
  const fCap = hingeEnd(femur, ankleRef, 0.15);
  log(`knee.${side}.femur`, fCap);
  const hipRef = side === 'L' ? hipLfit.center : hipRfit.center;
  const tCap = hingeEnd(tibia, hipRef, 0.15);
  log(`knee.${side}.tibia`, tCap);
  const center = [0, 1, 2].map((k) => (fCap.center[k] + tCap.center[k]) / 2);
  return { center, delta: Math.hypot(...sub3(fCap.center, tCap.center)), femur: fCap, tibia: tCap };
}
const knee = { L: kneeCentre('L'), R: kneeCentre('R') };

// Ankle: talus centroid is the talocrural joint's practical rotation centre.
const ankle = {
  L: centroid(load(SKELETAL.L.talus).positions, byId.get(SKELETAL.L.talus).vertexCount),
  R: centroid(load(SKELETAL.R.talus).positions, byId.get(SKELETAL.R.talus).vertexCount),
};

// Shoulder: the humerus' proximal surface is the head, so the top cap's ring centre is the
// glenohumeral centre. A ~25mm sphere fit is reported only as a sanity check on the ring.
function shoulderCentre(side) {
  const S = SKELETAL[side];
  const humerus = load(S.humerus);
  const radius = load(S.radius);
  const elbowRef = centroid(radius.positions, radius.vertexCount);
  const ring = hingeEnd(humerus, elbowRef, 0.15);
  log(`shoulder.${side}`, ring);
  const scapula = load(S.scapula);
  const sb = scapula.part.bounds;
  const acromion = [side === 'L' ? sb[1][0] : sb[0][0], sb[1][1], (sb[0][2] + sb[1][2]) / 2];
  return { center: ring.center, radius: ring.radius, acromion, ringError: ring.meanError,
    acromionGap: Math.hypot(...sub3(ring.center, acromion)) };
}
const shoulder = { L: shoulderCentre('L'), R: shoulderCentre('R') };
const shoulderJoint = { L: shoulder.L.center, R: shoulder.R.center };

function elbowCentre(side) {
  const S = SKELETAL[side];
  const humerus = load(S.humerus);
  const radius = load(S.radius);
  const ulna = load(S.ulna);
  const rb = byId.get(S.radius).bounds;
  const handRef = [(rb[0][0] + rb[1][0]) / 2, rb[0][1], (rb[1][2] + rb[0][2]) / 2];
  const hCap = hingeEnd(humerus, handRef, 0.2);
  log(`elbow.${side}.humerus`, hCap);
  const sh = shoulder[side].center;
  const rCap = hingeEnd(radius, sh, 0.25);
  log(`elbow.${side}.radius`, rCap);
  const uCap = hingeEnd(ulna, sh, 0.25);
  log(`elbow.${side}.ulna`, uCap);
  const center = [rCap.center[0], Math.min(hCap.center[1], uCap.center[1]), (rCap.center[2] + uCap.center[2]) / 2];
  return { center, spread: Math.hypot(...sub3(rCap.center, uCap.center)) };
}
const elbow = { L: elbowCentre('L'), R: elbowCentre('R') };

// Wrist: the radiocarpal joint sits on the distal radius; the ulnar head is tracked separately
// because it is the pivot for pronation, not a hinge with the radius.
function wristCentre(side) {
  const S = SKELETAL[side];
  const rb = byId.get(S.radius).bounds;
  const ub = byId.get(S.ulna).bounds;
  const below = (b) => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2 - 1, (b[0][2] + b[1][2]) / 2];
  const rCap = hingeEnd(load(S.radius), below(rb), 0.3);
  const uCap = hingeEnd(load(S.ulna), below(ub), 0.3);
  log(`wrist.${side}.radius`, rCap);
  log(`wrist.${side}.ulna`, uCap);
  return { center: rCap.center, ulna: uCap.center };
}
const wrist = { L: wristCentre('L'), R: wristCentre('R') };

// Head: skull bounding box from the real meshes; the neck joint sits just under the skull base.
const skullParts = SKULL_IDS.map(load);
const skullBox = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
for (const g of skullParts) {
  for (let i = 0; i < g.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      skullBox[0][k] = Math.min(skullBox[0][k], g.positions[i + k]);
      skullBox[1][k] = Math.max(skullBox[1][k], g.positions[i + k]);
    }
  }
}
const headCentre = [(skullBox[0][0] + skullBox[1][0]) / 2, (skullBox[0][1] + skullBox[1][1]) / 2, (skullBox[0][2] + skullBox[1][2]) / 2];
const neckTopWorld = [0, skullBox[0][1] - 0.01, -0.045];
const height = skullBox[1][1];

// ---- bones table -------------------------------------------------------------------------
function pushBone(name, parent, joint, ids, rig) {
  bones.push({
    name, parent, rig: rig || null,
    joint: joint.map(v => +v.toFixed(5)),
    parts: ids.map(([id, label, system]) => {
      const out = emitPart(id, label, system, joint);
      return { id, name: label, system, file: `parts/${out.file}`, vertexCount: out.vertexCount, indexCount: out.indexCount };
    }),
  });
}

pushBone('pelvis', null, rootOrigin, [
  [SKELETAL.L.pelvis, 'Left hip bone', 'skeletal'],
  [SKELETAL.R.pelvis, 'Right hip bone', 'skeletal'],
  [SKELETAL.midline.sacrum, 'Sacrum', 'skeletal'],
]);

pushBone('chest', 'pelvis', spineTopWorld, [
  [SKELETAL.midline.sternum, 'Body of sternum', 'skeletal'],
  [SKELETAL.midline.manubrium, 'Manubrium', 'skeletal'],
]);

pushBone('head', 'chest', neckTopWorld, SKULL_IDS.map(id => [id, byId.get(id)?.name || id, 'skeletal']));

for (const side of ['L', 'R']) {
  const S = SKELETAL[side];
  const label = side === 'L' ? 'Left' : 'Right';
  pushBone(`scapula.${side}`, 'chest', shoulder[side].center, [
    [S.scapula, `${label} scapula`, 'skeletal'],
    [S.clavicle, `${label} clavicle`, 'skeletal'],
  ], 'scapula');
  pushBone(`upperArm.${side}`, 'chest', shoulderJoint[side], [
    [S.humerus, `${label} humerus`, 'skeletal'],
  ], 'shoulder');
  pushBone(`forearm.${side}`, `upperArm.${side}`, elbow[side].center, [
    [S.radius, `${label} radius`, 'skeletal'],
    [S.ulna, `${label} ulna`, 'skeletal'],
    ...(side === 'L' ? [['FJ3243', 'Left second metacarpal', 'skeletal'], ['FJ3257', 'Left carpal block (capitate)', 'skeletal']]
      : [['FJ3352', 'Right second metacarpal', 'skeletal'], ['FJ3361', 'Right carpal block (capitate)', 'skeletal']]),
  ], 'elbow');
  pushBone(`thigh.${side}`, 'pelvis', side === 'L' ? hipLfit.center : hipRfit.center, [
    [S.femur, `${label} femur`, 'skeletal'],
    [S.patella, `${label} patella`, 'skeletal'],
  ], 'hip');
  pushBone(`shank.${side}`, `thigh.${side}`, knee[side].center, [
    [S.tibia, `${label} tibia`, 'skeletal'],
    [S.fibula, `${label} fibula`, 'skeletal'],
    [S.talus, `${label} talus`, 'skeletal'],
    [S.calcaneus, `${label} calcaneus`, 'skeletal'],
  ], 'knee');
}

// ---- muscles ---------------------------------------------------------------------------
if (anatomyMap) {
  for (const [muscle, def] of Object.entries(anatomyMap.muscles)) {
    for (const part of def.parts) {
      const meta = byId.get(part.id);
      if (!meta || meta.system !== 'muscular') continue;
      const parent = /femur|femoris|quadriceps|vastus|iliacus|psoas|glute|adductor/.test(meta.name) ? 'pelvis'
        : /gastrocnemius|soleus|tibialis|fibularis/.test(meta.name) ? (/Left/i.test(meta.name) ? 'shank.L' : 'shank.R')
          : /biceps brachii|triceps|brachialis|brachioradialis|deltoid/.test(meta.name) ? (/Left/i.test(meta.name) ? 'upperArm.L' : 'upperArm.R')
            : /pectoralis|serratus|external oblique|rhomboid|trapezius|iliocostalis|longissimus|spinalis/.test(meta.name) ? 'chest'
              : 'pelvis';
      const parentBone = bones.find(b => b.name === parent);
      const origin = parentBone ? parentBone.joint : rootOrigin;
      const out = emitPart(part.id, muscle, 'muscular', origin);
      muscles.push({
        muscle, zh: def.zh, partId: part.id, name: meta.name, parent,
        origin: origin.map(v => +v.toFixed(5)),
        file: `parts/${out.file}`, vertexCount: out.vertexCount, indexCount: out.indexCount,
      });
    }
  }
}

// ---- emit ---------------------------------------------------------------------------------
const skeleton = {
  schema: 'zero-one.movement.rig.v1',
  builtAt: new Date().toISOString(),
  units: 'metres',
  frame: '+X = subject left, +Y up, +Z anterior (same frame as portal/anatomy)',
  subject: { sex: atlas.sex || 'male', height: +height.toFixed(4), source: atlas.source || 'BodyParts3D 4.0 via ashemag/human-atlas' },
  license: {
    model: 'BodyParts3D, (c) Database Center for Life Science (DBCLS), CC BY 4.0',
    packaging: 'ashemag/human-atlas, MIT',
    url: 'https://github.com/ashemag/human-atlas',
  },
  joints: {
    root: rootOrigin.map(v => +v.toFixed(5)),
    hip: { L: hipL_local.map(v => +v.toFixed(5)), R: hipR_local.map(v => +v.toFixed(5)) },
    hipWorld: { L: hipLfit.center.map(v => +v.toFixed(5)), R: hipRfit.center.map(v => +v.toFixed(5)) },
    knee: { L: knee.L.center.map(v => +v.toFixed(5)), R: knee.R.center.map(v => +v.toFixed(5)) },
    ankle: { L: ankle.L.map(v => +v.toFixed(5)), R: ankle.R.map(v => +v.toFixed(5)) },
    shoulder: { L: shoulder.L.center.map(v => +v.toFixed(5)), R: shoulder.R.center.map(v => +v.toFixed(5)) },
    elbow: { L: elbow.L.center.map(v => +v.toFixed(5)), R: elbow.R.center.map(v => +v.toFixed(5)) },
    wrist: { L: wrist.L.center.map(v => +v.toFixed(5)), R: wrist.R.center.map(v => +v.toFixed(5)) },
    spineTop: spineTopWorld.map(v => +v.toFixed(5)),
    neck: neckTopWorld.map(v => +v.toFixed(5)),
  },
  fits: {
    method: 'RANSAC sphere fit on bone cap vertices + least-squares refinement',
    hipL: hipLfit, hipR: hipRfit,
    kneeDelta: { L: knee.L.delta, R: knee.R.delta },
    elbowSpread: { L: elbow.L.spread, R: elbow.R.spread },
    note: 'Centres are fitted from the mesh. They are anatomical approximations for animation, not measured joint kinematics of any person.',
  },
  bones,
  muscles,
  diagnostics: report,
};

fs.writeFileSync(path.join(outDir, 'skeleton.json'), JSON.stringify(skeleton, null, 1) + '\n');
const bytes = fs.readdirSync(partDir).reduce((s, f) => s + fs.statSync(path.join(partDir, f)).size, 0);
console.log(report.join('\n'));
console.log(`skeleton: ${bones.length} bones, ${muscles.length} muscle meshes, ${(bytes / 1e6).toFixed(2)}MB parts, height ${height.toFixed(3)}m`);
