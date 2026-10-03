# K2 COMPLETED｜完整空间分析能力块

完成日期：2026-10-03

## 验收对象
Issue #2 / MAIN 2 / K2。

## 实际链路
1. `research/depthmap/prototype-house.dxf`：真实住宅样例几何。
2. depthmapX CLI v0.9.1：IMPORT。
3. VISPREP：0.5 网格、fill seed `2,2`，并用 `-pm` 建立 visibility graph。
4. VGA：`visibility` + local measures。
5. EXPORT：`pointmap-data-csv`。
6. 产物：`portal/data/depthmap-vga.csv`、`portal/data/depthmap-run.json`。
7. 主入口：`portal/k02-board.html` 读取真实 CSV，显示点数、平均/最低/最高 Connectivity，并按真实 x/y/Connectivity 绘制格点图。

## 真实运行证据
- depthmapX workflow run `37124365240`：success。
- 真实数据提交：`050c33af926f0c21da2f7b0e7f3b6c5a3a502efa`。
- CSV 包含 depthmapX 字段：`Connectivity`, `Point First Moment`, `Point Second Moment`, `Visual Clustering Coefficient`, `Visual Control`, `Visual Controllability`。

## 公开验收
- 公共读回 workflow `37124473258`：success；公开主页面、run metadata、CSV 均可读。
- 公共浏览器执行 workflow `37124505503`：success；headless Chrome 实际执行 `k02-board.html`，确认 DOM 出现“真实引擎产物已读入”、“平均 Connectivity”与 `visibility_graph=true`。

## 边界
- K2 只认证这条 depthmapX 样例住宅 VGA 链已经真实跑通并进入主页面。
- 用户上传普通户型图片目前不会被伪装成已自动提取墙线；任意用户户型自动几何化属于后续产品闭环。
- 不把 Connectivity / Visual Control 等现代指标直接等同传统“气”“明堂”或吉凶。
- K3/K4/K5 仍未完成。
