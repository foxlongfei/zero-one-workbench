/**
 * Solve every pose phase of the exercise library and report the numbers a coach would check:
 * joint angles, whether the declared contacts actually touch the floor, and whether any hand or
 * foot target sits outside the teaching body's reach.
 *
 *   node scripts/movement/verify-phases.mjs [--json]
 *
 * Exit code is non-zero when a phase is unreachable or a contact floats, so this can gate a
 * content change without a browser.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DATA = new URL('../portal/data/', import.meta.url);
const load = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(name, DATA)), 'utf8'));

const { solvePose, buildSkeleton, mergePose, jointAngles } = await import(
  new URL('../portal/movement/app/pose.js', import.meta.url).href
);
const { reachErrors } = await import('./author-poses.mjs');

const bundle = load('movement-exercises-v1.json');
const rig = load('movement-rig-v1.json');
const skeleton = buildSkeleton(rig);

const rows = [];
const problems = [];
for (const exercise of bundle.exercises) {
  const bad = reachErrors(exercise);
  for (const error of bad) problems.push(`${error.id} ${error.label}: ${error.part} ${error.distance} m > ${error.limit} m`);
  let inherited = bundle.poseTemplates.neutral;
  for (const stage of exercise.poses) {
    const merged = mergePose(inherited, stage.pose || {});
    inherited = merged;
    const { joints, grounded } = solvePose(rig, skeleton, merged);
    const angles = jointAngles(joints, 'l');
    const groundProblems = [];
    for (const contact of merged.ground || []) {
      const tag = contact.side;
      const name =
        contact.part === 'foot' ? `ankle_${tag}` : contact.part === 'toe' ? `toe_${tag}` : `${contact.part}_${tag}`;
      const point = joints[name];
      if (!point) continue;
      if (Math.abs(point[1]) > 0.02) groundProblems.push(`${contact.part}_${tag} y=${point[1].toFixed(3)}`);
    }
    const lowest = Math.min(...Object.entries(joints).map(([, p]) => p[1]));
    rows.push({ id: exercise.id, label: stage.label, angles, grounded: +grounded.toFixed(3), lowest: +lowest.toFixed(3), groundProblems });
    for (const problem of groundProblems) problems.push(`${exercise.id} ${stage.label}: contact off floor ${problem}`);
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rows, problems }, null, 2));
} else {
  for (const row of rows) {
    const a = row.angles;
    console.log(
      `${row.id.padEnd(16)} ${row.label.padEnd(8)} elbow ${String(a.elbow).padStart(3)}  shoulder ${String(a.shoulder).padStart(3)}  knee ${String(a.knee).padStart(3)}  hip ${String(a.hip).padStart(3)}  tilt ${String(a.trunkTilt).padStart(3)}  lowest ${row.lowest}  grounded ${row.grounded}`,
    );
  }
  console.log('\nproblems:', problems.length);
  for (const problem of problems) console.log('  -', problem);
}
process.exitCode = problems.length ? 1 : 0;
