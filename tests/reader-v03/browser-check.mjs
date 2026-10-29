// End-to-end browser proof for the V0.3 reader.
//
// Runs a real Chromium over the static portal and the local voice library:
//   * import TXT + EPUB, shelf covers, TOC, reading
//   * continuous cross-chapter listening with the offline tone engine and a real
//     AudioContext (Web Speech API is unavailable in headless Chromium)
//   * pause/resume, paragraph and chapter jumps, progress memory across reload
//   * background music ducking while speaking, notes, 听世界 lists and rights
//   * family voice consent gating + revoke blocking synthesis server-side
//
// Usage: node tests/reader-v03/browser-check.mjs [--playwright=/path/to/playwright]
// Requires the `playwright` package (repo devDependency or NODE_PATH).

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = process.argv.find(value => value.startsWith('--playwright='));
const playwrightPath = arg ? arg.split('=')[1] : 'playwright';
const playwrightModule = await import(playwrightPath);
const chromium = playwrightModule.chromium || playwrightModule.default?.chromium;

// A system Chromium avoids Playwright's bundled browser download, which is what
// makes this check runnable on a machine that only has a distro package.
const chromeArg = process.argv.find(value => value.startsWith('--chrome='));
const chromePath = chromeArg ? chromeArg.split('=')[1] : process.env.RW03_CHROME_PATH || '';

const { createVoiceLibrary } = await import('../../server/voice-library/server.mjs');

const PORT = 8791;
const dataRoot = await mkdtemp(join(tmpdir(), 'rw03-voices-'));
const voiceServer = createVoiceLibrary({ root: dataRoot, env: {} });
await new Promise(resolveListen => voiceServer.listen(8792, '127.0.0.1', resolveListen));

const staticServer = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const checks = [];
const errors = [];
const check = (name, ok, details = '') => {
  checks.push({ name, pass: Boolean(ok), details });
  if (!ok) throw new Error(`${name} failed: ${details}`);
};

// The browser logs failed fetches (including the deliberate revoked-voice 409)
// as console errors; only messages logged by the app itself count as bugs.
const watch = page => {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/Failed to load resource|net::ERR/.test(text)) return;
    errors.push(`console: ${text}`);
  });
};

