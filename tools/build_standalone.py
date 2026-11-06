"""Bundle the current sources for opening/downloading a single HTML file."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
html = (root / 'tools/page.template.html').read_text()
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + (root / 'style.css').read_text() + '\n</style>')
for name in ['model.js', 'app.js']:
    html = html.replace(f'<script src="{name}"></script>', '<script>\n' + (root / name).read_text() + '\n</script>')
html = html.replace('ПРОСТРАНСТВО ДЛЯ МЫСЛЕЙ', 'ПРОСТРАНСТВО ДЛЯ МЫСЛЕЙ · 0.1.15')
(root / 'FreeMindAgain.html').write_text(html)
(root / 'index.html').write_text(html)
print('Built FreeMindAgain.html (0.1.15)')
