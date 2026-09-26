import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is unavailable")
def test_same_pitch_on_separate_tracks_releases_only_its_own_voice():
    script = r"""
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync('web/app.js', 'utf8');
const body = source.slice(source.indexOf('class SynthEngine{'), source.indexOf('const engine=new SynthEngine();'));
const context = {DEFAULT_PATCH:{release_s:.1,max_polyphony:12},validatePatch:p=>p,
  clamp:(x,lo,hi)=>Math.max(lo,Math.min(hi,x)),setPerformanceActive:()=>{}};
const SynthEngine = vm.runInNewContext(body+'; SynthEngine', context);
const engine = new SynthEngine();
engine.ctx = {currentTime:0};
const stopped = [];
function voice(id){return {kind:'synth',voiceGain:{gain:{cancelScheduledValues:()=>{},setTargetAtTime:()=>{}}},
  o1:{stop:()=>stopped.push(id)},o2:{stop:()=>{}}};}
const first = 'drums:clip:0', second = 'melody:clip:0';
engine.voices.set(first,voice(first));
engine.voices.set(second,voice(second));
engine.playbackVoiceId = first;
engine.noteOff(60,.5);
assert(!engine.voices.has(first));
assert(engine.voices.has(second));
assert.deepStrictEqual(stopped,[first]);
engine.playbackVoiceId = second;
engine.noteOff(60,.5);
assert(!engine.voices.has(second));
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)
