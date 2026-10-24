import { makeBook } from './vendor/foliate-js/view.js';
import { Narrator, sliceParagraphs, estimateMinutes, isBodyText } from './reader/narrator.js';
import {
  openDatabase, Store, STORES, readingPosition, saveReadingPosition, clearReadingPosition,
  loadBookmarks, saveBookmarks, loadReadingSettings, saveReadingSettings,
  loadAmbientPrefs, saveAmbientPrefs, duckingEnabled, setDucking,
  summarizeDays, localDay, eraseEverything,
} from './reader/storage.js';
import { SCENES, AmbientMixer } from './reader/ambient.js';
import { splitTxtChapters, txtParagraphs, htmlToParagraphs, makeNote, noteMatches, formatDuration } from './reader/text.js';
import {
  CONSENT_ITEMS, CONSENT_VERSION, validateConsent, sampleProblem, analyzePcm,
  makeVoiceRecord, revokeVoice, canUseVoice, describeVoice,
} from './reader/voices.js';

const $ = id => document.getElementById(id);
const synth = window.speechSynthesis;
const SUPPORTED = ['epub', 'mobi', 'azw3', 'fb2', 'cbz', 'txt'];
const setStatus = (msg, isError = false) => {
  $('status').textContent = msg;
  $('status').classList.toggle('error', !!isError);
};

let db = null;
let books = [];
let notesCache = [];
const settings = Object.assign(
  { voiceURI: '', rate: 1, autoContinue: true, fontSize: 19, leading: 2 },
  loadReadingSettings(),
);
let filter = 'all';
let draftQuote = null;
let editingNoteId = null;
const ambient = new AmbientMixer();

const store = name => new Store(db, name);
const notesStore = () => store(STORES.notes);
const statsStore = () => store(STORES.stats);
const voicesStore = () => store(STORES.voices);

// ---------- 通用 ----------
function confirmDialog(title, text, okText = '确定') {
  return new Promise(resolve => {
    const dlg = $('confirmDialog');
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    $('confirmYes').textContent = okText;
    const finish = value => {
      $('confirmYes').removeEventListener('click', yes);
      $('confirmNo').removeEventListener('click', no);
      if (dlg.open) dlg.close();
      resolve(value);
    };
    const yes = () => finish(true);
    const no = () => finish(false);
    $('confirmYes').addEventListener('click', yes);
    $('confirmNo').addEventListener('click', no);
    dlg.showModal();
  });
}

async function loadLibrary() {
  books = (await store(STORES.books).all()).filter(b => b && b.blob).sort((a, b) => {
    const ap = readingPosition(a.id), bp = readingPosition(b.id);
    if (Boolean(ap) !== Boolean(bp)) return bp ? 1 : -1;
    return (bp?.lastReadAt || Date.parse(b.added || 0) || 0) - (ap?.lastReadAt || Date.parse(a.added || 0) || 0);
  });
  notesCache = await notesStore().all();
}

const formatOf = book => String(book.format || book.filename?.split('.').pop() || '').toLowerCase();

function progressText(saved) {
  if (!saved) return '尚未开始';
  if (saved.finished) return '已读完';
  if (saved.chapterTitle) return saved.chapterTitle;
  if (saved.label) return saved.label;
  if (saved.fraction != null) return `约 ${Math.round(saved.fraction * 100)}%`;
  return '已有进度';
}

const progressFraction = saved => {
  if (!saved) return 0;
  if (saved.finished) return 1;
  const f = Number(saved.fraction);
  return Number.isFinite(f) ? Math.max(0, Math.min(1, f)) : 0;
};

// ---------- 书架 ----------
let coverURLs = [];
function releaseCovers() {
  coverURLs.forEach(u => URL.revokeObjectURL(u));
  coverURLs = [];
}

function makeCover(book, title) {
  const cover = document.createElement('div');
  cover.className = 'cover';
  cover.setAttribute('role', 'button');
  cover.tabIndex = 0;
  cover.setAttribute('aria-label', `打开《${title}》`);
  if (book.cover instanceof Blob && book.cover.size) {
    const url = URL.createObjectURL(book.cover);
    coverURLs.push(url);
    cover.classList.add('has-image');
    const img = document.createElement('img');
    img.src = url; img.alt = ''; img.loading = 'lazy';
    cover.append(img);
  } else {
    const g = document.createElement('span'); g.className = 'glyph'; g.textContent = title;
    const f = document.createElement('span'); f.className = 'fmt'; f.textContent = formatOf(book).toUpperCase();
    cover.append(g, f);
  }
  if (readingPosition(book.id)?.finished) {
    const b = document.createElement('span'); b.className = 'badge'; b.textContent = '读完';
    cover.append(b);
  }
  cover.onclick = () => openBook(book);
  cover.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(book); } };
  return cover;
}

function bookCard(book) {
  const saved = readingPosition(book.id);
  const title = book.title || book.filename || '未命名';
  const el = document.createElement('article');
  el.className = 'book';
  el.dataset.bookId = book.id;
  const meta = document.createElement('div');
  meta.className = 'book-meta';
  const strong = document.createElement('strong'); strong.textContent = title;
  const sub = document.createElement('small');
  sub.textContent = [book.author, formatOf(book).toUpperCase()].filter(Boolean).join(' · ');
  const prog = document.createElement('small');
  prog.dataset.role = 'progress';
  prog.textContent = progressText(saved);
  const line = document.createElement('div'); line.className = 'progress-line';
  const fill = document.createElement('i'); fill.style.width = `${Math.round(progressFraction(saved) * 100)}%`;
  line.append(fill);
  const actions = document.createElement('div');
  actions.className = 'book-actions';
  const read = document.createElement('button'); read.type = 'button'; read.dataset.action = 'open';
  read.textContent = saved ? '继续' : '阅读';
  read.onclick = e => { e.stopPropagation(); openBook(book); };
  const reset = document.createElement('button'); reset.type = 'button'; reset.dataset.action = 'reset';
  reset.textContent = '从头'; reset.hidden = !saved;
  reset.onclick = e => { e.stopPropagation(); resetProgress(book); };
  const del = document.createElement('button'); del.type = 'button'; del.dataset.action = 'delete';
  del.textContent = '删除';
  del.onclick = e => { e.stopPropagation(); removeBook(book); };
  actions.append(read, reset, del);
  meta.append(strong, sub, prog, line, actions);
  el.append(makeCover(book, title), meta);
  return el;
}

function matchFilter(book) {
  if (filter === 'reading') return Boolean(readingPosition(book.id)) && !readingPosition(book.id).finished;
  if (filter === 'finished') return Boolean(readingPosition(book.id)?.finished);
  return true;
}

