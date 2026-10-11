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
    <figure id="r-archive-preview" hidden><img alt="Frederick Douglass House HABS 首层平面图" style="max-width:100%;height:auto"><figcaption></figcaption>
      <section id="r-engine-overlay" hidden><h3>同案校准几何分析图｜Radiance 传感点</h3><svg id="r-radiance-map" viewBox="0 0 760 520" role="img" aria-label="HABS同案校准几何与Radiance照度传感点" style="width:100%;max-width:760px;background:#f2f5f0;border-radius:12px"></svg>
        <p id="r-radiance-legend" class="muted"></p></section>
    </figure>
    <div id="r-next-question" class="result" aria-live="polite"></div>
    <details open><summary>实际材料清单</summary><ul id="r-material-manifest"></ul></details>
    <details open><summary>字段证据账本</summary><ul id="r-evidence"></ul></details>
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
  const fields = Object.fromEntries(keys.map(key => [key, root.querySelector(`#r-${key}`)]));
  let caseId = `residence-${Date.now().toString(36)}`;
  let revisions = [];
  let evidence = {};
  let materialFiles = [];

  function hydrate(record) {
    if (!record || record.schema !== 'zero-one.residence.v0.2') return false;
    caseId = String(record.id || caseId);
    revisions = Array.isArray(record.revisions) ? record.revisions.slice(-20) : [];
    evidence = record.evidence && typeof record.evidence === 'object' ? record.evidence : {};
    materialFiles = Array.isArray(record.materialFiles) ? record.materialFiles.slice(-20) : [];
    keys.forEach(key => { fields[key].value = String(record.fields?.[key] || record[key] || ''); });
    return true;
  }

  try { hydrate(JSON.parse(localStorage.getItem('v02-residence') || 'null')); } catch (_) {}

  function fieldSnapshot() {
    return Object.fromEntries(keys.map(key => [key, fields[key].value.trim()]));
  }

  function collect() {
    return {
      schema: 'zero-one.residence.v0.2',
      id: caseId,
      updatedAt: new Date().toISOString(),
      fields: fieldSnapshot(),
      evidence,
      materialFiles,
      revisions,
      boundaries: {
        modelRun: 'NOT_STARTED',
        geometryContinuity: 'NOT_PROVEN',
        crossLayerEquivalence: 'BLOCK',
      },
    };
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

  function renderMaterialManifest() {
    root.querySelector('#r-material-manifest').innerHTML = materialFiles.length
      ? materialFiles.map(item => `<li data-material-sha="${item.sha256}"><b>${item.name}</b>｜${item.bytes} bytes｜SHA-256 <code>${item.sha256}</code>｜${item.source}｜${item.license}｜case <code>${item.caseId}</code></li>`).join('')
      : '<li>尚未绑定实际材料文件；文件内容不上传，档案只保存名称、大小、类型、SHA-256、来源、许可与案例ID。</li>';
    root.dataset.materialCount = String(materialFiles.length);
    root.dataset.lastMaterialSha = materialFiles.at(-1)?.sha256 || '';
  }

  function captureEvidence(snapshot, at) {
    for (const [key, value] of Object.entries(snapshot)) {
      if (!value || key === 'source' || key === 'confidence') continue;
      if (!evidence[key] || evidence[key].value !== value) {
        evidence[key] = {
          value,
          source: snapshot.source || 'SOURCE_MISSING',
          confidence: snapshot.confidence || 'CONFIDENCE_MISSING',
          capturedAt: at,
        };
      }
    }
  }

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
    root.querySelector('#r-result').textContent = `住宅ID：${record.id}｜已知字段：${keys.length - missing.length}/${keys.length}｜待补充：${missing.map(key => labels[key]).join('、') || '无'}${directionValid ? '' : '｜朝向必须在0至360度之间'}。后续计算尚未与此住宅ID绑定；不输出未经计算的环境或吉凶结论。`;
    root.querySelector('#r-next-question').textContent = missing.length
      ? `先生下一问：请补充“${labels[missing[0]]}”，并说明它来自测量、描述、图纸还是现场观察。`
      : '材料字段已齐；B01仍需真实住宅材料验收，且B02引擎尚未准入。';
    root.dataset.residenceId = record.id;
    root.dataset.knownCount = String(keys.length - missing.length);
    root.dataset.missingCount = String(missing.length);
    root.dataset.nextField = missing[0] || '';
    renderHistory();
    renderEvidence();
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
    captureEvidence(fieldSnapshot(), capturedAt);
    renderMaterialManifest();
    root.querySelector('#r-result').textContent = `材料已绑定住宅ID ${caseId}：${file.name}｜SHA-256 ${sha256}。尚未运行空间/环境模型，不输出判断。`;
  };

  root.querySelector('#r-save').onclick = () => {
    if (!check()) return;
    const record = collect();
    captureEvidence(record.fields, record.updatedAt);
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
      if (!hydrate(record)) throw Error('文件格式不符');
      check();
    } catch (error) {
      root.querySelector('#r-result').textContent = `导入失败：${error.message}`;
    }
  };

  root.querySelector('#r-new').onclick = () => {
    caseId = `residence-${Date.now().toString(36)}`;
    revisions = [];
    evidence = {};
    materialFiles = [];
    keys.forEach(key => { fields[key].value = ''; });
    check();
  };

  check();
})();
