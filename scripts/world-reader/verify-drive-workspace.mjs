import { GoogleAuth } from 'google-auth-library';
import { DRIVE_SCOPE, verifyDriveWorkspace } from './drive-workspace.mjs';

const rootFolderId = process.env.WORLD_READER_DRIVE_ROOT_ID;

try {
  if (!rootFolderId) throw new Error('请设置 WORLD_READER_DRIVE_ROOT_ID');
  const auth = new GoogleAuth({ scopes: [DRIVE_SCOPE] });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  const result = await verifyDriveWorkspace({ rootFolderId, accessToken: token });
  console.log(`Drive 主目录：${result.rootName}`);
  console.log(`已找到 ${result.foundCount}/${result.expectedCount} 个必需子目录`);
  if (result.missing.length) console.error(`缺失或重复：${result.missing.join('、')}`);
  if (!result.complete) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}