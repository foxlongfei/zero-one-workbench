# 双项目 CURRENT｜2026-10-03 22:05 +08:00

本页只记录真实执行状态。**实物 → 对应 Pages 接入 → Pages 发布 → 公开运行/读回 → 总首页/CURRENT/Drive 同步**；任一门缺失即 `NOT_CLOSED`，不提高完成度。

## 1｜零一空间研究

### MAIN｜Z05 古代技术可运行重建｜EXECUTING
**当前节点：Z05-B｜SOURCE_BINDING → RULE_TABLE / DECISION_NODES / 真实输入运行**

- [公开古代技术实验台](k02-board.html)
- 本轮实质增量：冻结《欽定協紀辨方書·卷二》影印 leaf/PDF 5–7。leaf 5 为二十四方位图；leaf 6 说明四天干、八地支、四隅卦组成二十四方位；leaf 7 给出八组三山次序。
- 历史来源只认证**名称、组成、循环次序**；15° 等分与真北 0° 顺时针仍明确标为工程归一化，不冒充古籍原文。
- 公开真实输入读回：`182.4° → 午山`、中心角 `180°`，页面同时输出“仅为工程归一化，不生成吉凶”。
- 现代 depthmapX 链已标为 SUPPORT CAPABILITY，不替代 Z05 MAIN。
- [SOURCE_BINDING V0.5](../research/zero-one/z05-b-24-mountain-source-binding-v0.2.json) · [来源提交](https://github.com/foxlongfei/zero-one-workbench/commit/edad0e432) · [公开实验台状态修正](https://github.com/foxlongfei/zero-one-workbench/commit/6655c419)
- 验收：来源页栏、规则边界、真实输入与公开读回 **PASS**；Z05-B 整体仍 **NOT_CLOSED**，下一断点是把已冻结顺序正式落入 RULE_TABLE / DECISION_NODES 的结构化执行记录与反例。

### SUPPORT / PAUSED
- Z05 问题路由器｜ACTIVE_SUPPORT；SUPPORT_LIBRARY｜ON_DEMAND。
- TEMP-MODEL-01｜既有可运行研究工具，不替代 MAIN。
- Z04/K02-03-HXL-01、TEMP-M01、TEMP-E01｜PAUSED_SUPPORT。

## 2｜动起来

### MAIN｜M01→M02/M03→M04｜严格状态不变
- M01｜COMPLETED
- M02｜ACCEPTED_L1_CANDIDATE_ONLY
- M03｜BLOCKED_CLEAN_CONTEXT
- M04｜BLOCKED_BY_M03

### SUB｜COMMON-HUMAN-COORDINATE / HUMAN-3D｜EXECUTING
**当前节点：BICEPS-DYNAMIC-3D-V0.6｜NOT_CLOSED / PUBLIC_VISUAL_GATE_FAILED**

- [公开运动页面](movement.html)
- 实物：真实 BodyParts3D 右肱骨、桡骨、尺骨、肱二头肌长/短头已恢复到主页面；桡尺骨组使用组内肘 pivot，肌肉形变使用自身中心 wrapper。
- 本轮否决旧结论：旧峰值截图是在“正在加载”状态截取，且仍显示肌肉与骨架明显分离；旧像素差只能证明控件触发，不能证明解剖连续。
- 新远端取证仍失败：`f37965cb` 在等待已变化的 Human Atlas DOM 时超时；证据 JSON `passed=false`。当前云浏览器又因 WebGL 被禁用而无法补视觉通过证据。
- 已修复取证器：每轮先清空旧截图，绑定当前 iframe，读取正确的 BICEPS 阶段节点，避免失败时沿用陈旧图；但由 GitHub 连接器提交未触发新的 Actions 运行，所以本轮不得标 PASS。
- [BICEPS 实物提交](https://github.com/foxlongfei/zero-one-workbench/commit/a3baed00) · [失败证据](../docs/v0.1/evidence/m2/public-webgl-verification.json) · [取证器修复](https://github.com/foxlongfei/zero-one-workbench/commit/41a87a0b) · [状态边界修正](https://github.com/foxlongfei/zero-one-workbench/commit/dfc3c9c6)
- 照片姿态识别与 Human Atlas 均为能力块；它们不改写正式 M02/M03。TEMP-YOUTH / TEMP-CLUB / TESTSET｜QUEUED。
- 精确断点：在可创建 WebGL 的远端环境运行修复后的取证器；必须等待 `realAssetState=DISPLAYED` 后再截伸展、+45°观察、峰值三图并人工检查连续性。未通过前不得传播到下一节点。

## 3｜ZERO-CORE｜公共基础设施 SUB
不替代两项目 MAIN。本轮不扩张 ZERO-CORE；REMOTE_DEPLOY 未发生。

## 4｜本轮角色、在线状态与验收
- D：Z05 来源绑定、BICEPS 局部 pivot 实物与取证器修复。
- Q：Z05 公开真实输入/边界读回；BICEPS 陈旧证据识别与公开 WebGL 失败判定。
- C：正式状态与能力块冲突处理；总首页、项目页、CURRENT、Drive 写回与读回。
- 最近一次后台运行：2026-10-03 22:05 +08:00。
- 最近一次真实成果变化：Z05 影印页栏与运行边界闭环；BICEPS 取证门修复并撤销不可靠 PASS。
- 本周期结论：**Z05 有实质推进；动起来有实物和验收门修复，但用户层成果仍 NOT_CLOSED，不提高完成度。**
