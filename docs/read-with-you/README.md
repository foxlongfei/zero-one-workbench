# 陪你读书 · 家庭阅读器（D博士独立产品线）

> 入口：`portal/read-with-you.html`。测试：`tests/read-with-you/`。本文件说明这一版实际做了什么、依赖什么许可、怎么跑起来，以及还没做的部分。以可复现的测试证据为准，不以代码存在为准。

## 一、这一版能做什么

| 能力 | 状态 | 证据 |
| --- | --- | --- |
| TXT 导入（UTF-8 / GB18030、章节自动识别） | 实现并通过浏览器测试 | `tests/read-with-you/runner.mjs`：`TXT split into front matter + 3 chapters`、`GB18030 text decoded without mojibake` |
| 空白/损坏文件拒收，重复导入拦截 | 实现并通过 | `blank TXT refused`、`duplicate TXT not added twice` |
| EPUB 导入（元数据、目录 nav、正文抽取） | 实现并通过 | `EPUB metadata title used`、`EPUB TOC read from nav document` |
| 书架：封面、进度、继续、从头、删除 | 实现并通过 | `shelf shows chapter progress after reload`、`shelf exposes 继续 after reload` |
| 目录跳转、跨章连续阅读 | 实现并通过 | `TOC jump updates chapter label`、`TOC marks the current chapter` |
| 连续朗读 / 暂停 / 继续 / 上一段 / 下一段 | 实现并通过（模拟系统语音） | `narration starts`、`paused narration stops advancing`、`next-segment while speaking keeps reading` |
| 阅读位置记忆与重开恢复 | 实现并通过 | `reading position persisted to localStorage`、`reading resumes at saved chapter` |
| 连续 / 分页两种版式、键盘翻页、字号与主题 | 实现并通过 | `paged layout`、`theme switch applied to document` |
| 笔记与讨论（含引用原文）、书签 | 实现并通过，且同步到家庭服务器 | `note saved with quote`、`note synced to family server`、`bookmark marks current segment` |
| 背景音乐（本机上传、独立音量、朗读时自动压低） | 实现并通过 | `background music stored and listed`、`music level has a default` |
| 家庭声音：本人授权登记、撤回、删除样本 | 授权流程与审计通过；**合成未实现** | `voice registered with consent`、`revoked voice cannot synthesize`、`sample deletion recorded` |
| 无家庭服务器时本机可用 | 实现并通过 | `reader boots in local-only mode`、`local-only mode still opens books` |

测试运行方式：

```bash
python3 tests/read-with-you/make-fixtures.py
node tests/read-with-you/runner.mjs          # 启动自带 server/app.mjs（端口 8791），63 项检查
```

结果写入 `tests/read-with-you/evidence/results.json`。回归：`python3 tests/c01-reader/make-books.py && node tests/c01-reader/check.mjs`（经典整页阅读器，70 项）。

## 二、运行

```bash
node server/app.mjs            # 默认 127.0.0.1:8080
# 浏览器打开 http://127.0.0.1:8080/portal/read-with-you.html
```

- 书籍、进度、设置默认存在浏览器 IndexedDB / localStorage；关掉服务器仍可读。
- 家庭服务器只保存书架记录、笔记、书签、听书进度、声音授权记录（`FAMILY_DATA_DIR`，默认随进程目录）。
- 未配置自然朗读模型时，朗读自动退回设备自带语音（`speechSynthesis`），界面显示「引擎：系统语音」。

自然朗读（可选，需自行准备模型）：

```bash
READER_TTS_MODEL_DIR=/path/to/sherpa-onnx-vits-zh   node server/app.mjs
```

`/api/health` 的 `narration.available` 会如实反映是否就绪；未就绪时页面不会假装可用。

## 三、开源依赖与许可

