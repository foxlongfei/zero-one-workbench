# K3 完成报告｜成熟环境 / 地理引擎

- 状态：`COMPLETED`
- 完成日期：2026-10-07（CST）
- 唯一任务来源：[Issue #2](https://github.com/foxlongfei/zero-one-workbench/issues/2)
- 主发布页：https://foxlongfei.github.io/zero-one-workbench/portal/k02-board.html
- 真实引擎运行：https://github.com/foxlongfei/zero-one-workbench/actions/runs/37613006882
- 公开页面验收：https://github.com/foxlongfei/zero-one-workbench/actions/runs/37613463955
- 机器可读运行证据：[radiance-engine-run.json](evidence/k3/radiance-engine-run.json)
- 机器可读公开证据：[public-radiance-verification.json](evidence/k3/public-radiance-verification.json)
- 计算结果：[JSON](../../portal/data/k3-radiance-daylight.json) · [CSV](../../portal/data/k3-radiance-daylight.csv)

## 实际交付

K3 接入的是 LBNL Radiance 6.0.2 正式 Linux 发布版，不是网页端自造采光公式。运行链固定并实际执行：

`gensky → oconv → rtrace -I+`

1. `gensky` 生成广州夏至 6 月 21 日 12:00 的 CIE clear sky + sun；
2. `oconv` 把真实住宅参考几何、材质、窗和天空编译为 Radiance octree；
3. `rtrace -I+` 在 0.8 m 工作面上对 20 个传感点执行多次反射辐照度计算；
4. Radiance RGB 按 `179 × (0.265R + 0.670G + 0.065B)` 转为照度 lux；
5. JSON / CSV 产物进入堪舆先生唯一主页面并绘制 20 点照度图。

## 引擎与模型固定

| 项目 | 固定值 |
|---|---|
| 引擎 | Radiance 6.0.2，LBNL，2026-02-02 |
| 官方发布 | `LBNL-ETA/Radiance`，tag `rad6R0P2` |
| Linux 包 SHA-256 | `04ee53cafbb64b943a53616b3d0ee379dd7ef80379c83aa7a145e547d9809c28` |
| 核心命令 | `gensky` / `oconv` / `rtrace` |
| 模型 | 5 × 4 × 3 m 住宅参考房间，南向 3 × 1.4 m 窗，窗台 1.0 m |
| 模型 SHA-256 | `513601ce6db129f984eca410c539e90eb2e5eb90c245566d461d40013cb04615` |
| 工作面 | 0.8 m，20 个传感点 |
| 单位 | lux |
| 许可 | Radiance License |

工作流先校验官方二进制包哈希；引擎、模型或产物门任一失败即停止，不提交结果。

## 真实运行结果

| 指标 | 结果 |
|---|---:|
| 传感点 | 20 |
| 平均照度 | 771.6 lux |
| 最低照度 | 421.2 lux |
| 最高照度 | 1976.2 lux |
| 最低/平均均匀度 | 0.546 |
| 窗边区域均值 | 1049.2 lux |
| 深区均值 | 494.0 lux |

20 个传感点均得到有限正值；窗边均值高于深区均值，符合该几何与南窗条件下的空间梯度。公开主页面读取同一 JSON，显示 20 个点、版本、单位、模型哈希、天空条件和窗边/深区对比。

## 验收门结论

K3 已通过完整验收链：

1. 固定版本的成熟 Radiance 引擎真实存在；
2. 官方二进制 SHA-256 校验通过；
3. `gensky`、`oconv`、`rtrace` 均实际运行；
4. JSON / CSV / 引擎证据生成；
5. 结果进入 `portal/k02-board.html` 主页面；
6. GitHub Pages 部署成功；
7. 公开浏览器读回 Radiance 6.0.2、20 点、lux、全部指标和模型哈希；
8. 严格公开证据 `passed: true` 并保存截图。

因此 K3 标记为 `COMPLETED`。本报告只关闭 K3；堪舆先生 MAIN B 仍为 `EXECUTING`，下一项为 K4 传统体系与证据分层，随后是 K5 先生反馈闭环。

## 边界

这是固定参考房间的单时刻晴空计算，不是用户住宅现场测量，也不是全年气候采光自治率。用户真实个案必须以自己的几何、窗参数、遮挡和天气文件重新计算；Radiance 现代可测结果不能直接改名为“气”“吉凶”或其他传统概念。
