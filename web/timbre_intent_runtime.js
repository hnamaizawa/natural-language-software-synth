"use strict";

// v0.10.0 Timbre Intent Engine.
// Natural language is first converted into a bounded, inspectable timbre-design document.
// The intent is then mapped to three validated Patch candidates. User text remains data only;
// this runtime never evaluates/generated code and only calls the existing same-origin patch API.
(() => {
  const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
  const mix=(a,b,t)=>Number(a)+(Number(b)-Number(a))*clamp01(t);
  const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,Number(value)||0));

  const ROLE_DEFS=Object.freeze({
    bass:["bass","sub bass","synth bass","ベース","サブベース","低音","低域","アシッド"],
    pad:["pad","ambient","atmosphere","cinematic","swell","パッド","アンビエント","シネマ","浮遊","スウェル"],
    keys:["keys","keyboard","organ","polysynth","鍵盤","キー","オルガン","ポリシンセ"],
    lead:["lead","brass","solo","horn","リード","ブラス","ソロ","ホーン"],
    pluck:["pluck","bell","harp","mallet","marimba","pizzicato","プラック","ベル","ハープ","マレット","マリンバ","ピチカート"],
    voice:["strings","string ensemble","choir","voice","vocal","ストリングス","クワイア","ボイス","声","弦"],
    piano:["grand piano","concert grand","acoustic piano","グランドピアノ","生ピアノ"],
    guitar:["electric guitar","acoustic guitar","guitar","エレキギター","アコースティックギター","ギター"],
    drums:["drum kit","drums","kick","snare","ドラム","キック","スネア"],
    ep:["dx-7","dx7","fm electric piano","fm ep","dxエレピ","fmエレピ"]
  });

  const AXES=Object.freeze({
    brightness:{label:"明るさ",positive:["bright","brilliant","sparkling","clear","crisp","明る","きらびやか","透明","抜け","輝"],negative:["dark","dull","muted","暗い","暗く","こも","鈍い"]},
    warmth:{label:"暖かさ",positive:["warm","mellow","round","暖か","温か","丸い","まろやか"],negative:["cold","icy","cool","冷たい","冷た","氷"]},
    hardness:{label:"硬さ",positive:["hard","sharp","edgy","硬い","硬く","鋭い","鋭く"],negative:["soft","gentle","柔らか","優しい","丸い"]},
    attack_speed:{label:"Attack速度",positive:["fast attack","quick attack","instant attack","速いアタック","アタックが速","立ち上がりが速","立ち上がりは速"],negative:["slow attack","swell","遅いアタック","アタックが遅","ゆっくり立ち上","立ち上がりが遅"]},
    length:{label:"音の長さ",positive:["long release","long sustain","lingering","sustain","long","長い余韻","長く残","長く伸","余韻","持続"],negative:["short release","short","staccato","短い余韻","短く","短い","スタッカート"]},
    width:{label:"広がり",positive:["wide","lush","spread","stereo","広い","広がり","包む"],negative:["narrow","mono","狭い","中央"]},
    room:{label:"空間/残響",positive:["spacious","reverb","echo","hall","distant","far","空間","残響","ホール","遠い","遠く"],negative:["dry","close","near","ドライ","近い","近く"]},
    air:{label:"Air/息",positive:["airy","breathy","breath","wind","air","息","空気","エアリー","ブレス","風","霧","煙"],negative:["solid","dense air","無音","無風"]},
    metal:{label:"金属/ガラス",positive:["metallic","metal","steel","glass","crystal","金属","メタリック","鋼","ガラス","クリスタル"],negative:["non-metal","金属ではない"]},
    wood:{label:"木質",positive:["wooden","woody","wood","木質","木の","木製"],negative:["non-wood","木質ではない"]},
    organic:{label:"有機感",positive:["organic","natural","human","acoustic","有機","自然","生々","生っぽ"],negative:["digital","synthetic","artificial","デジタル","人工的","機械的"]},
    roughness:{label:"粗さ/ノイズ",positive:["rough","gritty","dirty","noisy","ざら","荒い","粗い","ノイジー","歪ん"],negative:["clean","smooth","クリーン","滑らか","なめらか"]},
    thickness:{label:"太さ/密度",positive:["fat","thick","dense","heavy","太い","厚い","濃い","重い"],negative:["thin","light","細い","薄い","軽い"]},
    percussive:{label:"パーカッシブ",positive:["percussive","punchy","punch","hit","パーカッシブ","パンチ","打楽器","打撃"],negative:["legato","smooth attack","レガート","滑らかなアタック"]}
  });

  const INTENSIFIERS=[[/かなり|とても|非常に|強く|もっと|very|extremely|strongly/g,1.45],[/少し|やや|ほんの|軽く|slightly|a little|subtle/g,.58]];
  const NEGATION=/(ではない|じゃない|ではなく|without|not\s|no\s)/i;

  function occurrences(text,word){
    const out=[];let from=0,needle=String(word).toLowerCase();
    while(true){const index=text.indexOf(needle,from);if(index<0)break;out.push(index);from=index+Math.max(1,needle.length);}return out;
  }
  function weightAt(text,index){
    const context=text.slice(Math.max(0,index-22),index+4);let weight=1;
    for(const[pattern,factor]of INTENSIFIERS){pattern.lastIndex=0;if(pattern.test(context))weight*=factor;}
    if(NEGATION.test(context))weight*=-1;
    return weight;
  }
  function analyzeAxis(text,def){
    let score=0,matches=0;
    for(const word of def.positive){for(const index of occurrences(text,word)){score+=weightAt(text,index);matches++;}}
    for(const word of def.negative){for(const index of occurrences(text,word)){score-=weightAt(text,index);matches++;}}
    return{value:clamp01(.5+Math.max(-2,Math.min(2,score))*.235),confidence:clamp01(matches*.28+Math.abs(score)*.18),matches};
  }
  function roleFromText(text){
    const scores={};
    for(const[role,words]of Object.entries(ROLE_DEFS)){
      let score=0;for(const word of words)score+=occurrences(text,word).length*(1+Math.min(1.2,word.length/12));if(score)scores[role]=score;
    }
    const entries=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    if(!entries.length)return{value:"unknown",confidence:0,scores};
    const total=entries.reduce((sum,[,v])=>sum+v,0);return{value:entries[0][0],confidence:clamp01(entries[0][1]/Math.max(1,total)),scores};
  }
  function registerForRole(role){return role==="bass"?.12:role==="drums"?.32:role==="pad"?.48:role==="voice"?.55:role==="keys"?.58:role==="piano"?.58:role==="guitar"?.54:role==="pluck"?.66:role==="lead"?.72:.52;}
  function parseIntent(prompt){
    const text=String(prompt||"").trim().toLowerCase(),axis={};
    for(const[key,def]of Object.entries(AXES))axis[key]=analyzeAxis(text,def);
    const role=roleFromText(text);
    return{
      schema_version:"1.0",parser:"local-deterministic-v1",prompt:String(prompt||"").slice(0,500),role,
      material:{wood:axis.wood.value,metal:axis.metal.value,air:axis.air.value,organic:axis.organic.value},
      envelope:{attack_speed:axis.attack_speed.value,length:axis.length.value},
      spectrum:{brightness:axis.brightness.value,warmth:axis.warmth.value,harmonic_density:clamp01(axis.brightness.value*.38+axis.metal.value*.24+axis.roughness.value*.16+axis.thickness.value*.22)},
      texture:{hardness:axis.hardness.value,roughness:axis.roughness.value,thickness:axis.thickness.value,percussive:axis.percussive.value},
      space:{width:axis.width.value,room:axis.room.value,distance:axis.room.value},
      performance:{register:registerForRole(role.value)},
      evidence:Object.fromEntries(Object.entries(axis).map(([key,v])=>[key,{confidence:v.confidence,matches:v.matches}]))
    };
  }

  function inferRoleFromPatch(p){
    if(!p)return"unknown";if(p.instrument_model==="fretless_bass")return"bass";if(p.instrument_model==="grand_piano")return"piano";
    if(p.instrument_model==="electric_guitar")return"guitar";if(p.instrument_model==="studio_drums"||p.engine_type==="drum")return"drums";if(p.instrument_model==="dx_ep"||p.engine_type==="fm")return"ep";
    if(p.instrument_model==="spectral_resynth"){
      const text=`${p.prompt||""} ${p.name||""}`.toLowerCase(),role=roleFromText(text);if(role.value!=="unknown")return role.value;
      if(Number(p.octave_shift)<=-1)return"bass";if(Number(p.resynth_attack_s)>=.35)return"pad";if(Number(p.resynth_transient_mix)>=.5)return"pluck";return"lead";
    }
    return"keys";
  }

  const deepCopy=value=>JSON.parse(JSON.stringify(value));
  const setPath=(object,path,value)=>{const parts=path.split(".");let target=object;for(const part of parts.slice(0,-1))target=target[part];target[parts.at(-1)]=clamp01(value);};
  const getPath=(object,path)=>path.split(".").reduce((value,key)=>value&&value[key],object);

  function resynthSources(p,intent,profile){
    const wood=intent.material.wood,metal=intent.material.metal,air=intent.material.air;
    if(profile.id==="C"&&Math.max(wood,metal,air)>.58){
      if(metal>=wood&&metal>=air)return["piano","guitar",.66];if(wood>=air)return["guitar","fretless",.32];return["fretless","piano",.56];
    }
    if(metal>.64)return["piano","guitar",Math.max(.52,Number(p.resynth_morph)||.35)];
    if(wood>.64)return["guitar","fretless",Math.min(.45,Number(p.resynth_morph)||.35)];
    if(air>.64)return["fretless","piano",Math.max(.44,Number(p.resynth_morph)||.35)];
    return[p.resynth_source_a||"piano",p.resynth_source_b||"guitar",Number(p.resynth_morph)||.35];
  }

  const PROFILES=Object.freeze([
    {id:"A",label:"Balanced",description:"文章の解釈を素直に反映",organic:0,experimental:0},
    {id:"B",label:"Organic",description:"PCM Bodyと自然な質感を強める",organic:.16,experimental:-.03},
    {id:"C",label:"Experimental",description:"倍音・Morph・広がりを強める",organic:-.03,experimental:.18}
  ]);

  function mapIntentToPatch(base,intent,profile){
    const p={...base},b=intent.spectrum.brightness,w=intent.spectrum.warmth,hard=intent.texture.hardness,rough=intent.texture.roughness,thick=intent.texture.thickness,perc=intent.texture.percussive;
    const attack=intent.envelope.attack_speed,length=intent.envelope.length,width=intent.space.width,room=intent.space.room,air=intent.material.air,wood=intent.material.wood,metal=intent.material.metal,organic=intent.material.organic;
    const role=intent.role.value;
    p.name=`${String(base.name||"Generated").replace(/^\[[ABC]\]\s*/,"")} [${profile.id} ${profile.label}]`.slice(0,80);p.prompt=intent.prompt;
    if(p.instrument_model==="spectral_resynth"){
      const [sourceA,sourceB,morph]=resynthSources(p,intent,profile);p.resynth_source_a=sourceA;p.resynth_source_b=sourceB;
      p.resynth_morph=clamp(morph+profile.experimental*(metal-air)*.45,0,1);
      p.resynth_brightness=clamp(mix(p.resynth_brightness,b*.84+(1-w)*.16,.68)+profile.experimental*.12,0,1);
      const desiredHarmonics=4+Math.round((intent.spectrum.harmonic_density*.64+b*.20+metal*.16)*28);
      p.resynth_harmonics=Math.round(clamp(mix(p.resynth_harmonics,desiredHarmonics,.66)+profile.experimental*22,4,32));
      p.resynth_pcm_mix=clamp(mix(p.resynth_pcm_mix,(organic*.46+wood*.34+thick*.20)*.62,.70)+profile.organic*.42,0,.65);
      p.resynth_transient_mix=clamp(mix(p.resynth_transient_mix,hard*.36+perc*.45+attack*.19,.70)+profile.experimental*.10,0,1);
      p.resynth_noise_mix=clamp(mix(p.resynth_noise_mix,(air*.62+rough*.38)*.30,.72)+Math.max(0,profile.experimental)*.04,0,.35);
      p.resynth_detune_cents=clamp(mix(Math.abs(Number(p.resynth_detune_cents)||0),width*19,.68)+profile.experimental*28,-30,30);
      const attackMax=role==="pad"||role==="voice"?2.1:role==="bass"?.28:.85;
      p.resynth_attack_s=clamp(mix(p.resynth_attack_s,.002+Math.pow(1-attack,2)*attackMax,.72),.001,8);
      p.resynth_decay_s=clamp(mix(p.resynth_decay_s,.08+length*1.75,.62),.001,8);
      p.resynth_sustain=clamp(mix(p.resynth_sustain,.12+length*.78,.62),0,1);
      p.resynth_release_s=clamp(mix(p.resynth_release_s,.06+Math.pow(length,2)*5.8,.72),.01,10);
      p.delay_mix=clamp(mix(p.delay_mix,room*.40,.64),0,.65);p.delay_feedback=clamp(mix(p.delay_feedback,room*.42,.60),0,.75);p.delay_time_s=clamp(mix(p.delay_time_s,.05+room*.58,.60),0,1.5);
      if(role==="bass")p.octave_shift=-1;
    }else if(p.engine_type==="synth"){
      p.filter_cutoff_hz=clamp(mix(p.filter_cutoff_hz,350+Math.pow(b,1.45)*15000,.72),80,18000);p.filter_q=clamp(mix(p.filter_q,.5+rough*7+metal*3,.55),.1,18);
      p.attack_s=clamp(mix(p.attack_s,.002+Math.pow(1-attack,2)*1.7,.7),.001,8);p.release_s=clamp(mix(p.release_s,.04+length*5,.7),.01,10);p.sustain=clamp(mix(p.sustain,.15+length*.78,.6),0,1);
      p.osc2_detune_cents=clamp(mix(Math.abs(p.osc2_detune_cents||0),width*24,.65)+profile.experimental*24,-50,50);p.delay_mix=clamp(mix(p.delay_mix,room*.40,.6),0,.65);
    }else if(p.instrument_model==="fretless_bass"){
      p.sample_tone=clamp(mix(p.sample_tone,b,.68),0,1);p.sample_attack_mix=clamp(mix(p.sample_attack_mix,(hard+perc)/2,.62),0,1);p.finger_noise_mix=clamp(mix(p.finger_noise_mix,(organic+rough)/2,.58)+profile.organic*.18,0,1);p.mwah_amount=clamp(mix(p.mwah_amount,.3+length*.6,.5),0,1);
    }else if(p.instrument_model==="electric_guitar"){
      p.guitar_body_tone=clamp(mix(p.guitar_body_tone,b,.62),0,1);p.guitar_pick_mix=clamp(mix(p.guitar_pick_mix,(hard+perc)/2,.65),0,1);p.guitar_amp_drive=clamp(mix(p.guitar_amp_drive,rough*.72,.52)+profile.experimental*.35,0,1);p.guitar_chorus_mix=clamp(mix(p.guitar_chorus_mix,width*.32,.55),0,.5);
    }else if(p.instrument_model==="grand_piano"){
      p.piano_tone=clamp(mix(p.piano_tone,b,.62),0,1);p.piano_hammer_mix=clamp(mix(p.piano_hammer_mix,(hard+perc)/2,.65),0,1);p.piano_softness=clamp(mix(p.piano_softness,1-hard,.55),0,1);p.piano_resonance=clamp(mix(p.piano_resonance,length,.55),0,1);p.piano_room_mix=clamp(mix(p.piano_room_mix,room*.5,.6),0,.5);
    }else if(p.engine_type==="fm"){
      p.fm_brightness=clamp(mix(p.fm_brightness,b,.7)+profile.experimental*.12,0,1);p.fm_mod_index=clamp(mix(p.fm_mod_index,1+metal*12+rough*4,.6)+profile.experimental*20,0,18);p.fm_release_s=clamp(mix(p.fm_release_s,.1+length*5,.65),.05,8);p.fm_chorus_mix=clamp(mix(p.fm_chorus_mix,width*.4,.6),0,.5);
    }else if(p.engine_type==="drum"){
      p.drum_brightness=clamp(mix(p.drum_brightness,b,.7),0,1);p.drum_room_mix=clamp(mix(p.drum_room_mix,room*.42,.65),0,.45);p.kick_decay_s=clamp(mix(p.kick_decay_s,.08+length*.7,.5),.05,1.2);p.snare_decay_s=clamp(mix(p.snare_decay_s,.06+length*.65,.5),.05,1);
    }
    return validatePatch(p);
  }
  function buildCandidates(base,intent){return PROFILES.map(profile=>({id:profile.id,label:profile.label,description:profile.description,patch:mapIntentToPatch(base,intent,profile)}));}

  const CONTROL_PATHS=Object.freeze([
    ["spectrum.brightness","明るさ"],["spectrum.warmth","暖かさ"],["material.wood","木質"],["material.metal","金属/ガラス"],["material.air","Air/息"],["material.organic","有機感"],
    ["envelope.attack_speed","Attack速度"],["envelope.length","音の長さ"],["texture.hardness","硬さ"],["texture.roughness","粗さ"],["texture.thickness","太さ"],["texture.percussive","パーカッシブ"],["space.width","広がり"],["space.room","空間/残響"]
  ]);

  const state={intent:null,basePatch:null,candidates:[],selected:0,comparing:false};

  function ensureIntentPanel(){
    let panel=document.getElementById("timbreIntentPanel");if(panel)return panel;
    panel=document.createElement("section");panel.id="timbreIntentPanel";panel.className="timbre-intent-panel";panel.hidden=true;
    panel.innerHTML=`<div class="ti-head"><div><span class="kicker">TIMBRE INTENT · v0.10.0</span><strong>自然言語をどう解釈したか</strong><small id="timbreIntentParser">Local deterministic parser</small></div><div id="timbreIntentRole" class="ti-role">Role —</div></div><p class="ti-help">文章を直接DSP値へせず、まず音色設計書へ変換します。スライダーを直すとA/B/C候補も再計算されます。</p><div id="timbreIntentAxes" class="ti-axes"></div><div class="ti-candidates"><div class="ti-candidate-head"><strong>A / B / C 候補</strong><button id="timbreCompareBtn" type="button">▶ 同じフレーズでA/B/C比較</button></div><div id="timbreCandidateList" class="ti-candidate-list"></div></div><div class="ti-refine"><label for="timbreRefineInput">差分指示</label><input id="timbreRefineInput" maxlength="180" placeholder="例: もっと暗く。アタックだけ少し弱く。"/><button id="timbreRefineBtn" type="button">設計書へ反映</button></div><p id="timbreIntentStatus" class="ti-status"></p>`;
    const status=document.getElementById("status");status.parentElement.insertBefore(panel,status);
    const style=document.createElement("style");style.id="timbreIntentStyle";style.textContent=`.timbre-intent-panel{margin-top:16px;padding:16px;border:1px solid #39415f;border-radius:16px;background:#111521}.ti-head,.ti-candidate-head{display:flex;justify-content:space-between;gap:14px;align-items:center}.ti-head strong{display:block;font-size:1.05rem}.ti-head small,.ti-help,.ti-status{color:#9ca6c4}.ti-role{padding:8px 12px;border:1px solid #475174;border-radius:999px;color:#dce5ff}.ti-axes{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px;margin:14px 0}.ti-axis{display:grid;grid-template-columns:1fr auto;gap:5px 8px;padding:9px;border:1px solid #2e354d;border-radius:11px;background:#0d1018}.ti-axis input{grid-column:1/3;width:100%}.ti-axis output{color:#bcd0ff}.ti-candidates{margin-top:12px;padding-top:12px;border-top:1px solid #2d344b}.ti-candidate-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:9px}.ti-candidate{padding:10px;text-align:left;border:1px solid #343d59;border-radius:12px;background:#151a27;position:relative}.ti-candidate.active{padding-top:31px;border-color:#aab6ff;outline:2px solid rgba(142,167,255,.34);background:linear-gradient(180deg,#35406c,#272f52);box-shadow:0 7px 18px rgba(64,82,170,.24);transform:translateY(-1px)}.ti-candidate.active::after{content:"✓ 選択中";position:absolute;top:7px;right:8px;padding:2px 7px;border-radius:999px;background:#8999ff;color:#101528;font-size:.66rem;font-weight:900}.ti-candidate strong,.ti-candidate span{display:block}.ti-candidate span{color:#9ca6c4;font-size:.78rem;margin-top:3px}.ti-refine{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin-top:12px}.ti-refine input{min-height:40px;color:#eef1ff;background:#0e1019;border:1px solid #343a56;border-radius:10px;padding:7px 10px}@media(max-width:760px){.ti-candidate-list{grid-template-columns:1fr}.ti-refine{grid-template-columns:1fr}.ti-head{align-items:flex-start;flex-direction:column}}`;
    document.head.appendChild(style);
    document.getElementById("timbreRefineBtn").addEventListener("click",refineFromInput);document.getElementById("timbreCompareBtn").addEventListener("click",compareCandidates);
    return panel;
  }

  function renderIntent(){
    if(!state.intent)return;const panel=ensureIntentPanel();panel.hidden=false;
    const role=state.intent.role;document.getElementById("timbreIntentRole").textContent=`Role: ${role.value} · ${Math.round(role.confidence*100)}%`;document.getElementById("timbreIntentParser").textContent=`${state.intent.parser} · schema ${state.intent.schema_version}`;
    const axes=document.getElementById("timbreIntentAxes");axes.innerHTML="";
    for(const[path,label]of CONTROL_PATHS){const value=Number(getPath(state.intent,path)??.5),box=document.createElement("label");box.className="ti-axis";box.innerHTML=`<span>${label}</span><output>${Math.round(value*100)}%</output><input type="range" min="0" max="1" step="0.01" value="${value}" data-intent-path="${path}">`;const input=box.querySelector("input"),output=box.querySelector("output");input.addEventListener("input",()=>{output.textContent=`${Math.round(Number(input.value)*100)}%`;});input.addEventListener("change",()=>{setPath(state.intent,path,Number(input.value));rebuildCandidates(state.selected);document.getElementById("timbreIntentStatus").textContent=`${label}を手動調整し、候補を再生成しました。`;});axes.appendChild(box);}
    renderCandidates();
  }
  function renderCandidates(){
    const root=document.getElementById("timbreCandidateList");if(!root)return;root.innerHTML="";
    state.candidates.forEach((candidate,index)=>{const button=document.createElement("button");button.type="button";const selected=index===state.selected;button.className=`ti-candidate${selected?" active":""}`;button.setAttribute("aria-pressed",String(selected));button.innerHTML=`<strong>${candidate.id} · ${candidate.label}</strong><span>${candidate.description}</span><span>${candidate.patch.instrument_model} / ${candidate.patch.engine_type}</span>`;button.addEventListener("click",()=>applyCandidate(index));root.appendChild(button);});
  }
  function applyCandidate(index,{announce=true}={}){
    const candidate=state.candidates[index];if(!candidate)return;stopSample({announce:false});state.selected=index;generatedPatch=validatePatch(candidate.patch);engine.setPatch(generatedPatch);currentPatch=engine.patch;renderCandidates();
    if(announce)document.getElementById("status").textContent=`候補 ${candidate.id} ${candidate.label} を適用しました。同じSample Performanceで比較できます。`;
  }
  function rebuildCandidates(selected=0){if(!state.basePatch||!state.intent)return;state.candidates=buildCandidates(state.basePatch,state.intent);applyCandidate(Math.min(selected,state.candidates.length-1),{announce:false});renderIntent();}

  function mentionedPaths(instruction){
    const text=instruction.toLowerCase(),paths=new Set();for(const[key,def]of Object.entries(AXES)){if([...def.positive,...def.negative].some(word=>text.includes(word)))paths.add(key);}return paths;
  }
  const AXIS_TO_PATH={brightness:"spectrum.brightness",warmth:"spectrum.warmth",hardness:"texture.hardness",attack_speed:"envelope.attack_speed",length:"envelope.length",width:"space.width",room:"space.room",air:"material.air",metal:"material.metal",wood:"material.wood",organic:"material.organic",roughness:"texture.roughness",thickness:"texture.thickness",percussive:"texture.percussive"};
  function refineIntent(current,instruction){
    const parsed=parseIntent(instruction),next=deepCopy(current),mentioned=mentionedPaths(instruction);for(const axis of mentioned){const path=AXIS_TO_PATH[axis],target=getPath(parsed,path),before=getPath(next,path);setPath(next,path,mix(before,target,.52));}
    if(parsed.role.value!=="unknown"&&parsed.role.confidence>.55){next.role=parsed.role;next.performance.register=registerForRole(parsed.role.value);}next.prompt=current.prompt;return next;
  }
  function refineFromInput(){
    if(!state.intent)return;const input=document.getElementById("timbreRefineInput"),instruction=input.value.trim();if(!instruction)return;
    const mentioned=mentionedPaths(instruction);if(!mentioned.size&&roleFromText(instruction.toLowerCase()).value==="unknown"){document.getElementById("timbreIntentStatus").textContent="変更対象の音色軸を認識できませんでした。例: もっと暗く、木質を強く、余韻を短く。";return;}
    state.intent=refineIntent(state.intent,instruction);rebuildCandidates(state.selected);input.value="";document.getElementById("timbreIntentStatus").textContent=`差分「${instruction}」を設計書へ反映しました。未指定の軸は維持しています。`;
  }

  function waitForPlayback(){return new Promise(resolve=>{let started=false,elapsed=0;const timer=setInterval(()=>{elapsed+=120;if(samplePlaying)started=true;if((started&&!samplePlaying)||elapsed>32000){clearInterval(timer);resolve();}},120);});}
  async function compareCandidates(){
    if(state.comparing||state.candidates.length<2)return;state.comparing=true;const button=document.getElementById("timbreCompareBtn"),original=button.textContent,phrase=document.getElementById("sampleSelect").value;button.disabled=true;button.textContent="比較中…";
    try{for(let index=0;index<state.candidates.length;index++){applyCandidate(index,{announce:false});const select=document.getElementById("sampleSelect");if(Array.from(select.options).some(option=>option.value===phrase))select.value=phrase;document.getElementById("status").textContent=`A/B/C比較 · ${state.candidates[index].id} ${state.candidates[index].label}`;document.getElementById("samplePlayBtn").click();await waitForPlayback();await new Promise(resolve=>setTimeout(resolve,300));}document.getElementById("status").textContent="A/B/C比較が完了しました。最後の候補Cを適用しています。";}finally{button.disabled=false;button.textContent=original;state.comparing=false;}
  }

  async function generateWithIntent(){
    stopSample({announce:false});const prompt=document.getElementById("prompt").value.trim();if(!prompt){document.getElementById("status").textContent="音色のイメージを入力してください。";return;}document.getElementById("status").textContent="Timbre Intentを解析して音色候補を生成中…";
    try{
      let intent=parseIntent(prompt);const response=await fetch("/api/generate-patch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})}),data=await response.json();if(!response.ok)throw new Error(data.error||"generation failed");const base=validatePatch(data.patch);
      if(intent.role.value==="unknown"){intent.role={value:inferRoleFromPatch(base),confidence:.62,scores:{}};intent.performance.register=registerForRole(intent.role.value);}state.intent=intent;state.basePatch=base;state.candidates=buildCandidates(base,intent);state.selected=0;ensureIntentPanel();renderIntent();applyCandidate(0,{announce:false});document.getElementById("status").textContent=`生成完了 · Timbre Intent: ${intent.role.value} · A/B/C 3候補を作成しました。`;
    }catch(error){showError(error);}
  }

  function install(){
    if(!window.adaptiveSamplePerformance||typeof validatePatch!=="function"||typeof engine==="undefined"){setTimeout(install,30);return;}
    ensureIntentPanel();const old=document.getElementById("generateBtn"),button=old.cloneNode(true);old.replaceWith(button);button.addEventListener("click",generateWithIntent);generate=generateWithIntent;
    window.timbreIntentEngine={parseIntent,buildCandidates,refineIntent,getIntent:()=>state.intent?deepCopy(state.intent):null,getCandidates:()=>state.candidates.map(item=>({...item,patch:{...item.patch}})),applyCandidate};
  }
  install();
})();