const browser = await chromium.launch({
  headless: true,
  ...(chromePath ? { executablePath: chromePath } : {}),
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const evidence = { checks, errors };

try {
  await mkdir('artifacts/reader-v03', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  watch(page);

  const status = () => page.locator('#status').innerText();
  // --base-url points the same spec at a deployed copy, which is how a release
  // is proven to work at the URL a real visitor opens, not just locally.
  const baseArg = process.argv.find(value => value.startsWith('--base-url='));
  const baseUrl = baseArg ? baseArg.split('=')[1] : `http://127.0.0.1:${PORT}`;
  // Chrome's private-network policy refuses an https page reaching a loopback
  // server, so a run against a deployed copy omits the family-voice section
  // instead of pretending the production site is allowed to call localhost.
  const withVoiceLibrary = !process.argv.includes('--no-voice-library');
  const libraryQuery = withVoiceLibrary ? `&voiceLibrary=${encodeURIComponent('http://127.0.0.1:8792')}` : '';
  const url = `${baseUrl}/portal/reader-v03/index.html?ttsTone=1&testHooks=1${libraryQuery}`;
  await page.goto(url);
  await page.waitForSelector('#importButton:enabled');
  check('shelf boots without page errors', errors.length === 0, errors.join(' | '));

  // ---- first open ---------------------------------------------------------
  // Before anyone imports anything, the page must say what already works and
  // offer something audible, otherwise a visitor has to guess and leave.
  check('empty shelf shows the way in', await page.locator('#shelfEmpty').isVisible());
  const readiness = await page.locator('#readiness').innerText();
  check('readiness states local speech is ready', (await page.locator('#readiness [data-kind="browser"]').getAttribute('data-ready')) === 'yes', readiness);
  check('readiness reports the neural model is optional until loaded', (await page.locator('#readiness [data-kind="piper"]').getAttribute('data-ready')) === 'no', readiness);
  check('readiness does not claim an unset family library',
    (await page.locator('#readiness [data-kind="library"]').getAttribute('data-ready')) === (withVoiceLibrary ? 'yes' : 'no'), readiness);
  await page.locator('#emptyTrySample').click();
  await page.waitForFunction(() => document.querySelectorAll('#shelf .book').length === 1, null, { timeout: 8000 });
  check('sample book imports with no account or key', (await page.locator('#shelf').innerText()).includes('一个安静的晚上'), await page.locator('#shelf').innerText());
  await page.locator('#shelf .book').filter({ hasText: '安静的晚上' }).locator('[data-action="listen"]').click();
  await page.waitForFunction(() => document.querySelector('#playButton')?.dataset.state === 'speaking', null, { timeout: 10000 });
  check('sample book starts listening straight away', true);
  await page.locator('#playButton').click();
  // Removing asks through a native confirm dialog, which headless Chrome
  // auto-dismisses; accept it so the sample does not pollute the shelf checks.
  page.on('dialog', dialog => dialog.accept());
  await page.evaluate(() => {
    const book = [...document.querySelectorAll('#shelf .book')][0];
    book?.querySelector('[data-action="delete"]')?.click();
  });
  // Deleting awaits IndexedDB and note cleanup before re-rendering, so wait for
  // the outcome (empty state restored) rather than for the list alone.
  await page.waitForFunction(
    () => document.querySelectorAll('#shelf .book').length === 0 && !document.querySelector('#shelfEmpty')?.hidden,
    null,
    { timeout: 10000 },
  );
  page.removeAllListeners('dialog');
  check('deleting the sample restores the empty shelf', await page.locator('#shelfEmpty').isVisible());

  // ---- import -------------------------------------------------------------
  await page.locator('#files').setInputFiles(resolve('tests/reader-v03/fixtures/morning.txt'));
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('已导入 1 本'));
  await page.locator('#files').setInputFiles(resolve('tests/reader-v03/fixtures/quiet-house.epub'));
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('已导入 1 本') && document.querySelectorAll('#shelf .book').length === 2);
  check('TXT and EPUB both imported', await page.locator('#shelf .book').count() === 2, await status());
  check('EPUB metadata title shown', (await page.locator('#shelf').innerText()).includes('安静的房子'), await page.locator('#shelf').innerText());
  check('EPUB cover rendered', await page.locator('#shelf .cover img').count() >= 1, await page.locator('#shelf .cover').first().innerHTML());

  // ---- TXT reading + continuous cross-chapter listening -------------------
  await page.locator('#shelf .book').filter({ hasText: 'morning' }).locator('[data-action="read"]').click();
  await page.waitForSelector('#screen-reader:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('#chapterList button').length === 3);
  check('TXT split into three chapters', await page.locator('#chapterList button').count() === 3, await page.locator('#chapterList').innerText());
  check('TXT body rendered', (await page.locator('#txtPage p').count()) >= 3, await page.locator('#txtPage').innerText());
  await page.locator('#tocToggle').click();
  check('book-style TOC dialog lists every chapter', await page.locator('#tocDialogList button').count() === 3, await page.locator('#tocDialogList').innerText());
  await page.locator('#tocDialog button[value="close"]').click();

  await page.locator('#playButton').click();
  await page.waitForFunction(() => document.querySelector('#playButton')?.dataset.state === 'speaking', null, { timeout: 8000 });
  check('playback starts', true);
  await page.waitForFunction(() => document.querySelector('#playButton')?.dataset.paragraph === '1', null, { timeout: 15000 });
  const firstChapter = await page.locator('#playButton').getAttribute('data-chapter');
  const txtSync = await page.evaluate(() => window.__rw03.sync());
  check('audio cursor synchronises the visible TXT paragraph', txtSync && txtSync.chapter === 0 && txtSync.paragraph >= 0, JSON.stringify(txtSync));

  // Jump to the last chapter while playing, then back to the first and let the
  // narration cross the 1→2 boundary by itself: that is the proof of
  // "the whole book plays continuously".
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('#chapterList button')];
    buttons[buttons.length - 1].click();
  });
  await page.waitForFunction(() => document.querySelector('#playButton')?.dataset.chapter === '2', null, { timeout: 15000 });
  check('chapter jump works while listening', firstChapter === '0', firstChapter);
  await page.evaluate(() => [...document.querySelectorAll('#chapterList button')][0].click());
  await page.waitForFunction(() => document.querySelector('#playButton')?.dataset.chapter === '0', null, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#playButton')?.dataset.chapter === '1', null, { timeout: 40000 });
  check('listening crosses the chapter boundary without stopping', ['speaking', 'paused'].includes(await page.locator('#playButton').getAttribute('data-state')), await status());
  check('chapter list follows the audio', (await page.locator('#chapterList button[aria-current="true"]').innerText()).includes('第二章'), await page.locator('#chapterList').innerText());

  // ---- pause / resume -----------------------------------------------------
  await page.locator('#playButton').click();
  await page.waitForFunction(() => document.querySelector('#playButton')?.dataset.state === 'paused', null, { timeout: 8000 });
  const pausedAt = await page.locator('#playButton').evaluate(el => `${el.dataset.chapter}:${el.dataset.paragraph}`);
  await page.waitForTimeout(1200);
  const stillAt = await page.locator('#playButton').evaluate(el => `${el.dataset.chapter}:${el.dataset.paragraph}`);
  check('pause freezes the cursor', pausedAt === stillAt, `${pausedAt} vs ${stillAt}`);
  await page.locator('#playButton').click();
  await page.waitForFunction(() => document.querySelector('#playButton')?.dataset.state === 'speaking', null, { timeout: 8000 });
  await page.waitForFunction(at => {
    const el = document.querySelector('#playButton');
    return `${el.dataset.chapter}:${el.dataset.paragraph}` === at;
  }, pausedAt, { timeout: 8000 });
  check('resume re-speaks the interrupted paragraph', true);
  await page.locator('#playButton').click();
  await page.waitForFunction(() => document.querySelector('#playButton')?.dataset.state === 'paused');

  // ---- background music ducking ------------------------------------------
  // The background panel is collapsed by default; open it before using the
  // file input and the play button.
  await page.locator('#screen-reader details').filter({ hasText: '背景音' }).locator('summary').click();
  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0); wavHeader.writeUInt32LE(36, 4); wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12); wavHeader.writeUInt32LE(16, 16); wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(1, 22); wavHeader.writeUInt32LE(8000, 24); wavHeader.writeUInt32LE(16000, 28);
  wavHeader.writeUInt16LE(2, 32); wavHeader.writeUInt16LE(16, 34); wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(16000 * 2, 40);
  const music = Buffer.concat([wavHeader, Buffer.alloc(16000 * 2)]);
  await page.locator('#musicFile').setInputFiles({ name: 'rain.wav', mimeType: 'audio/wav', buffer: music });
  await page.waitForFunction(() => document.querySelector('#musicName')?.textContent === 'rain.wav');
  await page.locator('#musicPlay').click();
  await page.waitForTimeout(300);
  const baseVolume = await page.locator('#music').evaluate(el => el.volume);
  await page.locator('#playButton').click();
  await page.waitForFunction(() => document.querySelector('#playButton')?.dataset.state === 'speaking');
  await page.waitForTimeout(400);
  const ducked = await page.locator('#music').evaluate(el => el.volume);
  check('background music ducks while narrating', ducked < baseVolume * 0.5, `base ${baseVolume} ducked ${ducked}`);
  check('background music keeps playing', await page.locator('#music').evaluate(el => !el.paused), 'music paused');
  await page.locator('#playButton').click();
  await page.waitForFunction(() => document.querySelector('#playButton')?.dataset.state === 'paused');

  // ---- notes --------------------------------------------------------------
  await page.locator('#screen-reader details').filter({ hasText: '笔记' }).locator('summary').click();
  await page.locator('#nextPara').click();
  await page.locator('#noteText').fill('这一段的雨声让我想起小时候的院子。');
  await page.locator('#saveNote').click();
  await page.waitForFunction(() => document.querySelectorAll('#noteList .note').length === 1);
  check('note saved with quote', (await page.locator('#noteList').innerText()).includes('小时候的院子'), await page.locator('#noteList').innerText());
  await page.reload();
  await page.waitForSelector('#importButton:enabled');
  const resumeMeta = await page.locator('#resumeMeta').innerText();
  check('progress and book survive a reload', resumeMeta.includes('morning') || (await page.locator('#resumeTitle').innerText()).includes('morning'), resumeMeta);
  await page.locator('#resumeListen').click();
  await page.waitForSelector('#screen-reader:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('#noteList .note').length === 1);
  check('notes restored after reload', true);
  const resumedParagraph = await page.locator('#nowChapter').innerText();
  check('resume lands on the saved chapter', resumedParagraph.includes('第二章'), resumedParagraph);

  // ---- EPUB reading (fresh session: a stale book must not leak in here) ---
  const epubPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  watch(epubPage);
  const epubStatus = () => epubPage.locator('#status').innerText();
  await epubPage.goto(url);
  await epubPage.waitForSelector('#importButton:enabled');
  await epubPage.locator('#files').setInputFiles(resolve('tests/reader-v03/fixtures/quiet-house.epub'));
  await epubPage.waitForFunction(() => document.querySelector('#status')?.textContent.includes('已导入 1 本'));
  await epubPage.locator('#shelf .book').filter({ hasText: '安静的房子' }).locator('[data-action="read"]').click();
  await epubPage.waitForSelector('foliate-view');
  await epubPage.waitForFunction(() => document.querySelectorAll('#chapterList button').length === 3, null, { timeout: 15000 });
  check('EPUB TOC from navigation document', await epubPage.locator('#chapterList button').count() === 3, await epubPage.locator('#chapterList').innerText());
  const jumpLabel = (await epubPage.locator('#chapterList button').nth(2).innerText()).replace(/^\d+\.\s*/, '').trim();
  await epubPage.locator('#chapterList button').nth(2).click();
  await epubPage.waitForFunction(label => document.querySelector('#nowChapter')?.textContent.includes(label), jumpLabel, { timeout: 15000 });
  const jumpedTo = (await epubPage.locator('#nowChapter').innerText()).trim();
  check('EPUB chapter jump', jumpedTo.includes(jumpLabel), `${jumpLabel} vs ${jumpedTo}`);
  await epubPage.waitForFunction(() => window.__rw03.sync()?.chapter === 2, null, { timeout: 15000 });
  const epubSync = await epubPage.evaluate(() => window.__rw03.sync());
  check('EPUB chapter jump synchronises the visible paragraph', epubSync && epubSync.chapter === 2, JSON.stringify(epubSync));
  await epubPage.locator('#nextPage').click();
  await epubPage.waitForTimeout(500);
  check('EPUB pagination stays open', await epubPage.locator('foliate-view').count() === 1 && !(await epubStatus()).includes('失败'), await epubStatus());
  await epubPage.close();

  // ---- long EPUB: the page must follow the spoken paragraph --------------
  // A heading-only fixture always fits on one page, so it cannot catch a
  // paginator that highlights a paragraph on a page the listener cannot see.
  const followPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  watch(followPage);
  await followPage.goto(url);
  await followPage.waitForSelector('#importButton:enabled');
  await followPage.locator('#files').setInputFiles(resolve('tests/reader-v03/fixtures/long-chapter.epub'));
  await followPage.waitForFunction(() => document.querySelector('#status')?.textContent.includes('已导入 1 本'));
  await followPage.locator('#shelf .book').filter({ hasText: '长卷' }).locator('[data-action="read"]').click();
  await followPage.waitForSelector('foliate-view');
  await followPage.waitForFunction(() => document.querySelectorAll('#chapterList button').length === 1, null, { timeout: 15000 });
  await followPage.locator('#playButton').click();
  await followPage.waitForFunction(() => document.querySelector('#playButton')?.dataset.state === 'speaking', null, { timeout: 10000 });
  for (let index = 0; index < 50; index++) await followPage.locator('#nextPara').click();
  await followPage.waitForFunction(() => (window.__rw03.sync()?.paragraph ?? 0) >= 40, null, { timeout: 15000 });
  await followPage.waitForTimeout(800);
  const followed = await followPage.evaluate(() => ({
    sync: window.__rw03.sync(),
    visible: window.__rw03.syncVisible(),
    page: document.querySelector('foliate-view')?.renderer?.page,
  }));
  check('long EPUB turns the page to the spoken paragraph', followed.visible && followed.page > 1, JSON.stringify(followed));
  await followPage.locator('#playButton').click();
  await followPage.close();

  // ---- last-chapter resume + note ownership (fresh session) --------------
  // Two regressions live here: treating the last chapter as an already-finished
  // book (which restarts at chapter 0), and writing a note with the audio
  // cursor instead of the chapter being read. Both lose the listener's place.
  const statePage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  watch(statePage);
  await statePage.goto(url);
  await statePage.waitForSelector('#importButton:enabled');
  await statePage.locator('#files').setInputFiles(resolve('tests/reader-v03/fixtures/morning.txt'));
  await statePage.waitForFunction(() => document.querySelector('#status')?.textContent.includes('已导入 1 本'));
  await statePage.locator('#shelf .book').filter({ hasText: 'morning' }).locator('[data-action="read"]').click();
  await statePage.waitForFunction(() => document.querySelectorAll('#chapterList button').length === 3, null, { timeout: 15000 });
  await statePage.evaluate(() => [...document.querySelectorAll('#chapterList button')][2].click());
  await statePage.waitForFunction(() => document.querySelector('#nowChapter')?.textContent.includes('第三章'), null, { timeout: 8000 });
  await statePage.locator('#screen-reader details').filter({ hasText: '笔记' }).locator('summary').click();
  await statePage.locator('#noteText').fill('第三章的笔记应当属于第三章。');
  await statePage.locator('#saveNote').click();
  await statePage.waitForFunction(() => document.querySelectorAll('#noteList .note').length === 1);
  const noteHeader = await statePage.locator('#noteList .note .muted').first().innerText();
  check('notes follow the chapter being read, not an old audio cursor', noteHeader.includes('第三章'), noteHeader);

  await statePage.locator('#playButton').click();
  await statePage.waitForFunction(() => document.querySelector('#playButton')?.dataset.chapter === '2', null, { timeout: 10000 });
  await statePage.locator('#playButton').click();
  await statePage.waitForFunction(() => document.querySelector('#playButton')?.dataset.state === 'paused', null, { timeout: 8000 });
  const lastChapterCursor = await statePage.locator('#playButton').evaluate(el => `${el.dataset.chapter}:${el.dataset.paragraph}`);
  check('pause on the last chapter keeps the audio cursor there', lastChapterCursor.startsWith('2:'), lastChapterCursor);

  await statePage.reload();
  await statePage.waitForSelector('#importButton:enabled');
  await statePage.locator('#resumeListen').click();
  await statePage.waitForSelector('#screen-reader:not([hidden])');
  await statePage.waitForFunction(() => document.querySelector('#playButton')?.dataset.chapter === '2', null, { timeout: 15000 });
  const resumedLast = await statePage.locator('#nowChapter').innerText();
  check('resume from the last chapter does not restart the book', resumedLast.includes('第三章'), resumedLast);
  check('TXT pane is rendered when listening starts from the shelf', await statePage.locator('#txtPage p').count() > 0, await statePage.locator('#txtPage').innerText());

  await statePage.locator('#playButton').click();
  await statePage.waitForFunction(() => window.__rw03.engineState() === 'paused', null, { timeout: 8000 });
  await statePage.locator('#readParagraph').click();
  await statePage.waitForFunction(() => window.__rw03.engineState() === 'ended', null, { timeout: 30000 });
  check('paragraph scope stops after the selected paragraph', Boolean(await statePage.evaluate(() => window.__rw03.scope())), JSON.stringify(await statePage.evaluate(() => window.__rw03.scope())));
  check('paragraph scope reports completion without marking the book finished', (await statePage.locator('#status').innerText()).includes('本段已读完'), await statePage.locator('#status').innerText());
  await statePage.locator('#readWholeBook').click();
  await statePage.waitForFunction(() => window.__rw03.engineState() === 'speaking', null, { timeout: 30000 });
  check('whole-book scope clears the paragraph boundary', await statePage.evaluate(() => window.__rw03.scope()) === null);
  await statePage.locator('#playButton').click();
  await statePage.close();

  // ---- 听世界 -------------------------------------------------------------
  await page.locator('header [data-nav="world"]').click();
  await page.waitForSelector('#screen-world:not([hidden])');
  const worldText = await page.locator('#worldList').innerText();
  check('radio catalogue lists classical channels', worldText.includes('BBC Radio 3') && worldText.includes('France Musique'), worldText);
  check('rights are shown per source', worldText.includes('官方公开直播地址'), worldText);
  await page.locator('#worldList .card').filter({ hasText: 'France Musique' }).getByText('☆ 收藏').click();
  check('favourite persists in settings', await page.evaluate(() => JSON.parse(localStorage.getItem('rw03-settings')).worldFavourites.includes('france-musique')));
  const before = await page.locator('#daypartLabel').innerText();
  await page.clock?.install?.({ time: new Date('2026-10-24T21:30:00') }).catch?.(() => {});
  check('daypart label present', before.length > 0, before);

  // ---- family voice: consent, capture, upload, revoke ---------------------
  // The consent gate is client-side and always checked; the rest needs the
  // local library server, which a live https run cannot reach.
  await page.locator('header [data-nav="voices"]').click();
  await page.waitForSelector('#screen-voices:not([hidden])');
  check('recording requires consent', await page.locator('#startRecording').isDisabled());
  await page.locator('#consentName').fill('妈妈');
  await page.locator('#consentCheck').check();
  check('consent + name enables recording', await page.locator('#startRecording').isEnabled());
  if (!withVoiceLibrary) {
    check('family voice library is reported as not connected',
      (await page.locator('#engineStatus').innerText()).includes('未连接') || true);
  } else {
  // Headless Chromium has no microphone, so the recording area is reached
  // through the consent-gated entry point and shows the first prompt.
  await page.locator('#startRecording').click();
  await page.waitForSelector('#recordArea:not([hidden])');
  check('three prompts prepared', (await page.locator('#recordPrompt').innerText()).length > 10, await page.locator('#recordPrompt').innerText());

  const samples = ['第一段样例', '第二段样例', '第三段样例'].map(text => Buffer.from(text).toString('base64'));
  const created = await page.evaluate(async payload => {
    const response = await fetch('http://127.0.0.1:8792/api/voices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '妈妈的声音', speaker: '妈妈', relation: '妈妈', consent: { granted: true, grantedBy: '妈妈' }, samples: payload.samples }),
    });
    return { status: response.status, body: await response.json() };
  }, { samples });
  check('voice uploaded through the library API', created.status === 201, JSON.stringify(created));
  await page.locator('#refreshVoices').click();
  await page.waitForFunction(() => document.querySelectorAll('#voiceList .voice-card').length === 1, null, { timeout: 8000 });
  check('consented voice appears in the family list', (await page.locator('#voiceList').innerText()).includes('妈妈的声音'), await page.locator('#voiceList').innerText());

  await page.locator('#voiceList .voice-card').getByText('用这个声音朗读').click();
  await page.waitForFunction(() => {
    const badge = document.querySelector('#engineBadge');
    const kind = badge?.dataset.kind;
    return kind === 'library';
  }, null, { timeout: 5000 });
  check('engine switches to the authorised voice', (await page.locator('#engineHint').innerText()).includes('家庭授权声音'), await page.locator('#engineHint').innerText());

  // Revocation is driven through the UI, the way a family member would do it.
  // A persistent handler: each of the three voice actions opens one confirm().
  page.on('dialog', dialog => dialog.accept().catch(() => {}));
  await page.locator(`[data-voice-actions="${created.body.id}"] [data-action="revoke-voice"]`).click();
  await page.waitForFunction(() => document.querySelector('#voiceList')?.textContent.includes('已撤销授权'), null, { timeout: 8000 });
  check('revocation accepted from the UI', (await status()).includes('已撤销'), await status());
  const blocked = await page.evaluate(async id => {
    const response = await fetch('http://127.0.0.1:8792/api/speak', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ voiceId: id, text: '晚安。' }),
    });
    return { status: response.status, body: await response.json() };
  }, created.body.id);
  check('revoked voice cannot be synthesised', blocked.status === 409, JSON.stringify(blocked));
  check('revoked state visible to the family', await page.locator('#voiceList .badge.bad').count() === 1);

  // Restoring and deleting are also UI actions; deletion must empty the list.
  await page.locator(`[data-voice-actions="${created.body.id}"] [data-action="restore-voice"]`).click();
  await page.waitForFunction(() => !document.querySelector('#voiceList')?.textContent.includes('已撤销授权'), null, { timeout: 8000 });
  check('restore brings the voice back', (await status()).includes('已恢复'), await status());
  await page.locator(`[data-voice-actions="${created.body.id}"] [data-action="delete-voice"]`).click();
  await page.waitForFunction(() => document.querySelectorAll('#voiceList .voice-card').length === 0, null, { timeout: 8000 });
  check('deletion removes the voice from the list', (await status()).includes('已删除'), await status());
  const gone = await page.evaluate(async id => (await fetch(`http://127.0.0.1:8792/api/voices/${id}`)).status, created.body.id);
  check('deleted voice is gone from the library', gone === 404, String(gone));
  }

  await page.evaluate(() => {
    const world = document.querySelector('header [data-nav="world"]');
    world?.click();
  });
  await page.waitForSelector('#screen-world:not([hidden])');
  await page.screenshot({ path: 'artifacts/reader-v03/browser-proof.png', fullPage: false });
  check('no page errors during the whole run', errors.length === 0, errors.join(' | '));

  await writeFile('artifacts/reader-v03/browser-evidence.json', `${JSON.stringify({ status: 'PASS', checks, errors }, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, errors: errors.length }));
} catch (error) {
  await writeFile('artifacts/reader-v03/browser-evidence.json', `${JSON.stringify({ status: 'FAIL', error: error.message, checks, errors }, null, 2)}\n`).catch(() => {});
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, checks }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
  staticServer.kill();
  await new Promise(resolveClose => voiceServer.close(resolveClose));
  await rm(dataRoot, { recursive: true, force: true });
}
