// IndexedDB persistence for the V0.3 reader.
// The `books` store is shared with the previous C01 reader so an existing
// library keeps working; settings, notes and audio storage use new, versioned
// stores created by an additive migration (old data is never dropped).

const DB_NAME = 'zero-one-reader-library';
const DB_VERSION = 4;

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
        const notes = db.createObjectStore('notes', { keyPath: 'id' });
        notes.createIndex('bookId', 'bookId');
      }
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  return dbPromise;
}

let current = null;

// Resolves after the transaction commits, so callers can await durability
// (IndexedDB fires `success` for the request slightly before commit).
const run = async (store, mode, fn) => {
  current = await openReaderDb();
  const tx = current.transaction(store, mode);
  const result = fn(tx.objectStore(store));
  await request(result);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return result.result;
};

const txOf = async store => {
  current = await openReaderDb();
  return current.transaction(store, 'readonly').objectStore(store);
};

export const listBooks = async () => (await request((await txOf('books')).getAll())).filter(book => book.blob);

export const putBook = book => run('books', 'readwrite', store => store.put(book));

export const deleteBookRecord = id => run('books', 'readwrite', store => store.delete(id));

export const getSetting = async id => (await request((await txOf('settings')).get(id)))?.value;

export const setSetting = (id, value) => run('settings', 'readwrite', store => store.put({ id, value }));

export async function listNotes(bookId) {
  const store = await txOf('notes');
  if (store.indexNames?.contains?.('bookId')) return request(store.index('bookId').getAll(bookId));
  return (await request(store.getAll())).filter(note => note.bookId === bookId);
}

export const putNote = note => run('notes', 'readwrite', store => store.put(note));

export const deleteNote = id => run('notes', 'readwrite', store => store.delete(id));

export const putBlob = (id, blob, meta = {}) => run('blobs', 'readwrite', store => store.put({ id, blob, ...meta }));

export const getBlob = async id => (await request((await txOf('blobs')).get(id)))?.blob ?? null;

export const deleteBlob = id => run('blobs', 'readwrite', store => store.delete(id));

export const fingerprint = async file => {
  const bytes = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
};
