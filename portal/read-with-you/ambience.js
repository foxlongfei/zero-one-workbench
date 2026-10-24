// Environment sounds generated on this device from a fixed-seed PRNG, so they
// are original, public-domain-friendly, offline, and tiny in the repository.
// Each scene renders a seamless loop of `SECONDS` and caches one object URL.

export const SECONDS = 12;
export const SAMPLE_RATE = 22050;

export const AMBIENCE = [
  { id: 'rain', name: '窗外小雨', hint: '屋檐下的雨声，很适合长段落的夜晚' },
  { id: 'fire', name: '壁炉', hint: '木柴轻轻噼啪，适合冬天的午后' },
  { id: 'train', name: '夜行列车', hint: '匀速的轨道声，适合通勤或旅途' },
  { id: 'window', name: '窗外微风', hint: '风吹过树叶的低低沙沙声' },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

function renderScene(id, rate = SAMPLE_RATE, seconds = SECONDS) {
  const length = Math.floor(rate * seconds);
  const out = new Float32Array(length);
  const random = mulberry32(id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0) * 7, 11));
  const noise = () => random() * 2 - 1;
  let last = 0;

  if (id === 'rain') {
    // Layered small drops over a soft brown-noise bed; every sound wraps to the
    // loop start so there is no gap when the audio repeats.
    for (let i = 0; i < length; i++) {
      last = 0.42 * last + noise() * 0.58;
      out[i] = last * 0.32;
    }
    const drops = Math.floor(seconds * 22);
    for (let n = 0; n < drops; n++) {
      const start = Math.floor(random() * length);
      const amp = 0.12 + random() * 0.2;
      const decay = 30 + random() * 60;
      const dur = Math.floor(rate * 0.05);
      for (let k = 0; k < dur; k++) {
        const env = Math.exp(-k / decay);
        if (env < 0.002) break;
        const index = (start + k) % length;
        out[index] += noise() * env * amp * 0.5;
      }
    }
    // A faint continuous hiss gives the rain a "room" instead of a hiss-less bed.
    for (let i = 0; i < length; i++) out[i] += (random() * 2 - 1) * 0.016;
  } else if (id === 'fire') {
    for (let i = 0; i < length; i++) {
      last = 0.55 * last + noise() * 0.45;
      // Slow breathing swell so it feels alive rather than a static hiss.
      const swell = 0.68 + 0.32 * Math.sin((TAU * i) / length * 3 + 1.4);
      out[i] = last * 0.3 * swell;
    }
    const crackles = Math.floor(seconds * 9);
    for (let n = 0; n < crackles; n++) {
      const start = Math.floor(random() * length);
      const amp = 0.4 + random() * 0.5;
      const dur = Math.floor(rate * (0.004 + random() * 0.012));
      for (let k = 0; k < dur; k++) {
        const env = Math.exp(-k / (dur * 0.28));
        out[(start + k) % length] += noise() * env * amp;
      }
    }
  } else if (id === 'train') {
    let low = 0;
    let rumble = 0;
    for (let i = 0; i < length; i++) {
      rumble = 0.92 * rumble + noise() * 0.08;
      low = 0.996 * low + noise() * 0.004;
      const clack = Math.pow(Math.max(0, Math.sin((TAU * i * 2.1) / rate)), 18);
      out[i] = low * 2.4 + rumble * 1.7 + clack * 0.045;
    }
    for (let beat = 0; beat < seconds * 2.1; beat++) {
      const start = Math.floor((beat / 2.1) * rate);
      for (let k = 0; k < rate * 0.03; k++) {
        out[(start + k) % length] += noise() * Math.exp(-k / (rate * 0.006)) * 0.22;
      }
    }
  } else if (id === 'window') {
    for (let i = 0; i < length; i++) {
      last = 0.88 * last + noise() * 0.12;
      const gust = 0.55 + 0.45 * Math.sin((TAU * i) / length * 2 + 0.6) * Math.sin((TAU * i) / length * 5.3);
      out[i] = last * 1.6 * Math.max(0.15, gust);
    }
  } else {
    for (let i = 0; i < length; i++) out[i] = noise() * 0.05;
  }

  // Normalise to -18 dBFS-ish and crossfade the seam for a seamless loop.
  let peak = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const gain = peak > 0 ? 0.25 / peak : 1;
  for (let i = 0; i < length; i++) out[i] *= gain;

  const fade = Math.floor(rate * 0.35);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    out[i] = out[i] * t + out[length - fade + i] * (1 - t);
  }
  return out.subarray(0, length - fade);
}

/** Encode mono float samples as a 16-bit PCM WAV. */
export function encodeWav(samples, rate = SAMPLE_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

const cache = new Map();

export function makeAmbience(id) {
  const meta = AMBIENCE.find((item) => item.id === id);
  if (!meta) return null;
  if (!cache.has(id)) {
    const wav = encodeWav(renderScene(id));
    cache.set(id, { ...meta, blob: wav, wavUrl: URL.createObjectURL(wav) });
  }
  return cache.get(id);
}

export function warmAmbience(ids = AMBIENCE.map((item) => item.id)) {
  for (const id of ids) makeAmbience(id);
}
