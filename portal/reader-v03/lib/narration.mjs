// Book text model + playback state for continuous, cross-chapter listening.
//
// The reader builds one Book from either an EPUB (via foliate-js sections) or a
// TXT (split into chapters). The narration queue walks paragraphs in order and
// never stops at a chapter boundary: when a chapter ends it advances, continues
// speaking, and reports the chapter change so the UI can turn the page behind
// the audio. All position is expressed in paragraph units so it survives reloads
// and works while the reading pane is hidden (screen locked / tab in background).
//
// Dependencies are injected (speak, onStateChange, onChunk, clock) so this core
// is fully unit-testable in Node with fake timers.

import { chunkText, normalizeText } from './text.mjs';
import { chunkForSpeech, isPageArtefact, spokenLength } from './reading-rhythm.mjs';
import { sleep, chapterAnnouncement, pauseBefore, DEFAULT_CHAPTER_PAUSE_MS } from './chapter-flow.mjs';

export const State = Object.freeze({
  IDLE: 'idle',
  SPEAKING: 'speaking',
  PAUSED: 'paused',
  ENDED: 'ended',
});

export class Narration {
  constructor({ speak, onState = () => {}, onProgress = () => {}, onChunk = () => {}, onError = () => {}, clock = () => Date.now(), chunker = chunkForSpeech, settleMs = () => 0 } = {}) {
    this.speak = speak;
    this.onState = onState;
    this.onProgress = onProgress;
    this.onChunk = onChunk;
    this.onError = onError;
    this.clock = clock;
    this.chunker = chunker;
    // A voice can stop at a paragraph that ends without punctuation; a short
    // settle gap lets those read as a completed sentence rather than a cut.
    this.settleMs = settleMs;
    this.speakTitles = true;
    this.chapterPauseMs = DEFAULT_CHAPTER_PAUSE_MS;
    this.lastAnnounced = null;
    this.book = null;
    this.state = State.IDLE;
    this.resumeState = State.IDLE;
    this.chapter = 0;
    this.paragraph = 0;
    this.chunkIndex = 0;
    this.resumeAt = { chapter: 0, paragraph: 0 };
    this.chunks = [];
    this.listenedMs = 0;
    this.startedAt = 0;
    this.controller = null;
    this.rate = 1;
  }

  load(book, position = null) {
    this.book = book;
    this.stop({ keepPosition: false });
    this.state = State.IDLE;
    this.lastAnnounced = null;
    this.announcedChapter = null;
    this.jump(position ?? { chapter: 0, paragraph: 0 });
  }

  get active() {
    return this.state === State.SPEAKING || this.state === State.PAUSED;
  }

  setState(state) {
    this.state = state;
    this.onState(state);
  }

  position() {
    return { chapter: this.chapter, paragraph: this.paragraph, chunk: this.chunkIndex, listenedMs: this.listenedMs };
  }

  report() {
    if (!this.book) return;
    this.onProgress({ ...this.position(), state: this.state });
  }

  // Move the narration cursor. `chunk: false` restarts at the first chunk.
  jump({ chapter = 0, paragraph = 0, chunk = 0 } = {}, { silent = false } = {}) {
    if (!this.book) return;
    const chapterCount = this.book.chapters.length;
    this.chapter = Math.max(0, Math.min(chapterCount - 1, chapter | 0));
    const paragraphs = this.book.chapters[this.chapter]?.paragraphs ?? [];
    this.paragraph = Math.max(0, Math.min(Math.max(0, paragraphs.length - 1), paragraph | 0));
    this.resumeAt = { chapter: this.chapter, paragraph: this.paragraph };
    this.chunks = this.chunker(this.textAt(this.chapter, this.paragraph));
    const total = Math.max(0, paragraphs.length);
    if (chunk === 'end') this.chunkIndex = Math.max(0, this.chunks.length - 1);
    else this.chunkIndex = Math.max(0, Math.min(this.chunks.length - 1, chunk | 0));
    if (!silent) this.report();
    return total;
  }

