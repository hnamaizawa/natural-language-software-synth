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
        "eval_and_dynamic_script_injection_forbidden",
    ]
    for item in required_invariants:
        if item not in blueprint:
            fail(f"blueprint invariant missing: {item}")
    ok("non-negotiable synth invariants")

    patch_py = (ROOT / "src/ai_synth/patch.py").read_text(encoding="utf-8")
    if "0.35" not in patch_py or "min(16" not in patch_py:
        fail("master gain/polyphony clamps not found")
    ok("hard audio bounds")

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

    print("\nRunning pytest...")
    result = subprocess.run([sys.executable, "-m", "pytest", "tests/"], cwd=ROOT)
    if result.returncode:
        fail("pytest failed")
    ok("pytest")
    print("\nHARNESS PASS")


if __name__ == "__main__":
    main()
