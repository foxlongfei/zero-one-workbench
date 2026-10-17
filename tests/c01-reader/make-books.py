from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED
p=Path('tests/c01-reader/fixtures')
p.mkdir(parents=True,exist_ok=True)
(p/'real-book.txt').write_text('第一章 早晨\\n'+'太阳升起。'*600+'\\n第二章 夜晚\\n'+'月亮出现。'*600,encoding='utf-8')
with ZipFile(p/'real-book.epub','w') as z:
    z.writestr('mimetype','application/epub+zip',compress_type=ZIP_STORED)
    z.writestr('META-INF/container.xml','<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    z.writestr('OEBPS/content.opf','''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">test-book-001</dc:identifier><dc:title>实际章节测试书</dc:title><dc:language>zh-CN</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>''')
    z.writestr('OEBPS/nav.xhtml','''<html xmlns="http://www.w3.org/1999/xhtml"><head><title>目录</title></head><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol><li><a href="c1.xhtml">第一章 早晨</a></li><li><a href="c2.xhtml">第二章 夜晚</a></li></ol></nav></body></html>''')
    for n,title,body in [(1,'第一章 早晨','太阳升起。'),(2,'第二章 夜晚','月亮出现。')]:
        z.writestr(f'OEBPS/c{n}.xhtml',f'<html xmlns="http://www.w3.org/1999/xhtml"><head><title>{title}</title></head><body><h1>{title}</h1><p>{body*70}</p></body></html>')
print('Created real UTF-8 TXT and valid EPUB with navigation and two chapters')
