# Natural Language Software Synth

自然言語で楽器・音色・雰囲気を指定すると、ローカルで安全なPatchデータへ変換してその場で演奏できるソフトウェア音源です。鍵盤／PCキーボード／Web MIDI／Sample Performance／鼻歌メロディー／Windows VST3 Instrumentに対応しています。

v0.10.0では、自然言語を直接DSP値へ変換する方式から、いったん **Timbre Intent（音色設計書）** へ変換し、その解釈を確認・修正してからA/B/Cの音色候補へ変換する方式へ進化しました。

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
- 将来LLM Parserを追加する場合も、同じTimbre Intent SchemaへJSONデータを出力し、既存validator以降のDSP経路を共通化する設計。
- Native VST3 HostのC++は変更していないため、v0.10.0への更新後に `build_vst3_host.cmd` を再実行する必要はありません。

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

### 使い方

1. Step 1で、例えば次のように文章を入力します。

```text
木質で太いベース。指で弾いたようなアタック。
暗くて、余韻は短く、空間感は少ない。
```

2. 「音色を生成」を押すとTimbre Intentパネルが表示されます。
3. `Role: bass`、`木質`、`明るさ`、`Attack速度`、`音の長さ`など、解析結果を確認します。
4. 解釈が違う場合はIntentスライダーを修正します。
5. A/B/Cの候補を選びます。
6. Step 3のBass向けSample Performanceで確認します。
7. 必要なら差分指示へ `もっと暗く。余韻だけ少し長く。` などと入力します。

### A / B / C の考え方

- **A Balanced**: 自然言語の解釈を素直に反映する基準候補。
- **B Organic**: PCM Bodyや自然な質感を少し強める候補。
- **C Experimental**: 倍音数、Morph、広がりなどを強めた候補。

3候補とも同じRoleとIntentを共有するため、別の楽器へ無関係に飛ぶのではなく、同じイメージの中で音色設計の方向性だけを変えます。

### 差分指示

v0.10.0では、生成後に設計書全体を作り直すのではなく、指定されたIntent軸だけを変更できます。

```text
もっと暗く
木質を強く
余韻を短く
広がりを少し増やす
```

未指定の軸は維持されるため、気に入った音色の特徴を残したまま段階的に調整できます。

## v0.9.2 の主な変更

- PCM Spectral Resynthesis音色の役割に応じてSample Performance候補を自動切替。
- Bassは低音グルーヴ、低音オクターブ、ウォーキング、ロングトーンを追加し、最低MIDI 28付近まで利用。
- Pad / Atmosphereはロングコード、オープン5度、アンビエント・スウェルを追加。
- Keys / Organは鍵盤コード、アルペジオ、オルガン・サステインを追加。
- Lead / Brassはリード・メロディ、フュージョン・ソロ、ブラス・スタブを追加。
- Pluck / Bellはプラック・アルペジオ、ベル単音余韻、マレット・オスティナートを追加。
- Strings / Voiceはストリングス・レガート、クワイア・ロングコード、ピチカートを追加。
- SOUND DESIGNグループ選択を優先し、自由入力ではPrompt + Patchから評価カテゴリを推定。
- Grand Piano / Electric Guitar / Fretless Bass / Drums / DX EPの既存専用フレーズとユーザー登録フレーズを維持。

## v0.9.1 の主な変更

- Step 1 SOUND DESIGNを固定11音色から **7グループ・45音色** のカテゴリ選択／検索可能ライブラリへ拡張。
- グループ: 実楽器 / PCM、Pad / Atmosphere、Keys / Organ、Lead / Brass、Pluck / Bell、Bass、Strings / Voice。
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
- PCキーボード録音／鼻歌録音を2タブで切替。
- 録音UIの統合ではAudioContextやVST3の新しい経路を追加しない。

## v0.8.0 の主な変更

- VST3再ロード後のPCキーボードフォーカス復旧を改善。
- 同じロード済みVST3インスタンスのネイティブEditor Windowを表示可能にした。
- VST3 Program/Preset相当パラメータの切替UIを追加。
- VST3サンプル演奏とオンスクリーン鍵盤の発音表示を同期。
- 鍵盤UIの立体表示、音名、PCキーラベルを改善。
- PCキーボード演奏を最大120秒／512ノートのNote Eventとして録音し、ピアノロール表示・再生・クリアに対応。
- String Ensemble / Synth Brass / Airy Choir Pad / Retro Polysynth / Resonant Acid Bass / Analog Synth Keysを追加。

