"use strict";

// v0.7.0 humming-to-note capture with automatic key/scale correction,
// automatic tempo/grid quantization and local SVG staff notation.
(() => {
  const MIN_FREQ_HZ=75,MAX_FREQ_HZ=1000,MIN_RMS=.012,MIN_CONFIDENCE=.72;
  const MAX_RECORDING_MS=120000,SILENCE_HOLD_MS=140,MIN_NOTE_MS=90,FRAME_INTERVAL_MS=42,MAX_CAPTURED_NOTES=512;
  const MAJOR=[0,2,4,5,7,9,11],MINOR=[0,2,3,5,7,8,10];
  const NOTE_NAMES=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const NATURAL_LETTERS={0:["C",0],1:["C",1],2:["D",0],3:["D",1],4:["E",0],5:["F",0],6:["F",1],7:["G",0],8:["G",1],9:["A",0],10:["A",1],11:["B",0]};

  const byId=id=>document.getElementById(id);
  const startBtn=byId("hummingStartBtn"),stopBtn=byId("hummingStopBtn"),playBtn=byId("hummingPlayBtn");
  const transferBtn=byId("hummingTransferBtn"),clearBtn=byId("hummingClearBtn"),bpmInput=byId("hummingBpm");
  const quantizeSelect=byId("hummingQuantize"),autoKey=byId("hummingAutoKey"),autoTiming=byId("hummingAutoTiming");
  const keyDisplay=byId("hummingKeyDisplay"),timingDisplay=byId("hummingTimingDisplay"),livePitch=byId("hummingLivePitch");
  const liveMeter=byId("hummingConfidence"),resultBox=byId("hummingResult"),status=byId("hummingStatus"),scoreSvg=byId("hummingScore");
  if(!startBtn||!stopBtn||!resultBox)return;

  let stream=null,mediaSource=null,analyser=null,timeData=null,rafId=0,recording=false,recordStartMs=0,lastAnalysisMs=0;
  let rawEvents=[],currentNote=null,pendingNote=null,pendingCount=0,pendingSinceMs=0,lastVoicedMs=0,renderedSteps=[],previewTimers=[];
  let detectedKey=null,detectedTiming=null;

  const clampLocal=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const midiToName=midi=>{const n=Math.round(midi);return `${NOTE_NAMES[((n%12)+12)%12]}${Math.floor(n/12)-1}`;};
  const hzToMidi=freq=>69+12*Math.log2(freq/440);
  const midiToHz=midi=>440*Math.pow(2,(midi-69)/12);
  const formatBeats=value=>Number(value.toFixed(3)).toString();

  function detectPitchYin(samples,sampleRate){
    let sumSquares=0;for(let i=0;i<samples.length;i++)sumSquares+=samples[i]*samples[i];
    const rms=Math.sqrt(sumSquares/samples.length);if(rms<MIN_RMS)return null;
    const minTau=Math.max(2,Math.floor(sampleRate/MAX_FREQ_HZ));
    const maxTau=Math.min(Math.floor(sampleRate/MIN_FREQ_HZ),Math.floor(samples.length/2)-2);if(maxTau<=minTau)return null;
    const diff=new Float32Array(maxTau+1);
    for(let tau=1;tau<=maxTau;tau++){let d=0;for(let i=0;i<samples.length-tau;i++){const delta=samples[i]-samples[i+tau];d+=delta*delta;}diff[tau]=d;}
    let running=0,bestTau=minTau,bestValue=1;const cmnd=new Float32Array(maxTau+1);
    for(let tau=1;tau<=maxTau;tau++){running+=diff[tau];cmnd[tau]=running>0?diff[tau]*tau/running:1;if(tau>=minTau&&cmnd[tau]<bestValue){bestValue=cmnd[tau];bestTau=tau;}}
    let tau=bestTau;for(let t=minTau+1;t<maxTau;t++){if(cmnd[t]<.16&&cmnd[t]<=cmnd[t-1]&&cmnd[t]<=cmnd[t+1]){tau=t;break;}}
    const confidence=clampLocal(1-cmnd[tau],0,1);if(confidence<MIN_CONFIDENCE)return null;
    let refined=tau;if(tau>1&&tau<maxTau){const a=cmnd[tau-1],b=cmnd[tau],c=cmnd[tau+1],denom=a-2*b+c;if(Math.abs(denom)>1e-9)refined=tau+.5*(a-c)/denom;}
    const frequency=sampleRate/refined;if(!Number.isFinite(frequency)||frequency<MIN_FREQ_HZ||frequency>MAX_FREQ_HZ)return null;
    return {frequency,confidence,rms};
  }

  function closeCurrentNote(endAbsMs){
    if(!currentNote)return;const endMs=Math.max(currentNote.startMs,endAbsMs-recordStartMs),durationMs=endMs-currentNote.startMs;
    if(durationMs>=MIN_NOTE_MS&&rawEvents.length<MAX_CAPTURED_NOTES)rawEvents.push({midi:currentNote.midi,startMs:currentNote.startMs,endMs,velocity:clampLocal(currentNote.velocitySum/Math.max(1,currentNote.frames),.05,1),confidence:clampLocal(currentNote.confidenceSum/Math.max(1,currentNote.frames),0,1)});
    currentNote=null;
  }
  function beginCurrentNote(midi,startAbsMs,velocity,confidence){currentNote={midi:Math.round(clampLocal(midi,0,127)),startMs:Math.max(0,startAbsMs-recordStartMs),velocitySum:velocity,confidenceSum:confidence,frames:1};lastVoicedMs=startAbsMs;}
  function processPitchFrame(pitch,nowMs){
    if(!pitch){livePitch.textContent="—";liveMeter.textContent="無音 / 未検出";pendingNote=null;pendingCount=0;if(currentNote&&nowMs-lastVoicedMs>=SILENCE_HOLD_MS)closeCurrentNote(lastVoicedMs);return;}
    const midiFloat=hzToMidi(pitch.frequency),rounded=Math.round(midiFloat),cents=Math.round((midiFloat-rounded)*100),velocity=clampLocal(.36+Math.max(0,pitch.rms-MIN_RMS)*7.5,.20,1);
    livePitch.textContent=`${midiToName(rounded)} · MIDI ${rounded} · ${pitch.frequency.toFixed(1)} Hz · ${cents>=0?"+":""}${cents} cent`;liveMeter.textContent=`検出信頼度 ${Math.round(pitch.confidence*100)}%`;lastVoicedMs=nowMs;
    if(currentNote&&Math.abs(midiFloat-currentNote.midi)<.62){currentNote.velocitySum+=velocity;currentNote.confidenceSum+=pitch.confidence;currentNote.frames++;pendingNote=null;pendingCount=0;return;}
    if(pendingNote===rounded)pendingCount++;else{pendingNote=rounded;pendingCount=1;pendingSinceMs=nowMs;}if(pendingCount<2)return;
    if(currentNote)closeCurrentNote(pendingSinceMs);beginCurrentNote(rounded,pendingSinceMs,velocity,pitch.confidence);pendingNote=null;pendingCount=0;
  }
  function analysisLoop(nowMs){if(!recording)return;if(nowMs-recordStartMs>=MAX_RECORDING_MS){stopRecording(true);return;}if(nowMs-lastAnalysisMs>=FRAME_INTERVAL_MS){lastAnalysisMs=nowMs;analyser.getFloatTimeDomainData(timeData);processPitchFrame(detectPitchYin(timeData,engine.ctx.sampleRate),performance.now());}rafId=requestAnimationFrame(analysisLoop);}
  function stopMicStream(){if(rafId){cancelAnimationFrame(rafId);rafId=0;}try{mediaSource?.disconnect();}catch(_){}try{analyser?.disconnect();}catch(_){}if(stream)for(const track of stream.getTracks())track.stop();stream=null;mediaSource=null;analyser=null;timeData=null;}

  function estimateKey(events){
    if(!events.length)return null;let best=null;
    for(const mode of ["major","minor"]){const intervals=mode==="major"?MAJOR:MINOR;for(let root=0;root<12;root++){
      const allowed=new Set(intervals.map(v=>(root+v)%12));let score=0,total=0;
      for(const event of events){const weight=Math.max(90,event.endMs-event.startMs)*(.55+.45*(event.confidence||.8)),pc=((event.midi%12)+12)%12;total+=weight;score+=allowed.has(pc)?weight:-weight*.85;if(pc===root)score+=weight*.28;if(pc===(root+7)%12)score+=weight*.08;}
      const firstPc=events[0].midi%12,lastPc=events[events.length-1].midi%12;if(firstPc===root)score+=total*.08;if(lastPc===root)score+=total*.12;
      if(!best||score>best.score)best={root,mode,intervals:[...intervals],score,confidence:total?clampLocal((score/total+1)/2,0,1):0};
    }}
    return best;
  }
  function snapMidiToScale(midi,key){if(!key)return midi;const allowed=new Set(key.intervals.map(v=>(key.root+v)%12));if(allowed.has(((midi%12)+12)%12))return midi;for(let distance=1;distance<=3;distance++){const down=midi-distance,up=midi+distance;if(allowed.has(((down%12)+12)%12))return down;if(allowed.has(((up%12)+12)%12))return up;}return midi;}

  function quantizeValue(beats,quantum){return Math.max(quantum,Math.round(beats/quantum)*quantum);}
  function estimateTiming(events){
    if(events.length<2)return {bpm:Math.round(clampLocal(bpmInput.value,40,240)),quantum:.25,score:0};
    const origin=events[0].startMs;const candidates=[.5,.25,.125];let best=null;
    for(let bpm=60;bpm<=180;bpm++){const beatMs=60000/bpm;for(const quantum of candidates){let error=0,weight=0;
      for(const event of events){const start=(event.startMs-origin)/beatMs,dur=Math.max(MIN_NOTE_MS,event.endMs-event.startMs)/beatMs;const qs=Math.round(start/quantum)*quantum,qd=Math.max(quantum,Math.round(dur/quantum)*quantum);const w=.5+.5*(event.confidence||.8);error+=(Math.abs(start-qs)+.7*Math.abs(dur-qd))*w;weight+=w;}
      const finePenalty=quantum===.125?.055:quantum===.25?.018:0;const tempoPenalty=Math.abs(bpm-110)/110*.012;const score=error/Math.max(1,weight)+finePenalty+tempoPenalty;if(!best||score<best.score)best={bpm,quantum,score};
    }}return best;
  }
  function correctedEvents(){const key=(autoKey?.checked!==false)?detectedKey:null;return rawEvents.map(e=>({...e,originalMidi:e.midi,midi:snapMidiToScale(e.midi,key)}));}
  function buildQuantizedSteps(){
    let bpm=Math.round(clampLocal(bpmInput.value,40,240)),quantum=clampLocal(quantizeSelect.value,.125,.5);
    if(autoTiming?.checked!==false&&detectedTiming){bpm=detectedTiming.bpm;quantum=detectedTiming.quantum;bpmInput.value=bpm;quantizeSelect.value=String(quantum);}
    const beatMs=60000/bpm,events=correctedEvents().sort((a,b)=>a.startMs-b.startMs),steps=[];if(!events.length)return steps;const origin=events[0].startMs;let cursor=0;
    for(const event of events){const start=Math.max(0,event.startMs-origin),gapMs=start-cursor;if(gapMs>beatMs*quantum*.55){const restBeats=quantizeValue(gapMs/beatMs,quantum);steps.push({notes:[],beats:restBeats,velocity:.5,rest:true});cursor+=restBeats*beatMs;}
      const beats=quantizeValue(Math.max(MIN_NOTE_MS,event.endMs-event.startMs)/beatMs,quantum);steps.push({notes:[event.midi],beats,velocity:clampLocal(event.velocity,.05,1),confidence:event.confidence,originalMidi:event.originalMidi});cursor=Math.max(cursor,start)+beats*beatMs;}
    return steps.slice(0,MAX_CAPTURED_NOTES);
  }

  function staffY(midi,clef,baseY){const pc=((midi%12)+12)%12,[letter]=NATURAL_LETTERS[pc],letterIndex={C:0,D:1,E:2,F:3,G:4,A:5,B:6}[letter],oct=Math.floor(midi/12)-1,diatonic=oct*7+letterIndex,bottom=clef==="bass"?(2*7+4):(4*7+2);return baseY-(diatonic-bottom)*5;}
  function renderScore(){
    if(!scoreSvg)return;while(scoreSvg.firstChild)scoreSvg.removeChild(scoreSvg.firstChild);const notes=renderedSteps.filter(s=>!s.rest&&s.notes.length);if(!notes.length){scoreSvg.setAttribute("viewBox","0 0 900 120");return;}
    const avg=notes.reduce((s,n)=>s+n.notes[0],0)/notes.length,clef=avg<60?"bass":"treble",beatsPerSystem=16,left=70,beatWidth=47,systemH=130,totalBeats=renderedSteps.reduce((s,x)=>s+x.beats,0),systems=Math.max(1,Math.ceil(totalBeats/beatsPerSystem)),height=systems*systemH+40;
    scoreSvg.setAttribute("viewBox",`0 0 900 ${height}`);const NS="http://www.w3.org/2000/svg";const add=(name,attrs,text)=>{const el=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs||{}))el.setAttribute(k,String(v));if(text!=null)el.textContent=text;scoreSvg.appendChild(el);return el;};
    add("text",{x:18,y:22,"font-size":14,"font-weight":700},`${keyLabel(detectedKey)} · ♩=${bpmInput.value} · ${clef==="bass"?"Bass":"Treble"}`);
    for(let sys=0;sys<systems;sys++){const top=45+sys*systemH,bottom=top+40;for(let i=0;i<5;i++)add("line",{x1:left,x2:850,y1:top+i*10,y2:top+i*10,stroke:"currentColor","stroke-width":1});add("text",{x:left-45,y:top+34,"font-size":36},clef==="bass"?"𝄢":"𝄞");for(let b=0;b<=16;b+=4){add("line",{x1:left+b*beatWidth,x2:left+b*beatWidth,y1:top,y2:bottom,stroke:"currentColor","stroke-width":b===0?1:1.5});}}
    let beatPos=0;for(const step of renderedSteps){const sys=Math.floor(beatPos/beatsPerSystem),local=beatPos%beatsPerSystem,top=45+sys*systemH,x=left+local*beatWidth+12;if(step.rest){add("text",{x,y:top+25,"font-size":20},"𝄽");}else{const midi=step.notes[0],y=staffY(midi,clef,top+40),open=step.beats>=2;add("ellipse",{cx:x,cy:y,rx:6,ry:4,fill:open?"none":"currentColor",stroke:"currentColor","stroke-width":1.5,transform:`rotate(-18 ${x} ${y})`});if(step.beats<4)add("line",{x1:x+5,x2:x+5,y1:y,y2:y-28,stroke:"currentColor","stroke-width":1.5});if(step.beats<=.5)add("path",{d:`M ${x+5} ${y-28} q 16 7 4 18`,fill:"none",stroke:"currentColor","stroke-width":1.5});const accidental=NATURAL_LETTERS[((midi%12)+12)%12][1];if(accidental)add("text",{x:x-17,y:y+5,"font-size":16},"♯");}
      beatPos+=step.beats;}
  }
  function keyLabel(key){return key?`${NOTE_NAMES[key.root]} ${key.mode==="major"?"Major":"Minor"}`:"Key —";}

  function renderResult(){
    detectedKey=estimateKey(rawEvents);detectedTiming=estimateTiming(rawEvents);renderedSteps=buildQuantizedSteps();
    resultBox.value=renderedSteps.map(step=>step.rest?`R | ${formatBeats(step.beats)} | 0.50`:`${midiToName(step.notes[0])} | ${formatBeats(step.beats)} | ${step.velocity.toFixed(2)}`).join("\n");
    const corrected=renderedSteps.filter(s=>!s.rest&&s.originalMidi!=null&&s.originalMidi!==s.notes[0]).length,noteCount=renderedSteps.filter(s=>!s.rest).length;
    if(keyDisplay)keyDisplay.textContent=detectedKey?`${keyLabel(detectedKey)}（${corrected}音補正）`:"—";
    if(timingDisplay)timingDisplay.textContent=detectedTiming?`BPM ${detectedTiming.bpm} / ${detectedTiming.quantum===.5?"1/8":detectedTiming.quantum===.25?"1/16":"1/32"}`:"—";
    playBtn.disabled=noteCount===0;transferBtn.disabled=noteCount===0;clearBtn.disabled=noteCount===0;renderScore();status.textContent=noteCount?`${noteCount}ノートを検出し、キー/スケールとタイミングを自動補正しました。`:"有効なメロディーを検出できませんでした。";
  }

  async function startRecording(){if(recording)return;if(!navigator.mediaDevices?.getUserMedia){status.textContent="このブラウザではマイク入力を利用できません。";return;}stopPreview();stopSample({announce:false});try{await engine.init();stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:false,autoGainControl:false},video:false});mediaSource=engine.ctx.createMediaStreamSource(stream);analyser=engine.ctx.createAnalyser();analyser.fftSize=4096;analyser.smoothingTimeConstant=0;timeData=new Float32Array(analyser.fftSize);mediaSource.connect(analyser);rawEvents=[];renderedSteps=[];currentNote=null;pendingNote=null;pendingCount=0;detectedKey=null;detectedTiming=null;recordStartMs=performance.now();lastAnalysisMs=0;lastVoicedMs=recordStartMs;recording=true;startBtn.disabled=true;stopBtn.disabled=false;playBtn.disabled=true;transferBtn.disabled=true;clearBtn.disabled=true;resultBox.value="";if(scoreSvg)while(scoreSvg.firstChild)scoreSvg.removeChild(scoreSvg.firstChild);status.textContent="録音中… 単音で鼻歌してください。停止後にキーとリズムを自動補正します。";livePitch.textContent="検出中…";liveMeter.textContent="";rafId=requestAnimationFrame(analysisLoop);}catch(err){stopMicStream();recording=false;startBtn.disabled=false;stopBtn.disabled=true;status.textContent=`マイクを開始できませんでした: ${err?.message||err}`;}}
  function stopRecording(autoStopped=false){if(!recording)return;recording=false;const now=performance.now();if(currentNote)closeCurrentNote(Math.min(now,lastVoicedMs+SILENCE_HOLD_MS));stopMicStream();startBtn.disabled=false;stopBtn.disabled=true;livePitch.textContent="—";liveMeter.textContent="";renderResult();if(autoStopped&&rawEvents.length)status.textContent=`最大録音時間2分で停止し、${rawEvents.length}ノートを自動補正しました。`;}
  function stopPreview(){for(const id of previewTimers)clearTimeout(id);previewTimers=[];}
  async function previewResult(){stopPreview();stopSample({announce:false});if(!renderedSteps.length)renderResult();if(!renderedSteps.length)return;try{await engine.init();}catch(err){status.textContent=`試聴を開始できませんでした: ${err?.message||err}`;return;}const beatMs=60000/Math.round(clampLocal(bpmInput.value,40,240));let cursor=80;status.textContent=`補正済み鼻歌メロディーを「${currentPatch.name}」で試聴中…`;for(const step of renderedSteps){const duration=Math.max(60,step.beats*beatMs);if(!step.rest&&step.notes.length){const note=step.notes[0],velocity=step.velocity;previewTimers.push(setTimeout(()=>engine.noteOn(note,velocity),cursor));previewTimers.push(setTimeout(()=>engine.noteOff(note),cursor+Math.max(55,duration*.82)));}cursor+=duration;}previewTimers.push(setTimeout(()=>{previewTimers=[];status.textContent="試聴が完了しました。";},cursor+250));}
  function transferToCustomEditor(){if(!resultBox.value.trim())return;const name=byId("customSampleName"),bpm=byId("customSampleBpm"),steps=byId("customSampleSteps");if(!name||!bpm||!steps)return;if(!name.value.trim())name.value="鼻歌メロディー";bpm.value=Math.round(clampLocal(bpmInput.value,40,240));steps.value=resultBox.value;const details=document.querySelector(".custom-sample-editor");if(details)details.open=true;steps.scrollIntoView({behavior:"smooth",block:"center"});status.textContent="補正済みメロディーを登録フレーズ欄へ取り込みました。";}
  function clearResult(){stopPreview();rawEvents=[];renderedSteps=[];currentNote=null;pendingNote=null;pendingCount=0;detectedKey=null;detectedTiming=null;resultBox.value="";playBtn.disabled=true;transferBtn.disabled=true;clearBtn.disabled=true;livePitch.textContent="—";liveMeter.textContent="";if(keyDisplay)keyDisplay.textContent="—";if(timingDisplay)timingDisplay.textContent="—";if(scoreSvg)while(scoreSvg.firstChild)scoreSvg.removeChild(scoreSvg.firstChild);status.textContent="マイク待機中。";}

  startBtn.addEventListener("click",startRecording);stopBtn.addEventListener("click",()=>stopRecording(false));playBtn.addEventListener("click",previewResult);transferBtn.addEventListener("click",transferToCustomEditor);clearBtn.addEventListener("click",clearResult);
  bpmInput.addEventListener("change",()=>{if(rawEvents.length){if(autoTiming)autoTiming.checked=false;renderResult();}});quantizeSelect.addEventListener("change",()=>{if(rawEvents.length){if(autoTiming)autoTiming.checked=false;renderResult();}});
  autoKey?.addEventListener("change",()=>{if(rawEvents.length)renderResult();});autoTiming?.addEventListener("change",()=>{if(rawEvents.length)renderResult();});
  window.addEventListener("beforeunload",()=>{if(recording){recording=false;stopMicStream();}stopPreview();});
  window.hummingMelodyCapture={detectPitchYin,hzToMidi,midiToHz,midiToName,estimateKey,estimateTiming,snapMidiToScale,getRawEvents:()=>rawEvents.map(e=>({...e})),getSteps:()=>renderedSteps.map(step=>({...step,notes:[...(step.notes||[])]})),getKey:()=>detectedKey?{...detectedKey}:null,getTiming:()=>detectedTiming?{...detectedTiming}:null,renderScore,stop:()=>stopRecording(false)};
})();
