# 双项目 CURRENT｜2026-10-03 11:36 +08:00

本页只记录真实执行状态。**实物 → 对应 Pages 接入 → Pages 发布 → 公开运行/读回 → 总首页/CURRENT/Drive 同步**；任一门缺失即 `NOT_CLOSED`，不提高完成度。

## 1｜零一空间研究

### MAIN｜Z05 古代技术可运行重建｜EXECUTING
**当前节点：Z05-B｜SOURCE_BINDING → RULE_TABLE / DECISION_NODES / 真实输入运行**

- [公开古代技术实验台](k02-board.html)
- 当前执行：把现场观察从一段自由文本拆成四个独立真实输入：主要开口、道路、水体、坡向。
- 公开运行读回：住宅A输入 **182.4°**；`observation_source=STRUCTURED_FIELDS`、`observation_gate=PARTIAL_KNOWN`；已知=主要开口/道路，水体/坡向保持 `UNKNOWN`；节点=`DIRECTION_ONLY`；方位输出 **午山（中心180°）**。
- [公开读回证据](../research/zero-one/z05-b-structured-observation-fields-public-readback-v0.1.json)
- 验收：结构化输入、UNKNOWN 隔离、规则链与公开读回 **PASS**；历史精确页栏未冻结，15°等分与真北0°顺时针仍是工程标准化，不生成吉凶，Z05-B 整体 **NOT_CLOSED**。
- 当前阻塞：`historical_source_page_frozen=false`。
- 下一断点：为四字段增加采集/测量来源校验；只补会改变规则运行的最小历史页栏证据。

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
- 当前执行：同一真实右上肢链增加观察角度控制；WebGL 路径旋转真实 OBJ 相机，降级路径只倾斜静态预览并显式标记 `FALLBACK_2D_VIEW`。
- 公开运行读回：观察角度 **+45°**；阶段=屈肘峰值；屈肘 **120°**、前臂旋转 **+55°**；`asset_status=STATIC_FALLBACK_INTERACTIVE`。
- [公开读回证据](../research/movement/biceps-dynamic-3d-v0.5-view-control-public-readback.json)
- 冲突处理：并发合并引入的字面量反斜杠 n 导致模块脚本无法解析；已修复，当前四个脚本块解析 **PASS**，后续结构索引更新保留 V0.5 控件。
- 验收：二维降级交互 **PASS**；本环境 WebGL 不可用，真实 OBJ 动态、旋转方向/穿模/肘 pivot、桡尺约束、力值与 OpenSim 校准均 **NOT_CLOSED**；正式 MAIN 保持 2/4。
- 下一断点：在可用 WebGL 环境读回 `REAL_OBJ_ORBIT`，逐阶段检查旋转方向、穿模与肘 pivot；M03 只在新鲜隔离 D 上下文恢复。
- TEMP-YOUTH / TEMP-CLUB / TESTSET｜QUEUED。

## 3｜ZERO-CORE｜公共基础设施 SUB
不替代两项目 MAIN。既有状态不在本轮扩张；REMOTE_DEPLOY 只按可验证部署证据认定。

## 4｜本轮可观察成果与验收责任
- Z05 实物：[`3768520c`](https://github.com/foxlongfei/zero-one-workbench/commit/3768520c43b382445a21af0734e7dde783e844cf)；证据：[`eebc7bc6`](https://github.com/foxlongfei/zero-one-workbench/commit/eebc7bc6d5320638bb1e36faa8dba94e25081365)。
- 动起来实物：[`6104b2f0`](https://github.com/foxlongfei/zero-one-workbench/commit/6104b2f00146168793c2b2f9738898372e748d54)；语法修复：[`0f3841ab`](https://github.com/foxlongfei/zero-one-workbench/commit/0f3841abee79693fe826a63f2b378467e3b94480)；证据：[`71324cf1`](https://github.com/foxlongfei/zero-one-workbench/commit/71324cf15972f64aa2db242bfde9e88f0ee1f496)。
- Pages 验收：[`6e28a14d`](https://github.com/foxlongfei/zero-one-workbench/commit/6e28a14d37e115f2b66fde6206a902af891d80d2) 的 [run 37094274531](https://github.com/foxlongfei/zero-one-workbench/actions/runs/37094274531) **SUCCESS**。
- 角色责任：D=实现与公开接入；Q=公开运行、逻辑/边界验证；C=状态冲突处理、门禁判定与断点写回。
- 最近一次真实成果变化：2026-10-03 11:36 +08:00。
- 本轮验收结论：两个公开增量均可观察；Z05 历史证据与动起来真实 WebGL OBJ 动态仍未闭环，均不提高主线完成度。
