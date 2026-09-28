# 双项目 CURRENT｜主线 / 辅线 / 临时任务

最近全面核对：2026-09-28 14:42 +08:00
本页只记录真实执行状态。工作一发生，看板同轮更新；每项成果必须能点击到页面、文本、数据、代码或证据原物。

## 1｜零一空间研究
### MAIN｜正在执行
**Z05｜古代技术可运行重建｜ACTIVE**
目标：问题路由 → 候选古代技术/传统 → 必要输入 → 选择方法 → 实际运行 → 轨迹 → 输出 → 来源与边界。

**当前执行节点：Z05-B / SOURCE_BINDING（二十四山）**
- [古代技术实验台](k02-board.html)
- [二十四山方位归一化合同](../research/zero-one/z05-b-24-mountain-orientation-normalizer-v0.1.json)
- [来源绑定 V0.2](../research/zero-one/z05-b-24-mountain-source-binding-v0.2.json)
- 《天玉經》电子转录二十四山次序已与24标签对齐；《欽定協紀辨方書·卷一》影印候选 `06056502.cn` 已完成8项OCR负检索及PDF页面级目视抽样。PDF第80页已定位为《欽定協紀辨方書目錄》起始页；精确目标页/叶/栏仍未冻结
- [影印OCR审计 V0.3](../research/zero-one/z05-b-24-mountain-ia-ocr-audit-v0.3.json)；[PDF目视定位 V0.4](../research/zero-one/z05-b-24-mountain-pdf-visual-locator-v0.4.json)（抽样页1/20/40/80，验证器7/7）；[公开读回 2/2](../research/zero-one/z05-b-24-mountain-pdf-public-readback-v0.4.json)
- 电子转录只作定位器；15°等分、真北0°顺时针是工程归一化，不冒充古文原规则
- 下一实际动作：从已定位的目录起点连续目视扫描PDF 80–90页，记录目录标题；命中相关标题后追到正文并冻结 archive leaf + 栏位。足以支持运行即停止考据，转 RULE_TABLE / DECISION_NODES 与实际方法运行
- 验收：historical_source_verified=false；complete_kanyu_method=false；Z05 V0.1 未完成

### SUB｜可执行辅线
- **Z05 问题路由器｜ACTIVE_SUPPORT** — 普通语言问题可路由到命理/干支、堪舆/地理环境、易/占筮、择日/历法、医养/导引等，并列出所需输入；[公开实验台](k02-board.html) / [公开读回](../research/zero-one/z05-question-router-public-readback-v0.1.json)
- **SUPPORT_LIBRARY｜ON_DEMAND** — 基础知识仅由运行方法反向提出缺口，不无边界堆积

### TEMP / PAUSED SUPPORT｜不抢主线
- Z04 / K02-03-HXL-01 — PAUSED_RESEARCH_SUPPORT，旧严格验收 0/5
- TEMP-M01 — PAUSED_SUPPORT
- TEMP-E01 — PAUSED_SUPPORT
- Z05-A 生辰八字 — 样板候选，不是当前执行支线，也不定义 Z05 边界
- 恢复条件：只有 Z05 当前运行步骤明确需要时才唤醒

## 2｜动起来
### MAIN｜正式验收主线
**M01 → M02 / M03 → M04｜严格 2/4**
- M01 — COMPLETED
- M02 — ACCEPTED_L1_CANDIDATE_ONLY
- M03 — BLOCKED_CLEAN_CONTEXT：需要新鲜隔离 D 上下文
- M04 — BLOCKED_BY_M03
- M03 阻塞不等于整个项目停工；产品辅线成果不得虚增正式主线计数

### SUB｜当前实际执行
**COMMON-HUMAN-COORDINATE / HUMAN-3D 完整人体样板｜ACTIVE**
- [公开人体模型](movement.html)
- 当前可见：右上臂、右前臂、右肘、右腕代理均可点击；“右手腕训练”与点击入口共用解析器，返回同一 `JOINT_WRIST_PROXY`、RIGHT 侧别与桡骨/尺骨 BP→FJ 资产
- [右腕代理合同 V0.6](../research/movement/common-human-coordinate-right-wrist-proxy-v0.6.json)
- [公开双入口读回 8/8](../research/movement/common-human-coordinate-right-wrist-public-readback-v0.6.json)
- [HUMAN-3D 01—10 实际状态表](../research/movement/human-3d-execution-queue-01-10.md)
- 当前断点：扩右肩入口或补左侧真实资产；右腕仍是桡骨/尺骨代理，不得冒充完整腕关节，也不得用右侧资产冒充左侧；M03 仍只在新鲜隔离 D 上下文恢复
- 边界：三骨代理不是完整肘关节；教学动态模型不是精确生物力学模型

### TEMP / QUEUED
- TEMP-YOUTH — QUEUED / 保留既有断点
- TEMP-CLUB — QUEUED / 保留既有断点
- TESTSET — QUEUED；M03相关部分等待独立 D

