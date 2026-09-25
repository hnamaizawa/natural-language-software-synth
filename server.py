from __future__ import annotations

import atexit
import hashlib
import base64
import binascii
import json
import mimetypes
import os
import subprocess
import sys
import tempfile
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

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

    def save_state(self, instance_id: str | None = None) -> dict:
        with tempfile.NamedTemporaryFile(suffix=".vst-state", delete=False) as file:
            path = Path(file.name)
        try:
            result = self._command(f"STATE_SAVE\t{self._instance_id(instance_id)}\t{path}")
            if not result.get("ok"):
                return result
            data = path.read_bytes()
            if len(data) > 8 * 1024 * 1024 + 8:
                return {"ok": False, "error": "VST3 state exceeds the project limit."}
            return {"ok": True, "state": base64.b64encode(data).decode("ascii")}
        finally:
            path.unlink(missing_ok=True)

    def load_state(self, state: str, instance_id: str | None = None) -> dict:
        if not isinstance(state, str) or len(state) > 12_000_000:
            return {"ok": False, "error": "VST3 state exceeds the project limit."}
        try:
            data = base64.b64decode(state, validate=True)
        except (binascii.Error, ValueError):
            return {"ok": False, "error": "Invalid VST3 state."}
        if len(data) > 8 * 1024 * 1024 + 8 or len(data) < 8:
            return {"ok": False, "error": "Invalid VST3 state size."}
        with tempfile.NamedTemporaryFile(suffix=".vst-state", delete=False) as file:
            path = Path(file.name)
            file.write(data)
        try:
            return self._command(f"STATE_LOAD\t{self._instance_id(instance_id)}\t{path}")
        finally:
            path.unlink(missing_ok=True)

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

    def freeze_prepare(self, frames: int, instance_id: str | None = None) -> dict:
        return self._command(f"FREEZE_PREPARE\t{self._instance_id(instance_id)}\t{frames}")

    def freeze_arm(self, instance_id: str | None = None) -> dict:
        return self._command(f"FREEZE_ARM\t{self._instance_id(instance_id)}")

    def freeze_status(self, instance_id: str | None = None) -> dict:
        return self._command(f"FREEZE_STATUS\t{self._instance_id(instance_id)}")

    def freeze_save(self, path: Path, instance_id: str | None = None) -> dict:
        return self._command(f"FREEZE_SAVE\t{self._instance_id(instance_id)}\t{path}")

    def freeze_resume(self, instance_id: str | None = None) -> dict:
        return self._command(f"FREEZE_RESUME\t{self._instance_id(instance_id)}")

    def transport_config(self, start: int, end: int, loop: bool) -> dict:
        return self._command(f"TRANSPORT_CONFIG\t{start}\t{end}\t{int(loop)}")

    def transport_events(self, events: list[tuple[str, int, bool, int, float, int]]) -> dict:
        encoded = ";".join(f"{instance},{frame},{int(on)},{note},{velocity:.6f},{channel}"
                           for instance, frame, on, note, velocity, channel in events)
        return self._command(f"TRANSPORT_EVENTS\t{encoded}")

    def transport_stem(self, instance_id: str, path: Path) -> dict:
        return self._command(f"TRANSPORT_STEM\t{instance_id}\t{path}")

    def transport_play(self) -> dict:
        return self._command("TRANSPORT_PLAY")

    def transport_stop(self) -> dict:
        return self._command("TRANSPORT_STOP")

    def transport_status(self) -> dict:
        return self._command("TRANSPORT_STATUS")

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
            for key in ("single_audio_device", "cpu_load_percent", "audio_overruns", "idle_suspended_count", "sample_rate"):
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
        self._frozen_instances: set[str] = set()
        self._freeze_dir = tempfile.TemporaryDirectory(prefix="nlss-freeze-")
        self._freeze_files: dict[str, Path] = {}

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
            was_frozen = key in self._frozen_instances
        if already_loaded and self._catalog.status().get("running"):
            if was_frozen:
                resumed = self._catalog.freeze_resume(key)
                if not resumed.get("ok"):
                    return resumed
                with self._lock:
                    self._frozen_instances.discard(key)
            response = self._catalog.status()
            response.update({"ok": True, "already_loaded": True})
            return response
        response = self._catalog.load(plugin_id, key)
        if response.get("ok"):
            with self._lock:
                self._instances[key] = plugin_id
                self._frozen_instances.discard(key)
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

    def save_state(self, instance_id: str | None = None) -> dict:
        return self._call(instance_id, "save_state")

    def load_state(self, state: str, instance_id: str | None = None) -> dict:
        return self._call(instance_id, "load_state", state)

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

    def freeze_start(self, instance_id: str | None, events: list[dict], duration_ms: float) -> dict:
        key = self._instance_id(instance_id)
        if not 0 < duration_ms <= 42_000 or len(events) > 1024:
            return {"ok": False, "error": "Freeze duration or note count exceeds the limit."}
        with self._lock, self._catalog._lock:
            if key not in self._instances:
                return {"ok": False, "error": "VST3 instance is not loaded."}
            sample_rate = int(self._catalog.status().get("sample_rate") or 48_000)
            frames = round(duration_ms * sample_rate / 1000)
            result = self._catalog.freeze_prepare(frames, key)
            if not result.get("ok"):
                return result
            self._frozen_instances.add(key)
            for offset in range(0, len(events), 1024):
                result = self._catalog.events(events[offset:offset + 1024], key)
                if not result.get("ok"):
                    self._catalog.freeze_resume(key)
                    self._frozen_instances.discard(key)
                    return result
            result = self._catalog.freeze_arm(key)
            if not result.get("ok"):
                self._catalog.freeze_resume(key)
                self._frozen_instances.discard(key)
            return result

    def freeze_status(self, instance_id: str | None) -> dict:
        return self._call(instance_id, "freeze_status")

    def freeze_finish(self, instance_id: str | None) -> dict:
        key = self._instance_id(instance_id)
        with self._lock:
            if key not in self._instances:
                return {"ok": False, "error": "VST3 instance is not loaded."}
            path = Path(self._freeze_dir.name) / f"{key}.wav"
            result = self._catalog.freeze_save(path, key)
            if result.get("ok"):
                self._freeze_files[key] = path
                result["audio_url"] = f"/api/vst3/freeze-audio?instance_id={key}"
            return result

    def freeze_audio(self, instance_id: str | None) -> bytes | None:
        key = self._instance_id(instance_id)
        with self._lock:
            path = self._freeze_files.get(key)
            return path.read_bytes() if path and path.is_file() else None

    def transport_start(self, bpm: float, start_beat: float, end_beat: float,
                        loop: bool, tracks: list[dict]) -> dict:
        """Commit a bounded arrangement to one native sample clock and output device."""
        import math
        if not all(math.isfinite(float(x)) for x in (bpm, start_beat, end_beat)) or not (40 <= bpm <= 240 and 0 <= start_beat < end_beat <= 256):
            return {"ok": False, "error": "Invalid arrangement tempo or range."}
        if len(tracks) > self.MAX_INSTANCES:
            return {"ok": False, "error": "Too many arrangement tracks."}
        with self._lock:
            sample_rate = int(self._catalog.status().get("sample_rate") or 48000)
            if not 8000 <= sample_rate <= 192000:
                return {"ok": False, "error": "Invalid native sample rate."}
            scale = sample_rate * 60 / bpm
            start_frame, end_frame = round(start_beat * scale), round(end_beat * scale)
            events: list[tuple[str, int, bool, int, float, int]] = []
            stems: list[tuple[str, Path]] = []
            for track in tracks:
                key = self._instance_id(track.get("instance_id"))
                if key not in self._instances:
                    return {"ok": False, "error": f"Unloaded native track: {key}"}
                if bool(track.get("frozen")):
                    path = self._freeze_files.get(key)
                    if key not in self._frozen_instances or not path or not path.is_file():
                        return {"ok": False, "error": f"Frozen audio unavailable: {key}"}
                    if key not in [stem_id for stem_id, _ in stems]:
                        stems.append((key, path))
                    continue
                if key in self._frozen_instances:
                    return {"ok": False, "error": f"Frozen track requires its audio: {key}"}
                notes = track.get("notes")
                if not isinstance(notes, list) or len(notes) > 2048 or any(not isinstance(note, dict) for note in notes):
                    return {"ok": False, "error": "Too many notes in a native track."}
                channel = max(0, min(15, int(track.get("channel", 0))))
                raw_volume = float(track.get("volume", 1))
                if not math.isfinite(raw_volume):
                    return {"ok": False, "error": "Invalid track volume."}
                volume = max(0.0, min(1.0, raw_volume))
                for note in notes:
                    pitch = max(0, min(127, int(note.get("note", 60))))
                    raw_velocity = float(note.get("velocity", 0.8))
                    if not math.isfinite(raw_velocity):
                        return {"ok": False, "error": "Invalid note velocity."}
                    velocity = max(0.0, min(1.0, raw_velocity)) * volume
                    on_beat = float(note.get("start_beat", -1))
                    off_beat = float(note.get("end_beat", -1))
                    if not math.isfinite(on_beat) or not math.isfinite(off_beat) or not (0 <= on_beat < off_beat <= 256):
                        return {"ok": False, "error": "Invalid native note range."}
                    if start_beat <= on_beat < end_beat:
                        on_frame = round(on_beat * scale)
                        off_frame = min(end_frame - 1, round(min(off_beat, end_beat) * scale))
                        events.extend(((key, on_frame, True, pitch, velocity, channel),
                                       (key, max(on_frame, off_frame), False, pitch, 0.0, channel)))
            if len(events) > 24576:
                return {"ok": False, "error": "Native arrangement event limit exceeded."}
            result = {"ok": False}
            try:
                result = self._catalog.transport_config(start_frame, end_frame, bool(loop))
                if not result.get("ok"):
                    return result
                for offset in range(0, len(events), 1024):
                    result = self._catalog.transport_events(events[offset:offset + 1024])
                    if not result.get("ok"):
                        return result
                for key, path in stems:
                    result = self._catalog.transport_stem(key, path)
                    if not result.get("ok"):
                        return result
                return self._catalog.transport_play()
            finally:
                if not result.get("ok"):
                    self._catalog.transport_stop()

    def transport_status(self) -> dict:
        return self._catalog.transport_status()

    def transport_stop(self) -> dict:
        return self._catalog.transport_stop()

    def freeze_resume(self, instance_id: str | None) -> dict:
        key = self._instance_id(instance_id)
        result = self._call(key, "freeze_resume")
        if result.get("ok"):
            with self._lock:
                self._frozen_instances.discard(key)
        return result

    def unload(self, instance_id: str | None = None) -> dict:
        key = self._instance_id(instance_id)
        with self._lock:
            plugin_id = self._instances.pop(key, None)
            self._frozen_instances.discard(key)
            self._freeze_files.pop(key, None)
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
            self._frozen_instances.clear()
        self._catalog.shutdown()
        self._freeze_dir.cleanup()


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
        raw_length = int(self.headers.get("Content-Length", "0") or 0)
        if raw_length > 12_000_000:
            self._json({"error": "request is too large"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
            return None
        length = raw_length
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
        if parsed.path == "/api/vst3/transport/status":
            return self._json(VST3.transport_status())
        if parsed.path == "/api/vst3/plugins":
            return self._json(VST3.plugins_response())
        if parsed.path == "/api/vst3/diagnostics":
            return self._json(VST3.diagnostics())
        if parsed.path == "/api/vst3/freeze-audio":
            data = VST3.freeze_audio(parse_qs(parsed.query).get("instance_id", [None])[0])
            if data is None:
                return self.send_error(HTTPStatus.NOT_FOUND)
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            return self.wfile.write(data)

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
            if parsed.path == "/api/vst3/transport/start":
                tracks = payload.get("tracks")
                if not isinstance(tracks, list) or any(not isinstance(track, dict) for track in tracks):
                    return self._json({"ok": False, "error": "Invalid arrangement tracks."}, HTTPStatus.BAD_REQUEST)
                return self._json(VST3.transport_start(float(payload.get("bpm", 100)),
                    float(payload.get("start_beat", 0)), float(payload.get("end_beat", 16)),
                    bool(payload.get("loop", False)), tracks))
            if parsed.path == "/api/vst3/transport/stop":
                return self._json(VST3.transport_stop())
            if parsed.path == "/api/vst3/freeze/start":
                raw_events = payload.get("events", [])
                if not isinstance(raw_events, list):
                    return self._json({"ok": False, "error": "Invalid note events."}, HTTPStatus.BAD_REQUEST)
                return self._json(VST3.freeze_start(payload.get("instance_id"),
                    [item for item in raw_events if isinstance(item, dict)], float(payload.get("duration_ms", 0))))
            if parsed.path == "/api/vst3/freeze/status":
                return self._json(VST3.freeze_status(payload.get("instance_id")))
            if parsed.path == "/api/vst3/freeze/finish":
                return self._json(VST3.freeze_finish(payload.get("instance_id")))
            if parsed.path == "/api/vst3/freeze/resume":
                return self._json(VST3.freeze_resume(payload.get("instance_id")))
            if parsed.path == "/api/vst3/parameters":
                return self._json(VST3.parameters(payload.get("instance_id")))
            if parsed.path == "/api/vst3/state/save":
                return self._json(VST3.save_state(payload.get("instance_id")))
            if parsed.path == "/api/vst3/state/load":
                return self._json(VST3.load_state(payload.get("state"), payload.get("instance_id")))
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
