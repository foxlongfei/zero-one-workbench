# 双项目当前状态

更新时间：2026-09-27 23:55（UTC+08:00）

> Drive 为权威研究记录；本页是公开 CURRENT 镜像。发布、刷新时间或单纯同步不计研究完成。

## 零一空间研究

- 已关闭主线：Z01—Z04 — **4/4 COMPLETED**
- 当前主线：**K02-03｜术数/方技案例的可验证性与失效机制｜ACTIVE｜严格0/5**
- 当前执行：沿用 **K02-03-HXL-01**。C 已完成 NDL 774615 画布18非盲锚点；本轮按原断点生成独立 Q/D 盲审输入包，没有新建替代任务ID。
- 盲性边界：包内只提供稳定影像、哈希、定位任务、回传字段和冻结路径；不包含 C 的预期逐字、页侧、栏位或答案字段。Q、D 必须各自在干净上下文冻结交卷后才能交叉。
- 最近真实成果：2026-09-27 23:50；新增 Q/D 盲包及验证器，**12/12 PASS**，其中包含目标句不泄露、禁止答案字段、先冻结后交叉等门。
- 成果：[Q/D盲包](../research/zero-one/k02-03-hxl-ndl-qd-blind-package-v0.1.json) · [盲包验证器](../research/zero-one/k02-03-hxl-ndl-qd-blind-package-validator-v0.1.mjs) · [C页锚v0.2](../research/zero-one/k02-03-hxl-ndl-page-anchor-v0.2.json)
- 提交：[盲包 0d485855](https://github.com/foxlongfei/zero-one-workbench/commit/0d485855e31adc6cab8d39152a20c14881d21b72) · [验证器 fc4a518f](https://github.com/foxlongfei/zero-one-workbench/commit/fc4a518f1ab89fcd2da5072240f9a100a7579b80)
- 并行辅线：TEMP-E01/TEMP-M01 保持 ACTIVE；本轮盲包属于 K02-03-HXL-01 主线验收准备，不替代辅线。
- 验收状态：**BLIND_PACKAGE_COMPLETE；Q=false；D=false；CROSS_REVIEW=false；NLC=false；严格仍0/5**。
- 当前阻塞：需要两个未接触 C 结果的独立上下文执行 Q、D；NLC 382411 卷十一页锚仍待定位。
- 下一步：独立执行并冻结 k02-03-hxl-ndl-q-return-v0.1.json 与 k02-03-hxl-ndl-d-return-v0.1.json，再做 C/Q/D 交叉；随后完成 NLC 页锚，全部通过后才计1/5。

## 动起来

- 当前主线：**M01→M02/M03→M04｜严格完成1/4**
- 任务状态：M01=COMPLETED；M02=PAUSED_PENDING_C_ACCEPTANCE；M03=BLOCKED_CLEAN_CONTEXT；M04=BLOCKED_BY_M02_M03。
- 当前执行：5件 BodyParts3D 真实OBJ已写入 portal/assets/bodyparts3d/，V0.7 页面新增真实资产查看器及由同一批OBJ生成的双视角静态降级图。
- 分工：C=来源、许可、FMA→BP→FJ映射、字节与集成验收；Q=既有M02交卷封存；D=不在受污染上下文伪造M03；公开读回=已验证静态真实资产显示。
- 最近真实成果：2026-09-27 23:51；公开页可见右肱骨、桡骨、尺骨及肱二头肌长/短头真实网格双视角图；集成回执验证器 **12/12 PASS**。
- 受控资产：[V0.7公开页](https://foxlongfei.github.io/zero-one-workbench/portal/movement.html) · [集成读回](../research/movement/bodyparts3d-upper-limb-integration-readback-v0.1.json) · [验证器](../research/movement/bodyparts3d-upper-limb-integration-readback-validator-v0.1.mjs) · [OBJ字节清单](../research/movement/bodyparts3d-upper-limb-obj-byte-manifest-v0.1.json)
- 提交：[页面集成 4154998f](https://github.com/foxlongfei/zero-one-workbench/commit/4154998f8ed6c75d5d0cbbdd8aa0681606cf4ebd) · [静态降级图 ec5bd687](https://github.com/foxlongfei/zero-one-workbench/commit/ec5bd687cec8190bc5f99042029f5695340ac65e) · [最终页面 cb445d47](https://github.com/foxlongfei/zero-one-workbench/commit/cb445d471138d36fd9472c0f3978eadeffc0d3d4) · [读回 3ed0679b](https://github.com/foxlongfei/zero-one-workbench/commit/3ed0679b734e473c84f2bf832b87404cdad75642)
- 公开读回：云端浏览器实际显示 V0.7、5件资产标签和真实OBJ双视角图。该浏览器返回 Error creating WebGL context，因此静态显示验收通过，动态旋转仍未在本环境验收。
- 并行队列：共同人体坐标系继续承接真实资产；TEMP-YOUTH、TEMP-CLUB、TESTSET 沿既有队列；M03干净上下文门禁不变。
- 验收状态：**SOURCE=true；LICENSE=true；BYTE=true；INTEGRATION=true；DISPLAY=true（STATIC_FALLBACK）；INTERACTIVE_WEBGL=false**。
- 当前阻塞：M03缺未接触Q摘要的独立D；WebGL动态5/5加载仍需图形环境读回；静态mesh不得冒充关节运动、肌肉形变或OpenSim计算。
- 下一步：在支持WebGL的环境验证动态5/5加载、旋转与点选；随后把受控对象绑定共同坐标和运动模型，同时保持静态解剖与运动学分层。

## 精确断点

- 零一：盲包已完成并通过12/12；停在“Q/D尚未独立执行、NLC页锚尚未完成”，沿 K02-03-HXL-01 续做，严格0/5。
- 动起来：5个OBJ已落入受控资产，公开静态显示通过；停在“WebGL动态读回与共同坐标/运动模型绑定”，严格1/4。
- [Drive双项目动态执行看板](https://docs.google.com/document/d/16xSk77EHM3D_v2gdEenKs5q8ZXHF7gpWkc_r9a6dn8I/edit)
- [公开动作库](./exercise-library.html)

