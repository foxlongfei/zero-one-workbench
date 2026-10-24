#!/usr/bin/env node
// Long-lived JSON-lines bridge to sherpa-onnx offline TTS (Apache-2.0).
// The book server spawns this once; the Python side keeps the ONNX VITS model
// loaded so each paragraph only costs inference time, not model loading.
import { spawn } from 'node:child_process';

const python = process.env.PYTHON_BIN || 'python3';
const program = `
import sys, json, array, base64, wave, io
import sherpa_onnx

def make(config):
    # config is {"model": {...VITS paths...}}; the request's "model" key has to
    # stay nested one level deep so a plain vits path string never reaches here.
    m = config["model"]
    # sherpa-onnx 2.0.0 intermittently rejects the path strings on the very
    # first OfflineTtsModelConfig(...) call in a process ("string indices must
    # be integers"). A default dry-run instance primes the binding.
    sherpa_onnx.OfflineTtsModelConfig()
    vits = sherpa_onnx.OfflineTtsVitsModelConfig(
        model=m["model"], lexicon=m["lexicon"], tokens=m["tokens"],
        dict_dir=m["dict_dir"])
    model = sherpa_onnx.OfflineTtsModelConfig(
        vits=vits, num_threads=int(m.get("threads", 2)), debug=False)
    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=model))

engines = {}
def engine_for(config):
    key = json.dumps(config, sort_keys=True)
    if key not in engines:
        engines[key] = make(config)
    return engines[key]

def wav_b64(samples, rate):
    buf = io.BytesIO()
    w = wave.open(buf, "wb")
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes(array.array("h", [int(max(-1.0, min(1.0, s)) * 32767) for s in samples]).tobytes())
    w.close()
    return base64.b64encode(buf.getvalue()).decode()

def reply(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\\n"); sys.stdout.flush()

for line in sys.stdin:
    line = line.strip()
    if not line: continue
    req = json.loads(line)
    op = req.get("op")
    try:
        if op == "ping":
            reply({"id": req.get("id"), "ok": True})
        elif op == "synth":
            tts = engine_for(req["model"])
            audio = tts.generate(req["text"], sid=int(req.get("sid", 0)), speed=float(req.get("speed", 1.0)))
            reply({"id": req.get("id"), "ok": True, "sampleRate": audio.sample_rate,
                   "duration": len(audio.samples) / audio.sample_rate,
                   "wav": wav_b64(audio.samples, audio.sample_rate)})
        elif op == "exit":
            break
        else:
            reply({"id": req.get("id"), "ok": False, "error": "unknown op " + str(op)})
    except Exception as e:
        reply({"id": req.get("id"), "ok": False, "error": str(e)})
`;
const child = spawn(python, ['-u', '-c', program], { stdio: ['pipe', 'pipe', 'pipe'] });
child.stderr.on('data', d => process.stderr.write(d));
const pending = new Map();
let seq = 0;
let buffer = '';
child.stdout.setEncoding('utf8');
child.stdout.on('data', chunk => {
  buffer += chunk;
  let at;
  while ((at = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, at);
    buffer = buffer.slice(at + 1);
    if (!line.trim()) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    const resolve = pending.get(msg.id);
    if (resolve) { pending.delete(msg.id); resolve(msg); }
  }
});
child.on('exit', code => {
  for (const resolve of pending.values()) resolve({ ok: false, error: `sherpa-onnx exited (${code})` });
  pending.clear();
  process.exit(Number.isInteger(code) ? code : 1);
});
const call = req => new Promise(resolve => {
  const id = ++seq;
  pending.set(id, resolve);
  child.stdin.write(JSON.stringify({ ...req, id }) + '\n');
});
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
  let at;
  while ((at = input.indexOf('\n')) >= 0) {
    const line = input.slice(0, at);
    input = input.slice(at + 1);
    if (!line.trim()) continue;
    let req;
    try { req = JSON.parse(line); } catch { continue; }
    if (req.op === 'exit') child.stdin.write(JSON.stringify({ op: 'exit' }) + '\n');
    else call({ op: req.op, text: req.text, speed: req.speed, voice: req.voice, sid: req.sid, model: req.model }).then(msg => process.stdout.write(JSON.stringify({ ...msg, id: req.id }) + '\n'));
  }
});
process.stdin.on('end', () => { child.stdin.end(); });
