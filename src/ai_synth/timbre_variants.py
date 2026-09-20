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


CATEGORY_WORDS: dict[str, tuple[str, ...]] = {
    "strings": ("string ensemble", "synth strings", "strings", "orchestral strings", "ストリングス", "シンセストリングス", "弦楽", "弦楽器"),
    "brass": ("synth brass", "analog brass", "brass section", "brass", "horn section", "シンセブラス", "ブラス", "ホーン", "金管"),
    "choir": ("choir", "vocal pad", "voice pad", "ahh", "ooh", "クワイア", "コーラスパッド", "ボイスパッド", "声のパッド", "声っぽい"),
    "retro": ("synthwave", "retro synth", "80s synth", "80's synth", "poly synth", "polysynth", "シンセウェーブ", "レトロシンセ", "80年代シンセ", "ポリシンセ"),
    "acid": ("acid bass", "acid synth", "303", "resonant bass", "アシッドベース", "アシッド", "レゾナントベース", "レゾナンスベース"),
    "keys": ("synth keys", "analog keys", "soft keys", "poly keys", "シンセキー", "シンセ鍵盤", "アナログキー", "ソフトキー", "キーボード音色"),
    "bell": ("bell", "mallet", "marimba", "vibraphone", "glockenspiel", "ベル", "マレット", "マリンバ", "ビブラフォン", "グロッケン", "鐘"),
    "pluck": ("pluck", "harp", "koto", "plucked", "pizzicato", "プラック", "ハープ", "琴", "撥弦", "ピチカート"),
    "organ": ("organ", "オルガン"),
    "lead": ("lead", "solo synth", "リード", "ソロシンセ"),
    "pad": ("pad", "ambient", "cinematic", "dreamy", "atmosphere", "パッド", "アンビエント", "シネマ", "幻想", "浮遊", "アトモスフィア"),
    "bass": ("synth bass", "analog bass", "bass", "sub bass", "シンセベース", "アナログベース", "ベース", "サブベース"),
}

SEMANTIC_WORDS: dict[str, tuple[tuple[str, float], ...]] = {
    "bright": (("bright", 1), ("brilliant", 1), ("clear", .7), ("crisp", .8), ("sparkling", 1), ("明る", 1), ("きらびやか", 1), ("透明", .7), ("抜け", .8), ("輝", .8), ("dark", -1), ("暗い", -1), ("こも", -.8)),
    "warm": (("warm", 1), ("mellow", .8), ("暖か", 1), ("温か", 1), ("丸い", .7), ("まろやか", .8), ("cold", -1), ("icy", -1), ("冷たい", -1), ("氷", -.9)),
    "hard": (("hard", 1), ("sharp", 1), ("hard attack", 1), ("硬い", 1), ("鋭い", 1), ("soft", -1), ("gentle", -.8), ("柔らか", -1), ("優しい", -.8)),
    "fast_attack": (("fast attack", 1), ("quick attack", 1), ("instant", .8), ("立ち上がりが速", 1), ("アタックが速", 1), ("slow attack", -1), ("swell", -1), ("立ち上がりが遅", -1), ("ゆっくり立ち上", -1)),
    "long": (("long", .8), ("sustain", .8), ("lingering", 1), ("long release", 1), ("長い", .8), ("伸びる", .8), ("余韻", .9), ("持続", .8), ("short", -1), ("staccato", -1), ("短い", -1), ("スタッカート", -1)),
    "space": (("spacious", 1), ("ambient", .7), ("distant", .8), ("far", .7), ("reverb", .8), ("echo", .7), ("空間", .8), ("遠い", .8), ("残響", 1), ("ホール", .8), ("霧", .5), ("dry", -1), ("close", -.8), ("near", -.7), ("ドライ", -1), ("近い", -.8)),
    "wide": (("wide", 1), ("lush", .8), ("spread", .8), ("広い", 1), ("広がり", 1), ("包む", .7), ("narrow", -1), ("mono", -1), ("狭い", -1)),
    "air": (("airy", 1), ("breathy", 1), ("breath", .8), ("wind", .6), ("air", .5), ("息", 1), ("空気", .8), ("エアリー", 1), ("ブレス", 1), ("風", .6), ("smoke", .5), ("mist", .6), ("煙", .5), ("霞", .6)),
    "metal": (("metal", 1), ("metallic", 1), ("steel", 1), ("glass", .8), ("crystal", .8), ("金属", 1), ("メタリック", 1), ("鋼", .9), ("ガラス", .8), ("クリスタル", .8)),
    "wood": (("wood", 1), ("wooden", 1), ("woody", 1), ("木質", 1), ("木の", 1), ("木製", 1)),
    "organic": (("organic", 1), ("natural", .7), ("human", .6), ("有機", 1), ("自然", .7), ("生々", .8), ("digital", -1), ("synthetic", -.7), ("デジタル", -1), ("人工的", -.8)),
    "rough": (("rough", 1), ("gritty", 1), ("dirty", .8), ("noisy", .8), ("ざら", 1), ("荒い", 1), ("粗い", .9), ("ノイジー", .8), ("clean", -1), ("smooth", -.7), ("クリーン", -1), ("滑らか", -.7), ("なめらか", -.7)),
    "thick": (("fat", 1), ("thick", 1), ("dense", .8), ("heavy", .8), ("太い", 1), ("厚い", 1), ("濃い", .8), ("重い", .8), ("thin", -1), ("light", -.5), ("細い", -1), ("薄い", -1)),
    "percussive": (("percussive", 1), ("punchy", .9), ("attack", .5), ("パーカッシブ", 1), ("パンチ", .9), ("打楽器", .8), ("アタック", .5)),
}


