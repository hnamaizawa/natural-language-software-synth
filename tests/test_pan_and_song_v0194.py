"""Check stereo frozen mixing and the expanded harmonic song catalog."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_frozen_stems_mix_with_independent_pan():
    if not shutil.which("node"):
        return
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const window={};vm.runInNewContext(fs.readFileSync('web/frozen_stem_mix.js','utf8'),{window});
const mk=(left,right)=>{const data=[Float32Array.from([left,left]),Float32Array.from([right,right])];return {numberOfChannels:2,sampleRate:48000,length:2,getChannelData(ch){return data[ch];}};};
const ctx={createBuffer:()=>mk(0,0)};
const result=window.frozenStemMix.mix([mk(1,1),mk(1,1)],ctx,[1,.5],[-1,1]);
assert.equal(result.getChannelData(0)[0],1);
assert.equal(result.getChannelData(1)[0],.5);
assert.equal(window.frozenStemMix.mix([mk(1,1),mk(1,1)],ctx,[1,1],[2,0]),null);
'''
    subprocess.run(["node", "-e", script], cwd=ROOT, check=True)


def test_song_catalog_has_descriptions_and_all_parts():
    if not shutil.which("node"):
        return
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const window={};vm.runInNewContext(fs.readFileSync('web/sequencer_samples.js','utf8'),{window});
const api=window.sequencerSamples;assert(Object.keys(api.songs).length>=8);
for(const [id,spec] of Object.entries(api.songs)){
  assert(spec.genre&&spec.description&&spec.key&&spec.bpm);
  const song=api.makeSong(id);assert.equal(Object.keys(song.clips).length,7);
  for(const clips of Object.values(song.clips))assert(clips.every(clip=>clip.notes.length>0));
}
'''
    subprocess.run(["node", "-e", script], cwd=ROOT, check=True)
