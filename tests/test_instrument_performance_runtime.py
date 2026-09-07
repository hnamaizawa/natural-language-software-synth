from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_instrument_runtime_loads_after_guitar_extension():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    assert 'src="/guitar_runtime.js"' in html
    assert 'src="/instrument_performance_runtime.js"' in html
    assert html.index('/guitar_runtime.js') < html.index('/instrument_performance_runtime.js')


def test_guitar_routing_requires_explicit_instrument_model():
    js = (ROOT / "web" / "instrument_performance_runtime.js").read_text(encoding="utf-8")
    assert 'p.instrument_model === "electric_guitar"' in js
    assert "delete sanitized.guitar_amp_model" in js
    assert "guitarAwareValidatePatch(sanitized)" in js


def test_sample_options_are_routed_by_instrument_model():
    js = (ROOT / "web" / "instrument_performance_runtime.js").read_text(encoding="utf-8")
    for model in ["electric_guitar", "fretless_bass", "studio_drums", "dx_ep", "generic"]:
        assert model in js
    assert "instrumentKey(currentPatch)" in js
    assert "const OPTIONS=Object.freeze" in js


def test_every_instrument_has_a_jazz_sample_performance():
    js = (ROOT / "web" / "instrument_performance_runtime.js").read_text(encoding="utf-8")
    for token in [
        "ジャズ・シンセリード",
        "ジャズ・ウォーキングベース",
        "ジャズ・エレピ・4度堆積ボイシング",
        "ジャズ・スウィング",
        "ジャズ・4度堆積コンピング",
    ]:
        assert token in js


def test_drum_surface_and_pc_keymap_stay_in_drum_mode():
    js = (ROOT / "web" / "instrument_performance_runtime.js").read_text(encoding="utf-8")
    assert 'p.instrument_model === "studio_drums" || p.engine_type === "drum"' in js
    assert 'document.getElementById("keyboardWrap").hidden=drum' in js
    assert 'document.getElementById("drumKitWrap").hidden=!drum' in js
    assert "isDrumPatch(currentPatch) ? DRUM_KEY_MAP : SYNTH_KEY_MAP" in js


def test_unified_sample_player_uses_existing_note_event_contract():
    js = (ROOT / "web" / "instrument_performance_runtime.js").read_text(encoding="utf-8")
    start = js.index("async function playInstrumentSample()")
    sample_code = js[start:]
    assert "engine.noteOn(" in sample_code
    assert "engine.noteOff(" in sample_code
    assert "createOscillator" not in sample_code
    assert "new AudioContext" not in sample_code
    assert "oldPlayButton.replaceWith(playButton)" in sample_code
