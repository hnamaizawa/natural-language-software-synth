# Natural Language Software Synth

自然言語で楽器や雰囲気を指定すると、音源方式まで自動選択してPatchを生成し、その場で演奏できるローカル実行型ソフトウェア音源です。

## v0.5.0 の主な変更

- **PCMグランドピアノ**を追加。`グランドピアノ / concert grand / acoustic piano / piano` などを認識します。
- フレットレスベースの**フィンガーノイズとAttack成分を強化**しました。
- ギターの和音は全音を同時発音せず、**ピックで弦を高速にストロークするように16〜28ms程度ずつ発音をずらす**ようにしました。
- サンプル演奏のフレーズをユーザー自身が登録／削除できるようにしました。登録データは**ブラウザのlocalStorageだけ**に保存されます。
- サンプル演奏ジャンルを大幅に増やしました。ポップ、EDM、アンビエント、ファンク、フュージョン、シティポップ、クラシック、ブギウギ、ブルース、ボサノバなどを追加しています。

## 音源モデル

| 要求する音 | Engine / Model | 主な特徴 |
| --- | --- | --- |
| Pad / Lead / 一般的なシンセ | `synth / generic` | 2 Oscillator + Filter + ADSR + LFO + Delay |
| フレットレスベース | `sampler / fretless_bass` | PCM + Finger/Release/Slide Noise + Mwah |
| エレキギター | `sampler / electric_guitar` | PCM + Pick/Release + Amp Drive + Cabinet + Chorus |
| グランドピアノ | `sampler / grand_piano` | PCM + Hammer + Damper + String/Body Resonance + Room |
| 生ドラム系 | `drum / studio_drums` | PCM one-shot + Velocity差 + Tune / Decay / Room |
| DX系エレピ | `fm / dx_ep` | FM Modulation + Operator Ratio + Chorus |

すべて同一の `AudioContext` と次の演奏APIを共有します。

```text
setPatch(validatedPatch)
noteOn(midiNote, velocity, whenSeconds=0)
noteOff(midiNote, whenSeconds=0)
```

## PCMグランドピアノ

例:

```text
コンサートホールで弾くような豊かなグランドピアノ。
ハンマーのアタックと響板の余韻が自然な音。
```

この場合は `engine_type=sampler` / `instrument_model=grand_piano` になります。DX-7やエレピの語を含む場合は従来どおりFMエレピへ振り分け、グランドピアノへ誤判定しません。

Factory Piano PCMは外部のピアノ録音を使用せず、ブラウザ内で決定論的に生成します。複数のルート音を持ち、近いルートPCMを `AudioBufferSourceNode` で再生してPlayback Rateで音程を合わせます。倍音、わずかな複弦のうなり、ハンマーAttack、Damper Release、響板／Body Resonanceを分離して扱います。

右側のPatch Editorでは以下を調整できます。

- Tone
- Hammer
- Resonance
- Damper Noise
- Softness
- Sustain
- Velocity Curve
- Room
- Master

グランドピアノの内蔵サンプル演奏:

- クラシック・アルペジオ
- ピアノ・バラード
- ポップ・ピアノ
- ジャズ・グランドピアノ
- ブギウギ・ピアノ

## フレットレスベースのFinger Noise強化

フレットレス生成時のFinger Attack / Finger Noiseをv0.4.xより強めました。通常のフレットレスでもFinger Noiseを明瞭にし、`指弾き / fingerstyle / フィンガー` を明示した場合はさらに強くします。

例:

```text
歌うフレットレスベース。
指弾きのフィンガーノイズをしっかり聞かせて、スライド感も強めに。
```

右側の `Finger Noise` / `Attack PCM` から好みに合わせて調整できます。

## ギターの高速ストローク

これまではコードを構成する音がほぼ同時に鳴っていました。v0.5.0ではギターのサンプル演奏で和音が現れた場合、ピックが低音弦から高音弦、または高音弦から低音弦へ移動するイメージで発音タイミングをずらします。

- Fusion: 約16ms / string
- Rock: 約18ms / string
- その他: 約21ms / string
- Acoustic: 約28ms / string

Down Strokeでは低い音から、Up Strokeでは高い音から発音します。これは新しい音源を作るのではなく、既存 `noteOn(..., whenSeconds)` / `noteOff(..., whenSeconds)` の時刻オフセットとして実装しています。

## サンプル演奏ジャンル

内蔵フレーズはすべて音色確認用の短いオリジナルパターンです。

### Synth
- メロディ
- コード
- ポップ
- EDM
- アンビエント
- ジャズ

### Fretless Bass
- 歌うフレーズ
- ファンク
- フュージョン
- バラード
- ジャズ・ウォーキング

### FM EP
- FMエレピ・コード
- シティポップ
- フュージョン
- バラード
- ジャズ・4度堆積

### Grand Piano
- クラシック
- バラード
- ポップ
- ジャズ
- ブギウギ

