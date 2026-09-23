# Changelog

## v0.13.0

- 7つの基本パートを独立管理するbounded Multi-track ProjectモデルとTrack UIを追加。
- 選択トラックへPreset、Reference Match、自然言語生成、Patch Editor、演奏先を紐付け。
- Sample PerformanceからNote Clipを作成し、16拍タイムラインと読み取り専用ピアノロールで可視化。
- Project JSON保存／読込と、トラック・クリップ・ノート・Patchの読込時Clampを追加。
- クリップ試聴は既存の単一AudioContextと `noteOn / noteOff` 経路を再利用。

## v0.12.2

- Reference Match後に、元プリセットから変化したパラメータを旧値・新値・増減矢印・差分値で一覧表示。
- VST3のMIDIチャンネルを自動／1／10から選択可能にし、SSD5の受信設定差を画面から切り分け可能にした。
- MIDIイベント到達後も出力ピークが0の場合、キット／Preset、Master音量、受信チャンネルを確認する診断案内を追加。
- Native Host C++と通信プロトコルは変更していないため、v0.12.1でビルド済みなら再ビルド不要。

## v0.12.1

- ドラムPatchを外部VST3へ送る際、GMドラム用MIDIチャンネル10を使用。
- サンプル演奏、ドラムパッド、PCキーボードのVST3ドラム発音を修正。
- UIから追加VST3検索フォルダを指定可能にし、VST2 DLL等の非対応形式を診断表示。
- Native Hostプロトコルへbounded MIDI channelを追加。

## v0.12.0
- CC0 1.0のVCSL実録音PCMを使う「スタジオ・テナーサックス」を追加し、出典・上流コミット・原パス・SHA-256を同梱ライセンス文書へ固定。
- Pop Close Piano / Neo Soul FM EP / Pop Pocket Drumsを含む実用プリセットを追加。
- Licensed PCM専用のbounded Patch schemaと、既存AudioContext／Note Eventを再利用する再生Runtimeを追加。
- 全音色パラメータへ日本語ホバー／フォーカス説明を追加し、動的UIを含む未対応操作要素にも説明を補完。
- CC0 PCM、Clamp、同一オリジン読込、単一AudioContext、UI Help副作用なしを検証する回帰テストを追加。

## v0.11.1
- REALISTIC INSTRUMENT PRESETS、SOUND DESIGN音色ライブラリ、Timbre Intent A/B/C候補、Original / Reference Matchで、現在選択中の項目を明るい枠線・背景・軽い発光で強調。
- 選択項目へ `✓ 選択中` バッジと `aria-pressed=true` を付け、後から見ても現在の選択を判別しやすくした。
- プリセットの日本語／English切替、音色ライブラリのカテゴリ切替／検索による再描画後も選択状態を維持。
- 表示層のみの変更とし、AudioContext、Note Event、Reference Audioのローカル限定境界、Patch Clampには変更なし。

