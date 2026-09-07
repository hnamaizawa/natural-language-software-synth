from pathlib import Path

from ai_synth.patch import validate_patch
from ai_synth.prompt_engine import generate_patch

ROOT = Path(__file__).resolve().parents[1]


def test_grand_piano_prompt_selects_pcm_sampler_without_breaking_dx_ep():
    p = generate_patch("コンサートホールで弾くような豊かなグランドピアノ")
    assert p.engine_type == "sampler"
    assert p.instrument_model == "grand_piano"
    assert p.piano_hammer_mix >= 0.5
    assert p.piano_resonance >= 0.6
    assert p.max_polyphony == 16

    dx = generate_patch("80年代の DX-7 のような FM エレピ")
    assert dx.engine_type == "fm"
    assert dx.instrument_model == "dx_ep"


def test_grand_piano_parameters_are_clamped():
    p = validate_patch({
        "engine_type": "sampler",
        "instrument_model": "grand_piano",
        "piano_tone": 99,
        "piano_hammer_mix": -1,
        "piano_resonance": 4,
        "piano_damper_noise": -2,
        "piano_softness": 7,
        "piano_sustain": 0,
        "piano_velocity_curve": 99,
        "piano_room_mix": 5,
    })
    assert p.instrument_model == "grand_piano"
    assert p.piano_tone == 1
    assert p.piano_hammer_mix == 0
    assert p.piano_resonance == 1
    assert p.piano_damper_noise == 0
    assert p.piano_softness == 1
    assert p.piano_sustain == 0.2
    assert p.piano_velocity_curve == 2
    assert p.piano_room_mix == 0.5


def test_fretless_finger_articulation_is_materially_stronger():
    p = generate_patch("歌うフレットレスベース。指弾きのフィンガーノイズをしっかり聞かせて。")
    assert p.instrument_model == "fretless_bass"
    assert p.finger_noise_mix >= 0.82
    assert p.sample_attack_mix >= 0.60


def test_piano_runtime_uses_pcm_and_existing_audio_context():
    js = (ROOT / "web" / "piano_runtime.js").read_text(encoding="utf-8")
    for token in [
        "PIANO_ROOTS",
        "createFactoryPianoPCM",
        "createBufferSource()",
        "playGrandPianoPCM",
        "piano_hammer_mix",
        "piano_damper_noise",
        "playPianoNoise(\"hammer\"",
        "playPianoNoise(\"damper\"",
        "engine.setPatchWithRender(validatePianoExtras",
    ]:
        assert token in js
    assert "new AudioContext" not in js
    assert "new (window.AudioContext" not in js
    assert ".wav" not in js.lower()
    assert ".mp3" not in js.lower()
    assert "fetch(" not in js


def test_v050_runtime_load_order_and_custom_phrase_ui():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    for script in [
        "/guitar_runtime.js",
        "/piano_runtime.js",
        "/instrument_performance_runtime.js",
        "/performance_library_runtime.js",
        "/output_level_runtime.js",
    ]:
        assert f'src="{script}"' in html
    assert html.index("/guitar_runtime.js") < html.index("/piano_runtime.js")
    assert html.index("/piano_runtime.js") < html.index("/instrument_performance_runtime.js")
    assert html.index("/instrument_performance_runtime.js") < html.index("/performance_library_runtime.js")
    assert html.index("/performance_library_runtime.js") < html.index("/output_level_runtime.js")
    for control in [
        "customSampleInstrument",
        "customSampleBpm",
        "customSampleName",
        "customSampleSteps",
        "customSampleSaveBtn",
        "customSampleDeleteBtn",
        "customSampleStatus",
    ]:
        assert f'id="{control}"' in html


def test_custom_phrase_library_is_local_bounded_and_uses_note_contract():
    js = (ROOT / "web" / "performance_library_runtime.js").read_text(encoding="utf-8")
    for token in [
        'CUSTOM_STORAGE_KEY="nlss.customSamplePhrases.v1"',
        "localStorage.getItem",
        "localStorage.setItem",
        "MAX_CUSTOM_PHRASES=50",
        "MAX_CUSTOM_STEPS=128",
        "parseCustomSteps",
        "noteTokenToMidi",
        "saveCustomPhrase",
        "deleteCustomPhrase",
        "engine.noteOn(",
        "engine.noteOff(",
    ]:
        assert token in js
    assert "fetch(" not in js
    assert "createOscillator" not in js
    assert "new AudioContext" not in js
    assert "new (window.AudioContext" not in js


def test_guitar_chords_are_strummed_with_nonzero_note_offsets():
    js = (ROOT / "web" / "performance_library_runtime.js").read_text(encoding="utf-8")
    for token in [
        "function guitarStrumInterval()",
        'style==="acoustic"?.028',
        'style==="rock"?.018',
        'style==="fusion"?.016',
        "orderGuitarEvents",
        "offset=index*interval",
        "engine.noteOn(note,clamp(Number(e.velocity??.84),.05,1),offset)",
        "engine.noteOff(note,offset)",
        'strum:"down"',
        'strum:"up"',
    ]:
        assert token in js


def test_expanded_genre_library_covers_requested_and_additional_styles():
    js = (ROOT / "web" / "performance_library_runtime.js").read_text(encoding="utf-8")
    for label in [
        "ポップ・アルペジオ",
        "EDM・シーケンス",
        "アンビエント・コード",
        "ファンク・ベース",
        "フュージョン・フレットレス",
        "シティポップ・エレピ",
        "クラシック・アルペジオ",
        "ブギウギ・ピアノ",
        "ロック・ドラム",
        "ファンク・ドラム",
        "ボサノバ・ドラム",
        "ブルース・ギター",
        "ファンク・カッティング",
        "ポップ・ストローク",
        "ボサノバ・ギター",
    ]:
        assert label in js


def test_output_level_runtime_knows_grand_piano_and_remains_bounded():
    js = (ROOT / "web" / "output_level_runtime.js").read_text(encoding="utf-8")
    assert "grand_piano:1.03" in js
    assert 'p&&p.instrument_model==="grand_piano"' in js
    assert "clamp(trim,.82,1.22)" in js
