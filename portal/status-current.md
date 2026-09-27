# 双项目当前状态

更新时间：2026-09-27 12:34（UTC+08:00）

> Drive 为权威研究记录；本页是公开状态镜像。完成度只按实际验收物计算，不以时间戳或同步动作计数。

## 零一空间研究

- 当前主线：Z04 — **3/4，in_progress**
- 当前执行：TEMP-E01 / TEMP-M01；`IMAGE_BYTE_EVIDENCE V0.1`
- 并行分工：C=字节证据验证器；Q=IB-T01—04；D=浏览器阻断复核与读回
- 最近真实成果：新增 IB-01—04 与四项可执行测试，实际 **4/4 PASS**
- 规则：有效图像证据必须具有正字节长度、SHA-256、JPEG/PNG类型、成功解码和有效宽高；没有视觉检查或明确图号时不得解析图像角色
- 反例：`ACCESS_BLOCKED` 不得改写为 `ASSET_ABSENT`；缺哈希且仅靠网页顺序强配角色必须失败
- 获取尝试：浏览器直接打开首条CDN资源返回 `ERR_BLOCKED_BY_CLIENT`；只记录为受阻路由
- 验收状态：`4/4 TEST_PASS`；仍为 `SECONDARY_IMAGE_WITNESS_LOCATED_BYTES_PENDING`，不是 `AUDIT_PASS`
- 当前阻塞：图片字节和《华夏考古》1997(2)第34–35页仍未取得
- 下一步：取得任一资产后填写字节长度、哈希、媒体类型、解码状态、尺寸和角色证据，再运行验证器
- 成果：[字节证据验证器](../research/zero-one/image-byte-evidence-validator-v0.1.mjs) · [测试夹具](../research/zero-one/image-byte-evidence-cases-v0.1.json)
- 提交：validator [fcb5996e](https://github.com/foxlongfei/zero-one-workbench/commit/fcb5996ebc58dbed50f40a7b426be23c03bc9193)；cases [88c5abaa](https://github.com/foxlongfei/zero-one-workbench/commit/88c5abaaee258bf2d246634fc6148795bd8e56dd)

## 动起来

- 当前主线：M01→M02/M03→M04 — **0/4，in_progress**
- 当前执行：M01 ZIP内部核验完成，准备进入M02/Q clean blind
- 并行分工：C=5 ZIP与112成员哈希；Q=D盲包冻结一致性复算；D=历史交叉评审盲性门审计
- 最近真实成果：5个Drive ZIP全部通过压缩完整性测试，成员文件名、大小和SHA-256达到 **112/112**
- 冻结一致性：D盲包的六个代理、D任务和Gate达到 **8/8 PASS**；协议文件别名通过相同大小与SHA-256消除名称假冲突
- 历史评审结论：CQD包自述 `NON-BLIND METHOD-DEVELOPMENT TESTSET` 与 `CROSS-REVIEWED_NOT_CONCLUDED`；无独立Q/D交卷、未绑定冻结输入内容哈希，只能归档为 `HISTORICAL_CROSS_REVIEW_ONLY`
- 验收状态：`ZIP_INTERNAL_AUDIT_COMPLETE`；M01仍为 partial，不计完成
- 当前阻塞：clean blind Q review、clean blind D review、C认证和正式RESULTS
- 下一步：以冻结9对象manifest启动M02/Q并独立落盘，不向Q输入C/D结论；随后独立执行M03/D
- 成果：[ZIP内部审计清单](../research/movement/testset-01-zip-internal-audit-v0.1.json)
- 最终提交：[cffe246d](https://github.com/foxlongfei/zero-one-workbench/commit/cffe246d6ffb3de6d96e3e09959dc0510226ee76)；blob `75d66e0ece9c19d934dbd59383881b4f4f5a2b8b`

## 验收

本周期两个项目均有真实代码、测试、文件哈希或冲突处理；Drive三份权威记录和GitHub成果文件已写入，主线完成度未虚增。

- [Drive双项目动态执行看板](https://docs.google.com/document/d/16xSk77EHM3D_v2gdEenKs5q8ZXHF7gpWkc_r9a6dn8I/edit)
- [公开动作库](./exercise-library.html)
