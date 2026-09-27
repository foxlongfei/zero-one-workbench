import fs from 'node:fs';
import assert from 'node:assert/strict';

const file = process.argv[2] || new URL('./bodyparts3d-upper-limb-asset-map-v0.1.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const expected = new Map([
  ['HUMERUS_RIGHT', ['FMA23130', 'BP9206']],
  ['RADIUS_RIGHT', ['FMA23464', 'BP8464']],
  ['ULNA_RIGHT', ['FMA23467', 'BP8233']],
  ['BICEPS_SHORT_HEAD_RIGHT', ['FMA37684', 'BP5558']],
  ['BICEPS_LONG_HEAD_RIGHT', ['FMA37686', 'BP5566']]
]);

const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };
check('official-release-and-archive', () => {
  assert.equal(data.source.name, 'BodyParts3D Release 4.0');
  assert.equal(data.source.mesh_archive, 'isa_BP3D_4.0_obj_99.zip');
});
check('exact-license', () => {
  assert.equal(data.license.spdx, 'CC-BY-4.0');
  assert.match(data.license.required_attribution, /^BodyParts3D,/);
  assert.equal(data.license.verified, true);
});
check('five-required-targets', () => assert.equal(data.targets.length, expected.size));
for (const [role, [fma, bp]] of expected) {
  check(role, () => {
    const item = data.targets.find((x) => x.role === role);
    assert.ok(item);
    assert.equal(item.fma_id, fma);
    assert.equal(item.representation_id, bp);
  });
}
check('no-duplicate-identifiers', () => {
  assert.equal(new Set(data.targets.map((x) => x.fma_id)).size, data.targets.length);
  assert.equal(new Set(data.targets.map((x) => x.representation_id)).size, data.targets.length);
});
check('two-head-biceps-rule', () => {
  assert.ok(data.targets.some((x) => x.role === 'BICEPS_SHORT_HEAD_RIGHT'));
  assert.ok(data.targets.some((x) => x.role === 'BICEPS_LONG_HEAD_RIGHT'));
  assert.match(data.modeling_rule, /长头与短头/);
});
check('integration-display-remain-open', () => {
  assert.deepEqual(data.gates, {
    SOURCE_VERIFIED: true,
    LICENSE_VERIFIED: true,
    INTEGRATION_VERIFIED: false,
    DISPLAY_VERIFIED: false
  });
});

console.log(JSON.stringify({status:'PASS', passed:checks.length, checks}, null, 2));
