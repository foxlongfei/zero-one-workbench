# 双项目当前状态

更新时间：2026-09-27 10:35（UTC+08:00）

> Drive 为权威研究记录；本页是公开状态镜像。完成度只按实际验收物计算，不以时间戳或同步动作计数。

## 零一空间研究

- 当前主线：Z04 — **3/4，in_progress**
- 当前执行：TEMP-E01 / TEMP-M01；`95T1J1:4` 图像资产角色解析
- 并行分工：C=角色验证器；Q=IA-T01—03；D=GitHub/Drive写回读回
- 最近真实成果：新增 `IMAGE_ROLE_RESOLUTION V0.1` 与 IA-04。两张图片共享一个题注且字节不可见时，两者角色必须保持 `UNKNOWN / UNRESOLVED`
- 测试结果：**3/3 PASS**；强行按网页顺序分配 `LINE_DRAWING / RUBBING` 会产生IA-04并回退UNKNOWN
- 镜像反查：以两个CDN文件哈希、完整题注及器物号定点检索，未发现独立可访问镜像；这只记录为访问阻塞
- 验收状态：`SECONDARY_IMAGE_WITNESS_LOCATED_BYTES_PENDING`；不是 `AUDIT_PASS`
- 当前阻塞：图片字节和原报告《华夏考古》1997(2)第34–35页仍未取得
- 下一步：取得图像后，以视觉检查或明确图号重新运行角色判定，再进入字形位置对读
- 成果：[角色验证器](../research/zero-one/image-witness-role-validator-v0.1.mjs) · [测试夹具](../research/zero-one/image-witness-role-cases-v0.1.json) · [Drive权威记录](https://docs.google.com/document/d/1NmEBYBXLIM4gTL_ZeRSWUMPGt1buB6ehTgipB-aCWCc/edit)
- 提交：validator [`f5efc571`](https://github.com/foxlongfei/zero-one-workbench/commit/f5efc571aae2e371ca2c3ed18c1e3a2ad9484b76)；cases [`482fc19b`](https://github.com/foxlongfei/zero-one-workbench/commit/482fc19b1febfbc833246acea062fe6762c37c67)

## 动起来

- 当前主线：M01→M02/M03→M04 — **0/4，in_progress**
- 当前执行：M01冻结输入manifest；测量可行性辅线已在CASE_0001绑定处验收
- 关键冲突纠正：Drive实物确认 `CASE_0001 = PUSH_UP` 双机位方法开发案例，不是反手引体；两者禁止串线
- 真实输入：侧面60 fps运动相机＋正面30 fps苹果手机；同步仅为约35.65秒 `WORKING_SYNC_CANDIDATE`；`FINAL_REP_COUNT=UNKNOWN`
- 缺失输入：没有相机标定、外力、超声、EMG、人体参数或肌骨模型证据
- 第7项机器测试：`MF-T07_CASE_0001_DRIVE_BINDING = PASS`
- 输出：相位时间 `MEASURED`；关节角 `QUALITATIVE_ONLY`；外力、净关节矩、单肌力、肌束速度、肌腱应变和能量平衡全部 `UNAVAILABLE`
- 总测试结果：**7/7 PASS**；不把13个周期候选改写为最终REP
- 验收状态：`CASE_IDENTITY_CORRECTION + MF-T07 + GITHUB_READBACK_PASS`；不计M01—M04完成项
- 当前阻塞：M01缺冻结输入内容哈希manifest、5个ZIP内部核验及clean blind review
- 下一步：生成 `TESTSET-01_FROZEN_INPUT_MANIFEST_V0.1`，恢复M01主线
- 成果：[CASE_0001绑定](../research/movement/case-0001-measurement-binding-v0.1.json) · [更新测试集](../research/movement/mf-t01-cases-v0.1.json) · [Drive权威记录](https://docs.google.com/document/d/1ZNPdOSkKpWjEmWExr-zxaQV2s6vSClg_rh8uZQo85Bc/edit)
- 提交：binding [`03544dc9`](https://github.com/foxlongfei/zero-one-workbench/commit/03544dc95ac0397f61ba65a1e4c2e8ca55e029e3)；fixtures [`dd09e5a1`](https://github.com/foxlongfei/zero-one-workbench/commit/dd09e5a186146fd7499fe744f10f08dbfd16f373)

## 验收

本周期两个项目均有真实代码、测试或冲突纠正；Drive三文档及GitHub成果文件已读回，主线完成度未虚增。

- [Drive双项目动态执行看板](https://docs.google.com/document/d/16xSk77EHM3D_v2gdEenKs5q8ZXHF7gpWkc_r9a6dn8I/edit)
- [公开动作库](./exercise-library.html)
