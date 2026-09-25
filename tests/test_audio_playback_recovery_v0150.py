import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is unavailable")
def test_vst_load_failure_does_not_block_other_tracks():
    router = (ROOT / "web/vst3_runtime.js").read_text(encoding="utf-8")
    source = router.split("  async function prepareTracks(tracks){", 1)[1].split("  async function loadTrack(track){", 1)[0]
    js = r'''
const assert=require("node:assert/strict");
const window={multitrackProject:{isFrozen:()=>false}};
const calls=[];
async function loadTrack(track){calls.push(track.id);if(track.id==="bad")throw new Error("host unavailable");}
async function prepareTracks(tracks){''' + source + r'''
(async()=>{
  const tracks=[{id:"bad",name:"Drums",source:{type:"vst3",plugin_id:"x"}},
                {id:"good",name:"Bass",source:{type:"vst3",plugin_id:"y"}},
                {id:"internal",source:{type:"internal"}}];
  assert.equal(await prepareTracks(tracks),1);
  assert.deepEqual(calls,["bad","good"]);
  assert.match(lastPrepareErrors[0],/Drums: host unavailable/);
})().catch(error=>{console.error(error);process.exitCode=1;});
'''
    subprocess.run([shutil.which("node"), "-e", js], check=True, cwd=ROOT)
    multitrack = (ROOT / "web/multitrack_runtime.js").read_text(encoding="utf-8")
    assert "if(track.source.type===\"vst3\"&&!window.vst3Router?.isTrackLoaded?.(track))" in multitrack
    assert "const errors=window.vst3Router?.prepareErrors?.()||[]" in multitrack
    assert 'const resumed=await api("/api/vst3/freeze/resume",{instance_id:trackId})' not in router
