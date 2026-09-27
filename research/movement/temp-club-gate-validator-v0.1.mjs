import fs from 'node:fs';

const cases = JSON.parse(fs.readFileSync(new URL('./temp-club-gate-cases-v0.1.json', import.meta.url), 'utf8'));
const required = ['age_band', 'practice_level', 'readiness', 'qualified_educator', 'pathway_tier'];
const forbiddenSole = new Set(['age_band', 'club_label', 'competition_result', 'elite_squad_status']);

function evaluate(input) {
  if (forbiddenSole.has(input.sole_basis)) return 'REJECT';
  if (input.pathway_tier !== 'community') return 'REJECT';
  return required.every((field) => Object.hasOwn(input, field)) ? 'ACCEPT' : 'REJECT';
}

const results = cases.map((item) => ({id: item.id, expected: item.expected, actual: evaluate(item.input)}));
const mismatches = results.filter((item) => item.expected !== item.actual);
console.log(JSON.stringify({
  validator: 'TEMP-CLUB-GATE-VALIDATOR-V0.1',
  total: results.length,
  accepted: results.filter((item) => item.actual === 'ACCEPT').length,
  rejected: results.filter((item) => item.actual === 'REJECT').length,
  mismatches: mismatches.length,
  results
}, null, 2));

if (mismatches.length) process.exit(1);
