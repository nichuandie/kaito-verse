import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[2]
audio_src = root / "歌曲"
cover_src = root / "图片"
dst_dir = root / "website" / "music"
dst_dir.mkdir(parents=True, exist_ok=True)

audio_ext = {".mp3", ".m4a", ".wav", ".ogg", ".flac"}
cover_ext = {".png", ".jpg", ".jpeg", ".webp"}

if audio_src.is_dir():
    for path in sorted(audio_src.iterdir()):
        if path.is_file() and path.suffix.lower() in audio_ext:
            shutil.copy2(path, dst_dir / path.name)
            print("audio", path.name)

if cover_src.is_dir() and audio_src.is_dir():
    stems = {p.stem for p in audio_src.iterdir() if p.is_file() and p.suffix.lower() in audio_ext}
    for path in sorted(cover_src.iterdir()):
        if path.is_file() and path.suffix.lower() in cover_ext and path.stem in stems:
            shutil.copy2(path, dst_dir / path.name)
            print("cover", path.name)
elif cover_src.is_dir():