function renderShelf() {
  const query = $('shelfSearch').value.trim().toLocaleLowerCase('zh-CN');
  releaseCovers();
  const visible = books.filter(b => matchFilter(b) && (!query || `${b.title || ''} ${b.author || ''} ${b.filename || ''} ${formatOf(b)}`.toLocaleLowerCase('zh-CN').includes(query)));
  $('shelf').replaceChildren(...visible.map(bookCard));
  $('shelfSummary').textContent = `共 ${visible.length} 本 · 笔记 ${notesCache.length} 条`;
  if (!books.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '书架还是空的。点右上角「＋ 添加书籍」导入 EPUB / TXT，或先加入内置试读书。';
    $('shelf').replaceChildren(empty);
  } else if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = query ? `没有找到“${$('shelfSearch').value.trim()}”` : '这个筛选下还没有书。';
    $('shelf').replaceChildren(empty);
  }
  renderContinue();
}

function renderContinue() {
  const slot = $('continueSlot');
  slot.replaceChildren();
  const last = books
    .map(b => ({ b, saved: readingPosition(b.id) }))
    .filter(x => x.saved)
    .sort((a, b) => (b.saved.lastReadAt || 0) - (a.saved.lastReadAt || 0))[0];
  if (!last) return;
  const done = Boolean(last.saved.finished);
  const card = bookCard(last.b);
  card.className = 'continue-card';
  const body = document.createElement('div');
  body.className = 'body';
  const head = document.createElement('div');
  head.className = 'muted';
  head.textContent = done
    ? `已读完 · 上次 ${new Date(last.saved.lastReadAt || Date.now()).toLocaleString('zh-CN')}`
    : `上次 ${new Date(last.saved.lastReadAt || Date.now()).toLocaleString('zh-CN')} · ${progressText(last.saved)}`;
  const title = document.createElement('h3');
  title.textContent = last.b.title || last.b.filename;
  const cta = document.createElement('button');
  cta.className = 'primary';
  cta.textContent = done ? '再读一遍' : '继续阅读';
  cta.onclick = () => (done ? restartReading(last.b) : openBook(last.b));
  body.append(head, title, cta);
  card.querySelector('.book-meta').replaceWith(body);
  slot.append(card);
}

async function resetProgress(book) {
  const title = book.title || book.filename;
  if (!(await confirmDialog('从头开始', `清除《${title}》的阅读位置和朗读进度？书签与笔记会保留。`, '清除进度'))) return;
  clearReadingPosition(book.id);
  renderShelf();
  setStatus(`已清除《${title}》的进度`);
}

async function removeBook(book) {
  const title = book.title || book.filename;
  const count = notesCache.filter(n => n.bookId === book.id).length;
  if (!(await confirmDialog('从书架删除', `删除《${title}》？${count ? `这本书的 ${count} 条笔记也会一起删除。` : ''}`, '删除'))) return;
  await store(STORES.books).delete(book.id);
  for (const n of notesCache.filter(n => n.bookId === book.id)) await notesStore().delete(n.id);
  clearReadingPosition(book.id);
  try { localStorage.removeItem('reader-bookmarks-' + book.id); } catch { /* ignore */ }
  await statsStore().delete(book.id);
  await loadLibrary();
  renderShelf();
  setStatus(`已删除《${title}》`);
}

// ---------- 导入 ----------
function metadataText(v) {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(metadataText).find(Boolean) || '';
  if (v && typeof v === 'object') return Object.values(v).map(metadataText).find(Boolean) || '';
  return '';
}

async function fingerprint(file) {
  if (!globalThis.crypto?.subtle) return `${file.name}:${file.size}:${file.lastModified}`;
  const bytes = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function inspectBook(file) {
  let parsed;
  try {
    parsed = await makeBook(file);
    const cover = await parsed.getCover?.();
    return {
      title: metadataText(parsed.metadata?.title),
      author: metadataText(parsed.metadata?.author),
      cover: cover instanceof Blob && cover.size ? cover : null,
    };
  } catch (err) {
    console.warn('无法预读书籍元数据', err);
    return {};
  } finally {
    parsed?.destroy?.();
  }
}

async function importFiles(fileList) {
  let imported = 0, dup = 0, skipped = 0, failed = 0;
  const errors = [];
  for (const file of fileList) {
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!SUPPORTED.includes(ext)) { skipped++; continue; }
      if (ext === 'txt' && !(await file.text()).trim()) { skipped++; errors.push(`${file.name}: 空白 TXT`); continue; }
      const digest = await fingerprint(file);
      if (books.some(b => b.fingerprint === digest)) { dup++; continue; }
      const meta = ext === 'txt' ? {} : await inspectBook(file);
      await store(STORES.books).put({
        id: 'local-' + crypto.randomUUID(),
        title: meta.title || file.name.replace(/\.[^.]+$/, ''),
        author: meta.author || '',
        cover: meta.cover || null,
        format: ext,
        filename: file.name,
        size: file.size,
        fingerprint: digest,
        blob: file,
        added: new Date().toISOString(),
      });
      imported++;
      await loadLibrary();
      renderShelf();
    } catch (err) {
      failed++;
      errors.push(`${file.name}: ${err?.message || err}`);
    }
  }
  const notes = [];
  if (dup) notes.push(`${dup} 本已在书架`);
  if (skipped) notes.push(`跳过 ${skipped} 个文件`);
  if (failed) notes.push(`${failed} 本失败：${errors.slice(0, 2).join('；')}`);
  setStatus(`已导入 ${imported} 本${notes.length ? '；' + notes.join('；') : ''}`, failed > 0);
}

$('openImport').onclick = () => $('files').click();
$('files').onchange = async e => {
  try { await importFiles(e.target.files); } finally { e.target.value = ''; }
};
$('shelfSearch').addEventListener('input', renderShelf);
document.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
  filter = btn.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  renderShelf();
}));
// 内置试读书为仓库原创文本，分 TXT 与 EPUB 两版，用于验证两种排版路径。
$('addDemo').onclick = async () => {
  try {
    const res = await fetch('test-books/zero-one-full-book-test.txt');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const file = new File([await res.text()], '零一·整书朗读试读.txt', { type: 'text/plain' });
    await importFiles([file]);
  } catch (err) {
    setStatus('无法加入试读书：' + err.message, true);
  }
};
$('addDemoEpub').onclick = async () => {
  try {
    const res = await fetch('test-books/zero-one-whole-book.epub');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const file = new File([await res.blob()], '零一·整书朗读试读.epub', { type: 'application/epub+zip' });
    await importFiles([file]);
  } catch (err) {
    setStatus('无法加入 EPUB 试读书：' + err.message, true);
  }
};

// ---------- 阅读器状态 ----------
let active = null;
let activeView = null;
let chapters = [];
let chapterIndex = 0;
let sentences = [];
let sentIndex = 0;
let foliateSection = 0;
let textMode = false;
let openRun = 0;
let readSeconds = 0;
let listenSeconds = 0;
let heartbeats = 0;
let ticker = null;
let voiceRecords = [];

