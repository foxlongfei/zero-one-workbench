import { readFileSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';
import { DRIVE_CONTENT_SCOPE, DriveStorage } from './drive-storage.mjs';
import { createSummaryClient } from './ai-summary.mjs';
import { discoverWordPressPosts } from './source-discovery.mjs';
import { discoverRssFeedItems } from './rss-discovery.mjs';
import { REQUIRED_FOLDERS, verifyDriveWorkspace } from './drive-workspace.mjs';

const rootFolderId = process.env.WORLD_READER_DRIVE_ROOT_ID;
const now = new Date();

function safeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

async function main() {
  if (!rootFolderId) throw new Error('请设置 WORLD_READER_DRIVE_ROOT_ID');
  const auth = new GoogleAuth({ scopes: [DRIVE_CONTENT_SCOPE] });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  const store = new DriveStorage({ accessToken: token });

  const workspaceCheck = await verifyDriveWorkspace({ rootFolderId, accessToken: token });
  if (!workspaceCheck.complete) throw new Error(`Drive 工作目录核验失败：${workspaceCheck.missing.join('、')}`);
  const folders = await store.getFolderMap(rootFolderId, REQUIRED_FOLDERS);
  const sourcesFolder = folders.get('01-媒体来源');
  const articlesFolder = folders.get('02-文章与原文');
  const draftsFolder = folders.get('04-中文编辑稿');
  const recordsFolder = folders.get('07-发布与邮件记录');

  const catalog = await store.readJson(sourcesFolder, 'media-sources.json');
  if (!Array.isArray(catalog?.sources)) throw new Error('请先将 media-sources.template.json 审核后上传为 Drive/01-媒体来源/media-sources.json');
  const templateCatalog = JSON.parse(readFileSync(new URL('./media-sources.template.json', import.meta.url), 'utf8'));
  const sourcesById = new Map((templateCatalog.sources || [])
    .filter((source) => source.active === true && source.adapter === 'rss-feed' && source.id)
    .map((source) => [source.id, source]));
  for (const source of catalog.sources) {
    if (source.id) sourcesById.set(source.id, source);
  }
  const sources = [...sourcesById.values()];

  const previous = await store.readJson(recordsFolder, 'source-discovery-state.json') || {
    lastCheckedAt: new Date(now.valueOf() - 24 * 60 * 60 * 1000).toISOString(),
    seenIds: []
  };
  const seenIds = new Set(previous.seenIds || []);
  const from = new Date(previous.lastCheckedAt);
  if (Number.isNaN(from.valueOf()) || from >= now) throw new Error('Drive 采集游标无效');

  const summarize = process.env.WORLD_READER_AI_API_BASE
    && process.env.WORLD_READER_AI_API_KEY
    && process.env.WORLD_READER_AI_MODEL
    ? createSummaryClient({
      apiBase: process.env.WORLD_READER_AI_API_BASE,
      apiKey: process.env.WORLD_READER_AI_API_KEY,
      model: process.env.WORLD_READER_AI_MODEL
    })
    : undefined;

  const results = [];
  let awaitingAi = false;
  for (const source of sources) {
    if (!['wordpress-rest', 'rss-feed'].includes(source.adapter)) {
      results.push({ sourceId: source.id, outcome: 'unsupported_adapter' });
      continue;
    }
    const items = source.adapter === 'wordpress-rest'
      ? await discoverWordPressPosts(source, { after: from, before: now, seenIds, summarize })
      : await discoverRssFeedItems(source, { after: from, before: now, seenIds });
    for (const item of items) {
      const fileKey = safeName(item.id);
      const sourceRecord = {
        ...item,
        archivedAt: now.toISOString(),
        sourceSnapshot: item.rights?.status === 'approved' ? item.sourceContent : undefined
      };
      delete sourceRecord.sourceContent;
      await store.writeJson(articlesFolder, `${fileKey}.json`, sourceRecord);

      if (item.status === 'awaiting_ai_configuration') {
        awaitingAi = true;
        seenIds.delete(item.id);
        seenIds.delete(item.originalUrl);
        results.push({ sourceId: source.id, articleId: item.id, outcome: item.status });
        continue;
      }
      if (item.status === 'draft_ready') {
        const draft = { ...item, sourceContent: undefined, draftedAt: now.toISOString() };
        await store.writeJson(draftsFolder, `${fileKey}.json`, draft);
      }
      seenIds.add(item.id);
      seenIds.add(item.originalUrl);
      results.push({ sourceId: source.id, articleId: item.id, outcome: item.status });
    }
  }

  const runRecord = {
    runId: now.toISOString(),
    action: 'daily-source-discovery',
    recordKind: 'automated',
    window: { from: from.toISOString(), to: now.toISOString() },
    sourceCount: sources.length,
    rssSourceCount: sources.filter((source) => source.adapter === 'rss-feed').length,
    discoveredCount: results.length,
    outcomes: results,
    aiConfigured: Boolean(summarize),
    publicationStatus: 'not-published',
    emailStatus: 'not-sent'
  };
  await store.writeJson(recordsFolder, `source-discovery-${now.toISOString().replace(/[:.]/g, '-')}.json`, runRecord);
  await store.writeJson(recordsFolder, 'source-discovery-state.json', {
    lastCheckedAt: awaitingAi ? from.toISOString() : now.toISOString(),
    seenIds: [...seenIds]
  });
  console.log(JSON.stringify({ discoveredCount: results.length, aiConfigured: Boolean(summarize), awaitingAi }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});