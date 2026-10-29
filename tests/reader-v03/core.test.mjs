// Unit tests for the V0.3 reader core (no browser, no network).
// Run with: node --test tests/reader-v03/

import test from 'node:test';
import assert from 'node:assert/strict';

import { chunkText, splitChapters, isChapterTitle, splitSentences, secondsToMinutes, formatMilliseconds, percent } from '../../portal/reader-v03/lib/text.mjs';
import { bookFromTxt, chapterIndexForSection, isAuxiliarySection, isBookFinished, mapEpubSections, narratableChapters, paragraphsFromHtml, pickText, totalParagraphs } from '../../portal/reader-v03/lib/book.mjs';
import { Narration, State } from '../../portal/reader-v03/lib/narration.mjs';
import { resolvePlaylist, resolveDaypart, BUILTIN_SOURCES } from '../../portal/reader-v03/lib/listening-world.mjs';

// ---------------------------------------------------------------------------
// text
// ---------------------------------------------------------------------------
test('detects Chinese and English chapter headings', () => {
  for (const line of ['第一章 起点', '第十二回 归来', 'Chapter 3', 'Prologue', '番外·春天', '尾声：回家']) {
    assert.ok(isChapterTitle(line), line);
  }
  assert.ok(!isChapterTitle('他的第一章写得很慢'), 'heading text inside a sentence is not a heading');
  assert.ok(!isChapterTitle(''));
});

test('splits a TXT book into chapters and paragraphs', () => {
  const chapters = splitChapters('前言\n这是前言。\n\n第一章 开始\n第一段。\n\n第二段。\n\n第二章 继续\n内容。');
  assert.equal(chapters.length, 3);
  assert.deepEqual(chapters.map(c => c.title), ['前言', '第一章 开始', '第二章 继续']);
  assert.deepEqual(chapters[1].paragraphs, ['第一段。', '第二段。']);
});

test('a TXT without headings becomes one chapter', () => {
  const chapters = splitChapters('只有一段文字，没有章节标题。');
  assert.equal(chapters.length, 1);
  assert.deepEqual(chapters[0].paragraphs, ['只有一段文字，没有章节标题。']);
});

test('chunking keeps sentences intact and respects the budget', () => {
  const text = '第一句话很短。第二句话稍微长一些，仍然在一个句子之内！第三句是问句吗？';
  const chunks = chunkText(text, { maxChars: 20 });
  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) assert.ok(chunk.length <= 40, `chunk too long: ${chunk}`);
  assert.equal(chunks.join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
  assert.ok(chunks.every(chunk => /[。！？]$/u.test(chunk)), 'chunks end on sentence boundaries');
});

test('over-long sentences are cut at commas', () => {
  const sentence = `${'很长的从句，'.repeat(40)}结束。`;
  const chunks = chunkText(sentence, { maxChars: 60 });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(chunk => chunk.length <= 61));
});

test('english sentence splitting and formatting helpers', () => {
  assert.deepEqual(splitSentences('Hello there. How are you? Fine.'), ['Hello there.', 'How are you?', 'Fine.']);
  assert.equal(percent(0.426), '43%');
  assert.equal(secondsToMinutes(3720), '1 小时 2 分');
  assert.equal(secondsToMinutes(90), '2 分钟');
});

test('listening statistics convert stored milliseconds exactly once', () => {
  assert.equal(formatMilliseconds(0), '0 分钟');
  assert.equal(formatMilliseconds(90_000), '2 分钟');
  assert.equal(formatMilliseconds(3_600_000), '1 小时 0 分');
  assert.equal(formatMilliseconds(3_720_000), '1 小时 2 分');
});

// ---------------------------------------------------------------------------
// book
// ---------------------------------------------------------------------------
test('builds a TXT book model', () => {
  const book = bookFromTxt(null, { title: '测试书', chapters: splitChapters('第一章 一\n甲。\n\n乙。') });
  assert.equal(book.title, '测试书');
  assert.equal(totalParagraphs(book), 2);
  assert.equal(book.chapters[0].sectionIndex, 0);
});

