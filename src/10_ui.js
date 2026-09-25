/*! NAMARI | MIT License | (c) 2026 4n5-Studio */
/* ============================================================
   NAMARI — UI: 1) text  2) dialect + conversion  3) voice + TTS
   User input and API output are only ever written with textContent.
   ============================================================ */
(() => {
'use strict';
if (!document.getElementById('app')) return;             // engine-only pages (dev/test.html)
const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  e.append(...kids);
  return e;
};

const MAX_CHARS = 1000;
const prefs = N.prefs.get();
const pick = (value, list, def) => (list.includes(value) ? value : def);
const S = {
  dialect: N.dialect(prefs.dialect) ? prefs.dialect : 'osaka',
  strength: pick(prefs.strength, N.STRENGTHS.map(s => s.id), 'mid'),
  region: null,
  converted: null,        // {src, dialect, strength, text} of the last conversion
  memKey: '',             // fallback when the browser refuses storage
  busy: false,
  audioUrl: null,
  lastArea: 'srcText',    // tag buttons insert into the textarea used last
};
S.region = N.dialect(S.dialect).region;
const getKey = () => N.apiKey.get() || S.memKey;
const dialect = () => N.dialect(S.dialect);

/* ---------------- notes & errors ---------------- */
function note(id, msg, kind = '', action = null) {
  const p = $(id);
  p.textContent = msg || '';
  p.className = 'note' + (kind ? ' ' + kind : '');
  if (action) {
    const b = el('button', { type: 'button', class: 'small' }, action.label);
    b.addEventListener('click', action.run);
    p.append(b);
  }
}
const openSettingsAction = { label: '設定を開く', run: () => openSettings() };
function showError(id, err) {
  if (err && err.name === 'AbortError') return;
  if (err instanceof N.ApiError) {
    const needsKey = ['nokey', 'key', 'referrer'].includes(err.kind);
    note(id, err.message + (err.detail ? `\n（詳細: ${err.detail}）` : ''), 'ng', needsKey ? openSettingsAction : null);
  } else {
    note(id, '予期しないエラーが発生しました。ページを再読み込みして、もう一度お試しください。' + (err && err.message ? `\n（詳細: ${err.message}）` : ''), 'ng');
  }
}
const onRetry = id => r => note(id, `混み合っています。${Math.ceil(r.wait / 1000)}秒待って再試行します（${r.attempt}/${r.max}回目）…`);

function setBusy(on, label) {
  S.busy = on;
  for (const id of ['btnConvert', 'btnGenerate']) $(id).disabled = on;
  $('btnGenerate').textContent = on && label ? label : '音声を生成';
}

/* ---------------- step 1: text ---------------- */
function updateCount() {
  const n = $('srcText').value.length;
  $('srcCount').textContent = `${n} / ${MAX_CHARS}`;
  $('srcCount').classList.toggle('over', n >= MAX_CHARS);
}
function insertTag(tag) {
  const ta = $(S.lastArea);
  const s = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
  const e = ta.selectionEnd == null ? s : ta.selectionEnd;
  const before = ta.value.slice(0, s), after = ta.value.slice(e);
  const text = (before && !/\s$/.test(before) ? ' ' : '') + tag + (!/^\s/.test(after) ? ' ' : '');
  if (ta.maxLength > 0 && ta.value.length - (e - s) + text.length > ta.maxLength) return;
  ta.setRangeText(text, s, e, 'end');
  ta.focus();
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
for (const t of N.TAG_BUTTONS) {
  const b = el('button', { type: 'button', title: `${t.tag} を挿入（最後に使った入力欄に入ります）` }, t.label);
  b.addEventListener('click', () => insertTag(t.tag));
  $('tagButtons').append(b);
}
$('srcText').maxLength = MAX_CHARS;
for (const id of ['srcText', 'dialectText']) $(id).addEventListener('focus', () => { S.lastArea = id; });
$('srcText').addEventListener('input', () => { updateCount(); updateStale(); });
$('dialectText').addEventListener('input', updateStale);

/* ---------------- step 2: dialect ---------------- */
function renderRegions() {
  const box = $('regionTabs');
  box.textContent = '';
  for (const r of N.REGIONS) {
    if (!N.DIALECTS.some(d => d.region === r)) continue;
    const b = el('button', { type: 'button', role: 'tab', 'aria-selected': String(r === S.region), 'aria-controls': 'dialectCards' }, r);
    if (dialect().region === r) b.append(el('span', { class: 'dot', 'aria-hidden': 'true' }));
    b.addEventListener('click', () => { S.region = r; renderRegions(); renderCards(); });
    box.append(b);
  }
}
function renderCards() {
  const box = $('dialectCards');
  box.textContent = '';
  for (const d of N.DIALECTS.filter(x => x.region === S.region)) {
    const name = el('span', { class: 'name' }, d.name);
    if (d.beta) name.append(el('span', { class: 'beta', title: 'β版：変換や発音が不安定な場合があります' }, 'β'));
    const b = el('button', { type: 'button', class: 'card', role: 'radio', 'aria-checked': String(d.id === S.dialect) },
      name, el('span', { class: 'sample' }, d.standard ? '比較用（変換せずに読み上げ）' : d.sampleText));
    b.addEventListener('click', () => selectDialect(d.id));
    box.append(b);
  }
}
function selectDialect(id) {
  S.dialect = id;
  N.prefs.set({ dialect: id });
  renderRegions();
  renderCards();
  renderStrength();
  updateAutoVoiceLabel();
  updateStale();
}
function renderStrength() {
  const box = $('strength');
  box.textContent = '';
  const std = !!dialect().standard;
  for (const s of N.STRENGTHS) {
    const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(s.id === S.strength) }, s.label);
    b.disabled = std;
    b.addEventListener('click', () => { S.strength = s.id; N.prefs.set({ strength: s.id }); renderStrength(); updateStale(); });
    box.append(b);
  }
  $('btnConvert').textContent = std ? 'そのまま使う' : '変換';
}

