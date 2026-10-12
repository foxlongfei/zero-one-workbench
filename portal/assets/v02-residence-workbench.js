(() => {
  const root = document.createElement('section');
  root.className = 'card';
  root.id = 'v02-residence';
  root.innerHTML = `
    <h2>V0.2｜住宅整体工作台（B01开发中）</h2>
    <p class="muted">同一 Residence/Case ID 持续记录材料、来源、置信度、未知项和补充历史；数据只保存在当前浏览器，可导出 JSON。不代表已完成空间或堪舆判断。</p>
    <div class="grid">
      <label>住宅名称<input id="r-name" placeholder="住宅A"></label>
      <label>所在地区<input id="r-place" placeholder="城市/区域"></label>
      <label>朝向（度）<input id="r-dir" type="number" min="0" max="359.999" step="any" placeholder="0-359.999"></label>
      <label>楼层<input id="r-floor" placeholder="例如 3/6"></label>
      <label>房间与布局<textarea id="r-rooms" rows="3" placeholder="房间、门窗及位置"></textarea></label>
      <label>面积与尺度<textarea id="r-size" rows="3" placeholder="面积、边长、单位"></textarea></label>
      <label>居住者需求<textarea id="r-needs" rows="3" placeholder="采光、睡眠、隐私等"></textarea></label>
      <label>周边环境<textarea id="r-surround" rows="3" placeholder="道路、水体、建筑遮挡等"></textarea></label>
      <label>材料说明<textarea id="r-material" rows="3" placeholder="户型图/照片/测量记录及文件名"></textarea></label>
      <label>材料来源<select id="r-source"><option value="">来源未填</option><option value="USER_MEASURED">用户测量</option><option value="USER_REPORTED">用户描述</option><option value="DRAWING_OR_ARCHIVE">图纸/档案</option><option value="FIELD_OBSERVED">现场观察</option></select></label>
      <label>当前置信度<select id="r-confidence"><option value="">未评估</option><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option></select></label>
      <label>材料许可/授权<input id="r-material-license" placeholder="例如 USER_AUTHORIZED / CC BY 4.0"></label>
      <label>实际材料文件<input id="r-material-file" type="file" accept=".json,.dxf,.svg,.png,.jpg,.jpeg,.pdf,application/json,image/*,application/pdf"></label>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
      <button class="btn" id="r-save">保存补充并检查</button>
      <button class="btn" id="r-ingest-material">绑定材料文件与SHA-256</button>
      <button class="btn" id="r-load-sample">加载K3可追溯参考材料</button>
      <button class="btn" id="r-load-archive-home">加载HABS真实历史住宅档案</button>
      <button class="btn" id="r-export">导出连续档案JSON</button>
      <label class="btn">导入JSON<input type="file" accept=".json,application/json" id="r-import" style="display:none"></label>
      <button class="btn ghost" id="r-new">新建另一住宅</button>
    </div>
    <div id="r-result" class="result" aria-live="polite"></div>
    <div id="r-import-receipt" class="result" role="status" aria-live="polite">导入回执：尚未导入档案。</div>
    <figure id="r-archive-preview" hidden><img alt="Frederick Douglass House HABS 首层平面图" style="max-width:100%;height:auto"><figcaption></figcaption>
      <section id="r-engine-overlay" hidden><h3>同案校准几何分析图｜Radiance 传感点</h3><svg id="r-radiance-map" viewBox="0 0 760 520" role="img" aria-label="HABS同案校准几何与Radiance照度传感点" style="width:100%;max-width:760px;background:#f2f5f0;border-radius:12px"></svg>
        <p id="r-radiance-legend" class="muted"></p></section>
    </figure>
    <div id="r-next-question" class="result" aria-live="polite"></div>
    <div id="r-clarification-queue" class="result" aria-live="polite"></div>
    <div id="r-evidence-coverage" class="result" aria-live="polite"></div>
    <fieldset id="r-field-evidence"><legend>逐字段补证</legend>
      <label>字段<select id="r-evidence-field"></select></label>
      <label>独立来源<select id="r-evidence-source"><option value="">来源未填</option><option value="USER_MEASURED">用户测量</option><option value="USER_REPORTED">用户描述</option><option value="DRAWING_OR_ARCHIVE">图纸/档案</option><option value="FIELD_OBSERVED">现场观察</option></select></label>
      <label>独立置信度<select id="r-evidence-confidence"><option value="">未评估</option><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option></select></label>
      <button class="btn ghost" id="r-save-field-evidence" type="button">保存这一字段证据</button>
      <button class="btn ghost" id="r-undo-field-evidence" type="button">撤销这一字段证据</button>
      <span id="r-field-evidence-receipt" class="muted" aria-live="polite">尚未补证。</span>
    </fieldset>
    <div id="r-provenance-summary" class="result" role="status" aria-live="polite"></div>
    <details open><summary>实际材料清单</summary><ul id="r-material-manifest"></ul></details>
    <details open><summary>字段证据账本</summary><ul id="r-evidence"></ul></details>
    <details open><summary>证据修订历史</summary><ol id="r-evidence-revisions"></ol></details>
    <details open><summary>住宅字段修订链</summary><div id="r-field-revision-receipt" class="muted" aria-live="polite">尚无字段保存或冲突回执。</div><ol id="r-field-revisions"></ol></details>
    <details><summary>同一住宅补充记录</summary><ol id="r-history"></ol></details>`;
  const main = document.querySelector('main');
  main.insertBefore(root, main.children[1] || null);

  const fieldDefs = [
    ['name', '住宅名称'], ['place', '所在地区'], ['dir', '朝向'], ['floor', '楼层'],
    ['rooms', '房间与布局'], ['size', '面积与尺度'], ['needs', '居住者需求'],
    ['surround', '周边环境'], ['material', '材料说明'], ['source', '材料来源'], ['confidence', '当前置信度'],
  ];
  const keys = fieldDefs.map(item => item[0]);
  const labels = Object.fromEntries(fieldDefs);
  const evidenceKeys = fieldDefs.map(item => item[0]).filter(key => key !== 'source' && key !== 'confidence');
  const fields = Object.fromEntries(keys.map(key => [key, root.querySelector(`#r-${key}`)]));
  let caseId = `residence-${Date.now().toString(36)}`;
  let revisions = [];
  let evidence = {};
  let evidenceRevisions = [];
  let fieldRevisions = [];
  let savedFields = Object.fromEntries(keys.map(key => [key, '']));
  let materialFiles = [];
  const emptyBoundaries = () => ({modelRun: 'NOT_STARTED', geometryContinuity: 'NOT_PROVEN', crossLayerEquivalence: 'BLOCK'});
  let boundaries = emptyBoundaries();
  let analysisChain = null;

  function hydrate(record) {
    if (!record || record.schema !== 'zero-one.residence.v0.2') return false;
    caseId = String(record.id || caseId);
    revisions = Array.isArray(record.revisions) ? record.revisions.slice(-20) : [];
    evidence = record.evidence && typeof record.evidence === 'object' ? record.evidence : {};
    evidenceRevisions = Array.isArray(record.evidenceRevisions) ? record.evidenceRevisions.slice(-50) : [];
    fieldRevisions = Array.isArray(record.fieldRevisions) ? record.fieldRevisions.slice(-50) : [];
    materialFiles = Array.isArray(record.materialFiles) ? record.materialFiles.slice(-20) : [];
    boundaries = record.boundaries && typeof record.boundaries === 'object' ? {...record.boundaries} : emptyBoundaries();
    analysisChain = record.analysisChain && typeof record.analysisChain === 'object' ? {...record.analysisChain} : null;
    keys.forEach(key => { fields[key].value = String(record.fields?.[key] || record[key] || ''); });
    savedFields = Object.fromEntries(keys.map(key => [key, fields[key].value.trim()]));
    return true;
  }

  function validateImportedRecord(record) {
    return globalThis.ZeroOneDossierContracts.validateResidenceImport(record);
  }

  try { hydrate(JSON.parse(localStorage.getItem('v02-residence') || 'null')); } catch (_) {}

  function fieldSnapshot() {
    return Object.fromEntries(keys.map(key => [key, fields[key].value.trim()]));
  }

  function collect() {
    const record = {
      schema: 'zero-one.residence.v0.2',
      id: caseId,
      updatedAt: new Date().toISOString(),
      fields: fieldSnapshot(),
      evidence,
      evidenceRevisions,
      fieldRevisions,
      materialFiles,
      materialProvenance: summarizeMaterialProvenance(),
      revisions,
      boundaries,
      analysisChain,
    };
    record.materialChain = globalThis.ZeroOneDossierContracts.assessResidenceMaterialChain(record);
    record.clarificationState = globalThis.ZeroOneDossierContracts.assessResidenceClarification(record);
    return record;
  }

  function missingFields(record) {
    return keys.filter(key => !record.fields[key]);
  }

  function renderHistory() {
    root.querySelector('#r-history').innerHTML = revisions.length
      ? revisions.map(rev => `<li>${rev.at}｜已知 ${rev.known}/${keys.length}｜待补 ${rev.missing.map(key => labels[key]).join('、') || '无'}</li>`).join('')
      : '<li>尚无保存记录。</li>';
  }

  function renderEvidence() {
    const rows = Object.entries(evidence).filter(([key]) => labels[key]);
    root.querySelector('#r-evidence').innerHTML = rows.length
      ? rows.map(([key, item]) => `<li data-field="${key}"><b>${labels[key]}</b>｜${item.source || 'SOURCE_MISSING'}｜${item.confidence || 'CONFIDENCE_MISSING'}｜${item.capturedAt}</li>`).join('')
      : '<li>尚无已保存的字段证据。</li>';
  }

  function renderEvidenceRevisions() {
    const list = root.querySelector('#r-evidence-revisions');
    list.replaceChildren();
    if (!evidenceRevisions.length) {
      const item = document.createElement('li');
      item.textContent = '尚无证据编辑或撤销记录。';
      list.append(item);
      return;
    }
    evidenceRevisions.forEach(revision => {
      const item = document.createElement('li');
      item.dataset.evidenceRevision = revision.field;
      const before = revision.before ? `${revision.before.source}/${revision.before.confidence}` : 'NONE';
      const after = revision.after ? `${revision.after.source}/${revision.after.confidence}` : 'NONE';
      item.textContent = `${revision.at}｜${revision.action}｜${labels[revision.field]}｜${before} → ${after}`;
      list.append(item);
    });
    root.dataset.evidenceRevisionCount = String(evidenceRevisions.length);
  }

  function appendEvidenceRevision(field, action, before, after, at) {
    evidenceRevisions.push({caseId, field, action, before, after, at});
    evidenceRevisions = evidenceRevisions.slice(-50);
  }

  function renderFieldRevisions() {
    const list = root.querySelector('#r-field-revisions');
    list.replaceChildren();
    if (!fieldRevisions.length) {
      const item = document.createElement('li');
      item.textContent = '尚无已接受的住宅字段修订。';
      list.append(item);
    } else {
      fieldRevisions.forEach(revision => {
        const item = document.createElement('li');
        item.dataset.fieldRevision = revision.revisionId;
        item.textContent = `${revision.at}｜${revision.revisionId}｜${revision.changes.map(change => `${labels[change.field]}：“${change.before || '空'}” → “${change.after || '空'}”`).join('；')}`;
        list.append(item);
      });
    }
    root.dataset.fieldRevisionCount = String(fieldRevisions.length);
    root.dataset.fieldRevisionHead = fieldRevisions.at(-1)?.revisionId || '';
  }

  function summarizeMaterialProvenance() {
    const sourceCounts = {};
    let missingLicenseCount = 0;
    for (const item of materialFiles) {
      const source = String(item.source || '').trim() || 'SOURCE_MISSING';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      if (!String(item.license || '').trim()) missingLicenseCount += 1;
    }
    return {
      status: materialFiles.length ? 'RECORDED' : 'NONE',
      total: materialFiles.length,
      sourceCounts,
      missingLicenseCount,
      boundary: 'MATERIAL_METADATA_DOES_NOT_PROVE_GEOMETRY_OR_ENVIRONMENT',
    };
  }

  function renderMaterialProvenanceSummary() {
    const summary = summarizeMaterialProvenance();
    const node = root.querySelector('#r-provenance-summary');
    root.dataset.materialProvenance = summary.status;
    root.dataset.materialSourceCount = String(Object.keys(summary.sourceCounts).length);
    root.dataset.materialMissingLicenseCount = String(summary.missingLicenseCount);
    if (!summary.total) {
      node.textContent = '材料来源摘要：尚无实际材料文件。文件来源、许可与 SHA-256 仅为档案记录，不构成空间、几何或环境事实。';
      return;
    }
    const breakdown = Object.entries(summary.sourceCounts).map(([source, count]) => `${source} × ${count}`).join('、');
    const licenseState = summary.missingLicenseCount ? `${summary.missingLicenseCount} 项缺少许可/授权` : '全部材料均有许可/授权记录';
    node.textContent = `材料来源摘要：共 ${summary.total} 项；${breakdown}；${licenseState}。这些元数据不证明住宅几何、朝向、布局或环境事实。`;
  }

  function renderMaterialManifest() {
    root.querySelector('#r-material-manifest').innerHTML = materialFiles.length
      ? materialFiles.map(item => `<li data-material-sha="${item.sha256}"><b>${item.name}</b>｜${item.bytes} bytes｜SHA-256 <code>${item.sha256}</code>｜${item.source}｜${item.license}｜case <code>${item.caseId}</code></li>`).join('')
      : '<li>尚未绑定实际材料文件；文件内容不上传，档案只保存名称、大小、类型、SHA-256、来源、许可与案例ID。</li>';
    root.dataset.materialCount = String(materialFiles.length);
    root.dataset.lastMaterialSha = materialFiles.at(-1)?.sha256 || '';
    renderMaterialProvenanceSummary();
  }

  const evidenceField = root.querySelector('#r-evidence-field');
  evidenceField.innerHTML = evidenceKeys.map(key => `<option value="${key}">${labels[key]}</option>`).join('');

  function syncEvidenceEditor(announce = true) {
    const key = evidenceField.value;
    const item = evidence[key];
    root.querySelector('#r-evidence-source').value = item?.source || '';
    root.querySelector('#r-evidence-confidence').value = item?.confidence || '';
    if (announce) root.querySelector('#r-field-evidence-receipt').textContent = item
      ? `正在编辑：${labels[key]}｜${item.source}｜${item.confidence}`
      : `${labels[key]}尚无独立证据。`;
  }

  evidenceField.onchange = () => syncEvidenceEditor(true);

  root.querySelector('#r-save-field-evidence').onclick = () => {
    const key = evidenceField.value;
    const value = fields[key].value.trim();
    const source = root.querySelector('#r-evidence-source').value;
    const confidence = root.querySelector('#r-evidence-confidence').value;
    const receipt = root.querySelector('#r-field-evidence-receipt');
    if (!value || !source || !confidence) {
      receipt.textContent = `补证失败：${labels[key]}必须先有值，并单独选择来源与置信度。`;
      return;
    }
    const before = evidence[key] ? {...evidence[key]} : null;
    const capturedAt = new Date().toISOString();
    evidence[key] = {value, source, confidence, capturedAt};
    appendEvidenceRevision(key, 'SAVE', before, {...evidence[key]}, capturedAt);
    receipt.textContent = `已补证：${labels[key]}｜${source}｜${confidence}`;
    check();
  };

  root.querySelector('#r-undo-field-evidence').onclick = () => {
    const key = evidenceField.value;
    const receipt = root.querySelector('#r-field-evidence-receipt');
    if (!evidence[key]) {
      receipt.textContent = `无需撤销：${labels[key]}尚无独立证据。`;
      return;
    }
    const before = {...evidence[key]};
    const at = new Date().toISOString();
    delete evidence[key];
    appendEvidenceRevision(key, 'UNDO', before, null, at);
    syncEvidenceEditor(false);
    receipt.textContent = `已撤销：${labels[key]}字段值保留，证据记录已移除。`;
    check();
  };

  function renderRadianceMap(trace, radiance) {
    if (trace.caseId !== radiance.caseId) throw Error('geometry trace and Radiance case mismatch');
    const [originX, originY] = trace.calibration.originPixel;
    const xScale = trace.calibration.x.metresPerPixel;
    const yScale = trace.calibration.y.metresPerPixel;
    const widthM = trace.calibration.x.metres;
    const depthM = trace.calibration.y.metres;
    const point = ([x, y]) => [40 + ((x - originX) * xScale / widthM) * 680, 480 - ((originY - y) * yScale / depthM) * 440];
    const polygon = trace.exteriorPolylinePixels.map(item => point(item).map(value => value.toFixed(1)).join(',')).join(' ');
    const min = radiance.analysis.summary.minimumLux;
    const max = radiance.analysis.summary.maximumLux;
    const sensor = item => {
      const x = 40 + (item.xM / widthM) * 680;
      const y = 480 - (item.yM / depthM) * 440;
      const ratio = Math.max(0, Math.min(1, (item.illuminanceLux - min) / (max - min || 1)));
      const hue = Math.round(220 - ratio * 220);
      return `<circle data-radiance-sensor="${item.id}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="hsl(${hue} 82% 48%)"><title>${item.id}｜${item.illuminanceLux} lux</title></circle>`;
    };
    const windowLine = item => {
      const x1 = 40 + (item.startM / widthM) * 680;
      const x2 = 40 + (item.endM / widthM) * 680;
      return `<line data-radiance-window="${item.id}" x1="${x1.toFixed(1)}" y1="480" x2="${x2.toFixed(1)}" y2="480" stroke="#2b82c9" stroke-width="8"><title>${item.id}｜南向窗位人工估计</title></line>`;
    };
    root.querySelector('#r-radiance-map').innerHTML = `<polygon points="${polygon}" fill="#fff" stroke="#1b5137" stroke-width="4"/>${radiance.model.windows.map(windowLine).join('')}${radiance.analysis.sensors.map(sensor).join('')}<path d="M720 70V25m0 0-10 18m10-18 10 18" stroke="#24442d" stroke-width="3" fill="none"/><text x="706" y="90" fill="#24442d">北*</text><text x="40" y="510" fill="#24442d">蓝：${min} lux</text><text x="650" y="510" text-anchor="end" fill="#24442d">红：${max} lux</text>`;
    root.querySelector('#r-engine-overlay').hidden = false;
    root.querySelector('#r-radiance-legend').textContent = `80 个同案传感点；圆点悬停可读照度。轮廓来自 HABS 人工矢量描线与标注尺度校准；南窗位置、北向、层高与窗高均为待第二人 CAD/现场复核的显式假设，不是原图像素级配准。`;
    root.dataset.radianceMapPoints = String(radiance.analysis.sensors.length);
    root.dataset.radianceMapWindows = String(radiance.model.windows.length);
    root.dataset.geometryTraceCase = trace.caseId;
  }

  function check() {
    const record = collect();
    const missing = missingFields(record);
    const directionValid = record.fields.dir === '' || (Number.isFinite(+record.fields.dir) && +record.fields.dir >= 0 && +record.fields.dir < 360);
    const analysisState = analysisChain?.caseId === record.id
      ? `同案分析已绑定：depthmapX ${analysisChain.depthmapX.pointCount} 点；Radiance ${analysisChain.radiance.sensorCount} 点。`
      : '后续计算尚未与此住宅ID绑定。';
    root.querySelector('#r-result').textContent = `住宅ID：${record.id}｜已知字段：${keys.length - missing.length}/${keys.length}｜待补充：${missing.map(key => labels[key]).join('、') || '无'}${directionValid ? '' : '｜朝向必须在0至360度之间'}。${analysisState}不输出未经计算的环境或吉凶结论。`;
    root.querySelector('#r-next-question').textContent = `先生下一问：${record.clarificationState.question}`;
    const queue = root.querySelector('#r-clarification-queue');
    queue.replaceChildren();
    const queueHeading = document.createElement('b');
    queueHeading.textContent = `补充队列｜${record.clarificationState.knownCount}/${record.clarificationState.totalFields} 已知`;
    queue.append(queueHeading);
    if (record.clarificationState.missingFields.length) {
      const queueList = document.createElement('ol');
      for (const key of record.clarificationState.missingFields) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip';
        button.dataset.clarificationField = key;
        button.textContent = `补充：${labels[key]}`;
        button.addEventListener('click', () => fields[key].focus());
        item.append(button);
        queueList.append(item);
      }
      queue.append(queueList);
    } else {
      queue.append(document.createTextNode('｜无待补字段；仍需真实住宅材料验收。'));
    }
    root.dataset.clarificationStatus = record.clarificationState.status;
    const evidenceCoverage = root.querySelector('#r-evidence-coverage');
    evidenceCoverage.replaceChildren();
    const evidenceHeading = document.createElement('b');
    evidenceHeading.textContent = `字段证据覆盖｜${record.clarificationState.evidencedKnownCount}/${record.clarificationState.knownEvidenceRequiredCount}`;
    evidenceCoverage.append(evidenceHeading);
    if (record.clarificationState.unsupportedKnownFields.length) {
      const gap = document.createElement('p');
      gap.textContent = `已填写但待补来源/置信度：${record.clarificationState.unsupportedKnownFields.map(key => labels[key]).join('、')}`;
      evidenceCoverage.append(gap);
    } else {
      evidenceCoverage.append(document.createTextNode('｜已填写的实质字段均有匹配来源与置信度记录。'));
    }
    root.dataset.evidencedKnownCount = String(record.clarificationState.evidencedKnownCount);
    root.dataset.unsupportedKnownFields = record.clarificationState.unsupportedKnownFields.join('|');
    root.dataset.residenceId = record.id;
    root.dataset.knownCount = String(keys.length - missing.length);
    root.dataset.missingCount = String(missing.length);
    root.dataset.nextField = missing[0] || '';
    renderHistory();
    renderEvidence();
    renderEvidenceRevisions();
    renderFieldRevisions();
    syncEvidenceEditor(false);
    renderMaterialManifest();
    return directionValid;
  }

  root.querySelector('#r-ingest-material').onclick = async () => {
    const file = root.querySelector('#r-material-file').files[0];
    const source = fields.source.value;
    const license = root.querySelector('#r-material-license').value.trim();
    if (!file || !source || !license) {
      root.querySelector('#r-result').textContent = '材料绑定失败：必须选择实际文件，并填写材料来源与许可/授权。';
      return;
    }
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    const capturedAt = new Date().toISOString();
    materialFiles.push({caseId, name: file.name, bytes: file.size, mediaType: file.type || 'application/octet-stream', sha256, source, license, capturedAt});
    materialFiles = materialFiles.slice(-20);
    fields.material.value = `${file.name}｜SHA-256 ${sha256}`;
    const beforeEvidence = evidence.material ? {...evidence.material} : null;
    evidence.material = {value: fields.material.value.trim(), source, confidence: fields.confidence.value || 'CONFIDENCE_MISSING', capturedAt};
    appendEvidenceRevision('material', 'SAVE', beforeEvidence, {...evidence.material}, capturedAt);
    renderMaterialManifest();
    root.querySelector('#r-result').textContent = `材料已绑定住宅ID ${caseId}：${file.name}｜SHA-256 ${sha256}。尚未运行空间/环境模型，不输出判断。`;
  };

  root.querySelector('#r-save').onclick = () => {
    if (!check()) return;
    const record = collect();
    const currentFields = record.fields;
    const changes = keys.filter(key => savedFields[key] !== currentFields[key]).map(key => ({field: key, before: savedFields[key], after: currentFields[key]}));
    const conflicts = changes.filter(change => evidence[change.field] && evidence[change.field].value !== change.after);
    const fieldReceipt = root.querySelector('#r-field-revision-receipt');
    if (conflicts.length) {
      root.dataset.fieldRevisionStatus = 'CONFLICT_REJECTED';
      root.dataset.fieldRevisionConflicts = conflicts.map(change => change.field).join('|');
      fieldReceipt.textContent = `保存拒绝：${conflicts.map(change => labels[change.field]).join('、')}的新值与已保存证据值冲突。请更新或撤销相应证据后重试；当前修订链未改变。`;
      return;
    }
    if (changes.length) {
      const at = record.updatedAt;
      const parentRevisionId = fieldRevisions.at(-1)?.revisionId || null;
      const revisionId = `field-revision-${at.replace(/\D/g, '')}-${fieldRevisions.length + 1}`;
      fieldRevisions.push({caseId, revisionId, parentRevisionId, at, changes});
      fieldRevisions = fieldRevisions.slice(-50);
      savedFields = {...currentFields};
      root.dataset.fieldRevisionStatus = 'SAVED';
      root.dataset.fieldRevisionConflicts = '';
      fieldReceipt.textContent = `字段修订已保存：${revisionId}｜${changes.map(change => labels[change.field]).join('、')}。`;
    } else {
      root.dataset.fieldRevisionStatus = 'NO_FIELD_CHANGE';
      fieldReceipt.textContent = '字段未变化；未生成空修订。';
    }
    const missing = missingFields(record);
    revisions.push({at: record.updatedAt, known: keys.length - missing.length, missing});
    revisions = revisions.slice(-20);
    record.revisions = revisions;
    try {
      localStorage.setItem('v02-residence', JSON.stringify(record));
      check();
    } catch (error) {
      root.querySelector('#r-result').textContent += ` 浏览器保存失败：${error.message}`;
    }
  };

  root.querySelector('#r-load-sample').onclick = async () => {
    try {
      const response = await fetch('data/v02-residence-reference-room.json');
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const record = await response.json();
      if (!hydrate(record)) throw Error('参考材料格式不符');
      check();
      root.dataset.sampleStatus = record.sampleStatus || 'STATUS_MISSING';
      root.dataset.sourceArtifact = record.sourceArtifact || '';
      root.querySelector('#r-result').textContent += ' 已加载K3可追溯参考模型；它不是用户真实住宅，楼层与周边现场材料仍缺失。';
    } catch (error) {
      root.querySelector('#r-result').textContent = `参考材料加载失败：${error.message}`;
    }
  };

  root.querySelector('#r-load-archive-home').onclick = async () => {
    try {
      const response = await fetch('data/v02-habs-frederick-douglass-house.json');
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const record = await response.json();
      if (!hydrate(record)) throw Error('HABS档案格式不符');
      check();
      root.dataset.sampleStatus = record.sampleStatus || 'STATUS_MISSING';
      root.dataset.sourceArtifact = record.sourceArtifact || '';
      root.dataset.archiveLicense = record.license || '';
      root.dataset.engineGeometry = record.boundaries?.geometryContinuity || '';
      root.dataset.depthmapStatus = record.boundaries?.depthmapX || '';
      root.dataset.radianceStatus = record.boundaries?.radiance || '';
      root.dataset.crossLayerEquivalence = record.boundaries?.crossLayerEquivalence || '';
      root.dataset.materialSha = record.repositoryAssetSha256 || '';
      const preview = root.querySelector('#r-archive-preview');
      preview.hidden = false;
      preview.querySelector('img').src = record.repositoryAsset.replace('../assets/', 'assets/');
      preview.querySelector('figcaption').textContent = `${record.sourceArtifact}｜${record.license}｜SHA-256 ${record.repositoryAssetSha256}`;
      const runResponse = await fetch(`data/${record.analysisArtifacts.depthmapRun}`);
      if (!runResponse.ok) throw Error(`depthmapX run HTTP ${runResponse.status}`);
      const run = await runResponse.json();
      const radianceResponse = await fetch(`data/${record.analysisArtifacts.radianceRun}`);
      if (!radianceResponse.ok) throw Error(`Radiance run HTTP ${radianceResponse.status}`);
      const radiance = await radianceResponse.json();
      if (radiance.caseId !== record.id || radiance.passed !== true) throw Error('Radiance same-case evidence mismatch');
      const traceResponse = await fetch('../research/depthmap/habs-dc-97-first-floor-trace.json');
      if (!traceResponse.ok) throw Error(`geometry trace HTTP ${traceResponse.status}`);
      const trace = await traceResponse.json();
      renderRadianceMap(trace, radiance);
      boundaries = {...record.boundaries};
      analysisChain = {
        caseId: record.id,
        geometryTrace: record.analysisArtifacts.geometryTrace,
        depthmapX: {engine: run.engine.version, pointCount: run.output.pointCount, outputSha256: run.output.sha256, connectivity: run.output.connectivity},
        radiance: {engine: radiance.engine.version, sensorCount: radiance.analysis.sensorCount, modelSha256: radiance.model.sha256, summary: radiance.analysis.summary, assumptions: radiance.model.assumptions},
        artifacts: {...record.analysisArtifacts},
      };
      root.dataset.depthmapPointCount = String(run.output.pointCount);
      root.dataset.depthmapOutputSha = run.output.sha256;
      root.dataset.radianceSensorCount = String(radiance.analysis.sensorCount);
      root.dataset.radianceModelSha = radiance.model.sha256;
      root.querySelector('#r-result').innerHTML += ` 已加载HABS真实历史住宅首层平面图；它不是用户住宅。首版墙线已按图纸标注尺度矢量化并由 depthmapX ${run.engine.version} 实跑 VGA：<b>${run.output.pointCount} 个点</b>，Connectivity ${run.output.connectivity.minimum}–${run.output.connectivity.maximum}，平均 ${run.output.connectivity.mean}。同一 Case/描线再由 ${radiance.engine.version} 实跑 Washington DC 夏至晴空工作面分析：<b>${radiance.analysis.sensorCount} 个传感点</b>，平均 ${radiance.analysis.summary.meanLux} lux，范围 ${radiance.analysis.summary.minimumLux}–${radiance.analysis.summary.maximumLux} lux。<a href="data/${record.analysisArtifacts.depthmapRun}">depthmapX 证据</a>｜<a href="data/${record.analysisArtifacts.depthmapCsv}">VGA CSV</a>｜<a href="data/${record.analysisArtifacts.radianceRun}">Radiance 证据</a>｜<a href="data/${record.analysisArtifacts.radianceCsv}">照度 CSV</a>。人工描线仍需第二人 CAD 复核；窗位、朝向和高度是待现场复核的显式假设；不输出吉凶结论。`;
    } catch (error) {
      root.querySelector('#r-result').textContent = `HABS档案加载失败：${error.message}`;
    }
  };

  root.querySelector('#r-export').onclick = () => {
    if (!check()) return;
    const blob = new Blob([`${JSON.stringify(collect(), null, 2)}\n`], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${caseId}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  root.querySelector('#r-import').onchange = async event => {
    try {
      const record = JSON.parse(await event.target.files[0].text());
      const validationError = validateImportedRecord(record);
      if (validationError) throw Error(validationError);
      if (!hydrate(record)) throw Error('文件格式不符');
      check();
      const imported = collect();
      const integrity = globalThis.ZeroOneDossierContracts.assessResidenceAnalysisChain(imported);
      const materialIntegrity = globalThis.ZeroOneDossierContracts.assessResidenceMaterialChain(imported);
      root.dataset.importStatus = 'VALIDATED_AND_IMPORTED';
      root.dataset.importedCaseId = imported.id;
      root.dataset.importedAnalysisIntegrity = integrity.status;
      root.dataset.importedMaterialIntegrity = materialIntegrity.status;
      root.dataset.importedDepthmapPoints = String(imported.analysisChain?.depthmapX?.pointCount || 0);
      root.dataset.importedRadianceSensors = String(imported.analysisChain?.radiance?.sensorCount || 0);
      const known = keys.length - missingFields(imported).length;
      const clarification = imported.clarificationState;
      const depthHash = imported.analysisChain?.depthmapX?.outputSha256?.slice(0, 12) || 'NONE';
      const radianceHash = imported.analysisChain?.radiance?.modelSha256?.slice(0, 12) || 'NONE';
      root.querySelector('#r-import-receipt').textContent = `导入成功：${imported.id}｜${integrity.status}｜${materialIntegrity.status} ${materialIntegrity.sha256Count}/${materialIntegrity.materialCount} SHA-256｜${clarification.status}｜已知 ${known}/${keys.length}｜待补 ${clarification.missingFields.length}｜下一字段 ${clarification.nextField || 'NONE'}｜材料 ${imported.materialFiles.length} 项｜depthmapX ${root.dataset.importedDepthmapPoints} 点 / ${depthHash}…｜Radiance ${root.dataset.importedRadianceSensors} 点 / ${radianceHash}…；同案链状态只证明档案契约与证据标识一致，不代表新一轮模型已运行。`;
    } catch (error) {
      root.dataset.importStatus = 'REJECTED_WITHOUT_HYDRATION';
      root.dataset.importedAnalysisIntegrity = 'INVALID_ANALYSIS_CHAIN';
      root.dataset.importedMaterialIntegrity = 'INVALID_MATERIAL_CHAIN';
      root.querySelector('#r-result').textContent = `导入失败：${error.message}`;
      root.querySelector('#r-import-receipt').textContent = `导入拒绝：${error.message}；当前 Residence/Case 未被覆盖。`;
    }
  };

  root.querySelector('#r-new').onclick = () => {
    caseId = `residence-${Date.now().toString(36)}`;
    revisions = [];
    evidence = {};
    evidenceRevisions = [];
    fieldRevisions = [];
    savedFields = Object.fromEntries(keys.map(key => [key, '']));
    materialFiles = [];
    boundaries = emptyBoundaries();
    analysisChain = null;
    delete root.dataset.importStatus;
    delete root.dataset.importedCaseId;
    delete root.dataset.importedDepthmapPoints;
    delete root.dataset.importedRadianceSensors;
    root.querySelector('#r-import-receipt').textContent = '导入回执：尚未导入档案。';
    root.querySelector('#r-field-revision-receipt').textContent = '尚无字段保存或冲突回执。';
    keys.forEach(key => { fields[key].value = ''; });
    check();
  };

  check();
})();
