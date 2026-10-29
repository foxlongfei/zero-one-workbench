# 陪你读书 V0.3｜更自然的中文声线与本机高音质克隆｜2026-10-29

本轮按试用反馈处理两件事：Piper Plus zs-v1 训练声音偏刺耳，其他朗读声线偏硬、缺少自然语气。

## 1. 新增 Kokoro-82M-v1.1-zh 自然中文声线（Apache-2.0）

- 模型：`hexgrad/Kokoro-82M-v1.1-zh`，82M 参数，使用 100 个专业中文说话人数据训练。
- 运行：`onnxruntime-web` + 官方 v1.1 的 Zhuyin/拼音 token 表；ONNX 权重来自可用的 fp32 社区转换 `xun/kokoro-v1.1-zh-onnx`，模型和文本都在本机合成，不上传。
- 中文 G2P 由本机 `pinyin-pro` + 三声变调处理后生成 Zhuyin token，不再使用 espeak-ng；因此没有 GPL 运行时依赖。
- 首次下载约 330 MB，之后由浏览器缓存；单段生成在无头 2 vCPU 环境约 20 秒，真机通常更快。
- 当前在朗读面板和声音页提供 9 个中文声线（5 女 4 男），可逐个试听；模型本身有 100 个声线，后续可按反馈增加。
- 这是自然度更好的“固定声线”，不能克隆某个人；克隆走下面的 ZipVoice 或 Piper。
- 许可：基座模型 Apache-2.0；`pinyin-pro`、`onnxruntime-web` 为 MIT。社区 ONNX 转换仓库未单独声明许可证，使用时保留基座模型与转换来源说明。

## 2. 新增 ZipVoice 本机高音质克隆（实验）

- 模型：ZipVoice-Distill int8，123M 参数，中英双语零样本克隆，通过 sherpa-onnx WASM 在浏览器本机运行。
- 需要两样输入：3–10 秒参考录音，以及和录音完全一致的逐字稿；不再使用 192 维声音特征近似。
- 参考录音、逐字稿和合成音频都只在本机 IndexedDB/内存中，不上传；保存时必须再次确认声音本人授权。
- 首次下载约 200 MB，模型加载约 10–20 秒，生成明显慢于 Piper：无头 2 vCPU 环境一段约 20–60 秒，真机取决于 CPU。
- 模型权重因 Emilia 训练数据限制为 CC-BY-NC，界面明确标注“仅限非商业用途”；代码和 sherpa-onnx 为 Apache-2.0。
- 这是当前能在纯静态页面、无服务器、无 GPU 条件下提供的最佳本机克隆方案；如果追求最快的广播级情感克隆，仍需自建 GPU 服务（IndexTTS-2.5、CosyVoice 3 等），不属于本轮范围。

## 3. Piper 刺耳问题的缓解

- 在 Piper 合成后增加本机“暖声”滤波：85 Hz 高通、3.2 kHz 约 -4 dB 存在感衰减、4.5 kHz 约 -7 dB 高频搁架、8.5 kHz 低通，再做 RMS 归一和峰值限制。
- 这能压低 zs-v1 实验权重的高频毛刺和齿音，但不会把 Piper 变成录音棚音质；真正的升级是改用 Kokoro（固定声线）或 ZipVoice（克隆）。
- 滤波在 `portal/reader-v03/lib/piper.mjs` 的 `softenSpeechSamples` 中，可单独测试；不影响 Mera 的模型权重。

## 4. 界面与隐私

- 朗读面板的“声音来源”现在包含：本机浏览器语音、Kokoro 自然中文、Piper 神经语音、ZipVoice 高音质克隆、家庭授权声音。
- 每个引擎有独立的声线选择；Kokoro 和 ZipVoice 的字段只在对应引擎下显示。
- 声音页新增 Kokoro 卡片和 ZipVoice 卡片；ZipVoice 支持文件导入、8 秒录音、逐字稿、授权勾选、试听、删除。
- 所有参考录音和逐字稿只在本机保存；ZipVoice 删除时会同时删除 IndexedDB 中的参考录音。
- 公网页面只从 Hugging Face 下载模型和声线，不发送书稿、录音或逐字稿。

