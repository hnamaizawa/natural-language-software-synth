"use strict";
// Original MIDI demo arrangements. Every pitched event is drawn from the selected
// key and the chord at its bar; percussion retains standard GM drum notes.
(() => {
  const songs=Object.freeze({
    pop:{name:"ポップ · Cメジャー",genre:"ポップ",description:"明るい四つ打ちと歌えるメロディー。I–V–vi–IVを中心に展開します。",key:"C major",bpm:104,groove:"straight",roots:[48,43,45,41,48,43,41,43],qualities:["maj","maj","min","maj","maj","maj","maj","maj"]},
    fusion:{name:"フュージョン · Aマイナー",genre:"フュージョン",description:"シンコペーションしたハイハットと跳ねるベースの都会的な短編です。",key:"A minor",bpm:112,groove:"funk",roots:[45,41,48,43,45,41,43,45],qualities:["min","maj","maj","maj","min","maj","maj","min"]},
    ballad:{name:"バラード · Gメジャー",genre:"バラード",description:"ゆったりしたピアノとパッドに、余白のある旋律を重ねます。",key:"G major",bpm:80,groove:"slow",roots:[43,40,36,38,43,40,38,43],qualities:["maj","min","maj","maj","maj","min","maj","maj"]},
    rock:{name:"ロック · Dメジャー",genre:"ロック",description:"強いスネアの2拍4拍とギターの刻みで前へ進む構成です。",key:"D major",bpm:126,groove:"rock",roots:[38,45,35,43,38,45,43,45],qualities:["maj","maj","min","maj","maj","maj","maj","maj"]},
    bossa:{name:"ボサノヴァ · Fメジャー",genre:"ボサノヴァ",description:"軽いクラーベのアクセントと交互に動く低音、柔らかな和音。",key:"F major",bpm:92,groove:"bossa",roots:[41,36,38,43,41,36,43,41],qualities:["maj","maj","min","min","maj","maj","min","maj"]},
    funk:{name:"ファンク · Eマイナー",genre:"ファンク",description:"16分音符の刻みと休符を効かせたベース、短いコードの応答。",key:"E minor",bpm:108,groove:"funk",roots:[40,36,43,38,40,36,38,40],qualities:["min","maj","maj","maj","min","maj","maj","min"]},
    ambient:{name:"アンビエント · Dマイナー",genre:"アンビエント",description:"長いパッドと間のあるメロディーで静かな空間を作ります。",key:"D minor",bpm:72,groove:"ambient",roots:[38,34,41,36,38,34,36,38],qualities:["min","maj","maj","maj","min","maj","maj","min"]},
    synthwave:{name:"シンセウェーブ · Cマイナー",genre:"シンセウェーブ",description:"反復する低音と規則的なビート、広がりのあるコーラス。",key:"C minor",bpm:116,groove:"drive",roots:[36,44,39,41,36,44,41,39],qualities:["min","maj","maj","min","min","maj","min","maj"]}
  });
  const triad=(root,quality)=>[root,root+(quality==="min"?3:4),root+7];
  const event=(note,start,duration,velocity=.8)=>({note,start_beats:start,duration_beats:duration,velocity});
  const melodicShapes=[[0,1,2,1],[2,1,0,1],[1,2,1,0],[2,0,1,2]];
  function closeChordTone(pitch,previous){
    const candidates=[pitch+12,pitch+24,pitch+36].filter(note=>note>=68&&note<=84);
    return candidates.sort((a,b)=>Math.abs(a-previous)-Math.abs(b-previous)||Math.abs(a-75)-Math.abs(b-75))[0];
  }
  function makeSong(id){
    const spec=songs[id];if(!spec)return null;
    const parts={drums:[],bass:[],keyboard:[],guitar:[],melody:[],chorus:[],pad:[]};
    let previousMelody=spec.roots[0]+24;
    for(let bar=0;bar<8;bar++){
      const chord=triad(spec.roots[bar],spec.qualities[bar]),base=bar*4;
      for(let beat=0;beat<4;beat++){
        const at=base+beat;
        if(spec.groove!=="ambient"||beat%2===0)parts.drums.push(event(spec.groove==="bossa"?37:42,at,.18,.46));
        if(beat===0||beat===2&&spec.groove!=="bossa"&&spec.groove!=="ambient")parts.drums.push(event(36,at,.22,.87));
        if((beat===1||beat===3)&&spec.groove!=="ambient")parts.drums.push(event(spec.groove==="bossa"?37:38,at,.22,.76));
        if(["funk","drive"].includes(spec.groove))parts.drums.push(event(42,at+.5,.14,.36));
        if(spec.groove!=="ambient"||beat%2===0)parts.bass.push(event(chord[spec.groove==="funk"?(beat+1)%3:beat%3]-12,at,spec.groove==="slow"?1.2:.72,beat===0?.85:.7));
      }
      for(const pitch of chord){parts.keyboard.push(event(pitch+12,base,1.8,.58));parts.pad.push(event(pitch+12,base,3.8,.43));}
      for(const pitch of chord)parts.guitar.push(event(pitch+12,base+(spec.groove==="bossa"?1.5:spec.groove==="rock"?1:2),spec.groove==="funk"?.35:1.5,.55));
      const motif=melodicShapes[bar%melodicShapes.length];
      for(let beat=0;beat<4;beat++){
        // Land on chord tones on every beat. A major-chord fourth or a minor
        // chord flat sixth would clash against the sustained accompaniment.
        const note=closeChordTone(chord[motif[beat]],previousMelody);
        parts.melody.push(event(note,base+beat,beat===3?.65:beat===1?.7:.85,spec.groove==="ambient"?.56:beat===0?.82:.72));
        previousMelody=note;
      }
      if(bar%2===1)parts.melody.push(event(previousMelody,base+3.5,.38,.48));
      parts.chorus.push(event(chord[2]+12,base+2,1.8,.42));
    }
    const clips={};for(const [role,notes] of Object.entries(parts))clips[role]=[0,16].map((start,index)=>({name:`${spec.name} · ${index?"B":"A"}`,start_beats:start,length_beats:16,notes:notes.filter(note=>note.start_beats>=start&&note.start_beats<start+16).map(note=>({...note,start_beats:note.start_beats-start,duration_beats:Math.min(note.duration_beats,start+16-note.start_beats)}))}));
    return {name:spec.name,key:spec.key,genre:spec.genre,description:spec.description,bpm:spec.bpm,length_beats:32,clips};
  }
  window.sequencerSamples={songs,makeSong};
})();
