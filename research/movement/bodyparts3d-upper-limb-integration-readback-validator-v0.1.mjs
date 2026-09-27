import fs from 'node:fs';
import process from 'node:process';

const file = new URL('./bodyparts3d-upper-limb-integration-readback-v0.1.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const totals = data.controlled_assets.reduce((sum, x) => sum + x.bytes, 0);
const ids = data.controlled_assets.map(x => x.element_id).sort().join(',');
const checks = [
  ['page is V0.7', data.page?.version === 'V0.7'],
  ['five controlled assets', data.controlled_assets?.length === 5],
  ['expected element ids', ids === 'FJ1478,FJ1512,FJ3349,FJ3368,FJ3391'],
  ['asset bytes reconcile', totals === 620332],
  ['asset hashes valid', data.controlled_assets.every(x => /^[0-9a-f]{64}$/.test(x.sha256))],
  ['static fallback hash valid', /^[0-9a-f]{64}$/.test(data.static_fallback?.sha256 ?? '')],
  ['fallback derived from verified objs', data.static_fallback?.generated_directly_from_verified_objs === true],
  ['public static image visible', data.public_readback?.static_fallback_image_visible === true],
  ['integration verified', data.gates?.INTEGRATION_VERIFIED === true],
  ['display mode bounded', data.gates?.DISPLAY_VERIFIED === true && data.gates?.DISPLAY_MODE === 'STATIC_FALLBACK'],
  ['interactive WebGL not overclaimed', data.gates?.INTERACTIVE_WEBGL_VERIFIED === false && data.public_readback?.interactive_rotation_verified === false],
  ['strict count unchanged', data.task_state?.strict_completed === 1 && data.task_state?.strict_total === 4]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
console.log(`SUMMARY ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
