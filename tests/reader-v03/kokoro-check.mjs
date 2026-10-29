// Real-browser proof for the Kokoro-82M-v1.1-zh natural Chinese voice.
//
// Downloads the quantized model from Hugging Face (first run only), switches
// the reader to the Kokoro engine, selects a v1.1 speaker and synthesises a
// sentence entirely in the browser. This is deliberately a separate check so
// the fast browser suite never downloads ~90 MB.
//
// Usage: node tests/reader-v03/kokoro-check.mjs --playwright=<path>

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const playwrightModule = await import(arg('playwright') || 'playwright');
const chromium = playwrightModule.chromium || playwrightModule.default?.chromium;
const PORT = 8795;
const baseArg = arg('base-url');
let server = null;
if (!baseArg) {
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/Failed to load resource|net::ERR/.test(text)) return;
    errors.push(`console: ${text}`);
  });
  await page.goto(`${baseUrl}/portal/reader-v03/index.html?testHooks=1`);
  await page.waitForSelector('#importButton:enabled', { timeout: 30000 });
  check('the reader offers the Kokoro engine', (await page.locator('#engineSelect').innerText()).includes('Kokoro'));
  await page.locator('header [data-nav="voices"]').click();
  await page.waitForSelector('#screen-voices:not([hidden])');
  await page.locator('#kokoroLoad').click();
  await page.waitForFunction(() => window.__rw03.kokoro().loaded === true, null, { timeout: 300000 });
  const loaded = await page.evaluate(() => window.__rw03.kokoro());
  check('Kokoro v1.1-zh model loads in the browser', loaded.loaded === true && loaded.voices >= 8, JSON.stringify(loaded));
  check('model load is reported to the user', (await page.locator('#kokoroStatus').innerText()).includes('就绪'), await page.locator('#kokoroStatus').innerText());
  await page.locator('#kokoroVoiceSelect').selectOption('zm_010');
  check('a male v1.1 voice can be selected', (await page.evaluate(() => window.__rw03.kokoro().voiceId)) === 'zm_010');
  await page.locator('#kokoroTest').click();
  await page.waitForFunction(() => document.querySelector('#kokoroTestResult')?.textContent.includes('试听完成'), null, { timeout: 300000 });
  check('Kokoro synthesises Chinese in the browser', (await page.locator('#kokoroTestResult').innerText()).includes('Kokoro'), await page.locator('#kokoroTestResult').innerText());
  await page.locator('#voiceEngineSelect').selectOption('kokoro');
  check('the reading panel exposes the Kokoro voice picker', await page.evaluate(() => document.getElementById('fieldReaderKokoroVoice').hidden === false));
  check('no page errors during the Kokoro run', errors.length === 0, errors.join(' | '));
} catch (error) {
  evidence.status = 'FAIL';
  evidence.error = error.message;
  throw error;
} finally {
  await writeFile('artifacts/reader-v03/kokoro-evidence.json', JSON.stringify(evidence, null, 2));
  await browser.close();
  server?.kill();
}
console.log(JSON.stringify({ status: evidence.status, checks: checks.length, errors: errors.length }));
