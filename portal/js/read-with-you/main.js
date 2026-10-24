// Reader shell: wires the shelf, the reading view, narration, notes, voices and
// background music to the DOM in read-with-you.html.
import { buildBookRecord, chaptersOf, extensionOf, ALL_EXTENSIONS } from './books.js';
import { api, probeServer, server } from './api.js';
import {
  allBooks, clearPosition, findDuplicate, readPosition, readSettings, removeBook, saveBook,
  sortShelf, writePosition, writeSettings,
} from './store.js';
import { createLayout } from './layout.js';
import { AudioSession } from './audio.js';
import { BackgroundMusic } from './music.js';
import { renderContinue, renderShelf } from './shelf.js';
import { setupMediaSession, shortcutFor } from './layout-helpers.js';
import { toast, closePanels, openPanel } from './ui.js';
import { NotesController } from './notes.js';
import { VoicesController } from './voices.js';
import { SettingsPanel } from './settings.js';

const $ = id => document.getElementById(id);

const app = {
  books: [],
  book: null,
  chapters: [],
  segments: [],
  layout: null,
  layoutKind: 'scrolled',
  settings: readSettings(),
  session: null,
  music: new BackgroundMusic(),
  listening: null,
  bookmarks: [],
  playhead: 0,
  notes: null,
  voices: null,
  voicesData: [],
  media: null,
};

const flatIndexOf = (chapter, segment) => {
  const info = app.chapters[chapter];
  return info ? info.start + Math.min(segment, Math.max(0, info.segments.length - 1)) : 0;
};
const positionOf = index => {
  const item = app.segments[index];
  return item ? { chapter: item.chapter, segment: item.index } : { chapter: 0, segment: 0 };
};

function applyTheme() {
  document.documentElement.dataset.theme = app.settings.theme || 'paper';
  document.documentElement.style.setProperty('--font-scale', String(app.settings.fontScale || 1));
}

// --------------------------------------------------------------------- shelf
async function refreshShelf() {
  app.books = sortShelf(await allBooks());
  paintShelf();
}

function paintShelf() {
  const query = $('shelfSearch').value;
  const { visible, total } = renderShelf($('shelfGrid'), app.books, {
    query, onOpen: openBook, onDelete: deleteBook, onReset: resetProgress,
  });
  $('shelfCount').textContent = total ? (visible === total ? `共 ${total} 本` : `找到 ${visible} / ${total} 本`) : '';
  const hero = $('shelfHero');
  hero.replaceChildren();
  const resumed = renderContinue(hero, app.books, {
    listening: app.listening,
    onOpen: (book, options) => openBook(book, options),
    onStop: () => { app.listening = null; paintShelf(); },
  });
  if (!resumed) hero.append(importCard());
}

function importCard() {
  const card = document.createElement('section');
  card.className = 'import-card';
  card.id = 'importCard';
  card.innerHTML = '<p class="eyebrow">添加书籍</p><h3>把整本书放进来</h3>'
    + '<p class="muted">支持 TXT（自动识别 UTF-8 / GB18030 / Big5）、EPUB、MOBI、AZW3、FB2、CBZ。文件留在本机，不上传。</p>';
  const zone = document.createElement('div');
  zone.className = 'dropzone';
  zone.dataset.dropzone = 'shelf';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary';
  button.id = 'importButton';
  button.textContent = app.books.length ? '＋ 导入电子书' : '＋ 导入第一本书';
  button.onclick = () => $('fileInput').click();
  const hint = document.createElement('span');
  hint.className = 'muted';
  hint.textContent = '也可以把文件拖到这里';
  zone.append(button, hint);
  card.append(zone);
  wireDropzone(zone);
  return card;
}

const wiredZones = new WeakSet();
function wireDropzone(zone) {
  if (wiredZones.has(zone)) return;
  wiredZones.add(zone);
  zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('is-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', event => {
    event.preventDefault();
    zone.classList.remove('is-over');
    const files = [...(event.dataTransfer?.files || [])];
    if (files.length) importFiles(files);
  });
}

async function deleteBook(book) {
  const title = book.title || book.filename;
  const ok = typeof window.confirm === 'function'
    ? window.confirm(`从本机书架删除《${title}》？阅读位置与这本书的本地记录会一并清空。`)
    : true;
  if (!ok) { toast(`已取消删除《${title}》`); return; }
  await removeBook(book.id);
  if (server.online) api.deleteBook(book.id).catch(() => {});
  if (app.listening?.bookId === book.id) app.listening = null;
  if (app.book?.id === book.id) closeReader();
  await refreshShelf();
  toast(`已删除《${title}》`);
}

