"""Native arrangement handoff uses one frame clock for MIDI and frozen stems."""
from pathlib import Path
from tempfile import NamedTemporaryFile

from server import Vst3InstanceManager


ROOT = Path(__file__).resolve().parents[1]


class FakeCatalog:
    def __init__(self):
        self.calls = []

    def status(self):
        return {"sample_rate": 48_000}

    def transport_config(self, *args):
        self.calls.append(("config", args))
        return {"ok": True}

    def transport_events(self, events):
        self.calls.append(("events", events))
        return {"ok": True}

    def transport_stem(self, *args):
        self.calls.append(("stem", args))
        return {"ok": True}

    def transport_play(self):
        self.calls.append(("play",))
        return {"ok": True}

    def transport_stop(self):
        self.calls.append(("stop",))
        return {"ok": True}


def test_note_and_freeze_stem_use_same_native_transport():
    manager = Vst3InstanceManager()
    fake = FakeCatalog()
    manager._catalog = fake
    manager._instances = {"keys": "plugin-a", "drums": "plugin-b"}
    manager._frozen_instances = {"drums"}
    with NamedTemporaryFile(suffix=".wav") as stem:
        manager._freeze_files = {"drums": Path(stem.name)}
        result = manager.transport_start(120, 4, 16, True, [
            {"instance_id": "keys", "channel": 0, "volume": .5, "notes": [
                {"note": 60, "velocity": .8, "start_beat": 4, "end_beat": 5},
                {"note": 64, "velocity": .8, "start_beat": 15, "end_beat": 16}]},
            {"instance_id": "drums", "frozen": True, "notes": []},
        ])
    assert result["ok"]
    assert fake.calls[0] == ("config", (96_000, 384_000, True))
    assert fake.calls[1][0] == "events"
    assert fake.calls[1][1][0] == ("keys", 96_000, True, 60, .4, 0)
    assert fake.calls[1][1][-1][1] == 383_999  # note-off stays inside loop
    assert [call[0] for call in fake.calls] == ["config", "events", "stem", "play"]


def test_native_transport_rejects_unloaded_and_missing_frozen_audio():
    manager = Vst3InstanceManager()
    fake = FakeCatalog()
    manager._catalog = fake
    assert not manager.transport_start(100, 0, 16, False, [{"instance_id": "unknown", "notes": []}])["ok"]
    manager._instances["drums"] = "plugin"
    manager._frozen_instances.add("drums")
    assert not manager.transport_start(100, 0, 16, False, [{"instance_id": "drums", "frozen": True}])["ok"]
    assert not fake.calls


def test_browser_native_path_does_not_stream_notes_per_timer():
    native = (ROOT / "native/vst3_host/src/main.cpp").read_text(encoding="utf-8")
    runtime = (ROOT / "web/multitrack_runtime.js").read_text(encoding="utf-8")
    assert "TRANSPORT_CONFIG" in native and "TRANSPORT_STEM" in native
    assert "transportFrame_" in native and "rack->render" in native
    assert "const allNative=tracks.length>0" in runtime
    assert "await playNativeArrangement(tracks,from,to,loop)" in runtime
    assert "window.vst3Router.nativeTransportStatus()" in runtime
