# 双项目 CURRENT

最近后台运行：2026-09-28 09:37:56 +08:00  
本周期：两个项目均有可观察增量并完成公开读回。零一把 Z05-B 的第一个确定性步骤变成可运行轨迹；动起来把右肘从空映射提升为边界明确的三骨关节代理。严格完成度未虚增。

## 零一空间研究

- 当前主线：`Z05` 古代技术可运行重建
- 当前执行：`ROUTE_KANYU → Z05-B` 二十四山方位归一化候选；输入方位角后返回山名、中心角和运行边界
- 并行辅线 / 分工：C 负责运行合同、边界案例与公开页；Q/D 尚未承担精确原典定位；`Z04/K02-03-HXL-01`、`TEMP-E01`、`TEMP-M01` 保持 `PAUSED_SUPPORT`
- 最近真实成果变化：固定 `PRACTICE_CONTEXT + INPUT_SCHEMA + PROCEDURE + OUTPUT_SCHEMA`；完成24个唯一山名、15度等分、真北0度顺时针、左闭右开及跨零度规则。结构验证 5/5，10个边界案例 10/10；公开输入 180° 返回午山、7.5° 返回癸山，读回 2/2
- 成果：[公开实验台](k02-board.html)；[运行合同](../research/zero-one/z05-b-24-mountain-orientation-normalizer-v0.1.json)；[验证器](../research/zero-one/z05-b-24-mountain-orientation-normalizer-v0.1.mjs)；[10案例](../research/zero-one/z05-b-24-mountain-orientation-normalizer-cases-v0.1.json)；[公开读回](../research/zero-one/z05-b-24-mountain-public-readback-v0.1.json)；[页面提交 d647843b](https://github.com/foxlongfei/zero-one-workbench/commit/d647843bffcc31f7c99a5c86f28ca5734372d2d7)
- 当前阻塞：精确历史时期、版本、原文页码尚未冻结；当前只是方位归一化步骤，不是完整堪舆方法，也不输出吉凶
- 下一步：为二十四山规则绑定可定位原文与版本，完成 `SOURCE_BINDING` 后再接 `RULE_TABLE / DECISION_NODES`；不得把本轮确定性计算冒充历史有效性
- 任务状态：`Z05` ACTIVE；旧 Z04/K02 与 TEMP 两线 PAUSED_SUPPORT
- 验收状态：deterministic_normalization=true；historical_source_verified=false；complete_kanyu_method=false；Z05 V0.1 未闭环；旧 Z04 严格 `0/5`

## 动起来

- 当前主线：`M01→M02/M03→M04`
- 当前执行：共同人体坐标系的 `JOINT_ELBOW` 资产引用；M03 仍受干净上下文门禁阻塞
- 并行辅线 / 分工：C 完成右肘三骨代理和公开页；D 未启动；`TEMP-YOUTH`、`TEMP-CLUB`、`TESTSET` 保持既有队列
- 最近真实成果变化：把右肘映射为已核验右肱骨、桡骨、尺骨的 `ARTICULATING_BONES_PROXY`，对应 `BP9206→FJ3368`、`BP8464→FJ3349`、`BP8233→FJ3391`；代理验证 5/5，资产装饰器回归 6/6。公开“右肘训练”显示三骨引用及“非完整关节模型”，左肘仍无资产，公开读回 2/2
- 成果：[公开运动模型](movement.html)；[右肘代理](../research/movement/common-human-coordinate-elbow-composite-map-v0.3.json)；[验证器](../research/movement/common-human-coordinate-elbow-composite-map-validator-v0.3.mjs)；[公开读回](../research/movement/common-human-coordinate-elbow-public-readback-v0.3.json)；[页面提交 490717b2](https://github.com/foxlongfei/zero-one-workbench/commit/490717b202cd434fd8ab130c0084f73079203202)
- 当前阻塞：M03 BLOCKED_CLEAN_CONTEXT；M04 BLOCKED_BY_M03；左侧资产未映射；三件完整骨模型不能代替软骨、韧带、关节囊、接触面或运动学模型
- 下一步：补左侧上肢资产或专用肘关节结构；所有专用结构必须继续使用 FJ 网格 ID 并保留与三骨代理的类型差异
- 任务状态：M01 完成；M02 为 ACCEPTED_L1_CANDIDATE_ONLY；M03/M04 阻塞；共同人体坐标系 ACTIVE
- 验收状态：严格 `2/4`；right_elbow_proxy_resolvable=true；complete_joint_asset=false；left_side_mapped=false

## 精确断点

- 零一：从二十四山 `SOURCE_BINDING` 继续，目标是冻结明确版本与可定位原文；本轮计算规则、10案例和2条公开读回无需重做。
- 动起来：从左侧资产或专用肘关节结构继续；三骨代理与左右隔离已公开验收。M03 仅在新鲜隔离 D 上下文具备时恢复。
