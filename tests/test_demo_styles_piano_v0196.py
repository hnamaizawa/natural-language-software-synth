"""Genre templates change every role while keeping bounded diatonic clips."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_song_selection_generates_distinct_arrangements_in_every_role():
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const window={};vm.runInNewContext(fs.readFileSync('web/sequencer_samples.js','utf8'),{window});
const api=window.sequencerSamples,ids=Object.keys(api.songs);
for(const id of ['jazz','jpop','anison'])assert(ids.includes(id));
for(const role of ['drums','bass','keyboard','guitar','melody','chorus','pad']){
  const signatures=ids.map(id=>api.makeSong(id).clips[role].flatMap(clip=>clip.notes.map(n=>[clip.start_beats+n.start_beats,n.note,n.duration_beats])).join('|'));
  assert.equal(new Set(signatures).size,ids.length,`${role} has duplicated genre score`);
}
assert.equal(api.makeSong('missing'),null);
'''
    subprocess.run(['node', '-e', script], cwd=ROOT, check=True)


def test_piano_keys_and_toolbar_have_fixed_coordinates():
    js = (ROOT / 'web/multitrack_runtime.js').read_text(encoding='utf-8')
    css = (ROOT / 'web/multitrack.css').read_text(encoding='utf-8')
    html = (ROOT / 'web/index.html').read_text(encoding='utf-8')
    assert 'pitch<lowest+48;pitch++' in js
    assert 'event.clientX-rect.left<keyWidth' in js
    assert 'keyWidth+note.start_beats/TIMELINE_BEATS*width' in js
    assert '.roll-piano-key.black' in css and '.roll-piano-key.white' in css
    assert 'grid-template-columns:repeat(4,minmax(0,1fr))' in css
    assert html.index('id="selectedTrackSummary"') < html.index('class="sequence-toolbar"')
    assert 'songSelect.addEventListener("change",()=>{describe();addDemoSong();})' in js
