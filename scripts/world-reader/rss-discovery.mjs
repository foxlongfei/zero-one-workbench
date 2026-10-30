import { XMLParser } from 'fast-xml-parser';
import { decodeHtmlText } from './source-discovery.mjs';

const MAX_FEED_CHARACTERS = 1_000_000;
const MAX_DESCRIPTION_CHARACTERS = 360;
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  textNodeName: '#text',
  trimValues: true,
  isArray: (name, path) => ['rss.channel.item', 'RDF.item', 'rdf.item', 'feed.entry'].includes(path)
});

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function text(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') return text(value['#text'] ?? value['#cdata'] ?? '');
  return '';
}

function firstText(item, fields) {
  for (const field of fields) {
    const value = text(item[field]);
    if (value) return value;
  }
  return '';
}

function itemLink(item) {
  for (const candidate of asArray(item.link)) {
    const href = candidate && typeof candidate === 'object' ? candidate['@_href'] : '';
    const value = href || text(candidate);
    if (value) return value;
  }
  return '';
}

function feedItems(document) {
  const parsed = parser.parse(document);
  const items = parsed.rss?.channel?.item
    ?? parsed.RDF?.item
    ?? parsed.rdf?.item
    ?? parsed.feed?.entry;
  return asArray(items);
}

function dateInWindow(value, after, before) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) || date <= after || date > before ? null : date;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function discoverRssFeedItems(source, {
  after,
  before = new Date(),
  seenIds = new Set(),
  fetchImpl = fetch
}) {
  if (source?.active !== true) return [];
  if (source?.adapter !== 'rss-feed' || !isHttpsUrl(source.feedUrl)) {
    throw new Error('媒体源必须使用 HTTPS RSS feed');
  }
  const afterDate = new Date(after);
  const beforeDate = new Date(before);
  if (Number.isNaN(afterDate.valueOf()) || Number.isNaN(beforeDate.valueOf()) || afterDate >= beforeDate) {
    throw new Error('采集时间窗口无效');
  }

  const response = await fetchImpl(source.feedUrl, {
    headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`${source.mediaName} RSS 失败（HTTP ${response.status}）`);
  const document = await response.text();
  if (document.length > MAX_FEED_CHARACTERS) throw new Error(`${source.mediaName} RSS 超过大小限制`);

  const found = [];
  for (const item of feedItems(document)) {
    const originalUrl = itemLink(item);
    const publishedAt = dateInWindow(firstText(item, ['pubDate', 'date', 'published', 'updated']), afterDate, beforeDate);
    const originalTitle = decodeHtmlText(firstText(item, ['title']));
    if (!publishedAt || !isHttpsUrl(originalUrl) || !originalTitle) continue;

    const id = `${source.id}:${firstText(item, ['guid', 'id']) || originalUrl}`;
    if (seenIds.has(id) || seenIds.has(originalUrl)) continue;

    const description = decodeHtmlText(firstText(item, ['description', 'summary', 'content']));
    found.push({
      id,
      sourceId: source.id,
      mediaName: source.mediaName,
      mediaCountryOrRegion: source.mediaCountryOrRegion || '待编辑核验',
      reportedRegion: source.reportedRegion || '待编辑核验',
      originalTitle,
      author: firstText(item, ['creator', 'author']) || '作者待核验',
      publishedAt: publishedAt.toISOString(),
      originalUrl,
      contentType: source.defaultContentType || 'news',
      sourceDescription: description.slice(0, MAX_DESCRIPTION_CHARACTERS),
      rights: source.license,
      imagePolicy: 'omit',
      status: 'review_required'
    });
  }
  return found;
}