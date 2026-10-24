// 陪你读书 · 背景音
// 版权安全优先：内置音景全部由 Web Audio 实时合成（无录音、无第三方音乐），
// 用户也可以导入自己有权利使用的本机音频，独立音量、朗读时自动压低。

export const SCENES = [
  {
    id: 'rain', name: '窗前细雨', glyph: '🌧',
    description: '柔和的雨声与远处低鸣，适合读长篇小说。',
    build(ctx, out, gain) {
      const dur = 4;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 420;
      src.connect(hp).connect(lp).connect(gain);
      src.start();
      const drone = ctx.createOscillator(); drone.type = 'sine'; drone.frequency.value = 96;
      const droneGain = ctx.createGain(); droneGain.gain.value = 0.05;
      drone.connect(droneGain).connect(gain); drone.start();
      return () => { src.stop(); drone.stop(); };
    },
  },
  {
    id: 'forest', name: '林间清晨', glyph: '🌿',
    description: '风声、树叶与偶尔的鸟鸣，适合散文与儿童故事。',
    build(ctx, out, gain) {
      const dur = 5;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let b0 = 0, b1 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + 0.01 * white;
        b1 = 0.9 * b1 + 0.1 * white;
        data[i] = (b0 * 4 + b1 * 0.4) * 0.8;
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 350;
      lfo.connect(lfoGain).connect(bp.frequency); lfo.start();
      src.connect(bp).connect(gain); src.start();
      let stopped = false;
      const chirp = () => {
        if (stopped) return;
        const t = ctx.currentTime;
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.setValueAtTime(1800 + Math.random() * 900, t);
        o.frequency.exponentialRampToValueAtTime(2600 + Math.random() * 700, t + 0.12);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g).connect(gain); o.start(t); o.stop(t + 0.2);
        setTimeout(chirp, 2200 + Math.random() * 6000);
      };
      const id = setTimeout(chirp, 1500);
      return () => { stopped = true; clearTimeout(id); src.stop(); lfo.stop(); };
    },
  },
  {
    id: 'hearth', name: '炉火夜读', glyph: '🔥',
    description: '噼啪轻响的炉火，安静的冬夜。',
    build(ctx, out, gain) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 70;
      const og = ctx.createGain(); og.gain.value = 0.05;
      o.connect(og).connect(gain); o.start();
      let stopped = false;
      const crackle = () => {
        if (stopped) return;
        const t = ctx.currentTime;
        const src = ctx.createBufferSource();
        const len = Math.floor(ctx.sampleRate * 0.05);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
        src.buffer = buf;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
        const g = ctx.createGain(); g.gain.value = 0.5 + Math.random() * 0.5;
        src.connect(hp).connect(g).connect(gain); src.start(t);
        setTimeout(crackle, 180 + Math.random() * 900);
      };
      crackle();
      return () => { stopped = true; o.stop(); };
    },
  },
  {
    id: 'piano', name: '静夜钢琴', glyph: '🎹',
    description: '五声音阶的缓慢旋律，不带录音、无版权顾虑。',
    build(ctx, out, gain) {
      const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
      let stopped = false;
      let step = 0;
      const note = () => {
        if (stopped) return;
        const t = ctx.currentTime;
        const f = scale[(step * 3 + Math.floor(step / 4)) % scale.length];
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
        o.connect(g); o2.connect(g); g.connect(gain);
        o.start(t); o2.start(t); o.stop(t + 2.5); o2.stop(t + 2.5);
        step++;
        setTimeout(note, 1600);
      };
      note();
      return () => { stopped = true; };
    },
  },
  {
    id: 'lofi', name: '午后和弦', glyph: '🎧',
    description: '循环的四和弦垫音，适合长时间听书。',
    build(ctx, out, gain) {
      const chords = [[220, 277.18, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 329.63]];
      let stopped = false;
      let i = 0;
      const oscs = [];
      const g = ctx.createGain(); g.gain.value = 0.07; g.connect(gain);
      const play = () => {
        if (stopped) return;
        const t = ctx.currentTime;
        const chord = chords[i % chords.length];
        const local = chord.map(f => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.start(t); oscs.push(o); return o;
        });
        local.forEach(o => o.connect(g));
        i++;
        setTimeout(() => { if (stopped) return; local.forEach(o => { try { o.stop(); } catch { /* already stopped */ } }); play(); }, 4000);
      };
      play();
      return () => { stopped = true; oscs.forEach(o => { try { o.stop(); } catch { /* ignore */ } }); };
    },
  },
];

export const SCENE_IDS = SCENES.map(s => s.id);

export function sceneById(id) {
  return SCENES.find(s => s.id === id) || null;
}

// 朗读时把背景音压到 25%，暂停/结束时恢复。
export function effectiveGain(base, { speaking, ducking }) {
  const b = Math.max(0, Math.min(1, Number(base) || 0));
  return speaking && ducking ? b * 0.25 : b;
}

export class AmbientMixer {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.stopFns = [];
    this.sceneId = null;
    this.audio = null;
    this.baseVolume = 0.2;
    this.ducking = true;
    this.speaking = false;
    this.fileName = '';
  }

  #ensureContext() {
    if (!this.ctx) {
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.#gain();
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  #gain() {
    return effectiveGain(this.baseVolume, { speaking: this.speaking, ducking: this.ducking });
  }

  setVolume(v) { this.baseVolume = Math.max(0, Math.min(1, Number(v) || 0)); this.apply(); }
  setDucking(on) { this.ducking = !!on; this.apply(); }
  setSpeaking(on) { this.speaking = !!on; this.apply(); }

  apply() {
    const g = this.#gain();
    if (this.master) this.master.gain.setTargetAtTime(g, this.ctx.currentTime, 0.08);
    if (this.audio) this.audio.volume = g;
  }

  stop() {
    this.stopFns.forEach(fn => { try { fn(); } catch { /* ignore */ } });
    this.stopFns = [];
    this.sceneId = null;
    if (this.audio) {
      this.audio.pause();
      if (this.audio.dataset?.url) URL.revokeObjectURL(this.audio.dataset.url);
      this.audio.removeAttribute('src');
      this.audio.load?.();
      this.audio.remove();
      this.audio = null;
    }
    this.fileName = '';
  }

  async play(id) {
    this.stop();
    if (!id) return false;
    const scene = sceneById(id);
    if (!scene) return false;
    const ctx = this.#ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') await ctx.resume();
    this.master.gain.value = this.#gain();
    const out = ctx.createGain(); out.gain.value = 1; out.connect(this.master);
    this.stopFns.push(scene.build(ctx, out, out));
    this.sceneId = id;
    return true;
  }

  async playFile(blob, name = '本机背景音') {
    this.stop();
    const ctx = this.#ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') await ctx.resume();
    const audio = new Audio();
    audio.loop = true;
    audio.dataset.url = URL.createObjectURL(blob);
    audio.src = audio.dataset.url;
    audio.volume = this.#gain();
    const source = ctx.createMediaElementSource(audio);
    source.connect(this.master);
    this.audio = audio;
    this.fileName = name;
    this.sceneId = 'file';
    try { await audio.play(); } catch { /* 浏览器可能要求用户手势，UI 会提示 */ }
    return true;
  }

  get playingId() { return this.sceneId; }
  get isPlaying() { return !!this.sceneId; }

  destroy() {
    this.stop();
    if (this.ctx) { this.ctx.close?.(); this.ctx = null; this.master = null; }
  }
}
