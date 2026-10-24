/**
 * Apply a solved pose to the skinned body pack.
 *
 * The pack is the curated BodyParts3D subset (see scripts/movement/slice-atlas.py). Every
 * part names the bone it rides on; bridging muscles carry a per-vertex weight towards a
 * second bone. Because the meshes are static, the cheapest correct skin is a dense CPU pass
 * over ~195k vertices on pose change - about a frame's worth of work, and it keeps the
 * figure independent of three.js so tests can run headless.
 */
const CACHE = new WeakMap();

/** For each part, a flat Float32Array of the per-vertex weight on the primary bone. */
export function partWeights(part) {
  let w = CACHE.get(part);
  if (w) return w;
  const n = part.vertexCount;
  if (part.weightBuffer) w = part.weightBuffer;
  else {
    w = new Float32Array(n);
    w.fill(1);
  }
  CACHE.set(part, w);
  return w;
}

/**
 * Bone transform: a bone is a segment restA -> restB (its own joint towards the next joint
 * of the same chain). A vertex belonging to the bone is carried by the rotation that takes
 * that rest segment onto the posed segment, anchored at the posed proximal joint.
 */
export function boneFrame(restA, restB, poseA, poseB) {
  const u = [restB[0] - restA[0], restB[1] - restA[1], restB[2] - restA[2]];
  const v = [poseB[0] - poseA[0], poseB[1] - poseA[1], poseB[2] - poseA[2]];
  return { restA, poseA, rot: rotationBetween(u, v) };
}

function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** Minimal rotation matrix (row-major 3x3) taking unit u onto unit v. */
function rotationBetween(u0, v0) {
  const u = norm(u0), v = norm(v0);
  const d = Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]));
  if (d > 0.999999) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (d < -0.999999) {
    // 180 degrees: rotate about any axis perpendicular to u
    const axis = Math.abs(u[0]) < 0.9 ? norm([0, -u[2], u[1]]) : norm([-u[2], 0, u[0]]);
    return axisAngle(axis, Math.PI);
  }
  const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const k = 1 / (1 + d);
  return [
    1 - k * (c[1] * c[1] + c[2] * c[2]), k * c[0] * c[1] - c[2], k * c[0] * c[2] + c[1],
    k * c[0] * c[1] + c[2], 1 - k * (c[0] * c[0] + c[2] * c[2]), k * c[1] * c[2] - c[0],
    k * c[0] * c[2] - c[1], k * c[1] * c[2] + c[0], 1 - k * (c[0] * c[0] + c[1] * c[1]),
  ];
}

function axisAngle([x, y, z], angle) {
  const s = Math.sin(angle), c = Math.cos(angle), t = 1 - c;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

const BONE_END = {
  sacrum: (j) => j.spine_low,
  spine_low: (j) => j.spine_mid,
  spine_mid: (j) => j.spine_up,
  spine_up: (j) => j.neck,
  neck: (j) => j.head,
  head: (j) => j.head_end,
  shoulder: (j, side) => j[`shoulder_${side}`],
  upperarm: (j, side) => j[`elbow_${side}`],
  forearm: (j, side) => j[`wrist_${side}`],
  hand: (j, side) => j[`fingertip_${side}`],
  thigh: (j, side) => j[`knee_${side}`],
  shin: (j, side) => j[`ankle_${side}`],
  foot: (j, side) => j[`toe_${side}`],
};

function splitBone(name) {
  const m = /^(.*)_(l|r)$/.exec(name);
  return m ? [m[1], m[2]] : [name, null];
}

export function boneSegment(joints, name) {
  const [base, side] = splitBone(name);
  const start = joints[name] || joints[base];
  const pick = BONE_END[base];
  const end = pick ? pick(joints, side) : null;
  return [start, end || start];
}

/**
 * Pose the pack in place: writes `positions` and `normals` (plain arrays) into every part.
 * `rest` is the rest joint set (character frame, no pose) - bones rotate from there.
 */
export function skinBody(pack, rest, joints) {
  const frames = new Map();
  for (const part of pack.parts) {
    const a = frame(part.bone);
    const b = part.boneB ? frame(part.boneB) : null;
    const w = partWeights(part);
    const src = part.positionBuffer, srcN = part.normalBuffer;
    const n = part.vertexCount;
    const out = part.positions && part.positions.length === n * 3 ? part.positions : new Float32Array(n * 3);
    const outN = part.normals && part.normals.length === n * 3 ? part.normals : new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      const wa = w[i], wb = b ? 1 - wa : 0;
      apply(a, src, srcN, i, out, outN, wa);
      if (wb > 0.0005) apply(b, src, srcN, i, out, outN, wb);
    }
    part.positions = out;
    part.normals = outN;
    part.needsUpdate = true;
  }

  function frame(name) {
    let f = frames.get(name);
    if (f) return f;
    const [ra, rb] = boneSegment(rest, name);
    const [pa, pb] = boneSegment(joints, name);
    f = boneFrame(ra, rb, pa, pb);
    frames.set(name, f);
    return f;
  }

  function apply(f, src, srcN, i, out, outN, weight) {
    const m = f.rot;
    const x = src[i * 3] - f.restA[0], y = src[i * 3 + 1] - f.restA[1], z = src[i * 3 + 2] - f.restA[2];
    out[i * 3] += weight * (f.poseA[0] + m[0] * x + m[1] * y + m[2] * z);
    out[i * 3 + 1] += weight * (f.poseA[1] + m[3] * x + m[4] * y + m[5] * z);
    out[i * 3 + 2] += weight * (f.poseA[2] + m[6] * x + m[7] * y + m[8] * z);
    const nx = srcN[i * 3], ny = srcN[i * 3 + 1], nz = srcN[i * 3 + 2];
    outN[i * 3] += weight * (m[0] * nx + m[1] * ny + m[2] * nz);
    outN[i * 3 + 1] += weight * (m[3] * nx + m[4] * ny + m[5] * nz);
    outN[i * 3 + 2] += weight * (m[6] * nx + m[7] * ny + m[8] * nz);
  }
  return pack;
}

/**
 * Clear the accumulation buffers before a new skin pass. skinBody() sums contributions, so
 * callers reset first; keeping it separate makes double-skinned bridging muscles obvious.
 */
export function resetOutputs(pack) {
  for (const part of pack.parts) {
    if (!part.positions) part.positions = new Float32Array(part.vertexCount * 3);
    else part.positions.fill(0);
    if (!part.normals) part.normals = new Float32Array(part.vertexCount * 3);
    else part.normals.fill(0);
  }
}

/** Which mesh parts carry a given muscle role tag, for the "亮点在哪里" highlight. */
export function partsForMuscles(pack, names) {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return pack.parts.filter((p) => {
    const slug = p.slug.toLowerCase();
    return [...wanted].some((w) => slug.startsWith(w) || slug.includes(`_${w}`) || slug.includes(w));
  }).map((p) => p.id);
}
