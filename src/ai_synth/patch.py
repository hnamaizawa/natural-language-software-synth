from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

WAVES = {"sine", "triangle", "sawtooth", "square"}
ENGINE_TYPES = {"synth", "drum"}
DRUM_STYLES = {"standard", "half_time_shuffle"}


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(value)))


@dataclass(frozen=True)
class SynthPatch:
    name: str = "Init Patch"
    engine_type: str = "synth"
    drum_style: str = "standard"
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
    kick_tune_hz: float = 58.0
    kick_decay_s: float = 0.28
    snare_tone_hz: float = 185.0
    snare_decay_s: float = 0.22
    hat_decay_s: float = 0.09
    tom_decay_s: float = 0.42
    drum_brightness: float = 0.68
    drum_room_mix: float = 0.12
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

    def wave(key: str, default: str) -> str:
        candidate = str(data.get(key, default)).lower()
        return candidate if candidate in WAVES else default

    engine_type = str(data.get("engine_type", "synth")).lower()
    if engine_type not in ENGINE_TYPES:
        engine_type = "synth"

    drum_style = str(data.get("drum_style", "standard")).lower()
    if drum_style not in DRUM_STYLES:
        drum_style = "standard"

    try:
        octave = int(data.get("octave_shift", 0))
    except (TypeError, ValueError):
        octave = 0
    try:
        poly = int(data.get("max_polyphony", 12))
    except (TypeError, ValueError):
        poly = 12

    return SynthPatch(
        name=str(data.get("name", "Generated Patch"))[:80],
        engine_type=engine_type,
        drum_style=drum_style,
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
        kick_tune_hz=_clamp(data.get("kick_tune_hz", 58.0), 35.0, 120.0),
        kick_decay_s=_clamp(data.get("kick_decay_s", 0.28), 0.05, 1.2),
        snare_tone_hz=_clamp(data.get("snare_tone_hz", 185.0), 90.0, 300.0),
        snare_decay_s=_clamp(data.get("snare_decay_s", 0.22), 0.05, 1.0),
        hat_decay_s=_clamp(data.get("hat_decay_s", 0.09), 0.02, 0.5),
        tom_decay_s=_clamp(data.get("tom_decay_s", 0.42), 0.08, 1.5),
        drum_brightness=_clamp(data.get("drum_brightness", 0.68), 0.0, 1.0),
        drum_room_mix=_clamp(data.get("drum_room_mix", 0.12), 0.0, 0.45),
        master_gain=_clamp(data.get("master_gain", 0.22), 0.02, 0.35),
        max_polyphony=max(1, min(16, poly)),
        prompt=str(data.get("prompt", ""))[:500],
    )
