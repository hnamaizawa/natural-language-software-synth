"""The filmed G-minor salsa example has its own coherent seven-part sample."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_salsa_montuno_chords_clave_and_hand_pattern():
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web/sequencer_samples.js','utf8'),ctx);
const api=ctx.window.sequencerSamples,song=api.makeSong('salsa_montuno');
assert.equal(song.key,'G harmonic minor');assert.equal(song.length_beats,32);
assert.equal(Object.keys(song.clips).length,7);
assert.deepEqual(Array.from(api.songs.salsa_montuno.roots),[43,48,38,48,43,48,38,43]);
const notes=role=>song.clips[role].flatMap(clip=>clip.notes.map(n=>({...n,at:clip.start_beats+n.start_beats})));
const keys=notes('keyboard'),drums=notes('drums');
for(let bar=0;bar<8;bar++){
  const chord=api.songs.salsa_montuno;
  const third=chord.qualities[bar]==='min'?3:4;
  const strikes=keys.filter(n=>Math.floor(n.at/4)===bar);
  assert.equal(strikes.length,12);
  const right=bar%2===0?[.5,1.5,2.5,3.5]:[0,.75,2,3.5];
  for(const at of right)assert(strikes.filter(n=>n.at===bar*4+at).length>=2);
  for(const role of ['bass','keyboard','guitar','melody','chorus','pad']){
    for(const note of notes(role).filter(n=>Math.floor(n.at/4)===bar))
      assert([0,third,7].includes((note.note-chord.roots[bar]+120)%12),role+' outside chord');
  }
  assert.deepEqual(drums.filter(n=>n.note===37&&Math.floor(n.at/4)===bar).map(n=>n.at-bar*4),
                   bar%2===0?[0,1.5,3]:[1,3]);
}
assert.equal(api.makeSong('montuno').key,'C major');
'''
    subprocess.run(["node", "-e", script], cwd=ROOT, check=True)
