# NAMARI MCP サーバー

ChatGPT や Claude などの AI から、NAMARI の「方言で読み上げる」機能を使うためのローカル MCP サーバーです。
AI に「この文を博多弁で読み上げて」と頼むと、方言に書き換えて読み上げ、WAV ファイルとしてこのPCに保存します。

- 依存パッケージなし（Node.js 18 以上だけで動きます）
- Webアプリと同じコード（`src/01_util.js`・`src/03_api.js`・`src/04_dialects.js`）を使います
- 通信先は Gemini API（generativelanguage.googleapis.com）だけです。APIキーは環境変数で渡し、ログにも出しません
- MCP の新旧どちらの方式にも対応しています（`2026-07-28` の `server/discover` と、`2025-11-25` 以前の `initialize`）

## 入れ方

### Claude デスクトップ版（おすすめ）

1. [namari.mcpb](https://4n5ai.github.io/NAMARI/mcp/namari.mcpb) をダウンロードします
2. ファイルを開くと、Claude のインストール画面が出ます（「設定」→「拡張機能」にドラッグ＆ドロップしても入れられます）
3. 「Gemini API キー」と「保存先フォルダ」を入力して、有効にします

### Claude Code

```bash
git clone https://github.com/4n5AI/NAMARI.git
claude mcp add namari -s user -e GEMINI_API_KEY=あなたのキー -- node "$(pwd)/NAMARI/mcp/server/index.js"
```

### そのほかの MCP クライアント（設定ファイルで登録する場合）

```json
{
  "mcpServers": {
    "namari": {
      "command": "node",
      "args": ["/NAMARIを置いた場所/NAMARI/mcp/server/index.js"],
      "env": { "GEMINI_API_KEY": "あなたのキー" }
    }
  }
}
```

## 環境変数

| 名前 | 内容 | 既定値 |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API キー（必須） | なし |
| `NAMARI_OUTPUT_DIR` | 音声の保存先。この中に `NAMARI` フォルダを作ります | `~/Downloads/NAMARI`（なければ `~/NAMARI`） |
| `NAMARI_CONFIG_DIR` | 作成した方言の声の記録（`voice-cache.json`）を置く場所 | `~/.namari` |

## ツール

| ツール | できること |
|---|---|
| `speak` | 方言に変換して読み上げ、WAV を保存します。`dialect`・`voice`（auto / f-young / f-old / m-young / m-old / 自分の声の ID）・`emotion`・`model`（flash / lite）・`strength` を指定できます。`convert: false` にすると、書かれた文をそのまま読みます |
| `convert_to_dialect` | 方言の文章だけを作ります（音声は作りません） |
| `list_dialects` | 方言・声・感情・タグの一覧を返します |
| `list_voices` | Google に保存した自分の声（Webアプリで「Google に保存」を選んで登録したもの）の一覧を返します |
| `make_namari_link` | Webアプリを入力済みで開くリンクを作ります（字幕付き動画を作りたいときなど） |

## 頼み方の例

- 「今日はとても暑いですね。でも夕方には涼しくなるそうです」を博多弁で読み上げて
- この文章を大阪弁の年配の男性の声で、ゆっくり読んで
- 私の声（list_voices で出てきた声）で、名古屋弁にして読み上げて
- 津軽弁に変換した文章を見せて。そのあと読み上げて

## 開発

`python3 build.py` を実行すると、Webアプリ（`index.html`）と一緒に `mcp/namari.mcpb` も作り直します。
`mcp/manifest.json` のバージョンは、リポジトリの `VERSION` に合わせて自動で更新されます。
