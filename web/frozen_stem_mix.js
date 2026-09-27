"use strict";

// Mix compatible frozen VST3 stems once before transport starts. Preserve
// floating-point headroom so the existing master compressor sees the same sum.
(() => {
  function mix(buffers,ctx,gains=null){
    if(!Array.isArray(buffers)||buffers.length<2||buffers.length>24)return null;
    if(gains===null)gains=buffers.map(()=>1);
    if(!Array.isArray(gains)||gains.length!==buffers.length||gains.some(gain=>!Number.isFinite(gain)||gain<0||gain>100))return null;
    const first=buffers[0];
    if(!first||first.numberOfChannels!==2||first.sampleRate<8000||first.sampleRate>96000||
       first.length<1||first.length>first.sampleRate*42||
       buffers.some(buffer=>buffer.numberOfChannels!==2||buffer.sampleRate!==first.sampleRate||buffer.length!==first.length))return null;
    const result=ctx.createBuffer(2,first.length,first.sampleRate);
    for(let channel=0;channel<2;channel++){
      const output=result.getChannelData(channel);
      for(let j=0;j<buffers.length;j++){const input=buffers[j].getChannelData(channel),gain=gains[j];for(let i=0;i<output.length;i++)output[i]+=input[i]*gain;}
    }
    return result;
  }
  window.frozenStemMix={mix};
})();
