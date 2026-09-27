# 双项目 CURRENT

最近后台运行：2026-09-28 06:46:22 +08:00  
本周期：两个项目均有有效增量；新增冻结回传适配门、公开页面代码、交互读回与测试证据，未虚增主线完成度。

## 零一空间研究

- 当前主线：Z04 / `K02-03-HXL-01`（沿用原 ID）
- 当前执行：`TEMP-M01` 冻结回传→六槽位复核适配门；独立 Q/D 回传仍在主线门禁前
- 并行辅线 / 分工：C 只维护无答案适配合同；Q、D 继续使用相互隔离的盲回传文件；`TEMP-E01`、`TEMP-M01` 保持 ACTIVE
- 最近真实成果变化：新增冻结回传六槽位适配合同、8 个正反例与验证器，11/11 通过。适配器必须等待 Q/D 双冻结及 `READY_FOR_CROSS_REVIEW`，保留逐字原文；位置、文本、范围缺口和不确定字均进入 HOLD，C 不得修复回传
- 成果：[适配合同](../research/zero-one/temp-m01-hxl-frozen-return-slot-adapter-v0.1.json)；[8 个案例](../research/zero-one/temp-m01-hxl-frozen-return-slot-adapter-cases-v0.1.json)；[验证器](../research/zero-one/temp-m01-hxl-frozen-return-slot-adapter-validator-v0.1.mjs)；[成果提交 bb2a5891](https://github.com/foxlongfei/zero-one-workbench/commit/bb2a5891240df9aabc09fe74da5a7da28fe1cf4d)
- 当前阻塞：Q、D 尚未独立回传并冻结；C 已见来源不得替代盲 Q/D，当前投影不得在冻结前馈入 Q/D
- 下一步：取得两个冻结回传并先通过交叉复核门，再分别生成不可变槽位投影；最后与 C 投影比较，所有冲突保留
- 任务状态：Z04 / `K02-03-HXL-01` 执行中；`TEMP-M01` 有效增量
- 验收状态：严格 `0/5`；Q=false、D=false、cross-review=false；本周期不升计数

## 动起来

- 当前主线：`M01→M02/M03→M04`
- 当前执行：共同人体坐标系 V0.8“我要练”输入层公开接入与读回；M03 独立 D 仍受干净上下文门禁阻塞
- 并行辅线 / 分工：C 完成页面接入与交互回归；D 尚未启动；`TEMP-YOUTH`、`TEMP-CLUB`、`TESTSET` 沿用既有队列
- 最近真实成果变化：公开页升级至 V0.8，删除“胳膊→肱二头肌”错误默认；实页输入“胳膊、二头疼、左肱二头肌、右小臂放松”四类交互均符合预期，4/4 通过。歧义、症状、左侧资产待映射、右侧前臂放松均在公开页面可观察
- 成果：[公开 V0.8](https://foxlongfei.github.io/zero-one-workbench/portal/movement.html)；[公开读回回执](../research/movement/common-human-coordinate-page-integration-readback-v0.1.json)；[页面提交 bb2a5891](https://github.com/foxlongfei/zero-one-workbench/commit/bb2a5891240df9aabc09fe74da5a7da28fe1cf4d)；[读回提交 257bf621](https://github.com/foxlongfei/zero-one-workbench/commit/257bf62178f07adc72d73e5f3364d06cf5b24d21)
- 当前阻塞：M03 需要独立干净 D 上下文；M04 依赖 M03；左侧真实资产及肘关节资产尚未映射；当前云端浏览器 WebGL 不可用但静态 OBJ 降级图可见
- 下一步：补左侧与肘关节资产映射；扩展页面级回归案例。M03 仅由新鲜隔离 D 上下文继续
- 任务状态：M01 完成；M02 已按 L1 候选级程序验收；M03 阻塞；M04 阻塞；共同人体坐标系执行中
- 验收状态：严格 `2/4`；page_integration=true、public_readback=true；不把输入层接入计作 M03/M04 完成

## 精确断点

- 零一：从两个独立盲回传的冻结结果继续；先运行既有交叉复核门，READY 后再用新适配器生成两份不可变 S1–S6 投影。
- 动起来：从左侧与肘关节资产映射继续；保留 V0.8 四类公开交互为回归基线。M03 继续等待独立干净 D 上下文。
