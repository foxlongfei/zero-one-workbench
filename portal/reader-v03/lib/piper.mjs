// Open-source neural speech for the reader: Piper Plus (Multilingual VITS,
// zs-v1) running entirely in the browser through onnxruntime-web.
//
// The model and runtime are open source and independently licensed:
//   * Piper Plus runtime: MIT
//   * zs-v1 TTS weights: MIT
//   * CAM++ speaker encoder: Apache-2.0
// Text and reference audio never leave the device. The first visit downloads
// the model (about 40 MB TTS + 28 MB encoder when training a voice); later
// visits reuse the browser's IndexedDB/Cache Storage.
//
// This is zero-shot voice conditioning, not gradient training: a 5-15 second
// authorised reference clip is encoded into a speaker embedding, then used to
// condition the same multilingual TTS model. The UI says "声音训练" because
// that is the family-facing step, and the README states the technical limit.

const HUB = 'https://huggingface.co/ayousanz/piper-plus-base/resolve/main/releases/zs-v1';

export const PIPER = Object.freeze({
  name: 'Piper Plus zs-v1',
  modelUrl: `${HUB}/base.onnx`,
  encoderUrl: `${HUB}/campplus.onnx`,
  runtimePackage: 'piper-plus@0.8.2',
  license: 'MIT（模型/运行时） · Apache-2.0（CAM++ 声音编码器）',
  languages: ['zh', 'en', 'ja', 'ko', 'es', 'fr', 'pt', 'sv'],
  downloadHint: '首次使用下载约 70 MB，之后由浏览器缓存。',
});

export const PIPER_PACKS = Object.freeze({
  zs: Object.freeze({
    id: 'zs',
    name: 'Piper Plus zs-v1',
    shortName: '可训练多语言',
    modelUrl: PIPER.modelUrl,
    encoderUrl: PIPER.encoderUrl,
    requiresEmbedding: true,
    sizeHint: '约 70 MB（含声音编码器）',
    license: PIPER.license,
  }),
  mera: Object.freeze({
    id: 'mera',
    name: 'Mera 多语言',
    shortName: '单声线离线包',
    modelUrl: 'kizuna-intelligence/piper-plus-mera-multilingual',
    encoderUrl: null,
    requiresEmbedding: false,
    sizeHint: '约 39 MB，无需参考声音',
    license: 'Apache-2.0（模型）；运行库 MIT',
  }),
});

export const DEMO_VOICE_URL = new URL('../data/piper-demo-voice.json', import.meta.url).href;

let sharedContext = null;
const getContext = () => {
  if (!sharedContext) sharedContext = new (window.AudioContext || window.webkitAudioContext)();
  return sharedContext;
};

const abortError = () => Object.assign(new Error('speech aborted'), { name: 'AbortError' });

// Call synchronously from a user gesture. Model loading can take tens of
// seconds; a context created only after that await may stay suspended under
// browser autoplay policies.
export const primePiperAudio = () => {
  try {
    const ctx = getContext();
    ctx.resume?.().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
};

export const detectPiperLanguage = text => (/[\u3400-\u9fff]/.test(String(text ?? '')) ? 'zh' : 'en');

// Piper's experimental zs-v1 graph returns a very low-level signal (roughly
// -22 dBFS peak on the demo voice), so playback on a phone sounds tiny. Raise
// it to a normal speech level while leaving headroom; RMS decides the gain and
// the peak cap prevents clipping. This runs only after synthesis, on-device.
export const normalizeSpeechSamples = (samples, {
  sampleRate = 22050,
  targetRms = 0.12,
  targetPeak = 0.92,
  maxGain = 16,
  fadeMs = 5,
} = {}) => {
  const input = samples instanceof Float32Array ? samples : new Float32Array(samples ?? []);
  const output = input.slice();
  if (!input.length) return output;
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const value = Number(input[i]);
    if (!Number.isFinite(value)) continue;
    const absolute = Math.abs(value);
    if (absolute > peak) peak = absolute;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / input.length);
  if (!(peak > 0) || !(rms > 0)) return output;
  const gain = Math.max(0.01, Math.min(maxGain, targetPeak / peak, targetRms / rms));
  for (let i = 0; i < input.length; i++) {
    const value = Number(input[i]);
    output[i] = Number.isFinite(value) ? Math.max(-1, Math.min(1, value * gain)) : 0;
  }
  // A few milliseconds of fade avoids a click at the start and end of each
  // sentence after the level change.
  const rate = Number(sampleRate) > 0 ? Number(sampleRate) : 22050;
  const fade = Math.min(Math.floor(rate * Math.max(0, fadeMs) / 1000), Math.floor(output.length / 2));
  for (let i = 0; i < fade; i++) {
    const factor = i / fade;
    output[i] *= factor;
    output[output.length - 1 - i] *= factor;
  }
  return output;
};

