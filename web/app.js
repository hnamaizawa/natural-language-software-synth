"use strict";

const DEFAULT_PATCH = {
  name:"Init Patch", engine_type:"synth", instrument_model:"generic", drum_style:"standard",
  osc1_wave:"sawtooth", osc2_wave:"sawtooth", osc_mix:.45, osc2_detune_cents:7, octave_shift:0,
  filter_cutoff_hz:4200, filter_q:.9, attack_s:.02, decay_s:.25, sustain:.72, release_s:.5,
  lfo_rate_hz:0, lfo_depth_cents:0, delay_time_s:0, delay_feedback:0, delay_mix:0,
  sample_tone:.68, sample_attack_mix:.34, finger_noise_mix:.38, release_noise_mix:.24,
  slide_amount:.32, slide_time_s:.16, mwah_amount:.58, sample_velocity_curve:1,
  kick_tune_hz:58, kick_decay_s:.28, snare_tone_hz:185, snare_decay_s:.22,
  hat_decay_s:.09, tom_decay_s:.42, drum_brightness:.68, drum_room_mix:.12,
  fm_mod_index:4.8, fm_brightness:.72, fm_ratio_1:14, fm_ratio_2:1,
  fm_decay_s:2.4, fm_release_s:1.4, fm_chorus_mix:.18,
  pcm_instrument:"tenor_sax",pcm_tone:.68,pcm_attack_s:.018,pcm_release_s:.42,
  pcm_body:.62,pcm_room_mix:.10,pcm_velocity_curve:1.05,
  master_gain:.22, max_polyphony:12, prompt:""
};

const WAVES=new Set(["sine","triangle","sawtooth","square"]);
const ENGINE_TYPES=new Set(["synth","sampler","drum","fm"]);
const INSTRUMENT_MODELS=new Set(["generic","fretless_bass","studio_drums","dx_ep","licensed_pcm"]);
const DRUM_STYLES=new Set(["standard","half_time_shuffle"]);
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number(v)));
const midiFreq=m=>440*Math.pow(2,(m-69)/12);

const FRETLESS_REGIONS = Object.freeze([
  {name:"note_28",root:28,offset:0,duration:1.85},
  {name:"note_33",root:33,offset:1.88,duration:1.85},
  {name:"note_38",root:38,offset:3.76,duration:1.85},
  {name:"note_43",root:43,offset:5.64,duration:1.85},
  {name:"note_48",root:48,offset:7.52,duration:1.85},
  {name:"note_53",root:53,offset:9.40,duration:1.85},
  {name:"attack",offset:11.28,duration:.22},
  {name:"release",offset:11.53,duration:.30},
  {name:"slide",offset:11.86,duration:.55}
]);
const DRUM_REGIONS = Object.freeze({
  kick:{offset:0,duration:.55},
  snare_soft:{offset:.58,duration:.48},
  snare_hard:{offset:1.09,duration:.48},
  closed_hat:{offset:1.60,duration:.16},
  open_hat:{offset:1.79,duration:.55},
  low_tom:{offset:2.37,duration:.65},
  mid_tom:{offset:3.05,duration:.65},
  high_tom:{offset:3.73,duration:.65},
  crash:{offset:4.41,duration:1.30},
  ride:{offset:5.74,duration:1.10}
});

const SYNTH_KEY_MAP={KeyA:60,KeyW:61,KeyS:62,KeyE:63,KeyD:64,KeyF:65,KeyT:66,KeyG:67,KeyY:68,KeyH:69,KeyU:70,KeyJ:71,KeyK:72};
const DRUM_KEY_MAP={KeyA:36,KeyS:38,KeyD:42,KeyF:46,KeyG:45,KeyH:48,KeyJ:50,KeyK:49,KeyL:51};
const DRUM_PADS=[
  {note:36,label:"Kick",key:"A"},{note:38,label:"Snare",key:"S"},{note:42,label:"Closed Hat",key:"D"},
  {note:46,label:"Open Hat",key:"F"},{note:45,label:"Low Tom",key:"G"},{note:48,label:"Mid Tom",key:"H"},
  {note:50,label:"High Tom",key:"J"},{note:49,label:"Crash",key:"K"},{note:51,label:"Ride",key:"L"}
];

function buildHalfTimeShuffleSteps(){
  const steps=[];
  for(let i=0;i<24;i++){
    const pos=i%3, beat=Math.floor(i/3)%4, bar=Math.floor(i/12), events=[];
    if(pos===0||pos===2) events.push({note:42,velocity:pos===0?.58:.42});
    if(pos===1) events.push({note:38,velocity:.20});
    if(beat===2&&pos===0) events.push({note:38,velocity:.94});
    const local=i%12, kicks=bar===0?[0,5,9]:[0,4,8,11];
    if(kicks.includes(local)) events.push({note:36,velocity:.82});
    if(local===11) events.push({note:46,velocity:.34});
    steps.push({events,beats:1/3});
  }
  return steps;
}
function buildStraightDrumSteps(){
  const steps=[];
  for(let i=0;i<16;i++){
    const events=[{note:42,velocity:i%2===0?.52:.38}];
    if([0,8,10].includes(i)) events.push({note:36,velocity:.86});
    if([4,12].includes(i)) events.push({note:38,velocity:.9});
    steps.push({events,beats:.25});
  }
  return steps;
}

