// Device voices, picked honestly for the book at hand.
//
// Web Speech voices differ wildly: a Windows laptop may ship three Chinese
// voices while an Android phone ships none; Chrome's list arrives
// asynchronously and changes when the tab regains focus. This module hides that
// flakiness behind a small promise-based API so the reader always has an
// answer to "which voice, and is it right for this book?".

import { rankVoices, chooseVoice, languageGroup } from './voice-choice.mjs';

const pick = voice => ({
  voiceURI: voice.voiceURI,
  name: voice.name,
  lang: voice.lang,
  default: Boolean(voice.default),
  localService: voice.localService !== false,
});

export function createVoiceCatalog({ speech = globalThis.speechSynthesis, timeoutMs = 1200 } = {}) {
  let cached = [];

  const read = () => {
    if (!speech?.getVoices) return [];
    try { return speech.getVoices().map(pick); } catch { return []; }
  };

  // Resolves once voices exist or the timeout passes; never rejects.
  const load = async () => {
    cached = read();
    if (cached.length) return cached;
    if (!speech) return cached;
    await new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        speech.removeEventListener?.('voiceschanged', finish);
        cached = read();
        resolve();
      };
      speech.addEventListener?.('voiceschanged', finish);
      setTimeout(finish, timeoutMs);
    });
    return cached;
  };

  return {
    load,
    list: () => (cached.length ? cached : read()),
    // Voices for a book language first, then everything else, for a stable menu.
    grouped(bookLanguage) {
      const voices = this.list();
      const group = languageGroup(bookLanguage);
      const matching = rankVoices(voices.filter(v => languageGroup(v.lang) === group), { bookLanguage });
      const others = rankVoices(voices.filter(v => languageGroup(v.lang) !== group), { bookLanguage });
      return { matching, others };
    },
    choose(bookLanguage, preferredURI = '') {
      return chooseVoice(this.list(), { bookLanguage, preferredURI });
    },
    refresh() { cached = read(); return cached; },
  };
}
