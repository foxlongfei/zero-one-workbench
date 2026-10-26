// Unit tests for the V0.3 additions: reading rhythm, progress estimates, voice
// choice, follow-along paging, keyboard rules, portable books and accountless
// presence. Run with: node --test tests/reader-v03/

import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanForSpeech, detectLanguage, sentenceUnits, chunkForSpeech, spokenLength, isPageArtefact } from '../../portal/reader-v03/lib/reading-rhythm.mjs';
import { remainingMinutes, listeningProgress, formatMinutes, planSegments, BASE_CHARS_PER_MINUTE } from '../../portal/reader-v03/lib/progress.mjs';
import { chooseVoice, preferredEngine, rankVoices } from '../../portal/reader-v03/lib/voice-choice.mjs';
import { pageWindow, pageStart, needsScroll, scrollTarget, followClasses, sameWindow } from '../../portal/reader-v03/lib/follow.mjs';
import { chapterAnnouncement, pauseBefore, sleep } from '../../portal/reader-v03/lib/chapter-flow.mjs';
import { keyAction, isEditableTarget, stepRate, clampTextScale, stepTextScale, TEXT_SCALE_MAX, TEXT_SCALE_MIN, TEXT_SCALE_STEP } from '../../portal/reader-v03/lib/keys.mjs';
import { buildPortableBook, normalizePortableBook, portableToModel, initialsOf, coverHue, portableProgress, blocksFromDocument } from '../../portal/reader-v03/lib/portable.mjs';
import { listeningEstimate, finishDate, progressLine, agoLabel, yesterdayMinutes } from '../../portal/reader-v03/lib/library-insight.mjs';
import { sessionCode, formatCode, normalizeCode, mergeNotes, buildSyncBundle, readSyncBundle, adoptPositions, pickLaterPosition, readerColour, isRecentSession } from '../../portal/reader-v03/lib/together.mjs';

// ---------------------------------------------------------------------------
// reading rhythm
// ---------------------------------------------------------------------------
test('speech cleaning leaves on-screen text alone but reads it naturally', () => {
  assert.equal(cleanForSpeech('他说—好的。'), '他说，好的。');
  assert.equal(cleanForSpeech('**重点**和`代码`'), '重点和代码');
  assert.equal(cleanForSpeech('句子。\u200b\u00ad'), '句子。');
  assert.equal(cleanForSpeech('这是[^1]一个注释 1'), '这是一个注释 1');
  assert.equal(cleanForSpeech('中 文 之 间 有 空 格'), '中文之间有空格');
  // A paragraph that is only a page number is never spoken.
  assert.ok(isPageArtefact('- 12 -'));
  assert.ok(isPageArtefact('第 12 页'));
  assert.ok(!isPageArtefact('第十 二 章'));
});

test('sentences and chunks keep quotes and commas sensible', () => {
  assert.deepEqual(sentenceUnits('「走吧！」他说。然后停下'), ['「走吧！」', '他说。', '然后停下']);
  const chunks = chunkForSpeech('很短的一句。'.repeat(20), { maxChars: 40 });
  assert.ok(chunks.every(chunk => chunk.length <= 41), chunks.join('|'));
  assert.equal(spokenLength('a\u00a0b  c'), 3);
});

test('detects the book language from its own text', () => {
  assert.equal(detectLanguage('这是一本中文书，讲一个小院子的故事。'), 'zh');
  assert.equal(detectLanguage('This is an English book about a small garden.'), 'en');
  assert.equal(detectLanguage('12345 — !!!'), 'und');
  // A Chinese book with English words in it stays Chinese.
  assert.equal(detectLanguage('她说：“Let us read”，然后笑了。'), 'zh');
});

// ---------------------------------------------------------------------------
// progress
// ---------------------------------------------------------------------------
const book = {
  chapters: [
    { title: '一', paragraphs: ['第一段话。', '第二段话。'] },
    { title: '二', paragraphs: ['第三段话。'] },
  ],
};

test('listening time and progress follow spoken text', () => {
  const total = '第一段话。第二段话。第三段话。'.length;
  const minutes = remainingMinutes(book, { chapter: 0, paragraph: 0 }, { rate: 1 });
  assert.equal(minutes, Math.round(total / BASE_CHARS_PER_MINUTE));
  assert.ok(remainingMinutes(book, { chapter: 0, paragraph: 0 }, { rate: 2 }) < minutes + 1);
  assert.equal(listeningProgress(book, { chapter: 0, paragraph: 0 }), 0);
  // 10 of 15 spoken characters are behind a listener at chapter 2's start.
  assert.equal(Math.round(listeningProgress(book, { chapter: 1, paragraph: 0 }) * 100), 67);
  assert.equal(formatMinutes(0), '不到 1 分钟');
  assert.equal(formatMinutes(75), '1 小时 15 分');
});

