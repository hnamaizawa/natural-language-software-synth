from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_main_workflow_is_ordered_by_user_task():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    for control_id in [
        "soundDesign",
        "soundSource",
        "performance",
        "recordingStudio",
        "recordingKeyboardTab",
        "recordingHummingTab",
        "recordingKeyboardPane",
        "recordingHummingPane",
    ]:
        assert f'id="{control_id}"' in html
    assert html.index('id="soundDesign"') < html.index('id="soundSource"')
    assert html.index('id="soundSource"') < html.index('id="performance"')
    assert html.index('id="performance"') < html.index('id="recordingStudio"')
    assert 'src="/recording_workspace_runtime.js"' in html
    assert html.index('/keyboard_performance_runtime.js') < html.index('/recording_workspace_runtime.js')
    assert html.index('/recording_workspace_runtime.js') < html.index('/vst3_runtime.js')


def test_keyboard_and_humming_recorders_share_one_recording_studio():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    studio_start = html.index('id="recordingStudio"')
    studio_end = html.index('class="meter-wrap"', studio_start)
    studio = html[studio_start:studio_end]
    for control_id in [
        "keyboardRecordBtn",
        "keyboardRecordingRoll",
        "hummingStartBtn",
        "hummingResult",
        "hummingScore",
    ]:
        assert f'id="{control_id}"' in studio
    assert 'role="tablist"' in studio
    assert 'role="tabpanel"' in studio


def test_recording_workspace_tabs_are_ui_only_and_do_not_create_audio_paths():
    js = (ROOT / "web" / "recording_workspace_runtime.js").read_text(encoding="utf-8")
    for token in [
        'document.getElementById("recordingStudio")',
        'function setMode(mode',
        'pane.hidden=!active',
        'aria-selected',
        'ArrowLeft',
        'ArrowRight',
        'window.recordingWorkspace={setMode}',
    ]:
        assert token in js
    for forbidden in [
        "new AudioContext",
        "new (window.AudioContext",
        "MediaRecorder",
        "getUserMedia",
        "engine.noteOn",
        "engine.noteOff",
        "fetch(",
        "localStorage",
    ]:
        assert forbidden not in js


def test_existing_recording_ids_and_vst3_editor_control_are_retained():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    for control_id in [
        "keyboardRecordBtn",
        "keyboardRecordStopBtn",
        "keyboardRecordPlayBtn",
        "keyboardRecordClearBtn",
        "hummingAutoKey",
        "hummingAutoTiming",
        "hummingStartBtn",
        "hummingStopBtn",
        "hummingPlayBtn",
        "hummingTransferBtn",
        "vst3EditorBtn",
    ]:
        assert f'id="{control_id}"' in html
