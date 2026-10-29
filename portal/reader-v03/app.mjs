// 陪你读书 V0.3 application wiring.
//
// Sections: settings, shelf, reading (foliate-js EPUB + TXT), continuous
// listening (Narration + pluggable speech engines), notes, household voices,
// 听世界. DOM-first, no framework: every screen is a section in index.html and
// all persistence goes through lib/store.mjs (IndexedDB, local only).

import { makeBook } from '../vendor/foliate-js/view.js';
import { splitChapters, percent, formatMilliseconds } from './lib/text.mjs';
import { Narration, State } from './lib/narration.mjs';
import { bookFromTxt, isBookFinished, mapEpubSections, pickText, paragraphsFromHtml, totalParagraphs } from './lib/book.mjs';
import { BrowserEngine, EndpointEngine, LibraryVoiceEngine, ToneEngine, isAbort } from './lib/engines.mjs';
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
  endpoint: { baseUrl: '', model: '', voice: '', apiKey: '' },
  library: { baseUrl: params.get('voiceLibrary') || '', token: '', voiceId: '' },
  music: { volume: 0.18, ducking: true },
  statistics: { days: {}, listenedMs: 0 },
  worldFavourites: [],
};
const mergeSettings = patch => ({
  ...settings,
  ...patch,
  endpoint: { ...settings.endpoint, ...patch.endpoint },
  library: { ...settings.library, ...patch.library },
  music: { ...settings.music, ...patch.music },
  statistics: { ...settings.statistics, ...patch.statistics },
});

let settings = DEFAULT_SETTINGS;
try {
  settings = mergeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
} catch { /* corrupted preferences fall back to defaults */ }
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

// --------------------------------------------------------------------------
// Speech engines
// --------------------------------------------------------------------------
let narration = null;
let currentEngine = null;
let activeVoice = null;