function resetProgress(book) {
  const title = book.title || book.filename;
  const ok = typeof window.confirm === 'function' ? window.confirm(`从第一章重新开始读《${title}》？`) : true;
  if (!ok) { toast('已取消，阅读位置保持不变'); return; }
  clearPosition(book.id);
  if (app.listening?.bookId === book.id) app.listening = null;
  paintShelf();
  toast(`《${title}》已回到开头`);
}

// -------------------------------------------------------------------- import
async function importFiles(files) {
  let imported = 0, duplicates = 0, skipped = 0, blank = 0;
  let firstError = '';
  for (const file of files) {
    const ext = extensionOf(file.name);
    if (!ALL_EXTENSIONS.includes(ext)) { skipped++; continue; }
    try {
      const { record, empty } = await buildBookRecord(file);
      if (empty) { blank++; continue; }
      if (await findDuplicate(record.fingerprint)) { duplicates++; continue; }
      await saveBook(record);
      imported++;
      if (server.online) {
        api.saveBook({
          id: record.id, title: record.title, author: record.author,
          format: record.format, paragraphs: record.segmentCount,
        }).catch(() => {});
      }
    } catch (err) {
      if (!firstError) firstError = `${file.name}：${err.message}`;
    }
  }
  await refreshShelf();
  const parts = [`已导入 ${imported} 本`];
  if (duplicates) parts.push(`${duplicates} 本已在书架，未重复添加`);
  if (blank) parts.push(`跳过 ${blank} 本空白 TXT`);
  if (skipped) parts.push(`跳过 ${skipped} 个不支持的文件`);
  if (firstError) parts.push(`失败：${firstError}`);
  toast(parts.join('；'), { tone: firstError ? 'error' : 'info', ms: 5600 });
}

$('fileInput').addEventListener('change', event => {
  const files = [...event.target.files];
  event.target.value = '';
  if (files.length) importFiles(files);
});

// -------------------------------------------------------------------- reader
async function openBook(book, { autoplay = false } = {}) {
  closePanels();
  const chapters = chaptersOf(book);
  if (!chapters.some(chapter => chapter.segments.length)) {
    toast(`《${book.title || book.filename}》没有提取到正文，请换一个文件`, { tone: 'error' });
    return;
  }
  app.book = book;
  app.chapters = chapters;
  app.segments = [];
  for (const chapter of chapters) {
    chapter.start = app.segments.length;
    for (const [index, text] of chapter.segments.entries()) app.segments.push({ chapter: chapter.index, index, text });
  }
  app.layoutKind = app.settings.layout || 'scrolled';
  const position = readPosition(book.id);
  app.playhead = position ? flatIndexOf(position.chapter, position.segment) : 0;
  app.bookmarks = [];

  $('readerTitle').textContent = book.title || book.filename;
  $('readerScreen').hidden = false;
  document.body.style.overflow = 'hidden';

  app.session?.stop();
  app.session = new AudioSession({ speed: app.settings.speed, voice: app.settings.voice, engine: app.settings.engine });
  app.session.addEventListener('statechange', onSpeechState);
  app.session.addEventListener('fallback', event => {
    toast(event.detail.reason, { tone: 'error', ms: 6000 });
    $('engineBadge').textContent = '引擎：系统语音';
  });
  app.session.addEventListener('engine', event => toast(event.detail.reason));
  app.session.addEventListener('error', event => toast(event.detail.message, { tone: 'error' }));

  buildLayout(app.playhead);
  await app.session.play(app.segments.map(segment => segment.text), app.playhead, { play: false });

  app.notes = new NotesController({
    book, container: $('notesBody'), api, server,
    onSeek: index => seekTo(index),
    current: () => positionOf(app.playhead),
  });
  app.notes.onChange = updateNoteCount;
  await app.notes.load();
  updateNoteCount();
  renderToc();
  loadBookmarks();
  app.music.setDucked(false);
  app.music.start().catch(() => {});
  if (autoplay) await startSpeech();
}

