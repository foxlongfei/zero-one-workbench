#!/usr/bin/env node
// Household voice library for 陪你读书.
//
// Self-hosted, dependency-free Node service that stores consenting family
// voice samples and answers with authorised speech. Consent is enforced here:
// `POST /api/speak` refuses revoked voices, and deletion removes the samples.
// See README.md for the data model, fees and privacy statement.

import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VoiceStore, CONSENT_STATEMENT } from './store.mjs';
import { synthesizeSpeech, DEFAULT_PITCH } from './synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 12 * 1024 * 1024;

const json = (res, code, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
};

const readBody = req => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', chunk => {
    size += chunk.length;
    if (size > MAX_BODY) {
      reject(Object.assign(new Error('请求体过大'), { statusCode: 413 }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    try {
      resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
    } catch (error) {
      reject(Object.assign(new Error(`JSON 解析失败：${error.message}`), { statusCode: 400 }));
    }
  });
  req.on('error', reject);
});

const cors = res => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type,authorization,x-license-token');
};

// The licence token is optional; when LIBRARY_TOKEN is set every API call must
// present it, so a publicly reachable instance cannot be used as an oracle.
const authorized = (req, env) => {
  if (!env.LIBRARY_TOKEN) return true;
  const header = req.headers['x-license-token'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return header === env.LIBRARY_TOKEN;
};

const consentPage = () => `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>家庭声音授权说明 · 陪你读书</title>
<style>body{font-family:system-ui,"Noto Sans SC",sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;line-height:1.75;color:#222}code{background:#f2f2f2;padding:.1rem .3rem;border-radius:4px}h1{font-size:1.5rem}li{margin:.4rem 0}</style>
<h1>家庭声音授权说明</h1>
<p>本服务是「陪你读书」自建的家庭声音库，用来让家人用自己的声音朗读电子书。它只保存声音本人授权的样本。</p>
<h2>我们保存什么</h2>
<ul><li>声音样本文件（默认三段，每段约 5–8 秒）及其 SHA-256 指纹；</li><li>授权记录：称呼、关系、授权时间、授权声明的原文；</li><li>使用记录：何时被朗读过（只记录时间与声音 id，不记录朗读内容）。</li></ul>
<h2>我们不做什么</h2>
<ul><li>不把声音样本或音色发送给未在授权声明中列出的第三方；</li><li>不克隆未获本人明确授权的声音，包括公众人物；</li><li>不用合成音冒充真人录音，界面上始终标注为合成语音。</li></ul>
<h2>声音本人的权利</h2>
<ul><li>随时撤销授权：<code>POST /api/voices/{id}/revoke</code>，撤销后合成立即被拒绝；</li><li>随时恢复：<code>POST /api/voices/{id}/restore</code>；</li><li>随时删除：<code>DELETE /api/voices/{id}</code>，样本与授权记录同时删除，只留不可逆的删除凭证。</li></ul>
<h2>费用</h2>
<p>本服务自托管，样本与合成都在自己的机器上完成，不产生按次调用费用；若接入外部语音供应商，费用由该供应商按其价目表收取，界面会在「声音」页写明当前使用的是哪一种。</p>
<h2>当前合成方式</h2>
<p>内置合成器是本站生成的共振峰合成，音色取自样本的基频估计，<strong>并不会复制原声</strong>。要获得接近原声的效果，需要另行部署自愿授权的语音克隆供应商。</p>
<p>授权声明原文：<q>${CONSENT_STATEMENT}</q></p>
</html>`;

export function createVoiceLibrary({ root = join(here, 'data'), env = process.env } = {}) {
  const store = new VoiceStore(root);
  const ready = store.init();

  const handler = async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    await ready;

    if (path === '/' || path === '/consent') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(consentPage());
      return;
    }
    if (path === '/api/health') { json(res, 200, { ok: true, voices: (await store.list()).length }); return; }
    if (path.startsWith('/api/') && !authorized(req, env)) { json(res, 401, { error: '缺少或错误的访问令牌' }); return; }

    if (path === '/api/voices' && req.method === 'GET') {
      json(res, 200, { voices: await store.list(), config: { synth: env.TTS_PROVIDER === 'external' ? 'external' : 'formant', consentStatement: CONSENT_STATEMENT } });
      return;
    }
    if (path === '/api/voices' && req.method === 'POST') {
      const body = await readBody(req);
      const voice = await store.create(body);
      json(res, 201, voice);
      return;
    }
    const match = path.match(/^\/api\/voices\/([A-Za-z0-9_-]+)(\/[a-z]+)?$/);
    if (match) {
      const [, id, action = ''] = match;
      if (!action && req.method === 'GET') {
        const voice = await store.get(id);
        return voice ? json(res, 200, voice) : json(res, 404, { error: '声音不存在' });
      }
      if (!action && req.method === 'DELETE') {
        const removed = await store.remove(id);
        return removed ? json(res, 200, removed) : json(res, 404, { error: '声音不存在' });
      }
      if (action === '/revoke' && req.method === 'POST') {
        const voice = await store.revoke(id);
        return voice ? json(res, 200, voice) : json(res, 404, { error: '声音不存在' });
      }
      if (action === '/restore' && req.method === 'POST') {
        const voice = await store.restore(id);
        return voice ? json(res, 200, voice) : json(res, 404, { error: '声音不存在' });
      }
      json(res, 405, { error: '不支持的方法' });
      return;
    }
    if (path === '/api/speak' && req.method === 'POST') {
      const { voiceId, text, speed = 1, pitch } = await readBody(req);
      const gate = await store.authorize(voiceId);
      if (!gate.ok) { json(res, gate.code, { error: gate.error }); return; }
      if (!text || !String(text).trim()) { json(res, 400, { error: '朗读文本为空' }); return; }
      const audio = synthesizeSpeech(String(text), {
        pitch: Number(pitch) || Number(gate.record.pitch) || DEFAULT_PITCH,
        speed,
      });
      await store.markSynth(voiceId);
      res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': audio.length, 'cache-control': 'no-store' });
      res.end(audio);
      return;
    }
    json(res, 404, { error: '接口不存在' });
  };

  return createServer((req, res) => {
    handler(req, res).catch(error => {
      const code = error.statusCode || 500;
      if (code === 500) console.error(error);
      if (!res.headersSent) json(res, code, { error: error.message });
      else res.end();
    });
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT) || 8787;
  const server = createVoiceLibrary();
  server.listen(port, () => {
    console.log(`家庭声音库已启动 http://127.0.0.1:${port} （授权说明：/consent）`);
    if (!process.env.LIBRARY_TOKEN) console.log('提示：未设置 LIBRARY_TOKEN，任何能访问本端口的人都可以调用接口。公网部署请设置该变量。');
  });
}
