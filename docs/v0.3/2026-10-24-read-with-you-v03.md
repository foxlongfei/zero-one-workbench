# 陪你读书 V0.3｜从「能打开」到「能连续听完一整本书」｜2026-10-24

负责人：D博士（独立产品与工程负责人）。本轮不需要 C博士 审批，决定、实现、测试、发布均由本轮承担，并把未解决的取舍写进本文末尾。

## 1. 一句话结论
V0.3 是一个**可以直接用**的整书阅读器：导入自己的 EPUB / TXT → 生成带封面的书架 → 目录跳章 → 连续朗读（不按章停）→ 暂停恢复 → 背景音自动压低 → 笔记 → 进度记忆 → 家人授权声音 → 听世界电台。
入口：`portal/reader-v03/index.html`（GitHub Pages 上同名路径）。

## 2. 为什么另起一版而不是继续修 C01
C01（`reader-integrated.html`）的结构是「一个 HTML 里塞脚本」，阅读、朗读、音乐、笔记互相引用全局变量，任何一处改动都可能把别的功能弄坏——本轮三次失败的浏览器验证都源自这里。V0.3 保留 C01 的产品目标与用户体验，代码按职责拆成可单独测试的模块：

| 模块 | 职责 | 测试 |
| --- | --- | --- |
| `lib/text.mjs` | TXT 分章、段落清洗 | `core.test.mjs` |
| `lib/book.mjs` | 书模型、目录映射到 spine 序号、格式识别 | `core.test.mjs` |
| `lib/narration.mjs` | 朗读游标（段/章）、跨章续读、暂停重读被打断的段落 | `core.test.mjs` |
| `lib/engines.mjs` | 可插拔语音引擎：浏览器合成 / OpenAI 兼容端点 / 家庭声音库 / 离线测试音 | `core.test.mjs` |
| `lib/store.mjs` | IndexedDB v4（books / settings / notes / blobs） | `core.test.mjs` |
| `lib/listening-world.mjs` | 电台目录、版权标注、时段推荐 | `core.test.mjs` |
| `server/voice-library/*` | 家人声音库：授权、样本、合成、撤销 | `voice-library.test.mjs` |
| `tests/reader-v03/browser-check.mjs` | 真实 Chromium 端到端 36 项检查 | 见第 5 节 |

## 3. 本轮修掉的真实缺陷（不是改测试）
1. **EPUB 目录为空**：foliate-js 的 `book.toc` 是惰性解析的，`view.open()` 时常常还没解析完，目录面板因此是空的。改为在应用侧读取 `nav` / `ncx` 文档，自己做 `parseNavDocument` / `parseNcxDocument`。
2. **点章不跳**：`view.goTo()` 传了 `{chapter, paragraph}` 对象，foliate 只接受 spine 序号 / CFI / 进度分数。改为传数字 spine 序号。
3. **续读打不开书**：`lastLocation` 传了对象，报 "Could not resolve target [object Object]"。改为传数字起始节。
4. **目录序号与 spine 序号不一致**：EPUB 目录可能合并/跳过 spine 项，`goTo(chapterIndex)` 会跳错章。书模型新增 `sectionIndex` 字段，跳转一律用它。
5. **家人声音选完就丢**：`activeVoice` 只存在内存里，刷新页面后引擎回退到浏览器合成。改为持久化 `settings.library.voiceId`，并提供 `restoreVoice()` 在书库加载后恢复；被撤销授权的声音会拒绝恢复。
6. **「朗读」只有声音没有停顿**：原来的离线测试音是同一秒的环境音，无法验证连续听。改为按字数生成 0.8–6 秒的合成音频并真实播放，这样「跨章不停」「暂停重读本段」「说话时压低背景音」才能被观察到（仅在 `?ttsTone=1` 调试参数下启用）。

## 4. 家人声音与授权（这是产品的底线，不是附加功能）
- 录制前必须勾选授权并填写本人称呼；三句提示语各录一段。
- 服务端 `POST /api/voices` 校验授权字段，缺失则 400；`POST /api/voices/:id/revoke` 立即生效，之后 `POST /api/speak` 对被撤销的声音返回 **409**，不是「悄悄用浏览器声音代替」。
- 数据只在本机或自建服务端：`server/voice-library/data/` 已加入 `.gitignore`，样本永不进仓库。
- 可选 `VOICE_LIBRARY_TOKEN`：配置后所有 API 都要带 `x-license-token`。公开部署时应配置，否则任何人都能往你机器上的声音库写样本。
- 没有可用克隆服务时降级为**共振峰合成**，界面上明确写成「近似音」，不冒充「克隆」。

## 5. 验证（可复现）
```bash
node --test "tests/reader-v03/*.test.mjs"          # 19 项单元测试
node tests/reader-v03/browser-check.mjs            # 36 项真实浏览器检查
```
浏览器检查覆盖：TXT/EPUB 双格式导入、封面、目录、点章、跨章连续朗读、暂停/恢复、背景音压低、笔记 + 刷新恢复、进度续读、EPUB 翻页、听世界目录与版权标注、收藏、授权门禁、上传、切声、撤销后合成被拒、删除。结果写入 `artifacts/reader-v03/browser-evidence.json` 与截图 `artifacts/reader-v03/browser-proof.png`。

## 6. 怎么自己跑家人声音库
```bash
node server/voice-library/server.mjs            # 默认 127.0.0.1:8792
# 如需令牌与真实克隆服务：
VOICE_LIBRARY_TOKEN=xxx TTS_BASE_URL=https://api.example.com TTS_API_KEY=yyy TTS_VOICE_MAP=... node server/voice-library/server.mjs
```
打开 `portal/reader-v03/index.html?voiceLibrary=http://127.0.0.1:8792`，声音页填同一令牌。

## 7. 未解决的取舍（明确告知用户，不由 C博士 决策）
1. **真正的「家人声音克隆」需要外部 TTS 服务**（自建或付费），本地只有近似合成。界面上已如实标注，但体验差距明显。
2. **切换书籍时 EPUB 阅读面板可能停在上一本的位置**：同一页面内换书时 foliate-view 会复用实例，目前通过 `__shownChapter` 守卫缓解，没有根治。规避方式：从书架直接点开另一本（新的一次阅读会话）是正常的。
3. **听世界只有目录与版权标注**，部分频道有地区/网络限制，网页无法保证可播放。
4. **`?ttsTone=1` 是给自动化用的离线声音**，正式用户不会开启；因此「无语音引擎的设备」上的完整体验仍需真实设备验收。
5. **没有云同步**：书籍、笔记、进度都在本机浏览器，清站点数据即丢失。
