// Kokoro-82M-v1.1-zh: a small Apache-licensed Chinese/English neural voice.
//
// This runtime uses the working v1.1 ONNX export (inputs: tokens/style/speed)
// with onnxruntime-web and the official misaki[zh] 1.1 token alphabet. The
// Chinese G2P is local pinyin-pro + a tone-sandhi pass; no espeak/network
// service is involved in phonemisation. The model and text never leave the
// device after the one-time model/voice download.

import { abortError } from './engines.mjs';
import { normalizeSpeechSamples } from './piper.mjs?v=20261029-5';
import { chineseToBopomofo } from './zh-g2p.mjs?v=20261029-2';
import { KOKORO_VOCAB } from './kokoro-vocab.mjs?v=20261029-2';

const MODEL_URL = 'https://huggingface.co/xun/kokoro-v1.1-zh-onnx/resolve/669989101227e5d602c18989203d6a484f198982/onnx/kokoro-v1.1-zh.onnx';
const VOICE_BASE = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX/resolve/6cc0f0d2ebe369a68b0df87c2b65c1af8c0ac3e3/voices';
const CACHE_NAME = 'kokoro-v11-zh-fp32';
const SAMPLE_RATE = 24000;

export const KOKORO = Object.freeze({
  name: 'Kokoro 中文 v1.1',
  modelId: 'xun/kokoro-v1.1-zh-onnx',
  runtimePackage: 'onnxruntime-web',
  license: 'Apache-2.0（模型/ONNX 转换） · MIT（pinyin-pro）',
  sizeHint: '约 330 MB',
  downloadHint: '首次使用下载约 330 MB，之后由浏览器缓存。',
  languages: ['zh', 'en'],
});

export const KOKORO_VOICES = Object.freeze([
  { id: 'zf_001', name: '中文女声 001', gender: '女' },
  { id: 'zf_002', name: '中文女声 002', gender: '女' },
  { id: 'zf_003', name: '中文女声 003', gender: '女' },
  { id: 'zf_004', name: '中文女声 004', gender: '女' },
  { id: 'zf_005', name: '中文女声 005', gender: '女' },
  { id: 'zm_009', name: '中文男声 009', gender: '男' },
  { id: 'zm_010', name: '中文男声 010', gender: '男' },
  { id: 'zm_011', name: '中文男声 011', gender: '男' },
  { id: 'zm_012', name: '中文男声 012', gender: '男' },
]);

export const kokoroVoiceById = id => KOKORO_VOICES.find(voice => voice.id === id) || KOKORO_VOICES[0];

let sharedContext = null;
const getContext = () => {
  if (!sharedContext) sharedContext = new (window.AudioContext || window.webkitAudioContext)();
  return sharedContext;
};

export const primeKokoroAudio = () => {
  try {
    const ctx = getContext();
    ctx.resume?.().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
};

const playSamples = (samples, sampleRate, { signal } = {}) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(abortError());
  const ctx = getContext();
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  let settled = false;
  const finish = (fn, value) => {
    if (settled) return;
    settled = true;
    signal?.removeEventListener('abort', abort);
    fn(value);
  };
  const abort = () => {
    try { source.stop(); } catch { /* already stopped */ }
    finish(reject, abortError());
  };
  signal?.addEventListener('abort', abort, { once: true });
  source.onended = () => finish(resolve);
  ctx.resume?.().catch(() => {});
  source.start();
});

const fetchCached = async (url, { cacheName = CACHE_NAME, onProgress = null } = {}) => {
  let cache = null;
  try {
    if (typeof caches !== 'undefined') cache = await caches.open(cacheName);
    const hit = await cache?.match(url);
    if (hit) return hit.arrayBuffer();
  } catch { /* Cache Storage is optional */ }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`模型下载失败（HTTP ${response.status}）`);
  const total = Number(response.headers.get('content-length')) || 0;
  let buffer;
  if (!response.body || !total) {
    buffer = await response.arrayBuffer();
  } else {
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress?.({ loaded, total });
    }
    const blob = new Blob(chunks);
    buffer = await blob.arrayBuffer();
    try { await cache?.put(url, new Response(blob)); } catch { /* quota */ }
    return buffer;
  }
  try { await cache?.put(url, new Response(buffer.slice(0))); } catch { /* quota */ }
  return buffer;
};

