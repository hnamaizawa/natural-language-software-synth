from __future__ import annotations

import re
from dataclasses import replace

from .patch import SynthPatch, validate_patch
from .prompt_engine import generate_patch as generate_legacy_patch


def _has(text: str, *words: str) -> bool:
    return any(word in text for word in words)


def _name(prompt: str, archetype: str) -> str:
    compact = re.sub(r"\s+", " ", (prompt or "").strip())
    return f"{archetype} · {compact[:42]}" if compact else archetype


def _apply_common_descriptors(p: SynthPatch, text: str) -> SynthPatch:
    """Apply bounded descriptors shared by the additional subtractive archetypes."""
    if _has(text, "warm", "mellow", "soft", "暖か", "柔らか", "丸い", "まろやか"):
        p = replace(
            p,
            filter_cutoff_hz=max(80.0, p.filter_cutoff_hz * 0.68),
            filter_q=max(0.3, p.filter_q * 0.85),
            osc2_detune_cents=max(5.0, abs(p.osc2_detune_cents)),
        )
    if _has(text, "bright", "brilliant", "clear", "crisp", "明る", "きらびやか", "抜け"):
        p = replace(
            p,
            filter_cutoff_hz=min(18000.0, p.filter_cutoff_hz * 1.55),
            filter_q=min(18.0, p.filter_q * 1.08),
        )
    if _has(text, "dark", "muted", "暗い", "こもった"):
        p = replace(p, filter_cutoff_hz=max(80.0, p.filter_cutoff_hz * 0.48))
    if _has(text, "wide", "lush", "fat", "広い", "広がり", "厚い", "太い"):
        p = replace(
            p,
            osc2_detune_cents=max(14.0, abs(p.osc2_detune_cents) * 1.35),
            osc_mix=max(0.38, p.osc_mix),
        )
    if _has(text, "dry", "close", "ドライ", "近い"):
        p = replace(p, delay_mix=min(p.delay_mix, 0.05), delay_feedback=min(p.delay_feedback, 0.08))
    if _has(text, "space", "spacious", "ambient", "echo", "delay", "空間", "広い残響", "ディレイ"):
        p = replace(
            p,
            delay_time_s=max(0.28, p.delay_time_s),
            delay_feedback=max(0.24, p.delay_feedback),
            delay_mix=max(0.20, p.delay_mix),
        )
    return p


