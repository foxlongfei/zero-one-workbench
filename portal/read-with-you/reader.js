// The reading room: one book open, narration that carries across chapters,
// quiet notes, background sound, and a place that remembers where you stopped.

import { makeBook } from '../vendor/foliate-js/view.js';
import { Overlayer } from '../vendor/foliate-js/overlayer.js';
import {
  get, getAllByIndex, put, del, audit, getSettings, setSetting,
  savePosition, getPosition, getStore,
} from './state.js';
import {
  Narration, createSpeechEngine, parsePlainText, preferredVoice, voiceLanguageFor,
} from './tts.js';
import {
  listVoices, getSamples, voiceSettingsFor, suggestSystemVoice, trialText, voiceUsage,
} from './family-voice.js';
import { BackgroundAudio, AMBIENCE_RADIOS as curatedRadios } from './background.js';
import { AMBIENCE, makeAmbience } from './ambience.js';
import { notesFor, excerptAround, discussionPrompts, gentleLines, highlightTerms, NOTE_KINDS } from './notes.js';
import { $, h, toast, formatDuration, relativeTime, escapeHtml } from './ui.js';

const engine = createSpeechEngine(window.speechSynthesis, window.SpeechSynthesisUtterance);
const params = new URLSearchParams(location.search);

const state = {
  book: null,
  format: '',
  view: null,
  plain: null,
  chapters: [],
  chapterIndex: 0,
  chapterCache: new Map(),
  sectionChapter: [],
  cue: null,
  settings: {},
  position: { fraction: 0, cfi: null, plain: null, chapter: 0, sentence: 0 },
  families: [],
  voicesCache: [],
  selectedFamilyId: '',
  selectionQuote: null,
  openRun: 0,
  lastSavedAt: 0,
  currentSentence: '',
  savedChunk: null,
};

const DEFAULTS = {
  theme: 'paper',
  fontSize: 19,
  lineHeight: 1.9,
  measure: 34,
  focus: 'off',
  voice: 'auto',
  voiceName: '',
  rate: 1,
  pitch: 1,
  ambienceVolume: 0.4,
  familyVoice: '',
};

const AMBIENCE_RADIOS = [...(globalThis.RWY_CURATED_RADIOS || [])];

// ---------------------------------------------------------------------------
// Boot

async function boot() {
  try {
    const settings = await getSettings();
    state.settings = { ...DEFAULTS, ...Object.fromEntries(Object.entries(settings).filter(([key]) => key in DEFAULTS)) };
  } catch (error) {
    state.settings = { ...DEFAULTS };
    toast(`本机存储暂时不可用：${error.message}`);
  }
  applyReadingSettings();
  const bookId = params.get('book');
  if (!bookId) {
    location.replace('./index.html');
    return;
  }
  await loadVoices();
  syncVoiceSelect();
  wireChrome();
  try {
    state.book = await get('books', bookId);
  } catch (error) {
    fail(`书库读取失败：${error.message}`);
    return;
  }
  if (!state.book?.blob) {
    fail('书架里找不到这本书，可能已被删除。');
    return;
  }
  document.title = `陪你读书 · ${state.book.title || '阅读'}`;
  $('#bookTitle').textContent = state.book.title || state.book.filename || '未命名';
  $('#bookMeta').textContent = [state.book.author, state.book.format, state.book.chapterCount ? `${state.book.chapterCount} 章` : ''].filter(Boolean).join(' · ');
  state.position = (await getPosition(bookId)) || { fraction: 0, chapter: 0, sentence: 0 };
  await openBook(bookId);
  await restoreBackgroundScene();
  registerMediaSession();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistPosition(true);
  });
  window.addEventListener('pagehide', () => {
    narration.stop();
    persistPosition(true);
    if (state.view) state.view.close();
  });
}

function fail(message) {
  $('#nowText').textContent = message;
  $('#nowMeta').textContent = '返回书库重新导入即可';
  $('#playPause').disabled = true;
}

// ---------------------------------------------------------------------------
// Book loading: paginated EPUB/FB2/etc. via foliate-js, or the plain-text lane.

