# 陪你读书 V0.3｜训练声音入口、音量与 EPUB 跟随｜2026-10-29

本轮按用户试用反馈修复三处可操作问题：训练完成后不知道在哪里选声音、Piper 本机语音偏小且有杂音、朗读时 EPUB 不能跟着翻页。

## 1. 训练声音现在可以直接在朗读面板选择

- 阅读页「朗读声音」新增「神经声音」下拉框，只在声音来源为「开源神经语音」时显示。
- 下拉框列出示范声音和所有本机训练声音；选择后立即切换并保存，下次打开继续使用。
- 来源下拉框、引擎提示和声音页都会显示当前训练声音的称呼，不再只写「已训练声音」。
- 训练完成仍会自动切换并试听；训练结果保存在本机 IndexedDB，不会生成或下载外部 `.onnx` 文件。
- 如果使用的是外部 Piper 训练生成的 `.onnx`，当前版本不能直接导入；需要另做权重导入，不属于零样本声音特征。

## 2. Piper 音量与参考录音处理

- 实测示范声音合成输出的峰值约为 `0.079`（约 -22 dBFS）、RMS 约为 `0.011`，手机播放确实偏小。
- 播放前现在做本机响度归一：按 RMS 提升到约 `0.12`，同时限制峰值不超过 `0.92`，并加 5 ms 淡入淡出避免爆音。
- 参考录音进入 CAM++ 前会去直流、裁掉首尾静音、只取最响的 15 秒窗口，并做峰值归一；手机录音偏小、偏长或前后空白较多时更稳定。
- 参考音频和声音特征仍只在本机处理，不上传；训练仍是零样本声音条件，不是梯度微调。
- 模型噪声属于 Piper Plus zs-v1 实验权重的限制；归一化能改善音量，但不能把模型噪声变成录音棚音质。建议使用安静环境、5–15 秒清晰人声重新训练。

## 3. EPUB/AZW3/MOBI/FB2 朗读跟随

- 原来只依赖段落元素的 `scrollIntoView`。在 foliate 的分栏分页视图里，段落可能已经高亮，但当前页不会可靠地翻过去。
- 现在高亮后显式调用 foliate 分页器的 `scrollToAnchor(target)`，由分页器把目标段所在页滚到可见位置；固定版式没有该方法时仍回退到 `scrollIntoView`。
- 新增真实长章节 EPUB 夹具和浏览器断言：连续跳段到第 40 段以后，目标段必须在阅读区域内，且分页器页码大于 1。
- 仍是段落级同步，不是逐字高亮；逐字同步需要额外的音素时间戳。

## 4. 测试

```text
node --test tests/reader-v03/core.test.mjs tests/reader-v03/pacing.test.mjs tests/reader-v03/voice-library.test.mjs tests/reader-v03/library.test.mjs tests/reader-v03/piper.test.mjs
→ 41/41 pass

node tests/reader-v03/browser-check.mjs --playwright=<playwright> --chrome=<chromium>
→ PASS, 56 checks, 0 page errors

node tests/reader-v03/neural-check.mjs --playwright=<playwright>
→ PASS, 12 checks, 0 page errors
```

公网读回（提交 `f958cc2`）：

```text
node tests/reader-v03/browser-check.mjs --playwright=<playwright> --chrome=<chromium> --base-url=https://foxlongfei.github.io/zero-one-workbench --no-voice-library
→ PASS, 47 checks, 0 page errors

node tests/reader-v03/neural-check.mjs --playwright=<playwright> --base-url=https://foxlongfei.github.io/zero-one-workbench
→ PASS, 12 checks, 0 page errors
```

本地与公网 `index.html`、`app.mjs`、`lib/piper.mjs` 的 SHA-256 一致，部署读回记录见 `reports/v03/2026-10-29-voice-picker-audio-followup.json`。

## 5. 边界

- 没有新增外部训练文件导入；训练声音仍是本机 IndexedDB 里的 192 维特征。
- 没有改变 Piper 模型版本；npm 最新仍为 `piper-plus@0.8.2`，不是未更新导致。
- 真机扬声器、蓝牙、iOS Safari、锁屏播放和用户本人验收仍未完成。
