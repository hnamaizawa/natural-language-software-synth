from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_track_sound_panel_exposes_requested_sources_and_adjustments():
    html = read("web/index.html")
    runtime = read("web/multitrack_runtime.js")
    for element_id in [
        "trackSoundPanel",
        "trackPresetSelect",
        "trackPromptInput",
        "trackReferenceSourceBtn",
        "trackVstSourceBtn",
    ]:
        assert f'id="{element_id}"' in html
    assert 'setTrackSource("internal")' in runtime
    assert 'setTrackSource("reference")' in runtime
    assert 'setTrackSource("vst3")' in runtime
    assert "referenceAudioMatch.applyPresetById" in runtime


def test_sample_clip_is_extended_to_sixteen_beats_and_remains_bounded():
    runtime = read("web/multitrack_runtime.js")
    assert "while(cursor<TIMELINE_BEATS&&notes.length<MAX_NOTES)" in runtime
    assert 'name:`${perf.label||key}（${TIMELINE_BEATS}拍）`' in runtime
    assert "MAX_NOTES=512" in runtime


def test_arrangement_can_play_all_tracks_and_loop_with_mute_solo():
    html = read("web/index.html")
    runtime = read("web/multitrack_runtime.js")
    assert 'id="arrangementPlayBtn"' in html
    assert 'id="arrangementLoop"' in html
    assert "async function playArrangement()" in runtime
    assert "project.tracks.filter(track=>track.solo)" in runtime
    assert "project.tracks.filter(track=>!track.mute)" in runtime
    assert "scheduleCycle()" in runtime


def test_track_vst3_playback_uses_loaded_scanned_host_boundary():
    runtime = read("web/multitrack_runtime.js")
    vst3 = read("web/vst3_runtime.js")
    assert 'router?.isLoaded()' in runtime
    assert "router.trackNoteOn" in runtime
    assert "router.trackNoteOff" in runtime
    assert "loadedPlugin:()=>" in vst3
    assert "trackNoteOn,trackNoteOff,baseNoteOn,baseNoteOff" in vst3
    assert 'import(".vst3")' not in runtime
    assert "fetch(" not in runtime


def test_blueprint_keeps_new_multitrack_playback_invariants():
    blueprint = read("harness/app_blueprint.yaml")
    assert "- arrangement_playback_must_use_existing_audio_context" in blueprint
    assert "- arrangement_playback_must_use_bounded_note_events" in blueprint
    assert "- vst3_track_assignment_must_use_current_scanned_loaded_plugin" in blueprint
