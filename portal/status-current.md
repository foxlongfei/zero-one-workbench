# 双项目 CURRENT｜2026-10-04 03:44 +08:00

本页只记录真实执行状态。**实物 → 对应 Pages 接入 → Pages 发布 → 公开运行/读回 → 总首页/CURRENT/Drive 同步**；任一门缺失即 `NOT_CLOSED`，不提高完成度。

## 1｜零一空间研究

### MAIN｜Z05 古代技术可运行重建｜EXECUTING
**当前节点：Z05-B｜SOURCE_BINDING → RULE_TABLE / DECISION_NODES / 真实输入运行**

- [公开古代技术实验台](k02-board.html)
- 本轮实质增量：四个现场观察字段及采集来源已真正接入 D04–D06 决策节点；新增字段/来源配对门、观察集合分类与就绪度输出，验证器 5/5。
- 历史来源只认证**名称、组成、循环次序**；15° 等分与真北 0° 顺时针仍明确标为工程归一化，不冒充古籍原文。
- 公开住宅A读回：`182.4° → 午山`；主要开口/道路已知，水体/坡向未知，返回 `DIRECTION_ONLY_PARTIAL_OBSERVATION`。值有而来源缺失返回 `MISSING_SOURCE`；来源有而值为空返回 `ORPHAN_SOURCE`；四字段完整时返回 `DIRECTION_AND_OBSERVATION_READY`。
- 现代 depthmapX 链已标为 SUPPORT CAPABILITY，不替代 Z05 MAIN。
- [观察决策图 V0.2](../research/zero-one/z05-b-site-observation-decision-graph-v0.2.json) · [公开验收证据](../docs/v0.1/evidence/z05-b/public-observation-decision-verification-v0.2.json) · [页面提交](https://github.com/foxlongfei/zero-one-workbench/commit/95ef1876d90b444465ce595ceca62811123134de)
- 验收：结构、正常样例、两个配对反例、完整输入、Pages 发布与公开交互读回 **PASS**；就绪度不冒充环境判断或吉凶。Z05-B 整体仍 **NOT_CLOSED**，下一断点是仅在有历史依据时，把一个环境操作绑定到完整就绪输入。

### SUPPORT / PAUSED
- Z05 问题路由器｜ACTIVE_SUPPORT；SUPPORT_LIBRARY｜ON_DEMAND。
- TEMP-MODEL-01｜既有可运行研究工具，不替代 MAIN。
- Z04/K02-03-HXL-01、TEMP-M01、TEMP-E01｜PAUSED_SUPPORT。

## 2｜动起来

### MAIN｜Issue #2 当前验收状态
- M01｜COMPLETED
- M02｜COMPLETED
- M03｜COMPLETED（2026-10-04）
- M04｜COMPLETED（2026-10-04）
- M05｜NOT COMPLETED

M03 已通过公开真实图片闭环：MediaPipe Pose Landmarker Full 实际识别 `case2_12.jpg`，输出 33 个二维关键点、33 个世界坐标关键点、分割掩膜与 6 个标准关节结果，并回写运动达人主页面的统一人体坐标。自然语言训练方案路径同时通过。 [M3 完成报告](../docs/v0.1/M3-completion-report-2026-10-04.md) · [公开证据](../docs/v0.1/evidence/m3/public-pose-verification.json) · [自动验收运行](https://github.com/foxlongfei/zero-one-workbench/actions/runs/37149706517)

M04 已通过真实 OpenSim Core 闭环：官方 OpenSim 4.6 加载固定哈希的 Arm26，设置 5 个 `r_elbow_flex` 状态，对 6 条肌肉生成 30 行 muscle-tendon length / elbow moment arm；主页面可切换状态并显示来源、模型、单位。 [M4 完成报告](../docs/v0.1/M4-completion-report-2026-10-04.md) · [公开证据](../docs/v0.1/evidence/m4/public-opensim-verification.json) · [OpenSim 重算](https://github.com/foxlongfei/zero-one-workbench/actions/runs/37168584402) · [公开验收](https://github.com/foxlongfei/zero-one-workbench/actions/runs/37168584440)

### SUB｜COMMON-HUMAN-COORDINATE / HUMAN-3D｜EXECUTING
**当前节点：BICEPS-DYNAMIC-3D-V0.6｜NOT_CLOSED / PUBLIC_VISUAL_GATE_FAILED**

- [公开运动页面](movement.html)
- 实物：真实 BodyParts3D 右肱骨、桡骨、尺骨、肱二头肌长/短头已恢复到主页面；桡尺骨组使用组内肘 pivot，肌肉形变使用自身中心 wrapper。
- 本轮否决旧结论：旧峰值截图是在“正在加载”状态截取，且仍显示肌肉与骨架明显分离；旧像素差只能证明控件触发，不能证明解剖连续。
- 新远端取证仍失败：`f37965cb` 在等待已变化的 Human Atlas DOM 时超时；证据 JSON `passed=false`。当前云浏览器又因 WebGL 被禁用而无法补视觉通过证据。
- 已修复取证器：每轮先清空旧截图，绑定当前 iframe，读取正确的 BICEPS 阶段节点，避免失败时沿用陈旧图；但由 GitHub 连接器提交未触发新的 Actions 运行，所以本轮不得标 PASS。
- [BICEPS 实物提交](https://github.com/foxlongfei/zero-one-workbench/commit/a3baed00) · [失败证据](../docs/v0.1/evidence/m2/public-webgl-verification.json) · [取证器修复](https://github.com/foxlongfei/zero-one-workbench/commit/41a87a0b) · [状态边界修正](https://github.com/foxlongfei/zero-one-workbench/commit/dfc3c9c6)
- Human Atlas 与照片姿态识别分别作为 M2、M3 的已验收能力保留在同一主入口。TEMP-YOUTH / TEMP-CLUB / TESTSET｜QUEUED。
- 精确断点：在可创建 WebGL 的远端环境运行修复后的取证器；必须等待 `realAssetState=DISPLAYED` 后再截伸展、+45°观察、峰值三图并人工检查连续性。未通过前不得传播到下一节点。

## 3｜ZERO-CORE｜公共基础设施 SUB
不替代两项目 MAIN。本轮不扩张 ZERO-CORE；REMOTE_DEPLOY 未发生。

## 4｜本轮角色、在线状态与验收
- D：Z05 观察字段/来源配对与 D04–D06 就绪图；BICEPS 本轮不改实物。
- Q：Z05 正常样例、缺来源、孤立来源、完整输入与边界读回；BICEPS 维持视觉门失败判定。
- C：正式状态与能力块冲突处理；总首页、项目页、CURRENT、Drive 写回与读回。
- 最近一次真实成果变化：2026-10-04，运动达人 M4 完成 OpenSim Core 肌骨计算与公开状态切换验收。
- 本周期结论：**运动达人 M4 通过 Issue #2 验收门；只关闭 M4，下一项为 M5。**
