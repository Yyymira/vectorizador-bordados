"""Arma index.html (un solo archivo, sin dependencias) a partir de src/ui.html y src/engine.js."""
import pathlib

root = pathlib.Path(__file__).parent
ui = (root / 'src' / 'ui.html').read_text(encoding='utf-8')
engine = (root / 'src' / 'engine.js').read_text(encoding='utf-8')
assert '/*ENGINE*/' in ui, 'falta el marcador /*ENGINE*/ en src/ui.html'
ui = ui.replace('/*ENGINE*/', engine)
cut = ui.index('<div class="wrap">')
head, body = ui[:cut].strip(), ui[cut:].strip()
html = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head + '\n</head>\n<body>\n' + body + '\n</body>\n</html>\n')
(root / 'index.html').write_text(html, encoding='utf-8')
print(f'index.html listo ({len(html.encode()) // 1024} KB)')