/* the dialect text still matches an older conversion (untouched by hand) -> reconvert on generate */
function isStale() {
  const c = S.converted;
  if (!c || $('dialectText').value !== c.text) return false;
  return c.src !== $('srcText').value.trim() || c.dialect !== S.dialect || (!dialect().standard && c.strength !== S.strength);
}
function updateStale() {
  if (isStale()) note('convertNote', '文章・方言・強さが変わりました。「変換」を押し直すか、そのまま「音声を生成」を押すと自動で変換し直します。', 'warn');
  else if ($('convertNote').classList.contains('warn') && !S.busy) note('convertNote', '');
}

async function convert() {
  const d = dialect();
  const src = $('srcText').value.trim();
  if (!src) { note('convertNote', 'ステップ1にテキストを入力してください。', 'ng'); $('srcText').focus(); return null; }
  const done = text => { $('dialectText').value = text; S.converted = { src, dialect: d.id, strength: S.strength, text }; };
  if (d.standard) {
    done(src);
    note('convertNote', '標準語は変換せず、そのまま読み上げます。', 'ok');
    return { text: src, usage: null };
  }
  const key = requireKey('convertNote');
  if (!key) return null;
  note('convertNote', `${d.name}に変換中…`);
  const r = await N.convertDialect({ key, text: src, name: d.name, hint: d.convertHint, strength: S.strength, onRetry: onRetry('convertNote') });
  done(r.text);
  if (r.tags.ok) note('convertNote', `${d.name}に変換しました。気になるところは、上の欄で手で直せます。`, 'ok');
  else note('convertNote', `${d.name}に変換しました。ただし、タグが変わっています（消えた: ${r.tags.missing.join(' ') || 'なし'} ／ 増えた: ${r.tags.added.join(' ') || 'なし'}）。必要なら手で直してください。`, 'warn');
  return r;
}
$('btnConvert').addEventListener('click', async () => {
  if (S.busy) return;
  setBusy(true);
  try { await convert(); } catch (err) { showError('convertNote', err); } finally { setBusy(false); }
});

/* ---------------- step 3: voice & generate ---------------- */
function fillSelect(sel, items, value) {
  sel.textContent = '';
  for (const it of items) sel.add(new Option(it.label, it.id));
  sel.value = items.some(it => it.id === value) ? value : items[0].id;
}
fillSelect($('voicePreset'), [{ id: 'auto', label: '自動' }, ...N.VOICE_PRESETS], prefs.voicePreset);
fillSelect($('emotion'), N.EMOTIONS, prefs.emotion);
fillSelect($('model'), N.TTS_MODELS, prefs.model);
function updateAutoVoiceLabel() {
  const p = N.voicePreset('auto', dialect());
  $('voicePreset').options[0].textContent = `自動（${p.label}）`;
}
function updatePriceNote() {
  const m = $('model').value, p = N.PRICING[m];
  const per10 = (10 * N.AUDIO_TOKENS_PER_SEC * p.output) / 1e6;
  $('priceNote').textContent = `料金の目安：音声10秒で約 $${per10.toFixed(4)}（${N.TTS_MODELS.find(x => x.id === m).label}）＋ 変換1回 $0.001 未満。2026年12月末までの有料枠の価格で、2027年1月から倍額の予定です。無料枠もあります。`;
}
$('voicePreset').addEventListener('change', () => N.prefs.set({ voicePreset: $('voicePreset').value }));
$('emotion').addEventListener('change', () => N.prefs.set({ emotion: $('emotion').value }));
$('model').addEventListener('change', () => { N.prefs.set({ model: $('model').value }); updatePriceNote(); });

