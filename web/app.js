"use strict";

const DEFAULT_PATCH = {
  name: "Init Patch", engine_type: "synth", drum_style: "standard",
  osc1_wave: "sawtooth", osc2_wave: "sawtooth", osc_mix: .45,
  osc2_detune_cents: 7, octave_shift: 0, filter_cutoff_hz: 4200, filter_q: .9,
  attack_s: .02, decay_s: .25, sustain: .72, release_s: .5,
  lfo_rate_hz: 0, lfo_depth_cents: 0, delay_time_s: 0, delay_feedback: 0,
  delay_mix: 0, kick_tune_hz: 58, kick_decay_s: .28, snare_tone_hz: 185,
  snare_decay_s: .22, hat_decay_s: .09, tom_decay_s: .42,
  drum_brightness: .68, drum_room_mix: .12,
  master_gain: .22, max_polyphony: 12, prompt: ""
};
const WAVES = new Set(["sine","triangle","sawtooth","square"]);
const ENGINE_TYPES = new Set(["synth","drum"]);
const DRUM_STYLES = new Set(["standard","half_time_shuffle"]);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v)));

const SAMPLE_PERFORMANCES = Object.freeze({
  melody: {
    label: "メロディ",
    bpm: 108,
    steps: [
      {notes:[60], beats:.5}, {notes:[64], beats:.5}, {notes:[67], beats:.5}, {notes:[69], beats:.5},
      {notes:[67], beats:.5}, {notes:[64], beats:.5}, {notes:[62], beats:.5}, {notes:[60], beats:1}
    ]
  },
  chords: {
    label: "コード",
    bpm: 82,
    steps: [
      {notes:[60,64,67], beats:2}, {notes:[65,69,72], beats:2},
      {notes:[67,71,74], beats:2}, {notes:[60,64,67], beats:2}
    ]
  },
  bass: {
    label: "ベースライン",
    bpm: 116,
    steps: [
      {notes:[36], beats:.5}, {notes:[36], beats:.5}, {notes:[43], beats:.5}, {notes:[46], beats:.5},
      {notes:[36], beats:.5}, {notes:[43], beats:.5}, {notes:[41], beats:.5}, {notes:[43], beats:.5}
    ]
  },
  drum_shuffle: {
    label: "ハーフタイム・シャッフル",
    bpm: 88,
    steps: buildHalfTimeShuffleSteps()
  },
  drum_straight: {
    label: "ストレート・ドラム",
    bpm: 104,
    steps: buildStraightDrumSteps()
  }
});

const SYNTH_SAMPLE_OPTIONS = [
  ["melody", "メロディ"], ["chords", "コード"], ["bass", "ベースライン"]
];
const DRUM_SAMPLE_OPTIONS = [
  ["drum_shuffle", "ハーフタイム・シャッフル"], ["drum_straight", "ストレート・ドラム"]
];

const SYNTH_KEY_MAP = {KeyA:60,KeyW:61,KeyS:62,KeyE:63,KeyD:64,KeyF:65,KeyT:66,KeyG:67,KeyY:68,KeyH:69,KeyU:70,KeyJ:71,KeyK:72};
const DRUM_KEY_MAP = {KeyA:36,KeyS:38,KeyD:42,KeyF:46,KeyG:45,KeyH:48,KeyJ:50,KeyK:49,KeyL:51};
const DRUM_PADS = [
  {note:36,label:"Kick",key:"A"}, {note:38,label:"Snare",key:"S"}, {note:42,label:"Closed Hat",key:"D"},
  {note:46,label:"Open Hat",key:"F"}, {note:45,label:"Low Tom",key:"G"}, {note:48,label:"Mid Tom",key:"H"},
  {note:50,label:"High Tom",key:"J"}, {note:49,label:"Crash",key:"K"}, {note:51,label:"Ride",key:"L"}
];

