import { createHash } from 'node:crypto';
import JSZip from '../../portal/vendor-jszip-3.10.1.min.js';
import { GoogleAuth } from 'google-auth-library';
import { DRIVE_CONTENT_SCOPE, DriveStorage } from './drive-storage.mjs';
import { validatePublicIndex } from './public-index.mjs';

const PUBLIC_BASE_URL = process.env.WORLD_READER_PUBLIC_BASE_URL;
const ISSUE_ID = process.env.WORLD_READER_ISSUE_ID;
const ROOT_ID = process.env.WORLD_READER_DRIVE_ROOT_ID;
const TEST_RECIPIENT = process.env.WORLD_READER_TEST_RECIPIENT;

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export function idempotencyKey(issueId, recipient) {
  return createHash('sha256').update(`${issueId}\n${recipient.toLowerCase()}`).digest('hex');
}

function publicUrl(base, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.startsWith('/') || relativePath.split('/').includes('..')) {
    throw new Error('刊物路径不安全');
  }
  const url = new URL(relativePath, base);
  if (url.origin !== new URL(base).origin) throw new Error('刊物链接必须在当前公开站点');
  return url.href;
}

export async function sendPublishedIssue({
  issue,
  publicBaseUrl,
  recipient,
  ledger,
  saveLedger,
  sendEmail,
  fetchImpl = fetch,
  now = new Date()
}) {
  if (issue?.status !== 'published' || !issue.title || !issue.emailSummary || !issue.sourceUrl) {
    throw new Error('仅包含完整公开信息的已发布期刊可发送邮件');
  }
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('测试收件人邮箱无效');
  const key = idempotencyKey(issue.id, recipient);
  const previous = ledger?.deliveries?.[key];
  if (previous?.status === 'sent') return { status: 'already_sent', idempotencyKey: key };
  if (previous?.status === 'sending' || previous?.status === 'delivery_unknown') {
    return { status: 'manual_reconciliation_required', idempotencyKey: key };
  }

  const pageUrl = publicUrl(publicBaseUrl, issue.pageUrl);
  const epubUrl = publicUrl(publicBaseUrl, issue.epubUrl);
  const [pageResponse, epubResponse] = await Promise.all([fetchImpl(pageUrl), fetchImpl(epubUrl)]);
  if (!pageResponse.ok) throw new Error(`公开页面尚未验证成功（HTTP ${pageResponse.status}）`);
  const pageHtml = await pageResponse.text();
  if (!pageHtml.includes(issue.title) || !pageHtml.includes(issue.sourceUrl)) throw new Error('公开页面缺少期刊标题或原文来源链接');
  if (!epubResponse.ok) throw new Error(`EPUB 下载尚未验证成功（HTTP ${epubResponse.status}）`);
  const archive = await JSZip.loadAsync(Buffer.from(await epubResponse.arrayBuffer()));
  if (await archive.file('mimetype')?.async('string') !== 'application/epub+zip') throw new Error('公开 EPUB 的 mimetype 无效');
  const packageXml = await archive.file('OEBPS/package.opf')?.async('string');
  if (!packageXml?.includes(issue.title)) throw new Error('公开 EPUB 标题或 OPF 校验失败');

  const attempt = {
    idempotencyKey: key,
    issueId: issue.id,
    recipient,
    status: 'sending',
    startedAt: now.toISOString(),
    pageUrl,
    epubUrl,
    kind: 'test'
  };
  const nextLedger = { deliveries: { ...(ledger?.deliveries || {}), [key]: attempt } };
  await saveLedger(nextLedger);

  const subject = issue.title;
  const html = `<main><h1>${htmlEscape(issue.title)}</h1><p>${htmlEscape(issue.emailSummary)}</p><p><a href="${htmlEscape(pageUrl)}">在线阅读本期</a></p><p><a href="${htmlEscape(epubUrl)}">下载 EPUB</a></p><p>来源：<a href="${htmlEscape(issue.sourceUrl)}">原始媒体文章</a></p></main>`;
  try {
    const result = await sendEmail({ recipient, subject, html, idempotencyKey: key });
    attempt.status = 'sent';
    attempt.providerMessageId = result.id;
    attempt.sentAt = now.toISOString();
    await saveLedger(nextLedger);
    return { status: 'sent', providerMessageId: result.id, idempotencyKey: key };
  } catch (error) {
    attempt.status = error.deliveryUnknown ? 'delivery_unknown' : 'failed';
    attempt.error = String(error.message || error).slice(0, 500);
    attempt.failedAt = now.toISOString();
    await saveLedger(nextLedger);
    throw error;
  }
}

async function main() {
  if (!PUBLIC_BASE_URL || !ISSUE_ID || !ROOT_ID || !TEST_RECIPIENT) {
    throw new Error('需要设置 WORLD_READER_PUBLIC_BASE_URL、WORLD_READER_ISSUE_ID、WORLD_READER_DRIVE_ROOT_ID 和授权测试邮箱');
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WORLD_READER_EMAIL_FROM;
  if (!apiKey || !from) throw new Error('缺少邮件服务 API Key 或已验证发件人地址');

  const response = await fetch(new URL('issues/index.json', PUBLIC_BASE_URL));
  if (!response.ok) throw new Error(`公网刊物索引尚未可访问（HTTP ${response.status}）`);
  const index = await response.json();
  const gateErrors = await validatePublicIndex(index);
  if (gateErrors.length) throw new Error(`本地公开刊物文件未通过校验：${gateErrors.join('；')}`);
  const issue = index.issues.find((item) => item.id === ISSUE_ID);
  if (!issue) throw new Error(`期刊 ${ISSUE_ID} 不在公网公开索引中`);

  const auth = new GoogleAuth({ scopes: [DRIVE_CONTENT_SCOPE] });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  const store = new DriveStorage({ accessToken: token });
  const folders = await store.getFolderMap(ROOT_ID, ['07-发布与邮件记录']);
  const logFolder = folders.get('07-发布与邮件记录');
  const ledgerName = `email-delivery-${ISSUE_ID}.json`;
  const ledger = await store.readJson(logFolder, ledgerName) || { deliveries: {} };

  const result = await sendPublishedIssue({
    issue,
    publicBaseUrl: PUBLIC_BASE_URL,
    recipient: TEST_RECIPIENT,
    ledger,
    saveLedger: (value) => store.writeJson(logFolder, ledgerName, value),
    sendEmail: async ({ recipient, subject, html, idempotencyKey: key }) => {
      let mailResponse;
      try {
        mailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
            'Idempotency-Key': key
          },
          body: JSON.stringify({ from, to: [recipient], subject, html })
        });
      } catch (error) {
        error.deliveryUnknown = true;
        throw error;
      }
      const body = await mailResponse.json().catch(() => ({}));
      if (!mailResponse.ok) {
        const error = new Error(`邮件服务拒绝请求（HTTP ${mailResponse.status}）：${body.message || 'provider error'}`);
        error.deliveryUnknown = mailResponse.status >= 500;
        throw error;
      }
      return body;
    }
  });
  console.log(JSON.stringify(result));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}