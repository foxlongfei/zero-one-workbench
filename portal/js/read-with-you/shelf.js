// The shelf overview: current book, continue-listening card, book grid and the
// family-voices entry. Rendering is kept declarative so the shell can refresh
// it after imports, deletes or progress changes.
import { readPosition, sortShelf } from './store.js';
import { chaptersOf } from './books.js';

const escape = value => String(value ?? '');

export function coverNode(book, { large = false } = {}) {
  if (book.cover instanceof Blob && book.cover.size) {
    const image = document.createElement('img');
    image.src = URL.createObjectURL(book.cover);
    image.alt = '';
    image.className = 'cover-image';
    image.loading = 'lazy';
    return image;
  }
  const art = document.createElement('div');
  art.className = 'cover-art';
  art.dataset.format = book.format || 'TXT';
  const title = document.createElement('span');
  title.textContent = book.title || book.filename || '未命名';
  const mark = document.createElement('small');
  mark.textContent = book.format || 'TXT';
  art.append(title, mark);
  return art;
}

export function progressText(book, position) {
  if (!position) return '未开始';
  const chapters = chaptersOf(book);
  const chapter = chapters[position.chapter];
  const label = chapter?.title || `第 ${(position.chapter || 0) + 1} 部分`;
  const percent = chapters.length
    ? Math.round(((position.chapter * 1000 + Math.min(position.segment || 0, 999)) / (chapters.length * 1000)) * 100)
    : 0;
  return `${label} · ${percent}%`;
}

export function renderShelf(container, books, { query = '', onOpen, onDelete, onReset }) {
  container.replaceChildren();
  const normalized = query.trim().toLowerCase();
  const ordered = sortShelf(books);
  const visible = normalized
    ? ordered.filter(book => [book.title, book.author, book.filename, book.format].filter(Boolean).join(' ').toLowerCase().includes(normalized))
    : ordered;
  if (!books.length) {
    const empty = document.createElement('p');
    empty.className = 'shelf-empty';
    empty.innerHTML = '书架还是空的。导入一本 <strong>TXT</strong> 或 <strong>EPUB</strong>，就能开始朗读。';
    container.append(empty);
    return { visible: 0, total: 0 };
  }
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'shelf-empty';
    empty.textContent = `没有找到“${query.trim()}”`;
    container.append(empty);
    return { visible: 0, total: books.length };
  }
  for (const book of visible) {
    const position = readPosition(book.id);
    const card = document.createElement('article');
    card.className = 'shelf-card';
    card.dataset.bookId = book.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `打开《${book.title || book.filename}》`);
    const open = () => onOpen(book);
    card.addEventListener('click', event => { if (!event.target.closest('button')) open(); });
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });

    const cover = document.createElement('div');
    cover.className = 'shelf-cover';
    cover.append(coverNode(book));
    const badge = document.createElement('span');
    badge.className = 'cover-badge';
    badge.textContent = book.format || 'TXT';
    cover.append(badge);

    const meta = document.createElement('div');
    meta.className = 'shelf-meta';
    const title = document.createElement('strong');
    title.textContent = escape(book.title || book.filename || '未命名');
    const author = document.createElement('small');
    author.textContent = escape(book.author || '本机藏书');
    const progress = document.createElement('small');
    progress.className = 'shelf-progress';
    progress.dataset.role = 'progress';
    progress.textContent = progressText(book, position);
    meta.append(title, author, progress);

    const actions = document.createElement('div');
    actions.className = 'shelf-actions';
    const read = document.createElement('button');
    read.type = 'button';
    read.dataset.action = 'open';
    read.textContent = position ? '继续' : '阅读';
    read.onclick = open;
    actions.append(read);
    if (position) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.dataset.action = 'reset';
      reset.textContent = '从头';
      reset.onclick = () => onReset(book);
      actions.append(reset);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.action = 'delete';
    remove.className = 'ghost';
    remove.textContent = '删除';
    remove.setAttribute('aria-label', `从书架删除《${book.title || book.filename}》`);
    remove.onclick = () => onDelete(book);
    actions.append(remove);

    card.append(cover, meta, actions);
    container.append(card);
  }
  return { visible: visible.length, total: books.length };
}

export function renderContinue(container, books, { onOpen, onStop, listening }) {
  container.replaceChildren();
  if (!listening?.bookId) return false;
  const book = books.find(b => b.id === listening.bookId);
  if (!book) return false;
  const position = readPosition(book.id) || listening;
  const card = document.createElement('section');
  card.className = 'continue-card';
  card.id = 'continueCard';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = '继续收听';
  const heading = document.createElement('h3');
  heading.textContent = book.title || book.filename;
  const detail = document.createElement('p');
  detail.className = 'muted';
  const chapters = chaptersOf(book);
  const chapterTitle = chapters[position.chapter]?.title || '';
  detail.textContent = `${chapterTitle || progressText(book, position)} · ${new Date(position.lastReadAt || Date.now()).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  const actions = document.createElement('div');
  actions.className = 'actions';
  const resume = document.createElement('button');
  resume.type = 'button';
  resume.id = 'resumeButton';
  resume.className = 'primary';
  resume.textContent = '接着听';
  resume.onclick = () => onOpen(book, { autoplay: true });
  actions.append(resume);
  if (onStop) {
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'ghost';
    stop.textContent = '收起';
    stop.onclick = onStop;
    actions.append(stop);
  }
  card.append(eyebrow, heading, detail, actions);
  container.append(card);
  return true;
}

export function renderCurrent(container, book, position) {
  container.replaceChildren();
  if (!book) return;
  const cover = document.createElement('div');
  cover.className = 'current-cover';
  cover.append(coverNode(book, { large: true }));
  const text = document.createElement('div');
  text.className = 'current-text';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = '正在读';
  const heading = document.createElement('h2');
  heading.textContent = book.title || book.filename;
  const detail = document.createElement('p');
  detail.className = 'muted';
  detail.textContent = position ? progressText(book, position) : '还没有开始';
  const actions = document.createElement('div');
  actions.className = 'actions';
  const resume = document.createElement('button');
  resume.type = 'button';
  resume.className = 'primary';
  resume.textContent = position ? '继续阅读' : '开始阅读';
  resume.onclick = () => container.dispatchEvent(new CustomEvent('resume', { bubbles: true, detail: book }));
  actions.append(resume);
  text.append(eyebrow, heading, detail, actions);
  container.append(cover, text);
}
