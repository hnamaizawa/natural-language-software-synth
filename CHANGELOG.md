# Changelog

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
