from __future__ import annotations

import re
from dataclasses import replace

from .patch import SynthPatch, validate_patch


def _has(text: str, *words: str) -> bool:
    return any(word in text for word in words)


def _slug_name(prompt: str, archetype: str) -> str:
    compact = re.sub(r"\s+", " ", prompt.strip())
    if compact:
        return f"{archetype.title()} · {compact[:42]}"
    return f"{archetype.title()} Patch"


def _is_drum_prompt(text: str) -> bool:
    return _has(
        text,
        "drum", "drums", "drummer", "drum kit", "kick", "snare", "hi-hat", "hihat",
        "ドラム", "ドラマー", "ドラムセット", "キック", "スネア", "ハイハット",
        "rosanna", "ロザーナ", "ロザーナー", "porcaro", "ポーカロ",
    )


def _is_fretless_prompt(text: str) -> bool:
    return _has(
        text,
        "fretless", "fretless bass", "pastorius", "jaco",
        "フレットレス", "フレットレスベース", "ジャコ", "パストリアス",
    )


def _is_dx_ep_prompt(text: str) -> bool:
    return _has(
        text,
        "dx-7", "dx7", "dx 7", "fm electric piano", "fm piano", "dx ep",
        "dxエレピ", "dx-7のエレピ", "dx7のエレピ",
    ) or (_has(text, "エレピ", "electric piano") and _has(text, "80s", "80年代", "fm", "デジタル"))


def _is_grand_piano_prompt(text: str) -> bool:
    if _has(text, "electric piano", "fm piano", "dx piano", "エレピ", "dx-7", "dx7"):
        return False
    return _has(
        text,
        "grand piano", "concert grand", "acoustic piano", "concert piano", "piano",
        "グランドピアノ", "コンサートグランド", "アコースティックピアノ", "生ピアノ", "ピアノ",
    )


def _is_guitar_prompt(text: str) -> bool:
    if _has(text, "bass guitar", "electric bass", "ベースギター", "エレキベース"):
        return False
    return _has(
        text,
        "electric guitar", "guitar", "strat", "telecaster", "humbucker", "single coil",
        "エレキギター", "ギター", "ストラト", "テレキャスター", "ハムバッカー", "シングルコイル",
        "acoustic guitar", "アコースティックギター", "アコギ",
    )


