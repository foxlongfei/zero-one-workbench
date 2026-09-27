import fs from 'node:fs';

const fixtures = JSON.parse(fs.readFileSync(new URL('./mf-t01-cases-v0.1.json', import.meta.url), 'utf8'));

function assess(input) {
  const v = input.sources.video ?? {};
  const f = input.sources.external_force ?? {};
  const u = input.sources.ultrasound ?? {};
  const emg = input.sources.emg ?? {};
  const model = input.sources.musculoskeletal_model ?? {};
  const body = input.sources.anthropometry ?? {};
  const calibrated3d = Boolean(v.available && v.calibrated && v.camera_count >= 2);
  const syncedForce = Boolean(f.available && f.synchronized);
  const syncedUltrasound = Boolean(u.available && u.synchronized);
  const results = {
    phase_timing: v.available && v.frame_rate_known && v.body_visible ? 'MEASURED' : 'UNAVAILABLE',
    joint_angle: calibrated3d ? 'MODEL_DERIVED' : (v.available && v.body_visible ? 'QUALITATIVE_ONLY' : 'UNAVAILABLE'),
    bar_reaction_force: syncedForce ? 'MEASURED' : 'UNAVAILABLE',
    net_joint_moment: calibrated3d && syncedForce && model.available && body.available ? 'MODEL_DERIVED' : 'UNAVAILABLE',
    individual_muscle_force: calibrated3d && syncedForce && model.available && body.available && (emg.available || model.optimization) ? 'MODEL_DERIVED' : 'UNAVAILABLE',
    fascicle_velocity: syncedUltrasound ? 'MEASURED' : 'UNAVAILABLE',
    tendon_strain: syncedUltrasound && calibrated3d ? 'MODEL_DERIVED' : 'UNAVAILABLE',
    energy_balance: calibrated3d && syncedForce && syncedUltrasound && model.available && Boolean(input.sign_convention) ? 'MODEL_DERIVED' : 'UNAVAILABLE'
  };

  const violations = [];
  const requestedNumeric = new Set(input.requested_numeric_outputs ?? []);
  const videoOnly = Boolean(v.available) && !f.available && !u.available && !emg.available && !model.available;
  if (videoOnly && [...requestedNumeric].some(x => ['bar_reaction_force','net_joint_moment','individual_muscle_force','energy_balance'].includes(x))) violations.push('MF-01');
  if (requestedNumeric.has('joint_angle') && v.available && (!v.calibrated || v.camera_count < 2) && v.out_of_plane) violations.push('MF-02');
  if (requestedNumeric.has('individual_muscle_force') && emg.available && !model.available) violations.push('MF-03');
  if ([...requestedNumeric].some(x => results[x] === 'MODEL_DERIVED') && !input.model_provenance) violations.push('MF-04');
  if (requestedNumeric.has('energy_balance') && ((f.available && !f.synchronized) || (u.available && !u.synchronized))) violations.push('MF-05');
  return { results, violations };
}

let failures = 0;
for (const fixture of fixtures) {
  const actual = assess(fixture.input);
  const ok = JSON.stringify(actual) === JSON.stringify(fixture.expected);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${fixture.id}`);
  if (!ok) {
    failures++;
    console.log(JSON.stringify({ expected: fixture.expected, actual }, null, 2));
  }
}
if (failures) process.exit(1);
