from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_graphical_parameter_editor_is_exposed_and_continuous():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
    runtime = (ROOT / "web" / "patch_editor_runtime.js").read_text(encoding="utf-8")
    css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")

    assert 'id="params"' in html
    assert 'id="resetParamsBtn"' in html
    assert 'src="/patch_editor_runtime.js"' in html
    assert "音色をグラフィカルに調整" in html
    assert "const PARAM_DEFS" in js
    assert 'input.type="range"' in js
    assert "function applyParam(" in js
    assert "engine.setPatchWithRender({...currentPatch,[key]:value},false)" in runtime
    assert "this.patch=validatePatch(raw)" in runtime
    assert "if(render)renderPatch()" in runtime
    assert ".param-dial" in css
    assert "conic-gradient" in css


def test_fretless_sampler_uses_pcm_audio_buffers_and_articulations():
    js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
    assert "createFactoryFretlessPCM" in js
    assert "FRETLESS_REGIONS" in js
    assert "createBuffer(1,length,this.ctx.sampleRate)" in js
    assert "createBufferSource()" in js
    assert "playFretlessArticulation(\"attack\"" in js
    assert "playFretlessArticulation(\"release\"" in js
    assert "playFretlessArticulation(\"slide\"" in js
    assert "finger_noise_mix" in js
    assert "mwah_amount" in js


def test_dx_style_ep_uses_dedicated_fm_engine():
    js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
    assert "playFM(midiNote" in js
    assert "fm_mod_index" in js
    assert "fm_ratio_1" in js
    assert "fm_ratio_2" in js
    assert "mg.connect(c.frequency)" in js
    assert "fm_chorus_mix" in js


def test_all_engines_share_one_audio_context_and_note_contract():
    js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
    assert js.count("new (window.AudioContext||window.webkitAudioContext)()") == 1
    assert "noteOn(midiNote,velocity=.85,whenSeconds=0)" in js
    assert "noteOff(midiNote,whenSeconds=0)" in js
    assert "window.synthEngine=engine" in js
