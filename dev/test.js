/*! NAMARI | MIT License | (c) 2026 4n5-Studio */
/* ============================================================
   NAMARI — dev/test.html: call each API on its own and log the shapes
   ============================================================ */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const PREBUILT = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina',
  'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'];

/* ---------- log ---------- */
const MAX_JSON = 8000;
const log = (label, obj) => {
  const t = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  let s = `[${t}] ${label}`;
  if (obj !== undefined) {
    let j = typeof obj === 'string' ? obj : JSON.stringify(N.redact(obj), null, 2);
    if (j.length > MAX_JSON) j = j.slice(0, MAX_JSON) + `\n…（${j.length - MAX_JSON} 文字省略）`;
    s += '\n' + j;
  }
  $('log').textContent += s + '\n\n';
  $('log').scrollTop = $('log').scrollHeight;
};

/* every request/response through fetch is logged: method, path, body (redacted), status, ms. Headers (= the key) never. */
const realFetch = window.fetch.bind(window);
window.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  let body;
  try { body = init.body ? JSON.parse(init.body) : undefined; } catch (e) { body = '(non-JSON body)'; }
  log(`→ ${init.method || 'GET'} ${u.pathname}${u.search}`, body);
  const t0 = performance.now();
  const res = await realFetch(url, init);
  const ms = Math.round(performance.now() - t0);
  const text = await res.clone().text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch (e) { /* keep text */ }
  log(`← HTTP ${res.status} (${ms} ms, ${N.fmtBytes(text.length)})`, parsed);
  return res;
};

const say = (el, msg, ok) => { el.textContent = msg; el.className = 'out' + (ok === true ? ' ok' : ok === false ? ' ng' : ''); };
const errText = e => {
  if (e instanceof N.ApiError) return `✗ ${e.message}` + (e.status ? `\n  HTTP ${e.status}` : '') + (e.reason ? ` / ${e.reason}` : '') + (e.detail ? `\n  API: ${e.detail}` : '');
  return `✗ ${e && e.message ? e.message : e}`;
};
const key = () => $('key').value.trim();
const onRetry = r => log(`429: ${r.attempt}/${r.max} 回目の再試行まで ${(r.wait / 1000).toFixed(1)} 秒待ちます`);
const busy = async (btn, fn) => {
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = '実行中…';
  try { await fn(); } finally { btn.disabled = false; btn.textContent = label; }
};
const usageText = (model, usage, audioSec) => {
  if (!usage) return '';
  const inTok = usage.total_input_tokens || 0;
  const outTok = usage.total_output_tokens || (audioSec ? Math.round(audioSec * N.AUDIO_TOKENS_PER_SEC) : 0);
  const thought = usage.total_thought_tokens || 0;
  const usd = N.estimateCost(model, inTok, outTok + thought);
  return `\n  tokens: 入力 ${inTok} / 出力 ${outTok}${thought ? ` / 思考 ${thought}` : ''}` + (usd != null ? ` ≒ $${usd.toFixed(5)}` : '');
};
let urls = {};
const setAudio = (el, name, bytes) => {
  if (urls[name]) URL.revokeObjectURL(urls[name]);
  urls[name] = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  el.src = urls[name]; el.hidden = false;
  return urls[name];
};

/* ---------- init ---------- */
for (const sel of [$('ttsModel'), $('vdModel')]) for (const m of N.TTS_MODELS) sel.add(new Option(`${m.label} — ${m.id}`, m.id));
for (const v of PREBUILT) $('voiceList').append(new Option(v));
$('keyShow').addEventListener('click', () => {
  const show = $('key').type === 'password';
  $('key').type = show ? 'text' : 'password';
  $('keyShow').textContent = show ? '隠す' : '表示';
});
$('btnCopyLog').addEventListener('click', () => navigator.clipboard.writeText($('log').textContent).then(() => log('ログをコピーしました')));
$('btnClearLog').addEventListener('click', () => { $('log').textContent = ''; });
log(`ページを開きました: origin=${location.origin}`);

/* ---------- 0. CORS ---------- */
$('btnCors').addEventListener('click', e => busy(e.target, async () => {
  try {
    await N.listVoices({ key: 'INVALID_KEY_FOR_CORS_CHECK', filters: { page_size: 1 } });
    say($('corsOut'), '？ 想定外: 無効なキーで成功しました', false);
  } catch (err) {
    if (err instanceof N.ApiError && err.kind === 'key') say($('corsOut'), `✓ CORS OK（${location.origin} から API に届き、エラー内容を読み取れました）`, true);
    else say($('corsOut'), errText(err) + '\n  → ブラウザの開発者ツールの Console に CORS エラーが出ていないか確認してください。', false);
  }
}));

