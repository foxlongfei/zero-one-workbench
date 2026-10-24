"""Fixtures for the read-with-you browser suite.

Everything here is generated: no real books, no copyrighted text. The EPUB is
built by hand so the test can assert on a table of contents it fully controls.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / 'fixtures'
FIXTURES.mkdir(parents=True, exist_ok=True)

FRONT = '序\n这是一个测试用的家读书稿，用来验证导入、目录与连续朗读。\n'
CHAPTERS = [
    ('第一章 清晨', '天还没亮，屋檐下的风铃先醒了。她翻到下一页，念给还没起床的孩子听。'),
    ('第二章 午后', '阳光斜斜地铺在桌面上，茶杯里的热气慢慢散开，像一句没说完的话。'),
    ('第三章 夜里', '灯熄之后，故事还在继续，声音顺着走廊一直延伸到窗边。'),
]

# Plain UTF-8 text with headings the reader should turn into chapters.
txt = FRONT + ''.join(f'{title}\n{body * 12}\n' for title, body in CHAPTERS)
(FIXTURES / 'sample.txt').write_text(txt, encoding='utf-8')

# The same manuscript in GB18030: exercises legacy Chinese encoding detection.
(FIXTURES / 'sample-gb18030.txt').write_bytes(txt.encode('gb18030'))

# Blank file: must be refused rather than added as an empty book.
(FIXTURES / 'blank.txt').write_text(' \n\t \n', encoding='utf-8')

epub = FIXTURES / 'sample.epub'
with ZipFile(epub, 'w') as z:
    z.writestr('mimetype', 'application/epub+zip', compress_type=ZIP_STORED)
    z.writestr(
        'META-INF/container.xml',
        '<?xml version="1.0"?><container version="1.0" '
        'xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>'
        '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>'
        '</rootfiles></container>',
    )
    manifest = ''.join(
        f'<item id="c{i}" href="c{i}.xhtml" media-type="application/xhtml+xml"/>'
        for i in range(1, len(CHAPTERS) + 1)
    )
    spine = ''.join(f'<itemref idref="c{i}"/>' for i in range(1, len(CHAPTERS) + 1))
    z.writestr(
        'OEBPS/content.opf',
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">'
        '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
        '<dc:identifier id="uid">rwy-sample-001</dc:identifier>'
        '<dc:title>家读样章</dc:title><dc:creator>零一</dc:creator><dc:language>zh-CN</dc:language>'
        '</metadata><manifest>'
        '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
        f'{manifest}</manifest><spine>{spine}</spine></package>',
    )
    links = ''.join(f'<li><a href="c{i}.xhtml">{CHAPTERS[i - 1][0]}</a></li>' for i in range(1, len(CHAPTERS) + 1))
    z.writestr(
        'OEBPS/nav.xhtml',
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">'
        f'<head><title>目录</title></head><body><nav epub:type="toc"><ol>{links}</ol></nav></body></html>',
    )
    for i, (title, body) in enumerate(CHAPTERS, start=1):
        paragraphs = ''.join(f'<p>{body}</p>' for _ in range(8))
        z.writestr(
            f'OEBPS/c{i}.xhtml',
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<html xmlns="http://www.w3.org/1999/xhtml"><head>'
            f'<title>{title}</title></head><body><h1>{title}</h1>{paragraphs}</body></html>',
        )

print(f'wrote fixtures to {FIXTURES}')