test('audio segments cover the book in listening order', () => {
  const segments = planSegments(book);
  assert.equal(segments.length, 3);
  assert.deepEqual(segments.map(s => `${s.chapter}:${s.paragraph}`), ['0:0', '0:1', '1:0']);
});

// ---------------------------------------------------------------------------
// voice choice
// ---------------------------------------------------------------------------
test('a Chinese book prefers a Chinese voice and says so', () => {
  const voices = [
    { name: 'Daniel', lang: 'en-GB', voiceURI: 'en' },
    { name: 'Ting-Ting', lang: 'zh-CN', voiceURI: 'zh' },
  ];
  const choice = chooseVoice(voices, { bookLanguage: 'zh' });
  assert.equal(choice.voice.voiceURI, 'zh');
  assert.equal(choice.voided, false);
  const wrong = chooseVoice([{ name: 'Daniel', lang: 'en-GB', voiceURI: 'en' }], { bookLanguage: 'zh' });
  assert.equal(wrong.voided, true);
  assert.match(wrong.reason, /没有对应的语音/);
  assert.equal(chooseVoice([], { bookLanguage: 'zh' }).voice, null);
  const ranked = rankVoices(voices, { bookLanguage: 'zh', preferredURI: 'en' });
  assert.equal(ranked[0].voiceURI, 'en', 'an explicit choice wins');
  assert.equal(preferredEngine({ bookLanguage: 'zh', deviceVoice: { lang: 'en-US' } }), 'endpoint');
  assert.equal(preferredEngine({ bookLanguage: 'zh', deviceVoice: { lang: 'zh-CN' } }), 'browser');
});

// ---------------------------------------------------------------------------
// follow-along paging
// ---------------------------------------------------------------------------
test('follow-along paging keeps the spoken paragraph on screen', () => {
  const window = pageWindow(15, 40);
  assert.deepEqual(window, { start: 14, end: 28, page: 2, pages: 3 });
  assert.equal(pageStart(13), 0);
  assert.ok(sameWindow({ start: 0, end: 14 }, { start: 0, end: 14 }));
  assert.ok(!sameWindow({ start: 0, end: 14 }, { start: 14, end: 28 }));
  // Below the band → scroll; inside it → leave the page where the reader put it.
  assert.equal(needsScroll({ index: 3, top: 900, height: 40, scrollTop: 0, viewportHeight: 600 }), true);
  assert.equal(needsScroll({ index: 3, top: 200, height: 40, scrollTop: 0, viewportHeight: 600 }), false);
  assert.equal(scrollTarget({ top: 500, height: 40, viewportHeight: 600, scrollHeight: 2000 }), 220);
  assert.equal(scrollTarget({ top: 500, height: 40, viewportHeight: 600, scrollHeight: 600 }), 0);
  assert.match(followClasses(true), /rw-follow-active/);
});

