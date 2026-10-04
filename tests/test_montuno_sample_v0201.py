"""Latin piano demo uses a two-bar montuno and coherent seven-part harmony."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_montuno_piano_ostinato_clave_and_seven_parts():
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web/sequencer_samples.js','utf8'),ctx);
const api=ctx.window.sequencerSamples,song=api.makeSong('montuno');
assert.equal(song.key,'C major');assert.equal(song.length_beats,32);assert(song.bpm>=136);
assert.equal(Object.keys(song.clips).length,7);
const notes=role=>song.clips[role].flatMap(clip=>clip.notes.map(note=>({...note,at:clip.start_beats+note.start_beats})));
const keys=notes('keyboard'),drums=notes('drums'),bass=notes('bass');
const onsets=bar=>[...new Set(keys.filter(n=>Math.floor(n.at/4)===bar).map(n=>n.at-bar*4))];
assert.deepEqual(onsets(0),[0,.5,1,1.5,2,2.5,3,3.5]);
assert.deepEqual(onsets(1),[0,.5,1.25,1.5,2,2.5,3,3.5]);
assert.deepEqual(onsets(4),onsets(0));
assert(keys.every(n=>n.duration_beats<=.22));
assert(keys.some(n=>n.at%4===1.25));
for(const bar of [0,1,2,3]){
  const strikes=keys.filter(n=>Math.floor(n.at/4)===bar);
  const octaveHits=onsets(bar).filter(at=>{
    const pitches=strikes.filter(n=>n.at===bar*4+at).map(n=>n.note);
    return pitches.length===2&&Math.abs(pitches[0]-pitches[1])===12;
  });
  assert.equal(octaveHits.length,2,`bar ${bar} should interleave octave strikes and single notes`);
  assert.equal(strikes.length,10,`bar ${bar} should have moving arpeggio notes`);
}
const clave=bar=>drums.filter(n=>n.note===37&&Math.floor(n.at/4)===bar).map(n=>n.at-bar*4);
assert.deepEqual(clave(0),[0,1.5,3]);assert.deepEqual(clave(1),[1,3]);
assert.deepEqual(bass.filter(n=>n.at<4).map(n=>n.at),[0,2.5,3.5]);
for(const role of ['bass','keyboard','guitar','melody','chorus','pad']){
  assert(notes(role).length>0);
  for(const note of notes(role)){
    assert([0,2,4,5,7,9,11].includes(note.note%12),`${role} outside C major`);
    const bar=Math.floor(note.at/4),root=api.songs.montuno.roots[bar];
    assert([0,4,7].includes(((note.note-root)%12+12)%12),`${role} outside bar chord`);
  }
}
'''
    subprocess.run(["node", "-e", script], cwd=ROOT, check=True)
