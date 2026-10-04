# M4 完成报告｜完整肌骨 / 生物力学能力块

- 状态：`COMPLETED`
- 完成日期：2026-10-04（CST）
- 唯一任务来源：Issue #2
- 主发布页：https://foxlongfei.github.io/zero-one-workbench/portal/movement.html
- OpenSim Core 重算验收：https://github.com/foxlongfei/zero-one-workbench/actions/runs/37168584402
- 公开页面功能验收：https://github.com/foxlongfei/zero-one-workbench/actions/runs/37168584440
- 机器可读公开证据：[public-opensim-verification.json](evidence/m4/public-opensim-verification.json)
- 计算结果：[JSON](../../portal/data/m4-opensim-arm26-results.json) · [CSV](../../portal/data/m4-opensim-arm26-results.csv)

## 实际交付

M4 不再把 `.osim` XML 读取或网页手臂动画当作 OpenSim 计算。可复现运行链安装官方 `opensim==4.6` Python 包，由 OpenSim Core 实际加载成熟 Arm26 模型、初始化 Simbody System、设置 `r_shoulder_elev = 0 rad`，并依次设置 `r_elbow_flex = 0° / 30° / 60° / 90° / 120°`。每个状态均推进到 Position 阶段，对模型全部 6 条肌肉计算：

1. muscle-tendon length，单位 `m`；
2. elbow flexion moment arm，单位 `m`。

计算产物共 5 个坐标状态 × 6 条肌肉 = 30 行结果，已进入运动达人唯一主页面。用户可以直接切换五个肘屈状态，观察 TRIlong、TRIlat、TRImed、BIClong、BICshort、BRA 的真实模型结果。

## 模型与来源固定

| 项目 | 固定值 |
|---|---|
| 引擎 | OpenSim Core 4.6 |
| 引擎许可 | Apache-2.0 |
| 模型 | OpenSim Arm26 |
| 模型仓库 | `opensim-org/opensim-models` |
| 模型提交 | `84b487c4e3245359a64381e01f01b9cf4772d457` |
| 模型 SHA-256 | `e2224d0044eb393b05d64926c3fa1682c451a9adc7f510e5517ef9958d3d41b9` |
| 模型许可 | CC BY 3.0 |
| 关联论文 | Holzbaur, Murray, Delp, *Annals of Biomedical Engineering* 33, 829–840, 2005 |

模型 URL 和哈希都固定在运行脚本与工作流中；哈希不匹配时计算直接失败。

## 可复现计算结果

公开页面默认显示 90° 状态，其中：

| 肌肉 | muscle-tendon length | elbow moment arm |
|---|---:|---:|
| BIClong | 0.373656 m | 0.048753 m |
| BICshort | 0.290769 m | 0.048753 m |
| BRA | 0.122367 m | 0.022694 m |
| TRIlong | 0.312263 m | -0.019946 m |

公开验收器随后切换到 120°，读回 BIClong 长度 `0.348258 m`、力臂 `0.045642 m`，确认页面不是静态写死单一值，而是在读取同一真实计算产物中的不同 OpenSim 状态。

## 验收门结论

M4 已通过 Issue #2 的完整验收链：

1. OpenSim 4.6 依赖、固定模型和运行脚本实际存在；
2. 本地与 GitHub Actions 均由 OpenSim Core 真实运行；
3. JSON / CSV 可复现计算产物生成；
4. 结果进入 `portal/movement.html` 主页面；
5. GitHub Pages 部署成功；
6. 公开浏览器读回来源、模型、单位、90° 默认状态，并切换到 120° 验证结果变化；
7. 自动证据结论为 `passed: true`。

因此 M4 标记为 `COMPLETED`。本报告只关闭 M4，不提前关闭 M5；下一项为训练反馈闭环 M5。
