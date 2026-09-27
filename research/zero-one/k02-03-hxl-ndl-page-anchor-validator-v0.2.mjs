import fs from 'node:fs';
import process from 'node:process';

const file = new URL('./k02-03-hxl-ndl-page-anchor-v0.2.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const checks = [
  ['task id preserved', data.task_id === 'K02-03-HXL-01'],
  ['record is NDL 774615', data.source?.record_id === '774615'],
  ['canvas 18 anchored', data.target_anchor?.canvas === 18],
  ['image hash is sha256', /^[0-9a-f]{64}$/.test(data.target_anchor?.local_capture_sha256 ?? '')],
  ['image byte count positive', data.target_anchor?.local_capture_bytes === 1408306],
  ['volume 75 reaches canvas 20', data.volume_boundary?.last_canvas_with_volume_content === 20],
  ['transition recorded on canvas 20', data.volume_boundary?.transition_canvas === 20],
  ['C anchor found', data.acceptance?.c_anchor_found === true],
  ['Q remains open', data.acceptance?.q_independent_check === false],
  ['D remains open', data.acceptance?.d_independent_check === false],
  ['NLC remains open', data.acceptance?.nlc_gate === false],
  ['strict count unchanged', data.acceptance?.strict_completed === 0 && data.acceptance?.strict_total === 5]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
console.log(`SUMMARY ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
