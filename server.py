from __future__ import annotations

import atexit
import hashlib
import json
import mimetypes
import os
import subprocess
import sys
import threading
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


class Vst3Bridge:
    """Local-only bridge to the separately built native VST3 host process."""

    MAX_PLUGINS = 256
    MAX_PROTOCOL_LINES = 64
    CONTROL_PREFIX = "NLSS_JSON\t"

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._process: subprocess.Popen[str] | None = None
        self._plugins: dict[str, Path] = {}
        self._loaded_plugin_id: str | None = None

    def _candidate_host_paths(self) -> list[Path]:
        configured = os.environ.get("NLSS_VST3_HOST", "").strip()
        candidates: list[Path] = []
        if configured:
            candidates.append(Path(configured).expanduser())
        candidates.extend(
            [
                ROOT / "native" / "vst3_host" / "build" / "Release" / "nlss_vst3_host.exe",
                ROOT / "native" / "vst3_host" / "build" / "nlss_vst3_host.exe",
                ROOT / "native" / "vst3_host" / "out" / "build" / "x64-Release" / "nlss_vst3_host.exe",
            ]
        )
        return candidates

    def host_executable(self) -> Path | None:
        for candidate in self._candidate_host_paths():
            try:
                if candidate.is_file():
                    return candidate.resolve()
            except OSError:
                continue
        return None

    def _scan_roots(self) -> list[Path]:
        roots: list[Path] = []
        common = os.environ.get("COMMONPROGRAMFILES")
        program_files = os.environ.get("ProgramFiles")
        local = os.environ.get("LOCALAPPDATA")
        if common:
            roots.append(Path(common) / "VST3")
        elif program_files:
            roots.append(Path(program_files) / "Common Files" / "VST3")
        if local:
            roots.append(Path(local) / "Programs" / "Common" / "VST3")
        extra = os.environ.get("NLSS_VST3_PATHS", "")
        for item in extra.split(os.pathsep):
            if item.strip():
                roots.append(Path(item.strip()).expanduser())

        unique: list[Path] = []
        seen: set[str] = set()
        for root in roots:
            try:
                resolved = root.resolve()
            except OSError:
                continue
            key = os.path.normcase(str(resolved))
            if key not in seen:
                seen.add(key)
                unique.append(resolved)
        return unique

    @staticmethod
    def _plugin_id(path: Path) -> str:
        key = os.path.normcase(str(path)).encode("utf-8", errors="surrogatepass")
        return hashlib.sha256(key).hexdigest()[:16]

    @classmethod
    def _decode_control_line(cls, line: str) -> dict | None:
        """Extract one JSON control object even when a VST3 plug-in writes stdout noise."""
        text = line.strip()
        if not text:
            return None
        if text.startswith(cls.CONTROL_PREFIX):
            text = text[len(cls.CONTROL_PREFIX):].lstrip()

        decoder = json.JSONDecoder()
        candidates = [0]
        candidates.extend(index for index, char in enumerate(text) if char == "{" and index != 0)
        for start in candidates:
            try:
                value, _ = decoder.raw_decode(text[start:])
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                return value
        return None

    def _read_host_response(self, process: subprocess.Popen[str], phase: str) -> dict:
        if not process.stdout:
            return {"ok": False, "error": "VST3 host stdout is unavailable."}

        ignored = 0
        for _ in range(self.MAX_PROTOCOL_LINES):
            line = process.stdout.readline()
            if line == "":
                code = process.poll()
                self._process = None
                return {
                    "ok": False,
                    "error": f"VST3 host closed the control channel during {phase} (code={code}).",
                }

            response = self._decode_control_line(line)
            if response is not None:
                return response

            if line.strip():
                ignored += 1
                preview = line.strip().replace("\r", " ").replace("\n", " ")[:240]
                print(f"[vst3] ignored non-protocol stdout during {phase}: {preview}")

        self.shutdown()
        return {
            "ok": False,
            "error": f"VST3 host produced too much non-protocol output during {phase} ({ignored} lines).",
        }

    def scan(self) -> dict:
        found: dict[str, Path] = {}
        for root in self._scan_roots():
            if not root.is_dir():
                continue
            for current, dirs, files in os.walk(root):
                current_path = Path(current)
                bundle_dirs = [name for name in dirs if name.lower().endswith(".vst3")]
                for name in sorted(bundle_dirs):
                    path = (current_path / name).resolve()
                    found[self._plugin_id(path)] = path
                    if len(found) >= self.MAX_PLUGINS:
                        break
                dirs[:] = [name for name in dirs if not name.lower().endswith(".vst3")]
                for name in files:
                    if name.lower().endswith(".vst3"):
                        path = (current_path / name).resolve()
                        found[self._plugin_id(path)] = path
                        if len(found) >= self.MAX_PLUGINS:
                            break
                if len(found) >= self.MAX_PLUGINS:
                    break
            if len(found) >= self.MAX_PLUGINS:
                break

        with self._lock:
            self._plugins = found
        return self.plugins_response()

    def plugins_response(self) -> dict:
        with self._lock:
            plugins = [
                {"id": plugin_id, "name": path.stem, "path": str(path)}
                for plugin_id, path in sorted(self._plugins.items(), key=lambda pair: pair[1].name.lower())
            ]
        return {
            "ok": True,
            "plugins": plugins,
            "count": len(plugins),
            "native_host_available": self.host_executable() is not None,
            "scan_roots": [str(path) for path in self._scan_roots()],
        }

    def _start_host(self) -> dict:
        with self._lock:
            if self._process and self._process.poll() is None:
                return {"ok": True, "ready": True}
            executable = self.host_executable()
            if not executable:
                return {
                    "ok": False,
                    "error": "VST3 native host is not built. Run build_vst3_host.cmd first.",
                    "build_command": "build_vst3_host.cmd",
                }
            try:
                self._process = subprocess.Popen(
                    [str(executable)],
                    cwd=str(ROOT),
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    bufsize=1,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
            except OSError as exc:
                self._process = None
                return {"ok": False, "error": f"Could not start VST3 host: {exc}"}
            process = self._process
            assert process is not None
            response = self._read_host_response(process, "startup")
            if not response.get("ok"):
                self.shutdown()
            return response

    def _command(self, command: str) -> dict:
        with self._lock:
            ready = self._start_host()
            if not ready.get("ok"):
                return ready
            process = self._process
            if not process or process.poll() is not None or not process.stdin or not process.stdout:
                return {"ok": False, "error": "VST3 host process is not running."}
            try:
                process.stdin.write(command + "\n")
                process.stdin.flush()
            except (BrokenPipeError, OSError) as exc:
                self._process = None
                return {"ok": False, "error": f"VST3 bridge communication failed: {exc}"}
            phase = command.split("\t", 1)[0].lower()
            return self._read_host_response(process, phase)

    def load(self, plugin_id: str) -> dict:
        if not self._plugins:
            self.scan()
        with self._lock:
            path = self._plugins.get(plugin_id)
        if not path:
            return {"ok": False, "error": "Unknown VST3 plug-in id. Scan again and select a listed plug-in."}
        response = self._command(f"LOAD\t{path}")
        if response.get("ok"):
            self._loaded_plugin_id = plugin_id
        return response

    def note_on(self, midi_note: int, velocity: float) -> dict:
        midi_note = max(0, min(127, int(midi_note)))
        velocity = max(0.0, min(1.0, float(velocity)))
        return self._command(f"NOTE_ON\t{midi_note}\t{velocity:.6f}")

    def note_off(self, midi_note: int) -> dict:
        midi_note = max(0, min(127, int(midi_note)))
        return self._command(f"NOTE_OFF\t{midi_note}")

    def parameters(self) -> dict:
        return self._command("PARAMS")

    def set_parameter(self, parameter_id: int, value: float) -> dict:
        parameter_id = max(0, min(0x7FFFFFFF, int(parameter_id)))
        value = max(0.0, min(1.0, float(value)))
        return self._command(f"PARAM\t{parameter_id}\t{value:.8f}")

    def unload(self) -> dict:
        with self._lock:
            if not self._process or self._process.poll() is not None:
                self._loaded_plugin_id = None
                return {"ok": True}
        response = self._command("UNLOAD")
        if response.get("ok"):
            self._loaded_plugin_id = None
        return response

    def status(self) -> dict:
        with self._lock:
            running = bool(self._process and self._process.poll() is None)
            loaded_id = self._loaded_plugin_id
        executable = self.host_executable()
        return {
            "ok": True,
            "native_host_available": executable is not None,
            "native_host_path": str(executable) if executable else None,
            "running": running,
            "loaded_plugin_id": loaded_id,
            "plugin_count": len(self._plugins),
        }

    def shutdown(self) -> None:
        with self._lock:
            process = self._process
            self._process = None
            self._loaded_plugin_id = None
        if not process:
            return
        try:
            if process.poll() is None and process.stdin:
                process.stdin.write("QUIT\n")
                process.stdin.flush()
                process.wait(timeout=1.0)
        except (OSError, subprocess.TimeoutExpired):
            try:
                process.kill()
            except OSError:
                pass


VST3 = Vst3Bridge()
atexit.register(VST3.shutdown)


class Handler(BaseHTTPRequestHandler):
    server_version = "NaturalLanguageSynth/0.7.1"

    def _json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict | None:
        length = min(int(self.headers.get("Content-Length", "0") or 0), 64_000)
        try:
            value = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self._json({"error": "invalid json"}, HTTPStatus.BAD_REQUEST)
            return None
        if not isinstance(value, dict):
            self._json({"error": "json object required"}, HTTPStatus.BAD_REQUEST)
            return None
        return value

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            return self._json({"ok": True, "version": "0.7.1"})
        if parsed.path == "/api/vst3/status":
            return self._json(VST3.status())
        if parsed.path == "/api/vst3/plugins":
            return self._json(VST3.plugins_response())

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
        payload = self._read_json()
        if payload is None:
            return

        if parsed.path == "/api/generate-patch":
            prompt = str(payload.get("prompt", ""))[:500]
            patch = generate_patch(prompt)
            return self._json({"patch": patch.to_dict(), "engine": "offline-deterministic-v0.7"})
        if parsed.path == "/api/validate-patch":
            try:
                patch = validate_patch(payload.get("patch", {}))
            except (TypeError, ValueError) as exc:
                return self._json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return self._json({"patch": patch.to_dict()})

        try:
            if parsed.path == "/api/vst3/scan":
                return self._json(VST3.scan())
            if parsed.path == "/api/vst3/load":
                return self._json(VST3.load(str(payload.get("plugin_id", ""))[:64]))
            if parsed.path == "/api/vst3/note-on":
                return self._json(VST3.note_on(int(payload.get("note", 60)), float(payload.get("velocity", 0.8))))
            if parsed.path == "/api/vst3/note-off":
                return self._json(VST3.note_off(int(payload.get("note", 60))))
            if parsed.path == "/api/vst3/parameters":
                return self._json(VST3.parameters())
            if parsed.path == "/api/vst3/parameter":
                return self._json(VST3.set_parameter(int(payload.get("id", 0)), float(payload.get("value", 0.0))))
            if parsed.path == "/api/vst3/unload":
                return self._json(VST3.unload())
        except (TypeError, ValueError) as exc:
            return self._json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)

        return self.send_error(HTTPStatus.NOT_FOUND)

    def log_message(self, fmt, *args):
        print(f"[synth] {self.address_string()} - {fmt % args}")


def main():
    print("Natural Language Software Synth v0.7.1")
    print(f"Open http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
