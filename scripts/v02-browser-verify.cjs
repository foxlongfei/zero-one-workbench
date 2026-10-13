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
  if (await page.locator('#v02-ex-notes').count()) {
    record('A01', 'variant notes isolated', (await page.locator('#v02-ex-notes').inputValue()) !== 'A01-normal-test', 'wide variant must not inherit normal notes');
    await page.locator('#v02-ex-notes').fill('A01-wide-test');
    await page.locator('#v02-ex-notes-save').click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#v02-load-wide').click();
    record('A01', 'variant notes persist after reload', (await page.locator('#v02-ex-notes').inputValue()) === 'A01-wide-test', 'wide notes reloaded from localStorage');
  }
  record('A01', 'second variant selection works', await page.locator('#v02-exercise').getAttribute('data-variant-status') === 'LICENSED_VARIANT_IMPORTED' && (await page.locator('#v02-variant-state').innerText()).includes('无上游媒体'), await page.locator('#v02-variant-state').innerText());
  await page.locator('#v02-load-clap').click();
  record('A01', 'licensed-media variant selection works', await page.locator('#v02-exercise').getAttribute('data-media-variant-status') === 'LICENSED_VARIANT_AND_MEDIA_VENDORED' && (await page.locator('#v02-clap-state').innerText()).includes('记录与图片 CC-BY-SA 4'), await page.locator('#v02-clap-state').innerText());
  record('A01', 'vendored licensed image loads', await page.locator('#v02-licensed-media-variant img').evaluate(image => image.complete && image.naturalWidth === 1024) && (await page.locator('#v02-licensed-media-variant').innerText()).includes('7e6f3da44a68a285'), 'local CC-BY-SA image with SHA-256');
  await page.locator('#v02-ex-notes').fill('击掌：3×5，落地保持肩胛稳定');
  await page.locator('#v02-ex-notes-save').click();
  await page.locator('#v02-load-wide').click();
  const wideNotes = await page.locator('#v02-ex-notes').inputValue();
  await page.locator('#v02-load-clap').click();
  const clapNotes = await page.locator('#v02-ex-notes').inputValue();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#v02-load-clap').click();
  record('A01', 'notes are isolated by selected Exercise ID and survive reload', wideNotes === 'A01-wide-test' && !wideNotes.includes('3×5') && clapNotes.includes('3×5') && (await page.locator('#v02-ex-notes').inputValue()).includes('3×5'), `wide=${wideNotes}｜clap=${await page.locator('#v02-ex-notes').inputValue()}`);
  const exerciseExportDownload = page.waitForEvent('download');
  await page.locator('#v02-ex-export').click();
  const exerciseExport = JSON.parse(fs.readFileSync(await (await exerciseExportDownload).path(), 'utf8'));
  record('A01', 'selected Exercise dossier exports full object, sourced variants, phase timeline, keypoints, note, media evidence and boundaries', exerciseExport.schema === 'zero-one.exercise.dossier.v0.2' && exerciseExport.exerciseId === 'exercise:wger:1554:clap-push-up' && exerciseExport.record.source === 'wger Workout Manager' && exerciseExport.record.variantRelation === 'LICENSED_WGER_PLYOMETRIC_VARIANT_OF_STANDARD_PUSH_UP' && exerciseExport.record.mediaEvidence.status === 'LICENSED_MEDIA_VENDORED' && exerciseExport.record.mediaEvidence.sha256 === '7e6f3da44a68a285da8d987ad2ebc47f636bf17555e911d7dce0e1bb9be8ad47' && exerciseExport.definition.guidanceScope === 'PROJECT_STANDARD_PUSH_UP_GUIDANCE_SHARED_ACROSS_VARIANTS' && exerciseExport.definition.steps.length === 3 && exerciseExport.definition.variants.length === 2 && exerciseExport.definition.sourceVariants.length === 2 && exerciseExport.definition.sourceVariants.map(item => item.wgerId).join('|') === '1964|1554' && exerciseExport.definition.sourceVariants.every(item => item.license === 'CC-BY-SA 4') && exerciseExport.definition.joints.length === 4 && exerciseExport.definition.muscles.primary.includes('胸大肌') && exerciseExport.definition.dynamics.controls.join('|') === 'PLAY|PAUSE|SPEED|PHASE_SCRUB' && exerciseExport.definition.dynamics.phases.length === 5 && exerciseExport.definition.dynamics.phases.every(item => item.phaseId && item.jointActions.length && item.bodyAlignment) && exerciseExport.definition.dynamics.keypointSequence.schema === 'zero-one.standard-keypoints.v0.1' && exerciseExport.definition.dynamics.keypointSequence.frames.length === 5 && exerciseExport.definition.dynamics.keypointSequence.frames.every((item, index) => item.phaseId === exerciseExport.definition.dynamics.phases[index].phaseId && Object.keys(item.points).length === 5) && exerciseExport.definition.dynamics.scope === 'STANDARD_PUSH_UP_ONLY_NOT_SELECTED_VARIANT_KINEMATICS' && exerciseExport.training.phaseId === 'push-up:support' && exerciseExport.training.note.includes('3×5') && exerciseExport.boundaries.noteStorage === 'LOCAL_BROWSER_ONLY', `${exerciseExport.exerciseId}｜${exerciseExport.completeness.status}｜${exerciseExport.training.phaseId}`);
  record('A01', 'continuous Exercise dossier preview follows current object', await page.locator('#v02-exercise').getAttribute('data-dossier-ready') === 'true' && await page.locator('#v02-exercise').getAttribute('data-dossier-exercise-id') === exerciseExport.exerciseId && await page.locator('#v02-exercise').getAttribute('data-dossier-completeness') === 'FIELDS_COMPLETE_WITH_BOUNDARIES' && (await page.locator('#v02-ex-dossier-preview').innerText()).includes('3×5') && (await page.locator('#v02-ex-dossier-preview').innerText()).includes('FIELDS_COMPLETE_WITH_BOUNDARIES｜30/30') && (await page.locator('#v02-ex-dossier-preview').innerText()).includes('动作时间线：5/5') && (await page.locator('#v02-ex-dossier-preview').innerText()).includes('宽距俯卧撑 / wger 1964') && (await page.locator('#v02-ex-dossier-preview').innerText()).includes('击掌俯卧撑 / wger 1554') && (await page.locator('#v02-ex-dossier-preview').innerText()).includes('LICENSED_WGER_PLYOMETRIC_VARIANT_OF_STANDARD_PUSH_UP') && (await page.locator('#v02-ex-dossier-preview').innerText()).includes('STANDARD_PUSH_UP_ONLY_NOT_SELECTED_VARIANT_KINEMATICS') && (await page.locator('#v02-ex-dossier-preview').innerText()).includes('LICENSED_MEDIA_VENDORED') && (await page.locator('#v02-ex-dossier-preview').innerText()).includes('7e6f3da44a68a285') && (await page.locator('#v02-ex-dossier-preview').innerText()).includes('CC-BY-SA 4'), await page.locator('#v02-ex-dossier-preview').innerText());
  await page.locator('#v02-ex-notes').fill('字面笔记 <img src=x onerror="window.__noteXss=1">');
  record('A01', 'note preview renders user text without HTML execution', await page.locator('#v02-ex-dossier-preview img').count() === 0 && await page.evaluate(() => window.__noteXss !== 1) && (await page.locator('#v02-ex-dossier-preview').innerText()).includes('<img src=x'), await page.locator('#v02-ex-dossier-preview').innerText());
  record('A01', 'muscle and joint object visible', await page.locator('#v02-joints li').count() === 4 && (await page.locator('#v02-ex-content').innerText()).includes('稳定：'), '4 joint rows plus stabilizer role');

  await page.locator('#v02-speed').selectOption('0.5');
  await page.locator('#v02-phase').evaluate(element => {
    element.value = '55';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  record('A01', 'phase control', await page.locator('#v02-phase-name').innerText() === '底部转换', '55% maps to bottom transition');
  record('A01', 'phase detail follows playback timeline', await page.locator('#v02-phase-detail').getAttribute('data-phase-id') === 'push-up:bottom' && (await page.locator('#v02-phase-detail').innerText()).includes('肘关节保持屈曲') && (await page.locator('#v02-phase-detail').innerText()).includes('颈椎保持中立'), await page.locator('#v02-phase-detail').innerText());
  await page.locator('#v02-phase-sequence [data-phase-target="push-up:concentric"]').click();
  record('A01', 'phase sequence navigation selects a stable phase', await page.locator('#v02-phase-detail').getAttribute('data-phase-id') === 'push-up:concentric' && await page.locator('#v02-phase-sequence [data-phase-target="push-up:concentric"]').getAttribute('aria-current') === 'step' && (await page.locator('#v02-ex-dossier-preview').innerText()).includes('push-up:concentric'), await page.locator('#v02-phase-detail').innerText());
  record('A01', 'visible keypoint frame follows selected stable phase', await page.locator('#v02-keypoint-sequence').getAttribute('data-phase-id') === 'push-up:concentric' && (await page.locator('#v02-keypoint-sequence').innerText()).includes('标准关键点帧 4/5') && (await page.locator('#v02-keypoint-sequence').innerText()).includes('shoulder') && (await page.locator('#v02-keypoint-sequence').innerText()).includes('不是用户识别结果'), await page.locator('#v02-keypoint-sequence').innerText());
  const importedKeypoints = JSON.parse(JSON.stringify(exerciseExport.definition.dynamics.keypointSequence));
  importedKeypoints.provenance = {
    schema: 'zero-one.keypoint-provenance.v0.1',
    artifactId: 'kp:test:valid-video-v0.1',
    mediaType: 'VIDEO',
    sourceAsset: 'test-fixtures/push-up.mp4',
    sourceSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    license: 'TEST_FIXTURE',
    annotator: 'TEST_KEYPOINT_EXTRACTOR',
    derivedAt: '2026-10-13T05:30:00.000Z',
    phaseBindings: importedKeypoints.frames.map((frame, sourceFrameIndex) => ({ phaseId: frame.phaseId, sourceFrameIndex })),
  };
  importedKeypoints.frames[0].points.shoulder[0] = 0.29;
  await page.locator('#v02-keypoint-import').setInputFiles({name: 'valid-keypoints.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(importedKeypoints))});
  record('A01', 'valid five-phase keypoint sequence is applied and compared point-by-point', await page.locator('#v02-exercise').getAttribute('data-keypoint-import-status') === 'PROVENANCE_VALIDATED_AND_APPLIED' && await page.locator('#v02-exercise').getAttribute('data-keypoint-import-frames') === '5' && await page.locator('#v02-exercise').getAttribute('data-keypoint-comparison-points') === '25' && await page.locator('#v02-keypoint-comparison [data-comparison-point]').count() === 25 && (await page.locator('#v02-keypoint-comparison').innerText()).includes('不是摄像头姿态识别'), await page.locator('#v02-keypoint-comparison').innerText());
  record('A01', 'largest reference deviation is highlighted with a bounded interpretation', await page.locator('#v02-keypoint-comparison [data-largest-deviation="true"]').count() === 1 && await page.locator('#v02-exercise').getAttribute('data-keypoint-largest-deviation') === 'push-up:support:shoulder' && (await page.locator('#v02-keypoint-comparison').innerText()).includes('先复核阶段对齐、取景与标点') && (await page.locator('#v02-keypoint-comparison').innerText()).includes('不是动作质量判定'), await page.locator('#v02-keypoint-comparison').innerText());
  const rejectedKeypoints = JSON.parse(JSON.stringify(importedKeypoints));
  rejectedKeypoints.frames[3].phaseId = 'push-up:wrong-phase';
  await page.locator('#v02-keypoint-import').setInputFiles({name: 'invalid-keypoints.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(rejectedKeypoints))});
  record('A01', 'phase-mismatched keypoint sequence is rejected without replacement', await page.locator('#v02-exercise').getAttribute('data-keypoint-import-status') === 'REJECTED_WITHOUT_REPLACEMENT' && (await page.locator('#v02-keypoint-import-receipt').innerText()).includes('当前关键点序列未被覆盖') && (await page.locator('#v02-keypoint-sequence').innerText()).includes('标准关键点帧 4/5'), await page.locator('#v02-keypoint-import-receipt').innerText());
  const comparedExportDownload = page.waitForEvent('download');
  await page.locator('#v02-ex-export').click();
  const comparedExport = JSON.parse(fs.readFileSync(await (await comparedExportDownload).path(), 'utf8'));
  record('A01', 'comparison survives invalid replacement attempt and is exported', comparedExport.definition.dynamics.keypointComparison.schema === 'zero-one.keypoint-comparison.v0.1' && comparedExport.definition.dynamics.keypointComparison.pointCount === 25 && comparedExport.definition.dynamics.keypointComparison.frames[0].points.shoulder.distance > 0 && comparedExport.definition.dynamics.keypointComparison.boundary.includes('NOT_POSE_RECOGNITION'), JSON.stringify(comparedExport.definition.dynamics.keypointComparison));
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
  record('B01', 'active clarification is exported as Residence state', archiveDossier.clarificationState.status === 'ACTIVE_CLARIFICATION_REQUIRED' && archiveDossier.clarificationState.knownCount === 8 && archiveDossier.clarificationState.totalFields === 11 && archiveDossier.clarificationState.missingFields.join('|') === 'dir|floor|surround' && archiveDossier.clarificationState.nextField === 'dir' && archiveDossier.clarificationState.question.includes('朝向'), JSON.stringify(archiveDossier.clarificationState));
  record('B01', 'known fields are separated from evidenced fields', archiveDossier.clarificationState.knownEvidenceRequiredCount === 6 && archiveDossier.clarificationState.evidencedKnownCount === 3 && archiveDossier.clarificationState.unsupportedKnownFields.join('|') === 'rooms|size|needs' && await page.locator('#v02-residence').getAttribute('data-evidenced-known-count') === '3' && (await page.locator('#r-evidence-coverage').innerText()).includes('字段证据覆盖｜3/6') && (await page.locator('#r-evidence-coverage').innerText()).includes('房间与布局、面积与尺度、居住者需求'), await page.locator('#r-evidence-coverage').innerText());
  record('B01', 'clarification queue exposes and focuses each missing field', await page.locator('#r-clarification-queue [data-clarification-field]').count() === 3 && await page.locator('#r-clarification-queue [data-clarification-field="dir"]').count() === 1 && await page.locator('#r-clarification-queue [data-clarification-field="floor"]').count() === 1 && await page.locator('#r-clarification-queue [data-clarification-field="surround"]').count() === 1, await page.locator('#r-clarification-queue').innerText());
  await page.locator('#r-clarification-queue [data-clarification-field="dir"]').click();
  record('B01', 'clarification queue opens the requested field', await page.locator('#r-dir').evaluate(element => document.activeElement === element), 'dir field focused');
  record('B01', 'continuous dossier exports same-case engine evidence', archiveDossier.id === 'residence:habs-dc-97:frederick-douglass-house' && archiveDossier.boundaries.modelRun === 'DEPTHMAPX_VGA_RUN_FOR_THIS_TRACE' && archiveDossier.analysisChain.caseId === archiveDossier.id && archiveDossier.analysisChain.depthmapX.pointCount === 708 && archiveDossier.analysisChain.radiance.sensorCount === 80, `${archiveDossier.id}｜depthmapX ${archiveDossier.analysisChain.depthmapX.pointCount}｜Radiance ${archiveDossier.analysisChain.radiance.sensorCount}`);
  record('B01', 'continuous dossier exports same-case material-chain attestation', archiveDossier.materialChain.status === 'VALID_SAME_CASE_MATERIAL_CHAIN' && archiveDossier.materialChain.caseId === archiveDossier.id && archiveDossier.materialChain.materialCount === 3 && archiveDossier.materialChain.sha256Count === 3 && archiveDossier.materialChain.errors.length === 0, JSON.stringify(archiveDossier.materialChain));
  record('B01', 'HABS export includes item-level material provenance boundary', archiveDossier.materialProvenance.status === 'RECORDED' && archiveDossier.materialProvenance.total === 3 && archiveDossier.materialProvenance.sourceCounts.PUBLIC_ARCHIVE_US_NPS_HABS === 1 && archiveDossier.materialProvenance.sourceCounts.PROJECT_TRACE_OF_PUBLIC_ARCHIVE === 2 && archiveDossier.materialProvenance.missingLicenseCount === 0 && archiveDossier.materialProvenance.boundary === 'MATERIAL_METADATA_DOES_NOT_PROVE_GEOMETRY_OR_ENVIRONMENT', JSON.stringify(archiveDossier.materialProvenance));
  await page.locator('#r-engine-overlay').screenshot({ path: path.join(artifactDir, 'residence-b01-radiance-map.png') });
  await page.locator('#r-new').click();
  residenceId = await page.locator('#v02-residence').getAttribute('data-residence-id');

  await page.locator('#r-name').fill('东明居');
  await page.locator('#r-place').fill('上海市浦东新区');
  await page.locator('#r-material').fill('现场手工测量记录 v1');
  await page.locator('#r-evidence-field').selectOption('name');
  await page.locator('#r-evidence-source').selectOption('USER_REPORTED');
  await page.locator('#r-evidence-confidence').selectOption('MEDIUM');
  await page.locator('#r-save-field-evidence').click();
  record('B01', 'name evidence is saved independently', (await page.locator('#r-field-evidence-receipt').innerText()).includes('住宅名称｜USER_REPORTED｜MEDIUM'), await page.locator('#r-field-evidence-receipt').innerText());
  await page.locator('#r-evidence-field').selectOption('place');
  await page.locator('#r-evidence-source').selectOption('FIELD_OBSERVED');
  await page.locator('#r-evidence-confidence').selectOption('HIGH');
  await page.locator('#r-save-field-evidence').click();
  record('B01', 'place evidence keeps its own source and confidence', (await page.locator('#r-field-evidence-receipt').innerText()).includes('所在地区｜FIELD_OBSERVED｜HIGH'), await page.locator('#r-field-evidence-receipt').innerText());
  await page.locator('#r-evidence-field').selectOption('name');
  record('B01', 'existing field evidence loads into editor', await page.locator('#r-evidence-source').inputValue() === 'USER_REPORTED' && await page.locator('#r-evidence-confidence').inputValue() === 'MEDIUM' && (await page.locator('#r-field-evidence-receipt').innerText()).includes('正在编辑：住宅名称'), await page.locator('#r-field-evidence-receipt').innerText());
  await page.locator('#r-evidence-confidence').selectOption('HIGH');
  await page.locator('#r-save-field-evidence').click();
  record('B01', 'field evidence can be edited in place', (await page.locator('#r-field-evidence-receipt').innerText()).includes('住宅名称｜USER_REPORTED｜HIGH'), await page.locator('#r-field-evidence-receipt').innerText());
  await page.locator('#r-undo-field-evidence').click();
  record('B01', 'field evidence undo preserves field value and records revision', await page.locator('#r-name').inputValue() === '东明居' && await page.locator('#r-evidence li[data-field="name"]').count() === 0 && (await page.locator('#r-evidence-coverage').innerText()).includes('住宅名称') && await page.locator('#r-evidence-revisions li[data-evidence-revision="name"]').count() === 3 && (await page.locator('#r-evidence-revisions').innerText()).includes('UNDO｜住宅名称'), await page.locator('#r-evidence-revisions').innerText());
  await page.locator('#r-evidence-source').selectOption('USER_REPORTED');
  await page.locator('#r-evidence-confidence').selectOption('MEDIUM');
  await page.locator('#r-save-field-evidence').click();
  await page.locator('#r-source').selectOption('DRAWING_OR_ARCHIVE');
  await page.locator('#r-confidence').selectOption('MEDIUM');
  await page.locator('#r-material-license').fill('PROJECT_REFERENCE_ONLY');
  await page.locator('#r-material-file').setInputFiles('research/depthmap/prototype-house.dxf');
  await page.locator('#r-ingest-material').click();
  await page.waitForFunction(() => document.querySelector('#v02-residence')?.dataset.materialCount === '1');
  record('B01', 'actual material hashed and bound', await page.locator('#v02-residence').getAttribute('data-last-material-sha') === '8e54d1682d7212ba95a9bed996ba3139357ea738efb4563488d9e1e8156133a3', await page.locator('#r-material-manifest').innerText());
  record('B01', 'material provenance summary updates after bind', await page.locator('#v02-residence').getAttribute('data-material-provenance') === 'RECORDED' && await page.locator('#v02-residence').getAttribute('data-material-source-count') === '1' && await page.locator('#v02-residence').getAttribute('data-material-missing-license-count') === '0' && (await page.locator('#r-provenance-summary').innerText()).includes('DRAWING_OR_ARCHIVE × 1'), await page.locator('#r-provenance-summary').innerText());
  record('B01', 'material boundary remains explicit', (await page.locator('#r-result').innerText()).includes('尚未运行空间/环境模型'), await page.locator('#r-result').innerText());
  await page.locator('#r-save').click();
  record('B01', 'same ID after save', await page.locator('#v02-residence').getAttribute('data-residence-id') === residenceId, residenceId);
  record('B01', 'field evidence captured', await page.locator('#r-evidence li[data-field]').count() === 3, 'name/place/material each have evidence');
  const revisionText = await page.locator('#r-history').textContent();
  record('B01', 'revision captured', await page.locator('#r-history li').count() === 1 && revisionText.includes('已知 5/11'), revisionText);
  record('B01', 'ordinary residence field changes create one auditable revision', await page.locator('#v02-residence').getAttribute('data-field-revision-status') === 'SAVED' && await page.locator('#v02-residence').getAttribute('data-field-revision-count') === '1' && await page.locator('#r-field-revisions li[data-field-revision]').count() === 1 && (await page.locator('#r-field-revision-receipt').innerText()).includes('字段修订已保存'), await page.locator('#r-field-revisions').innerText());

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#v02-residence').waitFor();
  record('B01', 'same ID after reload', await page.locator('#v02-residence').getAttribute('data-residence-id') === residenceId, residenceId);
  record('B01', 'evidence survives reload', await page.locator('#r-evidence li[data-field]').count() === 3, '3 evidence rows persisted');
  if (await page.locator('#r-provenance-summary').count()) {
    record('B01', 'provenance summary survives reload', (await page.locator('#r-provenance-summary').innerText()).includes('共 1 项'), await page.locator('#r-provenance-summary').innerText());
  }
  record('B01', 'material manifest survives reload', await page.locator('#v02-residence').getAttribute('data-material-count') === '1', await page.locator('#r-material-manifest').innerText());
  record('B01', 'material provenance summary survives reload', await page.locator('#v02-residence').getAttribute('data-material-provenance') === 'RECORDED' && (await page.locator('#r-provenance-summary').innerText()).includes('全部材料均有许可'), await page.locator('#r-provenance-summary').innerText());
  await page.locator('#r-place').fill('北京市东城区');
  await page.locator('#r-save').click();
  record('B01', 'field edit conflicting with evidence is rejected without changing revision head', await page.locator('#v02-residence').getAttribute('data-field-revision-status') === 'CONFLICT_REJECTED' && await page.locator('#v02-residence').getAttribute('data-field-revision-count') === '1' && await page.locator('#v02-residence').getAttribute('data-field-revision-conflicts') === 'place' && (await page.locator('#r-field-revision-receipt').innerText()).includes('与已保存证据值冲突'), await page.locator('#r-field-revision-receipt').innerText());
  await page.locator('#r-place').fill('上海市浦东新区');
  const evidenceRevisionDownload = page.waitForEvent('download');
  await page.locator('#r-export').click();
  const evidenceRevisionDossier = JSON.parse(fs.readFileSync(await (await evidenceRevisionDownload).path(), 'utf8'));
  record('B01', 'evidence revision history is exported', evidenceRevisionDossier.evidenceRevisions.length === 6 && evidenceRevisionDossier.evidenceRevisions.every(item => item.caseId === residenceId) && evidenceRevisionDossier.evidenceRevisions.filter(item => item.field === 'name').map(item => item.action).join('|') === 'SAVE|SAVE|UNDO|SAVE', JSON.stringify(evidenceRevisionDossier.evidenceRevisions));
  record('B01', 'ordinary field revision chain is exported', evidenceRevisionDossier.fieldRevisions.length === 1 && evidenceRevisionDossier.fieldRevisions[0].caseId === residenceId && evidenceRevisionDossier.fieldRevisions[0].changes.some(change => change.field === 'place' && change.after === '上海市浦东新区'), JSON.stringify(evidenceRevisionDossier.fieldRevisions));
  record('B01', 'boundary remains explicit', (await page.locator('#r-result').innerText()).includes('不输出未经计算'), await page.locator('#r-result').innerText());
  await page.screenshot({ path: path.join(artifactDir, 'residence-b01.png'), fullPage: true });

  await page.locator('#r-new').click();
  record('B01', 'new residence gets different ID', await page.locator('#v02-residence').getAttribute('data-residence-id') !== residenceId, await page.locator('#v02-residence').getAttribute('data-residence-id'));
  record('B01', 'new residence clears evidence', await page.locator('#r-evidence li[data-field]').count() === 0, 'evidence ledger empty');
  await page.locator('#r-import').setInputFiles({name: 'evidence-revision-roundtrip.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(evidenceRevisionDossier))});
  await page.waitForFunction(() => document.querySelector('#v02-residence')?.dataset.importStatus === 'VALIDATED_AND_IMPORTED');
  record('B01', 'evidence revision history survives validated import', await page.locator('#v02-residence').getAttribute('data-residence-id') === residenceId && await page.locator('#r-evidence-revisions li[data-evidence-revision]').count() === 6 && (await page.locator('#r-evidence-revisions').innerText()).includes('UNDO｜住宅名称'), await page.locator('#r-evidence-revisions').innerText());
  record('B01', 'ordinary field revision chain survives validated import', await page.locator('#v02-residence').getAttribute('data-field-revision-count') === '1' && await page.locator('#r-field-revisions li[data-field-revision]').count() === 1, await page.locator('#r-field-revisions').innerText());
  await page.locator('#r-new').click();
  const rejectedId = await page.locator('#v02-residence').getAttribute('data-residence-id');
  const mismatchedRevisionDossier = {...evidenceRevisionDossier, evidenceRevisions: evidenceRevisionDossier.evidenceRevisions.map((item, index) => index ? item : {...item, caseId: 'residence:case:other'})};
  await page.locator('#r-import').setInputFiles({name: 'mismatched-evidence-revision.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mismatchedRevisionDossier))});
  await page.waitForFunction(() => document.querySelector('#v02-residence')?.dataset.importStatus === 'REJECTED_WITHOUT_HYDRATION');
  record('B01', 'mismatched evidence revision is rejected without replacing current Case', await page.locator('#v02-residence').getAttribute('data-residence-id') === rejectedId && (await page.locator('#r-import-receipt').innerText()).includes('evidenceRevisions[0].caseId'), await page.locator('#r-import-receipt').innerText());
  const brokenFieldRevisionDossier = {...evidenceRevisionDossier, fieldRevisions: evidenceRevisionDossier.fieldRevisions.map(item => ({...item, parentRevisionId: 'forged-parent'}))};
  await page.locator('#r-import').setInputFiles({name: 'broken-field-revision.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(brokenFieldRevisionDossier))});
  await page.waitForFunction(() => document.querySelector('#v02-residence')?.dataset.importStatus === 'REJECTED_WITHOUT_HYDRATION');
  record('B01', 'broken ordinary field revision chain is rejected without replacing current Case', await page.locator('#v02-residence').getAttribute('data-residence-id') === rejectedId && (await page.locator('#r-import-receipt').innerText()).includes('fieldRevisions[0] 修订链无效'), await page.locator('#r-import-receipt').innerText());
  await page.locator('#r-import').setInputFiles({name: 'invalid-residence.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({schema: 'zero-one.residence.v0.2', id: 'bad-id', fields: {name: '不应载入'}}))});
  await page.waitForFunction(() => document.querySelector('#v02-residence')?.dataset.importStatus === 'REJECTED_WITHOUT_HYDRATION');
  record('B01', 'invalid imported dossier is rejected before hydration', await page.locator('#v02-residence').getAttribute('data-import-status') === 'REJECTED_WITHOUT_HYDRATION' && await page.locator('#v02-residence').getAttribute('data-residence-id') === rejectedId && (await page.locator('#r-result').innerText()).includes('Residence/Case ID 无效') && (await page.locator('#r-import-receipt').innerText()).includes('未被覆盖'), await page.locator('#r-import-receipt').innerText());
  const mismatchedEvidenceDossier = {...archiveDossier, evidence: {...archiveDossier.evidence, name: {...archiveDossier.evidence.name, value: '被篡改的住宅名'}}};
  await page.locator('#r-import').setInputFiles({name: 'mismatched-evidence.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mismatchedEvidenceDossier))});
  await page.waitForFunction(() => document.querySelector('#v02-residence')?.dataset.importStatus === 'REJECTED_WITHOUT_HYDRATION');
  record('B01', 'mismatched evidence ledger is rejected without replacing current Case', await page.locator('#v02-residence').getAttribute('data-residence-id') === rejectedId && (await page.locator('#r-import-receipt').innerText()).includes('evidence.name.value') && (await page.locator('#r-import-receipt').innerText()).includes('未被覆盖'), await page.locator('#r-import-receipt').innerText());
  const mismatchedDossier = {...archiveDossier, analysisChain: {...archiveDossier.analysisChain, caseId: 'residence:case:other'}};
  await page.locator('#r-import').setInputFiles({name: 'mismatched-chain.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mismatchedDossier))});
  await page.waitForFunction(() => document.querySelector('#v02-residence')?.dataset.importStatus === 'REJECTED_WITHOUT_HYDRATION');
  record('B01', 'mismatched analysis chain is rejected without replacing current Case', await page.locator('#v02-residence').getAttribute('data-import-status') === 'REJECTED_WITHOUT_HYDRATION' && await page.locator('#v02-residence').getAttribute('data-residence-id') === rejectedId && (await page.locator('#r-import-receipt').innerText()).includes('analysisChain.caseId') && (await page.locator('#r-import-receipt').innerText()).includes('未被覆盖'), await page.locator('#r-import-receipt').innerText());
  const zeroPointDossier = {...archiveDossier, analysisChain: {...archiveDossier.analysisChain, depthmapX: {...archiveDossier.analysisChain.depthmapX, pointCount: 0}}};
  await page.locator('#r-import').setInputFiles({name: 'zero-point-chain.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(zeroPointDossier))});
  await page.waitForFunction(() => document.querySelector('#v02-residence')?.dataset.importStatus === 'REJECTED_WITHOUT_HYDRATION');
  record('B01', 'empty engine evidence is rejected without replacing current Case', await page.locator('#v02-residence').getAttribute('data-import-status') === 'REJECTED_WITHOUT_HYDRATION' && await page.locator('#v02-residence').getAttribute('data-residence-id') === rejectedId && (await page.locator('#r-import-receipt').innerText()).includes('depthmapX 证据字段无效'), await page.locator('#r-import-receipt').innerText());
  const mismatchedMaterialDossier = {...archiveDossier, materialFiles: archiveDossier.materialFiles.map((item, index) => index ? item : {...item, caseId: 'residence:case:other'})};
  await page.locator('#r-import').setInputFiles({name: 'mismatched-material-chain.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mismatchedMaterialDossier))});
  await page.waitForFunction(() => document.querySelector('#v02-residence')?.dataset.importStatus === 'REJECTED_WITHOUT_HYDRATION');
  record('B01', 'mismatched material chain is rejected without replacing current Case', await page.locator('#v02-residence').getAttribute('data-import-status') === 'REJECTED_WITHOUT_HYDRATION' && await page.locator('#v02-residence').getAttribute('data-residence-id') === rejectedId && (await page.locator('#r-import-receipt').innerText()).includes('materialFiles[0].caseId') && (await page.locator('#r-import-receipt').innerText()).includes('未被覆盖'), await page.locator('#r-import-receipt').innerText());
  await page.locator('#r-import').setInputFiles({name: 'habs-roundtrip.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(archiveDossier))});
  await page.waitForFunction(() => document.querySelector('#v02-residence')?.dataset.importStatus === 'VALIDATED_AND_IMPORTED');
  record('B01', 'valid dossier round-trip restores same Case, engine and material chains', await page.locator('#v02-residence').getAttribute('data-import-status') === 'VALIDATED_AND_IMPORTED' && await page.locator('#v02-residence').getAttribute('data-residence-id') === archiveDossier.id && await page.locator('#v02-residence').getAttribute('data-imported-case-id') === archiveDossier.id && await page.locator('#v02-residence').getAttribute('data-imported-analysis-integrity') === 'VALID_SAME_CASE_ENGINE_CHAIN' && await page.locator('#v02-residence').getAttribute('data-imported-material-integrity') === 'VALID_SAME_CASE_MATERIAL_CHAIN' && await page.locator('#v02-residence').getAttribute('data-imported-depthmap-points') === '708' && await page.locator('#v02-residence').getAttribute('data-imported-radiance-sensors') === '80' && (await page.locator('#r-import-receipt').innerText()).includes('材料 3 项') && (await page.locator('#r-import-receipt').innerText()).includes('VALID_SAME_CASE_ENGINE_CHAIN') && (await page.locator('#r-import-receipt').innerText()).includes('VALID_SAME_CASE_MATERIAL_CHAIN 3/3 SHA-256') && (await page.locator('#r-import-receipt').innerText()).includes(archiveDossier.analysisChain.depthmapX.outputSha256.slice(0, 12)) && (await page.locator('#r-import-receipt').innerText()).includes(archiveDossier.analysisChain.radiance.modelSha256.slice(0, 12)), await page.locator('#r-import-receipt').innerText());

  await page.goto(`${baseUrl}/portal/movement.html?sha=${process.env.GITHUB_SHA || 'local'}&artifact=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('#v02-load-keypoint-artifact').click();
  await page.waitForFunction(() => document.querySelector('#v02-exercise')?.dataset.keypointImportStatus === 'PROVENANCE_VALIDATED_AND_APPLIED');
  const artifactId = await page.locator('#v02-exercise').getAttribute('data-keypoint-artifact-id');
  const artifactSourceSha = await page.locator('#v02-exercise').getAttribute('data-keypoint-source-sha');
  const artifactReceipt = await page.locator('#v02-keypoint-import-receipt').innerText();
  record('A01', 'licensed-image keypoint artifact ID is bound to the comparison', artifactId === 'kp:wger:1554:clap-image-manual-v0.1', `artifactId=${artifactId}`);
  record('A01', 'licensed-image keypoint artifact source SHA is bound to the comparison', artifactSourceSha === '7e6f3da44a68a285da8d987ad2ebc47f636bf17555e911d7dce0e1bb9be8ad47', `sourceSha256=${artifactSourceSha}`);
  record('A01', 'licensed-image keypoint artifact boundary remains explicit', artifactReceipt.includes('静态图片标注不等于视频追踪'), artifactReceipt);

  await page.goto(`${baseUrl}/portal/k02-board.html?sha=${process.env.GITHUB_SHA || 'local'}&correction=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('#r-place').fill('上海市徐汇区');
  await page.locator('#r-evidence-field').selectOption('place');
  await page.locator('#r-evidence-source').selectOption('USER_REPORTED');
  await page.locator('#r-evidence-confidence').selectOption('HIGH');
  await page.locator('#r-correct-field-evidence').click();
  record('B01', 'field value and evidence correction commits as one auditable transaction', await page.locator('#v02-residence').getAttribute('data-correction-status') === 'ATOMIC_FIELD_EVIDENCE_CORRECTION_SAVED' && await page.locator('#v02-residence').getAttribute('data-correction-transaction-count') === '1' && await page.locator('#r-correction-transactions li[data-correction-transaction]').count() === 1 && (await page.locator('#r-field-evidence-receipt').innerText()).includes('同一事务提交'), await page.locator('#r-field-evidence-receipt').innerText());
  const correctionDownload = page.waitForEvent('download');
  await page.locator('#r-export').click();
  const correctionDossier = JSON.parse(fs.readFileSync(await (await correctionDownload).path(), 'utf8'));
  record('B01', 'atomic correction transaction exports field and evidence final state', correctionDossier.correctionTransactions.length === 1 && correctionDossier.fields.place === '上海市徐汇区' && correctionDossier.evidence.place.value === '上海市徐汇区' && correctionDossier.correctionTransactions[0].after.evidence.value === '上海市徐汇区', JSON.stringify(correctionDossier.correctionTransactions));

  await page.goto(`${baseUrl}/portal/advisor-v02-experience.html?sha=${process.env.GITHUB_SHA || 'local'}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#advisor-entry').waitFor();
  await page.locator('[data-type="lost"]').click();
  const lostCaseId = await page.locator('#case-id').innerText();
  record('B-ENTRY', 'lost-item case uses stable shared schema', await page.locator('#advisor-entry').getAttribute('data-schema') === 'zero-one.advisor.case.v0.1' && lostCaseId.startsWith('case-') && (await page.locator('#method-boundary').innerText()).includes('不声称能推断位置'), lostCaseId);
  await page.locator('#save-case').click();
  record('B-ENTRY', 'missing material triggers one explicit next question', await page.locator('#advisor-entry').getAttribute('data-case-status') === 'NEEDS_CLARIFICATION' && (await page.locator('#next-question').innerText()).includes('称呼'), await page.locator('#next-question').innerText());
  await page.locator('#client').fill('匿名访客');
  await page.locator('#question').fill('钥匙找不到了');
  await page.locator('#lost-item').fill('钥匙');
  await page.locator('#lost-place').fill('办公室抽屉');
  await page.locator('#lost-time').fill('2026-10-13T08:00');
  await page.locator('#save-case').click();
  record('B-ENTRY', 'lost-item materials save without fabricated prediction', await page.locator('#advisor-entry').getAttribute('data-case-status') === 'MATERIALS_RECORDED_NO_PREDICTION' && (await page.locator('#case-id').innerText()) === lostCaseId && (await page.locator('#next-question').innerText()).includes('当前不输出预测'), await page.locator('#next-question').innerText());
  const lostCase = await page.evaluate(() => JSON.parse(localStorage.getItem('advisor-cases-v01') || '[]').find(item => item.type === 'lost'));
  record('B-ENTRY', 'selected method contract is saved with explicit boundary', lostCase?.methodContract?.status === 'MATERIAL_ORGANIZATION_ONLY' && lostCase?.methodContract?.boundary.includes('不推断物品位置'), JSON.stringify(lostCase?.methodContract));
  await page.locator('[data-type="residence"]').click();
  const residenceCaseId = await page.locator('#case-id').innerText();
  await page.locator('#client').fill('住宅访客');
  await page.locator('#question').fill('希望整理住宅材料');
  await page.locator('#residence-summary').fill('两房一厅，朝向待确认');
  await page.locator('#residence-concern').fill('采光与动线');
  await page.locator('#save-case').click();
  record('B-ENTRY', 'residence case shares the contract but receives a distinct ID', residenceCaseId.startsWith('case-') && residenceCaseId !== lostCaseId && await page.locator('#advisor-entry').getAttribute('data-saved-case-count') === '2' && (await page.locator('#case-history').innerText()).includes('失物') && (await page.locator('#case-history').innerText()).includes('住宅'), await page.locator('#case-history').innerText());
  record('B-ENTRY', 'residence remains a linked submodule', await page.locator('#residence-link').getAttribute('href') === 'housing-v02-experience.html', await page.locator('#residence-link').getAttribute('href'));
  await page.locator('.restore-case').first().click();
  record('B-ENTRY', 'saved case restores into the same continuous Case ID', await page.locator('#advisor-entry').getAttribute('data-restored-case') === 'true' && (await page.locator('#case-id').innerText()) === lostCaseId && await page.locator('#lost-item').inputValue() === '钥匙' && (await page.locator('#type-status').innerText()).includes(lostCaseId), await page.locator('#type-status').innerText());
  await page.evaluate(() => localStorage.removeItem('advisor-cases-v01'));
  await page.locator('#import-case').setInputFiles({name:'case.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lostCase))});
  record('B-ENTRY', 'exported case imports into the same continuous Case ID', await page.locator('#advisor-entry').getAttribute('data-import-status') === 'PASS' && (await page.locator('#case-id').innerText()) === lostCaseId && (await page.locator('#next-question').innerText()).includes('导入成功'), await page.locator('#next-question').innerText());
  const forgedCase = JSON.parse(JSON.stringify(lostCase));forgedCase.methodContract.boundary='伪造边界';
  await page.locator('#import-case').setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(forgedCase))});
  record('B-ENTRY', 'forged method contract import is rejected without replacing current Case', await page.locator('#advisor-entry').getAttribute('data-import-status') === 'REJECTED' && (await page.locator('#case-id').innerText()) === lostCaseId && (await page.locator('#next-question').innerText()).includes('方法合同与当前版本不一致'), await page.locator('#next-question').innerText());
  await page.locator('[data-type="marriage"]').click();
  record('B-ENTRY', 'unimplemented category is explicit and cannot emit a result', await page.locator('#advisor-entry').getAttribute('data-case-status') === 'UNAVAILABLE_EXPLICIT' && (await page.locator('#type-status').innerText()).includes('NOT_AVAILABLE') && (await page.locator('#type-status').innerText()).includes('不能生成结论'), await page.locator('#type-status').innerText());
  await page.screenshot({ path: path.join(artifactDir, 'advisor-b-entry.png'), fullPage: true });


  await page.goto(`${baseUrl}/portal/movement-v02-experience.html?sha=${process.env.GITHUB_SHA || 'local'}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#exercise-list').waitFor();
  record('A-TEACH', 'two distinct whole-body actions', await page.locator('[data-exercise-id]').count() === 2, 'squat and jumping-jack cards are visible');
  record('A-TEACH', 'two dynamic assets identified', await page.locator('.demo img[src$=".gif"]').count() === 2, 'two Wikimedia Commons GIF demos');
  record('A-TEACH', 'asset-level attribution visible', await page.locator('.source a[href*="commons.wikimedia.org/wiki/File:"]').count() === 2 && await page.locator('.source a[href*="creativecommons.org/licenses/by-sa/4.0"]').count() === 2, 'author, version, SHA-1 and CC BY-SA 4.0 are shown per asset');
  await page.locator('.demo-toggle').first().click();
  record('A-TEACH', 'dynamic demo pause control', await page.locator('.demo-toggle').first().getAttribute('data-state') === 'paused' && await page.locator('#squat-still').isVisible(), 'animated demo can be paused to a canvas frame');
  await page.locator('.demo-toggle').first().click();
  record('A-TEACH', 'dynamic demo resume control', await page.locator('.demo-toggle').first().getAttribute('data-state') === 'playing' && await page.locator('#squat-demo').isVisible(), 'paused demo can resume');
  await page.locator('#goal').selectOption('whole-body');
  await page.locator('#environment').selectOption('home');
  await page.locator('#duration').fill('10');
  await page.locator('#build').click();
  await page.locator('#complete-action').click();
  record('A-TEACH', 'continuous lesson advances', (await page.locator('#done-squat').innerText()) === '已完成' && (await page.locator('#active-name').innerText()).includes('开合跳'), 'completing squat advances to jumping jack');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#restore').click();
  record('A-TEACH', 'unfinished session restores after reload', (await page.locator('#plan-status').innerText()).includes('已恢复未完成训练') && (await page.locator('#done-squat').innerText()) === '已完成' && (await page.locator('#active-name').innerText()).includes('开合跳'), await page.locator('#plan-status').innerText());
  await page.locator('#complete-action').click();
  await page.locator('#finish').click();
  const teachRecord = await page.evaluate(() => JSON.parse(localStorage.getItem('zero-one.movement.teach.sessions.v0.2') || '[]')[0]);
  record('A-TEACH', 'session record saved', teachRecord?.schema === 'zero-one.movement.teach.session.v0.2' && teachRecord?.exercise_ids?.length === 2 && teachRecord?.completed_exercise_ids?.length === 2 && teachRecord?.resumed_from_draft === true, teachRecord?.session_id || 'missing record');
  record('A-TEACH', 'finished session clears resumable draft', await page.evaluate(() => localStorage.getItem('zero-one.movement.teach.draft.v0.2') === null), 'draft removed after finish');
  record('A-TEACH', 'completed session appears in visible repeatable history', await page.locator('.repeat-session').count() === 1 && (await page.locator('#session-history').innerText()).includes(teachRecord.session_id), await page.locator('#session-history').innerText());
  await page.locator('.repeat-session').click();
  const repeatedDraft = await page.evaluate(() => JSON.parse(localStorage.getItem('zero-one.movement.teach.draft.v0.2') || 'null'));
  record('A-TEACH', 'repeat starts a new session from the saved plan', (await page.locator('#plan-status').innerText()).includes('开始新训练') && repeatedDraft?.started_at !== teachRecord.started_at && repeatedDraft?.goal === teachRecord.goal, await page.locator('#plan-status').innerText());
  record('A-TEACH', 'licensed asset provenance in record', teachRecord?.demo_assets?.every(asset => asset.author === 'Wensceslao' && asset.license === 'CC BY-SA 4.0' && asset.sha1?.length === 40), 'both demo assets retain author, license, version, source and SHA-1');

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
