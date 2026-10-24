// 本地存储规则的单元测试：node --test tests/reader/unit
// 只覆盖不依赖 IndexedDB 的纯函数与 localStorage 包装。
import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

globalThis.localStorage = new MemoryStorage();

const storage = await import('../../../portal/reader/storage.js');

test('localDay 使用本地日期，格式 YYYY-MM-DD', () => {
  const day = storage.localDay(new Date(2026, 9, 24, 23, 30));
  assert.equal(day, '2026-10-24');
});

test('阅读位置可写入、读取、清除', () => {
  storage.saveReadingPosition('book-1', { chapterIndex: 2, sentIndex: 5, fraction: 0.3 });
  const saved = storage.readingPosition('book-1');
  assert.equal(saved.chapterIndex, 2);
  assert.equal(saved.sentIndex, 5);
  assert.ok(saved.lastReadAt > 0);
  storage.clearReadingPosition('book-1');
  assert.equal(storage.readingPosition('book-1'), null);
});

test('阅读位置遇到损坏数据返回 null', () => {
  localStorage.setItem('reader-position-broken', '{not json');
  assert.equal(storage.readingPosition('broken'), null);
});

test('书签列表可追加与删除，删除最后一个后返回空数组', () => {
  storage.saveBookmarks('book-2', [{ id: 'a' }]);
  assert.equal(storage.loadBookmarks('book-2').length, 1);
  storage.saveBookmarks('book-2', []);
  assert.deepEqual(storage.loadBookmarks('book-2'), []);
});

test('朗读设置可写入并按字段读回', () => {
  const settings = storage.loadReadingSettings();
  // 未写入时返回空对象；默认值由页面在读取时合并
  assert.equal(typeof settings, 'object');
  storage.saveReadingSettings({ rate: 1.4, autoContinue: false, fontSize: 21 });
  const updated = storage.loadReadingSettings();
  assert.equal(updated.rate, 1.4);
  assert.equal(updated.autoContinue, false);
  assert.equal(updated.fontSize, 21);
});

test('朗读设置遇到损坏数据返回空对象', () => {
  localStorage.setItem('reader-settings', 'not-json');
  assert.deepEqual(storage.loadReadingSettings(), {});
  storage.saveReadingSettings({ rate: 1 });
});

test('背景音偏好与压低开关持久化', () => {
  storage.saveAmbientPrefs({ scene: 'rain', volume: 0.35 });
  assert.equal(storage.loadAmbientPrefs().scene, 'rain');
  assert.equal(storage.loadAmbientPrefs().volume, 0.35);
  storage.setDucking(false);
  assert.equal(storage.duckingEnabled(), false);
  storage.setDucking(true);
  assert.equal(storage.duckingEnabled(), true);
});

test('summarizeDays 汇总最近 N 天，缺省日补零', () => {
  const rows = [
    { days: { '2026-10-24': { readSeconds: 60, listenSeconds: 120 } } },
    { days: { '2026-10-23': { readSeconds: 30 } } },
  ];
  const week = storage.summarizeDays(rows, 7, '2026-10-24');
  assert.equal(week.length, 7);
  const today = week[week.length - 1];
  assert.equal(today.day, '2026-10-24');
  assert.equal(today.readSeconds, 60);
  assert.equal(today.listenSeconds, 120);
  assert.equal(week[week.length - 2].readSeconds, 30);
  assert.equal(week[0].readSeconds, 0);
});

test('addReadingTime 区分阅读与听书并累加总计', () => {
  let row = storage.addReadingTime(null, { seconds: 60, listening: false, day: '2026-10-24' });
  row = storage.addReadingTime(row, { seconds: 120, listening: true, day: '2026-10-24' });
  assert.equal(row.days['2026-10-24'].readSeconds, 60);
  assert.equal(row.days['2026-10-24'].listenSeconds, 120);
  assert.equal(row.totalReadSeconds, 60);
  assert.equal(row.totalListenSeconds, 120);
});

test('STORES 暴露本地数据表（书、设置、笔记、声音、授权、统计）', () => {
  assert.deepEqual(
    Object.keys(storage.STORES).sort(),
    ['books', 'consents', 'notes', 'settings', 'stats', 'voices'],
  );
});
