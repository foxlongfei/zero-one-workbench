# M2 完成报告｜完整人体 / 解剖能力块

- 验收时间：2026-10-03 17:07（北京时间）
- Issue：#2
- 任务：MAIN 1 / M2 完整人体 / 解剖能力块
- 结论：COMPLETED
- 主入口：https://foxlongfei.github.io/zero-one-workbench/portal/movement.html
- 完整上游：`ashemag/human-atlas@1c38bf35c254a891200d3cedecfd57abebe83d8d`
- 应用许可证：MIT
- 解剖数据：BodyParts3D 4.0，CC BY 4.0

## 实际成果

1. 完整 Human Atlas 已作为同页能力块接入 `portal/movement.html`，不是独立测试页，也不是从上游摘取少量结构拼成 Demo。
2. 受控发布链包含 2,234 个真实解剖网格、3,432 个 FMA 命名概念、15 个解剖系统和 15 个几何分块；完整构建产物位于 `portal/anatomy/`。
3. 系统支持骨骼、肌肉、心脏、感觉器官、动脉、静脉、神经、呼吸、消化、泌尿、淋巴、内分泌、生殖、体表和结缔组织的显示控制。
4. `portal/anatomy/structure-index-v0.1.json` 对全部 3,432 个结构显式记录标准 FMA ID、名称、侧别、系统 → 概念 → BodyParts3D 网格层级及来源；未从几何形状猜测侧别。
5. 搜索和点击定位进入同一结构详情：结构名称、系统、FMA ID、选中网格数和 BodyParts3D 来源链接均可读。
6. WebGL 不可用时页面明确报出能力边界，不用静态图或假几何冒充完整三维。

## 真实运行与产物

- 上游构建 workflow run [37093883242](https://github.com/foxlongfei/zero-one-workbench/actions/runs/37093883242)：TypeScript check、atlas validation、interaction validation、Vite build 全部成功。
- 完整 vendored 构建提交：`8a47eed9cfc75dbfe98720edc9e64111afa18c13`。
- 显式结构映射提交：`f016cd7966b3211f824b420d97f0859865651ecc`。
- 主页面接入提交：`6e28a14d37e115f2b66fde6206a902af891d80d2`。
- WebGL 公网页面验收 workflow run [37111976809](https://github.com/foxlongfei/zero-one-workbench/actions/runs/37111976809)：success。
- 固化证据提交：`f8677a825664c8fb5db4171bf7fd24cdfa2f9c98`。
- 机器可读验收结果：`docs/v0.1/evidence/m2/public-webgl-verification.json`。
- 截图证据：`public-before.png`、`public-after-rotate.png`、`public-after-zoom.png`、`public-main-entry.png`，并保留 rotate / zoom 像素差图。

## 公开页面验收

公开主入口在支持软件 WebGL 的真实 Chromium 中完成读回：

- 完整目录：2,234 meshes / 15 systems。
- WebGL 画布：1582 × 900，启动成功。
- 自动旋转：前后截图改变 2,638 像素，PASS。
- 缩放：前后截图改变 38,112 像素，PASS。
- 系统预设：Skeleton 后显示 296 pieces，PASS。
- 搜索 `femur`：返回 `FMA9611`、右股骨 `FMA24474`、左股骨 `FMA24475`。
- 定位 `FMA24474`：显示 right femur / Skeleton / 1 selected piece / 来源链接。
- 同页右上肢真实 OBJ 视角：`REAL_OBJ_ORBIT` 45°，像素改变 2,737，PASS。
- 屈肘峰值：120°、前臂旋转 +55°、真实资产状态 DISPLAYED，像素改变 3,633，PASS。

## 验收门结论

Issue #2 的七步门均已满足：

1. 代码、依赖、模型实际存在；
2. CI 真实运行；
3. 完整构建与映射产物生成；
4. 接入唯一主页面；
5. GitHub Pages 部署成功；
6. 公开页面完成目录、搜索定位、分系统、WebGL 旋转和缩放读回；
7. 本报告提交后允许将 M2 标记为 COMPLETED。

## 边界

M2 完成只认证“完整人体 / 解剖能力块”。它不替代 M3 完整运动 / 动作识别、M4 OpenSim 真实肌骨计算或 M5 训练反馈总闭环；这些仍按 Issue #2 顺序独立验收。