function buildHalfTimeShuffleSteps(){
  const steps=[];
  for(let i=0;i<24;i++){
    const pos=i%3, beat=Math.floor(i/3)%4, bar=Math.floor(i/12);
    const events=[];
    if(pos===0 || pos===2) events.push({note:42,velocity:pos===0?.58:.42});
    if(pos===1) events.push({note:38,velocity:.20});
    if(beat===2 && pos===0) events.push({note:38,velocity:.94});
    const local=i%12;
    const kickHits=bar===0 ? [0,5,9] : [0,4,8,11];
    if(kickHits.includes(local)) events.push({note:36,velocity:.82});
    if(local===11) events.push({note:46,velocity:.34});
    steps.push({events,beats:1/3});
  }
  return steps;
}

function buildStraightDrumSteps(){
  const steps=[];
  for(let i=0;i<16;i++){
    const events=[{note:42,velocity:i%2===0?.52:.38}];
    if(i===0 || i===8 || i===10) events.push({note:36,velocity:.86});
    if(i===4 || i===12) events.push({note:38,velocity:.90});
    steps.push({events,beats:.25});
  }
  return steps;
}

function validatePatch(raw) {
  const p = {...DEFAULT_PATCH, ...(raw || {})};
  const engineType=ENGINE_TYPES.has(String(p.engine_type)) ? String(p.engine_type) : "synth";
  const drumStyle=DRUM_STYLES.has(String(p.drum_style)) ? String(p.drum_style) : "standard";
  return {
    name: String(p.name || "Imported Patch").slice(0,80),
    engine_type: engineType,
    drum_style: drumStyle,
    osc1_wave: WAVES.has(p.osc1_wave) ? p.osc1_wave : "sawtooth",
    osc2_wave: WAVES.has(p.osc2_wave) ? p.osc2_wave : "sawtooth",
    osc_mix: clamp(p.osc_mix,0,1), osc2_detune_cents: clamp(p.osc2_detune_cents,-50,50),
    octave_shift: Math.round(clamp(p.octave_shift,-2,2)), filter_cutoff_hz: clamp(p.filter_cutoff_hz,80,18000),
    filter_q: clamp(p.filter_q,.1,18), attack_s: clamp(p.attack_s,.001,8), decay_s: clamp(p.decay_s,.001,8),
    sustain: clamp(p.sustain,0,1), release_s: clamp(p.release_s,.01,10), lfo_rate_hz: clamp(p.lfo_rate_hz,0,20),
    lfo_depth_cents: clamp(p.lfo_depth_cents,0,80), delay_time_s: clamp(p.delay_time_s,0,1.5),
    delay_feedback: clamp(p.delay_feedback,0,.75), delay_mix: clamp(p.delay_mix,0,.65),
    kick_tune_hz: clamp(p.kick_tune_hz,35,120), kick_decay_s: clamp(p.kick_decay_s,.05,1.2),
    snare_tone_hz: clamp(p.snare_tone_hz,90,300), snare_decay_s: clamp(p.snare_decay_s,.05,1),
    hat_decay_s: clamp(p.hat_decay_s,.02,.5), tom_decay_s: clamp(p.tom_decay_s,.08,1.5),
    drum_brightness: clamp(p.drum_brightness,0,1), drum_room_mix: clamp(p.drum_room_mix,0,.45),
    master_gain: clamp(p.master_gain,.02,.35), max_polyphony: Math.round(clamp(p.max_polyphony,1,16)),
    prompt: String(p.prompt || "").slice(0,500)
  };
}