const SAMPLE_PERFORMANCES=Object.freeze({
  melody:{label:"メロディ",bpm:108,steps:[
    {notes:[60],beats:.5},{notes:[64],beats:.5},{notes:[67],beats:.5},{notes:[69],beats:.5},
    {notes:[67],beats:.5},{notes:[64],beats:.5},{notes:[62],beats:.5},{notes:[60],beats:1}
  ]},
  chords:{label:"コード",bpm:82,steps:[
    {notes:[60,64,67],beats:2},{notes:[65,69,72],beats:2},{notes:[67,71,74],beats:2},{notes:[60,64,67],beats:2}
  ]},
  bass:{label:"ベースライン",bpm:116,steps:[
    {notes:[36],beats:.5},{notes:[36],beats:.5},{notes:[43],beats:.5},{notes:[46],beats:.5},
    {notes:[36],beats:.5},{notes:[43],beats:.5},{notes:[41],beats:.5},{notes:[43],beats:.5}
  ]},
  fretless_demo:{label:"フレットレス・フレーズ",bpm:92,steps:[
    {notes:[40],beats:.75},{notes:[43],beats:.25},{notes:[45],beats:.75},{notes:[47],beats:.25},
    {notes:[48],beats:1},{notes:[47],beats:.5},{notes:[43],beats:.5},{notes:[40],beats:1.5}
  ]},
  fm_ep_demo:{label:"FMエレピ・コード",bpm:78,steps:[
    {notes:[60,64,67,71],beats:2},{notes:[57,60,64,67],beats:2},{notes:[62,65,69,72],beats:2},{notes:[55,59,62,65],beats:2}
  ]},
  drum_shuffle:{label:"ハーフタイム・シャッフル",bpm:88,steps:buildHalfTimeShuffleSteps()},
  drum_straight:{label:"ストレート・ドラム",bpm:104,steps:buildStraightDrumSteps()}
});
const SAMPLE_OPTIONS={
  synth:[["melody","メロディ"],["chords","コード"],["bass","ベースライン"]],
  sampler:[["fretless_demo","フレットレス・フレーズ"],["bass","ベースライン"]],
  fm:[["fm_ep_demo","FMエレピ・コード"],["melody","メロディ"]],
  drum:[["drum_shuffle","ハーフタイム・シャッフル"],["drum_straight","ストレート・ドラム"]]
};

const PARAM_DEFS={
  synth:[
    ["osc1_wave","OSC 1","select",["sine","triangle","sawtooth","square"]],
    ["osc2_wave","OSC 2","select",["sine","triangle","sawtooth","square"]],
    ["osc_mix","OSC Mix",0,1,.01],["osc2_detune_cents","Detune",-50,50,.5],
    ["filter_cutoff_hz","Cutoff",80,18000,10],["filter_q","Resonance",.1,18,.1],
    ["attack_s","Attack",.001,8,.01],["decay_s","Decay",.001,8,.01],["sustain","Sustain",0,1,.01],["release_s","Release",.01,10,.01],
    ["lfo_rate_hz","LFO Rate",0,20,.1],["lfo_depth_cents","Vibrato",0,80,.5],
    ["delay_mix","Delay Mix",0,.65,.01],["master_gain","Master",.02,.35,.005]
  ],
  sampler:[
    ["sample_tone","Tone",0,1,.01],["sample_attack_mix","Attack PCM",0,1,.01],["finger_noise_mix","Finger Noise",0,1,.01],
    ["release_noise_mix","Release Noise",0,1,.01],["slide_amount","Slide",0,1,.01],["slide_time_s","Slide Time",0,1.2,.01],
    ["mwah_amount","Mwah",0,1,.01],["sample_velocity_curve","Velocity Curve",.4,2.5,.05],
    ["lfo_rate_hz","Vibrato Rate",0,20,.1],["lfo_depth_cents","Vibrato Depth",0,80,.5],["master_gain","Master",.02,.35,.005]
  ],
  drum:[
    ["kick_tune_hz","Kick Tune",35,120,1],["kick_decay_s","Kick Decay",.05,1.2,.01],
    ["snare_tone_hz","Snare Tune",90,300,1],["snare_decay_s","Snare Decay",.05,1,.01],
    ["hat_decay_s","Hat Decay",.02,.5,.005],["tom_decay_s","Tom Decay",.08,1.5,.01],
    ["drum_brightness","Brightness",0,1,.01],["drum_room_mix","Room",0,.45,.01],["master_gain","Master",.02,.35,.005]
  ],
  fm:[
    ["fm_mod_index","FM Index",0,18,.1],["fm_brightness","Brightness",0,1,.01],
    ["fm_ratio_1","Mod Ratio A",.25,20,.05],["fm_ratio_2","Mod Ratio B",.25,20,.05],
    ["fm_decay_s","Decay",.05,8,.01],["fm_release_s","Release",.05,8,.01],
    ["fm_chorus_mix","Chorus",0,.5,.01],["master_gain","Master",.02,.35,.005]
  ]
};

