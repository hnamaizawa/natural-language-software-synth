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


def _dedicated_engine_request(text: str) -> bool:
    """Keep explicit acoustic/PCM instruments and DX EP on their dedicated engines."""
    return _has(
        text,
        "grand piano", "concert grand", "acoustic piano", "グランドピアノ", "生ピアノ", "ピアノ",
        "electric guitar", "acoustic guitar", "guitar", "エレキギター", "アコースティックギター", "ギター", "アコギ",
        "fretless", "フレットレス", "ジャコ", "pastorius",
        "drum", "drums", "drum kit", "ドラム", "ドラムセット", "kick", "snare", "キック", "スネア",
        "dx-7", "dx7", "dx ep", "fm electric piano", "dxエレピ",
    )


def _resynth_base(prompt: str, archetype: str, **values: object) -> SynthPatch:
    """Create a validated PCM-spectral-resynthesis patch.

    Runtime synthesis derives its harmonic templates from locally generated Factory
    Piano / Guitar / Fretless PCM. The prompt only selects bounded data values.
    """
    p = SynthPatch(
        name=_name(prompt, archetype),
        prompt=prompt or "",
        engine_type="sampler",
        instrument_model="spectral_resynth",
        master_gain=0.18,
        max_polyphony=12,
    )
    p = replace(p, **values)
    return validate_patch(p)


def _apply_common_descriptors(p: SynthPatch, text: str) -> SynthPatch:
    """Apply semantic, bounded modifiers to resynthesis dimensions."""
    if _has(text, "warm", "mellow", "soft", "暖か", "柔らか", "丸い", "まろやか", "甘い"):
        p = replace(
            p,
            resynth_brightness=max(0.08, p.resynth_brightness * 0.72),
            resynth_transient_mix=min(p.resynth_transient_mix, 0.30),
            resynth_pcm_mix=max(p.resynth_pcm_mix, 0.18),
        )
    if _has(text, "bright", "brilliant", "clear", "crisp", "明る", "きらびやか", "抜け", "硬い"):
        p = replace(
            p,
            resynth_brightness=min(1.0, p.resynth_brightness * 1.30 + 0.10),
            resynth_harmonics=min(32, p.resynth_harmonics + 4),
            resynth_transient_mix=min(1.0, p.resynth_transient_mix + 0.10),
        )
    if _has(text, "dark", "muted", "暗い", "こもった", "ダーク"):
        p = replace(
            p,
            resynth_brightness=max(0.05, p.resynth_brightness * 0.52),
            resynth_harmonics=max(6, p.resynth_harmonics - 4),
        )
    if _has(text, "wide", "lush", "fat", "広い", "広がり", "厚い", "太い", "ワイド"):
        p = replace(
            p,
            resynth_detune_cents=max(10.0, abs(p.resynth_detune_cents) * 1.45),
            resynth_morph=min(0.78, max(0.22, p.resynth_morph)),
        )
    if _has(text, "thin", "narrow", "細い", "薄い"):
        p = replace(p, resynth_detune_cents=min(abs(p.resynth_detune_cents), 2.0), resynth_pcm_mix=min(p.resynth_pcm_mix, 0.12))
    if _has(text, "dry", "close", "ドライ", "近い"):
        p = replace(p, delay_mix=0.0, delay_feedback=0.0, resynth_pcm_mix=max(p.resynth_pcm_mix, 0.22))
    if _has(text, "space", "spacious", "ambient", "echo", "delay", "reverb", "空間", "残響", "アンビエント"):
        p = replace(
            p,
            delay_time_s=max(0.28, p.delay_time_s),
            delay_feedback=max(0.24, p.delay_feedback),
            delay_mix=max(0.18, p.delay_mix),
            resynth_release_s=max(1.8, p.resynth_release_s),
        )
    if _has(text, "metal", "metallic", "glass", "crystal", "金属", "メタリック", "ガラス", "クリスタル"):
        p = replace(
            p,
            resynth_source_a="piano",
            resynth_source_b="guitar",
            resynth_morph=max(0.48, p.resynth_morph),
            resynth_brightness=max(0.84, p.resynth_brightness),
            resynth_harmonics=max(24, p.resynth_harmonics),
            resynth_detune_cents=max(7.0, abs(p.resynth_detune_cents)),
            resynth_pcm_mix=min(p.resynth_pcm_mix, 0.18),
        )
    if _has(text, "wood", "wooden", "woody", "木", "木質", "ウッディ"):
        p = replace(
            p,
            resynth_source_a="guitar",
            resynth_source_b="fretless",
            resynth_morph=0.34,
            resynth_brightness=min(p.resynth_brightness, 0.56),
            resynth_pcm_mix=max(p.resynth_pcm_mix, 0.26),
            resynth_transient_mix=max(p.resynth_transient_mix, 0.40),
        )
    if _has(text, "airy", "breathy", "breath", "息", "空気", "エアリー", "ブレス"):
        p = replace(p, resynth_noise_mix=max(p.resynth_noise_mix, 0.10), resynth_transient_mix=min(p.resynth_transient_mix, 0.12))
    if _has(text, "percussive", "punchy", "attack", "打楽器", "パーカッシブ", "アタック", "パンチ"):
        p = replace(
            p,
            resynth_attack_s=min(p.resynth_attack_s, 0.008),
            resynth_transient_mix=max(p.resynth_transient_mix, 0.62),
            resynth_pcm_mix=max(p.resynth_pcm_mix, 0.28),
        )
    if _has(text, "smooth", "legato", "滑らか", "なめらか"):
        p = replace(p, resynth_transient_mix=min(p.resynth_transient_mix, 0.15), resynth_attack_s=max(p.resynth_attack_s, 0.08), resynth_release_s=max(p.resynth_release_s, 1.1))
    if _has(text, "short", "staccato", "短い", "スタッカート"):
        p = replace(p, resynth_decay_s=min(p.resynth_decay_s, 0.24), resynth_sustain=min(p.resynth_sustain, 0.28), resynth_release_s=min(p.resynth_release_s, 0.32))
    if _has(text, "long", "sustain", "long release", "長い", "伸びる", "余韻"):
        p = replace(p, resynth_sustain=max(p.resynth_sustain, 0.72), resynth_release_s=max(p.resynth_release_s, 2.1))
    return validate_patch(p)


