// Background sound while reading: rain, a fireplace, a night train, or a live
// radio station. Everything here is either generated on this device (public
// domain, no license) or a public station stream the user chose to open.
// No audio is ever recorded, downloaded or re-shared by this app.

import { getSettings, setSetting } from './state.js';
import { makeAmbience } from './ambience.js';

const SOURCE_KEY = 'background-source';

export const CURATED_RADIOS = [
  { id: 'bbc-r3', name: 'BBC Radio 3 · 古典', url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_three', license: 'BBC 公开直播（仅直接收听，不录制）' },
  { id: 'wqxr', name: 'WQXR · 纽约古典台', url: 'https://stream.wqxr.org/wqxr', license: 'WQXR 公开直播（仅直接收听，不录制）' },
];

/**
 * A single HTMLAudioElement manager with gentle fades and ducking. The reader
 * calls `duck(true)` when narration starts so the book voice is always clear.
 */
export class BackgroundAudio {
  constructor(audio, { onStatus = () => {} } = {}) {
    this.audio = audio;
    this.onStatus = onStatus;
    this.baseVolume = 0.4;
    this.ducked = false;
    this.mode = 'idle';
    this.label = '';
    this.ambience = null;
    this.ambienceId = '';
    this.fadeTimer = null;
  }

  get targetVolume() {
    return Math.max(0, Math.min(1, this.baseVolume)) * (this.ducked ? 0.18 : 1);
  }

  applyVolume(smooth = true) {
    const target = this.targetVolume;
    if (!smooth) {
      this.audio.volume = target;
      return;
    }
    clearInterval(this.fadeTimer);
    const step = (target - this.audio.volume) / 8;
    if (Math.abs(step) < 0.005) {
      this.audio.volume = target;
      return;
    }
    this.fadeTimer = setInterval(() => {
      const next = this.audio.volume + step;
      if (Math.abs(next - target) < Math.abs(step)) {
        this.audio.volume = target;
        clearInterval(this.fadeTimer);
      } else this.audio.volume = Math.max(0, Math.min(1, next));
    }, 40);
  }

  duck(on) {
    this.ducked = Boolean(on);
    if (this.mode !== 'idle') this.applyVolume(this.mode === 'radio');
  }

  setVolume(value) {
    this.baseVolume = Number(value);
    this.applyVolume(false);
  }

  async _start(src, label, mode) {
    this.stop();
    this.mode = mode;
    this.label = label;
    this.audio.loop = mode === 'ambience';
    this.audio.src = src;
    this.audio.volume = 0;
    this.applyVolume(false);
    try {
      await this.audio.play();
    } catch (error) {
      this.mode = 'idle';
      this.label = '';
      throw error;
    }
    this.applyVolume(true);
    this.onStatus({ mode, label, playing: true });
  }

  async playAmbience(id) {
    const scene = makeAmbience(id);
    if (!scene) throw new Error('没有这个环境声');
    this.stop();
    this.ambience = scene;
    this.ambienceId = id;
    await this._start(scene.wavUrl, scene.name, 'ambience');
    await setSetting(SOURCE_KEY, { mode: 'ambience', id });
    return scene;
  }

  async playRadio(station) {
    this.stop();
    this.ambienceId = station.id;
    await this._start(station.url, station.name, 'radio');
    await setSetting(SOURCE_KEY, { mode: 'radio', id: station.id, name: station.name, url: station.url });
    return station;
  }

  async playFile(file) {
    this.stop();
    this.file = file;
    await this._start(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ''), 'file');
    // Blob sources cannot survive a reload; remember only the label.
    await setSetting(SOURCE_KEY, { mode: 'none', id: '' });
    return file;
  }

  stop() {
    clearInterval(this.fadeTimer);
    const wasUrl = this.audio.src?.startsWith('blob:') && this.mode === 'file';
    if (wasUrl) {
      try {
        URL.revokeObjectURL(this.audio.src);
      } catch {}
    }
    try {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    } catch {}
    this.ambience = null;
    this.mode = 'idle';
    this.label = '';
    this.onStatus({ mode: 'idle', label: '', playing: false });
  }

  async stopAndForget() {
    this.stop();
    await setSetting(SOURCE_KEY, { mode: 'none', id: '' });
  }
}

export async function restoreBackground(manager) {
  const settings = await getSettings();
  const saved = settings[SOURCE_KEY];
  if (!saved || saved.mode === 'none') return null;
  if (saved.mode === 'ambience') {
    try {
      return await manager.playAmbience(saved.id);
    } catch {
      return null;
    }
  }
  if (saved.mode === 'radio' && saved.url) {
    // Live radio only resumes when the user asks again; never autoplay a stream.
    return { pendingRadio: saved };
  }
  return null;
}
