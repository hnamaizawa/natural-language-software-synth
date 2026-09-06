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


def test_sampler_patch_parameters_are_clamped():
    p = validate_patch({
        "engine_type": "sampler",
        "instrument_model": "fretless_bass",
        "finger_noise_mix": 99,
        "slide_amount": -1,
        "slide_time_s": 99,
        "mwah_amount": 9,
        "sample_velocity_curve": 0,
    })
    assert p.engine_type == "sampler"
    assert p.instrument_model == "fretless_bass"
    assert p.finger_noise_mix == 1
    assert p.slide_amount == 0
    assert p.slide_time_s == 1.2
    assert p.mwah_amount == 1
    assert p.sample_velocity_curve == 0.4


def test_guitar_amp_patch_parameters_are_clamped():
    p = validate_patch({
        "engine_type": "sampler",
        "instrument_model": "electric_guitar",
        "guitar_amp_model": "high_gain",
        "guitar_demo_style": "rock",
        "guitar_amp_drive": 99,
        "guitar_amp_tone": -5,
        "guitar_amp_presence": 9,
        "guitar_cabinet_mix": 4,
        "guitar_pick_mix": 2,
        "guitar_release_mix": -2,
        "guitar_palm_mute": 5,
        "guitar_sustain": 0,
        "guitar_chorus_mix": 4,
    })
    assert p.engine_type == "sampler"
    assert p.instrument_model == "electric_guitar"
    assert p.guitar_amp_model == "high_gain"
    assert p.guitar_demo_style == "rock"
    assert p.guitar_amp_drive == 1
    assert p.guitar_amp_tone == 0
    assert p.guitar_amp_presence == 1
    assert p.guitar_cabinet_mix == 1
    assert p.guitar_pick_mix == 1
    assert p.guitar_release_mix == 0
    assert p.guitar_palm_mute == 1
    assert p.guitar_sustain == 0.1
    assert p.guitar_chorus_mix == 0.5


def test_invalid_guitar_enums_fall_back():
    p = validate_patch({
        "instrument_model": "electric_guitar",
        "guitar_amp_model": "javascript:bad",
        "guitar_demo_style": "unknown",
    })
    assert p.guitar_amp_model == "clean"
    assert p.guitar_demo_style == "fusion"


def test_drum_patch_clamps_and_rejects_unknown_engine():
    p = validate_patch({
        "engine_type": "drum",
        "instrument_model": "studio_drums",
        "drum_style": "half_time_shuffle",
        "kick_tune_hz": 999,
        "snare_tone_hz": -1,
        "drum_room_mix": 99,
    })
    assert p.engine_type == "drum"
    assert p.instrument_model == "studio_drums"
    assert p.drum_style == "half_time_shuffle"
    assert p.kick_tune_hz == 120
    assert p.snare_tone_hz == 90
    assert p.drum_room_mix == 0.45
    assert validate_patch({"engine_type": "javascript:bad"}).engine_type == "synth"


def test_fm_patch_parameters_are_clamped():
    p = validate_patch({
        "engine_type": "fm",
        "instrument_model": "dx_ep",
        "fm_mod_index": 999,
        "fm_brightness": -5,
        "fm_ratio_1": 999,
        "fm_ratio_2": 0,
        "fm_release_s": 100,
        "fm_chorus_mix": 9,
    })
    assert p.engine_type == "fm"
    assert p.instrument_model == "dx_ep"
    assert p.fm_mod_index == 18
    assert p.fm_brightness == 0
    assert p.fm_ratio_1 == 20
    assert p.fm_ratio_2 == 0.25
    assert p.fm_release_s == 8
    assert p.fm_chorus_mix == 0.5
