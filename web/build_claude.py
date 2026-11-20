"""Genera web/hierro-claude.html (versión publicada en Claude) a partir de Index.html."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / 'Index.html').read_text(encoding='utf-8')
for tag in ['<!DOCTYPE html>', '<html lang="es">', '<head>', '</head>', '<body>', '</body>', '</html>', '<base target="_top">', '<meta charset="utf-8">']:
    assert tag in s, tag
    s = s.replace(tag, '', 1)
s = '<title>HIERRO</title>\n' + s.strip() + '\n'
(root / 'web' / 'hierro-claude.html').write_text(s, encoding='utf-8')
print('ok', len(s))
