from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _html() -> str:
    return (ROOT / "web" / "index.html").read_text(encoding="utf-8")


def _js() -> str:
    return (ROOT / "web" / "humming_runtime.js").read_text(encoding="utf-8")


def test_humming_capture_controls_are_exposed():
    html = _html()
    for control_id in [
        "hummingBpm",
        "hummingQuantize",
        "hummingLivePitch",
        "hummingConfidence",
        "hummingStartBtn",
        "hummingStopBtn",
        "hummingPlayBtn",
        "hummingTransferBtn",
        "hummingClearBtn",
        "hummingResult",
        "hummingStatus",
    ]:
        assert f'id="{control_id}"' in html
    assert "鼻歌からメロディーを録音" in html
    assert 'src="/humming_runtime.js"' in html


def test_microphone_capture_is_local_analysis_only():
    js = _js()
    assert "navigator.mediaDevices.getUserMedia" in js
    assert "engine.ctx.createMediaStreamSource(stream)" in js
    assert "engine.ctx.createAnalyser()" in js
    assert "mediaSource.connect(analyser)" in js
    assert "analyser" in js
    assert "new AudioContext" not in js
    assert "new (window.AudioContext" not in js
    assert "MediaRecorder" not in js
    assert "fetch(" not in js
    assert "XMLHttpRequest" not in js


def test_yin_pitch_detector_and_midi_conversion_are_present():
    js = _js()
    for token in [
        "function detectPitchYin(samples,sampleRate)",
        "const MIN_FREQ_HZ=75",
        "const MAX_FREQ_HZ=1000",
        "const MIN_CONFIDENCE=0.72",
        "function hzToMidi(freq)",
        "69+12*Math.log2(freq/440)",
        "function midiToName(midi)",
        "const threshold=.16",
    ]:
        assert token in js


def test_humming_note_capture_is_bounded_and_monophonic():
    js = _js()
    assert "const MAX_RECORDING_MS=120000" in js
    assert "const MAX_CAPTURED_NOTES=512" in js
    assert "const MIN_NOTE_MS=90" in js
    assert "Math.abs(midiFloat-currentNote.midi)<.62" in js
    assert "rawEvents.length<MAX_CAPTURED_NOTES" in js
    assert "renderedSteps" in js


def test_humming_quantization_matches_custom_phrase_bounds():
    html = _html()
    js = _js()
    for value in ["0.5", "0.25", "0.125"]:
        assert f'value="{value}"' in html
    assert "clampLocal(quantizeSelect.value,.125,.5)" in js
    assert "clampLocal(bpmInput.value,40,240)" in js
    assert "function quantizeValue(beats,quantum)" in js
    assert "R | ${formatBeats(step.beats)} | 0.50" in js


def test_humming_preview_uses_existing_note_event_contract():
    js = _js()
    start = js.index("async function previewResult()")
    preview = js[start:]
    assert "engine.noteOn(note,velocity)" in preview
    assert "engine.noteOff(note)" in preview
    assert "createOscillator" not in preview
    assert "AudioContext" not in preview


def test_humming_can_transfer_to_existing_custom_phrase_editor():
    js = _js()
    for token in [
        'document.getElementById("customSampleName")',
        'document.getElementById("customSampleBpm")',
        'document.getElementById("customSampleSteps")',
        'name.value="鼻歌メロディー"',
        "steps.value=resultBox.value",
        'document.querySelector(".custom-sample-editor")',
    ]:
        assert token in js


def test_humming_runtime_loads_after_existing_audio_extensions():
    html = _html()
    assert html.index('/performance_library_runtime.js') < html.index('/output_level_runtime.js')
    assert html.index('/output_level_runtime.js') < html.index('/humming_runtime.js')


def test_v060_version_is_visible():
    html = _html()
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    assert "v0.6.0" in html
    assert 'version = "0.6.0"' in pyproject
    assert '"version": "0.6.0"' in server
