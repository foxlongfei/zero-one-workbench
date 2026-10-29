'use strict';

const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('../portal/vendor-jszip-3.10.1.min.js');

const CONTENT_TYPES = new Set(['news', 'investigation', 'commentary', 'research', 'culture', 'analysis']);
const CHINESE_TYPES = new Set(['original_summary', 'ai_generated_summary', 'machine_translation', 'human_translation', 'editorial_comment', 'original_guide']);

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&"']/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;'
  })[char]);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validateIssue(issue) {
  const errors = [];
  if (!issue || !/^[a-z0-9-]+$/.test(issue.issueId || '')) errors.push('期刊 ID 无效');
  if (!issue?.title || !/^\d{4}-\d{2}-\d{2}$/.test(issue.issueDate || '')) errors.push('期刊标题或日期缺失');
  if (!Array.isArray(issue?.articles) || issue.articles.length === 0) errors.push('没有可发布文章');
  if (issue?.newsLinks !== undefined && !Array.isArray(issue.newsLinks)) errors.push('国际媒体链接必须是数组');
  for (const [index, item] of (issue?.newsLinks || []).entries()) {
    const label = `国际媒体链接 ${index + 1}`;
    if (!item?.outlet?.trim() || !item?.headline?.trim()) errors.push(`${label}缺少媒体名称或中文标题`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item?.publishedAt || '')) errors.push(`${label}发布日期无效`);
    if (!isHttpsUrl(item?.url)) errors.push(`${label}原文链接必须是 HTTPS`);
  }

  for (const [index, article] of (issue?.articles || []).entries()) {
    const label = `文章 ${index + 1}`;
    for (const [field, value] of Object.entries({
      '媒体名称': article.mediaName,
      '媒体国家或地区': article.mediaCountryOrRegion,
      '报道地区': article.reportedRegion,
      '原文标题': article.originalTitle,
      '作者': article.author,
      '原始发表日期': article.publishedAt,
      '中文标题': article.chineseTitle,
      '中文导读': article.chineseGuide
    })) {
      if (typeof value !== 'string' || !value.trim()) errors.push(`${label}缺少${field}`);
    }
    if (!isHttpsUrl(article.originalUrl)) errors.push(`${label}原文链接必须是 HTTPS`);
    if (!CONTENT_TYPES.has(article.contentType)) errors.push(`${label}内容类型无效`);
    if (!CHINESE_TYPES.has(article.chineseContentType)) errors.push(`${label}中文内容类型无效`);
    if (article.rights?.status !== 'approved'
      || article.rights?.translationPermissionStatus !== 'approved'
      || !article.rights?.scope?.trim()
      || !article.rights?.licenseStatus?.trim()
      || !/^\d{4}-\d{2}-\d{2}$/.test(article.rights?.checkedAt || '')
      || !isHttpsUrl(article.rights?.permissionEvidenceUrl)) {
      errors.push(`${label}缺少可核验且覆盖中文内容的发布许可`);
    }
    for (const [imageIndex, image] of (article.images || []).entries()) {
      const imageLabel = `${label}图片 ${imageIndex + 1}`;
      const required = ['description', 'creator', 'sourceUrl', 'rightsHolder', 'licenseType', 'permissionEvidenceUrl', 'modification', 'epubPath', 'dataBase64'];
      if (required.some((field) => typeof image[field] !== 'string' || !image[field].trim())) errors.push(`${imageLabel}署名、来源、许可或文件数据不完整`);
      if (!isHttpsUrl(image.sourceUrl) || !isHttpsUrl(image.permissionEvidenceUrl)) errors.push(`${imageLabel}来源和许可证据必须是 HTTPS`);
      if (image.rightsStatus !== 'approved') errors.push(`${imageLabel}未获明确使用许可`);
      if (!['image/jpeg', 'image/png'].includes(image.mediaType)) errors.push(`${imageLabel}格式只支持 JPEG 或 PNG`);
      if (!/^OEBPS\/images\/[a-zA-Z0-9._-]+$/.test(image.epubPath || '')) errors.push(`${imageLabel} EPUB 路径无效`);
    }
  }
  return errors;
}

function assertArchiveOutputPath(outputPath) {
  if (!outputPath) throw new Error('必须显式指定 EPUB 归档路径');
  const resolved = path.resolve(outputPath);
  const publicRoot = path.resolve(__dirname, '../portal');
  if (resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error('EPUB 必须先写入出版档案目录，不得直接写入 portal 公共目录');
  }
  return resolved;
}

