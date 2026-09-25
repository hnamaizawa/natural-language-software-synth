# CURRENT

## v0.15.0 Audio playback recovery

- [x] VST3 の通常ロードからフリーズ解除 API への依存を取り除く
- [x] VST3 パートのロード失敗を局所化し、内蔵音源とほかの音源の再生を継続
- [x] フリーズ済みインスタンスへ再接続するときのみ解除
- [ ] GitHub CI pytest／Harness／Windows Native VST3 build

## v0.14.9 Multi-track VST3 CPU reduction

- [x] パート別フリーズ音声のNative実時間録音とWeb Audio再生、VST3休止・解除
- [x] 明示的な同一音源パート共有とProject JSONへの参照保存
- [x] 無音継続後の早期休止と予約イベント保護、ループ境界の時刻固定
- [x] GitHub CI 174 passed／Harness／Windows Native VST3 build

## v0.14.8 Inline VST3 track editor

- [x] 各パート行に VST3 詳細設定・本体画面・パラメータ調整を設置
- [x] 各操作をパート固有の VST3 インスタンスへ送信

## v0.14.7 Per-track VST3 Loading / MIDI Channel Assignment

- [x] 各トラック専用のVST3インスタンスを個別ロード・維持
- [x] STEP 2 のプラグイン切替、他トラック試聴、ソロ／ミュートから設定を保護
- [x] トラック別Native EditorとMIDI空きチャンネル自動選択／手動上書き
- [x] 先読みスケジューラの休符処理、Native単一音源ミックスを軽量化
- [x] ローカル回帰テスト関数171件／JavaScript構文／Harness静的検査（ローカル環境にpytestパッケージなし）
- [ ] GitHub CI pytest／Harness／Windows Native VST3 build

## v0.14.6 Track VST3 Selection / Playback Load

- [x] 各トラック内のVST3一覧で検出済みの異なる音源を指定
- [x] マルチトラックの一括ノート生成を短い先読み予約へ分散
- [x] 共有VST3インスタンス単位でイベントを集約
- [x] 回帰テスト関数168件／JavaScript構文／Harness静的検査（ローカル環境にpytestパッケージなし）
- [ ] GitHub CI の pytest／Harness／Windows Native VST3 build

## v0.14.5 Shared VST3 / SSD5 Drum Routing

- [x] 同じVST3を使うトラックをプラグインID単位の共有インスタンスへ集約
- [x] STEP 2で設定済みのメインVST3／SSD5キットをマルチトラック再生で再利用
- [x] マルチトラックのドラムを自動MIDI Channel 10へ統一
- [x] 異なるVST3の同時再生とboundedインスタンス管理を維持
- [x] 回帰テスト関数166件／JavaScript構文／Harness静的検査（ローカル環境にpytestパッケージなし）

## v0.14.4 Single-host Multi-instance VST3 Performance

- [x] 複数トラックのVST3を単一Native Hostプロセスへ統合
- [x] 全VST3インスタンスで単一Windows音声デバイスを共有
- [x] トラックごとの独立VST3／Preset／MIDIチャンネルを維持
- [x] Native Host内部ステレオミキサーを追加
- [x] Note Off後の余韻を保持した無音インスタンス自動休止
- [x] アレンジVST3イベントをトラック単位で一括送信
- [x] Host負荷／音切れ候補／休止インスタンス診断を追加
- [x] boundedインスタンスID／最大24／スキャン済みID限定を維持
- [ ] `python -m pytest tests/` / Harness 最終確認
- [ ] GitHub Actions Windows Native VST3 build 最終確認

## v0.14.3 Multi-instance VST3 Tracks

- [x] トラックごとに独立したNative VST3 Hostプロセスを割り当て
- [x] 同一／異なるVST3を複数パートで同時利用
- [x] 再生開始前に全VST3トラックのインスタンスを準備
- [x] Note On／OffをboundedトラックインスタンスIDへルーティング
- [x] 最大24インスタンス、スキャン済みローカルID限定を維持
- [x] VST3／マルチトラックRuntimeのキャッシュ識別子をv0.14.3へ更新
- [x] `python -m pytest tests/` / Harness 最終確認（165 passed / HARNESS PASS）
- [ ] GitHub Actions Windows Native VST3 build 最終確認

