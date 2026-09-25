/*! NAMARI | MIT License | (c) 2026 4n5-Studio */
/* ============================================================
   NAMARI — video: vertical (9:16) MP4 with captions
   captions: text -> sentences -> caption chunks, timed from the audio
             (weights by spoken length, boundaries snapped to pauses)
   scene:    Canvas 2D frame renderer (also used for the live preview)
   encode:   WebCodecs VideoEncoder / AudioEncoder + mp4-muxer (vendor/)
   The codec candidates and the "retry in software" order are adapted from
   JIZURA src/11_export.js — MIT License, Copyright (c) 2026 hakoniwa
   (see THIRD_PARTY_NOTICES.md).
   ============================================================ */
(() => {
'use strict';

const FPS = 30;
N.VIDEO_SIZES = [
  { id: '1080', label: '1080×1920（フルHD）', w: 1080, h: 1920, bitrate: 8e6 },
  { id: '720', label: '720×1280（軽量）', w: 720, h: 1280, bitrate: 4e6 },
];
N.videoSupported = () => typeof window.VideoEncoder !== 'undefined' && typeof window.VideoFrame !== 'undefined' && typeof window.Mp4Muxer !== 'undefined';

/* ---------------- captions ---------------- */
const CLOSERS = '」』）)】〉》"\'';
const ENDERS = '。！？!?…';
const stripTags = s => String(s || '').replace(N.TAG_RE, ' ').replace(/\s+/g, ' ').trim();
const spokenLen = s => stripTags(s).replace(/[\s、。，．,.!！?？…「」『』（）()ー〜~・]/g, '').length;
const TAG_WEIGHT = { '<long pause>': 8, '<short pause>': 3 };           // in "characters" (~7 chars / s)
const tagWeight = s => N.extractTags(s).reduce((w, t) => w + (TAG_WEIGHT[t] || 4), 0);

/* split into sentences, keeping the end mark (and a closing bracket after it) */
N.splitSentences = text => {
  const out = [];
  let cur = '', depth = 0;                           // no split inside 「…」 (「ほんまに？」って思う。 is one sentence)
  const s = String(text || '').replace(/\r/g, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\n') { if (cur.trim()) out.push(cur.trim()); cur = ''; depth = 0; continue; }
    cur += ch;
    if ('「『（(【'.includes(ch)) depth++;
    else if ('」』）)】'.includes(ch)) depth = Math.max(0, depth - 1);
    else if (ENDERS.includes(ch) && !depth) {
      while (i + 1 < s.length && (ENDERS.includes(s[i + 1]) || CLOSERS.includes(s[i + 1]))) cur += s[++i];
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

/* a sentence -> chunks of at most maxChars spoken characters (cut after 、 when possible) */
function chunkSentence(sentence, maxChars) {
  const pieces = [];
  let piece = '';
  for (const ch of sentence) { piece += ch; if ('、，,'.includes(ch)) { pieces.push(piece); piece = ''; } }
  if (piece) pieces.push(piece);
  const out = [];
  let cur = '';
  for (const p of pieces) {
    if (cur && spokenLen(cur + p) > maxChars) { out.push(cur); cur = ''; }
    cur += p;
    while (spokenLen(cur) > maxChars) {                 // no comma to cut at: hard split
      let k = 0, n = 0;
      while (k < cur.length && n < maxChars) { if (spokenLen(cur[k])) n++; k++; }
      out.push(cur.slice(0, k));
      cur = cur.slice(k);
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/* 10 ms RMS envelope of a 16-bit WAV */
N.audioEnvelope = bytes => {
  const info = N.parseWav(bytes);
  if (!info || info.bits !== 16) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset + info.dataOffset, info.dataLength);
  const stride = 2 * info.channels, n = Math.floor(info.dataLength / stride), hop = Math.max(1, Math.round(info.sampleRate / 100));
  const env = new Float32Array(Math.ceil(n / hop));
  for (let f = 0; f < env.length; f++) {
    let s = 0, m = 0;
    for (let i = f * hop; i < Math.min(n, (f + 1) * hop); i++, m++) { const v = dv.getInt16(i * stride, true) / 32768; s += v * v; }
    env[f] = m ? Math.sqrt(s / m) : 0;
  }
  return { env, rate: 100, duration: n / info.sampleRate };
};

/* -> [{text, t0, t1, sentence}] ; weights by spoken length, boundaries snapped to the quietest point nearby */
N.buildCaptions = (text, envelope, { maxChars = 24 } = {}) => {
  const { env, rate, duration } = envelope;
  const chunks = [];
  N.splitSentences(text).forEach((s, si) => {
    for (const c of chunkSentence(s, maxChars)) {
      const w = spokenLen(c) + tagWeight(c);
      const shown = stripTags(c);
      if (!shown || !spokenLen(c)) { if (chunks.length) chunks[chunks.length - 1].w += w; continue; }   // e.g. a lone <laugh>
      chunks.push({ text: shown, sentence: si, w: Math.max(1, w), anchor: /[、，,。！？!?…」』）)]$/.test(stripTags(c)) });
    }
  });
  if (!chunks.length) return [];
  const sorted = Array.from(env).sort((a, b) => a - b);
  const thr = Math.max(0.006, (sorted[Math.floor(sorted.length * 0.9)] || 0) * 0.12);
  let a = 0, b = env.length - 1;
  while (a < env.length && env[a] < thr) a++;
  while (b > a && env[b] < thr) b--;
  const tStart = a < env.length ? a / rate : 0, tEnd = b > a ? (b + 1) / rate : duration;

  /* pauses: runs of >= 80 ms below the threshold inside the voiced span */
  const pauses = [];
  for (let f = a, run = -1; f <= b + 1; f++) {
    const quiet = f <= b && env[f] < thr;
    if (quiet && run < 0) run = f;
    if (!quiet && run >= 0) { if (f - run >= 8) pauses.push({ t: (run + f) / 2 / rate, len: (f - run) / rate }); run = -1; }
  }
  /* boundaries after punctuation ("anchors") are matched, in order, to pauses (DP; longer pauses and
     closeness to the estimate win); every other boundary is placed by text length between its fixed neighbours */
  const total = chunks.reduce((s, c) => s + c.w, 0), nb = chunks.length - 1;
  const cum = [];
  for (let i = 0, acc = 0; i < nb; i++) cum.push(acc += chunks[i].w);
  const guess = cum.map(c => tStart + (c / total) * (tEnd - tStart));
  const anchors = [];
  for (let i = 0; i < nb; i++) if (chunks[i].anchor) anchors.push(i);
  const A = anchors.length, P = pauses.length, SKIP = 0.6;
  const D = Array.from({ length: A + 1 }, () => new Float64Array(P + 1));
  const C = Array.from({ length: A + 1 }, () => new Uint8Array(P + 1));      // 0 skip pause, 1 skip anchor, 2 match
  for (let i = 1; i <= A; i++) { D[i][0] = D[i - 1][0] + SKIP; C[i][0] = 1; }
  for (let i = 1; i <= A; i++) for (let j = 1; j <= P; j++) {
    const dist = Math.abs(pauses[j - 1].t - guess[anchors[i - 1]]);
    const opts = [D[i][j - 1], D[i - 1][j] + SKIP, dist <= 2 ? D[i - 1][j - 1] + dist - Math.min(pauses[j - 1].len, 0.6) * 1.2 : Infinity];
    const k = opts.indexOf(Math.min(...opts));
    D[i][j] = opts[k];
    C[i][j] = k;
  }
  const fixed = new Map();
  for (let i = A, j = P; i > 0;) {
    const k = j > 0 ? C[i][j] : 1;
    if (k === 0) j--;
    else if (k === 1) i--;
    else { fixed.set(anchors[i - 1], pauses[j - 1].t); i--; j--; }
  }
  const bounds = [tStart];
  for (let i = 0; i < nb; i++) {
    if (fixed.has(i)) { bounds.push(fixed.get(i)); continue; }
    let L = -1, R = nb;
    for (let k = i - 1; k >= 0; k--) if (fixed.has(k)) { L = k; break; }
    for (let k = i + 1; k < nb; k++) if (fixed.has(k)) { R = k; break; }
    const tL = L < 0 ? tStart : fixed.get(L), cL = L < 0 ? 0 : cum[L];
    const tR = R >= nb ? tEnd : fixed.get(R), cR = R >= nb ? total : cum[R];
    bounds.push(tL + ((cum[i] - cL) / Math.max(1e-9, cR - cL)) * (tR - tL));
  }
  bounds.push(tEnd);
  for (let i = 1; i < bounds.length - 1; i++) bounds[i] = Math.min(Math.max(bounds[i], bounds[i - 1] + 0.25), tEnd - 0.25 * (bounds.length - 1 - i));
  return chunks.map((c, i) => ({ text: c.text, sentence: c.sentence, t0: bounds[i], t1: bounds[i + 1] }));
};

/* standard-language line per dialect sentence, only when both texts split into the same number of sentences */
N.captionTranslations = (dialectText, srcText) => {
  if (!srcText) return null;
  const a = N.splitSentences(dialectText), b = N.splitSentences(srcText).map(stripTags);
  return a.length && a.length === b.length ? b : null;
};

/* ---------------- scene ---------------- */
const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Noto Sans CJK JP","Yu Gothic",Meiryo,system-ui,sans-serif';
const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';
const THEMES = {
  dark: { bg0: '#0a0b10', bg1: '#141726', glowA: 'rgba(124,58,237,0.30)', glowB: 'rgba(6,182,212,0.20)', text: '#eef0f7', muted: '#8f95aa', wave: '#2b3040', head: '#ffffff', g1: '#8b5cf6', g2: '#22d3ee' },
  light: { bg0: '#f7f8fc', bg1: '#e9ebf5', glowA: 'rgba(124,58,237,0.14)', glowB: 'rgba(6,182,212,0.14)', text: '#11131a', muted: '#5b6275', wave: '#d4d8e6', head: '#11131a', g1: '#7c3aed', g2: '#06b6d4' },
};
const NO_START = '、。，．,.！？!?…」』）)】ーっゃゅょぁぃぅぇぉッャュョァィゥェォ〜';
const NO_END = '「『（(【';

/* character wrapping with simple kinsoku (no 、。」 at a line start, no 「 at a line end) */
function wrap(g, text, maxW, maxLines) {
  const lines = [];
  let cur = '';
  for (const ch of text) {
    if (g.measureText(cur + ch).width > maxW && cur) {
      if (NO_START.includes(ch)) { cur += ch; continue; }
      let carry = '';
      while (cur.length > 1 && NO_END.includes(cur[cur.length - 1])) { carry = cur[cur.length - 1] + carry; cur = cur.slice(0, -1); }
      lines.push(cur);
      cur = carry + ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] = keep[maxLines - 1].replace(/.$/, '…'); return keep; }
  return lines;
}
const fmtClock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

N.VideoScene = class {
  /* item: {bytes, text, srcText, dialectName, voiceLabel}; o: {w, h, theme, captions, translation, logo} */
  constructor(item, o) {
    this.o = o;
    this.W = o.w;
    this.H = o.h;
    this.k = o.w / 1080;
    this.T = THEMES[o.theme] || THEMES.dark;
    this.item = item;
    const envelope = N.audioEnvelope(item.bytes);
    this.env = envelope;
    this.duration = envelope ? envelope.duration : 0;
    this.peaks = (N.wavPeaks(item.bytes, 600) || {}).peaks || new Float32Array(2);
    this.caps = o.captions && envelope ? N.buildCaptions(item.text, envelope) : [];
    this.trans = o.translation ? N.captionTranslations(item.text, item.srcText) : null;
    this.bg = this.makeBackground();
  }
  makeBackground() {
    const c = document.createElement('canvas');
    c.width = this.W;
    c.height = this.H;
    const g = c.getContext('2d'), { W, H, T } = this;
    const lin = g.createLinearGradient(0, 0, 0, H);
    lin.addColorStop(0, T.bg0);
    lin.addColorStop(1, T.bg1);
    g.fillStyle = lin;
    g.fillRect(0, 0, W, H);
    for (const [x, y, r, col] of [[0.1, 0.08, 0.75, T.glowA], [0.95, 0.62, 0.7, T.glowB]]) {
      const rg = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * W);
      rg.addColorStop(0, col);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
    }
    return c;
  }
  level(t) {                                         // smoothed loudness 0..1 at time t
    if (!this.env) return 0;
    const { env, rate } = this.env, f = Math.floor(t * rate);
    let s = 0, m = 0;
    for (let i = f - 4; i <= f + 1; i++) if (i >= 0 && i < env.length) { s += env[i]; m++; }
    return Math.min(1, (m ? s / m : 0) * 5);
  }
  caption(t) {
    const caps = this.caps;
    if (!caps.length) return null;
    if (t < caps[0].t0) return t >= caps[0].t0 - 0.15 ? caps[0] : null;
    for (let i = caps.length - 1; i >= 0; i--) if (t >= caps[i].t0) return caps[i];
    return null;
  }
  draw(g, t) {
    const { W, k, T } = this, d = this.duration || 1, cx = W / 2;
    const grad = (x0, x1) => { const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, T.g1); gr.addColorStop(1, T.g2); return gr; };
    g.drawImage(this.bg, 0, 0);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';

    /* brand: equalizer bars that follow the voice + wordmark */
    if (this.o.logo) {
      const lv = this.level(t), base = [0.38, 0.7, 1, 0.58, 0.3];
      g.font = `800 ${34 * k}px ${FONT}`;
      const word = 'N A M A R I', ww = g.measureText(word).width, bw = 7 * k, gap = 5 * k, bars = base.length * (bw + gap);
      const x0 = cx - (bars + 16 * k + ww) / 2, y = 196 * k;
      g.fillStyle = grad(x0, x0 + bars);
      base.forEach((b, i) => {
        const h = (10 + 34 * b * (0.35 + 0.65 * lv)) * k;
        g.beginPath();
        g.roundRect ? g.roundRect(x0 + i * (bw + gap), y - h / 2, bw, h, bw / 2) : g.rect(x0 + i * (bw + gap), y - h / 2, bw, h);
        g.fill();
      });
      g.fillStyle = T.text;
      g.textAlign = 'left';
      g.fillText(word, x0 + bars + 16 * k, y + 12 * k);
      g.textAlign = 'center';
    }

    /* dialect title */
    g.fillStyle = T.muted;
    g.font = `600 ${26 * k}px ${MONO}`;
    g.fillText('D I A L E C T   V O I C E', cx, 318 * k);
    g.fillStyle = T.text;
    g.font = `800 ${92 * k}px ${FONT}`;
    g.fillText(this.item.dialectName || '', cx, 424 * k, W - 120 * k);
    if (this.item.voiceLabel) {
      g.fillStyle = T.muted;
      g.font = `500 ${32 * k}px ${FONT}`;
      g.fillText(this.item.voiceLabel, cx, 482 * k, W - 160 * k);
    }

    /* waveform with progress */
    const wx = 90 * k, ww = W - 180 * k, wy = 700 * k, wh = 230 * k, p = Math.min(1, t / d);
    const peaks = this.peaks, buckets = peaks.length / 2, bar = 6 * k, gap = 4 * k, n = Math.floor((ww + gap) / (bar + gap));
    let top = 0;
    for (let i = 0; i < peaks.length; i++) top = Math.max(top, Math.abs(peaks[i]));
    const gain = top > 0 ? Math.min(1 / top, 8) : 1, played = grad(wx, wx + ww);
    for (let i = 0; i < n; i++) {
      const s = Math.floor((i * buckets) / n), e = Math.max(s + 1, Math.floor(((i + 1) * buckets) / n));
      let amp = 0;
      for (let b = s; b < e; b++) amp = Math.max(amp, -peaks[b * 2], peaks[b * 2 + 1]);
      const h = Math.max(4 * k, amp * gain * wh);
      g.fillStyle = (i + 0.5) / n <= p ? played : T.wave;
      g.beginPath();
      const x = wx + i * (bar + gap);
      g.roundRect ? g.roundRect(x, wy - h / 2, bar, h, bar / 2) : g.rect(x, wy - h / 2, bar, h);
      g.fill();
    }
    if (p > 0 && p < 1) { g.fillStyle = T.head; g.fillRect(wx + p * ww - 1.5 * k, wy - wh / 2 - 10 * k, 3 * k, wh + 20 * k); }

    /* captions */
    const cap = this.caption(t);
    if (cap) {
      const a = Math.min(1, Math.max(0, (t - cap.t0 + 0.15) / 0.18));
      g.globalAlpha = a;
      g.fillStyle = T.text;
      g.font = `800 ${76 * k}px ${FONT}`;
      const lines = wrap(g, cap.text, W - 150 * k, 3), lh = 104 * k;
      const y0 = 1130 * k - ((lines.length - 1) * lh) / 2 + (1 - a) * 14 * k;
      lines.forEach((ln, i) => g.fillText(ln, cx, y0 + i * lh));
      if (this.trans && this.trans[cap.sentence]) {
        g.fillStyle = T.muted;
        g.font = `500 ${40 * k}px ${FONT}`;
        const tl = wrap(g, this.trans[cap.sentence], W - 170 * k, 2);
        const ty = y0 + (lines.length - 1) * lh + 92 * k;
        tl.forEach((ln, i) => g.fillText(ln, cx, ty + i * 56 * k));
      }
      g.globalAlpha = 1;
    }

    /* progress + time (kept above the area short-video apps cover with their UI) */
    const px = 90 * k, pw = W - 180 * k, py = 1560 * k;
    g.fillStyle = T.wave;
    g.fillRect(px, py, pw, 6 * k);
    g.fillStyle = played;
    g.fillRect(px, py, pw * p, 6 * k);
    g.fillStyle = T.muted;
    g.font = `500 ${28 * k}px ${MONO}`;
    g.textAlign = 'left';
    g.fillText(fmtClock(t), px, py + 50 * k);
    g.textAlign = 'right';
    g.fillText(fmtClock(d), px + pw, py + 50 * k);
    g.textAlign = 'center';
  }
};

/* ---------------- encoding ---------------- */
/* candidates and fallback order adapted from JIZURA (MIT, (c) 2026 hakoniwa) */
const VIDEO_CANDS = [
  { codec: 'avc1.640034', mux: 'avc', label: 'H.264 High' },
  { codec: 'avc1.640033', mux: 'avc', label: 'H.264 High' },
  { codec: 'avc1.4d0033', mux: 'avc', label: 'H.264 Main' },
  { codec: 'avc1.42003e', mux: 'avc', label: 'H.264 Baseline' },
  { codec: 'vp09.00.51.08', mux: 'vp9', label: 'VP9' },
  { codec: 'av01.0.12M.08', mux: 'av1', label: 'AV1' },
];
const vcfg = (c, w, h, bitrate, hw) => {
  const cfg = { codec: c.codec, width: w, height: h, bitrate, framerate: FPS };
  if (hw) cfg.hardwareAcceleration = hw;
  if (c.mux === 'avc') cfg.avc = { format: 'avc' };
  return cfg;
};
const supported = async cfg => { try { const s = await VideoEncoder.isConfigSupported(cfg); return !!(s && s.supported); } catch (e) { return false; } };
/* best first: the browser's pick, the same codec in software, then other H.264 profiles / VP9 / AV1 in software */
async function videoAttempts(w, h, bitrate) {
  const out = [], seen = new Set();
  const add = async (c, hw, br) => {
    const key = `${c.codec}|${hw || ''}|${br}`;
    if (seen.has(key) || out.length >= 4) return;
    const cfg = vcfg(c, w, h, br, hw);
    if (await supported(cfg)) { seen.add(key); out.push(Object.assign({}, c, { cfg })); }
  };
  let first = null;
  for (const c of VIDEO_CANDS) if (await supported(vcfg(c, w, h, bitrate))) { first = c; break; }
  if (first) { await add(first, null, bitrate); await add(first, 'prefer-software', bitrate); }
  for (const c of VIDEO_CANDS) if (c !== first) await add(c, 'prefer-software', Math.round(bitrate * 0.8));
  return out;
}
async function audioCodec() {
  if (typeof window.AudioEncoder === 'undefined') return null;
  for (const c of [{ codec: 'mp4a.40.2', mux: 'aac' }, { codec: 'opus', mux: 'opus' }]) {
    for (const ch of [1, 2]) {
      try { const s = await AudioEncoder.isConfigSupported({ codec: c.codec, sampleRate: 48000, numberOfChannels: ch, bitrate: 128000 }); if (s && s.supported) return Object.assign({ ch }, c); } catch (e) { /* next */ }
    }
  }
  return null;
}
async function pcm48k(bytes, channels, seconds) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(channels, Math.max(1, Math.ceil(seconds * 48000)), 48000);
  const buf = await ctx.decodeAudioData(bytes.slice().buffer);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
  return ctx.startRendering();
}
const tick = () => new Promise(r => setTimeout(r, 0));
const cancelled = () => Object.assign(new Error('書き出しを中止しました。'), { name: 'AbortError' });

/* -> {blob, codec, audio, seconds}; throws Error with a Japanese message */
N.exportVideo = async (item, o, { onProgress, signal } = {}) => {
  if (!N.videoSupported()) throw new Error('このブラウザは動画の書き出し（WebCodecs）に対応していません。Chrome・Edge・Safari の最新版で開いてください。');
  const size = N.VIDEO_SIZES.find(s => s.id === o.size) || N.VIDEO_SIZES[0];
  const scene = new N.VideoScene(item, Object.assign({}, o, { w: size.w, h: size.h }));
  const ac = await audioCodec();
  if (!ac) throw new Error('このブラウザは音声のエンコードに対応していないため、音声付きの動画を書き出せません。Chrome・Edge の最新版で開いてください。');
  const attempts = await videoAttempts(size.w, size.h, size.bitrate);
  if (!attempts.length) throw new Error('このブラウザでは動画をエンコードできませんでした。Chrome・Edge の最新版で開いてください。');
  const tried = [];
  for (const vc of attempts) {
    try {
      return await encode(scene, vc, ac, size, { onProgress, signal });
    } catch (err) {
      if ((signal && signal.aborted) || (err && err.name === 'AbortError')) throw cancelled();
      tried.push(`${vc.label}${vc.cfg.hardwareAcceleration ? '（ソフトウェア）' : ''}: ${err && err.message ? err.message : err}`);
    }
  }
  throw new Error(`動画を書き出せませんでした。サイズを「720×1280（軽量）」にして試してください。\n（詳細: ${tried.join(' ／ ')}）`);
};

async function encode(scene, vc, ac, size, { onProgress, signal }) {
  const { w, h } = size, duration = scene.duration + 0.4, total = Math.max(1, Math.ceil(duration * FPS));
  const target = new Mp4Muxer.ArrayBufferTarget();
  const muxer = new Mp4Muxer.Muxer({
    target, fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    video: { codec: vc.mux, width: w, height: h, frameRate: FPS },
    audio: { codec: ac.mux, numberOfChannels: ac.ch, sampleRate: 48000 },
  });
  let err = null, outFrames = 0;
  const venc = new VideoEncoder({ output: (chunk, meta) => { outFrames++; try { muxer.addVideoChunk(chunk, meta); } catch (e) { err = e; } }, error: e => { err = e; } });
  venc.configure(vc.cfg);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d', { alpha: false });
  const close = enc => { try { if (enc.state !== 'closed') enc.close(); } catch (e) { /* closed */ } };
  try {
    for (let i = 0; i < total; i++) {
      if (signal && signal.aborted) throw cancelled();
      if (err) throw err;
      scene.draw(g, i / FPS);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      try { venc.encode(frame, { keyFrame: i % (FPS * 2) === 0 }); } finally { frame.close(); }
      let spins = 0;
      while (venc.encodeQueueSize > 4 && !err) { await new Promise(r => setTimeout(r, 2)); if (!document.hidden && ++spins > 15000) throw new Error('エンコーダーが応答しません'); }
      if (i === Math.min(total - 1, FPS * 2) && !outFrames) { await venc.flush(); if (!outFrames) throw new Error('エンコーダーが出力を返しません'); }
      if (i % 5 === 0) { if (onProgress) onProgress((i / total) * 0.94, `映像 ${i + 1} / ${total} フレーム`); await tick(); }
    }
    await venc.flush();
    if (err) throw err;
  } finally { close(venc); }

  if (onProgress) onProgress(0.95, '音声をエンコード中…');
  const pcm = await pcm48k(scene.item.bytes, ac.ch, duration);
  let aErr = null;
  const aenc = new AudioEncoder({ output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { aErr = e; } }, error: e => { aErr = e; } });
  aenc.configure({ codec: ac.codec, sampleRate: 48000, numberOfChannels: ac.ch, bitrate: 128000 });
  try {
    const frames = pcm.length, block = 4800;
    for (let off = 0; off < frames && !aErr; off += block) {
      if (signal && signal.aborted) throw cancelled();
      const n = Math.min(block, frames - off), data = new Float32Array(n * ac.ch);
      for (let c = 0; c < ac.ch; c++) data.set(pcm.getChannelData(c).subarray(off, off + n), c * n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: ac.ch, timestamp: Math.round((off * 1e6) / 48000), data });
      aenc.encode(ad);
      ad.close();
      if (aenc.encodeQueueSize > 16) await new Promise(r => setTimeout(r, 1));
    }
    await aenc.flush();
    if (aErr) throw aErr;
  } finally { close(aenc); }

  muxer.finalize();
  if (onProgress) onProgress(1, '完了');
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), codec: vc.label, audio: ac.mux.toUpperCase(), seconds: duration, frames: total };
}
})();