const narrator = new Narrator({
  speak(sentence, done, fail, run) {
    if (!synth || !window.SpeechSynthesisUtterance) { fail(new Error('当前浏览器不支持语音朗读')); return; }
    const u = new SpeechSynthesisUtterance(sentence.text);
    u.lang = /[\u4e00-\u9fff]/.test(sentence.text) ? 'zh-CN' : 'en-US';
    u.rate = voiceRate();
    const v = pickVoice();
    if (v) u.voice = v;
    // 只认「这句还在当前队列的这一格」：seek/换章之后 index 会移动，旧回执自然失效。
    // 不额外比较 run 序号——Narrator 的 #token 只保证内部循环不串台，
    // 页面自己再记一份序号，跨 stop()/load() 后会与 #token 的计数错位，朗读就停住了。
    u.onend = () => { if (narrator.queue[narrator.index] === sentence) done(); };
    u.onerror = e => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      fail(new Error(e.error || '朗读失败'));
    };
    synth.speak(u);
  },
  cancel() { try { synth?.cancel(); } catch { /* ignore */ } },
  pause() { try { synth?.pause(); } catch { /* ignore */ } },
  resume() { try { synth?.resume(); } catch { /* ignore */ } },
});

function voiceRate() {
  const record = voiceRecords.find(v => v.id === settings.voiceId && canUseVoice(v));
  return Math.max(0.6, Math.min(1.8, (Number(settings.rate) || 1) * (record?.features?.rateBias || 1)));
}

function pickVoice() {
  const all = synth?.getVoices?.() || [];
  return all.find(x => x.voiceURI === settings.voiceURI)
    || all.find(x => x.lang?.toLowerCase().startsWith('zh'))
    || all[0] || null;
}

narrator.addEventListener('statechange', () => {
  const speaking = narrator.state === 'speaking';
  ambient.setSpeaking(speaking);
  updateNarrationUI();
  startTicker(speaking);
});
narrator.addEventListener('position', e => {
  sentIndex = e.detail.index;
  highlightParagraph(e.detail.sentence?.paragraphIndex);
  updateNarrationUI();
  persistProgress();
});
narrator.addEventListener('ended', async () => {
  if (settings.autoContinue) await goChapter(chapterIndex + 1, { autoplay: true });
  else setStatus('本章读完');
});
narrator.addEventListener('error', e => {
  setStatus('朗读中断：' + (e.detail.error?.message || e.detail.error) + '。点 🔊 可从当前句继续。', true);
});

function updateNarrationUI() {
  const state = narrator.state;
  $('speak').textContent = state === 'speaking' ? '⏸' : state === 'paused' ? '▶' : '🔊';
  $('speak').setAttribute('aria-label', state === 'speaking' ? '暂停朗读' : state === 'paused' ? '继续朗读' : '开始朗读');
  $('speak').disabled = !sentences.length;
  const cur = narrator.current;
  $('nowSentence').textContent = cur
    ? `「${cur.text.length > 26 ? cur.text.slice(0, 26) + '…' : cur.text}」`
    : sentences.length ? '' : '这一页没有可朗读的正文';
  const range = $('chapterProgress');
  range.max = String(Math.max(0, sentences.length - 1));
  range.value = String(Math.min(sentIndex, Math.max(0, sentences.length - 1)));
  $('chapterTime').textContent = sentences.length ? `${sentIndex + 1} / ${sentences.length} 句` : '';
}

// 注意不要在这里调用 scrollIntoView：朗读进度会不断更新 DOM，
// 平滑滚动会把页面一直拽动，滚动事件又会触发进度写入，形成噪声循环。
function highlightParagraph(pIndex) {
  const view = $('bookView');
  view.querySelectorAll('p.active').forEach(p => p.classList.remove('active'));
  if (pIndex == null) return;
  const target = view.querySelector(`p[data-p="${pIndex}"]`);
  if (!target) return;
  target.classList.add('active');
  const box = target.getBoundingClientRect();
  const frame = view.getBoundingClientRect();
  const outside = box.top < frame.top + 24 || box.bottom > frame.bottom - 24;
  if (outside) {
    const hint = typeof view.scrollTo === 'function' ? view.scrollTo.bind(view) : null;
    if (hint) hint({ top: view.scrollTop + box.top - frame.top - frame.height / 3, behavior: 'auto' });
  }
}

