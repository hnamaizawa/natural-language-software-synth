# Natural Language Software Synth

自然言語で楽器・音色・雰囲気を指定すると音源方式まで選択してPatchを生成し、その場で演奏できるローカル実行型ソフトウェア音源です。鍵盤／PCキーボード／Web MIDI／サンプル演奏に加え、鼻歌からMIDIライクなメロディーを作成できます。v0.8.1では機能を操作目的に沿って整理し、v0.9.0では抽象的な音色指定が似た電子音へ収束しやすかった問題を改善する **PCM Spectral Resynthesis** を追加しました。

## v0.9.0 の主な変更

- 自然言語で指定した Pad / Strings / Brass / Choir / Bell / Pluck / Lead / Bass / Organ / Keys などを、従来の2 Oscillator中心の似た減算合成へ集約せず、**PCMスペクトル再合成**へ振り分けるよう変更。
- 既存の **Factory Piano / Guitar / Fretless PCM** を再生素材としてだけでなく、音色の倍音構造を学習するローカルな参照素材として利用。
- Factory PCMの短い解析区間から基音の整数倍ごとの振幅を測定し、Web Audio `PeriodicWave` へ再構築。
- **Source A / Source B** として Piano / Guitar / Fretless の倍音テンプレートを選び、`Morph` で2つの音色特性を連続的に混ぜられるようにした。
- 再合成した倍音成分だけでは失われやすいアタック感を補うため、元PCMの短い **Body / Transient layer** を限定量だけ重ねるハイブリッド方式を採用。
- Patch Editorから `Source A/B / Morph / Harmonics / Spectral Brightness / PCM Body / PCM Transient / Detune / Air-Noise / ADSR` を調整可能。
- `warm / bright / dark / wide / metallic / woody / airy / percussive / smooth / short / long` などの自然言語を、再合成パラメータのbounded modifierとして反映。
- 新しい代表例として **PCM Resynth Bell / PCM Resynth Pluck / PCM Resynth Organ / PCM Resynth Lead / PCM Resynth Pad / PCM Resynth Bass** を追加。
- 既存の **String Ensemble / Synth Brass / Airy Choir Pad / Retro Polysynth / Resonant Acid Bass / Analog Synth Keys** もPCM再合成方式へ移行し、音色ごとに異なるPCMソース・Morph・倍音数・アタック・エンベロープを使用。
- 「グランドピアノ」「エレキギター」「フレットレスベース」「ドラム」「DX系FMエレピ」など、明示的な実楽器／専用音源の指定は従来の専用エンジンをそのまま使用。
- 解析元はアプリ自身がローカル生成するFactory PCMだけで、第三者Preset／録音の取得・コピーやランタイムのネットワークアクセスは行わない。
- PCM再合成も既存の単一 `AudioContext` と `noteOn / noteOff` 契約を利用し、VST3ルーターは引き続き最終Note Event境界を担当。
- Native VST3 HostのC++は変更していないため、v0.9.0への更新後に `build_vst3_host.cmd` を再実行する必要はありません。

### PCM Spectral Resynthesis の考え方

```text
自然言語
  ↓
音色カテゴリ + 質感を判定
  ↓
Factory PCMから参照元を選択
  ├─ Piano PCM
  ├─ Guitar PCM
  └─ Fretless PCM
  ↓
倍音振幅をローカル解析
  ↓
PeriodicWaveとして再合成
  ↓
Source A ↔ Source B Morph
  + 短いPCM Body / Transient
  + Air / Noise
  + ADSR / Delay
  ↓
既存 noteOn / noteOff
```

これはニューラルネットによる生成や外部サンプル検索ではなく、既存Factory PCMのスペクトルを決定論的DSPで再構築する方式です。例えば「ガラスのようなベル」はPiano/Guitar系の高域倍音と強いTransient、「木質のプラック」はGuitar/Fretless系のPCM Bodyと短いDecay、「エアリーなクワイア」はFretless/Piano系の滑らかな倍音とNoise・長いAttack/Releaseを使うため、同じ2 Oscillator音色へ収束しにくくなります。

