"""Build a self-contained static page with Python 3; no dependencies."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
shell = (root / 'src/shell.html').read_text(encoding='utf-8')
app = (root / 'src/roadbook.html').read_text(encoding='utf-8')
assert shell.count('<!--ROADBOOK_APP-->') == 1
assert '__GX_DATA__' not in app
output = shell.replace('<!--ROADBOOK_APP-->', app)
(root / 'index.html').write_text(output, encoding='utf-8')
print('Built index.html:', len(output.encode('utf-8')), 'bytes')
