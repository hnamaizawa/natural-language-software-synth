# Natural Language Software Synth

自然言語で楽器や雰囲気を指定すると、その内容からソフトウェアシンセサイザーの音色を生成し、すぐに演奏できるローカル実行型のMVPです。

このプロジェクトは、`stock-value-dislocation-verification-system` で採用している「自然言語で要件を伝える → AIが限定された範囲を実装する → ハーネスと回帰テストで検証する → GitHub PRでレビューする」という開発方式を、ソフトシンセ開発へ応用しています。

## 主な機能

- 自然言語で音色を指定できます。
  - 例: `warm analog pad with a slow attack and wide detune`
  - 日本語の一部表現にも対応しています。
- 自然言語から、範囲制限された検証可能な SynthPatch を生成します。
- 生成した音色を、その場で演奏できます。
  - 画面上の鍵盤
  - PCキーボード
  - ブラウザが対応しているMIDIキーボード
- 音色をJSON形式で保存・読込できます。
- 将来のシーケンサー連携に備え、安定したノートイベントAPIを定義しています。

## MVPの構成

- **Python標準ライブラリHTTPサーバー**
  - ローカルUIと `/api/generate-patch` APIを提供します。
  - 実行時の外部Python依存ライブラリはありません。
- **自然言語プロンプトエンジン**
  - 楽器名や雰囲気を表す単語を、決定論的なルールでシンセパラメータへ変換します。
- **Web Audio API**
  - 1ボイスあたり2オシレーターのポリフォニック減算方式シンセです。
- **Patch契約**
  - Python側で検証と範囲制限を行い、ブラウザ側でも読み込んだJSONを防御的に再検証します。

## 対応する主なシンセ機能

- 2 Oscillator
- Saw / Square / Triangle / Sine
- Detune
- Low-pass Filter
- ADSR Envelope
- LFO / Vibrato
- Delay / Feedback
- 最大16 Voiceのポリフォニー

## Windowsでの起動方法

コマンドプロンプトでプロジェクトフォルダを開き、以下を順番に実行します。

```bat
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```

起動後、ChromeまたはEdgeで以下を開きます。

```text
http://127.0.0.1:8765
```

## PCキーボードでの演奏

以下のキーをC4から半音ずつ割り当てています。

```text
A W S E D F T G Y H U J K
```

## 自然言語の入力例

- `warm analog pad with slow attack and gentle movement`
- `bright glassy bell with a long release`
- `deep punchy synth bass, short and dark`
- `retro lead, wide detune, bright and aggressive`
- `soft dreamy ambient pad with lots of echo`
- `暖かく柔らかいパッドで、アタックを遅くして余韻を長く`
- `太くて暗いシンセベース`

## 安全設計とガードレール

自然言語や、将来接続するLLMの出力を、そのままJavaScriptやDSPコードとして実行しません。

処理は次の流れに限定します。

```text
自然言語
  ↓
SynthPatch JSON
  ↓
Schema Validation / Clamp
  ↓
SynthEngine
```

主な不変条件は以下です。

- AI出力を実行可能コードとして扱わない
- `eval()` を使用しない
- Master Gainに上限を設ける
- Polyphonyに上限を設ける
- 使用可能なOscillator波形を限定する
- MIDI Noteの範囲を検証する
- ライブ演奏と将来のシーケンサーで同じNote Event契約を使用する

これらの条件は `harness/app_blueprint.yaml` と回帰テストで検証します。

## 開発時の確認

ローカルでは以下を実行します。

```bat
check_harness.cmd
```

または個別に以下を実行できます。

```text
python -m pytest tests/
python scripts/harness_check.py
```

## 将来のシーケンサー連携

ブラウザ側の音源エンジンは、将来のピアノロールやステップシーケンサーから同じインターフェースで演奏できるよう、次のAPIを公開しています。

```text
setPatch(validatedPatch)
noteOn(midiNote, velocity, whenSeconds=0)
noteOff(midiNote, whenSeconds=0)
```

将来のシーケンサーは、このノートイベントを時刻指定でスケジュールするだけで、現在のライブ演奏と同じ音源エンジンを利用できます。

## 今後の方向性

- LLMを利用した、より高度な自然言語理解
- Oscillator / Filter / ADSRなどを画面で直接調整できるシンセパネル
- 音色プリセット管理
- ピアノロール／ステップシーケンサー
- シーケンサーと自然言語生成音色の統合
- MIDI入出力機能の拡張
