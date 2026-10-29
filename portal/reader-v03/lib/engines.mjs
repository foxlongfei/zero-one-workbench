// Speech engines for "陪你读书".
//
// Every engine implements the same tiny contract so the listening loop does not
// care where audio comes from:
//   speak(text, { signal }) -> Promise<void>  (resolves when audio finished)
//   name, kind ('browser' | 'library' | 'tone'), needsNetwork
//
// * BrowserEngine   – Web Speech API, zero setup, built-in voices (offline on macOS/iOS/Windows,
//                     network-assisted in Chrome).
// * LibraryVoiceEngine – voices served by server/voice-library (cloned / customised family
//                     voices, see server docs). Authorisation and consent are enforced server
//                     side, never trusted from the client.

let audioContext = null;

const getAudioContext = () => {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  return audioContext;
};

const decodeArrayBuffer = async buffer => {
  const ctx = getAudioContext();
  return await ctx.decodeAudioData(buffer.slice(0));
};

const playBuffer = (ctx, audioBuffer, { signal, onStart } = {}) => new Promise((resolve, reject) => {
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  const abort = () => {
    try { source.stop(); } catch {}
    reject(abortError());
  };
  signal?.addEventListener('abort', abort, { once: true });
  source.onended = () => {
    signal?.removeEventListener('abort', abort);
    resolve();
  };
  onStart?.();
  source.start();
});

export const abortError = () => {
  const error = new Error('speech aborted');
  error.name = 'AbortError';
  return error;
};

export const isAbort = error => error?.name === 'AbortError';

export class BrowserEngine {
  kind = 'browser';
  needsNetwork = false;
  name = '本机浏览器语音';
  constructor({ voiceURI = '', rate = 1, pitch = 1, volume = 1 } = {}) {
    Object.assign(this, { voiceURI, rate, pitch, volume });
    this.synth = window.speechSynthesis;
  }
  static get available() {
    return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }
  voices() {
    return this.synth?.getVoices() ?? [];
  }
  speak(text, { signal } = {}) {
    return new Promise((resolve, reject) => {
      if (!this.synth) return reject(new Error('此浏览器不支持语音合成'));
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = this.voices().find(v => v.voiceURI === this.voiceURI);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || 'zh-CN';
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;
      let settled = false;
      const finish = fn => value => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', abort);
        fn(value);
      };
      const abort = () => {
        try { this.synth.cancel(); } catch {}
        finish(reject)(abortError());
      };
      signal?.addEventListener('abort', abort, { once: true });
      utterance.onend = finish(resolve);
      utterance.onerror = event => {
        if (event.error === 'interrupted' || event.error === 'canceled') finish(reject)(abortError());
        else finish(reject)(new Error(`语音合成失败：${event.error || 'unknown'}`));
      };
      // Chrome occasionally drops short utterances when another one was cancelled
      // right before; a microtask delay keeps cancel()+speak() in order.
      setTimeout(() => { if (!signal?.aborted) this.synth.speak(utterance); }, 0);
    });
  }
  stop() {
    try { this.synth?.cancel(); } catch {}
  }
}

const toWav = ({ channels, sampleRate, samples }) => {
  const frameCount = samples[0].length;
  const channelCount = channels;
  const buffer = new ArrayBuffer(44 + frameCount * channelCount * 2);
  const view = new DataView(buffer);
  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + frameCount * channelCount * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, frameCount * channelCount * 2, true);
  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    for (let c = 0; c < channelCount; c++) {
      const value = Math.max(-1, Math.min(1, samples[c][i]));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
};

// Deterministic offline test voice: lets the whole listening loop (chunking,
// chapter advance, pause, resume, position memory, background music ducking) be
// verified in a real browser without any network or model download. Enabled by
// the reader only when `?ttsTone=1` is set, so it can never silently replace a
// user's chosen voice.
//
// The duration is derived from the text length so playback is paced like real
// speech: a chunk has to take measurable time, otherwise pause/resume and
// chapter-crossing behaviour can never be observed.
export const TONE_SECONDS_PER_CHAR = 0.06;
export const TONE_MIN_SECONDS = 0.8;
export const TONE_MAX_SECONDS = 6;

export const toneSeconds = text => Math.min(
  TONE_MAX_SECONDS,
  Math.max(TONE_MIN_SECONDS, String(text ?? '').length * TONE_SECONDS_PER_CHAR),
);

export async function synthesizeTone(text) {
  const ctx = getAudioContext();
  const seconds = toneSeconds(text);
  const sampleRate = ctx.sampleRate || 24000;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 24) * Math.min(1, (seconds - t) * 24);
    const syllable = 0.6 + 0.4 * Math.sin(2 * Math.PI * 3.1 * t);
    samples[i] = 0.18 * envelope * syllable * Math.sin(2 * Math.PI * 196 * t);
  }
  return toWav({ channels: 1, sampleRate, samples: [samples] });
}

// Tone engine: the deterministic test voice, but played through the real audio
// graph so timing, pause and abort behave exactly like a neural voice.
export class ToneEngine {
  kind = 'tone';
  needsNetwork = false;
  name = '离线测试音（自动化）';
  constructor({ speed = 1 } = {}) {
    this.speed = speed > 0 ? speed : 1;
  }
  async speak(text, { signal } = {}) {
    const ctx = getAudioContext();
    await ctx.resume?.();
    if (signal?.aborted) throw abortError();
    const audioBuffer = await decodeArrayBuffer(await synthesizeTone(text));
    // Rates other than 1 map onto buffer playback instead of regenerating the PCM.
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = this.speed;
    source.connect(ctx.destination);
    await new Promise((resolve, reject) => {
      let settled = false;
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', abort);
        fn(value);
      };
      const abort = () => {
        try { source.stop(); } catch {}
        done(reject, abortError());
      };
      signal?.addEventListener('abort', abort, { once: true });
      source.onended = () => done(resolve);
      source.start();
    });
  }
  stop() {}
}

// Voice ids issued by server/voice-library. Fetches one chunk of PCM audio.
export class LibraryVoiceEngine {
  kind = 'library';
  needsNetwork = true;
  name = '家庭授权声音';
  constructor({ voiceId, name = '家庭授权声音', speed = 1, baseUrl = '', licenseToken = '' } = {}) {
    Object.assign(this, { voiceId, name, speed, baseUrl: baseUrl.replace(/\/+$/, ''), licenseToken });
    if (!voiceId) throw new Error('缺少声音 id');
  }
  async speak(text, { signal } = {}) {
    const response = await fetch(`${this.baseUrl}/api/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(this.licenseToken ? { 'x-license-token': this.licenseToken } : {}) },
      body: JSON.stringify({ voiceId: this.voiceId, text, speed: this.speed }),
      signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `声音服务返回 ${response.status}`);
    }
    const ctx = getAudioContext();
    await ctx.resume?.();
    const audioBuffer = await decodeArrayBuffer(await response.arrayBuffer());
    await playBuffer(ctx, audioBuffer, { signal });
  }
}
