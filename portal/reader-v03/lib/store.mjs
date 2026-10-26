// IndexedDB persistence for the reader.
//
// The database name and the `books` / `notes` / `settings` / `blobs` stores are
// the ones the earlier C01 reader used, so an existing shelf keeps working. New
// data (portable parsed books, dialogue, bookmarks) goes into `records`, added
// by an additive migration — nothing is ever dropped on upgrade.

const DB_NAME = 'zero-one-reader-library';
const DB_VERSION = 5;

let dbPromise = null;

const request = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export function openReaderDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' }).createIndex('bookId', 'bookId');
      }
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'key' });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  return dbPromise;
}

// Runs `fn(store)` inside one transaction and resolves after it commits, so
// callers can await durability (IndexedDB fires `success` before commit).
const run = async (storeName, mode, fn) => {
  const db = await openReaderDb();
  const tx = db.transaction(storeName, mode);
  const result = fn(tx.objectStore(storeName));
  const value = result && typeof result.onsuccess === 'object' ? await request(result) : result;
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return value;
};

export const listBooks = async () => (await request((await openReaderDb()).transaction('books').objectStore('books').getAll())).filter(book => book.blob);

export const getBookEntry = id => run('books', 'readonly', store => store.get(id));

export const putBook = book => run('books', 'readwrite', store => store.put(book));

export const deleteBookRecord = async id => {
  await run('books', 'readwrite', store => store.delete(id));
  await run('records', 'readwrite', store => store.delete(`portable:${id}`));
};

export const getSetting = async id => (await request((await openReaderDb()).transaction('settings').objectStore('settings').get(id)))?.value;

export const setSetting = (id, value) => run('settings', 'readwrite', store => store.put({ id, value }));

export async function listNotes(bookId) {
  const store = (await openReaderDb()).transaction('notes').objectStore('notes');
  if (store.indexNames?.contains?.('bookId')) return request(store.index('bookId').getAll(bookId));
  return (await request(store.getAll())).filter(note => note.bookId === bookId);
}

export const putNote = note => run('notes', 'readwrite', store => store.put(note));

export const deleteNote = id => run('notes', 'readwrite', store => store.delete(id));

export const putBlob = (id, blob, meta = {}) => run('blobs', 'readwrite', store => store.put({ id, blob, ...meta }));

export const getBlob = async id => (await request((await openReaderDb()).transaction('blobs').objectStore('blobs').get(id)))?.blob ?? null;

export const deleteBlob = id => run('blobs', 'readwrite', store => store.delete(id));

// --- portable books and other keyed records -------------------------------
export const putPortable = (bookId, portable) => run('records', 'readwrite', store => store.put({ key: `portable:${bookId}`, value: portable, updatedAt: new Date().toISOString() }));

export const getPortable = async bookId => (await request((await openReaderDb()).transaction('records').objectStore('records').get(`portable:${bookId}`)))?.value ?? null;

export const putRecord = (key, value) => run('records', 'readwrite', store => store.put({ key, value, updatedAt: new Date().toISOString() }));

export const getRecord = async (key, fallback = null) => (await request((await openReaderDb()).transaction('records').objectStore('records').get(key)))?.value ?? fallback;

export const deleteRecord = key => run('records', 'readwrite', store => store.delete(key));

// SHA-256 of the whole file: recognises the same book even if it was renamed.
// Large files are hashed in one WebCrypto call, which is fast enough for books
// (tens of MB) and keeps the fingerprint exact.
export const fingerprint = async file => {
  const bytes = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
};

export async function estimateUsage() {
  if (!navigator.storage?.estimate) return null;
  try { return await navigator.storage.estimate(); } catch { return null; }
}
