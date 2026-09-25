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
- **静的サイト:** `index.html` 1枚（外部ライブラリなし）。CSP は meta タグで設定しています

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

- **波形表示:** 生成した音声の波形を Canvas で表示します。クリックや左右キーで再生位置を移動できます
- **履歴:** 生成した音声を、このブラウザ（IndexedDB）に最新20件まで保存します。再生・再ダウンロード・削除ができます
- **デザイン:** チョコミント配色です。ライトモードはミント地にチョコ、ダークモードはチョコ地にミントになります

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
build.py                ← src/*.js と app/ を結合し、CSP のハッシュを埋め込む
VERSION
app/body.html           ← 画面の HTML
app/style.css           ← スタイル（チョコミント配色・ライト／ダーク）
src/01_util.js          ← 共通処理、base64・WAV処理、タグの照合
src/02_storage.js       ← APIキー、作成した声の記録、設定、履歴（IndexedDB）
src/03_api.js           ← Gemini API クライアント（変換・TTS・voices）、声の用意
src/04_dialects.js      ← 方言データ、声・感情のプリセット
src/05_waveform.js      ← 波形表示（Canvas 2D）
src/10_ui.js            ← 画面の動作
dev/test.html           ← API疎通テスト
```

## 開発フェーズ

- [x] フェーズ1：API疎通の確認（`dev/test.html`）
- [x] フェーズ2：MVP（3ステップUI・5方言・Voice design・WAVダウンロード）＋初回デプロイ
- [x] フェーズ3：全方言、履歴（IndexedDB）、波形表示、チョコミント配色
- [ ] フェーズ4（任意）：字幕付き縦型MP4の書き出し

## License

MIT License — Copyright (c) 2026 4n5-Studio

同梱・流用した第三者コードは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を見てください。生成した音声の扱いは [Gemini API 利用規約](https://ai.google.dev/gemini-api/terms) に従います。
