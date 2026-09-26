from pathlib import Path

from server import Vst3Bridge


ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_bridge_passes_bounded_absolute_frames_without_changing_legacy_events(monkeypatch):
    bridge = Vst3Bridge()
    commands = []
    monkeypatch.setattr(bridge, "_command", lambda command: commands.append(command) or {"ok": True})
    bridge.events([
        {"on": True, "note": 60, "velocity": .7, "channel": 2, "delay_ms": 0, "note_id": 7, "at_frame": 48001},
        {"on": False, "note": 60, "velocity": 0, "channel": 2, "delay_ms": 250, "note_id": 7},
    ], "track-one")
    assert "1,60,0.700000,2,0.000,7,48001" in commands[0]
    assert "0,60,0.000000,2,250.000,7" in commands[0]


def test_arrangement_prequeues_native_frames_and_freeze_has_one_control():
    runtime = read("web/multitrack_runtime.js")
    router = read("web/vst3_runtime.js")
    native = read("native/vst3_host/src/main.cpp")
    assert "scheduleTrackCycle?.(part,plannedStart,60/project.bpm)" in runtime
    assert "if(frozenBuffers.has(item.track.id)||vstPrescheduled" in runtime
    assert 'const clock=await api("/api/vst3/status")' in router
    assert "at_frame:Math.round(origin+item.startBeat" in router
    assert "note.absoluteFrame >= startFrame +" in native
    assert "frameClock_.fetch_add (frames)" in native
    assert "pendingNotes_.erase (pendingNotes_.begin () + 512)" not in native
    assert runtime.count('freeze.addEventListener("click"') == 1
    assert "if(track.source.type!==\"vst3\"){\n        const freeze" not in runtime
