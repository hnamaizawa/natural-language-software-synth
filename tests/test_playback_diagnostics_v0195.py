"""Playback reports use per-run deltas and inspect each live VST3 instance."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_diagnostic_is_visible_and_loaded_before_transport():
    html = (ROOT / "web/index.html").read_text(encoding="utf-8")
    runtime = (ROOT / "web/multitrack_runtime.js").read_text(encoding="utf-8")
    assert 'id="playbackSessionReport"' in html
    assert html.index('/playback_diagnostics.js') < html.index('/multitrack_runtime.js')
    assert 'finishPlaybackDiagnostics();for(const source of frozenSources)' in runtime
    assert 'const report=await preparePlaybackDiagnostics(tracks)' in runtime


def test_report_deltas_and_native_counter_reset():
    if not shutil.which("node"):
        return
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const window={};vm.runInNewContext(fs.readFileSync('web/playback_diagnostics.js','utf8'),{window});
const api=window.playbackDiagnostics;
const before={overruns:10,load:12.3,instances:[{id:'drum',names:['ドラム'],late:3,processFailures:1,eventFailures:0}]};
const after={overruns:12,load:18.4,instances:[{id:'drum',names:['ドラム'],late:5,processFailures:1,eventFailures:1}]};
const report=api.format(before,after,{late:4,maxLateMs:12.2,expired:1,longTasks:2});
for(const part of ['内蔵予約遅延 4件','期限切れ 1件','締切超過 2件','ドラム 遅延2件・処理失敗0件・イベント失敗1件'])assert(report.includes(part),part);
assert.equal(api.delta(10,3),null);
assert(api.format(before,{...after,overruns:2,instances:[{...after.instances[0],late:1}]},{late:0,maxLateMs:0,expired:0,longTasks:0}).includes('計測不可'));
assert(api.format(null,null,{late:0,maxLateMs:0,expired:0,longTasks:0}).includes('対象のライブ音源なし'));
'''
    subprocess.run(["node", "-e", script], cwd=ROOT, check=True)


def test_native_metrics_sample_distinct_live_instances_only():
    if not shutil.which("node"):
        return
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('web/vst3_runtime.js','utf8');
const section=code.slice(code.indexOf('  async function playbackMetrics('),code.indexOf('  async function trackSetParameter(',code.indexOf('  async function playbackMetrics(')));
const calls=[],scope={trackInstances:new Map([['a',{instanceId:'shared'}],['b',{instanceId:'shared'}],['c',{instanceId:'other'}]]),window:{multitrackProject:{isFrozen:id=>id==='c'}},
  api:async path=>{calls.push(path);return path.endsWith('status')?{ok:true,audio_overruns:7,cpu_load_percent:25}:{ok:true,late_note_events:4,process_failures:0,event_add_failures:1}}};
vm.createContext(scope);vm.runInContext(section,scope);
(async()=>{const sample=await scope.playbackMetrics([{id:'a',name:'A',source:{type:'vst3'}},{id:'b',name:'B',source:{type:'vst3'}},{id:'c',name:'C',source:{type:'vst3'}},{id:'d',source:{type:'internal'}}]);
  assert.equal(calls.length,2);assert.equal(sample.instances.length,1);assert.equal(sample.instances[0].names.join(','),'A,B');
})().catch(error=>{console.error(error);process.exitCode=1});
'''
    subprocess.run(["node", "-e", script], cwd=ROOT, check=True)
