// Contract tests for the browser neural engine metadata. The real model is
// exercised by tests/reader-v03/neural-check.mjs in Chromium.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  PIPER,
  PIPER_PACKS,
  detectPiperLanguage,
  normalizeSpeechSamples,
  prepareReferenceSamples,
} from '../../portal/reader-v03/lib/piper.mjs';

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

test('quiet neural output is raised to a normal speech level', () => {
  const quiet = new Float32Array(22050);
  for (let i = 0; i < quiet.length; i++) quiet[i] = 0.02 * Math.sin(i / 12);
  const output = normalizeSpeechSamples(quiet, { sampleRate: 22050 });
  let peak = 0;
  let sum = 0;
  for (const value of output) {
    peak = Math.max(peak, Math.abs(value));
    sum += value * value;
  }
  const rms = Math.sqrt(sum / output.length);
  assert.ok(rms > 0.08, `rms ${rms}`);
  assert.ok(peak <= 0.96, `peak ${peak}`);
  assert.ok(peak > 0.1, `peak ${peak}`);
});

test('phone reference is trimmed, limited to 15 seconds and normalised', () => {
  const rate = 16000;
  const input = new Float32Array(rate * 30);
  for (let i = 0; i < input.length; i++) input[i] = 0.000001;
  // A quiet 20-second segment in the middle, louder near the end.
  for (let i = rate * 4; i < rate * 24; i++) input[i] = 0.01 * Math.sin(i / 20);
  for (let i = rate * 24; i < rate * 28; i++) input[i] = 0.05 * Math.sin(i / 20);
  const output = prepareReferenceSamples(input, rate);
  assert.equal(output.length, rate * 15);
  let peak = 0;
  for (const value of output) peak = Math.max(peak, Math.abs(value));
  assert.ok(peak > 0.8 && peak <= 1, `peak ${peak}`);
});
