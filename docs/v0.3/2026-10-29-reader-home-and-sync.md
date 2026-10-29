# 陪你读书 V0.3｜书架首页、长篇阅读与文字同步｜2026-10-29

> 后续补充：训练声音在朗读面板的直接选择、Piper 音量归一和 EPUB 明确翻页跟随见 `docs/v0.3/2026-10-29-voice-picker-and-audio-followup.md`。

本轮在开源神经语音与公版书库的基础上，继续按用户反馈改造阅读主流程：

## 1. 首页改为书架 + 公版书库

- 删除独立旧书架页面；首页现在同时包含：
  - 我的书架：本地导入的书、继续上次、搜索、进度、阅读/听书；
  - 公版书库：Standard Ebooks 搜索、封面、EPUB/AZW3 导入。
- 本地导入支持一次选择多个文件；公版书库支持勾选多本并批量导入 EPUB 或 AZW3。
- 批量下载/导入逐本执行，完成后回到书架并报告成功/失败数量。

## 2. 阅读界面

- 增加书本目录弹窗：所有章节按序编号，点击直接跳转；侧栏目录同步更新。
- TXT 正文改为整章渲染，不再只显示 12 段；当前段落高亮并自动滚动。
- 阅读栏增加全书进度条、当前章/段位置、当前朗读句子。
- 阅读字号、行高、段距、页宽和中文排版已调整，适合长篇连续阅读。
- 长篇测试：24 章 TXT 可打开、目录跳转、从第 21 章连续读到第 24 章；Standard Ebooks 的 65 章 AZW3 可正常打开和目录跳转。

## 3. 文字同步

- TXT：当前朗读段落和读到哪一段同步高亮，点击正文段落也能定位。
- EPUB/AZW3/MOBI/FB2：加载当前 spine 文档后，按段落文本匹配高亮当前朗读段落，并滚动到中间。
- 测试钩子 `window.__rw03.sync()` 返回 `{chapter, paragraph, text}`，真实 Chromium 测试已覆盖 TXT 和 EPUB 两套路径。
- 这是段落级同步；句内逐字高亮未做，避免修改出版方原始 HTML。

## 4. 朗读范围与内容边界

- 新增「读本段」和「读全书」：
  - 读本段：只读当前段落，结束后不把整本书标记为完成；
  - 读全书：从当前位置继续到书末，跨章节不中断。
- 开始整书朗读时先读书名，再读章节名和正文；本段模式不读书名/章节名，只读正文。
- EPUB 中 `aside`、footnote/endnote/annotation/noteref、非 linear spine 和 notes 章节不再进入朗读队列；TXT 的独立“注：/注解：/译者注：”行也不会被朗读。
- 上标脚注标记、章节重复标题不会重复朗读。

## 5. 离线声音模块

产品不包含需要付费的云 TTS 或 AI 讨论接口；两个离线声音包、浏览器语音和自建声音库都不需要按次付费。

- 保留 Piper Plus `zs-v1`：可训练家人声音，约 70 MB（含 CAM++）。
- 新增第二个离线声音包 `kizuna-intelligence/piper-plus-mera-multilingual`：
  - Apache-2.0，约 39 MB；
  - 单声线，支持中文等 6 种语言；
  - 不需要参考声音，也不能训练，适合作为“直接可听”的备用离线声音。
- 声音页可在两个包之间切换；加载失败自动切回浏览器语音。
- 本机声音训练入口增加快捷跳转；训练流程仍要求授权，特征只保存在本机，可删除。

## 6. 测试结果

```text
node --test tests/reader-v03/core.test.mjs tests/reader-v03/pacing.test.mjs tests/reader-v03/voice-library.test.mjs tests/reader-v03/library.test.mjs tests/reader-v03/piper.test.mjs
→ 39/39 pass

node tests/reader-v03/browser-check.mjs --playwright=<playwright>
→ PASS, 55 checks, 0 errors

node tests/reader-v03/long-read-check.mjs --playwright=<playwright>
→ PASS, 8 checks, 0 errors

node tests/reader-v03/formats-check.mjs --playwright=<playwright>
→ PASS, 6 checks, 0 errors

node tests/reader-v03/library-check.mjs --playwright=<playwright>
→ PASS, 10 checks, 0 errors

node tests/reader-v03/neural-check.mjs --playwright=<playwright>
→ PASS, 11 checks, 0 errors
```

公网读回和本轮 SHA/证据写入 `reports/v03/` 与后续提交记录。

## 7. 边界

- 声音训练仍是本机零样本声音条件，不是 GPU 权重微调。
- 段落级文字同步，不是逐字时间戳；逐字同步需要额外对齐模型。
- 公版书判断按美国法律；其他地区自行核对。
- 首次神经语音需要下载模型/运行库；真机麦克风、iOS Safari、锁屏播放和用户验收仍未完成。
