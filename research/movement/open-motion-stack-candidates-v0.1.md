# 动起来｜开放动作捕捉/姿态分析底座候选 V0.1

更新时间：2026-09-29
状态：SOURCE_SCREENING / NOT_YET_INTEGRATED

## 原则
Reuse Before Rebuild。视频捕捉、2D/3D姿态估计、三角化、运动学与生物力学底座，优先寻找全球成熟、许可清晰、持续维护、可本地运行/可集成的开放项目。除非现有底座无法满足已定义需求，否则不从零重写基础算法。

筛选门：SOURCE_VERIFIED → LICENSE_VERIFIED → CAPABILITY_VERIFIED → INTEGRATION_TEST → DISPLAY_VERIFIED。

## 第一批高价值候选

### Pose2Sim
- upstream: https://github.com/perfanalytics/pose2sim
- license: BSD-3-Clause（仓库当前声明；正式集成前继续核验代码/模型/数据各自许可）
- role candidate: 多相机无标记3D运动学主流水线。
- current capabilities: 2D pose → camera calibration/sync → person association → triangulation → filtering → marker augmentation → OpenSim kinematics；当前默认可使用 RTMPose，并支持多种相机。
- reason: 与“动起来”的视频→人体→关节角→解释链高度接近，优先评估为主干候选。
- status: PRIMARY_CANDIDATE / NOT_INTEGRATED.

### MMPose / RTMPose
- upstream: https://github.com/open-mmlab/mmpose
- license: Apache-2.0（仓库当前声明；模型权重/数据集需逐项核验）
- role candidate: 2D/whole-body/3D pose estimation engine。
- current capabilities: 2D多人、手、脸、133点whole-body、3D human mesh recovery、RTMPose/RTMW3D等。
- status: POSE_ENGINE_CANDIDATE / NOT_INTEGRATED.

### FreeMoCap
- upstream/site: https://www.freemocap.org/
- license: AGPL-3.0（当前官网声明；正式复用前核验仓库及依赖/模型）
- role candidate: 桌面端无标记动作捕捉、相机采集/校准/工作流参考与可互操作来源。
- caution: AGPL 对分发/网络服务集成方式有更强义务，不能未经架构评估直接嵌入正式产品。
- status: REFERENCE_OR_COMPONENT_CANDIDATE / LICENSE_REVIEW_REQUIRED.

## 当前决定
1. 暂停任何“自己重造视频姿态识别/动作捕捉基础算法”的默认路线。
2. 优先深挖 Pose2Sim + MMPose/RTMPose；FreeMoCap 作为完整应用/采集工作流与互操作候选。
3. 下一轮扩大检索：OpenSim、MediaPipe、OpenCap、Sports2D、PHALP/4D humans、SMPL生态及成熟运动分析项目；分别核验源码、模型权重、数据、商用/再分发边界。
4. “最健全”不按 star 数决定；按运动场景能力、验证证据、维护状态、许可、可本地运行、接口、性能、隐私、与 ZERO-CORE/HUMAN-3D 的可连接性综合比较。
