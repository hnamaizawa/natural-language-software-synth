"""Check timing compensation and the revised factory demo harmony."""
from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def test_native_absolute_notes_compensate_reported_latency_and_count_late_arrivals():
    native = (ROOT / "native/vst3_host/src/main.cpp").read_text(encoding="utf-8")
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    router = (ROOT / "web/vst3_runtime.js").read_text(encoding="utf-8")
    assert "processor_->getLatencySamples ()" in native
    assert "if (absoluteFrame) absoluteFrame = std::max<uint64_t> (1, absoluteFrame > latencySamples_ ? absoluteFrame - latencySamples_ : 1);" in native
    assert "if (note.on && note.absoluteFrame < startFrame)" in native
    assert '"late_note_events' in native and '"reported_latency_samples' in native
    assert 'VST3.diagnostics(parse_qs(parsed.query).get("instance_id", [None])[0])' in server
    assert "encodeURIComponent(target.instanceId)" in router


def test_demo_melodies_use_varied_chord_tone_motifs_without_avoid_notes():
    if not shutil.which("node"):
        return
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const window={};vm.runInNewContext(fs.readFileSync('web/sequencer_samples.js','utf8'),{window});
for(const id of Object.keys(window.sequencerSamples.songs)){
  const spec=window.sequencerSamples.songs[id],song=window.sequencerSamples.makeSong(id);
  const notes=song.clips.melody.flatMap(clip=>clip.notes.map(n=>({...n,start:clip.start_beats+n.start_beats})));
  const motifs=[];
  for(let bar=0;bar<8;bar++){
    const root=spec.roots[bar],quality=spec.qualities[bar];
    const measure=notes.filter(n=>n.start>=bar*4&&n.start<(bar+1)*4);
    const offsets=measure.filter(n=>Number.isInteger(n.start)).map(n=>((n.note-root)%12+12)%12);
    assert.equal(offsets.length,4);
    assert(offsets.every(x=>[0,quality==='min'?3:4,7].includes(x)),`${id} bar ${bar} avoid note`);
    motifs.push(offsets.join(','));
  }
  assert(new Set(motifs).size>=3,`${id} melody repeats a single arpeggio`);
}
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)
