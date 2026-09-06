# Natural Language Software Synth

A local-first software synthesizer MVP inspired by the development workflow of the stock-value-dislocation-verification-system project.

## What it does
- Describe a sound in natural language, e.g. `warm analog pad with a slow attack and wide detune`.
- Generates a bounded, inspectable synth patch.
- Play it immediately using the on-screen keyboard, PC keyboard, or a browser-supported MIDI keyboard.
- Export/import the patch as JSON.
- Preserves a stable note event API for future sequencer integration.

## MVP architecture
- **Python stdlib HTTP server**: local UI + `/api/generate-patch` API. No runtime third-party dependency.
- **Prompt engine**: deterministic vocabulary/scoring maps instrument and mood words into parameters.
- **Web Audio API**: two-oscillator polyphonic subtractive synth per voice.
- **Patch contract**: Python validates/clamps; browser also defensively clamps imported JSON.

## Quick start on Windows
```bat
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```
Open `http://127.0.0.1:8765` in Chrome or Edge.

## PC keyboard
`A W S E D F T G Y H U J K` maps chromatically from C4.

## Prompt examples
- `warm analog pad with slow attack and gentle movement`
- `bright glassy bell with a long release`
- `deep punchy synth bass, short and dark`
- `retro lead, wide detune, bright and aggressive`
- `soft dreamy ambient pad with lots of echo`

## Future sequencer integration
The browser engine intentionally exposes:
```text
setPatch(validatedPatch)
noteOn(midiNote, velocity, whenSeconds=0)
noteOff(midiNote, whenSeconds=0)
```
A future piano-roll/step sequencer only needs to schedule those same events.
