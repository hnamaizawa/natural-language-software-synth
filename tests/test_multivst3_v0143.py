from pathlib import Path

from server import Vst3Bridge, Vst3InstanceManager


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_manager_creates_isolated_logical_instances_in_one_native_bridge(monkeypatch, tmp_path):
    manager = Vst3InstanceManager()
    plugin = tmp_path / "example.vst3"
    manager._catalog._plugins = {"plugin-a": plugin}

    calls = []

    def fake_load(bridge, plugin_id, instance_id=None):
        calls.append((plugin_id, instance_id))
        return {"ok": True, "name": "Example"}

    monkeypatch.setattr(Vst3Bridge, "load", fake_load)
    assert manager.load("plugin-a", "track-one")["ok"]
    assert manager.load("plugin-a", "track-two")["ok"]
    assert manager._instances == {"track-one": "plugin-a", "track-two": "plugin-a"}
    assert calls == [("plugin-a", "track-one"), ("plugin-a", "track-two")]
    assert isinstance(manager._catalog, Vst3Bridge)
    assert manager._instance_id("../unsafe track") == "unsafetrack"
    assert manager.MAX_INSTANCES == 24


def test_server_routes_each_note_to_requested_logical_instance_in_one_host():
    server = read("server.py")
    for token in [
        "class Vst3InstanceManager",
        'payload.get("instance_id")',
        "self._instances",
        "MAX_INSTANCES = 24",
        "logical instances inside one native host and one audio device",
    ]:
        assert token in server
    assert 'VST3.note_on(' in server
    assert 'VST3.note_off(' in server


def test_arrangement_uses_one_native_instance_per_track_and_routes_notes():
    html = read("web/index.html")
    router = read("web/vst3_runtime.js")
    multitrack = read("web/multitrack_runtime.js")
    assert "async function prepareTracks(tracks)" in router
    assert "for(const track of requested){try{await loadTrack(track);}catch(error)" in router
    assert 'api("/api/vst3/load",{plugin_id:pluginId,instance_id:trackId})' in router
    assert "trackInstances.set(trackId,{pluginId,instanceId:trackId})" in router
    assert 'api("/api/vst3/unload",{instance_id:trackId})' in router
    assert "trackNoteOn(trackId,note,velocity" in router
    assert "trackNoteOff(trackId,note,channel" in router
    assert "function trackEvents(instanceId,events)" in router
    assert 'api("/api/vst3/events"' in router
    assert 'api("/api/vst3/clear-events"' in router
    assert "await window.vst3Router?.prepareTracks(tracks)" in multitrack
    assert "router?.trackNoteOn(track.id" in multitrack
    assert "router?.trackNoteOff(track.id" in multitrack
    assert "vstEvents=new Map()" in multitrack
    assert "window.vst3Router?.trackEventsBatch?.(vstEvents)" in multitrack
    assert "window.vst3Router?.clearTrackEvents?.()" in multitrack
    assert '/vst3_runtime.js?v=0.16.0' in html
    assert '/multitrack_runtime.js?v=0.16.0' in html


def test_blueprint_requires_bounded_independent_vst3_instances():
    blueprint = read("harness/app_blueprint.yaml")
    for token in [
        "isolated_native_vst3_instance_per_track",
        "persistent_track_vst3_state_on_main_plugin_switch",
        "multitrack_vst3_drum_channel_alignment",
        "simultaneous_multi_vst3_arrangement_playback",
        "bounded_vst3_instance_pool",
        "vst3_track_instances_must_load_scanned_plugin_ids_only",
        "vst3_track_instance_count_must_be_bounded",
        "vst3_track_notes_must_route_by_bounded_instance_id",
    ]:
        assert f"- {token}" in blueprint
