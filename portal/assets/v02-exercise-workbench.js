(() => {
  const root = document.createElement('section');
  root.className = 'card';
  root.id = 'v02-exercise';
  root.innerHTML = `
    <h2>V0.2｜完整动作工作台（A01开发中）</h2>
    <p class="muted">输入动作→查看同一个 Exercise 对象。当前动态仍是项目原创二维教学示意，不是开放动作库、三维人体或医学级分析。</p>
    <div class="intent"><input id="v02-ex-input" aria-label="动作名称" value="我要练俯卧撑"><button class="btn" id="v02-ex-find">查看动作</button></div>
    <div id="v02-ex-content" class="result" aria-live="polite"></div>`;
  const main = document.querySelector('main');
  main.insertBefore(root, main.children[1] || null);

  const data = {
    schema: 'zero-one.exercise.v0.2',
    id: 'exercise:wger:1551:push-up',
    name: '标准俯卧撑',
    aliases: ['俯卧撑', 'push-up', 'pushup'],
    category: '水平推',
    equipment: '自身体重',
    difficulty: '基础—中等（取决于体重与动作质量）',
    phases: [
      {phaseId: 'push-up:support', name: '支撑', range: [0, 19], jointActions: ['肘关节伸展保持', '肩胛胸廓稳定贴附'], bodyAlignment: '头—肩—髋—踝保持稳定排列'},
      {phaseId: 'push-up:eccentric', name: '离心下降', range: [20, 49], jointActions: ['肘关节受控屈曲', '肩关节水平外展', '肩胛受控回缩'], bodyAlignment: '躯干与骨盆抗伸展，身体整体下降'},
      {phaseId: 'push-up:bottom', name: '底部转换', range: [50, 59], jointActions: ['肘关节保持屈曲', '肩关节完成方向转换'], bodyAlignment: '胸部接近地面，颈椎保持中立'},
      {phaseId: 'push-up:concentric', name: '向心推起', range: [60, 89], jointActions: ['肘关节伸展', '肩关节水平内收', '肩胛前伸并稳定贴附'], bodyAlignment: '身体作为整体推离地面，避免腰部塌陷'},
      {phaseId: 'push-up:return', name: '回到支撑', range: [90, 100], jointActions: ['肘关节回到伸展', '肩胛胸廓重新稳定'], bodyAlignment: '恢复头—肩—髋—踝稳定排列'},
    ],
    keypointSequence: {
      schema: 'zero-one.standard-keypoints.v0.1',
      source: 'PROJECT_AUTHORED_STANDARD_PUSH_UP_REFERENCE',
      coordinateSystem: 'NORMALIZED_2D_SIDE_VIEW_X_RIGHT_Y_DOWN',
      sampleRateHz: 1,
      limitation: '五个标准相位的项目参考点，不是用户识别结果，也不是三维或医学级运动学。',
      frames: [
        ['push-up:support', 0.33, 0.30, 0.44, 0.59, 0.49, 0.84, 0.66, 0.32, 0.92, 0.78],
        ['push-up:eccentric', 0.33, 0.45, 0.44, 0.67, 0.49, 0.84, 0.66, 0.47, 0.92, 0.78],
        ['push-up:bottom', 0.33, 0.60, 0.44, 0.72, 0.49, 0.84, 0.66, 0.62, 0.92, 0.78],
        ['push-up:concentric', 0.33, 0.45, 0.44, 0.67, 0.49, 0.84, 0.66, 0.47, 0.92, 0.78],
        ['push-up:return', 0.33, 0.30, 0.44, 0.59, 0.49, 0.84, 0.66, 0.32, 0.92, 0.78],
      ].map(([phaseId, shoulderX, shoulderY, elbowX, elbowY, wristX, wristY, hipX, hipY, ankleX, ankleY], index) => ({
        frame: index,
        phaseId,
        points: {shoulder: [shoulderX, shoulderY], elbow: [elbowX, elbowY], wrist: [wristX, wristY], hip: [hipX, hipY], ankle: [ankleX, ankleY]},
      })),
    },
    steps: [
      '双手撑地，手位约在肩部附近，头、肩、髋、踝保持稳定排列',
      '屈肘控制身体整体下降，避免腰部明显塌陷或臀部先抬起',
      '胸部接近地面后推回起始位置，呼吸自然，不憋气',
    ],
    muscles: {
      primary: ['胸大肌', '肱三头肌'],
      secondary: ['三角肌前束', '前锯肌'],
      stabilizers: ['腹横肌/腹斜肌群', '臀大肌', '肩袖肌群'],
    },
    joints: [
      {joint: '肘关节', down: '屈曲', up: '伸展'},
      {joint: '肩关节', down: '水平外展', up: '水平内收'},
      {joint: '肩胛胸廓', down: '受控回缩', up: '前伸/稳定贴附'},
      {joint: '脊柱与骨盆', down: '抗伸展稳定', up: '抗伸展稳定'},
    ],
    variants: [
      {name: '跪姿俯卧撑', relation: '降低负荷的项目教学调整'},
      {name: '上斜俯卧撑', relation: '降低负荷的项目教学调整'},
    ],
    formErrors: [
      {error: '头部过度上抬或下压，颈椎代偿', correction: '保持耳—肩—髋—踝接近直线，视线自然向下'},
      {error: '腰部明显塌陷或臀部过高', correction: '收紧腹部和臀部，让躯干保持平板；必要时改为跪姿或上斜'},
      {error: '手位过宽或耸肩', correction: '手位约在肩部附近，肩胛稳定下沉，避免耸肩'},
    ],
    provenance: {
      source: '本项目原创教学说明与几何示意；未经动作专家审核',
      license: '仓库内项目内容；未声明可复用的第三方动作库许可证',
      evidenceStatus: 'PROJECT_GUIDANCE_NOT_UPSTREAM_STANDARD',
    },
    upstream: {
      project: 'wger Workout Manager',
      exerciseName: 'Push-Up',
      exerciseId: 1551,
      exerciseUuid: 'f5b84269-18af-4464-a61f-b767cbcd81dc',
      translationUuid: '2f99b628-1389-40c0-8fa6-dcc72eea7b3b',
      apiEvidenceUrl: 'https://wger.de/api/v2/exerciseinfo/?name__search=Push-up&limit=100',
      snapshotUrl: 'data/v02-wger-pushup.json',
      recordLicense: 'CC-BY-SA 4',
      recordLicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      recordAuthor: 'Settebello',
      officialDescription: 'The push-up is a fundamental bodyweight exercise that targets the chest, arms, and shoulders while engaging the core for stability. It requires no equipment and is excellent for building upper body strength.',
      officialImageUrl: 'assets/vendor/wger-push-up-settebello-cc-by-sa-4.png',
      integrationStatus: 'LICENSED_RECORD_IMPORTED',
      legacyStatus: '旧UUID 9d756e84…当前API返回0条；仅保留为历史迁移证据，不再作为可导入记录。',
      limitation: '已导入当前API记录级说明、肌群和图片许可元数据；中文步骤、自查与二维动画仍是项目原创教学层。',
    },
    upstreamVariant: {
      name: '宽距俯卧撑',
      exerciseName: 'Wide Push-Up',
      exerciseId: 1964,
      exerciseUuid: '1842e1be-ac67-4f34-a527-4ca2b72d8e11',
      translationUuid: 'ff601a10-ec6f-4d6e-8e1f-43a411282caa',
      apiEvidenceUrl: 'https://wger.de/api/v2/exerciseinfo/?name__search=push%20up&limit=100',
      snapshotUrl: 'data/v02-wger-wide-pushup.json',
      recordLicense: 'CC-BY-SA 4',
      recordLicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      recordAuthor: 'Anon#2',
      officialDescription: 'A push-up variation with a wider hand placement to increase the emphasis on the outer chest muscles and shoulders.',
      integrationStatus: 'LICENSED_VARIANT_IMPORTED',
      mediaStatus: 'NO_MEDIA_IN_CURRENT_RECORD',
      limitation: '当前上游记录无图片或视频；页面只导入记录级说明、肌群、步骤和许可，不复制或伪造媒体。',
    },
    licensedMediaVariant: {
      name: '击掌俯卧撑',
      exerciseName: 'Clap Push-UP',
      exerciseId: 1554,
      exerciseUuid: 'fdeb0973-121f-494d-8b94-54f1d7ba003f',
      translationUuid: '906e2287-dae0-4479-8951-3ab556aca03a',
      apiEvidenceUrl: 'https://wger.de/api/v2/exerciseinfo/?name__search=push%20up&limit=100',
      snapshotUrl: 'data/v02-wger-clap-pushup.json',
      recordLicense: 'CC-BY-SA 4',
      recordLicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      recordAuthor: 'Settebello',
      imageUrl: 'assets/vendor/wger-clap-push-up-1554.png',
      upstreamImageUrl: 'https://wger.de/media/exercise-images/1554/49207a62-8799-4b47-8c0b-7bde02926f3d.png',
      imageUuid: '49207a62-8799-4b47-8c0b-7bde02926f3d',
      imageSha256: '7e6f3da44a68a285da8d987ad2ebc47f636bf17555e911d7dce0e1bb9be8ad47',
      integrationStatus: 'LICENSED_VARIANT_AND_MEDIA_VENDORED',
      mediaStatus: 'LICENSED_MEDIA_VENDORED',
      limitation: '同一 wger record 1554 的 CC-BY-SA 4 图片已固化到仓库并记录 SHA-256；保留作者、许可与上游链接。',
    },
  };

  const canonicalKeypointSequence = JSON.parse(JSON.stringify(data.keypointSequence));
  let timer = null;
  let phase = 0;
  let speed = 1;
  let trainingSession = null;
  const TRAINING_DRAFT = 'zero-one.exercise.follow.draft.v0.2';
  const TRAINING_HISTORY = 'zero-one.exercise.follow.sessions.v0.2';
  const out = root.querySelector('#v02-ex-content');
  const phaseName = value => data.phases.find(item => value >= item.range[0] && value <= item.range[1])?.name || '动作周期';
  const phaseRecord = value => data.phases.find(item => value >= item.range[0] && value <= item.range[1]) || data.phases[0];
  const definition = {
    guidanceScope: 'PROJECT_STANDARD_PUSH_UP_GUIDANCE_SHARED_ACROSS_VARIANTS',
    aliases: data.aliases,
    category: data.category,
    equipment: data.equipment,
    difficulty: data.difficulty,
    steps: data.steps,
    variants: data.variants,
    sourceVariants: [
      {exerciseId: 'exercise:wger:1964:wide-push-up', wgerId: data.upstreamVariant.exerciseId, name: data.upstreamVariant.name, relation: 'LICENSED_WGER_VARIANT_OF_STANDARD_PUSH_UP', source: data.upstream.project, sourceUrl: data.upstreamVariant.snapshotUrl, author: data.upstreamVariant.recordAuthor, license: data.upstreamVariant.recordLicense, mediaStatus: data.upstreamVariant.mediaStatus},
      {exerciseId: 'exercise:wger:1554:clap-push-up', wgerId: data.licensedMediaVariant.exerciseId, name: data.licensedMediaVariant.name, relation: 'LICENSED_WGER_PLYOMETRIC_VARIANT_OF_STANDARD_PUSH_UP', source: data.upstream.project, sourceUrl: data.licensedMediaVariant.snapshotUrl, author: data.licensedMediaVariant.recordAuthor, license: data.licensedMediaVariant.recordLicense, mediaStatus: data.licensedMediaVariant.mediaStatus},
    ],
    muscles: data.muscles,
    joints: data.joints,
    dynamics: {
      capability: 'PROJECT_2D_TEACHING_ILLUSTRATION',
      scope: 'STANDARD_PUSH_UP_ONLY_NOT_SELECTED_VARIANT_KINEMATICS',
      controls: ['PLAY', 'PAUSE', 'SPEED', 'PHASE_SCRUB'],
      phases: data.phases,
      keypointSequence: data.keypointSequence,
      keypointComparison: null,
    },
  };
  const catalog = [
    {id: data.upstream.exerciseId, exerciseId: data.id, name: data.name, upstreamName: data.upstream.exerciseName, source: data.upstream.project, sourceUrl: data.upstream.snapshotUrl, version: 'wger API snapshot 2026-10-10', author: data.upstream.recordAuthor, license: data.upstream.recordLicense, variantRelation: 'STANDARD_PUSH_UP_RECORD', mediaEvidence: {status: 'LICENSED_MEDIA_VENDORED', repositoryAsset: data.upstream.officialImageUrl, sha256: 'ddaa9b83e32d6c1a36fb15e29249d4672c818157f1a769ad9df88364327e265a'}, status: data.upstream.integrationStatus, description: data.upstream.officialDescription, media: '许可图片已固化', image: data.upstream.officialImageUrl},
    {id: data.upstreamVariant.exerciseId, exerciseId: 'exercise:wger:1964:wide-push-up', name: data.upstreamVariant.name, upstreamName: data.upstreamVariant.exerciseName, source: data.upstream.project, sourceUrl: data.upstreamVariant.snapshotUrl, version: 'wger API snapshot 2026-10-10', author: data.upstreamVariant.recordAuthor, license: data.upstreamVariant.recordLicense, variantRelation: 'LICENSED_WGER_VARIANT_OF_STANDARD_PUSH_UP', mediaEvidence: {status: 'NO_MEDIA_IN_CURRENT_RECORD', repositoryAsset: null, sha256: null}, status: data.upstreamVariant.integrationStatus, description: data.upstreamVariant.officialDescription, media: '当前记录无上游媒体', image: ''},
    {id: data.licensedMediaVariant.exerciseId, exerciseId: 'exercise:wger:1554:clap-push-up', name: data.licensedMediaVariant.name, upstreamName: data.licensedMediaVariant.exerciseName, source: data.upstream.project, sourceUrl: data.licensedMediaVariant.snapshotUrl, version: 'wger API snapshot 2026-10-10', author: data.licensedMediaVariant.recordAuthor, license: data.licensedMediaVariant.recordLicense, variantRelation: 'LICENSED_WGER_PLYOMETRIC_VARIANT_OF_STANDARD_PUSH_UP', mediaEvidence: {status: data.licensedMediaVariant.mediaStatus, repositoryAsset: data.licensedMediaVariant.imageUrl, upstreamUrl: data.licensedMediaVariant.upstreamImageUrl, sha256: data.licensedMediaVariant.imageSha256}, status: data.licensedMediaVariant.integrationStatus, description: 'The clap push-up is an explosive upper body movement that builds power and fast-twitch muscle strength. It adds a plyometric challenge to the traditional push-up by requiring the hands to leave the ground mid-rep.', media: `许可图片已固化｜SHA-256 ${data.licensedMediaVariant.imageSha256}`, image: data.licensedMediaVariant.imageUrl},
  ];

  function renderDossierPreview() {
    const record = catalog.find(item => item.exerciseId === root.dataset.selectedExerciseId);
    const preview = out.querySelector('#v02-ex-dossier-preview');
    if (!record || !preview) return;
    const note = out.querySelector('#v02-ex-notes')?.value || '';
    const dossier = globalThis.ZeroOneDossierContracts.buildExerciseDossier({record, definition, note, phase, phaseId: phaseRecord(phase).phaseId, phaseName: phaseName(phase), speed, guidance: data.provenance.evidenceStatus});
    preview.replaceChildren();
    const heading = document.createElement('h4');
    heading.textContent = '当前动作档案预览';
    const summary = document.createElement('p');
    const rows = [
      ['Exercise ID', record.exerciseId],
      ['上游记录', `wger ${record.id}｜${record.license}｜作者 ${record.author}`],
      ['教学映射', `${record.variantRelation}｜${definition.guidanceScope}｜${definition.dynamics.scope}`],
      ['有来源变式', definition.sourceVariants.map(item => `${item.name} / wger ${item.wgerId} / ${item.license}`).join('；')],
      ['媒体证据', `${record.mediaEvidence.status}｜${record.mediaEvidence.sha256 ? `SHA-256 ${record.mediaEvidence.sha256}` : 'NO_UPSTREAM_MEDIA'}`],
      ['动作时间线', `${definition.dynamics.phases.length}/5｜${definition.dynamics.phases.map(item => item.phaseId).join(' → ')}`],
      ['标准关键点序列', `${definition.dynamics.keypointSequence.frames.length}/5｜${definition.dynamics.keypointSequence.coordinateSystem}`],
      ['训练状态', `${phaseRecord(phase).phaseId}｜${phaseName(phase)}｜${Math.round(phase)}%｜${speed}×`],
      ['当前笔记', note || '未填写'],
      ['对象完整度', `${dossier.completeness.status}｜${dossier.completeness.passed}/${dossier.completeness.total}`],
      ['边界', `LOCAL_BROWSER_ONLY｜${data.provenance.evidenceStatus}`],
    ];
    rows.forEach(([label, value], index) => {
      if (index) summary.append(document.createElement('br'));
      const strong = document.createElement('b');
      strong.textContent = `${label}：`;
      summary.append(strong, document.createTextNode(value));
    });
    preview.append(heading, summary);
    root.dataset.dossierReady = 'true';
    root.dataset.dossierExerciseId = record.exerciseId;
    root.dataset.dossierCompleteness = dossier.completeness.status;
  }

  function selectCatalogRecord(recordId) {
    const record = catalog.find(item => item.id === Number(recordId));
    if (!record) return;
    root.dataset.selectedExerciseId = record.exerciseId;
    root.dataset.selectedRecordLicense = record.license;
    root.dataset.selectedRecordMedia = record.media;
    out.querySelector('#v02-catalog-select').value = String(record.id);
    out.querySelector('#v02-catalog-state').textContent = `${record.name}｜wger record ${record.id}｜${record.license}｜作者 ${record.author}｜${record.media}`;
    out.querySelector('#v02-selected-record').innerHTML = `<h5>${record.name}｜${record.upstreamName}</h5><p>${record.description}</p>${record.image ? `<img src="${record.image}" alt="${record.upstreamName}，${record.license}，作者${record.author}" style="max-width:260px;width:100%;height:auto">` : '<p><b>媒体边界：</b>当前上游记录没有可导入媒体，页面不伪造图片或视频。</p>'}<p><b>对象身份：</b><code>${record.exerciseId}</code>｜<b>接入状态：</b><code>${record.status}</code></p><p class="muted">此处切换的是记录级来源详情；上方二维播放仍是标准俯卧撑项目教学示意，不冒充所选变式动画。</p>`;
    const notesInput = out.querySelector('#v02-ex-notes');
    const notesStatus = out.querySelector('#v02-ex-notes-status');
    if (notesInput && notesStatus) {
      try {
        notesInput.value = localStorage.getItem(`zero-one.exercise.notes:${record.exerciseId}`) || '';
        notesStatus.textContent = '';
      } catch (_) {
        notesStatus.textContent = '本地存储不可用';
      }
    }
    renderDossierPreview();
  }

  function renderKeypointComparison(comparison) {
    const panel = out.querySelector('#v02-keypoint-comparison');
    panel.replaceChildren();
    const heading = document.createElement('h4');
    heading.textContent = '导入序列与项目标准序列差异';
    const summary = document.createElement('p');
    summary.textContent = `五阶段 × 五点位｜平均二维位移 ${comparison.meanDistance.toFixed(4)}｜最大 ${comparison.maxDistance.toFixed(4)}｜来源 ${comparison.provenance?.artifactId || 'UNSPECIFIED'}`;
    const interpretation = document.createElement('p');
    interpretation.dataset.largestDeviation = `${comparison.largestDeviation.phaseId}:${comparison.largestDeviation.point}`;
    interpretation.innerHTML = `<b>最大参考偏差：</b>${comparison.largestDeviation.phaseId} / ${comparison.largestDeviation.point}｜${comparison.largestDeviation.distance.toFixed(4)}。先复核阶段对齐、取景与标点；这不是动作质量判定。`;
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>阶段</th><th>shoulder</th><th>elbow</th><th>wrist</th><th>hip</th><th>ankle</th></tr></thead>';
    const body = document.createElement('tbody');
    comparison.frames.forEach(frame => {
      const row = document.createElement('tr');
      const phaseCell = document.createElement('td');
      phaseCell.textContent = frame.phaseId;
      row.append(phaseCell);
      ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'].forEach(name => {
        const point = frame.points[name];
        const cell = document.createElement('td');
        cell.dataset.comparisonPoint = `${frame.phaseId}:${name}`;
        if (frame.phaseId === comparison.largestDeviation.phaseId && name === comparison.largestDeviation.point) {
          cell.dataset.largestDeviation = 'true';
          cell.style.fontWeight = '700';
          cell.style.outline = '2px solid #b65f2a';
        }
        cell.textContent = `${point.distance.toFixed(4)} (Δx ${point.dx.toFixed(3)}, Δy ${point.dy.toFixed(3)})`;
        row.append(cell);
      });
      body.append(row);
    });
    table.append(body);
    const boundary = document.createElement('p');
    boundary.className = 'muted';
    boundary.textContent = '仅比较同一归一化二维坐标系中的参考点位移；不是摄像头姿态识别、动作诊断或医学结论。';
    panel.append(heading, summary, interpretation, table, boundary);
    root.dataset.keypointComparison = comparison.schema;
    root.dataset.keypointComparisonPoints = String(comparison.pointCount);
    root.dataset.keypointLargestDeviation = `${comparison.largestDeviation.phaseId}:${comparison.largestDeviation.point}`;
    root.dataset.keypointArtifactId = comparison.provenance?.artifactId || '';
    root.dataset.keypointSourceSha = comparison.provenance?.sourceSha256 || '';
  }

  function draw() {
    const s = Math.sin(phase * Math.PI / 100);
    const dy = 40 * s;
    const svg = `<svg viewBox="0 0 460 190" role="img" aria-label="俯卧撑二维侧面运动示意" style="width:100%;max-width:620px;background:#f2f5f0;border-radius:12px">
      <path d="M20 160H440" stroke="#a8b5a9" stroke-width="2"/>
      <path d="M70 142 L170 ${68 + dy} L305 ${68 + dy} L390 143" fill="none" stroke="#1b5137" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="145" cy="${55 + dy}" r="17" fill="#9bbca4"/>
      <path d="M170 ${68 + dy} L205 ${110 + dy * .5} L220 158 M305 ${68 + dy} L355 ${104 + dy * .5} L390 143" fill="none" stroke="#46785b" stroke-width="7" stroke-linecap="round"/>
      <text x="18" y="25" fill="#24442d" font-size="14">教学示意｜${phaseName(phase)}｜阶段 ${Math.round(phase)}%</text>
    </svg>`;
    out.querySelector('#v02-svg').innerHTML = svg;
    out.querySelector('#v02-phase').value = phase;
    out.querySelector('#v02-phase-name').textContent = phaseName(phase);
    const currentPhase = phaseRecord(phase);
    const phaseDetail = out.querySelector('#v02-phase-detail');
    phaseDetail.replaceChildren();
    const phaseHeading = document.createElement('b');
    phaseHeading.textContent = `${currentPhase.name}｜${currentPhase.phaseId}`;
    const jointLine = document.createElement('p');
    jointLine.textContent = `关节动作：${currentPhase.jointActions.join('；')}`;
    const alignmentLine = document.createElement('p');
    alignmentLine.textContent = `身体排列：${currentPhase.bodyAlignment}`;
    phaseDetail.append(phaseHeading, jointLine, alignmentLine);
    phaseDetail.dataset.phaseId = currentPhase.phaseId;
    const keypointFrame = data.keypointSequence.frames.find(item => item.phaseId === currentPhase.phaseId);
    const keypointPanel = out.querySelector('#v02-keypoint-sequence');
    keypointPanel.replaceChildren();
    const keypointHeading = document.createElement('b');
    keypointHeading.textContent = `标准关键点帧 ${keypointFrame.frame + 1}/5｜${keypointFrame.phaseId}`;
    const keypointLine = document.createElement('p');
    keypointLine.textContent = Object.entries(keypointFrame.points).map(([name, point]) => `${name} (${point.join(', ')})`).join('；');
    const keypointBoundary = document.createElement('p');
    keypointBoundary.className = 'muted';
    keypointBoundary.textContent = data.keypointSequence.limitation;
    keypointPanel.append(keypointHeading, keypointLine, keypointBoundary);
    keypointPanel.dataset.phaseId = keypointFrame.phaseId;
    out.querySelectorAll('#v02-phase-sequence [data-phase-target]').forEach(button => {
      if (button.dataset.phaseTarget === currentPhase.phaseId) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    root.dataset.phase = String(Math.round(phase));
    root.dataset.phaseName = phaseName(phase);
    renderDossierPreview();
  }

  function trainingPhaseIndex() {
    return trainingSession ? Math.min(trainingSession.completedPhaseIds.length, data.phases.length - 1) : 0;
  }

  function persistTrainingDraft() {
    if (trainingSession) localStorage.setItem(TRAINING_DRAFT, JSON.stringify(trainingSession));
  }

  function trainingHistory() {
    try {
      const records = JSON.parse(localStorage.getItem(TRAINING_HISTORY) || '[]');
      return Array.isArray(records) ? records.filter(item => item?.exerciseId === data.id) : [];
    } catch (_) {
      return [];
    }
  }

  function validateTrainingRecord(record) {
    const expectedPhases = data.phases.map(item => item.phaseId);
    if (!record || record.schema !== 'zero-one.exercise.follow.session.v0.2') return 'schema 不匹配';
    if (!/^follow-[0-9]+$/.test(record.sessionId || '')) return 'Session ID 无效';
    if (record.exerciseId !== data.id || record.sourceRecordId !== data.upstream.exerciseId) return 'Exercise 来源不一致';
    if (JSON.stringify(record.phaseIds) !== JSON.stringify(expectedPhases) || JSON.stringify(record.completedPhaseIds) !== JSON.stringify(expectedPhases)) return '五阶段完成链不一致';
    if (!['轻松', '合适', '偏吃力', '疼痛或麻木'].includes(record.feedback)) return '反馈值无效';
    if (record.boundary !== 'PROJECT_2D_TEACHING_ILLUSTRATION_NOT_CAMERA_RECOGNITION_OR_MEDICAL_ADVICE') return '边界声明不一致';
    return '';
  }

  function downloadTrainingRecord(record) {
    const blob = new Blob([`${JSON.stringify(record, null, 2)}\n`], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${record.sessionId}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function feedbackNextStep(feedback) {
    const guidance = {
      '轻松': '保持动作质量；下次只小幅增加次数或缩短休息，不自动升级难度。',
      '合适': '保持当前次数与节奏，继续优先脊柱中立和稳定控制。',
      '偏吃力': '下次减少次数或活动幅度，并延长休息；动作变形时提前停止。',
      '疼痛或麻木': '停止本动作，不要直接复练；若持续、加重或伴随无力，请寻求合格医疗或康复专业人员评估。'
    };
    return guidance[feedback] || '先复核本次记录，再决定是否继续。';
  }

  function renderTrainingHistory() {
    const box = out.querySelector('#v02-follow-history');
    if (!box) return;
    const records = trainingHistory();
    root.dataset.followHistoryCount = String(records.length);
    box.replaceChildren();
    if (!records.length) {
      box.textContent = '尚无已完成跟练。';
      return;
    }
    records.slice(0, 5).forEach((record, index) => {
      const row = document.createElement('p');
      row.dataset.followHistorySession = record.sessionId;
      row.textContent = `${index + 1}. ${record.sessionId}｜5/5｜感受：${record.feedback}｜${record.completedAt}`;
      const repeat = document.createElement('button');
      repeat.type = 'button';
      repeat.className = 'chip';
      repeat.dataset.repeatFollowSession = record.sessionId;
      const repeatBlocked = record.feedback === '疼痛或麻木';
      repeat.disabled = repeatBlocked;
      repeat.dataset.repeatBlocked = String(repeatBlocked);
      repeat.textContent = repeatBlocked ? '已阻止直接复练' : '按本次 Exercise 再练一次';
      repeat.onclick = () => startTrainingSession(record.sessionId);
      const exportButton = document.createElement('button');
      exportButton.type = 'button';
      exportButton.className = 'chip';
      exportButton.dataset.exportFollowSession = record.sessionId;
      exportButton.textContent = '导出本次记录';
      exportButton.onclick = () => downloadTrainingRecord(record);
      const details = document.createElement('details');
      details.dataset.followDetailsSession = record.sessionId;
      const summary = document.createElement('summary');
      summary.textContent = '查看本次五阶段完成路线';
      const phaseList = document.createElement('ol');
      record.completedPhaseIds.forEach((phaseId, phaseIndex) => {
        const phase = data.phases.find(item => item.phaseId === phaseId);
        const item = document.createElement('li');
        item.dataset.followDetailPhase = phaseId;
        item.textContent = `${phaseIndex + 1}. ${phase?.name || phaseId}｜${phaseId}`;
        phaseList.append(item);
      });
      const boundary = document.createElement('p');
      boundary.className = 'muted';
      boundary.textContent = `本次感受：${record.feedback}｜来源 record ${record.sourceRecordId}｜这是用户跟练记录，不是摄像头识别或医学建议。`;
      const nextStep = document.createElement('p');
      nextStep.className = repeatBlocked ? 'status warn' : 'status';
      nextStep.dataset.followNextStep = record.sessionId;
      nextStep.textContent = `下一步：${feedbackNextStep(record.feedback)}`;
      details.append(summary, phaseList, boundary);
      row.append(' ', repeat, ' ', exportButton, nextStep, details);
      box.append(row);
    });
  }

  function renderTrainingSession() {
    const status = out.querySelector('#v02-follow-status');
    const plan = out.querySelector('#v02-follow-plan');
    const complete = out.querySelector('#v02-follow-complete');
    const feedback = out.querySelector('#v02-follow-feedback');
    if (!status || !plan || !complete || !feedback) return;
    if (!trainingSession) {
      status.textContent = '尚未开始；本跟练只绑定标准俯卧撑 Exercise，不把变式记录冒充为同一动态。';
      plan.textContent = '本次计划：标准俯卧撑五阶段｜基础方案（尚无上次反馈）。';
      plan.dataset.planSource = 'BASELINE';
      complete.disabled = true;
      feedback.hidden = true;
      root.dataset.followStatus = 'NOT_STARTED';
      return;
    }
    const completed = trainingSession.completedPhaseIds.length;
    root.dataset.followSessionId = trainingSession.sessionId;
    root.dataset.followExerciseId = trainingSession.exerciseId;
    root.dataset.followCompletedPhases = String(completed);
    root.dataset.followAdaptation = trainingSession.adaptationInstruction || 'BASELINE';
    plan.dataset.planSource = trainingSession.parentSessionId || 'BASELINE';
    plan.textContent = trainingSession.adaptationInstruction
      ? `本次调整计划｜依据 ${trainingSession.parentSessionId} 的“${trainingSession.parentFeedback}”反馈：${trainingSession.adaptationInstruction}`
      : '本次计划：标准俯卧撑五阶段｜基础方案（尚无上次反馈）。';
    if (completed < data.phases.length) {
      const next = data.phases[trainingPhaseIndex()];
      const adaptation = trainingSession.adaptationInstruction ? `｜本次调整：${trainingSession.adaptationInstruction}` : '';
      status.textContent = `${trainingSession.sessionId}｜${completed}/5 已完成｜当前：${next.name}（${next.phaseId}）${adaptation}`;
      complete.disabled = false;
      complete.textContent = `完成“${next.name}”并进入下一阶段`;
      feedback.hidden = true;
      root.dataset.followStatus = 'IN_PROGRESS';
      return;
    }
    status.textContent = `${trainingSession.sessionId}｜5/5 阶段已完成｜请选择本次感受，形成训练记录。`;
    complete.disabled = true;
    feedback.hidden = false;
    root.dataset.followStatus = 'AWAITING_FEEDBACK';
  }

  function startTrainingSession(parentSessionId = null) {
    const parentRecord = typeof parentSessionId === 'string' ? trainingHistory().find(item => item.sessionId === parentSessionId) : null;
    trainingSession = {
      schema: 'zero-one.exercise.follow.session.v0.2',
      sessionId: `follow-${Date.now()}`,
      exerciseId: data.id,
      sourceRecordId: data.upstream.exerciseId,
      guidanceScope: definition.guidanceScope,
      phaseIds: data.phases.map(item => item.phaseId),
      completedPhaseIds: [],
      feedback: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      parentSessionId: parentRecord?.sessionId || null,
      parentFeedback: parentRecord?.feedback || null,
      adaptationInstruction: parentRecord ? feedbackNextStep(parentRecord.feedback) : null,
      boundary: 'PROJECT_2D_TEACHING_ILLUSTRATION_NOT_CAMERA_RECOGNITION_OR_MEDICAL_ADVICE',
    };
    phase = Math.round((data.phases[0].range[0] + data.phases[0].range[1]) / 2);
    persistTrainingDraft();
    draw();
    renderTrainingSession();
  }

  function render() {
    clearInterval(timer);
    out.innerHTML = `
      <h3>${data.name} <small>(${data.id})</small></h3>
      <p><b>分类：</b>${data.category}｜<b>器械：</b>${data.equipment}｜<b>难度：</b>${data.difficulty}</p>
      <div id="v02-svg"></div>
      <div><button class="btn" id="v02-play">播放</button> <button class="btn ghost" id="v02-stop">暂停</button>
        <label>速度 <select id="v02-speed"><option value="0.5">0.5×慢放</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select></label>
        <label>动作阶段 <input type="range" id="v02-phase" min="0" max="100" value="0"></label> <strong id="v02-phase-name"></strong></div>
      <section id="v02-phase-detail" class="result" aria-live="polite"></section>
      <nav id="v02-phase-sequence" aria-label="俯卧撑动作阶段">${data.phases.map(item => `<button type="button" class="chip" data-phase-target="${item.phaseId}" data-phase-value="${Math.round((item.range[0] + item.range[1]) / 2)}">${item.name}</button>`).join(' ')}</nav>
      <section id="v02-keypoint-sequence" class="result" aria-live="polite"></section>
      <p><label class="btn ghost">导入来源关键点产物 JSON<input id="v02-keypoint-import" type="file" accept=".json,application/json" style="display:none"></label>
        <button class="btn ghost" id="v02-load-keypoint-artifact" type="button">载入许可图片标注样板</button>
        <span id="v02-keypoint-import-receipt" class="muted" role="status" aria-live="polite">尚未导入；当前使用仓库标准序列。</span></p>
      <section id="v02-keypoint-comparison" class="result" aria-live="polite"><p class="muted">导入合法的五阶段序列后，这里显示与项目标准序列的逐点二维差异。</p></section>
      <h4>标准步骤</h4><ol>${data.steps.map(x => `<li>${x}</li>`).join('')}</ol>
      <h4>肌群角色</h4><p><b>主要：</b>${data.muscles.primary.join('、')}<br><b>辅助：</b>${data.muscles.secondary.join('、')}<br><b>稳定：</b>${data.muscles.stabilizers.join('、')}</p>
      <h4>关节 / 骨骼运动</h4><ul id="v02-joints">${data.joints.map(item => `<li><b>${item.joint}</b>：下降 ${item.down}；推起 ${item.up}</li>`).join('')}</ul>
      <p><b>常见调整：</b>${data.variants.map(x => `${x.name}（${x.relation}）`).join('、')}</p>
      <fieldset id="v02-form-checklist"><legend>常见错误自查（项目原创教学提示，非医学诊断）</legend><ul>${data.formErrors.map((item, i) => `<li><input type="checkbox" id="v02-form-${i}"><label for="v02-form-${i}"><b>错误：</b>${item.error}；<b>纠正：</b>${item.correction}</label></li>`).join('')}</ul></fieldset>
      <section id="v02-ex-notes-section"><h4>所选动作训练笔记</h4>
        <p class="muted">笔记按当前 Exercise ID 隔离，只保存在本机浏览器；不会上传，也不改变动作标准或许可证据。</p>
        <textarea id="v02-ex-notes" rows="3" aria-label="所选动作训练笔记" placeholder="记录次数、感受或待改进点" style="width:100%;max-width:620px"></textarea><br>
        <button class="btn ghost" id="v02-ex-notes-save" type="button">保存当前动作笔记</button>
        <button class="btn ghost" id="v02-ex-export" type="button">导出当前动作档案</button>
        <span id="v02-ex-notes-status" class="muted" aria-live="polite"></span>
      </section>
      <section id="v02-ex-dossier-preview" class="result" aria-live="polite"></section>
      <section id="v02-follow-session" class="plan"><h4>标准俯卧撑连续跟练｜同一 Exercise ID</h4>
        <p class="muted">依次完成 5 个稳定阶段，再记录感受；记录只保存在本机。该流程不把击掌/宽距变式当成标准俯卧撑动态，也不声称摄像头识别。</p>
        <button class="btn" id="v02-follow-start" type="button">开始一次标准俯卧撑跟练</button>
        <button class="btn ghost" id="v02-follow-complete" type="button" disabled>完成当前阶段</button>
        <p id="v02-follow-status" aria-live="polite"></p>
        <p id="v02-follow-plan" class="status" aria-live="polite">本次计划：标准俯卧撑五阶段｜基础方案（尚无上次反馈）。</p>
        <div id="v02-follow-feedback" hidden><b>本次感受</b> ${['轻松', '合适', '偏吃力', '疼痛或麻木'].map(value => `<button class="chip" type="button" data-follow-feedback="${value}">${value}</button>`).join(' ')}</div>
        <p id="v02-follow-receipt" class="status" aria-live="polite"></p>
        <h5>最近完成记录</h5><div id="v02-follow-history" aria-live="polite"></div>
        <p><label class="btn ghost">导入跟练记录 JSON<input id="v02-follow-import" type="file" accept=".json,application/json" style="display:none"></label>
        <span id="v02-follow-history-status" class="muted" role="status" aria-live="polite"></span></p>
      </section>
      <p><b>来源：</b>${data.provenance.source}<br><b>许可：</b>${data.provenance.license}<br><b>证据状态：</b>${data.provenance.evidenceStatus}</p>
      <section id="v02-licensed-catalog"><h4>可操作许可动作目录｜3 条真实 wger 记录</h4>
        <p><label for="v02-catalog-select">动作记录</label> <select id="v02-catalog-select">${catalog.map(item => `<option value="${item.id}">${item.name}｜record ${item.id}</option>`).join('')}</select>
        <button class="btn ghost" id="v02-catalog-open" type="button">载入所选证据</button></p>
        <p id="v02-catalog-state" class="status" aria-live="polite"></p>
        <article id="v02-selected-record" class="result" aria-live="polite"></article>
        <table><thead><tr><th>record</th><th>动作</th><th>许可/作者</th><th>媒体证据</th></tr></thead><tbody>${catalog.map(item => `<tr data-wger-record="${item.id}"><td>${item.id}</td><td>${item.name}</td><td>${item.license}｜${item.author}</td><td>${item.media}</td></tr>`).join('')}</tbody></table>
      </section>
      <section id="v02-upstream"><h4>成熟开放动作记录｜已导入</h4><p><b>${data.upstream.project}</b>｜${data.upstream.exerciseName}｜record ${data.upstream.exerciseId}｜UUID <code>${data.upstream.exerciseUuid}</code><br>
        记录许可：<a href="${data.upstream.recordLicenseUrl}">${data.upstream.recordLicense}</a>｜作者 ${data.upstream.recordAuthor}｜<a href="${data.upstream.apiEvidenceUrl}">当前API</a>｜<a href="${data.upstream.snapshotUrl}">本仓快照</a><br>
        接入状态：<code>${data.upstream.integrationStatus}</code><br>${data.upstream.limitation}</p></section>
      <figure id="v02-upstream-media"><img src="${data.upstream.officialImageUrl}" alt="wger Push-Up动作图片，CC-BY-SA 4，作者Settebello" style="max-width:260px;width:100%;height:auto"><figcaption>${data.upstream.officialDescription}<br>来源：wger record 1551；图片与说明 CC-BY-SA 4，作者 Settebello。</figcaption></figure>
      <section id="v02-upstream-variant"><h4>常见变式｜第二条成熟开放记录</h4><p><b>${data.upstreamVariant.name}</b>｜${data.upstreamVariant.exerciseName}｜record ${data.upstreamVariant.exerciseId}｜UUID <code>${data.upstreamVariant.exerciseUuid}</code><br>
        记录许可：<a href="${data.upstreamVariant.recordLicenseUrl}">${data.upstreamVariant.recordLicense}</a>｜作者 ${data.upstreamVariant.recordAuthor}｜<a href="${data.upstreamVariant.apiEvidenceUrl}">当前API</a>｜<a href="${data.upstreamVariant.snapshotUrl}">本仓快照</a><br>
        <button class="btn ghost" id="v02-load-wide" type="button">切换到宽距变式证据</button> <span id="v02-variant-state">尚未选择</span><br>
        接入状态：<code>${data.upstreamVariant.integrationStatus}</code>｜媒体状态：<code>${data.upstreamVariant.mediaStatus}</code><br>${data.upstreamVariant.limitation}</p></section>
      <section id="v02-licensed-media-variant"><h4>许可记录 + 同记录媒体｜击掌变式</h4><p><b>${data.licensedMediaVariant.name}</b>｜${data.licensedMediaVariant.exerciseName}｜record ${data.licensedMediaVariant.exerciseId}｜UUID <code>${data.licensedMediaVariant.exerciseUuid}</code><br>
        记录与图片许可：<a href="${data.licensedMediaVariant.recordLicenseUrl}">${data.licensedMediaVariant.recordLicense}</a>｜作者 ${data.licensedMediaVariant.recordAuthor}｜图片 UUID <code>${data.licensedMediaVariant.imageUuid}</code>｜<a href="${data.licensedMediaVariant.upstreamImageUrl}">上游原图</a>｜<a href="${data.licensedMediaVariant.apiEvidenceUrl}">当前API</a>｜<a href="${data.licensedMediaVariant.snapshotUrl}">本仓快照</a><br>
        <img src="${data.licensedMediaVariant.imageUrl}" alt="wger Clap Push-Up，CC-BY-SA 4，作者Settebello" style="max-width:260px;width:100%;height:auto"><br>仓库资产 SHA-256：<code>${data.licensedMediaVariant.imageSha256}</code><br>
        <button class="btn ghost" id="v02-load-clap" type="button">切换到击掌变式证据</button> <span id="v02-clap-state">尚未选择</span><br>
        接入状态：<code>${data.licensedMediaVariant.integrationStatus}</code>｜媒体状态：<code>${data.licensedMediaVariant.mediaStatus}</code><br>${data.licensedMediaVariant.limitation}</p></section>
      <p class="muted">${data.upstream.legacyStatus}</p>
      <p class="status">状态：A01已接入标准、宽距和击掌俯卧撑三条许可明确的成熟动作库记录；击掌变式同记录图片已固化并记录哈希。仍需 Pages 门与完整报告，不能标完成。</p>`;
    out.querySelector('#v02-play').onclick = () => {
      clearInterval(timer);
      timer = setInterval(() => { phase = (phase + 2 * speed) % 101; draw(); }, 55);
    };
    out.querySelector('#v02-stop').onclick = () => clearInterval(timer);
    out.querySelector('#v02-speed').onchange = event => { speed = Number(event.target.value); root.dataset.speed = String(speed); renderDossierPreview(); };
    out.querySelector('#v02-phase').oninput = event => { phase = Number(event.target.value); draw(); };
    out.querySelectorAll('#v02-phase-sequence [data-phase-target]').forEach(button => {
      button.onclick = () => { phase = Number(button.dataset.phaseValue); draw(); };
    });
    async function applyKeypointArtifact(imported) {
      const receipt = out.querySelector('#v02-keypoint-import-receipt');
      const validationError = globalThis.ZeroOneDossierContracts.validateStandardKeypointSequence(imported, data.phases);
      if (validationError) throw Error(validationError);
      const provenanceError = globalThis.ZeroOneDossierContracts.validateKeypointArtifactProvenance(imported);
      if (provenanceError) throw Error(provenanceError);
      const comparison = {
        ...globalThis.ZeroOneDossierContracts.compareStandardKeypointSequences(canonicalKeypointSequence, imported, data.phases),
        provenance: JSON.parse(JSON.stringify(imported.provenance)),
      };
      data.keypointSequence = JSON.parse(JSON.stringify(imported));
      definition.dynamics.keypointSequence = JSON.parse(JSON.stringify(imported));
      definition.dynamics.keypointComparison = JSON.parse(JSON.stringify(comparison));
      root.dataset.keypointImportStatus = 'PROVENANCE_VALIDATED_AND_APPLIED';
      root.dataset.keypointImportFrames = String(imported.frames.length);
      receipt.textContent = `导入成功：${imported.provenance.artifactId}｜${imported.provenance.mediaType}｜SHA-256 ${imported.provenance.sourceSha256.slice(0, 16)}…｜五阶段比较已计算；静态图片标注不等于视频追踪。`;
      renderKeypointComparison(comparison);
      draw();
    }

    out.querySelector('#v02-load-keypoint-artifact').onclick = async () => {
      const receipt = out.querySelector('#v02-keypoint-import-receipt');
      try {
        const response = await fetch('data/v02-wger-clap-keypoint-artifact.json');
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        await applyKeypointArtifact(await response.json());
      } catch (error) {
        root.dataset.keypointImportStatus = 'REJECTED_WITHOUT_REPLACEMENT';
        receipt.textContent = `样板载入拒绝：${error.message}；当前关键点序列未被覆盖。`;
      }
    };

    out.querySelector('#v02-keypoint-import').onchange = async event => {
      const receipt = out.querySelector('#v02-keypoint-import-receipt');
      try {
        const imported = JSON.parse(await event.target.files[0].text());
        await applyKeypointArtifact(imported);
      } catch (error) {
        root.dataset.keypointImportStatus = 'REJECTED_WITHOUT_REPLACEMENT';
        receipt.textContent = `导入拒绝：${error.message}；当前关键点序列未被覆盖。`;
      } finally {
        event.target.value = '';
      }
    };
    out.querySelector('#v02-ex-notes-save').onclick = () => {
      const notesStatus = out.querySelector('#v02-ex-notes-status');
      try {
        localStorage.setItem(`zero-one.exercise.notes:${root.dataset.selectedExerciseId}`, out.querySelector('#v02-ex-notes').value);
        notesStatus.textContent = `已保存到 ${root.dataset.selectedExerciseId}`;
      } catch (_) {
        notesStatus.textContent = '无法保存：本地存储不可用';
      }
    };
    out.querySelector('#v02-ex-notes').oninput = renderDossierPreview;
    out.querySelector('#v02-follow-start').onclick = () => startTrainingSession();
    out.querySelector('#v02-follow-complete').onclick = () => {
      if (!trainingSession || trainingSession.completedPhaseIds.length >= data.phases.length) return;
      const current = data.phases[trainingSession.completedPhaseIds.length];
      trainingSession.completedPhaseIds.push(current.phaseId);
      if (trainingSession.completedPhaseIds.length < data.phases.length) {
        const next = data.phases[trainingSession.completedPhaseIds.length];
        phase = Math.round((next.range[0] + next.range[1]) / 2);
      }
      persistTrainingDraft();
      draw();
      renderTrainingSession();
    };
    out.querySelectorAll('[data-follow-feedback]').forEach(button => {
      button.onclick = () => {
        if (!trainingSession || trainingSession.completedPhaseIds.length !== data.phases.length) return;
        trainingSession.feedback = button.dataset.followFeedback;
        trainingSession.completedAt = new Date().toISOString();
        const history = JSON.parse(localStorage.getItem(TRAINING_HISTORY) || '[]');
        history.unshift(trainingSession);
        localStorage.setItem(TRAINING_HISTORY, JSON.stringify(history.slice(0, 20)));
        localStorage.removeItem(TRAINING_DRAFT);
        root.dataset.followStatus = 'RECORDED';
        root.dataset.followFeedback = trainingSession.feedback;
        out.querySelector('#v02-follow-receipt').textContent = `已记录 ${trainingSession.sessionId}｜${trainingSession.exerciseId}｜5/5｜感受：${trainingSession.feedback}｜下一步：${feedbackNextStep(trainingSession.feedback)}`;
        out.querySelector('#v02-follow-feedback').hidden = true;
        renderTrainingHistory();
      };
    });
    out.querySelector('#v02-follow-import').onchange = async event => {
      const status = out.querySelector('#v02-follow-history-status');
      try {
        const imported = JSON.parse(await event.target.files[0].text());
        const error = validateTrainingRecord(imported);
        if (error) throw new Error(error);
        const history = trainingHistory();
        const existing = history.find(item => item.sessionId === imported.sessionId);
        if (existing && JSON.stringify(existing) !== JSON.stringify(imported)) throw new Error('同一 Session ID 的内容冲突');
        if (!existing) localStorage.setItem(TRAINING_HISTORY, JSON.stringify([imported, ...history].slice(0, 20)));
        root.dataset.followImportStatus = existing ? 'ALREADY_PRESENT' : 'PASS';
        status.textContent = existing ? `无需重复导入：${imported.sessionId} 已存在且内容一致。` : `导入成功：${imported.sessionId}｜${imported.exerciseId}｜5/5｜可继续复练。`;
        renderTrainingHistory();
      } catch (error) {
        root.dataset.followImportStatus = 'REJECTED_WITHOUT_OVERWRITE';
        status.textContent = `导入拒绝：${error.message}；现有跟练记录未被覆盖。`;
      } finally {
        event.target.value = '';
      }
    };
    out.querySelector('#v02-ex-export').onclick = () => {
      const record = catalog.find(item => item.exerciseId === root.dataset.selectedExerciseId);
      const dossier = globalThis.ZeroOneDossierContracts.buildExerciseDossier({
        record,
        definition,
        note: out.querySelector('#v02-ex-notes').value,
        phase,
        phaseId: phaseRecord(phase).phaseId,
        phaseName: phaseName(phase),
        speed,
        guidance: data.provenance.evidenceStatus,
      });
      const blob = new Blob([`${JSON.stringify(dossier, null, 2)}\n`], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${record.exerciseId.replaceAll(':', '-')}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 500);
      out.querySelector('#v02-ex-notes-status').textContent = `已导出 ${record.exerciseId}`;
    };
    out.querySelector('#v02-catalog-open').onclick = () => selectCatalogRecord(out.querySelector('#v02-catalog-select').value);
    out.querySelector('#v02-load-wide').onclick = () => {
      selectCatalogRecord(data.upstreamVariant.exerciseId);
      root.dataset.variantStatus = data.upstreamVariant.integrationStatus;
      out.querySelector('#v02-variant-state').textContent = `${data.upstreamVariant.exerciseName} 已选择｜${data.upstreamVariant.recordLicense}｜作者 ${data.upstreamVariant.recordAuthor}｜无上游媒体`;
    };
    out.querySelector('#v02-load-clap').onclick = () => {
      selectCatalogRecord(data.licensedMediaVariant.exerciseId);
      root.dataset.mediaVariantStatus = data.licensedMediaVariant.integrationStatus;
      out.querySelector('#v02-clap-state').textContent = `${data.licensedMediaVariant.exerciseName} 已选择｜记录与图片 ${data.licensedMediaVariant.recordLicense}｜作者 ${data.licensedMediaVariant.recordAuthor}`;
    };
    root.dataset.exerciseId = data.id;
    root.dataset.provenance = data.provenance.evidenceStatus;
    root.dataset.upstreamStatus = data.upstream.integrationStatus;
    root.dataset.variantCount = '3';
    selectCatalogRecord(data.upstream.exerciseId);
    draw();
    try {
      const draft = JSON.parse(localStorage.getItem(TRAINING_DRAFT) || 'null');
      if (draft?.schema === 'zero-one.exercise.follow.session.v0.2' && draft.exerciseId === data.id && Array.isArray(draft.completedPhaseIds)) trainingSession = draft;
    } catch (_) {}
    renderTrainingSession();
    renderTrainingHistory();
  }

  root.querySelector('#v02-ex-find').onclick = () => {
    const query = root.querySelector('#v02-ex-input').value.toLowerCase();
    if (data.aliases.some(alias => query.includes(alias))) render();
    else {
      clearInterval(timer);
      out.textContent = '当前仅有俯卧撑教学样机；未找到可核验的动作库条目。';
    }
  };
  render();
})();
