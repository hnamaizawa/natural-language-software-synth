"use strict";

// v0.6.0 humming-to-note capture.
// Microphone audio is analysed locally and is never recorded, uploaded, or persisted.
// The result is a bounded monophonic MIDI-like note-event sequence that can be auditioned
// through the existing engine.noteOn/noteOff contract or copied into the local custom phrase editor.
(() => {
  const MIN_FREQ_HZ=75;
  const MAX_FREQ_HZ=1000;
  const MIN_RMS=0.012;
  const MIN_CONFIDENCE=0.72;
  const MAX_RECORDING_MS=120000;
  const SILENCE_HOLD_MS=140;
  const MIN_NOTE_MS=90;
  const FRAME_INTERVAL_MS=42;
  const MAX_CAPTURED_NOTES=512;

  const startBtn=document.getElementById("hummingStartBtn");
  const stopBtn=document.getElementById("hummingStopBtn");
  const playBtn=document.getElementById("hummingPlayBtn");
  const transferBtn=document.getElementById("hummingTransferBtn");
  const clearBtn=document.getElementById("hummingClearBtn");
  const bpmInput=document.getElementById("hummingBpm");
  const quantizeSelect=document.getElementById("hummingQuantize");
  const livePitch=document.getElementById("hummingLivePitch");
  const liveMeter=document.getElementById("hummingConfidence");
  const resultBox=document.getElementById("hummingResult");
  const status=document.getElementById("hummingStatus");
  if(!startBtn||!stopBtn||!resultBox)return;

  let stream=null;
  let mediaSource=null;
  let analyser=null;
  let timeData=null;
  let rafId=0;
  let recording=false;
  let recordStartMs=0;
  let lastAnalysisMs=0;
  let rawEvents=[];
  let currentNote=null;
  let pendingNote=null;
  let pendingCount=0;
  let pendingSinceMs=0;
  let lastVoicedMs=0;
  let renderedSteps=[];
  let previewTimers=[];

  const clampLocal=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const noteNames=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

  function midiToName(midi){
    const n=Math.round(midi);
    return `${noteNames[((n%12)+12)%12]}${Math.floor(n/12)-1}`;
  }

  function hzToMidi(freq){
    return 69+12*Math.log2(freq/440);
  }

  function midiToHz(midi){
    return 440*Math.pow(2,(midi-69)/12);
  }

  function formatBeats(value){
    return Number(value.toFixed(3)).toString();
  }

  // YIN-style cumulative mean normalized difference detector.
  // It is intentionally monophonic: humming/whistling/single sung melody only.
  function detectPitchYin(samples,sampleRate){
    let sumSquares=0;
    for(let i=0;i<samples.length;i++)sumSquares+=samples[i]*samples[i];
    const rms=Math.sqrt(sumSquares/samples.length);
    if(rms<MIN_RMS)return null;

    const minTau=Math.max(2,Math.floor(sampleRate/MAX_FREQ_HZ));
    const maxTau=Math.min(Math.floor(sampleRate/MIN_FREQ_HZ),Math.floor(samples.length/2)-2);
    if(maxTau<=minTau)return null;
    const diff=new Float32Array(maxTau+1);
    for(let tau=1;tau<=maxTau;tau++){
      let d=0;
      const limit=samples.length-tau;
      for(let i=0;i<limit;i++){
        const delta=samples[i]-samples[i+tau];
        d+=delta*delta;
      }
      diff[tau]=d;
    }

    let running=0;
    const cmnd=new Float32Array(maxTau+1);
    let bestTau=minTau,bestValue=1;
    for(let tau=1;tau<=maxTau;tau++){
      running+=diff[tau];
      cmnd[tau]=running>0?diff[tau]*tau/running:1;
      if(tau>=minTau&&cmnd[tau]<bestValue){bestValue=cmnd[tau];bestTau=tau;}
    }

    const threshold=.16;
    let tau=bestTau;
    for(let t=minTau+1;t<maxTau;t++){
      if(cmnd[t]<threshold&&cmnd[t]<=cmnd[t-1]&&cmnd[t]<=cmnd[t+1]){tau=t;break;}
    }
    const confidence=clampLocal(1-cmnd[tau],0,1);
    if(confidence<MIN_CONFIDENCE)return null;

    let refined=tau;
    if(tau>1&&tau<maxTau){
      const a=cmnd[tau-1],b=cmnd[tau],c=cmnd[tau+1];
      const denom=(a-2*b+c);
      if(Math.abs(denom)>1e-9)refined=tau+.5*(a-c)/denom;
    }
    const frequency=sampleRate/refined;
    if(!Number.isFinite(frequency)||frequency<MIN_FREQ_HZ||frequency>MAX_FREQ_HZ)return null;
    return {frequency,confidence,rms};
  }

  function closeCurrentNote(endAbsMs){
    if(!currentNote)return;
    const endMs=Math.max(currentNote.startMs,endAbsMs-recordStartMs);
    const durationMs=endMs-currentNote.startMs;
    if(durationMs>=MIN_NOTE_MS&&rawEvents.length<MAX_CAPTURED_NOTES){
      rawEvents.push({
        midi:currentNote.midi,
        startMs:currentNote.startMs,
        endMs,
        velocity:clampLocal(currentNote.velocitySum/Math.max(1,currentNote.frames),.05,1),
        confidence:clampLocal(currentNote.confidenceSum/Math.max(1,currentNote.frames),0,1),
      });
    }
    currentNote=null;
  }

  function beginCurrentNote(midi,startAbsMs,velocity,confidence){
    currentNote={
      midi:Math.round(clampLocal(midi,0,127)),
      startMs:Math.max(0,startAbsMs-recordStartMs),
      velocitySum:velocity,
      confidenceSum:confidence,
      frames:1,
    };
    lastVoicedMs=startAbsMs;
  }

  function processPitchFrame(pitch,nowMs){
    if(!pitch){
      livePitch.textContent="—";
      liveMeter.textContent="無音 / 未検出";
      pendingNote=null;pendingCount=0;
      if(currentNote&&nowMs-lastVoicedMs>=SILENCE_HOLD_MS)closeCurrentNote(lastVoicedMs);
      return;
    }

    const midiFloat=hzToMidi(pitch.frequency);
    const rounded=Math.round(midiFloat);
    const cents=Math.round((midiFloat-rounded)*100);
    const velocity=clampLocal(.36+Math.max(0,pitch.rms-MIN_RMS)*7.5,.20,1);
    livePitch.textContent=`${midiToName(rounded)} · MIDI ${rounded} · ${pitch.frequency.toFixed(1)} Hz · ${cents>=0?"+":""}${cents} cent`;
    liveMeter.textContent=`検出信頼度 ${Math.round(pitch.confidence*100)}%`;
    lastVoicedMs=nowMs;

    if(currentNote&&Math.abs(midiFloat-currentNote.midi)<.62){
      currentNote.velocitySum+=velocity;
      currentNote.confidenceSum+=pitch.confidence;
      currentNote.frames++;
      pendingNote=null;pendingCount=0;
      return;
    }

    if(pendingNote===rounded){
      pendingCount++;
    }else{
      pendingNote=rounded;
      pendingCount=1;
      pendingSinceMs=nowMs;
    }
    if(pendingCount<2)return;

    if(currentNote)closeCurrentNote(pendingSinceMs);
    beginCurrentNote(rounded,pendingSinceMs,velocity,pitch.confidence);
    pendingNote=null;pendingCount=0;
  }

  function analysisLoop(nowMs){
    if(!recording)return;
    if(nowMs-recordStartMs>=MAX_RECORDING_MS){stopRecording(true);return;}
    if(nowMs-lastAnalysisMs>=FRAME_INTERVAL_MS){
      lastAnalysisMs=nowMs;
      analyser.getFloatTimeDomainData(timeData);
      processPitchFrame(detectPitchYin(timeData,engine.ctx.sampleRate),performance.now());
    }
    rafId=requestAnimationFrame(analysisLoop);
  }

  function stopMicStream(){
    if(rafId){cancelAnimationFrame(rafId);rafId=0;}
    try{mediaSource?.disconnect();}catch(_){}
    try{analyser?.disconnect();}catch(_){}
    if(stream){for(const track of stream.getTracks())track.stop();}
    stream=null;mediaSource=null;analyser=null;timeData=null;
  }

  function quantizeValue(beats,quantum){
    return Math.max(quantum,Math.round(beats/quantum)*quantum);
  }

  function buildQuantizedSteps(){
    const bpm=Math.round(clampLocal(bpmInput.value,40,240));
    bpmInput.value=bpm;
    const quantum=clampLocal(quantizeSelect.value,.125,.5);
    const beatMs=60000/bpm;
    const events=[...rawEvents].sort((a,b)=>a.startMs-b.startMs);
    const steps=[];
    if(!events.length)return steps;
    const origin=events[0].startMs;
    let cursor=0;
    for(const event of events){
      const start=Math.max(0,event.startMs-origin);
      const gapMs=start-cursor;
      if(gapMs>beatMs*quantum*.55){
        const restBeats=quantizeValue(gapMs/beatMs,quantum);
        steps.push({notes:[],beats:restBeats,velocity:.5,rest:true});
        cursor+=restBeats*beatMs;
      }
      const durationMs=Math.max(MIN_NOTE_MS,event.endMs-event.startMs);
      const beats=quantizeValue(durationMs/beatMs,quantum);
      steps.push({notes:[event.midi],beats,velocity:clampLocal(event.velocity,.05,1),confidence:event.confidence});
      cursor=Math.max(cursor,start)+beats*beatMs;
    }
    return steps.slice(0,MAX_CAPTURED_NOTES);
  }

  function renderResult(){
    renderedSteps=buildQuantizedSteps();
    resultBox.value=renderedSteps.map(step=>{
      if(step.rest)return `R | ${formatBeats(step.beats)} | 0.50`;
      return `${midiToName(step.notes[0])} | ${formatBeats(step.beats)} | ${step.velocity.toFixed(2)}`;
    }).join("\n");
    const noteCount=renderedSteps.filter(step=>!step.rest).length;
    playBtn.disabled=noteCount===0;
    transferBtn.disabled=noteCount===0;
    clearBtn.disabled=noteCount===0;
    status.textContent=noteCount?`${noteCount} ノートをMIDI相当データとして検出しました。必要ならBPM/量子化を変更できます。`:"有効なメロディーを検出できませんでした。もう少し一定の音量で単音を鼻歌してください。";
  }

  async function startRecording(){
    if(recording)return;
    if(!navigator.mediaDevices?.getUserMedia){
      status.textContent="このブラウザではマイク入力を利用できません。Chrome / Edge の localhost でお試しください。";
      return;
    }
    stopPreview();
    stopSample({announce:false});
    try{
      await engine.init();
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:false,autoGainControl:false},video:false});
      mediaSource=engine.ctx.createMediaStreamSource(stream);
      analyser=engine.ctx.createAnalyser();
      analyser.fftSize=4096;
      analyser.smoothingTimeConstant=0;
      timeData=new Float32Array(analyser.fftSize);
      mediaSource.connect(analyser); // analysis only; analyser is intentionally not connected to master/destination.
      rawEvents=[];renderedSteps=[];currentNote=null;pendingNote=null;pendingCount=0;
      recordStartMs=performance.now();lastAnalysisMs=0;lastVoicedMs=recordStartMs;
      recording=true;
      startBtn.disabled=true;stopBtn.disabled=false;playBtn.disabled=true;transferBtn.disabled=true;clearBtn.disabled=true;
      resultBox.value="";
      status.textContent="録音中… 単音で鼻歌してください。最大2分、音声そのものは保存しません。";
      livePitch.textContent="検出中…";liveMeter.textContent="";
      rafId=requestAnimationFrame(analysisLoop);
    }catch(err){
      stopMicStream();recording=false;startBtn.disabled=false;stopBtn.disabled=true;
      status.textContent=`マイクを開始できませんでした: ${err?.message||err}`;
    }
  }

  function stopRecording(autoStopped=false){
    if(!recording)return;
    recording=false;
    const now=performance.now();
    if(currentNote)closeCurrentNote(Math.min(now,lastVoicedMs+SILENCE_HOLD_MS));
    stopMicStream();
    startBtn.disabled=false;stopBtn.disabled=true;
    livePitch.textContent="—";liveMeter.textContent="";
    renderResult();
    if(autoStopped&&rawEvents.length)status.textContent=`最大録音時間2分に達したため停止しました。${rawEvents.length} ノートを検出しました。`;
  }

  function stopPreview(){
    for(const id of previewTimers)clearTimeout(id);
    previewTimers=[];
  }

  async function previewResult(){
    stopPreview();
    stopSample({announce:false});
    if(!renderedSteps.length)renderResult();
    if(!renderedSteps.length)return;
    try{await engine.init();}catch(err){status.textContent=`試聴を開始できませんでした: ${err?.message||err}`;return;}
    const bpm=Math.round(clampLocal(bpmInput.value,40,240));
    const beatMs=60000/bpm;
    let cursor=80;
    status.textContent=`鼻歌メロディーを「${currentPatch.name}」で試聴中…`;
    for(const step of renderedSteps){
      const duration=Math.max(60,step.beats*beatMs);
      if(!step.rest&&step.notes.length){
        const note=step.notes[0],velocity=step.velocity;
        previewTimers.push(setTimeout(()=>engine.noteOn(note,velocity),cursor));
        previewTimers.push(setTimeout(()=>engine.noteOff(note),cursor+Math.max(55,duration*.82)));
      }
      cursor+=duration;
    }
    previewTimers.push(setTimeout(()=>{previewTimers=[];status.textContent="鼻歌メロディーの試聴が完了しました。";},cursor+250));
  }

  function transferToCustomEditor(){
    if(!resultBox.value.trim())return;
    const name=document.getElementById("customSampleName");
    const bpm=document.getElementById("customSampleBpm");
    const steps=document.getElementById("customSampleSteps");
    if(!name||!bpm||!steps){status.textContent="登録フレーズ編集欄が見つかりません。";return;}
    if(!name.value.trim())name.value="鼻歌メロディー";
    bpm.value=Math.round(clampLocal(bpmInput.value,40,240));
    steps.value=resultBox.value;
    const details=document.querySelector(".custom-sample-editor");
    if(details)details.open=true;
    steps.scrollIntoView({behavior:"smooth",block:"center"});
    status.textContent="鼻歌メロディーを登録フレーズ欄へ取り込みました。「登録」を押すとlocalStorageへ保存されます。";
  }

  function clearResult(){
    stopPreview();rawEvents=[];renderedSteps=[];currentNote=null;pendingNote=null;pendingCount=0;
    resultBox.value="";playBtn.disabled=true;transferBtn.disabled=true;clearBtn.disabled=true;
    livePitch.textContent="—";liveMeter.textContent="";status.textContent="マイク待機中。";
  }

  startBtn.addEventListener("click",startRecording);
  stopBtn.addEventListener("click",()=>stopRecording(false));
  playBtn.addEventListener("click",previewResult);
  transferBtn.addEventListener("click",transferToCustomEditor);
  clearBtn.addEventListener("click",clearResult);
  bpmInput.addEventListener("change",()=>{if(rawEvents.length)renderResult();});
  quantizeSelect.addEventListener("change",()=>{if(rawEvents.length)renderResult();});
  window.addEventListener("beforeunload",()=>{if(recording){recording=false;stopMicStream();}stopPreview();});

  window.hummingMelodyCapture={
    detectPitchYin,
    hzToMidi,
    midiToHz,
    midiToName,
    getRawEvents:()=>rawEvents.map(e=>({...e})),
    getSteps:()=>renderedSteps.map(step=>({...step,notes:[...(step.notes||[])]})),
    stop:()=>stopRecording(false),
  };
})();
