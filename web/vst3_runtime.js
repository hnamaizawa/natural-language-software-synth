"use strict";

// Browser-side adapter for the local Python -> native VST3 bridge.
// VST3 code never executes in the browser process.
(() => {
  const scanBtn=document.getElementById("vst3ScanBtn"),select=document.getElementById("vst3PluginSelect");
  const loadBtn=document.getElementById("vst3LoadBtn"),unloadBtn=document.getElementById("vst3UnloadBtn");
  const testToneBtn=document.getElementById("vst3TestToneBtn"),diagBtn=document.getElementById("vst3DiagBtn");
  const route=document.getElementById("vst3RouteEnabled"),params=document.getElementById("vst3Parameters"),status=document.getElementById("vst3Status");
  const programSelect=document.getElementById("vst3ProgramSelect"),programPrev=document.getElementById("vst3ProgramPrevBtn"),programNext=document.getElementById("vst3ProgramNextBtn"),programStatus=document.getElementById("vst3ProgramStatus");
  const extraScanPaths=document.getElementById("vst3ExtraScanPaths");
  const midiChannel=document.getElementById("vst3MidiChannel");
  if(!scanBtn||!select||!loadBtn||!route||!status)return;

  let editorBtn=document.getElementById("vst3EditorBtn");
  if(!editorBtn&&diagBtn?.parentElement){
    editorBtn=document.createElement("button");editorBtn.id="vst3EditorBtn";editorBtn.textContent="VST3本体画面を開く";editorBtn.disabled=true;
    diagBtn.parentElement.append(editorBtn);
  }

  let loaded=false,loadedPluginId="",loadedPluginName="",scheduledQueue=[],scheduledTimer=0,routedVisualNotes=new Set(),programParameter=null;
  const trackInstances=new Map();
  const loadingTracks=new Map();
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  function routedChannel(){const selected=String(midiChannel?.value||"auto");return selected==="auto"?(engine.patch?.engine_type==="drum"?9:0):Math.round(clamp(selected,0,15));}

  async function api(path,payload=null){
    const options=payload===null?{cache:"no-store"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)};
    const response=await fetch(path,options);const data=await response.json();if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data;
  }
  function show(message){status.textContent=message;}
  function isHostControl(active){
    return active===scanBtn||active===select||active===loadBtn||active===unloadBtn||active===testToneBtn||active===diagBtn||active===editorBtn||active===route||active===programSelect||active===programPrev||active===programNext||Boolean(params?.contains(active));
  }
  function restorePerformanceFocus(){
    const active=document.activeElement;
    if(active&&typeof active.blur==="function"&&isHostControl(active))active.blur();
  }
  function restorePerformanceFocusSoon(){
    requestAnimationFrame(()=>{restorePerformanceFocus();setTimeout(restorePerformanceFocus,40);});
  }
  function setRoutedVisual(note,on){
    const bounded=Math.round(clamp(note,0,127));
    if(typeof setPerformanceActive==="function")setPerformanceActive(bounded,on);
    if(on)routedVisualNotes.add(bounded);else routedVisualNotes.delete(bounded);
  }
  function clearRoutedVisuals(){
    for(const note of routedVisualNotes){if(typeof setPerformanceActive==="function")setPerformanceActive(note,false);}
    routedVisualNotes.clear();
  }
  function cancelScheduled(){if(scheduledTimer)clearTimeout(scheduledTimer);scheduledTimer=0;scheduledQueue=[];clearRoutedVisuals();}
  function armScheduledQueue(){if(scheduledTimer||!scheduledQueue.length)return;const wait=Math.max(0,scheduledQueue[0].due-performance.now());scheduledTimer=setTimeout(()=>{scheduledTimer=0;const now=performance.now()+1,due=[];while(scheduledQueue.length&&scheduledQueue[0].due<=now)due.push(scheduledQueue.shift());for(const item of due)item.fire();armScheduledQueue();},wait);}
  function scheduleNative(path,payload,whenSeconds=0,onFire=null,onFailure=null){
    const delay=Math.max(0,Number(whenSeconds)||0)*1000;
    const fire=()=>{
      if(onFire)onFire();
      api(path,payload).then(data=>{if(!data.ok)throw new Error(data.error||"VST3イベント送信失敗");}).catch(err=>{
        if(onFailure)onFailure();
        show(`VST3イベント送信エラー: ${err.message}`);route.checked=false;clearRoutedVisuals();
      });
    };
    if(delay<2){fire();return;}scheduledQueue.push({due:performance.now()+delay,fire});scheduledQueue.sort((a,b)=>a.due-b.due);armScheduledQueue();
  }

  const baseNoteOn=engine.noteOn.bind(engine),baseNoteOff=engine.noteOff.bind(engine);
  engine.noteOn=function(midiNote,velocity,whenSeconds=0){
    if(route.checked&&loaded){
      const note=Math.round(clamp(midiNote,0,127));
      const channel=routedChannel();
      scheduleNative("/api/vst3/note-on",{note,velocity:clamp(velocity,.001,1),channel},whenSeconds,()=>setRoutedVisual(note,true),()=>setRoutedVisual(note,false));
      return null;
    }
    return baseNoteOn(midiNote,velocity,whenSeconds);
  };
  engine.noteOff=function(midiNote,whenSeconds=0){
    if(route.checked&&loaded){
      const note=Math.round(clamp(midiNote,0,127));
      const channel=routedChannel();
      scheduleNative("/api/vst3/note-off",{note,channel},whenSeconds,()=>setRoutedVisual(note,false));
      return;
    }
    return baseNoteOff(midiNote,whenSeconds);
  };

  function resetProgramUi(message="VST3をロードすると、公開されているProgram/Presetを表示します。"){
    programParameter=null;
    if(programSelect){programSelect.innerHTML="";programSelect.append(new Option("Program/Presetなし",""));programSelect.disabled=true;}
    if(programPrev)programPrev.disabled=true;if(programNext)programNext.disabled=true;if(programStatus)programStatus.textContent=message;
  }
  function findProgramParameter(items){
    const list=(items||[]).filter(p=>Number(p.step_count)>0&&Number(p.step_count)<=2047);
    const explicit=list.find(p=>p.program_change===true);
    if(explicit)return explicit;
    const named=list.find(p=>/(program|preset|patch|voice|sound|tone|instrument|音色|プリセット)/i.test(String(p.title||"")));
    if(named)return named;
    const likely=list.filter(p=>Number(p.step_count)>=15&&Number(p.step_count)<=511).sort((a,b)=>Number(b.step_count)-Number(a.step_count));
    return likely[0]||null;
  }
  function renderProgramUi(data){
    if(!programSelect)return;
    const p=findProgramParameter(data.parameters);programParameter=p;
    programSelect.innerHTML="";
    if(!p){
      resetProgramUi("このVST3はホストから切替可能なProgram/Presetパラメータを公開していません。VST3本体画面がある場合は、そちらのPreset Browserを利用できます。");
      return;
    }
    const steps=Math.max(1,Math.round(Number(p.step_count)||1)),count=Math.min(steps+1,512),current=Math.max(0,Math.min(count-1,Math.round(clamp(p.value,0,1)*steps)));
    const supplied=Array.isArray(p.programs)?p.programs:[];
    for(let i=0;i<count;i++){
      const provided=supplied.find(x=>Number(x.index)===i),label=provided?.name||`${p.title||"Program"} ${String(i+1).padStart(3,"0")}`;
      programSelect.append(new Option(label,String(i)));
    }
    programSelect.value=String(current);programSelect.disabled=false;
    if(programPrev)programPrev.disabled=current<=0;if(programNext)programNext.disabled=current>=count-1;
    if(programStatus)programStatus.textContent=`${p.title||"Program"}: ${count}音色を切替可能${steps+1>512?"（先頭512件を表示）":""}`;
  }
  async function setProgramIndex(index){
    if(!programParameter||!programSelect)return;
    const steps=Math.max(1,Math.round(Number(programParameter.step_count)||1)),max=Math.min(steps,511),i=Math.max(0,Math.min(max,Math.round(Number(index)||0))),value=i/steps;
    programSelect.disabled=true;if(programPrev)programPrev.disabled=true;if(programNext)programNext.disabled=true;
    try{
      const data=await api("/api/vst3/parameter",{id:programParameter.id,value});if(!data.ok)throw new Error(data.error||"Program変更失敗");
      programParameter.value=value;programSelect.value=String(i);
      const label=programSelect.selectedOptions[0]?.text||`Program ${i+1}`;
      if(programStatus)programStatus.textContent=`選択中: ${label}`;show(`VST3音色を「${label}」へ切り替えました。`);
      setTimeout(()=>refreshParameters({preserveProgramMessage:true}).then(restorePerformanceFocusSoon).catch(()=>{}),120);
    }catch(err){show(`VST3音色切替エラー: ${err.message}`);programSelect.disabled=false;}
    finally{restorePerformanceFocusSoon();}
  }

  async function scan(){
    show("VST3を検索中…");scanBtn.disabled=true;
    try{
      const paths=String(extraScanPaths?.value||"").split(";").map(v=>v.trim()).filter(Boolean);
      const data=await api("/api/vst3/scan",{scan_paths:paths});select.innerHTML="";
      if(!data.plugins?.length){select.append(new Option("VST3が見つかりませんでした",""));window.dispatchEvent(new Event("vst3-catalog-changed"));const incompatible=Number(data.incompatible_count||0);show(data.native_host_available?`VST3が見つかりません。検索: ${(data.scan_roots||[]).join(" / ")}${incompatible?`。VST3ではないDLL等を${incompatible}件検出しました（VST2は非対応）。`:""}`:"VST3は未検出です。ネイティブホストも未ビルドです。");return;}
      select.append(new Option(`${data.count}件から選択…`,""));for(const p of data.plugins)select.append(new Option(p.name,p.id));
      window.dispatchEvent(new Event("vst3-catalog-changed"));
      show(`${data.count}件のVST3を検出しました。${Number(data.incompatible_count||0)?`VST3ではないDLL等 ${data.incompatible_count}件は除外しました。`:""}${data.native_host_available?"":" 初回は build_vst3_host.cmd を実行してください。"}`);
    }catch(err){show(`VST3検索エラー: ${err.message}`);}finally{scanBtn.disabled=false;loadBtn.disabled=!select.value;}
  }

  async function load(){
    if(!select.value)return;
    const resumeRouting=loaded&&route.checked;
    show("VST3をロード中…");loadBtn.disabled=true;route.checked=false;clearRoutedVisuals();resetProgramUi();if(editorBtn)editorBtn.disabled=true;
    try{
      const data=await api("/api/vst3/load",{plugin_id:select.value});if(!data.ok)throw new Error(data.error||"ロード失敗");
      loaded=true;loadedPluginId=select.value;loadedPluginName=data.name||select.selectedOptions[0]?.text||"loaded";route.disabled=false;unloadBtn.disabled=false;if(editorBtn)editorBtn.disabled=false;
      if(resumeRouting)route.checked=true;
      const channels=Number(data.main_output_channels||0),eventBus=Number(data.main_event_input_bus??-1);
      const pluginName=loadedPluginName,ssdHint=/ssd|steven slate/i.test(pluginName)?" SSD5本体画面を開き、ドラムキットがロード済みか確認してください。":"";
      show(`VST3: ${pluginName} をロードしました。出力 ${channels}ch / Event Bus ${eventBus}。${ssdHint}`);
      await refreshParameters();
      restorePerformanceFocusSoon();
    }
    catch(err){loaded=false;route.disabled=true;if(editorBtn)editorBtn.disabled=true;resetProgramUi("VST3をロードできませんでした。");show(`VST3ロードエラー: ${err.message}`);}
    finally{loadBtn.disabled=!select.value;restorePerformanceFocusSoon();}
  }
  async function prepareTracks(tracks){
    const requested=(tracks||[]).filter(track=>track?.source?.type==="vst3"&&track.source.plugin_id&&!window.multitrackProject?.isFrozen?.(track.id));
    for(const track of requested)await loadTrack(track);
    return requested.length;
  }
  async function loadTrack(track){
    const trackId=track?.id,pluginId=track?.source?.plugin_id;
    if(!trackId||track.source.type!=="vst3"||!pluginId)throw new Error("VST3を再検索し、トラックの音源を選択してください。");
    const masterId=track.source.shared_with;
    if(masterId){
      const master=window.multitrackProject?.trackById?.(masterId);
      if(!master||master.id===trackId||master.source?.type!=="vst3"||master.source.plugin_id!==pluginId||master.source.shared_with||window.multitrackProject?.isFrozen?.(master.id))throw new Error("共有元のVST3が変更されました。共有を解除してください。");
      await loadTrack(master);
      const previous=trackInstances.get(trackId);
      if(previous?.instanceId===masterId&&previous.pluginId===pluginId)return previous;
      if(previous?.instanceId===trackId)await releaseTrack(trackId);
      const alias={pluginId,instanceId:masterId};trackInstances.set(trackId,alias);return alias;
    }
    if(loadingTracks.has(trackId))await loadingTracks.get(trackId);
    if(track.source.type!=="vst3"||track.source.plugin_id!==pluginId)throw new Error("ロード中にトラックの音源が変更されました。");
    if(trackInstances.get(trackId)?.pluginId===pluginId&&trackInstances.get(trackId)?.instanceId===trackId)return trackInstances.get(trackId);
    if(!scannedPlugins().some(plugin=>plugin.id===pluginId))throw new Error("VST3を再検索し、トラックの音源を選択してください。");
    const job=(async()=>{
      const previous=trackInstances.get(trackId);
      if(previous){trackInstances.delete(trackId);if(previous.instanceId===trackId)await api("/api/vst3/unload",{instance_id:trackId});}
      const data=await api("/api/vst3/load",{plugin_id:pluginId,instance_id:trackId});
      if(!data.ok)throw new Error(`${track.name||"Track"}: ${data.error||"VST3ロード失敗"}`);
      // A new browser session may reconnect to an instance left frozen in the
      // native host; make the newly attached track playable again.
      const resumed=await api("/api/vst3/freeze/resume",{instance_id:trackId});
      if(!resumed.ok)throw new Error(resumed.error||"VST3再開失敗");
      trackInstances.set(trackId,{pluginId,instanceId:trackId});
      return data;
    })();
    loadingTracks.set(trackId,job);
    try{await job;return trackInstances.get(trackId);}finally{if(loadingTracks.get(trackId)===job)loadingTracks.delete(trackId);}
  }
  async function releaseTrack(trackId){
    const previous=loadingTracks.get(trackId);
    const job=(async()=>{
      if(previous)try{await previous;}catch(_){}
      if(!trackInstances.has(trackId))return;
      const target=trackInstances.get(trackId);trackInstances.delete(trackId);
      if(target.instanceId===trackId)await api("/api/vst3/unload",{instance_id:trackId});
    })();
    loadingTracks.set(trackId,job);
    try{await job;}finally{if(loadingTracks.get(trackId)===job)loadingTracks.delete(trackId);}
  }
  async function openTrackEditor(track){const target=await loadTrack(track);const data=await api("/api/vst3/editor/open",{instance_id:target.instanceId});if(!data.ok)throw new Error(data.error||"VST3本体画面を開けませんでした");return data;}
  async function trackParameters(track){const target=await loadTrack(track);const data=await api("/api/vst3/parameters",{instance_id:target.instanceId});if(!data.ok)throw new Error(data.error||"パラメータ取得失敗");return data;}
  async function trackSetParameter(track,id,value){const target=await loadTrack(track);const data=await api("/api/vst3/parameter",{instance_id:target.instanceId,id:Math.round(clamp(id,0,0x7fffffff)),value:clamp(value,0,1)});if(!data.ok)throw new Error(data.error||"パラメータ設定失敗");return data;}
  async function freezeTrack(track,events,durationMs){const target=await loadTrack(track);if(target.instanceId!==track.id)throw new Error("共有中のパートは先に共有を解除してください。");const started=await api("/api/vst3/freeze/start",{instance_id:target.instanceId,events,duration_ms:durationMs});if(!started.ok)throw new Error(started.error||"フリーズ開始失敗");try{let state;for(let i=0;i<Math.ceil(durationMs/250)+24;i++){await new Promise(resolve=>setTimeout(resolve,250));state=await api("/api/vst3/freeze/status",{instance_id:target.instanceId});if(!state.ok)throw new Error(state.error||"録音状態を確認できません");if(state.target_frames>0&&state.frames>=state.target_frames)break;}if(!state||state.frames<state.target_frames)throw new Error("音声の記録が時間内に完了しませんでした");const done=await api("/api/vst3/freeze/finish",{instance_id:target.instanceId});if(!done.ok)throw new Error(done.error||"フリーズ音声保存失敗");const response=await fetch(done.audio_url,{cache:"no-store"});if(!response.ok)throw new Error(`音声読込エラー: ${response.status}`);return await engine.ctx.decodeAudioData(await response.arrayBuffer());}catch(error){await api("/api/vst3/freeze/resume",{instance_id:target.instanceId}).catch(()=>{});throw error;}}
  async function resumeTrack(track){const target=trackInstances.get(track.id);if(target?.instanceId===track.id){const data=await api("/api/vst3/freeze/resume",{instance_id:track.id});if(!data.ok)throw new Error(data.error||"フリーズ解除失敗");}}
  async function unload(){
    cancelScheduled();route.checked=false;route.disabled=true;if(editorBtn)editorBtn.disabled=true;
    try{await api("/api/vst3/unload",{});}catch(_){}loaded=false;loadedPluginId="";loadedPluginName="";unloadBtn.disabled=true;params.innerHTML="";resetProgramUi();show("VST3を解除しました。");restorePerformanceFocusSoon();
  }

  async function refreshParameters({preserveProgramMessage=false}={}){
    params.innerHTML="";const data=await api("/api/vst3/parameters",{});if(!data.ok)throw new Error(data.error||"パラメータ取得失敗");
    const previousMessage=programStatus?.textContent||"";renderProgramUi(data);if(preserveProgramMessage&&programStatus)programStatus.textContent=previousMessage;
    const visible=(data.parameters||[]).slice(0,160);
    for(const p of visible){const row=document.createElement("label");row.className="vst3-param";const title=document.createElement("span");title.textContent=p.units?`${p.title} (${p.units})`:p.title;const input=document.createElement("input");input.type="range";input.min="0";input.max="1";input.step=p.step_count>1?String(1/p.step_count):"0.001";input.value=String(clamp(p.value,0,1));const value=document.createElement("output");value.textContent=Number(input.value).toFixed(3);let timer=0;input.addEventListener("input",()=>{value.textContent=Number(input.value).toFixed(3);clearTimeout(timer);timer=setTimeout(()=>api("/api/vst3/parameter",{id:p.id,value:Number(input.value)}).catch(err=>show(`VST3パラメータエラー: ${err.message}`)),35);});input.addEventListener("change",()=>input.blur());input.addEventListener("change",restorePerformanceFocusSoon);row.append(title,input,value);params.append(row);}
    if((data.parameters||[]).length>visible.length){const note=document.createElement("p");note.className="param-help";note.textContent=`先頭${visible.length}項目を表示（全${data.parameters.length}項目）。`;params.append(note);}
  }

  async function openEditor(){
    if(!loaded)return;
    show("VST3本体画面を開いています…");
    try{const data=await api("/api/vst3/editor/open",{});if(!data.ok)throw new Error(data.error||"VST3本体画面を開けませんでした");show("VST3本体画面を開きました。音色/PresetはVST3側の画面から変更できます。");}
    catch(err){show(`VST3本体画面エラー: ${err.message}`);}
  }
  async function testTone(){
    show("PC音声出力テスト中… 440Hzが約0.5秒鳴ればNative Host→Windows音声出力は正常です。");
    try{const data=await api("/api/vst3/test-tone",{});if(!data.ok)throw new Error(data.error||"音声出力テスト失敗");}
    catch(err){show(`PC音声出力テストエラー: ${err.message}`);}
  }
  async function diagnostics(){
    show("VST3診断を取得中…");
    try{
      const [d,host]=await Promise.all([api("/api/vst3/diagnostics"),api("/api/vst3/status")]);if(!d.ok)throw new Error(d.error||"診断失敗");
      const peakValue=Number(d.max_output_peak||0),peak=peakValue.toFixed(6),failures=Number(d.process_failures||0),routeState=route.checked?"ON":"OFF",events=Number(d.events_delivered||0);
      const guidance=events>0&&peakValue<0.000001?" MIDIイベントは到達していますが音声出力が0です。VST3本体画面でキット／Presetのロード、Master音量、MIDI受信チャンネルを確認し、SSD5ではチャンネル1も試してください。":events===0?" 演奏後もEventが0ならVST3ルーティングとEvent Busを確認してください。":"";
      const hostLoad=Number(host.cpu_load_percent||0).toFixed(1),overruns=Number(host.audio_overruns||0),suspended=Number(host.idle_suspended_count||0);
      show(`VST3診断: Route ${routeState} / MIDI Ch ${routedChannel()+1} / NoteOn ${d.note_on_queued||0} / Event ${events} / process ${d.process_calls||0} (失敗 ${failures}) / peak ${peak} / output ${d.main_output_channels||0}ch / Event Bus ${d.main_event_input_bus??-1} / Host負荷 ${hostLoad}% / 音切れ候補 ${overruns} / 休止 ${suspended}${d.editor_open?" / Editor OPEN":""}。${guidance}`);
    }catch(err){show(`VST3診断エラー: ${err.message}`);}finally{restorePerformanceFocusSoon();}
  }

  select.addEventListener("change",()=>{loadBtn.disabled=!select.value;});scanBtn.addEventListener("click",scan);loadBtn.addEventListener("click",load);unloadBtn.addEventListener("click",unload);
  if(testToneBtn)testToneBtn.addEventListener("click",testTone);if(diagBtn)diagBtn.addEventListener("click",diagnostics);if(editorBtn)editorBtn.addEventListener("click",openEditor);
  if(programSelect)programSelect.addEventListener("change",()=>{const index=Number(programSelect.value);programSelect.blur();setProgramIndex(index);});
  if(programPrev)programPrev.addEventListener("click",()=>setProgramIndex(Number(programSelect?.value||0)-1));
  if(programNext)programNext.addEventListener("click",()=>setProgramIndex(Number(programSelect?.value||0)+1));
  if(midiChannel)midiChannel.addEventListener("change",()=>{show(`VST3 MIDI受信チャンネルを ${routedChannel()+1} に設定しました。SSD5が無音の場合はチャンネル1と10を切り替えて試してください。`);midiChannel.blur();restorePerformanceFocusSoon();});
  route.addEventListener("change",()=>{if(!route.checked)clearRoutedVisuals();show(route.checked?"VST3ルーティング有効: 鍵盤・PCキー・MIDI・サンプル・鼻歌試聴をVST3へ送ります。":"Web Audio音源へ戻しました。");route.blur();restorePerformanceFocusSoon();});
  window.addEventListener("beforeunload",cancelScheduled);

  resetProgramUi();
  api("/api/vst3/status").then(data=>{show(data.native_host_available?"VST3ネイティブホストを利用できます。「VST3を検索」を押してください。":"VST3を使う場合は build_vst3_host.cmd を一度実行してください。");}).catch(()=>show("VST3状態を確認できませんでした。"));
  function selectedPlugin(){const id=select.value,name=select.selectedOptions[0]?.text||"";return id?{id,name}:loaded?{id:loadedPluginId,name:loadedPluginName}:null;}
  function scannedPlugins(){return [...select.options].filter(option=>option.value).map(option=>({id:option.value,name:option.text}));}
  function channelForTrack(track){return Math.round(clamp(track?.midi_channel,0,15));}
  function trackNoteOn(trackId,note,velocity,channel=0,whenSeconds=0){const target=trackInstances.get(trackId);if(!target)return false;scheduleNative("/api/vst3/note-on",{instance_id:target.instanceId,note:Math.round(clamp(note,0,127)),velocity:clamp(velocity,.001,1),channel:Math.round(clamp(channel,0,15))},whenSeconds);return true;}
  function trackNoteOff(trackId,note,channel=0,whenSeconds=0){const target=trackInstances.get(trackId);if(!target)return false;scheduleNative("/api/vst3/note-off",{instance_id:target.instanceId,note:Math.round(clamp(note,0,127)),channel:Math.round(clamp(channel,0,15))},whenSeconds);return true;}
  function trackEvents(instanceId,events){
    const target=trackInstances.get(instanceId);if(!target)return false;
    const bounded=(events||[]).slice(0,1024).map(event=>({on:Boolean(event.on),note:Math.round(clamp(event.note,0,127)),velocity:clamp(event.velocity,0,1),channel:Math.round(clamp(event.channel,0,15)),delay_ms:clamp(event.delay_ms,0,120000)}));
    api("/api/vst3/events",{instance_id:target.instanceId,events:bounded}).then(data=>{if(!data.ok)throw new Error(data.error||"VST3一括イベント送信失敗");}).catch(err=>show(`VST3一括イベント送信エラー: ${err.message}`));
    return true;
  }
  function trackEventsBatch(byTrack){const groups=new Map();for(const [trackId,events] of byTrack){const target=trackInstances.get(trackId);if(!target)continue;const group=groups.get(target.instanceId)||[];group.push(...events);groups.set(target.instanceId,group);}for(const [instanceId,events] of groups){events.sort((a,b)=>a.delay_ms-b.delay_ms);(async()=>{for(let i=0;i<events.length;i+=1024){const data=await api("/api/vst3/events",{instance_id:instanceId,events:events.slice(i,i+1024)});if(!data.ok)throw new Error(data.error||"VST3一括イベント送信失敗");}})().catch(err=>show(`VST3一括イベント送信エラー: ${err.message}`));}}
  function clearTrackEvents(){for(const instanceId of new Set([...trackInstances.values()].map(value=>value.instanceId)))api("/api/vst3/clear-events",{instance_id:instanceId}).catch(()=>{});}
  window["vst3Router"]={scan,load,unload,refreshParameters,testTone,diagnostics,openEditor,setProgramIndex,prepareTracks,loadTrack,releaseTrack,openTrackEditor,trackParameters,trackSetParameter,freezeTrack,resumeTrack,isTrackLoaded:track=>trackInstances.get(track?.id)?.pluginId===track?.source?.plugin_id,isLoaded:()=>loaded,isRouting:()=>loaded&&route.checked,loadedPlugin:()=>({id:loadedPluginId,name:loadedPluginName}),selectedPlugin,scannedPlugins,channelForTrack,trackNoteOn,trackNoteOff,trackEvents,trackEventsBatch,clearTrackEvents,baseNoteOn,baseNoteOff};
})();
