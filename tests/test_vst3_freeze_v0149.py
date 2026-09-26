from pathlib import Path

from server import Vst3Bridge, Vst3InstanceManager


ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_freeze_records_only_requested_instance_and_serves_bounded_audio(monkeypatch, tmp_path):
    manager = Vst3InstanceManager()
    manager._catalog._plugins = {"drum": tmp_path / "drum.vst3", "bass": tmp_path / "bass.vst3"}
    calls = []
    monkeypatch.setattr(Vst3Bridge, "load", lambda bridge, plugin, instance_id=None: {"ok": True})
    monkeypatch.setattr(Vst3Bridge, "status", lambda bridge: {"running": True, "sample_rate": 48000})
    monkeypatch.setattr(Vst3Bridge, "freeze_prepare", lambda bridge, frames, instance_id=None: calls.append(("prepare", instance_id, frames)) or {"ok": True})
    monkeypatch.setattr(Vst3Bridge, "events", lambda bridge, events, instance_id=None: calls.append(("events", instance_id, events)) or {"ok": True})
    monkeypatch.setattr(Vst3Bridge, "freeze_arm", lambda bridge, instance_id=None: calls.append(("arm", instance_id)) or {"ok": True})
    monkeypatch.setattr(Vst3Bridge, "freeze_save", lambda bridge, path, instance_id=None: (path.write_bytes(b"RIFFtest"), {"ok": True})[1])
    monkeypatch.setattr(Vst3Bridge, "freeze_resume", lambda bridge, instance_id=None: calls.append(("resume", instance_id)) or {"ok": True})
    monkeypatch.setattr(Vst3Bridge, "unload", lambda bridge, instance_id=None: {"ok": True})

    assert manager.load("drum", "track-drums")["ok"]
    assert manager.load("bass", "track-bass")["ok"]
    notes = [{"on": True, "note": 36, "velocity": 0.8, "channel": 9, "delay_ms": 0}]
    assert manager.freeze_start("track-drums", notes, 1200)["ok"]
    assert calls == [("prepare", "track-drums", 57600), ("events", "track-drums", notes), ("arm", "track-drums")]
    assert manager.freeze_finish("track-drums")["audio_url"].endswith("track-drums")
    assert manager.freeze_audio("track-drums") == b"RIFFtest"
    assert manager.freeze_audio("track-bass") is None
    assert manager.freeze_start("track-drums", notes, 42001)["ok"] is False
    assert manager.freeze_start("track-drums", notes * 1025, 1200)["ok"] is False
    assert manager.freeze_resume("track-drums")["ok"]
    assert manager.unload("track-bass")["ok"]
    manager.shutdown()


def test_freeze_and_share_keep_one_audio_context_and_instance_identity():
    native = read("native/vst3_host/src/main.cpp")
    router = read("web/vst3_runtime.js")
    runtime = read("web/multitrack_runtime.js")
    server = read("server.py")
    assert '"FREEZE_PREPARE"' in native and '"FREEZE_SAVE"' in native
    assert "manualSuspended_.store (true)" in native
    assert "quietFrames_ >= sampleRate_ / 2" in native
    assert "captureTargetFrames_ - captured" in native
    assert 'api("/api/vst3/freeze/start",{instance_id:target.instanceId' in router
    assert "trackInstances.set(trackId,alias)" in router
    assert "if(target.instanceId===trackId)await api" in router
    assert "engine.ctx.createBufferSource()" in runtime
    assert "if(frozenBuffers.has(item.track.id)||vstPrescheduled&&item.track.source.type===\"vst3\")continue" in runtime
    assert 'share.append(new Option("独立したVST3（別音色）","")' in runtime
    assert '"/api/vst3/freeze-audio"' in server


def test_reconnect_resumes_only_a_frozen_instance(monkeypatch, tmp_path):
    manager = Vst3InstanceManager()
    manager._catalog._plugins = {"instrument": tmp_path / "instrument.vst3"}
    resumed = []
    monkeypatch.setattr(Vst3Bridge, "load", lambda bridge, plugin, instance_id=None: {"ok": True})
    monkeypatch.setattr(Vst3Bridge, "status", lambda bridge: {"running": True, "sample_rate": 48000})
    monkeypatch.setattr(Vst3Bridge, "freeze_prepare", lambda bridge, frames, instance_id=None: {"ok": True})
    monkeypatch.setattr(Vst3Bridge, "freeze_arm", lambda bridge, instance_id=None: {"ok": True})
    monkeypatch.setattr(Vst3Bridge, "freeze_resume", lambda bridge, instance_id=None: resumed.append(instance_id) or {"ok": True})
    assert manager.load("instrument", "track-1")["ok"]
    assert manager.load("instrument", "track-1")["ok"]
    assert resumed == []
    assert manager.freeze_start("track-1", [], 1000)["ok"]
    assert manager.load("instrument", "track-1")["ok"]
    assert resumed == ["track-1"]
    assert manager.load("instrument", "track-1")["ok"]
    assert resumed == ["track-1"]
    manager.shutdown()
