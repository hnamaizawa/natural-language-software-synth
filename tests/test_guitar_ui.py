from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_guitar_runtime_is_loaded_after_patch_editor_runtime():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    assert 'src="/patch_editor_runtime.js"' in html
    assert 'src="/guitar_runtime.js"' in html
    assert html.index('/patch_editor_runtime.js') < html.index('/guitar_runtime.js')


def test_pcm_guitar_uses_audio_buffers_and_existing_note_contract():
    js = (ROOT / "web" / "guitar_runtime.js").read_text(encoding="utf-8")
    assert "createFactoryGuitarPCM" in js
    assert "GUITAR_ROOTS" in js
    assert "createBufferSource()" in js
    assert "engine.noteOn=function" in js
    assert "engine.noteOff=function" in js
    assert "playGuitarPCM" in js
    assert "new (window.AudioContext" not in js
    assert "new AudioContext" not in js


def test_guitar_amp_distortion_and_cabinet_are_exposed():
    js = (ROOT / "web" / "guitar_runtime.js").read_text(encoding="utf-8")
    for token in [
        "createWaveShaper()",
        "makeDistortionCurve",
        "guitar_amp_drive",
        "guitar_amp_model",
        "guitar_amp_tone",
        "guitar_amp_presence",
        "guitar_cabinet_mix",
        "guitar_chorus_mix",
    ]:
        assert token in js
    assert "GUITAR_PARAM_DEFS" in js
    assert 'input.type="range"' in js
    assert "engine.setPatchWithRender(validateGuitarExtras" in js


def test_guitar_sample_performances_cover_requested_styles_and_use_note_events():
    js = (ROOT / "web" / "guitar_runtime.js").read_text(encoding="utf-8")
    assert "ロック・リフ" in js
    assert "フュージョン・フレーズ" in js
    assert "アコースティック・アルペジオ" in js
    assert "GUITAR_SAMPLE_PERFORMANCES" in js
    sample_start = js.index("async function playGuitarSample()")
    sample_code = js[sample_start:]
    assert "engine.noteOn(" in sample_code
    assert "engine.noteOff(" in sample_code
    assert "createOscillator" not in sample_code
    assert "AudioContext" not in sample_code


def test_factory_guitar_runtime_does_not_reference_external_audio_assets():
    js = (ROOT / "web" / "guitar_runtime.js").read_text(encoding="utf-8")
    assert ".wav" not in js.lower()
    assert ".mp3" not in js.lower()
    assert "fetch(" not in js
