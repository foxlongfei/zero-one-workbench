// Listening promise for a book: when the audio is expected to finish, how far
// along it is, and how much of it is left.
//
// All estimates are deterministic pure functions of the book text and the
// user's chosen speed, so the UI can show "约 5 小时 40 分" and "还剩 3 小时"
// without a server, and the numbers update as the reader advances.

import { spokenLength, chunkForSpeech } from './reading-rhythm.mjs';

// Spoken characters per minute at 1× for a comfortable Mandarin/English
// narration rate. Measured against neural voices (Kokoro/Edge/OpenAI class) and
// deliberately rounded down: over-promising a finish time is worse than leaving
// the listener pleasantly early.
export const BASE_CHARS_PER_MINUTE = 245;

export const speedFactor = rate => {
  const value = Number(rate);
  return Number.isFinite(value) && value > 0 ? value : 1;
};

export function bookSpeechStats(book) {
  const chapters = book?.chapters ?? [];
  const perChapter = chapters.map(chapter => {
    // Paragraphs without any letters (a lone "3", a rule of dashes) are not
    // spoken, so they must not inflate the duration either.
    const chars = (chapter.paragraphs ?? [])
      .map(spokenLength)
      .filter(count => count > 0)
      .reduce((sum, count) => sum + count, 0);
    return { chars, paragraphs: (chapter.paragraphs ?? []).length };
  });
  const chars = perChapter.reduce((sum, item) => sum + item.chars, 0);
  return { chars, chapters: perChapter };
}

// Minutes of audio for the part of the book after (chapter, paragraph).
export function remainingMinutes(book, position, { rate = 1 } = {}) {
  if (!book) return 0;
  const { chapters } = bookSpeechStats(book);
  const chapter = Math.max(0, Math.min(chapters.length - 1, position?.chapter ?? 0));
  const paragraphs = book?.chapters?.[chapter]?.paragraphs ?? [];
  const paragraph = Math.max(0, Math.min(Math.max(0, paragraphs.length - 1), position?.paragraph ?? 0));
  let chars = 0;
  for (let i = chapter + 1; i < chapters.length; i++) chars += chapters[i].chars;
  for (let i = paragraph + 1; i < paragraphs.length; i++) chars += spokenLength(paragraphs[i]);
  // The paragraph being listened to counts from its start: it is replayed on
  // resume, and it is what is on screen while the user reads along.
  chars += spokenLength(paragraphs[paragraph]);
  return Math.round(chars / (BASE_CHARS_PER_MINUTE * speedFactor(rate)));
}

export const formatMinutes = minutes => {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (value < 1) return '不到 1 分钟';
  if (value < 60) return `${value} 分钟`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
};

// Progress as a fraction of the whole book in spoken characters. Unlike page
// fraction it is stable across formats and honest for listening.
export function listeningProgress(book, position) {
  if (!book) return 0;
  const { chars, chapters: perChapter } = bookSpeechStats(book);
  if (!chars) return 0;
  const chapter = Math.max(0, Math.min(perChapter.length - 1, position?.chapter ?? 0));
  const paragraphs = book.chapters[chapter]?.paragraphs ?? [];
  const paragraph = Math.max(0, Math.min(Math.max(0, paragraphs.length - 1), position?.paragraph ?? 0));
  const before = perChapter.slice(0, chapter).reduce((sum, item) => sum + item.chars, 0)
    + paragraphs.slice(0, paragraph).map(spokenLength).reduce((sum, count) => sum + count, 0);
  return Math.max(0, Math.min(1, before / chars));
}

// Planned audio segments for a book: one entry per spoken chunk, in listening
// order. Used by the voice library's pre-render (so a whole book can be listened
// to offline once rendered) and by the reader to show "已预备 3/120 段".
export function planSegments(book, { maxChars = 180 } = {}) {
  const segments = [];
  (book?.chapters ?? []).forEach((chapter, chapterIndex) => {
    (chapter.paragraphs ?? []).forEach((paragraph, paragraphIndex) => {
      chunkForSpeech(paragraph, { maxChars }).forEach((text, chunkIndex) => {
        if (!text) return;
        segments.push({ chapter: chapterIndex, paragraph: paragraphIndex, chunk: chunkIndex, text });
      });
    });
  });
  return segments;
}

export const segmentKey = ({ chapter, paragraph, chunk }) => `${chapter}:${paragraph}:${chunk}`;
