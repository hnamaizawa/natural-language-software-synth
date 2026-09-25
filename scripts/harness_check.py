from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "AGENTS.md", "HARNESS.md", "README.md", "server.py", "pyproject.toml",
    "setup_windows.cmd", "start_synth.cmd", "check_harness.cmd", "build_vst3_host.cmd",
    "harness/app_blueprint.yaml", "scripts/harness_check.py",
    "src/ai_synth/patch.py", "src/ai_synth/prompt_engine.py", "src/ai_synth/timbre_variants.py",
    "web/index.html", "web/app.js", "web/patch_editor_runtime.js", "web/guitar_runtime.js",
    "web/piano_runtime.js", "web/resynthesis_runtime.js", "web/instrument_performance_runtime.js",
    "web/performance_library_runtime.js", "web/output_level_runtime.js", "web/humming_runtime.js",
    "web/keyboard_performance_runtime.js", "web/recording_workspace_runtime.js", "web/vst3_runtime.js",
    "web/performance_editor.css", "web/keyboard_performance.css", "web/style.css",
    "native/vst3_host/CMakeLists.txt", "native/vst3_host/src/main.cpp",
    "native/vst3_host/src/plugin_editor_win32.h", "native/vst3_host/src/plugin_editor_win32.cpp",
]


def fail(msg: str) -> None:
    print(f"[FAIL] {msg}")
    raise SystemExit(1)


def ok(msg: str) -> None:
    print(f"[ OK ] {msg}")


def require_tokens(text: str, tokens: list[str], label: str) -> None:
    for token in tokens:
        if token not in text:
            fail(f"{label} missing: {token}")


