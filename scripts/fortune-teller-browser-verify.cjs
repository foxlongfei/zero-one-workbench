const { chromium } = require('playwright');
const { Solar } = require('../portal/vendor/lunar-javascript/lunar.js');

const base = process.env.FORTUNE_BASE_URL || 'http://127.0.0.1:4173';
const expected = ['庚午', '辛巳', '庚辰', '癸未'];
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) throw new Error(name + ': ' + detail);
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== base) externalRequests.push(request.url());
  });
  try {
    const response = await page.goto(base + '/portal/fortune-teller/index.html', { waitUntil: 'networkidle' });
    check('HTTP 200', response && response.status() === 200, String(response && response.status()));
    check('no browser errors', errors.length === 0, errors.join('; '));
    check('fully local runtime', externalRequests.length === 0, externalRequests.join('; '));
    check('three original modules visible',
      await page.locator('#tab-bazi').count() === 1 &&
      await page.locator('#tab-liuyao').count() === 1 &&
      await page.locator('#tab-ziwei').count() === 1);

    await page.locator('#bazi-date').fill('1990-05-15');
    await page.locator('#bazi-hour').selectOption('7');
    await page.locator('#bazi-gender-male').check();
    const direct = await page.evaluate(() => BaZi.createChart(1990, 5, 15, 14, 'male').pillars.map(p => p.char));
    check('upstream BaZi known-date fixture', JSON.stringify(direct) === JSON.stringify(expected), direct.join(' '));
    const independent = (() => {
      const eight = Solar.fromYmdHms(1990, 5, 15, 14, 0, 0).getLunar().getEightChar();
      return [eight.getYear(), eight.getMonth(), eight.getDay(), eight.getTime()];
    })();
    check('independent 6tail cross-check', JSON.stringify(direct) === JSON.stringify(independent), independent.join(' '));
    const baziText = await page.locator('#bazi-result').innerText();
    check('BaZi UI renders complete four pillars', expected.every(p => baziText.includes(p[0]) && baziText.includes(p[1])), baziText.slice(0, 300));
    check('BaZi extended analysis rendered',
      ['神煞', '胎元', '命宫', '大运', '流年'].every(label => baziText.includes(label)) &&
      await page.locator('#bazi-result .nayin-label').count() === 4,
      baziText.slice(0, 600));

    await page.locator('#tab-liuyao').click();
    await page.locator('#liuyao-method').selectOption('number');
    await page.locator('#liuyao-num1').fill('3');
    await page.locator('#liuyao-num2').fill('7');
    await page.locator('#liuyao-num3').fill('5');
    await page.locator('#liuyao-cast-btn').click();
    const liuyaoText = await page.locator('#liuyao-result').innerText();
    check('Liu Yao number casting renders', liuyaoText.trim().length > 80 && /动爻|卦/.test(liuyaoText), liuyaoText.slice(0, 300));

    await page.locator('#tab-ziwei').click();
    await page.locator('#ziwei-year').fill('1990');
    await page.locator('#ziwei-month').selectOption('4');
    await page.locator('#ziwei-day').fill('21');
    await page.locator('#ziwei-hour').selectOption('7');
    await page.locator('#ziwei-day').press('Tab');
    await page.waitForTimeout(100);
    const ziweiText = await page.locator('#ziwei-result').innerText();
    check('Zi Wei twelve-palace chart renders',
      await page.locator('#ziwei-result .ziwei-cell').count() >= 12 && /命宫|紫微/.test(ziweiText),
      ziweiText.slice(0, 300));

    await page.locator('#lang-toggle').click();
    check('bilingual UI switches', (await page.locator('#tab-bazi').innerText()).toLowerCase().includes('bazi'));
    await page.locator('#theme-toggle').click();
    check('theme switch works', await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'light'));
    await page.locator('#share-btn').click();
    await page.locator('.toast').waitFor({ state: 'visible' });
    check('share link works', (await page.locator('.toast').innerText()).trim().length > 0);

    console.log(JSON.stringify({ status: 'PASS', checks: checks.length, pillars: direct, independent }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(JSON.stringify({ status: 'FAIL', checks, error: error.stack || error.message }, null, 2));
  process.exit(1);
});
