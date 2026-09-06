# Architecture

Natural-language prompt -> Python Prompt Engine / future LLM adapter -> validated SynthPatch JSON -> browser SynthEngine -> audio output.

The future sequencer schedules exactly the same noteOn/noteOff methods currently used by keyboard/MIDI input. This prevents a second playback path from diverging from live performance behavior.
