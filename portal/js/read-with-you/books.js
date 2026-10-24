// Turn an imported file into a book the reader can open: detect the encoding of
// plain text, split it into chapters and narration segments, and read the
// table of contents out of EPUB/FB2/MOBI/CBZ containers through foliate-js.
const { makeBook } = await import('../../vendor/foliate-js/view.js');

export const TXT_EXTENSIONS = ['txt', 'text', 'md'];
export const DOC_EXTENSIONS = ['epub', 'mobi', 'azw3', 'fb2', 'cbz'];
export const ALL_EXTENSIONS = [...DOC_EXTENSIONS, ...TXT_EXTENSIONS];

export const extensionOf = name => String(name || '').split('.').pop().toLowerCase();
export const isTxt = name => TXT_EXTENSIONS.includes(extensionOf(name));

// ------------------------------------------------------------------ encoding
const decodeWith = (buffer, encoding) => {
  try { return new TextDecoder(encoding).decode(buffer); } catch { return null; }
};

let wasmDecoder = null;
function decoderFromTransformers() {
  if (wasmDecoder) return wasmDecoder;
  // transformers.js ships an ONNX-build TextDecoder that understands GB18030
  // even where the browser's own TextDecoder does not. Loading the bundle pulls
  // in ONNX Runtime WASM (~22 MB), so opt in with `?wasm-decoder` instead of
  // paying that cost on every shelf visit; the browser test uses the flag.
  if (!new URLSearchParams(location.search).has('wasm-decoder')) return null;
  wasmDecoder = import('../../vendor/hf-transformers-3.7.5/transformers.min.js')
    .then(mod => {
      const Ctor = mod.TextDecoder;
      if (typeof Ctor !== 'function') return null;
      return bytes => new Ctor({ type: 'TextDecoder', name: 'gb18030', config: { ignoreBOM: false } })
        .decode(new Uint8Array(bytes));
    })
    .catch(err => {
      console.warn('GB18030 decoder unavailable', err);
      return null;
    });
  return wasmDecoder;
}

function scoreChinese(text) {
  const sample = text.slice(0, 20000);
  if (!sample) return -1;
  const common = (sample.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\n\r\t]/g) || []).length;
  const broken = (sample.match(/\ufffd/g) || []).length;
  return (common / sample.length) - broken * 2;
}

/**
 * Read a text file, tolerating BOMs and legacy Chinese encodings.
 * Returns { text, charset, source } where source names the decoder that won.
 */
export async function decodeText(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(buffer), charset: 'utf-16le', source: 'native' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(buffer), charset: 'utf-16be', source: 'native' };

  const utf8 = decodeWith(buffer, 'utf-8');
  if (utf8 !== null && !utf8.includes('\ufffd')) return { text: utf8, charset: 'utf-8', source: 'native' };

  const tries = [];
  if (utf8 !== null) tries.push({ text: utf8, charset: 'utf-8', source: 'native' });
  for (const charset of ['gb18030', 'big5']) {
    const native = decodeWith(buffer, charset);
    if (native) tries.push({ text: native, charset, source: 'native' });
  }
  if (!tries.some(t => t.charset === 'gb18030')) {
    const wasm = await decoderFromTransformers();
    const text = wasm?.(buffer);
    if (text) tries.push({ text, charset: 'gb18030', source: 'wasm' });
  }
  if (!tries.length) return { text: new TextDecoder('latin1').decode(buffer), charset: 'latin1', source: 'native' };
  tries.sort((a, b) => scoreChinese(b.text) - scoreChinese(a.text));
  return tries[0];
}

// --------------------------------------------------------------- segmentation
const CHAPTER_HEADING = /^\s*(?:(?:第[0-9零一二三四五六七八九十百千万两]+[章节回卷篇部集])|(?:序章|楔子|引子|尾声|后记|前言|序言)|(?:Chapter|CHAPTER)\s+[0-9IVXLC]+)/;

export function cleanText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[\u00a0\u2000-\u200a]/g, ' ');
}

const TARGET_SEGMENT = 150;
const SENTENCE_END = /[。！？!?；;…”」』]$/;

export function segmentParagraphs(paragraphs) {
  const segments = [];
  let buffer = '';
  const push = value => {
    const text = value.trim();
    if (text) segments.push(text);
  };
  for (const raw of paragraphs) {
    const paragraph = raw.replace(/[ \t]+/g, ' ').trim();
    if (!paragraph) {
      if (buffer) { push(buffer); buffer = ''; }
      continue;
    }
    if (paragraph.length > TARGET_SEGMENT * 2) {
      if (buffer) { push(buffer); buffer = ''; }
      for (let start = 0; start < paragraph.length; start += TARGET_SEGMENT) {
        push(paragraph.slice(start, start + TARGET_SEGMENT));
      }
      continue;
    }
    if (!buffer) { buffer = paragraph; continue; }
    const next = `${buffer} ${paragraph}`;
    // Keep narration segments near one breath and prefer to cut after a full stop.
    if (next.length > TARGET_SEGMENT && SENTENCE_END.test(buffer)) { push(buffer); buffer = paragraph; }
    else if (next.length > TARGET_SEGMENT * 1.6) { push(buffer); buffer = paragraph; }
    else buffer = next;
  }
  if (buffer) push(buffer);
  return segments;
}

