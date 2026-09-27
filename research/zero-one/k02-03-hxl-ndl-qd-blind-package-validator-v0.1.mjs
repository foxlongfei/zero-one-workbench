import fs from 'node:fs';
import process from 'node:process';

const file = new URL('./k02-03-hxl-ndl-qd-blind-package-v0.1.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const serialized = JSON.stringify(data);
const forbiddenKeys = ['expected_text', 'expected_page_side', 'expected_column_numbers', 'c_transcription', 'c_answer'];
const leakedTargetQuote = '初成帝時齊人甘忠可';
const checks = [
  ['original task id preserved', data.task_id === 'K02-03-HXL-01'],
  ['blind input role', data.package_role === 'BLIND_REVIEW_INPUT'],
  ['stable canvas fixed', data.input?.record_id === '774615' && data.input?.canvas === 18],
  ['image hash fixed', /^[0-9a-f]{64}$/.test(data.input?.image_sha256 ?? '')],
  ['Q return contract present', data.q_assignment?.must_return?.length >= 7],
  ['D attack contract present', data.d_assignment?.must_return?.length >= 7],
  ['returns freeze before cross review', data.freeze?.required_before_cross_review === true],
  ['no forbidden answer fields', forbiddenKeys.every(key => !Object.prototype.hasOwnProperty.call(data.input ?? {}, key) && !Object.prototype.hasOwnProperty.call(data, key))],
  ['target quote not leaked', !serialized.includes(leakedTargetQuote)],
  ['Q remains open', data.acceptance_state?.q_complete === false],
  ['D remains open', data.acceptance_state?.d_complete === false],
  ['strict count unchanged', data.acceptance_state?.strict_completed === 0 && data.acceptance_state?.strict_total === 5]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
console.log(`SUMMARY ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
