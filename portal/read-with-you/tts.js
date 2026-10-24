// Turns book text into natural, speakable sentences and drives chapter-by-chapter
// narration for paginated books (foliate-js) and plain-text books.

const TERMINATORS = new Set(['。', '！', '？', '；', '…', '!', '?', ';', '.']);
const CLOSERS = new Set(['”', '’', '"', "'", '）', ')', '】', ']', '》', '」', '』']);
const SOFT_BREAKS = new Set(['，', '、', ',']);
const ABBREVIATIONS = /(?:\b(?:Mr|Mrs|Ms|Dr|St|No|vs|etc|e\.g|i\.e|Vol|Ch|Fig|Jr|Sr)\.|\b[A-Z]\.)$/;
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;
const LATIN_DECIMAL = /\d$/;

export const isCjk = (text = '') => CJK.test(text);

/** Split raw text into natural sentences. Pure, so it can be unit-tested in Node. */
export function splitSentences(text, { max = 220, minMerge = 4 } = {}) {
  const clean = String(text || '').replace(/\r\n?/g, '\n').replace(/[\u00ad\u200b\ufeff]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n');
  const sentences = [];
  let buffer = '';
  const flush = (soft) => {
    const piece = buffer.trim();
    buffer = '';
    if (!piece) return;
    if (soft && sentences.length && piece.length < minMerge && sentences[sentences.length - 1].length + piece.length <= max) {
      sentences[sentences.length - 1] += (isCjk(sentences[sentences.length - 1].slice(-1)) ? '' : ' ') + piece;
      return;
    }
    sentences.push(piece);
  };
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    buffer += ch;
    if (ch === '\n') {
      if (buffer.trim().length > max) {
        const cut = buffer;
        buffer = '';
        for (const piece of hardWrap(cut.trim(), max)) sentences.push(piece);
      } else flush(false);
      continue;
    }
    if (TERMINATORS.has(ch)) {
      // Keep closing quotes/brackets and repeated punctuation with the sentence.
      while (i + 1 < clean.length && (TERMINATORS.has(clean[i + 1]) || CLOSERS.has(clean[i + 1]))) buffer += clean[++i];
      const next = clean[i + 1];
      const wordContext = buffer.trimEnd().slice(0, -1);
      if (ch === '.' && !isCjk(buffer) && (ABBREVIATIONS.test(wordContext) || /^(?:Mr|Mrs|Ms|Dr|St|No|vs|etc|Jr|Sr)$/.test(wordContext.split(/\s/).at(-1)))) continue;
      if (ch === '.' && !isCjk(buffer) && LATIN_DECIMAL.test(wordContext) && /\d/.test(next || '')) continue;
      flush(false);
      continue;
    }
    if (SOFT_BREAKS.has(ch) && buffer.length >= max * 0.7) {
      const next = clean[i + 1];
      if (ch !== ',' || !/[0-9]/.test(next || '')) flush(true);
      continue;
    }
    if (buffer.length >= max * 1.6) {
      const cut = buffer;
      buffer = '';
      for (const piece of hardWrap(cut.trim(), max)) sentences.push(piece);
    }
  }
  flush(false);
  return sentences.filter((sentence) => /\S/.test(sentence));
}

