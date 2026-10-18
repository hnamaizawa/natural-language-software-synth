(function(){
  "use strict";

  const sourceTabs = document.querySelector("#trackSoundPanel .track-source-tabs");
  const vstPicker = document.querySelector("#trackSoundPanel .track-vst-picker");
  const sourceGrid = document.querySelector("#trackSoundPanel .track-source-grid");
  const soundPanel = document.getElementById("trackSoundPanel");
  const soundDesign = document.getElementById("soundDesign");
  const soundSource = document.getElementById("soundSource");
  const performance = document.getElementById("performance");
  const recording = document.getElementById("recordingStudio");
  if(!soundPanel||!soundDesign||!soundSource||!performance||!recording)return;

  const nav=document.createElement("div");
  nav.className="track-workflow-tabs";
  nav.setAttribute("role","tablist");
  nav.setAttribute("aria-label","選択パートの音色と演奏メニュー");
  const content=document.createElement("div");
  content.className="track-workflow-content";
  soundPanel.append(nav,content);

  const steps=[
    {id:"soundDesign",label:"1. 音色を作る",element:soundDesign,sources:["internal","reference"]},
    {id:"soundSource",label:"2. 音色を選ぶ",element:soundSource,sources:["internal","reference","vst3"]},
    {id:"performance",label:"3. 演奏・試聴",element:performance,sources:["internal","reference","vst3"]},
    {id:"recordingStudio",label:"4. 録音",element:recording,sources:["internal","reference"]},
  ];
  const panes=new Map();
  for(const step of steps){
    const pane=document.createElement("div");
    pane.className="track-workflow-pane";
    pane.id=`trackWorkflowPane-${step.id}`;
    pane.setAttribute("role","tabpanel");
    pane.setAttribute("aria-labelledby",`trackWorkflowTab-${step.id}`);
    pane.hidden=true;
    pane.append(step.element);
    content.append(pane);
    const button=document.createElement("button");
    button.type="button";
    button.id=`trackWorkflowTab-${step.id}`;
    button.className="track-workflow-tab";
    button.setAttribute("role","tab");
    button.setAttribute("aria-controls",pane.id);
    button.setAttribute("aria-selected","false");
    button.tabIndex=-1;
    button.textContent=step.label;
    button.addEventListener("click",()=>activate(step.id));
    button.addEventListener("keydown",onTabKey);
    nav.append(button);
    panes.set(step.id,{step,pane,button});
  }

  // Step 2 owns source selection. Existing controls are moved intact so their
  // event handlers and IDs remain compatible with the audio and VST runtimes.
  const sourcePane=panes.get("soundSource").pane;
  if(sourceTabs)sourcePane.prepend(sourceTabs);
  if(vstPicker)sourcePane.append(vstPicker);
  if(sourceGrid)sourcePane.append(sourceGrid);
  const vstAudition=document.createElement("div");
  vstAudition.className="track-vst-audition";
  vstAudition.hidden=true;
  vstAudition.innerHTML='<strong>選択パートのVST3を試聴</strong><p>アレンジメントでクリップを選び、再生してこのパートのVST3音色を確認します。</p><button type="button" class="primary">▶ 選択クリップを試聴</button>';
  vstAudition.querySelector("button").addEventListener("click",()=>document.getElementById("clipPreviewBtn")?.click());
  const samplePlayer=performance.querySelector(".sample-player");
  if(samplePlayer)performance.prepend(vstAudition);
  soundSource.classList.add("legacy-global-vst-controls");
  soundSource.hidden=true;
  soundSource.setAttribute("aria-hidden","true");

  // Keep the graphical patch editor with sound design while preserving its
  // existing controls and runtime references.
  const currentSoundHeader=document.querySelector(".instrument-panel .section-title");
  if(currentSoundHeader)soundDesign.prepend(currentSoundHeader);
  const paramsPanel=document.querySelector(".params-panel");
  if(paramsPanel)soundDesign.append(paramsPanel);
  const outputMeter=document.querySelector(".instrument-panel .meter-wrap");
  if(outputMeter)performance.append(outputMeter);
  const legacyWorkspace=document.querySelector(".workspace");
  if(legacyWorkspace)legacyWorkspace.hidden=true;

  let activeId="soundSource";
  let sourceType="internal";
  function allowedStep(id){return panes.get(id)?.step.sources.includes(sourceType)||false;}
  function activate(id,focus=false){
    if(!allowedStep(id))return false;
    activeId=id;
    for(const {step,pane,button} of panes.values()){
      const active=step.id===id;
      pane.hidden=!active;
      button.hidden=!step.sources.includes(sourceType);
      button.classList.toggle("active",active);
      button.setAttribute("aria-selected",String(active));
      button.tabIndex=active?0:-1;
    }
    if(focus)panes.get(id)?.button.focus();
    return true;
  }
  function setSource(type,{focusSource=false}={}){
    sourceType=["internal","reference","vst3"].includes(type)?type:"internal";
    const isVst=sourceType==="vst3";
    if(vstPicker)vstPicker.hidden=!isVst;
    if(sourceGrid)sourceGrid.hidden=isVst;
    vstAudition.hidden=!isVst;
    if(samplePlayer)samplePlayer.hidden=isVst;
    const outputMeter=performance.querySelector(".meter-wrap");if(outputMeter)outputMeter.hidden=isVst;
    const keyboard=document.getElementById("keyboardWrap");if(keyboard)keyboard.hidden=isVst;
    const drums=document.getElementById("drumKitWrap");if(drums)drums.hidden=isVst;
    const legacyVst=soundSource;
    if(legacyVst){legacyVst.hidden=true;legacyVst.setAttribute("aria-hidden","true");}
    soundDesign.querySelectorAll(".reference-match-panel").forEach(node=>node.hidden=sourceType!=="reference");
    soundDesign.querySelectorAll(".realistic-preset-panel").forEach(node=>node.hidden=isVst);
    for(const {step,button} of panes.values())button.hidden=!step.sources.includes(sourceType);
    if(!allowedStep(activeId)||focusSource)activate(sourceType==="reference"?"soundDesign":"soundSource");
    else activate(activeId);
    soundPanel.dataset.sourceType=sourceType;
  }
  const sourceContentObserver=new MutationObserver(records=>{
    if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(
      node.matches?.(".reference-match-panel,.realistic-preset-panel")||node.querySelector?.(".reference-match-panel,.realistic-preset-panel")
    ))))setSource(sourceType);
  });
  sourceContentObserver.observe(soundDesign,{childList:true,subtree:true});
  function onTabKey(event){
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    const visible=[...nav.querySelectorAll('[role="tab"]')].filter(button=>!button.hidden);
    const index=visible.indexOf(event.currentTarget);
    const next=event.key==="Home"?0:event.key==="End"?visible.length-1:(index+(event.key==="ArrowRight"?1:-1)+visible.length)%visible.length;
    event.preventDefault();
    visible[next]?.click();
    visible[next]?.focus();
  }
  window.trackWorkflow={setSource,activate};
  activate(activeId);
  setSource("internal");
})();
