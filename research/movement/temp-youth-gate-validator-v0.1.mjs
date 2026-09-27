import fs from 'node:fs';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('usage: node temp-youth-gate-validator-v0.1.mjs <cases.json>');
  process.exit(2);
}

const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const requiredPlacementEvidence = [
  'movement_competence',
  'instruction_readiness',
  'training_age',
  'needs_goals'
];

function validate(record) {
  const errors = [];
  if (!(record.age >= 5 && record.age <= 17)) errors.push('TY-00_SCOPE_AGE_5_17');
  if (!(record.who_average_mvpa_minutes_per_day >= 60)) errors.push('TY-01_WHO_MVPA_LT_60');
  if (!(record.vigorous_muscle_bone_days_per_week >= 3)) errors.push('TY-01_WHO_VIGOROUS_MUSCLE_BONE_LT_3');
  if (record.placement_basis?.length === 1 && record.placement_basis[0] === 'chronological_age') {
    errors.push('TY-02_AGE_ONLY_PLACEMENT_FORBIDDEN');
  }
  for (const axis of requiredPlacementEvidence) {
    if (!record.placement_basis?.includes(axis)) errors.push(`TY-02_MISSING_${axis.toUpperCase()}`);
  }
  if (record.qualified_supervision !== true) errors.push('TY-03_QUALIFIED_SUPERVISION_REQUIRED');
  if (record.technique_before_load !== true) errors.push('TY-03_TECHNIQUE_BEFORE_LOAD_REQUIRED');
  if (!record.as_of || !/^\d{4}-\d{2}-\d{2}$/.test(record.as_of)) errors.push('TY-04_AS_OF_REQUIRED');
  for (const source of ['WHO-5-17', 'NSCA-YSRT-2009']) {
    if (!record.source_ids?.includes(source)) errors.push(`TY-04_MISSING_SOURCE_${source}`);
  }
  return {valid: errors.length === 0, errors};
}

const results = payload.cases.map(testCase => {
  const outcome = validate(testCase.record);
  return {
    id: testCase.id,
    expected_valid: testCase.expected_valid,
    ...outcome,
    expectation_match: testCase.expected_valid === outcome.valid
  };
});

const summary = {
  total: results.length,
  valid: results.filter(x => x.valid).length,
  invalid: results.filter(x => !x.valid).length,
  expectation_mismatches: results.filter(x => !x.expectation_match).length
};

console.log(JSON.stringify({validator: 'TEMP-YOUTH-GATE-V0.1', summary, results}, null, 2));
process.exit(summary.expectation_mismatches === 0 ? 0 : 1);
