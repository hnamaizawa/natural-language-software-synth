# CURRENT

## v0.7.0 Humming Assist + Score + Native VST3 Host

- [x] 鼻歌全体からMajor / Natural Minorのキー／スケールを自動推定
- [x] 音価・検出Confidenceを重みとしてキー推定
- [x] スケール外の検出音を近傍スケール音へ自動補正
- [x] 自動キー補正をデフォルトON、手動OFF可能
- [x] 60〜180 BPMを探索して鼻歌のテンポを自動推定
- [x] 1/8・1/16・1/32から量子化グリッドを自動選択
- [x] 自動タイミング補正をデフォルトON、BPM/量子化の手動変更も可能
- [x] 補正済みノート列を既存Custom Phrase形式へ変換
- [x] 補正済みノート列をSVG五線譜として表示
- [x] 音域に応じてTreble / Bass clefを自動選択
- [x] 楽譜に推定キーとBPMを表示
- [x] VST3検索UI
- [x] Windows標準VST3パス + `NLSS_VST3_PATHS` 追加検索
- [x] VST3選択／ロード／解除
- [x] 鍵盤・PCキー・Web MIDI・サンプル演奏・鼻歌試聴をVST3へルーティング
- [x] `whenSeconds` をブラウザ側で保持してVST3イベント送信をスケジュール
- [x] VST3パラメータ列挙／0..1正規化スライダー編集
- [x] Python localhost server → stdio → native VST3 host の分離構成
- [x] プラグインロードをスキャン済みIDのみに制限
- [x] Note / Velocity / Parameter値をBridge側でBound
- [x] Steinberg VST3 SDK 3.8.1をcommit SHA固定
- [x] miniaudio 0.11.25をcommit SHA固定
- [x] `build_vst3_host.cmd` を追加
- [x] Windows GitHub ActionsでNative VST3 Hostを実ビルド
- [x] Regression tests / Blueprint / Harness更新

## v0.6.0 Humming → MIDI-like Melody Capture

- [x] マイク入力を `navigator.mediaDevices.getUserMedia()` で取得
- [x] 既存 `engine.ctx` の `MediaStreamSource` / `AnalyserNode` を利用
- [x] マイク音声をMaster/スピーカーへ接続しない
- [x] マイク音声そのものを録音／保存／アップロードしない
- [x] YIN系の単音ピッチ検出
- [x] 75〜1000Hzの鼻歌／口笛相当レンジを検出
- [x] MIDIノート番号／音名へ変換
- [x] ビブラート時の過剰なノート切替を抑えるヒステリシス
- [x] ノート開始／終了／長さ／Velocity相当を記録
- [x] 録音最大2分、最大512ノート
- [x] 現在の音色で録音データを試聴
- [x] 「自分のサンプル演奏」登録欄へ取り込み

## v0.5.0 Grand Piano + Custom Performance Library

- [x] PCM Grand Piano / Hammer / Damper / Resonance
- [x] フレットレスFinger Noise強化
- [x] ギター和音のDown / Up Stroke 16〜28ms
- [x] ユーザー登録サンプル演奏（localStorageのみ）
- [x] Sample Performanceジャンル拡張

## v0.4.x Electric Guitar / Routing / Output Level

- [x] PCM Electric Guitar + Clean / Crunch / High Gain / Acoustic Amp
- [x] WaveShaper Drive / Tone / Presence / Cabinet / Chorus
- [x] 楽器別Sample routing / Drum UI固定
- [x] Quartal Jazz voicing
- [x] bounded Output Level normalization

## v0.3.0 Multi-engine + Graphical Patch Editor

- [x] `engine_type=synth|sampler|drum|fm`
- [x] PCM Fretless / PCM Drum / DX-style FM EP
- [x] 右側Graphical Patch Editor
- [x] Stable `noteOn()` / `noteOff()` contract

## v0.2.0 Drum Kit
- [x] Drum Patch / Drum Pad / GM系MIDI

## v0.1.x MVP
- [x] Natural-language Patch generation
- [x] Validated/clamped Patch schema
- [x] Polyphonic Web Audio playback
- [x] On-screen keyboard / PC keyboard / optional MIDI
- [x] Patch JSON export/import
