"use strict";

// v0.9.2 adaptive sample-performance preview.
// Spectral-resynthesis sounds get evaluation phrases matched to their musical role
// (Bass, Pad, Keys, Lead/Brass, Pluck/Bell, Strings/Voice). The runtime reuses the
// existing noteOn/noteOff boundary and does not create another audio or network path.
(() => {
  const ADAPTIVE_PERFORMANCES=Object.freeze({
    bass_groove:{label:"ベース・グルーヴ",bpm:106,steps:[
      {notes:[36],beats:.5},{notes:[36],beats:.25},{notes:[43],beats:.25},{notes:[46],beats:.5},{notes:[48],beats:.5},
      {notes:[36],beats:.5},{notes:[41],beats:.25},{notes:[43],beats:.25},{notes:[46],beats:.5},{notes:[43],beats:.5},{notes:[36],beats:1}
    ]},
    bass_octaves:{label:"低音オクターブ",bpm:100,steps:[
      {notes:[28],beats:.5},{notes:[40],beats:.5},{notes:[31],beats:.5},{notes:[43],beats:.5},
      {notes:[33],beats:.5},{notes:[45],beats:.5},{notes:[35],beats:.5},{notes:[47],beats:.5},
      {notes:[28],beats:1},{notes:[35],beats:.5},{notes:[40],beats:1.5}
    ]},
    bass_walking:{label:"ウォーキング・ベース",bpm:122,steps:[
      {notes:[36],beats:1},{notes:[40],beats:1},{notes:[43],beats:1},{notes:[45],beats:1},
      {notes:[41],beats:1},{notes:[45],beats:1},{notes:[48],beats:1},{notes:[47],beats:1},
      {notes:[43],beats:1},{notes:[47],beats:1},{notes:[50],beats:1},{notes:[49],beats:1}
    ]},
    bass_ballad:{label:"ロングトーン・ベース",bpm:70,steps:[
      {notes:[36],beats:2.5,gate:.9},{notes:[43],beats:1.5,gate:.88},{notes:[41],beats:2.5,gate:.9},{notes:[45],beats:1.5,gate:.88},
      {notes:[43],beats:2,gate:.9},{notes:[35],beats:2,gate:.9}
    ]},

    pad_chords:{label:"パッド・ロングコード",bpm:64,steps:[
      {notes:[48,55,60,64],beats:4,gate:.95},{notes:[45,52,57,60],beats:4,gate:.95},
      {notes:[41,48,53,57],beats:4,gate:.95},{notes:[43,50,55,59],beats:4,gate:.95}
    ]},
    pad_fifths:{label:"オープン5度・パッド",bpm:58,steps:[
      {notes:[43,50,55,62],beats:4,gate:.96},{notes:[45,52,57,64],beats:4,gate:.96},
      {notes:[40,47,52,59],beats:4,gate:.96},{notes:[38,45,50,57],beats:4,gate:.96}
    ]},
    pad_swell:{label:"アンビエント・スウェル",bpm:54,steps:[
      {notes:[48,55,62,67],beats:6,gate:.97},{notes:[46,53,60,65],beats:6,gate:.97},{notes:[43,50,57,62],beats:6,gate:.97}
    ]},

    keys_chords:{label:"鍵盤コード",bpm:92,steps:[
      {notes:[48,55,60,64],beats:2},{notes:[45,52,57,60],beats:2},{notes:[41,48,53,57],beats:2},{notes:[43,50,55,59],beats:2}
    ]},
    keys_arp:{label:"鍵盤アルペジオ",bpm:104,steps:[
      {notes:[48],beats:.5},{notes:[55],beats:.5},{notes:[60],beats:.5},{notes:[64],beats:.5},
      {notes:[45],beats:.5},{notes:[52],beats:.5},{notes:[57],beats:.5},{notes:[60],beats:.5},
      {notes:[43],beats:.5},{notes:[50],beats:.5},{notes:[55],beats:.5},{notes:[59],beats:.5}
    ]},
    organ_hold:{label:"オルガン・サステイン",bpm:76,steps:[
      {notes:[48,55,60,64],beats:3,gate:.96},{notes:[50,57,62,65],beats:1,gate:.92},
      {notes:[52,59,64,67],beats:3,gate:.96},{notes:[47,54,59,62],beats:1,gate:.92}
    ]},

    lead_melody:{label:"リード・メロディ",bpm:112,steps:[
      {notes:[60],beats:.5},{notes:[64],beats:.5},{notes:[67],beats:.5},{notes:[69],beats:.5},
      {notes:[72],beats:1},{notes:[71],beats:.5},{notes:[69],beats:.5},{notes:[67],beats:.5},{notes:[64],beats:.5},{notes:[62],beats:.5},{notes:[60],beats:1.5}
    ]},
    lead_fusion:{label:"フュージョン・ソロ",bpm:118,steps:[
      {notes:[64],beats:.5},{notes:[67],beats:.25},{notes:[69],beats:.25},{notes:[71],beats:.5},{notes:[74],beats:.5},
      {notes:[76],beats:.25},{notes:[74],beats:.25},{notes:[71],beats:.5},{notes:[69],beats:.5},{notes:[67],beats:.5},{notes:[64],beats:1}
    ]},
    brass_stabs:{label:"ブラス・スタブ",bpm:108,steps:[
      {notes:[48,55,60,64],beats:.5,gate:.45},{notes:[],beats:.5},{notes:[50,57,62,65],beats:.5,gate:.42},{notes:[],beats:.5},
      {notes:[52,59,64,67],beats:1,gate:.55},{notes:[],beats:.5},{notes:[55,62,67,70],beats:.5,gate:.45},{notes:[48,55,60,64],beats:1,gate:.62}
    ]},

    pluck_arp:{label:"プラック・アルペジオ",bpm:116,steps:[
      {notes:[48],beats:.25},{notes:[55],beats:.25},{notes:[60],beats:.25},{notes:[64],beats:.25},
      {notes:[52],beats:.25},{notes:[59],beats:.25},{notes:[64],beats:.25},{notes:[67],beats:.25},
      {notes:[45],beats:.25},{notes:[52],beats:.25},{notes:[57],beats:.25},{notes:[60],beats:.25},{notes:[43],beats:.25},{notes:[50],beats:.25},{notes:[55],beats:.25},{notes:[59],beats:.25}
    ]},
    bell_sparse:{label:"ベル・単音余韻",bpm:66,steps:[
      {notes:[72],beats:2.5,gate:.35},{notes:[],beats:.5},{notes:[76],beats:2.5,gate:.35},{notes:[],beats:.5},
      {notes:[79],beats:3,gate:.32},{notes:[74],beats:2,gate:.35},{notes:[72],beats:3,gate:.32}
    ]},
    mallet_ostinato:{label:"マレット・オスティナート",bpm:120,steps:[
      {notes:[60],beats:.5},{notes:[67],beats:.5},{notes:[64],beats:.5},{notes:[67],beats:.5},
      {notes:[62],beats:.5},{notes:[69],beats:.5},{notes:[65],beats:.5},{notes:[69],beats:.5},
      {notes:[59],beats:.5},{notes:[67],beats:.5},{notes:[62],beats:.5},{notes:[67],beats:.5}
    ]},

    strings_legato:{label:"ストリングス・レガート",bpm:72,steps:[
      {notes:[55],beats:1.5,gate:.94},{notes:[57],beats:.5,gate:.9},{notes:[59],beats:1.5,gate:.94},{notes:[60],beats:.5,gate:.9},
      {notes:[62],beats:2,gate:.95},{notes:[60],beats:1,gate:.92},{notes:[57],beats:1,gate:.92},{notes:[55],beats:2,gate:.95}
    ]},
    voice_chords:{label:"クワイア・ロングコード",bpm:60,steps:[
      {notes:[48,55,60,67],beats:4,gate:.96},{notes:[45,52,57,64],beats:4,gate:.96},
      {notes:[50,57,62,69],beats:4,gate:.96},{notes:[43,50,55,62],beats:4,gate:.96}
    ]},
    pizzicato_pattern:{label:"ピチカート・パターン",bpm:110,steps:[
      {notes:[48],beats:.5},{notes:[55],beats:.5},{notes:[60],beats:.5},{notes:[55],beats:.5},
      {notes:[45],beats:.5},{notes:[52],beats:.5},{notes:[57],beats:.5},{notes:[52],beats:.5},
      {notes:[43],beats:.5},{notes:[50],beats:.5},{notes:[55],beats:.5},{notes:[50],beats:.5}
    ]}
  });

  const FAMILY_OPTIONS=Object.freeze({
    bass:[["bass_groove","ベース・グルーヴ"],["bass_octaves","低音オクターブ"],["bass_walking","ウォーキング"],["bass_ballad","ロングトーン"]],
    pad:[["pad_chords","ロングコード"],["pad_fifths","オープン5度"],["pad_swell","アンビエント・スウェル"]],
    keys:[["keys_chords","鍵盤コード"],["keys_arp","鍵盤アルペジオ"],["organ_hold","オルガン・サステイン"]],
    lead:[["lead_melody","リード・メロディ"],["lead_fusion","フュージョン・ソロ"],["brass_stabs","ブラス・スタブ"]],
    pluck:[["pluck_arp","プラック・アルペジオ"],["bell_sparse","ベル・単音余韻"],["mallet_ostinato","マレット・オスティナート"]],
    voice:[["strings_legato","ストリングス・レガート"],["voice_chords","クワイア・ロングコード"],["pizzicato_pattern","ピチカート・パターン"]]
  });

  const FAMILY_META=Object.freeze({
    bass:["Bass","低音域のグルーヴ、オクターブ、ウォーキング、ロングトーンで低域の芯・アタック・余韻を確認できます。"],
    pad:["Pad / Atmosphere","長いコードとスウェルで立ち上がり、広がり、サステイン、余韻を確認できます。"],
    keys:["Keys / Organ","コード、アルペジオ、持続和音で鍵盤音色のアタックと和音時の倍音を確認できます。"],
    lead:["Lead / Brass","単音メロディ、速いソロ、短いブラス和音で前に出る成分と追従性を確認できます。"],
    pluck:["Pluck / Bell","高速アルペジオ、単音の長い余韻、マレット反復でアタックと減衰を確認できます。"],
    voice:["Strings / Voice","レガート、クワイア和音、ピチカートで持続音と短音の両方を確認できます。"]
  });

  let lastPalettePrompt="";
  let lastPaletteGroup="";
  const PALETTE_TO_FAMILY={bass:"bass",pad:"pad",keys:"keys",lead:"lead",pluck:"pluck",voice:"voice"};

  document.addEventListener("click",event=>{
    const button=event.target&&event.target.closest?event.target.closest("#soundPaletteGrid button[data-prompt]"):null;
    if(!button)return;
    lastPalettePrompt=button.dataset.prompt||"";
    const category=document.getElementById("soundPaletteCategory");
    lastPaletteGroup=category&&PALETTE_TO_FAMILY[category.value]?PALETTE_TO_FAMILY[category.value]:"";
  },true);

  function familyFromText(p){
    const text=`${p&&p.prompt||""} ${p&&p.name||""}`.toLowerCase();
    if(lastPaletteGroup&&p&&p.prompt===lastPalettePrompt)return lastPaletteGroup;
    if(/(bass|ベース|sub\b|サブベース|acid|アシッド|low end|低域|低音)/i.test(text))return"bass";
    if(/(strings?|ストリング|choir|クワイア|vocal|voice|ボイス|声|pizzicato|ピチカート)/i.test(text))return"voice";
    if(/(bell|ベル|pluck|プラック|harp|ハープ|marimba|マリンバ|mallet|マレット|木琴)/i.test(text))return"pluck";
    if(/(lead|リード|brass|ブラス|solo|ソロ)/i.test(text))return"lead";
    if(/(organ|オルガン|keys?\b|synth keys|シンセキー|鍵盤|polysynth|ポリシンセ)/i.test(text))return"keys";
    if(/(pad|パッド|ambient|アンビエント|atmos|cinematic|シネマ|dream|ドリーム|swell|スウェル)/i.test(text))return"pad";
    if(p&&Number(p.octave_shift)<=-1)return"bass";
    if(p&&Number(p.resynth_attack_s)>=.35)return"pad";
    if(p&&Number(p.resynth_transient_mix)>=.5&&Number(p.resynth_release_s)<=1.2)return"pluck";
    return"lead";
  }

  function adaptiveFamily(p){
    return p&&p.instrument_model==="spectral_resynth"?familyFromText(p):null;
  }

  function currentAdaptivePerformance(){
    const family=adaptiveFamily(currentPatch);if(!family)return null;
    return ADAPTIVE_PERFORMANCES[document.getElementById("sampleSelect").value]||null;
  }

  function customOptionsFromSelect(select){
    return Array.from(select.querySelectorAll('optgroup[label="登録フレーズ"] option')).map(option=>({value:option.value,label:option.textContent}));
  }

  const baseUpdateInstrumentSurface=updateInstrumentSurface;
  updateInstrumentSurface=function(){
    const select=document.getElementById("sampleSelect"),previous=select.value;
    baseUpdateInstrumentSurface();
    const family=adaptiveFamily(currentPatch);if(!family)return;
    const customOptions=customOptionsFromSelect(select),options=FAMILY_OPTIONS[family];select.innerHTML="";
    const builtIn=document.createElement("optgroup");builtIn.label=`音色評価フレーズ · ${FAMILY_META[family][0]}`;
    for(const[value,label]of options){const opt=document.createElement("option");opt.value=value;opt.textContent=label;builtIn.appendChild(opt);}select.appendChild(builtIn);
    if(customOptions.length){const customGroup=document.createElement("optgroup");customGroup.label="登録フレーズ";for(const item of customOptions){const opt=document.createElement("option");opt.value=item.value;opt.textContent=item.label;customGroup.appendChild(opt);}select.appendChild(customGroup);}
    const valid=new Set([...options.map(([value])=>value),...customOptions.map(item=>item.value)]);select.value=valid.has(previous)?previous:options[0][0];
    document.getElementById("sampleDescription").textContent=`評価カテゴリ: ${FAMILY_META[family][0]} · ${FAMILY_META[family][1]}`;
  };

  function eventsForStep(step){return(step.notes||[]).map(note=>({note,velocity:step.velocity??.84}));}

  async function playAdaptiveSample(perf){
    stopSample({announce:false});
    try{await engine.init();}catch(err){showError(err);return;}
    const runId=sampleRunId,beatMs=60000/Math.max(40,Math.min(240,Number(perf.bpm)||100));let cursor=80;setSamplePlaying(true);
    document.getElementById("status").textContent=`${perf.label}を「${currentPatch.name}」でサンプル演奏中…`;
    for(const step of perf.steps.slice(0,128)){
      const duration=Math.max(70,Math.max(.125,Math.min(8,Number(step.beats)||1))*beatMs),gate=Math.max(55,duration*Math.max(.1,Math.min(.98,Number(step.gate??.78))));
      const events=eventsForStep(step);
      sampleTimers.push(setTimeout(()=>{if(runId!==sampleRunId)return;for(const e of events){const note=Math.max(0,Math.min(127,Math.round(e.note)));sampleActiveNotes.add(note);engine.noteOn(note,Math.max(.05,Math.min(1,Number(e.velocity??.84))));}},cursor));
      sampleTimers.push(setTimeout(()=>{if(runId!==sampleRunId)return;for(const e of events){const note=Math.max(0,Math.min(127,Math.round(e.note)));engine.noteOff(note);sampleActiveNotes.delete(note);}},cursor+gate));
      cursor+=duration;
    }
    sampleTimers.push(setTimeout(()=>{if(runId!==sampleRunId)return;sampleActiveNotes.clear();sampleTimers=[];setSamplePlaying(false);document.getElementById("status").textContent=`サンプル演奏完了 · ${perf.label}`;},cursor+700));
  }

  const playButton=document.getElementById("samplePlayBtn");
  playButton.addEventListener("click",event=>{
    const perf=currentAdaptivePerformance();if(!perf)return;
    event.preventDefault();event.stopImmediatePropagation();playAdaptiveSample(perf);
  },true);

  updateInstrumentSurface();
  window.adaptiveSamplePerformance={familyForPatch:adaptiveFamily,performances:ADAPTIVE_PERFORMANCES,options:FAMILY_OPTIONS};
})();
