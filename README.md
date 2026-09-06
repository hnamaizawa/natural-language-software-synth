# Natural Language Software Synth

自然言語で楽器や雰囲気を指定すると、音源方式まで自動選択してPatchを生成し、その場で演奏できるローカル実行型ソフトウェア音源です。

v0.4.0 では、v0.3.0 の減算シンセ、PCMフレットレスベース、PCMドラム、FMエレピに加えて、**PCM方式のエレキギターとアンプ／キャビネット段**を追加しました。画面右側からアンプDriveを含むギターパラメータをリアルタイム編集できます。

## v0.4.0 の音源方式

自然言語から次の音源モデルへ自動振り分けします。

| 要求する音 | エンジン | 主な特徴 |
| --- | --- | --- |
| Pad / Lead / 一般的なシンセ | `synth` | 2 Oscillator + Filter + ADSR + LFO + Delay |
| フレットレスベース | `sampler` | PCMバッファ再生 + 指ノイズ + Releaseノイズ + Slide + Mwah |
| エレキギター | `sampler` | PCMマルチサンプル + Pick/Releaseノイズ + Amp Drive + Cabinet + Chorus |
| 生ドラム系 | `drum` | PCM one-shot + VelocityによるSnare差 + Tune / Decay / Room |
| DX系エレピ | `fm` | FM変調 + Operator Ratio + Mod Index + Chorus |

すべての音源は同一の `AudioContext` と、以下の演奏契約を共有します。

```text
setPatch(validatedPatch)
noteOn(midiNote, velocity, whenSeconds=0)
noteOff(midiNote, whenSeconds=0)
```

## PCMエレキギター + Amp

以下のようなプロンプトはPCMギターへ振り分けます。

```text
ロック向けのエレキギター。アンプの歪みを強めにして、ピッキングのアタックが分かる音。
```

ギターのFactory PCMは既存アーティストや市販ライブラリの録音ではありません。ブラウザ内で決定論的な弦モデルから複数のルート音PCMを生成し、演奏時には最も近いルート音を `AudioBufferSourceNode` で再生してPlayback Rateで音程を合わせます。

主な表現要素:

- 複数ルート音のPCMマルチサンプル
- Pick Attackノイズ
- Release Noise
- Palm Mute
- Sustain
- Body Tone
- Velocityによる発音強度

ギターの後段にはアンプ／キャビネット相当の処理があります。

```text
PCM Guitar
  ↓
Pick / String Character
  ↓
Amp Pre Gain
  ↓
WaveShaper Distortion
  ↓
Amp Tone
  ↓
Presence
  ↓
Cabinet Filter
  ↓
Chorus
  ↓
Master
```

アンプモデル:

- `clean` - クリーン
- `crunch` - ロック向けの軽～中程度の歪み
- `high_gain` - 強い歪み
- `acoustic` - 歪みを抑えたアコースティック調

右側のPatch Editorでは以下を調整できます。

- Amp Model
- Drive
- Amp Tone
- Presence
- Cabinet
- Body Tone
- Pick Attack
- Release Noise
- Palm Mute
- Sustain
- Chorus
- Master

特に `Drive` は `WaveShaper` の非線形特性へ反映されるため、0に近づけるとクリーンに、上げるとアンプで歪ませたような音へ変化します。

### ギター用サンプル演奏

ギターPatchでは次の3種類を選択できます。

- ロック・リフ
- フュージョン・フレーズ
- アコースティック・アルペジオ

これらは現在のギターPatchを使った短い確認用オリジナルフレーズです。既存楽曲の録音や特定のフレーズをコピーしたものではありません。

プロンプト例:

```text
フュージョン向けの滑らかなエレキギター。クリーン寄りでコーラスを少し。
```

```text
アコースティック調のギター。歪みなしでピックのニュアンスを強めに。
```

## PCMフレットレスベース

以下のようなプロンプトはフレットレスベース用PCMサンプラーへ振り分けます。

```text
ジャコ・パストリアスのような歌うフレットレスベース。指弾きのノイズとスライド感を強めに。
```

主な表現要素:

- 複数のルート音から最も近いPCM音を選択し、再生速度でピッチを合わせる
- 指が弦に触れるAttackノイズ
- 弦から指が離れるReleaseノイズ
- 音程移動時のSlideノイズ
- 前の音程から次の音程へ滑らせるPlayback Rate変化
- Filter resonanceを利用したフレットレス特有の `mwah` 感
- Velocityに応じた発音強度

右側のPatch Editorでは `Finger Noise / Release Noise / Slide / Slide Time / Mwah / Tone / Velocity Curve` などをリアルタイムで変更できます。

## PCMドラム

以下のようなプロンプトはPCMドラムへ振り分けます。

```text
Toto のロザーナーでジェフ ポーカロさんのシャッフルで有名なドラムの音を生成してください。
```

