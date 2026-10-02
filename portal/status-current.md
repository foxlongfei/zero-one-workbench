# 双项目 CURRENT｜2026-10-03 06:37 +08:00

本页只记录真实执行状态。**实物 → 对应 Pages 接入 → Pages 发布 → 公开运行/读回 → 总首页/CURRENT/Drive 同步**；任一门缺失即 `NOT_CLOSED`，不提高完成度。

## 1｜零一空间研究

### MAIN｜Z05 古代技术可运行重建｜EXECUTING
**当前节点：Z05-B｜SOURCE_BINDING → RULE_TABLE / DECISION_NODES / 真实输入运行**

- [公开古代技术实验台](k02-board.html)
- 本轮实质增量：把住宅A现场观察拆成显式 `KNOWN / UNKNOWN` 门。公开运行实际返回 `PARTIAL_KNOWN`；已知=主要开口、道路，未知=水体、坡向；决策节点=`DIRECTION_ONLY`，未知项不参与环境判断。方位链仍输出 **182.4° → 午山（中心180°）**。
- [公开读回证据](../research/zero-one/z05-b-observation-gate-public-readback-v0.1.json)：运行/逻辑隔离 PASS。
- 历史/科学边界：`historical_source_page_frozen=false`；15°等分与真北0°顺时针仍是工程归一化；不生成吉凶，Z05-B 整体 `NOT_CLOSED`。
- 下一断点：把 UNKNOWN 字段转成可采集的独立真实输入；只补影响规则运行的最小历史页/栏证据。

### SUB / PAUSED
- Z05 问题路由器｜ACTIVE_SUPPORT。
- SUPPORT_LIBRARY｜ON_DEMAND。
- TEMP-MODEL-01｜既有可运行研究工具；不替代 MAIN。
- Z04/K02-03-HXL-01、TEMP-M01、TEMP-E01｜PAUSED_SUPPORT。

## 2｜动起来

### MAIN｜M01→M02/M03→M04｜严格 2/4
- M01｜COMPLETED
- M02｜ACCEPTED_L1_CANDIDATE_ONLY
- M03｜BLOCKED_CLEAN_CONTEXT
- M04｜BLOCKED_BY_M03

### SUB｜COMMON-HUMAN-COORDINATE / HUMAN-3D
**当前节点：BICEPS-DYNAMIC-3D-V0.4｜PENDING_ACCEPTANCE_WEBGL**

- [公开运动模型](movement.html)
- 本轮实质增量：恢复受覆盖的 V0.3 真实右上肢资产链并升至 V0.4，新增四个可复现动作阶段预设。
- 公开环境逐项读回：伸展 **0°/0°**、屈曲中段 **60°/+30°**、屈肘峰值 **120°/+55°**、离心返回 **60°/+20°**；阶段名、屈肘角、前臂旋转与肱二头肌降级状态同步变化。
- [公开读回证据](../research/movement/biceps-dynamic-3d-v0.4-phase-presets-public-readback.json)：`fallback_phase_controls_pass=true`。
- 验收边界：云端 WebGL 仍返回 `Error creating WebGL context`；真实 OBJ 动态、桡尺关节约束、力值与 OpenSim 校准均未认证，`real_obj_dynamic_readback=false`。正式 MAIN 保持 2/4。
- 下一断点：在可用 WebGL 环境逐阶段检查旋转方向、穿模与肘 pivot；M03 只在新鲜隔离 D 上下文恢复。
- TEMP-YOUTH / TEMP-CLUB / TESTSET｜QUEUED。

## 3｜ZERO-CORE｜公共基础设施 SUB
Drive 权威记录显示 Worker+D1、OWNER 认证与 C 真实往返已完成；Q/D/all 未完成。REMOTE_DEPLOY 已有证据，但 ZERO-CORE 不替代两项目 MAIN。

## 4｜本轮冲突处理
GitHub movement 页面被较新的“运动达人/M1”旧结构覆盖，移除了 BICEPS V0.3 控件，与 Drive/CURRENT 权威结构冲突。本轮从已认证提交恢复 V0.3 后再增量到 V0.4；恢复动作本身不计产品进度，四阶段预设及公开读回才计入成果。

## 5｜本轮成果与提交
- Z05 观察门：[`47cdbc50`](https://github.com/foxlongfei/zero-one-workbench/commit/47cdbc502d71a184de9c763e825fd972d5a9e041)
- Z05 读回证据：[`4c12fc6f`](https://github.com/foxlongfei/zero-one-workbench/commit/4c12fc6f4bb7d3e8c5b54b1f378b85c1097ff81e)
- 动起来 V0.4：[`be71d9e3`](https://github.com/foxlongfei/zero-one-workbench/commit/be71d9e312eae9d8ef72019322d4ce09f157ecc4)
- 动起来读回证据：[`4c294312`](https://github.com/foxlongfei/zero-one-workbench/commit/4c294312bca0776ce5b15dfc73d4d040ec6116ea)
