// 家庭声音授权的单元测试：node --test tests/reader/unit
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSENT_ITEMS, CONSENT_VERSION, validateConsent, sampleProblem, analyzePcm,
  makeVoiceRecord, revokeVoice, canUseVoice, describeVoice,
} from '../../../portal/reader/voices.js';

const fullConsent = Object.fromEntries(CONSENT_ITEMS.map(i => [i.id, true]));

function tone(n, sampleRate, hz = 220) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * hz * i) / sampleRate) * 0.5;
  return out;
}

test('validateConsent 要求全部条款，缺一项也拒绝', () => {
  assert.equal(validateConsent(fullConsent).ok, true);
  const partial = { ...fullConsent, revoke: false };
  const res = validateConsent(partial);
  assert.equal(res.ok, false);
  assert.deepEqual(res.missing, ['revoke']);
  assert.equal(validateConsent(null).ok, false);
});

test('sampleProblem 限制 3–30 秒', () => {
  assert.match(sampleProblem(1), /太短/);
  assert.equal(sampleProblem(5), '');
  assert.match(sampleProblem(45), /太长/);
});

test('analyzePcm 给出时长、峰值与语速倾向', () => {
  const features = analyzePcm(tone(48000, 48000), 48000);
  assert.equal(features.duration, 1);
  assert.ok(features.peak > 0.4);
  assert.equal(typeof features.rateBias, 'number');
  assert.ok(features.rateBias > 0.6 && features.rateBias < 1.8);
  assert.ok(features.analyzedAt);
});

test('analyzePcm 对空样本返回 null', () => {
  assert.equal(analyzePcm(new Float32Array(0), 48000), null);
  assert.equal(analyzePcm(null, 48000), null);
});

test('makeVoiceRecord 固化授权版本与条款快照', () => {
  const record = makeVoiceRecord({
    name: '妈妈', speaker: '妈妈', features: analyzePcm(tone(48000, 48000), 48000), consent: fullConsent,
  });
  assert.equal(record.status, 'active');
  assert.equal(record.consent.version, CONSENT_VERSION);
  assert.deepEqual(record.consent.items, CONSENT_ITEMS.map(i => i.id));
  assert.equal(canUseVoice(record), true);
});

test('没有撤销条款的声音不可使用', () => {
  const record = makeVoiceRecord({ name: 'x', features: null, consent: { ...fullConsent, revoke: false } });
  assert.equal(canUseVoice(record), false);
});

test('revokeVoice 抹掉特征与样本信息，并禁止再使用', () => {
  const record = makeVoiceRecord({ name: '奶奶', features: { duration: 4, pitch: 1.1 }, consent: fullConsent, sampleMeta: { seconds: 4 } });
  const revoked = revokeVoice(record);
  assert.equal(revoked.status, 'revoked');
  assert.equal(revoked.features, null);
  assert.deepEqual(revoked.sampleMeta, {});
  assert.ok(revoked.revokedAt);
  assert.equal(canUseVoice(revoked), false);
  assert.match(describeVoice(revoked), /已撤销/);
});

test('revokeVoice 对空记录安全返回 null', () => {
  assert.equal(revokeVoice(null), null);
});

test('describeVoice 带出关系与样本时长', () => {
  const record = makeVoiceRecord({ name: '爸爸', relationship: '父亲', features: { duration: 6, pitch: 0.9 }, consent: fullConsent });
  assert.match(describeVoice(record), /爸爸（父亲）/);
  assert.match(describeVoice(record), /6 秒/);
});
