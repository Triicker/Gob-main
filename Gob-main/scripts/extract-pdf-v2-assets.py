"""Extract six original embedded photographs, without editing their pixels.

Usage: python scripts/extract-pdf-v2-assets.py /path/to/reference.pdf
Requires PyMuPDF. Existing equivalent images must be reused, not extracted.
"""
import sys
from pathlib import Path
import pymupdf

root = Path(__file__).resolve().parents[1]
target = root / 'img/pdf-v2'
target.mkdir(parents=True, exist_ok=True)
document = pymupdf.open(sys.argv[1])
blocks = {b['number']: b for b in document[1].get_text('dict')['blocks'] if b['type'] == 1}
for number, name in {75:'pilar-escola',80:'pilar-familia',85:'pilar-comunidade',135:'noticia-band',136:'noticia-maria-da-penha',138:'noticia-jornal'}.items():
    block = blocks[number]
    if block['ext'] != 'jpeg':
        raise ValueError('Reference changed: expected original JPEG')
    output = target / (name + '.jpg')
    output.write_bytes(block['image'])
    print(output.name, block['width'], block['height'])
