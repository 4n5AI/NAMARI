"""Build the single-file NAMARI app for GitHub Pages, and the MCP bundle.
usage: python3 build.py   -> index.html (vendor/mp4-muxer.js + src/*.js + app/body.html + app/style.css, inlined)
                          -> mcp/namari.mcpb (Claude desktop one-click install: mcp/server + the shared src files)

The page carries its own Content-Security-Policy (GitHub Pages cannot set headers):
the inline <script> and <style> are allowed by their SHA-256 hashes, and the only
network destination is the Gemini API."""
import base64, glob, hashlib, json, os, urllib.parse, zipfile
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
read = lambda p: open(p, encoding='utf-8').read()

VERSION = read('VERSION').strip()
BASE = 'https://4n5ai.github.io/NAMARI/'
TITLE = 'NAMARI — 方言ボイス・ジェネレーター'
DESCRIPTION = '標準語で書いた文章を、大阪弁・博多弁・津軽弁など20の方言と、あなた自身の声で読み上げるブラウザ完結型ツール。Gemini API を使用。'
API_ORIGIN = 'https://generativelanguage.googleapis.com'
BANNER = f'NAMARI v{VERSION} | MIT License | (c) 2026 4n5-Studio | https://github.com/4n5AI/NAMARI'
FAVICON = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
           "<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#8b5cf6'/><stop offset='1' stop-color='#22d3ee'/></linearGradient></defs>"
           "<rect width='64' height='64' rx='16' fill='#0a0b10'/><g fill='url(#g)'>"
           "<rect x='12' y='26' width='6' height='12' rx='3'/><rect x='21' y='17' width='6' height='30' rx='3'/>"
           "<rect x='30' y='10' width='6' height='44' rx='3'/><rect x='39' y='20' width='6' height='24' rx='3'/>"
           "<rect x='48' y='27' width='6' height='10' rx='3'/></g></svg>")

sources = sorted(glob.glob('src/*.js'))
MUXER = '\n/*! mp4-muxer v5.2.2 | MIT License | (c) 2023 Vanilagy | see THIRD_PARTY_NOTICES.md */\n' + read('vendor/mp4-muxer.js') + '\n'
script = '\n' + '\n'.join(read(f) for f in sources).replace('@VERSION@', VERSION) + '\n'
style = '\n' + read('app/style.css') + '\n'
body = read('app/body.html').replace('@VERSION@', VERSION)
for name, text, tag in (('script', script, '</script'), ('mp4-muxer', MUXER, '</script'), ('style', style, '</style')):
    if tag in text.lower(): raise ValueError(f'{name} must not contain {tag}')
if '@VERSION@' in body + script: raise ValueError('unreplaced @VERSION@')

sha = lambda s: "'sha256-" + base64.b64encode(hashlib.sha256(s.encode('utf-8')).digest()).decode() + "'"
csp = '; '.join([
    "default-src 'none'",
    f"script-src {sha(MUXER)} {sha(script)}",
    f"style-src {sha(style)}",
    f"connect-src {API_ORIGIN}",
    'img-src data:',
    'media-src blob:',
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
])
favicon = 'data:image/svg+xml,' + urllib.parse.quote(FAVICON, safe=":/=', ")

html = f'''<!doctype html>
<!--! {BANNER} -->
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="{csp}">
<title>{TITLE}</title>
<meta name="description" content="{DESCRIPTION}">
<link rel="canonical" href="{BASE}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="NAMARI">
<meta property="og:title" content="{TITLE}">
<meta property="og:description" content="{DESCRIPTION}">
<meta property="og:url" content="{BASE}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{TITLE}">
<meta name="twitter:description" content="{DESCRIPTION}">
<meta name="theme-color" content="#f5f6fb" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a0b10" media="(prefers-color-scheme: dark)">
<link rel="icon" href="{favicon}">
<style>{style}</style>
</head>
<body>
{body}
<script>{MUXER}</script>
<script>{script}</script>
</body>
</html>
'''
open('index.html', 'w', encoding='utf-8').write(html)
print('index.html', len(html.encode('utf-8')), 'bytes,', len(sources), 'scripts')

# ---------------- MCP bundle (.mcpb = zip with manifest.json) ----------------
MCP_LIB = ['src/01_util.js', 'src/03_api.js', 'src/04_dialects.js']      # the browser code the MCP server reuses
manifest = json.loads(read('mcp/manifest.json'))
if manifest['version'] != VERSION:                                      # keep the bundle version in step with the app
    manifest['version'] = VERSION
    open('mcp/manifest.json', 'w', encoding='utf-8').write(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
entries = [('manifest.json', 'mcp/manifest.json'), ('icon.png', 'mcp/icon.png'), ('README.md', 'mcp/README.md'),
           ('LICENSE', 'LICENSE'), ('server/index.js', 'mcp/server/index.js')] + [('server/lib/' + os.path.basename(f), f) for f in MCP_LIB]
with zipfile.ZipFile('mcp/namari.mcpb', 'w', zipfile.ZIP_DEFLATED) as z:
    for name, src in entries:                                           # fixed timestamps: same input -> same bytes
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.external_attr = 0o644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, open(src, 'rb').read())
print('mcp/namari.mcpb', os.path.getsize('mcp/namari.mcpb'), 'bytes,', len(entries), 'files')
