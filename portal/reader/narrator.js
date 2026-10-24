// 陪你读书 · 朗读引擎
// 把整本书切成「适合人耳」的句子（中文按标点与分句、英文按句号与分号），
// 再用 Web Speech API 排队朗读；遇到书签时自动续读，跨章节不中断。
// 纯函数部分（splitSentences / sliceParagraphs）不依赖浏览器，便于单元测试。

const CJK_END = /[。！？!?…；;]/;
const CJK_SOFT = /[，,、：:—]/;
const LATIN_END = /[.!?]/;

export function splitSentences(text, { maxLen = 90, minLen = 4 } = {}) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const after = i => clean.slice(i + 1).replace(/^[\s”’"）)】」』]+/, '');
  const isCjkEnd = ch => CJK_END.test(ch) && !/^[A-Za-z0-9]$/.test(ch);
  const out = [];
  let buf = '';
  const push = () => {
    const piece = buf.trim();
    buf = '';
    if (!piece) return;
    if (piece.length <= maxLen) { out.push(piece); return; }
    // 超长句：优先按中文软标点切，其次按长度硬切
    let rest = piece;
    while (rest.length > maxLen) {
      let cut = -1;
      for (let i = maxLen; i >= Math.floor(maxLen / 2); i--) {
        if (CJK_SOFT.test(rest[i])) { cut = i + 1; break; }
      }
      if (cut < 0) cut = maxLen;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  };
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    buf += ch;
    const rest = after(i);
    const isLatin = /[A-Za-z0-9]/.test(ch);
    if (isCjkEnd(ch) && (!rest || !/^[A-Za-z0-9]$/.test(rest))) {
      push();
    } else if (isLatin && LATIN_END.test(ch) && (!rest || /^\s/.test(clean[i + 1] || ''))) {
      push();
    } else if (buf.length >= maxLen && (CJK_SOFT.test(ch) || ch === ' ')) {
      push();
    }
  }
  push();
  // 合并极短残片（如「好。」），避免逐字朗读的机械感
  const merged = [];
  for (const s of out) {
    if (merged.length && s.length < minLen && merged[merged.length - 1].length + s.length <= maxLen) {
      merged[merged.length - 1] += s;
    } else merged.push(s);
  }
  return merged;
}

// 把 HTML 段落数组转成句子流，记录每句属于第几段，便于正文高亮。
export function sliceParagraphs(paragraphs, opts) {
  const sentences = [];
  paragraphs.forEach((p, paragraphIndex) => {
    const parts = splitSentences(p, opts);
    parts.forEach((text, i) => sentences.push({ text, paragraphIndex, first: i === 0 }));
  });
  return sentences;
}

// 朗读时点不读出声的段落：极短行（页码、分隔符）与纯标点。
const SPEAKABLE = /[\u4e00-\u9fffA-Za-z0-9]/;

export function isSpeakable(text) {
  const t = String(text || '').trim();
  return t.length >= 2 && SPEAKABLE.test(t);
}

// 目录页、版权页、封面等非正文页面不进入朗读队列（仍然在目录里可见）。
export function isBodyText(paragraphs) {
  return (paragraphs || []).some(p => isSpeakable(p));
}

export function estimateMinutes(wordCount, charsPerMinute = 260) {
  const n = Number(wordCount) || 0;
  if (!n) return 0;
  return Math.max(1, Math.round(n / charsPerMinute));
}

// 朗读队列：持有一段可暂停、续读、跳转的句子序列。
// speak 回调由调用方提供（默认使用 window.speechSynthesis），便于测试与未来接入
// 本地神经 TTS（如 Kokoro）而不改控制逻辑。
export class Narrator extends EventTarget {
  #queue = [];
  #index = 0;
  #state = 'idle'; // idle | speaking | paused | ended
  #token = 0;
  #speak;
  #cancel;
  #pause;
  #resume;
  #current = null;

  constructor({ speak, cancel, pause, resume } = {}) {
    super();
    this.#speak = speak;
    this.#cancel = cancel;
    this.#pause = pause;
    this.#resume = resume;
  }

  get state() { return this.#state; }
  get index() { return this.#index; }
  get queue() { return this.#queue; }
  get current() { return this.#current; }

  #emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  #setState(state) {
    if (this.#state === state) return;
    this.#state = state;
    this.#emit('statechange', { state });
  }

  load(sentences, startIndex = 0) {
    this.stop();
    this.#queue = Array.isArray(sentences) ? sentences.slice() : [];
    this.#index = Math.max(0, Math.min(startIndex, Math.max(0, this.#queue.length - 1)));
    this.#emit('load', { length: this.#queue.length, startIndex: this.#index });
  }

  // 返回的 Promise 只用于测试与「读完了」的编排；它可能在 stop()/seek() 之后
  // 才 resolve，因此调用方不应把它当作唯一进度信号（进度看 position 事件）。
  async play() {
    if (!this.#speak || !this.#queue.length) return;
    if (this.#state === 'paused') { this.#resume?.(); this.#setState('speaking'); this.#runCycle(); return; }
    if (this.#state === 'speaking') return;
    this.#setState('speaking');
    const run = ++this.#token;
    await this.#pump(run);
  }

  pause() {
    if (this.#state !== 'speaking') return;
    this.#pause?.();
    this.#setState('paused');
  }

  // 浏览器的 speechSynthesis.resume() 只恢复被 pause() 挂起的那一句，
  // 不会自动继续下一句；这里重新驱动队列，保证「继续」真的能读下去。
  resume() {
    if (this.#state !== 'paused') return;
    this.#resume?.();
    this.#setState('speaking');
    this.#runCycle();
  }

  stop() {
    this.#token++;
    this.#cancel?.();
    this.#current = null;
    this.#setState('idle');
  }

  seek(index) {
    const i = Math.max(0, Math.min(Number(index) || 0, this.#queue.length - 1));
    this.#token++;
    this.#cancel?.();
    this.#index = i;
    this.#current = null;
    this.#emit('position', { index: i, sentence: this.#queue[i] });
    if (this.#state !== 'idle' && this.#state !== 'ended') {
      this.#state = 'idle';
      this.#emit('statechange', { state: 'idle' });
      this.#runCycle();
    }
  }

  // 朗读循环不返回长驻 Promise：旧循环在被取消后立刻结束，
  // 避免连续跳转时在上一个 play() 上堆积未完成的 Promise。
  #runCycle() {
    const run = ++this.#token;
    this.#setState('speaking');
    this.#pump(run);
  }

  #speakOne(sentence, run) {
    return new Promise((resolve, reject) => {
      this.#speak(sentence, resolve, reject, run);
    });
  }

  async #pump(run) {
    while (run === this.#token && this.#index < this.#queue.length) {
      const sentence = this.#queue[this.#index];
      this.#current = sentence;
      this.#emit('position', { index: this.#index, sentence });
      try {
        await this.#speakOne(sentence, run);
      } catch (err) {
        if (run !== this.#token) return;
        this.#setState('idle');
        this.#emit('error', { error: err, index: this.#index });
        return;
      }
      if (run !== this.#token) return;
      this.#index++;
    }
    if (run !== this.#token) return;
    this.#current = null;
    this.#setState('ended');
    this.#emit('ended', {});
  }
}
