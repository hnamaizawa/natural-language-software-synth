# CURRENT

## v0.5.0 Grand Piano + Custom Performance Library

- [x] グランドピアノ自然言語のPCM sampler判定
- [x] `instrument_model=grand_piano` Patchモデル
- [x] 複数ルート音のFactory Grand Piano PCM
- [x] `AudioBufferSourceNode` によるGrand Piano PCM再生
- [x] Hammer Attack / Damper Release
- [x] String / Soundboard Resonance
- [x] Tone / Softness / Sustain / Velocity Curve / Room
- [x] グランドピアノ用グラフィカルPatch Editor
- [x] DX/FMエレピとのルーティング競合防止
- [x] フレットレスFinger Noise既定値の強化
- [x] 指弾きプロンプトのFinger Noise / Attack PCM追加強化
- [x] ギター和音のDown / Up Stroke
- [x] ギター和音の構成音を16〜28msずつずらして発音
- [x] Strum timingを既存 `whenSeconds` Note Event契約で実装
- [x] ユーザー登録サンプル演奏UI
- [x] 音名 / MIDI番号 / 休符 / 拍数 / Velocity入力
- [x] 登録フレーズを現在の楽器モデルへ紐付け
- [x] `localStorage` のみへ保存し、サーバー／GitHubへ送信しない
- [x] 登録フレーズ削除
- [x] 登録件数／ステップ／BPM／拍／Velocity／MIDIノートをBound
- [x] Synth: Pop / EDM / Ambient追加
- [x] Fretless: Funk / Fusion / Ballad追加
- [x] FM EP: City Pop / Fusion / Ballad追加
- [x] Grand Piano: Classical / Ballad / Pop / Jazz / Boogie追加
- [x] Drums: Rock / Funk / Fusion / Bossa Nova追加
- [x] Guitar: Blues / Funk / Pop / Bossa Nova追加
- [x] Grand Pianoを出力レベル正規化へ追加
- [x] 単一AudioContext維持
- [x] Master Gain / Polyphony上限維持
- [x] 既存v0.4.2の楽器別routing / Drum UI / Quartal Jazz / Output Level invariants維持
- [x] Regression tests / Blueprint / Harness / README / Changelog更新

## v0.4.2 Output Level + Quartal Jazz

- [x] 楽器別のbounded Velocity Trim
- [x] 最終段のgentle DynamicsCompressor
- [x] Master Gain上限を迂回しない
- [x] FM EP / Guitarのジャズコードを4度堆積へ統一

## v0.4.1 Instrument-specific Samples + Jazz

- [x] 明示的な `instrument_model` によるサンプル演奏routing
- [x] 非ギターPatchのギター誤判定修正
- [x] Drum PatchのドラムUI / PC Keymap固定
- [x] Synth / Fretless / FM EP / Drum / GuitarへJazzサンプル追加

## v0.4.0 Electric Guitar + Amp

- [x] エレキギター自然言語のPCM sampler判定
- [x] `instrument_model=electric_guitar` Patchモデル
- [x] 複数ルート音のFactory Guitar PCM
- [x] `AudioBufferSourceNode` によるギターPCM再生
- [x] Pick Attack / Release Noise
- [x] Palm Mute / Sustain / Body Tone
- [x] Clean / Crunch / High Gain / Acoustic アンプモデル
- [x] `WaveShaper` によるアンプDrive / Distortion
- [x] Amp Tone / Presence / Cabinet / Chorus
- [x] ギター／アンプ用グラフィカルPatch Editor
- [x] ロック / フュージョン / アコースティックのサンプル演奏
- [x] 単一AudioContext維持
- [x] Factory Guitar PCMへ外部録音を埋め込まない

## v0.3.0 Multi-engine + Graphical Patch Editor

- [x] `engine_type=synth|sampler|drum|fm` へPatchスキーマ拡張
- [x] PCM Fretless / PCM Drum / DX-style FM EP
- [x] 右側のグラフィカルPatch Editor
- [x] 全エンジンで単一AudioContext維持
- [x] 既存 `noteOn()` / `noteOff()` 契約の維持

## v0.2.0 Drum Kit

- [x] ドラムPatch / Drum Pad / GM系MIDI
- [x] Half-time Shuffle / Straight sample performance

## v0.1.1 Sample Performance

- [x] 現在のSynthPatchを使ったサンプル演奏
- [x] 再生停止操作

## v0.1.0 MVP

- [x] Natural-language to patch generation
- [x] Validated/clamped patch schema
- [x] Polyphonic Web Audio playback
- [x] On-screen keyboard / PC keyboard / optional MIDI
- [x] Patch JSON export/import
- [x] Stable note event boundary and harness
