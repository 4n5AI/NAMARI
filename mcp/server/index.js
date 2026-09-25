#!/usr/bin/env node
/*! NAMARI MCP server | MIT License | (c) 2026 4n5-Studio */
/* ============================================================
   NAMARI — local MCP server (stdio, no dependencies, Node >= 18)
   Lets Claude (desktop / Claude Code) and other MCP clients convert Japanese
   into regional dialects and speak it with the Gemini API; audio is saved as
   WAV on this computer. The same code as the web app is reused:
   src/01_util.js, src/03_api.js, src/04_dialects.js
   (bundled next to this file as lib/ inside the .mcpb package).

   Protocol: answers both eras of MCP on the same stdio stream
     - 2025-11-25 and earlier: initialize / notifications/initialized / ping
     - 2026-07-28: server/discover, per-request _meta, resultType, cache hints
   Configuration (environment):
     GEMINI_API_KEY      required; sent only to generativelanguage.googleapis.com
     NAMARI_OUTPUT_DIR   where WAV files go (a NAMARI folder is made inside);
                         default: ~/Downloads/NAMARI (or ~/NAMARI)
     NAMARI_CONFIG_DIR   voice cache location; default ~/.namari
   stdout carries protocol messages only; diagnostics go to stderr.
   ============================================================ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

/* ---------------- load the shared browser code ---------------- */
globalThis.window = globalThis;
const LIB_DIRS = [path.join(__dirname, 'lib'), path.join(__dirname, '..', '..', 'src')];
for (const file of ['01_util.js', '03_api.js', '04_dialects.js']) {
  const dir = LIB_DIRS.find(d => fs.existsSync(path.join(d, file)));
  if (!dir) { process.stderr.write(`namari-mcp: missing ${file}\n`); process.exit(1); }
  vm.runInThisContext(fs.readFileSync(path.join(dir, file), 'utf8'), { filename: path.join(dir, file) });
}
const N = globalThis.N;

const readVersion = () => {
  for (const p of [path.join(__dirname, '..', 'manifest.json'), path.join(__dirname, '..', '..', 'VERSION')]) {
    try { const t = fs.readFileSync(p, 'utf8'); return p.endsWith('.json') ? JSON.parse(t).version : t.trim(); } catch (e) { /* next */ }
  }
  return '0.0.0';
};
const SERVER_INFO = { name: 'namari', title: 'NAMARI 方言ボイス', version: readVersion() };
const log = (...a) => process.stderr.write(`[namari-mcp] ${a.join(' ')}\n`);

