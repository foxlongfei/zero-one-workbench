# 双项目 CURRENT

最近后台运行：2026-09-28 05:44:59 +08:00  
本周期：两个项目均有有效增量；新增结构化映射、验证器与测试案例，未虚增主线完成度。

## 零一空间研究

- 当前主线：Z04 / `K02-03-HXL-01`（沿用原 ID）
- 当前执行：`TEMP-M01` 夏贺良材料六槽位投影；独立 Q/D 回传仍在主线门禁前
- 并行辅线 / 分工：C 维护来源边界与六槽位映射；Q、D 继续使用相互隔离的盲回传文件；`TEMP-E01`、`TEMP-M01` 保持 ACTIVE
- 最近真实成果变化：新增六槽位投影与验证器，将输入、传播/提议、采用/执行、预期效果、记录响应/检验、反转与处置分开；12/12 检查通过。明确“诈造/託造”只直接归于甘忠可，夏贺良不继承该归因；预期效果不得改写为因果效果；历史司法措辞只保留为来源叙述
- 成果：[六槽位投影](../research/zero-one/temp-m01-hxl-six-slot-projection-v0.1.json)；[验证器](../research/zero-one/temp-m01-hxl-six-slot-projection-validator-v0.1.mjs)；[成果提交 54e39a69](https://github.com/foxlongfei/zero-one-workbench/commit/54e39a692be7e9039acab0c0e171f91722c5f86e)
- 当前阻塞：Q、D 尚未独立回传并冻结；C 已见来源不得替代盲 Q/D，当前投影不得在冻结前馈入 Q/D
- 下一步：取得并冻结两个独立回传后，按六槽位逐项比较；所有冲突保留，不自动修正
- 任务状态：Z04 / `K02-03-HXL-01` 执行中；`TEMP-M01` 有效增量
- 验收状态：严格 `0/5`；Q=false、D=false、cross-review=false；本周期不升计数

## 动起来

- 当前主线：`M01→M02/M03→M04`
- 当前执行：共同人体坐标系的“我要练”自然语言解析；M03 独立 D 仍受干净上下文门禁阻塞
- 并行辅线 / 分工：C 构造上肢别名映射、反例和验证器；D 尚未启动；`TEMP-YOUTH`、`TEMP-CLUB`、`TESTSET` 沿用既有队列
- 最近真实成果变化：新增 4 个上肢目标、专业/口语别名、左右侧解析、训练/拉伸/放松目标与症状优先路由；“胳膊/手臂/练手”强制澄清，疼痛/麻木/受伤进入 `SAFETY_OR_SYMPTOM`。解析器 12/12 检查通过，12 个测试案例全部通过
- 成果：[上肢别名映射](../research/movement/common-human-coordinate-upper-limb-alias-map-v0.1.json)；[测试案例](../research/movement/common-human-coordinate-upper-limb-alias-cases-v0.1.json)；[解析器](../research/movement/common-human-coordinate-upper-limb-resolver-v0.1.mjs)；[成果提交 54e39a69](https://github.com/foxlongfei/zero-one-workbench/commit/54e39a692be7e9039acab0c0e171f91722c5f86e)
- 当前阻塞：M03 需要独立干净 D 上下文；M04 依赖 M03；本轮映射尚未接入在线页面，公开读回=false
- 下一步：将解析器接入页面输入流，做公开页面读回；M03 仅由新鲜隔离 D 上下文继续
- 任务状态：M01 完成；M02 已按 L1 候选级程序验收；M03 阻塞；M04 阻塞；共同人体坐标系执行中
- 验收状态：严格 `2/4`；本周期仅形成可测试输入层，不把页面接入或 M03 计为完成

## 精确断点

- 零一：从两个独立盲回传的冻结结果继续；冻结后将各自陈述映射到 S1–S6，与当前 C 投影比较，任何冲突保留为 `HOLD_CONFLICT`。
- 动起来：从页面输入流接入别名解析器继续；先验证歧义澄清、症状优先与左右侧不借用，再做在线读回。M03 继续等待独立干净 D 上下文。
