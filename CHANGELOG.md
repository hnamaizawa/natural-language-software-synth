# Changelog

## v0.4.1
- v0.4.0のギター拡張が全Patchに存在する `guitar_amp_model` 既定値をギター判定に使っていたため、ドラム・FMエレピ・フレットレスまでギターへ再判定される問題を修正。
- ギター判定を明示的な `instrument_model=electric_guitar` のみに限定。
- サンプル演奏の選択を `engine_type` 中心から `instrument_model` 中心へ統一し、各楽器専用の演奏へ切り替えるruntimeを追加。
- フレットレスベース: 「フレットレス・歌うフレーズ」「ジャズ・ウォーキングベース」を追加。
- FMエレピ: 「FMエレピ・コード」「ジャズ・エレピ・ボイシング」を追加。
- ドラム: 「ハーフタイム・シャッフル」「ストレート・ドラム」「ジャズ・スウィング」を追加。
- エレキギター: 「ロック・リフ」「フュージョン・フレーズ」「アコースティック・アルペジオ」「ジャズ・コンピング」を選択可能にした。
- 減算シンセ: シンセ向けメロディ／コードに加え「ジャズ・シンセリード」を追加。
- ドラムPatchでは `studio_drums` または `engine_type=drum` をドラム表示条件とし、鍵盤UIへ戻らないようにした。
- PCキーボード割当も同じドラム判定を利用し、ドラムUI表示と演奏キーの不整合を防止。
- すべての新しいサンプル演奏は既存の `noteOn()` / `noteOff()` 契約のみを使用し、別AudioContextや別音源を作らない。
- 楽器別サンプル、ジャズ5系統、ギター誤判定、ドラムUI固定の回帰テストとHarnessチェックを追加。

## v0.4.0
- エレキギター要求をPCMサンプラーへ自動振り分けし、`instrument_model=electric_guitar` を追加。
- Factory Guitar PCMを決定論的な弦モデルからローカル生成し、複数ルート音を `AudioBufferSourceNode` で再生する方式を追加。
- Pick Attack / Release Noise / Palm Mute / Sustain / Body ToneをギターPatchパラメータとして追加。
- Clean / Crunch / High Gain / Acoustic のアンプモデルを追加。
- `WaveShaper` によるDrive、Amp Tone、Presence、Cabinet、Chorusを追加し、アンプ歪みに対応。
- 右側のグラフィカルPatch Editorでギター／アンプパラメータをリアルタイム編集可能にした。
- ギター用サンプル演奏として「ロック・リフ」「フュージョン・フレーズ」「アコースティック・アルペジオ」を追加。
- ギター音源も既存の単一AudioContextと `noteOn()` / `noteOff()` 契約を共有。
- Factory Guitar PCMに外部録音を埋め込まず、将来ライセンス済み実録音PCMへ差し替え可能な境界を維持。
- PCMギター、アンプ歪み、3種類のギターサンプル演奏用の回帰テストとハーネス不変条件を追加。

## v0.3.0
- 音源を `synth / sampler / drum / fm` の4エンジン構成へ拡張。
- フレットレスベース要求をPCMサンプラーへ自動振り分けし、Attack / Release / SlideのノイズレイヤーとMwah表現を追加。
- ドラム音源をノートごとのリアルタイム合成からPCM one-shot再生方式へ変更し、VelocityによるSnare差を追加。
- DX-7 / DX7 / FMエレピ要求を専用FMエンジンへ振り分ける機能を追加。
- FM Index / Operator Ratio / Decay / Release / ChorusをPatchパラメータとして追加。
- 画面右側にスライダーと円形メーターによるグラフィカルPatch Editorを追加。
- 音源タイプに応じて編集項目を自動切替し、変更値を即時反映。
- 「生成値へ戻す」で直前に生成／読込したPatchへ戻す機能を追加。
- Factory PCMは外部アーティスト録音を使わず、ブラウザ内で生成したPCMバッファをAudioBufferSourceNodeで再生する方式とした。
- PCM / FM / graphical editor用の回帰テストとハーネス不変条件を追加。

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
