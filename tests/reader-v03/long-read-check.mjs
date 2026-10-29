// Deterministic long-form reading check: 24 short chapters, book-style TOC,
// continuous playback across the last three chapters, and audio/text sync.
// Uses the offline tone engine (?ttsTone=1), so no network or model download.

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const playwrightModule = await import(arg('playwright') || 'playwright');
const chromium = playwrightModule.chromium || playwrightModule.default?.chromium;
const PORT = 8796;
const staticServer = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const checks = [];
const errors = [];
const check = (name, ok, details = '') => {
  checks.push({ name, pass: Boolean(ok), details });
  if (!ok) throw new Error(`${name} failed: ${details}`);
};

const chapters = Array.from({ length: 24 }, (_, index) => {
  const n = index + 1;
  return `第${n}章 长书第${n}章\n这是第${n}章的第一句正文。\n这是第${n}章的第二句正文。`;
});
const buffer = Buffer.from(chapters.join('\n\n'), 'utf8');

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const evidence = { status: 'PASS', checks, errors };
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
  await page.goto(`http://127.0.0.1:${PORT}/portal/reader-v03/index.html?ttsTone=1&testHooks=1`);
  await page.waitForSelector('#importButton:enabled', { timeout: 30000 });
  await page.locator('#files').setInputFiles({ name: 'long-book.txt', mimeType: 'text/plain', buffer });
  await page.waitForFunction(() => document.querySelectorAll('#shelf .book').length === 1, null, { timeout: 30000 });
  await page.locator('#shelf .book [data-action="read"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#chapterList button').length === 24, null, { timeout: 30000 });
  check('a 24-chapter book opens as a long book', (await page.locator('#chapterList button').count()) === 24);

  await page.locator('#tocToggle').click();
  check('book-style TOC lists all 24 chapters', (await page.locator('#tocDialogList button').count()) === 24);
  await page.locator('#tocDialogList button').nth(20).click();
  await page.waitForFunction(() => document.querySelector('#nowChapter')?.textContent.includes('第21章'), null, { timeout: 15000 });
  check('TOC jump lands on chapter 21', (await page.locator('#nowChapter').innerText()).includes('第21章'), await page.locator('#nowChapter').innerText());

  await page.locator('#readWholeBook').click();
  await page.waitForFunction(() => window.__rw03.engineState() === 'speaking', null, { timeout: 15000 });
  await page.waitForFunction(() => window.__rw03.sync()?.chapter === 21, null, { timeout: 30000 });
  check('long-form playback starts and synchronises text', (await page.evaluate(() => window.__rw03.sync())).chapter === 21);
  await page.waitForFunction(() => window.__rw03.engineState() === 'ended', null, { timeout: 90000 });
  const sync = await page.evaluate(() => window.__rw03.sync());
  check('continuous playback crosses to the last chapter', sync?.chapter === 23, JSON.stringify(sync));
  check('finishing the book is reported', (await page.locator('#status').innerText()).includes('这本书已经读完了'), await page.locator('#status').innerText());
  check('reading progress bar is filled', await page.locator('#readProgress').evaluate(el => parseFloat(el.style.width) > 90), await page.locator('#readProgress').getAttribute('style'));
  check('no page errors during long-form reading', errors.length === 0, errors.join(' | '));
  await writeFile('artifacts/reader-v03/long-read-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, errors: errors.length }));
} catch (error) {
  evidence.status = 'FAIL';
  evidence.error = error.message;
  await writeFile('artifacts/reader-v03/long-read-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`).catch(() => {});
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, checks, errors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
  staticServer.kill();
}
