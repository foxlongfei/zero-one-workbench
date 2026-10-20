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
    const chineseBoundary = await page.locator('#interpretation-boundary').innerText();
    check('fortune results disclose interpretation boundary',
      chineseBoundary.includes('不是可证实的未来预测') &&
      chineseBoundary.includes('不能替代医疗、法律、财务'),
      chineseBoundary);
    check('quick-start action is localized instead of exposing a missing key',
      await page.locator('#hero-cta-btn').innerText() === '快速开始');

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

    const bundledBoundaryCast = await page.evaluate(() => {
      const cast = LiuYao.castByNumbers(8, 8, 6);
      return {
        primary: cast.primary.name,
        changed: cast.changed && cast.changed.name,
        rawLines: cast.rawLines,
        movingLines: cast.movingLines,
      };
    });
    check('Bundled Liu Yao engine maps zero remainders to Kun and line 6',
      bundledBoundaryCast.primary === '坤' &&
      bundledBoundaryCast.changed === '豫' &&
      JSON.stringify(bundledBoundaryCast.rawLines) === JSON.stringify([8, 8, 8, 8, 8, 6]) &&
      JSON.stringify(bundledBoundaryCast.movingLines) === JSON.stringify([6]),
      JSON.stringify(bundledBoundaryCast));

    await page.locator('#liuyao-num1').fill('8');
    await page.locator('#liuyao-num2').fill('8');
    await page.locator('#liuyao-num3').fill('6');
    await page.locator('#liuyao-cast-btn').click();
    const boundaryCastText = await page.locator('#liuyao-result').innerText();
    const boundaryMovingLines = await page.locator(
      '#liuyao-result .hex-lines-table tbody tr.moving-row td:first-child'
    ).allInnerTexts();
    check('Liu Yao UI uses traditional one-based remainder mapping',
      boundaryCastText.includes('坤') &&
      boundaryCastText.includes('豫') &&
      JSON.stringify(boundaryMovingLines) === JSON.stringify(['上爻']),
      boundaryCastText.slice(0, 400));

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
    await page.locator('#lang-toggle').click();
    const englishLiuyao = await page.locator('#liuyao-result').innerText();
    check('Liu Yao rendered result follows language switch',
      englishLiuyao.includes('Primary') && englishLiuyao.includes('Moving Lines'),
      englishLiuyao.slice(0, 300));
    const englishLineLabels = [
      ...(await page.locator('#liuyao-result .hex-lines-table tbody td:first-child').allInnerTexts()),
      ...(await page.locator('#liuyao-result .hex-svg-wrap text').allInnerTexts()),
      await page.locator('#liuyao-result .hex-moving').innerText(),
    ];
    check('Liu Yao line positions follow bilingual UI',
      englishLineLabels.some(label => label.includes('Line 1')) &&
      englishLineLabels.every(label => !/[初二三四五上爻]/.test(label)),
      englishLineLabels.join(', '));
    await page.locator('#lang-toggle').click();

    await page.locator('#reset-btn').click();
    check('Liu Yao reset only resets active module',
      await page.locator('#liuyao-method').inputValue() === 'time' &&
      await page.locator('#liuyao-number-inputs').isHidden() &&
      await page.locator('#liuyao-num1').inputValue() === '3' &&
      await page.locator('#liuyao-num2').inputValue() === '7' &&
      await page.locator('#liuyao-num3').inputValue() === '' &&
      (await page.locator('#liuyao-result').innerText()).trim().length > 0);

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

    await page.locator('#ziwei-year').fill('1990');
    await page.locator('#ziwei-month').selectOption('1');
    await page.locator('#ziwei-day').fill('30');
    await page.locator('#ziwei-day').press('Tab');
    check('Zi Wei rejects day 30 in a 29-day lunar month',
      await page.locator('#ziwei-result [role="alert"]').count() === 1 &&
      (await page.locator('#ziwei-result').innerText()).includes('日期无效'));
    await page.locator('#ziwei-day').fill('29');
    await page.locator('#ziwei-day').press('Tab');
    check('Zi Wei recovers on the last valid day of a short lunar month',
      await page.locator('#ziwei-result .ziwei-cell').count() >= 12);

    await page.locator('#ziwei-year').fill('2001');
    await page.locator('#ziwei-month').selectOption('9');
    await page.locator('#ziwei-day').fill('9');
    await page.locator('#ziwei-hour').selectOption('2');
    await page.locator('#ziwei-gender-female').check();
    await page.locator('#reset-btn').click();
    check('Zi Wei reset restores original chart inputs',
      await page.locator('#ziwei-year').inputValue() === '1990' &&
      await page.locator('#ziwei-month').inputValue() === '4' &&
      await page.locator('#ziwei-day').inputValue() === '21' &&
      await page.locator('#ziwei-hour').inputValue() === '7' &&
      await page.locator('#ziwei-gender-male').isChecked() &&
      await page.locator('#ziwei-result .ziwei-cell').count() >= 12);

    await page.locator('#lang-toggle').click();
    check('bilingual UI switches', (await page.locator('#tab-bazi').innerText()).toLowerCase().includes('bazi'));
    const englishStrength = await page.locator('#bazi-result .day-master-info').innerText();
    check('BaZi strength summary follows bilingual UI',
      englishStrength.includes('Neutral') &&
      englishStrength.includes('Score') &&
      !/(中和|得分)/.test(englishStrength),
      englishStrength);
    const englishStrengthDetails = await page.locator('#bazi-result .strength-factors summary').innerText();
    const englishLuckDirection = await page.locator('#bazi-result .luck-direction').innerText();
    check('BaZi strength details and luck direction follow bilingual UI',
      englishStrengthDetails === 'Strength analysis details' &&
      englishLuckDirection.includes('Start Age') &&
      englishLuckDirection.includes('yrs') &&
      /(Forward|Backward)/.test(englishLuckDirection) &&
      !/(强弱分析详情|起运|顺行|逆行)/.test(englishStrengthDetails + ' ' + englishLuckDirection),
      englishStrengthDetails + ' | ' + englishLuckDirection);
    const englishBaziDate = await page.locator('#bazi-result .bazi-date-info').innerText();
    check('BaZi date labels follow bilingual UI',
      englishBaziDate.includes('Gregorian 1990-05-15') &&
      englishBaziDate.includes('Lunar Date') &&
      !englishBaziDate.includes('阳历'),
      englishBaziDate);
    const englishBaziLabels = await page.locator(
      '#bazi-result .tm-label, #bazi-result .shensha-section h3, #bazi-result .pattern-section h3, #bazi-result .favorable-section h3'
    ).allInnerTexts();
    check('BaZi core result sections follow bilingual UI',
      ['Fetal Origin', 'Destiny Palace', 'Auxiliary Stars', 'Pattern Analysis', 'Favorable Elements']
        .every(label => englishBaziLabels.includes(label)),
      englishBaziLabels.join(', '));
    const englishElementNames = await page.locator('#bazi-result .el-name').allInnerTexts();
    const englishElementStatuses = await page.locator('#bazi-result .el-status').allInnerTexts();
    check('BaZi five-element details follow bilingual UI',
      JSON.stringify(englishElementNames) === JSON.stringify(['Wood', 'Fire', 'Earth', 'Metal', 'Water']) &&
      englishElementStatuses.every(label => ['Abundant', 'Balanced', 'Weak', 'Missing'].includes(label)),
      englishElementNames.join(', ') + ' | ' + englishElementStatuses.join(', '));
    const englishPillarStems = await page.locator('#bazi-result .stems-row .stem').allInnerTexts();
    const englishPillarBranches = await page.locator('#bazi-result .branches-row .branch').allInnerTexts();
    const englishPillarZodiacs = await page.locator('#bazi-result .branches-row small').allInnerTexts();
    check('BaZi pillars and zodiac follow bilingual UI',
      JSON.stringify(englishPillarStems) === JSON.stringify(['Geng', 'Xin', 'Geng', 'Gui']) &&
      JSON.stringify(englishPillarBranches) === JSON.stringify(['Wu', 'Si', 'Chen', 'Wei']) &&
      JSON.stringify(englishPillarZodiacs) === JSON.stringify(['Horse', 'Snake', 'Dragon', 'Goat']),
      englishPillarStems.join(', ') + ' | ' + englishPillarBranches.join(', ') + ' | ' + englishPillarZodiacs.join(', '));
    const englishTenGods = await page.locator('#bazi-result .ten-god-label, #bazi-result .hidden-row sub').allInnerTexts();
    check('BaZi Ten Gods follow bilingual UI',
      englishTenGods.includes('Companion') &&
      englishTenGods.includes('Rob Wealth') &&
      englishTenGods.includes('Day Master') &&
      englishTenGods.includes('Hurting Officer') &&
      englishTenGods.every(label => !/[\u4e00-\u9fff]/.test(label)),
      englishTenGods.join(', '));
    const englishLuckStems = await page.locator('#bazi-result .lp-stem').allInnerTexts();
    const englishLuckBranches = await page.locator('#bazi-result .lp-branch').allInnerTexts();
    const englishFlowPillars = await page.locator('#bazi-result .fy-gz').allInnerTexts();
    const englishFlowTenGods = await page.locator('#bazi-result .fy-tg').allInnerTexts();
    check('BaZi luck pillars and flow years follow bilingual UI',
      englishLuckStems.every(label => /^[A-Za-z]+$/.test(label)) &&
      englishLuckBranches.every(label => /^[A-Za-z]+$/.test(label)) &&
      englishFlowPillars.every(label => /^[A-Za-z]+$/.test(label)) &&
      englishFlowTenGods.every(label => !/[\u4e00-\u9fff]/.test(label)),
      englishLuckStems.join(', ') + ' | ' + englishLuckBranches.join(', ') + ' | ' + englishFlowPillars.join(', '));
    const englishBoundary = await page.locator('#interpretation-boundary').innerText();
    check('interpretation boundary follows bilingual UI',
      englishBoundary.includes('not verifiable predictions of the future') &&
      englishBoundary.includes('do not replace medical, legal, financial'),
      englishBoundary);
    check('document language follows bilingual UI',
      await page.locator('html').getAttribute('lang') === 'en');
    const englishHeaderLabels = await page.locator(
      '#portal-return, #lang-toggle, #theme-toggle, #reset-btn, #print-btn, #share-btn'
    ).evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')));
    check('header actions expose English accessible names after language switch',
      JSON.stringify(englishHeaderLabels) === JSON.stringify([
        'Back to Zero-One Portal',
        'Switch language',
        'Toggle theme',
        'Reset current chart',
        'Print or save current chart as PDF',
        'Share current chart',
      ]),
      englishHeaderLabels.join(', '));
    check('language and theme hover hints follow bilingual UI',
      await page.locator('#lang-toggle').getAttribute('title') === 'Switch language' &&
      await page.locator('#theme-toggle').getAttribute('title') === 'Toggle theme');
    const englishSupportingLabels = await page.locator(
      '.hero, .tab-nav, .radio-group, #five-elements-chart, #radar-canvas, .bottom-nav, #share-modal, #share-modal-close, #share-url'
    ).evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')));
    check('supporting navigation, chart and share controls follow bilingual accessibility',
      (await page.locator('.skip-link').innerText()) === 'Skip to main content' &&
      (await page.locator('#hero-cta-btn').innerText()) === 'Quick start' &&
      englishSupportingLabels.includes('Tianji introduction') &&
      englishSupportingLabels.includes('Feature options') &&
      englishSupportingLabels.filter(label => label === 'Gender').length === 2 &&
      englishSupportingLabels.includes('Five-elements strength radar chart') &&
      englishSupportingLabels.includes('Bottom navigation') &&
      englishSupportingLabels.includes('Share current chart') &&
      englishSupportingLabels.includes('Close share dialog') &&
      englishSupportingLabels.includes('Share link'),
      englishSupportingLabels.join(', '));
    check('Liu Yao number labels follow bilingual UI',
      await page.locator('label[for="liuyao-num1"]').innerText() === 'Number 1' &&
      await page.locator('label[for="liuyao-num2"]').innerText() === 'Number 2' &&
      (await page.locator('label[for="liuyao-num3"]').innerText()).includes('Number 3'));
    check('Zi Wei lunar month selector follows bilingual UI',
      await page.locator('#ziwei-month option').first().innerText() === '1st Lunar Month' &&
      await page.locator('#ziwei-month option').last().innerText() === '12th Lunar Month');
    check('Zi Wei hour selector follows bilingual UI',
      (await page.locator('#ziwei-hour option').first().innerText()).startsWith('Zi ') &&
      (await page.locator('#ziwei-hour option').last().innerText()).startsWith('Hai '));
    const englishZiweiStars = await page.locator('#ziwei-result .zw-star').allInnerTexts();
    check('Zi Wei stars follow bilingual UI',
      englishZiweiStars.includes('Zi Wei') &&
      englishZiweiStars.every(label => !/[\u4e00-\u9fff]/.test(label)),
      englishZiweiStars.join(', '));
    const englishZiweiBranches = await page.locator('#ziwei-result .zw-branch').allInnerTexts();
    check('Zi Wei branches follow bilingual UI',
      englishZiweiBranches.length === 12 &&
      englishZiweiBranches.every(label => !/[\u4e00-\u9fff]/.test(label)),
      englishZiweiBranches.join(', '));
    check('print action follows bilingual UI',
      await page.locator('#print-btn').innerText() === 'Print/PDF');
    await page.evaluate(() => {
      window.__printInvoked = false;
      window.print = () => { window.__printInvoked = true; };
    });
    await page.locator('#print-btn').click();
    check('print action invokes the browser print flow',
      await page.evaluate(() => window.__printInvoked === true));
    await page.emulateMedia({ media: 'print' });
    const printedPanelDisplays = await page.evaluate(() => ({
      bazi: getComputedStyle(document.getElementById('panel-bazi')).display,
      liuyao: getComputedStyle(document.getElementById('panel-liuyao')).display,
      ziwei: getComputedStyle(document.getElementById('panel-ziwei')).display,
    }));
    check('print output contains only the active chart',
      printedPanelDisplays.bazi === 'none' &&
      printedPanelDisplays.liuyao === 'none' &&
      printedPanelDisplays.ziwei !== 'none',
      JSON.stringify(printedPanelDisplays));
    await page.emulateMedia({ media: 'screen' });
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

    await page.locator('#reset-btn').click();
    check('reset clears shared URL state',
      await page.evaluate(() => window.location.hash === '') &&
      await page.locator('#ziwei-year').inputValue() === '1990' &&
      await page.locator('#ziwei-month').inputValue() === '4' &&
      await page.locator('#ziwei-day').inputValue() === '21' &&
      await page.locator('#ziwei-hour').inputValue() === '7' &&
      await page.locator('#ziwei-gender-male').isChecked());

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
    await page.evaluate(() => {
      const sequence = [
        0.1, 0.1, 0.1,
        0.1, 0.1, 0.9,
        0.1, 0.9, 0.9,
        0.9, 0.9, 0.9,
        0.1, 0.1, 0.9,
        0.1, 0.9, 0.9,
      ];
      let index = 0;
      Math.random = () => sequence[index++ % sequence.length];
    });
    await page.locator('#liuyao-cast-btn').click();
    const coinResult = await page.locator('#liuyao-result').innerText();
    const deterministicMovingLines = await page.locator(
      '#liuyao-result .hex-lines-table tbody tr.moving-row td:first-child'
    ).allInnerTexts();
    check('Liu Yao coin values follow traditional 6/7/8/9 semantics',
      coinResult.includes('涣') &&
      coinResult.includes('井') &&
      JSON.stringify(deterministicMovingLines) === JSON.stringify(['Line 4', 'Line 1']),
      coinResult.slice(0, 400));
    await page.locator('#share-btn').click();
    const coinShareUrl = await page.locator('#share-url').inputValue();
    const sharedCoinPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await sharedCoinPage.goto(coinShareUrl, { waitUntil: 'networkidle' });
    check('Liu Yao coin share restores method',
      await sharedCoinPage.locator('#liuyao-method').inputValue() === 'coin');
    const restoredCoinResult = await sharedCoinPage.locator('#liuyao-result').innerText();
    check('Liu Yao coin share restores exact cast',
      restoredCoinResult === coinResult,
      restoredCoinResult.slice(0, 300));
    await sharedCoinPage.close();

    await page.goto(base + '/portal/fortune-teller/index.html?invalid-share-test=1#damaged-share-state', {
      waitUntil: 'networkidle',
    });
    await page.locator('.toast').waitFor({ state: 'visible' });
    const invalidShareToast = await page.locator('.toast').innerText();
    check('invalid share link is cleared with actionable feedback',
      await page.evaluate(() => window.location.hash === '') &&
      (invalidShareToast.includes('invalid or damaged') ||
       invalidShareToast.includes('分享链接无效或已损坏')),
      invalidShareToast);

    const mobilePage = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await mobilePage.goto(base + '/portal/fortune-teller/index.html', { waitUntil: 'networkidle' });
    const mobileHeaderActions = mobilePage.locator(
      '#portal-return, #lang-toggle, #theme-toggle, #reset-btn, #print-btn, #share-btn'
    );
    check('mobile header keeps every product action visible',
      await mobileHeaderActions.count() === 6 &&
      await mobileHeaderActions.evaluateAll(elements => elements.every(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 &&
          rect.left >= 0 && rect.right <= window.innerWidth;
      })));
    check('mobile product has no horizontal page overflow',
      await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      await mobilePage.evaluate(() =>
        document.documentElement.scrollWidth + '>' + window.innerWidth));
    await mobilePage.close();

    console.log(JSON.stringify({ status: 'PASS', checks: checks.length, pillars: direct, independent }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(JSON.stringify({ status: 'FAIL', checks, error: error.stack || error.message }, null, 2));
  process.exit(1);
});
