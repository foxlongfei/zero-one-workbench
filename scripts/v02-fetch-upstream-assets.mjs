import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('artifacts/v02-browser/upstream');
await mkdir(outputDir, { recursive: true });

async function download(url, fileName) {
  const response = await fetch(url, { headers: { 'user-agent': 'zero-one-workbench-v0.2-evidence/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(outputDir, fileName), bytes);
  return {
    fileName,
    sourceUrl: url,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

const manifest = {
  schema: 'zero-one.v02.upstream-assets.v1',
  fetchedAt: new Date().toISOString(),
  assets: [],
};

manifest.assets.push(await download(
  'https://wger.de/media/exercise-images/1554/49207a62-8799-4b47-8c0b-7bde02926f3d.png',
  'wger-clap-push-up-1554.png',
));

// Sheet 2 was identified from the first evidence capture as the measured first-floor plan.
// Re-fetch only the exact product inputs to avoid hammering Wikimedia's original-file edge.
for (const sheet of [2]) {
  const title = `File:Frederick Douglass House, 1411 W Street, Southeast, Washington, District of Columbia, DC HABS DC,WASH,166- (sheet ${sheet} of 8).png`;
  const query = new URL('https://commons.wikimedia.org/w/api.php');
  query.searchParams.set('action', 'query');
  query.searchParams.set('format', 'json');
  query.searchParams.set('prop', 'imageinfo');
  query.searchParams.set('iiprop', 'url|sha1|size|mime');
  query.searchParams.set('titles', title);
  const response = await fetch(query, { headers: { 'user-agent': 'zero-one-workbench-v0.2-evidence/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${query}`);
  const data = await response.json();
  const page = Object.values(data.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  if (!info?.url) throw new Error(`No imageinfo URL for ${title}`);
  const asset = await download(info.url, `habs-dc-97-sheet-${sheet}-of-8.png`);
  manifest.assets.push({
    ...asset,
    commonsTitle: title,
    commonsPageId: page.pageid,
    commonsSha1: info.sha1,
    width: info.width,
    height: info.height,
    mime: info.mime,
  });
}

await writeFile(
  path.join(outputDir, 'upstream-assets-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(JSON.stringify(manifest, null, 2));
