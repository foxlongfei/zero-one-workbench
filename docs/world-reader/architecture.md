# 《听世界 · 世界读本》V0.1 协作架构

**决策日期：** 2026-10-29  
**状态：** Drive 主目录与八个子目录已由项目方实际创建；当前 Codespace 尚未授权访问。

## 平台职责

Google Drive 是内容资料库与出版档案的权威存储，保存媒体来源、文章资料、图片与许可凭据、中文编辑稿、获准发布的 EPUB、每日刊物及发布/邮件记录。

GitHub 管理程序、自动化、版本、测试、公开网站和邮件发送流程。GitHub Pages 只包含经来源核验、版权许可核验并明确允许公开传播的内容。Drive 与 GitHub 分工不同，不是互相镜像的备份。

Drive 中的编辑资料不得因构建或调试自动进入公开产物。公开构建只接收已审核的发布清单；来源未核验、许可缺失或范围不覆盖中文内容时，构建必须失败关闭。图片还须分别具备创作者、来源、权利人、许可依据和修改状态；“注明来源”不等于获得使用权。

## Drive 工作空间

主目录：[听世界 · 世界读本](https://drive.google.com/drive/folders/12O5y1hKagYrmo55jDV4-UStP0LUsPO3_)

以下八个目录已经由项目方创建；代码只核验它们，不会尝试重建：

```text
世界读本/
├─ 00-项目规范/
├─ 01-媒体来源/
├─ 02-文章与原文/
├─ 03-图片与版权/
├─ 04-中文编辑稿/
├─ 05-每日刊物/
├─ 06-EPUB归档/
└─ 07-发布与邮件记录/
```

## GitHub 工作空间

```text
zero-one-workbench/
├─ portal/world-reader/       # 仅已批准的公开页面、期刊和下载文件
├─ scripts/world-reader/      # Drive 核验、构建、发布和邮件流程
├─ tests/world-reader/        # 自动化测试
├─ docs/world-reader/         # 架构、操作与验收文档
└─ .github/workflows/         # 定时及手动工作流
```

`portal/world-reader/issues/index.json` 是公开刊物索引，不是 Drive 编辑资料库。未批准文章、原文全文、许可文件和未发布 EPUB 不得放入 `portal/`。当前公开索引为空。

## 每日发布门禁

1. 发现候选并记录媒体、所属地区、作者、原文标题、日期、永久链接及内容类型。
2. 人工核验来源、事实类别、转载/翻译许可范围及每张图片的独立许可。
3. 生成并审核中文稿，标明原创摘要、机器翻译、人工翻译或编辑评论。
4. 从获批清单生成 EPUB；检查目录、文章来源、图片署名索引和文件可读性。
5. 发布获批页面与 EPUB；用公网地址验证页面、下载和内容版本。
6. 只有页面和 EPUB 均验证成功才发送邮件，并保存发送状态。

任何前置环节失败都不得发邮件。重试应沿用稳定的期刊 ID 和收件人幂等键；已成功投递的同一收件人不得重复发送。人工重发必须显式记录原因与操作人。

## 安全授权

### Codespaces 交互开发

当前建议先用只读目录核验器确认 API 授权，不读取文章正文、不改动 Drive 内容。核验器只申请 `drive.metadata.readonly` scope。

1. 在 Google Cloud 项目中启用 Google Drive API，并配置 OAuth consent screen；只允许专用项目账号使用。
2. 将 Drive 主目录分享给该专用账号。不要使用存有私人文件的个人主账号作为自动化身份。
3. 在 Codespaces 终端安装并配置 Google Cloud CLI，然后在终端直接运行：

   ```sh
   gcloud auth application-default login --no-launch-browser --scopes=https://www.googleapis.com/auth/drive.metadata.readonly
   ```

5. 在仓库终端安装锁定依赖，再运行只读目录核验：

    ```sh
    npm ci --prefix scripts/world-reader
    WORLD_READER_DRIVE_ROOT_ID=12O5y1hKagYrmo55jDV4-UStP0LUsPO3_ npm --prefix scripts/world-reader run drive:verify
    ```

    命令只检查八个目录是否存在且不重复，不会列出文件名、读取文件内容或修改 Drive。
5. 设置 `WORLD_READER_DRIVE_ROOT_ID=12O5y1hKagYrmo55jDV4-UStP0LUsPO3_`，安装 `scripts/world-reader/` 的依赖，再运行 `npm run drive:verify`。
6. 核验结束后可在 Google 账号安全设置撤销授权。ADC 文件位于用户配置目录，不属于仓库内容；不要复制到项目或 GitHub Secrets。

若 OAuth consent screen 处于 Testing，只把专用账号加入 test users。Drive API 范围仅限只读元数据；当前脚本只查询主目录和八个子目录名称，不下载或上传文件。

### GitHub Actions 自动化

正式定时流程应使用 Google Workload Identity Federation（WIF）和无密钥的短期服务账号 impersonation，不创建或上传 service-account JSON 私钥。由仓库管理员在 Cloud 项目中启用 Drive API、创建 WIF pool/provider，只信任本仓库指定分支与指定 workflow 的 GitHub OIDC subject，为专用服务账号授予必要权限，并把 Drive 主目录仅分享给该服务账号。Provider 名称、service-account email 和 Drive folder ID 可作为 GitHub Actions variables；长期私钥不得进入 secrets、代码或日志。

发布归档权限应与只读核验身份分开。Drive 上传范围须被服务账号对主目录的 ACL 限定。邮件服务凭据另存 GitHub Actions secrets；测试收件人需先获授权，邮件步骤仅能在公网页面及 EPUB 验证成功后运行。

## 试运行与当前限制

首轮以授权测试邮箱连续运行七天。每天记录发现量、纳入/拒绝理由、人工版权核验、生成时间、费用、发布结果和邮件投递结果；每周汇总失败、内容质量和来源覆盖；每月复核媒体目录与运行成本并归档。

记录必须区分自动测试、人工实际操作和未验证事项。测试通过不能代替人工许可确认；HTTP 200 不能代替 EPUB 阅读验证；工作流成功不能代替真实邮件送达证明。

Drive 目录已创建，但 Codespace 目前无 Drive API 身份；定时任务、公开期刊、获批 EPUB、邮件服务和七日试运行均未配置或执行。未授权候选不进入 GitHub Pages。