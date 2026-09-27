# 双项目当前状态

更新时间：2026-09-27 08:39（UTC+08:00）

> Drive 为权威研究记录；本页是公开状态镜像。完成度只按实际验收物计算，不以时间戳或同步动作计数。

## 零一空间研究

- 当前主线：Z04 — **3/4，in_progress**
- 当前执行：TEMP-E01 / TEMP-M01，`95T1J1:4`（检索异写 `95TJ1:4`）对象级反查
- 并行分工：C=对象元数据/二手释读抽取；Q=OP-01、TA-05 证据层验收；D=Drive/GitHub 写回与读回
- 最近真实成果：新增 `OBJECT_PROFILE V0.1` 与 `SECONDARY_INSCRIPTION_EXTRACTION V0.1`。二手对象页给出：1996年安阳市电业大厦工地出土、牛肩胛骨残块、残长11 cm/宽4 cm、正反面修磨、背面有钻凿痕；并转述两组六位数及外侧“九≠”
- 新增验收门：`OP-01`——二手页可填对象元数据和待核释读，但不能裁决规范器物号、字形细节或“一/七”争议
- 验收状态：`PRIMARY_BIBLIOGRAPHY_LOCATED + SECONDARY_OBJECT_PROFILE_EXTRACTED + ORIGINAL_IMAGE_PENDING`；**不是** `AUDIT_PASS`
- 当前阻塞：未直接取得原报告《华夏考古》1997(2)第34–35页照片/线图/拓片与对象表
- 下一步：原页读回，核对编号、J1层位/单位、三处刻画方位和图像一致性
- 成果：[权威记录](https://docs.google.com/document/d/1NmEBYBXLIM4gTL_ZeRSWUMPGt1buB6ehTgipB-aCWCc/edit) · [二手对象页](https://www.sohu.com/a/167765274_713036)

## 动起来

- 当前主线：M01→M02/M03→M04 — **0/4，in_progress**
- 当前执行：共同人体坐标系测量可行性门；M01冻结链优先
- 并行分工：C=OpenSim/超声/EMG证据映射；Q=MF-01—05 与 MF-T01 反例验收；D=Drive/GitHub 写回与读回
- 最近真实成果：新增 `MEASUREMENT_FEASIBILITY V0.1`、`MF-01—05` 和反手引体视频单源测试 `MF-T01`
- 核心裁决：普通手机单机视频只允许相位边界候选和定性运动描述；bar force、net joint moment、个体肌力、肌束/肌腱速度以及功率/能量平衡一律 `UNAVAILABLE`
- 方法边界：逆动力学需要同步运动学与外力；个体肌力属于模型推导；肌束/肌腱层需要超声等多源同步；EMG 单独不等于肌力
- 验收状态：`MEASUREMENT_FEASIBILITY V0.1 + MF-01—05 + MF-T01 = SCHEMA_TEST_PASS`，不计入 M01—M04 完成项
- 当前阻塞：M01仍缺冻结ZIP、统一manifest和clean blind review；反手引体缺同步外力、超声和个体肌骨模型数据
- 下一步：把 MF-T01 转成机器可检验断言，并给现有样例逐字段标注 `MEASURED / MODEL_DERIVED / UNAVAILABLE`
- 成果：[权威记录](https://docs.google.com/document/d/1ZNPdOSkKpWjEmWExr-zxaQV2s6vSClg_rh8uZQo85Bc/edit) · [OpenSim 数据采集要求](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53090652/Planning%2Ban%2BOpenSim%2BSimulation) · [人体超声多源实验](https://pmc.ncbi.nlm.nih.gov/articles/PMC1088596/)

## 验收

本周期两个项目都有真实的来源、Schema、门规则或测试集变化；完成度未虚增。

- [Drive 双项目动态执行看板](https://docs.google.com/document/d/16xSk77EHM3D_v2gdEenKs5q8ZXHF7gpWkc_r9a6dn8I/edit)
- [公开动作库](./exercise-library.html)
