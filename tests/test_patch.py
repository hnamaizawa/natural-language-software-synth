from ai_synth.patch import validate_patch


def test_patch_clamps_hazardous_values():
    p = validate_patch({
        "master_gain": 99,
        "max_polyphony": 999,
        "filter_cutoff_hz": 999999,
        "release_s": 999,
        "osc2_detune_cents": -999,
    })
    assert p.master_gain == 0.35
    assert p.max_polyphony == 16
    assert p.filter_cutoff_hz == 18000
    assert p.release_s == 10
    assert p.osc2_detune_cents == -50


def test_invalid_wave_falls_back():
    p = validate_patch({"osc1_wave": "javascript:alert(1)", "osc2_wave": "noise"})
    assert p.osc1_wave == "sawtooth"
    assert p.osc2_wave == "sawtooth"


def test_drum_patch_clamps_and_rejects_unknown_engine():
    p = validate_patch({
        "engine_type": "drum",
        "drum_style": "half_time_shuffle",
        "kick_tune_hz": 999,
        "snare_tone_hz": -1,
        "drum_room_mix": 99,
    })
    assert p.engine_type == "drum"
    assert p.drum_style == "half_time_shuffle"
    assert p.kick_tune_hz == 120
    assert p.snare_tone_hz == 90
    assert p.drum_room_mix == 0.45
    assert validate_patch({"engine_type": "javascript:bad"}).engine_type == "synth"
