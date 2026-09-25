# Natural Language Software Synth

実用的な楽器プリセットを起点に、手元のReference Audioや自然言語で音色を調整し、その場で演奏・比較できるローカル優先のソフトウェア音源です。鍵盤／PCキーボード／Web MIDI／Sample Performance／鼻歌メロディー／Windows VST3 Instrumentに対応しています。

## v0.18.0 の主な変更

- 全パート再生または選択クリップ試聴中、タイムラインの縦線と「再生中 · ○小節 ○拍」で位置を示します。停止すると開始位置に戻ります。表示は既存のAudioContextの再生時刻を読み取り、ノート演奏処理には追加のDOM更新を行いません。
- 「サンプル曲」からポップ（Cメジャー）、フュージョン（Aマイナー）、バラード（Gメジャー）を選び、「8小節の曲を配置」で7パートの共通コード進行を持つクリップを生成できます。現在の全クリップを置換する操作なので、既存クリップがあれば確認ダイアログを表示します。音源割当とVST3音色設定は保持します。作成した曲はProject JSONに保存できます。
- サンプル曲の調性と各小節のコードはノートデータで検査します。VST3を同時に多数演奏するときのCPU負荷は使用するプラグイン・発音数・PC環境に依存し、フリーズや表示追加だけで音切れが解消する保証はありません。ブラウザを再読み込みしてください。Native Hostの再ビルドは不要です。

## v0.17.0 の主な変更

- アレンジメントの曲長を4〜64小節から選択できます。横スクロールする小節目盛りから再生開始位置を選択し、ループの開始・終了小節を指定できます。曲長、再生位置、ループ区間はProject JSONへ保存されます。旧JSONは従来の4小節として読み込めます。
- クリップを曲内の別小節へドラッグまたは開始拍の入力で移動できます。クリップを複製して16拍までのフレーズを並べ、長さを変更できます。ピアノロールのノート強さはスライダーで調整できます。選択クリップ試聴はそのクリップだけを再生します。
- VST3フリーズは従来の42秒上限です。長い曲では該当パートを通常再生するか、曲長やBPMを調整してください。小節単位の編集とMIDI中心の再生が対象で、音声クリップ録音・譜面編集・オートメーション・完全なCubase/Logic互換はまだ含まれません。Native Hostの再ビルドは不要です。ブラウザを再読み込みしてください。

## v0.16.0 の主な変更

- Project JSON 保存時に各パートの VST3 本体から音色状態を取得し、JSON に格納します。再読込時は保存された検索場所から VST3 を再検索してパートへロードし、音色状態を復元します。共有パートは共有元を復元します。音源が見つからない場合や状態を復元できない場合はパート名と理由を表示します。古い JSON に含まれていなかった VST3 内部の音色設定は復元できません。VST3 が状態保存に対応せず取得に失敗した場合は不完全な JSON を出力せずエラーを表示します。1音源の状態は最大8 MiBです。
- タイムラインで空のクリップ作成・複製・削除・ドラッグ移動ができます。ピアノロールで空欄をクリックしてノート追加、ノートをドラッグして音程・位置変更、右端ドラッグで長さ変更、選択ノートの削除、吸着幅と音域の変更、ノート編集の元に戻す・やり直すができます。保存・再生に同じ Note Clip を利用します。フリーズしたパートの編集前はそのパートだけフリーズ解除してください。現在は16拍の範囲です。
- 再生の先読みを0.45秒から0.8秒に広げ、ブラウザの一時的な遅延で MIDI 送信が遅れる場合の余裕を増やします。VST3 自体が CPU を使い切る場合の処理負荷は変わりません。更新後は Native Host を `build_vst3_host.cmd` で再ビルドし、アプリとブラウザを再起動してください。

## v0.15.1 の主な変更

- Native Host の音声処理を 256 フレームから 512 フレーム単位へ変更し、複数 VST3 再生中のプラグイン呼び出しとイベントキュー確認の回数を減らしました。音声バッファが約5.3 ms長くなるため、ライブ演奏時の反応はその分遅くなる可能性があります。音源自体の DSP 負荷が大きい場合、CPU 使用率や音切れを完全には解消できません。
- パートごとの予約 MIDI ノート処理で一時的なメモリ確保を抑えました。編集中は変更する VST3 パートだけ「フリーズ解除」して実時間で確認し、変更していないパートはフリーズしたまま使えます。録音し直すのは変更したパートを再度フリーズする時だけです。
- Native Host を変更したため、アプリを終了してから `build_vst3_host.cmd` を実行し、`start_synth.cmd` で起動してください。ブラウザも再読み込みしてください。複数音源でなお音切れする場合は「VST3診断」の Host負荷と音切れ候補を確認し、VST3 側の発音数や品質設定を下げるか、変更しないパートだけフリーズしてください。

## v0.15.0 の主な変更

- 複数パート再生で一つの VST3 のロードに失敗しても、内蔵音源や読み込めた別の VST3 を再生します。失敗したパート名と理由を画面に表示します。
- 通常の VST3 ロード時にフリーズ解除 API を必須とする処理を撤去しました。実際にフリーズした音源へ再接続するときだけ解除します。
- 更新後はアプリを終了して `start_synth.cmd` で起動し直し、ブラウザも再読み込みしてください。Native Host を v0.14.9 でビルド済みなら再ビルドは不要です。

## v0.14.9 の主な変更