def _recognized_resynth_request(text: str) -> bool:
    return _has(
        text,
        "synth", "pad", "lead", "pluck", "bell", "mallet", "organ", "keys", "bass", "string", "brass", "choir", "voice",
        "analog", "digital", "retro", "cinematic", "ambient", "dreamy", "metallic", "glass", "wood", "airy", "warm", "bright", "dark",
        "シンセ", "パッド", "リード", "プラック", "ベル", "マレット", "オルガン", "鍵盤", "ベース", "ストリングス", "ブラス", "クワイア", "ボイス",
        "アナログ", "デジタル", "レトロ", "シネマ", "アンビエント", "メタリック", "ガラス", "木質", "エアリー", "暖か", "明る", "暗い",
    )


def generate_patch(prompt: str) -> SynthPatch:
    """Generate a deterministic timbre using dedicated PCM/FM engines or PCM resynthesis.

    Broad timbre descriptions no longer collapse onto the same two-oscillator subtractive
    voice. Instead, their harmonic body is reconstructed from Factory PCM spectral templates
    and can morph between Piano / Guitar / Fretless source families.
    """
    text = (prompt or "").strip().lower()
    if not text or _dedicated_engine_request(text):
        return generate_legacy_patch(prompt)

    p: SynthPatch | None = None
    archetype: str | None = None

    if _has(text, "string ensemble", "synth strings", "strings", "orchestral strings", "ストリングス", "シンセストリングス", "弦楽", "弦楽器"):
        archetype = "String Ensemble"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="fretless", resynth_source_b="piano", resynth_morph=0.38,
            resynth_harmonics=18, resynth_brightness=0.48, resynth_pcm_mix=0.16,
            resynth_transient_mix=0.10, resynth_detune_cents=10.0, resynth_noise_mix=0.02,
            resynth_attack_s=0.48, resynth_decay_s=0.82, resynth_sustain=0.84, resynth_release_s=2.6,
            delay_time_s=0.22, delay_feedback=0.16, delay_mix=0.10,
        )
    elif _has(text, "synth brass", "analog brass", "brass section", "brass", "horn section", "シンセブラス", "ブラス", "ホーン", "金管"):
        archetype = "Synth Brass"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="guitar", resynth_source_b="piano", resynth_morph=0.30,
            resynth_harmonics=16, resynth_brightness=0.74, resynth_pcm_mix=0.24,
            resynth_transient_mix=0.42, resynth_detune_cents=4.0, resynth_noise_mix=0.01,
            resynth_attack_s=0.035, resynth_decay_s=0.28, resynth_sustain=0.78, resynth_release_s=0.42,
        )
    elif _has(text, "choir", "vocal pad", "voice pad", "airy voice", "ahh", "ooh", "クワイア", "コーラスパッド", "ボイスパッド", "声のパッド", "エアリー"):
        archetype = "Airy Choir Pad"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="fretless", resynth_source_b="piano", resynth_morph=0.52,
            resynth_harmonics=12, resynth_brightness=0.38, resynth_pcm_mix=0.10,
            resynth_transient_mix=0.04, resynth_detune_cents=7.0, resynth_noise_mix=0.12,
            resynth_attack_s=0.92, resynth_decay_s=1.20, resynth_sustain=0.88, resynth_release_s=3.5,
            delay_time_s=0.40, delay_feedback=0.30, delay_mix=0.26,
        )
    elif _has(text, "synthwave", "retro synth", "80s synth", "80's synth", "poly synth", "polysynth", "シンセウェーブ", "レトロシンセ", "80年代シンセ", "ポリシンセ"):
        archetype = "Retro Polysynth"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="guitar", resynth_source_b="fretless", resynth_morph=0.44,
            resynth_harmonics=20, resynth_brightness=0.66, resynth_pcm_mix=0.14,
            resynth_transient_mix=0.20, resynth_detune_cents=15.0, resynth_noise_mix=0.01,
            resynth_attack_s=0.018, resynth_decay_s=0.42, resynth_sustain=0.72, resynth_release_s=0.95,
            delay_time_s=0.32, delay_feedback=0.28, delay_mix=0.22,
        )
    elif _has(text, "acid bass", "acid synth", "303", "resonant bass", "アシッドベース", "アシッド", "レゾナントベース", "レゾナンスベース"):
        archetype = "Resonant Acid Bass"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="fretless", resynth_source_b="guitar", resynth_morph=0.22,
            resynth_harmonics=18, resynth_brightness=0.58, resynth_pcm_mix=0.30,
            resynth_transient_mix=0.36, resynth_detune_cents=-2.0, resynth_noise_mix=0.01,
            resynth_attack_s=0.003, resynth_decay_s=0.16, resynth_sustain=0.40, resynth_release_s=0.16,
            octave_shift=-1,
        )
    elif _has(text, "synth keys", "analog keys", "soft keys", "poly keys", "シンセキー", "シンセ鍵盤", "アナログキー", "ソフトキー"):
        archetype = "Analog Synth Keys"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="piano", resynth_source_b="guitar", resynth_morph=0.34,
            resynth_harmonics=16, resynth_brightness=0.60, resynth_pcm_mix=0.24,
            resynth_transient_mix=0.46, resynth_detune_cents=6.0, resynth_noise_mix=0.0,
            resynth_attack_s=0.008, resynth_decay_s=0.52, resynth_sustain=0.36, resynth_release_s=1.15,
            delay_time_s=0.22, delay_feedback=0.16, delay_mix=0.12,
        )
    elif _has(text, "bell", "mallet", "marimba", "vibraphone", "glass", "crystal", "ベル", "マレット", "マリンバ", "ビブラフォン", "ガラス", "クリスタル"):
        archetype = "PCM Resynth Bell"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="piano", resynth_source_b="guitar", resynth_morph=0.58,
            resynth_harmonics=26, resynth_brightness=0.90, resynth_pcm_mix=0.18,
            resynth_transient_mix=0.72, resynth_detune_cents=8.0, resynth_noise_mix=0.0,
            resynth_attack_s=0.002, resynth_decay_s=0.72, resynth_sustain=0.08, resynth_release_s=1.55,
            delay_time_s=0.25, delay_feedback=0.20, delay_mix=0.12,
        )
    elif _has(text, "pluck", "harp", "koto", "plucked", "プラック", "ハープ", "琴", "撥弦"):
        archetype = "PCM Resynth Pluck"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="guitar", resynth_source_b="piano", resynth_morph=0.20,
            resynth_harmonics=22, resynth_brightness=0.70, resynth_pcm_mix=0.34,
            resynth_transient_mix=0.76, resynth_detune_cents=2.0, resynth_noise_mix=0.0,
            resynth_attack_s=0.002, resynth_decay_s=0.36, resynth_sustain=0.12, resynth_release_s=0.48,
        )
    elif _has(text, "organ", "オルガン"):
        archetype = "PCM Resynth Organ"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="fretless", resynth_source_b="piano", resynth_morph=0.28,
            resynth_harmonics=10, resynth_brightness=0.54, resynth_pcm_mix=0.06,
            resynth_transient_mix=0.02, resynth_detune_cents=1.5, resynth_noise_mix=0.01,
            resynth_attack_s=0.012, resynth_decay_s=0.20, resynth_sustain=0.96, resynth_release_s=0.38,
        )
    elif _has(text, "lead", "リード"):
        archetype = "PCM Resynth Lead"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="guitar", resynth_source_b="fretless", resynth_morph=0.52,
            resynth_harmonics=22, resynth_brightness=0.72, resynth_pcm_mix=0.16,
            resynth_transient_mix=0.24, resynth_detune_cents=5.0, resynth_noise_mix=0.01,
            resynth_attack_s=0.008, resynth_decay_s=0.28, resynth_sustain=0.74, resynth_release_s=0.46,
        )
    elif _has(text, "pad", "ambient", "cinematic", "dreamy", "パッド", "アンビエント", "シネマ", "幻想", "浮遊"):
        archetype = "PCM Resynth Pad"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="fretless", resynth_source_b="piano", resynth_morph=0.46,
            resynth_harmonics=14, resynth_brightness=0.44, resynth_pcm_mix=0.10,
            resynth_transient_mix=0.05, resynth_detune_cents=11.0, resynth_noise_mix=0.04,
            resynth_attack_s=0.80, resynth_decay_s=1.10, resynth_sustain=0.86, resynth_release_s=3.0,
            delay_time_s=0.38, delay_feedback=0.30, delay_mix=0.24,
        )
    elif _has(text, "bass", "ベース"):
        archetype = "PCM Resynth Bass"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="fretless", resynth_source_b="guitar", resynth_morph=0.18,
            resynth_harmonics=14, resynth_brightness=0.46, resynth_pcm_mix=0.30,
            resynth_transient_mix=0.36, resynth_detune_cents=1.5, resynth_noise_mix=0.01,
            resynth_attack_s=0.004, resynth_decay_s=0.26, resynth_sustain=0.64, resynth_release_s=0.30,
            octave_shift=-1,
        )
    elif _recognized_resynth_request(text):
        archetype = "PCM Spectral Resynth"
        p = _resynth_base(
            prompt, archetype,
            resynth_source_a="piano", resynth_source_b="fretless", resynth_morph=0.42,
            resynth_harmonics=18, resynth_brightness=0.58, resynth_pcm_mix=0.18,
            resynth_transient_mix=0.26, resynth_detune_cents=5.0, resynth_noise_mix=0.02,
            resynth_attack_s=0.02, resynth_decay_s=0.55, resynth_sustain=0.68, resynth_release_s=1.10,
        )

    if p is None or archetype is None:
        return generate_legacy_patch(prompt)

    return _apply_common_descriptors(p, text)
