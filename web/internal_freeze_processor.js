"use strict";

// Capture the existing AudioContext's master bus at exact audio-clock frames.
class InternalFreezeProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.startFrame=options.processorOptions.startFrame;
    this.endFrame=options.processorOptions.endFrame;
    this.chunk=new Float32Array(4096*2);
    this.used=0;
    this.done=false;
  }
  flush() {
    if(!this.used)return;
    const data=this.chunk.slice(0,this.used);
    this.port.postMessage({data:data.buffer},[data.buffer]);
    this.used=0;
  }
  process(inputs) {
    if(this.done)return false;
    const input=inputs[0]||[],left=input[0],right=input[1]||left;
    for(let i=0;i<128;i++) {
      const frame=currentFrame+i;
      if(frame<this.startFrame)continue;
      if(frame>=this.endFrame){this.flush();this.done=true;this.port.postMessage({done:true});return false;}
      this.chunk[this.used++]=left?.[i]||0;
      this.chunk[this.used++]=right?.[i]||0;
      if(this.used===this.chunk.length)this.flush();
    }
    return true;
  }
}
registerProcessor("internal-freeze-capture",InternalFreezeProcessor);
