# 零一空间｜三项目统一运行与发布规则
2026-10-12｜适用：A01 动起来、B01 住宅研究、C01 陪你读书

## 唯一统一入口
portal/index.html → portal/engineering-console.html#three-projects。工程台以公开GitHub Issues/PR/Actions为事实来源；不因看板展示而改变任务状态。A01/B01沿用原有Issue #3及其PR和验证门；C01采用RW-00至RW-04，保留历史编号，不以新任务覆盖旧阻塞。

## 施工单/台账必填字段
project_id, task_id, description, owner_role, actual_executor, model_provider_evidence, issue_url, branch, commit_sha, pr_url, workflow_run, browser_test, audio_listening_review（如适用）, public_url, public_readback, licensing_review, cost_log, status, blocker, next_action, accepted_by, accepted_at。
状态：TODO / IN_PROGRESS / BLOCKED / REVIEW / ACCEPTED。只有执行且人工核对证据后才ACCEPTED。GitHub Issue关闭不自动等于验收。

## 三项目共用发布门（不得豁免）
G0 可追溯来源/许可/设计输入；G1真实代码或音频实物、执行者证据；G2 CI通过及失败项留痕；G3真实浏览器运行（C01须实际音频播放与试听）；G4经人工审查的PR合并；G5 GitHub Pages或明确云端部署成功、公开HTTPS URL外部读回；G6 CURRENT/Drive认知同步与验收台账更新。任一未过只标记候选/待发布，不得写成正式上线。
对C01额外要求：文本版本/音频来源/参考声音授权、儿童与老人适用性、配乐与人声清晰度、费用证据。不得发布未经审核的可识别第三方仿声。

## 三博士真实执行
C负责统筹与验收；Q负责前端；D负责音频模型。任务分配不是实际模型调用；若模型/工作流未接通，标记BLOCKED_PROVIDER。所有自动生成PR保持人工审查，禁止未经授权自动合并。任何云端成本和权限变更需事先确认。

## 现状（本文件建立时）
C01文档/Issue已建立；portal页面更新在PR #14独立分支，未合并，未公开读回。A01/B01原状态以其各自任务和运行证据为准，不能被C01开发改变。三项目控制台为只读运行视图，不是独立的可写任务系统。
