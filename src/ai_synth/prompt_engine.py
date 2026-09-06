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


def generate_patch(prompt: str) -> SynthPatch:
    """Generate a deterministic, inspectable patch from natural language.

    Generated text never becomes executable code. Drum and melodic patches both
    pass through the same validated SynthPatch data contract.
    """
    text = (prompt or "").strip().lower()
    p = SynthPatch(prompt=prompt or "")
    archetype = "synth"

    # Drum prompts select a dedicated synthesized drum engine mode.
    if _is_drum_prompt(text):
        archetype = "drum"
        p = replace(
            p,
            engine_type="drum",
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
            archetype = "half-time shuffle drum"
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
        if _has(text, "dark", "warm", "暗い", "暖か"):
            p = replace(p, drum_brightness=min(p.drum_brightness, 0.50))
        p = replace(p, name=_slug_name(prompt, archetype))
        return validate_patch(p)

    # Melodic instrument archetypes.
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

    # Mood and timbre modifiers.
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
    if _has(text, "thin", "narrow", "細い"):
        p = replace(p, osc_mix=0.15, osc2_detune_cents=2)
    if _has(text, "slow attack", "fade in", "ゆっくり立ち上が", "遅いアタック"):
        p = replace(p, attack_s=max(1.0, p.attack_s * 2.2))
    if _has(text, "fast attack", "punchy", "snappy", "速いアタック", "パンチ"):
        p = replace(p, attack_s=min(0.01, p.attack_s), decay_s=min(0.25, p.decay_s))
    if _has(text, "long release", "lingering", "tail", "余韻", "長いリリース"):
        p = replace(p, release_s=max(2.0, p.release_s * 1.8))
    if _has(text, "short", "tight", "staccato", "短い", "タイト"):
        p = replace(p, decay_s=min(0.18, p.decay_s), release_s=min(0.22, p.release_s))
    if _has(text, "vibrato", "wobble", "揺れ", "ビブラート"):
        p = replace(p, lfo_rate_hz=max(4.5, p.lfo_rate_hz), lfo_depth_cents=max(8, p.lfo_depth_cents))
    if _has(text, "echo", "delay", "space", "spacious", "エコー", "ディレイ", "空間"):
        p = replace(p, delay_time_s=max(0.28, p.delay_time_s),
                    delay_feedback=max(0.26, p.delay_feedback), delay_mix=max(0.22, p.delay_mix))
    if _has(text, "retro", "80s", "vintage", "レトロ", "ビンテージ"):
        p = replace(p, osc1_wave="sawtooth", osc2_wave="sawtooth",
                    osc2_detune_cents=max(9, p.osc2_detune_cents), delay_mix=max(0.12, p.delay_mix))

    p = replace(p, name=_slug_name(prompt, archetype))
    return validate_patch(p)
