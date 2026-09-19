"use strict";

// PC-key performance recorder. Records note events only; no microphone/audio samples are captured.
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
  let recording=false,recordStartMs=0,recordTimer=0;
  let recorded=[],activeKeys=new Map();
  let playbackTimers=[],playbackActive=new Set(),playing=false;

  const now=()=>performance.now();
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  function noteName(note){const n=Math.round(clamp(note,0,127));return `${NOTE_NAMES[n%12]}${Math.floor(n/12)-1}`;}
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
  function decorateKeyboard(){
    document.querySelectorAll("#keyboard .key[data-note]").forEach(key=>{
      const note=Number(key.dataset.note),old=key.querySelector("span")?.textContent||"";
      key.innerHTML=`<span class="key-note-name">${noteName(note)}</span><span class="key-shortcut">${old}</span>`;
      if(note%12===0)key.classList.add("octave-c");
    });
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
    if(!recorded.length){roll.classList.add("empty");roll.textContent="録音すると、ここに演奏がピアノロール表示されます。";return;}
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
    if(!recorded.length){status.textContent="PCキー A/W/S/E/D… の演奏をノートイベントとして録音できます。";return;}
    const end=Math.max(...recorded.map(n=>n.startMs+n.durationMs));
    status.textContent=`${prefix}: ${recorded.length}ノート / ${(end/1000).toFixed(1)}秒`;
  }
  function startRecording(){
    stopPlayback();recorded=[];activeKeys.clear();recording=true;recordStartMs=now();
    clearTimeout(recordTimer);recordTimer=setTimeout(()=>stopRecording("最大120秒に達したため録音を停止しました。"),MAX_DURATION_MS);
    recordBtn.disabled=true;stopBtn.disabled=false;playBtn.disabled=true;clearBtn.disabled=true;
    status.textContent="● 録音中… A=ド / S=レ / D=ミ などPCキーボードで演奏してください。";renderRoll();
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
    if(!recording||e.repeat||isEditableTarget(e.target))return;
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

  decorateKeyboard();renderRoll();updateStatus();
  window.keyboardPerformanceRecorder={start:startRecording,stop:stopRecording,play:playRecording,clear:clearRecording,getNotes:()=>recorded.map(n=>({...n}))};
})();
