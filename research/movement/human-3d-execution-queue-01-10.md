# HUMAN-3D 连续执行队列 01—10｜状态校正

更新时间：2026-09-28 11:48 UTC+08:00

> 本表按“真实执行状态”校正，不因旧编号顺序强制串行。完整样板/WYSIWYG优先；已有实物必须反映到状态。主线 M01→M02/M03→M04 与本 HUMAN-3D 产品辅线分开计数。

| ID | 任务 | 当前真实状态 | 已有可查实物 / 尚缺完成门 |
|---|---|---|---|
| HUMAN-3D-01 | 全身开放资产清单冻结 | ACTIVE | 已有 BodyParts3D 来源/许可 registry；仍需官方主来源许可最终复核后才能冻结 |
| HUMAN-3D-02 | 真实3D资产本地化最小闭环 | ACTIVE | 右上肢5件真实OBJ已进入受控发布链并有静态降级展示；WebGL交互仍未闭环 |
| HUMAN-3D-03 | 统一人体结构ID/别名桥 | ACTIVE | 已有上肢别名解析、FMA→BP→FJ→OBJ交叉表；右肘点击与自然语言已命中同一 JOINT_ELBOW+RIGHT；全身尚未完成 |
| HUMAN-3D-04 | 全身图层控制器 | PLANNED | 尚无全身真实资产显隐/隔离/搜索闭环 |
| HUMAN-3D-05 | 上肢骨骼—关节真实3D样板 | ACTIVE | 右肱骨/桡骨/尺骨三骨代理可查；明确不是完整肘关节，左侧/专用关节结构未完成 |
| HUMAN-3D-06 | 上肢肌肉/肌腱关系样板 | ACTIVE_PARTIAL | 右肱二头肌长/短头真实资产与双ID已接；肌腱及肌肉→骨/关节完整关系未闭环 |
| HUMAN-3D-07 | 神经/血管跨系统关系 | PLANNED | 未进入可见样板 |
| HUMAN-3D-08 | 动作驱动3D | ACTIVE_PARTIAL | 教学动态模型/关节参数已有；尚未证明真实BodyParts3D网格被动作驱动 |
| HUMAN-3D-09 | 五官/器官认识入口 | PLANNED | 未进入可见样板 |
| HUMAN-3D-10 | 完整样板总验收与公开展示 | PENDING | 已有公开 movement.html；SOURCE+LICENSE+INTEGRATION+DISPLAY 尚未全PASS |

## 当前执行断点
1. 扩更多人体点击入口，与自然语言解析绑定到同一 canonical structure ID。
2. 补左侧真实资产或专用肘关节结构；不得借用右侧资产冒充。
3. M03 的独立D干净上下文门禁属于正式主线阻塞，不阻止本产品辅线继续产生可见成果。

## 状态解释
- ACTIVE：已经有真实实物并仍在执行。
- ACTIVE_PARTIAL：已有部分可展示能力，但距离该任务完成门仍明显不足。
- PLANNED：尚无足以改变用户可见能力的实物。
- PENDING：总验收未满足。
