from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_multitrack_ui_and_runtime_are_loaded_before_final_vst3_wrapper():
    html = read("web/index.html")
    assert 'id="arrangement"' in html
    assert 'id="trackList"' in html
    assert 'id="arrangementTimeline"' in html
    assert 'id="projectPianoRoll"' in html
    assert html.index('/multitrack_runtime.js') < html.index('/vst3_runtime.js')


def test_default_project_has_seven_independent_part_roles():
    runtime = read("web/multitrack_runtime.js")
    for role in ["drums", "bass", "keyboard", "guitar", "melody", "chorus", "pad"]:
        assert f'["{role}"' in runtime
    assert "generated_patch" in runtime
    assert "source:{type:" in runtime


def test_project_and_note_clip_imports_are_bounded_and_validated():
    runtime = read("web/multitrack_runtime.js")
    assert "MAX_TRACKS=24" in runtime
    assert "MAX_CLIPS=64" in runtime
    assert "MAX_NOTES=512" in runtime
    assert ".slice(0,MAX_TRACKS)" in runtime
    assert ".slice(0,MAX_CLIPS)" in runtime
    assert ".slice(0,MAX_NOTES)" in runtime
    assert "validatePatch(raw?.patch||fallback.patch)" in runtime
    for forbidden in ["new AudioContext", "webkitAudioContext", "eval(", "new Function(", "localStorage"]:
        assert forbidden not in runtime


def test_clip_preview_reuses_stable_note_event_contract():
    runtime = read("web/multitrack_runtime.js")
    assert "engine.noteOn(event.note,event.velocity*track.volume)" in runtime
    assert "engine.noteOff(event.note)" in runtime
    assert "await engine.init()" in runtime


def test_blueprint_declares_multitrack_contract_without_removing_existing_invariants():
    blueprint = read("harness/app_blueprint.yaml")
    for capability in ["multitrack_project_model", "independent_track_patch_assignment", "bounded_note_clip_model", "project_json_save_load"]:
        assert f"- {capability}" in blueprint
    for invariant in ["project_tracks_must_store_validated_patches_only", "project_import_must_bound_tracks_clips_and_notes", "project_clip_preview_must_use_existing_note_event_contract", "all_engines_must_share_single_audio_context", "vst3_router_must_remain_final_note_event_wrapper"]:
        assert f"- {invariant}" in blueprint