function startTicker(on) {
  if (on && !ticker) {
    ticker = setInterval(() => {
      if (narrator.state !== 'speaking') return;
      listenSeconds += 1;
      if (++heartbeats % 15 === 0) flushStats();
    }, 1000);
  } else if (!on && ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

function persistProgress() {
  if (!active) return;
  const chapter = chapters[chapterIndex];
  const done = sentences.length ? (sentIndex + 1) / sentences.length : 0;
  saveReadingPosition(active.id, {
    chapterIndex, sentIndex, cfi: active.cfi || '', section: foliateSection,
    label: chapter?.title || '', chapterTitle: chapter?.title || '',
    fraction: chapters.length ? Math.min(1, (chapterIndex + done) / chapters.length) : 0,
    finished: !!active.finished,
  });
}

async function flushStats() {
  if (!active) return;
  const read = Math.round(readSeconds), listen = Math.round(listenSeconds);
  readSeconds = 0; listenSeconds = 0;
  if (!read && !listen) return;
  try {
    const prev = (await statsStore().get(active.id)) || { bookId: active.id, days: {} };
    const day = localDay();
    const cell = { ...(prev.days?.[day] || {}) };
    cell.readSeconds = (cell.readSeconds || 0) + read;
    cell.listenSeconds = (cell.listenSeconds || 0) + listen;
    const days = { ...(prev.days || {}), [day]: cell };
    await statsStore().put({
      ...prev, bookId: active.id, title: active.title, lastAt: Date.now(), days,
      totalReadSeconds: Object.values(days).reduce((s, d) => s + (d.readSeconds || 0), 0),
      totalListenSeconds: Object.values(days).reduce((s, d) => s + (d.listenSeconds || 0), 0),
    });
  } catch (err) { console.warn('统计写入失败', err); }
}

// ---------- 打开与切换章节 ----------
function closeView() {
  try { activeView?.close?.(); } catch { /* ignore */ }
  activeView?.remove?.();
  activeView = null;
}

function showShelf() {
  openRun++;
  narrator.stop();
  narrator.load([]);
  ambient.setSpeaking(false);
  closeView();
  active = null;
  startTicker(false);
  $('readerScreen').hidden = true;
  $('shelfScreen').hidden = false;
  releaseCovers();
  renderShelf();
}

$('back').onclick = () => { flushStats().finally(showShelf); };

// 读完之后再点「再读一遍」：先清掉「读完」标记，否则开书时读回的位置仍然是终点。
async function restartReading(book) {
  const saved = readingPosition(book.id);
  saveReadingPosition(book.id, { ...(saved || {}), chapterIndex: 0, sentIndex: 0, section: 0, fraction: 0, finished: false });
  renderShelf();
  await openBook(book);
}

async function openBook(book) {
  const run = ++openRun;
  narrator.stop();
  closeView();
  active = { ...book };
  chapters = []; sentences = []; chapterIndex = 0; sentIndex = 0; foliateSection = 0;
  readSeconds = 0; listenSeconds = 0;
  voiceRecords = await voicesStore().all();
  $('shelfScreen').hidden = true;
  $('readerScreen').hidden = false;
  $('bookTitle').textContent = active.title || active.filename;
  $('bookView').replaceChildren();
  selectTab('content');
  draftQuote = null; editingNoteId = null;
  $('noteText').value = '';
  $('noteSearch').value = '';
  renderNotes();
  renderBookmarks();
  updateNarrationUI();
  const saved = readingPosition(book.id);
  try {
    if (formatOf(book) === 'txt') {
      textMode = true;
      $('renderMode').textContent = '本地 TXT · 按章节分页';
      const split = splitTxtChapters(await book.blob.text());
      chapters = (split.length ? split : [{ title: '全文', text: '' }]).map(c => ({ title: c.title, paragraphs: txtParagraphs(c.text) }));
      renderToc();
      const start = Math.max(0, Math.min(Number(saved?.chapterIndex) || 0, chapters.length - 1));
      await goChapter(start, { sentence: Number(saved?.sentIndex) || 0 });
    } else {
      textMode = false;
      $('renderMode').textContent = '排版引擎 foliate-js · EPUB / MOBI / AZW3 / FB2 / CBZ';
      await openFoliate(book, saved, run);
    }
    if (run === openRun) setStatus(`已打开《${active.title}》· ${chapters.length} 章`);
  } catch (err) {
    console.error(err);
    if (run === openRun) {
      setStatus(`打开《${book.title || book.filename}》失败：${err.message}`, true);
      showShelf();
    }
  }
}

async function openFoliate(book, saved, run) {
  const view = document.createElement('foliate-view');
  view.style.height = '100%';
  activeView = view;
  $('bookView').append(view);
  view.addEventListener('relocate', e => {
    if (run !== openRun || !e.detail) return;
    const { cfi, tocItem, fraction } = e.detail;
    const sec = view.renderer?.getContents?.()?.[0]?.index;
    if (Number.isInteger(sec)) foliateSection = sec;
    if (cfi) active.cfi = cfi;
    if (tocItem?.label) active.label = tocItem.label;
    if (Number.isFinite(fraction)) active.fraction = fraction;
    persistProgress();
    updatePosition();
  });
  await view.open(book.blob);
  if (run !== openRun) { view.close(); view.remove(); return; }
  chapters = flattenToc(view.book?.toc || []);
  if (!chapters.length) chapters = (view.book?.sections || []).map((s, i) => ({ title: `第 ${i + 1} 节`, href: s.id ?? i, section: i }));
  renderToc();
  try {
    await view.init({ lastLocation: saved?.cfi || null, showTextStart: true });
  } catch (err) {
    console.warn('恢复阅读位置失败，回到书首', err);
    try { await view.goToTextStart(); } catch { /* ignore */ }
  }
  if (run !== openRun) return;
  foliateSection = view.renderer?.getContents?.()?.[0]?.index ?? (Number(saved?.section) || 0);
  chapterIndex = clampChapter(sectionToChapter(foliateSection, saved));
  await loadFoliateSection(Number(saved?.sentIndex) || 0);
  renderToc();
  updatePosition();
}

function clampChapter(i) {
  return Math.max(0, Math.min(Number.isInteger(i) ? i : 0, Math.max(0, chapters.length - 1)));
}

function flattenToc(items, depth = 0, out = []) {
  for (const item of items || []) {
    if (!item?.subitems?.length) out.push({ title: `${'　'.repeat(depth)}${item?.label || ''}`.trim(), href: item?.href, section: out.length });
    else flattenToc(item.subitems, depth + 1, out);
  }
  return out;
}

function sectionToChapter(section, saved) {
  if (saved && Number.isInteger(saved.chapterIndex) && chapters[saved.chapterIndex]) return saved.chapterIndex;
  const direct = chapters.findIndex(c => c.section === section);
  if (direct >= 0) return direct;
  const href = activeView?.book?.sections?.[section]?.id;
  const byHref = chapters.findIndex(c => c.href != null && String(c.href) === String(href));
  return byHref >= 0 ? byHref : 0;
}

function htmlChapterHost(paragraphs) {
  const host = document.createElement('div');
  host.className = 'page';
  const h = document.createElement('h2');
  h.textContent = chapters[chapterIndex]?.title || '';
  host.append(h);
  paragraphs.forEach((text, i) => {
    const p = document.createElement('p');
    p.dataset.p = String(i);
    p.textContent = text;
    host.append(p);
  });
  return host;
}

// 有些 EPUB 的章节不是 XHTML（或者解析失败），foliate-js 会返回 null 文档。
// 这时退回到后续解析出的目录与正文，保证整章仍能朗读，而不是整本打不开。
async function loadFoliateSection(sentence = 0) {
  const section = activeView?.book?.sections?.[foliateSection];
  if (!section) throw new Error('章节内容不存在');
  if (activeView) activeView.style.display = 'none';
  let paragraphs = [];
  try {
    const doc = await section.createDocument();
    if (doc?.documentElement) paragraphs = htmlToParagraphs(doc.documentElement.innerHTML);
  } catch (err) {
    console.warn('本章无法解析，显示空页', err);
  }
  if (chapters[chapterIndex]) chapters[chapterIndex].paragraphs = paragraphs;
  $('bookView').replaceChildren(htmlChapterHost(paragraphs));
  buildChapter(sentence);
}

// 正文朗读视图：foliate-js 仍在后台解析章节（保留其 EPUB/MOBI 解析与目录能力），
// 但给用户呈现的是按句切好、可随朗读高亮的文字，对朗读体验更友好。
function buildChapter(sentence = 0) {
  const chapter = chapters[chapterIndex] || { paragraphs: [] };
  const paragraphs = chapter.paragraphs || [];
  // 目录页、版权页等无正文页面照样显示，但不进入朗读队列。
  sentences = isBodyText(paragraphs) ? sliceParagraphs(paragraphs).map(s => ({ ...s, chapterIndex })) : [];
  const start = sentences.length ? Math.max(0, Math.min(Number(sentence) || 0, sentences.length - 1)) : 0;
  narrator.load(sentences, start);
  sentIndex = start;
  updateNarrationUI();
  updatePosition();
  persistProgress();
  renderToc();
}

function renderToc() {
  $('tocList').replaceChildren(...chapters.map((c, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = c.title || `第 ${i + 1} 章`;
    b.dataset.chapter = String(i);
    if (i === chapterIndex) b.classList.add('current');
    b.onclick = () => goChapter(i);
    li.append(b);
    return li;
  }));
}

function updatePosition() {
  const chapter = chapters[chapterIndex];
  const done = sentences.length ? (sentIndex + 1) / sentences.length : 0;
  const pct = chapters.length ? Math.round(((chapterIndex + done) / chapters.length) * 100) : 0;
  const remainChars = (chapters.length - chapterIndex - 1) * 350
    + sentences.slice(Math.max(0, sentIndex)).reduce((sum, s) => sum + s.text.length, 0);
  $('position').textContent = `${chapter?.title || ''} · ${pct}% · 约剩 ${estimateMinutes(remainChars)} 分钟`;
  $('bookTitle').textContent = active?.title || '';
}

async function goChapter(index, { autoplay = false, sentence = 0 } = {}) {
  if (!active) return;
  if (index < 0) { setStatus('已经是第一章'); return; }
  if (index >= chapters.length) {
    narrator.stop();
    active.finished = true;
    persistProgress();
    flushStats();
    setStatus(`《${active.title}》读完了。书架上会标记「读完」。`);
    return;
  }
  await flushStats();
  narrator.stop();
  chapterIndex = index;
  if (textMode) {
    showTextChapter();
    buildChapter(sentence);
  } else {
    // 章节编号的唯一可信来源是 spine 位置（foliateSection）：直接按 index 取 section，
    // 不要从 renderer 的当前内容反推，否则跳章后正在卸载的旧 section 会把新章节盖回去。
    foliateSection = typeof chapters[index].section === 'number' ? chapters[index].section : index;
    await loadFoliateSection(sentence);
  }
  $('bookView').scrollTop = 0;
  renderToc();
  updatePosition();
  if (autoplay) await narrator.play();
}

function showTextChapter() {
  const chapter = chapters[chapterIndex] || { paragraphs: [] };
  const host = document.createElement('div');
  host.className = 'page';
  const h = document.createElement('h2');
  h.textContent = chapter.title || `第 ${chapterIndex + 1} 章`;
  host.append(h);
  chapter.paragraphs.forEach((text, i) => {
    const p = document.createElement('p');
    p.dataset.p = String(i);
    p.textContent = text;
    host.append(p);
  });
  $('bookView').replaceChildren(host);
}

// ---------- 朗读控制 ----------
$('speak').onclick = async () => {
  if (!active) return;
  if (!synth || !window.SpeechSynthesisUtterance) {
    setStatus('这个浏览器不能朗读，请换用新版 Chrome / Edge / Safari。', true);
    return;
  }
  if (narrator.state === 'speaking') narrator.pause();
  else if (narrator.state === 'paused') narrator.resume();
  else {
    if (narrator.state === 'ended' || !narrator.queue.length) narrator.load(sentences, sentIndex);
    await narrator.play();
    setStatus('正在朗读 · 切到别的应用或锁屏时通常仍会继续');
  }
};
$('prev').onclick = () => goChapter(chapterIndex - 1);
$('next').onclick = () => goChapter(chapterIndex + 1);
$('back15').onclick = () => narrator.seek(Math.max(0, sentIndex - 3));
$('forward15').onclick = () => narrator.seek(sentences.length ? Math.min(sentences.length - 1, sentIndex + 3) : 0);
$('chapterProgress').oninput = e => narrator.seek(Number(e.target.value));

// ---------- 书签 ----------
$('bookmarkAdd').onclick = () => {
  if (!active) return;
  const list = loadBookmarks(active.id);
  list.push({
    id: crypto.randomUUID(),
    chapterIndex, sentIndex, cfi: active.cfi || '', section: foliateSection,
    label: chapters[chapterIndex]?.title || '',
    sentence: sentences[sentIndex]?.text?.slice(0, 40) || '',
    createdAt: Date.now(),
  });
  saveBookmarks(active.id, list);
  renderBookmarks();
  setStatus(`已加书签：${chapters[chapterIndex]?.title || ''}${sentences[sentIndex] ? ' · ' + sentences[sentIndex].text.slice(0, 20) : ''}`);
};

function renderBookmarks() {
  const items = active ? loadBookmarks(active.id) : [];
  $('bookmarkEmpty').hidden = items.length > 0;
  $('bookmarkList').replaceChildren(...items.map(item => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.gap = '6px';
    const go = document.createElement('button');
    go.type = 'button';
    go.textContent = `${item.label || '位置'}${item.sentence ? ' · ' + item.sentence : ''}`;
    go.onclick = async () => {
      selectTab('content');
      await goChapter(Number(item.chapterIndex) || 0, { sentence: Number(item.sentIndex) || 0 });
    };
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '删除';
    del.onclick = () => {
      saveBookmarks(active.id, loadBookmarks(active.id).filter(x => x.id !== item.id));
      renderBookmarks();
      setStatus('已删除书签');
    };
    li.append(go, del);
    return li;
  }));
}

function selectTab(name) {
  document.querySelectorAll('[role=tab]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  for (const key of ['content', 'toc', 'notes', 'sound']) $(`tab-${key}`).hidden = key !== name;
  if (name === 'notes') renderNotes();
}
document.querySelectorAll('[role=tab]').forEach(t => t.addEventListener('click', () => selectTab(t.dataset.tab)));

// ---------- 笔记 ----------
function activeSentences() { return sentences; }

function captureQuote() {
  const sel = window.getSelection?.();
  const text = sel && !sel.isCollapsed ? sel.toString() : '';
  if (text.trim()) {
    draftQuote = { quote: text, paragraphIndex: null };
    $('quoteText').textContent = text.trim().slice(0, 160);
    $('quoteBox').hidden = false;
    return;
  }
  const cur = sentences[sentIndex];
  if (cur) {
    draftQuote = { quote: cur.text, paragraphIndex: cur.paragraphIndex };
    $('quoteText').textContent = cur.text.slice(0, 160);
    $('quoteBox').hidden = false;
  }
}

$('bookView').addEventListener('mouseup', () => setTimeout(captureQuote, 10));
$('bookView').addEventListener('touchend', () => setTimeout(captureQuote, 10));
$('clearQuote').onclick = () => { draftQuote = null; $('quoteBox').hidden = true; };

function renderNotes() {
  if (!active) return;
  const mine = notesCache.filter(n => n.bookId === active.id);
  $('noteCount').textContent = mine.length ? `(${mine.length})` : '';
  const q = $('noteSearch').value;
  const list = mine.filter(n => noteMatches(n, q)).sort((a, b) => b.createdAt - a.createdAt);
  $('noteStatus').textContent = q ? `找到 ${list.length} 条` : '';
  $('noteList').replaceChildren(...list.map(noteEl));
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = q ? '没有匹配的笔记。' : '还没有笔记。读到有感触的地方，选中文字或直接写下想法。';
    $('noteList').append(p);
  }
}

function noteEl(note) {
  const el = document.createElement('div');
  el.className = 'note';
  el.dataset.noteId = note.id;
  if (note.quote) {
    const bq = document.createElement('blockquote');
    bq.textContent = '「' + note.quote + '」';
    el.append(bq);
  }
  const body = document.createElement('div');
  body.className = 'body';
  body.textContent = note.text;
  el.append(body);
  const meta = document.createElement('div');
  meta.className = 'meta';
  const chapter = document.createElement('span');
  chapter.textContent = note.chapter || '';
  meta.append(chapter);
  for (const tag of note.tags || []) {
    const t = document.createElement('span'); t.className = 'tag'; t.textContent = tag;
    meta.append(t);
  }
  const time = document.createElement('span');
  time.textContent = new Date(note.createdAt).toLocaleString('zh-CN');
  meta.append(time);
  const edit = document.createElement('button');
  edit.type = 'button'; edit.className = 'ghost'; edit.textContent = '编辑';
  edit.onclick = () => {
    editingNoteId = note.id;
    $('noteText').value = note.text;
    $('noteTags').value = (note.tags || []).join(',');
    $('noteCancel').hidden = false;
    $('noteText').focus();
  };
  const jump = document.createElement('button');
  jump.type = 'button'; jump.className = 'ghost'; jump.textContent = '回到原处';
  jump.onclick = async () => {
    selectTab('content');
    await goChapter(Number(note.chapterIndex) || 0, { sentence: Number(note.sentIndex) || 0 });
  };
  const del = document.createElement('button');
  del.type = 'button'; del.className = 'ghost'; del.textContent = '删除';
  del.onclick = async () => {
    if (!(await confirmDialog('删除笔记', '这条笔记会从本机永久删除。', '删除'))) return;
    await notesStore().delete(note.id);
    notesCache = notesCache.filter(n => n.id !== note.id);
    renderNotes();
    $('noteStatus').textContent = '已删除笔记';
  };
  meta.append(jump, edit, del);
  el.append(meta);
  return el;
}

$('noteSearch').addEventListener('input', renderNotes);
$('noteCancel').onclick = () => {
  editingNoteId = null;
  $('noteText').value = '';
  $('noteTags').value = '';
  $('noteCancel').hidden = true;
};
$('noteSave').onclick = async () => {
  if (!active) return;
  const text = $('noteText').value.trim();
  if (!text) { $('noteStatus').textContent = '请先写下一点想法再保存。'; return; }
  const tags = $('noteTags').value.split(/[,，、\s]+/).map(t => t.trim()).filter(Boolean);
  if (editingNoteId) {
    const note = notesCache.find(n => n.id === editingNoteId);
    if (note) {
      const updated = { ...note, text, tags, updatedAt: Date.now() };
      await notesStore().put(updated);
      notesCache = notesCache.map(n => n.id === note.id ? updated : n);
    }
    editingNoteId = null;
    $('noteCancel').hidden = true;
  } else {
    const note = makeNote({
      bookId: active.id, text, tags,
      quote: draftQuote?.quote || '',
      chapter: chapters[chapterIndex]?.title || '',
      cfi: active.cfi || '', sentIndex,
    });
    await notesStore().put(note);
    notesCache.push(note);
    $('noteStatus').textContent = '笔记已保存在本机';
  }
  draftQuote = null;
  $('quoteBox').hidden = true;
  $('noteText').value = '';
  $('noteTags').value = '';
  renderNotes();
};

// ---------- 声音：设备声音、背景音、家人声音 ----------
function renderVoiceSelect() {
  const all = synth?.getVoices?.() || [];
  const sel = $('voice');
  const opts = all.map(v => new Option(`${v.name} · ${v.lang}`, v.voiceURI));
  for (const record of voiceRecords) {
    if (canUseVoice(record) || record.status === 'revoked') {
      opts.push(new Option(`${describeVoice(record)} · 家庭声音`, 'family:' + record.id));
    }
  }
  sel.replaceChildren(...opts);
  const wanted = settings.voiceId ? 'family:' + settings.voiceId : settings.voiceURI;
  if (wanted && [...sel.options].some(o => o.value === wanted)) sel.value = wanted;
  else {
    const zh = all.findIndex(v => v.lang?.toLowerCase().startsWith('zh'));
    if (zh >= 0) sel.value = all[zh].voiceURI;
  }
  settings.voiceURI = sel.value?.startsWith('family:') ? '' : sel.value;
}
$('voice').onchange = e => {
  const value = e.target.value;
  if (value.startsWith('family:')) {
    settings.voiceId = value.slice(7);
    settings.voiceURI = '';
  } else {
    settings.voiceId = '';
    settings.voiceURI = value;
  }
  saveReadingSettings(settings);
  const record = voiceRecords.find(v => v.id === settings.voiceId);
  if (record) {
    voiceRecords = voiceRecords.map(v => v.id === record.id
      ? { ...v, usage: { spokenSentences: (v.usage?.spokenSentences || 0) + 1, lastUsedAt: new Date().toISOString() } }
      : v);
    voicesStore().put(record.status === 'active' ? voiceRecords.find(v => v.id === record.id) : record).catch(() => {});
  }
};
if (synth?.addEventListener) synth.addEventListener('voiceschanged', () => { renderVoiceSelect(); });

$('rate').value = String(settings.rate);
$('rateOut').textContent = Number(settings.rate).toFixed(2) + '×';
$('rate').oninput = e => {
  settings.rate = Number(e.target.value);
  $('rateOut').textContent = settings.rate.toFixed(2) + '×';
  saveReadingSettings(settings);
};
$('autoContinue').checked = settings.autoContinue !== false;
$('autoContinue').onchange = e => { settings.autoContinue = e.target.checked; saveReadingSettings(settings); };

function applyReadingStyle() {
  $('bookView').style.setProperty('--reader-size', settings.fontSize + 'px');
  $('bookView').style.setProperty('--reader-leading', String(settings.leading));
  $('fontSize').value = String(settings.fontSize);
  $('leading').value = String(settings.leading);
  $('sizeOut').textContent = settings.fontSize + 'px';
  $('leadingOut').textContent = Number(settings.leading).toFixed(1);
}
$('fontSize').oninput = e => { settings.fontSize = Number(e.target.value); applyReadingStyle(); saveReadingSettings(settings); };
$('leading').oninput = e => { settings.leading = Number(e.target.value); applyReadingStyle(); saveReadingSettings(settings); };

function renderAmbientGrid() {
  const prefs = loadAmbientPrefs();
  const grid = $('ambientGrid');
  const items = SCENES.map(scene => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vibe';
    b.dataset.scene = scene.id;
    b.setAttribute('aria-pressed', String(ambient.playingId === scene.id));
    const g = document.createElement('div'); g.className = 'gie'; g.textContent = scene.glyph;
    const s = document.createElement('strong'); s.textContent = scene.name;
    const d = document.createElement('small'); d.textContent = scene.description;
    b.append(g, s, d);
    b.onclick = async () => playAmbient(scene.id);
    return b;
  });
  const off = document.createElement('button');
  off.type = 'button';
  off.className = 'vibe';
  off.dataset.scene = '';
  off.setAttribute('aria-pressed', String(!ambient.playingId));
  const og = document.createElement('div'); og.className = 'gie'; og.textContent = '⏻';
  const os = document.createElement('strong'); os.textContent = '关闭背景音';
  const od = document.createElement('small'); od.textContent = '只留朗读的声音';
  off.append(og, os, od);
  off.onclick = () => playAmbient('');
  grid.replaceChildren(...items, off);
  $('volume').value = String(prefs.volume ?? ambient.baseVolume);
  $('volumeOut').textContent = Math.round((prefs.volume ?? ambient.baseVolume) * 100) + '%';
}

