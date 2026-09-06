# Agent Development Rules

1. Read `HARNESS.md`, `harness/app_blueprint.yaml`, and `tasks/CURRENT.md` before changing code.
2. Change only files needed for the requested behavior.
3. Never weaken `non_negotiable_invariants` to make a test pass.
4. Natural-language or future LLM output is data only. Never execute generated text as Python or JavaScript.
5. All generated, imported, and graphically edited patch values pass through the validator/clamp layer before reaching an audio engine.
6. Subtractive synth, PCM fretless sampler, PCM electric guitar, PCM drums, and FM engines must share the same single AudioContext.
7. Keep live playing, MIDI, sample playback, and future sequencer playback on the same `noteOn` / `noteOff` contract.
8. Do not embed third-party artist recordings in Factory PCM. Use locally generated demo PCM or appropriately licensed sample assets.
9. Guitar amp Drive / Tone / Presence / Cabinet / Chorus values must remain bounded and guitar runtime code must not create a second AudioContext.
10. Run `python -m pytest tests/` and `python scripts/harness_check.py` before proposing a PR.
11. Update CHANGELOG.md and tasks/CURRENT.md with every user-visible change.
