from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "AGENTS.md", "HARNESS.md", "README.md", "server.py", "pyproject.toml",
    "setup_windows.cmd", "start_synth.cmd", "check_harness.cmd",
    "harness/app_blueprint.yaml", "src/ai_synth/patch.py", "src/ai_synth/prompt_engine.py",
    "web/index.html", "web/app.js", "web/patch_editor_runtime.js", "web/guitar_runtime.js", "web/style.css",
]


def fail(msg: str):
    print(f"[FAIL] {msg}")
    raise SystemExit(1)


def ok(msg: str):
    print(f"[ OK ] {msg}")


def main():
    missing = [p for p in REQUIRED if not (ROOT / p).exists()]
    if missing:
        fail(f"required files missing: {missing}")
    ok("required files")

    blueprint = (ROOT / "harness/app_blueprint.yaml").read_text(encoding="utf-8")
    required_invariants = [
        "generated_text_must_never_be_executed_as_code",
        "generated_patch_must_be_schema_validated_and_clamped",
        "graphical_parameter_edits_must_be_validated_and_clamped",
        "graphical_slider_input_must_not_rebuild_control_during_drag",
        "all_engines_must_share_single_audio_context",
        "master_gain_must_be_hard_limited",
        "polyphony_must_be_bounded",
        "sequencer_must_use_same_note_on_note_off_contract_as_live_playing",
        "sample_performance_must_use_same_note_on_note_off_contract_as_live_playing",
        "pcm_sampler_must_use_audio_buffer_source_nodes",
        "pcm_factory_buffers_must_not_embed_third_party_artist_recordings",
        "guitar_pcm_must_use_existing_audio_context",
        "guitar_amp_parameters_must_be_schema_validated_and_clamped",
        "guitar_sample_performance_must_use_note_event_contract",
        "pcm_and_fm_parameters_must_be_schema_validated_and_clamped",
        "eval_and_dynamic_script_injection_forbidden",
    ]
    for item in required_invariants:
        if item not in blueprint:
            fail(f"blueprint invariant missing: {item}")
    ok("non-negotiable multi-engine invariants")

    patch_py = (ROOT / "src/ai_synth/patch.py").read_text(encoding="utf-8")
    if "0.35" not in patch_py or "min(16" not in patch_py:
        fail("master gain/polyphony clamps not found")
    for token in [
        'ENGINE_TYPES = {"synth", "sampler", "drum", "fm"}',
        '"electric_guitar"', "GUITAR_AMP_MODELS", "GUITAR_DEMO_STYLES",
        "finger_noise_mix", "slide_amount", "mwah_amount",
        "guitar_amp_drive", "guitar_amp_presence", "guitar_cabinet_mix", "guitar_palm_mute",
        "kick_tune_hz", "drum_room_mix",
        "fm_mod_index", "fm_ratio_1", "fm_chorus_mix",
    ]:
        if token not in patch_py:
            fail(f"multi-engine patch schema missing: {token}")
    ok("hard audio, sampler, guitar amp, drum, and FM parameter bounds")

    runtime_js = (ROOT / "web/patch_editor_runtime.js").read_text(encoding="utf-8")
    guitar_js = (ROOT / "web/guitar_runtime.js").read_text(encoding="utf-8")
    all_code = "\n".join(
        p.read_text(encoding="utf-8", errors="ignore")
        for p in [
            ROOT / "server.py", ROOT / "src/ai_synth/prompt_engine.py",
            ROOT / "web/app.js", ROOT / "web/patch_editor_runtime.js", ROOT / "web/guitar_runtime.js",
        ]
    )
    for token in ["eval(", "new Function(", "exec("]:
        if token in all_code:
            fail(f"forbidden executable generation token found: {token}")
    ok("generated text cannot enter executable path")

    js = (ROOT / "web/app.js").read_text(encoding="utf-8")
    for contract in ["noteOn(midiNote", "noteOff(midiNote", "setPatch(raw)"]:
        if contract not in js:
            fail(f"sequencer/live contract missing: {contract}")
    audio_context_token = "new (window.AudioContext||window.webkitAudioContext)()"
    if js.count(audio_context_token) != 1 or "AudioContext" in guitar_js:
        fail("all engines including guitar must share exactly one AudioContext creation path")
    ok("single AudioContext and stable note event contract")

    html = (ROOT / "web/index.html").read_text(encoding="utf-8")
    for control in ["sampleSelect", "samplePlayBtn", "sampleStopBtn", "params", "resetParamsBtn"]:
        if f'id="{control}"' not in html:
            fail(f"required UI control missing: {control}")
    if 'src="/patch_editor_runtime.js"' not in html:
        fail("continuous patch editor runtime is not loaded")
    if 'src="/guitar_runtime.js"' not in html:
        fail("guitar runtime is not loaded")
    if "async function playSample()" not in js or "function stopSample(" not in js:
        fail("sample performance functions missing")
    sample_start = js.index("async function playSample()")
    sample_end = js.index("async function generate()")
    sample_code = js[sample_start:sample_end]
    if "engine.noteOn(" not in sample_code or "engine.noteOff(" not in sample_code:
        fail("sample performance bypasses stable note event contract")
    if "createOscillator" in sample_code or "AudioContext" in sample_code:
        fail("sample performance must not create a parallel audio engine")
    ok("sample performance uses stable note event contract")

    for token in [
        "createFactoryFretlessPCM", "FRETLESS_REGIONS", "createBufferSource()",
        'playFretlessArticulation("attack"', 'playFretlessArticulation("release"',
        'playFretlessArticulation("slide"',
    ]:
        if token not in js:
            fail(f"PCM fretless capability missing: {token}")
    ok("PCM fretless articulation engine")

    for token in [
        "createFactoryGuitarPCM", "GUITAR_ROOTS", "createBufferSource()", "playGuitarPCM",
        "createWaveShaper()", "makeDistortionCurve", "guitar_amp_drive", "guitar_amp_model",
        "guitar_amp_tone", "guitar_amp_presence", "guitar_cabinet_mix", "GUITAR_PARAM_DEFS",
    ]:
        if token not in guitar_js:
            fail(f"PCM guitar/amp capability missing: {token}")
    if "new AudioContext" in guitar_js or "new (window.AudioContext" in guitar_js:
        fail("guitar runtime must not create its own AudioContext")
    if ".wav" in guitar_js.lower() or ".mp3" in guitar_js.lower() or "fetch(" in guitar_js:
        fail("factory guitar runtime must not fetch or embed external audio assets")
    ok("PCM electric guitar and bounded amp distortion")

    guitar_sample_start = guitar_js.index("async function playGuitarSample()")
    guitar_sample_code = guitar_js[guitar_sample_start:]
    for token in ["ロック・リフ", "フュージョン・フレーズ", "アコースティック・アルペジオ", "engine.noteOn(", "engine.noteOff("]:
        if token not in guitar_sample_code and token not in guitar_js:
            fail(f"guitar sample performance capability missing: {token}")
    if "createOscillator" in guitar_sample_code or "AudioContext" in guitar_sample_code:
        fail("guitar sample performance must use the stable note event contract")
    ok("guitar rock/fusion/acoustic sample performances")

    for token in ["playDrumPCM(midiNote", "createFactoryDrumPCM", "DRUM_REGIONS", "canonicalDrumNote", "drum_shuffle"]:
        if token not in js:
            fail(f"PCM drum capability missing: {token}")
    ok("PCM drum engine")

    for token in ["playFM(midiNote", "fm_mod_index", "fm_ratio_1", "mg.connect(c.frequency)", "fm_chorus_mix"]:
        if token not in js:
            fail(f"FM electric piano capability missing: {token}")
    ok("FM electric piano engine")

    css = (ROOT / "web/style.css").read_text(encoding="utf-8")
    for token in ["const PARAM_DEFS", 'input.type="range"', "function applyParam("]:
        if token not in js:
            fail(f"graphical patch editor capability missing: {token}")
    for token in [
        "engine.setPatchWithRender({...currentPatch,[key]:value},false)",
        "this.patch=validatePatch(raw)",
        "if(render)renderPatch()",
    ]:
        if token not in runtime_js:
            fail(f"continuous graphical edit guard missing: {token}")
    if "engine.setPatchWithRender(validateGuitarExtras" not in guitar_js:
        fail("guitar graphical edits do not pass through validation/clamp")
    if ".param-dial" not in css or "conic-gradient" not in css:
        fail("graphical parameter visualization missing")
    ok("continuous graphical parameter editor")

    prompt_py = (ROOT / "src/ai_synth/prompt_engine.py").read_text(encoding="utf-8")
    for token in [
        "フレットレス", "ジャコ", 'engine_type="sampler"', "ロザーナー", "ポーカロ", 'engine_type="drum"',
        "dx-7", 'engine_type="fm"', "エレキギター", 'instrument_model="electric_guitar"', "guitar_amp_drive", "フュージョン", "アコースティック",
    ]:
        if token not in prompt_py:
            fail(f"multi-engine prompt recognition missing: {token}")
    ok("fretless, guitar, drum, and DX-style prompt recognition")

    print("\nRunning pytest...")
    result = subprocess.run([sys.executable, "-m", "pytest", "tests/"], cwd=ROOT)
    if result.returncode:
        fail("pytest failed")
    ok("pytest")
    print("\nHARNESS PASS")


if __name__ == "__main__":
    main()
