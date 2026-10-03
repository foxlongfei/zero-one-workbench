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
**当前节点：BICEPS-DYNAMIC-3D-V0.5｜FUNCTIONAL_WEBGL_PASS / PENDING_VISUAL_ANATOMY_REVIEW**

- [公开运动模型](movement.html)
- 公开远端验收：软件 WebGL 创建 Human Atlas 画布（2234 meshes / 15 systems / 1582×900）；旋转、缩放、骨骼层均通过像素级取证。
- BICEPS 真实 OBJ 功能通过：`assetStatus=DISPLAYED`；观察角度 `REAL_OBJ_ORBIT +45°` 产生 2737 个变化像素；“屈肘峰值”联动 `elbow=120°`、`forearm=+55°`，产生 3633 个变化像素。
- [公开 WebGL 与 BICEPS 证据](../docs/v0.1/evidence/m2/public-webgl-verification.json) · [观察截图](../docs/v0.1/evidence/m2/biceps-after-view.png) · [峰值截图](../docs/v0.1/evidence/m2/biceps-after-peak.png)
- 验收边界：真实 OBJ 观察和控制联动 **FUNCTIONAL_WEBGL_PASS**；像素变化只证明功能执行，不证明旋转方向、穿模、肘 pivot 或桡尺约束的解剖正确性，这些仍 **PENDING_VISUAL_ANATOMY_REVIEW**；正式 MAIN 保持 2/4。
- TEMP-YOUTH / TEMP-CLUB / TESTSET｜QUEUED。

## 3｜ZERO-CORE｜公共基础设施 SUB
不替代两项目 MAIN。本轮不扩张 ZERO-CORE。

## 4｜本轮可观察成果、角色与断点
- Z05 实物提交：[`303eb764`](https://github.com/foxlongfei/zero-one-workbench/commit/303eb76431f69d320d9ff2a298ee3ee2ea89a70d)；公开证据提交：[`e07f7853`](https://github.com/foxlongfei/zero-one-workbench/commit/e07f7853015e03e0e483ae7d57226912f0d91f1f)。
- 动起来功能取证实现：[`4d161168`](https://github.com/foxlongfei/zero-one-workbench/commit/4d16116818eac5717550bfd83dff1363c6c9d012)；通过证据：[`f8677a82`](https://github.com/foxlongfei/zero-one-workbench/commit/f8677a825664c8fb5db4171bf7fd24cdfa2f9c98)。
- 角色责任：D=实现/取证器；Q=公开运行、反例与科学边界；C=门禁判定、冲突处理与状态写回。
- 最近一次后台运行：2026-10-03 16:38 +08:00。
- 最近一次真实成果变化：Z05 来源门/反例通过；动起来 BICEPS 真实 OBJ +45°观察与120°/+55°峰值联动通过远端功能门。