export function hardWrap(text, max) {
  const out = [];
  let rest = text;
  while (rest.length > max) {
    let cut = -1;
    for (let i = max; i > max * 0.5; i--) {
      if (/[\s，。、；：,!;:]/.test(rest[i] || '')) {
        cut = i + 1;
        break;
      }
    }
    if (cut < 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

/** Rough seconds estimate to show the listener how long is left. */
export function estimateSeconds(text, rate = 1) {
  const cjkCount = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (text.replace(/[\u3400-\u9fff]/g, ' ').match(/[A-Za-z0-9'’-]+/g) || []).length;
  return (cjkCount / 4.4 + words / 2.6) / Math.max(0.5, rate);
}

/** Parse an SSML-ish string produced by foliate-js into {segments:[{tag,text,marks}], text}. */
export function ssmlSegments(ssml) {
  const segments = [];
  let text = '';
  const marks = [];
  const tagRe = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
  let stack = [];
  let last = 0;
  const pushText = (raw) => {
    const decoded = decodeEntities(raw);
    for (const part of splitSentences(decoded)) {
      segments.push({ tag: stack[stack.length - 1] || 'p', text: part, start: text.length });
      text += part;
    }
  };
  let match;
  while ((match = tagRe.exec(ssml))) {
    if (match.index > last) pushText(ssml.slice(last, match.index));
    last = tagRe.lastIndex;
    const [, closing, rawTag, attrs] = match;
    const tag = rawTag.toLowerCase();
    if (closing) {
      const at = stack.lastIndexOf(tag);
      if (at >= 0) stack = stack.slice(0, at);
      continue;
    }
    if (tag === 'mark') {
      const name = /name="([^"]*)"/.exec(attrs)?.[1];
      if (name) marks.push({ name, offset: text.replace(/\s+$/, '').length });
      continue;
    }
    if (tag === 'break') {
      text += ' ';
      continue;
    }
    stack.push(tag);
  }
  if (last < ssml.length) pushText(ssml.slice(last));
  return { segments, text, marks };
}

export function decodeEntities(raw) {
  return raw.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos|nbsp);/g, (all, entity) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[entity] ?? all;
  });
}

/** Chapter model for .txt books: detect headings, fall back to paged sections. */
export function parsePlainText(text) {
  const normalized = String(text || '').replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const headingRe = /^\s*第[一二三四五六七八九十百千零〇0-9]+[章节回卷篇部](?:[\s:：.、].*)?$/;
  const plainHeadingRe = /^\s*(?:Chapter\s+[0-9IVXLC]+|卷[一二三四五六七八九十]+|序章|楔子|尾声|后记|前言|引言)(?:[\s:：.、].*)?$/i;
  const chapters = [];
  let current = { title: '', lines: [] };
  const onHeading = (line) => /[。！？.!?]/.test(line) ? false : headingRe.test(line) || plainHeadingRe.test(line);
  const hasHeading = lines.some(onHeading);
  if (hasHeading) current = { title: '正文', lines: [] };
  for (const line of lines) {
    if (hasHeading && onHeading(line)) {
      if (current.lines.some((l) => l.trim())) chapters.push(current);
      current = { title: line.trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (chapters.length) {
    // Trailing material after the last heading still belongs to the book.
    if (current.lines.some((l) => l.trim())) chapters.push(current);
    return chapters.map((chapter, index) => {
      const paragraphs = chapter.lines.map((l) => l.trim()).filter(Boolean);
      return { index, title: chapter.title || `第 ${index + 1} 节`, text: paragraphs.join('\n'), sentences: splitSentences(paragraphs.join('\n')) };
    }).filter((chapter) => chapter.text);
  }
  const paragraphs = current.lines.map((l) => l.trim()).filter(Boolean);
  return [{ index: 0, title: '正文', text: paragraphs.join('\n'), sentences: splitSentences(paragraphs.join('\n')) }];
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

// Narration core ---------------------------------------------------------

/**
 * Speaks a queue of chunks through an injected speech engine. The engine is a
 * tiny interface (`speak(u, handlers)`, `cancel()`) so tests can run it in Node.
 */
export class Narration {
  constructor(engine, { onState = () => {}, onProgress = () => {}, onEnd = () => {}, onError = () => {} } = {}) {
    this.engine = engine;
    this.onState = onState;
    this.onProgress = onProgress;
    this.onEnd = onEnd;
    this.onError = onError;
    this.queue = [];
    this.index = 0;
    this.state = 'idle';
    this.rate = 1;
    this.pitch = 1;
    this.voice = null;
    this.lang = 'zh-CN';
    this.runToken = 0;
    this.current = null;
  }

  setState(state) {
    this.state = state;
    this.onState(state, this);
  }

  setVoice(voice, lang) {
    this.voice = voice || null;
    if (lang) this.lang = lang;
  }

  start(chunks, startAt = 0) {
    this.stop();
    this.render(chunks);
    this.want = startAt;
    this.skipEmpty();
    this.runToken++;
    this.setState('speaking');
    this.speakCurrent();
  }

  render(chunks) {
    // Each chunk: {chapter, chapterTitle, text, sentenceIndex, meta}
    this.queue = [];
    for (const chunk of chunks) {
      for (const sentence of splitSentences(chunk.text, { max: chunk.max || 220 })) {
        this.queue.push({ ...chunk, text: sentence, chunkIndex: this.queue.length });
      }
    }
    this.onProgress({ index: 0, total: this.queue.length, chunk: this.queue[0] });
  }

  /** Track a not-yet-started sentence requested by seekTo, let it speak, then advance. */
  skipEmpty() {
    this.index = Math.max(0, Math.min(this.want ?? 0, this.queue.length - 1));
    while (this.index < this.queue.length - 1 && !this.queue[this.index].text.trim()) this.index++;
  }

  current() {
    return this.queue[this.index] || null;
  }

  speakCurrent() {
    const token = this.runToken;
    const chunk = this.queue[this.index];
    if (!chunk) {
      this.setState('ended');
      this.onEnd();
      return;
    }
    if (!chunk.text.trim() && this.index < this.queue.length - 1) {
      this.index++;
      this.speakCurrent();
      return;
    }
    this.current = chunk;
    this.onProgress({ index: this.index, total: this.queue.length, chunk });
    const utterance = { text: chunk.text, rate: this.rate, pitch: this.pitch, voice: this.voice, lang: this.lang };
    this.engine.speak(utterance, {
      onBoundary: (event) => {
        if (token !== this.runToken) return;
        this.onProgress({ index: this.index, total: this.queue.length, chunk, boundary: event });
      },
      onEnd: () => {
        if (token !== this.runToken) return;
        this.index++;
        if (this.state === 'speaking') this.speakCurrent();
      },
      onError: (error) => {
        if (token !== this.runToken) return;
        if (error?.error === 'interrupted' || error?.error === 'canceled') return;
        this.setState('error');
        this.onError(error);
      },
    });
  }

  pause() {
    if (this.state !== 'speaking') return;
    this.runToken++;
    this.engine.cancel();
    this.setState('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.runToken++;
    this.setState('speaking');
    this.speakCurrent();
  }

  toggle() {
    if (this.state === 'speaking') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  /** Start from a queue index (used when the user taps a paragraph). */
  seekTo(index) {
    index = Math.max(0, Math.min(index, this.queue.length - 1));
    while (index < this.queue.length - 1 && !this.queue[index].text.trim()) index++;
    this.want = index;
    if (this.state === 'speaking') {
      this.index = index;
      this.runToken++;
      this.engine.cancel();
      this.speakCurrent();
    } else {
      this.skipEmpty();
      this.onProgress({ index: this.index, total: this.queue.length, chunk: this.queue[this.index] });
    }
  }

  skip(seconds) {
    // Approximate: move by ~4.4 CJK characters per second.
    const sign = Math.sign(seconds) || 1;
    let chars = Math.abs(seconds) * 4.4 * this.rate;
    let index = this.index;
    while (chars > 0 && index >= 0 && index < this.queue.length) {
      index += sign;
      chars -= (this.queue[index]?.text.length || 4) * (sign > 0 ? 1 : 1);
      if (sign < 0 && chars <= 0) break;
    }
    this.seekTo(Math.max(0, Math.min(this.queue.length - 1, index)));
    if (this.state === 'speaking' || this.state === 'paused') {
      this.runToken++;
      this.engine.cancel();
      if (this.state === 'paused') this.setState('paused');
      else this.speakCurrent();
      if (this.state === 'paused') this.onProgress({ index: this.index, total: this.queue.length, chunk: this.queue[this.index] });
    }
  }

  stop() {
    this.runToken++;
    this.engine.cancel();
    if (this.state !== 'idle') this.setState('idle');
  }
}

/** Browser SpeechSynthesis adapter with voice warm-up and Chrome's long-text guard. */
export function createSpeechEngine(synth = window.speechSynthesis, Utterance = window.SpeechSynthesisUtterance) {
  const engine = {
    supported: Boolean(synth && Utterance),
    synth,
    speak(utter, { onBoundary, onEnd, onError }) {
      if (!engine.supported) {
        onError?.(new Error('此浏览器不支持语音朗读'));
        return;
      }
      const u = new Utterance(utter.text);
      u.lang = utter.lang;
      u.rate = utter.rate;
      u.pitch = utter.pitch;
      if (utter.voice) u.voice = utter.voice;
      u.onboundary = (event) => onBoundary?.(event);
      u.onend = () => onEnd?.();
      u.onerror = (event) => onError?.(event);
      synth.speak(u);
    },
    cancel() {
      try {
        synth?.cancel();
      } catch {}
    },
    voices() {
      return synth?.getVoices?.() || [];
    },
    onVoicesChanged(callback) {
      synth?.addEventListener?.('voiceschanged', callback);
    },
  };
  return engine;
}

/** Map a book's language tag to a BCP-47 voice language. */
export function voiceLanguageFor(languageTags) {
  const tag = Array.isArray(languageTags) ? languageTags[0] : languageTags;
  const raw = String(tag || 'zh-CN');
  const lower = raw.toLowerCase();
  if (lower.startsWith('zh')) {
    if (/hant|tw|hk|mo/.test(lower)) return 'zh-TW';
    return 'zh-CN';
  }
  return raw.split(',')[0].trim() || 'en-US';
}

export function preferredVoice(voices, lang, savedName) {
  if (!voices?.length) return null;
  if (savedName) {
    const saved = voices.find((voice) => voice.name === savedName);
    if (saved) return saved;
  }
  const base = lang.split('-')[0].toLowerCase();
  const exact = voices.filter((voice) => voice.lang.toLowerCase().replace('_', '-') === lang.toLowerCase());
  const sameBase = voices.filter((voice) => voice.lang.toLowerCase().startsWith(base));
  const pool = exact.length ? exact : sameBase;
  if (!pool.length) return null;
  return (
    pool.find((voice) => voice.localService && /xiaoxiao|tingting|meijia|huihui|google|natural/i.test(voice.name)) ||
    pool.find((voice) => voice.localService) ||
    pool[0]
  );
}
