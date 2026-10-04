"""Corrected humming can become bounded, editable track notes without microphone PCM."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_humming_clip_conversion_preserves_rhythm_and_crosses_bar_boundaries():
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web/humming_clip_bridge.js','utf8'),ctx);
const make=ctx.window.hummingClipBridge.makeClips;
const steps=[{notes:[60],beats:1,velocity:.8},{notes:[],beats:.5},{notes:[62],beats:1,velocity:.6}];
const clips=make(steps,100,120,4,32);
assert.equal(clips.length,1);assert.equal(clips[0].start_beats,4);
assert.equal(clips[0].notes[0].start_beats,0);
assert.equal(clips[0].notes[1].start_beats,1.78125); // 1.2 + quantized 0.6
assert.equal(clips[0].notes[0].duration_beats,1.1875); // nearest 1/32
const long=make(Array.from({length:20},()=>({notes:[48],beats:1,velocity:.7})),100,100,0,32);
assert.equal(long.length,2);assert.equal(long[0].notes.length,16);assert.equal(long[1].notes.length,4);
assert.equal(long[1].start_beats,16);assert.equal(long[1].notes[0].start_beats,0);
assert.throws(()=>make(steps,100,120,30,32),/曲長/);
assert.throws(()=>make([{notes:[999],beats:1}],100,100,0,16),/音高/);
assert.throws(()=>make([{notes:[],beats:1}],100,100,0,16),/ノート/);
'''
    subprocess.run(["node", "-e", script], cwd=ROOT, check=True)


def test_humming_is_added_to_selected_track_and_project_json_as_notes_only():
    js = (ROOT / "web/multitrack_runtime.js").read_text(encoding="utf-8")
    humming = (ROOT / "web/humming_runtime.js").read_text(encoding="utf-8")
    html = (ROOT / "web/index.html").read_text(encoding="utf-8")
    assert 'window.hummingClipBridge.makeClips(capture.getSteps()' in js
    assert 'track.clips.push(...added)' in js
    assert 'if(frozenBuffers.has(track.id)||freezingIds.has(track.id))' in js
    assert 'window.multitrackProject?.addHummingClip?.()' in humming
    assert 'id="hummingTrackBtn" disabled' in html
    assert html.index('/humming_clip_bridge.js') < html.index('/multitrack_runtime.js')
    assert "rawEvents" not in (ROOT / "web/humming_clip_bridge.js").read_text(encoding="utf-8")
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('web/multitrack_runtime.js','utf8');
const fn=src.slice(src.indexOf('  function addHummingClip('),src.indexOf('  function addDemoSong('));
const track={id:'bass',name:'ベース',clips:[]},steps=[{notes:[48],beats:1,velocity:.8}];
const bridge={window:{}};vm.createContext(bridge);vm.runInContext(fs.readFileSync('web/humming_clip_bridge.js','utf8'),bridge);
let draws=0;
const ctx={selectedTrack:()=>track,window:{hummingMelodyCapture:{getSteps:()=>steps},hummingClipBridge:bridge.window.hummingClipBridge},
  document:{getElementById:()=>({value:'100'})},project:{bpm:100,playhead_beats:0,length_beats:16},
  frozenBuffers:new Map(),freezingIds:new Set(),arrangementPlaying:false,MAX_CLIPS:64,uid:()=>`clip-${track.clips.length+1}`,
  rollUndo:[],rollRedo:[],selectedClipId:null,selectedNoteIndex:-1,render:()=>draws++,status:()=>{}};
vm.createContext(ctx);vm.runInContext(fn,ctx);ctx.addHummingClip();
assert.equal(track.clips.length,1);assert.equal(track.clips[0].notes[0].note,48);
assert.equal(draws,1);assert.equal(ctx.selectedClipId,track.clips[0].id);
assert(!JSON.stringify(track).includes('samples'));
ctx.frozenBuffers.set('bass',{});assert.throws(()=>ctx.addHummingClip(),/フリーズ/);
assert.equal(track.clips.length,1);
'''
    subprocess.run(["node", "-e", script], cwd=ROOT, check=True)
