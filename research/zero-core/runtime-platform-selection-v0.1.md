# ZERO-CORE 运行底座筛选 V0.1

核验时间：2026-09-28 15:14 +08:00
状态：DECISION_CANDIDATE / 未部署

## 目标
只按 ZERO-CORE 当前刚需筛选：真实 /api/chat、服务器端 secrets、OWNER 身份、持久化对话、可导出迁移。拒绝为平台附加功能升级付费，也不让运行平台拥有项目主数据定义权。

## 官方资料核验结果

### Cloudflare Workers + D1 — PRIMARY_CANDIDATE
- Workers Free：100,000 requests/day；128 MB memory；50 subrequests/request；64 env vars/Worker。
- Secrets：官方要求敏感 API key 使用 Secret，不使用明文 vars；部署后 Secret 值不应暴露给浏览器。
- D1 Free：5 million rows read/day、100,000 rows written/day、5 GB total storage；Free 单库最大 500 MB、最多 10 个数据库。
- D1 支持完整 schema+data 导出为 SQL，也支持导入 SQL；符合本地备份/迁移原则。
- 适配 ZERO-CORE：薄 HTTP Gateway + C/Q/D 外部 API + 文字会话 SQL 存储。
- 风险/边界：Workers Free CPU time 10 ms/request；外部 fetch 等待与具体 CPU 计算必须实测。D1 是 Cloudflare 托管 SQLite 体系，不把平台特有 API 扩散到业务层。
- 结论：进入最小真实部署验证；暂不付费。

官方入口：
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/best-practices/import-export-data/

### Vercel Hobby — FALLBACK
- Hobby 免费；官方当前文档列出 1,000,000 Function Invocations 等 included usage，项目/部署/环境变量能力足够做薄 Gateway。
- 当前实际问题不是基础能力不足，而是 ChatGPT App 对新 Team scope 的 OAuth 授权复杂；产品界面混有大量与 ZERO-CORE 无关的 Pro 能力。
- 决定：停止继续扩大授权/升级；保留为备用运行底座。

官方入口：
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits

### Railway Free — FALLBACK_2
- Free=$0/月，但仅 $1/月 free resource credit；Trial 是一次性 $5/30天。
- Free 服务资源较小；若月度免费额度耗尽，长期核心服务存在停机风险。
- 优点：传统服务器模型直观、迁移容易。
- 决定：不作为当前长期聊天主库首选；保留为传统 Node 服务备用。

官方入口：
- https://docs.railway.com/pricing/plans
- https://docs.railway.com/pricing/free-trial

## 当前技术决策
先验证 **Cloudflare Workers + D1**，但把平台依赖压到最薄：
Browser/GitHub Pages → ZERO-CORE HTTP API → Provider Adapter(C/Q/D)
                                      → Repository/Data Layer → D1

Provider Adapter、Conversation Schema、导出格式保持平台中立；Cloudflare 只负责运行、Secret binding 和 D1 adapter。

## 下一验收门
1. 建最小 Worker /api/health 与 /api/chat 路由。
2. 建 D1 最小 schema：owner/workspace/thread/message/provider_call。
3. OWNER gate 先采用可替换的最小身份层，不用 localStorage 冒充认证。
4. Secrets 只由所有者在平台 Secret UI/CLI 设置；不进入 GitHub/浏览器/聊天。
5. 部署后先做 health + DB 写读，再接 C 真实首轮。
6. 能导出 SQL/JSON 后才允许把 D1 作为运行主库。
7. 任一环节触发付费墙、不可接受授权或平台锁定，立即回退 Vercel Hobby / Railway / 自托管，不重写业务层。

## 明确未完成
- Cloudflare 账户/部署：false
- OWNER auth：false
- D1 master DB：false
- C/Q/D real call：false
- ZERO-CORE V0.1 accepted：false
