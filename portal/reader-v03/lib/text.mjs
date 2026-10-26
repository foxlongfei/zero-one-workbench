// Pure text utilities shared by the reader core and the TTS engine.
// No DOM / browser APIs here so Node tests can import this module directly.

import { chunkForSpeech, sentenceUnits } from './reading-rhythm.mjs';

const CHAPTER_TITLE = /^(?:第[一二三四五六七八九十百千零〇两0-9０-９]+[章节回卷篇部集]|序章|前言|序言|楔子|引子|尾声|后记|番外|Chapter\s+[0-9IVXLC]+|Prologue|Epilogue)(?:\s|$|[：:·.、])/i;

export const isChapterTitle = line => {
  const text = String(line ?? '').trim();
  if (!text || text.length > 40) return false;
  return CHAPTER_TITLE.test(text);
};

// Split a plain TXT book into chapters using headings common to Chinese and
// English books. A file without headings becomes a single chapter; very large
// single chapters are still split into pages inside the reader.
export function splitChapters(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  if (!normalized.trim()) return [];
  const lines = normalized.split('\n');
  const chapters = [];
  let current = { title: '', lines: [] };
  for (const line of lines) {
    if (isChapterTitle(line)) {
      if (current.lines.join('').trim()) chapters.push(current);
      current = { title: line.trim(), lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.lines.join('').trim() || !chapters.length) chapters.push(current);
  return chapters.map((chapter, index) => {
    const body = chapter.lines.join('\n').replace(/^\n+|\n+$/g, '');
    const heading = chapter.title || (isChapterTitle(body.split('\n')[0]) ? body.split('\n')[0].trim() : '');
    return {
      title: heading || `第 ${index + 1} 章`,
      heading,
      paragraphs: body.split(/\n\s*\n|\n/).map(x => x.trim()).filter(Boolean),
    };
  });
}

export const normalizeText = value => String(value ?? '')
  .replace(/[\u00AD\u200B\u200C\u200D\uFEFF]/g, '')
  .replace(/[ \t\u3000]+/g, ' ')
  .replace(/\s*\n\s*/g, ' ')
  .trim();

// Kept for callers that only want sentence units; speech chunking lives in
// reading-rhythm.mjs because it also cleans page artefacts and markup.
export function splitSentences(text) {
  return sentenceUnits(normalizeText(text));
}

export const chunkText = (text, options) => chunkForSpeech(text, options);

// Approximate position for a paragraph index inside a book, used when the
// renderer is hidden (listening in the background) and no page range exists.
export function chapterFraction(chapterIndex, chapters) {
  const total = chapters.length || 1;
  const weight = chapters.reduce((sum, chapter) => sum + Math.max(1, chapter.paragraphs.length), 0) || 1;
  const before = chapters.slice(0, chapterIndex)
    .reduce((sum, chapter) => sum + Math.max(1, chapter.paragraphs.length), 0);
  return Math.min(1, before / weight);
}

export const percent = value => `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;

export function secondsToMinutes(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.round((value % 3600) / 60);
  if (hours) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分钟`;
}
