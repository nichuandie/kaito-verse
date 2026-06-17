"""
本地启动网站，并支持同一 WiFi 下其他设备访问。

用法:
  cd website
  python serve.py

然后在电脑/手机浏览器打开终端里打印的地址。
"""

from __future__ import annotations

import json
import socket
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

PORT = 8080
WEB_ROOT = Path(__file__).resolve().parent
AUDIO_EXT = {".mp3", ".m4a", ".wav", ".ogg", ".flac"}


def scan_music_tracks():
    music_dir = WEB_ROOT / "music"
    tracks = []
    if not music_dir.is_dir():
        return tracks
    for path in sorted(music_dir.iterdir()):
        if not path.is_file() or path.suffix.lower() not in AUDIO_EXT:
            continue
        stem = path.stem
        cover = None
        for ext in (".png", ".jpg", ".jpeg", ".webp"):
            candidate = music_dir / f"{stem}{ext}"
            if candidate.is_file():
                cover = f"./music/{candidate.name}"
                break
        entry = {
            "title": stem,
            "file": f"./music/{path.name}",
        }
        if cover:
            entry["cover"] = cover
        tracks.append(entry)
    return tracks


def local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


class KaitoVerseHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if unquote(parsed.path) == "/api/music-tracks.json":
            payload = {
                "title": "KAITO 歌曲",
                "subtitle": "点击曲目播放",
                "cover": "assets/characters/kaito-v3.png",
                "tracks": scan_music_tracks(),
            }
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()


def main() -> None:
    try:
        server = ThreadingHTTPServer(("0.0.0.0", PORT), KaitoVerseHandler)
    except OSError as exc:
        if getattr(exc, "winerror", None) == 10048 or exc.errno in (98, 10048):
            print(f"端口 {PORT} 已被占用。可能服务器已在运行。")
            print(f"请直接在浏览器打开: http://127.0.0.1:{PORT}")
            print("若要重启，请先关闭占用该端口的终端窗口。")
            return
        raise
    ip = local_ip()

    print("KAITO Verse 本地服务器已启动")
    print(f"  本机访问:   http://127.0.0.1:{PORT}")
    print(f"  局域网访问: http://{ip}:{PORT}")
    print("同一 WiFi 下的手机/平板/其他电脑可使用「局域网访问」地址")
    print("按 Ctrl+C 停止")

    try:
        webbrowser.open(f"http://127.0.0.1:{PORT}")
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
