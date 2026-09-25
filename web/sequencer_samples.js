"use strict";
// Original MIDI demo arrangements. Every pitched event is drawn from the selected
// key and the chord at its bar; percussion retains standard GM drum notes.
(() => {
  const songs=Object.freeze({
    pop:{name:"ポップ · Cメジャー",key:"C major",bpm:104,roots:[48,43,45,41,48,43,41,43],qualities:["maj","maj","min","maj","maj","maj","maj","maj"]},
    fusion:{name:"フュージョン · Aマイナー",key:"A minor",bpm:112,roots:[45,41,48,43,45,41,43,45],qualities:["min","maj","maj","maj","min","maj","maj","min"]},
    ballad:{name:"バラード · Gメジャー",key:"G major",bpm:80,roots:[43,40,36,38,43,40,38,43],qualities:["maj","min","maj","maj","maj","min","maj","maj"]}
  });
  const triad=(root,quality)=>[root,root+(quality==="min"?3:4),root+7];
  const event=(note,start,duration,velocity=.8)=>({note,start_beats:start,duration_beats:duration,velocity});
  function makeSong(id){
    const spec=songs[id];if(!spec)return null;
    const parts={drums:[],bass:[],keyboard:[],guitar:[],melody:[],chorus:[],pad:[]};
    for(let bar=0;bar<8;bar++){
      const chord=triad(spec.roots[bar],spec.qualities[bar]),base=bar*4;
      for(let beat=0;beat<4;beat++){
        const at=base+beat;
        parts.drums.push(event(42,at,.18,.46));
        if(beat===0||beat===2)parts.drums.push(event(36,at,.22,.87));
        if(beat===1||beat===3)parts.drums.push(event(38,at,.22,.76));
        if(id==="fusion")parts.drums.push(event(42,at+.5,.14,.36));
        parts.bass.push(event(chord[beat%3]-12,at,.72,beat===0?.85:.7));
      }
      for(const pitch of chord){parts.keyboard.push(event(pitch+12,base,1.8,.58));parts.pad.push(event(pitch+12,base,3.8,.43));}
      for(const pitch of chord)parts.guitar.push(event(pitch+12,base+2,1.5,.55));
      parts.melody.push(event(chord[0]+24,base,.9,.8),event(chord[1]+24,base+1, .85,.74),event(chord[2]+24,base+2,.9,.82),event(chord[1]+24,base+3,.85,.7));
      parts.chorus.push(event(chord[2]+12,base+2,1.8,.42));
    }
    const clips={};for(const [role,notes] of Object.entries(parts))clips[role]=[0,16].map((start,index)=>({name:`${spec.name} · ${index?"B":"A"}`,start_beats:start,length_beats:16,notes:notes.filter(note=>note.start_beats>=start&&note.start_beats<start+16).map(note=>({...note,start_beats:note.start_beats-start}))}));
    return {name:spec.name,key:spec.key,bpm:spec.bpm,length_beats:32,clips};
  }
  window.sequencerSamples={songs,makeSong};
})();
