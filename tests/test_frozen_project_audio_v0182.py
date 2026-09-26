import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is unavailable")
def test_frozen_pcm_round_trip_and_rejects_stale_track():
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const window={};
vm.runInNewContext(fs.readFileSync('web/frozen_audio_project.js','utf8'),
  {window,Blob,Response,CompressionStream,DecompressionStream,crypto,TextEncoder,btoa,atob,Uint8Array,DataView});
const codec=window.frozenAudioProject;
const project={bpm:100,length_beats:16};
const track={id:'track-a',source:{type:'vst3',plugin_id:'plugin'},clips:[{notes:[{note:60}]}],midi_channel:0,volume:.8};
const values=Float32Array.from({length:8000},(_,i)=>Math.sin(i/9)*.6);
const input={sampleRate:8000,numberOfChannels:1,length:8000,getChannelData:()=>values};
const ctx={createBuffer:(channels,frames,rate)=>{const data=new Float32Array(frames);
  return {numberOfChannels:channels,length:frames,sampleRate:rate,getChannelData:()=>data};}};
(async()=>{
  const entry=await codec.encode(input,track,project);
  const output=await codec.decode(entry,track,project,ctx);
  assert.strictEqual(output.length,input.length);
  assert(Math.abs(output.getChannelData(0)[500]-values[500])<.00004);
  await assert.rejects(()=>codec.decode(entry,{...track,clips:[]},project,ctx),/一致しません/);
  await assert.rejects(()=>codec.decode({...entry,frames:8000*43},track,project,ctx),/上限/);
})().catch(error=>{console.error(error);process.exitCode=1;});
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)


def test_export_and_import_restore_frozen_buffers_without_changing_json_schema():
    runtime = (ROOT / "web/multitrack_runtime.js").read_text(encoding="utf-8")
    assert "window.frozenAudioProject.encode(buffer,track,project)" in runtime
    assert "window.frozenAudioProject.decode(entry,track,raw,engine.ctx)" in runtime
    assert "frozenBuffers.set(track.id,restored.get(track.id))" in runtime


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is unavailable")
def test_internal_and_reference_stems_validate_patch_and_keep_vst_compatibility():
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const window={};
vm.runInNewContext(fs.readFileSync('web/frozen_audio_project.js','utf8'),
  {window,Blob,Response,CompressionStream,DecompressionStream,crypto,TextEncoder,btoa,atob,Uint8Array,DataView});
const codec=window.frozenAudioProject,project={bpm:100,length_beats:16};
const samples=Float32Array.from({length:8000},(_,i)=>Math.sin(i/20)*.5);
const input={sampleRate:8000,numberOfChannels:1,length:8000,getChannelData:()=>samples};
const ctx={createBuffer:(channels,frames,rate)=>{const data=new Float32Array(frames);
  return {numberOfChannels:channels,length:frames,sampleRate:rate,getChannelData:()=>data};}};
(async()=>{
  for(const type of ['internal','reference']){
    const track={id:'track-'+type,source:{type},clips:[{notes:[{note:60}]}],
      midi_channel:0,volume:.8,patch:{name:'warm'},generated_patch:{name:'warm'}};
    const entry=await codec.encode(input,track,project);
    const restored=await codec.decode(entry,track,project,ctx);
    assert(Math.abs(restored.getChannelData(0)[100]-samples[100])<.00004);
    await assert.rejects(()=>codec.decode(entry,{...track,patch:{name:'bright'}},project,ctx),/一致しません/);
    await assert.rejects(()=>codec.decode(entry,{...track,source:{type:'vst3'}},project,ctx),/一致しません/);
  }
  const old={id:'vst',source:{type:'vst3'},clips:[],midi_channel:0,volume:.8};
  const entry=await codec.encode(input,old,project);
  await codec.decode(entry,{...old,patch:{name:'added later'}},project,ctx);
})().catch(error=>{console.error(error);process.exitCode=1;});
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is unavailable")
def test_internal_freeze_capture_uses_exact_audio_frames():
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
let Constructor,frame=0;
class Processor { constructor(){this.messages=[];this.port={postMessage:value=>this.messages.push(value)};} }
const sandbox={AudioWorkletProcessor:Processor,Float32Array,
  registerProcessor:(_,klass)=>{Constructor=klass;}};
Object.defineProperty(sandbox,'currentFrame',{get:()=>frame});
vm.runInNewContext(fs.readFileSync('web/internal_freeze_processor.js','utf8'),sandbox);
const worklet=new Constructor({processorOptions:{startFrame:60,endFrame:200}});
for(frame=0;frame<256;frame+=128)
  worklet.process([[Float32Array.from({length:128},(_,i)=>frame+i),
                    Float32Array.from({length:128},(_,i)=>-(frame+i))]]);
const data=Float32Array.from(worklet.messages.filter(m=>m.data).flatMap(m=>Array.from(new Float32Array(m.data))));
assert.equal(data.length,280);
assert.equal(data[0],60);assert.equal(data[1],-60);
assert.equal(data[278],199);assert.equal(data[279],-199);
assert.equal(worklet.messages.at(-1).done,true);
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)
