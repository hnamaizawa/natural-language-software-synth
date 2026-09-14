# Agent Development Rules

1. Read `HARNESS.md`, `harness/app_blueprint.yaml`, and `tasks/CURRENT.md` before changing code.
2. Change only files needed for the requested behavior.
3. Never weaken `non_negotiable_invariants` to make a test pass.
4. Natural-language, future LLM output, humming results, and user-registered phrase text are data only. Never execute them as Python or JavaScript.
5. All generated, imported, and graphically edited patch values pass through validator/clamp layers before reaching an audio engine.
6. Subtractive synth, PCM fretless, PCM electric guitar, PCM grand piano, PCM drums, FM, and microphone analysis share the one browser AudioContext.
7. Live playing, MIDI, built-in samples, registered samples, humming preview, and VST3 routing use the same `noteOn` / `noteOff` boundary.
8. Microphone audio is analysed locally only. Never persist, upload, encode, or record raw microphone audio; stop MediaStream tracks when capture ends.
9. Humming pitch correction may move detected notes only to the inferred/selected scale; timing quantization remains bounded to approved BPM/grid ranges.
10. Staff notation must be derived from the corrected/quantized note-event data, not from raw microphone audio.
11. Do not embed third-party artist recordings in Factory PCM. Use locally generated demo PCM or appropriately licensed assets.
12. Guitar chord strumming uses bounded `whenSeconds` offsets; no parallel audio path.
13. User-registered sample phrases remain browser-local, bounded before playback, and are never copied into generated app source.
14. Browser JavaScript must never load `.vst3` binaries directly. VST3 runs only in the separate native Windows host process.
15. The Python VST3 bridge binds through the existing `127.0.0.1` server, loads only plug-ins returned by its local scan, and clamps Note/Velocity/Parameter values.
16. VST3 and audio-backend dependencies must be pinned by commit SHA. Native build outputs stay out of Git.
17. Any VST3 change must pass the Windows native-host build job in addition to Python pytest/Harness.
18. Run `python -m pytest tests/` and `python scripts/harness_check.py` before proposing a PR.
19. Update CHANGELOG.md and tasks/CURRENT.md with every user-visible change.
