# NAMARI（なまり）

標準語で書いた文章を、**日本各地の方言で読み上げる**ブラウザ完結型ツールです。
Gemini API（`gemini-3.8-flash` で方言に書き換え → `gemini-3.8-flash-tts` で読み上げ）を、ブラウザから直接呼び出します。

- サーバーなし・ビルド済みの `index.html` 1枚で動作（GitHub Pages で公開）
- APIキーはブラウザにだけ保存し、Gemini API 以外には送信しません

> **開発状況:** フェーズ1（API疎通の確認）です。本体の画面はフェーズ2で作ります。

## フェーズ1：API疎通の確認（`dev/test.html`）

TTS・方言変換・Voice design・声の一覧を1つずつ呼び出して、レスポンスの形をログで確認するページです。

```bash
git clone https://github.com/4n5AI/NAMARI.git
cd NAMARI
python3 -m http.server 8000
# ブラウザで http://localhost:8000/dev/test.html を開く
```

1. **CORS確認（キー不要）** を押す → `✓ CORS OK` と出れば、ブラウザから API に届いています
2. APIキーを入力する（このページはキーを保存しません）
3. 「1. 方言変換」→「2. 読み上げ」→「3. Voice design」→「4. 声の一覧」の順に試す
4. 画面下のログ（APIキーは含まれません）を「ログをコピー」で共有する

> Voice design で作った声は Google 側に1年間保存されます（1プロジェクト200件まで）。テスト後は「この声を削除」で消してください。

## ファイル構成（予定）

```
index.html              ← build.py の出力（GitHub Pages で公開するファイル）
build.py                ← src/*.js と app/ を結合する
app/                    ← body.html, style.css
src/01_util.js          ← 共通処理、base64・WAV処理
src/02_storage.js       ← キー管理、IndexedDB
src/03_api.js           ← Gemini API クライアント（変換・TTS・voices）
src/04_dialects.js      ← 方言データ
src/05_waveform.js      ← 波形表示
src/10_ui.js            ← 画面
dev/test.html           ← API疎通の確認用
```

## License

MIT License — Copyright (c) 2026 4n5-Studio

同梱・流用した第三者コードは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を見てください。
