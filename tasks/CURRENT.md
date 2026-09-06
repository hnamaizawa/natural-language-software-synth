# CURRENT

## v0.3.0 Multi-engine + Graphical Patch Editor

- [x] `engine_type=synth|sampler|drum|fm` へPatchスキーマ拡張
- [x] フレットレスベース自然言語のPCM sampler判定
- [x] Finger Attack / Release / SlideのPCM articulation layer
- [x] Nearest-root PCM note selection + playback-rate pitch shift
- [x] Fretless Mwah / Tone / Velocity Curveパラメータ
- [x] ドラムをPCM one-shot playbackへ移行
- [x] Snare velocity layer
- [x] Rosanna / Porcaro / half-time shuffle判定を維持
- [x] DX-7 / DX7 / FMエレピ自然言語のFM engine判定
- [x] FM Index / Operator Ratio / Decay / Release / Chorus
- [x] 音源別サンプル演奏（Fretless / FM EP / Drum / Synth）
- [x] 右側のグラフィカルPatch Editor
- [x] スライダー + 円形メーター + Select
- [x] 音源タイプに応じた編集項目の自動切替
- [x] パラメータ変更の即時反映
- [x] 生成値へ戻す機能
- [x] 全エンジンで単一AudioContext維持
- [x] 既存 `noteOn()` / `noteOff()` 契約の維持
- [x] PCM / FM / graphical editor回帰テスト
- [x] Blueprint / Harness / README / Changelog更新

## v0.2.0 Drum Kit

- [x] `engine_type=synth|drum` のPatchスキーマ拡張
- [x] 一般的なドラム自然言語の認識
- [x] Rosanna / Porcaro / shuffle / シャッフル系プロンプトの `half_time_shuffle` 判定
- [x] ドラムPatch時のピアノ鍵盤 → ドラムパッド自動切替
- [x] ドラム用PCキーボード割当
- [x] GM系MIDIドラムノートの正規化
- [x] ハーフタイム・シャッフル / ストレート・ドラムのサンプル演奏
- [x] 既存 `noteOn()` / `noteOff()` 契約の維持

## v0.1.1 Sample Performance

- [x] 現在のSynthPatchを使ったサンプル演奏
- [x] メロディ / コード / ベースラインサンプル
- [x] 再生停止操作
- [x] 手動鍵盤/MIDI開始時のサンプル停止

## v0.1.0 MVP

- [x] Natural-language to patch generation
- [x] Deterministic offline prompt engine
- [x] Validated/clamped patch schema
- [x] Polyphonic Web Audio playback
- [x] On-screen piano keyboard
- [x] PC keyboard performance
- [x] Optional Web MIDI input
- [x] Patch JSON export/import
- [x] Stable note event boundary for future sequencer
- [x] Harness and regression tests