def main() -> None:
    missing = [p for p in REQUIRED if not (ROOT / p).exists()]
    if missing:
        fail(f"required files missing: {missing}")
    ok("required files")

    blueprint = (ROOT / "harness/app_blueprint.yaml").read_text(encoding="utf-8")
    invariants = [
        "generated_text_must_never_be_executed_as_code",
        "generated_patch_must_be_schema_validated_and_clamped",
        "expanded_timbre_recipes_must_be_validated_and_clamped",
        "expanded_timbre_recipes_must_not_fetch_or_copy_third_party_presets",
        "pcm_resynthesis_parameters_must_be_schema_validated_and_clamped",
        "pcm_resynthesis_must_use_locally_generated_factory_pcm_only",
        "pcm_resynthesis_must_use_existing_audio_context",
        "pcm_resynthesis_must_not_fetch_network_or_load_third_party_samples",
        "pcm_resynthesis_playback_must_use_same_note_on_note_off_contract",
        "vst3_router_must_remain_final_note_event_wrapper",
        "graphical_parameter_edits_must_be_validated_and_clamped",
        "all_web_audio_engines_must_share_single_audio_context",
        "recording_workspace_ui_must_not_create_parallel_audio_or_network_path",
        "microphone_capture_must_use_existing_audio_context",
        "microphone_audio_must_not_be_persisted_or_uploaded",
        "humming_capture_must_be_monophonic_and_bounded",
        "humming_pitch_correction_must_snap_only_to_inferred_or_selected_scale",
        "humming_timing_quantization_must_be_bounded",
        "humming_preview_must_use_same_note_on_note_off_contract",
        "humming_score_must_be_derived_from_corrected_note_events",
        "master_gain_must_be_hard_limited",
        "output_level_normalization_must_not_bypass_master_gain_limit",
        "polyphony_must_be_bounded",
        "custom_sample_phrases_must_remain_local_browser_data",
        "guitar_chord_sample_performance_must_apply_strum_timing",
        "drum_patch_must_keep_drum_surface_and_drum_keymap",
        "pcm_sampler_must_use_audio_buffer_source_nodes",
        "pcm_factory_buffers_must_not_embed_third_party_artist_recordings",
        "vst3_binary_must_never_be_loaded_in_browser_process",
        "vst3_bridge_must_bind_through_existing_local_http_server",
        "vst3_plugin_load_must_be_limited_to_scanned_local_plugin_ids",
        "vst3_note_values_must_be_bounded",
        "vst3_parameter_values_must_be_normalized_and_bounded",
        "vst3_native_host_must_run_as_separate_process",
        "vst3_dependencies_must_be_pinned",
        "vst3_bus_configuration_must_complete_before_processing_activation",
        "vst3_live_note_events_must_use_active_event_bus",
        "vst3_audio_output_must_use_active_main_output_bus",
        "vst3_render_failures_and_output_peak_must_be_observable",
        "vst3_reload_must_restore_computer_keyboard_focus",
        "vst3_custom_editor_must_run_in_native_host_same_plugin_instance",
        "vst3_editor_parameter_changes_must_reach_loaded_processor",
        "eval_and_dynamic_script_injection_forbidden",
    ]
    require_tokens(blueprint, invariants, "blueprint invariant")
    if "blueprint_version: 0.7.2" not in blueprint:
        fail("blueprint version is not 0.7.2")
    ok("v0.7.2 baseline and v0.9.0 non-negotiable invariants")

    patch_py = (ROOT / "src/ai_synth/patch.py").read_text(encoding="utf-8")
    timbre_py = (ROOT / "src/ai_synth/timbre_variants.py").read_text(encoding="utf-8")
    require_tokens(
        patch_py,
        [
            'ENGINE_TYPES = {"synth", "sampler", "drum", "fm"}', '"electric_guitar"', '"grand_piano"',
            '"spectral_resynth"', "RESYNTH_SOURCES", "resynth_source_a", "resynth_source_b",
            "resynth_morph", "resynth_harmonics", "resynth_pcm_mix", "resynth_transient_mix",
            "finger_noise_mix", "guitar_amp_drive", "piano_hammer_mix", "kick_tune_hz", "fm_mod_index", "0.35", "min(16",
        ],
        "multi-engine and PCM-resynthesis patch schema",
    )
    require_tokens(
        timbre_py,
        [
            "generate_legacy_patch", "validate_patch(p)", 'instrument_model="spectral_resynth"',
            'archetype = "String Ensemble"', 'archetype = "Synth Brass"', 'archetype = "Airy Choir Pad"',
            'archetype = "Retro Polysynth"', 'archetype = "Resonant Acid Bass"',
            'archetype = "Analog Synth Keys"', 'archetype = "PCM Resynth Bell"',
            'archetype = "PCM Resynth Pluck"', "_apply_common_descriptors", "_dedicated_engine_request",
        ],
        "expanded PCM-resynthesis natural-language timbre recipes",
    )
    for forbidden in ["requests.", "urllib", "http://", "https://", "subprocess", "eval(", "exec("]:
        if forbidden in timbre_py:
            fail(f"timbre recipe must remain offline validated data only: {forbidden}")
    ok("existing instrument parameter bounds and PCM-resynthesis timbre bounds retained")

    app_js = (ROOT / "web/app.js").read_text(encoding="utf-8")
    runtime_js = (ROOT / "web/patch_editor_runtime.js").read_text(encoding="utf-8")
    guitar_js = (ROOT / "web/guitar_runtime.js").read_text(encoding="utf-8")
    piano_js = (ROOT / "web/piano_runtime.js").read_text(encoding="utf-8")
    resynth_js = (ROOT / "web/resynthesis_runtime.js").read_text(encoding="utf-8")
    instrument_js = (ROOT / "web/instrument_performance_runtime.js").read_text(encoding="utf-8")
    library_js = (ROOT / "web/performance_library_runtime.js").read_text(encoding="utf-8")
    output_js = (ROOT / "web/output_level_runtime.js").read_text(encoding="utf-8")
    humming_js = (ROOT / "web/humming_runtime.js").read_text(encoding="utf-8")
    keyboard_recording_js = (ROOT / "web/keyboard_performance_runtime.js").read_text(encoding="utf-8")
    recording_workspace_js = (ROOT / "web/recording_workspace_runtime.js").read_text(encoding="utf-8")
    vst3_js = (ROOT / "web/vst3_runtime.js").read_text(encoding="utf-8")
    server_py = (ROOT / "server.py").read_text(encoding="utf-8")
    native_cpp = (ROOT / "native/vst3_host/src/main.cpp").read_text(encoding="utf-8")
    native_editor_h = (ROOT / "native/vst3_host/src/plugin_editor_win32.h").read_text(encoding="utf-8")
    native_editor_cpp = (ROOT / "native/vst3_host/src/plugin_editor_win32.cpp").read_text(encoding="utf-8")
    native_cmake = (ROOT / "native/vst3_host/CMakeLists.txt").read_text(encoding="utf-8")
    html = (ROOT / "web/index.html").read_text(encoding="utf-8")

    all_browser_and_python = "\n".join([
        server_py, app_js, runtime_js, guitar_js, piano_js, resynth_js, instrument_js, library_js, output_js, humming_js,
        keyboard_recording_js, recording_workspace_js, vst3_js, timbre_py,
    ])
    for token in ["eval(", "new Function(", "exec("]:
        if token in all_browser_and_python:
            fail(f"forbidden executable-generation token found: {token}")
    ok("generated/user text cannot enter executable path")

    require_tokens(app_js, ["noteOn(midiNote", "noteOff(midiNote", "setPatch(raw)"], "stable note contract")
    audio_context_token = "new (window.AudioContext||window.webkitAudioContext)()"
    if app_js.count(audio_context_token) != 1:
        fail("base engine must contain exactly one browser AudioContext creation path")
    for name, source in [
        ("guitar", guitar_js), ("piano", piano_js), ("resynthesis", resynth_js), ("performance", instrument_js),
        ("library", library_js), ("output", output_js), ("humming", humming_js),
        ("keyboard recorder", keyboard_recording_js), ("recording workspace", recording_workspace_js),
        ("vst3 router", vst3_js),
    ]:
        if "new AudioContext" in source or "new (window.AudioContext" in source:
            fail(f"{name} runtime must not create another browser AudioContext")
    ok("single browser AudioContext and stable note event contract")

    require_tokens(
        resynth_js,
        [
            'engine.sampleBuffers.get("piano_60")', 'engine.sampleBuffers.get("guitar_64")',
            'engine.sampleBuffers.get("fretless")', "function harmonicTemplate(name,harmonics)",
            "Math.hypot(re,im)", "createPeriodicWave", "function playPcmLayer", "engine.playSpectralResynth",
            'kind:"resynth"', "resynth_source_a", "resynth_source_b", "resynth_morph", "resynth_harmonics",
            "const baseNoteOn=engine.noteOn.bind(engine)", "const baseNoteOff=engine.noteOff.bind(engine)",
        ],
        "PCM spectral resynthesis runtime",
    )
    for forbidden in ["new AudioContext", "new (window.AudioContext", "fetch(", "XMLHttpRequest", "WebAssembly", "eval("]:
        if forbidden in resynth_js:
            fail(f"PCM spectral resynthesis must remain local PCM/DSP only: {forbidden}")
    if not (html.index('/piano_runtime.js') < html.index('/resynthesis_runtime.js') < html.index('/instrument_performance_runtime.js') < html.index('/vst3_runtime.js')):
        fail("PCM resynthesis must load after PCM source runtimes and before the final VST3 note wrapper")
    ok("PCM-derived harmonic analysis, source morphing, transient layering, and VST3 boundary retained")

    recording_controls = [
        "recordingStudio", "recordingKeyboardTab", "recordingHummingTab", "recordingKeyboardPane", "recordingHummingPane",
        "keyboardRecordBtn", "keyboardRecordStopBtn", "keyboardRecordPlayBtn", "keyboardRecordClearBtn", "keyboardRecordingRoll",
    ]
    for control in recording_controls:
        if f'id="{control}"' not in html:
            fail(f"recording workspace control missing: {control}")
    workflow_ids = ['id="soundDesign"', 'id="soundSource"', 'id="performance"', 'id="recordingStudio"']
    if not all(token in html for token in workflow_ids):
        fail("workflow guide sections are incomplete")
    if not (html.index(workflow_ids[0]) < html.index(workflow_ids[1]) < html.index(workflow_ids[2]) < html.index(workflow_ids[3])):
        fail("workflow sections must remain sound design -> sound source -> performance -> recording")
    require_tokens(
        recording_workspace_js,
        [
            'document.getElementById("recordingStudio")', 'document.getElementById("recordingKeyboardTab")',
            'document.getElementById("recordingHummingTab")', "function setMode(mode", "pane.hidden=!active",
            'tab.setAttribute("aria-selected"', 'event.key!=="ArrowLeft"', 'event.key!=="ArrowRight"',
            "window.recordingWorkspace={setMode}",
        ],
        "unified recording workspace",
    )
    for forbidden in ["new AudioContext", "new (window.AudioContext", "MediaRecorder", "getUserMedia", "fetch(", "localStorage", "engine.noteOn", "engine.noteOff"]:
        if forbidden in recording_workspace_js:
            fail(f"recording workspace must remain UI-only: {forbidden}")
    if html.index('/keyboard_performance_runtime.js') > html.index('/recording_workspace_runtime.js'):
        fail("recording workspace must load after keyboard recording runtime")
    if html.index('/recording_workspace_runtime.js') > html.index('/vst3_runtime.js'):
        fail("VST3 router must remain the final note-event wrapper")
    ok("workflow-guided UI and unified recording workspace retained without a parallel audio/network path")

    humming_controls = [
        "hummingAutoKey", "hummingKeyDisplay", "hummingAutoTiming", "hummingTimingDisplay", "hummingBpm",
        "hummingQuantize", "hummingLivePitch", "hummingStartBtn", "hummingStopBtn", "hummingPlayBtn",
        "hummingTransferBtn", "hummingResult", "hummingScore", "hummingStatus",
    ]
    for control in humming_controls:
        if f'id="{control}"' not in html:
            fail(f"humming UI control missing: {control}")
    require_tokens(
        humming_js,
        [
            "navigator.mediaDevices.getUserMedia", "engine.ctx.createMediaStreamSource(stream)", "engine.ctx.createAnalyser()",
            "function detectPitchYin(samples,sampleRate)", "MIN_FREQ_HZ=75", "MAX_FREQ_HZ=1000", "MIN_CONFIDENCE=.72",
            "function estimateKey(events)", 'for(const mode of ["major","minor"])', "function snapMidiToScale(midi,key)",
            "function estimateTiming(events)", "for(let bpm=60;bpm<=180;bpm++)", "const candidates=[.5,.25,.125]",
            "function renderScore()", 'document.createElementNS(NS,name)', "scoreSvg", "staffY(midi,clef",
            "engine.noteOn(note,velocity)", "engine.noteOff(note)", "steps.value=resultBox.value",
        ],
        "humming correction/score capability",
    )
    for forbidden in ["MediaRecorder", "XMLHttpRequest", "localStorage.setItem", "fetch("]:
        if forbidden in humming_js:
            fail(f"humming audio/data must stay browser-local until explicit phrase registration: {forbidden}")
    ok("automatic humming key correction, timing quantization, and SVG score")

    require_tokens(
        library_js,
        ["localStorage.getItem", "localStorage.setItem", "MAX_CUSTOM_PHRASES=50", "MAX_CUSTOM_STEPS=128", "function guitarStrumInterval()"],
        "custom performance library",
    )
    require_tokens(
        instrument_js,
        ['p.instrument_model === "electric_guitar"', 'p.instrument_model === "studio_drums" || p.engine_type === "drum"', "quartalVoicing(root,size=4)"],
        "instrument routing guards",
    )
    require_tokens(output_js, ["LEVEL_TRIMS", "createDynamicsCompressor()", "clamp(trim,.82,1.22)"], "output normalization")
    ok("existing routing, strum, quartal jazz, and output normalization retained")

    vst_controls = [
        "vst3ScanBtn", "vst3PluginSelect", "vst3LoadBtn", "vst3UnloadBtn", "vst3EditorBtn", "vst3TestToneBtn", "vst3DiagBtn",
        "vst3RouteEnabled", "vst3Parameters", "vst3Status",
    ]
    for control in vst_controls:
        if f'id="{control}"' not in html:
            fail(f"VST3 UI control missing: {control}")
    if 'src="/vst3_runtime.js?v=0.15.0"' not in html or html.index('/humming_runtime.js') > html.index('/vst3_runtime.js'):
        fail("VST3 router must load after humming and all audio wrappers")
    require_tokens(
        vst3_js,
        [
            'fetch(path,options)', '"/api/vst3/scan"', '"/api/vst3/load"', '"/api/vst3/note-on"', '"/api/vst3/note-off"', '"/api/vst3/events"', '"/api/vst3/clear-events"',
            '"/api/vst3/parameters"', '"/api/vst3/parameter"', '"/api/vst3/test-tone"', '"/api/vst3/diagnostics"',
            '"/api/vst3/editor/open"', "function isHostControl(active)", "function restorePerformanceFocusSoon()",
            "requestAnimationFrame", "await refreshParameters();", "const baseNoteOn=engine.noteOn.bind(engine)",
            "if(route.checked&&loaded)", "scheduleNative", "whenSeconds", "max_output_peak", "process_failures", "note_on_queued",
            'api("/api/vst3/load",{plugin_id:pluginId,instance_id:trackId})',
            'track?.midi_channel,0,15', "new Set([...trackInstances.values()]",
        ],
        "browser VST3 routing",
    )
    if ".vst3" in vst3_js.lower() or "WebAssembly" in vst3_js:
        fail("browser runtime must not load VST3 binaries directly")
    ok("VST3 browser adapter restores keyboard focus, reuses final note boundary, and exposes diagnostics/editor control")

    require_tokens(
        server_py,
        [
            'HOST = "127.0.0.1"', "class Vst3Bridge", 'os.environ.get("COMMONPROGRAMFILES")',
            'os.environ.get("NLSS_VST3_PATHS"', 'os.environ.get("NLSS_VST3_HOST"', "self._plugins.get(plugin_id)",
            'subprocess.Popen(', 'creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)',
            "midi_note = max(0, min(127", "velocity = max(0.0, min(1.0", "value = max(0.0, min(1.0",
            '"/api/vst3/scan"', '"/api/vst3/load"', '"/api/vst3/note-on"', '"/api/vst3/events"', '"/api/vst3/parameter"',
            '"/api/vst3/diagnostics"', '"/api/vst3/test-tone"', '"/api/vst3/editor/open"',
            "DIAGNOSTICS", "TEST_TONE", 'self._command(f"EDITOR_OPEN',
            "from ai_synth.timbre_variants import generate_patch",
        ],
        "Python VST3 bridge",
    )
    ok("VST3 loading restricted to scanned local ids and bounded values")

    require_tokens(
        native_cmake,
        [
            "3cdf9ca5d1f5b1b21e0a86832aa4abe55607bd96",
            "9634bedb5b5a2ca38c1ee7108a9358a4e233f14d",
            "src/plugin_editor_win32.cpp", "sdk_hosting", "user32", "cxx_std_17", "VERSION 0.7.2",
        ],
        "pinned native dependencies",
    )
    require_tokens(
        native_cpp,
        [
            "VST3::Hosting::Module::create", "PlugProvider", "IAudioProcessor", "configureBusArrangements ();",
            "processor_->setBusArrangements", "chooseBus (kAudio, kOutput, true)", "chooseBus (kEvent, kInput, true)",
            "processData_.prepare", "setupProcessing", "setActive (true)", "setProcessing (true)", "Event::kIsLive",
            "event.busIndex = mainEventInputBus_", "Event::kNoteOnEvent", "Event::kNoteOffEvent", "ParameterChanges",
            "mainOutputBus_", "clearProcessOutputs", "maxOutputPeak_", "processFailures_", "diagnosticsJson",
            "startTestTone", "ma_device_init", "ma_device_start", "NOTE_ON", "NOTE_OFF", "PARAMS", "LOAD",
            'parts[0] == "EDITOR_OPEN"', "editor_.bind", "queueProcessorParameter", "kParamValuesChanged",
            "class NativeVst3Rack", "kMaxInstances = 24", "single_audio_device", "isIdleSuspended", 'parts[0] == "BATCH"', 'parts[0] == "CLEAR"',
        ],
        "native VST3 host",
    )
    if native_cpp.count("ma_device_init") != 1 or native_cpp.count("ma_device_start") != 1:
        fail("multi-track VST3 must share one native audio device")
    require_tokens(
        native_editor_h + "\n" + native_editor_cpp,
        [
            "IPlugFrame", "IComponentHandler", "createView (Steinberg::Vst::ViewType::kEditor)",
            "Steinberg::kPlatformTypeHWND", "view_->attached", "performEdit", "restartComponent",
        ],
        "same-instance native VST3 editor",
    )
    if not (native_cpp.index("processData_.prepare") < native_cpp.index("processor_->setupProcessing") < native_cpp.index("component_->setActive (true)") < native_cpp.index("processor_->setProcessing (true)")):
        fail("VST3 bus/buffer setup must complete before realtime activation")
    ok("VST3 realtime bus routing, live events, native editor, audio diagnostics, and native output test")

    css = (ROOT / "web/performance_editor.css").read_text(encoding="utf-8")
    require_tokens(css, [".humming-score", ".vst3-parameters", ".vst3-param", ".toggle-label", ".workflow-guide", ".recording-studio", ".recording-mode-tab"], "v0.8 UI styling")
    require_tokens(runtime_js, ["engine.setPatchWithRender", "this.patch=validatePatch(raw)"], "validated graphical editing")
    ok("graphical editors, PCM-resynthesis controls, and workflow/recording surfaces present")

    print("\nRunning pytest...")
    result = subprocess.run([sys.executable, "-m", "pytest", "tests/"], cwd=ROOT)
    if result.returncode:
        fail("pytest failed")
    ok("pytest")
    print("\nHARNESS PASS")


if __name__ == "__main__":
    main()