| 依赖 | 版本 | 许可 | 位置 |
| --- | --- | --- | --- |
| foliate-js | vendored | MIT | `portal/vendor/foliate-js/` |
| transformers.js | 3.7.5 | Apache-2.0 | `portal/vendor/hf-transformers-3.7.5/`（仅 GB18030 WASM 解码，按需加载） |
| sherpa-onnx | 2.0.0 | Apache-2.0 | 经 `server/native_tts_bridge.mjs` 调用 |
| MeloTTS 声学模型（zh_en） | 本地模型 | MIT | 需用户自备，不入库 |
| zip.js / fflate | 随 foliate-js | BSD-3-Clause / MIT | 同上 |

不收录任何受版权保护的书籍、音乐或声音样本；测试用书由 `make-fixtures.py` 现场生成，全部为自制文本。

## 四、家庭声音的同意模型

界面与服务器共同强制以下约束（不是提示，而是拒绝执行）：

1. 登记必须填写声音名称与授权人，且授权人必须勾选「我是这个声音的本人」声明。服务器只接受 `consent.authorizedBy === 'voice-owner'`。
2. 至少选择一项用途（朗读家庭书架 / 给孩子讲故事 / 家庭提醒与问候），用途随授权记录一起保存。
3. 可填写授权到期日；到期后 `canSynthesize` 自动为 false。
4. 「撤回授权」立即生效：状态变为 `revoked`，合成缓存清空，默认声音回落到系统语音。
5. 「删除样本」独立于撤回：状态记录 `samplesDeletedAt`，样本与缓存音频一并清除，按钮变为不可用的「样本已删除」。
6. 未登记的请求无法用某个声音朗读：`/api/narration/seg?voice=…` 对未授权声音返回 403，训练中的声音返回 409。

## 五、未完成 / 未验证（不写成已上线）

- **家庭声音合成训练未实现。** 目前只有授权与审计闭环，登记的 voice 是 `pending-training`，不能出声。个人声音克隆必须在声音本人明确授权下单独设计与验收。
- **真实设备听感未测。** 自动测试用桩替换 `speechSynthesis`，验证队列、暂停、续读逻辑，不能替代真人长时间收听。
- **听世界（电台 / 播客）未并入此阅读器。** 现有 `portal/classical-radio.html` 仍是独立入口。
- **背景音乐是整段循环，不做情绪/场景智能配乐。**
- **MOBI / AZW3 / FB2 / CBZ 未做逐格式真实样本验证**，导入路径存在但按 UNTESTED 对待。
- **两轮独立盲测、真实用户验收未完成。**

## 六、已知取舍（需要用户拍板，不由 C博士 决定）

1. **笔记保存位置。** 现在笔记同时写本机与家庭服务器；若希望"永不离开这台设备"，应关掉服务器同步，代价是家人之间看不到彼此笔记。
2. **家庭声音的默认值。** 目前撤回授权后一律回落到系统语音；另一种选择是回落到"最近仍有效的家庭声音"，听感更连贯但可能让读者误以为仍是本人声音。当前选择前者，更保守。
3. **朗读引擎。** 没有模型时使用设备语音，音色取决于操作系统（长句可能断句不佳）；是否值得为自然朗读再引入更大的本地模型，涉及安装体积与启动时间。
4. **EPUB 排版。** 现在只抽取正文段落，原书 CSS 版式不还原（换取跨章连续与朗读一致）。若要"原版排版"需要另一套渲染路径。

## 七、代码结构

```
portal/read-with-you.html          页面骨架（书架 + 阅读器 + 右侧面板）
portal/js/read-with-you/
  main.js        应用外壳：开书、朗读、进度、快捷键
  books.js       TXT/EPUB 解码与切章（esm，foliate-js 动态导入）
  shelf.js       书架卡片、进度、删除
  store.js       IndexedDB + localStorage（rwy-pos-*、rwy-settings）
  audio.js       朗读队列：WebAudio → <audio> → 系统语音，单段预取
  layout.js / layout-scrolled.js / layout-paged.js   连续与分页两种版式
  notes.js       笔记 / 引用 / 讨论
  voices.js      家庭声音授权面板
  settings.js / music.js / ui.js / api.js
server/app.mjs                 家庭服务器（书籍、笔记、书签、声音、TTS 网关）
server/tts-cache.mjs           朗读音频缓存（按声音与文本哈希）
```