async function playAmbient(id) {
  try {
    if (!id) { ambient.stop(); setStatus('已关闭背景音'); }
    else {
      const ok = await ambient.play(id);
      if (!ok) { setStatus('这台设备的浏览器不支持实时合成背景音。', true); return; }
      const prefs = loadAmbientPrefs();
      prefs.scene = id;
      saveAmbientPrefs(prefs);
      setStatus(`背景音：${SCENES.find(s => s.id === id)?.name || id}${ambient.speaking ? '（朗读时自动压低）' : ''}`);
    }
    renderAmbientGrid();
  } catch (err) {
    setStatus('背景音播放失败：' + err.message, true);
  }
}

$('volume').oninput = e => {
  const v = Number(e.target.value);
  ambient.setVolume(v);
  $('volumeOut').textContent = Math.round(v * 100) + '%';
  const prefs = loadAmbientPrefs();
  prefs.volume = v;
  saveAmbientPrefs(prefs);
};
$('ducking').checked = duckingEnabled();
$('ducking').onchange = e => {
  setDucking(e.target.checked);
  ambient.setDucking(e.target.checked);
};
$('musicFile').onchange = async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    await store(STORES.settings).put({ id: 'background-audio', name: file.name, type: file.type, blob: file, updatedAt: Date.now() });
    await ambient.playFile(file, file.name);
    ambient.setVolume(Number($('volume').value));
    $('musicStatus').textContent = `当前背景音：${file.name}（保存在本机，朗读时自动压低）`;
    setStatus(`已载入本机背景音「${file.name}」`);
    renderAmbientGrid();
  } catch (err) {
    setStatus('背景音载入失败：' + err.message, true);
  } finally {
    e.target.value = '';
  }
};

