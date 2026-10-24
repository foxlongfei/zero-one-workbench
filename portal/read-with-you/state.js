// Local-first persistence for Read With You.
// One IndexedDB database, versioned stores, no data ever leaves the device.
// Old prototype data from the same origin is migrated on first launch.

export const DB_NAME = 'rwy-db';
export const DB_VERSION = 1;
const LEGACY_DB = 'zero-one-reader-library';

export const STORES = {
  books: { keyPath: 'id', indexes: [['fingerprint', 'fingerprint']] },
  positions: { keyPath: 'bookId' },
  bookmarks: { keyPath: 'id', indexes: [['bookId', 'bookId']] },
  notes: { keyPath: 'id', indexes: [['bookId', 'bookId']] },
  settings: { keyPath: 'id' },
  voices: { keyPath: 'id' },
  audit: { keyPath: 'id', indexes: [['at', 'at']] },
};

let dbPromise = null;

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  });
}

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, def] of Object.entries(STORES)) {
        const store = db.objectStoreNames.contains(name)
          ? request.transaction.objectStore(name)
          : db.createObjectStore(name, { keyPath: def.keyPath });
        for (const [indexName, path] of def.indexes || []) {
          if (!store.indexNames.contains(indexName)) store.createIndex(indexName, path);
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('另一个页面正在升级书库，请关闭其它标签页后重试'));
  }).then(async (db) => {
    await migrateLegacy(db).catch(() => {});
    return db;
  });
  return dbPromise;
}

async function migrateLegacy(db) {
  const markerKey = 'legacy-migrated';
  const settingsTx = db.transaction('settings', 'readonly');
  const marker = await promisify(settingsTx.objectStore('settings').get(markerKey));
  if (marker) return;
  let legacy;
  try {
    legacy = await new Promise((resolve, reject) => {
      const request = indexedDB.open(LEGACY_DB);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('blocked'));
    });
  } catch {
    return;
  }
  const imported = [];
  try {
    if (!legacy.objectStoreNames.contains('books')) return;
    const books = await promisify(legacy.transaction('books', 'readonly').objectStore('books').getAll());
    for (const old of books) {
      if (!old?.blob?.size) continue;
      const id = `mig-${old.id}`;
      const existing = await get('books', id);
      if (existing) continue;
      const format = String(old.format || old.filename?.split('.').pop() || '').toUpperCase();
      await put('books', {
        id,
        title: old.title || old.filename || '未命名',
        author: old.author || '',
        format,
        filename: old.filename || 'book',
        blob: old.blob,
        cover: old.cover instanceof Blob ? old.cover : null,
        fingerprint: old.fingerprint || null,
        size: old.blob.size,
        addedAt: Date.parse(old.added) || Date.now(),
        migratedFrom: LEGACY_DB,
      });
      imported.push([old.id, id]);
    }
    for (const [oldId, newId] of imported) {
      for (const key of ['reader-pos-', 'reader-bookmarks-']) {
        const raw = localStorage.getItem(key + oldId);
        if (!raw) continue;
        const value = JSON.parse(raw);
        if (key === 'reader-pos-') {
          await put('positions', {
            bookId: newId,
            cfi: value.cfi || null,
            textPage: Number.isInteger(value.index) ? value.index : null,
            label: value.label || '',
            updatedAt: Number(value.lastReadAt) || Date.now(),
          });
        } else if (Array.isArray(value)) {
          for (const item of value)
            await put('bookmarks', { id: `mig-${item.id}`, bookId: newId, cfi: item.cfi || null, label: item.label || '', createdAt: item.createdAt || Date.now() });
        }
      }
    }
  } finally {
    legacy.close?.();
  }
  if (imported.length) await audit('library.migrated', { count: imported.length, from: LEGACY_DB });
  await put('settings', { id: markerKey, at: Date.now(), count: imported.length });
}