/* ---------------- config ---------------- */
const API_KEY = () => String(process.env.GEMINI_API_KEY || '').trim();
const home = os.homedir();
function outputDir() {
  const base = String(process.env.NAMARI_OUTPUT_DIR || '').trim();
  const dir = base ? path.join(base, 'NAMARI')
    : fs.existsSync(path.join(home, 'Downloads')) ? path.join(home, 'Downloads', 'NAMARI') : path.join(home, 'NAMARI');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const configDir = () => String(process.env.NAMARI_CONFIG_DIR || '').trim() || path.join(home, '.namari');

/* designed dialect voices, cached in a file (the web app keeps the same thing in localStorage;
   both also find each other's voices on Google by display name) */
const cacheFile = () => path.join(configDir(), 'voice-cache.json');
const readCache = () => { try { const v = JSON.parse(fs.readFileSync(cacheFile(), 'utf8')); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
const writeCache = m => { try { fs.mkdirSync(configDir(), { recursive: true }); fs.writeFileSync(cacheFile(), JSON.stringify(m, null, 2)); } catch (e) { log('cannot write voice cache:', e.message); } };
N.voiceCache = {
  all: readCache,
  get: k => readCache()[k] || null,
  set: (k, v) => { const m = readCache(); m[k] = v; writeCache(m); },
  del: k => { const m = readCache(); delete m[k]; writeCache(m); },
  clear: () => writeCache({}),
};

/* ---------------- argument helpers ---------------- */
class ToolError extends Error {}
const MODEL = m => {
  const s = String(m || '').trim().toLowerCase();
  if (!s || s === 'flash' || s === 'high') return 'gemini-3.8-flash-tts';
  if (s === 'lite' || s === 'flash-lite' || s === 'fast') return 'gemini-3.8-flash-lite-tts';
  const hit = N.TTS_MODELS.find(x => x.id === s);
  if (!hit) throw new ToolError(`model は "flash"（高品質）か "lite"（高速・低コスト）を指定してください（受け取った値: ${m}）。`);
  return hit.id;
};
const DIALECT = q => {
  const d = N.findDialect(q || 'standard');
  if (!d) throw new ToolError(`方言「${q}」が見つかりません。list_dialects で使える方言（id または名前）を確認してください。`);
  return d;
};
const STRENGTH = s => { const v = String(s || 'mid').toLowerCase(); const map = { weak: 'weak', mid: 'mid', strong: 'strong', '弱': 'weak', '中': 'mid', '強': 'strong' }; return map[v] || 'mid'; };
const EMOTION = e => {
  const s = String(e || '').trim();
  if (!s) return { label: '', style: '' };
  const hit = N.EMOTIONS.find(x => x.id === s || x.label === s || x.label.startsWith(s));
  if (hit) return { label: hit.id === 'none' ? '' : hit.label, style: hit.style };
  if (s.length > 80) throw new ToolError('emotion（話し方の指示）は短くしてください（80文字まで）。');
  return { label: s, style: s };                              // a short custom style ("excited", "speaking slowly")
};
const PREBUILT = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina',
  'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'];
const safeName = s => String(s || '').replace(/\.wav$/i, '').replace(/[^\w\-぀-ヿ㐀-鿿]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
const requireKey = () => {
  const k = API_KEY();
  if (!k) throw new ToolError('GEMINI_API_KEY が設定されていません。Claude の拡張機能の設定（または MCP の設定の env）に、Google AI Studio で取得した Gemini API キーを入れてください。');
  return k;
};
const apiErr = err => (err instanceof N.ApiError ? err.message + (err.detail ? `（詳細: ${err.detail}）` : '') : err && err.message ? err.message : String(err));

/* ---------------- tools ---------------- */
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
const TOOLS = [
  {
    name: 'list_dialects',
    title: '方言と声の一覧',
    description: 'List the Japanese dialects NAMARI can convert to and speak (id, name, region, beta flag, sample), plus voice presets, emotion presets and inline vocal tags. Call this first to pick a dialect id.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: Object.assign({ openWorldHint: false }, RO),
    run: () => {
      const dialects = N.DIALECTS.map(d => ({ id: d.id, name: d.name, region: d.region, beta: !!d.beta, standard: !!d.standard, sample: d.sampleText }));
      const voices = [{ id: 'auto', label: '自動（方言ごとのおすすめ）' }, ...N.VOICE_PRESETS.map(p => ({ id: p.id, label: p.label }))];
      const emotions = N.EMOTIONS.map(e => ({ id: e.id, label: e.label, style: e.style }));
      const tags = N.TAG_GROUPS.flatMap(g => g.tags.map(t => ({ tag: t.tag, label: t.label, group: g.label })));
      const text = [
        '## 方言（dialect に id か名前を指定）',
        ...N.REGIONS.map(r => `- ${r}: ` + dialects.filter(d => d.region === r).map(d => `${d.name}（${d.id}${d.beta ? '・β' : ''}）`).join('、')),
        '', '## 声（voice）', voices.map(v => `${v.id}＝${v.label}`).join('、') + '、または自分の声の ID（voice_... / voicekey_...。list_voices で確認）',
        '', '## 感情（emotion）', emotions.map(e => `${e.id}＝${e.label}`).join('、') + '、または短い英語の指示（例: "excited"）',
        '', '## タグ（本文にそのまま書く。日本語の文中でも英語のまま）', tags.map(t => `${t.tag}＝${t.label}`).join(' '),
      ].join('\n');
      return { text, structured: { dialects, voices, emotions, tags } };
    },
  },
  {
    name: 'convert_to_dialect',
    title: '方言に書き換える',
    description: 'Rewrite standard Japanese text into a regional dialect (text only, no audio). Inline tags such as <laugh> are kept as they are. Use this when the user wants to see or edit the dialect text before speaking it.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Standard Japanese text (up to 1000 characters). May contain inline tags like <laugh>.' },
        dialect: { type: 'string', description: 'Dialect id or Japanese name, e.g. "osaka" or "大阪弁". See list_dialects.' },
        strength: { type: 'string', enum: ['weak', 'mid', 'strong'], description: 'How strong the dialect is. Default "mid".' },
      },
      required: ['text', 'dialect'],
      additionalProperties: false,
    },
    annotations: Object.assign({ openWorldHint: true }, RO, { idempotentHint: false }),
    run: async (a, signal) => {
      const d = DIALECT(a.dialect), text = String(a.text || '').trim();
      if (!text) throw new ToolError('text が空です。');
      if (text.length > 1000) throw new ToolError('text は1000文字までにしてください。');
      if (d.standard) return { text: text, structured: { dialect: d.id, dialect_text: text, tags_ok: true } };
      const r = await N.convertDialect({ key: requireKey(), text, name: d.name, hint: d.convertHint, strength: STRENGTH(a.strength), signal });
      const note = r.tags.ok ? '' : `\n\n（注意: タグが変わりました。消えた: ${r.tags.missing.join(' ') || 'なし'} ／ 増えた: ${r.tags.added.join(' ') || 'なし'}）`;
      return { text: r.text + note, structured: { dialect: d.id, dialect_name: d.name, dialect_text: r.text, tags_ok: r.tags.ok } };
    },
  },
  {
    name: 'speak',
    title: '方言で読み上げてWAVを保存',
    description: 'Speak Japanese in a regional dialect with Gemini TTS and save a WAV file on this computer. By default the text is standard Japanese and is converted to the dialect first (convert=true); pass convert=false if the text is already written in the dialect. The first use of a dialect+voice pair designs a matching dialect voice (can take tens of seconds). Returns the saved file path.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Japanese text to speak (up to 1000 characters). Inline tags like <laugh>, <sigh>, <short pause> are allowed.' },
        dialect: { type: 'string', description: 'Dialect id or Japanese name (default "standard"). See list_dialects.' },
        convert: { type: 'boolean', description: 'true (default): text is standard Japanese and is converted to the dialect first. false: speak the text as written.' },
        strength: { type: 'string', enum: ['weak', 'mid', 'strong'], description: 'Dialect strength for the conversion. Default "mid".' },
        voice: { type: 'string', description: '"auto" (default), a preset ("f-young", "f-old", "m-young", "m-old"), a prebuilt voice name (e.g. "Kore"), or the user\'s own voice id ("voice_..." / "voicekey_...", see list_voices).' },
        emotion: { type: 'string', description: 'Emotion preset id (e.g. "cheerful", "calm", "slow", "whisper") or a short English style. Default none.' },
        model: { type: 'string', enum: ['flash', 'lite'], description: '"flash" (default, best dialect quality) or "lite" (faster, cheaper).' },
        file_name: { type: 'string', description: 'Optional file name (without folder). Saved in the configured NAMARI output folder.' },
      },
      required: ['text'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    run: async (a, signal) => {
      const key = requireKey(), d = DIALECT(a.dialect), model = MODEL(a.model), emo = EMOTION(a.emotion);
      let text = String(a.text || '').trim();
      if (!text) throw new ToolError('text が空です。');
      if (text.length > 1000) throw new ToolError('text は1000文字までにしてください。');
      const source = text;
      let converted = false;
      if (a.convert !== false && !d.standard) {
        text = (await N.convertDialect({ key, text, name: d.name, hint: d.convertHint, strength: STRENGTH(a.strength), signal })).text;
        converted = true;
      }
      const v = String(a.voice || 'auto').trim();
      const own = /^(voice_|voicekey_)/.test(v) ? v : PREBUILT.find(p => p.toLowerCase() === v.toLowerCase()) || null;
      if (!own && v !== 'auto' && !N.VOICE_PRESETS.some(p => p.id === v)) throw new ToolError(`voice「${v}」は使えません。auto / f-young / f-old / m-young / m-old、既定の声の名前、または voice_... を指定してください。`);
      const preset = N.voicePreset(own ? 'auto' : v, d);
      const r = await N.synthesize({ key, dialect: d, preset, model, text, style: emo.style, fixedVoice: own, signal });
      const dir = outputDir();
      const file = path.join(dir, `${safeName(a.file_name) || `namari-${d.id}-${N.stamp()}`}.wav`);
      fs.writeFileSync(file, r.bytes);
      const dur = (r.info && r.info.duration) || 0;
      const voiceLabel = own ? (own.startsWith('voice') ? '自分の声' : own) : r.designed ? `${preset.label}（${d.name}の声）` : `既定の声 ${r.voice}`;
      const lines = [
        `保存しました: ${file}`,
        `方言: ${d.name} / 声: ${voiceLabel}${emo.label ? ` / 感情: ${emo.label}` : ''} / ${N.fmtSec(dur)}`,
        `読み上げた文: ${text}`,
      ];
      if (r.voiceCreated) lines.push(`（${d.name}の声を新しく作りました。次回からはすぐに使えます）`);
      if (!r.designed) lines.push(`（方言の声を用意できなかったため、既定の声で読み上げました。${r.voiceError ? apiErr(r.voiceError) : ''}）`);
      return {
        text: lines.join('\n'),
        extra: [{ type: 'resource_link', uri: pathToFileURL(file).href, name: path.basename(file), mimeType: 'audio/wav', description: `${d.name}の音声（${N.fmtSec(dur)}）` }],
        structured: { file, dialect: d.id, dialect_name: d.name, converted, source_text: source, spoken_text: text, voice: r.voice, designed_voice: !!r.designed && !own, seconds: Math.round(dur * 100) / 100, model },
      };
    },
  },
  {
    name: 'list_voices',
    title: '自分の声の一覧',
    description: 'List the user\'s own voices stored in their Google project: voices recorded in the NAMARI web app ("replicated") and dialect voices designed by NAMARI ("prompted"). Use a returned id as the voice of speak.',
    inputSchema: {
      type: 'object',
      properties: { type: { type: 'string', enum: ['replicated', 'prompted', 'all'], description: '"replicated" (default): voices recorded from the user. "prompted": designed voices. "all": both.' } },
      additionalProperties: false,
    },
    annotations: Object.assign({ openWorldHint: true }, RO),
    run: async (a, signal) => {
      const type = a.type === 'all' ? ['replicated', 'prompted'] : [a.type === 'prompted' ? 'prompted' : 'replicated'];
      const r = await N.listVoices({ key: requireKey(), filters: { type, page_size: 200 }, signal });
      const voices = (r.voices || []).filter(x => x && x.id).map(x => ({ id: String(x.id).replace(/^voices\//, ''), name: x.display_name || '', type: x.type || '', expire_time: x.expire_time || '' }));
      const text = voices.length ? voices.map(x => `- ${x.id}  ${x.name}  [${x.type}]${x.expire_time ? ` 期限 ${x.expire_time.slice(0, 10)}` : ''}`).join('\n')
        : 'まだ声がありません。NAMARI（https://4n5ai.github.io/NAMARI/）の「自分の声を登録」で、Google に保存する方法で登録するとここに出ます。';
      return { text, structured: { voices } };
    },
  },
  {
    name: 'make_namari_link',
    title: 'NAMARIを開くリンクを作る',
    description: 'Make a link that opens the NAMARI web app with the text, dialect and voice already filled in (nothing is generated until the user presses the button). Useful for sharing or for making a vertical caption video in the browser.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Standard Japanese text for step 1.' },
        dialect_text: { type: 'string', description: 'Already-converted dialect text for step 2 (optional).' },
        dialect: { type: 'string', description: 'Dialect id or Japanese name.' },
        strength: { type: 'string', enum: ['weak', 'mid', 'strong'] },
        voice: { type: 'string', description: '"auto", a preset id, or the user\'s own voice id.' },
        emotion: { type: 'string', description: 'Emotion preset id.' },
        model: { type: 'string', enum: ['flash', 'lite'] },
      },
      additionalProperties: false,
    },
    annotations: Object.assign({ openWorldHint: false }, RO),
    run: a => {
      const d = a.dialect ? DIALECT(a.dialect) : null;
      const url = N.buildLink(Object.assign({}, a, { dialect: d ? d.id : '' }));
      return { text: url, structured: { url } };
    },
  },
];

