import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is unavailable")
def test_synth_skips_silent_delay_and_disconnects_feedback_after_release():
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('web/app.js','utf8');
const body=source.slice(source.indexOf('class SynthEngine{'),source.indexOf('const engine=new SynthEngine();'));
const patch={engine_type:'synth',octave_shift:0,osc1_wave:'sine',osc2_wave:'sine',osc_mix:.5,
  osc2_detune_cents:0,filter_cutoff_hz:2000,filter_q:1,attack_s:.01,decay_s:.1,sustain:.5,
  release_s:.1,lfo_rate_hz:0,lfo_depth_cents:0,delay_mix:0,delay_time_s:.2,delay_feedback:.4,max_polyphony:12};
const C=vm.runInNewContext(body+'; SynthEngine',{DEFAULT_PATCH:patch,validatePatch:p=>p,
  clamp:(x,lo,hi)=>Math.max(lo,Math.min(hi,x)),setPerformanceActive:()=>{},midiFreq:()=>440});
const nodes=[],delays=[];
function param(){return {value:0,setValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){},
  exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}};}
function node(kind){const result={kind,disconnected:false,gain:param(),frequency:param(),detune:param(),Q:param(),delayTime:param(),
  connect(){},disconnect(){this.disconnected=true;},start(){},stop(){}};nodes.push(result);if(kind==='delay')delays.push(result);return result;}
const engine=new C();engine.ctx={currentTime:0,createGain:()=>node('gain'),
  createBiquadFilter:()=>node('filter'),createOscillator:()=>node('osc'),createDelay:()=>node('delay')};
engine.master=node('master');
engine.playSubtractive(60,.7,0);
assert.strictEqual(delays.length,0);
let voice=engine.voices.get(60);
engine.noteOff(60,0);voice.o1.onended();assert(voice.voiceGain.disconnected);
engine.patch={...patch,delay_mix:.3};engine.playSubtractive(60,.7,0);
assert.strictEqual(delays.length,1);
voice=engine.voices.get(60);engine.noteOff(60,0);voice.o1.onended();
assert(delays[0].disconnected);
assert(voice.voiceGain.disconnected);
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)


def test_resynthesis_disconnects_its_feedback_cycle():
    source = (ROOT / "web/resynthesis_runtime.js").read_text(encoding="utf-8")
    assert "if(p.delay_mix>0)" in source
    assert "oscA.onended=()=>" in source
    assert "feedback,wet])node?.disconnect()" in source


def test_local_static_assets_do_not_keep_stale_audio_engine_scripts():
    source = (ROOT / "server.py").read_text(encoding="utf-8")
    assert 'self.send_header("Content-Type", content_type or "application/octet-stream")\n        self.send_header("Cache-Control", "no-store")' in source
