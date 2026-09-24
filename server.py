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

from ai_synth.timbre_variants import generate_patch  # noqa: E402
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
        self._loaded_plugins: dict[str, str] = {}

    @staticmethod
    def _instance_id(value: str | None) -> str:
        raw = str(value or "main")[:80]
        clean = "".join(char for char in raw if char.isalnum() or char in "-_")
        return clean or "main"

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

    def _scan_roots(self, requested: list[str] | None = None) -> list[Path]:
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
        for item in (requested or [])[:16]:
            value = str(item).strip()[:1024]
            if value:
                roots.append(Path(value).expanduser())

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

    def scan(self, requested_roots: list[str] | None = None) -> dict:
        found: dict[str, Path] = {}
        incompatible: list[str] = []
        scan_roots = self._scan_roots(requested_roots)
        for root in scan_roots:
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
                    elif name.lower().endswith((".dll", ".exe")) and len(incompatible) < 64:
                        incompatible.append(str((current_path / name).resolve()))
                if len(found) >= self.MAX_PLUGINS:
                    break
            if len(found) >= self.MAX_PLUGINS:
                break

        with self._lock:
            self._plugins = found
        response = self.plugins_response(scan_roots=scan_roots)
        response["incompatible_count"] = len(incompatible)
        response["incompatible_examples"] = incompatible[:8]
        return response

    def plugins_response(self, scan_roots: list[Path] | None = None) -> dict:
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
            "scan_roots": [str(path) for path in (scan_roots if scan_roots is not None else self._scan_roots())],
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

    def load(self, plugin_id: str, instance_id: str | None = None) -> dict:
        if not self._plugins:
            self.scan()
        with self._lock:
            path = self._plugins.get(plugin_id)
        if not path:
            return {"ok": False, "error": "Unknown VST3 plug-in id. Scan again and select a listed plug-in."}
        key = self._instance_id(instance_id)
        response = self._command(f"LOAD\t{key}\t{path}")
        if response.get("ok"):
            self._loaded_plugins[key] = plugin_id
            if key == "main":
                self._loaded_plugin_id = plugin_id
        return response

    def note_on(self, midi_note: int, velocity: float, channel: int = 0, instance_id: str | None = None) -> dict:
        midi_note = max(0, min(127, int(midi_note)))
        velocity = max(0.0, min(1.0, float(velocity)))
        channel = max(0, min(15, int(channel)))
        return self._command(f"NOTE_ON\t{self._instance_id(instance_id)}\t{midi_note}\t{velocity:.6f}\t{channel}")

    def note_off(self, midi_note: int, channel: int = 0, instance_id: str | None = None) -> dict:
        midi_note = max(0, min(127, int(midi_note)))
        channel = max(0, min(15, int(channel)))
        return self._command(f"NOTE_OFF\t{self._instance_id(instance_id)}\t{midi_note}\t{channel}")

    def events(self, events: list[dict], instance_id: str | None = None) -> dict:
        encoded: list[str] = []
        for item in events[:1024]:
            on = 1 if bool(item.get("on")) else 0
            note = max(0, min(127, int(item.get("note", 60))))
            velocity = max(0.0, min(1.0, float(item.get("velocity", 0.0))))
            channel = max(0, min(15, int(item.get("channel", 0))))
            delay_ms = max(0.0, min(120_000.0, float(item.get("delay_ms", 0.0))))
            encoded.append(f"{on},{note},{velocity:.6f},{channel},{delay_ms:.3f}")
        if not encoded:
            return {"ok": True, "accepted": 0}
        return self._command(f"BATCH\t{self._instance_id(instance_id)}\t{';'.join(encoded)}")

    def clear_events(self, instance_id: str | None = None) -> dict:
        return self._command(f"CLEAR\t{self._instance_id(instance_id)}")

    def parameters(self, instance_id: str | None = None) -> dict:
        return self._command(f"PARAMS\t{self._instance_id(instance_id)}")

    def set_parameter(self, parameter_id: int, value: float, instance_id: str | None = None) -> dict:
        parameter_id = max(0, min(0x7FFFFFFF, int(parameter_id)))
        value = max(0.0, min(1.0, float(value)))
        return self._command(f"PARAM\t{self._instance_id(instance_id)}\t{parameter_id}\t{value:.8f}")

    def diagnostics(self, instance_id: str | None = None) -> dict:
        return self._command(f"DIAGNOSTICS\t{self._instance_id(instance_id)}")

    def test_tone(self, instance_id: str | None = None) -> dict:
        return self._command(f"TEST_TONE\t{self._instance_id(instance_id)}")

    def open_editor(self, instance_id: str | None = None) -> dict:
        return self._command(f"EDITOR_OPEN\t{self._instance_id(instance_id)}")

    def close_editor(self, instance_id: str | None = None) -> dict:
        return self._command(f"EDITOR_CLOSE\t{self._instance_id(instance_id)}")

    def unload(self, instance_id: str | None = None) -> dict:
        key = self._instance_id(instance_id)
        with self._lock:
            if not self._process or self._process.poll() is not None:
                self._loaded_plugins.pop(key, None)
                if key == "main":
                    self._loaded_plugin_id = None
                return {"ok": True}
        response = self._command(f"UNLOAD\t{key}")
        if response.get("ok"):
            self._loaded_plugins.pop(key, None)
            if key == "main":
                self._loaded_plugin_id = None
        return response

    def status(self) -> dict:
        with self._lock:
            running = bool(self._process and self._process.poll() is None)
            loaded_id = self._loaded_plugin_id
        executable = self.host_executable()
        result = {
            "ok": True,
            "native_host_available": executable is not None,
            "native_host_path": str(executable) if executable else None,
            "running": running,
            "loaded_plugin_id": loaded_id,
            "instances": dict(self._loaded_plugins),
            "instance_count": len(self._loaded_plugins),
            "plugin_count": len(self._plugins),
        }
        if running:
            native = self._command("STATUS")
            for key in ("single_audio_device", "cpu_load_percent", "audio_overruns", "idle_suspended_count"):
                if key in native:
                    result[key] = native[key]
        return result

    def shutdown(self) -> None:
        with self._lock:
            process = self._process
            self._process = None
            self._loaded_plugin_id = None
            self._loaded_plugins.clear()
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