// ---------- 家人声音（知情同意 / 撤销 / 删除） ----------
function renderVoicesPanel() {
  const body = $('voicesBody');
  const cards = voiceRecords.map(record => {
    const card = document.createElement('div');
    card.className = 'voice-card' + (record.status === 'revoked' ? ' revoked' : '');
    card.dataset.voiceId = record.id;
    const h = document.createElement('strong');
    h.textContent = describeVoice(record);
    const meta = document.createElement('small');
    meta.className = 'muted';
    const f = record.features;
    meta.textContent = [
      record.speaker ? `声音本人：${record.speaker}` : '',
      f ? `样本 ${f.duration}s · 音调 ${f.pitch} · 语速倾向 ${f.rateBias}×` : '',
      `授权版本 ${record.consent?.version || ''} · ${new Date(record.createdAt).toLocaleString('zh-CN')}`,
    ].filter(Boolean).join(' · ');
    card.append(h, meta);
    if (record.status === 'active') {
      const use = document.createElement('button');
      use.type = 'button';
      use.textContent = settings.voiceId === record.id ? '正在使用' : '在朗读中使用';
      use.onclick = () => {
        settings.voiceId = record.id;
        settings.voiceURI = '';
        saveReadingSettings(settings);
        renderVoiceSelect();
        renderVoicesPanel();
        setStatus(`朗读将使用家庭声音：${record.name}（语速 ×${voiceRate().toFixed(2)}）`);
      };
      const revoke = document.createElement('button');
      revoke.type = 'button';
      revoke.dataset.action = 'revoke';
      revoke.textContent = '撤销授权并删除声音';
      revoke.onclick = async () => {
        if (!(await confirmDialog('撤销声音授权', `撤销后，「${record.name}」的样本特征与音色数据会立即从本机删除，且不再出现在朗读声音中。此操作不可恢复。`, '撤销并删除'))) return;
        const revoked = revokeVoice(record);
        await voicesStore().put(revoked);
        voiceRecords = voiceRecords.map(v => v.id === record.id ? revoked : v);
        if (settings.voiceId === record.id) { settings.voiceId = ''; saveReadingSettings(settings); }
        renderVoiceSelect();
        renderVoicesPanel();
        setStatus(`已撤销「${record.name}」的授权并删除样本数据`);
      };
      const row = document.createElement('div');
      row.style.display = 'flex'; row.style.gap = '8px'; row.style.flexWrap = 'wrap';
      row.append(use, revoke);
      card.append(row);
    } else {
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '彻底删除记录';
      del.onclick = async () => {
        await voicesStore().delete(record.id);
        voiceRecords = voiceRecords.filter(v => v.id !== record.id);
        renderVoiceSelect();
        renderVoicesPanel();
        setStatus('已彻底删除该声音记录');
      };
      const when = document.createElement('small');
      when.className = 'muted';
      when.textContent = `撤销于 ${new Date(record.revokedAt || Date.now()).toLocaleString('zh-CN')} · 原因：${record.revokeReason || '本人撤销'}`;
      card.append(when, del);
    }
    return card;
  });
  const intro = document.createElement('div');
  intro.className = 'hint';
  intro.textContent = '家庭声音让家人「读给你听」。当前版本只在本机提取声音的声学特征（音调、语速倾向），不会克隆音色，也不会上传任何录音。新增声音必须由声音本人勾选全部授权条款，之后可随时撤销与删除。';
  body.replaceChildren(intro, ...cards);
  if (!cards.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = '还没有录入家人声音。';
    body.append(p);
  }
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'primary';
  add.id = 'addVoice';
  add.textContent = '＋ 录制家人的声音';
  add.onclick = openRecordDialog;
  body.append(add);
}

