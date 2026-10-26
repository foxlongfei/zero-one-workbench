// Importing a book so it opens instantly, next time, anywhere.
//
// The browser can read every format foliate-js supports, but each section has
// to be unzipped and parsed on open, which is slow for a real novel on a phone.
// This module turns an imported book into a plain JSON "portable book": chapter
// titles, paragraphs, cover text and a generated cover, the same shape the
// reader already uses for TXT books. It
//   * makes reopening instant and works for TXT and EPUB alike,
//   * makes the book listable without touching the archive again,
//   * is directly usable by the voice library to pre-render audio.
//
// Pure functions only (except `buildPortableBook`, which takes the already
// extracted paragraphs), so the shape is unit-tested in Node.

import { spokenLength } from './reading-rhythm.mjs';

export const PORTABLE_VERSION = 1;

// Build the portable record from a chapter list extracted by the reader.
export function buildPortableBook({ title, author, language = 'und', format = 'TXT', chapters = [], coverText = '' }) {
  const list = (chapters ?? []).map((chapter, index) => ({
    title: String(chapter.title || `第 ${index + 1} 章`).trim(),
    paragraphs: (chapter.paragraphs ?? []).map(text => String(text ?? '').trim()).filter(Boolean),
    ...(Number.isInteger(chapter.sectionIndex) ? { sectionIndex: chapter.sectionIndex } : {}),
  }));
  const chars = list.reduce((sum, chapter) => sum + chapter.paragraphs.reduce((acc, text) => acc + spokenLength(text), 0), 0);
  return {
    version: PORTABLE_VERSION,
    title: String(title || '未命名').trim(),
    author: String(author || '').trim(),
    language,
    format,
    coverText: String(coverText || title || '').trim(),
    chapters: list,
    stats: { chapters: list.length, paragraphs: list.reduce((sum, chapter) => sum + chapter.paragraphs.length, 0), chars },
  };
}

// Everything needed to draw a cover without the original archive: initials for
// the placeholder, and the first sentence as a subtitle.
export function coverSnippet(portable) {
  const first = portable?.chapters?.[0]?.paragraphs?.[0] ?? '';
  return first.slice(0, 48);
}

export const initialsOf = title => {
  const value = String(title ?? '').trim();
  if (!value) return '书';
  const letters = value.match(/[A-Za-z]+/g);
  if (letters) return letters.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return value.slice(0, 2);
};

const OBJECTS = new Set(['IMG', 'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FOLIATE-VIEW', 'SCRIPT', 'STYLE', 'SVG', 'NAV']);

// The in-book pages the reader itself renders: titles and page numbers. They are
// not part of the story and would be narrated or shown as stray numbers.
const FURNITURE = /^(?:第\s*\d+\s*页(?:\s*[/／]\s*(?:共\s*)?\d+\s*页)?|[-—–]?\s*\d{1,4}\s*[-—–]?|\d{1,4}\s*[/／]\s*\d{1,4})$/;

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();

// Paragraphs from a *live document* (an iframe foliate has already loaded):
// block elements become paragraphs, inline wrappers are merged into their
// block, and furniture is dropped. Walking the DOM instead of re-parsing
// outerHTML keeps sentences that span `em`/`span`/`a` in one paragraph.
export function blocksFromDocument(doc) {
  if (!doc) return [];
  const body = doc.body ?? doc.documentElement;
  if (!body) return [];
  const blocks = [];
  let buffer = '';
  const flush = () => {
    const text = clean(buffer);
    buffer = '';
    if (!text || FURNITURE.test(text)) return;
    blocks.push(text);
  };
  const walk = node => {
    for (const child of node.childNodes ?? []) {
      if (child.nodeType === 3) {
        buffer += child.nodeValue ?? '';
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = String(child.tagName ?? '').toUpperCase();
      if (OBJECTS.has(tag)) { flush(); continue; }
      if (/^(P|DIV|SECTION|ARTICLE|BLOCKQUOTE|H[1-6]|LI|TR|DD|DT|PRE|FIGCAPTION|HEADER|FOOTER|ASIDE|UL|OL|TABLE|HR|BR)$/.test(tag)) {
        flush();
        if (tag === 'HR') continue;
        const display = doc.defaultView?.getComputedStyle?.(child)?.display;
        if (display === 'none') continue;
        walk(child);
        flush();
        continue;
      }
      walk(child);
    }
  };
  walk(body);
  flush();
  return blocks;
}

// Deterministic cover colour from the title, so the same book looks the same on
// every device without storing an image.
const HUES = [28, 46, 92, 148, 178, 206, 232, 268, 300, 336];
export function coverHue(title) {
  let hash = 0;
  for (const ch of String(title ?? '')) hash = (hash * 31 + ch.codePointAt(0)) % 100003;
  return HUES[hash % HUES.length];
}

// Validate a portable book arriving from storage or a shared file. Returns null
// for anything that is not a usable book instead of throwing mid-render.
export function normalizePortableBook(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const chapters = Array.isArray(raw.chapters) ? raw.chapters : [];
  if (!chapters.length) return null;
  const kept = chapters
    .filter(chapter => chapter && Array.isArray(chapter.paragraphs))
    .map((chapter, index) => ({
      title: String(chapter.title || `第 ${index + 1} 章`),
      paragraphs: chapter.paragraphs.map(text => String(text ?? '')).filter(Boolean),
      ...(Number.isInteger(chapter.sectionIndex) ? { sectionIndex: chapter.sectionIndex } : {}),
    }))
    .filter(chapter => chapter.paragraphs.length);
  if (!kept.length) return null;
  return {
    version: PORTABLE_VERSION,
    title: String(raw.title || '未命名'),
    author: String(raw.author || ''),
    language: String(raw.language || 'und'),
    format: String(raw.format || 'TXT'),
    coverText: String(raw.coverText || raw.title || ''),
    chapters: kept,
  };
}

export const portableToModel = portable => ({
  title: portable.title,
  author: portable.author,
  language: portable.language,
  format: portable.format,
  chapters: portable.chapters,
});

// Reading position as a share of the whole book in spoken characters: the only
// progress metric that is comparable between a page turn and an hour of audio.
export function portableProgress(portable, { chapter = 0, paragraph = 0 } = {}) {
  const chapters = portable?.chapters ?? [];
  const weights = chapters.map(item => item.paragraphs.reduce((sum, text) => sum + spokenLength(text), 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total) return 0;
  const index = Math.max(0, Math.min(chapters.length - 1, chapter));
  const before = weights.slice(0, index).reduce((sum, weight) => sum + weight, 0);
  const within = chapters[index].paragraphs.slice(0, Math.max(0, paragraph)).reduce((sum, text) => sum + spokenLength(text), 0);
  return Math.min(1, (before + within) / total);
}
