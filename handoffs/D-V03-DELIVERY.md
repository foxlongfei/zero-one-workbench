# 陪你读书 V0.3 · D博士交付记录（2026-10-25）

## 交付事实
- 已合并进 `main` 并推送：`418d83ea08fe1b7900a0fb6caaa3b8bb64b3d3a1`
  - `d9d7367` V0.3 阅读器主体（连续聆听、目录、笔记、背景音、经同意的家人声音）
  - `e29d914` 家人声音的撤销 / 恢复 / 删除改为应用内可操作
  - `418d83e` 门户交付冒烟测试纳入 V0.3 入口
- 公网入口（已用公开 HTTP 抓取核对，非推测）：
  - 产品页 https://foxlongfei.github.io/zero-one-workbench/portal/reader-v03/index.html → 200，标题「陪你读书 V0.3」，导入按钮可见
  - 门户 https://foxlongfei.github.io/zero-one-workbench/portal/ → 200，含 `reader-v03/index.html` 链接
  - 资产 `app.mjs`、`lib/narration.mjs` 以 `text/javascript` 返回；`vendor/foliate-js/view.js` 以 `application/javascript` 返回

## 本轮亲自运行的结果（本机）
- `node --test tests/reader-v03/core.test.mjs tests/reader-v03/voice-library.test.mjs` → 19/19 通过
- `node tests/reader-v03/browser-check.mjs`（真实 Chromium + 本地声音库）→ 38/38 通过，0 页面错误
- `node scripts/portal-delivery-smoke.cjs` → 6/6 路由 200、无页面错误

## 阻塞与未完成（如实）
1. **无法读取 Actions 日志**：本执行环境没有 `gh` 登录或 token，部署是否成功只能以公网 URL 实际可访问为准（本轮已核对为可访问）。
2. **不能在 CI 编辑工作流**：GitHub App 无 `workflows` 权限，`publish-radio-pages.yml` 的 V0.3 资产断言无法推送，已回退；改为在 `portal-delivery-smoke.cjs` 中把关。
3. **未验证的云服务**：神经网络 TTS、家人声音克隆只提供可配置接口与本地声音库实现，未对任何第三方云端端点做过实测，也未写入任何 API Key。
4. **声音克隆是形声合成，不是神经克隆**：本地声音库由用户上传样本驱动参数化合成，界面与文档不得表述为“克隆出本人的音色”。
5. **真实设备与真实家人验收未做**：麦克风采集、后台播放、系统级音频焦点在无头浏览器无法证明，需在真机、真家人环境下补验。

## 下一轮建议
- 在有 `workflows` 权限的通道下补回 Pages 构建断言。
- 用一台真机 + 一位明确同意的家人走完录音→试听→撤销→删除全流程并留存证据。
- 若接入神经网络 TTS，先自行验证端点可用与费用，再写入界面文案。
