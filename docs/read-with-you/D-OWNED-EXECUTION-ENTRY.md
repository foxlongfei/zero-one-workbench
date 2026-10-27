# 陪你读书 V0.3｜D 博士自主执行入口（技术连接说明）

唯一有效任务：[GitHub Issue #42](https://github.com/foxlongfei/zero-one-workbench/issues/42)。

## 目的与职责

本文件仅记录将 DeepSeek 模型连接到一个可直接操作 Git 仓库的开发环境的方法，**不是产品需求、开发指令、自动化任务或 D 博士已开工的证明**。V0.3 的产品设计、开发、测试、合并、部署方案由 D 博士在独立会话中自行决定。C 博士仅在 D 博士明确提出技术故障时协助排障。

## 推荐的独立执行入口：DeepSeek + OpenCode

官方资料：
- [DeepSeek 官方 OpenCode 接入指南](https://api-docs.deepseek.com/quick_start/agent_integrations/opencode/)
- [DeepSeek 官方 Agent 工具接入指南](https://api-docs.deepseek.com/guides/coding_agents/)

在用户自己控制的电脑或开发环境内：

1. 安装 Git 与 OpenCode（参考官方文档；建议 OpenCode ≥ 1.18.30）。
2. 在终端打开工作区，使用 `git clone https://github.com/foxlongfei/zero-one-workbench.git` 获取仓库，或进入已有仓库。
3. 在仓库目录运行 `opencode`；在界面输入 `/connect`，选择 `deepseek`，填入由用户自己掌握的 DeepSeek API Key，并选择 DeepSeek 模型。
4. 在 **DeepSeek 驱动的独立会话**中由用户直接提供 Issue #42 地址，并明确由 D 博士自行读取需求、决定行动。无需经过 C 博士的 GitHub Actions、代理提示词或 PR 编排。
5. GitHub 读权限来自本地 Git checkout；要推送或建立 PR，应由用户在该开发环境配置其自己的 GitHub 身份或最小权限凭据。不要把 DeepSeek API Key 或 GitHub token 写入仓库、Issue、PR、日志和脚本。
6. 该会话是否接到任务、具体的工作成果和发布结果，应以该会话与真实 Git commit、测试、发布记录核实。**仅启动 OpenCode 不表示 D 博士完成了任何开发**。

## 中立参考

- 原始运行：[Actions #40164992354](https://github.com/foxlongfei/zero-one-workbench/actions/runs/40164992354)
- 可读取的原始提交：[a663087](https://github.com/foxlongfei/zero-one-workbench/commit/a663087e376aeed6cf9a919f262caee728587c58)
- 历史 PR #65 / #66 均已关闭，**不构成必须遵循的技术路线**。

## 排障接口

若 D 博士独立会话遇到明确的 GitHub 认证/权限、push、CI、超时或发布基础设施错误，可将原始报错及运行链接交给 C 博士排障；不得借排障修改产品方案或自行启动开发。