test('paragraph extraction keeps CJK text and drops markup', () => {
  const html = '<html><body><nav>目录</nav><h1>标题 &amp; 副题</h1><p>第一段。</p><div>第二段<br>续。</div><aside>注释不应出现</aside><script>x()</script></body></html>';
  const paragraphs = paragraphsFromHtml(html);
  assert.ok(paragraphs.includes('标题 & 副题'));
  assert.ok(paragraphs.includes('第一段。'));
  assert.ok(!paragraphs.join('|').includes('x()'));
  assert.ok(!paragraphs.join('|').includes('注释不应出现'));
  assert.ok(!paragraphs.includes('目录'));
});

test('maps EPUB spine sections to TOC titles', () => {
  const model = mapEpubSections({
    sections: [{ id: 'ch1.xhtml' }, { id: 'ch2.xhtml' }, { id: 'notes.xhtml' }],
    toc: [
      { label: '第一章', href: 'ch1.xhtml' },
      { label: '第二章', href: 'ch2.xhtml', subitems: [{ label: '二之一', href: 'ch2.xhtml#s1' }] },
    ],
    metadata: { title: '书', author: [{ name: '作者' }] },
  });
  assert.deepEqual(model.chapters.map(c => c.title), ['第一章', '第二章', '第 3 部分']);
  assert.equal(model.chapters[1].sectionIndex, 1);
  assert.equal(pickText([{ name: '作者' }]), '作者');
});

test('non-linear and notes sections are excluded from narration', () => {
  const sections = [{ id: 'ch1.xhtml', linear: 'yes' }, { id: 'notes.xhtml', linear: 'yes' }, { id: 'cover.xhtml', linear: 'no' }];
  const chapters = [{ title: '第一章', sectionIndex: 0 }, { title: '注释', sectionIndex: 1 }, { title: '封面', sectionIndex: 2 }];
  assert.equal(isAuxiliarySection(sections[1]), true);
  assert.equal(isAuxiliarySection(sections[2]), true);
  assert.deepEqual(narratableChapters(chapters, sections).map(chapter => chapter.title), ['第一章']);
  assert.equal(chapterIndexForSection([{ sectionIndex: 2 }], 2), 0);
});

test('superscript footnote markers are removed with the rest of the apparatus', () => {
  assert.deepEqual(paragraphsFromHtml('<p>正文<sup>12</sup>继续。</p>'), ['正文 继续。']);
});

test('a last-chapter position is not mistaken for a finished book', () => {
  assert.equal(isBookFinished(null), false);
  assert.equal(isBookFinished({ chapter: 2, paragraph: 0 }), false);
  assert.equal(isBookFinished({ chapter: 2, paragraph: 4, fraction: 0.97 }), false);
  assert.equal(isBookFinished({ chapter: 2, paragraph: 4, finished: true }), true);
  assert.equal(isBookFinished({ chapter: 2, paragraph: 4, fraction: 1 }), true);
});

// ---------------------------------------------------------------------------
// narration
// ---------------------------------------------------------------------------
const demoBook = {
  title: '两章书',
  chapters: [
    { title: '第一章', paragraphs: ['甲一。', '甲二。'] },
    { title: '第二章', paragraphs: ['乙一。'] },
  ],
};

const makeNarration = (spoken = []) => new Narration({
  speak: async text => { spoken.push(text); await new Promise(r => setTimeout(r, 0)); },
});

test('listening runs continuously across a chapter boundary', async () => {
  const spoken = [];
  const changes = [];
  const narration = new Narration({
    speak: async text => { spoken.push(text); },
    onProgress: ({ chapterChanged, chapter }) => { if (chapterChanged) changes.push(chapter); },
  });
  narration.load(demoBook);
  await narration.start();
  // The narrator says each chapter's heading as its own utterance, then flows
  // straight into the body and the next chapter without stopping.
  assert.deepEqual(spoken, ['第一章', '甲一。', '甲二。', '第二章', '乙一。']);
  assert.deepEqual(changes, [1]);
  assert.equal(narration.state, State.ENDED);
  assert.equal(narration.chapter, 1);
});

