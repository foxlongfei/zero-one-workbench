# Vendored: @huggingface/transformers 3.7.5 (Apache-2.0)

Files copied verbatim from the npm package `@huggingface/transformers@3.7.5`
(`dist/`), pinned so the reader never depends on a CDN at runtime.

| File | Purpose |
| --- | --- |
| `transformers.min.js` | Text-processing runtime; loaded with `{ env: { backends: { onnx: { wasm: { wasmPaths: null } } }, allowLocalModels: true, useBrowserCache: false } }` |
| `ort-wasm-simd-threaded.jsep.mjs` | ONNX Runtime Web loader required by the bundle at import time (no model is ever fetched) |
| `ort-wasm-simd-threaded.jsep.wasm` | ONNX Runtime Web WASM binary required by the same loader |
| `LICENSE` | Upstream Apache-2.0 license text |

Why: mainstream browsers still refuse `new TextDecoder('gb18030')` (HarmonyOS
Chrome, some embedded WebViews). Legacy Chinese `.txt` books are commonly
GB18030/GBK. transformers.js bundles a WASM-backed TextDecoder, so
`portal/js/books/decode.js` uses it as the fallback decoder. Only the decoding
path is used — no model weights ship with this repository.

SHA-256 (verify after updating):

```
770f4cfc9857958f8db9c783b406b1c7f3beb3ce0c9b72776ca1e973dae9e145  transformers.min.js
08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9  ort-wasm-simd-threaded.jsep.mjs
c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39  ort-wasm-simd-threaded.jsep.wasm
cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30  LICENSE
```

Upstream: https://github.com/huggingface/transformers.js
