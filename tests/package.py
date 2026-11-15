"""Buildless release packaging: copy exactly the audited offline assets."""
from pathlib import Path
import re
import shutil
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'work' / 'site'
DEST.mkdir(parents=True, exist_ok=True)
paths = set(re.findall(r"'\./([^']*)'", (ROOT / 'sw.js').read_text())) - {''}
paths.update({'sw.js', 'LICENSE'})
for relative in sorted(paths):
    source = ROOT / relative
    target = DEST / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
(DEST / '.nojekyll').touch()
print(f'Packaged {len(paths)} local files into {DEST}')
