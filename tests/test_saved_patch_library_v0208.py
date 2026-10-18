from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "web" / "saved_patch_library_runtime.js"


def test_saved_patch_library_persists_validated_patch_and_reuses_existing_workflow():
    script = r'''
const fs=require('fs'),vm=require('vm'),assert=require('assert');
class Node{
  constructor(id=''){this.id=id;this.children=[];this.listeners={};this.value='';this.textContent='';this.className='';this.dataset={};this.disabled=false;this.attributes={};}
  append(...nodes){this.children.push(...nodes)} replaceChildren(...nodes){this.children=[...nodes]} addEventListener(type,fn){this.listeners[type]=fn} setAttribute(k,v){this.attributes[k]=v}
  click(){this.listeners.click?.({target:this})}
}
const ids=['savedPatchList','savedPatchName','savedPatchStatus','saveCurrentPatchBtn'];
const nodes=Object.fromEntries(ids.map(id=>[id,new Node(id)]));
const document={getElementById:id=>nodes[id]||null,createElement:tag=>new Node(tag)};
const store=new Map();const localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
const valid=[];const patch={name:'Dark Keys',engine_type:'synth',instrument_model:'generic',master_gain:.2,prompt:'dark'};
const engine={patch:{...patch},setPatch(raw){this.patch=validatePatch(raw)}};
const applied=[];const window={multitrackProject:{snapshot:{selected_track_id:'t1'},trackById:id=>({id,source:{type:'internal'}}),applyTrackPatch:(id,p)=>applied.push([id,p])}};
const context={window,document,localStorage,validatePatch(raw){valid.push(raw);return {...patch,...raw}},engine,currentPatch:patch,generatedPatch:patch,stopSample(){},console};
vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),context);
nodes.savedPatchName.value='暗いキー';nodes.saveCurrentPatchBtn.click();
assert.equal(window.savedPatchLibrary.list().length,1);assert.equal(valid.length,1);
nodes.savedPatchList.children[0].children[1].children[0].click();
assert.equal(engine.patch.name,'Dark Keys');assert.equal(context.generatedPatch.name,'Dark Keys');
nodes.savedPatchList.children[0].children[1].children[1].click();assert.equal(applied.length,1);assert.equal(applied[0][0],'t1');
assert.equal(JSON.parse(store.get('nlss.savedPatches.v1'))[0].name,'暗いキー');
assert.equal(context.window.savedPatchLibrary.apply('unknown'),false);
'''
    subprocess.run(["node", "-e", script, str(RUNTIME)], cwd=ROOT, check=True)


def test_saved_patch_library_is_bounded_local_and_does_not_add_audio_or_network_paths():
    runtime = RUNTIME.read_text(encoding="utf-8")
    for token in ["MAX_PATCHES=64", "MAX_PATCH_JSON=128*1024", "validatePatch(raw)", "localStorage.setItem", "applyTrackPatch", "window.savedPatchLibrary"]:
        assert token in runtime
    for forbidden in ["new AudioContext", "new (window.AudioContext", "MediaRecorder", "fetch(", "eval(", "new Function(", "engine.noteOn", "engine.noteOff"]:
        assert forbidden not in runtime


def test_workflow_exposes_patch_library_and_documents_local_scope():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert 'id="savedPatchLibrary"' in html
    assert 'id="saveCurrentPatchBtn"' in html
    assert '/saved_patch_library_runtime.js?v=0.20.9' in html
    assert "## v0.20.8 の主な変更" in readme
    assert "ブラウザのローカルストレージ" in readme