const buildEngine = (kind = settings.engine) => {
  if (kind === 'endpoint' && settings.endpoint.baseUrl) {
    try {
      return new EndpointEngine({ ...settings.endpoint, speed: settings.rate, name: settings.endpoint.model || '神经网络语音' });
    } catch (error) {
      status(`没接通语音服务：${error.message}`, 'warn');
    }
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
  if (engine.kind === 'endpoint') return `神经网络语音「${engine.name}」：朗读文本会发送到 ${engine.baseUrl}。`;
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

function progressLabel(book) {
  const saved = bookProgress(book.id);
  if (!saved) return '尚未开始';
  if (saved.finished) return '已读完 · 可再听一遍';
  const chapter = saved.chapterTitle || `第 ${Number(saved.chapter || 0) + 1} 章`;
  return `${saved.listening ? '听到' : '读到'} ${chapter} · ${percent(saved.fraction ?? 0)}`;
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
    listen.onclick = () => openBook(book, { listen: true });
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
    const label = { browser: 'readyBrowser', endpoint: 'readyEndpoint', library: 'readyLibrary' }[kind];
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
  set('endpoint', settings.endpoint.baseUrl ? 'yes' : 'no',
    settings.endpoint.baseUrl ? `已配置：${settings.endpoint.baseUrl}（文本会发往该服务）。` : '尚未配置，可选；配置后音质更好但需要自己的语音服务。');
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
  if (!$('screen-reader').hidden && !activeBook) showScreen('shelf');
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

const isTxt = book => formatOf(book) === 'TXT';

async function openBook(book, { listen = false } = {}) {
  const token = ++renderToken;
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
    status(`已打开《${bookModel.title || titleOf(book)}》· ${bookModel.chapters.length} 章 · ${totalParagraphs(bookModel)} 段`);
    if (listen) {
      // startPosition() is the one place that turns a finished book back into a
      // fresh pass. Passing the saved cursor directly would reopen a finished
      // book on its last paragraph and stop again immediately.
      await startListening();
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
  // One narration chapter per spine section; paragraph text is extracted up
  // front so listening works with the reading pane closed or off-screen.
  for (const chapter of bookModel.chapters) {
    const doc = await epub.sections[chapter.sectionIndex].createDocument();
    chapter.paragraphs = paragraphsFromHtml(doc.documentElement?.outerHTML || doc.body?.innerHTML || '');
    if (!chapter.paragraphs.length) chapter.paragraphs = [chapter.title];
  }
  if (token !== renderToken) return;
  view.addEventListener('relocate', event => {
    if (activeBook?.id !== book.id) return;
    const { fraction, tocItem, cfi } = event.detail || {};
    $('position').textContent = `${tocItem?.label ? `${tocItem.label} · ` : ''}${percent(fraction ?? 0)}`;
    if (!narration?.active && cfi) {
      const chapter = chapterIndexFromCfi(cfi);
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
  // and silently fall back to the first page.
  const startSection = (saved.chapter ?? 0) >= 0 && narration?.active !== true ? Math.min(saved.chapter ?? 0, epub.sections.length - 1) : 0;
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

// Clicking a paragraph in the book selects it for notes and listening.
function onEpubSectionLoad({ doc, index } = {}, bookId) {
  if (!doc || activeBook?.id !== bookId) return;
  doc.addEventListener('click', event => {
    const paragraph = event.target.closest?.('p,li,h1,h2,h3,h4,blockquote');
    if (!paragraph) return;
    const chapter = bookModel.chapters[index];
    if (!chapter) return;
    const text = paragraph.textContent?.replace(/\s+/g, ' ').trim() || '';
    const found = chapter.paragraphs.findIndex(item => item.startsWith(text.slice(0, 24)));
    const target = found >= 0 ? found : 0;
    doc.querySelectorAll('.rw-active').forEach(el => el.classList.remove('rw-active'));
    paragraph.classList.add('rw-active');
    const style = doc.createElement?.('style');
    if (style && !doc.querySelector('#rw-active-style')) {
      style.id = 'rw-active-style';
      style.textContent = '.rw-active{background:#f1efe2;border-radius:6px;box-shadow:0 0 0 .35rem #f1efe2}';
      doc.head?.append(style);
    }
    setCursor(index, target);
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
  $('nowChapter').textContent = `${ch.title}（第 ${target + 1}/${ch.paragraphs.length} 段）`;
  $('nowSentence').textContent = (ch.paragraphs[target] || '').slice(0, 70);
}

function renderChapterList() {
  const list = $('chapterList');
  list.replaceChildren();
  $('chapterCount').textContent = bookModel ? `${bookModel.chapters.length} 章` : '';
  if (!bookModel) return;
  bookModel.chapters.forEach((chapter, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = chapter.title;
    button.dataset.chapter = String(index);
    button.setAttribute('aria-current', String(index === currentChapter));
    button.onclick = () => goToChapter(index);
    li.append(button);
    list.append(li);
  });
}

function markCurrentChapter(index) {
  $('chapterList').querySelectorAll('button[data-chapter]').forEach(button => {
    button.setAttribute('aria-current', String(Number(button.dataset.chapter) === index));
  });
}

// Show the paragraph at (chapter, paragraph): EPUB turns to the section, TXT
// renders a scrolling page of twelve paragraphs centred on it.
async function showParagraph(chapterIndex, paragraphIndex, { scroll = false, persist = true } = {}) {
  if (!bookModel) return;
  chapterIndex = Math.max(0, Math.min(bookModel.chapters.length - 1, chapterIndex | 0));
  const chapter = bookModel.chapters[chapterIndex];
  currentChapter = chapterIndex;
  currentParagraph = Math.max(0, Math.min(Math.max(0, chapter.paragraphs.length - 1), paragraphIndex | 0));
  markCurrentChapter(chapterIndex);
  $('nowChapter').textContent = chapter.title;
  $('position').textContent = `${chapter.title} · 第 ${currentParagraph + 1}/${chapter.paragraphs.length} 段`;
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
  const start = Math.floor(currentParagraph / 12) * 12;
  chapter.paragraphs.slice(start, start + 12).forEach((text, offset) => {
    const p = document.createElement('p');
    p.textContent = text;
    if (start + offset === currentParagraph) p.classList.add('active');
    page.append(p);
  });
  page.prepend(heading);
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
  $('readerTitle').textContent = '未打开书籍';
  $('nowChapter').textContent = '选一本书开始';
  $('nowSentence').textContent = '—';
  $('chapterList').replaceChildren();
  $('position').textContent = '—';
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
          const last = Math.max(0, (bookModel?.chapters.length ?? 1) - 1);
          const ch = bookModel?.chapters[last];
          saveProgress(activeBook.id, {
            chapter: last, paragraph: Math.max(0, (ch?.paragraphs.length ?? 1) - 1),
            chapterTitle: ch?.title || '', finished: true, listening: true, fraction: 1,
          });
        }
        status('这本书已经读完了。再点播放会从第一章重听，也可以从书架换一本。');
      }
      syncDucking();
    },
    onProgress: ({ chapterChanged, chapter, paragraph, state }) => {
      if (!bookModel) return;
      const ch = bookModel.chapters[chapter];
      if (!ch) return;
      currentChapter = chapter;
      currentParagraph = paragraph;
      $('nowChapter').textContent = `${ch.title}（第 ${paragraph + 1}/${ch.paragraphs.length} 段）`;
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
      if (foliateView) return;
      const page = $('txtPage');
      const start = Math.floor(paragraph / 12) * 12;
      const target = page.querySelectorAll('p')[paragraph - start];
      if (!target) return;
      page.querySelectorAll('p.active').forEach(el => el.classList.remove('active'));
      target.classList.add('active');
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
  return { chapter: 0, paragraph: 0 };
}

// Every transition runs through here so an "idle"/"ended" engine is always
// attached to the book that is on screen now, never to a previously opened one.
async function narrationFor(position) {
  const engine = await ensureNarration();
  if (engine.book !== bookModel) engine.load(bookModel, position);
  else if (position) engine.jump(position);
  return engine;
}

async function startListening(position = null) {
  if (!bookModel) { status('先在书架选一本书。', 'warn'); return; }
  currentEngine = buildEngine();
  if (!currentEngine) return;
  refreshEngineBadge();
  const target = position || startPosition();
  // Put the reading pane on the same paragraph as the audio before speaking.
  // TXT books have no renderer until this runs, and a finished EPUB must turn
  // back to the first section when listening restarts from the beginning.
  await showParagraph(target.chapter ?? 0, target.paragraph ?? 0, { scroll: true, persist: false });
  const engine = await narrationFor(target);
  await engine.start();
}

function togglePlay() {
  if (!bookModel) { status('先在书架选一本书。', 'warn'); return; }
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
    if (isFinished()) return startListening();
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
  const label = { browser: '本机语音', endpoint: '神经网络', library: '家庭声音', tone: '测试音' }[engine?.kind] || '引擎';
  $('engineBadge').textContent = label;
  $('engineBadge').dataset.kind = engine?.kind || '';
  $('engineHint').textContent = engineHint(engine);
}

// --------------------------------------------------------------------------
// Notes (local only; AI discussion is opt-in via ?aiEndpoint=)
// --------------------------------------------------------------------------
const aiEndpoint = { baseUrl: params.get('aiEndpoint') || '', key: '' };

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
    if (note.ai) {
      const ai = document.createElement('div');
      ai.className = 'hint';
      ai.textContent = `AI 讨论：${note.ai}`;
      card.append(ai);
    }
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

async function saveNote({ text, quote = '', ai = '' }) {
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
    ai,
    createdAt: now(),
  };
  await store.putNote(note);
  await renderNotes();
  status('笔记已保存在本机');
  return note;
}

async function askAI(question) {
  if (!aiEndpoint.baseUrl) {
    return '还没有接通 AI 讨论服务：用 ?aiEndpoint=https://你的服务/v1 打开本页即可，文本只会发送到你指定的服务。';
  }
  const chapter = bookModel?.chapters[currentChapter]?.title || '';
  const response = await fetch(`${aiEndpoint.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(aiEndpoint.key ? { authorization: `Bearer ${aiEndpoint.key}` } : {}) },
    body: JSON.stringify({
      model: params.get('aiModel') || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '你是孩子的阅读伙伴，用温暖、简短、适合一起讨论的中文回答，并提一个帮助思考的问题。' },
        { role: 'user', content: `我在读《${bookModel?.title || ''}》${chapter ? `的${chapter}` : ''}。\n原文：${currentParagraphText().slice(0, 600)}\n我的问题：${question}` },
      ],
      temperature: 0.7,
    }),
  });
  if (!response.ok) throw new Error(`AI 服务返回 ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'AI 没有返回内容';
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
// endpoint reads, so this is not cosmetic. Deletion is final and confirmed.
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
  const options = [
    ['browser', '本机浏览器语音（离线、不上传）'],
    ['endpoint', settings.endpoint.baseUrl ? `神经网络语音：${settings.endpoint.model || settings.endpoint.voice || '已配置服务'}` : '神经网络语音（未配置）'],
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
    settings.endpoint.apiKey ? `神经网络音频已启用：文本只发往 ${settings.endpoint.baseUrl}，密钥仅保存在本机。` : '神经网络语音未设置密钥：文本不会离开本机。',
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
  $('rate').value = String(settings.rate);
  $('endpointUrl').value = settings.endpoint.baseUrl;
  $('endpointModel').value = settings.endpoint.model;
  $('endpointVoice').value = settings.endpoint.voice;
  $('endpointKey').value = settings.endpoint.apiKey ? '••••••••' : '';
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
  if (kind === 'endpoint' && !settings.endpoint.baseUrl) status('神经网络语音还没有配置服务地址，请到「声音」页填写。', 'warn');
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
  if (name === 'voices') renderVoiceList();
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
  $('files').onchange = async event => {
    const files = [...event.target.files];
    event.target.value = '';
    if (files.length) await importFiles(files);
  };
  $('shelfSearch').oninput = () => renderShelf();
  $('backToShelf').onclick = async () => { showScreen('shelf'); await refreshShelf(); };

  $('playButton').onclick = toggleFromKeyboard;
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
  $('saveEndpoint').onclick = () => {
    settings.endpoint = {
      baseUrl: $('endpointUrl').value.trim(),
      model: $('endpointModel').value.trim(),
      voice: $('endpointVoice').value.trim(),
      apiKey: $('endpointKey').value.startsWith('•') ? settings.endpoint.apiKey : $('endpointKey').value.trim(),
    };
    saveSettings();
    currentEngine = null;
    updateEngineControls();
    status(settings.endpoint.baseUrl ? '语音服务已保存在本机。' : '已清除语音服务地址。');
  };
  $('clearEndpoint').onclick = () => {
    settings.endpoint = { baseUrl: '', model: '', voice: '', apiKey: '' };
    if (settings.engine === 'endpoint') settings.engine = 'browser';
    saveSettings();
    currentEngine = null;
    updateEngineControls();
    refreshEngineBadge();
    status('已清除语音服务设置。');
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
    $('aiAnswer').hidden = true;
  };
  $('aiNote').onclick = async () => {
    const question = $('noteText').value.trim() || '这段话是什么意思？';
    const box = $('aiAnswer');
    box.hidden = false;
    box.textContent = '正在和 AI 讨论…';
    try {
      const answer = await askAI(question);
      box.textContent = answer;
      await saveNote({ text: `问：${question}\n答：${answer}`, quote: currentParagraphText().slice(0, 160), ai: answer });
    } catch (error) {
      box.textContent = `AI 讨论失败：${error.message}`;
    }
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
  document.addEventListener('keydown', event => {
    if (event.target.matches?.('input,textarea,select')) return;
    if (!$('screen-reader').hidden && event.code === 'Space') { event.preventDefault(); toggleFromKeyboard(); }
  });
  window.addEventListener('beforeunload', () => { narration?.stop({ keepPosition: false }); });
}

async function init() {
  wireEvents();
  updateConsentState();
  showScreen('shelf');
  await store.openReaderDb();
  await refreshShelf();
  await restoreMusic();
  updateEngineControls();
  renderStats();
  renderWorld();
  renderVoiceList();
  renderReadiness();
  $('importButton').disabled = false;
  if (libraryConfigured()) loadVoices();
  status(books.length
    ? '书架已就绪。点「听书」就能从上次的位置连续朗读；进度只保存在本机。'
    : '书架还空着。导入一本 EPUB / TXT，或点「先用示范书试试」听一段，不需要任何账号或密钥。');
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