- マルチトラックで VST3 を選択し、「このパートのVST3設定」→「フリーズ（実時間）」を押すと、そのパートの16拍と2秒の余韻を実時間で録音します。完了後は同じ音声を単一 AudioContext から再生し、対象 VST3 の処理を休止します。「フリーズ解除」でノート編集とプラグイン演奏に戻せます。フリーズ中は BPM、音源、MIDI チャンネルを変更できません。音色を変更した場合は解除して再フリーズしてください。録音音声は現在のブラウザセッション内に保持し、再起動・Project JSON再読込後は再フリーズが必要です。最大512ノート／42秒の録音上限があります。
- 同じ VST3 を使うパート同士では、パート内の共有先選択欄で「○○と音色・CPUを共有」を明示的に選択できます。共有中は同じプラグイン本体・キット・MIDI チャンネルを利用して重複した音声処理を減らします。別々の音色を設定したい場合は「独立したVST3」に戻してください。共有は Project JSON に保存できますが、共有先のプラグイン音色データは VST3 自身の状態に依存します。
- ループ開始を前の周回の音声クロック時刻に合わせて先読み予約し、周回ごとのタイマー遅れが累積しないようにします。無音の余韻が0.5秒以上続いた音源は早めに休止します。発音中と音が残っている間は従来の最長4秒の余韻を優先します。フリーズ生成中はそのパートを実時間で演奏するため、完了までCPU負荷が掛かります。
- Native Host を更新しました。`git pull` 後はアプリを終了し、`build_vst3_host.cmd` を実行してから起動してください。ブラウザも再読み込みしてください。

## v0.14.8 の主な変更

- マルチトラック画面の各パート行で「このパートのVST3設定」を展開し、VST3音源の検索・選択、MIDIチャンネル、ロード、VST3本体画面、パラメータをその場で設定できます。選択したパートの専用インスタンスへ設定が送られるため、別パートの音源を変更しても既存の設定画面・演奏を維持します。
- STEP 2 の VST3 は単体演奏用です。曲のパートには各パート行で VST3 を選択し、本体画面でキット・プリセットを設定してください。

## v0.14.7 の主な変更

- 各トラックの TRACK SOUND で VST3 を選ぶと、そのトラック専用インスタンスをロードします。「このトラックにロード」「このトラックのVST3画面」から音色やSSD5キットをトラックごとに設定できます。STEP 2 の音源を切り替えても、別トラックの設定と演奏は維持されます。
- MIDI チャンネルはトラック間で未使用の番号を自動選択します。ドラムは通常 Channel 10 を優先します。必要に応じて各トラックの選択欄から手動設定できます。16チャンネルを使い切った場合は、独立したインスタンス間で番号を再利用します。
- 試聴・ミュート・ソロで他トラックの VST3 を解放せず、次の再生で再ロードを避けます。Native Host の音声ミックスは1音源だけ発音するときの不要な中間バッファ処理を省きます。
- プラグインの数と同時発音数に伴うCPU負荷は残ります。同じVST3を複数トラックで使うと、今回は音色を独立させるためインスタンスごとのCPU処理が必要です。
- Native Host C++ を変更しました。`git pull` 後はアプリを終了し、`build_vst3_host.cmd` を再実行してから起動してください。

## v0.14.6 の主な変更

- TRACK SOUNDに「このトラックのVST3」選択欄を追加しました。「VST3を検索」後、トラックを選択し、音源一覧から各パートへ異なるVST3を割り当てられます。Project JSONにはトラックごとのVST3 IDを保持します。
- 複数パート再生時は16拍の全ノートを一度に生成せず、約0.45秒先までを100ms間隔で順次予約します。共有VST3へ送るイベントもインスタンスごとにまとめ、再生開始時の処理集中を軽減します。
- 同じVST3を複数パートで選ぶ場合はインスタンスとPresetを共有し、別のVST3は独立したインスタンスで同時演奏します。プラグインの音声処理や同時発音そのものに必要なCPU使用量は、音源の種類・設定・PCの性能に依存します。
- Web画面の変更のため、v0.14.4以降のNative Hostがビルド済みなら再ビルド不要です。`git pull` 後はサーバーとブラウザーを再起動してください。

## v0.14.5 の主な変更

- 同じVST3を使う複数トラックは、プラグインインスタンスを共有します。CPU負荷はVST3トラック数ではなく、異なるVST3の種類数に応じて増える構成になりました。
- STEP 2で現在ロードし、キット／Presetを設定したVST3は、そのままマルチトラック再生でも再利用します。SSD5の個別サンプル演奏と全パート再生で別インスタンスになる問題を解消しました。
- VST3 MIDIチャンネルが「自動」の場合、ドラムトラックはマルチトラック再生でもChannel 10、その他のトラックは各トラックの設定チャンネルへ送信します。
- 異なるVST3を指定したトラックは引き続き同時再生できます。同じVST3を共有するトラックではキット／Presetも共有されます。
- Web Runtimeのみの変更です。v0.14.4のNative Hostをビルド済みであれば、`build_vst3_host.cmd` の再実行は不要です。サーバーとブラウザーを再起動してください。

## v0.14.4 の主な変更

- 複数のVST3トラックを、トラック数分のプロセス／音声デバイスではなく、1つのNative Hostプロセスと1つのWindows音声出力で処理します。
- 各トラックのVST3インスタンス、Preset、MIDIチャンネルは独立したまま、Native Host内部で音声をミックスします。
- 発音中または余韻処理中ではないVST3インスタンスは自動休止し、無音トラックの継続的な48kHz処理を抑えます。Note Off後は約4秒間処理を続けるため、一般的なReleaseやリバーブの余韻を保持します。
- 全パート再生では、各ノートを個別HTTP送信せず、トラック単位のboundedイベント列を再生開始時にNative Hostへ一括送信します。ライブ鍵盤は従来どおり低遅延の単発送信です。
- 最大24インスタンス、スキャン済みローカルID、値Clamp、ブラウザーからVST3バイナリを直接扱わない境界は維持します。
- Native Host C++と通信プロトコルを変更したため、`git pull` 後にアプリを終了し、`build_vst3_host.cmd` を再実行してから `start_synth.cmd` を起動してください。
- 「VST3診断」にはHost負荷、音声バッファ処理が期限を超えた回数、休止中インスタンス数も表示されます。

## v0.14.3 の主な変更

