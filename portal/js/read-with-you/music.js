// Background music: one looped track the family supplies, ducked under
// narration. The file is stored locally and never uploaded.
import { readBackground, saveBackground, clearBackground, readSettings, writeSettings } from './store.js';

export class BackgroundMusic extends EventTarget {
  constructor() {
    super();
    this.element = new Audio();
    this.element.loop = true;
    this.element.preload = 'auto';
    this.settings = readSettings();
    this.ducked = false;
    this.url = null;
    this.#applyVolume();
    this.element.addEventListener('play', () => this.#emit('change'));
    this.element.addEventListener('pause', () => this.#emit('change'));
  }

  #emit(type, detail = {}) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  get ready() { return Boolean(this.url); }
  get playing() { return !this.element.paused; }
  get name() { return this.currentName || ''; }

  async restore() {
    try {
      const saved = await readBackground();
      if (!saved?.blob) return null;
      this.#attach(saved.blob, saved.name);
      return saved;
    } catch (err) {
      console.warn('background music unavailable', err);
      return null;
    }
  }

  async choose(file) {
    const meta = await saveBackground(file);
    this.#attach(file, meta.name);
    this.#emit('change');
    return meta;
  }

  async clear() {
    this.element.pause();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.currentName = '';
    this.element.removeAttribute('src');
    this.element.load?.();
    await clearBackground();
    this.#emit('change');
  }

  #attach(blob, name) {
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(blob);
    this.currentName = name || '本机背景乐';
    this.element.src = this.url;
    this.#applyVolume();
  }

  /** Called from a user gesture; browsers block audio until then. */
  async start() {
    if (!this.ready) return false;
    try { await this.element.play(); return true; } catch (err) { this.#emit('blocked', { message: err.message }); return false; }
  }

  pause() { this.element.pause(); }

  setDucked(ducked) {
    this.ducked = ducked;
    this.#applyVolume();
    this.#emit('change');
  }

  setLevel(level) {
    this.settings = writeSettings({ musicLevel: Math.max(0, Math.min(1, level)) });
    this.#applyVolume();
    this.#emit('change');
  }

  setDucking(enabled) {
    this.settings = writeSettings({ ducking: Boolean(enabled) });
    this.#applyVolume();
    this.#emit('change');
  }

  #applyVolume() {
    const level = Number(this.settings.musicLevel ?? 0.18);
    const factor = this.settings.ducking !== false && this.ducked ? 0.25 : 1;
    // Keep a faint bed of music under the voice instead of muting it entirely.
    this.element.volume = Math.max(0, Math.min(1, level * factor));
  }
}