function articleXhtml(article) {
  const images = (article.images || []).map((image) => {
    const relativePath = image.epubPath.replace(/^OEBPS\//, '');
    return `<figure><img src="${escapeXml(relativePath)}" alt="${escapeXml(image.description)}"/><figcaption>${escapeXml(image.description)} · 创作者：${escapeXml(image.creator)}；权利人：${escapeXml(image.rightsHolder)}；来源：<a href="${escapeXml(image.sourceUrl)}">原图链接</a>；许可：${escapeXml(image.licenseType)}（<a href="${escapeXml(image.permissionEvidenceUrl)}">许可依据</a>）；${escapeXml(image.modification)}</figcaption></figure>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN" xml:lang="zh-CN"><head><title>${escapeXml(article.chineseTitle)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body><article><h1>${escapeXml(article.chineseTitle)}</h1><p class="metadata">${escapeXml(article.mediaName)} · ${escapeXml(article.author)} · ${escapeXml(article.publishedAt)}</p><p class="disclosure">中文内容类型：${escapeXml(article.chineseContentType)}</p><div>${escapeXml(article.chineseGuide).split(/\n\s*\n/).map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br/>')}</p>`).join('')}</div>${images}<h2>原文与来源</h2><p>原文标题：${escapeXml(article.originalTitle)}</p><p>原文链接：<a href="${escapeXml(article.originalUrl)}">${escapeXml(article.originalUrl)}</a></p></article></body></html>`;
}

async function buildEpub(issue) {
  const errors = validateIssue(issue);
  if (errors.length) throw new Error(`授权/资料校验失败：${errors.join('；')}`);

  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0" encoding="utf-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('OEBPS/styles.css', 'body{font-family:serif;line-height:1.75;margin:6%;color:#202a28}h1{font-size:1.7em;line-height:1.35}.metadata,.disclosure,figcaption{font-size:.88em;color:#52635d}figure{margin:1.5em 0}img{max-width:100%;height:auto}');

  const manifest = ['<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>', '<item id="sources" href="source-index.xhtml" media-type="application/xhtml+xml"/>', '<item id="css" href="styles.css" media-type="text/css"/>'];
  const spine = ['<itemref idref="cover"/>'];
  const nav = [];
  const sources = [];
  for (const [index, article] of issue.articles.entries()) {
    const chapter = `chapter-${index + 1}`;
    zip.file(`OEBPS/${chapter}.xhtml`, articleXhtml(article));
    manifest.push(`<item id="${chapter}" href="${chapter}.xhtml" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${chapter}"/>`);
    nav.push(`<li><a href="${chapter}.xhtml">${escapeXml(article.chineseTitle)}</a></li>`);
    const imageRows = (article.images || []).map((image) => `<li>${escapeXml(image.description)} · ${escapeXml(image.creator)} · ${escapeXml(image.rightsHolder)} · ${escapeXml(image.licenseType)} · ${escapeXml(image.modification)} · <a href="${escapeXml(image.sourceUrl)}">图片来源</a> · <a href="${escapeXml(image.permissionEvidenceUrl)}">许可依据</a></li>`).join('');
    sources.push(`<section><h2>${escapeXml(article.chineseTitle)}</h2><p>${escapeXml(article.mediaName)} · 媒体地区：${escapeXml(article.mediaCountryOrRegion)} · 报道地区：${escapeXml(article.reportedRegion)} · ${escapeXml(article.author)} · ${escapeXml(article.publishedAt)}</p><p>内容类型：${escapeXml(article.contentType)}；中文内容类型：${escapeXml(article.chineseContentType)}</p><p>原文标题：${escapeXml(article.originalTitle)}</p><p><a href="${escapeXml(article.originalUrl)}">原文链接</a></p><p>中文内容许可：${escapeXml(article.rights.licenseStatus)}；范围：${escapeXml(article.rights.scope)}；<a href="${escapeXml(article.rights.permissionEvidenceUrl)}">许可依据</a></p><ul>${imageRows}</ul></section>`);
    for (const [imageIndex, image] of (article.images || []).entries()) {
      zip.file(image.epubPath, Buffer.from(image.dataBase64, 'base64'));
      manifest.push(`<item id="image-${index + 1}-${imageIndex + 1}" href="${escapeXml(image.epubPath.replace(/^OEBPS\//, ''))}" media-type="${escapeXml(image.mediaType)}"/>`);
    }
  }

  const cover = `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN" xml:lang="zh-CN"><head><title>${escapeXml(issue.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body><section class="cover"><p>零一空间 · 听世界</p><h1>${escapeXml(issue.title)}</h1><p>${escapeXml(issue.issueDate)} · ${escapeXml(issue.edition || 'V0.1')}</p></section></body></html>`;
  zip.file('OEBPS/cover.xhtml', cover);
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN" xml:lang="zh-CN"><head><title>目录</title></head><body><nav epub:type="toc" id="toc"><h1>目录</h1><ol><li><a href="cover.xhtml">封面</a></li>${nav.join('')}<li><a href="source-index.xhtml">图片版权与资料来源</a></li></ol></nav></body></html>`);
  const omittedImages = issue.articles.flatMap((article) => article.omittedImageSources || []).map((image) => `<li>${escapeXml(image.description)} · 创作者：${escapeXml(image.creator)}；<a href="${escapeXml(image.sourceUrl)}">来源</a>；许可：${escapeXml(image.licenseType)}（<a href="${escapeXml(image.licenseEvidenceUrl)}">许可说明</a>）；状态：未转载</li>`).join('');
  const imageIndex = omittedImages ? `<section><h2>未转载图片来源</h2><ul>${omittedImages}</ul></section>` : '<p>本期未使用图片。</p>';
  const newsRows = (issue.newsLinks || []).map((item) => `<li><strong>${escapeXml(item.outlet)} · ${escapeXml(item.publishedAt)}</strong>：<a href="${escapeXml(item.url)}">${escapeXml(item.headline)}</a>${item.note ? `（${escapeXml(item.note)}）` : ''}</li>`).join('');
  const newsIndex = newsRows ? `<section><h2>国际媒体新闻链接</h2><p>${escapeXml(issue.newsLinksNote || '本节仅提供新闻线索链接，不代表这些媒体报道了同一事件或相互核实。')}</p><ul>${newsRows}</ul></section>` : '';
  zip.file('OEBPS/source-index.xhtml', `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN" xml:lang="zh-CN"><head><title>版权与资料来源</title></head><body><h1>版权与资料来源</h1>${sources.join('')}${newsIndex}${imageIndex}</body></html>`);
  zip.file('OEBPS/package.opf', `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="zh-CN"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">urn:zero-one:${escapeXml(issue.issueId)}</dc:identifier><dc:title>${escapeXml(issue.title)}</dc:title><dc:language>zh-CN</dc:language><meta property="dcterms:modified">${escapeXml(issue.issueDate)}T00:00:00Z</meta></metadata><manifest>${manifest.join('')}</manifest><spine>${spine.join('')}<itemref idref="sources"/></spine></package>`);
  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

async function main() {
  const issuePath = process.argv[2];
  const requestedOutputPath = process.argv[3];
  const runDir = process.env.WORLD_READER_RUN_LOG_DIR || path.join(__dirname, '../artifacts/world-reader/runs');
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const recordPath = path.join(runDir, `${runId}.json`);
  let issue;
  let outcome = 'blocked';
  let message = '';
  try {
    if (!issuePath || !requestedOutputPath) {
      throw new Error('用法：node build-world-reader-epub.cjs <获批期刊 JSON 路径> <Drive/06-EPUB归档/期刊.epub>');
    }
    const outputPath = assertArchiveOutputPath(requestedOutputPath);
    issue = JSON.parse(fs.readFileSync(issuePath, 'utf8'));
    const buffer = await buildEpub(issue);
    if (!fs.statSync(path.dirname(outputPath)).isDirectory()) throw new Error('EPUB 归档目录不存在；不会自动创建 Drive 目录');
    fs.writeFileSync(outputPath, buffer);
    outcome = 'generated';
    message = `EPUB 已生成：${path.relative(process.cwd(), outputPath)}`;
    console.log(message);
  } catch (error) {
    message = error.message;
    console.error(message);
  } finally {
    try {
      if (process.env.WORLD_READER_RUN_LOG_DIR && !fs.statSync(runDir).isDirectory()) {
        throw new Error('指定的 Drive 运行记录目录不存在；不会自动创建目录');
      }
      fs.mkdirSync(runDir, { recursive: true });
      fs.writeFileSync(recordPath, JSON.stringify({
        runId,
        action: 'epub-build',
        issueId: issue?.issueId || 'unassigned',
        outcome,
        message,
        recordKind: 'automated',
        publicationStatus: 'not-published',
        emailStatus: 'not-sent'
      }, null, 2) + '\n');
    } catch (recordError) {
      console.error(`运行记录未能持久化：${recordError.message}`);
      process.exitCode = 1;
    }
  }
  if (outcome !== 'generated') process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { assertArchiveOutputPath, buildEpub, validateIssue };