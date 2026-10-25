/**
 * Chain solver for the Movement teaching body.
 *
 * Input is a pose (see movement-exercises-v1.json `poseTemplates` and each exercise phase):
 * world-space targets for a handful of joints, a trunk orientation, IK pole biases, and
 * which body parts touch the floor. Output is the full joint set the skinned mesh needs.
 *
 * Three design rules keep one pose definition serving the figure, the camera guide and the
 * photo analysis:
 *   1. everything is expressed in metres in the character frame (+X = character's own left),
 *   2. the solver never invents motion - unsolved joints stay on their rest position,
 *   3. the pelvis is the anchor: hips hang off `root`, and a phase may pin the pelvis instead of
 *      the shoulders (squatting, sitting, bridging) via `pelvis: 'pin'`.
 */
import { loadLibrary } from './library.js';

const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  mul: (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  /** Rotate v around unit axis k by angle (radians). Rodrigues. */
  rot: (v, k, angle) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const kv = V.cross(k, v), kd = V.dot(k, v);
    return [
      v[0] * c + kv[0] * s + k[0] * kd * (1 - c),
      v[1] * c + kv[1] * s + k[1] * kd * (1 - c),
      v[2] * c + kv[2] * s + k[2] * kd * (1 - c),
    ];
  },
};

export { V };

/** Frame from an up vector and a forward hint: [xAxis, up, forward] orthonormal. */
export function frameOf(upHint, fwdHint) {
  const up = V.norm(upHint);
  let fwd = V.sub(fwdHint, V.scale(up, V.dot(fwdHint, up)));
  if (V.len(fwd) < 1e-6) fwd = [0, 0, 1];
  fwd = V.norm(fwd);
  const right = V.norm(V.cross(up, fwd));
  return { up, fwd, right };
}

/**
 * Two-bone IK. Returns the middle joint position.
 * `pole` is a world-space direction the middle joint prefers to bend towards; its component
 * perpendicular to root->target decides the bend plane, which is what keeps elbows pointing
 * down in a push-up and knees pointing forward in a squat.
 *
 * Implementation detail that matters for straight limbs: at full extension the analytical
 * solution wants the middle joint exactly on the root->target line, which is the 180 degree
 * case where the plane is undefined and a naive solver flips the arm over. Instead the solve
 * happens on a trimmed target (minJointAngle of bend) and the result is then projected onto
 * the true root->target line, so a straight arm is straight and still keeps its bend direction.
 */
const MIN_JOINT_ANGLE = 0.08; // ~4.6 degrees of visible bend, also the fallback for a straight limb

