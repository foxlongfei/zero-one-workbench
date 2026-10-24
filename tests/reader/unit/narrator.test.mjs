// 播放队列与跨章节衔接的单元测试：node --test tests/reader/unit
import test from 'node:test';
import assert from 'node:assert/strict';
import { Narrator, splitSentences, sliceParagraphs, estimateMinutes, isBodyText } from '../../../portal/reader/narrator.js';

test('splitSentences 按中文句末标点切句', () => {
  const sentence = splitSentences('第一句。第二句！第三句？');
  assert.deepEqual(sentence, ['第一句。', '第二句！', '第三句？']);
});

test('splitSentences 合并极短残片，避免逐字朗读', () => {
  // 「好。」不足 minLen，会并入前一句；这是有意的韵律处理
  assert.deepEqual(splitSentences('我们继续读下去。好。'), ['我们继续读下去。好。']);
  // 分号在中文里是句边界
  assert.deepEqual(splitSentences('风起了；房间安静下来。'), ['风起了；', '房间安静下来。']);
});

test('splitSentences 跳过空白段落', () => {
  assert.deepEqual([...splitSentences('   ')].length, 0);
});

test('sliceParagraphs 保留段落索引，供正文高亮定位', () => {
  const sentences = sliceParagraphs(['风从窗外吹来。我们在书页里寻找。', '第二段。']);
  assert.ok(sentences.length >= 3);
  assert.equal(sentences[0].paragraphIndex, 0);
  assert.equal(sentences[sentences.length - 1].paragraphIndex, 1);
});

test('estimateMinutes 至少返回 1 分钟，0 字返回 0', () => {
  assert.equal(estimateMinutes(0), 0);
  assert.equal(estimateMinutes(10), 1);
  assert.ok(estimateMinutes(2600) >= 9);
});

test('isBodyText 区分目录页与正文', () => {
  assert.equal(isBodyText(['第一章 清晨', '第二章 小路']), true);
  assert.equal(isBodyText(['', '   ']), false);
  assert.equal(isBodyText([]), false);
});

test('Narrator 顺序播完并派发 ended', async () => {
  const spoken = [];
  const n = new Narrator({
    speak(sentence, done) { spoken.push(sentence.text); queueMicrotask(done); },
    cancel() {},
  });
  const events = [];
  n.addEventListener('ended', () => events.push('ended'));
  n.load([{ text: 'a' }, { text: 'b' }]);
  await n.play();
  assert.deepEqual(spoken, ['a', 'b']);
  assert.equal(n.state, 'ended');
  assert.deepEqual(events, ['ended']);
});

test('Narrator.pause 状态可暂停并继续到下一句', async () => {
  let pending = null;
  let spokenCount = 0;
  const n = new Narrator({
    speak(_s, done) { pending = done; spokenCount++; },
    cancel() {},
    pause() {},
    resume() {},
  });
  n.load([{ text: 'a' }, { text: 'b' }]);
  n.play();
  await Promise.resolve();
  assert.equal(n.state, 'speaking');
  n.pause();
  assert.equal(n.state, 'paused');
  n.resume();
  assert.equal(n.state, 'speaking');
  pending();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(n.index, 1);
  n.stop();
  assert.equal(n.state, 'idle');
});

test('Narrator.seek 取消旧句子并从新位置继续', async () => {
  const calls = [];
  let cancels = 0;
  const n = new Narrator({
    speak(sentence, done) { calls.push(sentence.text); if (sentence.text !== 'a') queueMicrotask(done); },
    cancel() { cancels++; },
  });
  n.load([{ text: 'a' }, { text: 'b' }, { text: 'c' }]);
  n.play();
  await Promise.resolve();
  assert.deepEqual(calls, ['a']);
  n.seek(2);
  await new Promise(r => setTimeout(r, 10));
  assert.ok(cancels >= 1);
  assert.ok(calls.includes('c'));
  assert.equal(n.state, 'ended');
});

test('Narrator.load 派发 load 事件，供页面使旧回调失效', () => {
  const n = new Narrator({ speak() {}, cancel() {} });
  let detail = null;
  n.addEventListener('load', e => { detail = e.detail; });
  n.load([{ text: 'a' }, { text: 'b' }], 1);
  assert.deepEqual(detail, { length: 2, startIndex: 1 });
  assert.equal(n.index, 1);
});

test('Narrator 朗读失败时上报 error 并回到 idle', async () => {
  const n = new Narrator({
    speak(_s, _done, fail) { fail(new Error('not-allowed')); },
    cancel() {},
  });
  let error = null;
  n.addEventListener('error', e => { error = e.detail.error; });
  n.load([{ text: 'a' }]);
  n.play();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(error?.message, 'not-allowed');
  assert.equal(n.state, 'idle');
});

test('Narrator.play 在空队列时保持 idle', async () => {
  const n = new Narrator({ speak() { throw new Error('should not speak'); }, cancel() {} });
  await n.play();
  assert.equal(n.state, 'idle');
});
