# K4 完成报告｜传统体系与证据分层

- 状态：`COMPLETED`
- 完成日期：2026-10-08（CST）
- 唯一任务来源：[Issue #2](https://github.com/foxlongfei/zero-one-workbench/issues/2)
- 主发布页：https://foxlongfei.github.io/zero-one-workbench/portal/k02-board.html
- 机器可读分层：[k4-evidence-layers.json](../../portal/data/k4-evidence-layers.json)
- 严格公开验收：https://github.com/foxlongfei/zero-one-workbench/actions/runs/37649598819
- 公开验收证据：[public-evidence-layer-verification.json](evidence/k4/public-evidence-layer-verification.json)

## 实际交付

K4 没有把传统术语套在现代引擎结果上，而是把同一产品案例中的材料拆成四种互不替代的证据层：

| 层 | 数量 | 作用 |
|---|---:|---|
| `COMPUTED_FACT` | 2 | depthmapX 与 Radiance 的真实引擎产物、数值、单位和适用范围 |
| `TRADITIONAL_TEXT` | 3 | 《宅经》《葬书》《欽定協紀辨方書》的文本见证、版本/页叶、归属或传承状态与原始语境 |
| `MODERN_HYPOTHESIS` | 1 | 对 K3 固定模型中南窗—照度梯度关系的限定性现代解释 |
| `UNVERIFIED_CLAIM` | 1 | 明确阻断“Connectivity/lux 直接等于气、吉凶、健康、财富或未来事件” |

每条记录同时包含 `allowedUse` 与 `prohibitedUse`，避免来源存在就被无限外推。

## 真实模型事实

- depthmapX 0.9.1：263 个 VGA 点；平均 Connectivity 124.8，最低 65，最高 200。只适用于存档参考 DXF。
- Radiance 6.0.2：20 个 0.8 m 工作面照度点；平均 771.6 lx，最低 421.2 lx，最高 1976.2 lx；近窗 1049.2 lx，深区 494.0 lx。只适用于固定 5×4×3 m 房间、南窗、广州晴空单时刻模型。
- K2 与 K3 的几何连续性写为 `NOT_PROVEN`；不制造“两个引擎使用同一几何”的虚假链，也禁止跨引擎因果推断。

## 传统文本边界

1. 《宅经》卷上保存“夫宅者，乃是陰陽之樞紐，人倫之軌模”这一文本事实；使用电子转录与数字扫描双见证。产品只据此确认住宅解释传统存在，不把它当作采光、健康、财富或事件预测的验证。
2. 《葬书》保存“氣乘風則散，界水則止”的收到文本，同时记录郭璞归属在传承书目中存在争议，并限定在葬地/景观语境；不把“风”改写为 Radiance，不把“水”改写为 depthmapX。
3. 《欽定協紀辨方書》卷二冻结页叶只支持二十四山名称、组成与循环次序；15° 等分是真北工程归一化规则，不冒充原文制度，也不授权吉凶判断。

## 机器决策门

- K4-R01：现代计算事实必须附数值、引擎、产物、单位与范围。
- K4-R02：传统文本必须附作品、文本见证、归属/传承状态和原始语境。
- K4-R03：任何跨层等同请求在没有操作定义和独立证据时一律 `BLOCK`。
- K4-R04：询问 K2/K3 是否同几何时返回 `NOT_PROVEN`，禁止跨引擎因果推断。

## 公开验收

严格验收 run 37649598819 在公开 GitHub Pages 上实际读取主页面和 JSON：

- 7 条记录全部加载；
- 四种必需层均出现；
- `geometryContinuity=NOT_PROVEN`；
- “跨层等同默认 BLOCK”可见；
- 未验证等同主张存在且禁止进入建议；
- 公开 JSON HTTP 200，全部数据门为 true；
- 页面截图与机器证据已保存。

因此 K4 标记为 `COMPLETED`。本报告只关闭 K4；MAIN-B 仍为 `EXECUTING`，下一项是 K5 先生反馈闭环。
