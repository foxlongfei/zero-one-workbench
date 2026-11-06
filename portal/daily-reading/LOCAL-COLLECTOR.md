# 每天读世界｜V0.3 本地全文采集试验

公开 GitHub Pages 只展示文章信息和原站链接；**版权受限的原文及私人译文只保存在本地**。

## 安装
```bash
python3 -m venv .venv
. .venv/bin/activate
pip install trafilatura argostranslate
python -c "import argostranslate.package as p; p.update_package_index(); a=[x for x in p.get_available_packages() if x.from_code=='en' and x.to_code=='zh']; assert a; p.install_from_path(a[0].download())"
python collector.py 'https://ourworldindata.org/much-better-awful-can-be-better' --translate
```
首次模型安装需要联网，之后翻译离线运行。每篇文章保存 original.txt、zh.txt、metadata.json，含作者、来源、发表日期（若可提取）、采集时间及 SHA256。**完整性仍需核验**，尤其注释、公式、图表。没有登录绕过、自动邮件、定时采集；不要上传本地全文缓存到公开仓库。Argos 译文须对照原文。

## 私人阅读笔记（2026-11-06）
阅读页面新增每篇文章独立笔记，浏览器 localStorage 保存。支持 JSON 导出/导入（同 URL 覆盖需确认）和 Markdown 导出。浏览器间不自动同步，导出文件需要用户自行备份。笔记不会提交到公开 GitHub。

## 翻译引擎约束
当前本地 CLI 使用 Argos Translate（开源 MIT/CC0，离线英中模型）。模型需要首次安装，译文质量尚未实测。备用可评估 Helsinki-NLP/opus-mt-en-zh（Apache-2.0），但需要额外依赖与资源，不能宣称已集成。保留原文、译文和来源三者分离，避免机器翻译覆盖作者原意。