function validatePatch(raw){
  const p={...DEFAULT_PATCH,...(raw||{})};
  const ev=(v,allowed,fallback)=>allowed.has(String(v))?String(v):fallback;
  return {
    ...p,
    name:String(p.name||"Imported Patch").slice(0,80),
    engine_type:ev(p.engine_type,ENGINE_TYPES,"synth"),
    instrument_model:ev(p.instrument_model,INSTRUMENT_MODELS,"generic"),
    drum_style:ev(p.drum_style,DRUM_STYLES,"standard"),
    osc1_wave:WAVES.has(p.osc1_wave)?p.osc1_wave:"sawtooth",osc2_wave:WAVES.has(p.osc2_wave)?p.osc2_wave:"sawtooth",
    osc_mix:clamp(p.osc_mix,0,1),osc2_detune_cents:clamp(p.osc2_detune_cents,-50,50),octave_shift:Math.round(clamp(p.octave_shift,-2,2)),
    filter_cutoff_hz:clamp(p.filter_cutoff_hz,80,18000),filter_q:clamp(p.filter_q,.1,18),attack_s:clamp(p.attack_s,.001,8),
    decay_s:clamp(p.decay_s,.001,8),sustain:clamp(p.sustain,0,1),release_s:clamp(p.release_s,.01,10),
    lfo_rate_hz:clamp(p.lfo_rate_hz,0,20),lfo_depth_cents:clamp(p.lfo_depth_cents,0,80),
    delay_time_s:clamp(p.delay_time_s,0,1.5),delay_feedback:clamp(p.delay_feedback,0,.75),delay_mix:clamp(p.delay_mix,0,.65),
    sample_tone:clamp(p.sample_tone,0,1),sample_attack_mix:clamp(p.sample_attack_mix,0,1),finger_noise_mix:clamp(p.finger_noise_mix,0,1),
    release_noise_mix:clamp(p.release_noise_mix,0,1),slide_amount:clamp(p.slide_amount,0,1),slide_time_s:clamp(p.slide_time_s,0,1.2),
    mwah_amount:clamp(p.mwah_amount,0,1),sample_velocity_curve:clamp(p.sample_velocity_curve,.4,2.5),
    kick_tune_hz:clamp(p.kick_tune_hz,35,120),kick_decay_s:clamp(p.kick_decay_s,.05,1.2),snare_tone_hz:clamp(p.snare_tone_hz,90,300),
    snare_decay_s:clamp(p.snare_decay_s,.05,1),hat_decay_s:clamp(p.hat_decay_s,.02,.5),tom_decay_s:clamp(p.tom_decay_s,.08,1.5),
    drum_brightness:clamp(p.drum_brightness,0,1),drum_room_mix:clamp(p.drum_room_mix,0,.45),
    fm_mod_index:clamp(p.fm_mod_index,0,18),fm_brightness:clamp(p.fm_brightness,0,1),fm_ratio_1:clamp(p.fm_ratio_1,.25,20),
    fm_ratio_2:clamp(p.fm_ratio_2,.25,20),fm_decay_s:clamp(p.fm_decay_s,.05,8),fm_release_s:clamp(p.fm_release_s,.05,8),
    fm_chorus_mix:clamp(p.fm_chorus_mix,0,.5),master_gain:clamp(p.master_gain,.02,.35),
    pcm_instrument:p.pcm_instrument==="tenor_sax"?"tenor_sax":"tenor_sax",pcm_tone:clamp(p.pcm_tone,0,1),
    pcm_attack_s:clamp(p.pcm_attack_s,.001,1),pcm_release_s:clamp(p.pcm_release_s,.02,3),pcm_body:clamp(p.pcm_body,0,1),
    pcm_room_mix:clamp(p.pcm_room_mix,0,.5),pcm_velocity_curve:clamp(p.pcm_velocity_curve,.5,2),
    max_polyphony:Math.round(clamp(p.max_polyphony,1,16)),prompt:String(p.prompt||"").slice(0,500)
  };
}

