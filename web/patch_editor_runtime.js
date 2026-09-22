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

// v0.10.2 SOUND DESIGN UX.
// This layer is UI-only: it reuses the existing samplePlayBtn, generation route and
// sound-library buttons. It creates no AudioContext, note route, network path or storage.
(() => {
  const SOUND_LABELS_JA=Object.freeze({
    "Grand Piano":"グランドピアノ",
    "Soft Grand":"ソフト・グランド",
    "Rock Guitar":"ロック・ギター",
    "Fusion Guitar":"フュージョン・ギター",
    "Acoustic Guitar":"アコースティック・ギター",
    "Fretless Bass":"フレットレス・ベース",
    "Dry Drums":"ドライ・ドラム",
    "Shuffle Drums":"シャッフル・ドラム",
    "DX-style EP":"DX風エレピ",
    "Warm Analog Pad":"ウォーム・アナログ・パッド",
    "Airy Choir Pad":"エアリー・クワイア・パッド",
    "Dark Cinematic Pad":"ダーク・シネマティック・パッド",
    "Glass Ambient Pad":"グラス・アンビエント・パッド",
    "Dreamy Wide Pad":"ドリーミー・ワイド・パッド",
    "Organic String Pad":"オーガニック・ストリング・パッド",
    "Analog Synth Keys":"アナログ・シンセ・キー",
    "Bright Poly Keys":"ブライト・ポリ・キー",
    "Crystal Keys":"クリスタル・キー",
    "Soft Bell Keys":"ソフト・ベル・キー",
    "PCM Organ":"PCMオルガン",
    "Retro Polysynth":"レトロ・ポリシンセ",
    "Synth Brass":"シンセ・ブラス",
    "Soft Brass":"ソフト・ブラス",
    "Singing Lead":"シンギング・リード",
    "Metallic Lead":"メタリック・リード",
    "Wide Fusion Lead":"ワイド・フュージョン・リード",
    "Airy Solo Lead":"エアリー・ソロ・リード",
    "Glass Bell":"グラス・ベル",
    "Crystal Bell":"クリスタル・ベル",
    "Wooden Pluck":"ウッディ・プラック",
    "Harp Pluck":"ハープ・プラック",
    "Marimba Hybrid":"マリンバ・ハイブリッド",
    "Digital Pluck":"デジタル・プラック",
    "Warm Synth Bass":"ウォーム・シンセ・ベース",
    "Dark Analog Bass":"ダーク・アナログ・ベース",
    "Acid Bass":"アシッド・ベース",
    "Plucked Bass":"撥弦ベース",
    "Air Bass":"エア・ベース",
    "Metal Bass":"メタル・ベース",
    "String Ensemble":"ストリング・アンサンブル",
    "Soft Strings":"ソフト・ストリングス",
    "Airy Choir":"エアリー・クワイア",
    "Dark Choir":"ダーク・クワイア",
    "Vocal Pad":"ボーカル・パッド",
    "Pizzicato Strings":"ピチカート・ストリングス"
  });

  const GROUP_LABELS=Object.freeze({
    all:{ja:"すべての音色",en:"All Sounds"},
    pcm:{ja:"実楽器 / PCM",en:"Acoustic / PCM"},
    pad:{ja:"パッド / アトモスフィア",en:"Pad / Atmosphere"},
    keys:{ja:"鍵盤 / オルガン",en:"Keys / Organ"},
    lead:{ja:"リード / ブラス",en:"Lead / Brass"},
    pluck:{ja:"プラック / ベル",en:"Pluck / Bell"},
    bass:{ja:"ベース",en:"Bass"},
    voice:{ja:"ストリングス / ボイス",en:"Strings / Voice"}
  });

  const CONTROL_HELP_JA=Object.freeze({
    audioBtn:"内蔵音源とFactory PCMを有効化し、ブラウザから音を出せる状態にします。",
    generateBtn:"入力した自然言語からTimbre Intentと音色Patchを生成します。",
    soundDesignPreviewBtn:"現在の音色を、Step 3で選択中のサンプル演奏フレーズでその場で試聴します。",
    paletteLanguageJa:"SOUND DESIGNの音色名とグループ名を日本語表示へ切り替えます。音色そのものは変更しません。",
    paletteLanguageEn:"SOUND DESIGNの音色名とグループ名を英語表示へ切り替えます。音色そのものは変更しません。",
    timbreCompareBtn:"A/B/Cの3候補を同じサンプル演奏フレーズで順番に再生して比較します。",
    timbreRefineBtn:"「もっと暗く」「木質を強く」などの差分指示をTimbre Intentへ反映します。",
    samplePlayBtn:"現在の音色を選択中のサンプル演奏フレーズで再生します。",
    sampleStopBtn:"再生中のサンプル演奏を停止します。",
    resetParamsBtn:"グラフィカルに変更した音色パラメータを、生成直後の値へ戻します。"
  });

  let paletteLanguage="ja";
  let selectedPalettePrompt="";
  let paletteObserver=null;
  let soundDesignObserver=null;

  function soundPaletteGrid(){return document.getElementById("soundPaletteGrid");}
  function englishLabel(button){
    if(button.dataset.soundLabelEn)return button.dataset.soundLabelEn;
    const label=(button.textContent||"").trim();
    button.dataset.soundLabelEn=label;
    return label;
  }
  function japaneseHelp(button,en){
    const prompt=button.dataset.prompt||"";
    const ja=SOUND_LABELS_JA[en]||en;
    return `${ja}：${prompt||"この音色を生成します。"}（クリックするとこの音色を生成します）`;
  }

  function applyPaletteLanguage(){
    const grid=soundPaletteGrid();
    if(grid){
      for(const button of grid.querySelectorAll("button[data-prompt]")){
        const en=englishLabel(button),ja=SOUND_LABELS_JA[en]||en,target=paletteLanguage==="ja"?ja:en;
        if(button.textContent!==target)button.textContent=target;
        button.lang=paletteLanguage==="ja"?"ja":"en";
        button.title=japaneseHelp(button,en);
        button.setAttribute("aria-label",`${target}。${button.dataset.prompt||"音色を生成"}`);
        const selected=button.dataset.prompt===selectedPalettePrompt;
        button.classList.toggle("selected",selected);
        button.setAttribute("aria-pressed",String(selected));
      }
    }
    const category=document.getElementById("soundPaletteCategory");
    if(category){
      for(const option of category.options){
        const meta=GROUP_LABELS[option.value];if(!meta)continue;
        const count=(option.textContent.match(/\((\d+)\)/)||[])[1];
        option.textContent=`${meta[paletteLanguage]}${count?` (${count})`:""}`;
      }
    }
    const search=document.getElementById("soundPaletteSearch");
    if(search)search.placeholder=paletteLanguage==="ja"?"音色を検索（例: 木質、ベル、暖かい）":"Search sounds (e.g. bell, warm, bass)";
    const count=document.getElementById("soundPaletteCount");
    if(count){
      const match=count.textContent.match(/(\d+)\s*\/\s*(\d+)/);
      if(match)count.textContent=`${match[1]} / ${match[2]} ${paletteLanguage==="ja"?"音色":"sounds"}`;
    }
    for(const [lang,id] of [["ja","paletteLanguageJa"],["en","paletteLanguageEn"]]){
      const button=document.getElementById(id);if(!button)continue;
      const active=paletteLanguage===lang;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));
    }
  }

  function installPaletteObserver(){
    const grid=soundPaletteGrid();if(!grid||paletteObserver)return;
    paletteObserver=new MutationObserver(()=>applyPaletteLanguage());
    paletteObserver.observe(grid,{childList:true});
  }

  function installPaletteSelection(){
    const grid=soundPaletteGrid();if(!grid||grid.dataset.selectionInstalled)return;
    grid.dataset.selectionInstalled="true";
    grid.addEventListener("click",event=>{
      const button=event.target&&event.target.closest?event.target.closest("button[data-prompt]"):null;
      if(!button)return;selectedPalettePrompt=button.dataset.prompt||"";applyPaletteLanguage();
    });
  }

  function addQuickControls(){
    const soundDesign=document.getElementById("soundDesign"),promptRow=soundDesign&&soundDesign.querySelector(".prompt-row");
    if(!soundDesign||!promptRow||document.getElementById("soundDesignPreviewBtn"))return;
    const row=document.createElement("div");row.id="soundDesignQuickControls";row.className="sound-design-quick-controls";
    const preview=document.createElement("button");preview.id="soundDesignPreviewBtn";preview.type="button";preview.className="primary";preview.textContent="▶ この音色でサンプル演奏";
    const language=document.createElement("div");language.className="sound-label-language";language.setAttribute("role","group");language.setAttribute("aria-label","音色名の表示言語");
    const ja=document.createElement("button");ja.id="paletteLanguageJa";ja.type="button";ja.textContent="日本語";
    const en=document.createElement("button");en.id="paletteLanguageEn";en.type="button";en.textContent="English";
    language.append(ja,en);row.append(preview,language);promptRow.insertAdjacentElement("afterend",row);
    preview.addEventListener("click",()=>{const play=document.getElementById("samplePlayBtn");if(play&&!play.disabled)play.click();});
    ja.addEventListener("click",()=>{paletteLanguage="ja";applyPaletteLanguage();});
    en.addEventListener("click",()=>{paletteLanguage="en";applyPaletteLanguage();});
  }

  function dynamicButtonHelp(button){
    if(button.classList.contains("ti-candidate"))return"このA/B/C音色候補を現在の音色として適用します。Sample Performanceで同じフレーズを使って比較できます。";
    if(button.id==="timbreCompareBtn")return CONTROL_HELP_JA.timbreCompareBtn;
    if(button.id==="timbreRefineBtn")return CONTROL_HELP_JA.timbreRefineBtn;
    return`${(button.textContent||"このボタン").trim()}を実行します。`;
  }

  function addJapaneseButtonHelp(){
    for(const [id,help] of Object.entries(CONTROL_HELP_JA)){
      const button=document.getElementById(id);if(button)button.title=help;
    }
    for(const button of document.querySelectorAll("#soundDesign button")){
      if(button.matches("#soundPaletteGrid button[data-prompt]"))continue;
      if(!button.title)button.title=dynamicButtonHelp(button);
    }
  }

  function installSoundDesignObserver(){
    const host=document.getElementById("soundDesign");if(!host||soundDesignObserver)return;
    soundDesignObserver=new MutationObserver(()=>addJapaneseButtonHelp());
    soundDesignObserver.observe(host,{childList:true,subtree:true});
  }

  function addStyles(){
    if(document.getElementById("soundDesignUxStyles"))return;
    const style=document.createElement("style");style.id="soundDesignUxStyles";
    style.textContent=`
      .sound-design-quick-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:12px 0 2px}
      .sound-design-quick-controls #soundDesignPreviewBtn{min-height:42px}
      .sound-label-language{display:inline-flex;gap:4px;padding:4px;border:1px solid #343a56;border-radius:12px;background:#10131e}
      .sound-label-language button{padding:7px 11px;border-radius:8px}
      .sound-label-language button.active{border-color:#8e9cff;background:#313a62;box-shadow:0 0 0 2px rgba(142,156,255,.10)}
      #soundPaletteGrid button[title]{position:relative}
      #soundPaletteGrid button.selected{padding-top:29px;border-color:#aab6ff;background:linear-gradient(180deg,#35406c,#272f52);box-shadow:0 0 0 2px rgba(142,156,255,.22),0 7px 18px rgba(64,82,170,.24);transform:translateY(-1px)}
      #soundPaletteGrid button.selected::after{content:"✓ 選択中";position:absolute;top:6px;right:7px;padding:2px 7px;border-radius:999px;background:#8999ff;color:#101528;font-size:.66rem;font-weight:900}
      @media (max-width:620px){.sound-design-quick-controls{align-items:stretch}.sound-design-quick-controls #soundDesignPreviewBtn{width:100%}.sound-label-language{justify-content:center}}
    `;
    document.head.appendChild(style);
  }

  function initSoundDesignUx(){
    addStyles();addQuickControls();installPaletteObserver();installPaletteSelection();installSoundDesignObserver();applyPaletteLanguage();addJapaneseButtonHelp();
    const eyebrow=document.querySelector("header .eyebrow");if(eyebrow)eyebrow.textContent="v0.10.2 audio · core v0.7.2 · Timbre Intent + PCM Hybrid";
    window.soundDesignUx={get language(){return paletteLanguage;},setLanguage(lang){if(lang==="ja"||lang==="en"){paletteLanguage=lang;applyPaletteLanguage();}}};
  }

  setTimeout(initSoundDesignUx,0);
})();
