// Tests for the speech-rhythm layer: cleaning page furniture, keeping sentences
// whole, and the pauses that make cross-chapter listening feel like reading.

import test from 'node:test';
import assert from 'node:assert/strict';

import { chunkForSpeech, cleanForSpeech, isPageArtefact, sentenceUnits, spokenLength } from '../../portal/reader-v03/lib/reading-rhythm.mjs';
import { PACING, chapterAnnouncement, pacingOf, pauseBefore } from '../../portal/reader-v03/lib/chapter-flow.mjs';

test('page furniture and invisible characters never reach the voice', () => {
  assert.ok(isPageArtefact('42'));
  assert.ok(isPageArtefact('［12］'));
  assert.ok(!isPageArtefact('他在第 42 页做了标记。'), 'a number inside a sentence is content');
  assert.equal(cleanForSpeech('月光\u00AD照在\t窗台上。\n17\n他睡着了。'), '月光照在 窗台上。 他睡着了。');
  assert.equal(cleanForSpeech('原文<b>粗体</b>结束。（编者注：此处略有删节）'), '原文粗体结束。');
});

test('sentences are split only after a terminator, keeping closing quotes', () => {
  assert.deepEqual(sentenceUnits('他说：“走吧。”她没有回答。真的？'), ['他说：“走吧。”', '她没有回答。', '真的？']);
  assert.deepEqual(sentenceUnits('Hello there. Fine.'), ['Hello there.', 'Fine.']);
  assert.deepEqual(sentenceUnits('   '), []);
});

test('chunks preserve every spoken character and respect the budget', () => {
  const text = '第一句。第二句话稍微长一点，但仍在同一句里！第三句？';
  const chunks = chunkForSpeech(text, { maxChars: 12 });
  assert.ok(chunks.length >= 3);
  for (const chunk of chunks) assert.ok(chunk.length <= 12, chunk);
  assert.equal(chunks.join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
});

test('an over-long sentence is cut at commas, never mid-word', () => {
  const long = `${'很长的从句，'.repeat(30)}结束。`;
  const chunks = chunkForSpeech(long, { maxChars: 40 });
  assert.ok(chunks.length > 3);
  // Pieces may overshoot slightly to reach the next comma rather than break a
  // word, but they must never run away and must end on punctuation.
  assert.ok(chunks.every(chunk => chunk.length <= 60), chunks.map(c => c.length).join(','));
  assert.ok(chunks.every(chunk => /[，。]$/u.test(chunk)), chunks.at(-1));
  assert.equal(chunks.join(''), long);
});

test('text with no punctuation at all is still split, never dropped', () => {
  const run = '无标点'.repeat(400);
  const chunks = chunkForSpeech(run, { maxChars: 50 });
  assert.ok(chunks.length >= 8);
  assert.ok(chunks.every(chunk => chunk.length <= 50));
  assert.equal(chunks.join(''), run);
});

test('spokenLength counts audible characters only', () => {
  assert.equal(spokenLength('你好，世界！'), 4);
  assert.equal(spokenLength('Hello, world.'), 10);
  assert.equal(spokenLength(''), 0);
});

test('headings are announced once and too-long headings are skipped', () => {
  assert.equal(chapterAnnouncement({ title: '第一章 起点' }), '第一章 起点');
  assert.equal(chapterAnnouncement({ title: '  ' }), '');
  assert.equal(chapterAnnouncement({ title: '很长的标题'.repeat(20) }), '');
  assert.equal(chapterAnnouncement({ title: '第一章' }, { spokenTitles: false }), '');
});

test('pacing presets get longer from compact to gentle', () => {
  const order = ['compact', 'natural', 'gentle'];
  for (let i = 1; i < order.length; i++) {
    assert.ok(PACING[order[i]].chapterPauseMs > PACING[order[i - 1]].chapterPauseMs);
    assert.ok(PACING[order[i]].settleMs >= PACING[order[i - 1]].settleMs);
  }
  assert.equal(pacingOf('unknown'), PACING.natural);
  assert.equal(pauseBefore({ paragraph: 0 }, { chapterPauseMs: 500, paragraphPauseMs: 90 }), 500);
  assert.equal(pauseBefore({ paragraph: 3 }, { chapterPauseMs: 500, paragraphPauseMs: 90 }), 90);
});
