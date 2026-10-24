// Authoring helper for Movement pose phases.
//
// The teaching body is 1.665 m and its limbs are short (arm 0.447 m, leg 0.815 m). Authoring a
// pose by guessing "root" first usually puts an end effector out of reach, and the IK answers with
// a straight, physically wrong limb. So a phase is written the way a coach thinks: where do the
// hands and feet go, and which way does the trunk point. The sacrum ("root") is then derived from
// the shoulder position, because that is what the solver anchors the trunk to.
//
// It also checks that every authored target is actually reachable. A target outside the limb's
// range is reported instead of silently producing a straight limb.
const SACRUM_TO_SHOULDER = 0.31;
const FOOT = 0.1011;
export const ARM = 0.2227 + 0.2246;
export const LEG = 0.4534 + 0.362;

const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
};

const round = (n) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};

/** A trunk direction given as [x, y, z] with x forced to 0 (poses are mirror-symmetric). */
function direction(pair) {
  const length = Math.hypot(pair[1], pair[2]) || 1;
  return [0, pair[1] / length, pair[2] / length];
}

/**
 * Build one pose phase.
 * @param {object} o
 * @param {number[]} [o.shoulder] shoulder [x, y, z] (x ignored); the sacrum is derived from it
 * @param {number[]} [o.root] explicit sacrum, used when no shoulder constraint applies
 * @param {number[]} o.up trunk "up" direction ([x, y, z], x ignored)
 * @param {object} [o.joints] world-space overrides (wrist_l, ankle_r, ...)
 * @param {object} [o.hands] per-side hand offset/rotation
 * @param {object} [o.feet] per-side toe override
 * @param {Array} [o.ground] floor contacts
 * @param {object} [o.ik] pole biases
 */
export function phase({ shoulder, root, up, joints = {}, hands, feet, ground, ik }) {
  const upDir = direction(up);
  const sacrum = shoulder
    ? [0, shoulder[1] - upDir[1] * SACRUM_TO_SHOULDER, shoulder[2] - upDir[2] * SACRUM_TO_SHOULDER]
    : root;
  // Toe default: heel-strike direction, i.e. the rest foot rotated by the same angle the trunk
  // took. A vertical trunk leaves the foot on its rest heading, a crouched or prone body points
  // the toes the way the shin points, which is how a foot looks when it is stood on or dragging.
  const heelStrike = direction([0, -upDir[2], upDir[1]]);
  const toeOf = (side) => feet?.[side]?.toe || V.add(joints[`ankle_${side}`] || [0, 0, 0], V.scale(heelStrike, FOOT));
  const out = {
    root: sacrum.map(round),
    trunkUp: upDir.map(round),
    trunkFwd: [0, round(-upDir[2]), round(upDir[1])],
    ik,
    joints: Object.fromEntries(Object.entries(joints).map(([key, value]) => [key, value.map(round)])),
    hands,
    feet: {
      l: { ...feet?.l, toe: toeOf('l').map(round) },
      r: { ...feet?.r, toe: toeOf('r').map(round) },
    },
    ground,
  };
  for (const key of Object.keys(out)) if (out[key] === undefined) delete out[key];
  return out;
}

/**
 * Distance each effector target sits from its root joint, for every authored phase.
 * Returns a list of `{ id, label, part, distance, limit }` for targets that cannot be reached.
 */
export function reachErrors(exercise) {
  const errors = [];
  for (const stage of exercise.poses) {
    const pose = stage.pose || {};
    const joints = pose.joints || {};
    const upDir = direction(pose.trunkUp || [0, 1, 0]);
    const sacrum = pose.root || [0, 0.995, -0.033];
    const shoulder = [0, sacrum[1] + upDir[1] * SACRUM_TO_SHOULDER, sacrum[2] + upDir[2] * SACRUM_TO_SHOULDER];
    const hip = [0, sacrum[1] - upDir[1] * 0.1, sacrum[2] - upDir[2] * 0.1];
    for (const [key, value] of Object.entries(joints)) {
      const from = key.startsWith('wrist_') ? shoulder : key.startsWith('ankle_') ? hip : null;
      const limit = key.startsWith('wrist_') ? ARM : key.startsWith('ankle_') ? LEG : null;
      if (!from || !limit) continue;
      const distance = Math.hypot(value[0] - from[0], value[1] - from[1], value[2] - from[2]);
      if (distance > limit) errors.push({ id: exercise.id, label: stage.label, part: key, distance: +distance.toFixed(3), limit: +limit.toFixed(3) });
    }
  }
  return errors;
}
