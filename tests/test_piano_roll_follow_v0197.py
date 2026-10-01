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
const ctx={document,project:{length_beats:32},TIMELINE_BEATS:16,selectedClipId:'A',displayBeat:0,followArrangementClips:true,lastRollHighlightTick:null,lastRollPositionText:'',
  selectedTrack:()=>({clips}),selectedClip:()=>clips.find(c=>c.id===ctx.selectedClipId),renderPianoRoll:()=>{},Math};
vm.createContext(ctx);vm.runInContext(functions,ctx);
ctx.showPlayhead(2,true);assert.equal(marker.style.left,'176px');assert.equal(marker.style.display,'block');assert(marker.classList.contains('playing'));assert(notes[0].classList.contains('sounding'));assert(label.textContent.includes('再生中'));
ctx.showPlayhead(3,true);assert.equal(marker.style.left,'232px');assert(!notes[0].classList.contains('sounding'));
ctx.showPlayhead(18,true);assert.equal(ctx.selectedClipId,'B');assert.equal(marker.style.left,'176px');assert(blocks[1].classList.contains('selected'));
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
    assert 'if(!selectedClip())selectedClipId=selectedTrack()?.clips[0]?.id||null' in js
    assert '.arrangement-playhead{position:absolute;top:0;bottom:0;width:2px' in css
    assert '.roll-playhead{z-index:4}' in css


def test_low_drum_notes_are_scrolled_into_visible_roll_viewport():
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('web/multitrack_runtime.js','utf8');
const render=src.slice(src.indexOf('  function renderPianoRoll('),src.indexOf('  function deleteRollNote('));
const el=()=>({children:[],style:{},dataset:{},classList:{toggle(){}},clientHeight:320,scrollTop:0,
  append(child){this.children.push(child)},replaceChildren(){this.children=[]},addEventListener(){},setAttribute(){}});
const root=el(),range={value:'36'},inputs={projectPianoRoll:root,rollRange:range};
const document={getElementById:id=>inputs[id]||null,createElement:()=>el()};
const clip={id:'drum-clip',start_beats:0,length_beats:16,notes:[36,38,42].map((note,i)=>({note,start_beats:i,duration_beats:.5,velocity:.8}))};
const ctx={document,selectedClip:()=>clip,selectedNoteIndex:-1,lastRollClipId:null,lastRollHighlightTick:null,displayBeat:0,arrangementPlaying:false,
  bounded:(n,low,high)=>Math.min(high,Math.max(low,Number(n))),TIMELINE_BEATS:16,showRollPlayhead() {},Math};
vm.createContext(ctx);vm.runInContext(render,ctx);ctx.renderPianoRoll();assert.equal(range.value,'24');assert(root.scrollTop>0);
const blocks=root.children[0].children.filter(node=>node.className?.includes('roll-note'));
assert.equal(blocks.length,3);const middleTop=Number(blocks[1].style.top.replace('px',''));
assert(middleTop>=root.scrollTop&&middleTop<root.scrollTop+root.clientHeight);
'''
    subprocess.run(['node', '-e', script], cwd=ROOT, check=True)
