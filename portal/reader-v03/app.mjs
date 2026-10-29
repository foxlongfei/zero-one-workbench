// 陪你读书 V0.3 application wiring.
//
// Sections: settings, shelf, reading (foliate-js EPUB + TXT), continuous
// listening (Narration + pluggable speech engines), notes, household voices,
// 听世界. DOM-first, no framework: every screen is a section in index.html and
// all persistence goes through lib/store.mjs (IndexedDB, local only).

import { makeBook } from '../vendor/foliate-js/view.js';
import { splitChapters, percent, formatMilliseconds, normalizeText } from './lib/text.mjs';
import { Narration, State } from './lib/narration.mjs';
import { bookFromTxt, chapterIndexForSection, isBookFinished, mapEpubSections, narratableChapters, pickText, paragraphsFromHtml, totalParagraphs } from './lib/book.mjs';
import { BrowserEngine, LibraryVoiceEngine, ToneEngine, isAbort } from './lib/engines.mjs';
import { DEMO_VOICE_URL, PIPER_PACKS, PiperEngine, PiperRuntime, primePiperAudio } from './lib/piper.mjs?v=20261029-5';
import { KOKORO, KOKORO_VOICES, KokoroEngine, KokoroRuntime, kokoroVoiceById, primeKokoroAudio } from './lib/kokoro.mjs?v=20261029-5';
import { ZIPVOICE, ZipVoiceEngine, ZipVoiceRuntime, primeZipVoiceAudio } from './lib/zipvoice.mjs?v=20261029-4';
import { fetchLibraryBook, searchStandardEbooks } from './lib/library.mjs';
import * as store from './lib/store.mjs';
import { BUILTIN_SOURCES, resolveDaypart, resolvePlaylist } from './lib/listening-world.mjs';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const status = (message, tone = '') => {
  const el = $('status');
  el.textContent = message;
  el.dataset.tone = tone;
};
const now = () => new Date().toISOString();

// --------------------------------------------------------------------------
// Settings (localStorage holds small preferences; books/notes live in IndexedDB)
// --------------------------------------------------------------------------
const SETTINGS_KEY = 'rw03-settings';
const DEFAULT_SETTINGS = {
  engine: 'browser',
  browserVoiceURI: '',
  rate: 1,
  library: { baseUrl: params.get('voiceLibrary') || '', token: '', voiceId: '' },
  piper: { pack: 'zs', voiceId: 'demo' },
  kokoro: { voiceId: 'zf_001' },
  zipvoice: { voiceId: '' },
  music: { volume: 0.18, ducking: true },
  statistics: { days: {}, listenedMs: 0 },
  worldFavourites: [],
};
const mergeSettings = patch => ({
  ...settings,
  ...patch,
  library: { ...settings.library, ...patch.library },
  piper: { ...settings.piper, ...patch.piper },
  kokoro: { ...settings.kokoro, ...patch.kokoro },
  zipvoice: { ...settings.zipvoice, ...patch.zipvoice },
  music: { ...settings.music, ...patch.music },
  statistics: { ...settings.statistics, ...patch.statistics },
});

let settings = DEFAULT_SETTINGS;
try {
  settings = mergeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
} catch { /* corrupted preferences fall back to defaults */ }
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

// --------------------------------------------------------------------------
// Open-source neural voice (Piper Plus) and local voice training
// --------------------------------------------------------------------------
const PIPER_VOICES_KEY = 'piper-voices';

const piperVoiceById = id => piperVoices.find(voice => voice.id === id) || null;
const piperVoiceLabel = voice => (voice.speaker ? `${voice.name} · ${voice.speaker}` : voice.name);

function piperVoiceOptions() {
  return [
    { id: 'demo', name: `示范声音${piperDemo ? '（模型示例）' : '（需加载模型）'}` },
    ...piperVoices,
  ];
}

function updateReaderPiperVoiceVisibility() {
  const field = $('fieldReaderPiperVoice');
  if (!field) return;
  field.hidden = settings.engine !== 'piper' || !piperPack().requiresEmbedding;
}

const kokoroVoiceName = id => kokoroVoiceById(id).name;

function updateReaderKokoroVoiceVisibility() {
  const field = $('fieldReaderKokoroVoice');
  if (field) field.hidden = settings.engine !== 'kokoro';
}

function renderKokoroVoiceSelect() {
  for (const id of ['kokoroVoiceSelect', 'readerKokoroVoiceSelect']) {
    const select = $(id);
    if (!select) continue;
    select.replaceChildren(...KOKORO_VOICES.map(voice => new Option(
      `${voice.name} · ${voice.gender}`,
      voice.id,
      false,
      voice.id === settings.kokoro.voiceId,
    )));
  }
  updateReaderKokoroVoiceVisibility();
}

const ZIPVOICE_VOICES_KEY = 'zipvoice-voices';
const zipVoiceById = id => zipVoices.find(voice => voice.id === id) || null;
const zipVoiceLabel = voice => voice ? voice.name : '高音质声音';

function updateReaderZipVoiceVisibility() {
  const field = $('fieldReaderZipVoice');
  if (field) field.hidden = settings.engine !== 'zipvoice';
}

function renderZipVoiceSelect() {
  const options = zipVoices.length
    ? zipVoices.map(voice => new Option(zipVoiceLabel(voice), voice.id, false, voice.id === settings.zipvoice.voiceId))
    : [new Option('还没有保存高音质声音', '', true, true)];
  for (const id of ['zipvoiceVoiceSelect', 'readerZipVoiceSelect']) {
    const select = $(id);
    if (select) select.replaceChildren(...options.map(option => option.cloneNode(true)));
  }
  $('zipvoiceDeleteVoice').hidden = !zipVoiceById(settings.zipvoice.voiceId);
  updateReaderZipVoiceVisibility();
}

function renderZipVoiceList() {
  const list = $('zipvoiceVoiceList');
  if (!list) return;
  list.replaceChildren();
  if (!zipVoices.length) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = '还没有保存高音质声音。先录制或选择一段 3–10 秒参考声音，并填写逐字稿。';
    list.append(hint);
    return;
  }
  for (const voice of zipVoices) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '.7rem';
    const title = document.createElement('strong');
    title.textContent = voice.name;
    const meta = document.createElement('p');
    meta.className = 'hint';
    meta.textContent = `逐字稿：${voice.transcript}`;
    const use = document.createElement('button');
    use.type = 'button';
    use.textContent = voice.id === activeZipVoiceId ? '正在使用' : '使用';
    use.disabled = voice.id === activeZipVoiceId;
    use.onclick = () => {
      setActiveZipVoice(voice.id);
      switchEngine('zipvoice');
    };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '删除';
    remove.onclick = async () => {
      if (!confirm(`删除高音质声音「${voice.name}」及其本机参考录音？`)) return;
      zipVoices = zipVoices.filter(item => item.id !== voice.id);
      await saveZipVoices();
      if (activeZipVoiceId === voice.id) setActiveZipVoice(zipVoices[0]?.id || '');
      else { renderZipVoiceSelect(); renderZipVoiceList(); }
      status('已删除高音质声音及其参考录音');
    };
    card.append(title, meta, use, remove);
    list.append(card);
  }
}

function setActiveZipVoice(id, { persist = true } = {}) {
  const voice = zipVoiceById(id);
  activeZipVoiceId = voice ? voice.id : '';
  settings.zipvoice.voiceId = activeZipVoiceId;
  if (persist) saveSettings();
  renderZipVoiceSelect();
  renderZipVoiceList();
}

const saveZipVoices = () => store.putRecord(ZIPVOICE_VOICES_KEY, zipVoices);

async function loadZipVoices() {
  const saved = await store.getRecord(ZIPVOICE_VOICES_KEY, []);
  zipVoices = Array.isArray(saved) ? saved : [];
  const wanted = settings.zipvoice.voiceId;
  setActiveZipVoice(wanted, { persist: false });
  if (wanted && wanted !== activeZipVoiceId) saveSettings();
}

function renderPiperVoiceSelect() {
  const options = piperVoiceOptions();
  for (const id of ['piperVoiceSelect', 'readerPiperVoiceSelect']) {
    const select = $(id);
    if (!select) continue;
    select.replaceChildren(...options.map(voice => new Option(
      piperVoiceLabel(voice),
      voice.id,
      false,
      voice.id === activePiperVoiceId,
    )));
  }
  $('piperDeleteVoice').hidden = activePiperVoiceId === 'demo';
  updateReaderPiperVoiceVisibility();
}

function refreshPiperPackUI() {
  const definition = piperPack();
  const select = $('piperPackSelect');
  if (select) select.value = definition.id;
  const voiceField = $('fieldPiperVoice');
  if (voiceField) voiceField.hidden = !definition.requiresEmbedding;
  const hint = $('piperPackHint');
  if (hint) hint.textContent = definition.requiresEmbedding
    ? 'zs-v1 可用示范声音或你训练的声音；训练会把参考音频转成只在本机保存的声音特征。'
    : 'Mera 是固定单声线离线包，不需要参考声音，也不能训练；切换回 zs-v1 才能训练家人声音。';
  updateReaderPiperVoiceVisibility();
}

function renderPiperVoiceList() {
  const list = $('piperVoiceList');
  if (!list) return;
  list.replaceChildren();
  for (const voice of piperVoices) {
    const card = document.createElement('div');
    card.className = 'voice-card';
    card.dataset.piperVoiceId = voice.id;
    const title = document.createElement('h3');
    title.textContent = voice.name || '训练声音';
    const meta = document.createElement('div');
    meta.className = 'muted';
    meta.textContent = [voice.speaker, voice.relation, voice.createdAt ? new Date(voice.createdAt).toLocaleString('zh-CN') : ''].filter(Boolean).join(' · ');
    const actions = document.createElement('div');
    actions.className = 'row';
    const use = document.createElement('button');
    use.type = 'button';
    use.className = 'primary';
    use.textContent = voice.id === activePiperVoiceId ? '正在使用' : '用这个声音朗读';
    use.onclick = () => {
      settings.piper.pack = 'zs';
      saveSettings();
      refreshPiperPackUI();
      setActivePiperVoice(voice.id);
      switchEngine('piper');
      status(`已切换到「${voice.name}」`);
    };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ghost';
    remove.textContent = '删除';
    remove.onclick = async () => {
      if (!confirm(`删除本机训练声音「${voice.name}」？只删除声音特征，不影响书和进度。`)) return;
      piperVoices = piperVoices.filter(item => item.id !== voice.id);
      await savePiperVoices();
      if (activePiperVoiceId === voice.id) setActivePiperVoice('demo');
      else { renderPiperVoiceSelect(); renderPiperVoiceList(); }
      status('已删除本机训练声音');
    };
    actions.append(use, remove);
    card.append(title, meta, actions);
    list.append(card);
  }
  if (!piperVoices.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = '还没有本机训练声音。录制或选择一个参考声音，训练完成后会出现在这里。';
    list.append(empty);
  }
}

function setActivePiperVoice(id, { persist = true } = {}) {
  const demo = id === 'demo';
  const profile = piperVoiceById(id);
  activePiperVoiceId = demo ? 'demo' : (profile?.id || 'demo');
  const source = demo ? piperDemo?.embedding : profile?.embedding;
  activePiperEmbedding = source?.length ? new Float32Array(source) : null;
  if (persist) {
    settings.piper.voiceId = activePiperVoiceId;
    saveSettings();
  }
  renderPiperVoiceSelect();
  renderPiperVoiceList();
  refreshPiperPackUI();
  refreshVoiceScreens?.();
  refreshEngineBadge?.();
  renderReadiness();
}

const savePiperVoices = () => store.putRecord(PIPER_VOICES_KEY, piperVoices);

