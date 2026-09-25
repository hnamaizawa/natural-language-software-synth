"""Exercise the generated eight-bar arrangements and their shared harmony."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_demo_songs_share_key_and_chords_across_tracks():
    if not shutil.which('node'):
        return
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web/sequencer_samples.js','utf8'),ctx);
const api=ctx.window.sequencerSamples;
for(const [id,spec] of Object.entries(api.songs)){
  const song=api.makeSong(id);assert.equal(song.length_beats,32);assert.equal(Object.keys(song.clips).length,7);
  const scale= id==='fusion'?[0,2,4,5,7,9,11]:id==='pop'?[0,2,4,5,7,9,11]:[0,2,4,6,7,9,11];
  for(const [role,clips] of Object.entries(song.clips)){
    assert.equal(clips.length,2);assert.deepEqual(Array.from(clips,c=>c.start_beats),[0,16]);
    for(const clip of clips)for(const note of clip.notes){
      assert(note.start_beats>=0&&note.start_beats<16);assert(note.start_beats+note.duration_beats<=16);
      if(role==='drums')continue;
      assert(scale.includes(note.note%12),`${id} ${role} out of key ${note.note}`);
      const bar=Math.floor((clip.start_beats+note.start_beats)/4),root=spec.roots[bar],minor=spec.qualities[bar]==='min';
      assert([0,minor?3:4,7].includes(((note.note-root)%12+12)%12),`${id} ${role} out of chord ${note.note}`);
    }
  }
}
'''
    subprocess.run(['node', '-e', script], cwd=ROOT, check=True)


def test_playhead_reads_shared_audio_clock_without_rebuilding_editor():
    js = (ROOT / 'web/multitrack_runtime.js').read_text(encoding='utf-8')
    assert 'engine.ctx.currentTime-cycleStart' in js
    assert 'requestAnimationFrame(update)' in js
    assert 'cancelAnimationFrame(playheadFrame)' in js
    assert 'marker.style.left=' in js
    assert 'id="playPosition"' in (ROOT / 'web/index.html').read_text(encoding='utf-8')
