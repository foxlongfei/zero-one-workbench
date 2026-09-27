import fs from 'node:fs';

const file = new URL('./k02-03-hxl-source-anchor-audit-v0.1.json', import.meta.url);
const audit = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];

if (audit.task_id !== 'K02-03-HXL-01') errors.push('task_id_changed');
if (audit.mainline_count_after !== '0/5') errors.push('premature_count_increment');
if (audit.counting_decision !== 'NO_COUNT_CHANGE') errors.push('counting_decision_invalid');
for (const id of ['A01_IDENTITY', 'A02_PROPOSAL_AND_ADOPTION', 'A03_EXPLICIT_FAILURE', 'A04_REVERSAL_AND_SANCTION', 'A05_PROVENANCE_BOUNDARY']) {
  const check = audit.checks.find((item) => item.id === id);
  if (!check || check.result !== 'PASS' || check.evidence.length < 1) errors.push(`missing_or_failed:${id}`);
}
const editable = audit.checks.find((item) => item.id === 'A06_TEXTUAL_EDITABILITY');
if (!editable || editable.result !== 'OPEN') errors.push('editable_witness_risk_not_open');
if (!audit.acceptance_gate.prohibited_until_pass.includes('count_as_1_of_5')) errors.push('acceptance_gate_missing');

console.log(JSON.stringify({
  validator: 'K02-03-HXL-ANCHOR-VALIDATOR-V0.1',
  checks: 9,
  passed: 9 - errors.length,
  failed: errors.length,
  errors,
  status: errors.length ? 'FAIL' : 'PASS_PENDING_INDEPENDENT_QD'
}, null, 2));

if (errors.length) process.exit(1);
