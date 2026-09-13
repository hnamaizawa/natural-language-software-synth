# Development Harness

## Purpose
This harness keeps the synth reproducible and safe to evolve through natural-language change requests.

## Canonical artifacts
- `harness/app_blueprint.yaml`: capabilities, boundaries, required files, acceptance commands.
- `scripts/harness_check.py`: validates project structure, forbidden execution paths, schema invariants, microphone capture boundaries, and tests.
- `src/ai_synth/patch.py`: canonical patch data contract and clamps for synth, sampler, guitar amp, grand piano, drum, and FM modes.
- `web/app.js`: base real-time multi-engine implementation behind the stable `noteOn` / `noteOff` boundary.
- `web/guitar_runtime.js`: PCM electric-guitar model plus bounded amp/cabinet processing.
- `web/piano_runtime.js`: locally generated PCM grand-piano model with hammer/damper articulation and resonance.
- `web/performance_library_runtime.js`: expanded original demo library, guitar chord strum timing, and bounded local-only user phrase registration.
- `web/humming_runtime.js`: local-only microphone pitch analysis that converts monophonic humming into bounded MIDI-like note events.

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
- AudioContext begins only from a user gesture; all instruments and microphone analysis share the single base AudioContext.
- Live keyboard, drum pads, MIDI, built-in samples, registered samples, humming preview, and future sequencer use the same `noteOn()` / `noteOff()` contract.
- Factory PCM buffers are generated locally or may later be replaced only with appropriately licensed samples; artist recordings are not embedded.
- User-registered sample phrases remain browser-local (`localStorage`) and are never copied into source code or generated applications.
- Registered phrase BPM, step count, beats, velocity, and MIDI notes are bounded before playback.
- Microphone audio is analysis-only: no MediaRecorder, no upload, no raw-audio persistence, and MediaStream tracks are stopped when capture ends.

## v0.6.0 checks
- Humming capture begins only from the explicit Record button and calls `engine.init()` before requesting microphone access.
- Microphone input uses `navigator.mediaDevices.getUserMedia()` plus the existing `engine.ctx.createMediaStreamSource()` and `createAnalyser()` path.
- The microphone analyser is not connected to the master/destination, avoiding direct monitoring/feedback.
- Humming pitch detection is monophonic and YIN-style, bounded to 75–1000 Hz with minimum confidence 0.72.
- Capture is limited to 120 seconds and 512 detected notes; very short notes under 90 ms are discarded.
- Detected pitch is converted to MIDI note numbers and note names, with hysteresis to reduce vibrato-induced note chatter.
- Note lengths are quantized to 1/8, 1/16, or 1/32 beat units compatible with the existing custom-phrase bounds.
- Humming preview uses only `engine.noteOn()` / `engine.noteOff()` and does not create a parallel audio engine.
- Transfer to the custom phrase editor writes only note-event text into the existing UI; persistence occurs only if the user explicitly presses the existing Register button.
- Raw microphone audio is never written to localStorage, server APIs, GitHub, files, blobs, or MediaRecorder.

## v0.5.0 retained checks
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

## VST3 boundary
- Browser JavaScript must not directly load native VST binaries.
- A future Windows native VST3 host/bridge may map this application's stable note-event contract to VST3 note events and expose plug-in selection/parameters back to the browser UI.
- The bridge must be explicit, local, permissioned, and testable; it must not weaken the browser-side single-AudioContext invariants for the built-in engines.

## Run
```bat
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```
Then open `http://127.0.0.1:8765`.