function requireKey(noteId) {
  const key = getKey();
  if (key) return key;
  note(noteId, 'APIキーが設定されていません。', 'ng', openSettingsAction);
  openSettings();
  return '';
}

const STAGE = {
  find: (d, p) => `${d.name}の声（${p.label}）を確認中…`,
  create: (d, p) => `${d.name}の声（${p.label}）を作成中…（この組み合わせは初回だけ。数十秒かかることがあります）`,
  speak: () => '音声を生成中…',
};
const usd = (model, usage, fallbackOut) => {
  if (!usage && !fallbackOut) return 0;
  const u = usage || {};
  return N.estimateCost(model, u.total_input_tokens || 0, (u.total_output_tokens || fallbackOut || 0) + (u.total_thought_tokens || 0)) || 0;
};

async function generate() {
  const key = requireKey('genNote');
  if (!key) return;
  const d = dialect();
  let text = $('dialectText').value.trim();
  let conv = null;
  if (!text || isStale()) {
    note('genNote', '先に方言に変換します…');
    try { conv = await convert(); } catch (err) { showError('convertNote', err); note('genNote', '変換に失敗したため、生成を中止しました。', 'ng'); return; }
    if (!conv) { note('genNote', ''); return; }
    text = conv.text;
  }
  const preset = N.voicePreset($('voicePreset').value, d);
  const model = $('model').value;
  const emo = N.EMOTIONS.find(e => e.id === $('emotion').value) || N.EMOTIONS[0];
  const r = await N.synthesize({
    key, dialect: d, preset, model, text, style: emo.style,
    onRetry: onRetry('genNote'), onStage: st => note('genNote', STAGE[st](d, preset)),
  });
  showResult(r, { d, preset, model, conv });
}
function showResult(r, { d, preset, model, conv }) {
  if (S.audioUrl) URL.revokeObjectURL(S.audioUrl);
  S.audioUrl = URL.createObjectURL(new Blob([r.bytes], { type: 'audio/wav' }));
  const dur = (r.info && r.info.duration) || 0;
  const cost = usd(model, r.usage, Math.round(dur * N.AUDIO_TOKENS_PER_SEC)) + (conv ? usd(N.TEXT_MODEL, conv.usage) : 0);
  $('player').src = S.audioUrl;
  $('btnDownload').href = S.audioUrl;
  $('btnDownload').download = `namari-${d.id}-${N.stamp()}.wav`;
  $('resultMeta').textContent = `${d.name} · ${N.fmtSec(dur)} · ${N.fmtBytes(r.bytes.length)}` + (cost ? ` · 約 $${cost.toFixed(4)}` : '');
  $('result').hidden = false;
  if (!r.designed) {
    const why = r.voiceError && r.voiceError.message ? `\n（理由: ${r.voiceError.message}）` : '';
    note('genNote', `${d.name}の声を用意できなかったため、既定の声（${r.voice}）で読み上げました。なまりが弱くなることがあります。${why}`, 'warn');
  } else {
    note('genNote', r.voiceCreated ? `できました。${d.name}の声（${preset.label}）を新しく作りました。次回からはすぐに使えます。` : 'できました。', 'ok');
  }
  $('player').play().catch(() => { /* autoplay may be blocked: the controls are there */ });
}
$('btnGenerate').addEventListener('click', async () => {
  if (S.busy) return;
  setBusy(true, '生成中…');
  try { await generate(); } catch (err) { showError('genNote', err); } finally { setBusy(false); }
});