class SynthEngine{
  constructor(){
    this.ctx=null;this.patch=validatePatch(DEFAULT_PATCH);this.voices=new Map();this.master=null;this.analyser=null;
    this.sampleBuffers=new Map();this.sampleLoadPromise=null;this.drumRoomDelay=null;this.drumRoomGain=null;this.lastMelodicNote=null;
  }
  async init(){
    if(!this.ctx){
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      this.master=this.ctx.createGain();this.master.gain.value=this.patch.master_gain;
      this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=256;
      this.master.connect(this.analyser);this.analyser.connect(this.ctx.destination);
      this.drumRoomDelay=this.ctx.createDelay(.25);this.drumRoomDelay.delayTime.value=.055;
      this.drumRoomGain=this.ctx.createGain();this.drumRoomGain.gain.value=this.patch.drum_room_mix;
      this.drumRoomDelay.connect(this.drumRoomGain);this.drumRoomGain.connect(this.master);
      meterLoop();
    }
    if(this.ctx.state==="suspended")await this.ctx.resume();
    await this.loadFactorySamples();
  }
  async loadFactorySamples(){
    if(this.sampleBuffers.size===2)return;
    if(!this.sampleLoadPromise){
      this.sampleLoadPromise=Promise.resolve().then(()=>{
        this.sampleBuffers.set("fretless",this.createFactoryFretlessPCM());
        this.sampleBuffers.set("drums",this.createFactoryDrumPCM());
      }).catch(err=>{this.sampleLoadPromise=null;throw err;});
    }
    return this.sampleLoadPromise;
  }
  seededNoise(seed=1){
    let state=seed>>>0;
    return()=>{state=(1664525*state+1013904223)>>>0;return(state/4294967296)*2-1;};
  }
  createFactoryFretlessPCM(){
    const length=Math.ceil(12.44*this.ctx.sampleRate),buffer=this.ctx.createBuffer(1,length,this.ctx.sampleRate),data=buffer.getChannelData(0),noise=this.seededNoise(303);
    for(const region of FRETLESS_REGIONS){
      const start=Math.floor(region.offset*this.ctx.sampleRate),frames=Math.floor(region.duration*this.ctx.sampleRate);
      if(Number.isFinite(region.root)){
        const f=midiFreq(region.root);let phase=0;
        for(let i=0;i<frames;i++){
          const t=i/this.ctx.sampleRate,freq=f*(1+.012*Math.exp(-t/.11));phase+=2*Math.PI*freq/this.ctx.sampleRate;
          const mwah=.18*Math.sin(2*Math.PI*2.1*t)*Math.exp(-t/1.6);
          let body=0;const amps=[1,.42,.25,.14,.08,.045];
          for(let h=1;h<=amps.length;h++)body+=amps[h-1]*(1+mwah*h/3)*Math.sin(h*phase+(h-1)*.15);
          const attack=1-Math.exp(-t/.006),decay=.72*Math.exp(-t/1.5)+.28*Math.exp(-t/4);
          let finger=0;if(t<.055)finger=(noise()*.075+.055*Math.sin(2*Math.PI*850*t))*Math.exp(-t/.014);
          data[start+i]=Math.tanh(body*attack*decay*1.15+finger)*.58;
        }
      }else{
        for(let i=0;i<frames;i++){
          const t=i/this.ctx.sampleRate,n=noise(),shape=Math.sin(Math.PI*Math.min(1,t/region.duration));let y=0;
          if(region.name==="attack")y=n*Math.exp(-t/.035)*.38+Math.sin(2*Math.PI*900*t)*Math.exp(-t/.025)*.22;
          else if(region.name==="release")y=n*Math.exp(-t/.07)*.34+Math.sin(2*Math.PI*280*t)*Math.exp(-t/.09)*.18;
          else y=n*shape*.28+Math.sin(2*Math.PI*(500*t+1200*t*t/(2*region.duration)))*shape*.24;
          data[start+i]=y;
        }
      }
    }
    return buffer;
  }
  createFactoryDrumPCM(){
    const length=Math.ceil(6.87*this.ctx.sampleRate),buffer=this.ctx.createBuffer(1,length,this.ctx.sampleRate),data=buffer.getChannelData(0),noise=this.seededNoise(707);
    const write=(name,fn)=>{const r=DRUM_REGIONS[name],start=Math.floor(r.offset*this.ctx.sampleRate),frames=Math.floor(r.duration*this.ctx.sampleRate);for(let i=0;i<frames;i++)data[start+i]=fn(i/this.ctx.sampleRate,i);};
    write("kick",(t)=>{const f=56+(160-56)*Math.exp(-t/.035);return(Math.sin(2*Math.PI*f*t)*Math.exp(-t/.18)+noise()*Math.exp(-t/.008)*.08)*.82;});
    write("snare_soft",(t)=>{return(noise()*Math.exp(-t/.10)*.34+Math.sin(2*Math.PI*190*t)*Math.exp(-t/.12)*.20)*.70;});
    write("snare_hard",(t)=>{return(noise()*Math.exp(-t/.14)*.58+Math.sin(2*Math.PI*190*t)*Math.exp(-t/.12)*.26+noise()*Math.exp(-t/.025)*.14)*.78;});
    const metal=(open=false,ride=false)=>(t)=>{const freqs=ride?[2900,4100,5600,7100,8800,10100]:[3900,5100,6200,7300,9100,10500],tau=ride?.62:(open?.24:.045);let y=0;for(const f of freqs)y+=Math.sin(2*Math.PI*f*t);y/=freqs.length;y+=noise()*.34;if(ride)y+=Math.sin(2*Math.PI*1700*t)*Math.exp(-t/.22)*.28;return y*Math.exp(-t/tau)*.55;};
    write("closed_hat",metal(false,false));write("open_hat",metal(true,false));
    const tom=f=>(t)=>{const ff=f*(1+.12*Math.exp(-t/.04));return(Math.sin(2*Math.PI*ff*t)*Math.exp(-t/.28)+.18*Math.sin(4*Math.PI*ff*t+.3)*Math.exp(-t/.18)+noise()*Math.exp(-t/.025)*.025)*.8;};
    write("low_tom",tom(105));write("mid_tom",tom(145));write("high_tom",tom(195));
    write("crash",(t)=>{const freqs=[2400,3700,5200,6800,8400,9900,11100];let y=0;for(const f of freqs)y+=Math.sin(2*Math.PI*f*t);return(y/freqs.length+noise()*.30)*Math.exp(-t/.72)*.5;});
    write("ride",metal(false,true));
    return buffer;
  }
  setPatch(raw){
    this.patch=validatePatch(raw);
    if(this.master)this.master.gain.setTargetAtTime(this.patch.master_gain,this.ctx.currentTime,.02);
    if(this.drumRoomGain)this.drumRoomGain.gain.setTargetAtTime(this.patch.drum_room_mix,this.ctx.currentTime,.02);
    renderPatch();
  }
  noteOn(midiNote,velocity=.85,whenSeconds=0){
    if(!this.ctx)return;
    if(this.patch.engine_type==="drum"){this.playDrumPCM(midiNote,velocity,whenSeconds);return;}
    if(this.patch.engine_type==="sampler"){this.playFretlessPCM(midiNote,velocity,whenSeconds);return;}
    if(this.patch.engine_type==="fm"){this.playFM(midiNote,velocity,whenSeconds);return;}
    this.playSubtractive(midiNote,velocity,whenSeconds);
  }
  noteOff(midiNote,whenSeconds=0){
    if(!this.ctx)return;
    if(this.patch.engine_type==="drum"){setPerformanceActive(canonicalDrumNote(midiNote),false);return;}
    const note=clamp(Math.round(midiNote),0,127),v=this.voices.get(note);if(!v)return;
    const now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0);
    if(v.kind==="sampler"){
      v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(.0001,now,.045);
      try{v.source.stop(now+.24);}catch(_){}
      this.playFretlessArticulation("release",now,clamp(this.patch.release_noise_mix,0,1)*.7);
    }else if(v.kind==="fm"){
      for(const g of v.carrierGains){g.gain.cancelScheduledValues(now);g.gain.setTargetAtTime(.0001,now,Math.max(.02,this.patch.fm_release_s/5));}
      const stop=now+this.patch.fm_release_s+.08;for(const o of v.oscillators){try{o.stop(stop);}catch(_){}}
      if(v.lfo){try{v.lfo.stop(stop);}catch(_){}}
    }else{
      const stop=now+this.patch.release_s+.08;v.voiceGain.gain.cancelScheduledValues(now);
      v.voiceGain.gain.setTargetAtTime(.0001,now,Math.max(.005,this.patch.release_s/5));
      for(const o of [v.o1,v.o2,v.lfo].filter(Boolean)){try{o.stop(stop);}catch(_){}}
    }
    this.voices.delete(note);setPerformanceActive(note,false);
  }
  limitVoices(note){
    if(this.voices.has(note))this.noteOff(note,0);
    while(this.voices.size>=this.patch.max_polyphony)this.noteOff(this.voices.keys().next().value,0);
  }
  playSubtractive(midiNote,velocity,whenSeconds){
    const note=clamp(Math.round(midiNote),0,127);this.limitVoices(note);
    const now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0),p=this.patch,f=midiFreq(note+p.octave_shift*12);
    const voiceGain=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();voiceGain.gain.setValueAtTime(.0001,now);
    filter.type="lowpass";filter.frequency.setValueAtTime(p.filter_cutoff_hz,now);filter.Q.value=p.filter_q;
    const dry=this.ctx.createGain(),wet=this.ctx.createGain(),delay=this.ctx.createDelay(1.5),fb=this.ctx.createGain();
    dry.gain.value=1-p.delay_mix;wet.gain.value=p.delay_mix;delay.delayTime.value=p.delay_time_s;fb.gain.value=p.delay_feedback;
    filter.connect(dry);dry.connect(voiceGain);filter.connect(delay);delay.connect(fb);fb.connect(delay);delay.connect(wet);wet.connect(voiceGain);voiceGain.connect(this.master);
    const o1=this.ctx.createOscillator(),o2=this.ctx.createOscillator(),g1=this.ctx.createGain(),g2=this.ctx.createGain();
    o1.type=p.osc1_wave;o2.type=p.osc2_wave;o1.frequency.value=f;o2.frequency.value=f;o2.detune.value=p.osc2_detune_cents;
    g1.gain.value=1-p.osc_mix;g2.gain.value=p.osc_mix;o1.connect(g1);o2.connect(g2);g1.connect(filter);g2.connect(filter);
    let lfo=null;if(p.lfo_rate_hz>0&&p.lfo_depth_cents>0){lfo=this.ctx.createOscillator();const lg=this.ctx.createGain();lfo.frequency.value=p.lfo_rate_hz;lg.gain.value=p.lfo_depth_cents;lfo.connect(lg);lg.connect(o1.detune);lg.connect(o2.detune);lfo.start(now);}
    const peak=Math.max(.02,clamp(velocity,0,1)),aEnd=now+p.attack_s,dEnd=aEnd+p.decay_s;
    voiceGain.gain.exponentialRampToValueAtTime(peak,aEnd);voiceGain.gain.linearRampToValueAtTime(Math.max(.0001,peak*p.sustain),dEnd);
    o1.start(now);o2.start(now);this.voices.set(note,{kind:"synth",o1,o2,lfo,voiceGain});setPerformanceActive(note,true);
  }
  nearestFretlessRegion(note){
    return FRETLESS_REGIONS.filter(r=>Number.isFinite(r.root)).reduce((best,r)=>Math.abs(r.root-note)<Math.abs(best.root-note)?r:best);
  }
  playRegion(bufferKey,region,now,rate=1,gainValue=1,destination=this.master){
    const buffer=this.sampleBuffers.get(bufferKey);if(!buffer)return null;
    const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=gainValue;
    source.connect(gain);gain.connect(destination);source.start(now,region.offset,region.duration);return{source,gain};
  }
  playFretlessArticulation(name,now,gainValue){
    const region=FRETLESS_REGIONS.find(r=>r.name===name);if(!region||gainValue<=.001)return;
    this.playRegion("fretless",region,now,1,gainValue,this.master);
  }
  playFretlessPCM(midiNote,velocity,whenSeconds){
    const note=clamp(Math.round(midiNote),0,127);this.limitVoices(note);
    const buffer=this.sampleBuffers.get("fretless");if(!buffer)return;
    const now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0),p=this.patch,region=this.nearestFretlessRegion(note);
    const targetRate=Math.pow(2,(note-region.root)/12),source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
    source.buffer=buffer;const vel=Math.pow(clamp(velocity,0,1),p.sample_velocity_curve);
    const previous=this.lastMelodicNote;
    if(previous!==null&&p.slide_amount>.03){
      const startRate=targetRate*Math.pow(2,((previous-note)/12)*p.slide_amount);
      source.playbackRate.setValueAtTime(clamp(startRate,.35,3),now);source.playbackRate.exponentialRampToValueAtTime(targetRate,now+p.slide_time_s);
      this.playFretlessArticulation("slide",now,p.slide_amount*.24);
    }else source.playbackRate.setValueAtTime(targetRate,now);
    filter.type="lowpass";const toneHz=1000+p.sample_tone*9500;filter.frequency.setValueAtTime(toneHz*(.55+.45*(1-p.mwah_amount)),now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120,toneHz),now+.18+p.mwah_amount*.35);filter.Q.value=.8+p.mwah_amount*5.8;
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.02,vel),now+.008);gain.gain.setTargetAtTime(Math.max(.0001,vel*.72),now+.12,.45);
    source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start(now,region.offset,region.duration);
    this.playFretlessArticulation("attack",now,p.sample_attack_mix*.18+p.finger_noise_mix*vel*.34);
    this.voices.set(note,{kind:"sampler",source,gain});this.lastMelodicNote=note;setPerformanceActive(note,true);
  }
  drumRegionFor(note,velocity){
    if(note===36)return["kick",56];
    if(note===38)return[velocity<.48?"snare_soft":"snare_hard",190];
    if(note===42)return["closed_hat",1];if(note===46)return["open_hat",1];
    if(note===45)return["low_tom",105];if(note===48)return["mid_tom",145];if(note===50)return["high_tom",195];
    if(note===49)return["crash",1];if(note===51)return["ride",1];return null;
  }
  playDrumPCM(midiNote,velocity,whenSeconds){
    const note=canonicalDrumNote(midiNote),info=this.drumRegionFor(note,velocity);if(note===null||!info)return;
    const buffer=this.sampleBuffers.get("drums");if(!buffer)return;
    const [name,baseTune]=info,region=DRUM_REGIONS[name],now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0),p=this.patch;
    const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
    source.buffer=buffer;let rate=1;if(note===36)rate=p.kick_tune_hz/baseTune;else if(note===38)rate=p.snare_tone_hz/baseTune;source.playbackRate.value=clamp(rate,.5,2);
    filter.type="lowpass";filter.frequency.value=1800+p.drum_brightness*10000;gain.gain.value=Math.max(.02,clamp(velocity,0,1));
    source.connect(filter);filter.connect(gain);gain.connect(this.master);if(this.drumRoomDelay)gain.connect(this.drumRoomDelay);
    let dur=region.duration;if(note===36)dur=Math.min(dur,.12+p.kick_decay_s*1.2);else if(note===38)dur=Math.min(dur,.10+p.snare_decay_s*1.4);
    else if(note===42||note===46)dur=Math.min(dur,.05+p.hat_decay_s*2.5);else if([45,48,50].includes(note))dur=Math.min(dur,.12+p.tom_decay_s*1.2);
    source.start(now,region.offset,dur);setPerformanceActive(note,true);setTimeout(()=>setPerformanceActive(note,false),Math.max(80,dur*450));
  }
  playFM(midiNote,velocity,whenSeconds){
    const note=clamp(Math.round(midiNote),0,127);this.limitVoices(note);
    const now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0),p=this.patch,f=midiFreq(note),vel=clamp(velocity,0,1);
    const sum=this.ctx.createGain(),dry=this.ctx.createGain(),wet=this.ctx.createGain(),chorus=this.ctx.createDelay(.05);
    dry.gain.value=1-p.fm_chorus_mix;wet.gain.value=p.fm_chorus_mix;chorus.delayTime.value=.014;
    sum.connect(dry);dry.connect(this.master);sum.connect(chorus);chorus.connect(wet);wet.connect(this.master);
    const oscillators=[],carrierGains=[];
    const makePair=(carrierRatio,modRatio,weight)=>{
      const c=this.ctx.createOscillator(),m=this.ctx.createOscillator(),mg=this.ctx.createGain(),cg=this.ctx.createGain();
      c.type="sine";m.type="sine";c.frequency.value=f*carrierRatio;m.frequency.value=f*modRatio;
      mg.gain.setValueAtTime(f*p.fm_mod_index*(.45+.75*p.fm_brightness)*vel,now);mg.gain.exponentialRampToValueAtTime(Math.max(.01,f*.05),now+p.fm_decay_s*.62);
      cg.gain.setValueAtTime(.0001,now);cg.gain.exponentialRampToValueAtTime(Math.max(.01,vel*weight),now+.006);cg.gain.exponentialRampToValueAtTime(Math.max(.0001,vel*.13*weight),now+p.fm_decay_s);
      m.connect(mg);mg.connect(c.frequency);c.connect(cg);cg.connect(sum);m.start(now);c.start(now);oscillators.push(m,c);carrierGains.push(cg);
    };
    makePair(1,p.fm_ratio_1,.72);makePair(2,p.fm_ratio_2,.38);
    const lfo=this.ctx.createOscillator(),lg=this.ctx.createGain();lfo.frequency.value=.75;lg.gain.value=.0025;lfo.connect(lg);lg.connect(chorus.delayTime);lfo.start(now);
    this.voices.set(note,{kind:"fm",oscillators,carrierGains,lfo});setPerformanceActive(note,true);
  }
}