async function openBook(bookId) {
  const run = ++state.openRun;
  const blob = state.book.blob;
  const name = state.book.filename || '';
  const isPlain = /^(TXT|MD)$/i.test(state.book.format || '') || /\.(txt|md)$/i.test(name);
  if (isPlain) {
    const text = await blob.text();
    if (run !== state.openRun) return;
    openPlain(text);
    return;
  }
  const file = blob instanceof File ? blob : new File([blob], name || 'book.epub', { type: blob.type });
  let book;
  try {
    book = await makeBook(file);
  } catch (error) {
    fail(`这本书打不开：${error.message}`);
    return;
  }
  if (run !== state.openRun) return;
  import('../vendor/foliate-js/view.js').then(() => {});
  await ensureViewDefined();
  const view = document.createElement('foliate-view');
  view.id = 'foliateView';
  view.setAttribute('flow', 'paginated');
  $('#plainHost').hidden = true;
  $('#bookHost').hidden = false;
  $('#bookHost').replaceChildren(view);
  state.view = view;
  view.addEventListener('relocate', onRelocate);
  view.addEventListener('load', () => scheduleProgressSave());
  view.addEventListener('create-overlay', ({ detail }) => attachOverlay(detail));
  await view.open(book);
  if (run !== state.openRun) {
    view.close();
    return;
  }
  const savedCfi = state.position.cfi;
  let recovered = null;
  try {
    await view.init({ lastLocation: savedCfi || null, showTextStart: true });
  } catch (error) {
    console.warn('saved position invalid', error);
    recovered = state.position.fraction || state.position.cfi ? '保存的阅读位置失效，已从书首打开' : null;
    if (savedCfi) await view.goToTextStart();
  }
  if (recovered) toast(recovered);
  // Map TOC entries to their chapter order once, so the narration cue can find
  // "the chapter I'm in" without depending on anchors inside the flow.
  state.tocChapters = await Promise.all(view.book.toc || []).catch(() => null) || null;
  buildSectionMap(view);
  await refreshBookMeta(view);
  maybeRestoreNarrationCue();
}

async function ensureViewDefined() {
  if (!customElements.get('foliate-view')) await import('../vendor/foliate-js/view.js');
}

function buildSectionMap(view) {
  const toc = view.book?.toc || [];
  const entries = [];
  const walk = (items) => {
    for (const item of items || []) {
      entries.push(item);
      walk(item.subitems);
    }
  };
  walk(toc);
  state.tocEntries = entries;
  state.sectionChapter = [];
  for (const item of entries) {
    const resolved = view.resolveNavigation?.(item.href);
    if (resolved?.index != null) state.sectionChapter[resolved.index] = item;
  }
}

async function refreshBookMeta(view) {
  const meta = view.book?.metadata || {};
  const title = typeof meta.title === 'string' ? meta.title : state.book.title;
  const author = typeof meta.author === 'string' ? meta.author : state.book.author;
  if (title) {
    $('#bookTitle').textContent = title;
    document.title = `陪你读书 · ${title}`;
  }
  if (author) {
    $('#bookMeta').textContent = [author, state.book.format].filter(Boolean).join(' · ');
  }
}

function onRelocate(event) {
  const detail = event.detail || {};
  const sectionItem = state.sectionChapter?.[detail.index];
  const chapterIndex = sectionItem ? state.tocEntries.indexOf(sectionItem) : state.chapterIndex;
  state.chapterIndex = chapterIndex >= 0 ? chapterIndex : state.chapterIndex;
  state.position = {
    ...state.position,
    cfi: detail.cfi || state.position.cfi,
    fraction: Number.isFinite(detail.fraction) ? detail.fraction : state.position.fraction,
    chapter: state.chapterIndex,
    label: detail.tocItem?.label || sectionItem?.label || '',
  };
  updateProgress();
  scheduleProgressSave();
}

function updateProgress() {
  const fraction = Math.max(0, Math.min(1, Number(state.position.fraction) || 0));
  $('#progressFill').style.width = `${(fraction * 100).toFixed(2)}%`;
  $('#progressBar').setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
}

// Plain-text lane ----------------------------------------------------------

