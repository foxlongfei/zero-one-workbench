const API_ROOT = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_ROOT = 'https://www.googleapis.com/upload/drive/v3/files';

export const DRIVE_CONTENT_SCOPE = 'https://www.googleapis.com/auth/drive';

function escapeQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export class DriveStorage {
  constructor({ accessToken, fetchImpl = fetch }) {
    if (!accessToken) throw new Error('缺少 Google Drive 访问令牌');
    this.accessToken = accessToken;
    this.fetchImpl = fetchImpl;
  }

  async request(url, options = {}) {
    const response = await this.fetchImpl(url, {
      ...options,
      headers: {
        authorization: `Bearer ${this.accessToken}`,
        ...options.headers
      }
    });
    if (!response.ok) throw new Error(`Drive API 请求失败（HTTP ${response.status}）`);
    return response;
  }

  async listChildren(parentId) {
    const entries = [];
    let pageToken;
    do {
      const url = new URL(API_ROOT);
      url.searchParams.set('q', `'${parentId}' in parents and trashed = false`);
      url.searchParams.set('spaces', 'drive');
      url.searchParams.set('pageSize', '1000');
      url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType)');
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const result = await (await this.request(url)).json();
      entries.push(...(result.files || []));
      pageToken = result.nextPageToken;
    } while (pageToken);
    return entries;
  }

  async getFolderMap(rootId, expectedNames) {
    const entries = await this.listChildren(rootId);
    const folders = entries.filter((entry) => entry.mimeType === 'application/vnd.google-apps.folder');
    const result = new Map();
    for (const name of expectedNames) {
      const matches = folders.filter((entry) => entry.name === name);
      if (matches.length !== 1) throw new Error(`Drive 子目录“${name}”应唯一存在，实际找到 ${matches.length} 个`);
      result.set(name, matches[0].id);
    }
    return result;
  }

  async findByName(parentId, name) {
    const matches = (await this.listChildren(parentId)).filter((entry) => entry.name === name);
    if (matches.length > 1) throw new Error(`Drive 中存在重复文件“${name}”，停止写入以避免覆盖错误资料`);
    return matches[0] || null;
  }

  async readJson(parentId, name) {
    const file = await this.findByName(parentId, name);
    if (!file) return null;
    const url = new URL(`${API_ROOT}/${encodeURIComponent(file.id)}`);
    url.searchParams.set('alt', 'media');
    url.searchParams.set('supportsAllDrives', 'true');
    return JSON.parse(await (await this.request(url)).text());
  }

  async writeJson(parentId, name, value) {
    const existing = await this.findByName(parentId, name);
    const content = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    if (existing) {
      const url = new URL(`${UPLOAD_ROOT}/${encodeURIComponent(existing.id)}`);
      url.searchParams.set('uploadType', 'media');
      url.searchParams.set('supportsAllDrives', 'true');
      await this.request(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: content
      });
      return existing.id;
    }

    const boundary = `worldReader${Date.now().toString(16)}`;
    const metadata = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType: 'application/json', parents: [parentId] })}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`);
    const ending = Buffer.from(`\r\n--${boundary}--`);
    const url = new URL(UPLOAD_ROOT);
    url.searchParams.set('uploadType', 'multipart');
    url.searchParams.set('supportsAllDrives', 'true');
    const created = await (await this.request(url, {
      method: 'POST',
      headers: { 'content-type': `multipart/related; boundary=${boundary}` },
      body: Buffer.concat([metadata, content, ending])
    })).json();
    return created.id;
  }

  async readText(parentId, name) {
    const file = await this.findByName(parentId, name);
    if (!file) return null;
    const url = new URL(`${API_ROOT}/${encodeURIComponent(file.id)}`);
    url.searchParams.set('alt', 'media');
    url.searchParams.set('supportsAllDrives', 'true');
    return (await this.request(url)).text();
  }

  async writeBuffer(parentId, name, mimeType, content) {
    const existing = await this.findByName(parentId, name);
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (existing) {
      const url = new URL(`${UPLOAD_ROOT}/${encodeURIComponent(existing.id)}`);
      url.searchParams.set('uploadType', 'media');
      url.searchParams.set('supportsAllDrives', 'true');
      await this.request(url, {
        method: 'PATCH',
        headers: { 'content-type': mimeType },
        body: bytes
      });
      return existing.id;
    }

    const boundary = `worldReader${Date.now().toString(16)}`;
    const metadata = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType, parents: [parentId] })}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
    const ending = Buffer.from(`\r\n--${boundary}--`);
    const url = new URL(UPLOAD_ROOT);
    url.searchParams.set('uploadType', 'multipart');
    url.searchParams.set('supportsAllDrives', 'true');
    const created = await (await this.request(url, {
      method: 'POST',
      headers: { 'content-type': `multipart/related; boundary=${boundary}` },
      body: Buffer.concat([metadata, bytes, ending])
    })).json();
    return created.id;
  }
}