- VST3を割り当てた各トラックに、独立したプラグインインスタンスを用意します。同じVST3を複数パートで使う場合も、異なるVST3を各パートへ割り当てる場合も同時再生できます（v0.14.4以降は1つのNative Host内で処理します）。
- STEP 2でVST3を検索し、一覧からプラグインを選択した後、対象トラック行またはTRACK SOUNDの「VST3音源」を選ぶと、そのトラック専用の割り当てとして保存されます。プラグインを変えて同じ操作を繰り返すことで、パートごとに別音源を指定できます。
- 「全パート再生」またはクリップ試聴の開始前に、必要なVST3インスタンスを順番に準備してから全Note Eventを予約します。各ノートはトラックIDで対応するNative Hostへ送られます。
- 同時インスタンス数は最大24、ロード対象は従来どおりローカルスキャンで得たIDだけです。ブラウザーへVST3バイナリをロードすることはありません。
- C++ Native Host本体は変更していないため、v0.12.1以降でビルド済みなら `build_vst3_host.cmd` の再実行は不要です。更新後はサーバーを再起動してください。

## v0.14.2 の主な変更

- 全ノートを再生開始前にAudioContextへ予約し、再生中の25msタイマー処理を廃止しました。各トラックのPatchは開始前に一度だけ検証・キャッシュし、ノートごとのPatch検証と画面操作を行いません。
- 鍵盤／ドラムパッドの発音表示もアレンジ再生中は更新しないため、複数パートで大量のノートが重なる場合のDOM負荷を削減します。
- 各トラック行へ音源セレクターを追加し、内蔵音源、CD/Reference調整音源、VST3音源をパートごとに独立して保持・選択できます。
- CD/Reference調整音源は従来どおり、ユーザーが選択した音声の特徴量だけを各トラック固有の内蔵Patchへ反映します。CD録音そのものを再生素材としてコピー・保存する機能ではありません。
- VST3割り当てはスキャン済みで現在ロード中のプラグインIDをトラックごとに保持します。現在のNative Hostは1インスタンスのため、同時再生できるVST3は同じロード済みインスタンスです。
- VST3の予約送信もノート数分のタイマーを作らず、時刻順の共有キューを1本のタイマーで処理します。
- Native Hostの変更はないため、再ビルドは不要です。

## v0.14.1 の主な変更

- 複数パート再生をピアノロール等のDOM操作から完全に切り離し、内部Note EventキューとAudioContextの高精度クロックで先読み再生します。
- ノートごとに大量の`setTimeout`を作成する方式を廃止し、25ms間隔の単一スケジューラで必要な直近イベントだけを予約します。
- 再生専用の音色切替ではPatch Editor、鍵盤種別、パラメータUIを再描画しないため、多数のノートを同時再生した際の画面のもたつきを抑えます。
- ピアノロールは編集・確認用の表示に限定され、再生情報はbounded Note Eventとして内部的に受け渡します。Native Hostの再ビルドは不要です。

## v0.14.0 の主な変更

- 各トラックを選ぶと、上部の **TRACK SOUND** から内蔵プリセット、自然言語調整、CD等のReference Audio調整、現在ロード中のVST3を割り当てられます。
- CD／MP3／WAV／M4Aは従来どおり音声そのものを音源としてコピーせず、ローカル解析した特徴量で選択トラックの内蔵音色を調整します。
- 「長いSampleをクリップ化」は選択フレーズを繰り返して16拍のNote Clipを作成します。
- 「全パート再生」でMute／Soloを反映しながら全トラックを同時再生でき、「ループ」で16拍を繰り返せます。クリップがない既定7パートには役割別の16拍フレーズを自動作成します。
- VST3トラックはSTEP 2で現在ロードしているスキャン済みVST3を割り当てます。現行ネイティブホストは1インスタンス方式のため、複数の異なるVST3を同時に使う機能は次のネイティブホスト拡張で対応します。
- 既存の単一AudioContext、validated Patch、bounded Note Event、VST3ローカルホスト境界を維持しています。Native Hostの再ビルドは不要です。

## v0.13.0 の主な変更

- ドラム、ベース、キーボード、ギター、メロディー、コーラス、パッドの7トラックを持つProjectを追加しました。
- トラックを選ぶと、既存のPreset、Reference Match、自然言語調整、Patch Editor、ライブ演奏の対象がそのトラックへ切り替わります。
- 各トラックは独立したvalidated Patch、生成時Patch、音源メタデータ、Mute／Solo、Volume／Pan、MIDIチャンネル、Note Clipを保持します。
- 現在選択しているSample Performanceをbounded Note Clipへ変換し、16拍タイムラインとピアノロールで確認できます。
- 選択クリップは共有BPMで試聴でき、従来と同じ `engine.noteOn()` / `engine.noteOff()` を使います。
- 曲全体をProject JSONとして保存・読込できます。読込時は最大24トラック、各64クリップ、各512ノートに制限し、Patchも既存validatorへ通します。
- v0.13.0はマルチトラックのデータ／UI基盤です。複数トラックの同時再生、クリップ直接編集、楽譜編集、オーディオトラック録音は次フェーズで追加します。
- AudioContextは追加せず、既存の単一AudioContextとVST3最終Note Event境界を維持しています。Native VST3 Hostの再ビルドは不要です。

## v0.13.1 の主な変更

### MULTI-TRACK PROJECTが表示されない場合

まずアプリを終了して `git pull` 後に `start_synth.cmd` を再実行してください。v0.13.1以降はマルチトラックCSS／Runtimeにバージョン識別子を付けるため、旧ファイルがブラウザキャッシュから再表示される問題を防ぎます。v0.13.0から初めて更新する場合だけ、開いている画面で `Ctrl + F5` を一度押してください。

## v0.12.2 の主な変更

