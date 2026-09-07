from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_output_level_runtime_loads_last():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    assert 'src="/instrument_performance_runtime.js"' in html
    assert 'src="/output_level_runtime.js"' in html
    assert html.index('/instrument_performance_runtime.js') < html.index('/output_level_runtime.js')


def test_output_level_runtime_uses_bounded_trim_and_gentle_compressor():
    js = (ROOT / "web" / "output_level_runtime.js").read_text(encoding="utf-8")
    for token in [
        "LEVEL_TRIMS",
        "perceivedLevelTrim",
        "createDynamicsCompressor()",
        "leveler.threshold.value=-18",
        "leveler.ratio.value=2.5",
        "this.master.disconnect(this.analyser)",
        "this.master.connect(leveler)",
        "leveler.connect(this.analyser)",
        "normalizedVelocity=clamp",
        "baseNoteOn(midiNote,normalizedVelocity,whenSeconds)",
    ]:
        assert token in js
    assert "new AudioContext" not in js
    assert "new (window.AudioContext" not in js
    assert "createGain()" not in js


def test_all_instrument_models_have_level_calibration():
    js = (ROOT / "web" / "output_level_runtime.js").read_text(encoding="utf-8")
    for model in ["generic", "fretless_bass", "studio_drums", "dx_ep", "electric_guitar"]:
        assert model in js
    assert "clamp(trim,.82,1.22)" in js
    assert 'amp==="high_gain"' in js
    assert 'amp==="acoustic"' in js
    assert "filter_cutoff_hz" in js


def test_jazz_chord_voicings_are_quartal_not_tertian():
    js = (ROOT / "web" / "instrument_performance_runtime.js").read_text(encoding="utf-8")
    assert "function quartalVoicing(root,size=4)" in js
    assert "root+index*5" in js
    assert "ジャズ・エレピ・4度堆積ボイシング" in js
    assert "ジャズ・4度堆積コンピング" in js
    assert "notes:quartalVoicing(48)" in js
    assert "notes:quartalVoicing(43)" in js
    assert "{notes:[52,55,59,62],beats:2}" not in js
    assert "{notes:[40,50,55,59],beats:1.5" not in js


def test_output_normalization_keeps_master_gain_contract_untouched():
    app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
    output_js = (ROOT / "web" / "output_level_runtime.js").read_text(encoding="utf-8")
    assert "master_gain:clamp(p.master_gain,.02,.35)" in app_js
    assert "this.master.gain.setTargetAtTime(this.patch.master_gain" in app_js
    assert "this.master.gain" not in output_js
    assert "createGain()" not in output_js
