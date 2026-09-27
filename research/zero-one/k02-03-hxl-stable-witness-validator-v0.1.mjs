import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync(new URL('./k02-03-hxl-stable-witness-registry-v0.1.json', import.meta.url), 'utf8'));
const errors = [];

if (registry.task_id !== 'K02-03-HXL-01') errors.push('task_id_changed');
if (registry.mainline_count_after !== '0/5') errors.push('premature_count_increment');
if (registry.counting_decision !== 'NO_COUNT_CHANGE') errors.push('counting_decision_invalid');
for (const target of ['漢書卷七十五／眭兩夏侯京翼李傳第四十五', '漢書卷十一／哀帝紀第十一']) {
  const witness = registry.witnesses.find((item) => item.target === target);
  if (!witness) errors.push(`missing_witness:${target}`);
  else {
    if (!witness.catalog_url.startsWith('https://')) errors.push(`missing_url:${witness.id}`);
    if (witness.page_locator !== 'PENDING') errors.push(`unverified_page_claim:${witness.id}`);
    if (!witness.required_anchor) errors.push(`missing_anchor_plan:${witness.id}`);
  }
}
if (!registry.acceptance_gate.prohibited_until_pass.includes('count_as_1_of_5')) errors.push('acceptance_gate_missing');

console.log(JSON.stringify({
  validator: 'K02-03-HXL-STABLE-WITNESS-VALIDATOR-V0.1',
  checks: 10,
  passed: 10 - errors.length,
  failed: errors.length,
  errors,
  status: errors.length ? 'FAIL' : 'PASS_PAGE_ANCHORS_PENDING'
}, null, 2));

if (errors.length) process.exit(1);