- Reference Match解析後に、**元のプリセット → Reference Match** の旧値、新値、増減方向、差分値を一覧表示します。
- VST3のMIDIチャンネルを「自動（ドラム=10）」「チャンネル1」「チャンネル10」から選択できます。SSD5が無音の場合はチャンネル1も試してください。
- MIDIイベントが届いているのに出力ピークが0の場合、VST3本体画面のキット／Preset、Master音量、MIDI受信設定を確認する診断案内を表示します。
- SSD5はプラグインのロード後、SSD5本体画面でドラムキットをロードしないと無音になる場合があります。
- Native Host C++は変更していないため、v0.12.1で `build_vst3_host.cmd` を実行済みなら再実行は不要です。

## v0.12.1 の主な変更

- SSD5などのドラムVST3へ、ドラム音色時はGM標準のMIDIチャンネル10（内部値9）でNote On/Offを送信します。
- サンプル演奏、ドラムパッド、PCキーボードのすべてが同じドラムチャンネル経路を利用します。
- VST3検索に任意の追加フォルダを指定できます。例: `C:\Program Files\Kawai`。複数フォルダは `;` 区切りです。
- 追加フォルダに `.dll` / `.exe` しかない場合は、VST3ではない形式として除外件数を表示します。
- Native VST3 Hostを変更したため、更新後に `build_vst3_host.cmd` を再実行してください。

## v0.12.0 の主な変更

- 実用プリセットとして **スタジオ・テナーサックス、ポップ・クローズピアノ、ネオソウルFMエレピ、ポップ・ポケットドラム** を追加しました。
- テナーサックスは VCSL の CC0 1.0 実録音PCMを同梱。上流URL、上流コミット、原ファイルパス、SHA-256を `web/assets/pcm/vcsl/LICENSE.md` に固定し、監査可能にしています。
- CC0 PCMはユーザー操作後に同一オリジンから読み込み、既存の単一 `AudioContext` と `noteOn / noteOff` 境界だけを使用します。
- 音色パラメータは、マウスホバーまたはキーボードフォーカスで日本語の意味と効果を確認できます。
- 動的に生成されるプリセット、鍵盤、ドラムパッド、VST3パラメータを含む操作UIにもホバー説明を補完します。
- 全パラメータは従来どおり validator でClampされます。

### 同梱PCMのライセンス

