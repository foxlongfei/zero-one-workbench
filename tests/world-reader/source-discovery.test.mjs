import assert from 'node:assert/strict';
import test from 'node:test';
import { canAutomaticallyAdapt, discoverWordPressPosts } from '../../scripts/world-reader/source-discovery.mjs';

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