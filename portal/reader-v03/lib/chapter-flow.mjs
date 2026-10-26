// A short listening pause at chapter breaks, read like a human narrator would.
//
// "第 3 章 · 雨后的院子" followed immediately by the first sentence feels rushed;
// a narrator says the chapter, breathes, and then continues. This module turns
// that into explicit audio decisions the narration loop can honour, so chapter
// boundaries are felt rather than merely indicated.

export const DEFAULT_CHAPTER_PAUSE_MS = 1400;

// Sleep that can be interrupted: the narration controller aborts it exactly like
// it aborts speech, so pause() never leaves a pending timer behind.
export const sleep = (ms, { signal } = {}) => new Promise((resolve, reject) => {
  if (!(ms > 0)) return resolve();
  const abort = () => {
    clearTimeout(timer);
    reject(Object.assign(new Error('speech aborted'), { name: 'AbortError' }));
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', abort);
    resolve();
  }, ms);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
});

// The heading read aloud at the start of a chapter. TXT books often repeat the
// heading as paragraph 0; the parser already drops it from the body, but the
// guard keeps a duplicated title out of the audio anyway.
export function chapterAnnouncement(chapter, { spokenTitles = true } = {}) {
  if (!spokenTitles) return '';
  const title = String(chapter?.title ?? '').trim();
  if (!title) return '';
  const first = String(chapter?.paragraphs?.[0] ?? '').trim();
  if (first && (first === title || first.startsWith(title))) return '';
  return title;
}

// Pause to insert before speaking `paragraph` of `chapter`: a real breath at a
// chapter start, nothing inside a chapter (sentence-end silence already comes
// from the voice itself).
export function pauseBefore({ paragraph } = {}, { chapterPauseMs = DEFAULT_CHAPTER_PAUSE_MS } = {}) {
  return paragraph === 0 ? Math.max(0, chapterPauseMs | 0) : 0;
}
