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
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
      <button class="btn" id="r-save">保存补充并检查</button>
      <button class="btn" id="r-export">导出连续档案JSON</button>
      <label class="btn">导入JSON<input type="file" accept=".json,application/json" id="r-import" style="display:none"></label>
      <button class="btn ghost" id="r-new">新建另一住宅</button>
    </div>
    <div id="r-result" class="result" aria-live="polite"></div>
    <div id="r-next-question" class="result" aria-live="polite"></div>
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

  function hydrate(record) {
    if (!record || record.schema !== 'zero-one.residence.v0.2') return false;
    caseId = String(record.id || caseId);
    revisions = Array.isArray(record.revisions) ? record.revisions.slice(-20) : [];
    evidence = record.evidence && typeof record.evidence === 'object' ? record.evidence : {};
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
    return directionValid;
  }

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
    keys.forEach(key => { fields[key].value = ''; });
    check();
  };

  check();
})();