function openPlain(text) {
  const chapters = parsePlainText(text);
  state.chapters = chapters;
  state.plain = { chapters };
  const saved = state.position.plain;
  const startChapter = clamp(Number(saved?.chapter ?? state.position.chapter ?? 0), 0, chapters.length - 1);
  state.chapterIndex = startChapter;
  const host = $('#plainHost');
  $('#bookHost').hidden = true;
  $('#bookHost').replaceChildren();
  host.hidden = false;
  host.replaceChildren(h('article', { id: 'plainArticle' }));
  renderPlainFrom(startChapter);
  const fractionOf = (chapter, sentence) => {
    const total = chapters.reduce((sum, ch) => sum + ch.sentences.length, 0) || 1;
    const before = chapters.slice(0, chapter).reduce((sum, ch) => sum + ch.sentences.length, 0);
    return Math.min(1, (before + sentence) / total);
  };
  state.fractionOf = fractionOf;
  state.position = { ...state.position, fraction: fractionOf(startChapter, Number(saved?.sentence) || 0), plain: { chapter: startChapter, sentence: Number(saved?.sentence) || 0 }, chapter: startChapter };
  updateProgress();
  host.addEventListener('scroll', () => {
    if (state.plainScrollLock) return;
    const article = $('#plainArticle');
    if (!article) return;
    const max = host.scrollHeight - host.clientHeight;
    const base = state.plainWindow?.base || 0;
    const windowSpan = state.plainWindow?.span || 1;
    const share = max > 0 ? host.scrollTop / max : 0;
    state.position.fraction = Math.min(1, base + share * windowSpan);
    updateProgress();
    scheduleProgressSave();
  });
  host.addEventListener('click', (event) => {
    const paragraph = event.target.closest('p[data-sentence]');
    if (paragraph && !window.getSelection()?.toString()) {
      startPlainNarration(state.chapterIndex, Number(paragraph.dataset.sentence));
    }
  });
  window.addEventListener('scroll', () => {
    if (state.plain && document.activeElement?.closest?.('#settingsPanel')) saveSettingSilently();
  }, { passive: true });
  if (saved?.sentence) {
    const paragraph = $(`#plainHost p[data-sentence="${saved.sentence}"][data-chapter="${startChapter}"]`);
    paragraph?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
}

function renderPlainFrom(chapterIndex) {
  const article = $('#plainArticle');
  if (!article) return;
  const chapters = state.chapters;
  // Window of chapters keeps the DOM light for a full novel while allowing
  // continuous scrolling between neighbours.
  const from = Math.max(0, chapterIndex - 1);
  const to = Math.min(chapters.length - 1, chapterIndex + 2);
  const nodes = [];
  for (let index = from; index <= to; index++) {
    const chapter = chapters[index];
    nodes.push(h('h2', { id: `chapter-${index}`, text: chapter.title || `第 ${index + 1} 节` }));
    for (const [sentenceIndex, sentence] of chapter.sentences.entries()) {
      nodes.push(h('p', { dataset: { sentence: sentenceIndex, chapter: index }, text: sentence }));
    }
  }
  article.replaceChildren(...nodes);
  state.plainWindow = { from, to, base: fractionOfChapter(from), span: fractionOfChapter(to + 1) - fractionOfChapter(from) };
}

function fractionOfChapter(chapterIndex) {
  const total = state.chapters.reduce((sum, ch) => sum + ch.sentences.length, 0) || 1;
  const before = state.chapters.slice(0, chapterIndex).reduce((sum, ch) => sum + ch.sentences.length, 0);
  return Math.min(1, before / total);
}

function highlightPlain(chapterIndex, sentenceIndex) {
  for (const el of document.querySelectorAll('#plainHost p.narrating')) el.classList.remove('narrating');
  const el = $(`#plainHost p[data-chapter="${chapterIndex}"][data-sentence="${sentenceIndex}"]`);
  if (el) {
    el.classList.add('narrating');
    const host = $('#plainHost');
    const rect = el.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    if (rect.top < hostRect.top + 40 || rect.bottom > hostRect.bottom - 120) {
      state.plainScrollLock = true;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => (state.plainScrollLock = false), 700);
    }
  }
}

// ---------------------------------------------------------------------------
// Narration

const narration = new Narration(engine, {
  onState: updateNarrationState,
  onProgress: onNarrationProgress,
  onEnd: () => {
    updateNarrationState('ended');
    toast('全书读完了。要不要写下一点什么，或者回去再听一遍？');
    $('#nowText').textContent = '已读到全书结尾';
  },
  onError: (error) => {
    const message = error?.message || error?.error || '朗读意外中断';
    $('#narrate').dataset.state = 'error';
    $('#nowText').textContent = `朗读中断：${message}`;
    $('#nowMeta').textContent = '可以按播放从这句继续';
    background.duck(false);
    updateMediaSession('paused');
  },
});

