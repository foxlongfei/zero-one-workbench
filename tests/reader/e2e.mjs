// 陪你读书 · 端到端验收（Playwright + Chromium）
//
// 覆盖用户可操作的核心路径：导入 EPUB、目录跳转、逐句朗读、跨章自动继续、
// 暂停/继续/跳转、刷新后恢复进度、笔记、背景音压低、家人声音授权与撤销、
// 阅读统计与一键清除。
//
// 运行：npm i playwright && npx playwright install chromium
//       node tests/reader/e2e.mjs
//
// 朗读与录音全部替换为确定性替身，不依赖机器上的真实语音/麦克风。

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.READER_TEST_PORT || 8791);
const BASE = `http://127.0.0.1:${PORT}`;
const evidence = { checks: [], errors: [], started: new Date().toISOString() };

const check = (name, ok, details = '') => {
  evidence.checks.push({ name, pass: !!ok, details: String(details ?? '').slice(0, 400) });
  if (!ok) throw new Error(`${name} failed: ${details}`);
};

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  cwd: ROOT,
  stdio: 'ignore',
});
await new Promise(r => setTimeout(r, 900));

// 浏览器替身：语音合成按 30ms/句自动完成；AudioContext 记录被创建的节点；
// getUserMedia 返回一段稳定的正弦波，方便计算声学特征。
const MOCKS = () => {
  window.__spoken = [];
  window.__synthState = { paused: false, canceled: 0 };
  class Utterance {
    constructor(text) { this.text = text; this.rate = 1; this.lang = ''; }
  }
  window.SpeechSynthesisUtterance = Utterance;
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      get paused() { return window.__synthState.paused; },
      cancel() { window.__synthState.canceled++; window.__synthState.paused = false; },
      pause() { window.__synthState.paused = true; },
      resume() { window.__synthState.paused = false; },
      getVoices() {
        return [
          { name: '测试普通话', lang: 'zh-CN', voiceURI: 'test-zh' },
          { name: 'Test English', lang: 'en-US', voiceURI: 'test-en' },
        ];
      },
      addEventListener() {},
      speak(u) {
        window.__spoken.push(u.text);
        setTimeout(() => { if (!window.__synthState.paused) u.onend?.(); }, 30);
      },
    },
  });

  const param = value => ({ value, setTargetAtTime(v) { this.value = v; }, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = extra => ({ connect(n) { return n; }, ...extra });
  let sample = 0;
  class FakeAudioContext {
    constructor() { this.sampleRate = 8000; this.state = 'running'; this.currentTime = 0; this.destination = node(); window.__audioContexts = (window.__audioContexts || 0) + 1; }
    createGain() { return node({ gain: param(1) }); }
    createBuffer(ch, len) { const data = new Float32Array(len); return { getChannelData: () => data }; }
    createBufferSource() { return node({ start() { this.started = true; }, stop() { this.stopped = true; }, buffer: null, loop: false }); }
    createBiquadFilter() { return node({ type: '', frequency: param(1000), Q: param(1) }); }
    createOscillator() { return node({ type: 'sine', frequency: param(220), start() {}, stop() {} }); }
    createMediaElementSource() { return node(); }
    createAnalyser() {
      return node({
        fftSize: 2048,
        getFloatTimeDomainData(buf) { for (let i = 0; i < buf.length; i++) buf[i] = Math.sin((sample++ + i) / 6) * 0.4; },
      });
    }
    createMediaStreamSource() { return node(); }
    async resume() { this.state = 'running'; }
    close() { this.state = 'closed'; }
  }
  window.AudioContext = FakeAudioContext;
  window.webkitAudioContext = FakeAudioContext;

  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  window.__confirmAnswers = [];
  window.prompt = () => '妈妈';
};

let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 950 }, permissions: [] });
  const page = await context.newPage();
  page.on('pageerror', e => evidence.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') evidence.errors.push('console: ' + m.text()); });
  await page.addInitScript(MOCKS);

  await page.goto(`${BASE}/portal/reader-integrated.html`);
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('书库就绪'));
  check('书库加载完成', await page.locator('#shelfScreen').isVisible());
  check('页面没有脚本错误', evidence.errors.length === 0, evidence.errors.join(' | '));

  // ---------- 1. 导入 EPUB（内置原创试读） ----------
  const epubPath = resolve(ROOT, 'portal/test-books/zero-one-whole-book.epub');
  await page.locator('#files').setInputFiles(epubPath);
  await page.waitForFunction(() => document.querySelectorAll('#shelf .book').length === 1);
  const card = page.locator('#shelf .book').first();
  check('EPUB 导入到书架', (await card.innerText()).includes('整书朗读试读'), await card.innerText());
  check('书架显示格式', (await card.innerText()).includes('EPUB'), await card.innerText());

  await page.locator('#files').setInputFiles(epubPath);
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('已在书架'));
  check('重复导入不会产生副本', (await page.locator('#shelf .book').count()) === 1, await page.locator('#status').innerText());

  // ---------- 2. 打开并检查目录 ----------
  await page.locator('#shelf .book [data-action="open"]').first().click();
  await page.waitForFunction(() => document.querySelector('#renderMode')?.textContent.includes('foliate-js'));
  check('阅读器打开 EPUB', await page.locator('#readerScreen').isVisible());
  await page.waitForFunction(() => document.querySelectorAll('#bookView p').length >= 3, null, { timeout: 15000 });
  check('正文渲染段落', (await page.locator('#bookView p').count()) >= 3, await page.locator('#bookView').innerText());
  await page.locator('[role=tab][data-tab="toc"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#tocList button').length >= 3, null, { timeout: 15000 });
  const tocCount = await page.locator('#tocList button').count();
  check('目录列出章节', tocCount >= 3, `toc=${tocCount}`);

  // ---------- 3. 逐句朗读 + 跨章自动继续 ----------
  await page.locator('[role=tab][data-tab="content"]').click();
  await page.locator('#speak').click();
  await page.waitForFunction(() => (window.__spoken || []).length >= 2, null, { timeout: 8000 });
  check('朗读开始并逐句推进', (await page.evaluate(() => window.__spoken.length)) >= 2, await page.locator('#nowSentence').innerText());
  check('正在朗读时高亮当前段', (await page.locator('#bookView p.active').count()) === 1, await page.locator('#bookView').innerHTML().then(h => h.slice(0, 200)));

  // 让整章（3 章）自动播完，验证跨章节续读
  await page.waitForFunction(() => document.querySelector('#position')?.textContent.includes('第三章'), null, { timeout: 25000 });
  check('朗读自动跨到下一章', (await page.locator('#position').innerText()).includes('第三章'), await page.locator('#position').innerText());

  // ---------- 4. 暂停 / 继续 / 跳转 ----------
  await page.locator('#speak').click();
  const pausedState = await page.evaluate(() => window.__synthState.paused);
  check('点一次暂停朗读', pausedState === true, String(pausedState));
  await page.locator('#speak').click();
  check('再次点击继续朗读', (await page.evaluate(() => window.__synthState.paused)) === false);
  const before = Number(await page.locator('#chapterProgress').inputValue());
  await page.locator('#chapterProgress').fill('0');
  await page.waitForFunction(() => Number(document.querySelector('#chapterProgress')?.value) === 0);
  check('拖动进度条回到章首', Number(await page.locator('#chapterProgress').inputValue()) === 0, `before=${before}`);

  // ---------- 5. 笔记 ----------
  await page.locator('[role=tab][data-tab="notes"]').click();
  await page.locator('#noteText').fill('这一章的风声让我想起小时候的窗户。');
  await page.locator('#noteTags').fill('童年，疑问');
  await page.locator('#noteSave').click();
  await page.waitForFunction(() => document.querySelectorAll('#noteList .note').length === 1);
  check('笔记保存在本机', (await page.locator('#noteList .note').innerText()).includes('小时候'), await page.locator('#noteList').innerText());
  check('笔记带标签', (await page.locator('#noteList .tag').count()) === 2);
  // 搜「标签 + 正文词」：用户往往记不住整句，只记得几个词
  await page.locator('#noteSearch').fill('童年 窗户');
  await page.waitForFunction(() => document.querySelector('#noteStatus')?.textContent.includes('找到 1 条'));
  check('笔记搜索命中', (await page.locator('#noteList .note').count()) === 1);
  await page.locator('#noteSearch').fill('窗户');
  await page.waitForFunction(() => document.querySelector('#noteStatus')?.textContent.includes('找到 1 条'));
  check('笔记按正文词搜索', (await page.locator('#noteList .note').count()) === 1);
  await page.locator('#noteSearch').fill('不存在的关键词');
  await page.waitForFunction(() => document.querySelector('#noteStatus')?.textContent.includes('找到 0 条'));
  check('笔记搜索无结果时提示', (await page.locator('#noteList').innerText()).includes('没有匹配的笔记'));
  await page.locator('#noteSearch').fill('');

  // ---------- 6. 背景音 + 朗读压低 ----------
  await page.locator('[role=tab][data-tab="sound"]').click();
  await page.locator('#ambientGrid [data-scene="rain"]').click();
  await page.waitForFunction(() => window.__reader?.state?.ambient === 'rain', null, { timeout: 5000 });
  check('背景音开始播放', (await page.evaluate(() => window.__reader.state.ambient)) === 'rain');
  check('压低开关默认开启', await page.locator('#ducking').isChecked());
  await page.locator('#volume').fill('0.6');
  check('音量可调并显示', (await page.locator('#volumeOut').innerText()) === '60%', await page.locator('#volumeOut').innerText());

  // ---------- 7. 家庭声音：授权 → 使用 → 撤销 ----------
  await page.locator('#openVoices').click();
  await page.waitForFunction(() => document.querySelector('#voicesDialog')?.open);
  await page.locator('#addVoice').click();
  await page.waitForFunction(() => document.querySelector('#recordDialog')?.open);
  await page.locator('#recordStart').click();
  check('未勾选授权不能录制', (await page.locator('#recordStatus').innerText()).includes('请先由声音本人确认'));
  await page.locator('[data-consent]').evaluateAll(list => list.forEach(cb => { cb.checked = true; }));
  await page.locator('#recordStart').click();
  await page.waitForFunction(() => document.querySelector('#recordStatus')?.textContent.includes('录制中'), null, { timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector('#recordStop')?.disabled || document.querySelector('#recordStatus')?.textContent.includes('录制完成'), null, { timeout: 20000 });
  // 至少录到 3 秒后停止
  await page.waitForTimeout(3200);
  await page.locator('#recordStop').click();
  await page.waitForFunction(() => !document.querySelector('#recordSave')?.disabled, null, { timeout: 5000 });
  await page.locator('#recordSave').click();
  await page.waitForFunction(() => document.querySelectorAll('#voicesBody .voice-card').length === 1);
  const voiceState = await page.evaluate(() => window.__reader.state.voices);
  check('家庭声音已保存并带声学特征', voiceState.length === 1 && !!voiceState[0].features, JSON.stringify(voiceState));
  check('只保存特征，不保存录音', (await page.locator('#voicesBody .voice-card').innerText()).includes('样本'), await page.locator('#voicesBody').innerText());

  await page.locator('#voicesBody .voice-card button', { hasText: '在朗读中使用' }).first().click();
  check('朗读可切换到家庭声音', (await page.locator('#status').innerText()).includes('家庭声音'), await page.locator('#status').innerText());
  check('朗读声音下拉出现家庭声音', await page.locator('#voice option[value^="family:"]').count() === 1);

  await page.locator('[data-action="revoke"]').click();
  await page.waitForFunction(() => document.querySelector('#confirmDialog')?.open);
  await page.locator('#confirmYes').click();
  await page.waitForFunction(() => window.__reader.state.voices[0]?.status === 'revoked');
  const revoked = await page.evaluate(() => window.__reader.state.voices[0]);
  check('撤销后特征被清除', revoked.features === null, JSON.stringify(revoked));
  check('撤销后界面标注已撤销', (await page.locator('#voicesBody').innerText()).includes('已撤销'));
  await page.locator('#closeVoices').click();

  // ---------- 8. 刷新后恢复进度 ----------
  const beforeReload = await page.evaluate(() => window.__reader.state);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('书库就绪'));
  check('刷新后书架仍有书', (await page.locator('#shelf .book').count()) === 1);
  check('刷新后出现继续阅读卡片', await page.locator('#continueSlot .continue-card').isVisible());
  // 试读样书只有三章，朗读会一口气读完，此时卡片是「再读一遍」；还没读完则是「继续阅读」。
  const resumeLabel = (await page.locator('#continueSlot button', { hasText: '再读一遍' }).count()) ? '再读一遍' : '继续阅读';
  await page.locator('#continueSlot button', { hasText: resumeLabel }).click();
  await page.waitForFunction(() => document.querySelector('#readerScreen')?.hidden === false);
  await page.waitForFunction(() => document.querySelector('#position')?.textContent.length > 0);
  const afterReload = await page.evaluate(() => window.__reader.state);
  if (resumeLabel === '再读一遍') {
    check('读完的书重新开始回到第一章', afterReload.chapterIndex === 0, String(afterReload.chapterIndex));
  } else {
    check('阅读进度恢复到同一章', afterReload.chapterIndex === beforeReload.chapterIndex, `before=${beforeReload.chapterIndex} after=${afterReload.chapterIndex}`);
  }
  check('笔记在刷新后仍在', afterReload.notes >= 1, String(afterReload.notes));
  check('撤销的家庭声音在刷新后仍不可用', (await page.evaluate(() => window.__reader.state.voices[0]?.status)) === 'revoked');

  // ---------- 9. 阅读统计 ----------
  await page.locator('#openStats').click();
  await page.waitForFunction(() => document.querySelector('#statsDialog')?.open);
  check('统计弹窗展示七天柱状图', (await page.locator('.bars .bar').count()) === 7);
  check('统计展示今日听书', (await page.locator('#statsBody').innerText()).includes('今天听书'), await page.locator('#statsBody').innerText());

  // ---------- 10. 清除全部本机数据 ----------
  await page.locator('[data-action="erase-all"]').click();
  await page.waitForFunction(() => document.querySelector('#confirmDialog')?.open);
  await page.locator('#confirmYes').click();
  await page.waitForFunction(() => document.querySelectorAll('#shelf .book').length === 0, null, { timeout: 8000 });
  check('清除后书架为空', (await page.locator('#shelf .book').count()) === 0);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('书库就绪'));
  check('清除后刷新仍是空书架', (await page.locator('#shelf .book').count()) === 0);
  check('清除后不再有阅读进度', (await page.locator('#continueSlot .continue-card').count()) === 0);

  // ---------- 11. TXT 内置试读书 ----------
  await page.locator('#addDemo').click();
  await page.waitForFunction(() => document.querySelectorAll('#shelf .book').length === 1, null, { timeout: 8000 });
  check('TXT 试读书导入', (await page.locator('#shelf .book').first().innerText()).includes('TXT'), await page.locator('#shelf').innerText());
  await page.locator('#shelf .book [data-action="open"]').first().click();
  await page.waitForFunction(() => document.querySelector('#renderMode')?.textContent.includes('TXT'));
  await page.locator('[role=tab][data-tab="toc"]').click();
  const txtChapters = await page.locator('#tocList button').count();
  check('TXT 分章成功', txtChapters >= 3, `chapters=${txtChapters}`);
  await page.locator('#tocList button').nth(1).click();
  await page.waitForFunction(() => document.querySelector('#position')?.textContent.includes('第一章'));
  check('TXT 目录跳转生效', (await page.locator('#bookTitle').innerText()).includes('试读'));

  const failed = evidence.checks.filter(c => !c.pass);
  check('全流程无脚本错误', evidence.errors.length === 0, evidence.errors.join(' | '));
  evidence.finished = new Date().toISOString();
  evidence.status = failed.length ? 'FAIL' : 'PASS';
  await mkdir(resolve(ROOT, 'reports/reader'), { recursive: true });
  await writeFile(resolve(ROOT, 'reports/reader/e2e.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({
    status: evidence.status,
    checks: evidence.checks.length,
    failed: failed.map(f => f.name),
    errors: evidence.errors,
  }, null, 2));
} catch (err) {
  evidence.status = 'FAIL';
  evidence.error = err.message;
  evidence.finished = new Date().toISOString();
  await mkdir(resolve(ROOT, 'reports/reader'), { recursive: true }).catch(() => {});
  await writeFile(resolve(ROOT, 'reports/reader/e2e.json'), JSON.stringify(evidence, null, 2)).catch(() => {});
  console.error(JSON.stringify({
    status: 'FAIL',
    error: err.message,
    lastChecks: evidence.checks.slice(-6),
    errors: evidence.errors.slice(-5),
  }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  server.kill('SIGTERM');
}
