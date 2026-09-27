import fs from 'node:fs';

const artifactPath = new URL('./testset-01-m02-q-c-acceptance-audit-v0.1.json', import.meta.url);
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });

check('original task id preserved', artifact.task_id === 'M02', artifact.task_id);
check('C reviewer declared', artifact.reviewer_role === 'C', artifact.reviewer_role);
check('frozen hashes 8/8', artifact.review_results.frozen_hashes.checked === 8 && artifact.review_results.frozen_hashes.matched === 8, artifact.review_results.frozen_hashes);
check('required fields 10/10', artifact.review_results.required_output_fields.required === 10 && artifact.review_results.required_output_fields.present === 10, artifact.review_results.required_output_fields);
check('all recordings covered', artifact.review_results.recording_coverage === '6/6', artifact.review_results.recording_coverage);
check('all pairings covered', artifact.review_results.pairing_coverage === '3/3', artifact.review_results.pairing_coverage);
check('candidate boundary kept', artifact.review_results.protocol_boundaries.candidate_not_rep_default_preserved === true, artifact.review_results.protocol_boundaries);
check('5fps only remains L1', artifact.review_results.protocol_boundaries.evidence_level_l1_only === true, artifact.review_results.protocol_boundaries);
check('30vs60 not established', artifact.review_results.protocol_boundaries.thirty_vs_sixty_not_established === true, artifact.review_results.protocol_boundaries);
check('no depth or quality overclaim', artifact.review_results.protocol_boundaries.true_depth_not_established === true && artifact.review_results.protocol_boundaries.movement_quality_not_inferred === true, artifact.review_results.protocol_boundaries);
check('weak pair qualified', artifact.review_results.protocol_boundaries.pair_02_05_not_claimed_synchronized === true, artifact.review_results.protocol_boundaries);
check('two repair defects explicit', artifact.review_results.defects.length === 2 && artifact.review_results.defects.every(x => x.severity === 'REPAIR_REQUIRED'), artifact.review_results.defects.map(x => x.id));
check('M02 not falsely accepted', artifact.decision.m02_acceptance === false && artifact.decision.status === 'C_REVIEW_COMPLETE_REPAIR_REQUIRED', artifact.decision);
check('strict count unchanged', artifact.decision.strict_before === '1/4' && artifact.decision.strict_after === '1/4' && artifact.decision.counting_decision === 'NO_COUNT_CHANGE', artifact.decision);
check('D independence protected', artifact.independence_guard.includes('must not be shown to D'), artifact.independence_guard);

const passed = checks.filter(x => x.pass).length;
console.log(JSON.stringify({ validator: 'TESTSET-01-M02-Q-C-ACCEPTANCE-AUDIT-VALIDATOR-V0.1', passed, total: checks.length, checks }, null, 2));
if (passed !== checks.length) process.exit(1);
