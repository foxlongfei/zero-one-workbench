export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

export const REQUIRED_FOLDERS = Object.freeze([
  '00-项目规范',
  '01-媒体来源',
  '02-文章与原文',
  '03-图片与版权',
  '04-中文编辑稿',
  '05-每日刊物',
  '06-EPUB归档',
  '07-发布与邮件记录'
]);

const API_ROOT = 'https://www.googleapis.com/drive/v3/files';

function assertFolderId(folderId) {
  if (typeof folderId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(folderId)) {
    throw new Error('Drive folder ID 缺失或格式无效');
  }
}

async function driveRequest(url, accessToken, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    throw new Error(`Drive API 请求失败（HTTP ${response.status}）；请确认 OAuth 授权和文件夹共享权限`);
  }
  return response.json();
}

async function getFile(folderId, accessToken, fetchImpl) {
  const url = new URL(`${API_ROOT}/${encodeURIComponent(folderId)}`);
  url.searchParams.set('fields', 'id,name,mimeType');
  url.searchParams.set('supportsAllDrives', 'true');
  return driveRequest(url, accessToken, fetchImpl);
}

async function listChildren(folderId, accessToken, fetchImpl) {
  const entries = [];
  let pageToken;
  do {
    const url = new URL(API_ROOT);
    url.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
    url.searchParams.set('spaces', 'drive');
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType)');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const result = await driveRequest(url, accessToken, fetchImpl);
    entries.push(...(result.files || []));
    pageToken = result.nextPageToken;
  } while (pageToken);
  return entries;
}

export async function verifyDriveWorkspace({ rootFolderId, accessToken, fetchImpl = fetch }) {
  assertFolderId(rootFolderId);
  if (!accessToken) throw new Error('缺少 Google ADC 访问令牌；请先完成 gcloud application-default login');

  const root = await getFile(rootFolderId, accessToken, fetchImpl);
  if (root.mimeType !== DRIVE_FOLDER_MIME) throw new Error('指定的 Drive 主目录不存在或不是文件夹');

  const children = await listChildren(rootFolderId, accessToken, fetchImpl);
  const folders = children.filter((entry) => entry.mimeType === DRIVE_FOLDER_MIME);
  const counts = new Map();
  for (const folder of folders) counts.set(folder.name, (counts.get(folder.name) || 0) + 1);

  const missing = REQUIRED_FOLDERS.filter((name) => counts.get(name) !== 1);
  const unexpectedDuplicates = REQUIRED_FOLDERS.filter((name) => counts.get(name) > 1);
  return {
    rootName: root.name,
    expectedCount: REQUIRED_FOLDERS.length,
    foundCount: REQUIRED_FOLDERS.length - missing.length,
    missing,
    duplicates: unexpectedDuplicates,
    complete: missing.length === 0
  };
}