test('the book title is announced once before the first chapter', async () => {
  const spoken = [];
  const narration = new Narration({ speak: async text => { spoken.push(text); } });
  narration.load(demoBook);
  narration.bookTitle = '两章书';
  await narration.start();
  assert.deepEqual(spoken, ['两章书', '第一章', '甲一。', '甲二。', '第二章', '乙一。']);
});

test('paragraph scope stops after the selected paragraph', async () => {
  const spoken = [];
  const narration = new Narration({ speak: async text => { spoken.push(text); } });
  narration.load(demoBook);
  narration.endAt = { chapter: 0, paragraph: 0 };
  await narration.start({ chapter: 0, paragraph: 0 });
  assert.deepEqual(spoken, ['第一章', '甲一。']);
  assert.equal(narration.state, State.ENDED);
});

test('pause then resume restarts the interrupted paragraph', async () => {
  const spoken = [];
  const pending = [];
  const narration = new Narration({
    speak: text => new Promise(resolve => {
      spoken.push(text);
      pending.push(resolve);
    }),
  });
  const settle = () => { while (pending.length) pending.shift()(); };
  narration.load(demoBook);
  const running = narration.start();
  for (let i = 0; i < 20 && !pending.length; i++) await new Promise(r => setImmediate(r));
  assert.equal(narration.state, State.SPEAKING);
  narration.pause();
  settle();
  await running;
  assert.equal(narration.state, State.PAUSED);
  assert.deepEqual({ chapter: narration.chapter, paragraph: narration.paragraph }, { chapter: 0, paragraph: 0 });
  const resumed = narration.start();
  for (let i = 0; i < 20 && !pending.length; i++) await new Promise(r => setImmediate(r));
  assert.equal(spoken.at(-1), '甲一。', 'resume re-speaks the interrupted paragraph');
  narration.stop();
  settle();
  await resumed;
  narration.stop();
});

test('jump and skip move the cursor and keep playing', async () => {
  const spoken = [];
  const narration = makeNarration(spoken);
  narration.load(demoBook, { chapter: 1, paragraph: 0 });
  assert.equal(narration.chapter, 1);
  narration.prevChapter();
  assert.equal(narration.chapter, 0);
  narration.nextParagraph();
  assert.deepEqual({ chapter: narration.chapter, paragraph: narration.paragraph }, { chapter: 0, paragraph: 1 });
  narration.nextParagraph();
  assert.deepEqual({ chapter: narration.chapter, paragraph: narration.paragraph }, { chapter: 1, paragraph: 0 });
});

test('listening statistics count only spoken text', async () => {
  const narration = makeNarration();
  narration.load(demoBook);
  await narration.start();
  const stats = narration.statistics();
  assert.equal(stats.totalChars, 9);
  assert.ok(stats.listenedMs >= 0);
});

// ---------------------------------------------------------------------------
// 听世界
// ---------------------------------------------------------------------------
test('daypart resolution and licence-safe recommendations', () => {
  assert.equal(resolveDaypart(new Date('2026-10-24T03:00:00')), 'night');
  assert.equal(resolveDaypart(new Date('2026-10-24T12:00:00')), 'day');
  assert.equal(resolveDaypart(new Date('2026-10-24T21:00:00')), 'evening');
  const day = resolvePlaylist({ daypart: 'day' });
  assert.equal(day.kind, 'radio');
  assert.notEqual(day.item.license, 'placeholder');
  const evening = resolvePlaylist({ daypart: 'evening' });
  assert.equal(evening.kind, 'none', 'placeholder podcast is never recommended');
  assert.match(evening.reason, /没有可用频道/);
  const fav = resolvePlaylist({ mode: 'favourites', favourites: ['france-musique'] });
  assert.equal(fav.item.id, 'france-musique');
  assert.equal(resolvePlaylist({ mode: 'favourites', favourites: [] }).kind, 'none');
  assert.equal(resolvePlaylist({ mode: 'ambience', ambience: [] }).kind, 'none');
  assert.ok(BUILTIN_SOURCES.every(source => source.attribution), 'every source states its rights');
});