  textAt(chapter, paragraph) {
    return normalizeText(this.book?.chapters[chapter]?.paragraphs[paragraph] ?? '');
  }

  async start(position = null) {
    if (!this.book) throw new Error('还没有打开的书');
    if (position) this.jump(position, { silent: true });
    if (this.state === State.PAUSED) return this.resume();
    await this.#run();
  }

  async #run() {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.setState(State.SPEAKING);
    this.startedAt = this.clock();
    this.report();
    try {
      while (true) {
        await this.#chapterLeadIn(controller.signal);
        if (controller.signal.aborted) return;
        const text = this.chunks[this.chunkIndex];
        if (text === undefined) {
          const advanced = this.#advanceParagraph();
          if (!advanced) {
            this.listenedMs += this.clock() - this.startedAt;
            this.state = State.ENDED;
            this.setState(State.ENDED);
            this.report();
            return;
          }
          continue;
        }
        const hasSpeech = spokenLength(text) > 0;
        if (!hasSpeech) {
          this.chunkIndex += 1;
          continue;
        }
        this.onChunk({ chapter: this.chapter, paragraph: this.paragraph, chunk: this.chunkIndex, text, last: this.chunkIndex >= this.chunks.length - 1 });
        const started = this.clock();
        // Browser/endpoint engines are asked for `rate` scaled wall clock;
        // estimate listening time so statistics stay truthful per engine speed.
        await Promise.race([
          this.speak(text, { signal: controller.signal }),
          this.#aborted(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        this.listenedMs += this.clock() - started;
        this.listenedChars = (this.listenedChars ?? 0) + spokenLength(text);
        // Settle only between the last sentence of a paragraph and the next
        // one: inside a paragraph the voice already carries the rhythm.
        const settle = this.chunkIndex >= this.chunks.length - 1 ? Math.max(0, Number(this.settleMs(this.chapter, this.paragraph)) || 0) : 0;
        if (settle) await sleep(settle, { signal: controller.signal });
        if (controller.signal.aborted) return;
        this.chunkIndex += 1;
        this.report();
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      this.pause({ silent: true });
      this.onError(error);
    }
  }

  // Announce the chapter heading once per visit, then breathe before the first
  // sentence. Runs before every chunk so a jump into a new chapter is announced
  // even when the listening loop was already running.
  async #chapterLeadIn(signal) {
    const title = chapterAnnouncement(this.book?.chapters?.[this.chapter], { spokenTitles: this.speakTitles });
    const atStart = this.paragraph === 0 && this.chunkIndex === 0;
    if (atStart && this.announcedChapter !== this.chapter) {
      this.announcedChapter = this.chapter;
      const pause = pauseBefore({ paragraph: 0 }, { chapterPauseMs: this.chapterPauseMs });
      // The heading is a separate utterance so the voice gives it its own
      // cadence; the cursor stays on paragraph 0, which is spoken afterwards.
      if (title) {
        this.onChunk({ chapter: this.chapter, paragraph: 0, chunk: 0, text: title, announcement: true });
        await Promise.race([this.speak(title, { signal }), this.#aborted(signal)]);
      }
      if (pause) await sleep(pause, { signal });
    }
    // Paused/restarted mid-chapter: no heading, no pause.
  }

  // Aborting must leave the loop even when the engine ignores the signal (a
  // paused Web Speech utterance or a provider that never settles), otherwise
  // pause() would leave an unawaitable loop running forever.
  #aborted(signal) {
    return new Promise((_, reject) => {
      const fail = () => reject(Object.assign(new Error('speech aborted'), { name: 'AbortError' }));
      if (signal.aborted) fail();
      else signal.addEventListener('abort', fail, { once: true });
    });
  }

  #advanceParagraph() {
    const paragraphs = this.book.chapters[this.chapter]?.paragraphs ?? [];
    let chapter = this.chapter;
    let paragraph = this.paragraph + 1;
    while (true) {
      if (paragraph < paragraphs.length) break;
      if (chapter + 1 < this.book.chapters.length) {
        chapter += 1;
        paragraph = 0;
        break;
      }
      return false;
    }
    const chapterChanged = chapter !== this.chapter;
    this.chapter = chapter;
    this.paragraph = paragraph;
    this.chunkIndex = 0;
    this.chunks = this.chunker(this.textAt(chapter, paragraph));
    if (chapterChanged) this.onProgress({ ...this.position(), state: State.SPEAKING, chapterChanged });
    return true;
  }

  pause() {
    if (this.state !== State.SPEAKING) return false;
    this.controller?.abort();
    this.controller = null;
    this.resumeAt = { chapter: this.chapter, paragraph: this.paragraph };
    this.listenedMs += this.clock() - this.startedAt;
    this.setState(State.PAUSED);
    this.report();
    return true;
  }

  resume() {
    if (this.state !== State.PAUSED) return Promise.resolve();
    // Restart the interrupted paragraph from its beginning: a partially heard
    // sentence is better repeated than lost.
    this.jump({ ...this.resumeAt });
    return this.#run();
  }

  toggle() {
    if (this.state === State.SPEAKING) { this.pause(); return 'paused'; }
    if (this.state === State.PAUSED) { this.resume(); return 'speaking'; }
    return this.start(this.resumeAt);
  }

  nextParagraph() {
    return this.#skip(1);
  }

  prevParagraph() {
    return this.#skip(-1);
  }

  #skip(direction) {
    if (!this.book) return;
    const paragraphs = this.book.chapters[this.chapter]?.paragraphs ?? [];
    let chapter = this.chapter;
    let paragraph = this.paragraph + direction;
    while (true) {
      if (paragraph >= 0 && paragraph < paragraphs.length) break;
      chapter += direction;
      if (chapter < 0 || chapter >= this.book.chapters.length) return;
      paragraph = direction > 0 ? 0 : Math.max(0, (this.book.chapters[chapter]?.paragraphs.length ?? 1) - 1);
    }
    this.jump({ chapter, paragraph });
    this.#restartIfPlaying();
  }