def _dimension(text: str, axis: str) -> float:
    total = sum(weight for word, weight in SEMANTIC_WORDS[axis] if word in text)
    return max(-1.0, min(1.0, total))


def _semantic_profile(text: str) -> dict[str, float]:
    return {axis: _dimension(text, axis) for axis in SEMANTIC_WORDS}


def _category_scores(text: str) -> dict[str, float]:
    scores: dict[str, float] = {}
    for category, words in CATEGORY_WORDS.items():
        score = 0.0
        for word in words:
            if word in text:
                score += 1.0 + min(1.8, len(word) / 12.0)
        if score:
            scores[category] = score
    return scores


def _resynth_context(text: str) -> bool:
    return bool(_category_scores(text)) or any(abs(v) > 0 for v in _semantic_profile(text).values()) or _has(
        text, "synth", "analog", "digital", "retro", "シンセ", "アナログ", "デジタル", "レトロ"
    )


def _dedicated_engine_request(text: str) -> bool:
    """Use a dedicated instrument only when the prompt really asks for that instrument.

    `piano-like pad` / `ギターのようなベル` are resynthesis descriptions: the named
    physical instrument is treated as a timbral source hint instead of hijacking routing.
    """
    abstract_context = bool(_category_scores(text))
    comparison = _has(text, "-like", " like ", "like a", "のよう", "風の", "風な", "混ぜ", "blend", "hint of", "少し残")
    if abstract_context or comparison:
        return False
    return _has(
        text,
        "grand piano", "concert grand", "acoustic piano", "グランドピアノ", "生ピアノ",
        "electric guitar", "acoustic guitar", "エレキギター", "アコースティックギター", "アコギ",
        "fretless bass", "フレットレスベース", "ジャコ", "pastorius",
        "drum kit", "drums", "ドラムセット", "ドラムキット", "kick", "snare", "キック", "スネア",
        "dx-7", "dx7", "dx ep", "fm electric piano", "dxエレピ",
    ) or (_has(text, "ピアノ", "piano", "guitar", "ギター", "fretless", "フレットレス", "drum", "ドラム") and not _resynth_context(text))


def _resynth_base(prompt: str, archetype: str, **values: object) -> SynthPatch:
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


