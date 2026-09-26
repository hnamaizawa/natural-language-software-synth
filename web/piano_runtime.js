"use strict";

// v0.5.0 grand-piano extension.
// Factory piano PCM is generated locally from deterministic string/hammer models.
// No third-party piano recordings are embedded and no additional AudioContext is created.
(() => {
  const PIANO_ROOTS=Object.freeze([36,43,48,55,60,67,72,79,84]);
  const isPianoPatch=p=>Boolean(p&&p.engine_type==="sampler"&&p.instrument_model==="grand_piano");
  const PIANO_PARAM_DEFS=[
    ["piano_tone","Tone",0,1,.01],
    ["piano_hammer_mix","Hammer",0,1,.01],
    ["piano_resonance","Resonance",0,1,.01],
    ["piano_damper_noise","Damper Noise",0,1,.01],
    ["piano_softness","Softness",0,1,.01],
    ["piano_sustain","Sustain",.2,1,.01],
    ["piano_velocity_curve","Velocity Curve",.5,2,.05],
    ["piano_room_mix","Room",0,.5,.01],
    ["master_gain","Master",.02,.35,.005]
  ];
  const PIANO_PARAM_KEYS=new Set(PIANO_PARAM_DEFS.map(d=>d[0]));

  function validatePianoExtras(raw){
    const p={...(raw||{})};
    return {
      ...p,
      engine_type:"sampler",
      instrument_model:"grand_piano",
      piano_tone:clamp(p.piano_tone??.72,0,1),
      piano_hammer_mix:clamp(p.piano_hammer_mix??.48,0,1),
      piano_resonance:clamp(p.piano_resonance??.58,0,1),
      piano_damper_noise:clamp(p.piano_damper_noise??.16,0,1),
      piano_softness:clamp(p.piano_softness??.18,0,1),
      piano_sustain:clamp(p.piano_sustain??.82,.2,1),
      piano_velocity_curve:clamp(p.piano_velocity_curve??1.10,.5,2),
      piano_room_mix:clamp(p.piano_room_mix??.14,0,.5),
      master_gain:clamp(p.master_gain??.21,.02,.35),
      max_polyphony:Math.round(clamp(p.max_polyphony??16,1,16))
    };
  }

  const baseValidatePatch=validatePatch;
  validatePatch=function(raw){
    const requested=Boolean(raw&&raw.instrument_model==="grand_piano");
    const p=baseValidatePatch(raw);
    return requested?validatePianoExtras({...p,...raw}):p;
  };

  function nearestPianoRoot(note){
    return PIANO_ROOTS.reduce((best,root)=>Math.abs(root-note)<Math.abs(best-note)?root:best,PIANO_ROOTS[0]);
  }

  function createFactoryPianoPCM(root){
    const sr=engine.ctx.sampleRate;
    const duration=clamp(5.4-(root-36)*.025,3.8,5.4);
    const length=Math.ceil(duration*sr),buffer=engine.ctx.createBuffer(1,length,sr),data=buffer.getChannelData(0);
    const f=midiFreq(root),noise=engine.seededNoise(12000+root),inharmonicity=.00010+Math.max(0,root-48)*.0000025;
    const baseDecay=3.9-Math.max(0,root-48)*.025;
    for(let i=0;i<length;i++){
      const t=i/sr,attack=1-Math.exp(-t/.0018);let y=0;
      for(let h=1;h<=7;h++){
        const partial=f*h*Math.sqrt(1+inharmonicity*h*h),amp=Math.pow(h,-1.22);
        const decay=Math.exp(-t/Math.max(.35,baseDecay/(1+.23*(h-1))));
        const detune=h<=3?.00032:0;
        const phase=2*Math.PI*partial*t;
        const stringPair=detune?(.52*Math.sin(phase*(1-detune))+.48*Math.sin(phase*(1+detune))):Math.sin(phase);
        y+=amp*decay*stringPair;
      }
      const soundboard=(.07*Math.sin(2*Math.PI*110*t)+.045*Math.sin(2*Math.PI*220*t)+.025*Math.sin(2*Math.PI*330*t))*Math.exp(-t/2.6);
      const hammer=t<.024?(noise()*.10+.06*Math.sin(2*Math.PI*1850*t))*Math.exp(-t/.0065):0;
      data[i]=Math.tanh((y*.56+soundboard+hammer)*attack*1.05)*.72;
    }
    return buffer;
  }

  function createPianoNoise(kind){
    const sr=engine.ctx.sampleRate,duration=kind==="hammer"?.075:.18,length=Math.ceil(duration*sr);
    const buffer=engine.ctx.createBuffer(1,length,sr),data=buffer.getChannelData(0),noise=engine.seededNoise(kind==="hammer"?15151:16161);
    let lp=0;
    for(let i=0;i<length;i++){
      const t=i/sr,n=noise();lp=lp*.78+n*.22;
      const decay=Math.exp(-t/(kind==="hammer"?.010:.050));
      const body=Math.sin(2*Math.PI*(kind==="hammer"?2100:420)*t)*Math.exp(-t/(kind==="hammer"?.014:.07));
      data[i]=((n-lp)*.58+body*.20)*decay;
    }
    return buffer;
  }

  engine.ensurePianoSamples=function(root){
    if(!this.ctx)return;
    const key=`piano_${root}`;
    if(!this.sampleBuffers.has(key))this.sampleBuffers.set(key,createFactoryPianoPCM(root));
    if(!this.sampleBuffers.has("piano_hammer"))this.sampleBuffers.set("piano_hammer",createPianoNoise("hammer"));
    if(!this.sampleBuffers.has("piano_damper"))this.sampleBuffers.set("piano_damper",createPianoNoise("damper"));
  };
  engine.preparePianoNotes=function(notes){for(const note of notes)this.ensurePianoSamples(nearestPianoRoot(note));};

  engine.playPianoNoise=function(kind,now,gainValue){
    const buffer=this.sampleBuffers.get(`piano_${kind}`);if(!buffer||gainValue<=.001)return;
    const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
    source.buffer=buffer;filter.type=kind==="hammer"?"highpass":"bandpass";filter.frequency.value=kind==="hammer"?950:520;filter.Q.value=kind==="hammer"?.65:1.1;
    gain.gain.value=gainValue;source.connect(filter);filter.connect(gain);gain.connect(this.master);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start(now);
  };

  engine.playGrandPianoPCM=function(midiNote,velocity,whenSeconds){
    const note=clamp(Math.round(midiNote),0,127);this.limitVoices(note);
    const root=nearestPianoRoot(note);this.ensurePianoSamples(root);
    const buffer=this.sampleBuffers.get(`piano_${root}`);if(!buffer)return;
    const p=validatePianoExtras(this.patch),now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0);
    const vel=Math.pow(clamp(velocity,0,1),p.piano_velocity_curve),rate=Math.pow(2,(note-root)/12);
    const source=this.ctx.createBufferSource(),tone=this.ctx.createBiquadFilter(),body=this.ctx.createBiquadFilter(),voiceGain=this.ctx.createGain();
    const roomDelay=this.ctx.createDelay(.12),roomFilter=this.ctx.createBiquadFilter(),roomGain=this.ctx.createGain();
    source.buffer=buffer;source.playbackRate.value=clamp(rate,.35,3);
    tone.type="lowpass";tone.frequency.value=2200+p.piano_tone*11500-p.piano_softness*2800;tone.Q.value=.65;
    body.type="peaking";body.frequency.value=180+Math.min(260,midiFreq(note)*.35);body.Q.value=.75+p.piano_resonance*1.5;body.gain.value=-1+p.piano_resonance*5;
    const peak=Math.max(.015,vel*(1-p.piano_softness*.28));voiceGain.gain.setValueAtTime(.0001,now);voiceGain.gain.exponentialRampToValueAtTime(peak,now+.004);
    voiceGain.gain.setTargetAtTime(Math.max(.0001,peak*(.30+.50*p.piano_sustain)),now+.14,.65+1.7*p.piano_sustain);
    roomDelay.delayTime.value=.028;roomFilter.type="lowpass";roomFilter.frequency.value=4200;roomGain.gain.value=p.piano_room_mix*(.35+.65*p.piano_resonance);
    source.connect(tone);tone.connect(body);body.connect(voiceGain);voiceGain.connect(this.master);
    body.connect(roomDelay);roomDelay.connect(roomFilter);roomFilter.connect(roomGain);roomGain.connect(this.master);
    source.onended=()=>{for(const node of [source,tone,body,voiceGain,roomDelay,roomFilter,roomGain])node.disconnect();};
    source.start(now);this.playPianoNoise("hammer",now,p.piano_hammer_mix*vel*(.16+.20*(1-p.piano_softness)));
    this.voices.set(this.voiceKey(note),{kind:"piano",source,voiceGain});setPerformanceActive(note,true);
  };

  const baseNoteOn=engine.noteOn.bind(engine),baseNoteOff=engine.noteOff.bind(engine);
  engine.noteOn=function(midiNote,velocity=.85,whenSeconds=0){
    if(isPianoPatch(this.patch)){this.playGrandPianoPCM(midiNote,velocity,whenSeconds);return;}
    return baseNoteOn(midiNote,velocity,whenSeconds);
  };
  engine.noteOff=function(midiNote,whenSeconds=0){
    const note=clamp(Math.round(midiNote),0,127),voice=this.voices.get(this.voiceKey(note));
    if(voice&&voice.kind==="piano"){
      const now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0),p=validatePianoExtras(this.patch);
      voice.voiceGain.gain.cancelScheduledValues(now);voice.voiceGain.gain.setTargetAtTime(.0001,now,.055);
      try{voice.source.stop(now+.32);}catch(_){}
      this.playPianoNoise("damper",now,p.piano_damper_noise*.20);this.voices.delete(this.voiceKey(note));setPerformanceActive(note,false);return;
    }
    return baseNoteOff(midiNote,whenSeconds);
  };

  const baseEngineDetail=engineDetail;
  engineDetail=function(p){
    if(isPianoPatch(p))return"PCM Multisample · Grand Piano · Hammer + Resonance";
    return baseEngineDetail(p);
  };

  function pianoValue(key,value){
    if(key==="master_gain"||key==="piano_velocity_curve")return Number(value).toFixed(2);
    if(typeof value==="number"&&value>=0&&value<=1)return`${Math.round(value*100)}%`;
    return String(value);
  }
  const baseRenderParameters=renderParameters;
  renderParameters=function(){
    if(!isPianoPatch(currentPatch))return baseRenderParameters();
    const root=document.getElementById("params");root.innerHTML="";
    for(const def of PIANO_PARAM_DEFS){
      const [key,label,min,max,step]=def,card=document.createElement("div");card.className="param-control";
      const value=Number(currentPatch[key]),header=document.createElement("div");header.className="param-control-head";header.innerHTML=`<span>${label}</span><output>${pianoValue(key,value)}</output>`;card.appendChild(header);
      const dial=document.createElement("div");dial.className="param-dial";dial.setAttribute("aria-hidden","true");
      const pct=clamp((value-min)/(max-min),0,1);dial.style.setProperty("--pct",`${pct*75}%`);dial.style.setProperty("--dial-ratio",String(pct));card.appendChild(dial);
      const input=document.createElement("input");input.type="range";input.min=min;input.max=max;input.step=step;input.value=value;input.dataset.param=key;
      input.addEventListener("input",()=>{applyParam(key,Number(input.value),false);const ratio=clamp((Number(input.value)-min)/(max-min),0,1);dial.style.setProperty("--pct",`${ratio*75}%`);dial.style.setProperty("--dial-ratio",String(ratio));header.querySelector("output").textContent=pianoValue(key,Number(input.value));});
      input.addEventListener("change",()=>renderParameters());card.appendChild(input);root.appendChild(card);
    }
  };

  const baseApplyParam=applyParam;
  applyParam=function(key,value,rerender=true){
    if(!isPianoPatch(currentPatch)||!PIANO_PARAM_KEYS.has(key))return baseApplyParam(key,value,rerender);
    engine.setPatchWithRender(validatePianoExtras({...currentPatch,[key]:value}),false);currentPatch=engine.patch;
    if(rerender)renderParameters();document.getElementById("status").textContent=`${key} を調整しました。`;
  };

  const baseRenderPatch=renderPatch;
  renderPatch=function(){
    baseRenderPatch();if(isPianoPatch(currentPatch))document.getElementById("engineBadge").textContent="PIANO";
  };

  window.synthPianoRuntime={isPianoPatch,validatePianoExtras};
})();
