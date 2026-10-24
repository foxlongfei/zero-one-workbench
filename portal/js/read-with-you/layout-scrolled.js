// Continuous, cross-chapter reading. Every chapter is rendered as one flow of
// paragraphs; an IntersectionObserver reports which paragraph the reader is
// looking at so the shell can remember the position and follow the voice.
export class ScrolledLayout {
  // Declared up front: the constructor sets it before pinPosition() runs, and
  // an undeclared private field is a hard SyntaxError that kills the module.
  #pinBound = false;

  constructor({ root }) {
    this.root = root;
    this.chapters = [];
    this.flat = [];
    this.onVisibleChange = null;
    this.onChapter = null;
    this.onSeek = null;
    this.current = -1;
    this.active = -1;
    this.observer = null;
    this.positionPinned = -1;
    this.prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  setChapters(chapters) {
    this.chapters = chapters.map((chapter, index) => ({
      index,
      title: chapter.title || `第 ${index + 1} 部分`,
      segments: chapter.segments || [],
    }));
    this.flat = [];
    for (const chapter of this.chapters) {
      for (const [index, text] of chapter.segments.entries()) {
        this.flat.push({ chapter: chapter.index, index, text });
      }
    }
  }

  render() {
    this.root.className = 'book-flow';
    this.root.replaceChildren();
    for (const chapter of this.chapters) {
      const section = document.createElement('section');
      section.className = 'chapter';
      section.dataset.chapter = String(chapter.index);
      const heading = document.createElement('h2');
      heading.className = 'chapter-title';
      heading.id = `chapter-${chapter.index}`;
      heading.textContent = chapter.title;
      const body = document.createElement('div');
      body.className = 'chapter-body';
      for (const [index, text] of chapter.segments.entries()) {
        const paragraph = document.createElement('p');
        paragraph.className = 'seg';
        paragraph.id = `seg-${chapter.index}-${index}`;
        paragraph.dataset.chapter = String(chapter.index);
        paragraph.dataset.segment = String(index);
        paragraph.textContent = text;
        paragraph.onclick = () => this.onSeek?.(this.flatIndex(chapter.index, index));
        body.append(paragraph);
      }
      section.append(heading, body);
      this.root.append(section);
    }
    this.#observe();
    this.#observeChapters();
  }

  #observe() {
    this.observer?.disconnect();
    if (!('IntersectionObserver' in window)) return;
    this.observer = new IntersectionObserver(entries => {
      const seen = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!seen) return;
      const chapter = Number(seen.target.dataset.chapter);
      if (chapter !== this.current) {
        this.current = chapter;
        this.onVisibleChange?.(chapter);
      }
    }, { root: this.#area(), threshold: [0, 0.25, 0.5], rootMargin: '-12% 0px -55% 0px' });
    this.root.querySelectorAll('.chapter').forEach(section => this.observer.observe(section));
    this.syncVisible();
  }

  #observeChapters() {
    // The observer above only tracks chapters; segment-level visibility is
    // derived on demand from the scroll position, which is cheaper than
    // observing thousands of paragraphs.
  }

  #area() { return this.root.closest('.book-area'); }

  syncVisible() {
    this.current = this.visibleSegment()?.chapter ?? this.current;
  }

  reveal(index) {
    const item = this.flat[index];
    if (!item) return;
    const node = this.node(index);
    if (!node) return;
    node.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    const area = this.#area();
    if (area) area.focus?.({ preventScroll: true });
  }

  focusChapter(chapter) {
    const heading = this.root.querySelector(`.chapter[data-chapter="${chapter}"] .chapter-title`);
    heading?.scrollIntoView?.({ block: 'start', behavior: this.prefersReduced ? 'auto' : 'smooth' });
  }

  markActive(index) {
    const node = this.node(index);
    if (!node) return;
    this.root.querySelector('.seg.is-speaking')?.classList.remove('is-speaking');
    node.classList.add('is-speaking');
    const area = this.#area();
    if (area) {
      const rect = node.getBoundingClientRect();
      const box = area.getBoundingClientRect();
      if (rect.top < box.top + 40 || rect.bottom > box.bottom - 40) {
        node.scrollIntoView?.({ block: 'center', behavior: this.prefersReduced ? 'auto' : 'smooth' });
      }
    }
    this.active = index;
  }

  markPosition(index) {
    this.root.querySelector('.seg.is-position')?.classList.remove('is-position');
    this.node(index)?.classList.add('is-position');
    this.current = this.flat[index]?.chapter ?? this.current;
    this.pinPosition(index);
    clearTimeout(this.pinRefresh);
    this.pinRefresh = setTimeout(() => {
      if (this.positionPinned === index) this.node(index)?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    }, 0);
  }

  node(index) {
    const item = this.flat[index];
    if (!item) return null;
    return this.root.querySelector(`.seg[data-chapter="${item.chapter}"][data-segment="${item.index}"]`);
  }

  flatIndex(chapter, segment) {
    return this.flat.findIndex(item => item.chapter === chapter && item.index === segment);
  }

  positionOf(index) {
    const item = this.flat[index];
    return item ? { chapter: item.chapter, segment: item.index } : { chapter: 0, segment: 0 };
  }

  /**
   * Reading position reported to the shell. While a jump is pinned the shell's
   * own playhead is authoritative: the viewport may still be catching up (or
   * the jump target may be just off screen), and neither should count as the
   * reader scrolling away. The geometry below only speaks for manual scrolling.
   */
  visibleSegment() {
    const pinned = this.flat[this.positionPinned];
    if (pinned) return { chapter: pinned.chapter, segment: pinned.index };
    const area = this.#area();
    if (!area) return null;
    const box = area.getBoundingClientRect();
    const line = box.top + box.height * 0.32;
    let best = null;
    let bestDistance = Infinity;
    for (const node of area.querySelectorAll('.seg')) {
      const rect = node.getBoundingClientRect();
      if (rect.bottom < box.top || rect.top > box.bottom) continue;
      const distance = Math.abs(rect.top - line);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { chapter: Number(node.dataset.chapter), segment: Number(node.dataset.segment) };
      }
    }
    return best;
  }

  /**
   * Hold the reading position on `index` until the reader scrolls the text by
   * hand. Scrolling that we asked for ourselves (`reveal`, `markActive`) is
   * not the reader moving, so it does not unpin; a wheel, touch or key press
   * inside the text area does.
   */
  pinPosition(index) {
    this.positionPinned = index;
    if (this.#pinBound) return;
    this.#pinBound = true;
    const area = this.#area();
    if (!area) return;
    const release = () => { if (this.positionPinned >= 0) this.positionPinned = -1; };
    area.addEventListener('wheel', release, { passive: true });
    area.addEventListener('touchmove', release, { passive: true });
    area.addEventListener('mousedown', release);
    area.addEventListener('keydown', event => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) release();
    });
  }

  flatIndexAt(index) { return index; }

  destroy() {
    this.observer?.disconnect();
    this.observer = null;
    this.root.replaceChildren();
    this.root.className = '';
  }
}

export function createScrolledLayout(root) {
  return new ScrolledLayout({ root });
}
