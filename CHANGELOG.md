# Changelog

## v0.7.0
- 鼻歌録音後にMajor / Natural Minorの24候補からキー／スケールを自動推定する機能を追加。
- キー推定はノート長とPitch Confidenceを重みとして評価し、スケール外の音だけを最大3半音以内の近傍スケール音へ補正。
- 「キー／スケールを自動補正」をデフォルトONとし、必要に応じてユーザーがOFFにできるようにした。
- 鼻歌の開始位置／長さからBPM 60〜180と1/8・1/16・1/32グリッドを比較して、自動テンポ／音符クォンタイズを追加。
- BPMまたは量子化をユーザーが手動変更した場合は自動タイミング補正を解除し、明示値を優先。
- 補正・量子化後のノートイベントからSVG五線譜を描画。音域に応じたTreble/Bass clef、4/4、小節線、休符、シャープ、推定キー／BPM表示を追加。
- Windows Native VST3 Hostを追加。ブラウザは`.vst3`を直接ロードせず、既存Python loopback serverから別プロセスの`nlss_vst3_host.exe`を操作する構成とした。
- Windows標準VST3パスと任意の`NLSS_VST3_PATHS`を検索し、ブラウザにはスキャン済みのopaque IDだけを公開。ロードはスキャン済みIDに限定。
- VST3 Note On / Note Off / Velocity、パラメータ列挙、正規化0〜1パラメータ変更に対応。
- `web/vst3_runtime.js`を最終Note Event境界へ追加し、鍵盤、PCキー、Web MIDI、サンプル演奏、ギターストラム、鼻歌試聴をVST3へルーティング可能にした。
- VST3 routing OFF時は従来のWeb Audio音源経路をそのまま利用。
- Steinberg VST3 SDK 3.8.1 (`3cdf9ca...`) と miniaudio 0.11.25 (`9634bed...`) をcommit SHA固定。
- `build_vst3_host.cmd`を追加し、Visual Studio 2022 x64 + CMakeでNative Hostをビルド可能にした。
- GitHub ActionsへWindows Native VST3 Hostの実ビルドジョブを追加し、Python pytest/Harnessと併せて回帰確認するようにした。
- Humming Assist / Score / VST3用の回帰テスト、Blueprint、Harness、README、AGENTS、CURRENTを更新。

## v0.6.0
- マイクへ歌った単音の鼻歌／口笛を、MIDIノート相当の音程データとして録音する機能を追加。
- `navigator.mediaDevices.getUserMedia()` で取得したマイクを既存 `engine.ctx` の `MediaStreamSource` / `AnalyserNode` へ接続し、別AudioContextを作らない設計とした。
- マイク音声はスピーカーへ返さず、`MediaRecorder` 等で録音せず、サーバー／GitHubへ送信しないローカル解析のみとした。
- YIN系の単音ピッチ検出を追加し、75〜1000Hz、最低Confidence 0.72で音程を判定。
- 検出音程をMIDI番号／音名へ変換し、ノート開始・終了・長さ・Velocity相当を最大512ノート、最大2分まで記録。
- ビブラート時に半音境界を細かく行き来しすぎないよう、安定判定とヒステリシスを追加。
- 鼻歌の長さをBPMに基づいて1/8・1/16・1/32音符へ量子化し、休符を含むCustom Phrase形式へ変換。
- 検出結果を現在の音色で `noteOn()` / `noteOff()` 経由で試聴可能にした。
- 「登録フレーズへ取り込む」で既存のユーザー登録サンプル演奏欄へ転記し、その後localStorageへ保存できるようにした。
- 鼻歌録音UI、マイク権限エラー表示、リアルタイム音名／MIDI番号／Hz／cent／Confidence表示を追加。
- Humming Capture用の回帰テストとHarness不変条件を追加。

## v0.5.0
- `grand_piano` 楽器モデルを追加し、グランドピアノ要求をPCMサンプラーへ自動振り分け。
- Factory Grand Piano PCMをブラウザ内で決定論的に生成し、複数ルート音 + Playback Rateで演奏する方式を追加。
- グランドピアノに Hammer Attack / Damper Release / String & Soundboard Resonance / Tone / Softness / Sustain / Velocity Curve / Room を追加。
- グランドピアノ用グラフィカルPatch Editorと、クラシック／バラード／ポップ／ジャズ／ブギウギのサンプル演奏を追加。
- フレットレスベースのFinger NoiseとAttack PCM既定値を引き上げ、指弾きを明示した要求では `finger_noise_mix >= 0.82` / `sample_attack_mix >= 0.60` とした。
- ギター和音のサンプル演奏でDown/Up Strokeを導入し、スタイルに応じて各構成音を16〜28msずつずらして発音。
- SAMPLE欄にユーザー独自フレーズの登録／削除UIを追加し、登録フレーズはブラウザの `localStorage` にのみ保存。
- 内蔵サンプル演奏を拡充し、Pop / EDM / Ambient / Funk / Fusion / City Pop / Classical / Boogie / Blues / Bossa Nova等を追加。

## v0.4.2
- 音源モデルごとの聴感上の音量差を小さくする出力レベル補正を追加。
- 最終出力段に穏やかな `DynamicsCompressor` を追加し、Master Gain上限を迂回しない設計を維持。
- FMエレピ／ギターのジャズコードを4度堆積へ統一。

## v0.4.1
- ギター判定を明示的な `instrument_model=electric_guitar` のみに限定し、他楽器がギターへ誤判定される問題を修正。
- 楽器別Sample Performance routing、Drum UI/PC Keymap固定、各楽器のJazzサンプルを追加。

## v0.4.0
- PCMエレキギターと Clean / Crunch / High Gain / Acoustic Amp Modelを追加。
- `WaveShaper`によるDrive、Tone、Presence、Cabinet、Chorusを追加。
- ロック／フュージョン／アコースティックのギターSample Performanceを追加。

## v0.3.0
- 音源を `synth / sampler / drum / fm` の4エンジン構成へ拡張。
- PCM Fretless / PCM Drum / DX-style FM EPを追加。
- 右側にGraphical Patch Editorを追加。

## v0.2.0
- Natural-language Drum Patch、Drum Pad、GM系MIDI、Half-time Shuffle / Straight Drum Sampleを追加。

## v0.1.1
- 現在の音色を使ったSample Performanceと停止操作を追加。

## v0.1.0
- Initial MVP.
- Natural-language descriptions generate deterministic synth patches offline.
- Browser Web Audio engine supports polyphonic playing from mouse, PC keyboard, and optional MIDI input.
- Patch JSON can be exported/imported.
- Added harness blueprint, invariant checks, and regression tests.