def _apply_secondary_category_traits(p: SynthPatch, scores: dict[str, float], primary: str) -> SynthPatch:
    """Let compound descriptions such as `bell pad` retain both category characters."""
    secondary = sorted(((score, key) for key, score in scores.items() if key != primary), reverse=True)
    if not secondary:
        return p
    score, key = secondary[0]
    primary_score = max(scores.get(primary, 1.0), 1.0)
    strength = min(0.42, 0.16 + 0.26 * score / primary_score)
    if key in {"pad", "choir", "strings"}:
        p = replace(
            p,
            resynth_attack_s=max(p.resynth_attack_s, 0.18 + strength * 1.1),
            resynth_sustain=max(p.resynth_sustain, 0.68 + strength * .35),
            resynth_release_s=max(p.resynth_release_s, 1.2 + strength * 4.2),
            resynth_transient_mix=max(0.02, p.resynth_transient_mix * (1 - strength * .75)),
            resynth_detune_cents=max(abs(p.resynth_detune_cents), 5 + strength * 16),
        )
    elif key in {"bell", "pluck"}:
        p = replace(
            p,
            resynth_attack_s=min(p.resynth_attack_s, 0.008),
            resynth_transient_mix=min(1.0, p.resynth_transient_mix + strength * .65),
            resynth_sustain=max(0.06, p.resynth_sustain * (1 - strength * .7)),
            resynth_brightness=min(1.0, p.resynth_brightness + strength * .30),
        )
    elif key in {"brass", "lead"}:
        p = replace(p, resynth_transient_mix=min(1.0, p.resynth_transient_mix + strength * .25), resynth_sustain=max(p.resynth_sustain, .65))
    elif key in {"bass", "acid"}:
        p = replace(p, octave_shift=-1, resynth_pcm_mix=min(.65, p.resynth_pcm_mix + strength * .28), resynth_brightness=max(.28, p.resynth_brightness - strength * .18))
    return validate_patch(p)


def _apply_common_descriptors(p: SynthPatch, text: str) -> SynthPatch:
    """Map descriptive language onto continuous timbre dimensions instead of one-off keywords."""
    s = _semantic_profile(text)
    bright, warm, hard = s["bright"], s["warm"], s["hard"]
    attack, length, space = s["fast_attack"], s["long"], s["space"]
    wide, air, metal = s["wide"], s["air"], s["metal"]
    wood, organic, rough = s["wood"], s["organic"], s["rough"]
    thick, percussive = s["thick"], s["percussive"]

    brightness = p.resynth_brightness + bright * .24 - warm * .12 + metal * .12 + rough * .05
    harmonics = p.resynth_harmonics + round(bright * 6 + metal * 5 + rough * 2 - warm * 2)
    transient = p.resynth_transient_mix + hard * .22 + percussive * .30 + attack * .20 - air * .10
    attack_s = p.resynth_attack_s * (0.30 if attack > .2 else 1.0)
    if attack < -.2:
        attack_s = max(attack_s, .30 + abs(attack) * .75)
    if hard < -.2:
        attack_s = max(attack_s, .04 + abs(hard) * .10)
        transient -= abs(hard) * .12

    decay = p.resynth_decay_s * (1 + max(0.0, length) * .55)
    sustain = p.resynth_sustain + length * .20
    release = p.resynth_release_s * (1 + max(0.0, length) * 1.25)
    if length < 0:
        decay *= 1 + length * .62
        sustain += length * .32
        release *= 1 + length * .72

    detune = abs(p.resynth_detune_cents) + wide * 13 + thick * 5
    pcm_mix = p.resynth_pcm_mix + organic * .16 + wood * .10 + thick * .05 - metal * .05
    noise = p.resynth_noise_mix + air * .15 + max(0.0, rough) * .12
    delay_mix = p.delay_mix + max(0.0, space) * .28
    delay_feedback = p.delay_feedback + max(0.0, space) * .28
    delay_time = p.delay_time_s + max(0.0, space) * .40
    if space < 0:
        delay_mix *= max(0.0, 1 + space)
        delay_feedback *= max(0.0, 1 + space)

    source_a, source_b, morph = p.resynth_source_a, p.resynth_source_b, p.resynth_morph
    if metal > .25:
        source_a, source_b, morph = "piano", "guitar", max(morph, .52)
    elif wood > .25:
        source_a, source_b, morph = "guitar", "fretless", min(max(morph, .20), .45)
    elif air > .35:
        source_a, source_b, morph = "fretless", "piano", max(morph, .42)

    # Instrument words inside an abstract description become source hints, not routing commands.
    if _has(text, "piano-like", "piano like", "ピアノのよう", "ピアノ風", "ピアノっぽ"):
        source_a = "piano"
    if _has(text, "guitar-like", "guitar like", "ギターのよう", "ギター風", "ギターっぽ", "ギター弦"):
        source_a, source_b, morph = "guitar", source_b if source_b != "guitar" else "fretless", min(morph, .38)
    if _has(text, "fretless-like", "フレットレスのよう", "フレットレス風"):
        source_a, source_b = "fretless", "piano"

    p = replace(
        p,
        resynth_source_a=source_a,
        resynth_source_b=source_b,
        resynth_morph=morph,
        resynth_brightness=brightness,
        resynth_harmonics=harmonics,
        resynth_pcm_mix=pcm_mix,
        resynth_transient_mix=transient,
        resynth_detune_cents=detune,
        resynth_noise_mix=noise,
        resynth_attack_s=attack_s,
        resynth_decay_s=decay,
        resynth_sustain=sustain,
        resynth_release_s=release,
        delay_time_s=delay_time,
        delay_feedback=delay_feedback,
        delay_mix=delay_mix,
    )
    return validate_patch(p)


