// Contract tests for the browser neural engine metadata. The real model is
// exercised by tests/reader-v03/neural-check.mjs in Chromium.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PIPER, PIPER_PACKS, detectPiperLanguage } from '../../portal/reader-v03/lib/piper.mjs';

test('Piper Plus metadata points at the open zs-v1 model and licence', () => {
  assert.match(PIPER.modelUrl, /piper-plus-base\/.*\/base\.onnx$/);
  assert.match(PIPER.encoderUrl, /campplus\.onnx$/);
  assert.match(PIPER.license, /MIT/);
  assert.match(PIPER.license, /Apache-2\.0/);
  assert.ok(PIPER.languages.includes('zh'));
});

test('the second offline voice pack is single-speaker and licensed', () => {
  assert.equal(PIPER_PACKS.mera.requiresEmbedding, false);
  assert.equal(PIPER_PACKS.mera.encoderUrl, null);
  assert.match(PIPER_PACKS.mera.license, /Apache-2\.0/);
});

test('language detection sends CJK text to Chinese G2P', () => {
  assert.equal(detectPiperLanguage('你好，今天读书。'), 'zh');
  assert.equal(detectPiperLanguage('Hello, ready to read?'), 'en');
  assert.equal(detectPiperLanguage('Chapter 1 第一章'), 'zh');
});

test('the bundled demo embedding is a finite 192-dimension vector', async () => {
  const raw = await readFile(new URL('../../portal/reader-v03/data/piper-demo-voice.json', import.meta.url), 'utf8');
  const voice = JSON.parse(raw);
  assert.equal(voice.embedding.length, 192);
  assert.ok(voice.embedding.every(value => Number.isFinite(value)));
  assert.match(voice.modelLicense, /MIT/);
  assert.match(voice.encoder, /Apache-2\.0/);
});