## v0.8.1 の主な変更

- 画面上部に **「1. 音色を作る → 2. 音源を選ぶ → 3. 演奏・試聴 → 4. 録音する」** の操作ガイドを追加。
- VST3設定を「音源を選ぶ」に移動し、通常の内蔵音源利用と外部VST3利用の関係を分かりやすく整理。
- Sample Performanceとライブ鍵盤／ドラムを **「演奏・試聴」** に集約。
- これまで別々だった **PCキーボード演奏録音** と **鼻歌録音** を、新しい **RECORDING STUDIO** に統合。
- RECORDING STUDIO内は「⌨ PCキーボード演奏」「🎤 鼻歌からメロディー」の2タブで切り替え可能。
- PCキーボード録音の最大120秒／512ノート、ピアノロール、再生、クリアはそのまま維持。
- 鼻歌のキー／スケール補正、BPM／量子化、楽譜、登録フレーズへの取り込みもそのまま維持。
- 録音画面のタブ切替はUIだけを制御し、新しいAudioContext、音声録音経路、VST3経路を追加しない設計。
- VST3本体Editorボタンを画面に明示配置し、動的生成に頼らず「音源を選ぶ」からアクセスできるよう整理。
- このバージョンはWeb UIのみの変更なので、Native VST3 Hostの再ビルドは不要です。

### v0.8.1 の基本操作

1. **音色を作る** — 自然言語から内蔵音色を生成します。
2. **音源を選ぶ** — 通常は内蔵音源のままで使用します。VST3を使う場合だけ検索・ロード・ルーティングを設定します。
3. **演奏・試聴** — Sample Performance、画面鍵盤、PCキー、MIDIで音を確認します。
4. **録音する** — RECORDING STUDIOで「PCキーボード演奏」または「鼻歌からメロディー」を選びます。

## v0.8.0 の主な変更

- VST3を再ロードした直後でも、診断ボタンを押さずに `A / S / D` などのPCキーボードショートカットで演奏できるよう、ロード完了後のフォーカス復元処理を修正。
- 同じVST3を再ロードした場合に、直前のVST3ルーティングON状態を復元。
- 「VST3本体画面を開く」から、ロード中の**同じVST3インスタンス**のネイティブEditor Windowを表示できるようにし、プラグイン自身のPreset Browser／音色UIを利用可能にした。
- VST3がホストへ公開するProgram/Preset相当パラメータは、ブラウザ側の専用セレクターからも切り替え可能。
- VST3ルーティング中のサンプル演奏と画面鍵盤のハイライトを同期。
- オンスクリーン鍵盤の白鍵／黒鍵、音名、PCキーラベル、発音ハイライトを改善。
- PCキーボード演奏を最大120秒／512ノートまでノートイベントとして録音し、ピアノロール表示・再生・クリアに対応。
- 自然言語の内蔵シンセ音色に **String Ensemble / Synth Brass / Airy Choir Pad / Retro Polysynth / Resonant Acid Bass / Analog Synth Keys** を追加。
- `warm / bright / dark / wide / dry / spacious` などの表現でCutoff、Resonance、Detune、Delay等へboundedな補正を加える音色バリエーションを追加。
- Native VST3 HostのC++を変更しているため、このバージョンへ更新した後は一度 `build_vst3_host.cmd` を再実行してください。

## v0.7.0 の主な変更

- 鼻歌から推定した音程列を **Major / Natural Minor のキー／スケールへ自動補正**。
- 鼻歌のタイミングから **BPMと1/8・1/16・1/32の量子化グリッドを自動推定**。
- 補正済みメロディーを **SVG五線譜** で確認可能。
- Windowsの一般的な **VST3 Instrument** を検索・ロードして演奏可能。
- VST3のパラメータをブラウザ側のスライダーから操作可能。
- VST3はブラウザ内へロードせず、**別プロセスのWindowsネイティブホスト**で実行。
- GitHub ActionsでPython回帰テストに加えて、Windows上でVST3ホストの実ビルドも検証。

