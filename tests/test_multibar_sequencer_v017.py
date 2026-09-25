"""Regression checks for multi-bar clip placement, transport and old project data."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_transport_and_editor_controls_are_present():
    html = (ROOT / 'web/index.html').read_text(encoding='utf-8')
    for control in ('songBars', 'playStartBar', 'loopStartBar', 'loopEndBar',
                    'clipStartBeat', 'clipLengthBeat', 'noteVelocity', 'timelineRuler'):
        assert f'id="{control}"' in html


def test_clip_queue_and_legacy_project_compatibility():
    if not shutil.which('node'):
        return
    script = r'''
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('web/multitrack_runtime.js','utf8');
const from=src.indexOf('  function buildPlaybackQueue('),to=src.indexOf('  function startInternalScheduler(',from);
const code=src.slice(from,to);
const ctx={project:{length_beats:64}};vm.createContext(ctx);vm.runInContext(code,ctx);
const track={clips:[{start_beats:40,length_beats:16,notes:[{start_beats:2,duration_beats:2},{start_beats:15,duration_beats:4}]},{start_beats:60,length_beats:4,notes:[{start_beats:3,duration_beats:5}]}]};
const queue=ctx.buildPlaybackQueue([track]);
if(queue.length!==3||queue[0].startBeat!==42||queue[1].endBeat!==56||queue[2].endBeat!==64)throw Error('song queue bounds');
const slice=ctx.sliceQueue(queue,40,48);
if(slice.length!==1||slice[0].startBeat!==2||slice[0].endBeat!==4)throw Error('loop slice bounds');
const legacy={tracks:[],bpm:100};
if((legacy.length_beats??16)!==16)throw Error('legacy song length');
'''
    subprocess.run(['node', '-e', script], cwd=ROOT, check=True)
