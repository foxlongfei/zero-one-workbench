# 陪你读书 V0.3｜D 博士接管基线与本轮修复｜2026-10-29

> 后续增量：同日已完成开源 Piper Plus 神经语音、本机零样本声音训练与 Standard Ebooks 公版书库接入，见 `docs/v0.3/2026-10-29-open-source-voice-and-library.md`。本文保留接管时的基线事实。

## 1. 已读资料

- Issue #42 正文与截至 2026-10-26 的全部评论（含用户 2026-10-24 开工授权、2026-10-25 发布指令、2026-10-26「立即执行」）。
- 历史任务：#10、#11、#12、#13、#15、#20、#24；PR #61。
- `docs/read-with-you/D-OWNED-EXECUTION-ENTRY.md`、`docs/v0.3/2026-10-24-read-with-you-v03.md`、`handoffs/D-V03-DELIVERY.md`、`portal/status-current.md`。
- `portal/reader-v03/` 全部源码、`tests/reader-v03/` 全部测试、`server/voice-library/`、`scripts/portal-delivery-smoke.cjs`、Pages 发布工作流。

## 2. 接手时的可核实状态

- 基线提交：`796b779c4217ae9ef95f80117ac638ee8f4d9a24`，工作区干净。
- 公网入口返回 200：
  - `https://foxlongfei.github.io/zero-one-workbench/portal/reader-v03/index.html`
  - `.../portal/`、`.../portal/reader-v03/app.mjs`
- 公网 `index.html`、`app.mjs`、`lib/narration.mjs` 的 SHA-256 与接手时 HEAD 完全一致，说明 Pages 当时部署的正是该提交。
- 接手时本地测试：单元 27/27 通过；真实 Chromium 端到端 45/45 通过、0 页面错误。
- Issue #42 正文中的 `autonomous_d_delivery_verified: false`、`product_release_verified: false`、`user_acceptance: pending` 尚未被用户验收记录覆盖；后续评论中的「立即执行」是施工授权，不是验收结论。

## 3. 真实缺口（未用计划冒充完成）

1. 接手时神经网络 TTS 只有付费/外部端点配置界面；后续已改为开源 Piper Plus 本机神经语音，并移除付费 API。
2. 家人声音库的默认合成器是共振峰近似音，不是神经声音克隆；真正克隆需另行部署并验证外部服务。
3. 真机麦克风采集、锁屏/后台播放、系统音频焦点、真实家人授权全流程未在真机验收；无头 Chromium 只能证明界面与本地服务逻辑。
4. 听世界只有两条古典电台真实流和一个播客占位条目；没有 Radio Browser 完整目录、播客真实内容或中文字幕。
5. 没有 V0.3 专属 CI 工作流；现有自动化只覆盖单元/浏览器本地脚本与门户路由冒烟。
6. EPUB 同页切换书籍可能残留上一本视图；两轮独立盲测与用户本人验收尚未发生。

## 4. 本轮实际修复（已跑测试，非计划）

1. **最后一章被误判为「已读完」**：原逻辑只要进度停在最后一章就重置到第一章，丢失中途位置。现在只有 `finished=true` 或进度达到 100% 才重新开始。
2. **从书架「听书」时 TXT 正文空白**：监听启动前先把阅读面板定位到目标段；同时修正已读完 EPUB 重听时视图仍停在末章的问题。
3. **笔记归属错误**：笔记原来按朗读游标记章，纯阅读时可能全部记到第一章；现在按当前正在阅读的章节和段落记录，点击 EPUB 段落、翻页、TXT 翻页都会同步。
4. **收听时长少算 60 倍**：统计以毫秒存储，却按秒格式化；统一为毫秒到分钟的单一转换。
5. 新增回归测试：最后一章不是完成态、毫秒统计格式化、最后一章续听不回到第一章、纯阅读笔记归属第三章、TXT 从书架听书时正文已渲染。

## 5. 本轮测试证据

```text
node --test tests/reader-v03/core.test.mjs tests/reader-v03/pacing.test.mjs tests/reader-v03/voice-library.test.mjs
→ 29/29 pass

node tests/reader-v03/browser-check.mjs --playwright=<local playwright>
→ PASS, 49 checks, 0 page errors
```

浏览器测试使用真实 Chromium、本地静态站点、真实 AudioContext、离线测试音和本地家庭声音库，不是模拟 `speechSynthesis`。

## 6. 下一步（按优先级）

1. 提交并推送本轮修复，触发 Pages 发布；用同一浏览器脚本对公网 URL 复跑 `--base-url` 读回，记录部署 SHA。
2. 该步已完成：接入并实测 Piper Plus；付费云 TTS 已移除。
3. 在真机完成录音、撤销、删除、后台播放与背景音 ducking 的验收记录。
4. 补 V0.3 专属 CI（单元测试 + 浏览器测试 + 公网读回），避免只靠人工复跑。
5. 听世界接入真实且可播放的内容源，Podcast 占位条目不得计为已完成。
