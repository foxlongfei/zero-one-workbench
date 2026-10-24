// Family voice: an explicitly authorized way to read in a family member's own voice.
//
// This is deliberately NOT voice cloning. We never ship or train a neural voice
// model of a person. Instead, with the speaker's recorded consent, we measure a
// compact profile of their speech (pitch, formants, pacing) on this device and
// use it to steer the system narrator's pitch and rate. The result is a warm
// "near their voice" reading, not an imitation of their identity, and the
// speaker can revoke or delete everything at any time.
//
// What we store: a consent record (who authorized what, when), a short spoken
// sample (so the family can hear the real voice in the trial), and the profile
// numbers. Nothing is uploaded; deleting purges all three stores.

import { put, get, getAll, del, audit, STORES } from './state.js';
import { splitSentences, preferredVoice } from './tts.js';

export const CONSENT_TEXT_VERSION = 1;

export const CONSENT_TEXT = [
  '我同意「陪你读书」用我录下的几句话，在我的家人或我本人的设备上，帮助朗读我们家的书。',
  '我明白：这只在本机分析我的音高、速度和音色特征，用来调整系统朗读的声音，不会复制我的人声，也不会把你的声音上传到任何服务器。',
  '我随时可以让家人停止使用、删除我的录音和声音档案。删除后，朗读会回到普通的系统声音。',
].join('\n');

export const ENROLL_SCRIPT = [
  '从前有座山，山里有座庙，庙里有个老和尚在给小和尚讲故事。',
  '今天的风很轻，院子里的桂花开了，奶奶喊我们回家吃饭。',
  '书里写着：走得慢一点，也能走到很远的地方。',
];

export async function listVoices() {
  const rows = await getAll('voices');
  return rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function getVoice(id) {
  return get('voices', id);
}

export function consentRecord({ name, relationship, grantedBy, note = '' }) {
  return {
    version: CONSENT_TEXT_VERSION,
    name,
    relationship,
    grantedBy,
    note,
    text: CONSENT_TEXT,
    grantedAt: Date.now(),
  };
}

/** Decode any audio the browser can play into mono samples at `rate`. */
export async function decodeToMono(blob, targetRate = 16000) {
  const Context = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const raw = await blob.arrayBuffer();
  const probe = new AudioContext();
  let decoded;
  try {
    decoded = await probe.decodeAudioData(raw);
  } finally {
    probe.close?.();
  }
  const frames = Math.max(1, Math.ceil(decoded.duration * targetRate));
  const offline = new Context(1, frames, targetRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

function rms(samples, from, to) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, to - from));
}

/** True if the clip contains enough clearly voiced audio to profile. */
export function hasVoice(samples, rate = 16000) {
  const frame = Math.round(rate * 0.03);
  let voiced = 0;
  for (let i = 0; i + frame < samples.length; i += frame) if (rms(samples, i, i + frame) > 0.012) voiced++;
  return voiced * 0.03 >= 1.2;
}

function goertzel(samples, start, size, rate, freq) {
  const k = (2 * Math.PI * freq) / rate;
  const coeff = 2 * Math.cos(k);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < size; i++) {
    s0 = samples[start + i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2) / size;
}

/** F0 via autocorrelation on a 40 ms window. Returns 0 for unvoiced frames. */
function pitchOf(samples, start, size, rate) {
  let sum = 0;
  for (let i = start; i < start + size; i++) sum += samples[i] * samples[i];
  const energy = sum / size;
  if (energy < 0.0004) return 0;
  const minLag = Math.floor(rate / 400);
  const maxLag = Math.floor(rate / 70);
  let best = 0;
  let bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = start; i < start + size - lag; i += 2) corr += samples[i] * samples[i + lag];
    if (corr > best) {
      best = corr;
      bestLag = lag;
    }
  }
  if (!bestLag || best / (energy * size) < 0.25) return 0;
  return rate / bestLag;
}

const BANDS = [
  [150, 400],
  [400, 800],
  [800, 1200],
  [1200, 1800],
  [1800, 2600],
  [2600, 3500],
];
const BAND_PROBES = { 150: [175, 225, 275, 325], 400: [440, 520, 600, 690], 800: [840, 920, 1000, 1100], 1200: [1250, 1380, 1500, 1650], 1800: [1850, 2000, 2200, 2400], 2600: [2700, 2900, 3100, 3350] };

