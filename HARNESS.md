# Development Harness

## Purpose
This harness keeps the synth reproducible and safe to evolve through natural-language change requests.

## Canonical artifacts
- `harness/app_blueprint.yaml`: capabilities, boundaries, required files, acceptance commands.
- `scripts/harness_check.py`: validates project structure, forbidden execution paths, schema invariants, and tests.
- `src/ai_synth/patch.py`: canonical patch data contract and clamps.
- `web/app.js`: real-time engine implementing the stable `noteOn` / `noteOff` boundary.

## Standard development loop
1. Read `tasks/CURRENT.md` and the blueprint.
2. Implement the smallest coherent change.
3. Add/update regression tests.
4. Do not weaken non-negotiable invariants.
5. Run `python -m pytest tests/`.
6. Run `python scripts/harness_check.py`.
7. Update CHANGELOG and CURRENT.
8. Open a PR and let the human review before merge.

## Audio invariants
- Generated natural-language output is never executable code.
- Every generated or imported patch is validated and clamped.
- Master output gain is bounded.
- Polyphony is bounded.
- AudioContext begins only from a user gesture.
- Live keyboard, MIDI, and future sequencer use the same note event contract.

## Run
```bat
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```
Then open `http://127.0.0.1:8765`.