## v0.8.0 のVST3・キーボード演奏改善

VST3実機確認を進める中で、ロード後の発音経路、鍵盤表示、PCキーボード演奏、音色切替、演奏録音を追加・改善しました。

- Native VST3 HostのBus構成・処理開始順序を見直し、VST3からWindows標準音声出力へリアルタイム再生できるよう改善。
- 「PC音声出力テスト」と「VST3診断」を追加。Note On件数、Event配送数、`process()` 成否、出力Peak、出力ch、Event Busを確認可能。
- VST3ルーティング中のサンプル演奏でも、発音に合わせて画面の鍵盤がハイライトするよう同期。
- VST3操作後にフォーム部品へフォーカスが残っていても、`A=ド(C4) / S=レ(D4) / D=ミ(E4)` などのPCキーボードショートカットで演奏しやすいよう改善。
- **VST3を再ロードした直後でも、診断ボタンを押さずにPCキー演奏へ戻れるよう、非同期ロード／パラメータ再構築後のフォーカス復元を強化。**
- 同じVST3を再ロードした場合は、直前のVST3ルーティングON状態を復元。
- VST3がホストへ公開しているProgram / Preset相当の離散パラメータがある場合、専用セレクターと前後ボタンから音色切替可能。
- **「VST3本体画面を開く」から、ロード中の同じVST3インスタンスのネイティブEditor Windowを表示可能。** VST3自身が提供するPreset Browserや音色UIからピアノ、Pad、Brass、Drum等を切り替えられるプラグインでは、その本来の画面を利用できます。
- 白鍵／黒鍵の立体感、音名、PCキーラベル、発音中のハイライトを改善し、鍵盤UIを見やすくした。
- PCキーボード演奏を最大120秒／512ノートまで録音し、ピアノロール表示・再生・クリアが可能。録音は音声ではなくMIDI相当のノート情報のみで、再生は既存 `noteOn / noteOff` 経路を利用するため、VST3ルーティングON時はVST3音源で再生される。

VST3のProgram / Presetは、プラグイン側がホストへ切替用パラメータを公開している場合に専用セレクターから利用できます。Programパラメータを公開しないVST3でも、独自Editorを提供していれば「VST3本体画面を開く」からプラグイン自身のPreset Browserを利用できます。独自Editorも公開しないVST3では、従来の汎用パラメータUIを利用します。

## 音源モデル

| 要求する音 | Engine / Model | 主な特徴 |
| --- | --- | --- |
| Pad / Lead / Bell / Pluck / Strings / Brass / Choir / 一般的な抽象音色 | `sampler / spectral_resynth` | Factory PCM倍音解析 + PeriodicWave再合成 + PCM Body/Transient + Morph |
| 基本的なSubtractive Synth要求／未分類fallback | `synth / generic` | 2 Oscillator + Filter + ADSR + LFO + Delay |
| フレットレスベース | `sampler / fretless_bass` | PCM + Finger/Release/Slide Noise + Mwah |
| エレキギター | `sampler / electric_guitar` | PCM + Pick/Release + Amp Drive + Cabinet + Chorus |
| グランドピアノ | `sampler / grand_piano` | PCM + Hammer + Damper + String/Body Resonance + Room |
| 生ドラム系 | `drum / studio_drums` | PCM one-shot + Velocity差 + Tune / Decay / Room |
| DX系エレピ | `fm / dx_ep` | FM Modulation + Operator Ratio + Chorus |
| 外部音源 | Windows VST3 Instrument | Native VST3 Host経由 |

ブラウザ内蔵音源は同一 `AudioContext` を共有し、演奏は次の境界へ統一しています。

```text
setPatch(validatedPatch)
noteOn(midiNote, velocity, whenSeconds=0)
noteOff(midiNote, whenSeconds=0)
```

