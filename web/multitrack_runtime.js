"use strict";

// v0.14 track sound assignment and arrangement playback. Bounded note-event data,
// the existing AudioContext, and the established noteOn/noteOff boundary are retained.
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
  const TRACK_PRESETS=[
    ["concert_grand","Concert Grand"],["close_grand","Close Grand"],["neo_soul_ep","Neo Soul FM EP"],
    ["pop_pocket_drums","Pop Pocket Drums"],["modern_fusion_6string_bass","Modern Fusion 6-string Bass"],
    ["fretless_bridge_70s","70s Bridge Fretless"],["fretless_warm","Warm Singing Fretless"],
    ["clean_fusion_guitar","Clean Fusion Guitar"],["acoustic_style_guitar","Acoustic-style Guitar"],
    ["studio_tenor_sax","Studio Tenor Sax"]
  ];
  const ROLE_SAMPLE={drums:"drum_straight",bass:"bass",keyboard:"chords",guitar:"chords",melody:"melody",chorus:"chords",pad:"chords",custom:"melody"};
  let serial=0,applyingTrack=false,selectedClipId=null,completionTimer=0,playbackRunId=0,arrangementPlaying=false;
  const preparedTrackPatches=new Map();
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
    preparedTrackPatches.delete(track.id);
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
    project.selected_track_id=next.id;selectedClipId=next.clips[0]?.id||null;applyTrack(next);render();status(`${next.name}を選択しました。上のTRACK SOUNDで、このパート専用の音源と音色を設定できます。`);
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
      const sourceSelect=document.createElement("select");sourceSelect.className="track-source-select";sourceSelect.title=`${track.name}の音源を個別に選択`;for(const [value,label] of [["internal","内蔵音源"],["reference","CD/Reference調整"],["vst3","VST3音源"]])sourceSelect.append(new Option(label,value));sourceSelect.value=track.source.type;sourceSelect.addEventListener("click",event=>event.stopPropagation());sourceSelect.addEventListener("change",event=>{event.stopPropagation();if(project.selected_track_id!==track.id)selectTrack(track.id);setTrackSource(event.target.value);});
      const controls=document.createElement("span");controls.className="track-controls";
      for(const [key,label] of [["mute","M"],["solo","S"]]){const button=document.createElement("button");button.type="button";button.textContent=label;button.title=key==="mute"?"このトラックをミュート":"このトラックだけをソロ再生";button.classList.toggle("active",track[key]);button.addEventListener("click",event=>{event.stopPropagation();toggleTrack(track.id,key);});controls.append(button);}
      row.append(color,copyNode,sourceSelect,controls);row.addEventListener("click",()=>selectTrack(track.id));root.append(row);
    }
  }
  function renderSummary(){const track=selectedTrack(),node=document.getElementById("selectedTrackSummary");if(node&&track)node.textContent=`選択中: ${track.name} · ${track.patch.name}`;renderTrackSoundPanel();}
  function renderTrackSoundPanel(){
    const track=selectedTrack();if(!track)return;
    const title=document.getElementById("trackSoundTitle"),badge=document.getElementById("trackSourceBadge"),prompt=document.getElementById("trackPromptInput");
    if(title)title.textContent=`${track.name}の音色を設定`;if(badge)badge.textContent=track.source.name;if(prompt&&document.activeElement!==prompt)prompt.value=track.patch.prompt||"";
    for(const [id,type] of [["trackInternalSourceBtn","internal"],["trackReferenceSourceBtn","reference"],["trackVstSourceBtn","vst3"]])document.getElementById(id)?.classList.toggle("active",track.source.type===type);
  }
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

  function performanceToClip(perf,key){let cursor=0,notes=[],sourceSteps=perf.steps||[];while(cursor<TIMELINE_BEATS&&notes.length<MAX_NOTES){for(const step of sourceSteps){if(cursor>=TIMELINE_BEATS||notes.length>=MAX_NOTES)break;const events=step.events||((step.notes||[]).map(note=>({note,velocity:.82})));for(const event of events){if(notes.length>=MAX_NOTES)break;notes.push({note:Math.round(bounded(event.note,0,127,60)),start_beats:cursor,duration_beats:bounded(step.beats*.78,.03125,8,.25),velocity:bounded(event.velocity,.01,1,.82)});}cursor+=bounded(step.beats,.03125,8,.25);}if(!sourceSteps.length)break;}return {id:uid("clip"),name:`${perf.label||key}（${TIMELINE_BEATS}拍）`,start_beats:0,length_beats:Math.min(TIMELINE_BEATS,Math.max(.25,cursor)),notes};}
  function addClipFromSample(){
    const track=selectedTrack();if(!track||track.clips.length>=MAX_CLIPS){status(`1トラックのクリップは最大${MAX_CLIPS}個です。`);return;}
    const select=document.getElementById("sampleSelect"),key=select&&select.value,perf=(typeof SAMPLE_PERFORMANCES!=="undefined"&&SAMPLE_PERFORMANCES[key])||SAMPLE_PERFORMANCES[ROLE_SAMPLE[track.role]]||SAMPLE_PERFORMANCES.melody;
    const clip=performanceToClip(perf,key);track.clips.push(clip);selectedClipId=clip.id;render();status(`「${clip.name}」を${track.name}のNote Clipとして追加しました。`);
  }
  function preparedPatchFor(track){let patch=preparedTrackPatches.get(track.id);if(!patch){patch=engine.preparePlaybackPatch(track.patch);preparedTrackPatches.set(track.id,patch);}return patch;}
  function playNote(track,event,on,whenSeconds=0){const router=window.vst3Router;if(track.source.type==="vst3"&&router?.isLoaded()&&router.loadedPlugin?.().id===track.source.plugin_id){return on?router.trackNoteOn(event.note,event.velocity*track.volume,track.midi_channel,whenSeconds):router.trackNoteOff(event.note,track.midi_channel,whenSeconds);}engine.usePreparedPlaybackPatch(preparedPatchFor(track));const fn=on?(router?.baseNoteOn||engine.noteOn.bind(engine)):(router?.baseNoteOff||engine.noteOff.bind(engine));return on?fn(event.note,event.velocity*track.volume,whenSeconds):fn(event.note,whenSeconds);}
  function buildPlaybackQueue(tracks){const queue=[];for(const track of tracks){for(const clip of track.clips){for(const event of clip.notes){const startBeat=clip.start_beats+event.start_beats;if(startBeat>=TIMELINE_BEATS)continue;queue.push({track,event,startBeat,endBeat:Math.min(TIMELINE_BEATS,startBeat+event.duration_beats)});}}}return queue.sort((a,b)=>a.startBeat-b.startBeat);}
  function startInternalScheduler(queue,onCycleComplete,cycleBeats=TIMELINE_BEATS){const runId=++playbackRunId,secondsPerBeat=60/project.bpm,leadSeconds=.08,cycleStart=engine.ctx.currentTime+leadSeconds;
    engine.suppressPerformanceVisuals=true;try{for(const item of queue){const delay=Math.max(0,cycleStart+item.startBeat*secondsPerBeat-engine.ctx.currentTime),duration=Math.max(.01,(item.endBeat-item.startBeat)*secondsPerBeat);playNote(item.track,item.event,true,delay);playNote(item.track,item.event,false,delay+duration);}}finally{engine.suppressPerformanceVisuals=false;}
    completionTimer=setTimeout(()=>{completionTimer=0;if(runId===playbackRunId)onCycleComplete();},(leadSeconds+cycleBeats*secondsPerBeat)*1000+30);
  }
  function stopPreview(){playbackRunId++;if(completionTimer)clearTimeout(completionTimer);completionTimer=0;arrangementPlaying=false;const stop=document.getElementById("clipStopBtn");if(stop)stop.disabled=true;}
  async function previewClip(){
    const clip=selectedClip(),track=selectedTrack();if(!clip||!track){status("試聴するクリップを選択してください。");return;}stopPreview();if(track.mute){status("選択トラックはミュートされています。");return;}try{await engine.init();}catch(error){status(error.message);return;}applyTrack(track);document.getElementById("clipStopBtn").disabled=false;
    arrangementPlaying=true;startInternalScheduler(buildPlaybackQueue([track]),()=>{stopPreview();applyTrack(track);status(`${track.name} · ${clip.name} の試聴が完了しました。`);},clip.length_beats);status(`${track.name} · ${clip.name} を共有BPM ${project.bpm}で内部スケジューラ再生中…`);
  }
  function ensureRoleClip(track){if(track.clips.length)return;const key=ROLE_SAMPLE[track.role]||"melody",perf=SAMPLE_PERFORMANCES[key]||SAMPLE_PERFORMANCES.melody;track.clips.push(performanceToClip(perf,key));}
  async function playArrangement(){
    stopPreview();try{await engine.init();}catch(error){status(error.message);return;}const solo=project.tracks.filter(track=>track.solo),tracks=(solo.length?solo:project.tracks.filter(track=>!track.mute));for(const track of tracks)ensureRoleClip(track);render();arrangementPlaying=true;document.getElementById("clipStopBtn").disabled=false;const queue=buildPlaybackQueue(tracks);
    const scheduleCycle=()=>{if(!arrangementPlaying)return;startInternalScheduler(queue,()=>{if(document.getElementById("arrangementLoop")?.checked)scheduleCycle();else{stopPreview();applyTrack(selectedTrack());status("全パートの再生が完了しました。");}});};
    scheduleCycle();status(`${tracks.length}パートを共有BPM ${project.bpm}で内部同時再生中${document.getElementById("arrangementLoop")?.checked?"（ループ）":""}…`);
  }
  function setTrackSource(type){const track=selectedTrack();if(!track)return;if(type==="vst3"){const plugin=window.vst3Router?.loadedPlugin?.();if(!plugin?.id){status("先にSTEP 2でVST3を検索・ロードしてください。");document.getElementById("soundSource")?.scrollIntoView({behavior:"smooth",block:"start"});renderTrackList();return;}track.source={type:"vst3",plugin_id:plugin.id,name:`VST3: ${plugin.name}`};}else if(type==="reference"){track.source={type:"reference",plugin_id:"",name:"CD/Reference調整済み内蔵音源"};document.getElementById("referenceAudioFile")?.scrollIntoView({behavior:"smooth",block:"center"});status(`${track.name}専用のReference Audio調整を行います。MP3/WAV/M4Aは特徴量解析だけに使い、録音そのものは音源としてコピーしません。`);}else track.source={type:"internal",plugin_id:"",name:"内蔵音源"};render();}
  function applyTrackPreset(){const id=document.getElementById("trackPresetSelect")?.value;if(!id||!window.referenceAudioMatch)return;setTrackSource("internal");window.referenceAudioMatch.applyPresetById(id);captureSelectedPatch();status(`${selectedTrack().name}へ内蔵プリセットを適用しました。`);}
  function applyTrackPrompt(){const input=document.getElementById("trackPromptInput"),prompt=String(input?.value||"").trim();if(!prompt){status("自然言語の調整内容を入力してください。");return;}setTrackSource("internal");document.getElementById("prompt").value=prompt;document.getElementById("generateBtn").click();status(`${selectedTrack().name}の内蔵音源を自然言語で調整しています…`);}
  function setupTrackSoundPanel(){const select=document.getElementById("trackPresetSelect");if(select&&!select.options.length)for(const [id,label] of TRACK_PRESETS)select.append(new Option(label,id));document.getElementById("trackInternalSourceBtn")?.addEventListener("click",()=>setTrackSource("internal"));document.getElementById("trackReferenceSourceBtn")?.addEventListener("click",()=>setTrackSource("reference"));document.getElementById("trackVstSourceBtn")?.addEventListener("click",()=>setTrackSource("vst3"));document.getElementById("trackPresetApplyBtn")?.addEventListener("click",applyTrackPreset);document.getElementById("trackPromptApplyBtn")?.addEventListener("click",applyTrackPrompt);}
  function sanitizeClip(raw){const notes=Array.isArray(raw?.notes)?raw.notes.slice(0,MAX_NOTES).map(note=>({note:Math.round(bounded(note.note,0,127,60)),start_beats:bounded(note.start_beats,0,TIMELINE_BEATS,0),duration_beats:bounded(note.duration_beats,.03125,8,.25),velocity:bounded(note.velocity,.01,1,.82)})):[];return {id:uid("clip"),name:String(raw?.name||"Clip").slice(0,60),start_beats:bounded(raw?.start_beats,0,TIMELINE_BEATS,0),length_beats:bounded(raw?.length_beats,.25,TIMELINE_BEATS,4),notes};}
  function sanitizeTrack(raw,index){const fallback=newTrack(ROLE_DEFS[index]||null,index),patch=validatePatch(raw?.patch||fallback.patch),sourceType=["internal","reference","vst3"].includes(raw?.source?.type)?raw.source.type:"internal";return {...fallback,name:String(raw?.name||fallback.name).slice(0,40),role:String(raw?.role||fallback.role).slice(0,24),color:/^#[0-9a-f]{6}$/i.test(raw?.color||"")?raw.color:fallback.color,mute:Boolean(raw?.mute),solo:Boolean(raw?.solo),volume:bounded(raw?.volume,0,1,.82),pan:bounded(raw?.pan,-1,1,0),midi_channel:Math.round(bounded(raw?.midi_channel,0,15,index%16)),source:{type:sourceType,plugin_id:String(raw?.source?.plugin_id||"").slice(0,160),name:String(raw?.source?.name||"内蔵音源").slice(0,80)},patch:clone(patch),generated_patch:clone(validatePatch(raw?.generated_patch||patch)),clips:Array.isArray(raw?.clips)?raw.clips.slice(0,MAX_CLIPS).map(sanitizeClip):[]};}
  function exportProject(){captureSelectedPatch();const blob=new Blob([JSON.stringify(project,null,2)],{type:"application/json"}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`${project.name.replace(/[^\w\-\u3040-\u30ff\u3400-\u9fff]+/g,"_")||"project"}.nlss-project.json`;link.click();URL.revokeObjectURL(link.href);status("Project JSONを保存しました。");}
  async function importProject(file){const raw=JSON.parse(await file.text());if(!raw||!Array.isArray(raw.tracks)||!raw.tracks.length)throw new Error("tracksを含むProject JSONではありません。");stopPreview();project={schema_version:SCHEMA_VERSION,name:String(raw.name||"読み込んだ曲").slice(0,60),bpm:Math.round(bounded(raw.bpm,40,240,100)),time_signature:[4,4],selected_track_id:"",tracks:raw.tracks.slice(0,MAX_TRACKS).map(sanitizeTrack)};project.selected_track_id=project.tracks[0].id;selectedClipId=project.tracks[0].clips[0]?.id||null;applyTrack(project.tracks[0]);render();status(`${project.name}を読み込みました（${project.tracks.length}トラック）。`);}
  function bind(){
    setupTrackSoundPanel();document.getElementById("trackAddBtn")?.addEventListener("click",addTrack);document.getElementById("clipFromSampleBtn")?.addEventListener("click",addClipFromSample);document.getElementById("clipPreviewBtn")?.addEventListener("click",previewClip);document.getElementById("arrangementPlayBtn")?.addEventListener("click",playArrangement);document.getElementById("clipStopBtn")?.addEventListener("click",()=>{stopPreview();applyTrack(selectedTrack());status("再生を停止しました。");});document.getElementById("projectExportBtn")?.addEventListener("click",exportProject);
    document.getElementById("projectImportInput")?.addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{await importProject(file);}catch(error){status(`読込エラー: ${error.message}`);}finally{event.target.value="";}});
    document.getElementById("projectName")?.addEventListener("change",event=>{project.name=String(event.target.value||"新しい曲").slice(0,60);render();});document.getElementById("projectBpm")?.addEventListener("change",event=>{project.bpm=Math.round(bounded(event.target.value,40,240,100));render();});
  }
  bind();applyTrack(selectedTrack());render();
  const projectStatus=document.getElementById("projectStatus");
  if(projectStatus){projectStatus.dataset.runtimeState="ready";projectStatus.textContent="トラックを選び、TRACK SOUNDでパートごとの音源を設定できます。全パート再生とループにも対応しています。";}
  window.multitrackProject={get snapshot(){captureSelectedPatch();return clone(project);},selectTrack,addClipFromSample,playArrangement,exportProject,stopPreview};
})();