function updateNarrationState(mode) {
  $('#narrate').dataset.state = mode;
  const button = $('#playPause');
  const labels = { speaking: '暂停', paused: '继续', idle: '开始朗读', ended: '重新朗读', error: '再试一次' };
  button.textContent = mode === 'speaking' ? '⏸' : '▶';
  button.setAttribute('aria-label', labels[mode] || '朗读');
  background.duck(mode === 'speaking');
  updateMediaSession(mode === 'speaking' ? 'playing' : 'paused');
}

function onNarrationProgress(progress) {
  const chunk = progress.chunk;
  if (!chunk) return;
  state.savedChunk = chunk;
  if (progress.index % 1 === 0) {
    $('#nowText').textContent = chunk.text.length > 46 ? `${chunk.text.slice(0, 46)}…` : chunk.text;
    const chapterLabel = chunk.title ? ` · ${chunk.title}` : '';
    $('#nowMeta').textContent = `第 ${progress.index + 1} / ${progress.total} 句${chapterLabel}`;
  }
  state.currentSentence = chunk.text;
  if (chunk.plain) highlightPlain(chunk.chapter, chunk.sentence);
  else if (chunk.range) highlightRange(chunk.range);
  state.position = {
    ...state.position,
    fraction: chunk.fraction ?? state.position.fraction,
    chapter: chunk.chapter,
    label: chunk.title || state.position.label,
    plain: chunk.plain ? { chapter: chunk.chapter, sentence: chunk.sentence } : state.position.plain,
  };
  updateProgress();
  scheduleProgressSave();
  if (progress.boundary) updateWordBoundary(chunk, progress.boundary);
}

function makeChunks() {
  const id = state.book.id;
  if (!state.plain) return makeViewChunks(id);
  const chunks = [];
  const total = state.chapters.reduce((sum, ch) => sum + ch.sentences.length, 0) || 1;
  let seen = 0;
  for (const chapter of state.chapters) {
    for (const [sentenceIndex, sentence] of chapter.sentences.entries()) {
      chunks.push({
        chapter: chapter.index,
        title: chapter.title,
        text: sentence,
        sentence: sentenceIndex,
        plain: true,
        fraction: seen / total,
      });
      seen++;
    }
  }
  return chunks;
}

async function makeViewChunks(bookId) {
  const cache = state.chapterCache;
  async function* blocksOf(index, chapter) {
    if (cache.has(bookId)) {
      yield* cache.get(bookId);
      return;
    }
    try {
      if (state.view?.lastLocation) {
        await Promise.resolve();
      }
      await ensureViewDefined();
      const init = await Promise.resolve();
      void init;
      await state.view.initTTS?.('sentence', drawHighlight);
      if (!state.view?.tts) return;
      let started = false;
      if (state.view.lastLocation?.index === index) {
        state.view.tts.#lastMark = null;
      }
      // Resume semantics: the TTS cursor follows voice().next(), which starts
      // from the current section. Re-open the chapter before walking it.
      await state.view.goTo(index);
      started = true;
      const blocks = [];
      for (let guard = 0; guard < 400; guard++) {
        const lastIndex = state.chapterCursor?.index ?? index;
        const ssml = state.ttsWantsResume ? state.view.tts.resume() : state.view.tts.next(false);
        state.ttsWantsResume = false;
        if (!ssml) break;
        blocks.push(ssml);
        const { index: nowIndex } = state.view.renderer.getContents()[0] || {};
        if (nowIndex > lastIndex) {
          // Crossed into the next spine item; remember it and stop walking so
          // the next chapter is appended by the generator.
          state.chapterCursor = { index: nowIndex };
          break;
        }
      }
      cache.set(bookId, blocks);
      yield* blocks;
    } finally {
      cache.delete(bookId);
    }
  }
}

function collectChunks(chapter, chapterTitle, ssmlList) {
  const out = [];
  for (const ssml of ssmlList) {
    const { segments, marks } = parseSsml(ssml);
    out.push({ chapter, title: chapterTitle, text: segments, marks });
  }
  return out;
}

function startNarrationFrom(chapterIndex, sentenceIndex = 0) {
  if (!engine.supported) {
    toast('这个浏览器没有内置朗读能力，可以改用「听见」页在支持的浏览器打开');
    return;
  }
  const chunks = makeChunks();
  const startIndex = chunks.findIndex((chunk) => chunk.chapter === chapterIndex && (chunk.sentence == null || chunk.sentence >= sentenceIndex));
  narration.voice = currentNarrationVoice();
  narration.rate = Number(state.settings.rate) || 1;
  narration.pitch = Number(state.settings.pitch) || 1;
  narration.start(chunks, startIndex >= 0 ? startIndex : 0);
}

