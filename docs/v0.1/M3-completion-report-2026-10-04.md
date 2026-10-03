# M3 完成报告｜完整运动 / 动作能力块

- 状态：`COMPLETED`
- 完成日期：2026-10-04（CST）
- 唯一任务来源：Issue #2
- 主发布页：https://foxlongfei.github.io/zero-one-workbench/portal/movement.html
- 自动公开验收：https://github.com/foxlongfei/zero-one-workbench/actions/runs/37149706517
- 机器可读证据：[public-pose-verification.json](evidence/m3/public-pose-verification.json)

## 实际交付

运动达人主发布页已形成同页闭环：用户可输入自然语言训练需求，或上传动作照片；页面用 MediaPipe Pose Landmarker Full 运行真实图片识别，并把人体骨架、分割掩膜、33 个二维关键点、33 个世界坐标关键点和标准关节结果写回同一页面的统一人体坐标。

为避免把静态演示或代码存在误算为完成，公开验收器直接打开 GitHub Pages，点击“运行真实俯卧撑样本”，等待发布页实际推理完成，再检查页面输出并截图留证。样本为仓库中的真实图片 `portal/assets/case2_12.jpg`。

## 验收结果

| 验收项 | 公开运行结果 |
|---|---|
| 上游能力 | MediaPipe Pose Landmarker Full |
| 真实图片 | `portal/assets/case2_12.jpg` |
| 姿态数量 | 1 |
| 二维关键点 | 33 |
| 世界坐标关键点 | 33 |
| 分割掩膜 | 1 |
| 平均可见度 | 0.74 |
| 骨架绘制像素 | 2406 |
| 标准关节 | 左/右肘、左/右髋、左/右膝共 6 项 |
| 自然语言输入 | `15分钟在家练全身` |
| 自然语言输出 | 返回 15 分钟全身循环，包含深蹲、俯卧撑、髋铰链、反向弓步、平板支撑 |
| 自动验收结论 | `passed: true` |

本次真实帧的关节角度为：左肘 105°、右肘 105°、左髋 161°、右髋 139°、左膝 104°、右膝 67°。页面同时返回对应世界坐标；反馈明确限定为单帧姿态描述，不自动诊断伤病或武断判定动作好坏。

## 验收门结论

M3 已满足 Issue #2 的验收门：**真实输入 → 成熟姿态模型实际运行 → 动作/关节结果 → 同一主页面统一人体坐标回写 → Pages 部署 → 公开页面自动读回与截图证据**。因此 M3 标记为 `COMPLETED`。

本报告只关闭 M3，不扩张完成范围。下一项仍为 M4。
