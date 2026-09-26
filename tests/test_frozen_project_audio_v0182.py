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
