// 陪你读书 / Read With You — local-first product server.
// Serves the reader app, stores the family's books and narration-synced notes,
// and (when configured) renders natural Chinese narration with sherpa-onnx.
//
//   node server/app.mjs              # http://127.0.0.1:8787
//
// Environment: PORT, FAMILY_DATA_DIR, READER_TTS_MODEL_DIR, READER_TTS_LEXICON,
// READER_TTS_TOKENS, READER_TTS_DICT, PYTHON_BIN, TTS_THREADS.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AudioCache } from './tts-cache.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dataDir = resolve(process.env.FAMILY_DATA_DIR || join(root, 'var', 'family'));
const stateFile = join(dataDir, 'family-state.json');
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';

const STATIC_ROOTS = new Map([
  ['/portal/', join(root, 'portal')],
  ['/server/', join(root, 'server')],
]);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

// ---------------------------------------------------------------- persistence
const defaultState = () => ({
  version: 1,
  books: {}, // id -> { id, title, author, charset, addedAt, paragraphCount }
  notes: {}, // noteId -> { id, bookId, text, chapterTitle, chapterIndex, segmentIndex, quote, kind, createdAt }
  bookmarks: {}, // id -> { id, bookId, chapterIndex, segmentIndex, label, createdAt }
  listening: {}, // bookId -> { bookId, chapterIndex, segmentIndex, updatedAt }
  voices: {}, // voiceId -> consent record
  settings: { preferredVoice: 'system', background: { source: null, level: 0.18 } },
});
let state = defaultState();
let saveChain = Promise.resolve();

async function loadState() {
  await mkdir(dataDir, { recursive: true });
  try {
    const parsed = JSON.parse(await readFile(stateFile, 'utf8'));
    state = { ...defaultState(), ...parsed };
  } catch {
    state = defaultState();
  }
}
function persist() {
  const snapshot = JSON.stringify(state, null, 2);
  const tmp = `${stateFile}.${randomUUID()}.tmp`;
  saveChain = saveChain.then(async () => {
    await writeFile(tmp, snapshot);
    await rename(tmp, stateFile);
  }).catch(err => console.error('could not persist family state', err));
  return saveChain;
}

// ---------------------------------------------------------------------- TTS
const modelDir = process.env.READER_TTS_MODEL_DIR ? resolve(process.env.READER_TTS_MODEL_DIR) : null;
const vitsConfig = modelDir && {
  model: join(modelDir, 'model.onnx'),
  lexicon: resolve(process.env.READER_TTS_LEXICON || join(modelDir, 'lexicon.txt')),
  tokens: resolve(process.env.READER_TTS_TOKENS || join(modelDir, 'tokens.txt')),
  dict_dir: resolve(process.env.READER_TTS_DICT || join(modelDir, 'dict')),
  threads: Number(process.env.TTS_THREADS || 2),
};
const ttsCache = new AudioCache(join(dataDir, 'tts-cache'), { maxBytes: 768 * 1024 * 1024 });

