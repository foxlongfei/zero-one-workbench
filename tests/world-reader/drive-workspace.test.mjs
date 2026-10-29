import assert from 'node:assert/strict';
import test from 'node:test';
import { DRIVE_SCOPE, DRIVE_FOLDER_MIME, REQUIRED_FOLDERS, verifyDriveWorkspace } from '../../scripts/world-reader/drive-workspace.mjs';

function mockFetch({ folders = REQUIRED_FOLDERS, rootMimeType = DRIVE_FOLDER_MIME } = {}) {
  const requests = [];
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    requests.push({ url, options });
    if (url.pathname.endsWith('/root-folder-id')) {
      return Response.json({ id: 'root-folder-id', name: '听世界 · 世界读本', mimeType: rootMimeType });
    }
    return Response.json({
      files: folders.map((name, index) => ({
        id: `child-${index}`,
        name,
        mimeType: DRIVE_FOLDER_MIME
      }))
    });
  };
  return { fetchImpl, requests };
}

test('requires a valid folder id and an authorized token', async () => {
  await assert.rejects(verifyDriveWorkspace({ rootFolderId: '', accessToken: 'token' }), /folder ID/);
  await assert.rejects(verifyDriveWorkspace({ rootFolderId: 'root-folder-id' }), /访问令牌/);
});

test('checks the existing eight folders using read-only metadata scope', async () => {
  const { fetchImpl, requests } = mockFetch();
  const result = await verifyDriveWorkspace({
    rootFolderId: 'root-folder-id',
    accessToken: 'test-token',
    fetchImpl
  });
  assert.equal(result.complete, true);
  assert.equal(result.foundCount, 8);
  assert.equal(result.rootName, '听世界 · 世界读本');
  assert.equal(DRIVE_SCOPE, 'https://www.googleapis.com/auth/drive.metadata.readonly');
  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ options }) => options.method === undefined));
});

test('reports missing expected directories without attempting to create them', async () => {
  const folders = REQUIRED_FOLDERS.slice(0, 7);
  const { fetchImpl, requests } = mockFetch({ folders });
  const result = await verifyDriveWorkspace({
    rootFolderId: 'root-folder-id',
    accessToken: 'test-token',
    fetchImpl
  });
  assert.equal(result.complete, false);
  assert.deepEqual(result.missing, ['07-发布与邮件记录']);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ options }) => options.method === undefined));
});

test('rejects a root item that is not a Drive folder', async () => {
  const { fetchImpl } = mockFetch({ rootMimeType: 'text/plain' });
  await assert.rejects(verifyDriveWorkspace({
    rootFolderId: 'root-folder-id',
    accessToken: 'test-token',
    fetchImpl
  }), /不是文件夹/);
});