// ZipVoice: an Apache-2.0 zero-shot TTS runtime (123M parameters) running in
// the browser through sherpa-onnx WASM. It clones a speaker from a short
// reference clip plus its exact transcript, entirely on-device.
//
// The model weights are CC-BY-NC because of the Emilia training data, so the
// UI labels this path as non-commercial and slower than the Piper engine.

import { abortError } from './engines.mjs';
import { normalizeSpeechSamples } from './piper.mjs?v=20261029-5';

export const ZIPVOICE = Object.freeze({
  name: 'ZipVoice 高音质克隆',
  version: 'zipvoice-distill-int8-zh-en-emilia',
  sizeHint: '约 200 MB',
  license: 'Apache-2.0（代码） · CC-BY-NC（模型权重，非商用）',
  warning: '首次下载约 200 MB，生成一段约需数秒到数十秒；模型权重仅限非商业用途。',
});

let sharedContext = null;
const getContext = () => {
  if (!sharedContext) sharedContext = new (window.AudioContext || window.webkitAudioContext)();
  return sharedContext;
};

export const primeZipVoiceAudio = () => {
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

export const decodeZipVoiceReference = async blob => {
  if (!(blob instanceof Blob) || !blob.size) throw new Error('参考声音为空');
  const ctx = getContext();
  const decoded = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
  return { samples: new Float32Array(decoded.getChannelData(0)), sampleRate: decoded.sampleRate };
};

export class ZipVoiceRuntime {
  constructor({ onProgress = null } = {}) {
    this.onProgress = onProgress;
    this.worker = null;
    this.ready = null;
    this.pending = new Map();
    this.counter = 0;
    this.loaded = false;
  }

  load() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./zipvoice-worker.js?v=20261029-2', import.meta.url), { name: 'zipvoice' });
      this.worker = worker;
      worker.onmessage = event => {
        const data = event.data || {};
        if (data.type === 'zipvoice-progress') {
          if (this.loaded || !data.status) return;
          this.onProgress?.({ stage: 'model', message: data.status });
          return;
        }
        if (data.type === 'zipvoice-ready') {
          this.loaded = true;
          this.onProgress?.({ stage: 'ready', progress: 1, message: '模型已就绪' });
          resolve(this);
          return;
        }
        if (data.type === 'zipvoice-error') {
          if (data.id && this.pending.has(data.id)) {
            const { reject: rejectRequest } = this.pending.get(data.id);
            this.pending.delete(data.id);
            rejectRequest(new Error(data.message || 'ZipVoice 合成失败'));
          } else if (!this.loaded) {
            reject(new Error(data.message || 'ZipVoice 初始化失败'));
          } else {
            this.onProgress?.({ stage: 'error', message: data.message || 'ZipVoice 合成失败' });
          }
          return;
        }
        if (data.type === 'zipvoice-result' && this.pending.has(data.id)) {
          const { resolve: resolveRequest } = this.pending.get(data.id);
          this.pending.delete(data.id);
          resolveRequest({ samples: new Float32Array(data.samples), sampleRate: data.sampleRate });
        }
      };
      worker.onerror = event => {
        const error = new Error(event.message || 'ZipVoice worker 加载失败');
        if (!this.loaded) reject(error);
        for (const { reject: rejectRequest } of this.pending.values()) rejectRequest(error);
        this.pending.clear();
      };
    }).catch(error => {
      try { this.worker?.terminate(); } catch { /* already terminated */ }
      this.worker = null;
      this.ready = null;
      throw error;
    });
    return this.ready;
  }

  async synthesize(text, { audio, sampleRate, transcript, speed = 1, signal } = {}) {
    if (!text || !String(text).trim()) throw new Error('朗读文本为空');
    if (!audio?.length) throw new Error('缺少参考声音');
    if (!transcript || !String(transcript).trim()) throw new Error('缺少参考声音的逐字稿');
    await this.load();
    if (signal?.aborted) throw abortError();
    const id = `zv_${++this.counter}`;
    const samples = new Float32Array(audio);
    return await new Promise((resolve, reject) => {
      const settle = (fn, value) => {
        signal?.removeEventListener('abort', onAbort);
        fn(value);
      };
      const onAbort = () => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        settle(reject, abortError());
      };
      this.pending.set(id, {
        resolve: value => settle(resolve, value),
        reject: error => settle(reject, error),
      });
      this.worker.postMessage({
        type: 'zipvoice-generate',
        id,
        text: String(text),
        config: {
          speed: Number(speed) > 0 ? Number(speed) : 1,
          referenceAudio: samples,
          referenceSampleRate: sampleRate,
          referenceText: String(transcript),
          numSteps: 4,
          extra: { min_char_in_sentence: 10 },
        },
      }, [samples.buffer]);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  async speak(text, { audio, sampleRate, transcript, speed = 1, signal } = {}) {
    primeZipVoiceAudio();
    const result = await this.synthesize(text, { audio, sampleRate, transcript, speed, signal });
    if (signal?.aborted) throw abortError();
    const samples = normalizeSpeechSamples(result.samples, {
      sampleRate: result.sampleRate,
      targetRms: 0.12,
      targetPeak: 0.95,
    });
    await playSamples(samples, result.sampleRate, { signal });
  }

  stop() {
    // sherpa-onnx generation is not interruptible; pending playback is aborted
    // through the signal. The result is discarded if the caller has moved on.
  }

  dispose() {
    try { this.worker?.terminate(); } catch { /* already terminated */ }
    this.worker = null;
    this.ready = null;
    this.loaded = false;
    this.pending.clear();
  }
}

export class ZipVoiceEngine {
  kind = 'zipvoice';
  needsNetwork = true;
  name = 'ZipVoice 高音质克隆';

  constructor({ runtime, profile, speed = 1 }) {
    Object.assign(this, { runtime, profile, speed, reference: null });
  }

  async speak(text, { signal } = {}) {
    if (!this.reference) this.reference = await decodeZipVoiceReference(this.profile.audio);
    return this.runtime.speak(text, {
      audio: this.reference.samples,
      sampleRate: this.reference.sampleRate,
      transcript: this.profile.transcript,
      speed: this.speed,
      signal,
    });
  }

  stop() {
    this.runtime.stop();
  }
}
