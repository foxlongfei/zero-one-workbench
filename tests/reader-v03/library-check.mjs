// Real-browser proof for the Standard Ebooks catalogue and multi-format import.
//
// It searches the live catalogue, imports the first result as EPUB and AZW3,
// opens the AZW3 in foliate-js, and verifies the book reached the local shelf.
// This test needs network access to standardebooks.org; it is not part of the
// deterministic local browser smoke test.
//
// Usage:
//   node tests/reader-v03/library-check.mjs --playwright=<path>
//   node tests/reader-v03/library-check.mjs --playwright=<path> --base-url=https://...

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const playwrightModule = await import(arg('playwright') || 'playwright');
const chromium = playwrightModule.chromium || playwrightModule.default?.chromium;
const baseArg = arg('base-url');
const PORT = 8794;
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

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
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
  await page.locator('header [data-nav="library"]').click();
  await page.waitForFunction(() => window.__rw03.library().loading === false && window.__rw03.library().results > 0, null, { timeout: 60000 });
  const popular = await page.evaluate(() => window.__rw03.library());
  check('popular public-domain catalogue loads', popular.results >= 12, JSON.stringify(popular));
  check('catalogue exposes EPUB and AZW3 actions', await page.locator('#libraryList .library-card').first().getByText('导入 EPUB').count() === 1
    && await page.locator('#libraryList .library-card').first().getByText('导入 AZW3').count() === 1);

  await page.locator('#librarySearch').fill('austen');
  await page.locator('#librarySearch').press('Enter');
  await page.waitForFunction(() => window.__rw03.library().loading === false && window.__rw03.library().results > 0, null, { timeout: 60000 });
  const card = page.locator('#libraryList .library-card').first();
  const title = (await card.locator('h3').innerText()).trim();
  check('keyword search returns a public-domain book', title.length > 0, title);

  await card.getByText('导入 EPUB').click();
  await page.waitForFunction(() => document.querySelectorAll('#shelf .book').length === 1, null, { timeout: 120000 });
  const firstFormat = await page.locator('#shelf .book').first().getAttribute('data-format');
  check('EPUB from Standard Ebooks is stored on the local shelf', firstFormat === 'EPUB', String(firstFormat));

  await page.locator('header [data-nav="library"]').click();
  await page.waitForFunction(() => window.__rw03.library().loading === false && window.__rw03.library().results > 0, null, { timeout: 60000 });
  await page.locator('#libraryList .library-card').first().getByText('导入 AZW3').click();
  await page.waitForFunction(() => document.querySelectorAll('#shelf .book').length === 2, null, { timeout: 120000 });
  const formats = await page.evaluate(() => [...document.querySelectorAll('#shelf .book')].map(book => book.dataset.format));
  check('AZW3 from Standard Ebooks is stored on the local shelf', formats.includes('AZW3'), JSON.stringify(formats));

  await page.locator('#shelf .book[data-format="AZW3"] [data-action="read"]').click();
  await page.waitForSelector('#screen-reader:not([hidden])', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('#chapterList button').length > 0, null, { timeout: 30000 });
  check('AZW3 opens in the reader through foliate-js', (await page.locator('#chapterList button').count()) > 0, await page.locator('#chapterList').innerText());
  check('reader does not report a load failure', !(await page.locator('#status').innerText()).includes('失败'), await page.locator('#status').innerText());
  check('no page errors during the library run', errors.length === 0, errors.join(' | '));
  await writeFile('artifacts/reader-v03/library-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, errors: errors.length }));
} catch (error) {
  evidence.status = 'FAIL';
  evidence.error = error.message;
  await writeFile('artifacts/reader-v03/library-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`).catch(() => {});
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, checks, errors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
  staticServer?.kill();
}