function buildLayout(startIndex) {
  app.layout?.destroy();
  app.layout = createLayout(app.layoutKind, $('bookRoot'));
  app.layout.setChapters(app.chapters);
  app.layout.onVisibleChange = chapter => {
    markTocCurrent(chapter);
    updateChapterLabel(chapter);
    updateReadingProgress(chapter);
    scheduleProgress();
  };
  app.layout.onChapter = chapter => seekTo(flatIndexOf(chapter, 0), { speak: true });
  app.layout.onSeek = index => seekTo(index, { speak: true });
  app.layout.render();
  app.playhead = Math.max(0, Math.min(startIndex, app.segments.length - 1));
  app.layout.markPosition(app.playhead);
  if (app.layoutKind === 'paged') app.layout.show(app.playhead);
  else app.layout.markActive(app.playhead);
  $('layoutButton').textContent = app.layoutKind === 'scrolled' ? '分页' : '连续';
  const { chapter, segment } = positionOf(app.playhead);
  updateChapterLabel(chapter);
  $('nowTitle').textContent = app.chapters[chapter]?.title || '';
  $('nowDetail').textContent = `第 ${segment + 1} 段 · 共 ${app.chapters[chapter]?.segments.length || 0} 段`;
  markTocCurrent(chapter);
  updateReadingProgress(chapter);
}

function updateChapterLabel(chapter) {
  const total = app.chapters.length;
  $('readerPlace').textContent = `第 ${chapter + 1} / ${total} 章 · ${app.chapters[chapter]?.title || ''}`;
}

function updateReadingProgress(chapter) {
  const ratio = app.chapters.length > 1 ? chapter / (app.chapters.length - 1) : 0;
  $('readingProgress').style.width = `${Math.max(2, Math.round(ratio * 100))}%`;
}

function renderToc() {
  const list = $('tocList');
  list.replaceChildren();
  app.chapters.forEach((chapter, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.chapter = String(index);
    button.textContent = chapter.title;
    button.onclick = () => { seekTo(flatIndexOf(index, 0), { speak: true }); closePanels(); };
    item.append(button);
    list.append(item);
  });
}

function markTocCurrent(chapter) {
  $('tocList').querySelectorAll('button').forEach(button => {
    button.classList.toggle('is-current', button.dataset.chapter === String(chapter));
  });
}

function updateNoteCount() {
  const count = app.notes?.items.length || 0;
  $('noteCount').textContent = count ? `(${count})` : '';
}

// ------------------------------------------------------------------ position
let progressTimer = null;
function scheduleProgress() {
  clearTimeout(progressTimer);
  progressTimer = setTimeout(persistPosition, 500);
}

function persistPosition() {
  if (!app.book) return;
  const seen = app.layout?.visibleSegment?.() || positionOf(app.playhead);
  writePosition(app.book.id, { chapter: seen.chapter, segment: seen.segment });
  if (server.online) {
    app.listening = { bookId: app.book.id, ...seen, lastReadAt: Date.now() };
    api.saveListening({ bookId: app.book.id, chapter: seen.chapter, segment: seen.segment });
  }
}

function seekTo(index, { speak = false } = {}) {
  if (!app.segments.length) return;
  const target = Math.max(0, Math.min(index, app.segments.length - 1));
  app.playhead = target;
  const { chapter, segment } = positionOf(target);
  if (app.layout) {
    app.layout.markPosition(target);
    if (app.layoutKind === 'paged') app.layout.show(target);
    else app.layout.markActive(target);
  }
  updateChapterLabel(chapter);
  $('nowTitle').textContent = app.chapters[chapter]?.title || '';
  $('nowDetail').textContent = `第 ${segment + 1} 段 · 共 ${app.chapters[chapter]?.segments.length || 0} 段`;
  markTocCurrent(chapter);
  updateReadingProgress(chapter);
  if (speak && app.session) app.session.jump(target);
  persistPosition();
  updateBookmarkButton();
}

// -------------------------------------------------------------------- speech
async function startSpeech() {
  if (!app.session) return;
  app.session.unlock();
  if (!app.session.queue) await app.session.play(app.segments.map(segment => segment.text), app.playhead, { play: false });
  app.session.resume();
  app.music.start().catch(() => {});
}

function onSpeechState(event) {
  const { state, segmentIndex } = event.detail;
  if (state === 'idle') {
    setSpeakLabel('▶ 朗读', '开始朗读');
    app.music.setDucked(false);
    syncMedia('none');
    return;
  }
  if (state === 'ended') {
    setSpeakLabel('▶ 朗读', '重新朗读');
    app.music.setDucked(false);
    $('nowDetail').textContent = '本书已读完';
    persistPosition();
    syncMedia('paused');
    toast('本书已读完');
    return;
  }
  if (Number.isInteger(segmentIndex) && (state === 'playing' || state === 'loading')) {
    app.playhead = segmentIndex;
    const { chapter, segment } = positionOf(segmentIndex);
    updateChapterLabel(chapter);
    markTocCurrent(chapter);
    updateReadingProgress(chapter);
    $('nowTitle').textContent = app.chapters[chapter]?.title || '';
    $('nowDetail').textContent = `第 ${segment + 1} / ${app.chapters[chapter]?.segments.length || 0} 段`;
    scheduleProgress();
    if (state === 'playing') app.layout?.markActive(segmentIndex);
    syncMedia(state === 'playing' ? 'playing' : 'paused');
  }
  if (state === 'playing') {
    setSpeakLabel('⏸ 暂停', '暂停朗读');
    app.music.setDucked(true);
    $('engineBadge').textContent = app.session?.engine_used === 'device' ? '引擎：系统语音' : '引擎：自然朗读';
  } else if (state === 'paused') {
    setSpeakLabel('▶ 继续', '继续朗读');
    app.music.setDucked(false);
    persistPosition();
  } else if (state === 'loading') {
    setSpeakLabel('… 缓冲', '正在准备朗读');
  }
}

