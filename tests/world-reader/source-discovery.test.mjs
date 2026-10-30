import assert from 'node:assert/strict';
import test from 'node:test';
import { canAutomaticallyAdapt, discoverWordPressPosts } from '../../scripts/world-reader/source-discovery.mjs';
import { discoverRssFeedItems } from '../../scripts/world-reader/rss-discovery.mjs';

const approvedSource = {
  id: 'globalvoices',
  active: true,
  mediaName: 'Global Voices',
  mediaCountryOrRegion: 'Global (headquarters region unverified)',
  adapter: 'wordpress-rest',
  apiUrl: 'https://globalvoices.org/wp-json/wp/v2/posts',
  defaultContentType: 'analysis',
  license: {
    status: 'approved',
    name: 'CC BY 3.0',
    canTranslate: true,
    evidenceUrl: 'https://creativecommons.org/licenses/by/3.0/',
    checkedAt: '2026-10-29'
  },
  imagePolicy: 'omit'
};

function response(posts) {
  return {
    ok: true,
    headers: new Headers({ 'X-WP-TotalPages': '1' }),
    json: async () => posts
  };
}

test('polls new WordPress articles, deduplicates, and labels machine summaries', async () => {
  let summaryCalls = 0;
  const posts = [
    { date_gmt: '2026-10-28T07:51:42', link: 'https://globalvoices.org/post/a/', slug: 'post-a', title: { rendered: 'New <em>story</em>' }, author: 4, content: { rendered: '<p>Licensed source text.</p>' } },
    { date_gmt: '2026-10-27T23:59:00', link: 'https://globalvoices.org/post/old/', slug: 'post-old', title: { rendered: 'Old story' }, content: { rendered: '<p>Old text</p>' } }
  ];
  const items = await discoverWordPressPosts(approvedSource, {
    after: '2026-10-28T00:00:00Z',
    before: '2026-10-29T00:00:00Z',
    seenIds: new Set(['globalvoices:post-seen']),
    fetchImpl: async () => response(posts),
    summarize: async ({ title, sourceText }) => {
      summaryCalls += 1;
      assert.equal(title, 'New story');
      assert.match(sourceText, /Licensed source text/);
      return { chineseTitle: '中文标题', chineseGuide: '机器生成摘要。' };
    }
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'draft_ready');
  assert.equal(items[0].chineseContentType, 'ai_generated_summary');
  assert.equal(items[0].editorialLine, 'deep');
  assert.equal(items[0].eventId, null);
  assert.equal(summaryCalls, 1);
});

test('does not request source body or call summarizer for unlicensed media', async () => {
  const restrictedSource = {
    ...approvedSource,
    license: { status: 'review_required', canTranslate: false, evidenceUrl: 'https://example.org/license', checkedAt: '2026-10-29' }
  };
  let requestedFields = '';
  let summaryCalls = 0;
  const items = await discoverWordPressPosts(restrictedSource, {
    after: '2026-10-28T00:00:00Z',
    before: '2026-10-29T00:00:00Z',
    fetchImpl: async (url) => {
      requestedFields = new URL(url).searchParams.get('_fields');
      return response([{ date: '2026-10-28T08:00:00', link: 'https://globalvoices.org/post/restricted/', slug: 'restricted', title: { rendered: 'Restricted story' } }]);
    },
    summarize: async () => { summaryCalls += 1; return {}; }
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'review_required');
  assert.equal(items[0].editorialLine, 'deep');
  assert.equal(items[0].eventId, null);
  assert.equal('sourceContent' in items[0], false);
  assert.equal(requestedFields.includes('content'), false);
  assert.equal(summaryCalls, 0);
});

test('requires a verified license, adaptation permission, and image omission policy', () => {
  assert.equal(canAutomaticallyAdapt(approvedSource), true);
  assert.equal(canAutomaticallyAdapt({ ...approvedSource, imagePolicy: 'copy' }), false);
  assert.equal(canAutomaticallyAdapt({ ...approvedSource, license: { ...approvedSource.license, status: 'unknown' } }), false);
});

test('does not request inactive sources', async () => {
  let requests = 0;
  const items = await discoverWordPressPosts({ ...approvedSource, active: false }, {
    after: '2026-10-28T00:00:00Z',
    before: '2026-10-29T00:00:00Z',
    fetchImpl: async () => { requests += 1; return response([]); }
  });
  assert.deepEqual(items, []);
  assert.equal(requests, 0);
});

test('deduplicates an article already seen through another media source', async () => {
  let summaryCalls = 0;
  const items = await discoverWordPressPosts(approvedSource, {
    after: '2026-10-28T00:00:00Z',
    before: '2026-10-29T00:00:00Z',
    seenIds: new Set(['https://globalvoices.org/post/a/']),
    fetchImpl: async () => response([{ date_gmt: '2026-10-28T07:51:42', link: 'https://globalvoices.org/post/a/', slug: 'post-a', title: { rendered: 'Known story' }, content: { rendered: 'Source' } }]),
    summarize: async () => { summaryCalls += 1; return {}; }
  });
  assert.deepEqual(items, []);
  assert.equal(summaryCalls, 0);
});

test('collects bounded RSS metadata and marks it for editorial review', async () => {
  const source = {
    id: 'bbc-world',
    active: true,
    mediaName: 'BBC News',
    mediaCountryOrRegion: 'United Kingdom',
    adapter: 'rss-feed',
    feedUrl: 'https://feeds.example.test/world.xml',
    license: { status: 'review_required', canTranslate: false }
  };
  const xml = `<rss version="2.0"><channel>
    <item><title>News &amp; Analysis</title><link>https://example.test/story</link><guid>story-1</guid><pubDate>Thu, 29 Oct 2026 20:00:00 GMT</pubDate><description><![CDATA[<p>A short report.</p>]]></description></item>
    <item><title>Old story</title><link>https://example.test/old</link><pubDate>Wed, 28 Oct 2026 20:00:00 GMT</pubDate></item>
    <item><title>Insecure link</title><link>http://example.test/insecure</link><pubDate>Thu, 29 Oct 2026 21:00:00 GMT</pubDate></item>
  </channel></rss>`;
  const items = await discoverRssFeedItems(source, {
    after: '2026-10-29T00:00:00Z',
    before: '2026-10-30T00:00:00Z',
    fetchImpl: async () => new Response(xml)
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].originalTitle, 'News & Analysis');
  assert.equal(items[0].status, 'review_required');
  assert.equal(items[0].editorialLine, 'news');
  assert.equal(items[0].eventId, null);
  assert.equal(items[0].sourceDescription, 'A short report.');
  assert.equal('sourceContent' in items[0], false);
});

test('parses RDF date metadata and deduplicates by source URL', async () => {
  const source = {
    id: 'dw-world',
    active: true,
    mediaName: 'DW',
    adapter: 'rss-feed',
    feedUrl: 'https://feeds.example.test/world.rdf',
    license: { status: 'review_required', canTranslate: false }
  };
  const xml = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
    <item rdf:about="https://example.test/story"><title>RDF story</title><link>https://example.test/story</link><dc:date>2026-10-29T20:34:00Z</dc:date><dc:creator>DW News</dc:creator></item>
  </rdf:RDF>`;
  const items = await discoverRssFeedItems(source, {
    after: '2026-10-29T00:00:00Z',
    before: '2026-10-30T00:00:00Z',
    fetchImpl: async () => new Response(xml)
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].publishedAt, '2026-10-29T20:34:00.000Z');
  assert.equal(items[0].author, 'DW News');
  const duplicates = await discoverRssFeedItems(source, {
    after: '2026-10-29T00:00:00Z',
    before: '2026-10-30T00:00:00Z',
    seenIds: new Set(['https://example.test/story']),
    fetchImpl: async () => new Response(xml)
  });
  assert.deepEqual(duplicates, []);
});

test('rejects insecure RSS endpoints', async () => {
  await assert.rejects(discoverRssFeedItems({
    id: 'unsafe', active: true, adapter: 'rss-feed', feedUrl: 'http://example.test/feed'
  }, { after: '2026-10-29T00:00:00Z', before: '2026-10-30T00:00:00Z' }), /HTTPS RSS/);
});

test('rejects sources outside the two editorial lines', async () => {
  await assert.rejects(discoverRssFeedItems({
    id: 'invalid-line',
    active: true,
    adapter: 'rss-feed',
    feedUrl: 'https://example.test/feed',
    editorialLine: 'mixed'
  }, { after: '2026-10-29T00:00:00Z', before: '2026-10-30T00:00:00Z' }), /新闻线或深度线/);
});