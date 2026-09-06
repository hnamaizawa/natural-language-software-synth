from __future__ import annotations

import json
import mimetypes
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
sys.path.insert(0, str(ROOT / "src"))

from ai_synth.prompt_engine import generate_patch  # noqa: E402
from ai_synth.patch import validate_patch  # noqa: E402

HOST = "127.0.0.1"
PORT = 8765


class Handler(BaseHTTPRequestHandler):
    server_version = "NaturalLanguageSynth/0.3"

    def _json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            return self._json({"ok": True, "version": "0.3.0"})
        rel = unquote(parsed.path.lstrip("/")) or "index.html"
        target = (WEB / rel).resolve()
        try:
            target.relative_to(WEB.resolve())
        except ValueError:
            return self.send_error(HTTPStatus.FORBIDDEN)
        if not target.is_file():
            return self.send_error(HTTPStatus.NOT_FOUND)
        data = target.read_bytes()
        content_type, _ = mimetypes.guess_type(str(target))
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        parsed = urlparse(self.path)
        length = min(int(self.headers.get("Content-Length", "0") or 0), 64_000)
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._json({"error": "invalid json"}, HTTPStatus.BAD_REQUEST)

        if parsed.path == "/api/generate-patch":
            prompt = str(payload.get("prompt", ""))[:500]
            patch = generate_patch(prompt)
            return self._json({"patch": patch.to_dict(), "engine": "offline-deterministic-v0.3"})
        if parsed.path == "/api/validate-patch":
            try:
                patch = validate_patch(payload.get("patch", {}))
            except (TypeError, ValueError) as exc:
                return self._json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return self._json({"patch": patch.to_dict()})
        return self.send_error(HTTPStatus.NOT_FOUND)

    def log_message(self, fmt, *args):
        print(f"[synth] {self.address_string()} - {fmt % args}")


def main():
    print("Natural Language Software Synth v0.3.0")
    print(f"Open http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
