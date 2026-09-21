# Natural Language Software Synth

自然言語で楽器・音色・雰囲気を指定すると、ローカルで安全なPatchデータへ変換してその場で演奏できるソフトウェア音源です。鍵盤／PCキーボード／Web MIDI／Sample Performance／鼻歌メロディー／Windows VST3 Instrumentに対応しています。

v0.10.1では、v0.10.0のTimbre Intentに加えて、PCM Spectral Resynthesisを **PCM Multi-sampleを発音主体として残すHybrid Resynthesis** へ改善し、ライブ鍵盤のオクターブ切替とDrum PadのPCキーボード操作も追加しました。

## v0.10.1 の主な変更

- PCM Spectral ResynthesisのPiano/Guitar参照元を固定1音から、演奏ノートに最も近い **Multi-sample root** へ変更。
- Fretlessも利用可能なPCM regionから演奏ノートに近いrootを選択。
- PCMを単なる倍音解析の教師データだけにせず、**長いPCM Bodyを実際の発音成分として残す**よう変更。
- `PCM Body` が大きいほどPeriodicWave由来のSpectral成分を少し抑え、PCM本体を前に出すHybrid構成に変更。
- PCM Bodyの再生長を従来の短い補助レイヤーから約1.15〜5.5秒の範囲へ拡大し、アタックだけでなく音の胴鳴り・減衰も利用。
- Spectral解析も音域ごとの最寄りPCM rootを使うため、低音／中音／高音で同一の固定スペクトルを使い回しにくくした。
- `spectral_resynth` 内部で `octave_shift` を暗黙適用する方式を停止。実際のMIDIノート番号と発音ピッチを一致させた。
- ライブ鍵盤へ **自動 / -2 / -1 / 0 / +1 / +2 Oct** の演奏音域切替を追加。
- 自動モードではBass / Fretless系を **-1 Oct** にし、低音楽器を自然な音域でPCキーボード／画面鍵盤から試奏可能。
- オクターブ変更は入力MIDIノート自体を変えるため、PCキーボード録音のピアノロール表示と実際の発音音域が一致。
- 従来の `A/W/S/E/D...` PCキーボード演奏はそのまま維持。
- Drum PatchではSample Performance中だけでなく、通常のライブ試奏時も **Drum Padを演奏面として表示**。
- Drum Padは従来どおりマウス操作可能で、さらに **A=Kick / S=Snare / D=Closed Hat / F=Open Hat / G/H/J=Toms / K=Crash / L=Ride** で操作可能。
- PCキーでDrumを鳴らしたとき、対応Padを視覚的にActive表示。
- 追加AudioContext、外部Sample取得、動的コード実行は導入していない。
- Native VST3 HostのC++は変更していないため、v0.10.1への更新後に `build_vst3_host.cmd` の再実行は不要。

### PCM Multi-sample Hybrid Resynthesis の考え方

v0.9.0〜v0.10.0では、Factory PCMを主に倍音解析し、Web Audio `PeriodicWave` が発音の中心でした。v0.10.1ではPCMそのものをより長く残します。

```text
自然言語 / Timbre Intent
        ↓
Source A / Source B
        ↓
演奏ノートに最も近いPCM rootを選択
  ├─ Piano Multi-sample
  ├─ Guitar Multi-sample
  └─ Fretless PCM region
        ↓
PCM Body（長め） + PCM Transient
        ＋
音域別PCMから抽出したSpectral PeriodicWave
        ↓
Morph / Brightness / Noise / ADSR / Delay
        ↓
既存 noteOn / noteOff
```

この方式は、シンクラビア／フェアライト時代の「サンプル／波形を素材として変形・再構成する」という方向を、現在のWeb Audio上で安全に発展させる第一段階です。なお、現在のFactory PCMはアプリ内で決定論的に生成したPCMであり、商用サンプルライブラリの録音は同梱していません。本物の楽器にさらに近づける次段階として、ライセンスが明確なMulti-sample WAV/SFZやユーザー自身の録音を読み込み、同じResynthesis経路へ入れる方式が有力です。

### ライブ鍵盤の音域

Step 3の鍵盤に「演奏音域」を追加しました。

- **自動**: Bass / Fretlessは-1 Oct、その他は0 Oct
- **-2 / -1 / 0 / +1 / +2 Oct**: 手動指定

例えばBassで自動を選ぶと、PCキー `A` から始まる鍵盤自体が1オクターブ下へ移り、画面の音名、録音ピアノロール、実際の発音が同じMIDI音域になります。

