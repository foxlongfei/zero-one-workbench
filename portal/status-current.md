# 双项目 CURRENT｜主线 / 辅线 / 临时任务

最近全面核对：2026-09-28 15:33 +08:00
本页只记录真实执行状态。工作一发生，看板同轮更新；每项成果必须能点击到页面、文本、数据、代码或证据原物。

## 1｜零一空间研究
### MAIN｜正在执行
**Z05｜古代技术可运行重建｜ACTIVE**
目标：问题路由 → 候选古代技术/传统 → 必要输入 → 选择方法 → 实际运行 → 轨迹 → 输出 → 来源与边界。

**当前执行节点：Z05-B / SOURCE_BINDING（二十四山）**
- [古代技术实验台](k02-board.html)
- [二十四山方位归一化合同](../research/zero-one/z05-b-24-mountain-orientation-normalizer-v0.1.json)
- [来源绑定 V0.2](../research/zero-one/z05-b-24-mountain-source-binding-v0.2.json)
- 《天玉經》电子转录二十四山次序已与24标签对齐；《欽定協紀辨方書·卷一》影印候选 `06056502.cn` 已连续核验PDF 80–90页总目录及97–99页卷一细目。总目录列本原、义例、立成、宜忌、用事、公规、年/月/日表、利用、附录、辨讹；卷一细目未明列二十四山，因此该卷降级为背景候选，精确目标页/叶/栏仍未冻结
- [PDF连续目录审计 V0.5](../research/zero-one/z05-b-24-mountain-pdf-contiguous-toc-audit-v0.5.json)（80–90页连续核验 + 97–99页卷一细目，验证8/8）
- 电子转录只作定位器；15°等分、真北0°顺时针是工程归一化，不冒充古文原规则
- 下一实际动作：枚举《欽定協紀辨方書》同系列其他卷册影印，优先选择细目含方位/堪舆术语者；命中后冻结 archive leaf + 栏位。足以支持运行即停止考据，转 RULE_TABLE / DECISION_NODES 与实际方法运行
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
- 当前可见：右肩区代理、右上臂、右前臂、右肘、右腕代理均可点击；“右肩训练”与点击入口共用解析器，返回同一 `REGION_SHOULDER_ENTRY_PROXY`、RIGHT 侧别及右肱骨/肱二头肌近端 BP→FJ 资产
- [右肩区代理合同 V0.7](../research/movement/common-human-coordinate-right-shoulder-region-proxy-v0.7.json)
- [公开双入口读回 8/8](../research/movement/common-human-coordinate-right-shoulder-public-readback-v0.7.json)
- [HUMAN-3D 01—10 实际状态表](../research/movement/human-3d-execution-queue-01-10.md)
- 当前断点：导入真实右肩胛骨/锁骨资产或补左侧真实资产；右肩区入口不得冒充完整肩关节，也不得用右侧资产冒充左侧；M03 仍只在新鲜隔离 D 上下文恢复
- 边界：三骨代理不是完整肘关节；教学动态模型不是精确生物力学模型

### TEMP / QUEUED
- TEMP-YOUTH — QUEUED / 保留既有断点
- TEMP-CLUB — QUEUED / 保留既有断点
- TESTSET — QUEUED；M03相关部分等待独立 D

## 3｜本轮核对发现并修正
- Z05 完成PDF 80–90页连续目录审计及97–99页卷一细目核验；本卷未明列二十四山，降级为背景候选，不把目录未命中扩大为全书不存在，`historical_source_verified=false`。
- 动起来新增右肩区代理热点；点击与“右肩训练”同构读回8/8，并显式暴露肩胛骨/锁骨/完整关节面缺口；严格主线保持2/4。
- HUMAN-3D 旧队列仍写“01 ACTIVE、02—10 PLANNED”，与已有真实OBJ、别名桥、右肘代理、页面交互冲突；已按真实执行状态校正。
- 总看板此前把“正式主线”和“正在执行的产品辅线”混在一起；现拆开 MAIN / SUB / TEMP。
- Z05-A / Z05-B 是样板/当前路线，不定义堪舆或整个古代技术系统的能力边界。

## 4｜下一次必须可见
- 零一：枚举同系列其他卷册影印，优先锁定含方位/堪舆细目的卷册；未命中保持 `historical_source_verified=false`。
- 动起来：补真实右肩胛骨/锁骨资产或开始左侧真实资产；每个结构仍须通过点击/输入同构读回。

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


### ZERO-CORE V0.5｜Cloudflare 部署开始｜2026-09-28
- 状态已由 PRIMARY_CANDIDATE / 未部署 → **PRIMARY_CANDIDATE / DEPLOYING**。
- 已落地可部署 Worker 骨架：[wrangler 配置](../server/zero-core/cloudflare/wrangler.jsonc) / [Worker 路由](../server/zero-core/cloudflare/src/index.js) / [D1 schema](../server/zero-core/cloudflare/migrations/0001_init.sql) / [package](../server/zero-core/cloudflare/package.json)。
- D1 最小表已定义：owners / workspaces / threads / messages / provider_calls；messages 建 thread+time 索引。
- /api/health 会真实执行 D1 SELECT 1；/api/chat 在 OWNER gate 与真实 Provider 未接通前固定 503 NOT_READY，禁止模拟回答。
- Cloudflare 官方确认 Wrangler deploy 可自动 provision 未带 resource ID 的 D1 binding；Secrets 后续只以 Worker Secret 注入，不进 GitHub/浏览器/聊天。
- 当前阻塞：本会话没有 Cloudflare 账户连接器，远端 Worker/D1 尚未创建；需要所有者完成一次 Cloudflare 登录/部署授权。
- 当前边界：REMOTE_DEPLOY=false；D1_REMOTE_READWRITE=false；OWNER_AUTH=false；C/Q/D_REAL=false。
- 下一实际动作：Cloudflare 登录 → 从仓库 server/zero-core/cloudflare 部署 → 读回 workers.dev /api/health → D1远端写读 → OWNER gate → C真实首轮。


