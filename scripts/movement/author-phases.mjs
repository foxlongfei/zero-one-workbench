/**
 * Author every pose phase of movement-exercises-v1.json from limb targets.
 *
 * A coach describes a position by where the hands and feet go and which way the body points, so
 * phases are written that way (see ./author-poses.mjs) and then solved with the real runtime
 * solver. The teaching body is short-limbed (arm 0.447 m, leg 0.815 m), which drives most of the
 * numbers below: in a push-up the shoulder can be at most ~0.44 m from the hand, so the hands sit
 * almost under the shoulders and the torso slopes down to the ankles.
 *
 *   node scripts/movement/author-phases.mjs          rewrite phases (prints the audit)
 *   node scripts/movement/author-phases.mjs --check  audit only, no writes
 *
 * The numbers that come out of this are asserted by tests/movement/phases.test.mjs; a plausible
 * looking pose can still be anatomically wrong, so the angles are checked, not just eyeballed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { phase, reachErrors, ARM, LEG } from './author-poses.mjs';

const DATA_PATH = fileURLToPath(new URL('../../portal/data/movement-exercises-v1.json', import.meta.url));
const RIG_PATH = fileURLToPath(new URL('../../portal/data/movement-rig-v1.json', import.meta.url));

const ARM_DOWN = { armPole_l: [0, -0.5, -0.4], armPole_r: [0, -0.5, -0.4] };
const ARM_BACK = { armPole_l: [0, -0.8, -0.2], armPole_r: [0, -0.8, -0.2] };
const ARM_OUT = { armPole_l: [0, -0.9, 0.2], armPole_r: [0, -0.9, 0.2] };
const LEG_FORWARD = { legPole_l: [0, 0.35, 1], legPole_r: [0, 0.35, 1] };
const LEG_DOWN = { legPole_l: [0, 1, 0], legPole_r: [0, 1, 0] };
const LEG_DOWN_BACK = { legPole_l: [0, 1, 0.4], legPole_r: [0, 1, 0.4] };

const floor = (part, side, contact = 'LINE') => ({ part, side, contact });
const feetLine = [floor('foot', 'l'), floor('foot', 'r')];
const flatHand = { l: { offset: [0, 0.005, 0], rotation: [-1.35, 0, 0] } };

/** Everything is authored for the left side and mirrored to the right. */
export function mirror(patch) {
  const flip = (v) => [0, v[1], v[2]];
  const other = (key) => (key.endsWith('_l') ? `${key.slice(0, -2)}_r` : key.endsWith('_r') ? `${key.slice(0, -2)}_l` : key);
  const joints = {};
  for (const [key, value] of Object.entries(patch.joints || {})) {
    joints[key] = value;
    joints[other(key)] = flip(value);
  }
  const ik = {};
  for (const [key, value] of Object.entries(patch.ik || {})) {
    ik[key] = flip(value);
    ik[other(key)] = flip(value);
  }
  const hands = patch.hands ? { l: patch.hands.l, r: patch.hands.r || patch.hands.l } : undefined;
  const feet = patch.feet ? { l: patch.feet.l, r: patch.feet.r || { toe: flip(patch.feet.l.toe) } } : undefined;
  return { ...patch, joints, ik, hands, feet };
}

const P = (o) => phase(o);

/**
 * Push-up family. The body is a slope from the ankles up to the shoulders and the hands are under
 * the shoulders, so the phase is written as "shoulder here, hand there"; the pelvis follows the
 * shoulders (`pelvis: 'derive'`) and the feet stay planted where they are.
 *
 * The head drops with the shoulders on purpose - it is the same body, just lower - while the
 * ankles stay lifted at the top of the toe and flat at the bottom.
 */
function pushUp({ shoulder, hips, hand, ankle, heel, armPole, ground }) {
  return P({
    pelvis: 'derive',
    shoulder,
    up: [0, hips[1] - shoulder[1], hips[2] - shoulder[2]],
    joints: { wrist_l: hand, ankle_l: ankle },
    ik: armPole,
    hands: flatHand,
    feet: { l: { toe: [ankle[0], 0.015, ankle[2] + heel] } },
    ground,
  });
}

