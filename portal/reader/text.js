// 陪你读书 · 文字处理与笔记工具（纯函数，可在 Node 中测试）

// TXT 分章：识别「第X章/节/回/卷」与「Chapter N」等常见标题。
export function splitTxtChapters(text) {
  const clean = String(text || '').replace(/\r\n?/g, '\n');
  if (!clean.trim()) return [];
  const lines = clean.split('\n');
  // 中文标题后通常直接接空格或正文，不存在 \b 词边界，因此不给中文分支加 \b。
  const heading = /^\s*(?:第[零一二三四五六七八九十百千万0-9]+[章节回卷部篇]|Chapter\s+[0-9IVXL]+\b|序章|楔子|前言|后记|尾声)/i;
  const chapters = [];
  let current = null;
  for (const line of lines) {
    if (heading.test(line) && line.trim().length <= 40) {
      current = { title: line.trim(), lines: [] };
      chapters.push(current);
    } else {
      if (!current) { current = { title: '开篇', lines: [] }; chapters.push(current); }
      current.lines.push(line);
    }
  }
  return chapters
    .map(c => ({ title: c.title, text: c.lines.join('\n').trim() }))
    .filter(c => c.text || c.title !== '开篇');
}

export function txtParagraphs(chapterText) {
  return String(chapterText || '')
    .split(/\n\s*\n|\n/)
    .map(p => p.trim())
    .filter(Boolean);
}

export function htmlToParagraphs(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,style,nav,svg').forEach(n => n.remove());
  const blocks = [];
  doc.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,pre,td').forEach(el => {
    const t = el.textContent.replace(/\s+/g, ' ').trim();
    if (t) blocks.push(t);
  });
  if (!blocks.length) {
    const t = doc.body?.textContent?.replace(/\s+/g, ' ').trim();
    if (t) blocks.push(t);
  }
  return blocks;
}

export function normalizeSelection(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 4000);
}

export function makeNote({ bookId, text, quote = '', chapter = '', cfi = '', sentIndex = 0, tags = [] }) {
  const now = Date.now();
  return {
    id: 'note-' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)),
    bookId,
    text: String(text || '').trim(),
    quote: normalizeSelection(quote),
    chapter: String(chapter || ''),
    cfi: String(cfi || ''),
    sentIndex: Number(sentIndex) || 0,
    tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
    createdAt: now,
    updatedAt: now,
  };
}

const CJK = /[\u4e00-\u9fff]/;

function bigrams(w) {
  const out = [];
  for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2));
  return out;
}

// 一个词在一条字段里怎么算命中：先原样；没命中时对三字以上的中文词按「相邻双字」退一步，
// 用来兜住「童年的窗户」搜「小时候的窗户」这类记串了的查询。
// 只要片段原样出现就算——放宽到「双字后面接汉字」也命中，才能让真实笔记里的
// 「窗户外很亮」被「窗户外」找到；更细的词边界判断交给分词库，这里不自己造规则。
function wordInField(field, word) {
  if (field.includes(word)) return true;
  if (!CJK.test(word) || word.length < 3) return false;
  return bigrams(word).some(piece => field.includes(piece));
}

function wordAnywhere(fields, word) {
  if (!word) return true;
  return fields.some(v => wordInField(v, word));
}

// 笔记搜索：用户只记得几个词，所以按空格分词，每个词都要出现，顺序随意、可以跨字段
// （一个词在标签里、一个词在正文里也算命中）。
export function noteMatches(note, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return true;
  const fields = [note?.text, note?.quote, note?.chapter, ...(Array.isArray(note?.tags) ? note.tags : [])]
    .map(v => String(v || '').toLowerCase());
  if (fields.some(v => v.includes(q))) return true;
  return q.split(/\s+/).filter(Boolean).every(w => wordAnywhere(fields, w));
}

export function highlightSentence(sentences, index) {
  return (Array.isArray(sentences) ? sentences : []).map((s, i) => ({ ...s, active: i === index }));
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} 小时 ${m} 分`;
  if (m) return `${m} 分钟`;
  return `${s} 秒`;
}
