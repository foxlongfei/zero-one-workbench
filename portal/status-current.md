# 双项目当前状态

更新时间：2026-09-27 14:38（UTC+08:00）

> Drive 为权威研究记录；本页是公开状态镜像。完成度只按实际验收物计算，不以时间戳或同步动作计数。

## 零一空间研究

- 当前主线：Z01—Z04 — **4/4，COMPLETED**；本轮纠正上一版错误的“Z04 3/4”
- 当前执行：TEMP-E01 / TEMP-M01 独立辅线；95T1J1:4 字形相对位置图
- 并行分工：C=来源叙述与区域对齐；Q=渲染图位置拓扑观察；D=证据等级、异读与原始字节边界审计
- 最近一次后台运行/真实成果变化：2026-09-27 14:38；形成4区结构化位置图，明确区分来源转录与视觉拓扑观察
- 真实增量：记录 FRONT_UPPER_MAIN、FRONT_LOWER_MAIN、FRONT_UPPER_OUTER、REVERSE_TRACES；保留“一一六六一五”“六八八八六六”及“九≠/九七七”未决异读
- 验收状态：SECONDARY_POSITION_MAP_COMPLETE_PRIMARY_BYTES_PENDING；该待核项属于独立辅线，不重新打开已关闭的Z04
- 当前阻塞：文章图片原始字节和《华夏考古》1997(2)第34–35页仍未取得；网页渲染证据不冒充原始字节
- 下一步：取得原始图版或权威图版后，补 byte_length/SHA-256/解码尺寸并交叉认证区域映射
- 成果：[95T1J1:4字形位置图](../research/zero-one/95T1J1-4-glyph-position-map-v0.1.json)
- 提交：[33e3b8ea](https://github.com/foxlongfei/zero-one-workbench/commit/33e3b8eaeebad8893d74882df44e144284fc2826)

## 动起来

- 当前主线：M01→M02/M03→M04 — **M01已完成；M02/Q已交卷待C；M03/D未闭环；M04受依赖阻塞**
- 当前执行：M03/D 因本次执行上下文已读到Q摘要而失去干净盲审资格；按既有队列切换至 TEMP-YOUTH
- 并行分工：Q=既有M02交卷保持封存；D=本周期不伪造盲审；C=TEMP-YOUTH字段与来源映射待独立交叉认证
- 最近一次后台运行/真实成果变化：2026-09-27 14:38；完成TEMP-YOUTH V0.1字段表、门禁验证器与4个正反例
- 真实增量：结构化WHO 5–17岁健康基线与NSCA发展适宜训练门禁；明确“年龄分组≠能力分级”，年龄不能单独决定动作、负荷或进阶
- 测试验收：4/4案例符合预期（有效1、拒绝3、期望偏差0）
- 当前阻塞：M03需要未接触Q结果的独立执行上下文；C认证及M04正式RESULTS仍缺。首个完整肱二头肌→肘→前臂样本仍≈0，不把Schema计作样本进度
- 下一步：独立上下文执行M03/D；C交叉认证TEMP-YOUTH来源映射；随后把同一门禁复用于TEMP-CLUB，且不混并年龄段与能力层级
- 成果：[TEMP-YOUTH字段表](../research/movement/temp-youth-field-table-v0.1.json) · [门禁验证器](../research/movement/temp-youth-gate-validator-v0.1.mjs) · [正反例](../research/movement/temp-youth-gate-cases-v0.1.json)
- 提交：[字段表 1507efab](https://github.com/foxlongfei/zero-one-workbench/commit/1507efaba2ec32a7b76e99d72532a180440e6eed) · [案例 7612869c](https://github.com/foxlongfei/zero-one-workbench/commit/7612869c2f3fb7244e5cba49ac857eb6c6631842) · [验证器 1b881aa5](https://github.com/foxlongfei/zero-one-workbench/commit/1b881aa5aa384d40639f3fac117f1d6e220c09a1)

## 本周期验收与断点

- 两项目均产生可观察结构化成果并通过本地读回；未用时间戳或同步动作虚增完成度。
- 精确断点（零一）：原始图片/权威图版到位后再做字节级与字形级交叉认证；Z04保持4/4 CLOSED。
- 精确断点（动起来）：M03只在未读Q摘要的独立上下文启动；否则继续TEMP-YOUTH→TEMP-CLUB或共同人体坐标系既有辅线。
- [Drive双项目动态执行看板](https://docs.google.com/document/d/16xSk77EHM3D_v2gdEenKs5q8ZXHF7gpWkc_r9a6dn8I/edit)
- [公开动作库](./exercise-library.html)
