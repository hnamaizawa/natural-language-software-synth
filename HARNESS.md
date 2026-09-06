# Development Harness

## Purpose
This harness keeps the synth reproducible and safe to evolve through natural-language change requests.

## Canonical artifacts
- `harness/app_blueprint.yaml`: capabilities, boundaries, required files, acceptance commands.
- `scripts/harness_check.py`: validates project structure, forbidden execution paths, schema invariants, and tests.
- `src/ai_synth/patch.py`: canonical patch data contract and clamps for synth and drum modes.
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
- Live keyboard, drum pads, MIDI, sample performance, and future sequencer use the same note event contract.
- Sample performance must not create a second audio engine or bypass `noteOn()` / `noteOff()`.
- Drum mode must share the same single AudioContext used by melodic synth mode.
- Drum parameters such as kick/snare tuning, decay, brightness, and room mix are bounded by the patch schema.

## v0.2.0 drum mode checks
- Drum-related prompts must produce `engine_type=drum`.
- Rosanna / Porcaro / shuffle-related prompts must produce `drum_style=half_time_shuffle`.
- Drum patches replace the piano performance surface with drum pads.
- Drum pads expose kick, snare, closed/open hat, three toms, crash, and ride.
- GM-style drum MIDI note aliases are canonicalized before triggering synthesized drum voices.
- Drum sample performances must use the same `noteOn()` / `noteOff()` contract as manual playing.
- The half-time shuffle sample is an original short demonstration of the feel rather than a recording or transcription of a copyrighted track.

## v0.1.1 sample performance checks
- The UI must expose sample type, play, and stop controls.
- Melody, chord, and bass sample patterns must be available for melodic patches.
- Sample playback must call the existing synth engine event contract.
- Starting manual keyboard or MIDI playing stops the automated sample sequence to avoid voice conflicts.
- Changing or importing a patch stops any active sample sequence before applying the new patch.

## Run
```bat
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```
Then open `http://127.0.0.1:8765`.
