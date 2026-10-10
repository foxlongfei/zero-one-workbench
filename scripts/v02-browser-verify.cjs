const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = process.env.V02_BASE_URL || 'http://127.0.0.1:4173';
const artifactDir = path.resolve('artifacts/v02-browser');
fs.mkdirSync(artifactDir, { recursive: true });

const checks = [];
let browser;
const record = (track, name, passed, evidence) => {
  checks.push({ track, name, status: passed ? 'PASS' : 'FAIL', evidence });
  if (!passed) throw new Error(`${track} ${name}: ${evidence}`);
};

(async () => {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('__v02StoragePrepared')) {
      localStorage.clear();
      sessionStorage.setItem('__v02StoragePrepared', '1');
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);

  await page.goto(`${baseUrl}/portal/movement.html?sha=${process.env.GITHUB_SHA || 'local'}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#v02-exercise').waitFor();
  await page.locator('#v02-ex-input').fill('倒立');
  await page.locator('#v02-ex-find').click();
  record('A01', 'unknown action is not fabricated', (await page.locator('#v02-ex-content').innerText()).includes('未找到可核验'), '倒立返回未找到可核验条目');

  await page.locator('#v02-ex-input').fill('我要练俯卧撑');
  await page.locator('#v02-ex-find').click();
  record('A01', 'stable exercise identity', await page.locator('#v02-exercise').getAttribute('data-exercise-id') === 'exercise:push-up:prototype', 'exercise:push-up:prototype');
  record('A01', 'upstream boundary', await page.locator('#v02-exercise').getAttribute('data-upstream-status') === 'IDENTITY_MAPPED_CONTENT_NOT_IMPORTED', 'wger identity mapped without copying unverified content');
  record('A01', 'upstream links visible', await page.locator('#v02-upstream a').count() === 2, 'license and fixed-revision identity links');
  record('A01', 'muscle and joint object visible', await page.locator('#v02-joints li').count() === 4 && (await page.locator('#v02-ex-content').innerText()).includes('稳定：'), '4 joint rows plus stabilizer role');

  await page.locator('#v02-speed').selectOption('0.5');
  await page.locator('#v02-phase').evaluate(element => {
    element.value = '55';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  record('A01', 'phase control', await page.locator('#v02-phase-name').innerText() === '底部转换', '55% maps to bottom transition');
  await page.locator('#v02-form-0').check();
  record('A01', 'form self-check', await page.locator('#v02-form-0').isChecked(), 'first form error checked');
  await page.locator('#v02-play').click();
  await page.waitForTimeout(180);
  await page.locator('#v02-stop').click();
  record('A01', 'playback changes phase', Number(await page.locator('#v02-exercise').getAttribute('data-phase')) > 55, `phase=${await page.locator('#v02-exercise').getAttribute('data-phase')}`);
  await page.screenshot({ path: path.join(artifactDir, 'movement-a01.png'), fullPage: true });

  await page.goto(`${baseUrl}/portal/k02-board.html?sha=${process.env.GITHUB_SHA || 'local'}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#v02-residence').waitFor();
  const residenceId = await page.locator('#v02-residence').getAttribute('data-residence-id');
  record('B01', 'new residence identity', Boolean(residenceId && residenceId.startsWith('residence-')), residenceId);
  record('B01', 'active first question', (await page.locator('#r-next-question').innerText()).includes('住宅名称'), await page.locator('#r-next-question').innerText());

  await page.locator('#r-name').fill('东明居');
  await page.locator('#r-place').fill('上海市浦东新区');
  await page.locator('#r-material').fill('现场手工测量记录 v1');
  await page.locator('#r-source').selectOption('USER_MEASURED');
  await page.locator('#r-confidence').selectOption('MEDIUM');
  await page.locator('#r-save').click();
  record('B01', 'same ID after save', await page.locator('#v02-residence').getAttribute('data-residence-id') === residenceId, residenceId);
  record('B01', 'field evidence captured', await page.locator('#r-evidence li[data-field]').count() === 3, 'name/place/material each have evidence');
  const revisionText = await page.locator('#r-history').textContent();
  record('B01', 'revision captured', await page.locator('#r-history li').count() === 1 && revisionText.includes('已知 5/11'), revisionText);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#v02-residence').waitFor();
  record('B01', 'same ID after reload', await page.locator('#v02-residence').getAttribute('data-residence-id') === residenceId, residenceId);
  record('B01', 'evidence survives reload', await page.locator('#r-evidence li[data-field]').count() === 3, '3 evidence rows persisted');
  record('B01', 'boundary remains explicit', (await page.locator('#r-result').innerText()).includes('不输出未经计算'), await page.locator('#r-result').innerText());
  await page.screenshot({ path: path.join(artifactDir, 'residence-b01.png'), fullPage: true });

  await page.locator('#r-new').click();
  record('B01', 'new residence gets different ID', await page.locator('#v02-residence').getAttribute('data-residence-id') !== residenceId, await page.locator('#v02-residence').getAttribute('data-residence-id'));
  record('B01', 'new residence clears evidence', await page.locator('#r-evidence li[data-field]').count() === 0, 'evidence ledger empty');

  const report = {
    schema: 'zero-one.v02.browser-verification.v1',
    timestamp: new Date().toISOString(),
    sha: process.env.GITHUB_SHA || 'local',
    baseUrl,
    scope: 'Real Chromium interaction against movement.html and k02-board.html on the PR branch. Not Pages/public acceptance and not A01/B01 completion.',
    checks,
    passed: checks.every(check => check.status === 'PASS'),
  };
  fs.writeFileSync(path.join(artifactDir, 'browser-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  browser = null;
})().catch(error => {
  Promise.resolve(browser?.close()).finally(() => {
    fs.writeFileSync(path.join(artifactDir, 'browser-failure.txt'), `${error.stack || error}\n`);
    console.error(error);
    process.exitCode = 1;
  });
});
