from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "AGENTS.md", "HARNESS.md", "README.md", "server.py", "pyproject.toml",
    "setup_windows.cmd", "start_synth.cmd", "check_harness.cmd",
    "harness/app_blueprint.yaml", "src/ai_synth/patch.py", "src/ai_synth/prompt_engine.py",
    "web/index.html", "web/app.js", "web/style.css",
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
        "master_gain_must_be_hard_limited",
        "polyphony_must_be_bounded",
        "sequencer_must_use_same_note_on_note_off_contract_as_live_playing",
        "sample_performance_must_use_same_note_on_note_off_contract_as_live_playing",
        "drum_mode_must_share_single_audio_context",
        "drum_pad_and_sample_must_use_note_event_contract",
        "drum_parameters_must_be_schema_validated_and_clamped",
        "eval_and_dynamic_script_injection_forbidden",
    ]
    for item in required_invariants:
        if item not in blueprint:
            fail(f"blueprint invariant missing: {item}")
    ok("non-negotiable synth/drum invariants")

    patch_py = (ROOT / "src/ai_synth/patch.py").read_text(encoding="utf-8")
    if "0.35" not in patch_py or "min(16" not in patch_py:
        fail("master gain/polyphony clamps not found")
    for token in ["ENGINE_TYPES", "kick_tune_hz", "snare_tone_hz", "drum_room_mix"]:
        if token not in patch_py:
            fail(f"drum patch schema missing: {token}")
    ok("hard audio and drum parameter bounds")

    all_code = "\n".join(
        p.read_text(encoding="utf-8", errors="ignore")
        for p in [ROOT / "server.py", ROOT / "src/ai_synth/prompt_engine.py", ROOT / "web/app.js"]
    )
    forbidden = ["eval(", "new Function(", "exec("]
    for token in forbidden:
        if token in all_code:
            fail(f"forbidden executable generation token found: {token}")
    ok("generated text cannot enter executable path")

    js = (ROOT / "web/app.js").read_text(encoding="utf-8")
    for contract in ["noteOn(midiNote", "noteOff(midiNote", "setPatch(raw)"]:
        if contract not in js:
            fail(f"sequencer/live contract missing: {contract}")
    ok("live/sequencer event contract")

    html = (ROOT / "web/index.html").read_text(encoding="utf-8")
    for control in ["sampleSelect", "samplePlayBtn", "sampleStopBtn"]:
        if f'id="{control}"' not in html:
            fail(f"sample performance control missing: {control}")
    if "async function playSample()" not in js or "function stopSample(" not in js:
        fail("sample performance functions missing")
    sample_start = js.index("async function playSample()")
    sample_end = js.index("async function generate()")
    sample_code = js[sample_start:sample_end]
    if "engine.noteOn(" not in sample_code or "engine.noteOff(" not in sample_code:
        fail("sample performance bypasses stable note event contract")
    if "createOscillator" in sample_code or "new AudioContext" in sample_code:
        fail("sample performance must not create a parallel audio engine")
    ok("sample performance uses stable note event contract")

    for control in ["keyboardWrap", "drumKitWrap", "drumKit"]:
        if f'id="{control}"' not in html:
            fail(f"adaptive drum UI missing: {control}")
    for token in ["playDrum(midiNote", "playKick(", "playSnare(", "playHat(", "canonicalDrumNote", "drum_shuffle"]:
        if token not in js:
            fail(f"drum engine capability missing: {token}")
    audio_context_token = "new (window.AudioContext || window.webkitAudioContext)()"
    if js.count(audio_context_token) != 1:
        fail("synth and drum modes must share exactly one AudioContext creation path")
    ok("drum mode shares stable engine and single AudioContext")

    prompt_py = (ROOT / "src/ai_synth/prompt_engine.py").read_text(encoding="utf-8")
    for token in ["ロザーナー", "ポーカロ", "half_time_shuffle", "engine_type=\"drum\""]:
        if token not in prompt_py:
            fail(f"half-time shuffle drum prompt support missing: {token}")
    ok("drum prompt recognition")

    print("\nRunning pytest...")
    result = subprocess.run([sys.executable, "-m", "pytest", "tests/"], cwd=ROOT)
    if result.returncode:
        fail("pytest failed")
    ok("pytest")
    print("\nHARNESS PASS")


if __name__ == "__main__":
    main()
