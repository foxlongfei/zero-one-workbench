const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '../..');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// C01 整书验收现在由 tests/reader 承担：单元测试覆盖分章/笔记/存储规则，
// e2e.mjs 用真实浏览器走完导入、目录、跨章连续朗读、进度恢复、笔记、背景音与家庭声音。
run(process.execPath, ['--test', 'tests/reader/unit/text.test.mjs', 'tests/reader/unit/storage.test.mjs', 'tests/reader/unit/voices.test.mjs', 'tests/reader/unit/ambient.test.mjs', 'tests/reader/unit/narrator.test.mjs']);
run(process.execPath, ['tests/reader/e2e.mjs']);

const reportPath = resolve(ROOT, 'reports/reader/e2e.json');
if (!existsSync(reportPath)) throw new Error('缺少 e2e 报告 reports/reader/e2e.json');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
if (report.status !== 'PASS') throw new Error(`整书 e2e 未通过：${report.status}`);

console.log(JSON.stringify({
  status: 'PASS',
  parser: 'foliate-js',
  checks: report.checks.length,
  wholeBookTts: true,
  epubAndTxtResume: true,
  report: 'reports/reader/e2e.json',
}));
