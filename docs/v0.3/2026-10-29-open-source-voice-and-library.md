# 陪你读书 V0.3｜开源神经语音、声音训练与公版书库｜2026-10-29

> 后续增量：书架首页、批量导入、长篇阅读、文字同步和第二个离线声音包已完成，测试数与最新改动见 `docs/v0.3/2026-10-29-reader-home-and-sync.md`。

本轮由 D 博士自主完成，目标是把 V0.3 从「浏览器朗读 + 手动导入」推进到：

1. 开源、成熟的神经语音模型，中文可用，且能在浏览器本机运行；
2. 电子书格式多样性，并接入真实开放书库；
3. 声音本人授权的声音训练/建模后，再用该声音朗读。

## 1. 技术选择与理由

### 1.1 神经语音：Piper Plus zs-v1

选择 `piper-plus` + `ayousanz/piper-plus-base` 的 zs-v1 组合：

| 组成 | 许可 | 作用 |
| --- | --- | --- |
| `piper-plus` 浏览器运行时（VITS / MB-iSTFT-VITS2） | MIT | 浏览器内 ONNX/WASM 合成、SSML、流式句子输出 |
| zs-v1 TTS 权重（`base.onnx`） | MIT | 中文/英文/日文等 6 语言，40 MB 左右 |
| CAM++ 声音编码器（`campplus.onnx`） | Apache-2.0 | 从 5–15 秒参考音频提取 192 维声音特征 |

选择理由：

- 中文、英文都能用，中文不依赖英文 espake 音素化；
- 全部在浏览器本机运行，文本和录音不上传；
- 音频合成实测约 0.4× 实时（headless Chromium/CPU），适合按段落朗读；
- 同一模型既能用示范声音，也能用本人授权录音做零样本声音条件，不需要另起一套 TTS；
- 许可比 Chatterbox / ZipVoice 的部分权重更干净，且不需要 GPU 或自建服务器。

没有选用 Kokoro-js 作为主引擎，因为其 npm 封装只暴露英文 voice 校验；没有选用 ZipVoice/Chatterbox，因为完整 ONNX 推理需要服务器或数 GB 权重，且许可证含非商用/数据集限制，不适合当前纯静态原型。

### 1.2 公版书库：Standard Ebooks

- 书目页 `https://standardebooks.org/ebooks?query=...` 返回 `access-control-allow-origin: *`，浏览器可直接搜索；
- EPUB 和 AZW3 下载地址带 `?source=download`，同样允许跨域读取；
- 页面解析标题、作者、封面和 book path，下载后直接用现有 foliate-js 导入；
- 不转存、不重新分发书籍；只保存到用户本机 IndexedDB；
- 公版判断以美国法律为准，页面明确提示其他地区自行核对。

### 1.3 电子书格式

现有 foliate-js 集成支持：

`EPUB` · `AZW3` · `MOBI` · `FB2` · `CBZ` · `TXT`

本轮修复了 CBZ 的打开路径：CBZ 是图像页，不是 XHTML 文档，不能按普通 EPUB 提取段落。现在 CBZ 可翻页阅读，界面明确标注「图像漫画，暂不支持朗读图像页」，并把听书按钮禁用。

## 2. 产品流程

1. **书架**：导入本地文件，或进入「公版书库」搜索 Standard Ebooks 并导入 EPUB/AZW3。
2. **阅读**：目录、跨章节连续听书、暂停/恢复、进度记忆、笔记、背景音。
3. **声音**：
   - 默认浏览器语音，开箱即用；
   - 「开源神经语音 · Piper Plus」：下载/加载模型，选择示范声音或本机训练声音，试听；
   - 「本机声音训练」：勾选授权、录制 8 秒或选择参考音频、训练、自动切换并试听；
   - 训练声音以 192 维特征保存在本机 IndexedDB，可删除；参考音频不保存、不上传；
   - 原有自建声音库保留为高级选项，不阻塞本机神经网络。
