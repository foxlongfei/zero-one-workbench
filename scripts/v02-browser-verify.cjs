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
  record('A01', 'stable exercise identity', await page.locator('#v02-exercise').getAttribute('data-exercise-id') === 'exercise:wger:1551:push-up', 'exercise:wger:1551:push-up');
  record('A01', 'licensed upstream record imported', await page.locator('#v02-exercise').getAttribute('data-upstream-status') === 'LICENSED_RECORD_IMPORTED', 'wger record 1551 with record-level CC-BY-SA 4 attribution');
  record('A01', 'upstream links visible', await page.locator('#v02-upstream a').count() === 3, 'record license, live API and repository snapshot links');
  record('A01', 'licensed media visible', await page.locator('#v02-upstream-media img').evaluate(image => image.complete && image.naturalWidth > 0), 'wger image loaded with visible attribution');
  record('A01', 'three licensed records visible', await page.locator('#v02-exercise').getAttribute('data-variant-count') === '3' && (await page.locator('#v02-upstream-variant').innerText()).includes('record 1964') && (await page.locator('#v02-licensed-media-variant').innerText()).includes('record 1554'), 'wger Push-Up 1551, Wide 1964, Clap 1554');
  await page.locator('#v02-catalog-select').selectOption('1554');
  await page.locator('#v02-catalog-open').click();
  record('A01', 'licensed catalog selection is traceable', await page.locator('#v02-exercise').getAttribute('data-selected-exercise-id') === 'exercise:wger:1554:clap-push-up' && await page.locator('#v02-exercise').getAttribute('data-selected-record-license') === 'CC-BY-SA 4' && (await page.locator('#v02-catalog-state').innerText()).includes('7e6f3da44a68a285'), await page.locator('#v02-catalog-state').innerText());
  record('A01', 'selected record changes the visible detail object', (await page.locator('#v02-selected-record').innerText()).includes('Clap Push-UP') && (await page.locator('#v02-selected-record').innerText()).includes('exercise:wger:1554:clap-push-up') && await page.locator('#v02-selected-record img').evaluate(image => image.complete && image.naturalWidth === 1024), await page.locator('#v02-selected-record').innerText());
  await page.locator('#v02-load-wide').click();
  record('A01', 'second variant selection works', await page.locator('#v02-exercise').getAttribute('data-variant-status') === 'LICENSED_VARIANT_IMPORTED' && (await page.locator('#v02-variant-state').innerText()).includes('无上游媒体'), await page.locator('#v02-variant-state').innerText());
  await page.locator('#v02-load-clap').click();
  record('A01', 'licensed-media variant selection works', await page.locator('#v02-exercise').getAttribute('data-media-variant-status') === 'LICENSED_VARIANT_AND_MEDIA_VENDORED' && (await page.locator('#v02-clap-state').innerText()).includes('记录与图片 CC-BY-SA 4'), await page.locator('#v02-clap-state').innerText());
  record('A01', 'vendored licensed image loads', await page.locator('#v02-licensed-media-variant img').evaluate(image => image.complete && image.naturalWidth === 1024) && (await page.locator('#v02-licensed-media-variant').innerText()).includes('7e6f3da44a68a285'), 'local CC-BY-SA image with SHA-256');
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
  let residenceId = await page.locator('#v02-residence').getAttribute('data-residence-id');
  record('B01', 'new residence identity', Boolean(residenceId && residenceId.startsWith('residence-')), residenceId);
  record('B01', 'active first question', (await page.locator('#r-next-question').innerText()).includes('住宅名称'), await page.locator('#r-next-question').innerText());

  await page.locator('#r-load-sample').click();
  await page.waitForFunction(() => (
    document.querySelector('#v02-residence')?.dataset.sampleStatus === 'REFERENCE_MODEL_NOT_USER_RESIDENCE'
  ));
  record('B01', 'traceable reference sample loaded', (await page.locator('#v02-residence').getAttribute('data-sample-status')) === 'REFERENCE_MODEL_NOT_USER_RESIDENCE' && (await page.locator('#v02-residence').getAttribute('data-source-artifact')) === 'portal/data/k3-radiance-daylight.json', await page.locator('#v02-residence').getAttribute('data-source-artifact'));
  record('B01', 'reference sample boundary visible', (await page.locator('#r-result').innerText()).includes('不是用户真实住宅'), await page.locator('#r-result').innerText());
  await page.locator('#r-load-archive-home').click();
  await page.waitForFunction(() => document.querySelector('#v02-residence')?.dataset.sampleStatus === 'PUBLIC_ARCHIVE_REAL_RESIDENCE_NOT_USER_HOME');
  record('B01', 'public archive first-floor plan loaded', await page.locator('#v02-residence').getAttribute('data-archive-license') === 'PUBLIC_DOMAIN_US_NPS' && (await page.locator('#v02-residence').getAttribute('data-source-artifact')).includes('sheet 2 of 8') && await page.locator('#v02-residence').getAttribute('data-material-sha') === '9dbb9f1ded1fb175cc76adaa80746c6015271f8a375a101edf3967fc5a64c315', await page.locator('#r-result').innerText());
  record('B01', 'archive preview decodes', await page.locator('#r-archive-preview img').evaluate(image => image.complete && image.naturalWidth === 9652 && image.naturalHeight === 7584), '9652x7584 PNG decoded');
  record('B01', 'same-case depthmapX result visible', await page.locator('#v02-residence').getAttribute('data-engine-geometry') === 'MANUAL_TRACE_V0_1_REQUIRES_SECOND_PERSON_CAD_REVIEW' && await page.locator('#v02-residence').getAttribute('data-depthmap-status') === 'DEPTHMAPX_0_9_1_VGA_708_POINTS' && await page.locator('#v02-residence').getAttribute('data-depthmap-point-count') === '708', await page.locator('#r-result').innerText());
  record('B01', 'same-case Radiance result visible', await page.locator('#v02-residence').getAttribute('data-radiance-status') === 'RADIANCE_6_0_2_CLEAR_SKY_80_SENSORS' && await page.locator('#v02-residence').getAttribute('data-radiance-sensor-count') === '80' && await page.locator('#v02-residence').getAttribute('data-cross-layer-equivalence') === 'SAME_CASE_ID_AND_PLAN_TRACE_WITH_EXPLICIT_VERTICAL_ASSUMPTIONS' && (await page.locator('#r-result').innerText()).includes('显式假设'), await page.locator('#r-result').innerText());
  record('B01', 'Radiance sensors render on calibrated same-case geometry', await page.locator('#r-radiance-map [data-radiance-sensor]').count() === 80 && await page.locator('#r-radiance-map [data-radiance-window]').count() === 6 && await page.locator('#v02-residence').getAttribute('data-geometry-trace-case') === 'residence:habs-dc-97:frederick-douglass-house' && (await page.locator('#r-radiance-legend').innerText()).includes('不是原图像素级配准'), '80 sensors + 6 assumed south windows on trace-calibrated geometry');
  const exportDownload = page.waitForEvent('download');
  await page.locator('#r-export').click();
  const archiveExport = await exportDownload;
  const archiveExportPath = await archiveExport.path();
  const archiveDossier = JSON.parse(fs.readFileSync(archiveExportPath, 'utf8'));
  record('B01', 'continuous dossier exports same-case engine evidence', archiveDossier.id === 'residence:habs-dc-97:frederick-douglass-house' && archiveDossier.boundaries.modelRun === 'DEPTHMAPX_VGA_RUN_FOR_THIS_TRACE' && archiveDossier.analysisChain.caseId === archiveDossier.id && archiveDossier.analysisChain.depthmapX.pointCount === 708 && archiveDossier.analysisChain.radiance.sensorCount === 80, `${archiveDossier.id}｜depthmapX ${archiveDossier.analysisChain.depthmapX.pointCount}｜Radiance ${archiveDossier.analysisChain.radiance.sensorCount}`);
  await page.locator('#r-engine-overlay').screenshot({ path: path.join(artifactDir, 'residence-b01-radiance-map.png') });
  await page.locator('#r-new').click();
  residenceId = await page.locator('#v02-residence').getAttribute('data-residence-id');

  await page.locator('#r-name').fill('东明居');
  await page.locator('#r-place').fill('上海市浦东新区');
  await page.locator('#r-material').fill('现场手工测量记录 v1');
  await page.locator('#r-source').selectOption('DRAWING_OR_ARCHIVE');
  await page.locator('#r-confidence').selectOption('MEDIUM');
  await page.locator('#r-material-license').fill('PROJECT_REFERENCE_ONLY');
  await page.locator('#r-material-file').setInputFiles('research/depthmap/prototype-house.dxf');
  await page.locator('#r-ingest-material').click();
  await page.waitForFunction(() => document.querySelector('#v02-residence')?.dataset.materialCount === '1');
  record('B01', 'actual material hashed and bound', await page.locator('#v02-residence').getAttribute('data-last-material-sha') === '8e54d1682d7212ba95a9bed996ba3139357ea738efb4563488d9e1e8156133a3', await page.locator('#r-material-manifest').innerText());
  record('B01', 'material boundary remains explicit', (await page.locator('#r-result').innerText()).includes('尚未运行空间/环境模型'), await page.locator('#r-result').innerText());
  await page.locator('#r-save').click();
  record('B01', 'same ID after save', await page.locator('#v02-residence').getAttribute('data-residence-id') === residenceId, residenceId);
  record('B01', 'field evidence captured', await page.locator('#r-evidence li[data-field]').count() === 3, 'name/place/material each have evidence');
  const revisionText = await page.locator('#r-history').textContent();
  record('B01', 'revision captured', await page.locator('#r-history li').count() === 1 && revisionText.includes('已知 5/11'), revisionText);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#v02-residence').waitFor();
  record('B01', 'same ID after reload', await page.locator('#v02-residence').getAttribute('data-residence-id') === residenceId, residenceId);
  record('B01', 'evidence survives reload', await page.locator('#r-evidence li[data-field]').count() === 3, '3 evidence rows persisted');
  record('B01', 'material manifest survives reload', await page.locator('#v02-residence').getAttribute('data-material-count') === '1', await page.locator('#r-material-manifest').innerText());
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