VST3ルーティングをONにすると、この最終 `noteOn / noteOff` 境界をVST3イベントへ変換します。そのためPCM再合成を含む内蔵音源、鍵盤、PCキー、Web MIDI、サンプル演奏、PCキー録音の再生、鼻歌試聴を同じVST3境界へ接続できます。

## 自然言語の音色バリエーション

v0.9.0以降、抽象的な音色要求は主にPCM Spectral Resynthesisへ送ります。自然言語から実行コードやDSPコードを生成するのではなく、**PCM参照元・Morph・倍音数・Brightness・PCM Body/Transient・Detune・Noise・ADSR**という有限のPatch値へ変換し、既存validatorでClampします。

代表例:

- `広がりのあるシンセストリングス` → **String Ensemble**（Fretless ↔ Piano）
- `パンチのあるシンセブラス` → **Synth Brass**（Guitar ↔ Piano）
- `エアリーなクワイアのボイスパッド` → **Airy Choir Pad**（Fretless ↔ Piano + Air）
- `80年代の太いポリシンセ` → **Retro Polysynth**（Guitar ↔ Fretless）
- `レゾナンスの強いアシッドベース` → **Resonant Acid Bass**（Fretless ↔ Guitar）
- `柔らかいアナログのシンセキー` → **Analog Synth Keys**（Piano ↔ Guitar）
- `ガラスのように明るい金属的なベル` → **PCM Resynth Bell**
- `木質で短いアタックのプラック` → **PCM Resynth Pluck**

`warm / 暖かい`, `bright / 明るい`, `dark / 暗い`, `wide / 広がり`, `metallic / 金属的`, `woody / 木質`, `airy / 息`, `percussive / パーカッシブ`, `smooth / 滑らか`, `short / 短い`, `long / 長い` などを組み合わせると、PCM参照元や再合成パラメータへ限定範囲内の補正を加えます。ランタイム中にインターネットへ接続して音色データを取得する仕組みではありません。

## 鼻歌 → メロディー

RECORDING STUDIOの「🎤 鼻歌からメロディー」タブで録音開始し、単音でメロディーを歌います。マイクの生音声そのものは保存しません。ブラウザ内のYIN系解析で音程・開始時刻・長さ・Velocity相当だけを抽出します。

### 音程の自動補正

録音停止後、全ノートについて12音×Major / Natural Minorを評価します。長く歌った音と検出Confidenceの高い音を重く見てキーを推定し、スケール外の音だけ近いスケール音へ寄せます。

例:

```text
Raw:       C4  D4  D#4  F4  G4  B3  C4
推定:      C Major
Corrected: C4  D4  E4   F4  G4  B3  C4
```

すでに推定スケール内の音は移動しません。自動補正が合わない場合は「キー／スケールを自動補正」をOFFにできます。

### タイミングの自動クォンタイズ

録音された開始位置・音の長さについて、BPM 60〜180と以下のグリッドを比較します。

- 1/8音符
- 1/16音符
- 1/32音符

最も誤差が小さいBPMとグリッドを自動採用します。BPMまたは量子化を手動変更した場合は、その結果について自動タイミング補正をOFFにして手動値を優先します。手動BPMは40〜240です。

### 楽譜表示

補正・量子化後のMIDIライクなノート列からSVG五線譜を生成します。

- 音域からTreble / Bass clefを自動選択
- 4/4表示
- 小節線、音符、休符、シャープ表示
- 推定キーとBPMを上部表示

これは譜面確認用の簡易レンダラーで、MusicXMLの完全な浄書エンジンではありません。楽譜も生音声ではなく補正済みノートイベントから作成します。

### 登録フレーズへの取り込み

鼻歌結果は例えば次の形式になります。

```text
C4 | 0.5 | 0.82
D4 | 0.5 | 0.78
E4 | 1   | 0.84
R  | 0.5 | 0.50
G4 | 1   | 0.88
```

「登録フレーズへ取り込む」で、既存のユーザー登録Sample Performance欄へ転記できます。永続保存はユーザーが「登録」を押したときだけ `localStorage` に行います。

## VST3 Instrument対応

