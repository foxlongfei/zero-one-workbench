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
    await page.locator('#share-btn').click();
    const invalidBaziShareToast = page.locator('.toast').last();
    await invalidBaziShareToast.waitFor({ state: 'visible' });
    check('BaZi sharing is blocked while the chart input is invalid',
      !(await page.locator('#share-modal').isVisible()) &&
      (await invalidBaziShareToast.innerText()).includes('日期无效'));
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
    await page.locator('#share-btn').click();
    await page.locator('.toast').waitFor({ state: 'visible' });
    check('invalid Liu Yao input cannot share a stale previous cast',
      !(await page.locator('#share-modal').isVisible()) &&
      (await page.locator('.toast').innerText()).trim().length > 0);
    await page.locator('#lang-toggle').click();
    check('Liu Yao validation status follows language switch',
      (await page.locator('#liuyao-result').innerText()).includes('Number casting needs two integers') &&
      await page.locator('#liuyao-result [role="alert"]').count() === 1);
    await page.locator('#lang-toggle').click();
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
    const englishHexagramNames = await page.locator('#liuyao-result .hex-name').allInnerTexts();
    const englishHexagramDescriptions = await page.locator('#liuyao-result .hex-desc').allInnerTexts();
    check('Liu Yao hexagram names follow bilingual UI',
      JSON.stringify(englishHexagramNames) === JSON.stringify([
        'The Wanderer (Hexagram 56)',
        'Retreat (Hexagram 33)',
      ]) &&
      englishHexagramNames.every(label => !/[\u4e00-\u9fff]/.test(label)),
      englishHexagramNames.join(' | '));
    check('Liu Yao hexagram descriptions follow bilingual UI',
      JSON.stringify(englishHexagramDescriptions) === JSON.stringify([
        'Fire over Mountain.',
        'Heaven over Mountain.',
      ]) &&
      englishHexagramDescriptions.every(label => !/[\u4e00-\u9fff]/.test(label)),
      englishHexagramDescriptions.join(' | '));
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
    await page.locator('#share-btn').click();
    const invalidZiweiShareToast = page.locator('.toast').last();
    await invalidZiweiShareToast.waitFor({ state: 'visible' });
    check('Zi Wei sharing is blocked while the chart input is invalid',
      !(await page.locator('#share-modal').isVisible()) &&
      (await invalidZiweiShareToast.innerText()).includes('日期无效'));
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
    check('BaZi date labels and lunar value follow bilingual UI',
      englishBaziDate.includes('Gregorian 1990-05-15') &&
      englishBaziDate.includes('Lunar Date 1990 · 4th Lunar Month · Day 21') &&
      !/[\u4e00-\u9fff]/.test(englishBaziDate),
      englishBaziDate);
    const englishNayinValues = await page.locator(
      '#bazi-result .nayin-label, #bazi-result .tm-nayin, #bazi-result .lp-nayin, #bazi-result .fy-nayin'
    ).allInnerTexts();
    check('BaZi Nayin values follow bilingual UI',
      englishNayinValues.length >= 24 &&
      englishNayinValues.includes('Earth by the Road') &&
      englishNayinValues.every(label => !/[\u4e00-\u9fff]/.test(label)),
      englishNayinValues.join(', '));
    const englishAuxiliaryPillars = await page.locator('#bazi-result .tm-value').allInnerTexts();
    const englishAuxiliaryStars = await page.locator('#bazi-result .shensha-tag').allInnerTexts();
    const englishAuxiliaryText = englishAuxiliaryPillars.concat(englishAuxiliaryStars).join(' | ');
    check('BaZi conception, destiny and auxiliary-star values follow bilingual UI',
      JSON.stringify(englishAuxiliaryPillars) === JSON.stringify(['RenShen', 'GuiWei']) &&
      ['Heavenly Noble', 'Canopy Star', 'General Star', 'Heavenly Virtue', 'Monthly Virtue']
        .every(label => englishAuxiliaryText.includes(label)) &&
      ['Year', 'Month', 'Day', 'Hour'].every(label => englishAuxiliaryText.includes(label)) &&
      !/[\u4e00-\u9fff]/.test(englishAuxiliaryText),
      englishAuxiliaryText);
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
    const englishBaziNarratives = await page.locator(
      '#bazi-result .strength-factors, #bazi-result .pattern-section, #bazi-result .favorable-section, #bazi-result .relationships-section'
    ).allInnerTexts();
    const fullEnglishBazi = await page.locator('#bazi-result').innerText();
    check('BaZi narrative analysis follows bilingual UI',
      englishBaziNarratives.length >= 3 &&
      englishBaziNarratives.every(text => text.trim().length > 0 && !/[\u3400-\u9fff]/.test(text)) &&
      !/[\u3400-\u9fff]/.test(fullEnglishBazi),
      englishBaziNarratives.join(' | '));
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
    const fullEnglishZiwei = await page.locator('#ziwei-result').innerText();
    check('entire Zi Wei result follows bilingual UI',
      fullEnglishZiwei.trim().length > 80 && !/[\u4e00-\u9fff]/.test(fullEnglishZiwei),
      fullEnglishZiwei.slice(0, 400));
    check('footer resource links follow bilingual UI',
      await page.locator('#local-license-link').innerText() === 'MIT License' &&
      await page.locator('#contribution-guide-link').innerText() === 'Contribution Guide');
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

    const sameTabBaziPayload = Buffer.from(JSON.stringify({
      tab: 'bazi', lang: 'en', date: '1991-06-16', hour: '3', gender: 'female'
    }), 'utf8').toString('base64');
    await page.evaluate(payload => { window.location.hash = payload; }, sameTabBaziPayload);
    await page.waitForFunction(() =>
      document.getElementById('bazi-date').value === '1991-06-16' &&
      document.getElementById('panel-bazi').style.display === 'block'
    );
    check('same-tab share navigation restores a different BaZi input',
      await page.locator('#bazi-date').inputValue() === '1991-06-16' &&
      await page.locator('#bazi-hour').inputValue() === '3' &&
      await page.locator('#bazi-gender-female').isChecked());
    check('same-tab share navigation recalculates the BaZi chart',
      await page.locator('#bazi-result [role="alert"]').count() === 0 &&
      await page.locator('#bazi-result .stems-row .stem').count() === 4 &&
      await page.locator('#bazi-result .branches-row .branch').count() === 4);

    await page.locator('#tab-liuyao').click();
    await page.locator('#liuyao-method').selectOption('number');
    await page.locator('#liuyao-num1').fill('11');
    await page.locator('#liuyao-num2').fill('22');
    await page.locator('#liuyao-num3').fill('6');
    await page.locator('#liuyao-cast-btn').click();
    await page.locator('#share-btn').click();
    const liuyaoShareUrl = await page.locator('#share-url').inputValue();
    await page.locator('#share-modal-close').click();
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
    check('entire Liu Yao result follows bilingual UI',
      !/[\u4e00-\u9fff]/.test(restoredLiuyao),
      restoredLiuyao.slice(0, 400));

    const sameTabLiuyaoPayload = Buffer.from(JSON.stringify({
      tab: 'liuyao', lang: 'en', method: 'number',
      n1: '8', n2: '8', n3: '6', lines: '8,8,8,8,8,6'
    }), 'utf8').toString('base64');
    await page.evaluate(payload => { window.location.hash = payload; }, sameTabLiuyaoPayload);
    await page.waitForFunction(() =>
      document.getElementById('liuyao-num1').value === '8' &&
      document.querySelectorAll('#liuyao-result .hex-header').length === 1
    );
    check('same-tab share navigation restores different Liu Yao numbers',
      await page.locator('#liuyao-num1').inputValue() === '8' &&
      await page.locator('#liuyao-num2').inputValue() === '8' &&
      await page.locator('#liuyao-num3').inputValue() === '6');
    check('same-tab share navigation renders the restored Liu Yao lines',
      await page.locator('#liuyao-result .hex-lines-table tbody tr.moving-row').count() === 1);

    await page.goBack({ waitUntil: 'networkidle' });
    check('browser Back restores the preceding Liu Yao share',
      await page.locator('#panel-liuyao').isVisible() &&
      await page.locator('#liuyao-num1').inputValue() === '11' &&
      await page.locator('#liuyao-num2').inputValue() === '22');
    await page.goBack({ waitUntil: 'networkidle' });
    check('browser Back restores the preceding shared BaZi chart',
      await page.locator('#panel-bazi').isVisible() &&
      await page.locator('#bazi-date').inputValue() === '1991-06-16' &&
      await page.locator('#bazi-gender-female').isChecked());
    await page.goBack({ waitUntil: 'networkidle' });
    check('browser Back to the plain URL clears the shared chart state',
      await page.evaluate(() => window.location.hash === '') &&
      await page.locator('#panel-bazi').isVisible() &&
      await page.locator('#bazi-gender-male').isChecked() &&
      await page.locator('#bazi-hour').inputValue() === '0');
    await page.goForward({ waitUntil: 'networkidle' });
    check('browser Forward restores the BaZi share again',
      await page.locator('#bazi-date').inputValue() === '1991-06-16' &&
      await page.locator('#bazi-gender-female').isChecked());
    await page.goForward({ waitUntil: 'networkidle' });
    check('browser Forward restores the first Liu Yao share again',
      await page.locator('#panel-liuyao').isVisible() &&
      await page.locator('#liuyao-num1').inputValue() === '11' &&
      await page.locator('#liuyao-num2').inputValue() === '22');
    await page.goForward({ waitUntil: 'networkidle' });
    check('browser Forward restores the Liu Yao share again',
      await page.locator('#panel-liuyao').isVisible() &&
      await page.locator('#liuyao-num1').inputValue() === '8' &&
      await page.locator('#liuyao-result .hex-lines-table tbody tr.moving-row').count() === 1);

    await page.evaluate(() => { window.location.hash = 'damaged-share-state'; });
    const sameTabInvalidShareToast = page.locator('.toast').last();
    await sameTabInvalidShareToast.waitFor({ state: 'visible' });
    check('same-tab damaged share clears the preceding valid chart',
      await page.evaluate(() => window.location.hash === '') &&
      await page.locator('#panel-bazi').isVisible() &&
      await page.locator('#bazi-gender-male').isChecked() &&
      await page.locator('#bazi-hour').inputValue() === '0' &&
      !(await page.locator('#panel-liuyao').isVisible()));

    await page.evaluate(payload => { window.location.hash = payload; }, sameTabLiuyaoPayload);
    await page.waitForFunction(() =>
      document.getElementById('liuyao-num1').value === '8' &&
      document.querySelectorAll('#liuyao-result .hex-header').length === 1
    );

    await page.locator('#liuyao-num1').fill('12');
    check('editing number-cast inputs invalidates the stale result',
      (await page.locator('#liuyao-result').innerText()) === 'No data' &&
      await page.locator('#liuyao-result .hex-header').count() === 0);
    await page.locator('#share-btn').click();
    const blockedShareToast = page.locator('.toast').last();
    await blockedShareToast.waitFor({ state: 'visible' });
    check('sharing is blocked without a current Liu Yao result',
      !(await page.locator('#share-modal').isVisible()) &&
      (await blockedShareToast.innerText()).trim().length > 0);

    if (await page.locator('#share-modal').isVisible()) {
      await page.locator('#share-modal-close').click();
    }
    await page.locator('#liuyao-method').selectOption('coin');
    check('changing Liu Yao method clears the previous method result',
      (await page.locator('#liuyao-result').innerText()) === 'No data' &&
      await page.locator('#liuyao-result .hex-header').count() === 0);
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
      coinResult.includes('Dispersion') &&
      coinResult.includes('The Well') &&
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

    const malformedLiuYaoShare = await page.evaluate(() => {
      const payload = { tab: 'liuyao', lang: 'en', method: 'coin', lines: '6,7' };
      return window.location.origin + window.location.pathname + '#' + btoa(JSON.stringify(payload));
    });
    await page.goto(malformedLiuYaoShare, { waitUntil: 'networkidle' });
    await page.locator('.toast').waitFor({ state: 'visible' });
    const malformedLiuYaoToast = await page.locator('.toast').innerText();
    check('malformed Liu Yao share payload is rejected instead of showing a blank chart',
      await page.evaluate(() => window.location.hash === '') &&
      malformedLiuYaoToast.includes('invalid or damaged') &&
      await page.locator('#liuyao-result .hex-header').count() === 0,
      malformedLiuYaoToast);

    const invalidLiuYaoMethodPayload = Buffer.from(JSON.stringify({
      tab: 'liuyao', lang: 'en', method: 'unknown', lines: '6,7,8,9,6,7',
    })).toString('base64');
    await page.goto(
      base + '/portal/fortune-teller/index.html?invalid-liuyao-method-test=1#' +
        invalidLiuYaoMethodPayload,
      { waitUntil: 'networkidle' }
    );
    await page.locator('.toast').waitFor({ state: 'visible' });
    const invalidLiuYaoMethodToast = await page.locator('.toast').innerText();
    check('unknown Liu Yao share method is rejected instead of silently using time casting',
      await page.evaluate(() => window.location.hash === '') &&
      invalidLiuYaoMethodToast.includes('invalid or damaged'),
      invalidLiuYaoMethodToast);

    const invalidLiuYaoNumbersPayload = Buffer.from(JSON.stringify({
      tab: 'liuyao', lang: 'en', method: 'number', n1: '0', n2: '7', n3: '',
    })).toString('base64');
    await page.goto(
      base + '/portal/fortune-teller/index.html?invalid-liuyao-numbers-test=1#' +
        invalidLiuYaoNumbersPayload,
      { waitUntil: 'networkidle' }
    );
    await page.locator('.toast').waitFor({ state: 'visible' });
    const invalidLiuYaoNumbersToast = await page.locator('.toast').innerText();
    check('out-of-range Liu Yao share numbers are rejected before casting',
      await page.evaluate(() => window.location.hash === '') &&
      invalidLiuYaoNumbersToast.includes('invalid or damaged'),
      invalidLiuYaoNumbersToast);

    const mismatchedLiuYaoNumberLinesPayload = Buffer.from(JSON.stringify({
      tab: 'liuyao', lang: 'en', method: 'number',
      n1: '3', n2: '7', n3: '', lines: '7,7,7,7,7,7',
    })).toString('base64');
    await page.goto(
      base + '/portal/fortune-teller/index.html?mismatched-liuyao-number-lines-test=1#' +
        mismatchedLiuYaoNumberLinesPayload,
      { waitUntil: 'networkidle' }
    );
    await page.locator('.toast').waitFor({ state: 'visible' });
    const mismatchedLiuYaoNumberLinesToast = await page.locator('.toast').innerText();
    check('number-cast share lines must match the supplied numbers',
      await page.evaluate(() => window.location.hash === '') &&
      mismatchedLiuYaoNumberLinesToast.includes('invalid or damaged'),
      mismatchedLiuYaoNumberLinesToast);

    const malformedBaziPayload = Buffer.from(JSON.stringify({
      tab: 'bazi', lang: 'en', date: '2026-02-31', hour: '4', gender: 'male',
    })).toString('base64');
    await page.goto(
      base + '/portal/fortune-teller/index.html?invalid-bazi-share-test=1#' + malformedBaziPayload,
      { waitUntil: 'networkidle' }
    );
    await page.locator('.toast').waitFor({ state: 'visible' });
    const malformedBaziToast = await page.locator('.toast').innerText();
    check('impossible BaZi date in share payload is rejected',
      await page.evaluate(() => window.location.hash === '') &&
      malformedBaziToast.includes('invalid or damaged'),
      malformedBaziToast);

    const malformedZiweiPayload = Buffer.from(JSON.stringify({
      tab: 'ziwei', lang: 'en', y: '2200', m: '1', d: '1', h: '0', gender: 'male',
    })).toString('base64');
    await page.goto(
      base + '/portal/fortune-teller/index.html?invalid-ziwei-share-test=1#' + malformedZiweiPayload,
      { waitUntil: 'networkidle' }
    );
    await page.locator('.toast').waitFor({ state: 'visible' });
    const malformedZiweiToast = await page.locator('.toast').innerText();
    check('out-of-range Zi Wei date in share payload is rejected',
      await page.evaluate(() => window.location.hash === '') &&
      malformedZiweiToast.includes('invalid or damaged'),
      malformedZiweiToast);

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
