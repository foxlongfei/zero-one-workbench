import fs from 'node:fs';
import assert from 'node:assert/strict';

const file = process.argv[2] || new URL('./k02-03-hxl-ndl-canvas-boundary-v0.1.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check('task-id-preserved', () => assert.equal(data.task_id, 'K02-03-HXL-01'));
check('manifest-bound', () => {
  assert.equal(data.source.bib_id, '774615');
  assert.equal(data.source.canvas_count, 74);
  assert.match(data.source.manifest_sha256, /^[0-9a-f]{64}$/);
});
check('volume-boundary', () => {
  assert.equal(data.volume_boundary.first_canvas, 2);
  assert.equal(data.volume_boundary.last_canvas, 13);
  assert.equal(data.volume_boundary.next_volume_first_canvas, 14);
});
check('candidate-not-promoted', () => {
  assert.equal(data.target_passage.exact_canvas_verified, false);
  assert.deepEqual(data.target_passage.candidate_set, [12, 13]);
});
check('strict-count-unchanged', () => assert.equal(data.acceptance.mainline_count, '0/5'));
check('independent-review-open', () => assert.equal(data.acceptance.independent_qd_required, true));
check('nlc-anchor-open', () => assert.equal(data.acceptance.nlc_382411_page_anchor_pending, true));

console.log(JSON.stringify({status:'PASS', passed:checks.length, checks}, null, 2));