function startPlainNarration(chapterIndex, sentenceIndex = 0) {
  startNarrationFrom(chapterIndex, sentenceIndex);
}

function turnPageTo(chapterIndex) {
  if (!state.view) {
    state.chapterIndex = chapterIndex;
    return;
  }
  state.view.goTo(chapterIndex).catch(() => {});
}

function currentNarrationVoice() {
  const lang = voiceLanguageFor(state.book?.language || (state.book?.format === 'TXT' ? 'zh-CN' : null));
  const family = state.families.find((voice) => voice.id === state.settings.familyVoice && voice.status === 'active');
  const savedVoice = state.settings.voiceName;
  if (family) {
    const suggest = suggestSystemVoice(state.voicesCache, family.profile, lang);
    narration.lang = lang;
    narration.rate = (Number(state.settings.rate) || 1) * (family.settings?.rate || 1);
    narration.pitch = (Number(state.settings.pitch) || 1) * (family.settings?.pitch || 1);
    return suggest || preferredVoice(state.voicesCache, lang, savedVoice);
  }
  return preferredVoice(state.voicesCache, lang, savedVoice);
}

function attachOverlay({ index, doc }) {
  const showQuote = (range) => {
    if (!state.selectionQuote || !state.selectionQuote.range) return;
    const rects = state.selectionQuote.range.getClientRects();
    if (!rects.length) return;
  };
  const view = state.view;
  const renderer = view.renderer;
  const overlayer = new Overlayer();
  // The paginator owns drawing; we only add our own SVG layer so highlights
  // and the active sentence live in the same coordinate space as the text.
  overlayer.element.style.zIndex = '1';
  doc.addEventListener('mouseup', () => captureSelection(index, doc));
  doc.addEventListener('selectionchange', () => {});
}

function markSelectionFromDoc() {
  const docs = state.view?.renderer?.getContents?.() || [];
  for (const { index, doc } of docs) {
    const selection = doc.getSelection?.();
    if (selection && selection.rangeCount && selection.toString().trim()) captureSelection(index, doc, selection);
  }
}

function captureSelection(index, doc, selection = doc.getSelection?.()) {
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0).cloneRange();
  const text = selection.toString().replace(/\s+/g, ' ').trim();
  if (text.length < 2) {
    state.selectionQuote = null;
    return;
  }
  state.selectionQuote = { index, doc, range, text, cfi: state.view?.getCFI?.(index, range) || null };
  showSelectionPopup(text);
}

function showSelectionPopup(text) {
  const existing = document.getElementById('selectionPopup');
  existing?.remove();
  const docs = state.view?.renderer?.getContents?.() || [];
  const current = docs.find(({ doc }) => doc === state.selectionQuote?.doc);
  if (!current) return;
  const iframe = current.doc.defaultView?.frameElement;
  const rect = state.selectionQuote.range.getBoundingClientRect();
  const hostRect = (iframe || $('#stage')).getBoundingClientRect();
  const popup = h('div', { id: 'selectionPopup', class: 'selection-popup' },
    h('button', { type: 'button', onclick: () => addBookmarkFromSelection() }, '☆ 书签'),
    h('button', { type: 'button', onclick: () => openPanel('quote') }, `✎ 写想法`),
    h('button', { type: 'button', onclick: () => openPanel('quote') }, `💬 和读伴说`),
  );
  popup.style.left = `${Math.min(hostRect.width - 230, Math.max(8, rect.left + (iframe?.offsetLeft || 0)))}px`;
  popup.style.top = `${Math.max(8, rect.top - 48 + (iframe?.offsetTop || 0))}px`;
  popup.textContent = '';
  const label = h('span', { class: 'popup-label', text: text.length > 18 ? `${text.slice(0, 18)}…` : text });
  popup.append(label, h('button', { type: 'button', onclick: () => addBookmarkFromSelection() }, '☆ 书签'), h('button', { type: 'button', onclick: () => openPanel('quote') }, '✎ 写想法'), h('button', { type: 'button', onclick: () => quoteForCompanion() }, '💬 读伴'));
  $('#stage').append(popup);
  popup.hidden = false;
}

// ---------------------------------------------------------------------------
// Narration panel & conversations come next.

wireChrome();
boot();