const INSTRUCTIONS = [
  'NAMARI turns Japanese text into regional dialect speech (20 dialects + standard) with the Gemini API.',
  'Typical flow: speak(text=<standard Japanese>, dialect=<id or name>) — it converts the text, speaks it and saves a WAV file; tell the user the saved path.',
  'Use list_dialects to find dialect ids. Inline tags like <laugh>, <sigh>, <short pause> can be placed in the text (keep them in English).',
  'For the user\'s own voice, call list_voices and pass the id as voice. make_namari_link opens the web app pre-filled (e.g. to make a caption video).',
].join(' ');

/* ---------------- JSON-RPC over stdio ---------------- */
const MODERN = '2026-07-28';
const LEGACY = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SUPPORTED = [MODERN, ...LEGACY];
const META_VER = 'io.modelcontextprotocol/protocolVersion';
const send = msg => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message, data) => send({ jsonrpc: '2.0', id, error: Object.assign({ code, message }, data === undefined ? {} : { data }) });
const inflight = new Map();

/* modern (per-request _meta) results carry resultType and the server identity */
const modernize = (result, extra) => Object.assign({ resultType: 'complete' }, result, extra || {}, { _meta: Object.assign({}, result._meta, { 'io.modelcontextprotocol/serverInfo': SERVER_INFO }) });
const toolList = () => TOOLS.map(t => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations }));