// The experimental zs-v1 weights have a sharp presence peak that sounds
// piercing on phone speakers. A gentle high-pass, a presence cut, a high-shelf
// and a low-pass make the same voice warmer without changing the model. The
// filter is deliberately mild; it is a comfort fix, not a quality upgrade.
const biquadCoefficients = (type, frequency, sampleRate, { gain = 0, q = 0.707 } = {}) => {
  const rate = Number(sampleRate) > 0 ? Number(sampleRate) : 22050;
  const f0 = Math.min(Math.max(20, Number(frequency) || 1000), rate * 0.45);
  const w0 = 2 * Math.PI * f0 / rate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  if (type === 'peaking') {
    const A = Math.pow(10, gain / 40);
    const alpha = sin / (2 * Math.max(0.1, q));
    return [
      1 + alpha * A, -2 * cos, 1 - alpha * A,
      1 + alpha / A, -2 * cos, 1 - alpha / A,
    ];
  }
  if (type === 'highshelf') {
    const A = Math.pow(10, gain / 40);
    const alpha = sin / 2 * Math.sqrt((A + 1 / A) * (1 - 1) + 2);
    const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
    return [
      A * ((A + 1) + (A - 1) * cos + twoSqrtAAlpha),
      -2 * A * ((A - 1) + (A + 1) * cos),
      A * ((A + 1) + (A - 1) * cos - twoSqrtAAlpha),
      (A + 1) - (A - 1) * cos + twoSqrtAAlpha,
      2 * ((A - 1) - (A + 1) * cos),
      (A + 1) - (A - 1) * cos - twoSqrtAAlpha,
    ];
  }
  const alpha = sin / (2 * Math.max(0.1, q));
  if (type === 'lowpass') {
    return [
      (1 - cos) / 2, 1 - cos, (1 - cos) / 2,
      1 + alpha, -2 * cos, 1 - alpha,
    ];
  }
  // highpass
  return [
    (1 + cos) / 2, -(1 + cos), (1 + cos) / 2,
    1 + alpha, -2 * cos, 1 - alpha,
  ];
};

const filterBiquad = (samples, coefficients) => {
  const [b0, b1, b2, a0, a1, a2] = coefficients;
  const output = new Float32Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x0 = Number(samples[i]) || 0;
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2
      - (a1 / a0) * y1 - (a2 / a0) * y2;
    output[i] = Math.max(-1, Math.min(1, y0));
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return output;
};

export const softenSpeechSamples = (samples, { sampleRate = 22050, normalize = true } = {}) => {
  const input = samples instanceof Float32Array ? samples : new Float32Array(samples ?? []);
  if (!input.length) return input.slice();
  const rate = Number(sampleRate) > 0 ? Number(sampleRate) : 22050;
  let output = filterBiquad(input, biquadCoefficients('highpass', 85, rate, { q: 0.7 }));
  output = filterBiquad(output, biquadCoefficients('peaking', 3200, rate, { gain: -4, q: 1 }));
  output = filterBiquad(output, biquadCoefficients('highshelf', 4500, rate, { gain: -7 }));
  output = filterBiquad(output, biquadCoefficients('lowpass', 8500, rate, { q: 0.7 }));
  return normalize ? normalizeSpeechSamples(output, { sampleRate: rate }) : output;
};

