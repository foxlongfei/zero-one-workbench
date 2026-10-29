'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const JSZip = require('../../portal/vendor-jszip-3.10.1.min.js');
const { validatePublicIndex } = require('../../scripts/world-reader/check-public-index.cjs');

function issueFixture() {
  return {
    id: 'issue-2026-10-29',
    status: 'published',
    title: '世界读本测试期刊',
    issueDate: '2026-10-29',
    articleCount: 1,
    pageUrl: 'issues/issue-2026-10-29/index.html',
    epubUrl: 'issues/issue-2026-10-29/issue.epub'
  };
}

async function withPublicFiles(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'world-reader-public-'));
  fs.mkdirSync(path.join(root, 'issues/issue-2026-10-29'), { recursive: true });
  const issue = issueFixture();
  fs.writeFileSync(path.join(root, issue.pageUrl), `<!doctype html><title>${issue.title}</title>`);
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('OEBPS/package.opf', `<?xml version="1.0"?><package><metadata><title>${issue.title}</title></metadata></package>`);
  fs.writeFileSync(path.join(root, issue.epubUrl), await zip.generateAsync({ type: 'nodebuffer' }));
  try {
    return await run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('allows an empty public index before the first approved publication', async () => {
  assert.deepEqual(await validatePublicIndex({ issues: [] }), []);
});

test('requires a published issue page and readable EPUB in its own issue folder', async () => {
  await withPublicFiles(async (root) => {
    assert.deepEqual(await validatePublicIndex({ issues: [issueFixture()] }, root), []);
  });
});

test('blocks drafts and paths outside the public issue folder', async () => {
  await withPublicFiles(async (root) => {
    const issue = issueFixture();
    issue.status = 'draft';
    issue.pageUrl = '../../private/draft.html';
    const errors = await validatePublicIndex({ issues: [issue] }, root);
    assert.ok(errors.some((error) => error.includes('不是已发布状态')));
    assert.ok(errors.some((error) => error.includes('网页路径超出')));
  });
});

test('blocks a corrupt EPUB archive', async () => {
  await withPublicFiles(async (root) => {
    fs.writeFileSync(path.join(root, issueFixture().epubUrl), 'not an epub');
    const errors = await validatePublicIndex({ issues: [issueFixture()] }, root);
    assert.ok(errors.some((error) => error.includes('不是可读取的 ZIP')));
  });
});