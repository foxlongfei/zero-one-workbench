// 读伴 (the reading companion): local, deterministic helpers for notes,
// highlights and the "看见与讨论" panel. There is no cloud AI here on purpose —
// the companion shows the reader what they just heard and asks questions that
// help a family talk about the book together.

import { getAllByIndex } from './state.js';
import { splitSentences, isCjk } from './tts.js';

export const NOTE_KINDS = ['想法', '想记住', '想讨论'];

export function excerptAround(text, needle, radius = 120) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const index = needle ? clean.indexOf(needle.slice(0, 30)) : -1;
  if (index < 0) return clean.slice(0, radius * 2);
  const start = Math.max(0, index - radius);
  const end = Math.min(clean.length, index + needle.length + radius);
  return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`;
}

const QUESTION_TEMPLATES = [
  (subject) => `这句话里，${subject}最在意的好像不是自己的事。你觉得呢？`,
  (subject) => `如果换成是你，会像${subject}那样说出口吗？为什么？`,
  () => '这里有一句停顿很久的话。你读到这里时，心里响起了什么？',
  () => '这一小段里，哪个词让你停了一下？可以念给家里的人听。',
  () => '如果只能把这一段讲给一个人听，你会讲给谁？',
  () => '作者没有写出来的那一半，你猜是什么？',
];

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 100003;
  return hash;
}

/** Guess who a sentence is about, without any model: reuse a repeated name. */
export function subjectOf(paragraph) {
  const names = paragraph.match(/[\u4e00-\u9fa5]{2,3}/g) || [];
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
  const stop = new Set(['什么', '一个', '自己', '我们', '他们', '你们', '这个', '那个', '时候', '已经', '没有', '因为', '所以', '可是', '如果', '就是', '感觉', '觉得']);
  const repeated = [...counts.entries()].filter(([name, count]) => count > 1 && !stop.has(name)).sort((a, b) => b[1] - a[1]);
  return repeated[0]?.[0] || '';
}

export function discussionPrompts(sentence, { picked = null } = {}) {
  if (!sentence) return [];
  const subject = subjectOf(sentence);
  const chips = ['留意人物', '换位想想', '词语的温度', '讲给家人听', '留白'];
  const seed = hashText(sentence);
  const pickedPrompt = picked == null ? null : QUESTION_TEMPLATES[picked % QUESTION_TEMPLATES.length];
  const main = (pickedPrompt || QUESTION_TEMPLATES[seed % QUESTION_TEMPLATES.length])(subject || '这个人');
  const second = QUESTION_TEMPLATES[(seed + 3) % QUESTION_TEMPLATES.length](subject || '这个人');
  return [
    { id: 0, chip: chips[seed % chips.length], text: main },
    { id: 1, chip: chips[(seed + 2) % chips.length], text: second },
  ];
}

/** Split the sentence into readable "lines" for slow, family-style reading. */
export function gentleLines(sentence, { max = 26 } = {}) {
  const parts = splitSentences(sentence, { max: 999 });
  const lines = [];
  for (const part of parts) {
    if (part.length <= max) {
      lines.push(part);
      continue;
    }
    const pieces = part.split(/(?<=[，、；：,;:])/);
    let buffer = '';
    for (const piece of pieces) {
      if (buffer && (buffer + piece).length > max) {
        lines.push(buffer);
        buffer = '';
      }
      buffer += piece;
    }
    if (buffer) lines.push(buffer);
  }
  return lines.map((line) => line.trim()).filter(Boolean);
}

export function highlightTerms(sentence, limit = 3) {
  if (!sentence) return [];
  const stop = new Set(['一个', '自己', '没有', '什么', '这个', '那个', '我们', '他们', '因为', '所以', '已经', '还是', '可以', '时候', '这样', '那样', '不是', '就是', '但是', '如果']);
  const terms = new Map();
  if (isCjk(sentence)) {
    for (let size = 2; size <= 3; size++) {
      for (let i = 0; i + size <= sentence.length; i++) {
        const chunk = sentence.slice(i, i + size);
        if (!/^[\u4e00-\u9fa5]+$/.test(chunk) || stop.has(chunk)) continue;
        terms.set(chunk, (terms.get(chunk) || 0) + 1);
      }
    }
  } else {
    for (const word of sentence.match(/[A-Za-z]{4,}/g) || []) terms.set(word.toLowerCase(), (terms.get(word.toLowerCase()) || 0) + 1);
  }
  const ranked = [...terms.entries()].filter(([, count]) => count > 1 || isCjk(sentence)).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  const picked = [];
  for (const [term] of ranked) {
    if (picked.some((other) => other.includes(term) || term.includes(other))) continue;
    picked.push(term);
    if (picked.length >= limit) break;
  }
  return picked;
}

export async function notesFor(bookId) {
  const rows = await getAllByIndex('notes', 'bookId', bookId);
  return rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
