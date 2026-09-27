"""Concurrent internal voices reuse effect processors and release them afterwards."""
from pathlib import Path
import shutil
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is unavailable")
def test_subtractive_delay_and_piano_room_are_shared_per_patch():
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const app=fs.readFileSync('web/app.js','utf8');
const piano=fs.readFileSync('web/piano_runtime.js','utf8');
const guitar=fs.readFileSync('web/guitar_runtime.js','utf8');
const patch={engine_type:'synth',max_polyphony:12,octave_shift:0,delay_mix:.3,delay_time_s:.2,delay_feedback:.2,
  filter_cutoff_hz:4000,filter_q:1,osc1_wave:'sine',osc2_wave:'sine',osc2_detune_cents:0,osc_mix:.3,
  lfo_rate_hz:0,lfo_depth_cents:0,attack_s:.01,decay_s:.2,sustain:.7,release_s:.3};
const SynthEngine=vm.runInNewContext(app.slice(app.indexOf('class SynthEngine{'),app.indexOf('const engine=new SynthEngine();'))+'; SynthEngine',
  {DEFAULT_PATCH:patch,validatePatch:p=>p,clamp:(v,lo,hi)=>Math.min(hi,Math.max(lo,v)),midiFreq:()=>440,setPerformanceActive(){}});
const nodes=[];
function param(){return {value:0,setValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}};}
function node(kind){const x={kind,disconnected:false,gain:param(),frequency:param(),Q:param(),detune:param(),delayTime:param(),playbackRate:param(),
  connect(){},disconnect(){this.disconnected=true;},start(){},stop(){}};nodes.push(x);return x;}
const engine=new SynthEngine();engine.ctx={currentTime:0,createGain:()=>node('gain'),createOscillator:()=>node('osc'),
  createDelay:()=>node('delay'),createBiquadFilter:()=>node('filter'),createBufferSource:()=>node('source')};engine.master=node('master');
engine.playSubtractive(60,.8,0);engine.playSubtractive(64,.8,0);
assert.equal(nodes.filter(n=>n.kind==='delay').length,1);
const first=engine.voices.get(60),second=engine.voices.get(64),delay=nodes.find(n=>n.kind==='delay');
engine.noteOff(60);engine.noteOff(64);first.o1.onended();assert.equal(delay.disconnected,false);
second.o1.onended();assert.equal(delay.disconnected,true);
engine.playSubtractive(67,.8,0);assert.equal(nodes.filter(n=>n.kind==='delay').length,2);
engine.voices.get(67).o1.onended();

const pianoPatch={engine_type:'sampler',instrument_model:'grand_piano',piano_room_mix:.2,piano_resonance:.5,
  piano_tone:.5,piano_softness:.2,piano_sustain:.7,piano_velocity_curve:1,piano_hammer_mix:0};
engine.patch=pianoPatch;engine.sampleBuffers.set('piano_60',{});engine.limitVoices=()=>{};engine.playPianoNoise=()=>{};engine.ensurePianoSamples=()=>{};
const section=piano.slice(piano.indexOf('  const pianoRoomBuses='),piano.indexOf('  const baseNoteOn=engine.noteOn.bind(engine)'));
vm.runInNewContext(section,{engine,clamp:(v,lo,hi)=>Math.min(hi,Math.max(lo,v)),validatePianoExtras:p=>p,
  nearestPianoRoot:()=>60,midiFreq:()=>440,setPerformanceActive(){}});
const before=nodes.filter(n=>n.kind==='delay').length;
engine.playGrandPianoPCM(60,.8,0);engine.playGrandPianoPCM(64,.8,0);
assert.equal(nodes.filter(n=>n.kind==='delay').length,before+1);
const sources=nodes.filter(n=>n.kind==='source'),room=nodes.filter(n=>n.kind==='delay').at(-1);
sources[0].onended();assert.equal(room.disconnected,false);
sources[1].onended();assert.equal(room.disconnected,true);

const guitarPatch={instrument_model:'electric_guitar',guitar_chorus_mix:.3,guitar_amp_model:'clean',guitar_amp_drive:.2,
  guitar_body_tone:.5,guitar_amp_tone:.5,guitar_amp_presence:.5,guitar_cabinet_mix:.3,guitar_sustain:.7,
  guitar_palm_mute:0,guitar_pick_mix:0};
engine.patch=guitarPatch;engine.sampleBuffers.set('guitar_60',{});engine.ensureGuitarSamples=()=>{};
engine.ctx.createWaveShaper=()=>node('shaper');
const guitarSection=guitar.slice(guitar.indexOf('  const distortionCurves='),guitar.indexOf('  const baseNoteOn=engine.noteOn.bind(engine)'));
vm.runInNewContext(guitarSection,{engine,clamp:(v,lo,hi)=>Math.min(hi,Math.max(lo,v)),validateGuitarExtras:p=>p,
  nearestGuitarRoot:()=>60,setPerformanceActive(){}});
const guitarBefore=nodes.filter(n=>n.kind==='delay').length;
engine.playGuitarPCM(60,.8,0);engine.playGuitarPCM(64,.8,0);
assert.equal(nodes.filter(n=>n.kind==='delay').length,guitarBefore+1);
const guitarSources=nodes.filter(n=>n.kind==='source').slice(2),chorus=nodes.filter(n=>n.kind==='delay').at(-1);
guitarSources[0].onended();assert.equal(chorus.disconnected,false);
guitarSources[1].onended();assert.equal(chorus.disconnected,true);
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)
