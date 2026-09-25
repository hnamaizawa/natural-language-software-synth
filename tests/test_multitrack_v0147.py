from pathlib import Path

from server import Vst3Bridge, Vst3InstanceManager


ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_switching_main_vst3_keeps_both_track_instances(monkeypatch, tmp_path):
    manager = Vst3InstanceManager()
    manager._catalog._plugins = {name: tmp_path / f"{name}.vst3" for name in ("a", "b", "c")}
    loaded = []
    unloaded = []
    monkeypatch.setattr(Vst3Bridge, "load", lambda bridge, plugin_id, instance_id=None: loaded.append((instance_id, plugin_id)) or {"ok": True})
    monkeypatch.setattr(Vst3Bridge, "unload", lambda bridge, instance_id=None: unloaded.append(instance_id) or {"ok": True})
    monkeypatch.setattr(Vst3Bridge, "status", lambda bridge: {"running": True})
    monkeypatch.setattr(Vst3Bridge, "open_editor", lambda bridge, instance_id=None: {"ok": True, "instance_id": instance_id})

    manager.load("a", "main")
    manager.load("a", "track-drums")
    manager.load("b", "track-bass")
    manager.load("c", "main")

    assert manager._instances == {"main": "c", "track-drums": "a", "track-bass": "b"}
    assert manager.open_editor("track-drums")["instance_id"] == "track-drums"
    assert loaded == [("main", "a"), ("track-drums", "a"), ("track-bass", "b"), ("main", "c")]
    assert unloaded == []


def test_track_editor_and_midi_allocation_follow_selected_track():
    html = read("web/index.html")
    runtime = read("web/multitrack_runtime.js")
    router = read("web/vst3_runtime.js")
    server = read("server.py")
    for element in ("trackVstMidiChannel", "trackVstLoadBtn", "trackVstEditorBtn"):
        assert f'id="{element}"' in html
    assert 'api("/api/vst3/editor/open",{instance_id:target.instanceId})' in router
    assert 'VST3.open_editor(payload.get("instance_id"))' in server
    assert 'VST3.close_editor(payload.get("instance_id"))' in server
    assert 'track.midi_channel_mode==="manual"' in runtime
    assert 'choices.find(channel=>!used.has(channel))' in runtime
    assert 'role==="drums"?9' in runtime
    assert 'midi_channel_mode:raw?.midi_channel_mode==="manual"?"manual":"auto"' in runtime


def test_native_mixer_avoids_scratch_buffer_for_single_active_instance():
    native = read("native/vst3_host/src/main.cpp")
    assert "bool hasActiveOutput = false;" in native
    assert "pair.second->render (output, frames);" in native
    assert "if (scratch_.size () < samples) scratch_.resize (samples);" in native


def test_inline_track_settings_route_editor_and_parameters_by_track_instance(monkeypatch, tmp_path):
    manager = Vst3InstanceManager()
    manager._catalog._plugins = {name: tmp_path / f"{name}.vst3" for name in ("a", "b")}
    calls = []
    monkeypatch.setattr(Vst3Bridge, "load", lambda bridge, plugin_id, instance_id=None: {"ok": True})
    monkeypatch.setattr(Vst3Bridge, "status", lambda bridge: {"running": True})
    monkeypatch.setattr(Vst3Bridge, "open_editor", lambda bridge, instance_id=None: calls.append(("editor", instance_id)) or {"ok": True})
    monkeypatch.setattr(Vst3Bridge, "parameters", lambda bridge, instance_id=None: calls.append(("parameters", instance_id)) or {"ok": True, "parameters": []})
    monkeypatch.setattr(Vst3Bridge, "set_parameter", lambda bridge, parameter_id, value, instance_id=None: calls.append(("set", instance_id, parameter_id, value)) or {"ok": True})
    manager.load("a", "track-drums")
    manager.load("b", "track-bass")
    manager.open_editor("track-drums")
    manager.open_editor("track-bass")
    manager.parameters("track-drums")
    manager.set_parameter(7, 0.4, "track-bass")
    assert calls == [("editor", "track-drums"), ("editor", "track-bass"), ("parameters", "track-drums"), ("set", "track-bass", 7, 0.4)]
    runtime = read("web/multitrack_runtime.js")
    router = read("web/vst3_runtime.js")
    assert 'row.append(color,copyNode,sourceSelect,controls,inlineVstSettings(track))' in runtime
    assert 'openTrackVstEditor(track)' in runtime
    assert 'trackSetParameter(track,param.id' in runtime
    assert 'api("/api/vst3/parameters",{instance_id:target.instanceId})' in router
    assert 'api("/api/vst3/parameter",{instance_id:target.instanceId' in router