class SynthEngine {
  constructor() {
    this.ctx=null; this.patch=validatePatch(DEFAULT_PATCH); this.voices=new Map();
    this.master=null; this.analyser=null; this.noiseBuffer=null; this.drumRoomDelay=null; this.drumRoomGain=null;
  }
  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.patch.master_gain;
      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 256;
      this.master.connect(this.analyser); this.analyser.connect(this.ctx.destination);
      this.noiseBuffer=this.createNoiseBuffer();
      this.drumRoomDelay=this.ctx.createDelay(.25); this.drumRoomDelay.delayTime.value=.055;
      this.drumRoomGain=this.ctx.createGain(); this.drumRoomGain.gain.value=this.patch.drum_room_mix;
      this.drumRoomDelay.connect(this.drumRoomGain); this.drumRoomGain.connect(this.master);
      meterLoop();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }
  createNoiseBuffer(){
    const length=Math.ceil(this.ctx.sampleRate*2), buffer=this.ctx.createBuffer(1,length,this.ctx.sampleRate), data=buffer.getChannelData(0);
    for(let i=0;i<length;i++) data[i]=Math.random()*2-1;
    return buffer;
  }
  setPatch(raw) {
    this.patch=validatePatch(raw);
    if (this.master) this.master.gain.setTargetAtTime(this.patch.master_gain,this.ctx.currentTime,.02);
    if (this.drumRoomGain) this.drumRoomGain.gain.setTargetAtTime(this.patch.drum_room_mix,this.ctx.currentTime,.02);
    renderPatch();
  }
  freq(midi) { const m = clamp(Math.round(midi),0,127) + this.patch.octave_shift*12; return 440 * Math.pow(2,(m-69)/12); }
  noteOn(midiNote, velocity=.85, whenSeconds=0) {
    if (!this.ctx) return;
    if (this.patch.engine_type === "drum") { this.playDrum(midiNote,velocity,whenSeconds); return; }
    const note=clamp(Math.round(midiNote),0,127); if (this.voices.has(note)) this.noteOff(note,0);
    while (this.voices.size >= this.patch.max_polyphony) this.noteOff(this.voices.keys().next().value,0);
    const now=this.ctx.currentTime + Math.max(0,Number(whenSeconds)||0), p=this.patch, f=this.freq(note);
    const voiceGain=this.ctx.createGain(); voiceGain.gain.setValueAtTime(.0001,now);
    const filter=this.ctx.createBiquadFilter(); filter.type="lowpass"; filter.frequency.setValueAtTime(p.filter_cutoff_hz,now); filter.Q.value=p.filter_q;
    const dry=this.ctx.createGain(), wet=this.ctx.createGain(), delay=this.ctx.createDelay(1.5), fb=this.ctx.createGain();
    dry.gain.value=1-p.delay_mix; wet.gain.value=p.delay_mix; delay.delayTime.value=p.delay_time_s; fb.gain.value=p.delay_feedback;
    filter.connect(dry); dry.connect(voiceGain); filter.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(voiceGain); voiceGain.connect(this.master);
    const o1=this.ctx.createOscillator(), o2=this.ctx.createOscillator(); const g1=this.ctx.createGain(), g2=this.ctx.createGain();
    o1.type=p.osc1_wave; o2.type=p.osc2_wave; o1.frequency.setValueAtTime(f,now); o2.frequency.setValueAtTime(f,now); o2.detune.value=p.osc2_detune_cents;
    g1.gain.value=1-p.osc_mix; g2.gain.value=p.osc_mix; o1.connect(g1); o2.connect(g2); g1.connect(filter); g2.connect(filter);
    let lfo=null,lfoGain=null; if (p.lfo_rate_hz>0 && p.lfo_depth_cents>0) { lfo=this.ctx.createOscillator(); lfoGain=this.ctx.createGain(); lfo.frequency.value=p.lfo_rate_hz; lfoGain.gain.value=p.lfo_depth_cents; lfo.connect(lfoGain); lfoGain.connect(o1.detune); lfoGain.connect(o2.detune); lfo.start(now); }
    const peak=Math.max(.02,clamp(velocity,0,1)); const aEnd=now+p.attack_s, dEnd=aEnd+p.decay_s;
    voiceGain.gain.exponentialRampToValueAtTime(peak,aEnd); voiceGain.gain.linearRampToValueAtTime(Math.max(.0001,peak*p.sustain),dEnd);
    o1.start(now); o2.start(now); this.voices.set(note,{o1,o2,lfo,voiceGain,filter,dry,wet,delay,fb}); setPerformanceActive(note,true);
  }
  noteOff(midiNote, whenSeconds=0) {
    if (!this.ctx) return;
    if (this.patch.engine_type === "drum") { setPerformanceActive(canonicalDrumNote(midiNote),false); return; }
    const note=clamp(Math.round(midiNote),0,127), v=this.voices.get(note); if (!v) return;
    const now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0), stop=now+this.patch.release_s+.08;
    v.voiceGain.gain.cancelScheduledValues(now); v.voiceGain.gain.setTargetAtTime(.0001,now,Math.max(.005,this.patch.release_s/5));
    v.o1.stop(stop); v.o2.stop(stop); if(v.lfo) v.lfo.stop(stop); this.voices.delete(note); setPerformanceActive(note,false);
  }
  connectDrumOutput(node){ node.connect(this.master); if(this.drumRoomDelay) node.connect(this.drumRoomDelay); }
  playDrum(midiNote, velocity=.85, whenSeconds=0){
    const note=canonicalDrumNote(midiNote); if(note===null)return;
    const now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0), peak=Math.max(.02,clamp(velocity,0,1));
    if(note===36) this.playKick(now,peak);
    else if(note===38) this.playSnare(now,peak);
    else if(note===42 || note===46) this.playHat(now,peak,note===46);
    else if(note===45 || note===48 || note===50) this.playTom(now,peak,note);
    else if(note===49 || note===51) this.playCymbal(now,peak,note===49);
    setPerformanceActive(note,true);
    setTimeout(()=>setPerformanceActive(note,false), note===46||note===49||note===51 ? 180 : 100);
  }
  playKick(now,peak){
    const p=this.patch, osc=this.ctx.createOscillator(), gain=this.ctx.createGain();
    osc.type="sine"; osc.frequency.setValueAtTime(p.kick_tune_hz*2.8,now); osc.frequency.exponentialRampToValueAtTime(p.kick_tune_hz,now+.055);
    gain.gain.setValueAtTime(peak,now); gain.gain.exponentialRampToValueAtTime(.0001,now+p.kick_decay_s);
    osc.connect(gain); this.connectDrumOutput(gain); osc.start(now); osc.stop(now+p.kick_decay_s+.06);
  }
  playSnare(now,peak){
    const p=this.patch;
    const noise=this.ctx.createBufferSource(), noiseFilter=this.ctx.createBiquadFilter(), noiseGain=this.ctx.createGain();
    noise.buffer=this.noiseBuffer; noiseFilter.type="highpass"; noiseFilter.frequency.value=900+p.drum_brightness*2600;
    noiseGain.gain.setValueAtTime(peak*.78,now); noiseGain.gain.exponentialRampToValueAtTime(.0001,now+p.snare_decay_s);
    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); this.connectDrumOutput(noiseGain); noise.start(now); noise.stop(now+p.snare_decay_s+.05);
    const tone=this.ctx.createOscillator(), toneGain=this.ctx.createGain(); tone.type="triangle"; tone.frequency.value=p.snare_tone_hz;
    toneGain.gain.setValueAtTime(peak*.34,now); toneGain.gain.exponentialRampToValueAtTime(.0001,now+Math.min(.18,p.snare_decay_s));
    tone.connect(toneGain); this.connectDrumOutput(toneGain); tone.start(now); tone.stop(now+Math.min(.22,p.snare_decay_s+.03));
  }
  playHat(now,peak,isOpen){
    const p=this.patch, noise=this.ctx.createBufferSource(), hp=this.ctx.createBiquadFilter(), gain=this.ctx.createGain();
    const decay=isOpen ? Math.max(.22,p.hat_decay_s*3.8) : p.hat_decay_s;
    noise.buffer=this.noiseBuffer; hp.type="highpass"; hp.frequency.value=5200+p.drum_brightness*4300;
    gain.gain.setValueAtTime(peak*(isOpen?.42:.32),now); gain.gain.exponentialRampToValueAtTime(.0001,now+decay);
    noise.connect(hp); hp.connect(gain); this.connectDrumOutput(gain); noise.start(now); noise.stop(now+decay+.04);
  }
  playTom(now,peak,note){
    const p=this.patch, freq=note===45?105:note===48?145:190, osc=this.ctx.createOscillator(), gain=this.ctx.createGain();
    osc.type="sine"; osc.frequency.setValueAtTime(freq*1.22,now); osc.frequency.exponentialRampToValueAtTime(freq,now+.05);
    gain.gain.setValueAtTime(peak*.72,now); gain.gain.exponentialRampToValueAtTime(.0001,now+p.tom_decay_s);
    osc.connect(gain); this.connectDrumOutput(gain); osc.start(now); osc.stop(now+p.tom_decay_s+.05);
  }
  playCymbal(now,peak,isCrash){
    const p=this.patch, noise=this.ctx.createBufferSource(), hp=this.ctx.createBiquadFilter(), bp=this.ctx.createBiquadFilter(), gain=this.ctx.createGain();
    const decay=isCrash ? 1.25 : .72;
    noise.buffer=this.noiseBuffer; hp.type="highpass"; hp.frequency.value=3600+p.drum_brightness*2800; bp.type="bandpass"; bp.frequency.value=isCrash?7600:6200; bp.Q.value=.55;
    gain.gain.setValueAtTime(peak*(isCrash?.34:.26),now); gain.gain.exponentialRampToValueAtTime(.0001,now+decay);
    noise.connect(hp); hp.connect(bp); bp.connect(gain); this.connectDrumOutput(gain); noise.start(now); noise.stop(now+decay+.05);
  }
}

