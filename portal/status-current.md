# 双项目当前状态

更新时间：2026-09-27 11:37（UTC+08:00）

> Drive 为权威研究记录；本页是公开状态镜像。完成度只按实际验收物计算，不以时间戳或同步动作计数。

## 零一空间研究

- 当前主线：Z04 — **3/4，in_progress**
- 当前执行：TEMP-E01 / TEMP-M01；`95T1J1:4` 图像字节取得与角色解析
- 并行分工：C=IMAGE_ASSET_AUDIT V0.2；Q=IA-05证据边界；D=GitHub/Drive写回读回
- 最近真实成果：新增两条可复核的受阻路由记录、IA-05 与 `blocked_routes`
- 新证据：两条CDN精确URL经直接打开仍不可访问；Drive按原发掘报告精确题名检索未取得报告文件
- 约束：这些结果只能证明当前路由受阻，不能证明图片不存在，不能提升证据等级，也不能解析 `LINE_DRAWING / RUBBING`
- 验收状态：`SECONDARY_IMAGE_WITNESS_LOCATED_BYTES_PENDING`；不是 `AUDIT_PASS`
- 当前阻塞：图片字节和《华夏考古》1997(2)第34–35页仍未取得
- 下一步：使用获授权的字节下载路径或取得原报告页，先记录字节长度、SHA-256、媒体类型和尺寸，再执行视觉角色判定
- 成果：[图像见证审计 V0.2](../research/zero-one/95T1J1-4-image-witness-v0.1.json)
- 提交：[06fe1070](https://github.com/foxlongfei/zero-one-workbench/commit/06fe10703a7dadd5e74407e81f6b57c4ea9a75f4)；blob `c17afc7e5ce804f2e0274b29534ea1ebeb542935`

## 动起来

- 当前主线：M01→M02/M03→M04 — **0/4，in_progress**
- 当前执行：M01冻结输入 manifest
- 并行分工：C=九对象原始字节哈希；Q=字段与总字节复算；D=GitHub/Drive读回验收
- 最近真实成果：生成 `TESTSET-01_FROZEN_INPUT_MANIFEST_V0.1`
- 冻结输入：Gate协议、Q任务、D任务和六个5FPS代理共9个对象
- 完整性：Drive ID、文件名、MIME、大小、修改时间和SHA-256均 **9/9**
- 总字节：**2,020,166**
- 验收状态：`INPUT_MANIFEST_HASH_COMPLETE`；仅消除“内容哈希manifest缺失”，不计M01完成
- 当前阻塞：5个ZIP内部核验及 clean blind review
- 下一步：逐包建立ZIP成员文件名/大小/哈希清单，与冻结manifest交叉核验，再执行clean blind review
- 成果：[冻结输入清单](../research/movement/testset-01-frozen-input-manifest-v0.1.json)
- 提交：[b7b231b6](https://github.com/foxlongfei/zero-one-workbench/commit/b7b231b6d0972ebafe44fa84b30dbf8eb8e87594)

## 验收

本周期两个项目均有真实结构化数据或证据变化；Drive三份权威记录和GitHub成果文件均已写入，主线完成度未虚增。

- [Drive双项目动态执行看板](https://docs.google.com/document/d/16xSk77EHM3D_v2gdEenKs5q8ZXHF7gpWkc_r9a6dn8I/edit)
- [公开动作库](./exercise-library.html)