## 3｜本轮核对发现并修正
- Z05 从OCR负检索转入PDF目视链，已定位目录起点第80页；抽样页未见目标只限样本，不构成全卷否定，`historical_source_verified=false`。
- 动起来新增右腕代理热点；点击与“右手腕训练”同构读回8/8，并显式暴露“非完整腕关节模型”；严格主线保持2/4。
- HUMAN-3D 旧队列仍写“01 ACTIVE、02—10 PLANNED”，与已有真实OBJ、别名桥、右肘代理、页面交互冲突；已按真实执行状态校正。
- 总看板此前把“正式主线”和“正在执行的产品辅线”混在一起；现拆开 MAIN / SUB / TEMP。
- Z05-A / Z05-B 是样板/当前路线，不定义堪舆或整个古代技术系统的能力边界。

## 4｜下一次必须可见
- 零一：连续扫描PDF目录80–90页并记录标题；未命中保持 `historical_source_verified=false`。
- 动起来：扩右肩入口或开始左侧真实资产；每个结构仍须通过点击/输入同构读回。

## 5｜ZERO-CORE｜公共基础设施 SUB
- 状态：ACTIVE_SUB；不替代 Z05 或动起来 MAIN。
- 当前可见实物：[对话工作台 V0.1](zero-core.html)；可切 C/Q/D/三方协作、工作空间、输入演示消息并导出 JSON。
- 核心规则：[ZERO-CORE 平台核心规则 V0.1](../research/zero-core/zero-core-rules-v0.1.md)
- 当前边界：真实认证=false；cloud_database=false；provider_api=false。演示记录只在当前浏览器页面内存中存在，导出由用户主动触发。
- 架构决定：登录作为平台入口；对话窗作为登录后组件。主库/知识/任务/版本属于零一空间；AI模型通过可替换 Adapter 接入。
- 下一步：建立服务端最小后端 + 身份/会话数据结构 + secret 管理；先接一个真实 Provider，再验证持久化和导出闭环。

### ZERO-CORE V0.2 可见增量｜2026-09-28 12:58 +08:00
- 总看板已加入右下角“对话”按钮，点击以 iframe 弹窗打开 ZERO-CORE，不离开项目入口。
- 工作台增加本机身份记忆与演示消息 localStorage 持久化；刷新后可保留入口身份/演示记录。
- 当前边界：这不是服务器认证；C博士真实 API 尚未连接。当前 ChatGPT 会话不能直接嵌入网页，后续以 OpenAI API Provider Adapter + ZERO-CORE 自有项目上下文接入。
- 页面提交：ZERO-CORE V0.2 = 2f883f5c6ff0382ebf5703b4c244a14b90467aeb；总看板弹窗 = 2376d60c4e0003c8e009a786a5874f02e52f286b。
- 下一门：部署最小服务端；secret/env 保存 API Key；建立 OWNER 身份和 conversation/thread 持久化；接 C博士 Responses/Conversations API，再做网页真实往返读回。

### ZERO-CORE V0.3｜真实对话门
- 模拟回答已关闭；前端现在只向 /api/chat 请求真实响应，Gateway未部署/未认证/缺secret时明确失败。
- 已建立服务端Provider Adapter源码：C=OpenAI Responses；Q=Model Studio OpenAI-compatible Responses；D=DeepSeek Responses。支持单问c/q/d和all三方同问的统一合同。
- 可查源码：[Gateway合同](../server/zero-core/README.md)；[Provider adapters](../server/zero-core/providers.mjs)；[真实对话前端](zero-core.html)
- 当前阻塞：GitHub Pages是静态托管，仓库中的server代码不会自行成为 /api/chat；需要连接可部署的服务端运行环境，并由所有者在服务端配置三家API secrets。任何key不得写入聊天、仓库或浏览器。
- 下一实际动作：服务端部署→OWNER认证→会话持久化→C真实首轮→Q/D真实首轮→all同框→公开读回。


### ZERO-CORE V0.4｜运行底座筛选｜2026-09-28 15:14 +08:00
- 已按“最小刚需 / 免费可运行 / secrets安全 / 数据可迁移”核验 Cloudflare Workers+D1、Vercel Hobby、Railway Free。
- 当前候选决定：**Cloudflare Workers + D1 = PRIMARY_CANDIDATE / 未部署**；Vercel Hobby = FALLBACK；Railway Free = FALLBACK_2。
- 可查决策原物：[运行底座筛选 V0.1](../research/zero-core/runtime-platform-selection-v0.1.md)
- 关键原因：Workers Free 100,000 requests/day；D1 Free 5GB总存储、单库500MB，并可完整导出SQL；Secrets有独立加密绑定。Railway Free只有$1/月资源额度；Vercel基础能力足够但当前OAuth/Team scope增加了不必要操作复杂度。
- 防坑规则：不升级任何Pro；Provider Adapter / Conversation Schema / export格式保持平台中立；Cloudflare只承担运行、Secret binding、D1 adapter。触发付费墙/不可接受授权/锁定即回退，不重写业务层。
- 下一实际动作：建立最小 Worker `/api/health` + `/api/chat` 与 D1 schema；先验证 health + DB写读，再配置C博士服务端secret并做真实首轮。
- 当前边界：Cloudflare部署=false；OWNER auth=false；D1 master DB=false；C/Q/D real call=false；ZERO-CORE V0.1 accepted=false。