## v0.10.0 の主な変更

- 自然言語とDSPの間に **Timbre Intent** 中間層を追加。
- 入力文を、Role / Material / Envelope / Spectrum / Texture / Space / Performance Registerの構造化された音色設計書へ変換。
- Step 1 SOUND DESIGN内に **「自然言語をどう解釈したか」** を表示するパネルを追加。
- 明るさ、暖かさ、木質、金属/ガラス、Air/息、有機感、Attack速度、音の長さ、硬さ、粗さ、太さ、パーカッシブ感、広がり、空間/残響を0〜100%で表示・手動調整可能。
- `かなり / とても / very`、`少し / やや / slightly` の強弱表現と、`ではない / じゃない / not / without` などの否定表現をローカルParserで考慮。
- 1回の自然言語指定から **A: Balanced / B: Organic / C: Experimental** の3候補を生成。
- A/B/Cは単なる名前違いではなく、PCM Body、倍音数、Brightness、Transient、Noise、Detune、ADSR、Delayなどの実際のPatch値を変更。
- PCM Spectral Resynthesisだけでなく、Subtractive Synth / Fretless / Electric Guitar / Grand Piano / FM EP / Drumsでも、利用可能な既存パラメータ範囲内でIntentを反映。
- 候補ボタンを切り替えても、v0.9.2で追加した音色グループ別Sample Performanceの選択を維持。
- **「同じフレーズでA/B/C比較」** を追加し、同じ演奏タイプで3候補を順番に試聴可能。
- **「もっと暗く」「余韻を短く」「木質を強く」** などの差分指示を追加。指定された軸だけを変更し、その他のIntentは維持。
- Intentスライダーを直接変更した場合もA/B/C候補を再計算。
- 生成Patchは従来どおり既存 `validatePatch()` を通してClamp。
- 自然言語をJavaScript/DSPコードとして実行せず、`eval()` / `new Function()` / generated executable codeは使用しない。
- Timbre Intent Engineは追加AudioContext、MediaRecorder、WebAssembly、外部音色サンプル取得を行わない。
- 音色生成時の通信は従来の同一オリジン `/api/generate-patch` のみで、外部LLMや外部AIサービスはv0.10.0では必須にしない。

### Timbre Intent の流れ

```text
自然言語
   ↓
Local Timbre Intent Parser
   ↓
Timbre Intent / 音色設計書
   ├─ Role
   ├─ Material: Wood / Metal / Air / Organic
   ├─ Envelope: Attack / Length
   ├─ Spectrum: Brightness / Warmth / Harmonic Density
   ├─ Texture: Hardness / Roughness / Thickness / Percussive
   └─ Space: Width / Room / Distance
   ↓
A / B / C Candidate Generator
   ↓
既存Patch validator / Clamp
   ↓
PCM Resynthesis / Synth / Sampler / FM / Drum
   ↓
音色カテゴリに合ったSample Performanceで比較
```

### v0.10.0 の使い方

1. Step 1で自然言語を入力します。
2. 「音色を生成」を押すとTimbre Intentパネルが表示されます。
3. Role、木質、明るさ、Attack速度、音の長さなどの解析結果を確認します。
4. 解釈が違う場合はIntentスライダーを修正します。
5. A/B/Cの候補を選びます。
6. Step 3のRole別Sample Performanceで確認します。
7. 必要なら `もっと暗く。余韻だけ少し長く。` のような差分指示を使います。

## v0.9.2 の主な変更

- PCM Spectral Resynthesis音色の役割に応じてSample Performance候補を自動切替。
- Bassは低音グルーヴ、低音オクターブ、ウォーキング、ロングトーンを追加し、最低MIDI 28付近まで利用。
- Pad / Atmosphere、Keys / Organ、Lead / Brass、Pluck / Bell、Strings / Voiceにも用途別評価フレーズを追加。
- SOUND DESIGNグループ選択を優先し、自由入力ではPrompt + Patchから評価カテゴリを推定。
- Grand Piano / Electric Guitar / Fretless Bass / Drums / DX EPの既存専用フレーズとユーザー登録フレーズを維持。

## v0.9.1 の主な変更

