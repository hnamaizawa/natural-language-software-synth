from hashlib import sha256
from pathlib import Path

from ai_synth.patch import validate_patch

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_cc0_pcm_asset_has_pinned_provenance_and_checksum():
    asset = ROOT / "web/assets/pcm/vcsl/tenor_sax_c3.wav"
    notice = read("web/assets/pcm/vcsl/LICENSE.md")
    digest = sha256(asset.read_bytes()).hexdigest()
    assert digest == "4afeef41e7f3a5df8c47a3f31389b5948837fe8b21c9e3e9e135829e44050677"
    assert digest in notice
    assert "CC0 1.0 Universal" in notice
    assert "c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e" in notice


def test_licensed_pcm_patch_is_schema_validated_and_clamped():
    patch = validate_patch({"engine_type": "sampler", "instrument_model": "licensed_pcm", "pcm_tone": 4, "pcm_attack_s": -1, "pcm_release_s": 99})
    assert patch.instrument_model == "licensed_pcm"
    assert patch.pcm_instrument == "tenor_sax"
    assert patch.pcm_tone == 1
    assert patch.pcm_attack_s == .001
    assert patch.pcm_release_s == 3


def test_pcm_runtime_reuses_audio_context_and_only_loads_same_origin_asset():
    runtime = read("web/licensed_pcm_runtime.js")
    assert 'SOURCE="/assets/pcm/vcsl/tenor_sax_c3.wav"' in runtime
    assert "this.ctx.decodeAudioData(bytes)" in runtime
    assert "baseOn=engine.noteOn.bind(engine)" in runtime
    assert "baseOff=engine.noteOff.bind(engine)" in runtime
    assert "new AudioContext" not in runtime
    assert "webkitAudioContext" not in runtime
    assert "localStorage" not in runtime


def test_practical_presets_include_cc0_and_mix_ready_choices():
    runtime = read("web/reference_match_runtime.js")
    for preset in ["studio_tenor_sax", "pop_close_grand", "neo_soul_ep", "pop_pocket_drums"]:
        assert f'id: "{preset}"' in runtime


def test_hover_help_covers_parameters_and_dynamic_ui_without_side_effects():
    html = read("web/index.html")
    help_runtime = read("web/ui_help_runtime.js")
    assert html.index('/vst3_runtime.js') < html.index('/ui_help_runtime.js')
    for key in ["osc1_wave", "filter_cutoff_hz", "sample_tone", "guitar_amp_drive", "piano_hammer_mix", "pcm_tone", "kick_tune_hz", "fm_mod_index", "resynth_morph", "master_gain"]:
        assert f'{key}:"' in help_runtime
    assert "MutationObserver" in help_runtime
    assert 'button,select,input,textarea,summary,.key,.drum-pad' in help_runtime
    for forbidden in ["fetch(", "localStorage", "AudioContext", "eval(", "new Function("]:
        assert forbidden not in help_runtime
