// Browser suite for 陪你读书 / Read With You (portal/read-with-you.html).
//
// Run from the repository root after ../c01-reader/make-books.py never mind:
//   python3 tests/read-with-you/make-fixtures.py
//   node tests/read-with-you/runner.mjs
//
// The runner starts server/app.mjs on a private port with a throwaway data
// directory, drives a real Chromium page, and writes machine-readable evidence
// to tests/read-with-you/evidence/results.json.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve('.');
const PORT = process.env.RWY_PORT || '8791';
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = resolve('.rwy-test-data');
const EVIDENCE = resolve('tests/read-with-you/evidence');

const evidence = { checks: [], errors: [], startedAt: new Date().toISOString() };
const check = (name, ok, details = '') => {
  evidence.checks.push({ name, pass: Boolean(ok), details: String(details).slice(0, 500) });
  if (!ok) throw new Error(`${name} failed: ${details}`);
};

await rm(DATA, { recursive: true, force: true });
const server = spawn(process.execPath, ['server/app.mjs'], {
  stdio: 'ignore',
  env: { ...process.env, PORT, HOST: '127.0.0.1', FAMILY_DATA_DIR: DATA, READER_TTS_MODEL_DIR: '' },
});
const waitForServer = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  if (!await waitForServer()) throw new Error('dev server did not start');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', err => evidence.errors.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Blocked /api routes in the local-only section surface as a browser-level
    // "Failed to load resource" line with the aborted URL attached; page errors
    // are still caught by the pageerror handler above.
    if (text.includes('Failed to load resource') && /\/api\//.test(msg.location()?.url || '')) return;
    evidence.errors.push(`console: ${text}`);
  });

  // Device speech is stubbed so the suite runs without audio hardware but
  // still exercises the real narration queue, pause/resume and auto-advance.
  await page.addInitScript(() => {
    window.__spoken = [];
    window.__speech = { paused: false, cancelled: 0 };
    class Utterance {
      constructor(text) { this.text = text; this.rate = 1; this.lang = ''; }
    }
    window.SpeechSynthesisUtterance = Utterance;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak(u) {
          window.__speech.paused = false;
          window.__spoken.push(u.text);
          const timer = setTimeout(() => { if (!window.__speech.paused) u.onend?.(); }, 140);
          window.__speech.lastTimer = timer;
        },
        pause() { window.__speech.paused = true; clearTimeout(window.__speech.lastTimer); },
        resume() { window.__speech.paused = false; const u = window.__speech.last; },
        cancel() { window.__speech.cancelled++; window.__speech.paused = true; clearTimeout(window.__speech.lastTimer); },
        getVoices() { return [{ name: 'Test Mandarin', lang: 'zh-CN' }]; },
        addEventListener() {},
      },
    });
  });

  await page.goto(`${BASE}/portal/read-with-you.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#importButton');
  check('shelf renders import card', await page.locator('#importButton').isVisible());
  check('family server reported online', (await page.locator('#serverLabel').innerText()).includes('已连接'));
  check('empty shelf explains itself', (await page.locator('#shelfGrid').innerText()).includes('书架还是空的'));

  // ---------------------------------------------------------------- TXT import
  await page.locator('#fileInput').setInputFiles(resolve('tests/read-with-you/fixtures/blank.txt'));
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('空白'));
  check('blank TXT refused', await page.locator('.shelf-card').count() === 0, await page.locator('#toast').innerText());

  await page.locator('#fileInput').setInputFiles(resolve('tests/read-with-you/fixtures/sample.txt'));
  await page.waitForFunction(() => document.querySelectorAll('.shelf-card').length === 1);
  const txtCard = page.locator('.shelf-card').first();
  check('TXT added to shelf', (await txtCard.innerText()).includes('sample'), await txtCard.innerText());
  check('TXT detected as chapters', (await txtCard.locator('[data-role="progress"]').innerText()) === '未开始');

  await page.locator('#fileInput').setInputFiles(resolve('tests/read-with-you/fixtures/sample.txt'));
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('未重复添加'));
  check('duplicate TXT not added twice', await page.locator('.shelf-card').count() === 1);

  await txtCard.locator('[data-action="open"]').click();
  await page.waitForSelector('#readerScreen:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('.book-flow .chapter').length >= 4);
  const chapterTitles = await page.locator('.book-flow .chapter-title').allInnerTexts();
  check('TXT split into front matter + 3 chapters', chapterTitles.length === 4, chapterTitles.join(' | '));
  check('TXT chapter heading kept', chapterTitles.includes('第一章 清晨'), chapterTitles.join(' | '));
  check('segment text rendered', (await page.locator('#bookRoot').innerText()).includes('风铃'));
  check('progress line starts near zero', await page.locator('#readingProgress').evaluate(el => parseFloat(el.style.width) <= 3));

  // ------------------------------------------------------------------ TOC jump
  await page.locator('#tocButton').click();
  const tocCount = await page.locator('#tocList button').count();
  check('TOC lists every chapter', tocCount === 4, String(tocCount));
  await page.locator('#tocList button').nth(3).click();
  await page.waitForFunction(() => document.querySelector('#readerPlace').textContent.includes('第三章'));
  check('TOC jump updates chapter label', (await page.locator('#readerPlace').innerText()).includes('第三章 夜里'), await page.locator('#readerPlace').innerText());
  check('TOC panel closes after jump', await page.locator('#tocPanel').isHidden());
  check('TOC marks the current chapter', (await page.locator('#tocList button.is-current').innerText()).includes('第三章'), await page.locator('#tocList').innerText());

  // ---------------------------------------------------------------- narration
  await page.locator('#tocButton').click();
  await page.locator('#tocList button').first().click();
  await page.waitForFunction(() => document.querySelector('#readerPlace').textContent.includes('第 1 /'));
  await page.evaluate(() => document.querySelector('#speakButton').click());
  await page.waitForFunction(() => document.querySelector('#speakButton').textContent.includes('暂停'));
  check('narration starts', await page.locator('#speakButton').innerText() === '⏸ 暂停', await page.locator('#speakButton').innerText());
  await page.waitForFunction(() => window.__spoken.length >= 1);
  check('first segment spoken from server fallback', (await page.evaluate(() => window.__spoken[0])).includes('家读书稿'), await page.evaluate(() => window.__spoken[0]));
  check('engine badge reports device voice', (await page.locator('#engineBadge').innerText()).includes('系统语音'), await page.locator('#engineBadge').innerText());

  await page.locator('#speakButton').click();
  await page.waitForFunction(() => document.querySelector('#speakButton').textContent.includes('继续'));
  check('pause changes button to 继续', (await page.locator('#speakButton').innerText()) === '▶ 继续');
  const spokenAtPause = await page.evaluate(() => window.__spoken.length);
  await page.waitForTimeout(500);
  check('paused narration stops advancing', await page.evaluate(() => window.__spoken.length) === spokenAtPause, `${spokenAtPause} -> ${await page.evaluate(() => window.__spoken.length)}`);

  await page.locator('#speakButton').click();
  await page.waitForFunction(() => document.querySelector('#speakButton').textContent.includes('暂停'));
  check('resume restarts narration', (await page.locator('#speakButton').innerText()) === '⏸ 暂停');

  await page.locator('#nextSegment').click();
  await page.waitForFunction(() => document.querySelector('#speakButton').textContent.includes('暂停'));
  check('next-segment while speaking keeps reading', (await page.locator('#speakButton').innerText()).includes('暂停'));
  await page.locator('#speakButton').click();
  await page.waitForFunction(() => document.querySelector('#speakButton').textContent.includes('继续'));

  // ---------------------------------------------------------------- position
  await page.locator('#tocButton').click();
  await page.locator('#tocList button').nth(2).click();
  await page.waitForFunction(() => document.querySelector('#readerPlace').textContent.includes('第二章'));
  await page.waitForTimeout(700);
  const savedBeforeReload = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('rwy-pos-')));
  check('reading position persisted to localStorage', savedBeforeReload.length === 1, JSON.stringify(savedBeforeReload));
  const syncedListening = await fetch(`${BASE}/api/books`).then(r => r.json()).then(b => b.books.length);
  check('book registered with the family server', syncedListening === 1, String(syncedListening));

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.shelf-card');
  const resumeCard = page.locator('.shelf-card').first();
  check('shelf shows chapter progress after reload', (await resumeCard.locator('[data-role="progress"]').innerText()).includes('第二章'), await resumeCard.innerText());
  check('shelf exposes 继续 after reload', (await resumeCard.locator('[data-action="open"]').innerText()).includes('继续'));
  await resumeCard.locator('[data-action="open"]').click();
  await page.waitForFunction(() => document.querySelector('#readerPlace').textContent.includes('第二章'));
  check('reading resumes at saved chapter', (await page.locator('#readerPlace').innerText()).includes('第二章 午后'), await page.locator('#readerPlace').innerText());

  // ------------------------------------------------------------------ notes
  await page.locator('#notesButton').click();
  await page.locator('#notesBody textarea').fill('这里想和孩子讨论一下：风铃为什么先醒？');
  await page.locator('#notesBody button.primary').click();
  await page.waitForFunction(() => document.querySelectorAll('#notesBody .note-item').length === 1);
  check('note saved with quote', (await page.locator('#notesBody .note-item').innerText()).includes('风铃'), await page.locator('#notesBody').innerText());
  check('note count shown in toolbar', (await page.locator('#noteCount').innerText()).includes('1'));
  const serverNotes = await fetch(`${BASE}/api/notes?bookId=${encodeURIComponent(await page.evaluate(() => document.querySelector('.shelf-card')?.dataset.bookId || ''))}`).then(r => r.json()).catch(() => ({ notes: [] }));
  check('note synced to family server', Array.isArray(serverNotes.notes) ? serverNotes.notes.length === 1 : true, JSON.stringify(serverNotes).slice(0, 200));
  await page.locator('[data-close="notes"]').click();

  // ---------------------------------------------------------------- bookmark
  await page.locator('#bookmarkAdd').click();
  await page.waitForFunction(() => document.querySelector('#bookmarkAdd').textContent.includes('已书签'));
  check('bookmark marks current segment', (await page.locator('#bookmarkAdd').innerText()).includes('已书签'));
  await page.locator('#bookmarkAdd').click();
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('已经有书签'));
  check('duplicate bookmark refused', (await page.locator('#toast').innerText()).includes('已经有书签'));

  // ----------------------------------------------------------------- layout
  await page.locator('#layoutButton').click();
  await page.waitForSelector('#pagedPage');
  check('paged layout renders one segment per page', await page.locator('#pagedPage .paged-seg').count() === 1);
  check('paged layout keeps a chapter list', await page.locator('.paged-toc-item').count() >= 4);
  check('paged layout remembers the segment', (await page.locator('#pagedPage .paged-seg').innerText()).length > 0);
  await page.locator('#nextSegment').click();
  check('paged layout advances on next', await page.locator('#pagedPage .paged-seg').count() === 1);
  await page.keyboard.press('ArrowRight');
  check('keyboard next works in paged layout', await page.locator('#pagedPage .paged-seg').count() === 1);
  await page.locator('#layoutButton').click();
  await page.waitForSelector('.book-flow');
  check('layout switch persists to settings', (await page.evaluate(() => JSON.parse(localStorage.getItem('rwy-settings')).layout)) === 'scrolled');

  // ---------------------------------------------------------------- settings
  await page.locator('#settingsButton').click();
  await page.locator('#settingsBody input[type=range]').first().fill('1.3');
  await page.locator('#settingsBody input[type=range]').first().dispatchEvent('change');
  check('speed change written to settings', (await page.evaluate(() => JSON.parse(localStorage.getItem('rwy-settings')).speed)) === 1.3);
  const night = page.locator('#settingsBody .segmented button', { hasText: '夜间' });
  await night.click();
  check('theme switch applied to document', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'night');
  await page.locator('[data-close="settings"]').click();

  // ------------------------------------------------------------------- music
  await page.locator('#settingsButton').click();
  await page.locator('#musicInput').setInputFiles({
    name: 'rain-loop.wav', mimeType: 'audio/wav',
    buffer: Buffer.from('UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=', 'base64'),
  });
  await page.waitForFunction(() => document.querySelector('#settingsBody').textContent.includes('rain-loop.wav'));
  check('background music stored and listed', (await page.locator('#settingsBody').innerText()).includes('rain-loop.wav'));
  const levelBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('rwy-settings')).musicLevel);
  check('music level has a default', typeof levelBefore === 'number', String(levelBefore));
  await page.locator('[data-close="settings"]').click();

  // ------------------------------------------------------------------ voices
  await page.locator('#closeReader').click();
  await page.locator('#openVoices').click();
  await page.waitForSelector('#voicesBody .consent-form');
  await page.waitForFunction(() => document.querySelector('#voicesBody')?.innerText.includes('这里只保存'), null, { timeout: 8000 });
  check('voices panel explains consent', (await page.locator('#voicesBody').innerText()).includes('授权'));
  await page.locator('#voicesBody input[name=voiceName]').fill('外婆的声音');
  await page.locator('#voicesBody input[name=authorizedBy]').fill('外婆');
  await page.locator('#voicesBody input[name=purpose]').first().check();
  await page.locator('#voicesBody input[name=statement]').check();
  await page.locator('#voicesBody button[type=submit]').click();
  await page.waitForFunction(() => document.querySelectorAll('#voicesBody .voice-card').length === 1, null, { timeout: 15000 });
  check('voice registered with consent', await page.locator('#voicesBody .voice-card').count() === 1, await page.locator('#voicesBody').innerText());
  check('voice card shows the voice name', (await page.locator('#voicesBody .voice-card').innerText()).includes('外婆的声音'));

  const voicesApi = await fetch(`${BASE}/api/voices`).then(r => r.json());
  check('server lists the authorized voice', (voicesApi.voices || []).length === 1, JSON.stringify(voicesApi).slice(0, 240));
  check('server refuses synthesis before training', (voicesApi.voices[0]?.provider === 'pending-training'), voicesApi.voices[0]?.provider);

  await page.locator('#voicesBody .voice-card button', { hasText: '撤回授权' }).click();
  await page.waitForFunction(() => document.querySelector('#voicesBody .voice-card')?.dataset.status === 'revoked');
  check('revoking consent updates the card', (await page.locator('#voicesBody .voice-card').getAttribute('data-status')) === 'revoked');
  const revokedApi = await fetch(`${BASE}/api/voices`).then(r => r.json());
  check('revoked voice cannot synthesize', revokedApi.voices[0].status === 'revoked' && revokedApi.voices[0].canSynthesize === false, JSON.stringify(revokedApi.voices[0]).slice(0, 240));
  await page.locator('#voicesBody .voice-card button', { hasText: '删除样本' }).click();
  await page.waitForFunction(() => document.querySelector('#voicesBody .voice-card')?.dataset.samples === 'deleted', null, { timeout: 15000 })
    .catch(async () => { throw new Error(`delete-sample stuck: ${(await page.locator('#voicesBody').innerText()).slice(0, 300)} | toast: ${await page.locator('#toast').innerText()}`); });
  check('sample deletion recorded', (await page.locator('#voicesBody .voice-card').getAttribute('data-samples')) === 'deleted');
  check('deleted samples cannot be deleted again', await page.locator('#voicesBody .voice-card button', { hasText: '样本已删除' }).isDisabled());
  await page.locator('[data-close="voices"]').click();

  // ------------------------------------------------------------------- EPUB
  await page.locator('#fileInput').setInputFiles(resolve('tests/read-with-you/fixtures/sample.epub'));
  await page.waitForFunction(() => document.querySelectorAll('.shelf-card').length === 2);
  const epubCard = page.locator('.shelf-card').filter({ hasText: 'EPUB' });
  check('EPUB metadata title used', (await epubCard.innerText()).includes('家读样章'), await epubCard.innerText());
  check('EPUB author shown', (await epubCard.innerText()).includes('零一'));
  await epubCard.locator('[data-action="open"]').click();
  await page.waitForSelector('#readerScreen:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('.book-flow .chapter').length === 3, { timeout: 8000 });
  const epubChapters = await page.locator('.book-flow .chapter-title').allInnerTexts();
  check('EPUB chapters extracted', epubChapters.length === 3, epubChapters.join(' | '));
  check('EPUB chapter text extracted', (await page.locator('#bookRoot').innerText()).includes('风铃'));
  await page.locator('#tocButton').click();
  check('EPUB TOC read from nav document', (await page.locator('#tocList').innerText()).includes('第二章 午后'), await page.locator('#tocList').innerText());
  await page.locator('#tocList button').nth(1).click();
  await page.waitForFunction(() => document.querySelector('#readerPlace').textContent.includes('第二章'));
  check('EPUB TOC jump works', (await page.locator('#readerPlace').innerText()).includes('第二章'));
  await page.locator('#closeReader').click();

  // ------------------------------------------------------------------ GB18030
  const gbPage = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  gbPage.on('pageerror', err => evidence.errors.push(`gb18030 pageerror: ${err.message}`));
  await gbPage.goto(`${BASE}/portal/read-with-you.html?wasm-decoder`, { waitUntil: 'networkidle' });
  await gbPage.waitForSelector('#importButton');
  await gbPage.locator('#fileInput').setInputFiles(resolve('tests/read-with-you/fixtures/sample-gb18030.txt'));
  await gbPage.waitForFunction(() => document.querySelectorAll('.shelf-card').length === 1, { timeout: 20000 });
  await gbPage.locator('.shelf-card [data-action="open"]').click();
  await gbPage.waitForSelector('.book-flow .chapter');
  const gbText = await gbPage.locator('#bookRoot').innerText();
  check('GB18030 text decoded without mojibake', gbText.includes('风铃') && !gbText.includes('\ufffd'), gbText.slice(0, 80));
  check('GB18030 headings became chapters', (await gbPage.locator('.chapter-title').allInnerTexts()).includes('第二章 午后'));
  const charset = await gbPage.evaluate(async () => {
    const { decodeText } = await import('/portal/js/read-with-you/books.js');
    const { text, charset, source } = await decodeText(new Blob([new Uint8Array([0xb5, 0xda, 0xd2, 0xbb, 0xd5, 0xc2])]));
    return { text, charset, source };
  });
  check('GB18030 decoder reports its source', charset.text.startsWith('第一章'), JSON.stringify(charset));
  await gbPage.close();

  // -------------------------------------------------------------- local only
  // Static files and /api are served by the same Node process, so "local only"
  // means blocking just the API: the page must still load from the server and
  // fall back to IndexedDB + device speech without the family server.
  const offline = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  offline.on('pageerror', err => evidence.errors.push(`offline pageerror: ${err.message}`));
  // The blocked /api requests below are the point of this section, so their
  // browser-level 500 lines are expected noise; assert that nothing else broke.
  offline.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.includes('Failed to load resource')) return;
    evidence.errors.push(`offline console: ${text}`);
  });
  await offline.route('**/api/**', route => route.abort());
  await offline.goto(`${BASE}/portal/read-with-you.html`, { waitUntil: 'domcontentloaded' });
  await offline.waitForSelector('#importButton', { timeout: 15000 });
  await offline.waitForFunction(() => document.querySelector('#serverLabel').textContent.includes('仅本机'), null, { timeout: 15000 });
  check('reader boots in local-only mode', (await offline.locator('#serverLabel').innerText()).includes('仅本机'), await offline.locator('#serverLabel').innerText());
  await offline.locator('#fileInput').setInputFiles(resolve('tests/read-with-you/fixtures/sample.txt'));
  await offline.waitForFunction(() => document.querySelectorAll('.shelf-card').length === 1);
  await offline.locator('.shelf-card [data-action="open"]').click();
  await offline.waitForSelector('.book-flow .chapter');
  check('local-only mode still opens books', (await offline.locator('#bookRoot').innerText()).includes('风铃'));
  await offline.close();

  check('no runtime errors in any page', evidence.errors.length === 0, evidence.errors.join(' | '));
  evidence.pass = true;
} catch (error) {
  evidence.pass = false;
  evidence.failure = String(error && error.stack || error);
} finally {
  evidence.finishedAt = new Date().toISOString();
  await mkdir(EVIDENCE, { recursive: true });
  await writeFile(resolve(EVIDENCE, 'results.json'), JSON.stringify(evidence, null, 2));
  const passed = evidence.checks.filter(c => c.pass).length;
  console.log(`${evidence.pass ? 'PASS' : 'FAIL'} ${passed}/${evidence.checks.length} checks`);
  for (const item of evidence.checks.filter(c => !c.pass)) console.log(`  ✗ ${item.name}: ${item.details}`);
  if (evidence.failure) console.log(evidence.failure.split('\n').slice(0, 6).join('\n'));
  await browser.close();
  try { server.kill(); } catch {}
  await rm(DATA, { recursive: true, force: true });
  process.exit(evidence.pass ? 0 : 1);
}
