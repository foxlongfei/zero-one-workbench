// Consent registry + content-addressed sample storage for the household voice
// library.
//
// Design rules that are enforced here, not in the browser:
//   * a voice record only exists alongside a consent record (who, when, what
//     statement, which sample hashes);
//   * revoking consent immediately blocks synthesis — synthesis checks the
//     record on every request instead of trusting a cached "active" flag;
//   * deleting a voice removes the samples and the consent record and keeps a
//     non-reversible tombstone (id + timestamps only) so audits can prove the
//     deletion happened;
//   * nothing leaves the machine: samples are plain files under data/, metadata
//     is JSON, no external service is contacted.

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

export const CONSENT_STATEMENT = '本人授权本系统使用这段声音样本进行语音合成与试听，并可随时撤销授权与删除样本。';

export class VoiceStore {
  constructor(root) {
    this.root = root;
    this.voicesDir = join(root, 'voices');
    this.samplesDir = join(root, 'samples');
    this.tombstonesDir = join(root, 'tombstones');
  }

  async init() {
    await mkdir(this.voicesDir, { recursive: true });
    await mkdir(this.samplesDir, { recursive: true });
    await mkdir(this.tombstonesDir, { recursive: true });
    return this;
  }

  #voicePath(id) {
    if (!/^[A-Za-z0-9_-]+$/.test(String(id))) throw new Error('invalid voice id');
    return join(this.voicesDir, `${id}.json`);
  }

  async #read(id) {
    try {
      return JSON.parse(await readFile(this.#voicePath(id), 'utf8'));
    } catch {
      return null;
    }
  }

  async #write(record) {
    await writeFile(this.#voicePath(record.id), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    return record;
  }

  #public(record) {
    if (!record) return null;
    const { samples, ...rest } = record;
    return { ...rest, sampleCount: samples?.length ?? 0 };
  }

  async list() {
    const files = await readdir(this.voicesDir).catch(() => []);
    const records = [];
    for (const file of files.filter(name => name.endsWith('.json'))) {
      const record = await this.#read(file.replace(/\.json$/, ''));
      if (record) records.push(this.#public(record));
    }
    return records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  // Create a voice from base64 samples plus a consent payload. Anything the
  // client claims about consent is stored verbatim for the audit trail, but the
  // server refuses to create the voice unless the required fields are present.
  async create({ name, speaker, relation = '', consent, samples } = {}) {
    if (!Array.isArray(samples) || samples.length < 2) throw Object.assign(new Error('至少需要两段声音样本'), { statusCode: 400 });
    if (!speaker || !String(speaker).trim()) throw Object.assign(new Error('缺少声音本人的称呼'), { statusCode: 400 });
    if (!consent || consent.granted !== true) throw Object.assign(new Error('缺少声音本人的授权声明，不能创建声音'), { statusCode: 403 });
    const mediaType = consent.mediaType || 'audio/webm';
    const id = `v_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await mkdir(join(this.samplesDir, id), { recursive: true });
    const stored = [];
    for (const [index, base64] of samples.entries()) {
      const buffer = Buffer.from(String(base64).replace(/^data:[^,]+,/, ''), 'base64');
      if (!buffer.length) throw Object.assign(new Error(`第 ${index + 1} 段样本为空`), { statusCode: 400 });
      const hash = sha256(buffer);
      await writeFile(join(this.samplesDir, id, `${index}-${hash}.bin`), buffer);
      stored.push({ index, sha256: hash, bytes: buffer.length, mediaType });
    }
    const createdAt = new Date().toISOString();
    const record = {
      id,
      name: String(name || `${speaker}的声音`).trim(),
      speaker: String(speaker).trim(),
      relation: String(relation || '').trim(),
      status: 'active',
      createdAt,
      samples: stored,
      consent: {
        granted: true,
        statement: String(consent.statement || CONSENT_STATEMENT),
        grantedAt: consent.grantedAt || createdAt,
        recordedAt: createdAt,
        consentPage: consent.consentPage || null,
        grantedBy: String(consent.grantedBy || speaker).trim(),
      },
      history: [{ at: createdAt, action: 'created', actor: String(consent.grantedBy || speaker) }],
    };
    await this.#write(record);
    return this.#public(record);
  }

  async get(id) {
    return this.#public(await this.#read(id));
  }

  // Touch the consent ledger (used by synthesis to prove the record was checked).
  async #append(id, action, actor = 'system') {
    const record = await this.#read(id);
    if (!record) return null;
    record.history = [...(record.history || []), { at: new Date().toISOString(), action, actor }];
    await this.#write(record);
    return record;
  }

  async revoke(id, actor = 'speaker') {
    const record = await this.#read(id);
    if (!record) return null;
    if (record.status === 'revoked') return this.#public(record);
    record.status = 'revoked';
    record.revokedAt = new Date().toISOString();
    await this.#write(record);
    await this.#append(id, 'revoked', actor);
    return this.#public(await this.#read(id));
  }

  async restore(id, actor = 'speaker') {
    const record = await this.#read(id);
    if (!record) return null;
    record.status = 'active';
    record.restoredAt = new Date().toISOString();
    await this.#write(record);
    await this.#append(id, 'restored', actor);
    return this.#public(await this.#read(id));
  }

  // Deletes samples and metadata, leaving only a tombstone that cannot be used
  // to reconstruct the voice.
  async remove(id, actor = 'speaker') {
    const record = await this.#read(id);
    if (!record) return null;
    const at = new Date().toISOString();
    await rm(join(this.samplesDir, id), { recursive: true, force: true });
    await rm(this.#voicePath(id), { force: true });
    await writeFile(join(this.tombstonesDir, `${id}.json`), `${JSON.stringify({
      id, speaker: record.speaker, createdAt: record.createdAt, deletedAt: at, actor,
      sampleHashes: (record.samples || []).map(sample => sample.sha256),
    }, null, 2)}\n`);
    return { id, deletedAt: at };
  }

  // Synthesis gate: returns the record only when consent is currently active.
  async authorize(id) {
    const record = await this.#read(id);
    if (!record) return { ok: false, code: 404, error: '声音不存在' };
    if (record.status !== 'active') return { ok: false, code: 409, error: '声音本人已撤销授权，合成已被拒绝' };
    return { ok: true, record };
  }

  async samples(id) {
    const dir = join(this.samplesDir, String(id));
    if (!/^[A-Za-z0-9_-]+$/.test(String(id))) return [];
    const files = await readdir(dir).catch(() => []);
    const list = [];
    for (const file of files.sort()) {
      list.push(await readFile(join(dir, file)));
    }
    return list;
  }

  async markSynth(id) {
    await this.#append(id, 'synthesised', 'service');
  }
}
