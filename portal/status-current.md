# 双项目 CURRENT

最近后台运行：2026-09-28 10:38:18 +08:00  
本周期：两个项目均有可观察增量并完成本地验证。零一把二十四山顺序绑定到可核对的电子转录定位，并登记稳定影印候选但不虚报页码；动起来把人体右肘点击与“右肘训练”自然语言入口统一到同一结构、侧别和资产结果。严格完成度未虚增。

## 零一空间研究

- 当前主线：`Z05` 古代技术可运行重建
- 当前执行：`Z05-B / SOURCE_BINDING`；二十四山圆周顺序已绑定电子转录定位，稳定影印候选已登记，精确影印页仍开放
- 并行辅线 / 分工：C 负责来源绑定、验证器与公开边界；Q/D 尚未承担影印页复核；`Z04/K02-03-HXL-01`、`TEMP-E01`、`TEMP-M01` 保持 `PAUSED_SUPPORT`
- 最近真实成果变化：新增来源绑定 V0.2，把《天玉經》电子转录的二十四山顺序与运行器24标签逐项对齐；登记《欽定協紀辨方書·卷一》四库影印（Internet Archive 标识 `06056502.cn`、237页）作为稳定图像候选；验证 7/7。公开页明确区分“文本定位”“待定位影印页”和“15°等分/真北0°顺时针工程标准化”
- 成果：[公开实验台](k02-board.html)；[来源绑定](../research/zero-one/z05-b-24-mountain-source-binding-v0.2.json)；[来源验证器](../research/zero-one/z05-b-24-mountain-source-binding-validator-v0.2.mjs)；[运行合同](../research/zero-one/z05-b-24-mountain-orientation-normalizer-v0.1.json)；[来源绑定提交 1f04792c](https://github.com/foxlongfei/zero-one-workbench/commit/1f04792c54b502b7d12b285987f2c0565074a9c8)
- 当前阻塞：尚未在稳定影印中定位对应叶/栏；电子转录定位不等于版本/页码核验，且不能证明15°等分或真北0°顺时针约定
- 下一步：在影印/OCR中检索“二十四山”及完整次序，记录叶/栏/图像页；未完成前保持 `historical_source_verified=false`
- 任务状态：`Z05` ACTIVE；旧 Z04/K02 与 TEMP 两线 PAUSED_SUPPORT
- 验收状态：source_binding_state=`TEXT_LOCATOR_BOUND_SCAN_PAGE_OPEN`；validator=7/7；historical_source_verified=false；complete_kanyu_method=false；旧 Z04 严格 `0/5`

## 动起来

- 当前主线：`M01→M02/M03→M04`
- 当前执行：共同人体坐标系 `COMMON-HUMAN-COORDINATE` 的点击/自然语言等价路由；M03 仍受干净上下文门禁阻塞
- 并行辅线 / 分工：C 负责交互合同、页面接线和读回；D 未启动；`TEMP-YOUTH`、`TEMP-CLUB`、`TESTSET` 保持既有队列
- 最近真实成果变化：新增 V0.4 等价合同与验证器 5/5；人体右肘热点带显式 `data-side=RIGHT`，点击后与输入“右肘训练”统一返回 `JOINT_ELBOW + RIGHT + BP9206→FJ3368 / BP8464→FJ3349 / BP8233→FJ3391`，同时保留“三骨关节代理（非完整关节模型）”
- 成果：[公开运动模型](movement.html)；[等价合同](../research/movement/common-human-coordinate-click-nl-equivalence-v0.4.json)；[等价验证器](../research/movement/common-human-coordinate-click-nl-equivalence-validator-v0.4.mjs)；[右肘代理](../research/movement/common-human-coordinate-elbow-composite-map-v0.3.json)；[合同提交 7acd5130](https://github.com/foxlongfei/zero-one-workbench/commit/7acd51309acc1e009f100ee75231b939c0fc9782)
- 当前阻塞：M03 BLOCKED_CLEAN_CONTEXT；M04 BLOCKED_BY_M03；左侧资产未映射；三骨代理不能代替完整关节
- 下一步：把显式侧别点击扩到更多右侧结构，再补左侧资产或专用肘关节结构；保持代理/完整资产类型边界
- 任务状态：M01 完成；M02 为 ACCEPTED_L1_CANDIDATE_ONLY；M03/M04 阻塞；共同人体坐标系 ACTIVE
- 验收状态：严格 `2/4`；input_equivalence_contract=5/5；complete_joint_asset=false；left_side_mapped=false

## 精确断点

- 零一：从 `SOURCE_BINDING` 的“稳定影印精确页/叶/栏定位”继续；已有电子转录顺序与7项验证无需重做。
- 动起来：从“更多右侧点击入口/左侧资产”继续；右肘点击和自然语言已统一到同一结果。M03 仅在新鲜隔离 D 上下文具备时恢复。
