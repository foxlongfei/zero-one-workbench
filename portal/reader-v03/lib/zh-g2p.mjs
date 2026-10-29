// Mandarin G2P for Kokoro-82M-v1.1-zh.
//
// v1.1 uses a Zhuyin/pinyin token set (ㄅㄆㄇ… plus a few Chinese characters),
// not the IPA token set used by v1.0. This module follows the official
// misaki[zh] 1.1 frontend closely: pinyin-pro gives syllables, a small tone
// sandhi pass fixes third-tone runs, and every initial/final is mapped to the
// model's token alphabet. It runs locally and deterministically.

import { pinyin } from '../vendor/pinyin-pro/index.mjs';

const INITIAL_MAP = {
  b: 'ㄅ', p: 'ㄆ', m: 'ㄇ', f: 'ㄈ', d: 'ㄉ', t: 'ㄊ', n: 'ㄋ', l: 'ㄌ',
  g: 'ㄍ', k: 'ㄎ', h: 'ㄏ', j: 'ㄐ', q: 'ㄑ', x: 'ㄒ', zh: 'ㄓ', ch: 'ㄔ',
  sh: 'ㄕ', r: 'ㄖ', z: 'ㄗ', c: 'ㄘ', s: 'ㄙ',
};

const FINAL_MAP = {
  a: 'ㄚ', o: 'ㄛ', e: 'ㄜ', ie: 'ㄝ', ai: 'ㄞ', ei: 'ㄟ', ao: 'ㄠ', ou: 'ㄡ',
  an: 'ㄢ', en: 'ㄣ', ang: 'ㄤ', eng: 'ㄥ', er: 'ㄦ', i: 'ㄧ', u: 'ㄨ', v: 'ㄩ',
  ii: 'ㄭ', iii: '十', ve: '月', ia: '压', ian: '言', iang: '阳', iao: '要',
  in: '阴', ing: '应', iong: '用', iou: '又', ong: '中', ua: '穵', uai: '外',
  uan: '万', uang: '王', uei: '为', uen: '文', ueng: '瓮', uo: '我',
  van: '元', vn: '云',
};

const ZERO_Y = {
  i: 'i', a: 'ia', e: 'ie', ao: 'iao', ou: 'iou', an: 'ian', in: 'in',
  ang: 'iang', ing: 'ing', ong: 'iong', u: 'v', ue: 've', uan: 'van', un: 'vn',
};

const ZERO_W = {
  u: 'u', a: 'ua', o: 'uo', ai: 'uai', ei: 'uei', an: 'uan', en: 'uen',
  ang: 'uang', eng: 'ueng',
};

const JQX = { u: 'v', ue: 've', uan: 'van', un: 'vn' };
const ABBREVIATED = { iu: 'iou', ui: 'uei', un: 'uen' };

const PUNCTUATION = {
  '，': ',', '。': '.', '！': '!', '？': '?', '：': ':', '；': ';', '、': ',',
  '（': '(', '）': ')', '「': '“', '」': '”', '《': '“', '》': '”',
  '【': '“', '】': '”', '—': '—', '…': '…',
};

const DIGITS = { 0: '零', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };

const normalizeSyllable = ({ initial = '', final = '', num = 1 }) => {
  let onset = initial;
  let coda = String(final).replace(/[0-9]$/, '').replace(/ü/g, 'v');
  if (onset === 'y') {
    onset = '';
    coda = ZERO_Y[coda] || coda;
  } else if (onset === 'w') {
    onset = '';
    coda = ZERO_W[coda] || coda;
  } else if (JQX[coda] && ['j', 'q', 'x'].includes(onset)) {
    coda = JQX[coda];
  }
  if (coda === 'i') {
    if (['z', 'c', 's'].includes(onset)) coda = 'ii';
    else if (['zh', 'ch', 'sh', 'r'].includes(onset)) coda = 'iii';
  }
  if (ABBREVIATED[coda]) coda = ABBREVIATED[coda];
  return {
    onset: INITIAL_MAP[onset] || '',
    coda: FINAL_MAP[coda] || '',
    tone: String(Number(num) === 0 ? 5 : Number(num) || 5),
  };
};

const normalizeText = text => String(text ?? '')
  .replace(/[0-9]/g, digit => DIGITS[digit] || digit)
  .replace(/[，。！？：；、（）「」《》【】—…]/g, mark => ` ${PUNCTUATION[mark] || mark} `)
  .replace(/\s+/g, ' ')
  .trim();

const syllablesFor = word => pinyin(word, { toneType: 'num', type: 'all' })
  .filter(item => item.isZh && item.final)
  .map(normalizeSyllable);

const thirdToneSandhi = syllables => {
  for (let i = 0; i < syllables.length - 1; i++) {
    if (syllables[i].tone === '3' && syllables[i + 1].tone === '3') syllables[i].tone = '2';
  }
  return syllables;
};

const spokenWord = word => {
  const syllables = thirdToneSandhi(syllablesFor(word));
  return syllables.map(syllable => `${syllable.onset}${syllable.coda}${syllable.tone}`).join('');
};

export const chineseToBopomofo = text => {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter('zh', { granularity: 'word' })
    : null;
  if (!segmenter) return spokenWord(normalized);
  const parts = [];
  for (const segment of segmenter.segment(normalized)) {
    const value = segment.segment;
    if (!value) continue;
    if (/[\u3400-\u9fff]/.test(value)) {
      const spoken = spokenWord(value);
      if (spoken) parts.push(spoken);
    } else if (/[A-Za-z]/.test(value)) {
      parts.push(value.toLowerCase());
    } else if (value.trim()) {
      parts.push(value.trim());
    }
  }
  return parts.join(' ');
};
