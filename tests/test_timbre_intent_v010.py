from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = (ROOT / "web" / "timbre_intent_runtime.js").read_text(encoding="utf-8")
HTML = (ROOT / "web" / "index.html").read_text(encoding="utf-8")


def test_v010_static_runtime_is_loaded_before_final_vst3_wrapper():
    assert '<script src="/timbre_intent_runtime.js"></script>' in HTML
    assert HTML.index('/adaptive_sample_performance_runtime.js') < HTML.index('/timbre_intent_runtime.js')
    assert HTML.index('/timbre_intent_runtime.js') < HTML.index('/vst3_runtime.js')
    assert "v0.10.0 audio" in HTML


def test_timbre_intent_schema_is_inspectable_and_bounded():
    for token in [
        'schema_version:"1.0"',
        'parser:"local-deterministic-v1"',
        'material:{wood:',
        'envelope:{attack_speed:',
        'spectrum:{brightness:',
        'texture:{hardness:',
        'space:{width:',
        'performance:{register:',
        'clamp01(',
    ]:
        assert token in RUNTIME


def test_semantic_influence_axes_cover_requested_language_dimensions():
    expected = [
        'brightness:{label:"明るさ"',
        'warmth:{label:"暖かさ"',
        'hardness:{label:"硬さ"',
        'attack_speed:{label:"Attack速度"',
        'length:{label:"音の長さ"',
        'wood:{label:"木質"',
        'metal:{label:"金属/ガラス"',
        'organic:{label:"有機感"',
        'roughness:{label:"粗さ/ノイズ"',
        'thickness:{label:"太さ/密度"',
        'percussive:{label:"パーカッシブ"',
    ]
    for token in expected:
        assert token in RUNTIME
    assert "かなり|とても|非常に|強く|もっと" in RUNTIME
    assert "少し|やや|ほんの|軽く" in RUNTIME
    assert "ではない|じゃない|ではなく" in RUNTIME


def test_three_candidates_are_distinct_profiles_but_use_validated_patch_path():
    for candidate_id, label in [("A", "Balanced"), ("B", "Organic"), ("C", "Experimental")]:
        assert f'id:"{candidate_id}",label:"{label}"' in RUNTIME
    assert "return validatePatch(p);" in RUNTIME
    assert "generatedPatch=validatePatch(candidate.patch)" in RUNTIME
    assert "engine.setPatch(generatedPatch)" in RUNTIME
    assert "buildCandidates(base,intent)" in RUNTIME


def test_intent_drives_audible_patch_parameters_instead_of_only_labels():
    for parameter in [
        "resynth_brightness",
        "resynth_harmonics",
        "resynth_pcm_mix",
        "resynth_transient_mix",
        "resynth_noise_mix",
        "resynth_detune_cents",
        "resynth_attack_s",
        "resynth_release_s",
        "filter_cutoff_hz",
        "sample_tone",
        "guitar_body_tone",
        "piano_tone",
        "fm_brightness",
        "drum_brightness",
    ]:
        assert parameter in RUNTIME


def test_manual_intent_edit_and_delta_refinement_preserve_unmentioned_axes():
    assert 'data-intent-path="${path}"' in RUNTIME
    assert "setPath(state.intent,path,Number(input.value))" in RUNTIME
    assert "function refineIntent(current,instruction)" in RUNTIME
    assert "next=deepCopy(current)" in RUNTIME
    assert "mentioned=mentionedPaths(instruction)" in RUNTIME
    assert "for(const axis of mentioned)" in RUNTIME
    assert 'next.prompt=current.prompt' in RUNTIME


def test_abc_comparison_reuses_the_same_sample_performance_selection():
    assert 'phrase=document.getElementById("sampleSelect").value' in RUNTIME
    assert 'if(Array.from(select.options).some(option=>option.value===phrase))select.value=phrase' in RUNTIME
    assert 'document.getElementById("samplePlayBtn").click()' in RUNTIME
    assert "waitForPlayback()" in RUNTIME


def test_timbre_intent_runtime_does_not_create_executable_or_parallel_audio_path():
    for forbidden in ["eval(", "new Function(", "new AudioContext", "new (window.AudioContext", "MediaRecorder", "WebAssembly"]:
        assert forbidden not in RUNTIME
    assert 'fetch("/api/generate-patch"' in RUNTIME
    assert "http://" not in RUNTIME
    assert "https://" not in RUNTIME
