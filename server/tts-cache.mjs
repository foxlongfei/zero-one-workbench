// Content-addressed cache for synthesized narration.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';

// Each cached WAV keeps a sidecar `.json` naming the engine that produced it, so
// revoking a family voice can delete everything synthesized under that consent.
export class AudioCache {
  constructor(dir, { maxBytes = 512 * 1024 * 1024 } = {}) {
    this.dir = dir;
    this.maxBytes = maxBytes;
  }

  async init() {
    await mkdir(this.dir, { recursive: true });
  }

  static key({ engine, voice, speed, text }) {
    return createHash('sha256')
      .update([engine, voice, String(speed), text].join('\u0000'))
      .digest('hex')
      .slice(0, 40);
  }

  path(key) {
    return join(this.dir, `${key}.wav`);
  }

  async get(key) {
    try {
      return await readFile(this.path(key));
    } catch {
      return null;
    }
  }

  async set(key, buffer, { engine = 'native', voice = 'system' } = {}) {
    await writeFile(this.path(key), buffer);
    await writeFile(join(this.dir, `${key}.json`), JSON.stringify({ engine, voice, at: Date.now() }));
    await this.evictIfNeeded();
  }

  async purgeVoice(voiceId) {
    let names;
    try {
      names = await readdir(this.dir);
    } catch {
      return;
    }
    let removed = 0;
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      let meta;
      try {
        meta = JSON.parse(await readFile(join(this.dir, name), 'utf8'));
      } catch {
        continue;
      }
      if (meta.voice !== voiceId) continue;
      const base = name.slice(0, -'.json'.length);
      await unlink(join(this.dir, `${base}.wav`)).catch(() => {});
      await unlink(join(this.dir, name)).catch(() => {});
      removed++;
    }
    return removed;
  }

  async evictIfNeeded() {
    let names;
    try {
      names = await readdir(this.dir);
    } catch {
      return;
    }
    const stats = [];
    let total = 0;
    for (const name of names) {
      if (!name.endsWith('.wav')) continue;
      try {
        const info = await stat(join(this.dir, name));
        total += info.size;
        stats.push({ name, size: info.size, mtime: info.mtimeMs });
      } catch {}
    }
    if (total <= this.maxBytes) return;
    stats.sort((a, b) => a.mtime - b.mtime);
    for (const entry of stats) {
      if (total <= this.maxBytes) break;
      await unlink(join(this.dir, entry.name)).catch(() => {});
      await unlink(join(this.dir, `${entry.name.slice(0, -'.wav'.length)}.json`)).catch(() => {});
      total -= entry.size;
    }
  }
}