## v0.14.2 Per-track Renderer / Independent Sources

- [x] 再生開始前に全Note EventをAudioContextへ一括予約
- [x] 再生中のlook-ahead intervalを廃止
- [x] トラックPatchの事前検証・キャッシュ
- [x] アレンジ再生中の鍵盤／ドラムDOM更新を抑止
- [x] VST3予約イベントを単一の時刻順タイマーキューへ集約
- [x] 各トラック行へ内蔵／CD・Reference調整／VST3セレクターを追加
- [x] CD音声は特徴量のみ利用し、元録音を再生素材へ転用しない境界を維持
- [x] `python -m pytest tests/` / Harness 最終確認（161 passed / HARNESS PASS）

## v0.14.1 Multi-track Playback Performance

- [x] ピアノロールDOMと複数パート再生処理を分離
- [x] AudioContext clock基準の内部Note Eventキューを追加
- [x] ノート単位の大量`setTimeout`を単一look-ahead schedulerへ置換
- [x] 再生時のPatch UI再描画を抑止
- [x] `python -m pytest tests/` / Harness 最終確認（160 passed / HARNESS PASS）

## v0.14.0 Per-track Sound Source / Arrangement Loop

- [x] 各トラックにTRACK SOUND設定UIを追加
- [x] 内蔵プリセット／自然言語調整／Reference Audio調整／VST3割当を明示
- [x] Sample Performanceを16拍Note Clipへ拡張
- [x] 全トラック同時再生、Mute／Solo、停止、ループを追加
- [x] 内蔵音源と現在ロード中VST3をトラックsourceに従って呼び分け
- [x] `python -m pytest tests/` / Harness 最終確認（159 passed / HARNESS PASS）

## v0.13.1 Multi-track Visibility / Cache Safety

- [x] マージ済みmainに7パート／Note Clip／Timeline／Piano Roll実装が存在することを再確認
- [x] Multi-track CSS／Runtimeへv0.13.1キャッシュ識別子を追加
- [x] Runtime初期化中／完了をProject状態へ表示
- [x] `python -m pytest tests/` / Harness 最終確認（154 passed / HARNESS PASS）

## v0.13.0 Multi-track Project Foundation

- [x] ドラム／ベース／キーボード／ギター／メロディー／コーラス／パッドの7トラック
- [x] トラック単位のvalidated Patch／生成Patch／音源メタデータ保持
- [x] Preset／Reference Match／自然言語調整／演奏を選択トラックへ紐付け
- [x] Sample Performanceからbounded Note Clipを作成
- [x] 16拍タイムラインと選択クリップのピアノロール表示
- [x] Project JSON保存／読込と読込値Clamp
- [x] 単一AudioContext／既存Note Event／VST3最終wrapperを維持
- [x] `python -m pytest tests/` / Harness 最終確認（152 passed / HARNESS PASS）

## v0.12.2 Reference Match Difference / SSD5 Setup Diagnostics

- [x] 元プリセットとReference Matchの変更パラメータを一覧表示
- [x] 旧値・新値・増減方向・差分値を視覚化
- [x] VST3 MIDIチャンネルを自動／1／10から選択可能にする
- [x] MIDI到達・出力0時にSSD5キット／Preset／Master／受信チャンネル確認を案内
- [x] Reference Audioのローカル限定・validated Patch境界を維持
- [x] `python -m pytest tests/` / Harness 最終確認（147 passed / HARNESS PASS）

## v0.12.1 SSD5 Drum Routing / Additional VST3 Scan Folder

- [x] ドラムPatchのNote On/OffをMIDIチャンネル10へ送信
- [x] サンプル演奏・ドラムパッド・PCキーで共通経路を維持
- [x] 追加検索フォルダUIとbounded server scanを追加
- [x] `.dll` / `.exe` を非VST3候補として診断表示
- [x] pytest / harness / Windows Native VST3 build 最終確認（145 passed / HARNESS PASS / CI 2 checks passed）

## v0.12.0 Practical Presets / Licensed PCM / Complete Hover Help

