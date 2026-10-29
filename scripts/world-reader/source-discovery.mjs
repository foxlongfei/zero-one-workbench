const HTML_ENTITIES = Object.freeze({
  amp: '&',
  apos: "'",
  quot: '"',
  nbsp: ' ',
  lt: '<',
  gt: '>',
  '#8217': '’',
  '#8216': '‘',
  '#8220': '“',
  '#8221': '”',
  '#8211': '–',
  '#8212': '—',
  '#038': '&'
});

export function decodeHtmlText(value = '') {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
      const lower = name.toLowerCase();
      if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
      if (lower.startsWith('#') && /^#\d+$/.test(lower)) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
      return HTML_ENTITIES[lower] ?? entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function canAutomaticallyAdapt(source) {
  return source?.active === true
    && source?.license?.status === 'approved'
    && source.license.canTranslate === true
    && typeof source.license.name === 'string'
    && typeof source.license.checkedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(source.license.checkedAt)
    && isHttpsUrl(source.license.evidenceUrl)
    && source.imagePolicy === 'omit';
}

function sourceDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function inWindow(value, after, before) {
  const date = sourceDate(value);
  return date && date > after && date <= before;
}

function normalizePost(post, source, allowed) {
  const publishedAt = sourceDate(post.date_gmt || post.date);
  const link = post.link;
  if (!publishedAt || !isHttpsUrl(link) || !post.slug) return null;
  const item = {
    id: `${source.id}:${post.slug}`,
    sourceId: source.id,
    mediaName: source.mediaName,
    mediaCountryOrRegion: source.mediaCountryOrRegion,
    reportedRegion: source.reportedRegion || '待编辑核验',
    originalTitle: decodeHtmlText(post.title?.rendered || ''),
    author: post.author_name || (post._embedded?.author?.[0]?.name ?? '作者待核验'),
    publishedAt: publishedAt.toISOString(),
    originalUrl: link,
    contentType: source.defaultContentType || 'news',
    rights: source.license,
    imagePolicy: source.imagePolicy,
    status: allowed ? 'awaiting_summary' : 'review_required'
  };
  if (allowed) item.sourceContent = decodeHtmlText(post.content?.rendered || '');
  return item;
}

export async function discoverWordPressPosts(source, {
  after,
  before = new Date(),
  seenIds = new Set(),
  summarize,
  fetchImpl = fetch
}) {
  if (source?.active !== true) return [];
  if (source?.adapter !== 'wordpress-rest' || !isHttpsUrl(source.apiUrl)) {
    throw new Error('媒体源必须使用 HTTPS WordPress REST API');
  }
  const afterDate = sourceDate(after);
  const beforeDate = sourceDate(before);
  if (!afterDate || !beforeDate || afterDate >= beforeDate) throw new Error('采集时间窗口无效');

  const allowed = canAutomaticallyAdapt(source);
  const fields = allowed
    ? 'date,date_gmt,link,slug,title,author,content,_embedded'
    : 'date,date_gmt,link,slug,title,author,_embedded';
  const found = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = new URL(source.apiUrl);
    url.searchParams.set('after', afterDate.toISOString());
    url.searchParams.set('before', beforeDate.toISOString());
    url.searchParams.set('_fields', fields);
    url.searchParams.set('_embed', 'author');
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`${source.mediaName} API 失败（HTTP ${response.status}）`);
    const posts = await response.json();
    if (!Array.isArray(posts)) throw new Error(`${source.mediaName} API 返回格式无效`);
    const pageCount = Number(response.headers.get('X-WP-TotalPages'));
    if (Number.isFinite(pageCount) && pageCount > 0) totalPages = pageCount;
    for (const post of posts) {
      if (!inWindow(post.date_gmt || post.date, afterDate, beforeDate)) continue;
      const item = normalizePost(post, source, allowed);
      if (!item || seenIds.has(item.id) || seenIds.has(item.originalUrl)) continue;
      if (allowed) {
        if (typeof summarize !== 'function') {
          item.status = 'awaiting_ai_configuration';
        } else {
          const summary = await summarize({
            title: item.originalTitle,
            sourceText: item.sourceContent,
            sourceUrl: item.originalUrl,
            mediaName: item.mediaName
          });
          item.chineseTitle = summary.chineseTitle;
          item.chineseGuide = summary.chineseGuide;
          item.chineseContentType = 'ai_generated_summary';
          item.status = 'draft_ready';
        }
      }
      found.push(item);
    }
    page += 1;
  } while (page <= totalPages);
  return found;
}