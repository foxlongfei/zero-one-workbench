// Real-browser proof for the non-TXT formats that foliate-js supports.
//
// TXT/EPUB are covered by browser-check.mjs, AZW3 by library-check.mjs. This
// spec adds FB2 and CBZ fixtures plus a real Project Gutenberg MOBI download.
// The MOBI is fetched at test time and is not committed.
//
// Usage: node tests/reader-v03/formats-check.mjs --playwright=<path>

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const playwrightModule = await import(arg('playwright') || 'playwright');
const chromium = playwrightModule.chromium || playwrightModule.default?.chromium;
const PORT = 8795;
const staticServer = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const checks = [];
const errors = [];
const check = (name, ok, details = '') => {
  checks.push({ name, pass: Boolean(ok), details });
  if (!ok) throw new Error(`${name} failed: ${details}`);
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const evidence = { status: 'PASS', checks, errors };
try {
  await mkdir('artifacts/reader-v03', { recursive: true });
  const mobi = Buffer.from(await (await fetch('https://www.gutenberg.org/ebooks/11.kindle.images')).arrayBuffer());
  if (mobi.length < 10000) throw new Error('MOBI download failed');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/Failed to load resource|net::ERR/.test(text)) return;
    errors.push(`console: ${text}`);
  });
  await page.goto(`http://127.0.0.1:${PORT}/portal/reader-v03/index.html?testHooks=1`);
  await page.waitForSelector('#importButton:enabled', { timeout: 30000 });

  await page.locator('#files').setInputFiles(['morning.txt', 'quiet-house.epub', 'quiet-house.fb2', 'quiet-house.cbz']
    .map(file => resolve('tests/reader-v03/fixtures', file)));
  await page.waitForFunction(() => document.querySelectorAll('#shelf .book').length === 4, null, { timeout: 60000 });
  const formats = await page.evaluate(() => [...document.querySelectorAll('#shelf .book')].map(book => book.dataset.format));
  check('TXT/EPUB/FB2/CBZ all import', ['TXT', 'EPUB', 'FB2', 'CBZ'].every(format => formats.includes(format)), JSON.stringify(formats));
  check('CBZ listen action is disabled', await page.locator('#shelf .book[data-format="CBZ"] [data-action="listen"]').isDisabled());

  await page.locator('#shelf .book[data-format="FB2"] [data-action="read"]').click();
  await page.waitForSelector('#screen-reader:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('#chapterList button').length === 3, null, { timeout: 30000 });
  check('FB2 opens with its three chapters', (await page.locator('#chapterList button').count()) === 3, await page.locator('#chapterList').innerText());
  await page.locator('#backToShelf').click();

  await page.locator('#shelf .book[data-format="CBZ"] [data-action="read"]').click();
  await page.waitForSelector('#screen-reader:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('#chapterList button').length === 3, null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('页图像'), null, { timeout: 30000 });
  check('CBZ opens as image pages', (await page.locator('#status').innerText()).includes('页图像'), await page.locator('#status').innerText());
  await page.locator('#backToShelf').click();

  await page.locator('#files').setInputFiles({ name: 'alice.mobi', mimeType: 'application/x-mobipocket-ebook', buffer: mobi });
  await page.waitForFunction(() => document.querySelectorAll('#shelf .book').length === 5, null, { timeout: 30000 });
  await page.locator('#shelf .book[data-format="MOBI"] [data-action="read"]').click();
  await page.waitForSelector('#screen-reader:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('#chapterList button').length > 0, null, { timeout: 30000 });
  check('MOBI opens with chapters', (await page.locator('#chapterList button').count()) > 0, await page.locator('#chapterList').innerText());
  check('no page errors during the format run', errors.length === 0, errors.join(' | '));
  await writeFile('artifacts/reader-v03/formats-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, errors: errors.length, formats: [...formats, 'MOBI'] }));
} catch (error) {
  evidence.status = 'FAIL';
  evidence.error = error.message;
  await writeFile('artifacts/reader-v03/formats-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`).catch(() => {});
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, checks, errors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
  staticServer.kill();
}
