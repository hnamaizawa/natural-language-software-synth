"use strict";

// v0.11.0 Preset-first instrument workflow + local Reference Audio Match.
// User-selected MP3/WAV/M4A audio is decoded and analysed only in browser memory.
// Raw audio is never uploaded, persisted, stored in localStorage, or copied into source.
// Extracted bounded features only adjust an existing validated instrument patch.
(() => {
  const MAX_FILE_BYTES = 80 * 1024 * 1024;
  const MIN_ANALYSIS_SECONDS = 3;
  const MAX_ANALYSIS_SECONDS = 30;
  const FFT_SIZE = 2048;
  const MAX_FRAMES = 24;
  const SUPPORTED_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "mp4"]);
  const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, Number(value) || 0));
  const mix = (a, b, t) => Number(a) + (Number(b) - Number(a)) * clamp01(t);

  const REALISTIC_PRESETS = Object.freeze([
    {
      id: "studio_tenor_sax", group: "winds", ja: "スタジオ・テナーサックス", en: "Studio Tenor Sax",
      help: "CC0公開されたVCSLの実録音PCMを使い、ポップスやジャズのリードで扱いやすく整えたテナーサックスです。",
      target: "generic",
      patch: {
        name: "Studio Tenor Sax", engine_type: "sampler", instrument_model: "licensed_pcm", pcm_instrument: "tenor_sax",
        pcm_tone: .72, pcm_attack_s: .014, pcm_release_s: .38, pcm_body: .66, pcm_room_mix: .09,
        pcm_velocity_curve: 1.08, master_gain: .20, max_polyphony: 8, prompt: "CC0 VCSL studio tenor sax"
      }
    },
    {
      id: "pop_close_grand", group: "keys", ja: "ポップ・クローズピアノ", en: "Pop Close Piano",
      help: "バンド内で埋もれにくい短めの余韻と明瞭なアタックに整えた実用的なポップピアノです。",
      target: "piano",
      patch: {name:"Pop Close Piano",engine_type:"sampler",instrument_model:"grand_piano",piano_tone:.78,piano_hammer_mix:.62,piano_resonance:.48,piano_damper_noise:.12,piano_softness:.10,piano_sustain:.68,piano_velocity_curve:1.18,piano_room_mix:.06,master_gain:.21,max_polyphony:16,prompt:""}
    },
    {
      id: "neo_soul_ep", group: "keys", ja: "ネオソウルFMエレピ", en: "Neo Soul FM EP",
      help: "丸いアタックと深めのコーラスで、コード演奏に馴染むネオソウル向けエレピです。",
      target: "ep",
      patch: {name:"Neo Soul FM EP",engine_type:"fm",instrument_model:"dx_ep",fm_mod_index:3.9,fm_brightness:.58,fm_ratio_1:14,fm_ratio_2:1,fm_decay_s:3.4,fm_release_s:2.1,fm_chorus_mix:.30,master_gain:.20,max_polyphony:12,prompt:""}
    },
    {
      id: "pop_pocket_drums", group: "drums", ja: "ポップ・ポケットドラム", en: "Pop Pocket Drums",
      help: "短く締まったキックと明瞭なスネアで、打ち込みの土台にしやすいポップ向けドラムです。",
      target: "drums",
      patch: {name:"Pop Pocket Drums",engine_type:"drum",instrument_model:"studio_drums",drum_style:"standard",kick_tune_hz:52,kick_decay_s:.20,snare_tone_hz:205,snare_decay_s:.16,hat_decay_s:.065,tom_decay_s:.32,drum_brightness:.76,drum_room_mix:.08,master_gain:.23,max_polyphony:16,prompt:""}
    },
    {
      id: "modern_fusion_6string_bass", group: "bass", ja: "モダン・フュージョン6弦ベース", en: "Modern Fusion 6-string Bass",
      help: "速い指弾きでも輪郭が残るアタック、締まった低域、前に出る中高域を重視したモダン・フュージョン向けベースです。",
      target: "fretless",
      patch: {
        name: "Modern Fusion 6-string Bass", engine_type: "sampler", instrument_model: "fretless_bass",
        sample_tone: .88, sample_attack_mix: .78, finger_noise_mix: .64, release_noise_mix: .18,
        slide_amount: .18, slide_time_s: .12, mwah_amount: .42, sample_velocity_curve: 1.25,
        lfo_rate_hz: 4.2, lfo_depth_cents: 2.0, master_gain: .22, max_polyphony: 10,
        prompt: "モダン・フュージョン6弦ベース。明瞭で速い指弾きアタック、締まった低域、前に出る中高域。"
      }
    },
    {
      id: "fretless_bridge_70s", group: "bass", ja: "70年代ブリッジ・フレットレス", en: "70s Bridge Fretless",
      help: "ブリッジ寄りの明るい中高域、指弾きアタック、歌うミッドレンジを重視したフレットレスベースの基準音色です。",
      target: "fretless",
      patch: {
        name: "70s Bridge Fretless", engine_type: "sampler", instrument_model: "fretless_bass",
        sample_tone: .80, sample_attack_mix: .66, finger_noise_mix: .76, release_noise_mix: .25,
        slide_amount: .34, slide_time_s: .18, mwah_amount: .76, sample_velocity_curve: 1.08,
        lfo_rate_hz: 4.6, lfo_depth_cents: 3.5, master_gain: .23, max_polyphony: 10, prompt: ""
      }
    },
    {
      id: "fretless_warm", group: "bass", ja: "ウォーム・シンギング・フレットレス", en: "Warm Singing Fretless",
      help: "高域を少し抑え、丸い胴鳴りと長めの歌う成分を重視したフレットレスベースです。",
      target: "fretless",
      patch: {
        name: "Warm Singing Fretless", engine_type: "sampler", instrument_model: "fretless_bass",
        sample_tone: .54, sample_attack_mix: .50, finger_noise_mix: .50, release_noise_mix: .20,
        slide_amount: .42, slide_time_s: .23, mwah_amount: .82, sample_velocity_curve: .96,
        lfo_rate_hz: 4.3, lfo_depth_cents: 5.5, master_gain: .24, max_polyphony: 10, prompt: ""
      }
    },
    {
      id: "concert_grand", group: "keys", ja: "コンサート・グランド", en: "Concert Grand",
      help: "響板の共鳴、ハンマーの立ち上がり、自然なサステインを重視したグランドピアノです。",
      target: "piano",
      patch: {
        name: "Concert Grand", engine_type: "sampler", instrument_model: "grand_piano",
        piano_tone: .72, piano_hammer_mix: .50, piano_resonance: .80, piano_damper_noise: .16,
        piano_softness: .18, piano_sustain: .94, piano_velocity_curve: 1.12, piano_room_mix: .22,
        master_gain: .21, max_polyphony: 16, prompt: ""
      }
    },
    {
      id: "close_grand", group: "keys", ja: "クローズ・グランド", en: "Close Grand",
      help: "部屋鳴りを抑え、鍵盤とハンマーが近く感じられるドライ寄りのグランドピアノです。",
      target: "piano",
      patch: {
        name: "Close Grand", engine_type: "sampler", instrument_model: "grand_piano",
        piano_tone: .68, piano_hammer_mix: .60, piano_resonance: .54, piano_damper_noise: .20,
        piano_softness: .14, piano_sustain: .82, piano_velocity_curve: 1.05, piano_room_mix: .05,
        master_gain: .21, max_polyphony: 16, prompt: ""
      }
    },
    {
      id: "clean_fusion_guitar", group: "guitar", ja: "クリーン・フュージョン・ギター", en: "Clean Fusion Guitar",
      help: "クリーン寄りのアンプ、明瞭なピック、滑らかなサステインを重視したギターです。",
      target: "guitar",
      patch: {
        name: "Clean Fusion Guitar", engine_type: "sampler", instrument_model: "electric_guitar",
        guitar_amp_model: "clean", guitar_demo_style: "fusion", guitar_body_tone: .70, guitar_pick_mix: .38,
        guitar_release_mix: .12, guitar_palm_mute: .03, guitar_sustain: .84, guitar_amp_drive: .22,
        guitar_amp_tone: .70, guitar_amp_presence: .64, guitar_cabinet_mix: .72, guitar_chorus_mix: .12,
        master_gain: .20, max_polyphony: 10, prompt: ""
      }
    },
    {
      id: "acoustic_style_guitar", group: "guitar", ja: "アコースティック・ギター", en: "Acoustic-style Guitar",
      help: "木質のボディとピックの立ち上がりを前に出した、歪みのないアコースティック寄りギターです。",
      target: "guitar",
      patch: {
        name: "Acoustic-style Guitar", engine_type: "sampler", instrument_model: "electric_guitar",
        guitar_amp_model: "acoustic", guitar_demo_style: "acoustic", guitar_body_tone: .84, guitar_pick_mix: .52,
        guitar_release_mix: .20, guitar_palm_mute: .02, guitar_sustain: .68, guitar_amp_drive: 0,
        guitar_amp_tone: .76, guitar_amp_presence: .44, guitar_cabinet_mix: .26, guitar_chorus_mix: .03,
        master_gain: .21, max_polyphony: 10, prompt: ""
      }
    },
    {
      id: "dry_studio_drums", group: "drums", ja: "ドライ・スタジオ・ドラム", en: "Dry Studio Drums",
      help: "短い余韻と近いマイク感を重視した、音色判定しやすいスタジオ・ドラムです。",
      target: "drums",
      patch: {
        name: "Dry Studio Drums", engine_type: "drum", instrument_model: "studio_drums", drum_style: "standard",
        kick_tune_hz: 56, kick_decay_s: .23, snare_tone_hz: 188, snare_decay_s: .17,
        hat_decay_s: .07, tom_decay_s: .35, drum_brightness: .70, drum_room_mix: .05,
        master_gain: .24, max_polyphony: 16, prompt: ""
      }
    },
    {
      id: "shuffle_studio_drums", group: "drums", ja: "シャッフル・スタジオ・ドラム", en: "Shuffle Studio Drums",
      help: "ハーフタイム・シャッフルでキック、スネア、ハイハットの関係を確認しやすいドラム音色です。",
      target: "drums",
      patch: {
        name: "Shuffle Studio Drums", engine_type: "drum", instrument_model: "studio_drums", drum_style: "half_time_shuffle",
        kick_tune_hz: 54, kick_decay_s: .27, snare_tone_hz: 192, snare_decay_s: .20,
        hat_decay_s: .075, tom_decay_s: .40, drum_brightness: .74, drum_room_mix: .16,
        master_gain: .23, max_polyphony: 16, prompt: ""
      }
    },
    {
      id: "classic_fm_ep", group: "keys", ja: "クラシックFMエレピ", en: "Classic FM EP",
      help: "硬いアタック、透明な倍音、軽いコーラスを持つ80年代系FMエレピの基準音色です。",
      target: "ep",
      patch: {
        name: "Classic FM EP", engine_type: "fm", instrument_model: "dx_ep",
        fm_mod_index: 5.8, fm_brightness: .80, fm_ratio_1: 14, fm_ratio_2: 1,
        fm_decay_s: 2.8, fm_release_s: 1.65, fm_chorus_mix: .18,
        master_gain: .20, max_polyphony: 12, prompt: ""
      }
    }
  ]);

  const state = {
    file: null,
    basePatch: null,
    matchedPatch: null,
    features: null,
    comparing: false,
    language: "ja",
    selectedPresetId: "",
  };

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function targetFromPatch(patch) {
    if (!patch) return "fretless";
    if (patch.instrument_model === "fretless_bass") return "fretless";
    if (patch.instrument_model === "grand_piano") return "piano";
    if (patch.instrument_model === "electric_guitar") return "guitar";
    if (patch.instrument_model === "studio_drums" || patch.engine_type === "drum") return "drums";
    if (patch.instrument_model === "dx_ep" || patch.engine_type === "fm") return "ep";
    return "generic";
  }

  function applyPatch(raw, label, rememberAsBase = false) {
    stopSample({ announce: false });
    const patch = validatePatch(raw);
    generatedPatch = { ...patch };
    engine.setPatch(patch);
    if (rememberAsBase) {
      state.basePatch = { ...engine.patch };
      state.matchedPatch = null;
      state.features = null;
    }
    const status = document.getElementById("status");
    if (status) status.textContent = label;
    return { ...engine.patch };
  }

  function applyPreset(preset) {
    state.selectedPresetId = preset.id;
    const applied = applyPatch(preset.patch, `リアル楽器プリセット「${preset.ja}」を適用しました。`, true);
    const target = document.getElementById("referenceTarget");
    if (target) target.value = preset.target;
    const intent = document.getElementById("timbreIntentPanel");
    if (intent) intent.hidden = true;
    renderPresetButtons();
    updateReferenceButtons();
    return applied;
  }

  function buildPresetPanel() {
    const soundDesign = document.getElementById("soundDesign");
    const promptLabel = soundDesign && soundDesign.querySelector('label[for="prompt"]');
    if (!soundDesign || !promptLabel || document.getElementById("realisticPresetPanel")) return;

    const panel = document.createElement("section");
    panel.id = "realisticPresetPanel";
    panel.className = "realistic-preset-panel";
    panel.innerHTML = `<div class="rp-head"><div><span class="kicker">REALISTIC INSTRUMENT PRESETS · v0.11.0</span><strong>まず実用的な楽器プリセットから選ぶ</strong><small>自然言語で0から作るのではなく、専用PCM/FM音源の調整済みPatchを直接適用します。</small></div><div class="rp-language" role="group" aria-label="プリセット表示言語"><button id="realisticPresetJa" type="button" class="active">日本語</button><button id="realisticPresetEn" type="button">English</button></div></div><div id="realisticPresetGrid" class="realistic-preset-grid"></div>`;
    soundDesign.insertBefore(panel, promptLabel);

    document.getElementById("realisticPresetJa").addEventListener("click", () => { state.language = "ja"; renderPresetButtons(); });
    document.getElementById("realisticPresetEn").addEventListener("click", () => { state.language = "en"; renderPresetButtons(); });
    renderPresetButtons();
  }

  function renderPresetButtons() {
    const grid = document.getElementById("realisticPresetGrid");
    if (!grid) return;
    grid.innerHTML = "";
    for (const preset of REALISTIC_PRESETS) {
      const button = document.createElement("button");
      button.type = "button";
      const selected = state.selectedPresetId === preset.id;
      button.className = `realistic-preset-button${selected ? " selected" : ""}`;
      button.dataset.presetId = preset.id;
      button.setAttribute("aria-pressed", String(selected));
      button.innerHTML = `<strong>${state.language === "ja" ? preset.ja : preset.en}</strong><span>${preset.group.toUpperCase()}</span>`;
      button.title = `${preset.help} クリックすると自然言語生成を介さず、この基準Patchを直接適用します。`;
      button.addEventListener("click", () => applyPreset(preset));
      grid.appendChild(button);
    }
    document.getElementById("realisticPresetJa")?.classList.toggle("active", state.language === "ja");
    document.getElementById("realisticPresetEn")?.classList.toggle("active", state.language === "en");
  }

  function buildReferencePanel() {
    const soundDesign = document.getElementById("soundDesign");
    const promptLabel = soundDesign && soundDesign.querySelector('label[for="prompt"]');
    if (!soundDesign || !promptLabel || document.getElementById("referenceMatchPanel")) return;

    const panel = document.createElement("section");
    panel.id = "referenceMatchPanel";
    panel.className = "reference-match-panel";
    panel.innerHTML = `
      <div class="rm-head"><div><span class="kicker">REFERENCE AUDIO MATCH</span><strong>手元のMP3 / WAVを音色の目標として解析</strong></div><span class="rm-local-badge">LOCAL ONLY</span></div>
      <p class="rm-help">音声はブラウザのメモリ上だけで解析し、アップロード・保存しません。CD等の楽曲は、権利上利用できる手元のファイルを個人的な参照分析に使用してください。ミックス済み楽曲では他の楽器も解析値へ混ざるため、対象楽器が目立つ10〜20秒を指定すると精度が上がります。</p>
      <div class="rm-grid">
        <label class="rm-wide">参照音声<input id="referenceAudioFile" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,.mp3,.wav,.m4a,.aac" /></label>
        <label>対象楽器<select id="referenceTarget"><option value="current">現在の音色から判定</option><option value="fretless">フレットレスベース</option><option value="piano">グランドピアノ</option><option value="guitar">ギター</option><option value="drums">ドラム</option><option value="ep">FMエレピ</option><option value="generic">その他</option></select></label>
        <label>開始位置（秒）<input id="referenceStart" type="number" min="0" step="0.5" value="0" /></label>
        <label>解析時間（秒）<input id="referenceDuration" type="number" min="3" max="30" step="1" value="12" /></label>
        <div class="rm-actions rm-wide"><button id="referenceAnalyzeBtn" type="button" class="primary" disabled>参照音を解析して近づける</button><button id="referenceClearBtn" type="button" disabled>参照音をクリア</button></div>
      </div>
      <p id="referenceFileStatus" class="rm-status">参照音声を選択してください。最大80MB、解析区間は3〜30秒です。</p>
      <div id="referenceFeatureGrid" class="rm-features" hidden></div>
      <section id="referencePatchDiff" class="rm-patch-diff" hidden aria-live="polite"></section>
      <div id="referenceCompareActions" class="rm-compare" hidden><button id="referenceOriginalBtn" type="button">元のプリセット</button><button id="referenceMatchedBtn" type="button" class="primary">Reference Match</button><button id="referenceCompareBtn" type="button">▶ 同じフレーズでA/B比較</button></div>
      <p id="referenceMatchStatus" class="rm-status"></p>`;
    soundDesign.insertBefore(panel, promptLabel);

    document.getElementById("referenceAudioFile").addEventListener("change", onReferenceFileChange);
    document.getElementById("referenceAnalyzeBtn").addEventListener("click", analyzeReferenceFile);
    document.getElementById("referenceClearBtn").addEventListener("click", clearReferenceFile);
    document.getElementById("referenceOriginalBtn").addEventListener("click", () => {
      if (state.basePatch) applyPatch(state.basePatch, "Reference Match前のプリセットへ戻しました。");
      updateReferenceButtons("original");
    });
    document.getElementById("referenceMatchedBtn").addEventListener("click", () => {
      if (state.matchedPatch) applyPatch(state.matchedPatch, "Reference Match音色を適用しました。");
      updateReferenceButtons("matched");
    });
    document.getElementById("referenceCompareBtn").addEventListener("click", compareReferenceAB);
  }

  function onReferenceFileChange(event) {
    const file = event.target.files && event.target.files[0];
    state.file = null;
    state.features = null;
    state.matchedPatch = null;
    const analyze = document.getElementById("referenceAnalyzeBtn");
    const clear = document.getElementById("referenceClearBtn");
    const status = document.getElementById("referenceFileStatus");
    const features = document.getElementById("referenceFeatureGrid");
    const compare = document.getElementById("referenceCompareActions");
    const patchDiff = document.getElementById("referencePatchDiff");
    if (features) features.hidden = true;
    if (compare) compare.hidden = true;
    if (patchDiff) patchDiff.hidden = true;
    if (!file) {
      analyze.disabled = true; clear.disabled = true;
      status.textContent = "参照音声を選択してください。最大80MB、解析区間は3〜30秒です。";
      return;
    }
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext) || file.size > MAX_FILE_BYTES) {
      event.target.value = "";
      analyze.disabled = true; clear.disabled = true;
      status.textContent = file.size > MAX_FILE_BYTES ? "ファイルが80MBを超えています。" : "MP3 / WAV / M4A / AACを選択してください。";
      return;
    }
    state.file = file;
    state.basePatch = { ...currentPatch };
    analyze.disabled = false; clear.disabled = false;
    status.textContent = `${file.name} · ${formatBytes(file.size)} · ローカル解析のみ。元音声は保存・送信しません。`;
  }

  function clearReferenceFile() {
    const input = document.getElementById("referenceAudioFile");
    if (input) input.value = "";
    state.file = null; state.features = null; state.matchedPatch = null;
    document.getElementById("referenceAnalyzeBtn").disabled = true;
    document.getElementById("referenceClearBtn").disabled = true;
    document.getElementById("referenceFeatureGrid").hidden = true;
    document.getElementById("referencePatchDiff").hidden = true;
    document.getElementById("referenceCompareActions").hidden = true;
    document.getElementById("referenceFileStatus").textContent = "参照音声をクリアしました。音声データは保持していません。";
    document.getElementById("referenceMatchStatus").textContent = "";
  }

  function selectedTarget() {
    const value = document.getElementById("referenceTarget")?.value || "current";
    return value === "current" ? targetFromPatch(state.basePatch || currentPatch) : value;
  }

  function reverseBits(value, bits) {
    let result = 0;
    for (let i = 0; i < bits; i++) { result = (result << 1) | (value & 1); value >>= 1; }
    return result;
  }

  function fftPower(samples) {
    const n = samples.length;
    const bits = Math.round(Math.log2(n));
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const j = reverseBits(i, bits);
      re[j] = samples[i];
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, theta = -2 * Math.PI / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0; k < half; k++) {
          const angle = theta * k, wr = Math.cos(angle), wi = Math.sin(angle);
          const even = start + k, odd = even + half;
          const tr = wr * re[odd] - wi * im[odd], ti = wr * im[odd] + wi * re[odd];
          re[odd] = re[even] - tr; im[odd] = im[even] - ti;
          re[even] += tr; im[even] += ti;
        }
      }
    }
    const power = new Float64Array(n >> 1);
    for (let i = 0; i < power.length; i++) power[i] = re[i] * re[i] + im[i] * im[i];
    return power;
  }

  function targetMaxHz(target) {
    if (target === "fretless") return 3200;
    if (target === "piano") return 12000;
    if (target === "guitar") return 10000;
    if (target === "drums") return 16000;
    if (target === "ep") return 10000;
    return 12000;
  }

  function analyzeBuffer(buffer, startSeconds, durationSeconds, target) {
    const sampleRate = buffer.sampleRate;
    const start = Math.floor(clamp(startSeconds, 0, Math.max(0, buffer.duration - .01)) * sampleRate);
    const duration = clamp(durationSeconds, MIN_ANALYSIS_SECONDS, Math.min(MAX_ANALYSIS_SECONDS, Math.max(MIN_ANALYSIS_SECONDS, buffer.duration - start / sampleRate)));
    const end = Math.min(buffer.length, start + Math.floor(duration * sampleRate));
    const available = end - start;
    if (available < FFT_SIZE) throw new Error("解析区間が短すぎます。3秒以上の区間を指定してください。");

    const channels = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) channels.push(buffer.getChannelData(ch));
    const frames = Math.max(6, Math.min(MAX_FRAMES, Math.floor(available / FFT_SIZE)));
    const maxHz = Math.min(sampleRate / 2, targetMaxHz(target));
    const nyquistBin = Math.min(FFT_SIZE >> 1, Math.floor(maxHz * FFT_SIZE / sampleRate));
    let sumRms = 0, sumPeak = 0, sumZcr = 0, sumCentroid = 0, sumFlatness = 0, sumFlux = 0;
    let lowEnergy = 0, lowMidEnergy = 0, midEnergy = 0, highEnergy = 0, airEnergy = 0, totalEnergy = 0;
    const rmsValues = [];
    let previousPower = null;

    for (let frameIndex = 0; frameIndex < frames; frameIndex++) {
      const maxOffset = Math.max(0, available - FFT_SIZE);
      const offset = start + Math.floor((frameIndex / Math.max(1, frames - 1)) * maxOffset);
      const samples = new Float64Array(FFT_SIZE);
      let square = 0, peak = 0, zcr = 0, previousSample = 0;
      for (let i = 0; i < FFT_SIZE; i++) {
        let sample = 0;
        for (const channel of channels) sample += channel[offset + i] || 0;
        sample /= channels.length;
        const window = .5 - .5 * Math.cos(2 * Math.PI * i / (FFT_SIZE - 1));
        samples[i] = sample * window;
        square += sample * sample; peak = Math.max(peak, Math.abs(sample));
        if (i && ((sample >= 0) !== (previousSample >= 0))) zcr++;
        previousSample = sample;
      }
      const rms = Math.sqrt(square / FFT_SIZE);
      rmsValues.push(rms); sumRms += rms; sumPeak += peak; sumZcr += zcr / FFT_SIZE;
      const power = fftPower(samples);
      let frameEnergy = 0, weighted = 0, logSum = 0, arithmetic = 0, bins = 0;
      let frameLow = 0, frameLowMid = 0, frameMid = 0, frameHigh = 0, frameAir = 0;
      for (let bin = 1; bin < nyquistBin; bin++) {
        const hz = bin * sampleRate / FFT_SIZE, p = power[bin] + 1e-18;
        frameEnergy += p; weighted += hz * p; arithmetic += p; logSum += Math.log(p); bins++;
        if (hz < 180) frameLow += p;
        else if (hz < 700) frameLowMid += p;
        else if (hz < 2500) frameMid += p;
        else if (hz < 8000) frameHigh += p;
        else frameAir += p;
      }
      const centroid = frameEnergy > 0 ? weighted / frameEnergy : 0;
      const flatness = bins ? Math.exp(logSum / bins) / Math.max(1e-18, arithmetic / bins) : 0;
      sumCentroid += centroid; sumFlatness += clamp01(flatness);
      lowEnergy += frameLow; lowMidEnergy += frameLowMid; midEnergy += frameMid; highEnergy += frameHigh; airEnergy += frameAir; totalEnergy += frameEnergy;
      if (previousPower) {
        let flux = 0, denom = 0;
        for (let bin = 1; bin < nyquistBin; bin++) {
          const diff = power[bin] - previousPower[bin]; if (diff > 0) flux += diff; denom += previousPower[bin] + 1e-18;
        }
        sumFlux += clamp01(flux / Math.max(1e-18, denom));
      }
      previousPower = power;
    }

    const meanRms = sumRms / frames, meanPeak = sumPeak / frames;
    const variance = rmsValues.reduce((sum, value) => sum + Math.pow(value - meanRms, 2), 0) / frames;
    const dynamics = clamp01(Math.sqrt(variance) / Math.max(.0001, meanRms) * 1.8);
    const centroid = sumCentroid / frames;
    const flatness = sumFlatness / frames;
    const flux = sumFlux / Math.max(1, frames - 1);
    const lowRatio = (lowEnergy + lowMidEnergy) / Math.max(1e-18, totalEnergy);
    const midRatio = (lowMidEnergy + midEnergy) / Math.max(1e-18, totalEnergy);
    const highRatio = (highEnergy + airEnergy) / Math.max(1e-18, totalEnergy);
    const brightness = clamp01((centroid - (target === "fretless" ? 180 : 350)) / (target === "fretless" ? 2200 : 5200));
    const transient = clamp01(flux * 4.2 + dynamics * .25);
    const roughness = clamp01(flatness * .70 + highRatio * .65 + (sumZcr / frames) * 1.4);
    const sustain = clamp01(.78 - transient * .42 - dynamics * .18 + lowRatio * .18);
    const warmth = clamp01(lowRatio * .72 + (1 - brightness) * .32);
    const midPresence = clamp01(midRatio * 1.75);
    const ambience = clamp01(sustain * .48 + (1 - clamp01(meanPeak / Math.max(.0001, meanRms) / 5)) * .28 + (1 - transient) * .20);

    return {
      target, duration,
      brightness, warmth, transient, sustain, roughness, midPresence,
      lowBody: clamp01(lowRatio * 1.25), dynamics, ambience,
      centroidHz: Math.round(centroid), rms: clamp01(meanRms * 4),
    };
  }

  function matchPatch(base, target, f) {
    const p = { ...base };
    p.name = `${String(base.name || "Preset").replace(/ · Reference Match$/, "")} · Reference Match`.slice(0, 80);
    p.prompt = "";
    if (target === "fretless") {
      p.engine_type = "sampler"; p.instrument_model = "fretless_bass";
      p.sample_tone = clamp01(.25 + f.brightness * .72);
      p.sample_attack_mix = clamp01(.34 + f.transient * .58);
      p.finger_noise_mix = clamp01(.30 + Math.max(f.roughness, f.brightness * .55) * .62);
      p.release_noise_mix = clamp01(.10 + f.roughness * .42);
      p.mwah_amount = clamp01(.38 + f.midPresence * .52);
      p.slide_amount = clamp01(mix(Number(base.slide_amount ?? .34), .28 + f.sustain * .42, .38));
      p.sample_velocity_curve = clamp(.82 + f.dynamics * .72, .4, 2.5);
    } else if (target === "piano") {
      p.engine_type = "sampler"; p.instrument_model = "grand_piano";
      p.piano_tone = clamp01(.28 + f.brightness * .68);
      p.piano_hammer_mix = clamp01(.24 + f.transient * .68);
      p.piano_resonance = clamp01(.34 + f.sustain * .58);
      p.piano_softness = clamp01(.62 - f.transient * .48 + f.warmth * .18);
      p.piano_sustain = clamp(.45 + f.sustain * .52, .2, 1);
      p.piano_room_mix = clamp(f.ambience * .34, 0, .5);
    } else if (target === "guitar") {
      p.engine_type = "sampler"; p.instrument_model = "electric_guitar";
      p.guitar_body_tone = clamp01(.28 + f.brightness * .68);
      p.guitar_pick_mix = clamp01(.20 + f.transient * .72);
      p.guitar_release_mix = clamp01(.08 + f.roughness * .30);
      p.guitar_sustain = clamp(.35 + f.sustain * .62, .1, 1);
      p.guitar_amp_tone = clamp01(.30 + f.brightness * .62);
      p.guitar_amp_presence = clamp01(.28 + Math.max(f.brightness, f.midPresence) * .66);
      p.guitar_chorus_mix = clamp(f.ambience * .22, 0, .5);
    } else if (target === "drums") {
      p.engine_type = "drum"; p.instrument_model = "studio_drums";
      p.drum_brightness = clamp01(.25 + f.brightness * .72);
      p.drum_room_mix = clamp(f.ambience * .38, 0, .45);
      p.kick_decay_s = clamp(.14 + f.sustain * .42, .05, 1.2);
      p.snare_decay_s = clamp(.10 + f.sustain * .34, .05, 1);
      p.hat_decay_s = clamp(.04 + f.sustain * .18, .02, .5);
      p.tom_decay_s = clamp(.20 + f.sustain * .48, .08, 1.5);
    } else if (target === "ep") {
      p.engine_type = "fm"; p.instrument_model = "dx_ep";
      p.fm_brightness = clamp01(.28 + f.brightness * .70);
      p.fm_mod_index = clamp(2.4 + f.brightness * 6.8 + f.roughness * 2.2, 0, 18);
      p.fm_decay_s = clamp(.8 + f.sustain * 4.3, .05, 8);
      p.fm_release_s = clamp(.45 + f.sustain * 3.2, .05, 8);
      p.fm_chorus_mix = clamp(f.ambience * .34, 0, .5);
    } else {
      p.engine_type = "synth"; p.instrument_model = "generic";
      p.filter_cutoff_hz = clamp(500 + Math.pow(f.brightness, 1.4) * 13500, 80, 18000);
      p.attack_s = clamp(.004 + (1 - f.transient) * .42, .001, 8);
      p.sustain = clamp01(.20 + f.sustain * .72);
      p.release_s = clamp(.08 + f.sustain * 3.5, .01, 10);
      p.filter_q = clamp(.4 + f.midPresence * 4.5, .1, 18);
    }
    return validatePatch(p);
  }

  function featureRows(features) {
    return [
      ["明るさ", features.brightness], ["暖かさ", features.warmth], ["アタック/Transient", features.transient],
      ["サステイン", features.sustain], ["粗さ/Noise", features.roughness], ["中域の存在感", features.midPresence],
      ["低域Body", features.lowBody], ["ダイナミクス", features.dynamics], ["空間/余韻傾向", features.ambience],
    ];
  }

  function renderFeatures(features) {
    const grid = document.getElementById("referenceFeatureGrid");
    grid.innerHTML = ""; grid.hidden = false;
    for (const [label, value] of featureRows(features)) {
      const item = document.createElement("div"); item.className = "rm-feature";
      item.innerHTML = `<div><span>${label}</span><strong>${Math.round(value * 100)}%</strong></div><div class="rm-feature-bar"><i style="width:${Math.round(value * 100)}%"></i></div>`;
      grid.appendChild(item);
    }
    const meta = document.createElement("div"); meta.className = "rm-feature rm-feature-meta";
    meta.innerHTML = `<div><span>解析情報</span><strong>${features.centroidHz} Hz centroid</strong></div><small>${features.duration.toFixed(1)}秒を解析 · 対象=${features.target}</small>`;
    grid.appendChild(meta);
  }

  const PATCH_LABELS = Object.freeze({
    sample_tone:"明るさ",sample_attack_mix:"アタック",finger_noise_mix:"指ノイズ",release_noise_mix:"リリースノイズ",mwah_amount:"Mwah",slide_amount:"スライド",sample_velocity_curve:"ベロシティカーブ",
    piano_tone:"明るさ",piano_hammer_mix:"ハンマー",piano_resonance:"共鳴",piano_softness:"柔らかさ",piano_sustain:"サステイン",piano_room_mix:"ルーム",
    guitar_body_tone:"ボディ明るさ",guitar_pick_mix:"ピック",guitar_release_mix:"リリース",guitar_sustain:"サステイン",guitar_amp_tone:"アンプトーン",guitar_amp_presence:"プレゼンス",guitar_chorus_mix:"コーラス",
    drum_brightness:"明るさ",drum_room_mix:"ルーム",kick_decay_s:"キック余韻",snare_decay_s:"スネア余韻",hat_decay_s:"ハイハット余韻",tom_decay_s:"タム余韻",
    fm_brightness:"明るさ",fm_mod_index:"倍音量",fm_decay_s:"ディケイ",fm_release_s:"リリース",fm_chorus_mix:"コーラス",
    filter_cutoff_hz:"フィルター周波数",attack_s:"アタック",sustain:"サステイン",release_s:"リリース",filter_q:"レゾナンス"
  });

  function formatPatchValue(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    if (Math.abs(number) >= 100) return number.toFixed(0);
    if (Math.abs(number) >= 10) return number.toFixed(1);
    return number.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }

  function patchDifferences(base, matched) {
    const ignored = new Set(["name", "prompt", "engine_type", "instrument_model"]);
    return Object.keys(matched).filter(key => !ignored.has(key) && Object.prototype.hasOwnProperty.call(base, key)).map(key => {
      const before = base[key], after = matched[key];
      const numeric = Number.isFinite(Number(before)) && Number.isFinite(Number(after));
      const delta = numeric ? Number(after) - Number(before) : 0;
      return {key,label:PATCH_LABELS[key] || key,before,after,numeric,delta};
    }).filter(item => item.numeric ? Math.abs(item.delta) > 0.0005 : item.before !== item.after)
      .sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  function renderPatchDifferences(base, matched) {
    const panel = document.getElementById("referencePatchDiff");
    if (!panel) return;
    const rows = patchDifferences(base, matched);
    panel.hidden = false;
    panel.innerHTML = `<div class="rm-diff-head"><div><span class="kicker">PARAMETER DIFFERENCE</span><strong>元のプリセット → Reference Match</strong></div><span>${rows.length}項目を変更</span></div>`;
    const list = document.createElement("div"); list.className = "rm-diff-list";
    for (const row of rows) {
      const direction = row.delta > 0 ? "up" : row.delta < 0 ? "down" : "same";
      const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
      const delta = row.numeric ? `${row.delta > 0 ? "+" : ""}${formatPatchValue(row.delta)}` : "変更";
      const item = document.createElement("div"); item.className = `rm-diff-row ${direction}`;
      item.title = `${row.key}: ${formatPatchValue(row.before)} から ${formatPatchValue(row.after)} へ変更`;
      item.innerHTML = `<strong>${row.label}</strong><span class="rm-diff-values"><span>${formatPatchValue(row.before)}</span><b>${arrow}</b><span>${formatPatchValue(row.after)}</span></span><em>${delta}</em>`;
      list.appendChild(item);
    }
    if (!rows.length) list.innerHTML = `<p class="rm-status">数値パラメータに差はありません。</p>`;
    panel.appendChild(list);
  }

  async function analyzeReferenceFile() {
    if (!state.file) return;
    const button = document.getElementById("referenceAnalyzeBtn");
    const status = document.getElementById("referenceMatchStatus");
    button.disabled = true; status.textContent = "参照音声をブラウザ内で解析中…";
    try {
      await engine.init();
      let bytes = await state.file.arrayBuffer();
      const buffer = await engine.ctx.decodeAudioData(bytes.slice(0));
      bytes = null;
      const start = Math.max(0, Number(document.getElementById("referenceStart").value) || 0);
      const duration = clamp(Number(document.getElementById("referenceDuration").value) || 12, MIN_ANALYSIS_SECONDS, MAX_ANALYSIS_SECONDS);
      const target = selectedTarget();
      state.basePatch = { ...(state.basePatch || currentPatch) };
      state.features = analyzeBuffer(buffer, start, duration, target);
      state.matchedPatch = matchPatch(state.basePatch, target, state.features);
      renderFeatures(state.features);
      renderPatchDifferences(state.basePatch, state.matchedPatch);
      document.getElementById("referenceCompareActions").hidden = false;
      applyPatch(state.matchedPatch, "Reference Audioの特徴量に近づけたPatchを適用しました。元音声そのものは使用していません。");
      updateReferenceButtons("matched");
      status.textContent = "解析完了。Reference Matchは音声の特徴量だけを使って既存Patchを調整しています。ミックス音源の場合は対象楽器以外の影響も含まれます。";
    } catch (error) {
      status.textContent = `参照音声の解析に失敗しました: ${error.message || error}`;
    } finally {
      button.disabled = !state.file;
    }
  }

  function updateReferenceButtons(active = "") {
    const original = document.getElementById("referenceOriginalBtn"), matched = document.getElementById("referenceMatchedBtn");
    if (original) { const selected = active === "original"; original.classList.toggle("active", selected); original.setAttribute("aria-pressed", String(selected)); }
    if (matched) { const selected = active === "matched"; matched.classList.toggle("active", selected); matched.setAttribute("aria-pressed", String(selected)); }
  }

  function waitForSamplePlayback() {
    return new Promise(resolve => {
      let started = false, elapsed = 0;
      const timer = setInterval(() => {
        elapsed += 120;
        if (samplePlaying) started = true;
        if ((started && !samplePlaying) || elapsed > 32000) { clearInterval(timer); resolve(); }
      }, 120);
    });
  }

  async function compareReferenceAB() {
    if (state.comparing || !state.basePatch || !state.matchedPatch) return;
    state.comparing = true;
    const button = document.getElementById("referenceCompareBtn"), text = button.textContent;
    const phrase = document.getElementById("sampleSelect").value;
    button.disabled = true; button.textContent = "A/B比較中…";
    try {
      for (const [label, patch] of [["Original", state.basePatch], ["Reference Match", state.matchedPatch]]) {
        applyPatch(patch, `Reference A/B比較 · ${label}`);
        const select = document.getElementById("sampleSelect");
        if (Array.from(select.options).some(option => option.value === phrase)) select.value = phrase;
        document.getElementById("samplePlayBtn").click();
        await waitForSamplePlayback();
        await new Promise(resolve => setTimeout(resolve, 280));
      }
      updateReferenceButtons("matched");
      document.getElementById("referenceMatchStatus").textContent = "A/B比較が完了しました。Reference Matchを適用しています。";
    } finally {
      button.disabled = false; button.textContent = text; state.comparing = false;
    }
  }

  function addStyles() {
    if (document.getElementById("referenceMatchStyles")) return;
    const style = document.createElement("style"); style.id = "referenceMatchStyles";
    style.textContent = `
      .realistic-preset-panel,.reference-match-panel{margin:14px 0;padding:15px;border:1px solid #39415f;border-radius:16px;background:#111521}
      .rp-head,.rm-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.rp-head strong,.rm-head strong{display:block;font-size:1.05rem}.rp-head small,.rm-help,.rm-status{color:#9ca6c4}
      .rp-language{display:inline-flex;gap:4px;padding:4px;border:1px solid #343a56;border-radius:12px}.rp-language button.active{border-color:#8e9cff;background:#313a62}
      .realistic-preset-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:12px}.realistic-preset-button{text-align:left;padding:10px 12px;position:relative}.realistic-preset-button strong,.realistic-preset-button span{display:block}.realistic-preset-button span{margin-top:3px;color:#9ca6c4;font-size:.72rem}
      .realistic-preset-button.selected,.rm-compare button.active{border-color:#aab6ff;background:linear-gradient(180deg,#35406c,#272f52);box-shadow:0 0 0 2px rgba(142,156,255,.22),0 7px 18px rgba(64,82,170,.24);transform:translateY(-1px)}
      .realistic-preset-button.selected{padding-top:31px}.realistic-preset-button.selected::after,.rm-compare button.active::after{content:"✓ 選択中";position:absolute;top:7px;right:8px;padding:2px 7px;border-radius:999px;background:#8999ff;color:#101528;font-size:.66rem;font-weight:900;letter-spacing:.02em}
      .rm-compare button{position:relative}.rm-compare button.active{padding-top:25px}
      .rm-local-badge{padding:6px 9px;border:1px solid #49745d;border-radius:999px;color:#9fe1b7;font-size:.72rem;font-weight:800}.rm-help{line-height:1.65}.rm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.rm-grid label{display:grid;gap:5px}.rm-wide{grid-column:1/-1}.rm-grid input,.rm-grid select{min-height:40px;color:#eef1ff;background:#0e1019;border:1px solid #343a56;border-radius:10px;padding:7px 9px}.rm-actions{display:flex;gap:8px;flex-wrap:wrap}.rm-features{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:12px}.rm-feature{padding:9px;border:1px solid #2e354d;border-radius:11px;background:#0d1018}.rm-feature>div:first-child{display:flex;justify-content:space-between;gap:8px}.rm-feature-bar{height:6px;margin-top:7px;border-radius:999px;background:#252c40;overflow:hidden}.rm-feature-bar i{display:block;height:100%;background:linear-gradient(90deg,#667eea,#9f7aea)}.rm-feature-meta small{display:block;color:#9ca6c4;margin-top:7px}.rm-compare{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid #2e354d}
      .rm-patch-diff{margin-top:14px;padding:12px;border:1px solid #3c4668;border-radius:13px;background:#0c101b}.rm-diff-head{display:flex;justify-content:space-between;gap:12px;align-items:end}.rm-diff-head strong{display:block}.rm-diff-head>span{color:#aab6d8;font-size:.78rem}.rm-diff-list{display:grid;gap:6px;margin-top:10px}.rm-diff-row{display:grid;grid-template-columns:minmax(130px,1fr) minmax(170px,1.2fr) 72px;gap:10px;align-items:center;padding:8px 10px;border-radius:9px;background:#141a29}.rm-diff-values{display:grid;grid-template-columns:1fr 24px 1fr;align-items:center;text-align:center;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.rm-diff-values b{font-size:1.15rem}.rm-diff-row em{justify-self:end;font-style:normal;font-weight:800}.rm-diff-row.up b,.rm-diff-row.up em{color:#74d69b}.rm-diff-row.down b,.rm-diff-row.down em{color:#ff9b9b}
      @media(max-width:760px){.rp-head,.rm-head,.rm-diff-head{flex-direction:column;align-items:flex-start}.rm-grid{grid-template-columns:1fr}.rm-wide{grid-column:1}.rm-actions,.rm-compare{display:grid;grid-template-columns:1fr}.rp-language{align-self:stretch;justify-content:center}.rm-diff-row{grid-template-columns:1fr auto}.rm-diff-values{grid-column:1/-1;grid-row:2}.rm-diff-row em{grid-column:2;grid-row:1}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    if (typeof validatePatch !== "function" || typeof engine === "undefined" || !document.getElementById("soundDesign")) { setTimeout(install, 30); return; }
    addStyles(); buildPresetPanel(); buildReferencePanel();
    const promptLabel = document.querySelector('#soundDesign label[for="prompt"]');
    if (promptLabel) promptLabel.textContent = "任意: 自然言語で音色を選択／微調整";
    const eyebrow = document.querySelector("header .eyebrow");
    if (eyebrow) eyebrow.textContent = "v0.11.0 audio · Preset-first · Local Reference Match";
    window.referenceAudioMatch = {
      presets: REALISTIC_PRESETS.map(item => ({ id: item.id, ja: item.ja, en: item.en, target: item.target })),
      analyzeBuffer, matchPatch, patchDifferences, applyPresetById(id) { const preset = REALISTIC_PRESETS.find(item => item.id === id); if (preset) return applyPreset(preset); return null; },
      getFeatures() { return state.features ? { ...state.features } : null; },
    };
  }

  install();
})();