export function structurePlainText(text) {
  const lines = cleanText(text).split('\n');
  const chapterStarts = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length <= 32 && CHAPTER_HEADING.test(trimmed)) chapterStarts.push(index);
  });

  if (!chapterStarts.length) {
    const body = lines.join('\n');
    if (!body.trim()) return null;
    return { chapters: [{ href: 'text:0', title: '正文', segments: segmentParagraphs(body.split('\n')) }] };
  }

  const chapters = [];
  if (chapterStarts[0] > 0) {
    const segments = segmentParagraphs(lines.slice(0, chapterStarts[0]));
    if (segments.length) chapters.push({ href: 'text:front', title: '卷首', segments });
  }
  chapterStarts.forEach((start, i) => {
    const end = i + 1 < chapterStarts.length ? chapterStarts[i + 1] : lines.length;
    const body = lines.slice(start, end);
    const title = body.find(l => l.trim()).trim();
    chapters.push({ href: `text:${start}`, title, segments: segmentParagraphs(body.slice(1)) });
  });
  return { chapters: chapters.filter(c => c.segments.length || c.title) };
}

// ------------------------------------------------------------------ containers
function readableText(doc) {
  if (!doc) return '';
  const clone = doc.cloneNode(true);
  clone.querySelectorAll('script,style,nav,rt,rp').forEach(n => n.remove());
  const root = clone.body || clone.documentElement;
  if (!root) return '';
  const blocks = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,div,section,article,td,dd,pre')]
    .filter(el => !el.querySelector('p,li,blockquote,div,section,article'));
  const chunks = blocks.map(el => el.textContent).filter(t => t && t.trim());
  return chunks.length ? chunks.join('\n\n') : (root.textContent || '');
}

function titleOf(doc) {
  const heading = (doc?.querySelector('h1,h2,h3')?.textContent || '').trim();
  return (heading || (doc?.title || '')).trim().slice(0, 60);
}

const sectionOfCFI = cfi => {
  const match = String(cfi || '').match(/!\[([^!\]]*)\]/);
  return match ? Number(match[1]) || 0 : 0;
};

/**
 * Inspect a container book: metadata, cover, table of contents and, for each
 * spine section, the narration segments extracted through foliate-js.
 */
export async function inspectContainer(file, onProgress = () => {}) {
  let parsed;
  try {
    parsed = await makeBook(file);
    const metadata = parsed.metadata || {};
    const title = typeof metadata.title === 'string' ? metadata.title : '';
    const author = typeof metadata.author === 'string' ? metadata.author : '';
    const cover = await parsed.getCover?.().catch(() => null);
    const sections = parsed.sections || [];
    const chapters = [];
    for (let i = 0; i < sections.length; i++) {
      onProgress(i + 1, sections.length);
      try {
        const doc = await sections[i].createDocument();
        chapters.push({
          index: i,
          title: titleOf(doc) || `第 ${i + 1} 部分`,
          segments: segmentParagraphs(readableText(doc).split('\n')),
        });
      } catch (err) {
        chapters.push({ index: i, title: `第 ${i + 1} 部分`, segments: [], error: String(err) });
      }
      await new Promise(r => setTimeout(r, 0));
    }
    const toc = [];
    const walk = (items, depth = 0) => {
      if (depth > 6) return;
      for (const item of items || []) {
        const label = (item.label || '').trim();
        if (label) toc.push({ label, section: sectionOfCFI(item.href), cfi: item.href });
        walk(item.subitems || item.children, depth + 1);
      }
    };
    walk(parsed.toc);
    return {
      title,
      author,
      cover: cover instanceof Blob && cover.size ? cover : null,
      chapters,
      toc,
      sectionCount: sections.length,
    };
  } finally {
    parsed?.destroy?.();
  }
}

// ---------------------------------------------------------------- book record
export async function digestOf(blob) {
  const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Fully parse an imported file into the record stored on the shelf. Both TXT
 * and container books end up with `chapters[].segments` so that reading,
 * narration, search and notes all work on the same index.
 */
export async function buildBookRecord(file, { onProgress } = {}) {
  const ext = extensionOf(file.name);
  const title = file.name.replace(/\.[^.]+$/, '');
  const base = {
    id: `local-${crypto.randomUUID()}`,
    format: ext.toUpperCase(),
    filename: file.name,
    size: file.size,
    fingerprint: await digestOf(file),
    local: true,
    addedAt: new Date().toISOString(),
    blob: file,
  };
  if (isTxt(file.name)) {
    const { text, charset, source } = await decodeText(file);
    const structure = structurePlainText(text);
    if (!structure) return { empty: true };
    const record = {
      ...base,
      title,
      author: '',
      cover: null,
      charset,
      charsetSource: source,
      chapters: structure.chapters,
      toc: structure.chapters.map((c, index) => ({ label: c.title, section: index })),
    };
    record.segmentCount = record.chapters.reduce((n, c) => n + c.segments.length, 0);
    return { record };
  }
  const info = await inspectContainer(file, onProgress);
  const record = {
    ...base,
    title: info.title || title,
    author: info.author,
    cover: info.cover,
    charset: 'utf-8',
    chapters: info.chapters,
    toc: info.toc,
  };
  record.segmentCount = record.chapters.reduce((n, c) => n + c.segments.length, 0);
  return { record };
}

/** Chapters with their narration segments, tolerant of legacy shelf records. */
export function chaptersOf(book) {
  const source = book?.chapters || book?.structure?.chapters || [];
  return source.map((chapter, index) => ({
    index,
    title: chapter.title || `第 ${index + 1} 部分`,
    segments: chapter.segments || [],
  }));
}

export function flattenSegments(book) {
  return chaptersOf(book).map(({ index, title, segments }) => ({ chapter: index, title, segments }));
}