$('openVoices').onclick = async () => {
  voiceRecords = await voicesStore().all();
  renderVoicesPanel();
  $('voicesDialog').showModal();
};
$('closeVoices').onclick = () => $('voicesDialog').close();

let recording = null;
function openRecordDialog() {
  const list = $('consentList');
  list.replaceChildren(...CONSENT_ITEMS.map(item => {
    const label = document.createElement('label');
    label.className = 'consent-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.consent = item.id;
    const span = document.createElement('span');
    span.textContent = item.text;
    label.append(cb, span);
    return label;
  }));
  $('recordStatus').textContent = '';
  $('recordSave').disabled = true;
  $('recordStart').disabled = false;
  $('recordStop').disabled = true;
  $('recordDialog').showModal();
}
$('recordCancel').onclick = () => {
  recording?.stream?.getTracks?.().forEach(t => t.stop());
  recording = null;
  $('recordDialog').close();
};

$('recordStart').onclick = async () => {
  const form = {};
  document.querySelectorAll('[data-consent]').forEach(cb => { form[cb.dataset.consent] = cb.checked; });
  const check = validateConsent(form);
  if (!check.ok) {
    $('recordStatus').textContent = '请先由声音本人确认全部授权说明。';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const chunks = [];
    const buffer = new Float32Array(analyser.fftSize);
    const start = performance.now();
    recording = {
      stream, ctx, consent: form, chunks,
      timer: setInterval(() => {
        analyser.getFloatTimeDomainData(buffer);
        chunks.push(...buffer);
        const seconds = (performance.now() - start) / 1000;
        $('recordStatus').textContent = `录制中 ${seconds.toFixed(1)} 秒（3–30 秒）`;
        if (seconds >= 30) stopRecording();
      }, 100),
      sampleRate: ctx.sampleRate,
    };
    $('recordStart').disabled = true;
    $('recordStop').disabled = false;
    $('recordSave').disabled = true;
  } catch (err) {
    $('recordStatus').textContent = '无法使用麦克风：' + err.message;
  }
};