function canonicalDrumNote(midiNote){
  const n=Math.round(clamp(midiNote,0,127));
  if(n===35||n===36)return 36;
  if(n===37||n===38||n===40)return 38;
  if(n===42||n===44)return 42;
  if(n===46)return 46;
  if(n===41||n===43||n===45)return 45;
  if(n===47||n===48)return 48;
  if(n===50)return 50;
  if(n===49||n===55||n===57)return 49;
  if(n===51||n===53||n===59)return 51;
  return null;
}

const engine=new SynthEngine(); let currentPatch=validatePatch(DEFAULT_PATCH);
const held=new Set();
let sampleTimers=[]; let sampleRunId=0; let samplePlaying=false; const sampleActiveNotes=new Set();

function buildKeyboard(){
  const root=document.getElementById("keyboard"), black=new Set([1,3,6,8,10]); root.innerHTML="";
  for(let note=48;note<=72;note++){
    const pc=note%12, el=document.createElement("button"); el.className=`key ${black.has(pc)?"black":"white"}`; el.dataset.note=note;
    const label=Object.entries(SYNTH_KEY_MAP).find(([,n])=>n===note)?.[0].replace("Key","") || ""; el.innerHTML=`<span>${label}</span>`;
    const down=async e=>{e.preventDefault();stopSample({announce:false});await engine.init();if(!held.has(`p${note}`)){held.add(`p${note}`);engine.noteOn(note,.86);}};
    const up=e=>{e.preventDefault();held.delete(`p${note}`);engine.noteOff(note);};
    el.addEventListener("pointerdown",down); el.addEventListener("pointerup",up); el.addEventListener("pointerleave",e=>{if(held.has(`p${note}`))up(e);}); root.appendChild(el);
  }
}
function buildDrumKit(){
  const root=document.getElementById("drumKit"); root.innerHTML="";
  for(const pad of DRUM_PADS){
    const el=document.createElement("button"); el.className="drum-pad"; el.dataset.note=pad.note;
    el.innerHTML=`<strong>${pad.label}</strong><span>${pad.key}</span>`;
    el.addEventListener("pointerdown",async e=>{e.preventDefault();stopSample({announce:false});await engine.init();engine.noteOn(pad.note,.86);});
    root.appendChild(el);
  }
}
function setPerformanceActive(note,on){const el=document.querySelector(`[data-note="${note}"]`); if(el) el.classList.toggle("active",on);}

