// A two-column listening layout: the table of contents stays on the left, the
// segment the voice is reading (plus its neighbours) on the right. Reading
// continues across chapters by simply moving to the next segment.
export class PagedLayout {
  constructor({ root }) {
    this.root = root;
    this.chapters = [];
    this.flat = [];
    this.current = 0;
    this.onChapter = null;
    this.onSeek = null;
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
    this.root.className = 'book-paged';
    this.root.replaceChildren();
    const list = document.createElement('ol');
    list.className = 'paged-toc';
    for (const chapter of this.chapters) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'paged-toc-item';
      button.dataset.chapter = String(chapter.index);
      button.textContent = chapter.title;
      button.onclick = () => this.onChapter?.(chapter.index);
      item.append(button);
      list.append(item);
    }
    const page = document.createElement('article');
    page.className = 'paged-page';
    page.id = 'pagedPage';
    this.page = page;
    this.root.append(list, page);
    this.show(this.current, { scrollToc: false });
  }

  show(index, { scrollToc = true } = {}) {
    if (!this.flat.length || !this.page) return;
    const target = Math.max(0, Math.min(index, this.flat.length - 1));
    const item = this.flat[target];
    this.current = target;
    const chapter = this.chapters[item.chapter];
    const heading = document.createElement('h2');
    heading.className = 'paged-heading';
    const title = document.createElement('span');
    title.textContent = chapter?.title || '';
    const counter = document.createElement('span');
    counter.className = 'paged-progress';
    counter.textContent = `${item.index + 1} / ${chapter?.segments.length || 1}`;
    heading.append(title, counter);
    const paragraph = document.createElement('p');
    paragraph.className = 'seg paged-seg';
    paragraph.dataset.chapter = String(item.chapter);
    paragraph.dataset.segment = String(item.index);
    paragraph.textContent = item.text;
    const neighbours = document.createElement('div');
    neighbours.className = 'paged-neighbours';
    const previous = this.flat[target - 1];
    const next = this.flat[target + 1];
    if (previous) neighbours.append(this.#neighbour(previous, target - 1, '◀'));
    if (next) neighbours.append(this.#neighbour(next, target + 1, '▶'));
    this.page.replaceChildren(heading, paragraph, neighbours);
    this.root.querySelector('.paged-toc-item.is-current')?.classList.remove('is-current');
    const button = this.root.querySelector(`.paged-toc-item[data-chapter="${item.chapter}"]`);
    button?.classList.add('is-current');
    if (scrollToc && !this.prefersReduced) button?.scrollIntoView?.({ block: 'nearest' });
  }

  #neighbour(item, index, arrow) {
    const node = document.createElement('p');
    node.className = 'paged-neighbour';
    node.textContent = `${arrow} ${item.text}`;
    node.onclick = () => this.onSeek?.(index);
    return node;
  }

  reveal(index) { this.show(index); }

  markActive(index) { this.show(index); }

  markPosition(index) {
    this.current = index;
    const segment = this.page?.querySelector('.seg');
    segment?.classList.add('is-position');
  }

  flatIndex(chapter, segment) {
    return this.flat.findIndex(item => item.chapter === chapter && item.index === segment);
  }

  positionOf(index) {
    const item = this.flat[index];
    return item ? { chapter: item.chapter, segment: item.index } : { chapter: 0, segment: 0 };
  }

  visibleSegment() {
    const item = this.flat[this.current];
    return item ? { chapter: item.chapter, segment: item.index } : null;
  }

  destroy() {
    this.root.replaceChildren();
    this.root.className = '';
    this.page = null;
  }
}

export function createPagedLayout(root) {
  return new PagedLayout({ root });
}