同梱している `tenor_sax_c3.wav` は [Versilian Community Sample Library (VCSL)](https://github.com/sgossner/VCSL) のCC0公開素材です。市販CD、ユーザーのReference Audio、特定アーティストの録音はPCM素材として取り込んでいません。詳しい出典とハッシュは `web/assets/pcm/vcsl/LICENSE.md` を参照してください。

## v0.11.1 の主な変更

- REALISTIC INSTRUMENT PRESETSとSOUND DESIGN音色ライブラリで、選択した音色を明るい枠線・背景・軽い発光で強調します。
- 選択中のボタンには **「✓ 選択中」** と表示されるため、別の操作をした後でも現在の音色を確認できます。
- Timbre IntentのA/B/C候補と、Reference Audioの「元のプリセット／Reference Match」も同じ考え方で強調します。
- プリセットの日本語／English表示を切り替えても選択は維持されます。
- SOUND DESIGNのカテゴリ変更や検索でボタンが再描画されても、選択した音色が再表示されたときに選択状態が復元されます。
- 音声エンジンやVST3 Native Hostは変更していないため、更新後に `build_vst3_host.cmd` の再実行は不要です。

v0.11.0では、自然言語からゼロベースで音色を作る方式を主役から外し、**リアル楽器プリセット → Reference Audio Match → 必要なら自然言語で微調整**という順序へ変更しました。

## v0.11.0 の主な変更

- REALISTIC INSTRUMENT PRESETSに **「モダン・フュージョン6弦ベース」** を追加。ジョン・パティトゥッチを想起させる、明瞭で速い指弾きアタック、締まった低域、前に出る中高域を一般的な音色特性として設計したオリジナルPatchです。
- 自然言語欄でも `ジョン・パティトゥッチのような6弦フュージョンベース` または `John Patitucci style modern fusion bass` と入力すると、同じ方向のboundedパラメータを生成します。
- このプリセットは第三者の録音やPresetを含みません。手元のM4AをReference Audio Matchへ指定すると、音声そのものではなく抽出した特徴量だけでさらに近づけられます。
- Step 1の先頭に **REALISTIC INSTRUMENT PRESETS** を追加し、自然言語生成を介さず調整済みPatchを直接適用可能にした。
- 基準プリセットとして、70年代ブリッジ・フレットレス、ウォーム・シンギング・フレットレス、コンサート・グランド、クローズ・グランド、クリーン・フュージョン・ギター、アコースティック・ギター、ドライ・スタジオ・ドラム、シャッフル・スタジオ・ドラム、クラシックFMエレピを追加。
- **Reference Audio Match** を追加し、手元のMP3 / WAV / M4A / AACをブラウザ内だけで解析可能にした。
- Reference Audioは最大80MB、解析区間は3〜30秒。開始位置と解析時間を指定できる。
- 解析対象を、現在の音色／フレットレスベース／グランドピアノ／ギター／ドラム／FMエレピ／その他から指定可能。
- Reference Audioから、明るさ、暖かさ、Transient、Sustain、粗さ/Noise、中域の存在感、低域Body、Dynamics、空間/余韻傾向を抽出。
- FFTベースのスペクトル特徴、フレームRMS、Spectral Flux、Zero Crossing等を使ってReference特徴量を算出。
- 抽出した特徴量だけを、各専用音源の既存boundedパラメータへマッピング。元MP3/WAVの波形を音源として再生・コピーしない。
- Reference Match後も必ず既存 `validatePatch()` を通してClamp。
- **元のプリセット / Reference Match** をワンクリックで切替可能。
- 同じSample PerformanceでOriginal / Reference Matchを連続試聴するA/B比較を追加。
- 自然言語入力欄は残し、「任意: 自然言語で音色を選択／微調整」として補助的な役割へ変更。
- Reference Audioはブラウザのメモリ上だけでデコード・解析し、サーバー／GitHub／外部サービスへ送信せず、永続保存もしない。
- 既存のFactory PCM、単一AudioContext、`noteOn / noteOff`、VST3最終ラッパー、第三者録音をFactory PCMへ埋め込まない不変条件は維持。
- Native VST3 Host C++は変更していないため、v0.11.0取得後に `build_vst3_host.cmd` の再実行は不要。

### CDから用意したMP3をReferenceとして使う場合

1. まず、最も近い **REALISTIC INSTRUMENT PRESET** を選びます。フレットレスなら「70年代ブリッジ・フレットレス」などを選択します。
2. Reference Audio Matchで、手元のMP3を選択します。
3. 対象楽器を「フレットレスベース」などへ設定します。
4. 対象楽器がよく聞こえる箇所を開始位置で指定し、10〜20秒程度を解析するのがおすすめです。
5. 「参照音を解析して近づける」を押します。
6. 「元のプリセット」と「Reference Match」を切り替えるか、「同じフレーズでA/B比較」で確認します。
7. 必要なら最後に自然言語で「もう少し暗く」「フィンガーノイズを増やす」など微調整します。

今回の `Paint the World` のM4Aを使う場合は、最初に **「モダン・フュージョン6弦ベース」** を選び、対象楽器を「フレットレスベース」に設定してください。ベースが明瞭な箇所の開始秒と10〜20秒程度の解析時間を指定すると、ミックス全体の影響を抑えやすくなります。ブラウザのファイル選択では、Windows上の次のファイルを選択します。

```text
C:\Users\hnama\Dropbox\backup\data\Music\Chick Corea Elektric Band\Paint the World\01 Paint the World.m4a
```

ミックス済みCD楽曲では、Reference Audio Matchはベースだけを完全分離しているわけではありません。ドラム、ギター、ボーカル等の成分も特徴量へ混ざるため、**対象楽器が単独または目立っている短い区間を指定するほど有効**です。

また、v0.11.0のReference Audioは「音色の目標」として特徴量だけを使います。CD等から取り込んだ録音そのものをFactory PCMへ埋め込んだり、リポジトリへ保存したりはしません。利用するReference Audioは、ユーザー自身が適法に利用できる手元のファイルを使用してください。

### v0.11.0時点での「リアルさ」の限界

Preset-firstへ変更しましたが、内蔵Piano/Guitar/Fretless/DrumのPCM自体は引き続きアプリ内で決定論的に生成したFactory PCMです。したがってReference Matchで音色傾向は近づけられても、実録音Multi-sampleと同じリアルさにはなりません。

次の段階では、ライセンスが明確な実録音Multi-sample WAV/SFZまたはユーザー自身の録音を、ローカルSample Instrumentとして読み込めるようにし、次の要素を追加するのが重要です。

```text
Real Multi-sample WAV / SFZ
    ↓
Key Zone
Velocity Layer
Round Robin
Release Sample
    ↓
Realistic Instrument Preset
    ↓
Reference Audio Match
    ↓
Natural-language fine tuning
```

## v0.10.2 の主な変更

- Step 1 SOUND DESIGNに **「▶ この音色でサンプル演奏」** ボタンを追加。
- Step 3まで上下スクロールせず、現在生成されている音色を選択中のSample Performanceでその場で試聴可能。
- Step 1の試聴ボタンは既存 `samplePlayBtn` を再利用し、新しいAudioContextや別のNote Event経路を作らない。
- 7グループ・45音色すべてに日本語ラベルを追加。
- **日本語 / English** 切替ボタンで、音色名とグループ名を再生成なしで瞬時に切替可能。
- ラベル切替は表示だけを変更し、自然言語Prompt、Timbre Intent、Patch、Sample Performanceには影響しない。
- 音色ライブラリがカテゴリ切替／検索で再描画されても、選択中の表示言語を自動的に再適用。
- 各音色ボタンに日本語ホバーヘルプを追加。音色の特徴と「クリックすると生成される」ことを表示。
- 「音色を生成」「この音色でサンプル演奏」「日本語 / English」「サンプル演奏 / 停止」「生成値へ戻す」などStep 1周辺の操作ボタンにも日本語ホバーヘルプを追加。
- UI補助層は追加AudioContext、外部通信、MediaRecorder、動的コード実行、localStorageを追加しない。
- Native VST3 HostのC++は変更していないため、v0.10.2への更新後に `build_vst3_host.cmd` の再実行は不要。

### よりリアルなPCMを土台にする今後の方向

v0.10.2時点のPCMは引き続きアプリ内で決定論的に生成したFactory PCMです。音色のリアルさをさらに上げるには、ライセンスが明確な実録音Multi-sampleをローカルで扱えるようにするのが有効です。

```text
実録音 WAV / SFZ
   ↓
Key Zone / Velocity Layer / Round Robin / Release Sample
   ↓
PCM Body / Transient / Sustain
   ＋
時間変化するSpectral解析
   ↓
Timbre Intent
   ↓
PCM + Spectral / Granular Resynthesis
```

この方式なら、本物の楽器らしさをPCM側で保ちながら、「もっと木質」「暗く」「アタックを柔らかく」などの自然言語指示を再合成処理へ反映できます。商用サンプルを無断同梱せず、ユーザー自身の録音またはライセンスが明確な素材をローカルImportする設計が適しています。

## v0.10.1 の主な変更

- PCM Spectral ResynthesisのPiano/Guitar参照元を固定1音から、演奏ノートに最も近い **Multi-sample root** へ変更。
- Fretlessも利用可能なPCM regionから演奏ノートに近いrootを選択。
- PCMを単なる倍音解析の教師データだけにせず、**長いPCM Bodyを実際の発音成分として残す**よう変更。
- `PCM Body` が大きいほどPeriodicWave由来のSpectral成分を少し抑え、PCM本体を前に出すHybrid構成に変更。
- PCM Bodyの再生長を従来の短い補助レイヤーから約1.15〜5.5秒の範囲へ拡大し、アタックだけでなく音の胴鳴り・減衰も利用。
- Spectral解析も音域ごとの最寄りPCM rootを使うため、低音／中音／高音で同一の固定スペクトルを使い回しにくくした。
- `spectral_resynth` 内部で `octave_shift` を暗黙適用する方式を停止。実際のMIDIノート番号と発音ピッチを一致させた。
- ライブ鍵盤へ **自動 / -2 / -1 / 0 / +1 / +2 Oct** の演奏音域切替を追加。
- 自動モードではBass / Fretless系を **-1 Oct** にし、低音楽器を自然な音域でPCキーボード／画面鍵盤から試奏可能。
- オクターブ変更は入力MIDIノート自体を変えるため、PCキーボード録音のピアノロール表示と実際の発音音域が一致。
- 従来の `A/W/S/E/D...` PCキーボード演奏はそのまま維持。
- Drum PatchではSample Performance中だけでなく、通常のライブ試奏時も **Drum Padを演奏面として表示**。
- Drum Padは従来どおりマウス操作可能で、さらに **A=Kick / S=Snare / D=Closed Hat / F=Open Hat / G/H/J=Toms / K=Crash / L=Ride** で操作可能。
- PCキーでDrumを鳴らしたとき、対応Padを視覚的にActive表示。
- 追加AudioContext、外部Sample取得、動的コード実行は導入していない。
- Native VST3 HostのC++は変更していないため、v0.10.1への更新後に `build_vst3_host.cmd` の再実行は不要。

### PCM Multi-sample Hybrid Resynthesis の考え方

v0.9.0〜v0.10.0では、Factory PCMを主に倍音解析し、Web Audio `PeriodicWave` が発音の中心でした。v0.10.1ではPCMそのものをより長く残します。

```text
自然言語 / Timbre Intent
        ↓
Source A / Source B
        ↓
演奏ノートに最も近いPCM rootを選択
  ├─ Piano Multi-sample
  ├─ Guitar Multi-sample
  └─ Fretless PCM region
        ↓
PCM Body（長め） + PCM Transient
        ＋
音域別PCMから抽出したSpectral PeriodicWave
        ↓
Morph / Brightness / Noise / ADSR / Delay
        ↓
既存 noteOn / noteOff
```

この方式は、シンクラビア／フェアライト時代の「サンプル／波形を素材として変形・再構成する」という方向を、現在のWeb Audio上で安全に発展させる第一段階です。なお、現在のFactory PCMはアプリ内で決定論的に生成したPCMであり、商用サンプルライブラリの録音は同梱していません。本物の楽器にさらに近づける次段階として、ライセンスが明確なMulti-sample WAV/SFZやユーザー自身の録音を読み込み、同じResynthesis経路へ入れる方式が有力です。

### ライブ鍵盤の音域

Step 3の鍵盤に「演奏音域」を追加しました。

- **自動**: Bass / Fretlessは-1 Oct、その他は0 Oct
- **-2 / -1 / 0 / +1 / +2 Oct**: 手動指定

例えばBassで自動を選ぶと、PCキー `A` から始まる鍵盤自体が1オクターブ下へ移り、画面の音名、録音ピアノロール、実際の発音が同じMIDI音域になります。

## v0.10.0 の主な変更

- 自然言語とDSPの間に **Timbre Intent** 中間層を追加。
- 入力文を、Role / Material / Envelope / Spectrum / Texture / Space / Performance Registerの構造化された音色設計書へ変換。
- Step 1 SOUND DESIGN内に **「自然言語をどう解釈したか」** を表示するパネルを追加。
- 明るさ、暖かさ、木質、金属/ガラス、Air/息、有機感、Attack速度、音の長さ、硬さ、粗さ、太さ、パーカッシブ感、広がり、空間/残響を0〜100%で表示・手動調整可能。
- `かなり / とても / very`、`少し / やや / slightly` の強弱表現と、`ではない / じゃない / not / without` などの否定表現をローカルParserで考慮。
- 1回の自然言語指定から **A: Balanced / B: Organic / C: Experimental** の3候補を生成。
- A/B/Cは単なる名前違いではなく、PCM Body、倍音数、Brightness、Transient、Noise、Detune、ADSR、Delayなどの実際のPatch値を変更。
- PCM Spectral Resynthesisだけでなく、Subtractive Synth / Fretless / Electric Guitar / Grand Piano / FM EP / Drumsでも、利用可能な既存パラメータ範囲内でIntentを反映。
- 候補ボタンを切り替えても、v0.9.2で追加した音色グループ別Sample Performanceの選択を維持。
- **「同じフレーズでA/B/C比較」** を追加し、同じ演奏タイプで3候補を順番に試聴可能。
- **「もっと暗く」「余韻を短く」「木質を強く」** などの差分指示を追加。指定された軸だけを変更し、その他のIntentは維持。
- Intentスライダーを直接変更した場合もA/B/C候補を再計算。
- 生成Patchは従来どおり既存 `validatePatch()` を通してClamp。
- 自然言語をJavaScript/DSPコードとして実行せず、`eval()` / `new Function()` / generated executable codeは使用しない。
- Timbre Intent Engineは追加AudioContext、MediaRecorder、WebAssembly、外部音色サンプル取得を行わない。
- 音色生成時の通信は従来の同一オリジン `/api/generate-patch` のみで、外部LLMや外部AIサービスはv0.10.0では必須にしない。

### Timbre Intent の流れ

```text
自然言語
   ↓
Local Timbre Intent Parser
   ↓
Timbre Intent / 音色設計書
   ├─ Role
   ├─ Material: Wood / Metal / Air / Organic
   ├─ Envelope: Attack / Length
   ├─ Spectrum: Brightness / Warmth / Harmonic Density
   ├─ Texture: Hardness / Roughness / Thickness / Percussive
   └─ Space: Width / Room / Distance
   ↓
A / B / C Candidate Generator
   ↓
既存Patch validator / Clamp
   ↓
PCM Resynthesis / Synth / Sampler / FM / Drum
   ↓
音色カテゴリに合ったSample Performanceで比較
```

### v0.10.0 の使い方

1. Step 1で自然言語を入力します。
2. 「音色を生成」を押すとTimbre Intentパネルが表示されます。
3. Role、木質、明るさ、Attack速度、音の長さなどの解析結果を確認します。
4. 解釈が違う場合はIntentスライダーを修正します。
5. A/B/Cの候補を選びます。
6. Step 3のRole別Sample Performanceで確認します。
7. 必要なら `もっと暗く。余韻だけ少し長く。` のような差分指示を使います。

## v0.9.2 の主な変更

- PCM Spectral Resynthesis音色の役割に応じてSample Performance候補を自動切替。
- Bassは低音グルーヴ、低音オクターブ、ウォーキング、ロングトーンを追加し、最低MIDI 28付近まで利用。
- Pad / Atmosphere、Keys / Organ、Lead / Brass、Pluck / Bell、Strings / Voiceにも用途別評価フレーズを追加。
- SOUND DESIGNグループ選択を優先し、自由入力ではPrompt + Patchから評価カテゴリを推定。
- Grand Piano / Electric Guitar / Fretless Bass / Drums / DX EPの既存専用フレーズとユーザー登録フレーズを維持。

## v0.9.1 の主な変更

- Step 1 SOUND DESIGNを固定11音色から **7グループ・45音色** のカテゴリ選択／検索可能ライブラリへ拡張。
- 自由入力を明暗、暖冷、硬軟、Attack、長さ、空間、広がり、Air/Noise、Metal/Wood、Organic/Digital、Rough/Clean、Thickness等の意味軸へ分解。
- Bell + Padなど複数カテゴリを含む文章で副カテゴリ特性も保持。
- 「ピアノのようなPad」「ギター弦を混ぜたBell」では実楽器名をPCM参照元のヒントとして扱うよう改善。
- 明示的Grand Piano / Electric Guitar / Fretless / Drum / DX EPは専用音源を優先。

## v0.9.0 の主な変更

- **PCM Spectral Resynthesis** を追加。
- Factory Piano / Guitar / Fretless PCMの倍音構造をローカル解析してWeb Audio `PeriodicWave`へ再構築。
- Source A/B、Morph、Harmonics、Brightness、PCM Body、Transient、Detune、Air/Noise、ADSRを追加。
- Pad / Strings / Brass / Choir / Bell / Pluck / Lead / Bass / Organ / KeysをPCM再合成へ拡張。
- 第三者Preset／録音やランタイム外部取得を使わず、既存Factory PCMのみを参照。

## v0.8.1 の主な変更

- UIを「1. 音色を作る → 2. 音源を選ぶ → 3. 演奏・試聴 → 4. 録音する」の操作順へ整理。
- Sample Performanceとライブ鍵盤／ドラムを「演奏・試聴」へ集約。
- PCキーボード演奏録音と鼻歌録音を **RECORDING STUDIO** に統合。

## v0.8.0 の主な変更

- VST3再ロード後のPCキーボードフォーカス復旧を改善。
- 同じロード済みVST3インスタンスのネイティブEditor Windowを表示可能にした。
- VST3 Program/Preset相当パラメータの切替UIを追加。
- VST3サンプル演奏とオンスクリーン鍵盤の発音表示を同期。
- PCキーボード演奏を最大120秒／512ノートのNote Eventとして録音し、ピアノロール表示・再生・クリアに対応。

## v0.7.0 の主な変更

- 鼻歌のキー／スケール自動推定と補正、BPM／クォンタイズ、SVG五線譜。
- Windows Native VST3 Hostを追加。
- VST3検索、ロード、Note On/Off、Velocity、Parameter列挙／変更に対応。

## v0.6.0 の主な変更

- 鼻歌／口笛からMIDIライクな単音メロディーを取得。
- YIN系ピッチ検出、最大120秒／512ノート。
- マイクの生音声は録音・保存・アップロードしない。

## v0.5.0 の主な変更

- Factory PCM Grand Pianoを追加。
- Fretless Finger Noise改善、ギターストローク、ユーザー独自Sample Performance、ジャンル拡張。

## v0.4.2 の主な変更

- 楽器別Velocity TrimとDynamicsCompressorで聴感音量差を緩和。
- FM EP / GuitarのJazzコードを4度堆積へ統一。

## v0.4.1 の主な変更

- 非ギターPatchの誤判定修正。
- 楽器別Jazz Sample Performance。
- Drum PatchのドラムUIとPCキーマップを固定。

## v0.4.0 の主な変更

- Factory PCM Electric GuitarとAmp処理を追加。
- Clean / Crunch / High Gain / Acoustic、Pick / Release / Palm Mute / Cabinet / Chorus。

## v0.3.0 の主な変更

- `synth / sampler / drum / fm` の4エンジンへ拡張。
- PCM Fretless Bass、PCM Drum、DX-style FM EP、Patch Editorを追加。

## v0.2.0 の主な変更

- Studio Drum Kit、Half-time Shuffle / Straight Sample Performance。

## v0.1.1 の主な変更

- 現在のPatchを使うSample Performanceを追加。

## v0.1.0 の主な変更

- 自然言語からvalidated/clamped Patchを生成するMVP。
- Web Audio Polyphonic Synth、オンスクリーン鍵盤、PCキーボード、Optional Web MIDI。
- Patch JSON保存／読込、Harness / Blueprint / Stable Note Event Contract。

# 現在の音源モデル

| 要求する音 | Engine / Model | 主な特徴 |
| --- | --- | --- |
| Pad / Lead / Bell / Pluck / Strings / Brass / Choir / Bass / Keys | `sampler / spectral_resynth` | **最寄りFactory Multi-sample PCM Body + 音域別PeriodicWave + Transient + Morph** |
| 一般的なSubtractive Synth | `synth / generic` | 2 Oscillator + Filter + ADSR + LFO + Delay |
| フレットレスベース | `sampler / fretless_bass` | PCM + Finger/Release/Slide Noise + Mwah |
| エレキギター | `sampler / electric_guitar` | PCM Multi-sample + Pick/Release + Amp + Cabinet + Chorus |
| グランドピアノ | `sampler / grand_piano` | PCM Multi-sample + Hammer + Damper + Resonance + Room |
| 生ドラム系 | `drum / studio_drums` | PCM one-shot + Velocity + Tune / Decay / Room |
| DX系エレピ | `fm / dx_ep` | FM Modulation + Ratio + Chorus |
| 外部音源 | Windows VST3 Instrument | Native VST3 Host経由 |

全内蔵音源とVST3ルーティングは最終的に次のNote Event契約を共有します。

```text
setPatch(validatedPatch)
noteOn(midiNote, velocity, whenSeconds=0)
noteOff(midiNote, whenSeconds=0)
```

# Windowsでの起動

## 初回

```bat
cd C:\temp
git clone https://github.com/hnamaizawa/natural-language-software-synth.git
cd natural-language-software-synth
setup_windows.cmd
check_harness.cmd
start_synth.cmd
```

ブラウザ: `http://127.0.0.1:8765`

VST3も利用する場合だけ初回に `build_vst3_host.cmd` を実行します。

## 2回目以降

```bat
cd C:\temp\natural-language-software-synth
git checkout main
git pull
check_harness.cmd
start_synth.cmd
```

Native VST3 HostのC++が変更されたバージョンのみ `build_vst3_host.cmd` を再実行します。v0.12.1ではMIDIチャンネル対応を追加したため再実行が必要です。

# VST3 Instrument

Step 2でVST3検索／ロード／Editor／Parameter／Program/Preset／ルーティング／診断を利用できます。VST3はブラウザへ直接ロードせず、別プロセスNative Hostを既存loopback server経由で利用します。

標準フォルダ以外へ展開したVST3は「追加検索フォルダ」に入力してから検索します。`C:\Program Files\Kawai` のようなフォルダを指定できます。検出対象は `.vst3` バンドル／ファイルです。`.dll` のみのプラグインはVST2形式の可能性があり、このVST3ホストでは利用できません。

# RECORDING STUDIO

## PCキーボード録音

- 最大120秒 / 512ノート
- 音声ではなくNote Eventを保存
- ライブ鍵盤のオクターブ指定後の**実MIDIノート**を記録
- ピアノロール表示 / 再生 / クリア
- VST3ルーティングON時も同じNote Event経路

## 鼻歌 → メロディー

- マイク生音声は保存しない
- ブラウザ内YIN系単音解析
- Key/Scale補正、BPM / Quantize、SVG五線譜、Custom Phrase転送

# Sample Performanceと自作フレーズ

自作フレーズは `音名/MIDI | 拍数 | Velocity` 形式で、BPM 40〜240、最大128ステップ、最大50フレーズをbrowser `localStorage`へ保存します。

# 安全設計とガードレール

- 自然言語、Timbre Intent、鼻歌結果、ユーザーフレーズをコードとして実行しない
- `eval()` / `new Function()` / generated executable codeを使用しない
- 生成／編集／Import／Reference MatchされたPatchをvalidatorでClamp
- 単一AudioContextと既存 `noteOn / noteOff` 契約を維持
- Reference Audioはユーザーがローカルで選択したMP3/WAV/M4A/AACだけをブラウザメモリ上で解析し、サーバーへ送信しない
- Reference Audioの元波形を永続保存せず、Factory PCMやGitHubソースへコピーしない
- Reference Matchは抽出したbounded特徴量のみを既存Patchパラメータへ反映
- v0.10.2のSOUND DESIGN UXは既存Sample Performance経路のみ再利用し、追加AudioContext／ネットワーク／永続化を作らない
- v0.10.1のPCM Body強化もローカルFactory PCMのみ利用し、ネットワークからSampleを取得しない
- マイク生音声を録音／保存／アップロードしない
- Master Gain / Polyphony / PCM / Guitar / Piano / Drum / FM / Resynthesis値をClamp
- VST3をブラウザプロセスへロードしない
- VST3はスキャン済みローカルIDからのみロード

# 開発時の確認

```bat
python -m pytest tests/
python scripts/harness_check.py
```

または `check_harness.cmd`。VST3ネイティブ側を変更した場合のみ `build_vst3_host.cmd`。

# 今後の方向性

v0.11.0でPreset-firstとReference Audio Matchを導入したため、次は内蔵音源自体を実録音ベースへ移行するのが優先です。

- ライセンスが明確な **Multi-sample WAV / SFZ**、またはユーザー自身の録音をローカルImport
- Velocity Layer / Round Robin / Key Range / Release Sample対応
- ミックス済みReference Audioから対象楽器を分離するローカルSource Separationの検討
- Attack / Early Body / Sustain / Releaseごとの時間変化スペクトル
- Phase / Formantを保ったSpectral Morph、Granular / WSOLA系の時間伸縮
- Bowed String / Brass / Voice / Reed / Mallet / Metal / Air等の参照素材拡張
- 自然言語はPreset選択・Reference Match後の微調整へ重点化
- VST3 Preset / State保存、複数VST3 / Effect Chain
- MusicXML / Standard MIDI File Export、ピアノロール／ステップシーケンサー
