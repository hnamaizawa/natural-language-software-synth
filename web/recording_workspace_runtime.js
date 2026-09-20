"use strict";

// UI-only coordinator for the two existing recording workflows.
// It never creates an AudioContext or changes note/microphone data paths.
(()=>{
  const studio=document.getElementById("recordingStudio");
  const keyboardTab=document.getElementById("recordingKeyboardTab");
  const hummingTab=document.getElementById("recordingHummingTab");
  const keyboardPane=document.getElementById("recordingKeyboardPane");
  const hummingPane=document.getElementById("recordingHummingPane");
  if(!studio||!keyboardTab||!hummingTab||!keyboardPane||!hummingPane)return;

  const entries={
    keyboard:{tab:keyboardTab,pane:keyboardPane},
    humming:{tab:hummingTab,pane:hummingPane},
  };

  function setMode(mode,{focus=false}={}){
    if(!entries[mode])mode="keyboard";
    for(const [name,{tab,pane}] of Object.entries(entries)){
      const active=name===mode;
      tab.setAttribute("aria-selected",active?"true":"false");
      tab.tabIndex=active?0:-1;
      pane.hidden=!active;
      pane.setAttribute("aria-hidden",active?"false":"true");
    }
    studio.dataset.recordingMode=mode;
    if(focus)entries[mode].tab.focus();
  }

  keyboardTab.addEventListener("click",()=>setMode("keyboard"));
  hummingTab.addEventListener("click",()=>setMode("humming"));

  studio.addEventListener("keydown",event=>{
    if(event.target!==keyboardTab&&event.target!==hummingTab)return;
    if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
    event.preventDefault();
    setMode(event.target===keyboardTab?"humming":"keyboard",{focus:true});
  });

  setMode(studio.dataset.defaultMode||"keyboard");
  window.recordingWorkspace={setMode};
})();