## v0.11.0
- REALISTIC INSTRUMENT PRESETSへ「モダン・フュージョン6弦ベース」を追加。速い指弾きでも輪郭が残るAttack、締まった低域、前に出る中高域を重視し、Slide/Mwahは控えめに設定。
- `John Patitucci` / `ジョン・パティトゥッチ` を自然言語で認識し、同じboundedなモダン・フュージョン向けベースPatchを生成可能にした。
- 市販音源の波形やサンプルは同梱せず、ユーザーが手元のM4Aを選択した場合だけ既存Reference Audio Matchで特徴量をローカル解析する境界を維持。
- 開発方針を「自然言語からゼロ生成」中心から **Preset-first + Reference Audio Match + 自然言語微調整** へ変更。
- Step 1へ9種類のREALISTIC INSTRUMENT PRESETSを追加し、自然言語生成を介さず専用楽器Patchを直接適用可能にした。
- 70年代ブリッジ／ウォーム系フレットレス、Concert/Close Grand、Clean Fusion/Acoustic-style Guitar、Dry/Shuffle Drums、Classic FM EPを追加。
- 手元のMP3 / WAV / M4A / AACをブラウザ内だけで解析するReference Audio Matchを追加。
- Reference Audioは最大80MB、解析区間3〜30秒、開始位置指定に対応。
- FFT / RMS / Spectral Flux / Zero Crossing等から明るさ、暖かさ、Transient、Sustain、粗さ、中域、低域Body、Dynamics、空間傾向を抽出。
- 抽出特徴量をFretless / Piano / Guitar / Drum / FM EP / Genericの既存bounded Patchパラメータへマッピング。
- Reference Audioの元波形は再生素材・Factory PCMとして利用せず、アップロード・永続保存・ソース埋め込みを行わない。
- Original preset / Reference Matchの切替と、同じSample PerformanceによるA/B比較を追加。
- 自然言語入力は補助的な選択／微調整用途として維持。
- 既存BlueprintのFactory PCM・単一AudioContext・validated Patch・VST3最終Note Event wrapper等のnon-negotiable invariantsを維持。
- v0.11.0専用回帰テストとREADME手順を追加。

## v0.10.2
- Step 1 SOUND DESIGNに「この音色でサンプル演奏」ボタンを追加し、Step 3までスクロールせず現在音色を試聴可能にした。
- Step 1の試聴は既存 `samplePlayBtn` / Sample Performance経路を再利用し、追加AudioContextや別Note Event経路を作らない。
- 7グループ・45音色すべてに日本語ラベルを追加し、日本語 / English切替で即時に表示を切り替えられるようにした。
- 音色ライブラリのカテゴリ切替／検索による再描画後も選択中の表示言語を維持。
- 各音色ボタンに日本語の音色説明をホバーヘルプとして追加。
- SOUND DESIGN周辺の主要操作ボタンにも日本語ホバーヘルプを追加。
- UI補助層は外部通信、MediaRecorder、localStorage、generated code実行を追加しない。
- READMEへ `v0.10.2 の主な変更` と実録音Multi-sample PCMへの発展方針を追記。

## v0.9.2
- PCM Spectral Resynthesis音色のSample Performanceを、Bass / Pad / Keys / Lead-Brass / Pluck-Bell / Strings-Voiceの役割別に自動切替するよう改善。
- Bass向けにMIDI 28付近まで使う低音グルーヴ／低音オクターブ／ウォーキング／ロングトーンを追加し、低音域で音色を評価できるようにした。
- Padはロングコード／オープン5度／スウェル、Keysはコード／アルペジオ／サステイン、Leadはメロディ／ソロ／ブラス・スタブ、Pluckはアルペジオ／ベル余韻／マレット、Strings-Voiceはレガート／クワイア／ピチカートを選択可能。
- SOUND DESIGNの選択グループを優先し、自由入力ではPromptと生成Patchから評価カテゴリを推定。
- Grand Piano / Electric Guitar / Fretless Bass / Drums / DX EPの既存専用Sample Performanceとユーザー登録フレーズを維持。
- 新しい評価フレーズも既存 `noteOn()` / `noteOff()` 契約のみを使用し、追加AudioContextやネットワーク経路を作らない。
- v0.9.2の役割別サンプル演奏、低音域、ロード順、既存専用楽器ルーティングの回帰テストを追加。
- READMEへ `v0.9.2 の主な変更` と音色確認例を追記。

