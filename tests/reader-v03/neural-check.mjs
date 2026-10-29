// Real-browser proof for the open-source neural voice and local voice training.
//
// It downloads the Piper Plus zs-v1 model from Hugging Face (first run only in
// the browser cache for that context), synthesises the demo voice, trains a
// voice from an authorised reference clip, speaks a test sentence through the
// trained embedding, then reads a book with the neural engine and reloads to
// prove the voice profile persists.
//
// Usage:
//   node tests/reader-v03/neural-check.mjs --playwright=<path>
//   node tests/reader-v03/neural-check.mjs --base-url=https://...
//
// The reference clip is the model publisher's Chinese sample. It is downloaded
// here for testing and is not committed to this repository.

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const playwrightModule = await import(arg('playwright') || 'playwright');
const chromium = playwrightModule.chromium || playwrightModule.default?.chromium;
const baseArg = arg('base-url');
const PORT = 8793;
const referenceUrl = 'https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan/resolve/main/releases/zs-v1/samples/zh-ft.wav';

let staticServer = null;
if (!baseArg) {
  staticServer = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
}
const baseUrl = baseArg || `http://127.0.0.1:${PORT}`;
const checks = [];
const errors = [];
const check = (name, ok, details = '') => {
  checks.push({ name, pass: Boolean(ok), details });
  if (!ok) throw new Error(`${name} failed: ${details}`);
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const evidence = { status: 'PASS', checks, errors, baseUrl };
try {
  await mkdir('artifacts/reader-v03', { recursive: true });
  const reference = Buffer.from(await (await fetch(referenceUrl)).arrayBuffer());
  if (reference.length < 10000) throw new Error('reference audio download failed');

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/Failed to load resource|net::ERR/.test(text)) return;
    errors.push(`console: ${text}`);
  });
  const started = Date.now();
  await page.goto(`${baseUrl}/portal/reader-v03/index.html?testHooks=1`);
  await page.waitForSelector('#importButton:enabled', { timeout: 30000 });
  const initial = await page.evaluate(() => window.__rw03.piper());
  check('demo neural voice is available without a download', initial.hasEmbedding === true && initial.voiceId === 'demo', JSON.stringify(initial));
  await page.locator('header [data-nav="voices"]').click();
  await page.waitForSelector('#screen-voices:not([hidden])');

  await page.locator('#piperLoad').click();
  await page.waitForFunction(() => window.__rw03.piper().loaded === true, null, { timeout: 240000 });
  const loaded = await page.evaluate(() => window.__rw03.piper());
  check('Piper Plus model loads in the browser', loaded.loaded === true, JSON.stringify(loaded));
  check('model load is reported to the user', (await page.locator('#piperStatus').innerText()).includes('就绪'), await page.locator('#piperStatus').innerText());

  await page.locator('#piperTest').click();
  await page.waitForFunction(() => document.querySelector('#piperTestResult')?.textContent.includes('试听完成'), null, { timeout: 180000 });
  check('demo neural voice synthesises in the browser', true);

  await page.locator('#piperConsent').check();
  await page.locator('#piperSpeaker').fill('测试家人');
  await page.locator('#piperRefFile').setInputFiles({ name: 'zh-reference.wav', mimeType: 'audio/wav', buffer: reference });
  await page.waitForFunction(() => !document.querySelector('#piperTrain')?.disabled, null, { timeout: 10000 });
  await page.locator('#piperTrain').click();
  await page.waitForFunction(() => window.__rw03.piper().voices === 1, null, { timeout: 240000 });
  await page.waitForFunction(() => document.querySelector('#piperTrainStatus')?.textContent.includes('参考音频只在本机'), null, { timeout: 240000 });
  const trained = await page.evaluate(() => window.__rw03.piper());
  check('authorised reference audio is trained into a local voice', trained.voices === 1 && trained.voiceId !== 'demo' && trained.hasEmbedding, JSON.stringify(trained));
  check('trained voice is listed in the UI', (await page.locator('#piperVoiceList').innerText()).includes('测试家人'), await page.locator('#piperVoiceList').innerText());

  await page.locator('header [data-nav="shelf"]').click();
  await page.locator('#emptyTrySample').click();
  await page.waitForFunction(() => document.querySelectorAll('#shelf .book').length === 1, null, { timeout: 30000 });
  await page.locator('#shelf .book [data-action="listen"]').click();
  await page.waitForFunction(() => document.querySelector('#playButton')?.dataset.state === 'speaking', null, { timeout: 180000 });
  await page.waitForFunction(() => (document.querySelector('#nowSentence')?.textContent || '').length > 5, null, { timeout: 180000 });
  check('the trained neural voice is used for reading', (await page.locator('#engineBadge').getAttribute('data-kind')) === 'piper', await page.locator('#engineBadge').innerText());
  await page.locator('#playButton').click();

  await page.reload();
  await page.waitForSelector('#importButton:enabled', { timeout: 30000 });
  const restored = await page.evaluate(() => window.__rw03.piper());
  check('trained voice survives a reload', restored.voices === 1 && restored.voiceId === trained.voiceId && restored.hasEmbedding, JSON.stringify(restored));
  check('no page errors during the neural run', errors.length === 0, errors.join(' | '));
  evidence.elapsedMs = Date.now() - started;
  await writeFile('artifacts/reader-v03/neural-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, errors: errors.length, elapsedMs: evidence.elapsedMs }));
} catch (error) {
  evidence.status = 'FAIL';
  evidence.error = error.message;
  await writeFile('artifacts/reader-v03/neural-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`).catch(() => {});
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, checks, errors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
  staticServer?.kill();
}
