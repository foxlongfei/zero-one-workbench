// Speech rhythm: turning a paragraph of book text into utterances a voice can
// say naturally. Pure functions, shared by the reader core and the tests.
//
// Reading aloud is not concatenation. A book paragraph carries page furniture
// (page numbers, running heads, footnote markers, soft hyphens) and markup
// leftovers that must never be spoken; sentences need to arrive whole; and a
// voice that is handed one enormous string both stutters and makes pause
// unusable. chunkForSpeech cleans, then packs whole sentences up to a budget.

// A line that is only a page number or a bracketed footnote marker is furniture
// from the printed page, not part of the story.
const PAGE_FURNITURE = /^(?:[-–—]?\s*\d{1,4}\s*[-–—]?|\[\d{1,3}\]|［\d{1,3}］)$/u;

const TRAILING_BRACKET = /[（(［\[]\s*(?:注|译|编者注|图片来源)[^）)］\]]*[）)］\]]/gu;

export const isPageArtefact = line => {
  const text = String(line ?? '').trim();
  return Boolean(text) && PAGE_FURNITURE.test(text);
};

// Clean one paragraph for speech without changing what the listener hears:
// visible characters stay, invisible furniture goes.
export function cleanForSpeech(text) {
  return String(text ?? '')
    .replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g, '')
    .replace(/<[^>\n]{1,40}>/g, '')
    .replace(TRAILING_BRACKET, '')
    .replace(/[ \t\u3000]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !isPageArtefact(line))
    .join(' ')
    .trim();
}

// Characters that actually reach the ear. Punctuation is silent, so counting
// it would inflate listening statistics and "characters per minute".
export const spokenLength = text => String(text ?? '').replace(/[\s\p{P}\p{S}]/gu, '').length;

const SENTENCE_END = /[。！？!?…；;」』”’"'）)]/u;
const EN_SENTENCE_END = /[.!?](?=\s+["'“”‘’(（]?[A-Z0-9\u4e00-\u9fff])/u;

// Split into sentences, never losing text. Splitting happens *after* the
// terminator (plus any closing quotes/brackets) so a chunk always ends on a
// boundary the listener recognises as the end of a sentence.
export function sentenceUnits(text) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!flat) return [];
  const units = [];
  let start = 0;
  let index = 0;
  while (index < flat.length) {
    const char = flat[index];
    const isCjkEnd = SENTENCE_END.test(char);
    const isAsciiEnd = char === '.' || char === '!' || char === '?' || char === ';';
    if (isCjkEnd || (isAsciiEnd && EN_SENTENCE_END.test(flat.slice(index, index + 3)))) {
      let end = index + 1;
      while (end < flat.length && /[。！？!?…；;」』”’"'）)、，,]/u.test(flat[end])) end += 1;
      const piece = flat.slice(start, end).trim();
      if (piece) units.push(piece);
      start = end;
      index = end;
      continue;
    }
    index += 1;
  }
  const tail = flat.slice(start).trim();
  if (tail) units.push(tail);
  return units;
}

const COMMA_MARKS = ['，', ',', '、', '；', ';', '：', ':'];

const cutAtComma = (sentence, maxChars, minChars) => {
  const pieces = [];
  let rest = sentence;
  while (rest.length > maxChars) {
    // First choice: the last comma inside the budget, so the piece ends on a
    // natural breath. If the sentence has no comma that early but does have one
    // later, cut at the next comma after the budget rather than mid-word. Only
    // text with no comma at all falls back to a hard cut, so every piece makes
    // progress and nothing is ever lost.
    let cut = -1;
    for (const mark of COMMA_MARKS) cut = Math.max(cut, rest.lastIndexOf(mark, maxChars - 1));
    if (cut < Math.min(minChars, maxChars - 1)) {
      let next = -1;
      for (const mark of COMMA_MARKS) {
        const at = rest.indexOf(mark, maxChars);
        if (at !== -1 && (next === -1 || at < next)) next = at;
      }
      cut = next;
    }
    const at = cut >= 0 ? cut + 1 : maxChars;
    const piece = rest.slice(0, at).trim();
    if (piece) pieces.push(piece);
    rest = rest.slice(at);
  }
  if (rest.trim()) pieces.push(rest.trim());
  return pieces;
};

// Pack whole sentences into utterances of at most `maxChars`, remembering the
// natural gap *between* sentences so the narrator can breathe there.
export function chunkForSpeech(text, { maxChars = 220, minChars = 40 } = {}) {
  const clean = cleanForSpeech(text);
  if (!clean) return [];
  const units = sentenceUnits(clean);
  if (!units.length) return [];
  const chunks = [];
  let buffer = '';
  for (const unit of units) {
    if (unit.length > maxChars) {
      if (buffer) { chunks.push(buffer); buffer = ''; }
      chunks.push(...cutAtComma(unit, maxChars, minChars));
      continue;
    }
    if (buffer && buffer.length + unit.length > maxChars) {
      chunks.push(buffer);
      buffer = '';
    }
    buffer = buffer ? `${buffer}${/[，,、；;：:]$/u.test(buffer) ? '' : ' '}${unit}` : unit;
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

export const sentenceCount = text => sentenceUnits(cleanForSpeech(text)).length;
