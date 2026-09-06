from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

WAVES = {"sine", "triangle", "sawtooth", "square"}


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(value)))


@dataclass(frozen=True)
class SynthPatch:
    name: str = "Init Patch"
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
        master_gain=_clamp(data.get("master_gain", 0.22), 0.02, 0.35),
        max_polyphony=max(1, min(16, poly)),
        prompt=str(data.get("prompt", ""))[:500],
    )