/**
 * One leg of a bent-knee exercise (knee push-up, clamshell, dead bug). `knee` and `ankle` are
 * targets; the thigh points where the authored knee says it does.
 */
function kneeLeg({ shoulder, hips, hand, knee, ankle, armPole, ground, legs = LEG_DOWN_BACK }) {
  return P({
    pelvis: 'derive',
    shoulder,
    up: [0, hips[1] - shoulder[1], hips[2] - shoulder[2]],
    joints: { wrist_l: hand, knee_l: knee, ankle_l: ankle },
    ik: { ...armPole, ...legs },
    hands: flatHand,
    feet: { l: { toe: [ankle[0], ankle[1] + 0.015, ankle[2] + 0.11] } },
    ground,
  });
}

/** A hinge: pelvis and shoulders stay stacked over the feet, the trunk tips forward. */
function hinge({ root, up, wrist, armPole = ARM_DOWN }) {
  return P({
    pelvis: 'pin',
    root,
    up,
    joints: { wrist_l: wrist },
    ik: armPole,
    feet: { l: { toe: [root[0] - 0.09, 0.02, root[2] + 0.11] } },
    ground: feetLine,
  });
}

const PHASES = {
  'push-up': [
    {
      label: '支撑位',
      seq: 0,
      pose: pushUp({
        shoulder: [0, 0.44, 0.06],
        hips: [0, 0.34, -0.1],
        hand: [-0.18, 0.06, 0.12],
        ankle: [-0.09, 0.15, -0.55],
        heel: 0.1,
        armPole: ARM_DOWN,
        ground: [floor('hand', 'l', 'CIRCLE'), floor('toe', 'l'), floor('ball', 'l')],
      }),
    },
    {
      label: '下放位',
      seq: 0.5,
      pose: pushUp({
        shoulder: [0, 0.31, 0.07],
        hips: [0, 0.23, -0.07],
        hand: [-0.18, 0.06, 0.12],
        ankle: [-0.09, 0.1, -0.55],
        heel: 0.1,
        armPole: ARM_BACK,
        ground: [floor('hand', 'l', 'CIRCLE'), floor('foot', 'l')],
      }),
    },
    { label: '回到支撑位', seq: 1, same: '支撑位' },
  ],
  'push-up-wall': [
    {
      label: '起始',
      seq: 0,
      pose: P({
        shoulder: [0, 1.28, -0.1],
        up: [0, 1, 0],
        joints: { wrist_l: [-0.19, 1.23, 0.34], ankle_l: [-0.09, 0.09, -0.24] },
        ik: { armPole_l: [0, -0.9, 0.3], armPole_r: [0, -0.9, 0.3], ...LEG_FORWARD },
        feet: { l: { toe: [-0.09, 0.02, -0.14] } },
        ground: feetLine,
      }),
    },
    {
      label: '贴近墙',
      seq: 0.5,
      pose: P({
        shoulder: [0, 1.3, 0.02],
        up: [0, 1, 0],
        joints: { wrist_l: [-0.19, 1.23, 0.34], ankle_l: [-0.09, 0.09, -0.24] },
        ik: { armPole_l: [0, -0.9, 0.4], armPole_r: [0, -0.9, 0.4], ...LEG_FORWARD },
        feet: { l: { toe: [-0.09, 0.02, -0.14] } },
        ground: feetLine,
      }),
    },
    { label: '回起始', seq: 1, same: '起始' },
  ],
  'push-up-knee': [
    {
      label: '支撑位',
      seq: 0,
      pose: kneeLeg({
        shoulder: [0, 0.44, 0.0],
        hips: [0, 0.4, -0.15],
        hand: [-0.18, 0.06, 0.08],
        knee: [-0.1, 0.08, -0.36],
        ankle: [-0.1, 0.12, -0.78],
        armPole: ARM_DOWN,
        ground: [floor('hand', 'l', 'CIRCLE'), floor('knee', 'l', 'CIRCLE'), floor('toe', 'l')],
      }),
    },
    {
      label: '下放位',
      seq: 0.5,
      pose: kneeLeg({
        shoulder: [0, 0.31, 0.02],
        hips: [0, 0.29, -0.12],
        hand: [-0.18, 0.06, 0.09],
        knee: [-0.1, 0.08, -0.36],
        ankle: [-0.1, 0.12, -0.78],
        armPole: ARM_BACK,
        ground: [floor('hand', 'l', 'CIRCLE'), floor('knee', 'l', 'CIRCLE'), floor('toe', 'l')],
      }),
    },
    { label: '推起位', seq: 1, same: '支撑位' },
  ],
  'push-up-incline': [
    {
      label: '支撑位',
      seq: 0,
      pose: pushUp({
        shoulder: [0, 0.74, 0.12],
        hips: [0, 0.6, -0.1],
        hand: [-0.18, 0.6, 0.18],
        ankle: [-0.09, 0.09, -0.42],
        heel: 0.07,
        armPole: ARM_DOWN,
        ground: [floor('hand', 'l', 'CIRCLE'), floor('foot', 'l')],
      }),
    },
    {
      label: '下放位',
      seq: 0.5,
      pose: pushUp({
        shoulder: [0, 0.62, 0.14],
        hips: [0, 0.52, -0.1],
        hand: [-0.18, 0.6, 0.16],
        ankle: [-0.09, 0.09, -0.42],
        heel: 0.07,
        armPole: ARM_BACK,
        ground: [floor('hand', 'l', 'CIRCLE'), floor('foot', 'l')],
      }),
    },
    { label: '推起位', seq: 1, same: '支撑位' },
  ],
  plank: [
    {
      label: '前臂支撑',
      seq: 0,
      pose: pushUp({
        shoulder: [0, 0.4, 0.05],
        hips: [0, 0.33, -0.11],
        hand: [-0.2, 0.05, 0.3],
        ankle: [-0.09, 0.1, -0.55],
        heel: 0.06,
        armPole: { armPole_l: [0, -1, 0.3], armPole_r: [0, -1, 0.3] },
        ground: [floor('hand', 'l', 'CIRCLE'), floor('elbow', 'l', 'CIRCLE'), floor('foot', 'l')],
      }),
    },
  ],
  'glute-bridge': [
    {
      label: '落地',
      seq: 0,
      pose: P({
        pelvis: 'pin',
        root: [0, 0.2, -0.32],
        up: [0, 1, 0],
        joints: { wrist_l: [-0.26, 0.06, -0.06], ankle_l: [-0.12, 0.08, -0.62] },
        ik: { armPole_l: [0, -1, -0.5], armPole_r: [0, -1, -0.5], ...LEG_FORWARD },
        feet: { l: { toe: [-0.12, 0.02, -0.52] } },
        ground: feetLine,
      }),
    },
    {
      label: '抬髋',
      seq: 0.5,
      pose: P({
        pelvis: 'pin',
        root: [0, 0.2, -0.32],
        up: [0, 0.3, -0.95],
        joints: { wrist_l: [-0.26, 0.06, -0.06], ankle_l: [-0.12, 0.08, -0.62] },
        ik: { armPole_l: [0, -1, 0.2], armPole_r: [0, -1, 0.2], ...LEG_FORWARD },
        feet: { l: { toe: [-0.12, 0.02, -0.52] } },
        ground: feetLine,
      }),
    },
    { label: '回落', seq: 1, same: '落地' },
  ],
  squat: [
    {
      label: '站立',
      seq: 0,
      pose: P({
        pelvis: 'pin',
        root: [0, 0.995, -0.033],
        up: [0, 1, 0],
        joints: { wrist_l: [-0.2, 0.86, 0.18] },
        ik: { armPole_l: [0, -0.4, 1], armPole_r: [0, -0.4, 1] },
        feet: { l: { toe: [-0.1, 0.02, 0.1] } },
        ground: feetLine,
      }),
    },
    {
      label: '下蹲',
      seq: 0.5,
      pose: P({
        pelvis: 'pin',
        root: [0, 0.62, 0.06],
        up: [0, 0.9, -0.44],
        joints: { wrist_l: [-0.2, 0.86, 0.42], ankle_l: [-0.1, 0.09, 0.02] },
        ik: { armPole_l: [0, -0.3, 1], armPole_r: [0, -0.3, 1] },
        feet: { l: { toe: [-0.1, 0.02, 0.1] } },
        ground: feetLine,
      }),
    },
    { label: '站起', seq: 1, same: '站立' },
  ],
  'reverse-lunge': [
    {
      label: '站立',
      seq: 0,
      pose: P({
        pelvis: 'pin',
        root: [0, 0.995, -0.033],
        up: [0, 1, 0],
        joints: { wrist_l: [-0.2, 0.86, 0.18] },
        ik: { armPole_l: [0, -0.4, 1], armPole_r: [0, -0.4, 1] },
        feet: { l: { toe: [-0.1, 0.02, 0.1] } },
        ground: feetLine,
      }),
    },
    {
      label: '后撤下沉',
      seq: 0.5,
      pose: P({
        pelvis: 'pin',
        root: [0, 0.76, 0.02],
        up: [0, 0.99, -0.14],
        joints: {
          wrist_l: [-0.2, 0.86, 0.22],
          ankle_l: [-0.1, 0.09, 0.24],
          knee_r: [0.1, 0.08, -0.34],
          ankle_r: [0.1, 0.1, -0.66],
        },
        ik: { armPole_l: [0, -0.4, 1], armPole_r: [0, -0.4, 1], legPole_l: [0, 0.4, 1], legPole_r: [0, 0.2, 1] },
        feet: { l: { toe: [-0.1, 0.02, 0.38] }, r: { toe: [0.1, 0.02, -0.56] } },
        ground: [floor('foot', 'l'), floor('knee', 'r', 'CIRCLE'), floor('toe', 'r')],
      }),
    },
    { label: '站起', seq: 1, same: '站立' },
  ],
  'inverted-row': [
    {
      label: '挂直',
      seq: 0,
      pose: P({
        pelvis: 'derive',
        shoulder: [0, 0.8, 0.08],
        up: [0, 0.2, -0.98],
        joints: { wrist_l: [-0.2, 0.88, 0.08], ankle_l: [-0.12, 0.08, 0.86] },
        ik: { armPole_l: [0, 0.6, -0.6], armPole_r: [0, 0.6, -0.6], ...LEG_DOWN_BACK },
        feet: { l: { toe: [-0.12, 0.02, 0.76] } },
        hands: { l: { offset: [0, 0, 0], rotation: [0, 0, 1.57] } },
        ground: [floor('foot', 'l')],
      }),
    },
    {
      label: '拉起',
      seq: 0.5,
      pose: P({
        pelvis: 'derive',
        shoulder: [0, 0.9, 0.12],
        up: [0, 0.2, -0.98],
        joints: { wrist_l: [-0.2, 0.88, 0.08], ankle_l: [-0.12, 0.08, 0.86] },
        ik: { armPole_l: [0, 0.6, -0.6], armPole_r: [0, 0.6, -0.6], ...LEG_DOWN_BACK },
        feet: { l: { toe: [-0.12, 0.02, 0.76] } },
        hands: { l: { offset: [0, 0, 0], rotation: [0, 0, 1.57] } },
        ground: [floor('foot', 'l')],
      }),
    },
    { label: '下放', seq: 1, same: '挂直' },
  ],
  'dead-hang': [
    {
      label: '悬垂',
      seq: 0,
      pose: P({
        pelvis: 'pin',
        root: [0, 1.96, -0.01],
        up: [0, 1, 0],
        joints: { wrist_l: [-0.19, 2.34, -0.01], ankle_l: [-0.09, 0.1, -0.01] },
        ik: { armPole_l: [0, -0.6, -0.4], armPole_r: [0, -0.6, -0.4], ...LEG_FORWARD },
        hands: { l: { offset: [0, 0, 0], rotation: [-1.57, 0, 0] } },
        feet: { l: { toe: [-0.09, 0.08, 0.1] } },
      }),
    },
  ],
};

