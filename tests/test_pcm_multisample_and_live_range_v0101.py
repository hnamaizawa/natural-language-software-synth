from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESYNTH = (ROOT / "web" / "resynthesis_runtime.js").read_text(encoding="utf-8")
KEYBOARD = (ROOT / "web" / "keyboard_performance_runtime.js").read_text(encoding="utf-8")


def test_resynth_uses_nearest_multisample_roots_and_longer_pcm_body():
    for token in [
        "PIANO_ROOTS=Object.freeze([36,43,48,55,60,67,72,79,84])",
        "GUITAR_ROOTS=Object.freeze([40,45,50,55,59,64,69,74])",
        "function nearestRoot(note,roots)",
        "function sourceDescriptor(name,note=60)",
        "engine.ensurePianoSamples(root)",
        "engine.sampleBuffers.get(`guitar_${root}`)",
        "bodyDuration=clamp(1.15+p.resynth_decay_s*.85+p.resynth_release_s*.55,1.15,5.5)",
        "bodyGain=p.resynth_pcm_mix*.55*vel",
        "spectralShare=clamp(1-p.resynth_pcm_mix*.72,.38,1)",
    ]:
        assert token in RESYNTH


def test_resynth_pitch_is_actual_midi_note_not_hidden_patch_octave():
    assert "const f=midiFreq(note),morph=p.resynth_morph" in RESYNTH
    assert "midiFreq(note+(Number(p.octave_shift)||0)*12)" not in RESYNTH
    assert "live octave selection belongs to the" in RESYNTH


def test_live_keyboard_has_auto_and_manual_octave_ranges():
    for token in [
        'select.id="performanceOctaveSelect"',
        '["auto","自動（Bassは-1 Oct）"]',
        '["-2","-2 Oct"]',
        '["-1","-1 Oct"]',
        '["0","0 Oct"]',
        '["1","+1 Oct"]',
        '["2","+2 Oct"]',
        "function performanceOctave()",
        "currentKeyMap=function()",
        "baseNote+shift*12",
        "noteName(note)",
    ]:
        assert token in KEYBOARD


def test_bass_auto_octave_keeps_recorded_roll_and_sound_on_same_midi_notes():
    assert 'if(model==="fretless_bass")return-1' in KEYBOARD
    assert 'model==="spectral_resynth"&&/(bass|ベース|acid|アシッド|低音|低域)/i.test(text)' in KEYBOARD
    assert "const note=mapForEvent(e.code)" in KEYBOARD
    assert "recorded.push({note:item.note" in KEYBOARD
    assert "engine.noteOn(item.note,item.velocity)" in KEYBOARD


def test_drum_patch_keeps_pad_surface_and_pc_key_visual_feedback():
    for token in [
        'if(isDrumPatch())return map;',
        'if(keyboardWrap)keyboardWrap.hidden=true',
        'if(drumWrap)drumWrap.hidden=false',
        'function drumPadForCode(code)',
        'pad.classList.add("active")',
        'pad.classList.remove("active")',
        'A=Kick / S=Snare / D=Closed Hat / F=Open Hat',
    ]:
        assert token in KEYBOARD


def test_v0101_performance_runtime_does_not_create_parallel_audio_or_network_path():
    for forbidden in ["new AudioContext", "new (window.AudioContext", "MediaRecorder", "fetch(", "eval(", "new Function("]:
        assert forbidden not in KEYBOARD
    assert "engine.noteOn(note,.86)" in KEYBOARD
    assert "engine.noteOff(note)" in KEYBOARD
