from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_realistic_preset_selection_survives_language_rerender():
    runtime = read("web/reference_match_runtime.js")
    for token in [
        'selectedPresetId: ""',
        "state.selectedPresetId = preset.id",
        "state.selectedPresetId === preset.id",
        'realistic-preset-button${selected ? " selected" : ""}',
        'button.setAttribute("aria-pressed", String(selected))',
        'content:"✓ 選択中"',
    ]:
        assert token in runtime


def test_sound_palette_selection_survives_filter_rerender():
    runtime = read("web/patch_editor_runtime.js")
    for token in [
        'let selectedPalettePrompt=""',
        'selectedPalettePrompt=button.dataset.prompt||""',
        "button.dataset.prompt===selectedPalettePrompt",
        'button.classList.toggle("selected",selected)',
        'button.setAttribute("aria-pressed",String(selected))',
        "installPaletteSelection()",
        '#soundPaletteGrid button.selected::after{content:"✓ 選択中"',
    ]:
        assert token in runtime


def test_candidate_and_reference_choices_expose_selected_state():
    intent = read("web/timbre_intent_runtime.js")
    reference = read("web/reference_match_runtime.js")
    assert 'button.setAttribute("aria-pressed",String(selected))' in intent
    assert '.ti-candidate.active::after{content:"✓ 選択中"' in intent
    assert 'original.setAttribute("aria-pressed", String(selected))' in reference
    assert 'matched.setAttribute("aria-pressed", String(selected))' in reference
    assert '.rm-compare button.active::after' in reference


def test_selection_highlight_adds_no_audio_network_or_storage_path():
    runtime = read("web/patch_editor_runtime.js")
    for forbidden in [
        "new AudioContext", "new (window.AudioContext", "fetch(", "XMLHttpRequest",
        "MediaRecorder", "eval(", "new Function(", "localStorage",
    ]:
        assert forbidden not in runtime