function bandEnergies(samples, start, size, rate) {
  return BANDS.map(([low]) => BAND_PROBES[low].reduce((sum, freq) => sum + goertzel(samples, start, size, rate, freq) ** 2, 0));
}

function normalise(values) {
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  return values.map((v) => Number((v / sum).toFixed(3)));
}

/** Measure a speaker's profile from one or more sample clips. */
export function buildProfile(samplesList, rate = 16000) {
  const pitches = [];
  const energyFrames = [];
  for (const samples of samplesList) {
    const frame = Math.round(rate * 0.04);
    for (let start = 0; start + frame + rate / 70 < samples.length; start += Math.round(frame / 2)) {
      const f0 = pitchOf(samples, start, frame, rate);
      if (f0 >= 70 && f0 <= 400) {
        pitches.push(f0);
        energyFrames.push({ samples, start, frame });
      }
    }
  }
  if (pitches.length < 6) throw new Error('录音里可以听清的声音太少，请靠近麦克风再读一遍');
  pitches.sort((a, b) => a - b);
  const median = (arr) => arr[Math.floor(arr.length / 2)];
  const f0 = median(pitches);
  const spread = median(pitches.map((p) => Math.abs(p - f0)));
  const step = Math.max(1, Math.floor(energyFrames.length / 12));
  const bandSets = [];
  for (let i = 0; i < energyFrames.length; i += step) {
    const { samples, start, frame } = energyFrames[i];
    bandSets.push(normalise(bandEnergies(samples, start, frame, rate)));
  }
  const bands = BANDS.map((_, index) => median(bandSets.map((set) => set[index])));
  const totalSeconds = samplesList.reduce((sum, s) => sum + s.length / rate, 0);
  return {
    f0: Number(f0.toFixed(1)),
    f0Spread: Number(spread.toFixed(1)),
    voicedRatio: Number(Math.min(1, pitches.length / Math.max(1, Math.round(totalSeconds * 8))).toFixed(2)),
    bands: normalise(bands),
    seconds: Number(totalSeconds.toFixed(1)),
    measuredAt: Date.now(),
  };
}

// System voices usually sit near ~200 Hz (female) to ~120 Hz (male) relative
// to the narrator's own pitch; we only nudge within safe bounds so speech
// stays natural. Timbre is communicated by choosing a nearby voice family.
const BASE_PITCH = { female: 1.0, male: 0.85 };

export function voiceSettingsFor(profile, baseGender = 'female') {
  if (!profile) return { pitch: 1, rate: 1 };
  const base = 200 * (BASE_PITCH[baseGender] || 1);
  const pitch = Math.min(1.45, Math.max(0.62, Number((profile.f0 / base).toFixed(2))));
  const warmth = (profile.bands?.[0] || 0) + (profile.bands?.[1] || 0);
  const rate = Number(Math.min(1.06, Math.max(0.92, 1 + (warmth - 0.34) * 0.5)).toFixed(2));
  return { pitch, rate };
}

/** Pick the closest system voice to the profile when one exists. */
export function suggestSystemVoice(voices, profile, lang) {
  const base = preferredVoice(voices, lang);
  if (!profile || !voices?.length) return base;
  const sameLang = voices.filter((voice) => voice.lang?.toLowerCase().startsWith(String(lang).slice(0, 2)));
  const pool = sameLang.length ? sameLang : voices;
  const target = 200 * (profile.f0 < 165 ? 0.85 : 1);
  const lowerIsCloser = target < 170;
  const maleish = /male|man|liang|yunxi|yunjian|kangkang|david|george|daniel|alex/i;
  const femaleish = /female|woman|xiaoxiao|xiaoyi|tingting|meijia|huihui|samantha|zira/i;
  return pool.find((voice) => (lowerIsCloser ? maleish.test(voice.name) : femaleish.test(voice.name))) || base;
}

