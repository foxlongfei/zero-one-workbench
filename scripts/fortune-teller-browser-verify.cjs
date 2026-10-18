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
    check('strict CSP has no inline event handlers',
      await page.locator('[onclick], [onchange], [onsubmit]').count() === 0);
    check('portal return path available',
      await page.locator('#portal-return').getAttribute('href') === '../index.html');
    const licenseHref = await page.locator('#local-license-link').getAttribute('href');
    check('local MIT license available', licenseHref === 'LICENSE');
    const licenseResponse = await page.request.get(base + '/portal/fortune-teller/' + licenseHref);
    check('local MIT license HTTP 200',
      licenseResponse.status() === 200 && (await licenseResponse.text()).includes('MIT License'),
      String(licenseResponse.status()));

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

    await page.locator('#bazi-date').evaluate(input => {
      input.value = '2101-01-01';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    check('BaZi rejects out-of-range date',
      await page.locator('#bazi-result [role="alert"]').count() === 1 &&
      (await page.locator('#bazi-result').innerText()).includes('日期无效'));
    await page.locator('#bazi-date').fill('1990-05-15');
    await page.locator('#bazi-date').press('Tab');
    const repeatedBazi = await page.locator('#bazi-result').innerText();
    check('BaZi recovers deterministically after invalid input',
      expected.every(p => repeatedBazi.includes(p[0]) && repeatedBazi.includes(p[1])),
      repeatedBazi.slice(0, 300));

    await page.locator('#tab-liuyao').click();
    await page.locator('#liuyao-method').selectOption('number');
    await page.locator('#liuyao-num1').fill('3');
    await page.locator('#liuyao-num2').fill('7');
    await page.locator('#liuyao-num3').fill('5');
    await page.locator('#liuyao-cast-btn').click();
    const liuyaoText = await page.locator('#liuyao-result').innerText();
    check('Liu Yao number casting renders', liuyaoText.trim().length > 80 && /动爻|卦/.test(liuyaoText), liuyaoText.slice(0, 300));

    await page.locator('#liuyao-num1').fill('0');
    await page.locator('#liuyao-cast-btn').click();
    check('Liu Yao rejects out-of-range number input',
      await page.locator('#liuyao-result [role="alert"]').count() === 1 &&
      (await page.locator('#liuyao-result').innerText()).includes('1—999'));
    await page.locator('#liuyao-num1').fill('3');
    await page.locator('#liuyao-num2').fill('7');
    await page.locator('#liuyao-num3').fill('5');
    await page.locator('#liuyao-cast-btn').click();
    const recoveredLiuyao = await page.locator('#liuyao-result').innerText();
    check('Liu Yao recovers deterministically after invalid input',
      recoveredLiuyao === liuyaoText,
      recoveredLiuyao.slice(0, 300));

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

    await page.locator('#ziwei-day').evaluate(input => {
      input.value = '31';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    check('Zi Wei rejects invalid lunar day',
      await page.locator('#ziwei-result [role="alert"]').count() === 1 &&
      (await page.locator('#ziwei-result').innerText()).includes('日期无效'));
    await page.locator('#ziwei-day').fill('21');
    await page.locator('#ziwei-day').press('Tab');
    check('Zi Wei recovers after invalid input',
      await page.locator('#ziwei-result .ziwei-cell').count() >= 12);

    await page.locator('#lang-toggle').click();
    check('bilingual UI switches', (await page.locator('#tab-bazi').innerText()).toLowerCase().includes('bazi'));
    await page.locator('#theme-toggle').click();
    check('theme switch works', await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'light'));
    await page.locator('#ziwei-gender-female').check();
    await page.locator('#share-btn').click();
    check('share modal opens', await page.locator('#share-modal').isVisible());
    check('share URL is prepared', (await page.locator('#share-url').inputValue()).includes('#'));
    await page.locator('#copy-url-btn').click();
    await page.locator('.toast').waitFor({ state: 'visible' });
    check('share link copies', (await page.locator('.toast').innerText()).trim().length > 0);
    await page.locator('#share-modal-close').click();
    check('share modal closes by button', !(await page.locator('#share-modal').isVisible()));
    await page.locator('#share-btn').click();
    await page.keyboard.press('Escape');
    check('share modal closes by Escape', !(await page.locator('#share-modal').isVisible()));

    const ziweiShareUrl = await page.locator('#share-url').inputValue();
    await page.goto(ziweiShareUrl, { waitUntil: 'networkidle' });
    check('Zi Wei share restores gender', await page.locator('#ziwei-gender-female').isChecked());
    check('Zi Wei share restores chart', await page.locator('#ziwei-result .ziwei-cell').count() >= 12);

    await page.locator('#tab-liuyao').click();
    await page.locator('#liuyao-method').selectOption('number');
    await page.locator('#liuyao-num1').fill('11');
    await page.locator('#liuyao-num2').fill('22');
    await page.locator('#liuyao-num3').fill('6');
    await page.locator('#liuyao-cast-btn').click();
    await page.locator('#share-btn').click();
    const liuyaoShareUrl = await page.locator('#share-url').inputValue();
    await page.goto(liuyaoShareUrl, { waitUntil: 'networkidle' });
    check('Liu Yao share restores number inputs',
      await page.locator('#liuyao-method').inputValue() === 'number' &&
      await page.locator('#liuyao-num1').inputValue() === '11' &&
      await page.locator('#liuyao-num2').inputValue() === '22' &&
      await page.locator('#liuyao-num3').inputValue() === '6');
    const restoredLiuyao = await page.locator('#liuyao-result').innerText();
    check('Liu Yao share recalculates result',
      restoredLiuyao.trim().length > 80 &&
      await page.locator('#liuyao-result .hex-header').count() === 1 &&
      await page.locator('#liuyao-result .hex-lines-table').count() === 1,
      restoredLiuyao.slice(0, 300));

    if (await page.locator('#share-modal').isVisible()) {
      await page.locator('#share-modal-close').click();
    }
    await page.locator('#liuyao-method').selectOption('coin');
    await page.locator('#liuyao-cast-btn').click();
    const coinResult = await page.locator('#liuyao-result').innerText();
    await page.locator('#share-btn').click();
    const coinShareUrl = await page.locator('#share-url').inputValue();
    await page.goto(coinShareUrl, { waitUntil: 'networkidle' });
    check('Liu Yao coin share restores method',
      await page.locator('#liuyao-method').inputValue() === 'coin');
    check('Liu Yao coin share restores exact cast',
      (await page.locator('#liuyao-result').innerText()) === coinResult,
      (await page.locator('#liuyao-result').innerText()).slice(0, 300));

    console.log(JSON.stringify({ status: 'PASS', checks: checks.length, pillars: direct, independent }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(JSON.stringify({ status: 'FAIL', checks, error: error.stack || error.message }, null, 2));
  process.exit(1);
});
