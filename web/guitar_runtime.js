"use strict";

// v0.4.0 electric-guitar extension.
// Factory guitar PCM is generated locally from a deterministic plucked-string model.
// No third-party artist recordings or commercial sample libraries are embedded.
(() => {
  const GUITAR_ROOTS=Object.freeze([40,45,50,55,59,64,69,74]);
  const GUITAR_AMP_MODELS=new Set(["clean","crunch","high_gain","acoustic"]);
  const GUITAR_DEMO_STYLES=new Set(["rock","fusion","acoustic"]);
  const isGuitarPatch=p=>Boolean(p&&p.engine_type==="sampler"&&p.instrument_model==="electric_guitar");

  const GUITAR_PARAM_DEFS=[
    ["guitar_amp_model","Amp Model","select",["clean","crunch","high_gain","acoustic"]],
    ["guitar_amp_drive","Drive",0,1,.01],
    ["guitar_amp_tone","Amp Tone",0,1,.01],
    ["guitar_amp_presence","Presence",0,1,.01],
    ["guitar_cabinet_mix","Cabinet",0,1,.01],
    ["guitar_body_tone","Body Tone",0,1,.01],
    ["guitar_pick_mix","Pick Attack",0,1,.01],
    ["guitar_release_mix","Release Noise",0,1,.01],
    ["guitar_palm_mute","Palm Mute",0,1,.01],
    ["guitar_sustain","Sustain",.1,1,.01],
    ["guitar_chorus_mix","Chorus",0,.5,.01],
    ["master_gain","Master",.02,.35,.005]
  ];
  const GUITAR_PARAM_KEYS=new Set(GUITAR_PARAM_DEFS.map(d=>d[0]));

  const GUITAR_SAMPLE_PERFORMANCES=Object.freeze({
    guitar_rock:{label:"ロック・リフ",bpm:126,steps:[
      {notes:[40,47,52],beats:.75,gate:.64},{notes:[40],beats:.25,gate:.46},
      {notes:[43,50,55],beats:.5,gate:.62},{notes:[45,52,57],beats:.5,gate:.68},
      {notes:[40,47,52],beats:.5,gate:.58},{notes:[47,54,59],beats:.5,gate:.70},
      {notes:[45,52,57],beats:.5,gate:.62},{notes:[40,47,52],beats:1,gate:.78}
    ]},
    guitar_fusion:{label:"フュージョン・フレーズ",bpm:112,steps:[
      {notes:[52],beats:.5},{notes:[55],beats:.25},{notes:[59],beats:.25},
      {notes:[62],beats:.5},{notes:[64],beats:.5},{notes:[67],beats:.25},{notes:[66],beats:.25},
      {notes:[64],beats:.5},{notes:[59,64,67],beats:1},{notes:[57],beats:.25},{notes:[59],beats:.25},
      {notes:[62],beats:.5},{notes:[64],beats:1}
    ]},
    guitar_acoustic:{label:"アコースティック・アルペジオ",bpm:86,steps:[
      {notes:[40],beats:.5},{notes:[47],beats:.5},{notes:[52],beats:.5},{notes:[55],beats:.5},
      {notes:[45],beats:.5},{notes:[52],beats:.5},{notes:[57],beats:.5},{notes:[60],beats:.5},
      {notes:[43],beats:.5},{notes:[50],beats:.5},{notes:[55],beats:.5},{notes:[59],beats:.5},
      {notes:[40,47,52,55],beats:2,gate:.88}
    ]}
  });

  function validateGuitarExtras(raw){
    const p={...(raw||{})};
    const amp=String(p.guitar_amp_model||"clean").toLowerCase();
    const demo=String(p.guitar_demo_style||"fusion").toLowerCase();
    return {
      ...p,
      engine_type:"sampler",
      instrument_model:"electric_guitar",
      guitar_amp_model:GUITAR_AMP_MODELS.has(amp)?amp:"clean",
      guitar_demo_style:GUITAR_DEMO_STYLES.has(demo)?demo:"fusion",
      guitar_body_tone:clamp(p.guitar_body_tone??.68,0,1),
      guitar_pick_mix:clamp(p.guitar_pick_mix??.34,0,1),
      guitar_release_mix:clamp(p.guitar_release_mix??.14,0,1),
      guitar_palm_mute:clamp(p.guitar_palm_mute??.08,0,1),
      guitar_sustain:clamp(p.guitar_sustain??.72,.1,1),
      guitar_amp_drive:clamp(p.guitar_amp_drive??.18,0,1),
      guitar_amp_tone:clamp(p.guitar_amp_tone??.64,0,1),
      guitar_amp_presence:clamp(p.guitar_amp_presence??.58,0,1),
      guitar_cabinet_mix:clamp(p.guitar_cabinet_mix??.78,0,1),
      guitar_chorus_mix:clamp(p.guitar_chorus_mix??.08,0,.5),
      master_gain:clamp(p.master_gain??.22,.02,.35),
      max_polyphony:Math.round(clamp(p.max_polyphony??10,1,16))
    };
  }

  const baseValidatePatch=validatePatch;
  validatePatch=function(raw){
    const requested=Boolean(raw&&(raw.instrument_model==="electric_guitar"||raw.guitar_amp_model!==undefined));
    const p=baseValidatePatch(raw);
    return requested?validateGuitarExtras({...p,...raw}):p;
  };

  function nearestGuitarRoot(note){
    return GUITAR_ROOTS.reduce((best,root)=>Math.abs(root-note)<Math.abs(best-note)?root:best,GUITAR_ROOTS[0]);
  }

  function createFactoryGuitarPCM(root){
    const sr=engine.ctx.sampleRate,duration=2.8,length=Math.ceil(duration*sr);
    const buffer=engine.ctx.createBuffer(1,length,sr),data=buffer.getChannelData(0);
    const freq=midiFreq(root),period=Math.max(2,Math.round(sr/freq)),ring=new Float32Array(period);
    const noise=engine.seededNoise(4100+root);
    for(let i=0;i<period;i++){
      const pos=i/period;
      ring[i]=(noise()*.74+.18*Math.sin(Math.PI*pos)+.08*Math.sin(3*Math.PI*pos));
    }
    let bodyLP=0;
    for(let i=0;i<length;i++){
      const t=i/sr,idx=i%period,next=(idx+1)%period;
      const average=(ring[idx]+ring[next])*.5;
      const damping=.99725-(root-40)*.000008;
      ring[idx]=average*damping;
      bodyLP=bodyLP*.86+ring[idx]*.14;
      const resonance=.10*Math.sin(2*Math.PI*110*t)*Math.exp(-t/.75)+.06*Math.sin(2*Math.PI*220*t)*Math.exp(-t/.52);
      const pick=(t<.018?noise()*Math.exp(-t/.004)*.12:0);
      const envelope=(1-Math.exp(-t/.0018))*Math.exp(-t/(1.55+(74-root)*.015));
      data[i]=Math.tanh((ring[idx]*.80+bodyLP*.30+resonance+pick)*1.25)*envelope*.72;
    }
    return buffer;
  }

  function createFactoryGuitarNoisePCM(kind){
    const sr=engine.ctx.sampleRate,duration=kind==="pick"?.075:.16,length=Math.ceil(duration*sr);
    const buffer=engine.ctx.createBuffer(1,length,sr),data=buffer.getChannelData(0),noise=engine.seededNoise(kind==="pick"?8811:9922);
    let lp=0;
    for(let i=0;i<length;i++){
      const t=i/sr,n=noise();lp=lp*.72+n*.28;
      const decay=Math.exp(-t/(kind==="pick"?.012:.045));
      const scrape=Math.sin(2*Math.PI*(kind==="pick"?1900:720)*t)*Math.exp(-t/(kind==="pick"?.018:.07));
      data[i]=(n-lp)*decay*.52+scrape*.18;
    }
    return buffer;
  }

  engine.createFactoryGuitarPCM=createFactoryGuitarPCM;
  engine.ensureGuitarSamples=function(){
    if(!this.ctx)return;
    for(const root of GUITAR_ROOTS){const key=`guitar_${root}`;if(!this.sampleBuffers.has(key))this.sampleBuffers.set(key,createFactoryGuitarPCM(root));}
    if(!this.sampleBuffers.has("guitar_pick"))this.sampleBuffers.set("guitar_pick",createFactoryGuitarNoisePCM("pick"));
    if(!this.sampleBuffers.has("guitar_release"))this.sampleBuffers.set("guitar_release",createFactoryGuitarNoisePCM("release"));
  };

  function makeDistortionCurve(drive,model){
    const n=2048,curve=new Float32Array(n);
    const modelBoost=model==="high_gain"?1.85:model==="crunch"?1.32:model==="acoustic"?.35:1;
    const amount=clamp(drive*modelBoost,0,1);
    if(amount<.004){for(let i=0;i<n;i++)curve[i]=i*2/(n-1)-1;return curve;}
    const gain=1+amount*22,norm=Math.tanh(gain);
    for(let i=0;i<n;i++){const x=i*2/(n-1)-1;curve[i]=Math.tanh(x*gain)/norm;}
    return curve;
  }

  engine.playGuitarNoise=function(kind,now,gainValue){
    const buffer=this.sampleBuffers.get(`guitar_${kind}`);if(!buffer||gainValue<=.001)return;
    const source=this.ctx.createBufferSource(),hp=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
    source.buffer=buffer;hp.type="highpass";hp.frequency.value=kind==="pick"?850:320;gain.gain.value=gainValue;
    source.connect(hp);hp.connect(gain);gain.connect(this.master);source.start(now);
  };

  engine.playGuitarPCM=function(midiNote,velocity,whenSeconds){
    const note=clamp(Math.round(midiNote),0,127);this.limitVoices(note);this.ensureGuitarSamples();
    const p=validateGuitarExtras(this.patch),root=nearestGuitarRoot(note),buffer=this.sampleBuffers.get(`guitar_${root}`);if(!buffer)return;
    const now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0),vel=clamp(velocity,0,1),rate=Math.pow(2,(note-root)/12);
    const source=this.ctx.createBufferSource(),input=this.ctx.createGain(),hp=this.ctx.createBiquadFilter(),pre=this.ctx.createGain();
    const shaper=this.ctx.createWaveShaper(),body=this.ctx.createBiquadFilter(),tone=this.ctx.createBiquadFilter(),presence=this.ctx.createBiquadFilter();
    const cab=this.ctx.createBiquadFilter(),cabDry=this.ctx.createGain(),cabWet=this.ctx.createGain(),ampSum=this.ctx.createGain();
    const chorusDry=this.ctx.createGain(),chorusDelay=this.ctx.createDelay(.05),chorusWet=this.ctx.createGain(),voiceGain=this.ctx.createGain();
    source.buffer=buffer;source.playbackRate.value=clamp(rate,.35,3);
    hp.type="highpass";hp.frequency.value=p.guitar_amp_model==="acoustic"?55:72;
    const modelPre=p.guitar_amp_model==="high_gain"?2.8:p.guitar_amp_model==="crunch"?1.65:p.guitar_amp_model==="acoustic"?.78:.92;
    pre.gain.value=modelPre+p.guitar_amp_drive*3.4;
    shaper.curve=makeDistortionCurve(p.guitar_amp_drive,p.guitar_amp_model);shaper.oversample="2x";
    body.type="peaking";body.frequency.value=180;body.Q.value=.85;body.gain.value=-1+p.guitar_body_tone*5;
    tone.type="lowpass";
    const toneBase=p.guitar_amp_model==="high_gain"?1450:p.guitar_amp_model==="crunch"?1900:p.guitar_amp_model==="acoustic"?5200:3200;
    const toneSpan=p.guitar_amp_model==="acoustic"?9000:p.guitar_amp_model==="high_gain"?4700:6500;
    tone.frequency.value=clamp(toneBase+p.guitar_amp_tone*toneSpan,900,15000);tone.Q.value=.7;
    presence.type="highshelf";presence.frequency.value=2600;presence.gain.value=-3+p.guitar_amp_presence*8;
    cab.type="lowpass";const cabBase=p.guitar_amp_model==="acoustic"?12500:p.guitar_amp_model==="clean"?8600:p.guitar_amp_model==="crunch"?6500:5400;cab.frequency.value=cabBase;cab.Q.value=.72;
    cabDry.gain.value=1-p.guitar_cabinet_mix*.82;cabWet.gain.value=p.guitar_cabinet_mix;
    chorusDry.gain.value=1-p.guitar_chorus_mix;chorusWet.gain.value=p.guitar_chorus_mix;chorusDelay.delayTime.value=.014;
    voiceGain.gain.setValueAtTime(.0001,now);voiceGain.gain.exponentialRampToValueAtTime(Math.max(.02,vel*(.72+.28*p.guitar_sustain)),now+.004);
    if(p.guitar_palm_mute>.03)voiceGain.gain.setTargetAtTime(.0001,now+.045,.08+(1-p.guitar_palm_mute)*.62);

    source.connect(input);input.connect(hp);hp.connect(pre);pre.connect(shaper);shaper.connect(body);body.connect(tone);tone.connect(presence);
    presence.connect(cabDry);cabDry.connect(ampSum);presence.connect(cab);cab.connect(cabWet);cabWet.connect(ampSum);
    ampSum.connect(chorusDry);chorusDry.connect(voiceGain);ampSum.connect(chorusDelay);chorusDelay.connect(chorusWet);chorusWet.connect(voiceGain);voiceGain.connect(this.master);
    source.start(now);this.playGuitarNoise("pick",now,p.guitar_pick_mix*vel*.30);
    this.voices.set(this.voiceKey(note),{kind:"guitar",source,voiceGain});setPerformanceActive(note,true);
  };

  const baseNoteOn=engine.noteOn.bind(engine),baseNoteOff=engine.noteOff.bind(engine);
  engine.noteOn=function(midiNote,velocity=.85,whenSeconds=0){
    if(isGuitarPatch(this.patch)){this.playGuitarPCM(midiNote,velocity,whenSeconds);return;}
    return baseNoteOn(midiNote,velocity,whenSeconds);
  };
  engine.noteOff=function(midiNote,whenSeconds=0){
    const note=clamp(Math.round(midiNote),0,127),voice=this.voices.get(this.voiceKey(note));
    if(voice&&voice.kind==="guitar"){
      const now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0),p=validateGuitarExtras(this.patch);
      voice.voiceGain.gain.cancelScheduledValues(now);voice.voiceGain.gain.setTargetAtTime(.0001,now,.035);
      try{voice.source.stop(now+.20);}catch(_){}
      this.playGuitarNoise("release",now,p.guitar_release_mix*.24);this.voices.delete(this.voiceKey(note));setPerformanceActive(note,false);return;
    }
    return baseNoteOff(midiNote,whenSeconds);
  };

  const baseEngineDetail=engineDetail;
  engineDetail=function(p){
    if(isGuitarPatch(p)){const label={clean:"Clean",crunch:"Crunch",high_gain:"High Gain",acoustic:"Acoustic Clean"}[p.guitar_amp_model]||"Clean";return `PCM Multisample · Electric Guitar · ${label} Amp`;}
    return baseEngineDetail(p);
  };

  const baseUpdateInstrumentSurface=updateInstrumentSurface;
  updateInstrumentSurface=function(){
    baseUpdateInstrumentSurface();if(!isGuitarPatch(currentPatch))return;
    document.getElementById("keyboardWrap").hidden=false;document.getElementById("drumKitWrap").hidden=true;
    const select=document.getElementById("sampleSelect");select.innerHTML="";
    for(const [value,label] of [["guitar_rock","ロック・リフ"],["guitar_fusion","フュージョン・フレーズ"],["guitar_acoustic","アコースティック・アルペジオ"]]){
      const opt=document.createElement("option");opt.value=value;opt.textContent=label;select.appendChild(opt);
    }
    const preferred=`guitar_${GUITAR_DEMO_STYLES.has(currentPatch.guitar_demo_style)?currentPatch.guitar_demo_style:"fusion"}`;select.value=preferred;
    document.getElementById("sampleDescription").textContent="PCMギターをアンプ／キャビネット段へ通し、ロック・フュージョン・アコースティック調の演奏で確認できます。";
  };

  function guitarValue(key,value){
    if(key==="master_gain")return Number(value).toFixed(2);
    if(typeof value==="number"&&value>=0&&value<=1)return `${Math.round(value*100)}%`;
    return String(value);
  }
  const baseRenderParameters=renderParameters;
  renderParameters=function(){
    if(!isGuitarPatch(currentPatch))return baseRenderParameters();
    const root=document.getElementById("params");root.innerHTML="";
    for(const def of GUITAR_PARAM_DEFS){
      const [key,label,typeOrMin,max,step]=def,card=document.createElement("div");card.className="param-control";
      const header=document.createElement("div");header.className="param-control-head";header.innerHTML=`<span>${label}</span><output>${guitarValue(key,currentPatch[key])}</output>`;card.appendChild(header);
      if(typeOrMin==="select"){
        const select=document.createElement("select");for(const value of max){const opt=document.createElement("option");opt.value=value;opt.textContent=value;select.appendChild(opt);}select.value=currentPatch[key];select.addEventListener("change",()=>applyParam(key,select.value));card.appendChild(select);
      }else{
        const min=typeOrMin,value=Number(currentPatch[key]),dial=document.createElement("div");dial.className="param-dial";dial.setAttribute("aria-hidden","true");
        const pct=clamp((value-min)/(max-min),0,1);dial.style.setProperty("--pct",`${pct*75}%`);dial.style.setProperty("--dial-ratio",String(pct));card.appendChild(dial);
        const input=document.createElement("input");input.type="range";input.min=min;input.max=max;input.step=step;input.value=value;input.dataset.param=key;
        input.addEventListener("input",()=>{applyParam(key,Number(input.value),false);const ratio=clamp((Number(input.value)-min)/(max-min),0,1);dial.style.setProperty("--pct",`${ratio*75}%`);dial.style.setProperty("--dial-ratio",String(ratio));header.querySelector("output").textContent=guitarValue(key,Number(input.value));});
        input.addEventListener("change",()=>renderParameters());card.appendChild(input);
      }
      root.appendChild(card);
    }
  };

  const baseApplyParam=applyParam;
  applyParam=function(key,value,rerender=true){
    if(!isGuitarPatch(currentPatch)||!GUITAR_PARAM_KEYS.has(key))return baseApplyParam(key,value,rerender);
    engine.setPatchWithRender(validateGuitarExtras({...currentPatch,[key]:value}),false);currentPatch=engine.patch;
    if(rerender)renderParameters();document.getElementById("status").textContent=`${key} を調整しました。`;
  };

  const baseRenderPatch=renderPatch;
  renderPatch=function(){
    baseRenderPatch();if(isGuitarPatch(currentPatch))document.getElementById("engineBadge").textContent="GUITAR";
  };

  async function playGuitarSample(){
    stopSample({announce:false});const perf=GUITAR_SAMPLE_PERFORMANCES[document.getElementById("sampleSelect").value]||GUITAR_SAMPLE_PERFORMANCES.guitar_fusion;
    try{await engine.init();}catch(err){showError(err);return;}
    const runId=sampleRunId,beatMs=60000/perf.bpm;let cursor=80;setSamplePlaying(true);
    document.getElementById("status").textContent=`${perf.label}を「${currentPatch.name}」でサンプル演奏中…`;
    for(const step of perf.steps){
      const duration=Math.max(70,step.beats*beatMs),gate=Math.max(55,duration*(step.gate??.78)),events=(step.notes||[]).map(note=>({note,velocity:.84}));
      sampleTimers.push(setTimeout(()=>{if(runId!==sampleRunId)return;for(const e of events){sampleActiveNotes.add(e.note);engine.noteOn(e.note,e.velocity);}},cursor));
      sampleTimers.push(setTimeout(()=>{if(runId!==sampleRunId)return;for(const e of events){engine.noteOff(e.note);sampleActiveNotes.delete(e.note);}},cursor+gate));cursor+=duration;
    }
    sampleTimers.push(setTimeout(()=>{if(runId!==sampleRunId)return;sampleActiveNotes.clear();sampleTimers=[];setSamplePlaying(false);document.getElementById("status").textContent=`サンプル演奏完了 · ${perf.label}`;},cursor+650));
  }

  document.getElementById("samplePlayBtn").addEventListener("click",e=>{
    if(!isGuitarPatch(currentPatch))return;e.preventDefault();e.stopImmediatePropagation();playGuitarSample();
  },true);
})();
