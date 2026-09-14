from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "AGENTS.md", "HARNESS.md", "README.md", "server.py", "pyproject.toml",
    "setup_windows.cmd", "start_synth.cmd", "check_harness.cmd", "build_vst3_host.cmd",
    "harness/app_blueprint.yaml", "scripts/harness_check.py",
    "src/ai_synth/patch.py", "src/ai_synth/prompt_engine.py",
    "web/index.html", "web/app.js", "web/patch_editor_runtime.js", "web/guitar_runtime.js",
    "web/piano_runtime.js", "web/instrument_performance_runtime.js", "web/performance_library_runtime.js",
    "web/output_level_runtime.js", "web/humming_runtime.js", "web/vst3_runtime.js",
    "web/performance_editor.css", "web/style.css",
    "native/vst3_host/CMakeLists.txt", "native/vst3_host/src/main.cpp",
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
        "graphical_parameter_edits_must_be_validated_and_clamped",
        "all_web_audio_engines_must_share_single_audio_context",
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
        "eval_and_dynamic_script_injection_forbidden",
    ]
    require_tokens(blueprint, invariants, "blueprint invariant")
    if "blueprint_version: 0.7.0" not in blueprint:
        fail("blueprint version is not 0.7.0")
    ok("v0.7.0 non-negotiable invariants")

    patch_py = (ROOT / "src/ai_synth/patch.py").read_text(encoding="utf-8")
    require_tokens(
        patch_py,
        [
            'ENGINE_TYPES = {"synth", "sampler", "drum", "fm"}', '"electric_guitar"', '"grand_piano"',
            "finger_noise_mix", "guitar_amp_drive", "piano_hammer_mix", "kick_tune_hz", "fm_mod_index", "0.35", "min(16",
        ],
        "multi-engine patch schema",
    )
    ok("existing instrument parameter bounds retained")

    app_js = (ROOT / "web/app.js").read_text(encoding="utf-8")
    runtime_js = (ROOT / "web/patch_editor_runtime.js").read_text(encoding="utf-8")
    guitar_js = (ROOT / "web/guitar_runtime.js").read_text(encoding="utf-8")
    piano_js = (ROOT / "web/piano_runtime.js").read_text(encoding="utf-8")
    instrument_js = (ROOT / "web/instrument_performance_runtime.js").read_text(encoding="utf-8")
    library_js = (ROOT / "web/performance_library_runtime.js").read_text(encoding="utf-8")
    output_js = (ROOT / "web/output_level_runtime.js").read_text(encoding="utf-8")
    humming_js = (ROOT / "web/humming_runtime.js").read_text(encoding="utf-8")
    vst3_js = (ROOT / "web/vst3_runtime.js").read_text(encoding="utf-8")
    server_py = (ROOT / "server.py").read_text(encoding="utf-8")
    native_cpp = (ROOT / "native/vst3_host/src/main.cpp").read_text(encoding="utf-8")
    native_cmake = (ROOT / "native/vst3_host/CMakeLists.txt").read_text(encoding="utf-8")
    html = (ROOT / "web/index.html").read_text(encoding="utf-8")

    all_browser_and_python = "\n".join([
        server_py, app_js, runtime_js, guitar_js, piano_js, instrument_js, library_js, output_js, humming_js, vst3_js,
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
        ("guitar", guitar_js), ("piano", piano_js), ("performance", instrument_js),
        ("library", library_js), ("output", output_js), ("humming", humming_js), ("vst3 router", vst3_js),
    ]:
        if "new AudioContext" in source or "new (window.AudioContext" in source:
            fail(f"{name} runtime must not create another browser AudioContext")
    ok("single browser AudioContext and stable note event contract")

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

    vst_controls = ["vst3ScanBtn", "vst3PluginSelect", "vst3LoadBtn", "vst3UnloadBtn", "vst3RouteEnabled", "vst3Parameters", "vst3Status"]
    for control in vst_controls:
        if f'id="{control}"' not in html:
            fail(f"VST3 UI control missing: {control}")
    if 'src="/vst3_runtime.js"' not in html or html.index('/humming_runtime.js') > html.index('/vst3_runtime.js'):
        fail("VST3 router must load after humming and all audio wrappers")
    require_tokens(
        vst3_js,
        [
            'fetch(path,options)', '"/api/vst3/scan"', '"/api/vst3/load"', '"/api/vst3/note-on"', '"/api/vst3/note-off"',
            '"/api/vst3/parameters"', '"/api/vst3/parameter"', "const baseNoteOn=engine.noteOn.bind(engine)",
            "if(route.checked&&loaded)", "scheduleNative", "whenSeconds",
        ],
        "browser VST3 routing",
    )
    if ".vst3" in vst3_js.lower() or "WebAssembly" in vst3_js:
        fail("browser runtime must not load VST3 binaries directly")
    ok("VST3 browser adapter reuses the final note event boundary")

    require_tokens(
        server_py,
        [
            'HOST = "127.0.0.1"', "class Vst3Bridge", 'os.environ.get("COMMONPROGRAMFILES")',
            'os.environ.get("NLSS_VST3_PATHS"', 'os.environ.get("NLSS_VST3_HOST"', "self._plugins.get(plugin_id)",
            'subprocess.Popen(', 'creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)',
            "midi_note = max(0, min(127", "velocity = max(0.0, min(1.0", "value = max(0.0, min(1.0",
            '"/api/vst3/scan"', '"/api/vst3/load"', '"/api/vst3/note-on"', '"/api/vst3/parameter"',
        ],
        "Python VST3 bridge",
    )
    ok("VST3 loading restricted to scanned local ids and bounded values")

    require_tokens(
        native_cmake,
        [
            "3cdf9ca5d1f5b1b21e0a86832aa4abe55607bd96",
            "9634bedb5b5a2ca38c1ee7108a9358a4e233f14d",
            "sdk_hosting", "cxx_std_17",
        ],
        "pinned native dependencies",
    )
    require_tokens(
        native_cpp,
        [
            "VST3::Hosting::Module::create", "PlugProvider", "IAudioProcessor", "setupProcessing", "setProcessing (true)",
            "Event::kNoteOnEvent", "Event::kNoteOffEvent", "ParameterChanges", "getParameterCount", "setParamNormalized",
            "ma_device_init", "ma_device_start", "NOTE_ON", "NOTE_OFF", "PARAMS", "LOAD",
        ],
        "native VST3 host",
    )
    ok("separate native VST3 process source and pinned SDK/audio backend")

    css = (ROOT / "web/performance_editor.css").read_text(encoding="utf-8")
    require_tokens(css, [".humming-score", ".vst3-parameters", ".vst3-param", ".toggle-label"], "v0.7 UI styling")
    require_tokens(runtime_js, ["engine.setPatchWithRender", "this.patch=validatePatch(raw)"], "validated graphical editing")
    ok("graphical editors and new v0.7 surfaces present")

    print("\nRunning pytest...")
    result = subprocess.run([sys.executable, "-m", "pytest", "tests/"], cwd=ROOT)
    if result.returncode:
        fail("pytest failed")
    ok("pytest")
    print("\nHARNESS PASS")


if __name__ == "__main__":
    main()