## v0.7.0 の主な変更

- 鼻歌のキー／スケール自動推定と補正。
- BPM 60〜180と1/8・1/16・1/32からタイミングを自動推定／クォンタイズ。
- 補正済みメロディーのSVG五線譜表示。
- Windows Native VST3 Hostを追加。
- VST3検索、ロード、Note On/Off、Velocity、Parameter列挙／変更に対応。
- ブラウザは`.vst3`を直接ロードせず、Python loopback serverから別プロセスNative Hostへ接続。
- GitHub ActionsでWindows Native VST3 Hostを実ビルド。

## v0.6.0 の主な変更

- 鼻歌／口笛からMIDIライクな単音メロディーを取得。
- YIN系ピッチ検出、75〜1000Hz、Confidenceしきい値を追加。
- 最大120秒／512ノート。
- マイクの生音声は録音・保存・アップロードしない。
- 鼻歌結果をCustom Phraseへ取り込み可能。

## v0.5.0 の主な変更

- Factory PCM Grand Pianoを追加。
- Hammer / Damper / Resonance / Tone / Softness / Room等を追加。
- Grand Piano専用Sample Performanceを追加。
- FretlessのFinger Noiseを改善。
- ギター和音を16〜28msずらすDown/Up Strokeを追加。
- ユーザー独自Sample Performanceの登録／削除とlocalStorage保存を追加。
- Pop / EDM / Ambient / Funk / Fusion / City Pop / Classical / Boogie / Blues / Bossa Nova等を拡充。

## v0.4.2 の主な変更

- 楽器別のbounded Velocity Trimと穏やかなDynamicsCompressorで聴感上の音量差を緩和。
- Master Gain上限を維持し、Make-up Gainは追加しない。
- FM EP / GuitarのJazzコードを4度堆積へ統一。

## v0.4.1 の主な変更

- 非ギターPatchがギターへ誤判定される問題を修正。
- サンプル演奏の判定を明示的instrument_model中心へ統一。
- Fretless / FM EP / Drum / Guitar / Synthに楽器別Jazz Sample Performanceを追加。
- Drum PatchのドラムUIとPCキーマップを固定。

## v0.4.0 の主な変更

- Factory PCM Electric GuitarとAmp処理を追加。
- Clean / Crunch / High Gain / Acoustic Amp Model。
- Pick Attack / Release Noise / Palm Mute / Sustain / Body Tone、Drive / Presence / Cabinet / Chorusを追加。
- Rock / Fusion / Acoustic Sample Performanceを追加。

## v0.3.0 の主な変更

- `synth / sampler / drum / fm` の4エンジンへ拡張。
- PCM Fretless Bass、PCM Drum、DX-style FM EPを追加。
- グラフィカルPatch Editorを追加。
- Factory PCMはブラウザ内で決定論的に生成。

## v0.2.0 の主な変更

- Studio Drum Kitを追加。
- Kick / Snare / Hat / Toms / Crash / Rideに対応。
- Half-time ShuffleとStraight Sample Performanceを追加。
- Drum Patchでは鍵盤をドラムパッドへ切替。

## v0.1.1 の主な変更

- 現在のPatchを使うSample Performanceを追加。
- Melody / Chords / Basslineと停止操作を追加。

## v0.1.0 の主な変更

- 自然言語からvalidated/clamped Patchを生成するMVP。
- Web Audio Polyphonic Synth。
- オンスクリーン鍵盤、PCキーボード、Optional Web MIDI。
- Patch JSON保存／読込。
- Harness / Blueprint / Stable Note Event Contractを導入。

# 現在の音源モデル

| 要求する音 | Engine / Model | 主な特徴 |
| --- | --- | --- |
| Pad / Lead / Bell / Pluck / Strings / Brass / Choir / Bass / Keys | `sampler / spectral_resynth` | Factory PCM倍音解析 + PeriodicWave + PCM Body/Transient + Morph |
| 一般的なSubtractive Synth | `synth / generic` | 2 Oscillator + Filter + ADSR + LFO + Delay |
| フレットレスベース | `sampler / fretless_bass` | PCM + Finger/Release/Slide Noise + Mwah |
| エレキギター | `sampler / electric_guitar` | PCM + Pick/Release + Amp Drive + Cabinet + Chorus |
| グランドピアノ | `sampler / grand_piano` | PCM + Hammer + Damper + Resonance + Room |
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

ブラウザ:

```text
http://127.0.0.1:8765
```

VST3も利用する場合だけ、初回に次を実行します。

