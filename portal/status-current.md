# 双项目 CURRENT

最近后台运行：2026-09-28 07:38:05 +08:00  
本周期：两个项目均有有效增量；新增可执行冻结槽位投影器与 BP→FJ 双命名空间交叉表，验证分别 5/5、7/7；未虚增主线完成度。

## 零一空间研究

- 当前主线：`Z05` 古代技术可运行重建（已由最新权威提交提升为 MAIN）
- 当前执行：`Z05-A/Z05-B` 方法卡与真实输入运行样板的起步；本周期先闭合刚开始的 `TEMP-M01` 投影器代码增量，随后按新主线切换
- 并行辅线 / 分工：C 维护方法运行结构；`Z04/K02-03-HXL-01`、`TEMP-E01`、`TEMP-M01` 均转 `PAUSED_SUPPORT`，仅按 Z05 的运行缺口唤醒；Q/D 既有盲回传门禁继续保留
- 最近真实成果变化：把上一周期适配合同落成可执行投影器；8 个纯合成案例覆盖未 READY、单回传、同角色、C 字段泄漏、规范化一致、位置冲突、文本冲突与不确定字。程序逐字保留原片段，只输出并列规范化字段；本地验证 5/5
- 成果：[投影器](../research/zero-one/temp-m01-hxl-frozen-return-slot-projector-v0.1.mjs)；[8 个合成案例](../research/zero-one/temp-m01-hxl-frozen-return-slot-projector-cases-v0.1.json)；[成果提交 704894c0](https://github.com/foxlongfei/zero-one-workbench/commit/704894c05b1f1a30b460f256b2c11ca7f54a0c5a)
- 当前阻塞：Q、D 尚未独立回传并冻结；C 已见来源不得替代盲 Q/D；合成案例不算研究回传
- 下一步：按 Z05 验收门为 A/B 各选择一个来源和时期明确的方法，先建立 `PRACTICE_CONTEXT + INPUT_SCHEMA + PROCEDURE + OUTPUT_SCHEMA`；旧 Q/D 投影器只在 Z05 触发材料复核时运行
- 任务状态：`Z05` ACTIVE；`Z04/K02-03-HXL-01`、`TEMP-M01`、`TEMP-E01` PAUSED_SUPPORT；本周期的 TEMP-M01 代码成果保留但不继续为工具而工具
- 验收状态：Z05 尚无端到端运行样板；旧 Z04 严格 `0/5`，不升计数

## 动起来

- 当前主线：`M01→M02/M03→M04`
- 当前执行：共同人体坐标系的上肢资产身份解析；M03 独立 D 仍受干净上下文门禁阻塞
- 并行辅线 / 分工：C 审计 BodyParts3D 身份链；D 尚未启动；`TEMP-YOUTH`、`TEMP-CLUB`、`TESTSET` 沿用既有队列；公开 V0.8 四类输入回归保持基线
- 最近真实成果变化：明确 BP* 是表示/部件编号，FJ* 是实际 OBJ 网格元素编号；建立 5 条 FMA→BP→FJ→OBJ 交叉表，加入未知 BP 反例。验证器逐条与既有官方字节清单对照，7/7 通过，并禁止任何查看器请求 `BP*.obj`
- 成果：[BP→FJ 交叉表](../research/movement/bodyparts3d-upper-limb-id-crosswalk-v0.1.json)；[验证器](../research/movement/bodyparts3d-upper-limb-id-crosswalk-validator-v0.1.mjs)；[6 个案例](../research/movement/bodyparts3d-upper-limb-id-crosswalk-cases-v0.1.json)；[成果提交 704894c0](https://github.com/foxlongfei/zero-one-workbench/commit/704894c05b1f1a30b460f256b2c11ca7f54a0c5a)
- 当前阻塞：M03 需要独立干净 D 上下文；M04 依赖 M03；左侧真实资产及肘关节资产尚未映射；当前云端浏览器 WebGL 不可用但静态 OBJ 降级图可见
- 下一步：让输入解析器返回命名空间明确的资产引用对象，并在公开页读回 BP/FJ 双 ID；随后补左侧与肘关节资产映射
- 任务状态：M01 完成；M02 已按 L1 候选级程序验收；M03 阻塞；M04 阻塞；共同人体坐标系执行中
- 验收状态：严格 `2/4`；crosswalk_verified=true；不把身份交叉表计作 M03/M04 完成

## 精确断点

- 零一：下一周期直接从 Z05 方法选择与四个最小运行字段开始；Z04/TEMP-M01 精确断点保留为“取得两个独立冻结回传→既有交叉复核 READY→投影器运行”，只按 Z05 缺口唤醒。
- 动起来：从解析器的 BP/FJ 双命名空间返回对象继续；交叉表已验证 5 个右侧资产。保留 V0.8 四类公开交互为回归基线；M03 只由新鲜隔离 D 上下文继续。
