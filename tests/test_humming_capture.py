from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _html() -> str:
    return (ROOT / "web" / "index.html").read_text(encoding="utf-8")


def _js() -> str:
    return (ROOT / "web" / "humming_runtime.js").read_text(encoding="utf-8")


def test_humming_capture_and_auto_assist_controls_are_exposed():
    html = _html()
    for control_id in [
        "hummingAutoKey", "hummingKeyDisplay", "hummingAutoTiming", "hummingTimingDisplay",
        "hummingBpm", "hummingQuantize", "hummingLivePitch", "hummingConfidence",
        "hummingStartBtn", "hummingStopBtn", "hummingPlayBtn", "hummingTransferBtn",
        "hummingClearBtn", "hummingResult", "hummingScore", "hummingStatus",
    ]:
        assert f'id="{control_id}"' in html
    assert "鼻歌からメロディーを録音・自動補正" in html
    assert 'src="/humming_runtime.js"' in html


def test_microphone_capture_is_local_analysis_only():
    js = _js()
    assert "navigator.mediaDevices.getUserMedia" in js
    assert "engine.ctx.createMediaStreamSource(stream)" in js
    assert "engine.ctx.createAnalyser()" in js
    assert "mediaSource.connect(analyser)" in js
    assert "new AudioContext" not in js
    assert "new (window.AudioContext" not in js
    assert "MediaRecorder" not in js
    assert "fetch(" not in js
    assert "XMLHttpRequest" not in js
    assert "localStorage.setItem" not in js


def test_yin_pitch_detector_and_midi_conversion_are_present():
    js = _js()
    for token in [
        "function detectPitchYin(samples,sampleRate)",
        "MIN_FREQ_HZ=75",
        "MAX_FREQ_HZ=1000",
        "MIN_CONFIDENCE=.72",
        "hzToMidi=freq=>69+12*Math.log2(freq/440)",
        "midiToName=midi=>",
    ]:
        assert token in js


def test_humming_note_capture_is_bounded_and_monophonic():
    js = _js()
    assert "MAX_RECORDING_MS=120000" in js
    assert "MAX_CAPTURED_NOTES=512" in js
    assert "MIN_NOTE_MS=90" in js
    assert "Math.abs(midiFloat-currentNote.midi)<.62" in js
    assert "rawEvents.length<MAX_CAPTURED_NOTES" in js


def test_key_scale_inference_and_pitch_snap_are_present():
    js = _js()
    assert "const MAJOR=[0,2,4,5,7,9,11]" in js
    assert "MINOR=[0,2,3,5,7,8,10]" in js
    assert "function estimateKey(events)" in js
    assert 'for(const mode of ["major","minor"])' in js
    assert "function snapMidiToScale(midi,key)" in js
    assert "for(let distance=1;distance<=3;distance++)" in js
    assert "midi:snapMidiToScale(e.midi,key)" in js


def test_timing_is_automatically_estimated_and_quantized():
    js = _js()
    assert "function estimateTiming(events)" in js
    assert "for(let bpm=60;bpm<=180;bpm++)" in js
    assert "const candidates=[.5,.25,.125]" in js
    assert "quantizeValue" in js
    assert "bpmInput.value=bpm" in js
    assert "quantizeSelect.value=String(quantum)" in js


def test_score_is_derived_from_corrected_quantized_steps():
    js = _js()
    assert "function renderScore()" in js
    assert "const notes=renderedSteps.filter" in js
    assert 'document.createElementNS(NS,name)' in js
    assert "staffY(midi,clef" in js
    assert 'clef==="bass"?"𝄢":"𝄞"' in js
    assert 'role="img"' in _html()


def test_humming_preview_uses_existing_note_event_contract():
    js = _js()
    preview = js[js.index("async function previewResult()") :]
    assert "engine.noteOn(note,velocity)" in preview
    assert "engine.noteOff(note)" in preview
    assert "createOscillator" not in preview
    assert "AudioContext" not in preview


def test_humming_can_transfer_corrected_phrase_to_existing_editor():
    js = _js()
    for token in [
        'byId("customSampleName")',
        'byId("customSampleBpm")',
        'byId("customSampleSteps")',
        'name.value="鼻歌メロディー"',
        "steps.value=resultBox.value",
        'document.querySelector(".custom-sample-editor")',
    ]:
        assert token in js


def test_v07_current_patch_version_is_visible_and_consistent():
    html = _html()
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    assert "v0.7.2" in html
    assert 'version = "0.7.2"' in pyproject
    assert '"version": "0.7.2"' in server
