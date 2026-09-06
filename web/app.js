"use strict";

const DEFAULT_PATCH = {
  name: "Init Patch", osc1_wave: "sawtooth", osc2_wave: "sawtooth", osc_mix: .45,
  osc2_detune_cents: 7, octave_shift: 0, filter_cutoff_hz: 4200, filter_q: .9,
  attack_s: .02, decay_s: .25, sustain: .72, release_s: .5,
  lfo_rate_hz: 0, lfo_depth_cents: 0, delay_time_s: 0, delay_feedback: 0,
  delay_mix: 0, master_gain: .22, max_polyphony: 12, prompt: ""
};
const WAVES = new Set(["sine","triangle","sawtooth","square"]);
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
  }
});

function validatePatch(raw) {
  const p = {...DEFAULT_PATCH, ...(raw || {})};
  return {
    name: String(p.name || "Imported Patch").slice(0,80),
    osc1_wave: WAVES.has(p.osc1_wave) ? p.osc1_wave : "sawtooth",
    osc2_wave: WAVES.has(p.osc2_wave) ? p.osc2_wave : "sawtooth",
    osc_mix: clamp(p.osc_mix,0,1), osc2_detune_cents: clamp(p.osc2_detune_cents,-50,50),
    octave_shift: Math.round(clamp(p.octave_shift,-2,2)), filter_cutoff_hz: clamp(p.filter_cutoff_hz,80,18000),
    filter_q: clamp(p.filter_q,.1,18), attack_s: clamp(p.attack_s,.001,8), decay_s: clamp(p.decay_s,.001,8),
    sustain: clamp(p.sustain,0,1), release_s: clamp(p.release_s,.01,10), lfo_rate_hz: clamp(p.lfo_rate_hz,0,20),
    lfo_depth_cents: clamp(p.lfo_depth_cents,0,80), delay_time_s: clamp(p.delay_time_s,0,1.5),
    delay_feedback: clamp(p.delay_feedback,0,.75), delay_mix: clamp(p.delay_mix,0,.65),
    master_gain: clamp(p.master_gain,.02,.35), max_polyphony: Math.round(clamp(p.max_polyphony,1,16)),
    prompt: String(p.prompt || "").slice(0,500)
  };
}

class SynthEngine {
  constructor() { this.ctx=null; this.patch=validatePatch(DEFAULT_PATCH); this.voices=new Map(); this.master=null; this.analyser=null; }
  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.patch.master_gain;
      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 256;
      this.master.connect(this.analyser); this.analyser.connect(this.ctx.destination);
      meterLoop();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }
  setPatch(raw) { this.patch=validatePatch(raw); if (this.master) this.master.gain.setTargetAtTime(this.patch.master_gain,this.ctx.currentTime,.02); renderPatch(); }
  freq(midi) { const m = clamp(Math.round(midi),0,127) + this.patch.octave_shift*12; return 440 * Math.pow(2,(m-69)/12); }
  noteOn(midiNote, velocity=.85, whenSeconds=0) {
    if (!this.ctx) return;
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
    o1.start(now); o2.start(now); this.voices.set(note,{o1,o2,lfo,voiceGain,filter,dry,wet,delay,fb}); setKeyActive(note,true);
  }
  noteOff(midiNote, whenSeconds=0) {
    if (!this.ctx) return; const note=clamp(Math.round(midiNote),0,127), v=this.voices.get(note); if (!v) return;
    const now=this.ctx.currentTime+Math.max(0,Number(whenSeconds)||0), stop=now+this.patch.release_s+.08;
    v.voiceGain.gain.cancelScheduledValues(now); v.voiceGain.gain.setTargetAtTime(.0001,now,Math.max(.005,this.patch.release_s/5));
    v.o1.stop(stop); v.o2.stop(stop); if(v.lfo) v.lfo.stop(stop); this.voices.delete(note); setKeyActive(note,false);
  }
}

const engine=new SynthEngine(); let currentPatch=validatePatch(DEFAULT_PATCH);
const keyMap={KeyA:60,KeyW:61,KeyS:62,KeyE:63,KeyD:64,KeyF:65,KeyT:66,KeyG:67,KeyY:68,KeyH:69,KeyU:70,KeyJ:71,KeyK:72};
const held=new Set();
let sampleTimers=[]; let sampleRunId=0; let samplePlaying=false; const sampleActiveNotes=new Set();

