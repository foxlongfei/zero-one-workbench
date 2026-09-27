# 双项目当前状态

更新时间：2026-09-27 18:50（UTC+08:00）

> Drive 为权威研究记录；本页是公开 CURRENT 镜像。发布任务、刷新时间或同步动作不计研究完成。

## 零一空间研究

- 已关闭主线：Z01—Z04 — **4/4 COMPLETED**
- 当前主线：**K02-03｜术数/方技案例的可验证性与失效机制｜ACTIVE｜0/5**
- 当前执行：K02-03-HXL-01继续沿用；C已由NDL IIIF manifest和卷首/卷尾图像锁定《汉书》卷七十五为canvas 2—13，精确目标段仍只记候选canvas 12—13
- 分工：C=非盲IIIF卷界定位与证据固化；Q/D=仍需独立逐字定位甘忠可—夏賀良段、复核归责范围，并定位NLC 382411卷十一页锚；本轮结果不得替代独立验收
- 最近真实成果：2026-09-27 18:34；新增NDL卷界结构化证据与7项验证器，7/7通过；候选页未被冒充为精确页
- 关键修正：“诈造”在原文中直接归于甘忠可，不得静默转嫁给夏賀良；后续“反道惑众/诬罔主上”保留为叙事及司法指控。卷十一与卷七十五共同定位六月采纳、八月撤销及“卒亡/無嘉應”
- 验收状态：NDL_VOLUME_CANVAS_BOUNDARY_VERIFIED_EXACT_PASSAGE_PENDING；卷界已核，精确段落与NLC页锚未闭环，严格保持0/5
- 成果：[NDL卷界证据](../research/zero-one/k02-03-hxl-ndl-canvas-boundary-v0.1.json) · [卷界验证器](../research/zero-one/k02-03-hxl-ndl-canvas-boundary-validator-v0.1.mjs) · [稳定影印见证登记](../research/zero-one/k02-03-hxl-stable-witness-registry-v0.1.json)
- 提交：[卷界证据 664ab7c0](https://github.com/foxlongfei/zero-one-workbench/commit/664ab7c0c91c5b9b44d104c9b455b54a6669d02a) · [验证器 c8e27fa4](https://github.com/foxlongfei/zero-one-workbench/commit/c8e27fa467a7f88d2d27aaaf09a4113b456beb03)
- 并行辅线：TEMP-E01/TEMP-M01保持独立ACTIVE，原始图版/字节仍阻塞；TEMP-MODEL-01保持ACTIVE，下一动作是拆分先天/后天八卦图层
- 下一步：下载canvas 12/13完整无截断图像，逐栏定位目标段；Q/D独立复核后再定位NLC 382411卷十一页锚，通过后才计1/5，随后沿用K02-03-ID进入少翁

## 动起来

- 当前主线：M01→M02/M03→M04 — **严格完成1/4**
- 状态：M01=COMPLETED；M02=PAUSED_PENDING_C_ACCEPTANCE；M03=BLOCKED_CLEAN_CONTEXT；M04=BLOCKED_BY_M03_AND_C_ACCEPTANCE
- 当前执行：主线M03/D仍受干净上下文门禁阻塞；既有项目页已推进V0.6上肢动作联动，本轮把官方BodyParts3D右侧肱骨/桡骨/尺骨与肱二头肌长短头5个真实资产ID固化为接入清单
- 分工：C=官方资产ID、归档与许可证核验；Q=既有M02交卷继续封存；D=不在受污染上下文伪造主线盲审；公开读回=待真实OBJ接入后执行
- 最近真实成果：2026-09-27 18:50；V0.6已有肘屈、前臂旋后、连续弯举、肌肉层显隐与教学形变；新增官方资产映射11/11通过，来源与CC BY 4.0门禁通过；真实OBJ仍未下载、未接入、未公开读回
- 关键修正：年龄段、练习水平、准备度、师资、竞赛层级必须分轴；俱乐部标签不等于个人能力，精英队选材规则不得直接迁移为社区俱乐部入门规则
- 验收状态：V0.6教学动作联动=UPPER_LIMB_ACTION_LINKAGE_PASS；真实资产=SOURCE_VERIFIED+LICENSE_VERIFIED，INTEGRATION_VERIFIED与DISPLAY_VERIFIED仍为false。TEMP-CLUB仍待独立C交叉认证
- 成果：[BodyParts3D上肢资产映射](../research/movement/bodyparts3d-upper-limb-asset-map-v0.1.json) · [资产映射验证器](../research/movement/bodyparts3d-upper-limb-asset-map-validator-v0.1.mjs) · [V0.2公开样板读回](../research/movement/biceps-standard-sample-public-readback-v0.2.json)
- 提交：[资产映射 276c08eb](https://github.com/foxlongfei/zero-one-workbench/commit/276c08eb93a4f217a3c76bc6fde020c4908e0354) · [验证器 d7cb41a2](https://github.com/foxlongfei/zero-one-workbench/commit/d7cb41a24cce921ef628294adf824b7b84d8fc8c) · [V0.6动作联动 fe021233](https://github.com/foxlongfei/zero-one-workbench/commit/fe021233)
- 标准样板：[直接打开既有动起来项目页](https://foxlongfei.github.io/zero-one-workbench/portal/movement.html)；当前教学几何体不是BodyParts3D真实网格，不得对外标为资产接入完成
- 开放底层采用：OpenSim=肌骨/力学核心；OpenCap=运动学管线；BodyParts3D上肢子集=首个3D原型；Z-Anatomy因ShareAlike许可耦合暂缓直接嵌入
- 边界：本轮辅线成果不计M02—M04完成；首个“肱二头肌→肘→前臂”完整样本仍约为0
- 下一步：从官方136 MiB OBJ归档提取BP9206/BP8464/BP8233/BP5558/BP5566并逐件记录SHA-256，再接入V0.6并公开读回；M03继续等待未接触Q摘要的独立D，TEMP-CLUB继续等待独立C认证四反例

## 精确断点

- 零一：K02-03-HXL-01 已锁定NDL 774615卷七十五canvas 2—13；下一步逐栏确定候选12/13中的精确目标段并独立回放，再定位NLC 382411卷十一页锚；通过前保持0/5，不另起ID。
- 动起来：V0.6上肢动作联动已在公开页；右上肢5个BodyParts3D资产ID及许可证已核，下一步提取OBJ并计算哈希，接入后才做INTEGRATION/DISPLAY验收；M03与TEMP-CLUB原门禁不变。
- [Drive双项目动态执行看板](https://docs.google.com/document/d/16xSk77EHM3D_v2gdEenKs5q8ZXHF7gpWkc_r9a6dn8I/edit)
- [公开动作库](./exercise-library.html)
