from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_drum_surface_and_prompt_chip_are_exposed():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    assert 'id="drumKitWrap"' in html
    assert 'id="drumKit"' in html
    assert 'id="keyboardWrap"' in html
    assert "PCM Shuffle Drums" in html
    assert "ロザーナー" in html


def test_drum_engine_uses_pcm_buffer_and_single_audio_context():
    js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
    assert "playDrumPCM(midiNote" in js
    assert "createFactoryDrumPCM" in js
    assert "DRUM_REGIONS" in js
    assert "createBufferSource()" in js
    assert "canonicalDrumNote" in js
    assert 'this.patch.engine_type==="drum"' in js
    assert js.count("new (window.AudioContext||window.webkitAudioContext)()") == 1
    assert "engine.noteOn(" in js
    assert "engine.noteOff(" in js


def test_drum_sample_performance_exists():
    js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
    assert "drum_shuffle" in js
    assert "buildHalfTimeShuffleSteps" in js
    assert "ハーフタイム・シャッフル" in js
