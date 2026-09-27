import fs from 'node:fs';

const fixtures = JSON.parse(fs.readFileSync(new URL('./image-role-cases.json', import.meta.url), 'utf8'));

function assess(input) {
  const roleEvidence = new Set(['EXPLICIT_FIGURE_LABEL', 'VISUAL_INSPECTION']);
  const assets = input.assets.map(asset => {
    const supported = roleEvidence.has(asset.role_evidence);
    return {
      asset_id: asset.asset_id,
      resolved_role: supported ? asset.claimed_role : 'UNKNOWN',
      status: supported ? 'SUPPORTED' : 'UNRESOLVED'
    };
  });
  const violations = input.assets
    .filter(asset => asset.claimed_role && !roleEvidence.has(asset.role_evidence))
    .map(() => 'IA-04');
  return { assets, violations };
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
