"use strict";

// Keep continuous range dragging stable: parameter edits must update the validated
// patch without rebuilding the editor DOM on every input event.
engine.setPatchWithRender = function(raw, render=true) {
  this.patch=validatePatch(raw);
  if(this.master)this.master.gain.setTargetAtTime(this.patch.master_gain,this.ctx.currentTime,.02);
  if(this.drumRoomGain)this.drumRoomGain.gain.setTargetAtTime(this.patch.drum_room_mix,this.ctx.currentTime,.02);
  if(render)renderPatch();
};

applyParam = function(key,value,rerender=true) {
  engine.setPatchWithRender({...currentPatch,[key]:value},false);
  currentPatch=engine.patch;
  if(rerender)renderParameters();
  document.getElementById("status").textContent=`${key} を調整しました。`;
};
