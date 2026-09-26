"use strict";

// v0.14 track sound assignment and arrangement playback. Bounded note-event data,
// the existing AudioContext, and the established noteOn/noteOff boundary are retained.
(() => {
  const SCHEMA_VERSION=1,MAX_TRACKS=24,MAX_CLIPS=64,MAX_NOTES=512,TIMELINE_BEATS=16,MAX_SONG_BEATS=256;
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
  let serial=0,applyingTrack=false,selectedClipId=null,completionTimer=0,playbackTimer=0,playbackRunId=0,arrangementPlaying=false,expandedTrackId=null,playheadFrame=0;
  const preparedTrackPatches=new Map();
  const frozenBuffers=new Map(),frozenSources=new Set(),freezingIds=new Set();
  const uid=(prefix)=>`${prefix}-${Date.now().toString(36)}-${(++serial).toString(36)}`;
  const clone=(value)=>JSON.parse(JSON.stringify(value));
  const bounded=(value,min,max,fallback)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):fallback));
  const patchFor=(overrides)=>validatePatch({...DEFAULT_PATCH,...overrides});
  function newTrack(def,index){
    const [role,name,color,overrides]=def||["custom",`トラック ${index+1}`,"#65d5f5",{}];
    return {id:uid("track"),name,role,color,mute:false,solo:false,volume:.82,pan:0,midi_channel:role==="drums"?9:index%16,midi_channel_mode:"auto",source:{type:"internal",plugin_id:"",name:"内蔵音源"},patch:patchFor(overrides),generated_patch:patchFor(overrides),clips:[]};
  }
  let project={schema_version:SCHEMA_VERSION,name:"新しい曲",bpm:100,time_signature:[4,4],length_beats:16,playhead_beats:0,loop_start_beats:0,loop_end_beats:16,selected_track_id:"",tracks:ROLE_DEFS.map(newTrack)};
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
  async function toggleFreeze(track){
    if(freezingIds.size){status("他のパートのフリーズが終わるまでお待ちください。");return;}
    if(arrangementPlaying){status("再生を停止してからフリーズしてください。");return;}
    if(frozenBuffers.has(track.id)){
      try{await window.vst3Router.resumeTrack(track);frozenBuffers.delete(track.id);renderTrackList();status(`${track.name}のフリーズを解除しました。`);}catch(error){status(`フリーズ解除エラー: ${error.message}`);}return;
    }
    if(track.source.type!=="vst3"||track.source.shared_with||project.tracks.some(other=>other.source.shared_with===track.id)){
      status("フリーズするには独立したVST3パートを選び、共有を解除してください。");return;
    }
    ensureRoleClip(track);
    const queue=buildPlaybackQueue([track]),secondsPerBeat=60/project.bpm;
    const events=[];
    for(const item of queue){const channel=vstChannel(track),note_id=window.vst3Router.nextNoteId();events.push({on:true,note:item.event.note,velocity:item.event.velocity*track.volume,channel,note_id,delay_ms:item.startBeat*secondsPerBeat*1000},{on:false,note:item.event.note,velocity:0,channel,note_id,delay_ms:item.endBeat*secondsPerBeat*1000});}
    if((project.length_beats*secondsPerBeat+2)>42){status("フリーズは42秒以内の曲に対応します。BPMか曲長を調整してください。");return;}
    if(events.length>1024){status("フリーズ対象のノートが多すぎます（最大512ノート）。クリップを分けてください。");return;}
    freezingIds.add(track.id);renderTrackList();status(`${track.name}を実時間でフリーズ中… 演奏が終わるまでお待ちください。`);
    try{await engine.init();const buffer=await window.vst3Router.freezeTrack(track,events,(project.length_beats*secondsPerBeat+2)*1000);frozenBuffers.set(track.id,buffer);status(`${track.name}をフリーズしました。再生時のVST3演算を休止します。`);}catch(error){status(`フリーズエラー: ${error.message}`);}finally{freezingIds.delete(track.id);renderTrackList();}
  }
  async function setSharedSource(track,masterId){
    if(arrangementPlaying||freezingIds.size){status("再生・フリーズを停止してから共有を変更してください。");return;}
    if(frozenBuffers.has(track.id)){status("フリーズを解除してから共有を設定してください。");return;}
    const previous={shared_with:track.source.shared_with,mode:track.midi_channel_mode,channel:track.midi_channel};
    if(masterId){const master=byId(masterId);if(!master||master.id===track.id||master.source.type!=="vst3"||master.source.plugin_id!==track.source.plugin_id||master.source.shared_with||frozenBuffers.has(master.id)){status("同じVST3の独立パートだけを共有元にできます。");return;}track.source.shared_with=master.id;track.midi_channel_mode="manual";track.midi_channel=master.midi_channel;}
    else{delete track.source.shared_with;track.midi_channel_mode="auto";allocateVstChannel(track);}
    try{await window.vst3Router.loadTrack(track);status(masterId?`${track.name}は${byId(masterId).name}と同じVST3インスタンス・音色を共有します。`:`${track.name}を独立したVST3に戻しました。音色を設定し直してください。`);}catch(error){if(previous.shared_with)track.source.shared_with=previous.shared_with;else delete track.source.shared_with;track.midi_channel_mode=previous.mode;track.midi_channel=previous.channel;status(`VST3共有エラー: ${error.message}`);}renderTrackList();renderTrackSoundPanel();
  }
  function inlineVstSettings(track){
    const details=document.createElement("details");details.className="track-vst-details";details.open=expandedTrackId===track.id;details.addEventListener("toggle",()=>{if(details.isConnected)expandedTrackId=details.open?track.id:expandedTrackId===track.id?null:expandedTrackId;});details.addEventListener("click",event=>event.stopPropagation());
    const heading=document.createElement("summary");heading.textContent="このパートのVST3設定";details.append(heading);
    const plugins=window.vst3Router?.scannedPlugins?.()||[],picker=document.createElement("select");picker.setAttribute("aria-label",`${track.name}のVST3音源`);picker.append(new Option("VST3音源を選択",""));for(const plugin of plugins)picker.append(new Option(plugin.name,plugin.id));if(track.source.type==="vst3"&&track.source.plugin_id&&!plugins.some(plugin=>plugin.id===track.source.plugin_id))picker.append(new Option(`${track.source.name}（再検索が必要）`,track.source.plugin_id));picker.value=track.source.type==="vst3"?track.source.plugin_id:"";picker.addEventListener("change",()=>{if(picker.value)setTrackSourceFor(track,"vst3",picker.value);});
    const channel=document.createElement("select");channel.setAttribute("aria-label",`${track.name}のMIDIチャンネル`);channel.append(new Option(`自動: Ch ${track.midi_channel+1}`,"auto"));for(let i=0;i<16;i++)channel.append(new Option(`Ch ${i+1}`,String(i)));channel.value=track.midi_channel_mode==="manual"?String(track.midi_channel):"auto";channel.addEventListener("change",()=>updateTrackMidi(track,channel.value));
    channel.disabled=Boolean(track.source.shared_with);
    const share=document.createElement("select");share.setAttribute("aria-label",`${track.name}のVST3共有元`);share.append(new Option("独立したVST3（別音色）",""));for(const other of project.tracks){if(other.id!==track.id&&other.source.type==="vst3"&&other.source.plugin_id===track.source.plugin_id&&!other.source.shared_with&&!frozenBuffers.has(other.id))share.append(new Option(`${other.name}と音色・CPUを共有`,other.id));}share.value=track.source.shared_with||"";share.disabled=track.source.type!=="vst3"||frozenBuffers.has(track.id)||project.tracks.some(other=>other.source.shared_with===track.id);share.addEventListener("change",()=>setSharedSource(track,share.value));
    const freeze=document.createElement("button");freeze.type="button";freeze.textContent=freezingIds.has(track.id)?"フリーズ中…":frozenBuffers.has(track.id)?"フリーズ解除":"フリーズ（実時間）";freeze.disabled=freezingIds.has(track.id)||track.source.type!=="vst3"||Boolean(track.source.shared_with)||project.tracks.some(other=>other.source.shared_with===track.id);freeze.addEventListener("click",()=>toggleFreeze(track));
    const scan=document.createElement("button");scan.type="button";scan.textContent="検索";scan.addEventListener("click",()=>window.vst3Router?.scan?.());
    const load=document.createElement("button");load.type="button";load.textContent="ロード";load.addEventListener("click",()=>loadSelectedVst(track));
    const editor=document.createElement("button");editor.type="button";editor.textContent="VST3本体画面";editor.disabled=track.source.type!=="vst3"||freezingIds.has(track.id);editor.addEventListener("click",()=>openTrackVstEditor(track));
    const params=document.createElement("button");params.type="button";params.textContent="パラメータ";params.disabled=track.source.type!=="vst3"||freezingIds.has(track.id);
    const paramList=document.createElement("div");paramList.className="track-vst-parameters";params.addEventListener("click",async()=>{paramList.textContent="パラメータを取得中…";try{const data=await window.vst3Router.trackParameters(track),items=(data.parameters||[]).slice(0,64);paramList.replaceChildren();if(!items.length)paramList.textContent="この音源は調整できるパラメータを公開していません。";for(const param of items){const label=document.createElement("label"),name=document.createElement("span"),input=document.createElement("input");name.textContent=param.title||`Parameter ${param.id}`;input.type="range";input.min="0";input.max="1";input.step=Number(param.step_count)>1?String(1/param.step_count):"0.001";input.value=String(bounded(param.value,0,1,0));input.addEventListener("change",()=>window.vst3Router.trackSetParameter(track,param.id,Number(input.value)).catch(error=>status(`VST3パラメータエラー: ${error.message}`)));label.append(name,input);paramList.append(label);}}catch(error){paramList.textContent=`取得エラー: ${error.message}`;}});
    const state=document.createElement("small");state.textContent=track.source.type==="vst3"?`${frozenBuffers.has(track.id)?"フリーズ済み":window.vst3Router?.isTrackLoaded?.(track)?"ロード済み":"未ロード"} · MIDI Ch ${track.midi_channel+1}${track.source.shared_with?` · ${byId(track.source.shared_with)?.name||"不明"}と共有`:""}`:"VST3を選択してください";
    const grid=document.createElement("div");grid.className="track-vst-detail-grid";grid.append(picker,scan,channel,load,editor,params,share,freeze,state,paramList);details.append(grid);return details;
  }
  function renderTrackList(){
    const root=document.getElementById("trackList");if(!root)return;root.replaceChildren();
    for(const track of project.tracks){
      const row=document.createElement("div");row.className=`track-row${track.id===project.selected_track_id?" selected":""}`;row.dataset.trackId=track.id;row.setAttribute("role","option");row.setAttribute("aria-selected",String(track.id===project.selected_track_id));
      const color=document.createElement("span");color.className="track-color";color.style.background=track.color;
      const copyNode=document.createElement("span");copyNode.className="track-copy";const title=document.createElement("strong");title.textContent=track.name;const detail=document.createElement("small");detail.textContent=`${track.patch.name} · ${track.source.name}${track.source.type==="vst3"?` · Ch ${track.midi_channel+1}`:""}`;copyNode.append(title,detail);
      const sourceSelect=document.createElement("select");sourceSelect.className="track-source-select";sourceSelect.title=`${track.name}の音源を個別に選択`;for(const [value,label] of [["internal","内蔵音源"],["reference","CD/Reference調整"],["vst3","VST3音源"]])sourceSelect.append(new Option(label,value));sourceSelect.value=track.source.type;sourceSelect.addEventListener("click",event=>event.stopPropagation());sourceSelect.addEventListener("change",event=>{event.stopPropagation();setTrackSourceFor(track,event.target.value);});
      const controls=document.createElement("span");controls.className="track-controls";
      for(const [key,label] of [["mute","M"],["solo","S"]]){const button=document.createElement("button");button.type="button";button.textContent=label;button.title=key==="mute"?"このトラックをミュート":"このトラックだけをソロ再生";button.classList.toggle("active",track[key]);button.addEventListener("click",event=>{event.stopPropagation();toggleTrack(track.id,key);});controls.append(button);}
      row.append(color,copyNode,sourceSelect,controls,inlineVstSettings(track));row.addEventListener("click",()=>selectTrack(track.id));root.append(row);
    }
  }
  function renderSummary(){const track=selectedTrack(),node=document.getElementById("selectedTrackSummary");if(node&&track)node.textContent=`選択中: ${track.name} · ${track.patch.name}`;renderTrackSoundPanel();}
  function renderTrackSoundPanel(){
    const track=selectedTrack();if(!track)return;
    const title=document.getElementById("trackSoundTitle"),badge=document.getElementById("trackSourceBadge"),prompt=document.getElementById("trackPromptInput");
    if(title)title.textContent=`${track.name}の音色を設定`;if(badge)badge.textContent=track.source.name;if(prompt&&document.activeElement!==prompt)prompt.value=track.patch.prompt||"";
    const picker=document.getElementById("trackVstPluginSelect"),plugins=window.vst3Router?.scannedPlugins?.()||[];
    if(picker){picker.replaceChildren(new Option("VST3を選択", ""));for(const plugin of plugins)picker.append(new Option(plugin.name,plugin.id));if(track.source.type==="vst3"&&track.source.plugin_id&&!plugins.some(plugin=>plugin.id===track.source.plugin_id))picker.append(new Option(`${track.source.name}（再検索が必要）`,track.source.plugin_id));picker.value=track.source.type==="vst3"?track.source.plugin_id:"";}
    const channelPicker=document.getElementById("trackVstMidiChannel");if(channelPicker)channelPicker.value=track.midi_channel_mode==="manual"?String(track.midi_channel):"auto";
    const trackStatus=document.getElementById("trackVstStatus");if(trackStatus)trackStatus.textContent=track.source.type==="vst3"?`${window.vst3Router?.isTrackLoaded?.(track)?"ロード済み":"未ロード"} · MIDI Ch ${track.midi_channel+1}${track.midi_channel_mode==="auto"?"（自動）":"（手動）"}`:"VST3を選択すると、このトラック専用にロードできます。";
    const editor=document.getElementById("trackVstEditorBtn");if(editor)editor.disabled=track.source.type!=="vst3";
    for(const [id,type] of [["trackInternalSourceBtn","internal"],["trackReferenceSourceBtn","reference"],["trackVstSourceBtn","vst3"]])document.getElementById(id)?.classList.toggle("active",track.source.type===type);
  }
  function addEmptyClip(){const track=selectedTrack();if(track.clips.length>=MAX_CLIPS){status(`1トラックのクリップは最大${MAX_CLIPS}個です。`);return;}if(arrangementPlaying||freezingIds.size||frozenBuffers.has(track.id)){status("再生を停止し、このパートのフリーズを解除してから編集してください。");return;}const last=track.clips.at(-1),start=last?Math.min(project.length_beats-4,last.start_beats+last.length_beats):0;const clip={id:uid("clip"),name:`Clip ${track.clips.length+1}`,start_beats:start,length_beats:4,notes:[]};track.clips.push(clip);selectedClipId=clip.id;render();status(`${track.name}に空のクリップを追加しました。`);}
  function duplicateClip(){const track=selectedTrack(),clip=selectedClip();if(!clip||track.clips.length>=MAX_CLIPS)return;if(!rollCanEdit())return;const copy={...clone(clip),id:uid("clip"),name:`${clip.name} copy`.slice(0,60),start_beats:Math.min(project.length_beats-clip.length_beats,clip.start_beats+clip.length_beats)};track.clips.push(copy);selectedClipId=copy.id;render();status("クリップを複製しました。タイムライン上で移動できます。");}
  function deleteClip(){if(!rollCanEdit())return;const track=selectedTrack(),clip=selectedClip();if(!clip)return;track.clips.splice(track.clips.indexOf(clip),1);selectedClipId=track.clips[0]?.id||null;selectedNoteIndex=-1;render();status("クリップを削除しました。");}
  function renderTimeline(){
    const root=document.getElementById("arrangementTimeline");if(!root)return;root.replaceChildren();const ruler=document.getElementById("timelineRuler"),bars=project.length_beats/4;if(ruler){ruler.replaceChildren();for(let i=0;i<bars;i++){const button=document.createElement("button");button.type="button";button.textContent=String(i+1);button.className=i*4===project.playhead_beats?"current-bar":"";button.addEventListener("click",()=>{if(arrangementPlaying)stopPreview();project.playhead_beats=i*4;renderTimeline();renderTransport();status(`再生位置を${i+1}小節に移動しました。`);});ruler.append(button);}}root.style.setProperty("--bars",bars);
    for(const track of project.tracks){const row=document.createElement("div");row.className="timeline-row";const label=document.createElement("span");label.className="timeline-label";label.textContent=track.name;const lane=document.createElement("div");lane.className="timeline-lane";
      for(const clip of track.clips){const block=document.createElement("button");block.type="button";block.className=`clip-block${clip.id===selectedClipId?" selected":""}`;block.textContent=clip.name;block.style.background=track.color;block.style.left=`${Math.min(100,clip.start_beats/project.length_beats*100)}%`;block.style.width=`${Math.min(100-clip.start_beats/project.length_beats*100,Math.max(3,clip.length_beats/project.length_beats*100))}%`;
        block.addEventListener("pointerdown",event=>{if(project.selected_track_id!==track.id){selectTrack(track.id);selectedClipId=clip.id;renderTimeline();renderPianoRoll();return;}selectedClipId=clip.id;renderPianoRoll();const startX=event.clientX,initial=clip.start_beats,step=rollStep();block.setPointerCapture(event.pointerId);block.onpointermove=move=>{if(arrangementPlaying||freezingIds.size||frozenBuffers.has(track.id))return;const beats=Math.round((move.clientX-startX)/Math.max(1,lane.clientWidth)*project.length_beats/step)*step;clip.start_beats=bounded(initial+beats,0,project.length_beats-clip.length_beats,initial);block.style.left=`${clip.start_beats/project.length_beats*100}%`;};block.onpointerup=()=>{block.onpointermove=null;block.onpointerup=null;renderTimeline();renderPianoRoll();};});
        block.addEventListener("click",()=>{if(project.selected_track_id!==track.id)selectTrack(track.id);selectedClipId=clip.id;renderTimeline();renderPianoRoll();});lane.append(block);}row.append(label,lane);root.append(row);}
    const marker=document.createElement("div");marker.id="arrangementPlayhead";marker.className="arrangement-playhead";marker.setAttribute("aria-hidden","true");root.append(marker);showPlayhead(project.playhead_beats,arrangementPlaying);
  }
  const rollUndo=[],rollRedo=[];let selectedNoteIndex=-1;
  function rollHistory(){const clip=selectedClip();if(!clip)return;rollUndo.push({clip:clip.id,notes:clone(clip.notes)});if(rollUndo.length>50)rollUndo.shift();rollRedo.length=0;}
  function rollCanEdit(){const track=selectedTrack();if(!selectedClip()){status("先にクリップを選択してください。");return false;}if(arrangementPlaying||freezingIds.size||frozenBuffers.has(track.id)){status("再生を停止し、このパートのフリーズを解除してから編集してください。");return false;}return true;}
  function rollStep(){return bounded(document.getElementById("rollSnap")?.value,.125,1,.25);}
  function rollLimit(clip){return Math.min(clip.length_beats,project.length_beats-clip.start_beats);}
  function renderPianoRoll(){
    const root=document.getElementById("projectPianoRoll"),clip=selectedClip();if(!root)return;
    root.replaceChildren();root.classList.toggle("empty",!clip);for(const [id,value] of [["clipStartBeat",clip?.start_beats],["clipLengthBeat",clip?.length_beats],["noteVelocity",clip?.notes[selectedNoteIndex]?.velocity*100]]){const input=document.getElementById(id);if(input){input.disabled=value===undefined;input.value=String(value??(id==="noteVelocity"?82:0));}}if(!clip)return;
    const lowest=Math.round(bounded(document.getElementById("rollRange")?.value,24,48,36)),width=924,rowHeight=12;
    const grid=document.createElement("div");grid.className="roll-grid";grid.style.height=`${48*rowHeight}px`;
    for(let pitch=lowest;pitch<lowest+48;pitch+=12){const key=document.createElement("span");key.className="roll-key-label";key.style.top=`${(lowest+47-pitch)*rowHeight}px`;key.textContent=`C${Math.floor(pitch/12)-1}`;grid.append(key);}
    grid.addEventListener("pointerdown",event=>{
      if(event.target!==grid||!rollCanEdit()||clip.notes.length>=MAX_NOTES)return;
      const rect=grid.getBoundingClientRect(),step=rollStep(),beat=Math.floor(Math.max(0,event.clientX-rect.left-36)/width*TIMELINE_BEATS/step)*step;
      const pitch=lowest+47-Math.floor(Math.max(0,event.clientY-rect.top)/rowHeight);
      if(pitch<lowest||pitch>=lowest+48||beat>=rollLimit(clip))return;
      rollHistory();clip.notes.push({note:pitch,start_beats:beat,duration_beats:Math.min(1,rollLimit(clip)-beat),velocity:.82});selectedNoteIndex=clip.notes.length-1;renderPianoRoll();status(`MIDI ${pitch} のノートを追加しました。`);
    });
    clip.notes.forEach((note,index)=>{
      if(note.note<lowest||note.note>=lowest+48)return;
      const block=document.createElement("button");block.type="button";block.className=`roll-note${index===selectedNoteIndex?" selected":""}`;
      block.style.left=`${36+note.start_beats/TIMELINE_BEATS*width}px`;block.style.top=`${(lowest+47-note.note)*rowHeight}px`;
      block.style.width=`${Math.max(5,note.duration_beats/TIMELINE_BEATS*width-1)}px`;block.style.opacity=String(.35+note.velocity*.65);block.title=`MIDI ${note.note} · ${note.start_beats}拍 · 長さ${note.duration_beats}拍 · 強さ${Math.round(note.velocity*100)}%`;
      block.setAttribute("aria-label",block.title);
      block.addEventListener("pointerdown",event=>{
        event.stopPropagation();if(!rollCanEdit())return;selectedNoteIndex=index;block.classList.add("selected");
        const startX=event.clientX,startY=event.clientY,initial=clone(note),step=rollStep(),resize=event.offsetX>=block.offsetWidth-9;
        block.setPointerCapture(event.pointerId);let changed=false;
        block.onpointermove=move=>{
          const beats=Math.round((move.clientX-startX)/width*TIMELINE_BEATS/step)*step;
          const pitchDelta=-Math.round((move.clientY-startY)/rowHeight);
          const next=resize?{...initial,duration_beats:bounded(initial.duration_beats+beats,step,rollLimit(clip)-initial.start_beats,step)}:{...initial,start_beats:bounded(initial.start_beats+beats,0,Math.max(0,rollLimit(clip)-initial.duration_beats),0),note:Math.round(bounded(initial.note+pitchDelta,0,127,60))};
          if(next.start_beats!==note.start_beats||next.duration_beats!==note.duration_beats||next.note!==note.note){if(!changed){rollHistory();changed=true;}Object.assign(note,next);block.style.left=`${36+note.start_beats/TIMELINE_BEATS*width}px`;block.style.top=`${(lowest+47-note.note)*rowHeight}px`;block.style.width=`${Math.max(5,note.duration_beats/TIMELINE_BEATS*width-1)}px`;}
        };
        block.onpointerup=()=>{block.onpointermove=null;block.onpointerup=null;renderPianoRoll();if(changed)status("ノートを更新しました。");};
      });
      block.addEventListener("click",event=>{event.stopPropagation();selectedNoteIndex=index;renderPianoRoll();});
      grid.append(block);
    });
    root.append(grid);
  }
  function deleteRollNote(){if(!rollCanEdit())return;const clip=selectedClip();if(selectedNoteIndex<0||selectedNoteIndex>=clip.notes.length)return;rollHistory();clip.notes.splice(selectedNoteIndex,1);selectedNoteIndex=-1;renderPianoRoll();status("ノートを削除しました。");}
  function travelRollHistory(from,to){if(!rollCanEdit())return;const clip=selectedClip(),entry=from.pop();if(!entry)return;if(entry.clip!==clip.id){from.push(entry);return;}to.push({clip:clip.id,notes:clone(clip.notes)});clip.notes=clone(entry.notes);selectedNoteIndex=-1;renderPianoRoll();}
  function renderTransport(){const bars=project.length_beats/4;for(const [id,value,last] of [["playStartBar",project.playhead_beats/4+1,bars],["loopStartBar",project.loop_start_beats/4+1,bars],["loopEndBar",project.loop_end_beats/4,bars]]){const picker=document.getElementById(id);if(!picker)continue;picker.replaceChildren();for(let i=1;i<=last;i++)picker.append(new Option(String(i),String(i)));picker.value=String(value);}const length=document.getElementById("songBars");if(length)length.value=String(bars);}
  function render(){renderTrackList();renderSummary();renderTimeline();renderPianoRoll();renderTransport();const name=document.getElementById("projectName"),bpm=document.getElementById("projectBpm");if(name)name.value=project.name;if(bpm)bpm.value=project.bpm;}

  function performanceToClip(perf,key){let cursor=0,notes=[],sourceSteps=perf.steps||[];while(cursor<TIMELINE_BEATS&&notes.length<MAX_NOTES){for(const step of sourceSteps){if(cursor>=TIMELINE_BEATS||notes.length>=MAX_NOTES)break;const events=step.events||((step.notes||[]).map(note=>({note,velocity:.82})));for(const event of events){if(notes.length>=MAX_NOTES)break;notes.push({note:Math.round(bounded(event.note,0,127,60)),start_beats:cursor,duration_beats:bounded(step.beats*.78,.03125,8,.25),velocity:bounded(event.velocity,.01,1,.82)});}cursor+=bounded(step.beats,.03125,8,.25);}if(!sourceSteps.length)break;}return {id:uid("clip"),name:`${perf.label||key}（${TIMELINE_BEATS}拍）`,start_beats:0,length_beats:Math.min(TIMELINE_BEATS,Math.max(.25,cursor)),notes};}
  function addClipFromSample(){
    const track=selectedTrack();if(!track||track.clips.length>=MAX_CLIPS){status(`1トラックのクリップは最大${MAX_CLIPS}個です。`);return;}
    const select=document.getElementById("sampleSelect"),key=select&&select.value,perf=(typeof SAMPLE_PERFORMANCES!=="undefined"&&SAMPLE_PERFORMANCES[key])||SAMPLE_PERFORMANCES[ROLE_SAMPLE[track.role]]||SAMPLE_PERFORMANCES.melody;
    if(frozenBuffers.has(track.id)||freezingIds.has(track.id)){status("フリーズを解除してからクリップを追加してください。");return;}const clip=performanceToClip(perf,key),last=track.clips.at(-1);clip.start_beats=last?Math.min(project.length_beats-clip.length_beats,last.start_beats+last.length_beats):0;track.clips.push(clip);selectedClipId=clip.id;render();status(`「${clip.name}」を${track.name}のNote Clipとして追加しました。`);
  }
  function addDemoSong(){
    const demo=window.sequencerSamples?.makeSong(document.getElementById("demoSongSelect")?.value);
    if(!demo)return;
    if(arrangementPlaying||freezingIds.size||frozenBuffers.size){status("再生を停止し、各パートのフリーズを解除してからサンプル曲を配置してください。");return;}
    if(project.tracks.some(track=>track.clips.length)&&!window.confirm("既存の全クリップをサンプル曲に置き換えます。Project JSONへ保存済みか確認してください。続けますか？"))return;
    project.length_beats=demo.length_beats;project.bpm=demo.bpm;project.playhead_beats=0;project.loop_start_beats=0;project.loop_end_beats=demo.length_beats;
    for(const track of project.tracks){track.clips=(demo.clips[track.role]||[]).map(clip=>({...clip,id:uid("clip"),notes:clip.notes.map(note=>({...note}))}));}
    selectedClipId=selectedTrack()?.clips[0]?.id||null;rollUndo.length=0;rollRedo.length=0;render();status(`${demo.name}（${demo.key}、8小節）を全パートへ配置しました。`);
  }
  function preparedPatchFor(track){let patch=preparedTrackPatches.get(track.id);if(!patch){patch=engine.preparePlaybackPatch(track.patch);preparedTrackPatches.set(track.id,patch);}return patch;}
  function allocateVstChannel(track){if(track.midi_channel_mode==="manual")return;const used=new Set(project.tracks.filter(other=>other.id!==track.id&&other.source.type==="vst3").map(other=>other.midi_channel));const choices=track.role==="drums"?[9,...Array.from({length:16},(_,i)=>i).filter(i=>i!==9)]:Array.from({length:16},(_,i)=>i).filter(i=>i!==9).concat(9);track.midi_channel=choices.find(channel=>!used.has(channel))??(track.role==="drums"?9:choices[0]);}
  function vstChannel(track){return window.vst3Router?.channelForTrack?.(track)??track.midi_channel;}
  function playNote(track,event,on,whenSeconds=0,voiceId=null){const router=window.vst3Router;if(track.source.type==="vst3"&&track.source.plugin_id){const channel=vstChannel(track);return on?router?.trackNoteOn(track.id,event.note,event.velocity*track.volume,channel,whenSeconds):router?.trackNoteOff(track.id,event.note,channel,whenSeconds);}engine.usePreparedPlaybackPatch(preparedPatchFor(track));const fn=on?(router?.baseNoteOn||engine.noteOn.bind(engine)):(router?.baseNoteOff||engine.noteOff.bind(engine));engine.playbackVoiceId=voiceId;try{return on?fn(event.note,event.velocity*track.volume,whenSeconds):fn(event.note,whenSeconds);}finally{engine.playbackVoiceId=null;}}
  function buildPlaybackQueue(tracks){const queue=[];for(const track of tracks){for(const clip of track.clips){for(const [noteIndex,event] of clip.notes.entries()){const startBeat=clip.start_beats+event.start_beats;if(startBeat>=project.length_beats||startBeat>=clip.start_beats+clip.length_beats)continue;queue.push({track,event,voiceId:`${track.id}:${clip.id}:${noteIndex}`,startBeat,endBeat:Math.min(project.length_beats,clip.start_beats+clip.length_beats,startBeat+event.duration_beats)});}}}return queue.sort((a,b)=>a.startBeat-b.startBeat);}
  function sliceQueue(queue,start,end){return queue.filter(item=>item.startBeat>=start&&item.startBeat<end).map(item=>({...item,startBeat:item.startBeat-start,endBeat:Math.min(end,item.endBeat)-start}));}
  function startInternalScheduler(queue,onCycleComplete,cycleBeats=TIMELINE_BEATS,scheduledStart=null,loopAhead=false,frozenOffset=0,activeTracks=[]){const runId=++playbackRunId,secondsPerBeat=60/project.bpm,cycleStart=scheduledStart??engine.ctx.currentTime+.08;
    for(const track of activeTracks){const buffer=frozenBuffers.get(track.id);if(!buffer)continue;const source=engine.ctx.createBufferSource();source.buffer=buffer;source.connect(engine.master);source.onended=()=>{frozenSources.delete(source);source.disconnect();};frozenSources.add(source);{const offset=frozenOffset*secondsPerBeat,duration=Math.min(cycleBeats*secondsPerBeat,buffer.duration-offset);if(duration>0)source.start(cycleStart,offset,duration);else{frozenSources.delete(source);source.disconnect();}}}
    let cursor=0;const pump=()=>{if(runId!==playbackRunId)return;const now=engine.ctx.currentTime,horizon=now+.8,vstEvents=new Map();engine.suppressPerformanceVisuals=true;try{while(cursor<queue.length&&cycleStart+queue[cursor].startBeat*secondsPerBeat<=horizon){const item=queue[cursor++],delay=Math.max(0,cycleStart+item.startBeat*secondsPerBeat-now),duration=Math.max(.01,(item.endBeat-item.startBeat)*secondsPerBeat);if(frozenBuffers.has(item.track.id))continue;if(item.track.source.type==="vst3"&&item.track.source.plugin_id){const events=vstEvents.get(item.track.id)||[],channel=vstChannel(item.track),note_id=window.vst3Router.nextNoteId();events.push({on:true,note:item.event.note,velocity:item.event.velocity*item.track.volume,channel,note_id,delay_ms:delay*1000},{on:false,note:item.event.note,velocity:0,channel,note_id,delay_ms:(delay+duration)*1000});vstEvents.set(item.track.id,events);}else{playNote(item.track,item.event,true,delay,item.voiceId);playNote(item.track,item.event,false,delay+duration,item.voiceId);}}if(vstEvents.size)window.vst3Router?.trackEventsBatch?.(vstEvents);}finally{engine.suppressPerformanceVisuals=false;}if(cursor<queue.length){const untilNext=(cycleStart+queue[cursor].startBeat*secondsPerBeat-engine.ctx.currentTime-.8)*1000;playbackTimer=setTimeout(pump,Math.max(25,Math.min(100,untilNext)));}};pump();
    completionTimer=setTimeout(()=>{completionTimer=0;if(runId===playbackRunId)onCycleComplete(cycleStart+cycleBeats*secondsPerBeat);},Math.max(0,(cycleStart+cycleBeats*secondsPerBeat-engine.ctx.currentTime)*1000+(loopAhead?-100:30)));
    return cycleStart;
  }
  function showPlayhead(beat,playing){
    const position=document.getElementById("playPosition");if(position)position.textContent=`${playing?"再生中":"停止"} · ${Math.floor(beat/4)+1}小節 ${Math.floor(beat%4)+1}拍`;
    const lane=document.querySelector("#arrangementTimeline .timeline-lane"),marker=document.getElementById("arrangementPlayhead");if(marker&&lane)marker.style.left=`${lane.offsetLeft+lane.clientWidth*beat/project.length_beats}px`;
    const ruler=document.getElementById("timelineRuler");if(ruler)for(let i=0;i<ruler.children.length;i++)ruler.children[i].classList.toggle("current-bar",i===Math.floor(beat/4));
    marker?.classList.toggle("playing",playing);
  }
  function followPlayhead(startBeat,endBeat,cycleStart){
    cancelAnimationFrame(playheadFrame);
    const run=playbackRunId,secondsPerBeat=60/project.bpm;
    const update=()=>{if(!arrangementPlaying||run!==playbackRunId)return;const beat=Math.min(endBeat,startBeat+Math.max(0,engine.ctx.currentTime-cycleStart)/secondsPerBeat);showPlayhead(beat,true);if(beat<endBeat)playheadFrame=requestAnimationFrame(update);};
    update();
  }
  function stopPreview(){playbackRunId++;cancelAnimationFrame(playheadFrame);if(completionTimer)clearTimeout(completionTimer);completionTimer=0;if(playbackTimer)clearTimeout(playbackTimer);playbackTimer=0;for(const source of frozenSources){try{source.stop();}catch(_){}}frozenSources.clear();if(arrangementPlaying)window.vst3Router?.clearTrackEvents?.();arrangementPlaying=false;showPlayhead(project.playhead_beats,false);const stop=document.getElementById("clipStopBtn");if(stop)stop.disabled=true;}
  async function previewClip(){
    if(freezingIds.size){status("フリーズ録音が終わるまでお待ちください。");return;}
    const clip=selectedClip(),track=selectedTrack();if(!clip||!track){status("試聴するクリップを選択してください。");return;}stopPreview();if(track.mute){status("選択トラックはミュートされています。");return;}try{await engine.init();if(track.source.type!=="vst3"&&track.patch?.instrument_model==="licensed_pcm")await engine.ensureLicensedPCM?.();await window.vst3Router?.prepareTracks([track]);}catch(error){status(error.message);return;}if(track.source.type==="vst3"&&!window.vst3Router?.isTrackLoaded?.(track)){status(`VST3ロードエラー: ${window.vst3Router?.prepareErrors?.().join("、")||track.name}`);return;}applyTrack(track);document.getElementById("clipStopBtn").disabled=false;
    arrangementPlaying=true;const cycleStart=startInternalScheduler(sliceQueue(buildPlaybackQueue([{...track,clips:[clip]}]),clip.start_beats,clip.start_beats+clip.length_beats),()=>{stopPreview();applyTrack(track);status(`${track.name} · ${clip.name} の試聴が完了しました。`);},clip.length_beats,null,false,clip.start_beats,[track]);followPlayhead(clip.start_beats,clip.start_beats+clip.length_beats,cycleStart);status(`${track.name} · ${clip.name} を共有BPM ${project.bpm}で内部スケジューラ再生中…`);
  }
  function ensureRoleClip(track){if(track.clips.length)return;const key=ROLE_SAMPLE[track.role]||"melody",perf=SAMPLE_PERFORMANCES[key]||SAMPLE_PERFORMANCES.melody;track.clips.push(performanceToClip(perf,key));}
  async function playArrangement(){
    if(freezingIds.size){status("フリーズ録音が終わるまでお待ちください。");return;}
    stopPreview();const solo=project.tracks.filter(track=>track.solo),tracks=(solo.length?solo:project.tracks.filter(track=>!track.mute));try{await engine.init();if(tracks.some(track=>track.source.type!=="vst3"&&track.patch?.instrument_model==="licensed_pcm"))await engine.ensureLicensedPCM?.();await window.vst3Router?.prepareTracks(tracks);}catch(error){status(`VST3準備エラー: ${error.message}`);return;}for(const track of tracks)ensureRoleClip(track);render();arrangementPlaying=true;document.getElementById("clipStopBtn").disabled=false;const queue=buildPlaybackQueue(tracks);
    const scheduleCycle=(nextStart=null,from=project.playhead_beats)=>{if(!arrangementPlaying)return;const loop=Boolean(document.getElementById("arrangementLoop")?.checked),to=loop?project.loop_end_beats:project.length_beats,begin=from>=to?(loop?project.loop_start_beats:0):from;const cycleStart=startInternalScheduler(sliceQueue(queue,begin,to),cycleEnd=>{if(loop)scheduleCycle(cycleEnd,project.loop_start_beats);else{project.playhead_beats=0;stopPreview();applyTrack(selectedTrack());renderTransport();status("全パートの再生が完了しました。");}},to-begin,nextStart,loop,begin,tracks);followPlayhead(begin,to,cycleStart);};
    scheduleCycle();const errors=window.vst3Router?.prepareErrors?.()||[];status(`${tracks.length}パートを共有BPM ${project.bpm}で内部同時再生中${document.getElementById("arrangementLoop")?.checked?"（ループ）":""}…${errors.length?` VST3の一部をロードできませんでした: ${errors.join("、")}`:""}`);
  }
  async function loadSelectedVst(track=selectedTrack()){if(!track||track.source.type!=="vst3"){status("先にこのトラックのVST3音源を選択してください。");return;}const pluginId=track.source.plugin_id;status(`${track.name}のVST3をロード中…`);try{await window.vst3Router.loadTrack(track);if(track.source.plugin_id===pluginId){status(`${track.name}のVST3をロードしました。MIDI Ch ${track.midi_channel+1}。必要なら「このトラックのVST3画面」で音色を設定してください。`);renderTrackList();renderTrackSoundPanel();}}catch(error){if(track.source.plugin_id===pluginId)status(`VST3ロードエラー: ${error.message}`);}}
  async function openTrackVstEditor(track){if(!track||track.source.type!=="vst3"){status("このパートのVST3音源を選択してください。");return;}try{await window.vst3Router.openTrackEditor(track);status(`${track.name}のVST3本体画面を開きました。`);renderTrackList();renderTrackSoundPanel();}catch(error){status(`VST3本体画面エラー: ${error.message}`);}}
  function openSelectedVstEditor(){return openTrackVstEditor(selectedTrack());}
  function updateTrackMidi(track,value){if(!track)return;if(frozenBuffers.has(track.id)||freezingIds.has(track.id)||track.source.shared_with){status("共有・フリーズを解除してからチャンネルを変更してください。");return;}track.midi_channel_mode=value==="auto"?"auto":"manual";if(track.midi_channel_mode==="auto")allocateVstChannel(track);else track.midi_channel=Math.round(bounded(value,0,15,0));for(const other of project.tracks)if(other.source.shared_with===track.id)other.midi_channel=track.midi_channel;renderTrackList();renderTrackSoundPanel();}
  function setTrackSourceFor(track,type,pluginId=""){if(!track)return;if(frozenBuffers.has(track.id)||freezingIds.has(track.id)||project.tracks.some(other=>other.source.shared_with===track.id)){status("フリーズ・共有元を解除してから音源を変更してください。");renderTrackList();return;}if(type==="vst3"){const plugins=window.vst3Router?.scannedPlugins?.()||[],id=pluginId||track.source.plugin_id||document.getElementById("trackVstPluginSelect")?.value,plugin=plugins.find(item=>item.id===id);if(!plugin){expandedTrackId=track.id;status(`${track.name}で使うVST3を検索し、パート内の一覧から選択してください。`);renderTrackList();return;}if(track.source.type==="vst3"&&track.source.plugin_id===plugin.id){renderTrackList();return;}track.source={type:"vst3",plugin_id:plugin.id,plugin_path:plugin.path||"",name:`VST3: ${plugin.name}`};allocateVstChannel(track);expandedTrackId=track.id;render();loadSelectedVst(track);return;}else{window.vst3Router?.releaseTrack?.(track.id)?.catch(error=>status(`VST3解除エラー: ${error.message}`));if(type==="reference"){track.source={type:"reference",plugin_id:"",name:"CD/Reference調整済み内蔵音源"};document.getElementById("referenceAudioFile")?.scrollIntoView({behavior:"smooth",block:"center"});status(`${track.name}専用のReference Audio調整を行います。MP3/WAV/M4Aは特徴量解析だけに使い、録音そのものは音源としてコピーしません。`);}else track.source={type:"internal",plugin_id:"",name:"内蔵音源"};}render();}
  function setTrackSource(type,pluginId=""){setTrackSourceFor(selectedTrack(),type,pluginId||document.getElementById("trackVstPluginSelect")?.value||"");}
  function applyTrackPreset(){const id=document.getElementById("trackPresetSelect")?.value;if(!id||!window.referenceAudioMatch)return;setTrackSource("internal");window.referenceAudioMatch.applyPresetById(id);captureSelectedPatch();status(`${selectedTrack().name}へ内蔵プリセットを適用しました。`);}
  function applyTrackPrompt(){const input=document.getElementById("trackPromptInput"),prompt=String(input?.value||"").trim();if(!prompt){status("自然言語の調整内容を入力してください。");return;}setTrackSource("internal");document.getElementById("prompt").value=prompt;document.getElementById("generateBtn").click();status(`${selectedTrack().name}の内蔵音源を自然言語で調整しています…`);}
  function setupTrackSoundPanel(){const select=document.getElementById("trackPresetSelect");if(select&&!select.options.length)for(const [id,label] of TRACK_PRESETS)select.append(new Option(label,id));const channel=document.getElementById("trackVstMidiChannel");if(channel&&channel.options.length===1)for(let i=0;i<16;i++)channel.append(new Option(`Ch ${i+1}`,String(i)));channel?.addEventListener("change",event=>updateTrackMidi(selectedTrack(),event.target.value));document.getElementById("trackInternalSourceBtn")?.addEventListener("click",()=>setTrackSource("internal"));document.getElementById("trackReferenceSourceBtn")?.addEventListener("click",()=>setTrackSource("reference"));document.getElementById("trackVstSourceBtn")?.addEventListener("click",()=>setTrackSource("vst3"));document.getElementById("trackVstPluginSelect")?.addEventListener("change",event=>{if(event.target.value)setTrackSource("vst3",event.target.value);});document.getElementById("trackVstScanBtn")?.addEventListener("click",()=>window.vst3Router?.scan?.());document.getElementById("trackVstLoadBtn")?.addEventListener("click",()=>loadSelectedVst());document.getElementById("trackVstEditorBtn")?.addEventListener("click",openSelectedVstEditor);window.addEventListener("vst3-catalog-changed",()=>{renderTrackList();renderTrackSoundPanel();});document.getElementById("trackPresetApplyBtn")?.addEventListener("click",applyTrackPreset);document.getElementById("trackPromptApplyBtn")?.addEventListener("click",applyTrackPrompt);}
  function sanitizeClip(raw,songBeats){const notes=Array.isArray(raw?.notes)?raw.notes.slice(0,MAX_NOTES).map(note=>({note:Math.round(bounded(note.note,0,127,60)),start_beats:bounded(note.start_beats,0,TIMELINE_BEATS,0),duration_beats:bounded(note.duration_beats,.03125,8,.25),velocity:bounded(note.velocity,.01,1,.82)})):[];return {id:uid("clip"),name:String(raw?.name||"Clip").slice(0,60),start_beats:bounded(raw?.start_beats,0,songBeats-.25,0),length_beats:bounded(raw?.length_beats,.25,Math.min(TIMELINE_BEATS,songBeats-bounded(raw?.start_beats,0,songBeats-.25,0)),4),notes};}
  function sanitizeTrack(raw,index,songBeats){const fallback=newTrack(ROLE_DEFS[index]||null,index),patch=validatePatch(raw?.patch||fallback.patch),sourceType=["internal","reference","vst3"].includes(raw?.source?.type)?raw.source.type:"internal";return {...fallback,id:/^[\w-]{1,80}$/.test(String(raw?.id||""))?String(raw.id):fallback.id,name:String(raw?.name||fallback.name).slice(0,40),role:String(raw?.role||fallback.role).slice(0,24),color:/^#[0-9a-f]{6}$/i.test(raw?.color||"")?raw.color:fallback.color,mute:Boolean(raw?.mute),solo:Boolean(raw?.solo),volume:bounded(raw?.volume,0,1,.82),pan:bounded(raw?.pan,-1,1,0),midi_channel:Math.round(bounded(raw?.midi_channel,0,15,fallback.midi_channel)),midi_channel_mode:raw?.midi_channel_mode==="manual"?"manual":"auto",source:{type:sourceType,plugin_id:String(raw?.source?.plugin_id||"").slice(0,160),plugin_path:String(raw?.source?.plugin_path||"").slice(0,1024),plugin_state:typeof raw?.source?.plugin_state==="string"&&raw.source.plugin_state.length<=12000000?raw.source.plugin_state:"",name:String(raw?.source?.name||"内蔵音源").slice(0,80),shared_with:sourceType==="vst3"?String(raw?.source?.shared_with||"").slice(0,80):""},patch:clone(patch),generated_patch:clone(validatePatch(raw?.generated_patch||patch)),clips:Array.isArray(raw?.clips)?raw.clips.slice(0,MAX_CLIPS).map(clip=>sanitizeClip(clip,songBeats)):[]};}
  async function exportProject(){
    if(freezingIds.size){status("フリーズ録音が終わってから保存してください。");return;}
    if(arrangementPlaying)stopPreview();
    captureSelectedPatch();status("VST3の音色を保存中…");
    try{
      for(const track of project.tracks){
        if(track.source.type!=="vst3"||track.source.shared_with)continue;
        track.source.plugin_state=await window.vst3Router.snapshotTrack(track);
      }
      const frozen_audio=[];let audioBytes=0;
      for(const track of project.tracks){const buffer=frozenBuffers.get(track.id);if(!buffer)continue;
        const entry=await window.frozenAudioProject.encode(buffer,track,project);
        audioBytes+=entry.frames*entry.channels*2;
        if(audioBytes>window.frozenAudioProject.MAX_TOTAL_BYTES)throw new Error("フリーズ音声の合計が96 MiBを超えています。不要なパートをフリーズ解除してください。");
        frozen_audio.push(entry);
      }
      const blob=new Blob([JSON.stringify({...project,frozen_audio},null,2)],{type:"application/json"}),link=document.createElement("a");
      if(blob.size>window.frozenAudioProject.MAX_FILE_BYTES)throw new Error("Project JSONが160 MiBを超えています。");
      link.href=URL.createObjectURL(blob);link.download=`${project.name.replace(/[^\w\-\u3040-\u30ff\u3400-\u9fff]+/g,"_")||"project"}.nlss-project.json`;
      link.click();URL.revokeObjectURL(link.href);status(`音色と${frozen_audio.length}パートのフリーズ音声を含むProject JSONを保存しました。`);
    }catch(error){status(`保存エラー: ${error.message}。Project JSONを出力していません。`);}
  }
  async function importProject(file){
    if(freezingIds.size)throw new Error("フリーズ録音が終わるまでお待ちください。");
    if(file.size>window.frozenAudioProject.MAX_FILE_BYTES)throw new Error("Project JSONが160 MiBの上限を超えています。");
    const raw=JSON.parse(await file.text());if(!raw||!Array.isArray(raw.tracks)||!raw.tracks.length)throw new Error("tracksを含むProject JSONではありません。");
    const restored=new Map(),entries=raw.frozen_audio??[];
    if(!Array.isArray(entries)||entries.length>MAX_TRACKS)throw new Error("フリーズ音声の件数が不正です。");
    if(entries.length){await engine.init();let total=0;for(const entry of entries){
      const track=raw.tracks.find(item=>item?.id===entry?.track_id);
      if(!track||restored.has(track.id))throw new Error("フリーズ音声のトラックIDが不正です。");
      const buffer=await window.frozenAudioProject.decode(entry,track,raw,engine.ctx);
      total+=buffer.length*buffer.numberOfChannels*2;
      if(total>window.frozenAudioProject.MAX_TOTAL_BYTES)throw new Error("フリーズ音声の合計が96 MiBを超えています。");
      restored.set(track.id,buffer);
    }}
    stopPreview();frozenBuffers.clear();rollUndo.length=0;rollRedo.length=0;selectedNoteIndex=-1;await Promise.allSettled(project.tracks.map(track=>window.vst3Router?.releaseTrack?.(track.id)));
    const songBeats=Math.round(bounded(raw.length_beats,16,MAX_SONG_BEATS,16)/4)*4;project={schema_version:SCHEMA_VERSION,name:String(raw.name||"読み込んだ曲").slice(0,60),bpm:Math.round(bounded(raw.bpm,40,240,100)),time_signature:[4,4],length_beats:songBeats,playhead_beats:bounded(raw.playhead_beats,0,songBeats-4,0),loop_start_beats:bounded(raw.loop_start_beats,0,songBeats-4,0),loop_end_beats:bounded(raw.loop_end_beats,4,songBeats,songBeats),selected_track_id:"",tracks:raw.tracks.slice(0,MAX_TRACKS).map((track,index)=>sanitizeTrack(track,index,songBeats))};if(project.loop_end_beats<=project.loop_start_beats)project.loop_end_beats=project.length_beats;
    const ids=new Set();for(const track of project.tracks){if(ids.has(track.id))track.id=uid("track");ids.add(track.id);}
    for(const track of project.tracks){const master=byId(track.source.shared_with);if(!master||master.id===track.id||master.source.type!=="vst3"||master.source.plugin_id!==track.source.plugin_id||master.source.shared_with)delete track.source.shared_with;if(track.source.shared_with)track.midi_channel=master.midi_channel;else if(track.source.type==="vst3"&&track.midi_channel_mode==="auto")allocateVstChannel(track);}
    for(const track of project.tracks)if(restored.has(track.id))frozenBuffers.set(track.id,restored.get(track.id));
    project.selected_track_id=project.tracks[0].id;selectedClipId=project.tracks[0].clips[0]?.id||null;applyTrack(project.tracks[0]);render();
    const vstTracks=project.tracks.filter(track=>track.source.type==="vst3"&&track.source.plugin_id);
    if(vstTracks.length){status(`${project.name}を読み込みました。VST3を再検索・音色を復元中…`);await window.vst3Router.scanForTracks(vstTracks);await window.vst3Router.prepareTracks(vstTracks);}
    const errors=vstTracks.length?window.vst3Router?.prepareErrors?.()||[]:[];
    render();status(`${project.name}を読み込みました（${project.tracks.length}トラック、フリーズ音声${restored.size}パート）。${errors.length?`復元できなかったVST3: ${errors.join("、")}`:"VST3の割当と音色を復元しました。"}`);
  }
  function bind(){
    document.getElementById("clipNewBtn")?.addEventListener("click",addEmptyClip);
    document.getElementById("clipDuplicateBtn")?.addEventListener("click",duplicateClip);
    document.getElementById("clipDeleteBtn")?.addEventListener("click",deleteClip);
    document.getElementById("rollRange")?.addEventListener("change",renderPianoRoll);
    document.getElementById("clipStartBeat")?.addEventListener("change",event=>{if(!rollCanEdit())return;const clip=selectedClip();clip.start_beats=bounded(event.target.value,0,project.length_beats-clip.length_beats,clip.start_beats);renderTimeline();renderPianoRoll();});
    document.getElementById("clipLengthBeat")?.addEventListener("change",event=>{if(!rollCanEdit())return;const clip=selectedClip(),length=bounded(event.target.value,.25,Math.min(16,project.length_beats-clip.start_beats),clip.length_beats);if(clip.notes.some(note=>note.start_beats+note.duration_beats>length)){status("短くする範囲の外にノートがあります。先にノートを移動してください。");renderPianoRoll();return;}clip.length_beats=length;renderTimeline();renderPianoRoll();});
    document.getElementById("noteVelocity")?.addEventListener("pointerdown",()=>{if(selectedClip()?.notes[selectedNoteIndex]&&rollCanEdit())rollHistory();});
    document.getElementById("noteVelocity")?.addEventListener("input",event=>{if(!rollCanEdit())return;const note=selectedClip()?.notes[selectedNoteIndex];if(!note)return;note.velocity=bounded(Number(event.target.value)/100,.01,1,.82);});
    document.getElementById("noteVelocity")?.addEventListener("change",renderPianoRoll);
    document.getElementById("songBars")?.addEventListener("change",event=>{const beats=Number(event.target.value)*4;if(arrangementPlaying||freezingIds.size||frozenBuffers.size){status("曲長を変更する前に再生を停止し、フリーズを解除してください。");renderTransport();return;}if(project.tracks.some(track=>track.clips.some(clip=>clip.start_beats+clip.length_beats>beats))){status("新しい曲長の外にクリップがあります。先にクリップを移動または削除してください。");renderTransport();return;}project.length_beats=beats;project.playhead_beats=Math.min(project.playhead_beats,beats-4);project.loop_start_beats=Math.min(project.loop_start_beats,beats-4);project.loop_end_beats=beats;render();});
    document.getElementById("playStartBar")?.addEventListener("change",event=>{if(arrangementPlaying)stopPreview();project.playhead_beats=(Number(event.target.value)-1)*4;renderTimeline();});
    document.getElementById("loopStartBar")?.addEventListener("change",event=>{project.loop_start_beats=(Number(event.target.value)-1)*4;if(project.loop_start_beats>=project.loop_end_beats)project.loop_end_beats=project.loop_start_beats+4;renderTransport();});
    document.getElementById("loopEndBar")?.addEventListener("change",event=>{project.loop_end_beats=Number(event.target.value)*4;if(project.loop_end_beats<=project.loop_start_beats)project.loop_start_beats=project.loop_end_beats-4;renderTransport();});
    document.getElementById("rollUndo")?.addEventListener("click",()=>travelRollHistory(rollUndo,rollRedo));
    document.getElementById("rollRedo")?.addEventListener("click",()=>travelRollHistory(rollRedo,rollUndo));
    document.getElementById("rollDelete")?.addEventListener("click",deleteRollNote);
    document.getElementById("projectPianoRoll")?.addEventListener("keydown",event=>{if(event.key==="Delete"){deleteRollNote();event.preventDefault();}});
    setupTrackSoundPanel();document.getElementById("trackAddBtn")?.addEventListener("click",addTrack);document.getElementById("clipFromSampleBtn")?.addEventListener("click",addClipFromSample);document.getElementById("demoSongBtn")?.addEventListener("click",addDemoSong);document.getElementById("clipPreviewBtn")?.addEventListener("click",previewClip);document.getElementById("arrangementPlayBtn")?.addEventListener("click",playArrangement);document.getElementById("clipStopBtn")?.addEventListener("click",()=>{stopPreview();applyTrack(selectedTrack());status("再生を停止しました。");});document.getElementById("projectExportBtn")?.addEventListener("click",exportProject);
    document.getElementById("projectImportInput")?.addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{await importProject(file);}catch(error){status(`読込エラー: ${error.message}`);}finally{event.target.value="";}});
    document.getElementById("projectName")?.addEventListener("change",event=>{project.name=String(event.target.value||"新しい曲").slice(0,60);render();});document.getElementById("projectBpm")?.addEventListener("change",event=>{if(frozenBuffers.size||freezingIds.size){status("BPMを変える前にフリーズを解除してください。");render();return;}project.bpm=Math.round(bounded(event.target.value,40,240,100));render();});
  }
  bind();applyTrack(selectedTrack());render();
  const projectStatus=document.getElementById("projectStatus");
  if(projectStatus){projectStatus.dataset.runtimeState="ready";projectStatus.textContent="トラックを選び、TRACK SOUNDでパートごとの音源を設定できます。全パート再生とループにも対応しています。";}
  window.multitrackProject={trackById:byId,isFrozen:id=>frozenBuffers.has(id)||freezingIds.has(id),get snapshot(){captureSelectedPatch();return clone(project);},selectTrack,addClipFromSample,playArrangement,exportProject,stopPreview};
})();
