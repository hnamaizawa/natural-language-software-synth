"""Track gain must control audio output; piano-roll geometry has one beat scale."""
from pathlib import Path
import subprocess

from server import Vst3Bridge


ROOT = Path(__file__).resolve().parents[1]


def test_native_gain_bridge_is_bounded_and_instance_scoped(monkeypatch):
    bridge = Vst3Bridge()
    commands = []
    monkeypatch.setattr(bridge, "_command", lambda command: commands.append(command) or {"ok": True})

    assert bridge.set_gain(.375, "track-1") == {"ok": True}
    assert commands == ["GAIN\ttrack-1\t0.3750"]
    assert not bridge.set_gain(1.1, "track-1")["ok"]
    assert not bridge.set_gain(float("nan"), "track-1")["ok"]
    assert len(commands) == 1


def test_native_gain_is_applied_to_output_and_exposed_through_loopback_api():
    cpp = (ROOT / "native/vst3_host/src/main.cpp").read_text(encoding="utf-8")
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    router = (ROOT / "web/vst3_runtime.js").read_text(encoding="utf-8")
    assert 'parts[0] == "GAIN"' in cpp
    assert "std::atomic<float> gain_ {1.0f}" in cpp
    assert "left *= currentGain_;" in cpp and "right *= currentGain_;" in cpp
    assert 'parsed.path == "/api/vst3/gain"' in server
    assert 'api("/api/vst3/gain",{instance_id:target.instanceId,gain:clamp(track.volume??.82,0,1)})' in router


def test_internal_track_volume_updates_the_live_audio_gain_bus():
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('web/multitrack_runtime.js','utf8');
const section=src.slice(src.indexOf('  function setTrackVolume('),src.indexOf('  function setTrackPan('));
const calls=[],gain={gain:{setTargetAtTime:(...args)=>calls.push(['gain',...args])},connect:node=>calls.push(['gain-connect',node])};
const panner={pan:{setTargetAtTime:(...args)=>calls.push(['pan',...args])},connect:node=>calls.push(['pan-connect',node])};
const track={id:'internal-1',name:'Bass',volume:.82,pan:0,source:{type:'internal'}};
const scope={engine:{ctx:{currentTime:5,createGain:()=>gain,createStereoPanner:()=>panner},master:'master'},
  trackPanBuses:new Map(),freezingIds:new Set(),arrangementPlaying:false,frozenBuffers:new Map(),frozenMixCache:null,
  volumeUpdateTimers:new Map(),recordingDryTrackId:null,window:{vst3Router:{}},
  bounded:(v,min,max,fallback)=>Math.min(max,Math.max(min,Number.isFinite(Number(v))?Number(v):fallback)),status:()=>{},
  setTimeout,clearTimeout};
vm.createContext(scope);vm.runInContext(section,scope);
scope.panBus(track);scope.setTrackVolume(track,.23);
assert.equal(track.volume,.23);
assert(calls.some(call=>call[0]==='gain'&&call[1]===.23),'the active bus gain follows the mixer slider');
assert(calls.some(call=>call[0]==='gain-connect'&&call[1]===panner));
assert(calls.some(call=>call[0]==='pan-connect'&&call[1]==='master'));
'''
    subprocess.run(["node", "-e", script], cwd=ROOT, check=True)


def test_vst3_track_volume_is_not_encoded_as_note_velocity():
    runtime = (ROOT / "web/multitrack_runtime.js").read_text(encoding="utf-8")
    router = (ROOT / "web/vst3_runtime.js").read_text(encoding="utf-8")
    assert "trackNoteOn(track.id,event.note,event.velocity,channel,whenSeconds)" in runtime
    assert "velocity:item.event.velocity,channel,note_id" in runtime
    assert "velocity:item.event.velocity,channel,note_id,delay_ms:0,at_frame" in router
    assert "track.source.shared_with)return" in runtime


def test_roll_ruler_and_note_coordinates_share_a_fixed_measure_scale():
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('web/multitrack_runtime.js','utf8');
const render=src.slice(src.indexOf('  function renderPianoRoll('),src.indexOf('  function deleteRollNote('));
const el=()=>({children:[],style:{},dataset:{},classList:{toggle(){}},clientHeight:320,scrollTop:0,
  append(...children){this.children.push(...children)},replaceChildren(){this.children=[]},addEventListener(){},setAttribute(){}});
const root=el(),range={value:'36'},inputs={projectPianoRoll:root,rollRange:range};
const document={getElementById:id=>inputs[id]||null,createElement:()=>el()};
const clip={id:'roll',start_beats:0,length_beats:16,notes:[0,4,8,12].map((start_beats,i)=>({note:60+i,start_beats,duration_beats:1,velocity:.8}))};
const scope={document,selectedClip:()=>clip,selectedNoteIndex:-1,lastRollClipId:null,lastRollHighlightTick:null,displayBeat:0,arrangementPlaying:false,
  bounded:(n,low,high,fallback)=>Math.min(high,Math.max(low,Number.isFinite(Number(n))?Number(n):fallback)),TIMELINE_BEATS:16,
  ROLL_KEY_WIDTH:64,ROLL_BEAT_WIDTH:56,ROLL_ROW_HEIGHT:12,ROLL_SUBDIVISIONS_PER_BEAT:4,showRollPlayhead(){},Math};
vm.createContext(scope);vm.runInContext(render,scope);scope.renderPianoRoll();
const [ruler,grid]=root.children;
assert.equal(ruler.children.slice(1).map(cell=>cell.textContent).join(','),'1小節,2小節,3小節,4小節');
assert(ruler.children.slice(1).every(cell=>cell.style.flexBasis==='224px'));
assert.equal(grid.style.width,'960px');
const bars=grid.children.filter(node=>node.className==='roll-time-line bar').map(node=>node.style.left);
assert.deepEqual(bars,['64px','288px','512px','736px','960px']);
const notes=grid.children.filter(node=>node.className.includes('roll-note'));
assert.deepEqual(notes.map(node=>node.style.left),['64px','288px','512px','736px']);
assert.deepEqual(notes.map(node=>node.style.width),['55px','55px','55px','55px']);
'''
    subprocess.run(["node", "-e", script], cwd=ROOT, check=True)


def test_piano_roll_styles_show_measure_and_beat_boundaries():
    css = (ROOT / "web/multitrack.css").read_text(encoding="utf-8")
    assert ".roll-ruler-bar{" in css
    assert ".roll-time-line.beat{" in css
    assert ".roll-time-line.bar{" in css