この場合は `engine_type=drum`、`instrument_model=studio_drums`、`drum_style=half_time_shuffle` となります。

ドラムPatchではピアノ鍵盤を自動的に非表示にし、以下の9パッドを表示します。

- Kick
- Snare
- Closed Hat
- Open Hat
- Low Tom
- Mid Tom
- High Tom
- Crash
- Ride

SnareはVelocityによって弱い音と強い音を切り替えます。右側では `Kick Tune / Kick Decay / Snare Tune / Snare Decay / Hat Decay / Tom Decay / Brightness / Room` を調整できます。

サンプル演奏には以下があります。

- ハーフタイム・シャッフル
- ストレート・ドラム

原曲録音や特定アーティストの演奏をサンプリングしたものではありません。

## DX系FMエレピ

以下のようなプロンプトは専用FMエンジンへ振り分けます。

```text
80年代の DX-7 のような、きらびやかな FM エレピ
```

主なパラメータ:

- FM Index
- Brightness
- Modulator Ratio A / B
- Decay
- Release
- Chorus

サンプル演奏ではFMエレピ向けのコード進行を選択できます。

## Factory PCMについて

Factory PCMは、既存アーティストや市販音源の録音をコピーしていません。ブラウザ内で決定論的にPCMバッファを生成し、その後は `AudioBufferSourceNode` を使うサンプラーとして再生します。

そのため、従来の「ノートごとに単純なOscillatorを鳴らす」方式より、発音ノイズや奏法レイヤーを分離して扱える構造になっています。一方、**本当に録音された楽器そのものの質感を得るには、将来的に使用許諾のある実録音マルチサンプルへFactory PCMを置き換える必要があります。** エンジン境界はその置換を想定しています。

## グラフィカルPatch Editor

画面右側の「音色をグラフィカルに調整」から、生成された音色を直接編集できます。

- 数値パラメータ: スライダー + 円形メーター
- Waveform / Amp Modelなど: Select
- 値変更は即座に現在の音源へ反映
- 音源タイプ／楽器モデルに応じて編集項目を自動切替
- 「生成値へ戻す」で直前に生成／読込したPatchへ戻す

画面操作で変更した値も検証／Clampを通るため、Master Gainや各エンジンのパラメータ範囲を超えません。

## Windowsでの起動方法

### 必要な環境

- Windows 10 / 11
- Python 3.11 以上
- Chrome または Edge
- MIDIキーボード / MIDIドラムは任意

### 初回

```bat
git clone https://github.com/hnamaizawa/natural-language-software-synth.git
cd natural-language-software-synth
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```

ブラウザで以下を開きます。

```text
http://127.0.0.1:8765
```

### 2回目以降

```bat
cd natural-language-software-synth
git pull
start_synth.cmd
```

依存関係やセットアップ内容が変更された場合は以下を実行します。

```bat
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```

終了するときは `start_synth.cmd` を実行している画面で `Ctrl + C` を押します。

## PCキーボード

鍵盤／ギター系:

```text
A W S E D F T G Y H U J K
```

ドラム系:

```text
A = Kick
S = Snare
D = Closed Hat
F = Open Hat
G = Low Tom
H = Mid Tom
J = High Tom
K = Crash
L = Ride
```

## 安全設計とガードレール

自然言語の出力をJavaScriptやDSPコードとして実行しません。

```text
自然言語
  ↓
SynthPatch JSON
  ↓
Schema Validation / Clamp
  ↓
Engine Router
  ├─ Subtractive Synth
  ├─ PCM Fretless Sampler
  ├─ PCM Electric Guitar + Amp
  ├─ PCM Drum Sampler
  └─ FM Electric Piano
```

主な不変条件:

- AI出力を実行可能コードとして扱わない
- `eval()` / dynamic script injectionを使用しない
- 全エンジン／楽器モデルでAudioContextを1つだけ共有
- Master Gain / Polyphony / PCM / Guitar Amp / FMパラメータをClamp
- グラフィカル編集も検証済みPatchを経由
- ライブ演奏、MIDI、サンプル演奏、将来シーケンサーで同じNote Event契約を使用
- Factory PCMに第三者アーティストの録音を埋め込まない

## 開発時の確認

```bat
check_harness.cmd
```

または個別に:

```text
python -m pytest tests/
python scripts/harness_check.py
```

## 今後の方向性

- ライセンス済み実録音PCMマルチサンプルの読み込み
- Velocity Layer / Round Robinの拡張
- ギターのHammer-on / Pull-off / Bend / Harmonics / String選択
- ギターアンプのIRキャビネット／Convolution対応
- フレットレスのLegato / Hammer-on / Harmonics / String選択
- ドラムの複数Round Robin / Mic Position / Room IR
- FM Algorithmの拡張
- ピアノロール／ステップシーケンサー
- 音色プリセット管理
