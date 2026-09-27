# 双项目当前状态

更新时间：2026-09-27 09:35（UTC+08:00）

> Drive 为权威研究记录；本页是公开状态镜像。完成度只按实际验收物计算，不以时间戳或同步动作计数。

## 零一空间研究

- 当前主线：Z04 — **3/4，in_progress**
- 当前执行：TEMP-E01 / TEMP-M01；`95T1J1:4` 图像见证定点审计
- 并行分工：C=图片资源与题注映射；Q=IA-01—03证据门验收；D=GitHub成果、Drive写回与读回
- 最近真实成果：新增 `IMAGE_ASSET_AUDIT V0.1`。二手对象页的95T1J1:4说明段之后存在两张独立图片资产，并以“正、反面线图和拓片”作共同题注
- 访问状态：两张CDN图片在当前检索接口中因内容类型被拒绝；登记为 `ACCESS_FAILURE`，不是“图片不存在”
- 新增验收门：题注共置只能建立二手图像见证；未取得可视字节及原报告对象表/题注前，不得裁决“一/七”或升级 `AUDIT_PASS`
- 验收状态：`SECONDARY_IMAGE_WITNESS_LOCATED_BYTES_PENDING`；Z04仍为3/4
- 当前阻塞：原报告《华夏考古》1997(2)第34–35页及可视图片字节仍未取得
- 下一步：取得任一图片字节或原报告页，逐图标注 photo / line drawing / rubbing，并核对两组六位数与外侧刻画的位置
- 成果：[图像见证清单](../research/zero-one/95T1J1-4-image-witness-v0.1.json) · [Drive权威记录](https://docs.google.com/document/d/1NmEBYBXLIM4gTL_ZeRSWUMPGt1buB6ehTgipB-aCWCc/edit)
- 提交：[`951c6dae`](https://github.com/foxlongfei/zero-one-workbench/commit/951c6dae95179002f404c3a2dc7a4d759b4b6b30)

## 动起来

- 当前主线：M01→M02/M03→M04 — **0/4，in_progress**
- 当前执行：共同人体坐标系 `MEASUREMENT_FEASIBILITY` 可运行门；M01冻结链优先
- 并行分工：C=判定器实现；Q=机器正反测试；D=GitHub成果、Drive写回与读回
- 最近真实成果：MF-01—05从文字规则升级为可执行 JavaScript 验证器；建立6个测试夹具并实际运行
- 测试结果：**6/6 PASS**。覆盖手机单机视频、校准双机＋同步外力、EMG单源误推肌力、未同步超声误算能量、完整同步栈、离面单机精确角度
- 输出分层：`MEASURED / MODEL_DERIVED / QUALITATIVE_ONLY / UNAVAILABLE`
- 验收状态：`MEASUREMENT_FEASIBILITY validator = TEST_PASS + GITHUB_READBACK_PASS`；不计入M01—M04完成项
- 当前阻塞：M01仍缺冻结ZIP、统一manifest和clean blind review；反手引体素材缺同步外力、超声和个体肌骨模型
- 下一步：把现有CASE_0001真实来源字段接入验证器，产出逐变量来源分类表
- 成果：[验证器](../research/movement/measurement-feasibility-validator-v0.1.mjs) · [测试夹具](../research/movement/mf-t01-cases-v0.1.json) · [Drive权威记录](https://docs.google.com/document/d/1ZNPdOSkKpWjEmWExr-zxaQV2s6vSClg_rh8uZQo85Bc/edit)
- 提交：validator [`f73fbaf9`](https://github.com/foxlongfei/zero-one-workbench/commit/f73fbaf92fe354b400b1419c9b26bc9055c46962)；fixtures [`8aa544aa`](https://github.com/foxlongfei/zero-one-workbench/commit/8aa544aa1d60e6372380c91ae9fa7bbcd91f0587)

## 验收

本周期两个项目均有真实文件、Schema或测试变化；Drive三文档及GitHub成果文件均已读回。主线完成度未虚增。

- [Drive双项目动态执行看板](https://docs.google.com/document/d/16xSk77EHM3D_v2gdEenKs5q8ZXHF7gpWkc_r9a6dn8I/edit)
- [公开动作库](./exercise-library.html)