### 構成

```text
Browser UI
  │
  │ same-origin /api/vst3/*
  ▼
Python server.py (127.0.0.1 only)
  │
  │ JSON-line command over stdin/stdout
  ▼
nlss_vst3_host.exe
  │
  ├─ Steinberg VST3 SDK
  ├─ VST3 Instrument + same-instance native Editor Window
  └─ miniaudio → Windows default audio output
```

`.vst3` バイナリをChrome/Edge内へロードすることはありません。VST3本体画面もブラウザDOMへ埋め込むのではなく、Native HostがWindowsのネイティブウィンドウとして表示します。プラグインが不安定でもブラウザのWeb Audio音源とは別プロセスです。

### 初回だけ必要なVST3ホストのビルド

VST3を利用する場合、Windowsへ以下が必要です。

- Git
- CMake
- Visual Studio 2022 の **Desktop development with C++**

リポジトリ直下で実行します。

```bat
build_vst3_host.cmd
```

初回は固定バージョンの依存ソースを取得してコンパイルします。

- Steinberg VST3 SDK 3.8.1
- miniaudio 0.11.25

依存先はCMakeでcommit SHAまで固定しています。ビルド結果は通常ここです。

```text
native\vst3_host\build\Release\nlss_vst3_host.exe
```

### VST3を使う

通常どおりアプリを起動します。

```bat
start_synth.cmd
```

画面の「2. 音源を選ぶ / VST3 Instrument」で、

1. 「VST3を検索」
2. プラグインを選択
3. 「ロード」
4. 必要なら「VST3本体画面を開く」でプラグイン自身のPreset／音色画面を表示
5. 必要ならブラウザ側のVST3 ParameterまたはProgram/Presetを調整
6. 「鍵盤・MIDI・サンプル演奏・録音再生・鼻歌試聴をVST3へ送る」をON

と操作します。

標準ではWindowsのVST3標準配置先を検索します。追加フォルダーを使う場合は、起動前に `NLSS_VST3_PATHS` を設定できます（複数はWindowsの `;` 区切り）。ネイティブホストexeを別の場所に置く場合は `NLSS_VST3_HOST` にフルパスを設定できます。

### 現在のVST3対応範囲

- VST3 Instrumentの検索
- 1プラグインのロード／解除
- Note On / Note Off
- Velocity
- `whenSeconds` を維持したイベントスケジュール
- パラメータ一覧取得
- 正規化値0〜1でパラメータ変更
- VST3音声をWindows標準出力へ再生
- VST3が公開するProgram/Preset相当パラメータの切替
- VST3独自Editor Windowの表示（プラグインがEditorを提供する場合）
- Editor内のParameter/Preset変更を、演奏中の同じVST3インスタンスへ反映
- VST3診断／Native音声出力テスト

複数VSTチェイン、Effect Insert、Preset Stateの保存／復元、Automation Laneなどは今後の拡張対象です。

## PCMグランドピアノ

`グランドピアノ / concert grand / acoustic piano / piano` などは `sampler / grand_piano` へ振り分けます。Factory Piano PCMは外部録音を使わずブラウザ内で生成し、複数ルートからPlayback Rateで音程を合わせます。

Patch Editorから Tone / Hammer / Resonance / Damper Noise / Softness / Sustain / Velocity Curve / Room / Master を変更できます。

## フレットレスベース

通常生成でもFinger Noiseを強め、`指弾き / fingerstyle / フィンガー` を明示するとさらにAttack/Finger Noiseを強化します。右側の `Finger Noise` / `Attack PCM` から調整できます。

## エレキギター + Amp

Factory Guitar PCMの後段にAmp処理を持ちます。

```text
PCM Guitar
  ↓
Pick / String Character
  ↓
Amp Pre Gain
  ↓
WaveShaper Distortion
  ↓
Amp Tone / Presence
  ↓
Cabinet Filter
  ↓
Chorus
  ↓
Master
```

