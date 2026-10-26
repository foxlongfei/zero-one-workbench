// Choose a speech voice for a book, honestly.
//
// The reader knows three kinds of source: the device's own voices (Web Speech),
// an OpenAI-compatible endpoint configured by the user, and the household voice
// library. Picking well matters because a Chinese book read by an English voice,
// or an English book read by a Mandarin voice, makes the whole product feel
// broken even though every component "works".
//
// This module is pure: callers pass the candidate list, and get back a ranked
// choice plus a plain-language reason that the UI shows to the user.

const normaliseLanguage = lang => String(lang ?? '').replace('_', '-').toLowerCase();

export const languageGroup = lang => {
  const value = normaliseLanguage(lang);
  if (value.startsWith('zh') || value === 'cmn' || value.startsWith('yue')) return 'zh';
  if (value.startsWith('en')) return 'en';
  return value.split('-')[0] || 'und';
};

// Voices that are known to sound mechanical or to exist only as placeholders on
// some platforms; ranked last but never hidden.
const LOW_QUALITY = /novelty|albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|organ|trinoids|whisper|zarvox|jester|superstar|grandma|grandpa|rocko|shelley|flo|eddy|reed|sandy/i;

const QUALITY_HINTS = [
  [/natural|neural|premium|enhanced|siri|xiaoxiao|yunxi|yunyang|xiaoyi|liaoning|ting-?ting|meijia|huihui|kangkang|female/i, 12],
  [/google|microsoft|samsung|apple/i, 6],
  [/compact|eloquence|espeak/i, -10],
];

export function voiceScore(voice, { bookLanguage = 'zh', preferredURI = '' } = {}) {
  let score = 0;
  const group = languageGroup(voice?.lang);
  const wanted = languageGroup(bookLanguage);
  if (group === wanted) score += 100;
  else if (wanted === 'zh' && group === 'zh') score += 90;
  else score -= 40;
  // Regional preference inside Chinese: mainland Mandarin first.
  const lang = normaliseLanguage(voice?.lang);
  if (wanted === 'zh' && (lang === 'zh-cn' || lang === 'zh-hans' || lang === 'cmn-hans-cn')) score += 15;
  if (wanted === 'zh' && /tw|hk|hant/.test(lang)) score += 3;
  if (wanted === 'en' && /en-us|en-gb/.test(lang)) score += 10;
  for (const [pattern, weight] of QUALITY_HINTS) if (pattern.test(voice?.name ?? '')) score += weight;
  if (LOW_QUALITY.test(voice?.name ?? '')) score -= 60;
  if (voice?.default && group === wanted) score += 8;
  if (voice?.localService === false) score -= 2;
  if (preferredURI && voice?.voiceURI === preferredURI) score += 500;
  return score;
}

export function rankVoices(voices, context = {}) {
  return [...(voices ?? [])]
    .map(voice => ({ ...voice, score: voiceScore(voice, context) }))
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
}

export function chooseVoice(voices, context = {}) {
  const ranked = rankVoices(voices, context);
  if (!ranked.length) {
    return { voice: null, voided: true, reason: '这台设备还没有可用的系统语音。可以改用在线朗读服务，或先安装中文语音包。' };
  }
  const voice = ranked[0];
  const group = languageGroup(voice.lang);
  const wanted = languageGroup(context.bookLanguage);
  if (group !== wanted) {
    return {
      voice,
      voided: true,
      reason: `这本书看起来是${wanted === 'zh' ? '中文' : wanted === 'en' ? '英文' : '这种语言'}，但设备上没有对应的语音，暂时用「${voice.name}」代读，发音可能不准确。`,
    };
  }
  return { voice, voided: false, reason: `已选择「${voice.name}」（${voice.lang}）朗读。` };
}

// Which engine kind the app should prefer for a given book when the user has not
// expressed a preference. Endpoint and library voices are language-agnostic in
// practice, so they always win over a mismatched device voice.
export function preferredEngine({ bookLanguage = 'zh', endpointReady = false, libraryReady = false, deviceVoice = null } = {}) {
  if (libraryReady) return 'library';
  if (endpointReady) return 'endpoint';
  if (!deviceVoice) return 'endpoint';
  if (languageGroup(deviceVoice.lang) !== languageGroup(bookLanguage)) return 'endpoint';
  return 'browser';
}
