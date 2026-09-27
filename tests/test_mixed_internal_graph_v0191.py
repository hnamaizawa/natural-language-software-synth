"""Regression checks for frozen-host device rest and shared FM effects."""
from pathlib import Path
import shutil
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is unavailable")
def test_multiple_fm_notes_share_one_chorus_and_release_it_after_last_voice():
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('web/app.js','utf8');
const body=src.slice(src.indexOf('class SynthEngine{'),src.indexOf('const engine=new SynthEngine();'));
const patch={engine_type:'fm',fm_ratio_1:2,fm_ratio_2:3,fm_mod_index:1,fm_brightness:.5,
  fm_decay_s:.6,fm_release_s:.2,fm_chorus_mix:.3,max_polyphony:12};
const C=vm.runInNewContext(body+'; SynthEngine',{DEFAULT_PATCH:patch,validatePatch:p=>p,
  clamp:(x,lo,hi)=>Math.max(lo,Math.min(hi,x)),setPerformanceActive:()=>{},midiFreq:()=>440});
const delays=[],nodes=[];
function param(){return {value:0,setValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){},exponentialRampToValueAtTime(){}};}
function node(kind){const v={kind,disconnected:false,gain:param(),frequency:param(),delayTime:param(),
  connect(){},disconnect(){this.disconnected=true},start(){},stop(){}};nodes.push(v);if(kind==='delay')delays.push(v);return v;}
const engine=new C();engine.ctx={currentTime:0,createGain:()=>node('gain'),createOscillator:()=>node('osc'),createDelay:()=>node('delay')};engine.master=node('master');
engine.playFM(60,.8,0);engine.playFM(64,.8,0);
assert.equal(delays.length,1,'the chorus belongs to the patch, not each note');
const a=engine.voices.get(60),b=engine.voices.get(64);
engine.noteOff(60,0);engine.noteOff(64,0);a.oscillators[0].onended();
assert.equal(delays[0].disconnected,false,'the second voice still needs the chorus');
b.oscillators[0].onended();assert.equal(delays[0].disconnected,true);
engine.playFM(67,.8,0);assert.equal(delays.length,2,'a later phrase receives a fresh chorus');
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)


def test_frozen_host_stops_device_only_when_all_instances_are_idle():
    native = (ROOT / "native/vst3_host/src/main.cpp").read_text(encoding="utf-8")
    assert "hasFrozen = hasFrozen || pair.second->isFrozen ()" in native
    assert "if (!pair.second->isIdleSuspended () || pair.second->hasOpenEditor ()) return;" in native
    assert "if (hasFrozen && ma_device_stop (&device_) == MA_SUCCESS) audioRunning_ = false;" in native
    assert "if (ma_device_start (&device_) != MA_SUCCESS) return false;" in native
    assert "rack.ensureAudioRunning ()" in native
    assert '"audio_device_running' in native
