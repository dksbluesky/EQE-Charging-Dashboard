"""Local-only EQE charging dashboard server.
Serves the static app and the newest JSON backup from the PC raw-data folder.
"""
from __future__ import annotations

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

APP_ROOT = Path(__file__).resolve().parent
RAW_DATA_DIR = Path(r"D:\AI application code\EQE")
HOST = "127.0.0.1"
PORT = 8744


def latest_backup() -> Path:
    backups = sorted(
        RAW_DATA_DIR.glob("eqe-charging-backup-*.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not backups:
        raise FileNotFoundError(f"No EQE backup JSON found in {RAW_DATA_DIR}")
    return backups[0]


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_ROOT), **kwargs)

    def do_GET(self):
        if urlparse(self.path).path == "/api/records":
            self.send_records()
            return
        super().do_GET()

    def send_records(self):
        try:
            source = latest_backup()
            records = json.loads(source.read_text(encoding="utf-8"))
            if not isinstance(records, list):
                raise ValueError("Backup root must be a JSON list")
            payload = json.dumps(
                {"source": source.name, "records": records},
                ensure_ascii=False,
            ).encode("utf-8")
        except (OSError, ValueError, json.JSONDecodeError) as error:
            payload = json.dumps({"error": str(error)}, ensure_ascii=False).encode("utf-8")
            self.send_response(HTTPStatus.INTERNAL_SERVER_ERROR)
        else:
            self.send_response(HTTPStatus.OK)

        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def main():
    if not RAW_DATA_DIR.is_dir():
        raise SystemExit(f"Raw-data folder not found: {RAW_DATA_DIR}")
    print(f"EQE dashboard PC mode: http://{HOST}:{PORT}")
    print(f"Raw-data folder: {RAW_DATA_DIR}")
    with ThreadingHTTPServer((HOST, PORT), DashboardHandler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()