# 双项目 CURRENT｜2026-10-03 16:38 +08:00

本页只记录真实执行状态。**实物 → 对应 Pages 接入 → Pages 发布 → 公开运行/读回 → 总首页/CURRENT/Drive 同步**；任一门缺失即 `NOT_CLOSED`，不提高完成度。

## 1｜零一空间研究

### MAIN｜Z05 古代技术可运行重建｜EXECUTING
**当前节点：Z05-B｜SOURCE_BINDING → RULE_TABLE / DECISION_NODES / 真实输入运行**

- [公开古代技术实验台](k02-board.html)
- 本轮实物：V0.5 给主要开口、道路、水体、坡向分别增加 `DIRECT_OBSERVATION / MEASURED / REPORTED` 来源声明，并加入 `provenance_gate`。
- 公开正常样例：住宅A `PARTIAL_KNOWN`；主要开口/道路为 `DIRECT_OBSERVATION`，水体/坡向为 `NOT_APPLICABLE`；来源门=`SOURCE_COMPLETE_FOR_KNOWN_FIELDS`，节点仍为 `DIRECTION_ONLY`。
- 公开反例：保留主要开口值、清空其来源，来源门正确退回 `MISSING_SOURCE`，输出“缺来源=主要开口”，不升级为观察就绪。
- [公开取证 JSON](../docs/v0.1/evidence/z05-b/public-provenance-verification.json) · [取证截图](../docs/v0.1/evidence/z05-b/public-provenance-gate.png)
- 验收：Pages 实际运行、正常样例、缺来源反例 **PASS**；来源类型仍是用户声明而非外部核验；历史精确页栏未冻结，不生成吉凶，Z05-B 整体 **NOT_CLOSED**。
- 当前阻塞：`historical_source_page_frozen=false`。
- 精确断点：只补会改变运行规则的最小历史页栏证据；不唤醒旧主线。

### SUPPORT / PAUSED
- Z05 问题路由器｜ACTIVE_SUPPORT；SUPPORT_LIBRARY｜ON_DEMAND。
- TEMP-MODEL-01｜既有可运行研究工具，不替代 MAIN。
- Z04/K02-03-HXL-01、TEMP-M01、TEMP-E01｜PAUSED_SUPPORT。

## 2｜动起来

### MAIN｜M01→M02/M03→M04｜严格 2/4
- M01｜COMPLETED
- M02｜ACCEPTED_L1_CANDIDATE_ONLY
- M03｜BLOCKED_CLEAN_CONTEXT
- M04｜BLOCKED_BY_M03

### SUB｜COMMON-HUMAN-COORDINATE / HUMAN-3D｜EXECUTING
**当前节点：BICEPS-DYNAMIC-3D-V0.5｜PENDING_ACCEPTANCE_WEBGL**

- [公开运动模型](movement.html)
- 本周期无用户层实质推进：远端软件 WebGL 已真实创建 Human Atlas 画布（2234 meshes / 15 systems / 1582×900），但旋转像素差取证尚未通过；不能把“能建画布”冒充 BICEPS 真实 OBJ 动态验收。
- [当前失败证据](../docs/v0.1/evidence/m2/public-webgl-verification.json)：最后已固化失败为取证稳定性/像素差门，产品完成度不变。
- 已尝试：动画画布元素截图 → 页面坐标裁剪 → 画布像素缓冲 → iframe 表面；现行断点为 [CDP 可见区域取证](https://github.com/foxlongfei/zero-one-workbench/commit/aa0e4baaa8c5a36494616c4b4cf36d2b604d4504) 的远端结果读回。
- 验收边界：BICEPS `REAL_OBJ_ORBIT`、分阶段屈伸/前臂联动、穿模、肘 pivot 与桡尺约束仍 **NOT_CLOSED**；正式 MAIN 保持 2/4。
- TEMP-YOUTH / TEMP-CLUB / TESTSET｜QUEUED。

## 3｜ZERO-CORE｜公共基础设施 SUB
不替代两项目 MAIN。本轮不扩张 ZERO-CORE。

## 4｜本轮可观察成果、角色与断点
- Z05 实物提交：[`303eb764`](https://github.com/foxlongfei/zero-one-workbench/commit/303eb76431f69d320d9ff2a298ee3ee2ea89a70d)；公开证据提交：[`e07f7853`](https://github.com/foxlongfei/zero-one-workbench/commit/e07f7853015e03e0e483ae7d57226912f0d91f1f)。
- 动起来诊断证据：[`c2d6a2f2`](https://github.com/foxlongfei/zero-one-workbench/commit/c2d6a2f202d4af221cae335ecd9acd56c5dc3cea)；CDP 取证尝试：[`aa0e4baa`](https://github.com/foxlongfei/zero-one-workbench/commit/aa0e4baaa8c5a36494616c4b4cf36d2b604d4504)。
- 角色责任：D=实现/取证器；Q=公开运行、反例与科学边界；C=门禁判定、冲突处理与状态写回。
- 最近一次后台运行：2026-10-03 16:38 +08:00。
- 最近一次真实成果变化：Z05 公开来源门与缺来源反例通过；动起来只有阻塞证据变化，无用户层产品完成度变化。
