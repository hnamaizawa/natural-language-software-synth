from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_sample_performance_controls_are_exposed():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    for control_id in ["sampleSelect", "samplePlayBtn", "sampleStopBtn"]:
        assert f'id="{control_id}"' in html
    assert "現在の音色でサンプル演奏" in html


def test_sample_performance_uses_stable_synth_event_contract():
    js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
    assert "const SAMPLE_PERFORMANCES" in js
    assert "async function playSample()" in js
    assert "function stopSample(" in js

    sample_start = js.index("async function playSample()")
    sample_end = js.index("async function generate()")
    sample_code = js[sample_start:sample_end]
    assert "engine.noteOn(" in sample_code
    assert "engine.noteOff(" in sample_code
    assert "createOscillator" not in sample_code
    assert "new AudioContext" not in sample_code
