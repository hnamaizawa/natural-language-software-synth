from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_v0110_reference_runtime_is_loaded_before_final_vst3_wrapper():
    html = read("web/index.html")
    assert '/reference_match_runtime.js' in html
    assert html.index('/reference_match_runtime.js') < html.index('/vst3_runtime.js')
    assert "Preset / Reference / 自然言語" in html
    assert "任意: 自然言語で音色を選択／微調整" in html


def test_preset_first_library_applies_direct_validated_instrument_patches():
    runtime = read("web/reference_match_runtime.js")
    assert "REALISTIC_PRESETS" in runtime
    assert 'instrument_model: "fretless_bass"' in runtime
    assert 'instrument_model: "grand_piano"' in runtime
    assert 'instrument_model: "electric_guitar"' in runtime
    assert 'instrument_model: "studio_drums"' in runtime
    assert 'instrument_model: "dx_ep"' in runtime
    assert "validatePatch(raw)" in runtime
    assert "engine.setPatch(patch)" in runtime
    assert "applyPreset(preset)" in runtime


def test_modern_fusion_six_string_bass_preset_is_articulate_and_bounded():
    runtime = read("web/reference_match_runtime.js")
    for token in [
        'id: "modern_fusion_6string_bass"',
        'ja: "モダン・フュージョン6弦ベース"',
        'sample_tone: .88',
        'sample_attack_mix: .78',
        'finger_noise_mix: .64',
        'slide_amount: .18',
        'mwah_amount: .42',
        'sample_velocity_curve: 1.25',
    ]:
        assert token in runtime


def test_reference_audio_stays_browser_local_and_bounded():
    runtime = read("web/reference_match_runtime.js")
    assert "MAX_FILE_BYTES = 80 * 1024 * 1024" in runtime
    assert "MIN_ANALYSIS_SECONDS = 3" in runtime
    assert "MAX_ANALYSIS_SECONDS = 30" in runtime
    assert "state.file.arrayBuffer()" in runtime
    assert "engine.ctx.decodeAudioData" in runtime
    assert "analyzeBuffer(buffer" in runtime
    assert "matchPatch(state.basePatch" in runtime
    for forbidden in [
        "fetch(", "XMLHttpRequest", "localStorage.", "MediaRecorder", "getUserMedia(",
        "new AudioContext", "new (window.AudioContext", "eval(", "new Function(",
    ]:
        assert forbidden not in runtime


def test_reference_match_only_uses_features_to_adjust_existing_patch():
    runtime = read("web/reference_match_runtime.js")
    assert "fftPower(samples)" in runtime
    assert "brightness" in runtime
    assert "transient" in runtime
    assert "sustain" in runtime
    assert "roughness" in runtime
    assert "midPresence" in runtime
    assert "lowBody" in runtime
    assert "Reference Matchは音声の特徴量だけを使って既存Patchを調整" in runtime
    assert "元音声そのものは使用していません" in runtime
    assert "samplePlayBtn" in runtime
    assert "同じフレーズでA/B比較" in runtime


def test_existing_blueprint_non_negotiable_pcm_and_artist_recording_guards_remain():
    blueprint = read("harness/app_blueprint.yaml")
    for token in [
        "pcm_resynthesis_must_use_locally_generated_factory_pcm_only",
        "pcm_resynthesis_must_not_fetch_network_or_load_third_party_samples",
        "pcm_factory_buffers_must_not_embed_third_party_artist_recordings",
        "all_web_audio_engines_must_share_single_audio_context",
        "generated_patch_must_be_schema_validated_and_clamped",
        "vst3_router_must_remain_final_note_event_wrapper",
    ]:
        assert token in blueprint
