import { COORD, resolveMovementInput, decorateMovementReferences } from './movement-coordinate.js';
const LOG_KEY = 'movement.practice.log.v1';
const CONSENT_KEY = 'movement.practice.consent.v1';
const $ = sel => document.querySelector(sel);
const el = {
  input: $('#body-input'), resolve: $('#resolve-btn'), out: $('#result'), log: $('#practice-log'),
  count: $('#log-count'), consent: $('#consent'), clear: $('#clear-log'), export: $('#export-log'),
  import: $('#import-log'), status: $('#status-line')
};
let crosswalk = null;
const loadCrosswalk = async () => { try { const r = await fetch('./data/crosswalk.json'); if (r.ok) crosswalk = await r.json(); } catch { crosswalk = null; } };
const readLog = () => { try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]'); } catch { return []; } };
const writeLog = entries => { if (localStorage.getItem(CONSENT_KEY) === 'granted') localStorage.setItem(LOG_KEY, JSON.stringify(entries)); };
const renderLog = () => {
  const entries = readLog();
  el.count.textContent = entries.length;
  el.log.replaceChildren(...entries.slice(0, 24).map(e => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="t">${new Date(e.at).toLocaleString()}</span><span class="q">${escapeHtml(e.raw)}</span><span class="s">${e.status}</span>`;
    return li;
  }));
};
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const render = result => {
  const decorated = decorateMovementReferences(result, crosswalk);
  const statusText = {
    SAFETY_OR_SYMPTOM: '⚠️ 症状语言', ASK_DISAMBIGUATION: '❓ 需要澄清', DEFER_OUT_OF_SAMPLE: '🚧 暂未纳入样本',
    NO_MATCH: '🔍 未识别', RESOLVED: '✅ 已定位', RESOLVED_ASSET_PENDING: '🕓 已定位（左侧资产待补）'
  }[decorated.status] ?? decorated.status;
  const parts = [];
  parts.push(`<p class="headline">${statusText}</p>`);
  if (decorated.reason) parts.push(`<p class="reason">${escapeHtml(decorated.reason)}</p>`);
  if (decorated.side !== 'UNSPECIFIED') parts.push(`<p>侧别：${decorated.side === 'LEFT' ? '左' : '右'}${decorated.goal !== 'UNSPECIFIED' ? ` · 目标：${decorated.goal}` : ''}</p>`);
  if (decorated.status === 'ASK_DISAMBIGUATION') parts.push(`<p class="disambig">你是指：</p><ul>${decorated.choices.map(c => `<li><button data-pick="${c.id}">${c.id}（${c.kind}）</button></li>`).join('')}</ul>`);
  if (decorated.target) {
    parts.push(`<p>解剖坐标：<strong>${decorated.target}</strong> · ${decorated.kind}</p>`);
    if (decorated.asset_refs.length) {
      parts.push(`<p>BP 表示引用：</p><ul>${decorated.asset_refs.map(a => `<li>${a.bp_representation_id}${a.mesh_element_id ? ` → ${a.mesh_element_id}` : ' → <em>网格待补</em>'}${a.obj_path ? ` · ${escapeHtml(a.obj_path)}` : ''}</li>`).join('')}</ul>`);
      if (!decorated.crosswalk_available) parts.push(`<p class="note">尚未加载真实网格映射，故不显示网格编号（不伪造数据）。可在 <code>portal/movement/data/crosswalk.json</code> 提供后刷新。</p>`);
    } else if (decorated.status === 'RESOLVED_ASSET_PENDING') parts.push(`<p class="note">该术语已识别，但当前仅映射右侧资产，左侧不借用右侧网格。</p>`);
    parts.push(`<p><a class="viewer-link" href="../anatomy/index.html?q=${encodeURIComponent(decorated.target)}" target="_blank" rel="noreferrer">在解剖视图中探索 →</a></p>`);
  }
  el.out.innerHTML = parts.join('');
  el.out.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', () => { el.input.value = btn.dataset.pick; run(); }));
  if (localStorage.getItem(CONSENT_KEY) === 'granted' && (decorated.target || decorated.status === 'SAFETY_OR_SYMPTOM' || decorated.status === 'ASK_DISAMBIGUATION')) {
    const entries = readLog(); entries.unshift({ at: Date.now(), raw: el.input.value, status: decorated.status, target: decorated.target }); writeLog(entries.slice(0, 200)); renderLog();
  }
  el.status.textContent = `共 ${COORD.canonical_targets.length} 个解剖坐标 · 日志 ${readLog().length} 条`;
};
const run = () => { const raw = el.input.value.trim(); if (!raw) return; render(resolveMovementInput(raw)); };
el.resolve.addEventListener('click', run);
el.input.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
el.consent.addEventListener('change', () => { localStorage.setItem(CONSENT_KEY, el.consent.checked ? 'granted' : 'revoked'); if (!el.consent.checked) { localStorage.removeItem(LOG_KEY); renderLog(); } renderLog(); });
el.clear.addEventListener('click', () => { writeLog([]); localStorage.removeItem(LOG_KEY); renderLog(); });
el.export.addEventListener('click', () => { const blob = new Blob([JSON.stringify(readLog(), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'movement-practice-log.json'; a.click(); });
el.import.addEventListener('change', async () => { const f = el.import.files[0]; if (!f) return; try { const data = JSON.parse(await f.text()); if (Array.isArray(data)) { writeLog(data); renderLog(); } } catch { /* ignore malformed */ } });
(async () => { el.consent.checked = localStorage.getItem(CONSENT_KEY) === 'granted'; await loadCrosswalk(); renderLog(); el.status.textContent = `共 ${COORD.canonical_targets.length} 个解剖坐标 · 日志 ${readLog().length} 条`; })();