## v0.9.1
- Step 1 SOUND DESIGNの固定11音色を、7グループ・45音色のカテゴリ選択／検索可能なライブラリへ拡張。
- ライブラリ候補は専用の別音源経路を作らず、自由入力と同じ自然言語生成経路を利用。
- 自然言語解析を単一カテゴリ中心から、明暗・暖冷・硬軟、Attack、長さ、空間、広がり、Air/Noise、Metal/Wood、Organic/Digital、Rough/Clean、Thickness等の連続的な音色軸へ拡張。
- Bell + Padなど複数カテゴリを含む文章では、副カテゴリのAttack / Sustain / Transient等も保持するよう改善。
- 「ピアノのようなPad」「ギター弦を混ぜたBell」などでは実楽器名をPCM参照元ヒントとして解釈し、明示的なGrand Piano / Guitar / Fretless / Drums / DX EPは従来の専用音源を維持。
- 氷 / 鋼 / ガラス / 木質 / 煙 / 霧 / 風などの比喩語をboundedな音色軸へマッピング。
- v0.9.1のSOUND DESIGNライブラリ／自然言語意味軸／専用音源ルーティング互換性の回帰テストを追加。
- READMEへ `v0.9.1 の主な変更` と新しいSOUND DESIGN操作方法を追記。

## Unreleased
- 画面を「音色を作る → 音源を選ぶ → 演奏・試聴 → 録音する」の操作順へ再構成し、上部に4ステップのガイドを追加。
- VST3設定を「音源を選ぶ」、Sample Performanceとライブ鍵盤／ドラムを「演奏・試聴」へ整理。
- PCキーボード演奏録音と鼻歌録音を1つの **RECORDING STUDIO** に統合し、2つのタブで切り替えるUIを追加。
- RECORDING STUDIOのタブ切替はUIのみを制御し、既存のNote Event、AudioContext、マイク解析、VST3ルーティング経路を変更しない。
- PCキー録音の最大120秒／512ノート、ピアノロール、再生／クリアと、鼻歌のキー補正／タイミング補正／楽譜／フレーズ転送を維持。
- VST3本体EditorボタンをHTMLへ明示配置し、「音源を選ぶ」からアクセスできるよう整理。
- Workflow UI / Unified Recording Studio用の回帰テストを追加。
- READMEへ `v0.8.1 の主な変更` と新しい基本操作を追記。
- VST3を再ロードした直後でも、診断ボタンを押さずにPCキー A/W/S/E/D… で演奏できるよう、非同期ロード／パラメータ再構築後のフォーカス復元を強化。
- 同じVST3を再ロードした場合、直前のVST3ルーティングON状態を復元するよう改善。
- ロード済みの同一VST3インスタンスに対して、Native HostからVST3本来のEditor Windowを開く機能を追加。Preset Browserやプラグイン固有の音色UIを利用可能にした。
- VST3 Editorは `IEditController::createView(kEditor)` / `IPlugView` をWindows HWNDへattachし、`IComponentHandler` でUI上のParameter/Preset変更を現在のAudio Processorへ反映。
- 独自Editorを持たないVST3では、従来の汎用Parameter / Program UIを引き続き利用。
- 自然言語の減算シンセ音色に String Ensemble / Synth Brass / Airy Choir Pad / Retro Polysynth / Resonant Acid Bass / Analog Synth Keys を追加。
- warm / bright / dark / wide / dry / spacious等の表現を、新しい音色アーキタイプへbounded modifierとして反映。
- 新音色は一般的なサウンドデザイン原則を参考にしたオリジナルのパラメータレシピのみを使用し、第三者Preset／録音／実行コード／ランタイムのネットワーク取得は行わない。
- VST3 reload / Native Editor / timbre variation用の回帰テストを追加。
- VST3ルーティングON直後やVST3パラメータ操作後でも、PCキー A/W/S/E/D… で演奏へ戻れるようフォーカス処理を改善。
- VST3が公開する離散Program/Preset相当パラメータを検出し、専用の音色セレクターと前後ボタンから切り替えられるUIを追加。
- オンスクリーン鍵盤を立体感のある白鍵／黒鍵、ノート名、ショートカット表示、発音時のハイライトへ刷新。
- PCキーボード演奏のノートイベント録音を追加。最大120秒／512ノートまで、録音・停止・再生・クリアが可能。
- 録音内容をブラウザ内のピアノロールとして表示し、再生は既存 `noteOn()` / `noteOff()` 契約を使うためVST3ルーティングにも対応。
- 録音機能はAudioContextを追加せず、音声データを録音・保存・アップロードしない。
- Keyboard/VST3 Program/Recording用の回帰テストを追加。

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
- VST3については、ブラウザ内直接ロードではなく将来のWindowsネイティブVST3ホスト／ブリッジ境界としてBlueprintへ方向性を追加。
- Humming Capture用の回帰テストとHarness不変条件を追加。