### Drums
- ハーフタイム・シャッフル
- ストレート
- ロック
- ファンク
- フュージョン
- ボサノバ
- ジャズ・スウィング

### Electric Guitar
- ロック
- フュージョン
- アコースティック
- ブルース
- ファンク
- ポップ
- ボサノバ
- ジャズ

## 自分のサンプル演奏フレーズを登録

SAMPLE欄の **「＋ 自分のサンプル演奏フレーズを登録」** を開くと、現在選択中の楽器用フレーズを登録できます。

1行を1ステップとして以下の形式で入力します。

```text
C4,E4,G4 | 1 | 0.84
A4        | 0.5 | 0.80
R         | 0.5 | 0.80
67,71,74  | 1 | 0.88
```

形式:

```text
音名またはMIDIノート | 拍数 | Velocity
```

- 和音: `C4,E4,G4` のようにカンマ区切り
- MIDI番号も利用可能: `60,64,67`
- `#` / `b` 対応: `F#4`, `Bb3`
- 休符: `R`, `rest`, `休符`, `-`
- BPM: 40〜240
- 1ステップ: 0.125〜8拍
- Velocity: 0.05〜1.0
- MIDIノート: 0〜127
- 最大50フレーズ
- 1フレーズ最大128ステップ

登録したフレーズは現在の楽器モデルに紐付きます。グランドピアノ用に登録したものはグランドピアノ時、ギター用はギター時だけ選択肢に表示されます。ギターで登録した和音も自動的に高速ストロークになります。

登録データは `localStorage` にのみ保存され、GitHub、サーバー、生成アプリのソースコードへ送信・コピーしません。

## PCMエレキギター + Amp

例:

```text
ロック向けのエレキギター。
アンプの歪みを強めにして、ピッキングのアタックが分かる音。
```

Factory Guitar PCMはブラウザ内の決定論的弦モデルから生成します。後段は以下です。

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

Amp Model: `clean / crunch / high_gain / acoustic`。右側では Drive / Amp Tone / Presence / Cabinet / Body Tone / Pick Attack / Release Noise / Palm Mute / Sustain / Chorus / Master を編集できます。

## PCMドラム

例:

```text
Toto のロザーナーでジェフ ポーカロさんのシャッフルで有名なドラムの音を生成してください。
```

この入力は `engine_type=drum` / `instrument_model=studio_drums` / `drum_style=half_time_shuffle` になります。ドラムPatchではピアノ鍵盤をドラムパッドへ切り替えます。

## DX系FMエレピ

例:

```text
80年代の DX-7 のような、きらびやかな FM エレピ
```

`FM Index / Brightness / Modulator Ratio A/B / Decay / Release / Chorus` を編集できます。

## Factory PCMについて

Factory PCMは、既存アーティストや市販音源の録音をコピーしていません。ブラウザ内で決定論的にPCMバッファを生成し、その後 `AudioBufferSourceNode` を使うサンプラーとして再生します。

より高いリアリティが必要な場合は、将来的に使用許諾のある実録音マルチサンプルへFactory PCMを差し替える設計を想定しています。

## グラフィカルPatch Editor

画面右側から音源／楽器モデルに応じたパラメータを直接編集できます。

- 数値: Slider + 円形メーター
- 列挙値: Select
- 操作中に即時反映
- 全変更はValidation / Clampを通過
- 「生成値へ戻す」で直前に生成／読込したPatchへ戻す

## Windowsでの起動方法

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

### 2回目以降

```bat
cd C:\temp\natural-language-software-synth
git checkout main
git pull
check_harness.cmd
start_synth.cmd
```

終了は `Ctrl + C` です。

## PCキーボード

鍵盤／ギター／ピアノ:

```text
A W S E D F T G Y H U J K
```

ドラム:

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

- 自然言語やユーザー登録フレーズをJavaScript/Pythonコードとして実行しない
- `eval()` / dynamic script injectionを使わない
- 全音源でAudioContextを1つだけ共有
- Master Gain / Polyphony / PCM / Guitar Amp / Piano / Drum / FMパラメータをClamp
- グラフィカル編集も検証済みPatchを経由
- ライブ、MIDI、内蔵サンプル、登録サンプル、将来シーケンサーで同じNote Event契約を利用
- Factory PCMに第三者アーティスト録音を埋め込まない
- 登録フレーズはローカル保存だけとし、値を境界チェックしてから演奏
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

## 今後の方向性

- 使用許諾のある実録音PCMマルチサンプルの読み込み
- Velocity Layer / Round Robin
- グランドピアノのPedal / Una Corda / Sympathetic Resonance強化
- ギターのHammer-on / Pull-off / Bend / Harmonics / String選択
- ギターアンプのIR Cabinet / Convolution
- フレットレスのLegato / Harmonics / String選択
- ドラムのRound Robin / Mic Position / Room IR
- ピアノロール／ステップシーケンサー
- サンプルフレーズのJSON Export/Import