function buildKeyboard(){
  const root=document.getElementById("keyboard"), black=new Set([1,3,6,8,10]);
  for(let note=48;note<=72;note++){
    const pc=note%12, el=document.createElement("button"); el.className=`key ${black.has(pc)?"black":"white"}`; el.dataset.note=note;
    const label=Object.entries(keyMap).find(([,n])=>n===note)?.[0].replace("Key","") || ""; el.innerHTML=`<span>${label}</span>`;
    const down=async e=>{e.preventDefault();stopSample({announce:false});await engine.init();if(!held.has(`p${note}`)){held.add(`p${note}`);engine.noteOn(note,.86);}};
    const up=e=>{e.preventDefault();held.delete(`p${note}`);engine.noteOff(note);};
    el.addEventListener("pointerdown",down); el.addEventListener("pointerup",up); el.addEventListener("pointerleave",e=>{if(held.has(`p${note}`))up(e);}); root.appendChild(el);
  }
}
function setKeyActive(note,on){const el=document.querySelector(`[data-note="${note}"]`); if(el) el.classList.toggle("active",on);}
function renderPatch(){ currentPatch=engine.patch; document.getElementById("patchName").textContent=currentPatch.name; const root=document.getElementById("params"); root.innerHTML="";
  const labels={osc1_wave:"OSC 1",osc2_wave:"OSC 2",osc_mix:"OSC Mix",osc2_detune_cents:"Detune",octave_shift:"Octave",filter_cutoff_hz:"Cutoff Hz",filter_q:"Filter Q",attack_s:"Attack s",decay_s:"Decay s",sustain:"Sustain",release_s:"Release s",lfo_rate_hz:"LFO Hz",lfo_depth_cents:"LFO depth",delay_time_s:"Delay s",delay_feedback:"Feedback",delay_mix:"Delay Mix",master_gain:"Master",max_polyphony:"Voices"};
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
async function playSample(){
  stopSample({announce:false});
  const select=document.getElementById("sampleSelect");
  const performance=SAMPLE_PERFORMANCES[select.value] || SAMPLE_PERFORMANCES.melody;
  await engine.init();
  const runId=sampleRunId;
  const beatMs=60000/performance.bpm;
  let cursorMs=80;
  setSamplePlaying(true);
  document.getElementById("status").textContent=`${performance.label}を「${currentPatch.name}」でサンプル演奏中…`;
  for(const step of performance.steps){
    const durationMs=Math.max(80,step.beats*beatMs);
    const gateMs=Math.max(70,durationMs*.78);
    sampleTimers.push(setTimeout(()=>{
      if(runId!==sampleRunId)return;
      for(const note of step.notes){sampleActiveNotes.add(note);engine.noteOn(note,.82);}
    },cursorMs));
    sampleTimers.push(setTimeout(()=>{
      if(runId!==sampleRunId)return;
      for(const note of step.notes){engine.noteOff(note);sampleActiveNotes.delete(note);}
    },cursorMs+gateMs));
    cursorMs+=durationMs;
  }
  sampleTimers.push(setTimeout(()=>{
    if(runId!==sampleRunId)return;
    sampleActiveNotes.clear(); sampleTimers=[]; setSamplePlaying(false);
    document.getElementById("status").textContent=`サンプル演奏完了 · ${performance.label} · ${currentPatch.name}`;
  },cursorMs+Math.min(1200,Math.max(120,currentPatch.release_s*350))));
}
async function generate(){stopSample({announce:false});const prompt=document.getElementById("prompt").value; document.getElementById("status").textContent="音色を生成中…";
  try{const r=await fetch("/api/generate-patch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});const data=await r.json();if(!r.ok)throw new Error(data.error||"generation failed");engine.setPatch(data.patch);document.getElementById("status").textContent=`生成完了 · ${data.engine}`;}catch(e){document.getElementById("status").textContent=`エラー: ${e.message}`;}}
function exportPatch(){const blob=new Blob([JSON.stringify(currentPatch,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${currentPatch.name.replace(/[^\w\-]+/g,"_")}.json`;a.click();URL.revokeObjectURL(a.href);}
async function importPatch(file){stopSample({announce:false});const raw=JSON.parse(await file.text());const r=await fetch("/api/validate-patch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({patch:raw})});const data=await r.json();if(!r.ok)throw new Error(data.error||"invalid patch");engine.setPatch(data.patch);}
async function setupMidi(){if(!navigator.requestMIDIAccess)return;try{const access=await navigator.requestMIDIAccess();for(const input of access.inputs.values())input.onmidimessage=e=>{const [cmd,note,vel]=e.data;const type=cmd&0xf0;if(type===0x90&&vel>0){stopSample({announce:false});engine.init().then(()=>engine.noteOn(note,vel/127));}else if(type===0x80||(type===0x90&&vel===0)){engine.noteOff(note);}};}catch(_) {}}
function meterLoop(){if(!engine.analyser)return;const arr=new Uint8Array(engine.analyser.frequencyBinCount);engine.analyser.getByteFrequencyData(arr);const avg=arr.reduce((a,b)=>a+b,0)/arr.length;document.getElementById("meterBar").style.width=`${Math.min(100,2+avg*.9)}%`;requestAnimationFrame(meterLoop);}

document.getElementById("audioBtn").addEventListener("click",async()=>{await engine.init();document.getElementById("status").textContent="音源ON · 鍵盤、PCキー、MIDI、サンプル演奏を利用できます。";});
document.getElementById("generateBtn").addEventListener("click",generate); document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{document.getElementById("prompt").value=b.dataset.prompt;generate();}));
document.getElementById("samplePlayBtn").addEventListener("click",playSample); document.getElementById("sampleStopBtn").addEventListener("click",()=>stopSample());
document.getElementById("exportBtn").addEventListener("click",exportPatch); document.getElementById("importInput").addEventListener("change",async e=>{if(e.target.files[0])try{await importPatch(e.target.files[0]);document.getElementById("status").textContent="Patch JSONを読み込みました。";}catch(err){document.getElementById("status").textContent=`読込エラー: ${err.message}`;}});
window.addEventListener("keydown",async e=>{if(e.repeat||!keyMap[e.code]||["TEXTAREA","INPUT","SELECT"].includes(e.target.tagName))return;e.preventDefault();stopSample({announce:false});await engine.init();held.add(e.code);engine.noteOn(keyMap[e.code],.84);});
window.addEventListener("keyup",e=>{if(!keyMap[e.code]||!held.has(e.code))return;held.delete(e.code);engine.noteOff(keyMap[e.code]);});

buildKeyboard(); engine.setPatch(DEFAULT_PATCH); setSamplePlaying(false); setupMidi();
window.synthEngine=engine; // Stable adapter boundary for future sequencer module.
