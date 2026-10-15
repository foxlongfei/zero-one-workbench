# C01《陪你读书》核心开发文档

> 状态：IN_PROGRESS / NOT_ACCEPTED。创建于 2026-10-14。本文件是 C01 固定核心入口，不以 PR、聊天或页面说明替代验收。

## 一、产品目标与最简交互
**书架 → 选择一本书 → 目录／正文 → 🔊 朗读。** 打开即书架，正文是主界面；朗读只需一个喇叭按钮。设置收纳声音、速度、背景音；不把导入、音频 URL、开发状态堆在正文。儿童／长者的可读性、无障碍与操作简洁性应由实测验证。

## 二、REUSE-FIRST 技术路线
- 阅读内核：foliate-js（上游 https://github.com/johnfactotum/foliate-js，MIT），固定源码版本并保留许可证；依赖 zip.js（BSD-3-Clause）、fflate（MIT）许可证需随发布核对。不得重新发明 EPUB、MOBI、AZW3、FB2、CBZ 解析器。
- 现有书库：IndexedDB `zero-one-reader-library` / `books`；兼容旧数据，不能无迁移方案修改 schema。
- TXT：本地纯文本阅读；PDF 优先 PDF.js，但尚未接入。加密 DRM 书籍不承诺支持。DOCX/RTF/HTML/Markdown/CBR 为待评估扩展，不能冒称已支持。
- 朗读：先复用浏览器 SpeechSynthesis；朗读、暂停、续读、跨章节、声音选择应分别实测。用户授权的个性化声音为独立后续能力。
- 背景音：人声优先，基础版低音量、可独立控制；按语义／场景动态配乐、片头片尾属于后续模块，须遵守音乐许可并验证听感。
- 本地优先：书籍和位置本地保存；开源依赖尽量本地固定版本，避免外部 CDN 成为阅读前提。

## 三、当前代码定位
- 原正式入口：`portal/index.html` → `portal/read-with-you-v01.html`。
- 新集成分支：`c01-foliate-reader-integration`；草稿 PR #26（https://github.com/foxlongfei/zero-one-workbench/pull/26）。
- 新集成页：`portal/read-with-you-v01.html`；主逻辑：`portal/reader-integrated.js`；开源阅读器：`portal/vendor/foliate-js/`。
- 测试：`tests/c01-reader/make-books.py`（构造实际 EPUB/TXT）、`tests/c01-reader/check.mjs`（Chromium 导入／目录／正文／朗读接口／进度恢复）；工作流：`.github/workflows/c01-reader-integration.yml`。
- 既有 `portal/reading-library.html`、`portal/classical-radio.html` 暂保留历史与功能，不作为新阅读主流程的额外必经页面。

## 四、能力状态（不得用“代码存在”代替“通过验收”）
| 能力 | 当前状态 |
| --- | --- |
| foliate-js 源码接入、书架/目录/正文 UI 代码 | 已提交到 PR #26，未合并 |
| EPUB/TXT 浏览器自动化 | 测试已编写并启动，最终结果需按 Actions 记录核对 |
| MOBI/AZW3/FB2/CBZ | 已接入解析路径，未完成真实样本逐格式验证 |
| 连续朗读 | 已接入浏览器 TTS 流程；自动测试使用模拟语音，真实音频长时测试未完成 |
| 阅读位置恢复 | 已编写保存/恢复逻辑，需核对浏览器测试结果 |
| PDF、个性化声音、智能配乐 | NOT_IMPLEMENTED |
| 合并、公开 Pages 发布读回、两轮独立盲测、用户验收 | NOT_DONE |

## 五、发布硬门
1. 检查源码许可、依赖完整性、安全边界与离线行为。
2. 使用**实际书籍样本**完成导入、目录、正文、跨章节朗读、暂停续读、关闭重开位置恢复。每个格式单独标记 PASS/FAIL/UNTESTED。
3. Chromium 自动化不能替代真实设备语音听感与长期连续朗读测试；保留日志、截图、失败案例。
4. 两轮独立任务盲测、主分支合并、Pages 部署、外部 HTTPS 读回及用户验收均需真实证据。未达门槛不得标 ACCEPTED。
5. 失败则修复原 PR 与原工单，不另开同质化施工主线。

## 六、任务与追溯
沿用 #10 RW-00、#11 RW-01（Q博士阅读）、#12 RW-02（D博士语音）、#13 RW-03（C博士集成），以及现有 PR #14；新集成 PR #26 为实施增量，不能抹去旧工作。每次变更记录提交 SHA、测试链接、失败项和下一个验收门。

## 七、更新记录
- 2026-10-14：首次建立固定核心开发文档，归拢产品形态、技术内核、源文件、任务编号与真实验收边界。创建文档本身不代表功能完成。
