from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATCH_EDITOR = (ROOT / "web" / "patch_editor_runtime.js").read_text(encoding="utf-8")


def test_sound_design_preview_reuses_existing_sample_performance_button():
    for token in [
        'preview.id="soundDesignPreviewBtn"',
        'document.getElementById("samplePlayBtn")',
        'if(play&&!play.disabled)play.click()',
        '▶ この音色でサンプル演奏',
    ]:
        assert token in PATCH_EDITOR


def test_sound_palette_has_japanese_and_english_instant_label_switch():
    for token in [
        "const SOUND_LABELS_JA=Object.freeze({",
        '"Grand Piano":"グランドピアノ"',
        '"Fretless Bass":"フレットレス・ベース"',
        '"Warm Analog Pad":"ウォーム・アナログ・パッド"',
        '"Glass Bell":"グラス・ベル"',
        '"Dark Analog Bass":"ダーク・アナログ・ベース"',
        '"Pizzicato Strings":"ピチカート・ストリングス"',
        'ja.id="paletteLanguageJa"',
        'en.id="paletteLanguageEn"',
        'paletteLanguage="ja"',
        'paletteLanguage="en"',
        "applyPaletteLanguage()",
        "MutationObserver",
    ]:
        assert token in PATCH_EDITOR


def test_palette_and_sound_design_controls_have_japanese_hover_help():
    for token in [
        "const CONTROL_HELP_JA=Object.freeze({",
        'soundDesignPreviewBtn:"現在の音色を',
        'paletteLanguageJa:"SOUND DESIGNの音色名',
        'paletteLanguageEn:"SOUND DESIGNの音色名',
        'button.title=japaneseHelp(button,en)',
        '（クリックするとこの音色を生成します）',
        'document.querySelectorAll("#soundDesign button")',
    ]:
        assert token in PATCH_EDITOR


def test_v0102_ux_layer_does_not_create_audio_network_or_generated_code_path():
    for forbidden in [
        "new AudioContext",
        "new (window.AudioContext",
        "fetch(",
        "XMLHttpRequest",
        "MediaRecorder",
        "eval(",
        "new Function(",
        "localStorage",
    ]:
        assert forbidden not in PATCH_EDITOR


def test_japanese_label_dictionary_covers_all_45_sound_library_buttons():
    expected_labels = [
        "Grand Piano", "Soft Grand", "Rock Guitar", "Fusion Guitar", "Acoustic Guitar", "Fretless Bass",
        "Dry Drums", "Shuffle Drums", "DX-style EP", "Warm Analog Pad", "Airy Choir Pad", "Dark Cinematic Pad",
        "Glass Ambient Pad", "Dreamy Wide Pad", "Organic String Pad", "Analog Synth Keys", "Bright Poly Keys",
        "Crystal Keys", "Soft Bell Keys", "PCM Organ", "Retro Polysynth", "Synth Brass", "Soft Brass",
        "Singing Lead", "Metallic Lead", "Wide Fusion Lead", "Airy Solo Lead", "Glass Bell", "Crystal Bell",
        "Wooden Pluck", "Harp Pluck", "Marimba Hybrid", "Digital Pluck", "Warm Synth Bass", "Dark Analog Bass",
        "Acid Bass", "Plucked Bass", "Air Bass", "Metal Bass", "String Ensemble", "Soft Strings", "Airy Choir",
        "Dark Choir", "Vocal Pad", "Pizzicato Strings",
    ]
    assert len(expected_labels) == 45
    for label in expected_labels:
        assert f'"{label}":' in PATCH_EDITOR