export class KokoroRuntime {
  constructor({ onProgress = null, modelUrl = MODEL_URL, sessionOptions = { executionProviders: ['wasm'] } } = {}) {
    this.onProgress = onProgress;
    this.modelUrl = modelUrl;
    this.sessionOptions = sessionOptions;
    this.ort = null;
    this.session = null;
    this.voices = new Map();
    this._loading = null;
  }

  get loaded() {
    return Boolean(this.session);
  }

  async load() {
    if (this.session) return this;
    if (!this._loading) {
      this._loading = (async () => {
        const ort = await import('onnxruntime-web');
        this.ort = ort;
        const buffer = await fetchCached(this.modelUrl, {
          onProgress: ({ loaded, total }) => {
            const value = total ? loaded / total : 0;
            this.onProgress?.({
              stage: 'model',
              progress: value,
              message: `下载模型 ${(loaded / 1048576).toFixed(1)}/${(total / 1048576).toFixed(1)} MB`,
            });
          },
        });
        this.session = await ort.InferenceSession.create(buffer, this.sessionOptions);
        this.onProgress?.({ stage: 'ready', progress: 1, message: '模型已就绪' });
        return this;
      })().finally(() => { this._loading = null; });
    }
    return this._loading;
  }

  async voicePack(voice) {
    if (this.voices.has(voice)) return this.voices.get(voice);
    const buffer = await fetchCached(`${VOICE_BASE}/${voice}.bin`, {
      cacheName: `${CACHE_NAME}-voices`,
    });
    const pack = new Float32Array(buffer);
    this.voices.set(voice, pack);
    return pack;
  }

  tokenize(phonemes) {
    const ids = [];
    for (const character of String(phonemes)) {
      const id = KOKORO_VOCAB[character];
      if (id !== undefined) ids.push(id);
    }
    return ids;
  }

  async synthesize(text, { voice = KOKORO_VOICES[0].id, speed = 1, signal } = {}) {
    if (!text || !String(text).trim()) throw new Error('朗读文本为空');
    await this.load();
    if (signal?.aborted) throw abortError();
    const phonemes = chineseToBopomofo(text);
    const ids = this.tokenize(phonemes);
    if (!ids.length) throw new Error('没有可用的中文音素');
    const pack = await this.voicePack(voice);
    const styleIndex = 256 * Math.min(Math.max(ids.length - 1, 0), 509);
    const style = pack.slice(styleIndex, styleIndex + 256);
    const tokens = BigInt64Array.from([0n, ...ids.map(id => BigInt(id)), 0n]);
    const tokenName = this.session.inputNames.includes('input_ids') ? 'input_ids' : 'tokens';
    const speedValue = Number(speed) > 0 ? Number(speed) : 1;
    const feeds = {
      [tokenName]: new this.ort.Tensor('int64', tokens, [1, tokens.length]),
      style: new this.ort.Tensor('float32', style, [1, 256]),
      speed: new this.ort.Tensor(tokenName === 'tokens' ? 'float32' : 'int32', [tokenName === 'tokens' ? speedValue : Math.round(speedValue)], [1]),
    };
    const output = await this.session.run(feeds);
    if (signal?.aborted) throw abortError();
    const audio = output.waveform || output.audio || output[this.session.outputNames[0]];
    if (!audio?.data?.length) throw new Error('Kokoro 没有生成音频');
    return { samples: new Float32Array(audio.data), sampleRate: SAMPLE_RATE, phonemes };
  }

  async speak(text, { voice, speed = 1, signal } = {}) {
    primeKokoroAudio();
    const audio = await this.synthesize(text, { voice, speed, signal });
    const samples = normalizeSpeechSamples(audio.samples, {
      sampleRate: audio.sampleRate,
      targetRms: 0.12,
      targetPeak: 0.95,
    });
    await playSamples(samples, audio.sampleRate, { signal });
  }

  stop() {
    // Inference is not interruptible inside onnxruntime; playback is aborted
    // through the signal.
  }

  dispose() {
    try { this.session?.release?.(); } catch { /* already released */ }
    this.session = null;
    this.voices.clear();
  }
}

export class KokoroEngine {
  kind = 'kokoro';
  needsNetwork = true;
  name = 'Kokoro 中文自然声线';

  constructor({ runtime, voice = KOKORO_VOICES[0].id, speed = 1 }) {
    Object.assign(this, { runtime, voice, speed });
  }

  speak(text, { signal } = {}) {
    return this.runtime.speak(text, { voice: this.voice, speed: this.speed, signal });
  }

  stop() {
    this.runtime.stop();
  }
}
