"use strict";

// v0.10.1 live performance range + PC-key recorder.
// The octave selector changes the actual MIDI note sent from the live keyboard, so the
// onscreen key labels, recorded piano-roll and audible register stay aligned. Drum notes are
// never transposed. Recording remains note-event only; no audio samples are captured.
(() => {
  const recordBtn=document.getElementById("keyboardRecordBtn");
  const stopBtn=document.getElementById("keyboardRecordStopBtn");
  const playBtn=document.getElementById("keyboardRecordPlayBtn");
  const clearBtn=document.getElementById("keyboardRecordClearBtn");
  const status=document.getElementById("keyboardRecordStatus");
  const roll=document.getElementById("keyboardRecordingRoll");
  if(!recordBtn||!stopBtn||!playBtn||!clearBtn||!status||!roll)return;

  const MAX_NOTES=512;
  const MAX_DURATION_MS=120000;
  const NOTE_NAMES=["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
  const baseCurrentKeyMap=currentKeyMap;
  let octaveMode="auto",lastRenderedShift=null;
  let recording=false,recordStartMs=0,recordTimer=0;
  let recorded=[],activeKeys=new Map();
  let playbackTimers=[],playbackActive=new Set(),playing=false;

  const now=()=>performance.now();
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  function noteName(note){const n=Math.round(clamp(note,0,127));return `${NOTE_NAMES[n%12]}${Math.floor(n/12)-1}`;}
  function isDrumPatch(){return Boolean(currentPatch&&currentPatch.engine_type==="drum");}
  function inferAutoOctave(){
    if(isDrumPatch())return 0;
    const model=String(currentPatch&&currentPatch.instrument_model||"");
    const text=`${currentPatch&&currentPatch.name||""} ${currentPatch&&currentPatch.prompt||""}`.toLowerCase();
    if(model==="fretless_bass")return-1;
    if(model==="spectral_resynth"&&/(bass|ベース|acid|アシッド|低音|低域)/i.test(text))return-1;
    return 0;
  }
  function performanceOctave(){return octaveMode==="auto"?inferAutoOctave():clamp(parseInt(octaveMode,10),-2,2);}

  currentKeyMap=function(){
    const map=baseCurrentKeyMap();
    if(isDrumPatch())return map;
    const semitones=performanceOctave()*12,out={};
    for(const[code,note]of Object.entries(map||{}))out[code]=clamp(Number(note)+semitones,0,127);
    return out;
  };

  function createOctaveControl(){
    const wrap=document.getElementById("keyboardWrap"),head=wrap&&wrap.querySelector(".keyboard-stage-head");if(!wrap||!head)return null;
    let control=document.getElementById("performanceOctaveControl");if(control)return control;
    control=document.createElement("div");control.id="performanceOctaveControl";control.style.cssText="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-left:auto;";
    const label=document.createElement("label");label.htmlFor="performanceOctaveSelect";label.textContent="演奏音域";label.style.cssText="font-size:.78rem;color:#aeb5ca;font-weight:700;";
    const select=document.createElement("select");select.id="performanceOctaveSelect";select.setAttribute("aria-label","ライブ鍵盤のオクターブ");select.style.cssText="min-height:36px;color:#eef1ff;background:#171b29;border:1px solid #3a405d;border-radius:10px;padding:5px 9px;";
    [["auto","自動（Bassは-1 Oct）"],["-2","-2 Oct"],["-1","-1 Oct"],["0","0 Oct"],["1","+1 Oct"],["2","+2 Oct"]].forEach(([value,text])=>select.append(new Option(text,value)));
    select.value=octaveMode;select.addEventListener("change",()=>{octaveMode=select.value;syncPerformanceSurface(true);});
    const range=document.createElement("span");range.id="performanceOctaveRange";range.style.cssText="font-size:.76rem;color:#9aa9ff;white-space:nowrap;";
    control.append(label,select,range);head.appendChild(control);return control;
  }

  function rebuildKeyboard(force=false){
    if(isDrumPatch())return;
    const shift=performanceOctave();if(!force&&lastRenderedShift===shift)return;lastRenderedShift=shift;
    const root=document.getElementById("keyboard"),black=new Set([1,3,6,8,10]);if(!root)return;root.innerHTML="";
    for(let baseNote=48;baseNote<=72;baseNote++){
      const note=clamp(baseNote+shift*12,0,127),pc=note%12,el=document.createElement("button");
      el.className=`key ${black.has(pc)?"black":"white"}`;el.dataset.note=note;el.type="button";
      const shortcut=Object.entries(SYNTH_KEY_MAP).find(([,mapped])=>Number(mapped)===baseNote)?.[0].replace("Key","")||"";
      el.innerHTML=`<span class="key-note-name">${noteName(note)}</span><span class="key-shortcut">${shortcut}</span>`;
      if(note%12===0)el.classList.add("octave-c");
      const pointerId=`range-p${note}`;
      const down=async e=>{e.preventDefault();if(typeof stopSample==="function")stopSample({announce:false});try{await engine.init();}catch(err){showError(err);return;}if(!held.has(pointerId)){held.add(pointerId);engine.noteOn(note,.86);}};
      const up=e=>{e.preventDefault();if(!held.has(pointerId))return;held.delete(pointerId);engine.noteOff(note);};
      el.addEventListener("pointerdown",down);el.addEventListener("pointerup",up);el.addEventListener("pointercancel",up);el.addEventListener("pointerleave",e=>{if(held.has(pointerId))up(e);});root.appendChild(el);
    }
    const range=document.getElementById("performanceOctaveRange");if(range)range.textContent=`${noteName(48+shift*12)} – ${noteName(72+shift*12)}`;
    const sub=document.querySelector("#keyboardWrap .keyboard-stage-sub");if(sub)sub.textContent=`マウス / PCキー / MIDI / VST3 · ${shift>=0?"+":""}${shift} Oct`;
  }
  function decorateKeyboard(){rebuildKeyboard(true);}

  function syncPerformanceSurface(force=false){
    const keyboardWrap=document.getElementById("keyboardWrap"),drumWrap=document.getElementById("drumKitWrap"),octave=createOctaveControl();
    if(isDrumPatch()){
      if(keyboardWrap)keyboardWrap.hidden=true;if(drumWrap)drumWrap.hidden=false;if(octave)octave.hidden=true;lastRenderedShift=null;
      const help=drumWrap&&drumWrap.querySelector(".keyboard-help");if(help)help.textContent="PCキー: A=Kick / S=Snare / D=Closed Hat / F=Open Hat / G/H/J=Toms / K=Crash / L=Ride。画面のPadもクリックできます。";
      return;
    }
    if(keyboardWrap)keyboardWrap.hidden=false;if(drumWrap)drumWrap.hidden=true;if(octave)octave.hidden=false;rebuildKeyboard(force);
  }

  const baseUpdateInstrumentSurface=updateInstrumentSurface;
  updateInstrumentSurface=function(){baseUpdateInstrumentSurface();syncPerformanceSurface();};

  function drumPadForCode(code){
    if(!isDrumPatch())return null;const map=baseCurrentKeyMap(),note=map&&map[code];
    return Number.isFinite(Number(note))?document.querySelector(`#drumKit .drum-pad[data-note="${Number(note)}"]`):null;
  }
  window.addEventListener("keydown",e=>{if(e.repeat)return;const pad=drumPadForCode(e.code);if(pad)pad.classList.add("active");});
  window.addEventListener("keyup",e=>{const pad=drumPadForCode(e.code);if(pad)pad.classList.remove("active");});

  function isEditableTarget(target){
    if(!target)return false;
    if(target.isContentEditable)return true;
    const tag=target.tagName;
    if(tag==="TEXTAREA"||tag==="SELECT")return true;
    if(tag!=="INPUT")return false;
    const type=String(target.type||"text").toLowerCase();
    return !["checkbox","radio","button","submit","reset"].includes(type);
  }
  function mapForEvent(code){
    if(typeof currentKeyMap!=="function")return null;
    const map=currentKeyMap();
    return map&&Object.prototype.hasOwnProperty.call(map,code)?Number(map[code]):null;
  }
  function elapsedMs(){return Math.min(MAX_DURATION_MS,Math.max(0,now()-recordStartMs));}
  function closeActiveKey(code,endMs){
    const item=activeKeys.get(code);if(!item)return;
    activeKeys.delete(code);
    const duration=Math.max(45,endMs-item.startMs);
    recorded.push({note:item.note,velocity:item.velocity,startMs:item.startMs,durationMs:duration});
    if(recorded.length>=MAX_NOTES)stopRecording("最大512ノートに達したため録音を停止しました。");
  }
  function stopPlayback(){
    for(const id of playbackTimers)clearTimeout(id);playbackTimers=[];
    for(const note of playbackActive){try{engine.noteOff(note);}catch(_){}}
    playbackActive.clear();playing=false;playBtn.disabled=!recorded.length;
  }
  function renderRoll(){
    roll.innerHTML="";
    if(!recorded.length){roll.classList.add("empty");roll.textContent="録音すると、ここに実際に発音した音域でピアノロール表示されます。";return;}
    roll.classList.remove("empty");
    const total=Math.max(500,...recorded.map(n=>n.startMs+n.durationMs));
    const notes=recorded.map(n=>n.note),min=Math.max(0,Math.min(...notes)-2),max=Math.min(127,Math.max(...notes)+2),span=Math.max(8,max-min+1);
    const grid=document.createElement("div");grid.className="recording-roll-grid";roll.appendChild(grid);
    for(const item of recorded){
      const block=document.createElement("div");block.className="recording-note";
      const left=item.startMs/total*100,width=Math.max(.7,item.durationMs/total*100),row=(item.note-min)/span*100;
      block.style.left=`${left}%`;block.style.width=`${Math.min(100-left,width)}%`;block.style.bottom=`${row}%`;block.style.height=`${Math.max(7,82/span)}%`;
      block.textContent=noteName(item.note);block.title=`${noteName(item.note)} · ${(item.startMs/1000).toFixed(2)}s · ${(item.durationMs/1000).toFixed(2)}s`;
      grid.appendChild(block);
    }
  }
  function updateStatus(prefix="録音データ"){
    if(!recorded.length){status.textContent=`PCキー A/W/S/E/D… の演奏をノートイベントとして録音できます。演奏音域: ${performanceOctave()>=0?"+":""}${performanceOctave()} Oct`;return;}
    const end=Math.max(...recorded.map(n=>n.startMs+n.durationMs));
    status.textContent=`${prefix}: ${recorded.length}ノート / ${(end/1000).toFixed(1)}秒`;
  }
  function startRecording(){
    stopPlayback();recorded=[];activeKeys.clear();recording=true;recordStartMs=now();
    clearTimeout(recordTimer);recordTimer=setTimeout(()=>stopRecording("最大120秒に達したため録音を停止しました。"),MAX_DURATION_MS);
    recordBtn.disabled=true;stopBtn.disabled=false;playBtn.disabled=true;clearBtn.disabled=true;
    status.textContent=`● 録音中… PCキーボードで演奏してください。現在 ${performanceOctave()>=0?"+":""}${performanceOctave()} Oct`;renderRoll();
  }
  function stopRecording(message="録音を停止しました。"){
    if(!recording)return;
    const end=elapsedMs();recording=false;clearTimeout(recordTimer);recordTimer=0;
    for(const code of [...activeKeys.keys()])closeActiveKey(code,end);
    activeKeys.clear();recordBtn.disabled=false;stopBtn.disabled=true;playBtn.disabled=!recorded.length;clearBtn.disabled=!recorded.length;
    renderRoll();updateStatus(message.replace(/。$/, ""));
  }
  async function playRecording(){
    if(!recorded.length||playing)return;
    try{await engine.init();}catch(err){status.textContent=`再生エラー: ${err.message||err}`;return;}
    if(typeof stopSample==="function")stopSample({announce:false});
    stopPlayback();playing=true;playBtn.disabled=true;status.textContent="▶ 録音した演奏を再生中…";
    const end=Math.max(...recorded.map(n=>n.startMs+n.durationMs));
    for(const item of recorded){
      playbackTimers.push(setTimeout(()=>{playbackActive.add(item.note);engine.noteOn(item.note,item.velocity);},item.startMs));
      playbackTimers.push(setTimeout(()=>{engine.noteOff(item.note);playbackActive.delete(item.note);},item.startMs+item.durationMs));
    }
    playbackTimers.push(setTimeout(()=>{playbackTimers=[];playbackActive.clear();playing=false;playBtn.disabled=false;updateStatus("再生完了");},end+120));
  }
  function clearRecording(){
    stopPlayback();recorded=[];activeKeys.clear();renderRoll();updateStatus();playBtn.disabled=true;clearBtn.disabled=true;
  }

  window.addEventListener("keydown",e=>{
    if(!recording||e.repeat||isEditableTarget(e.target)||isDrumPatch())return;
    const note=mapForEvent(e.code);if(note===null||activeKeys.has(e.code))return;
    activeKeys.set(e.code,{note,velocity:.84,startMs:elapsedMs()});
  });
  window.addEventListener("keyup",e=>{
    if(!recording||!activeKeys.has(e.code))return;
    closeActiveKey(e.code,elapsedMs());
  });

  recordBtn.addEventListener("click",startRecording);
  stopBtn.addEventListener("click",()=>stopRecording());
  playBtn.addEventListener("click",playRecording);
  clearBtn.addEventListener("click",clearRecording);
  window.addEventListener("beforeunload",()=>{clearTimeout(recordTimer);stopPlayback();});

  createOctaveControl();decorateKeyboard();syncPerformanceSurface(true);renderRoll();updateStatus();
  const eyebrow=document.querySelector(".eyebrow");if(eyebrow)eyebrow.textContent="v0.10.1 audio · PCM multi-sample resynthesis · live octave/drum pads";
  window.keyboardPerformanceRecorder={start:startRecording,stop:stopRecording,play:playRecording,clear:clearRecording,getNotes:()=>recorded.map(n=>({...n})),getPerformanceOctave:performanceOctave};
  window.performanceRangeRuntime={getOctave:performanceOctave,setMode:value=>{octaveMode=String(value);const select=document.getElementById("performanceOctaveSelect");if(select)select.value=octaveMode;syncPerformanceSurface(true);}};
})();