/** Replace `same` phases with a copy of the referenced phase, so a loop closes on itself. */
function resolve(phases) {
  const byLabel = new Map(phases.map((p) => [p.label, p]));
  return phases.map((entry) => {
    if (!entry.same) return { label: entry.label, seq: entry.seq, pose: mirror(entry.pose) };
    const source = byLabel.get(entry.same);
    if (!source) throw new Error(`unknown phase ${entry.same}`);
    return { label: entry.label, seq: entry.seq, pose: mirror(source.pose) };
  });
}

const check = process.argv.includes('--check');
const bundle = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
const rig = JSON.parse(readFileSync(RIG_PATH, 'utf8'));
const { solvePose, buildSkeleton, mergePose, jointAngles } = await import(
  new URL('../../portal/movement/app/pose.js', import.meta.url).href
);
const skeleton = buildSkeleton(rig);

const authored = bundle.exercises.map((exercise) => {
  const phases = PHASES[exercise.id];
  if (!phases) throw new Error(`no authored phases for ${exercise.id}`);
  return { ...exercise, poses: resolve(phases) };
});

const notes = [];
for (const exercise of authored) {
  // Only the solver's own reach report is used. The authored numbers here are pre-grounding and
  // pre-IK, so measuring them against limb lengths reports the same target twice with a different
  // answer; the solver is the one that knows where the body actually ends up.
  for (const error of reachErrors(exercise)) {
    notes.push(`${error.id} ${error.label}: ${error.part} ${error.distance} m > ${error.limit} m`);
  }
  let inherited = bundle.poseTemplates.neutral;
  for (const stage of exercise.poses) {
    const merged = mergePose(inherited, stage.pose);
    inherited = merged;
    const { joints } = solvePose(rig, skeleton, merged);
    const a = jointAngles(joints, 'l');
    const contacts = (merged.ground || []).map((c) => {
      const name = c.part === 'foot' ? `ankle_${c.side}` : c.part === 'toe' ? `toe_${c.side}` : c.part === 'ball' ? `ball_${c.side}` : `${c.part}_${c.side}`;
      const y = joints[name]?.[1];
      if (y !== undefined && Math.abs(y) > 0.03) notes.push(`${exercise.id} ${stage.label}: ${name} floats at y=${y.toFixed(3)}`);
      return `${c.part}.${c.side}`;
    });
    const feet = ['l', 'r'].map((tag) => joints[`ankle_${tag}`]?.[1]).filter((y) => y !== undefined);
    const head = `${exercise.id.padEnd(16)} ${stage.label.padEnd(8)}`;
    console.log(
      `${head} elbow ${String(a.elbow).padStart(3)} shoulder ${String(a.shoulder).padStart(3)} knee ${String(a.knee).padStart(3)} hip ${String(a.hip).padStart(3)} tilt ${String(a.trunkTilt).padStart(3)}  ankle ${feet.map((y) => y.toFixed(2)).join('/').padEnd(9)} ${contacts.join(' ')}`,
    );
  }
}
for (const note of notes) console.log('!', note);
console.log(`\nreach ${ARM.toFixed(3)} m, leg ${LEG.toFixed(3)} m; ${notes.length} problems`);

if (!check) {
  bundle.exercises = authored;
  bundle.generatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(DATA_PATH, `${JSON.stringify(bundle, null, 2)}\n`);
  console.log('wrote portal/data/movement-exercises-v1.json');
}
process.exitCode = notes.length ? 1 : 0;