4. **听世界**：保留现有电台/背景音入口。

## 3. 本轮新增/修改的文件

- `portal/reader-v03/lib/piper.mjs`：Piper Plus 运行时封装、参考音频编码、合成播放、音频上下文解锁；
- `portal/reader-v03/lib/library.mjs`：Standard Ebooks 搜索、解析、下载 URL；
- `portal/reader-v03/data/piper-demo-voice.json`：192 维示范声音特征（非音频，不含真人录音）；
- `portal/reader-v03/app.mjs`：引擎/训练/书库 UI 接线、CBZ 处理、声音特征持久化；
- `portal/reader-v03/index.html`：Piper 卡片、训练卡片、公版书库页面、import map；
- `tests/reader-v03/neural-check.mjs`：真实模型加载、示范试听、训练、朗读、刷新持久化；
- `tests/reader-v03/library-check.mjs`：真实 Standard Ebooks 搜索、EPUB/AZW3 导入、AZW3 打开；
- `tests/reader-v03/formats-check.mjs`：FB2/CBZ/MOBI 真实导入与打开；
- `tests/reader-v03/piper.test.mjs` / `library.test.mjs`：模型元数据、语言检测、示范特征、下载 URL 契约；
- `tests/reader-v03/make-fixtures.py`：新增 FB2/CBZ 测试夹具。

## 4. 实测结果

命令：

```bash
node --test tests/reader-v03/core.test.mjs tests/reader-v03/pacing.test.mjs tests/reader-v03/voice-library.test.mjs tests/reader-v03/library.test.mjs tests/reader-v03/piper.test.mjs
node tests/reader-v03/browser-check.mjs --playwright=<playwright>
node tests/reader-v03/neural-check.mjs --playwright=<playwright>
node tests/reader-v03/library-check.mjs --playwright=<playwright>
node tests/reader-v03/formats-check.mjs --playwright=<playwright>
```

结果：

- 单元测试：33/33 通过；
- 本地真实 Chromium：49/49，0 页面错误；
- 神经语音/声音训练：9/9，首次模型加载约 22 秒，整轮约 42 秒；
- 公版书库：8/8，真实搜索并导入 EPUB + AZW3；
- 格式：6/6，TXT/EPUB/FB2/CBZ/MOBI 均导入，AZW3 由书库测试覆盖；
- 证据写入 `artifacts/reader-v03/neural-evidence.json`、`library-evidence.json`、`formats-evidence.json`（测试产物，不在仓库提交）。

## 5. 许可与隐私边界

- 代码/运行时：MIT；Piper Plus zs-v1 权重：MIT；CAM++：Apache-2.0；
- 示范声音特征来自模型发布方 `zh-ft.wav` 示例，仅用于试听；不是真人录音，也不作为用户声音；
- 用户训练声音必须勾选授权声明，特征只存本机 IndexedDB，可删除；
- 合成音频在界面标注为合成语音；不得用于冒充他人；
- 文本、参考音频、声音特征不上传；首次加载模型会访问 unpkg / jsDelivr / Hugging Face，之后浏览器缓存；
- 需要付费的云 TTS 与 AI 讨论接口已移除；保留的神经语音、浏览器语音和自建声音库都不需要按次付费。

## 6. 未完成的真实缺口

1. 声音「训练」是本机零样本声音条件，不是梯度微调；相似度和自然度受参考音频质量、模型实验状态限制。
2. 首次加载约 70 MB，依赖 CDN/Hugging Face；模型会被缓存，但运行库/网页缓存是否完全离线取决于浏览器。
3. 真机麦克风、iOS Safari、锁屏/后台播放、系统音频焦点未在真实设备上验收。
4. Standard Ebooks 公版范围按美国法律，其他地区需用户自行判断。
5. 没有云同步；清站点数据会丢失书架、笔记和训练声音。
6. 两轮独立盲测和用户本人验收尚未发生。
