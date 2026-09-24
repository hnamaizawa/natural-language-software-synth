# Development Harness

## Purpose
This harness keeps the synth reproducible and safe to evolve through natural-language change requests. v0.7.0 adds post-capture humming correction/notation and an explicitly separated Windows native VST3 host without weakening the browser audio/data boundaries.

## Canonical artifacts
- `harness/app_blueprint.yaml`: capabilities, boundaries, required files, acceptance commands.
- `scripts/harness_check.py`: validates project structure, forbidden execution paths, browser microphone/privacy boundaries, humming correction/score boundaries, VST3 host/bridge boundaries, and regression tests.
- `src/ai_synth/patch.py`: canonical built-in patch data contract and clamps.
- `web/app.js`: base Web Audio engine behind the stable `noteOn` / `noteOff` boundary.
- `web/humming_runtime.js`: local-only microphone pitch analysis, automatic key/scale correction, timing quantization, and SVG staff notation.
- `web/vst3_runtime.js`: browser-side adapter that wraps the final `noteOn` / `noteOff` boundary and sends bounded events to the local bridge only when VST3 routing is enabled.
- `server.py`: loopback-only Python server plus scanned-ID-only VST3 bridge to the separate native host process.
- `native/vst3_host/`: Windows VST3 host source. It loads the VST3 plug-in, converts note/parameter events to VST3 events, renders audio, and sends audio to the local device through miniaudio.
- `build_vst3_host.cmd`: reproducible Windows x64 build entry point for the native host.

## Standard development loop
1. Read `tasks/CURRENT.md` and the blueprint.
2. Implement the smallest coherent change.
3. Add/update regression tests.
4. Do not weaken non-negotiable invariants.
5. Run `python -m pytest tests/`.
6. Run `python scripts/harness_check.py`.
7. For VST3/native changes, build `nlss_vst3_host.exe` on Windows x64.
8. Update CHANGELOG and CURRENT.
9. Open a PR and wait for both the Python/harness job and native Windows build job to pass before review/merge.

## Browser audio and data invariants
- Generated natural-language output, humming results, and registered phrase text are data only and never executable code.
- Every generated, imported, or graphically edited built-in patch is validated and clamped.
- Built-in browser instruments and microphone analysis share the one base `AudioContext`.
- Live keyboard, PC keyboard, Web MIDI, built-in samples, registered samples, and humming preview all enter through the same `noteOn()` / `noteOff()` boundary.
- Factory PCM buffers use generated or appropriately licensed content; third-party artist recordings are not embedded.
- User-registered sample phrases remain browser-local (`localStorage`) and are bounded before playback.
- Raw microphone audio is never recorded, encoded, uploaded, persisted, or copied into source code.

## v0.7.0 humming-assist checks
- Capture remains monophonic YIN-style analysis on the existing `engine.ctx`, bounded to 75–1000 Hz, confidence >= 0.72, maximum 120 seconds / 512 notes.
- Automatic key inference evaluates all 12 roots in Major and Natural Minor, weighted by detected-note duration and pitch confidence.
- Automatic pitch correction snaps only scale-outside notes to the nearest inferred scale pitch, searching no farther than 3 semitones.
- Users can disable automatic key correction; the raw detected pitch class is otherwise retained when already inside the inferred scale.
- Automatic timing searches BPM 60–180 and the approved 1/8, 1/16, 1/32 grids, while manual BPM remains bounded to 40–240.
- Manual BPM or quantize changes disable automatic timing for that result so the user's explicit edit wins.
- The editable/registered result remains the existing bounded Custom Phrase note-event format.
- SVG score rendering is based on corrected + quantized note events, not microphone samples. It chooses Treble/Bass clef from melody range and shows inferred key/BPM.
- Humming preview continues to call only `engine.noteOn()` / `engine.noteOff()`.

## v0.7.0 VST3 checks
- Browser JavaScript never loads or parses `.vst3` binaries. `web/vst3_runtime.js` talks only to same-origin `/api/vst3/*` endpoints.
- `server.py` remains bound to `127.0.0.1` and starts the native VST3 host as a separate child process.
- Plug-ins are discovered only from local scan roots (Windows standard VST3 roots plus optional `NLSS_VST3_PATHS`). The browser receives opaque IDs; load requests are resolved only through the server-side scanned-ID map.
- MIDI note is clamped to 0–127, velocity to 0–1, and VST parameter values to normalized 0–1 before reaching the native process.
- VST routing wraps the final note-event boundary, so on-screen keyboard, PC keyboard, Web MIDI, sample performances, guitar strum offsets, and humming preview can all drive the loaded VST3 instrument.
- When VST routing is disabled, the original built-in Web Audio path remains unchanged.
- Steinberg VST3 SDK 3.8.1 and miniaudio 0.11.25 are pinned by commit SHA in CMake.
- Native build outputs are ignored by Git and are produced locally/CI only.
- GitHub Actions must successfully compile `native/vst3_host/build/Release/nlss_vst3_host.exe` on `windows-latest` before the PR is considered complete.

## v0.14.5 shared VST3 and drum routing checks

- Tracks assigned to the same plug-in ID share one native plug-in instance; tracks assigned to different plug-ins retain separate instances.
- The currently loaded main VST3 instance is reused by matching tracks, preserving the kit or preset selected in the plug-in editor.
- With VST3 MIDI channel set to Auto, drum-role tracks use zero-based channel 9 (MIDI Channel 10) in live preview and batched arrangement playback.
- Clearing or releasing one track never clears or unloads a shared instance still referenced by another track.

## v0.14.4 multi-instance performance checks

- All logical track VST3 instances run inside one separate native host process and share exactly one miniaudio output device.
- Track IDs remain bounded and each logical instance retains independent plug-in/controller state.
- Arrangement Note On/Off events are bounded and sent as one batch per VST3 track; live playing retains the single-event path.
- The native host mixes all active instance outputs into the shared stereo stream and hard-clamps the final samples.
- An instance with no active notes is processed for a bounded four-second release tail and is then suspended until a new event arrives.

## Retained instrument checks
- Grand Piano uses generated PCM roots plus hammer/damper/resonance layers and no second AudioContext.
- Fretless explicit finger-style prompts keep enhanced Finger Noise / Attack PCM.
- Electric Guitar amp parameters remain bounded; guitar chords retain 16–28 ms down/up strum offsets through `whenSeconds`.
- Drum patches retain drum pads and drum PC-key mapping.
- Output normalization stays bounded and never adds a make-up-gain stage beyond the master-gain safety clamp.
- Jazz chord samples retain four-note quartal voicing with adjacent perfect fourths.
- Custom sample phrases remain local-only, maximum 50 phrases / 128 steps, with bounded BPM / beats / velocity / MIDI note values.

## Run built-in synth
```bat
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```
Then open `http://127.0.0.1:8765`.

## Enable VST3 hosting on Windows
One-time native build (requires Git, CMake, and Visual Studio 2022 Desktop development with C++):

```bat
build_vst3_host.cmd
```

Then start the normal app with `start_synth.cmd`, open the VST3 section, scan, select/load a plug-in, and enable VST3 routing.
