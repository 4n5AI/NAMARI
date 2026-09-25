# NAMARI（なまり）

標準語で書いた文章を、**日本各地の方言で読み上げる**ブラウザ完結型ツールです。

**公開URL:** https://4n5ai.github.io/NAMARI/

1. **テキストを入力**（標準語）
2. **方言を選ぶ** → 「変換」で方言の文章に書き換え（手で直せます）
3. **声を選んで生成** → 再生・WAVダウンロード

## しくみ

| 段階 | 使うもの |
|---|---|
| 方言への書き換え | `gemini-3.8-flash`（Interactions API） |
| 方言話者の声 | Voice design（`POST /v1beta/voices`）。方言×声の種類ごとに初回だけ作成し、ブラウザに記録して再利用 |
| 読み上げ | `gemini-3.8-flash-tts`（高品質）／`gemini-3.8-flash-lite-tts`（高速・低コスト） |

- **サーバーなし:** ブラウザから Gemini API を直接呼び出します
- **APIキーはブラウザにだけ保存:** localStorage／sessionStorage を選べます。送信先は Gemini API だけです
- **静的サイト:** `index.html` 1枚（読み込む外部ファイルなし。mp4-muxer も埋め込み済み）。CSP は meta タグで設定しています
- **AI から使える:** ローカル MCP サーバー（Claude など）と、入力済みで開くリンク（どのAIでも）

### 対応している方言（20方言＋標準語）

| 地方 | 方言 |
|---|---|
| 北海道 | 北海道弁 |
| 東北 | 津軽弁（β）／秋田弁（β）／仙台弁（β） |
| 関東 | 茨城弁（β）／江戸っ子（べらんめえ）／標準語（比較用） |
| 中部 | 名古屋弁／金沢弁（β） |
| 近畿 | 京都弁／大阪弁／神戸弁 |
| 中国 | 広島弁／岡山弁 |
| 四国 | 土佐弁／伊予弁（β） |
| 九州 | 博多弁／長崎弁（β）／熊本弁／鹿児島弁（β） |
| 沖縄 | ウチナーヤマトグチ（β） |

「β」は、変換や発音が不安定になりやすい方言です。方言のデータは `src/04_dialects.js` にまとめています。

### そのほかの機能

