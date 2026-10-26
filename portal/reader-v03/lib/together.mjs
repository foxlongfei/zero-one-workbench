// Accountless presence: who is reading, who is listening, and the one shared
// page children and parents can leave notes on.
//
// Requirement from the product vision: no accounts, no cloud. A household is a
// few devices in the same room. Every device keeps a random "device id" and a
// display name it picked for itself. This module turns the two into
//   * a stable, human-readable colour so a note's author is recognisable,
//   * a session-invite code pair (the same 6 characters written two ways) that
//     two devices can read aloud to each other to compare their data,
//   * a merge that never loses a note: notes are keyed by their own id, so the
//     device that imported the same book twice just ends up with each note once.
//
// Pure functions only: the DOM never touches this file and the Node tests can
// assert the merge rules directly.

export const SESSION_CODE_LENGTH = 6;
// Excludes I/O/0/1 so a code read aloud across the room is unambiguous.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Deterministic 6-character body from any string (device id, book id).
export function sessionCode(seed, { length = SESSION_CODE_LENGTH } = {}) {
  const text = String(seed ?? '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  let code = '';
  for (let i = 0; i < length; i++) {
    hash = Math.imul(hash ^ (hash >>> 13), 2654435761) >>> 0;
    code += ALPHABET[hash % ALPHABET.length];
  }
  return code;
}

// "K7M-2QF": the spoken-friendly grouping used when comparing two devices.
export const formatCode = code => {
  const value = String(code ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return value.length > 3 ? `${value.slice(0, 3)}-${value.slice(3)}` : value;
};

export const normalizeCode = code => String(code ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const HUES = [22, 40, 92, 148, 178, 206, 232, 268, 300, 336];

export const readerColour = name => {
  let hash = 0;
  for (const ch of String(name ?? '我')) hash = (hash * 31 + ch.codePointAt(0)) % 99991;
  return `hsl(${HUES[hash % HUES.length]} 46% 62%)`;
};

export const initials = name => {
  const value = String(name ?? '').trim();
  if (!value) return '读';
  const latin = value.match(/[A-Za-z]+/g);
  if (latin) return latin.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return value.slice(0, 2);
};

// A reading session: which book, where in it, who, and when. Used by the
// "一起读" strip so a parent can see the child's place without waiting for a
// sync of any kind.
export function readingSession({ reader, bookId, bookTitle, chapter, paragraph, at = new Date() }) {
  return {
    id: `${bookId}:${reader?.id ?? 'me'}`,
    reader: { id: reader?.id ?? '', name: reader?.name ?? '我', colour: readerColour(reader?.name ?? '我') },
    bookId,
    bookTitle: String(bookTitle ?? ''),
    chapter: Number(chapter) || 0,
    paragraph: Number(paragraph) || 0,
    at: at instanceof Date ? at.toISOString() : String(at),
  };
}

export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

export const isRecentSession = (session, now = Date.now(), ttl = SESSION_TTL_MS) => {
  const at = Date.parse(session?.at ?? '');
  return Number.isFinite(at) && now - at < ttl && now - at > -ttl;
};

// Which note wins when two devices hold different versions of the same id:
// the most recently edited one, with a deterministic tie-break so both devices
// converge on the same answer instead of ping-ponging edits.
const noteStamp = note => `${note?.editedAt || note?.createdAt || ''}|${note?.text ?? ''}`;

export function mergeNotes(local = [], remote = []) {
  const byId = new Map();
  for (const note of [...(local ?? []), ...(remote ?? [])]) {
    if (!note?.id) continue;
    const existing = byId.get(note.id);
    if (!existing || noteStamp(note) > noteStamp(existing)) byId.set(note.id, note);
  }
  return [...byId.values()].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}

// A shared package one device can hand to another as a file. It contains notes
// and reading positions only — never book files, because the book is the
// copyright holder's, and the shelf is already local per device.
export function buildSyncBundle({ deviceId, readerName, books = [], notes = [], exportedAt = new Date() }) {
  return {
    kind: 'read-with-you/sync',
    version: 1,
    exportedAt: exportedAt instanceof Date ? exportedAt.toISOString() : String(exportedAt),
    device: { id: String(deviceId ?? ''), name: String(readerName ?? '') },
    positions: (books ?? []).map(({ id, chapter = 0, paragraph = 0, chapterTitle = '', updatedAt = '', listening = false }) => ({
      bookId: id, chapter: Number(chapter) || 0, paragraph: Number(paragraph) || 0, chapterTitle, updatedAt, listening: Boolean(listening),
    })),
    notes: mergeNotes([], notes ?? []),
  };
}

export function readSyncBundle(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.kind !== 'read-with-you/sync' || !Array.isArray(raw.notes)) return null;
  const positions = (Array.isArray(raw.positions) ? raw.positions : [])
    .filter(item => item && item.bookId)
    .map(item => ({
      bookId: String(item.bookId),
      chapter: Math.max(0, Number(item.chapter) || 0),
      paragraph: Math.max(0, Number(item.paragraph) || 0),
      chapterTitle: String(item.chapterTitle ?? ''),
      updatedAt: String(item.updatedAt ?? ''),
      listening: Boolean(item.listening),
    }));
  return {
    kind: 'read-with-you/sync',
    version: 1,
    exportedAt: String(raw.exportedAt ?? ''),
    device: { id: String(raw.device?.id ?? ''), name: String(raw.device?.name ?? '') },
    positions,
    notes: raw.notes.filter(note => note && note.id && note.bookId),
  };
}

// Do the two devices hold the same shelf entry? Same fingerprint means the same
// file even when its name differs, and the id is only unique per device.
const sameBook = (a, b) => Boolean(a && b) && (a.fingerprint ? a.fingerprint === b.fingerprint : a.id === b.id);

// Map a bundle's positions onto this device's book ids. A position for a book
// that is not on this shelf is reported, not invented: the file cannot travel.
export function adoptPositions(bundle, localBooks = []) {
  const adopted = [];
  const missing = [];
  for (const position of bundle?.positions ?? []) {
    const book = localBooks.find(candidate => candidate.id === position.bookId)
      ?? localBooks.find(candidate => sameBook(candidate, position));
    if (book) adopted.push({ ...position, bookId: book.id });
    else missing.push(position.bookId);
  }
  return { adopted, missing };
}

// Keep the later of two reading positions for one book. "Later" is decided by
// the device whose progress was saved most recently, not by the linear
// position: one device turns a few pages while the other listens for an hour
// in the car, and the listener is the one who actually moved on.
export function pickLaterPosition(a, b) {
  if (!a) return b ?? null;
  if (!b) return a ?? null;
  const at = value => Date.parse(value?.updatedAt ?? '') || 0;
  if (at(b) !== at(a)) return at(b) > at(a) ? b : a;
  const rank = value => (Number(value.chapter) || 0) * 1e6 + (Number(value.paragraph) || 0);
  return rank(b) > rank(a) ? b : a;
}
