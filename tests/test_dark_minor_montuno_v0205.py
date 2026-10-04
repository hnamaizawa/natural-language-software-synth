"""The darker C-minor montuno keeps all seven parts in the natural-minor harmony."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_dark_minor_montuno_has_minor_cycle_and_seven_parts():
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web/sequencer_samples.js','utf8'),ctx);
const api=ctx.window.sequencerSamples,spec=api.songs.dark_montuno,song=api.makeSong('dark_montuno');
assert.equal(song.key,'C natural minor');assert.equal(song.bpm,126);assert.equal(song.length_beats,32);
assert.equal(Object.keys(song.clips).length,7);
assert.deepEqual(Array.from(spec.roots),[48,44,41,43,48,44,41,43]);
assert.deepEqual(Array.from(spec.qualities),['min','maj','min','min','min','maj','min','min']);
const notes=role=>song.clips[role].flatMap(clip=>clip.notes.map(n=>({...n,at:clip.start_beats+n.start_beats})));
for(let bar=0;bar<8;bar++){
  const third=spec.qualities[bar]==='min'?3:4;
  for(const role of ['bass','keyboard','guitar','melody','chorus','pad']){
    for(const n of notes(role).filter(n=>Math.floor(n.at/4)===bar)){
      assert([0,third,7].includes((n.note-spec.roots[bar]+120)%12),role+' outside chord');
      assert([0,2,3,5,7,8,10].includes(n.note%12),'outside C natural minor');
    }
  }
  const keys=notes('keyboard').filter(n=>Math.floor(n.at/4)===bar);
  assert.equal(keys.length,12);
  assert(keys.every(n=>n.note<72),'piano voicing should remain restrained');
  const clave=notes('drums').filter(n=>n.note===37&&Math.floor(n.at/4)===bar).map(n=>n.at-bar*4);
  assert.deepEqual(clave,bar%2===0?[0,1.5,3]:[1,3]);
  const bell=notes('drums').filter(n=>n.note===56&&Math.floor(n.at/4)===bar).map(n=>n.at-bar*4);
  assert.deepEqual(bell,bar%2===0?[.75,2.75]:[.5,2.5,3.5]);
}
assert.equal(api.makeSong('montuno').key,'C major');
"""
    subprocess.run(["node", "-e", script], cwd=ROOT, check=True)
