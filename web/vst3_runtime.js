"use strict";

// Browser-side adapter for the local Python -> native VST3 bridge.
// VST3 code never executes in the browser process.
(() => {
  const scanBtn=document.getElementById("vst3ScanBtn"),select=document.getElementById("vst3PluginSelect");
  const loadBtn=document.getElementById("vst3LoadBtn"),unloadBtn=document.getElementById("vst3UnloadBtn");
  const route=document.getElementById("vst3RouteEnabled"),params=document.getElementById("vst3Parameters"),status=document.getElementById("vst3Status");
  if(!scanBtn||!select||!loadBtn||!route||!status)return;

  let loaded=false,scheduledTimers=new Set();
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));

  async function api(path,payload=null){
    const options=payload===null?{cache:"no-store"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)};
    const response=await fetch(path,options);const data=await response.json();if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data;
  }
  function show(message){status.textContent=message;}
  function cancelScheduled(){for(const id of scheduledTimers)clearTimeout(id);scheduledTimers.clear();}
  function scheduleNative(path,payload,whenSeconds=0){
    const delay=Math.max(0,Number(whenSeconds)||0)*1000;
    const fire=()=>{api(path,payload).catch(err=>{show(`VST3イベント送信エラー: ${err.message}`);route.checked=false;});};
    if(delay<2){fire();return;}const id=setTimeout(()=>{scheduledTimers.delete(id);fire();},delay);scheduledTimers.add(id);
  }

  const baseNoteOn=engine.noteOn.bind(engine),baseNoteOff=engine.noteOff.bind(engine);
  engine.noteOn=function(midiNote,velocity,whenSeconds=0){
    if(route.checked&&loaded){scheduleNative("/api/vst3/note-on",{note:Math.round(clamp(midiNote,0,127)),velocity:clamp(velocity,.001,1)},whenSeconds);return null;}
    return baseNoteOn(midiNote,velocity,whenSeconds);
  };
  engine.noteOff=function(midiNote,whenSeconds=0){
    if(route.checked&&loaded){scheduleNative("/api/vst3/note-off",{note:Math.round(clamp(midiNote,0,127))},whenSeconds);return;}
    return baseNoteOff(midiNote,whenSeconds);
  };

  async function scan(){
    show("VST3を検索中…");scanBtn.disabled=true;
    try{
      const data=await api("/api/vst3/scan",{});select.innerHTML="";
      if(!data.plugins?.length){select.append(new Option("VST3が見つかりませんでした",""));show(data.native_host_available?"VST3が見つかりません。検索パスを確認してください。":"VST3は未検出です。ネイティブホストも未ビルドです。");return;}
      select.append(new Option(`${data.count}件から選択…`,""));for(const p of data.plugins)select.append(new Option(p.name,p.id));
      show(`${data.count}件のVST3を検出しました。${data.native_host_available?"":" 初回は build_vst3_host.cmd を実行してください。"}`);
    }catch(err){show(`VST3検索エラー: ${err.message}`);}finally{scanBtn.disabled=false;loadBtn.disabled=!select.value;}
  }

  async function load(){if(!select.value)return;show("VST3をロード中…");loadBtn.disabled=true;route.checked=false;
    try{const data=await api("/api/vst3/load",{plugin_id:select.value});if(!data.ok)throw new Error(data.error||"ロード失敗");loaded=true;route.disabled=false;unloadBtn.disabled=false;show(`VST3: ${data.name||select.selectedOptions[0]?.text||"loaded"} をロードしました。`);await refreshParameters();}
    catch(err){loaded=false;route.disabled=true;show(`VST3ロードエラー: ${err.message}`);}finally{loadBtn.disabled=!select.value;}}
  async function unload(){cancelScheduled();route.checked=false;route.disabled=true;try{await api("/api/vst3/unload",{});}catch(_){}loaded=false;unloadBtn.disabled=true;params.innerHTML="";show("VST3を解除しました。");}

  async function refreshParameters(){
    params.innerHTML="";const data=await api("/api/vst3/parameters",{});if(!data.ok)throw new Error(data.error||"パラメータ取得失敗");
    const visible=(data.parameters||[]).slice(0,160);
    for(const p of visible){const row=document.createElement("label");row.className="vst3-param";const title=document.createElement("span");title.textContent=p.units?`${p.title} (${p.units})`:p.title;const input=document.createElement("input");input.type="range";input.min="0";input.max="1";input.step=p.step_count>1?String(1/p.step_count):"0.001";input.value=String(clamp(p.value,0,1));const value=document.createElement("output");value.textContent=Number(input.value).toFixed(3);let timer=0;input.addEventListener("input",()=>{value.textContent=Number(input.value).toFixed(3);clearTimeout(timer);timer=setTimeout(()=>api("/api/vst3/parameter",{id:p.id,value:Number(input.value)}).catch(err=>show(`VST3パラメータエラー: ${err.message}`)),35);});row.append(title,input,value);params.append(row);}
    if((data.parameters||[]).length>visible.length){const note=document.createElement("p");note.className="param-help";note.textContent=`先頭${visible.length}項目を表示（全${data.parameters.length}項目）。`;params.append(note);}
  }

  select.addEventListener("change",()=>{loadBtn.disabled=!select.value;});scanBtn.addEventListener("click",scan);loadBtn.addEventListener("click",load);unloadBtn.addEventListener("click",unload);
  route.addEventListener("change",()=>show(route.checked?"VST3ルーティング有効: 鍵盤・MIDI・サンプル・鼻歌試聴をVST3へ送ります。":"Web Audio音源へ戻しました。"));
  window.addEventListener("beforeunload",cancelScheduled);

  api("/api/vst3/status").then(data=>{show(data.native_host_available?"VST3ネイティブホストを利用できます。「VST3を検索」を押してください。":"VST3を使う場合は build_vst3_host.cmd を一度実行してください。");}).catch(()=>show("VST3状態を確認できませんでした。"));
  window.vst3Router={scan,load,unload,refreshParameters,isLoaded:()=>loaded,isRouting:()=>loaded&&route.checked};
})();