let bridge = null;
let bridgeQueue = Promise.resolve();
function ttsBridge() {
  if (!bridge) {
    const child = spawn(process.execPath, [join(here, 'native_tts_bridge.mjs')], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env, PYTHON_BIN: process.env.PYTHON_BIN || process.env.READER_TTS_PYTHON || 'python3' },
    });
    child.stdout.setEncoding('utf8');
    let buf = '';
    const waiting = new Map();
    let seq = 0;
    child.stdout.on('data', chunk => {
      buf += chunk;
      let at;
      while ((at = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, at);
        buf = buf.slice(at + 1);
        try {
          const msg = JSON.parse(line);
          const done = waiting.get(msg.id);
          if (done) { waiting.delete(msg.id); done(msg); }
        } catch {}
      }
    });
    child.on('exit', () => {
      bridge = null;
      for (const done of waiting.values()) done({ ok: false, error: 'tts engine stopped' });
      waiting.clear();
    });
    bridge = {
      child,
      request(req) {
        return new Promise(done => {
          const id = ++seq;
          waiting.set(id, done);
          child.stdin.write(JSON.stringify({ ...req, id }) + '\n');
        });
      },
    };
  }
  return bridge;
}
async function synthesize(text, { speed = 1, voice = 'narrator-zh' } = {}) {
  return (bridgeQueue = bridgeQueue.then(async () => {
    const reply = await ttsBridge().request({ op: 'synth', text, speed, sid: 0, model: { model: vitsConfig } });
    if (!reply.ok) throw new Error(reply.error || 'tts failed');
    return Buffer.from(reply.wav, 'base64');
  }));
}
const ttsStatus = async () => {
  if (!vitsConfig) return { available: false, reason: 'READER_TTS_MODEL_DIR is not configured; the reader falls back to the device voice.' };
  try {
    await stat(vitsConfig.model);
    await stat(vitsConfig.lexicon);
  } catch {
    return { available: false, reason: 'Narration model files are missing on this machine.' };
  }
  return { available: true, engine: 'sherpa-onnx VITS (MeloTTS zh_en)', license: 'Apache-2.0 (sherpa-onnx) / MIT (MeloTTS model)', sampleRate: 44100 };
};

function estimateDuration(text) {
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const rest = text.length - zh;
  return (zh / 4.6 + rest / 14);
}

