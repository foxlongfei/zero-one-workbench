// A small, honest formant synthesiser used as the built-in voice of the
// household voice library.
//
// It is NOT a neural voice clone and does not pretend to be one: it renders a
// robotic but intelligible singing tone shaped by the consenting speaker's
// sample pitch, so a family can immediately hear "their" voice slot working
// end-to-end while a real cloning provider is configured. The README states this
// limitation explicitly; the UI never claims a synthesised phrase is the
// speaker's own recording.
//
// Pure function, no dependencies: text in, WAV bytes out. Deterministic.

const PUNCTUATION_PAUSE = 0.18;

const isSentenceEnd = ch => '。！？!?；;…\n'.includes(ch);

// Fallback vowel targets (F1, F2 Hz) — used when the text is not Chinese.
const VOWELS = {
  a: [800, 1200], e: [500, 1800], i: [300, 2300], o: [500, 900], u: [350, 800], v: [320, 1900],
};

// Pinyin finals → approximate formant targets, enough for a recognisable,
// pleasant robotic Mandarin reading.
const FINALS = [
  [/iang$|uang$/i, [350, 2100]],
  [/ang$|uan$|an$/i, [750, 1100]],
  [/eng$|ing$|ong$|un$|en$|in$/i, [520, 1500]],
  [/ian$/i, [400, 1900]],
  [/iao$|ao$|iao/i, [720, 1050]],
  [/iu$|ou$|uo$|o$/i, [520, 900]],
  [/ai$|ei$/i, [600, 1700]],
  [/u$/i, [350, 800]],
  [/i$/i, [300, 2300]],
];

const formantsFor = syllable => {
  for (const [pattern, f] of FINALS) if (pattern.test(syllable)) return f;
  const vowel = syllable.match(/[aeiou]/i)?.[0]?.toLowerCase();
  return VOWELS[vowel] || [520, 1300];
};

/**
 * @param {string} text
 * @param {{ sampleRate?: number, pitch?: number, speed?: number }} options
 *   pitch — measured fundamental of the speaker (Hz); speed — multiplier.
 * @returns {Buffer} 16-bit mono WAV
 */
export function synthesizeSpeech(text, { sampleRate = 22050, pitch = 165, speed = 1 } = {}) {
  const characters = [...String(text ?? '')].slice(0, 1200);
  const samples = [];
  const push = samples.push.bind(samples);
  let phase = 0;
  let envelopeLevel = 0;
  const rate = Math.max(0.6, Math.min(2, Number(speed) || 1));
  const f0 = Math.max(90, Math.min(320, Number(pitch) || 165));

  // Per-syllable synthesis: glide between the two formant targets with a
  // vibrato and a syllable envelope so consecutive sounds blend naturally.
  const syllable = (char, seconds, previous) => {
    const target = formantsFor(char);
    const [f1a, f2a] = previous || target;
    const [f1b, f2b] = target;
    const length = Math.max(1, Math.floor(sampleRate * seconds));
    const isPunct = /[\s，。！？、；：,.!?;:]/.test(char);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const ramp = Math.min(1, t * 10) * Math.min(1, (1 - t) * 8);
      const f1 = f1a + (f1b - f1a) * t;
      const f2 = f2a + (f2b - f2a) * t;
      const vibrato = 1 + 0.012 * Math.sin(2 * Math.PI * 5.4 * (i / sampleRate));
      phase += (2 * Math.PI * f0 * vibrato) / sampleRate;
      const glottal = Math.sin(phase) * 0.75 + Math.sin(phase * 2) * 0.16 + Math.sin(phase * 3) * 0.06;
      const buzz = Math.sin(2 * Math.PI * f1 * (i / sampleRate)) * 0.34
        + Math.sin(2 * Math.PI * f2 * (i / sampleRate)) * 0.18;
      const noise = isPunct ? 0 : (Math.random() * 2 - 1) * 0.035;
      const value = (glottal * 0.55 + buzz) * ramp * (isPunct ? 0.1 : 1) + noise;
      envelopeLevel = envelopeLevel * 0.7 + value * 0.3;
      push(envelopeLevel * 0.28);
    }
    return target;
  };

  let previous = null;
  for (const char of characters) {
    if (isSentenceEnd(char)) {
      const length = Math.floor(sampleRate * PUNCTUATION_PAUSE);
      for (let i = 0; i < length; i++) push(0);
      previous = null;
      continue;
    }
    const base = /[\u4e00-\u9fff]/.test(char) ? 0.185 : 0.09;
    previous = syllable(char, base / rate, previous);
  }
  // Never return an empty file: silence is a valid, decodable answer.
  if (!samples.length) samples.push(0, 0);
  return wavFromSamples(samples, sampleRate);
}

export function wavFromSamples(samples, sampleRate = 22050) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(value * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// Rough fundamental estimate from a WAV/WebM buffer is not attempted: the
// service asks the browser for a measured pitch and falls back to the default.
export const DEFAULT_PITCH = 165;
