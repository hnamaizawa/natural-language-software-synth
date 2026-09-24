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


def test_multitrack_playback_uses_audio_clock_queue_without_per_note_dom_timers():
    runtime = read("web/multitrack_runtime.js")
    app = read("web/app.js")
    assert "function buildPlaybackQueue(tracks)" in runtime
    assert "function startInternalScheduler(queue,onCycleComplete,cycleBeats=TIMELINE_BEATS)" in runtime
    assert "engine.ctx.currentTime" in runtime
    assert "for(const item of queue)" in runtime
    assert "setInterval(" not in runtime
    assert "engine.usePreparedPlaybackPatch(preparedPatchFor(track))" in runtime
    assert "preparePlaybackPatch(raw)" in app
    assert "usePreparedPlaybackPatch(patch)" in app
    assert "engine.suppressPerformanceVisuals=true" in runtime
    assert "if(!this.suppressPerformanceVisuals){setPerformanceActive(note,true);setTimeout" in app
    playback = runtime.split("function playNote", 1)[1].split("function setTrackSource", 1)[0]
    assert "renderPianoRoll()" not in playback
    assert "previewNotes" not in runtime


def test_each_track_exposes_and_persists_an_independent_source_selector():
    html = read("web/index.html")
    runtime = read("web/multitrack_runtime.js")
    css = read("web/multitrack.css")
    assert "track-source-select" in runtime
    assert '[["internal","内蔵音源"],["reference","CD/Reference調整"],["vst3","VST3音源"]]' in runtime
    assert "track.source.type" in runtime
    assert "track.source.plugin_id" in runtime
    assert "CD/Reference調整済み内蔵音源" in runtime
    assert "特徴量解析だけに使い" in runtime
    assert ".track-source-select" in css
    assert "/multitrack.css?v=0.14.2" in html
    assert "/multitrack_runtime.js?v=0.14.2" in html


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