```bat
build_vst3_host.cmd
```

## 2回目以降

```bat
cd C:\temp\natural-language-software-synth
git checkout main
git pull
check_harness.cmd
start_synth.cmd
```

Native VST3 HostのC++が変更されたバージョンのみ `build_vst3_host.cmd` を再実行します。v0.10.0ではNative C++変更はありません。

# VST3 Instrument

Windows標準VST3パスと、任意の `NLSS_VST3_PATHS` を検索できます。ネイティブホストexeを別の場所に置く場合は `NLSS_VST3_HOST` を設定できます。

利用手順:

1. Step 2で「VST3を検索」
2. プラグインを選択
3. 「ロード」
4. 必要なら「VST3本体画面を開く」
5. Parameter / Program / Presetを調整
6. VST3ルーティングをON

対応範囲:

- VST3 Instrument検索／ロード／解除
- Note On / Note Off / Velocity / whenSeconds
- Parameter列挙と0〜1正規化値変更
- Windows標準音声出力
- Program/Preset相当Parameter
- 同じプラグインインスタンスのNative Editor Window
- 診断／Native音声出力テスト

# RECORDING STUDIO

## PCキーボード録音

- 最大120秒
- 最大512ノート
- 音声ではなくNote Eventを保存
- ピアノロール表示
- 再生／クリア
- VST3ルーティングON時も同じNote Event経路を利用

## 鼻歌 → メロディー

- マイク生音声は保存しない
- ブラウザ内YIN系単音解析
- Major / Natural Minor自動推定
- スケール外音を近傍音へ補正
- BPM / 1/8 / 1/16 / 1/32自動クォンタイズ
- SVG五線譜
- Custom Phraseへ転送可能

# Sample Performanceと自作フレーズ

自作フレーズは次の形式です。

```text
C4,E4,G4 | 1 | 0.84
A4        | 0.5 | 0.80
R         | 0.5 | 0.80
67,71,74  | 1 | 0.88
```

- BPM: 40〜240
- 1ステップ: 0.125〜8拍
- Velocity: 0.05〜1.0
- MIDI: 0〜127
- 最大50フレーズ
- 1フレーズ最大128ステップ
- 保存先: browser `localStorage` のみ

# 安全設計とガードレール

- 自然言語、Timbre Intent、鼻歌結果、ユーザーフレーズをコードとして実行しない
- `eval()` / `new Function()` / generated executable codeを使用しない
- 生成／編集／ImportされたPatchをvalidatorでClamp
- Timbre Intentの値を0〜1中心のboundedデータとして扱う
- Timbre Intent Engineは追加AudioContextを作らない
- Timbre Intent Engineは外部URLから音色、Preset、Sampleを取得しない
- v0.10.0のLocal Intent Parserは外部LLM資格情報を必要としない
- Factory PCMは第三者アーティスト録音を埋め込まない
- PCM Spectral ResynthesisはローカルFactory PCMのみを参照
- マイク生音声を録音／保存／アップロードしない
- Master Gain / Polyphony / PCM / Guitar / Piano / Drum / FM / Resynthesis値をClamp
- VST3をブラウザプロセスへロードしない
- VST3はスキャン済みローカルIDからのみロード
- VST3 Note / Velocity / Parameter値もBound
- VST3 Bridgeは `127.0.0.1` の既存ローカルサーバー経由のみ

# 開発時の確認

```bat
python -m pytest tests/
python scripts/harness_check.py
```

または:

```bat
check_harness.cmd
```

VST3ネイティブ側を変更した場合だけ:

```bat
build_vst3_host.cmd
```

GitHub ActionsではPython pytest/HarnessとWindows Native VST3 Host buildの両方を確認します。

# 今後の方向性

v0.10.0でTimbre Intent中間層を導入したため、今後は自然言語Parserと音源DSPを独立して改善できます。

- Optional LLM Parser: 自然言語から同じTimbre Intent JSON Schemaのみを生成し、DSPコードは生成しない
- Bowed String / Brass / Voice-Formant / Mallet / Reed / Metal / Air / Percussive TransientなどのPCM／モデル参照元追加
- Attack / Early Body / Sustain / Releaseごとの時間変化スペクトル
- A/B/Cからユーザーが選んだ候補を次回Candidate Generatorへフィードバックするローカル評価データ
- 強弱／否定／比較表現のParser精度向上
- VST3 Preset / State保存
- 複数VST3 Instrument / Effect Chain
- MusicXML / Standard MIDI File Export
- ピアノロール／ステップシーケンサー