function stopRecording() {
  if (!recording) return;
  clearInterval(recording.timer);
  recording.stream.getTracks().forEach(t => t.stop());
  recording.ctx.close?.();
  const seconds = recording.chunks.length / recording.sampleRate;
  recording.seconds = seconds;
  $('recordStop').disabled = true;
  $('recordStart').disabled = false;
  const problem = sampleProblem(seconds);
  if (problem) {
    $('recordStatus').textContent = problem;
    $('recordSave').disabled = true;
  } else {
    $('recordStatus').textContent = `录制完成：${seconds.toFixed(1)} 秒。可以试听并保存。`;
    $('recordSave').disabled = false;
  }
}
$('recordStop').onclick = stopRecording;

$('recordSave').onclick = async () => {
  if (!recording) return;
  const options = synth?.getVoices?.() || [];
  const zh = options.find(v => v.lang?.toLowerCase().startsWith('zh')) || options[0];
  const features = analyzePcm(recording.chunks, recording.sampleRate);
  const name = prompt('给这个声音起个称呼', '家人的声音');
  if (name === null) return;
  const speaker = prompt('声音本人的名字（只保存在本机）', '') || '';
  const record = makeVoiceRecord({
    name: name || '家人的声音',
    speaker,
    relationship: '',
    features,
    consent: recording.consent,
    sampleMeta: { seconds: Number(recording.seconds.toFixed(1)), localOnly: true, storedAudio: false },
  });
  await voicesStore().put(record);
  voiceRecords = [...voiceRecords, record];
  recording = null;
  $('recordDialog').close();
  renderVoicesPanel();
  renderVoiceSelect();
  setStatus(`已保存家庭声音「${record.name}」，样本录音本身未保存，仅保留声学特征。`);
};

// ---------- 阅读统计 ----------
$('openStats').onclick = async () => {
  const rows = await statsStore().all();
  const week = summarizeDays(rows, 7);
  const totalRead = rows.reduce((s, r) => s + (r.totalReadSeconds || 0), 0);
  const totalListen = rows.reduce((s, r) => s + (r.totalListenSeconds || 0), 0);
  const day = localDay();
  const today = week.find(w => w.day === day) || { readSeconds: 0, listenSeconds: 0 };
  const max = Math.max(1, ...week.map(w => w.readSeconds + w.listenSeconds));
  const body = $('statsBody');
  const top = document.createElement('div');
  top.innerHTML = '<h3>阅读统计</h3>';
  const stats = document.createElement('div');
  stats.className = 'stat-row';
  const entries = [
    ['今天阅读', formatDuration(today.readSeconds)],
    ['今天听书', formatDuration(today.listenSeconds)],
    ['累计阅读', formatDuration(totalRead)],
    ['累计听书', formatDuration(totalListen)],
  ];
  for (const [label, value] of entries) {
    const d = document.createElement('div');
    d.className = 'stat';
    const s = document.createElement('strong'); s.textContent = value;
    const t = document.createElement('small'); t.textContent = label;
    d.append(s, t);
    stats.append(d);
  }
  const bars = document.createElement('div');
  bars.className = 'bars';
  for (const w of week) {
    const col = document.createElement('div');
    col.className = 'bar';
    const bar = document.createElement('i');
    bar.style.height = `${Math.round(((w.readSeconds + w.listenSeconds) / max) * 78)}%`;
    bar.title = `${w.day} · 读 ${formatDuration(w.readSeconds)} / 听 ${formatDuration(w.listenSeconds)}`;
    const label = document.createElement('span');
    label.textContent = w.day.slice(5);
    col.append(bar, label);
    bars.append(col);
  }
  const privacy = document.createElement('div');
  privacy.className = 'hint';
  privacy.textContent = '统计只保存在这台设备的浏览器里。';
  const danger = document.createElement('p');
  const erase = document.createElement('button');
  erase.type = 'button';
  erase.className = 'danger';
  erase.dataset.action = 'erase-all';
  erase.textContent = '清除本机全部阅读数据';
  erase.onclick = async () => {
    if (!(await confirmDialog('清除全部数据', '书籍、笔记、书签、家庭声音、进度与统计都会从这台设备删除，无法恢复。请确认你已经保留了书籍原件。', '全部删除'))) return;
    await eraseEverything(db);
    ambient.stop();
    await loadLibrary();
    voicesStore().all().then(v => { voiceRecords = v; renderVoiceSelect(); });
    $('statsDialog').close();
    showShelf();
    setStatus('已清除本机全部阅读数据');
  };
  danger.append(erase);
  body.replaceChildren(top, stats, bars, privacy, danger);
  $('statsDialog').showModal();
};
$('closeStats').onclick = () => $('statsDialog').close();

// ---------- 初始化 ----------
window.addEventListener('pagehide', () => {
  flushStats();
  narrator.stop();
  releaseCovers();
  ambient.destroy();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) flushStats(); });

async function boot() {
  try {
    db = await openDatabase();
  } catch (err) {
    setStatus('书库无法打开：' + err.message, true);
    return;
  }
  await loadLibrary();
  renderShelf();
  applyReadingStyle();
  ambient.setDucking(duckingEnabled());
  const prefs = loadAmbientPrefs();
  ambient.setVolume(prefs.volume ?? 0.2);
  renderAmbientGrid();
  const savedAudio = await store(STORES.settings).get('background-audio');
  if (savedAudio?.blob instanceof Blob && savedAudio.blob.size) {
    $('musicStatus').textContent = `已保存背景音：${savedAudio.name}（打开「声音」页即可播放）`;
  }
  voiceRecords = await voicesStore().all();
  renderVoiceSelect();
  setStatus(`书库就绪 · ${books.length} 本书${synth ? '' : '（浏览器不支持朗读）'}`);
}

// 供自动化测试读取的只读快照
window.__reader = {
  get state() {
    return {
      books: books.length,
      notes: notesCache.length,
      chapterIndex,
      sentIndex,
      sentences: sentences.length,
      narrator: narrator.state,
      ambient: ambient.playingId,
      voices: voiceRecords.map(v => ({ id: v.id, name: v.name, status: v.status, features: v.features })),
    };
  },
};

boot();