export async function saveVoice(voice) {
  const row = { createdAt: Date.now(), status: 'active', ...voice };
  await put('voices', row);
  return row;
}

/** Clips live in their own settings row so the voice profile row stays small. */
export function sampleKey(id) {
  return `voice-sample-${id}`;
}

export async function saveSamples(id, clips) {
  const rows = [];
  for (const [index, clip] of clips.entries()) {
    rows.push({ id: `${sampleKey(id)}-${index}`, value: { blob: clip.blob, name: clip.name || `第 ${index + 1} 段` } });
  }
  for (const row of rows) await put('settings', row);
  await put('settings', { id: sampleKey(id), value: { count: rows.length } });
  return rows.length;
}

export async function getSamples(id) {
  const rows = await getAll('settings');
  return rows
    .filter((row) => String(row.id).startsWith(`${sampleKey(id)}-`) && row.value?.blob)
    .map((row) => row.value);
}

export async function purgeSamples(id) {
  const rows = await getAll('settings');
  for (const row of rows) if (String(row.id).startsWith(sampleKey(id))) await del('settings', row.id);
}

export async function revokeVoice(id, reason = 'revoked-by-user') {
  const voice = await get('voices', id);
  if (!voice) return null;
  const row = { ...voice, status: 'revoked', revokedAt: Date.now(), revokedReason: reason };
  await put('voices', row);
  await audit('voice.revoked', { voiceId: id, name: voice.name });
  return row;
}

export async function restoreVoice(id) {
  const voice = await get('voices', id);
  if (!voice) return null;
  const row = { ...voice, status: 'active', revokedAt: null };
  await put('voices', row);
  await audit('voice.reauthorized', { voiceId: id, name: voice.name });
  return row;
}

/** Delete samples + profile permanently. Only the action is audited, never audio. */
export async function deleteVoice(id) {
  const voice = await get('voices', id);
  // Purge the stored clips first, then the profile row that points at them.
  await purgeSamples(id);
  await del('voices', id);
  if (voice) await audit('voice.deleted', { voiceId: id, name: voice.name, samples: (voice.sampleNames || []).length });
  return voice;
}

/** Enroll from recorded clips. `clips` = [{blob, name}] */
export async function enrollVoice({ name, relationship, grantedBy, note, clips, baseGender = 'female', lang = 'zh-CN', systemVoiceName = '' }) {
  if (!clips?.length) throw new Error('还没有录音');
  const samplesList = [];
  for (const clip of clips) samplesList.push(await decodeToMono(clip.blob));
  const profile = buildProfile(samplesList);
  const id = `fv-${crypto.randomUUID()}`;
  const voiced = samplesList.reduce((sum, s) => sum + s.length, 0);
  if (voiced / 16000 < 2) throw new Error('录音太短，至少需要两秒清晰朗读');
  await saveSamples(id, clips);
  const settings = voiceSettingsFor(profile, baseGender);
  const voice = {
    id,
    kind: 'family',
    name,
    relationship,
    consent: consentRecord({ name, relationship, grantedBy, note }),
    baseGender,
    lang,
    systemVoiceName,
    sampleNames: clips.map((c) => c.name || '录音'),
    sampleSeconds: profile.seconds,
    profile,
    settings,
    status: 'active',
  };
  await saveVoice(voice);
  await audit('voice.enrolled', { voiceId: id, name, relationship, grantedBy, seconds: profile.seconds });
  return voice;
}

/** Trial text: short, warm, no copyrighted material. */
export function trialText(voice, text) {
  return splitSentences(text || `你好，我是${voice.name}。今天的书，我们慢慢读。`, { max: 90 })[0] || '你好。';
}

export async function voiceUsage() {
  const voices = await getAll('voices');
  const clipRows = (await getAll('settings')).filter((row) => String(row.id).startsWith('voice-sample-') && row.value?.blob);
  const sampleBytes = clipRows.reduce((sum, row) => sum + (row.value.blob.size || 0), 0);
  return {
    voices: voices.length,
    active: voices.filter((v) => v.status === 'active').length,
    revoked: voices.filter((v) => v.status === 'revoked').length,
    clips: clipRows.length,
    sampleBytes,
  };
}
