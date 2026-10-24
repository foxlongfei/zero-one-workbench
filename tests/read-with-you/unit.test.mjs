import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitSentences, parsePlainText, ssmlSegments, estimateSeconds, voiceLanguageFor,
  preferredVoice, Narration, formatDuration, decodeEntities,
} from '../../portal/read-with-you/tts.js';

test('Chinese prose splits on 。！？ and keeps closing quotes', () => {
  const text = '风从窗外吹来。我们在书页里寻找新的问题！他说：“走吧。”然后离开了。';
  assert.deepEqual(splitSentences(text), [
    '风从窗外吹来。',
    '我们在书页里寻找新的问题！',
    '他说：“走吧。”',
    '然后离开了。',
  ]);
});

test('English abbreviations and decimals do not break sentences', () => {
  const text = 'Dr. Smith paid 3.5 dollars. He left. Then Mr. Jones arrived, and stayed.';
  assert.deepEqual(splitSentences(text), [
    'Dr. Smith paid 3.5 dollars.',
    'He left.',
    'Then Mr. Jones arrived, and stayed.',
  ]);
});

test('long paragraphs break at soft punctuation rather than mid-word', () => {
  const text = '这是一段很长的中文句子，'.repeat(20) + '结束。';
  const out = splitSentences(text, { max: 50 });
  assert.ok(out.length > 3);
  for (const sentence of out) assert.ok(sentence.length <= 90, `too long: ${sentence.length}`);
  assert.ok(out.join('').includes('结束'));
});

test('English text without spaces after periods still separates', () => {
  const out = splitSentences('Hello world.This is second.Short.');
  assert.deepEqual(out, ['Hello world.', 'This is second.', 'Short.']);
});

test('newline-separated short dialogue is preserved as separate lines', () => {
  const out = splitSentences('“你好。”\n“再见。”');
  assert.deepEqual(out, ['“你好。”', '“再见。”']);
});

test('parsePlainText detects Chinese chapter headings', () => {
  const chapters = parsePlainText('前言内容\n第一章 出发\n今天很好。\n第二天也不错。\n第二章 归途\n结束了。');
  assert.equal(chapters.length, 3);
  assert.equal(chapters[1].title, '第一章 出发');
  assert.equal(chapters[0].title, '正文');
  assert.deepEqual(chapters[1].sentences, ['今天很好。', '第二天也不错。']);
});

test('parsePlainText falls back to a single body for books without headings', () => {
  const chapters = parsePlainText('一段没有章节的文字。第二句。');
  assert.equal(chapters.length, 1);
  assert.equal(chapters[0].sentences.length, 2);
});

test('ssmlSegments turns foliate marks into sentence chunks and offsets', () => {
  const ssml = '<speak><p><lang xml:lang="zh-CN">你好<mark name="0"/>世界。</lang><mark name="1"/>第二句。</p></speak>';
  const { segments, text, marks } = ssmlSegments(ssml);
  assert.equal(text, '你好世界。第二句。');
  assert.deepEqual(marks, [{ name: '0', offset: 2 }, { name: '1', offset: 5 }]);
  assert.equal(segments.length, 3);
  assert.equal(segments[0].tag, 'lang');
});

test('entities decode and estimate scales with rate', () => {
  assert.equal(decodeEntities('a&amp;b&#x4e2d;'), 'a&b中');
  const slow = estimateSeconds('这是一段中文文本。', 1);
  assert.ok(estimateSeconds('这是一段中文文本。', 2) < slow);
});

test('voiceLanguageFor handles Chinese variants and English', () => {
  assert.equal(voiceLanguageFor(['zh-Hant-TW']), 'zh-TW');
  assert.equal(voiceLanguageFor(['zh-CN']), 'zh-CN');
  assert.equal(voiceLanguageFor(['en']), 'en');
  assert.equal(voiceLanguageFor([]), 'zh-CN');
});

test('preferredVoice prefers a saved voice, then local zh voice', () => {
  const voices = [
    { name: 'Remote', lang: 'zh-CN', localService: false },
    { name: 'Microsoft Xiaoxiao', lang: 'zh-CN', localService: true },
    { name: 'English', lang: 'en-US', localService: true },
  ];
  assert.equal(preferredVoice(voices, 'zh-CN').name, 'Microsoft Xiaoxiao');
  assert.equal(preferredVoice(voices, 'zh-CN', 'Remote').name, 'Remote');
  assert.equal(preferredVoice(voices, 'fr-FR'), null);
});

test('Narration auto-advances, pauses, resumes, seeks and ends', () => {
  const spoken = [];
  let handlers;
  const engine = {
    speak(u, h) {
      spoken.push(u.text);
      handlers = h;
    },
    cancel() {},
  };
  const states = [];
  let ended = false;
  const narration = new Narration(engine, { onState: (state) => states.push(state), onEnd: () => { ended = true; } });
  narration.start([{ chapter: 0, chapterTitle: 'a', text: '第一句。第二句。第三句。' }]);
  assert.deepEqual(spoken, ['第一句。']);
  handlers.onEnd();
  assert.deepEqual(spoken, ['第一句。', '第二句。']);
  narration.pause();
  assert.equal(narration.state, 'paused');
  handlers.onEnd(); // a stale callback from the cancelled utterance must be ignored
  assert.equal(spoken.length, 2);
  narration.resume();
  assert.deepEqual(spoken.at(-1), '第二句。');
  narration.seekTo(2);
  assert.equal(spoken.at(-1), '第三句。');
  handlers.onEnd();
  assert.ok(ended);
  assert.equal(states.at(-1), 'ended');
});

test('Narration skips empty chunks and clamps seeks', () => {
  const spoken = [];
  let handler;
  const engine = { speak(u, h) { spoken.push(u.text); handler = h; }, cancel() {} };
  const narration = new Narration(engine);
  narration.start([{ text: '有内容。' }, { text: '   ' }, { text: '最后一句。' }]);
  assert.equal(spoken[0], '有内容。');
  narration.seekTo(99);
  assert.equal(spoken.at(-1), '最后一句。');
  narration.seekTo(0);
  handler.onEnd();
  assert.equal(spoken.at(-1), '最后一句。');
});

test('formatDuration renders minutes and hours', () => {
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(0), '0:00');
});
