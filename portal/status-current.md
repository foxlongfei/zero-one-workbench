# 双项目 CURRENT｜主线 / 辅线 / 临时任务

最近全面核对：2026-09-28 11:48 +08:00
本页只记录真实执行状态。工作一发生，看板同轮更新；每项成果必须能点击到页面、文本、数据、代码或证据原物。

## 1｜零一空间研究
### MAIN｜正在执行
**Z05｜古代技术可运行重建｜ACTIVE**
目标：问题路由 → 候选古代技术/传统 → 必要输入 → 选择方法 → 实际运行 → 轨迹 → 输出 → 来源与边界。

**当前执行节点：Z05-B / SOURCE_BINDING（二十四山）**
- [古代技术实验台](k02-board.html)
- [二十四山方位归一化合同](../research/zero-one/z05-b-24-mountain-orientation-normalizer-v0.1.json)
- [来源绑定 V0.2](../research/zero-one/z05-b-24-mountain-source-binding-v0.2.json)
- 《天玉經》电子转录二十四山次序已与24标签对齐；《欽定協紀辨方書·卷一》四库影印候选已登记，精确影印页/叶/栏尚未冻结
- 电子转录只作定位器；15°等分、真北0°顺时针是工程归一化，不冒充古文原规则
- 下一实际动作：定位稳定影印具体页/叶/栏；足以支持运行即停止考据，转 RULE_TABLE / DECISION_NODES 与实际方法运行
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
- 当前可见：点击人体右肘与输入“右肘训练”均返回 JOINT_ELBOW + RIGHT 及同一肱骨/桡骨/尺骨 BP→FJ 三骨代理
- [点击/NL等价合同](../research/movement/common-human-coordinate-click-nl-equivalence-v0.4.json)
- [公开读回](../research/movement/common-human-coordinate-click-nl-equivalence-public-readback-v0.4.json)
- [HUMAN-3D 01—10 实际状态表](../research/movement/human-3d-execution-queue-01-10.md)
- 当前断点：扩更多真实人体点击入口；补左侧真实资产或专用肘关节结构；不得用右侧资产冒充左侧
- 边界：三骨代理不是完整肘关节；教学动态模型不是精确生物力学模型

### TEMP / QUEUED
- TEMP-YOUTH — QUEUED / 保留既有断点
- TEMP-CLUB — QUEUED / 保留既有断点
- TESTSET — QUEUED；M03相关部分等待独立 D

## 3｜本轮核对发现并修正
- HUMAN-3D 旧队列仍写“01 ACTIVE、02—10 PLANNED”，与已有真实OBJ、别名桥、右肘代理、页面交互冲突；已按真实执行状态校正。
- 总看板此前把“正式主线”和“正在执行的产品辅线”混在一起；现拆开 MAIN / SUB / TEMP。
- Z05-A / Z05-B 是样板/当前路线，不定义堪舆或整个古代技术系统的能力边界。

## 4｜下一次必须可见
- 零一：影印定位若找到，直接给可点击原物/定位；未找到就保持 OPEN。随后转规则与真实运行。
- 动起来：每新接一个人体结构，公开页必须可点击/可输入并显示同一 canonical ID 与真实资产/缺口；只写映射文件不算用户层新增。

## 5｜ZERO-CORE｜公共基础设施 SUB
- 状态：ACTIVE_SUB；不替代 Z05 或动起来 MAIN。
- 当前可见实物：[对话工作台 V0.1](zero-core.html)；可切 C/Q/D/三方协作、工作空间、输入演示消息并导出 JSON。
- 核心规则：[ZERO-CORE 平台核心规则 V0.1](../research/zero-core/zero-core-rules-v0.1.md)
- 当前边界：真实认证=false；cloud_database=false；provider_api=false。演示记录只在当前浏览器页面内存中存在，导出由用户主动触发。
- 架构决定：登录作为平台入口；对话窗作为登录后组件。主库/知识/任务/版本属于零一空间；AI模型通过可替换 Adapter 接入。
- 下一步：建立服务端最小后端 + 身份/会话数据结构 + secret 管理；先接一个真实 Provider，再验证持久化和导出闭环。
