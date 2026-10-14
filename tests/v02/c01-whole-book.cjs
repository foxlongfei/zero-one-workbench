const { chromium } = require('playwright');
const JSZip = require('jszip');
const path = require('path');

const pageUrl = 'file://' + path.resolve(__dirname, '../../portal/read-with-you-v01.html');
const txt = `第一章 起点\n这是第一章的正文。\n\n第二章 继续\n这是第二章的正文。\n\n第三章 终点\n这是第三章的正文。`;

async function makeEpub() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file('OEBPS/content.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">c01-test</dc:identifier><dc:title>C01 EPUB 验证书</dc:title><dc:language>zh-CN</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`);
  zip.file('OEBPS/nav.xhtml', `<!doctype html><html xmlns="http://www.w3.org/1999/xhtml"><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol><li><a href="c1.xhtml">第一章</a></li><li><a href="c2.xhtml">第二章</a></li></ol></nav></body></html>`);
  zip.file('OEBPS/c1.xhtml', `<!doctype html><html xmlns="http://www.w3.org/1999/xhtml"><body><h1>第一章</h1><p>EPUB 第一章正文。</p></body></html>`);
  zip.file('OEBPS/c2.xhtml', `<!doctype html><html xmlns="http://www.w3.org/1999/xhtml"><body><h1>第二章</h1><p>EPUB 第二章正文。</p></body></html>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

let browser;
(async () => {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.__spoken = [];
    const Utterance = class {
      constructor(text) { this.text = text; }
    };
    const synth = {
      speaking: false, paused: false,
      getVoices: () => [{ name: '测试中文声音', lang: 'zh-CN', voiceURI: 'test-zh' }],
      addEventListener: () => {}, cancel() { this.speaking = false; },
      pause() { this.paused = true; }, resume() { this.paused = false; },
      speak(u) { this.speaking = true; window.__spoken.push(u.text); u.onstart?.(); setTimeout(() => { this.speaking = false; u.onend?.(); }, 20); }
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
  });
  const page = await context.newPage();
  await page.goto(pageUrl);

  await page.locator('#bookFiles').setInputFiles({ name: '连续测试书.txt', mimeType: 'text/plain', buffer: Buffer.from(txt) });
  await page.locator('#bookInfo').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#bookInfo').textContent.includes('3 节'));
  if (await page.locator('#bookSelect').inputValue() === '') throw Error('TXT import did not select the book');
  if ((await page.locator('#segment option').count()) !== 3) throw Error('TXT headings did not become three sections');
  await page.locator('#segment').selectOption('0');
  await page.locator('#play').click();
  await page.waitForFunction(() => document.querySelector('#position').textContent.includes('3 / 3') && document.querySelector('#status').textContent.includes('结尾'));
  if ((await page.evaluate(() => window.__spoken.length)) !== 3) throw Error('continuous TTS did not traverse all TXT sections');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#bookInfo').textContent.includes('3 节'));
  if (!(await page.locator('#position').innerText()).includes('3 / 3')) throw Error('TXT book and position were not restored after reload');

  const epub = await makeEpub();
  await page.locator('#bookFiles').setInputFiles({ name: '目录验证.epub', mimeType: 'application/epub+zip', buffer: epub });
  await page.waitForFunction(() => /目录验证|读取失败/.test(document.querySelector('#bookInfo').textContent));
  const epubInfo = await page.locator('#bookInfo').innerText();
  if (!epubInfo.includes('EPUB.js/TXT') || (await page.locator('#segment option').count()) !== 2) throw Error('EPUB import failed: '+epubInfo);
  const labels = await page.locator('#segment option').allTextContents();
  if (!labels.some(x => x.includes('第一章')) || !labels.some(x => x.includes('第二章'))) throw Error('EPUB table of contents was not exposed');
  await page.locator('#segment').selectOption('1');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#bookInfo').textContent.includes('EPUB.js/TXT'));
  if (!(await page.locator('#position').innerText()).includes('2 / 2')) throw Error('EPUB book and position were not restored after reload');

  console.log(JSON.stringify({ status: 'PASS', txtSections: 3, epubSections: 2, continuousTts: true, reloadRestore: true, parser: 'epubjs@0.3.93' }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
