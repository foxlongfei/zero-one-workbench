// 文字与笔记工具的单元测试：node --test tests/reader/unit
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitTxtChapters, txtParagraphs, makeNote, noteMatches, formatDuration,
} from '../../../portal/reader/text.js';

test('splitTxtChapters 识别「第X章」并把开篇独立成章', () => {
  const chapters = splitTxtChapters('书名\n\n第一章 清晨\n第一段。\n\n第二章 小路\n第二段。');
  assert.equal(chapters.length, 3);
  assert.equal(chapters[0].title, '开篇');
  assert.equal(chapters[1].title, '第一章 清晨');
  assert.ok(chapters[2].text.includes('第二段。'));
});

test('splitTxtChapters 兼容 Chapter N 与 CRLF', () => {
  const chapters = splitTxtChapters('Chapter 1\r\nHello there.\r\nChapter 2\r\nBye.');
  assert.deepEqual(chapters.map(c => c.title), ['Chapter 1', 'Chapter 2']);
  assert.equal(chapters[0].text, 'Hello there.');
});

test('splitTxtChapters 对空文本返回空数组', () => {
  assert.deepEqual(splitTxtChapters('   \n\n '), []);
});

test('txtParagraphs 去掉空行并 trim', () => {
  assert.deepEqual(txtParagraphs(' a \n\n\n b \n'), ['a', 'b']);
});

test('makeNote 记录书籍、引用与时间', () => {
  const note = makeNote({ bookId: 'b1', text: '  想法  ', quote: '引用  文字', tags: ['孩子', '问题'] });
  assert.equal(note.bookId, 'b1');
  assert.equal(note.text, '想法');
  assert.equal(note.quote, '引用 文字');
  assert.deepEqual(note.tags, ['孩子', '问题']);
  assert.ok(note.id.startsWith('note-'));
  assert.ok(note.createdAt > 0);
});

test('makeNote 最多保留 5 个标签', () => {
  const note = makeNote({ bookId: 'b1', text: 'x', tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
  assert.equal(note.tags.length, 5);
});

test('noteMatches 匹配正文、引用、章节，空查询全部命中', () => {
  const note = makeNote({ bookId: 'b', text: '关于风', quote: 'wind', chapter: '第三章' });
  assert.equal(noteMatches(note, ''), true);
  assert.equal(noteMatches(note, '风'), true);
  assert.equal(noteMatches(note, 'WIND'), true);
  assert.equal(noteMatches(note, '三'), true);
  assert.equal(noteMatches(note, '雨'), false);
});

test('noteMatches 支持标签与空格分隔的多词查询', () => {
  const note = makeNote({ bookId: 'b', text: '这一章的风声让我想起小时候的窗户。', tags: ['童年', '疑问'] });
  assert.equal(noteMatches(note, '童年'), true);
  assert.equal(noteMatches(note, '风声 窗户'), true);
  assert.equal(noteMatches(note, '窗户 风声'), true);
  assert.equal(noteMatches(note, '风声 雨声'), false);
});

test('noteMatches 允许片段之间隔着别的字（记得几个词就能搜到）', () => {
  const note = makeNote({ bookId: 'b', text: '这一章的风声让我想起小时候的窗户，夜里很安静。', chapter: '第三章 归来' });
  assert.equal(noteMatches(note, '风声 窗户'), true);
  assert.equal(noteMatches(note, '窗户 风声'), true);
  assert.equal(noteMatches(note, '风声 雨声'), false);
  // 三字以上的中文词按相邻双字兜底，所以「窗户外」能找到「…窗户，」；两个字的词只认原样
  assert.equal(noteMatches(note, '窗户'), true);
  assert.equal(noteMatches(note, '窗台'), false);
});

test('noteMatches 记得模糊也能搜到：童年的窗户 → 小时候的窗户', () => {
  const note = makeNote({ bookId: 'b', text: '这一章的风声让我想起小时候的窗户。', tags: ['童年'] });
  assert.equal(noteMatches(note, '童年的窗户'), true);
  assert.equal(noteMatches(note, '童年 窗户'), true);
  assert.equal(noteMatches(note, '少年的窗户'), true);
  assert.equal(noteMatches(note, '窗外的雨'), false);
});

test('formatDuration 输出中文时长（四舍五入到分钟）', () => {
  assert.equal(formatDuration(0), '0 秒');
  assert.equal(formatDuration(45), '45 秒');
  assert.equal(formatDuration(90), '1 分钟');
  assert.equal(formatDuration(3720), '1 小时 2 分');
});
