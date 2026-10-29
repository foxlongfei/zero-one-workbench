// Classic worker for ZipVoice (sherpa-onnx WASM).
//
// The runtime and model files are loaded from the official k2-fsa static Space
// on Hugging Face. ZipVoice needs both the reference audio and its exact
// transcript; the audio is transferred from the main thread, synthesised
// locally, and never uploaded anywhere else.

const BASE = 'https://k2-fsa-web-assembly-zh-en-tts-zipvoice.static.hf.space/';
let tts = null;

self.Module = {
  locateFile: path => (path.endsWith('.data') || path.endsWith('.wasm')) ? BASE + path : path,
  setStatus: status => self.postMessage({ type: 'zipvoice-progress', status }),
  onRuntimeInitialized: () => {
    try {
      tts = createOfflineTts(self.Module);
      self.postMessage({ type: 'zipvoice-ready', modelType: getDefaultOfflineTtsModelType() });
    } catch (error) {
      self.postMessage({ type: 'zipvoice-error', message: error.message });
    }
  },
};

importScripts(BASE + 'sherpa-onnx-wasm-main-tts.js');
importScripts(BASE + 'sherpa-onnx-tts.js');

self.onmessage = event => {
  const { type, id, text, config } = event.data || {};
  if (type !== 'zipvoice-generate' || !tts) return;
  try {
    const genConfig = {
      ...(config || {}),
      callback: (samples, n, progress) => {
        self.postMessage({ type: 'zipvoice-generation-progress', id, progress });
        return 1;
      },
    };
    const audio = tts.generateWithConfig(text, genConfig);
    self.postMessage({
      type: 'zipvoice-result',
      id,
      samples: audio.samples,
      sampleRate: audio.sampleRate,
    }, [audio.samples.buffer]);
  } catch (error) {
    self.postMessage({ type: 'zipvoice-error', id, message: error.message });
  }
};