## 6｜2026-09-28 当日闭环复盘｜16:21 +08:00
### MAIN / SUB / TEMP 核对
- 零一 MAIN：Z05 ACTIVE；当前执行仍 Z05-B / SOURCE_BINDING。SUB：问题路由器 ACTIVE_SUPPORT、SUPPORT_LIBRARY ON_DEMAND。TEMP：Z04、TEMP-M01、TEMP-E01 继续 PAUSED；Z05-A 仅样板候选。
- 动起来 MAIN：严格 2/4 不变。SUB：COMMON-HUMAN-COORDINATE / HUMAN-3D ACTIVE，今日实际已推进到右肩区代理；独立 HUMAN-3D 队列已同步右腕/右肩现状。TEMP：TEMP-YOUTH、TEMP-CLUB、TESTSET 继续 QUEUED，不冒充执行。
- ZERO-CORE：公共基础设施 SUB = DEPLOYING。Cloudflare Workers + D1 部署骨架已落库，但远端未部署。

### 今日有效成果
- ZERO-CORE 运行底座筛选完成；Cloudflare Workers + D1 = PRIMARY_CANDIDATE / DEPLOYING。
- Worker / D1 最小部署源码已落地；/api/health 为真实 DB 探针；/api/chat 未接真实 Provider 前固定 503，禁止模拟。
- 零一与动起来已有今日内容增量保持原验收边界，不因基础设施工作虚增完成度。

### 今日无效试错 / 不计成果
- Vercel Team/OAuth 未形成部署。
- Cloudflare 官方 MCP 服务存在，但当前 ChatGPT 用户界面没有可用的自定义 Remote MCP 入口，插件目录也未发现可直接安装的 Cloudflare 插件。
- Zero Trust / OAuth Client / MCP 入口寻找不计项目能力成果；MCP 路线暂停，不再作为部署前置条件。

### 当前真实断点
- ZERO-CORE：REMOTE_DEPLOY=false；D1_REMOTE_READWRITE=false；OWNER_AUTH=false；C/Q/D_REAL=false。
- 用户当前无需购买套餐、创建 OAuth Client/API Token 或继续找 MCP。
- 下一实际动作：直接部署现有 server/zero-core/cloudflare 骨架 → workers.dev /api/health 读回 → D1 远端写读 → OWNER gate → C真实首轮。


## 7｜执行纪律升级：知行合一｜2026-09-28 17:21 +08:00
- 硬规则：重要结论必须同轮完成“记录 → 转成任务/命令 → 实际执行 → 可见发布 → 看板更新 → 读回/用户检查”；只写原则不算落实。
- 可见进度：改一小步→立即发布网页→更新时间戳→给可点击入口→用户检查→反馈→下一步。后台OBJ/JSON/验证器/commit未进入可见网页，只算开发证据。
- 动起来当前可见执行节点已切换为 **BICEPS-DYNAMIC-3D-V0.1 / ACTIVE**：复用现有右肱骨、桡骨、尺骨、肱二头肌长/短头，把静态真实资产与动作驱动合并到同一3D视图。
- 第一完成门：movement.html 可直接播放“伸展→屈肘→肌肉长度/形态变化→离心返回”，支持观察角度/局部定位；网页发布+读回后才升级用户层进度。
- 科学边界：无对应生物力学/EMG数据，不把动画形变称为真实发力大小。


## 8｜思想内核更新：原创能力 × AI分工｜2026-09-28 17:21 +08:00
- 零一空间的目标不是用AI替人思考，而是让AI承担检索、整理、交叉验证、计算、重复执行、发布/读回等过度搬砖，把人的时间还给提出问题、原创判断、体验、选择、创造与实践。
- ZERO-CORE不是聊天壳：C/Q/D及未来模型是可替换Provider；问题、对话历史、原创思想、研究方法、任务、成果、版本与知识沉淀属于零一空间，必须可导出、可迁移、可本地保存。
- 原创保护：事实/来源/他人解释/用户原创判断/AI假设分层；AI不得把生成冒充用户原创，也不得把用户原创稀释进无来源总结。原创思想保留时间、上下文、演化和验证状态。
- 零一研究继续执行“古人技术与现实运用”：考据够用即停；文本/证据→现实场景→当时怎么用→方法步骤→案例→可运行重建→今天真实输入→检验。
- 知行合一：改变底层方向的对话，同轮必须产生思想内核更新 + 任务/验收门 + 看板变化。
- 当前落地任务不另起空项目：Z05继续向实际使用/RULE_TABLE/DECISION_NODES推进；ZERO-CORE继续自有线程/主库/Provider/导出；HUMAN-3D继续BICEPS-DYNAMIC-3D-V0.1网页可见动作。
