from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_keyboard_recorder_and_vst3_program_controls_are_present():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    for control_id in [
        "vst3ProgramSelect",
        "vst3ProgramPrevBtn",
        "vst3ProgramNextBtn",
        "vst3ProgramStatus",
        "keyboardRecordBtn",
        "keyboardRecordStopBtn",
        "keyboardRecordPlayBtn",
        "keyboardRecordClearBtn",
        "keyboardRecordStatus",
        "keyboardRecordingRoll",
    ]:
        assert f'id="{control_id}"' in html
    assert 'href="/keyboard_performance.css"' in html
    assert 'src="/keyboard_performance_runtime.js"' in html
    assert html.index('/keyboard_performance_runtime.js') < html.index('/vst3_runtime.js')


def test_pc_keyboard_recording_stays_on_note_event_boundary_and_is_bounded():
    js = (ROOT / "web" / "keyboard_performance_runtime.js").read_text(encoding="utf-8")
    for token in [
        "MAX_NOTES=512",
        "MAX_DURATION_MS=120000",
        "currentKeyMap()",
        "engine.noteOn(item.note,item.velocity)",
        "engine.noteOff(item.note)",
        "performance.now()",
        "keyboardRecordingRoll",
    ]:
        assert token in js
    for forbidden in ["new AudioContext", "new (window.AudioContext", "MediaRecorder", "localStorage", "fetch("]:
        assert forbidden not in js


def test_vst3_route_focus_no_longer_blocks_pc_shortcuts():
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    assert "route.blur()" in js
    assert 'input.addEventListener("change",()=>input.blur())' in js
    assert 'programSelect.blur()' in js
    assert "鍵盤・PCキー・MIDI" in js


def test_vst3_program_selector_uses_discrete_program_parameter_and_existing_bounded_endpoint():
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    for token in [
        "findProgramParameter",
        "program_change===true",
        "step_count",
        "setProgramIndex",
        'api("/api/vst3/parameter",{id:programParameter.id,value})',
        "i/steps",
        "Math.min(steps+1,512)",
    ]:
        assert token in js


def test_keyboard_visuals_include_beveled_keys_and_recorded_piano_roll():
    css = (ROOT / "web" / "keyboard_performance.css").read_text(encoding="utf-8")
    for token in [
        ".keyboard-stage .key.white",
        ".keyboard-stage .key.black",
        ".keyboard-stage .key.active.white",
        ".keyboard-stage .key.active.black",
        ".key-note-name",
        ".key-shortcut",
        ".recording-roll-grid",
        ".recording-note",
        ".vst3-program-panel",
    ]:
        assert token in css
