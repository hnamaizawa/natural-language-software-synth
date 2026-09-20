from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

WAVES = {"sine", "triangle", "sawtooth", "square"}
ENGINE_TYPES = {"synth", "sampler", "drum", "fm"}
INSTRUMENT_MODELS = {
    "generic", "fretless_bass", "electric_guitar", "grand_piano", "studio_drums", "dx_ep",
    "spectral_resynth",
}
DRUM_STYLES = {"standard", "half_time_shuffle"}
GUITAR_AMP_MODELS = {"clean", "crunch", "high_gain", "acoustic"}
GUITAR_DEMO_STYLES = {"rock", "fusion", "acoustic"}
RESYNTH_SOURCES = {"piano", "guitar", "fretless"}


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(value)))


@dataclass(frozen=True)
class SynthPatch:
    name: str = "Init Patch"
    engine_type: str = "synth"
    instrument_model: str = "generic"
    drum_style: str = "standard"

    # Subtractive synth
    osc1_wave: str = "sawtooth"
    osc2_wave: str = "sawtooth"
    osc_mix: float = 0.45
    osc2_detune_cents: float = 7.0
    octave_shift: int = 0
    filter_cutoff_hz: float = 4200.0
    filter_q: float = 0.9
    attack_s: float = 0.02
    decay_s: float = 0.25
    sustain: float = 0.72
    release_s: float = 0.5
    lfo_rate_hz: float = 0.0
    lfo_depth_cents: float = 0.0
    delay_time_s: float = 0.0
    delay_feedback: float = 0.0
    delay_mix: float = 0.0

    # PCM fretless sampler
    sample_tone: float = 0.68
    sample_attack_mix: float = 0.48
    finger_noise_mix: float = 0.62
    release_noise_mix: float = 0.24
    slide_amount: float = 0.32
    slide_time_s: float = 0.16
    mwah_amount: float = 0.58
    sample_velocity_curve: float = 1.0

    # PCM electric guitar + amp
    guitar_amp_model: str = "clean"
    guitar_demo_style: str = "fusion"
    guitar_body_tone: float = 0.68
    guitar_pick_mix: float = 0.34
    guitar_release_mix: float = 0.14
    guitar_palm_mute: float = 0.08
    guitar_sustain: float = 0.72
    guitar_amp_drive: float = 0.18
    guitar_amp_tone: float = 0.64
    guitar_amp_presence: float = 0.58
    guitar_cabinet_mix: float = 0.78
    guitar_chorus_mix: float = 0.08

    # PCM grand piano
    piano_tone: float = 0.72
    piano_hammer_mix: float = 0.48
    piano_resonance: float = 0.58
    piano_damper_noise: float = 0.16
    piano_softness: float = 0.18
    piano_sustain: float = 0.82
    piano_velocity_curve: float = 1.10
    piano_room_mix: float = 0.14

    # PCM spectral resynthesis. The runtime derives harmonic templates from the locally
    # generated Factory Piano / Guitar / Fretless PCM and morphs between two sources.
    resynth_source_a: str = "piano"
    resynth_source_b: str = "guitar"
    resynth_morph: float = 0.35
    resynth_harmonics: int = 16
    resynth_brightness: float = 0.58
    resynth_pcm_mix: float = 0.20
    resynth_transient_mix: float = 0.28
    resynth_detune_cents: float = 5.0
    resynth_noise_mix: float = 0.02
    resynth_attack_s: float = 0.02
    resynth_decay_s: float = 0.50
    resynth_sustain: float = 0.68
    resynth_release_s: float = 1.10

    # PCM drums
    kick_tune_hz: float = 58.0
    kick_decay_s: float = 0.28
    snare_tone_hz: float = 185.0
    snare_decay_s: float = 0.22
    hat_decay_s: float = 0.09
    tom_decay_s: float = 0.42
    drum_brightness: float = 0.68
    drum_room_mix: float = 0.12

    # FM electric piano
    fm_mod_index: float = 4.8
    fm_brightness: float = 0.72
    fm_ratio_1: float = 14.0
    fm_ratio_2: float = 1.0
    fm_decay_s: float = 2.4
    fm_release_s: float = 1.4
    fm_chorus_mix: float = 0.18

    master_gain: float = 0.22
    max_polyphony: int = 12
    prompt: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def validate_patch(data: dict[str, Any] | SynthPatch) -> SynthPatch:
    if isinstance(data, SynthPatch):
        data = data.to_dict()
    if not isinstance(data, dict):
        raise TypeError("patch must be a mapping")

    def enum_value(key: str, default: str, allowed: set[str]) -> str:
        candidate = str(data.get(key, default)).lower()
        return candidate if candidate in allowed else default

    def wave(key: str, default: str) -> str:
        return enum_value(key, default, WAVES)

    try:
        octave = int(data.get("octave_shift", 0))
    except (TypeError, ValueError):
        octave = 0
    try:
        poly = int(data.get("max_polyphony", 12))
    except (TypeError, ValueError):
        poly = 12
    try:
        resynth_harmonics = int(data.get("resynth_harmonics", 16))
    except (TypeError, ValueError):
        resynth_harmonics = 16

    return SynthPatch(
        name=str(data.get("name", "Generated Patch"))[:80],
        engine_type=enum_value("engine_type", "synth", ENGINE_TYPES),
        instrument_model=enum_value("instrument_model", "generic", INSTRUMENT_MODELS),
        drum_style=enum_value("drum_style", "standard", DRUM_STYLES),
        osc1_wave=wave("osc1_wave", "sawtooth"),
        osc2_wave=wave("osc2_wave", "sawtooth"),
        osc_mix=_clamp(data.get("osc_mix", 0.45), 0.0, 1.0),
        osc2_detune_cents=_clamp(data.get("osc2_detune_cents", 7.0), -50.0, 50.0),
        octave_shift=max(-2, min(2, octave)),
        filter_cutoff_hz=_clamp(data.get("filter_cutoff_hz", 4200.0), 80.0, 18000.0),
        filter_q=_clamp(data.get("filter_q", 0.9), 0.1, 18.0),
        attack_s=_clamp(data.get("attack_s", 0.02), 0.001, 8.0),
        decay_s=_clamp(data.get("decay_s", 0.25), 0.001, 8.0),
        sustain=_clamp(data.get("sustain", 0.72), 0.0, 1.0),
        release_s=_clamp(data.get("release_s", 0.5), 0.01, 10.0),
        lfo_rate_hz=_clamp(data.get("lfo_rate_hz", 0.0), 0.0, 20.0),
        lfo_depth_cents=_clamp(data.get("lfo_depth_cents", 0.0), 0.0, 80.0),
        delay_time_s=_clamp(data.get("delay_time_s", 0.0), 0.0, 1.5),
        delay_feedback=_clamp(data.get("delay_feedback", 0.0), 0.0, 0.75),
        delay_mix=_clamp(data.get("delay_mix", 0.0), 0.0, 0.65),
        sample_tone=_clamp(data.get("sample_tone", 0.68), 0.0, 1.0),
        sample_attack_mix=_clamp(data.get("sample_attack_mix", 0.48), 0.0, 1.0),
        finger_noise_mix=_clamp(data.get("finger_noise_mix", 0.62), 0.0, 1.0),
        release_noise_mix=_clamp(data.get("release_noise_mix", 0.24), 0.0, 1.0),
        slide_amount=_clamp(data.get("slide_amount", 0.32), 0.0, 1.0),
        slide_time_s=_clamp(data.get("slide_time_s", 0.16), 0.0, 1.2),
        mwah_amount=_clamp(data.get("mwah_amount", 0.58), 0.0, 1.0),
        sample_velocity_curve=_clamp(data.get("sample_velocity_curve", 1.0), 0.4, 2.5),
        guitar_amp_model=enum_value("guitar_amp_model", "clean", GUITAR_AMP_MODELS),
        guitar_demo_style=enum_value("guitar_demo_style", "fusion", GUITAR_DEMO_STYLES),
        guitar_body_tone=_clamp(data.get("guitar_body_tone", 0.68), 0.0, 1.0),
        guitar_pick_mix=_clamp(data.get("guitar_pick_mix", 0.34), 0.0, 1.0),
        guitar_release_mix=_clamp(data.get("guitar_release_mix", 0.14), 0.0, 1.0),
        guitar_palm_mute=_clamp(data.get("guitar_palm_mute", 0.08), 0.0, 1.0),
        guitar_sustain=_clamp(data.get("guitar_sustain", 0.72), 0.1, 1.0),
        guitar_amp_drive=_clamp(data.get("guitar_amp_drive", 0.18), 0.0, 1.0),
        guitar_amp_tone=_clamp(data.get("guitar_amp_tone", 0.64), 0.0, 1.0),
        guitar_amp_presence=_clamp(data.get("guitar_amp_presence", 0.58), 0.0, 1.0),
        guitar_cabinet_mix=_clamp(data.get("guitar_cabinet_mix", 0.78), 0.0, 1.0),
        guitar_chorus_mix=_clamp(data.get("guitar_chorus_mix", 0.08), 0.0, 0.5),
        piano_tone=_clamp(data.get("piano_tone", 0.72), 0.0, 1.0),
        piano_hammer_mix=_clamp(data.get("piano_hammer_mix", 0.48), 0.0, 1.0),
        piano_resonance=_clamp(data.get("piano_resonance", 0.58), 0.0, 1.0),
        piano_damper_noise=_clamp(data.get("piano_damper_noise", 0.16), 0.0, 1.0),
        piano_softness=_clamp(data.get("piano_softness", 0.18), 0.0, 1.0),
        piano_sustain=_clamp(data.get("piano_sustain", 0.82), 0.2, 1.0),
        piano_velocity_curve=_clamp(data.get("piano_velocity_curve", 1.10), 0.5, 2.0),
        piano_room_mix=_clamp(data.get("piano_room_mix", 0.14), 0.0, 0.5),
        resynth_source_a=enum_value("resynth_source_a", "piano", RESYNTH_SOURCES),
        resynth_source_b=enum_value("resynth_source_b", "guitar", RESYNTH_SOURCES),
        resynth_morph=_clamp(data.get("resynth_morph", 0.35), 0.0, 1.0),
        resynth_harmonics=max(4, min(32, resynth_harmonics)),
        resynth_brightness=_clamp(data.get("resynth_brightness", 0.58), 0.0, 1.0),
        resynth_pcm_mix=_clamp(data.get("resynth_pcm_mix", 0.20), 0.0, 0.65),
        resynth_transient_mix=_clamp(data.get("resynth_transient_mix", 0.28), 0.0, 1.0),
        resynth_detune_cents=_clamp(data.get("resynth_detune_cents", 5.0), -30.0, 30.0),
        resynth_noise_mix=_clamp(data.get("resynth_noise_mix", 0.02), 0.0, 0.35),
        resynth_attack_s=_clamp(data.get("resynth_attack_s", 0.02), 0.001, 8.0),
        resynth_decay_s=_clamp(data.get("resynth_decay_s", 0.50), 0.001, 8.0),
        resynth_sustain=_clamp(data.get("resynth_sustain", 0.68), 0.0, 1.0),
        resynth_release_s=_clamp(data.get("resynth_release_s", 1.10), 0.01, 10.0),
        kick_tune_hz=_clamp(data.get("kick_tune_hz", 58.0), 35.0, 120.0),
        kick_decay_s=_clamp(data.get("kick_decay_s", 0.28), 0.05, 1.2),
        snare_tone_hz=_clamp(data.get("snare_tone_hz", 185.0), 90.0, 300.0),
        snare_decay_s=_clamp(data.get("snare_decay_s", 0.22), 0.05, 1.0),
        hat_decay_s=_clamp(data.get("hat_decay_s", 0.09), 0.02, 0.5),
        tom_decay_s=_clamp(data.get("tom_decay_s", 0.42), 0.08, 1.5),
        drum_brightness=_clamp(data.get("drum_brightness", 0.68), 0.0, 1.0),
        drum_room_mix=_clamp(data.get("drum_room_mix", 0.12), 0.0, 0.45),
        fm_mod_index=_clamp(data.get("fm_mod_index", 4.8), 0.0, 18.0),
        fm_brightness=_clamp(data.get("fm_brightness", 0.72), 0.0, 1.0),
        fm_ratio_1=_clamp(data.get("fm_ratio_1", 14.0), 0.25, 20.0),
        fm_ratio_2=_clamp(data.get("fm_ratio_2", 1.0), 0.25, 20.0),
        fm_decay_s=_clamp(data.get("fm_decay_s", 2.4), 0.05, 8.0),
        fm_release_s=_clamp(data.get("fm_release_s", 1.4), 0.05, 8.0),
        fm_chorus_mix=_clamp(data.get("fm_chorus_mix", 0.18), 0.0, 0.5),
        master_gain=_clamp(data.get("master_gain", 0.22), 0.02, 0.35),
        max_polyphony=max(1, min(16, poly)),
        prompt=str(data.get("prompt", ""))[:500],
    )