class Vst3InstanceManager:
    """Bounded logical instances inside one native host and one audio device."""

    MAX_INSTANCES = 24
    DEFAULT_INSTANCE = "main"

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._catalog = Vst3Bridge()
        self._instances: dict[str, str] = {}

    @classmethod
    def _instance_id(cls, value: str | None) -> str:
        raw = str(value or cls.DEFAULT_INSTANCE)[:80]
        clean = "".join(char for char in raw if char.isalnum() or char in "-_")
        return clean or cls.DEFAULT_INSTANCE

    def scan(self, requested_roots: list[str] | None = None) -> dict:
        return self._catalog.scan(requested_roots)

    def plugins_response(self) -> dict:
        return self._catalog.plugins_response()

    def load(self, plugin_id: str, instance_id: str | None = None) -> dict:
        if not self._catalog._plugins:
            self.scan()
        key = self._instance_id(instance_id)
        with self._lock:
            if key not in self._instances and len(self._instances) >= self.MAX_INSTANCES:
                return {"ok": False, "error": f"VST3 instances are limited to {self.MAX_INSTANCES}."}
            already_loaded = self._instances.get(key) == plugin_id
        if already_loaded and self._catalog.status().get("running"):
            response = self._catalog.status()
            response.update({"ok": True, "already_loaded": True})
            return response
        response = self._catalog.load(plugin_id, key)
        if response.get("ok"):
            with self._lock:
                self._instances[key] = plugin_id
        return response

    def _call(self, instance_id: str | None, method: str, *args) -> dict:
        key = self._instance_id(instance_id)
        with self._lock:
            exists = key in self._instances
        if not exists:
            return {"ok": False, "error": "VST3 instance is not loaded."}
        return getattr(self._catalog, method)(*args, instance_id=key)

    def note_on(self, note: int, velocity: float, channel: int = 0, instance_id: str | None = None) -> dict:
        return self._call(instance_id, "note_on", note, velocity, channel)

    def note_off(self, note: int, channel: int = 0, instance_id: str | None = None) -> dict:
        return self._call(instance_id, "note_off", note, channel)

    def events(self, events: list[dict], instance_id: str | None = None) -> dict:
        return self._call(instance_id, "events", events)

    def clear_events(self, instance_id: str | None = None) -> dict:
        return self._call(instance_id, "clear_events")

    def parameters(self, instance_id: str | None = None) -> dict:
        return self._call(instance_id, "parameters")

    def set_parameter(self, parameter_id: int, value: float, instance_id: str | None = None) -> dict:
        return self._call(instance_id, "set_parameter", parameter_id, value)

    def diagnostics(self, instance_id: str | None = None) -> dict:
        return self._call(instance_id, "diagnostics")

    def test_tone(self, instance_id: str | None = None) -> dict:
        return self._call(instance_id, "test_tone")

    def open_editor(self, instance_id: str | None = None) -> dict:
        return self._call(instance_id, "open_editor")

    def close_editor(self, instance_id: str | None = None) -> dict:
        return self._call(instance_id, "close_editor")

    def unload(self, instance_id: str | None = None) -> dict:
        key = self._instance_id(instance_id)
        with self._lock:
            plugin_id = self._instances.pop(key, None)
        if plugin_id is None:
            return {"ok": True}
        return self._catalog.unload(key)

    def status(self) -> dict:
        with self._lock:
            instances = dict(self._instances)
        executable = self._catalog.host_executable()
        native = self._catalog.status()
        return {
            "ok": True,
            "native_host_available": executable is not None,
            "native_host_path": str(executable) if executable else None,
            "running": bool(instances),
            "loaded_plugin_id": instances.get(self.DEFAULT_INSTANCE),
            "plugin_count": len(self._catalog._plugins),
            "instances": instances,
            "instance_count": len(instances),
            "max_instances": self.MAX_INSTANCES,
            "single_audio_device": native.get("single_audio_device", True),
            "cpu_load_percent": native.get("cpu_load_percent", 0.0),
            "audio_overruns": native.get("audio_overruns", 0),
            "idle_suspended_count": native.get("idle_suspended_count", 0),
        }

    def shutdown(self) -> None:
        with self._lock:
            self._instances.clear()
        self._catalog.shutdown()


