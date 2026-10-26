// Text normalisation for spoken output.
//
// Books are written to be *read*, not to be *spoken*: page numbers, running
// headers, footnote markers, markdown emphasis, repeated whitespace and
// punctuation runs all survive into the extracted paragraph and make a TTS
// engine stumble. Cleaning them here keeps the on-screen text untouched while
// the voice hears something natural.
//
// Pure functions only (no DOM), so the Node tests can import this directly.

const isCjk = ch => Boolean(ch) && /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(ch);

// A paragraph that is only a page number / running head is skipped entirely.
const PAGE_ARTEFACT = /^(?:[-—–\s]*\d{1,4}[-—–\s]*|第\s*\d+\s*页\s*(?:\/共\s*\d+\s*页)?|Page\s+\d+(?:\s+of\s+\d+)?)$/i;
const FOOTNOTE_MARKER = /\[\^?\d{1,3}\]|(?<=[\u3400-\u9fff])\{\d{1,3}\}/g;
// Markdown / light-rich-text leftovers that should never be spoken.
const MARKUP = [
  [/\*\*(.+?)\*\*/g, '$1'],
  [/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '$1'],
  [/`([^`]+)`/g, '$1'],
  [/<[^>]{1,200}>/g, ''],
  [/&nbsp;/g, ' '],
  [/&amp;/g, '&'],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
];

export function cleanForSpeech(text) {
  let value = String(text ?? '').replace(/[\u00AD\u200B\u200C\u200D\uFEFF]/g, '');
  for (const [pattern, replacement] of MARKUP) value = value.replace(pattern, replacement);
  value = value.replace(FOOTNOTE_MARKER, '');
  // Dashes used as an em-dash pause read better as a comma in Chinese text.
  value = value.replace(/([\u3400-\u9fff])\s*[—–-]{1,2}\s*([\u3400-\u9fff])/g, '$1，$2');
  // A space between two CJK characters is a layout artefact, not a word break.
  value = value.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1');
  // Punctuation runs: "……" is a real pause, everything else collapses.
  value = value.replace(/([。！？!?，,、；;：:])\1+/g, '$1');
  value = value.replace(/(?<!\.)\.{4,}(?!\.)/g, '……');
  value = value.replace(/\s+/g, ' ').trim();
  return value;
}

export const isPageArtefact = text => PAGE_ARTEFACT.test(String(text ?? '').trim());

// The "home" language of a book from its own text: count CJK vs Latin letters.
export function detectLanguage(text) {
  const sample = String(text ?? '').slice(0, 20000);
  let cjk = 0;
  let latin = 0;
  for (const ch of sample) {
    if (isCjk(ch)) cjk += 1;
    else if (/[A-Za-z]/.test(ch)) latin += 1;
  }
  if (cjk === 0 && latin === 0) return 'und';
  return cjk >= latin * 0.35 ? 'zh' : 'en';
}

// Split a paragraph into spoken sentences, then group them into chunks that fit
// a TTS request. CJK books have no spaces between sentences, so the boundary
// must be found on punctuation, including closing quotes after it; Latin text
// additionally breaks at ". " followed by a capital letter or digit.
export function sentenceUnits(text) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!flat) return [];
  const units = [];
  let buffer = '';
  const closers = '」』”’）)】》';
  const terminates = ch => '。！？!?；;…'.includes(ch);
  const latinBreak = (i, end) => {
    const ch = flat[i];
    if (ch !== '.') return 0;
    if (flat[i - 1] === '.' || flat[i + 1] === '.') return 0; // ellipsis / abbreviation dots
    const rest = flat.slice(i + 1, end);
    return /^ ["“'(（【\[]?[A-Z0-9]/.test(rest) ? 1 : 0;
  };
  for (let i = 0; i < flat.length; i++) {
    const ch = flat[i];
    buffer += ch;
    if (!terminates(ch) && !latinBreak(i, flat.length)) continue;
    // Swallow a run of terminators and trailing closing quotes/brackets.
    let j = i + 1;
    while (j < flat.length && (terminates(flat[j]) || closers.includes(flat[j]))) {
      buffer += flat[j];
      j += 1;
    }
    i = j - 1;
    if (buffer.trim()) units.push(buffer.trim());
    buffer = '';
  }
  if (buffer.trim()) units.push(buffer.trim());
  return units;
}

// Group sentences into chunks of at most `maxChars`, never splitting a sentence
// unless it alone is longer than the budget (then cut at a comma).
export function chunkForSpeech(text, { maxChars = 180, minChars = 48 } = {}) {
  const chunks = [];
  let buffer = '';
  const flush = () => {
    const value = buffer.trim();
    if (value) chunks.push(value);
    buffer = '';
  };
  for (const sentence of sentenceUnits(cleanForSpeech(text))) {
    if (sentence.length > maxChars) {
      flush();
      let rest = sentence;
      while (rest.length > maxChars) {
        const window = rest.slice(0, maxChars);
        const cut = Math.max(window.lastIndexOf('，'), window.lastIndexOf(','), window.lastIndexOf('、'));
        const at = cut > minChars ? cut + 1 : maxChars;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      if (rest) buffer = rest;
      continue;
    }
    if (buffer && buffer.length + sentence.length > maxChars) flush();
    buffer = buffer ? `${buffer}${isCjk(buffer.at(-1)) ? '' : ' '}${sentence}` : sentence;
  }
  flush();
  return chunks;
}

export const spokenLength = text => cleanForSpeech(text).replace(/\s+/g, '').length;
