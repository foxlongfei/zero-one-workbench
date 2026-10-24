// Thin, explicit client for the family server. Every call is guarded so the
// reader still works (local-only) when nobody started server/app.mjs.
const state = { online: false, narration: null, lastError: null };

export const server = {
  get online() { return state.online; },
  get narration() { return state.narration; },
  get lastError() { return state.lastError; },
};

async function call(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(path, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try { message = (await response.json()).error || message; } catch {}
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export async function probeServer() {
  try {
    const health = await call('/api/health');
    state.online = Boolean(health.ok);
    state.narration = health.narration || null;
    state.lastError = null;
    return health;
  } catch (err) {
    state.online = false;
    state.narration = null;
    state.lastError = err.message;
    return null;
  }
}

// Keep failures quiet for background sync (progress, bookmarks): the reader
// must never nag the user about the network while they are reading.
async function quiet(promise) {
  try { return await promise; } catch (err) { state.lastError = err.message; return null; }
}

export const api = {
  books: () => call('/api/books').then(r => r.books),
  saveBook: book => call('/api/books', { method: 'POST', body: book }),
  deleteBook: id => call(`/api/books/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  bookBundle: id => call(`/api/books/${encodeURIComponent(id)}`),

  notes: bookId => call(`/api/notes?bookId=${encodeURIComponent(bookId)}`).then(r => r.notes),
  addNote: note => call('/api/notes', { method: 'POST', body: note }).then(r => r.note),
  updateNote: (id, text) => call(`/api/notes/${id}`, { method: 'PATCH', body: { text } }).then(r => r.note),
  removeNote: id => call(`/api/notes/${id}`, { method: 'DELETE' }),

  addBookmark: bookmark => call('/api/bookmarks', { method: 'POST', body: bookmark }).then(r => r.bookmark),
  removeBookmark: id => call(`/api/bookmarks/${id}`, { method: 'DELETE' }),

  saveListening: position => quiet(call('/api/listening', { method: 'PUT', body: position })),

  voices: () => call('/api/voices'),
  addVoice: voice => call('/api/voices', { method: 'POST', body: voice }).then(r => r.voice),
  revokeVoice: id => call(`/api/voices/${id}/revoke`, { method: 'POST' }),
  deleteVoiceSamples: id => call(`/api/voices/${id}/sample`, { method: 'DELETE' }),
  forgetVoice: id => call(`/api/voices/${id}`, { method: 'DELETE' }),
  preferVoice: voiceId => call('/api/voices/preferred', { method: 'PUT', body: { voiceId } }),

  /** Fetch narration audio; rejects with status 403/409 for unauthorized voices. */
  narration: (text, { speed, voice, signal }) => {
    const query = new URLSearchParams({ text, speed: String(speed) });
    if (voice && voice !== 'system') query.set('voice', voice);
    return fetch(`/api/narration/seg?${query}`, { signal }).then(async response => {
      if (!response.ok) {
        let message = `${response.status} ${response.statusText}`;
        try { message = (await response.json()).error || message; } catch {}
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      const cache = response.headers.get('x-narration-cache');
      return { blob: await response.blob(), cache };
    });
  },
};

export { quiet };
