// Pauses between the pieces of a book: chapter to chapter, paragraph to
// paragraph. Timing is configuration, not magic numbers in the loop, so the
// reader can offer "紧凑 / 自然 / 舒缓" pacing and tests stay deterministic.

export const DEFAULT_CHAPTER_PAUSE_MS = 650;
export const DEFAULT_PARAGRAPH_PAUSE_MS = 0;

// A heading is spoken as its own utterance so the voice gives it the cadence of
// a title instead of running it into the first sentence.
export function chapterAnnouncement(chapter, { spokenTitles = true } = {}) {
  if (!spokenTitles || !chapter) return '';
  const title = String(chapter.heading || chapter.title || '').replace(/\s+/g, ' ').trim();
  if (!title || title.length > 60) return '';
  return title;
}

// Gap before a paragraph. First paragraph of a chapter gets the chapter pause;
// everything else gets the (usually zero) paragraph pause.
export function pauseBefore({ paragraph = 0, chapterChanged = false } = {}, { chapterPauseMs = DEFAULT_CHAPTER_PAUSE_MS, paragraphPauseMs = DEFAULT_PARAGRAPH_PAUSE_MS } = {}) {
  const ms = chapterChanged || paragraph === 0 ? chapterPauseMs : paragraphPauseMs;
  return Math.max(0, Number(ms) || 0);
}

export const sleep = (ms, { signal } = {}) => {
  const duration = Math.max(0, Number(ms) || 0);
  if (!duration) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(Object.assign(new Error('speech aborted'), { name: 'AbortError' }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, duration);
    const abort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('speech aborted'), { name: 'AbortError' }));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
};

// Human-facing pacing presets stored in settings.
export const PACING = Object.freeze({
  compact: { label: '紧凑', chapterPauseMs: 250, paragraphPauseMs: 0, settleMs: 120 },
  natural: { label: '自然', chapterPauseMs: DEFAULT_CHAPTER_PAUSE_MS, paragraphPauseMs: 80, settleMs: 320 },
  gentle: { label: '舒缓', chapterPauseMs: 1200, paragraphPauseMs: 450, settleMs: 650 },
});

export const pacingOf = id => PACING[id] ?? PACING.natural;