def generate_patch(prompt: str) -> SynthPatch:
    """Extend the deterministic prompt engine with more classic synthesis archetypes.

    These presets are original parameter recipes. No third-party preset files, samples,
    executable code, or network content is loaded at runtime.
    """
    text = (prompt or "").strip().lower()
    p = SynthPatch(prompt=prompt or "")
    archetype: str | None = None

    # String ensemble: slightly detuned saw/triangle voices, slow attack/release and subtle motion.
    if _has(
        text,
        "string ensemble", "synth strings", "strings", "orchestral strings",
        "ストリングス", "シンセストリングス", "弦楽", "弦楽器",
    ):
        archetype = "String Ensemble"
        p = replace(
            p,
            osc1_wave="sawtooth",
            osc2_wave="triangle",
            osc_mix=0.38,
            osc2_detune_cents=12.0,
            filter_cutoff_hz=4300.0,
            filter_q=0.75,
            attack_s=0.55,
            decay_s=0.70,
            sustain=0.84,
            release_s=2.45,
            lfo_rate_hz=5.1,
            lfo_depth_cents=5.0,
            delay_time_s=0.24,
            delay_feedback=0.18,
            delay_mix=0.12,
            master_gain=0.18,
        )

    # Synth brass: bright harmonics with a quick but non-zero attack and strong sustain.
    elif _has(
        text,
        "synth brass", "analog brass", "brass section", "brass", "horn section",
        "シンセブラス", "ブラス", "ホーン", "金管",
    ):
        archetype = "Synth Brass"
        p = replace(
            p,
            osc1_wave="sawtooth",
            osc2_wave="square",
            osc_mix=0.30,
            osc2_detune_cents=5.0,
            filter_cutoff_hz=2850.0,
            filter_q=1.45,
            attack_s=0.045,
            decay_s=0.32,
            sustain=0.80,
            release_s=0.38,
            lfo_rate_hz=5.0,
            lfo_depth_cents=2.5,
            delay_mix=0.04,
            master_gain=0.20,
        )

    # Airy choir/voice pad: smooth waveforms, slow envelope, gentle vibrato and ambience.
    elif _has(
        text,
        "choir", "vocal pad", "voice pad", "airy voice", "ahh", "ooh",
        "クワイア", "コーラスパッド", "ボイスパッド", "声のパッド", "エアリー",
    ):
        archetype = "Airy Choir Pad"
        p = replace(
            p,
            osc1_wave="sine",
            osc2_wave="triangle",
            osc_mix=0.58,
            osc2_detune_cents=9.0,
            filter_cutoff_hz=3300.0,
            filter_q=0.85,
            attack_s=0.95,
            decay_s=1.25,
            sustain=0.86,
            release_s=3.6,
            lfo_rate_hz=4.2,
            lfo_depth_cents=3.5,
            delay_time_s=0.41,
            delay_feedback=0.31,
            delay_mix=0.27,
            master_gain=0.17,
        )

    # Poly/synthwave keys: wide dual oscillator sound for chords and retro polysynth parts.
    elif _has(
        text,
        "synthwave", "retro synth", "80s synth", "80's synth", "poly synth", "polysynth",
        "シンセウェーブ", "レトロシンセ", "80年代シンセ", "ポリシンセ",
    ):
        archetype = "Retro Polysynth"
        p = replace(
            p,
            osc1_wave="sawtooth",
            osc2_wave="square",
            osc_mix=0.42,
            osc2_detune_cents=17.0,
            filter_cutoff_hz=5100.0,
            filter_q=1.15,
            attack_s=0.018,
            decay_s=0.42,
            sustain=0.70,
            release_s=0.95,
            lfo_rate_hz=4.6,
            lfo_depth_cents=2.0,
            delay_time_s=0.32,
            delay_feedback=0.29,
            delay_mix=0.24,
            master_gain=0.18,
        )

    # Acid/resonant bass: deliberately resonant, short and harmonically rich.
    elif _has(
        text,
        "acid bass", "acid synth", "303", "resonant bass",
        "アシッドベース", "アシッド", "レゾナントベース", "レゾナンスベース",
    ):
        archetype = "Resonant Acid Bass"
        p = replace(
            p,
            osc1_wave="sawtooth",
            osc2_wave="square",
            osc_mix=0.12,
            osc2_detune_cents=-2.0,
            octave_shift=-1,
            filter_cutoff_hz=720.0,
            filter_q=10.5,
            attack_s=0.002,
            decay_s=0.14,
            sustain=0.38,
            release_s=0.13,
            delay_time_s=0.16,
            delay_feedback=0.12,
            delay_mix=0.07,
            master_gain=0.23,
        )

    # Synth keys: percussive but softer than a pluck; useful for chords and comping.
    elif _has(
        text,
        "synth keys", "analog keys", "soft keys", "poly keys",
        "シンセキー", "シンセ鍵盤", "アナログキー", "ソフトキー",
    ):
        archetype = "Analog Synth Keys"
        p = replace(
            p,
            osc1_wave="triangle",
            osc2_wave="sawtooth",
            osc_mix=0.30,
            osc2_detune_cents=7.0,
            filter_cutoff_hz=5900.0,
            filter_q=1.1,
            attack_s=0.008,
            decay_s=0.52,
            sustain=0.34,
            release_s=1.15,
            lfo_rate_hz=0.0,
            lfo_depth_cents=0.0,
            delay_time_s=0.23,
            delay_feedback=0.17,
            delay_mix=0.13,
            master_gain=0.19,
        )

    if archetype is None:
        return generate_legacy_patch(prompt)

    p = _apply_common_descriptors(p, text)
    p = replace(p, name=_name(prompt, archetype))
    return validate_patch(p)
