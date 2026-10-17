"use strict";

// Browser-local bridge between sound design, track assignment, performance and recording.
// Patch values are always normalized by validatePatch before application or export.
(()=>{
  const STORAGE_KEY="nlss.savedPatches.v1",MAX_PATCHES=64,MAX_PATCH_JSON=128*1024;
  const list=document.getElementById("savedPatchList"),nameInput=document.getElementById("savedPatchName");
  const status=document.getElementById("savedPatchStatus");
  if(!list||!nameInput||!status)return;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const makeId=()=>`patch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  function normalize(raw){
    if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("音色データの形式が正しくありません。");
    const patch=validatePatch(raw);
    if(JSON.stringify(patch).length>MAX_PATCH_JSON)throw new Error("音色データが上限を超えています。");
    return patch;
  }
  function read(){
    try{
      const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
      if(!Array.isArray(raw))return [];
      return raw.slice(0,MAX_PATCHES).flatMap(item=>{
        try{return [{id:String(item.id||makeId()).slice(0,80),name:String(item.name||item.patch?.name||"保存音色").slice(0,80),patch:normalize(item.patch)}];}
        catch(_){return [];}
      });
    }catch(_){status.textContent="保存音色を読み込めません。ブラウザの保存領域を確認してください。";return [];}
  }
  let entries=read();
  function persist(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(entries));status.textContent=`音色を保存しました（${entries.length}/${MAX_PATCHES}）。このブラウザでStep 2〜4から利用できます。`;return true;}
    catch(_){status.textContent="保存できませんでした。ブラウザの保存領域が不足している可能性があります。";return false;}
  }
  function apply(item,target){
    try{
      const patch=normalize(item.patch);
      if(target==="track"&&window.multitrackProject){
        const project=window.multitrackProject.snapshot,track=window.multitrackProject.trackById(project.selected_track_id);
        if(!track)throw new Error("アレンジメントの選択トラックがありません。");
        if(track.source.type==="vst3")throw new Error("VST3割り当て中のためPatchを適用できません。先に内蔵音源へ切り替えてください。");
        document.getElementById("trackInternalSourceBtn")?.click();
        if(!window.multitrackProject.applyTrackPatch?.(track.id,patch))throw new Error("選択トラックに適用できません。フリーズ状態を確認してください。");
        status.textContent=`「${item.name}」を選択中のトラックへ適用しました。`;
      }else{
        stopSample?.({announce:false});
        generatedPatch=clone(patch);engine.setPatch(validatePatch(patch));currentPatch=engine.patch;
        nameInput.value=item.name;status.textContent=`「${item.name}」を現在の音色へ適用しました。Step 3の試聴とStep 4の録音再生に使えます。`;
      }
    }catch(error){status.textContent=`適用できませんでした: ${error.message||error}`;}
  }
  function render(){
    list.replaceChildren();
    if(!entries.length){list.textContent="保存音色はまだありません。Step 1で音色を作成・調整して保存してください。";return;}
    for(const item of entries){
      const row=document.createElement("article");row.className="saved-patch-row";
      const info=document.createElement("div"),title=document.createElement("strong"),detail=document.createElement("small");
      title.textContent=item.name;detail.textContent=`${item.patch.engine_type.toUpperCase()} · ${item.patch.instrument_model} · ${item.patch.name}`;info.append(title,detail);
      const controls=document.createElement("div");controls.className="saved-patch-actions";
      const current=document.createElement("button");current.type="button";current.textContent="音源・試聴・録音に適用";current.title="現在音色へ適用し、Step 3の試聴とStep 4の録音再生で使います";current.addEventListener("click",()=>apply(item,"current"));
      const track=document.createElement("button");track.type="button";track.textContent="選択トラックへ適用";track.title="Step 2のアレンジメントで選択中のトラックへ適用します";track.addEventListener("click",()=>apply(item,"track"));
      const remove=document.createElement("button");remove.type="button";remove.textContent="削除";remove.setAttribute("aria-label",`${item.name}を削除`);remove.addEventListener("click",()=>{entries=entries.filter(entry=>entry.id!==item.id);persist();render();});
      controls.append(current,track,remove);row.append(info,controls);list.append(row);
    }
  }
  document.getElementById("saveCurrentPatchBtn").addEventListener("click",()=>{
    try{
      const patch=normalize(engine.patch||currentPatch),name=String(nameInput.value||patch.name||"保存音色").trim().slice(0,80)||"保存音色";
      const duplicate=entries.find(entry=>entry.name===name);
      if(duplicate){duplicate.patch=clone(patch);duplicate.name=name;status.textContent=`「${name}」を更新しました。`;}
      else{if(entries.length>=MAX_PATCHES){status.textContent=`保存上限（${MAX_PATCHES}音色）です。不要な音色を削除してください。`;return;}entries.unshift({id:makeId(),name,patch:clone(patch)});}
      if(persist())render();
    }catch(error){status.textContent=`保存できませんでした: ${error.message||error}`;}
  });
  window.savedPatchLibrary={list:()=>entries.map(item=>({id:item.id,name:item.name,patch:clone(item.patch)})),apply:(id,target="current")=>{const item=entries.find(entry=>entry.id===id);if(item)apply(item,target);return Boolean(item);},refresh:render};
  render();
})();
