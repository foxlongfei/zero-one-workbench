'use strict';

const $ = (id) => document.getElementById(id);
const indexUrl = './issues/index.json';

function localPath(value) {
  if (typeof value !== 'string' || value.startsWith('/') || value.includes('..')) return '';
  try {
    const url = new URL(value, location.href);
    return url.origin === location.origin ? url.href : '';
  } catch {
    return '';
  }
}

function issueRow(issue) {
  const row = document.createElement('article');
  row.className = 'issue';
  const info = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = issue.title;
  const detail = document.createElement('p');
  detail.textContent = `${issue.issueDate} · ${issue.articleCount} 篇文章`;
  info.append(title, detail);

  const links = document.createElement('div');
  links.className = 'downloads';
  const pageUrl = localPath(issue.pageUrl);
  const epubUrl = localPath(issue.epubUrl);
  if (pageUrl) {
    const pageLink = document.createElement('a');
    pageLink.href = pageUrl;
    pageLink.textContent = '在线阅读';
    links.append(pageLink);
  }
  if (epubUrl) {
    const epubLink = document.createElement('a');
    epubLink.href = epubUrl;
    epubLink.download = '';
    epubLink.textContent = '下载 EPUB';
    links.append(epubLink);
  }
  row.append(info, links);
  return row;
}

async function render() {
  const response = await fetch(indexUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`刊物目录读取失败（HTTP ${response.status}）`);
  const data = await response.json();
  if (!Array.isArray(data.issues)) throw new Error('刊物目录格式无效');

  const issues = data.issues.filter((issue) => issue.status === 'published'
    && issue.title
    && /^\d{4}-\d{2}-\d{2}$/.test(issue.issueDate)
    && Number.isInteger(issue.articleCount)
    && issue.articleCount > 0);
  issues.sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  if (!issues.length) {
    $('status-label').textContent = '尚无已发布期刊';
    $('status-message').textContent = '刊物将在来源、版权、EPUB 与公开页面验证全部通过后发布。';
    return;
  }

  $('status-label').textContent = `${issues.length} 期已发布`;
  $('status-message').textContent = `最近更新：${issues[0].issueDate}`;
  $('latest').replaceChildren(issueRow(issues[0]));
  const olderIssues = issues.slice(1);
  if (olderIssues.length) $('archive').replaceChildren(...olderIssues.map(issueRow));
  else $('archive').textContent = '暂无更早刊物。';
}

render().catch((error) => {
  $('status-label').textContent = '目录暂不可用';
  $('status-message').textContent = error.message;
});