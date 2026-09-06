# Development Harness

## Purpose
This harness keeps the synth reproducible and safe to evolve through natural-language change requests.

## Canonical artifacts
- `harness/app_blueprint.yaml`: capabilities, boundaries, required files, acceptance commands.
- `scripts/harness_check.py`: validates project structure, forbidden execution paths, schema invariants, and tests.
- `src/ai_synth/patch.py`: canonical patch data contract and clamps for synth, sampler, drum, and FM modes.
- `web/app.js`: real-time multi-engine implementation behind the stable `noteOn` / `noteOff` boundary.

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
- Every generated, imported, or graphically edited patch is validated and clamped.
- Master output gain and polyphony are bounded.
- AudioContext begins only from a user gesture.
- Subtractive synth, PCM sampler, PCM drums, and FM EP share one AudioContext.
- Live keyboard, drum pads, MIDI, sample performance, and future sequencer use the same note event contract.
- Sample performance must not create a second audio engine or bypass `noteOn()` / `noteOff()`.
- Factory PCM buffers must be generated locally or replaced only with appropriately licensed samples; artist recordings are not embedded.

## v0.3.0 multi-engine checks
- Fretless / Jaco / Pastorius prompts select `engine_type=sampler` and `instrument_model=fretless_bass`.
- The fretless engine uses AudioBuffer PCM playback with nearest-root note selection plus attack, release, and slide articulation layers.
- Rosanna / Porcaro / shuffle drum prompts select `engine_type=drum`, `instrument_model=studio_drums`, and `drum_style=half_time_shuffle`.
- Drum playback uses a PCM one-shot buffer and preserves the drum-pad surface and GM-style note mapping.
- DX-7 / DX7 / FM electric-piano prompts select `engine_type=fm` and `instrument_model=dx_ep`.
- FM EP uses frequency modulation inside the existing AudioContext and does not introduce a parallel engine boundary.
- The right-side patch editor exposes engine-specific range/select controls and applies changes through `validatePatch()` + `setPatch()`.
- The reset control restores the most recently generated/imported patch.

## v0.2.0 drum mode checks
- Drum patches replace the piano performance surface with drum pads.
- Drum pads expose kick, snare, closed/open hat, three toms, crash, and ride.
- The half-time shuffle sample is an original short demonstration of the feel rather than a recording or transcription of a copyrighted track.

## Run
```bat
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```
Then open `http://127.0.0.1:8765`.