async function callTool(params, signal) {
  const tool = TOOLS.find(t => t.name === (params && params.name));
  if (!tool) return { rpcError: [-32602, `Unknown tool: ${params && params.name}`] };
  try {
    const out = await tool.run((params && params.arguments) || {}, signal);
    const result = { content: [{ type: 'text', text: out.text }, ...(out.extra || [])], isError: false };
    if (out.structured !== undefined) result.structuredContent = out.structured;
    return { result };
  } catch (err) {
    if (signal.aborted) return { cancelled: true };
    const msg = err instanceof ToolError ? err.message : apiErr(err);
    if (!(err instanceof ToolError) && !(err instanceof N.ApiError)) log('tool error:', err && err.stack ? err.stack : err);
    return { result: { content: [{ type: 'text', text: msg }], isError: true } };
  }
}

async function handle(msg) {
  const { id, method } = msg;
  const params = msg.params || {};
  const isRequest = id !== undefined && id !== null;
  if (!isRequest) {                                              // notifications
    if (method === 'notifications/cancelled') { const c = inflight.get(params.requestId); if (c) c.abort(); }
    return;
  }
  const requested = params._meta && params._meta[META_VER];
  const modern = !!requested || method === 'server/discover';
  if (requested && !SUPPORTED.includes(requested)) return fail(id, -32022, 'Unsupported protocol version', { supported: SUPPORTED, requested });
  switch (method) {
    case 'initialize': {
      const want = params.protocolVersion;
      return reply(id, { protocolVersion: LEGACY.includes(want) ? want : LEGACY[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
    }
    case 'ping': return reply(id, {});
    case 'server/discover':
      return reply(id, modernize({ supportedVersions: SUPPORTED, capabilities: { tools: {} }, instructions: INSTRUCTIONS }, { ttlMs: 3600000, cacheScope: 'public' }));
    case 'tools/list': {
      const result = { tools: toolList() };
      return reply(id, modern ? modernize(result, { ttlMs: 3600000, cacheScope: 'public' }) : result);
    }
    case 'tools/call': {
      const ctrl = new AbortController();
      inflight.set(id, ctrl);
      try {
        const r = await callTool(params, ctrl.signal);
        if (r.cancelled || ctrl.signal.aborted) return;                // cancelled: send nothing more
        if (r.rpcError) return fail(id, r.rpcError[0], r.rpcError[1]);
        return reply(id, modern ? modernize(r.result) : r.result);
      } finally { inflight.delete(id); }
    }
    default: return fail(id, -32601, `Method not found: ${method}`);
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch (e) { fail(null, -32700, 'Parse error'); continue; }
    const batch = Array.isArray(msg) ? msg : [msg];
    for (const m of batch) {
      if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') { if (m && m.id != null && !('result' in m) && !('error' in m)) fail(m.id, -32600, 'Invalid Request'); continue; }
      handle(m).catch(err => { log('internal error:', err && err.stack ? err.stack : err); if (m.id != null) fail(m.id, -32603, 'Internal error'); });
    }
  }
});
process.stdin.on('end', () => process.exit(0));
process.on('uncaughtException', err => log('uncaught:', err && err.stack ? err.stack : err));
log(`ready (v${SERVER_INFO.version}, key ${API_KEY() ? 'set' : 'missing'})`);