function setSpeakLabel(text, label) {
  $('speakButton').textContent = text;
  $('speakButton').setAttribute('aria-label', label);
}

$('speakButton').onclick = async () => {
  if (!app.session) return;
  if (app.session.playing || app.session.state === 'loading') return app.session.pause();
  if (app.session.state === 'paused' || app.session.state === 'ready') return app.session.resume();
  return startSpeech();
};

function step(direction) {
  seekTo(app.playhead + direction, { speak: Boolean(app.session?.playing) });
}
$('prevSegment').onclick = () => step(-1);
$('nextSegment').onclick = () => step(1);

// ----------------------------------------------------------------- bookmarks
function updateBookmarkButton() {
  const { chapter, segment } = positionOf(app.playhead);
  const marked = app.bookmarks.some(item => item.chapterIndex === chapter && item.segmentIndex === segment);
  $('bookmarkAdd').textContent = marked ? '★ 已书签' : '☆ 书签';
}

async function loadBookmarks() {
  app.bookmarks = [];
  if (server.online && app.book) {
    try {
      const bundle = await api.bookBundle(app.book.id);
      app.bookmarks = bundle.bookmarks || [];
    } catch { app.bookmarks = []; }
  }
  updateBookmarkButton();
}

$('bookmarkAdd').onclick = async () => {
  if (!app.book) return;
  const { chapter, segment } = positionOf(app.playhead);
  const label = `${app.chapters[chapter]?.title || ''} · 第 ${segment + 1} 段`;
  if (app.bookmarks.some(item => item.chapterIndex === chapter && item.segmentIndex === segment)) {
    toast('这一段已经有书签了');
    return;
  }
  const local = {
    id: `local-${crypto.randomUUID()}`, chapterIndex: chapter, segmentIndex: segment,
    label, createdAt: new Date().toISOString(), pending: true,
  };
  app.bookmarks = [...app.bookmarks, local];
  updateBookmarkButton();
  toast(`已添加书签：${label}`);
  if (server.online) {
    api.addBookmark({ bookId: app.book.id, chapterIndex: chapter, segmentIndex: segment, label })
      .then(saved => {
        app.bookmarks = app.bookmarks.map(item => item.id === local.id ? { ...saved, pending: false } : item);
      })
      .catch(() => toast('书签已记在本次阅读中，家庭服务器暂未同步', { tone: 'error' }));
  }
};

// -------------------------------------------------------------------- panels
function togglePanel(name) {
  const panel = $(`${name}Panel`);
  if (!panel) return;
  if (panel.hasAttribute('hidden')) openPanel(name); else closePanels();
}

$('tocButton').onclick = () => togglePanel('toc');
$('notesButton').onclick = () => { app.notes?.render(); updateNoteCount(); togglePanel('notes'); };
$('settingsButton').onclick = () => { renderSettings(); togglePanel('settings'); };
$('layoutButton').onclick = () => switchLayout(app.layoutKind === 'scrolled' ? 'paged' : 'scrolled');

document.querySelectorAll('[data-close]').forEach(button => {
  button.onclick = () => closePanels();
});

function switchLayout(kind) {
  app.layoutKind = kind;
  app.settings = writeSettings({ layout: kind });
  buildLayout(app.playhead);
  $('layoutButton').textContent = kind === 'scrolled' ? '分页' : '连续';
  toast(kind === 'scrolled' ? '已切换为连续滚动阅读' : '已切换为分页听读');
}

