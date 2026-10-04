"use strict";
// Original, local MIDI arrangements: pitched notes always belong to the bar's
// diatonic triad. A song's rhythm templates shape all seven parts independently.
(() => {
  const songs=Object.freeze({
    pop:{name:"ポップ · Cメジャー",genre:"ポップ",description:"歌えるフック、四つ打ち、I–V–vi–IVの進行。",key:"C major",bpm:104,groove:"pop",roots:[48,43,45,41,48,43,41,43],qualities:["maj","maj","min","maj","maj","maj","maj","maj"]},
    fusion:{name:"フュージョン · Aマイナー",genre:"フュージョン",description:"裏拍で跳ねるベースと細かいドラム、短い和音。",key:"A minor",bpm:112,groove:"fusion",roots:[45,41,48,43,45,41,43,45],qualities:["min","maj","maj","maj","min","maj","maj","min"]},
    ballad:{name:"バラード · Gメジャー",genre:"バラード",description:"余白のある旋律と長いピアノ・パッド。",key:"G major",bpm:80,groove:"ballad",roots:[43,40,36,38,43,40,38,43],qualities:["maj","min","maj","maj","maj","min","maj","maj"]},
    rock:{name:"ロック · Dメジャー",genre:"ロック",description:"ギターの8分刻みと力強い2拍4拍。",key:"D major",bpm:126,groove:"rock",roots:[38,45,35,43,38,45,43,45],qualities:["maj","maj","min","maj","maj","maj","maj","maj"]},
    bossa:{name:"ボサノヴァ · Fメジャー",genre:"ボサノヴァ",description:"柔らかいクロススティックとシンコペーション。",key:"F major",bpm:92,groove:"bossa",roots:[41,36,38,43,41,36,43,41],qualities:["maj","maj","min","min","maj","maj","min","maj"]},
    montuno:{name:"ラテンピアノ・モントゥーノ · Cメジャー",genre:"ラテン / ソン",description:"速いテンポのオクターブ奏法と裏拍の和音が交替する2小節モントゥーノ。トゥンバオ風ベースと3-2クラーベ、C–F–G–Cの8小節。",key:"C major",bpm:140,groove:"montuno",roots:[48,41,43,48,48,41,43,48],qualities:["maj","maj","maj","maj","maj","maj","maj","maj"]},
    funk:{name:"ファンク · Eマイナー",genre:"ファンク",description:"休符を活かした16分ベースと鋭い和音の応答。",key:"E minor",bpm:108,groove:"funk",roots:[40,36,43,38,40,36,38,40],qualities:["min","maj","maj","maj","min","maj","maj","min"]},
    ambient:{name:"アンビエント · Dマイナー",genre:"アンビエント",description:"まばらな打楽器と長いパッド、ゆっくり動く旋律。",key:"D minor",bpm:72,groove:"ambient",roots:[38,34,41,36,38,34,36,38],qualities:["min","maj","maj","maj","min","maj","maj","min"]},
    synthwave:{name:"シンセウェーブ · Cマイナー",genre:"シンセウェーブ",description:"反復する8分ベースと機械的なビート。",key:"C minor",bpm:116,groove:"synthwave",roots:[36,44,39,41,36,44,41,39],qualities:["min","maj","maj","min","min","maj","min","maj"]},
    jazz:{name:"ジャズ · Cメジャー",genre:"ジャズ",description:"スウィングのライドとウォーキングベース、コンピング。",key:"C major",bpm:132,groove:"jazz",roots:[48,45,50,43,48,45,43,48],qualities:["maj","min","min","maj","maj","min","maj","maj"]},
    jpop:{name:"J-Pop · Gメジャー",genre:"J-Pop",description:"歌のシンコペーションと8分ベース、明るいサビ。",key:"G major",bpm:118,groove:"jpop",roots:[43,38,40,36,43,38,36,38],qualities:["maj","maj","min","maj","maj","maj","maj","maj"]},
    anison:{name:"アニソン · Eマイナー",genre:"アニソン",description:"速いメロディーと細かいキック、推進力のあるサビ。",key:"E minor",bpm:152,groove:"anison",roots:[40,36,43,38,40,36,38,40],qualities:["min","maj","maj","maj","min","maj","maj","min"]}
  });
  const triad=(root,quality)=>[root,root+(quality==="min"?3:4),root+7];
  const event=(note,start,duration,velocity=.8)=>({note,start_beats:start,duration_beats:duration,velocity});
  const rhythms={
    pop:{melody:[0,1,2,3],bass:[0,1,2,3],keys:[0,2],guitar:[.5,2.5],kick:[0,2],snare:[1,3],hat:[0,.5,1,1.5,2,2.5,3,3.5]},
    fusion:{melody:[0,.75,1.5,2.75,3.5],bass:[0,.75,1.5,2.5,3.5],keys:[0,1.5,3],guitar:[.75,2.75],kick:[0,1.5,2.75],snare:[1,3],hat:[0,.75,1.5,2.25,3,3.75]},
    ballad:{melody:[0,2,3],bass:[0,2],keys:[0],guitar:[2.5],kick:[0],snare:[2],hat:[0,1,2,3]},
    rock:{melody:[0,.5,1.5,2,3],bass:[0,.5,1,1.5,2,2.5,3,3.5],keys:[0,2],guitar:[0,.5,1,1.5,2,2.5,3,3.5],kick:[0,2,2.5],snare:[1,3],hat:[0,.5,1,1.5,2,2.5,3,3.5]},
    bossa:{melody:[0,1.5,2.5,3.25],bass:[0,1.5,2,3.5],keys:[.5,2.5],guitar:[.5,1.5,2.5,3.5],kick:[0,2.5],snare:[1.5,3.5],hat:[0,1,2,3]},
    montuno:{melody:[0,1.5,2.5,3.5],bass:[0,2.5,3.5],keys:[.5,1.5,2.5,3.5],guitar:[1.5,3.5],kick:[0,2],snare:[],hat:[0,1,2,3]},
    funk:{melody:[0,.75,1.75,2.5,3.25],bass:[0,.75,1.5,2.75,3.25],keys:[.5,1.75,3.25],guitar:[.25,1.75,3],kick:[0,1.75,2.75],snare:[1,3],hat:[0,.25,.75,1,1.5,2,2.5,3,3.5]},
    ambient:{melody:[0,2.5],bass:[0],keys:[0],guitar:[2],kick:[0],snare:[],hat:[0,2]},
    synthwave:{melody:[0,.5,1.5,2.5,3],bass:[0,.5,1,1.5,2,2.5,3,3.5],keys:[0,2],guitar:[1,3],kick:[0,1,2,3],snare:[1,3],hat:[0,.5,1,1.5,2,2.5,3,3.5]},
    jazz:{melody:[0,.67,1.67,2.67,3.33],bass:[0,1,2,3],keys:[.67,2.67],guitar:[1.67,3.67],kick:[0,2],snare:[1.67,3.67],hat:[0,.67,1,1.67,2,2.67,3,3.67]},
    jpop:{melody:[0,.5,1.5,2,2.5,3.5],bass:[0,.5,1.5,2,2.5,3.5],keys:[0,1.5,3],guitar:[.5,1.5,2.5,3.5],kick:[0,2,3.5],snare:[1,3],hat:[0,.5,1,1.5,2,2.5,3,3.5]},
    anison:{melody:[0,.25,.75,1.5,2,2.5,3,3.5],bass:[0,.5,1,1.5,2,2.5,3,3.5],keys:[0,1,2,3],guitar:[0,.5,1,1.5,2,2.5,3,3.5],kick:[0,.75,2,2.75,3.5],snare:[1,3],hat:[0,.5,1,1.5,2,2.5,3,3.5]}
  };
  function makeSong(id){
    const spec=songs[id];if(!spec)return null;
    const pattern=rhythms[spec.groove],parts={drums:[],bass:[],keyboard:[],guitar:[],melody:[],chorus:[],pad:[]};
    const add=(role,note,bar,at,duration,velocity)=>parts[role].push(event(note,bar*4+at,Math.min(duration,4-at),velocity));
    for(let bar=0;bar<8;bar++){
      const chord=triad(spec.roots[bar],spec.qualities[bar]);
      pattern.kick.forEach(at=>add("drums",36,bar,at,.18,.82));
      pattern.snare.forEach(at=>add("drums",spec.groove==="bossa"?37:38,bar,at,.18,.72));
      pattern.hat.forEach(at=>add("drums",spec.groove==="jazz"?51:42,bar,at,.12,.38));
      if(spec.groove==="montuno"){
        // A two-bar piano ostinato: syncopated octave strikes answer short
        // chord-tone dyads against alternating 3-side / 2-side clave accents.
        const even=bar%2===0;
        (even?[0,1.5,3]:[1,3]).forEach(at=>add("drums",37,bar,at,.12,.56));
        pattern.bass.forEach((at,i)=>add("bass",(i===1?chord[2]:chord[0])-12,bar,at,Math.min(.38,4-at),i===2?.83:.75));
        const hits=even?[.5,1.5,2.5,3.5]:[0,.75,2,3.5];
        hits.forEach((at,i)=>{
          const octave=i%2===0,base=(even?(i===0?chord[0]:chord[2]):(i===0?chord[2]:chord[0]))+12;
          const notes=octave?[base,base+12]:[chord[1]+12,chord[2]+12];
          notes.forEach(pitch=>add("keyboard",pitch,bar,at,Math.min(octave?.25:.32,4-at),octave?.75:.6));
        });
      }else{
        pattern.bass.forEach((at,i)=>add("bass",chord[(i+bar)%3]-12,bar,at,Math.min(.8,4-at),i===0?.82:.7));
        pattern.keys.forEach((at,i)=>chord.forEach(pitch=>add("keyboard",pitch+12,bar,at,spec.groove==="ambient"?3.8:Math.min(1.3,4-at),i===0?.55:.45)));
      }
      pattern.guitar.forEach((at,i)=>chord.forEach(pitch=>add("guitar",pitch+12,bar,at,spec.groove==="ambient"?1.7:Math.min(.48,4-at),.48)));
      chord.forEach(pitch=>add("pad",pitch+12,bar,0,spec.groove==="anison"?2.8:3.8,.38));
      pattern.melody.forEach((at,i)=>add("melody",chord[(i+Math.floor(bar/2))%3]+24,bar,at,Math.min(i===pattern.melody.length-1?.7:.56,4-at),i===0?.85:.71));
      [pattern.melody[1],pattern.melody.at(-1)].forEach((at,i)=>add("chorus",chord[(i+bar)%3]+12,bar,at,spec.groove==="ambient"?.85:.65,.4));
    }
    const clips={};for(const [role,notes] of Object.entries(parts))clips[role]=[0,16].map((start,index)=>({name:`${spec.name} · ${index?"B":"A"}`,start_beats:start,length_beats:16,notes:notes.filter(note=>note.start_beats>=start&&note.start_beats<start+16).map(note=>({...note,start_beats:note.start_beats-start,duration_beats:Math.min(note.duration_beats,start+16-note.start_beats)}))}));
    return {name:spec.name,key:spec.key,genre:spec.genre,description:spec.description,bpm:spec.bpm,length_beats:32,clips};
  }
  window.sequencerSamples={songs,makeSong};
})();