def generate_patch(prompt: str) -> SynthPatch:
    """Generate a deterministic, inspectable patch from natural language.

    Generated text never becomes executable code. Every engine selection still
    returns data that passes the same validated SynthPatch contract.
    """
    text = (prompt or "").strip().lower()
    p = SynthPatch(prompt=prompt or "")
    archetype = "synth"

    # 1) Fretless bass: PCM sampler first because articulation/noise matters.
    if _is_fretless_prompt(text):
        archetype = "pcm fretless bass"
        p = replace(
            p,
            engine_type="sampler",
            instrument_model="fretless_bass",
            sample_tone=0.70,
            sample_attack_mix=0.52,
            finger_noise_mix=0.68,
            release_noise_mix=0.30,
            slide_amount=0.38,
            slide_time_s=0.18,
            mwah_amount=0.68,
            sample_velocity_curve=1.05,
            lfo_rate_hz=4.8,
            lfo_depth_cents=5.0,
            master_gain=0.24,
            max_polyphony=10,
        )
        if _has(text, "finger", "fingerstyle", "指", "指弾", "フィンガー"):
            p = replace(p, finger_noise_mix=max(p.finger_noise_mix, 0.82), sample_attack_mix=max(p.sample_attack_mix, 0.60))
        if _has(text, "slide", "gliss", "スライド", "グリス"):
            p = replace(p, slide_amount=max(p.slide_amount, 0.68), slide_time_s=0.28)
        if _has(text, "mwah", "歌う", "うねり", "粘る"):
            p = replace(p, mwah_amount=max(p.mwah_amount, 0.82))
        if _has(text, "soft", "mellow", "柔らか", "丸い"):
            p = replace(p, sample_tone=min(p.sample_tone, 0.52))
        if _has(text, "bright", "抜け", "明る"):
            p = replace(p, sample_tone=max(p.sample_tone, 0.82))
        p = replace(p, name=_slug_name(prompt, archetype))
        return validate_patch(p)

    # 2) PCM studio drums.
    if _is_drum_prompt(text):
        archetype = "pcm studio drums"
        p = replace(
            p,
            engine_type="drum",
            instrument_model="studio_drums",
            drum_style="standard",
            kick_tune_hz=56,
            kick_decay_s=0.30,
            snare_tone_hz=185,
            snare_decay_s=0.23,
            hat_decay_s=0.085,
            tom_decay_s=0.44,
            drum_brightness=0.68,
            drum_room_mix=0.12,
            master_gain=0.24,
            max_polyphony=16,
        )
        if _has(
            text,
            "shuffle", "half-time", "halftime", "half time",
            "シャッフル", "ハーフタイム",
            "rosanna", "ロザーナ", "ロザーナー", "porcaro", "ポーカロ",
        ):
            archetype = "pcm half-time shuffle drums"
            p = replace(
                p,
                drum_style="half_time_shuffle",
                kick_tune_hz=54,
                kick_decay_s=0.27,
                snare_tone_hz=192,
                snare_decay_s=0.20,
                hat_decay_s=0.075,
                tom_decay_s=0.40,
                drum_brightness=0.74,
                drum_room_mix=0.16,
                master_gain=0.23,
            )
        if _has(text, "tight", "dry", "タイト", "ドライ"):
            p = replace(
                p,
                kick_decay_s=min(p.kick_decay_s, 0.24),
                snare_decay_s=min(p.snare_decay_s, 0.18),
                drum_room_mix=min(p.drum_room_mix, 0.08),
            )
        if _has(text, "big", "huge", "roomy", "large room", "大きい", "太い", "広い"):
            p = replace(
                p,
                kick_decay_s=max(p.kick_decay_s, 0.36),
                snare_decay_s=max(p.snare_decay_s, 0.28),
                drum_room_mix=max(p.drum_room_mix, 0.22),
            )
        if _has(text, "bright", "crisp", "明る", "抜け", "クリスプ"):
            p = replace(p, drum_brightness=max(p.drum_brightness, 0.82))
        p = replace(p, name=_slug_name(prompt, archetype))
        return validate_patch(p)

    # 3) DX-style electric piano: dedicated FM engine.
    if _is_dx_ep_prompt(text):
        archetype = "fm electric piano"
        p = replace(
            p,
            engine_type="fm",
            instrument_model="dx_ep",
            fm_mod_index=5.6,
            fm_brightness=0.78,
            fm_ratio_1=14.0,
            fm_ratio_2=1.0,
            fm_decay_s=2.8,
            fm_release_s=1.65,
            fm_chorus_mix=0.20,
            master_gain=0.20,
            max_polyphony=12,
        )
        if _has(text, "soft", "mellow", "柔らか", "丸い"):
            p = replace(p, fm_brightness=0.55, fm_mod_index=4.1)
        if _has(text, "bright", "bell", "きらびやか", "ベル"):
            p = replace(p, fm_brightness=0.92, fm_mod_index=7.2)
        if _has(text, "long", "余韻", "長い"):
            p = replace(p, fm_release_s=2.4)
        p = replace(p, name=_slug_name(prompt, archetype))
        return validate_patch(p)

    # 4) PCM grand piano: locally generated multi-sample with hammer/damper layers.
    if _is_grand_piano_prompt(text):
        archetype = "pcm grand piano"
        p = replace(
            p,
            engine_type="sampler",
            instrument_model="grand_piano",
            piano_tone=0.74,
            piano_hammer_mix=0.56,
            piano_resonance=0.66,
            piano_damper_noise=0.18,
            piano_softness=0.16,
            piano_sustain=0.88,
            piano_velocity_curve=1.12,
            piano_room_mix=0.16,
            master_gain=0.21,
            max_polyphony=16,
        )
        if _has(text, "concert", "classical", "コンサート", "クラシック", "豊か", "荘厳"):
            p = replace(p, piano_resonance=max(p.piano_resonance, 0.76), piano_room_mix=max(p.piano_room_mix, 0.22), piano_sustain=max(p.piano_sustain, 0.92))
        if _has(text, "soft", "mellow", "gentle", "柔らか", "丸い", "優しい"):
            p = replace(p, piano_softness=max(p.piano_softness, 0.48), piano_tone=min(p.piano_tone, 0.60), piano_hammer_mix=min(p.piano_hammer_mix, 0.36))
        if _has(text, "bright", "brilliant", "clear", "明る", "きらびやか", "抜け"):
            p = replace(p, piano_tone=max(p.piano_tone, 0.88), piano_hammer_mix=max(p.piano_hammer_mix, 0.66))
        if _has(text, "dry", "close", "intimate", "ドライ", "近い", "小さい部屋"):
            p = replace(p, piano_room_mix=min(p.piano_room_mix, 0.06), piano_resonance=min(p.piano_resonance, 0.52))
        p = replace(p, name=_slug_name(prompt, archetype))
        return validate_patch(p)

    # 5) PCM electric guitar with an amp/cabinet stage.
    if _is_guitar_prompt(text):
        archetype = "pcm electric guitar"
        p = replace(
            p,
            engine_type="sampler",
            instrument_model="electric_guitar",
            guitar_amp_model="clean",
            guitar_demo_style="fusion",
            guitar_body_tone=0.70,
            guitar_pick_mix=0.36,
            guitar_release_mix=0.14,
            guitar_palm_mute=0.08,
            guitar_sustain=0.74,
            guitar_amp_drive=0.16,
            guitar_amp_tone=0.66,
            guitar_amp_presence=0.58,
            guitar_cabinet_mix=0.76,
            guitar_chorus_mix=0.08,
            master_gain=0.20,
            max_polyphony=10,
        )
        if _has(text, "rock", "ロック", "distortion", "distorted", "overdrive", "crunch", "歪", "ディストーション", "オーバードライブ"):
            archetype = "pcm rock guitar"
            p = replace(
                p,
                guitar_amp_model="crunch",
                guitar_demo_style="rock",
                guitar_amp_drive=0.62,
                guitar_amp_tone=0.64,
                guitar_amp_presence=0.70,
                guitar_cabinet_mix=0.88,
                guitar_palm_mute=0.18,
                guitar_sustain=0.82,
                guitar_chorus_mix=0.03,
                master_gain=0.18,
            )
        if _has(text, "metal", "high gain", "high-gain", "heavy", "メタル", "ハイゲイン", "激しい歪"):
            archetype = "pcm high-gain guitar"
            p = replace(
                p,
                guitar_amp_model="high_gain",
                guitar_demo_style="rock",
                guitar_amp_drive=0.88,
                guitar_amp_tone=0.58,
                guitar_amp_presence=0.78,
                guitar_cabinet_mix=0.94,
                guitar_palm_mute=0.38,
                guitar_sustain=0.88,
                master_gain=0.16,
            )
        if _has(text, "fusion", "フュージョン", "smooth lead", "スムース", "滑らか"):
            archetype = "pcm fusion guitar"
            p = replace(
                p,
                guitar_amp_model="clean",
                guitar_demo_style="fusion",
                guitar_amp_drive=max(p.guitar_amp_drive, 0.28),
                guitar_amp_tone=0.72,
                guitar_amp_presence=0.66,
                guitar_cabinet_mix=0.70,
                guitar_chorus_mix=0.20,
                guitar_sustain=0.84,
                guitar_palm_mute=0.04,
            )
        if _has(text, "acoustic", "unplugged", "アコースティック", "アコギ", "生ギター"):
            archetype = "pcm acoustic-style guitar"
            p = replace(
                p,
                guitar_amp_model="acoustic",
                guitar_demo_style="acoustic",
                guitar_body_tone=0.84,
                guitar_pick_mix=0.50,
                guitar_release_mix=0.20,
                guitar_palm_mute=0.02,
                guitar_sustain=0.68,
                guitar_amp_drive=0.0,
                guitar_amp_tone=0.76,
                guitar_amp_presence=0.44,
                guitar_cabinet_mix=0.26,
                guitar_chorus_mix=0.04,
                master_gain=0.21,
            )
        if _has(text, "clean", "クリーン"):
            p = replace(p, guitar_amp_model="clean", guitar_amp_drive=min(p.guitar_amp_drive, 0.08))
        if _has(text, "bright", "bite", "明る", "抜け", "ジャキ"):
            p = replace(p, guitar_body_tone=max(p.guitar_body_tone, 0.80), guitar_amp_presence=max(p.guitar_amp_presence, 0.72))
        if _has(text, "warm", "mellow", "暖か", "丸い", "甘い"):
            p = replace(p, guitar_body_tone=min(p.guitar_body_tone, 0.58), guitar_amp_tone=min(p.guitar_amp_tone, 0.56))
        if _has(text, "palm mute", "palm-muted", "パームミュート", "ブリッジミュート", "ミュート"):
            p = replace(p, guitar_palm_mute=max(p.guitar_palm_mute, 0.60))
        if _has(text, "pick noise", "pick attack", "ピックノイズ", "ピッキング", "アタック"):
            p = replace(p, guitar_pick_mix=max(p.guitar_pick_mix, 0.58))
        p = replace(p, name=_slug_name(prompt, archetype))
        return validate_patch(p)

    # Existing subtractive synth archetypes.
    if _has(text, "pad", "ambient", "atmosphere", "dreamy", "パッド", "アンビエント"):
        archetype = "pad"
        p = replace(p, osc1_wave="sawtooth", osc2_wave="triangle", osc_mix=0.42,
                    osc2_detune_cents=14, filter_cutoff_hz=3200, filter_q=0.7,
                    attack_s=1.6, decay_s=1.1, sustain=0.78, release_s=3.5,
                    lfo_rate_hz=0.35, lfo_depth_cents=5, delay_time_s=0.42,
                    delay_feedback=0.34, delay_mix=0.28, master_gain=0.18)
    elif _has(text, "bass", "sub", "low", "ベース", "低音"):
        archetype = "bass"
        p = replace(p, osc1_wave="sawtooth", osc2_wave="square", osc_mix=0.28,
                    osc2_detune_cents=-5, octave_shift=-1, filter_cutoff_hz=850,
                    filter_q=2.2, attack_s=0.006, decay_s=0.16, sustain=0.66,
                    release_s=0.18, master_gain=0.25)
    elif _has(text, "bell", "chime", "glassy", "metallic", "ベル", "金属"):
        archetype = "bell"
        p = replace(p, osc1_wave="sine", osc2_wave="triangle", osc_mix=0.62,
                    osc2_detune_cents=19, filter_cutoff_hz=10500, filter_q=1.4,
                    attack_s=0.003, decay_s=1.8, sustain=0.08, release_s=2.8,
                    delay_time_s=0.31, delay_feedback=0.27, delay_mix=0.2,
                    master_gain=0.2)
    elif _has(text, "pluck", "plucked", "marimba", "ピチカート", "プラック"):
        archetype = "pluck"
        p = replace(p, osc1_wave="triangle", osc2_wave="sawtooth", osc_mix=0.25,
                    osc2_detune_cents=4, filter_cutoff_hz=5200, filter_q=2.4,
                    attack_s=0.002, decay_s=0.22, sustain=0.05, release_s=0.3,
                    delay_time_s=0.18, delay_feedback=0.18, delay_mix=0.12,
                    master_gain=0.24)
    elif _has(text, "lead", "solo", "screaming", "リード", "ソロ"):
        archetype = "lead"
        p = replace(p, osc1_wave="sawtooth", osc2_wave="square", osc_mix=0.38,
                    osc2_detune_cents=8, filter_cutoff_hz=6200, filter_q=3.1,
                    attack_s=0.01, decay_s=0.18, sustain=0.82, release_s=0.24,
                    lfo_rate_hz=5.2, lfo_depth_cents=3, master_gain=0.21)
    elif _has(text, "organ", "オルガン"):
        archetype = "organ"
        p = replace(p, osc1_wave="square", osc2_wave="sine", osc_mix=0.48,
                    osc2_detune_cents=0, filter_cutoff_hz=7000, filter_q=0.6,
                    attack_s=0.008, decay_s=0.03, sustain=0.92, release_s=0.12,
                    lfo_rate_hz=5.5, lfo_depth_cents=4, master_gain=0.18)

    if _has(text, "warm", "soft", "mellow", "gentle", "暖か", "柔らか", "まろやか"):
        p = replace(p, filter_cutoff_hz=p.filter_cutoff_hz * 0.62,
                    filter_q=max(0.5, p.filter_q * 0.82), master_gain=min(p.master_gain, 0.22))
    if _has(text, "bright", "shiny", "clear", "brilliant", "明る", "きらびやか"):
        p = replace(p, filter_cutoff_hz=p.filter_cutoff_hz * 1.65,
                    filter_q=p.filter_q * 1.08)
    if _has(text, "dark", "dull", "muted", "暗い", "こもった"):
        p = replace(p, filter_cutoff_hz=p.filter_cutoff_hz * 0.45,
                    filter_q=p.filter_q * 0.9)
    if _has(text, "aggressive", "hard", "edgy", "angry", "激しい", "攻撃的"):
        p = replace(p, osc1_wave="sawtooth", filter_cutoff_hz=p.filter_cutoff_hz * 1.25,
                    filter_q=p.filter_q * 1.45, master_gain=min(0.3, p.master_gain * 1.2))
    if _has(text, "wide", "fat", "thick", "lush", "太い", "広がり"):
        p = replace(p, osc2_detune_cents=max(12, abs(p.osc2_detune_cents) * 1.6),
                    osc_mix=max(0.38, p.osc_mix))
    if _has(text, "slow attack", "fade in", "ゆっくり立ち上が", "遅いアタック"):
        p = replace(p, attack_s=max(1.0, p.attack_s * 2.2))
    if _has(text, "fast attack", "punchy", "snappy", "速いアタック", "パンチ"):
        p = replace(p, attack_s=min(0.01, p.attack_s), decay_s=min(0.25, p.decay_s))
    if _has(text, "long release", "lingering", "tail", "余韻", "長いリリース"):
        p = replace(p, release_s=max(2.0, p.release_s * 1.8))
    if _has(text, "vibrato", "wobble", "揺れ", "ビブラート"):
        p = replace(p, lfo_rate_hz=max(4.5, p.lfo_rate_hz), lfo_depth_cents=max(8, p.lfo_depth_cents))
    if _has(text, "echo", "delay", "space", "spacious", "エコー", "ディレイ", "空間"):
        p = replace(p, delay_time_s=max(0.28, p.delay_time_s),
                    delay_feedback=max(0.26, p.delay_feedback), delay_mix=max(0.22, p.delay_mix))

    p = replace(p, name=_slug_name(prompt, archetype))
    return validate_patch(p)
