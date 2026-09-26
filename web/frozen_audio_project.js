"use strict";

// Portable, bounded frozen stems for Project JSON. The compressed bytes are
// PCM16 audio data, never executable input or plug-in state.
(() => {
  const MAX_STEM_BYTES=16*1024*1024,MAX_TOTAL_BYTES=96*1024*1024,MAX_FILE_BYTES=160*1024*1024;
  function metadata(value){
    const sampleRate=Number(value?.sample_rate),channels=Number(value?.channels),frames=Number(value?.frames);
    if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>96000||
       !Number.isInteger(channels)||channels<1||channels>2||
       !Number.isInteger(frames)||frames<1||frames>sampleRate*42||
       frames*channels*2>MAX_STEM_BYTES)throw new Error("フリーズ音声の長さ・形式が上限を超えています。");
    return {sampleRate,channels,frames,bytes:frames*channels*2};
  }
  function base64(bytes){
    const parts=[];for(let at=0;at<bytes.length;at+=32768)parts.push(String.fromCharCode(...bytes.subarray(at,at+32768)));
    return btoa(parts.join(""));
  }
  function unbase64(value){
    if(typeof value!=="string"||value.length>Math.ceil(MAX_STEM_BYTES*4/3)+8||
       value.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error("フリーズ音声データが不正です。");
    const raw=atob(value),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return bytes;
  }
  async function inflateBounded(compressed,maxBytes){
    const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
    const chunks=[];let total=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;
      if(total>maxBytes){await reader.cancel();throw new Error("フリーズ音声の展開サイズが上限を超えています。");}chunks.push(value);}}
    finally{reader.releaseLock();}
    const result=new Uint8Array(total);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
    return result;
  }
  async function signature(track,project){
    const data={bpm:project.bpm,length_beats:project.length_beats,source:track.source,
      clips:track.clips,midi_channel:track.midi_channel,volume:track.volume};
    // Preserve signatures in existing VST3 project files.
    if(track.source?.type!=="vst3"){data.patch=track.patch;data.generated_patch=track.generated_patch;}
    const text=JSON.stringify(data);
    const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)));
    return Array.from(digest,byte=>byte.toString(16).padStart(2,"0")).join("");
  }
  async function encode(buffer,track,project){
    const meta=metadata({sample_rate:buffer.sampleRate,channels:buffer.numberOfChannels,frames:buffer.length});
    const pcm=new Uint8Array(meta.bytes),view=new DataView(pcm.buffer),channels=Array.from({length:meta.channels},(_,i)=>buffer.getChannelData(i));
    for(let frame=0;frame<meta.frames;frame++)for(let channel=0;channel<meta.channels;channel++){
      const value=Math.max(-1,Math.min(1,channels[channel][frame]||0));
      view.setInt16((frame*meta.channels+channel)*2,Math.round(value*(value<0?32768:32767)),true);
    }
    const compressed=new Uint8Array(await new Response(new Blob([pcm]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
    return {track_id:track.id,format:"pcm16-gzip-v1",sample_rate:meta.sampleRate,channels:meta.channels,
      frames:meta.frames,signature:await signature(track,project),data:base64(compressed)};
  }
  async function decode(entry,track,project,ctx){
    if(entry?.track_id!==track?.id||!["vst3","internal","reference"].includes(track.source?.type)||track.source?.shared_with||
       entry?.format!=="pcm16-gzip-v1"||!entry?.signature||entry.signature!==await signature(track,project))
      throw new Error("フリーズ音声とトラック設定が一致しません。");
    const meta=metadata(entry),pcm=await inflateBounded(unbase64(entry.data),meta.bytes);
    if(pcm.length!==meta.bytes)throw new Error("フリーズ音声のデータ長が一致しません。");
    const buffer=ctx.createBuffer(meta.channels,meta.frames,meta.sampleRate),view=new DataView(pcm.buffer);
    for(let channel=0;channel<meta.channels;channel++){
      const samples=buffer.getChannelData(channel);
      for(let frame=0;frame<meta.frames;frame++)samples[frame]=view.getInt16((frame*meta.channels+channel)*2,true)/32768;
    }
    return buffer;
  }
  window.frozenAudioProject={encode,decode,MAX_STEM_BYTES,MAX_TOTAL_BYTES,MAX_FILE_BYTES};
})();