async function loadPiperDemoVoice() {
  try {
    const response = await fetch(DEMO_VOICE_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    piperDemo = await response.json();
    if (activePiperVoiceId === 'demo') {
      activePiperEmbedding = new Float32Array(piperDemo.embedding);
    }
    renderPiperVoiceSelect();
  } catch (error) {
    console.warn('示范神经声音加载失败', error);
    status('示范神经声音加载失败；仍可使用浏览器语音，或训练自己的声音。', 'warn');
  }
}

async function loadPiperVoices() {
  const saved = await store.getRecord(PIPER_VOICES_KEY, []);
  piperVoices = Array.isArray(saved) ? saved : [];
  const wanted = settings.piper.voiceId || 'demo';
  setActivePiperVoice(wanted !== 'demo' && piperVoiceById(wanted) ? wanted : 'demo', { persist: false });
}

function updatePiperProgress(progress = {}, packId = settings.piper.pack) {
  const wrap = $('piperProgressWrap');
  const bar = $('piperProgressBar');
  if (!wrap || !bar) return;
  const value = Math.max(0, Math.min(1, Number(progress.progress) || 0));
  const definition = PIPER_PACKS[packId] || piperPack();
  if (progress.stage === 'model' && value === 0) status(`正在加载 ${definition.name}（${definition.sizeHint}，之后缓存）…`);
  wrap.hidden = false;
  bar.style.width = `${Math.round(value * 100)}%`;
  $('piperStatus').textContent = progress.stage === 'ready'
    ? `${definition.name} 已就绪（本机）`
    : `${definition.name}：${progress.message || progress.stage || '加载中'} ${Math.round(value * 100)}%`;
  if (progress.stage === 'ready') {
    status('开源神经语音已就绪。');
    setTimeout(() => { wrap.hidden = true; }, 800);
    refreshVoiceScreens?.();
    refreshEngineBadge?.();
    renderReadiness();
  }
}

async function loadPiperModel(pack = settings.piper.pack) {
  const definition = PIPER_PACKS[pack] || PIPER_PACKS.zs;
  const button = $('piperLoad');
  button.disabled = true;
  $('piperStatus').textContent = `正在加载 ${definition.name}…`;
  try {
    await ensurePiperRuntime(definition.id).load();
    $('piperStatus').textContent = `${definition.name} 已就绪（本机）`;
    switchEngine('piper');
    status(`${definition.name} 已加载；模型由浏览器缓存，下次减少下载。`);
  } catch (error) {
    $('piperStatus').textContent = `加载失败：${error.message}`;
    if (settings.engine === 'piper') {
      settings.engine = 'browser';
      saveSettings();
      updateEngineControls();
      refreshEngineBadge();
    }
    status(`神经语音加载失败：${error.message}。已切回浏览器语音。`, 'error');
  } finally {
    button.disabled = false;
  }
}

async function previewPiper() {
  const result = $('piperTestResult');
  const definition = piperPack();
  if (definition.requiresEmbedding && !activePiperEmbedding) {
    result.textContent = '请先加载模型或训练声音。';
    return;
  }
  result.textContent = '正在本机合成…';
  try {
    const engine = buildEngine('piper');
    await engine.speak('你好，我在这里陪着你读书。今天想听哪一段？');
    result.textContent = `试听完成（${definition.name}，本机）`;
  } catch (error) {
    result.textContent = `试听失败：${error.message}`;
  }
}

function updateKokoroProgress(progress = {}) {
  const wrap = $('kokoroProgressWrap');
  const bar = $('kokoroProgressBar');
  if (!wrap || !bar) return;
  if (progress.stage === 'ready') {
    wrap.hidden = false;
    bar.style.width = '100%';
    $('kokoroStatus').textContent = `${KOKORO.name} 已就绪（本机）`;
    setTimeout(() => { wrap.hidden = true; }, 800);
    refreshVoiceScreens?.();
    refreshEngineBadge?.();
    renderReadiness();
    return;
  }
  const value = Math.max(0, Math.min(1, Number(progress.progress) || 0));
  wrap.hidden = false;
  bar.style.width = `${Math.round(value * 100)}%`;
  $('kokoroStatus').textContent = `Kokoro：${progress.message || '加载中'} ${Math.round(value * 100)}%`;
}

async function loadKokoroModel() {
  const button = $('kokoroLoad');
  if (button) button.disabled = true;
  $('kokoroStatus').textContent = `正在加载 ${KOKORO.name}…`;
  try {
    await ensureKokoroRuntime().load();
    $('kokoroStatus').textContent = `${KOKORO.name} 已就绪（本机）`;
    switchEngine('kokoro');
    status(`${KOKORO.name} 已加载；模型由浏览器缓存，下次减少下载。`);
  } catch (error) {
    $('kokoroStatus').textContent = `加载失败：${error.message}`;
    if (settings.engine === 'kokoro') {
      settings.engine = 'browser';
      saveSettings();
      updateEngineControls();
      refreshEngineBadge();
    }
    status(`Kokoro 加载失败：${error.message}。已切回浏览器语音。`, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

async function previewKokoro() {
  const result = $('kokoroTestResult');
  result.textContent = '正在本机合成…';
  try {
    const engine = buildEngine('kokoro');
    await engine.speak('你好，我在这里陪着你读书。今天想听哪一段？');
    result.textContent = `试听完成（${KOKORO.name} · ${kokoroVoiceName(settings.kokoro.voiceId)}，本机）`;
  } catch (error) {
    result.textContent = `试听失败：${error.message}`;
  }
}

function updateZipVoiceProgress(progress = {}) {
  const wrap = $('zipvoiceProgressWrap');
  const bar = $('zipvoiceProgressBar');
  if (!wrap || !bar) return;
  if (progress.stage === 'ready') {
    wrap.hidden = false;
    bar.style.width = '100%';
    $('zipvoiceStatus').textContent = `${ZIPVOICE.name} 已就绪（本机）`;
    setTimeout(() => { wrap.hidden = true; }, 800);
    refreshVoiceScreens?.();
    refreshEngineBadge?.();
    return;
  }
  const message = String(progress.message || '');
  if (!message) return;
  const download = message.match(/Downloading data\.\.\. \((\d+)\/(\d+)\)/);
  if (download) {
    const value = Number(download[2]) ? Number(download[1]) / Number(download[2]) : 0;
    wrap.hidden = false;
    bar.style.width = `${Math.round(value * 100)}%`;
    $('zipvoiceStatus').textContent = `ZipVoice：下载模型 ${Math.round(value * 100)}%`;
    return;
  }
  wrap.hidden = false;
  $('zipvoiceStatus').textContent = `ZipVoice：${message === 'Running...' ? '正在初始化模型…' : message}`;
}

async function loadZipVoiceModel() {
  const button = $('zipvoiceLoad');
  if (button) button.disabled = true;
  $('zipvoiceStatus').textContent = `正在加载 ${ZIPVOICE.name}…`;
  try {
    await ensureZipVoiceRuntime().load();
    $('zipvoiceStatus').textContent = `${ZIPVOICE.name} 已就绪（本机）`;
    switchEngine('zipvoice');
    status(`${ZIPVOICE.name} 已加载；模型由浏览器缓存，生成较慢但都在本机。`);
    return true;
  } catch (error) {
    $('zipvoiceStatus').textContent = `加载失败：${error.message}`;
    if (settings.engine === 'zipvoice') {
      settings.engine = 'browser';
      saveSettings();
      updateEngineControls();
      refreshEngineBadge();
    }
    status(`ZipVoice 加载失败：${error.message}。已切回浏览器语音。`, 'error');
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

async function previewZipVoice() {
  const result = $('zipvoiceTrainStatus');
  const voice = zipVoiceById(settings.zipvoice.voiceId);
  if (!voice) { result.textContent = '请先保存一段高音质声音。'; return; }
  result.textContent = '正在本机生成高音质试听（可能要几十秒）…';
  try {
    const engine = buildEngine('zipvoice');
    await engine.speak('你好，我在这里陪着你读书。今天想听哪一段？');
    result.textContent = `试听完成（${voice.name}，ZipVoice 本机）`;
  } catch (error) {
    result.textContent = `试听失败：${error.message}`;
  }
}

function updateZipVoiceTrainState() {
  const ready = Boolean(
    $('zipvoiceConsent')?.checked
    && $('zipvoiceSpeaker')?.value.trim()
    && $('zipvoiceTranscript')?.value.trim()
    && zipvoiceReferenceBlob,
  );
  $('zipvoiceTrain').disabled = !ready;
}

function setZipVoiceReference(blob, sourceLabel = '参考声音') {
  zipvoiceReferenceBlob = blob;
  const preview = $('zipvoiceRefPreview');
  if (preview.dataset.url) URL.revokeObjectURL(preview.dataset.url);
  preview.dataset.url = URL.createObjectURL(blob);
  preview.src = preview.dataset.url;
  preview.hidden = false;
  $('zipvoiceRecordStatus').textContent = `${sourceLabel}已就绪；请把录音里说的话原样填到逐字稿。`;
  updateZipVoiceTrainState();
}

async function toggleZipVoiceRecording() {
  if (zipvoiceRecorder && zipvoiceRecorder.state === 'recording') { zipvoiceRecorder.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    $('zipvoiceRecordStatus').textContent = '当前浏览器不支持录音，请改为选择音频文件。';
    return;
  }
  try {
    if (!window.isSecureContext) throw new Error('录音需要 HTTPS 或 localhost');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const chunks = [];
    zipvoiceRecorder = new MediaRecorder(stream);
    zipvoiceRecorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    zipvoiceRecorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      clearTimeout(zipvoiceRecordTimer);
      zipvoiceRecordTimer = null;
      const blob = new Blob(chunks, { type: zipvoiceRecorder?.mimeType || 'audio/webm' });
      zipvoiceRecorder = null;
      setZipVoiceReference(blob, '录制的参考声音');
      $('zipvoiceRecord').textContent = '重新录制 8 秒参考声音';
    };
    zipvoiceRecorder.start();
    $('zipvoiceRecord').textContent = '停止录制';
    $('zipvoiceRecordStatus').textContent = '录音中……请用自然语速读一小段话，8 秒后自动停止。';
    zipvoiceRecordTimer = setTimeout(() => {
      if (zipvoiceRecorder?.state === 'recording') zipvoiceRecorder.stop();
    }, 8000);
  } catch (error) {
    $('zipvoiceRecordStatus').textContent = `无法录音：${error.message}`;
  }
}

async function trainZipVoice() {
  const speaker = $('zipvoiceSpeaker').value.trim();
  const transcript = $('zipvoiceTranscript').value.trim();
  if (!$('zipvoiceConsent').checked) { $('zipvoiceTrainStatus').textContent = '请先勾选授权声明。'; return; }
  if (!speaker) { $('zipvoiceTrainStatus').textContent = '请填写声音本人称呼。'; return; }
  if (!zipvoiceReferenceBlob) { $('zipvoiceTrainStatus').textContent = '请先录制或选择参考声音。'; return; }
  if (!transcript) { $('zipvoiceTrainStatus').textContent = '请填写参考声音的逐字稿。'; return; }
  $('zipvoiceTrain').disabled = true;
  $('zipvoiceTrainStatus').textContent = '正在保存参考声音…';
  try {
    const profile = {
      id: `zv_${crypto.randomUUID().slice(0, 8)}`,
      name: `${speaker}的高音质声音`,
      speaker,
      relation: $('zipvoiceRelation').value.trim(),
      audio: zipvoiceReferenceBlob,
      transcript,
      createdAt: now(),
      consent: {
        granted: true,
        grantedBy: speaker,
        statement: '本人授权在本机使用这段声音样本进行语音合成与试听。',
        grantedAt: now(),
      },
    };
    zipVoices = [profile, ...zipVoices.filter(item => item.name !== profile.name)];
    await saveZipVoices();
    setActiveZipVoice(profile.id);
    settings.engine = 'zipvoice';
    saveSettings();
    updateEngineControls();
    refreshEngineBadge();
    $('zipvoiceTrainStatus').textContent = '已保存参考声音；首次使用会下载约 200 MB 模型。';
    const loaded = await loadZipVoiceModel();
    if (loaded) await previewZipVoice();
    zipvoiceReferenceBlob = null;
    $('zipvoiceRefPreview').hidden = true;
    $('zipvoiceConsent').checked = false;
    $('zipvoiceRecord').textContent = '录制 8 秒参考声音';
    updateZipVoiceTrainState();
  } catch (error) {
    $('zipvoiceTrainStatus').textContent = `保存失败：${error.message}`;
    updateZipVoiceTrainState();
  }
}

async function deleteActiveZipVoice() {
  const voice = zipVoiceById(settings.zipvoice.voiceId);
  if (!voice) return;
  if (!confirm(`删除高音质声音「${voice.name}」及其本机参考录音？`)) return;
  zipVoices = zipVoices.filter(item => item.id !== voice.id);
  await saveZipVoices();
  setActiveZipVoice(zipVoices[0]?.id || '');
  status('已删除高音质声音及其参考录音');
}

function updatePiperTrainState() {
  const ready = Boolean(
    $('piperConsent')?.checked
    && $('piperSpeaker')?.value.trim()
    && piperReferenceBlob,
  );
  $('piperTrain').disabled = !ready;
}

function setPiperReference(blob, sourceLabel = '参考声音') {
  piperReferenceBlob = blob;
  const preview = $('piperRefPreview');
  if (preview.dataset.url) URL.revokeObjectURL(preview.dataset.url);
  preview.dataset.url = URL.createObjectURL(blob);
  preview.src = preview.dataset.url;
  preview.hidden = false;
  $('piperRecordStatus').textContent = `${sourceLabel}已就绪；请确认是声音本人授权。`;
  updatePiperTrainState();
}

async function togglePiperRecording() {
  if (piperRecorder && piperRecorder.state === 'recording') { piperRecorder.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    $('piperRecordStatus').textContent = '当前浏览器不支持录音，请改为选择音频文件。';
    return;
  }
  try {
    if (!window.isSecureContext) throw new Error('录音需要 HTTPS 或 localhost');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const chunks = [];
    piperRecorder = new MediaRecorder(stream);
    piperRecorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    piperRecorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      clearTimeout(piperRecordTimer);
      piperRecordTimer = null;
      const blob = new Blob(chunks, { type: piperRecorder?.mimeType || 'audio/webm' });
      piperRecorder = null;
      setPiperReference(blob, '录制的参考声音');
      $('piperRecord').textContent = '重新录制 8 秒参考声音';
    };
    piperRecorder.start();
    $('piperRecord').textContent = '停止录制';
    $('piperRecordStatus').textContent = '录音中……请用自然语速读一小段话，8 秒后自动停止。';
    piperRecordTimer = setTimeout(() => {
      if (piperRecorder?.state === 'recording') piperRecorder.stop();
    }, 8000);
  } catch (error) {
    $('piperRecordStatus').textContent = `无法录音：${error.message}`;
  }
}

async function trainPiperVoice() {
  const speaker = $('piperSpeaker').value.trim();
  if (!$('piperConsent').checked) { $('piperTrainStatus').textContent = '请先勾选授权声明。'; return; }
  if (!speaker) { $('piperTrainStatus').textContent = '请填写声音本人称呼。'; return; }
  if (!piperReferenceBlob) { $('piperTrainStatus').textContent = '请先录制或选择参考声音。'; return; }
  $('piperTrain').disabled = true;
  $('piperTrainStatus').textContent = '正在加载声音编码器并提取特征（首次约 28 MB，之后缓存）…';
  try {
    settings.piper.pack = 'zs';
    refreshPiperPackUI();
    const runtime = ensurePiperRuntime('zs');
    const embedding = await runtime.encodeReference(piperReferenceBlob);
    const profile = {
      id: `pv_${crypto.randomUUID().slice(0, 8)}`,
      name: `${speaker}的声音`,
      speaker,
      relation: $('piperRelation').value.trim(),
      embedding: Array.from(embedding),
      createdAt: now(),
      consent: {
        granted: true,
        grantedBy: speaker,
        statement: '本人授权在本机使用这段声音样本进行语音合成与试听。',
        grantedAt: now(),
      },
    };
    piperVoices = [profile, ...piperVoices.filter(item => item.name !== profile.name)];
    await savePiperVoices();
    setActivePiperVoice(profile.id);
    switchEngine('piper');
    $('piperTrainStatus').textContent = '训练完成，已切换到该声音；正在生成试听…';
    await runtime.speak('你好，我在这里陪着你读书。', { embedding });
    $('piperTrainStatus').textContent = '训练完成，已切换到该声音。参考音频只在本机处理，可随时删除。';
    piperReferenceBlob = null;
    $('piperRefPreview').hidden = true;
    $('piperConsent').checked = false;
    $('piperRecord').textContent = '录制 8 秒参考声音';
    renderPiperVoiceList();
  } catch (error) {
    $('piperTrainStatus').textContent = `训练失败：${error.message}`;
  } finally {
    updatePiperTrainState();
  }
}

async function deleteActivePiperVoice() {
  if (activePiperVoiceId === 'demo') return;
  const voice = piperVoiceById(activePiperVoiceId);
  if (!voice) return;
  if (!confirm(`删除本机训练声音「${voice.name}」？`)) return;
  piperVoices = piperVoices.filter(item => item.id !== voice.id);
  await savePiperVoices();
  setActivePiperVoice('demo');
  status('已删除本机训练声音');
}

// --------------------------------------------------------------------------
// Speech engines
// --------------------------------------------------------------------------
let narration = null;
let currentEngine = null;
let activeVoice = null;
const piperRuntimes = new Map();
let piperVoices = [];
let piperDemo = null;
let activePiperVoiceId = 'demo';
let activePiperEmbedding = null;
let piperReferenceBlob = null;
let piperRecorder = null;
let piperRecordTimer = null;
let kokoroRuntime = null;
let zipvoiceRuntime = null;
let zipVoices = [];
let activeZipVoiceId = '';
let zipvoiceReferenceBlob = null;
let zipvoiceRecorder = null;
let zipvoiceRecordTimer = null;

const ensureKokoroRuntime = () => {
  if (!kokoroRuntime) kokoroRuntime = new KokoroRuntime({ onProgress: updateKokoroProgress });
  return kokoroRuntime;
};

const ensureZipVoiceRuntime = () => {
  if (!zipvoiceRuntime) zipvoiceRuntime = new ZipVoiceRuntime({ onProgress: updateZipVoiceProgress });
  return zipvoiceRuntime;
};

const piperPack = () => PIPER_PACKS[settings.piper.pack] || PIPER_PACKS.zs;
const currentPiperRuntime = () => piperRuntimes.get(settings.piper.pack) || null;
const ensurePiperRuntime = (pack = settings.piper.pack) => {
  const definition = PIPER_PACKS[pack] || PIPER_PACKS.zs;
  if (!piperRuntimes.has(definition.id)) {
    piperRuntimes.set(definition.id, new PiperRuntime({
      modelUrl: definition.modelUrl,
      encoderUrl: definition.encoderUrl,
      requiresEmbedding: definition.requiresEmbedding,
      onProgress: progress => updatePiperProgress(progress, definition.id),
    }));
  }
  return piperRuntimes.get(definition.id);
};

const buildEngine = (kind = settings.engine) => {
  if (kind === 'kokoro') {
    return new KokoroEngine({
      runtime: ensureKokoroRuntime(),
      voice: settings.kokoro.voiceId,
      speed: settings.rate,
    });
  }
  if (kind === 'zipvoice') {
    const profile = zipVoiceById(settings.zipvoice.voiceId);
    if (!profile) return null;
    return new ZipVoiceEngine({ runtime: ensureZipVoiceRuntime(), profile, speed: settings.rate });
  }
  if (kind === 'piper') {
    const definition = piperPack();
    return new PiperEngine({
      runtime: ensurePiperRuntime(definition.id),
      getEmbedding: definition.requiresEmbedding ? () => activePiperEmbedding : null,
      speed: settings.rate,
    });
  }
  if (kind === 'library' && activeVoice) {
    return new LibraryVoiceEngine({
      voiceId: activeVoice.id, name: activeVoice.name, speed: settings.rate,
      baseUrl: settings.library.baseUrl, licenseToken: settings.library.token,
    });
  }
  if (params.get('ttsTone') === '1') {
    // Test-only voice, opted in per URL: it exists so the listening loop can be
    // verified in a real browser without a network or model download.
    return new ToneEngine({ speed: settings.rate });
  }
  return new BrowserEngine({ voiceURI: settings.browserVoiceURI, rate: settings.rate });
};

const engineHint = engine => {
  if (!engine) return '还没有可用的朗读引擎。';
  if (engine.kind === 'browser') return '本机浏览器语音：不联网、不上传文本；音质取决于设备。';
  if (engine.kind === 'kokoro') {
    return `${KOKORO.name} · ${kokoroVoiceName(settings.kokoro.voiceId)}：模型和文本都在本机；首次使用需下载${KOKORO.sizeHint}。`;
  }
  if (engine.kind === 'zipvoice') {
    return `${ZIPVOICE.name} · ${engine.profile?.name || '未选择声音'}：模型、参考录音和文本都在本机；首次使用需下载${ZIPVOICE.sizeHint}，生成较慢。`;
  }
  if (engine.kind === 'piper') {
    const voice = activePiperVoiceId === 'demo' ? '示范声音' : (piperVoiceById(activePiperVoiceId)?.name || '训练声音');
    return `${piperPack().name} · ${voice}：模型和文本都在本机；首次使用需下载${piperPack().sizeHint}。`;
  }
  if (engine.kind === 'library') return `家庭授权声音「${engine.name}」：文本只发送到你的声音库。`;
  return '离线测试音：仅用于自动化测试。';
};

// --------------------------------------------------------------------------
// Shelf
// --------------------------------------------------------------------------
let books = [];
let coverUrls = new Set();
let activeBook = null;
let voices = [];
let libraryResults = [];
let libraryLoading = false;
let librarySearchTimer = null;
let libraryPendingQuery = null;
let librarySelection = new Set();

const progressKey = id => `rw03-progress-${id}`;
const bookProgress = id => {
  try { return JSON.parse(localStorage.getItem(progressKey(id)) || 'null'); } catch { return null; }
};
const saveProgress = (id, position) => {
  localStorage.setItem(progressKey(id), JSON.stringify({ ...position, updatedAt: now() }));
  if (localStorage.getItem('rw03-last-book') === id) renderResume();
};

const formatOf = book => String(book.format || book.filename?.split('.').pop() || '').toUpperCase();
const titleOf = book => book.title || book.filename || '未命名';
const isImageComic = book => formatOf(book) === 'CBZ';
const paragraphPosition = (chapter, index = 0) => (chapter?.paragraphs?.length ? `第 ${index + 1}/${chapter.paragraphs.length} 段` : '图像页');

function progressLabel(book) {
  const saved = bookProgress(book.id);
  if (!saved) return '尚未开始';
  if (saved.finished) return '已读完 · 可再听一遍';
  const chapter = saved.chapterTitle || `第 ${Number(saved.chapter || 0) + 1} 章`;
  return `${saved.listening ? '听到' : '读到'} ${chapter} · ${percent(saved.fraction ?? 0)}`;
}

function updateReadProgress(fraction) {
  const bar = $('readProgress');
  if (bar) bar.style.width = `${Math.round(Math.min(1, Math.max(0, Number(fraction) || 0)) * 100)}%`;
}

function bookFraction(chapterIndex, paragraphIndex) {
  if (!bookModel?.chapters.length) return 0;
  const chapter = bookModel.chapters[chapterIndex];
  return (chapterIndex + paragraphIndex / Math.max(1, chapter?.paragraphs?.length ?? 1)) / bookModel.chapters.length;
}

async function refreshShelf() {
  books = (await store.listBooks()).sort((a, b) => {
    const pa = bookProgress(a.id)?.updatedAt;
    const pb = bookProgress(b.id)?.updatedAt;
    if (pa || pb) return String(pb || '').localeCompare(String(pa || ''));
    return String(b.added || '').localeCompare(String(a.added || ''));
  });
  renderShelf();
  renderResume();
}

function renderShelf() {
  const query = $('shelfSearch').value.trim().toLowerCase();
  const visible = query
    ? books.filter(book => `${titleOf(book)} ${book.author || ''} ${book.filename || ''}`.toLowerCase().includes(query))
    : books;
  coverUrls.forEach(url => URL.revokeObjectURL(url));
  coverUrls = new Set();
  $('shelfCount').textContent = books.length ? `共 ${books.length} 本${query ? `，找到 ${visible.length} 本` : ''}` : '';
  $('shelfEmpty').hidden = books.length > 0;
  const list = $('shelf');
  list.replaceChildren();
  for (const book of visible) {
    const li = document.createElement('li');
    li.className = 'book';
    li.dataset.bookId = book.id;
    li.dataset.format = formatOf(book);
    const cover = document.createElement('div');
    cover.className = 'cover';
    if (book.cover instanceof Blob && book.cover.size) {
      const url = URL.createObjectURL(book.cover);
      coverUrls.add(url);
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      cover.append(img);
    } else {
      const t = document.createElement('span'); t.className = 't'; t.textContent = titleOf(book);
      const f = document.createElement('span'); f.className = 'f'; f.textContent = formatOf(book);
      cover.append(t, f);
    }
    const progress = document.createElement('div');
    progress.className = 'progress';
    const bar = document.createElement('i');
    bar.style.width = `${Math.round((bookProgress(book.id)?.fraction ?? 0) * 100)}%`;
    progress.append(bar);
    const name = document.createElement('div'); name.className = 'name'; name.textContent = titleOf(book);
    const meta = document.createElement('div'); meta.className = 'muted';
    meta.textContent = [book.author, formatOf(book), progressLabel(book)].filter(Boolean).join(' · ');
    const actions = document.createElement('div'); actions.className = 'actions';
    const saved = bookProgress(book.id);
    const read = document.createElement('button');
    read.type = 'button'; read.dataset.action = 'read'; read.textContent = saved ? '继续读' : '阅读';
    read.onclick = () => openBook(book, { listen: false });
    const listen = document.createElement('button');
    listen.type = 'button'; listen.dataset.action = 'listen'; listen.className = 'primary';
    listen.textContent = saved?.listening ? '继续听' : '听书';
    if (isImageComic(book)) {
      listen.disabled = true;
      listen.textContent = '图像漫画';
      listen.title = 'CBZ 是图像漫画，可翻页阅读；当前版本不支持朗读图像页。';
    } else {
      listen.onclick = () => openBook(book, { listen: true });
    }
    const remove = document.createElement('button');
    remove.type = 'button'; remove.dataset.action = 'delete'; remove.className = 'ghost'; remove.textContent = '移除';
    remove.onclick = () => removeBook(book);
    actions.append(read, listen, remove);
    li.append(cover, progress, name, meta, actions);
    list.append(li);
  }
}

function renderResume() {
  const book = books.find(b => b.id === localStorage.getItem('rw03-last-book'));
  const saved = book && bookProgress(book.id);
  $('resumeCard').hidden = !(book && saved);
  if (!(book && saved)) return;
  $('resumeTitle').textContent = titleOf(book);
  $('resumeMeta').textContent = `${progressLabel(book)} · ${saved.listening ? '上次在听书' : '上次在阅读'}`;
  $('resumeRead').onclick = () => openBook(book, { listen: false });
  $('resumeListen').onclick = () => openBook(book, { listen: true });
}

async function importFiles(fileList) {
  const summary = { imported: 0, duplicates: 0, skipped: 0, failed: [] };
  for (const file of fileList) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['epub', 'txt', 'mobi', 'azw3', 'fb2', 'cbz'].includes(ext)) { summary.skipped += 1; continue; }
    try {
      if (ext === 'txt' && !(await file.text()).trim()) { summary.skipped += 1; continue; }
      const digest = await store.fingerprint(file);
      if (books.some(book => book.fingerprint === digest)) { summary.duplicates += 1; continue; }
      let meta = {};
      let chapterCount = 0;
      if (ext === 'txt') {
        const chapters = splitChapters(await file.text());
        if (!chapters.length) { summary.skipped += 1; continue; }
        meta = { title: file.name.replace(/\.[^.]+$/, '') };
        chapterCount = chapters.length;
      } else {
        const parsed = await makeBook(file);
        try {
          meta = { title: pickText(parsed.metadata?.title), author: pickText(parsed.metadata?.author) };
          chapterCount = parsed.sections?.length ?? 0;
          const cover = await parsed.getCover?.();
          meta.cover = cover instanceof Blob && cover.size ? cover : null;
        } finally {
          parsed.destroy?.();
        }
      }
      await store.putBook({
        id: `book-${crypto.randomUUID()}`,
        title: meta.title || file.name.replace(/\.[^.]+$/, ''),
        author: meta.author || '',
        cover: meta.cover || null,
        format: ext.toUpperCase(),
        filename: file.name,
        size: file.size,
        fingerprint: digest,
        blob: file,
        local: true,
        added: now(),
        chapterCount,
      });
      summary.imported += 1;
    } catch (error) {
      summary.failed.push(`${file.name}：${error.message}`);
    }
  }
  await refreshShelf();
  const notes = [`已导入 ${summary.imported} 本`];
  if (summary.duplicates) notes.push(`${summary.duplicates} 本已在书架`);
  if (summary.skipped) notes.push(`跳过 ${summary.skipped} 个空白或不支持的文件`);
  if (summary.failed.length) notes.push(`失败 ${summary.failed.length} 本（${summary.failed.slice(0, 2).join('；')}）`);
  status(notes.join('；'), summary.failed.length ? 'error' : '');
  return summary;
}

// --------------------------------------------------------------------------
// Standard Ebooks open library
// --------------------------------------------------------------------------
function renderLibrary() {
  const list = $('libraryList');
  list.replaceChildren();
  if (!libraryResults.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = '没有找到匹配的公版书，换一个关键词试试。';
    list.append(empty);
    updateLibrarySelectionUI();
    return;
  }
  for (const book of libraryResults) {
    const card = document.createElement('article');
    card.className = 'library-card';
    card.dataset.bookId = book.id;
    const select = document.createElement('input');
    select.type = 'checkbox';
    select.className = 'library-select';
    select.checked = librarySelection.has(book.id);
    select.setAttribute('aria-label', `选择《${book.title}》`);
    select.onchange = () => {
      if (select.checked) librarySelection.add(book.id);
      else librarySelection.delete(book.id);
      updateLibrarySelectionUI();
    };
    card.append(select);
    if (book.cover) {
      const img = document.createElement('img');
      img.src = book.cover;
      img.alt = '';
      img.loading = 'lazy';
      card.append(img);
    }
    const title = document.createElement('h3');
    title.textContent = book.title;
    const author = document.createElement('p');
    author.className = 'author';
    author.textContent = book.author;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const epub = document.createElement('button');
    epub.type = 'button';
    epub.className = 'primary';
    epub.textContent = '导入 EPUB';
    epub.onclick = () => importLibraryBook(book, 'epub');
    const azw3 = document.createElement('button');
    azw3.type = 'button';
    azw3.textContent = '导入 AZW3';
    azw3.onclick = () => importLibraryBook(book, 'azw3');
    const source = document.createElement('a');
    source.href = book.pageUrl;
    source.target = '_blank';
    source.rel = 'noreferrer';
    source.textContent = '原页';
    source.style.alignSelf = 'center';
    actions.append(epub, azw3, source);
    const rights = document.createElement('p');
    rights.className = 'rights';
    rights.textContent = '公版 · Standard Ebooks · 无 DRM';
    card.append(title, author, actions, rights);
    list.append(card);
  }
  updateLibrarySelectionUI();
}

function updateLibrarySelectionUI() {
  const count = librarySelection.size;
  $('librarySelected').textContent = `${count} 本已选`;
  $('batchEpub').disabled = count === 0;
  $('batchAzw3').disabled = count === 0;
  const all = $('librarySelectAll');
  const visible = libraryResults.length;
  all.checked = visible > 0 && visible === count;
  all.indeterminate = count > 0 && count < visible;
}

function setLibrarySelection(selected) {
  librarySelection = selected ? new Set(libraryResults.map(book => book.id)) : new Set();
  renderLibrary();
}

async function searchLibrary(query = '') {
  if (libraryLoading) { libraryPendingQuery = query; return; }
  libraryLoading = true;
  librarySelection.clear();
  $('libraryStatus').textContent = query ? `正在搜索「${query}」…` : '正在读取热门公版书…';
  try {
    libraryResults = await searchStandardEbooks(query);
    $('libraryStatus').textContent = `找到 ${libraryResults.length} 本公版书。下载后只保存在本机。`;
    renderLibrary();
  } catch (error) {
    libraryResults = [];
    $('libraryStatus').textContent = `公版书库连接失败：${error.message}`;
    renderLibrary();
  } finally {
    libraryLoading = false;
    if (libraryPendingQuery !== null) {
      const next = libraryPendingQuery;
      libraryPendingQuery = null;
      searchLibrary(next);
    }
  }
}

async function importLibraryBook(book, format, { batch = false } = {}) {
  if (!batch) $('libraryStatus').textContent = `正在下载《${book.title}》${format.toUpperCase()}…`;
  try {
    const blob = await fetchLibraryBook(book, format);
    const ext = format === 'azw3' ? 'azw3' : 'epub';
    const file = new File([blob], `${book.slug}.${ext}`, { type: blob.type || 'application/octet-stream' });
    await importFiles([file]);
    if (!batch) {
      $('libraryStatus').textContent = `《${book.title}》已导入书架。`;
      await refreshShelf();
      showScreen('library');
    }
    return { ok: true };
  } catch (error) {
    if (!batch) $('libraryStatus').textContent = `导入失败：${error.message}`;
    return { ok: false, error: `${book.title}：${error.message}` };
  }
}

async function batchImportLibrary(format) {
  const books = libraryResults.filter(book => librarySelection.has(book.id));
  if (!books.length) { $('libraryStatus').textContent = '请先勾选要导入的书。'; return; }
  $('batchEpub').disabled = true;
  $('batchAzw3').disabled = true;
  let imported = 0;
  const failed = [];
  for (const [index, book] of books.entries()) {
    $('libraryStatus').textContent = `批量导入 ${index + 1}/${books.length}：《${book.title}》${format.toUpperCase()}…`;
    const result = await importLibraryBook(book, format, { batch: true });
    if (result.ok) imported += 1;
    else failed.push(result.error);
  }
  await refreshShelf();
  librarySelection.clear();
  renderLibrary();
  $('libraryStatus').textContent = `批量导入完成：成功 ${imported} 本${failed.length ? `，失败 ${failed.length} 本（${failed.slice(0, 2).join('；')}）` : ''}。`;
  showScreen('library');
}

// A first-time visitor should be able to hear this product working before they
// own an ebook. The sample is written for this prototype and dedicated to the
// public domain, so it can be shipped without any licence risk.
const SAMPLE_BOOK = {
  title: '示范：一个安静的晚上',
  chapters: [
    {
      title: '第一章 窗边的灯',
      paragraphs: [
        '天黑了，屋子里只剩下一盏小灯还亮着。灯光落在桌角，像一小片温暖的湖。',
        '妈妈把书摊开在膝盖上，孩子靠过来，把下巴搁在她的手臂上。',
        '「今天讲哪一段？」妈妈问。',
        '「从上次停下的地方开始。」孩子说，「你走了以后，我自己没有往后翻。」',
      ],
    },
    {
      title: '第二章 一口气听完',
      paragraphs: [
        '故事里的人走过长长的走廊，推开一扇门，门外是春天的声音。',
        '孩子听着听着，眼睛慢慢合上了，但手指还搭在书页上，好像怕它跑掉。',
        '妈妈没有停下来。她把声音放轻一点，一句接一句地往下读，直到故事自己走到结尾。',
      ],
    },
  ],
};

async function trySampleBook() {
  try {
    const text = SAMPLE_BOOK.chapters
      .map(chapter => `${chapter.title}\n${chapter.paragraphs.join('\n\n')}`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const file = new File([blob], '示范-一个安静的晚上.txt', { type: 'text/plain' });
    await importFiles([file]);
  } catch (error) {
    status(`示范书没能导入：${error.message}`, 'error');
  }
}

// Say plainly what is ready on this device: local speech needs nothing, the
// other two sources need setup the visitor may not want. A visitor who thinks
// listening requires an API key will never press play.
function renderReadiness() {
  const box = $('readiness');
  if (!box) return;
  const set = (kind, state, text) => {
    const line = box.querySelector(`.readiness-line[data-kind="${kind}"]`);
    if (line) line.dataset.ready = state;
    const label = { browser: 'readyBrowser', kokoro: 'readyKokoro', piper: 'readyPiper', library: 'readyLibrary' }[kind];
    if (label && $(label)) $(label).textContent = text;
  };
  const browserVoices = window.speechSynthesis?.getVoices?.() ?? [];
  if (params.get('ttsTone') === '1') {
    set('browser', 'yes', '已就绪（测试音）：不联网即可连续朗读。');
  } else if (!window.speechSynthesis) {
    set('browser', 'no', '这台浏览器不支持语音合成；可以连接神经网络语音，或换用 Chrome / Edge / Safari。');
  } else if (!browserVoices.length) {
    set('browser', 'yes', '已就绪：语音列表可能稍后加载，先点「听书」即可，或到「声音」页换一个声音。');
  } else {
    const chinese = browserVoices.filter(voice => /^(zh|cmn)/i.test(voice.lang || ''));
    set('browser', 'yes', chinese.length
      ? `已就绪：本机有 ${chinese.length} 个中文声音，不联网、不上传文本。`
      : `已就绪：本机有 ${browserVoices.length} 个声音，暂无中文声音，朗读中文可能不准。`);
  }
  if (!window.WebAssembly) {
    set('kokoro', 'no', '此浏览器不支持 WebAssembly，无法运行本机神经模型。');
  } else if (kokoroRuntime?.loaded) {
    set('kokoro', 'yes', `已就绪：${KOKORO.name} · ${kokoroVoiceName(settings.kokoro.voiceId)}，模型已缓存。`);
  } else {
    set('kokoro', 'no', `可选；${KOKORO.name}首次使用需下载${KOKORO.sizeHint}，之后本机运行。`);
  }
  const definition = piperPack();
  if (!window.WebAssembly) {
    set('piper', 'no', '此浏览器不支持 WebAssembly，无法运行本机神经模型。');
  } else if (currentPiperRuntime()?.loaded) {
    set('piper', 'yes', definition.requiresEmbedding
      ? `已就绪：${definition.name} · ${activePiperVoiceId === 'demo' ? '示范声音' : '已训练声音'}，模型已缓存。`
      : `已就绪：${definition.name}（单声线离线包），模型已缓存。`);
  } else {
    set('piper', 'no', `可选；${definition.name}首次使用需下载${definition.sizeHint}，之后本机运行。`);
  }
  set('library', libraryConfigured() ? 'yes' : 'no',
    libraryConfigured() ? `已连接：${settings.library.baseUrl}。` : '尚未连接，可选；需要自己运行声音库服务并由家人授权录制。');
}

async function removeBook(book) {
  if (!confirm(`从本机书架移除《${titleOf(book)}》？进度和笔记会一并删除，原文件不受影响。`)) return;
  await store.deleteBookRecord(book.id);
  for (const note of await store.listNotes(book.id)) await store.deleteNote(note.id);
  localStorage.removeItem(progressKey(book.id));
  if (localStorage.getItem('rw03-last-book') === book.id) localStorage.removeItem('rw03-last-book');
  if (activeBook?.id === book.id) closeBook();
  await refreshShelf();
  // Removing the book that was open leaves the reader on an empty stage with
  // nothing to play; go back to the shelf so the visitor can see what is left.
  if (!$('screen-reader').hidden && !activeBook) showScreen('library');
  status(`已从本机移除《${titleOf(book)}》`);
}

// --------------------------------------------------------------------------
// Reading (EPUB via foliate-js, TXT via the pure text splitter)
// --------------------------------------------------------------------------
let foliateView = null;
let bookModel = null;
let renderToken = 0;
let currentChapter = 0;
let currentParagraph = 0;
let epubDocs = new Map();
let lastSync = null;

const isTxt = book => formatOf(book) === 'TXT';

async function openBook(book, { listen = false } = {}) {
  const token = ++renderToken;
  epubDocs = new Map();
  lastSync = null;
  narration?.stop({ keepPosition: false });
  foliateView?.destroy?.();
  foliateView?.remove();
  foliateView = null;
  activeBook = book;
  localStorage.setItem('rw03-last-book', book.id);
  showScreen('reader');
  $('readerTitle').textContent = titleOf(book);
  $('txtPage').replaceChildren();
  $('txtPage').hidden = true;
  $('bookView').replaceChildren();
  const saved = bookProgress(book.id) || { chapter: 0, paragraph: 0 };
  status(`正在打开《${titleOf(book)}》…`);
  try {
    if (isTxt(book)) await openTxt(book, token);
    else await openEpub(book, saved, token);
    if (token !== renderToken) return;
    renderChapterList();
    renderNotes();
    refreshEngineBadge();
    status(bookModel.audioSupported === false
      ? `已打开《${bookModel.title || titleOf(book)}》· ${bookModel.chapters.length} 页图像（可翻页阅读，暂不支持朗读）`
      : `已打开《${bookModel.title || titleOf(book)}》· ${bookModel.chapters.length} 章 · ${totalParagraphs(bookModel)} 段`);
    if (listen) {
      // startPosition() is the one place that turns a finished book back into a
      // fresh pass. Passing the saved cursor directly would reopen a finished
      // book on its last paragraph and stop again immediately.
      if (bookModel.audioSupported === false) {
        await showParagraph(saved.chapter ?? 0, saved.paragraph ?? 0, { scroll: true });
        status('这是图像漫画（CBZ）：可以翻页阅读，当前版本不支持朗读图像页。', 'warn');
      } else {
        await startListening();
      }
    } else {
      await showParagraph(saved.chapter ?? 0, saved.paragraph ?? 0, { scroll: true });
    }
  } catch (error) {
    console.error(error);
    status(`打开《${titleOf(book)}》失败：${error.message}。书仍在书架，可以重试或移除。`, 'error');
  }
}

async function openTxt(book, token) {
  const chapters = splitChapters(await book.blob.text());
  if (token !== renderToken) return;
  bookModel = bookFromTxt(null, { title: titleOf(book), author: book.author || '', chapters });
  $('txtPage').hidden = false;
}

// Read the EPUB 3 navigation document (falling back to the EPUB 2 NCX) and
// return TOC entries resolved against the manifest, shaped like foliate's own
// `{ label, href, subitems }`. Hrefs stay unresolved strings: the caller maps
// them onto spine sections itself, so a nav entry such as `c2.xhtml` without a
// fragment still resolves to the right chapter.
const parseNavDocument = (text, dir) => {
  const doc = new DOMParser().parseFromString(text, 'application/xhtml+xml');
  const navs = [...doc.querySelectorAll('nav')];
  const tocNav = navs.find(nav => (nav.getAttribute('epub:type') || nav.getAttributeNS('http://www.idpf.org/2007/ops', 'type') || '').split(/\s+/).includes('toc')) || navs[0];
  if (!tocNav) return null;
  const resolve = href => {
    try { return decodeURI(new URL(href, `https://epub.invalid/${dir}`).pathname.slice(1)); } catch { return href; }
  };
  const parseList = ol => [...(ol?.children || [])].filter(li => li.tagName.toLowerCase() === 'li').map(li => {
    const link = li.querySelector('a[href]');
    const label = (link?.textContent || '').trim();
    const href = link ? resolve(link.getAttribute('href')) : null;
    const subitems = parseList(li.querySelector('ol'));
    return { label, href, subitems: subitems.length ? subitems : null };
  });
  const items = parseList(tocNav.querySelector('ol'));
  return items.length ? items : null;
};

const parseNcxDocument = (text, dir) => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const resolve = href => {
    try { return decodeURI(new URL(href, `https://epub.invalid/${dir}`).pathname.slice(1)); } catch { return href; }
  };
  const walk = parent => [...parent.children].filter(el => el.localName === 'navPoint').map(point => {
    const label = (point.querySelector('navLabel > text')?.textContent || '').trim();
    const src = point.querySelector('content')?.getAttribute('src') || '';
    const subitems = walk(point);
    return { label, href: src ? resolve(src) : null, subitems: subitems.length ? subitems : null };
  });
  const map = doc.querySelector('navMap');
  const items = map ? walk(map) : [];
  return items.length ? items : null;
};

async function readEpubToc(epub) {
  const navPath = epub.resources?.navPath;
  const ncxPath = epub.resources?.ncxPath;
  const dirOf = path => path.replace(/[^/]*$/, '');
  for (const [path, parse] of [[navPath, parseNavDocument], [ncxPath, parseNcxDocument]]) {
    if (!path) continue;
    try {
      const text = await epub.loadText?.(path);
      if (!text) continue;
      const items = parse(text, dirOf(path));
      if (items) return items;
    } catch (error) {
      console.warn('目录解析失败', path, error);
    }
  }
  return null;
}

async function openEpub(book, saved, token) {
  const view = document.createElement('foliate-view');
  $('bookView').append(view);
  await view.open(book.blob);
  if (token !== renderToken) { view.destroy?.(); return; }
  foliateView = view;
  const epub = view.book;
  // foliate only reads `book.toc` while opening the view: TOC parsing is lazy
  // and finishes in the background, so the view can hold an empty table of
  // contents even though the navigation document is fine. The navigation
  // document is parsed directly here instead, which is what maps the chapter
  // list onto spine sections and makes jumps independent of fragment ids.
  const navToc = await readEpubToc(epub);
  if (token !== renderToken) { view.destroy?.(); return; }
  bookModel = mapEpubSections({ sections: epub.sections, toc: epub.toc ?? navToc, metadata: epub.metadata, format: formatOf(book) });
  if (!bookModel.title) bookModel.title = titleOf(book);
  // CBZ sections are images with a `load()` URL, not XHTML documents. They can
  // still be read page by page through foliate, but there is no text to speak.
  bookModel.chapters = narratableChapters(bookModel.chapters, epub.sections);
  bookModel.audioSupported = (epub.sections ?? []).every(section => typeof section?.createDocument === 'function');
  // One narration chapter per spine section; paragraph text is extracted up
  // front so listening works with the reading pane closed or off-screen.
  for (const chapter of bookModel.chapters) {
    const section = epub.sections[chapter.sectionIndex];
    if (typeof section?.createDocument !== 'function') {
      chapter.paragraphs = [];
      continue;
    }
    const doc = await section.createDocument();
    for (const el of [...doc.querySelectorAll('aside, [role="doc-footnote"], [role="doc-endnote"], [role="doc-noteref"], .footnote, .endnote')]) el.remove();
    for (const el of [...doc.querySelectorAll('*')]) {
      const type = el.getAttribute?.('epub:type') || el.getAttributeNS?.('http://www.idpf.org/2007/ops', 'type') || '';
      if (/(footnote|endnote|annotation|noteref)/i.test(type)) el.remove();
    }
    chapter.paragraphs = paragraphsFromHtml(doc.documentElement?.outerHTML || doc.body?.innerHTML || '');
    // The chapter heading is announced separately; do not read it twice when
    // the EPUB also places it at the start of the section.
    if (chapter.paragraphs.length && normalizeText(chapter.paragraphs[0]) === normalizeText(chapter.title)) chapter.paragraphs.shift();
    if (!chapter.paragraphs.length) chapter.paragraphs = [chapter.title];
  }
  if (token !== renderToken) return;
  view.addEventListener('relocate', event => {
    if (activeBook?.id !== book.id) return;
    const { fraction, tocItem, cfi } = event.detail || {};
    $('position').textContent = `${tocItem?.label ? `${tocItem.label} · ` : ''}${percent(fraction ?? 0)}`;
    updateReadProgress(fraction ?? 0);
    if (!narration?.active && cfi) {
      const sectionIndex = chapterIndexFromCfi(cfi);
      const chapter = chapterIndexForSection(bookModel.chapters, sectionIndex);
      if (chapter < 0) return;
      currentChapter = chapter;
      currentParagraph = 0;
      markCurrentChapter(chapter);
      saveProgress(book.id, {
        chapter, paragraph: 0, chapterTitle: bookModel.chapters[chapter]?.title || '',
        fraction: fraction ?? 0, listening: false, cfi,
      });
    }
  });
  view.addEventListener('load', event => onEpubSectionLoad(event.detail, book.id));
  // `lastLocation` is handed to foliate untouched, so it must be a spine index;
  // a `{chapter, paragraph}` object makes the view fail to resolve the target
  // and silently fall back to the first page. Our chapter list can omit
  // non-linear/notes sections, so translate through sectionIndex.
  const savedChapter = Math.min(Math.max(0, saved.chapter ?? 0), Math.max(0, bookModel.chapters.length - 1));
  const startSection = narration?.active !== true && bookModel.chapters[savedChapter]
    ? (bookModel.chapters[savedChapter].sectionIndex ?? 0)
    : 0;
  try {
    await view.init(saved.cfi && !saved.listening ? { lastLocation: saved.cfi } : { lastLocation: startSection });
  } catch {
    await view.init({ lastLocation: startSection });
  }
}

function chapterIndexFromCfi(cfi) {
  try {
    const index = foliateView?.resolveNavigation?.(cfi)?.index;
    return Number.isInteger(index) ? index : (narration?.chapter ?? 0);
  } catch {
    return narration?.chapter ?? 0;
  }
}

function ensureActiveParagraphStyle(doc) {
  if (!doc || doc.querySelector('#rw-active-style')) return;
  const style = doc.createElement?.('style');
  if (!style) return;
  style.id = 'rw-active-style';
  style.textContent = '.rw-active{background:#f1efe2;border-radius:6px;box-shadow:0 0 0 .35rem #f1efe2;transition:background .2s}';
  doc.head?.append(style);
}

// Keep the visible book page and the audio cursor on the same paragraph. This
// is paragraph-level text/audio synchronisation: reliable across EPUB, FB2,
// MOBI and TXT without modifying the publisher's markup.
function highlightEpubParagraph(chapterIndex, paragraphIndex) {
  if (!bookModel || !foliateView) return;
  const chapter = bookModel.chapters[chapterIndex];
  if (!chapter) return;
  const section = chapter.sectionIndex ?? chapterIndex;
  const doc = epubDocs.get(section);
  if (!doc) return;
  const wanted = normalizeText(chapter.paragraphs?.[paragraphIndex] || '');
  const candidates = [...doc.querySelectorAll('p,li,h1,h2,h3,h4,blockquote')]
    .filter(el => normalizeText(el.textContent));
  let target = wanted
    ? candidates.find(el => normalizeText(el.textContent).startsWith(wanted.slice(0, 24)))
    : null;
  if (!target) target = candidates[Math.min(paragraphIndex, Math.max(0, candidates.length - 1))];
  if (!target) return;
  doc.querySelectorAll('.rw-active').forEach(el => el.classList.remove('rw-active'));
  target.classList.add('rw-active');
  ensureActiveParagraphStyle(doc);
  // In foliate's paginated view the iframe is one wide column inside a
  // scrollable container, so the paragraph's own scrollIntoView cannot turn
  // the page reliably. Ask the paginator to scroll to the element instead;
  // this is what makes EPUB/AZW3/MOBI/FB2 follow the audio page by page.
  if (typeof foliateView.renderer?.scrollToAnchor === 'function') {
    foliateView.renderer.scrollToAnchor(target);
  } else {
    target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }
  lastSync = {
    chapter: chapterIndex,
    paragraph: paragraphIndex,
    text: normalizeText(target.textContent).slice(0, 60),
  };
}

// Clicking a paragraph in the book selects it for notes and listening.
function onEpubSectionLoad({ doc, index } = {}, bookId) {
  if (!doc || activeBook?.id !== bookId) return;
  epubDocs.set(index, doc);
  ensureActiveParagraphStyle(doc);
  if (currentChapter === index) highlightEpubParagraph(currentChapter, currentParagraph);
  doc.addEventListener('click', event => {
    const paragraph = event.target.closest?.('p,li,h1,h2,h3,h4,blockquote');
    if (!paragraph) return;
    const chapterIndex = chapterIndexForSection(bookModel.chapters, index);
    const chapter = bookModel.chapters[chapterIndex];
    if (!chapter) return;
    const text = paragraph.textContent?.replace(/\s+/g, ' ').trim() || '';
    const found = chapter.paragraphs.findIndex(item => item.startsWith(text.slice(0, 24)));
    const target = found >= 0 ? found : 0;
    doc.querySelectorAll('.rw-active').forEach(el => el.classList.remove('rw-active'));
    paragraph.classList.add('rw-active');
    ensureActiveParagraphStyle(doc);
    setCursor(chapterIndex, target);
  });
}

function setCursor(chapter, paragraph) {
  if (!bookModel) return;
  const ch = bookModel.chapters[chapter];
  if (!ch) return;
  const target = Math.max(0, Math.min(Math.max(0, ch.paragraphs.length - 1), paragraph | 0));
  currentChapter = chapter;
  currentParagraph = target;
  narration?.jump({ chapter, paragraph: target });
  if (narration?.state === State.SPEAKING) {
    narration.pause();
    narration.resume();
  }
  markCurrentChapter(chapter);
  $('nowChapter').textContent = `${ch.title}（${paragraphPosition(ch, target)}）`;
  $('nowSentence').textContent = (ch.paragraphs[target] || '图像页没有可朗读文本').slice(0, 70);
}

function renderChapterList() {
  const lists = [$('chapterList'), $('tocDialogList')].filter(Boolean);
  lists.forEach(list => list.replaceChildren());
  $('chapterCount').textContent = bookModel ? `${bookModel.chapters.length} 章` : '';
  if (!bookModel) return;
  bookModel.chapters.forEach((chapter, index) => {
    for (const list of lists) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${index + 1}. ${chapter.title}`;
      button.dataset.chapter = String(index);
      button.onclick = () => {
        goToChapter(index);
        const dialog = $('tocDialog');
        if (dialog?.open) dialog.close();
      };
      li.append(button);
      list.append(li);
    }
  });
  markCurrentChapter(currentChapter);
}

function markCurrentChapter(index) {
  for (const list of [$('chapterList'), $('tocDialogList')]) {
    list?.querySelectorAll('button[data-chapter]').forEach(button => {
      button.setAttribute('aria-current', String(Number(button.dataset.chapter) === index));
    });
  }
}

// Show the paragraph at (chapter, paragraph): EPUB turns to the section, TXT
// renders the whole chapter with the active paragraph scrolled into view.
async function showParagraph(chapterIndex, paragraphIndex, { scroll = false, persist = true } = {}) {
  if (!bookModel) return;
  chapterIndex = Math.max(0, Math.min(bookModel.chapters.length - 1, chapterIndex | 0));
  const chapter = bookModel.chapters[chapterIndex];
  currentChapter = chapterIndex;
  currentParagraph = Math.max(0, Math.min(Math.max(0, chapter.paragraphs.length - 1), paragraphIndex | 0));
  markCurrentChapter(chapterIndex);
  $('nowChapter').textContent = chapter.title;
  $('position').textContent = `${chapter.title} · ${paragraphPosition(chapter, currentParagraph)}`;
  updateReadProgress(bookFraction(chapterIndex, currentParagraph));
  if (persist && activeBook && !narration?.active) {
    // Only written when a book is actually shown: opening another book resets
    // the shared reader pane while the previous book's progress is still in
    // flight, and those stray writes must not land on the new book.
    saveProgress(activeBook.id, {
      chapter: chapterIndex, paragraph: currentParagraph, chapterTitle: chapter.title, listening: false,
      fraction: (chapterIndex + currentParagraph / Math.max(1, chapter.paragraphs.length)) / bookModel.chapters.length,
    });
  }
  if (foliateView) {
    const section = chapter.sectionIndex ?? chapterIndex;
    if (foliateView.__shownChapter !== section) {
      foliateView.__shownChapter = section;
      await foliateView.goTo(section);
      // goTo is fire-and-forget about failures; a navigation that landed on a
      // different section must not leave the chapter list pointing elsewhere.
      const shown = foliateView.lastLocation?.index;
      if (Number.isInteger(shown) && shown !== section) {
        foliateView.__shownChapter = shown;
        const actual = bookModel.chapters.findIndex(item => (item.sectionIndex ?? 0) === shown);
        if (actual >= 0) {
          $('nowChapter').textContent = bookModel.chapters[actual].title;
          $('position').textContent = bookModel.chapters[actual].title;
          markCurrentChapter(actual);
        }
        status('这一段在 EPUB 里找不到对应的章节入口，已停在原处。', 'warn');
      }
    }
    highlightEpubParagraph(chapterIndex, currentParagraph);
    return;
  }
  renderTxtPage(chapterIndex, { scroll });
}

function renderTxtPage(chapterIndex, { scroll = false } = {}) {
  const chapter = bookModel.chapters[chapterIndex];
  const page = $('txtPage');
  page.replaceChildren();
  const heading = document.createElement('h2');
  heading.className = 'chap';
  heading.textContent = chapter.title;
  chapter.paragraphs.forEach((text, index) => {
    const p = document.createElement('p');
    p.textContent = text;
    if (index === currentParagraph) p.classList.add('active');
    p.onclick = () => setCursor(chapterIndex, index);
    page.append(p);
  });
  page.prepend(heading);
  lastSync = { chapter: chapterIndex, paragraph: currentParagraph, text: normalizeText(chapter.paragraphs[currentParagraph] || '').slice(0, 60) };
  if (scroll) page.querySelector('p.active')?.scrollIntoView({ block: 'center' });
}

async function goToChapter(index) {
  if (!bookModel || index < 0 || index >= bookModel.chapters.length) return;
  if (narration?.active) {
    narration.jump({ chapter: index, paragraph: 0 });
    narration.pause();
    narration.resume();
    return;
  }
  await showParagraph(index, 0, { scroll: true });
}

async function page(direction) {
  if (!bookModel) return;
  if (narration?.active) narration.pause();
  if (foliateView) {
    await (direction > 0 ? foliateView.next() : foliateView.prev());
    return;
  }
  let chapter = currentChapter;
  let paragraph = currentParagraph + direction * 12;
  if (paragraph < 0) {
    if (chapter === 0) paragraph = 0;
    else { chapter -= 1; paragraph = Math.max(0, bookModel.chapters[chapter].paragraphs.length - 1); }
  } else if (paragraph >= bookModel.chapters[chapter].paragraphs.length) {
    if (chapter < bookModel.chapters.length - 1) { chapter += 1; paragraph = 0; }
    else paragraph = Math.max(0, bookModel.chapters[chapter].paragraphs.length - 1);
  }
  narration?.jump({ chapter, paragraph });
  await showParagraph(chapter, paragraph, { scroll: true });
}

function closeBook() {
  narration?.stop({ keepPosition: false });
  foliateView?.destroy?.();
  foliateView?.remove();
  foliateView = null;
  activeBook = null;
  bookModel = null;
  currentChapter = 0;
  currentParagraph = 0;
  epubDocs = new Map();
  lastSync = null;
  $('readerTitle').textContent = '未打开书籍';
  $('nowChapter').textContent = '选一本书开始';
  $('nowSentence').textContent = '—';
  $('chapterList').replaceChildren();
  $('position').textContent = '—';
  updateReadProgress(0);
  $('tocDialog')?.close?.();
}

// --------------------------------------------------------------------------
// Continuous listening
// --------------------------------------------------------------------------
const positionFromProgress = () => {
  const saved = activeBook ? bookProgress(activeBook.id) : null;
  return { chapter: saved?.chapter ?? 0, paragraph: saved?.paragraph ?? 0 };
};

function createNarration() {
  return new Narration({
    speak: (text, options) => {
      const engine = currentEngine || buildEngine();
      if (!engine) throw new Error('没有可用的朗读引擎');
      return engine.speak(text, options);
    },
    onState: state => {
      const playing = state === State.SPEAKING;
      $('playButton').textContent = state === State.PAUSED ? '▶' : playing ? '⏸' : '▶';
      $('playButton').setAttribute('aria-label', playing ? '暂停朗读' : '开始或继续朗读');
      $('playButton').dataset.state = state;
      document.title = playing ? `${bookModel?.title || '陪你读书'} · 正在朗读` : '陪你读书 V0.3';
      if (state === State.ENDED) {
        if (activeBook) {
          if (narration?.endAt) {
            const ch = bookModel?.chapters[narration.chapter];
            saveProgress(activeBook.id, {
              chapter: narration.chapter, paragraph: narration.paragraph,
              chapterTitle: ch?.title || '', finished: false, listening: true,
              fraction: ((narration.chapter + narration.paragraph / Math.max(1, ch?.paragraphs.length ?? 1)) / Math.max(1, bookModel?.chapters.length ?? 1)),
            });
            status('本段已读完。点「读本段」再听这一段，或点「读全书」继续往下听。');
          } else {
            const last = Math.max(0, (bookModel?.chapters.length ?? 1) - 1);
            const ch = bookModel?.chapters[last];
            saveProgress(activeBook.id, {
              chapter: last, paragraph: Math.max(0, (ch?.paragraphs.length ?? 1) - 1),
              chapterTitle: ch?.title || '', finished: true, listening: true, fraction: 1,
            });
            status('这本书已经读完了。再点播放会从第一章重听，也可以从书架换一本。');
          }
        }
      }
      syncDucking();
    },
    onProgress: ({ chapterChanged, chapter, paragraph, state }) => {
      if (!bookModel) return;
      const ch = bookModel.chapters[chapter];
      if (!ch) return;
      currentChapter = chapter;
      currentParagraph = paragraph;
      updateReadProgress(bookFraction(chapter, paragraph));
      $('nowChapter').textContent = `${ch.title}（${paragraphPosition(ch, paragraph)}）`;
      if (chapterChanged) {
        markCurrentChapter(chapter);
        refreshShelf().catch(() => {});
        if (foliateView) {
          const section = ch.sectionIndex ?? chapter;
          if (foliateView.__shownChapter !== section) {
            foliateView.__shownChapter = section;
            foliateView.goTo(section);
          }
        } else {
          currentParagraph = paragraph;
          renderTxtPage(chapter, { scroll: true });
        }
      }
      if (activeBook) {
        saveProgress(activeBook.id, {
          chapter, paragraph, chapterTitle: ch.title, listening: true,
          fraction: (chapter + paragraph / Math.max(1, ch.paragraphs.length)) / bookModel.chapters.length,
        });
      }
      if (state === State.SPEAKING || state === State.PAUSED || chapterChanged) recordListening(0);
    },
    onChunk: ({ chapter, paragraph, text }) => {
      currentChapter = chapter;
      currentParagraph = paragraph;
      $('nowSentence').textContent = text.length > 70 ? `${text.slice(0, 70)}…` : text;
      $('playButton').dataset.chapter = String(chapter);
      $('playButton').dataset.paragraph = String(paragraph);
      if (foliateView) {
        highlightEpubParagraph(chapter, paragraph);
        return;
      }
      const page = $('txtPage');
      const target = page.querySelectorAll('p')[paragraph];
      if (!target) return;
      page.querySelectorAll('p.active').forEach(el => el.classList.remove('active'));
      target.classList.add('active');
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      lastSync = { chapter, paragraph, text: normalizeText(target.textContent).slice(0, 60) };
    },
    onError: error => {
      if (isAbort(error)) return;
      status(`朗读中断：${error.message}。可以换一个声音来源，或稍后重试。`, 'error');
    },
  });
}

async function ensureNarration() {
  if (!narration) {
    narration = createNarration();
    // Listening time statistics follow real audio playback, not wall clock of
    // the UI, so pause durations never inflate "已听" minutes.
    const report = narration.report.bind(narration);
    let lastListened = 0;
    narration.report = () => {
      report();
      const delta = narration.listenedMs - lastListened;
      if (delta > 0) { lastListened = narration.listenedMs; recordListening(delta); }
    };
  }
  return narration;
}

// Pressing play on a finished book starts a fresh pass instead of
// "resuming" the last paragraph and ending again within a second.
const isFinished = () => isBookFinished(activeBook ? bookProgress(activeBook.id) : null);

function startPosition() {
  const saved = positionFromProgress();
  if (!isFinished()) return saved;
  if (activeBook) saveProgress(activeBook.id, { chapter: 0, paragraph: 0, finished: false });
  if (narration) {
    narration.announcedBook = false;
    narration.announcedChapter = null;
    narration.endAt = null;
  }
  return { chapter: 0, paragraph: 0 };
}

// Every transition runs through here so an "idle"/"ended" engine is always
// attached to the book that is on screen now, never to a previously opened one.
async function narrationFor(position) {
  const engine = await ensureNarration();
  if (engine.book !== bookModel) engine.load(bookModel, position);
  else if (position) engine.jump(position);
  if (bookModel) engine.bookTitle = bookModel.title || '';
  return engine;
}

async function startListening(position = null, { scope = 'book' } = {}) {
  if (!bookModel) { status('先在书架选一本书。', 'warn'); return; }
  if (bookModel.audioSupported === false) {
    status('这是图像漫画（CBZ）：可以翻页阅读，当前版本不支持朗读图像页。', 'warn');
    return;
  }
  primePiperAudio();
  primeKokoroAudio();
  primeZipVoiceAudio();
  currentEngine = buildEngine();
  if (!currentEngine) return;
  refreshEngineBadge();
  const target = position || startPosition();
  // Put the reading pane on the same paragraph as the audio before speaking.
  // TXT books have no renderer until this runs, and a finished EPUB must turn
  // back to the first section when listening restarts from the beginning.
  await showParagraph(target.chapter ?? 0, target.paragraph ?? 0, { scroll: true, persist: false });
  const engine = await narrationFor(target);
  engine.bookTitle = scope === 'book' ? (bookModel?.title || '') : '';
  engine.speakTitles = scope === 'book';
  engine.endAt = scope === 'paragraph'
    ? { chapter: target.chapter ?? 0, paragraph: target.paragraph ?? 0 }
    : null;
  await engine.start();
}

function startScope(scope) {
  if (!bookModel) { status('先在书架选一本书。', 'warn'); return; }
  const position = { chapter: currentChapter, paragraph: currentParagraph };
  startListening(position, { scope }).catch(error => status(`朗读没有开始：${error.message}`, 'error'));
}

function togglePlay() {
  if (!bookModel) { status('先在书架选一本书。', 'warn'); return; }
  if (bookModel.audioSupported === false) {
    status('这是图像漫画（CBZ）：可以翻页阅读，当前版本不支持朗读图像页。', 'warn');
    return;
  }
  primePiperAudio();
  primeKokoroAudio();
  currentEngine = buildEngine();
  if (!currentEngine) return;
  // State is read synchronously: pause must land before any await, otherwise a
  // slow engine hand-off lets a second click start reading again.
  if (narration?.book === bookModel) {
    if (narration.state === State.SPEAKING) {
      narration.pause();
      return;
    }
    if (narration.state === State.PAUSED) return narration.resume();
    if (narration.state === State.ENDED || isFinished()) return startListening();
    return narration.start(startPosition());
  }
  return startListening();
}

// Space bar / remote "play" reuse the same synchronous transition path.
const toggleFromKeyboard = () => {
  Promise.resolve(togglePlay()).catch(error => status(`朗读没有开始：${error.message}`, 'error'));
};

const skip = action => {
  if (!narration?.book) return;
  narration[action]();
  if (narration.state === State.IDLE) narration.start(positionFromProgress());
};

function renderStats() {
  const stats = settings.statistics;
  const today = new Date().toISOString().slice(0, 10);
  $('listenStats').textContent = `今日已听 ${formatMilliseconds(stats.days[today] || 0)} · 累计 ${formatMilliseconds(stats.listenedMs || 0)}`;
}

function recordListening(milliseconds) {
  if (milliseconds > 0) {
    const today = new Date().toISOString().slice(0, 10);
    settings.statistics.days[today] = (settings.statistics.days[today] || 0) + milliseconds;
    settings.statistics.listenedMs = (settings.statistics.listenedMs || 0) + milliseconds;
    saveSettings();
  }
  renderStats();
  renderPrivacyStats();
}

function refreshEngineBadge() {
  const engine = currentEngine || buildEngine();
  const label = { browser: '本机语音', kokoro: '自然中文', piper: 'Piper 神经', zipvoice: '高音质克隆', library: '家庭声音', tone: '测试音' }[engine?.kind] || '引擎';
  $('engineBadge').textContent = label;
  $('engineBadge').dataset.kind = engine?.kind || '';
  $('engineHint').textContent = engineHint(engine);
}

// --------------------------------------------------------------------------
// Notes (local only)
// --------------------------------------------------------------------------
const currentParagraphText = () => bookModel?.chapters[currentChapter]?.paragraphs[currentParagraph] ?? '';

async function renderNotes() {
  if (!activeBook) return;
  const notes = (await store.listNotes(activeBook.id)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  $('noteCount').textContent = String(notes.length);
  const list = $('noteList');
  list.replaceChildren();
  if (!notes.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = '还没有笔记。点选书里的一段话，写下你的想法。';
    list.append(empty);
  }
  for (const note of notes) {
    const card = document.createElement('div');
    card.className = 'note';
    card.dataset.noteId = note.id;
    const head = document.createElement('div');
    head.className = 'muted';
    head.textContent = `${note.chapterTitle || ''} · ${new Date(note.createdAt).toLocaleString('zh-CN')}`;
    const body = document.createElement('p');
    body.textContent = note.text;
    card.append(head);
    if (note.quote) {
      const quote = document.createElement('blockquote');
      quote.textContent = note.quote;
      card.append(quote);
    }
    card.append(body);
    const actions = document.createElement('div');
    actions.className = 'actions';
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.textContent = '回到这段话';
    jump.onclick = async () => {
      if (narration?.book) narration.jump({ chapter: note.chapter ?? 0, paragraph: note.paragraph ?? 0 });
      await showParagraph(note.chapter ?? 0, note.paragraph ?? 0, { scroll: true });
    };
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '删除';
    del.onclick = async () => {
      await store.deleteNote(note.id);
      await renderNotes();
      status('笔记已删除');
    };
    actions.append(jump, del);
    card.append(actions);
    list.append(card);
  }
}

async function saveNote({ text, quote = '' }) {
  if (!activeBook || !text.trim()) return null;
  const chapter = currentChapter;
  const note = {
    id: `note-${crypto.randomUUID()}`,
    bookId: activeBook.id,
    chapter,
    paragraph: currentParagraph,
    chapterTitle: bookModel?.chapters[chapter]?.title || '',
    quote,
    text: text.trim(),
    createdAt: now(),
  };
  await store.putNote(note);
  await renderNotes();
  status('笔记已保存在本机');
  return note;
}


// --------------------------------------------------------------------------
// Background music
// --------------------------------------------------------------------------
const baseVolume = () => Number($('musicVolume').value) || 0;

function syncDucking() {
  const audio = $('music');
  const duck = settings.music.ducking && narration?.state === State.SPEAKING;
  audio.volume = Math.max(0, Math.min(1, baseVolume() * (duck ? 0.25 : 1)));
}

function setMusicSource(blob, name) {
  const audio = $('music');
  if (audio.dataset.url) URL.revokeObjectURL(audio.dataset.url);
  audio.dataset.url = URL.createObjectURL(blob);
  audio.src = audio.dataset.url;
  $('musicName').textContent = name || '本机背景音乐';
  $('clearMusic').hidden = false;
  syncDucking();
}

async function restoreMusic() {
  const saved = await store.getBlob('background-music');
  if (saved instanceof Blob && saved.size) setMusicSource(saved, localStorage.getItem('rw03-music-name') || '本机背景音乐');
}

// --------------------------------------------------------------------------
// Household voice library
// --------------------------------------------------------------------------
const libraryFetch = (path, options = {}) => fetch(`${settings.library.baseUrl.replace(/\/+$/, '')}${path}`, {
  ...options,
  headers: { 'content-type': 'application/json', ...(settings.library.token ? { authorization: `Bearer ${settings.library.token}` } : {}), ...(options.headers || {}) },
});

const libraryConfigured = () => Boolean(settings.library.baseUrl);

// The chosen family voice is remembered by id in settings: the browser keeps
// no copy of someone's voice, so a reload re-reads the authorised list and
// picks the same voice again instead of silently falling back to another one.
function chooseVoice(voice) {
  activeVoice = voice;
  settings.engine = 'library';
  settings.library.voiceId = voice?.id || '';
  saveSettings();
  currentEngine = null;
  refreshVoiceScreens();
  refreshEngineBadge();
}

function restoreVoice() {
  const wanted = settings.library.voiceId;
  if (!wanted || activeVoice?.id === wanted) return;
  const voice = voices.find(item => item.id === wanted);
  if (voice && voice.status !== 'revoked') activeVoice = voice;
  else if (settings.engine === 'library') settings.engine = 'browser';
}

function voiceCard(voice) {
  const card = document.createElement('div');
  card.className = 'voice-card';
  card.dataset.voiceId = voice.id;
  const h = document.createElement('h3');
  h.textContent = voice.name || voice.id;
  const meta = document.createElement('div');
  meta.className = 'muted';
  meta.textContent = [voice.speaker, voice.relation, voice.status, voice.createdAt ? new Date(voice.createdAt).toLocaleDateString('zh-CN') : ''].filter(Boolean).join(' · ');
  const badge = document.createElement('span');
  const revoked = voice.status === 'revoked';
  badge.className = `badge ${revoked ? 'bad' : 'ok'}`;
  badge.textContent = revoked ? '已撤销授权' : '已授权';
  const actions = document.createElement('div');
  actions.className = 'actions row';
  actions.style.marginTop = '.5rem';
  const use = document.createElement('button');
  use.type = 'button';
  use.className = 'primary';
  use.textContent = activeVoice?.id === voice.id ? '正在使用' : '用这个声音朗读';
  use.disabled = revoked;
  use.onclick = () => {
    chooseVoice(voice);
    status(`已切换到「${voice.name}」朗读`);
  };
  const test = document.createElement('button');
  test.type = 'button';
  test.textContent = '试听';
  test.disabled = revoked;
  test.onclick = async () => {
    try {
      currentEngine = new LibraryVoiceEngine({ voiceId: voice.id, name: voice.name, baseUrl: settings.library.baseUrl, licenseToken: settings.library.token });
      await currentEngine.speak('你好，我在这里陪着你读书。');
      status(`「${voice.name}」试听完成`);
    } catch (error) {
      status(`试听失败：${error.message}`, 'error');
    }
  };
  actions.append(use, test);
  card.append(h, meta, badge, actions, renderVoiceActions(voice));
  return card;
}

function renderVoiceList(statusText = '') {
  const list = $('voiceList');
  list.replaceChildren();
  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = libraryConfigured()
    ? (statusText || '这里列出声音库中已授权的家庭声音。撤销与删除由声音本人在声音库页面完成。')
    : '尚未配置声音库。你可以先使用本机语音或神经网络语音；家庭声音需要部署 server/voice-library 并在这里填写地址。';
  list.append(intro);
  for (const voice of voices) list.append(voiceCard(voice));
  if (libraryConfigured() && voices.length) {
    const link = document.createElement('a');
    link.href = `${settings.library.baseUrl.replace(/\/+$/, '')}/consent`;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = '打开声音本人的授权与删除页面 →';
    list.append(link);
  }
}

// Creator-side controls for an authorised voice. They call the voice library
// API, which re-checks consent: revoking changes the record the synthesis
// API still checks consent, so this is not cosmetic. Deletion is final and confirmed.
function renderVoiceActions(voice) {
  const wrap = document.createElement('div');
  wrap.className = 'actions row';
  wrap.dataset.voiceActions = voice.id;
  const revoked = voice.status === 'revoked';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.dataset.action = revoked ? 'restore-voice' : 'revoke-voice';
  toggle.textContent = revoked ? '恢复授权' : '撤销授权';
  toggle.onclick = async () => {
    if (!revoked && !confirm(`撤销「${voice.name}」的授权？撤销后立刻不能再合成这个声音，样本保留到声音本人决定删除。`)) return;
    try {
      const response = await libraryFetch(`/api/voices/${encodeURIComponent(voice.id)}/${revoked ? 'restore' : 'revoke'}`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `声音库返回 ${response.status}`);
      if (!revoked && activeVoice?.id === voice.id) activeVoice = null;
      await loadVoices();
      status(revoked ? `已恢复「${voice.name}」的授权` : `已撤销「${voice.name}」的授权，合成立即停止`);
    } catch (error) {
      status(`操作失败：${error.message}`, 'error');
    }
  };
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'ghost';
  remove.dataset.action = 'delete-voice';
  remove.textContent = '删除样本';
  remove.onclick = async () => {
    if (!confirm(`永久删除「${voice.name}」的样本、授权记录和音色参数？此操作不可恢复。\n请确认这是声音本人的决定。`)) return;
    try {
      const response = await libraryFetch(`/api/voices/${encodeURIComponent(voice.id)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `声音库返回 ${response.status}`);
      if (activeVoice?.id === voice.id) activeVoice = null;
      await loadVoices();
      status(`已删除「${voice.name}」的样本与授权记录`);
    } catch (error) {
      status(`删除失败：${error.message}`, 'error');
    }
  };
  wrap.append(toggle, remove);
  return wrap;
}

function refreshVoiceScreens() {
  const engineSelect = $('voiceEngineSelect');
  const definition = piperPack();
  const voiceName = activePiperVoiceId === 'demo' ? '示范声音' : (piperVoiceById(activePiperVoiceId)?.name || '训练声音');
  const piperLabel = currentPiperRuntime()?.loaded
    ? `${definition.name}（${definition.requiresEmbedding ? voiceName : '单声线'}）`
    : `${definition.name}（首次需下载）`;
  const kokoroLabel = kokoroRuntime?.loaded
    ? `${KOKORO.name}（${kokoroVoiceName(settings.kokoro.voiceId)}）`
    : `${KOKORO.name}（首次需下载）`;
  const zipLabel = zipVoices.length
    ? `${ZIPVOICE.name}（${zipVoiceLabel(zipVoiceById(settings.zipvoice.voiceId))}）`
    : `${ZIPVOICE.name}（需先保存参考声音）`;
  const options = [
    ['browser', '本机浏览器语音（离线、不上传）'],
    ['kokoro', `开源自然中文：${kokoroLabel}`],
    ['piper', `Piper 神经语音：${piperLabel}`],
    ['zipvoice', `高音质克隆：${zipLabel}`],
    ['library', activeVoice ? `家庭授权声音：${activeVoice.name}` : '家庭授权声音（未选择）'],
  ];
  engineSelect.replaceChildren(...options.map(([value, label]) => new Option(label, value, false, settings.engine === value)));
  const select = $('engineSelect');
  select.replaceChildren(...options.map(([value, label]) => new Option(label, value, false, settings.engine === value)));
  renderPrivacyStats();
}

function renderPrivacyStats() {
  const stats = settings.statistics;
  const today = new Date().toISOString().slice(0, 10);
  $('listenStats').textContent = `今日已听 ${formatMilliseconds(stats.days[today] || 0)} · 累计 ${formatMilliseconds(stats.listenedMs || 0)}`;
  const el = $('privacyStats');
  if (!el) return;
  el.replaceChildren();
  const lines = [
    `今日朗读 ${formatMilliseconds(stats.days[today] || 0)}，累计 ${formatMilliseconds(stats.listenedMs || 0)}。`,
    kokoroRuntime?.loaded
      ? `${KOKORO.name} 自然中文：模型与文本都在本机，首次下载后由浏览器缓存，不产生按次费用。`
      : `${KOKORO.name} 尚未加载；加载后模型与文本都在本机。`,
    currentPiperRuntime()?.loaded
      ? `${piperPack().name} 开源神经语音：模型与文本都在本机，首次下载后由浏览器缓存，不产生按次费用。`
      : `${piperPack().name} 尚未加载；加载后模型与文本都在本机。`,
    zipvoiceRuntime?.loaded
      ? `${ZIPVOICE.name}：参考录音、逐字稿和文本都在本机；模型权重为非商用授权。`
      : `${ZIPVOICE.name} 尚未加载；参考录音只在本机。`,
    libraryConfigured() ? `家庭声音库：${settings.library.baseUrl}（仅发送当前朗读文本与声音 id）。` : '家庭声音库未连接。',
  ];
  lines.forEach(line => { const p = document.createElement('p'); p.textContent = line; el.append(p); });
}

function updateEngineControls() {
  refreshVoiceScreens();
  refreshEngineBadge();
  const browser = $('browserVoice');
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  browser.replaceChildren(...voices.map(voice => new Option(`${voice.name} · ${voice.lang}`, voice.voiceURI, false, voice.voiceURI === settings.browserVoiceURI)));
  $('fieldBrowserVoice').hidden = settings.engine !== 'browser';
  refreshPiperPackUI();
  renderPiperVoiceSelect();
  renderKokoroVoiceSelect();
  renderZipVoiceSelect();
  $('rate').value = String(settings.rate);
  $('libraryUrl').value = settings.library.baseUrl;
  $('libraryToken').value = settings.library.token ? '••••••••' : '';
  $('ducking').checked = settings.music.ducking;
  $('musicVolume').value = String(settings.music.volume);
}

function switchEngine(kind) {
  settings.engine = kind;
  saveSettings();
  currentEngine = null;
  updateEngineControls();
  refreshEngineBadge();
  if (kind === 'kokoro' && !kokoroRuntime?.loaded) loadKokoroModel();
  if (kind === 'zipvoice') {
    if (!zipVoiceById(settings.zipvoice.voiceId)) status('高音质克隆需要先保存一段参考声音和逐字稿。', 'warn');
    else if (!zipvoiceRuntime?.loaded) loadZipVoiceModel();
  }
  if (kind === 'piper') {
    const definition = piperPack();
    if (definition.requiresEmbedding && !activePiperEmbedding) status('神经声音还没有可用特征；请加载示范声音或训练自己的声音。', 'warn');
    if (!currentPiperRuntime()?.loaded) loadPiperModel(definition.id);
  }
  if (kind === 'library' && !activeVoice) status('还没有选择家庭授权声音，请到「声音」页选择或录制。', 'warn');
}

async function loadVoices() {
  if (!libraryConfigured()) { renderVoiceList(); return; }
  renderVoiceList('正在读取声音库…');
  try {
    const response = await libraryFetch('/api/voices');
    if (!response.ok) throw new Error(`声音库返回 ${response.status}`);
    const data = await response.json();
    voices = Array.isArray(data) ? data : data.voices || [];
    const list = $('voiceList');
    list.replaceChildren();
    if (!voices.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = '声音库里还没有家庭声音。可以按下面的步骤录制，并请声音本人确认授权。';
      list.append(empty);
    }
    for (const voice of voices) list.append(voiceCard(voice));
    restoreVoice();
    status(`声音库已连接：${voices.length} 个声音`);
  } catch (error) {
    renderVoiceList(`读取声音库失败：${error.message}`);
  }
}

// --------------------------------------------------------------------------
// Consent-gated family voice capture (three prompts, MediaRecorder)
// --------------------------------------------------------------------------
const RECORD_PROMPTS = [
  '今天天气很好，我们一起读一段故事吧。从前有一座小小的房子，住着一位爱看书的女孩。',
  '晚饭后，窗外的树叶沙沙作响。她说：“明天我想去图书馆，再借一本讲星星的书。”',
  '好啦，这就是今天的故事。闭上眼睛，慢慢呼吸，我们明天继续读下去。晚安。',
];
const recordedSamples = [];
let recorder = null;
let recordChunks = [];

function updateConsentState() {
  const allowed = $('consentCheck').checked && $('consentName').value.trim().length > 0;
  $('startRecording').disabled = !allowed;
  $('recordStatus').textContent = allowed ? '' : '填写称呼并勾选授权声明后才能录制。';
}

function showRecordingArea() {
  $('recordArea').hidden = false;
  $('recordDone').hidden = true;
  $('recordIndex').textContent = String(Math.min(RECORD_PROMPTS.length, recordedSamples.length + 1));
  $('recordPrompt').textContent = RECORD_PROMPTS[Math.min(RECORD_PROMPTS.length - 1, recordedSamples.length)];
  $('recordSample').textContent = recorder && recorder.state === 'recording'
    ? '停止录制'
    : `开始 / 停止录制第 ${Math.min(RECORD_PROMPTS.length, recordedSamples.length + 1)} 段`;
}

async function toggleRecording() {
  if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    $('recordStatus').textContent = '当前浏览器不支持录音，请使用最新版 Chrome、Safari 或 Edge。';
    return;
  }
  try {
    // A secure origin is required for microphone access: a plain-http host
    // other than localhost resolves getUserMedia to `undefined`, which would
    // otherwise be reported as a vague "not supported" message.
    if (!window.isSecureContext) throw new Error('麦克风只能在 HTTPS 或 localhost 下使用，请换成 https 地址再试。');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    recordChunks = [];
    recorder = new MediaRecorder(stream);
    // Without a recorder-level handler an encoding failure would leave the
    // microphone open for the rest of the session.
    recorder.onerror = event => {
      stream.getTracks().forEach(track => track.stop());
      recorder = null;
      $('recordStatus').textContent = `录音中断：${event.error?.message || event.error || '未知错误'}`;
    };
    recorder.ondataavailable = event => { if (event.data.size) recordChunks.push(event.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(recordChunks, { type: recorder.mimeType || 'audio/webm' });
      recordedSamples.push(blob);
      const preview = $('recordPreview');
      if (preview.dataset.url) URL.revokeObjectURL(preview.dataset.url);
      preview.dataset.url = URL.createObjectURL(blob);
      preview.src = preview.dataset.url;
      preview.hidden = false;
      $('recordStatus').textContent = `第 ${recordedSamples.length} 段已录好，请回放确认是不是本人的声音。`;
      recorder = null;
      if (recordedSamples.length >= RECORD_PROMPTS.length) {
        $('recordArea').hidden = true;
        $('recordDone').hidden = false;
      } else {
        showRecordingArea();
      }
    };
    recorder.start();
    $('recordStatus').textContent = '录音中……请照着屏幕上的文字朗读。';
    showRecordingArea();
  } catch (error) {
    $('recordStatus').textContent = `无法开始录音：${error.message}`;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function uploadVoice() {
  if (!libraryConfigured()) { $('uploadResult').textContent = '请先在上方填写并保存声音库地址。'; return; }
  if ($('consentCheck').checked !== true) { $('uploadResult').textContent = '需要声音本人的授权声明才能上传。'; return; }
  const speaker = $('consentName').value.trim();
  if (!speaker) { $('uploadResult').textContent = '请填写声音本人的称呼。'; return; }
  if (recordedSamples.length < RECORD_PROMPTS.length) { $('uploadResult').textContent = '请先完成三段录音。'; return; }
  $('uploadResult').textContent = '正在上传……';
  try {
    const samples = [];
    for (const sample of recordedSamples) samples.push(await blobToBase64(sample));
    const response = await libraryFetch('/api/voices', {
      method: 'POST',
      body: JSON.stringify({
        name: $('voiceName').value.trim() || `${speaker}的声音`,
        speaker,
        relation: $('consentRelation').value.trim(),
        consent: {
          granted: true,
          statement: '本人授权本系统使用这段声音样本进行语音合成与试听，并可随时撤销授权与删除样本。',
          grantedAt: now(),
          consentPage: `${settings.library.baseUrl.replace(/\/+$/, '')}/consent`,
        },
        samples,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `声音库返回 ${response.status}`);
    $('uploadResult').textContent = `已上传。声音 id：${data.id}。声音本人可随时在声音库的授权页面撤销授权或删除样本。`;
    recordedSamples.length = 0;
    $('recordDone').hidden = true;
    $('recordPreview').hidden = true;
    await loadVoices();
  } catch (error) {
    $('uploadResult').textContent = `上传失败：${error.message}`;
  }
}

// --------------------------------------------------------------------------
// Screens & boot
// --------------------------------------------------------------------------
function showScreen(name) {
  document.querySelectorAll('section[data-screen]').forEach(section => {
    section.hidden = section.dataset.screen !== name;
  });
  document.querySelectorAll('header [data-nav]').forEach(button => {
    if (button.dataset.nav === name) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (name === 'voices') {
    renderVoiceList();
    renderPiperVoiceList();
    renderPiperVoiceSelect();
  }
  if (name === 'library' && !libraryResults.length && !libraryLoading) searchLibrary('');
  if (name === 'world') renderWorld();
}

function wireEvents() {
  document.querySelectorAll('header [data-nav]').forEach(button => {
    button.onclick = () => showScreen(button.dataset.nav);
  });
  $('toVoices').onclick = () => showScreen('voices');
  $('importButton').onclick = () => $('files').click();
  $('emptyImport').onclick = () => $('files').click();
  $('emptyTrySample').onclick = () => trySampleBook();
  $('emptyLibrary').onclick = () => $('libraryCatalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('files').onchange = async event => {
    const files = [...event.target.files];
    event.target.value = '';
    if (files.length) await importFiles(files);
  };
  $('shelfSearch').oninput = () => renderShelf();
  $('backToShelf').onclick = async () => { showScreen('library'); await refreshShelf(); };

  $('playButton').onclick = toggleFromKeyboard;
  $('readParagraph').onclick = () => startScope('paragraph');
  $('readWholeBook').onclick = () => startScope('book');
  $('tocToggle').onclick = () => {
    renderChapterList();
    $('tocDialog').showModal();
  };
  $('prevPara').onclick = () => skip('prevParagraph');
  $('nextPara').onclick = () => skip('nextParagraph');
  $('prevChapter').onclick = () => (bookModel ? skip('prevChapter') : status('先打开一本书。', 'warn'));
  $('nextChapter').onclick = () => (bookModel ? skip('nextChapter') : status('先打开一本书。', 'warn'));
  $('prevPage').onclick = () => page(-1);
  $('nextPage').onclick = () => page(1);

  $('engineSelect').onchange = event => switchEngine(event.target.value);
  $('voiceEngineSelect').onchange = event => switchEngine(event.target.value);
  $('browserVoice').onchange = event => {
    settings.browserVoiceURI = event.target.value;
    saveSettings();
    currentEngine = null;
    refreshEngineBadge();
  };
  $('rate').oninput = event => {
    settings.rate = Number(event.target.value) || 1;
    saveSettings();
    currentEngine = null;
  };
  $('saveLibrary').onclick = async () => {
    settings.library = {
      baseUrl: $('libraryUrl').value.trim().replace(/\/+$/, ''),
      token: $('libraryToken').value.startsWith('•') ? settings.library.token : $('libraryToken').value.trim(),
    };
    saveSettings();
    updateEngineControls();
    await loadVoices();
  };
  $('refreshVoices').onclick = () => loadVoices();
  $('testVoice').onclick = async () => {
    const engine = buildEngine();
    if (!engine) { $('testVoiceResult').textContent = '没有可用的引擎。'; return; }
    $('testVoiceResult').textContent = '正在试听…';
    try {
      await engine.speak('你好，我在这里陪着你读书。今天想听哪一段？');
      $('testVoiceResult').textContent = `试听完成（${engine.name || engine.kind}）`;
    } catch (error) {
      $('testVoiceResult').textContent = `试听失败：${error.message}`;
    }
  };

  $('kokoroLoad').onclick = () => loadKokoroModel();
  $('kokoroTest').onclick = () => previewKokoro();
  $('kokoroVoiceSelect').onchange = event => {
    settings.kokoro.voiceId = event.target.value;
    saveSettings();
    renderKokoroVoiceSelect();
    currentEngine = null;
    refreshEngineBadge();
    status(`已选择 ${kokoroVoiceName(event.target.value)}`);
  };
  $('readerKokoroVoiceSelect').onchange = event => {
    settings.kokoro.voiceId = event.target.value;
    saveSettings();
    renderKokoroVoiceSelect();
    switchEngine('kokoro');
    status(`已选择 ${kokoroVoiceName(event.target.value)}`);
  };
  $('zipvoiceLoad').onclick = () => loadZipVoiceModel();
  $('zipvoiceTest').onclick = () => previewZipVoice();
  $('zipvoiceDeleteVoice').onclick = () => deleteActiveZipVoice();
  $('zipvoiceVoiceSelect').onchange = event => {
    setActiveZipVoice(event.target.value);
    switchEngine('zipvoice');
    status(`已选择 ${zipVoiceLabel(zipVoiceById(event.target.value))}`);
  };
  $('readerZipVoiceSelect').onchange = event => {
    setActiveZipVoice(event.target.value);
    switchEngine('zipvoice');
    status(`已选择 ${zipVoiceLabel(zipVoiceById(event.target.value))}`);
  };
  $('zipvoiceRefFile').onchange = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) setZipVoiceReference(file, '参考声音文件');
  };
  $('zipvoiceRecord').onclick = () => toggleZipVoiceRecording();
  $('zipvoiceTrain').onclick = () => trainZipVoice();
  $('zipvoiceConsent').onchange = updateZipVoiceTrainState;
  $('zipvoiceSpeaker').oninput = updateZipVoiceTrainState;
  $('zipvoiceTranscript').oninput = updateZipVoiceTrainState;
  $('piperLoad').onclick = () => loadPiperModel();
  $('toPiperTraining').onclick = () => $('piperTraining').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('piperPackSelect').onchange = event => {
    settings.piper.pack = event.target.value;
    settings.engine = 'piper';
    saveSettings();
    currentEngine = null;
    refreshPiperPackUI();
    refreshVoiceScreens();
    refreshEngineBadge();
    renderReadiness();
    status(`已选择${piperPack().name}，正在准备离线声音…`);
    loadPiperModel(settings.piper.pack);
  };
  $('piperTest').onclick = () => previewPiper();
  $('piperVoiceSelect').onchange = event => {
    setActivePiperVoice(event.target.value);
    switchEngine('piper');
    status(event.target.value === 'demo' ? '已选择示范神经声音' : '已选择本机训练声音');
  };
  $('readerPiperVoiceSelect').onchange = event => {
    setActivePiperVoice(event.target.value);
    switchEngine('piper');
    status(event.target.value === 'demo' ? '已选择示范神经声音' : '已选择本机训练声音');
  };
  $('piperConsent').onchange = updatePiperTrainState;
  $('piperSpeaker').oninput = updatePiperTrainState;
  $('piperRefFile').onchange = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) setPiperReference(file, '参考声音文件');
  };
  $('piperRecord').onclick = () => togglePiperRecording();
  $('piperTrain').onclick = () => trainPiperVoice();
  $('piperDeleteVoice').onclick = () => deleteActivePiperVoice();

  $('librarySearchForm').onsubmit = event => {
    event.preventDefault();
    clearTimeout(librarySearchTimer);
    searchLibrary($('librarySearch').value.trim());
  };
  $('librarySearch').oninput = () => {
    clearTimeout(librarySearchTimer);
    librarySearchTimer = setTimeout(() => searchLibrary($('librarySearch').value.trim()), 450);
  };
  $('librarySelectAll').onchange = event => setLibrarySelection(event.target.checked);
  $('batchEpub').onclick = () => batchImportLibrary('epub');
  $('batchAzw3').onclick = () => batchImportLibrary('azw3');

  $('musicFile').onchange = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) { status('请选择音频文件。', 'warn'); return; }
    await store.putBlob('background-music', file, { name: file.name });
    localStorage.setItem('rw03-music-name', file.name);
    setMusicSource(file, file.name);
    status(`已设为背景音乐：${file.name}`);
  };
  $('clearMusic').onclick = async () => {
    $('music').pause();
    $('music').removeAttribute('src');
    if ($('music').dataset.url) URL.revokeObjectURL($('music').dataset.url);
    delete $('music').dataset.url;
    await store.deleteBlob('background-music');
    localStorage.removeItem('rw03-music-name');
    $('musicName').textContent = '尚未添加背景音乐';
    $('clearMusic').hidden = true;
    status('已移除背景音乐');
  };
  $('musicPlay').onclick = () => {
    const audio = $('music');
    if (!audio.src) { status('先添加一个音频文件作为背景音乐。', 'warn'); return; }
    if (audio.paused) audio.play().catch(error => status(`无法播放背景音乐：${error.message}`, 'warn'));
    else audio.pause();
    $('musicPlay').textContent = audio.paused ? '播放背景音' : '暂停背景音';
  };
  $('musicVolume').oninput = () => {
    settings.music.volume = Number($('musicVolume').value) || 0;
    saveSettings();
    syncDucking();
  };
  $('ducking').onchange = () => {
    settings.music.ducking = $('ducking').checked;
    saveSettings();
    syncDucking();
  };

  $('saveNote').onclick = async () => {
    if (!bookModel) { status('先打开一本书再写笔记。', 'warn'); return; }
    const text = $('noteText').value;
    if (!text.trim()) { status('写点什么再保存吧。', 'warn'); return; }
    await saveNote({ text, quote: currentParagraphText().slice(0, 160) });
    $('noteText').value = '';
  };
  $('consentCheck').onchange = updateConsentState;
  $('consentName').oninput = updateConsentState;
  $('startRecording').onclick = () => {
    recordedSamples.length = 0;
    $('recordDone').hidden = true;
    showRecordingArea();
  };
  $('recordSample').onclick = () => toggleRecording();
  $('cancelRecording').onclick = () => {
    if (recorder && recorder.state === 'recording') recorder.stop();
    recordedSamples.length = 0;
    $('recordArea').hidden = true;
    $('recordStatus').textContent = '已取消录制，本机不会保留这次的声音。';
  };
  $('uploadVoice').onclick = () => uploadVoice();

  $('worldPlayButton').onclick = () => {
    if (!worldRecommended || worldRecommended.kind === 'none') { status(worldRecommended?.reason || '当前没有可播放的内容。', 'warn'); return; }
    playWorld(worldRecommended.item);
  };

  window.speechSynthesis?.addEventListener?.('voiceschanged', () => { updateEngineControls(); renderReadiness(); });
  document.addEventListener('pointerdown', () => { primePiperAudio(); primeKokoroAudio(); primeZipVoiceAudio(); }, { once: true, passive: true });
  document.addEventListener('keydown', event => {
    if (event.target.matches?.('input,textarea,select')) return;
    if (!$('screen-reader').hidden && event.code === 'Space') { event.preventDefault(); toggleFromKeyboard(); }
  });
  window.addEventListener('beforeunload', () => { narration?.stop({ keepPosition: false }); });
}

async function init() {
  wireEvents();
  updateConsentState();
  showScreen('library');
  await store.openReaderDb();
  await loadPiperDemoVoice();
  await loadPiperVoices();
  await loadZipVoices();
  await refreshShelf();
  await restoreMusic();
  updateEngineControls();
  renderStats();
  renderPiperVoiceList();
  renderPiperVoiceSelect();
  renderWorld();
  renderVoiceList();
  renderReadiness();
  $('importButton').disabled = false;
  if (libraryConfigured()) loadVoices();
  status(books.length
    ? '书架已就绪。点「听书」就能从上次的位置连续朗读；进度只保存在本机。'
    : '书架还空着。导入 EPUB / TXT / AZW3 / MOBI / FB2 / CBZ，或到公版书库挑一本；也可以先用示范书试试。');
}

init().catch(error => {
  console.error(error);
  status(`启动失败：${error.message}。请刷新页面重试。`, 'error');
});

// Test hook for the end-to-end browser check: exposes the narration core so a
// spec can assert on the real cursor instead of scraping the DOM.
if (params.get('testHooks') === '1') {
  window.__rw03 = {
    engineState: () => narration?.state ?? State.IDLE,
    cursor: () => ({ chapter: narration?.chapter ?? 0, paragraph: narration?.paragraph ?? 0 }),
    title: () => bookModel?.title ?? '',
    chapters: () => bookModel?.chapters.length ?? 0,
    startedAt: () => narration?.startedAt ?? 0,
    kokoro: () => ({
      loaded: Boolean(kokoroRuntime?.loaded),
      voiceId: settings.kokoro.voiceId,
      voices: KOKORO_VOICES.length,
    }),
    zipvoice: () => ({
      loaded: Boolean(zipvoiceRuntime?.loaded),
      voiceId: settings.zipvoice.voiceId,
      voices: zipVoices.length,
    }),
    piper: () => ({
      loaded: Boolean(currentPiperRuntime()?.loaded),
      trainingReady: Boolean(piperRuntimes.get('zs')?.trainingReady),
      pack: settings.piper.pack,
      voiceId: activePiperVoiceId,
      hasEmbedding: Boolean(activePiperEmbedding),
      voices: piperVoices.length,
    }),
    library: () => ({ results: libraryResults.length, loading: libraryLoading, selected: librarySelection.size }),
    sync: () => lastSync,
    syncVisible: () => {
      let active = null;
      let rect = null;
      if (foliateView) {
        const content = foliateView.renderer?.getContents?.()[0];
        active = content?.doc?.querySelector('.rw-active');
        if (!active) return false;
        const own = active.getBoundingClientRect();
        const frame = content.doc.defaultView?.frameElement?.getBoundingClientRect();
        rect = frame
          ? { left: own.left + frame.left, right: own.right + frame.left, top: own.top + frame.top, bottom: own.bottom + frame.top }
          : own;
      } else {
        active = $('txtPage')?.querySelector('p.active');
        if (!active) return false;
        rect = active.getBoundingClientRect();
      }
      const stage = $('readerStage')?.getBoundingClientRect();
      return Boolean(stage && rect
        && rect.right > stage.left && rect.left < stage.right
        && rect.bottom > stage.top && rect.top < stage.bottom);
    },
    scope: () => narration?.endAt ?? null,
  };
}


// --------------------------------------------------------------------------
// 听世界
// --------------------------------------------------------------------------
let worldSources = BUILTIN_SOURCES.map(source => ({ ...source }));
let worldFilter = 'all';
let worldRecommended = null;

function renderWorld() {
  const daypart = resolveDaypart();
  $('daypartLabel').textContent = { night: '· 深夜', day: '· 白天', evening: '· 傍晚' }[daypart] || '';
  worldRecommended = resolvePlaylist({ sources: worldSources, daypart, mode: 'auto' });
  $('worldNow').textContent = worldRecommended.kind === 'none'
    ? worldRecommended.reason
    : `${worldRecommended.item.title} — ${worldRecommended.item.attribution}`;
  const filters = ['all', 'radio', 'podcast', 'ambience'];
  const labels = { all: '全部', radio: '电台', podcast: '播客', ambience: '环境声' };
  const bar = $('worldFilters');
  bar.replaceChildren(...filters.map(kind => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = labels[kind];
    button.setAttribute('aria-pressed', String(worldFilter === kind));
    button.onclick = () => { worldFilter = kind; renderWorld(); };
    return button;
  }));
  const list = $('worldList');
  list.replaceChildren();
  for (const source of worldSources.filter(item => worldFilter === 'all' || item.kind === worldFilter)) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '.8rem';
    const h = document.createElement('h3');
    h.textContent = source.title;
    const meta = document.createElement('div');
    meta.className = 'muted';
    meta.textContent = [labels[source.kind] || source.kind, source.attribution, source.license === 'placeholder' ? '待接入持权内容' : ''].filter(Boolean).join(' · ');
    const actions = document.createElement('div');
    actions.className = 'row';
    actions.style.marginTop = '.5rem';
    const favourite = document.createElement('button');
    favourite.type = 'button';
    favourite.textContent = settings.worldFavourites.includes(source.id) ? '★ 已收藏' : '☆ 收藏';
    favourite.setAttribute('aria-pressed', String(settings.worldFavourites.includes(source.id)));
    favourite.onclick = () => {
      settings.worldFavourites = settings.worldFavourites.includes(source.id)
        ? settings.worldFavourites.filter(id => id !== source.id)
        : [...settings.worldFavourites, source.id];
      saveSettings();
      renderWorld();
    };
    actions.append(favourite);
    if (source.url) {
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'primary';
      play.textContent = '播放';
      play.onclick = () => playWorld(source);
      actions.append(play);
    }
    if (source.homepage) {
      const home = document.createElement('a');
      home.href = source.homepage;
      home.target = '_blank';
      home.rel = 'noreferrer';
      home.textContent = '官方页面';
      home.style.alignSelf = 'center';
      actions.append(home);
    }
    card.append(h, meta, actions);
    list.append(card);
  }
  $('worldAudio').onvolumechange = () => {
    if (narration?.state === State.SPEAKING) $('worldAudio').volume = Math.min($('worldAudio').volume, 0.25);
  };
}

function playWorld(source) {
  const audio = $('worldAudio');
  if (!source.url) { status('这条内容还没有接入持权节目。', 'warn'); return; }
  audio.src = source.url;
  audio.play().catch(error => status(`无法播放：${error.message}。部分电台禁止跨站播放，可打开官方页面收听。`, 'warn'));
  status(`正在播放：${source.title}`);
}

