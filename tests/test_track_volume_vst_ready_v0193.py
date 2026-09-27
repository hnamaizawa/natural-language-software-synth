"""Per-track mixer persistence and first-play VST3 readiness."""
from pathlib import Path
import shutil
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is unavailable")
def test_project_volume_roundtrip_and_frozen_gain():
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('web/multitrack_runtime.js','utf8');
const section=src.slice(src.indexOf('  function sanitizeTrack('),src.indexOf('  async function exportProject('));
const gain=src.slice(src.indexOf('  function frozenGain('),src.indexOf('  function mixedFrozenVstBuffer('));
const scope={ROLE_DEFS:[],newTrack:()=>({id:'t',name:'t',role:'bass',color:'#123456',volume:.82,
  midi_channel:0,patch:{name:'Bass'},generated_patch:{name:'Bass'},source:{type:'internal'},clips:[]}),
  validatePatch:p=>p,clone:p=>JSON.parse(JSON.stringify(p)),bounded:(v,min,max,fallback)=>Math.min(max,Math.max(min,Number.isFinite(Number(v))?Number(v):fallback)),
  sanitizeClip:p=>p,MAX_CLIPS:64,uid:()=>"t",project:{bpm:120,length_beats:16}};
vm.createContext(scope);vm.runInContext(section+gain,scope);
const saved={id:'t',volume:.35,freeze_volume:.82};
const loaded=scope.sanitizeTrack(saved,0,16);
assert.equal(loaded.volume,.35);assert.equal(loaded.freeze_volume,.82);
assert(Math.abs(scope.frozenGain(loaded)-.35/.82)<.000001);
assert.equal(scope.sanitizeTrack({id:'t',volume:.5},0,16).freeze_volume,.5,'old JSON retains its original frozen level');
assert.equal(scope.sanitizeTrack({id:'t',volume:9,freeze_volume:-1},0,16).volume,1);
assert.equal(scope.sanitizeTrack({id:'t',volume:9,freeze_volume:-1},0,16).freeze_volume,0);
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is unavailable")
def test_first_play_waits_for_all_vst_instances_and_rejects_unready_bus():
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('web/vst3_runtime.js','utf8');
const section=src.slice(src.indexOf('  async function ensurePlaybackReady('),src.indexOf('  async function loadTrack(',src.indexOf('  async function ensurePlaybackReady(')));
const calls=[],instances=new Map(),tracks=[1,2].map(id=>({id:String(id),name:'VST '+id,source:{type:'vst3',plugin_id:'plugin'+id}}));
let catalog=[],ready=true;
const scope={window:{multitrackProject:{isFrozen:()=>false}},scannedPlugins:()=>catalog,
  scanForTracks:async items=>{calls.push('scan');catalog=items.map(t=>({id:t.source.plugin_id}));},
  prepareTracks:async items=>{for(const t of items){await Promise.resolve();calls.push('load'+t.id);instances.set(t.id,{instanceId:t.id});}return items.length;},
  trackInstances:instances,api:async path=>{calls.push('diagnose'+path.at(-1));return {ok:true,loaded:true,main_output_channels:2,main_event_input_bus:ready?0:-1};}};
vm.createContext(scope);vm.runInContext(section,scope);
(async()=>{await scope.ensurePlaybackReady(tracks);assert.deepEqual(calls,['scan','load1','load2','diagnose1','diagnose2']);
  ready=false;await assert.rejects(scope.ensurePlaybackReady(tracks),/MIDI入力/);
})().catch(error=>{console.error(error);process.exitCode=1});
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)


def test_track_volume_is_visible_and_playback_requires_ready_vst():
    runtime = (ROOT / "web/multitrack_runtime.js").read_text(encoding="utf-8")
    assert 'volume.type="range"' in runtime
    assert 'track.volume=bounded(value,0,1,.82)' in runtime
    assert 'freeze_volume:raw?.freeze_volume==null?' in runtime
    assert 'await window.vst3Router?.ensurePlaybackReady?.(tracks)' in runtime
    assert 'if(request!==playbackRunId)return;for(const track of tracks)' in runtime
