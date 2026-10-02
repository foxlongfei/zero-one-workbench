# 双项目 CURRENT｜2026-10-03 05:39 +08:00

本页只记录真实执行状态。**实物 → 对应 Pages 接入 → Pages 发布 → 公开运行/读回 → 总首页/CURRENT/Drive 同步**；任一门缺失即 `NOT_CLOSED`，不提高完成度。

## 1｜零一空间研究

### MAIN｜Z05 古代技术可运行重建｜EXECUTING
**当前节点：Z05-B｜SOURCE_BINDING → RULE_TABLE / DECISION_NODES / 真实输入运行**

- [公开古代技术实验台](k02-board.html)
- 本轮实质增量：新增“一键现实样例：住宅A”。公开运行输入为住宅A、182.4°、坐北向南（现场罗盘复测）、南侧主要开口/东侧道路；实际输出为 **182.4° → 午山（中心180°）**，并显示 INPUT→METHOD→OPERATION→OUTPUT→BOUNDARY。
- [公开读回证据](../research/zero-one/z05-b-real-sample-public-readback-v0.1.json)：PASS。
- 历史/科学边界：`historical_source_verified=false`；15°等分与真北0°顺时针仍是工程归一化；不生成吉凶，`complete_kanyu_method=false`。
- 当前状态：现实输入链本轮闭环；Z05-B 整体仍 EXECUTING。
- 下一断点：仅补影响方法运行的影印页/栏证据；随后把现场观察变成显式 UNKNOWN/KNOWN 决策节点，不回到无边界考据。

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
**当前节点：BICEPS-DYNAMIC-3D-V0.1｜PENDING_ACCEPTANCE_WEBGL**

- [公开运动模型](movement.html)
- 本轮实质增量：BICEPS-DYNAMIC-3D 升至 V0.3；同一右上肢资产链新增前臂旋转控制，并与屈肘、肱二头肌长度/厚度教学形变和连续播放联动。
- 公开环境 WebGL 返回 `Error creating WebGL context`。因此新增静态真实 OBJ 预览 + 可操作二维运动降级层；公开手动读回 **屈肘90° / 前臂旋转+45°**，连续播放采样 **61° / +55°**。
- [公开读回证据](../research/movement/biceps-dynamic-3d-v0.3-public-readback.json)：`PASS_FALLBACK_ONLY`。
- 验收边界：真实 OBJ 动态公开读回仍为 false；桡尺关节约束、解剖标志点、力值与 OpenSim 校准均未完成。不得把降级层冒充真实3D动态。
- 当前状态：代码/Pages/降级运行已闭环；真实3D视觉验收 NOT_CLOSED；正式 MAIN 保持 2/4。
- 下一断点：在可用 WebGL 环境检查旋转方向、穿模与肘 pivot；失败即修正。M03 只在新鲜隔离 D 上下文恢复。
- TEMP-YOUTH / TEMP-CLUB / TESTSET｜QUEUED。

## 3｜ZERO-CORE｜公共基础设施 SUB
Drive 权威记录显示 Worker+D1、OWNER 认证与 C 真实往返已完成；Q/D/all 未完成。REMOTE_DEPLOY 已有证据，但 ZERO-CORE 不替代两项目 MAIN。

## 4｜本轮状态纠错
GitHub CURRENT 与项目页曾被较早的“T1–T5 从零重建”文字覆盖，与 Drive 最新权威断点冲突。本轮按权威结构恢复 Z05 / M01→M04 / BICEPS-DYNAMIC-3D，并用公开运行结果重新认证，不把文字恢复本身计为项目成果。

## 5｜本轮成果与提交
- Z05 页面：[`5872172a`](https://github.com/foxlongfei/zero-one-workbench/commit/5872172a4e5df656d77b53b6b09f4c59c9144290)
- 动起来 V0.3：[`912ac691`](https://github.com/foxlongfei/zero-one-workbench/commit/912ac691ada262a1dc354a3f4896eef7684e9ac8)
- WebGL 降级层：[`8e0d0487`](https://github.com/foxlongfei/zero-one-workbench/commit/8e0d0487070599a99eba0c30a7f118b709c90290)
