# Development Harness

## Purpose
This harness keeps the synth reproducible and safe to evolve through natural-language change requests.

## Canonical artifacts
- `harness/app_blueprint.yaml`: capabilities, boundaries, required files, acceptance commands.
- `scripts/harness_check.py`: validates project structure, forbidden execution paths, schema invariants, and tests.
- `src/ai_synth/patch.py`: canonical patch data contract and clamps for synth, sampler, guitar amp, grand piano, drum, and FM modes.
- `web/app.js`: base real-time multi-engine implementation behind the stable `noteOn` / `noteOff` boundary.
- `web/guitar_runtime.js`: PCM electric-guitar model plus bounded amp/cabinet processing.
- `web/piano_runtime.js`: locally generated PCM grand-piano model with hammer/damper articulation and resonance.
- `web/performance_library_runtime.js`: expanded original demo library, guitar chord strum timing, and bounded local-only user phrase registration.

## Standard development loop
1. Read `tasks/CURRENT.md` and the blueprint.
2. Implement the smallest coherent change.
3. Add/update regression tests.
4. Do not weaken non-negotiable invariants.
5. Run `python -m pytest tests/`.
6. Run `python scripts/harness_check.py`.
7. Update CHANGELOG and CURRENT.
8. Open a PR and let the human review before merge.

## Audio and data invariants
- Generated natural-language output and registered phrase text are never executable code.
- Every generated, imported, or graphically edited patch is validated and clamped.
- Master output gain, polyphony, instrument trim, and engine-specific parameters are bounded.
- AudioContext begins only from a user gesture; all instruments share the single base AudioContext.
- Live keyboard, drum pads, MIDI, built-in samples, registered samples, and future sequencer use the same `noteOn()` / `noteOff()` contract.
- Factory PCM buffers are generated locally or may later be replaced only with appropriately licensed samples; artist recordings are not embedded.
- User-registered sample phrases remain browser-local (`localStorage`) and are never copied into source code or generated applications.
- Registered phrase BPM, step count, beats, velocity, and MIDI notes are bounded before playback.

## v0.5.0 checks
- Grand-piano prompts select `engine_type=sampler` and `instrument_model=grand_piano`; DX/FM electric-piano prompts remain `dx_ep`.
- Grand Piano uses locally generated PCM root samples plus Hammer Attack, Damper Release, Soundboard/Body Resonance, Tone, Softness, Sustain, Velocity Curve, and Room controls.
- `piano_runtime.js` must not create a new AudioContext or fetch `.wav` / `.mp3` assets.
- Fretless generation defaults to stronger finger articulation; explicit finger-style prompts raise `finger_noise_mix` to at least 0.82 and attack mix to at least 0.60.
- Multi-note electric-guitar sample steps use `whenSeconds` offsets so down/up strokes do not start every string simultaneously. Current style intervals remain between 16 and 28 ms.
- Expanded genre samples use only the stable note-event contract.
- Custom sample phrases are stored only in `localStorage`, limited to 50 phrases / 128 steps each, BPM 40–240, beats 0.125–8, velocity 0.05–1.0, MIDI notes 0–127.

## v0.4.x retained checks
- Electric-guitar detection requires explicit `instrument_model=electric_guitar`; guitar defaults serialized on other patches must not reroute them.
- Drum patches retain the drum surface and drum PC-key mapping.
- Guitar Amp Drive uses bounded `WaveShaper` distortion followed by Tone / Presence / Cabinet processing.
- Output-level normalization remains bounded (0.82–1.22 trim), uses the existing AudioContext, and does not add make-up gain beyond `master_gain`.
- Jazz chord samples use four-note quartal voicing with adjacent perfect fourths (5 semitones).

## v0.3.0 retained checks
- Fretless / Jaco / Pastorius prompts select PCM fretless sampler.
- Rosanna / Porcaro / shuffle drum prompts select PCM half-time-shuffle drums.
- DX-7 / DX7 / FM electric-piano prompts select the FM engine.
- The right-side Patch Editor applies changes through validation/clamp and supports continuous slider dragging.

## Run
```bat
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```
Then open `http://127.0.0.1:8765`.