// A phone recording can be quiet, DC-offset, mostly silence, or several
// minutes long. CAM++ only needs 5-15 seconds, so remove silence, take the
// loudest 15-second window, and peak-normalise before extracting the embedding.
// This is still the user's authorised sample; nothing leaves the device.
export const prepareReferenceSamples = (samples, sampleRate = 16000, {
  maxSeconds = 15,
  targetPeak = 0.95,
  maxGain = 20,
} = {}) => {
  const input = samples instanceof Float32Array ? samples : new Float32Array(samples ?? []);
  if (!input.length) return input.slice();
  const rate = Number(sampleRate) > 0 ? Number(sampleRate) : 16000;

  let mean = 0;
  for (let i = 0; i < input.length; i++) mean += Number(input[i]) || 0;
  mean /= input.length;
  // Avoid a second full-length buffer for long phone recordings. Only the
  // trimmed clip is copied; peak/trim scan the input in place.
  let peak = 0;
  for (let i = 0; i < input.length; i++) peak = Math.max(peak, Math.abs((Number(input[i]) || 0) - mean));
  if (!(peak > 0)) return new Float32Array(input.length);

  // Keep 50 ms either side of the first/last audible sample.
  const threshold = peak * 0.02;
  let start = 0;
  while (start < input.length - 1 && Math.abs((Number(input[start]) || 0) - mean) < threshold) start += 1;
  let end = input.length - 1;
  while (end > start && Math.abs((Number(input[end]) || 0) - mean) < threshold) end -= 1;
  const padding = Math.floor(rate * 0.05);
  start = Math.max(0, start - padding);
  end = Math.min(input.length - 1, end + padding);
  let clip = new Float32Array(end - start + 1);
  for (let i = 0; i < clip.length; i++) clip[i] = (Number(input[start + i]) || 0) - mean;

  // Long imports are limited to the loudest 15-second window so the embedding
  // is not averaged over minutes of unrelated audio and room noise. A sliding
  // window keeps memory constant even for a 30-minute phone recording.
  const maxSamples = Math.max(1, Math.floor(rate * (Number(maxSeconds) > 0 ? Number(maxSeconds) : 15)));
  if (clip.length > maxSamples) {
    let energy = 0;
    for (let i = 0; i < maxSamples; i++) energy += clip[i] * clip[i];
    let bestEnergy = energy;
    let bestStart = 0;
    const step = Math.max(1, Math.floor(rate * 0.5));
    for (let offset = step; offset + maxSamples <= clip.length; offset += step) {
      for (let i = offset - step; i < offset; i++) {
        energy -= clip[i] * clip[i];
        energy += clip[i + maxSamples] * clip[i + maxSamples];
      }
      if (energy > bestEnergy) { bestEnergy = energy; bestStart = offset; }
    }
    const lastStart = clip.length - maxSamples;
    if (lastStart > 0 && lastStart % step !== 0) {
      energy = 0;
      for (let i = lastStart; i < clip.length; i++) energy += clip[i] * clip[i];
      if (energy > bestEnergy) { bestEnergy = energy; bestStart = lastStart; }
    }
    clip = clip.slice(bestStart, bestStart + maxSamples);
  }

  let clipPeak = 0;
  for (let i = 0; i < clip.length; i++) clipPeak = Math.max(clipPeak, Math.abs(clip[i]));
  if (!(clipPeak > 0)) return clip;
  const gain = Math.min(maxGain, targetPeak / clipPeak);
  const output = new Float32Array(clip.length);
  for (let i = 0; i < clip.length; i++) {
    output[i] = Math.max(-1, Math.min(1, clip[i] * gain));
  }
  const fade = Math.min(Math.floor(rate * 0.01), Math.floor(output.length / 2));
  for (let i = 0; i < fade; i++) {
    const factor = i / fade;
    output[i] *= factor;
    output[output.length - 1 - i] *= factor;
  }
  return output;
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

export class PiperRuntime {
  constructor({ modelUrl = PIPER.modelUrl, encoderUrl = PIPER.encoderUrl, requiresEmbedding = true, onProgress = null } = {}) {
    this.onProgress = onProgress;
    this.modelUrl = modelUrl;
    this.encoderUrl = encoderUrl;
    this.requiresEmbedding = requiresEmbedding;
    this.tts = null;
    this.encoder = null;
    this.ort = null;
    this.SpeakerEncoder = null;
    this._ttsLoading = null;
    this._encoderLoading = null;
  }

  get loaded() {
    return Boolean(this.tts);
  }

  get trainingReady() {
    return Boolean(this.encoder);
  }

  async _importModules() {
    const [piper, ort] = await Promise.all([
      import('piper-plus'),
      import('onnxruntime-web'),
    ]);
    this.ort = ort;
    this.SpeakerEncoder = piper.SpeakerEncoder;
    return piper;
  }

  async load({ withEncoder = false } = {}) {
    if (!this.tts) {
      if (!this._ttsLoading) {
        this._ttsLoading = (async () => {
          const { PiperPlus } = await this._importModules();
          this.tts = await PiperPlus.initialize({
            model: this.modelUrl,
            ort: this.ort,
            onProgress: progress => this.onProgress?.(progress),
          });
        })().finally(() => { this._ttsLoading = null; });
      }
      await this._ttsLoading;
    }
    if (withEncoder && !this.encoder) {
      if (!this._encoderLoading) {
        this._encoderLoading = (async () => {
          await this._importModules();
          this.encoder = await this.SpeakerEncoder.initialize({
            modelUrl: this.encoderUrl,
            ort: this.ort,
          });
        })().finally(() => { this._encoderLoading = null; });
      }
      await this._encoderLoading;
    }
    return this;
  }

  // Decode any browser-supported audio blob and turn it into a 192-dim CAM++
  // speaker embedding. The reference audio is never uploaded.
  async encodeReference(blob) {
    if (!(blob instanceof Blob) || !blob.size) throw new Error('参考声音为空');
    if (!this.encoderUrl) throw new Error('这个离线声音包不支持训练');
    await this.load({ withEncoder: true });
    const ctx = getContext();
    const decoded = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
    const reference = prepareReferenceSamples(decoded.getChannelData(0), decoded.sampleRate);
    const embedding = await this.encoder.encode(reference, decoded.sampleRate);
    return new Float32Array(embedding);
  }

  async synthesize(text, { embedding, speed = 1, signal } = {}) {
    if (!text || !String(text).trim()) throw new Error('朗读文本为空');
    if (this.requiresEmbedding && (!embedding || !embedding.length)) throw new Error('还没有可用的声音特征');
    await this.load();
    if (signal?.aborted) throw abortError();
    const rate = Number(speed) > 0 ? Number(speed) : 1;
    const options = {
      language: detectPiperLanguage(text),
      // Piper's lengthScale is the inverse of speaking rate.
      lengthScale: 1 / rate,
    };
    if (this.requiresEmbedding) {
      options.speakerEmbedding = embedding instanceof Float32Array ? embedding : new Float32Array(embedding);
    }
    const audio = await this.tts.synthesize(String(text), options);
    if (signal?.aborted) throw abortError();
    return audio;
  }

  async speak(text, { embedding, speed = 1, signal } = {}) {
    primePiperAudio();
    const audio = await this.synthesize(text, { embedding, speed, signal });
    const samples = softenSpeechSamples(audio.samples, { sampleRate: audio.sampleRate });
    await playSamples(samples, audio.sampleRate, { signal });
  }

  stop() {
    // Synthesis is short and cannot be cancelled inside onnxruntime; callers
    // abort playback through the signal. This method exists for symmetry.
  }

  dispose() {
    try { this.tts?.dispose?.(); } catch { /* already disposed */ }
    try { this.encoder?.dispose?.(); } catch { /* already disposed */ }
    this.tts = null;
    this.encoder = null;
  }
}

export class PiperEngine {
  kind = 'piper';
  needsNetwork = true;
  name = 'Piper Plus 本机神经语音';

  constructor({ runtime, embedding, getEmbedding, speed = 1 }) {
    this.runtime = runtime;
    this.embedding = embedding;
    this.getEmbedding = getEmbedding;
    this.speed = speed;
  }

  speak(text, { signal } = {}) {
    const embedding = typeof this.getEmbedding === 'function' ? this.getEmbedding() : this.embedding;
    return this.runtime.speak(text, { embedding, speed: this.speed, signal });
  }

  stop() {
    this.runtime.stop();
  }
}