/* ---------- 1. convert ---------- */
$('btnConvert').addEventListener('click', e => busy(e.target, async () => {
  say($('cvOut'), '変換中…');
  const t0 = performance.now();
  try {
    const r = await N.convertDialect({ key: key(), text: $('cvText').value, name: $('cvName').value.trim(), hint: $('cvHint').value.trim(), strength: $('cvStrength').value, onRetry });
    const tagMsg = r.tags.ok ? 'タグ: ✓ そのまま' : `タグ: ✗ 消えた ${r.tags.missing.join(' ') || 'なし'} / 増えた ${r.tags.added.join(' ') || 'なし'}`;
    say($('cvOut'), `${r.text}\n\n${tagMsg}（${Math.round(performance.now() - t0)} ms）${usageText(N.TEXT_MODEL, r.usage)}`, true);
    $('btnUseConverted').disabled = false;
    $('btnUseConverted').onclick = () => { $('ttsText').value = r.text; $('ttsText').focus(); };
  } catch (err) { say($('cvOut'), errText(err), false); }
}));

/* ---------- 2. TTS ---------- */
$('btnTts').addEventListener('click', e => busy(e.target, async () => {
  say($('ttsOut'), '生成中…');
  $('ttsDl').hidden = true;
  const model = $('ttsModel').value;
  const t0 = performance.now();
  try {
    const r = await N.tts({ key: key(), model, text: $('ttsText').value, style: $('ttsStyle').value.trim(), voice: $('ttsVoice').value.trim(), onRetry });
    const i = r.info || {};
    say($('ttsOut'), `✓ ${r.mime} → ${i.sampleRate} Hz / ${i.channels}ch / ${i.bits}bit / ${N.fmtSec(i.duration || 0)} / ${N.fmtBytes(r.bytes.length)}（${Math.round(performance.now() - t0)} ms）` + usageText(model, r.usage, i.duration), true);
    const url = setAudio($('ttsAudio'), 'tts', r.bytes);
    Object.assign($('ttsDl'), { href: url, download: `namari-test-${N.stamp()}.wav`, hidden: false });
    $('ttsAudio').play().catch(() => {});
  } catch (err) { say($('ttsOut'), errText(err), false); }
}));

/* ---------- 3. Voice design ---------- */
let designed = null;
$('btnDesign').addEventListener('click', e => busy(e.target, async () => {
  say($('vdOut'), '声を作成中…');
  const t0 = performance.now();
  try {
    const r = await N.createVoice({ key: key(), model: $('vdModel').value, prompt: $('vdPrompt').value.trim(), displayName: $('vdName').value.trim(), gender: $('vdGender').value, onRetry });
    designed = r.id;
    const s = r.sample && r.sample.info;
    say($('vdOut'), `✓ ${r.id}（${Math.round(performance.now() - t0)} ms）` + (s ? `\n  試聴音声: ${s.sampleRate} Hz / ${N.fmtSec(s.duration)}` : '\n  試聴音声なし'), true);
    if (r.sample) { setAudio($('vdAudio'), 'vd', r.sample.bytes); $('vdAudio').play().catch(() => {}); }
    $('btnUseVoice').disabled = $('btnDeleteVoice').disabled = false;
  } catch (err) { say($('vdOut'), errText(err), false); }
}));
$('btnUseVoice').addEventListener('click', () => { if (designed) { $('ttsVoice').value = designed; $('ttsVoice').focus(); } });
$('btnDeleteVoice').addEventListener('click', e => busy(e.target, async () => {
  if (!designed || !confirm(`${designed} を削除します。よろしいですか？`)) return;
  try {
    await N.deleteVoice({ key: key(), id: designed });
    say($('vdOut'), `✓ 削除しました: ${designed}`, true);
    designed = null;
    $('btnUseVoice').disabled = true;
  } catch (err) { say($('vdOut'), errText(err), false); }
}).then(() => { $('btnDeleteVoice').disabled = !designed; }));

/* ---------- 4. voice list ---------- */
$('btnList').addEventListener('click', e => busy(e.target, async () => {
  say($('vlOut'), '取得中…');
  $('vlItems').textContent = '';
  try {
    const filters = { language_code: $('vlLang').value.trim(), type: $('vlType').value, accent: $('vlAccent').value.trim(), search: $('vlSearch').value.trim(), page_size: 200 };
    const r = await N.listVoices({ key: key(), filters });
    const voices = r.voices || [];
    say($('vlOut'), `✓ ${voices.length} 件${r.next_page_token ? '（続きあり）' : ''}`, true);
    for (const v of voices) {
      const li = document.createElement('li');
      const attrs = [v.type, v.language_code, v.gender, v.accent, v.region_code, v.pitch && 'pitch=' + v.pitch, v.persona].filter(Boolean).join(', ');
      li.textContent = `${v.id || v.name || '-'}  ${v.display_name || ''}  [${attrs}]${v.description ? ' — ' + v.description : ''}`;
      li.addEventListener('click', () => { if (v.id) $('ttsVoice').value = v.id; });
      li.title = 'クリックで 2. の声に入れる';
      $('vlItems').append(li);
    }
  } catch (err) { say($('vlOut'), errText(err), false); }
}));
})();
