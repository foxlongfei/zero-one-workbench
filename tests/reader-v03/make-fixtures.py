#!/usr/bin/env python3
"""Fixtures for the V0.3 reader browser test.

Two books, both original text written for this repository (no third-party
content): a TXT with Chinese chapter headings and a 3-chapter EPUB with a cover
and a navigation document. Generated locally, never committed as binaries.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED, ZIP_DEFLATED

out = Path('tests/reader-v03/fixtures')
out.mkdir(parents=True, exist_ok=True)

chapters = [
    ('第一章 清晨', ['天刚亮的时候，小院的竹门被风轻轻推开。', '雨后的石阶上留着浅浅的水痕。', '她把昨夜的疑问写在纸上，决定今天去问图书管理员。']),
    ('第二章 午后', ['图书馆的窗很高，光线落在长桌上。', '管理员说，书里的问题不必急着回答。', '她合上书，听见远处有人在练习长笛。']),
    ('第三章 夜晚', ['回到家，她在灯下把白天的发现读给家人听。', '家人没有打断她，只在每一段之后安静地点头。', '灯灭之前，她把最后一句读了两遍。']),
]

txt = '\n'.join(f"{title}\n" + '\n\n'.join(paras) for title, paras in chapters)
(out / 'morning.txt').write_text(txt, encoding='utf-8')

with ZipFile(out / 'quiet-house.epub', 'w') as z:
    z.writestr('mimetype', 'application/epub+zip', compress_type=ZIP_STORED)
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', compress_type=ZIP_DEFLATED)
    manifest = ''.join(f'<item id="c{n}" href="c{n}.xhtml" media-type="application/xhtml+xml"/>' for n in range(1, 4))
    spine = ''.join(f'<itemref idref="c{n}"/>' for n in range(1, 4))
    z.writestr('OEBPS/content.opf', f'''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">read-with-you-v03-fixture</dc:identifier>
<dc:title>安静的房子</dc:title><dc:creator>零一编辑部</dc:creator><dc:language>zh-CN</dc:language>
</metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="cover" href="cover.svg" media-type="image/svg+xml" properties="cover-image"/>{manifest}</manifest>
<spine>{spine}</spine></package>''', compress_type=ZIP_DEFLATED)
    z.writestr('OEBPS/cover.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#315747"/><text x="300" y="400" fill="#fff9eb" font-size="52" text-anchor="middle" font-family="serif">安静的房子</text></svg>', compress_type=ZIP_DEFLATED)
    items = ''.join(f'<li><a href="c{n}.xhtml">{title}</a></li>' for n, (title, _) in enumerate(chapters, 1))
    z.writestr('OEBPS/nav.xhtml', f'<html xmlns="http://www.w3.org/1999/xhtml"><head><title>目录</title></head><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol>{items}</ol></nav></body></html>', compress_type=ZIP_DEFLATED)
    for n, (title, paras) in enumerate(chapters, 1):
        body = ''.join(f'<p>{p}</p>' for p in paras)
        z.writestr(f'OEBPS/c{n}.xhtml', f'<html xmlns="http://www.w3.org/1999/xhtml"><head><title>{title}</title></head><body><h1>{title}</h1>{body}</body></html>', compress_type=ZIP_DEFLATED)
    z.writestr('OEBPS/broken.xhtml', '<html><body><p>不进入 spine 的额外文件</p></body></html>', compress_type=ZIP_DEFLATED)

print(f'wrote {out}/morning.txt and {out}/quiet-house.epub')
