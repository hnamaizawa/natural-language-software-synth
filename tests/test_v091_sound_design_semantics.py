import re
from pathlib import Path

from ai_synth.timbre_variants import generate_patch

ROOT = Path(__file__).resolve().parents[1]


def _signature(p):
    return (
        p.instrument_model,
        p.resynth_source_a,
        p.resynth_source_b,
        round(p.resynth_morph, 2),
        p.resynth_harmonics,
        round(p.resynth_brightness, 2),
        round(p.resynth_pcm_mix, 2),
        round(p.resynth_transient_mix, 2),
        round(p.resynth_attack_s, 3),
        round(p.resynth_release_s, 2),
        round(p.delay_mix, 2),
    )


def test_sound_design_library_is_grouped_and_scalable():
    js = (ROOT / "web" / "resynthesis_runtime.js").read_text(encoding="utf-8")
    for token in [
        "const SOUND_LIBRARY_GROUPS=",
        '"実楽器 / PCM"',
        '"Pad / Atmosphere"',
        '"Keys / Organ"',
        '"Lead / Brass"',
        '"Pluck / Bell"',
        '"Bass"',
        '"Strings / Voice"',
        'id="soundPaletteCategory"',
        'id="soundPaletteSearch"',
        'id="soundPaletteGrid"',
        "all.length",
        "generate();",
    ]:
        assert token in js
    entries = re.findall(r'\["[^"\n]+","[^"\n]+"\]', js)
    assert len(entries) >= 40
    assert "new AudioContext" not in js
    assert "fetch(" not in js


def test_physical_instrument_words_can_be_timbre_hints_in_abstract_requests():
    piano_pad = generate_patch("ピアノのような柔らかく遠いパッド。長い余韻。")
    guitar_bell = generate_patch("ギター弦のような木質感を少し混ぜたベル。短く硬いアタック。")
    assert piano_pad.instrument_model == "spectral_resynth"
    assert guitar_bell.instrument_model == "spectral_resynth"
    assert piano_pad.resynth_source_a == "piano"
    assert guitar_bell.resynth_source_a == "guitar"


def test_explicit_physical_instruments_still_use_dedicated_engines():
    assert generate_patch("豊かなコンサートグランドピアノ").instrument_model == "grand_piano"
    assert generate_patch("クリーンなエレキギター").instrument_model == "electric_guitar"
    assert generate_patch("歌うフレットレスベース").instrument_model == "fretless_bass"
    assert generate_patch("タイトなドラムセット").instrument_model == "studio_drums"


def test_semantic_axes_produce_materially_different_patches():
    prompts = [
        "金属的で冷たく明るいベル。硬いアタック、近くドライ、短め。",
        "木質で暖かいプラック。柔らかいアタック、有機的で近い。",
        "息を含む遠いクワイアパッド。柔らかく広く、長い残響。",
        "暗く太いアナログベース。速いアタック、短くドライ。",
        "ざらついた金属的なリード。明るく硬く、広い。",
    ]
    patches = [generate_patch(prompt) for prompt in prompts]
    assert all(p.instrument_model == "spectral_resynth" for p in patches)
    assert len({_signature(p) for p in patches}) == len(patches)
    bell, pluck, choir, bass, lead = patches
    assert bell.resynth_brightness > pluck.resynth_brightness
    assert pluck.resynth_pcm_mix > bell.resynth_pcm_mix
    assert choir.resynth_noise_mix > bass.resynth_noise_mix
    assert choir.resynth_release_s > bass.resynth_release_s
    assert bass.octave_shift == -1
    assert lead.resynth_harmonics >= pluck.resynth_harmonics


def test_compound_categories_keep_secondary_character():
    pure_bell = generate_patch("明るいガラスのベル")
    bell_pad = generate_patch("明るいガラスのベルと、ゆっくり広がるパッドの中間。長い余韻。")
    pure_pad = generate_patch("ゆっくり広がる柔らかいパッド。長い余韻。")
    assert bell_pad.instrument_model == "spectral_resynth"
    assert bell_pad.resynth_attack_s > pure_bell.resynth_attack_s
    assert bell_pad.resynth_release_s > pure_bell.resynth_release_s
    assert bell_pad.resynth_transient_mix < pure_bell.resynth_transient_mix
    assert bell_pad.resynth_attack_s < pure_pad.resynth_attack_s or bell_pad.resynth_brightness > pure_pad.resynth_brightness


def test_metaphor_words_map_to_semantic_dimensions_without_external_ai():
    icy = generate_patch("氷と鋼のように冷たく透明で鋭い音。遠くに長く残る。")
    smoky = generate_patch("煙と霧のように柔らかく暖かい音。息っぽく遠い。")
    assert icy.instrument_model == "spectral_resynth"
    assert smoky.instrument_model == "spectral_resynth"
    assert icy.resynth_brightness > smoky.resynth_brightness
    assert smoky.resynth_noise_mix > icy.resynth_noise_mix
    assert icy.resynth_source_a == "piano"
