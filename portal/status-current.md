# 双项目 CURRENT

最近后台运行：2026-09-28 08:35:00 +08:00  
本周期：两个项目均有可观察增量并已在线读回；零一新增 Z05 普通问题路由，动起来新增右侧结构的 BP→FJ 双 ID 回传。主线完成度保持严格口径。

## 零一空间研究

- 当前主线：`Z05` 古代技术可运行重建
- 当前执行：普通语言问题 → 可能领域 → 候选方法/所需输入的公开路由；具体方法运行仍未完成
- 并行辅线 / 分工：C 负责 5 路由与公开页；Q/D 保留盲回传门禁；`Z04/K02-03-HXL-01`、`TEMP-E01`、`TEMP-M01` 均为 `PAUSED_SUPPORT`，只按 Z05 证据缺口唤醒
- 最近真实成果变化：新增 5 个领域路由、10 个结构化案例与无结论边界；验证器 6/6，案例 10/10。公开页实测“宅地/地形/水系”正确落到堪舆并列出 5 类输入；模糊问句正确要求澄清，公开读回 2/2
- 成果：[公开实验台](k02-board.html)；[路由模型](../research/zero-one/z05-question-router-v0.1.json)；[验证器](../research/zero-one/z05-question-router-v0.1.mjs)；[公开读回证据](../research/zero-one/z05-question-router-public-readback-v0.1.json)；[页面与代码提交 2ce5d332](https://github.com/foxlongfei/zero-one-workbench/commit/2ce5d332465df7a645fa37dd43f78e0689157b94)；[读回证据提交 bc006be0](https://github.com/foxlongfei/zero-one-workbench/commit/bc006be03ed6be4c187ee9d677990125a1ca4409)
- 当前阻塞：尚未选择并核验一套来源、时期与程序明确的方法；路由不是结果，不能虚称端到端运行
- 下一步：为一个已路由问题选择一套明确历史方法，固定 `PRACTICE_CONTEXT + INPUT_SCHEMA + PROCEDURE + OUTPUT_SCHEMA`，跑出第一条可复核执行轨迹
- 任务状态：`Z05` ACTIVE；旧 Z04/K02 与 TEMP 两线 PAUSED_SUPPORT
- 验收状态：public_routing_increment=true；Z05 V0.1 未闭环；旧 Z04 严格 `0/5`

## 动起来

- 当前主线：`M01→M02/M03→M04`
- 当前执行：共同人体坐标系的自然语言解析结果 → 标准结构 ID → BP 表示记录 → FJ OBJ 网格元素
- 并行辅线 / 分工：C 完成右侧 4 类 canonical target 装饰器与公开页；D 尚未获得干净独立上下文；`TEMP-YOUTH`、`TEMP-CLUB`、`TESTSET` 保持既有队列
- 最近真实成果变化：新增资产引用装饰器与 6 个案例，验证 6/6；公开输入“右二头训练”同时返回 `MUSCLE_BICEPS_BRACHII`、`BP5558→FJ1512`、`BP5566→FJ1478`；“左肱二头肌”仅返回同一结构 ID 并显示资产待映射，不借用右侧资产，公开读回 2/2
- 成果：[公开运动模型](movement.html)；[资产引用装饰器](../research/movement/common-human-coordinate-asset-reference-decorator-v0.2.mjs)；[6 个案例](../research/movement/common-human-coordinate-asset-reference-cases-v0.2.json)；[公开读回证据](../research/movement/common-human-coordinate-dual-id-public-readback-v0.2.json)；[页面与代码提交 2ce5d332](https://github.com/foxlongfei/zero-one-workbench/commit/2ce5d332465df7a645fa37dd43f78e0689157b94)；[读回证据提交 bb92a6a0](https://github.com/foxlongfei/zero-one-workbench/commit/bb92a6a01b40de4eb7a583647443ae59dbdac393)
- 当前阻塞：M03 需要未读取 Q 结果的独立干净 D 上下文；M04 依赖 M03；左侧真实资产及真实肘关节资产尚未映射；云端浏览器 WebGL 不可用但静态/文字降级链可验收
- 下一步：补左侧与肘关节资产映射，并把更多点击入口与自然语言输入绑定到同一结构 ID；M03 只由新鲜隔离 D 上下文继续
- 任务状态：M01 完成；M02 为 ACCEPTED_L1_CANDIDATE_ONLY；M03 BLOCKED_CLEAN_CONTEXT；M04 BLOCKED_BY_M03；共同人体坐标系 ACTIVE
- 验收状态：严格 `2/4`；dual_id_public_readback=true；不把坐标系增量计作 M03/M04 完成

## 精确断点

- 零一：从 `ROUTE_KANYU` 或 `ROUTE_BIRTH_TIME` 选定一套明确历史方法，先写四字段运行合同并用一条完整输入做执行轨迹；路由模型、10 案例和 2 条公开读回已完成，无需重做。
- 动起来：从左侧或真实肘关节资产补图继续；右二头双 ID 与左侧隔离已公开验收，无需重做。M03 仅在新鲜隔离 D 上下文具备时恢复。