VST3 = Vst3InstanceManager()
atexit.register(VST3.shutdown)


class Handler(BaseHTTPRequestHandler):
    server_version = "NaturalLanguageSynth/0.7.2"

    def _json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict | None:
        length = min(int(self.headers.get("Content-Length", "0") or 0), 512_000)
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
            return self._json({"ok": True, "version": "0.7.2"})
        if parsed.path == "/api/vst3/status":
            return self._json(VST3.status())
        if parsed.path == "/api/vst3/plugins":
            return self._json(VST3.plugins_response())
        if parsed.path == "/api/vst3/diagnostics":
            return self._json(VST3.diagnostics())

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
                raw_paths = payload.get("scan_paths", [])
                scan_paths = raw_paths if isinstance(raw_paths, list) else []
                return self._json(VST3.scan([str(item) for item in scan_paths]))
            if parsed.path == "/api/vst3/load":
                return self._json(VST3.load(str(payload.get("plugin_id", ""))[:64], payload.get("instance_id")))
            if parsed.path == "/api/vst3/note-on":
                return self._json(VST3.note_on(int(payload.get("note", 60)), float(payload.get("velocity", 0.8)), int(payload.get("channel", 0)), payload.get("instance_id")))
            if parsed.path == "/api/vst3/note-off":
                return self._json(VST3.note_off(int(payload.get("note", 60)), int(payload.get("channel", 0)), payload.get("instance_id")))
            if parsed.path == "/api/vst3/events":
                raw_events = payload.get("events", [])
                events = raw_events if isinstance(raw_events, list) else []
                return self._json(VST3.events([item for item in events if isinstance(item, dict)], payload.get("instance_id")))
            if parsed.path == "/api/vst3/clear-events":
                return self._json(VST3.clear_events(payload.get("instance_id")))
            if parsed.path == "/api/vst3/parameters":
                return self._json(VST3.parameters(payload.get("instance_id")))
            if parsed.path == "/api/vst3/parameter":
                return self._json(VST3.set_parameter(int(payload.get("id", 0)), float(payload.get("value", 0.0)), payload.get("instance_id")))
            if parsed.path == "/api/vst3/test-tone":
                return self._json(VST3.test_tone())
            if parsed.path == "/api/vst3/editor/open":
                return self._json(VST3.open_editor(payload.get("instance_id")))
            if parsed.path == "/api/vst3/editor/close":
                return self._json(VST3.close_editor(payload.get("instance_id")))
            if parsed.path == "/api/vst3/unload":
                return self._json(VST3.unload(payload.get("instance_id")))
        except (TypeError, ValueError) as exc:
            return self._json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)

        return self.send_error(HTTPStatus.NOT_FOUND)

    def log_message(self, fmt, *args):
        print(f"[synth] {self.address_string()} - {fmt % args}")


def main():
    print("Natural Language Software Synth v0.7.2")
    print(f"Open http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
