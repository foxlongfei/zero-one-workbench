# 双项目当前状态

更新时间：2026-09-27 22:50（UTC+08:00）

> Drive 为权威研究记录；本页是公开 CURRENT 镜像。发布任务、刷新时间或同步动作不计研究完成。

## 零一空间研究

- 已关闭主线：Z01—Z04 — **4/4 COMPLETED**
- 当前主线：**K02-03｜术数/方技案例的可验证性与失效机制｜ACTIVE｜严格0/5**
- 当前执行：沿用 **K02-03-HXL-01**。C 在 NDL 774615 画布 18 左页直接定位“初成帝時齊人甘忠可託造天官歷包元太平經十二卷”；没有新建替代任务 ID。
- 纠错：旧 v0.1 所记“卷七十五 canvas 2—13”被画布直接证伪。画布 14—19 仍属卷七十五；画布 20 右页结束卷七十五、左页开始卷七十六。v0.2 明确保留并取代旧边界结论。
- 分工：C=非盲页锚与卷界纠错已完成；Q/D=必须使用画布 18 独立逐字复核页侧与栏位；NLC 382411 卷十一页锚仍待定位。本轮 C 结果不得替代独立验收。
- 最近真实成果：2026-09-27 22:47；新增 NDL 精确页锚、画布 18 图像 SHA-256 与卷界纠错，验证器 **12/12** 通过。
- 成果：[NDL页锚v0.2](../research/zero-one/k02-03-hxl-ndl-page-anchor-v0.2.json) · [页锚验证器](../research/zero-one/k02-03-hxl-ndl-page-anchor-validator-v0.2.mjs) · [NDL记录](https://dl.ndl.go.jp/pid/774615)
- 提交：[页锚 a015c44c](https://github.com/foxlongfei/zero-one-workbench/commit/a015c44c6f7b5bde71a97d2d8b7662c88b022134) · [验证器 3dcd2a33](https://github.com/foxlongfei/zero-one-workbench/commit/3dcd2a335ccdb062e197e05b784720e3e503c5c8)
- 并行辅线：TEMP-E01/TEMP-M01 保持 ACTIVE；不得把页锚纠错计入辅线完成。
- 验收状态：**C_NON_BLIND_ANCHOR_FOUND；Q=false；D=false；NLC=false；严格仍0/5**。
- 当前阻塞：缺 Q/D 独立盲复核与 NLC 页锚，不是缺 C 候选。
- 下一步：把画布 18 封装为不暴露 C 结论的 Q/D 包，独立回传逐字、页侧、栏位；随后定位 NLC 卷十一页锚，全部通过后才计 1/5。

## 动起来

- 当前主线：**M01→M02/M03→M04｜严格完成1/4**
- 任务状态：M01=COMPLETED；M02=PAUSED_PENDING_C_ACCEPTANCE；M03=BLOCKED_CLEAN_CONTEXT；M04=BLOCKED_BY_M02_M03。
- 当前执行：从 BodyParts3D 官方 142,903,898 字节归档按 FMA→BP→FJ 映射提取 5 个真实 OBJ：右肱骨、右桡骨、右尺骨、右肱二头肌长头和短头。
- 分工：C=官方源、CC BY 4.0、映射与字节提取；Q=既有 M02 交卷继续封存；D=不在受污染上下文伪造 M03 盲审；集成/显示读回=尚未执行。
- 最近真实成果：2026-09-27 22:47；获得 **5 个 OBJ / 620,332 字节 / 5,913 顶点 / 8,572 面**，逐件记录 SHA-256；清单验证器 **12/12** 通过。
- 成果：[OBJ字节清单](../research/movement/bodyparts3d-upper-limb-obj-byte-manifest-v0.1.json) · [字节清单验证器](../research/movement/bodyparts3d-upper-limb-obj-byte-manifest-validator-v0.1.mjs) · [既有资产映射](../research/movement/bodyparts3d-upper-limb-asset-map-v0.1.json)
- 提交：[字节清单 51877409](https://github.com/foxlongfei/zero-one-workbench/commit/51877409467fdb5e105d942d8315377519cb041b) · [验证器 31cffbe3](https://github.com/foxlongfei/zero-one-workbench/commit/31cffbe35f755cbf33d507a07120d7ad8b22699f)
- 在线样板：[动起来项目页 V0.6](https://foxlongfei.github.io/zero-one-workbench/portal/movement.html)；当前页仍是教学几何体，不得标为 BodyParts3D 真实资产接入完成。
- 并行队列：共同人体坐标系、TEMP-YOUTH、TEMP-CLUB、TESTSET 沿既有队列排队；TEMP-CLUB 仍待独立 C 交叉认证四反例。
- 验收状态：**SOURCE_VERIFIED=true；LICENSE_VERIFIED=true；BYTE_EXTRACTION_VERIFIED=true；INTEGRATION_VERIFIED=false；DISPLAY_VERIFIED=false**。
- 当前阻塞：M03 缺未接触 Q 摘要的干净 D；真实 OBJ 尚未进入受控前端资产、未绑定场景、未公开读回。
- 下一步：把 5 个 FJ OBJ 置入受控项目资产并绑定 V0.6 场景，取得集成和显示证据后再改变 M02/M03/M04 验收；M03 干净上下文门禁不变。

## 精确断点

- 零一：K02-03-HXL-01 停在“NDL 774615 画布 18 C 锚点已找到、画布 20 完成 75→76 卷过渡纠错”；下一动作是 Q/D 独立复核及 NLC 页锚，完成前严格 0/5。
- 动起来：官方 OBJ 5 件已提取并校验，停在“真实字节已得、尚未集成/显示”；下一动作是受控资产落位、V0.6 场景绑定和公开读回，严格仍 1/4。
- [Drive双项目动态执行看板](https://docs.google.com/document/d/16xSk77EHM3D_v2gdEenKs5q8ZXHF7gpWkc_r9a6dn8I/edit)
- [公开动作库](./exercise-library.html)