// ------------------------------------------------------------------ settings
function renderSettings() {
  if (!app.settingsPanel) {
    app.settingsPanel = new SettingsPanel({
      container: $('settingsBody'),
      settings: app.settings,
      music: app.music,
      voices: () => app.voicesData,
      onChange: patch => {
        app.settings = writeSettings(patch);
        app.settingsPanel.settings = app.settings;
        applyTheme();
        if (patch.speed !== undefined) app.session?.setSpeed(patch.speed);
        if (patch.voice !== undefined) app.session?.setVoice(patch.voice);
        if (patch.musicLevel !== undefined) app.music.setLevel(patch.musicLevel);
        if (patch.ducking !== undefined) app.music.setDucking(patch.ducking);
        if (patch.layout !== undefined && patch.layout !== app.layoutKind) { switchLayout(patch.layout); return; }
        renderSettings();
      },
      onMusic: () => $('musicInput').click(),
      onMusicClear: async () => { await app.music.clear(); renderSettings(); toast('已移除本机背景音乐'); },
      onManageVoices: () => { closePanels(); togglePanel('voices'); app.voices?.load(); },
    });
  } else {
    app.settingsPanel.settings = app.settings;
  }
  app.settingsPanel.render();
}

$('musicInput').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    await app.music.choose(file);
    await app.music.start();
    renderSettings();
    toast(`背景音乐「${file.name}」已保存在本机`);
  } catch (err) {
    toast(`背景音乐没能保存：${err.message}`, { tone: 'error' });
  }
});

// -------------------------------------------------------------------- voices
// The voices panel is reachable from the shelf (no reader open) and from the
// settings panel of an open book, so it has to survive the reader closing.
$('openVoices').onclick = () => {
  closeReader();
  openPanel('voices');
  app.voices?.load();
};

// ------------------------------------------------------------------ strategy
function syncMedia(state) {
  app.media?.update({
    title: app.segments[app.playhead]?.text || '',
    artist: app.book?.author || '陪你读书',
    album: app.book?.title || '',
    state,
  });
}

function closeReader() {
  persistPosition();
  app.session?.stop();
  app.session = null;
  app.music.pause();
  app.music.setDucked(false);
  app.layout?.destroy();
  app.layout = null;
  app.book = null;
  app.media?.update({ state: 'none' });
  $('readerScreen').hidden = true;
  document.body.style.overflow = '';
  closePanels();
  paintShelf();
}
$('closeReader').onclick = closeReader;

// ------------------------------------------------------------------ keyboard
document.addEventListener('keydown', event => {
  if ($('readerScreen').hidden) return;
  const shortcut = shortcutFor(event, app.layoutKind);
  if (!shortcut) return;
  event.preventDefault();
  if (shortcut.action === 'next') step(1);
  else if (shortcut.action === 'prev') step(-1);
  else if (shortcut.action === 'page-next') seekTo(app.playhead + 1);
  else if (shortcut.action === 'toggle-speech') $('speakButton').click();
  else if (shortcut.action === 'close-panels') {
    const open = [...document.querySelectorAll('.panel')].some(panel => !panel.hidden);
    if (open) closePanels(); else closeReader();
  } else if (shortcut.action === 'toggle-panel') togglePanel(shortcut.panel);
  else if (shortcut.action === 'add-bookmark') $('bookmarkAdd').click();
  else if (shortcut.action === 'start') seekTo(0);
  else if (shortcut.action === 'speed') {
    app.settings = writeSettings({ speed: shortcut.value });
    app.session?.setSpeed(shortcut.value);
    toast(`语速 ${shortcut.value.toFixed(1)}×`);
  }
});

$('shelfSearch').addEventListener('input', paintShelf);

// ---------------------------------------------------------------------- boot
async function boot() {
  applyTheme();
  app.media = setupMediaSession({
    play: () => startSpeech(),
    pause: () => app.session?.pause(),
    next: () => step(1),
    prev: () => step(-1),
    stop: () => { app.session?.stop(); app.music.setDucked(false); },
  });
  app.voices = new VoicesController({
    container: $('voicesBody'),
    api,
    server,
    notify: toast,
    onPrefer: async voiceId => { await api.preferVoice(voiceId); app.settings = writeSettings({ voice: voiceId }); },
  });
  try {
    await refreshShelf();
  } catch (err) {
    toast(`本机书库打不开：${err.message}`, { tone: 'error', ms: 8000 });
  }
  const health = await probeServer();
  $('serverDot').dataset.online = String(Boolean(health));
  $('serverLabel').textContent = health
    ? `家庭服务器已连接${health.narration?.available === false ? '（自然朗读未配置）' : ''}`
    : '仅本机模式';
  if (health) {
    $('engineBadge').textContent = health.narration?.available === false ? '引擎：系统语音' : '引擎：自然朗读';
    try {
      const bundle = await api.voices();
      app.voicesData = bundle.voices || [];
    } catch {}
  }
  await app.music.restore();
}

boot();

export { app, seekTo, openBook, startSpeech, persistPosition };
