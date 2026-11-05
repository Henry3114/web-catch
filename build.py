"""Build the independent extension and a single offline trial HTML, no npm required."""
from pathlib import Path
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parent
EXT = ROOT / 'extension'


def build():
    manifest = json.loads((EXT / 'manifest.json').read_text())
    (EXT / 'VERSION.txt').write_text('网页采集工作台 '+manifest['version']+'\n此文件、manifest.json 与其它扩展文件应放在 Chrome 实际加载的同一个 extension 目录。\n覆盖后到 chrome://extensions 重新加载，并刷新职位列表与详情页。\n',encoding='utf-8')
    assert manifest['name'] == '网页采集工作台 · 独立试用版'
    for name in [manifest['background']['service_worker'], manifest['side_panel']['default_path'], manifest['options_ui']['page']]:
        assert (EXT / name).is_file()
    html = (EXT / 'demo.html').read_text()
    html = html.replace('<link rel="stylesheet" href="studio.css">', '<style>' + (EXT / 'studio.css').read_text() + '</style>')
    html = re.sub(r'<script src="([\w.-]+)"></script>', lambda match: '<script>\n' + (EXT / match[1]).read_text().replace('</script', '<\\/script') + '\n</script>', html)
    assert '<script src=' not in html and 'rel="stylesheet"' not in html
    (ROOT / '试玩.html').write_text(html, encoding='utf-8')
    out = ROOT / 'dist' / f'visual-page-collector-{manifest["version"]}.zip'
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(EXT.iterdir()):
            if file.is_file(): archive.write(file, 'visual-page-collector/extension/' + file.name)
        archive.write(ROOT / '试玩.html', 'visual-page-collector/试玩.html')
        if (ROOT / 'README.md').exists(): archive.write(ROOT / 'README.md', 'visual-page-collector/README.md')
    with zipfile.ZipFile(out) as archive:
        assert archive.testzip() is None
    return out


if __name__ == '__main__':
    print(build())
