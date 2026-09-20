from pathlib import Path

from ai_synth.patch import validate_patch
from ai_synth.timbre_variants import generate_patch

ROOT = Path(__file__).resolve().parents[1]


def test_resynthesis_patch_contract_is_clamped():
    patch = validate_patch(
        {
            "engine_type": "sampler",
            "instrument_model": "spectral_resynth",
            "resynth_source_a": "unknown",
            "resynth_source_b": "fretless",
            "resynth_morph": 3,
            "resynth_harmonics": 99,
            "resynth_brightness": -2,
            "resynth_pcm_mix": 4,
            "resynth_transient_mix": -1,
            "resynth_detune_cents": 120,
            "resynth_noise_mix": 4,
            "resynth_attack_s": 99,
            "resynth_release_s": 99,
        }
    )
    assert patch.instrument_model == "spectral_resynth"
    assert patch.resynth_source_a == "piano"
    assert patch.resynth_source_b == "fretless"
    assert patch.resynth_morph == 1
    assert patch.resynth_harmonics == 32
    assert patch.resynth_brightness == 0
    assert patch.resynth_pcm_mix == 0.65
    assert patch.resynth_transient_mix == 0
    assert patch.resynth_detune_cents == 30
    assert patch.resynth_noise_mix == 0.35
    assert patch.resynth_attack_s == 8
    assert patch.resynth_release_s == 10


def test_broad_descriptions_select_different_pcm_source_models():
    bell = generate_patch("ガラスのように明るい金属的なベル")
    pluck = generate_patch("木質で短いアタックのプラック")
    choir = generate_patch("息の成分があるエアリーなクワイアパッド")
    bass = generate_patch("太くて暗いアナログベース")

    assert all(p.instrument_model == "spectral_resynth" for p in [bell, pluck, choir, bass])
    signatures = {
        (p.resynth_source_a, p.resynth_source_b, p.resynth_harmonics, round(p.resynth_attack_s, 3))
        for p in [bell, pluck, choir, bass]
    }
    assert len(signatures) == 4
    assert bell.resynth_brightness > choir.resynth_brightness
    assert pluck.resynth_transient_mix > choir.resynth_transient_mix
    assert choir.resynth_release_s > pluck.resynth_release_s


def test_browser_runtime_analyzes_factory_pcm_and_reconstructs_periodic_waves():
    js = (ROOT / "web" / "resynthesis_runtime.js").read_text(encoding="utf-8")
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")

    for token in [
        'engine.sampleBuffers.get("piano_60")',
        'engine.sampleBuffers.get("guitar_64")',
        'engine.sampleBuffers.get("fretless")',
        "function harmonicTemplate(name,harmonics)",
        "Math.hypot(re,im)",
        "createPeriodicWave",
        "playPcmLayer",
        'kind:"resynth"',
        "engine.playSpectralResynth",
        "resynth_source_a",
        "resynth_source_b",
    ]:
        assert token in js

    for forbidden in ["new AudioContext", "new (window.AudioContext", "fetch(", "XMLHttpRequest", "WebAssembly", "eval("]:
        assert forbidden not in js

    assert 'src="/resynthesis_runtime.js"' in html
    assert html.index('/piano_runtime.js') < html.index('/resynthesis_runtime.js')
    assert html.index('/resynthesis_runtime.js') < html.index('/instrument_performance_runtime.js')
    assert html.index('/resynthesis_runtime.js') < html.index('/vst3_runtime.js')


def test_pcm_resynthesis_does_not_replace_dedicated_physical_instruments():
    piano = generate_patch("明るいコンサートグランドピアノ")
    guitar = generate_patch("暖かいクリーンのエレキギター")
    drums = generate_patch("タイトでドライなドラムセット")
    assert piano.instrument_model == "grand_piano"
    assert guitar.instrument_model == "electric_guitar"
    assert drums.instrument_model == "studio_drums"
