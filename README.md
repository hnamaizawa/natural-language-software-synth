# Natural Language Software Synth

自然言語で楽器や雰囲気を指定すると、その内容からソフトウェアシンセサイザーの音色やドラムキットを生成し、すぐに演奏できるローカル実行型のMVPです。

このプロジェクトは、`stock-value-dislocation-verification-system` で採用している「自然言語で要件を伝える → AIが限定された範囲を実装する → ハーネスと回帰テストで検証する → GitHub PRでレビューする」という開発方式を、ソフトシンセ開発へ応用しています。

## 主な機能

- 自然言語で音色を指定できます。
- 自然言語から検証・範囲制限された `SynthPatch` を生成します。
- **鍵盤系音色とドラム系音色の両方に対応します。**
- 鍵盤系音色では以下で演奏できます。
  - 画面上のピアノ鍵盤
  - PCキーボード
  - ブラウザ対応MIDIキーボード
- ドラム系音色ではピアノ鍵盤の代わりにドラムセットのパッドを表示します。
  - Kick
  - Snare
  - Closed Hat
  - Open Hat
  - Low / Mid / High Tom
  - Crash
  - Ride
- 生成した音色を使ったサンプル演奏ができます。
  - 鍵盤: メロディ / コード / ベースライン
  - ドラム: ハーフタイム・シャッフル / ストレート・ドラム
- 音色をJSON形式で保存・読込できます。
- 将来のシーケンサー連携に備え、鍵盤とドラムで同じノートイベントAPIを使用します。

## v0.2.0 ドラムモード

ドラムに関する自然言語が含まれる場合、`engine_type` が `drum` になり、鍵盤音源ではなく合成ドラムエンジンを使用します。

### 対応する自然言語例

```text
タイトで明るいスタジオドラムの音
```

```text
Toto のロザーナーでジェフ ポーカロさんのシャッフルで有名なドラムの音を生成してください。
```

上記のように `Rosanna / ロザーナ / ロザーナー / Porcaro / ポーカロ / shuffle / シャッフル` を含むドラム要求は、`drum_style=half_time_shuffle` として扱います。

生成するのは原曲の録音やサンプリングではなく、Web Audio APIで合成したオリジナルのドラム音色と、ハーフタイム・シャッフルの特徴を確認するための短いデモパターンです。

### ドラム音の生成方法

外部のドラムサンプルファイルは使用しません。

- Kick: ピッチ下降するサイン波
- Snare: ノイズ + 胴鳴り用オシレーター
- Hi-Hat / Cymbal: 高域フィルターを通したノイズ
- Tom: ピッチ付きの減衰オシレーター
- Room: 同一AudioContext内の短いディレイ経路

ドラム用パラメータもPatch JSONとして保存され、サーバー側とブラウザ側の両方で範囲制限されます。

## ドラムセットで試す

ドラムPatchを生成すると、ピアノ鍵盤は自動的に非表示になり、9個のドラムパッドへ切り替わります。

PCキーボードでは以下の割り当てです。

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

MIDI入力ではGM系の代表的なドラムノートを受け付け、内部の9音へ正規化して再生します。

## サンプル演奏

生成したPatchを鍵盤やドラムパッドで手動演奏しなくても、短いサンプルで確認できます。

### 鍵盤Patch

- メロディ
- コード
- ベースライン

### ドラムPatch

- **ハーフタイム・シャッフル**
  - シャッフルするハイハット
  - 3拍目の強いスネア
  - 弱いゴーストノート
  - シンコペーションしたキック
- **ストレート・ドラム**
  - 一般的な8ビート系の確認用パターン

ドラムPatchで `drum_style=half_time_shuffle` の場合は、ハーフタイム・シャッフルが初期選択されます。

サンプル演奏も専用音源を作らず、画面演奏・PCキーボード・MIDI・将来のシーケンサーと同じ `noteOn()` / `noteOff()` を使用します。

## MVPの構成

- **Python標準ライブラリHTTPサーバー**
  - ローカルUIと `/api/generate-patch` APIを提供します。
- **自然言語プロンプトエンジン**
  - 楽器名や雰囲気を決定論的なルールでPatchへ変換します。
- **Web Audio API**
  - 鍵盤: 2オシレーターのポリフォニック減算方式シンセ
  - ドラム: オシレーター / ノイズ / フィルターによる合成ドラム
- **Patch契約**
  - Python側で検証とClampを行い、ブラウザ側でも防御的に再検証します。

## Windowsでの起動方法

### 必要な環境

- Windows 10 / 11
- Python 3.11 以上
- Chrome または Edge
- MIDIキーボード / MIDIドラムは任意

### 初回だけ行う手順

```bat
git clone https://github.com/hnamaizawa/natural-language-software-synth.git
cd natural-language-software-synth
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```

起動後、ChromeまたはEdgeで以下を開きます。

```text
http://127.0.0.1:8765
```

### 2回目以降

```bat
cd C:\temp\natural-language-software-synth
git pull
start_synth.cmd
```

依存関係やセットアップ内容が変更された場合は、再度以下を実行してください。

```bat
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```

### 終了方法

`start_synth.cmd` を実行している画面で `Ctrl + C` を押します。

## 安全設計とガードレール

自然言語や、将来接続するLLMの出力をJavaScriptやDSPコードとして直接実行しません。

```text
自然言語
  ↓
SynthPatch JSON
  ↓
Schema Validation / Clamp
  ↓
SynthEngine
  ├─ melodic synth
  └─ synthesized drum kit
```

主な不変条件は以下です。

- AI出力を実行可能コードとして扱わない
- `eval()` を使用しない
- Master Gainに上限を設ける
- Polyphonyに上限を設ける
- ドラムのチューニング、Decay、Brightness、Room Mixにも範囲制限を設ける
- ドラムモードでも新しいAudioContextを作らない
- ライブ演奏、ドラムパッド、MIDI、サンプル演奏、将来のシーケンサーで同じNote Event契約を使用する

これらは `harness/app_blueprint.yaml` と回帰テストで検証します。

## 開発時の確認

```text
python -m pytest tests/
python scripts/harness_check.py
```

Windowsでは以下でもまとめて確認できます。

```bat
check_harness.cmd
```

## 将来のシーケンサー連携

ブラウザ側の音源エンジンは以下のAPIを公開しています。

```text
setPatch(validatedPatch)
noteOn(midiNote, velocity, whenSeconds=0)
noteOff(midiNote, whenSeconds=0)
```

鍵盤とドラムの両方が同じイベント境界を使うため、将来のピアノロールやドラムシーケンサーも同じ仕組みで追加できます。

## 今後の方向性

- LLMを利用した、より高度な自然言語理解
- Oscillator / Filter / ADSRなどを直接調整するシンセパネル
- ドラム各パーツの詳細エディット
- 音色プリセット管理
- ピアノロール／ステップシーケンサー
- ドラムステップシーケンサー
- MIDI入出力機能の拡張
