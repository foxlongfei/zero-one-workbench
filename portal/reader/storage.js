// 陪你读书 · 本机数据层
// 所有个人数据只留在当前浏览器：IndexedDB 存书与笔记/声音样本，localStorage 存轻量设置。
// 这里集中定义键名与 schema，方便未来迁移与「一键清除」。

export const DB_NAME = 'zero-one-reader-library';
export const DB_VERSION = 3;
export const STORES = {
  books: 'books',
  settings: 'settings',
  notes: 'notes',
  voices: 'voices',
  consents: 'consents',
  stats: 'stats',
};

const LS = {
  pos: id => 'reader-pos-' + id,
  bookmarks: id => 'reader-bookmarks-' + id,
  readingSettings: 'reader-settings',
  ducking: 'reader-music-ducking',
  ambient: 'reader-ambient-v1',
};

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.books)) db.createObjectStore(STORES.books, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.notes)) {
        const notes = db.createObjectStore(STORES.notes, { keyPath: 'id' });
        notes.createIndex('bookId', 'bookId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.voices)) db.createObjectStore(STORES.voices, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.consents)) db.createObjectStore(STORES.consents, { keyPath: 'voiceId' });
      if (!db.objectStoreNames.contains(STORES.stats)) {
        const stats = db.createObjectStore(STORES.stats, { keyPath: 'bookId' });
        stats.createIndex('lastAt', 'lastAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('另一个标签页正在升级书库，请关闭其它阅读页后重试'));
  });
}

export const request = r => new Promise((ok, no) => {
  r.onsuccess = () => ok(r.result);
  r.onerror = () => no(r.error);
});

export class Store {
  constructor(db, name) { this.db = db; this.name = name; }
  #os(mode) { return this.db.transaction(this.name, mode).objectStore(this.name); }
  get(key) { return request(this.#os('readonly').get(key)); }
  all() { return request(this.#os('readonly').getAll()); }
  byIndex(index, key) { return request(this.#os('readonly').index(index).getAll(key)); }
  put(value) { return request(this.#os('readwrite').put(value)); }
  delete(key) { return request(this.#os('readwrite').delete(key)); }
  clear() { return request(this.#os('readwrite').clear()); }
}

export function readingPosition(bookId) {
  try { return JSON.parse(localStorage.getItem(LS.pos(bookId)) || 'null'); } catch { return null; }
}
export function saveReadingPosition(bookId, value) {
  try { localStorage.setItem(LS.pos(bookId), JSON.stringify({ ...value, lastReadAt: Date.now() })); } catch { /* 存储满时静默 */ }
}
export function clearReadingPosition(bookId) {
  try { localStorage.removeItem(LS.pos(bookId)); } catch { /* ignore */ }
}

export function loadBookmarks(bookId) {
  try {
    const list = JSON.parse(localStorage.getItem(LS.bookmarks(bookId)) || '[]');
    return Array.isArray(list) ? list.filter(x => x && typeof x === 'object') : [];
  } catch { return []; }
}
export function saveBookmarks(bookId, list) {
  try { localStorage.setItem(LS.bookmarks(bookId), JSON.stringify(list)); } catch { /* ignore */ }
}

export function loadReadingSettings() {
  try { return JSON.parse(localStorage.getItem(LS.readingSettings) || '{}') || {}; } catch { return {}; }
}
export function saveReadingSettings(value) {
  try { localStorage.setItem(LS.readingSettings, JSON.stringify(value)); } catch { /* ignore */ }
}

export function loadAmbientPrefs() {
  try { return JSON.parse(localStorage.getItem(LS.ambient) || '{}') || {}; } catch { return {}; }
}
export function saveAmbientPrefs(value) {
  try { localStorage.setItem(LS.ambient, JSON.stringify(value)); } catch { /* ignore */ }
}

export function duckingEnabled() {
  return localStorage.getItem(LS.ducking) !== 'off';
}
export function setDucking(on) {
  try { localStorage.setItem(LS.ducking, on ? 'on' : 'off'); } catch { /* ignore */ }
}

// 统计：按本地日期累加阅读时长与听书时长（秒）。
export function localDay(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addReadingTime(record, { seconds, listening, day }) {
  const row = record && typeof record === 'object' ? { ...record } : {};
  row.days = row.days && typeof row.days === 'object' ? { ...row.days } : {};
  const cell = row.days[day] && typeof row.days[day] === 'object' ? { ...row.days[day] } : {};
  cell.readSeconds = Math.max(0, Math.round((cell.readSeconds || 0) + (listening ? 0 : seconds)));
  cell.listenSeconds = Math.max(0, Math.round((cell.listenSeconds || 0) + (listening ? seconds : 0)));
  row.days[day] = cell;
  row.totalReadSeconds = Math.max(0, Math.round((row.totalReadSeconds || 0) + (listening ? 0 : seconds)));
  row.totalListenSeconds = Math.max(0, Math.round((row.totalListenSeconds || 0) + (listening ? seconds : 0)));
  return row;
}

export function summarizeDays(records, days = 7, today = localDay()) {
  const out = [];
  const base = new Date(today + 'T00:00:00');
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const key = localDay(d.getTime());
    let read = 0, listen = 0;
    for (const r of records) {
      const cell = r?.days?.[key];
      if (!cell) continue;
      read += Number(cell.readSeconds) || 0;
      listen += Number(cell.listenSeconds) || 0;
    }
    out.push({ day: key, readSeconds: read, listenSeconds: listen });
  }
  return out;
}

// 清空所有读者数据（隐私入口）：书籍、笔记、声音样本、授权、统计与本地设置。
export async function eraseEverything(db) {
  for (const name of ['books', 'settings', 'notes', 'voices', 'consents', 'stats']) {
    await new Store(db, name).clear();
  }
  const keep = ['reader-music-ducking'];
  for (const key of Object.keys(localStorage)) {
    if (!keep.includes(key)) localStorage.removeItem(key);
  }
}