const engine=new SynthEngine();
let currentPatch=validatePatch(DEFAULT_PATCH),generatedPatch={...currentPatch};
const held=new Set();let sampleTimers=[],sampleRunId=0,samplePlaying=false;const sampleActiveNotes=new Set();

function buildKeyboard(){
  const root=document.getElementById("keyboard"),black=new Set([1,3,6,8,10]);root.innerHTML="";
  for(let note=48;note<=72;note++){
    const el=document.createElement("button"),pc=note%12;el.className=`key ${black.has(pc)?"black":"white"}`;el.dataset.note=note;
    const label=Object.entries(SYNTH_KEY_MAP).find(([,n])=>n===note)?.[0].replace("Key","")||"";el.innerHTML=`<span>${label}</span>`;
    const down=async e=>{e.preventDefault();stopSample({announce:false});try{await engine.init();}catch(err){showError(err);return;}if(!held.has(`p${note}`)){held.add(`p${note}`);engine.noteOn(note,.86);}};
    const up=e=>{e.preventDefault();held.delete(`p${note}`);engine.noteOff(note);};
    el.addEventListener("pointerdown",down);el.addEventListener("pointerup",up);el.addEventListener("pointerleave",e=>{if(held.has(`p${note}`))up(e);});root.appendChild(el);
  }
}
function buildDrumKit(){
  const root=document.getElementById("drumKit");root.innerHTML="";
  for(const pad of DRUM_PADS){
    const el=document.createElement("button");el.className="drum-pad";el.dataset.note=pad.note;el.innerHTML=`<strong>${pad.label}</strong><span>${pad.key}</span>`;
    el.addEventListener("pointerdown",async e=>{e.preventDefault();stopSample({announce:false});try{await engine.init();}catch(err){showError(err);return;}engine.noteOn(pad.note,.88);});
    root.appendChild(el);
  }
}
function canonicalDrumNote(note){
  const n=Math.round(Number(note));if([35,36].includes(n))return 36;if([37,38,39,40].includes(n))return 38;
  if([42,44].includes(n))return 42;if([46].includes(n))return 46;if([41,43,45].includes(n))return 45;
  if([47,48].includes(n))return 48;if([50].includes(n))return 50;if([49,55,57].includes(n))return 49;if([51,53,59].includes(n))return 51;return null;
}
function setPerformanceActive(note,on){const el=document.querySelector(`[data-note="${note}"]`);if(el)el.classList.toggle("active",on);}
function showError(err){document.getElementById("status").textContent=`エラー: ${err.message||err}`;}
function engineDetail(p){
  if(p.engine_type==="sampler")return"PCM Multisample · Fretless Bass";
  if(p.engine_type==="drum")return"PCM One-shot · Studio Drum Kit";
  if(p.engine_type==="fm")return"FM Engine · DX-style Electric Piano";
  return"Subtractive Synth";
}
function updateInstrumentSurface(){
  const drum=currentPatch.engine_type==="drum";document.getElementById("keyboardWrap").hidden=drum;document.getElementById("drumKitWrap").hidden=!drum;
  const select=document.getElementById("sampleSelect"),options=SAMPLE_OPTIONS[currentPatch.engine_type]||SAMPLE_OPTIONS.synth;select.innerHTML="";
  for(const [value,label] of options){const opt=document.createElement("option");opt.value=value;opt.textContent=label;select.appendChild(opt);}
  if(drum&&currentPatch.drum_style==="half_time_shuffle")select.value="drum_shuffle";
  document.getElementById("sampleDescription").textContent=drum?"PCMドラムキットのグルーヴを確認できます。":currentPatch.engine_type==="sampler"?"指ノイズ、スライド、mwahを含むPCMベースを確認できます。":currentPatch.engine_type==="fm"?"FMエレピのコード感とアタックを確認できます。":"生成した音色を短いフレーズで確認できます。";
}
function renderPatch(){
  currentPatch=engine.patch;document.getElementById("patchName").textContent=currentPatch.name;
  document.getElementById("engineBadge").textContent=currentPatch.engine_type.toUpperCase();document.getElementById("engineDetail").textContent=engineDetail(currentPatch);
  updateInstrumentSurface();renderParameters();
}
function formatValue(key,value){
  if(["filter_cutoff_hz","kick_tune_hz","snare_tone_hz"].includes(key))return `${Math.round(value)} Hz`;
  if(key.endsWith("_s"))return `${Number(value).toFixed(value<1?2:1)} s`;
  return Number.isInteger(value)?String(value):Number(value).toFixed(2);
}
function renderParameters(){
  const root=document.getElementById("params");root.innerHTML="";const defs=PARAM_DEFS[currentPatch.engine_type]||PARAM_DEFS.synth;
  for(const def of defs){
    const [key,label,typeOrMin,max,step]=def,card=document.createElement("div");card.className="param-control";
    const header=document.createElement("div");header.className="param-control-head";header.innerHTML=`<span>${label}</span><output>${typeof currentPatch[key]==="number"?formatValue(key,currentPatch[key]):currentPatch[key]}</output>`;card.appendChild(header);
    if(typeOrMin==="select"){
      const select=document.createElement("select");for(const value of max){const opt=document.createElement("option");opt.value=value;opt.textContent=value;select.appendChild(opt);}select.value=currentPatch[key];
      select.addEventListener("change",()=>applyParam(key,select.value));card.appendChild(select);
    }else{
      const min=typeOrMin,value=Number(currentPatch[key]),dial=document.createElement("div");dial.className="param-dial";dial.setAttribute("aria-hidden","true");
      const pct=(value-min)/(max-min);dial.style.setProperty("--pct",`${clamp(pct,0,1)*75}%`);dial.style.setProperty("--dial-ratio",String(clamp(pct,0,1)));card.appendChild(dial);
      const input=document.createElement("input");input.type="range";input.min=min;input.max=max;input.step=step;input.value=value;input.dataset.param=key;
      input.addEventListener("input",()=>{applyParam(key,Number(input.value),false);const p=(Number(input.value)-min)/(max-min);dial.style.setProperty("--pct",`${clamp(p,0,1)*75}%`);dial.style.setProperty("--dial-ratio",String(clamp(p,0,1)));header.querySelector("output").textContent=formatValue(key,Number(input.value));});
      input.addEventListener("change",()=>renderParameters());card.appendChild(input);
    }
    root.appendChild(card);
  }
}
function applyParam(key,value,rerender=true){engine.setPatch({...currentPatch,[key]:value});if(rerender)renderParameters();document.getElementById("status").textContent=`${key} を調整しました。`;}
function setSamplePlaying(on){samplePlaying=on;document.getElementById("samplePlayBtn").disabled=on;document.getElementById("sampleStopBtn").disabled=!on;document.getElementById("sampleSelect").disabled=on;}
function stopSample({announce=true}={}){
  const was=samplePlaying;sampleRunId++;for(const t of sampleTimers)clearTimeout(t);sampleTimers=[];
  for(const note of sampleActiveNotes)engine.noteOff(note);sampleActiveNotes.clear();setSamplePlaying(false);
  if(announce&&was)document.getElementById("status").textContent="サンプル演奏を停止しました。";
}
function stepEvents(step){return step.events||((step.notes||[]).map(note=>({note,velocity:.82})));}
async function playSample(){
  stopSample({announce:false});const perf=SAMPLE_PERFORMANCES[document.getElementById("sampleSelect").value]||SAMPLE_PERFORMANCES.melody;
  try{await engine.init();}catch(err){showError(err);return;}const runId=sampleRunId,beatMs=60000/perf.bpm;let cursor=80;setSamplePlaying(true);
  document.getElementById("status").textContent=`${perf.label}を「${currentPatch.name}」でサンプル演奏中…`;
  for(const step of perf.steps){
    const duration=Math.max(70,step.beats*beatMs),events=stepEvents(step),gate=Math.max(60,duration*.78);
    sampleTimers.push(setTimeout(()=>{if(runId!==sampleRunId)return;for(const e of events){sampleActiveNotes.add(e.note);engine.noteOn(e.note,e.velocity??.82);}},cursor));
    sampleTimers.push(setTimeout(()=>{if(runId!==sampleRunId)return;for(const e of events){engine.noteOff(e.note);sampleActiveNotes.delete(e.note);}},cursor+gate));
    cursor+=duration;
  }
  sampleTimers.push(setTimeout(()=>{if(runId!==sampleRunId)return;sampleActiveNotes.clear();sampleTimers=[];setSamplePlaying(false);document.getElementById("status").textContent=`サンプル演奏完了 · ${perf.label}`;},cursor+700));
}
async function generate(){
  stopSample({announce:false});const prompt=document.getElementById("prompt").value;document.getElementById("status").textContent="音色を生成中…";
  try{
    const r=await fetch("/api/generate-patch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})}),data=await r.json();
    if(!r.ok)throw new Error(data.error||"generation failed");generatedPatch=validatePatch(data.patch);engine.setPatch(generatedPatch);
    document.getElementById("status").textContent=`生成完了 · ${data.engine} · ${engineDetail(generatedPatch)}`;
  }catch(err){showError(err);}
}
function exportPatch(){const blob=new Blob([JSON.stringify(currentPatch,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${currentPatch.name.replace(/[^\w\-]+/g,"_")}.json`;a.click();URL.revokeObjectURL(a.href);}
async function importPatch(file){
  stopSample({announce:false});const raw=JSON.parse(await file.text()),r=await fetch("/api/validate-patch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({patch:raw})}),data=await r.json();
  if(!r.ok)throw new Error(data.error||"invalid patch");generatedPatch=validatePatch(data.patch);engine.setPatch(generatedPatch);
}
async function setupMidi(){
  if(!navigator.requestMIDIAccess)return;try{const access=await navigator.requestMIDIAccess();for(const input of access.inputs.values())input.onmidimessage=e=>{
    const [cmd,note,vel]=e.data,type=cmd&0xf0;if(type===0x90&&vel>0){stopSample({announce:false});engine.init().then(()=>engine.noteOn(note,vel/127)).catch(showError);}
    else if(type===0x80||(type===0x90&&vel===0))engine.noteOff(note);
  };}catch(_){}
}
function currentKeyMap(){return currentPatch.engine_type==="drum"?DRUM_KEY_MAP:SYNTH_KEY_MAP;}
function meterLoop(){if(!engine.analyser)return;const arr=new Uint8Array(engine.analyser.frequencyBinCount);engine.analyser.getByteFrequencyData(arr);const avg=arr.reduce((a,b)=>a+b,0)/arr.length;document.getElementById("meterBar").style.width=`${Math.min(100,2+avg*.9)}%`;requestAnimationFrame(meterLoop);}

document.getElementById("audioBtn").addEventListener("click",async()=>{try{await engine.init();document.getElementById("status").textContent="音源ON · Factory PCM loaded · 鍵盤、ドラム、MIDI、サンプル演奏を利用できます。";}catch(err){showError(err);}});
document.getElementById("generateBtn").addEventListener("click",generate);
document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{document.getElementById("prompt").value=b.dataset.prompt;generate();}));
document.getElementById("samplePlayBtn").addEventListener("click",playSample);document.getElementById("sampleStopBtn").addEventListener("click",()=>stopSample());
document.getElementById("resetParamsBtn").addEventListener("click",()=>{stopSample({announce:false});engine.setPatch(generatedPatch);document.getElementById("status").textContent="生成時のパラメータへ戻しました。";});
document.getElementById("exportBtn").addEventListener("click",exportPatch);
document.getElementById("importInput").addEventListener("change",async e=>{if(e.target.files[0])try{await importPatch(e.target.files[0]);document.getElementById("status").textContent="Patch JSONを読み込みました。";}catch(err){showError(err);}});
window.addEventListener("keydown",async e=>{
  const map=currentKeyMap();if(e.repeat||!map[e.code]||["TEXTAREA","INPUT","SELECT"].includes(e.target.tagName))return;e.preventDefault();stopSample({announce:false});
  try{await engine.init();}catch(err){showError(err);return;}held.add(e.code);engine.noteOn(map[e.code],.84);
});
window.addEventListener("keyup",e=>{const map=currentKeyMap();if(!map[e.code]||!held.has(e.code))return;held.delete(e.code);engine.noteOff(map[e.code]);});

buildKeyboard();buildDrumKit();engine.setPatch(DEFAULT_PATCH);generatedPatch={...currentPatch};setSamplePlaying(false);setupMidi();
window.synthEngine=engine;
