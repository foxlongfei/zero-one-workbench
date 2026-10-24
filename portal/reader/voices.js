// 陪你读书 · 家庭声音授权（受控、可撤销、可删除）
//
// 产品原则：
// 1. 未经声音本人明确授权，系统不得保存样本、不得合成。
// 2. 授权撤销或删除时，样本与派生音色数据当场从本机清除。
// 3. 本模块只在本机保存「声音指纹特征」（pitch/能量/频谱重心等声学参数），
//    用于把朗读音色映射到本人可理解的特征；不做声音克隆，不上传任何音频。
//    未来若接入本地克隆模型，必须先在本文件与 UI 中重新说明并再次取得授权。

export const CONSENT_VERSION = '2026-10-24.d-reader.family-voice.v1';

export const CONSENT_ITEMS = [
  { id: 'record', text: '我知道正在录制我的声音样本，并同意仅用于这个家的读书朗读。' },
  { id: 'local', text: '我知道样本与声音特征只保存在这台设备的浏览器里，不会上传到服务器。' },
  { id: 'noClone', text: '我知道当前版本不会克隆我的音色，也不会用我的声音说我没有说过的话。' },
  { id: 'revoke', text: '我知道我可以随时撤销授权，撤销后样本和音色数据会立即删除。' },
];

export const MAX_SAMPLE_SECONDS = 30;
export const MIN_SAMPLE_SECONDS = 3;

export function validateConsent(form) {
  const missing = CONSENT_ITEMS.filter(item => !form?.[item.id]).map(item => item.id);
  return { ok: missing.length === 0, missing };
}

export function sampleProblem(seconds) {
  const s = Number(seconds) || 0;
  if (s < MIN_SAMPLE_SECONDS) return `样本太短（${s.toFixed(1)} 秒），请至少录 ${MIN_SAMPLE_SECONDS} 秒。`;
  if (s > MAX_SAMPLE_SECONDS) return `样本太长（${s.toFixed(1)} 秒），请控制在 ${MAX_SAMPLE_SECONDS} 秒以内。`;
  return '';
}

// 从浮点 PCM 计算可读的声学特征。不做身份识别，只用于展示与调试。
export function analyzePcm(samples, sampleRate) {
  const n = samples?.length || 0;
  if (!n) return null;
  let sum = 0, peak = 0, zc = 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const v = samples[i];
    sum += v * v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
    if ((v >= 0) !== (prev >= 0)) zc++;
    prev = v;
  }
  const rms = Math.sqrt(sum / n);
  const duration = n / sampleRate;
  const zcr = zc / duration / 2;
  const voiced = Math.max(0.5, Math.min(2, zcr / 140));
  return {
    duration: Number(duration.toFixed(2)),
    peak: Number(peak.toFixed(3)),
    rms: Number(rms.toFixed(4)),
    zeroCrossRate: Math.round(zcr),
    // 粗略映射到朗读参数：音调偏低 → 语速略慢
    pitch: Number(voiced.toFixed(2)),
    rateBias: Number((1.06 - voiced * 0.08).toFixed(2)),
    analyzedAt: new Date().toISOString(),
  };
}

export function makeVoiceRecord({ name, speaker, relationship, features, consent, sampleMeta }) {
  const now = new Date().toISOString();
  const id = 'voice-' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
  return {
    id,
    name: String(name || '').trim() || '家人的声音',
    speaker: String(speaker || '').trim(),
    relationship: String(relationship || '').trim(),
    features: features || null,
    status: 'active',
    createdAt: now,
    consent: {
      ...consent,
      version: CONSENT_VERSION,
      acceptedAt: now,
      items: CONSENT_ITEMS.map(item => item.id),
    },
    sampleMeta: sampleMeta || {},
    usage: { spokenSentences: 0, lastUsedAt: null },
  };
}

export function revokeVoice(record, { reason = '本人撤销授权' } = {}) {
  if (!record) return null;
  return {
    ...record,
    status: 'revoked',
    revokedAt: new Date().toISOString(),
    revokeReason: reason,
    // 撤销即抹掉样本相关数据，只保留审计所需字段
    features: null,
    sampleMeta: {},
  };
}

export function canUseVoice(record) {
  return !!record && record.status === 'active' && !!record.consent?.revoke;
}

export function describeVoice(record) {
  if (!record) return '';
  if (record.status === 'revoked') return `${record.name}（已撤销，数据已删除）`;
  const f = record.features;
  const detail = f ? ` · 样本 ${f.duration} 秒 · 音调 ${f.pitch}` : '';
  return `${record.name}${record.relationship ? '（' + record.relationship + '）' : ''}${detail}`;
}
