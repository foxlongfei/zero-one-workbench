#!/usr/bin/env python3
"""生成「陪你读书」内置试读 EPUB。

本仓库原创测试文本，仅用于验证 EPUB 解析、整书朗读、目录跳转与进度记忆，
不含任何第三方受版权保护的内容。运行后产物写入
portal/test-books/zero-one-whole-book.epub。

用法：python3 scripts/build-demo-epub.py
"""

from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "portal" / "test-books" / "zero-one-whole-book.epub"

TITLE = "零一·整书朗读试读"
AUTHOR = "零一空间"

CHAPTERS = [
    (
        "第一章 清晨",
        [
            "这是项目原创的电子书测试文本，用来验证 EPUB 目录、整书连续朗读与进度记忆。",
            "风从窗外吹来。我们在书页里寻找新的问题，也寻找愿意一起读书的人。",
            "读到这里，请观察朗读是否能够自然继续到下一段，并且高亮跟随句子移动。",
            "清晨的光线落在桌面上，一杯温水，一本翻开的书，就足够开始一天。",
        ],
    ),
    (
        "第二章 小路",
        [
            "这是第二章。请检查整书连续朗读是否自动跨过章节边界。",
            "小路上有细碎的影子。走慢一点，才看得清脚边的野花。",
            "第二章结束后，请关闭页面再重新打开这本书，检查阅读进度是否被保留。",
        ],
    ),
    (
        "第三章 归来",
        [
            "这是第三章，也是最后一章。这里用于验证整书播放终止时是否正确停止并标记读完。",
            "回到家时天已经暗了。把书放回书架，明天再接着读。",
            "测试文本为项目原创，可用于软件功能测试、录音授权说明与朗读演示。",
        ],
    ),
]


def chapter_html(index: int, title: str, paragraphs) -> str:
    body = "\n".join(f"    <p>{p}</p>" for p in paragraphs)
    return f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>{title}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <section epub:type="chapter" xmlns:epub="http://www.idpf.org/2007/ops">
    <h1>{title}</h1>
{body}
  </section>
</body>
</html>
"""


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    files = []
    nav_items = []
    spine_items = []
    for i, (title, paragraphs) in enumerate(CHAPTERS, start=1):
        name = f"chapter{i}.xhtml"
        files.append((f"OEBPS/{name}", chapter_html(i, title, paragraphs)))
        nav_items.append(f'        <li><a href="{name}">{title}</a></li>')
        spine_items.append(f'    <itemref idref="chapter{i}" />')

    nav = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
<head><meta charset="utf-8" /><title>目录</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目录</h1>
    <ol>
{chr(10).join(nav_items)}
    </ol>
  </nav>
</body>
</html>
"""

    manifest = "\n".join(
        f'    <item id="chapter{i}" href="chapter{i}.xhtml" media-type="application/xhtml+xml" />'
        for i in range(1, len(CHAPTERS) + 1)
    )

    opf = f"""<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:zero-one-demo-reader-book</dc:identifier>
    <dc:title>{TITLE}</dc:title>
    <dc:creator>{AUTHOR}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:rights>本仓库原创测试文本，可自由用于本项目功能测试。</dc:rights>
    <meta property="dcterms:modified">2026-10-24T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="style" href="style.css" media-type="text/css" />
{manifest}
  </manifest>
  <spine>
{chr(10).join(spine_items)}
  </spine>
</package>
"""

    container = """<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>
"""

    style = "body{font-family:Georgia,serif;line-height:1.9}p{margin:0 0 1em;text-indent:2em}h1{font-size:1.3em}\n"

    with zipfile.ZipFile(OUT, "w") as zf:
        zf.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        zf.writestr("META-INF/container.xml", container, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr("OEBPS/content.opf", opf, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr("OEBPS/nav.xhtml", nav, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr("OEBPS/style.css", style, compress_type=zipfile.ZIP_DEFLATED)
        for path, content in files:
            zf.writestr(path, content, compress_type=zipfile.ZIP_DEFLATED)

    print(f"written {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
