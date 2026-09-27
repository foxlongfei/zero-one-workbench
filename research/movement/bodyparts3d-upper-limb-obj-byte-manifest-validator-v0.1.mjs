import fs from 'node:fs';
import process from 'node:process';

const file = new URL('./bodyparts3d-upper-limb-obj-byte-manifest-v0.1.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const ids = data.objects.map(x => x.element_id).sort().join(',');
const sums = data.objects.reduce((a, x) => ({bytes:a.bytes+x.bytes, vertices:a.vertices+x.vertices, faces:a.faces+x.faces}), {bytes:0, vertices:0, faces:0});
const checks = [
  ['five official members', data.objects.length === 5],
  ['expected FJ ids', ids === 'FJ1478,FJ1512,FJ3349,FJ3368,FJ3391'],
  ['all hashes valid', data.objects.every(x => /^[0-9a-f]{64}$/.test(x.sha256))],
  ['all byte counts positive', data.objects.every(x => x.bytes > 0)],
  ['byte total reconciles', sums.bytes === 620332 && data.totals.bytes === sums.bytes],
  ['vertex total reconciles', sums.vertices === 5913 && data.totals.vertices === sums.vertices],
  ['face total reconciles', sums.faces === 8572 && data.totals.faces === sums.faces],
  ['source verified', data.gates.SOURCE_VERIFIED === true],
  ['license verified', data.gates.LICENSE_VERIFIED === true],
  ['byte extraction verified', data.gates.BYTE_EXTRACTION_VERIFIED === true],
  ['integration stays open', data.gates.INTEGRATION_VERIFIED === false],
  ['display stays open', data.gates.DISPLAY_VERIFIED === false]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
console.log(`SUMMARY ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
