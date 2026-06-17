import os
from pathlib import Path

root = Path(__file__).resolve().parents[2]
ext = {".mp3", ".m4a", ".wav", ".ogg", ".flac"}
for path in sorted(root.rglob("*")):
    if path.is_file() and path.suffix.lower() in ext:
        print(path.relative_to(root).as_posix())
