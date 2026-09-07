"use strict";

// v0.4.2 instrument-specific sample-performance and surface routing.
// Loaded after guitar_runtime.js so it can correct cross-instrument routing introduced by
// the v0.4.0 guitar extension without duplicating or replacing any audio engine.
(() => {
  const guitarAwareValidatePatch = validatePatch;

  function isExactGuitarPatch(p){
    return Boolean(p && p.instrument_model === "electric_guitar");
  }
  function isDrumPatch(p){
    return Boolean(p && (p.instrument_model === "studio_drums" || p.engine_type === "drum"));
  }
  function instrumentKey(p){
    if(isExactGuitarPatch(p)) return "electric_guitar";
    if(isDrumPatch(p)) return "studio_drums";
    if(p && p.instrument_model === "fretless_bass") return "fretless_bass";
    if(p && p.instrument_model === "dx_ep") return "dx_ep";
    return "generic";
  }

  // Python SynthPatch always serializes guitar defaults for every instrument. The v0.4.0
  // guitar runtime treated the mere presence of guitar_amp_model as a guitar request, which
  // converted drums, FM EP and fretless patches back into electric_guitar. Guitar routing is
  // now based only on the explicit instrument_model.
  validatePatch = function(raw){
    if(raw && typeof raw === "object" && !isExactGuitarPatch(raw)){
      const sanitized = {...raw};
      delete sanitized.guitar_amp_model;
      return guitarAwareValidatePatch(sanitized);
    }
    return guitarAwareValidatePatch(raw);
  };

  function buildJazzDrumSteps(){
    const steps=[];
    for(let i=0;i<24;i++){
      const triplet=i%3, beat=Math.floor(i/3)%4, events=[];
      if(triplet===0) events.push({note:51,velocity:beat===0?.72:.58});
      if(triplet===2) events.push({note:51,velocity:.43});
      if(triplet===0 && (beat===1 || beat===3)) events.push({note:42,velocity:.28});
      if(triplet===0) events.push({note:36,velocity:.20});
      if((beat===1 || beat===3) && triplet===1) events.push({note:38,velocity:.18});
      steps.push({events,beats:1/3,gate:.72});
    }
    return steps;
  }

  // Jazz chord demos use quartal harmony: every adjacent chord tone is a perfect fourth
  // (5 semitones). This deliberately avoids the previous tertian/third-stacked voicings.
  function quartalVoicing(root,size=4){
    return Array.from({length:size},(_,index)=>root+index*5);
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
      {notes:[67],beats:1},{notes:[70],beats:.5},{notes:[69],beats:.5},{notes:[67],beats:.5},
      {notes:[63],beats:.5},{notes:[62],beats:.5},{notes:[60],beats:1.5}
    ]},

    fretless_phrase:{label:"フレットレス・歌うフレーズ",bpm:92,steps:[
      {notes:[40],beats:.75},{notes:[43],beats:.25},{notes:[45],beats:.75},{notes:[47],beats:.25},
      {notes:[48],beats:1},{notes:[47],beats:.5},{notes:[43],beats:.5},{notes:[40],beats:1.5}
    ]},
    fretless_jazz:{label:"ジャズ・ウォーキングベース",bpm:124,steps:[
      {notes:[36],beats:1},{notes:[40],beats:1},{notes:[43],beats:1},{notes:[45],beats:1},
      {notes:[41],beats:1},{notes:[45],beats:1},{notes:[48],beats:1},{notes:[47],beats:1},
      {notes:[43],beats:1},{notes:[47],beats:1},{notes:[50],beats:1},{notes:[49],beats:1},
      {notes:[36],beats:1},{notes:[43],beats:1},{notes:[46],beats:1},{notes:[35],beats:1}
    ]},

    ep_chords:{label:"FMエレピ・コード",bpm:78,steps:[
      {notes:[60,64,67,71],beats:2},{notes:[57,60,64,67],beats:2},{notes:[62,65,69,72],beats:2},{notes:[55,59,62,65],beats:2}
    ]},
    ep_jazz:{label:"ジャズ・エレピ・4度堆積ボイシング",bpm:96,steps:[
      {notes:quartalVoicing(48),beats:2},{notes:quartalVoicing(50),beats:2},
      {notes:quartalVoicing(52),beats:2},{notes:quartalVoicing(53),beats:2},
      {notes:quartalVoicing(48),beats:4}
    ]},

    drum_shuffle:{label:"ハーフタイム・シャッフル",bpm:88,steps:buildHalfTimeShuffleSteps()},
    drum_straight:{label:"ストレート・ドラム",bpm:104,steps:buildStraightDrumSteps()},
    drum_jazz:{label:"ジャズ・スウィング",bpm:132,steps:buildJazzDrumSteps()},

    guitar_rock:{label:"ロック・リフ",bpm:126,steps:[
      {notes:[40,47,52],beats:.75,gate:.64},{notes:[40],beats:.25,gate:.46},
      {notes:[43,50,55],beats:.5,gate:.62},{notes:[45,52,57],beats:.5,gate:.68},
      {notes:[40,47,52],beats:.5,gate:.58},{notes:[47,54,59],beats:.5,gate:.70},
      {notes:[45,52,57],beats:.5,gate:.62},{notes:[40,47,52],beats:1,gate:.78}
    ]},
    guitar_fusion:{label:"フュージョン・フレーズ",bpm:112,steps:[
      {notes:[52],beats:.5},{notes:[55],beats:.25},{notes:[59],beats:.25},{notes:[62],beats:.5},
      {notes:[64],beats:.5},{notes:[67],beats:.25},{notes:[66],beats:.25},{notes:[64],beats:.5},
      {notes:[59,64,67],beats:1},{notes:[57],beats:.25},{notes:[59],beats:.25},{notes:[62],beats:.5},{notes:[64],beats:1}
    ]},
    guitar_acoustic:{label:"アコースティック・アルペジオ",bpm:86,steps:[
      {notes:[40],beats:.5},{notes:[47],beats:.5},{notes:[52],beats:.5},{notes:[55],beats:.5},
      {notes:[45],beats:.5},{notes:[52],beats:.5},{notes:[57],beats:.5},{notes:[60],beats:.5},
      {notes:[43],beats:.5},{notes:[50],beats:.5},{notes:[55],beats:.5},{notes:[59],beats:.5},
      {notes:[40,47,52,55],beats:2,gate:.88}
    ]},
    guitar_jazz:{label:"ジャズ・4度堆積コンピング",bpm:104,steps:[
      {notes:quartalVoicing(43),beats:1.5,gate:.72},{notes:quartalVoicing(45),beats:.5,gate:.55},
      {notes:quartalVoicing(47),beats:1,gate:.62},{notes:quartalVoicing(48),beats:1,gate:.65},
      {notes:quartalVoicing(45),beats:1.5,gate:.72},{notes:quartalVoicing(47),beats:.5,gate:.55},
      {notes:quartalVoicing(43),beats:2,gate:.78}
    ]}
  });

  const OPTIONS=Object.freeze({
    generic:[["synth_melody","シンセ・メロディ"],["synth_chords","シンセ・コード"],["synth_jazz","ジャズ・シンセリード"]],
    fretless_bass:[["fretless_phrase","フレットレス・歌うフレーズ"],["fretless_jazz","ジャズ・ウォーキングベース"]],
    dx_ep:[["ep_chords","FMエレピ・コード"],["ep_jazz","ジャズ・エレピ・4度堆積ボイシング"]],
    studio_drums:[["drum_shuffle","ハーフタイム・シャッフル"],["drum_straight","ストレート・ドラム"],["drum_jazz","ジャズ・スウィング"]],
    electric_guitar:[["guitar_rock","ロック・リフ"],["guitar_fusion","フュージョン・フレーズ"],["guitar_acoustic","アコースティック・アルペジオ"],["guitar_jazz","ジャズ・4度堆積コンピング"]]
  });

  const DESCRIPTIONS=Object.freeze({
    generic:"シンセ向けのメロディ、コード、ジャズリードで音色を確認できます。",
    fretless_bass:"指弾き、スライド、mwahが分かるフレットレス専用フレーズとジャズ・ウォーキングを確認できます。",
    dx_ep:"FMエレピのアタックと倍音が分かるコード演奏／4度堆積ジャズ・ボイシングを確認できます。",
    studio_drums:"PCMドラムキットでシャッフル、ストレート、ジャズ・スウィングを確認できます。",
    electric_guitar:"PCMギター＋アンプでロック、フュージョン、アコースティック、4度堆積ジャズ・コンピングを確認できます。"
  });

  updateInstrumentSurface = function(){
    const key=instrumentKey(currentPatch),drum=key === "studio_drums";
    document.getElementById("keyboardWrap").hidden=drum;
    document.getElementById("drumKitWrap").hidden=!drum;
    const select=document.getElementById("sampleSelect"),options=OPTIONS[key]||OPTIONS.generic;
    const previous=select.value;select.innerHTML="";
    for(const [value,label] of options){
      const opt=document.createElement("option");opt.value=value;opt.textContent=label;select.appendChild(opt);
    }
    if(options.some(([value])=>value===previous)) select.value=previous;
    else if(key === "studio_drums" && currentPatch.drum_style === "half_time_shuffle") select.value="drum_shuffle";
    else if(key === "electric_guitar" && ["rock","fusion","acoustic"].includes(currentPatch.guitar_demo_style)) select.value=`guitar_${currentPatch.guitar_demo_style}`;
    else select.value=options[0][0];
    document.getElementById("sampleDescription").textContent=DESCRIPTIONS[key];
  };

  currentKeyMap = function(){
    return isDrumPatch(currentPatch) ? DRUM_KEY_MAP : SYNTH_KEY_MAP;
  };

  function eventsForStep(step){
    if(step.events) return step.events;
    return (step.notes||[]).map(note=>({note,velocity:step.velocity??.84}));
  }

  async function playInstrumentSample(){
    stopSample({announce:false});
    const selected=document.getElementById("sampleSelect").value;
    const perf=PERFORMANCES[selected]||PERFORMANCES.synth_melody;
    try{await engine.init();}catch(err){showError(err);return;}
    const runId=sampleRunId,beatMs=60000/perf.bpm;let cursor=80;setSamplePlaying(true);
    document.getElementById("status").textContent=`${perf.label}を「${currentPatch.name}」でサンプル演奏中…`;
    for(const step of perf.steps){
      const duration=Math.max(70,step.beats*beatMs),events=eventsForStep(step),gate=Math.max(55,duration*(step.gate??.78));
      sampleTimers.push(setTimeout(()=>{
        if(runId!==sampleRunId)return;
        for(const e of events){sampleActiveNotes.add(e.note);engine.noteOn(e.note,e.velocity??.84);}
      },cursor));
      sampleTimers.push(setTimeout(()=>{
        if(runId!==sampleRunId)return;
        for(const e of events){engine.noteOff(e.note);sampleActiveNotes.delete(e.note);}
      },cursor+gate));
      cursor+=duration;
    }
    sampleTimers.push(setTimeout(()=>{
      if(runId!==sampleRunId)return;
      sampleActiveNotes.clear();sampleTimers=[];setSamplePlaying(false);
      document.getElementById("status").textContent=`サンプル演奏完了 · ${perf.label}`;
    },cursor+650));
  }

  // app.js and guitar_runtime.js registered their play listeners before this runtime existed.
  // Replace only the play button node so there is exactly one sample-performance dispatcher.
  const oldPlayButton=document.getElementById("samplePlayBtn"),playButton=oldPlayButton.cloneNode(true);
  oldPlayButton.replaceWith(playButton);
  playButton.addEventListener("click",playInstrumentSample);

  // Re-apply the current patch through the corrected validator and refresh the surface once.
  engine.setPatch(validatePatch(currentPatch));
})();