Amp Modelは `clean / crunch / high_gain / acoustic`。ギター和音のSample Performanceでは、ピック移動を表すため構成音をスタイル別に約16〜28msずつずらし、Down / Up strokeを表現します。

## Sample Performanceと自作フレーズ

Synth / Fretless / FM EP / Grand Piano / Drums / Electric Guitarに、Pop / EDM / Ambient / Funk / Fusion / City Pop / Classical / Boogie / Blues / Bossa Nova / Jazzなどの短いオリジナルSample Performanceがあります。

自作フレーズは次の形式で登録できます。

```text
C4,E4,G4 | 1 | 0.84
A4        | 0.5 | 0.80
R         | 0.5 | 0.80
67,71,74  | 1 | 0.88
```

- BPM: 40〜240
- 1ステップ: 0.125〜8拍
- Velocity: 0.05〜1.0
- MIDIノート: 0〜127
- 最大50フレーズ
- 1フレーズ最大128ステップ
- 保存先: ブラウザ `localStorage` のみ

## Windowsでの起動

### 初回

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

VST3も使う場合だけ追加で:

```bat
build_vst3_host.cmd
```

### 2回目以降

```bat
cd C:\temp\natural-language-software-synth
git checkout main
git pull
check_harness.cmd
start_synth.cmd
```

Native VST3 HostのC++が変更された更新を取得した場合は、`git pull` 後に一度だけ次も実行します。

```bat
build_vst3_host.cmd
```

終了は `Ctrl + C` です。

## 安全設計とガードレール

- 自然言語、鼻歌結果、ユーザー登録フレーズをコードとして実行しない
- `eval()` / dynamic script injectionを使わない
- ブラウザ内蔵音源はAudioContextを1つだけ共有
- PCM Spectral Resynthesisも既存AudioContextを共有し、新しいAudioContextを作らない
- PCM再合成の参照元はローカル生成Factory Piano / Guitar / Fretless PCMだけに限定
- PCM再合成は第三者Sample／Presetの取得やランタイムのネットワークアクセスを行わない
- PCM再合成のPatch値はすべてvalidatorでClamp
- マイクの生音声を録音・保存・アップロードしない
- Master Gain / Polyphony / PCM / Guitar Amp / Piano / Drum / FM値をClamp
- VST3をブラウザプロセスへロードしない
- VST3はスキャン済みローカルIDからのみロード
- VST3 Note / Velocity / Parameter値をBridge側でもClamp
- VST3 Bridgeは既存の `127.0.0.1` サーバー経由のみ
- VST3独自EditorもNative Hostの同じプロセス／同じプラグインインスタンス上でのみ表示
- 自然言語音色バリエーションはオリジナルのbounded parameter recipeのみで、第三者Preset／録音をランタイム取得しない
- RECORDING STUDIOのタブ切替はUIのみで、録音・音声・VST3の新しい実行経路を作らない
- Factory PCMへ第三者アーティスト録音を埋め込まない
- Output normalizationはMaster Gain上限を迂回しない

## 開発時の確認

```bat
python -m pytest tests/
python scripts/harness_check.py
```

または:

```bat
check_harness.cmd
```

VST3ネイティブ側を変更した場合は:

```bat
build_vst3_host.cmd
```

GitHub ActionsでもLinux上のpytest/HarnessとWindows上のNative VST3 buildを両方実行します。

## 今後の方向性

- PCM Spectral Resynthesisの時間変化するスペクトル（Attack/Sustain別テンプレート）
- PCM再合成のSourceをDrum transientや将来のライセンス済みPCMへ拡張
- VST3 Preset / State保存
- 複数VST3 Instrument / Effect chain
- 鼻歌のクロマティック／ブルース／ペンタトニック等のスケール候補
- MusicXML / Standard MIDI File Export
- ピアノロール／ステップシーケンサー
- 使用許諾のある実録音PCMのVelocity Layer / Round Robin
- Grand Piano Pedal / Sympathetic Resonance
- Guitar Hammer-on / Pull-off / Bend / Harmonics / Cabinet IR
