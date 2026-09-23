"use strict";

// v0.13 project/track foundation. This stores bounded note-event data and validated
// patches only. It deliberately reuses the existing AudioContext and noteOn/noteOff.
(() => {
  const SCHEMA_VERSION=1,MAX_TRACKS=24,MAX_CLIPS=64,MAX_NOTES=512,TIMELINE_BEATS=16;
  const ROLE_DEFS=[
    ["drums","ドラム","#ff8b6b",{name:"ドラム",engine_type:"drum",instrument_model:"studio_drums"}],
    ["bass","ベース","#f8c85b",{name:"ベース",engine_type:"sampler",instrument_model:"fretless_bass"}],
    ["keyboard","キーボード","#65d5f5",{name:"キーボード",engine_type:"fm",instrument_model:"dx_ep"}],
    ["guitar","ギター","#b68cff",{name:"ギター",engine_type:"sampler",instrument_model:"electric_guitar"}],
    ["melody","メロディー","#68e0a0",{name:"メロディー",engine_type:"synth",instrument_model:"generic"}],
    ["chorus","コーラス","#ff91ca",{name:"コーラス",engine_type:"synth",instrument_model:"generic",attack_s:.18,release_s:1.8}],
    ["pad","パッド","#88a7ff",{name:"パッド",engine_type:"synth",instrument_model:"generic",attack_s:1.2,release_s:2.8}]
  ];
  let serial=0,applyingTrack=false,selectedClipId=null,previewTimers=[],previewNotes=new Set();
  const uid=(prefix)=>`${prefix}-${Date.now().toString(36)}-${(++serial).toString(36)}`;
  const clone=(value)=>JSON.parse(JSON.stringify(value));
  const bounded=(value,min,max,fallback)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):fallback));
  const patchFor=(overrides)=>validatePatch({...DEFAULT_PATCH,...overrides});
  function newTrack(def,index){
    const [role,name,color,overrides]=def||["custom",`トラック ${index+1}`,"#65d5f5",{}];
    return {id:uid("track"),name,role,color,mute:false,solo:false,volume:.82,pan:0,midi_channel:index%16,source:{type:"internal",plugin_id:"",name:"内蔵音源"},patch:patchFor(overrides),generated_patch:patchFor(overrides),clips:[]};
  }
  let project={schema_version:SCHEMA_VERSION,name:"新しい曲",bpm:100,time_signature:[4,4],selected_track_id:"",tracks:ROLE_DEFS.map(newTrack)};
  project.selected_track_id=project.tracks[0].id;
  const byId=(id)=>project.tracks.find(track=>track.id===id);
  const selectedTrack=()=>byId(project.selected_track_id)||project.tracks[0];
  const selectedClip=()=>{const track=selectedTrack();return track&&track.clips.find(clip=>clip.id===selectedClipId);};
  const status=(message)=>{const node=document.getElementById("projectStatus");if(node)node.textContent=message;};

  const originalSetPatch=engine.setPatch.bind(engine);
  const originalSetPatchWithRender=engine.setPatchWithRender&&engine.setPatchWithRender.bind(engine);
  function captureSelectedPatch(){
    if(applyingTrack)return;
    const track=selectedTrack();if(!track)return;
    track.patch=clone(validatePatch(engine.patch||currentPatch));
    track.generated_patch=clone(validatePatch(generatedPatch||track.patch));
    renderTrackList();renderSummary();
  }
  engine.setPatch=function(raw){const result=originalSetPatch(raw);captureSelectedPatch();return result;};
  if(originalSetPatchWithRender)engine.setPatchWithRender=function(raw,render=true){const result=originalSetPatchWithRender(raw,render);captureSelectedPatch();return result;};

  function applyTrack(track){
    if(!track)return;
    applyingTrack=true;
    generatedPatch=clone(validatePatch(track.generated_patch||track.patch));
    if(originalSetPatchWithRender)originalSetPatchWithRender(track.patch,true);else originalSetPatch(track.patch);
    currentPatch=engine.patch;
    applyingTrack=false;
  }
  function selectTrack(id){
    const current=selectedTrack();if(current&&!applyingTrack){current.patch=clone(validatePatch(engine.patch||currentPatch));current.generated_patch=clone(validatePatch(generatedPatch||current.patch));}
    const next=byId(id);if(!next)return;
    project.selected_track_id=next.id;selectedClipId=next.clips[0]?.id||null;applyTrack(next);render();status(`${next.name}を選択しました。これ以降の音色変更と演奏はこのトラックに紐付きます。`);
  }
  function toggleTrack(id,key){const track=byId(id);if(!track)return;track[key]=!track[key];renderTrackList();status(`${track.name}の${key==="mute"?"ミュート":"ソロ"}を${track[key]?"ON":"OFF"}にしました。`);}
  function addTrack(){
    if(project.tracks.length>=MAX_TRACKS){status(`トラックは最大${MAX_TRACKS}個です。`);return;}
    const track=newTrack(["custom",`トラック ${project.tracks.length+1}`,"#65d5f5",{name:`Track ${project.tracks.length+1}`}],project.tracks.length);project.tracks.push(track);selectTrack(track.id);
  }
  function renderTrackList(){
    const root=document.getElementById("trackList");if(!root)return;root.replaceChildren();
    for(const track of project.tracks){
      const row=document.createElement("div");row.className=`track-row${track.id===project.selected_track_id?" selected":""}`;row.dataset.trackId=track.id;row.setAttribute("role","option");row.setAttribute("aria-selected",String(track.id===project.selected_track_id));
      const color=document.createElement("span");color.className="track-color";color.style.background=track.color;
      const copyNode=document.createElement("span");copyNode.className="track-copy";const title=document.createElement("strong");title.textContent=track.name;const detail=document.createElement("small");detail.textContent=`${track.patch.name} · ${track.source.name}`;copyNode.append(title,detail);
      const controls=document.createElement("span");controls.className="track-controls";
      for(const [key,label] of [["mute","M"],["solo","S"]]){const button=document.createElement("button");button.type="button";button.textContent=label;button.title=key==="mute"?"このトラックをミュート":"このトラックだけをソロ再生";button.classList.toggle("active",track[key]);button.addEventListener("click",event=>{event.stopPropagation();toggleTrack(track.id,key);});controls.append(button);}
      row.append(color,copyNode,controls);row.addEventListener("click",()=>selectTrack(track.id));root.append(row);
    }
  }
  function renderSummary(){const track=selectedTrack(),node=document.getElementById("selectedTrackSummary");if(node&&track)node.textContent=`選択中: ${track.name} · ${track.patch.name}`;}
  function renderTimeline(){
    const root=document.getElementById("arrangementTimeline");if(!root)return;root.replaceChildren();
    for(const track of project.tracks){const row=document.createElement("div");row.className="timeline-row";const label=document.createElement("span");label.className="timeline-label";label.textContent=track.name;const lane=document.createElement("div");lane.className="timeline-lane";
      for(const clip of track.clips){const block=document.createElement("button");block.type="button";block.className=`clip-block${clip.id===selectedClipId?" selected":""}`;block.textContent=clip.name;block.style.background=track.color;block.style.left=`${Math.min(100,clip.start_beats/TIMELINE_BEATS*100)}%`;block.style.width=`${Math.min(100-clip.start_beats/TIMELINE_BEATS*100,Math.max(3,clip.length_beats/TIMELINE_BEATS*100))}%`;block.addEventListener("click",()=>{if(project.selected_track_id!==track.id)selectTrack(track.id);selectedClipId=clip.id;renderTimeline();renderPianoRoll();});lane.append(block);}row.append(label,lane);root.append(row);}
  }
  function renderPianoRoll(){
    const root=document.getElementById("projectPianoRoll"),clip=selectedClip();if(!root)return;root.replaceChildren();root.classList.toggle("empty",!clip);if(!clip)return;
    for(const note of clip.notes){const block=document.createElement("span");block.className="roll-note";block.style.left=`${note.start_beats/TIMELINE_BEATS*100}%`;block.style.width=`${Math.max(.8,note.duration_beats/TIMELINE_BEATS*100)}%`;block.style.bottom=`${Math.max(1,Math.min(94,(note.note-24)/72*100))}%`;block.title=`MIDI ${note.note} · ${note.duration_beats}拍`;root.append(block);}
  }
  function render(){renderTrackList();renderSummary();renderTimeline();renderPianoRoll();const name=document.getElementById("projectName"),bpm=document.getElementById("projectBpm");if(name)name.value=project.name;if(bpm)bpm.value=project.bpm;}

  function performanceToClip(perf,key){let cursor=0,notes=[];for(const step of perf.steps||[]){const events=step.events||((step.notes||[]).map(note=>({note,velocity:.82})));for(const event of events){if(notes.length>=MAX_NOTES)break;notes.push({note:Math.round(bounded(event.note,0,127,60)),start_beats:cursor,duration_beats:bounded(step.beats*.78,.03125,8,.25),velocity:bounded(event.velocity,.01,1,.82)});}cursor+=bounded(step.beats,.03125,8,.25);}return {id:uid("clip"),name:perf.label||key,start_beats:0,length_beats:Math.min(TIMELINE_BEATS,Math.max(.25,cursor)),notes};}
  function addClipFromSample(){
    const track=selectedTrack();if(!track||track.clips.length>=MAX_CLIPS){status(`1トラックのクリップは最大${MAX_CLIPS}個です。`);return;}
    const select=document.getElementById("sampleSelect"),key=select&&select.value,perf=(typeof SAMPLE_PERFORMANCES!=="undefined"&&SAMPLE_PERFORMANCES[key])||SAMPLE_PERFORMANCES.melody;
    const clip=performanceToClip(perf,key);track.clips.push(clip);selectedClipId=clip.id;render();status(`「${clip.name}」を${track.name}のNote Clipとして追加しました。`);
  }
  function stopPreview(){for(const timer of previewTimers)clearTimeout(timer);previewTimers=[];for(const note of previewNotes)engine.noteOff(note);previewNotes.clear();const stop=document.getElementById("clipStopBtn");if(stop)stop.disabled=true;}
  async function previewClip(){
    const clip=selectedClip(),track=selectedTrack();if(!clip||!track){status("試聴するクリップを選択してください。");return;}stopPreview();if(track.mute){status("選択トラックはミュートされています。");return;}try{await engine.init();}catch(error){status(error.message);return;}applyTrack(track);const beatMs=60000/project.bpm;document.getElementById("clipStopBtn").disabled=false;
    for(const event of clip.notes){const on=setTimeout(()=>{previewNotes.add(event.note);engine.noteOn(event.note,event.velocity*track.volume);},event.start_beats*beatMs);const off=setTimeout(()=>{engine.noteOff(event.note);previewNotes.delete(event.note);},(event.start_beats+event.duration_beats)*beatMs);previewTimers.push(on,off);}previewTimers.push(setTimeout(()=>{stopPreview();status(`${track.name} · ${clip.name} の試聴が完了しました。`);},clip.length_beats*beatMs+200));status(`${track.name} · ${clip.name} を共有BPM ${project.bpm}で試聴中…`);
  }
  function sanitizeClip(raw){const notes=Array.isArray(raw?.notes)?raw.notes.slice(0,MAX_NOTES).map(note=>({note:Math.round(bounded(note.note,0,127,60)),start_beats:bounded(note.start_beats,0,TIMELINE_BEATS,0),duration_beats:bounded(note.duration_beats,.03125,8,.25),velocity:bounded(note.velocity,.01,1,.82)})):[];return {id:uid("clip"),name:String(raw?.name||"Clip").slice(0,60),start_beats:bounded(raw?.start_beats,0,TIMELINE_BEATS,0),length_beats:bounded(raw?.length_beats,.25,TIMELINE_BEATS,4),notes};}
  function sanitizeTrack(raw,index){const fallback=newTrack(ROLE_DEFS[index]||null,index),patch=validatePatch(raw?.patch||fallback.patch);return {...fallback,name:String(raw?.name||fallback.name).slice(0,40),role:String(raw?.role||fallback.role).slice(0,24),color:/^#[0-9a-f]{6}$/i.test(raw?.color||"")?raw.color:fallback.color,mute:Boolean(raw?.mute),solo:Boolean(raw?.solo),volume:bounded(raw?.volume,0,1,.82),pan:bounded(raw?.pan,-1,1,0),midi_channel:Math.round(bounded(raw?.midi_channel,0,15,index%16)),source:{type:raw?.source?.type==="vst3"?"vst3":"internal",plugin_id:String(raw?.source?.plugin_id||"").slice(0,160),name:String(raw?.source?.name||"内蔵音源").slice(0,80)},patch:clone(patch),generated_patch:clone(validatePatch(raw?.generated_patch||patch)),clips:Array.isArray(raw?.clips)?raw.clips.slice(0,MAX_CLIPS).map(sanitizeClip):[]};}
  function exportProject(){captureSelectedPatch();const blob=new Blob([JSON.stringify(project,null,2)],{type:"application/json"}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`${project.name.replace(/[^\w\-\u3040-\u30ff\u3400-\u9fff]+/g,"_")||"project"}.nlss-project.json`;link.click();URL.revokeObjectURL(link.href);status("Project JSONを保存しました。");}
  async function importProject(file){const raw=JSON.parse(await file.text());if(!raw||!Array.isArray(raw.tracks)||!raw.tracks.length)throw new Error("tracksを含むProject JSONではありません。");stopPreview();project={schema_version:SCHEMA_VERSION,name:String(raw.name||"読み込んだ曲").slice(0,60),bpm:Math.round(bounded(raw.bpm,40,240,100)),time_signature:[4,4],selected_track_id:"",tracks:raw.tracks.slice(0,MAX_TRACKS).map(sanitizeTrack)};project.selected_track_id=project.tracks[0].id;selectedClipId=project.tracks[0].clips[0]?.id||null;applyTrack(project.tracks[0]);render();status(`${project.name}を読み込みました（${project.tracks.length}トラック）。`);}
  function bind(){
    document.getElementById("trackAddBtn")?.addEventListener("click",addTrack);document.getElementById("clipFromSampleBtn")?.addEventListener("click",addClipFromSample);document.getElementById("clipPreviewBtn")?.addEventListener("click",previewClip);document.getElementById("clipStopBtn")?.addEventListener("click",()=>{stopPreview();status("クリップ試聴を停止しました。");});document.getElementById("projectExportBtn")?.addEventListener("click",exportProject);
    document.getElementById("projectImportInput")?.addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{await importProject(file);}catch(error){status(`読込エラー: ${error.message}`);}finally{event.target.value="";}});
    document.getElementById("projectName")?.addEventListener("change",event=>{project.name=String(event.target.value||"新しい曲").slice(0,60);render();});document.getElementById("projectBpm")?.addEventListener("change",event=>{project.bpm=Math.round(bounded(event.target.value,40,240,100));render();});
  }
  bind();applyTrack(selectedTrack());render();
  window.multitrackProject={get snapshot(){captureSelectedPatch();return clone(project);},selectTrack,addClipFromSample,exportProject,stopPreview};
})();