- [x] 実用プリセットを4種類追加
- [x] VCSL CC0テナーサックスPCMを同梱
- [x] 出典・上流コミット・原パス・SHA-256を固定
- [x] Licensed PCM PatchをPython／ブラウザ双方でClamp
- [x] 既存AudioContextとnoteOn／noteOffを再利用
- [x] 全音色パラメータに日本語ホバー／フォーカス説明を追加
- [x] 動的UIを含むその他の操作要素にも説明を補完
- [x] v0.12.0専用回帰テストを追加
- [x] README / CHANGELOGを更新
- [x] `python -m pytest tests/` / Harness 最終確認（144 passed / HARNESS PASS）

## v0.11.1 Selected Choice Highlight

- [x] REALISTIC INSTRUMENT PRESETSの選択中ボタンを強調表示
- [x] SOUND DESIGN音色ライブラリの選択をカテゴリ切替／検索後も維持
- [x] Timbre Intent A/B/C候補の現在選択を強調表示
- [x] Original / Reference Matchの現在適用中の方を強調表示
- [x] 選択項目へ `✓ 選択中` と `aria-pressed` を付与
- [x] UI表示のみを変更し、AudioContext／Note Event／Reference Audio境界を維持
- [x] v0.11.1専用回帰テストを追加
- [x] README / CHANGELOGを更新
- [ ] `python -m pytest tests/` / Harness / Windows Native VST3 build 最終確認

## v0.11.0 Preset-first + Local Reference Audio Match

- [x] モダン・フュージョン6弦ベースの基準プリセットを追加
- [x] John Patitucci / ジョン・パティトゥッチ表記を自然言語で認識
- [x] 速い指弾き向けの明瞭なAttack／中高域と、控えめなSlide／Mwahをbounded値で設定
- [x] 市販音源は同梱せず、手元のM4Aを既存Reference Audio Matchでローカル解析する方針を維持
- [x] 開発の主軸を自然言語ゼロ生成からPreset-firstへ変更
- [x] REALISTIC INSTRUMENT PRESETSをStep 1先頭へ追加
- [x] Fretless / Grand Piano / Guitar / Drums / FM EPの調整済み基準Patchを自然言語生成なしで直接適用
- [x] 手元のMP3 / WAV / M4A / AACをReference Audioとしてローカル解析
- [x] Reference Audio最大80MB、解析区間3〜30秒、開始位置指定
- [x] 既存 `engine.ctx.decodeAudioData()` を利用し追加AudioContextを作らない
- [x] FFT / RMS / Spectral Flux / Zero Crossingベースの特徴量抽出
- [x] 明るさ／暖かさ／Transient／Sustain／粗さ／中域／低域Body／Dynamics／空間傾向を可視化
- [x] Fretless / Piano / Guitar / Drum / FM EP / Genericごとのbounded Parameter Mapping
- [x] Reference Match結果を必ず既存 `validatePatch()` へ通す
- [x] 参照音声の元波形を音源として利用・保存・アップロード・ソース埋め込みしない
- [x] Original / Reference Match切替
- [x] 同じSample PerformanceによるA/B比較
- [x] 自然言語入力を任意の選択／微調整用途として維持
- [x] v0.11.0専用回帰テストを追加
- [x] READMEへ `v0.11.0 の主な変更` とCD由来MP3をReferenceにする手順・制約を追記
- [x] CHANGELOGへv0.11.0を追記
- [x] 既存Blueprint non-negotiable invariantsを変更せず維持
- [ ] `python -m pytest tests/` / Harness / Windows Native VST3 build 最終確認

## v0.10.2 SOUND DESIGN Preview / Japanese Labels / Hover Help

- [x] Step 1 SOUND DESIGNに現在音色のSample Performance開始ボタンを追加
- [x] Step 3の既存 `samplePlayBtn` を再利用し、上下スクロールなしで試聴可能にする
- [x] 7グループ・45音色すべてに日本語ラベルを追加
- [x] 日本語 / Englishを再生成なしで瞬時に切替
- [x] カテゴリ切替／検索で音色ボタンが再描画されても選択言語を維持
- [x] 音色ボタンへ日本語の音色説明ホバーヘルプを追加
- [x] Step 1周辺の主要操作ボタンへ日本語ホバーヘルプを追加
- [x] UI層は追加AudioContext／ネットワーク／永続化／generated code経路を追加しない
- [x] v0.10.2専用回帰テストを追加
- [x] READMEへ `v0.10.2 の主な変更` と実録音PCMへの発展案を追記
- [x] CHANGELOGへv0.10.2を追記
- [x] 既存Blueprint non-negotiable invariantsを維持
- [ ] `python -m pytest tests/` / Harness / Windows Native VST3 build 最終確認