- Step 1 SOUND DESIGNを固定11音色から **7グループ・45音色** のカテゴリ選択／検索可能ライブラリへ拡張。
- 自由入力を明暗、暖冷、硬軟、Attack、長さ、空間、広がり、Air/Noise、Metal/Wood、Organic/Digital、Rough/Clean、Thickness等の意味軸へ分解。
- Bell + Padなど複数カテゴリを含む文章で副カテゴリ特性も保持。
- 「ピアノのようなPad」「ギター弦を混ぜたBell」では実楽器名をPCM参照元のヒントとして扱うよう改善。
- 明示的Grand Piano / Electric Guitar / Fretless / Drum / DX EPは専用音源を優先。

## v0.9.0 の主な変更

- **PCM Spectral Resynthesis** を追加。
- Factory Piano / Guitar / Fretless PCMの倍音構造をローカル解析してWeb Audio `PeriodicWave`へ再構築。
- Source A/B、Morph、Harmonics、Brightness、PCM Body、Transient、Detune、Air/Noise、ADSRを追加。
- Pad / Strings / Brass / Choir / Bell / Pluck / Lead / Bass / Organ / KeysをPCM再合成へ拡張。
- 第三者Preset／録音やランタイム外部取得を使わず、既存Factory PCMのみを参照。

## v0.8.1 の主な変更

- UIを「1. 音色を作る → 2. 音源を選ぶ → 3. 演奏・試聴 → 4. 録音する」の操作順へ整理。
- Sample Performanceとライブ鍵盤／ドラムを「演奏・試聴」へ集約。
- PCキーボード演奏録音と鼻歌録音を **RECORDING STUDIO** に統合。

## v0.8.0 の主な変更

- VST3再ロード後のPCキーボードフォーカス復旧を改善。
- 同じロード済みVST3インスタンスのネイティブEditor Windowを表示可能にした。
- VST3 Program/Preset相当パラメータの切替UIを追加。
- VST3サンプル演奏とオンスクリーン鍵盤の発音表示を同期。
- PCキーボード演奏を最大120秒／512ノートのNote Eventとして録音し、ピアノロール表示・再生・クリアに対応。

## v0.7.0 の主な変更

- 鼻歌のキー／スケール自動推定と補正、BPM／クォンタイズ、SVG五線譜。
- Windows Native VST3 Hostを追加。
- VST3検索、ロード、Note On/Off、Velocity、Parameter列挙／変更に対応。

## v0.6.0 の主な変更

- 鼻歌／口笛からMIDIライクな単音メロディーを取得。
- YIN系ピッチ検出、最大120秒／512ノート。
- マイクの生音声は録音・保存・アップロードしない。

## v0.5.0 の主な変更

- Factory PCM Grand Pianoを追加。
- Fretless Finger Noise改善、ギターストローク、ユーザー独自Sample Performance、ジャンル拡張。

## v0.4.2 の主な変更

- 楽器別Velocity TrimとDynamicsCompressorで聴感音量差を緩和。
- FM EP / GuitarのJazzコードを4度堆積へ統一。

## v0.4.1 の主な変更

- 非ギターPatchの誤判定修正。
- 楽器別Jazz Sample Performance。
- Drum PatchのドラムUIとPCキーマップを固定。

## v0.4.0 の主な変更

- Factory PCM Electric GuitarとAmp処理を追加。
- Clean / Crunch / High Gain / Acoustic、Pick / Release / Palm Mute / Cabinet / Chorus。

## v0.3.0 の主な変更

- `synth / sampler / drum / fm` の4エンジンへ拡張。
- PCM Fretless Bass、PCM Drum、DX-style FM EP、Patch Editorを追加。

## v0.2.0 の主な変更

- Studio Drum Kit、Half-time Shuffle / Straight Sample Performance。

## v0.1.1 の主な変更

- 現在のPatchを使うSample Performanceを追加。

## v0.1.0 の主な変更

- 自然言語からvalidated/clamped Patchを生成するMVP。
- Web Audio Polyphonic Synth、オンスクリーン鍵盤、PCキーボード、Optional Web MIDI。
- Patch JSON保存／読込、Harness / Blueprint / Stable Note Event Contract。

# 現在の音源モデル

