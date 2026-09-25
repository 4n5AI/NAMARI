# Third-party notices

NAMARI 本体は MIT License（Copyright (c) 2026 4n5-Studio）です。
このファイルには、NAMARI に同梱・流用した第三者のコードと、そのライセンスを記載します。

## 同梱しているコード

### mp4-muxer 5.2.2

- 用途：縦型動画（MP4）の書き出し
- 入手元：npm パッケージ `mp4-muxer@5.2.2` の `build/mp4-muxer.js`（https://github.com/Vanilagy/mp4-muxer）
- 同梱のしかた：`vendor/mp4-muxer.js` に改変せずに置き、`build.py` で `index.html` に埋め込んでいます
- ライセンス：MIT License（原文は `vendor/LICENSE.mp4-muxer.txt`）

```
MIT License

Copyright (c) 2023 Vanilagy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 流用・改変したコード

### JIZURA（src/11_export.js の一部）

- 流用先：`src/07_video.js`（動画コーデックの候補一覧と、失敗したときにソフトウェアエンコードで再試行する順番）
- 入手元：https://github.com/852wa/JIZURA
- そのほか、`src/*.js` を `build.py` で1枚の `index.html` にまとめる構成と、GitHub Pages での公開方式を参考にしています
- ライセンス：MIT License

```
MIT License

Copyright (c) 2026 hakoniwa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 外部サービス

- Gemini API（Google）：生成した音声の扱いは [Gemini API 利用規約](https://ai.google.dev/gemini-api/terms) に従います。
  生成音声には SynthID の電子透かしが入ります。