## v0.5.0
- `grand_piano` 楽器モデルを追加し、グランドピアノ要求をPCMサンプラーへ自動振り分け。
- Factory Grand Piano PCMをブラウザ内で決定論的に生成し、複数ルート音 + Playback Rateで演奏する方式を追加。
- グランドピアノに Hammer Attack / Damper Release / String & Soundboard Resonance / Tone / Softness / Sustain / Velocity Curve / Room を追加。
- グランドピアノ用グラフィカルPatch Editorと、クラシック／バラード／ポップ／ジャズ／ブギウギのサンプル演奏を追加。
- フレットレスベースのFinger NoiseとAttack PCM既定値を引き上げ、指弾きを明示した要求では `finger_noise_mix >= 0.82` / `sample_attack_mix >= 0.60` とした。
- ギター和音のサンプル演奏でDown/Up Strokeを導入し、スタイルに応じて各構成音を16〜28msずつずらして発音。
- ギターの発音ずらしは既存 `noteOn` / `noteOff` の `whenSeconds` のみを使い、新しい音源経路を作らない設計とした。
- SAMPLE欄にユーザー独自フレーズの登録／削除UIを追加。音名またはMIDI番号、拍数、Velocity、休符を入力可能。
- 登録フレーズは現在の楽器モデルへ紐付け、ブラウザの `localStorage` にのみ保存。GitHubやサーバーへ送信しない。
- 登録フレーズを最大50件、1フレーズ128ステップ、BPM 40〜240、拍数0.125〜8、Velocity 0.05〜1.0、MIDI 0〜127に制限。
- 内蔵サンプル演奏を拡充し、Pop / EDM / Ambient / Funk / Fusion / City Pop / Classical / Boogie / Blues / Bossa Nova等を追加。
- Grand Pianoを既存の出力レベル正規化対象へ追加し、Master Gain上限を迂回しない設計を維持。
- Piano / Fretless Finger Noise / Guitar Strum / Custom Phrase / Expanded Genres用の回帰テストとHarness不変条件を追加。

## v0.4.2
- 音源モデルごとの聴感上の音量差を小さくする出力レベル補正を追加。
- `generic / fretless_bass / studio_drums / dx_ep / electric_guitar` ごとに限定範囲（0.82〜1.22）のVelocity補正を適用。
- 暗いFilter設定のシンセ、Clean/Acoustic/High Gainギターについて追加の小さな補正を行い、Patch間の音量差も緩和。
- 最終出力段に穏やかな `DynamicsCompressor` を追加し、大きい音色・和音だけを抑えて音量感を揃えるようにした。
- 既存の `master_gain <= 0.35` は変更せず、Make-up Gainも追加しないため、Master Gainの安全上限を迂回しない設計を維持。
- FMエレピのジャズ・ボイシングを3度系の堆積から4度堆積へ変更。
- ギターのジャズ・コンピングも4度堆積へ変更。
- 4度堆積コードは共通 `quartalVoicing()` で生成し、隣接音を常に完全4度（5半音）、4声で構成。
- 出力レベル補正、Master Gain上限維持、単一音源経路、4度堆積ジャズ・コードの回帰テストとHarness不変条件を追加。

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
- Factory PCMは外部アーティスト録音を使わずブラウザ内で生成したPCMバッファをAudioBufferSourceNodeで再生する方式とした。
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
