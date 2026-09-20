from pathlib import Path

from ai_synth.timbre_variants import generate_patch

ROOT = Path(__file__).resolve().parents[1]


def test_vst3_reload_restores_performance_keyboard_focus_without_diagnostics():
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    for token in [
        "function isHostControl(active)",
        "function restorePerformanceFocus()",
        "function restorePerformanceFocusSoon()",
        "params?.contains(active)",
        "await refreshParameters();",
        "restorePerformanceFocusSoon();",
        "requestAnimationFrame",
    ]:
        assert token in js
    load_start = js.index("async function load()")
    diagnostics_start = js.index("async function diagnostics()")
    load_body = js[load_start:diagnostics_start]
    assert "restorePerformanceFocusSoon()" in load_body


def test_same_instance_native_vst3_editor_is_exposed_only_through_native_host():
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    native = (ROOT / "native" / "vst3_host" / "src" / "main.cpp").read_text(encoding="utf-8")
    editor = (ROOT / "native" / "vst3_host" / "src" / "plugin_editor_win32.cpp").read_text(encoding="utf-8")

    assert '"/api/vst3/editor/open"' in js
    assert '"/api/vst3/editor/open"' in server
    assert 'self._command("EDITOR_OPEN")' in server
    assert 'parts[0] == "EDITOR_OPEN"' in native
    for token in [
        "createView (Steinberg::Vst::ViewType::kEditor)",
        "Steinberg::kPlatformTypeHWND",
        "view_->attached",
        "IComponentHandler",
        "performEdit",
        "restartComponent",
    ]:
        assert token in editor
    assert "kParamValuesChanged" in native
    assert ".vst3" not in js.lower()


def test_new_natural_language_timbre_archetypes_are_distinct_and_bounded():
    cases = {
        "広がりのあるシンセストリングス": "String Ensemble",
        "パンチのあるシンセブラス": "Synth Brass",
        "エアリーなクワイアのボイスパッド": "Airy Choir Pad",
        "80年代の太いポリシンセ": "Retro Polysynth",
        "レゾナンスの強いアシッドベース": "Resonant Acid Bass",
        "柔らかいアナログのシンセキー": "Analog Synth Keys",
    }
    seen = set()
    for prompt, expected_name in cases.items():
        patch = generate_patch(prompt)
        assert patch.engine_type == "synth"
        assert expected_name in patch.name
        assert 80 <= patch.filter_cutoff_hz <= 18000
        assert 0.1 <= patch.filter_q <= 18
        assert 0.001 <= patch.attack_s <= 8
        assert 0.01 <= patch.release_s <= 10
        assert 0.02 <= patch.master_gain <= 0.35
        seen.add((patch.osc1_wave, patch.osc2_wave, round(patch.filter_cutoff_hz), round(patch.attack_s, 3)))
    assert len(seen) >= 5


def test_existing_prompt_routes_still_fall_back_to_legacy_generator():
    patch = generate_patch("コンサートホールで弾く豊かなグランドピアノ")
    assert patch.instrument_model == "grand_piano"
    patch = generate_patch("ジャコのような歌うフレットレスベース")
    assert patch.instrument_model == "fretless_bass"