## v0.9.2 Adaptive Sample Performance by Sound Role

- [x] PCM Spectral Resynthesis音色のSample PerformanceをBass / Pad / Keys / Lead-Brass / Pluck-Bell / Strings-Voiceの役割別へ自動切替
- [x] Bass向けにMIDI 28付近まで使う低音グルーヴ／低音オクターブ／ウォーキング／ロングトーンを追加
- [x] Pad向けにロングコード／オープン5度／アンビエント・スウェルを追加
- [x] Keys / Organ向けにコード／アルペジオ／サステインを追加
- [x] Lead / Brass向けにメロディ／フュージョン・ソロ／ブラス・スタブを追加
- [x] Pluck / Bell向けにアルペジオ／ベル単音余韻／マレット・オスティナートを追加
- [x] Strings / Voice向けにレガート／クワイア・ロングコード／ピチカートを追加
- [x] SOUND DESIGNの選択グループを優先し、自由入力はPrompt + Patchから評価カテゴリを推定
- [x] Grand Piano / Guitar / Fretless / Drums / DX EPの既存専用Sample Performanceを維持
- [x] ユーザー登録Sample Performanceを維持
- [x] 適応型Previewも既存 `noteOn / noteOff` 契約のみを使用し、追加AudioContext／ネットワーク経路を作らない
- [x] v0.9.2専用回帰テストを追加
- [x] READMEへ `v0.9.2 の主な変更` と音色確認例を追記
- [x] CHANGELOGへv0.9.2を追記
- [x] 既存Blueprint non-negotiable invariantsを維持
- [ ] `python -m pytest tests/` / Harness / Windows Native VST3 build 最終確認

## v0.9.1 SOUND DESIGN Library + Semantic Timbre Model

- [x] Step 1 SOUND DESIGNの固定11音色を7グループ・45音色へ拡張
- [x] 音色グループのカテゴリ選択を追加
- [x] 音色名／説明文を対象とする検索を追加
- [x] ライブラリ候補も自由入力と同じ自然言語生成経路を利用
- [x] 自然言語を明暗・暖冷・硬軟・Attack・長さ・空間・広がり・Air/Noise・Metal/Wood・Organic/Digital・Rough/Clean・Thickness等の複数軸へ分解
- [x] Bell + Pad等の複合カテゴリで副カテゴリの特性を保持
- [x] 「ピアノのようなPad」「ギター弦を混ぜたBell」で実楽器名をPCM参照元ヒントとして扱う
- [x] 明示的なGrand Piano / Electric Guitar / Fretless Bass / Drums / DX EPの専用音源ルーティングを維持
- [x] 氷 / 鋼 / ガラス / 木質 / 煙 / 霧 / 風などの比喩語をboundedな意味軸へ反映
- [x] v0.9.1専用回帰テストを追加
- [x] READMEへ `v0.9.1 の主な変更` とSOUND DESIGN操作方法を追記
- [x] CHANGELOGへv0.9.1を追記
- [x] 既存Blueprint non-negotiable invariantsを維持
- [x] `python -m pytest tests/` / Harness / Windows Native VST3 build 最終確認

## v0.8.1 Workflow UI + Unified Recording Studio

