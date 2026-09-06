# Changelog

## v0.2.0
- 自然言語から `engine_type=drum` のドラムPatchを生成できるようにした。
- Rosanna / Porcaro / shuffle / シャッフル系の要求を `drum_style=half_time_shuffle` として認識。
- Kick / Snare / Closed Hat / Open Hat / 3 Toms / Crash / Ride の合成ドラム音源を追加。
- ドラムPatchではピアノ鍵盤を自動的にドラムパッドへ切り替えるUIを追加。
- PCキーボードおよびGM系MIDIドラムノートに対応。
- ドラム用サンプル演奏としてハーフタイム・シャッフルとストレート・ドラムを追加。
- ドラムモードでも既存の単一AudioContextと `noteOn()` / `noteOff()` 契約を共有する回帰テストとハーネスを追加。

## v0.1.1
- 現在の音色を使ったサンプル演奏機能を追加。
- メロディ、コード、ベースラインの3種類を選択可能。
- サンプル演奏の停止操作を追加。
- サンプル演奏は既存の `noteOn()` / `noteOff()` 契約のみを使用し、別の音源経路を作らないようハーネスと回帰テストを追加。

## v0.1.0
- Initial MVP.
- Natural-language descriptions generate deterministic synth patches offline.
- Browser Web Audio engine supports polyphonic playing from mouse, PC keyboard, and optional MIDI input.
- Patch JSON can be exported/imported.
- Added harness blueprint, invariant checks, and regression tests.
