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
- **生成した音色を使ったサンプル演奏ができます。**
  - メロディ
  - コード
  - ベースライン
  - 再生中の停止
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

### 必要な環境

- Windows 10 / 11
- Python 3.11 以上
  - `setup_windows.cmd` は Windows の Python Launcher (`py`) を使用します。
- Chrome または Edge
- MIDIキーボードは任意です。

### 初回だけ行う手順

GitHubから取得する場合は、コマンドプロンプトまたはPowerShellで以下を実行します。

```bat
git clone https://github.com/hnamaizawa/natural-language-software-synth.git
cd natural-language-software-synth
```

すでにプロジェクトフォルダがある場合は、そのフォルダへ移動してください。

次に、Python仮想環境と開発用依存関係をセットアップします。

```bat
setup_windows.cmd
```

`setup_windows.cmd` は `.venv` を作成し、必要なPythonパッケージをインストールします。

セットアップ後、ハーネスと回帰テストを確認します。

```bat
check_harness.cmd
```

最後にソフトシンセを起動します。

```bat
start_synth.cmd
```

起動後、ChromeまたはEdgeで以下を開きます。

```text
http://127.0.0.1:8765
```

画面が表示されたら、自然言語で音色を入力して生成し、画面鍵盤、PCキーボード、MIDIキーボード、サンプル演奏で音を確認できます。

### 2回目以降の起動

通常はプロジェクトフォルダで以下を実行するだけです。

```bat
start_synth.cmd
```

GitHub上の最新版を取り込んでから起動する場合は、先に以下を実行します。

```bat
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

`start_synth.cmd` を実行しているコマンドプロンプトまたはPowerShellで、次を押します。

```text
Ctrl + C
```

これでローカルHTTPサーバーが終了します。

## PCキーボードでの演奏

以下のキーをC4から半音ずつ割り当てています。

```text
A W S E D F T G Y H U J K
```

## サンプル演奏

生成した音色が実際のフレーズでどのように聞こえるかを、鍵盤を弾かなくても確認できます。

1. 自然言語から音色を生成するか、保存済みのPatch JSONを読み込みます。
2. PLAYエリアの「演奏タイプ」から以下のいずれかを選びます。
   - **メロディ**: 単音フレーズでリード、ベル、パッドなどの音色を確認します。
   - **コード**: 和音進行でパッドやポリシンセの響きを確認します。
   - **ベースライン**: 低音フレーズでベース系音色を確認します。
3. **「▶ サンプル演奏」** を押します。
4. 途中で止める場合は **「■ 停止」** を押します。

サンプル演奏は専用の別音源を持たず、画面鍵盤・PCキーボード・MIDI・将来のシーケンサーと同じ `noteOn()` / `noteOff()` を使用します。そのため、サンプル演奏で確認した音と手動演奏の音源実装は共通です。

手動で鍵盤やMIDIを演奏した場合は、サンプル演奏を停止して手動演奏を優先します。

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
- ライブ演奏、MIDI、サンプル演奏、将来のシーケンサーで同じNote Event契約を使用する

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

サンプル演奏もこのインターフェースを使っているため、今回の実装は将来のシーケンサー機能に向けた最初の実用的なイベントスケジューリング例にもなっています。

将来のシーケンサーは、このノートイベントを時刻指定でスケジュールするだけで、現在のライブ演奏と同じ音源エンジンを利用できます。

## 今後の方向性

- LLMを利用した、より高度な自然言語理解
- Oscillator / Filter / ADSRなどを画面で直接調整できるシンセパネル
- 音色プリセット管理
- ピアノロール／ステップシーケンサー
- シーケンサーと自然言語生成音色の統合
- MIDI入出力機能の拡張
