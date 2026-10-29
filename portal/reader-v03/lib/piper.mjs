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
  constructor({ onProgress = null } = {}) {
    this.onProgress = onProgress;
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
            model: PIPER.modelUrl,
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
            modelUrl: PIPER.encoderUrl,
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
    await this.load({ withEncoder: true });
    const ctx = getContext();
    const decoded = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
    const embedding = await this.encoder.encode(decoded);
    return new Float32Array(embedding);
  }

  async synthesize(text, { embedding, speed = 1, signal } = {}) {
    if (!text || !String(text).trim()) throw new Error('朗读文本为空');
    if (!embedding || !embedding.length) throw new Error('还没有可用的声音特征');
    await this.load();
    if (signal?.aborted) throw abortError();
    const rate = Number(speed) > 0 ? Number(speed) : 1;
    const audio = await this.tts.synthesize(String(text), {
      language: detectPiperLanguage(text),
      speakerEmbedding: embedding instanceof Float32Array ? embedding : new Float32Array(embedding),
      // Piper's lengthScale is the inverse of speaking rate.
      lengthScale: 1 / rate,
    });
    if (signal?.aborted) throw abortError();
    return audio;
  }

  async speak(text, { embedding, speed = 1, signal } = {}) {
    primePiperAudio();
    const audio = await this.synthesize(text, { embedding, speed, signal });
    await playSamples(audio.samples, audio.sampleRate, { signal });
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
