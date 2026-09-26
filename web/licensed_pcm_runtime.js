"use strict";

// Curated same-origin CC0 PCM playback. No network request is made before an
// explicit user gesture initializes the existing AudioContext.
(() => {
  const SOURCE="/assets/pcm/vcsl/tenor_sax_c3.wav";
  const ROOT_NOTE=48;
  const PARAMS=[
    ["pcm_tone","Tone",0,1,.01],["pcm_attack_s","Attack",.001,1,.005],
    ["pcm_release_s","Release",.02,3,.01],["pcm_body","Body",0,1,.01],
    ["pcm_room_mix","Room",0,.5,.01],["pcm_velocity_curve","Velocity Curve",.5,2,.05],
    ["master_gain","Master",.02,.35,.005]
  ];
  const KEYS=new Set(PARAMS.map(row=>row[0]));
  const isLicensed=p=>Boolean(p&&p.engine_type==="sampler"&&p.instrument_model==="licensed_pcm");

  const baseValidate=validatePatch;
  validatePatch=function(raw){
    const requested=Boolean(raw&&raw.instrument_model==="licensed_pcm"),p=baseValidate(raw);
    if(!requested)return p;
    return {...p,engine_type:"sampler",instrument_model:"licensed_pcm",pcm_instrument:"tenor_sax",
      pcm_tone:clamp(raw.pcm_tone??.68,0,1),pcm_attack_s:clamp(raw.pcm_attack_s??.018,.001,1),
      pcm_release_s:clamp(raw.pcm_release_s??.42,.02,3),pcm_body:clamp(raw.pcm_body??.62,0,1),
      pcm_room_mix:clamp(raw.pcm_room_mix??.10,0,.5),pcm_velocity_curve:clamp(raw.pcm_velocity_curve??1.05,.5,2)};
  };

  engine.ensureLicensedPCM=async function(){
    if(this.sampleBuffers.has("licensed_tenor_sax"))return this.sampleBuffers.get("licensed_tenor_sax");
    if(!this.licensedPCMLoadPromise)this.licensedPCMLoadPromise=fetch(SOURCE,{cache:"force-cache"})
      .then(response=>{if(!response.ok)throw new Error("CC0 PCMを読み込めませんでした。");return response.arrayBuffer();})
      .then(bytes=>this.ctx.decodeAudioData(bytes))
      .then(buffer=>(this.sampleBuffers.set("licensed_tenor_sax",buffer),buffer));
    return this.licensedPCMLoadPromise;
  };

  engine.playLicensedPCM=function(midiNote,velocity,whenSeconds){
    const requestedPatch={...this.patch};
    const buffer=this.sampleBuffers.get("licensed_tenor_sax");
    if(!buffer){this.ensureLicensedPCM().then(()=>this.playLicensedPCM(midiNote,velocity,whenSeconds)).catch(showError);return;}
    if(!isLicensed(this.patch)||this.patch.pcm_instrument!==requestedPatch.pcm_instrument)return;
    const note=clamp(Math.round(midiNote),0,127),p=validatePatch(this.patch),now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0);
    this.limitVoices(note);
    const source=this.ctx.createBufferSource(),tone=this.ctx.createBiquadFilter(),body=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
    const delay=this.ctx.createDelay(.12),room=this.ctx.createGain();
    source.buffer=buffer;source.playbackRate.value=clamp(Math.pow(2,(note-ROOT_NOTE)/12),.35,3);
    tone.type="lowpass";tone.frequency.value=2200+p.pcm_tone*10500;tone.Q.value=.7;
    body.type="peaking";body.frequency.value=620;body.Q.value=1.0;body.gain.value=-2+p.pcm_body*7;
    const peak=Math.max(.008,Math.pow(clamp(velocity,0,1),p.pcm_velocity_curve));
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(peak,now+p.pcm_attack_s);
    delay.delayTime.value=.035;room.gain.value=p.pcm_room_mix*.38;
    source.connect(tone);tone.connect(body);body.connect(gain);gain.connect(this.master);body.connect(delay);delay.connect(room);room.connect(this.master);
    source.onended=()=>{for(const node of [source,tone,body,gain,delay,room])node.disconnect();};
    source.start(now);this.voices.set(this.voiceKey(note),{kind:"licensed_pcm",source,voiceGain:gain});setPerformanceActive(note,true);
  };

  const baseOn=engine.noteOn.bind(engine),baseOff=engine.noteOff.bind(engine);
  engine.noteOn=function(note,velocity=.85,when=0){if(isLicensed(this.patch)){this.playLicensedPCM(note,velocity,when);return;}return baseOn(note,velocity,when);};
  engine.noteOff=function(midiNote,when=0){
    const note=clamp(Math.round(midiNote),0,127),voice=this.voices.get(this.voiceKey(note));
    if(voice&&voice.kind==="licensed_pcm"){
      const now=this.ctx.currentTime+Math.max(0,Number(when)||0),release=validatePatch(this.patch).pcm_release_s;
      voice.voiceGain.gain.cancelScheduledValues(now);voice.voiceGain.gain.setTargetAtTime(.0001,now,release/4);
      try{voice.source.stop(now+release);}catch(_){}this.voices.delete(this.voiceKey(note));setPerformanceActive(note,false);return;
    }
    return baseOff(midiNote,when);
  };

  const baseDetail=engineDetail;engineDetail=p=>isLicensed(p)?"CC0 PCM · VCSL Tenor Sax · Provenance verified":baseDetail(p);
  const baseRender=renderParameters;
  renderParameters=function(){
    if(!isLicensed(currentPatch))return baseRender();const root=document.getElementById("params");root.innerHTML="";
    for(const [key,label,min,max,step] of PARAMS){
      const value=Number(currentPatch[key]),card=document.createElement("div");card.className="param-control";
      card.innerHTML=`<div class="param-control-head"><span>${label}</span><output>${value.toFixed(2)}</output></div>`;
      const input=document.createElement("input");input.type="range";input.min=min;input.max=max;input.step=step;input.value=value;input.dataset.param=key;
      input.addEventListener("input",()=>{applyParam(key,Number(input.value),false);card.querySelector("output").textContent=Number(input.value).toFixed(2);});
      input.addEventListener("change",()=>renderParameters());card.appendChild(input);root.appendChild(card);
    }
  };
  const baseApply=applyParam;applyParam=function(key,value,rerender=true){
    if(!isLicensed(currentPatch)||!KEYS.has(key))return baseApply(key,value,rerender);
    engine.setPatchWithRender(validatePatch({...currentPatch,[key]:value}),false);currentPatch=engine.patch;if(rerender)renderParameters();
  };
  const basePatch=renderPatch;renderPatch=function(){basePatch();if(isLicensed(currentPatch))document.getElementById("engineBadge").textContent="CC0 PCM";};
  window.synthLicensedPCMRuntime={isLicensed,SOURCE};
})();
