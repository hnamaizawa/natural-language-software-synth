import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is unavailable")
def test_compatible_frozen_stems_are_summed_before_master_without_clipping():
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const window={};vm.runInNewContext(fs.readFileSync('web/frozen_stem_mix.js','utf8'),{window});
const stem=(left,right,rate=48000)=>({sampleRate:rate,numberOfChannels:2,length:left.length,
  getChannelData:i=>i?Float32Array.from(right):Float32Array.from(left)});
const ctx={sampleRate:44100,createBuffer:(channels,length,rate)=>{
  const data=[new Float32Array(length),new Float32Array(length)];
  return {numberOfChannels:channels,length,sampleRate:rate,getChannelData:i=>data[i]};}};
const result=window.frozenStemMix.mix([stem([.7,.1],[.2,.3]),stem([.6,.2],[.4,.1])],ctx);
assert.equal(result.sampleRate,48000);
assert(Math.abs(result.getChannelData(0)[0]-1.3)<.00001);
assert(Math.abs(result.getChannelData(1)[0]-.6)<.00001);
assert.equal(window.frozenStemMix.mix([stem([1],[1]),stem([1],[1],44100)],ctx),null);
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)


def test_frozen_only_playback_avoids_note_timer_and_shows_import_filename():
    runtime=(ROOT / "web/multitrack_runtime.js").read_text(encoding="utf-8")
    html=(ROOT / "web/index.html").read_text(encoding="utf-8")
    assert 'id="projectLoadedFile"' in html
    assert 'loadedProjectFilename=String(file.name||"").slice(0,255)' in runtime
    assert 'node.textContent=`読込ファイル: ${loadedProjectFilename||"なし"}`' in runtime
    assert 'mixedFrozenVstBuffer(tracks);render();arrangementPlaying=true' in runtime
    assert 'if(mixed)scheduleStem(mixed,engine.master)' in runtime
    assert 'if(queue.some(item=>!frozenBuffers.has(item.track.id)' in runtime
