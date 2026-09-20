from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_adaptive_sample_runtime_is_loaded_between_library_and_vst3():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    token = '/adaptive_sample_performance_runtime.js'
    assert token in html
    assert html.index('/performance_library_runtime.js') < html.index(token)
    assert html.index(token) < html.index('/vst3_runtime.js')


def test_resynth_sample_phrases_cover_each_sound_design_family():
    js = (ROOT / "web" / "adaptive_sample_performance_runtime.js").read_text(encoding="utf-8")
    for token in [
        'bass:[["bass_groove"',
        'pad:[["pad_chords"',
        'keys:[["keys_chords"',
        'lead:[["lead_melody"',
        'pluck:[["pluck_arp"',
        'voice:[["strings_legato"',
        'bass_octaves:{label:"低音オクターブ"',
        'pad_swell:{label:"アンビエント・スウェル"',
        'brass_stabs:{label:"ブラス・スタブ"',
        'bell_sparse:{label:"ベル・単音余韻"',
        'voice_chords:{label:"クワイア・ロングコード"',
        'window.adaptiveSamplePerformance=',
    ]:
        assert token in js


def test_bass_evaluation_reaches_real_bass_register():
    js = (ROOT / "web" / "adaptive_sample_performance_runtime.js").read_text(encoding="utf-8")
    # C1/Eb1/G1-area material ensures a bass patch is not judged only in the C4 keyboard range.
    for note in ["[28]", "[31]", "[33]", "[35]", "[36]"]:
        assert note in js
    assert '評価カテゴリ: ${FAMILY_META[family][0]}' in js


def test_adaptive_preview_uses_existing_note_contract_only():
    js = (ROOT / "web" / "adaptive_sample_performance_runtime.js").read_text(encoding="utf-8")
    assert "engine.noteOn(note" in js
    assert "engine.noteOff(note" in js
    assert "stopSample({announce:false})" in js
    for forbidden in [
        "new AudioContext",
        "new (window.AudioContext",
        "fetch(",
        "XMLHttpRequest",
        "WebAssembly",
        "eval(",
        "new Function(",
        "localStorage.setItem",
    ]:
        assert forbidden not in js


def test_dedicated_instrument_sample_library_remains_the_base_path():
    js = (ROOT / "web" / "adaptive_sample_performance_runtime.js").read_text(encoding="utf-8")
    assert 'p.instrument_model==="spectral_resynth"' in js
    assert "const baseUpdateInstrumentSurface=updateInstrumentSurface" in js
    assert "baseUpdateInstrumentSurface();" in js
    # Non-resynthesis patches return null, so the existing piano/guitar/fretless/drum/FM
    # sample-performance dispatcher continues to own those instruments.
    assert "?familyFromText(p):null" in js
