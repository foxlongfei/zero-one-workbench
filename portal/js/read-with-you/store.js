// On-device persistence. Books (including their original files), reading
// positions and the background-music track never leave the browser; the
// server only ever sees titles, positions and notes for sync.
const DB_NAME = 'zero-one-reader-library';
const DB_VERSION = 3;
const POSITION_PREFIX = 'rwy-pos-';
const SETTINGS_PREFIX = 'rwy-settings';
const MAX_MUSIC_BYTES = 80 * 1024 * 1024;

let dbPromise = null;

export function openLibrary() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Version 1/2 stores are kept untouched so the earlier reader's shelf
      // records remain readable; new records simply carry more fields.
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

const wrap = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function allBooks() {
  const db = await openLibrary();
  const items = await wrap(db.transaction('books').objectStore('books').getAll());
  return items.filter(book => book && book.blob);
}

export async function saveBook(book) {
  const db = await openLibrary();
  await wrap(db.transaction('books', 'readwrite').objectStore('books').put(book));
  return book;
}

export async function getBook(id) {
  const db = await openLibrary();
  return wrap(db.transaction('books').objectStore('books').get(id));
}

export async function removeBook(id) {
  const db = await openLibrary();
  await wrap(db.transaction('books', 'readwrite').objectStore('books').delete(id));
  localStorage.removeItem(POSITION_PREFIX + id);
  localStorage.removeItem(`reader-bookmarks-${id}`);
}

export async function findDuplicate(fingerprint) {
  const books = await allBooks();
  return books.find(book => book.fingerprint === fingerprint) || null;
}

// ------------------------------------------------------------------ positions
export function readPosition(bookId) {
  try { return JSON.parse(localStorage.getItem(POSITION_PREFIX + bookId) || 'null'); } catch { return null; }
}

export function writePosition(bookId, position) {
  try { localStorage.setItem(POSITION_PREFIX + bookId, JSON.stringify({ ...position, lastReadAt: Date.now() })); } catch {}
}

export function clearPosition(bookId) {
  localStorage.removeItem(POSITION_PREFIX + bookId);
}

// ------------------------------------------------------------------- settings
export function readSettings() {
  try {
    return {
      speed: 1,
      voice: 'system',
      engine: 'auto',
      fontScale: 1,
      theme: 'paper',
      musicLevel: 0.18,
      ducking: true,
      ...JSON.parse(localStorage.getItem(SETTINGS_PREFIX) || '{}'),
    };
  } catch {
    return { speed: 1, voice: 'system', engine: 'auto', fontScale: 1, theme: 'paper', musicLevel: 0.18, ducking: true };
  }
}

export function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  localStorage.setItem(SETTINGS_PREFIX, JSON.stringify(next));
  return next;
}

// ------------------------------------------------------------ background music
export async function saveBackground(file) {
  if (file.size > MAX_MUSIC_BYTES) throw new Error('背景音乐文件不能超过 80 MB');
  if (file.type && !file.type.startsWith('audio')) throw new Error('请选择音频文件');
  const db = await openLibrary();
  await wrap(db.transaction('settings', 'readwrite').objectStore('settings').put({
    id: 'background-audio', name: file.name, type: file.type, blob: file,
    license: 'user-supplied', updatedAt: Date.now(),
  }));
  return { name: file.name, type: file.type };
}

export async function readBackground() {
  const db = await openLibrary();
  const saved = await wrap(db.transaction('settings').objectStore('settings').get('background-audio'));
  return saved?.blob instanceof Blob ? saved : null;
}

export async function clearBackground() {
  const db = await openLibrary();
  await wrap(db.transaction('settings', 'readwrite').objectStore('settings').delete('background-audio'));
}

// ---------------------------------------------------------------- shelf order
export function sortShelf(books) {
  const stamp = book => {
    const position = readPosition(book.id);
    return position ? Number(position.lastReadAt) || 0 : Date.parse(book.addedAt || book.added || 0) || 0;
  };
  return [...books].sort((a, b) => {
    const pa = readPosition(a.id), pb = readPosition(b.id);
    if (Boolean(pa) !== Boolean(pb)) return pb ? 1 : -1;
    return stamp(b) - stamp(a);
  });
}