// ---------------------------------------------------------------------------
// chapter flow
// ---------------------------------------------------------------------------
test('chapter lead-in announces once and pauses only at the start', async () => {
  assert.equal(chapterAnnouncement({ title: '第一章', paragraphs: ['正文。'] }), '第一章');
  assert.equal(chapterAnnouncement({ title: '第一章', paragraphs: ['第一章', '正文。'] }), '', 'no double title');
  assert.equal(chapterAnnouncement({ title: '', paragraphs: ['正文。'] }), '');
  assert.equal(pauseBefore({ paragraph: 0 }), 1400);
  assert.equal(pauseBefore({ paragraph: 3 }), 0);
  await sleep(0);
  const controller = new AbortController();
  const pending = sleep(5000, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
});

// ---------------------------------------------------------------------------
// keyboard and text size
// ---------------------------------------------------------------------------
test('keyboard shortcuts stay out of text fields', () => {
  // Target shapes are built in one place: a test-only DOM-free helper is
  // enough to pin every rule without dragging a browser into the unit suite.
  const body = { tagName: 'BODY' };
  const page = { tagName: 'DIV' };
  const note = { tagName: 'TEXTAREA' };
  const heading = { tagName: 'INPUT', type: 'text' };
  const slider = { tagName: 'INPUT', type: 'slider' };
  const bare = { tagName: 'INPUT' };
  assert.equal(keyAction({ code: 'Space', target: body }), 'toggle');
  assert.equal(keyAction({ code: 'ArrowRight', target: page }), 'nextPage');
  assert.equal(keyAction({ code: 'ArrowLeft', target: heading }), null);
  assert.equal(keyAction({ code: 'Space', target: note }), null);
  // A slider adjusts itself with the arrow keys; the reader must not page
  // under the reader's hand while they are setting the speaking rate.
  assert.equal(isEditableTarget(slider), false, 'a slider is not a text field');
  assert.equal(keyAction({ code: 'ArrowLeft', target: slider }), null, 'a slider keeps its arrows');
  assert.equal(keyAction({ code: 'KeyA', target: body }), null);
  assert.ok(isEditableTarget({ isContentEditable: true }));
  assert.ok(isEditableTarget(bare), 'an untyped input is a text field');
  assert.equal(stepRate(1, 1), 1.1);
  assert.equal(stepRate(1.1, -1), 1);
  assert.equal(stepRate(1.8, 1), 1.8);
  assert.equal(clampTextScale(99), TEXT_SCALE_MAX);
  assert.equal(clampTextScale(0), TEXT_SCALE_MIN);
  assert.equal(stepTextScale(1, 1).toFixed(2), '1.10');
  assert.equal(stepTextScale(clampTextScale(1), -1).toFixed(2), (1 - TEXT_SCALE_STEP).toFixed(2));
});

// ---------------------------------------------------------------------------
// portable books
// ---------------------------------------------------------------------------
test('portable books survive a round trip and reject junk', () => {
  const portable = buildPortableBook({
    title: '小院子', chapters: [{ title: '一', paragraphs: ['第一段。', ' '] }], coverText: '小院子',
  });
  assert.equal(portable.chapters[0].paragraphs.length, 1);
  assert.ok(portable.stats.chars > 0);
  const revived = normalizePortableBook(JSON.parse(JSON.stringify(portable)));
  assert.deepEqual(revived.chapters, portable.chapters);
  const model = portableToModel(revived);
  assert.equal(model.title, '小院子');
  assert.equal(Math.round(portableProgress(portable, { chapter: 0, paragraph: 0 }) * 100), 0);
  assert.equal(normalizePortableBook({ chapters: [] }), null);
  assert.equal(normalizePortableBook('not a book'), null);
  assert.equal(initialsOf('Quiet House'), 'QH');
  assert.equal(initialsOf('小院子'), '小院');
  assert.ok(coverHue('小院子') >= 0 && coverHue('小院子') < 360);
  assert.equal(coverHue('小院子'), coverHue('小院子'));
});

function fakeDocument(html) {
  // A tiny DOM stand-in: enough for the paragraph walker (text + block tags).
  const parse = source => {
    const node = { nodeType: 1, tagName: 'BODY', childNodes: [] };
    const stack = [node];
    const tokens = String(source).match(/<[^>]+>|[^<]+/g) ?? [];
    for (const token of tokens) {
      if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      if (token.startsWith('<')) {
        const tag = token.replace(/[</>]/g, '').split(/\s/)[0].toUpperCase();
        const element = { nodeType: 1, tagName: tag, childNodes: [], defaultView: null };
        stack.at(-1).childNodes.push(element);
        if (!/^(BR|HR|IMG)$/.test(tag)) stack.push(element);
        continue;
      }
      stack.at(-1).childNodes.push({ nodeType: 3, nodeValue: token });
    }
    return node;
  };
  return { body: parse(html), defaultView: null };
}

test('paragraphs are extracted from a live page, not from markup', () => {
  const doc = fakeDocument('<p>他<em>轻轻</em>说了一句很长的话。</p><p>12</p><h2 class="title">第二章</h2><p>第三段。</p><hr><p>最后。</p>');
  assert.deepEqual(blocksFromDocument(doc), ['他轻轻说了一句很长的话。', '第二章', '第三段。', '最后。']);
  assert.deepEqual(blocksFromDocument(null), []);
});

// ---------------------------------------------------------------------------
// library insight
// ---------------------------------------------------------------------------
test('listening estimates refuse to guess from no evidence', () => {
  assert.deepEqual(listeningEstimate({ chars: 0, elapsedMs: 0 }), { charsPerMinute: 0, reliable: false });
  assert.equal(listeningEstimate({ chars: 50, elapsedMs: 1000 }).reliable, false);
  const measured = listeningEstimate({ chars: 200, elapsedMs: 60000 });
  assert.deepEqual(measured, { charsPerMinute: 200, reliable: true });
  const finish = finishDate({ remainingMinutes: 120, minutesPerDay: 30 }, new Date('2026-10-24T08:00:00Z'));
  assert.equal(finish.days, 4);
  assert.match(finish.label, /4 天/);
  assert.equal(finishDate({ remainingMinutes: 0 }, new Date()).label, '已经听完了');
  assert.equal(finishDate({ remainingMinutes: 10, minutesPerDay: 0 }), null);
  const line = progressLine(book, { chapter: 0, paragraph: 0 });
  assert.equal(line.percentLabel, '0%');
  assert.match(line.label, /还剩|最后一段/);
  assert.equal(agoLabel(new Date().toISOString()), '今天');
  assert.equal(agoLabel(new Date(Date.now() - 86400000 * 3).toISOString()), '3 天前');
  assert.equal(yesterdayMinutes({ [new Date(Date.now() - 86400000).toISOString().slice(0, 10)]: 600000 }), 10);
});

// ---------------------------------------------------------------------------
// accountless presence (一起读)
// ---------------------------------------------------------------------------
test('device codes are stable, speakable and comparable', () => {
  const code = sessionCode('device-abc');
  assert.equal(code.length, 6);
  assert.equal(sessionCode('device-abc'), code);
  assert.notEqual(sessionCode('device-abd'), code);
  assert.ok(!/[IO01]/.test(code), code);
  assert.equal(formatCode(code), `${code.slice(0, 3)}-${code.slice(3)}`);
  assert.equal(normalizeCode('k7m-2qf'), 'K7M2QF');
  assert.ok(readerColour('妈妈').startsWith('hsl('));
  assert.notEqual(readerColour('妈妈'), readerColour('爸爸'));
  const now = Date.now();
  assert.ok(isRecentSession({ at: new Date(now - 60000).toISOString() }, now));
  assert.ok(!isRecentSession({ at: new Date(now - 7 * 3600000).toISOString() }, now));
  assert.ok(!isRecentSession({}, now));
});

test('notes from two devices merge without duplicates or lost edits', () => {
  const local = [
    { id: 'n1', bookId: 'b', text: '本机版本', createdAt: '2026-10-20T10:00:00Z', editedAt: '2026-10-21T10:00:00Z' },
    { id: 'n2', bookId: 'b', text: '只在本机', createdAt: '2026-10-19T10:00:00Z' },
  ];
  const remote = [
    { id: 'n1', bookId: 'b', text: '妈妈在平板改过', createdAt: '2026-10-20T10:00:00Z', editedAt: '2026-10-22T10:00:00Z' },
    { id: 'n3', bookId: 'b', text: '只在平板', createdAt: '2026-10-23T10:00:00Z' },
  ];
  const merged = mergeNotes(local, remote);
  assert.equal(merged.length, 3);
  assert.equal(merged.find(note => note.id === 'n1').text, '妈妈在平板改过');
  assert.deepEqual(merged.map(note => note.id), ['n3', 'n1', 'n2']);
  assert.deepEqual(mergeNotes(local, local).map(note => note.id), ['n1', 'n2']);
});

test('a sync bundle carries notes and positions, never book files', () => {
  const bundle = buildSyncBundle({
    deviceId: 'd1', readerName: '妈妈',
    books: [{ id: 'b1', chapter: 2, paragraph: 4, chapterTitle: '第二章', updatedAt: '2026-10-24T09:00:00Z' }],
    notes: [{ id: 'n1', bookId: 'b1', text: '好句子', createdAt: '2026-10-24T09:00:00Z' }],
    exportedAt: new Date('2026-10-24T10:00:00Z'),
  });
  assert.equal(bundle.kind, 'read-with-you/sync');
  assert.equal(bundle.positions.length, 1);
  assert.ok(!JSON.stringify(bundle).includes('blob'));
  const parsed = readSyncBundle(JSON.parse(JSON.stringify(bundle)));
  assert.deepEqual(parsed.device, { id: 'd1', name: '妈妈' });
  assert.equal(parsed.positions[0].chapter, 2);
  assert.equal(readSyncBundle({ kind: 'other' }), null);
  const adopted = adoptPositions({ positions: [{ bookId: 'b1', chapter: 1 }, { bookId: 'b9', chapter: 0 }] }, [{ id: 'b1' }]);
  assert.equal(adopted.adopted.length, 1);
  assert.deepEqual(adopted.missing, ['b9']);
});

test('the most recently saved position wins', () => {
  const older = { chapter: 5, paragraph: 9, updatedAt: '2026-10-20T10:00:00Z' };
  const newer = { chapter: 2, paragraph: 1, updatedAt: '2026-10-24T10:00:00Z' };
  assert.equal(pickLaterPosition(older, newer), newer);
  assert.equal(pickLaterPosition(newer, older), newer);
  assert.equal(pickLaterPosition(null, newer), newer);
  assert.equal(pickLaterPosition(older, null), older);
  const tie = { chapter: 0, paragraph: 3, updatedAt: '2026-10-24T10:00:00Z' };
  assert.equal(pickLaterPosition(newer, tie), newer, 'same time → further along wins');
});
