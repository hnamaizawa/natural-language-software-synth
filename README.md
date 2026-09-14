# Natural Language Software Synth

自然言語で楽器・音色・雰囲気を指定すると音源方式まで選択してPatchを生成し、その場で演奏できるローカル実行型ソフトウェア音源です。鍵盤／PCキーボード／Web MIDI／サンプル演奏に加え、鼻歌からMIDIライクなメロディーを作成できます。v0.7.0では鼻歌の音程・タイミング自動補正、楽譜表示、Windows VST3 Instrumentホストを追加しました。

## v0.7.0 の主な変更

- 鼻歌から推定した音程列を **Major / Natural Minor のキー／スケールへ自動補正**。
- 鼻歌のタイミングから **BPMと1/8・1/16・1/32の量子化グリッドを自動推定**。
- 補正済みメロディーを **SVG五線譜** で確認可能。
- Windowsの一般的な **VST3 Instrument** を検索・ロードして演奏可能。
- VST3のパラメータをブラウザ側のスライダーから操作可能。
- VST3はブラウザ内へロードせず、**別プロセスのWindowsネイティブホスト**で実行。
- GitHub ActionsでPython回帰テストに加えて、Windows上でVST3ホストの実ビルドも検証。

## 音源モデル

| 要求する音 | Engine / Model | 主な特徴 |
| --- | --- | --- |
| Pad / Lead / 一般シンセ | `synth / generic` | 2 Oscillator + Filter + ADSR + LFO + Delay |
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

VST3ルーティングをONにすると、この最終 `noteOn / noteOff` 境界をVST3イベントへ変換します。そのため鍵盤、PCキー、Web MIDI、サンプル演奏、ギターストラム、鼻歌試聴を同じVST3へ送れます。

## 鼻歌 → メロディー

「🎤 鼻歌からメロディーを録音・自動補正」で録音開始し、単音でメロディーを歌います。マイクの生音声そのものは保存しません。ブラウザ内のYIN系解析で音程・開始時刻・長さ・Velocity相当だけを抽出します。

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
  ├─ VST3 Instrument
  └─ miniaudio → Windows default audio output
```

`.vst3` バイナリをChrome/Edge内へロードすることはありません。プラグインが不安定でもブラウザのWeb Audio音源とは別プロセスです。

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

画面の「🎛 VST3 Instrument」で、

1. 「VST3を検索」
2. プラグインを選択
3. 「ロード」
4. 必要ならVST3 Parameterを調整
5. 「鍵盤・MIDI・サンプル演奏・鼻歌試聴をVST3へ送る」をON

と操作します。

標準ではWindowsのVST3標準配置先を検索します。追加フォルダーを使う場合は、起動前に `NLSS_VST3_PATHS` を設定できます（複数はWindowsの `;` 区切り）。ネイティブホストexeを別の場所に置く場合は `NLSS_VST3_HOST` にフルパスを設定できます。

### 現在のVST3対応範囲

v0.7.0では以下を対象にしています。

- VST3 Instrumentの検索
- 1プラグインのロード／解除
- Note On / Note Off
- Velocity
- `whenSeconds` を維持したイベントスケジュール
- パラメータ一覧取得
- 正規化値0〜1でパラメータ変更
- VST3音声をWindows標準出力へ再生

プラグイン独自Editor Windowの埋め込み、複数VSTチェイン、Effect Insert、Preset Browser、Automation Laneなどは今後の拡張対象です。

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

終了は `Ctrl + C` です。

## 安全設計とガードレール

- 自然言語、鼻歌結果、ユーザー登録フレーズをコードとして実行しない
- `eval()` / dynamic script injectionを使わない
- ブラウザ内蔵音源はAudioContextを1つだけ共有
- マイクの生音声を録音・保存・アップロードしない
- Master Gain / Polyphony / PCM / Guitar Amp / Piano / Drum / FM値をClamp
- VST3をブラウザプロセスへロードしない
- VST3はスキャン済みローカルIDからのみロード
- VST3 Note / Velocity / Parameter値をBridge側でもClamp
- VST3 Bridgeは既存の `127.0.0.1` サーバー経由のみ
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

- VST3プラグイン独自Editor Window
- VST3 Preset / State保存
- 複数VST3 Instrument / Effect chain
- 鼻歌のクロマティック／ブルース／ペンタトニック等のスケール候補
- MusicXML / Standard MIDI File Export
- ピアノロール／ステップシーケンサー
- 使用許諾のある実録音PCMのVelocity Layer / Round Robin
- Grand Piano Pedal / Sympathetic Resonance
- Guitar Hammer-on / Pull-off / Bend / Harmonics / Cabinet IR