// -------------------------------------------------------------------- routes
const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};
const readBody = req => new Promise((done, fail) => {
  let size = 0;
  const chunks = [];
  req.on('data', c => {
    size += c.length;
    if (size > 8 * 1024 * 1024) { fail(new Error('payload too large')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    if (!chunks.length) return done({});
    try { done(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { fail(new Error('invalid JSON')); }
  });
  req.on('error', fail);
});

function cleanText(value, max = 4000) {
  const s = String(value ?? '').replace(/\u0000/g, '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

function voiceView(record) {
  const now = Date.now();
  return {
    id: record.id,
    voiceName: record.voiceName,
    displayName: record.displayName,
    languages: record.languages || 'zh-CN',
    provider: record.provider,
    consent: record.consent,
    status: record.deletedAt ? 'deleted' : record.revokedAt ? 'revoked' : 'active',
    createdAt: record.createdAt,
    revokedAt: record.revokedAt,
    deletedAt: record.deletedAt,
    samplesDeletedAt: record.samplesDeletedAt || null,
    expiresAt: record.expiresAt || null,
    expired: Boolean(record.expiresAt && record.expiresAt < now),
    purposes: record.purposes || [],
    samplesStored: record.deletedAt ? 0 : (record.sampleBytes ? 1 : 0),
    canSynthesize: !record.deletedAt && !record.revokedAt && !(record.expiresAt && record.expiresAt < now),
  };
}

async function api(req, res, url) {
  const p = url.pathname;
  const method = req.method;

  if (p === '/api/health') {
    return json(res, 200, {
      ok: true,
      product: '陪你读书 / Read With You',
      narration: await ttsStatus(),
      books: Object.keys(state.books).length,
      voices: Object.values(state.voices).filter(v => voiceView(v).status === 'active').length,
    });
  }

  if (p === '/api/books' && method === 'GET') {
    return json(res, 200, { books: Object.values(state.books).sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')) });
  }
  if (p === '/api/books' && method === 'POST') {
    const body = await readBody(req);
    const title = cleanText(body.title, 300);
    if (!title) return json(res, 400, { error: '书名不能为空' });
    const id = cleanText(body.id, 80) || randomUUID();
    const existing = state.books[id];
    state.books[id] = {
      id,
      title,
      author: cleanText(body.author, 200),
      charset: ['utf-8', 'gb18030'].includes(body.charset) ? body.charset : 'utf-8',
      paragraphCount: Number(body.paragraphCount) || 0,
      addedAt: existing?.addedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await persist();
    return json(res, 200, { book: state.books[id] });
  }
  const bookMatch = p.match(/^\/api\/books\/([\w-]+)$/);
  if (bookMatch) {
    const id = bookMatch[1];
    if (method === 'GET') {
      if (!state.books[id]) return json(res, 404, { error: '找不到这本书' });
      return json(res, 200, {
        book: state.books[id],
        notes: Object.values(state.notes).filter(n => n.bookId === id).sort((a, b) => a.createdAt - b.createdAt),
        bookmarks: Object.values(state.bookmarks).filter(n => n.bookId === id),
        listening: state.listening[id] || null,
      });
    }
    if (method === 'DELETE') {
      delete state.books[id];
      for (const [k, n] of Object.entries(state.notes)) if (n.bookId === id) delete state.notes[k];
      for (const [k, n] of Object.entries(state.bookmarks)) if (n.bookId === id) delete state.bookmarks[k];
      delete state.listening[id];
      await persist();
      return json(res, 200, { ok: true });
    }
  }
  if (p === '/api/bookmarks' && method === 'POST') {
    const body = await readBody(req);
    const id = randomUUID();
    state.bookmarks[id] = {
      id,
      bookId: cleanText(body.bookId, 80),
      chapterIndex: Number(body.chapterIndex) || 0,
      segmentIndex: Number(body.segmentIndex) || 0,
      label: cleanText(body.label, 160),
      createdAt: Date.now(),
    };
    await persist();
    return json(res, 200, { bookmark: state.bookmarks[id] });
  }
  const bookmarkMatch = p.match(/^\/api\/bookmarks\/([\w-]+)$/);
  if (bookmarkMatch && method === 'DELETE') {
    delete state.bookmarks[bookmarkMatch[1]];
    await persist();
    return json(res, 200, { ok: true });
  }
  if (p === '/api/notes' && method === 'POST') {
    const body = await readBody(req);
    const text = cleanText(body.text);
    if (!text) return json(res, 400, { error: '笔记内容不能为空' });
    const id = randomUUID();
    state.notes[id] = {
      id,
      bookId: cleanText(body.bookId, 80),
      text,
      kind: body.kind === 'thought' ? 'thought' : 'note',
      quote: cleanText(body.quote, 600),
      chapterTitle: cleanText(body.chapterTitle, 200),
      chapterIndex: Number(body.chapterIndex) || 0,
      segmentIndex: Number(body.segmentIndex) || 0,
      createdAt: Date.now(),
    };
    await persist();
    return json(res, 200, { note: state.notes[id] });
  }
  const noteMatch = p.match(/^\/api\/notes\/([\w-]+)$/);
  if (noteMatch) {
    const id = noteMatch[1];
    if (!state.notes[id]) return json(res, 404, { error: '找不到这条笔记' });
    if (method === 'DELETE') {
      delete state.notes[id];
      await persist();
      return json(res, 200, { ok: true });
    }
    if (method === 'PATCH') {
      const body = await readBody(req);
      const text = cleanText(body.text);
      if (!text) return json(res, 400, { error: '笔记内容不能为空' });
      state.notes[id].text = text;
      state.notes[id].editedAt = Date.now();
      await persist();
      return json(res, 200, { note: state.notes[id] });
    }
  }
  if (p === '/api/notes' && method === 'GET') {
    const bookId = url.searchParams.get('bookId');
    const items = Object.values(state.notes).filter(n => !bookId || n.bookId === bookId).sort((a, b) => a.createdAt - b.createdAt);
    return json(res, 200, { notes: items });
  }
  if (p === '/api/listening' && method === 'PUT') {
    const body = await readBody(req);
    const bookId = cleanText(body.bookId, 80);
    if (!bookId) return json(res, 400, { error: '缺少 bookId' });
    state.listening[bookId] = {
      bookId,
      chapterIndex: Number(body.chapterIndex) || 0,
      segmentIndex: Number(body.segmentIndex) || 0,
      updatedAt: Date.now(),
    };
    await persist();
    return json(res, 200, { listening: state.listening[bookId] });
  }

  // ---- voices: explicit, revocable family voice consent records
  if (p === '/api/voices' && method === 'GET') {
    return json(res, 200, {
      voices: Object.values(state.voices).map(voiceView).sort((a, b) => b.createdAt - a.createdAt),
      preferredVoice: state.settings.preferredVoice,
    });
  }
  if (p === '/api/voices' && method === 'POST') {
    const body = await readBody(req);
    const voiceName = cleanText(body.voiceName, 120);
    const consent = body.consent || {};
    const problems = [];
    if (!voiceName) problems.push('需要填写声音本人的称呼');
    if (consent.authorizedBy !== 'voice-owner') problems.push('必须由声音本人确认授权，才能使用家庭声音');
    if (!Array.isArray(consent.purposes) || !consent.purposes.length) problems.push('需要选择授权用途');
    if (!cleanText(consent.statement, 2000)) problems.push('需要填写授权说明');
    if (problems.length) return json(res, 400, { error: problems.join('；'), problems });
    const id = randomUUID();
    state.voices[id] = {
      id,
      voiceName,
      displayName: cleanText(body.displayName, 120) || `${voiceName}的声音`,
      languages: cleanText(body.languages, 60) || 'zh-CN',
      provider: cleanText(body.provider, 80) || 'pending-training',
      consent: {
        authorizedBy: 'voice-owner',
        purposes: consent.purposes.map(x => cleanText(x, 40)).slice(0, 8),
        statement: cleanText(consent.statement, 2000),
        allowChildReading: Boolean(consent.allowChildReading),
        recordedAt: Date.now(),
        expiresAt: Number(consent.expiresAt) || null,
      },
      expiresAt: Number(consent.expiresAt) || null,
      createdAt: Date.now(),
      audit: [{ at: Date.now(), action: 'granted' }],
    };
    await persist();
    return json(res, 200, { voice: voiceView(state.voices[id]) });
  }
  const voiceMatch = p.match(/^\/api\/voices\/([\w-]+)(\/revoke|\/sample)?$/);
  if (voiceMatch) {
    const record = state.voices[voiceMatch[1]];
    if (!record) return json(res, 404, { error: '找不到这个声音' });
    const action = voiceMatch[2];
    if (action === '/revoke' && method === 'POST') {
      record.revokedAt = Date.now();
      record.audit.push({ at: record.revokedAt, action: 'consent-revoked' });
      if (state.settings.preferredVoice === record.id) state.settings.preferredVoice = 'system';
      await ttsCache.purgeVoice(record.id);
      await persist();
      return json(res, 200, { voice: voiceView(record) });
    }
    if (action === '/sample' && method === 'DELETE') {
      record.sampleBytes = 0;
      record.samplesDeletedAt = Date.now();
      record.audit.push({ at: record.samplesDeletedAt, action: 'samples-deleted' });
      await ttsCache.purgeVoice(record.id);
      await persist();
      return json(res, 200, { voice: voiceView(record) });
    }
    if (!action && method === 'DELETE') {
      record.deletedAt = Date.now();
      record.sampleBytes = 0;
      record.audit.push({ at: record.deletedAt, action: 'deleted' });
      if (state.settings.preferredVoice === record.id) state.settings.preferredVoice = 'system';
      await ttsCache.purgeVoice(record.id);
      await persist();
      return json(res, 200, { voice: voiceView(record) });
    }
    if (!action && method === 'PATCH') {
      const body = await readBody(req);
      state.settings.preferredVoice = cleanText(body.preferredVoice, 80) || 'system';
      await persist();
      return json(res, 200, { preferredVoice: state.settings.preferredVoice });
    }
  }
  if (p === '/api/voices/preferred' && method === 'PUT') {
    const body = await readBody(req);
    const id = cleanText(body.voiceId, 80);
    if (id && id !== 'system' && !state.voices[id]?.consent) return json(res, 400, { error: '这个声音没有有效的授权记录' });
    state.settings.preferredVoice = id || 'system';
    await persist();
    return json(res, 200, { preferredVoice: state.settings.preferredVoice });
  }

  // ---- narration
  if (p === '/api/narration' && method === 'GET') {
    return json(res, 200, { ...(await ttsStatus()), preferredVoice: state.settings.preferredVoice });
  }
  const narrationMatch = p.match(/^\/api\/narration\/([\w-]+)$/);
  if (narrationMatch && method === 'GET') {
    const text = cleanText(url.searchParams.get('text'), 1200);
    const speed = Math.min(1.6, Math.max(0.6, Number(url.searchParams.get('speed')) || 1));
    if (!text) return json(res, 400, { error: '没有要朗读的文字' });
    const voiceId = cleanText(url.searchParams.get('voice'), 80);
    let engine = 'native';
    if (voiceId && voiceId !== 'system') {
      const record = state.voices[voiceId];
      const view = record && voiceView(record);
      if (!view?.canSynthesize) return json(res, 403, { error: '这个家庭声音没有有效授权，已停止合成' });
      if (view.provider === 'pending-training') return json(res, 409, { error: '这个声音已授权，但训练尚未完成，不能用于朗读' });
      engine = `voice:${voiceId}`;
    }
    const key = AudioCache.key({ engine, voice: voiceId || 'system', speed, text });
    const cached = await ttsCache.get(key);
    if (cached) {
      res.writeHead(200, {
        'content-type': 'audio/wav',
        'content-length': cached.length,
        'x-narration-cache': 'hit',
        'x-narration-duration': String(estimateDuration(text) / speed),
        'cache-control': 'private, max-age=86400',
      });
      return res.end(cached);
    }
    const started = Date.now();
    const wav = await synthesize(text, { speed });
    await ttsCache.set(key, wav, { engine, voice: voiceId || 'system' });
    res.writeHead(200, {
      'content-type': 'audio/wav',
      'content-length': wav.length,
      'x-narration-cache': 'miss',
      'x-narration-ms': String(Date.now() - started),
      'cache-control': 'private, max-age=86400',
    });
    return res.end(wav);
  }
  return json(res, 404, { error: 'unknown API', path: p });
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') { res.writeHead(302, { location: '/portal/read-with-you.html' }); return res.end(); }
  if (pathname === '/read-with-you') { res.writeHead(302, { location: '/portal/read-with-you.html' }); return res.end(); }
  for (const [prefix, base] of STATIC_ROOTS) {
    if (!pathname.startsWith(prefix)) continue;
    const rel = normalize(pathname.slice(prefix.length));
    const file = resolve(base, rel);
    if (!file.startsWith(base + sep) && file !== base) return json(res, 403, { error: 'forbidden' });
    return streamFile(req, res, file);
  }
  return json(res, 404, { error: 'not found' });
}

async function streamFile(req, res, file) {
  let info;
  try { info = await stat(file); } catch { return json(res, 404, { error: 'not found' }); }
  if (!info.isFile()) return json(res, 404, { error: 'not found' });
  const etag = `W/"${info.size}-${Math.floor(info.mtimeMs)}"`;
  if (req.headers['if-none-match'] === etag) { res.writeHead(304); return res.end(); }
  const headers = {
    'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': info.size,
    'etag': etag,
    'cache-control': file.includes(`${sep}vendor${sep}`) ? 'public, max-age=86400' : 'no-cache',
    'x-content-type-options': 'nosniff',
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await api(req, res, url);
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url);
    return json(res, 405, { error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: String(err?.message || err) });
    else res.end();
  }
});

await loadState();
await ttsCache.init();

if (process.argv.includes('--self-check')) {
  const status = await ttsStatus();
  if (status.available) {
    const wav = await synthesize('读书是一种安静的陪伴。');
    console.log(JSON.stringify({ ok: wav.length > 1000, narration: status, bytes: wav.length }));
    ttsBridge().child.stdin.write(JSON.stringify({ op: 'exit' }) + '\n');
  } else {
    console.log(JSON.stringify({ ok: true, narration: status }));
  }
  process.exit(0);
}

server.listen(port, host, () => {
  console.log(`陪你读书 ready: http://${host}:${port}/  (data: ${dataDir})`);
});
process.on('SIGTERM', () => { server.close(); bridge?.child.stdin.end(); });
process.on('SIGINT', () => { server.close(); bridge?.child.stdin.end(); });