function updateSampleOptions(){
  const select=document.getElementById("sampleSelect"), options=currentPatch.engine_type==="drum"?DRUM_SAMPLE_OPTIONS:SYNTH_SAMPLE_OPTIONS;
  select.innerHTML="";
  for(const [value,label] of options){const opt=document.createElement("option");opt.value=value;opt.textContent=label;select.appendChild(opt);}
  if(currentPatch.engine_type==="drum" && currentPatch.drum_style==="half_time_shuffle") select.value="drum_shuffle";
  document.getElementById("sampleDescription").textContent=currentPatch.engine_type==="drum"
    ? "現在のドラムキットを短いグルーヴで確認できます。"
    : "生成した音色を短いフレーズで確認できます。";
}
function renderPerformanceSurface(){
  const isDrum=currentPatch.engine_type==="drum";
  document.getElementById("keyboardWrap").hidden=isDrum;
  document.getElementById("drumKitWrap").hidden=!isDrum;
  document.getElementById("engineBadge").textContent=isDrum?"DRUM KIT":"SYNTH";
  updateSampleOptions();
}
function renderPatch(){
  currentPatch=engine.patch; document.getElementById("patchName").textContent=currentPatch.name; renderPerformanceSurface();
  const root=document.getElementById("params"); root.innerHTML="";
  const synthLabels={engine_type:"Engine",osc1_wave:"OSC 1",osc2_wave:"OSC 2",osc_mix:"OSC Mix",osc2_detune_cents:"Detune",octave_shift:"Octave",filter_cutoff_hz:"Cutoff Hz",filter_q:"Filter Q",attack_s:"Attack s",decay_s:"Decay s",sustain:"Sustain",release_s:"Release s",lfo_rate_hz:"LFO Hz",lfo_depth_cents:"LFO depth",delay_time_s:"Delay s",delay_feedback:"Feedback",delay_mix:"Delay Mix",master_gain:"Master",max_polyphony:"Voices"};
  const drumLabels={engine_type:"Engine",drum_style:"Style",kick_tune_hz:"Kick Tune Hz",kick_decay_s:"Kick Decay s",snare_tone_hz:"Snare Tone Hz",snare_decay_s:"Snare Decay s",hat_decay_s:"Hat Decay s",tom_decay_s:"Tom Decay s",drum_brightness:"Brightness",drum_room_mix:"Room Mix",master_gain:"Master"};
  const labels=currentPatch.engine_type==="drum"?drumLabels:synthLabels;
  for(const [k,label] of Object.entries(labels)){const d=document.createElement("div");d.className="param";const v=typeof currentPatch[k]==="number"?Number(currentPatch[k].toFixed(3)):currentPatch[k];d.innerHTML=`<div class="label">${label}</div><div class="value">${v}</div>`;root.appendChild(d);}
}
function setSamplePlaying(on){
  samplePlaying=on;
  document.getElementById("samplePlayBtn").disabled=on;
  document.getElementById("sampleStopBtn").disabled=!on;
  document.getElementById("sampleSelect").disabled=on;
}
function stopSample({announce=true}={}){
  const wasPlaying=samplePlaying;
  sampleRunId+=1;
  for(const timer of sampleTimers) clearTimeout(timer);
  sampleTimers=[];
  for(const note of sampleActiveNotes) engine.noteOff(note);
  sampleActiveNotes.clear();
  setSamplePlaying(false);
  if(announce && wasPlaying) document.getElementById("status").textContent="サンプル演奏を停止しました。";
}
function stepEvents(step){
  if(Array.isArray(step.events)) return step.events;
  return (step.notes||[]).map(note=>({note,velocity:.82}));
}
async function playSample(){
  stopSample({announce:false});
  const select=document.getElementById("sampleSelect");
  const fallback=currentPatch.engine_type==="drum"?SAMPLE_PERFORMANCES.drum_shuffle:SAMPLE_PERFORMANCES.melody;
  const performance=SAMPLE_PERFORMANCES[select.value] || fallback;
  await engine.init();
  const runId=sampleRunId;
  const beatMs=60000/performance.bpm;
  let cursorMs=80;
  setSamplePlaying(true);
  document.getElementById("status").textContent=`${performance.label}を「${currentPatch.name}」でサンプル演奏中…`;
  for(const step of performance.steps){
    const durationMs=Math.max(50,step.beats*beatMs), events=stepEvents(step);
    const gateMs=Math.max(45,durationMs*(currentPatch.engine_type==="drum"?.48:.78));
    sampleTimers.push(setTimeout(()=>{
      if(runId!==sampleRunId)return;
      for(const event of events){sampleActiveNotes.add(event.note);engine.noteOn(event.note,event.velocity??.82);}
    },cursorMs));
    sampleTimers.push(setTimeout(()=>{
      if(runId!==sampleRunId)return;
      for(const event of events){engine.noteOff(event.note);sampleActiveNotes.delete(event.note);}
    },cursorMs+gateMs));
    cursorMs+=durationMs;
  }
  const tail=currentPatch.engine_type==="drum"?900:Math.min(1200,Math.max(120,currentPatch.release_s*350));
  sampleTimers.push(setTimeout(()=>{
    if(runId!==sampleRunId)return;
    sampleActiveNotes.clear(); sampleTimers=[]; setSamplePlaying(false);
    document.getElementById("status").textContent=`サンプル演奏完了 · ${performance.label} · ${currentPatch.name}`;
  },cursorMs+tail));
}
async function generate(){stopSample({announce:false});const prompt=document.getElementById("prompt").value; document.getElementById("status").textContent="音色を生成中…";
  try{const r=await fetch("/api/generate-patch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});const data=await r.json();if(!r.ok)throw new Error(data.error||"generation failed");engine.setPatch(data.patch);document.getElementById("status").textContent=`生成完了 · ${data.engine} · ${currentPatch.engine_type==="drum"?"ドラムセット":"鍵盤音源"}`;}catch(e){document.getElementById("status").textContent=`エラー: ${e.message}`;}}
function exportPatch(){const blob=new Blob([JSON.stringify(currentPatch,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${currentPatch.name.replace(/[^\w\-]+/g,"_")}.json`;a.click();URL.revokeObjectURL(a.href);}
async function importPatch(file){stopSample({announce:false});const raw=JSON.parse(await file.text());const r=await fetch("/api/validate-patch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({patch:raw})});const data=await r.json();if(!r.ok)throw new Error(data.error||"invalid patch");engine.setPatch(data.patch);}
async function setupMidi(){if(!navigator.requestMIDIAccess)return;try{const access=await navigator.requestMIDIAccess();for(const input of access.inputs.values())input.onmidimessage=e=>{const [cmd,note,vel]=e.data;const type=cmd&0xf0;if(type===0x90&&vel>0){stopSample({announce:false});engine.init().then(()=>engine.noteOn(note,vel/127));}else if(type===0x80||(type===0x90&&vel===0)){engine.noteOff(note);}};}catch(_) {}}
function meterLoop(){if(!engine.analyser)return;const arr=new Uint8Array(engine.analyser.frequencyBinCount);engine.analyser.getByteFrequencyData(arr);const avg=arr.reduce((a,b)=>a+b,0)/arr.length;document.getElementById("meterBar").style.width=`${Math.min(100,2+avg*.9)}%`;requestAnimationFrame(meterLoop);}

function activeKeyMap(){return currentPatch.engine_type==="drum"?DRUM_KEY_MAP:SYNTH_KEY_MAP;}
document.getElementById("audioBtn").addEventListener("click",async()=>{await engine.init();document.getElementById("status").textContent="音源ON · 画面演奏、PCキー、MIDI、サンプル演奏を利用できます。";});
document.getElementById("generateBtn").addEventListener("click",generate); document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{document.getElementById("prompt").value=b.dataset.prompt;generate();}));
document.getElementById("samplePlayBtn").addEventListener("click",playSample); document.getElementById("sampleStopBtn").addEventListener("click",()=>stopSample());
document.getElementById("exportBtn").addEventListener("click",exportPatch); document.getElementById("importInput").addEventListener("change",async e=>{if(e.target.files[0])try{await importPatch(e.target.files[0]);document.getElementById("status").textContent="Patch JSONを読み込みました。";}catch(err){document.getElementById("status").textContent=`読込エラー: ${err.message}`;}});
window.addEventListener("keydown",async e=>{const map=activeKeyMap();if(e.repeat||!map[e.code]||["TEXTAREA","INPUT","SELECT"].includes(e.target.tagName))return;e.preventDefault();stopSample({announce:false});await engine.init();held.add(e.code);engine.noteOn(map[e.code],.84);});
window.addEventListener("keyup",e=>{const map=activeKeyMap();if(!map[e.code]||!held.has(e.code))return;held.delete(e.code);engine.noteOff(map[e.code]);});

buildKeyboard(); buildDrumKit(); engine.setPatch(DEFAULT_PATCH); setSamplePlaying(false); setupMidi();
window.synthEngine=engine; // Stable adapter boundary for future sequencer module.
