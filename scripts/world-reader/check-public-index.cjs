'use strict';

const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('../../portal/vendor-jszip-3.10.1.min.js');

const worldReaderRoot = path.resolve(__dirname, '../../portal/world-reader');
const indexPath = path.join(worldReaderRoot, 'issues/index.json');

function safeIssuePath(relativePath, issueId, extension, rootDir) {
  if (typeof relativePath !== 'string'
    || relativePath.includes('\\')
    || relativePath.startsWith('/')
    || relativePath.split('/').includes('..')
    || !relativePath.startsWith(`issues/${issueId}/`)
    || !relativePath.endsWith(extension)) return null;
  const base = path.resolve(rootDir);
  const resolved = path.resolve(base, relativePath);
  return resolved.startsWith(`${base}${path.sep}`) ? resolved : null;
}

async function validatePublicIndex(index, rootDir = worldReaderRoot) {
  const errors = [];
  if (!index || !Array.isArray(index.issues)) return ['issues 必须是数组'];
  const issueIds = new Set();

  for (const [position, issue] of index.issues.entries()) {
    const label = `刊物 ${position + 1}`;
    if (!issue || issue.status !== 'published') errors.push(`${label}不是已发布状态`);
    if (typeof issue?.id !== 'string' || !/^[a-z0-9-]+$/.test(issue.id)) {
      errors.push(`${label}ID 无效`);
      continue;
    }
    if (issueIds.has(issue.id)) errors.push(`${label}ID 重复`);
    issueIds.add(issue.id);
    if (typeof issue.title !== 'string' || !issue.title.trim()) errors.push(`${label}缺少标题`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issue.issueDate || '')) errors.push(`${label}日期无效`);
    if (!Number.isInteger(issue.articleCount) || issue.articleCount < 1) errors.push(`${label}文章数无效`);

    const pagePath = safeIssuePath(issue.pageUrl, issue.id, '.html', rootDir);
    const epubPath = safeIssuePath(issue.epubUrl, issue.id, '.epub', rootDir);
    if (!pagePath) errors.push(`${label}网页路径超出刊物目录或扩展名无效`);
    else if (!fs.existsSync(pagePath)) errors.push(`${label}网页文件不存在`);
    else if (!fs.readFileSync(pagePath, 'utf8').includes(issue.title)) errors.push(`${label}网页不包含期刊标题`);
    if (!epubPath) errors.push(`${label}EPUB 路径超出刊物目录或扩展名无效`);
    else if (!fs.existsSync(epubPath)) errors.push(`${label}EPUB 文件不存在`);
    else {
      try {
        const zip = await JSZip.loadAsync(fs.readFileSync(epubPath));
        const mimetype = await zip.file('mimetype')?.async('string');
        const packageXml = await zip.file('OEBPS/package.opf')?.async('string');
        if (mimetype !== 'application/epub+zip') errors.push(`${label}EPUB mimetype 无效`);
        if (!packageXml || !packageXml.includes(issue.title)) errors.push(`${label}EPUB 缺少期刊 OPF 或标题`);
      } catch {
        errors.push(`${label}EPUB 不是可读取的 ZIP 文件`);
      }
    }
  }
  return errors;
}

async function main() {
  let index;
  try {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch (error) {
    console.error(`公开刊物索引无法读取：${error.message}`);
    process.exitCode = 1;
    return;
  }
  const errors = await validatePublicIndex(index);
  if (errors.length) {
    console.error(`公开发布被阻止：${errors.join('；')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`公开刊物索引通过：${index.issues.length} 期`);
}

if (require.main === module) main();

module.exports = { validatePublicIndex };