- [x] 画面を「音色を作る → 音源を選ぶ → 演奏・試聴 → 録音する」の順へ再構成
- [x] 画面上部に4ステップの操作ガイドを追加
- [x] VST3設定を「音源を選ぶ」へ移動
- [x] Sample Performance / ライブ鍵盤 / ドラムを「演奏・試聴」へ集約
- [x] PCキーボード録音と鼻歌録音を1つの RECORDING STUDIO に統合
- [x] RECORDING STUDIOにPCキーボード／鼻歌の2タブを追加
- [x] 既存のPCキー録音上限・ピアノロール・VST3再生経路を維持
- [x] 既存の鼻歌キー補正・タイミング補正・楽譜・フレーズ転送を維持
- [x] タブ切替runtimeはAudioContext・Note Event・マイク・ネットワーク経路を追加しない
- [x] VST3本体EditorボタンをHTMLへ明示配置
- [x] READMEへ `v0.8.1 の主な変更` と基本操作を追記
- [x] UI構成／録音統合用の回帰テストを追加
- [x] `python -m pytest tests/` / Harness / Windows Native VST3 build 最終確認

## Unreleased - VST3 Reload / Native Editor / Timbre Variations

- [x] VST3再ロード後、診断ボタンを押さなくてもPCキー A/W/S/E/D… で演奏へ戻れるよう非同期ロード後のフォーカスを解放
- [x] 同一VST3を再ロードした場合は既存のVST3ルーティングON状態を復元
- [x] Native Host内の同じロード済みVST3インスタンスに対してVST3本来のEditor Windowを開く経路を追加
- [x] VST3 Editorは `IEditController::createView(kEditor)` / `IPlugView` をWindows HWNDへattach
- [x] VST3 EditorからのParameter/Preset変更を `IComponentHandler` 経由で現在のAudio Processorへ転送
- [x] 独自Editorを公開しないVST3では既存の汎用Parameter / Program UIへフォールバック
- [x] 自然言語音色へ String Ensemble / Synth Brass / Airy Choir Pad を追加
- [x] 自然言語音色へ Retro Polysynth / Resonant Acid Bass / Analog Synth Keys を追加
- [x] warm / bright / dark / wide / dry / space 等の記述を追加音色へbounded modifierとして反映
- [x] 外部Preset／第三者録音／実行コード／ランタイムのネットワーク取得を音色生成へ持ち込まない
- [x] 既存Grand Piano / Fretless / Guitar / Drum / FM等は従来prompt engineへフォールバック
- [x] VST3 reload / native editor / timbre variationの回帰テスト追加
- [x] README / Changelog / Blueprint / Harness更新
- [x] `python -m pytest tests/` / Harness / Windows Native VST3 build 最終確認

## Unreleased - Keyboard / VST3 Program / Recording UX

- [x] VST3ルーティングON後にPCキー A/W/S/E/D… が無反応になるフォーカス問題を改善
- [x] VST3パラメータ操作後もPCキーボード演奏へ戻りやすいようrange controlのフォーカスを解放
- [x] VST3の離散Program/Preset相当パラメータを検出
- [x] VST3音色セレクターと前後Programボタンを追加
- [x] VST3 Program変更は既存のbounded `/api/vst3/parameter` 経路を利用
- [x] オンスクリーン鍵盤を白鍵／黒鍵の立体表示、ノート名、PCキー表示、発音ハイライトへ改善
- [x] PCキーボード演奏のノートイベント録音を追加
- [x] 録音は最大120秒／512ノートに制限
- [x] 録音データの再生／クリアを追加
- [x] 録音内容をブラウザ内ピアノロールで可視化
- [x] 録音再生も既存 `noteOn()` / `noteOff()` 契約を利用し、VST3ルーティングに対応
- [x] 録音機能は追加AudioContext／音声録音／アップロード／永続化を行わない
- [x] 回帰テスト追加

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
- [x] v0.6.0までのBlueprint non-negotiable invariantsをすべて保持してv0.7.0条件を追加
- [x] Regression tests / Blueprint / Harness / README / Changelog更新

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
- [x] 1/8・1/16・1/32量子化
- [x] 休符を含む既存Custom Phrase形式へ変換
- [x] 現在の音色で録音データを試聴
- [x] 試聴は既存 `noteOn()` / `noteOff()` 契約を利用
- [x] 「自分のサンプル演奏」登録欄へワンクリックで取り込み
- [x] マイク権限エラー／未対応ブラウザをUI表示
- [x] 単一AudioContext維持
- [x] Regression tests / Blueprint / Harness / Changelog更新
- [x] Native VST3 Host（v0.7.0で実装）

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
- [x] `WaveShaper` によるAmp Drive / Distortion
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
