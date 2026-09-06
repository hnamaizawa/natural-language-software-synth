# CURRENT

## v0.2.0 Drum Kit

- [x] `engine_type=synth|drum` のPatchスキーマ拡張
- [x] 一般的なドラム自然言語の認識
- [x] Rosanna / Porcaro / shuffle / シャッフル系プロンプトの `half_time_shuffle` 判定
- [x] Kick / Snare / Closed Hat / Open Hat / Low-Mid-High Tom / Crash / Ride の合成
- [x] ドラムPatch時のピアノ鍵盤 → ドラムパッド自動切替
- [x] ドラム用PCキーボード割当
- [x] GM系MIDIドラムノートの正規化
- [x] ハーフタイム・シャッフルのサンプル演奏
- [x] ストレート・ドラムのサンプル演奏
- [x] ドラムPatchパラメータのValidate / Clamp
- [x] 単一AudioContext維持
- [x] 既存 `noteOn()` / `noteOff()` 契約の維持
- [x] Blueprint / Harness / README / Changelog更新

## v0.1.1 Sample Performance

- [x] 現在のSynthPatchを使ったサンプル演奏
- [x] メロディサンプル
- [x] コードサンプル
- [x] ベースラインサンプル
- [x] 再生停止操作
- [x] 手動鍵盤/MIDI開始時のサンプル停止
- [x] 音色生成/JSON読込時のサンプル停止
- [x] 既存 `noteOn()` / `noteOff()` 契約のみを使う回帰テスト
- [x] Blueprint / Harness / README / Changelog更新

## v0.1.0 MVP

- [x] Natural-language to patch generation
- [x] Deterministic offline prompt engine
- [x] Validated/clamped patch schema
- [x] Polyphonic Web Audio playback
- [x] On-screen piano keyboard
- [x] PC keyboard performance
- [x] Optional Web MIDI input
- [x] Patch parameter display
- [x] Patch JSON export/import
- [x] Stable note event boundary for future sequencer
- [x] Harness and regression tests