export function solveTwoBone(root, target, upper, lower, pole) {
  const delta = V.sub(target, root);
  const raw = V.len(delta);
  const dir = raw > 1e-6 ? V.scale(delta, 1 / raw) : [0, -1, 0];
  const max = (upper + lower) * 0.9995;
  const inner = Math.abs(upper - lower) + 1e-4;
  const dist = Math.min(max, Math.max(inner, raw));

  let bend = V.sub(pole, V.scale(dir, V.dot(pole, dir)));
  if (V.len(bend) < 1e-6) {
    const fallback = Math.abs(dir[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
    bend = V.sub(fallback, V.scale(dir, V.dot(fallback, dir)));
  }
  bend = V.norm(bend);

  // A bend of exactly MIN_JOINT_ANGLE is the shallowest solve that still has a defined plane.
  const trimmedDistance = Math.min(dist, Math.cos(MIN_JOINT_ANGLE / 2) * (upper + lower) * 0.999);
  const bent = solveBent(upper, lower, trimmedDistance);
  const middle = V.add(V.add(root, V.scale(dir, bent.a)), V.scale(bend, bent.h));
  // Reaching past the trimmed distance means the real limb is (nearly) straight: fade the bend out
  // instead of letting it stay behind at the shorter target.
  const reached = Math.min(raw, max);
  const extension = Math.max(0, Math.min(1, (raw - trimmedDistance) / Math.max(trimmedDistance, 1e-6)));
  const straightMiddle = V.add(root, V.scale(dir, ((upper * upper - lower * lower) / (upper + lower)) + (upper + lower) / 2));
  return {
    middle: extension > 0 ? V.lerp(middle, straightMiddle, extension) : middle,
    end: V.add(root, V.scale(dir, reached)),
    clamped: raw > max,
  };
}

function solveBent(upper, lower, dist) {
  const a = (upper * upper - lower * lower + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(upper * upper - a * a, 0));
  return { a, h, trimmedDistance: dist };
}

/**
 * Deep-merge pose fragments so a phase only writes what changes.
 * Arrays are values, not containers: a vector replaces whatever was there, even when the
 * inherited slot happens to hold an object (or the other way round). Mixing the two kinds
 * silently turns poses into arrays and every solved angle into nonsense.
 */
function assignDeep(base, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      base[key] = value.slice();
    } else if (value && typeof value === 'object') {
      if (!base[key] || typeof base[key] !== 'object' || Array.isArray(base[key])) base[key] = {};
      assignDeep(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

export function mergePose(base, patch) {
  const out = JSON.parse(JSON.stringify(base));
  return assignDeep(out, patch || {});
}

/**
 * Build the runtime skeleton once: rest joints (plus the derived ones the mesh needs) and
 * the transform each mesh part will be parented to.
 */
export function buildSkeleton(rig) {
  const rest = {};
  for (const [name, p] of Object.entries(rig.joints)) rest[name] = p.slice();
  const head = rest.head_end;
  rest.chest = rig.joints.spine_up.slice();
  rest.head_top = head.slice();
  rest.chest_l = [-0.09, 1.24, 0.02];
  rest.chest_r = [0.09, 1.24, 0.02];
  rest.elbow_drop_l = [-0.195, 1.195, -0.053];
  rest.elbow_drop_r = [0.195, 1.195, -0.053];
  return rest;
}

/** Trunk geometry from the rig, so the solver and the authoring helper cannot disagree. */
export function trunkMetrics(rig) {
  const root = rig.joints.root;
  const shoulder = rig.joints.shoulder_l;
  const hip = rig.joints.hip_l;
  return {
    sacrumToShoulder: shoulder[1] - root[1],
    hipDrop: root[1] - hip[1],
    hipHalfWidth: Math.abs(hip[0]),
    shoulderHalfWidth: Math.abs(shoulder[0]),
  };
}

/**
 * Solve one pose. `skeleton` comes from buildSkeleton(), `pose` is an already-merged pose.
 * The result maps every joint name used by the mesh to a world position.
 */
export function solvePose(rig, skeleton, pose) {
  const out = {};
  for (const [k, v] of Object.entries(pose.joints || {})) out[k] = v.slice();
  for (const [k, v] of Object.entries(skeleton)) if (!out[k]) out[k] = v.slice();
  // `root` is a pose-level field (the pelvis origin), not a joint override; the merged
  // neutral template carries a stale copy in joints, so take the pose explicitly.
  out.root = (pose.root || pose.joints?.root || out.root).slice();

  const trunk = frameOf(pose.trunkUp || [0, 1, 0], pose.trunkFwd || [0, 0, 1]);
  const defaultPol = pose.ik || {};
  const metrics = trunkMetrics(rig);

  // The pelvis is authored explicitly. When it is pinned, the shoulders are not: they come out of
  // the trunk, and anything the author wrote for them is ignored, which is what lets a squat be
  // described as "pelvis here, ankle there" instead of juggling two anchors.
  const pin = pose.pelvis === 'pin';
  if (pin) {
    for (const tag of ['l', 'r']) {
      delete out[`shoulder_${tag}`];
      delete out[`wrist_${tag}`];
    }
  }
  // The pelvis may also be derived from the shoulders ("where are the hands, so where is the
  // pelvis") while the feet stay where the author put them. Either way the hips follow the
  // authored root, never the reach of a pinned ankle.
  if (pose.pelvis === 'derive' && Object.hasOwn(pose.joints || {}, 'wrist_l')) {
    const shoulder = out.shoulder_l;
    out.root = V.sub(shoulder, V.scale(trunk.up, metrics.sacrumToShoulder));
    out.root[0] = 0;
  }

  // Pelvis joints follow the pelvis, not the trunk: without this a lying or inverted pose keeps
  // the hips at their standing rest position and the legs stretch to absurd places.
  for (const [tag, side] of [['l', -1], ['r', 1]]) {
    if (!Object.hasOwn(pose.joints || {}, `hip_${tag}`)) {
      out[`hip_${tag}`] = V.add(out.root, V.add(V.scale(trunk.right, side * metrics.hipHalfWidth), V.scale(trunk.up, -metrics.hipDrop)));
    }
  }

  // --- trunk: root -> spine_low -> spine_mid -> spine_up -> neck -> head along trunkUp
  const root = out.root.slice();
  const up = trunk.up;
  out.sacrum = root.slice();
  out.spine_low = V.add(root, V.scale(up, 0.095));
  out.spine_mid = V.add(root, V.scale(up, 0.22));
  out.spine_up = V.add(root, V.scale(up, 0.335));
  out.neck = V.add(root, V.scale(up, 0.46));
  out.head = V.add(root, V.scale(up, 0.54));
  out.head_end = V.add(root, V.scale(up, 0.67));
  out.head_top = V.add(root, V.scale(up, 0.70));
  out.chest = V.add(V.add(root, V.scale(up, 0.30)), V.scale(trunk.fwd, 0.07));
  out.chest_l = V.add(V.add(root, V.scale(up, 0.25)), V.add(V.scale(trunk.right, -0.09), V.scale(trunk.fwd, 0.09)));
  out.chest_r = V.add(V.add(root, V.scale(up, 0.25)), V.add(V.scale(trunk.right, 0.09), V.scale(trunk.fwd, 0.09)));

  // --- clavicles: shoulders sit on the trunk frame, offset by the pose when asked
  const shoulderBase = (side) => V.add(
    V.add(root, V.scale(up, metrics.sacrumToShoulder)),
    V.add(V.scale(trunk.right, side * metrics.shoulderHalfWidth), V.scale(trunk.fwd, -0.01)),
  );
  for (const [tag, side] of [['l', -1], ['r', 1]]) {
    if (out[`shoulder_${tag}`]) continue;
    out[`shoulder_${tag}`] = shoulderBase(side);
  }
  out.clavicle_l = V.lerp(out.spine_up, out.shoulder_l, 0.8);
  out.clavicle_r = V.lerp(out.spine_up, out.shoulder_r, 0.8);

  // --- legs: the ankle is a target, the knee is solved, the toe follows the foot heading
  for (const [tag, side] of [['l', -1], ['r', 1]]) {
    const hip = out[`hip_${tag}`];
    out[`hip_pair_${tag}`] = V.add(hip, V.scale(trunk.right, side * 0.055));
    if (out[`ankle_${tag}`]) {
      // A pinned ankle only supplies the target position; the knee and toe are still solved.
      const ankleTarget = out[`ankle_${tag}`].slice();
      const pole = defaultPol[`legPole_${tag}`] || V.add(V.scale(trunk.fwd, 1), V.scale(trunk.up, 0.35));
      const solved = solveTwoBone(hip, ankleTarget, rig.lengths[`thigh_${tag}`], rig.lengths[`shin_${tag}`], pole);
      out[`knee_${tag}`] = solved.middle;
      out[`ankle_${tag}`] = solved.end;
      const footDir = V.norm(V.sub(solved.end, solved.middle));
      const toe = pose.feet?.[tag]?.toe || V.add(solved.end, V.norm(V.add(V.scale(footDir, 0.15), [0, -0.06, 0])));
      out[`toe_${tag}`] = toe;
      out[`ball_${tag}`] = V.lerp(solved.end, toe, 0.72);
      continue;
    }
    if (out[`knee_${tag}`]) continue;
    const ankleTarget = V.add(hip, V.scale(up, -0.81));
    const pole = defaultPol[`legPole_${tag}`] || V.add(V.scale(trunk.fwd, 1), V.scale(trunk.up, 0.35));
    const solved = solveTwoBone(hip, ankleTarget, rig.lengths[`thigh_${tag}`], rig.lengths[`shin_${tag}`], pole);
    out[`knee_${tag}`] = solved.middle;
    out[`ankle_${tag}`] = solved.end;
    const footDir = V.norm(V.sub(solved.end, solved.middle));
    const toe = pose.feet?.[tag]?.toe || V.add(solved.end, V.norm(V.add(V.scale(footDir, 0.15), [0, -0.06, 0])));
    out[`toe_${tag}`] = toe;
    out[`ball_${tag}`] = V.lerp(solved.end, toe, 0.72);
  }

  // --- arms: the wrist is a target, the elbow is solved, the hand follows the forearm
  for (const [tag, side] of [['l', -1], ['r', 1]]) {
    const shoulder = out[`shoulder_${tag}`];
    if (out[`elbow_${tag}`] && out[`wrist_${tag}`] && !pose.joints?.[`wrist_${tag}`]) continue;
    const wristTarget = out[`wrist_${tag}`] || V.add(V.add(shoulder, V.scale(up, -0.42)), V.scale(trunk.right, side * 0.03));
    const pole = defaultPol[`armPole_${tag}`] || V.add(V.scale(trunk.up, -1), V.scale(trunk.fwd, -1));
    const solved = solveTwoBone(shoulder, wristTarget, rig.lengths[`upperarm_${tag}`], rig.lengths[`forearm_${tag}`], pole);
    out[`elbow_${tag}`] = solved.middle;
    out[`wrist_${tag}`] = solved.end;
    const offset = pose.hands?.[tag]?.offset || [0, 0, 0];
    out[`hand_${tag}`] = V.add(solved.end, offset);
    const handDir = V.norm(V.sub(solved.end, solved.middle));
    out[`fingertip_${tag}`] = V.add(solved.end, V.add(V.scale(handDir, 0.09), offset));
  }

  // --- grounding: move the whole body so the declared contacts rest on the floor
  const lift = groundOffset(pose.ground, out, trunk);
  if (Math.abs(lift) > 1e-6) {
    for (const key of Object.keys(out)) out[key] = [out[key][0], out[key][1] + lift, out[key][2]];
  }
  return { joints: out, trunk, grounded: lift };
}

export function groundOffset(ground, joints, trunk) {
  if (!Array.isArray(ground) || ground.length === 0) return 0;
  let lowest = Infinity;
  for (const contact of ground) {
    const point = contactPoint(contact, joints, trunk, contact.side);
    if (point) lowest = Math.min(lowest, point[1] - (contact.lift || 0));
  }
  return Number.isFinite(lowest) ? -lowest : 0;
}

function contactPoint(contact, joints, trunk, side) {
  const tag = side === 'l' || side === 'r' ? side : null;
  const j = (name) => joints[name];
  switch (contact.part) {
    case 'foot':
      if (contact.contact === 'CIRCLE') return j(`ball_${tag}`) || j(`ankle_${tag}`);
      return lowestOf([j(`ankle_${tag}`), j(`toe_${tag}`), j(`ball_${tag}`)].filter(Boolean));
    case 'hand':
      return j(`hand_${tag}`);
    case 'fingertips':
      return j(`fingertip_${tag}`);
    case 'knee':
      return j(`knee_${tag}`);
    case 'elbow':
      return j(`elbow_${tag}`);
    case 'butt':
      return j('sacrum') && V.add(j('sacrum'), [0, -0.10, 0]);
    case 'head':
      return j('head_top');
    default:
      return null;
  }
}

function lowestOf(points) {
  return points.reduce((a, b) => (b[1] < a[1] ? b : a));
}

/** Interpolate two solved joint sets; used for phase scrubbing and follow-along playback. */
export function blendJoints(a, b, t) {
  const out = {};
  for (const key of Object.keys(a)) {
    const target = b[key];
    out[key] = target ? V.lerp(a[key], target, t) : a[key].slice();
  }
  return out;
}

/** The three geometric angles the analysis page reports, in degrees. */
export function jointAngles(joints, side = 'l') {
  const angle = (a, b, c) => {
    const u = V.sub(a, b), w = V.sub(c, b);
    const cosine = V.dot(u, w) / ((V.len(u) * V.len(w)) || 1);
    return Math.round((Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI);
  };
  const hip = joints[`hip_${side}`], knee = joints[`knee_${side}`], ankle = joints[`ankle_${side}`];
  const shoulder = joints[`shoulder_${side}`], elbow = joints[`elbow_${side}`], wrist = joints[`wrist_${side}`];
  const trunkLine = V.sub(joints.neck || joints.head, joints.sacrum || joints.root);
  const vertical = [0, 1, 0];
  const tilt = Math.round((Math.acos(Math.max(-1, Math.min(1, V.dot(V.norm(trunkLine), vertical)))) * 180) / Math.PI);
  return {
    knee: angle(hip, knee, ankle),
    elbow: angle(shoulder, elbow, wrist),
    hip: angle(shoulder, hip, knee),
    shoulder: angle(hip, shoulder, elbow),
    trunkTilt: tilt,
  };
}