| 要求する音 | Engine / Model | 主な特徴 |
| --- | --- | --- |
| Pad / Lead / Bell / Pluck / Strings / Brass / Choir / Bass / Keys | `sampler / spectral_resynth` | **最寄りFactory Multi-sample PCM Body + 音域別PeriodicWave + Transient + Morph** |
| 一般的なSubtractive Synth | `synth / generic` | 2 Oscillator + Filter + ADSR + LFO + Delay |
| フレットレスベース | `sampler / fretless_bass` | PCM + Finger/Release/Slide Noise + Mwah |
| エレキギター | `sampler / electric_guitar` | PCM Multi-sample + Pick/Release + Amp + Cabinet + Chorus |
| グランドピアノ | `sampler / grand_piano` | PCM Multi-sample + Hammer + Damper + Resonance + Room |
| 生ドラム系 | `drum / studio_drums` | PCM one-shot + Velocity + Tune / Decay / Room |
| DX系エレピ | `fm / dx_ep` | FM Modulation + Ratio + Chorus |
| 外部音源 | Windows VST3 Instrument | Native VST3 Host経由 |

全内蔵音源とVST3ルーティングは最終的に次のNote Event契約を共有します。

```text
setPatch(validatedPatch)
noteOn(midiNote, velocity, whenSeconds=0)
noteOff(midiNote, whenSeconds=0)
```

# Windowsでの起動

## 初回

```bat
cd C:\temp
git clone https://github.com/hnamaizawa/natural-language-software-synth.git
cd natural-language-software-synth
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```

ブラウザ: `http://127.0.0.1:8765`

VST3も利用する場合だけ初回に `build_vst3_host.cmd` を実行します。

## 2回目以降

```bat
cd C:\temp\natural-language-software-synth
git checkout main
git pull
check_harness.cmd
start_synth.cmd
```

Native VST3 HostのC++が変更されたバージョンのみ `build_vst3_host.cmd` を再実行します。v0.10.1ではNative C++変更はありません。

# VST3 Instrument

Step 2でVST3検索／ロード／Editor／Parameter／Program/Preset／ルーティング／診断を利用できます。VST3はブラウザへ直接ロードせず、別プロセスNative Hostを既存loopback server経由で利用します。

# RECORDING STUDIO

## PCキーボード録音

- 最大120秒 / 512ノート
- 音声ではなくNote Eventを保存
- ライブ鍵盤のオクターブ指定後の**実MIDIノート**を記録
- ピアノロール表示 / 再生 / クリア
- VST3ルーティングON時も同じNote Event経路

## 鼻歌 → メロディー

- マイク生音声は保存しない
- ブラウザ内YIN系単音解析
- Key/Scale補正、BPM / Quantize、SVG五線譜、Custom Phrase転送

# Sample Performanceと自作フレーズ

自作フレーズは `音名/MIDI | 拍数 | Velocity` 形式で、BPM 40〜240、最大128ステップ、最大50フレーズをbrowser `localStorage`へ保存します。

# 安全設計とガードレール

- 自然言語、Timbre Intent、鼻歌結果、ユーザーフレーズをコードとして実行しない
- `eval()` / `new Function()` / generated executable codeを使用しない
- 生成／編集／ImportされたPatchをvalidatorでClamp
- 単一AudioContextと既存 `noteOn / noteOff` 契約を維持
- v0.10.1のPCM Body強化もローカルFactory PCMのみ利用し、ネットワークからSampleを取得しない
- マイク生音声を録音／保存／アップロードしない
- Master Gain / Polyphony / PCM / Guitar / Piano / Drum / FM / Resynthesis値をClamp
- VST3をブラウザプロセスへロードしない
- VST3はスキャン済みローカルIDからのみロード

# 開発時の確認

```bat
python -m pytest tests/
python scripts/harness_check.py
```

または `check_harness.cmd`。VST3ネイティブ側を変更した場合のみ `build_vst3_host.cmd`。

# 今後の方向性

PCM Multi-sample Hybrid Resynthesisをさらに本物の楽器へ近づけるには、次の順が有効です。

- ライセンスが明確な **Multi-sample WAV / SFZ**、またはユーザー自身の録音をローカルImport
- Velocity Layer / Round Robin / Key Range / Release Sample対応
- Attack / Early Body / Sustain / Releaseごとの時間変化スペクトル
- Phase / Formantを保ったSpectral Morph、Granular / WSOLA系の時間伸縮
- Bowed String / Brass / Voice / Reed / Mallet / Metal / Air等の参照素材拡張
- Optional LLM ParserはTimbre Intent JSONだけを生成し、DSPコードは生成しない
- A/B/Cのユーザー選択をローカル評価データとしてCandidate Generatorへ反映
- VST3 Preset / State保存、複数VST3 / Effect Chain
- MusicXML / Standard MIDI File Export、ピアノロール／ステップシーケンサー
