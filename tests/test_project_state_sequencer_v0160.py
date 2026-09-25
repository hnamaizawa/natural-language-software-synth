import base64
from pathlib import Path

from server import Vst3Bridge, Vst3InstanceManager


ROOT = Path(__file__).resolve().parents[1]


def test_vst3_state_roundtrip_uses_only_bounded_temporary_files(monkeypatch, tmp_path):
    manager = Vst3InstanceManager()
    manager._catalog._plugins = {"saved-plugin": tmp_path / "saved.vst3"}
    monkeypatch.setattr(Vst3Bridge, "load", lambda bridge, plugin, instance_id=None: {"ok": True})
    assert manager.load("saved-plugin", "track-one")["ok"]
    recorded = []

    def command(bridge, instruction):
        action, instance, filename = instruction.split("\t")
        recorded.append((action, instance))
        path = Path(filename)
        if action == "STATE_SAVE":
            path.write_bytes(b"\x02\x00\x00\x00\x00\x00\x00\x00ab")
        else:
            assert path.read_bytes() == b"\x02\x00\x00\x00\x00\x00\x00\x00ab"
        return {"ok": True}

    monkeypatch.setattr(Vst3Bridge, "_command", command)
    state = manager.save_state("track-one")
    assert state["ok"] and base64.b64decode(state["state"]).endswith(b"ab")
    assert manager.load_state(state["state"], "track-one")["ok"]
    assert recorded == [("STATE_SAVE", "track-one"), ("STATE_LOAD", "track-one")]
    assert manager.load_state("invalid!", "track-one")["ok"] is False
    assert manager.load_state("a" * 12_000_001, "track-one")["ok"] is False
    assert manager.save_state("missing")["ok"] is False
    manager.shutdown()


def test_project_restores_vst3_state_and_edits_bounded_note_clips():
    router = (ROOT / "web/vst3_runtime.js").read_text(encoding="utf-8")
    runtime = (ROOT / "web/multitrack_runtime.js").read_text(encoding="utf-8")
    html = (ROOT / "web/index.html").read_text(encoding="utf-8")
    native = (ROOT / "native/vst3_host/src/main.cpp").read_text(encoding="utf-8")
    cmake = (ROOT / "native/vst3_host/CMakeLists.txt").read_text(encoding="utf-8")
    assert 'api("/api/vst3/state/save"' in router
    assert 'api("/api/vst3/state/load"' in router
    assert "scanForTracks(vstTracks)" in runtime
    assert "snapshotTrack(track)" in runtime
    assert "plugin_state:typeof raw?.source?.plugin_state" in runtime
    assert "clip.notes.length>=MAX_NOTES" in runtime
    assert "rollHistory()" in runtime and "travelRollHistory" in runtime
    assert "horizon=now+.8" in runtime
    assert 'id="rollSnap"' in html and 'id="rollUndo"' in html
    assert 'component_->getState (&componentState)' in native
    assert 'component_->setState (&componentState)' in native
    assert 'public.sdk/source/common/memorystream.cpp' in cmake
