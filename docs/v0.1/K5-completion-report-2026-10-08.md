# K5 完成报告｜先生式反馈闭环

状态：COMPLETED  
日期：2026-10-08  
主入口：`portal/k02-board.html`  
案例：`K02_REFERENCE_RESIDENTIAL_CASE_V0.1`

## Issue #2 验收要求

用户给材料 → 识别已知/未知 → 追问必要缺口 → 运行模型 → 综合结果 → 解释原因/证据 → 允许继续追问。至少一个住宅/户型案例完整跑通。

## 实际运行

- 运行器：`scripts/run-k5-advisor.cjs`
- CI：`Run K5 advisor feedback closure`
- 成功运行：<https://github.com/foxlongfei/zero-one-workbench/actions/runs/37656885283>
- 运行时：Node.js 22
- 产物：`portal/data/k5-advisor-case.json`
- 实际读取：
  - K2：`portal/data/depthmap-vga.csv`，263 个 VGA 点，Connectivity 均值 124.8、范围 65–200。
  - K3：`portal/data/k3-radiance-daylight.json`，Radiance 6.0.2，20 个传感点，均值 771.6 lx、范围 421.2–1976.2 lx。
  - K4：`portal/data/k4-evidence-layers.json`，7 条分层证据；`geometryContinuity=NOT_PROVEN`；跨层等同 `BLOCK`。

运行产物记录三份源文件的 SHA-256、GitHub SHA、引擎/单位/适用范围和八项通过门禁，不依赖页面临时计算伪造模型结果。

## 住宅A完整闭环

输入问题：“请综合看这个住宅样板的空间、采光和传统坐向层，并说明还不能判断什么。”

### 已知

1. K2 depthmapX 产物仅对应仓库参考 DXF。
2. K3 Radiance 产物仅对应固定 5 m × 4 m × 3 m 南窗参考房间及广州夏至晴空时刻。
3. 180° 在产品 15° 工程归一化规则下映射为“午”。
4. K4 证据分层和阻断规则可用。

### 未知与必要追问

1. K2/K3 是否为同一几何：`NOT_PROVEN`。
2. 尚未证明与用户实际住宅为同一对象。
3. 没有全年气候采光结果。
4. 道路、水体、坡向、外部遮挡等现场信息没有经来源标注。

先生追问：实际个案必须补充可转换墙线的户型、窗墙尺寸/朝向、地点或天气文件，并逐项注明现场观察来源。

### 证据化反馈

1. 先建立同一几何，再分别重跑 depthmapX 与 Radiance，之后才允许跨模型比较。
2. K3 参考模型近窗均值 1049.2 lx、深区均值 494.0 lx；只作为检查深区采光、遮挡与补光需求的提示，不直接套用到用户住宅。
3. 二十四山只保留可追溯坐向名称；没有证据桥时不生成吉凶断语。

每项反馈包含原因、行动和证据 ID。

### 继续追问

公开页面可操作三个追问：

- 为什么不直接说吉凶？
- 深区照度较低意味着什么？
- 这个结果能用于我的房子吗？

每个回答均显示证据 ID，并保留模型范围、不确定性和重新运行条件。

## 主页面和公开操作

- 集成提交：`5bee10933a000f3c6fff0892a15f904a28c555c9`
- Pages：<https://github.com/foxlongfei/zero-one-workbench/actions/runs/37657200125>
- 公开入口：<https://foxlongfei.github.io/zero-one-workbench/portal/k02-board.html>
- 实际浏览器操作：
  - `artifactReady=true`
  - 点击“运行住宅A完整反馈”后 `executed=true`
  - 263 点、20 传感点、1049.2/494.0 lx、午/180°均显示
  - 三个追问逐一点击并返回不同证据化回答
  - `geometryContinuity=NOT_PROVEN`
  - `crossLayerEquivalence=BLOCK`

## 不越界声明

- K2/K3 未证明几何连续，禁止跨引擎因果推断。
- 参考案例不是用户住宅实测。
- 单时刻晴空结果不是全年采光性能。
- Connectivity、lux 不等同“气”、吉凶、健康、财富或未来。
- 传统文本证明的是文本见证及其语境，不证明现代模型或人生结果。

## 完成判定

代码/依赖/模型实际存在 → CI 读取 K2–K4 并实际运行 → JSON 产物 → 主页面接入 → Pages 部署 → 公开页面真实点击 → 三个继续追问与证据边界，均已通过。K5 可标记 COMPLETED。
