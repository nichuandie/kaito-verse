from pathlib import Path

root = Path(__file__).resolve().parents[2]
ext = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
for folder in [root / "歌曲", root / "website" / "music", root / "website" / "assets"]:
    if not folder.is_dir():
        continue
    print("===", folder.relative_to(root).as_posix(), "===")
    for p in sorted(folder.iterdir()):
        if p.is_file():
            print(p.name, p.suffix.lower())