export async function getStore(name, mode = 'readonly') {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export async function get(name, key) {
  return promisify((await getStore(name)).get(key));
}

export async function getAll(name) {
  return promisify((await getStore(name)).getAll());
}

export async function getAllByIndex(name, index, value) {
  return promisify((await getStore(name)).index(index).getAll(value));
}

export async function put(name, value) {
  const store = await getStore(name, 'readwrite');
  const tx = store.transaction;
  const result = promisify(store.put(value));
  await txDone(tx);
  return result;
}

export async function del(name, key) {
  const store = await getStore(name, 'readwrite');
  const tx = store.transaction;
  await promisify(store.delete(key));
  await txDone(tx);
}

export async function count(name) {
  return promisify((await getStore(name)).count());
}

export async function audit(action, detail = {}) {
  // Privacy audit log: actions and metadata only, never note text or audio.
  const entry = { id: crypto.randomUUID(), at: Date.now(), action, detail };
  try {
    await put('audit', entry);
  } catch {
    return entry;
  }
  return entry;
}

export async function getAudit(limit = 200) {
  const all = await getAll('audit');
  return all.sort((a, b) => b.at - a.at).slice(0, limit);
}

// Settings helpers -------------------------------------------------------

export async function getSettings() {
  const rows = await getAll('settings');
  return Object.fromEntries(rows.map((row) => [row.id, 'value' in row ? row.value : row]));
}

export async function setSetting(id, value) {
  return put('settings', { id, value });
}

// Positions --------------------------------------------------------------

export async function savePosition(bookId, position) {
  const row = { bookId, updatedAt: Date.now(), ...position };
  await put('positions', row);
  return row;
}

export async function getPosition(bookId) {
  return get('positions', bookId);
}

// Deletion ---------------------------------------------------------------

export async function deleteBookCascade(bookId) {
  const removed = {};
  const db = await openDb();
  const names = ['books', 'positions', 'notes', 'bookmarks'];
  const tx = db.transaction(names, 'readwrite');
  tx.objectStore('books').delete(bookId);
  tx.objectStore('positions').delete(bookId);
  const notesIndex = tx.objectStore('notes').index('bookId');
  const bookmateNotes = await promisify(notesIndex.getAllKeys(bookId));
  removed.notes = bookmateNotes.length;
  for (const key of bookmateNotes) tx.objectStore('notes').delete(key);
  const bookmarkIndex = tx.objectStore('bookmarks').index('bookId');
  const bookmarkKeys = await promisify(bookmarkIndex.getAllKeys(bookId));
  removed.bookmarks = bookmarkKeys.length;
  for (const key of bookmarkKeys) tx.objectStore('bookmarks').delete(key);
  await txDone(tx);
  removed.book = true;
  return removed;
}

// Export / import of everything the user owns -----------------------------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function exportLibrary({ includeBookFiles = false } = {}) {
  const books = (await getAll('books')).map(async (book) => ({
    ...book,
    blob: includeBookFiles && book.blob ? { base64: await blobToBase64(book.blob), type: book.blob.type } : null,
    cover: null,
  }));
  const [resolvedBooks, positions, bookmarks, notes, settings, voices] = await Promise.all([
    Promise.all(books), getAll('positions'), getAll('bookmarks'), getAll('notes'), getAll('settings'), getAll('voices'),
  ]);
  return {
    app: 'read-with-you',
    schema: DB_VERSION,
    exportedAt: new Date().toISOString(),
    includeBookFiles,
    books: resolvedBooks,
    positions,
    bookmarks,
    notes,
    settings,
    voices,
  };
}

export async function importLibrary(data) {
  if (data?.app !== 'read-with-you') throw new Error('不是陪你读书的备份文件');
  let books = 0;
  for (const book of data.books || []) {
    const { base64, type } = book.blob || {};
    const blob = base64 ? base64ToBlob(base64, type || 'application/octet-stream') : undefined;
    const existing = blob ? null : await get('books', book.id);
    await put('books', { ...book, blob: blob || existing?.blob, cover: existing?.cover || null });
    books++;
  }
  for (const [store, rows] of [['positions', data.positions], ['bookmarks', data.bookmarks], ['notes', data.notes], ['voices', data.voices]]) {
    for (const row of rows || []) await put(store, row);
  }
  for (const row of data.settings || []) if (!String(row.id).startsWith('legacy-')) await put('settings', row);
  await audit('library.imported', { books });
  return { books };
}
