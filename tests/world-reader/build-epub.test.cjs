'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const JSZip = require('../../portal/vendor-jszip-3.10.1.min.js');
const { assertArchiveOutputPath, buildEpub, validateIssue } = require('../../scripts/build-world-reader-epub.cjs');

function approvedFixture() {
  return {
    issueId: 'test-issue-2026-10-29',
    issueDate: '2026-10-29',
    title: '测试期刊',
    edition: 'fixture',
    articles: [{
      id: 'test-article',
      mediaName: '测试媒体',
      mediaCountryOrRegion: '测试媒体所属地区',
      reportedRegion: '测试报道地区',
      originalTitle: '测试原文标题',
      author: '测试作者',
      publishedAt: '2026-10-29',
      originalUrl: 'https://example.test/story',
      contentType: 'research',
      chineseContentType: 'original_guide',
      chineseTitle: '测试中文标题',
      chineseGuide: '第一段测试内容。\n\n第二段测试内容。',
      rights: {
        status: 'approved',
        translationPermissionStatus: 'approved',
        scope: '测试夹具，不对应真实内容',
        licenseStatus: '测试许可，不对应真实来源',
        checkedAt: '2026-10-29',
        permissionEvidenceUrl: 'https://example.test/permission'
      },
      images: []
    }]
  };
}

test('blocks a draft without explicit translation permission', async () => {
  const issue = approvedFixture();
  issue.articles[0].rights.status = 'blocked';
  issue.articles[0].rights.translationPermissionStatus = 'not_requested';
  issue.articles[0].rights.permissionEvidenceUrl = '';
  const errors = validateIssue(issue);
  assert.ok(errors.some((error) => error.includes('发布许可')));
  await assert.rejects(buildEpub(issue), /授权\/资料校验失败/);
});

test('rejects source metadata without a permanent HTTPS link', () => {
  const issue = approvedFixture();
  issue.articles[0].originalUrl = 'http://example.test/story';
  assert.ok(validateIssue(issue).some((error) => error.includes('原文链接')));
});

test('refuses to write an EPUB directly into the public portal', () => {
  const publicOutput = path.resolve(__dirname, '../../portal/world-reader/issues/draft/draft.epub');
  assert.throws(() => assertArchiveOutputPath(publicOutput), /不得直接写入 portal/);
});

test('rejects an image without explicit rights and attribution evidence', () => {
  const issue = approvedFixture();
  issue.articles[0].images = [{
    description: '测试图片',
    creator: '测试创作者',
    sourceUrl: 'https://example.test/image.png',
    rightsHolder: '测试权利人',
    licenseType: '测试许可',
    permissionEvidenceUrl: 'https://example.test/image-permission',
    modification: '未修改',
    rightsStatus: 'pending',
    mediaType: 'image/png',
    epubPath: 'OEBPS/images/test.png',
    dataBase64: 'AA=='
  }];
  assert.ok(validateIssue(issue).some((error) => error.includes('未获明确使用许可')));
});

test('generates a readable EPUB structure for an approved test fixture', async () => {
  const issue = approvedFixture();
  issue.articles[0].chineseContentType = 'ai_generated_summary';
  const buffer = await buildEpub(issue);
  const zip = await JSZip.loadAsync(buffer);
  assert.equal(await zip.file('mimetype').async('string'), 'application/epub+zip');
  const packageXml = await zip.file('OEBPS/package.opf').async('string');
  assert.match(packageXml, /<spine>/);
  assert.match(await zip.file('OEBPS/cover.xhtml').async('string'), /测试期刊/);
  assert.match(await zip.file('OEBPS/source-index.xhtml').async('string'), /版权与资料来源/);
  assert.match(await zip.file('OEBPS/chapter-1.xhtml').async('string'), /原文与来源/);
  assert.match(await zip.file('OEBPS/chapter-1.xhtml').async('string'), /ai_generated_summary/);
});

test('includes link-only international news sources in the EPUB source index', async () => {
  const issue = approvedFixture();
  issue.newsLinksNote = '这些链接涉及不同事件，不构成交叉验证。';
  issue.newsLinks = [{
    outlet: '测试国际媒体',
    publishedAt: '2026-10-29',
    headline: '测试新闻链接',
    url: 'https://example.test/news',
    note: '只提供链接'
  }];
  const zip = await JSZip.loadAsync(await buildEpub(issue));
  const sourceIndex = await zip.file('OEBPS/source-index.xhtml').async('string');
  assert.match(sourceIndex, /测试国际媒体/);
  assert.match(sourceIndex, /https:\/\/example\.test\/news/);
  assert.match(sourceIndex, /不构成交叉验证/);
});

test('rejects invalid URLs in the international news source list', () => {
  const issue = approvedFixture();
  issue.newsLinks = [{ outlet: '测试媒体', publishedAt: '2026-10-29', headline: '测试', url: 'http://example.test/news' }];
  assert.ok(validateIssue(issue).some((error) => error.includes('国际媒体链接 1原文链接必须是 HTTPS')));
});

test('embeds a licensed image with attribution in the chapter and source index', async () => {
  const issue = approvedFixture();
  issue.articles[0].images = [{
    description: '测试图片',
    creator: '测试创作者',
    sourceUrl: 'https://example.test/image.png',
    rightsHolder: '测试权利人',
    licenseType: 'CC BY 4.0',
    permissionEvidenceUrl: 'https://example.test/image-permission',
    modification: '裁剪',
    rightsStatus: 'approved',
    mediaType: 'image/png',
    epubPath: 'OEBPS/images/test.png',
    dataBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf5sAAAAASUVORK5CYII='
  }];
  const zip = await JSZip.loadAsync(await buildEpub(issue));
  assert.ok(zip.file('OEBPS/images/test.png'));
  assert.match(await zip.file('OEBPS/chapter-1.xhtml').async('string'), /测试权利人/);
  assert.match(await zip.file('OEBPS/source-index.xhtml').async('string'), /CC BY 4\.0/);
});