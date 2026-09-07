"use strict";

// v0.5.0 performance library.
// Adds more original demo genres, local-only user phrase registration, grand-piano routing,
// and guitar chord strumming while preserving the existing noteOn/noteOff contract.
(() => {
  const CUSTOM_STORAGE_KEY="nlss.customSamplePhrases.v1";
  const MAX_CUSTOM_PHRASES=50,MAX_CUSTOM_STEPS=128;

  function v05InstrumentKey(p){
    if(p&&p.instrument_model==="grand_piano")return"grand_piano";
    if(p&&p.instrument_model==="electric_guitar")return"electric_guitar";
    if(p&&(p.instrument_model==="studio_drums"||p.engine_type==="drum"))return"studio_drums";
    if(p&&p.instrument_model==="fretless_bass")return"fretless_bass";
    if(p&&p.instrument_model==="dx_ep")return"dx_ep";
    return"generic";
  }

  const quartal=(root,size=4)=>Array.from({length:size},(_,i)=>root+i*5);

  function buildJazzDrumSteps(){
    const steps=[];
    for(let i=0;i<24;i++){
      const triplet=i%3,beat=Math.floor(i/3)%4,events=[];
      if(triplet===0)events.push({note:51,velocity:beat===0?.72:.58});
      if(triplet===2)events.push({note:51,velocity:.43});
      if(triplet===0&&(beat===1||beat===3))events.push({note:42,velocity:.28});
      if(triplet===0)events.push({note:36,velocity:.20});
      if((beat===1||beat===3)&&triplet===1)events.push({note:38,velocity:.18});
      steps.push({events,beats:1/3,gate:.72});
    }
    return steps;
  }
  function buildRockDrums(){
    const steps=[];
    for(let i=0;i<16;i++){
      const events=[{note:42,velocity:i%2===0?.62:.46}];
      if([0,6,8,10].includes(i))events.push({note:36,velocity:.90});
      if([4,12].includes(i))events.push({note:38,velocity:.94});
      if(i===0)events.push({note:49,velocity:.72});
      steps.push({events,beats:.25});
    }
    return steps;
  }
  function buildFunkDrums(){
    const steps=[];
    for(let i=0;i<16;i++){
      const events=[{note:42,velocity:i%2===0?.50:.34}];
      if([0,3,7,10,14].includes(i))events.push({note:36,velocity:i===0?.90:.72});
      if([4,12].includes(i))events.push({note:38,velocity:.90});
      if([6,15].includes(i))events.push({note:38,velocity:.22});
      if(i===11)events.push({note:46,velocity:.34});
      steps.push({events,beats:.25});
    }
    return steps;
  }
  function buildFusionDrums(){
    const steps=[];
    for(let i=0;i<16;i++){
      const events=[{note:i%4===3?51:42,velocity:i%2===0?.50:.34}];
      if([0,5,8,11,14].includes(i))events.push({note:36,velocity:.78});
      if([4,12].includes(i))events.push({note:38,velocity:.86});
      if(i===15)events.push({note:50,velocity:.52});
      steps.push({events,beats:.25});
    }
    return steps;
  }
  function buildBossaDrums(){
    const steps=[];
    for(let i=0;i<16;i++){
      const events=[{note:51,velocity:i%2===0?.38:.28}];
      if([0,3,6,8,11,14].includes(i))events.push({note:36,velocity:.48});
      if([4,12].includes(i))events.push({note:38,velocity:.32});
      if([2,6,10,14].includes(i))events.push({note:42,velocity:.26});
      steps.push({events,beats:.25});
    }
    return steps;
  }

  const PERFORMANCES=Object.freeze({
    synth_melody:{label:"シンセ・メロディ",bpm:108,steps:[
      {notes:[60],beats:.5},{notes:[64],beats:.5},{notes:[67],beats:.5},{notes:[69],beats:.5},
      {notes:[67],beats:.5},{notes:[64],beats:.5},{notes:[62],beats:.5},{notes:[60],beats:1}
    ]},
    synth_chords:{label:"シンセ・コード",bpm:82,steps:[
      {notes:[60,64,67],beats:2},{notes:[65,69,72],beats:2},{notes:[67,71,74],beats:2},{notes:[60,64,67],beats:2}
    ]},
    synth_jazz:{label:"ジャズ・シンセリード",bpm:118,steps:[
      {notes:[60],beats:.5},{notes:[63],beats:.5},{notes:[65],beats:.5},{notes:[66],beats:.5},
      {notes:[67],beats:1},{notes:[70],beats:.5},{notes:[69],beats:.5},{notes:[67],beats:.5},{notes:[63],beats:.5},{notes:[62],beats:.5},{notes:[60],beats:1.5}
    ]},
    synth_pop:{label:"ポップ・アルペジオ",bpm:112,steps:[
      {notes:[60],beats:.5},{notes:[64],beats:.5},{notes:[67],beats:.5},{notes:[72],beats:.5},
      {notes:[57],beats:.5},{notes:[60],beats:.5},{notes:[64],beats:.5},{notes:[69],beats:.5},
      {notes:[65],beats:.5},{notes:[69],beats:.5},{notes:[72],beats:.5},{notes:[77],beats:.5},{notes:[67],beats:.5},{notes:[71],beats:.5},{notes:[74],beats:.5},{notes:[79],beats:.5}
    ]},
    synth_edm:{label:"EDM・シーケンス",bpm:128,steps:[
      {notes:[48],beats:.25},{notes:[55],beats:.25},{notes:[60],beats:.25},{notes:[63],beats:.25},
      {notes:[48],beats:.25},{notes:[55],beats:.25},{notes:[62],beats:.25},{notes:[67],beats:.25},
      {notes:[46],beats:.25},{notes:[53],beats:.25},{notes:[58],beats:.25},{notes:[62],beats:.25},{notes:[43],beats:.25},{notes:[50],beats:.25},{notes:[55],beats:.25},{notes:[62],beats:.25}
    ]},
    synth_ambient:{label:"アンビエント・コード",bpm:66,steps:[
      {notes:[48,55,60,64],beats:4,gate:.92},{notes:[45,52,57,60],beats:4,gate:.92},{notes:[41,48,53,57],beats:4,gate:.92},{notes:[43,50,55,59],beats:4,gate:.92}
    ]},

    fretless_phrase:{label:"フレットレス・歌うフレーズ",bpm:92,steps:[
      {notes:[40],beats:.75},{notes:[43],beats:.25},{notes:[45],beats:.75},{notes:[47],beats:.25},{notes:[48],beats:1},{notes:[47],beats:.5},{notes:[43],beats:.5},{notes:[40],beats:1.5}
    ]},
    fretless_jazz:{label:"ジャズ・ウォーキングベース",bpm:124,steps:[
      {notes:[36],beats:1},{notes:[40],beats:1},{notes:[43],beats:1},{notes:[45],beats:1},{notes:[41],beats:1},{notes:[45],beats:1},{notes:[48],beats:1},{notes:[47],beats:1},
      {notes:[43],beats:1},{notes:[47],beats:1},{notes:[50],beats:1},{notes:[49],beats:1},{notes:[36],beats:1},{notes:[43],beats:1},{notes:[46],beats:1},{notes:[35],beats:1}
    ]},
    fretless_funk:{label:"ファンク・ベース",bpm:108,steps:[
      {notes:[36],beats:.5},{notes:[36],beats:.25},{notes:[43],beats:.25},{notes:[46],beats:.5},{notes:[48],beats:.25},{notes:[46],beats:.25},
      {notes:[36],beats:.5},{notes:[41],beats:.25},{notes:[43],beats:.25},{notes:[46],beats:.5},{notes:[43],beats:.5},{notes:[36],beats:1}
    ]},
    fretless_fusion:{label:"フュージョン・フレットレス",bpm:116,steps:[
      {notes:[40],beats:.5},{notes:[43],beats:.25},{notes:[45],beats:.25},{notes:[47],beats:.5},{notes:[50],beats:.5},{notes:[52],beats:.25},{notes:[50],beats:.25},
      {notes:[47],beats:.5},{notes:[45],beats:.5},{notes:[43],beats:.25},{notes:[45],beats:.25},{notes:[47],beats:.5},{notes:[40],beats:1}
    ]},
    fretless_ballad:{label:"バラード・ベース",bpm:72,steps:[
      {notes:[36],beats:2},{notes:[43],beats:1},{notes:[40],beats:1},{notes:[41],beats:2},{notes:[45],beats:1},{notes:[48],beats:1},{notes:[43],beats:2},{notes:[47],beats:1},{notes:[36],beats:1}
    ]},

    ep_chords:{label:"FMエレピ・コード",bpm:78,steps:[
      {notes:[60,64,67,71],beats:2},{notes:[57,60,64,67],beats:2},{notes:[62,65,69,72],beats:2},{notes:[55,59,62,65],beats:2}
    ]},
    ep_jazz:{label:"ジャズ・エレピ・4度堆積ボイシング",bpm:96,steps:[
      {notes:quartal(48),beats:2},{notes:quartal(50),beats:2},{notes:quartal(52),beats:2},{notes:quartal(53),beats:2},{notes:quartal(48),beats:4}
    ]},
    ep_citypop:{label:"シティポップ・エレピ",bpm:104,steps:[
      {notes:[48,55,59,64],beats:2},{notes:[50,57,60,65],beats:2},{notes:[52,59,62,67],beats:2},{notes:[45,52,55,60],beats:2}
    ]},
    ep_fusion:{label:"フュージョン・エレピ",bpm:118,steps:[
      {notes:[52,59,64,69],beats:1},{notes:[50,57,62,67],beats:1},{notes:[55,62,67,72],beats:1},{notes:[53,60,65,70],beats:1},
      {notes:[52],beats:.25},{notes:[55],beats:.25},{notes:[59],beats:.25},{notes:[62],beats:.25},{notes:[64,69,74],beats:2}
    ]},
    ep_ballad:{label:"バラード・エレピ",bpm:68,steps:[
      {notes:[48,55,60,64],beats:4,gate:.9},{notes:[45,52,57,60],beats:4,gate:.9},{notes:[41,48,53,57],beats:4,gate:.9},{notes:[43,50,55,59],beats:4,gate:.9}
    ]},

    piano_classical:{label:"クラシック・アルペジオ",bpm:92,steps:[
      {notes:[48],beats:.5},{notes:[55],beats:.5},{notes:[60],beats:.5},{notes:[64],beats:.5},{notes:[67],beats:.5},{notes:[64],beats:.5},{notes:[60],beats:.5},{notes:[55],beats:.5},
      {notes:[45],beats:.5},{notes:[52],beats:.5},{notes:[57],beats:.5},{notes:[60],beats:.5},{notes:[64],beats:.5},{notes:[60],beats:.5},{notes:[57],beats:.5},{notes:[52],beats:.5}
    ]},
    piano_jazz:{label:"ジャズ・グランドピアノ",bpm:104,steps:[
      {notes:quartal(48),beats:1.5},{notes:quartal(50),beats:.5},{notes:quartal(52),beats:1},{notes:quartal(55),beats:1},{notes:quartal(53),beats:1.5},{notes:quartal(50),beats:.5},{notes:quartal(48),beats:2}
    ]},
    piano_ballad:{label:"ピアノ・バラード",bpm:66,steps:[
      {notes:[48,55,60,64],beats:4,gate:.92},{notes:[45,52,57,60],beats:4,gate:.92},{notes:[41,48,53,57],beats:4,gate:.92},{notes:[43,50,55,59],beats:4,gate:.92}
    ]},
    piano_pop:{label:"ポップ・ピアノ",bpm:108,steps:[
      {notes:[48,55,60,64],beats:1},{notes:[48],beats:.5},{notes:[55],beats:.5},{notes:[45,52,57,60],beats:1},{notes:[45],beats:.5},{notes:[52],beats:.5},
      {notes:[41,48,53,57],beats:1},{notes:[41],beats:.5},{notes:[48],beats:.5},{notes:[43,50,55,59],beats:2}
    ]},
    piano_boogie:{label:"ブギウギ・ピアノ",bpm:142,steps:[
      {notes:[36,48],beats:.5},{notes:[43,52],beats:.5},{notes:[45,53],beats:.5},{notes:[43,52],beats:.5},
      {notes:[41,53],beats:.5},{notes:[48,57],beats:.5},{notes:[50,58],beats:.5},{notes:[48,57],beats:.5},
      {notes:[43,55],beats:.5},{notes:[50,59],beats:.5},{notes:[52,60],beats:.5},{notes:[50,59],beats:.5},{notes:[36,48,52,55],beats:2}
    ]},

    drum_shuffle:{label:"ハーフタイム・シャッフル",bpm:88,steps:buildHalfTimeShuffleSteps()},
    drum_straight:{label:"ストレート・ドラム",bpm:104,steps:buildStraightDrumSteps()},
    drum_jazz:{label:"ジャズ・スウィング",bpm:132,steps:buildJazzDrumSteps()},
    drum_rock:{label:"ロック・ドラム",bpm:124,steps:buildRockDrums()},
    drum_funk:{label:"ファンク・ドラム",bpm:106,steps:buildFunkDrums()},
    drum_fusion:{label:"フュージョン・ドラム",bpm:118,steps:buildFusionDrums()},
    drum_bossa:{label:"ボサノバ・ドラム",bpm:126,steps:buildBossaDrums()},

    guitar_rock:{label:"ロック・リフ",bpm:126,steps:[
      {notes:[40,47,52],beats:.75,gate:.64,strum:"down"},{notes:[40],beats:.25,gate:.46},{notes:[43,50,55],beats:.5,gate:.62,strum:"up"},{notes:[45,52,57],beats:.5,gate:.68,strum:"down"},
      {notes:[40,47,52],beats:.5,gate:.58,strum:"up"},{notes:[47,54,59],beats:.5,gate:.70,strum:"down"},{notes:[45,52,57],beats:.5,gate:.62,strum:"up"},{notes:[40,47,52],beats:1,gate:.78,strum:"down"}
    ]},
    guitar_fusion:{label:"フュージョン・フレーズ",bpm:112,steps:[
      {notes:[52],beats:.5},{notes:[55],beats:.25},{notes:[59],beats:.25},{notes:[62],beats:.5},{notes:[64],beats:.5},{notes:[67],beats:.25},{notes:[66],beats:.25},{notes:[64],beats:.5},
      {notes:[59,64,67],beats:1,strum:"down"},{notes:[57],beats:.25},{notes:[59],beats:.25},{notes:[62],beats:.5},{notes:[64],beats:1}
    ]},
    guitar_acoustic:{label:"アコースティック・アルペジオ",bpm:86,steps:[
      {notes:[40],beats:.5},{notes:[47],beats:.5},{notes:[52],beats:.5},{notes:[55],beats:.5},{notes:[45],beats:.5},{notes:[52],beats:.5},{notes:[57],beats:.5},{notes:[60],beats:.5},
      {notes:[43],beats:.5},{notes:[50],beats:.5},{notes:[55],beats:.5},{notes:[59],beats:.5},{notes:[40,47,52,55],beats:2,gate:.88,strum:"down"}
    ]},
    guitar_jazz:{label:"ジャズ・4度堆積コンピング",bpm:104,steps:[
      {notes:quartal(43),beats:1.5,gate:.72,strum:"down"},{notes:quartal(45),beats:.5,gate:.55,strum:"up"},{notes:quartal(47),beats:1,gate:.62,strum:"down"},{notes:quartal(48),beats:1,gate:.65,strum:"up"},
      {notes:quartal(45),beats:1.5,gate:.72,strum:"down"},{notes:quartal(47),beats:.5,gate:.55,strum:"up"},{notes:quartal(43),beats:2,gate:.78,strum:"down"}
    ]},
    guitar_blues:{label:"ブルース・ギター",bpm:98,steps:[
      {notes:[40,47,52],beats:1,strum:"down"},{notes:[43],beats:.5},{notes:[45],beats:.5},{notes:[47,52,55],beats:1,strum:"up"},{notes:[45],beats:.5},{notes:[43],beats:.5},
      {notes:[40,47,52],beats:1,strum:"down"},{notes:[50],beats:.25},{notes:[52],beats:.25},{notes:[55],beats:.5},{notes:[52],beats:1}
    ]},
    guitar_funk:{label:"ファンク・カッティング",bpm:112,steps:[
      {notes:[52,57,62],beats:.5,gate:.36,strum:"down"},{notes:[52,57,62],beats:.25,gate:.28,strum:"up"},{notes:[],beats:.25},{notes:[50,55,60],beats:.5,gate:.34,strum:"down"},{notes:[50,55,60],beats:.5,gate:.30,strum:"up"},
      {notes:[52,57,62],beats:.25,gate:.26,strum:"down"},{notes:[],beats:.25},{notes:[55,60,65],beats:.5,gate:.36,strum:"up"},{notes:[52,57,62],beats:1,gate:.40,strum:"down"}
    ]},
    guitar_pop:{label:"ポップ・ストローク",bpm:108,steps:[
      {notes:[40,47,52,55],beats:1,gate:.72,strum:"down"},{notes:[40,47,52,55],beats:1,gate:.58,strum:"up"},{notes:[45,52,57,60],beats:1,gate:.72,strum:"down"},{notes:[45,52,57,60],beats:1,gate:.58,strum:"up"},
      {notes:[43,50,55,59],beats:1,gate:.72,strum:"down"},{notes:[43,50,55,59],beats:1,gate:.58,strum:"up"},{notes:[40,47,52,55],beats:2,gate:.82,strum:"down"}
    ]},
    guitar_bossa:{label:"ボサノバ・ギター",bpm:118,steps:[
      {notes:[48,53,57,62],beats:1.5,gate:.58,strum:"down"},{notes:[48,53,57,62],beats:.5,gate:.36,strum:"up"},{notes:[50,55,59,64],beats:1,gate:.50,strum:"down"},{notes:[50,55,59,64],beats:1,gate:.42,strum:"up"},
      {notes:[47,52,56,61],beats:1.5,gate:.58,strum:"down"},{notes:[47,52,56,61],beats:.5,gate:.36,strum:"up"},{notes:[48,53,57,62],beats:2,gate:.70,strum:"down"}
    ]}
  });

  const OPTIONS=Object.freeze({
    generic:[["synth_melody","シンセ・メロディ"],["synth_chords","シンセ・コード"],["synth_pop","ポップ"],["synth_edm","EDM"],["synth_ambient","アンビエント"],["synth_jazz","ジャズ"]],
    fretless_bass:[["fretless_phrase","歌うフレーズ"],["fretless_funk","ファンク"],["fretless_fusion","フュージョン"],["fretless_ballad","バラード"],["fretless_jazz","ジャズ・ウォーキング"]],
    dx_ep:[["ep_chords","FMエレピ・コード"],["ep_citypop","シティポップ"],["ep_fusion","フュージョン"],["ep_ballad","バラード"],["ep_jazz","ジャズ・4度堆積"]],
    grand_piano:[["piano_classical","クラシック"],["piano_ballad","バラード"],["piano_pop","ポップ"],["piano_jazz","ジャズ"],["piano_boogie","ブギウギ"]],
    studio_drums:[["drum_shuffle","ハーフタイム・シャッフル"],["drum_straight","ストレート"],["drum_rock","ロック"],["drum_funk","ファンク"],["drum_fusion","フュージョン"],["drum_bossa","ボサノバ"],["drum_jazz","ジャズ・スウィング"]],
    electric_guitar:[["guitar_rock","ロック"],["guitar_fusion","フュージョン"],["guitar_acoustic","アコースティック"],["guitar_blues","ブルース"],["guitar_funk","ファンク"],["guitar_pop","ポップ"],["guitar_bossa","ボサノバ"],["guitar_jazz","ジャズ"]]
  });
  const DESCRIPTIONS=Object.freeze({
    generic:"メロディ、コード、ポップ、EDM、アンビエント、ジャズで音色を確認できます。",
    fretless_bass:"指ノイズを強めたフレットレスを、歌うフレーズ、ファンク、フュージョン、バラード、ジャズで確認できます。",
    dx_ep:"FMエレピをコード、シティポップ、フュージョン、バラード、ジャズで確認できます。",
    grand_piano:"グランドピアノをクラシック、バラード、ポップ、ジャズ、ブギウギで確認できます。",
    studio_drums:"PCMドラムをシャッフル、ストレート、ロック、ファンク、フュージョン、ボサノバ、ジャズで確認できます。",
    electric_guitar:"ギター和音は高速ストロークのように発音を微妙にずらし、ロックからボサノバまで確認できます。"
  });

  function safeReadCustom(){
    try{
      const raw=JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY)||"[]");
      if(!Array.isArray(raw))return[];
      return raw.filter(item=>item&&typeof item.id==="string"&&typeof item.name==="string"&&Array.isArray(item.steps)&&typeof item.instrument==="string").slice(0,MAX_CUSTOM_PHRASES);
    }catch(_){return[];}
  }
  function safeWriteCustom(items){
    localStorage.setItem(CUSTOM_STORAGE_KEY,JSON.stringify(items.slice(0,MAX_CUSTOM_PHRASES)));
  }
  function noteTokenToMidi(token){
    const t=String(token).trim();
    if(/^\d{1,3}$/.test(t)){
      const midi=Number(t);if(midi>=0&&midi<=127)return midi;throw new Error(`MIDIノート範囲外: ${t}`);
    }
    const m=t.match(/^([A-Ga-g])([#b]?)(-?\d)$/);if(!m)throw new Error(`音名を解釈できません: ${t}`);
    const base={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1].toUpperCase()];let pc=base;
    if(m[2]==="#")pc+=1;else if(m[2]==="b")pc-=1;
    const midi=(Number(m[3])+1)*12+pc;if(midi<0||midi>127)throw new Error(`音名の範囲外: ${t}`);return midi;
  }
  function parseCustomSteps(text){
    const lines=String(text||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    if(!lines.length)throw new Error("フレーズを1行以上入力してください。");
    if(lines.length>MAX_CUSTOM_STEPS)throw new Error(`最大${MAX_CUSTOM_STEPS}ステップです。`);
    return lines.map((line,index)=>{
      const [notePart="",beatsPart="1",velocityPart="0.84"]=line.split("|").map(v=>v.trim());
      const beats=Number(beatsPart),velocity=Number(velocityPart);
      if(!Number.isFinite(beats)||beats<.125||beats>8)throw new Error(`${index+1}行目の拍数は0.125〜8で指定してください。`);
      if(!Number.isFinite(velocity)||velocity<.05||velocity>1)throw new Error(`${index+1}行目のVelocityは0.05〜1で指定してください。`);
      const rest=/^(r|rest|休符|-)$/i.test(notePart);
      const notes=rest?[]:notePart.split(/[\s,]+/).filter(Boolean).map(noteTokenToMidi);
      if(!rest&&!notes.length)throw new Error(`${index+1}行目に音を入力してください。`);
      return{notes,beats,velocity,gate:.80};
    });
  }
  function customId(){return(globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;}
  function customInstrumentLabel(key){return{generic:"シンセ",fretless_bass:"フレットレスベース",dx_ep:"FMエレピ",grand_piano:"グランドピアノ",studio_drums:"ドラム",electric_guitar:"ギター"}[key]||key;}
  function selectedCustomId(){const value=document.getElementById("sampleSelect").value;return value.startsWith("custom:")?value.slice(7):null;}

  function refreshCustomUi(){
    const key=v05InstrumentKey(currentPatch),label=document.getElementById("customSampleInstrument");if(label)label.textContent=customInstrumentLabel(key);
    const deleteBtn=document.getElementById("customSampleDeleteBtn");if(deleteBtn)deleteBtn.disabled=!selectedCustomId();
  }

  updateInstrumentSurface=function(){
    const key=v05InstrumentKey(currentPatch),drum=key==="studio_drums";
    document.getElementById("keyboardWrap").hidden=drum;document.getElementById("drumKitWrap").hidden=!drum;
    const select=document.getElementById("sampleSelect"),previous=select.value,options=OPTIONS[key]||OPTIONS.generic;select.innerHTML="";
    const builtIn=document.createElement("optgroup");builtIn.label="内蔵フレーズ";
    for(const[value,label]of options){const opt=document.createElement("option");opt.value=value;opt.textContent=label;builtIn.appendChild(opt);}select.appendChild(builtIn);
    const customs=safeReadCustom().filter(item=>item.instrument===key);
    if(customs.length){const group=document.createElement("optgroup");group.label="登録フレーズ";for(const item of customs){const opt=document.createElement("option");opt.value=`custom:${item.id}`;opt.textContent=item.name;group.appendChild(opt);}select.appendChild(group);}
    const validValues=new Set([...options.map(([v])=>v),...customs.map(item=>`custom:${item.id}`)]);
    if(validValues.has(previous))select.value=previous;
    else if(key==="studio_drums"&&currentPatch.drum_style==="half_time_shuffle")select.value="drum_shuffle";
    else if(key==="electric_guitar"&&["rock","fusion","acoustic"].includes(currentPatch.guitar_demo_style))select.value=`guitar_${currentPatch.guitar_demo_style}`;
    else select.value=options[0][0];
    document.getElementById("sampleDescription").textContent=DESCRIPTIONS[key];refreshCustomUi();
  };
  currentKeyMap=function(){return v05InstrumentKey(currentPatch)==="studio_drums"?DRUM_KEY_MAP:SYNTH_KEY_MAP;};

  function performanceForSelection(value){
    if(value.startsWith("custom:")){
      const id=value.slice(7),item=safeReadCustom().find(v=>v.id===id&&v.instrument===v05InstrumentKey(currentPatch));
      if(item)return{label:item.name,bpm:clamp(Number(item.bpm)||100,40,240),steps:item.steps};
    }
    return PERFORMANCES[value]||PERFORMANCES.synth_melody;
  }
  function eventsForStep(step){
    if(step.events)return step.events;
    return(step.notes||[]).map(note=>({note,velocity:step.velocity??.84}));
  }
  function guitarStrumInterval(){
    const style=String(currentPatch.guitar_demo_style||"fusion");
    return style==="acoustic"?.028:style==="rock"?.018:style==="fusion"?.016:.021;
  }
  function orderGuitarEvents(events,direction){
    const ordered=[...events].sort((a,b)=>a.note-b.note);if(direction==="up")ordered.reverse();return ordered;
  }

  async function playV05Sample(){
    stopSample({announce:false});const perf=performanceForSelection(document.getElementById("sampleSelect").value);
    try{await engine.init();}catch(err){showError(err);return;}
    const runId=sampleRunId,beatMs=60000/clamp(Number(perf.bpm)||100,40,240),key=v05InstrumentKey(currentPatch);let cursor=80,chordIndex=0;setSamplePlaying(true);
    document.getElementById("status").textContent=`${perf.label}を「${currentPatch.name}」でサンプル演奏中…`;
    for(const step of perf.steps.slice(0,MAX_CUSTOM_STEPS)){
      const duration=Math.max(70,clamp(Number(step.beats)||1,.125,8)*beatMs),gate=Math.max(55,duration*clamp(Number(step.gate??.78),.1,.98));let events=eventsForStep(step);
      const isGuitarChord=key==="electric_guitar"&&events.length>1;let direction=step.strum;
      if(isGuitarChord&&!direction){direction=chordIndex%2===0?"down":"up";chordIndex++;events=orderGuitarEvents(events,direction);}else if(isGuitarChord)events=orderGuitarEvents(events,direction);
      const interval=isGuitarChord?guitarStrumInterval():0;
      sampleTimers.push(setTimeout(()=>{
        if(runId!==sampleRunId)return;
        events.forEach((e,index)=>{const note=clamp(Math.round(e.note),0,127),offset=index*interval;sampleActiveNotes.add(note);engine.noteOn(note,clamp(Number(e.velocity??.84),.05,1),offset);});
      },cursor));
      sampleTimers.push(setTimeout(()=>{
        if(runId!==sampleRunId)return;
        events.forEach((e,index)=>{const note=clamp(Math.round(e.note),0,127),offset=index*interval;engine.noteOff(note,offset);sampleActiveNotes.delete(note);});
      },cursor+gate));cursor+=duration;
    }
    sampleTimers.push(setTimeout(()=>{if(runId!==sampleRunId)return;sampleActiveNotes.clear();sampleTimers=[];setSamplePlaying(false);document.getElementById("status").textContent=`サンプル演奏完了 · ${perf.label}`;},cursor+700));
  }

  function saveCustomPhrase(){
    const status=document.getElementById("customSampleStatus");
    try{
      const key=v05InstrumentKey(currentPatch),name=String(document.getElementById("customSampleName").value||"").trim().slice(0,40),bpm=Number(document.getElementById("customSampleBpm").value),steps=parseCustomSteps(document.getElementById("customSampleSteps").value);
      if(!name)throw new Error("フレーズ名を入力してください。");if(!Number.isFinite(bpm)||bpm<40||bpm>240)throw new Error("BPMは40〜240で指定してください。");
      const items=safeReadCustom();if(items.length>=MAX_CUSTOM_PHRASES)throw new Error(`登録上限は${MAX_CUSTOM_PHRASES}件です。`);
      const item={id:customId(),name,instrument:key,bpm:Math.round(bpm),steps,created_at:new Date().toISOString()};items.push(item);safeWriteCustom(items);updateInstrumentSurface();document.getElementById("sampleSelect").value=`custom:${item.id}`;refreshCustomUi();
      status.textContent=`「${name}」を${customInstrumentLabel(key)}用として登録しました。`;document.getElementById("customSampleName").value="";
    }catch(err){status.textContent=`登録エラー: ${err.message||err}`;}
  }
  function deleteCustomPhrase(){
    const id=selectedCustomId(),status=document.getElementById("customSampleStatus");if(!id){status.textContent="削除する登録フレーズを選択してください。";return;}
    const items=safeReadCustom(),target=items.find(v=>v.id===id),next=items.filter(v=>v.id!==id);safeWriteCustom(next);updateInstrumentSurface();status.textContent=target?`「${target.name}」を削除しました。`:"登録フレーズを削除しました。";
  }

  const oldPlayButton=document.getElementById("samplePlayBtn"),playButton=oldPlayButton.cloneNode(true);oldPlayButton.replaceWith(playButton);playButton.addEventListener("click",playV05Sample);
  document.getElementById("sampleSelect").addEventListener("change",refreshCustomUi);
  document.getElementById("customSampleSaveBtn").addEventListener("click",saveCustomPhrase);
  document.getElementById("customSampleDeleteBtn").addEventListener("click",deleteCustomPhrase);

  engine.setPatch(validatePatch(currentPatch));setSamplePlaying(false);refreshCustomUi();
  window.synthPerformanceLibrary={instrumentKey:v05InstrumentKey,parseCustomSteps,readCustom:safeReadCustom,performances:PERFORMANCES};
})();
