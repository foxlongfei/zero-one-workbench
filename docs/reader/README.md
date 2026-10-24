# 陪你读书 / Read With You — 产品与实现说明

入口：`portal/read-with-you-v01.html`（书库入口 `portal/reading-library.html`、零一空间首页 `portal/index.html` 均指向它）。
本页是纯静态站点，可直接部署到 GitHub Pages，没有服务端；书籍、笔记、声音数据全部留在浏览器本地。

## 一、用户现在能做什么

| 能力 | 实现 | 说明 |
| --- | --- | --- |
| 导入整本书 | EPUB / MOBI / AZW3 / FB2 / CBZ 走 foliate-js；TXT 用本地分章器 | 文件存进 IndexedDB（`zero-one-reader-library`），不上传 |
| 书架与封面 | 封面 / 书名 / 作者 / 格式 / 进度角标；搜索 + 筛选（全部 / 在读 / 读完） | 重复导入同一文件不会生成副本 |
| 目录 | foliate-js `book.toc`；TXT 按「第X章 / Chapter N / 序章…」切分 | 章节索引一律取 spine 的 `section`，不从渲染结果反推 |
| 跨章连续朗读 | `portal/reader/narrator.js`（Web Speech API）+ `goChapter()` 自动接续下一章 | 章节读完自动翻页并继续读，跨章不断 |
| 暂停 / 继续 / 跳转 / 记忆 | 朗读按钮、点句跳读（`seek`）、上一章/下一章、书架「继续阅读」卡片 | localStorage 记位置；读完的书卡片变成「再读一遍」 |
| 笔记与讨论 | 选中正文 → 引用；标签（≤5 个）；跨字段模糊搜索 | 搜索按空格分词，中文三字以上按相邻双字兜底 |
| 书签 | 按章节 + 句序号保存，可回跳 | 与笔记一起在阅读页侧栏 |
| 阅读统计 | 每日阅读 / 收听秒数，累计时长 | IndexedDB `stats` 表，可清空 |
| 背景声 | `portal/reader/ambient.js` 用 Web Audio 现场合成（雨声、篝火、风声、海浪、咖啡馆） | 无版权音乐文件；与朗读分轨混音，可单独调音量 |
| 家庭声音 | `portal/reader/voices.js`：四项授权确认 → 录 3–30 秒样本 → 只保存声学特征 → 朗读时按特征调整语速 | 撤销即擦除特征；**不克隆音色** |

## 二、开源选型与许可

| 组件 | 位置 | 许可 |
| --- | --- | --- |
| foliate-js（排版 / EPUB 解析 / CFI / 目录） | `portal/vendor/foliate-js` | MIT |
| zip.js | `portal/vendor/foliate-js` 依赖 | BSD-3-Clause |
| fflate | `portal/vendor/foliate-js` 依赖 | MIT |
| 浏览器朗读 | Web Speech API（浏览器内置） | 系统能力 |
| 背景声 | Web Audio 现场合成，无第三方音频素材 | 原创 |

书籍正文请只用你拥有使用权、或已进入公有领域的作品。出版社译本、校注、插图、朗读音频可能另有版权，本项目不内置任何受版权保护的书籍、音乐或人声。

## 三、代码结构

```
portal/
  read-with-you-v01.html   阅读器页面骨架（书房 / 书架 / 阅读页 / 笔记 / 设置 / 声音）
  reader-app.js            阅读器主逻辑（约 1400 行，单一入口，便于整体阅读）
  reader/
    text.js                TXT 分章、段落、笔记构造与搜索（纯函数）
    narrator.js            逐句朗读队列（暂停、续读、跳句、跨章回调）
    storage.js             localStorage 位置/书签/设置 + IndexedDB 库
    voices.js              家庭声音授权、样本校验、特征分析、撤销
    ambient.js             Web Audio 背景声合成
tests/reader/
  unit/*.test.mjs          47 个纯函数/模块单测
  e2e.mjs                  Playwright 全流程（43 项检查）
tests/v02/c01-whole-book.cjs  交付流水线里的 C01 整书验收（调用上面的单元 + e2e）
scripts/build-demo-epub.py    生成原创三章试读 EPUB
```

## 四、怎么跑测试

```bash
# 单元测试（无需浏览器）
node --test tests/reader/unit/*.test.mjs

# 全流程（需要 playwright + chromium，会自己起本地静态服务器）
node tests/reader/e2e.mjs            # 结果写入 reports/reader/e2e.json

# 流水线入口（单元 + e2e）
node tests/v02/c01-whole-book.cjs
```

## 五、仍未完成的产品取舍（需要用户拍板）

1. **家庭声音只做「特征映射」，不做克隆。** 克隆需要本地大模型与更大计算量，且风险高；当前版本用样本的音调/能量特征调整语速与停顿，让家人听起来更接近，但音色仍是设备合成音。如要做真正的克隆，必须由声音本人再次明确授权，并在界面里逐条说明。
2. **还没有加密（DRM）书籍支持，也没有 PDF。** 这两项都需要额外解码/渲染依赖，且 PDF 的连续朗读体验较差，暂不接入。
3. **跨设备同步未做。** 目前所有数据只在本机浏览器；换设备或清站点数据就会丢失，页面已明确提示，用户需自留原书文件。
4. **「听世界」电台 / 播客尚未建设。** 该模块要求可公开传播的音频源，涉及版权与内容审核，需要先确定合规来源；本次改动没有把它做成空壳，避免误导。
5. **朗读声音依赖操作系统的 Web Speech 语音质量。** 不同设备差别很大，家庭声音只能在「语速与停顿」层面靠近，不能统一音质。