## 5. 测试

```text
node --test tests/reader-v03/core.test.mjs tests/reader-v03/pacing.test.mjs tests/reader-v03/voice-library.test.mjs tests/reader-v03/library.test.mjs tests/reader-v03/piper.test.mjs
→ 43/43 pass

node tests/reader-v03/browser-check.mjs --playwright=<playwright> --chrome=<chromium>
→ PASS, 56 checks, 0 page errors

node tests/reader-v03/kokoro-check.mjs --playwright=<playwright>
→ PASS, 7 checks, 0 page errors

node tests/reader-v03/zipvoice-check.mjs --playwright=<playwright>
→ PASS, 9 checks, 0 page errors
```

ZipVoice 测试会真实下载约 200 MB 模型并生成一段试听；Kokoro 测试会下载约 330 MB 的 fp32 模型。两者都是独立脚本，不拖慢日常浏览器回归。

公网读回（提交 `5deb6bb`）：

```text
node tests/reader-v03/browser-check.mjs --playwright=<playwright> --chrome=<chromium> --base-url=https://foxlongfei.github.io/zero-one-workbench --no-voice-library
→ PASS, 47 checks, 0 page errors

node tests/reader-v03/kokoro-check.mjs --playwright=<playwright> --base-url=https://foxlongfei.github.io/zero-one-workbench
→ PASS, 7 checks, 0 page errors

node tests/reader-v03/zipvoice-check.mjs --playwright=<playwright> --base-url=https://foxlongfei.github.io/zero-one-workbench
→ PASS, 9 checks, 0 page errors
```

本地与公网 `index.html`、`app.mjs`、`lib/kokoro.mjs`、`lib/zipvoice.mjs`、`lib/zh-g2p.mjs`、`vendor/pinyin-pro/index.mjs` 的 SHA-256 一致；读回记录见 `reports/v03/2026-10-29-natural-chinese-and-zipvoice.json`。

## 6. 边界

- Kokoro 是固定声线，不能克隆；当前只暴露 9 个声线，未逐一做主观盲测。
- Kokoro 使用 fp32 ONNX（约 330 MB）。同一模型的 int8 导出在 onnxruntime-web 的 WASM 后端会生成不可懂音频，因此没有采用；`onnx-community` 的 v1.1 导出也未能生成可懂中文。
- 中文 G2P 是 pinyin-pro + 简化变调，不是官方 misaki 的完整 jieba/POS 前端；个别多音字（例如“行长”）仍可能读错。
- 330 MB 首次下载对移动网络较重，模型缓存占用也较大；低带宽设备可以继续用 Piper。
- ZipVoice 权重是非商用授权；生成不是流式，长段朗读需要等待；参考录音与逐字稿不一致会明显降低质量。
- Piper 暖声滤波是舒适度修复，不是模型升级；已有的 192 维训练声音会继续保留。
- 真机扬声器、蓝牙、iOS Safari、锁屏播放、后台音频焦点和用户本人验收仍未完成。
- 真正接近商业产品“味道”的情感克隆需要自建 GPU 服务；本轮没有部署，也没有把云端服务冒充成本机能力。

## 7. 怎么用

1. 打开 `portal/reader-v03/index.html`，进入「声音」页。
2. 想要自然朗读：在「开源自然中文 · Kokoro」点“下载 / 加载模型”，选择声线后试听，再回阅读页把「声音来源」切到 Kokoro。
3. 想要克隆家人声音：在「高音质克隆 · ZipVoice」录制或选择 3–10 秒参考声音，原样填写逐字稿，勾选授权，保存并试听。首次使用需下载约 200 MB，生成会慢一些。
4. 只想快速试听：继续用 Piper；新的暖声滤波会降低刺耳感，但自然度仍不如 Kokoro/ZipVoice。
