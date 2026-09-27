import fs from 'node:fs';

const file = new URL('./k02-03-hxl-nlc-qd-blind-package-v0.1.json', import.meta.url);
const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
const serialized = JSON.stringify(artifact);
const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });
const banned = [
  /"located_pdf_page"\s*:\s*101/,
  /"pdf_page"\s*:/,
  /待詔夏賀良/,
  /卒無嘉應/,
  /皆蠲除之/,
  /反道惑眾/,
  /right_leaf|left_leaf|右頁|左頁/,
  /anchor_transcription|continuation_transcription/
];

check('task id preserved', artifact.task_id === 'K02-03-HXL-01', artifact.task_id);
check('complete source URL present', artifact.source.original_file_url.endsWith('.pdf'), artifact.source.original_file_url);
check('source byte size frozen', artifact.source.byte_size === 43003180, artifact.source.byte_size);
check('source hash frozen', artifact.source.sha256 === 'e90deb0d7cb8828f4a252a5a4b846197c4c728b97a858ce56e5672a365f1bb40', artifact.source.sha256);
check('no page or quote leakage', banned.every(pattern => !pattern.test(serialized)), banned.filter(pattern => pattern.test(serialized)).map(String));
check('blindness contract explicit', artifact.blindness_contract.not_disclosed.length === 4, artifact.blindness_contract.not_disclosed);
check('Q return path distinct', artifact.return_schema.q_return_path.includes('-q-return-'), artifact.return_schema.q_return_path);
check('D return path distinct', artifact.return_schema.d_return_path.includes('-d-return-'), artifact.return_schema.d_return_path);
check('eleven return fields', artifact.return_schema.required_fields.length === 11, artifact.return_schema.required_fields.length);
check('independence freeze rule', artifact.blindness_contract.independence_rule.includes('both files are frozen'), artifact.blindness_contract.independence_rule);
check('strict state unchanged', artifact.acceptance.mainline_before === '0/5' && artifact.acceptance.mainline_after === '0/5', artifact.acceptance);
check('no false QD acceptance', artifact.acceptance.q_independent_return === false && artifact.acceptance.d_independent_return === false && artifact.acceptance.cross_review === false, artifact.acceptance);

const passed = checks.filter(x => x.pass).length;
console.log(JSON.stringify({ validator: 'K02-03-HXL-01-NLC-QD-BLIND-PACKAGE-VALIDATOR-V0.1', passed, total: checks.length, checks }, null, 2));
if (passed !== checks.length) process.exit(1);