/* ---------------- settings dialog ---------------- */
function updateBadge() {
  const has = !!getKey();
  $('keyBadge').textContent = has ? 'キー設定済み' : 'キー未設定';
  $('keyBadge').classList.toggle('ok', has);
}
function renderKeyState() {
  const key = getKey(), mode = N.apiKey.mode();
  $('keyCurrent').hidden = !key;
  $('keyMasked').textContent = N.apiKey.mask(key);
  $('keyWhere').textContent = mode === 'session' ? '（このタブを閉じるまで）' : mode === 'local' ? '（このブラウザに保存）' : '（保存できないため、このページを開いている間だけ）';
  const radio = document.querySelector(`input[name=keyMode][value=${mode === 'session' ? 'session' : 'local'}]`);
  if (radio) radio.checked = true;
  const n = Object.keys(N.voiceCache.all()).length;
  $('voiceCount').textContent = `このブラウザで作成・記録した声: ${n}件`;
  $('btnVoicesDelete').disabled = !n;
  updateBadge();
}
function openSettings() {
  const dlg = $('dlgSettings');
  $('keyInput').value = '';
  $('keyInput').type = 'password';
  $('btnKeyShow').textContent = '表示';
  note('keyError', '');
  note('voicesNote', '');
  $('referrerExample').textContent = /\.github\.io$/.test(location.hostname) ? `${location.origin}/*` : 'https://<GitHubユーザー名>.github.io/*';
  renderKeyState();
  if (!dlg.open) dlg.showModal();
  $('keyInput').focus();
}
$('btnSettings').addEventListener('click', openSettings);
$('btnSettingsClose').addEventListener('click', () => $('dlgSettings').close());
$('btnKeyShow').addEventListener('click', () => {
  const show = $('keyInput').type === 'password';
  $('keyInput').type = show ? 'text' : 'password';
  $('btnKeyShow').textContent = show ? '隠す' : '表示';
});
$('keyInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('btnKeySave').click(); } });
$('btnKeySave').addEventListener('click', async () => {
  const typed = $('keyInput').value.trim();
  const key = typed || getKey();
  const mode = (document.querySelector('input[name=keyMode]:checked') || {}).value || 'local';
  if (!key) { note('keyError', 'APIキーを入力してください。', 'ng'); $('keyInput').focus(); return; }
  if (!N.apiKey.looksValid(key)) { note('keyError', 'キーの形式が正しくないようです。コピーし直してください。', 'ng'); return; }
  const btn = $('btnKeySave');
  btn.disabled = true;
  note('keyError', typed ? 'キーを確認中…' : '');
  try {
    if (typed) await N.listVoices({ key, filters: { type: 'prebuilt', page_size: 1 } });   // free call: checks the key (and referrer)
  } catch (err) {
    if (err instanceof N.ApiError && ['key', 'referrer'].includes(err.kind)) { btn.disabled = false; showError('keyError', err); return; }
    // network / rate problems: keep the key, the real call will report them
  }
  btn.disabled = false;
  S.memKey = '';
  if (!N.apiKey.save(key, mode)) S.memKey = key;
  note('keyError', '');
  renderKeyState();
  $('dlgSettings').close();
  note('genNote', 'APIキーを保存しました。', 'ok');
});
$('btnKeyDelete').addEventListener('click', () => {
  N.apiKey.clear();
  S.memKey = '';
  renderKeyState();
  note('keyError', 'キーを削除しました（localStorage・sessionStorage の両方から消しました）。', 'ok');
});
$('btnVoicesDelete').addEventListener('click', async () => {
  const key = getKey();
  if (!key) { note('voicesNote', '削除するにはAPIキーが必要です。', 'ng'); return; }
  if (!confirm('このブラウザで作成・記録した方言の声を、Google 側からも削除します。よろしいですか？')) return;
  const btn = $('btnVoicesDelete');
  btn.disabled = true;
  note('voicesNote', '削除中…');
  try {
    const r = await N.deleteCachedVoices({ key });
    note('voicesNote', `${r.deleted}件削除しました。` + (r.failed ? `${r.failed}件は削除できませんでした。` : ''), r.failed ? 'warn' : 'ok');
  } catch (err) { showError('voicesNote', err); }
  renderKeyState();
});

/* ---------------- terms dialog ---------------- */
$('btnTerms').addEventListener('click', () => $('dlgTerms').showModal());
$('btnTermsClose').addEventListener('click', () => $('dlgTerms').close());
for (const dlg of document.querySelectorAll('dialog')) {
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // click on the backdrop
}

/* ---------------- start ---------------- */
renderRegions();
renderCards();
renderStrength();
updateAutoVoiceLabel();
updatePriceNote();
updateCount();
updateBadge();
if (!getKey()) openSettings();
})();