def _recognized_resynth_request(text: str) -> bool:
    return _resynth_context(text)


def generate_patch(prompt: str) -> SynthPatch:
    """Generate a deterministic timbre from category + semantic timbre dimensions."""
    text = (prompt or "").strip().lower()
    if not text or _dedicated_engine_request(text):
        return generate_legacy_patch(prompt)

    scores = _category_scores(text)
    primary = max(scores, key=scores.get) if scores else "semantic"
    p: SynthPatch | None = None
    archetype: str | None = None

    if primary == "strings":
        archetype = "String Ensemble"
        p = _resynth_base(prompt, archetype, resynth_source_a="fretless", resynth_source_b="piano", resynth_morph=.38, resynth_harmonics=18, resynth_brightness=.48, resynth_pcm_mix=.16, resynth_transient_mix=.10, resynth_detune_cents=10, resynth_noise_mix=.02, resynth_attack_s=.48, resynth_decay_s=.82, resynth_sustain=.84, resynth_release_s=2.6, delay_time_s=.22, delay_feedback=.16, delay_mix=.10)
    elif primary == "brass":
        archetype = "Synth Brass"
        p = _resynth_base(prompt, archetype, resynth_source_a="guitar", resynth_source_b="piano", resynth_morph=.30, resynth_harmonics=16, resynth_brightness=.74, resynth_pcm_mix=.24, resynth_transient_mix=.42, resynth_detune_cents=4, resynth_noise_mix=.01, resynth_attack_s=.035, resynth_decay_s=.28, resynth_sustain=.78, resynth_release_s=.42)
    elif primary == "choir":
        archetype = "Airy Choir Pad"
        p = _resynth_base(prompt, archetype, resynth_source_a="fretless", resynth_source_b="piano", resynth_morph=.52, resynth_harmonics=12, resynth_brightness=.38, resynth_pcm_mix=.10, resynth_transient_mix=.04, resynth_detune_cents=7, resynth_noise_mix=.12, resynth_attack_s=.92, resynth_decay_s=1.20, resynth_sustain=.88, resynth_release_s=3.5, delay_time_s=.40, delay_feedback=.30, delay_mix=.26)
    elif primary == "retro":
        archetype = "Retro Polysynth"
        p = _resynth_base(prompt, archetype, resynth_source_a="guitar", resynth_source_b="fretless", resynth_morph=.44, resynth_harmonics=20, resynth_brightness=.66, resynth_pcm_mix=.14, resynth_transient_mix=.20, resynth_detune_cents=15, resynth_noise_mix=.01, resynth_attack_s=.018, resynth_decay_s=.42, resynth_sustain=.72, resynth_release_s=.95, delay_time_s=.32, delay_feedback=.28, delay_mix=.22)
    elif primary == "acid":
        archetype = "Resonant Acid Bass"
        p = _resynth_base(prompt, archetype, resynth_source_a="fretless", resynth_source_b="guitar", resynth_morph=.22, resynth_harmonics=18, resynth_brightness=.58, resynth_pcm_mix=.30, resynth_transient_mix=.36, resynth_detune_cents=-2, resynth_noise_mix=.01, resynth_attack_s=.003, resynth_decay_s=.16, resynth_sustain=.40, resynth_release_s=.16, octave_shift=-1)
    elif primary == "keys":
        archetype = "Analog Synth Keys"
        p = _resynth_base(prompt, archetype, resynth_source_a="piano", resynth_source_b="guitar", resynth_morph=.34, resynth_harmonics=16, resynth_brightness=.60, resynth_pcm_mix=.24, resynth_transient_mix=.46, resynth_detune_cents=6, resynth_noise_mix=0, resynth_attack_s=.008, resynth_decay_s=.52, resynth_sustain=.36, resynth_release_s=1.15, delay_time_s=.22, delay_feedback=.16, delay_mix=.12)
    elif primary == "bell":
        archetype = "PCM Resynth Bell"
        p = _resynth_base(prompt, archetype, resynth_source_a="piano", resynth_source_b="guitar", resynth_morph=.58, resynth_harmonics=26, resynth_brightness=.90, resynth_pcm_mix=.18, resynth_transient_mix=.72, resynth_detune_cents=8, resynth_noise_mix=0, resynth_attack_s=.002, resynth_decay_s=.72, resynth_sustain=.08, resynth_release_s=1.55, delay_time_s=.25, delay_feedback=.20, delay_mix=.12)
    elif primary == "pluck":
        archetype = "PCM Resynth Pluck"
        p = _resynth_base(prompt, archetype, resynth_source_a="guitar", resynth_source_b="piano", resynth_morph=.20, resynth_harmonics=22, resynth_brightness=.70, resynth_pcm_mix=.34, resynth_transient_mix=.76, resynth_detune_cents=2, resynth_noise_mix=0, resynth_attack_s=.002, resynth_decay_s=.36, resynth_sustain=.12, resynth_release_s=.48)
    elif primary == "organ":
        archetype = "PCM Resynth Organ"
        p = _resynth_base(prompt, archetype, resynth_source_a="fretless", resynth_source_b="piano", resynth_morph=.28, resynth_harmonics=10, resynth_brightness=.54, resynth_pcm_mix=.06, resynth_transient_mix=.02, resynth_detune_cents=1.5, resynth_noise_mix=.01, resynth_attack_s=.012, resynth_decay_s=.20, resynth_sustain=.96, resynth_release_s=.38)
    elif primary == "lead":
        archetype = "PCM Resynth Lead"
        p = _resynth_base(prompt, archetype, resynth_source_a="guitar", resynth_source_b="fretless", resynth_morph=.52, resynth_harmonics=22, resynth_brightness=.72, resynth_pcm_mix=.16, resynth_transient_mix=.24, resynth_detune_cents=5, resynth_noise_mix=.01, resynth_attack_s=.008, resynth_decay_s=.28, resynth_sustain=.74, resynth_release_s=.46)
    elif primary == "pad":
        archetype = "PCM Resynth Pad"
        p = _resynth_base(prompt, archetype, resynth_source_a="fretless", resynth_source_b="piano", resynth_morph=.46, resynth_harmonics=14, resynth_brightness=.44, resynth_pcm_mix=.10, resynth_transient_mix=.05, resynth_detune_cents=11, resynth_noise_mix=.04, resynth_attack_s=.80, resynth_decay_s=1.10, resynth_sustain=.86, resynth_release_s=3.0, delay_time_s=.38, delay_feedback=.30, delay_mix=.24)
    elif primary == "bass":
        archetype = "PCM Resynth Bass"
        p = _resynth_base(prompt, archetype, resynth_source_a="fretless", resynth_source_b="guitar", resynth_morph=.18, resynth_harmonics=14, resynth_brightness=.46, resynth_pcm_mix=.30, resynth_transient_mix=.36, resynth_detune_cents=1.5, resynth_noise_mix=.01, resynth_attack_s=.004, resynth_decay_s=.26, resynth_sustain=.64, resynth_release_s=.30, octave_shift=-1)
    elif _recognized_resynth_request(text):
        archetype = "PCM Semantic Resynth"
        p = _resynth_base(prompt, archetype, resynth_source_a="piano", resynth_source_b="fretless", resynth_morph=.42, resynth_harmonics=18, resynth_brightness=.58, resynth_pcm_mix=.18, resynth_transient_mix=.26, resynth_detune_cents=5, resynth_noise_mix=.02, resynth_attack_s=.02, resynth_decay_s=.55, resynth_sustain=.68, resynth_release_s=1.10)

    if p is None or archetype is None:
        return generate_legacy_patch(prompt)

    p = _apply_secondary_category_traits(p, scores, primary)
    return _apply_common_descriptors(p, text)
