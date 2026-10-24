// Writes the narration panels: notes/discussion, family voices and settings.
// Everything here is rendered from plain data so the shell can re-render after
// any change without tracking state in the DOM.
import { clipped, el } from './ui.js';
import { formatStamp } from './layout-helpers.js';
import { chaptersOf } from './books.js';

// --------------------------------------------------------------------- notes
export class NotesController {
  constructor({ book, container, api, server, onSeek, current }) {
    this.book = book;
    this.container = container;
    this.api = api;
    this.server = server;
    this.onSeek = onSeek;
    this.current = current;
    this.items = [];
    this.draft = '';
  }

  async load() {
    this.items = [];
    if (this.server?.online) {
      try { this.items = await this.api.notes(this.book.id); } catch { this.items = []; }
    }
    this.render();
  }

  quote() {
    const position = this.current?.() || { chapter: 0, segment: 0 };
    const chapter = chaptersOf(this.book)[position.chapter];
    const text = chapter?.segments?.[position.segment] || '';
    return { text: clipped(text, 120), chapter: position.chapter, segment: position.segment, chapterTitle: chapter?.title || '' };
  }

  render() {
    if (!this.container) return;
    this.container.replaceChildren();
    const form = el('div', { class: 'note-form' });
    const heading = el('p', { class: 'eyebrow', text: '写一条笔记' });
    const quote = el('blockquote', { class: 'quote', text: this.quote().text || '（当前段落为空）' });
    quote.onclick = () => this.onSeek?.(this.indexOfQuote());
    const input = el('textarea', { placeholder: '记下想法、疑问，或念给孩子听的那句话…', value: this.draft });
    input.addEventListener('input', () => { this.draft = input.value; });
    const submit = el('button', { type: 'button', class: 'primary', text: '保存笔记' });
    submit.onclick = async () => {
      const text = input.value.trim();
      if (!text) return;
      const position = this.current?.() || { chapter: 0, segment: 0 };
      const note = {
        bookId: this.book.id, text, chapterIndex: position.chapter, segmentIndex: position.segment,
        quote: this.quote().text, createdAt: new Date().toISOString(),
      };
      if (this.server?.online) {
        try { await this.api.addNote(note); } catch { /* keep local copy below */ }
      }
      this.items = [{ id: `local-${crypto.randomUUID()}`, ...note, local: true }, ...this.items];
      this.draft = '';
      this.render();
      this.onChange?.();
    };
    form.append(heading, quote, input, submit);

    const list = el('div', { class: 'note-list' });
    if (!this.items.length) list.append(el('p', { class: 'empty-note', text: '还没有笔记。读到喜欢的句子，写一句留下。' }));
    for (const note of this.items) list.append(this.noteNode(note));
    this.container.append(form, list);
  }

  indexOfQuote() {
    const position = this.current?.() || { chapter: 0, segment: 0 };
    return position;
  }

  noteNode(note) {
    const card = el('article', { class: 'note-item' });
    if (note.quote) {
      const quote = el('p', { class: 'quote', text: note.quote });
      quote.onclick = () => this.onSeek?.(this.flatFor(note));
      card.append(quote);
    }
    card.append(el('p', { text: note.text }));
    const meta = el('div', { class: 'note-meta' });
    meta.append(el('span', { text: formatStamp(note.createdAt) || '刚刚' }));
    const jump = el('button', { type: 'button', class: 'ghost', text: '回到原文' });
    jump.onclick = () => this.onSeek?.(this.flatFor(note));
    meta.append(jump);
    const remove = el('button', { type: 'button', class: 'ghost', text: '删除' });
    remove.onclick = async () => {
      this.items = this.items.filter(item => item.id !== note.id);
      if (this.server?.online && !note.local) this.api.removeNote(note.id).catch(() => {});
      this.render();
      this.onChange?.();
    };
    meta.append(remove);
    card.append(meta);
    return card;
  }

  flatFor(note) {
    const chapters = chaptersOf(this.book);
    let offset = 0;
    for (let i = 0; i < (note.chapterIndex ?? 0); i++) offset += chapters[i]?.segments.length || 0;
    return offset + (note.segmentIndex ?? 0);
  }

  updateQuote() { /* quote refreshes on next render */ }
}
