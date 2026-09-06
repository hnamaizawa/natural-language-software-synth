from ai_synth.prompt_engine import generate_patch


def test_warm_pad_is_slow_darkish_and_wide():
    p = generate_patch("warm analog pad with slow attack and wide detune")
    assert p.engine_type == "synth"
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


def test_fretless_bass_prompt_selects_pcm_sampler():
    p = generate_patch("ジャコ・パストリアスのような歌うフレットレスベース。指弾きのノイズとスライド感を強めに。")
    assert p.engine_type == "sampler"
    assert p.instrument_model == "fretless_bass"
    assert p.finger_noise_mix >= 0.5
    assert p.slide_amount >= 0.68
    assert p.mwah_amount >= 0.68


def test_user_rosanna_prompt_selects_pcm_half_time_shuffle_drums():
    p = generate_patch("Toto のロザーナーでジェフ ポーカロさんのシャッフルで有名なドラムの音を生成してください。")
    assert p.engine_type == "drum"
    assert p.instrument_model == "studio_drums"
    assert p.drum_style == "half_time_shuffle"
    assert 35 <= p.kick_tune_hz <= 120
    assert 90 <= p.snare_tone_hz <= 300
    assert p.drum_brightness >= 0.7


def test_generic_drum_prompt_selects_drum_engine():
    p = generate_patch("tight studio drum kit with crisp hi-hat")
    assert p.engine_type == "drum"
    assert p.instrument_model == "studio_drums"
    assert p.drum_style == "standard"
    assert p.drum_room_mix <= 0.12


def test_dx7_ep_prompt_selects_fm_engine():
    p = generate_patch("80年代の DX-7 のような、きらびやかな FM エレピ")
    assert p.engine_type == "fm"
    assert p.instrument_model == "dx_ep"
    assert p.fm_mod_index > 4
    assert p.fm_brightness >= 0.75
    assert p.fm_chorus_mix > 0


def test_rock_electric_guitar_prompt_selects_pcm_guitar_with_distortion():
    p = generate_patch("ロック向けのエレキギター。アンプの歪みを強めにして、ピッキングのアタックが分かる音。")
    assert p.engine_type == "sampler"
    assert p.instrument_model == "electric_guitar"
    assert p.guitar_amp_model == "crunch"
    assert p.guitar_demo_style == "rock"
    assert p.guitar_amp_drive >= 0.6
    assert p.guitar_pick_mix >= 0.58


def test_fusion_guitar_prompt_prefers_cleaner_amp_and_chorus():
    p = generate_patch("フュージョン向けの滑らかなエレキギター。クリーン寄りでコーラスを少し。")
    assert p.engine_type == "sampler"
    assert p.instrument_model == "electric_guitar"
    assert p.guitar_demo_style == "fusion"
    assert p.guitar_amp_model == "clean"
    assert p.guitar_chorus_mix >= 0.18
    assert p.guitar_amp_drive <= 0.3


def test_acoustic_style_guitar_prompt_removes_amp_drive():
    p = generate_patch("アコースティック調のギター。歪みなしでピックのニュアンスを強めに。")
    assert p.engine_type == "sampler"
    assert p.instrument_model == "electric_guitar"
    assert p.guitar_amp_model == "acoustic"
    assert p.guitar_demo_style == "acoustic"
    assert p.guitar_amp_drive == 0
    assert p.guitar_pick_mix >= 0.5
