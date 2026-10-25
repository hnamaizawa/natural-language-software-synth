"""The piano roll follows the audio-clock playhead and active clip."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_roll_playhead_uses_clip_relative_position_and_hides_outside_clip():
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('web/multitrack_runtime.js','utf8');
const functions=src.slice(src.indexOf('  function showRollPlayhead('),src.indexOf('  function followPlayhead('));
const classes=()=>({items:new Set(),toggle(name,on){if(on)this.items.add(name);else this.items.delete(name)},contains(name){return this.items.has(name)}});
const clips=[{id:'A',start_beats:0,length_beats:16},{id:'B',start_beats:16,length_beats:16}];
const root={scrollLeft:0,clientWidth:400},notes=[{dataset:{startBeats:'2',endBeats:'2.8'},classList:classes()}],marker={style:{},classList:classes(),parentElement:{querySelectorAll:()=>notes}},blocks=clips.map(c=>({dataset:{clipId:c.id},classList:classes()}));
const position={textContent:''},lane={offsetLeft:0,clientWidth:320},timeline={style:{},classList:classes()};
const ruler={children:Array.from({length:8},()=>({classList:classes()}))};
const label={textContent:''},nodes={projectPianoRoll:root,rollPlayhead:marker,rollPlaybackPosition:label,playPosition:position,arrangementPlayhead:timeline,timelineRuler:ruler};
const document={getElementById:id=>nodes[id],querySelector:q=>q==='#arrangementTimeline .timeline-lane'?lane:null,querySelectorAll:()=>blocks};
let rollRenders=0;
const ctx={document,project:{length_beats:32},TIMELINE_BEATS:16,ROLL_KEY_WIDTH:64,ROLL_BEAT_WIDTH:56,selectedClipId:'A',displayBeat:0,arrangementPlaying:true,followArrangementClips:true,lastRollArrangementMode:true,lastRollHighlightTick:null,lastRollPositionText:'',
  selectedTrack:()=>({clips}),selectedClip:()=>clips.find(c=>c.id===ctx.selectedClipId),renderPianoRoll:()=>{rollRenders++;},Math};
vm.createContext(ctx);vm.runInContext(functions,ctx);
ctx.showPlayhead(2,true);assert.equal(marker.style.left,'176px');assert.equal(marker.style.display,'block');assert(marker.classList.contains('playing'));assert(notes[0].classList.contains('sounding'));assert(label.textContent.includes('再生中'));
ctx.showPlayhead(3,true);assert.equal(marker.style.left,'232px');assert.equal(root.scrollLeft,12);assert(!notes[0].classList.contains('sounding'));
ctx.showPlayhead(10,true);assert.equal(marker.style.left,'624px');assert.equal(root.scrollLeft,404,'the viewport follows the playhead through a long clip');
ctx.showPlayhead(18,true);assert.equal(ctx.selectedClipId,'B');assert.equal(marker.style.left,'1072px');assert(blocks[1].classList.contains('selected'));
assert.equal(root.scrollLeft,852,'the viewport continues through the next four-bar clip without jumping to its local origin');
assert.equal(rollRenders,0,'clip boundaries update selection without rebuilding the full-song roll');
ctx.showPlayhead(32,true);assert.equal(marker.style.display,'none');assert(!marker.classList.contains('playing'));
ctx.followArrangementClips=false;ctx.selectedClipId='A';ctx.showPlayhead(18,true);
assert.equal(ctx.selectedClipId,'A');assert(!marker.classList.contains('playing'));
ctx.showPlayhead(2,false);assert(!marker.classList.contains('playing'));
assert.equal(label.textContent,'■ 停止中');
'''
    subprocess.run(['node', '-e', script], cwd=ROOT, check=True)


def test_roll_marker_is_display_only_and_uses_existing_animation_frame():
    js = (ROOT / 'web/multitrack_runtime.js').read_text(encoding='utf-8')
    css = (ROOT / 'web/multitrack.css').read_text(encoding='utf-8')
    assert 'showPlayhead(beat,true);if(beat<endBeat)playheadFrame=requestAnimationFrame(update)' in js
    assert 'showRollPlayhead(beat,playing);' in js
    assert 'followArrangementClips=false;showPlayhead(project.playhead_beats,false)' in js
    assert 'marker.className="arrangement-playhead roll-playhead"' in js
    assert 'marker.style.display=visible?"block":"none"' in js
    assert 'const followPosition=x-root.clientWidth*.55' in js
    assert 'const targetScrollLeft=Math.max(0,Math.round(followPosition))' in js
    assert 'if(Math.abs(root.scrollLeft-targetScrollLeft)>1)root.scrollLeft=targetScrollLeft' in js
    assert 'const gridBeats=arrangementRoll?project.length_beats:TIMELINE_BEATS' in js
    assert 'const displayClips=arrangementRoll?(selectedTrack()?.clips||[]):[clip]' in js
    assert 'const noteStart=arrangementRoll?noteClip.start_beats+note.start_beats:note.start_beats' in js
    assert 'if(!playing&&lastRollArrangementMode)renderPianoRoll()' in js
    assert 'if(!selectedClip())selectedClipId=selectedTrack()?.clips[0]?.id||null' in js
    assert '.arrangement-playhead{position:absolute;top:0;bottom:0;width:2px' in css
    assert '.roll-playhead{z-index:4}' in css


def test_song_wide_roll_scrolls_inside_a_fixed_width_workspace():
    css = (ROOT / "web/multitrack.css").read_text(encoding="utf-8")
    assert ".arrangement-body{display:grid;grid-template-columns:minmax(250px,320px) minmax(0,1fr);gap:14px}" in css
    assert ".sequence-workspace{min-width:0}" in css
    assert ".project-piano-roll{width:100%;min-width:0;box-sizing:border-box;" in css
    assert ".project-piano-roll{overflow:auto;overscroll-behavior:contain}" in css


def test_arrangement_playback_keeps_one_song_wide_roll_through_clip_changes():
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('web/multitrack_runtime.js','utf8');
const render=src.slice(src.indexOf('  function renderPianoRoll('),src.indexOf('  function deleteRollNote('));
const el=()=>({children:[],style:{},dataset:{},className:'',classList:{toggle(){}},clientHeight:320,clientWidth:400,scrollLeft:0,scrollTop:0,
  append(...children){this.children.push(...children)},replaceChildren(){this.children=[]},addEventListener(){},setAttribute(){}});
const root=el(),range={value:'36'},inputs={projectPianoRoll:root,rollRange:range};
const clips=[{id:'A',start_beats:0,length_beats:16,notes:[{note:60,start_beats:0,duration_beats:1,velocity:.8}]},
  {id:'B',start_beats:16,length_beats:16,notes:[{note:62,start_beats:0,duration_beats:1,velocity:.8}]}];
let active=clips[0];
const document={getElementById:id=>inputs[id]||null,createElement:()=>el()};
const ctx={document,project:{length_beats:32},selectedTrack:()=>({clips}),selectedClip:()=>active,selectedNoteIndex:-1,lastRollClipId:'A',lastRollHighlightTick:null,lastRollPositionText:'',lastRollArrangementMode:false,displayBeat:18,arrangementPlaying:true,followArrangementClips:true,
  bounded:(n,low,high)=>Math.min(high,Math.max(low,Number(n))),TIMELINE_BEATS:16,ROLL_KEY_WIDTH:64,ROLL_BEAT_WIDTH:56,ROLL_ROW_HEIGHT:12,ROLL_SUBDIVISIONS_PER_BEAT:4,showRollPlayhead() {},Math};
vm.createContext(ctx);vm.runInContext(render,ctx);ctx.renderPianoRoll();
assert.equal(root.children[1].style.width,'1856px','the grid spans the whole 8-bar song');
assert.equal(root.children[0].children.length,9,'the ruler keeps all eight measure labels visible in the continuous timeline');
let notes=root.children[1].children.filter(node=>node.className==='roll-note');
assert.equal(notes[0].style.left,'64px');assert.equal(notes[1].style.left,'960px','the next clip note uses its absolute song position');
assert.equal(ctx.lastRollArrangementMode,true);
root.scrollLeft=852;active=clips[1];ctx.displayBeat=18;ctx.renderPianoRoll();
assert.equal(root.scrollLeft,852,'redrawing the active clip keeps the existing horizontal viewport');
assert.equal(root.children[1].style.width,'1856px');
'''
    subprocess.run(['node', '-e', script], cwd=ROOT, check=True)


def test_low_drum_notes_are_scrolled_into_visible_roll_viewport():
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('web/multitrack_runtime.js','utf8');
const render=src.slice(src.indexOf('  function renderPianoRoll('),src.indexOf('  function deleteRollNote('));
const el=()=>({children:[],style:{},dataset:{},classList:{toggle(){}},clientHeight:320,scrollTop:0,
  append(...children){this.children.push(...children)},replaceChildren(){this.children=[]},addEventListener(){},setAttribute(){}});
const root=el(),range={value:'36'},inputs={projectPianoRoll:root,rollRange:range};
const document={getElementById:id=>inputs[id]||null,createElement:()=>el()};
const clip={id:'drum-clip',start_beats:0,length_beats:16,notes:[36,38,42].map((note,i)=>({note,start_beats:i,duration_beats:.5,velocity:.8}))};
const ctx={document,selectedClip:()=>clip,selectedNoteIndex:-1,lastRollClipId:null,lastRollHighlightTick:null,lastRollPositionText:'',lastRollArrangementMode:false,followArrangementClips:false,displayBeat:0,arrangementPlaying:false,
  bounded:(n,low,high)=>Math.min(high,Math.max(low,Number(n))),TIMELINE_BEATS:16,ROLL_KEY_WIDTH:64,ROLL_BEAT_WIDTH:56,ROLL_ROW_HEIGHT:12,ROLL_SUBDIVISIONS_PER_BEAT:4,showRollPlayhead() {},Math};
vm.createContext(ctx);vm.runInContext(render,ctx);ctx.renderPianoRoll();assert.equal(range.value,'24');assert(root.scrollTop>0);
const blocks=root.children[1].children.filter(node=>node.className?.includes('roll-note'));
assert.equal(blocks.length,3);const middleTop=Number(blocks[1].style.top.replace('px',''));
assert(middleTop>=root.scrollTop&&middleTop<root.scrollTop+root.clientHeight);
'''
    subprocess.run(['node', '-e', script], cwd=ROOT, check=True)
