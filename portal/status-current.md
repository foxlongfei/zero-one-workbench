# 双项目 CURRENT｜2026-10-04 09:45 +08:00

本页只记录真实执行状态。**实物 → 对应 Pages 接入 → Pages 发布 → 公开运行/读回 → 总首页/CURRENT/Drive 同步**；任一门缺失即 **NOT_CLOSED**，不提高完成度。

## 1｜零一空间研究

### MAIN｜Z05 古代技术可运行重建｜EXECUTING
**当前节点：Z05-B｜SOURCE_BINDING → RULE_TABLE / DECISION_NODES / 真实输入运行**

- [公开古代技术实验台](k02-board.html)
- 本轮实质增量：新增 D07 SOURCE_BOUND_OPERATION_GATE。只有注册操作且存在冻结来源绑定时才允许执行；环境操作缺少作品/页叶/栏位绑定时统一返回 `BLOCKED_NO_SOURCE_BINDING`，不生成环境或吉凶结论。
- `DIRECTION_NORMALIZATION` 仅以已冻结的二十四山名称/组成/循环次序为非环境工程操作，返回 `EXECUTION_ALLOWED_NON_ENVIRONMENTAL`；主要开口、道路、水体、坡向四类环境操作继续阻塞。
- 验证器 6/6 PASS；页面接入 D07 后与 D01–D06 同步输出真实决策轨迹。
- [D07 结构化门](../research/zero-one/z05-b-source-bound-operation-gate-v0.3.json) · [验证器](../scripts/validate-z05-operation-gate.mjs) · [页面提交](https://github.com/foxlongfei/zero-one-workbench/commit/b140bfce60d3de0d0084cbd6db5294027ebc583a)
- 有效性边界：用户输入不能创建或升级可信来源绑定；Z05-B 整体仍 **NOT_CLOSED**。
- 精确断点：定位首个具有作品、页叶和栏位的环境操作证据；命中前 D07 保持阻塞。

### SUPPORT / PAUSED
- Z05 问题路由器｜ACTIVE_SUPPORT；SUPPORT_LIBRARY｜ON_DEMAND。
- TEMP-MODEL-01｜已恢复的可运行研究工具，不替代 MAIN。
- Z04/K02-03-HXL-01、TEMP-M01、TEMP-E01｜PAUSED_SUPPORT。

## 2｜动起来

### MAIN｜严格状态
- M01｜COMPLETED
- M02｜ACCEPTED_L1_CANDIDATE_ONLY
- M03｜BLOCKED_CLEAN_CONTEXT
- M04｜BLOCKED_BY_M03

本轮发现并纠正并发状态漂移：真实图片姿态与 OpenSim 产物可作为能力证据保留，但不得在没有新鲜隔离 D 上下文时重开或关闭正式 M03/M04。

### SUB｜COMMON-HUMAN-COORDINATE / HUMAN-3D｜EXECUTING
**当前节点：BICEPS-DYNAMIC-3D-V0.7｜NOT_CLOSED / PUBLIC_VISUAL_GATE_FAILED**

- [公开运动页面](movement.html)
- 实物存在：右肱骨、桡骨、尺骨、肱二头肌长/短头真实 OBJ 可见；视角变化和屈肘响应可见。
- 本轮新增人工视觉解剖审计：现有功能证据绑定旧 `gitSha=41a87a0b`，且 CENTERED_LOCAL_WRAPPER 没有近端/远端锚点或端点距离不变量，因此截图不能证明肌肉附着连续、关节面约束或碰撞安全。
- [V0.7 视觉审计](../docs/v0.1/evidence/m2/biceps-visual-anatomy-audit-v0.7.json) · [状态与页面纠正](https://github.com/foxlongfei/zero-one-workbench/commit/879e6853beb85e221183f1589b4f74d118637893)
- TEMP-YOUTH / TEMP-CLUB / TESTSET｜QUEUED。
- 精确断点：为肱二头肌两头建立近端/远端锚点跟踪和连续性不变量；随后针对同一部署版本重新截取伸展、中段、峰值三图并人工复核。

## 3｜ZERO-CORE｜公共基础设施 SUB
不替代两项目 MAIN；REMOTE_DEPLOY 未发生。

## 4｜本轮角色、成果与验收
- D：Z05 D07 来源绑定操作门；BICEPS 视觉证据审计。
- Q：Z05 六个正常/反例；BICEPS 版本新鲜度、锚点连续、关节约束边界。
- C：并发状态冲突处理；Pages、CURRENT、总首页与 Drive 同步。
- 最近一次真实成果变化：2026-10-04 09:45 +08:00。
- 本周期结论：**Z05 有实质推进；动起来形成新的否决性视觉证据与公开验收边界，但未提高完成度。**
