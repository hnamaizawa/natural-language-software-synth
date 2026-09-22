"use strict";

// Accessible native hover/focus help for static and dynamically-created UI.
(() => {
  const PARAM_HELP=Object.freeze({
    osc1_wave:"主となる発振波形。倍音構成と音の基本的な性格を決めます。",osc2_wave:"重ねる発振波形。主波形に厚みや別の倍音を加えます。",
    osc_mix:"2つの発振器の音量バランスです。",osc2_detune_cents:"2つ目の発振器の音程差。少量で厚みが出ます。",
    filter_cutoff_hz:"高域を削り始める周波数。下げるほど暗い音になります。",filter_q:"カットオフ付近の強調量。上げるほどクセの強い音になります。",
    attack_s:"鍵盤を押してから最大音量に達するまでの時間です。",decay_s:"アタック後にサステイン音量へ落ち着くまでの時間です。",
    sustain:"鍵盤を押し続けた間に維持する音量です。",release_s:"鍵盤を離してから消音するまでの時間です。",
    lfo_rate_hz:"ビブラートの揺れる速さです。",lfo_depth_cents:"ビブラートによる音程の揺れ幅です。",delay_mix:"反復するディレイ音の混合量です。",
    sample_tone:"フレットレス音源の明るさです。",sample_attack_mix:"弦を弾いた瞬間のPCM成分の量です。",finger_noise_mix:"指が弦に触れるノイズの量です。",
    release_noise_mix:"指を離した際のノイズ量です。",slide_amount:"次の音へ滑るピッチ変化の量です。",slide_time_s:"スライドが完了するまでの時間です。",
    mwah_amount:"フレットレス特有の歌う中域の強さです。",sample_velocity_curve:"打鍵強度に対する音量変化のカーブです。",
    guitar_body_tone:"ギター本体の胴鳴りと明るさです。",guitar_pick_mix:"ピックの立ち上がり成分の量です。",guitar_release_mix:"弦を離す音の量です。",
    guitar_palm_mute:"手のひらで弦を抑えた短い響きの強さです。",guitar_sustain:"ギター音が伸びる長さです。",guitar_amp_drive:"アンプの歪み量です。",
    guitar_amp_tone:"アンプ部の明るさです。",guitar_amp_presence:"高域の輪郭と前に出る感覚です。",guitar_cabinet_mix:"スピーカーキャビネットの色付け量です。",guitar_chorus_mix:"コーラスによる広がりの量です。",
    piano_tone:"ピアノの明るさです。",piano_hammer_mix:"ハンマーが弦を打つ成分の量です。",piano_resonance:"響板と弦の共鳴量です。",piano_damper_noise:"離鍵時のダンパーノイズ量です。",
    piano_softness:"ハンマーの柔らかさ。上げるほど丸い音になります。",piano_sustain:"ピアノの余韻の長さです。",piano_velocity_curve:"打鍵強度に対するピアノ音量の変化です。",piano_room_mix:"部屋鳴りの量です。",
    pcm_tone:"CC0 PCM音源の高域の明るさです。",pcm_attack_s:"PCM音が立ち上がる時間です。",pcm_release_s:"離鍵後にPCM音が消えるまでの時間です。",
    pcm_body:"楽器の中低域の胴鳴りを強調します。",pcm_room_mix:"短い室内反射音の量です。",pcm_velocity_curve:"演奏強度に対するPCM音量の反応です。",
    kick_tune_hz:"キックの基音の高さです。",kick_decay_s:"キックの余韻の長さです。",snare_tone_hz:"スネア胴鳴りの高さです。",snare_decay_s:"スネアの余韻の長さです。",
    hat_decay_s:"ハイハットの余韻の長さです。",tom_decay_s:"タムの余韻の長さです。",drum_brightness:"ドラム全体の高域量です。",drum_room_mix:"ドラムの部屋鳴りの量です。",
    fm_mod_index:"FM変調の深さ。上げるほど倍音が増えます。",fm_brightness:"FMエレピの高域の明るさです。",fm_ratio_1:"第1モジュレーターの周波数比です。",fm_ratio_2:"第2モジュレーターの周波数比です。",
    fm_decay_s:"FMエレピが減衰する時間です。",fm_release_s:"離鍵後にFMエレピが消える時間です。",fm_chorus_mix:"コーラスによる左右の広がりです。",master_gain:"最終出力音量です。",
    resynth_morph:"2つの音源特徴を混ぜる比率です。",resynth_harmonics:"再合成に使用する倍音数です。",resynth_brightness:"再合成音の高域量です。",resynth_pcm_mix:"元PCMの混合量です。",
    resynth_transient_mix:"発音直後のアタック量です。",resynth_detune_cents:"重ねた音の微小な音程差です。",resynth_noise_mix:"息や摩擦に相当するノイズ量です。",
    resynth_attack_s:"再合成音の立ち上がり時間です。",resynth_decay_s:"再合成音が安定するまでの時間です。",resynth_sustain:"押鍵中の再合成音量です。",resynth_release_s:"離鍵後の再合成音の余韻です。"
  });
  const ID_HELP=Object.freeze({prompt:"作りたい音を日本語または英語で入力します。",generateBtn:"入力した説明から安全な範囲の音色を生成します。",sampleSelect:"現在の楽器に合う試奏フレーズを選びます。",samplePlayBtn:"現在の音色で選択したフレーズを再生します。",sampleStopBtn:"サンプル演奏を停止します。",resetParamsBtn:"各パラメータを生成直後の値へ戻します。",midiBtn:"接続済みMIDIキーボードから演奏できるようにします。"});

  function describe(element){
    if(element.title)return;
    const key=element.dataset&&element.dataset.param;
    let help=key&&PARAM_HELP[key]||ID_HELP[element.id];
    if(!help&&element.matches("button"))help=`「${element.textContent.trim()}」を実行します。`;
    if(!help&&element.matches("select"))help="クリックして使用する選択肢を切り替えます。";
    if(!help&&element.matches('input[type="range"]'))help="左右へ動かして値を調整します。";
    if(!help&&element.matches("input,textarea"))help="この項目を入力または編集します。";
    if(help){element.title=help;element.setAttribute("aria-description",help);const card=element.closest(".param-control");if(card&&!card.title)card.title=help;}
  }
  function scan(root=document){root.querySelectorAll("[data-param],button,select,input,textarea,summary,.key,.drum-pad").forEach(describe);}
  scan();new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1){describe(node);scan(node);}}))).observe(document.body,{childList:true,subtree:true});
  window.synthUIHelp={PARAM_HELP,scan};
})();
