# Agent Development Rules

1. Read `HARNESS.md`, `harness/app_blueprint.yaml`, and `tasks/CURRENT.md` before changing code.
2. Change only files needed for the requested behavior.
3. Never weaken `non_negotiable_invariants` to make a test pass.
4. Natural-language or future LLM output is data only. Never execute generated text as Python or JavaScript.
5. All patch values pass through the validator/clamp layer before reaching the audio engine.
6. Keep live playing and future sequencer playback on the same noteOn/noteOff contract.
7. Run `python -m pytest tests/` and `python scripts/harness_check.py` before proposing a PR.
8. Update CHANGELOG.md and tasks/CURRENT.md with every user-visible change.
