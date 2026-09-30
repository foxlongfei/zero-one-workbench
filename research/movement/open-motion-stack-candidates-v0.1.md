# 动起来｜开放动作捕捉/姿态分析底座候选 V0.2

更新时间：2026-09-30
状态：FOUNDATION_POLICY_LOCKED / INTEGRATION_ORDER_DEFINED

## 硬规则
**能连接成熟基础设施，就不自己重造基础算法。**

运动达人所有基础能力统一按以下顺序推进：
**全球搜索 → 找成熟项目 → 查论文/验证 → 查源码 → 查许可证 → 实际跑 → 比较 → 选底座 → 做连接层 → 最后才补真正没人解决的部分。**

适用范围不仅是视频捕捉，还包括：
- 完整人体 / 解剖模型
- 2D / 3D 姿态识别
- 多相机同步 / 标定 / 三角化
- 运动学 / 生物力学
- OpenSim 生态
- 动作库 / 训练数据库
- 视频分析
- 康复相关基础设施

默认禁止从零重写成熟基础算法。若确实需要自研，必须先证明现有成熟底座无法满足已定义需求。

筛选门：
SOURCE_VERIFIED → LICENSE_VERIFIED → CAPABILITY_VERIFIED → INTEGRATION_TEST → DISPLAY_VERIFIED。

## 当前底座分工

### Pose2Sim
- upstream: https://github.com/perfanalytics/pose2sim
- license: BSD-3-Clause（仓库当前声明；代码/模型/数据正式集成前继续逐项核验）
- 定位：运动达人“视频 → 3D运动学”的主干候选。
- 已覆盖：2D pose → camera calibration/sync → person association → triangulation → filtering → marker augmentation → OpenSim kinematics / joint angles。
- 决定：PRIMARY_PIPELINE_CANDIDATE / PRIORITY_INTEGRATION_TEST。

### MMPose / RTMPose
- upstream: https://github.com/open-mmlab/mmpose
- license: Apache-2.0（仓库当前声明；模型权重/数据集许可逐项核验）
- 定位：底层姿态识别引擎。
- 已覆盖：2D多人、手、脸、133点 whole-body、3D人体及实时方向。
- 决定：POSE_ENGINE_CANDIDATE / PRIORITY_INTEGRATION_TEST。

### FreeMoCap
- upstream/site: https://www.freemocap.org/
- license: AGPL-3.0（当前官网声明；仓库/依赖/模型继续核验）
- 定位：完整采集工作流、桌面端无标记动作捕捉与互操作参考。
- 边界：AGPL 对分发/服务集成有更强义务，不能未经架构评估直接嵌入正式产品。
- 决定：REFERENCE_OR_COMPONENT_CANDIDATE / LICENSE_ARCH_REVIEW。

## 与产品 MAIN 的关系
这些底座不作为前台“产品”。它们只能服务于运动达人完整能力：

**看懂一个人 → 理解他的条件 → 分析动作 → 解释问题 → 给训练方案 → 跟踪反馈 → 持续修正。**

原创价值集中在上层：
- 多底座编排与结果解释
- 用户真实条件理解
- 运动任务设计与训练决策
- 风险边界与不确定性表达
- 反馈闭环与长期能力档案
- ZERO-CORE 中的可追溯认知与个体化连续性

## 下一批底座
继续核验：
OpenSim、MediaPipe、OpenCap、Sports2D、PHALP / 4D Humans、SMPL 生态、成熟动作库与训练数据库。

比较标准：
运动场景能力、验证证据、维护状态、许可证、可本地运行、接口、性能、隐私、与 ZERO-CORE / HUMAN-3D 的可连接性。

## 验收纪律
候选文件、论文阅读、GitHub star、源码分析都不算产品推进。
只有当底座被真实连接并在公开产品页面产生可操作能力，才进入 MAIN 的“实质推进”。