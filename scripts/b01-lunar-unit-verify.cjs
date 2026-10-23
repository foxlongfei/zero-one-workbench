'use strict';

const assert = require('node:assert/strict');
const { Solar } = require('../portal/vendor/lunar-javascript/lunar.js');
require('../portal/assets/b01-lunar-case.js');

const adapter = globalThis.B01LunarCase;
const baseInput = {
  itemName: '黑色钥匙包',
  lastSeenAt: '2024-02-10T09:30',
  lastSeenPlace: '办公室东侧会议室',
  searchedPlaces: '会议桌、外套口袋、通勤背包',
  context: '10:00 离开会议室，之后经过前台和停车场'
};

assert.deepEqual(adapter.parseLocalDateTime('2024-02-29T23:59'), {
  year: 2024, month: 2, day: 29, hour: 23, minute: 59
});
assert.deepEqual(adapter.parseLocalDateTime('2024-03-10T02:30'), {
  year: 2024, month: 3, day: 10, hour: 2, minute: 30
}, 'wall-clock parsing must not depend on the runner timezone or daylight-saving transition');

for (const invalid of [
  '2023-02-29T12:00',
  '2024-02-30T09:30',
  '2024-13-01T09:30',
  '2024-01-01T24:00',
  'not-a-date'
]) {
  assert.throws(() => adapter.parseLocalDateTime(invalid), /有效|不存在/, invalid);
}

const first = adapter.calculate(baseInput, Solar);
const repeated = adapter.calculate(baseInput, Solar);
assert.equal(first.caseId, repeated.caseId);
assert.deepEqual(first.input, repeated.input);
assert.deepEqual(first.calculation, repeated.calculation);
assert.deepEqual(first.method, repeated.method);
assert.match(first.calculation.lunar, /正月初一/);
assert.equal(first.calculation.yearGanZhi, '甲辰');

const memory = new Map();
const storage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, value)
};
adapter.saveCase(storage, first);
adapter.saveCase(storage, repeated);
assert.equal(adapter.readCases(storage).length, 1, 'repeated calculation must replace, not duplicate, the same case');

const discardedWrites = {
  getItem: () => null,
  setItem: () => {}
};
assert.throws(
  () => adapter.saveCase(discardedWrites, first),
  /未能写入本机存储/,
  'silent storage write rejection must be reported instead of claiming success'
);

console.log(JSON.stringify({
  status: 'PASS',
  timezone: process.env.TZ || 'system-default',
  fixedDate: baseInput.lastSeenAt,
  caseId: first.caseId,
  invalidDates: 5,
  savedCasesAfterRepeat: adapter.readCases(storage).length,
  silentWriteRejected: true
}));
