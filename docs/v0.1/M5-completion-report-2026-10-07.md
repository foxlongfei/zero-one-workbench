# M5 完成报告｜训练反馈闭环

- 状态：`COMPLETED`
- 完成日期：2026-10-07（CST）
- 唯一任务来源：[Issue #2](https://github.com/foxlongfei/zero-one-workbench/issues/2)
- 主发布页：https://foxlongfei.github.io/zero-one-workbench/portal/movement.html
- 双样板严格验收：https://github.com/foxlongfei/zero-one-workbench/actions/runs/37606114771
- 机器可读公开证据：[public-training-loop-verification.json](evidence/m5/public-training-loop-verification.json)
- 验收输入版本：`039fdcea46af244250bc5938d95e75064c4f4268`
- 证据回写版本：`14699584c309fc5ea6b95c57f871c61d77ff66e1`

## 实际交付

M5 在运动达人唯一主入口内闭合“需求 → 解析 → 动作 → 解剖/关节/OpenSim 解释 → 会话反馈 → 下一次调整”，没有新开替代产品页。训练解释读取同页真实上游结果：

1. M2：完整 Human Atlas，2,234 个网格、3,432 个 FMA concepts、15 个系统；
2. M3：用户上传图片经 MediaPipe Pose Landmarker Full 实际推理，输出 33 个二维关键点、33 个世界坐标关键点和右肘角度；
3. M4：OpenSim Core 4.6 / Arm26 实际计算产物，按当前右肘角映射到最近的可复现模型状态，并读取 BIClong muscle-tendon length 与 elbow moment arm；
4. M5：两个训练场景完成输入解析、动作组织、反馈决策，异常信号进入安全分流。

## 两份独立上传样板

严格验收不是在脚本中注入关节值，而是把两份不同图片依次上传到公开 Pages 的同一个 `<input type="file">`，等待浏览器内 MediaPipe 推理完成后读回结果：

| 样板 | 来源 | 二维 / 世界关键点 | 右肘 | OpenSim 最近状态 |
|---|---|---:|---:|---:|
| `case2_12.jpg` | 仓库既有真实姿态样板 | 33 / 33 | 105° | 90° |
| `mediapipe-pose-test-image.jpg` | `google-ai-edge/mediapipe-samples` 的 PoseLandmarkerTests 官方测试图（blob `69a5241ecb9d326ba7c71573f5b4fc14b12e9ca7`） | 33 / 33 | 154° | 120° |

两份样板名称、来源和计算角度均写入公开证据。第二份样板成为当前页姿态上下文，两个训练场景都读到 `user-upload`、右肘 154°、OpenSim 120°、BIClong 长度 `0.348258 m` 和力臂 `0.045642 m`。

## 双场景与反馈决策

| 场景 | 实际输入 | 动作数 | 用户反馈 | 决策 |
|---|---|---:|---|---|
| 户外单杠 | “户外有单杠，想练背和手臂，15分钟” | 4 | 偏吃力 | `REGRESS`：下一次减少约 20% 次数或降低动作版本，并增加休息 |
| 家中全身 | “15分钟在家徒手练全身” | 5 | 轻松 | `PROGRESS_SMALL`：下一次只增加一个变量 |

另以含“麻、胸闷”的输入复跑安全分流：页面进入 `safety-triage`，不生成推进性训练计划，不启动训练会话，并只收集部位、起始时间、诱因、持续/加重及伴随信号。

## 验收门结论

M5 已通过 Issue #2 的完整验收链：

1. MediaPipe、Human Atlas、OpenSim 及训练场景/安全规则均实际存在；
2. 两份独立用户上传样板在公开页面运行真实姿态推理；
3. 机器证据记录两份 33/33 关键点与不同肘角；
4. 同一主页面把 M2 / M3 / M4 结果带入 M5 解释；
5. GitHub Pages 部署并返回 HTTP 200；
6. 两个指定场景分别完成反馈调整，安全样板完成分流；
7. 严格工作流成功且证据 `passed: true`。

因此 M5 标记为 `COMPLETED`，运动达人 MAIN 1 的 M1–M5 已闭合。本报告不提前关闭 Issue #2；堪舆先生 MAIN 2 的 K3–K5 仍须继续施工。

## 边界

本原型按当前姿态角映射最近的离散 OpenSim 状态，并展示成熟模型的可复现结果；它不是个人校准后的力值、医疗诊断或治疗处方。训练建议是可追踪的原型闭环，用户出现异常信号时以安全分流和专业评估为先。
