# 双项目当前状态

更新时间：2026-09-27 13:36（UTC+08:00）

> Drive 为权威研究记录；本页是公开状态镜像。完成度只按实际验收物计算，不以时间戳或同步动作计数。

## 零一空间研究

- 当前主线：Z04 — **3/4，in_progress**
- 当前执行：TEMP-E01 / TEMP-M01；95T1J1:4 二级渲染图像角色核验
- 并行分工：C=文章配图与题注拓扑对齐；Q=LINE_DRAWING/RUBBING视觉角色判定；D=证据等级与字节边界审计
- 最近一次后台运行/真实成果变化：2026-09-27 13:36；文章全文成功展开并定位31幅配图，其中95T1J1:4对应配图4/5
- 真实增量：配图4（367×366）经视觉检查确认为 LINE_DRAWING；配图5（239×325）确认为 RUBBING；明确题注为“95T1J1：4带字卜骨正、反面线图和拓片”
- 冲突处理：旧状态“角色UNKNOWN”更新为 SECONDARY_RENDER_ROLE_RESOLVED_BYTES_PENDING；网页渲染证据不冒充原始字节，byte_length/SHA-256仍为空
- 验收状态：角色映射 HIGH confidence；仍非 AUDIT_PASS，Z04完成数保持3/4
- 当前阻塞：两幅图片原始字节和《华夏考古》1997(2)第34–35页仍未取得
- 下一步：取得任一资产字节→记录长度/SHA-256/媒体类型/解码尺寸→运行字节验证器→精确字形位置对读
- 成果：[渲染图像角色审计](../research/zero-one/95T1J1-4-rendered-image-role-audit-v0.1.json)
- 提交：[d527ae83](https://github.com/foxlongfei/zero-one-workbench/commit/d527ae838a70c6ddca570aaf994b627c62e4f35f)；blob 9b8a1f68608328595cc0dec98a15d2817b9f2b82

## 动起来

- 当前主线：M01→M02/M03→M04 — **0/4，in_progress**
- 当前执行：M02/Q clean blind 首次交卷已提交，等待C验收；M03/D仍须独立执行
- 并行分工：Q=冻结Gate/Q任务/6代理独立观察；C=仅在Q提交后做协议与哈希验收；D=继续隔离，尚未读取Q结果
- 最近一次后台运行/真实成果变化：2026-09-27 13:36；完成6/6代理哈希复算、24帧总览和有效区间2fps密集抽样
- 真实增量：形成三组独立配对假设（01/04、02/05、03/06）及6条有效区间；周期候选分别为5、34–36、29–31、5、37、30
- 证据边界：全部为5fps代理的L1候选；30fps/60fps差异、精确边界完整性、真实深度和动作质量均 NOT_ESTABLISHED
- 验收状态：M02_Q_FIRST_PASS_COMPLETE_PENDING_C_ACCEPTANCE；M01仍partial，M02尚未闭环，不计主线完成
- 当前阻塞：M03/D clean blind、C认证和正式RESULTS仍缺；原始高帧率文件未进入本轮Q材料
- 下一步：保持Q交卷封存；下一轮先独立执行M03/D，不向D输入Q/C结论，再由C做双交卷协议验收
- 成果：[M02/Q干净盲审交卷](../research/movement/testset-01-m02-q-clean-blind-v0.1.json)
- 提交：[2cfea35d](https://github.com/foxlongfei/zero-one-workbench/commit/2cfea35da52ce1075ca03de4adfdc49961675698)；blob 963a319d2b9a2e4a08677c20fd43d29aa3ea9724

## 本周期验收

- 两项目均产生可观察结构化成果并完成GitHub读回；主线完成度未虚增。
- Drive三份权威记录在写入前完成修订对齐可信读；本页写入后再次读回。
- [Drive双项目动态执行看板](https://docs.google.com/document/d/16xSk77EHM3D_v2gdEenKs5q8ZXHF7gpWkc_r9a6dn8I/edit)
- [公开动作库](./exercise-library.html)
