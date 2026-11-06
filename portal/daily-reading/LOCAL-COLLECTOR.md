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
