"""Package the offline app and emit a SHA-256 checksum."""
import hashlib
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
out = root / 'dist'
out.mkdir(exist_ok=True)
zipfile = out / 'github-Atlas-v0.1.0-portable.zip'
paths = ['README.md', 'LICENSE', 'Start GitHub Atlas.cmd',
         'app/index.html', 'app/style.css', 'app/main.js', 'app/catalog.js']
with ZipFile(zipfile, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for item in paths:
        archive.write(root / item, 'github-Atlas-v0.1.0/' + item)
with ZipFile(zipfile) as archive:
    assert archive.testzip() is None
digest = hashlib.sha256(zipfile.read_bytes()).hexdigest()
(out / 'SHA256SUMS.txt').write_text(digest + '  ' + zipfile.name + '\n', encoding='ascii')
print(zipfile, zipfile.stat().st_size, digest)
