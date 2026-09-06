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
