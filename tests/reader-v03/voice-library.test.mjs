// Consent + synthesis tests for server/voice-library.
// Run with: node --test "tests/reader-v03/*.test.mjs"

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createVoiceLibrary } from '../../server/voice-library/server.mjs';
import { synthesizeSpeech } from '../../server/voice-library/synth.mjs';

const sample = seed => Buffer.from(`fake-audio-${seed}`.repeat(40)).toString('base64');

async function startLibrary(env = {}) {
  const root = await mkdtemp(join(tmpdir(), 'voice-library-'));
  const server = createVoiceLibrary({ root, env });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    root,
    async close() {
      await new Promise(resolve => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    },
  };
}

const json = (url, options = {}) => fetch(url, {
  ...options,
  headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  body: options.body ? JSON.stringify(options.body) : undefined,
});

test('synthesiser produces a decodable, non-silent WAV', () => {
  const wav = synthesizeSpeech('你好，我们一起读书。', { sampleRate: 8000 });
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
  assert.equal(wav.subarray(8, 12).toString(), 'WAVE');
  assert.ok(wav.length > 8000, 'has audio');
  let peak = 0;
  for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
  assert.ok(peak > 1000, `peak ${peak}`);
});

test('a voice cannot be created without the speaker consent', async () => {
  const lib = await startLibrary();
  try {
    const response = await json(`${lib.base}/api/voices`, {
      method: 'POST',
      body: { name: '妈妈的声音', speaker: '妈妈', samples: [sample('a'), sample('b')] },
    });
    assert.equal(response.status, 403);
    const missingSpeaker = await json(`${lib.base}/api/voices`, {
      method: 'POST',
      body: { name: 'x', consent: { granted: true }, samples: [sample('a'), sample('b')] },
    });
    assert.equal(missingSpeaker.status, 400);
    const tooFew = await json(`${lib.base}/api/voices`, {
      method: 'POST',
      body: { name: 'x', speaker: '妈妈', consent: { granted: true }, samples: [sample('a')] },
    });
    assert.equal(tooFew.status, 400);
    assert.deepEqual((await (await fetch(`${lib.base}/api/voices`)).json()).voices, []);
  } finally {
    await lib.close();
  }
});

test('consented voice speaks, revoke blocks immediately, restore re-enables', async () => {
  const lib = await startLibrary();
  try {
    const created = await json(`${lib.base}/api/voices`, {
      method: 'POST',
      body: {
        name: '妈妈的声音', speaker: '妈妈', relation: '妈妈',
        consent: { granted: true, grantedAt: '2026-10-24T10:00:00.000Z', grantedBy: '妈妈' },
        samples: [sample('a'), sample('b'), sample('c')],
      },
    });
    assert.equal(created.status, 201);
    const voice = await created.json();
    assert.equal(voice.status, 'active');
    assert.equal(voice.sampleCount, 3);
    assert.equal(voice.samples, undefined, 'sample paths are never exposed');
    assert.match(voice.consent.statement, /授权/);

    const speech = await json(`${lib.base}/api/speak`, { method: 'POST', body: { voiceId: voice.id, text: '晚安。' } });
    assert.equal(speech.status, 200);
    assert.equal(speech.headers.get('content-type'), 'audio/wav');
    const audio = Buffer.from(await speech.arrayBuffer());
    assert.equal(audio.subarray(0, 4).toString(), 'RIFF');

    const revoked = await json(`${lib.base}/api/voices/${voice.id}/revoke`, { method: 'POST' });
    assert.equal(revoked.status, 200);
    assert.equal((await revoked.json()).status, 'revoked');
    const blocked = await json(`${lib.base}/api/speak`, { method: 'POST', body: { voiceId: voice.id, text: '晚安。' } });
    assert.equal(blocked.status, 409);
    assert.match((await blocked.json()).error, /撤销/);

    await json(`${lib.base}/api/voices/${voice.id}/restore`, { method: 'POST' });
    const allowedAgain = await json(`${lib.base}/api/speak`, { method: 'POST', body: { voiceId: voice.id, text: '早上好。' } });
    assert.equal(allowedAgain.status, 200);

    const removed = await fetch(`${lib.base}/api/voices/${voice.id}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    const gone = await json(`${lib.base}/api/speak`, { method: 'POST', body: { voiceId: voice.id, text: '再见。' } });
    assert.equal(gone.status, 404);
    const samples = await readdir(join(lib.root, 'samples')).catch(() => []);
    assert.deepEqual(samples, [], 'samples are deleted with the voice');
    const tombstones = await readdir(join(lib.root, 'tombstones'));
    assert.equal(tombstones.length, 1, 'an auditable tombstone remains');
    assert.deepEqual((await (await fetch(`${lib.base}/api/voices`)).json()).voices, []);
  } finally {
    await lib.close();
  }
});

test('the consent page states rights, data and fees', async () => {
  const lib = await startLibrary();
  try {
    const html = await (await fetch(`${lib.base}/consent`)).text();
    assert.match(html, /撤销授权/);
    assert.match(html, /删除/);
    assert.match(html, /费用/);
    assert.match(html, /不克隆未获本人明确授权的声音/);
  } finally {
    await lib.close();
  }
});

test('a configured licence token is required for every API call', async () => {
  const lib = await startLibrary({ LIBRARY_TOKEN: 'family-secret' });
  try {
    const denied = await fetch(`${lib.base}/api/voices`);
    assert.equal(denied.status, 401);
    const allowed = await fetch(`${lib.base}/api/voices`, { headers: { 'x-license-token': 'family-secret' } });
    assert.equal(allowed.status, 200);
  } finally {
    await lib.close();
  }
});
