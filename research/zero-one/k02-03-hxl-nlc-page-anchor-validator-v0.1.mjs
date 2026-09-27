import fs from 'node:fs';
import crypto from 'node:crypto';

const artifactPath = new URL('./k02-03-hxl-nlc-page-anchor-v0.1.json', import.meta.url);
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });

check('task id preserved', artifact.task_id === 'K02-03-HXL-01', artifact.task_id);
check('source byte size captured', artifact.source.byte_size === 43003180, artifact.source.byte_size);
check('source sha256 shape', /^[a-f0-9]{64}$/.test(artifact.source.sha256), artifact.source.sha256);
check('page anchor exact', artifact.anchor.pdf_page === 101, artifact.anchor.pdf_page);
check('render dimensions captured', artifact.anchor.page_render.width_px === 4117 && artifact.anchor.page_render.height_px === 3139, artifact.anchor.page_render);
check('June decree present', artifact.anchor.right_leaf.anchor_transcription.includes('六月甲子制書非赦令也'), '六月甲子制書非赦令也');
check('August revocation present', artifact.anchor.right_leaf.anchor_transcription.includes('八月詔曰') && artifact.anchor.right_leaf.anchor_transcription.includes('皆蠲除之'), '八月詔曰…皆蠲除之');
check('failure wording preserved', artifact.anchor.right_leaf.anchor_transcription.includes('卒無嘉應'), '卒無嘉應');
check('judicial continuation preserved', artifact.anchor.left_leaf.continuation_transcription.includes('反道惑眾') && artifact.anchor.left_leaf.continuation_transcription.includes('皆伏辜'), artifact.anchor.left_leaf.continuation_transcription);
check('variant boundary preserved', artifact.comparison_notes.some(x => x.includes('待詔夏賀良等')), '待詔夏賀良等');
check('independent roles remain false', artifact.acceptance.q_independent_return === false && artifact.acceptance.d_independent_return === false && artifact.acceptance.cross_review === false, artifact.acceptance);
check('strict count unchanged', artifact.acceptance.mainline_before === '0/5' && artifact.acceptance.mainline_after === '0/5' && artifact.acceptance.counting_decision === 'NO_COUNT_CHANGE', artifact.acceptance);

const passed = checks.filter(x => x.pass).length;
const result = { validator: 'K02-03-HXL-01-NLC-PAGE-ANCHOR-VALIDATOR-V0.1', passed, total: checks.length, checks };
console.log(JSON.stringify(result, null, 2));
if (passed !== checks.length) process.exit(1);
