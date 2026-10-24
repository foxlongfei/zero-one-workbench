// Audio session for narration segments. Uses WebAudio when the browser can
// decode the served WAV; otherwise falls back to progressing through segments
// with an <audio> element, which every Chromium build can play.
import { api } from './api.js';

export class AudioSession extends EventTarget {
  constructor({ speed = 1, voice = 'system', engine = 'auto' } = {}) {
    super();
    this.speed = Math.min(1.6, Math.max(0.6, Number(speed) || 1));
    this.voice = voice;
    this.engine = engine; // 'auto' | 'webaudio' | 'device'
    this.state = 'idle';
    this.queue = null;
    this.index = 0;
    this.context = null;
    this.unlocked = false;
    this.current = null;
    this.prefetch = null;
    this.generation = 0;
    this.engine_used = null;
    this.failure = null;
    this.pausedDuringLoad = false;
    this.deviceText = null;
    this.canDecode = true;
    this.pendingBuffer = null;
    this.offsetSaved = 0;
    this.url = null;
    this.abort = null;
  }

  get playing() { return this.state === 'playing'; }
  get paused() { return this.state === 'paused'; }
  get active() { return ['playing', 'paused', 'loading'].includes(this.state); }
  get segmentChanged() { return this.state === 'playing'; }

  #emit(type, detail = {}) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  #set(state, detail = {}) {
    this.state = state;
    this.#emit('statechange', { state, ...detail });
  }

  /** Must be called from a user gesture before play(audio) works. */
  unlock() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor && !this.context) this.context = new Ctor();
    this.context?.resume?.().catch(() => {});
    if (!this.probe) {
      this.probe = new Audio();
      this.probe.autoplay = true;
      this.probe.src = `data:audio/wav;base64,${SILENCE_WAV}`;
      this.probe.play?.().catch(() => {});
    }
    this.unlocked = true;
  }

  setSpeed(speed) {
    this.speed = Math.min(1.6, Math.max(0.6, Number(speed) || 1));
    this.prefetch = null;
    if (this.state === 'playing' || this.state === 'loading') this.#restartCurrent();
  }

  setVoice(voice) {
    this.voice = voice || 'system';
    this.prefetch = null;
    if (this.state === 'playing' || this.state === 'loading') this.#restartCurrent();
  }

  #restartCurrent() {
    this.#teardown();
    this.#load();
  }

  /**
   * Start a segment queue.
   * @param {string[]|{segments: string[], title?: string}} queue
   * @param {number} index
   * @param {{play?: boolean}=} options play:false prepares without starting
   */
  async play(queue, index = 0, { play = true } = {}) {
    this.#teardown();
    this.generation++;
    // Callers pass either a plain array of segment texts or a {segments} bag.
    this.queue = Array.isArray(queue) ? { segments: queue } : { ...queue, segments: queue?.segments || [] };
    this.index = Math.max(0, Math.min(index, this.queue.segments.length - 1));
    this.failure = null;
    if (!play) {
      this.#set('ready', { segmentIndex: this.index });
      this.#prefetch(this.index);
      return;
    }
    await this.#load(true);
  }

  async pause() {
    if (this.state === 'loading') { this.pausedDuringLoad = true; this.#set('paused'); return; }
    if (this.state !== 'playing') return;
    if (this.current?.kind === 'device') {
      window.speechSynthesis?.pause?.();
    } else if (this.current?.kind === 'audio') {
      this.current.offset = this.current.element.currentTime;
      this.current.element.pause();
    } else if (this.current?.kind === 'webaudio') {
      this.current.offset = this.context.currentTime - this.current.startedAt;
      this.current.source.onended = null;
      try { this.current.source.stop(); } catch {}
    }
    this.#set('paused', { segmentIndex: this.index });
  }

  async resume() {
    if (this.state !== 'paused' && this.state !== 'ready') return;
    this.pausedDuringLoad = false;
    await this.#load(true);
  }

  async toggle() {
    if (this.state === 'playing' || this.state === 'loading') return this.pause();
    if (this.state === 'paused' || this.state === 'ready') return this.resume();
    return null;
  }

  async jump(index) {
    if (!this.queue) return;
    const resume = this.state === 'playing' || this.state === 'loading' || this.state === 'paused';
    this.#teardown();
    this.generation++;
    this.index = Math.max(0, Math.min(index, this.queue.segments.length - 1));
    if (resume) await this.#load(true);
    else {
      this.#set('ready', { segmentIndex: this.index });
      this.#prefetch(this.index);
    }
  }

  stop() {
    this.#teardown();
    this.generation++;
    this.prefetch = null;
    this.#set('idle');
  }

  #teardown() {
    this.abort?.abort();
    this.abort = null;
    const current = this.current;
    this.current = null;
    if (!current) return;
    if (current.kind === 'webaudio') {
      current.source.onended = null;
      try { current.source.stop(); } catch {}
    } else if (current.kind === 'audio') {
      current.element.onended = null;
      current.element.pause();
      current.element.removeAttribute('src');
      current.element.load?.();
    } else if (current.kind === 'device') {
      window.speechSynthesis?.cancel?.();
    }
  }

  #prefetch(index) {
    if (index >= this.queue.segments.length) return;
    const generation = this.generation;
    this.prefetch = {
      index,
      generation,
      promise: this.#fetch(index, generation),
    };
  }

  async #fetch(index, generation) {
    const text = this.queue.segments[index];
    const abort = new AbortController();
    this.abort = abort;
    try {
      const { blob } = await api.narration(text, { speed: this.speed, voice: this.voice, signal: abort.signal });
      return { index, blob };
    } catch (err) {
      if (abort.signal.aborted) return { index, aborted: true };
      if (generation !== this.generation) return { index, aborted: true };
      const voiceProblem = err.status === 403 || err.status === 409;
      return { index, fallback: voiceProblem ? err.message : `服务器朗读不可用：${err.message}`, voiceProblem };
    }
  }

  async #load(start = true) {
    const generation = this.generation;
    if (this.index >= this.queue.segments.length) { this.#set('ended'); return; }
    this.#set('loading', { segmentIndex: this.index });
    let data;
    if (this.prefetch?.index === this.index && this.prefetch.generation === generation) data = await this.prefetch.promise;
    else data = await this.#fetch(this.index, generation);
    this.prefetch = null;
    if (generation !== this.generation) return;
    this.offsetSaved = undefined;

    if (data.fallback) {
      this.failure = data.fallback;
      this.#emit('fallback', { reason: data.fallback, voiceProblem: data.voiceProblem });
      return this.#playDevice(this.queue.segments[this.index], generation, start);
    }

    const kind = this.engine === 'device' ? 'device' : 'server';
    if (kind === 'device') return this.#playDevice(this.queue.segments[this.index], generation, start);

    const attempt = this.canDecode ? await this.#tryWebAudio(data, generation, start) : false;
    if (attempt === 'conflict') return;
    if (attempt) return;
    return this.#playElement(data, generation, start);
  }

  async #tryWebAudio(data, generation, start) {
    if (!this.context) return false;
    let buffer;
    try {
      buffer = await this.context.decodeAudioData(await data.blob.arrayBuffer());
    } catch (err) {
      this.canDecode = false;
      this.#emit('engine', { engine: 'audio-element', reason: 'WebAudio 无法解码该音频，已改用普通音频通道' });
      return false;
    }
    if (generation !== this.generation) return 'conflict';
    if (!start || this.pausedDuringLoad) {
      this.pendingBuffer = buffer;
      this.pausedDuringLoad = false;
      this.#set('paused', { segmentIndex: this.index });
      return 'conflict';
    }
    this.engine_used = 'webaudio';
    this.context.resume?.().catch(() => {});
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const gain = this.context.createGain();
    source.connect(gain).connect(this.context.destination);
    const offset = Math.min(Math.max(0, this.offsetSaved || 0), Math.max(0, buffer.duration - 0.02));
    this.offsetSaved = 0;
    this.current = { kind: 'webaudio', source, gain, startedAt: this.context.currentTime - offset };
    source.onended = () => {
      if (this.current?.source !== source) return;
      this.current = null;
      if (generation !== this.generation) return;
      this.#advance();
    };
    source.start(0, offset);
    this.#set('playing', { segmentIndex: this.index, engine: 'webaudio', duration: buffer.duration - offset });
    this.#prefetch(this.index + 1);
    return true;
  }

  #playElement(data, generation, start) {
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(data.blob);
    const element = new Audio();
    element.src = this.url;
    element.preload = 'auto';
    if (this.offsetSaved) { element.currentTime = this.offsetSaved; this.offsetSaved = 0; }
    this.current = { kind: 'audio', element };
    element.onended = () => {
      if (this.current?.element !== element) return;
      this.current = null;
      if (generation !== this.generation) return;
      this.#advance();
    };
    element.onerror = () => {
      if (this.current?.element !== element) return;
      this.#emit('error', { message: '音频播放失败，切换到系统语音', segmentIndex: this.index });
      this.#playDevice(this.queue.segments[this.index], generation, true);
    };
    if (!start || this.pausedDuringLoad) {
      this.pausedDuringLoad = false;
      this.#set('paused', { segmentIndex: this.index, engine: 'audio' });
      return;
    }
    this.engine_used = 'audio';
    element.play().then(() => {
      if (generation !== this.generation) return;
      this.#set('playing', { segmentIndex: this.index, engine: 'audio', duration: element.duration || 0 });
      this.#prefetch(this.index + 1);
    }).catch(err => {
      if (generation !== this.generation) return;
      this.#emit('error', { message: `音频未能开始播放：${err.message}` });
    });
  }

  async #playDevice(text, generation, start = true) {
    const synth = window.speechSynthesis;
    if (!synth || !window.SpeechSynthesisUtterance) {
      this.#set('error', { message: '浏览器没有可用的语音引擎' });
      return;
    }
    this.engine_used = 'device';
    this.deviceText = text;
    if (!start) { this.#set('paused', { segmentIndex: this.index, engine: 'device' }); return; }
    await new Promise(resolve => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = this.speed;
      const zh = (synth.getVoices?.() || []).find(v => /^zh/i.test(v.lang));
      if (zh) utterance.voice = zh;
      this.current = { kind: 'device', utterance };
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      utterance.onend = () => {
        if (this.current?.utterance !== utterance) return finish();
        this.current = null;
        finish();
        if (generation === this.generation) this.#advance();
      };
      utterance.onerror = event => {
        finish();
        if (this.current?.utterance !== utterance || generation !== this.generation) return;
        this.current = null;
        this.#set('error', { message: `系统语音朗读失败：${event.error || 'unknown'}` });
      };
      synth.speak(utterance);
      this.#set('playing', { segmentIndex: this.index, engine: 'device' });
    });
    this.#prefetch(this.index + 1);
  }

  #advance() {
    this.index++;
    if (this.index >= this.queue.segments.length) { this.#set('ended', { segmentIndex: this.index }); return; }
    this.#emit('segment', { index: this.index });
    this.#load(true);
  }

  /** Prepare audio for a segment ahead of time (used before the first tap). */
  warm(index) {
    if (!this.queue || index >= this.queue.segments.length) return;
    if (this.prefetch?.index === index) return;
    this.#prefetch(index);
  }
}

const SILENCE_WAV = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
