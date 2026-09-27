"""Exercise arrangement timing when internal note creation occupies the UI thread."""
from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def test_internal_notes_recheck_audio_clock_and_frozen_stem_keeps_phase():
    if not shutil.which("node"):
        return
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('web/multitrack_runtime.js','utf8');
const start=src.indexOf('  function startInternalScheduler('),end=src.indexOf('  function showPlayhead(',start);
assert(start>=0&&end>start);
const ctx={currentTime:0,createBufferSource:()=>({connect(){},disconnect(){},start(...args){starts.push(args)}})};
const starts=[],notes=[],timers=[];
const scope={engine:{ctx,master:{},suppressPerformanceVisuals:false},project:{bpm:120},playbackRunId:0,
  frozenBuffers:new Map(),frozenSources:new Set(),mixedFrozenVstBuffer:()=>null,frozenGain:()=>1,
  updatePlaybackTiming(){},schedulerStats:{late:0,expired:0,maxLateMs:0},
  window:{vst3Router:{}},TIMELINE_BEATS:16,
  playNote(track,event,on,delay){notes.push({on,target:ctx.currentTime+delay,note:event.note});ctx.currentTime+=.012;},
  setTimeout(fn,delay){timers.push({fn,delay});return timers.length;},
};
vm.createContext(scope);vm.runInContext(src.slice(start,end),scope);
const track={id:'internal',source:{type:'internal'}};
const queue=Array.from({length:20},(_,i)=>({track,event:{note:i},startBeat:i*.05,endBeat:i*.05+.15,voiceId:'v'+i}));
ctx.currentTime=.7;
scope.startInternalScheduler(queue,()=>{},8,1,false,0,[track],false);
assert.equal(notes.length,16,'one pump processes at most eight notes');
const on=notes.filter(n=>n.on);
for(const n of on)assert(Math.abs(n.target-(1+n.note*.025))<.00001,`stale clock: note ${n.note} at ${n.target}`);
const next=timers.find(t=>t.delay===0);assert(next,'remaining due notes receive an immediate continuation');
next.fn();assert.equal(notes.filter(n=>n.on).length,16);
timers.find(t=>t.delay===0).fn();assert.equal(notes.filter(n=>n.on).length,20);

ctx.currentTime=1.5;scope.playbackRunId=0;timers.length=0;scope.frozenBuffers.set('frozen',{duration:5});
scope.startInternalScheduler([],()=>{},8,1,false,0,[{id:'frozen',source:{type:'vst3'}}],false);
assert.equal(starts.length,1);assert.equal(starts[0][0],1.5);assert.equal(starts[0][1],.5);
assert.equal(starts[0][2],3.5);
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)


def test_mixed_playback_exposes_late_and_expired_event_counts():
    html = (ROOT / "web/index.html").read_text(encoding="utf-8")
    runtime = (ROOT / "web/multitrack_runtime.js").read_text(encoding="utf-8")
    assert 'id="playbackTimingStatus"' in html
    assert "schedulerStats.expired++" in runtime
    assert "longTaskObserver.observe({type:\"longtask\"})" in runtime
    assert "cursor<liveQueue.length&&cycleStart+liveQueue[cursor].startBeat*secondsPerBeat<=horizon&&processed<batchSize" in runtime
