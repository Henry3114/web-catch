from pathlib import Path
import json,zipfile
ROOT=Path(__file__).resolve().parent
def build():
 manifest=json.loads((ROOT/'extension/manifest.json').read_text())
 out=ROOT/'dist'/f'51job-fixed-{manifest["version"]}.zip';out.parent.mkdir(exist_ok=True)
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
  for p in sorted((ROOT/'extension').iterdir()):z.write(p,'51job-fixed/extension/'+p.name)
  z.write(ROOT/'README.md','51job-fixed/README.md')
 with zipfile.ZipFile(out) as z:assert z.testzip() is None
 return out
if __name__=='__main__':print(build())
