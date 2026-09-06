from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_web_audio_contract_is_stable():
    js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
    assert "noteOn(midiNote" in js
    assert "noteOff(midiNote" in js
    assert "setPatch(raw)" in js
    assert "window.synthEngine=engine" in js


def test_no_eval_or_dynamic_script_injection():
    js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
    assert "eval(" not in js
    assert "new Function(" not in js
    assert "createElement(\"script\")" not in js
