# Agent Development Rules

1. Read `HARNESS.md`, `harness/app_blueprint.yaml`, and `tasks/CURRENT.md` before changing code.
2. Change only files needed for the requested behavior.
3. Never weaken `non_negotiable_invariants` to make a test pass.
4. Natural-language, future LLM output, and user-registered phrase text are data only. Never execute them as Python or JavaScript.
5. All generated, imported, and graphically edited patch values pass through the validator/clamp layer before reaching an audio engine.
6. Subtractive synth, PCM fretless sampler, PCM electric guitar, PCM grand piano, PCM drums, FM engines, and microphone analysis must share the same single AudioContext.
7. Keep live playing, MIDI, built-in sample playback, registered sample playback, humming preview, and future sequencer playback on the same `noteOn` / `noteOff` contract.
8. Do not embed third-party artist recordings in Factory PCM. Use locally generated demo PCM or appropriately licensed sample assets.
9. Guitar amp Drive / Tone / Presence / Cabinet / Chorus values must remain bounded and guitar runtime code must not create a second AudioContext.
10. Grand-piano Hammer / Resonance / Damper / Tone / Room values must remain bounded and piano runtime code must not create a second AudioContext.
11. Guitar chord strumming must be represented by bounded `whenSeconds` note offsets on the stable note-event API, not by a parallel audio path.
12. User-registered sample phrases must remain browser-local, must be bounded before playback, and must never be copied into generated app source or executed as code.
13. Microphone humming capture must analyse audio locally only. Do not persist, upload, encode, or record raw microphone audio. Stop MediaStream tracks when capture ends.
14. Humming pitch capture must be monophonic, bounded in duration/count/frequency, and preview only through the existing note-event contract.
15. Browser code must not attempt to load native VST plug-ins directly. Future VST3 support requires an explicit native-host/bridge boundary outside the browser runtime.
16. Run `python -m pytest tests/` and `python scripts/harness_check.py` before proposing a PR.
17. Update CHANGELOG.md and tasks/CURRENT.md with every user-visible change.