- **自分の声（マイボイス）:** 自分の声を録音して登録すると、その声で方言を読み上げられます（Gemini API の [Voice replication](https://ai.google.dev/gemini-api/docs/voice-replication)）
  - 声のサンプル（10〜30秒）と、同意文の読み上げを録音します。サンプルは音声ファイルからも読み込めます
  - 録音は 24kHz・モノラル・16bit の WAV に変換し、前後の無音を削ってから送信します
  - 保存方法は2つから選べます：「Google に保存（`voice_...`・1年間）」または「Google に保存しない（`voicekey_...`・7日間、キーはこのブラウザに保存）」
  - 登録できるのは本人の声だけです（同意文の録音と、本人確認のチェックが必要です）
- **縦型動画（MP4）:** 生成した音声から、字幕付きの 9:16 動画（1080×1920 / 720×1280）をブラウザの中で書き出します（WebCodecs + mp4-muxer）
  - 字幕は方言テキストを文・読点ごとに区切り、音声の間（ま）に合わせて自動で表示します
  - 標準語の訳（字幕の下に小さく表示）、背景（ダーク／ライト）、ロゴの有無を選べます
- **タグ:** 公式の36種類のタグ（笑い・息・感情・しぐさ・間）を、ボタンから挿入できます
- **波形表示:** 生成した音声の波形を Canvas で表示します。クリックや左右キーで再生位置を移動できます
- **履歴:** 生成した音声を、このブラウザ（IndexedDB）に最新20件まで保存します。再生・再ダウンロード・削除ができます
- **デザイン:** 声の信号をイメージした、紫から水色へのグラデーションを使っています。ライト／ダークモードに対応しています

## AI から使う（MCP・リンク）

- **MCP（Claude デスクトップ版・Claude Code など）:** AI に「この文を博多弁で読み上げて」と頼むと、方言の音声（WAV）を自分のPCに保存します。
  Claude デスクトップ版は [namari.mcpb](https://4n5ai.github.io/NAMARI/mcp/namari.mcpb) を開くだけで入ります。詳しくは [mcp/README.md](mcp/README.md) を見てください
- **リンク（どのAIでも）:** `https://4n5ai.github.io/NAMARI/#text=…&dialect=osaka` の形のリンクを開くと、入力済みの状態で NAMARI が開きます（自動では生成しません）。
  値は `#` より後ろ（URL のフラグメント）に入れるので、サーバーには送られません

| リンクのパラメーター | 内容 |
|---|---|
| `text` | 標準語の文章（ステップ01） |
| `dialect_text` | 方言の文章（ステップ02。AI が書き換えた文を渡すとき） |
| `dialect` | 方言の ID か名前（`osaka`・`大阪弁` など） |
| `strength` | `weak` / `mid` / `strong` |
| `voice` | `auto` / `f-young` / `f-old` / `m-young` / `m-old` / 自分の声の ID |
| `emotion` | `cheerful` / `energetic` / `calm` / `slow` / `whisper` / `sad` |
| `model` | `flash` / `lite` |

画面上部の「設定」→「AI連携」タブに、導入手順と、AI に渡す指示文（コピー用）があります。

## 使い方

1. [Google AI Studio](https://aistudio.google.com/apikey) で Gemini API キーを取得します
2. 公開URLを開き、「設定」にキーを入力します
3. Google Cloud コンソールで、キーに **HTTPリファラー制限** を設定します（下記）

## 公開手順（GitHub Pages）

```bash
python3 build.py        # src/*.js と app/ から index.html を作る
git add index.html
git commit -m "Build"
git push origin main
```

1. リポジトリの **Settings → Pages** を開きます
2. 「Build and deployment」の Source で **Deploy from a branch** を選び、Branch を **main / (root)** にして Save します
3. 数分後に `https://<GitHubユーザー名>.github.io/<リポジトリ名>/` で公開されます。**Enforce HTTPS** も有効にしてください
4. 公開URLを、Google Cloud 側の APIキーの **HTTPリファラー制限** に追加します
   - 例: `https://4n5ai.github.io/*`

GitHub Actions は使いません。`index.html` をそのままコミットして公開します（`.nojekyll` で Jekyll の処理を無効にしています）。

## 開発

```bash
python3 build.py
python3 -m http.server 8000
# http://localhost:8000/            … 本体
# http://localhost:8000/dev/test.html … API疎通テスト（各APIを1つずつ呼び、レスポンスの形をログに出す）
```

`localhost` で試すときは、リファラー制限のないキーを使うか、制限に `http://localhost:8000/*` を追加してください。

## ファイル構成

```
index.html              ← build.py の出力（GitHub Pages で公開するファイル）
build.py                ← index.html と mcp/namari.mcpb を作る（CSP のハッシュも埋め込む）
VERSION
app/body.html           ← 画面の HTML
app/style.css           ← スタイル（ライト／ダーク）
src/01_util.js          ← 共通処理、base64・WAV処理、タグの照合
src/02_storage.js       ← APIキー、作成した声の記録、設定、履歴（IndexedDB）
src/03_api.js           ← Gemini API クライアント（変換・TTS・Voice design・Voice replication）
src/04_dialects.js      ← 方言データ、声・感情のプリセット
src/05_waveform.js      ← 波形表示（Canvas 2D）
src/06_recorder.js      ← マイク録音、24kHz モノラル WAV への変換
src/07_video.js         ← 縦型動画：字幕のタイミング、描画、エンコード
vendor/mp4-muxer.js     ← MP4 の書き出し（mp4-muxer 5.2.2、MIT License）
src/10_ui.js            ← 画面の動作
dev/test.html           ← API疎通テスト
mcp/server/index.js     ← ローカル MCP サーバー（依存なし・Node.js 18+）
mcp/manifest.json       ← Claude デスクトップ版向けパッケージ（.mcpb）の定義
mcp/namari.mcpb         ← build.py の出力（Claude デスクトップ版にそのまま入れられる）
```

## 開発フェーズ

- [x] フェーズ1：API疎通の確認（`dev/test.html`）
- [x] フェーズ2：MVP（3ステップUI・5方言・Voice design・WAVダウンロード）＋初回デプロイ
- [x] フェーズ3：全方言、履歴（IndexedDB）、波形表示
- [x] 追加：自分の声（Voice replication）、デザイン刷新
- [x] フェーズ4：字幕付き縦型MP4の書き出し
- [x] 追加：AI 連携（ローカル MCP サーバー・入力済みリンク）、設定画面のタブ（設定／使い方／AI連携）

## License

MIT License — Copyright (c) 2026 4n5-Studio

同梱・流用した第三者コードは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を見てください。生成した音声の扱いは [Gemini API 利用規約](https://ai.google.dev/gemini-api/terms) に従います。