  nextChapter() {
    return this.#goToChapter(this.chapter + 1);
  }

  prevChapter() {
    return this.#goToChapter(this.chapter - 1);
  }

  #goToChapter(chapter) {
    if (!this.book || chapter < 0 || chapter >= this.book.chapters.length) return;
    this.chapter = chapter;
    this.paragraph = 0;
    this.chunkIndex = 0;
    this.chunks = this.chunker(this.textAt(chapter, 0));
    this.resumeAt = { chapter, paragraph: 0 };
    this.report();
    this.#restartIfPlaying();
  }

  // The running loop reads refreshed cursor/chunks only after the current
  // sentence finishes, so aborting the in-flight sentence resumes at the new
  // position cleanly.
  #restartIfPlaying() {
    if (this.state === State.SPEAKING) {
      this.controller?.abort();
      this.#run();
    } else if (this.state === State.PAUSED) {
      this.jump({ ...this.resumeAt });
      this.#run();
    }
  }

  stop({ keepPosition = true } = {}) {
    this.controller?.abort();
    this.controller = null;
    if (this.startedAt && (this.state === State.SPEAKING)) this.listenedMs += this.clock() - this.startedAt;
    this.startedAt = 0;
    if (keepPosition) this.resumeAt = { chapter: this.chapter, paragraph: this.paragraph };
    if (this.state !== State.IDLE || keepPosition === false) this.setState(State.IDLE);
  }

  statistics() {
    const totalChars = this.book?.chapters.reduce((sum, chapter) => sum + chapter.paragraphs.join('').length, 0) ?? 0;
    const minutes = this.listenedMs / 60000;
    return {
      listenedMs: this.listenedMs,
      listenedMinutes: Math.round(minutes),
      // Reading speed calibrated on measured audio duration; conservative when
      // nothing has been listened to yet.
      charsPerMinute: minutes > 0.2 ? Math.round((this.listenedChars ?? 0) / minutes) : 0,
      totalChars,
    };
  }
}
