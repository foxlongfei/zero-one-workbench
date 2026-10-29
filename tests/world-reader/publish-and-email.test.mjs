import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from '../../portal/vendor-jszip-3.10.1.min.js';
import { idempotencyKey, sendPublishedIssue } from '../../scripts/world-reader/publish-and-email.mjs';

const issue = {
  id: 'world-reader-2026-10-28',
  status: 'published',
  title: '听世界 · 世界读本：2026-10-28 试刊',
  emailSummary: 'Global Voices 对孟加拉国网络法草案的报道。',
  sourceUrl: 'https://globalvoices.org/2026/10/28/story/',
  pageUrl: 'issues/world-reader-2026-10-28/index.html',
  epubUrl: 'issues/world-reader-2026-10-28/issue.epub'
};

async function epubBuffer() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('OEBPS/package.opf', `<package>${issue.title}</package>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

function deliveryFetch({ pageStatus = 200, epubStatus = 200, page = null, epub = null } = {}) {
  return async (url) => {
    if (String(url).endsWith('.epub')) {
      return new Response(epub || await epubBuffer(), { status: epubStatus });
    }
    return new Response(page || `<title>${issue.title}</title><a href="${issue.sourceUrl}">source</a>`, { status: pageStatus });
  };
}

test('does not send until both the public page and EPUB validate', async () => {
  let sent = false;
  await assert.rejects(sendPublishedIssue({
    issue,
    publicBaseUrl: 'https://example.test/portal/world-reader/',
    recipient: 'test@example.test',
    ledger: { deliveries: {} },
    saveLedger: async () => {},
    sendEmail: async () => { sent = true; },
    fetchImpl: deliveryFetch({ pageStatus: 404 })
  }), /公开页面尚未验证成功/);
  assert.equal(sent, false);
});

test('sends once after verification and skips duplicate deliveries', async () => {
  let ledger = { deliveries: {} };
  let sendCount = 0;
  const options = {
    issue,
    publicBaseUrl: 'https://example.test/portal/world-reader/',
    recipient: 'test@example.test',
    fetchImpl: deliveryFetch(),
    ledger,
    saveLedger: async (value) => { ledger = value; },
    sendEmail: async ({ idempotencyKey }) => {
      sendCount += 1;
      assert.equal(idempotencyKey, Object.keys(ledger.deliveries)[0]);
      return { id: 'mail-1' };
    }
  };
  const sent = await sendPublishedIssue(options);
  assert.equal(sent.status, 'sent');
  assert.equal(ledger.deliveries[sent.idempotencyKey].status, 'sent');
  const duplicate = await sendPublishedIssue({ ...options, ledger });
  assert.equal(duplicate.status, 'already_sent');
  assert.equal(sendCount, 1);
});

test('does not retry an ambiguous in-flight delivery automatically', async () => {
  let sent = false;
  const result = await sendPublishedIssue({
    issue,
    publicBaseUrl: 'https://example.test/portal/world-reader/',
    recipient: 'test@example.test',
    ledger: { deliveries: { [idempotencyKey(issue.id, 'test@example.test')]: { status: 'delivery_unknown' } } },
    saveLedger: async () => {},
    sendEmail: async () => { sent = true; },
    fetchImpl: deliveryFetch()
  });
  assert.equal(result.status, 'manual_reconciliation_required');
  assert.equal(sent, false);
});

test('requires a same-site EPUB URL and valid source link', async () => {
  await assert.rejects(sendPublishedIssue({
    issue: { ...issue, epubUrl: 'https://attacker.example/file.epub' },
    publicBaseUrl: 'https://example.test/portal/world-reader/',
    recipient: 'test@example.test',
    ledger: { deliveries: {} },
    saveLedger: async () => {},
    sendEmail: async () => {},
    fetchImpl: deliveryFetch()
  }), /当前公开站点/);
});