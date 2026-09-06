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


def generate_patch(prompt: str) -> SynthPatch:
    """Generate a deterministic, inspectable patch from natural language.

    This intentionally does not execute model output. It is the offline fallback
    and future LLM adapters must return data that still passes validate_patch().
    """
    text = (prompt or "").strip().lower()
    p = SynthPatch(prompt=prompt or "")
    archetype = "synth"

    # Instrument archetypes first.
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
