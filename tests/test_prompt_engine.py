from ai_synth.prompt_engine import generate_patch


def test_warm_pad_is_slow_darkish_and_wide():
    p = generate_patch("warm analog pad with slow attack and wide detune")
    assert p.attack_s >= 1.0
    assert abs(p.osc2_detune_cents) >= 12
    assert p.filter_cutoff_hz < 4200
    assert p.release_s >= 3.0


def test_bright_bell_has_expected_shape():
    p = generate_patch("bright glassy bell with a long release")
    assert p.osc1_wave == "sine"
    assert p.attack_s <= 0.01
    assert p.sustain <= 0.1
    assert p.release_s >= 2.0
    assert p.filter_cutoff_hz > 10000


def test_bass_is_low_and_bounded():
    p = generate_patch("deep punchy synth bass, short and dark")
    assert p.octave_shift == -1
    assert p.attack_s <= 0.01
    assert p.filter_cutoff_hz < 1000
    assert p.master_gain <= 0.35
